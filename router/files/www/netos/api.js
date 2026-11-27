/*
 * NetPanel — veri katmanı (OpenWrt ubus JSON-RPC)
 * Görünümden tamamen bağımsızdır; arayüz yalnızca window.NetPanel'i kullanır.
 *
 * Sahte veri (mock) modu: file:// ile açıldığında, localhost'ta veya URL'de ?mock=1 varsa
 * router olmadan gerçekçi örnek verilerle çalışır (giriş: herhangi bir şifre).
 *
 * ── Dışa açılan API ────────────────────────────────────────────────────────────
 * NetPanel.isMock                         : boolean
 * NetPanel.on('auth', fn)                  : oturum düştüğünde çağrılır -> giriş ekranını göster
 * NetPanel.hasSession()                    : boolean
 * NetPanel.login(user, pass)               : Promise<void>   (hata: ApiError code 'badpass')
 * NetPanel.logout()                        : Promise<void>
 * NetPanel.getOverview()                   : Promise<Overview>
 * NetPanel.getNetworks()                   : Promise<{ interfaces: Iface[], wifi: Wifi[] }>
 * NetPanel.getClients()                    : Promise<Client[]>
 * NetPanel.getTraffic()                    : Promise<Traffic>
 * NetPanel.getStatus()                     : Promise<{ offload, offloadHw, table, counters }>
 * NetPanel.setClient(mac, patch)           : Promise<void>
 *      patch: { name?, static?: bool, ip?, limitDown?: Mbit (0=yok), limitUp?: Mbit, blocked?: bool }
 * NetPanel.forgetClient(mac)               : Promise<void>
 * NetPanel.setWifi(section, patch)         : Promise<void>   patch: { ssid?, key?, enabled?: bool }
 * NetPanel.reboot()                        : Promise<void>
 *
 * ── 1. aşama eklemeleri ──
 * Overview.wans                           : Wan[] (multiwan; birincil = wans[0] = Overview.wan)
 * Wan  = { name, label, up, online, status, proto, protoLabel, ip, gateway, dns[], uptime, device,
 *          metric, cgnat (operatör NAT'ı arkasında mı), tracking:{ lost, score, targets[] }|null }
 * Traffic.perWan                          : { <wanAdı>: { down, up } }  (bit/s)
 * NetPanel.getWans()                      : Promise<Wan[]>
 * NetPanel.getSystem()                    : Promise<{ model, cores, cpu(%), cpuEstimated, load[3],
 *                                             memory:{total,used,percent}, disk:{total,used,percent},
 *                                             temp(°C|null), uptime }>   — CPU% iki çağrı arasından
 *                                             hesaplanır; ~3 sn'de bir çağır.
 * NetPanel.changePassword(old, new)       : Promise<void>  (root/panel şifresi; SSH ve LuCI de değişir)
 * NetPanel.scanWeb()                      : Promise<void>  (web arayüzü taramasını hemen başlat)
 * NetPanel.TYPES                          : { phone:'Telefon', pc:'Bilgisayar', console:'Oyun konsolu', ... }
 * Client ek alanları: type, typeAuto, vendor, via('router'|'huawei'), band('2g'|'5g'|''),
 *          connLabel ('Ethernet' | 'Wi-Fi 5 GHz'), web: url[], staticPending (sabit IP kaydedildi ama
 *          cihaz henüz eski IP'de — yeniden bağlanınca geçer)
 * setClient patch ek: type ('' = otomatik tahmin)
 *
 * ── 2. aşama: internet ayarları ──
 * NetPanel.getWanConfig()                 : Promise<{ mode, modeLabel, primary, mwan3, members[],
 *          pendingUntil (ms|null — onay bekleyen değişiklik var), wans: [{ name, proto, protoLabel,
 *          enabled, device, baseDevice, vlan, mtu, metric, username, passwordSet, ipaddr, netmask,
 *          gateway, peerdns, dns[], mwan }] }>
 * NetPanel.setWan(name, patch)            : Promise<{ changed, pendingUntil }>
 *      patch: { proto:'pppoe'|'dhcp'|'static', username, password ('' = değiştirme), vlan (0=yok),
 *               dns ('1.1.1.1, 8.8.8.8' | '' = operatörden), mtu (0 = varsayılan), ipaddr, netmask,
 *               gateway, enabled }
 * NetPanel.setWanMode(mode, primary, weights?) : Promise<{ pendingUntil }>
 *      mode: 'balanced' (yük dengeleme) | 'failover' (yedek hat) | 'single' (tek hat)
 * GERİ ALMA: setWan/setWanMode sonrası değişiklik ~120 sn içinde NetPanel.confirmWan() ile onaylanmazsa
 *      router eski ayarlara otomatik döner. NetPanel.revertWan() hemen geri alır. Arayüz geri sayım
 *      gösterip "Çalışıyor, onayla" / "Geri al" sunmalı; getWanConfig().pendingUntil sayfa yenilense de
 *      bekleyen durumu verir.
 * NetPanel.reconnectWan(name)             : Promise<void>  (hattı koparıp yeniden bağlar)
 * NetPanel.getWanEvents()                 : Promise<[{ t(ms), iface, event, label, level:'ok'|'bad'|'info'|'warn' }]>
 * NetPanel.MODE_LABELS                    : { balanced:'Yük dengeleme', failover:'Yedek hat', single:'Tek hat' }
 *
 * ── 3. aşama: hız testi, bufferbloat, SQM, oyun önceliği ──
 * NetPanel.startSpeedtest(wan?, mode?, server?) : Promise<void>  testi router'da başlatır (hat başına ~25 sn)
 *      server: NetPanel.SPEED_SERVERS[].id (varsayılan TurkNet İstanbul; seçilen sunucu router'da hatırlanır).
 *      current.server / current.serverLabel = testin yapıldığı sunucu.
 *      mode: 'single' (varsayılan) | 'sequential' (tüm hatlar sırayla, karşılaştırma) | 'combined' (tüm
 *      hatlar aynı anda = multiwan toplam kapasitesi). current.runs = hat başına sonuçlar
 *      [{ wan, down, up, idleMs, downMs, upMs, grade, increaseMs, gradeText, error }]; current.mode.
 *      sequential bitince üst düzey down/up = hatların toplamı, grade = en kötü hat notu.
 *      combined: grade genel (birincil hat gecikmesiyle), runs[].grade = null.
 *      Canlı gösterim için: current.direction ('download'|'upload'|null), current.phaseLabel ("İndirme testi" vb.),
 *      current.liveMbit (o an ölçülen yönün hızı), current.step / current.totalWans (sırayla: "1/2").
 *      SQM önerisi (recommendDownMbit) yalnız 'single' testte verilir (her hattın kendi SQM'i için).
 * NetPanel.getSpeedtest()                 : Promise<{ current, history[] }>  ~1 sn'de bir çağır
 *      current = { running, phase:'starting'|'idle'|'download'|'upload'|'done'|'error', progress(0-100),
 *        wan, down, up (Mbit/s; test sırasında canlı), idleMs, downMs, upMs (gecikme medyanı),
 *        jitterMs, grade ('A+'..'F'), increaseMs, gradeText, recommendDownMbit, recommendUpMbit, error, t }
 *      history = [{ t, wan, down, up, idleMs, downMs, upMs, grade, mode }]  en yeni önce
 * NetPanel.getSqm()                       : Promise<{ installed, offload, offloadHw, scripts:[{id,label}],
 *        wans:[{name, device, l3Device}], queues:[{ section, enabled, active, interface, wan,
 *        downloadMbit, uploadMbit, script, scriptLabel, linklayer, overhead, gaming }] }>
 * NetPanel.setSqm(section|'', patch)      : patch { interface, enabled, downloadMbit, uploadMbit, script,
 *                                            linklayer:'none'|'ethernet'|'atm', overhead }
 * NetPanel.deleteSqm(section) / setOffload(enabled)
 * NetPanel.SQM_PRESETS                    : { fiber_pppoe:{label, linklayer, overhead}, ... }
 * Client.priority + setClient(mac, { priority: true }) : oyun önceliği. Etkili olması için SQM betiği
 *      'layer_cake.qos' (queue.gaming=true) ve flow offloading KAPALI olmalı; değilse arayüz uyarmalı.
 *
 * ── 4. aşama: Huawei Wi-Fi ayarları ──
 * NetPanel.getHuaweiWifi()                : Promise<{ dbho, bands:[{ band, bandLabel, ssid, enabled, security,
 *        securityLabel, open, channel (0=otomatik), actualChannel, auto, hidden, standard, bandwidth, channels[] }] }>
 * NetPanel.saveHuaweiWifi(band, patch)    : band '2g'|'5g'|'both'; patch { ssid, password ('' = değiştirme),
 *        channel (0 = otomatik), hidden }. Kaydedince Huawei Wi-Fi'yi yeniden başlatır: o banda bağlı cihazlar
 *        birkaç saniye kopar (arayüz kaydetmeden önce uyarmalı). dbho=true iken ad/şifre iki banda birlikte gider.
 * NetPanel.scanHuaweiChannels(current?)   : Promise<{ networks:[{ ssid, channel, signal, band }],
 *        recommend: { '2g': { channel, reason, load:{1:..,6:..,11:..} }, '5g': { channel, reason, dfs, load } } }>
 *        (~10 sn sürer; current = { '2g': şu anki kanal, '5g': ... } öneriyle karşılaştırma için)
 *
 * ── Ekler (Keenetic tarzı) ──
 * NetPanel.getUsage(days=31)       : günlük/aylık trafik  { days[], devices[], wan{} }  (bayt; rx=indirme)
 * NetPanel.getPingHistory(hours=24): { wans: { ad: { samples[{t,avg,loss}], avg, max, lossPct, outages } } }
 * NetPanel.getNewDevices() / ackNewDevices()  : { blockNew, items[{t,mac,ip,hostname,unseen}], unseenCount }
 * NetPanel.getNotify() / setNotify(patch) / testNotify()  : Telegram (token geri okunamaz)
 * NetPanel.getTimezone() / setTimezone(zone) / TIMEZONES  : saat planı için saat dilimi doğru olmalı
 * NetPanel.downloadBackup() / restoreBackup(file)          : OpenWrt ayar yedeği (geri yükleme yeniden başlatır)
 * NetPanel.getTunnel() / setTunnelToken(t) / setTunnelEnabled(b) / cfLookup(apiToken) / cfPublish(opts) / cfUnpublish
 * Client.schedule [{days, from, to, label, overnight}], Client.schedBlocked; setClient(mac, { schedule: [...] })
 *
 * Harici Huawei Wi-Fi (OpenWrt'nin kendi Wi-Fi'si yoksa Wi-Fi buradan yönetilir):
 * NetPanel.getHuawei()                     : Promise<Huawei>
 * NetPanel.setHuaweiWifi(band, enabled)    : Promise<void>   band: '2g' | '5g'
 * NetPanel.setHuaweiConfig(patch)          : Promise<void>   patch: { enabled?, host?, username?, password? }
 *      password boş bırakılırsa eskisi korunur; şifre hiçbir zaman geri okunamaz.
 * Huawei   = { enabled, host, username, passwordSet, connected, error, dbho,
 *              radios:[{ band, bandLabel, enabled, ssid }], clients }
 *      dbho=true: Huawei "çift bant tek ağ" modunda, 2,4 ve 5 GHz birlikte açılıp kapanır
 *      (arayüz tek anahtar göstermeli).
 * NetPanel.live(cb, ms = 2000)             : stop()  — cb({ clients, traffic, error })
 * NetPanel.fmt.bits(bps) / bytes(n) / uptime(sec) / bars(dBm) / band(b)
 * NetPanel.validate.ip(s) / inSubnet(ip, cidr) / name(s) / ssid(s) / wifiKey(s)
 *
 * Overview = { hostname, model, firmware, kernel, uptime, load:[1,5,15],
 *              memory:{ total, used, percent }, wan: Wan|null }
 * Wan      = { up, proto, ip, gateway, dns:[], uptime, device }
 * Iface    = { name, label, up, proto, device, ip, cidr, uptime, isWan, clients }
 * Wifi     = { section, ssid, key, encryption, band, bandLabel, channel, radio,
 *              enabled, up, ifname, network, clients }
 * Client   = { mac, ip, name, displayName, hostname, online, conn:'wifi'|'lan', ssid, signal,
 *              bars(0-4), iface, static, staticIp, limitDown, limitUp, blocked,
 *              down (bit/s), up (bit/s), rxBytes, txBytes, wifiDev, leaseExpires }
 * Traffic  = { down, up (bit/s), rxBytes, txBytes, history:[{ t, down, up }] (son 60 örnek) }
 */
(function (global) {
  'use strict';

  const NULL_SID = '00000000000000000000000000000000';
  const MOCK =
    location.protocol === 'file:' ||
    /[?&]mock=1\b/.test(location.search) ||
    ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

  class ApiError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
    }
  }

  const UBUS_ERR = {
    1: 'Geçersiz komut', 2: 'Geçersiz parametre', 3: 'Metot bulunamadı (eklenti kurulu mu?)',
    4: 'Bulunamadı', 5: 'Veri yok', 6: 'Yetki yok', 7: 'Zaman aşımı', 8: 'Desteklenmiyor',
    9: 'Bilinmeyen hata', 10: 'Bağlantı hatası',
  };

  /* ── oturum ─────────────────────────────────────────────────────────────── */
  const store = {
    get() { try { return sessionStorage.getItem('np_sid'); } catch (e) { return null; } },
    set(v) { try { v ? sessionStorage.setItem('np_sid', v) : sessionStorage.removeItem('np_sid'); } catch (e) { /* yok say */ } },
  };
  let sid = store.get();
  const listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev, data) { (listeners[ev] || []).forEach((f) => { try { f(data); } catch (e) { console.error(e); } }); }
  function dropSession() { sid = null; store.set(null); emit('auth'); }

  /* ── ubus çağrısı ───────────────────────────────────────────────────────── */
  let rpcId = 0;
  async function ubus(obj, method, args = {}, opts = {}) {
    const s = opts.anon ? NULL_SID : sid;
    if (!s) { emit('auth'); throw new ApiError('Oturum açılmadı', 'auth'); }
    if (MOCK) return mock.call(obj, method, args);

    let res;
    try {
      res = await fetch('/ubus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'call', params: [s, obj, method, args] }),
      });
    } catch (e) {
      throw new ApiError('Router\'a ulaşılamıyor', 'network');
    }
    if (!res.ok) throw new ApiError('HTTP ' + res.status, 'http');
    const j = await res.json();
    if (j.error) {
      if (j.error.code === -32002 && !opts.anon) { dropSession(); throw new ApiError('Oturum süresi doldu', 'auth'); }
      throw new ApiError(j.error.message || 'RPC hatası', j.error.code);
    }
    const [code, data] = j.result || [9];
    if (code === 6 && !opts.anon) { dropSession(); throw new ApiError('Oturum süresi doldu', 'auth'); }
    if (code !== 0) throw new ApiError(UBUS_ERR[code] || 'ubus hatası ' + code, code);
    return data || {};
  }

  // netpanel eklentisi {ok:false,error} döndürürse hataya çevir
  async function npCall(method, args) {
    const r = await ubus('netpanel', method, args);
    if (r && r.ok === false) throw new ApiError(r.error || 'İşlem başarısız', 'netpanel');
    return r;
  }

  async function login(username, password) {
    let d;
    try {
      d = await ubus('session', 'login', { username: username || 'root', password: password || '' }, { anon: true });
    } catch (e) {
      if (e.code === 6) throw new ApiError('Kullanıcı adı veya şifre hatalı', 'badpass');
      throw e;
    }
    if (!d.ubus_rpc_session) throw new ApiError('Kullanıcı adı veya şifre hatalı', 'badpass');
    sid = d.ubus_rpc_session;
    store.set(sid);
  }

  async function logout() {
    if (sid) await ubus('session', 'destroy', {}).catch(() => {});
    sid = null;
    store.set(null);
  }

  /* ── yardımcılar ────────────────────────────────────────────────────────── */
  const IFACE_LABELS = { lan: 'Ev ağı', guest: 'Misafir ağı', wan: 'İnternet', wan6: 'İnternet (IPv6)', iot: 'Akıllı cihazlar' };

  function firstV4(i) {
    const a = (i['ipv4-address'] || [])[0];
    return a ? { ip: a.address, cidr: a.address + '/' + a.mask } : { ip: '', cidr: '' };
  }

  function isWanIface(i) {
    return (i.route || []).some((r) => r.target === '0.0.0.0' && r.mask === 0) || /^wan/.test(i.interface);
  }

  let ifaceCache = { t: 0, list: [] };
  async function ifaceDump(force) {
    if (!force && Date.now() - ifaceCache.t < 15000) return ifaceCache.list;
    const d = await ubus('network.interface', 'dump');
    ifaceCache = { t: Date.now(), list: (d.interface || []).filter((i) => i.interface !== 'loopback') };
    return ifaceCache.list;
  }

  /* ── WAN'lar (multiwan: firewall "wan" bölgesi + mwan3 durumu) ─────────── */
  const PROTO_LABELS = { pppoe: 'PPPoE', dhcp: 'DHCP', static: 'Statik IP', dhcpv6: 'DHCPv6', '3g': '3G', qmi: 'LTE', wireguard: 'WireGuard' };
  const isCgnat = (ip) => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip || '');
  let wanCache = [];

  async function getWans(list) {
    list = list || await ifaceDump();
    const [fw, mw] = await Promise.all([
      ubus('uci', 'get', { config: 'firewall' }).catch(() => ({ values: {} })),
      ubus('mwan3', 'status', { section: 'interfaces' }).catch(() => null),
    ]);
    const nets = new Set();
    Object.values(fw.values || {}).forEach((z) => {
      if (z['.type'] === 'zone' && z.name === 'wan') [].concat(z.network || []).forEach((n) => nets.add(n));
    });
    const mwi = (mw && mw.interfaces) || {};
    const wans = list
      .filter((i) => (nets.size ? nets.has(i.interface) : isWanIface(i)))
      .map((i) => {
        const v4 = firstV4(i);
        const a0 = (i['ipv4-address'] || [])[0] || {};
        const gw = (i.route || []).find((r) => r.target === '0.0.0.0' && r.mask === 0);
        const t = mwi[i.interface];
        const online = t ? t.status === 'online' : !!i.up && !!v4.ip;
        return {
          name: i.interface,
          label: i.interface,
          up: !!i.up,
          online,
          status: t ? t.status : (i.up ? 'online' : 'offline'), // online | offline | disabled | ...
          proto: i.proto,
          protoLabel: PROTO_LABELS[i.proto] || i.proto,
          ip: v4.ip,
          gateway: gw ? gw.nexthop : (a0.ptpaddress || ''),
          dns: i['dns-server'] || [],
          uptime: i.uptime || 0,
          device: i.l3_device || i.device || '',
          metric: i.metric || 0,
          cgnat: isCgnat(v4.ip),
          tracking: t ? { lost: t.lost || 0, score: t.score || 0, onlineSec: t.online || 0, offlineSec: t.offline || 0,
            targets: (t.track_ip || []).map((x) => ({ ip: x.ip, status: x.status, latency: x.latency, loss: x.packetloss })) } : null,
        };
      })
      .sort((a, b) => (b.online - a.online) || (a.metric - b.metric));
    wanCache = wans;
    return wans;
  }

  /* ── özet ───────────────────────────────────────────────────────────────── */
  async function getOverview() {
    const [board, info, list] = await Promise.all([
      ubus('system', 'board'), ubus('system', 'info'), ifaceDump(true),
    ]);
    const m = info.memory || {};
    const avail = m.available != null ? m.available : (m.free || 0) + (m.buffered || 0) + (m.cached || 0);
    const used = Math.max(0, (m.total || 0) - avail);
    const wans = await getWans(list);
    const wan = wans[0] || null; // birincil (çevrimiçi, en düşük metric)
    return {
      wans,
      hostname: board.hostname || 'OpenWrt',
      model: board.model || '',
      firmware: (board.release && board.release.description) || '',
      kernel: board.kernel || '',
      uptime: info.uptime || 0,
      load: (info.load || [0, 0, 0]).map((l) => +(l / 65536).toFixed(2)),
      memory: { total: m.total || 0, used, percent: m.total ? Math.round((used / m.total) * 100) : 0 },
      wan,
    };
  }

  /* ── Wi-Fi ──────────────────────────────────────────────────────────────── */
  function bandOf(dev) {
    if (dev.band) return dev.band; // 2g / 5g / 6g / 60g
    if (/a/.test(dev.hwmode || '')) return '5g';
    const ch = +dev.channel;
    return ch > 14 ? '5g' : '2g';
  }

  async function getWifi(clients) {
    const [cfg, st] = await Promise.all([
      ubus('uci', 'get', { config: 'wireless' }).catch(() => ({ values: {} })),
      ubus('network.wireless', 'status').catch(() => ({})),
    ]);
    const v = cfg.values || {};
    const radios = {};
    Object.values(v).filter((s) => s['.type'] === 'wifi-device').forEach((r) => { radios[r['.name']] = r; });
    const out = [];
    Object.values(v)
      .filter((s) => s['.type'] === 'wifi-iface' && (s.mode || 'ap') === 'ap')
      .forEach((s) => {
        const radio = radios[s.device] || {};
        const rst = st[s.device] || {};
        const ist = (rst.interfaces || []).find((x) => x.section === s['.name']) || {};
        const band = bandOf(radio);
        const ifname = ist.ifname || '';
        out.push({
          section: s['.name'],
          ssid: s.ssid || '',
          key: s.key || '',
          encryption: s.encryption || 'none',
          band,
          bandLabel: fmt.band(band),
          channel: radio.channel || 'auto',
          radio: s.device,
          enabled: s.disabled !== '1' && radio.disabled !== '1',
          up: !!rst.up && !!ifname,
          ifname,
          network: [].concat(s.network || []).join(' '),
          clients: clients ? clients.filter((c) => c.online && c.conn === 'wifi' && c.wifiDev === ifname).length : 0,
        });
      });
    return out.sort((a, b) => a.band.localeCompare(b.band) || a.ssid.localeCompare(b.ssid));
  }

  async function setWifi(section, patch) {
    const a = { section };
    if (patch.ssid != null) a.ssid = String(patch.ssid);
    if (patch.key != null) a.key = String(patch.key);
    if (patch.enabled != null) a.disabled = !patch.enabled;
    await npCall('set_wifi', a);
  }

  /* ── ağlar ──────────────────────────────────────────────────────────────── */
  async function getNetworks() {
    const [list, clients] = await Promise.all([ifaceDump(true), getClients().catch(() => [])]);
    const interfaces = list.map((i) => {
      const v4 = firstV4(i);
      return {
        name: i.interface,
        label: IFACE_LABELS[i.interface] || i.interface,
        up: !!i.up,
        proto: i.proto,
        device: i.l3_device || i.device || '',
        ip: v4.ip,
        cidr: v4.cidr,
        uptime: i.uptime || 0,
        isWan: isWanIface(i),
        clients: clients.filter((c) => c.online && c.iface === i.interface).length,
      };
    });
    const wifi = await getWifi(clients);
    return { interfaces, wifi };
  }

  /* ── cihazlar ───────────────────────────────────────────────────────────── */
  const prevCounters = new Map(); // mac -> { rx, tx, t }

  async function getClients() {
    const [d, list] = await Promise.all([npCall('clients', {}), ifaceDump()]);
    const devToIface = {};
    list.forEach((i) => { if (i.l3_device) devToIface[i.l3_device] = i.interface; });
    const now = performance.now();
    const out = (d.clients || []).map((c) => {
      const p = prevCounters.get(c.mac);
      let down = 0, up = 0;
      if (p && now > p.t) {
        const dt = (now - p.t) / 1000;
        down = Math.max(0, ((c.rx_bytes - p.rx) * 8) / dt);
        up = Math.max(0, ((c.tx_bytes - p.tx) * 8) / dt);
      }
      prevCounters.set(c.mac, { rx: c.rx_bytes, tx: c.tx_bytes, t: now });
      const name = c.name || '';
      const autoType = guessType(c);
      return {
        mac: c.mac,
        ip: c.ip,
        name,
        hostname: c.hostname || '',
        displayName: name || c.hostname || c.mac.toUpperCase(),
        online: c.online || down > 0 || up > 0,
        type: c.type || autoType,          // ikon için cihaz tipi (TYPES anahtarlarından biri)
        typeAuto: !c.type,                 // true: tahmin edildi, kullanıcı seçmedi
        vendor: c.vendor || '',
        via: c.via || 'router',            // 'router' (OpenWrt'ye doğrudan) | 'huawei' (Huawei AP üzerinden)
        band: c.band || '',                // Wi-Fi ise '2g' | '5g'
        connLabel: c.conn === 'wifi' ? ('Wi-Fi' + (c.band ? ' ' + fmt.band(c.band) : '')) : 'Ethernet',
        web: c.web || [],                  // açılabilir web arayüzleri (url listesi)
        priority: !!c.priority,            // oyun önceliği (giden trafik EF/Voice)
        presence: !!c.presence,            // eve geldi / ayrıldı bildirimi
        schedule: (c.schedule || []).map(parseSchedule).filter(Boolean), // [{ days:[1..7], from, to }]
        schedBlocked: !!c.sched_blocked,   // şu an saat planı yüzünden internetsiz
        staticPending: !!c.static && !!c.ip && !!c.static_ip && c.ip !== c.static_ip,
        conn: c.conn,
        wifiDev: c.wifi_dev || '',
        ssid: c.ssid || '',
        signal: c.signal,
        bars: fmt.bars(c.signal),
        iface: devToIface[c.dev] || (c.dev ? c.dev : ''),
        static: !!c.static,
        staticIp: c.static_ip || '',
        limitDown: c.limit_down || 0,
        limitUp: c.limit_up || 0,
        blocked: !!c.blocked,
        down, up,
        rxBytes: c.rx_bytes || 0,
        txBytes: c.tx_bytes || 0,
        leaseExpires: c.lease_expires || 0,
      };
    });
    return out.sort((a, b) =>
      (b.online - a.online) || a.displayName.localeCompare(b.displayName, 'tr', { sensitivity: 'base' }));
  }

  async function setClient(mac, patch) {
    const a = { mac };
    if (patch.name != null) {
      const n = String(patch.name).trim();
      if (!validate.name(n)) throw new ApiError('İsim en fazla 32 karakter olabilir', 'validate');
      a.name = n;
    }
    if (patch.static != null) {
      a.static = !!patch.static;
      if (a.static) {
        if (!validate.ip(patch.ip)) throw new ApiError('Geçerli bir IP adresi girin', 'validate');
        a.ip = patch.ip;
      }
    }
    for (const [k, arg] of [['limitDown', 'down'], ['limitUp', 'up']]) {
      if (patch[k] != null) {
        const v = Math.round(Number(patch[k]) || 0);
        if (v < 0 || v > 10000) throw new ApiError('Hız sınırı 0-10000 Mbit/s arası olmalı', 'validate');
        a[arg] = v;
      }
    }
    if (patch.blocked != null) a.blocked = !!patch.blocked;
    if (patch.priority != null) a.priority = !!patch.priority;
    if (patch.presence != null) a.presence = !!patch.presence;
    if (patch.schedule != null) {
      if (patch.schedule.length > 8) throw new ApiError('En fazla 8 plan eklenebilir', 'validate');
      a.schedule = patch.schedule.map((r) => {
        const days = [...new Set(r.days || [])].filter((d) => d >= 1 && d <= 7).sort();
        if (!days.length) throw new ApiError('Plan için en az bir gün seçin', 'validate');
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.from) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.to)) throw new ApiError('Saat SS:DD biçiminde olmalı', 'validate');
        if (r.from === r.to) throw new ApiError('Başlangıç ve bitiş saati aynı olamaz', 'validate');
        return days.join('') + '|' + r.from + '|' + r.to;
      });
    }
    if (patch.type !== undefined) {
      const t = patch.type || '';
      if (t && !TYPES[t]) throw new ApiError('Geçersiz cihaz tipi', 'validate');
      a.type = t; // '' = otomatik tahmine dön
    }
    await npCall('set_client', a);
  }

  /* ── cihaz tipleri ──────────────────────────────────────────────────────── */
  const TYPES = {
    phone: 'Telefon', tablet: 'Tablet', laptop: 'Dizüstü', pc: 'Bilgisayar', console: 'Oyun konsolu',
    tv: 'TV / Medya', nas: 'NAS', server: 'Sunucu', router: 'Modem / Router', ap: 'Erişim noktası',
    printer: 'Yazıcı', camera: 'Kamera', speaker: 'Hoparlör', watch: 'Saat', iot: 'Akıllı cihaz', other: 'Diğer',
  };
  const TYPE_RULES = [
    ['console', /playstation|\bps[345]\b|ps5|ps4|xbox|nintendo|switch-?\d|steamdeck|steam-deck/i],
    ['tablet', /ipad|tablet|\btab\b|galaxy-?tab|matepad|mipad/i],
    ['phone', /iphone|android|galaxy|redmi|xiaomi|poco|pixel|oneplus|oppo|vivo|realme|honor|huawei-?(p|mate|nova)|\bsm-[a-z]\d|phone|telefon|sip-t\d|yealink|gigaset/i],
    ['laptop', /macbook|laptop|notebook|thinkpad|ideapad|vivobook|zenbook|latitude|xps|surface/i],
    ['tv', /\btv\b|-tv|tv-|webos|tizen|bravia|chromecast|roku|fire-?tv|mibox|shield|appletv|apple-tv/i],
    ['nas', /\bnas\b|diskstation|synology|qnap|truenas|unraid/i],
    ['server', /proxmox|\bpve\b|casaos|umbrel|docker|server|raspberry|raspberrypi|ubuntu|debian|homeassistant|home-assistant/i],
    ['printer', /printer|epson|canon|brother|\bhp[a-z0-9-]*\b|laserjet|officejet/i],
    ['camera', /\bcam\b|camera|ipc|hikvision|dahua|ezviz|tapo-?c|reolink|imou/i],
    ['speaker', /echo|alexa|homepod|sonos|nest-?(mini|audio|hub)|google-?home/i],
    ['watch', /watch/i],
    ['ap', /huawei.*(ax\d|ws\d)|wifi-?ax|access-?point|\bap-|mesh|deco|eero/i],
    ['router', /router|modem|archer|tp-?link|keenetic|zyxel|fritz/i],
    ['iot', /esp[-_]?\d|esp32|lwip\d|zhimi|airpurifier|broadlink|roborock|roomba|tuya|shelly|tasmota|yeelight|thermostat|nest|smart-?plug|sonoff|tapo-?p|hue/i],
    ['pc', /desktop|\bpc\b|-pc|pc-|win-|windows|imac|workstation/i],
  ];
  function guessType(c) {
    const s = [c.name, c.hostname, c.vendor].filter(Boolean).join(' ');
    for (const [t, re] of TYPE_RULES) if (re.test(s)) return t;
    return 'other';
  }

  async function forgetClient(mac) { await npCall('forget_client', { mac }); }

  /* ── trafik (WAN) ───────────────────────────────────────────────────────── */
  const history = [];
  let prevWan = null;

  // Tüm WAN cihazlarının toplamı + WAN başına hız (perWan: { Turknet: {down, up}, ... })
  async function getTraffic() {
    const wans = wanCache.length ? wanCache : await getWans();
    const devs = wans.filter((w) => w.device);
    if (!devs.length) return { down: 0, up: 0, rxBytes: 0, txBytes: 0, perWan: {}, history: history.slice() };
    const stats = await Promise.all(devs.map((w) =>
      ubus('network.device', 'status', { name: w.device }).then((s) => s.statistics || {}).catch(() => ({}))));
    const now = performance.now();
    const cur = {};
    let rx = 0, tx = 0;
    devs.forEach((w, i) => { cur[w.name] = { rx: stats[i].rx_bytes || 0, tx: stats[i].tx_bytes || 0 }; rx += cur[w.name].rx; tx += cur[w.name].tx; });
    const perWan = {};
    let down = 0, up = 0;
    if (prevWan && now > prevWan.t) {
      const dt = (now - prevWan.t) / 1000;
      Object.keys(cur).forEach((n) => {
        const p = prevWan.cur[n];
        const d = p ? Math.max(0, ((cur[n].rx - p.rx) * 8) / dt) : 0;
        const u = p ? Math.max(0, ((cur[n].tx - p.tx) * 8) / dt) : 0;
        perWan[n] = { down: d, up: u };
        down += d; up += u;
      });
      history.push({ t: Date.now(), down, up });
      if (history.length > 60) history.shift();
    }
    prevWan = { cur, t: now };
    return { down, up, rxBytes: rx, txBytes: tx, perWan, history: history.slice() };
  }

  /* ── sistem ─────────────────────────────────────────────────────────────── */
  let prevCpu = null;
  async function getSystem() {
    const [s, info] = await Promise.all([ubus('netpanel', 'sysinfo'), ubus('system', 'info')]);
    const cores = s.cores || 1;
    const load = (info.load || [0, 0, 0]).map((l) => +(l / 65536).toFixed(2));
    let cpu, cpuEstimated = false;
    if (prevCpu && s.cpu && s.cpu.total > prevCpu.total) {
      cpu = Math.round(100 * (1 - (s.cpu.idle - prevCpu.idle) / (s.cpu.total - prevCpu.total)));
    } else {
      cpu = Math.min(100, Math.round((load[0] / cores) * 100)); // ilk ölçüm: yük ortalamasından tahmin
      cpuEstimated = true;
    }
    prevCpu = s.cpu || null;
    const m = info.memory || {};
    const avail = m.available != null ? m.available : (m.free || 0) + (m.buffered || 0) + (m.cached || 0);
    const used = Math.max(0, (m.total || 0) - avail);
    const d = s.disk || {};
    return {
      model: s.model || '', cores, cpu: Math.max(0, Math.min(100, cpu)), cpuEstimated, load,
      memory: { total: m.total || 0, used, percent: m.total ? Math.round((used / m.total) * 100) : 0 },
      disk: { total: d.total || 0, used: d.used || 0, percent: d.total ? Math.round((d.used / d.total) * 100) : 0 },
      temp: s.temp != null ? s.temp : null,
      uptime: info.uptime || 0,
    };
  }

  async function changePassword(oldPass, newPass) {
    if (String(newPass || '').length < 8) throw new ApiError('Yeni şifre en az 8 karakter olmalı', 'validate');
    await npCall('set_password', { old: String(oldPass || ''), new: String(newPass) });
  }

  async function scanWeb() { await npCall('web_scan', {}); }

  /* ── 2. aşama: internet ayarları ────────────────────────────────────────── */
  let wanSkew = 0;
  const MODE_LABELS = { balanced: 'Yük dengeleme', failover: 'Yedek hat', single: 'Tek hat', custom: 'Özel (LuCI)' };

  async function getWanConfig() {
    const c = await ubus('netpanel', 'wan_config');
    const skew = c.now ? Date.now() - c.now * 1000 : 0; // router saati farkı
    wanSkew = skew;
    return {
      mode: c.mode || 'custom',
      modeLabel: MODE_LABELS[c.mode] || c.mode,
      primary: c.primary || '',
      policy: c.policy || '',
      mwan3: !!c.mwan3,
      members: (c.members || []).map((m) => ({ iface: m.iface, metric: m.metric, weight: m.weight })),
      pendingUntil: c.pending_until ? c.pending_until * 1000 + skew : null, // ms (tarayıcı saatine göre)
      wans: (c.wans || []).map((w) => ({
        name: w.name, proto: w.proto, protoLabel: PROTO_LABELS[w.proto] || w.proto, enabled: !!w.enabled,
        device: w.device, baseDevice: w.base_device, vlan: w.vlan || 0, mtu: w.mtu || 0, metric: w.metric || 0,
        username: w.username || '', passwordSet: !!w.password_set,
        ipaddr: w.ipaddr || '', netmask: w.netmask || '', gateway: w.gateway || '',
        peerdns: !!w.peerdns, dns: w.dns || [], mwan: !!w.mwan,
      })),
    };
  }

  // patch: { proto?, username?, password?, vlan?, dns? ('' = operatörden), mtu? (0 = varsayılan),
  //          ipaddr?, netmask?, gateway?, enabled? }  -> { changed, pendingUntil }
  async function setWan(name, patch) {
    const a = { name };
    ['proto', 'username', 'password', 'ipaddr', 'netmask', 'gateway'].forEach((k) => {
      if (patch[k] != null && (k !== 'password' || patch[k] !== '')) a[k] = String(patch[k]).trim();
    });
    if (patch.vlan != null) {
      const v = Number(patch.vlan);
      if (!Number.isInteger(v) || v < 0 || v > 4094) throw new ApiError('VLAN 0-4094 arası olmalı', 'validate');
      a.vlan = v;
    }
    if (patch.mtu != null) {
      const v = Number(patch.mtu) || 0;
      if (v && (v < 576 || v > 9000)) throw new ApiError('MTU 576-9000 arası olmalı', 'validate');
      a.mtu = v;
    }
    if (patch.dns != null) {
      const list = [].concat(patch.dns).join(',').split(/[\s,]+/).filter(Boolean);
      const bad = list.find((x) => !validate.ip(x));
      if (bad) throw new ApiError('Geçersiz DNS: ' + bad, 'validate');
      a.dns = list.join(',');
    }
    if (patch.enabled != null) a.enabled = !!patch.enabled;
    if (a.proto === 'static' || (patch.ipaddr != null)) {
      for (const k of ['ipaddr', 'netmask', 'gateway']) if (a[k] && !validate.ip(a[k])) throw new ApiError('Geçersiz ' + k, 'validate');
    }
    const r = await npCall('wan_set', a);
    return { changed: r.changed !== false, pendingUntil: r.pending_until ? r.pending_until * 1000 + wanSkew : null };
  }

  // mode: 'balanced' | 'failover' | 'single'; weights: { Turknet: 2, wan2: 1 } (yalnız dengelemede anlamlı)
  async function setWanMode(mode, primary, weights) {
    if (!MODE_LABELS[mode] || mode === 'custom') throw new ApiError('Geçersiz mod', 'validate');
    const a = { mode, primary };
    if (weights) a.weights = weights;
    const r = await npCall('wan_mode', a);
    return { pendingUntil: r.pending_until ? r.pending_until * 1000 + wanSkew : null };
  }

  async function confirmWan() { await npCall('wan_confirm', {}); }
  async function revertWan() { await npCall('wan_revert', {}); }
  async function reconnectWan(name) { await npCall('wan_reconnect', { name }); }

  /* ── 3. aşama: hız testi, bufferbloat, SQM, oyun önceliği ───────────────── */
  const SQM_SCRIPTS = {
    'piece_of_cake.qos': 'Standart (cake, tek kuyruk)',
    'layer_cake.qos': 'Oyun / öncelikli (cake diffserv4)',
    'simple.qos': 'Basit (fq_codel, HTB)',
    'simplest.qos': 'En basit (fq_codel)',
    'simplest_tbf.qos': 'En basit (TBF)',
  };
  const GRADE_TEXT = {
    'A+': 'Mükemmel — yük altında gecikme neredeyse hiç artmıyor',
    A: 'Çok iyi — oyun ve görüntülü görüşme için ideal',
    B: 'İyi — ara sıra hafif gecikme artışı',
    C: 'Orta — oyunlarda ping zıplamaları olabilir',
    D: 'Kötü — indirme/yükleme sırasında belirgin gecikme',
    F: 'Çok kötü — ciddi bufferbloat, SQM önerilir',
  };

  async function getSqm() {
    const c = await ubus('netpanel', 'sqm_config');
    return {
      installed: !!c.installed,
      offload: !!c.offload, offloadHw: !!c.offload_hw,
      scripts: (c.scripts || []).map((s) => ({ id: s, label: SQM_SCRIPTS[s] || s })),
      wans: (c.wans || []).map((w) => ({ name: w.name, device: w.device, l3Device: w.l3_device })),
      queues: (c.queues || []).map((q) => {
        const wan = (c.wans || []).find((w) => w.device === q.interface || w.l3_device === q.interface);
        return {
          section: q.section, enabled: !!q.enabled, active: !!q.active, interface: q.interface,
          wan: wan ? wan.name : '',
          downloadMbit: Math.round((q.download || 0) / 100) / 10, uploadMbit: Math.round((q.upload || 0) / 100) / 10,
          script: q.script, scriptLabel: SQM_SCRIPTS[q.script] || q.script, qdisc: q.qdisc,
          linklayer: q.linklayer || 'none', overhead: q.overhead || 0,
          gaming: /layer_cake/.test(q.script || ''),
        };
      }),
    };
  }

  // patch: { interface, enabled, downloadMbit, uploadMbit (0 = sınırsız), script, linklayer, overhead }
  // section '' / null -> yeni kuyruk
  async function setSqm(section, patch) {
    const a = { section: section || '' };
    if (patch.interface != null) a.interface = String(patch.interface);
    if (patch.enabled != null) a.enabled = !!patch.enabled;
    for (const [k, arg] of [['downloadMbit', 'download'], ['uploadMbit', 'upload']]) {
      if (patch[k] != null) {
        const kbit = Math.round(Number(patch[k]) * 1000);
        if (!(kbit === 0 || (kbit >= 1000 && kbit <= 1e7))) throw new ApiError('Hız 1-10000 Mbit/s olmalı (0 = sınırsız)', 'validate');
        a[arg] = kbit;
      }
    }
    if (patch.script != null) a.script = patch.script;
    if (patch.linklayer != null) a.linklayer = patch.linklayer;
    if (patch.overhead != null) a.overhead = Math.round(Number(patch.overhead) || 0);
    const r = await npCall('sqm_set', a);
    return { section: r.section };
  }
  async function deleteSqm(section) { await npCall('sqm_delete', { section }); }
  async function setOffload(enabled) { await npCall('set_offload', { enabled: !!enabled }); }

  // Hazır SQM profili: Turknet fiber PPPoE + VLAN (ethernet + 8 PPPoE + 4 VLAN ≈ 50 bayt)
  const SQM_PRESETS = {
    fiber_pppoe: { label: 'Fiber PPPoE (Turknet vb.)', linklayer: 'ethernet', overhead: 50 },
    fiber_dhcp: { label: 'Fiber / Ethernet (DHCP)', linklayer: 'ethernet', overhead: 42 },
    vdsl: { label: 'VDSL2 (PPPoE)', linklayer: 'ethernet', overhead: 34 },
    adsl: { label: 'ADSL (ATM)', linklayer: 'atm', overhead: 44 },
  };

  // wan: '' (birincil) | hat adı | 'all';  mode: 'single' | 'sequential' (hatlar sırayla) | 'combined' (aynı anda)
  // Hız testi sunucuları (Ookla sunucularının HTTP uçları; varsayılan: TurkNet İstanbul)
  const SPEED_SERVERS = [
    { id: 'speedtest.turk.net:8080', label: 'TurkNet — İstanbul', country: 'TR' },
    { id: 'st-atakoy-1.turksatkablo.com.tr.prod.hosts.ooklaserver.net:8080', label: 'Türksat Kablonet — İstanbul', country: 'TR' },
    { id: 'ookla.premierdc.com.tr.prod.hosts.ooklaserver.net:8080', label: 'PremierDC — İstanbul', country: 'TR' },
    { id: 'speedtest06.turk.net:8080', label: 'TurkNet — Ankara', country: 'TR' },
    { id: 'speedtest35.turk.net:8080', label: 'TurkNet — İzmir', country: 'TR' },
    { id: 'europe', label: 'Avrupa (Hetzner / OVH / Cloudflare)', country: 'EU' },
  ];
  // server: SPEED_SERVERS[].id veya 'host:port' (boş = son kullanılan / TurkNet İstanbul)
  async function startSpeedtest(wan, mode, server) {
    const a = {};
    if (wan) a.wan = wan;
    if (mode) a.mode = mode;
    if (server) a.server = server;
    if (mode && mode !== 'single' && !wan) a.wan = 'all';
    await npCall('speedtest_start', a);
  }

  const PHASE_LABELS = {
    starting: 'Test hazırlanıyor', idle: 'Boşta gecikme ölçülüyor', download: 'İndirme testi',
    upload: 'Yükleme testi', done: 'Test tamamlandı', error: 'Test başarısız',
  };
  function mapTest(t) {
    if (!t) return null;
    const res = {
      running: !!t.running, phase: t.phase, progress: t.progress || 0, wan: t.wan || '', error: t.error || '',
      down: +t.down || 0, up: +t.up || 0, // Mbit/s
      idleMs: t.idle_ms, downMs: t.down_ms, upMs: t.up_ms, jitterMs: t.idle_jitter_ms ?? null,
      grade: t.grade || null, increaseMs: t.increase_ms ?? null,
      gradeText: t.grade ? GRADE_TEXT[t.grade] : '',
      t: (t.finished || t.started || 0) * 1000,
      mode: t.mode || 'single',
      server: t.server || '',
      serverLabel: (SPEED_SERVERS.find((x) => x.id === t.server) || {}).label || t.server || '',
      // ekranda "şu an ne ölçülüyor" için hazır bilgiler
      direction: t.phase === 'download' ? 'download' : t.phase === 'upload' ? 'upload' : null,
      phaseLabel: PHASE_LABELS[t.phase] || '',
      liveMbit: t.phase === 'upload' ? +t.up || 0 : t.phase === 'download' || t.phase === 'done' ? +t.down || 0 : 0,
      totalWans: t.wans_total || (t.runs || []).length || 1,
      step: t.mode === 'sequential' ? Math.min((t.runs || []).length + (t.running ? 1 : 0), t.wans_total || 1) : 1,
      // hat başına sonuçlar (sırayla: her hattın kendi notu; birlikte: hat başına hız, not genel)
      runs: (t.runs || []).map((r) => ({
        wan: r.wan, down: +r.down || 0, up: +r.up || 0, idleMs: r.idle_ms, downMs: r.down_ms, upMs: r.up_ms,
        grade: r.grade || null, increaseMs: r.increase_ms ?? null, gradeText: r.grade ? GRADE_TEXT[r.grade] : '', error: r.error || '',
      })),
    };
    if (res.mode === 'combined') res.wan = 'Tüm hatlar';
    if (res.mode === 'sequential' && res.phase === 'done') {
      // genel: en kötü not, toplam teorik kapasite
      const ok = res.runs.filter((r) => !r.error && r.grade);
      const order = ['A+', 'A', 'B', 'C', 'D', 'F'];
      const worst = ok.reduce((w, r) => (order.indexOf(r.grade) > order.indexOf(w) ? r.grade : w), 'A+');
      res.grade = ok.length ? worst : null;
      res.gradeText = res.grade ? GRADE_TEXT[res.grade] : '';
      res.down = ok.reduce((a, r) => a + r.down, 0);
      res.up = ok.reduce((a, r) => a + r.up, 0);
      res.wan = 'Tüm hatlar';
      const best = ok.slice().sort((a, b) => b.down - a.down)[0];
      if (best) { res.idleMs = best.idleMs; res.downMs = best.downMs; res.upMs = best.upMs; res.increaseMs = best.increaseMs; }
    }
    if (res.phase === 'done' && res.down > 0 && res.mode === 'single') {
      // SQM önerisi: ölçülen hızın %90'ı (bufferbloat'ı kontrol altında tutmak için)
      res.recommendDownMbit = Math.floor(res.down * 0.9);
      res.recommendUpMbit = Math.floor(res.up * 0.9 * 10) / 10;
    }
    return res;
  }
  // -> { current: Test|null, history: [{ t, wan, down, up, idleMs, downMs, upMs, grade }] }
  // current.phase: starting | idle | download | upload | done | error ; ~1 sn'de bir çağır
  async function getSpeedtest() {
    const r = await ubus('netpanel', 'speedtest_status');
    return {
      current: mapTest(r.current),
      history: (r.history || []).map((h) => ({ t: h.t * 1000, wan: h.wan === '*' ? 'Tüm hatlar' : h.wan, down: +h.down, up: +h.up,
        idleMs: h.idle_ms, downMs: h.down_ms, upMs: h.up_ms, grade: h.grade, mode: h.mode || 'single' })),
    };
  }

  /* ── Keenetic tarzı ekler: istatistik, ping geçmişi, yeni cihaz, bildirim, saat dilimi, yedek ── */
  const DAY_NAMES = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  function parseSchedule(str) {
    const m = /^([1-7]+)\|(\d\d:\d\d)\|(\d\d:\d\d)$/.exec(str || '');
    if (!m) return null;
    const days = m[1].split('').map(Number);
    const label = (days.length === 7 ? 'Her gün' : days.join('') === '12345' ? 'Hafta içi' : days.join('') === '67' ? 'Hafta sonu'
      : days.map((d) => DAY_NAMES[d]).join(', ')) + ' ' + m[2] + '–' + m[3];
    return { days, from: m[2], to: m[3], label, overnight: m[2] > m[3] };
  }

  // -> { days: [{ date, total:{rx,tx}, wan:{ad:{rx,tx}}, devices:{anahtar:{rx,tx}} }] (eskiden yeniye),
  //      devices: [{ key, mac|null, rx, tx, total }] (dönem toplamı, büyükten küçüğe), wan: { ad: {rx,tx} } }
  //    rx = indirme, tx = yükleme (bayt). anahtar: MAC ya da eşlenemeyen cihaz için "ip:x.x.x.x"
  async function getUsage(days = 31) {
    const r = await npCall('usage_get', { days });
    const out = { days: [], devices: [], wan: {} };
    const devTot = {};
    (r.days || []).slice().reverse().forEach((d) => {
      const day = { date: d.date, total: { rx: 0, tx: 0 }, wan: {}, devices: {} };
      (d.items || []).forEach(([k, rx, tx]) => {
        if (/^wan:/.test(k)) {
          const w = k.slice(4);
          day.wan[w] = { rx, tx };
          out.wan[w] = out.wan[w] || { rx: 0, tx: 0 };
          out.wan[w].rx += rx; out.wan[w].tx += tx;
        } else {
          day.devices[k] = { rx, tx };
          day.total.rx += rx; day.total.tx += tx;
          devTot[k] = devTot[k] || { rx: 0, tx: 0 };
          devTot[k].rx += rx; devTot[k].tx += tx;
        }
      });
      out.days.push(day);
    });
    out.devices = Object.keys(devTot).map((k) => ({ key: k, mac: /^ip:/.test(k) ? null : k, ...devTot[k], total: devTot[k].rx + devTot[k].tx }))
      .sort((a, b) => b.total - a.total);
    return out;
  }

  // -> { wans: { ad: { samples:[{ t(ms), avg(ms|null), loss(%) }], avg, max, lossPct, outages } } }
  async function getPingHistory(hours = 24) {
    const r = await npCall('ping_get', { hours });
    const wans = {};
    (r.samples || []).forEach(([t, w, avg, loss]) => {
      (wans[w] = wans[w] || { samples: [] }).samples.push({ t: t * 1000, avg, loss });
    });
    Object.values(wans).forEach((x) => {
      const ok = x.samples.filter((p) => p.avg != null);
      x.avg = ok.length ? +(ok.reduce((a, p) => a + p.avg, 0) / ok.length).toFixed(1) : null;
      x.max = ok.length ? Math.max(...ok.map((p) => p.avg)) : null;
      x.lossPct = x.samples.length ? +(x.samples.reduce((a, p) => a + p.loss, 0) / x.samples.length).toFixed(1) : 0;
      // kesinti: %100 kayıp yaşanan ardışık dakika blokları
      let o = 0, prev = false;
      x.samples.forEach((p) => { const down = p.loss >= 100; if (down && !prev) o++; prev = down; });
      x.outages = o;
    });
    return { wans };
  }

  async function getNewDevices() {
    const r = await npCall('newdev_list', {});
    const items = (r.items || []).map((x) => ({ t: x.t * 1000, mac: x.mac, ip: x.ip, hostname: x.hostname || '', unseen: !!x.unseen }));
    return { blockNew: !!r.block_new, items, unseenCount: items.filter((x) => x.unseen).length };
  }
  async function ackNewDevices() { await npCall('newdev_ack', {}); }

  // Telegram bildirimi: { enabled, chatId, tokenSet, wan, newdev, blockNew, curl }
  async function getNotify() {
    const r = await npCall('notify_get', {});
    return { enabled: !!r.enabled, chatId: r.chat_id || '', tokenSet: !!r.token_set, wan: !!r.wan, newdev: !!r.newdev, presence: r.presence !== false, system: r.system !== false, blockNew: !!r.block_new, curl: !!r.curl };
  }
  // patch: { enabled, token ('' = değiştirme), chatId, wan, newdev, blockNew }
  async function setNotify(patch) {
    const a = {};
    if (patch.enabled != null) a.enabled = !!patch.enabled;
    if (patch.token) a.token = String(patch.token).trim();
    if (patch.chatId != null && patch.chatId !== '') a.chat_id = String(patch.chatId).trim();
    ['wan', 'newdev', 'presence', 'system'].forEach((k) => { if (patch[k] != null) a[k] = !!patch[k]; });
    if (patch.blockNew != null) a.block_new = !!patch.blockNew;
    await npCall('notify_set', a);
  }
  async function testNotify() { await npCall('notify_test', {}); }

  const TIMEZONES = [
    { id: 'Europe/Istanbul', label: 'Türkiye (İstanbul, UTC+3)' },
    { id: 'UTC', label: 'UTC' },
    { id: 'Europe/Berlin', label: 'Orta Avrupa (Berlin)' },
    { id: 'Europe/London', label: 'Birleşik Krallık (Londra)' },
  ];
  async function getTimezone() {
    const r = await npCall('tz_get', {});
    return { zone: r.zonename || 'UTC', now: r.now, offset: r.offset, isUtc: !r.zonename || r.zonename === 'UTC' };
  }
  async function setTimezone(zone) { return npCall('tz_set', { zone }); }

  // Yedek: tarayıcıda dosya olarak indirilir -> { name, size }
  async function downloadBackup() {
    const r = await npCall('backup_create', {});
    const bin = atob(r.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/gzip' }));
    const a = document.createElement('a');
    a.href = url; a.download = r.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { name: r.name, size: r.size };
  }
  // file: <input type=file> ile seçilen .tar.gz. Başarılıysa router yeniden başlar (~1 dk).
  async function restoreBackup(file) {
    if (!file) throw new ApiError('Dosya seçin', 'validate');
    if (file.size > 500000) throw new ApiError('Dosya çok büyük (en fazla 500 KB)', 'validate');
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return npCall('backup_restore', { data: btoa(bin) });
  }

  /* ── Cloudflare Tunnel ──────────────────────────────────────────────────── */
  // -> { installed, enabled, tokenSet, tokenValid, tunnelId, running, connections (0-4), hosts:[{hostname, service}], curl }
  async function getTunnel() {
    const r = await npCall('cf_status', {});
    return { installed: !!r.installed, enabled: !!r.enabled, tokenSet: !!r.token_set, tokenValid: !!r.token_valid, tunnelId: r.tunnel_id || '',
      running: !!r.running, connections: r.connections || 0, hosts: r.hosts || [], curl: !!r.curl };
  }
  async function setTunnelToken(token) { await npCall('cf_set_token', { token: String(token || '').trim() }); }
  async function setTunnelEnabled(enabled) { await npCall('cf_set_enabled', { enabled: !!enabled }); }
  // API token yalnız bu çağrılarda kullanılır, router'a kaydedilmez
  // -> { accounts:[{id,name}], zones:[{id,name,accountId}], existingTunnel:{id, accountId}|null }
  async function cfLookup(apiToken) {
    const r = await npCall('cf_lookup', { api_token: String(apiToken || '').trim() });
    return { accounts: r.accounts || [], zones: (r.zones || []).map((z) => ({ id: z.id, name: z.name, accountId: z.account_id })),
      existingTunnel: r.existing_tunnel ? { id: r.existing_tunnel.id, accountId: r.existing_tunnel.account_id } : null };
  }
  // opts: { apiToken, accountId, zoneId, subdomain, service ('http://192.168.1.1:80'), accessEmail }
  // -> { hostname, url, tunnelId, createdTunnel, access:{ok, email|error}|null }
  async function cfPublish(o) {
    const r = await npCall('cf_publish', { api_token: o.apiToken, account_id: o.accountId, zone_id: o.zoneId, subdomain: o.subdomain,
      service: o.service || 'http://192.168.1.1:80', access_email: o.accessEmail || '' });
    return { hostname: r.hostname, url: r.url, tunnelId: r.tunnel_id, createdTunnel: !!r.created_tunnel, access: r.access || null };
  }
  async function cfUnpublish(apiToken, hostname) { return npCall('cf_unpublish', { api_token: apiToken, hostname }); }

  /* ── Port yönlendirme + UPnP ───────────────────────────────────────────── */
  const WAN_KIND = {
    public: 'Gerçek (public) IP — dışarıdan erişilebilir',
    cgnat: 'Operatör NAT’ı (CGNAT) — dışarıdan gelen bağlantılar bu hatta ulaşmaz',
    private: 'Başka bir modemin arkasında — o modemde de port açılması gerekir',
  };
  const mapWans = (w) => (w || []).map((x) => ({ name: x.name, ip: x.ip, kind: x.kind, kindLabel: WAN_KIND[x.kind] || x.kind }));
  // -> { rules:[{id,name,proto,extPort,ip,intPort,enabled}], upnp:{installed,enabled,running,leases:[{proto,extPort,ip,intPort,desc}]}, wans, lan:{ip,prefix} }
  async function getPortForwards() {
    const r = await npCall('pf_list', {});
    return {
      rules: (r.rules || []).map((x) => ({ id: x.id, name: x.name, proto: x.proto, extPort: x.ext_port, ip: x.ip, intPort: x.int_port, enabled: !!x.enabled })),
      upnp: { ...(r.upnp || {}), leases: (r.upnp?.leases || []).map((l) => ({ proto: l.proto, extPort: l.ext_port, ip: l.ip, intPort: l.int_port, desc: l.desc })) },
      wans: mapWans(r.wans), lan: r.lan || {}, fw: { dmzIp: r.fw?.dmz_ip || '', ping: !!r.fw?.ping },
    };
  }
  // rule: { id?, name, proto: 'tcp'|'udp'|'tcp udp', extPort, intPort, ip, enabled }
  async function savePortForward(x) {
    return npCall('pf_set', { id: x.id || '', name: x.name || '', proto: x.proto || 'tcp udp', ext_port: String(x.extPort || ''), int_port: String(x.intPort || ''), ip: x.ip, enabled: x.enabled !== false });
  }
  async function deletePortForward(id) { await npCall('pf_delete', { id }); }
  // { ping?: bool, dmzIp?: '' (kapat) | ip }
  async function setFirewall(o) {
    const a = {};
    if (o.ping != null) a.ping = !!o.ping;
    if (o.dmzIp != null) a.dmz_ip = String(o.dmzIp).trim();
    await npCall('fw_set', a);
  }
  // Bir cihazın anlık bağlantıları -> { total, items:[{dst, proto, port, count, bytes, name, service}] }
  const PORT_NAMES = { 80: 'Web (HTTP)', 443: 'Web (HTTPS)', 53: 'DNS', 853: 'DNS (şifreli)', 123: 'Saat (NTP)', 22: 'SSH', 25: 'E-posta', 465: 'E-posta', 587: 'E-posta', 993: 'E-posta (IMAP)', 5228: 'Google bildirim', 5223: 'Apple bildirim', 3478: 'Görüntülü arama (STUN)', 19302: 'Google Meet', 1900: 'Ağ keşfi (SSDP)', 5353: 'Ağ keşfi (mDNS)', 3074: 'Xbox Live', 27015: 'Steam oyun', 8801: 'Zoom', 1935: 'Canlı yayın' };
  async function getConnections(ip) {
    const r = await npCall('conn_list', { ip });
    return { total: r.total || 0, items: (r.items || []).map((x) => ({ ...x, service: PORT_NAMES[x.port] || (x.proto + '/' + x.port) })) };
  }
  async function setUpnp(enabled) { await npCall('upnp_set', { enabled: !!enabled }); }

  /* ── Yerel ağ + DHCP ───────────────────────────────────────────────────── */
  // -> { ip, prefix, dhcp:{enabled,start,limit,leasetime}, dns:[], staticHosts, pending:{until(ms), oldIp, newIp}|null }
  async function getLan() {
    const r = await npCall('lan_get', {});
    return { ip: r.ip, prefix: r.prefix, dhcp: r.dhcp, dns: r.dns || [], staticHosts: r.static_hosts || 0,
      pending: r.pending ? { until: r.pending.until * 1000, oldIp: r.pending.old_ip, newIp: r.pending.new_ip } : null };
  }
  // p: { ip, dhcpEnabled, start, limit, leasetime, dns:[] } -> { ipChanged, newIp, moved, pendingUntil(ms) }
  async function setLan(p) {
    const r = await npCall('lan_set', { ip: p.ip, dhcp_enabled: p.dhcpEnabled !== false, start: +p.start, limit: +p.limit, leasetime: p.leasetime, dns: p.dns || [] });
    return { ipChanged: !!r.ip_changed, newIp: r.new_ip, moved: r.moved || 0, pendingUntil: r.pending_until ? r.pending_until * 1000 : 0 };
  }
  async function confirmLan() { await npCall('lan_confirm', {}); }
  async function revertLan() { await npCall('lan_revert', {}); }

  /* ── WireGuard VPN ─────────────────────────────────────────────────────── */
  async function getVpn() {
    const r = await npCall('wg_status', {});
    return { installed: !!r.installed, qrencode: !!r.qrencode, configured: !!r.configured, enabled: !!r.enabled, up: !!r.up, port: r.port, subnet: r.subnet,
      endpoint: r.endpoint || '', wans: mapWans(r.wans),
      peers: (r.peers || []).map((p) => ({ ...p, handshake: (p.handshake || 0) * 1000, online: !!p.handshake && Date.now() / 1000 - p.handshake < 180 })) };
  }
  async function setupVpn(o) { await npCall('wg_setup', { port: +o.port || 51820, endpoint: o.endpoint || '' }); }
  async function setVpn(o) { await npCall('wg_set', { enabled: !!o.enabled, endpoint: o.endpoint ?? null }); }
  // -> { id, ip, config (metin), qr (SVG|null) } — istemci anahtarı yalnız bu yanıtta görünür
  async function addVpnPeer(name, fullTunnel = true) { return npCall('wg_add', { name, full_tunnel: !!fullTunnel }); }
  async function deleteVpnPeer(id) { await npCall('wg_delete', { id }); }

  /* ── QR + paket kurulumu ───────────────────────────────────────────────── */
  async function qrSvg(text) { return (await npCall('qr', { text })).svg; }
  // Wi-Fi QR metni (telefon kamerasıyla okutunca ağa katılır)
  function wifiQrText(ssid, password, open = false) {
    const e = (v) => String(v).replace(/([\\;,:"])/g, '\\$1');
    return `WIFI:T:${open ? 'nopass' : 'WPA'};S:${e(ssid)};${open ? '' : `P:${e(password)};`};`;
  }
  // set: 'upnp' | 'wireguard' | 'qr' | 'wol'
  async function installPkg(set) { return npCall('pkg_install', { set }); }
  async function pkgStatus(set) { return npCall('pkg_status', { set }); }

  /* ── Güncelleme (GitHub Releases) ───────────────────────────────────────── */
  // -> { current, latest, available, notes, published, url, repo, auto, checked(ms), error }
  async function getUpdate(force = false) {
    const r = await npCall('update_check', { force: !!force });
    return { current: r.current, latest: r.latest, available: !!r.available, notes: r.notes || '', published: r.published || '',
      url: r.url || '', repo: r.repo || '', auto: !!r.auto, checked: (r.checked || 0) * 1000, error: r.error || '' };
  }
  async function applyUpdate() { await npCall('update_apply', {}); }
  // -> { state: idle|running|done|error, current, log }
  async function getUpdateStatus() { return npCall('update_status', {}); }
  async function setAutoUpdate(on) { await npCall('update_set', { auto: !!on }); }

  /* ── Entegrasyonlar ─────────────────────────────────────────────────────── */
  // -> { huawei, cloudflare, scanner, cloudflared (paket kurulu mu), curl }
  async function getIntegrations() {
    const r = await npCall('integ_get', {});
    return { huawei: !!r.huawei, tplink: !!r.tplink, cloudflare: !!r.cloudflare, scanner: !!r.scanner, vpn: !!r.vpn, adguard: !!r.adguard,
      cloudflared: !!r.cloudflared, adguardhome: !!r.adguardhome, curl: !!r.curl };
  }
  async function setIntegration(id, enabled) { await npCall('integ_set', { id, enabled: !!enabled }); }

  /* ── TP-Link Archer (deneysel) ────────────────────────────────────────── */
  // -> { enabled, host, username, passwordSet, connected, error, bands:[{band, bandLabel, enabled, ssid}] }
  async function getTplink() {
    const r = await npCall('tp_status', {});
    return { enabled: !!r.enabled, host: r.host || '', username: r.username || 'admin', passwordSet: !!r.password_set, connected: !!r.connected, error: r.error || '',
      bands: (r.bands || []).map((b) => ({ band: b.band, bandLabel: fmt.band(b.band), enabled: !!b.enabled, ssid: b.ssid || '' })) };
  }
  async function setTplinkConfig(o) {
    const a = {};
    if (o.host != null) { if (!validate.ip(o.host)) throw new ApiError('Geçerli bir IP adresi girin', 'validate'); a.host = o.host; }
    if (o.username != null) a.username = String(o.username).trim() || 'admin';
    if (o.password) a.password = String(o.password);
    if (o.enabled != null) a.enabled = !!o.enabled;
    await npCall('tp_config', a);
  }
  async function setTplinkBand(band, enabled) { await npCall('tp_set', { band, enabled: !!enabled }); }
  async function saveTplinkWifi(band, o) {
    if (o.password && !validate.wifiKey(o.password)) throw new ApiError('Şifre 8-63 karakter olmalı', 'validate');
    await npCall('tp_wifi_set', { band, ssid: o.ssid || '', password: o.password || '' });
  }

  /* ── AdGuard Home ──────────────────────────────────────────────────────── */
  // -> { installed, configured, running, active (DNS'i AdGuard veriyor), creds, webPort, lanIp,
  //      stats: { protection, version, disabledUntil, queries, blocked, avgMs, topBlocked:[{name,count}], topClients, error, auth } }
  async function getAdguard() {
    const r = await npCall('ag_status', {});
    const st = r.stats;
    return { installed: !!r.installed, configured: !!r.configured, running: !!r.running, active: !!r.active, creds: !!r.creds,
      webPort: r.web_port || 3000, lanIp: r.lan_ip || '',
      stats: st ? { protection: !!st.protection, version: st.version || '', disabledUntil: st.disabled_until || null, queries: st.queries || 0, blocked: st.blocked || 0,
        avgMs: st.avg_ms, topBlocked: st.top_blocked || [], topClients: st.top_clients || [], error: st.error || '', auth: !!st.auth } : null };
  }
  async function setupAdguard(password) { return npCall('ag_setup', { password }); }
  async function enableAdguard(enabled) { await npCall('ag_enable', { enabled: !!enabled }); }
  async function connectAdguard(user, password) { await npCall('ag_connect', { user, password }); }
  async function setAdguardProtection(enabled, minutes = 0) { await npCall('ag_protection', { enabled: !!enabled, minutes: +minutes || 0 }); }
  let agServicesCache = null;
  async function getAdguardServices() {
    if (!agServicesCache) agServicesCache = (await npCall('ag_services', {})).services || [];
    return agServicesCache;
  }
  async function getAdguardGlobal() { return (await npCall('ag_global_get', {})).services || []; }
  async function setAdguardGlobal(services) { await npCall('ag_global_set', { services }); }
  // cihaz: { custom, filtering, parental, safesearch, services[] }
  async function getAdguardClient(mac, ip) { return npCall('ag_client_get', { mac, ip: ip || '' }); }
  async function setAdguardClient(mac, ip, name, o) {
    return npCall('ag_client_set', { mac, ip: ip || '', name: name || '', filtering: o.filtering !== false, parental: !!o.parental, safesearch: !!o.safesearch, services: o.services || [] });
  }
  // Öne çıkan servisler (AdGuard kimlikleri); listede olmayanlar gizlenir
  const AG_POPULAR = ['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'snapchat', 'whatsapp', 'telegram', 'discord', 'roblox', 'minecraft', 'fortnite', 'steam', 'epic_games', 'twitch', 'netflix', 'spotify', 'reddit', 'pinterest', 'tinder', '9gag', 'kick'];

  /* ── Güvenlik, günlük, sistem seçenekleri, ilk kurulum ─────────────────── */
  // -> { rootPwEmpty, httpsAvailable, httpsRedirect, wizardDone, tunnelHttpHosts }
  async function getSecurity() {
    const r = await npCall('sec_get', {});
    return { rootPwEmpty: !!r.root_pw_empty, httpsAvailable: !!r.https_available, httpsRedirect: !!r.https_redirect, wizardDone: !!r.wizard_done, tunnelHttpHosts: r.tunnel_http_hosts || '' };
  }
  async function setHttpsRedirect(on) { await npCall('sec_https', { redirect: !!on }); }
  async function finishWizard() { await npCall('wizard_done', {}); }
  // level: '' | 'warn' | 'err' -> [{ time, facility, level, text }]
  async function getLog(o = {}) {
    const r = await npCall('log_get', { lines: +o.lines || 200, q: o.q || '', level: o.level || '' });
    return (r.lines || []).map((l) => {
      const m = /^(\w{3} \w{3}\s+\d+ \d\d:\d\d:\d\d \d{4}) (\w+)\.(\w+) (.*)$/.exec(l);
      return m ? { time: m[1], facility: m[2], level: m[3], text: m[4] } : { time: '', facility: '', level: 'info', text: l };
    });
  }
  async function getSysOpt() {
    const r = await npCall('sysopt_get', {});
    return { rebootMode: r.reboot_mode || 'off', rebootHour: r.reboot_hour ?? 5, rebootDay: r.reboot_day || 1, alerts: !!r.alerts, tempLimit: r.temp_limit || 85 };
  }
  async function setSysOpt(o) { await npCall('sysopt_set', { reboot_mode: o.rebootMode, reboot_hour: +o.rebootHour, reboot_day: +o.rebootDay, alerts: !!o.alerts }); }

  /* ── Zamanlanmış hız testi ─────────────────────────────────────────────── */
  async function getSpeedSchedule() { return npCall('st_sched_get', {}); }
  async function setSpeedSchedule(o) { await npCall('st_sched_set', { enabled: !!o.enabled, hour: +o.hour, wan: o.wan || '' }); }

  // Ağ tarayıcı: startScan({ports}) sonra getScan() ile durum/sonuç
  // -> { running, phase ('ping'|'ports'|'done'|'idle'|'error'), done, total, started(ms), finished(ms),
  //      result: { nets:[{name,cidr}], portsChecked, tcpChecked, hosts:[{ip, mac, name, net, ping, self, web:[url], ports:[{port,name}], randomMac}] } | null }
  // opts.range: '' (yerel ağlar) | '192.168.1.0/24' | '192.168.1.10-50' | '192.168.1.20'
  async function startScan(opts = {}) { await npCall('scan_start', { ports: opts.ports !== false, range: String(opts.range || '').trim() }); }
  async function wakeOnLan(mac) { await npCall('scan_wol', { mac }); }
  // Taranan cihaz için tahmini tip: önce isim (cihaz listesiyle aynı kurallar), sonra açık portlar
  function guessScanType(h) {
    if (h.self) return 'router';
    const byName = guessType({ name: h.name });
    if (byName !== 'other') return byName;
    const p = new Set(h.ports.map((x) => x.port));
    const web = h.web.join(' ');
    if (p.has(9100)) return 'printer';
    if (p.has(554)) return 'camera';
    if (p.has(8009)) return 'tv';
    if (/:5000\/|:5001\//.test(web)) return 'nas';
    if (/:8006\/|:32400\/|:8096\/|:8123\//.test(web) || p.has(1883)) return 'server';
    if (p.has(3389) || (p.has(445) && p.has(139))) return 'pc';
    if (p.has(22) && !h.randomMac) return 'server';
    if (p.has(53) && h.web.length) return 'router';
    if (h.randomMac) return 'phone';
    return 'other';
  }
  const ipNum = (ip) => ip.split('.').reduce((a, x) => a * 256 + Number(x), 0);
  async function getScan() {
    const r = await npCall('scan_status', {});
    const res = r.result;
    return {
      running: !!r.running, phase: r.phase || 'idle', done: r.done || 0, total: r.total || 0,
      started: (r.started || 0) * 1000, finished: (r.finished || 0) * 1000,
      result: res ? {
        range: res.range || '', nets: res.nets || [], portsChecked: !!res.ports_checked, tcpChecked: !!res.tcp_checked,
        hosts: (res.hosts || []).map((h) => ({ ...h, mac: (h.mac || '').toLowerCase(), web: h.web || [], ports: h.ports || [],
          // yerel yönetilen (rastgele) MAC: ilk baytın 2. biti — telefonların "özel Wi-Fi adresi"
          randomMac: !!h.mac && (parseInt(h.mac.slice(0, 2), 16) & 2) === 2 }))
          .map((h) => ({ ...h, type: guessScanType(h) }))
          .sort((a, b) => ipNum(a.ip) - ipNum(b.ip)),
      } : null,
    };
  }

  const EVENT_LABELS = {
    ifup: ['Bağlandı', 'ok'], ifdown: ['Bağlantı kesildi', 'bad'],
    connected: ['İnternet erişimi geldi', 'ok'], disconnected: ['İnternet erişimi yok', 'bad'],
    configured: ['Ayarlar değiştirildi', 'info'], reconnect: ['Yeniden bağlanma istendi', 'info'],
    reverted: ['Ayarlar otomatik geri alındı', 'warn'],
  };
  // -> [{ t (ms), iface ('*' = genel), event, label, level: ok|bad|info|warn }] en yeni önce
  async function getWanEvents() {
    const r = await ubus('netpanel', 'wan_events');
    return (r.events || []).map((e) => {
      let [label, level] = EVENT_LABELS[e.event] || [e.event, 'info'];
      if (/^mode:/.test(e.event)) {
        const [, m, p] = e.event.split(':');
        label = 'Çoklu WAN modu: ' + (MODE_LABELS[m] || m) + (p ? ' (ana: ' + p + ')' : '');
        level = 'info';
      }
      return { t: e.t * 1000, iface: e.iface, event: e.event, label, level };
    });
  }

  async function getStatus() {
    const s = await ubus('netpanel', 'status');
    return { offload: !!s.offload, offloadHw: !!s.offload_hw, table: !!s.table, counters: !!s.counters, version: s.version };
  }

  async function reboot() { await ubus('system', 'reboot'); }

  /* ── harici Huawei Wi-Fi ────────────────────────────────────────────────── */
  async function getHuawei() {
    const h = await ubus('netpanel', 'hw_status');
    return {
      enabled: !!h.enabled,
      host: h.host || '',
      username: h.username || 'admin',
      passwordSet: !!h.password_set,
      connected: !!h.connected,
      error: h.error || '',
      dbho: !!h.dbho,
      radios: (h.radios || []).map((r) => ({ band: r.band, bandLabel: fmt.band(r.band), enabled: !!r.enabled, ssid: r.ssid || '' })),
      clients: h.clients || 0,
    };
  }

  async function setHuaweiWifi(band, enabled) {
    if (band !== '2g' && band !== '5g') throw new ApiError('Geçersiz bant', 'validate');
    await npCall('hw_set', { band, enabled: !!enabled });
  }

  /* ── 4. aşama: Huawei Wi-Fi ayarları (ad, şifre, kanal, gizleme) ───────── */
  const SECURITY_LABELS = {
    None: 'Açık (şifresiz)', '11i': 'WPA2', WPAand11i: 'WPA/WPA2', '11iandWPA3': 'WPA2/WPA3', WPA3: 'WPA3',
  };
  const CHANNELS = {
    '2g': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    '5g': [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140],
  };
  const DFS = (ch) => ch >= 52 && ch <= 144; // radar kanalı: ilk açılışta 1 dk bekler, ara sıra değişebilir

  // -> { dbho, bands: [{ band, bandLabel, ssid, enabled, security, securityLabel, encryption,
  //       channel (0 = otomatik), actualChannel, auto, hidden, standard, bandwidth, channels[] }] }
  async function getHuaweiWifi() {
    const r = await npCall('hw_wifi_get', {});
    return {
      dbho: !!r.dbho,
      bands: (r.bands || []).map((b) => ({
        band: b.band, bandLabel: fmt.band(b.band), ssid: b.ssid || '', enabled: !!b.enabled,
        security: b.security, securityLabel: SECURITY_LABELS[b.security] || b.security, encryption: b.encryption,
        open: b.security === 'None', channel: +b.channel || 0, actualChannel: +b.actual_channel || 0,
        auto: !+b.channel, hidden: !!b.hidden, standard: b.standard || '', bandwidth: b.bandwidth || '',
        channels: CHANNELS[b.band] || [],
      })),
    };
  }

  // band: '2g' | '5g' | 'both';  patch: { ssid?, password? ('' = değiştirme), channel? (0 = otomatik), hidden? }
  // Not: Huawei "çift bant tek ağ" (dbho) açıkken ad/şifre iki banda birlikte uygulanır.
  async function saveHuaweiWifi(band, patch) {
    const a = { band };
    if (patch.ssid != null) {
      const v = String(patch.ssid).trim();
      if (!validate.ssid(v)) throw new ApiError('Ağ adı 1-32 bayt olmalı', 'validate');
      a.ssid = v;
    }
    if (patch.password) {
      if (!validate.wifiKey(patch.password)) throw new ApiError('Şifre 8-63 karakter olmalı', 'validate');
      a.password = String(patch.password);
    }
    if (patch.channel != null) {
      const ch = Number(patch.channel);
      if (ch && !(CHANNELS[band] || []).includes(ch)) throw new ApiError('Bu bant için geçersiz kanal', 'validate');
      a.channel = ch;
    }
    if (patch.hidden != null) a.hidden = !!patch.hidden;
    const r = await npCall('hw_wifi_set', a);
    return { changed: r.changed !== false };
  }

  // Çevre taraması + en boş kanal önerisi.
  // -> { networks: [{ ssid, channel, signal (dBm), band }], recommend: { '2g': Rec, '5g': Rec } }
  //    Rec = { channel, reason, load: { kanal: puan } (düşük = boş), current }
  async function scanHuaweiChannels(current) {
    const r = await npCall('hw_wifi_scan', {});
    const networks = (r.networks || [])
      .map((x) => {
        const ch = parseInt(x.channel, 10);
        let sig = parseInt(x.signal, 10);
        if (sig > 0 && sig <= 100) sig = Math.round(sig / 2 - 100); // yüzde verildiyse kabaca dBm'e çevir
        const band = /^5/.test(x.band || '') || ch > 14 ? '5g' : '2g';
        return { ssid: x.ssid || '(gizli ağ)', channel: ch, signal: Number.isFinite(sig) ? sig : null, band };
      })
      .filter((x) => x.channel > 0);
    const weight = (sig) => (sig == null ? 0.5 : Math.max(0.1, Math.min(1.5, (sig + 100) / 40))); // güçlü komşu = daha çok yük
    const rec = {};
    // 2,4 GHz: yalnız çakışmayan 1/6/11 önerilir; komşu kanallar (±4) kısmen çakışır
    const load2 = {};
    [1, 6, 11].forEach((c) => {
      load2[c] = +networks.filter((x) => x.band === '2g')
        .reduce((s, x) => s + (Math.abs(x.channel - c) < 5 ? (1 - Math.abs(x.channel - c) / 5) * weight(x.signal) : 0), 0).toFixed(2);
    });
    const best2 = +Object.keys(load2).sort((a, b) => load2[a] - load2[b] || a - b)[0];
    rec['2g'] = { channel: best2, load: load2, current: current && current['2g'],
      reason: load2[best2] === 0 ? 'Bu kanalda yakın ağ yok' : 'Çakışmayan kanallar (1/6/11) içinde en az kalabalık olan' };
    // 5 GHz: 80 MHz blokları (36-48, 52-64, 100-112, 116-128, 132-144); radar (DFS) olmayan blok önceliklidir
    const blocks = [[36, 48], [52, 64], [100, 112], [116, 128], [132, 144]];
    const load5 = {};
    blocks.forEach(([a, b]) => {
      load5[a] = +networks.filter((x) => x.band === '5g' && x.channel >= a && x.channel <= b)
        .reduce((s, x) => s + weight(x.signal), 0).toFixed(2);
    });
    // Radar (DFS) kanalları oyun için riskli: radar algılanınca kanal değişir, bağlantı birkaç sn kopar.
    // Bu yüzden DFS bloğu ancak normal blok belirgin şekilde kalabalıksa (ceza 2.0) önerilir.
    const bestBlock = +Object.keys(load5).sort((a, b) => (load5[a] + (DFS(+a) ? 2 : 0)) - (load5[b] + (DFS(+b) ? 2 : 0)))[0];
    // blok içinde aynı kanalı kullanan komşusu en az olan 20 MHz kanal
    const inBlock = [0, 4, 8, 12].map((d) => bestBlock + d);
    const sameLoad = (c) => networks.filter((x) => x.band === '5g' && x.channel === c).reduce((s, x) => s + weight(x.signal), 0);
    const best5 = inBlock.sort((a, b) => sameLoad(a) - sameLoad(b) || a - b)[0];
    rec['5g'] = { channel: best5, block: bestBlock, load: load5, current: current && current['5g'], dfs: DFS(best5),
      reason: DFS(best5)
        ? 'Radar (DFS) kanalı: normal kanallar çok kalabalık; açılışta ~1 dk bekleyebilir'
        : load5[bestBlock] === 0 ? 'Bu kanal bloğunda yakın ağ yok' : 'Radar kanalı olmayan blokta en az kullanılan kanal' };
    return { networks, recommend: rec };
  }

  async function setHuaweiConfig(patch) {
    const a = {};
    if (patch.host != null) {
      if (!validate.ip(patch.host)) throw new ApiError('Geçerli bir IP adresi girin', 'validate');
      a.host = patch.host;
    }
    if (patch.username != null) a.username = String(patch.username).trim() || 'admin';
    if (patch.password) a.password = String(patch.password);
    if (patch.enabled != null) a.enabled = !!patch.enabled;
    await npCall('hw_config', a);
  }

  /* ── canlı yenileme ─────────────────────────────────────────────────────── */
  function live(cb, ms = 2000) {
    let stopped = false, timer = null;
    async function tick() {
      if (stopped) return;
      if (document.hidden) { timer = setTimeout(tick, ms); return; }
      try {
        const [clients, traffic] = await Promise.all([getClients(), getTraffic()]);
        if (!stopped) cb({ clients, traffic, error: null });
      } catch (e) {
        if (!stopped) cb({ clients: null, traffic: null, error: e });
        if (e.code === 'auth') return;
      }
      if (!stopped) timer = setTimeout(tick, ms);
    }
    tick();
    return () => { stopped = true; clearTimeout(timer); };
  }

  /* ── biçimlendirme ve doğrulama ─────────────────────────────────────────── */
  const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
  const fmt = {
    bits(bps) {
      bps = bps || 0;
      if (bps >= 1e9) return nf1.format(bps / 1e9) + ' Gbit/s';
      if (bps >= 1e6) return nf1.format(bps / 1e6) + ' Mbit/s';
      if (bps >= 1e3) return nf1.format(bps / 1e3) + ' kbit/s';
      return Math.round(bps) + ' bit/s';
    },
    bytes(n) {
      n = n || 0;
      const u = ['B', 'KB', 'MB', 'GB', 'TB'];
      let i = 0;
      while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
      return nf1.format(n) + ' ' + u[i];
    },
    uptime(sec) {
      sec = Math.floor(sec || 0);
      const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
      if (d) return d + ' gün ' + h + ' sa';
      if (h) return h + ' sa ' + m + ' dk';
      return m + ' dk';
    },
    bars(dbm) {
      if (dbm == null) return 0;
      if (dbm >= -55) return 4;
      if (dbm >= -65) return 3;
      if (dbm >= -75) return 2;
      return 1;
    },
    band(b) { return { '2g': '2,4 GHz', '5g': '5 GHz', '6g': '6 GHz', '60g': '60 GHz' }[b] || b; },
    mac(m) { return (m || '').toUpperCase(); },
  };

  const validate = {
    ip(s) {
      const p = String(s || '').split('.');
      return p.length === 4 && p.every((o) => /^\d{1,3}$/.test(o) && +o <= 255);
    },
    inSubnet(ip, cidr) {
      if (!validate.ip(ip) || !cidr) return false;
      const [net, bits] = cidr.split('/');
      const toInt = (a) => a.split('.').reduce((n, o) => (n << 8) + +o, 0) >>> 0;
      const mask = bits == 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (toInt(ip) & mask) === (toInt(net) & mask);
    },
    name(s) { return [...String(s || '')].length <= 32; },
    ssid(s) { const n = new TextEncoder().encode(String(s || '')).length; return n >= 1 && n <= 32; },
    wifiKey(s) { const n = String(s || '').length; return n >= 8 && n <= 63; },
  };

  /* ── sahte veri (router olmadan önizleme) ───────────────────────────────── */
  const mock = (function () {
    const nowS = () => Date.now() / 1000;
    const boot = nowS() - (3 * 86400 + 5 * 3600 + 720);
    const wanUp = nowS() - (2 * 86400 + 3600);
    const dev = [
      { mac: 'a4:83:e7:1c:22:01', ip: '192.168.1.101', host: 'iPhone', wifi: 'phy0-ap0', ssid: 'EvAgi', sig: -52, bw: [6e6, 8e5], hb: '5GHz', manu: 'Apple' },
      { mac: '3c:22:fb:9a:10:02', ip: '192.168.1.102', host: 'MacBook-Air', wifi: 'phy1-ap0', ssid: 'EvAgi-5G', sig: -44, bw: [24e6, 3e6], hb: '5GHz', manu: 'Apple' },
      { mac: 'f8:4d:89:5e:aa:03', ip: '192.168.1.103', host: 'LG-webOS-TV', bw: [18e6, 4e5], hb: 'LAN', manu: 'LG', web: ['http://192.168.1.103:8080/'] },
      { mac: 'd8:3a:dd:01:bc:04', ip: '192.168.1.104', host: 'raspberrypi', bw: [2e5, 1e5], web: ['http://192.168.1.104:8123/'] },
      { mac: '64:a2:f9:33:71:05', ip: '192.168.1.105', host: 'Galaxy-S24', wifi: 'phy0-ap0', ssid: 'EvAgi', sig: -67, bw: [3e6, 5e5], hb: '2.4GHz', manu: 'Samsung' },
      { mac: 'b0:be:76:42:e1:06', ip: '192.168.1.106', host: 'PS5', bw: [40e6, 2e6] },
      { mac: 'cc:50:e3:8a:0f:07', ip: '192.168.2.120', host: '', wifi: 'phy0-ap1', ssid: 'EvAgi-Misafir', sig: -74, bw: [1e6, 2e5], dev: 'br-guest' },
      { mac: '00:11:32:7d:4e:08', ip: '192.168.1.50', host: 'DiskStation', offline: true, bw: [0, 0] },
      { mac: '18:b4:30:aa:5d:09', ip: '192.168.1.110', host: 'Nest-Thermostat', wifi: 'phy0-ap0', ssid: 'EvAgi', sig: -79, bw: [5e4, 3e4], hb: '2.4GHz', manu: 'Google' },
      { mac: '00:e0:fc:12:34:01', ip: '192.168.1.2', host: 'HUAWEI-WiFi-AX2', bw: [2e4, 1e4], web: ['http://192.168.1.2/'], manu: 'Huawei' },
      { mac: 'bc:24:11:aa:00:10', ip: '192.168.1.10', host: 'pve', bw: [3e5, 2e5], web: ['https://192.168.1.10:8006/'] },
      { mac: '2c:f0:5d:11:22:12', ip: '192.168.1.120', host: 'DESKTOP-OYUN', bw: [30e6, 2e6], hb: 'LAN', manu: 'Micro-Star' },
    ];
    const meta = {
      'b0:be:76:42:e1:06': { name: 'Oyun konsolu', down: 50, up: 10, schedule: ['12345|23:00|07:00'] },
      '00:11:32:7d:4e:08': { name: 'NAS', type: 'nas' },
      'f8:4d:89:5e:aa:03': { name: 'Salon TV' },
    };
    const statics = { '00:11:32:7d:4e:08': '192.168.1.50', 'f8:4d:89:5e:aa:03': '192.168.1.103', '2c:f0:5d:11:22:12': '192.168.1.20' };
    const cnt = {};
    dev.forEach((d) => { cnt[d.mac] = { rx: Math.random() * 5e9, tx: Math.random() * 5e8 }; });
    let wanCnt = { rx: 812e9, tx: 64e9 };
    let lastTick = nowS();
    const wireless = {
      radio0: { '.type': 'wifi-device', '.name': 'radio0', band: '2g', channel: '6', htmode: 'HE20' },
      radio1: { '.type': 'wifi-device', '.name': 'radio1', band: '5g', channel: '36', htmode: 'HE80' },
      default_radio0: { '.type': 'wifi-iface', '.name': 'default_radio0', device: 'radio0', mode: 'ap', ssid: 'EvAgi', encryption: 'sae-mixed', key: 'evagi2024!', network: 'lan' },
      default_radio1: { '.type': 'wifi-iface', '.name': 'default_radio1', device: 'radio1', mode: 'ap', ssid: 'EvAgi-5G', encryption: 'sae-mixed', key: 'evagi2024!', network: 'lan' },
      guest_radio0: { '.type': 'wifi-iface', '.name': 'guest_radio0', device: 'radio0', mode: 'ap', ssid: 'EvAgi-Misafir', encryption: 'psk2', key: 'misafir123', network: 'guest' },
    };
    const ifnames = { default_radio0: 'phy0-ap0', default_radio1: 'phy1-ap0', guest_radio0: 'phy0-ap1' };
    let cpuT = 1e6, cpuI = 9e5;
    const wanCfg = { mode: 'balanced', primary: 'Turknet', wans: {
      Turknet: { proto: 'pppoe', enabled: true, device: 'eth1.35', base_device: 'eth1', vlan: 35, mtu: 0, metric: 10, username: 'ornek12fttx@netoneadsl', password_set: true, ipaddr: '', netmask: '', gateway: '', peerdns: false, dns: ['8.8.8.8'], mwan: true },
      wan2: { proto: 'dhcp', enabled: true, device: 'eth2', base_device: 'eth2', vlan: 0, mtu: 1492, metric: 20, username: '', password_set: false, ipaddr: '', netmask: '', gateway: '', peerdns: false, dns: ['1.1.1.1'], mwan: true } } };
    let wanBackup = null, wanPending = null;
    const nowSec = () => Math.floor(Date.now() / 1000);
    const sqm = { offload: true, queues: [{ section: 'eth1', enabled: true, interface: 'eth1', download: 900000, upload: 900000, qdisc: 'cake', script: 'piece_of_cake.qos', linklayer: 'none', overhead: 0 }] };
    let st = null; const stHist = [[nowSec() - 86400, 'Turknet', 921.3, 884.6, 4.2, 6.1, 12.3, 'A']];
    function stTick() {
      if (!st || !st.running) return;
      const el = (Date.now() - st.t0) / 1000, total = st.mode === 'sequential' ? 30 : 25;
      if (st.mode === 'sequential' && el >= 25 && st.runs.length) {
        // ikinci hat: wan2 demo'da çevrimdışı -> 5 sn boşta ping denemesi, sonra hata
        if (el < 30) { st.wan = 'wan2'; st.phase = 'idle'; st.progress = Math.round((el / total) * 100); return; }
        st.runs.push({ wan: 'wan2', down: 0, up: 0, idle_ms: null, down_ms: null, up_ms: null, grade: null, increase_ms: null, error: 'Ping yanıtı yok (hat çevrimdışı olabilir)' });
        st.running = false; st.phase = 'done'; st.progress = 100; st.wan = '*'; st.finished = nowSec();
        return;
      }
      st.progress = Math.min(99, Math.round((el / total) * 100));
      const q = sqm.queues[0] && sqm.queues[0].enabled ? sqm.queues[0] : null;
      const lim = (k, raw) => (q && q[k] ? Math.min(raw, q[k] / 1000) : raw);
      const eu = st.server === 'europe', rawD = eu ? 600 : 930, rawU = eu ? 480 : 890, idle = eu ? 38 : 4.1;
      const bloat = q && q.enabled && q.download < rawD * 1000 ? 2.5 : 9;
      if (el < 5) { st.phase = 'idle'; }
      else if (el < 15) { st.phase = 'download'; st.down = +(lim('download', rawD) * (0.85 + Math.random() * 0.1)).toFixed(1); st.idle_ms = idle; }
      else if (el < 25) { st.phase = 'upload'; st.up = +(lim('upload', rawU) * (0.85 + Math.random() * 0.1)).toFixed(1); st.down_ms = +(idle + bloat * 0.6).toFixed(1); }
      else {
        // aşamalar atlandıysa (seyrek yoklama) eksik değerleri doldur
        if (!st.down) st.down = +(lim('download', rawD) * 0.9).toFixed(1);
        if (!st.up) st.up = +(lim('upload', rawU) * 0.9).toFixed(1);
        if (st.idle_ms == null) st.idle_ms = idle;
        if (st.down_ms == null) st.down_ms = +(idle + bloat * 0.6).toFixed(1);
        st.running = false; st.phase = 'done'; st.progress = 100; st.up_ms = +(idle + bloat * 1.6).toFixed(1);
        const inc = Math.max(st.down_ms, st.up_ms) - st.idle_ms;
        st.grade = inc < 5 ? 'A+' : inc < 30 ? 'A' : inc < 60 ? 'B' : inc < 200 ? 'C' : inc < 400 ? 'D' : 'F';
        st.increase_ms = +inc.toFixed(1); st.idle_jitter_ms = 1.4; st.finished = nowSec();
        stHist.unshift([st.finished, st.mode === 'combined' ? '*' : st.wan, st.down, st.up, st.idle_ms, st.down_ms, st.up_ms, st.grade, st.mode]);
        if (st.mode === 'combined') {
          st.runs = [{ wan: 'Turknet', down: st.down, up: st.up, idle_ms: null, down_ms: null, up_ms: null, grade: null, increase_ms: null, error: '' },
            { wan: 'wan2', down: 0, up: 0, idle_ms: null, down_ms: null, up_ms: null, grade: null, increase_ms: null, error: '' }];
          st.wan = '*';
        } else {
          st.runs = [{ wan: st.wan, down: st.down, up: st.up, idle_ms: st.idle_ms, down_ms: st.down_ms, up_ms: st.up_ms, grade: st.grade, increase_ms: st.increase_ms, error: '' }];
        }
        if (st.mode === 'sequential') { st.running = true; st.phase = 'idle'; st.progress = 84; delete st.grade; }
      }
    }
    const wanEvents = [[nowSec() - 3372, 'wan2', 'disconnected'], [nowSec() - 3380, 'wan2', 'ifdown'], [nowSec() - 86400 * 2, 'Turknet', 'connected'],
      [nowSec() - 86400 * 2 - 40, 'Turknet', 'ifup'], [nowSec() - 86400 * 2 - 300, 'Turknet', 'disconnected']];
    const wanBegin = () => { if (!wanBackup) wanBackup = JSON.parse(JSON.stringify(wanCfg)); wanPending = nowSec() + 120;
      clearTimeout(wanBegin.t); wanBegin.t = setTimeout(() => { if (wanPending) { Object.assign(wanCfg, wanBackup); wanBackup = null; wanPending = null; wanEvents.unshift([nowSec(), '*', 'reverted']); } }, 120000); };
    const OWRT_WIFI = /[?&]mockwifi=1\b/.test(location.search);
    // ekler: kullanım, ping, yeni cihaz, bildirim, saat dilimi, tünel
    const demoUsage = (() => {
      const macs = ['b0:be:76:42:e1:06', '2c:f0:5d:11:22:12', '3c:22:fb:9a:10:02', 'f8:4d:89:5e:aa:03', 'a4:83:e7:1c:22:01', '64:a2:f9:33:71:05', 'd8:3a:dd:01:bc:04'];
      const scale = [4.2e9, 2.6e9, 1.1e9, 1.8e9, 0.45e9, 0.3e9, 0.05e9]; // günlük indirme (bayt)
      const days = [];
      for (let i = 0; i < 31; i++) {
        const d = new Date(Date.now() - i * 864e5);
        const wk = d.getDay() === 0 || d.getDay() === 6 ? 1.6 : 1;
        const items = macs.map((m, j) => [m, Math.round(scale[j] * wk * (0.5 + Math.random())), Math.round(scale[j] * 0.08 * (0.5 + Math.random()))]);
        const rx = items.reduce((a, x) => a + x[1], 0), tx = items.reduce((a, x) => a + x[2], 0);
        items.push(['wan:Turknet', Math.round(rx * 1.02), Math.round(tx * 1.05)], ['wan:wan2', 0, 0]);
        days.push({ date: d.toISOString().slice(0, 10), items });
      }
      return days;
    })();
    const demoPing = (() => {
      const out = [], now = Math.floor(Date.now() / 1000);
      for (let t = now - 24 * 3600; t <= now; t += 60) {
        const h = new Date(t * 1000).getHours(), evening = h >= 20 && h <= 23;
        out.push([t, 'Turknet', +(4 + Math.random() * 2 + (evening ? Math.random() * 6 : 0)).toFixed(1), Math.random() < 0.01 ? 25 : 0]);
        out.push([t, 'wan2', null, 100]);
      }
      // dün gece 03:10-03:14 arası Turknet kesintisi
      const cut = now - ((new Date().getHours() + 21) % 24) * 3600;
      out.forEach((p) => { if (p[1] === 'Turknet' && p[0] > cut && p[0] < cut + 300) { p[2] = null; p[3] = 100; } });
      return out;
    })();
    const demoNewdev = { block_new: false, seen: nowSec() - 7200, items: [
      { t: nowSec() - 1800, mac: '9c:2a:70:4d:11:aa', ip: '192.168.1.214', hostname: 'Galaxy-A54', unseen: true },
      { t: nowSec() - 86400 * 2, mac: '00:1e:06:33:aa:10', ip: '192.168.1.230', hostname: '', unseen: false },
    ] };
    const demoNotify = { enabled: false, chat_id: '', token_set: false, wan: true, newdev: true, presence: true, system: true, curl: true };
    const demoFw = { dmz_ip: '', ping: true };
    const demoTz = { zonename: 'UTC', timezone: 'GMT0' };
    const demoTp = { enabled: false, host: '', username: 'admin', pw: false, bands: { '2g': { enabled: true, ssid: 'TP-Link_BE230' }, '5g': { enabled: true, ssid: 'TP-Link_BE230_5G' } } };
    const demoInteg = { cloudflare: true, scanner: false, vpn: false, adguard: false };
    const demoAg = { configured: false, active: false, protection: true, global: [], clients: {} };
    const demoSt = { enabled: false, hour: 4, wan: '' };
    const demoSec = { root_pw_empty: true, https_available: false, https_redirect: false, wizard_done: false, tunnel_http_hosts: '' };
    const demoOpt = { reboot_mode: 'off', reboot_hour: 5, reboot_day: 1, alerts: true, temp_limit: 85 };
    const demoLog = [
      'daemon.info dnsmasq-dhcp[1]: DHCPACK(br-lan) 192.168.1.105 da:a1:19:aa:bb:cc Galaxy-S24',
      'daemon.notice netifd: Interface \'Turknet\' is now up',
      'daemon.warn odhcpd[2516]: No default route present, setting ra_lifetime to 0!',
      'user.notice netos: uyarı: Depolama alanı dolmak üzere: %91',
      'daemon.err uhttpd[1520]: Unable to open certificate /etc/uhttpd.crt',
      'kern.info kernel: [12345.6789] br-lan: port 2(eth1.35) entered forwarding state',
      'authpriv.info dropbear[2513]: Child connection from 192.168.1.185:49334',
      'daemon.info mwan3track[3011]: Check (ping) failed for target "1.1.1.1" on interface wan2 (eth2)',
    ];
    let demoScan = null;
    const demoUpd = { current: '1.2.0', auto: false, t0: 0 };
    const demoWans = [{ name: 'Turknet', ip: '100.66.93.98', kind: 'cgnat' }, { name: 'wan2', ip: '192.168.2.212', kind: 'private' }];
    const demoPf = { n: 2, rules: [{ id: 'cfg01', name: 'Kamera', proto: 'tcp', ext_port: '8443', ip: '192.168.1.139', int_port: '443', enabled: true }] };
    const demoPkg = { upnp: false, wireguard: false, qr: true, wol: true, t: {} };
    const demoUpnp = { enabled: false };
    const demoLan = { ip: '192.168.1.1', prefix: 24, dhcp: { enabled: true, start: 100, limit: 150, leasetime: '12h' }, dns: [], pending: null };
    const demoVpn = { configured: false, enabled: true, port: 51820, endpoint: '', n: 1, peers: [] };
    const demoQr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" shape-rendering="crispEdges"><rect width="29" height="29" fill="#fff"/>' +
      Array.from({ length: 29 * 29 }, (_, i) => { const x = i % 29, y = (i / 29) | 0, f = (a, b) => x >= a && x < a + 7 && y >= b && y < b + 7, r = (a, b) => f(a, b) && !(x > a && x < a + 6 && y > b && y < b + 6 && !(x > a + 1 && x < a + 5 && y > b + 1 && y < b + 5));
        return r(1, 1) || r(21, 1) || r(1, 21) || (!f(0, 0) && !f(20, 0) && !f(0, 20) && x > 0 && y > 0 && x < 28 && y < 28 && ((x * 7 + y * 13 + x * y) % 5 < 2)) ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ''; }).join('') + '</svg>';
    const demoCf = { installed: true, enabled: true, token_set: true, token_valid: true, tunnel_id: 'a1b2c3d4-1111-2222-3333-444455556666',
      running: true, connections: 4, hosts: [{ hostname: 'ha.ornek.com', service: 'http://192.168.1.199:8123' }], curl: true };
    const hwCfg = { dbho: false, bands: [
      { band: '2g', ssid: 'Huawei-EvAgi', enabled: true, security: '11i', encryption: 'AES', channel: '0', actual_channel: '6', hidden: false, standard: 'b/g/n/ax', bandwidth: '20_40' },
      { band: '5g', ssid: 'Huawei-EvAgi-5G', enabled: true, security: '11iandWPA3', encryption: 'AES+SAE', channel: '36', actual_channel: '36', hidden: false, standard: 'a/n/ac/ax', bandwidth: '20_40_80' },
    ] };
    const hw = { enabled: true, host: '192.168.1.2', username: 'admin', dbho: false, on2g: true, on5g: true };

    function tick() {
      const t = nowS(), dt = Math.max(0, t - lastTick);
      lastTick = t;
      let sr = 0, st = 0;
      dev.forEach((d) => {
        const m = meta[d.mac] || {};
        if (d.offline || m.blocked) return;
        const j = () => 0.4 + Math.random() * 1.2;
        let down = d.bw[0] * j(), up = d.bw[1] * j();
        if (m.down) down = Math.min(down, m.down * 1e6);
        if (m.up) up = Math.min(up, m.up * 1e6);
        cnt[d.mac].rx += (down / 8) * dt;
        cnt[d.mac].tx += (up / 8) * dt;
        sr += down; st += up;
      });
      wanCnt.rx += ((sr * 1.03) / 8) * dt;
      wanCnt.tx += ((st * 1.05) / 8) * dt;
    }

    function wifiDisabled(ifname) {
      const s = Object.keys(ifnames).find((k) => ifnames[k] === ifname);
      return s && wireless[s].disabled === '1';
    }

    const handlers = {
      'session.login': () => ({ ubus_rpc_session: 'mock' + Math.random().toString(16).slice(2) }),
      'session.destroy': () => ({}),
      'system.board': () => ({
        hostname: 'OpenWrt', model: 'Intel N100 Mini PC', kernel: '6.6.73',
        release: { description: 'OpenWrt 24.10.0 r28427-6df0e3d02a' },
      }),
      'system.info': () => ({
        uptime: Math.floor(nowS() - boot),
        load: [0.21, 0.17, 0.12].map((l) => Math.round((l + Math.random() * 0.1) * 65536)),
        memory: { total: 8e9, free: 6.9e9, available: 7.3e9, buffered: 4e7, cached: 2.6e8 },
      }),
      'network.interface.dump': () => ({
        interface: [
          { interface: 'lan', up: true, proto: 'static', device: 'br-lan', l3_device: 'br-lan', uptime: nowS() - boot, 'ipv4-address': [{ address: '192.168.1.1', mask: 24 }], route: [] },
          { interface: 'guest', up: true, proto: 'static', device: 'br-guest', l3_device: 'br-guest', uptime: nowS() - boot, 'ipv4-address': [{ address: '192.168.2.1', mask: 24 }], route: [] },
          { interface: 'Turknet', up: true, proto: 'pppoe', device: 'eth1.35', l3_device: 'pppoe-Turknet', metric: 10, uptime: Math.floor(nowS() - wanUp), 'ipv4-address': [{ address: '100.66.93.98', mask: 32, ptpaddress: '172.17.1.9' }], route: [{ target: '0.0.0.0', mask: 0, nexthop: '172.17.1.9' }], 'dns-server': ['8.8.8.8'] },
          { interface: 'wan2', up: true, proto: 'dhcp', device: 'eth2', l3_device: 'eth2', metric: 20, uptime: Math.floor(nowS() - wanUp), 'ipv4-address': [{ address: '192.168.2.212', mask: 24 }], route: [{ target: '0.0.0.0', mask: 0, nexthop: '192.168.2.1' }], 'dns-server': ['1.1.1.1'] },
          { interface: 'wan', up: false, proto: 'dhcp', device: 'eth1', uptime: 0, 'ipv4-address': [], route: [] },
          { interface: 'wan6', up: false, proto: 'dhcpv6', device: 'eth1', uptime: 0, 'ipv4-address': [], route: [] },
          { interface: 'loopback', up: true, proto: 'static', device: 'lo', l3_device: 'lo', 'ipv4-address': [{ address: '127.0.0.1', mask: 8 }] },
        ],
      }),
      'network.device.status': (a) => { tick(); return a.name === 'pppoe-Turknet' ? { statistics: { rx_bytes: Math.floor(wanCnt.rx), tx_bytes: Math.floor(wanCnt.tx) } } : { statistics: { rx_bytes: 1234567, tx_bytes: 76543 } }; },
      'mwan3.status': () => ({ interfaces: {
        Turknet: { status: 'online', online: 3432, offline: 0, lost: 0, score: 10, track_ip: [{ ip: '1.1.1.1', status: 'up', latency: 6, packetloss: 0 }] },
        wan2: { status: 'offline', online: 0, offline: 3372, lost: 384, score: 0, track_ip: [{ ip: '1.1.1.1', status: 'down', latency: 0, packetloss: 100 }] } } }),
      'netpanel.sysinfo': () => { cpuT += 200 + Math.floor(Math.random() * 40); cpuI += 150 + Math.floor(Math.random() * 40);
        return { model: 'QEMU Virtual CPU version 2.5+', cores: 2, cpu: { total: cpuT, idle: cpuI }, disk: { total: 15156772864, used: 105213952 } }; },
      'netpanel.set_password': (a) => (a.old === 'yanlis' ? { ok: false, error: 'Mevcut şifre yanlış' } : ((demoSec.root_pw_empty = false), { ok: true })),
      'netpanel.web_scan': () => ({ ok: true }),
      'netpanel.sqm_config': () => ({ installed: true, offload: sqm.offload, offload_hw: false,
        scripts: ['layer_cake.qos', 'piece_of_cake.qos', 'simple.qos', 'simplest.qos', 'simplest_tbf.qos'],
        wans: [{ name: 'Turknet', device: 'eth1', l3_device: 'pppoe-Turknet' }, { name: 'wan2', device: 'eth2', l3_device: 'eth2' }],
        queues: sqm.queues.map((q) => ({ ...q, active: q.enabled })) }),
      'netpanel.sqm_set': (a) => {
        let q = sqm.queues.find((x) => x.section === a.section);
        if (!q) { if (!a.interface) return { ok: false, error: 'Arayüz seçilmeli' }; q = { section: 'cfg' + Math.random().toString(16).slice(2, 8), enabled: false, interface: a.interface, download: 0, upload: 0, qdisc: 'cake', script: 'piece_of_cake.qos', linklayer: 'none', overhead: 0 }; sqm.queues.push(q); }
        for (const k of ['download', 'upload']) if (a[k] != null && a[k] !== 0 && (a[k] < 1000 || a[k] > 1e7)) return { ok: false, error: 'Hız 1000-10000000 kbit/s arası olmalı (0 = sınırsız)' };
        ['interface', 'download', 'upload', 'script', 'linklayer', 'overhead', 'enabled'].forEach((k) => { if (a[k] != null) q[k] = a[k]; });
        return { ok: true, section: q.section };
      },
      'netpanel.sqm_delete': (a) => { sqm.queues = sqm.queues.filter((q) => q.section !== a.section); return { ok: true }; },
      'netpanel.set_offload': (a) => { sqm.offload = !!a.enabled; return { ok: true }; },
      'netpanel.speedtest_start': (a) => {
        if (st && st.running) return { ok: false, error: 'Bir test zaten çalışıyor' };
        const mode = a.mode || (a.wan === 'all' ? 'sequential' : 'single');
        st = { running: true, mode, server: a.server || 'speedtest.turk.net:8080', wans_total: mode === 'single' ? 1 : 2, phase: 'starting', progress: 0, wan: a.wan && a.wan !== 'all' ? a.wan : 'Turknet', started: nowSec(), t0: Date.now(),
          down: 0, up: 0, idle_ms: null, down_ms: null, up_ms: null, error: '', runs: [] };
        return { ok: true };
      },
      'netpanel.speedtest_status': () => { stTick(); const c = st ? { ...st } : null; if (c) delete c.t0;
        return { current: c, history: stHist.map(([t, wan, down, up, i, d, u, g, m]) => ({ t, wan, down, up, idle_ms: i, down_ms: d, up_ms: u, grade: g, mode: m || 'single' })) }; },
      'netpanel.wan_config': () => {
        const names = Object.keys(wanCfg.wans);
        const members = wanCfg.mode === 'single' ? [wanCfg.primary] : names;
        return { policy: 'netos', mode: wanCfg.mode, primary: wanCfg.primary, mwan3: true, now: nowSec(),
          ...(wanPending ? { pending_until: wanPending } : {}),
          members: members.map((i) => ({ iface: i, metric: wanCfg.mode === 'failover' && i !== wanCfg.primary ? 2 : 1, weight: 1 })),
          wans: names.map((k) => ({ name: k, ...wanCfg.wans[k] })) };
      },
      'netpanel.wan_set': (a) => {
        const w = wanCfg.wans[a.name];
        if (!w) return { ok: false, error: 'Bilinmeyen internet bağlantısı' };
        if (a.proto === 'pppoe' && !(a.username || w.username)) return { ok: false, error: 'PPPoE kullanıcı adı gerekli' };
        wanBegin();
        if (a.proto) w.proto = a.proto;
        if (a.username != null) w.username = a.username;
        if (a.password) w.password_set = true;
        if (a.vlan != null) { w.vlan = a.vlan; w.device = a.vlan ? w.base_device + '.' + a.vlan : w.base_device; }
        if (a.mtu != null) w.mtu = a.mtu;
        if (a.dns != null) { w.dns = a.dns ? a.dns.split(',') : []; w.peerdns = !a.dns; }
        ['ipaddr', 'netmask', 'gateway'].forEach((k) => { if (a[k] != null) w[k] = a[k]; });
        if (a.enabled != null) w.enabled = a.enabled;
        wanEvents.unshift([nowSec(), a.name, 'configured']);
        return { ok: true, changed: true, pending_until: wanPending };
      },
      'netpanel.wan_mode': (a) => { wanBegin(); wanCfg.mode = a.mode; wanCfg.primary = a.primary; wanEvents.unshift([nowSec(), '*', 'mode:' + a.mode + ':' + a.primary]); return { ok: true, pending_until: wanPending }; },
      'netpanel.wan_confirm': () => { wanBackup = null; wanPending = null; clearTimeout(wanBegin.t); return { ok: true }; },
      'netpanel.wan_revert': () => { if (wanBackup) { Object.assign(wanCfg, wanBackup); wanBackup = null; wanPending = null; wanEvents.unshift([nowSec(), '*', 'reverted']); } return { ok: true }; },
      'netpanel.wan_reconnect': (a) => { wanEvents.unshift([nowSec(), a.name, 'reconnect']); return { ok: true }; },
      'netpanel.wan_events': () => ({ events: wanEvents.map(([t, iface, event]) => ({ t, iface, event })) }),
      'uci.get': (a) => (a.config === 'wireless' && OWRT_WIFI ? { values: JSON.parse(JSON.stringify(wireless)) }
        : a.config === 'firewall' ? { values: { cfg01: { '.type': 'zone', name: 'lan', network: ['lan'] }, cfg02: { '.type': 'zone', name: 'wan', network: ['Turknet', 'wan2'] } } }
        : { values: {} }),
      'network.wireless.status': () => {
        const r = {};
        if (!OWRT_WIFI) return r;
        ['radio0', 'radio1'].forEach((radio) => {
          r[radio] = {
            up: wireless[radio].disabled !== '1', disabled: wireless[radio].disabled === '1',
            interfaces: Object.keys(ifnames)
              .filter((s) => wireless[s].device === radio && wireless[s].disabled !== '1')
              .map((s) => ({ section: s, ifname: ifnames[s] })),
          };
        });
        return r;
      },
      'netpanel.status': () => ({ version: demoUpd.current, offload: sqm.offload, offload_hw: false, table: true, counters: !sqm.offload }),
      'netpanel.clients': () => {
        tick();
        return {
          clients: dev.map((d) => {
            const m = meta[d.mac] || {};
            // OpenWrt'de Wi-Fi yoksa kablosuz cihazlar Huawei üzerinden "kablolu" (br-lan) görünür
            const w = OWRT_WIFI && d.wifi;
            const wifiOff = w ? wifiDisabled(d.wifi) : (d.wifi && !hw.on2g && !hw.on5g);
            const online = !d.offline && !wifiOff;
            return {
              mac: d.mac, ip: d.ip, name: m.name || '', hostname: d.host,
              static: !!statics[d.mac], static_ip: statics[d.mac] || '', online,
              state: online ? 'REACHABLE' : 'FAILED', dev: d.dev || 'br-lan',
              conn: w ? 'wifi' : 'lan', wifi_dev: online && w ? d.wifi : '', ssid: online && w ? d.ssid : '',
              signal: online && w ? d.sig + Math.round(Math.random() * 4 - 2) : null,
              rx_bytes: Math.floor(cnt[d.mac].rx), tx_bytes: Math.floor(cnt[d.mac].tx),
              limit_down: m.down || 0, limit_up: m.up || 0, blocked: !!m.blocked, lease_expires: 0,
              type: m.type || '', vendor: d.manu || '', web: d.web || [], priority: !!m.priority, presence: !!m.presence, schedule: m.schedule || [], sched_blocked: !!m.schedBlockedDemo,
              via: !w && d.hb ? 'huawei' : 'router',
              band: !w && d.hb && d.hb !== 'LAN' ? (d.hb[0] === '2' ? '2g' : '5g') : '',
              ...(!w && d.hb && d.hb !== 'LAN' ? { conn: 'wifi' } : {}),
            };
          }),
        };
      },
      'netpanel.set_client': (a) => {
        const m = (meta[a.mac] = meta[a.mac] || {});
        if (a.name != null) m.name = a.name;
        if (a.down != null) m.down = a.down;
        if (a.up != null) m.up = a.up;
        if (a.blocked != null) m.blocked = a.blocked;
        if (a.type != null) m.type = a.type;
        if (a.priority != null) m.priority = a.priority;
        if (a.presence != null) m.presence = a.presence;
        if (a.schedule != null) m.schedule = a.schedule;
        if (a.static === true) {
          const other = Object.keys(statics).find((k) => statics[k] === a.ip && k !== a.mac);
          if (other) return { ok: false, error: 'Bu IP başka bir cihaza ayrılmış (' + other + ')' };
          if (a.ip === '192.168.1.1') return { ok: false, error: 'Bu IP routerın kendi adresi' };
          statics[a.mac] = a.ip;
        } else if (a.static === false) delete statics[a.mac];
        return { ok: true };
      },
      'netpanel.forget_client': (a) => { delete meta[a.mac]; delete statics[a.mac]; return { ok: true }; },
      'netpanel.set_wifi': (a) => {
        const s = wireless[a.section];
        if (!s) return { ok: false, error: 'Wi-Fi ağı bulunamadı' };
        if (a.ssid != null) s.ssid = a.ssid;
        if (a.key != null) s.key = a.key;
        if (a.disabled != null) { if (a.disabled) s.disabled = '1'; else delete s.disabled; }
        return { ok: true };
      },
      'system.reboot': () => ({}),
      'netpanel.hw_status': () => (hw.enabled
        ? {
          enabled: true, host: hw.host, username: hw.username, password_set: true, connected: true, dbho: hw.dbho,
          radios: [{ band: '2g', enabled: hw.on2g, ssid: 'Huawei-EvAgi' }, { band: '5g', enabled: hw.on5g, ssid: hw.dbho ? 'Huawei-EvAgi' : 'Huawei-EvAgi-5G' }],
          clients: (hw.on2g || hw.on5g) ? 6 : 0,
        }
        : { enabled: false, host: hw.host, username: hw.username, password_set: false, connected: false }),
      'netpanel.hw_set': (a) => {
        if (hw.dbho) hw.on2g = hw.on5g = a.enabled;
        else if (a.band === '2g') hw.on2g = a.enabled;
        else hw.on5g = a.enabled;
        return { ok: true };
      },
      'netpanel.usage_get': (a) => ({ days: demoUsage.slice(0, a.days || 31) }),
      'netpanel.ping_get': (a) => { const s = nowSec() - (a.hours || 24) * 3600; return { samples: demoPing.filter((p) => p[0] >= s) }; },
      'netpanel.newdev_list': () => ({ ...demoNewdev, block_new: !!demoNotify.block_new }),
      'netpanel.newdev_ack': () => { demoNewdev.items.forEach((x) => (x.unseen = false)); return { ok: true }; },
      'netpanel.notify_get': () => ({ ...demoNotify, block_new: !!demoNotify.block_new }),
      'netpanel.notify_set': (a) => {
        if (a.token && !/^\d{5,12}:[A-Za-z0-9_-]{30,50}$/.test(a.token)) return { ok: false, error: 'Telegram bot token biçimi hatalı (ör. 123456789:AAH...)' };
        if (a.chat_id != null && !/^-?\d{3,20}$/.test(a.chat_id)) return { ok: false, error: 'Chat ID sayı olmalı (gruplar için eksi ile başlar)' };
        if (a.token) demoNotify.token_set = true;
        ['enabled', 'chat_id', 'wan', 'newdev', 'block_new'].forEach((k) => { if (a[k] != null) demoNotify[k] = a[k]; });
        return { ok: true };
      },
      'netpanel.notify_test': () => (demoNotify.token_set && demoNotify.chat_id ? { ok: true } : { ok: false, error: 'Token veya Chat ID eksik' }),
      'netpanel.tz_get': () => ({ ...demoTz, now: new Date(Date.now() + (demoTz.zonename === 'Europe/Istanbul' ? 0 : -3 * 3600e3)).toISOString().slice(0, 16).replace('T', ' '), offset: demoTz.zonename === 'Europe/Istanbul' ? '+0300' : '+0000' }),
      'netpanel.tz_set': (a) => { demoTz.zonename = a.zone; return { ok: true, zonename: a.zone }; },
      'netpanel.backup_create': () => ({ ok: true, name: 'netos-yedek-demo.tar.gz', size: 18, data: btoa('NetOS demo yedek\n') }),
      'netpanel.backup_restore': (a) => (a.data && a.data.length > 10 ? { ok: false, error: 'Demo modunda geri yükleme yapılmaz' } : { ok: false, error: 'Bu bir OpenWrt yedeği değil (etc/config yok)' }),
      'netpanel.cf_status': () => JSON.parse(JSON.stringify(demoCf)),
      'netpanel.integ_get': () => ({ huawei: !!hw.enabled, cloudflare: demoInteg.cloudflare, scanner: demoInteg.scanner, vpn: demoInteg.vpn, adguard: demoInteg.adguard, tplink: demoTp.enabled, cloudflared: true, adguardhome: true, curl: true }),
      'netpanel.ag_status': () => ({ installed: true, configured: demoAg.configured, running: demoAg.configured, active: demoAg.active, creds: demoAg.configured, web_port: 3000, lan_ip: '192.168.1.1',
        stats: demoAg.configured ? { protection: demoAg.protection, version: '0.107.73', disabled_until: null, queries: 48213, blocked: 9137, avg_ms: 11.4,
          top_blocked: [['googleads.g.doubleclick.net', 1843], ['graph.facebook.com', 1210], ['app-measurement.com', 977], ['mcs.tiktokv.com', 702], ['data.mistat.xiaomi.com', 611], ['ads.youtube.com', 433]].map(([name, count]) => ({ name, count })),
          top_clients: [['192.168.1.120', 18000], ['192.168.1.105', 9000]].map(([name, count]) => ({ name, count })) } : null }),
      'netpanel.ag_setup': (a) => { if ((a.password || '').length < 8) return { ok: false, error: 'Şifre 8-64 karakter olmalı' }; demoAg.configured = demoAg.active = true; return { ok: true, web: 'http://192.168.1.1:3000' }; },
      'netpanel.ag_enable': (a) => { demoAg.active = !!a.enabled; return { ok: true }; },
      'netpanel.ag_connect': () => ({ ok: true }),
      'netpanel.ag_protection': (a) => { demoAg.protection = !!a.enabled; return { ok: true }; },
      'netpanel.ag_services': () => ({ services: [['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['twitter', 'X (Twitter)'], ['snapchat', 'Snapchat'], ['whatsapp', 'WhatsApp'], ['telegram', 'Telegram'], ['discord', 'Discord'], ['roblox', 'Roblox'], ['minecraft', 'Minecraft'], ['fortnite', 'Fortnite'], ['steam', 'Steam'], ['epic_games', 'Epic Games'], ['twitch', 'Twitch'], ['netflix', 'Netflix'], ['spotify', 'Spotify'], ['reddit', 'Reddit'], ['pinterest', 'Pinterest'], ['tinder', 'Tinder'], ['9gag', '9GAG'], ['kick', 'Kick'], ['amazon', 'Amazon'], ['ebay', 'eBay']].map(([id, name]) => ({ id, name, group: '' })) }),
      'netpanel.ag_global_get': () => ({ services: demoAg.global.slice() }),
      'netpanel.ag_global_set': (a) => { demoAg.global = a.services.slice(); return { ok: true }; },
      'netpanel.ag_client_get': (a) => ({ custom: !!demoAg.clients[a.mac], filtering: true, parental: false, safesearch: false, services: [], ...(demoAg.clients[a.mac] || {}) }),
      'netpanel.ag_client_set': (a) => { const def = a.filtering && !a.parental && !a.safesearch && !a.services.length; if (def) delete demoAg.clients[a.mac]; else demoAg.clients[a.mac] = { filtering: a.filtering, parental: a.parental, safesearch: a.safesearch, services: a.services }; return { ok: true, custom: !def }; },
      'netpanel.st_sched_get': () => ({ ...demoSt }),
      'netpanel.tp_status': () => ({ enabled: demoTp.enabled, host: demoTp.host, username: demoTp.username, password_set: demoTp.pw,
        connected: demoTp.enabled && demoTp.pw && !!demoTp.host, error: demoTp.enabled && !demoTp.pw ? 'TP-Link şifresi girilmedi' : '',
        bands: demoTp.enabled && demoTp.pw ? Object.entries(demoTp.bands).map(([band, b]) => ({ band, ...b })) : [] }),
      'netpanel.tp_config': (a) => { if (a.host) demoTp.host = a.host; if (a.username) demoTp.username = a.username; if (a.password) demoTp.pw = true; if (a.enabled != null) demoTp.enabled = a.enabled; return { ok: true }; },
      'netpanel.tp_set': (a) => { demoTp.bands[a.band].enabled = !!a.enabled; return { ok: true }; },
      'netpanel.tp_wifi_set': (a) => { if (a.ssid) demoTp.bands[a.band].ssid = a.ssid; return { ok: true }; },
      'netpanel.sec_get': () => ({ ...demoSec }),
      'netpanel.sec_https': (a) => { demoSec.https_redirect = !!a.redirect; return { ok: true }; },
      'netpanel.wizard_done': () => { demoSec.wizard_done = true; return { ok: true }; },
      'netpanel.log_get': (a) => {
        const now = Date.now();
        let lines = Array.from({ length: 60 }, (_, i) => `${((d) => d.toString().slice(0, 10) + ' ' + d.toTimeString().slice(0, 8) + ' ' + d.getFullYear())(new Date(now - (60 - i) * 47000))} ${demoLog[i % demoLog.length]}`);
        if (a.level === 'err') lines = lines.filter((l) => /\.(err|crit)/.test(l));
        else if (a.level === 'warn') lines = lines.filter((l) => /\.(warn|err|crit)/.test(l));
        if (a.q) lines = lines.filter((l) => l.toLowerCase().includes(a.q.toLowerCase()));
        return { lines: lines.slice(-a.lines) };
      },
      'netpanel.sysopt_get': () => ({ ...demoOpt }),
      'netpanel.sysopt_set': (a) => { Object.assign(demoOpt, a); return { ok: true }; },
      'netpanel.st_sched_set': (a) => { Object.assign(demoSt, { enabled: !!a.enabled, hour: a.hour, wan: a.wan }); return { ok: true }; },
      'netpanel.integ_set': (a) => { if (a.id === 'huawei') hw.enabled = !!a.enabled; else demoInteg[a.id] = !!a.enabled; return { ok: true }; },
      'netpanel.scan_start': (a) => {
        if (a.range && !/^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(a.range)) return { ok: false, error: 'Yalnız yerel (özel) adresler taranabilir: 10.x, 172.16-31.x, 192.168.x' };
        demoScan = { t0: Date.now(), ports: a.ports !== false, range: a.range || '' }; return { ok: true };
      },
      'netpanel.scan_wol': () => ({ ok: true }),
      'netpanel.pf_list': () => ({ rules: JSON.parse(JSON.stringify(demoPf.rules)), upnp: { installed: demoPkg.upnp, enabled: demoUpnp.enabled, running: demoUpnp.enabled,
        leases: demoUpnp.enabled ? [{ proto: 'udp', ext_port: '3074', ip: '192.168.1.106', int_port: '3074', desc: 'Xbox Live' }, { proto: 'tcp', ext_port: '51413', ip: '192.168.1.120', int_port: '51413', desc: 'qBittorrent' }] : [] },
        wans: demoWans, lan: { ip: demoLan.ip, prefix: 24 }, fw: { ...demoFw } }),
      'netpanel.fw_set': (a) => { if (a.ping != null) demoFw.ping = a.ping; if (a.dmz_ip != null) demoFw.dmz_ip = a.dmz_ip; return { ok: true }; },
      'netpanel.conn_list': () => ({ total: 37, items: [['149.154.167.99', 'tcp', 443, 3, 9078934, ''], ['142.250.187.110', 'udp', 443, 2, 6868939, 'sof02s45-in-f14.1e100.net'], ['104.18.32.47', 'tcp', 443, 3, 2763660, ''], ['17.253.53.207', 'tcp', 5223, 1, 52300, 'usdal2-vip-bx-001.aaplimg.com'], ['192.168.1.1', 'udp', 53, 12, 18233, ''], ['162.159.200.1', 'udp', 123, 1, 152, 'time.cloudflare.com']].map(([dst, proto, port, count, bytes, name]) => ({ dst, proto, port, count, bytes, name })) }),
      'netpanel.pf_set': (a) => {
        if (!/^\d{1,5}(-\d{1,5})?$/.test(a.ext_port)) return { ok: false, error: 'Dış port 1-65535 arasında olmalı (aralık için 5000-5010)' };
        if (!/^192\.168\.1\.\d+$/.test(a.ip) || a.ip === '192.168.1.1') return { ok: false, error: 'Hedef IP yerel ağda olmalı (192.168.1.1/24)' };
        const clash = demoPf.rules.find((r) => r.id !== a.id && r.enabled && r.ext_port === a.ext_port);
        if (clash) return { ok: false, error: `Dış port ${a.ext_port} zaten "${clash.name}" kuralında kullanılıyor` };
        const rule = { id: a.id || 'cfg0' + demoPf.n++, name: a.name || `NetOS ${a.ip}:${a.int_port || a.ext_port}`, proto: a.proto, ext_port: a.ext_port, ip: a.ip, int_port: a.int_port || a.ext_port, enabled: a.enabled !== false };
        const i = demoPf.rules.findIndex((r) => r.id === a.id);
        if (i >= 0) demoPf.rules[i] = rule; else demoPf.rules.push(rule);
        return { ok: true, id: rule.id };
      },
      'netpanel.pf_delete': (a) => { demoPf.rules = demoPf.rules.filter((r) => r.id !== a.id); return { ok: true }; },
      'netpanel.upnp_set': (a) => { demoUpnp.enabled = !!a.enabled; return { ok: true }; },
      'netpanel.lan_get': () => ({ ip: demoLan.ip, prefix: 24, dhcp: { ...demoLan.dhcp }, dns: demoLan.dns.slice(), static_hosts: 3,
        pending: demoLan.pending && Date.now() < demoLan.pending.until * 1000 ? demoLan.pending : null }),
      'netpanel.lan_set': (a) => {
        if (a.start + a.limit - 1 > 254) return { ok: false, error: 'DHCP aralığı .2 ile .254 arasında kalmalı' };
        const changed = a.ip !== demoLan.ip;
        if (changed) demoLan.pending = { until: Math.floor(Date.now() / 1000) + 120, old_ip: demoLan.ip, new_ip: a.ip };
        demoLan.ip = a.ip; demoLan.dhcp = { enabled: a.dhcp_enabled, start: a.start, limit: a.limit, leasetime: a.leasetime }; demoLan.dns = a.dns;
        return { ok: true, ip_changed: changed, new_ip: a.ip, moved: changed ? 4 : 0, pending_until: changed ? demoLan.pending.until : null };
      },
      'netpanel.lan_confirm': () => { demoLan.pending = null; return { ok: true }; },
      'netpanel.lan_revert': () => { if (demoLan.pending) demoLan.ip = demoLan.pending.old_ip; demoLan.pending = null; return { ok: true }; },
      'netpanel.wg_status': () => ({ installed: demoPkg.wireguard, qrencode: true, configured: demoVpn.configured, enabled: demoVpn.enabled, up: demoVpn.configured && demoVpn.enabled,
        port: demoVpn.port, subnet: '10.99.0.1/24', endpoint: demoVpn.endpoint, wans: demoWans, peers: JSON.parse(JSON.stringify(demoVpn.peers)) }),
      'netpanel.wg_setup': (a) => { if (!demoPkg.wireguard) return { ok: false, error: 'WireGuard paketi kurulu değil' }; demoVpn.configured = true; demoVpn.port = a.port; demoVpn.endpoint = a.endpoint; return { ok: true }; },
      'netpanel.wg_set': (a) => { demoVpn.enabled = !!a.enabled; if (a.endpoint != null) demoVpn.endpoint = a.endpoint; return { ok: true }; },
      'netpanel.wg_add': (a) => {
        const ip = '10.99.0.' + ++demoVpn.n, id = 'wgp' + demoVpn.n;
        demoVpn.peers.push({ id, name: a.name, ip, handshake: demoVpn.n === 2 ? Math.floor(Date.now() / 1000) - 40 : 0, rx: 1843200, tx: 9437184, endpoint: '' });
        const conf = `[Interface]\nPrivateKey = DEMO-istemci-anahtari-yalnizca-ornek=\nAddress = ${ip}/32\nDNS = 192.168.1.1\n\n[Peer]\nPublicKey = DEMO-sunucu-anahtari=\nPresharedKey = DEMO-psk=\nEndpoint = ${demoVpn.endpoint || 'ev.ornek.com'}:${demoVpn.port}\nAllowedIPs = ${a.full_tunnel ? '0.0.0.0/0' : '10.99.0.0/24, 192.168.1.0/24'}\nPersistentKeepalive = 25\n`;
        return { ok: true, id, ip, config: conf, qr: demoQr };
      },
      'netpanel.wg_delete': (a) => { demoVpn.peers = demoVpn.peers.filter((p) => p.id !== a.id); return { ok: true }; },
      'netpanel.qr': () => ({ ok: true, svg: demoQr }),
      'netpanel.pkg_install': (a) => { demoPkg.t[a.set] = Date.now(); return { ok: true, running: true }; },
      'netpanel.pkg_status': (a) => {
        const t = demoPkg.t[a.set];
        if (t && Date.now() - t > 3000) { demoPkg[a.set] = true; delete demoPkg.t[a.set]; }
        return { installed: !!demoPkg[a.set], running: !!demoPkg.t[a.set], failed: false, log: demoPkg.t[a.set] ? 'Installing…' : '' };
      },
      'netpanel.update_check': () => ({ current: demoUpd.current, latest: '1.3.0', available: demoUpd.current !== '1.3.0', notes: '- Ağ tarayıcıya özel IP aralığı\n- Wake-on-LAN\n- Hata düzeltmeleri', published: '2026-11-27T09:00:00Z', url: 'https://github.com/baristilki/netos-openwrt/releases/tag/v1.3.0', repo: 'baristilki/netos-openwrt', auto: demoUpd.auto, checked: Math.floor(Date.now() / 1000), error: '' }),
      'netpanel.update_apply': () => { demoUpd.t0 = Date.now(); return { ok: true }; },
      'netpanel.update_status': () => {
        if (!demoUpd.t0) return { state: 'idle', current: demoUpd.current, log: '' };
        const el = Date.now() - demoUpd.t0;
        if (el < 4000) return { state: 'running', current: demoUpd.current, log: 'İndiriliyor: v1.3.0\nKuruluyor…\n' };
        demoUpd.current = '1.3.0';
        return { state: 'done', current: '1.3.0', log: 'Tamam: 1.3.0\n' };
      },
      'netpanel.update_set': (a) => { demoUpd.auto = !!a.auto; return { ok: true }; },
      'netpanel.scan_status': () => {
        if (!demoScan) return { running: false, phase: 'idle', done: 0, total: 0, started: 0, finished: 0, result: null };
        const el = Date.now() - demoScan.t0, t0 = Math.floor(demoScan.t0 / 1000);
        if (el < 3000) return { running: true, phase: 'ping', done: Math.min(254, Math.round((el / 3000) * 254)), total: 254, started: t0, finished: 0, result: null };
        if (demoScan.ports && el < 5000) return { running: true, phase: 'ports', done: Math.round(((el - 3000) / 2000) * 14), total: 14, started: t0, finished: 0, result: null };
        const H = (ip, mac, name, ping, web = [], ports = []) => ({ ip, mac, name, net: 'lan', ping, self: ip === '192.168.1.1', web, ports });
        return { running: false, phase: 'done', done: 14, total: 14, started: t0, finished: t0 + 6, result: { range: demoScan.range, nets: [{ name: 'lan', cidr: '192.168.1.1/24' }], ports_checked: demoScan.ports, tcp_checked: demoScan.ports, hosts: [
          H('192.168.1.1', '', 'OpenWrt', 0.05, ['http://192.168.1.1/', 'https://192.168.1.1/'], [{ port: 22, name: 'SSH' }, { port: 53, name: 'DNS' }]),
          H('192.168.1.2', '00:e0:fc:12:34:01', 'HUAWEI-WiFi-AX2', 4.4, ['http://192.168.1.2/'], [{ port: 53, name: 'DNS' }]),
          H('192.168.1.10', 'bc:24:11:00:00:10', 'pve', 2.0, ['https://192.168.1.10:8006/'], [{ port: 22, name: 'SSH' }]),
          H('192.168.1.101', 'a2:11:22:33:44:55', 'iPhone', 12.3),
          H('192.168.1.102', '8c:85:90:11:22:33', 'MacBook-Air', 3.1, [], [{ port: 22, name: 'SSH' }, { port: 5900, name: 'VNC' }]),
          H('192.168.1.105', 'da:a1:19:aa:bb:cc', 'Galaxy-S24', 25.7),
          H('192.168.1.106', 'b0:be:76:42:e1:06', 'Oyun konsolu', 2.2),
          H('192.168.1.120', '04:d4:c4:11:22:33', 'DESKTOP-OYUN', 1.9, [], [{ port: 139, name: 'NetBIOS' }, { port: 445, name: 'SMB' }, { port: 3389, name: 'RDP' }]),
          H('192.168.1.139', '00:1a:2b:aa:01:39', 'Kamera', 2.7, ['http://192.168.1.139/'], [{ port: 554, name: 'RTSP' }]),
          H('192.168.1.148', '00:1a:2b:aa:01:48', 'BroadLink_WiFi_Device', 17.8),
          H('192.168.1.183', '00:1a:2b:aa:01:83', 'IP-Telefon', 40.5, ['http://192.168.1.183/']),
          H('192.168.1.197', '00:1a:2b:aa:01:97', '', null),
          H('192.168.1.199', 'bc:24:11:00:01:99', 'casaos', 3.2, ['http://192.168.1.199/', 'http://192.168.1.199:8123/'], [{ port: 22, name: 'SSH' }, { port: 445, name: 'SMB' }]),
          H('192.168.1.214', '9c:2a:70:4d:11:aa', 'Galaxy-A54', 31.0),
        ] } };
      },
      'netpanel.cf_set_token': (a) => (/^eyJ[A-Za-z0-9+/=_-]{40,}$/.test(a.token || '') ? (demoCf.token_set = demoCf.token_valid = demoCf.running = true, { ok: true })
        : { ok: false, error: "Geçersiz tünel token'ı. Cloudflare Zero Trust > Networks > Tunnels ekranındaki uzun token'ı yapıştırın (eyJ... ile başlar)." }),
      'netpanel.cf_set_enabled': (a) => { demoCf.enabled = demoCf.running = !!a.enabled; demoCf.connections = a.enabled ? 4 : 0; return { ok: true }; },
      'netpanel.cf_lookup': (a) => ((a.api_token || '').length < 30 ? { ok: false, error: 'API token doğrulanamadı: Invalid API Token (1000)' }
        : { ok: true, accounts: [{ id: 'acc111', name: 'Ev hesabı' }], zones: [{ id: 'zone1', name: 'ornek.com', account_id: 'acc111' }],
          existing_tunnel: { id: demoCf.tunnel_id, account_id: 'acc111' } }),
      'netpanel.cf_publish': (a) => {
        if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(a.subdomain || '')) return { ok: false, error: 'Alt alan adı yalnız harf, rakam ve tire içerebilir (ör. panel)' };
        const host = a.subdomain + '.ornek.com';
        demoCf.hosts = demoCf.hosts.filter((h) => h.hostname !== host).concat([{ hostname: host, service: a.service }]);
        return { ok: true, hostname: host, url: 'https://' + host, tunnel_id: demoCf.tunnel_id, created_tunnel: false, access: a.access_email ? { ok: true, email: a.access_email } : null };
      },
      'netpanel.cf_unpublish': (a) => { demoCf.hosts = demoCf.hosts.filter((h) => h.hostname !== a.hostname); return { ok: true }; },
      'netpanel.hw_wifi_get': () => ({ ok: true, ...JSON.parse(JSON.stringify(hwCfg)) }),
      'netpanel.hw_wifi_set': (a) => {
        const targets = a.band === 'both' || (hwCfg.dbho && (a.ssid || a.password)) ? ['2g', '5g'] : [a.band];
        const other = hwCfg.bands.find((b) => !targets.includes(b.band));
        if (a.ssid && other && other.ssid === a.ssid && !hwCfg.dbho) return { ok: false, error: '2,4 ve 5 GHz adı aynı olamaz (çift bant modu kapalıyken)' };
        let changed = false;
        hwCfg.bands.filter((b) => targets.includes(b.band)).forEach((b) => {
          if (a.ssid) { b.ssid = a.ssid; changed = true; }
          if (a.hidden != null) { b.hidden = a.hidden; changed = true; }
          if (a.password) changed = true;
          if (a.channel != null) { b.channel = String(a.channel); b.actual_channel = String(a.channel || (b.band === '2g' ? 6 : 36)); changed = true; }
        });
        if (targets.includes('2g')) hw.on2g = true;
        return { ok: true, changed };
      },
      'netpanel.hw_wifi_scan': () => ({ ok: true, networks: [
        { ssid: 'Komsu_Superonline', channel: '6', signal: '-52', band: '2.4GHz' },
        { ssid: 'TurkTelekom_ZT8Q', channel: '6', signal: '-67', band: '2.4GHz' },
        { ssid: 'TurkNet_4F2A', channel: '1', signal: '-74', band: '2.4GHz' },
        { ssid: 'Vodafone-2.4G', channel: '3', signal: '-81', band: '2.4GHz' },
        { ssid: 'DIRECT-HP-Printer', channel: '11', signal: '-88', band: '2.4GHz' },
        { ssid: 'Komsu_Superonline_5G', channel: '36', signal: '-63', band: '5GHz' },
        { ssid: 'TurkTelekom_5G', channel: '44', signal: '-72', band: '5GHz' },
        { ssid: '', channel: '149', signal: '-85', band: '5GHz' },
      ] }),
      'netpanel.hw_config': (a) => {
        if (a.host) hw.host = a.host;
        if (a.username) hw.username = a.username;
        if (a.enabled != null) hw.enabled = a.enabled;
        return { ok: true };
      },
    };

    return {
      call(obj, method, args) {
        const h = handlers[obj + '.' + method];
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (!h) return reject(new ApiError(UBUS_ERR[3], 3));
            try { resolve(h(args || {})); } catch (e) { reject(e); }
          }, 80 + Math.random() * 120);
        });
      },
    };
  })();

  global.NetPanel = {
    isMock: MOCK,
    ApiError,
    on,
    hasSession: () => !!sid,
    login, logout,
    getOverview, getNetworks, getClients, getTraffic, getStatus, getWifi: () => getWifi(null),
    setClient, forgetClient, setWifi, reboot,
    getHuawei, setHuaweiWifi, setHuaweiConfig, getHuaweiWifi, saveHuaweiWifi, scanHuaweiChannels, WIFI_CHANNELS: CHANNELS,
    getWans: () => getWans(), getSystem, changePassword, scanWeb,
    getWanConfig, setWan, setWanMode, confirmWan, revertWan, reconnectWan, getWanEvents, MODE_LABELS,
    getUsage, getPingHistory, getNewDevices, ackNewDevices, getNotify, setNotify, testNotify, getTimezone, setTimezone, TIMEZONES,
    downloadBackup, restoreBackup, getTunnel, setTunnelToken, setTunnelEnabled, cfLookup, cfPublish, cfUnpublish, parseSchedule,
    getPortForwards, savePortForward, deletePortForward, setUpnp, setFirewall, getConnections, getLan, setLan, confirmLan, revertLan,
    getVpn, setupVpn, setVpn, addVpnPeer, deleteVpnPeer, qrSvg, wifiQrText, installPkg, pkgStatus,
    getTplink, setTplinkConfig, setTplinkBand, saveTplinkWifi,
    getAdguard, setupAdguard, enableAdguard, connectAdguard, setAdguardProtection, getAdguardServices, getAdguardGlobal, setAdguardGlobal,
    getAdguardClient, setAdguardClient, AG_POPULAR, getSpeedSchedule, setSpeedSchedule, getSecurity, setHttpsRedirect, finishWizard, getLog, getSysOpt, setSysOpt,
    getIntegrations, setIntegration, startScan, getScan, wakeOnLan, getUpdate, applyUpdate, getUpdateStatus, setAutoUpdate, TYPE_LABELS: TYPES,
    getSqm, setSqm, deleteSqm, setOffload, startSpeedtest, getSpeedtest, SQM_PRESETS, GRADE_TEXT, SPEED_SERVERS,
    TYPES,
    live, fmt, validate,
  };
})(window);
