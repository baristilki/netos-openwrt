#!/usr/bin/ucode
// NetOS ağ özellikleri (rpcd'den: ucode netctl.uc <komut>, argümanlar stdin JSON)
//   wan_info                         -> WAN adresleri ve türü (public | cgnat | private) — port açma/VPN uyarısı
//   pf_list / pf_set / pf_delete     -> port yönlendirme (firewall "redirect") + UPnP kayıtları
//   upnp_set {enabled}               -> UPnP (miniupnpd)
//   lan_get / lan_set / lan_confirm / lan_revert -> yerel ağ IP + DHCP (IP değişirse 120 sn geri alma)
//   wg_status / wg_setup / wg_set / wg_add / wg_delete -> WireGuard VPN sunucusu
//   qr {text}                        -> SVG QR kodu (qrencode)
//   pkg_install {set} / pkg_status {set} -> gerekli paketi arka planda kur (yalnız izinli listeler)
// Test: NP_UCI_CONF (uci dizini), NP_DRYRUN (servis yeniden başlatma yok), NP_TMP

import * as fs from 'fs';
import { cursor } from 'uci';

const DRY = !!getenv('NP_DRYRUN');
const ctx = getenv('NP_UCI_CONF') ? cursor(getenv('NP_UCI_CONF'), getenv('NP_UCI_CONF') + '/.save') : cursor();
const TMP = getenv('NP_TMP') || '/tmp';
const RB = TMP + '/netpanel-lanrb';
const SELF = '/usr/libexec/netpanel/netctl.uc';
const WG = 'netos_wg';
const ROLLBACK = 180;

function out(o) { print(sprintf('%J', o), '\n'); exit(0); }
function fail(msg) { out({ ok: false, error: msg }); }
function q(s) { return "'" + replace('' + s, "'", "'\\''") + "'"; }
function sh(cmd) { const p = fs.popen(cmd, 'r'); if (!p) return ''; const r = p.read('all'); p.close(); return r ?? ''; }
function input() { const raw = fs.stdin.read('all'); return (raw && length(trim(raw))) ? (json(raw) ?? {}) : {}; }
function run(cmd) { if (DRY) { warn('DRYRUN: ' + cmd + '\n'); return 0; } return system(cmd + ' >/dev/null 2>&1'); }
function bg(cmd) { if (DRY) { warn('DRYRUN bg: ' + cmd + '\n'); return; } system('(' + cmd + ') >/dev/null 2>&1 </dev/null &'); }
function list(v) { return type(v) == 'array' ? v : (v == null || v == '' ? [] : split('' + v, /\s+/)); }
function has(path) { return fs.access(path) == true; }

// ── IPv4 yardımcıları ──
function ip2n(ip) {
	const m = match('' + ip, /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (!m) return null;
	let n = 0;
	for (let i = 1; i <= 4; i++) { const o = int(m[i]); if (o > 255) return null; n = n * 256 + o; }
	return n;
}
function pow2(e) { let r = 1; for (let i = 0; i < e; i++) r *= 2; return r; }
function n2ip(n) { n = int(n); return sprintf('%d.%d.%d.%d', int(n / 16777216) % 256, int(n / 65536) % 256, int(n / 256) % 256, n % 256); }
function inRange(n, a, b) { return n != null && n >= ip2n(a) && n <= ip2n(b); }
function isPrivate(ip) { const n = ip2n(ip); return inRange(n, '10.0.0.0', '10.255.255.255') || inRange(n, '172.16.0.0', '172.31.255.255') || inRange(n, '192.168.0.0', '192.168.255.255'); }
function isCgnat(ip) { return inRange(ip2n(ip), '100.64.0.0', '100.127.255.255'); }
function validPorts(p) {
	const m = match('' + p, /^(\d{1,5})(-(\d{1,5}))?$/);
	if (!m) return false;
	const a = int(m[1]), b = m[3] ? int(m[3]) : a;
	return a >= 1 && b <= 65535 && a <= b;
}
function portRange(p) { const m = match('' + p, /^(\d+)(-(\d+))?$/); return m ? [int(m[1]), m[3] ? int(m[3]) : int(m[1])] : null; }

// ── LAN ──
function lanCidr() {
	let ip = ctx.get('network', 'lan', 'ipaddr'), mask = ctx.get('network', 'lan', 'netmask');
	if (type(ip) == 'array') ip = ip[0];
	let prefix = 24;
	const m = match('' + ip, /^([\d.]+)\/(\d+)$/);
	if (m) { ip = m[1]; prefix = int(m[2]); }
	else if (mask) { let n = ip2n(mask), c = 0; while (n > 0) { c += n % 2; n = int(n / 2); } prefix = c; }
	return { ip: ip, prefix: prefix };
}
function lanContains(ip) {
	const l = lanCidr(), size = pow2(32 - l.prefix), net = ip2n(l.ip) - ip2n(l.ip) % size, n = ip2n(ip);
	return n != null && n > net && n < net + size - 1;
}

// ── WAN türü (port açma ve VPN dışarıdan erişilebilir mi?) ──
function wanInfo() {
	const raw = sh('ubus call network.interface dump 2>/dev/null');
	const d = length(raw) ? json(raw) : null;
	const res = [];
	for (let i in d?.interface ?? []) {
		if (!i.up) continue;
		const dr = filter(i.route ?? [], (r) => r.target == '0.0.0.0' && r.mask == 0);
		if (!length(dr) || i.interface == 'loopback') continue;
		const ip = i['ipv4-address']?.[0]?.address;
		if (!ip) continue;
		push(res, { name: i.interface, ip: ip, kind: isCgnat(ip) ? 'cgnat' : isPrivate(ip) ? 'private' : 'public' });
	}
	return res;
}

// ══ Güvenlik duvarı: DMZ + internetten ping ══
function fwInfo() {
	let dmz = null, ping = null;
	ctx.foreach('firewall', 'redirect', (s) => { if (s.name == 'NetOS-DMZ') dmz = s; });
	ctx.foreach('firewall', 'rule', (s) => { if (s.name == 'Allow-Ping' && s.src == 'wan') ping = s; });
	return { dmz_ip: dmz && dmz.enabled != '0' ? dmz.dest_ip : '', ping: ping ? ping.enabled != '0' : false };
}
function fw_set() {
	const a = input();
	if (a.ping != null) {
		let id = null;
		ctx.foreach('firewall', 'rule', (s) => { if (s.name == 'Allow-Ping' && s.src == 'wan') id = s['.name']; });
		if (!id) {
			id = ctx.add('firewall', 'rule');
			ctx.set('firewall', id, 'name', 'Allow-Ping'); ctx.set('firewall', id, 'src', 'wan'); ctx.set('firewall', id, 'proto', 'icmp');
			ctx.set('firewall', id, 'icmp_type', 'echo-request'); ctx.set('firewall', id, 'family', 'ipv4'); ctx.set('firewall', id, 'target', 'ACCEPT');
		}
		ctx.set('firewall', id, 'enabled', a.ping ? '1' : '0');
	}
	if (a.dmz_ip != null) {
		const ip = trim('' + a.dmz_ip);
		let id = null;
		ctx.foreach('firewall', 'redirect', (s) => { if (s.name == 'NetOS-DMZ') id = s['.name']; });
		if (!length(ip)) { if (id) ctx.delete('firewall', id); }
		else {
			if (!lanContains(ip) || ip == lanCidr().ip) fail('DMZ cihazı yerel ağda olmalı');
			if (!id) id = ctx.add('firewall', 'redirect');
			ctx.set('firewall', id, 'name', 'NetOS-DMZ'); ctx.set('firewall', id, 'target', 'DNAT'); ctx.set('firewall', id, 'src', 'wan');
			ctx.set('firewall', id, 'dest', 'lan'); ctx.set('firewall', id, 'proto', 'all'); ctx.set('firewall', id, 'dest_ip', ip); ctx.set('firewall', id, 'enabled', '1');
		}
	}
	ctx.commit('firewall');
	run('/etc/init.d/firewall reload');
	out({ ok: true });
}

// ══ Port yönlendirme ══
function pfList() {
	const rules = [];
	ctx.foreach('firewall', 'redirect', (s) => {
		if (s.target && s.target != 'DNAT') return;
		push(rules, {
			id: s['.name'], name: s.name ?? '', proto: join(' ', list(s.proto ?? 'tcp udp')), ext_port: s.src_dport ?? '',
			ip: s.dest_ip ?? '', int_port: s.dest_port ?? s.src_dport ?? '', enabled: s.enabled != '0', src: s.src ?? 'wan',
			netos: index(s.name ?? '', 'NetOS') == 0,
		});
	});
	return rules;
}
function upnpInfo() {
	const installed = has('/usr/sbin/miniupnpd');
	const leases = [];
	if (installed) {
		const lf = ctx.get('upnpd', 'config', 'upnp_lease_file') || '/var/run/miniupnpd.leases';
		for (let l in split(fs.readfile(lf) ?? '', '\n')) {
			const p = split(l, ':');
			if (length(p) < 4) continue;
			push(leases, { proto: lc(p[0]), ext_port: p[1], ip: p[2], int_port: p[3], desc: length(p) > 5 ? join(':', slice(p, 5)) : '' });
		}
	}
	return { installed: installed, enabled: installed && ctx.get('upnpd', 'config', 'enabled') == '1', running: length(trim(sh('pgrep miniupnpd 2>/dev/null'))) > 0, leases: leases };
}
function pf_list() { out({ rules: filter(pfList(), (r) => r.name != 'NetOS-DMZ'), upnp: upnpInfo(), wans: wanInfo(), lan: lanCidr(), fw: fwInfo() }); }

function pf_set() {
	const a = input();
	const proto = a.proto == 'tcp' || a.proto == 'udp' ? a.proto : 'tcp udp';
	const ext = trim('' + (a.ext_port ?? '')), intp = trim('' + (a.int_port || a.ext_port || ''));
	const ip = trim('' + (a.ip ?? ''));
	let name = trim('' + (a.name ?? ''));
	if (!validPorts(ext)) fail('Dış port 1-65535 arasında olmalı (aralık için 5000-5010)');
	if (!validPorts(intp)) fail('İç port 1-65535 arasında olmalı');
	const er = portRange(ext), ir = portRange(intp);
	if (er[1] - er[0] != ir[1] - ir[0]) fail('Dış ve iç port aralıkları aynı uzunlukta olmalı');
	if (!lanContains(ip)) fail('Hedef IP yerel ağda olmalı (' + lanCidr().ip + '/' + lanCidr().prefix + ')');
	if (ip == lanCidr().ip) fail('Router\'ın kendi adresine yönlendirme yapılamaz');
	if (length(name) > 40 || match(name, /['"\\]/)) fail('Ad en fazla 40 karakter olabilir, tırnak içeremez');
	if (!length(name)) name = 'NetOS ' + ip + ':' + intp;
	// çakışma: aynı protokolde kesişen dış port
	for (let r in pfList()) {
		if (r.id == a.id || !r.enabled || r.name == 'NetOS-DMZ') continue;
		const rr = portRange(r.ext_port);
		const protoClash = r.proto == proto || index(r.proto, ' ') > 0 || index(proto, ' ') > 0;
		if (rr && protoClash && rr[0] <= er[1] && er[0] <= rr[1]) fail('Dış port ' + r.ext_port + ' zaten "' + (r.name || r.ip) + '" kuralında kullanılıyor');
	}
	let sid = a.id;
	if (sid) { if (ctx.get('firewall', sid) != 'redirect') fail('Kural bulunamadı'); }
	else sid = ctx.add('firewall', 'redirect');
	ctx.set('firewall', sid, 'name', name);
	ctx.set('firewall', sid, 'target', 'DNAT');
	ctx.set('firewall', sid, 'src', 'wan');
	ctx.set('firewall', sid, 'dest', 'lan');
	ctx.set('firewall', sid, 'proto', split(proto, ' '));
	ctx.set('firewall', sid, 'src_dport', ext);
	ctx.set('firewall', sid, 'dest_ip', ip);
	ctx.set('firewall', sid, 'dest_port', intp);
	ctx.set('firewall', sid, 'enabled', a.enabled === false ? '0' : '1');
	ctx.commit('firewall');
	run('/etc/init.d/firewall reload');
	out({ ok: true, id: sid });
}
function pf_delete() {
	const a = input();
	if (!a.id || ctx.get('firewall', a.id) != 'redirect') fail('Kural bulunamadı');
	ctx.delete('firewall', a.id);
	ctx.commit('firewall');
	run('/etc/init.d/firewall reload');
	out({ ok: true });
}
function upnp_set() {
	const a = input();
	if (!has('/usr/sbin/miniupnpd')) fail('UPnP paketi kurulu değil');
	if (!ctx.get('upnpd', 'config')) ctx.set('upnpd', 'config', 'upnpd');
	ctx.set('upnpd', 'config', 'enabled', a.enabled ? '1' : '0');
	if (a.enabled) {
		const w = wanInfo();
		if (length(w)) ctx.set('upnpd', 'config', 'external_iface', w[0].name);
		ctx.set('upnpd', 'config', 'internal_iface', 'lan');
	}
	ctx.commit('upnpd');
	if (a.enabled) { run('/etc/init.d/miniupnpd enable'); run('/etc/init.d/miniupnpd restart'); }
	else { run('/etc/init.d/miniupnpd stop'); run('/etc/init.d/miniupnpd disable'); }
	out({ ok: true });
}

// ══ Yerel ağ (LAN) + DHCP ══
function dhcpDns() {
	const dns = [];
	for (let o in list(ctx.get('dhcp', 'lan', 'dhcp_option'))) {
		const m = match(o, /^(6|option:dns-server),(.+)$/);
		if (m) for (let x in split(m[2], ',')) push(dns, trim(x));
	}
	return dns;
}
function lan_get() {
	const l = lanCidr();
	let pending = null;
	if (has(RB + '/until')) pending = { until: int(trim(fs.readfile(RB + '/until'))), old_ip: trim(fs.readfile(RB + '/old_ip') ?? ''), new_ip: l.ip };
	let hosts = 0;
	ctx.foreach('dhcp', 'host', () => { hosts++; });
	out({
		ip: l.ip, prefix: l.prefix,
		dhcp: { enabled: ctx.get('dhcp', 'lan', 'ignore') != '1', start: int(ctx.get('dhcp', 'lan', 'start') ?? 100), limit: int(ctx.get('dhcp', 'lan', 'limit') ?? 150), leasetime: ctx.get('dhcp', 'lan', 'leasetime') ?? '12h' },
		dns: dhcpDns(), static_hosts: hosts, pending: pending,
	});
}
function rbBegin(oldIp) {
	system('mkdir -p ' + q(RB));
	for (let c in ['network', 'dhcp', 'firewall', 'netpanel']) {
		const src = (getenv('NP_UCI_CONF') || '/etc/config') + '/' + c;
		if (has(src)) system('cp ' + q(src) + ' ' + q(RB + '/' + c));
	}
	fs.writefile(RB + '/old_ip', oldIp);
	fs.writefile(RB + '/until', '' + (time() + ROLLBACK));
	bg(sprintf('while sleep 5; do [ -f %s/until ] || exit 0; [ $(date +%%s) -ge $(cat %s/until) ] && exec ucode %s lan_revert; done', RB, RB, SELF));
}
function lan_set() {
	const a = input();
	const cur = lanCidr();
	const newIp = trim('' + (a.ip ?? cur.ip));
	const ipChanged = newIp != cur.ip;
	if (has(RB + '/until')) fail('Bekleyen bir yerel ağ değişikliği var; önce onaylayın ya da geri alın');
	if (ipChanged) {
		if (!isPrivate(newIp)) fail('Router adresi yerel (özel) bir adres olmalı: 192.168.x.x, 10.x.x.x ya da 172.16-31.x.x');
		if (cur.prefix != 24) fail('Bu ağ /24 değil; adres değişikliğini LuCI\'den yapın');
		const last = ip2n(newIp) % 256;
		if (last < 1 || last > 254) fail('Adres .1 ile .254 arasında bitmeli');
		for (let w in wanInfo()) if (int(ip2n(w.ip) / 256) == int(ip2n(newIp) / 256)) fail('Bu adres ' + w.name + ' hattıyla aynı ağda (' + w.ip + '); başka bir ağ seçin (ör. 192.168.10.1)');
	}
	const start = int(a.start ?? ctx.get('dhcp', 'lan', 'start') ?? 100), limit = int(a.limit ?? ctx.get('dhcp', 'lan', 'limit') ?? 150);
	if (start < 2 || start > 253 || limit < 1 || start + limit - 1 > 254) fail('DHCP aralığı .2 ile .254 arasında kalmalı');
	const rlast = ip2n(newIp) % 256;
	if (rlast >= start && rlast <= start + limit - 1) fail('Router adresi (.' + rlast + ') DHCP aralığının içinde olamaz');
	const lt = '' + (a.leasetime ?? ctx.get('dhcp', 'lan', 'leasetime') ?? '12h');
	if (!match(lt, /^(\d{1,4}[mhd]|infinite)$/)) fail('Kira süresi ör. 12h, 30m, 7d olmalı');
	const dns = filter(map(type(a.dns) == 'array' ? a.dns : dhcpDns(), (x) => trim('' + x)), length);
	if (length(dns) > 3) fail('En fazla 3 DNS sunucusu');
	for (let d in dns) if (ip2n(d) == null) fail('Geçersiz DNS adresi: ' + d);

	if (ipChanged) rbBegin(cur.ip);
	// DHCP
	ctx.set('dhcp', 'lan', 'ignore', a.dhcp_enabled === false ? '1' : '0');
	ctx.set('dhcp', 'lan', 'start', '' + start);
	ctx.set('dhcp', 'lan', 'limit', '' + limit);
	ctx.set('dhcp', 'lan', 'leasetime', lt);
	const opts = filter(list(ctx.get('dhcp', 'lan', 'dhcp_option')), (o) => !match(o, /^(6|option:dns-server),/));
	if (length(dns)) push(opts, '6,' + join(',', dns));
	if (length(opts)) ctx.set('dhcp', 'lan', 'dhcp_option', opts); else ctx.delete('dhcp', 'lan', 'dhcp_option');
	let moved = 0;
	if (ipChanged) {
		const oldPre = substr(cur.ip, 0, rindex(cur.ip, '.') + 1), newPre = substr(newIp, 0, rindex(newIp, '.') + 1);
		const ipaddr = ctx.get('network', 'lan', 'ipaddr');
		ctx.set('network', 'lan', 'ipaddr', match('' + ipaddr, /\//) ? newIp + '/24' : newIp);
		if (oldPre != newPre) {
			// aynı /24 değil: sabit IP kayıtları, port kuralları ve Huawei adresi yeni ağa taşınır (son hane korunur)
			const mv = (v) => (type(v) == 'string' && index(v, oldPre) == 0) ? newPre + substr(v, length(oldPre)) : v;
			ctx.foreach('dhcp', 'host', (s) => { const n = mv(s.ip); if (n != s.ip) { ctx.set('dhcp', s['.name'], 'ip', n); moved++; } });
			ctx.foreach('firewall', 'redirect', (s) => { const n = mv(s.dest_ip); if (n != s.dest_ip) { ctx.set('firewall', s['.name'], 'dest_ip', n); moved++; } });
			const hh = ctx.get('netpanel', 'huawei', 'host');
			if (hh && mv(hh) != hh) { ctx.set('netpanel', 'huawei', 'host', mv(hh)); moved++; }
			ctx.commit('firewall'); ctx.commit('netpanel');
		}
		ctx.commit('network');
	}
	ctx.commit('dhcp');
	// yanıt döndükten sonra uygula (IP değişince bu bağlantı kopacak)
	bg('sleep 2; ' + (ipChanged ? '/etc/init.d/network reload; /etc/init.d/firewall reload; ' : '') + '/etc/init.d/dnsmasq restart; /etc/init.d/netpanel restart');
	out({ ok: true, ip_changed: ipChanged, new_ip: newIp, moved: moved, pending_until: ipChanged ? time() + ROLLBACK : null });
}
function lan_confirm() { system('rm -rf ' + q(RB)); out({ ok: true }); }
function lan_revert() {
	if (!has(RB + '/until')) out({ ok: true });
	for (let c in ['network', 'dhcp', 'firewall', 'netpanel'])
		if (has(RB + '/' + c)) system('cp ' + q(RB + '/' + c) + ' ' + q((getenv('NP_UCI_CONF') || '/etc/config') + '/' + c));
	system('rm -rf ' + q(RB));
	bg('/etc/init.d/network reload; /etc/init.d/firewall reload; /etc/init.d/dnsmasq restart; /etc/init.d/netpanel restart');
	out({ ok: true, reverted: true });
}

// ══ WireGuard VPN ══
function wgInstalled() { return has('/usr/bin/wg') && (has('/sys/module/wireguard') || length(trim(sh('find /lib/modules -name "wireguard.ko*" 2>/dev/null | head -1'))) > 0); }
function wgPub(priv) { return trim(sh('echo ' + q(priv) + ' | wg pubkey 2>/dev/null')); }
function wgPeers() {
	const rt = {};
	for (let l in split(sh('wg show ' + WG + ' dump 2>/dev/null'), '\n')) {
		const p = split(l, '\t');
		if (length(p) == 8) rt[p[0]] = { endpoint: p[2] == '(none)' ? '' : p[2], handshake: int(p[4]), rx: int(p[5]), tx: int(p[6]) };
	}
	const peers = [];
	ctx.foreach('network', 'wireguard_' + WG, (s) => {
		const r = rt[s.public_key] ?? {};
		push(peers, { id: s['.name'], name: s.description ?? '', ip: split(list(s.allowed_ips)[0] ?? '', '/')[0], handshake: r.handshake ?? 0, rx: r.rx ?? 0, tx: r.tx ?? 0, endpoint: r.endpoint ?? '' });
	});
	return peers;
}
function wgConf() {
	const addr = list(ctx.get('network', WG, 'addresses'))[0] ?? '10.99.0.1/24';
	return { configured: ctx.get('network', WG) == 'interface', port: int(ctx.get('network', WG, 'listen_port') ?? 51820), addr: addr,
		enabled: ctx.get('network', WG, 'disabled') != '1', endpoint: ctx.get('netpanel', 'vpn', 'endpoint') ?? '' };
}
function wg_status() {
	const c = wgConf();
	out({ installed: wgInstalled(), qrencode: has('/usr/bin/qrencode'), configured: c.configured, enabled: c.enabled, port: c.port, subnet: c.addr,
		endpoint: c.endpoint, up: length(trim(sh('ip link show ' + WG + ' 2>/dev/null'))) > 0, peers: c.configured ? wgPeers() : [], wans: wanInfo() });
}
function validEndpoint(e) { return match(e, /^[A-Za-z0-9.-]{1,253}$/) != null; }
function lanZone() { let z = null; ctx.foreach('firewall', 'zone', (s) => { if (s.name == 'lan') z = s['.name']; }); return z; }
function wg_setup() {
	const a = input();
	if (!wgInstalled()) fail('WireGuard paketi kurulu değil');
	const port = int(a.port ?? 51820), ep = trim('' + (a.endpoint ?? ''));
	if (port < 1024 || port > 65535) fail('Port 1024-65535 arasında olmalı');
	if (ep && !validEndpoint(ep)) fail('Adres bir alan adı ya da IP olmalı');
	const lan = lanCidr();
	if (index(lan.ip, '10.99.0.') == 0) fail('Yerel ağ 10.99.0.x; VPN ağı çakışır');
	if (ctx.get('network', WG) != 'interface') {
		const key = trim(sh('wg genkey 2>/dev/null'));
		if (!length(key)) fail('Anahtar üretilemedi');
		ctx.set('network', WG, 'interface');
		ctx.set('network', WG, 'proto', 'wireguard');
		ctx.set('network', WG, 'private_key', key);
		ctx.set('network', WG, 'addresses', ['10.99.0.1/24']);
		// VPN istemcileri ev ağı gibi davransın: lan bölgesine ekle
		const z = lanZone();
		if (z) { const nets = list(ctx.get('firewall', z, 'network')); if (index(nets, WG) < 0) { push(nets, WG); ctx.set('firewall', z, 'network', nets); } }
	}
	ctx.set('network', WG, 'listen_port', '' + port);
	ctx.set('network', WG, 'disabled', '0');
	// internetten gelen WireGuard bağlantısına izin
	let rule = null;
	ctx.foreach('firewall', 'rule', (s) => { if (s.name == 'NetOS-WireGuard') rule = s['.name']; });
	if (!rule) rule = ctx.add('firewall', 'rule');
	ctx.set('firewall', rule, 'name', 'NetOS-WireGuard');
	ctx.set('firewall', rule, 'src', 'wan');
	ctx.set('firewall', rule, 'proto', 'udp');
	ctx.set('firewall', rule, 'dest_port', '' + port);
	ctx.set('firewall', rule, 'target', 'ACCEPT');
	ctx.set('firewall', rule, 'enabled', '1');
	if (!ctx.get('netpanel', 'vpn')) ctx.set('netpanel', 'vpn', 'vpn');
	ctx.set('netpanel', 'vpn', 'endpoint', ep);
	ctx.commit('network'); ctx.commit('firewall'); ctx.commit('netpanel');
	bg('sleep 1; /etc/init.d/network reload; /etc/init.d/firewall reload');
	out({ ok: true });
}
function wg_set() {
	const a = input();
	if (ctx.get('network', WG) != 'interface') fail('VPN kurulmamış');
	ctx.set('network', WG, 'disabled', a.enabled ? '0' : '1');
	ctx.foreach('firewall', 'rule', (s) => { if (s.name == 'NetOS-WireGuard') ctx.set('firewall', s['.name'], 'enabled', a.enabled ? '1' : '0'); });
	if (a.endpoint != null) {
		const ep = trim('' + a.endpoint);
		if (ep && !validEndpoint(ep)) fail('Adres bir alan adı ya da IP olmalı');
		if (!ctx.get('netpanel', 'vpn')) ctx.set('netpanel', 'vpn', 'vpn');
		ctx.set('netpanel', 'vpn', 'endpoint', ep);
		ctx.commit('netpanel');
	}
	ctx.commit('network'); ctx.commit('firewall');
	bg('sleep 1; /etc/init.d/network reload; /etc/init.d/firewall reload');
	out({ ok: true });
}
function qrSvg(text) {
	if (!has('/usr/bin/qrencode')) return null;
	const f = TMP + '/netpanel-qr.txt';
	fs.writefile(f, text);
	system('chmod 600 ' + q(f));
	const svg = sh('qrencode -t SVG -m 2 -l M -r ' + q(f) + ' -o - 2>/dev/null');
	fs.unlink(f);
	return length(svg) ? svg : null;
}
function wg_add() {
	const a = input();
	const c = wgConf();
	if (!c.configured) fail('Önce VPN sunucusunu kurun');
	const name = trim('' + (a.name ?? ''));
	if (!length(name) || length(name) > 32 || match(name, /['"\\]/)) fail('Cihaz adı 1-32 karakter olmalı');
	let ep = c.endpoint;
	if (!ep) { const w = filter(wanInfo(), (x) => x.kind == 'public'); ep = length(w) ? w[0].ip : (wanInfo()[0]?.ip ?? ''); }
	if (!ep) fail('Dış adres bulunamadı; VPN ayarlarından alan adı/IP girin');
	const used = {};
	for (let p in wgPeers()) used[p.ip] = true;
	let ip = null;
	for (let i = 2; i < 255; i++) if (!used['10.99.0.' + i]) { ip = '10.99.0.' + i; break; }
	if (!ip) fail('VPN ağı dolu');
	const priv = trim(sh('wg genkey')), pub = wgPub(priv), psk = trim(sh('wg genpsk'));
	if (!length(priv) || !length(pub)) fail('Anahtar üretilemedi');
	const sid = ctx.add('network', 'wireguard_' + WG);
	ctx.set('network', sid, 'description', name);
	ctx.set('network', sid, 'public_key', pub);
	ctx.set('network', sid, 'preshared_key', psk);
	ctx.set('network', sid, 'allowed_ips', [ip + '/32']);
	ctx.commit('network');
	bg('sleep 1; /etc/init.d/network reload');
	const lan = lanCidr();
	const lanNet = n2ip(ip2n(lan.ip) - ip2n(lan.ip) % (pow2(32 - lan.prefix))) + '/' + lan.prefix;
	const allowed = a.full_tunnel === false ? '10.99.0.0/24, ' + lanNet : '0.0.0.0/0';
	const conf = '[Interface]\nPrivateKey = ' + priv + '\nAddress = ' + ip + '/32\nDNS = ' + lan.ip + '\n\n[Peer]\nPublicKey = ' + wgPub(ctx.get('network', WG, 'private_key')) +
		'\nPresharedKey = ' + psk + '\nEndpoint = ' + (index(ep, ':') >= 0 ? '[' + ep + ']' : ep) + ':' + c.port + '\nAllowedIPs = ' + allowed + '\nPersistentKeepalive = 25\n';
	// istemci gizli anahtarı router'da saklanmaz; yalnız bu yanıtta bir kez döner
	out({ ok: true, id: sid, ip: ip, config: conf, qr: qrSvg(conf) });
}
function wg_delete() {
	const a = input();
	if (!a.id || ctx.get('network', a.id) != 'wireguard_' + WG) fail('Cihaz bulunamadı');
	ctx.delete('network', a.id);
	ctx.commit('network');
	bg('sleep 1; /etc/init.d/network reload');
	out({ ok: true });
}

// ══ QR ══
function qr() {
	const a = input();
	const t = '' + (a.text ?? '');
	if (!length(t) || length(t) > 1200) fail('QR metni boş ya da çok uzun');
	const svg = qrSvg(t);
	if (!svg) fail('qrencode paketi kurulu değil');
	out({ ok: true, svg: svg });
}

// ══ Paket kurulumu (yalnız izinli listeler) ══
const PKGS = { https: ['px5g-mbedtls'], adguard: ['adguardhome'], upnp: ['miniupnpd-nftables'], wireguard: ['wireguard-tools', 'kmod-wireguard'], qr: ['qrencode'], wol: ['etherwake'], mwan3: ['mwan3', 'luci-app-mwan3'] };
function pkgCheck(set) {
	return { https: () => (has('/usr/bin/px5g') || has('/etc/uhttpd.crt')) && length(trim(sh('ls /usr/lib/libustream-ssl*.so* /lib/libustream-ssl*.so* 2>/dev/null'))) > 0, adguard: () => has('/usr/bin/AdGuardHome'), upnp: () => has('/usr/sbin/miniupnpd'), wireguard: wgInstalled, qr: () => has('/usr/bin/qrencode'), wol: () => has('/usr/sbin/etherwake') || has('/usr/bin/etherwake'), mwan3: () => has('/etc/config/mwan3') }[set]();
}
function pkg_install() {
	const a = input(), set = a.set;
	if (!PKGS[set]) fail('Bilinmeyen paket');
	if (pkgCheck(set)) out({ ok: true, installed: true });
	const st = TMP + '/netpanel-pkg-' + set;
	if (has(st + '.run')) out({ ok: true, running: true });
	const p = join(' ', PKGS[set]);
	fs.writefile(st + '.run', '' + time());
	bg(sprintf('if command -v apk >/dev/null; then apk update && apk add %s; else opkg update && opkg install %s; fi > %s.log 2>&1; echo $? > %s.rc; %s rm -f %s.run', p, p, st, st, set == 'https' ? '/etc/init.d/uhttpd restart;' : '', st));
	out({ ok: true, running: true });
}
function pkg_status() {
	const a = input(), set = a.set;
	if (!PKGS[set]) fail('Bilinmeyen paket');
	const st = TMP + '/netpanel-pkg-' + set;
	const rc = trim(fs.readfile(st + '.rc') ?? '');
	const log = sh('tail -n 6 ' + q(st + '.log') + ' 2>/dev/null');
	out({ installed: pkgCheck(set), running: has(st + '.run'), failed: length(rc) > 0 && rc != '0' && !pkgCheck(set), log: log });
}

switch (ARGV[0]) {
case 'wan_info': out({ wans: wanInfo() }); break;
case 'pf_list': pf_list(); break;
case 'pf_set': pf_set(); break;
case 'pf_delete': pf_delete(); break;
case 'fw_set': fw_set(); break;
case 'upnp_set': upnp_set(); break;
case 'lan_get': lan_get(); break;
case 'lan_set': lan_set(); break;
case 'lan_confirm': lan_confirm(); break;
case 'lan_revert': lan_revert(); break;
case 'wg_status': wg_status(); break;
case 'wg_setup': wg_setup(); break;
case 'wg_set': wg_set(); break;
case 'wg_add': wg_add(); break;
case 'wg_delete': wg_delete(); break;
case 'qr': qr(); break;
case 'pkg_install': pkg_install(); break;
case 'pkg_status': pkg_status(); break;
default: fail('Bilinmeyen komut');
}
