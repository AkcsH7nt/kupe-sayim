# Küpe Sayım Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Telefonda çevrimdışı çalışan, sarı küpeyi barkod veya rakamdan okuyup sayım listesi çıkaran HTML uygulaması.

**Architecture:** Derleme adımı olmayan düz HTML + ES modülleri. Saf mantık (`lib/kupe.js`, `lib/liste.js`) Node testleriyle; kamera/okuma (`lib/okuyucu.js`) tarayıcıda Playwright ile örnek küpe görüntüsü üzerinden doğrulanır. Service worker tüm dosyaları önbelleğe alır.

**Tech Stack:** HTML/CSS/JS (ES2022), tesseract.js 7 (yerel worker + core wasm + `eng` hızlı veri), zxing-wasm 3 (yerel wasm), `BarcodeDetector` (varsa), `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-kupe-sayim-design.md`

## Global Constraints

- Kayıt biçimi: `TR` + 2 küçük hane + 6 büyük hane, boşluksuz: `TR00433001`. Numaralar her yerde **string** (baştaki sıfırlar korunur).
- `TR` OCR ile okunmaz; Tesseract whitelist yalnız `0123456789`.
- Fotoğraf/kare hiçbir yere kaydedilmez (localStorage, IndexedDB, indirme yok).
- Çalışma zamanında ağ isteği yok: tüm kütüphane, wasm ve dil verisi `vendor/` altından.
- Oylama eşikleri: rakam okuma art arda **3** aynı sonuç; barkod art arda **2**; barkod ve rakam aynı numarayı verirse anında kabul.
- Arayüz metni Türkçe; düğmeler en az 56 px yükseklik, ana düğmeler ekranın alt yarısında; 360 px genişlikte yatay kaydırma yok.
- Android Chrome ve iOS Safari'de çalışır.

## Review Focus

1. Tesseract "TR 00"daki harfleri rakam sanar ("7800 433001") → yine `TR00433001` çıkmalı (Task 1 testi `harfleriRakamSanmaToleransi`).
2. Kısmi okuma (5 veya 7 büyük hane, yalnız 6 hane, küçük hane yok) → kabul edilmemeli, `null` (Task 1 testi `eksikHaneReddedilir`).
3. Düşen küpenin eski numarası sonradan okutulursa (yerden bulunan küpe) → listeye eklenmez, "hariç: düşen küpe" uyarısı (Task 2 testi `eskiKupeOkununcaHaric`).
4. Sayım ortasında sayfa yenilenir / telefon kilitlenir → liste geri gelir; depolama hata verirse uygulama çökmez, uyarı gösterir (Task 2 testleri `kaliciDepolama`, `depolamaHatasiCokmez`).
5. Kamera izni reddedilir veya kamera yok → elle giriş ve liste çalışmaya devam eder (Task 4 Playwright adımı).

---

### Task 1: Numara ayıklama ve oylama (`lib/kupe.js`)

**Files:**
- Create: `package.json` (`"type":"module"`, script `"test": "node --test test/"`), `.gitignore` (`node_modules/`)
- Create: `lib/kupe.js`
- Test: `test/kupe.test.js`

**Interfaces:**
- Produces:
  - `ocrMetnindenNumara(metin: string): string | null` — Tesseract çıktısından `TR########`.
  - `barkoddanNumara(icerik: string): string | null` — barkod metnindeki rakamlardan son 8 hane (≥8 hane yoksa `null`).
  - `class Oylayici { constructor({rakamEsik=3, barkodEsik=2}); ekle(numara: string|null, kaynak: 'rakam'|'barkod'): string|null; sifirla(): void }` — kabul edilen numarayı döndürür, aksi halde `null`. `null` girdi seriyi bozar. Kabulden sonra seri sıfırlanır.

- [ ] **Step 1: Write the failing tests** (`test/kupe.test.js`, `node:test` + `assert/strict`)
  - `ikiSatir`: `ocrMetnindenNumara("00\n433001")` → `"TR00433001"`
  - `barkodGurultusu`: `ocrMetnindenNumara("00\n1111 11\n433001\n")` → `"TR00433001"`
  - `harfleriRakamSanmaToleransi`: `ocrMetnindenNumara("7800\n433002")` → `"TR00433002"` (6 haneli grubun önündeki grubun **son 2** hanesi)
  - `tekSatirBitisik`: `ocrMetnindenNumara("00433001")` → `"TR00433001"`
  - `eksikHaneReddedilir`: `"00\n43300"`, `"00\n4330011"`, `"433001"`, `""` → hepsi `null`
  - `barkod`: `barkoddanNumara("TR00433001")` → `"TR00433001"`; `barkoddanNumara("TR 00 433001")` → aynı; `barkoddanNumara("12345")` → `null`
  - `oylamaRakam`: aynı numara rakamdan 2 kez → `null`, 3. kez → numara
  - `oylamaSeriBozulur`: A, A, B, A (rakam) → hepsi `null`
  - `oylamaBarkod`: barkoddan 2 kez → numara
  - `capraz`: rakamdan A sonra barkoddan A → ikincide numara
  - `nullSeriyiBozar`: A, null, A, A (rakam) → son çağrı `null`

- [ ] **Step 2:** `node --test test/` → FAIL (modül yok)

- [ ] **Step 3: Implement** — `ocrMetnindenNumara`: yalnız rakam ve satır sonu/boşluk tut; rakam gruplarını çıkar. Tam 8 haneli grup varsa onu al. Yoksa tam 6 haneli **son** grubu ana numara kabul et; ondan önceki grup ≥2 haneyse son 2 hanesi il kodu; değilse `null`.

- [ ] **Step 4:** `node --test test/` → PASS

- [ ] **Step 5:** `git init` (ilk görevde), commit `feat: küpe numarası ayıklama ve oylama`

### Task 2: Sayım listesi (`lib/liste.js`)

**Files:**
- Create: `lib/liste.js`
- Test: `test/liste.test.js`

**Interfaces:**
- Consumes: yok (numaralar string).
- Produces: `class SayimListesi { constructor(depo: {getItem,setItem}|null, anahtar='kupe-sayim-v1') }`
  - `ekle(no: string, kaynak: 'barkod'|'rakam'|'elle'): {durum: 'eklendi'|'zaten'|'haric', kayit?}`
  - `supheliMi(no: string): boolean` — listede ≥3 kayıt varken hiçbir kaydın `slice(2,6)`'sı (il kodu + seri numaranın ilk 2 hanesi) `no.slice(2,6)` ile eşleşmiyorsa `true`.
  - `asiDegistir(no: string): void`
  - `eskiKupeBagla(yeniNo: string, eskiNo: string): void` — eski numara listedeyse çıkarılır, hariç kümesine girer.
  - `sil(no: string): void`
  - `kayitlar(): Array<{no, asi: boolean, eskiNo: string|null, zaman: number, kaynak}>` — `no`'ya göre artan sıralı.
  - `csv(): string` — başlık `No;Aşı;Eski küpe;Saat`, `;` ayraç, UTF-8 BOM ile başlar, aşı `Evet`/`Hayır`.
  - `paylasimMetni(tarih: Date): string` — `Sayım 13.11.2026 – N hayvan` + her satır `TR00433001 ✓` / `TR00433017 – (eski TR00432990 düştü)`.
  - `temizle(): void`
  - `sonHata: string|null` — depolama yazımı patlarsa mesaj.

- [ ] **Step 1: Write the failing tests** (sahte depo: `Map` tabanlı `{getItem,setItem}`)
  - `ekleVeZaten`: aynı no iki kez → `eklendi`, sonra `zaten`; `kayitlar().length === 1`
  - `sirali`: `TR00433002`, `TR00433001` eklenir → kayıtlar 001, 002 sırasında
  - `asi`: `asiDegistir` iki kez → `false→true→false`
  - `eskiKupeBagla`: 001 ve 055 eklenir, `eskiKupeBagla('TR00433055','TR00433001')` → liste yalnız 055, `eskiNo === 'TR00433001'`
  - `eskiKupeOkununcaHaric`: bağlamadan sonra `ekle('TR00433001')` → `haric`, liste değişmez
  - `supheli`: 433001/002/003 eklenmişken `supheliMi('TR00488001')` → `true`, `supheliMi('TR00433099')` → `false`; 2 kayıtla → `false`
  - `csvBicim`: `\uFEFF` ile başlar, ikinci satır `TR00433001;Evet;;HH:MM` deseni
  - `paylasim`: ilk satır `Sayım 13.11.2026 – 2 hayvan`
  - `kaliciDepolama`: aynı depo ile yeni `SayimListesi` → aynı kayıtlar ve hariç kümesi
  - `depolamaHatasiCokmez`: `setItem` hata fırlatan depo → `ekle` yine `eklendi`, `sonHata` dolu
  - `bozukVeri`: depoda geçersiz JSON → boş liste, hata fırlatmaz

- [ ] **Step 2:** `node --test test/` → FAIL
- [ ] **Step 3:** Implement; durum `{kayitlar: {}, haric: []}` JSON olarak her değişiklikte yazılır.
- [ ] **Step 4:** `node --test test/` → PASS
- [ ] **Step 5:** Commit `feat: sayım listesi, aşı, düşen küpe, CSV`

### Task 3: Kamera ve okuyucu (`lib/okuyucu.js`, `vendor/`)

**Files:**
- Create: `scripts/vendor.mjs` — `npm i -D tesseract.js@7 tesseract.js-core@7 zxing-wasm@3 @tesseract.js-data/eng` sonrası gerekli dosyaları `vendor/` altına kopyalar: `tesseract.min.js`, `worker.min.js`, core `*.wasm.js` (SIMD ve SIMD'siz LSTM sürümleri), `eng.traineddata.gz` (4.0.0_best_int değil **hızlı** sürüm tercih; yoksa mevcut olan), zxing-wasm reader ESM + `.wasm`.
- Create: `lib/okuyucu.js`, `lib/onisleme.js`
- Test: `test/onisleme.test.js`, `test/tarayici/ornek.spec.mjs` (Playwright), `test/tarayici/kupe-ornek.webp` (kullanıcının gönderdiği görsel: `C:\Users\brof-\.claude\uploads\9c871ef9-deb8-4658-b0a0-16983a55db4d\4da11acb-image.webp`)

**Interfaces:**
- Consumes: `ocrMetnindenNumara`, `barkoddanNumara`, `Oylayici` (Task 1).
- Produces:
  - `griVeKontrast(data: Uint8ClampedArray, w, h): Uint8ClampedArray` (`lib/onisleme.js`) — RGBA → gri, min-max germe, Otsu eşik; 180° çevirme için `cevir180(data, w, h)`.
  - `class Okuyucu { constructor({video: HTMLVideoElement, onNumara: (no, kaynak) => void, onDurum: (metin) => void}); async baslat(): Promise<void>; durdur(): void; async fener(acik: boolean): Promise<boolean>; async goruntuOku(kaynak: CanvasImageSource): Promise<{barkod: string|null, rakam: string|null}> }`
  - Kamera: `facingMode: 'environment'`, 1280×720 ideal, `focusMode: 'continuous'` destekleniyorsa. Döngü: ~3 kare/sn; çerçeve = videonun ortasındaki %70 genişlik × %45 yükseklik; önce barkod, sonra ön işlenmiş kırpıntıda Tesseract (`tessedit_char_whitelist: '0123456789'`, PSM 6); sonuç yoksa 180° çevrilmiş kırpıntı denenir. Kabul `Oylayici` ile; kabulden sonra 1,5 sn bekleme.
  - Barkod: `'BarcodeDetector' in window` ve `code_128` destekliyse o; değilse zxing-wasm `readBarcodes` (`formats: ['Code128','Code39','EAN-13','ITF']`).

- [ ] **Step 1:** `test/onisleme.test.js` — `griVeKontrast`: sarı (255,220,0) ve koyu (60,60,60) piksellerden oluşan 4×1 görüntü → sarılar 255, koyular 0; `cevir180` 2×1'de pikselleri yer değiştirir. Çalıştır → FAIL.
- [ ] **Step 2:** `lib/onisleme.js` implement → `node --test test/` PASS.
- [ ] **Step 3:** `node scripts/vendor.mjs` → `vendor/` dolu; `vendor/` git'e eklenir (çevrimdışı dağıtım için).
- [ ] **Step 4:** `lib/okuyucu.js` implement. Tesseract worker yolları: `workerPath: 'vendor/worker.min.js'`, `corePath: 'vendor/'`, `langPath: 'vendor/'`, `cacheMethod: 'none'`, `gzip: true`.
- [ ] **Step 5:** `test/tarayici/ornek.spec.mjs` — basit statik sunucu (`node scripts/sunucu.mjs`, port 5180) üzerinden `test/tarayici/okuma.html` açılır; örnek görüntünün 1. küpesi (x 0–25 %, y 25–55 %) kırpılıp `goruntuOku` çağrılır → `rakam === 'TR00433001'`; 3. küpe → `'TR00433002'`; alt (ters) yarı kırpıntısı → `'TR00433001'`. Ağ: test başında `page.route('**/*', ...)` ile `localhost` dışı istekler engellenir ve hiç dış istek olmadığı doğrulanır.
- [ ] **Step 6:** Çalıştır → PASS. Kalmazsa ön işleme / PSM ayarlanır (spec: parametreler uygulayıcıya bırakıldı).
- [ ] **Step 7:** Commit `feat: kamera, barkod ve çevrimdışı rakam okuma`

### Task 4: Arayüz (`index.html`, `app.js`, `style.css`)

**Files:**
- Create: `index.html`, `app.js`, `style.css`
- Test: `test/tarayici/arayuz.spec.mjs`

**Interfaces:**
- Consumes: `SayimListesi` (Task 2), `Okuyucu` (Task 3).
- Ekranlar (tek sayfa, iki sekme altta): **Okut** ve **Liste**.
  - Okut: tam ekran video, ortada çerçeve; üstte sayaç `N hayvan`; son okunan numara büyük yazı; altta `Fener`, `Elle yaz`. Okunan → yeşil flaş, `navigator.vibrate(80)`, WebAudio kısa bip; `zaten` → sarı uyarı + çift titreşim; `haric` → kırmızı uyarı "Düşen küpe – sayılmaz". `supheliMi` (yalnız `rakam` kaynağında) → "TR00488001 doğru mu?" Evet/Hayır.
  - Son okunan satırında `Aşı ✓` düğmesi ve `Eski küpesi düştü` düğmesi (tuş takımıyla 8 hane girilir).
  - Elle yaz: 0–9 büyük tuş takımı, 8 hane, `TR` sabit gösterilir.
  - Liste: sıralı satırlar (no, aşı düğmesi, eski no, sil — sil onay ister); altta `Paylaş` (`navigator.share({text})`, yoksa panoya kopyala), `Excel indir` (CSV Blob, `kupe-sayim-YYYY-MM-DD.csv`), `Yeni sayım` (onaylı `temizle`).
  - Kamera hatası → Okut ekranında "Kamera açılamadı – Elle yaz kullanın", diğer her şey çalışır.

- [ ] **Step 1:** `arayuz.spec.mjs` yaz: Playwright, sahte kamera kapalı (izin reddi) → hata metni görünür; `Elle yaz` ile `00433001` → Liste'de `TR00433001`; aynısı tekrar → "zaten okundu"; aşı düğmesi → satırda ✓; sayfa yenile → kayıt duruyor; `Excel indir` → indirilen dosya `\uFEFFNo;Aşı` ile başlar; 360×740 görünümde `document.documentElement.scrollWidth <= 360`.
- [ ] **Step 2:** Çalıştır → FAIL
- [ ] **Step 3:** Implement
- [ ] **Step 4:** Çalıştır → PASS; ayrıca `node --test test/` PASS
- [ ] **Step 5:** Commit `feat: okutma ve liste arayüzü`

### Task 5: Çevrimdışı (service worker + manifest)

**Files:**
- Create: `sw.js`, `manifest.webmanifest`, `ikon.svg`, `ikon-192.png`, `ikon-512.png`
- Modify: `index.html` (manifest bağlantısı, SW kaydı)
- Test: `test/tarayici/cevrimdisi.spec.mjs`

**Interfaces:**
- `sw.js`: `install`'da sabit `DOSYALAR` listesinin tamamını `kupe-sayim-v1` önbelleğine al (vendor wasm ve traineddata dahil); `fetch`'te önce önbellek. Sürüm değişince eski önbellekleri sil.
- Uygulama, okuyucu hazır olunca ekranda "Çevrimdışı hazır ✓" gösterir (tüm dosyalar önbellekteyse).

- [ ] **Step 1:** Test: sayfa açılır, SW etkinleşmesi beklenir, `context.setOffline(true)`, yenilenir → arayüz yüklenir, `goruntuOku` örnek kırpıntıda `TR00433001` döndürür.
- [ ] **Step 2:** FAIL → implement → PASS
- [ ] **Step 3:** Commit `feat: çevrimdışı çalışma`

### Task 6: Yayın ve telefonda deneme

- [ ] **Step 1:** Kullanıcıya sor: GitHub'da public `kupe-sayim` deposu + GitHub Pages açılsın mı? (Kodda kişisel veri yok.) Onay yoksa durulur.
- [ ] **Step 2:** Onayla: depo oluştur, push, Pages'i `main` kökünden aç; adres çalışınca kullanıcıya bağlantı + kısa kullanım notu (ilk açılışı internetliyken yap, "Çevrimdışı hazır ✓" görmeden ahıra girme, ana ekrana ekle).
- [ ] **Step 3:** README.md'ye (kısa) kullanım ve sahada deneme kontrol listesi: barkod içeriği ne çıktı, okuma süresi, karanlıkta fener.
