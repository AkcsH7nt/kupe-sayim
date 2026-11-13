// Ekrandaki sarı çerçevenin yeri, videoda okunacak bölge ve yakınlaştırma hesabı (saf hesap, test edilebilir).

/** Kamera kutusunun (W×H ekran pikseli) ortasındaki çerçeve: genişliğin %80'i, yatay dikdörtgen (küpe biçimi). */
export function cerceveKutusu(W, H) {
  const w = 0.8 * W;
  const h = Math.min(0.8 * H, w * 0.75);
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

/**
 * Ekranda görünen video parçası (video pikseli). Video kutuyu taşarak doldurur (object-fit: cover) ve
 * ortadan `zoom` kat büyütülür. olcek: bir video pikselinin ekrandaki boyu.
 */
export function gorunenBolge(vw, vh, W, H, zoom = 1) {
  const olcek = Math.max(W / vw, H / vh) * zoom;
  const w = Math.min(vw, W / olcek), h = Math.min(vh, H / olcek);
  return { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w: Math.round(w), h: Math.round(h), olcek };
}

/**
 * Çerçevenin video karesindeki karşılığı (video pikseli). Video kutuyu taşarak doldurur (object-fit: cover)
 * ve ortadan `zoom` kat büyütülür; ikisi de ortalı olduğundan bölge de ortadadır.
 */
export function okumaBolgesi(vw, vh, W, H, zoom = 1) {
  const olcek = Math.max(W / vw, H / vh) * zoom;
  const k = cerceveKutusu(W, H);
  const w = Math.min(vw, k.w / olcek), h = Math.min(vh, k.h / olcek);
  return { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w: Math.round(w), h: Math.round(h) };
}

/**
 * İstenen yakınlaştırma katının ne kadarını kameranın kendi yakınlaştırması (net), ne kadarını
 * görüntüyü büyütme (sayısal, daha bulanık) karşılar. yetenek: { min, max, taban } — taban, kameranın
 * açıldığı andaki değeridir ("1×").
 */
export function zoomPlani(kat, yetenek) {
  if (!yetenek || !(yetenek.max > yetenek.min)) return { donanim: null, sayisal: kat };
  const taban = yetenek.taban || yetenek.min;
  const donanim = Math.min(yetenek.max, Math.max(yetenek.min, taban * kat));
  return { donanim, sayisal: kat / (donanim / taban) };
}
