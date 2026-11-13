// Kadrajın her yerinde okuma: küpe ekranın ortasındaki kılavuzun DIŞINDA, sol üst köşede durur.
// Uygulama sarı küpeyi kendisi bulup okumalı ve sarı kutuyu küpenin üstüne oturtmalı. ffmpeg yoksa atlanır.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { sunucuBaslat } from '../../scripts/sunucu.mjs';

const PORT = 5193;
let sunucu, tarayici, sayfa, ffmpegYok = false;

before(async () => {
  const video = join(mkdtempSync(join(tmpdir(), 'kupe-kadraj-')), 'kose.y4m');
  try {
    // Küpe 300×231, karenin sol üstünde (x 270–570, y 15–246). Ortadaki kılavuz y≈118'den başlar: küpeyi keser.
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', 'test/tarayici/kupe-ornek.webp',
      '-vf', 'crop=260:200:505:385,scale=300:231,pad=1280:720:270:15:color=0xd8d8d8',
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

test('kilavuzunDisindakiKupeOkunur', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.waitForSelector('#onay[open] #onay-numara:has-text("TR00433002")', { timeout: 60000 });
  await sayfa.screenshot({ path: join(tmpdir(), 'kupe-kadraj-ekran.png') });
  // Sarı kutu küpenin üstünde: kamera kutusunun sol üst çeyreğinde.
  const yer = await sayfa.evaluate(() => {
    const k = document.querySelector('#kamera').getBoundingClientRect();
    const c = document.querySelector('#cerceve.bulundu')?.getBoundingClientRect();
    return c && { x: (c.left + c.width / 2 - k.left) / k.width, y: (c.top + c.height / 2 - k.top) / k.height, w: c.width / k.width };
  });
  assert.ok(yer, 'küpe bulundu kutusu yok');
  assert.ok(yer.x < 0.45 && yer.y < 0.45, `kutu sol üstte değil: ${JSON.stringify(yer)}`);
  assert.ok(yer.w > 0.25 && yer.w < 0.55, `kutu boyu küpeye uymuyor: ${JSON.stringify(yer)}`);
});
