import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siraOku, ilOku, Oylayici } from '../lib/kupe.js';

test('siraOkuBuyukRakamlar', () => {
  assert.equal(siraOku('433002'), '433002');
  assert.equal(siraOku('1234567\n'), '1234567');
  assert.equal(siraOku('123 4567'), '1234567'); // arada boşlukla yazılmış küpe
  assert.equal(siraOku('0001234567'), '0001234567');
});

test('siraOkuEksikFazlaVeCokSatirReddedilir', () => {
  assert.equal(siraOku('43300'), null);         // 5 hane
  assert.equal(siraOku('12345678901'), null);   // 11 hane
  assert.equal(siraOku('433002\n17'), null);    // iki satır: neyin okunduğu belli değil
  assert.equal(siraOku(''), null);
  assert.equal(siraOku(null), null);
});

test('ilOkuYalnizKesinDesenler', () => {
  // İl kodu küpede farklı yerlerde olabiliyor; yalnız "TR" + 2 rakam ya da yalın 2 rakam kabul edilir.
  assert.equal(ilOku('TR 75'), '75');
  assert.equal(ilOku('TR75\n'), '75');
  assert.equal(ilOku('75'), '75');
  assert.equal(ilOku(' 0 0 '), '00');
});

test('ilOkuBelirsizseNull', () => {
  // Yanlış il kodu yazmaktansa "okunamadı" demek iyidir.
  for (const m of ['TR', 'TR 7', 'TR 758', '7R 75', 'T 75', '758', '7', '', null, 'TR 75\n12']) {
    assert.equal(ilOku(m), null, String(m));
  }
});

test('oylamaIkiKareYeter', () => {
  const o = new Oylayici();
  assert.equal(o.ekle('TR00433001'), null);
  assert.equal(o.ekle('TR00433001'), 'TR00433001');
});

test('oylamaIstenenEsik', () => {
  // İl kodu okunamamış numara daha çok kare ister (il kodunun okunmasına fırsat kalsın).
  const o = new Oylayici();
  for (let i = 0; i < 3; i++) assert.equal(o.ekle('TR433001', 4), null);
  assert.equal(o.ekle('TR433001', 4), 'TR433001');
});

test('oylamaSeriBozulur', () => {
  const o = new Oylayici();
  for (const n of ['A', 'B', 'A', 'B']) assert.equal(o.ekle(n), null);
});

test('nullSeriyiBozar', () => {
  const o = new Oylayici();
  assert.equal(o.ekle('A'), null);
  assert.equal(o.ekle(null), null);
  assert.equal(o.ekle('A'), null);
  assert.equal(o.ekle('A'), 'A');
});

test('kabuldenSonraAyniNumaraTekrarlanmaz', () => {
  // Küpe görüntüde durdukça aynı numara tekrar tekrar kabul edilmemeli.
  const o = new Oylayici();
  o.ekle('A');
  assert.equal(o.ekle('A'), 'A');
  for (let i = 0; i < 6; i++) assert.equal(o.ekle('A'), null);
});

test('baskaNumaraYaDaBosKarelerdenSonraTekrarKabul', () => {
  const o = new Oylayici();
  o.ekle('A'); o.ekle('A');
  for (let i = 0; i < 3; i++) o.ekle(null);
  o.ekle('A');
  assert.equal(o.ekle('A'), 'A');
  o.ekle('B');
  assert.equal(o.ekle('B'), 'B');
});
