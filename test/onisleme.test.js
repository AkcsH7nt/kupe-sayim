import { test } from 'node:test';
import assert from 'node:assert/strict';
import { griVeKontrast, cevir180 } from '../lib/onisleme.js';

const rgba = (...pikseller) => new Uint8ClampedArray(pikseller.flatMap((p) => [...p, 255]));

test('sariBeyazKoyuSiyah', () => {
  const sari = [255, 220, 0];
  const koyu = [60, 60, 60];
  const sonuc = griVeKontrast(rgba(sari, koyu, sari, koyu), 4, 1);
  assert.deepEqual([sonuc[0], sonuc[4], sonuc[8], sonuc[12]], [255, 0, 255, 0]);
  assert.equal(sonuc[3], 255);
  assert.equal(sonuc[1], sonuc[0]);
});

test('cevir180', () => {
  const sonuc = cevir180(rgba([1, 2, 3], [4, 5, 6]), 2, 1);
  assert.deepEqual([...sonuc], [4, 5, 6, 255, 1, 2, 3, 255]);
});

