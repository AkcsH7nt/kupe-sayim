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

const gen = (k) => k.x1 - k.x0 + 1;
const yuk = (k) => k.y1 - k.y0 + 1;

/** İki sarı parça aynı küpenin parçaları mı? Alt alta ya da yan yana, aralarında dar bir boşlukla dururlar. */
function ayniKupe(a, b) {
  const dx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1) - 1); // yatay boşluk
  const dy = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1) - 1); // dikey boşluk
  if (dx > 0 && dy > 0) return false; // çapraz duruyorlar
  const ortakX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;
  const ortakY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1;
  const buyuk = a.n >= b.n ? a : b;
  const pay = 0.35 * Math.min(gen(buyuk), yuk(buyuk)); // barkod şeridi, gölge, kir kadar boşluk
  if (dy > 0) return dy <= pay && ortakX >= 0.5 * Math.min(gen(a), gen(b));
  if (dx > 0) return dx <= pay && ortakY >= 0.5 * Math.min(yuk(a), yuk(b));
  return true; // kutular zaten iç içe ya da değiyor
}

/** Aynı küpeye ait sarı parçaları tek kutuda toplar (barkod ya da gölge küpeyi bölmüş olabilir). */
function birlestir(kutular) {
  const sonuc = kutular.map((k) => ({ ...k }));
  for (let degisti = true; degisti;) {
    degisti = false;
    for (let i = 0; i < sonuc.length && !degisti; i++) {
      for (let j = i + 1; j < sonuc.length; j++) {
        const a = sonuc[i], b = sonuc[j];
        if (!ayniKupe(a, b)) continue;
        sonuc[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), n: a.n + b.n };
        sonuc.splice(j, 1);
        degisti = true;
        break;
      }
    }
  }
  return sonuc;
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
  const enAzParca = Math.max(4, w * h * 0.0015), enAzAlan = w * h * 0.012;
  return birlestir(lekeler(maske, w, h).filter((k) => k.n >= enAzParca))
    .filter((k) => {
      if (k.x0 <= 0 || k.y0 <= 0 || k.x1 >= w - 1 || k.y1 >= h - 1) return false;
      if (gen(k) * yuk(k) < enAzAlan) return false;
      if (gen(k) / yuk(k) < 0.3 || gen(k) / yuk(k) > 3.5) return false; // küpenin yalnız bir parçası da olabilir
      return k.n / (gen(k) * yuk(k)) >= 0.4; // kutunun önemli kısmı sarı (küpe dolu bir levhadır)
    })
    .sort((a, b) => b.n - a.n);
}

/**
 * Okumadan önce küpenin dışını beyaza çevirir (siyahBeyaz yerinde değişir). Küpenin arkasındaki koyu zemin
 * (tüy, gölge) siyah-beyazda küpe kenarında ince şeritler bırakır ve okuyucu bunları "1" sanabilir.
 * Yöntem: sarı maske birkaç piksel genişletilir (küpe kenarındaki çentikler kapanır), kırpıntı kenarından
 * başlayan sarı olmayan bölgeler bulunur; içlerindeki büyük koyu lekeler (zemin) beyazlanır. Küçükler, örneğin
 * kırpıntının kestiği yarım rakam, kalır: onları okuyucu "kenarda kesik" sayıp okumaz.
 * Sarı azsa (renksiz/karanlık fotoğraf) hiçbir şey yapmaz ve false döner.
 */
export function kupeDisiniBeyazla(renkli, siyahBeyaz, w, h, { r = 2, enAzSari = 0.12, enAzZemin = 0.03 } = {}) {
  const n = w * h, sari = new Uint8Array(n);
  let sayi = 0;
  for (let i = 0; i < n; i++) if (sariMi(renkli[i * 4], renkli[i * 4 + 1], renkli[i * 4 + 2])) { sari[i] = 1; sayi++; }
  if (sayi < enAzSari * n) return false;
  const genis = genislet(sari, w, h, r);
  // 1) Dış bölge: kırpıntı kenarından, sarı olmayan piksellerden geçilerek ulaşılan her yer.
  const dis = new Uint8Array(n), yigin = new Int32Array(n);
  let ust = 0;
  for (let i = 0; i < n; i++) {
    const x = i % w, y = (i - x) / w;
    if (!genis[i] && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) { dis[i] = 1; yigin[ust++] = i; }
  }
  while (ust) {
    const p = yigin[--ust], px = p % w, py = (p - px) / w;
    for (const q of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]) {
      if (q >= 0 && !genis[q] && !dis[q]) { dis[q] = 1; yigin[ust++] = q; }
    }
  }
  // 2) Dış bölgedeki koyu lekelerden yalnız büyükler zemindir (tüy, toprak). Küçük koyu lekeler kalır:
  //    gölgede kalıp sarı görünmeyen küpe parçasındaki rakamlar ya da kırpıntının kestiği yarım rakam.
  const koyu = (p) => siyahBeyaz[p * 4] === 0;
  const etiket = new Uint8Array(n), zemin = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!dis[i] || etiket[i] || !koyu(i)) continue;
    const uyeler = [i];
    etiket[i] = 1;
    for (let k = 0; k < uyeler.length; k++) {
      const p = uyeler[k], px = p % w, py = (p - px) / w;
      for (const q of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]) {
        if (q >= 0 && dis[q] && !etiket[q] && koyu(q)) { etiket[q] = 1; uyeler.push(q); }
      }
    }
    if (uyeler.length >= enAzZemin * n) for (const p of uyeler) zemin[p] = 1;
  }
  // Zeminin küpe kenarına kadar uzanan ince şeridi (genişletmenin kapattığı r piksel) de zemindir.
  const zeminYakin = genislet(zemin, w, h, r);
  for (let i = 0; i < n; i++) {
    if (zeminYakin[i] && !sari[i]) siyahBeyaz[i * 4] = siyahBeyaz[i * 4 + 1] = siyahBeyaz[i * 4 + 2] = 255;
  }
  return true;
}

/** İkili maskeyi r piksel genişletir (önce yatay, sonra dikey). */
function genislet(maske, w, h, r) {
  const yatay = new Uint8Array(w * h), sonuc = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w && maske[y * w + xx]) { yatay[y * w + x] = 1; break; } }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h && yatay[yy * w + x]) { sonuc[y * w + x] = 1; break; } }
  }
  return sonuc;
}
