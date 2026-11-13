// Arayüz testi (kamera izni yok): elle giriş, kameranın altındaki liste, aşı/düştü sütunları,
// kalıcılık, silme onayı, yakınlaştırma düğmeleri, Kaydet ve kayıtlı sayımlar, dar ekran.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { sunucuBaslat } from '../../scripts/sunucu.mjs';

const PORT = 5187;
const ADRES = `http://localhost:${PORT}/`;
let sunucu, tarayici, sayfa;

before(async () => {
  sunucu = await sunucuBaslat(PORT);
  tarayici = await chromium.launch({ channel: 'chrome' });
  const baglam = await tarayici.newContext({ viewport: { width: 360, height: 740 }, acceptDownloads: true });
  sayfa = await baglam.newPage();
  await sayfa.goto(ADRES);
});

after(async () => {
  await tarayici?.close();
  sunucu?.close();
});

const elleGir = async (rakamlar) => {
  await sayfa.click('#elle-yaz');
  await sayfa.click('#tus-temizle');
  for (const r of rakamlar) await sayfa.click(`[data-tus="${r}"]`);
  await sayfa.click('#tus-ekle');
};
const satir = (no) => `#liste li[data-no="${no}"]`;
const basili = (secici) => sayfa.getAttribute(secici, 'aria-pressed');

test('kameraYoksaUyariVeElleGirisCalisir', async () => {
  await sayfa.waitForSelector('#durum:has-text("Kamera açılamadı")', { timeout: 30000 });
  await elleGir('00433001');
  // Liste kameranın altında, aynı ekranda: sekme değiştirmeden görünür.
  assert.ok(await sayfa.isVisible(satir('TR00433001')));
  assert.match(await sayfa.textContent('#sayac'), /1 hayvan/);
});

test('ayniKupeTekrarEklenmez', async () => {
  await elleGir('00433001');
  assert.match(await sayfa.textContent('#bildirim'), /zaten okundu/);
  assert.equal(await sayfa.locator('#liste li').count(), 1);
});

test('yeniOkunanEnUstte', async () => {
  await elleGir('00433002');
  assert.deepEqual(await sayfa.locator('#liste li').evaluateAll((l) => l.map((x) => x.dataset.no)), ['TR00433002', 'TR00433001']);
});

test('asiVeDustuSutunlariVeKalicilik', async () => {
  assert.equal(await basili(`${satir('TR00433001')} .asi`), 'false');
  await sayfa.click(`${satir('TR00433001')} .asi`);
  await sayfa.click(`${satir('TR00433002')} .dustu`);
  assert.equal(await basili(`${satir('TR00433001')} .asi`), 'true');
  assert.equal(await basili(`${satir('TR00433002')} .dustu`), 'true');
  await sayfa.reload();
  assert.equal(await basili(`${satir('TR00433001')} .asi`), 'true');
  assert.equal(await basili(`${satir('TR00433001')} .dustu`), 'false');
  assert.equal(await basili(`${satir('TR00433002')} .dustu`), 'true');
  assert.equal(await basili(`${satir('TR00433002')} .asi`), 'false');
  // İşaret tekrar dokununca kalkar.
  await sayfa.click(`${satir('TR00433002')} .dustu`);
  assert.equal(await basili(`${satir('TR00433002')} .dustu`), 'false');
  await sayfa.click(`${satir('TR00433002')} .dustu`);
});

test('satirSilmeOnayIsterVeGeriTusuVazgecer', async () => {
  await elleGir('00433077');
  await sayfa.click(`${satir('TR00433077')} .sil`);
  await sayfa.waitForSelector('#onay[open]');
  await sayfa.keyboard.press('Escape'); // geri tuşu "hayır" sayılır
  assert.equal(await sayfa.locator('#onay[open]').count(), 0);
  assert.equal(await sayfa.locator('#liste li').count(), 3);
  await sayfa.click(`${satir('TR00433077')} .sil`);
  await sayfa.click('#onay-evet');
  assert.equal(await sayfa.locator('#liste li').count(), 2);
  // Onay kapandıktan sonra elle giriş takılmadan çalışır.
  await elleGir('00433077');
  assert.match(await sayfa.textContent('#bildirim'), /TR00433077 eklendi/);
  await sayfa.click(`${satir('TR00433077')} .sil`);
  await sayfa.click('#onay-evet');
});

test('yakinlastirmaDugmeleri', async () => {
  const buyutme = () => sayfa.evaluate(() => document.querySelector('#video').style.transform);
  assert.equal(await basili('[data-zoom="1"]'), 'true');
  await sayfa.click('[data-zoom="2"]');
  assert.equal(await basili('[data-zoom="2"]'), 'true');
  assert.equal(await basili('[data-zoom="1"]'), 'false');
  assert.equal(await buyutme(), 'scale(2)');
  await sayfa.click('[data-zoom="3"]');
  assert.equal(await buyutme(), 'scale(3)');
  await sayfa.click('[data-zoom="1"]');
  assert.equal(await buyutme(), '');
});

test('darEkrandaYatayKaydirmaYok', async () => {
  assert.ok(await sayfa.evaluate(() => document.documentElement.scrollWidth <= 360), 'okut');
  // Satırdaki numara ve sütun düğmeleri dar ekrana sığar (işaretliyken de).
  const tasan = await sayfa.locator('#liste li').evaluateAll((l) => l.filter((x) => x.scrollWidth > x.clientWidth).length);
  assert.equal(tasan, 0);
  const kirpik = await sayfa.locator('#liste li .no').evaluateAll((l) => l.filter((x) => x.scrollWidth > x.clientWidth).length);
  assert.equal(kirpik, 0);
});

test('kaydetSayimiSaklarVeListeyiBosaltir', async () => {
  await sayfa.click('#kaydet');
  await sayfa.waitForSelector('#onay[open] >> text=2 hayvan');
  await sayfa.click('#onay-evet');
  await sayfa.waitForSelector('#ekran-sayimlar:not([hidden])');
  assert.equal(await sayfa.locator('#sayimlar > li').count(), 1);
  assert.match(await sayfa.textContent('#sayimlar > li'), /2 hayvan/);
  assert.match(await sayfa.textContent('#sayimlar > li'), /1 aşı/);
  assert.ok(await sayfa.evaluate(() => document.documentElement.scrollWidth <= 360), 'sayımlar');
  await sayfa.click('#sekme-okut');
  assert.equal(await sayfa.locator('#liste li').count(), 0);
  assert.match(await sayfa.textContent('#sayac'), /0 hayvan/);
  assert.ok(await sayfa.isDisabled('#kaydet'));
  await sayfa.reload();
  await sayfa.click('#sekme-sayimlar');
  assert.equal(await sayfa.locator('#sayimlar > li').count(), 1);
});

test('kayitliSayimExcelIndir', async () => {
  const [indirme] = await Promise.all([sayfa.waitForEvent('download'), sayfa.click('#sayimlar > li .excel')]);
  assert.match(indirme.suggestedFilename(), /^kupe-sayim-\d{4}-\d{2}-\d{2}-\d{4}\.csv$/);
  const icerik = readFileSync(await indirme.path(), 'utf8');
  assert.ok(icerik.startsWith('﻿No;Aşı;Düşen küpe'));
  assert.match(icerik, /TR00433001;Evet;Hayır/);
  assert.match(icerik, /TR00433002;Hayır;Evet/);
});

test('kayitliSayimSil', async () => {
  await sayfa.click('#sayimlar > li .sil');
  await sayfa.click('#onay-evet');
  assert.equal(await sayfa.locator('#sayimlar > li').count(), 0);
  assert.ok(await sayfa.isVisible('#sayimlar-bos'));
});

test('yediHaneliKupeElleGirilir', async () => {
  // Sahadaki küpeler karışık: büyük rakamlar 6 da olabilir 7 de.
  await sayfa.click('#sekme-okut');
  await elleGir('751234567');
  assert.ok(await sayfa.isVisible(satir('TR751234567')));
  assert.match(await sayfa.textContent('#sayac'), /1 hayvan/);
});
