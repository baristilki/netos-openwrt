#!/bin/sh
# NetOS — yerel HTTPS: kendi sertifika otoritesi (CA) + panel sertifikası
#
#   sslctl.sh status   -> JSON: { ca, ca_expires, cert, cert_expires, names[], trusted_by_netos, https_redirect }
#   sslctl.sh setup    -> CA yoksa oluşturur, sunucu sertifikasını (yeniden) üretip uhttpd'ye kurar
#   sslctl.sh renew    -> sertifikanın bitmesine 30 günden az kaldıysa ya da router IP'si değiştiyse yeniler (cron)
#
# Güvenlik: CA "name constraints" ile yalnız yerel adlara (192.168/16, 10/8, 172.16/12, .lan, OpenWrt) sertifika
# verebilir; anahtarı çalınsa bile google.com gibi bir site için sahte sertifika üretilemez.
# CA anahtarı yalnız root'a okunur (/etc/netpanel/ca, 700). CA sertifikası (genel) /www/netos-ca.crt'de
# indirilmek üzere durur: cihazlara bir kez "güvenilir kök sertifika" olarak yüklenir.
# Test: NP_SSL_DIR, NP_SSL_WWW, NP_SSL_CRT, NP_SSL_KEY, NP_DRYRUN

DIR=${NP_SSL_DIR:-/etc/netpanel/ca}
WWW=${NP_SSL_WWW:-/www/netos-ca.crt}
CRT=${NP_SSL_CRT:-/etc/uhttpd.crt}
KEY=${NP_SSL_KEY:-/etc/uhttpd.key}

err() { printf '{"ok":false,"error":"%s"}\n' "$1"; exit 0; }
command -v openssl >/dev/null || err "openssl-util paketi gerekli"

lan_ip() { uci -q get network.lan.ipaddr | cut -d/ -f1; }
host() { uci -q get system.@system[0].hostname || echo OpenWrt; }
exp_epoch() { # sertifika bitiş zamanı (epoch)
	local d
	d=$(openssl x509 -in "$1" -noout -enddate 2>/dev/null | cut -d= -f2) || return 1
	date -d "$(echo "$d" | awk '{print $1" "$2" "$4" "$3}')" +%s 2>/dev/null ||
		awk -v d="$d" 'BEGIN { split("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec", m, " "); split(d, a, " ");
			for (i = 1; i <= 12; i++) if (m[i] == a[1]) mo = i; split(a[3], t, ":");
			print mktime(a[4] " " mo " " a[2] " " t[1] " " t[2] " " t[3]) }'
}

make_ca() {
	umask 077
	mkdir -p "$DIR"
	cat >"$DIR/ca.cnf" <<-EOF
	[req]
	distinguished_name = dn
	x509_extensions = v3_ca
	prompt = no
	[dn]
	O = NetOS
	CN = NetOS yerel ag sertifika otoritesi ($(host))
	[v3_ca]
	basicConstraints = critical, CA:true, pathlen:0
	keyUsage = critical, keyCertSign, cRLSign
	subjectKeyIdentifier = hash
	nameConstraints = critical, permitted;IP:192.168.0.0/255.255.0.0, permitted;IP:10.0.0.0/255.0.0.0, permitted;IP:172.16.0.0/255.240.0.0, permitted;DNS:.lan, permitted;DNS:lan, permitted;DNS:$(host), permitted;DNS:openwrt, permitted;DNS:.home.arpa
	EOF
	openssl ecparam -name prime256v1 -genkey -noout -out "$DIR/ca.key" 2>/dev/null &&
		openssl req -x509 -new -key "$DIR/ca.key" -sha256 -days 3650 -config "$DIR/ca.cnf" -out "$DIR/ca.crt" 2>/dev/null ||
		err "CA oluşturulamadı"
	chmod 600 "$DIR/ca.key"
	logger -t netos "yerel sertifika otoritesi oluşturuldu"
}

make_cert() {
	local ip h n
	ip=$(lan_ip); h=$(host)
	[ -n "$ip" ] || err "Router IP adresi bulunamadı"
	umask 077
	cat >"$DIR/srv.cnf" <<-EOF
	[req]
	distinguished_name = dn
	prompt = no
	[dn]
	O = NetOS
	CN = $ip
	[ext]
	basicConstraints = critical, CA:false
	keyUsage = critical, digitalSignature, keyEncipherment
	extendedKeyUsage = serverAuth
	subjectAltName = IP:$ip, DNS:$h, DNS:$h.lan, DNS:openwrt.lan, DNS:router.lan
	authorityKeyIdentifier = keyid
	EOF
	n=$DIR/srv.new
	openssl ecparam -name prime256v1 -genkey -noout -out "$n.key" 2>/dev/null &&
		openssl req -new -key "$n.key" -config "$DIR/srv.cnf" -out "$n.csr" 2>/dev/null &&
		openssl x509 -req -in "$n.csr" -CA "$DIR/ca.crt" -CAkey "$DIR/ca.key" -CAcreateserial -sha256 -days 397 \
			-extfile "$DIR/srv.cnf" -extensions ext -out "$n.crt" 2>/dev/null ||
		err "Sertifika üretilemedi"
	openssl verify -CAfile "$DIR/ca.crt" "$n.crt" >/dev/null 2>&1 || err "Sertifika doğrulanamadı"
	# uhttpd PEM okur; eski dosyaları bir kez yedekle
	[ -f "$CRT.netos-orig" ] || { [ -f "$CRT" ] && cp "$CRT" "$CRT.netos-orig"; }
	[ -f "$KEY.netos-orig" ] || { [ -f "$KEY" ] && cp "$KEY" "$KEY.netos-orig"; }
	# Yalnız sunucu sertifikası: uhttpd'nin mbedtls'i "name constraints" içeren CA'yı zincirde okuyamıyor
	# (CA zaten cihazlara ayrıca yükleniyor, zincire gerek yok).
	cp "$CRT" "$DIR/prev.crt" 2>/dev/null; cp "$KEY" "$DIR/prev.key" 2>/dev/null
	cp "$n.crt" "$CRT"; cp "$n.key" "$KEY"; chmod 600 "$KEY"; chmod 644 "$CRT"
	echo "$ip" >"$DIR/srv.ip"
	rm -f "$n.key" "$n.csr" "$n.crt"
	umask 022
	cp "$DIR/ca.crt" "$WWW"; chmod 644 "$WWW"
	if [ -z "$NP_DRYRUN" ]; then
		/etc/init.d/uhttpd restart >/dev/null 2>&1
		sleep 3
		# web sunucusu yeni sertifikayla açılmazsa eskisine dön (panel/LuCI erişimi kesilmesin)
		if ! /etc/init.d/uhttpd running >/dev/null 2>&1; then
			cp "$DIR/prev.crt" "$CRT"; cp "$DIR/prev.key" "$KEY"
			/etc/init.d/uhttpd restart >/dev/null 2>&1
			logger -t netos "yeni HTTPS sertifikası yüklenemedi, eskisine dönüldü"
			err "Web sunucusu yeni sertifikayı kabul etmedi; eski sertifikaya dönüldü"
		fi
	fi
	logger -t netos "panel HTTPS sertifikası yenilendi ($ip)"
}

status() {
	local ce se
	ce=$(exp_epoch "$DIR/ca.crt"); se=$(exp_epoch "$CRT")
	printf '{"ok":true,"ca":%s,"ca_expires":%s,"cert_by_netos":%s,"cert_expires":%s,"ip":"%s","names":"%s","https_redirect":%s,"ca_url":"/netos-ca.crt"}\n' \
		"$([ -f "$DIR/ca.crt" ] && echo true || echo false)" "${ce:-0}" \
		"$([ -f "$DIR/ca.crt" ] && openssl verify -CAfile "$DIR/ca.crt" "$CRT" >/dev/null 2>&1 && echo true || echo false)" \
		"${se:-0}" "$(lan_ip)" \
		"$(openssl x509 -in "$CRT" -noout -ext subjectAltName 2>/dev/null | tail -n +2 | tr -d ' ' | tr ',' ' ')" \
		"$([ "$(uci -q get uhttpd.main.redirect_https)" = 1 ] && echo true || echo false)"
}

case "$1" in
setup)
	[ -f "$DIR/ca.key" ] && [ -f "$DIR/ca.crt" ] || make_ca
	make_cert
	status
	;;
renew)
	[ -f "$DIR/ca.key" ] || exit 0          # kurulmamışsa dokunma
	now=$(date +%s); se=$(exp_epoch "$CRT")
	if [ "$(cat "$DIR/srv.ip" 2>/dev/null)" != "$(lan_ip)" ] || [ -z "$se" ] || [ $((se - now)) -lt 2592000 ] ||
		! openssl verify -CAfile "$DIR/ca.crt" "$CRT" >/dev/null 2>&1; then
		make_cert >/dev/null
	fi
	;;
status) status ;;
*) echo "kullanım: $0 status|setup|renew" >&2; exit 1 ;;
esac
