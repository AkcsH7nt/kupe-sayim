// Geliştirme ve test için basit statik sunucu. Kullanım: node scripts/sunucu.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const kok = resolve(process.cwd());
const port = Number(process.argv[2] ?? process.env.PORT ?? 5180);
const turler = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm', '.gz': 'application/octet-stream', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg',
};

export function sunucuBaslat(p = port) {
  const s = createServer(async (istek, yanit) => {
    try {
      let yolu = decodeURIComponent(new URL(istek.url, 'http://x').pathname);
      if (yolu.endsWith('/')) yolu += 'index.html';
      const dosya = normalize(join(kok, yolu));
      if (!dosya.startsWith(kok)) throw new Error('yasak');
      if (!(await stat(dosya)).isFile()) throw new Error('yok');
      yanit.writeHead(200, { 'Content-Type': turler[extname(dosya)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      yanit.end(await readFile(dosya));
    } catch {
      yanit.writeHead(404); yanit.end('bulunamadı');
    }
  });
  return new Promise((r) => s.listen(p, () => r(s)));
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('sunucu.mjs')) {
  sunucuBaslat().then(() => console.log(`http://localhost:${port}`));
}
