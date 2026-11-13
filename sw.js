// Çevrimdışı çalışma: uygulamanın tüm dosyaları (okuma modeli dahil) ilk açılışta telefona kaydedilir.
// Dosyalardan biri değişince SURUM artırılmalı.
const SURUM = 'kupe-sayim-v5';
const DOSYALAR = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'ikon.svg', 'ikon-192.png', 'ikon-512.png', 'apple-touch-icon.png',
  'lib/kupe.js', 'lib/liste.js', 'lib/onisleme.js', 'lib/bolutleme.js', 'lib/okuyucu.js', 'lib/cerceve.js',
  'vendor/tesseract.min.js', 'vendor/worker.min.js',
  'vendor/tesseract-core-simd-lstm.wasm.js', 'vendor/tesseract-core-lstm.wasm.js',
  'vendor/eng.traineddata.gz', 'vendor/zxing-reader.js', 'vendor/zxing_reader.wasm',
];

self.addEventListener('install', (o) => {
  // cache: 'reload' → tarayıcının HTTP önbelleğindeki eski dosyalar yeni sürüme karışmasın.
  o.waitUntil(caches.open(SURUM)
    .then((c) => c.addAll(DOSYALAR.map((d) => new Request(d, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (o) => {
  o.waitUntil((async () => {
    for (const ad of await caches.keys()) if (ad !== SURUM) await caches.delete(ad);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (o) => {
  if (o.request.method !== 'GET') return;
  o.respondWith((async () => {
    const onbellek = await caches.open(SURUM);
    const istek = o.request.mode === 'navigate' ? './' : o.request;
    const kayitli = await onbellek.match(istek, { ignoreSearch: true, ignoreVary: true });
    return kayitli ?? fetch(o.request);
  })());
});

// Uygulama "hazır mı?" diye sorar: tüm dosyalar önbellekte mi?
self.addEventListener('message', (o) => {
  if (o.data !== 'hazirMi') return;
  o.waitUntil((async () => {
    const onbellek = await caches.open(SURUM);
    const eksik = (await Promise.all(DOSYALAR.map((d) => onbellek.match(d)))).filter((r) => !r).length;
    o.source.postMessage({ hazir: eksik === 0, eksik, surum: SURUM.split('-v')[1] });
  })());
});
