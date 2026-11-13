// Kamera + rakam okuma (barkod okunmaz; yalnız küpenin üstündeki sayılar). Fotoğraf/kare hiçbir yere
// kaydedilmez; yalnız bellekte işlenir. Gereken: sayfada vendor/tesseract.min.js (global Tesseract).
import { ocrMetnindenNumara, siraOku, ilOku, Oylayici } from './kupe.js';
import { griVeKontrast, cevir180 } from './onisleme.js';
import { satirlariBul } from './bolutleme.js';
import { okumaBolgesi, gorunenBolge, zoomPlani } from './cerceve.js';
import { kupeAdaylari } from './sari.js';

const ARAMA_GENISLIK = 160;       // sarı küpe bu küçük kopyada aranır (hızlı)
const EN_AZ_KUPE_GENISLIGI = 130; // video pikseli; bundan dar görünen küpenin küçük rakamları seçilemez
const YAZI_ARAMA_GENISLIK = 640;  // sarı seçilemezse rakam satırı görüntünün tamamında bu boyda aranır
const RAKAMLAR = '0123456789';
const ILSIZ_ESIK = 4;             // il kodu okunamayan numara daha çok kare bekler (il kodu okunabilsin diye)
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

export class Okuyucu {
  constructor({ video = null, onNumara = () => {}, onDurum = () => {}, onTani = () => {}, onHedef = () => {} } = {}) {
    this.video = video;
    this.onNumara = onNumara;
    this.onDurum = onDurum;
    this.onTani = onTani; // her okuma turunda kameranın ne gördüğünü tek satırda bildirir
    this.onHedef = onHedef; // bulunan küpenin ekrandaki kutusu ({x,y,w,h}) ya da null
    this.uzak = false;
    this.tur = 0;
    this.oylayici = new Oylayici();
    this.calisiyor = false;
    this.duraklatildi = false;
    this.nesil = 0;
    this.sonKareZamani = -1;
    this.bekleBitis = 0;
    this.kat = 1;          // seçili yakınlaştırma (1×, 2×, 3×)
    this.sayisalZoom = 1;  // bunun görüntüyü büyüterek karşılanan kısmı
    this.zoomTaban = null; // kameranın açıldığı andaki kendi yakınlaştırma değeri
    this.tuval = document.createElement('canvas');
    this.ctx = this.tuval.getContext('2d', { willReadFrequently: true });
    this.isci = null;
  }

  /** Rakam okuma motorunu hazırlar (internet gerekmez; dosyalar vendor/ altında). */
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
    this.onDurum('Hazır');
  }

  /**
   * Bir görüntünün (isteğe bağlı kırpılmış) bölgesinden küpe numarasını rakamlardan okur.
   * Döner: { rakam, sira, il } — il kodu okunamadıysa il null olur ve rakam yalnız "TR" + büyük rakamlardır.
   */
  async goruntuOku(kaynak, kirp = null) {
    await this.hazirla();
    const sw = kaynak.videoWidth || kaynak.naturalWidth || kaynak.width;
    const sh = kaynak.videoHeight || kaynak.naturalHeight || kaynak.height;
    const k = kirp ?? { x: 0, y: 0, w: sw, h: sh };

    // Kırpıntı 600 px genişliğe getirilir, siyah-beyaza çevrilir.
    this.sonMetin = null;
    this.sonBolut = null;
    const ham = this.#ciz(kaynak, k, OCR_GENISLIK / k.w);
    const islenmis = griVeKontrast(ham.data, ham.width, ham.height);
    const okuma = await this.#rakamOku(islenmis, ham.width, ham.height);
    if (!okuma) return { rakam: null, sira: null, il: null };
    return { rakam: 'TR' + (okuma.il ?? '') + okuma.sira, sira: okuma.sira, il: okuma.il };
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

  /** Tuvaldeki tek satırı okur; yalnız verilen karakterler tanınır. */
  async #tani(karakterler = RAKAMLAR) {
    await this.isci.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: karakterler });
    return (await this.isci.recognize(this.tuval)).data.text;
  }

  /**
   * Karakterler leke olarak bulunur. Küpenin en büyük yazısı olan büyük rakam satırı her düzende okunur
   * (6–10 hane); okunamazsa sonuç yoktur. İl kodu küpeden küpeye farklı yerde olabildiği için ayrıca aranır:
   * önce bilinen yerinde (üstte sağda iki rakam), sonra diğer küçük yazı satırlarında "TR" ile birlikte.
   * Bulunamazsa il kodu boş döner; uydurulmaz. Döner: { sira, il } ya da null.
   */
  async #rakamOku(veri, w, h) {
    let s = satirlariBul(veri, w, h);
    if (s?.ters) {
      // Küçük yazı büyük rakamların altında: küpe baş aşağı olabilir. Çevrilmiş halinde bilinen düzen
      // çıkıyorsa baş aşağıdır; çıkmıyorsa küpe düzdür ve küçük yazısı alttadır.
      const cevrik = cevir180(veri, w, h);
      const s2 = satirlariBul(cevrik, w, h);
      if (s2 && !s2.ters && s2.kucuk) { veri = cevrik; s = s2; }
    }
    if (!s) { this.sonBolut = 'yok'; return null; }
    // Bölge küpeyi kesiyorsa okunmaz: eksik rakamlı ama geçerli görünen bir numara çıkabilir.
    if (s.kesik) { this.sonBolut = 'kenarda kesik'; return null; }
    this.#kenarli(veri, w, h, s.buyuk, SATIR_YUKSEKLIGI);
    const ana = await this.#tani();
    const sira = siraOku(ana);
    let il = null, ilMetni = '';
    if (sira && s.kucuk) {
      this.#kenarli(veri, w, h, s.kucuk, SATIR_YUKSEKLIGI);
      ilMetni = await this.#tani();
      il = ocrMetnindenNumara(ilMetni + '\n' + ana)?.slice(2, 4) ?? null;
    }
    for (const aday of sira && !il ? s.kucukAdaylar : []) {
      this.#kenarli(veri, w, h, aday, SATIR_YUKSEKLIGI);
      const metin = await this.#tani(RAKAMLAR + 'TR');
      ilMetni ||= metin;
      il = ilOku(metin);
      if (il) { ilMetni = metin; break; }
    }
    this.sonMetin = (ilMetni.trim() || '?') + '\n' + ana;
    this.sonBolut = !sira ? 'rakam okunamadı' : il ? 'tamam' : 'il kodu yok';
    return sira ? { sira, il } : null;
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
    this.zoomTaban = null;
    if (this.kat !== 1) await this.yakinlastir(this.kat); // kamera yeniden açıldıysa seçim korunur
    await this.hazirla();
    this.calisiyor = true;
    this.uzak = false;
    this.onDurum('Küpeyi kameraya gösterin');
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

  /**
   * Yakınlaştırma (1×, 2×, 3×). Telefonun kamerası destekliyorsa kameranın kendi yakınlaştırması kullanılır
   * (net); desteklemiyorsa ya da yetmiyorsa görüntü ortadan büyütülür (daha bulanık).
   * Döner: { kat, kamerayla } — kamerayla: en az bir kısmı kameranın kendi yakınlaştırmasıyla mı yapıldı.
   */
  async yakinlastir(kat) {
    let donanimKat = 1;
    try {
      const yet = this.iz?.getCapabilities?.().zoom;
      if (yet) {
        this.zoomTaban ??= this.iz.getSettings?.().zoom || yet.min;
        const plan = zoomPlani(kat, { min: yet.min, max: yet.max, taban: this.zoomTaban });
        if (plan.donanim != null) {
          await this.iz.applyConstraints({ advanced: [{ zoom: plan.donanim }] });
          donanimKat = (this.iz.getSettings?.().zoom ?? plan.donanim) / this.zoomTaban;
        }
      }
    } catch { donanimKat = 1; /* kamera yakınlaştıramadı: tamamı görüntü büyütmeyle */ }
    if (!(donanimKat > 0)) donanimKat = 1;
    this.kat = kat;
    this.sayisalZoom = Math.max(1, kat / donanimKat);
    if (this.video) this.video.style.transform = this.sayisalZoom > 1.001 ? 'scale(' + this.sayisalZoom + ')' : '';
    this.zoomKamerayla = donanimKat > 1.001;
    this.oylayici.sifirla(); // görüntü değişti; yarım kalan oylar geçersiz
    return { kat, kamerayla: donanimKat > 1.001 };
  }

  /** Video karesinde ekrandaki çerçeveye karşılık gelen bölge. */
  cerceveBolgesi() {
    const v = this.video;
    return okumaBolgesi(v.videoWidth, v.videoHeight, v.clientWidth || v.videoWidth, v.clientHeight || v.videoHeight, this.sayisalZoom);
  }

  /**
   * Tanı satırı: görüntü boyutu · yakınlaştırma (kamera mı, büyütme mi) · okunan bölge · tur · süre ·
   * rakam satırları bulundu mu · ham okunan metin. Sahadan ekran görüntüsüyle sorun bulmak için.
   */
  #taniMetni(denemeler, metin, ms) {
    const v = this.video;
    let zoom = '1×';
    if (this.kat !== 1) {
      const nasil = !this.zoomKamerayla ? 'büyütme' : this.sayisalZoom > 1.001 ? 'kamera+büyütme' : 'kamera';
      zoom = `${this.kat}× ${nasil}`;
    }
    let kameraZoom = 'yok';
    try {
      const yet = this.iz?.getCapabilities?.().zoom;
      if (yet) kameraZoom = `${this.iz.getSettings?.().zoom ?? '?'} (${yet.min}–${yet.max})`;
    } catch { /* bilgi alınamadı */ }
    const okunan = (metin ?? '').trim().split(/\s+/).filter(Boolean).join('/') || '—';
    return [
      `${v.videoWidth}×${v.videoHeight}`, zoom, `hedef: ${denemeler.join(' | ')}`, `tur ${this.tur}`, `${Math.round(ms)} ms`,
      `okunan: ${okunan}`, `kamera zoom: ${kameraZoom}`,
    ].join(' · ');
  }

  /** Bulunan kutunun çevresiyle birlikte geniş hali: yanlara biraz, yukarı ve aşağı kutu boyu kadar (görünen alanla sınırlı). */
  #genislet(b, g) {
    const x0 = Math.max(g.x, b.x - 0.25 * b.w), x1 = Math.min(g.x + g.w, b.x + 1.25 * b.w);
    const y0 = Math.max(g.y, b.y - 1.2 * b.h), y1 = Math.min(g.y + g.h, b.y + 2.2 * b.h);
    return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
  }

  /**
   * Sarıya bakmadan rakam arar: görünen görüntünün tamamında büyük rakam satırı bulunursa, çevresini
   * (üstündeki ve altındaki küçük yazılarla birlikte) okunacak bölge olarak verir. Bulunamazsa null.
   */
  #yaziAra(g) {
    const ham = this.#ciz(this.video, g, YAZI_ARAMA_GENISLIK / g.w);
    const s = satirlariBul(griVeKontrast(ham.data, ham.width, ham.height), ham.width, ham.height, 0.02);
    if (!s) return null;
    const k = g.w / ham.width, H = s.H; // arama pikseli → video pikseli; H: büyük rakam boyu
    const x0 = Math.max(0, s.buyuk.x0 - 1.2 * H), x1 = Math.min(ham.width, s.buyuk.x1 + 1.2 * H);
    const y0 = Math.max(0, s.buyuk.y0 - 4 * H), y1 = Math.min(ham.height, s.buyuk.y1 + 3 * H);
    return { x: Math.round(g.x + x0 * k), y: Math.round(g.y + y0 * k), w: Math.round((x1 - x0) * k), h: Math.round((y1 - y0) * k) };
  }

  /**
   * Ekranda görünen görüntünün içinde sarı küpeleri arar (küpeyi belirli bir yere getirmek gerekmez).
   * Döner: en olası en çok iki küpenin video pikseli kutusu ve görünen bölge.
   */
  #kupeAra() {
    const v = this.video;
    const g = gorunenBolge(v.videoWidth, v.videoHeight, v.clientWidth || v.videoWidth, v.clientHeight || v.videoHeight, this.sayisalZoom);
    const w = ARAMA_GENISLIK, h = Math.max(1, Math.round(w * g.h / g.w));
    if (!this.aramaCtx) {
      this.aramaTuvali = document.createElement('canvas');
      this.aramaCtx = this.aramaTuvali.getContext('2d', { willReadFrequently: true });
    }
    if (this.aramaTuvali.width !== w || this.aramaTuvali.height !== h) { this.aramaTuvali.width = w; this.aramaTuvali.height = h; }
    this.aramaCtx.drawImage(v, g.x, g.y, g.w, g.h, 0, 0, w, h);
    const k = g.w / w; // arama pikseli → video pikseli
    const kutular = kupeAdaylari(this.aramaCtx.getImageData(0, 0, w, h).data, w, h).slice(0, 2).map((a) => {
      const pay = 0.1 * Math.max(a.x1 - a.x0 + 1, a.y1 - a.y0 + 1) * k; // kenardaki rakam kesilmesin
      const x0 = Math.max(0, g.x + a.x0 * k - pay), y0 = Math.max(0, g.y + a.y0 * k - pay);
      const x1 = Math.min(v.videoWidth, g.x + (a.x1 + 1) * k + pay), y1 = Math.min(v.videoHeight, g.y + (a.y1 + 1) * k + pay);
      return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
    });
    return { kutular, gorunen: g };
  }

  async #dongu(nesil) {
    while (this.calisiyor && nesil === this.nesil) {
      const simdi = performance.now();
      if (this.duraklatildi || simdi < this.bekleBitis || !this.#yeniKareVar()) {
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }
      try {
        const t0 = performance.now();
        // Önce görüntünün neresinde olursa olsun sarı küpe aranır; bulunamazsa (ya da okunamazsa)
        // ekranın ortasındaki kılavuz çerçevenin içi denenir.
        const { kutular, gorunen } = this.#kupeAra();
        const ilk = kutular[0];
        this.onHedef(ilk ? {
          x: (ilk.x - gorunen.x) * gorunen.olcek, y: (ilk.y - gorunen.y) * gorunen.olcek,
          w: ilk.w * gorunen.olcek, h: ilk.h * gorunen.olcek,
        } : null);
        // Deneme sırası: bulunan küpe → aynı yerin çevresiyle birlikte geniş hali (kutu küpenin yalnız bir
        // parçasını, örneğin barkodlu kısmını aldıysa rakamlar da girsin) → varsa ikinci küpe → ortadaki kılavuz.
        const hedefler = [];
        if (ilk) hedefler.push(['küpe', ilk], ['geniş', this.#genislet(ilk, gorunen)]);
        if (kutular[1]) hedefler.push(['küpe2', kutular[1]]);
        hedefler.push(['orta', this.cerceveBolgesi()]);
        // Son çare: sarı kutu çıksa da çıkmasa da, görüntüde büyük rakam satırı görülüyorsa çevresi okunur.
        hedefler.push(['yazı', () => this.#yaziAra(gorunen)]);
        let okuma = { rakam: null }, metin = null;
        const denemeler = [];
        for (const [ad, hedef] of hedefler) {
          const bolge = typeof hedef === 'function' ? hedef() : hedef;
          if (!bolge) { denemeler.push(`${ad} yok`); continue; }
          okuma = await this.goruntuOku(this.video, bolge);
          if (nesil !== this.nesil) return;
          denemeler.push(`${ad} ${bolge.w}×${bolge.h} ${this.sonBolut ?? '—'}`);
          metin = this.sonMetin ?? metin;
          if (okuma.rakam) break;
        }
        this.tur++;
        this.onTani(this.#taniMetni(denemeler, metin, performance.now() - t0));
        const uzak = Boolean(ilk) && ilk.w < EN_AZ_KUPE_GENISLIGI && !okuma.rakam;
        if (uzak !== this.uzak) {
          this.uzak = uzak;
          this.onDurum(uzak ? 'Küpe uzak – yaklaşın ya da yakınlaştırın' : 'Küpeyi kameraya gösterin');
        }
        // İl kodu her karede okunmayabilir: aynı küpede (aynı büyük rakamlar) az önce okunan il kodu kullanılır.
        let { sira, il } = okuma;
        const simdi2 = performance.now();
        if (sira && this.sonIl && this.sonIl.sira === sira && simdi2 - this.sonIl.an < 5000) {
          il ??= this.sonIl.il;
          this.sonIl.an = simdi2;
        }
        if (sira && il) this.sonIl = { sira, il, an: simdi2 };
        // Aynı numara art arda karelerde okununca kabul edilir (tek karelik yanlış okuma elenir).
        const numara = sira ? 'TR' + (il ?? '') + sira : null;
        const kabul = this.oylayici.ekle(numara, il ? undefined : ILSIZ_ESIK);
        if (kabul) {
          this.bekleBitis = performance.now() + 1500;
          this.onNumara(kabul, 'rakam', { ilYok: !il });
        }
      } catch (e) {
        this.onDurum('Okuma hatası: ' + e.message);
        await new Promise((r) => setTimeout(r, 500));
      }
      // Her turdan sonra tarayıcıya sıra ver: çerçevede küpe yokken okuma hiç beklemeden döner ve
      // dokunuşlar, ekran çizimi, çevrimdışı hazırlığı işlenemez (sayfa donar).
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}
