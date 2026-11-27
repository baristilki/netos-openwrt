#!/bin/sh
# NetOS kaldırma (sabit IP kayıtları dnsmasq'ta kalır, LuCI'den yönetilebilir)
/etc/init.d/netpanel stop 2>/dev/null
/etc/init.d/netpanel disable 2>/dev/null
# yalnız NetOS'un cron satırını kaldır
[ -f /etc/crontabs/root ] && sed -i '\#/usr/libexec/netpanel/collect.sh#d; \#/usr/libexec/netpanel/update.sh#d' /etc/crontabs/root && /etc/init.d/cron restart
rm -rf /www/netos /www/netpanel /usr/share/netpanel /usr/libexec/netpanel /tmp/netpanel-hw /tmp/netpanel-collect
rm -f /usr/libexec/rpcd/netpanel /usr/sbin/netpanel-apply /usr/share/rpcd/acl.d/netpanel.json \
	/etc/init.d/netpanel /etc/hotplug.d/dhcp/90-netpanel /etc/hotplug.d/iface/90-netpanel /tmp/netpanel.* /tmp/netpanel-*
echo "VPN (WireGuard) arayüzü ve port kuralları kalır; LuCI > Network / Firewall'dan silinebilir."
echo "Cihaz kayıtları ve istatistikler de silinsin mi? -> rm -r /etc/config/netpanel /etc/netpanel"
/etc/init.d/rpcd restart
echo "NetOS kaldırıldı."
