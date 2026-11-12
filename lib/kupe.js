// Küpe numarası ayıklama ve okuma oylaması. Numaralar her zaman string: "TR00433001".

const rakamGruplari = (metin) => (String(metin ?? '').match(/\d+/g) ?? []);

/**
 * Tesseract çıktısından küpe numarası. Küpe düz yüzü: üstte küçük 2 hane, altta büyük 6 hane.
 * Rakam okuyucu "TR" harflerini rakam sanabilir ("7800"), barkod şeridi gürültü üretebilir.
 */
export function ocrMetnindenNumara(metin) {
  const gruplar = rakamGruplari(metin);
  const sekiz = gruplar.find((g) => g.length === 8);
  if (sekiz) return 'TR' + sekiz;

  let anaIdx = -1;
  for (let i = gruplar.length - 1; i >= 0; i--) {
    if (gruplar[i].length === 6) { anaIdx = i; break; }
  }
  if (anaIdx < 1) return null;

  const onceki = gruplar.slice(0, anaIdx);
  const il = onceki.find((g) => g.length === 2) ?? onceki.find((g) => g.length > 2);
  if (!il) return null;
  return 'TR' + il.slice(-2) + gruplar[anaIdx];
}

/** Barkod içeriğindeki rakamların son 8 hanesi. */
export function barkoddanNumara(icerik) {
  const rakamlar = rakamGruplari(icerik).join('');
  return rakamlar.length >= 8 ? 'TR' + rakamlar.slice(-8) : null;
}

/** Art arda aynı okumaları sayar; eşiğe ulaşınca numarayı kabul eder. */
export class Oylayici {
  constructor({ rakamEsik = 3, barkodEsik = 2 } = {}) {
    this.esik = { rakam: rakamEsik, barkod: barkodEsik };
    this.sifirla();
  }

  sifirla() {
    this.son = null;
    this.sayac = { rakam: 0, barkod: 0 };
  }

  ekle(numara, kaynak) {
    if (!numara) { this.sifirla(); return null; }
    if (numara !== this.son) { this.sifirla(); this.son = numara; }
    this.sayac[kaynak] += 1;
    const { rakam, barkod } = this.sayac;
    const kabul = rakam >= this.esik.rakam || barkod >= this.esik.barkod || (rakam > 0 && barkod > 0);
    if (!kabul) return null;
    this.sifirla();
    return numara;
  }
}
