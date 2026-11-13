// Hata tekrarı: kamerada küpe YOKKEN (boş/alakasız görüntü) okuma döngüsü sayfayı kilitlememeli;
// düğmeler çalışmalı ve çevrimdışı göstergesi güncellenmeli. ffmpeg yoksa atlanır.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { sunucuBaslat } from '../../scripts/sunucu.mjs';

const PORT = 5191;
let sunucu, tarayici, sayfa, ffmpegYok = false;

before(async () => {
  const video = join(mkdtempSync(join(tmpdir(), 'kupe-bos-')), 'bos.y4m');
  try {
    // Küpe içermeyen hareketli desen (kumaş gibi): okunacak hiçbir şey yok.
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'mandelbrot=size=1280x720:rate=10',
      '-t', '2', '-pix_fmt', 'yuv420p', video]);
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

test('kupeYokkenDugmelerCalisir', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.waitForSelector('#durum:has-text("Küpeyi çerçeveye getirin")', { timeout: 30000 });
  await sayfa.waitForTimeout(1500); // okuma döngüsü dönmeye başlasın
  await sayfa.click('#elle-yaz', { timeout: 5000 });
  await sayfa.waitForSelector('#tus-paneli[open]', { timeout: 5000 });
  await sayfa.click('#tus-iptal', { timeout: 5000 });
  await sayfa.click('#sekme-liste', { timeout: 5000 });
  assert.equal(await sayfa.locator('#ekran-liste:not([hidden])').count(), 1);
});

test('kupeYokkenCevrimdisiGostergesiGuncellenir', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.waitForSelector('#cevrimdisi:has-text("Çevrimdışı hazır")', { timeout: 30000 });
});
