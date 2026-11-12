// node_modules'tan çevrimdışı çalışma için gereken dosyaları vendor/ altına kopyalar.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const nm = 'node_modules';
const hedef = 'vendor';
mkdirSync(hedef, { recursive: true });

const dosyalar = [
  ['tesseract.js/dist/tesseract.min.js', 'tesseract.min.js'],
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  // Yalnız LSTM içeren küçük model (2.9 MB); 4.0.0 sürümü eski motoru da taşıdığı için 11 MB.
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
  ['zxing-wasm/dist/iife/reader/index.js', 'zxing-reader.js'],
  ['zxing-wasm/dist/reader/zxing_reader.wasm', 'zxing_reader.wasm'],
];

for (const [kaynak, ad] of dosyalar) {
  copyFileSync(join(nm, kaynak), join(hedef, ad));
  console.log('kopyalandı', ad);
}
