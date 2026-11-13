// Küpe numarası ayıklama ve okuma oylaması. Numaralar her zaman string: "TR00433001".

/**
 * Rakam okuyucu çıktısından küpe numarası. Yanlış numara kabul etmek en kötü sonuç olduğu için katıdır:
 * ya tek satırda tam 8 hane, ya da tam iki satır: üstte 2 hane (veya "TR" rakam sanılmışsa 4 hane, son 2'si
 * alınır), altta büyük satır. Sahadaki küpeler karışık olduğundan büyük satır 6–10 hane olabilir.
 * Başka her şey (fazla satır, barkod gürültüsü, eksik/fazla hane) reddedilir.
 */
export const SIRA_EN_AZ = 6, SIRA_EN_COK = 10;
export function ocrMetnindenNumara(metin) {
  const satirlar = String(metin ?? '').split(/\r?\n/).map((s) => s.replace(/\D/g, '')).filter(Boolean);
  if (satirlar.length === 1) return satirlar[0].length === 8 ? 'TR' + satirlar[0] : null;
  if (satirlar.length !== 2) return null;
  const [ust, alt] = satirlar;
  if (alt.length < SIRA_EN_AZ || alt.length > SIRA_EN_COK || (ust.length !== 2 && ust.length !== 4)) return null;
  return 'TR' + ust.slice(-2) + alt;
}

/** Art arda aynı okumaları sayar; eşiğe ulaşınca numarayı kabul eder. */
export class Oylayici {
  constructor({ rakamEsik = 3, barkodEsik = 2 } = {}) {
    this.esik = { rakam: rakamEsik, barkod: barkodEsik };
    this.sonKabul = null; // kabul edilen numara, görüntüden çıkana dek (3 boş kare) tekrar kabul edilmez
    this.bosKare = 0;
    this.sifirla();
  }

  sifirla() {
    this.son = null;
    this.sayac = { rakam: 0, barkod: 0 };
  }

  ekle(numara, kaynak) {
    if (!numara) {
      this.sifirla();
      if (++this.bosKare >= 3) this.sonKabul = null;
      return null;
    }
    this.bosKare = 0;
    if (numara === this.sonKabul) return null;
    if (numara !== this.son) { this.sifirla(); this.son = numara; }
    this.sayac[kaynak] += 1;
    const { rakam, barkod } = this.sayac;
    const kabul = rakam >= this.esik.rakam || barkod >= this.esik.barkod || (rakam > 0 && barkod > 0);
    if (!kabul) return null;
    this.sifirla();
    this.sonKabul = numara;
    return numara;
  }
}
