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

test('ilKoduBirlesikseTRSecilmez', () => {
  // "00" tek leke olarak kaynaşmış (karakter sayılmaz): sağda tek karakter kalırsa TR'ye kaymamalı.
  const kaynasmis = [[30, 30, 10, 18], [44, 30, 10, 18], [230, 30, 30, 18, 'dolu']];
  const s = satirlariBul(goruntu(W, H, [...kaynasmis, ...barkod, ...buyukSatir]), W, H);
  assert.equal(s.kucuk, null);
});

test('tersKupeAnlasilir', () => {
  // 180° çevrilmiş düzen: büyük satır üstte, küçük satır altta.
  const cevir = ([x, y, kw, kh, tur]) => [W - x - kw, H - y - kh, kw, kh, tur];
  const s = satirlariBul(goruntu(W, H, [...kucukSatir, ...barkod, ...buyukSatir].map(cevir)), W, H);
  assert.equal(s.ters, true);
});

test('bilinenDuzendeKucukSatirAdayOlarakDaVerilir', () => {
  const s = satirlariBul(goruntu(W, H, [...kucukSatir, ...barkod, ...buyukSatir]), W, H);
  assert.deepEqual(s.kucukAdaylar, [{ x0: 30, y0: 30, x1: 253, y1: 47 }]);
  assert.equal(s.H, 50);
});

test('ilKoduSoldaysaKucukSatirAdayOlur', () => {
  // Sahadaki küpelerde il kodu her zaman sağda değil. Bilinen düzen tutmaz (kucuk yok) ama
  // küçük yazı satırı aday olarak döner; okuyucu onu "TR" ile birlikte okuyup il kodunu arar.
  const solda = [[30, 30, 10, 18], [44, 30, 10, 18], [60, 30, 10, 18], [74, 30, 10, 18]];
  const s = satirlariBul(goruntu(W, H, [...solda, ...barkod, ...buyukSatir]), W, H);
  assert.equal(s.ters, false);
  assert.equal(s.kucuk, null);
  assert.deepEqual(s.kucukAdaylar, [{ x0: 30, y0: 30, x1: 83, y1: 47 }]);
});

test('kucukYaziHicYoksaBuyukSatirYineBulunur', () => {
  const s = satirlariBul(goruntu(W, H, [...barkod, ...buyukSatir]), W, H);
  assert.deepEqual(s.buyuk, { x0: 30, y0: 100, x1: 247, y1: 149 });
  assert.equal(s.kucuk, null);
  assert.deepEqual(s.kucukAdaylar, []);
});

test('buyukRakamlarAradaBosluklaYazilmissaTekSatir', () => {
  // "123 4567" gibi: iki grup arasında boşluk var ama aynı satır.
  const aralikli = [30, 62, 94, 150, 182, 214, 246].map((x) => [x, 100, 24, 50]);
  const s = satirlariBul(goruntu(W, H, aralikli), W, H);
  assert.deepEqual(s.buyuk, { x0: 30, y0: 100, x1: 269, y1: 149 });
});

test('uzaktakiKucukYaziDusukEsikleBulunur', () => {
  // Tüm kamera görüntüsünde arama: rakamlar görüntüye göre küçük (16 px / 600 px).
  const kucukRakamlar = [...Array(6).keys()].map((i) => [300 + i * 14, 280, 10, 16]);
  const d = goruntu(800, 600, kucukRakamlar);
  assert.equal(satirlariBul(d, 800, 600), null);
  assert.deepEqual(satirlariBul(d, 800, 600, 0.02).buyuk, { x0: 300, y0: 280, x1: 379, y1: 295 });
});

test('kenardaKesilenSatirIsaretlenir', () => {
  // Okunan bölge küpeyi kesiyorsa baştaki rakam eksik kalır ve kısa ama geçerli görünen bir numara çıkar.
  // Satır bölgenin kenarına yapışıksa (yarım rakam boyundan yakın) kesik sayılır.
  const tam = satirlariBul(goruntu(W, H, [...kucukSatir, ...barkod, ...buyukSatir]), W, H);
  assert.equal(tam.kesik, false);
  const soldanKesik = [...Array(6).keys()].map((i) => [6 + i * 42, 100, 30, 50]);
  assert.equal(satirlariBul(goruntu(W, H, soldanKesik), W, H).kesik, true);
  const sagdanKesik = [...Array(6).keys()].map((i) => [60 + i * 42, 100, 30, 50]);
  assert.equal(satirlariBul(goruntu(W, H, sagdanKesik), W, H).kesik, true);
});

test('kenardaYarimRakamParcasiVarsaKesik', () => {
  // Bölge bir rakamın ortasından geçmiş: kenarda rakam boyunda dar bir parça kalır (karakter sayılmaz ama iz bırakır).
  const satir = [...Array(6).keys()].map((i) => [40 + i * 42, 100, 30, 50]);
  assert.equal(satirlariBul(goruntu(W, H, satir), W, H).kesik, false);
  assert.equal(satirlariBul(goruntu(W, H, [...satir, [0, 100, 5, 50, 'dolu']]), W, H).kesik, true);
  assert.equal(satirlariBul(goruntu(W, H, [...satir, [W - 5, 104, 5, 44, 'dolu']]), W, H).kesik, true);
});

test('kenardakiKoyuZeminKesikSayilmaz', () => {
  // Küpenin yanında koyu tüy/gölge bölgenin kenarına değer; rakam parçası değildir (rakamdan çok uzun).
  const satir = [...Array(6).keys()].map((i) => [40 + i * 42, 100, 30, 50]);
  assert.equal(satirlariBul(goruntu(W, H, [...satir, [0, 0, 8, H, 'dolu']]), W, H).kesik, false);
});

test('buyukSatirYoksaNull', () => {
  assert.equal(satirlariBul(goruntu(W, H, barkod), W, H), null);
});
