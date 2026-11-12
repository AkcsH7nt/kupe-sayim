import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocrMetnindenNumara, barkoddanNumara, Oylayici } from '../lib/kupe.js';

test('ikiSatir', () => {
  assert.equal(ocrMetnindenNumara('00\n433001'), 'TR00433001');
});

test('barkodGurultusu', () => {
  assert.equal(ocrMetnindenNumara('00\n1111 11\n433001\n'), 'TR00433001');
});

test('harfleriRakamSanmaToleransi', () => {
  assert.equal(ocrMetnindenNumara('7800\n433002'), 'TR00433002');
});

test('tekSatirBitisik', () => {
  assert.equal(ocrMetnindenNumara('00433001'), 'TR00433001');
});

test('eksikHaneReddedilir', () => {
  for (const m of ['00\n43300', '00\n4330011', '433001', '']) {
    assert.equal(ocrMetnindenNumara(m), null, m);
  }
});

test('barkod', () => {
  assert.equal(barkoddanNumara('TR00433001'), 'TR00433001');
  assert.equal(barkoddanNumara('TR 00 433001'), 'TR00433001');
  assert.equal(barkoddanNumara('12345'), null);
});

test('oylamaRakam', () => {
  const o = new Oylayici();
  assert.equal(o.ekle('TR00433001', 'rakam'), null);
  assert.equal(o.ekle('TR00433001', 'rakam'), null);
  assert.equal(o.ekle('TR00433001', 'rakam'), 'TR00433001');
});

test('oylamaSeriBozulur', () => {
  const o = new Oylayici();
  for (const n of ['A', 'A', 'B', 'A']) assert.equal(o.ekle(n, 'rakam'), null);
});

test('oylamaBarkod', () => {
  const o = new Oylayici();
  assert.equal(o.ekle('TR00433001', 'barkod'), null);
  assert.equal(o.ekle('TR00433001', 'barkod'), 'TR00433001');
});

test('capraz', () => {
  const o = new Oylayici();
  assert.equal(o.ekle('TR00433001', 'rakam'), null);
  assert.equal(o.ekle('TR00433001', 'barkod'), 'TR00433001');
});

test('nullSeriyiBozar', () => {
  const o = new Oylayici();
  assert.equal(o.ekle('A', 'rakam'), null);
  assert.equal(o.ekle(null, 'rakam'), null);
  assert.equal(o.ekle('A', 'rakam'), null);
  assert.equal(o.ekle('A', 'rakam'), null);
});

test('kabuldenSonraSifirlanir', () => {
  const o = new Oylayici();
  o.ekle('A', 'barkod');
  assert.equal(o.ekle('A', 'barkod'), 'A');
  assert.equal(o.ekle('A', 'barkod'), null);
});
