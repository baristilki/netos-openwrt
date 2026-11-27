# NetOS — OpenWrt için sade ev ağı arayüzü

**Türkçe** · [English](README.en.md) · [Kullanım kılavuzu](docs/KULLANIM.md)

Keenetic tarzı, Türkçe, hafif bir yönetim paneli. Ek paket derlemeden her OpenWrt 22.03+ router'a kurulur.

LuCI'ye dokunmaz, yanına kurulur: `http://<router-ip>/netos/`
(LuCI `http://<router-ip>/cgi-bin/luci/` adresinde çalışmaya devam eder.)

## Özellikler

### Genel bakış
- Ana sayfa: internet durumu ve canlı hız grafiği, tüm Wi-Fi ağları (aç/kapa), ev ve misafir ağları,
  fiziksel portlar, çevrimiçi cihazlar, sistem durumu
- Bildirim zili: şifresiz router, kopan hat, yeni cihaz, düşük port hızı, flow offloading gibi uyarılar
  tek yerde; uyarılar sayfanın üstünde yalnız bir kez çıkar
- İlk kurulum sihirbazı: router şifresi, saat dilimi, tek ya da iki internet hattı, otomatik güncelleme
- Türkçe / English arayüz, gece / gündüz modu, telefona uygun düzen

### İnternet
- PPPoE / DHCP / statik IP, VLAN, MTU, DNS ayarları; değişiklik onaylanmazsa 2 dk içinde otomatik geri alma
- Çoklu hat (mwan3): ikinci hattı ekleme, yedek hat ya da yük dengeleme, hat başına durum ve ping
- Bağlantı geçmişi (hat koptu / geldi) ve 30 günlük **kesinti raporu** (sayı, toplam ve en uzun süre,
  erişilebilirlik yüzdesi; operatöre şikâyet için kopyalanabilir)
- Hız testi (hat seçerek), günlük zamanlanmış hız testi, ping ve paket kaybı geçmişi
- SQM (bufferbloat önleme) ve oyun önceliği, önerilen değerleri tek tıkla uygulama

### Cihazlar
- Çevrimiçi / çevrimdışı, Wi-Fi sinyali, canlı ↓/↑ hız, isim ve tür verme
- Sabit IP ataması, cihaz başına hız sınırı, internet engeli, öncelik
- Ebeveyn kontrolü: cihaz başına gün/saat planı (ör. hafta içi 23:00–07:00 internet kapalı);
  AdGuard ile cihaz başına yetişkin içerik filtresi, güvenli arama, YouTube/TikTok gibi servis engeli
- Yeni cihaz uyarısı (isteğe bağlı otomatik engel), eve geldi / ayrıldı bildirimi
- **Cihaz başına internet hattı** (iki hat varsa): "önce Turknet, koparsa diğeri" ya da "yalnız ikinci hat"
- Cihaz başına anlık bağlantılar, günlük trafik istatistiği (30-100 gün)
- **Uygulama bazlı trafik**: YouTube, Netflix, Steam, TikTok… hangi cihaz neye ne kadar harcadı
  (bugün / 7 / 30 gün, cihaz filtresi). Servisler AdGuard Home'un DNS kayıtlarından tanınır;
  AdGuard yoksa porta göre kaba tahmin yapılır. Ek paket gerekmez (conntrack + ucode).

### Ağ ve güvenlik
- Fiziksel portlar: kablo takılı mı, bağlantı hızı (1 / 2.5 Gbit…), kopma sayısı, canlı trafik,
  düşük hız / half duplex uyarısı
- Yerel ağ: router IP'si, DHCP aralığı, kira süresi, DNS (IP değişiminde 3 dk geri alma)
- Port yönlendirme (hazır şablonlar, çakışma kontrolü), UPnP, DMZ; CGNAT / modem arkası uyarısı
- Güvenlik duvarı: internetten gelen ping'e yanıt, flow offloading aç/kapa
- Giriş deneme sınırı (NetOS/LuCI/SSH: 5 hatada 5-15-60 dk kilit), HTTPS, otomatik oturum kapatma
- WireGuard VPN sunucusu (cihaz başına QR kod), Cloudflare Tunnel (port açmadan dışarıdan erişim)
- Reklam engelleme (AdGuard Home, tek tıkla kurulum)
- Ağ tarayıcı: IP tarama, cihaz tipi tahmini, açık port, Wake-on-LAN, CSV

### Wi-Fi
- OpenWrt Wi-Fi: aç/kapa, ağ adı, şifre; QR kod ile paylaşma
- Huawei WiFi AX2 / WS5200: aç/kapa, ağ adı, şifre, kanal, kanal analizi
- **Misafir Wi-Fi** (Huawei misafir ağı): aç/kapa, ad, şifreli/açık, 4 saat / 1 gün / sınırsız süre,
  kalan süre ve +30 dk, misafirlere toplam hız sınırı, QR ile paylaşma
- TP-Link Archer BE230 (deneysel)

### Sistem
- Telegram bildirimleri (hat, yeni cihaz, varlık, sistem uyarıları)
- Sıcaklık / disk / bellek uyarıları, zamanlı yeniden başlatma, sistem günlüğü
- Ayar yedeği indir / geri yükle, saat dilimi
- GitHub'dan tek tıkla güncelleme, isteğe bağlı gece otomatik güncelleme

### Yol haritası
Keenetic gibi hazır router'larda olup NetOS'ta henüz olmayanlar (önem sırasıyla):
- IPv6 ayarları (operatör veriyorsa açma, cihazlara dağıtma)
- VPN istemcisi: seçilen cihazları dışarıdaki bir VPN üzerinden çıkarmak
- Wi-Fi zaman planı (ör. gece 01:00–07:00 Wi-Fi kapalı; Huawei üzerinden)
- IPsec / OpenVPN / L2TP VPN sunucusu (şu an yalnız WireGuard)
- Mobil uygulama (şimdilik panel telefona uyumlu, dışarıdan erişim Cloudflare Tunnel ile)

Donanıma bağlı olanlar: mesh Wi-Fi sistemi, USB (dosya paylaşımı, yazıcı, 4G yedek hat),
802.11r kopmadan geçiş ve OpenWrt Wi-Fi kanal analizi — router'ın kendi Wi-Fi'si ya da USB'si yoksa uygulanamaz.

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

Sonrası için adım adım anlatım: [Kullanım kılavuzu](docs/KULLANIM.md).

## Entegrasyonlar
NetOS → Entegrasyon menüsünden ihtiyacınız olanı açın; kapalı olanlar arayüzde görünmez.

| Entegrasyon | Ne yapar | Durum |
|---|---|---|
| Huawei WiFi AX2 / WS5200 | Wi-Fi aç/kapa, ağ adı, şifre, kanal, kanal analizi, misafir ağı | Hazır (AX2 + OpenWrt 25.12 üzerinde doğrulandı) |
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
- Uygulama bazlı trafik ve cihaz başına hat kuralı şimdilik yalnız IPv4'ü kapsar.

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
    usr/libexec/rpcd/netpanel      ubus nesnesi: clients, status, set_client, forget_client, set_wifi…
    usr/libexec/netpanel/          yardımcı betikler (wanctl.sh, huawei.sh, apps.uc, collect.sh…)
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
