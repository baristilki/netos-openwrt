#!/bin/sh
# NetOS dakikalık toplayıcı (cron: * * * * *)
#   collect.sh            -> hepsi: kullanım + ping + saat planı
#   collect.sh usage      -> cihaz/WAN başına trafik (günlük dosyalar)
#   collect.sh ping       -> her WAN için ping/kayıp örneği
#   collect.sh sched      -> saat planını nft setlerine uygula (netpanel-apply sonrası da çağrılır)
#   collect.sh seed       -> bilinen cihaz listesini mevcut cihazlarla doldur (yeni cihaz bildirimi için)
#   collect.sh presence   -> takip edilen cihazlar eve geldi / ayrıldı bildirimi
#   collect.sh stsched    -> zamanlanmış hız testi saati geldiyse başlat
#
# Veri: /etc/netpanel/usage/YYYY-MM-DD.tsv  (anahtar \t indirme_bayt \t yükleme_bayt; anahtar = mac | wan:<ad>)
#       /etc/netpanel/ping/YYYY-MM-DD.tsv   (zaman \t wan \t ort_ms \t kayıp_%)

. "${NP_COMMON:-/usr/share/netpanel/common.sh}"

DATA=${NP_DATA:-/etc/netpanel}
RUN=${NP_RUN:-/tmp/netpanel-collect}
mkdir -p "$DATA/usage" "$DATA/ping" "$RUN"
TODAY=$(date +%Y-%m-%d)

# ── kullanım ────────────────────────────────────────────────────────────────
# nft dl/ul setlerindeki IP sayaçları (tablo yüklendiğinden beri birikimli) -> önceki ölçüme göre fark
nft_counters() { # dl|ul -> "ip bayt"
	nft list set inet netpanel "$1" 2>/dev/null | tr ',{}\n' '    ' |
		awk '{ for (i = 1; i <= NF; i++) { if ($i ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) c = $i; else if ($i == "bytes" && c != "") { print c, $(i + 1); c = "" } } }'
}
ip_mac_map() { # "ip mac" (ARP + lease + sabit)
	np_neigh | awk -F'\t' '{ print $2, $1 }'
	[ -f "$NP_LEASES" ] && awk '{ print $3, tolower($2) }' "$NP_LEASES"
	np_hosts | awk -F'\t' '$3 != "" { print $3, $2 }'
}
usage() {
	local cur="$RUN/usage.cur" last="$RUN/usage.last" day="$DATA/usage/$TODAY.tsv"
	{
		nft_counters dl | sed 's/^/dl /'
		nft_counters ul | sed 's/^/ul /'
		# WAN başına (fiziksel arayüz sayaçları)
		for n in $(np_wan_nets); do
			d=$(np_ifdev "$n"); [ -n "$d" ] && [ -r "/sys/class/net/$d/statistics/rx_bytes" ] || continue
			echo "dl wan:$n $(cat "/sys/class/net/$d/statistics/rx_bytes")"
			echo "ul wan:$n $(cat "/sys/class/net/$d/statistics/tx_bytes")"
		done
	} >"$cur"
	if [ -f "$last" ]; then
		ip_mac_map >"$RUN/ipmac"
		# fark (sayaç sıfırlandıysa mevcut değer), IP -> MAC, günlük dosyaya ekle
		awk -v dayf="$day" '
			FILENAME == ARGV[1] { mac[$1] = $2; next }
			FILENAME == ARGV[2] { prev[$1 SUBSEP $2] = $3; next }
			FILENAME == ARGV[3] { k = $1 SUBSEP $2; d = (k in prev && $3 >= prev[k]) ? $3 - prev[k] : $3
				if (!(k in prev) && $2 ~ /^wan:/) d = 0   # ilk ölçümde WAN toplamını sayma
				key = ($2 ~ /^wan:/) ? $2 : mac[$2]; if (key == "") key = "ip:" $2   # MAC bulunamazsa IP ile sakla
				if (d <= 0) next
				if ($1 == "dl") rx[key] += d; else tx[key] += d; seen[key] = 1; next }
			FILENAME == ARGV[4] { orx[$1] = $2; otx[$1] = $3; seen[$1] = 1; next }
			END { for (k in seen) printf "%s\t%.0f\t%.0f\n", k, orx[k] + rx[k], otx[k] + tx[k] }
		' "$RUN/ipmac" "$last" "$cur" "$( [ -f "$day" ] && echo "$day" || echo /dev/null)" >"$day.new" && mv "$day.new" "$day"
	fi
	mv "$cur" "$last"
	# 100 günden eski günlük dosyaları sil
	find "$DATA/usage" -name '*.tsv' -mtime +100 -delete 2>/dev/null
}

# ── ping geçmişi ────────────────────────────────────────────────────────────
ping_hist() {
	local n d out="$DATA/ping/$TODAY.tsv" ts
	ts=$(date +%s)
	for n in $(np_wan_nets); do
		d=$(np_ifdev "$n"); [ -n "$d" ] || continue
		(
			r=$(ping -c 4 -W 1 -I "$d" "${NP_PING_TARGET:-1.1.1.1}" 2>/dev/null)
			loss=$(printf '%s' "$r" | sed -n 's/.* \([0-9]*\)% packet loss.*/\1/p')
			avg=$(printf '%s' "$r" | sed -n 's/.*min\/avg\/max = [0-9.]*\/\([0-9.]*\)\/.*/\1/p')
			printf '%s\t%s\t%s\t%s\n' "$ts" "$n" "${avg:-null}" "${loss:-100}" >>"$out"
		) &
	done
	wait
	find "$DATA/ping" -name '*.tsv' -mtime +31 -delete 2>/dev/null
}

# ── saat planı (ebeveyn kontrolü) ───────────────────────────────────────────
# uci: netpanel.<cihaz>.schedule = 'GÜNLER|BAŞ|BİT' listesi; GÜNLER 1=Pzt..7=Paz, ör. '12345|23:00|07:00'
# Gece yarısını aşan aralıkta (23:00-07:00) sabah kısmı bir önceki günün planına aittir.
sched_now() { # şu an engellenmesi gereken MAC'ler
	local dow hm pdow
	dow=$(date +%u); hm=$(date +%H%M); pdow=$((dow == 1 ? 7 : dow - 1))
	uci -q show netpanel | awk -v q="'" -v dow="$dow" -v pdow="$pdow" -v hm="$hm" '
		{ k = substr($0, 1, index($0, "=") - 1); v = substr($0, index($0, "=") + 1); n = split(k, p, ".") }
		n == 3 && p[3] == "mac" { gsub(q, "", v); mac[p[2]] = tolower(v) }
		n == 3 && p[3] == "schedule" {
			# liste: '\''12345|23:00|07:00'\'' '\''67|00:00|09:00'\''
			m = split(v, items, q)
			for (i = 1; i <= m; i++) { if (items[i] !~ /\|/) continue
				split(items[i], r, "|"); f = r[2]; t = r[3]; gsub(":", "", f); gsub(":", "", t); f += 0; t += 0
				on = 0
				if (f < t) on = (index(r[1], dow) && hm >= f && hm < t)
				else if (f > t) on = ((index(r[1], dow) && hm >= f) || (index(r[1], pdow) && hm < t))
				if (on) blk[p[2]] = 1 }
		}
		END { for (s in blk) if (mac[s] != "") print mac[s] }' | sort -u
}
sched() {
	local now="$RUN/sched.now" macs ips m ip
	sched_now >"$now.new"
	# değişmediyse ve nft seti doluysa dokunma
	if [ -f "$now" ] && cmp -s "$now" "$now.new" && [ "$1" != force ]; then rm -f "$now.new"; return 0; fi
	mv "$now.new" "$now"
	cp "$now" /tmp/netpanel-sched.now 2>/dev/null
	nft list set inet netpanel schedmac >/dev/null 2>&1 || return 0
	nft flush set inet netpanel schedmac 2>/dev/null
	nft flush set inet netpanel schedip 2>/dev/null
	macs=$(tr '\n' ',' <"$now" | sed 's/,$//')
	[ -n "$macs" ] && nft add element inet netpanel schedmac "{ $macs }" 2>/dev/null
	ips=""
	for m in $(cat "$now"); do ip=$(np_ip_for_mac "$m"); np_valid_ip "$ip" && ips="$ips${ips:+,}$ip"; done
	[ -n "$ips" ] && nft add element inet netpanel schedip "{ $ips }" 2>/dev/null
	return 0
}

# ── bilinen cihazlar (yeni cihaz bildirimi) ─────────────────────────────────
seed() {
	[ -s "$DATA/known" ] && return 0
	{
		[ -f "$NP_LEASES" ] && awk '{ print tolower($2) }' "$NP_LEASES"
		np_neigh | cut -f1
		np_hosts | cut -f2
		np_meta | cut -f1
	} | grep -E '^([0-9a-f]{2}:){5}[0-9a-f]{2}$' | sort -u >"$DATA/known"
}

# ── cihaz geldi / gitti bildirimi ───────────────────────────────────────────
# netpanel.<cihaz>.presence=1 olan cihazlar: ping + ARP ile kontrol. Telefonlar uykuda ağdan düşebildiği
# için "ayrıldı" ancak AWAY_MIN dakika boyunca hiç görülmezse sayılır.
AWAY_MIN=${NP_AWAY_MIN:-10}
presence() {
	local dir="$RUN/presence" now mac name ip on st last f
	mkdir -p "$dir"
	now=$(date +%s)
	uci -q show netpanel | awk -v q="'" '
		{ k = substr($0, 1, index($0, "=") - 1); v = substr($0, index($0, "=") + 1); gsub(q, "", v); n = split(k, p, ".") }
		n == 3 && p[3] == "mac" { mac[p[2]] = tolower(v) }
		n == 3 && p[3] == "name" { nm[p[2]] = v }
		n == 3 && p[3] == "presence" && v == "1" { pr[p[2]] = 1 }
		END { for (s in pr) if (mac[s] != "") printf "%s\t%s\n", mac[s], (nm[s] != "" ? nm[s] : mac[s]) }' >"$dir/list"
	while IFS='	' read -r mac name; do
		[ -n "$mac" ] || continue
		on=0
		ip=$(np_ip_for_mac "$mac")
		if np_valid_ip "$ip"; then
			ping -c 1 -W 1 "$ip" >/dev/null 2>&1 && on=1
			[ $on = 1 ] || np_neigh | awk -F'\t' -v m="$mac" '$1 == m && $4 ~ /REACHABLE|DELAY|PROBE/ { f = 1 } END { exit !f }' && on=1
		fi
		f="$dir/$(echo "$mac" | tr -d :)"
		read -r st last 2>/dev/null <"$f" || { st=$on; last=$now; }
		if [ $on = 1 ]; then
			[ "$st" = 0 ] && np_notify "$name eve geldi." presence >/dev/null 2>&1
			echo "1 $now" >"$f"
		elif [ "$st" = 1 ] && [ $((now - last)) -ge $((AWAY_MIN * 60)) ]; then
			np_notify "$name evden ayrıldı (son görülme $(date -d "@$last" +%H:%M 2>/dev/null || date +%H:%M))." presence >/dev/null 2>&1
			echo "0 $last" >"$f"
		else
			echo "$st $last" >"$f"
		fi
	done <"$dir/list"
}

# ── zamanlanmış hız testi ───────────────────────────────────────────────────
stsched() {
	[ "$(uci -q get netpanel.stsched.enabled)" = 1 ] || return 0
	[ "$(date +%H:%M)" = "$(printf '%02d:00' "$(uci -q get netpanel.stsched.hour || echo 4)")" ] || return 0
	printf '{"wan":"%s"}' "$(uci -q get netpanel.stsched.wan)" | /usr/libexec/netpanel/sqmctl.sh st_start >/dev/null 2>&1
}

case "${1:-all}" in
usage) usage ;;
ping) ping_hist ;;
sched) sched "$2" ;;
seed) seed ;;
presence) presence ;;
stsched) stsched ;;
all)
	seed
	sched
	stsched
	presence &
	usage
	ping_hist
	;;
esac
exit 0
