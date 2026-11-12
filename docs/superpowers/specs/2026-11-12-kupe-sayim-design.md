# Küpe Sayım — Tasarım (kısa)

Tarih: 12.11.2026 · İlk saha denemesi: 13.11.2026

## Amaç ve neden
Ahırda hayvanların sarı kulak küpelerini telefon kamerasıyla okuyup sayım listesi çıkarmak.
İlk deneme var/yok sayımı. Karşılaştırmayı kullanıcı elindeki TÜRKVET listesinde kendisi yapar;
uygulama düzgün, sıralı bir liste verir.

## Hedefler
- Kamera açıkken küpe çerçeveye girince numara otomatik okunur, listeye eklenir; titreşim + bip.
- Fotoğraf **saklanmaz**, yalnız numara kaydedilir.
- Aynı küpe (ön/arka parça) ikinci kez eklenmez → "zaten okundu" uyarısı.
- Her satırda "aşı yapıldı" işareti (dokun-aç/kapa).
- Düşen küpe: yeni küpe satırına eski numara yazılır; eski numara sayımdan hariç, listede "eski → yeni".
- Okunamayan küpe için büyük rakam tuş takımıyla elle giriş.
- Liste telefonda kalıcı (sayfa yenilense de kaybolmaz).
- Sonuç: numaraya göre sıralı liste; ekranda göster, paylaş (WhatsApp vb.), Excel (CSV) indir.
- **Tamamen çevrimdışı**: ilk açılıştan sonra internet gerekmez; Android ve iPhone.
- Yakından kullanım: fener düğmesi, yakın odak, tek elle kullanım (büyük düğmeler altta).

## Kapsam dışı
TÜRKVET bağlantısı, referans listeyle otomatik karşılaştırma, kullanıcı/hesap, sunucu.

## Küpe okuma kuralı (kullanıcı onaylı)
- Küpe: `TR` (sabit, okunmaz) + sağ üstte küçük 2 hane + barkod şeridi + altta büyük 6 hane.
- Düz duran yüz soldan sağa, yukarıdan aşağı okunur: `00` + `433001` → kayıt `TR00433001`.
- Ters yüz okutulursa görüntü 180° çevrilip aynı sırayla okunur.
- Rakam okuma yalnız 0–9 (whitelist); barkod şeridi rakam okumada yok sayılır.

## Okuma yöntemi
1. Barkod ve rakam okuma aynı kare üzerinde birlikte dener; hangisi önce emin olursa kazanır.
2. Rakam okuma: çerçeve içi kırpılır, gri tona çevrilir, kontrast artırılır; 8 hane (2+6) beklenir.
3. Oylama: aynı numara art arda 3 okumada çıkmadan kabul edilmez. Barkod ve rakam aynı sonucu
   verirse anında kabul.
4. Şüpheli okuma (önek o güne kadarki küpelere benzemiyorsa) eklenmeden önce onay sorar.
5. Barkod içeriği bilinmiyor; içinden 8 haneli numara ayıklanır (TR/boşluk temizlenir).

## Yaklaşımlar
- **A) Barkod + elle giriş:** en hafif, ama kirli barkodda zayıf. Kullanıcı reddetti.
- **B) Barkod + rakam okuma (çevrimdışı model) + elle giriş:** ← seçildi. Kullanıcı barkodun temiz
  olmayabileceğini, rakamın da okunması gerektiğini ve sahada çevrimdışı çalışmasını istedi.
- **C) AGRIVET projesine eklemek:** kullanıcı tek HTML uygulaması istedi; yarına yetişmez. Elendi.

## Teknik kararlar (benim kararım)
- Derleme adımı olmayan düz HTML + JS (ES modülleri); kütüphaneler `vendor/` altında yerel.
- Rakam okuma: Tesseract.js (v7) + yerel çekirdek (wasm) + `eng` hızlı veri, rakam whitelist.
- Barkod: tarayıcıda `BarcodeDetector` varsa o, yoksa `zxing-wasm` (yerel wasm).
- Çevrimdışı: service worker tüm dosyaları ilk açılışta önbelleğe alır.
- Kalıcılık: `localStorage` (liste küçük).
- Saf mantık (numara ayıklama, oylama, tekrar engeli, düşen küpe, sıralama, CSV) Node testleriyle.
- Yayın: kamera HTTPS ister → GitHub Pages önerildi; **yayından önce kullanıcıya sorulacak**.

## Uygulayıcıya bırakılanlar
Ekran düzeni ayrıntıları, oylama eşiğinin ince ayarı, görüntü ön işleme parametreleri.
