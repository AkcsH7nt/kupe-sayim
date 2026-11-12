# Küpe Sayım

Sarı kulak küpesini telefon kamerasıyla okuyup sayım listesi çıkaran, internetsiz çalışan web uygulaması.
Fotoğraf saklanmaz; yalnız küpe numarası (`TR00433001` biçiminde) telefonda kaydedilir.

## Sahada kullanım

1. **Hazırlık (internet varken, akşamdan):** Adresi telefonda aç. Tarayıcı menüsünden **Ana ekrana ekle** de.
   Sonra uygulamayı **ana ekrandaki simgeden** aç, kamera iznini ver ve üst köşede **"Çevrimdışı hazır ✓"**
   görünene kadar bekle. (iPhone'da simgeden açılan uygulama Safari'den ayrı hafıza kullanır; ✓'yi simgede görmek şart.)
   Sayımı her zaman **simgeden** yap; tarayıcı sekmesinde başlatılan sayım simgede görünmez.
2. Kamerayı küpeye yaklaşık **20 cm** tut (görüntü netleşene kadar), küpeyi **sarı çerçevenin içine** al.
   Okununca yeşil yanar, bip sesi gelir (sesin açılması için ekrana bir kez dokunmuş olmak gerekir), Android'de telefon titrer.
3. Aynı küpenin öbür yüzü okunursa **"zaten okundu"** der, listeye ikinci kez eklemez.
4. **Aşı yapıldı** düğmesi son okunan hayvana aşı işareti koyar (Liste ekranında da değiştirilebilir).
5. **Eski küpesi düştü**: yeni küpeyi okuttuktan sonra bas, eski numarayı yaz. Eski numara sayımdan çıkar;
   yere düşmüş eski küpe sonradan okutulursa "düşen küpe – sayılmaz" uyarısı verir.
6. Okunmayan küpe için **Elle yaz**: il kodu (ilk 2 hane) önceki küpeden doldurulur, 6 haneyi yaz.
7. Karanlıkta **Fener** (iPhone'da çalışmayabilir).
8. Bitince **Liste → Paylaş** (WhatsApp vb.) veya **Excel indir**. Liste numaraya göre sıralıdır.
9. Yeni sayım için **Yeni sayım** (önce paylaşmayı unutma; liste silinir).

## İlk saha denemesi kontrol listesi

- [ ] Barkod okunuyor mu? Okunursa üst satırda **"Barkod içeriği: …"** yazar — ne yazdığını not al (uygulama yalnız tam 8 haneli barkodu kabul eder).
- [ ] Bir küpenin okunması kaç saniye sürüyor?
- [ ] Karanlık bölmede fener ile okuyor mu?
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
