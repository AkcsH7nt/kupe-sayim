import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cerceveKutusu, okumaBolgesi, zoomPlani, gorunenBolge } from '../lib/cerceve.js';

test('cerceveKutusuOrtadaVeYatay', () => {
  const k = cerceveKutusu(400, 300);
  assert.equal(k.w, 320);
  assert.equal(k.h, 240); // 0.75·w = 240 ≤ 0.8·H = 240
  assert.equal(k.x, 40);
  assert.equal(k.y, 30);
});

test('cerceveKutusuAlcakKutudaYukseklikSinirli', () => {
  const k = cerceveKutusu(400, 200);
  assert.equal(k.h, 160);
  assert.equal(k.y, 20);
});

test('okumaBolgesiKutuyuDolduranVideodaCerceveyeDenk', () => {
  // Yatay video, kutu yüksekliği belirleyici: ölçek = 300/720.
  const b = okumaBolgesi(1280, 720, 400, 300);
  const olcek = 300 / 720;
  assert.equal(b.w, Math.round(320 / olcek));
  assert.equal(b.h, Math.round(240 / olcek));
  assert.equal(b.x, Math.round((1280 - 320 / olcek) / 2));
  assert.equal(b.y, Math.round((720 - 240 / olcek) / 2));
});

test('okumaBolgesiDikeyVideodaGenislikBelirleyici', () => {
  const b = okumaBolgesi(1080, 1920, 400, 300);
  const olcek = 400 / 1080;
  assert.equal(b.w, Math.round(320 / olcek));
  assert.equal(b.h, Math.round(240 / olcek));
});

test('yakinlastirincaBolgeOrtadaKuculur', () => {
  const b1 = okumaBolgesi(1280, 720, 400, 300, 1);
  const b2 = okumaBolgesi(1280, 720, 400, 300, 2);
  assert.equal(b2.w, Math.round(b1.w / 2));
  assert.equal(b2.h, Math.round(b1.h / 2));
  assert.ok(Math.abs((b2.x + b2.w / 2) - 640) <= 1);
  assert.ok(Math.abs((b2.y + b2.h / 2) - 360) <= 1);
});

test('okumaBolgesiVideoyuAsmaz', () => {
  const b = okumaBolgesi(100, 100, 400, 300, 1);
  assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 100 && b.y + b.h <= 100);
});

test('zoomPlaniKameraDestegiYoksaSayisal', () => {
  assert.deepEqual(zoomPlani(2, null), { donanim: null, sayisal: 2 });
  assert.deepEqual(zoomPlani(3, { min: 1, max: 1, taban: 1 }), { donanim: null, sayisal: 3 });
});

test('zoomPlaniKameraYetiyorsaTamamiKamerada', () => {
  assert.deepEqual(zoomPlani(2, { min: 1, max: 8, taban: 1 }), { donanim: 2, sayisal: 1 });
  assert.deepEqual(zoomPlani(1, { min: 1, max: 8, taban: 1 }), { donanim: 1, sayisal: 1 });
});

test('zoomPlaniKameraYetmezseKalaniSayisal', () => {
  assert.deepEqual(zoomPlani(3, { min: 1, max: 2, taban: 1 }), { donanim: 2, sayisal: 1.5 });
});

test('zoomPlaniBaslangicDegerineGore', () => {
  // Kamera 2 ile açıldıysa "2×" = 4.
  assert.deepEqual(zoomPlani(2, { min: 1, max: 10, taban: 2 }), { donanim: 4, sayisal: 1 });
});

test('gorunenBolgeYatayVideodaYanlarKirpilir', () => {
  // Kutu 400×300, video 1280×720: ölçek 300/720; ekranda videonun ortadaki 960×720'si görünür.
  assert.deepEqual(gorunenBolge(1280, 720, 400, 300), { x: 160, y: 0, w: 960, h: 720, olcek: 300 / 720 });
});

test('gorunenBolgeYakinlastirincaKuculur', () => {
  const g = gorunenBolge(1280, 720, 400, 300, 2);
  assert.deepEqual([g.x, g.y, g.w, g.h], [400, 180, 480, 360]);
  assert.equal(g.olcek, 2 * 300 / 720);
});
