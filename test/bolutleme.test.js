import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lekeler, satirlariBul } from '../lib/bolutleme.js';

// Beyaz zemine siyah şekiller çizen yardımcı (RGBA). Beşinci öğe 'dolu' ise içi dolu blok (barkod),
// değilse 2 px kalınlıkta çerçeve (rakam gibi içi boşluklu karakter).
function goruntu(w, h, kutular) {
  const d = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x0, y0, kw, kh, tur] of kutular) {
    for (let y = y0; y < y0 + kh; y++) for (let x = x0; x < x0 + kw; x++) {
      const kenar = x - x0 < 2 || x0 + kw - 1 - x < 2 || y - y0 < 2 || y0 + kh - 1 - y < 2;
      if (tur !== 'dolu' && !kenar) continue;
      const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 0;
    }
  }
  return d;
}

// Küpe düzeni: TR (sol) + 00 (sağ) küçük satır, barkod şeridi, 6 büyük rakam.
const W = 300, H = 220;
const kucukSatir = [[30, 30, 10, 18], [44, 30, 10, 18], [230, 30, 10, 18], [244, 30, 10, 18]];
// Barkod: ince çubuklar + kaynamış kalın bloklar (karakter oranında ama içi dolu), sağ uçta da var.
const barkod = [...Array(30).keys()].map((i) => [20 + i * 8, 60, 3, 25, 'dolu'])
  .concat([[120, 60, 20, 25, 'dolu'], [262, 60, 20, 25, 'dolu']]);
// Son rakam ince bir "1" (8×50).
const buyukSatir = [...Array(5).keys()].map((i) => [30 + i * 42, 100, 30, 50]).concat([[240, 100, 8, 50]]);

test('lekelerAyriAyriBulunur', () => {
  const l = lekeler(goruntu(40, 20, [[2, 2, 5, 5, 'dolu'], [20, 2, 5, 5, 'dolu']]), 40, 20);
  assert.equal(l.length, 2);
  assert.deepEqual(l.map((k) => [k.x0, k.y0, k.x1, k.y1]).sort((a, b) => a[0] - b[0]), [[2, 2, 6, 6], [20, 2, 24, 6]]);
});

test('duzKupeSatirlari', () => {
  const s = satirlariBul(goruntu(W, H, [...kucukSatir, ...barkod, ...buyukSatir]), W, H);
  assert.equal(s.ters, false);
  assert.deepEqual(s.buyuk, { x0: 30, y0: 100, x1: 247, y1: 149 });
  assert.deepEqual(s.kucuk, { x0: 230, y0: 30, x1: 253, y1: 47 });
});

test('komsuKupeKenariIlKoduSanilmaz', () => {
  // Çerçevenin sağ kenarında komşu küpeden bir parça (büyük satırın yatay hizasının dışında).
  const s = satirlariBul(goruntu(W, H, [...kucukSatir, ...barkod, ...buyukSatir, [285, 28, 10, 18]]), W, H);
  assert.deepEqual(s.kucuk, { x0: 230, y0: 30, x1: 253, y1: 47 });
});

test('tersKupeAnlasilir', () => {
  // 180° çevrilmiş düzen: büyük satır üstte, küçük satır altta.
  const cevir = ([x, y, kw, kh, tur]) => [W - x - kw, H - y - kh, kw, kh, tur];
  const s = satirlariBul(goruntu(W, H, [...kucukSatir, ...barkod, ...buyukSatir].map(cevir)), W, H);
  assert.equal(s.ters, true);
});

test('buyukSatirYoksaNull', () => {
  assert.equal(satirlariBul(goruntu(W, H, barkod), W, H), null);
});
