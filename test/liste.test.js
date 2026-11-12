import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SayimListesi } from '../lib/liste.js';

const sahteDepo = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('ekleVeZaten', () => {
  const l = new SayimListesi(sahteDepo());
  assert.equal(l.ekle('TR00433001', 'barkod').durum, 'eklendi');
  assert.equal(l.ekle('TR00433001', 'rakam').durum, 'zaten');
  assert.equal(l.kayitlar().length, 1);
});

test('sirali', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433002', 'elle');
  l.ekle('TR00433001', 'elle');
  assert.deepEqual(l.kayitlar().map((k) => k.no), ['TR00433001', 'TR00433002']);
});

test('asi', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433001', 'elle');
  assert.equal(l.kayitlar()[0].asi, false);
  l.asiDegistir('TR00433001');
  assert.equal(l.kayitlar()[0].asi, true);
  l.asiDegistir('TR00433001');
  assert.equal(l.kayitlar()[0].asi, false);
});

test('eskiKupeBagla', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433001', 'elle');
  l.ekle('TR00433055', 'elle');
  l.eskiKupeBagla('TR00433055', 'TR00433001');
  const k = l.kayitlar();
  assert.deepEqual(k.map((x) => x.no), ['TR00433055']);
  assert.equal(k[0].eskiNo, 'TR00433001');
});

test('eskiKupeOkununcaHaric', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433055', 'elle');
  l.eskiKupeBagla('TR00433055', 'TR00433001');
  assert.equal(l.ekle('TR00433001', 'barkod').durum, 'haric');
  assert.equal(l.kayitlar().length, 1);
});

test('supheli', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433001', 'elle');
  l.ekle('TR00433002', 'elle');
  assert.equal(l.supheliMi('TR00488001'), false);
  l.ekle('TR00433003', 'elle');
  assert.equal(l.supheliMi('TR00488001'), true);
  assert.equal(l.supheliMi('TR00433099'), false);
});

test('silme', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433001', 'elle');
  l.sil('TR00433001');
  assert.equal(l.kayitlar().length, 0);
});

test('csvBicim', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433001', 'elle');
  l.asiDegistir('TR00433001');
  const satirlar = l.csv().split('\r\n');
  assert.ok(satirlar[0].startsWith('\uFEFFNo;Aşı;Eski küpe;Saat'));
  assert.match(satirlar[1], /^TR00433001;Evet;;\d\d:\d\d$/);
});

test('paylasim', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433001', 'elle');
  l.ekle('TR00433017', 'elle');
  l.asiDegistir('TR00433001');
  l.eskiKupeBagla('TR00433017', 'TR00432990');
  const satirlar = l.paylasimMetni(new Date(2026, 10, 13)).split('\n');
  assert.equal(satirlar[0], 'Sayım 13.11.2026 – 2 hayvan');
  assert.ok(satirlar.includes('TR00433001 ✓'));
  assert.ok(satirlar.includes('TR00433017 – (eski TR00432990 düştü)'));
});

test('kaliciDepolama', () => {
  const depo = sahteDepo();
  const l = new SayimListesi(depo);
  l.ekle('TR00433055', 'elle');
  l.eskiKupeBagla('TR00433055', 'TR00433001');
  const l2 = new SayimListesi(depo);
  assert.deepEqual(l2.kayitlar().map((k) => k.no), ['TR00433055']);
  assert.equal(l2.ekle('TR00433001', 'elle').durum, 'haric');
});

test('depolamaHatasiCokmez', () => {
  const depo = { getItem: () => null, setItem: () => { throw new Error('dolu'); } };
  const l = new SayimListesi(depo);
  assert.equal(l.ekle('TR00433001', 'elle').durum, 'eklendi');
  assert.ok(l.sonHata);
});

test('bozukVeri', () => {
  const depo = sahteDepo();
  depo.setItem('kupe-sayim-v1', '{bozuk');
  const l = new SayimListesi(depo);
  assert.equal(l.kayitlar().length, 0);
});

test('temizle', () => {
  const depo = sahteDepo();
  const l = new SayimListesi(depo);
  l.ekle('TR00433001', 'elle');
  l.temizle();
  assert.equal(new SayimListesi(depo).kayitlar().length, 0);
});

test('yenidenBaglamaEskiHaricKaldirir', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433055', 'elle');
  l.eskiKupeBagla('TR00433055', 'TR00433011'); // yazım hatası
  l.eskiKupeBagla('TR00433055', 'TR00433001'); // düzeltme
  assert.equal(l.ekle('TR00433011', 'elle').durum, 'eklendi');
  assert.equal(l.ekle('TR00433001', 'elle').durum, 'haric');
});

test('kayitVarMi', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433001', 'elle');
  assert.equal(l.kayitVarMi('TR00433001'), true);
  assert.equal(l.kayitVarMi('TR00433002'), false);
});

test('depoYoksaUyari', () => {
  const l = new SayimListesi(null);
  assert.ok(l.sonHata);
  l.ekle('TR00433001', 'elle');
  assert.ok(l.sonHata);
});
