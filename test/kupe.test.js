import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocrMetnindenNumara, barkoddanNumara, Oylayici } from '../lib/kupe.js';

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

test('barkod', () => {
  assert.equal(barkoddanNumara('TR00433001'), 'TR00433001');
  assert.equal(barkoddanNumara('TR 00 433001'), 'TR00433001');
  assert.equal(barkoddanNumara('12345'), null);
});

test('barkodTamSekizHaneOlmali', () => {
  assert.equal(barkoddanNumara('TR004330017'), null);
  assert.equal(barkoddanNumara('0792004330010'), null);
  assert.equal(barkoddanNumara('12345678901234'), null);
  assert.equal(barkoddanNumara('00433001'), 'TR00433001');
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

test('kabuldenSonraAyniNumaraTekrarlanmaz', () => {
  // Küpe görüntüde durdukça aynı numara tekrar tekrar kabul edilmemeli.
  const o = new Oylayici();
  o.ekle('A', 'barkod');
  assert.equal(o.ekle('A', 'barkod'), 'A');
  for (let i = 0; i < 6; i++) assert.equal(o.ekle('A', 'barkod'), null);
});

test('baskaNumaraYaDaBosKarelerdenSonraTekrarKabul', () => {
  const o = new Oylayici();
  o.ekle('A', 'barkod'); o.ekle('A', 'barkod');
  for (let i = 0; i < 3; i++) o.ekle(null, 'rakam');
  o.ekle('A', 'barkod');
  assert.equal(o.ekle('A', 'barkod'), 'A');
  o.ekle('B', 'barkod');
  assert.equal(o.ekle('B', 'barkod'), 'B');
});
