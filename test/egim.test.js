import { test } from 'node:test';
import assert from 'node:assert/strict';
import { satirlariBul } from '../lib/bolutleme.js';
import { dondur, hizalaVeBul, DOLGU } from '../lib/egim.js';

// Beyaz zemine 3 px kalın çerçeve karakterler (döndürünce kopmasın diye kalın).
function goruntu(w, h, kutular) {
  const d = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x0, y0, kw, kh] of kutular) {
    for (let y = y0; y < y0 + kh; y++) for (let x = x0; x < x0 + kw; x++) {
      const kenar = x - x0 < 3 || x0 + kw - 1 - x < 3 || y - y0 < 3 || y0 + kh - 1 - y < 3;
      if (!kenar) continue;
      const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 0;
    }
  }
  return d;
}

// Küpe düzeni: üstte TR + il kodu, altta 6 büyük rakam.
const W = 400, H = 300;
const KUPE = [
  [80, 70, 12, 22], [96, 70, 12, 22], [270, 70, 12, 22], [286, 70, 12, 22],
  ...[...Array(6).keys()].map((i) => [80 + i * 40, 120, 28, 56]),
];
const BUYUK = { x0: 80, y0: 120, x1: 307, y1: 175 };

test('dondurBoyutuGenisletirVeKoseleriDolguyla', () => {
  const d = dondur(new Uint8ClampedArray(100 * 50 * 4).fill(255), 100, 50, 90);
  assert.equal(d.w, 50);
  assert.equal(d.h, 100);
  const d2 = dondur(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100, 45);
  assert.ok(d2.w >= 141 && d2.w <= 143);
  assert.equal(d2.data[0], DOLGU); // sol üst köşe görüntünün dışı
});

test('dondurGeriKaynagaDoner', () => {
  const d = dondur(new Uint8ClampedArray(200 * 100 * 4).fill(255), 200, 100, 30);
  const [sx, sy] = d.geri(d.w / 2, d.h / 2);
  assert.ok(Math.abs(sx - 100) < 1 && Math.abs(sy - 50) < 1);
});

test('duzKupedeEgimSifir', () => {
  const s = satirlariBul(goruntu(W, H, KUPE), W, H);
  assert.ok(Math.abs(s.egim) < 0.5, String(s.egim));
});

for (const aci of [8, -12, 20, -35, 50, 80, -80]) {
  test(`egikKupeHizalanir ${aci}°`, () => {
    const egik = dondur(goruntu(W, H, KUPE), W, H, aci);
    const sonuc = hizalaVeBul(egik.data, egik.w, egik.h);
    assert.ok(sonuc, 'satır bulunamadı');
    assert.ok(Math.abs(sonuc.s.egim) < 2, `kalan eğim ${sonuc.s.egim}`);
    // Hizalanınca büyük satır yine 6 rakam genişliğinde ve tek satır yüksekliğinde.
    const g = sonuc.s.buyuk.x1 - sonuc.s.buyuk.x0, y = sonuc.s.buyuk.y1 - sonuc.s.buyuk.y0;
    assert.ok(Math.abs(g - (BUYUK.x1 - BUYUK.x0)) < 14, `genişlik ${g}`);
    assert.ok(Math.abs(y - (BUYUK.y1 - BUYUK.y0)) < 10, `yükseklik ${y}`);
    assert.equal(sonuc.s.kesik, false);
  });
}

test('yanYatmisKupeBulunur', () => {
  const egik = dondur(goruntu(W, H, KUPE), W, H, 90);
  const sonuc = hizalaVeBul(egik.data, egik.w, egik.h);
  assert.ok(sonuc);
  // 90° ya da -90° çevrilmiş olabilir; baş aşağıysa okuyucu ayrıca 180° çevirir.
  assert.ok(Math.abs(Math.abs(sonuc.aci) - 90) < 3, String(sonuc.aci));
});

test('dondurulmusGoruntudeKesikSatirAnlasilir', () => {
  // Rakam satırı görüntünün sol kenarında kesik; döndürülünce kenar "dolgu" olur ama kesiklik yine anlaşılmalı.
  const kesik = [...Array(6).keys()].map((i) => [-14 + i * 40, 120, 28, 56]).filter(([x]) => x >= 0)
    .concat([[0, 120, 14, 56]]);
  const egik = dondur(goruntu(W, H, kesik), W, H, 15);
  const sonuc = hizalaVeBul(egik.data, egik.w, egik.h);
  assert.ok(sonuc);
  assert.equal(sonuc.s.kesik, true);
});

test('egikKupedeRastgeleSatirYerineRakamSatiriSecilir', () => {
  // Çok eğik görüntüde, düz duran 4 leke (kir, gölge) "satır" gibi görünür; 6 rakamlı asıl satır seçilmeli.
  const kupe = dondur(goruntu(W, H, KUPE), W, H, 40);
  const d = kupe.data, kw = kupe.w;
  for (const [x0, y0] of [[20, 20], [45, 20], [70, 20], [95, 20]]) {
    for (let y = y0; y < y0 + 30; y++) for (let x = x0; x < x0 + 18; x++) {
      if (x - x0 < 3 || x0 + 17 - x < 3 || y - y0 < 3 || y0 + 29 - y < 3) { const i = (y * kw + x) * 4; d[i] = d[i + 1] = d[i + 2] = 0; }
    }
  }
  const sonuc = hizalaVeBul(d, kw, kupe.h);
  assert.ok(sonuc);
  assert.ok(sonuc.s.adet >= 6, `adet ${sonuc.s.adet}`);
  assert.ok(Math.abs(sonuc.aci + 40) < 3, `açı ${sonuc.aci}`);
});

test('bosGoruntudeAramaYapilmaz', () => {
  assert.equal(hizalaVeBul(new Uint8ClampedArray(W * H * 4).fill(255), W, H), null);
});
