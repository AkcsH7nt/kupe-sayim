// Siyah-beyaz küpe görüntüsünde karakterleri leke (bağlı bileşen) olarak bulur ve
// büyük 6 haneli satır ile üstündeki küçük 2 haneyi (il kodu) konumlarından ayırır.

/** Siyah piksellerden oluşan bağlı bölgelerin kutuları {x0,y0,x1,y1,n} (x1,y1 dahil). */
export function lekeler(data, w, h) {
  const etiket = new Int32Array(w * h);
  const yigin = new Int32Array(w * h);
  const sonuc = [];
  for (let bas = 0; bas < w * h; bas++) {
    if (etiket[bas] || data[bas * 4] !== 0) continue;
    const no = sonuc.length + 1;
    let ust = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    yigin[ust++] = bas; etiket[bas] = no;
    while (ust) {
      const p = yigin[--ust];
      const x = p % w, y = (p - x) / w;
      n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const komsu = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of komsu) {
        if (q >= 0 && !etiket[q] && data[q * 4] === 0) { etiket[q] = no; yigin[ust++] = q; }
      }
    }
    sonuc.push({ x0, y0, x1, y1, n });
  }
  return sonuc;
}

const yuk = (k) => k.y1 - k.y0 + 1;
const gen = (k) => k.x1 - k.x0 + 1;
const ortaY = (k) => (k.y0 + k.y1) / 2;
const birlesim = (ks) => ({
  x0: Math.min(...ks.map((k) => k.x0)), y0: Math.min(...ks.map((k) => k.y0)),
  x1: Math.max(...ks.map((k) => k.x1)), y1: Math.max(...ks.map((k) => k.y1)),
});
const ortanca = (dizi) => { const s = [...dizi].sort((a, b) => a - b); return s[s.length >> 1]; };

/**
 * Büyük rakam satırı ve küçük il kodu kutusu. Küçük satır büyük satırın altındaysa küpe terstir
 * ({ters:true}); çağıran görüntüyü 180° çevirip tekrar dener. Bulunamazsa null.
 */
export function satirlariBul(data, w, h) {
  const enKucuk = Math.max(6, h * 0.04);
  // Karakter: yeterince uzun, en/boy oranı rakam gibi (ince "1" dahil) ve içi boşluklu.
  // Barkod çubukları ya çok ince ya da (kaynamış bloklar) içi dolu olduğu için elenir.
  const karakterler = lekeler(data, w, h).filter((k) => {
    const oran = gen(k) / yuk(k);
    const doluluk = k.n / (gen(k) * yuk(k));
    return yuk(k) >= enKucuk && oran >= 0.12 && oran <= 1.2 && doluluk <= 0.8;
  });

  // Büyük satır: aynı hizada, benzer boyda en az 4 karakter; en büyük boylu küme.
  let enIyi = null;
  for (const c of karakterler) {
    const uyeler = karakterler.filter((k) =>
      Math.abs(ortaY(k) - ortaY(c)) < 0.5 * yuk(c) && yuk(k) >= 0.75 * yuk(c) && yuk(k) <= 1.33 * yuk(c));
    if (uyeler.length < 4) continue;
    const boy = ortanca(uyeler.map(yuk));
    if (!enIyi || boy > enIyi.boy || (boy === enIyi.boy && uyeler.length > enIyi.uyeler.length)) enIyi = { boy, uyeler };
  }
  if (!enIyi) return null;
  const H = enIyi.boy;
  const buyuk = birlesim(enIyi.uyeler);

  const kucukler = karakterler.filter((k) => !enIyi.uyeler.includes(k) && yuk(k) >= 0.2 * H && yuk(k) <= 0.75 * H);
  const ustte = kucukler.filter((k) => ortaY(k) < buyuk.y0 && ortaY(k) > buyuk.y0 - 3 * H);
  const altta = kucukler.filter((k) => ortaY(k) > buyuk.y1 && ortaY(k) < buyuk.y1 + 3 * H);
  if (altta.length > ustte.length) return { ters: true, buyuk, kucuk: null };

  // İl kodu: üst satırın en sağdaki iki karakteri (soldakiler "TR").
  let kucuk = null;
  if (ustte.length) {
    const sagdan = [...ustte].sort((a, b) => b.x1 - a.x1);
    const ilk = sagdan[0];
    const ayniSatir = sagdan.filter((k) => Math.abs(ortaY(k) - ortaY(ilk)) < 0.5 * yuk(ilk));
    kucuk = birlesim(ayniSatir.slice(0, 2));
  }
  return { ters: false, buyuk, kucuk };
}
