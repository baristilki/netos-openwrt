#!/bin/sh
# NetPanel kurulumu — router üzerinde çalıştırılır:  sh /tmp/netpanel/install.sh
set -e
SRC=$(cd "$(dirname "$0")" && pwd)/files

echo "[1/5] Dosyalar kopyalanıyor"
mkdir -p /www/netpanel /usr/share/netpanel /usr/libexec/rpcd /usr/libexec/netpanel /usr/share/rpcd/acl.d /etc/hotplug.d/dhcp /etc/hotplug.d/iface /etc/netpanel
cp -f "$SRC/usr/share/netpanel/common.sh" /usr/share/netpanel/
cp -f "$SRC/usr/libexec/netpanel/"* /usr/libexec/netpanel/
cp -f "$SRC/usr/libexec/rpcd/netpanel" /usr/libexec/rpcd/
cp -f "$SRC/usr/sbin/netpanel-apply" /usr/sbin/
cp -f "$SRC/usr/share/rpcd/acl.d/netpanel.json" /usr/share/rpcd/acl.d/
cp -f "$SRC/etc/init.d/netpanel" /etc/init.d/
cp -f "$SRC/etc/hotplug.d/dhcp/90-netpanel" /etc/hotplug.d/dhcp/
cp -f "$SRC/etc/hotplug.d/iface/90-netpanel" /etc/hotplug.d/iface/
[ -f /etc/config/netpanel ] || cp "$SRC/etc/config/netpanel" /etc/config/
cp -rf "$SRC/www/netpanel/." /www/netpanel/

# Windows'tan gelen CRLF satır sonlarını temizle
for f in /usr/share/netpanel/common.sh /usr/libexec/rpcd/netpanel /usr/sbin/netpanel-apply /usr/libexec/netpanel/* \
	/etc/init.d/netpanel /etc/hotplug.d/dhcp/90-netpanel /etc/hotplug.d/iface/90-netpanel /etc/config/netpanel; do
	sed -i 's/\r$//' "$f"
done
chmod 755 /usr/libexec/rpcd/netpanel /usr/sbin/netpanel-apply /usr/libexec/netpanel/* \
	/etc/init.d/netpanel /etc/hotplug.d/dhcp/90-netpanel /etc/hotplug.d/iface/90-netpanel
chmod 600 /etc/config/netpanel

# Dakikalık toplayıcı: trafik istatistiği, ping geçmişi, saat planı (mevcut cron satırlarına dokunmadan ekle)
CRON="* * * * * /usr/libexec/netpanel/collect.sh >/dev/null 2>&1"
mkdir -p /etc/crontabs
touch /etc/crontabs/root
grep -qF "/usr/libexec/netpanel/collect.sh" /etc/crontabs/root || echo "$CRON" >>/etc/crontabs/root
/etc/init.d/cron enable
/etc/init.d/cron restart
# yeni cihaz bildirimi: şu an ağda olan cihazları "bilinen" say (kurulumda bildirim yağmasın)
/usr/libexec/netpanel/collect.sh seed

# Huawei Wi-Fi köprüsü için curl + openssl
if ! command -v curl >/dev/null || ! command -v openssl >/dev/null; then
	echo "  curl / openssl-util kuruluyor (Huawei Wi-Fi kontrolü için)"
	if command -v apk >/dev/null; then
		apk update >/dev/null && apk add curl openssl-util || echo "  UYARI: paketler kurulamadı"
	else
		opkg update >/dev/null && opkg install curl openssl-util || echo "  UYARI: paketler kurulamadı"
	fi
fi

echo "[2/5] Web sunucusu kontrol ediliyor"
if [ -z "$(uci -q get uhttpd.main.ubus_prefix)" ]; then
	uci set uhttpd.main.ubus_prefix=/ubus
	uci commit uhttpd
fi
[ -e /usr/lib/uhttpd_ubus.so ] || echo "  UYARI: uhttpd-mod-ubus yok -> opkg install uhttpd-mod-ubus  (apk add uhttpd-mod-ubus)"
command -v iwinfo >/dev/null || echo "  UYARI: iwinfo yok, Wi-Fi istemci bilgisi görünmez"
command -v nft >/dev/null || echo "  UYARI: nft yok (fw4/OpenWrt 22.03+ gerekli), hız sınırı çalışmaz"

echo "[3/5] Servisler yeniden başlatılıyor"
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
/etc/init.d/dnsmasq restart   # dhcp hotplug'ın devreye girmesi için

echo "[4/5] Kurallar yükleniyor"
/etc/init.d/netpanel enable
/etc/init.d/netpanel start || echo "  UYARI: nft kuralları yüklenemedi, bkz. logread -e netpanel"

echo "[5/5] Test"
sleep 1
if ubus call netpanel status >/dev/null 2>&1; then
	ubus call netpanel status
else
	echo "  HATA: ubus nesnesi 'netpanel' bulunamadı (logread -e rpcd)"
	exit 1
fi

if [ "$(uci -q get system.@system[0].zonename)" = UTC ] || [ -z "$(uci -q get system.@system[0].zonename)" ]; then
	echo
	echo "  NOT: Saat dilimi UTC. Saat planının doğru çalışması için NetOS > Sistem > Saat dilimi'nden İstanbul seçin."
fi

if [ "$(uci -q get firewall.@defaults[0].flow_offloading)" = 1 ]; then
	echo
	echo "  NOT: Flow offloading açık. Hız sınırı ve canlı cihaz hızları için kapatın:"
	echo "       uci set firewall.@defaults[0].flow_offloading=0; uci set firewall.@defaults[0].flow_offloading_hw=0; uci commit firewall; fw4 reload"
fi

IP=$(uci -q get network.lan.ipaddr | cut -d/ -f1)
echo
echo "Kurulum tamam ->  http://${IP:-192.168.1.1}/netpanel/"
rm -rf /tmp/netpanel
