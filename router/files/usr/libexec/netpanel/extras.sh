#!/bin/sh
# NetOS ek özellikler (rpcd eklentisi stdin'den JSON argüman verir)
#   usage_get   {days}            -> günlük kullanım (cihaz + WAN)
#   ping_get    {hours}           -> WAN ping/kayıp örnekleri
#   newdev_list {}                -> yeni cihaz kayıtları; newdev_ack {} -> görüldü işaretle
#   notify_get  {} / notify_set {enabled, token, chat_id, wan, newdev, block_new} / notify_test {}
#   tz_get {} / tz_set {zone}     -> saat dilimi
#   backup_create {} / backup_restore {data}
#   integ_get {} / integ_set {id, enabled}  -> entegrasyonları aç/kapa

. "${NP_COMMON:-/usr/share/netpanel/common.sh}"

DATA=${NP_DATA:-/etc/netpanel}
err() { uci -q revert netpanel; uci -q revert system; printf '{"ok":false,"error":"%s"}\n' "$1"; exit 0; }
num() { case "$1" in '' | *[!0-9]*) return 1 ;; esac; }

usage_get() {
	local input days i f d first=1
	input=$(cat); json_load "$input" 2>/dev/null
	json_get_var days days; num "$days" || days=31; [ "$days" -le 100 ] || days=100
	printf '{"days":['
	i=0
	while [ $i -lt "$days" ]; do
		d=$(date -d "@$(($(date +%s) - i * 86400))" +%Y-%m-%d 2>/dev/null) || break
		f="$DATA/usage/$d.tsv"
		if [ -f "$f" ]; then
			[ $first = 1 ] || printf ','
			first=0
			printf '{"date":"%s","items":[' "$d"
			awk -F'\t' '{ printf "%s[\"%s\",%s,%s]", (NR > 1 ? "," : ""), $1, $2 + 0, $3 + 0 }' "$f"
			printf ']}'
		fi
		i=$((i + 1))
	done
	printf ']}\n'
}

ping_get() {
	local input hours since f
	input=$(cat); json_load "$input" 2>/dev/null
	json_get_var hours hours; num "$hours" || hours=24; [ "$hours" -le 168 ] || hours=168
	since=$(($(date +%s) - hours * 3600))
	printf '{"samples":['
	for f in $(ls "$DATA/ping/"*.tsv 2>/dev/null | tail -n $((hours / 24 + 2))); do cat "$f"; done |
		awk -F'\t' -v s="$since" '$1 >= s { printf "%s[%d,\"%s\",%s,%s]", (n++ ? "," : ""), $1, $2, ($3 == "null" || $3 == "" ? "null" : $3), $4 + 0 }'
	printf ']}\n'
}

newdev_list() {
	local seen
	seen=$(cat "$DATA/newdev.seen" 2>/dev/null); num "$seen" || seen=0
	printf '{"block_new":%s,"seen":%d,"items":[' "$([ "$(uci -q get netpanel.main.block_new)" = 1 ] && echo true || echo false)" "$seen"
	[ -f "$DATA/newdev.log" ] && tail -n 100 "$DATA/newdev.log" | sed '1!G;h;$!d' |
		awk -F'\t' -v s="$seen" '
			function esc(x) { gsub(/\\/, "\\\\", x); gsub(/"/, "\\\"", x); return x }
			{ printf "%s{\"t\":%d,\"mac\":\"%s\",\"ip\":\"%s\",\"hostname\":\"%s\",\"unseen\":%s}", (n++ ? "," : ""), $1, $2, $3, esc($4), ($1 > s ? "true" : "false") }'
	printf ']}\n'
}
newdev_ack() { date +%s >"$DATA/newdev.seen"; echo '{"ok":true}'; }

notify_get() {
	json_init
	json_add_boolean enabled "$([ "$(uci -q get netpanel.notify.enabled)" = 1 ] && echo 1 || echo 0)"
	json_add_string chat_id "$(uci -q get netpanel.notify.chat_id)"
	json_add_boolean token_set "$([ -n "$(uci -q get netpanel.notify.token)" ] && echo 1 || echo 0)"
	json_add_boolean wan "$([ "$(uci -q get netpanel.notify.wan)" = 0 ] && echo 0 || echo 1)"
	json_add_boolean newdev "$([ "$(uci -q get netpanel.notify.newdev)" = 0 ] && echo 0 || echo 1)"
	json_add_boolean block_new "$([ "$(uci -q get netpanel.main.block_new)" = 1 ] && echo 1 || echo 0)"
	json_add_boolean curl "$(command -v curl >/dev/null && echo 1 || echo 0)"
	json_dump
}
notify_set() {
	local input t v
	input=$(cat); json_load "$input" 2>/dev/null || err "Geçersiz istek"
	[ "$(uci -q get netpanel.notify)" = notify ] || uci set netpanel.notify=notify
	if json_get_type t token; then
		json_get_var v token
		if [ -n "$v" ]; then
			echo "$v" | grep -qE '^[0-9]{5,12}:[A-Za-z0-9_-]{30,50}$' || err "Telegram bot token biçimi hatalı (ör. 123456789:AAH...)"
			uci set "netpanel.notify.token=$v"
		fi
	fi
	if json_get_type t chat_id; then
		json_get_var v chat_id
		echo "$v" | grep -qE '^-?[0-9]{3,20}$' || err "Chat ID sayı olmalı (gruplar için eksi ile başlar)"
		uci set "netpanel.notify.chat_id=$v"
	fi
	for k in enabled wan newdev; do
		if json_get_type t "$k"; then json_get_var v "$k"; [ "$v" = 1 ] && uci set "netpanel.notify.$k=1" || uci set "netpanel.notify.$k=0"; fi
	done
	if json_get_type t block_new; then
		json_get_var v block_new; [ "$v" = 1 ] && uci set netpanel.main.block_new=1 || uci -q delete netpanel.main.block_new
	fi
	uci commit netpanel
	chmod 600 /etc/config/netpanel 2>/dev/null
	echo '{"ok":true}'
}
notify_test() {
	local code
	command -v curl >/dev/null || err "curl kurulu değil"
	code=$(np_notify "Test mesajı — bildirimler çalışıyor ✅" test)
	case "$code" in
	200) echo '{"ok":true}' ;;
	401 | 404) err "Bot token geçersiz (Telegram $code)" ;;
	400 | 403) err "Chat ID hatalı veya bot bu sohbete mesaj atamıyor; bota önce /start yazın (Telegram $code)" ;;
	'') err "Token veya Chat ID eksik" ;;
	*) err "Telegram'a ulaşılamadı ($code)" ;;
	esac
}

# Saat dilimi: OpenWrt zonename + POSIX TZ (Türkiye 2016'dan beri sabit UTC+3, yaz saati yok)
tz_get() {
	printf '{"zonename":"%s","timezone":"%s","now":"%s","offset":"%s"}\n' \
		"$(uci -q get system.@system[0].zonename)" "$(uci -q get system.@system[0].timezone)" "$(date '+%Y-%m-%d %H:%M')" "$(date +%z)"
}
tz_set() {
	local input z tz
	input=$(cat); json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var z zone
	case "$z" in
	Europe/Istanbul) tz='<+03>-3' ;;
	UTC) tz='UTC' ;;
	Europe/Berlin) tz='CET-1CEST,M3.5.0,M10.5.0/3' ;;
	Europe/London) tz='GMT0BST,M3.5.0/1,M10.5.0' ;;
	*) err "Desteklenmeyen saat dilimi" ;;
	esac
	uci set "system.@system[0].zonename=$z"
	uci set "system.@system[0].timezone=$tz"
	uci commit system
	/etc/init.d/system reload >/dev/null 2>&1
	echo "$tz" >/tmp/TZ 2>/dev/null
	tz_get
}

backup_create() {
	local f=/tmp/netos-backup.tar.gz sz
	command -v openssl >/dev/null || err "openssl-util gerekli"
	rm -f "$f"
	sysupgrade -b "$f" >/dev/null 2>&1 || err "Yedek oluşturulamadı"
	sz=$(wc -c <"$f")
	[ "$sz" -lt 500000 ] || err "Yedek çok büyük ($sz bayt); LuCI > Yedekle bölümünü kullanın"
	printf '{"ok":true,"name":"netos-yedek-%s.tar.gz","size":%d,"data":"%s"}\n' "$(date +%Y%m%d-%H%M)" "$sz" "$(openssl base64 -A <"$f")"
	rm -f "$f"
}
backup_restore() {
	local input data f=/tmp/netos-restore.tar.gz
	input=$(cat); json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var data data
	[ -n "$data" ] || err "Yedek dosyası boş"
	printf '%s' "$data" | openssl base64 -d -A >"$f" 2>/dev/null || err "Dosya çözülemedi"
	tar -tzf "$f" 2>/dev/null | grep -q '^etc/config/' || { rm -f "$f"; err "Bu bir OpenWrt yedeği değil (etc/config yok)"; }
	sysupgrade -r "$f" >/dev/null 2>&1 || { rm -f "$f"; err "Yedek geri yüklenemedi"; }
	rm -f "$f"
	# yanıt döndükten sonra yeniden başlat
	(sleep 3; reboot) >/dev/null 2>&1 </dev/null &
	echo '{"ok":true,"rebooting":true}'
}

# ── entegrasyonlar: hangi eklentinin arayüzde açık olduğu ───────────────────
# netpanel.integrations.<ad> = 0|1 (cloudflare, scanner, vpn, adguard). Huawei kendi netpanel.huawei.enabled ayarını kullanır.
INTEGS="cloudflare scanner vpn adguard"
integ_on() { # ad -> 0|1 (ayar yoksa varsayılan: zaten kuruluysa açık başlar)
	local v
	v=$(uci -q get "netpanel.integrations.$1")
	[ -n "$v" ] && { echo "$v"; return; }
	case "$1" in
	cloudflare) [ -n "$(uci -q get cloudflared.config.token)" ] && echo 1 || echo 0 ;;
	vpn) [ "$(uci -q get network.netos_wg)" = interface ] && echo 1 || echo 0 ;;
	adguard) [ -n "$(uci -q get dhcp.@dnsmasq[0].port)" ] && [ "$(uci -q get dhcp.@dnsmasq[0].port)" != 53 ] && echo 1 || echo 0 ;;
	*) echo 0 ;;
	esac
}
jbool() { [ "$1" = 1 ] && echo true || echo false; }
integ_get() {
	printf '{"huawei":%s,"tplink":%s,"cloudflare":%s,"scanner":%s,"vpn":%s,"adguard":%s,"cloudflared":%s,"adguardhome":%s,"curl":%s}\n' \
		"$(jbool "$(uci -q get netpanel.huawei.enabled)")" "$(jbool "$(uci -q get netpanel.tplink.enabled)")" \
		"$(jbool "$(integ_on cloudflare)")" "$(jbool "$(integ_on scanner)")" "$(jbool "$(integ_on vpn)")" "$(jbool "$(integ_on adguard)")" \
		"$([ -x /usr/bin/cloudflared ] && echo true || echo false)" "$([ -x /usr/bin/AdGuardHome ] && echo true || echo false)" \
		"$(command -v curl >/dev/null && echo true || echo false)"
}
integ_set() {
	local input id en
	input=$(cat); json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var id id; json_get_var en enabled
	[ "$en" = 1 ] || en=0
	case "$id" in
	huawei)
		[ "$(uci -q get netpanel.huawei)" = huawei ] || uci set netpanel.huawei=huawei
		uci set "netpanel.huawei.enabled=$en" ;;
	cloudflare | scanner | vpn | adguard)
		[ "$(uci -q get netpanel.integrations)" = integrations ] || uci set netpanel.integrations=integrations
		uci set "netpanel.integrations.$id=$en" ;;
	*) err "Bilinmeyen entegrasyon" ;;
	esac
	uci commit netpanel
	echo '{"ok":true}'
}

# ── TP-Link bağlantı ayarları (şifre yalnız router'da, geri gönderilmez) ──
tp_config() {
	local input t v
	input=$(cat); json_load "$input" 2>/dev/null || err "Geçersiz istek"
	[ "$(uci -q get netpanel.tplink)" = tplink ] || uci set netpanel.tplink=tplink
	if json_get_type t host; then json_get_var v host; np_valid_ip "$v" || err "Geçersiz TP-Link IP adresi"; uci set "netpanel.tplink.host=$v"; fi
	if json_get_type t username; then json_get_var v username; case "$v" in '' | *[!A-Za-z0-9_.@-]*) v=admin ;; esac; uci set "netpanel.tplink.username=$v"; fi
	if json_get_type t password; then json_get_var v password; [ -n "$v" ] && uci set "netpanel.tplink.password=$v"; fi
	if json_get_type t enabled; then json_get_var v enabled; uci set "netpanel.tplink.enabled=$([ "$v" = 1 ] && echo 1 || echo 0)"; fi
	uci commit netpanel
	rm -f /tmp/netpanel-tp/session
	echo '{"ok":true}'
}

# ── zamanlanmış hız testi (collect.sh dakikalık çalışırken saati gelince başlatır) ──
st_sched_get() {
	printf '{"enabled":%s,"hour":%d,"wan":"%s"}\n' "$(jbool "$(uci -q get netpanel.stsched.enabled)")" \
		"$(uci -q get netpanel.stsched.hour || echo 4)" "$(uci -q get netpanel.stsched.wan)"
}
st_sched_set() {
	local input en h w
	input=$(cat); json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var en enabled; json_get_var h hour; json_get_var w wan
	num "$h" && [ "$h" -le 23 ] || err "Saat 0-23 arasında olmalı"
	case "$w" in *[!A-Za-z0-9_.-]*) err "Geçersiz hat" ;; esac
	[ -z "$w" ] || [ "$w" = all ] || np_wan_nets | grep -qx "$w" || err "Bilinmeyen internet hattı"
	[ "$(uci -q get netpanel.stsched)" = stsched ] || uci set netpanel.stsched=stsched
	uci set "netpanel.stsched.enabled=$([ "$en" = 1 ] && echo 1 || echo 0)"
	uci set "netpanel.stsched.hour=$h"
	uci set "netpanel.stsched.wan=$w"
	uci commit netpanel
	echo '{"ok":true}'
}

case "$1" in
usage_get | ping_get | newdev_list | newdev_ack | notify_get | notify_set | notify_test | tz_get | tz_set | backup_create | backup_restore | integ_get | integ_set | st_sched_get | st_sched_set | tp_config) "$1" ;;
*) echo "kullanım: $0 <komut>" >&2; exit 1 ;;
esac
