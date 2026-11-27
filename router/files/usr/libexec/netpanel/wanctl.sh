#!/bin/sh
# NetOS internet (WAN) yönetimi
#   wanctl.sh config              -> JSON: WAN ayarları + multiwan modu + bekleyen geri alma
#   wanctl.sh set      < json     -> {name, proto, username, password, vlan, dns, mtu, ipaddr, netmask, gateway, enabled}
#   wanctl.sh mode     < json     -> {mode: balanced|failover|single, primary, weights:{wan:ağırlık}}
#   wanctl.sh confirm             -> bekleyen değişikliği onayla (geri alma iptal)
#   wanctl.sh revert              -> yedeğe dön
#   wanctl.sh reconnect < json    -> {name}  hattı yeniden bağla
#   wanctl.sh events              -> JSON: hat olay geçmişi (en yeni önce)
#   wanctl.sh ports               -> JSON: fiziksel portlar (bağlantı hızı, rol, sayaçlar)
#   wanctl.sh add      < json     -> ikinci hat ekle {device, proto, username, password, vlan, mode, primary}
#
# Değişiklikler "geri alma korumalı": network + mwan3 yedeklenir, ROLLBACK_SEC içinde confirm
# gelmezse otomatik eski hale dönülür (LuCI'deki apply/rollback mantığı).

. "${NP_COMMON:-/usr/share/netpanel/common.sh}"

RB=${NP_RB_DIR:-/tmp/netpanel-rollback}
ROLLBACK_SEC=${NP_ROLLBACK_SEC:-120}
EVLOG=${NP_EVLOG:-/etc/netpanel/events.log}
SELF=${NP_SELF:-/usr/libexec/netpanel/wanctl.sh}
CONF=${NP_CONF:-/etc/config}
# NP_DRYRUN=1: servisleri yeniden başlatma (test)
svc() { [ -n "$NP_DRYRUN" ] && { echo "DRYRUN: $*" >&2; return 0; }; "$@" >/dev/null 2>&1; }

err() {
	uci -q revert network; uci -q revert mwan3; uci -q revert firewall
	printf '{"ok":false,"error":"%s"}\n' "$1"
	exit 0
}
log_event() { mkdir -p "${EVLOG%/*}"; printf '%s\t%s\t%s\n' "$(date +%s)" "$1" "$2" >>"$EVLOG"; }
is_wan() { np_wan_nets | grep -qx "$1"; }

# ── geri alma ───────────────────────────────────────────────────────────────
rb_begin() {
	if [ ! -d "$RB" ]; then
		mkdir -p "$RB"
		cp "$CONF/network" "$RB/network"
		[ -f "$CONF/mwan3" ] && cp "$CONF/mwan3" "$RB/mwan3"
		cp "$CONF/firewall" "$RB/firewall"
	fi
	echo $(($(date +%s) + ROLLBACK_SEC)) >"$RB/until"
	if [ ! -f "$RB/pid" ] || ! kill -0 "$(cat "$RB/pid")" 2>/dev/null; then
		(
			while sleep 5; do
				[ -f "$RB/until" ] || exit 0
				[ "$(date +%s)" -ge "$(cat "$RB/until")" ] && exec $SELF revert
			done
		) >/dev/null 2>&1 </dev/null &
		echo $! >"$RB/pid"
	fi
}

revert() {
	[ -d "$RB" ] || { echo '{"ok":true}'; return; }
	cp "$RB/network" "$CONF/network"
	[ -f "$RB/mwan3" ] && cp "$RB/mwan3" "$CONF/mwan3"
	[ -f "$RB/firewall" ] && cp "$RB/firewall" "$CONF/firewall" && svc /etc/init.d/firewall reload
	rm -rf "$RB"
	svc /etc/init.d/network reload
	svc /etc/init.d/mwan3 restart
	log_event "*" "reverted"
	echo '{"ok":true}'
}

confirm() {
	[ -f "$RB/pid" ] && kill "$(cat "$RB/pid")" 2>/dev/null
	rm -rf "$RB"
	echo '{"ok":true}'
}

# ── okuma ───────────────────────────────────────────────────────────────────
dev_section() { # cihaz adı -> network device bölümü
	uci -q show network | sed -n "s/^network\.\([^.]*\)\.name='$1'$/\1/p" | head -1
}

# varsayılan IPv4 kuralının kullandığı politika
active_policy() {
	local p
	p=$(uci -q get mwan3.default_rule_v4.use_policy)
	[ -n "$p" ] || p=$(uci -q show mwan3 | sed -n "s/^mwan3\.\([^.]*\)\.use_policy='\(.*\)'$/\2/p" | tail -1)
	echo "$p"
}

config() {
	local n proto dev sec vlan base mtu dis pol m mi mm mw cnt=0 mins=999 maxs=0 primary="" mode=custom
	json_init
	pol=$(active_policy)
	json_add_string policy "$pol"

	# politika üyeleri: arayüz metric ağırlık
	json_add_array members
	for m in $(uci -q get "mwan3.$pol.use_member"); do
		mi=$(uci -q get "mwan3.$m.interface"); mm=$(uci -q get "mwan3.$m.metric"); mw=$(uci -q get "mwan3.$m.weight")
		[ -n "$mi" ] || continue
		json_add_object
		json_add_string iface "$mi"; json_add_int metric "${mm:-1}"; json_add_int weight "${mw:-1}"
		json_close_object
		cnt=$((cnt + 1))
		[ "${mm:-1}" -lt "$mins" ] && { mins=${mm:-1}; primary=$mi; }
		[ "${mm:-1}" -gt "$maxs" ] && maxs=${mm:-1}
	done
	json_close_array
	if [ "$cnt" = 1 ]; then mode=single
	elif [ "$cnt" -gt 1 ] && [ "$mins" = "$maxs" ]; then mode=balanced
	elif [ "$cnt" -gt 1 ]; then mode=failover
	fi
	json_add_string mode "$mode"
	json_add_string primary "$primary"
	json_add_boolean mwan3 "$([ -f "$CONF/mwan3" ] && echo 1 || echo 0)"

	if [ -f "$RB/until" ]; then
		json_add_int pending_until "$(cat "$RB/until")"
	fi
	json_add_int now "$(date +%s)"

	json_add_array wans
	for n in $(np_wan_nets); do
		proto=$(uci -q get "network.$n.proto")
		dev=$(uci -q get "network.$n.device")
		sec=$(dev_section "$dev")
		vlan=0; base=$dev
		if [ -n "$sec" ] && [ "$(uci -q get "network.$sec.type")" = 8021q ]; then
			vlan=$(uci -q get "network.$sec.vid"); base=$(uci -q get "network.$sec.ifname")
		fi
		mtu=$(uci -q get "network.$n.mtu")
		[ -n "$mtu" ] || { [ -n "$sec" ] && mtu=$(uci -q get "network.$sec.mtu"); }
		dis=$(uci -q get "network.$n.disabled")
		json_add_object
		json_add_string name "$n"
		json_add_string proto "$proto"
		json_add_boolean enabled "$([ "$dis" = 1 ] && echo 0 || echo 1)"
		json_add_string device "$dev"
		json_add_string base_device "$base"
		json_add_int vlan "${vlan:-0}"
		json_add_int mtu "${mtu:-0}"
		json_add_int metric "$(uci -q get "network.$n.metric" || echo 0)"
		json_add_string username "$(uci -q get "network.$n.username")"
		json_add_boolean password_set "$([ -n "$(uci -q get "network.$n.password")" ] && echo 1 || echo 0)"
		json_add_string ipaddr "$(uci -q get "network.$n.ipaddr")"
		json_add_string netmask "$(uci -q get "network.$n.netmask")"
		json_add_string gateway "$(uci -q get "network.$n.gateway")"
		json_add_boolean peerdns "$([ "$(uci -q get "network.$n.peerdns")" = 0 ] && echo 0 || echo 1)"
		json_add_array dns
		for v in $(uci -q get "network.$n.dns"); do json_add_string "" "$v"; done
		json_close_array
		json_add_boolean mwan "$([ "$(uci -q get "mwan3.$n")" = interface ] && echo 1 || echo 0)"
		json_close_object
	done
	json_close_array
	json_dump
}

# ── yazma ───────────────────────────────────────────────────────────────────
set_wan() {
	local input n proto t v base dev sec vlan newdev ip nm gw
	input=$(cat)
	json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var n name
	is_wan "$n" || err "Bilinmeyen internet bağlantısı"

	proto=$(uci -q get "network.$n.proto")
	if json_get_type t proto; then
		json_get_var proto proto
		case "$proto" in pppoe | dhcp | static) uci set "network.$n.proto=$proto" ;; *) err "Desteklenmeyen bağlantı tipi" ;; esac
	fi

	if [ "$proto" = pppoe ]; then
		if json_get_type t username; then
			json_get_var v username
			v=$(printf '%s' "$v" | tr -d '\000-\037')
			[ -n "$v" ] || err "PPPoE kullanıcı adı boş olamaz"
			uci set "network.$n.username=$v"
		fi
		if json_get_type t password; then
			json_get_var v password
			v=$(printf '%s' "$v" | tr -d '\000-\037')
			[ -n "$v" ] && uci set "network.$n.password=$v"
		fi
		[ -n "$(uci -q get "network.$n.username")" ] || err "PPPoE kullanıcı adı gerekli"
	else
		uci -q delete "network.$n.username"; uci -q delete "network.$n.password"
	fi

	if [ "$proto" = static ]; then
		json_get_var ip ipaddr; json_get_var nm netmask; json_get_var gw gateway
		[ -n "$ip" ] || ip=$(uci -q get "network.$n.ipaddr")
		[ -n "$nm" ] || nm=$(uci -q get "network.$n.netmask")
		[ -n "$gw" ] || gw=$(uci -q get "network.$n.gateway")
		np_valid_ip "$ip" || err "Geçersiz IP adresi"
		np_valid_ip "$nm" || err "Geçersiz alt ağ maskesi"
		np_valid_ip "$gw" || err "Geçersiz ağ geçidi"
		uci set "network.$n.ipaddr=$ip"; uci set "network.$n.netmask=$nm"; uci set "network.$n.gateway=$gw"
	else
		uci -q delete "network.$n.ipaddr"; uci -q delete "network.$n.netmask"; uci -q delete "network.$n.gateway"
	fi

	if json_get_type t vlan; then
		json_get_var vlan vlan
		case "$vlan" in '' | *[!0-9]*) err "VLAN sayı olmalı" ;; esac
		[ "$vlan" -le 4094 ] || err "VLAN 0-4094 arası olmalı"
		dev=$(uci -q get "network.$n.device")
		sec=$(dev_section "$dev"); base=$dev
		[ -n "$sec" ] && [ "$(uci -q get "network.$sec.type")" = 8021q ] && base=$(uci -q get "network.$sec.ifname")
		if [ "$vlan" -gt 0 ]; then
			newdev="$base.$vlan"
			if [ -z "$(dev_section "$newdev")" ]; then
				sec=$(uci add network device)
				uci set "network.$sec.type=8021q"; uci set "network.$sec.ifname=$base"
				uci set "network.$sec.vid=$vlan"; uci set "network.$sec.name=$newdev"
			fi
			uci set "network.$n.device=$newdev"
		else
			uci set "network.$n.device=$base"
		fi
	fi

	if json_get_type t dns; then
		json_get_var v dns
		uci -q delete "network.$n.dns"
		if [ -n "$v" ]; then
			for ip in $(echo "$v" | tr ',' ' '); do np_valid_ip "$ip" || err "Geçersiz DNS: $ip"; uci add_list "network.$n.dns=$ip"; done
			uci set "network.$n.peerdns=0"
		else
			uci -q delete "network.$n.peerdns"
		fi
	fi

	if json_get_type t mtu; then
		json_get_var v mtu
		case "$v" in '' | *[!0-9]*) err "MTU sayı olmalı" ;; esac
		if [ "$v" = 0 ]; then uci -q delete "network.$n.mtu"
		else [ "$v" -ge 576 ] && [ "$v" -le 9000 ] || err "MTU 576-9000 arası olmalı"; uci set "network.$n.mtu=$v"; fi
	fi

	if json_get_type t enabled; then
		json_get_var v enabled
		if [ "$v" = 1 ]; then uci -q delete "network.$n.disabled"; else uci set "network.$n.disabled=1"; fi
	fi

	[ -n "$(uci -q changes network)" ] || { echo '{"ok":true,"changed":false}'; return; }
	rb_begin
	uci commit network
	svc /etc/init.d/network reload
	svc ifup "$n"
	log_event "$n" "configured"
	printf '{"ok":true,"changed":true,"pending_until":%s}\n' "$(cat "$RB/until")"
}

set_mode() {
	local input mode primary n w members="" metric old r
	input=$(cat)
	json_load "$input" 2>/dev/null || err "Geçersiz istek"
	[ -f "$CONF/mwan3" ] || err "mwan3 kurulu değil"
	json_get_var mode mode
	json_get_var primary primary
	case "$mode" in balanced | failover | single) ;; *) err "Geçersiz mod" ;; esac
	is_wan "$primary" || err "Ana hat seçilmeli"
	[ "$(uci -q get "mwan3.$primary")" = interface ] || err "Bu hat mwan3'te tanımlı değil"

	# ana hat önce, sonra diğer mwan3 arayüzleri
	for n in "$primary" $(np_wan_nets | grep -vx "$primary"); do
		[ "$(uci -q get "mwan3.$n")" = interface ] || continue
		[ "$mode" = single ] && [ "$n" != "$primary" ] && continue
		w=1
		if json_select weights 2>/dev/null; then
			json_get_var w "$n"; json_select ..
			case "$w" in '' | *[!0-9]*) w=1 ;; esac
			[ "$w" -ge 1 ] && [ "$w" -le 100 ] || w=1
		fi
		metric=1
		[ "$mode" = failover ] && [ "$n" != "$primary" ] && metric=2
		uci set "mwan3.netos_$n=member"
		uci set "mwan3.netos_$n.interface=$n"
		uci set "mwan3.netos_$n.metric=$metric"
		uci set "mwan3.netos_$n.weight=$w"
		members="$members netos_$n"
	done
	uci -q delete mwan3.netos
	uci set mwan3.netos=policy
	for n in $members; do uci add_list "mwan3.netos.use_member=$n"; done
	uci set mwan3.netos.last_resort=unreachable

	# eski varsayılan politikayı kullanan tüm kuralları NetOS politikasına çevir
	old=$(active_policy)
	for r in $(uci -q show mwan3 | sed -n "s/^mwan3\.\([^.]*\)=rule$/\1/p"); do
		[ "$(uci -q get "mwan3.$r.use_policy")" = "$old" ] && uci set "mwan3.$r.use_policy=netos"
	done
	[ "$(uci -q get mwan3.default_rule_v4)" = rule ] && uci set mwan3.default_rule_v4.use_policy=netos

	rb_begin
	uci commit mwan3
	svc /etc/init.d/mwan3 restart
	rpf
	log_event "*" "mode:$mode:$primary"
	printf '{"ok":true,"pending_until":%s}\n' "$(cat "$RB/until")"
}

reconnect() {
	local input n
	input=$(cat)
	json_load "$input" 2>/dev/null || err "Geçersiz istek"
	json_get_var n name
	is_wan "$n" || err "Bilinmeyen internet bağlantısı"
	log_event "$n" "reconnect"
	[ -n "$NP_DRYRUN" ] || (ifup "$n" >/dev/null 2>&1 </dev/null &)
	echo '{"ok":true}'
}

events() {
	local tmp ts ifc ev
	tmp=$(mktemp)
	# en yeni önce (tac yerine sed)
	[ -f "$EVLOG" ] && tail -n 100 "$EVLOG" | sed '1!G;h;$!d' >"$tmp"
	json_init
	json_add_array events
	while IFS='	' read -r ts ifc ev; do
		[ -n "$ts" ] || continue
		json_add_object
		json_add_int t "$ts"; json_add_string iface "$ifc"; json_add_string event "$ev"
		json_close_object
	done <"$tmp"
	json_close_array
	rm -f "$tmp"
	json_dump
}


# ── fiziksel portlar ────────────────────────────────────────────────────────
SYSNET=${NP_SYSNET:-/sys/class/net}
rd() { cat "$1" 2>/dev/null | head -1; }
# portu kullanan ağ arayüzleri (doğrudan ya da VLAN/PPPoE üzerinden)
port_nets() {
	local p=$1 n d sec base
	for n in $(uci -q show network | sed -n "s/^network\.\([^.]*\)=interface$/\1/p"); do
		[ "$n" = loopback ] && continue
		d=$(uci -q get "network.$n.device"); [ -n "$d" ] || continue
		base=$d
		sec=$(dev_section "$d")
		[ -n "$sec" ] && [ "$(uci -q get "network.$sec.type")" = 8021q ] && base=$(uci -q get "network.$sec.ifname")
		[ "$base" = "$p" ] && echo "$n"
	done
}
port_bridge() {
	local p=$1 s
	[ -L "$SYSNET/$p/master" ] && { basename "$(readlink "$SYSNET/$p/master")"; return; }
	for s in $(uci -q show network | sed -n "s/^network\.\([^.]*\)\.type='bridge'$/\1/p"); do
		uci -q get "network.$s.ports" | tr ' ' '\n' | grep -qx "$p" && { uci -q get "network.$s.name"; return; }
	done
}
max_mode() { # ethtool desteklenen en yüksek hız (Mbit)
	command -v ethtool >/dev/null || return 0
	ethtool "$1" 2>/dev/null | sed -n '/Supported link modes:/,/Supported pause/p' | grep -oE '[0-9]+base' | tr -d 'base' | sort -n | tail -1
}
ports() {
	local i p drv sp dup car wan n role nets mx fl
	wan=$(np_wan_nets)
	json_init
	json_add_array ports
	for i in "$SYSNET"/*; do
		p=${i##*/}
		[ -e "$i/device" ] || continue
		[ -d "$i/wireless" ] || [ -e "$i/phy80211" ] && continue
		[ -d "$i/dsa" ] && continue # DSA ana bağlantısı (switch'in CPU portu)
		drv=$(basename "$(readlink "$i/device/driver" 2>/dev/null)")
		sp=$(rd "$i/speed"); case "$sp" in '' | -* | *[!0-9]*) sp=0 ;; esac
		dup=$(rd "$i/duplex"); car=$(rd "$i/carrier")
		nets=$(port_nets "$p")
		role=free
		for n in $nets; do echo "$wan" | grep -qx "$n" && role=wan; done
		[ "$role" = free ] && [ -n "$(port_bridge "$p")" ] && role=lan
		[ "$role" = free ] && [ -n "$nets" ] && role=other
		json_add_object
		json_add_string name "$p"
		json_add_string label "$(rd "$i/phys_port_name")"
		json_add_string mac "$(rd "$i/address")"
		json_add_string driver "$drv"
		json_add_boolean virtual "$(case "$drv" in virtio* | vmxnet* | hv_netvsc | xen*) echo 1 ;; *) echo 0 ;; esac)"
		json_add_boolean link "$([ "$car" = 1 ] && echo 1 || echo 0)"
		json_add_int speed "$sp"
		mx=$(max_mode "$p"); fl=$(rd "$i/carrier_down_count")
		json_add_int max_speed "${mx:-0}"
		json_add_string duplex "$dup"
		json_add_int flaps "${fl:-0}"
		json_add_string role "$role"
		json_add_string bridge "$(port_bridge "$p")"
		json_add_array nets
		for n in $nets; do json_add_string "" "$n"; done
		json_close_array
		json_add_string rx "$(rd "$i/statistics/rx_bytes")"
		json_add_string tx "$(rd "$i/statistics/tx_bytes")"
		json_close_object
	done
	json_close_array
	json_add_int t "$(date +%s)"
	json_dump
}

# ── ikinci hat ekleme ───────────────────────────────────────────────────────
# < {device, proto: dhcp|pppoe, username, password, vlan, mode: failover|balanced, primary}
mwan_iface() { # mwan3'te yoksa izlemeli arayüz ekle
	[ "$(uci -q get "mwan3.$1")" = interface ] && return
	uci set "mwan3.$1=interface"
	uci set "mwan3.$1.enabled=1"
	uci set "mwan3.$1.family=ipv4"
	uci add_list "mwan3.$1.track_ip=1.1.1.1"
	uci add_list "mwan3.$1.track_ip=8.8.8.8"
	uci set "mwan3.$1.reliability=1"
}
add_wan() {
	local input dev proto user pass vlan mode primary n i z m metric d
	input=$(cat)
	json_load "$input" 2>/dev/null || err "Geçersiz istek"
	[ -f "$CONF/mwan3" ] || err "Önce mwan3 paketini kurun"
	json_get_var dev device; json_get_var proto proto; json_get_var vlan vlan
	json_get_var mode mode; json_get_var primary primary
	case "$dev" in '' | *[!A-Za-z0-9_.-]*) err "Port seçilmeli" ;; esac
	[ -e "$SYSNET/$dev/device" ] || err "Port bulunamadı"
	[ -z "$(port_nets "$dev")" ] && [ -z "$(port_bridge "$dev")" ] || err "Bu port kullanımda; boş bir port seçin"
	case "$proto" in dhcp | pppoe) ;; *) err "Bağlantı tipi DHCP ya da PPPoE olmalı" ;; esac
	case "$mode" in failover | balanced) ;; *) mode=failover ;; esac
	case "${vlan:-0}" in *[!0-9]*) err "VLAN sayı olmalı" ;; esac
	[ "${vlan:-0}" -le 4094 ] || err "VLAN 0-4094 arası olmalı"

	i=2; while [ -n "$(uci -q get "network.wan$i")" ]; do i=$((i + 1)); done
	n="wan$i"
	d=$dev
	if [ "${vlan:-0}" -gt 0 ]; then
		d="$dev.$vlan"
		if [ -z "$(dev_section "$d")" ]; then
			m=$(uci add network device)
			uci set "network.$m.type=8021q"; uci set "network.$m.ifname=$dev"
			uci set "network.$m.vid=$vlan"; uci set "network.$m.name=$d"
		fi
	fi
	uci set "network.$n=interface"
	uci set "network.$n.proto=$proto"
	uci set "network.$n.device=$d"
	if [ "$proto" = pppoe ]; then
		json_get_var user username; json_get_var pass password
		user=$(printf '%s' "$user" | tr -d '\000-\037'); pass=$(printf '%s' "$pass" | tr -d '\000-\037')
		[ -n "$user" ] && [ -n "$pass" ] || err "PPPoE kullanıcı adı ve şifresi gerekli"
		uci set "network.$n.username=$user"; uci set "network.$n.password=$pass"
	fi
	# mwan3 her hat için farklı metric ister
	metric=10
	for m in $(np_wan_nets); do
		z=$(uci -q get "network.$m.metric"); [ -n "$z" ] && [ "$z" -ge "$metric" ] && metric=$((z + 10))
	done
	uci set "network.$n.metric=$metric"

	z=$(uci -q show firewall | sed -n "s/^firewall\.\(@zone\[[0-9]*\]\)\.name='wan'$/\1/p" | head -1)
	[ -n "$z" ] || err "Güvenlik duvarında wan bölgesi yok"
	uci add_list "firewall.$z.network=$n"

	for m in $(np_wan_nets) $n; do mwan_iface "$m"; done
	[ -n "$primary" ] && is_wan "$primary" || primary=$(np_wan_nets | head -1)

	rb_begin
	uci commit network; uci commit firewall; uci commit mwan3
	svc /etc/init.d/network reload
	svc /etc/init.d/firewall reload
	rpf
	log_event "$n" "added:$dev"
	printf '{"mode":"%s","primary":"%s"}' "$mode" "$primary" | NP_NO_RB_MSG=1 set_mode >/dev/null
	printf '{"ok":true,"name":"%s","pending_until":%s}\n' "$n" "$(cat "$RB/until")"
}


# ── çoklu hat: ters yol filtresi ────────────────────────────────────────────
# rp_filter=1 (sıkı) iken ikinci hattan gelen yanıtlar atılır; mwan3 hattı yoklayamaz ve
# hat internetli olduğu halde "çevrimdışı" görünür. Birden fazla WAN varsa gevşek (2) yapılır.
RPF_CONF=${NP_RPF_CONF:-/etc/sysctl.d/90-netos-multiwan.conf}
RPF_PROC=${NP_RPF_PROC:-/proc/sys/net/ipv4/conf/all/rp_filter}
rpf() {
	[ "$(np_wan_nets | grep -c .)" -gt 1 ] || return 0
	[ -f "$RPF_CONF" ] || printf '%s\n' "# NetOS: çoklu internet hattı (mwan3) için gevşek ters yol filtresi" "net.ipv4.conf.all.rp_filter=2" >"$RPF_CONF"
	[ "$(cat "$RPF_PROC" 2>/dev/null)" = 1 ] || return 0
	echo 2 >"$RPF_PROC" && logger -t netos "rp_filter gevşek moda alındı (çoklu hat)"
}

case "$1" in
config) config ;;
set) set_wan ;;
mode) set_mode ;;
confirm) confirm ;;
revert) revert ;;
reconnect) reconnect ;;
events) events ;;
ports) ports ;;
add) add_wan ;;
rpf) rpf ;;
*) echo "kullanım: $0 config|set|mode|confirm|revert|reconnect|events|ports|add|rpf" >&2; exit 1 ;;
esac
