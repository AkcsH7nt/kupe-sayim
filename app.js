// Küpe Sayım: ekran mantığı. Okunan küpeler yalnız numara olarak telefonda saklanır.
// Akış: kamera küpeyi kendisi okur → "doğru mu?" diye sorar → Doğru denince kameranın altındaki listeye düşer.
import { SayimListesi, SayimArsivi, dusmusMu, ozet, csvMetni, paylasimMetni } from './lib/liste.js';
import { Okuyucu } from './lib/okuyucu.js';
import { cerceveKutusu } from './lib/cerceve.js';

const $ = (s) => document.querySelector(s);
const depo = (() => { try { return window.localStorage; } catch { return null; } })();
const liste = new SayimListesi(depo);
const arsiv = new SayimArsivi(depo);

const el = {
  sayac: $('#sayac'), durum: $('#durum'), video: $('#video'), kamera: $('#kamera'), cerceve: $('#cerceve'),
  kameraAc: $('#kamera-ac'), zoom: $('#zoom'), fener: $('#fener'), elleYaz: $('#elle-yaz'), kaydet: $('#kaydet'),
  liste: $('#liste'), listeBos: $('#liste-bos'), sayimlar: $('#sayimlar'), sayimlarBos: $('#sayimlar-bos'),
  bildirim: $('#bildirim'), tusPaneli: $('#tus-paneli'), tusDeger: $('#tus-deger'), tusEkle: $('#tus-ekle'),
  onay: $('#onay'), onayMetin: $('#onay-metin'), onayNumara: $('#onay-numara'), onayIl: $('#onay-il'),
  onaySira: $('#onay-sira'), onayNot: $('#onay-not'), onayEvet: $('#onay-evet'), onayHayir: $('#onay-hayir'),
};

const iki = (n) => String(n).padStart(2, '0');

// ---------- Geri bildirim ----------
let sesBaglami = null;
// Ses, ilk dokunuşta açılır (iPhone ve Chrome, kullanıcı dokunmadan sesi başlatmaz).
function sesHazirla() {
  try {
    sesBaglami ??= new (window.AudioContext || window.webkitAudioContext)();
    if (sesBaglami.state === 'suspended') sesBaglami.resume();
  } catch { /* ses yok */ }
}
document.addEventListener('pointerdown', sesHazirla, { capture: true });
function bip(frekans = 1200, sure = 0.09) {
  try {
    if (!sesBaglami) return;
    if (sesBaglami.state === 'suspended') sesBaglami.resume();
    const o = sesBaglami.createOscillator(), g = sesBaglami.createGain();
    o.frequency.value = frekans; g.gain.value = 0.25;
    o.connect(g).connect(sesBaglami.destination);
    o.start(); o.stop(sesBaglami.currentTime + sure);
  } catch { /* ses yok */ }
}
const titre = (desen) => { try { navigator.vibrate?.(desen); } catch { /* yok */ } };

let bildirimZamani;
function bildir(metin, tur = 'basari') {
  el.bildirim.textContent = metin;
  el.bildirim.className = `bildirim gorunur ${tur}`;
  clearTimeout(bildirimZamani);
  bildirimZamani = setTimeout(() => el.bildirim.classList.remove('gorunur'), 2500);
}

function durum(metin) { el.durum.textContent = metin; }

// ---------- Kameranın altındaki liste ----------
let vurgulanan = null; // bir sonraki çizimde yeşil yanıp sönecek satır

function ciz() {
  const kayitlar = liste.yenidenEskiye();
  el.sayac.textContent = `${kayitlar.length} hayvan`;
  el.listeBos.hidden = kayitlar.length > 0;
  el.kaydet.disabled = kayitlar.length === 0;
  el.liste.replaceChildren(...kayitlar.map((k) => {
    const li = document.createElement('li');
    li.dataset.no = k.no;
    li.innerHTML = `
      <span class="no"></span>
      <button class="asi"></button>
      <button class="dustu"></button>
      <button class="sil">✕</button>
      <span class="eski"></span>`;
    li.querySelector('.no').textContent = k.no;
    const asi = li.querySelector('.asi'), dustu = li.querySelector('.dustu'), eski = li.querySelector('.eski');
    asi.textContent = k.asi ? 'Aşı ✓' : 'Aşı';
    asi.setAttribute('aria-pressed', String(Boolean(k.asi)));
    dustu.textContent = dusmusMu(k) ? 'Düştü ✓' : 'Düştü';
    dustu.setAttribute('aria-pressed', String(dusmusMu(k)));
    li.querySelector('.sil').setAttribute('aria-label', `${k.no} sil`);
    if (k.eskiNo) eski.textContent = `Eski küpe: ${k.eskiNo}`; else eski.remove();
    if (k.no === vurgulanan) li.classList.add('yeni');
    return li;
  }));
  if (vurgulanan) el.liste.querySelector('.yeni')?.scrollIntoView({ block: 'nearest' });
  vurgulanan = null;

  const uyari = $('#uyari');
  uyari.textContent = liste.sonHata ?? '';
  uyari.hidden = !liste.sonHata;
}

el.liste.addEventListener('click', async (o) => {
  const li = o.target.closest('li');
  if (!li) return;
  const no = li.dataset.no;
  if (o.target.closest('.asi')) liste.asiDegistir(no);
  else if (o.target.closest('.dustu')) liste.dustuDegistir(no);
  else if (o.target.closest('.sil')) {
    if (await onayla(`${no} listeden silinsin mi?`)) liste.sil(no);
  } else return;
  ciz();
});

// ---------- Numara geldiğinde ----------
async function numaraGeldi(no, kaynak) {
  const onceki = liste.bak(no);
  if (onceki === 'zaten') {
    bip(700, 0.06); titre([60, 60, 60]);
    bildir(`${no} zaten okundu`, 'uyari');
    vurgulanan = no; ciz();
    return;
  }
  if (onceki === 'haric') {
    bip(300, 0.25); titre([200, 80, 200]);
    bildir(`${no}: düşen küpe – sayılmaz`, 'hata');
    return;
  }
  // Kameranın okuduğu her küpe önce sorulur; Doğru denmeden listeye girmez.
  if (kaynak !== 'elle') {
    bip(); titre(80);
    const not = liste.supheliMi(no) ? 'Önceki küpelere benzemiyor – dikkatli bakın.' : null;
    if (!(await onayla('Okunan küpe – doğru mu?', { numara: no, not, evet: 'Doğru', hayir: 'Yanlış' }))) {
      bildir('Atıldı. Tekrar okutun ya da Elle yaz.', 'uyari');
      return;
    }
  }
  if (liste.ekle(no, kaynak).durum === 'eklendi') {
    if (kaynak === 'elle') bip();
    titre(40);
    el.kamera.classList.add('okundu');
    setTimeout(() => el.kamera.classList.remove('okundu'), 600);
    bildir(`${no} eklendi`, 'basari');
    vurgulanan = no;
  }
  ciz();
}

// ---------- Onay penceresi ----------
// Okuma yalnız Okut sekmesindeyken ve hiçbir pencere açık değilken çalışır.
let aktifSekme = 'okut';
function okumaDurumu() {
  okuyucu.duraklatildi = aktifSekme !== 'okut' || el.onay.open || el.tusPaneli.open;
}

let onayCevabi = null, onayKilidi;
/**
 * Evet/hayır sorusu. `numara` verilirse okuma onayıdır: numara büyük yazılır, pencere ekranın altında açılır.
 * Okuma onayı kendiliğinden (kullanıcı başka bir yere dokunurken) açılabildiği için düğmeleri
 * ilk anda kilitlidir; yanlışlıkla "Doğru"ya basılmasın.
 */
function onayla(metin, { numara = null, not = null, evet = 'Evet', hayir = 'Hayır' } = {}) {
  onayCevabi?.(false); // açık bir soru varsa "hayır" sayılır
  el.onayMetin.textContent = metin;
  el.onayNumara.hidden = !numara;
  if (numara) { el.onayIl.textContent = numara.slice(2, 4); el.onaySira.textContent = numara.slice(4); }
  el.onayNot.hidden = !not;
  el.onayNot.textContent = not ?? '';
  el.onayEvet.textContent = evet;
  el.onayHayir.textContent = hayir;
  el.onay.classList.toggle('okuma', Boolean(numara));
  clearTimeout(onayKilidi);
  el.onayEvet.disabled = el.onayHayir.disabled = Boolean(numara);
  if (numara) onayKilidi = setTimeout(() => { el.onayEvet.disabled = el.onayHayir.disabled = false; }, 400);
  if (!el.onay.open) el.onay.showModal();
  okumaDurumu();
  return new Promise((coz) => { onayCevabi = coz; });
}
function onayBitir(cevap) {
  const coz = onayCevabi;
  onayCevabi = null;
  if (el.onay.open) el.onay.close();
  okumaDurumu();
  coz?.(cevap);
}
el.onayEvet.addEventListener('click', () => onayBitir(true));
el.onayHayir.addEventListener('click', () => onayBitir(false));
// Geri tuşu / Esc ile kapanırsa "hayır" sayılır ve okuma takılı kalmaz.
// (Pencere o arada yeni bir soruyla yeniden açıldıysa eski kapanış onu etkilemez.)
el.onay.addEventListener('close', () => { if (!el.onay.open) onayBitir(false); });

// ---------- Tuş takımı (elle yazma) ----------
let tusRakamlar = '';
function tusPaneliAc() {
  // Kolaylık: il kodu son okunan küpeden doldurulur; kullanıcı yalnız 6 haneyi yazar.
  const ornek = liste.yenidenEskiye()[0]?.no;
  tusRakamlar = ornek ? ornek.slice(2, 4) : '';
  tusGoster();
  el.tusPaneli.showModal();
  okumaDurumu();
}
function tusGoster() {
  el.tusDeger.textContent = (tusRakamlar.slice(0, 2) + ' ' + tusRakamlar.slice(2)).trim() || '—';
  el.tusEkle.disabled = tusRakamlar.length !== 8;
}
el.tusPaneli.addEventListener('click', (o) => {
  const tus = o.target.closest('[data-tus]');
  if (tus && tusRakamlar.length < 8) { tusRakamlar += tus.dataset.tus; tusGoster(); }
});
$('#tus-sil').addEventListener('click', () => { tusRakamlar = tusRakamlar.slice(0, -1); tusGoster(); });
$('#tus-temizle').addEventListener('click', () => { tusRakamlar = ''; tusGoster(); });
$('#tus-iptal').addEventListener('click', () => el.tusPaneli.close());
el.tusPaneli.addEventListener('close', okumaDurumu);
el.tusEkle.addEventListener('click', () => {
  const no = 'TR' + tusRakamlar;
  el.tusPaneli.close();
  numaraGeldi(no, 'elle');
});
el.elleYaz.addEventListener('click', tusPaneliAc);

// ---------- Kaydet ve kayıtlı sayımlar ----------
const tarihSaat = (ms) => {
  const d = new Date(ms);
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()} ${iki(d.getHours())}:${iki(d.getMinutes())}`;
};

el.kaydet.addEventListener('click', async () => {
  const kayitlar = liste.kayitlar();
  if (!kayitlar.length) return;
  const soru = `${kayitlar.length} hayvanlık sayım kaydedilsin mi? Liste boşalır; sayım "Sayımlar" bölümünde saklanır.`;
  if (!(await onayla(soru, { evet: 'Kaydet', hayir: 'Vazgeç' }))) return;
  // Önce sakla, saklanabildiyse listeyi boşalt: telefon yazamazsa hiçbir küpe kaybolmaz.
  if (!arsiv.ekle(kayitlar, Date.now())) { bildir('Sayım kaydedilemedi! Liste silinmedi.', 'hata'); return; }
  liste.temizle();
  ciz(); sayimlariCiz();
  sekmeSec('sayimlar');
  bildir('Sayım kaydedildi', 'basari');
});

function sayimlariCiz() {
  const sayimlar = arsiv.hepsi();
  el.sayimlarBos.hidden = sayimlar.length > 0;
  el.sayimlar.replaceChildren(...sayimlar.map((s) => {
    const li = document.createElement('li');
    li.dataset.id = s.id;
    li.innerHTML = `
      <details>
        <summary><span class="tarih"></span><span class="ozet"></span><span class="ac">Numaraları göster</span></summary>
        <ol></ol>
      </details>
      <div class="satir-dugmeler">
        <button class="paylas">Paylaş</button>
        <button class="excel">Excel</button>
        <button class="sil">Sil</button>
      </div>`;
    const o = ozet(s.kayitlar);
    li.querySelector('.tarih').textContent = tarihSaat(s.zaman);
    li.querySelector('.ozet').textContent = `${o.toplam} hayvan · ${o.asi} aşı · ${o.dusen} düşen küpe`;
    li.querySelector('ol').replaceChildren(...paylasimMetni(s.kayitlar).split('\n').slice(1).map((satir) => {
      const x = document.createElement('li');
      x.textContent = satir;
      return x;
    }));
    return li;
  }));
}

async function sayimPaylas(s) {
  const metin = paylasimMetni(s.kayitlar, new Date(s.zaman));
  try {
    if (navigator.share) { await navigator.share({ title: 'Küpe sayımı', text: metin }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(metin); bildir('Liste panoya kopyalandı'); } catch { bildir('Paylaşılamadı', 'hata'); }
}

function sayimExcel(s) {
  const blob = new Blob([csvMetni(s.kayitlar)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'), d = new Date(s.zaman);
  a.href = URL.createObjectURL(blob);
  a.download = `kupe-sayim-${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}-${iki(d.getHours())}${iki(d.getMinutes())}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

el.sayimlar.addEventListener('click', async (o) => {
  const s = arsiv.bul(o.target.closest('li[data-id]')?.dataset.id);
  if (!s) return;
  if (o.target.closest('.paylas')) sayimPaylas(s);
  else if (o.target.closest('.excel')) sayimExcel(s);
  else if (o.target.closest('.sil')) {
    const soru = `${tarihSaat(s.zaman)} tarihli ${s.kayitlar.length} hayvanlık sayım silinsin mi? Geri alınamaz.`;
    if (!(await onayla(soru, { evet: 'Sil', hayir: 'Vazgeç' }))) return;
    if (!arsiv.sil(s.id)) bildir('Silinemedi', 'hata');
    sayimlariCiz();
  }
});

// ---------- Sekmeler ----------
function sekmeSec(ad) {
  for (const s of ['okut', 'sayimlar']) {
    $(`#ekran-${s}`).hidden = s !== ad;
    const d = $(`#sekme-${s}`);
    d.classList.toggle('secili', s === ad);
    if (s === ad) d.setAttribute('aria-current', 'page'); else d.removeAttribute('aria-current');
  }
  aktifSekme = ad;
  okumaDurumu();
}
$('#sekme-okut').addEventListener('click', () => sekmeSec('okut'));
$('#sekme-sayimlar').addEventListener('click', () => sekmeSec('sayimlar'));

// ---------- Kamera ----------
const okuyucu = new Okuyucu({ video: el.video, onNumara: numaraGeldi, onDurum: durum });

// Sarı çerçeve kamera kutusunun ortasında durur; okunan bölge tam olarak bu çerçevenin içidir.
function cerceveYerlestir() {
  const W = el.kamera.clientWidth, H = el.kamera.clientHeight;
  if (!W || !H) return;
  const k = cerceveKutusu(W, H);
  Object.assign(el.cerceve.style, { left: `${k.x}px`, top: `${k.y}px`, width: `${k.w}px`, height: `${k.h}px` });
}
new ResizeObserver(cerceveYerlestir).observe(el.kamera);
cerceveYerlestir();

// Sayım sırasında ekran kararmasın; telefon kilitlenip açılınca yeniden istenir.
async function ekranAcikTut() {
  try { await navigator.wakeLock?.request('screen'); } catch { /* desteklenmiyor */ }
}

async function kameraBaslat() {
  el.kameraAc.hidden = true;
  try {
    await okuyucu.baslat();
    ekranAcikTut();
  } catch (e) {
    console.warn(e);
    okuyucu.durdur();
    durum('Kamera açılamadı – Elle yaz kullanın');
    el.kameraAc.hidden = false;
  }
}
el.kameraAc.addEventListener('click', kameraBaslat);

// Uzaktaki küpe için kademeli yakınlaştırma: 1×, 2×, 3×.
el.zoom.addEventListener('click', async (o) => {
  const secilen = o.target.closest('[data-zoom]');
  if (!secilen) return;
  const kat = Number(secilen.dataset.zoom);
  await okuyucu.yakinlastir(kat);
  for (const d of el.zoom.querySelectorAll('[data-zoom]')) d.setAttribute('aria-pressed', String(d === secilen));
  if (okuyucu.calisiyor) durum(kat > 1 ? `${kat}× yakın – telefonu sabit tutun` : 'Küpeyi çerçeveye getirin');
});

el.fener.addEventListener('click', async () => {
  const acik = el.fener.getAttribute('aria-pressed') !== 'true';
  if (await okuyucu.fener(acik)) el.fener.setAttribute('aria-pressed', String(acik));
  else bildir('Bu telefonda fener açılamıyor', 'uyari');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !okuyucu.akis) return;
  ekranAcikTut();
  const iz = okuyucu.akis.getVideoTracks()[0];
  if (!iz || iz.readyState === 'ended' || iz.muted || !okuyucu.akis.active) {
    okuyucu.durdur();
    kameraBaslat();
  } else if (el.video.paused) {
    el.video.play().catch(() => {});
  }
});

// ---------- Çevrimdışı ----------
async function cevrimdisiHazirla() {
  const gosterge = $('#cevrimdisi');
  if (!('serviceWorker' in navigator)) { gosterge.textContent = 'Çevrimdışı desteklenmiyor'; return; }
  try {
    navigator.serviceWorker.addEventListener('message', (o) => {
      if (o.data?.hazir) { gosterge.textContent = `Çevrimdışı hazır ✓ · s${o.data.surum}`; gosterge.classList.add('hazir'); }
      else gosterge.textContent = 'İnternet gerekli: hazırlanıyor…';
    });
    // Yeni sürüm devraldığında sayfayı bir kez yenile (liste telefonda kayıtlı, kaybolmaz).
    const oncekiSurumVar = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (oncekiSurumVar) location.reload(); });
    await navigator.serviceWorker.register('sw.js');
    const kayit = await navigator.serviceWorker.ready;
    kayit.active?.postMessage('hazirMi');
  } catch (e) {
    gosterge.textContent = 'Çevrimdışı hazırlanamadı';
    console.warn(e);
  }
}

ciz();
sayimlariCiz();
kameraBaslat();
cevrimdisiHazirla();
