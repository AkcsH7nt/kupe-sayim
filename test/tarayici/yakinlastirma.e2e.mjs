// Uzaktaki küpe: karede küçük durur. Uygulama küpeyi kendisi bulup büyüterek okur (düğmeye gerek kalmadan);
// 2× seçilince ekrandaki görüntü ve küpenin üstündeki kutu iki kat büyür.
// Sahte kamerada kameranın kendi yakınlaştırması yok; görüntüyü büyütme yolu sınanır. ffmpeg yoksa atlanır.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { sunucuBaslat } from '../../scripts/sunucu.mjs';

const PORT = 5192;
let sunucu, tarayici, sayfa, ffmpegYok = false;

before(async () => {
  const video = join(mkdtempSync(join(tmpdir(), 'kupe-uzak-')), 'uzak.y4m');
  try {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', 'test/tarayici/kupe-ornek.webp',
      '-vf', 'crop=260:200:505:385,scale=234:180,pad=1280:720:523:270:color=0xd8d8d8',
      '-t', '1', '-r', '10', '-pix_fmt', 'yuv420p', video]);
  } catch { ffmpegYok = true; return; }
  sunucu = await sunucuBaslat(PORT);
  tarayici = await chromium.launch({
    channel: 'chrome',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
  });
  const baglam = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
  await baglam.grantPermissions(['camera']);
  sayfa = await baglam.newPage();
  await sayfa.goto(`http://localhost:${PORT}/`);
});

after(async () => {
  await tarayici?.close();
  sunucu?.close();
});

const kutuGenisligi = () => sayfa.evaluate(() => document.querySelector('#cerceve.bulundu')?.getBoundingClientRect().width ?? 0);

test('uzaktakiKucukKupeKendiligindenOkunur', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.waitForSelector('#onay[open] #onay-numara:has-text("TR00433002")', { timeout: 60000 });
  await sayfa.screenshot({ path: join(tmpdir(), 'kupe-uzak-ekran.png') });
});

test('ikiKattaGoruntuVeKutuIkiKatBuyur', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  const once = await kutuGenisligi();
  assert.ok(once > 20, 'küpe kutusu yok');
  await sayfa.click('#onay-hayir');
  await sayfa.click('[data-zoom="2"]');
  await sayfa.waitForFunction((w) => (document.querySelector('#cerceve.bulundu')?.getBoundingClientRect().width ?? 0) > w * 1.5, once, { timeout: 15000 });
  await sayfa.waitForTimeout(400); // kutunun geçiş hareketi bitsin
  const oran = (await kutuGenisligi()) / once;
  assert.ok(oran > 1.7 && oran < 2.3, `oran ${oran}`);
});
