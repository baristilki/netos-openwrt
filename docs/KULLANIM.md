# NetOS kullanım kılavuzu

**Türkçe** · [English](USAGE.md) · [README](../README.md)

Kurulumdan sonra en çok yapılan işlerin adım adım anlatımı. Menü adları panelde göründüğü gibidir.
Panel adresi: `http://192.168.1.1/netos/` (router IP'niz farklıysa onu yazın).

- [1. İlk açılış ve router şifresi](#1-ilk-açılış-ve-router-şifresi)
- [2. İkinci internet hattı eklemek](#2-ikinci-internet-hattı-eklemek)
- [3. Bir cihazı belirli bir hattan çıkarmak](#3-bir-cihazı-belirli-bir-hattan-çıkarmak)
- [4. Misafir Wi-Fi](#4-misafir-wi-fi)
- [5. Cihaz yönetimi: isim, sabit IP, hız sınırı, engel](#5-cihaz-yönetimi-isim-sabit-ip-hız-sınırı-engel)
- [6. Ebeveyn kontrolü](#6-ebeveyn-kontrolü)
- [7. Reklam engelleme ve uygulama trafiği (AdGuard Home)](#7-reklam-engelleme-ve-uygulama-trafiği-adguard-home)
- [8. Kesinti raporu](#8-kesinti-raporu)
- [9. Ping düşürme (SQM) ve oyun önceliği](#9-ping-düşürme-sqm-ve-oyun-önceliği)
- [10. Port yönlendirme](#10-port-yönlendirme)
- [11. Telefonla dışarıdan erişim: VPN ve Cloudflare Tunnel](#11-telefonla-dışarıdan-erişim-vpn-ve-cloudflare-tunnel)
- [12. Telegram bildirimleri](#12-telegram-bildirimleri)
- [13. Yedekleme ve güncelleme](#13-yedekleme-ve-güncelleme)
- [14. Uyarısız HTTPS (kendi sertifika otoritemiz)](#14-uyarısız-https-kendi-sertifika-otoritemiz)
- [15. Telefona uygulama olarak eklemek](#15-telefona-uygulama-olarak-eklemek)
- [Sorun giderme](#sorun-giderme)

---

## 1. İlk açılış ve router şifresi
1. Paneli açın, kullanıcı adı `root`, şifre router şifreniz (yeni kurulumda boş olabilir).
2. **Kurulum sihirbazı** kendiliğinden bir kez açılır: şifre → saat dilimi → internet hatları → güncelleme.
3. Router şifresi yoksa **mutlaka belirleyin**: aynı ağdaki herkes panele, LuCI'ye ve SSH'a şifresiz girebilir.
   Bu şifre LuCI ve SSH için de geçerli olur.
4. Sihirbazı kapattıysanız sonradan **Sistem > Panel şifresi** kartından şifre belirleyebilirsiniz.

> Üst bardaki **zil**, açık kalan sorunları (şifresiz router, kopan hat, yeni cihaz, yavaş port…) listeler.
> Uyarılar sayfanın üstünde yalnız bir kez çıkar, sonra zilde durur.

## 2. İkinci internet hattı eklemek
Gerekenler: ikinci modem ve router'da **boş** bir ethernet portu.
1. İkinci modemi boş porta takın. **Ana sayfa > Portlar** kartında kablonun takılı göründüğünü kontrol edin.
2. **İnternet** sayfasında **İkinci internet hattı** kartını açın (ya da sihirbazda "İki internet" seçin).
3. Portu seçin, bağlantı tipini seçin:
   - Modem router modundaysa (en yaygın): **Modem router modunda (otomatik IP)**
   - Modem köprü modundaysa: **PPPoE** + operatörün verdiği kullanıcı adı/şifre (gerekirse VLAN)
4. Hatların nasıl çalışacağını seçin:
   - **Yedek hat**: ana hat koparsa internet otomatik diğerine geçer.
   - **Birlikte kullan**: trafik iki hatta paylaştırılır.
5. **Hattı ekle** → birkaç saniye sonra iki hat da **İnternet** sayfasında "Çevrimiçi" görünmeli.
   Değişiklik 2 dakika içinde onaylanmazsa eski ayara otomatik dönülür.

Mod sonradan **İnternet > Çoklu WAN modu** kartından değiştirilir. (Altyapı: `mwan3` paketi; panel gerekirse kurar.)

## 3. Bir cihazı belirli bir hattan çıkarmak
Örnek: PlayStation hep Turknet'ten, salon TV'si ikinci hattan çıksın.
1. **Cihazlar** → cihaza tıklayın → **İnternet hattı** bölümü (yalnız iki hat varken görünür).
2. Seçenekler:
   - **Otomatik**: genel çoklu hat ayarına uyar.
   - **Önce X (koparsa diğer hat)**: normalde X'ten çıkar, X koparsa diğer hatta geçer.
   - **Yalnız X**: yalnız X'ten çıkar; X koparsa bu cihazın interneti de kesilir.
3. **Kaydet**. Cihaz listesinde "Hat: X" ya da "Yalnız: X" etiketi görünür.

Bilmeniz gereken: kural cihazın **IP adresine** bağlıdır, bu yüzden cihaza otomatik **sabit IP** ayrılır.
Yeni kural yeni açılan bağlantılara uygulanır; hemen etkisini görmek için cihazın Wi-Fi'sini kapatıp açın.

## 4. Misafir Wi-Fi
Huawei Wi-Fi bağlıysa (**Entegrasyon > Huawei**) **Wi-Fi** sayfasında **Misafir Wi-Fi** kartı çıkar.
1. Ağ adı yazın, **Şifreli (önerilen)** seçip en az 8 karakterlik bir şifre girin.
2. **Açık kalma süresi**: 4 saat / 1 gün / Sınırsız. Süre dolunca Huawei misafir ağını kendisi kapatır;
   kalan süre kartta görünür, **+30 dk** ile uzatılır.
3. İsterseniz **Hız sınırı > Sınırla** ile misafirlerin toplam hızını sınırlayın (ör. 20 Mbit/s).
4. **Kaydet**, sonra anahtarla açın. **QR ile paylaş** ile misafir telefon kamerasıyla okutup bağlanır.

Misafirler ev cihazlarınızı (bilgisayar, kamera, NAS) göremez.

## 5. Cihaz yönetimi: isim, sabit IP, hız sınırı, engel
**Cihazlar** → cihaza tıklayın:
- **İsim ve tür**: listede tanıdık bir ad ve ikon görünür.
- **Sabit IP adresi**: "Bu cihaza IP ayır" → IP yazın → Kaydet. Cihaz Wi-Fi'yi kapatıp açınca yeni IP'yi alır.
- **Hız sınırı**: indirme/yükleme Mbit/s (boş = sınırsız). Hazır düğmeler: 5, 10, 25, 50, 100.
- **İnternet erişimini engelle**: cihazın interneti anında kesilir.
- **Oyun önceliği**, **eve gelince / ayrılınca bildir**, **Cihazı unut**.

## 6. Ebeveyn kontrolü
**Cihazlar** → çocuğun cihazı:
1. **Saat planı**: günleri ve saat aralığını seçin (ör. hafta içi 23:00–07:00) → bu saatlerde internet kapalı.
2. AdGuard Home kuruluysa aynı panelde **İçerik filtresi**: yetişkin site engeli, güvenli arama,
   YouTube / TikTok / oyun gibi servisleri bu cihaz için engelleme.

## 7. Reklam engelleme ve uygulama trafiği (AdGuard Home)
1. **Entegrasyon > AdGuard Home** → tek tıkla kurulum, bir yönetici şifresi belirleyin.
   (AdGuard zaten kuruluysa kullanıcı adı/şifresini girip bağlayın.)
2. **Reklam engelleme** sayfasından korumayı açın/kapatın, tüm ağda engellenecek uygulamaları seçin.
3. **İstatistik > Uygulamalar** kartı: YouTube, Netflix, Steam, TikTok… hangi cihaz neye ne kadar harcadı
   (bugün / 7 / 30 gün, cihaz filtresi). Servisler AdGuard'ın DNS kayıtlarından tanınır.
   AdGuard yoksa yalnız porta göre kaba tahmin yapılır ("Web (diğer)", "DNS" gibi).

## 8. Kesinti raporu
**İnternet** sayfasının altında **Kesinti raporu · son 30 gün**: her hat için kesinti sayısı, toplam ve en uzun süre,
erişilebilirlik yüzdesi. **Raporu kopyala** ile kesinti başlangıç saatleri dahil metni operatöre gönderebilirsiniz.

## 9. Ping düşürme (SQM) ve oyun önceliği
1. **Hız & Ping** → **Hız testi**'ni yük altında çalıştırın; sonuçta "Önerilen değerleri uygula" çıkabilir.
2. **Ping düşürme — SQM** kartında sınırları ölçülen hızın ~%90'ına ayarlayın.
3. **Oyun önceliği** listesinden konsol/PC'yi açın (SQM modu "Oyun öncelikli" olmalı).

## 10. Port yönlendirme
**Port yönlendirme** → **Kural ekle** → hazır şablon (Minecraft, kamera, oyun…) ya da elle:
dış port, cihaz, iç port, protokol → Kaydet. Panel çakışmaları ve CGNAT (dışarıdan erişilemeyen hat) durumunu uyarır.

## 11. Telefonla dışarıdan erişim: VPN ve Cloudflare Tunnel
- **VPN (WireGuard)**: **VPN** sayfası → sunucuyu kurun → **Cihaz ekle** → telefondaki WireGuard uygulamasıyla
  QR'ı okutun. QR yalnız bir kez gösterilir.
- **Cloudflare Tunnel** (port açmadan, CGNAT arkasında da çalışır): **Entegrasyon > Cloudflare Tunnel**,
  token yapıştırın ya da API token ile otomatik kurulum (Access e-posta koruması dahil).

## 12. Telegram bildirimleri
**Sistem > Bildirimler (Telegram)**: bot token ve Chat ID girin → **Test mesajı**.
Seçenekler: hat koptu/geldi, yeni cihaz, eve geldi/ayrıldı, sistem uyarıları, yeni cihazları otomatik engelle.

## 13. Yedekleme ve güncelleme
- **Sistem > Yedekleme**: ayar yedeğini indirin / geri yükleyin.
- **Sistem > Güncelleme**: GitHub'daki son sürümü tek tıkla kurar; ayarlar ve cihaz kayıtları korunur.
  "Otomatik güncelle" açıksa gece kendisi kurar.

## 14. Uyarısız HTTPS (kendi sertifika otoritemiz)
Tarayıcıların "bağlantı güvenli değil" uyarısı, routerın kendi imzaladığı sertifikadan gelir.
1. **Sistem > Güvenlik > HTTPS** bölümünde **Güvenilir sertifika oluştur**'a basın. NetOS yalnız yerel adreslere
   (192.168.x.x, .lan) sertifika verebilen bir otorite oluşturur ve panele sertifikayı kurar; sertifika kendiliğinden yenilenir.
2. **Kök sertifikayı indir** ile `NetOS-kok-sertifika.crt` dosyasını alın ve her cihaza **bir kez** yükleyin:
   - **Windows:** dosyayı açın → *Sertifika yükle* → *Geçerli kullanıcı* → *Güvenilen Kök Sertifika Yetkilileri*.
   - **iPhone / iPad:** Safari ile indirin → *Ayarlar > İndirilen profil > Yükle* → sonra *Genel > Hakkında > Sertifika Güven Ayarları*'ndan açın.
   - **Android:** *Ayarlar > Güvenlik > Diğer güvenlik ayarları > Sertifika yükle > CA sertifikası*.
   - **Firefox:** kendi deposunu kullanır: *Ayarlar > Gizlilik ve Güvenlik > Sertifikalar > İçe aktar*.
3. Panele `https://192.168.1.1/netos/` ile girin; uyarı çıkmaz.

## 15. Telefona uygulama olarak eklemek
NetOS, ana ekrana eklenince kendi ikonu ve adıyla tam ekran açılır.
- **iPhone / iPad (Safari):** paneli açın → Paylaş düğmesi → **Ana Ekrana Ekle**.
- **Android (Chrome):** ⋮ menüsü → **Ana ekrana ekle** / **Uygulamayı yükle**.
- **Windows / Mac (Chrome, Edge):** adres çubuğundaki **Yükle** simgesi. Uygulama olarak yükleme için
  14. bölümdeki güvenilir HTTPS gerekir.

---

## Sorun giderme
| Belirti | Çözüm |
|---|---|
| İkinci hat "çevrimdışı" ama modemde internet var | NetOS çoklu hatta ters yol filtresini (`rp_filter`) otomatik gevşek moda alır. Elle: `ssh root@192.168.1.1 "sysctl -w net.ipv4.conf.all.rp_filter=2"` |
| Cihaz hızları / hız sınırı çalışmıyor | Flow offloading açık. Uyarıdaki **Kapat (önerilen)** düğmesi ya da **Sistem > Yönetim ve bakım** |
| Sabit IP ya da hat kuralı etkisiz | Cihazın Wi-Fi'sini kapatıp açın (yeni IP'yi alsın) |
| Port sık kopuyor ("# kopma") | Kabloyu ve karşı cihazı kontrol edin; karşıdaki bilgisayar uykuya giriyorsa bu normaldir |
| Port 2.5G yerine 1G bağlı | Kablo en az Cat5e (2.5G için Cat6 önerilir) ve karşı cihazın portu 2.5G olmalı |
| Panel açılmıyor | LuCI çalışıyorsa: `ssh root@192.168.1.1 "/etc/init.d/rpcd restart; /etc/init.d/uhttpd restart"` |
