import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SayimListesi, SayimArsivi, dusmusMu, csvMetni, paylasimMetni, ozet } from '../lib/liste.js';

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
  l.ekle('TR00433002', 'elle');
  l.dustuDegistir('TR00433002');
  const satirlar = l.csv().split('\r\n');
  assert.equal(satirlar[0], '\uFEFFNo;Aşı;Düşen küpe;Eski küpe;Saat');
  assert.match(satirlar[1], /^TR00433001;Evet;Hayır;;\d\d:\d\d$/);
  assert.match(satirlar[2], /^TR00433002;Hayır;Evet;;\d\d:\d\d$/);
});

test('paylasim', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433001', 'elle');
  l.ekle('TR00433017', 'elle');
  l.ekle('TR00433020', 'elle');
  l.ekle('TR00433030', 'elle');
  l.asiDegistir('TR00433001');
  l.eskiKupeBagla('TR00433017', 'TR00432990');
  l.asiDegistir('TR00433020');
  l.dustuDegistir('TR00433020');
  const satirlar = l.paylasimMetni(new Date(2026, 10, 13)).split('\n');
  assert.equal(satirlar[0], 'Sayım 13.11.2026 – 4 hayvan');
  assert.ok(satirlar.includes('TR00433001 – aşı'));
  assert.ok(satirlar.includes('TR00433017 – düşen küpe (eski TR00432990)'));
  assert.ok(satirlar.includes('TR00433020 – aşı, düşen küpe'));
  assert.ok(satirlar.includes('TR00433030'));
});

test('dustuIsareti', () => {
  const depo = sahteDepo();
  const l = new SayimListesi(depo);
  l.ekle('TR00433001', 'elle');
  assert.equal(dusmusMu(l.kayitlar()[0]), false);
  l.dustuDegistir('TR00433001');
  assert.equal(dusmusMu(l.kayitlar()[0]), true);
  assert.equal(dusmusMu(new SayimListesi(depo).kayitlar()[0]), true);
  l.dustuDegistir('TR00433001');
  assert.equal(dusmusMu(l.kayitlar()[0]), false);
});

test('dustuKapatincaEskiKupeBagiKalkar', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433055', 'elle');
  l.eskiKupeBagla('TR00433055', 'TR00433001');
  assert.equal(dusmusMu(l.kayitlar()[0]), true);
  l.dustuDegistir('TR00433055');
  assert.equal(dusmusMu(l.kayitlar()[0]), false);
  assert.equal(l.kayitlar()[0].eskiNo, null);
  assert.equal(l.ekle('TR00433001', 'elle').durum, 'eklendi');
});

test('yenidenEskiye', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433002', 'elle');
  l.ekle('TR00433001', 'elle');
  l.ekle('TR00433003', 'elle');
  assert.deepEqual(l.yenidenEskiye().map((k) => k.no), ['TR00433003', 'TR00433001', 'TR00433002']);
});

test('bakListeyiDegistirmez', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433055', 'elle');
  l.eskiKupeBagla('TR00433055', 'TR00433001');
  assert.equal(l.bak('TR00433055'), 'zaten');
  assert.equal(l.bak('TR00433001'), 'haric');
  assert.equal(l.bak('TR00433002'), 'yeni');
  assert.equal(l.kayitlar().length, 1);
});

test('arsivEkleListeleSil', () => {
  const depo = sahteDepo();
  const a = new SayimArsivi(depo);
  const l = new SayimListesi(depo);
  l.ekle('TR00433002', 'elle');
  l.ekle('TR00433001', 'elle');
  const s1 = a.ekle(l.kayitlar(), 1000);
  const s2 = a.ekle(l.kayitlar(), 2000);
  assert.deepEqual(s1.kayitlar.map((k) => k.no), ['TR00433001', 'TR00433002']);
  assert.deepEqual(a.hepsi().map((s) => s.zaman), [2000, 1000]); // yeni üstte
  const a2 = new SayimArsivi(depo);
  assert.equal(a2.hepsi().length, 2);
  a2.sil(s2.id);
  assert.deepEqual(new SayimArsivi(depo).hepsi().map((s) => s.id), [s1.id]);
});

test('arsivListedenBagimsizKopyaTutar', () => {
  const depo = sahteDepo();
  const a = new SayimArsivi(depo);
  const l = new SayimListesi(depo);
  l.ekle('TR00433001', 'elle');
  const s = a.ekle(l.kayitlar(), 1000);
  l.asiDegistir('TR00433001');
  l.temizle();
  assert.equal(s.kayitlar[0].asi, false);
  assert.equal(a.hepsi()[0].kayitlar.length, 1);
});

test('arsivAyniAndaIkiKayitAyriKimlik', () => {
  const a = new SayimArsivi(sahteDepo());
  const k = [{ no: 'TR00433001', asi: false, eskiNo: null, zaman: 1, kaynak: 'elle' }];
  assert.notEqual(a.ekle(k, 1000).id, a.ekle(k, 1000).id);
});

test('arsivKaydedilemezseNullVeEklenmez', () => {
  const k = [{ no: 'TR00433001', asi: false, eskiNo: null, zaman: 1, kaynak: 'elle' }];
  const dolu = new SayimArsivi({ getItem: () => null, setItem: () => { throw new Error('dolu'); } });
  assert.equal(dolu.ekle(k, 1000), null);
  assert.equal(dolu.hepsi().length, 0);
  assert.equal(new SayimArsivi(null).ekle(k, 1000), null);
  assert.equal(new SayimArsivi(sahteDepo()).ekle([], 1000), null); // boş sayım kaydedilmez
});

test('arsivBozukVeri', () => {
  const depo = sahteDepo();
  depo.setItem('kupe-sayim-arsiv-v1', '{bozuk');
  assert.equal(new SayimArsivi(depo).hepsi().length, 0);
});

test('saflarDiziyleCalisir', () => {
  const k = [
    { no: 'TR00433002', asi: true, eskiNo: null, zaman: 0, kaynak: 'elle' },
    { no: 'TR00433001', asi: false, dustu: true, eskiNo: null, zaman: 0, kaynak: 'elle' },
  ];
  assert.match(csvMetni(k).split('\r\n')[1], /^TR00433001;Hayır;Evet;;/); // numaraya göre sıralı
  assert.equal(paylasimMetni(k, new Date(2026, 10, 13)).split('\n')[1], 'TR00433001 – düşen küpe');
  assert.deepEqual(ozet(k), { toplam: 2, asi: 1, dusen: 1 });
});

test('benzeriniBulIlKoduOkunamayanKupe', () => {
  // İl kodu okunamadan kaydedilen küpe, sonradan il koduyla okununca (ya da tersi) aynı hayvandır.
  const depo = sahteDepo();
  const l = new SayimListesi(depo);
  l.ekle('TR433002', 'rakam', { ilsiz: true });
  assert.equal(l.benzeriniBul('433002'), 'TR433002');
  assert.equal(l.benzeriniBul('433002', '75'), 'TR433002');
  assert.equal(l.benzeriniBul('433003'), null);
  assert.equal(new SayimListesi(depo).benzeriniBul('433002', '00'), 'TR433002'); // işaret kalıcı
});

test('benzeriniBulIlKoduBilinenKupe', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR00433002', 'rakam');
  assert.equal(l.benzeriniBul('433002'), 'TR00433002');       // il kodu okunamayan yeni okuma
  assert.equal(l.benzeriniBul('433002', '00'), 'TR00433002'); // aynı küpe
  assert.equal(l.benzeriniBul('433002', '75'), null);         // başka ilin aynı sıra numaralı hayvanı
});

test('benzeriniBulHaneSayisiFarkliysaAyri', () => {
  const l = new SayimListesi(sahteDepo());
  l.ekle('TR1234567', 'rakam', { ilsiz: true });
  assert.equal(l.benzeriniBul('234567'), null);
  assert.equal(l.benzeriniBul('34567'), null);
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
