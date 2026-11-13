// Sahada görülen hata: küpenin alt yarısı (büyük rakamların olduğu yer) gölge/kir yüzünden sarı görünmüyor;
// sarı kutu yalnız barkodlu üst kısmı alıyor ve rakamlar kutunun dışında kalıyordu.
// Uygulama kutunun çevresini de deneyip numarayı yine okumalı. ffmpeg yoksa atlanır.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { sunucuBaslat } from '../../scripts/sunucu.mjs';

const PORT = 5194;
let sunucu, tarayici, sayfa, ffmpegYok = false;

before(async () => {
  const video = join(mkdtempSync(join(tmpdir(), 'kupe-parcali-')), 'parcali.y4m');
  try {
    // Küpe 300×231, sol üstte (ortadaki kılavuzun dışında). Alt 130 pikseli (büyük rakamlar) renksizleştirilir.
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', 'test/tarayici/kupe-ornek.webp',
      '-filter_complex',
      'crop=260:200:505:385,scale=300:231,split[a][b];[b]crop=300:130:0:101,hue=s=0[gri];[a][gri]overlay=0:101,pad=1280:720:270:15:color=0xd8d8d8',
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

test('kutuYalnizBarkoduAlsaDaRakamlarOkunur', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.waitForSelector('#onay[open] #onay-numara:has-text("TR00433002")', { timeout: 60000 });
  await sayfa.screenshot({ path: join(tmpdir(), 'kupe-parcali-ekran.png') });
  // Sarı kutu yalnız üst parçada kaldı; okuma kutunun geniş halinden geldi.
  assert.match(await sayfa.textContent('#tani'), /hedef: küpe \d+×\d+ [^|]+ \| geniş \d+×\d+ tamam/);
});
