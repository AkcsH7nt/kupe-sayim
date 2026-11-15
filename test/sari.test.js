import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sariMi, kupeAdaylari, kupeDisiniBeyazla } from '../lib/sari.js';

// w×h gri zemin üzerine verilen dikdörtgenleri boyar: [x0, y0, x1, y1, [r, g, b]]
function resim(w, h, kutular, zemin = [120, 120, 120]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set([...zemin, 255], i * 4);
  for (const [x0, y0, x1, y1, renk] of kutular) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) d.set([...renk, 255], (y * w + x) * 4);
  }
  return d;
}
const SARI = [230, 200, 30];

test('sariMiKupeRenkleri', () => {
  assert.equal(sariMi(230, 200, 30), true);   // güneşte küpe
  assert.equal(sariMi(140, 120, 30), true);   // gölgede küpe
  assert.equal(sariMi(240, 190, 40), true);   // sarı ışık altında küpe
});

test('sariMiKupeOlmayanlar', () => {
  assert.equal(sariMi(120, 120, 120), false); // gri duvar
  assert.equal(sariMi(250, 250, 250), false); // beyaz
  assert.equal(sariMi(20, 20, 10), false);    // siyah yazı
  assert.equal(sariMi(150, 90, 50), false);   // kahverengi tüy
  assert.equal(sariMi(200, 170, 100), false); // saman
  assert.equal(sariMi(60, 160, 60), false);   // yeşil
  assert.equal(sariMi(60, 50, 10), false);    // çok karanlık
});

test('ortadakiKupeBulunur', () => {
  const a = kupeAdaylari(resim(160, 120, [[50, 30, 99, 69, SARI]]), 160, 120);
  assert.equal(a.length, 1);
  assert.deepEqual([a[0].x0, a[0].y0, a[0].x1, a[0].y1], [50, 30, 99, 69]);
});

test('uzerindeYaziOlanKupeTekParcaBulunur', () => {
  // Küpenin içindeki koyu rakamlar kutuyu bölmez.
  const a = kupeAdaylari(resim(160, 120, [[50, 30, 99, 69, SARI], [58, 45, 62, 60, [20, 20, 20]], [70, 45, 74, 60, [20, 20, 20]]]), 160, 120);
  assert.equal(a.length, 1);
  assert.deepEqual([a[0].x0, a[0].x1], [50, 99]);
});

test('koyuBantlaBolunenKupeTekKutuOlur', () => {
  // Sahada görülen hata: barkod/gölge küpeyi ikiye bölünce kutu yalnız barkodlu üst parçayı alıyordu.
  const a = kupeAdaylari(resim(160, 120, [[50, 30, 99, 79, SARI], [50, 48, 99, 52, [25, 25, 25]]]), 160, 120);
  assert.equal(a.length, 1);
  assert.deepEqual([a[0].x0, a[0].y0, a[0].x1, a[0].y1], [50, 30, 99, 79]);
});

test('yanYanaBolunenKupeTekKutuOlur', () => {
  const a = kupeAdaylari(resim(160, 120, [[40, 30, 109, 79, SARI], [72, 30, 75, 79, [25, 25, 25]]]), 160, 120);
  assert.equal(a.length, 1);
  assert.deepEqual([a[0].x0, a[0].x1], [40, 109]);
});

test('caprazDuranSarilarBirlesmez', () => {
  // Biri diğerinin ne altında ne yanında: ayrı nesneler.
  const a = kupeAdaylari(resim(160, 120, [[20, 15, 59, 44, SARI], [62, 47, 101, 76, SARI]]), 160, 120);
  assert.equal(a.length, 2);
});

test('kenaraDegenKupeAlinmaz', () => {
  // Görüntünün kenarında kesilen küpenin rakamı eksik okunabilir; tamamı görünene dek beklenir.
  assert.equal(kupeAdaylari(resim(160, 120, [[0, 30, 49, 69, SARI]]), 160, 120).length, 0);
  assert.equal(kupeAdaylari(resim(160, 120, [[50, 90, 99, 119, SARI]]), 160, 120).length, 0);
});

test('kucukLekeVeInceSeritAlinmaz', () => {
  assert.equal(kupeAdaylari(resim(160, 120, [[50, 30, 55, 35, SARI]]), 160, 120).length, 0);
  assert.equal(kupeAdaylari(resim(160, 120, [[10, 50, 150, 55, SARI]]), 160, 120).length, 0);
});

test('ikiKupedeBuyukOlanOnce', () => {
  const a = kupeAdaylari(resim(160, 120, [[10, 10, 39, 34, SARI], [70, 40, 139, 99, SARI]]), 160, 120);
  assert.equal(a.length, 2);
  assert.equal(a[0].x0, 70);
  assert.equal(a[1].x0, 10);
});

test('sariYoksaAdayYok', () => {
  assert.equal(kupeAdaylari(resim(160, 120, [[50, 30, 99, 69, [200, 170, 100]]]), 160, 120).length, 0);
});

test('kupeDisiBeyazlanirIciKalir', () => {
  // 80×60: kahverengi zemin, ortada sarı küpe (10..69 × 10..49), küpenin içinde koyu rakam,
  // küpenin hemen dışında koyu zemin. Okumadan önce küpe dışı beyaz olmalı, rakam kalmalı.
  const w = 80, h = 60;
  const renkli = resim(w, h, [[10, 10, 69, 49, SARI], [30, 20, 34, 39, [20, 20, 20]]], [110, 95, 70]);
  const siyahBeyaz = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const koyu = renkli[i * 4 + 2] < 100 && renkli[i * 4] < 160; // zemin ve rakam koyu, sarı açık
    siyahBeyaz.fill(koyu ? 0 : 255, i * 4, i * 4 + 3); siyahBeyaz[i * 4 + 3] = 255;
  }
  assert.equal(kupeDisiniBeyazla(renkli, siyahBeyaz, w, h), true);
  const px = (x, y) => siyahBeyaz[(y * w + x) * 4];
  assert.equal(px(2, 2), 255);   // zemin beyazlandı
  assert.equal(px(9, 30), 255);  // küpenin hemen dışı beyazlandı
  assert.equal(px(32, 30), 0);   // rakam duruyor
});

test('kupeKenarindakiIncePusDeligiRakamiSizdirmaz', () => {
  // Küpenin kenarında 2 px'lik koyu çentik rakama değiyor; rakam yine de silinmemeli.
  const w = 80, h = 60;
  const renkli = resim(w, h, [[10, 10, 69, 49, SARI], [30, 20, 34, 39, [20, 20, 20]], [30, 10, 31, 20, [20, 20, 20]]], [110, 95, 70]);
  const siyahBeyaz = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const koyu = renkli[i * 4 + 2] < 100 && renkli[i * 4] < 160;
    siyahBeyaz.fill(koyu ? 0 : 255, i * 4, i * 4 + 3); siyahBeyaz[i * 4 + 3] = 255;
  }
  kupeDisiniBeyazla(renkli, siyahBeyaz, w, h);
  assert.equal(siyahBeyaz[(30 * w + 32) * 4], 0);
});

test('sariAzsaDokunulmaz', () => {
  // Renksiz/karanlık fotoğrafta küpe seçilemez: görüntü olduğu gibi kalır.
  const w = 40, h = 30;
  const renkli = resim(w, h, [], [120, 120, 120]);
  const siyahBeyaz = new Uint8ClampedArray(w * h * 4).fill(0);
  assert.equal(kupeDisiniBeyazla(renkli, siyahBeyaz, w, h), false);
  assert.equal(siyahBeyaz[0], 0);
});

test('kirpintiKenarindaKesilenRakamSilinmez', () => {
  // Kırpıntı küpeyi kesiyor: kenardaki yarım rakam küçük bir koyu bölge; zemin sanılıp silinirse satır
  // kısa ama "tam" görünür ve yanlış numara okunur. Kalmalı (okuyucu onu "kenarda kesik" sayar).
  const w = 80, h = 60;
  const renkli = resim(w, h, [[0, 10, 69, 49, SARI], [0, 20, 3, 39, [20, 20, 20]]], [110, 95, 70]);
  const siyahBeyaz = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const koyu = renkli[i * 4 + 2] < 100 && renkli[i * 4] < 160;
    siyahBeyaz.fill(koyu ? 0 : 255, i * 4, i * 4 + 3); siyahBeyaz[i * 4 + 3] = 255;
  }
  kupeDisiniBeyazla(renkli, siyahBeyaz, w, h);
  assert.equal(siyahBeyaz[(30 * w + 1) * 4], 0);  // yarım rakam duruyor
  assert.equal(siyahBeyaz[(55 * w + 40) * 4], 255); // zemin beyaz
});

test('golgeliKupeParcasiZeminSanilmaz', () => {
  // Küpenin alt yarısı gölgede: sarı değil ama açık renkli, içinde rakam var. Silinmemeli; silinecek
  // zemin çoğunlukla koyudur (tüy, toprak), gölgeli küpe ise çoğunlukla açık.
  const w = 80, h = 60;
  const renkli = resim(w, h, [[10, 10, 69, 49, SARI], [10, 30, 69, 59, [170, 170, 170]], [30, 35, 34, 52, [20, 20, 20]]], [40, 35, 30]);
  const siyahBeyaz = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const koyu = renkli[i * 4] < 100;
    siyahBeyaz.fill(koyu ? 0 : 255, i * 4, i * 4 + 3); siyahBeyaz[i * 4 + 3] = 255;
  }
  kupeDisiniBeyazla(renkli, siyahBeyaz, w, h);
  assert.equal(siyahBeyaz[(45 * w + 32) * 4], 0); // gölgedeki rakam duruyor
});
