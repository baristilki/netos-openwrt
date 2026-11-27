#!/bin/sh
# NetOS SQM (Smart Queue Management) + flow offloading + hız testi yönetimi
#   sqmctl.sh config               -> JSON: SQM kuyrukları, betikler, offloading, WAN cihazları
#   sqmctl.sh set      < json      -> {section ('' = yeni), interface, enabled, download, upload (kbit/s),
#                                      script, linklayer (none|ethernet|atm), overhead}
#   sqmctl.sh delete   < json      -> {section}
#   sqmctl.sh offload  < json      -> {enabled}  (yazılım flow offloading; hız sınırı/öncelik için kapalı olmalı)
#   sqmctl.sh st_start < json      -> {wan ('' | ad | 'all'), mode ('' | single | sequential | combined)}
#   sqmctl.sh st_status            -> JSON: çalışan/son test + geçmiş

. "${NP_COMMON:-/usr/share/netpanel/common.sh}"

CONF=${NP_CONF:-/etc/config}
ST_OUT=${NP_ST_OUT:-/tmp/netpanel-speedtest.json}
ST_HIST=${NP_ST_HIST:-/etc/netpanel/speedtest.log}
svc() { [ -n "$NP_DRYRUN" ] && { echo "DRYRUN: $*" >&2; return 0; }; "$@" >/dev/null 2>&1; }
err() { uci -q revert sqm; uci -q revert firewall; printf '{"ok":false,"error":"%s"}\n' "$1"; exit 0; }
num() { case "$1" in '' | *[!0-9]*) return 1 ;; esac; }

config() {
	local s v n d
	json_init
	json_add_boolean installed "$([ -f "$CONF/sqm" ] && [ -x /etc/init.d/sqm ] && echo 1 || echo 0)"
	json_add_boolean offload "$([ "$(uci -q get firewall.@defaults[0].flow_offloading)" = 1 ] && echo 1 || echo 0)"
	json_add_boolean offload_hw "$([ "$(uci -q get firewall.@defaults[0].flow_offloading_hw)" = 1 ] && echo 1 || echo 0)"
	json_add_array scripts
	for s in /usr/lib/sqm/*.qos; do [ -f "$s" ] && json_add_string "" "${s##*/}"; done
	json_close_array
	# WAN'lar ve fiziksel cihazları (SQM genelde fiziksel porta kurulur: eth1, eth2)
	json_add_array wans
	for n in $(np_wan_nets); do
		d=$(uci -q get "network.$n.device")
		v=$(uci -q show network | sed -n "s/^network\.\([^.]*\)\.name='$d'$/\1/p" | head -1)
		[ -n "$v" ] && [ "$(uci -q get "network.$v.type")" = 8021q ] && d=$(uci -q get "network.$v.ifname")
		json_add_object
		json_add_string name "$n"; json_add_string device "$d"; json_add_string l3_device "$(np_ifdev "$n")"
		json_close_object
	done
	json_close_array
	json_add_array queues
	for s in $(uci -q show sqm | sed -n "s/^sqm\.\([^.]*\)=queue$/\1/p"); do
		json_add_object
		json_add_string section "$s"
		json_add_boolean enabled "$([ "$(uci -q get "sqm.$s.enabled")" = 1 ] && echo 1 || echo 0)"
		json_add_string interface "$(uci -q get "sqm.$s.interface")"
		json_add_int download "$(uci -q get "sqm.$s.download" || echo 0)"
		json_add_int upload "$(uci -q get "sqm.$s.upload" || echo 0)"
		json_add_string qdisc "$(uci -q get "sqm.$s.qdisc")"
		json_add_string script "$(uci -q get "sqm.$s.script")"
		json_add_string linklayer "$(uci -q get "sqm.$s.linklayer" || echo none)"
		json_add_int overhead "$(uci -q get "sqm.$s.overhead" || echo 0)"
		json_add_boolean active "$(tc qdisc show dev "$(uci -q get "sqm.$s.interface")" 2>/dev/null | grep -qE 'cake|fq_codel|htb' && echo 1 || echo 0)"
		json_close_object
	done
	json_close_array
	json_dump
}

set_queue() {
	local input s t v ifc
	input=$(cat)
	json_load "$input" 2>/dev/null || err "Geçersiz istek"
	[ -f "$CONF/sqm" ] || err "sqm-scripts kurulu değil"
	json_get_var s section
	if [ -n "$s" ]; then
		case "$s" in *[!A-Za-z0-9_]*) err "Geçersiz bölüm" ;; esac
		[ "$(uci -q get "sqm.$s")" = queue ] || err "SQM kuyruğu bulunamadı"
	else
		s=$(uci add sqm queue)
		uci set "sqm.$s.qdisc=cake"; uci set "sqm.$s.script=piece_of_cake.qos"
		uci set "sqm.$s.debug_logging=0"; uci set "sqm.$s.verbosity=5"
	fi
	if json_get_type t interface; then
		json_get_var ifc interface
		case "$ifc" in '' | *[!A-Za-z0-9._-]*) err "Geçersiz arayüz" ;; esac
		[ -e "/sys/class/net/$ifc" ] || [ -n "$NP_DRYRUN" ] || err "Arayüz bulunamadı: $ifc"
		uci set "sqm.$s.interface=$ifc"
	fi
	[ -n "$(uci -q get "sqm.$s.interface")" ] || err "Arayüz seçilmeli"
	for t in download upload; do
		if json_get_type v "$t"; then
			json_get_var v "$t"
			num "$v" || err "Hız sayı olmalı (kbit/s)"
			[ "$v" = 0 ] || { [ "$v" -ge 1000 ] && [ "$v" -le 10000000 ]; } || err "Hız 1000-10000000 kbit/s arası olmalı (0 = sınırsız)"
			uci set "sqm.$s.$t=$v"
		fi
	done
	if json_get_type t script; then
		json_get_var v script
		case "$v" in *[!A-Za-z0-9_.-]* | '') err "Geçersiz betik" ;; esac
		[ -f "/usr/lib/sqm/$v" ] || [ -n "$NP_DRYRUN" ] || err "Betik bulunamadı: $v"
		uci set "sqm.$s.script=$v"
		case "$v" in *cake*) uci set "sqm.$s.qdisc=cake" ;; simple* | simplest.qos) uci set "sqm.$s.qdisc=fq_codel" ;; esac
	fi
	if json_get_type t linklayer; then
		json_get_var v linklayer
		case "$v" in none | ethernet | atm) uci set "sqm.$s.linklayer=$v" ;; *) err "Geçersiz bağlantı katmanı" ;; esac
	fi
	if json_get_type t overhead; then
		json_get_var v overhead
		num "$v" && [ "$v" -le 256 ] || err "Overhead 0-256 bayt olmalı"
		uci set "sqm.$s.overhead=$v"
	fi
	if json_get_type t enabled; then
		json_get_var v enabled
		[ "$v" = 1 ] && uci set "sqm.$s.enabled=1" || uci set "sqm.$s.enabled=0"
	fi
	uci commit sqm
	svc /etc/init.d/sqm restart
	printf '{"ok":true,"section":"%s"}\n' "$s"
}

delete_queue() {
	local input s
	input=$(cat)
	json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var s section
	case "$s" in '' | *[!A-Za-z0-9_]*) err "Geçersiz bölüm" ;; esac
	[ "$(uci -q get "sqm.$s")" = queue ] || err "SQM kuyruğu bulunamadı"
	uci delete "sqm.$s"
	uci commit sqm
	svc /etc/init.d/sqm restart
	echo '{"ok":true}'
}

offload() {
	local input v
	input=$(cat)
	json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var v enabled
	if [ "$v" = 1 ]; then
		uci set firewall.@defaults[0].flow_offloading=1
	else
		uci set firewall.@defaults[0].flow_offloading=0
		uci set firewall.@defaults[0].flow_offloading_hw=0
	fi
	uci commit firewall
	svc fw4 reload
	svc /usr/sbin/netpanel-apply
	echo '{"ok":true}'
}

st_start() {
	local input w m srv
	input=$(cat)
	json_load "$input" 2>/dev/null || input='{}'
	json_get_var w wan
	json_get_var m mode
	json_get_var srv server
	case "$srv" in '' | europe) ;; *[!A-Za-z0-9.:-]*) err "Geçersiz sunucu" ;; *:*) ;; *) err "Sunucu host:port biçiminde olmalı" ;; esac
	case "$m" in '' | single | sequential | combined) ;; *) err "Geçersiz test modu" ;; esac
	case "$w" in *[!A-Za-z0-9_.-]*) err "Geçersiz hat" ;; esac
	[ -n "$w" ] && [ "$w" != all ] && { np_wan_nets | grep -qx "$w" || err "Bilinmeyen internet hattı"; }
	command -v curl >/dev/null || err "Hız testi için curl gerekli (apk add curl)"
	if [ -f "$ST_OUT" ] && grep -q '"running":true' "$ST_OUT" && [ $(($(date +%s) - $(date -r "$ST_OUT" +%s))) -lt 60 ]; then
		err "Bir test zaten çalışıyor"
	fi
	rm -f "$ST_OUT"
	# seçilen sunucuyu varsayılan olarak hatırla
	if [ -n "$srv" ]; then
		[ "$(uci -q get netpanel.speedtest)" = speedtest ] || uci set netpanel.speedtest=speedtest
		uci set "netpanel.speedtest.server=$srv"; uci commit netpanel
	fi
	(/usr/libexec/netpanel/speedtest.sh "$w" "$m" "$srv" >/dev/null 2>&1 </dev/null &)
	echo '{"ok":true}'
}

st_status() {
	local cur ts wan d u i dl ul g tmp
	cur=$(cat "$ST_OUT" 2>/dev/null)
	[ -n "$cur" ] || cur=null
	tmp=$(mktemp)
	[ -f "$ST_HIST" ] && tail -n 20 "$ST_HIST" | sed '1!G;h;$!d' >"$tmp"
	printf '{"current":%s,"history":[' "$cur"
	awk -F'\t' 'NF >= 8 { printf "%s{\"t\":%d,\"wan\":\"%s\",\"down\":%s,\"up\":%s,\"idle_ms\":%s,\"down_ms\":%s,\"up_ms\":%s,\"grade\":\"%s\",\"mode\":\"%s\"}", (n++ ? "," : ""), $1, $2, $3, $4, $5, $6, $7, $8, ($9 == "" ? "single" : $9) }' "$tmp"
	printf ']}\n'
	rm -f "$tmp"
}

case "$1" in
config) config ;;
set) set_queue ;;
delete) delete_queue ;;
offload) offload ;;
st_start) st_start ;;
st_status) st_status ;;
*) echo "kullanım: $0 config|set|delete|offload|st_start|st_status" >&2; exit 1 ;;
esac
