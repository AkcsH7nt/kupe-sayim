// Sayım listesi: okunan küpeler, aşı işareti, düşen küpe bağlantısı, kalıcı depolama, dışa aktarım.

const iki = (n) => String(n).padStart(2, '0');
const saat = (ms) => { const d = new Date(ms); return `${iki(d.getHours())}:${iki(d.getMinutes())}`; };

export class SayimListesi {
  constructor(depo, anahtar = 'kupe-sayim-v1') {
    this.depo = depo;
    this.anahtar = anahtar;
    this.sonHata = null;
    this.durum = { kayitlar: {}, haric: [] };
    this.#yukle();
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
    try {
      this.depo?.setItem(this.anahtar, JSON.stringify(this.durum));
      this.sonHata = null;
    } catch (e) {
      this.sonHata = 'Liste telefona kaydedilemedi: ' + e.message;
    }
  }

  ekle(no, kaynak) {
    if (this.durum.haric.includes(no)) return { durum: 'haric' };
    const var_ = this.durum.kayitlar[no];
    if (var_) return { durum: 'zaten', kayit: var_ };
    const kayit = { no, asi: false, eskiNo: null, zaman: Date.now(), kaynak };
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

  asiDegistir(no) {
    const k = this.durum.kayitlar[no];
    if (!k) return;
    k.asi = !k.asi;
    this.#kaydet();
  }

  eskiKupeBagla(yeniNo, eskiNo) {
    const k = this.durum.kayitlar[yeniNo];
    if (!k || !eskiNo || eskiNo === yeniNo) return;
    delete this.durum.kayitlar[eskiNo];
    if (!this.durum.haric.includes(eskiNo)) this.durum.haric.push(eskiNo);
    k.eskiNo = eskiNo;
    this.#kaydet();
  }

  sil(no) {
    const k = this.durum.kayitlar[no];
    if (!k) return;
    if (k.eskiNo) this.durum.haric = this.durum.haric.filter((h) => h !== k.eskiNo);
    delete this.durum.kayitlar[no];
    this.#kaydet();
  }

  kayitlar() {
    return Object.values(this.durum.kayitlar).sort((a, b) => a.no.localeCompare(b.no));
  }

  csv() {
    const satirlar = ['﻿No;Aşı;Eski küpe;Saat'];
    for (const k of this.kayitlar()) {
      satirlar.push([k.no, k.asi ? 'Evet' : 'Hayır', k.eskiNo ?? '', saat(k.zaman)].join(';'));
    }
    return satirlar.join('\r\n');
  }

  paylasimMetni(tarih = new Date()) {
    const liste = this.kayitlar();
    const baslik = `Sayım ${iki(tarih.getDate())}.${iki(tarih.getMonth() + 1)}.${tarih.getFullYear()} – ${liste.length} hayvan`;
    const satirlar = liste.map((k) => {
      let s = k.no + (k.asi ? ' ✓' : '');
      if (k.eskiNo) s += ` – (eski ${k.eskiNo} düştü)`;
      return s;
    });
    return [baslik, ...satirlar].join('\n');
  }

  temizle() {
    this.durum = { kayitlar: {}, haric: [] };
    this.#kaydet();
  }
}
