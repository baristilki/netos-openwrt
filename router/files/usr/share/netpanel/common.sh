# NetPanel ortak yardımcılar (rpcd eklentisi ve netpanel-apply tarafından source edilir)

. "${NP_JSHN:-/usr/share/libubox/jshn.sh}"

NP_LEASES=$(uci -q get dhcp.@dnsmasq[0].leasefile)
[ -n "$NP_LEASES" ] || NP_LEASES=/tmp/dhcp.leases

# Mantıksal arayüz adı (lan, wan) -> L3 cihaz adı (br-lan, eth1 ...)
np_ifdev() {
	local st d
	st=$(ubus call "network.interface.$1" status 2>/dev/null) || return 0
	[ -n "$st" ] || return 0
	json_init
	json_load "$st" 2>/dev/null || return 0
	json_get_var d l3_device
	echo "$d"
}

# Firewall "wan" bölgesindeki tüm ağların cihazları (multiwan: pppoe-Turknet eth1.35 eth2 ...)
np_wan_nets() {
	uci -q show firewall | sed -n "s/^firewall\.\(@zone\[[0-9]*\]\)\.name='wan'$/\1/p" |
		while read -r z; do uci -q get "firewall.$z.network"; done | tr ' ' '\n' | sort -u
}
np_wan_devs() {
	local net d out=""
	for net in $(np_wan_nets); do
		d=$(np_ifdev "$net"); [ -n "$d" ] && out="$out $d"
		d=$(uci -q get "network.$net.device"); [ -n "$d" ] && out="$out $d"
	done
	echo "$out" | tr ' ' '\n' | sort -u | tr '\n' ' '
}

# MAC küçük harf ve aa:bb:cc:dd:ee:ff biçiminde olmalı
np_valid_mac() { echo "$1" | grep -qE '^([0-9a-f]{2}:){5}[0-9a-f]{2}$'; }

np_valid_ip() {
	echo "$1" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || return 1
	local IFS=. o
	for o in $1; do [ "$o" -le 255 ] || return 1; done
	return 0
}

np_sid() { echo "m_$(echo "$1" | tr -d ':')"; }

# Cihaz tipleri (ikonlar)
NP_TYPES="phone tablet laptop pc console tv nas server router ap printer camera speaker watch iot other"

# netpanel istemci kayıtları: mac \t name \t down \t up \t blocked \t type \t priority
np_meta() {
	uci -q show netpanel | awk -v q="'" '
		{ k = substr($0, 1, index($0, "=") - 1); v = substr($0, index($0, "=") + 1); gsub(q, "", v); n = split(k, p, ".") }
		n == 2 && v == "client" { c[p[2]] = 1; next }
		n == 3 { o[p[2] SUBSEP p[3]] = v }
		END {
			for (s in c) if (o[s SUBSEP "mac"] != "")
				printf "%s\t%s\t%d\t%d\t%d\t%s\t%d\n", tolower(o[s SUBSEP "mac"]), o[s SUBSEP "name"], o[s SUBSEP "down"], o[s SUBSEP "up"], o[s SUBSEP "blocked"], o[s SUBSEP "type"], o[s SUBSEP "priority"]
		}'
}

# dnsmasq sabit kayıtları: section \t mac \t ip \t name
np_hosts() {
	uci -X -q show dhcp | awk -v q="'" '
		{ k = substr($0, 1, index($0, "=") - 1); v = substr($0, index($0, "=") + 1); gsub(q, "", v); n = split(k, p, ".") }
		n == 2 && v == "host" { h[p[2]] = 1; next }
		n == 3 { o[p[2] SUBSEP p[3]] = v }
		END {
			for (s in h) {
				split(tolower(o[s SUBSEP "mac"]), m, " ")
				if (m[1] != "") printf "%s\t%s\t%s\t%s\n", s, m[1], o[s SUBSEP "ip"], o[s SUBSEP "name"]
			}
		}'
}

# ARP/komşu tablosu: mac \t ip \t dev \t state  (yalnız IPv4)
np_neigh() {
	if ip neigh show >/dev/null 2>&1; then
		ip neigh show 2>/dev/null | awk '
			$1 ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ {
				dev = ""; mac = ""
				for (i = 2; i < NF; i++) { if ($i == "dev") dev = $(i + 1); if ($i == "lladdr") mac = tolower($(i + 1)) }
				if (mac != "") printf "%s\t%s\t%s\t%s\n", mac, $1, dev, $NF
			}'
	else
		awk 'NR > 1 && $3 != "0x0" { printf "%s\t%s\t%s\t%s\n", tolower($4), $1, $6, "REACHABLE" }' /proc/net/arp
	fi
}

# MAC -> bilinen IPv4 (önce sabit kayıt, sonra lease, sonra ARP)
np_ip_for_mac() {
	local ip
	ip=$(np_hosts | awk -F'\t' -v m="$1" '$2 == m && $3 != "" { print $3; exit }')
	[ -n "$ip" ] || ip=$(awk -v m="$1" 'tolower($2) == m { print $3; exit }' "$NP_LEASES" 2>/dev/null)
	[ -n "$ip" ] || ip=$(np_neigh | awk -F'\t' -v m="$1" '$1 == m { print $2; exit }')
	echo "$ip"
}

# Telegram bildirimi (netpanel.notify.{enabled,token,chat_id}); arka planda, hata vermez
np_notify() { # mesaj [olay: wan|newdev|test]
	local tok chat host
	[ "$(uci -q get netpanel.notify.enabled)" = 1 ] || [ "$2" = test ] || return 0
	[ -z "$2" ] || [ "$2" = test ] || [ "$(uci -q get "netpanel.notify.$2")" != 0 ] || return 0
	tok=$(uci -q get netpanel.notify.token); chat=$(uci -q get netpanel.notify.chat_id)
	[ -n "$tok" ] && [ -n "$chat" ] && command -v curl >/dev/null || return 1
	host=$(uci -q get system.@system[0].hostname)
	curl -s -m 15 -o /dev/null -w '%{http_code}' --data-urlencode "chat_id=$chat" \
		--data-urlencode "text=NetOS (${host:-router}): $1" "https://api.telegram.org/bot$tok/sendMessage"
}
