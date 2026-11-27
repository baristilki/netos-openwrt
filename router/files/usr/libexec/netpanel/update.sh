#!/bin/sh
# NetOS güncelleyici — GitHub "Releases" üzerinden
#   update.sh check {force}   -> {current, latest, available, notes, published, url, auto, checked, error}
#   update.sh apply           -> en son sürümü indirip install.sh ile kurar (ayarlar korunur), arka planda
#   update.sh status          -> {state: idle|running|done|error, log}
#   update.sh set {auto}      -> otomatik güncelleme aç/kapa
#   update.sh cron            -> günlük kontrol (cron): yeni sürüm varsa otomatikse kurar, değilse bildirir
#
# Depo: netpanel.update.repo (varsayılan aşağıda). Yalnız github.com'dan HTTPS ile indirir.

. "${NP_COMMON:-/usr/share/netpanel/common.sh}"

REPO=$(uci -q get netpanel.update.repo)
case "$REPO" in */*) ;; *) REPO=baristilki/netos-openwrt ;; esac
CUR=$(cat /usr/share/netpanel/version 2>/dev/null); [ -n "$CUR" ] || CUR=0.0.0
CACHE=/tmp/netpanel-update.json
ST=/tmp/netpanel-update.state
LOG=/tmp/netpanel-update.log
WORK=/tmp/netos-update

err() { printf '{"ok":false,"error":"%s"}\n' "$1"; exit 0; }
jstr() { printf '"%s"' "$(printf '%s' "$1" | sed 's/[\\"]/\\&/g' | tr '\n\r\t' '   ' | tr -d '\000-\037')"; }
# a > b ? (1.10.0 > 1.9.3)
newer() {
	awk -v a="${1#v}" -v b="${2#v}" 'BEGIN { na = split(a, x, "."); nb = split(b, y, ".")
		for (i = 1; i <= 3; i++) { p = x[i] + 0; q = y[i] + 0; if (p > q) exit 0; if (p < q) exit 1 } exit 1 }'
}
auto_on() { [ "$(uci -q get netpanel.update.auto)" = 1 ]; }

fetch_latest() { # -> $CACHE (ham GitHub yanıtı + zaman)
	command -v curl >/dev/null || return 2
	curl -fsS -m 20 -H 'Accept: application/vnd.github+json' -A 'NetOS-updater' \
		"https://api.github.com/repos/$REPO/releases/latest" -o "$CACHE.raw" 2>/dev/null || return 1
	date +%s >"$CACHE.time"
}

check() {
	local input force age tag notes pub url avail=false e=""
	input=$(cat 2>/dev/null); json_load "$input" 2>/dev/null; json_get_var force force
	age=$(( $(date +%s) - $(cat "$CACHE.time" 2>/dev/null || echo 0) ))
	if [ "$force" = 1 ] || [ ! -s "$CACHE.raw" ] || [ "$age" -gt 3600 ]; then
		fetch_latest
		case $? in
		1) e="GitHub'a ulaşılamadı ya da henüz yayınlanmış sürüm yok ($REPO)" ;;
		2) e="curl kurulu değil" ;;
		esac
	fi
	if [ -s "$CACHE.raw" ]; then
		tag=$(jsonfilter -i "$CACHE.raw" -e '@.tag_name' 2>/dev/null)
		notes=$(jsonfilter -i "$CACHE.raw" -e '@.body' 2>/dev/null | head -c 1500)
		pub=$(jsonfilter -i "$CACHE.raw" -e '@.published_at' 2>/dev/null)
		url=$(jsonfilter -i "$CACHE.raw" -e '@.html_url' 2>/dev/null)
		[ -n "$tag" ] && newer "$tag" "$CUR" && avail=true
	fi
	printf '{"current":%s,"latest":%s,"available":%s,"notes":%s,"published":%s,"url":%s,"repo":%s,"auto":%s,"checked":%d,"error":%s}\n' \
		"$(jstr "$CUR")" "$(jstr "${tag#v}")" "$avail" "$(jstr "$notes")" "$(jstr "$pub")" "$(jstr "$url")" "$(jstr "$REPO")" \
		"$(auto_on && echo true || echo false)" "$(cat "$CACHE.time" 2>/dev/null || echo 0)" "$(jstr "$e")"
}

# arka planda çalışan kurulum
do_apply() {
	local tag src
	echo running >"$ST"
	: >"$LOG"
	{
		echo "NetOS güncellemesi başladı: $(date)"
		fetch_latest || { echo "HATA: sürüm bilgisi alınamadı"; echo error >"$ST"; return; }
		tag=$(jsonfilter -i "$CACHE.raw" -e '@.tag_name')
		case "$tag" in '' | *[!A-Za-z0-9._-]*) echo "HATA: geçersiz sürüm etiketi"; echo error >"$ST"; return ;; esac
		echo "İndiriliyor: $REPO $tag"
		rm -rf "$WORK" && mkdir -p "$WORK"
		curl -fsSL -m 120 -A 'NetOS-updater' "https://codeload.github.com/$REPO/tar.gz/refs/tags/$tag" -o "$WORK/src.tar.gz" ||
			{ echo "HATA: indirilemedi"; echo error >"$ST"; return; }
		tar -xzf "$WORK/src.tar.gz" -C "$WORK" || { echo "HATA: arşiv açılamadı"; echo error >"$ST"; return; }
		src=$(find "$WORK" -maxdepth 3 -path '*/router/install.sh' | head -1)
		[ -n "$src" ] || { echo "HATA: arşivde router/install.sh yok"; echo error >"$ST"; return; }
		rm -rf /tmp/netpanel && cp -r "$(dirname "$src")" /tmp/netpanel
		echo "Kuruluyor…"
		if sh /tmp/netpanel/install.sh; then
			echo "Tamam: $(cat /usr/share/netpanel/version 2>/dev/null)"
			echo done >"$ST"
			np_notify "NetOS $(cat /usr/share/netpanel/version 2>/dev/null) sürümüne güncellendi." >/dev/null 2>&1
		else
			echo "HATA: kurulum başarısız"
			echo error >"$ST"
		fi
		rm -rf "$WORK"
	} >>"$LOG" 2>&1
}

case "$1" in
check) check ;;
apply)
	[ "$(cat "$ST" 2>/dev/null)" = running ] && kill -0 "$(cat "$ST.pid" 2>/dev/null)" 2>/dev/null && { echo '{"ok":true,"already":true}'; exit 0; }
	command -v curl >/dev/null || err "curl kurulu değil"
	# install.sh rpcd/uhttpd'yi yeniden başlatır; bu isteğe yanıt döndükten sonra başlasın
	echo running >"$ST"
	# setsid: rpcd yeniden başlarken güncelleme süreci ölmesin
	if command -v setsid >/dev/null; then
		(setsid "$0" run >/dev/null 2>&1 </dev/null &
		echo $! >"$ST.pid")
	else
		("$0" run >/dev/null 2>&1 </dev/null &
		echo $! >"$ST.pid")
	fi
	echo '{"ok":true}'
	;;
run)
	sleep 2
	do_apply
	;;
status)
	printf '{"state":%s,"current":%s,"log":%s}\n' "$(jstr "$(cat "$ST" 2>/dev/null || echo idle)")" "$(jstr "$CUR")" \
		"\"$(tail -n 15 "$LOG" 2>/dev/null | sed 's/[\\"]/\\&/g' | tr -d '\000-\011\013-\037' | awk '{ printf "%s\\n", $0 }')\""
	;;
set)
	input=$(cat); json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var auto auto
	[ "$(uci -q get netpanel.update)" = update ] || uci set netpanel.update=update
	uci set "netpanel.update.auto=$([ "$auto" = 1 ] && echo 1 || echo 0)"
	uci commit netpanel
	echo '{"ok":true}'
	;;
cron)
	fetch_latest || exit 0
	tag=$(jsonfilter -i "$CACHE.raw" -e '@.tag_name' 2>/dev/null)
	[ -n "$tag" ] && newer "$tag" "$CUR" || exit 0
	if auto_on; then
		do_apply
	elif [ "$(cat /etc/netpanel/update-notified 2>/dev/null)" != "$tag" ]; then
		np_notify "Yeni NetOS sürümü: ${tag#v} (kurulu: $CUR). Panel > Sistem > Güncelleme'den kurabilirsiniz." >/dev/null 2>&1
		echo "$tag" >/etc/netpanel/update-notified
	fi
	;;
*) echo "kullanım: $0 check|apply|status|set|cron" >&2; exit 1 ;;
esac
exit 0
