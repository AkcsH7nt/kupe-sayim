// Rakam okumadan önce görüntü hazırlama: gri ton, kontrast germe, Otsu eşiği (koyu yazı → siyah, sarı zemin → beyaz).

export function griVeKontrast(data, w, h) {
  const n = w * h;
  const gri = new Uint8ClampedArray(n);
  let min = 255, max = 0;
  for (let i = 0; i < n; i++) {
    const g = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) | 0;
    gri[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const aralik = Math.max(1, max - min);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) {
    gri[i] = ((gri[i] - min) * 255) / aralik;
    hist[gri[i]]++;
  }
  const esik = otsu(hist, n);
  const cikti = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = gri[i] > esik ? 255 : 0;
    cikti[i * 4] = cikti[i * 4 + 1] = cikti[i * 4 + 2] = v;
    cikti[i * 4 + 3] = 255;
  }
  return cikti;
}

function otsu(hist, toplam) {
  let toplamAgirlik = 0;
  for (let i = 0; i < 256; i++) toplamAgirlik += i * hist[i];
  let arkaToplam = 0, arkaSayi = 0, enIyi = 0, esik = 127;
  for (let t = 0; t < 256; t++) {
    arkaSayi += hist[t];
    if (!arkaSayi) continue;
    const onSayi = toplam - arkaSayi;
    if (!onSayi) break;
    arkaToplam += t * hist[t];
    const ortArka = arkaToplam / arkaSayi;
    const ortOn = (toplamAgirlik - arkaToplam) / onSayi;
    const varyans = arkaSayi * onSayi * (ortArka - ortOn) ** 2;
    if (varyans > enIyi) { enIyi = varyans; esik = t; }
  }
  return esik;
}

export function cevir180(data, w, h) {
  const n = w * h;
  const cikti = new Uint8ClampedArray(data.length);
  for (let i = 0; i < n; i++) {
    const j = n - 1 - i;
    cikti[j * 4] = data[i * 4];
    cikti[j * 4 + 1] = data[i * 4 + 1];
    cikti[j * 4 + 2] = data[i * 4 + 2];
    cikti[j * 4 + 3] = data[i * 4 + 3];
  }
  return cikti;
}

