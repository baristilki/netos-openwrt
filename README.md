# NetOS — OpenWrt için sade ev ağı arayüzü

Keenetic tarzı, Türkçe, hafif bir yönetim paneli. Ek paket derlemeden her OpenWrt 22.03+ router'a kurulur.

LuCI'ye dokunmaz, yanına kurulur: `http://<router-ip>/netos/`
(LuCI `http://<router-ip>/cgi-bin/luci/` adresinde çalışmaya devam eder.)

## Özellikler
- Ana sayfa: internet durumu + canlı hız grafiği, tüm Wi-Fi ağları (aç/kapa, SSID/şifre),
  ev/misafir ağları, çevrimiçi cihazlar, sistem durumu
- Cihazlar: çevrimiçi/çevrimdışı, Wi-Fi sinyali, canlı ↓/↑ hız, isim verme
- Sabit IP ataması (dnsmasq static lease)
- Cihaz başına indirme/yükleme hız sınırı (nftables)
- Cihaz başına internet engeli
- İstatistik: cihaz/hat başına günlük trafik (30-100 gün), ping ve paket kaybı geçmişi (dakikalık, cron)
- Ebeveyn kontrolü: cihaz başına gün/saat planı (ör. hafta içi 23:00–07:00 internet kapalı)
- Yeni cihaz uyarısı (+ isteğe bağlı otomatik engel), Telegram bildirimi (hat koptu/geldi, yeni cihaz)
- Saat dilimi seçimi, ayar yedeği indir / geri yükle
- Port yönlendirme (hazır şablonlar, çakışma kontrolü) + UPnP; CGNAT / başka modem arkası uyarısı
- Güvenlik duvarı: DMZ, internetten gelen ping'e yanıt; cihaz başına anlık bağlantılar
- Yerel ağ: router IP'si, DHCP aralığı, kira süresi, cihazlara verilen DNS (IP değişiminde 3 dk geri alma)
- WireGuard VPN sunucusu: cihaz ekle → QR kodu telefona okut
- Wi-Fi'yi QR kod ile paylaşma
- Cihaz eve geldi / ayrıldı bildirimi (Telegram), günlük zamanlanmış hız testi
- İlk kurulum sihirbazı (şifresiz router'ı algılar), HTTPS, otomatik oturum kapatma
- Sistem günlüğü görüntüleyici, sıcaklık/disk/bellek uyarıları, zamanlı yeniden başlatma
- Cloudflare Tunnel: token yapıştırarak ya da API token ile otomatik kurulum
  (tünel + DNS + Cloudflare Access e-posta koruması). API token router'a kaydedilmez.

## Gereksinimler
- OpenWrt 22.03+ (fw4 / nftables). 23.05 ve 24.10 hedeflendi.
- `uhttpd-mod-ubus`, `rpcd`, `iwinfo`, `jsonfilter` (LuCI kuruluysa hepsi zaten var)

## Kurulum (Windows PowerShell'den)
Router IP'si farklıysa `192.168.1.1`'i değiştir.

1. Eski kopyayı temizle:
   ```powershell
   ssh root@192.168.1.1 "rm -rf /tmp/netpanel"
   ```
2. Dosyaları gönder (`-O` şart, OpenWrt'de SFTP yok):
   ```powershell
   scp -O -r .\router root@192.168.1.1:/tmp/netpanel
   ```
3. Kur:
   ```powershell
   ssh root@192.168.1.1 "sh /tmp/netpanel/install.sh"
   ```
4. Tarayıcıda aç: `http://192.168.1.1/netos/` — root kullanıcısı ve router şifresiyle giriş.

## Entegrasyonlar
NetOS → Entegrasyon menüsünden ihtiyacınız olanı açın; kapalı olanlar arayüzde görünmez.

| Entegrasyon | Ne yapar | Durum |
|---|---|---|
| Huawei WiFi AX2 / WS5200 | Wi-Fi aç/kapa, ağ adı, şifre, kanal, kanal analizi | Hazır |
| AdGuard Home | Tek tıkla kurulum; tüm ağda reklam engelleme, cihaz başına YouTube/TikTok engeli, güvenli arama | Hazır |
| WireGuard VPN | VPN sunucusu, cihaz başına QR kod | Hazır |
| Cloudflare Tunnel | Port açmadan dışarıdan erişim, DNS + Access otomatik kurulum | Hazır |
| Ağ tarayıcı | IP tarama (özel aralık), tahmini cihaz tipi, açık port, web arayüzü, Wake-on-LAN, CSV | Hazır |
| TP-Link Archer BE230 | Bant aç/kapa, ağ adı, şifre (şifreli Archer API) | Deneysel — gerçek cihazda doğrulanmadı |

### Huawei
IP `192.168.1.2`, kullanıcı `admin`, Huawei şifresi → Kaydet.
- Şifre yalnızca router'da (`/etc/config/netpanel`, root-only) saklanır, tarayıcıya geri gönderilmez.
- Yanlış şifrede Huawei kilitlenmesin diye yeni şifre girilene kadar tekrar denenmez.
- Gerekli paketler `curl` ve `openssl-util`; `install.sh` eksikse kurar.
- Elle test: `ssh root@192.168.1.1 "/usr/libexec/netpanel/huawei.sh status"`

### Ağ tarayıcı
Yerel ağdaki her adrese tek ping atar; ping'i engelleyen cihazlar ARP ile yine bulunur.
İsteğe bağlı port/web arayüzü kontrolü yalnız bağlantı açılıp açılmadığına bakar. Sonuçlar CSV indirilebilir.

### Yeni entegrasyon eklemek
1. Router tarafı: `router/files/usr/libexec/netpanel/<ad>.sh` (JSON üreten betik) ve
   `usr/libexec/rpcd/netpanel` içinde yeni metot + `acl.d/netpanel.json` izni.
2. Veri katmanı: `www/netos/api.js` içinde fonksiyon + demo (mock) yanıtı.
3. Arayüz: `www/netos/app.js` içinde `INTEGRATIONS` listesine kayıt ve ayar kartı.

## Güncelleme
NetOS → Sistem → Güncelleme: GitHub'daki en son sürümü denetler, tek tıkla kurar (ayarlar ve cihaz kayıtları korunur).
"Otomatik güncelle" açıksa her gece 04:30 civarı kendisi kurar; kapalıysa Telegram'dan haber verir.

### Yeni sürüm çıkarmak (geliştirici)
1. `router/VERSION` ve `router/files/www/netos/app.js` içindeki `APP_VERSION` değerini artır (ör. `1.2.1`).
2. Commit + push, ardından sürümü yayınla:
   ```powershell
   gh release create v1.2.1 --title "NetOS 1.2.1" --notes "- Değişiklik 1`n- Değişiklik 2"
   ```
Router'lar `releases/latest` etiketini okur; etiket `vX.Y.Z` biçiminde olmalı. Depo gizliyken router'lar sürümü göremez.

## Flow offloading uyarısı
Firewall'da "Software/Hardware flow offloading" açıksa, kurulmuş bağlantılar nftables'ı atlar:
hız sınırı ve cihaz başına canlı hız çalışmaz. Kapatmak için:
```powershell
ssh root@192.168.1.1 "uci set firewall.@defaults[0].flow_offloading=0; uci set firewall.@defaults[0].flow_offloading_hw=0; uci commit firewall; fw4 reload"
```
(Mini PC'de CPU güçlü olduğu için offloading kapalıyken de gigabit hıza yetişir.)

## Bilinen sınırlar
- Hız sınırı "policing" ile yapılır (aşan paket düşürülür); oyun/görüntülü görüşme için SQM kadar
  pürüzsüz değildir ama basit ve hafiftir.
- İndirme sınırı IPv4'e uygulanır. IPv6 aktifse cihaz IPv6 üzerinden sınırı aşabilir.
  Yükleme sınırı ve engel MAC'e göre çalışır (IPv4+IPv6).
- Sabit IP, cihaz DHCP'yi yenileyince (Wi-Fi kapat/aç) devreye girer.

## Kaldırma
```powershell
ssh root@192.168.1.1 "sh /tmp/netpanel/uninstall.sh"
```
(önce adım 1-2 ile dosyaları tekrar göndermek gerekir)

## Yapı
```
router/
  install.sh, uninstall.sh
  files/
    usr/libexec/rpcd/netpanel      ubus nesnesi: clients, status, set_client, forget_client, set_wifi
    usr/share/netpanel/common.sh   ortak shell yardımcıları
    usr/sbin/netpanel-apply        nft tablosu "inet netpanel" (sınır/engel/sayaç)
    usr/share/rpcd/acl.d/netpanel.json
    etc/init.d/netpanel            açılışta kuralları yükler
    etc/hotplug.d/dhcp/90-netpanel IP değişince kuralları tazeler
    etc/config/netpanel            cihaz kayıtları (isim, sınır, engel)
    www/netos/                  arayüz (api.js = veri katmanı, app.js/style.css/index.html = görünüm)
```
Router olmadan önizleme: `router/files/www/netos/index.html` dosyasını tarayıcıda aç
(otomatik demo verisi, herhangi bir şifre).

## Katkı ve lisans
Katkı rehberi: [CONTRIBUTING.md](CONTRIBUTING.md). NetOS, OpenWrt gibi [GPL-2.0](LICENSE) lisansıyla yayımlanır.
