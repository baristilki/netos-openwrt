#!/bin/sh
# NetOS giriş koruması: hatalı giriş denemelerini sayar, sınırı aşan IP'yi geçici kilitler
#   authguard.sh check <ip>          -> kalan kilit süresi (sn), kilit yoksa 0
#   authguard.sh fail <ip> <kaynak>  -> hatayı say; "kalan_hak kilit_sn" yazar
#   authguard.sh ok <ip>             -> başarılı giriş: sayacı sıfırla
#   authguard.sh scan                -> (dakikalık) LuCI ve SSH günlüğündeki hatalı girişleri işle
#   authguard.sh restore             -> nft tablosu yeniden yüklenince aktif kilitleri geri koy
#   authguard.sh list | unban <ip>   -> JSON: kilitli IP'ler / kilidi kaldır
# Kural: 15 dk içinde 5 hata -> kilit (5 dk, sonra 15 dk, sonra 60 dk). Kilitli IP'nin
# router'a 22/80/443 bağlantıları nft "ban" setiyle düşürülür (yerel adresler hariç).

. "${NP_COMMON:-/usr/share/netpanel/common.sh}"

D=${NP_AUTH_DIR:-/tmp/netos-auth}
MAXF=5
WINDOW=900
mkdir -p "$D" && chmod 700 "$D"

valid() { printf '%s' "$1" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-fA-F:]{2,39}$'; }
fname() { echo "$D/$(echo "$1" | tr '.:' '_-')"; }
self_ip() { # router'ın kendisi / döngü: nft ile asla engelleme (tünel ve yerel servisler bozulur)
	case "$1" in 127.* | ::1) return 0 ;; esac
	ip -o addr 2>/dev/null | awk '{ sub(/\/.*/, "", $4); print $4 }' | grep -qx "$1"
}
nft_ban() { # ip saniye
	self_ip "$1" && return 0
	case "$1" in *:*) return 0 ;; esac
	nft add element inet netpanel ban "{ $1 timeout ${2}s }" 2>/dev/null
}
load() { # dosya -> F (hata) T (ilk hata zamanı) L (kilit bitişi) N (kilit sayısı) S (kaynak)
	F=0; T=0; L=0; N=0; S=""
	[ -f "$1" ] && read -r F T L N S <"$1"
	F=${F:-0}; T=${T:-0}; L=${L:-0}; N=${N:-0}
}

check() {
	local now f
	valid "$1" || { echo 0; return; }
	now=$(date +%s); f=$(fname "$1"); load "$f"
	[ "$L" -gt "$now" ] && echo $((L - now)) || echo 0
}
fail() { # ip kaynak
	local now f dur
	valid "$1" || { echo "$MAXF 0"; return; }
	now=$(date +%s); f=$(fname "$1"); load "$f"
	[ "$L" -gt "$now" ] && { echo "0 $((L - now))"; return; }
	[ $((now - T)) -gt $WINDOW ] && { F=0; T=$now; }
	F=$((F + 1))
	logger -p authpriv.warn -t netos "hatalı giriş: $2, $1 ($F/$MAXF)"
	if [ "$F" -ge "$MAXF" ]; then
		case "$N" in 0) dur=300 ;; 1) dur=900 ;; *) dur=3600 ;; esac
		L=$((now + dur)); N=$((N + 1)); F=0
		echo "$F $T $L $N $2" >"$f"
		nft_ban "$1" "$dur"
		logger -p authpriv.warn -t netos "giriş kilidi: $1, $((dur / 60)) dk ($2)"
		np_notify "🔒 $1 adresinden $MAXF hatalı giriş denemesi ($2). Bu adres $((dur / 60)) dakika engellendi." system >/dev/null 2>&1 &
		echo "0 $dur"
		return
	fi
	echo "$F $T $L $N $2" >"$f"
	echo "$((MAXF - F)) 0"
}
ok() { valid "$1" && rm -f "$(fname "$1")"; }

# LuCI: "luci: failed login on /... for root from 1.2.3.4"; dropbear: "Bad password attempt for 'root' from 1.2.3.4:5555"
scan() {
	local last now ts line ip src
	last=$(cat "$D/.scan" 2>/dev/null || echo 0)
	now=$(date +%s)
	logread 2>/dev/null | grep -E 'luci: failed login|Bad password attempt|Login attempt for nonexistent user' | while read -r line; do
		ts=$(date -D '%a %b %d %H:%M:%S %Y' -d "$(echo "$line" | cut -c1-24)" +%s 2>/dev/null) || continue
		[ "$ts" -gt "$last" ] || continue
		case "$line" in
		*luci:*) src=LuCI; ip=$(echo "$line" | sed -n 's/.* from \([^ ]*\)$/\1/p') ;;
		*) src=SSH; ip=$(echo "$line" | sed -n 's/.* from \([0-9.]*\):[0-9]*.*/\1/p') ;;
		esac
		[ -n "$ip" ] && fail "$ip" "$src" >/dev/null
	done
	echo "$now" >"$D/.scan"
}
restore() {
	local f now
	now=$(date +%s)
	for f in "$D"/*; do
		[ -f "$f" ] || continue
		load "$f"
		[ "$L" -gt "$now" ] && nft_ban "$(basename "$f" | tr '_-' '.:')" $((L - now))
	done
	return 0
}
list() {
	local f now first=1 ip
	now=$(date +%s)
	printf '{"locked":['
	for f in "$D"/*; do
		[ -f "$f" ] || continue
		load "$f"
		[ "$L" -gt "$now" ] || continue
		ip=$(basename "$f" | tr '_-' '.:')
		[ $first = 1 ] || printf ','
		first=0
		printf '{"ip":"%s","until":%d,"source":"%s","count":%d}' "$ip" "$L" "$S" "$N"
	done
	printf '],"max":%d}\n' "$MAXF"
}
unban() {
	valid "$1" || { echo '{"ok":false,"error":"Geçersiz IP"}'; return; }
	rm -f "$(fname "$1")"
	nft delete element inet netpanel ban "{ $1 }" 2>/dev/null
	echo '{"ok":true}'
}

case "$1" in
check) check "$2" ;;
fail) fail "$2" "${3:-NetOS}" ;;
ok) ok "$2" ;;
scan) scan ;;
restore) restore ;;
list) list ;;
unban)
	input=$(cat); json_load "$input" 2>/dev/null; json_get_var ip ip
	unban "$ip" ;;
*) echo "kullanım: $0 check|fail|ok|scan|restore|list|unban" >&2; exit 1 ;;
esac
exit 0
