#!/usr/bin/ucode
// NetOS — Cloudflare Tunnel (cloudflared) kolay kurulum
//   cfctl.uc status                        -> durum (token içeriği ASLA döndürülmez)
//   cfctl.uc set_token   < {token}         -> Cloudflare panelinden kopyalanan tünel token'ı ile çalıştır
//   cfctl.uc set_enabled < {enabled}
//   cfctl.uc api_lookup  < {api_token}     -> hesaplar + alan adları (API token kaydedilmez)
//   cfctl.uc api_publish < {api_token, account_id, zone_id, subdomain, service, access_email}
//        mevcut tünele (token'daki tünel) adres ekler; tünel yoksa yeni "remote-managed" tünel açar,
//        DNS CNAME kaydı + (e-posta verilirse) Cloudflare Access koruması oluşturur.
//   cfctl.uc api_unpublish < {api_token, hostname}
// Test: NP_CF_API (API adresi), NP_UCI_CONF (uci dizini), NP_DRYRUN (servis yeniden başlatma yok)

import * as fs from 'fs';
import { cursor } from 'uci';

const API = getenv('NP_CF_API') || 'https://api.cloudflare.com/client/v4';
const DRY = !!getenv('NP_DRYRUN');
const ctx = getenv('NP_UCI_CONF') ? cursor(getenv('NP_UCI_CONF'), getenv('NP_UCI_CONF') + '/.save') : cursor();
const tmpdir = getenv('NP_TMP') || '/tmp';

function out(o) { print(sprintf('%J', o), '\n'); exit(0); }
function fail(msg) { out({ ok: false, error: msg }); }
function q(s) { return "'" + replace('' + s, "'", "'\\''") + "'"; }
function sh(cmd) { const p = fs.popen(cmd, 'r'); if (!p) return ''; const r = p.read('all'); p.close(); return r; }
function input() { const raw = fs.stdin.read('all'); return (raw && length(trim(raw))) ? (json(raw) ?? {}) : {}; }
function svc(action) { if (!DRY) system('/etc/init.d/cloudflared ' + action + ' >/dev/null 2>&1'); }

// ── Cloudflare API (token başlıkta; komut satırında görünmesin diye geçici dosyadan) ──
function cf(token, method, path, body) {
	const hf = tmpdir + '/netpanel-cf.h', bf = tmpdir + '/netpanel-cf.b';
	fs.writefile(hf, 'Authorization: Bearer ' + token + '\nContent-Type: application/json\n');
	system('chmod 600 ' + q(hf));
	let cmd = 'curl -s -m 25 -X ' + method + ' -H @' + q(hf) + ' ';
	if (body != null) { fs.writefile(bf, sprintf('%J', body)); cmd += '--data-binary @' + q(bf) + ' '; }
	const raw = sh(cmd + q(API + path));
	fs.unlink(hf); fs.unlink(bf);
	const r = length(raw) ? json(raw) : null;
	if (type(r) != 'object') return { success: false, errors: [{ message: 'Cloudflare API yanıt vermedi' }] };
	return r;
}
function cfErr(r) {
	const e = r?.errors?.[0];
	return e ? (e.message + (e.code ? ' (' + e.code + ')' : '')) : 'bilinmeyen hata';
}

// tünel token'ı: base64 JSON { a: hesap, t: tünel id, s: sır }
function decodeToken(tok) {
	if (!tok || !match(tok, /^[A-Za-z0-9+\/=_-]{40,}$/)) return null;
	const b = b64dec(replace(replace(tok, /-/g, '+'), /_/g, '/'));
	const j = b ? json(b) : null;
	return (type(j) == 'object' && j.a && j.t && j.s) ? j : null;
}

function running() { return length(trim(sh('pgrep -f "cloudflared.*tunnel" 2>/dev/null'))) > 0; }
function connections() {
	const log = ctx.get('cloudflared', 'config', 'logfile') || '/var/log/cloudflared.log';
	const t = sh('tail -n 300 ' + q(log) + ' 2>/dev/null');
	let n = 0;
	for (let l in split(t, '\n')) {
		if (index(l, 'Registered tunnel connection') >= 0) n++;
		else if (index(l, 'Unregistered tunnel connection') >= 0 || index(l, 'Connection terminated') >= 0) n = n > 0 ? n - 1 : 0;
	}
	return n > 4 ? 4 : n;
}

function hosts() {
	const l = ctx.get('netpanel', 'cloudflare', 'host');
	return map(type(l) == 'array' ? l : (l ? [l] : []), (x) => { const p = split(x, '|'); return { hostname: p[0], service: p[1] || '' }; });
}
function saveHosts(list) {
	if (!ctx.get('netpanel', 'cloudflare')) ctx.set('netpanel', 'cloudflare', 'cloudflare');
	ctx.set('netpanel', 'cloudflare', 'host', map(list, (h) => h.hostname + '|' + h.service));
	ctx.commit('netpanel');
}

function status() {
	const tok = ctx.get('cloudflared', 'config', 'token');
	const d = decodeToken(tok);
	const run = running();
	out({
		installed: fs.access('/etc/init.d/cloudflared') ? true : !!DRY,
		enabled: ctx.get('cloudflared', 'config', 'enabled') == '1',
		token_set: !!tok,
		token_valid: !!d,
		tunnel_id: d ? d.t : null,           // tünel kimliği gizli değil (DNS hedefinde de görünür)
		running: run,
		connections: run ? connections() : 0,
		hosts: hosts(),
		curl: length(trim(sh('command -v curl'))) > 0,
	});
}

function setToken() {
	const a = input();
	const tok = trim(a.token || '');
	if (!decodeToken(tok)) fail('Geçersiz tünel token\'ı. Cloudflare Zero Trust > Networks > Tunnels > tünel > "Install connector" ekranındaki uzun token\'ı yapıştırın (eyJ... ile başlar).');
	if (!ctx.get('cloudflared', 'config')) ctx.set('cloudflared', 'config', 'cloudflared');
	ctx.set('cloudflared', 'config', 'token', tok);
	ctx.set('cloudflared', 'config', 'enabled', '1');
	ctx.commit('cloudflared');
	svc('enable'); svc('restart');
	out({ ok: true });
}

function setEnabled() {
	const a = input();
	if (!ctx.get('cloudflared', 'config', 'token')) fail('Önce tünel token\'ı girin');
	ctx.set('cloudflared', 'config', 'enabled', a.enabled ? '1' : '0');
	ctx.commit('cloudflared');
	if (a.enabled) { svc('enable'); svc('restart'); } else { svc('stop'); svc('disable'); }
	out({ ok: true });
}

function lookup() {
	const a = input();
	const t = trim(a.api_token || '');
	if (length(t) < 30) fail('API token girin');
	const v = cf(t, 'GET', '/user/tokens/verify');
	if (!v.success) fail('API token doğrulanamadı: ' + cfErr(v));
	const acc = cf(t, 'GET', '/accounts?per_page=50');
	const zon = cf(t, 'GET', '/zones?per_page=50&status=active');
	if (!acc.success) fail('Hesaplar okunamadı (token\'a "Account: Cloudflare Tunnel: Edit" yetkisi verin): ' + cfErr(acc));
	if (!zon.success) fail('Alan adları okunamadı (token\'a "Zone: DNS: Edit" yetkisi verin): ' + cfErr(zon));
	const d = decodeToken(ctx.get('cloudflared', 'config', 'token'));
	out({
		ok: true,
		accounts: map(acc.result || [], (x) => ({ id: x.id, name: x.name })),
		zones: map(zon.result || [], (x) => ({ id: x.id, name: x.name, account_id: x.account?.id })),
		existing_tunnel: d ? { id: d.t, account_id: d.a } : null,
	});
}

function validService(s) {
	return match(s, /^(https?|ssh|rdp|tcp):\/\/[A-Za-z0-9.\-]+(:[0-9]{1,5})?(\/.*)?$/) != null;
}

function publish() {
	const a = input();
	const t = trim(a.api_token || ''), acc = a.account_id, zid = a.zone_id;
	let sub = lc(trim(a.subdomain || ''));
	const service = trim(a.service || 'http://192.168.1.1:80');
	const email = trim(a.access_email || '');
	if (length(t) < 30 || !acc || !zid) fail('API token, hesap ve alan adı gerekli');
	if (!match(sub, /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/)) fail('Alt alan adı yalnız harf, rakam ve tire içerebilir (ör. panel)');
	if (!validService(service)) fail('Hedef adres http://IP:port biçiminde olmalı');
	if (email && !match(email, /^[^@ ]+@[^@ ]+\.[^@ ]+$/)) fail('Geçersiz e-posta');

	const z = cf(t, 'GET', '/zones/' + zid);
	if (!z.success) fail('Alan adı okunamadı: ' + cfErr(z));
	const host = sub + '.' + z.result.name;

	// 1) tünel: mevcut token'daki tünel bu hesaba aitse onu kullan, değilse yeni tünel aç
	const d = decodeToken(ctx.get('cloudflared', 'config', 'token'));
	let tid, created = false, newToken = null;
	if (d && d.a == acc) {
		tid = d.t;
	} else {
		const tn = cf(t, 'POST', '/accounts/' + acc + '/cfd_tunnel', { name: 'netos-' + replace(host, /\./g, '-'), config_src: 'cloudflare' });
		if (!tn.success) fail('Tünel oluşturulamadı: ' + cfErr(tn));
		tid = tn.result.id; created = true;
		newToken = tn.result.token;
		if (!newToken) {
			const tk = cf(t, 'GET', '/accounts/' + acc + '/cfd_tunnel/' + tid + '/token');
			if (!tk.success) fail('Tünel token\'ı alınamadı: ' + cfErr(tk));
			newToken = tk.result;
		}
	}

	// 2) giriş kuralları: mevcut yapılandırmayı koru, bu adresi ekle/güncelle, "404" kuralı en sonda kalsın
	const gc = cf(t, 'GET', '/accounts/' + acc + '/cfd_tunnel/' + tid + '/configurations');
	if (!gc.success) fail('Tünel yapılandırması okunamadı (yerel config.yml ile yönetilen tüneller desteklenmez): ' + cfErr(gc));
	const config = gc.result?.config ?? {};
	const old = type(config.ingress) == 'array' ? config.ingress : [];
	const rules = filter(old, (r) => r.hostname && r.hostname != host);
	// yerel ağdaki https servisleri (Proxmox, NAS…) genelde kendinden imzalı sertifika kullanır
	push(rules, match(service, /^https:/) ? { hostname: host, service: service, originRequest: { noTLSVerify: true } } : { hostname: host, service: service });
	push(rules, { service: 'http_status:404' });
	config.ingress = rules;
	const pc = cf(t, 'PUT', '/accounts/' + acc + '/cfd_tunnel/' + tid + '/configurations', { config: config });
	if (!pc.success) fail('Tünel yapılandırması kaydedilemedi: ' + cfErr(pc));

	// 3) DNS: <host> CNAME <tünel>.cfargotunnel.com (Cloudflare proxy açık)
	const target = tid + '.cfargotunnel.com';
	const ex = cf(t, 'GET', '/zones/' + zid + '/dns_records?name=' + host);
	const rec = { type: 'CNAME', name: host, content: target, proxied: true, comment: 'NetOS Cloudflare Tunnel' };
	const dr = (ex.success && length(ex.result))
		? cf(t, 'PUT', '/zones/' + zid + '/dns_records/' + ex.result[0].id, rec)
		: cf(t, 'POST', '/zones/' + zid + '/dns_records', rec);
	if (!dr.success) fail('DNS kaydı oluşturulamadı (token\'a "Zone: DNS: Edit" yetkisi verin): ' + cfErr(dr));

	// 4) Cloudflare Access: yalnız verilen e-posta (tek kullanımlık kodla) girebilsin
	let access = null;
	if (email) {
		const ap = cf(t, 'POST', '/accounts/' + acc + '/access/apps', {
			name: 'NetOS — ' + host, domain: host, type: 'self_hosted', session_duration: '24h',
			policies: [{ name: 'NetOS sahibi', decision: 'allow', include: [{ email: { email: email } }] }],
		});
		access = ap.success ? { ok: true, email: email }
			: { ok: false, error: 'Access koruması kurulamadı: ' + cfErr(ap) + ' (token\'a "Account: Access: Apps and Policies: Edit" yetkisi verin)' };
	}

	// 5) yeni tünel açıldıysa router'daki cloudflared'i ona bağla
	if (created) {
		if (!ctx.get('cloudflared', 'config')) ctx.set('cloudflared', 'config', 'cloudflared');
		ctx.set('cloudflared', 'config', 'token', newToken);
		ctx.set('cloudflared', 'config', 'enabled', '1');
		ctx.commit('cloudflared');
		svc('enable'); svc('restart');
	}
	const hs = filter(hosts(), (h) => h.hostname != host);
	push(hs, { hostname: host, service: service });
	saveHosts(hs);
	out({ ok: true, hostname: host, url: 'https://' + host, tunnel_id: tid, created_tunnel: created, access: access });
}

function unpublish() {
	const a = input();
	const t = trim(a.api_token || ''), host = lc(trim(a.hostname || ''));
	const d = decodeToken(ctx.get('cloudflared', 'config', 'token'));
	if (!d) fail('Router\'da tünel token\'ı yok');
	if (length(t) < 30 || !host) fail('API token ve adres gerekli');
	const gc = cf(t, 'GET', '/accounts/' + d.a + '/cfd_tunnel/' + d.t + '/configurations');
	if (!gc.success) fail('Tünel yapılandırması okunamadı: ' + cfErr(gc));
	const config = gc.result?.config ?? {};
	config.ingress = filter(config.ingress || [], (r) => r.hostname != host);
	if (!length(filter(config.ingress, (r) => !r.hostname))) push(config.ingress, { service: 'http_status:404' });
	const pc = cf(t, 'PUT', '/accounts/' + d.a + '/cfd_tunnel/' + d.t + '/configurations', { config: config });
	if (!pc.success) fail('Kaydedilemedi: ' + cfErr(pc));
	saveHosts(filter(hosts(), (h) => h.hostname != host));
	out({ ok: true, note: 'Adres tünelden kaldırıldı. DNS kaydını Cloudflare panelinden silebilirsiniz.' });
}

switch (ARGV[0]) {
case 'status': status(); break;
case 'set_token': setToken(); break;
case 'set_enabled': setEnabled(); break;
case 'api_lookup': lookup(); break;
case 'api_publish': publish(); break;
case 'api_unpublish': unpublish(); break;
default: fail('Bilinmeyen komut');
}
