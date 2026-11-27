#!/usr/bin/ucode
// NetOS — AdGuard Home entegrasyonu (reklam / site engelleme, cihaz başına içerik filtresi)
//   status                       -> kurulu mu, etkin mi, koruma, istatistik
//   setup    {password}          -> ilk kurulum: dnsmasq 54'e, AdGuard 53'e; DNS testi başarısızsa geri alır
//   enable   {enabled}           -> AdGuard'ı DNS olarak aç/kapat (kapalıyken dnsmasq 53'e döner)
//   protection {enabled, minutes} -> korumayı aç/kapat (minutes: geçici kapatma)
//   services                     -> engellenebilir servis listesi (YouTube, TikTok…)
//   global_get / global_set {services} -> tüm ağ için engellenen servisler
//   client_get {mac, ip} / client_set {mac, ip, name, filtering, parental, safesearch, services}
// Ayarlar: netpanel.adguard.{user,password,web,added_opt6}. AdGuard API'si yerel (127.0.0.1) ve Basic Auth ile.
// Test: NP_AG_WEB (ör. 127.0.0.1:3001), NP_AG_DNSPORT, NP_UCI_CONF, NP_DRYRUN, NP_TMP

import * as fs from 'fs';
import { cursor } from 'uci';

const DRY = !!getenv('NP_DRYRUN');
const ctx = getenv('NP_UCI_CONF') ? cursor(getenv('NP_UCI_CONF'), getenv('NP_UCI_CONF') + '/.save') : cursor();
const TMP = getenv('NP_TMP') || '/tmp';
const DNS_PORT = int(getenv('NP_AG_DNSPORT') || 53);
const DNSMASQ_ALT = 54;

function out(o) { print(sprintf('%J', o), '\n'); exit(0); }
function fail(msg) { out({ ok: false, error: msg }); }
function q(s) { return "'" + replace('' + s, "'", "'\\''") + "'"; }
function sh(cmd) { const p = fs.popen(cmd, 'r'); if (!p) return ''; const r = p.read('all'); p.close(); return r ?? ''; }
function input() { const raw = fs.stdin.read('all'); return (raw && length(trim(raw))) ? (json(raw) ?? {}) : {}; }
function run(cmd) { if (DRY) { warn('DRYRUN: ' + cmd + '\n'); return 0; } return system(cmd + ' >/dev/null 2>&1'); }
function has(p) { return fs.access(p) == true; }
function sleep(s) { system('sleep ' + s); }

function web() { return getenv('NP_AG_WEB') || ctx.get('netpanel', 'adguard', 'web') || '127.0.0.1:3000'; }
function yamlPath() { return ctx.get('adguardhome', 'config', 'config_file') || '/etc/adguardhome/adguardhome.yaml'; }
function installed() { return has('/usr/bin/AdGuardHome'); }
function configured() { return has(yamlPath()) || !!getenv('NP_AG_WEB') && ctx.get('netpanel', 'adguard', 'password') != null; }
function running() { return length(trim(sh('pgrep -f "AdGuardHome --config" 2>/dev/null; pgrep -x AdGuardHome 2>/dev/null'))) > 0; }
function dnsmasqSec() { let s = null; ctx.foreach('dhcp', 'dnsmasq', (x) => { if (!s) s = x['.name']; }); return s; }
function dnsmasqPort() { return int(ctx.get('dhcp', dnsmasqSec(), 'port') ?? 53); }
function lanIp() { let ip = ctx.get('network', 'lan', 'ipaddr'); if (type(ip) == 'array') ip = ip[0]; return split('' + ip, '/')[0]; }

// AdGuard API (uclient-fetch: OpenWrt'de hazır)
function api(method, path, body, noauth) {
	const bf = TMP + '/netpanel-ag.json';
	let cmd = 'uclient-fetch -T 10 -O -'; // not: gövdesiz istekte Content-Type başlığı uclient-fetch'i bozuyor
	if (!noauth) {
		const u = ctx.get('netpanel', 'adguard', 'user') || 'admin', p = ctx.get('netpanel', 'adguard', 'password') || '';
		cmd += ' --header=' + q('Authorization: Basic ' + b64enc(u + ':' + p));
	}
	if (body != null) {
		fs.writefile(bf, sprintf('%J', body));
		cmd += ' --header=' + q('Content-Type: application/json');
		cmd += method == 'POST' ? ' --post-file=' + q(bf) : ' --method=' + method + ' --body-file=' + q(bf);
	} else if (method != 'GET') cmd += ' --method=' + method;
	const ef = TMP + '/netpanel-ag.err';
	const raw = sh(cmd + ' ' + q('http://' + web() + '/control/' + path) + ' 2>' + q(ef));
	const err = fs.readfile(ef) ?? '';
	fs.unlink(ef); if (body != null) fs.unlink(bf);
	// uclient-fetch HTTP hatasını stderr'e "HTTP error 401" diye yazar
	const he = match(err, /HTTP error ([0-9]+)/);
	if (he) {
		if (he[1] == '401' || he[1] == '403') return { ok: false, auth: true, error: 'AdGuard kullanıcı adı/şifresi hatalı' };
		return { ok: false, error: 'AdGuard hata ' + he[1] + (length(trim(raw)) ? ': ' + substr(trim(raw), 0, 160) : '') };
	}
	if (!length(trim(raw)) && match(err, /Failed|refused|timed out|Connection reset/)) return { ok: false, error: 'AdGuard API yanıt vermedi' };
	const t = trim(raw);
	let data = null;
	if (length(t)) { try { data = json(t); } catch (e) { data = t; } }
	return { ok: true, data: data };
}

function saveCreds(user, pass) {
	if (!ctx.get('netpanel', 'adguard')) ctx.set('netpanel', 'adguard', 'adguard');
	ctx.set('netpanel', 'adguard', 'user', user);
	ctx.set('netpanel', 'adguard', 'password', pass);
	ctx.commit('netpanel');
}

// DNS'i AdGuard'a devret / geri al
function useAdguard(on) {
	const s = dnsmasqSec();
	if (on) {
		ctx.set('dhcp', s, 'port', '' + DNSMASQ_ALT);
		// dnsmasq 53'te değilken kendini DNS olarak dağıtmaz: cihazlara router IP'sini biz verelim
		const opts = type(ctx.get('dhcp', 'lan', 'dhcp_option')) == 'array' ? ctx.get('dhcp', 'lan', 'dhcp_option') : [];
		if (!length(filter(opts, (o) => match(o, /^(6|option:dns-server),/)))) {
			push(opts, '6,' + lanIp());
			ctx.set('dhcp', 'lan', 'dhcp_option', opts);
			ctx.set('netpanel', 'adguard', 'added_opt6', '1');
		}
	} else {
		ctx.delete('dhcp', s, 'port');
		if (ctx.get('netpanel', 'adguard', 'added_opt6') == '1') {
			const opts = filter(type(ctx.get('dhcp', 'lan', 'dhcp_option')) == 'array' ? ctx.get('dhcp', 'lan', 'dhcp_option') : [], (o) => o != '6,' + lanIp());
			if (length(opts)) ctx.set('dhcp', 'lan', 'dhcp_option', opts); else ctx.delete('dhcp', 'lan', 'dhcp_option');
			ctx.delete('netpanel', 'adguard', 'added_opt6');
		}
	}
	ctx.commit('dhcp'); ctx.commit('netpanel');
}
function dnsWorks() {
	if (DRY) return true;
	for (let i = 0; i < 8; i++) {
		if (match(sh('nslookup openwrt.org 127.0.0.1 2>/dev/null'), /Name:[ \t]*openwrt\.org/)) return true;
		sleep(2);
	}
	return false;
}

function stats() {
	const st = api('GET', 'status');
	if (!st.ok) return { error: st.error, auth: !!st.auth };
	const s = api('GET', 'stats');
	const d = s.ok && type(s.data) == 'object' ? s.data : {};
	const top = (arr) => map(slice(arr ?? [], 0, 8), (o) => { const k = keys(o)[0]; return { name: k, count: o[k] }; });
	return {
		protection: !!st.data?.protection_enabled, version: st.data?.version ?? '', disabled_until: st.data?.protection_disabled_until ?? null,
		queries: d.num_dns_queries ?? 0, blocked: (d.num_blocked_filtering ?? 0) + (d.num_replaced_parental ?? 0) + (d.num_replaced_safebrowsing ?? 0),
		avg_ms: d.avg_processing_time != null ? d.avg_processing_time * 1000 : null, top_blocked: top(d.top_blocked_domains), top_clients: top(d.top_clients),
		hours: d.time_units == 'hours' ? 24 : 0,
	};
}
function status() {
	const inst = installed(), conf = configured(), active = conf && dnsmasqPort() != 53;
	const r = { installed: inst, configured: conf, running: inst && running(), active: active, creds: ctx.get('netpanel', 'adguard', 'password') != null,
		web_port: int(split(web(), ':')[1] ?? 3000), lan_ip: lanIp() };
	if (conf && r.creds && (r.running || getenv('NP_AG_WEB'))) r.stats = stats();
	out(r);
}

function setup() {
	const a = input();
	const pass = '' + (a.password ?? '');
	if (!installed()) fail('AdGuard Home kurulu değil');
	if (configured() && !getenv('NP_AG_WEB')) fail('AdGuard Home zaten kurulmuş; mevcut kullanıcı adı ve şifreyle bağlanın');
	if (length(pass) < 8 || length(pass) > 64) fail('Şifre 8-64 karakter olmalı');
	if (!DRY && dnsmasqPort() == 53) {
		// 53'ü boşalt: dnsmasq 54'e (DHCP ve yerel adlar dnsmasq'ta kalır)
		useAdguard(true);
		run('/etc/init.d/dnsmasq restart');
	}
	const webAddr = split(web(), ':');
	const r = api('POST', 'install/configure', { web: { ip: getenv('NP_AG_WEBIP') || '0.0.0.0', port: int(webAddr[1] ?? 3000) }, dns: { ip: '0.0.0.0', port: DNS_PORT }, username: 'admin', password: pass }, true);
	if (!r.ok) {
		if (!DRY) { useAdguard(false); run('/etc/init.d/dnsmasq restart'); }
		fail('AdGuard kurulumu başarısız: ' + r.error);
	}
	saveCreds('admin', pass);
	sleep(3);
	// üst DNS: şifreli DoH; yerel adlar (.lan) ve ters sorgular dnsmasq'a
	api('POST', 'dns_config', {
		upstream_dns: ['https://dns.cloudflare.com/dns-query', 'https://dns.quad9.net/dns-query', '[/lan/]127.0.0.1:' + DNSMASQ_ALT],
		bootstrap_dns: ['1.1.1.1', '9.9.9.9'], local_ptr_upstreams: ['127.0.0.1:' + DNSMASQ_ALT], use_private_ptr_resolvers: true, upstream_mode: 'load_balance',
	});
	if (!DRY) {
		run('/etc/init.d/adguardhome enable');
		if (!dnsWorks()) {
			useAdguard(false);
			run('/etc/init.d/dnsmasq restart');
			fail('AdGuard kuruldu ama DNS testi başarısız; eski düzene (dnsmasq) dönüldü. AdGuard arayüzünü kontrol edin: http://' + lanIp() + ':3000');
		}
		run('/etc/init.d/dnsmasq restart'); // cihazlara yeni DNS seçeneği
	}
	out({ ok: true, web: 'http://' + lanIp() + ':' + (webAddr[1] ?? 3000) });
}

function enable() {
	const a = input();
	if (!configured()) fail('AdGuard Home kurulmamış');
	if (a.enabled) {
		run('/etc/init.d/adguardhome enable');
		useAdguard(true);
		run('/etc/init.d/dnsmasq restart');
		run('/etc/init.d/adguardhome restart');
		if (!dnsWorks()) { useAdguard(false); run('/etc/init.d/dnsmasq restart'); fail('AdGuard DNS yanıt vermedi; dnsmasq\'a geri dönüldü'); }
	} else {
		run('/etc/init.d/adguardhome stop');
		run('/etc/init.d/adguardhome disable');
		useAdguard(false);
		run('/etc/init.d/dnsmasq restart');
	}
	out({ ok: true });
}
function connect() { // mevcut AdGuard için kullanıcı adı/şifre kaydet
	const a = input();
	const u = trim('' + (a.user ?? 'admin')), p = '' + (a.password ?? '');
	if (!length(u) || !length(p)) fail('Kullanıcı adı ve şifre gerekli');
	const old = [ctx.get('netpanel', 'adguard', 'user'), ctx.get('netpanel', 'adguard', 'password')];
	saveCreds(u, p);
	const r = api('GET', 'status');
	if (!r.ok) { if (old[1] != null) saveCreds(old[0] || 'admin', old[1]); fail(r.error); }
	out({ ok: true });
}
function protection() {
	const a = input();
	const body = { enabled: !!a.enabled };
	if (!a.enabled && int(a.minutes ?? 0) > 0) body.duration = int(a.minutes) * 60000;
	const r = api('POST', 'protection', body);
	if (!r.ok) fail(r.error);
	out({ ok: true });
}
function services() {
	const r = api('GET', 'blocked_services/all');
	if (!r.ok) fail(r.error);
	const list = r.data?.blocked_services ?? [];
	out({ services: map(list, (s) => ({ id: s.id, name: s.name, group: s.group_id ?? '' })) });
}
function global_get() {
	const r = api('GET', 'blocked_services/get');
	if (!r.ok) fail(r.error);
	out({ services: r.data?.ids ?? [] });
}
function global_set() {
	const a = input();
	const cur = api('GET', 'blocked_services/get');
	if (!cur.ok) fail(cur.error);
	const r = api('PUT', 'blocked_services/update', { ids: filter(a.services ?? [], (x) => match(x, /^[a-z0-9_]+$/)), schedule: cur.data?.schedule ?? { time_zone: 'Local' } });
	if (!r.ok) fail(r.error);
	out({ ok: true });
}
function findClient(list, mac, ip) {
	for (let c in list ?? []) for (let id in c.ids ?? []) if (lc(id) == mac || (ip && id == ip)) return c;
	return null;
}
function validMac(m) { return match(m, /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/) != null; }
function client_get() {
	const a = input(), mac = lc('' + (a.mac ?? '')), ip = '' + (a.ip ?? '');
	if (!validMac(mac)) fail('Geçersiz MAC');
	const r = api('GET', 'clients');
	if (!r.ok) fail(r.error);
	const c = findClient(r.data?.clients, mac, ip);
	if (!c) out({ custom: false, filtering: true, parental: false, safesearch: false, services: [] });
	out({ custom: true, name: c.name, filtering: c.use_global_settings ? true : !!c.filtering_enabled, parental: !c.use_global_settings && !!c.parental_enabled,
		safesearch: !c.use_global_settings && !!c.safe_search?.enabled, services: c.use_global_blocked_services ? [] : (c.blocked_services ?? []) });
}
function client_set() {
	const a = input(), mac = lc('' + (a.mac ?? '')), ip = '' + (a.ip ?? '');
	if (!validMac(mac)) fail('Geçersiz MAC');
	if (ip && !match(ip, /^\d+\.\d+\.\d+\.\d+$/)) fail('Geçersiz IP');
	const r = api('GET', 'clients');
	if (!r.ok) fail(r.error);
	const old = findClient(r.data?.clients, mac, ip);
	const svcs = filter(a.services ?? [], (x) => match(x, /^[a-z0-9_]+$/));
	const isDefault = a.filtering !== false && !a.parental && !a.safesearch && !length(svcs);
	if (isDefault) {
		if (old) { const d = api('POST', 'clients/delete', { name: old.name }); if (!d.ok) fail(d.error); }
		out({ ok: true, custom: false });
	}
	let name = replace(trim('' + (a.name ?? mac)), '"', '');
	if (!length(name)) name = mac;
	name = substr(name, 0, 40) + ' - ' + substr(replace(mac, /:/g, ''), 6);
	const ss = { enabled: !!a.safesearch, bing: true, duckduckgo: true, ecosia: true, google: true, pixabay: true, yandex: true, youtube: true };
	const data = {
		name: name, ids: filter([ip, mac], length), tags: [], upstreams: [],
		use_global_settings: false, filtering_enabled: a.filtering !== false, parental_enabled: !!a.parental, safebrowsing_enabled: true, safe_search: ss,
		use_global_blocked_services: !length(svcs), blocked_services: svcs, blocked_services_schedule: { time_zone: 'Local' },
		ignore_querylog: false, ignore_statistics: false, upstreams_cache_enabled: false, upstreams_cache_size: 0,
	};
	let w;
	if (old) {
		const upd = { name: old.name, data: data };
		w = api('POST', 'clients/update', upd);
	} else w = api('POST', 'clients/add', data);
	if (!w.ok) fail(w.error);
	if (type(w.data) == 'string' && length(w.data) && index(lc(w.data), 'ok') != 0) fail('AdGuard: ' + w.data);
	out({ ok: true, custom: true });
}

switch (ARGV[0]) {
case 'status': status(); break;
case 'setup': setup(); break;
case 'enable': enable(); break;
case 'connect': connect(); break;
case 'protection': protection(); break;
case 'services': services(); break;
case 'global_get': global_get(); break;
case 'global_set': global_set(); break;
case 'client_get': client_get(); break;
case 'client_set': client_set(); break;
default: fail('Bilinmeyen komut');
}
