#!/usr/bin/ucode
// NetOS — uygulama (servis) bazlı trafik
//   collect            -> (cron, dakikada bir) bağlantı tablosundaki bayt sayaçlarını cihaz × servis olarak topla
//   get {days, mac}     -> son N günün toplamları: { source, services[], devices{mac: services[]} }
//   heavy               -> hattı uzun süre zorlayan cihazlar: { items[{mac, name, kinds[], since, down, up, conns, top}] }
//                          eşikler: netpanel.heavy.{down (Mbit/s, 50), up (Mbit/s, 10), conns (600), minutes (20)}
//
// Nasıl çalışır:
//   1. AdGuard Home'un sorgu günlüğünden (DNS) hangi IP'nin hangi alan adına ait olduğu öğrenilir
//      (ör. 142.250.x.x -> googlevideo.com -> YouTube). AdGuard yoksa yalnız port bazlı tahmin yapılır.
//   2. /proc/net/nf_conntrack'teki her bağlantının bayt sayacı bir önceki dakikayla karşılaştırılır;
//      artış, bağlantıyı açan yerel cihaza (MAC) ve karşı IP'nin servisine yazılır.
//   Yaklaşıktır: bir dakikadan kısa ömürlü bağlantıların son kısmı ve şifreli DNS (DoH) kullanan
//   cihazların alan adları kaçabilir.
// Veri: /etc/netpanel/apps/YYYY-MM-DD.json  { mac: { servis: [indirme, yükleme] } }
// Test: NP_DATA, NP_RUN, NP_CT, NP_ARP, NP_QLOG (sorgu günlüğü JSON dosyası), NP_NOW, NP_UCI_CONF

import * as fs from 'fs';
import { cursor } from 'uci';

const ctx = getenv('NP_UCI_CONF') ? cursor(getenv('NP_UCI_CONF'), getenv('NP_UCI_CONF') + '/.save') : cursor();
const DATA = (getenv('NP_DATA') || '/etc/netpanel') + '/apps';
const RUN = getenv('NP_RUN') || '/tmp/netpanel-apps';
const CT = getenv('NP_CT') || '/proc/net/nf_conntrack';
const ARP = getenv('NP_ARP') || '/proc/net/arp';
const NOW = int(getenv('NP_NOW') || time());
const MAP_TTL = 6 * 3600;   // IP -> servis eşlemesi son görülmeden sonra 6 saat geçerli
const MAX_PER_DEV = 60;     // cihaz başına günlük en fazla servis satırı (fazlası "Diğer"e)

function out(o) { print(sprintf('%J', o), '\n'); exit(0); }
function q(s) { return "'" + replace('' + s, "'", "'\\''") + "'"; }
function sh(cmd) { const p = fs.popen(cmd, 'r'); if (!p) return ''; const r = p.read('all'); p.close(); return r ?? ''; }
function rjson(p, d) { const s = fs.readfile(p); if (!s) return d; try { return json(s) ?? d; } catch (e) { return d; } }
function wjson(p, o) { const t = p + '.tmp'; fs.writefile(t, sprintf('%J', o)); fs.rename(t, p); }
function input() { const raw = fs.stdin.read('all'); return (raw && length(trim(raw))) ? (json(raw) ?? {}) : {}; }
function day(t) { const l = localtime(t); return sprintf('%04d-%02d-%02d', l.year, l.mon, l.mday); }

// alan adı son eki -> servis adı (en uzun eşleşme kazanır)
const SERVICES = {
	'YouTube': ['youtube.com', 'googlevideo.com', 'ytimg.com', 'youtu.be', 'youtubei.googleapis.com', 'youtube-nocookie.com'],
	'Netflix': ['netflix.com', 'nflxvideo.net', 'nflximg.net', 'nflxext.com', 'nflxso.net', 'netflix.net'],
	'Disney+': ['disneyplus.com', 'dssott.com', 'bamgrid.com', 'disney-plus.net'],
	'Prime Video': ['primevideo.com', 'aiv-cdn.net', 'aiv-delivery.net', 'amazonvideo.com', 'media-amazon.com'],
	'Twitch': ['twitch.tv', 'ttvnw.net', 'jtvnw.net', 'twitchcdn.net'],
	'Kick': ['kick.com'],
	'Spotify': ['spotify.com', 'scdn.co', 'spotifycdn.com', 'spotifycdn.net'],
	'TikTok': ['tiktok.com', 'tiktokcdn.com', 'tiktokv.com', 'tiktokcdn-eu.com', 'tiktokcdn-us.com', 'byteoversea.com', 'ibytedtos.com', 'ibyteimg.com', 'muscdn.com', 'tiktokv.eu'],
	'Instagram': ['instagram.com', 'cdninstagram.com'],
	'Facebook': ['facebook.com', 'fbcdn.net', 'fbsbx.com', 'facebook.net', 'fb.com'],
	'WhatsApp': ['whatsapp.net', 'whatsapp.com'],
	'Telegram': ['telegram.org', 't.me', 'telegram.me', 'cdn-telegram.org'],
	'Discord': ['discord.com', 'discord.gg', 'discordapp.com', 'discordapp.net', 'discord.media'],
	'X (Twitter)': ['twitter.com', 'x.com', 'twimg.com', 't.co'],
	'Snapchat': ['snapchat.com', 'sc-cdn.net', 'snapkit.com'],
	'Zoom': ['zoom.us'],
	'Steam': ['steampowered.com', 'steamcontent.com', 'steamserver.net', 'steamstatic.com', 'valvesoftware.com', 'steamcommunity.com'],
	'Epic Games': ['epicgames.com', 'epicgames.dev', 'unrealengine.com', 'fortnite.com'],
	'PlayStation': ['playstation.net', 'playstation.com', 'sonyentertainmentnetwork.com'],
	'Xbox': ['xboxlive.com', 'xbox.com', 'xboxservices.com'],
	'Riot Games': ['riotgames.com', 'leagueoflegends.com', 'riotcdn.net'],
	'Windows Update': ['windowsupdate.com', 'update.microsoft.com', 'delivery.mp.microsoft.com', 'dl.delivery.mp.microsoft.com'],
	'Microsoft': ['microsoft.com', 'live.com', 'office.com', 'office.net', 'msn.com', 'bing.com', 'skype.com', 'sharepoint.com', 'onedrive.com', 'azureedge.net'],
	'Apple': ['icloud.com', 'apple.com', 'mzstatic.com', 'aaplimg.com', 'cdn-apple.com', 'apple-cloudkit.com'],
	'Google': ['google.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com', 'gvt1.com', 'gvt2.com', 'google.com.tr', 'gmail.com'],
	'Exxen': ['exxen.com'],
	'BluTV / Max': ['blutv.com', 'max.com', 'hbomax.com'],
	'TOD': ['todtv.com.tr', 'tod.tv'],
	'Tabii': ['tabii.com'],
	'Gain': ['gain.tv'],
	'Trendyol': ['trendyol.com', 'dsmcdn.com'],
};
let SUFFIX = {};
for (let name in SERVICES) for (let d in SERVICES[name]) SUFFIX[d] = name;

function serviceOf(host) {
	host = lc(rtrim('' + host, '.'));
	let parts = split(host, '.');
	for (let i = 0; i < length(parts) - 1; i++) {
		const suf = join('.', slice(parts, i));
		if (SUFFIX[suf]) return SUFFIX[suf];
	}
	// bilinmeyen: kayıtlı alan adı (ör. cdn.example.com.tr -> example.com.tr)
	const n = length(parts);
	if (n < 2) return null;
	const sld = parts[n - 2];
	const take = (n >= 3 && index(['com', 'net', 'org', 'gov', 'edu', 'co', 'gen', 'bel', 'k12', 'av'], sld) >= 0) ? 3 : 2;
	return join('.', slice(parts, n - take));
}

function portGuess(proto, dport) {
	dport = int(dport);
	if (dport == 53 || dport == 853) return 'DNS';
	if (dport == 123) return 'Saat (NTP)';
	if (proto == 'udp' && dport >= 3478 && dport <= 3481) return 'Görüntülü / sesli arama';
	if (dport == 3074 || dport == 3075) return 'Oyun (Xbox / PlayStation)';
	if (dport >= 27015 && dport <= 27050) return 'Oyun (Steam)';
	if (dport == 51820 || dport == 1194 || dport == 500 || dport == 4500) return 'VPN';
	if (dport == 443 || dport == 80 || dport == 8080 || dport == 8443) return 'Web (diğer)';
	return 'Diğer';
}

// AdGuard sorgu günlüğü -> IP eşlemesi
function adguardLog() {
	const f = getenv('NP_QLOG');
	if (f) return rjson(f, null);
	const pass = ctx.get('netpanel', 'adguard', 'password');
	if (pass == null) return null;
	const web = ctx.get('netpanel', 'adguard', 'web') || '127.0.0.1:3000';
	const user = ctx.get('netpanel', 'adguard', 'user') || 'admin';
	const raw = sh('uclient-fetch -T 8 -q -O - --header=' + q('Authorization: Basic ' + b64enc(user + ':' + pass)) +
		' ' + q('http://' + web + '/control/querylog?limit=1000&response_status=all') + ' 2>/dev/null');
	if (!length(trim(raw))) return null;
	try { return json(raw); } catch (e) { return null; }
}

function learn(ipmap, meta) {
	const log = adguardLog();
	if (!log || type(log.data) != 'array') { meta.source = meta.source == 'adguard' && NOW - (meta.agt ?? 0) < 3600 ? 'adguard' : 'ports'; return; }
	meta.source = 'adguard'; meta.agt = NOW;
	const last = meta.qlast ?? '';
	let newest = last;
	for (let e in log.data) {
		const t = e.time ?? '';
		if (t <= last) break;           // en yeni önce sıralı
		if (t > newest) newest = t;
		const svc = serviceOf(e.question?.name ?? '');
		if (!svc) continue;
		for (let a in (e.answer ?? []))
			if ((a.type == 'A' || a.type == 'AAAA') && a.value) ipmap[a.value] = [svc, NOW];
	}
	meta.qlast = newest;
}

function localIps() {
	let m = {};
	for (let l in split(fs.readfile(ARP) ?? '', '\n')) {
		const f = split(trim(l), /\s+/);
		if (length(f) >= 6 && f[3] != '00:00:00:00:00:00' && match(f[3], /^[0-9a-f:]{17}$/)) m[f[0]] = f[3];
	}
	// WAN modemleri (ağ geçitleri) yerel cihaz sayılmaz
	for (let l in split(sh('ip -4 route show default 2>/dev/null; ip -4 route show table all default 2>/dev/null'), '\n')) {
		const g = match(l, /via ([0-9.]+)/);
		if (g) delete m[g[1]];
	}
	return m;
}

function flush(d, acc) {
	if (!length(keys(acc))) return;
	const p = DATA + '/' + d + '.json';
	let all = rjson(p, {});
	for (let mac in acc) {
		const t = (all[mac] ??= {});
		for (let s in acc[mac]) {
			const r = (t[s] ??= [0, 0]);
			r[0] += acc[mac][s][0]; r[1] += acc[mac][s][1];
		}
		// çok fazla küçük satır olursa en küçükleri "Diğer"de topla
		let ks = sort(keys(t), (a, b) => (t[b][0] + t[b][1]) - (t[a][0] + t[a][1]));
		if (length(ks) > MAX_PER_DEV) {
			const o = (t['Diğer'] ??= [0, 0]);
			for (let k in slice(ks, MAX_PER_DEV - 1)) if (k != 'Diğer') { o[0] += t[k][0]; o[1] += t[k][1]; delete t[k]; }
		}
	}
	wjson(p, all);
}

// ── yoğun kullanım: son N dakikada sürekli yüksek indirme/yükleme ya da çok fazla bağlantı ──
function heavyCfg(k, d) { const v = int(ctx.get('netpanel', 'heavy', k) ?? d); return v > 0 ? v : d; }
function devName(mac) {
	const n = ctx.get('netpanel', 'm_' + replace(mac, ':', ''), 'name');
	if (n) return n;
	for (let l in split(fs.readfile('/tmp/dhcp.leases') ?? '', '\n')) {
		const f = split(l, ' ');
		if (lc(f[1] ?? '') == mac && f[3] && f[3] != '*') return f[3];
	}
	return uc(mac);
}
function detect(mt, dt) {
	if (dt < 20 || dt > 600) return;   // dakikalık ölçüm dışı (ilk/uzun ara) sayılmaz
	const win = heavyCfg('minutes', 20) * 60, thD = heavyCfg('down', 50), thU = heavyCfg('up', 10), thC = heavyCfg('conns', 600);
	let hist = rjson(RUN + '/hist.json', {}), heavy = rjson(RUN + '/heavy.json', {});
	for (let mac in mt) {
		const m = mt[mac];
		let top = null, tb = 0;
		for (let s in m[3]) if (m[3][s] > tb) { tb = m[3][s]; top = s; }
		push(hist[mac] ??= [], [NOW, m[0] * 8 / dt / 1e6, m[1] * 8 / dt / 1e6, m[2], top]);
	}
	for (let mac in hist) {
		hist[mac] = filter(hist[mac], (x) => NOW - x[0] <= win + 90);
		if (!length(hist[mac])) { delete hist[mac]; continue; }
		const h = hist[mac], n = length(h);
		// pencerenin en az %75'i ölçülmüş olmalı (kısa ani yüklemeler sayılmaz)
		const full = n >= int(win / 60 * 0.75) && NOW - h[0][0] >= win * 0.75;
		let sd = 0, su = 0, cmin = 1e9, tops = {};
		for (let x in h) { sd += x[1]; su += x[2]; if (x[3] < cmin) cmin = x[3]; if (x[4]) tops[x[4]] = (tops[x[4]] ?? 0) + 1; }
		const ad = sd / n, au = su / n;
		const last5 = slice(h, -5);
		const cm5 = length(last5) >= 5 ? min(...map(last5, (x) => x[3])) : 0;
		let kinds = [];
		if (full && ad >= thD) push(kinds, 'download');
		if (full && au >= thU) push(kinds, 'upload');
		if (cm5 >= thC) push(kinds, 'connections');
		let top = null, tc = 0;
		for (let s in tops) if (tops[s] > tc) { tc = tops[s]; top = s; }
		if (length(kinds)) {
			const was = heavy[mac];
			heavy[mac] = { kinds, since: was?.since ?? h[0][0], down: int(ad * 10 + 0.5) / 10, up: int(au * 10 + 0.5) / 10, conns: h[n - 1][3], top, notified: was?.notified ?? false, name: devName(mac) };
			if (!heavy[mac].notified) {
				heavy[mac].notified = true;
				const k = join(', ', map(kinds, (x) => ({ download: 'yüksek indirme (' + heavy[mac].down + ' Mbit/s)', upload: 'yüksek yükleme (' + heavy[mac].up + ' Mbit/s)', connections: 'çok fazla bağlantı (' + heavy[mac].conns + ')' })[x]));
				const msg = heavy[mac].name + ' hattı uzun süredir yoğun kullanıyor: ' + k + (top ? ', çoğu ' + top : '');
				system('(. /usr/share/netpanel/common.sh; np_notify ' + q(msg) + ' system) >/dev/null 2>&1 &');
				system('logger -t netos ' + q('yoğun kullanım: ' + msg));
			}
		} else if (heavy[mac]) delete heavy[mac];
	}
	for (let mac in heavy) if (!hist[mac]) delete heavy[mac];
	wjson(RUN + '/hist.json', hist);
	wjson(RUN + '/heavy.json', heavy);
}
function heavyList() {
	const h = rjson(RUN + '/heavy.json', {});
	out({ items: map(sort(keys(h), (a, b) => h[a].since - h[b].since), (m) => ({ mac: m, ...h[m], notified: undefined })) });
}

function collect() {
	fs.mkdir(RUN); fs.mkdir(DATA);
	let meta = rjson(RUN + '/meta.json', {});
	let ipmap = rjson(RUN + '/ipmap.json', {});
	const first = !fs.access(RUN + '/ct.json');   // ilk çalışma: yalnız başlangıç ölçümü, eski toplamlar sayılmaz
	let prev = rjson(RUN + '/ct.json', {});
	learn(ipmap, meta);
	for (let ip in ipmap) if (NOW - ipmap[ip][1] > MAP_TTL) delete ipmap[ip];

	const macs = localIps();
	let cur = {}, acc = rjson(RUN + '/acc.json', {});
	let mt = {};   // bu dakika: mac -> [indirme, yükleme, bağlantı sayısı, {servis: bayt}]
	const today = day(NOW);
	if (meta.day && meta.day != today) { flush(meta.day, acc); acc = {}; }
	meta.day = today;

	for (let l in split(fs.readfile(CT) ?? '', '\n')) {
		if (!length(l)) continue;
		const f = split(l, /\s+/);
		const proto = f[2];
		let src, dst, sport, dport, b = [];
		for (let tok in f) {
			const kv = split(tok, '=', 2);
			if (length(kv) != 2) continue;
			if (kv[0] == 'src' && src == null) src = kv[1];
			else if (kv[0] == 'dst' && dst == null) dst = kv[1];
			else if (kv[0] == 'sport' && sport == null) sport = kv[1];
			else if (kv[0] == 'dport' && dport == null) dport = kv[1];
			else if (kv[0] == 'bytes') push(b, int(kv[1]));
		}
		const mac = macs[src];
		if (!mac || length(b) < 2 || macs[dst]) continue;   // yalnız yerel cihaz -> internet
		const key = join('|', [proto, src, dst, sport, dport]);
		cur[key] = b;
		const m = (mt[mac] ??= [0, 0, 0, {}]);
		m[2]++;
		const p = prev[key] ?? [0, 0];
		let up = b[0] - p[0], down = b[1] - p[1];
		if (up < 0 || down < 0) { up = b[0]; down = b[1]; }   // aynı anahtarla yeni bağlantı
		if (first || up + down == 0) continue;
		const svc = ipmap[dst]?.[0] ?? portGuess(proto, dport);
		m[0] += down; m[1] += up; m[3][svc] = (m[3][svc] ?? 0) + down + up;
		const d = (acc[mac] ??= {});
		const r = (d[svc] ??= [0, 0]);
		r[0] += down; r[1] += up;
	}
	wjson(RUN + '/ct.json', cur);
	wjson(RUN + '/ipmap.json', ipmap);
	if (!first) detect(mt, NOW - (meta.last ?? (NOW - 60)));
	meta.last = NOW;
	// /etc'ye 5 dakikada bir yaz (flash yıpranmasın); ara toplam /tmp'de
	if (NOW - (meta.flushed ?? 0) >= 300) { flush(today, acc); acc = {}; meta.flushed = NOW; }
	wjson(RUN + '/acc.json', acc);
	wjson(RUN + '/meta.json', meta);
	// 100 günden eski dosyaları sil
	for (let f in (fs.lsdir(DATA) ?? [])) {
		const m = match(f, /^(\d{4})-(\d{2})-(\d{2})\.json$/);
		if (m && NOW - timelocal({ year: int(m[1]), mon: int(m[2]), mday: int(m[3]), hour: 0, min: 0, sec: 0 }) > 100 * 86400) fs.unlink(DATA + '/' + f);
	}
}

function get() {
	const a = input();
	const days = min(max(int(a.days ?? 7), 1), 100), only = lc('' + (a.mac ?? ''));
	let tot = {}, dev = {};
	const add = (m, s, r) => {
		const t = (tot[s] ??= [0, 0]); t[0] += r[0]; t[1] += r[1];
		const d = ((dev[m] ??= {})[s] ??= [0, 0]); d[0] += r[0]; d[1] += r[1];
	};
	for (let i = 0; i < days; i++) {
		const d = day(NOW - i * 86400);
		let f = rjson(DATA + '/' + d + '.json', {});
		if (i == 0) {   // bugünün henüz /etc'ye yazılmamış kısmı
			const meta = rjson(RUN + '/meta.json', {});
			if (meta.day == d) {
				const acc = rjson(RUN + '/acc.json', {});
				for (let m in acc) for (let s in acc[m]) {
					const r = ((f[m] ??= {})[s] ??= [0, 0]); r[0] += acc[m][s][0]; r[1] += acc[m][s][1];
				}
			}
		}
		for (let m in f) if (!only || m == only) for (let s in f[m]) add(m, s, f[m][s]);
	}
	const list = (o, n) => slice(sort(map(keys(o), (s) => ({ name: s, down: o[s][0], up: o[s][1] })), (x, y) => (y.down + y.up) - (x.down + x.up)), 0, n);
	let devices = {};
	for (let m in dev) devices[m] = list(dev[m], 8);
	out({ source: rjson(RUN + '/meta.json', {}).source ?? 'ports', services: list(tot, 30), devices: devices });
}

switch (ARGV[0]) {
case 'collect': collect(); break;
case 'get': get(); break;
case 'heavy': heavyList(); break;
default: out({ ok: false, error: 'collect | get' });
}
