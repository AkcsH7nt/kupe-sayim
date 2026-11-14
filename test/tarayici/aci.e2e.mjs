// Eğik duran küpe: örnek küpe farklı açılarda döndürülüp sahte kameraya verilir. Her açıda doğru numara
// sorulmalı; yanlış numara asla sorulmamalı (eskiden 10–15° eğikte yanlış okuyordu). ffmpeg yoksa atlanır.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { sunucuBaslat } from '../../scripts/sunucu.mjs';

const PORT = 5196;
const klasor = mkdtempSync(join(tmpdir(), 'kupe-aci-'));
let sunucu;
const KUPE = 'crop=260:200:505:385,scale=546:420,pad=1280:720:367:150:color=0xd8d8d8';

after(() => sunucu?.close());

for (const aci of [10, -15, 25, 40, -60, 90, 135, -160]) {
  test(`egikKupeDogruOkunur ${aci}°`, async (t) => {
    const video = join(klasor, `aci${aci}.y4m`);
    try {
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', 'test/tarayici/kupe-ornek.webp',
        '-vf', `${KUPE},rotate=${aci}*PI/180:c=0xd8d8d8`, '-t', '1', '-r', '10', '-pix_fmt', 'yuv420p', video]);
    } catch { return t.skip('ffmpeg yok'); }
    sunucu ??= await sunucuBaslat(PORT);
    const tarayici = await chromium.launch({
      channel: 'chrome',
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
    });
    try {
      const baglam = await tarayici.newContext({ viewport: { width: 390, height: 844 } });
      await baglam.grantPermissions(['camera']);
      const sayfa = await baglam.newPage();
      await sayfa.goto(`http://localhost:${PORT}/`);
      await sayfa.waitForSelector('#onay[open]', { timeout: 60000 });
      const numara = await sayfa.textContent('#onay-numara');
      if (numara !== 'TR00433002') await sayfa.screenshot({ path: join(klasor, `aci${aci}.png`) });
      assert.equal(numara, 'TR00433002', await sayfa.textContent('#tani'));
    } finally {
      await tarayici.close();
    }
  });
}
