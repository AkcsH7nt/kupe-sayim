// Uçtan uca kamera testi: örnek küpe görüntüsü Chrome'a sahte kamera olarak verilir.
// Uygulama hiçbir düğmeye basılmadan küpeyi okumalı, "doğru mu?" diye sormalı ve
// ancak Doğru denince listeye eklemeli. ffmpeg yoksa atlanır.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { sunucuBaslat } from '../../scripts/sunucu.mjs';

const PORT = 5188;
let sunucu, tarayici, sayfa, ffmpegYok = false;

before(async () => {
  const klasor = mkdtempSync(join(tmpdir(), 'kupe-kamera-'));
  const video = join(klasor, 'kamera.y4m');
  try {
    // 3. küpenin düz yüzü (x 505–765, y 385–585), 1280×720 karenin ortasında çerçeveye sığacak boyda.
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', 'test/tarayici/kupe-ornek.webp',
      '-vf', 'crop=260:200:505:385,scale=546:420,pad=1280:720:367:150:color=0xd8d8d8',
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

const onayBekle = () => sayfa.waitForSelector('#onay[open] #onay-numara:has-text("TR00433002")', { timeout: 60000 });

test('okurOnaySorarYanlisDeninceEklemez', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await onayBekle();
  assert.equal(await sayfa.locator('#liste li').count(), 0, 'onaylanmadan listeye girmez');
  // Tanı satırı: kameranın ne gördüğü ekranda yazar (sahadan ekran görüntüsüyle sorun bulmak için).
  assert.match(await sayfa.textContent('#tani'), /1280×720 · 1× · hedef: küpe \d+×\d+ tamam · tur \d+ · \d+ ms · okunan: 00\/433002/);
  // Bulunan küpenin üstüne sarı kutu oturur.
  assert.equal(await sayfa.locator('#cerceve.bulundu').count(), 1);
  await sayfa.screenshot({ path: join(tmpdir(), 'kupe-onay-ekran.png') });
  await sayfa.click('#onay-hayir');
  assert.equal(await sayfa.locator('#liste li').count(), 0);
  // Reddedilen küpe çerçevede dururken aynı soru tekrar tekrar çıkmaz.
  await sayfa.waitForTimeout(3000);
  assert.equal(await sayfa.locator('#onay[open]').count(), 0);
});

test('dogruDeninceKameraninAltindakiListeyeDuser', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.reload();
  await onayBekle();
  await sayfa.click('#onay-evet');
  await sayfa.waitForSelector('#liste li[data-no="TR00433002"]');
  assert.match(await sayfa.textContent('#sayac'), /1 hayvan/);
  // Okutmaya devam: aynı küpe hâlâ çerçevede, yeniden sormaz, ikinci kez eklemez.
  await sayfa.waitForTimeout(3000);
  assert.equal(await sayfa.locator('#onay[open]').count(), 0);
  assert.equal(await sayfa.locator('#liste li').count(), 1);
  await sayfa.screenshot({ path: join(tmpdir(), 'kupe-liste-ekran.png') });
});
