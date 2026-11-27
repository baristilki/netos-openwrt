# NetOS'a katkı

Katkılarınızı bekliyoruz: hata bildirimi, çeviri, yeni cihaz desteği (entegrasyon), arayüz iyileştirmesi.
*Contributions are welcome — issues and pull requests in English are fine too.*

## Geliştirme ortamı
Router olmadan çalışabilirsiniz: arayüz demo verisiyle açılır.

```powershell
npx http-server@14.1.1 router/files/www/netos -p 8765 -c-1
```
Tarayıcıda `http://localhost:8765/?mock=1` → herhangi bir şifreyle giriş.

Gerçek router'da denemek için README'deki kurulum adımları (scp + `install.sh`) yeterli.

## Kod yapısı
| Katman | Dosya | Not |
|---|---|---|
| Router API | `router/files/usr/libexec/rpcd/netpanel` | rpcd shell eklentisi, `ubus call netpanel <metot>` |
| Yardımcı betikler | `router/files/usr/libexec/netpanel/*.sh`, `cfctl.uc` | busybox `ash` / `ucode`; bash özelliği kullanmayın |
| İzinler | `router/files/usr/share/rpcd/acl.d/netpanel.json` | her yeni metot buraya eklenir |
| Veri katmanı | `router/files/www/netos/api.js` | ubus çağrıları + demo (mock) yanıtları |
| Arayüz | `router/files/www/netos/app.js`, `style.css` | framework yok, düz JS |

## Yeni entegrasyon (ör. başka bir Wi-Fi cihazı)
1. `usr/libexec/netpanel/<cihaz>.sh`: cihazla konuşan, JSON yazan betik. Şifreler yalnız
   `/etc/config/netpanel` içinde tutulur, arayüze geri gönderilmez.
2. `rpcd/netpanel`: `list` çıktısına metot imzası, `call` bölümüne yönlendirme; `acl.d`'ye izin.
3. `api.js`: fonksiyon + `mock` içinde demo yanıtı (router'sız test edilebilsin).
4. `app.js`: `INTEGRATIONS` listesine kayıt ve ayar kartı.

## Çeviri (English)
Arayüz metinleri Türkçe yazılır; İngilizce seçiliyse `www/netos/i18n.js` çizilen sayfadaki metinleri
`www/netos/i18n-en.js` sözlüğüyle çevirir. Anahtar, metnin kendisidir (sayılar `#` olur:
`"# çevrimiçi · # kayıtlı": "# online · # saved"`). Yeni bir metin eklerseniz sözlüğe karşılığını da ekleyin;
eksik olanlar Türkçe görünür. Çevrilmemesi gereken alanlara `data-no-i18n` verin.

## Kurallar
- Hedef: OpenWrt 22.03+ (fw4/nftables), ek paket gerektirmemek; gerekirse `install.sh` kurar.
- Kullanıcının ağına zarar verebilecek işlemler (yeniden başlatma, WAN değişikliği) onay ister,
  mümkünse otomatik geri alma içerir (bkz. `wanctl.sh`).
- Arayüz metinleri Türkçe; kod yorumları Türkçe ya da İngilizce olabilir.
- PR'dan önce: `node --check` ile JS sözdizimi, router'da `sh -n` ile betik sözdizimi.
- Kişisel veri (gerçek MAC, şifre, token) içeren demo verisi eklemeyin.

## Lisans
Katkılarınız projenin lisansı olan GPL-2.0 kapsamında yayımlanır.
