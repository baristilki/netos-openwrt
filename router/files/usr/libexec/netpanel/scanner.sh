#!/bin/sh
# NetOS ağ tarayıcı (Advanced IP Scanner benzeri) — yalnız yerel ağlarda çalışır
#   scanner.sh start   {"ports":true, "range":"192.168.1.0/24 | 192.168.1.10-50 | 10.0.0.5"}  -> arka planda tarar
#                      (range boşsa routerın yerel ağları; yalnız özel adresler, en fazla 1024 adres)
#   scanner.sh wol     {"mac":"aa:bb:.."}  -> Wake-on-LAN sihirli paketi (etherwake)
#   scanner.sh status                  -> {running, phase, done, total, started, finished, hosts:[...]}
#
# Yöntem: alt ağdaki her adrese 1 ping; ICMP'yi engelleyen cihazlar ARP yanıtıyla yine bulunur.
# İsim: DHCP kiraları + sabit kayıtlar + dnsmasq ters DNS. Port kontrolü yalnız bağlantı açılıp
# kapanmasıdır (curl), hiçbir veri gönderilmez.

. "${NP_COMMON:-/usr/share/netpanel/common.sh}"

DIR=${NP_SCAN_DIR:-/tmp/netpanel-scan}
mkdir -p "$DIR"
MAXHOSTS=1024
PAR=48
WEB="80:http 443:https 8080:http 8443:https 8006:https 5000:http 5001:https 8123:http 3000:http 9000:http 32400:http 8096:http 81:http 8888:http"
TCP="21:FTP 22:SSH 23:Telnet 139:NetBIOS 445:SMB 554:RTSP 3389:RDP 5900:VNC 9100:Yazıcı 1883:MQTT 8009:Chromecast 53:DNS"

json_str() { printf '"%s"' "$(printf '%s' "$1" | sed 's/[\\"]/\\&/g' | tr -d '\000-\037')"; }
setst() { # durum aşama bitti toplam [bitiş_zamanı]
	printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$(cat "$DIR/started" 2>/dev/null)" "${5:-0}" >"$DIR/state.new" && mv "$DIR/state.new" "$DIR/state"
}

# yerel ağlar: "ağ_adı cihaz ip/önek" (WAN'lar hariç)
lan_nets() {
	local wans n d
	wans=" $(np_wan_nets | tr '\n' ' ') "
	for n in $(uci -q show network | sed -n "s/^network\.\([^.=]*\)=interface$/\1/p"); do
		case "$wans" in *" $n "*) continue ;; esac
		[ "$n" = loopback ] && continue
		d=$(np_ifdev "$n"); [ -n "$d" ] || continue
		ip -4 addr show dev "$d" 2>/dev/null | awk -v n="$n" -v d="$d" '/inet / { print n, d, $2 }'
	done
}

# ip/önek -> taranacak adresler (ağ ve yayın adresi hariç; çok büyük ağda routerın /24'ü)
hosts_of() {
	echo "$1" | awk -F'[./]' -v max="$MAXHOSTS" '{
		ip = (($1 * 256 + $2) * 256 + $3) * 256 + $4; p = $5 + 0
		if (p < 22 || 2 ^ (32 - p) > max) p = 24
		size = 2 ^ (32 - p); net = ip - (ip % size)
		for (i = net + 1; i < net + size - 1; i++)
			printf "%d.%d.%d.%d\n", int(i / 16777216) % 256, int(i / 65536) % 256, int(i / 256) % 256, i % 256
	}'
}

# kullanıcı aralığı -> adres listesi. Çıkış: 2 biçim hatası, 3 özel ağ değil, 4 çok büyük
range_hosts() {
	echo "$1" | awk -v max="$MAXHOSTS" '
		function n(ip, a) { if (split(ip, a, ".") != 4) return -1
			for (k = 1; k <= 4; k++) if (a[k] !~ /^[0-9]+$/ || a[k] > 255) return -1
			return ((a[1] * 256 + a[2]) * 256 + a[3]) * 256 + a[4] }
		function priv(x) { return (x >= 167772160 && x <= 184549375) || (x >= 2886729728 && x <= 2887778303) || (x >= 3232235520 && x <= 3232301055) || (x >= 1681915904 && x <= 1686110207) }
		function ip(i) { return sprintf("%d.%d.%d.%d", int(i / 16777216) % 256, int(i / 65536) % 256, int(i / 256) % 256, i % 256) }
		{ gsub(/[ \t]/, ""); s = $0
			if (s ~ /\//) { split(s, c, "/"); b = n(c[1]); p = c[2]
				if (b < 0 || p !~ /^[0-9]+$/ || p > 32) exit 2
				size = 2 ^ (32 - p); lo = b - (b % size); hi = lo + size - 1
				if (p <= 30) { lo++; hi-- } }
			else if (s ~ /-/) { split(s, r, "-"); lo = n(r[1])
				if (r[2] ~ /^[0-9]+$/) { split(r[1], o, "."); hi = n(o[1] "." o[2] "." o[3] "." r[2]) } else hi = n(r[2])
				if (lo < 0 || hi < 0 || hi < lo) exit 2 }
			else { lo = n(s); hi = lo; if (lo < 0) exit 2 }
			if (!priv(lo) || !priv(hi)) exit 3
			if (hi - lo + 1 > max) exit 4
			for (i = lo; i <= hi; i++) print ip(i) }'
}

ping_one() {
	local r
	r=$(ping -c 1 -W 1 "$1" 2>/dev/null | sed -n 's/.*time=\([0-9.]*\).*/\1/p')
	[ -n "$r" ] && echo "$1 $r" >"$DIR/p/$1"
}

port_open() { # ip port -> 0 bağlantı açıldıysa
	local t
	t=$(curl -s -o /dev/null --connect-timeout 1 -m 1 -w '%{time_connect}' "telnet://$1:$2" </dev/null 2>/dev/null)
	case "$t" in *[1-9]*) return 0 ;; esac # bağlantı süresi 0 değilse port açık
	return 1
}

scan_ports() { # ip -> $DIR/o/<ip> : "web url..." ve "tcp 22:SSH ..."
	local ip=$1 ps p s u code urls="" open=""
	for ps in $WEB; do
		p=${ps%%:*}; s=${ps#*:}
		case "$p:$s" in 80:http | 443:https) u="$s://$ip" ;; *) u="$s://$ip:$p" ;; esac
		code=$(curl -sk -o /dev/null -m 2 --connect-timeout 1 -w '%{http_code}' "$u/" 2>/dev/null)
		case "$code" in '' | 000) ;; *) urls="$urls $u/" ;; esac
	done
	if [ "$TELNET" = 1 ]; then
		for ps in $TCP; do port_open "$ip" "${ps%%:*}" && open="$open $ps"; done
	fi
	printf 'web%s\ntcp%s\n' "$urls" "$open" >"$DIR/o/$ip"
}

run() {
	local want_ports=$1 all n i ip self total
	rm -rf "$DIR/p" "$DIR/o" "$DIR/result.json"
	mkdir -p "$DIR/p" "$DIR/o"
	date +%s >"$DIR/started"
	lan_nets >"$DIR/nets"
	: >"$DIR/targets"
	if [ -s "$DIR/range" ]; then
		range_hosts "$(cat "$DIR/range")" | sed 's/$/ özel -/' >"$DIR/targets"
	else
		while read -r n d cidr; do hosts_of "$cidr" | sed "s/\$/ $n $d/" >>"$DIR/targets"; done <"$DIR/nets"
	fi
	self=$(awk '{ sub(/\/.*/, "", $3); print $3 }' "$DIR/nets")
	total=$(wc -l <"$DIR/targets")
	setst running ping 0 "$total"

	# 1) ping taraması (PAR adet paralel)
	i=0
	while read -r ip n d; do
		ping_one "$ip" &
		i=$((i + 1))
		[ $((i % PAR)) -eq 0 ] && { wait; setst running ping "$i" "$total"; }
	done <"$DIR/targets"
	wait
	sleep 1

	# 2) canlı cihazlar = ping yanıtı verenler + ARP ile görülenler (ICMP'yi engelleyenler)
	np_neigh | awk -F'\t' '$4 ~ /REACHABLE|DELAY|PROBE|PERMANENT/ { print $2, $1 }' >"$DIR/arp"
	cat "$DIR/p/"* 2>/dev/null >"$DIR/ping"
	awk 'FNR == NR { t[$1] = 1; next } t[$1] { print $1 }' "$DIR/targets" "$DIR/arp" >"$DIR/alive"
	cut -d' ' -f1 "$DIR/ping" >>"$DIR/alive"
	for ip in $self; do grep -q "^$ip " "$DIR/targets" && echo "$ip" >>"$DIR/alive"; done
	sort -u "$DIR/alive" | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n >"$DIR/alive.s" && mv "$DIR/alive.s" "$DIR/alive"
	np_neigh | awk -F'\t' '{ print $2, $1 }' >"$DIR/macs" # MAC için tüm komşu kayıtları

	# 3) port / web arayüzü kontrolü (4 cihaz aynı anda)
	TELNET=0
	if [ "$want_ports" = 1 ] && command -v curl >/dev/null; then
		curl -V 2>/dev/null | grep -qi 'protocols:.*telnet' && TELNET=1
		total=$(wc -l <"$DIR/alive"); i=0
		setst running ports 0 "$total"
		for ip in $(cat "$DIR/alive"); do
			scan_ports "$ip" &
			i=$((i + 1))
			[ $((i % 4)) -eq 0 ] && { wait; setst running ports "$i" "$total"; }
		done
		wait
	fi

	# 4) sonuç
	build >"$DIR/result.json.new" && mv "$DIR/result.json.new" "$DIR/result.json"
	setst done done "$(wc -l <"$DIR/alive")" "$(wc -l <"$DIR/alive")" "$(date +%s)"
}

build() {
	local ip mac name net ms first=1 rdns web tcp
	printf '{"range":%s,"nets":[' "$(json_str "$(cat "$DIR/range" 2>/dev/null)")"
	awk '{ printf "%s{\"name\":\"%s\",\"cidr\":\"%s\"}", (NR > 1 ? "," : ""), $1, $3 }' "$DIR/nets"
	printf '],"ports_checked":%s,"tcp_checked":%s,"hosts":[' "$([ -n "$(ls "$DIR/o" 2>/dev/null)" ] && echo true || echo false)" "$([ "$TELNET" = 1 ] && echo true || echo false)"
	for ip in $(cat "$DIR/alive"); do
		mac=$(awk -v i="$ip" '$1 == i { print $2; exit }' "$DIR/macs")
		ms=$(awk -v i="$ip" '$1 == i { print $2; exit }' "$DIR/ping")
		net=$(awk -v i="$ip" '$1 == i { print $2; exit }' "$DIR/targets")
		name=$(awk -v i="$ip" '$3 == i && $4 != "*" { print $4; exit }' "$NP_LEASES" 2>/dev/null)
		[ -n "$name" ] || name=$(np_hosts | awk -F'\t' -v i="$ip" '$3 == i { print $4; exit }')
		rdns=$(nslookup "$ip" 127.0.0.1 2>/dev/null | sed -n 's/.*name = \([^ ]*\).*/\1/p' | head -1)
		rdns=${rdns%.}; rdns=${rdns%.lan}
		[ -n "$name" ] || name=$rdns
		web=$(sed -n 's/^web//p' "$DIR/o/$ip" 2>/dev/null)
		tcp=$(sed -n 's/^tcp//p' "$DIR/o/$ip" 2>/dev/null)
		[ $first = 1 ] || printf ','
		first=0
		printf '{"ip":"%s","mac":"%s","name":%s,"net":"%s","ping":%s,"self":%s,"web":[' \
			"$ip" "$mac" "$(json_str "$name")" "$net" "${ms:-null}" "$(echo " $self " | grep -q " $ip " && echo true || echo false)"
		echo $web | awk '{ for (i = 1; i <= NF; i++) printf "%s\"%s\"", (i > 1 ? "," : ""), $i }'
		printf '],"ports":['
		echo $tcp | awk '{ for (i = 1; i <= NF; i++) { split($i, a, ":"); printf "%s{\"port\":%d,\"name\":\"%s\"}", (i > 1 ? "," : ""), a[1], a[2] } }'
		printf ']}'
	done
	printf ']}'
}

status() {
	local st phase done total started finished running=false
	if [ -f "$DIR/state" ]; then
		IFS='	' read -r st phase done total started finished <"$DIR/state"
		[ "$st" = running ] && kill -0 "$(cat "$DIR/pid" 2>/dev/null)" 2>/dev/null && running=true
		[ "$st" = running ] && [ "$running" = false ] && phase=error
	fi
	printf '{"running":%s,"phase":"%s","done":%d,"total":%d,"started":%d,"finished":%d,"result":' \
		"$running" "${phase:-idle}" "${done:-0}" "${total:-0}" "${started:-0}" "${finished:-0}"
	if [ "$running" = false ] && [ -s "$DIR/result.json" ]; then cat "$DIR/result.json"; else printf 'null'; fi
	printf '}\n'
}

case "$1" in
start)
	input=$(cat)
	json_load "$input" 2>/dev/null
	json_get_var ports ports
	json_get_var range range
	[ "$ports" = 0 ] || ports=1
	range=$(printf '%s' "$range" | tr -d ' 	')
	if [ -n "$range" ]; then
		range_hosts "$range" >/dev/null
		case $? in
		0) ;;
		3) echo '{"ok":false,"error":"Yalnız yerel (özel) adresler taranabilir: 10.x, 172.16-31.x, 192.168.x"}'; exit 0 ;;
		4) echo '{"ok":false,"error":"Aralık çok büyük; en fazla 1024 adres (ör. /22)"}'; exit 0 ;;
		*) echo '{"ok":false,"error":"Aralık anlaşılmadı. Örnek: 192.168.1.0/24, 192.168.1.10-50 ya da 192.168.1.20"}'; exit 0 ;;
		esac
	fi
	if [ -f "$DIR/pid" ] && kill -0 "$(cat "$DIR/pid")" 2>/dev/null; then
		echo '{"ok":true,"already":true}'
		exit 0
	fi
	printf '%s' "$range" >"$DIR/range"
	date +%s >"$DIR/started"
	setst running ping 0 0
	("$0" run "$ports" >/dev/null 2>&1 </dev/null &
	echo $! >"$DIR/pid")
	echo '{"ok":true}'
	;;
run)
	echo $$ >"$DIR/pid"
	run "$2"
	;;
status) status ;;
wol)
	input=$(cat)
	json_load "$input" 2>/dev/null
	json_get_var mac mac
	mac=$(echo "$mac" | tr 'A-F' 'a-f')
	np_valid_mac "$mac" || { echo '{"ok":false,"error":"Geçersiz MAC adresi"}'; exit 0; }
	command -v etherwake >/dev/null || { echo '{"ok":false,"error":"etherwake paketi kurulu değil (apk add etherwake)"}'; exit 0; }
	LAN=$(np_ifdev lan); [ -n "$LAN" ] || LAN=br-lan
	etherwake -i "$LAN" "$mac" >/dev/null 2>&1 && echo '{"ok":true}' || echo '{"ok":false,"error":"Paket gönderilemedi"}'
	;;
*) echo "kullanım: $0 start|status" >&2; exit 1 ;;
esac
exit 0
