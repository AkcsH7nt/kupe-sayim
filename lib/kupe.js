// Küpe numarası ayıklama ve okuma oylaması. Numaralar her zaman string: "TR00433001".

export const SIRA_EN_AZ = 6, SIRA_EN_COK = 10;

/**
 * Rakam okuyucu çıktısından küpe numarası (bilinen düzen: üstte il kodu, altta büyük rakamlar).
 * Yanlış numara kabul etmek en kötü sonuç olduğu için katıdır: ya tek satırda tam 8 hane, ya da tam iki satır:
 * üstte 2 hane (veya "TR" rakam sanılmışsa 4 hane, son 2'si alınır), altta 6–10 haneli büyük satır.
 * Başka her şey (fazla satır, barkod gürültüsü, eksik/fazla hane) reddedilir.
 */
export function ocrMetnindenNumara(metin) {
  const satirlar = String(metin ?? '').split(/\r?\n/).map((s) => s.replace(/\D/g, '')).filter(Boolean);
  if (satirlar.length === 1) return satirlar[0].length === 8 ? 'TR' + satirlar[0] : null;
  if (satirlar.length !== 2) return null;
  const [ust, alt] = satirlar;
  if (alt.length < SIRA_EN_AZ || alt.length > SIRA_EN_COK || (ust.length !== 2 && ust.length !== 4)) return null;
  return 'TR' + ust.slice(-2) + alt;
}

/** Büyük rakam satırının okunuşu: tek satır, 6–10 rakam (aradaki boşluklar sayılmaz). Değilse null. */
export function siraOku(metin) {
  const satirlar = String(metin ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (satirlar.length !== 1) return null;
  const rakamlar = satirlar[0].replace(/\s+/g, '');
  if (!/^\d+$/.test(rakamlar)) return null;
  return rakamlar.length >= SIRA_EN_AZ && rakamlar.length <= SIRA_EN_COK ? rakamlar : null;
}

/**
 * Küçük yazı satırından il kodu. İl kodu küpeden küpeye farklı yerde olabildiği için satır "TR" ile birlikte
 * okunur ve yalnız kesin desen kabul edilir: "TR" + tam 2 rakam ya da yalın tam 2 rakam. Belirsizse null
 * (yanlış il kodu yazmaktansa "okunamadı" demek iyidir).
 */
export function ilOku(metin) {
  const satirlar = String(metin ?? '').split(/\r?\n/).map((s) => s.replace(/\s+/g, '').toUpperCase()).filter(Boolean);
  if (satirlar.length !== 1) return null;
  const m = /^(?:TR)?(\d{2})$/.exec(satirlar[0]);
  return m ? m[1] : null;
}

/** Art arda aynı okumaları sayar; eşiğe ulaşınca numarayı kabul eder (tek karelik yanlış okuma elenir). */
export class Oylayici {
  constructor({ esik = 2 } = {}) {
    this.esik = esik;
    this.sonKabul = null; // kabul edilen numara, görüntüden çıkana dek (3 boş kare) tekrar kabul edilmez
    this.bosKare = 0;
    this.sifirla();
  }

  sifirla() {
    this.son = null;
    this.sayi = 0;
  }

  /** esik: bu okumanın kabulü için gereken art arda kare sayısı (verilmezse varsayılan). */
  ekle(numara, esik = this.esik) {
    if (!numara) {
      this.sifirla();
      if (++this.bosKare >= 3) this.sonKabul = null;
      return null;
    }
    this.bosKare = 0;
    if (numara === this.sonKabul) return null;
    if (numara !== this.son) { this.sifirla(); this.son = numara; }
    if (++this.sayi < esik) return null;
    this.sifirla();
    this.sonKabul = numara;
    return numara;
  }
}
