// Çevrimdışı testi: ilk açılıştan sonra internet kesilir; uygulama açılmalı ve küpe okumalı.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { sunucuBaslat } from '../../scripts/sunucu.mjs';

const PORT = 5190;
let sunucu, tarayici, baglam, sayfa;

before(async () => {
  sunucu = await sunucuBaslat(PORT);
  tarayici = await chromium.launch({ channel: 'chrome' });
  baglam = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
  sayfa = await baglam.newPage();
  await sayfa.goto(`http://localhost:${PORT}/`);
});

after(async () => {
  await tarayici?.close();
  sunucu?.close();
});

test('cevrimdisiHazirGostergesi', async () => {
  await sayfa.waitForSelector('#cevrimdisi:has-text("Çevrimdışı hazır")', { timeout: 60000 });
});

test('internetsizAcilirVeOkur', async () => {
  await baglam.setOffline(true);
  await sayfa.reload();
  await sayfa.waitForSelector('#sekme-sayimlar');
  const ornek = 'data:image/webp;base64,' + readFileSync('test/tarayici/kupe-ornek.webp').toString('base64');
  const rakam = await sayfa.evaluate(async (src) => {
    const { Okuyucu } = await import('./lib/okuyucu.js');
    const img = new Image(); img.src = src; await img.decode();
    return (await new Okuyucu().goruntuOku(img, { x: 70, y: 405, w: 210, h: 160 })).rakam;
  }, ornek);
  assert.equal(rakam, 'TR00433001');
});
