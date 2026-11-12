// Uçtan uca kamera testi: örnek küpe görüntüsü Chrome'a sahte kamera olarak verilir;
// uygulama hiçbir düğmeye basılmadan küpeyi okuyup listeye eklemeli. ffmpeg yoksa atlanır.
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
    // 3. küpenin düz yüzünü (x 505–765, y 385–585) 1280×720 kareye ortala.
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', 'test/tarayici/kupe-ornek.webp',
      '-vf', 'crop=260:200:505:385,scale=936:720,pad=1280:720:172:0:color=0xd8d8d8',
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

test('kameraKupeyiKendiligindenOkur', async (t) => {
  if (ffmpegYok) return t.skip('ffmpeg yok');
  await sayfa.waitForSelector('#son-no:has-text("TR00433002")', { timeout: 60000 });
  await sayfa.screenshot({ path: join(tmpdir(), 'kupe-kamera-ekran.png') });
  await sayfa.click('#sekme-liste');
  assert.deepEqual(await sayfa.locator('#liste li').evaluateAll((l) => l.map((x) => x.dataset.no)), ['TR00433002']);
});
