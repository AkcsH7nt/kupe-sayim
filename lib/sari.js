// Kamera görüntüsünün içinde sarı küpeyi bulur: küpe nerede görünürse orada okunabilsin
// (kullanıcının küpeyi belirli bir çerçeveye getirmesi gerekmesin).
import { lekeler } from './bolutleme.js';

/** Piksel küpe sarısı mı? Canlı sarı: kırmızı ve yeşil yüksek, mavi düşük. Saman, tüy, duvar değil. */
export function sariMi(r, g, b) {
  const enb = Math.max(r, g), enk = b;
  if (b >= r || b >= g) return false;         // mavi en düşük olmalı
  if (enb < 90) return false;                 // çok karanlık
  if (enb - enk < 0.55 * enb) return false;   // soluk renk (saman, açık tüy, duvar)
  // Renk tonu (derece): 0 kırmızı, 60 sarı, 120 yeşil. Küpe 40–72 arasında.
  const ton = r >= g ? 60 * (g - b) / (r - b) : 60 * (2 - (r - b) / (g - b));
  return ton >= 40 && ton <= 72;
}

/**
 * Küçük bir görüntüde (RGBA) küpe olabilecek sarı bölgeler: {x0,y0,x1,y1,n}, en olası önce.
 * Elenenler: küçük lekeler, ince şeritler, dağınık sarılıklar ve görüntünün kenarında kesilenler
 * (kesik küpenin rakamı eksik okunabilir; tamamı görünene dek beklenir).
 */
export function kupeAdaylari(data, w, h) {
  const maske = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let i = 0; i < w * h; i++) {
    if (sariMi(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) maske[i * 4] = 0;
  }
  const enAzAlan = w * h * 0.012;
  return lekeler(maske, w, h)
    .filter((k) => {
      const gen = k.x1 - k.x0 + 1, yuk = k.y1 - k.y0 + 1;
      if (k.x0 <= 0 || k.y0 <= 0 || k.x1 >= w - 1 || k.y1 >= h - 1) return false;
      if (gen * yuk < enAzAlan) return false;
      if (gen / yuk < 0.5 || gen / yuk > 2.5) return false;
      return k.n / (gen * yuk) >= 0.5; // kutunun en az yarısı sarı (küpe dolu bir levhadır)
    })
    .sort((a, b) => b.n - a.n);
}
