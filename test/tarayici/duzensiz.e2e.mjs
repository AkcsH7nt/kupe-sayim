// Sahadaki küpeler tek düzende değil: il kodu yeri değişiyor, bazen okunamıyor, küpe sarı görünmeyebiliyor.
// Uygulama her durumda büyük rakamları gördüğü an okumalı. Her senaryo ayrı bir sahte kamera görüntüsüdür.
// ffmpeg yoksa atlanır.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { sunucuBaslat } from '../../scripts/sunucu.mjs';

const PORT = 5195;
const SARI = '0xe6c31e';
const klasor = mkdtempSync(join(tmpdir(), 'kupe-duzensiz-'));
const acik = [];
let sunucu;

/** Verilen görüntü süzgeciyle sahte kamera kurup uygulamayı açar; ffmpeg yoksa null döner. */
async function ac(ad, suzgec) {
  const video = join(klasor, `${ad}.y4m`);
  try {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', 'test/tarayici/kupe-ornek.webp',
      '-filter_complex', suzgec, '-t', '1', '-r', '10', '-pix_fmt', 'yuv420p', video]);
  } catch { return null; }
  sunucu ??= await sunucuBaslat(PORT);
  const tarayici = await chromium.launch({
    channel: 'chrome',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
  });
  acik.push(tarayici);
  const baglam = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
  await baglam.grantPermissions(['camera']);
  const sayfa = await baglam.newPage();
  await sayfa.goto(`http://localhost:${PORT}/`);
  return sayfa;
}

after(async () => {
  for (const t of acik) await t.close();
  sunucu?.close();
});

const KUPE = 'crop=260:200:505:385';
const ORTADA = 'scale=546:420,pad=1280:720:367:150:color=0xd8d8d8';

test('ilKoduOkunamasaDaBuyukRakamlarOkunur', async (t) => {
  // İl kodunun üstü kapatılmış: yalnız "TR" ve büyük rakamlar görünüyor.
  const sayfa = await ac('ilsiz', `${KUPE},drawbox=x=140:y=26:w=62:h=42:color=${SARI}:t=fill,${ORTADA}`);
  if (!sayfa) return t.skip('ffmpeg yok');
  await sayfa.waitForSelector('#onay[open] #onay-numara:has-text("TR433002")', { timeout: 60000 });
  assert.match(await sayfa.textContent('#onay-not'), /İl kodu okunamadı/);
  assert.ok(await sayfa.isHidden('#onay-ek'), 'bilinen il kodu yokken ekleme düğmesi çıkmaz');
  await sayfa.screenshot({ path: join(tmpdir(), 'kupe-ilsiz-ekran.png') });
  await sayfa.click('#onay-evet');
  await sayfa.waitForSelector('#liste li[data-no="TR433002"]');
  // Aynı küpe çerçevede dururken yeniden sorulmaz.
  await sayfa.waitForTimeout(3000);
  assert.equal(await sayfa.locator('#onay[open]').count(), 0);

  // Daha önce il kodu bilinen bir küpe okunduysa tek dokunuşla başına eklenir.
  await sayfa.evaluate(() => { localStorage.removeItem('kupe-sayim-v1'); localStorage.setItem('kupe-sayim-il', '75'); });
  await sayfa.reload();
  await sayfa.waitForSelector('#onay[open] #onay-ek:has-text("Başına 75 ekle")', { timeout: 60000 });
  await sayfa.click('#onay-ek');
  await sayfa.waitForSelector('#liste li[data-no="TR75433002"]');
  assert.equal(await sayfa.locator('#liste li').count(), 1);
});

test('ilKoduSoldaTRileBitisikseOkunur', async (t) => {
  // Logo ve sağdaki il kodu kapatılıp il kodu "TR"nin hemen yanına taşınmış: "TR00".
  const suzgec = `${KUPE},split[a][b];[b]crop=52:38:144:30[il];`
    + `[a]drawbox=x=88:y=12:w=124:h=52:color=${SARI}:t=fill[c];[c][il]overlay=74:30,${ORTADA}`;
  const sayfa = await ac('solda', suzgec);
  if (!sayfa) return t.skip('ffmpeg yok');
  await sayfa.waitForSelector('#onay[open]', { timeout: 60000 });
  await sayfa.screenshot({ path: join(tmpdir(), 'kupe-solda-ekran.png') });
  assert.equal(await sayfa.textContent('#onay-numara'), 'TR00433002');
});

test('sariGorunmeyenKupeRakamlarindanBulunur', async (t) => {
  // Renksiz görüntü (sarı seçilemez) ve küpe ortadaki kılavuzun dışında: rakam satırı görüntünün
  // tamamında aranıp bulunur. Ortadaki kılavuz küpeyi kestiği için oradan okuma yapılmaz.
  const sayfa = await ac('renksiz', `${KUPE},hue=s=0,scale=300:231,pad=1280:720:270:15:color=0xd8d8d8`);
  if (!sayfa) return t.skip('ffmpeg yok');
  await sayfa.waitForSelector('#onay[open]', { timeout: 60000 });
  await sayfa.screenshot({ path: join(tmpdir(), 'kupe-renksiz-ekran.png') });
  assert.equal(await sayfa.textContent('#onay-numara'), 'TR00433002');
  assert.match(await sayfa.textContent('#tani'), /yazı \d+×\d+ tamam/);
});
