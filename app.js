// Küpe Sayım: ekran mantığı. Okunan küpeler yalnız numara olarak telefonda saklanır.
import { SayimListesi } from './lib/liste.js';
import { Okuyucu, cerceveOranlari } from './lib/okuyucu.js';

const $ = (s) => document.querySelector(s);
const depo = (() => { try { return window.localStorage; } catch { return null; } })();
const liste = new SayimListesi(depo);

const el = {
  sayac: $('#sayac'), durum: $('#durum'), video: $('#video'), kamera: $('#kamera'), cerceve: $('#cerceve'),
  kameraAc: $('#kamera-ac'), son: $('#son'), sonNo: $('#son-no'), sonAsi: $('#son-asi'), sonEski: $('#son-eski'),
  fener: $('#fener'), elleYaz: $('#elle-yaz'), liste: $('#liste'), listeBos: $('#liste-bos'),
  bildirim: $('#bildirim'), tusPaneli: $('#tus-paneli'), tusBaslik: $('#tus-baslik'), tusDeger: $('#tus-deger'),
  tusEkle: $('#tus-ekle'), onay: $('#onay'), onayMetin: $('#onay-metin'),
};

let sonNo = null;

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

// ---------- Liste ve görünüm ----------
function ciz() {
  const kayitlar = liste.kayitlar();
  el.sayac.textContent = `${kayitlar.length} hayvan`;
  el.listeBos.hidden = kayitlar.length > 0;
  el.liste.replaceChildren(...kayitlar.map((k) => {
    const li = document.createElement('li');
    li.dataset.no = k.no;
    li.innerHTML = `
      <span class="no"></span>
      <span class="eski"></span>
      <div class="satir-dugmeler">
        <button class="asi"></button>
        <button class="eski-btn">Eski küpe</button>
        <button class="sil">Sil</button>
      </div>`;
    li.querySelector('.no').textContent = k.no;
    const eski = li.querySelector('.eski');
    if (k.eskiNo) eski.textContent = `Eski küpe ${k.eskiNo} düştü`; else eski.remove();
    const asi = li.querySelector('.asi');
    asi.textContent = k.asi ? 'Aşı ✓' : 'Aşı –';
    asi.classList.toggle('acik', k.asi);
    return li;
  }));

  const son = sonNo && liste.kayitlar().find((k) => k.no === sonNo);
  el.son.hidden = !son;
  if (son) {
    el.sonNo.textContent = son.no + (son.eskiNo ? ` (eski ${son.eskiNo})` : '');
    el.sonAsi.textContent = son.asi ? 'Aşı yapıldı ✓' : 'Aşı yapıldı';
    el.sonAsi.classList.toggle('acik', son.asi);
  }
  const uyari = $('#uyari');
  uyari.textContent = liste.sonHata ?? '';
  uyari.hidden = !liste.sonHata;
}

el.liste.addEventListener('click', async (o) => {
  const li = o.target.closest('li');
  if (!li) return;
  const no = li.dataset.no;
  if (o.target.closest('.asi')) liste.asiDegistir(no);
  else if (o.target.closest('.eski-btn')) tusPaneliAc('eski', no);
  else if (o.target.closest('.sil')) {
    if (await onayla(`${no} listeden silinsin mi?`)) liste.sil(no);
  }
  ciz();
});

// ---------- Numara geldiğinde ----------
async function numaraGeldi(no, kaynak) {
  if (kaynak !== 'elle' && liste.supheliMi(no)) {
    if (!(await onayla(`${no} doğru mu?`))) return;
  }
  const sonuc = liste.ekle(no, kaynak);
  if (sonuc.durum === 'eklendi') {
    sonNo = no;
    bip(); titre(80);
    el.kamera.classList.add('okundu');
    setTimeout(() => el.kamera.classList.remove('okundu'), 600);
    bildir(`${no} eklendi`, 'basari');
  } else if (sonuc.durum === 'zaten') {
    sonNo = no;
    bip(700, 0.06); titre([60, 60, 60]);
    bildir(`${no} zaten okundu`, 'uyari');
  } else {
    bip(300, 0.25); titre([200, 80, 200]);
    bildir(`${no}: düşen küpe – sayılmaz`, 'hata');
  }
  ciz();
}

el.sonAsi.addEventListener('click', () => { if (sonNo) { liste.asiDegistir(sonNo); ciz(); } });
el.sonEski.addEventListener('click', () => { if (sonNo) tusPaneliAc('eski', sonNo); });

// ---------- Onay diyaloğu ----------
// Okuma yalnız Okut sekmesindeyken ve hiçbir pencere açık değilken çalışır.
let aktifSekme = 'okut';
function okumaDurumu() {
  okuyucu.duraklatildi = aktifSekme !== 'okut' || el.onay.open || el.tusPaneli.open;
}

let onayCevabi = null;
function onayla(metin) {
  onayCevabi?.(false); // açık bir soru varsa "hayır" sayılır
  el.onayMetin.textContent = metin;
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
$('#onay-evet').addEventListener('click', () => onayBitir(true));
$('#onay-hayir').addEventListener('click', () => onayBitir(false));
// Geri tuşu / Esc ile kapanırsa "hayır" sayılır ve okuma takılı kalmaz.
el.onay.addEventListener('close', () => onayBitir(false));

// ---------- Tuş takımı ----------
let tusModu = 'yeni', tusHedef = null, tusRakamlar = '';
function tusPaneliAc(mod, hedef = null) {
  tusModu = mod; tusHedef = hedef;
  // Kolaylık: il kodunu son kayıttan doldur; kullanıcı yalnız 6 haneyi yazar.
  const ornek = liste.kayitlar().at(-1)?.no ?? sonNo;
  tusRakamlar = ornek ? ornek.slice(2, 4) : '';
  el.tusBaslik.textContent = mod === 'eski' ? `${hedef} için düşen eski küpe` : 'Küpe numarası';
  el.tusEkle.textContent = mod === 'eski' ? 'Kaydet' : 'Ekle';
  tusGoster();
  el.tusPaneli.showModal();
  okumaDurumu();
}
function tusGoster() {
  el.tusDeger.textContent = (tusRakamlar.slice(0, 2) + ' ' + tusRakamlar.slice(2)).trim() || '—';
  el.tusEkle.disabled = tusRakamlar.length !== 8;
}
function tusKapat() { el.tusPaneli.close(); }

el.tusPaneli.addEventListener('click', (o) => {
  const tus = o.target.closest('[data-tus]');
  if (tus && tusRakamlar.length < 8) { tusRakamlar += tus.dataset.tus; tusGoster(); }
});
$('#tus-sil').addEventListener('click', () => { tusRakamlar = tusRakamlar.slice(0, -1); tusGoster(); });
$('#tus-temizle').addEventListener('click', () => { tusRakamlar = ''; tusGoster(); });
$('#tus-iptal').addEventListener('click', tusKapat);
el.tusPaneli.addEventListener('close', okumaDurumu);
el.tusEkle.addEventListener('click', async () => {
  const no = 'TR' + tusRakamlar;
  tusKapat();
  if (tusModu === 'eski') {
    if (liste.kayitVarMi(no) && !(await onayla(`${no} bu sayımda okunmuş bir hayvan. Yine de düşen eski küpe olarak sayımdan çıkarılsın mı?`))) return;
    liste.eskiKupeBagla(tusHedef, no);
    bildir(`${no} sayımdan çıkarıldı`, 'uyari');
    ciz();
  } else {
    numaraGeldi(no, 'elle');
  }
});
el.elleYaz.addEventListener('click', () => tusPaneliAc('yeni'));

// ---------- Liste ekranı düğmeleri ----------
$('#paylas').addEventListener('click', async () => {
  const metin = liste.paylasimMetni(new Date());
  try {
    if (navigator.share) { await navigator.share({ title: 'Küpe sayımı', text: metin }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(metin); bildir('Liste panoya kopyalandı'); } catch { bildir('Paylaşılamadı', 'hata'); }
});

$('#excel').addEventListener('click', () => {
  const blob = new Blob([liste.csv()], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  const d = new Date(), iki = (n) => String(n).padStart(2, '0');
  a.href = URL.createObjectURL(blob);
  a.download = `kupe-sayim-${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

$('#yeni-sayim').addEventListener('click', async () => {
  if (await onayla('Liste silinip yeni sayım başlasın mı? Önce paylaştığınızdan emin olun.')) {
    liste.temizle(); sonNo = null; ciz();
  }
});

// ---------- Sekmeler ----------
function sekmeSec(ad) {
  for (const s of ['okut', 'liste']) {
    $(`#ekran-${s}`).hidden = s !== ad;
    const d = $(`#sekme-${s}`);
    d.classList.toggle('secili', s === ad);
    if (s === ad) d.setAttribute('aria-current', 'page'); else d.removeAttribute('aria-current');
  }
  aktifSekme = ad;
  okumaDurumu();
}
$('#sekme-okut').addEventListener('click', () => sekmeSec('okut'));
$('#sekme-liste').addEventListener('click', () => sekmeSec('liste'));

// ---------- Kamera ----------
const okuyucu = new Okuyucu({ video: el.video, onNumara: numaraGeldi, onDurum: durum });

function kameraBoyutla() {
  const vw = el.video.videoWidth, vh = el.video.videoHeight;
  if (!vw) return;
  const enGenis = el.kamera.parentElement.clientWidth, enYuksek = window.innerHeight * 0.58;
  const olcek = Math.min(enGenis / vw, enYuksek / vh);
  Object.assign(el.kamera.style, { width: `${vw * olcek}px`, height: `${vh * olcek}px`, aspectRatio: 'auto', maxHeight: 'none' });
  const o = cerceveOranlari(vw, vh);
  Object.assign(el.cerceve.style, { left: `${o.x * 100}%`, top: `${o.y * 100}%`, width: `${o.w * 100}%`, height: `${o.h * 100}%` });
}
el.video.addEventListener('loadedmetadata', kameraBoyutla);
window.addEventListener('resize', kameraBoyutla);
// Video gelmeden de çerçeve görünsün (3:4 dikey varsayım).
{
  const o = cerceveOranlari(3, 4);
  Object.assign(el.cerceve.style, { left: `${o.x * 100}%`, top: `${o.y * 100}%`, width: `${o.w * 100}%`, height: `${o.h * 100}%` });
}

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
      if (o.data?.hazir) { gosterge.textContent = 'Çevrimdışı hazır ✓'; gosterge.classList.add('hazir'); }
      else gosterge.textContent = 'İnternet gerekli: hazırlanıyor…';
    });
    await navigator.serviceWorker.register('sw.js');
    const kayit = await navigator.serviceWorker.ready;
    kayit.active?.postMessage('hazirMi');
  } catch (e) {
    gosterge.textContent = 'Çevrimdışı hazırlanamadı';
    console.warn(e);
  }
}

ciz();
kameraBaslat();
cevrimdisiHazirla();
