// Gerçek küpe görüntüsünde çevrimdışı okuma testi. Çalıştır: node --test test/tarayici/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { sunucuBaslat } from '../../scripts/sunucu.mjs';

const PORT = 5181;
let sunucu, tarayici, sayfa;
const disIstekler = [];

before(async () => {
  sunucu = await sunucuBaslat(PORT);
  tarayici = await chromium.launch({ channel: 'chrome' });
  sayfa = await tarayici.newPage();
  await sayfa.route('**/*', (r) => {
    if (new URL(r.request().url()).hostname === 'localhost') return r.continue();
    disIstekler.push(r.request().url());
    return r.abort();
  });
  await sayfa.goto(`http://localhost:${PORT}/test/tarayici/okuma.html`);
  await sayfa.waitForFunction(() => window.hazir === true);
});

after(async () => {
  await tarayici?.close();
  sunucu?.close();
});

// Örnek görüntü 1024×1280; küpelerin düz (üst) yarısı y≈405–565, ters (alt) yarısı y≈565–725.
const oku = (x, y, w, h) => sayfa.evaluate(([a, b, c, d]) => window.oku(a, b, c, d), [x, y, w, h]);

test('birinciKupeDuzYuz', async () => {
  const s = await oku(70, 405, 210, 160);
  assert.equal(s.rakam, 'TR00433001');
});

test('ucuncuKupeDuzYuz', async () => {
  const s = await oku(515, 405, 210, 160);
  assert.equal(s.rakam, 'TR00433002');
});

test('birinciKupeTersYuz', async () => {
  const s = await oku(70, 565, 210, 160);
  assert.equal(s.rakam, 'TR00433001');
});

test('sekizParcaninHepsi', async () => {
  // Son sütun 745'ten başlar: 735'te komşu küpenin son rakamı bölgenin kenarında yarım kalıyor ve
  // okuyucu bunu (bilerek) "kenarda kesik" sayıp okumuyor.
  const sutunlar = [[70, 'TR00433001'], [295, 'TR00433001'], [515, 'TR00433002'], [745, 'TR00433002']];
  const sonuc = [];
  for (const [x, beklenen] of sutunlar) {
    for (const y of [405, 565]) sonuc.push([x, y, (await oku(x, y, 210, 160)).rakam, beklenen]);
  }
  assert.deepEqual(sonuc.map((s) => s[2]), sonuc.map((s) => s[3]), JSON.stringify(sonuc));
});

test('disAgaIstekYok', () => {
  assert.deepEqual(disIstekler, []);
});
