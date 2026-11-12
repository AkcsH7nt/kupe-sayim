// Arayüz testi: kamera izni yok, elle giriş, tekrar uyarısı, aşı, kalıcılık, Excel, dar ekran.
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

test('kameraYoksaUyariVeElleGirisCalisir', async () => {
  await sayfa.waitForSelector('#durum:has-text("Kamera açılamadı")', { timeout: 30000 });
  await elleGir('00433001');
  await sayfa.click('#sekme-liste');
  assert.equal(await sayfa.locator('#liste li[data-no="TR00433001"]').count(), 1);
  assert.match(await sayfa.textContent('#sayac'), /1 hayvan/);
});

test('ayniKupeTekrarEklenmez', async () => {
  await sayfa.click('#sekme-okut');
  await elleGir('00433001');
  assert.match(await sayfa.textContent('#bildirim'), /zaten okundu/);
  await sayfa.click('#sekme-liste');
  assert.equal(await sayfa.locator('#liste li').count(), 1);
});

test('asiIsaretiVeKalicilik', async () => {
  await sayfa.click('#liste li[data-no="TR00433001"] .asi');
  assert.match(await sayfa.textContent('#liste li[data-no="TR00433001"] .asi'), /✓/);
  await sayfa.reload();
  await sayfa.click('#sekme-liste');
  assert.match(await sayfa.textContent('#liste li[data-no="TR00433001"] .asi'), /✓/);
});

test('excelIndir', async () => {
  const [indirme] = await Promise.all([sayfa.waitForEvent('download'), sayfa.click('#excel')]);
  assert.match(indirme.suggestedFilename(), /^kupe-sayim-\d{4}-\d{2}-\d{2}\.csv$/);
  const icerik = readFileSync(await indirme.path(), 'utf8');
  assert.ok(icerik.startsWith('﻿No;Aşı'));
  assert.match(icerik, /TR00433001;Evet/);
});

test('dusenKupe', async () => {
  await sayfa.click('#sekme-okut');
  await elleGir('00433055');
  await sayfa.click('#son-eski');
  await sayfa.click('#tus-temizle');
  for (const r of '00433001') await sayfa.click(`[data-tus="${r}"]`);
  await sayfa.click('#tus-ekle');
  await sayfa.click('#sekme-liste');
  assert.equal(await sayfa.locator('#liste li').count(), 1);
  assert.match(await sayfa.textContent('#liste li[data-no="TR00433055"]'), /TR00433001/);
});

test('darEkrandaYatayKaydirmaYok', async () => {
  for (const sekme of ['#sekme-okut', '#sekme-liste']) {
    await sayfa.click(sekme);
    assert.ok(await sayfa.evaluate(() => document.documentElement.scrollWidth <= 360), sekme);
  }
});
