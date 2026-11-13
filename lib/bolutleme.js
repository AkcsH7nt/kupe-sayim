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

/** Aynı hizadaki karakterleri satır kutularında toplar (en az 2 karakterli satırlar), yukarıdan aşağı. */
function satirKutulari(karakterler) {
  const satirlar = [];
  for (const k of [...karakterler].sort((a, b) => ortaY(a) - ortaY(b))) {
    const s = satirlar.at(-1);
    if (s && Math.abs(ortaY(k) - ortaY(s[0])) < 0.5 * yuk(s[0])) s.push(k); else satirlar.push([k]);
  }
  return satirlar.filter((s) => s.length >= 2).map(birlesim);
}

/**
 * Büyük rakam satırı (buyuk), karakter boyu (H) ve küçük yazılar:
 *  - kucuk: bilinen düzendeki il kodu kutusu (büyük satırın üstünde, sağ yarıda tam iki karakter) ya da null;
 *  - kucukAdaylar: büyük satırın üstündeki ve altındaki küçük yazı satırları (il kodu başka yerdeyse orada aranır).
 * Küçük yazı büyük satırın altında ağırlıktaysa ters:true döner (küpe baş aşağı olabilir).
 * kesik: büyük satır bölgenin kenarına yapışık (bölge küpeyi kesmiş olabilir).
 * enKucukOran: bir karakterin görüntü yüksekliğine göre en küçük boyu. Büyük satır bulunamazsa null.
 */
export function satirlariBul(data, w, h, enKucukOran = 0.04) {
  const enKucuk = Math.max(6, h * enKucukOran);
  // Karakter: yeterince uzun, en/boy oranı rakam gibi (ince "1" dahil) ve içi boşluklu.
  // Barkod çubukları ya çok ince ya da (kaynamış bloklar) içi dolu olduğu için elenir.
  const hepsi = lekeler(data, w, h);
  const karakterler = hepsi.filter((k) => {
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
  // Bölge küpeyi kesmiş mi? Baştaki ya da sondaki rakam eksik kalırsa kısa ama geçerli görünen bir numara çıkar.
  // İki işaret: satır bölgenin kenarına yapışık; ya da kenarda, satır hizasında, rakam boyunda yarım bir parça var
  // (kenara değen koyu zemin/tüy rakamdan çok uzun olduğu için parça sayılmaz).
  const parca = (k) => yuk(k) >= 0.4 * H && k.y0 >= buyuk.y0 - 0.2 * H && k.y1 <= buyuk.y1 + 0.2 * H;
  const kesik = buyuk.x0 < 0.15 * H || buyuk.x1 > w - 1 - 0.15 * H
    || hepsi.some((k) => parca(k) && ((k.x0 === 0 && buyuk.x0 - k.x1 <= H) || (k.x1 === w - 1 && k.x0 - buyuk.x1 <= H)));

  // Küçük karakterler büyük satırın yatay hizasında olmalı (çerçeve kenarındaki komşu küpe parçaları elenir).
  const kucukler = karakterler.filter((k) => !enIyi.uyeler.includes(k) && yuk(k) >= 0.2 * H && yuk(k) <= 0.75 * H
    && k.x0 >= buyuk.x0 - 0.5 * H && k.x1 <= buyuk.x1 + 0.5 * H);
  const ustte = kucukler.filter((k) => ortaY(k) < buyuk.y0 && ortaY(k) > buyuk.y0 - 3 * H);
  const altta = kucukler.filter((k) => ortaY(k) > buyuk.y1 && ortaY(k) < buyuk.y1 + 3 * H);
  // Adaylar: önce üstteki satırlar (büyük satıra yakın olan önce), sonra alttakiler.
  const kucukAdaylar = [...satirKutulari(ustte).reverse(), ...satirKutulari(altta)];
  if (altta.length > ustte.length) return { ters: true, buyuk, kucuk: null, kucukAdaylar, H, kesik };

  // İl kodu: üst satırda, büyük satırın sağ yarısında tam iki karakter ("TR" sol yarıda kalır).
  // Tam iki karakter yoksa il kodu okunmaz (TR'yi il kodu sanmaktansa okumamak iyidir).
  let kucuk = null;
  const orta = (buyuk.x0 + buyuk.x1) / 2;
  const sagda = ustte.filter((k) => k.x0 >= orta).sort((a, b) => b.x1 - a.x1);
  if (sagda.length) {
    const ilk = sagda[0];
    const ayniSatir = sagda.filter((k) => Math.abs(ortaY(k) - ortaY(ilk)) < 0.5 * yuk(ilk));
    if (ayniSatir.length === 2) kucuk = birlesim(ayniSatir);
  }
  return { ters: false, buyuk, kucuk, kucukAdaylar, H, kesik };
}
