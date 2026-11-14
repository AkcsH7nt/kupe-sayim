// Eğik duran küpe: rakam satırının eğimi ölçülür, görüntü döndürülüp düzeltilir, sonra okunur.
// Eğik satırı düzeltmeden okumak rakamları karıştırır (10–15° eğikte yanlış numara okunuyordu).
import { lekeler, satirlariBul } from './bolutleme.js';
import { SIRA_EN_AZ } from './kupe.js';

/** Döndürülen görüntüde, asıl görüntünün dışına düşen pikseller bu değerle dolar (ne siyah ne beyaz). */
export const DOLGU = 128;

/**
 * Siyah-beyaz görüntüyü merkezi etrafında `derece` kadar döndürür (köşeler kesilmesin diye tuval büyür).
 * Döner: { data, w, h, geri(x, y) → [kaynakX, kaynakY] }.
 */
export function dondur(data, w, h, derece) {
  const r = (derece * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const W = Math.round(Math.abs(w * c) + Math.abs(h * s)), H = Math.round(Math.abs(w * s) + Math.abs(h * c));
  const cikti = new Uint8ClampedArray(W * H * 4);
  const geri = (x, y) => {
    const dx = x - W / 2, dy = y - H / 2;
    return [c * dx + s * dy + w / 2, -s * dx + c * dy + h / 2];
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [fx, fy] = geri(x + 0.5, y + 0.5);
      const sx = Math.floor(fx), sy = Math.floor(fy), o = (y * W + x) * 4;
      const v = sx >= 0 && sy >= 0 && sx < w && sy < h ? data[(sy * w + sx) * 4] : DOLGU;
      cikti[o] = cikti[o + 1] = cikti[o + 2] = v;
      cikti[o + 3] = 255;
    }
  }
  return { data: cikti, w: W, h: H, geri };
}

// Rakam satırı hiç bulunamazsa denenen açılar. 15° adımla her eğiklik en çok 7,5° kalır; o kadarlık eğik
// satır zaten bulunur ve ölçülen eğime göre ince ayar yapılır. 90° yeter: baş aşağıyı okuyucu ayrıca çevirir.
const ARAMA = [15, -15, 30, -30, 45, -45, 60, -60, 75, -75, 90];
const INCE_AYAR = 1.5; // derece; bundan az eğik satır olduğu gibi okunur

/**
 * Rakam satırını (gerekirse görüntüyü döndürerek) bulur ve düz hale getirir.
 * Döner: { s (satirlariBul sonucu, düzeltilmiş görüntüde), data, w, h, aci, geri } ya da null.
 */
export function hizalaVeBul(data, w, h, enKucukOran = 0.04) {
  const dene = (aci) => {
    const d = aci ? dondur(data, w, h, aci) : { data, w, h, geri: (x, y) => [x, y] };
    const s = satirlariBul(d.data, d.w, d.h, enKucukOran);
    return s ? { s, ...d, aci } : null;
  };
  // Bulunan satırı ölçülen eğimine göre düzelt (her zaman asıl görüntüden; iki kez döndürmek bulanıklaştırır).
  const duzelt = (b) => (!b || Math.abs(b.s.egim) < INCE_AYAR ? b : dene(b.aci - b.s.egim) ?? b);
  // Eğik görüntüde rastgele birkaç leke de "satır" gibi görünebilir; en çok rakam içeren satır seçilir.
  // Küpenin büyük satırı en az 6 rakamdır: o kadar rakamlı satır bulununca aramayı bırak.
  const yeter = (b) => b && b.s.adet >= SIRA_EN_AZ;
  const duz = duzelt(dene(0));
  if (yeter(duz) || !yaziVarMi(data, w, h, enKucukOran)) return duz;
  // Açı araması hız için yarı boyutlu kopyada yapılır (boş görüntüde her turda çalışır; yavaşlarsa dokunuşlar
  // gecikir). En iyi açı bulununca tam boyda uygulanır.
  const k = kucult(data, w, h);
  let enIyiAci = null, enIyiAdet = duz ? duz.s.adet : 0;
  for (const aci of ARAMA) {
    const d = dondur(k.data, k.w, k.h, aci);
    const s = satirlariBul(d.data, d.w, d.h, enKucukOran);
    if (s && s.adet > enIyiAdet) { enIyiAci = aci - (Math.abs(s.egim) < INCE_AYAR ? 0 : s.egim); enIyiAdet = s.adet; }
    if (enIyiAdet >= SIRA_EN_AZ) break;
  }
  return enIyiAci == null ? duz : duzelt(dene(enIyiAci)) ?? duz;
}

/** Yarı boyut: 2×2 piksellik her kareden biri siyahsa siyah (ince rakam çizgileri kaybolmasın). */
function kucult(data, w, h) {
  const W = w >> 1, H = h >> 1, d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (2 * y * w + 2 * x) * 4;
      const siyah = data[i] === 0 || data[i + 4] === 0 || data[i + w * 4] === 0 || data[i + w * 4 + 4] === 0;
      const o = (y * W + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = siyah ? 0 : 255;
      d[o + 3] = 255;
    }
  }
  return { data: d, w: W, h: H };
}

/** Döndürerek aramaya değer mi? Rakam boyunda en az 4 leke yoksa (boş/alakasız görüntü) arama yapılmaz. */
function yaziVarMi(data, w, h, enKucukOran) {
  const enKucuk = Math.max(6, h * enKucukOran);
  let sayi = 0;
  for (const k of lekeler(data, w, h)) {
    const kw = k.x1 - k.x0 + 1, kh = k.y1 - k.y0 + 1, uzun = Math.max(kw, kh);
    if (uzun >= enKucuk && uzun <= h * 0.6 && k.n >= enKucuk && ++sayi >= 4) return true;
  }
  return false;
}

/** Okumaya göndermeden önce dolgu pikselleri beyaza çevrilir. */
export function dolguyuTemizle(data) {
  const d = new Uint8ClampedArray(data);
  for (let i = 0; i < d.length; i += 4) if (d[i] === DOLGU) d[i] = d[i + 1] = d[i + 2] = 255;
  return d;
}
