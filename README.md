# Küpe Sayım

Sarı kulak küpesini telefon kamerasıyla okuyup sayım listesi çıkaran, internetsiz çalışan web uygulaması.
Fotoğraf saklanmaz; yalnız küpe numarası (`TR00433001` biçiminde) telefonda kaydedilir.

## Sahada kullanım

1. **İlk açılışı internet varken yap.** Üst köşede **"Çevrimdışı hazır ✓"** görmeden ahıra girme.
   Tarayıcı menüsünden **Ana ekrana ekle** de; sonra uygulama simgeden açılır.
2. Kamerayı küpeye 10–15 cm tut, küpeyi **sarı çerçevenin içine** al. Okununca yeşil yanar, telefon titrer ve bip sesi gelir.
3. Aynı küpenin öbür yüzü okunursa **"zaten okundu"** der, listeye ikinci kez eklemez.
4. **Aşı yapıldı** düğmesi son okunan hayvana aşı işareti koyar (Liste ekranında da değiştirilebilir).
5. **Eski küpesi düştü**: yeni küpeyi okuttuktan sonra bas, eski numarayı yaz. Eski numara sayımdan çıkar;
   yere düşmüş eski küpe sonradan okutulursa "düşen küpe – sayılmaz" uyarısı verir.
6. Okunmayan küpe için **Elle yaz**: il kodu (ilk 2 hane) önceki küpeden doldurulur, 6 haneyi yaz.
7. Karanlıkta **Fener** (iPhone'da çalışmayabilir).
8. Bitince **Liste → Paylaş** (WhatsApp vb.) veya **Excel indir**. Liste numaraya göre sıralıdır.
9. Yeni sayım için **Yeni sayım** (önce paylaşmayı unutma; liste silinir).

## İlk saha denemesi kontrol listesi

- [ ] Barkod okunuyor mu, yoksa hep rakamdan mı okuyor? (Liste satırındaki kaynak CSV'de yok; gözle izle.)
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
