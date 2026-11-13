# Küpe Sayım

Sarı kulak küpesini telefon kamerasıyla okuyup sayım listesi çıkaran, internetsiz çalışan web uygulaması.
Fotoğraf saklanmaz; yalnız küpe numarası (`TR00433001` biçiminde) telefonda kaydedilir.

## Sahada kullanım

1. **Hazırlık (internet varken, akşamdan):** Adresi telefonda aç. Tarayıcı menüsünden **Ana ekrana ekle** de.
   Sonra uygulamayı **ana ekrandaki simgeden** aç, kamera iznini ver ve üst köşede **"Çevrimdışı hazır ✓"**
   görünene kadar bekle. (iPhone'da simgeden açılan uygulama Safari'den ayrı hafıza kullanır; ✓'yi simgede görmek şart.)
   Sayımı her zaman **simgeden** yap; tarayıcı sekmesinde başlatılan sayım simgede görünmez.
2. Kamerayı küpeye tut. Küpeyi belli bir yere getirmek gerekmez: uygulama **sarı küpeyi görüntünün neresinde
   olursa olsun kendisi bulur**, üstüne sarı kutu çizer ve okur (küpenin tamamı görünmeli; kenarda kesilen küpe okunmaz).
   Sarı seçilemezse (çok kirli küpe, kötü ışık) küpeyi ortadaki kesikli kılavuza getir.
   Okuyunca bip sesi gelir ve ekranın altında **"Okunan küpe – doğru mu?"** diye numarayı sorar.
   - **Doğru** → küpe kameranın altındaki listeye düşer (en son okunan en üstte).
   - **Yanlış** → atılır; küpeyi çerçeveden çıkarıp yeniden okut ya da **Elle yaz**.
   (Sesin açılması için ekrana bir kez dokunmuş olmak gerekir.)
3. Uzaktaysan **1× / 2× / 3×** ile yakınlaştır. Telefonun kamerası destekliyorsa kameranın kendi yakınlaştırması
   kullanılır; desteklemiyorsa görüntü büyütülür (daha bulanık olur). Yakınlaştırınca telefonu sabit tut.
   Üstte **"Küpe uzak"** yazarsa küpe okunamayacak kadar küçük görünüyor demektir: yaklaş ya da yakınlaştır.
4. Listede her küpenin sağında sütunlar vardır: **Aşı** ve **Düştü** (küpesi düşmüş, yenisi takılmış).
   Gerekirse dokun, işaretlenir; tekrar dokununca kalkar. İşaretlemek zorunlu değil. **✕** satırı siler (önce sorar).
5. Aynı küpenin öbür yüzü okunursa **"zaten okundu"** der, sormaz ve listeye ikinci kez eklemez.
6. Okunmayan küpe için **Elle yaz**: il kodu (ilk 2 hane) son okunan küpeden doldurulur, 6 haneyi yaz.
7. Karanlıkta **Fener** (iPhone'da çalışmayabilir).
8. Sayım bitince **Kaydet**: sayım tarih ve saatiyle telefonda saklanır, liste yeni sayım için boşalır.
9. **Sayımlar** sekmesinde kaydedilen sayımlar durur: **Paylaş** (WhatsApp vb.), **Excel** indir, numaraları göster, **Sil**.
   Paylaşılan liste numaraya göre sıralıdır (TÜRKVET listesiyle karşılaştırmak için).

## İlk saha denemesi kontrol listesi

- [ ] Barkod okunuyor mu? Okunursa üst satırda **"Barkod içeriği: …"** yazar — ne yazdığını not al (uygulama yalnız tam 8 haneli barkodu kabul eder).
- [ ] Bir küpenin okunması kaç saniye sürüyor?
- [ ] Karanlık bölmede fener ile okuyor mu?
- [ ] 2× ve 3× yakınlaştırmada görüntü net mi, kaç adımdan okuyor?
- [ ] Yanlış okunan numara oldu mu? (Hangi rakamlar karıştı — not al.)
- [ ] Sayım sonu toplam, TÜRKVET listesindeki işaretlemeyle tutuyor mu?

## Geliştirme

```bash
npm install
npm run vendor          # okuma kütüphanelerini vendor/ altına kopyalar
npm test                # mantık testleri
npm run test:tarayici   # tarayıcı testleri (sistemde Chrome gerekir; kamera testi ffmpeg ister)
npm run sunucu          # http://localhost:5180
```

Uygulama dosyalarından biri değişince `sw.js` içindeki `SURUM` artırılmalı; yoksa telefon eski sürümü kullanmaya devam eder.
