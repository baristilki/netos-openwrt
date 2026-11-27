#!/bin/sh
# NetOS <-> TP-Link Archer (AX/BE serisi, yeni şifreli web arayüzü) köprüsü — DENEYSEL
# Hedef: Archer BE230 v2 (fw 1.3.x). Henüz gerçek cihazda doğrulanmadı.
#
#   tplink.sh status                -> {enabled, connected, model, bands:[{band, enabled, ssid}], error}
#   tplink.sh set <2g|5g> <0|1>     -> bandı aç/kapat
#   tplink.sh wifi_set < {band, ssid, password}
#   tplink.sh debug                 -> son giriş denemesinin adımları (şifre içermez)
#
# Protokol (TP-Link "luci" şifreli API):
#   1) /login?form=keys  -> şifre için RSA anahtarı (n, e)
#   2) /login?form=auth  -> imza için RSA anahtarı (n, e) + seq
#   3) AES-128-CBC anahtar/iv (16 rakam), h = md5(kullanıcı + şifre)
#      data = base64(AES("password=<RSA(şifre) hex>&operation=login"))
#      sign = RSA_parça("k=KEY&i=IV&h=H&s=<seq + len(data)>")   (PKCS#1 v1.5, hex)
#   4) yanıt AES ile çözülür -> stok; sonraki istekler ;stok=<stok>/admin/... aynı şifrelemeyle
# Ayarlar: uci netpanel.tplink.{enabled,host,username,password}. Gerekli: curl, openssl-util.

. "${NP_JSHN:-/usr/share/libubox/jshn.sh}"

D=${NP_TP_DIR:-/tmp/netpanel-tp}
JAR=$D/cookies
mkdir -p "$D" && chmod 700 "$D"
if command -v lock >/dev/null; then lock "$D/.lock"; trap 'lock -u "$D/.lock"' EXIT; fi

cfg() { uci -q get "netpanel.tplink.$1"; }
HOST=$(cfg host)
USER_=$(cfg username); USER_=${USER_:-admin}
BASE="http://$HOST/cgi-bin/luci/;stok="
ERR=""
dbg() { echo "$(date +%T) $*" >>"$D/debug"; }

tohex() { od -An -tx1 | tr -d ' \n'; }
md5_hex() { printf '%s' "$1" | md5sum | cut -d' ' -f1; }
rand16() { od -An -tu1 -N48 /dev/urandom | tr -dc '0-9' | head -c 16; }

# n,e (hex) -> PEM
pem_from() { # n e çıktı
	printf 'asn1=SEQUENCE:k\n[k]\nn=INTEGER:0x%s\ne=INTEGER:0x%s\n' "$1" "$2" >"$D/k.cnf"
	openssl asn1parse -genconf "$D/k.cnf" -noout -out "$D/k.der" >/dev/null 2>&1 &&
		openssl rsa -RSAPublicKey_in -inform DER -in "$D/k.der" -pubout -out "$3" >/dev/null 2>&1
	rm -f "$D/k.cnf" "$D/k.der"
	[ -s "$3" ]
}
# RSA PKCS#1 v1.5, anahtar boyuna göre parçalı, hex
rsa_hex() { # metin pem anahtar_bayt
	local s="$1" out="" i=0 step=$(($3 - 11))
	while [ $i -lt ${#s} ]; do
		out="$out$(printf '%s' "$s" | cut -c$((i + 1))-$((i + step)) | tr -d '\n' | openssl pkeyutl -encrypt -pubin -inkey "$2" 2>/dev/null | tohex)"
		i=$((i + step))
	done
	printf '%s' "$out"
}
aes_enc() { printf '%s' "$1" | openssl enc -aes-128-cbc -K "$(printf '%s' "$AESK" | tohex)" -iv "$(printf '%s' "$AESI" | tohex)" -A -a 2>/dev/null; }
aes_dec() { printf '%s' "$1" | openssl enc -d -aes-128-cbc -K "$(printf '%s' "$AESK" | tohex)" -iv "$(printf '%s' "$AESI" | tohex)" -A -a 2>/dev/null; }
urlenc() { printf '%s' "$1" | od -An -tx1 | tr -d '\n' | sed 's/ /%/g'; }

post() { # yol gövde -> yanıt
	curl -s -m 10 -b "$JAR" -c "$JAR" -H 'Content-Type: application/x-www-form-urlencoded' \
		-H "Referer: http://$HOST/webpages/index.html" --data-binary "$2" "$BASE$1" 2>/dev/null
}

login() {
	local r pn pe sn se seq pwd data sign enc h
	: >"$D/debug"
	[ -n "$HOST" ] || { ERR="TP-Link IP adresi girilmedi"; return 1; }
	[ -n "$(cfg password)" ] || { ERR="TP-Link şifresi girilmedi"; return 1; }
	command -v curl >/dev/null && command -v openssl >/dev/null || { ERR="curl ve openssl-util gerekli"; return 1; }
	rm -f "$JAR"
	r=$(post '/login?form=keys' 'operation=read')
	dbg "keys: $(printf '%s' "$r" | head -c 80)"
	pn=$(printf '%s' "$r" | jsonfilter -e '@.data.password[0]' 2>/dev/null); pe=$(printf '%s' "$r" | jsonfilter -e '@.data.password[1]' 2>/dev/null)
	[ -n "$pn" ] || { ERR="TP-Link yanıt vermedi ya da bu model desteklenmiyor ($HOST)"; return 1; }
	r=$(post '/login?form=auth' 'operation=read')
	dbg "auth: $(printf '%s' "$r" | head -c 80)"
	sn=$(printf '%s' "$r" | jsonfilter -e '@.data.key[0]' 2>/dev/null); se=$(printf '%s' "$r" | jsonfilter -e '@.data.key[1]' 2>/dev/null)
	seq=$(printf '%s' "$r" | jsonfilter -e '@.data.seq' 2>/dev/null)
	[ -n "$sn" ] && [ -n "$seq" ] || { ERR="TP-Link oturum anahtarı alınamadı"; return 1; }
	pem_from "$pn" "$pe" "$D/pwd.pem" && pem_from "$sn" "$se" "$D/sign.pem" || { ERR="RSA anahtarı okunamadı"; return 1; }
	AESK=$(rand16); AESI=$(rand16)
	h=$(md5_hex "$USER_$(cfg password)")
	pwd=$(rsa_hex "$(cfg password)" "$D/pwd.pem" $((${#pn} / 2)))
	enc=$(aes_enc "password=$pwd&operation=login")
	sign=$(rsa_hex "k=$AESK&i=$AESI&h=$h&s=$((seq + ${#enc}))" "$D/sign.pem" $((${#sn} / 2)))
	r=$(post '/login?form=login' "sign=$sign&data=$(urlenc "$enc")")
	dbg "login yanıtı: $(printf '%s' "$r" | head -c 60)"
	data=$(printf '%s' "$r" | jsonfilter -e '@.data' 2>/dev/null)
	r=$(aes_dec "$data")
	dbg "login çözülmüş: $(printf '%s' "$r" | sed 's/"stok":"[^"]*"/"stok":"***"/' | head -c 120)"
	STOK=$(printf '%s' "$r" | jsonfilter -e '@.data.stok' 2>/dev/null)
	if [ -z "$STOK" ]; then
		case "$(printf '%s' "$r" | jsonfilter -e '@.errorcode' 2>/dev/null)" in
		login\ failed | *password*) ERR="TP-Link şifresi yanlış" ;;
		*) ERR="TP-Link girişi başarısız (deneysel destek; tplink.sh debug)" ;;
		esac
		return 1
	fi
	printf '%s\n%s\n%s\n%s\n%s\n%s\n' "$STOK" "$AESK" "$AESI" "$h" "$seq" "$((${#sn} / 2))" >"$D/session"
	chmod 600 "$D/session"
}
session() {
	[ -s "$D/session" ] || login || return 1
	{ read -r STOK; read -r AESK; read -r AESI; read -r HSH; read -r SEQ; read -r SKB; } <"$D/session"
}
# şifreli admin isteği: yol (admin/...) düz_gövde -> çözülmüş JSON
api() {
	local enc sign r data out
	session || return 1
	enc=$(aes_enc "$2")
	sign=$(rsa_hex "h=$HSH&s=$((SEQ + ${#enc}))" "$D/sign.pem" "${SKB:-64}")
	r=$(post "$STOK/$1" "sign=$sign&data=$(urlenc "$enc")")
	data=$(printf '%s' "$r" | jsonfilter -e '@.data' 2>/dev/null)
	out=$(aes_dec "$data")
	if [ -z "$out" ]; then
		dbg "$1: oturum düştü, yeniden giriş"
		rm -f "$D/session"; login || return 1
		session; enc=$(aes_enc "$2")
		sign=$(rsa_hex "h=$HSH&s=$((SEQ + ${#enc}))" "$D/sign.pem" "${SKB:-64}")
		r=$(post "$STOK/$1" "sign=$sign&data=$(urlenc "$enc")")
		out=$(aes_dec "$(printf '%s' "$r" | jsonfilter -e '@.data' 2>/dev/null)")
	fi
	[ -n "$out" ] || { ERR="TP-Link isteği başarısız ($1)"; return 1; }
	printf '%s' "$out"
}

band_form() { case "$1" in 2g) echo wireless_2g ;; 5g) echo wireless_5g ;; *) return 1 ;; esac; }

status() {
	local b r en ssid
	json_init
	json_add_boolean enabled "$([ "$(cfg enabled)" = 1 ] && echo 1 || echo 0)"
	json_add_string host "$HOST"
	json_add_string username "$USER_"
	json_add_boolean password_set "$([ -n "$(cfg password)" ] && echo 1 || echo 0)"
	if [ "$(cfg enabled)" != 1 ]; then json_add_boolean connected 0; json_dump; return; fi
	json_add_array bands
	for b in 2g 5g; do
		r=$(api "admin/wireless?form=$(band_form $b)" "operation=read") || break
		dbg "$b: $(printf '%s' "$r" | sed 's/"psk_key":"[^"]*"/"psk_key":"***"/g' | head -c 200)"
		en=$(printf '%s' "$r" | jsonfilter -e '@.data.enable' 2>/dev/null)
		ssid=$(printf '%s' "$r" | jsonfilter -e '@.data.ssid' 2>/dev/null)
		json_add_object
		json_add_string band "$b"
		json_add_boolean enabled "$([ "$en" = on ] || [ "$en" = true ] || [ "$en" = 1 ] && echo 1 || echo 0)"
		json_add_string ssid "$ssid"
		json_close_object
	done
	json_close_array
	json_add_boolean connected "$([ -z "$ERR" ] && echo 1 || echo 0)"
	[ -n "$ERR" ] && json_add_string error "$ERR"
	json_dump
}
set_band() { # band 0|1
	local f
	f=$(band_form "$1") || { echo '{"ok":false,"error":"Geçersiz bant"}'; return; }
	if api "admin/wireless?form=$f" "operation=write&enable=$([ "$2" = 1 ] && echo on || echo off)" >/dev/null; then echo '{"ok":true}'
	else printf '{"ok":false,"error":"%s"}\n' "$ERR"; fi
}
wifi_set() {
	local input band ssid pw f body
	input=$(cat); json_load "$input" 2>/dev/null
	json_get_var band band; json_get_var ssid ssid; json_get_var pw password
	f=$(band_form "$band") || { echo '{"ok":false,"error":"Geçersiz bant"}'; return; }
	[ -z "$ssid" ] || [ ${#ssid} -le 32 ] || { echo '{"ok":false,"error":"Ağ adı en fazla 32 karakter"}'; return; }
	[ -z "$pw" ] || { [ ${#pw} -ge 8 ] && [ ${#pw} -le 63 ]; } || { echo '{"ok":false,"error":"Şifre 8-63 karakter olmalı"}'; return; }
	body="operation=write"
	[ -n "$ssid" ] && body="$body&ssid=$(urlenc "$ssid")"
	[ -n "$pw" ] && body="$body&psk_key=$(urlenc "$pw")"
	if api "admin/wireless?form=$f" "$body" >/dev/null; then echo '{"ok":true}'
	else printf '{"ok":false,"error":"%s"}\n' "$ERR"; fi
}

case "$1" in
status) status ;;
set) set_band "$2" "$3" ;;
wifi_set) wifi_set ;;
debug) cat "$D/debug" 2>/dev/null ;;
*) echo "kullanım: $0 status|set <2g|5g> <0|1>|wifi_set|debug" >&2; exit 1 ;;
esac
