#!/bin/sh
# NetPanel <-> HUAWEI WiFi AX2 (WS5200/WS7001 ailesi, HarmonyOS 2 web arayüzü) köprüsü
#
#   huawei.sh status            -> JSON: bağlantı, SSID'ler, 2,4/5 GHz açık/kapalı
#   huawei.sh set <2g|5g> <0|1> -> JSON: {"ok":true} / {"ok":false,"error":"..."}
#   huawei.sh proof <pass> <salthex> <iter> <firstnonce> <servernonce>   (test için)
#
# Giriş: SCRAM-SHA256 (system/user_login_nonce + system/user_login_proof), CSRF token her
# yanıtta yenilenir, oturum çerezde tutulur. Gerekli paketler: curl, openssl-util.
# Ayarlar: uci netpanel.huawei.{enabled,host,username,password}

. "${NP_JSHN:-/usr/share/libubox/jshn.sh}"

D=${NP_HW_DIR:-/tmp/netpanel-hw}
JAR=$D/cookies
CSRF=$D/csrf
FAIL=$D/authfail
mkdir -p "$D" && chmod 700 "$D"

# Aynı anda tek oturum/istek dizisi (CSRF token'ı her yanıtta değişir; paralel çağrılar bozar)
if [ "$1" != proof ] && command -v lock >/dev/null; then
	lock "$D/.lock"
	trap 'lock -u "$D/.lock"' EXIT
fi

cfg() { uci -q get "netpanel.huawei.$1"; }

# ── kripto yardımcıları (openssl) ───────────────────────────────────────────
tohex() { od -An -tx1 | tr -d ' \n'; }
hex2bin() {
	# printf formatı yalnızca \ooo kaçışlarından oluşur
	printf "$(printf '%s' "$1" | awk '{
		h = "0123456789abcdef"; s = tolower($0)
		for (i = 1; i < length(s); i += 2)
			printf "\\%03o", (index(h, substr(s, i, 1)) - 1) * 16 + index(h, substr(s, i + 1, 1)) - 1
	}')"
}
hmac_hex() { openssl dgst -sha256 -mac HMAC -macopt "hexkey:$1" | tr -d '\r' | awk '{ print tolower($NF) }'; }
sha256_hex() { openssl dgst -sha256 | tr -d '\r' | awk '{ print tolower($NF) }'; }
pbkdf2_hex() { # pass salthex iter
	openssl kdf -keylen 32 -kdfopt digest:SHA256 -kdfopt "hexpass:$(printf '%s' "$1" | tohex)" \
		-kdfopt "hexsalt:$2" -kdfopt "iter:$3" PBKDF2 | tr -d ': \r\n' | tr 'A-F' 'a-f'
}
xor_hex() {
	awk -v a="$1" -v b="$2" 'function hv(c) { return index("0123456789abcdef", c) - 1 }
	BEGIN {
		for (i = 1; i <= length(a); i++) {
			x = hv(substr(a, i, 1)); y = hv(substr(b, i, 1)); r = 0
			for (k = 8; k >= 1; k /= 2) { if ((x >= k) != (y >= k)) r += k; if (x >= k) x -= k; if (y >= k) y -= k }
			printf "%x", r
		}
	}'
}
client_proof() { # pass salthex iter firstnonce servernonce
	local sp ck sk sig
	sp=$(pbkdf2_hex "$1" "$2" "$3")
	ck=$(printf 'Client Key' | hmac_hex "$sp")
	sk=$(hex2bin "$ck" | sha256_hex)
	sig=$(printf '%s' "$4,$5,$5" | hmac_hex "$sk")
	xor_hex "$ck" "$sig"
}

# ── HTTP ────────────────────────────────────────────────────────────────────
HOST=$(cfg host)
USER=$(cfg username); [ -n "$USER" ] || USER=admin

hw_curl() {
	curl -s -m 10 -b "$JAR" -c "$JAR" \
		-H '_ResponseFormat: JSON' \
		-H 'Accept: application/json, text/javascript, */*; q=0.01' \
		-H 'X-Requested-With: XMLHttpRequest' "$@"
}
jget() { printf '%s' "$1" | jsonfilter -e "$2" 2>/dev/null; }
save_csrf() {
	local p t
	p=$(jget "$1" '@.csrf_param'); t=$(jget "$1" '@.csrf_token')
	[ -n "$p" ] && [ -n "$t" ] && printf '%s %s\n' "$p" "$t" >"$CSRF"
}
hw_post() { # path datajson
	local p t body resp
	read -r p t <"$CSRF" 2>/dev/null
	body="{\"csrf\":{\"csrf_param\":\"$p\",\"csrf_token\":\"$t\"},\"data\":$2}"
	resp=$(hw_curl -X POST -H 'Content-Type: application/json; charset=utf-8' --data-binary "$body" "http://$HOST/api/$1")
	save_csrf "$resp"
	printf '%s' "$resp"
}
hw_get() { hw_curl "http://$HOST/api/$1"; }
is_json() { case "$1" in '{'* | '['*) return 0 ;; esac; return 1; }

ERR=""
login() {
	local html p t fn resp salt iter sn proof err
	if [ -f "$FAIL" ]; then ERR=$(cat "$FAIL"); return 1; fi
	[ -n "$(cfg password)" ] || { ERR="Huawei şifresi girilmedi"; return 1; }
	rm -f "$JAR" "$CSRF"
	html=$(hw_curl "http://$HOST/html/index.html") || { ERR="Huawei'ye ulaşılamıyor ($HOST)"; return 1; }
	p=$(printf '%s' "$html" | sed -n 's/.*name="csrf_param" content="\([^"]*\)".*/\1/p' | head -1)
	t=$(printf '%s' "$html" | sed -n 's/.*name="csrf_token" content="\([^"]*\)".*/\1/p' | head -1)
	[ -n "$p" ] && [ -n "$t" ] || { ERR="Huawei giriş sayfası tanınmadı"; return 1; }
	printf '%s %s\n' "$p" "$t" >"$CSRF"

	fn=$(head -c 32 /dev/urandom | tohex)
	resp=$(hw_post system/user_login_nonce "{\"username\":\"$USER\",\"firstnonce\":\"$fn\"}")
	err=$(jget "$resp" '@.err')
	if [ "$err" != 0 ]; then
		ERR="Huawei giriş isteğini reddetti ($(jget "$resp" '@.errcode'))"
		[ -n "$(jget "$resp" '@.waitTime')" ] && ERR="Huawei girişi geçici olarak kilitli, $(jget "$resp" '@.waitTime') sn sonra deneyin"
		return 1
	fi
	salt=$(jget "$resp" '@.salt'); iter=$(jget "$resp" '@.iterations'); sn=$(jget "$resp" '@.servernonce')
	proof=$(client_proof "$(cfg password)" "$salt" "$iter" "$fn" "$sn")
	resp=$(hw_post system/user_login_proof "{\"clientproof\":\"$proof\",\"finalnonce\":\"$sn\"}")
	if [ "$(jget "$resp" '@.err')" != 0 ]; then
		# Yanlış şifreyle tekrar denemek cihazı kilitler: şifre değişene kadar deneme yapma
		ERR="Huawei şifresi yanlış (kilitlenmemesi için yeni şifre girilene kadar denenmeyecek)"
		echo "$ERR" >"$FAIL"
		return 1
	fi
	# Wi-Fi şifresi göndermek için gereken RSA açık anahtarı (modulus/exponent, hex)
	local rn re
	rn=$(jget "$resp" '@.rsan'); re=$(jget "$resp" '@.rsae')
	if [ -n "$rn" ] && [ -n "$re" ]; then
		printf '%s %s\n' "$rn" "$re" >"$D/rsa"
		rm -f "$D/rsa.pem"
	fi
	return 0
}

# ── RSA (Huawei web arayüzüyle aynı): base64(metin) -> 214 karakterlik parçalar -> RSA-OAEP(SHA1) -> hex ──
rsa_pem() {
	local n e
	[ -s "$D/rsa.pem" ] && return 0
	read -r n e <"$D/rsa" 2>/dev/null
	[ -n "$n" ] && [ -n "$e" ] || return 1
	printf 'asn1=SEQUENCE:k\n[k]\nn=INTEGER:0x%s\ne=INTEGER:0x%s\n' "$n" "$e" >"$D/rsa.cnf"
	openssl asn1parse -genconf "$D/rsa.cnf" -noout -out "$D/rsa.der" >/dev/null 2>&1 &&
		openssl rsa -RSAPublicKey_in -inform DER -in "$D/rsa.der" -pubout -out "$D/rsa.pem" >/dev/null 2>&1
	rm -f "$D/rsa.cnf" "$D/rsa.der"
	[ -s "$D/rsa.pem" ]
}
hw_enc() { # düz metin -> hex şifreli
	local b64 out="" i=0 chunk
	rsa_pem || return 1
	b64=$(printf '%s' "$1" | openssl base64 -A)
	while [ $i -lt ${#b64} ]; do
		chunk=$(printf '%s' "$b64" | cut -c$((i + 1))-$((i + 214)))
		out="$out$(printf '%s' "$chunk" | openssl pkeyutl -encrypt -pubin -inkey "$D/rsa.pem" \
			-pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha1 2>/dev/null | tohex)"
		i=$((i + 214))
	done
	[ -n "$out" ] && printf '%s' "$out"
}

# Oturum düşmüşse bir kez yeniden giriş yaparak GET
api_get() {
	local r
	local ec
	r=$(hw_get "$1")
	ec=$(jget "$r" '@.errcode')
	if ! is_json "$r" || { [ -n "$ec" ] && [ "$ec" != 0 ]; }; then
		# api_get $(...) alt kabukta çalışır: hata mesajı dosyayla taşınır
		login || { echo "$ERR" >"$D/err"; return 1; }
		r=$(hw_get "$1")
		is_json "$r" || { echo "Huawei beklenmeyen yanıt verdi" >"$D/err"; return 1; }
	fi
	printf '%s' "$r"
}

boolv() { case "$1" in true | 1) echo 1 ;; *) echo 0 ;; esac; }

status() {
	local radio basic dbho hosts
	json_init
	json_add_boolean enabled "$([ "$(cfg enabled)" = 1 ] && echo 1 || echo 0)"
	json_add_string host "$HOST"
	json_add_string username "$USER"
	json_add_boolean password_set "$([ -n "$(cfg password)" ] && echo 1 || echo 0)"
	if [ "$(cfg enabled)" != 1 ] || [ -z "$HOST" ]; then
		json_add_boolean connected 0
		json_dump; return
	fi
	if radio=$(api_get ntwk/wlanradio); then
		basic=$(api_get 'ntwk/WlanGuideBasic?type=notshowpassall')
		dbho=$(api_get ntwk/wlandbho)
		hosts=$(api_get system/HostInfo)
		json_add_boolean connected 1
		json_add_boolean dbho "$(boolv "$(jget "$dbho" '@.DbhoEnable')")"
		json_add_array radios
		json_add_object
		json_add_string band 2g
		json_add_boolean enabled "$(boolv "$(jget "$radio" '@.Enable2G')")"
		json_add_string ssid "$(jget "$basic" '@.WifiConfig[0].WifiSsid')"
		json_close_object
		json_add_object
		json_add_string band 5g
		json_add_boolean enabled "$(boolv "$(jget "$radio" '@.Enable5G')")"
		json_add_string ssid "$(jget "$basic" '@.WifiConfig[1].WifiSsid')"
		json_close_object
		json_close_array
		json_add_int clients "$(jget "$hosts" '@[@.Active=true]' | grep -c .)"
	else
		json_add_boolean connected 0
		json_add_string error "$(cat "$D/err" 2>/dev/null)"
	fi
	json_dump
}

set_radio() { # band 0|1
	local radio val new resp dbho
	case "$1" in 2g) key=Enable2G ;; 5g) key=Enable5G ;; *) echo '{"ok":false,"error":"Geçersiz bant"}'; return ;; esac
	[ "$2" = 1 ] && val=true || val=false
	radio=$(api_get ntwk/wlanradio) || { printf '{"ok":false,"error":"%s"}\n' "$(cat "$D/err" 2>/dev/null | tr -d '"\\')"; return; }
	dbho=$(boolv "$(jget "$(api_get ntwk/wlandbho)" '@.DbhoEnable')")
	new=$(printf '%s' "$radio" | sed -E "s/\"$key\" *: *(true|false)/\"$key\":$val/")
	# Çift bant tek SSID (DBHO) açıkken Huawei iki bandı birlikte açıp kapatır
	[ "$dbho" = 1 ] && new=$(printf '%s' "$new" | sed -E "s/\"Enable(2G|5G)\" *: *(true|false)/\"Enable\1\":$val/g")
	new=$(printf '%s' "$new" | sed -E 's/^\{/{"ConfigTool":"PC",/')
	resp=$(hw_post ntwk/wlanradio "$new")
	if [ "$(jget "$resp" '@.errcode')" = 0 ]; then
		echo '{"ok":true}'
	else
		printf '{"ok":false,"error":"Huawei ayarı kabul etmedi (%s)"}\n' "$(jget "$resp" '@.errcode')"
	fi
}

# Huawei cihaz listesi -> $D/hosts.tsv: mac \t InterfaceType(2.4GHz|5GHz|LAN) \t aktif \t isim \t üretici \t ikon
hosts() {
	local r keys k mac it act act46 nm manu icon a out=$D/hosts.tsv
	[ "$(cfg enabled)" = 1 ] || return 0
	r=$(api_get system/HostInfo) || return 1
	json_init
	json_load "{\"h\":$r}" 2>/dev/null || return 1
	json_select h || return 1
	json_get_keys keys
	: >"$out.tmp"
	for k in $keys; do
		json_select "$k" || continue
		mac=""; it=""; act=""; act46=""; nm=""; manu=""; icon=""
		json_get_var mac MACAddress
		json_get_var it InterfaceType
		json_get_var act Active
		json_get_var act46 Active46
		json_get_var nm ActualName
		[ -n "$nm" ] || json_get_var nm HostName
		json_get_var manu ActualManu
		json_get_var icon IconType
		json_select ..
		[ -n "$mac" ] || continue
		a=0
		{ [ "$act46" = 1 ] || [ "$act" = 1 ]; } && a=1
		printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(echo "$mac" | tr 'A-F' 'a-f')" "$it" "$a" \
			"$(printf '%s' "$nm" | tr -d '\t\n')" "$(printf '%s' "$manu" | tr -d '\t\n')" "$icon" >>"$out.tmp"
	done
	mv "$out.tmp" "$out"
}

# ── Wi-Fi ayarları (WlanGuideBasic) ─────────────────────────────────────────
# Huawei arayüzü: GET ntwk/WlanGuideBasic?type=notshowpassall -> { DbhoEnable, WifiConfig:[2.4G, 5G] }
# Kaydet: POST ntwk/WlanGuideBasic { data:{ config2g, config5g, setGuestSsid, DbhoEnable }, action }
#   action "SsidSettings" (ad/şifre/gizleme, içerik tipi ";enp") | "SendSettings" (kanal vb. gelişmiş)
#   wpakey = RSA(şifre); değişmeyen şifre için Huawei'nin kendi arayüzü gibi "********" gönderilir.
WF="ID WifiSsid WifiSsidEnable BeaconType WpaEncryptionMode Channel WMMEnable WifiHideBroadcast X_Wlan11NBWControl WlanStandard X_Wlan11NGIControl FrequencyBand"

read_band() { # jshn dizin önek  -> ${önek}_${Alan} ve ${önek}_${Alan}_t (jshn tipi)
	local f v t
	json_select "$1" || return 1
	for f in $WF; do
		v=""; t=""
		json_get_type t "$f"
		json_get_var v "$f"
		eval "${2}_$f=\$v; ${2}_${f}_t=\$t"
	done
	json_select ..
}
wifi_load() {
	WG=$(api_get 'ntwk/WlanGuideBasic?type=notshowpassall') || return 1
	json_init
	json_load "$WG" 2>/dev/null || { echo "Huawei Wi-Fi ayarları okunamadı" >"$D/err"; return 1; }
	DBHO=""; DBHO_T=""; COMPAT=""; COMPAT_T=""
	json_get_type DBHO_T DbhoEnable && json_get_var DBHO DbhoEnable
	json_get_type COMPAT_T wifiCompatEnable && json_get_var COMPAT wifiCompatEnable
	json_select WifiConfig || { echo "Huawei Wi-Fi listesi bulunamadı" >"$D/err"; return 1; }
	read_band 1 G2 && read_band 2 G5 || { echo "Huawei Wi-Fi bantları okunamadı" >"$D/err"; return 1; }
	json_select ..
	# sıra garantisi yok: FrequencyBand 5 ile başlıyorsa yer değiştir
	case "$G2_FrequencyBand" in 5*)
		for f in $WF; do eval "x=\$G2_$f; xt=\$G2_${f}_t; G2_$f=\$G5_$f; G2_${f}_t=\$G5_${f}_t; G5_$f=\$x; G5_${f}_t=\$xt"; done ;;
	esac
}
# tipini koruyarak ekle: ad değer tip
add_typed() {
	case "$3" in
	boolean) json_add_boolean "$1" "$2" ;;
	int) json_add_int "$1" "$2" ;;
	*) json_add_string "$1" "$2" ;;
	esac
}
add_band_cfg() { # önek wpakey action is2g
	local p=$1 v t
	eval "v=\$${p}_ID"; json_add_string ID "$v"
	eval "v=\$${p}_WifiSsid"; json_add_string ssid "$v"
	eval "v=\$${p}_WifiSsidEnable; t=\$${p}_WifiSsidEnable_t"; add_typed ssidenable "$v" "$t"
	eval "v=\$${p}_BeaconType"
	if [ "$v" = None ]; then json_add_string beacontype Basic; json_add_string basicencmode None
	else json_add_string beacontype "$v"; fi
	eval "v=\$${p}_WpaEncryptionMode"; json_add_string wpaencmode "$v"
	[ "$4" = 1 ] && json_add_boolean notsetwebpassword 1
	eval "v=\$${p}_Channel; t=\$${p}_Channel_t"; add_typed channel "$v" "$t"
	eval "v=\$${p}_WMMEnable; t=\$${p}_WMMEnable_t"; add_typed wmm "$v" "$t"
	eval "v=\$${p}_WifiHideBroadcast"; [ "$v" = 1 ] && json_add_int advertisement 0 || json_add_int advertisement 1
	if [ "$3" = SendSettings ]; then
		eval "v=\$${p}_X_Wlan11NBWControl; t=\$${p}_X_Wlan11NBWControl_t"; add_typed nbw "$v" "$t"
		eval "v=\$${p}_WlanStandard; t=\$${p}_WlanStandard_t"; add_typed mode "$v" "$t"
		eval "v=\$${p}_X_Wlan11NGIControl; t=\$${p}_X_Wlan11NGIControl_t"; add_typed ngi "$v" "$t"
	fi
	json_add_string wpakey "$2"
}
wifi_post() { # action k2 k5  -> yanıt
	local body ct="application/json; charset=utf-8"
	json_init
	json_add_object data
	json_add_object config2g; add_band_cfg G2 "$2" "$1" 1; json_close_object
	json_add_object config5g; add_band_cfg G5 "$3" "$1" 0; json_close_object
	json_add_boolean setGuestSsid 0
	[ -n "$DBHO_T" ] && add_typed DbhoEnable "$DBHO" "$DBHO_T"
	[ -n "$COMPAT_T" ] && add_typed wifiCompatEnable "$COMPAT" "$COMPAT_T"
	json_close_object
	json_add_string action "$1"
	body=$(json_dump)
	[ "$1" = SsidSettings ] && ct="application/json;charset=UTF-8;enp"
	hw_post_raw ntwk/WlanGuideBasic "$body" "$ct"
}
# hw_post ile aynı ama gövde hazır: {"data":..,"action":..} içine csrf eklenir
hw_post_raw() { # yol gövde içerik-tipi
	local p t body resp
	read -r p t <"$CSRF" 2>/dev/null
	body="{\"csrf\":{\"csrf_param\":\"$p\",\"csrf_token\":\"$t\"},$(printf '%s' "$2" | sed 's/^{ *//')"
	resp=$(hw_curl -X POST -H "Content-Type: $3" --data-binary "$body" "http://$HOST/api/$1")
	save_csrf "$resp"
	printf '%s' "$resp"
}

wifi_get() {
	local c2 c5
	wifi_load || { printf '{"ok":false,"error":"%s"}\n' "$(cat "$D/err" 2>/dev/null | tr -d '"\\')"; return; }
	c2=$(jget "$(api_get 'system/diagnose_wlan_basic?type=1')" '@.Channel')
	c5=$(jget "$(api_get 'system/diagnose_wlan_basic?type=2')" '@.Channel')
	json_init
	json_add_boolean ok 1
	json_add_boolean dbho "$([ "$DBHO" = 1 ] && echo 1 || echo 0)"
	json_add_array bands
	for b in 2g 5g; do
		p=G2; [ $b = 5g ] && p=G5
		json_add_object
		json_add_string band "$b"
		eval "json_add_string ssid \"\$${p}_WifiSsid\""
		eval "json_add_boolean enabled \"\$( [ \"\$${p}_WifiSsidEnable\" = 1 ] && echo 1 || echo 0 )\""
		eval "json_add_string security \"\$${p}_BeaconType\""
		eval "json_add_string encryption \"\$${p}_WpaEncryptionMode\""
		eval "json_add_string channel \"\$${p}_Channel\""
		if [ $b = 2g ]; then json_add_string actual_channel "$c2"; else json_add_string actual_channel "$c5"; fi
		eval "json_add_boolean hidden \"\$( [ \"\$${p}_WifiHideBroadcast\" = 1 ] && echo 1 || echo 0 )\""
		eval "json_add_string standard \"\$${p}_WlanStandard\""
		eval "json_add_string bandwidth \"\$${p}_X_Wlan11NBWControl\""
		json_close_object
	done
	json_close_array
	json_dump
}

valid_channel() { # bant kanal
	case "$2" in '' | *[!0-9]*) return 1 ;; esac
	[ "$2" = 0 ] && return 0
	if [ "$1" = 2g ]; then [ "$2" -ge 1 ] && [ "$2" -le 13 ]
	else case " 36 40 44 48 52 56 60 64 100 104 108 112 116 120 124 128 132 136 140 149 153 157 161 165 " in *" $2 "*) return 0 ;; esac; return 1; fi
}

wifi_set() {
	local input band ssid pw ch hid t targets b p e ssid_changed=0 ch_changed=0 k2 k5 r ec
	input=$(cat)
	json_load "$input" 2>/dev/null || { echo '{"ok":false,"error":"Geçersiz istek"}'; return; }
	json_get_var band band
	case "$band" in 2g | 5g | both) ;; *) echo '{"ok":false,"error":"Geçersiz bant"}'; return ;; esac
	ssid=""; pw=""; ch=""; hid=""
	json_get_type t ssid && json_get_var ssid ssid
	json_get_type t password && json_get_var pw password
	json_get_type t channel && json_get_var ch channel
	json_get_type t hidden && json_get_var hid hidden
	wifi_load || { printf '{"ok":false,"error":"%s"}\n' "$(cat "$D/err" 2>/dev/null | tr -d '"\\')"; return; }
	targets=$band; [ "$band" = both ] && targets="2g 5g"
	# çift bant tek ağ (DBHO) açıkken ad/şifre iki bantta aynı olmalı
	[ "$DBHO" = 1 ] && { [ -n "$ssid" ] || [ -n "$pw" ]; } && targets="2g 5g"
	if [ -n "$ssid" ]; then
		[ "$(printf '%s' "$ssid" | wc -c)" -ge 1 ] && [ "$(printf '%s' "$ssid" | wc -c)" -le 32 ] || { echo '{"ok":false,"error":"Ağ adı 1-32 bayt olmalı"}'; return; }
		for b in $targets; do p=G2; [ $b = 5g ] && p=G5; eval "${p}_WifiSsid=\$ssid"; done
		ssid_changed=1
	fi
	if [ -n "$pw" ]; then
		[ ${#pw} -ge 8 ] && [ ${#pw} -le 63 ] || { echo '{"ok":false,"error":"Şifre 8-63 karakter olmalı"}'; return; }
		ssid_changed=1
	fi
	if [ -n "$hid" ]; then
		for b in $targets; do p=G2; [ $b = 5g ] && p=G5; eval "${p}_WifiHideBroadcast=\$hid"; done
		ssid_changed=1
	fi
	if [ -n "$ch" ]; then
		[ "$band" = both ] && { echo '{"ok":false,"error":"Kanal tek bant için seçilir"}'; return; }
		valid_channel "$band" "$ch" || { echo '{"ok":false,"error":"Bu bant için geçersiz kanal"}'; return; }
		p=G2; [ "$band" = 5g ] && p=G5
		eval "${p}_Channel=\$ch"
		ch_changed=1
	fi
	[ $ssid_changed = 1 ] || [ $ch_changed = 1 ] || { echo '{"ok":true,"changed":false}'; return; }
	rsa_pem || { echo '{"ok":false,"error":"Huawei şifreleme anahtarı alınamadı, tekrar deneyin"}'; rm -f "$JAR"; return; }
	# değişmeyen bandın şifresi "********" (Huawei eskisini korur)
	k2=$(hw_enc '********'); k5=$k2
	if [ -n "$pw" ]; then
		e=$(hw_enc "$pw") || { echo '{"ok":false,"error":"Şifre şifrelenemedi"}'; return; }
		case " $targets " in *" 2g "*) k2=$e ;; esac
		case " $targets " in *" 5g "*) k5=$e ;; esac
	fi
	if [ $ssid_changed = 1 ]; then
		r=$(wifi_post SsidSettings "$k2" "$k5"); ec=$(jget "$r" '@.errcode')
		if [ "$ec" != 0 ]; then
			case "$(jget "$r" '@.WifiSsid')" in
			*same_as_guest*) e="Bu ad misafir ağıyla aynı" ;;
			*same_as_5g*) e="2,4 ve 5 GHz adı aynı olamaz (çift bant modu kapalıyken)" ;;
			*reserved*) e="Bu ağ adı Huawei tarafından ayrılmış" ;;
			*) e="Huawei ayarı kabul etmedi (${ec:-yanıt yok})" ;;
			esac
			printf '{"ok":false,"error":"%s"}\n' "$e"; return
		fi
	fi
	if [ $ch_changed = 1 ]; then
		r=$(wifi_post SendSettings "$k2" "$k5"); ec=$(jget "$r" '@.errcode')
		[ "$ec" = 0 ] || { printf '{"ok":false,"error":"Huawei kanal ayarını kabul etmedi (%s)"}\n' "${ec:-yanıt yok}"; return; }
	fi
	echo '{"ok":true,"changed":true}'
}

# Çevredeki ağları tara (Huawei'nin tekrarlayıcı taraması); alan adları modele göre değişebildiği için esnek okunur
wifi_scan() {
	local r keys k ch sig ssid fb
	api_get ntwk/wifiscan >/dev/null 2>&1
	sleep "${NP_HW_SCAN_WAIT:-6}"
	r=$(api_get ntwk/wifiscanresult) || { printf '{"ok":false,"error":"%s"}\n' "$(cat "$D/err" 2>/dev/null | tr -d '"\\')"; return; }
	json_init
	json_load "{\"h\":$r}" 2>/dev/null || { echo '{"ok":false,"error":"Tarama sonucu okunamadı"}'; return; }
	json_select h 2>/dev/null || { echo '{"ok":true,"networks":[]}'; return; }
	json_get_keys keys
	tmp=$(mktemp)
	for k in $keys; do
		json_select "$k" 2>/dev/null || continue
		ch=""; sig=""; ssid=""; fb=""
		for f in Channel channel; do [ -n "$ch" ] || json_get_var ch "$f"; done
		for f in RSSI Rssi rssi SignalStrength Signal SignalQuality; do [ -n "$sig" ] || json_get_var sig "$f"; done
		for f in WifiSsid SSID Ssid; do [ -n "$ssid" ] || json_get_var ssid "$f"; done
		for f in FrequencyBand Band; do [ -n "$fb" ] || json_get_var fb "$f"; done
		json_select ..
		printf '%s\t%s\t%s\t%s\n' "$ch" "$sig" "$fb" "$(printf '%s' "$ssid" | tr -d '\t\n')" >>"$tmp"
	done
	json_init
	json_add_boolean ok 1
	json_add_array networks
	while IFS='	' read -r ch sig fb ssid; do
		json_add_object
		json_add_string channel "$ch"; json_add_string signal "$sig"; json_add_string band "$fb"; json_add_string ssid "$ssid"
		json_close_object
	done <"$tmp"
	json_close_array
	rm -f "$tmp"
	json_dump
}

rm -f "$D/err"
# ── Misafir Wi-Fi (Huawei'nin kendi misafir ağı: ayrı ağ, ev cihazlarını göremez) ──
#   GET  ntwk/guest_network            -> [2,4 GHz, 5 GHz] { ID, WifiSsid, EnableFrequency, SecOpt none|aes,
#                                          ValidTime 1=4 saat 2=1 gün 3=sınırsız, RestTime (sn), WpaPreSharedKey }
#   POST ntwk/guest_network (;enp)     -> { config2g, config5g: { ID, WifiSsid, ValidTime, SecOpt none|tkip,
#                                          WpaPreSharedKey (RSA), Enable } }
#   GET/POST ntwk/guest_network_limitrate -> { Enable 0|1, X_DownPeakRate (kbit/s), PeakRate (yükleme) }
#   POST ntwk/guest_network_resttime   -> süreyi 30 dk uzatır
hw_fail() { printf '{"ok":false,"error":"%s"}\n' "$(printf '%s' "${1:-$(cat "$D/err" 2>/dev/null)}" | tr -d '"\')"; }
guest_get() {
	local g r l pw=0 key on2 on5 en sec
	[ "$1" = withkey ] && pw=1
	if [ $pw = 1 ]; then g=$(api_get ntwk/guest_network); else g=$(api_get 'ntwk/guest_network?type=notshowpassall'); fi || { hw_fail; return; }
	r=$(api_get ntwk/wlanradio) || { hw_fail; return; }
	l=$(api_get ntwk/guest_network_limitrate 2>/dev/null)
	on2=$(boolv "$(jget "$g" '@[0].EnableFrequency')"); on5=$(boolv "$(jget "$g" '@[1].EnableFrequency')")
	[ "$(boolv "$(jget "$r" '@.Enable2G')")" = 1 ] || on2=0
	[ "$(boolv "$(jget "$r" '@.Enable5G')")" = 1 ] || on5=0
	en=0; [ $on2 = 1 ] || [ $on5 = 1 ] && en=1
	sec=1; [ "$(jget "$g" '@[0].SecOpt')" = none ] && sec=0
	json_init
	json_add_boolean ok 1
	json_add_boolean enabled $en
	json_add_boolean band2g $on2
	json_add_boolean band5g $on5
	json_add_string ssid "$(jget "$g" '@[0].WifiSsid')"
	json_add_boolean secure $sec
	json_add_int valid "$(jget "$g" '@[0].ValidTime' || echo 3)"
	json_add_int rest "$(jget "$g" '@[0].RestTime' | tr -cd 0-9)"
	key=$(jget "$g" '@[0].WpaPreSharedKey')
	[ $pw = 1 ] && [ $sec = 1 ] && case "$key" in '' | '********') ;; *) json_add_string password "$key" ;; esac
	json_add_boolean limit "$(boolv "$(jget "$l" '@.Enable')")"
	json_add_int limit_mbps "$(( $(jget "$l" '@.X_DownPeakRate' | tr -cd 0-9 || echo 0) / 1000 ))"
	json_dump
}
guest_cfg() { # önek ID ssid valid secopt key enable
	json_add_object "$1"
	json_add_string ID "$2"
	json_add_string WifiSsid "$3"
	json_add_int ValidTime "$4"
	json_add_string SecOpt "$5"
	json_add_string WpaPreSharedKey "$6"
	json_add_boolean Enable "$7"
	json_close_object
}
guest_set() {
	local input t en ssid pw open valid lim mbps g id2 id5 cur_sec sec key r ec e body
	input=$(cat)
	json_load "$input" 2>/dev/null || { hw_fail "Geçersiz istek"; return; }
	en=""; ssid=""; pw=""; open=""; valid=""; lim=""; mbps=""
	json_get_type t enabled && json_get_var en enabled
	json_get_type t ssid && json_get_var ssid ssid
	json_get_type t password && json_get_var pw password
	json_get_type t open && json_get_var open open
	json_get_type t valid && json_get_var valid valid
	json_get_type t limit && json_get_var lim limit
	json_get_type t limit_mbps && json_get_var mbps limit_mbps
	g=$(api_get 'ntwk/guest_network?type=notshowpassall') || { hw_fail; return; }
	id2=$(jget "$g" '@[0].ID'); id5=$(jget "$g" '@[1].ID')
	[ -n "$id2" ] && [ -n "$id5" ] || { hw_fail "Bu Huawei modelinde misafir ağı bulunamadı"; return; }
	[ -n "$ssid" ] || ssid=$(jget "$g" '@[0].WifiSsid')
	[ "$(printf '%s' "$ssid" | wc -c)" -ge 1 ] && [ "$(printf '%s' "$ssid" | wc -c)" -le 32 ] || { hw_fail "Ağ adı 1-32 bayt olmalı"; return; }
	[ -n "$valid" ] || valid=$(jget "$g" '@[0].ValidTime')
	case "$valid" in 1 | 2 | 3) ;; *) valid=3 ;; esac
	[ -n "$en" ] || en=$(boolv "$(jget "$g" '@[0].EnableFrequency')")
	cur_sec=1; [ "$(jget "$g" '@[0].SecOpt')" = none ] && cur_sec=0
	sec=$cur_sec; [ "$open" = 1 ] && sec=0; [ "$open" = 0 ] && sec=1
	if [ $sec = 1 ]; then
		if [ -n "$pw" ]; then
			[ ${#pw} -ge 8 ] && [ ${#pw} -le 63 ] || { hw_fail "Şifre 8-63 karakter olmalı"; return; }
		elif [ $cur_sec = 0 ]; then
			hw_fail "Şifreli misafir ağı için bir şifre girin"; return
		fi
	fi
	rsa_pem || { rm -f "$JAR"; hw_fail "Huawei şifreleme anahtarı alınamadı, tekrar deneyin"; return; }
	if [ $sec = 1 ] && [ -n "$pw" ]; then key=$(hw_enc "$pw"); else key=$(hw_enc '********'); fi
	[ -n "$key" ] || { hw_fail "Şifre şifrelenemedi"; return; }
	secopt=none; [ $sec = 1 ] && secopt=tkip
	json_init
	json_add_object data
	guest_cfg config2g "$id2" "$ssid" "$valid" "$secopt" "$key" "$en"
	guest_cfg config5g "$id5" "$ssid" "$valid" "$secopt" "$key" "$en"
	json_close_object
	body=$(json_dump)
	r=$(hw_post_raw ntwk/guest_network "$body" "application/json;charset=UTF-8;enp"); ec=$(jget "$r" '@.errcode')
	if [ "$ec" != 0 ]; then
		e="Huawei misafir ayarını kabul etmedi (${ec:-yanıt yok})"
		case "$(jget "$r" '@.WpaPreSharedKey')" in *same*) e="Misafir şifresi ev ağının şifresiyle aynı olamaz" ;; esac
		case "$(jget "$r" '@.WifiSsid')$(jget "$r" '@.ssid')" in *same*) e="Misafir ağının adı ev ağıyla aynı olamaz" ;; ?*) e="Bu ağ adı kullanılamıyor" ;; esac
		[ "$(jget "$r" '@.parameter')" = parameter.err ] && e="Huawei değerleri kabul etmedi (şifre biçimi?)"
		hw_fail "$e"; return
	fi
	if [ -n "$lim" ]; then
		case "$mbps" in '' | *[!0-9]*) mbps=0 ;; esac
		[ "$lim" = 1 ] && { [ "$mbps" -ge 1 ] && [ "$mbps" -le 1000 ] || { hw_fail "Hız sınırı 1-1000 Mbit/s olmalı (misafir ağı kaydedildi)"; return; }; }
		[ "$mbps" -ge 1 ] || mbps=$(( $(jget "$(api_get ntwk/guest_network_limitrate)" '@.X_DownPeakRate' | tr -cd 0-9 || echo 0) / 1000 ))
		[ "$mbps" -ge 1 ] || mbps=10
		r=$(hw_post ntwk/guest_network_limitrate "{\"Enable\":$lim,\"PeakRate\":$((mbps * 100)),\"X_DownPeakRate\":$((mbps * 1000))}")
		[ "$(jget "$r" '@.errcode')" = 0 ] || { hw_fail "Misafir ağı kaydedildi ama hız sınırı uygulanamadı"; return; }
	fi
	echo '{"ok":true}'
}
guest_extend() {
	local r
	r=$(hw_post ntwk/guest_network_resttime '{}')
	[ "$(jget "$r" '@.errcode')" = 0 ] && echo '{"ok":true}' || hw_fail "Süre uzatılamadı"
}

case "$1" in
status) status ;;
hosts) hosts ;;
set) set_radio "$2" "$3" ;;
wifi_get) wifi_get ;;
wifi_set) wifi_set ;;
wifi_scan) wifi_scan ;;
guest_get) guest_get "$2" ;;
guest_set) guest_set ;;
guest_extend) guest_extend ;;
proof) client_proof "$2" "$3" "$4" "$5" "$6"; echo ;;
reset) rm -f "$FAIL" "$JAR" "$CSRF" ;;
*) echo "kullanım: $0 status | set <2g|5g> <0|1>" >&2; exit 1 ;;
esac
