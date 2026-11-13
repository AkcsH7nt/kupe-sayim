import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocrMetnindenNumara } from '../lib/kupe.js';

test('ikiSatir', () => {
  assert.equal(ocrMetnindenNumara('00\n433001'), 'TR00433001');
});

test('barkodGurultusuReddedilir', () => {
  // Yanlış numara kabul etmek en kötü sonuç: fazladan satır varsa okuma reddedilir.
  assert.equal(ocrMetnindenNumara('00\n1111 11\n433001\n'), null);
  assert.equal(ocrMetnindenNumara('1111 11\n433001'), null);
  assert.equal(ocrMetnindenNumara('111111\n433001'), null);
  assert.equal(ocrMetnindenNumara('433007433001\n100100\n'), null);
});

test('ayriOkunanTRHarfleri', () => {
  assert.equal(ocrMetnindenNumara('78 00\n433001'), 'TR00433001');
  assert.equal(ocrMetnindenNumara('18 0 0\n433001'), 'TR00433001');
});

test('harfleriRakamSanmaToleransi', () => {
  assert.equal(ocrMetnindenNumara('7800\n433002'), 'TR00433002');
});

test('tekSatirBitisik', () => {
  assert.equal(ocrMetnindenNumara('00433001'), 'TR00433001');
});

test('eksikHaneReddedilir', () => {
  for (const m of ['00\n43300', '433001', '', '0\n433001', '00\n12345678901']) {
    assert.equal(ocrMetnindenNumara(m), null, m);
  }
});

test('buyukSatirAltiIleOnHaneArasiOlabilir', () => {
  // Sahadaki küpeler karışık: büyük satır 6, 7 ya da daha fazla haneli olabiliyor.
  assert.equal(ocrMetnindenNumara('75\n1234567'), 'TR751234567');
  assert.equal(ocrMetnindenNumara('75\n12345678'), 'TR7512345678');
  assert.equal(ocrMetnindenNumara('75\n0001234567'), 'TR750001234567');
  assert.equal(ocrMetnindenNumara('78 75\n1234567'), 'TR751234567');
});
