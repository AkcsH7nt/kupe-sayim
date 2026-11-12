// Kamera + barkod + rakam okuma. Fotoğraf/kare hiçbir yere kaydedilmez; yalnız bellekte işlenir.
// Gerekenler: sayfada vendor/tesseract.min.js (global Tesseract) ve vendor/zxing-reader.js (global ZXingWASM).
import { ocrMetnindenNumara, barkoddanNumara, Oylayici } from './kupe.js';
import { griVeKontrast, cevir180 } from './onisleme.js';
import { satirlariBul } from './bolutleme.js';

const OCR_GENISLIK = 600;
const KENAR = 20;
const SATIR_YUKSEKLIGI = 60; // okuyucunun en iyi çalıştığı karakter boyu (px)

const yol = (p) => new URL(p, document.baseURI).href;

// WebAssembly SIMD desteği (wasm-feature-detect ile aynı küçük modül).
const SIMD = (() => {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch { return false; }
})();

/**
 * Ekrandaki çerçeve (video karesine göre, ortada): genişliğin %80'i, yüksekliği genişliğin 3/4'ü
 * (küpe yatay bir dikdörtgen), en fazla yüksekliğin %80'i. Oranlar 0–1 arası döner.
 */
export function cerceveOranlari(vw, vh) {
  const w = 0.8 * vw;
  const h = Math.min(0.8 * vh, w * 0.75);
  return { x: (vw - w) / 2 / vw, y: (vh - h) / 2 / vh, w: w / vw, h: h / vh };
}

export class Okuyucu {
  constructor({ video = null, onNumara = () => {}, onDurum = () => {} } = {}) {
    this.video = video;
    this.onNumara = onNumara;
    this.onDurum = onDurum;
    this.oylayici = new Oylayici();
    this.calisiyor = false;
    this.duraklatildi = false;
    this.nesil = 0;
    this.sonKareZamani = -1;
    this.bekleBitis = 0;
    this.tuval = document.createElement('canvas');
    this.ctx = this.tuval.getContext('2d', { willReadFrequently: true });
    this.isci = null;
    this.barkodOkuyucu = null;
  }

  /** Rakam ve barkod motorlarını hazırlar (internet gerekmez; dosyalar vendor/ altında). */
  async hazirla() {
    if (this.isci) return;
    this.onDurum('Okuyucu hazırlanıyor…');
    const cekirdek = SIMD ? 'vendor/tesseract-core-simd-lstm.wasm.js' : 'vendor/tesseract-core-lstm.wasm.js';
    this.isci = await Tesseract.createWorker('eng', 1, {
      workerPath: yol('vendor/worker.min.js'),
      corePath: yol(cekirdek),
      langPath: yol('vendor/'),
      cacheMethod: 'none',
      gzip: true,
      // Aynı kökenli işçi: iPhone'da işçinin dosya istekleri de çevrimdışı önbellekten gelsin.
      workerBlobURL: false,
      logger: () => {},
      errorHandler: (e) => this.onDurum('Okuyucu hatası: ' + e),
    });
    await this.isci.setParameters({
      tessedit_char_whitelist: '0123456789',
    });
    await this.#barkodHazirla();
    this.onDurum('Hazır');
  }

  async #barkodHazirla() {
    if ('BarcodeDetector' in window) {
      try {
        const destek = await BarcodeDetector.getSupportedFormats();
        if (destek.includes('code_128')) {
          // Yalnız küpe barkoduna uygun biçimler; EAN/ITF kısmi okumada yanlış rakam üretebilir.
          const bicimler = ['code_128', 'code_39'].filter((b) => destek.includes(b));
          const d = new BarcodeDetector({ formats: bicimler });
          this.barkodOkuyucu = async (veri) => (await d.detect(veri)).map((s) => s.rawValue);
          return;
        }
      } catch { /* yedeğe geç */ }
    }
    ZXingWASM.prepareZXingModule({
      overrides: { locateFile: (dosya) => yol('vendor/' + dosya) },
      fireImmediately: true,
    });
    this.barkodOkuyucu = async (veri) =>
      (await ZXingWASM.readBarcodes(veri, { formats: ['Code128', 'Code39'], tryHarder: true, maxNumberOfSymbols: 1 }))
        .filter((s) => s.isValid).map((s) => s.text);
  }

  /** Bir görüntünün (isteğe bağlı kırpılmış) bölgesinden barkod ve rakam okur. */
  async goruntuOku(kaynak, kirp = null) {
    await this.hazirla();
    const sw = kaynak.videoWidth || kaynak.naturalWidth || kaynak.width;
    const sh = kaynak.videoHeight || kaynak.naturalHeight || kaynak.height;
    const k = kirp ?? { x: 0, y: 0, w: sw, h: sh };

    // Barkod: ince çizgiler için tam çözünürlük (küçükse 800 px'e büyüt).
    let barkod = null;
    this.sonBarkodMetni = null;
    try {
      const ham = this.#ciz(kaynak, k, Math.max(1, 800 / k.w));
      for (const metin of await this.barkodOkuyucu(ham)) {
        this.sonBarkodMetni = metin; // sahada barkod içeriğini görebilmek için
        barkod = barkoddanNumara(metin);
        if (barkod) break;
      }
    } catch { /* barkod okunamadı, rakama geç */ }

    // Rakam: kırpıntı 600 px genişliğe getirilir, siyah-beyaza çevrilir.
    const ham = this.#ciz(kaynak, k, OCR_GENISLIK / k.w);
    const islenmis = griVeKontrast(ham.data, ham.width, ham.height);
    const rakam = await this.#rakamOku(islenmis, ham.width, ham.height);
    return { barkod, rakam };
  }

  #ciz(kaynak, k, olcek) {
    const w = Math.round(k.w * olcek), h = Math.round(k.h * olcek);
    this.tuval.width = w; this.tuval.height = h;
    this.ctx.drawImage(kaynak, k.x, k.y, k.w, k.h, 0, 0, w, h);
    return this.ctx.getImageData(0, 0, w, h);
  }

  /** Siyah-beyaz görüntüyü (isteğe bağlı bir bölgesini, hedef yüksekliğe ölçekleyip) beyaz kenarlı tuvale koyar. */
  #kenarli(veri, w, h, bolge = null, hedefYukseklik = 0) {
    const b = bolge ?? { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
    // Pay: yanlara geniş (kenardaki ince "1" kaçmasın), alt-üste dar (barkod çubuğu girmesin).
    const by = b.y1 - b.y0 + 1;
    const payX = bolge ? Math.round(by * 0.3) : 0, payY = bolge ? Math.round(by * 0.06) : 0;
    const x0 = Math.max(0, b.x0 - payX), y0 = Math.max(0, b.y0 - payY);
    const bw = Math.min(w - 1, b.x1 + payX) - x0 + 1, bh = Math.min(h - 1, b.y1 + payY) - y0 + 1;
    // Tek ara tuval yeniden kullanılır (iPhone'da her karede yeni tuval bellek sınırına takılır).
    this.ara ??= document.createElement('canvas');
    const ara = this.ara;
    ara.width = w; ara.height = h;
    ara.getContext('2d').putImageData(new ImageData(veri, w, h), 0, 0);
    const olcek = hedefYukseklik ? hedefYukseklik / bh : 1;
    const tw = Math.round(bw * olcek), th = Math.round(bh * olcek);
    this.tuval.width = tw + 2 * KENAR; this.tuval.height = th + 2 * KENAR;
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, this.tuval.width, this.tuval.height);
    this.ctx.drawImage(ara, x0, y0, bw, bh, KENAR, KENAR, tw, th);
  }

  async #tani(psm) {
    await this.isci.setParameters({ tessedit_pageseg_mode: psm });
    return (await this.isci.recognize(this.tuval)).data.text;
  }

  /**
   * Karakterler leke olarak bulunur; büyük satır ve üstündeki il kodu ayrı ayrı okunur.
   * İkisi de bulunamazsa okuma yapılmaz (tahmin yürütmek yanlış numara kabul ettirebilir).
   */
  async #rakamOku(veri, w, h, cevrildi = false) {
    const s = satirlariBul(veri, w, h);
    if (s?.ters && !cevrildi) return this.#rakamOku(cevir180(veri, w, h), w, h, true);
    if (!s || s.ters || !s.kucuk) return null;
    this.#kenarli(veri, w, h, s.buyuk, SATIR_YUKSEKLIGI);
    const ana = await this.#tani('7');
    this.#kenarli(veri, w, h, s.kucuk, SATIR_YUKSEKLIGI);
    const il = await this.#tani('7');
    this.sonMetin = il + '\n' + ana;
    return ocrMetnindenNumara(this.sonMetin);
  }

  /** Arka kamerayı açar ve okuma döngüsünü başlatır. */
  async baslat() {
    this.akis = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    this.video.srcObject = this.akis;
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    await this.video.play();
    this.iz = this.akis.getVideoTracks()[0];
    try {
      const yet = this.iz.getCapabilities?.() ?? {};
      if (yet.focusMode?.includes('continuous')) await this.iz.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    } catch { /* odak ayarı desteklenmiyor */ }
    await this.hazirla();
    this.calisiyor = true;
    this.onDurum('Küpeyi çerçeveye getirin');
    this.#dongu(++this.nesil);
  }

  durdur() {
    this.calisiyor = false;
    this.nesil++; // eski döngü, bir sonraki turda kendiliğinden çıkar
    this.akis?.getTracks().forEach((t) => t.stop());
    this.akis = null;
  }

  /** Yeni ve canlı bir kare var mı? Donmuş/duraklamış görüntüyü tekrar tekrar okumak yanlış kabule yol açar. */
  #yeniKareVar() {
    const v = this.video;
    if (document.hidden || v.paused || v.readyState < 2 || !v.videoWidth || this.iz?.muted) return false;
    if (v.currentTime === this.sonKareZamani) return false;
    this.sonKareZamani = v.currentTime;
    return true;
  }

  /** Fener (flaş ışığı). Destek yoksa false döner. */
  async fener(acik) {
    try {
      if (!this.iz?.getCapabilities?.().torch) return false;
      await this.iz.applyConstraints({ advanced: [{ torch: acik }] });
      return true;
    } catch { return false; }
  }

  /** Video karesinde ekrandaki çerçeveye karşılık gelen bölge. */
  cerceveBolgesi() {
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    const o = cerceveOranlari(vw, vh);
    return { x: Math.round(o.x * vw), y: Math.round(o.y * vh), w: Math.round(o.w * vw), h: Math.round(o.h * vh) };
  }

  async #dongu(nesil) {
    while (this.calisiyor && nesil === this.nesil) {
      const simdi = performance.now();
      if (this.duraklatildi || simdi < this.bekleBitis || !this.#yeniKareVar()) {
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }
      try {
        const { barkod, rakam } = await this.goruntuOku(this.video, this.cerceveBolgesi());
        if (nesil !== this.nesil) return;
        if (this.sonBarkodMetni && this.sonBarkodMetni !== this.gosterilenBarkod) {
          this.gosterilenBarkod = this.sonBarkodMetni;
          this.onDurum('Barkod içeriği: ' + this.sonBarkodMetni);
        }
        let kabul = null, kaynak = null;
        if (barkod) { kabul = this.oylayici.ekle(barkod, 'barkod'); kaynak = 'barkod'; }
        if (!kabul && rakam) { kabul = this.oylayici.ekle(rakam, 'rakam'); kaynak = barkod ? 'barkod' : 'rakam'; }
        if (!barkod && !rakam) this.oylayici.ekle(null, 'rakam');
        if (kabul) {
          this.bekleBitis = performance.now() + 1500;
          this.onNumara(kabul, kaynak);
        }
      } catch (e) {
        this.onDurum('Okuma hatası: ' + e.message);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
}
