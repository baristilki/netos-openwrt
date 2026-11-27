#!/bin/sh
# LAN'daki çevrimiçi cihazlarda web arayüzü arar -> /tmp/netpanel-web.tsv  (ip \t url url ...)
# Yalnız bağlantı denemesi yapar (HTTP GET /, 2 sn zaman aşımı), hiçbir şey göndermez.

. "${NP_COMMON:-/usr/share/netpanel/common.sh}"

OUT=${NP_WEB_OUT:-/tmp/netpanel-web.tsv}
TMP=$(mktemp -d)
LOCK=/tmp/netpanel-web.lock
PORTS="80:http 443:https 8080:http 8443:https 8006:https 5000:http 5001:https 8123:http 3000:http 9000:http 32400:http 8096:http 81:http 8888:http"

command -v curl >/dev/null || exit 0
if command -v lock >/dev/null; then
	lock -n "$LOCK" || exit 0
	trap 'lock -u "$LOCK"; rm -rf "$TMP"' EXIT
else
	trap 'rm -rf "$TMP"' EXIT
fi

LAN=$(np_ifdev lan); [ -n "$LAN" ] || LAN=br-lan
SELF=$(ip -4 addr show dev "$LAN" 2>/dev/null | awk '/inet / { sub(/\/.*/, "", $2); print $2 }')

scan_ip() {
	local ip=$1 ps p s u code urls=""
	for ps in $PORTS; do
		p=${ps%%:*}; s=${ps#*:}
		case "$p:$s" in 80:http | 443:https) u="$s://$ip" ;; *) u="$s://$ip:$p" ;; esac
		code=$(curl -sk -o /dev/null -m 2 --connect-timeout 1 -w '%{http_code}' "$u/" 2>/dev/null)
		case "$code" in '' | 000) ;; *) urls="$urls $u/" ;; esac
	done
	[ -n "$urls" ] && printf '%s\t%s\n' "$ip" "${urls# }" >"$TMP/$ip"
}

for ip in $(np_neigh | awk -F'\t' -v d="$LAN" '$3 == d && $4 ~ /REACHABLE|STALE|DELAY|PROBE|PERMANENT/ { print $2 }' | sort -u); do
	[ "$ip" = "$SELF" ] && continue
	scan_ip "$ip" &
done
wait
cat "$TMP"/* 2>/dev/null >"$OUT.new"
mv "$OUT.new" "$OUT"
