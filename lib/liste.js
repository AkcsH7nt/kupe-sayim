// Sayım listesi: okunan küpeler, aşı ve düşen küpe işaretleri, kalıcı depolama, dışa aktarım, kaydedilmiş sayımlar.

const iki = (n) => String(n).padStart(2, '0');
const saat = (ms) => { const d = new Date(ms); return `${iki(d.getHours())}:${iki(d.getMinutes())}`; };

const DEPO_YOK = 'Liste telefona kaydedilemiyor! Sayfa yenilenirse silinir; sık sık kaydedip paylaşın.';

/** Hayvanın küpesi düşmüş (yeni küpe takılmış) olarak işaretli mi? Eski sürümdeki "eski küpe" bağı da sayılır. */
export const dusmusMu = (k) => Boolean(k.dustu ?? k.eskiNo);

const numarayaGore = (kayitlar) => [...kayitlar].sort((a, b) => a.no.localeCompare(b.no));

export function ozet(kayitlar) {
  return { toplam: kayitlar.length, asi: kayitlar.filter((k) => k.asi).length, dusen: kayitlar.filter(dusmusMu).length };
}

/** Excel'in doğrudan açtığı liste (noktalı virgül ayraçlı, numaraya göre sıralı). */
export function csvMetni(kayitlar) {
  const satirlar = ['﻿No;Aşı;Düşen küpe;Eski küpe;Saat'];
  for (const k of numarayaGore(kayitlar)) {
    satirlar.push([k.no, k.asi ? 'Evet' : 'Hayır', dusmusMu(k) ? 'Evet' : 'Hayır', k.eskiNo ?? '', saat(k.zaman)].join(';'));
  }
  return satirlar.join('\r\n');
}

/** WhatsApp vb. için düz metin liste (numaraya göre sıralı). */
export function paylasimMetni(kayitlar, tarih = new Date()) {
  const baslik = `Sayım ${iki(tarih.getDate())}.${iki(tarih.getMonth() + 1)}.${tarih.getFullYear()} – ${kayitlar.length} hayvan`;
  const satirlar = numarayaGore(kayitlar).map((k) => {
    const isaretler = [];
    if (k.asi) isaretler.push('aşı');
    if (dusmusMu(k)) isaretler.push('düşen küpe' + (k.eskiNo ? ` (eski ${k.eskiNo})` : ''));
    return k.no + (isaretler.length ? ' – ' + isaretler.join(', ') : '');
  });
  return [baslik, ...satirlar].join('\n');
}

export class SayimListesi {
  constructor(depo, anahtar = 'kupe-sayim-v1') {
    this.depo = depo;
    this.anahtar = anahtar;
    this.sonHata = null;
    this.durum = { kayitlar: {}, haric: [] };
    this.#yukle();
    if (!depo) this.sonHata = DEPO_YOK;
  }

  #yukle() {
    try {
      const ham = this.depo?.getItem(this.anahtar);
      if (!ham) return;
      const v = JSON.parse(ham);
      if (v && typeof v.kayitlar === 'object' && Array.isArray(v.haric)) this.durum = v;
    } catch (e) {
      this.sonHata = 'Kayıtlı liste okunamadı: ' + e.message;
    }
  }

  #kaydet() {
    if (!this.depo) { this.sonHata = DEPO_YOK; return; }
    try {
      this.depo?.setItem(this.anahtar, JSON.stringify(this.durum));
      this.sonHata = null;
    } catch (e) {
      this.sonHata = 'Liste telefona kaydedilemedi: ' + e.message;
    }
  }

  /** Numara eklenirse ne olur? Listeyi değiştirmez: 'yeni' | 'zaten' | 'haric'. */
  bak(no) {
    if (this.durum.haric.includes(no)) return 'haric';
    return this.durum.kayitlar[no] ? 'zaten' : 'yeni';
  }

  ekle(no, kaynak) {
    if (this.durum.haric.includes(no)) return { durum: 'haric' };
    const var_ = this.durum.kayitlar[no];
    if (var_) return { durum: 'zaten', kayit: var_ };
    const kayit = { no, asi: false, dustu: false, eskiNo: null, zaman: Date.now(), kaynak };
    this.durum.kayitlar[no] = kayit;
    this.#kaydet();
    return { durum: 'eklendi', kayit };
  }

  supheliMi(no) {
    const hepsi = Object.keys(this.durum.kayitlar);
    if (hepsi.length < 3) return false;
    const onek = no.slice(2, 6);
    return !hepsi.some((k) => k.slice(2, 6) === onek);
  }

  kayitVarMi(no) {
    return Boolean(this.durum.kayitlar[no]);
  }

  asiDegistir(no) {
    const k = this.durum.kayitlar[no];
    if (!k) return;
    k.asi = !k.asi;
    this.#kaydet();
  }

  /** "Küpesi düşmüş, yenisi takıldı" işaretini açar/kapatır. Kapatınca eski küpe bağı da kalkar. */
  dustuDegistir(no) {
    const k = this.durum.kayitlar[no];
    if (!k) return;
    k.dustu = !dusmusMu(k);
    if (!k.dustu && k.eskiNo) {
      this.durum.haric = this.durum.haric.filter((h) => h !== k.eskiNo);
      k.eskiNo = null;
    }
    this.#kaydet();
  }

  eskiKupeBagla(yeniNo, eskiNo) {
    const k = this.durum.kayitlar[yeniNo];
    if (!k || !eskiNo || eskiNo === yeniNo) return;
    // Yazım hatası düzeltiliyorsa önceki eski numara artık hariç değildir.
    if (k.eskiNo) this.durum.haric = this.durum.haric.filter((h) => h !== k.eskiNo);
    delete this.durum.kayitlar[eskiNo];
    if (!this.durum.haric.includes(eskiNo)) this.durum.haric.push(eskiNo);
    k.eskiNo = eskiNo;
    k.dustu = true;
    this.#kaydet();
  }

  sil(no) {
    const k = this.durum.kayitlar[no];
    if (!k) return;
    if (k.eskiNo) this.durum.haric = this.durum.haric.filter((h) => h !== k.eskiNo);
    delete this.durum.kayitlar[no];
    this.#kaydet();
  }

  /** Numaraya göre sıralı (paylaşım ve TÜRKVET karşılaştırması için). */
  kayitlar() {
    return numarayaGore(Object.values(this.durum.kayitlar));
  }

  /** Okunma sırasına göre, en son okunan en üstte (ekrandaki liste için). */
  yenidenEskiye() {
    return Object.values(this.durum.kayitlar).reverse().sort((a, b) => b.zaman - a.zaman);
  }

  csv() { return csvMetni(this.kayitlar()); }

  paylasimMetni(tarih = new Date()) { return paylasimMetni(this.kayitlar(), tarih); }

  temizle() {
    this.durum = { kayitlar: {}, haric: [] };
    this.#kaydet();
  }
}

/** Kaydet'e basılınca biten sayımlar burada tarihleriyle saklanır (en yeni en üstte). */
export class SayimArsivi {
  constructor(depo, anahtar = 'kupe-sayim-arsiv-v1') {
    this.depo = depo;
    this.anahtar = anahtar;
    this.sayimlar = [];
    try {
      const v = JSON.parse(depo?.getItem(anahtar) ?? '[]');
      if (Array.isArray(v)) this.sayimlar = v.filter((s) => s && Array.isArray(s.kayitlar));
    } catch { /* bozuk kayıt: boş başla */ }
  }

  #yaz(sayimlar) {
    if (!this.depo) return false;
    try { this.depo.setItem(this.anahtar, JSON.stringify(sayimlar)); } catch { return false; }
    this.sayimlar = sayimlar;
    return true;
  }

  /** Sayımı saklar; telefona yazılamazsa (ya da sayım boşsa) null döner ve hiçbir şey değişmez. */
  ekle(kayitlar, zaman = Date.now()) {
    if (!kayitlar.length) return null;
    let id = String(zaman);
    while (this.sayimlar.some((s) => s.id === id)) id += '+';
    const sayim = { id, zaman, kayitlar: kayitlar.map((k) => ({ ...k })) };
    return this.#yaz([sayim, ...this.sayimlar]) ? sayim : null;
  }

  hepsi() { return this.sayimlar; }

  bul(id) { return this.sayimlar.find((s) => s.id === id) ?? null; }

  sil(id) { return this.#yaz(this.sayimlar.filter((s) => s.id !== id)); }
}
