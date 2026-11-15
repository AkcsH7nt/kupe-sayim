// Fotoğraf çekip okuma: otomatik okuma kapalı gelir (kamera kendiliğinden aramaz). Çek'e basınca o anki görüntü
// okunur, onay penceresinde küpenin resmi de görünür; cevaptan sonra resim bırakılır.
// "Telefon kamerası" ile gelen fotoğraf da aynı şekilde okunur. ffmpeg yoksa atlanır.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { sunucuBaslat } from '../../scripts/sunucu.mjs';

const PORT = 5197;
const klasor = mkdtempSync(join(tmpdir(), 'kupe-foto-'));
let sunucu, tarayici, sayfa, ffmpegYok = false;
const ff = (...a) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...a]);

before(async () => {
  const video = join(klasor, 'kamera.y4m');
  try {
    // Küpe ortada değil (sol üstte) ve 15° eğik.
    ff('-loop', '1', '-i', 'test/tarayici/kupe-ornek.webp', '-vf',
      'crop=260:200:505:385,scale=360:277,pad=1280:720:200:40:color=0xd8d8d8,rotate=15*PI/180:c=0xd8d8d8',
      '-t', '1', '-r', '10', '-pix_fmt', 'yuv420p', video);
    // Telefon kamerasından gelecek fotoğraflar: kahverengi zeminde 25° eğik küpe, bir de küpesiz desen.
    ff('-i', 'test/tarayici/kupe-ornek.webp', '-vf',
      'crop=210:160:70:405,scale=630:480,pad=1600:1200:485:360:color=0x7a6a50,rotate=-25*PI/180:c=0x7a6a50',
      '-frames:v', '1', join(klasor, 'telefon.png'));
    ff('-f', 'lavfi', '-i', 'mandelbrot=size=1600x1200', '-frames:v', '1', join(klasor, 'bos.png'));
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

const resimGenisligi = () => sayfa.evaluate(() => document.querySelector('#onay-resim').width);

test('otomatikKapaliykenKendiligindenOkumaz', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.waitForSelector("#durum:has-text(\"Çek'e basın\")", { timeout: 30000 });
  assert.equal(await sayfa.getAttribute('#otomatik', 'aria-pressed'), 'false');
  await sayfa.waitForTimeout(4000);
  assert.equal(await sayfa.locator('#onay[open]').count(), 0);
});

test('cekinceOkurResimGosterirDogrudaListeyeEkler', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.click('#cek');
  await sayfa.waitForSelector('#onay[open] #onay-numara', { timeout: 60000 });
  assert.equal(await sayfa.textContent('#onay-numara'), 'TR00433002', await sayfa.textContent('#tani'));
  assert.ok(await sayfa.isVisible('#onay-resim'));
  assert.ok((await resimGenisligi()) > 50);
  await sayfa.screenshot({ path: join(tmpdir(), 'kupe-foto-ekran.png') });
  await sayfa.click('#onay-evet');
  await sayfa.waitForSelector('#liste li[data-no="TR00433002"]');
  assert.equal(await resimGenisligi(), 0, 'resim bırakılmalı');
  // Kamera yeniden akıyor.
  await sayfa.waitForFunction(() => !document.querySelector('#video').paused);
});

test('telefonKamerasiFotografiOkunur', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.setInputFiles('#foto-dosya', join(klasor, 'telefon.png'));
  await sayfa.waitForSelector('#onay[open] #onay-numara', { timeout: 60000 });
  assert.equal(await sayfa.textContent('#onay-numara'), 'TR00433001', await sayfa.textContent('#tani'));
  await sayfa.click('#onay-evet');
  await sayfa.waitForSelector('#liste li[data-no="TR00433001"]');
});

test('okunamayanFotografdaTekrarCekVeyaElleYaz', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.setInputFiles('#foto-dosya', join(klasor, 'bos.png'));
  await sayfa.waitForSelector('#onay[open] >> text=Okunamadı', { timeout: 60000 });
  assert.equal(await sayfa.textContent('#onay-evet'), 'Elle yaz');
  await sayfa.click('#onay-evet');
  await sayfa.waitForSelector('#tus-paneli[open]');
  await sayfa.click('#tus-iptal');
});

test('otomatikDugmesiAcilip Kapanir', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.click('#otomatik');
  assert.equal(await sayfa.getAttribute('#otomatik', 'aria-pressed'), 'true');
  // Açıkken kamera küpeyi kendisi okur (aynı küpe zaten listede: "zaten okundu").
  await sayfa.waitForSelector('#bildirim:has-text("zaten okundu")', { timeout: 60000 });
  await sayfa.click('#otomatik');
  assert.equal(await sayfa.getAttribute('#otomatik', 'aria-pressed'), 'false');
  await sayfa.reload();
  assert.equal(await sayfa.getAttribute('#otomatik', 'aria-pressed'), 'false');
});
