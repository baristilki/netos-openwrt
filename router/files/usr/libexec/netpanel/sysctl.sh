#!/bin/sh
# NetOS sistem: güvenlik, günlük, uyarılar, zamanlı yeniden başlatma, ilk kurulum sihirbazı
#   sysctl.sh sec_get              -> {root_pw_empty, https_available, https_redirect, wizard_done, tunnel_http_hosts}
#   sysctl.sh sec_https  {redirect}-> http isteklerini https'e yönlendir (uhttpd redirect_https)
#   sysctl.sh wizard_done          -> ilk kurulum sihirbazı tamamlandı
#   sysctl.sh log_get {lines, q, level} -> sistem günlüğü (logread), en yeni sonda
#   sysctl.sh sysopt_get / sysopt_set {reboot_mode, reboot_hour, reboot_day, alerts}
#   sysctl.sh check                -> (collect.sh'den dakikalık) uyarılar + zamanlı yeniden başlatma

. "${NP_COMMON:-/usr/share/netpanel/common.sh}"

RUN=${NP_RUN:-/tmp/netpanel-collect}
err() { uci -q revert netpanel; uci -q revert uhttpd; printf '{"ok":false,"error":"%s"}\n' "$1"; exit 0; }
jb() { [ "$1" = 1 ] && echo true || echo false; }
num() { case "$1" in '' | *[!0-9]*) return 1 ;; esac; }
jstr() { printf '"%s"' "$(printf '%s' "$1" | sed 's/[\\"]/\\&/g' | tr -d '\000-\037')"; }

# TLS kütüphanesi + sertifika (ya da sertifikayı üretecek px5g)
https_available() { ls /usr/lib/libustream-ssl*.so* /lib/libustream-ssl*.so* >/dev/null 2>&1 && { [ -x /usr/bin/px5g ] || [ -s /etc/uhttpd.crt ]; }; }

sec_get() {
	local empty=0 hosts
	awk -F: '$1 == "root" { exit ($2 == "" ? 0 : 1) }' /etc/shadow 2>/dev/null && empty=1
	# Cloudflare tüneli panele http (80) üzerinden gidiyorsa https yönlendirmesi döngü yapar
	hosts=$(uci -q get netpanel.cloudflare.host | tr ' ' '\n' | awk -F'|' -v ip="$(uci -q get network.lan.ipaddr | cut -d/ -f1)" '$2 ~ "^http://" ip "(:80)?/?$" { printf "%s%s", (n++ ? "," : ""), $1 }')
	printf '{"root_pw_empty":%s,"https_available":%s,"https_redirect":%s,"wizard_done":%s,"strict_login":%s,"tunnel_http_hosts":%s}\n' \
		"$(jb $empty)" "$(https_available && echo true || echo false)" "$(jb "$(uci -q get uhttpd.main.redirect_https)")" \
		"$(jb "$(uci -q get netpanel.main.wizard)")" "$(strict_on && echo true || echo false)" "$(jstr "$hosts")"
}

sec_https() {
	local input r
	input=$(cat); json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var r redirect
	https_available || err "HTTPS paketi kurulu değil"
	uci set "uhttpd.main.redirect_https=$([ "$r" = 1 ] && echo 1 || echo 0)"
	uci commit uhttpd
	# yanıt döndükten sonra yeniden başlat (bu bağlantı kopar)
	(sleep 2; /etc/init.d/uhttpd restart) >/dev/null 2>&1 </dev/null &
	echo '{"ok":true}'
}

# Sıkı giriş: web'den doğrudan ubus session.login kapalı; giriş yalnız NetOS geçidi (deneme sınırlı)
# ve LuCI formu (günlükten izlenir) üzerinden. Home Assistant gibi ubus entegrasyonları giriş yapamaz.
UNAUTH=/usr/share/rpcd/acl.d/unauthenticated.json
strict_on() { [ -f "$UNAUTH" ] && ! grep -q '"login"' "$UNAUTH"; }
sec_strict() {
	local input en
	input=$(cat); json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var en enabled
	[ -f /www/cgi-bin/netos-auth ] || err "NetOS giriş geçidi kurulu değil"
	if [ "$en" = 1 ]; then
		[ -f /etc/netpanel/unauthenticated.json.orig ] || cp "$UNAUTH" /etc/netpanel/unauthenticated.json.orig
		printf '{\n\t"unauthenticated": {\n\t\t"description": "Access controls for unauthenticated requests (NetOS: login via /cgi-bin/netos-auth)",\n\t\t"read": { "ubus": { "session": [ "access" ] } }\n\t}\n}\n' >"$UNAUTH"
	else
		if [ -f /etc/netpanel/unauthenticated.json.orig ]; then cp /etc/netpanel/unauthenticated.json.orig "$UNAUTH"
		else printf '{\n\t"unauthenticated": {\n\t\t"description": "Access controls for unauthenticated requests",\n\t\t"read": { "ubus": { "session": [ "access", "login" ] } }\n\t}\n}\n' >"$UNAUTH"; fi
	fi
	/etc/init.d/rpcd reload >/dev/null 2>&1
	echo '{"ok":true}'
}

wizard_done() {
	uci set netpanel.main.wizard=1
	uci commit netpanel
	echo '{"ok":true}'
}

log_get() {
	local input lines q level
	input=$(cat); json_load "$input" 2>/dev/null
	json_get_var lines lines; json_get_var q q; json_get_var level level
	num "$lines" || lines=200; [ "$lines" -le 1000 ] || lines=1000
	case "$level" in err) level='\.(err|crit|alert|emerg)' ;; warn) level='\.(warn|err|crit|alert|emerg)' ;; *) level='' ;; esac
	q=$(printf '%s' "$q" | tr -d '\000-\037' | cut -c1-60)
	printf '{"lines":['
	logread 2>/dev/null | { [ -n "$level" ] && grep -E "$level" || cat; } | { [ -n "$q" ] && grep -F -i -- "$q" || cat; } | tail -n "$lines" |
		sed 's/[\\"]/\\&/g' | tr -d '\000-\010\013-\037' | awk 'NR > 1 { printf "," } { printf "\"%s\"", $0 }'
	printf ']}\n'
}

sysopt_get() {
	printf '{"reboot_mode":"%s","reboot_hour":%d,"reboot_day":%d,"alerts":%s,"temp_limit":%d}\n' \
		"$(uci -q get netpanel.sysopt.reboot_mode || echo off)" "$(uci -q get netpanel.sysopt.reboot_hour || echo 5)" \
		"$(uci -q get netpanel.sysopt.reboot_day || echo 1)" "$(jb "$(uci -q get netpanel.sysopt.alerts || echo 1)")" \
		"$(uci -q get netpanel.sysopt.temp_limit || echo 85)"
}
sysopt_set() {
	local input m h d a
	input=$(cat); json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var m reboot_mode; json_get_var h reboot_hour; json_get_var d reboot_day; json_get_var a alerts
	case "$m" in off | daily | weekly) ;; *) err "Geçersiz yeniden başlatma seçeneği" ;; esac
	num "$h" && [ "$h" -le 23 ] || err "Saat 0-23 arasında olmalı"
	num "$d" && [ "$d" -ge 1 ] && [ "$d" -le 7 ] || d=1
	[ "$(uci -q get netpanel.sysopt)" = sysopt ] || uci set netpanel.sysopt=sysopt
	uci set "netpanel.sysopt.reboot_mode=$m"
	uci set "netpanel.sysopt.reboot_hour=$h"
	uci set "netpanel.sysopt.reboot_day=$d"
	uci set "netpanel.sysopt.alerts=$([ "$a" = 1 ] && echo 1 || echo 0)"
	uci commit netpanel
	echo '{"ok":true}'
}

# ── dakikalık kontrol ───────────────────────────────────────────────────────
# eşik aşılınca bir kez bildir; değer eşiğin 5 altına inince yeniden kurulur
alert() { # anahtar değer eşik mesaj
	local f="$RUN/alert.$1"
	if [ "$2" -ge "$3" ]; then
		[ -f "$f" ] && return 0
		touch "$f"
		logger -t netos "uyarı: $4"
		np_notify "⚠️ $4" system >/dev/null 2>&1
	elif [ "$2" -lt $(($3 - 5)) ] && [ -f "$f" ]; then
		rm -f "$f"
	fi
}
check() {
	mkdir -p "$RUN"
	if [ "$(uci -q get netpanel.sysopt.alerts || echo 1)" = 1 ]; then
		local t f max=0 disk mem
		for f in /sys/class/thermal/thermal_zone*/temp /sys/class/hwmon/hwmon*/temp*_input; do
			[ -r "$f" ] || continue
			t=$(($(cat "$f" 2>/dev/null || echo 0) / 1000))
			[ "$t" -gt "$max" ] && max=$t
		done
		[ "$max" -gt 0 ] && alert temp "$max" "$(uci -q get netpanel.sysopt.temp_limit || echo 85)" "İşlemci sıcaklığı yüksek: ${max}°C"
		disk=$(df -k /overlay 2>/dev/null | awk 'NR == 2 { gsub("%", "", $5); print $5 }')
		[ -n "$disk" ] || disk=$(df -k / | awk 'NR == 2 { gsub("%", "", $5); print $5 }')
		alert disk "${disk:-0}" 90 "Depolama alanı dolmak üzere: %${disk}"
		mem=$(awk '/^MemTotal/ { t = $2 } /^MemAvailable/ { a = $2 } END { printf "%d", (t - a) * 100 / t }' /proc/meminfo)
		alert mem "${mem:-0}" 92 "Bellek kullanımı çok yüksek: %${mem}"
	fi
	# zamanlı yeniden başlatma (açılıştan 15 dk geçmeden asla: döngü olmasın)
	local m h up
	m=$(uci -q get netpanel.sysopt.reboot_mode)
	[ "$m" = daily ] || [ "$m" = weekly ] || return 0
	h=$(uci -q get netpanel.sysopt.reboot_hour || echo 5)
	[ "$(date +%H:%M)" = "$(printf '%02d:00' "$h")" ] || return 0
	[ "$m" = weekly ] && [ "$(date +%u)" != "$(uci -q get netpanel.sysopt.reboot_day || echo 1)" ] && return 0
	up=$(cut -d. -f1 /proc/uptime)
	[ "$up" -ge 900 ] || return 0
	logger -t netos "zamanlı yeniden başlatma"
	[ -n "$NP_DRYRUN" ] && { echo "DRYRUN: reboot"; return 0; }
	reboot
}

case "$1" in
sec_get | sec_https | sec_strict | wizard_done | log_get | sysopt_get | sysopt_set | check) "$1" ;;
*) echo "kullanım: $0 sec_get|sec_https|wizard_done|log_get|sysopt_get|sysopt_set|check" >&2; exit 1 ;;
esac
exit 0
