#!/bin/sh
# NetOS hız + bufferbloat testi (router üzerinden)
#   speedtest.sh [wan] [mode] [server]
#     wan   : hat adı | "all" (tüm hatlar) | boş (birincil hat)
#     mode  : single (varsayılan, tek hat) | sequential (hatlar sırayla) | combined (hatlar aynı anda)
#     server: Ookla sunucusu "host:port" (varsayılan TurkNet İstanbul) | "europe" (Hetzner/OVH + Cloudflare)
#             Ookla sunucularının standart HTTP uçları kullanılır: GET /download?size=N, POST /upload
# Durum: $OUT (JSON, ~1 sn'de bir güncellenir), geçmiş: $HIST
#
# Aşamalar (her hat için): idle (boşta ping) -> download (paralel akış + ping) -> upload (paralel akış + ping)
# Bufferbloat = yük altındaki gecikme artışı (Waveform ölçeği: A+ <5, A <30, B <60, C <200, D <400 ms, F)
# "combined" modunda indirme/yükleme tüm hatlarda aynı anda yapılır (multiwan toplam kapasitesi);
# gecikme birincil hat üzerinden ölçülür.

. "${NP_COMMON:-/usr/share/netpanel/common.sh}"

OUT=${NP_ST_OUT:-/tmp/netpanel-speedtest.json}
HIST=${NP_ST_HIST:-/etc/netpanel/speedtest.log}
DUR=${NP_ST_DUR:-10}
IDLE=${NP_ST_IDLE:-5}
STREAMS=${NP_ST_STREAMS:-8}   # Ookla ile karşılaştırılabilir sonuç için 8 paralel akış
TARGET=${NP_ST_PING:-1.1.1.1}
LOCK=/tmp/netpanel-speedtest.lock
UL_FILE=${NP_ST_ULFILE:-/tmp/netpanel-ul.bin}   # 25 MB sıfır dosyası (RAM'de), sabit boyutlu yükleme için

SERVER=${3:-$(uci -q get netpanel.speedtest.server)}
[ -n "$SERVER" ] || SERVER="speedtest.turk.net:8080"
if [ "$SERVER" = europe ]; then
	DL_URLS="https://fsn1-speed.hetzner.com/10GB.bin https://proof.ovh.net/files/10Gb.dat"
	UL_URL="https://speed.cloudflare.com/__up"
else
	case "$SERVER" in *[!A-Za-z0-9.:-]* | '') SERVER="speedtest.turk.net:8080" ;; esac
	DL_URLS="http://$SERVER/download?size=500000000"
	UL_URL="http://$SERVER/upload"
fi

if command -v lock >/dev/null; then lock -n "$LOCK" || exit 0; fi
T=$(mktemp -d)
cleanup() { kill $(jobs -p) 2>/dev/null; rm -rf "$T" "$UL_FILE"; command -v lock >/dev/null && lock -u "$LOCK"; }
trap cleanup EXIT INT TERM

ARG_WAN=$1
MODE=${2:-single}
case "$MODE" in single | sequential | combined) ;; *) MODE=single ;; esac

# ── hat listesi: "ad cihaz" satırları, birincil (en düşük metric) önce ─────────
wan_list() {
	for n in $(np_wan_nets); do
		d=$(np_ifdev "$n"); [ -n "$d" ] || continue
		m=$(uci -q get "network.$n.metric"); echo "${m:-0} $n $d"
	done | sort -n | cut -d' ' -f2-
}
WANS=$(wan_list)
if [ "$ARG_WAN" = all ]; then
	[ "$MODE" = single ] && MODE=sequential
elif [ -n "$ARG_WAN" ]; then
	WANS=$(echo "$WANS" | awk -v w="$ARG_WAN" '$1 == w')
	MODE=single
else
	WANS=$(echo "$WANS" | head -1)
	MODE=single
fi
NW=$(echo "$WANS" | grep -c .)
PRIMARY_WAN=$(echo "$WANS" | head -1 | cut -d' ' -f1)
PRIMARY_DEV=$(echo "$WANS" | head -1 | cut -d' ' -f2)
STARTED=$(date +%s)
if [ "$MODE" = sequential ]; then TOTAL=$(((IDLE + DUR * 2) * NW)); else TOTAL=$((IDLE + DUR * 2)); fi
[ "$TOTAL" -gt 0 ] || TOTAL=1

# ── durum ───────────────────────────────────────────────────────────────────
PHASE=starting; CUR_WAN=$PRIMARY_WAN; DOWN=0; UP=0; IDLE_MS=null; DL_MS=null; UL_MS=null; ERR=""
RUNS=""      # tamamlanan hat sonuçları (JSON nesneleri, virgülle)
EXTRA=""
status() {
	local el=$(($(date +%s) - STARTED)) pr run
	pr=$((el * 100 / TOTAL)); [ "$pr" -gt 99 ] && pr=99
	[ "$PHASE" = done ] && pr=100
	run=true; { [ "$PHASE" = done ] || [ "$PHASE" = error ]; } && run=false
	printf '{"running":%s,"mode":"%s","phase":"%s","progress":%d,"server":"'"$SERVER"'","wans_total":'"$NW"',"wan":"%s","started":%d,"down":%s,"up":%s,"idle_ms":%s,"down_ms":%s,"up_ms":%s,"error":"%s","runs":[%s]%s}\n' \
		"$run" "$MODE" "$PHASE" "$pr" "$CUR_WAN" "$STARTED" "$DOWN" "$UP" "$IDLE_MS" "$DL_MS" "$UL_MS" "$ERR" "$RUNS" "$EXTRA" >"$OUT.tmp" && mv "$OUT.tmp" "$OUT"
}

# ── ölçüm yardımcıları ──────────────────────────────────────────────────────
ping_start() { # sn dosya cihaz  — 4 paralel ping, çeyrek saniye kaydırmalı (~4 örnek/sn)
	local i
	for i in 0 1 2 3; do
		(sleep "0.$((i * 25))" 2>/dev/null || sleep 0
			ping -c "$1" -W 1 -I "$3" "$TARGET" 2>/dev/null | sed -n 's/.*time=\([0-9.]*\) ms.*/\1/p' >>"$2") &
	done
}
median() { sort -n "$1" 2>/dev/null | awk '{ a[NR] = $1 } END { if (!NR) { print "null"; exit } m = (NR % 2) ? a[(NR + 1) / 2] : (a[NR / 2] + a[NR / 2 + 1]) / 2; printf "%.1f", m }'; }
jitter() { awk 'NR > 1 { d = $1 - p; if (d < 0) d = -d; s += d; n++ } { p = $1 } END { if (!n) print "null"; else printf "%.1f", s / n }' "$1" 2>/dev/null; }
# akış dosyalarındaki istek başına bayt toplamı / test süresi (DUR) -> Mbit/s
sum_rate() { cat "$@" 2>/dev/null | awk -v t="$DUR" '{ b += $1 } END { if (t <= 0) print "0"; else printf "%.1f", b * 8 / t / 1e6 }'; }
grade_of() { # idle dl ul -> "not artış"
	awk -v i="$1" -v d="$2" -v u="$3" 'BEGIN {
		m = d; if (u != "null" && u > m) m = u; if (m == "null") { print "null null"; exit }
		inc = m - i; if (inc < 0) inc = 0
		g = inc < 5 ? "A+" : inc < 30 ? "A" : inc < 60 ? "B" : inc < 200 ? "C" : inc < 400 ? "D" : "F"
		printf "%s %.1f", g, inc }'
}
# canlı hız: verilen cihazların bayt sayaçları toplamından (yalnız gösterim)
live_rate() { # rx|tx sn cihaz...
	local dir=$1 sec=$2 a b i=0 d
	shift 2
	sumc() { local s=0 d f; for d in "$@"; do f="/sys/class/net/$d/statistics/${dir}_bytes"; [ -r "$f" ] && s=$((s + $(cat "$f"))); done; echo $s; }
	a=$(sumc "$@")
	while [ $i -lt "$sec" ]; do
		sleep 1; i=$((i + 1))
		b=$(sumc "$@")
		if [ "$dir" = rx ]; then DOWN=$(awk -v d=$((b - a)) 'BEGIN { printf "%.1f", d * 8 / 1e6 }'); else UP=$(awk -v d=$((b - a)) 'BEGIN { printf "%.1f", d * 8 / 1e6 }'); fi
		a=$b
		status
	done
}
# Bir akış: süre dolana kadar istekleri art arda tekrarla, her isteğin bayt sayısını dosyaya yaz
stream_loop() { # dl|ul cihaz url dosya
	local deadline=$(($(date +%s) + DUR)) rem
	while :; do
		rem=$((deadline - $(date +%s)))
		[ "$rem" -gt 0 ] || break
		if [ "$1" = dl ]; then
			curl -s --interface "$2" -o /dev/null --max-time "$rem" -w '%{size_download}\n' "$3" >>"$4" 2>/dev/null
		else
			# sabit boyutlu gövde (Content-Length) + "Expect:" kapalı: Ookla sunucuları chunked yüklemede yavaşlar
			curl -s --interface "$2" -H "Expect:" --data-binary "@$UL_FILE" -o /dev/null --max-time "$rem" \
				-w '%{size_upload}\n' "$3" >>"$4" 2>/dev/null
		fi
	done
}
start_downloads() { # cihaz önek
	local i=0 u dev=$1 pre=$2
	set -- $DL_URLS
	while [ $i -lt "$STREAMS" ]; do
		eval "u=\${$((i % $# + 1))}"
		stream_loop dl "$dev" "$u" "$T/$pre.$i" &
		i=$((i + 1))
	done
}
start_uploads() { # cihaz önek
	local i=0
	[ -s "$UL_FILE" ] || head -c 25000000 /dev/zero >"$UL_FILE"
	while [ $i -lt "$STREAMS" ]; do
		stream_loop ul "$1" "$UL_URL" "$T/$2.$i" &
		i=$((i + 1))
	done
}
# hat sonucunu RUNS'a ekle ve geçmişe yaz
add_run() { # wan down up idle dl ul err
	local g inc
	set -- "$@"
	if [ -z "$7" ]; then
		set -- "$1" "$2" "$3" "$4" "$5" "$6" "" $(grade_of "$4" "$5" "$6")
		g=$8; inc=$9
		RUNS="$RUNS${RUNS:+,}{\"wan\":\"$1\",\"down\":$2,\"up\":$3,\"idle_ms\":$4,\"down_ms\":$5,\"up_ms\":$6,\"grade\":\"$g\",\"increase_ms\":$inc,\"error\":\"\"}"
		mkdir -p "${HIST%/*}"
		printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$(date +%s)" "$1" "$2" "$3" "$4" "$5" "$6" "$g" "$MODE" >>"$HIST"
	else
		RUNS="$RUNS${RUNS:+,}{\"wan\":\"$1\",\"down\":0,\"up\":0,\"idle_ms\":null,\"down_ms\":null,\"up_ms\":null,\"grade\":null,\"increase_ms\":null,\"error\":\"$7\"}"
	fi
}

command -v curl >/dev/null || { PHASE=error; ERR="curl kurulu değil (apk add curl)"; status; exit 1; }
[ "$NW" -gt 0 ] || { PHASE=error; ERR="Çevrimiçi internet hattı bulunamadı"; status; exit 1; }

# ── tek hat testi (single / sequential) ─────────────────────────────────────
test_one() { # wan dev
	local wan=$1 dev=$2
	CUR_WAN=$wan; DOWN=0; UP=0; IDLE_MS=null; DL_MS=null; UL_MS=null
	rm -f "$T"/*
	PHASE=idle; status
	ping_start "$IDLE" "$T/idle" "$dev"; sleep "$IDLE"; wait
	IDLE_MS=$(median "$T/idle"); IJ=$(jitter "$T/idle")
	if [ "$IDLE_MS" = null ]; then add_run "$wan" 0 0 null null null "Ping yanıtı yok (hat çevrimdışı olabilir)"; return 1; fi
	PHASE=download; status
	ping_start "$DUR" "$T/pdl" "$dev"; start_downloads "$dev" dl; live_rate rx "$DUR" "$dev"; wait
	DOWN=$(sum_rate "$T"/dl.*); DL_MS=$(median "$T/pdl")
	PHASE=upload; status
	ping_start "$DUR" "$T/pul" "$dev"; start_uploads "$dev" ul; live_rate tx "$DUR" "$dev"; wait
	UP=$(sum_rate "$T"/ul.*); UL_MS=$(median "$T/pul")
	add_run "$wan" "$DOWN" "$UP" "$IDLE_MS" "$DL_MS" "$UL_MS" ""
}

if [ "$MODE" = combined ]; then
	# ── tüm hatlar aynı anda ──
	CUR_WAN="*"
	DEVS=$(echo "$WANS" | cut -d' ' -f2 | tr '\n' ' ')
	PHASE=idle; status
	ping_start "$IDLE" "$T/idle" "$PRIMARY_DEV"; sleep "$IDLE"; wait
	IDLE_MS=$(median "$T/idle"); IJ=$(jitter "$T/idle")
	PHASE=download; status
	ping_start "$DUR" "$T/pdl" "$PRIMARY_DEV"
	for wd in $(echo "$WANS" | tr ' ' :); do start_downloads "${wd#*:}" "dl-${wd%%:*}"; done
	live_rate rx "$DUR" $DEVS; wait
	DL_MS=$(median "$T/pdl")
	PHASE=upload; status
	ping_start "$DUR" "$T/pul" "$PRIMARY_DEV"
	for wd in $(echo "$WANS" | tr ' ' :); do start_uploads "${wd#*:}" "ul-${wd%%:*}"; done
	live_rate tx "$DUR" $DEVS; wait
	UL_MS=$(median "$T/pul")
	# hat başına + toplam
	DOWN=0; UP=0
	for w in $(echo "$WANS" | cut -d' ' -f1); do
		wd=$(sum_rate "$T"/dl-"$w".*); wu=$(sum_rate "$T"/ul-"$w".*)
		RUNS="$RUNS${RUNS:+,}{\"wan\":\"$w\",\"down\":$wd,\"up\":$wu,\"idle_ms\":null,\"down_ms\":null,\"up_ms\":null,\"grade\":null,\"increase_ms\":null,\"error\":\"\"}"
		DOWN=$(awk -v a="$DOWN" -v b="$wd" 'BEGIN { printf "%.1f", a + b }'); UP=$(awk -v a="$UP" -v b="$wu" 'BEGIN { printf "%.1f", a + b }')
	done
	set -- $(grade_of "$IDLE_MS" "$DL_MS" "$UL_MS")
	CUR_WAN="*"; PHASE=done
	EXTRA=",\"grade\":\"$1\",\"increase_ms\":$2,\"idle_jitter_ms\":${IJ:-null},\"finished\":$(date +%s)"
	status
	mkdir -p "${HIST%/*}"
	printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$(date +%s)" "*" "$DOWN" "$UP" "$IDLE_MS" "$DL_MS" "$UL_MS" "$1" combined >>"$HIST"
else
	# ── tek hat veya sırayla ──
	echo "$WANS" >"$T.list"
	while read -r w d; do
		[ -n "$w" ] && test_one "$w" "$d" </dev/null
	done <"$T.list"
	rm -f "$T.list"
	if [ "$MODE" = single ]; then
		# geriye dönük uyumlu üst düzey alanlar = tek hattın sonucu
		set -- $(grade_of "$IDLE_MS" "$DL_MS" "$UL_MS")
		if [ "$IDLE_MS" = null ]; then PHASE=error; ERR="Ping yanıtı yok ($TARGET)"; status; exit 1; fi
		PHASE=done
		EXTRA=",\"grade\":\"$1\",\"increase_ms\":$2,\"idle_jitter_ms\":${IJ:-null},\"finished\":$(date +%s)"
	else
		# sırayla: üst düzey = en iyi indirme; not = en kötü hat notu
		PHASE=done; CUR_WAN="*"
		EXTRA=",\"finished\":$(date +%s)"
	fi
	status
fi

[ -f "$HIST" ] && [ "$(wc -l <"$HIST")" -gt 100 ] && { tail -n 50 "$HIST" >"$HIST.tmp" && mv "$HIST.tmp" "$HIST"; }
exit 0
