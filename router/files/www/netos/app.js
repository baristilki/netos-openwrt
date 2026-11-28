(() => {
  'use strict';
  const NP = window.NetPanel;
  const root = document.getElementById('app');
  const brandMark =
    '<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M8 12h10v40H8zM46 12h10v40H46zM18 12h10v10H18zM36 42h10v10H36zM26 22h12v10H26zM18 32h10v10H18zM36 12h10v10H36z"/><circle fill="var(--accent)" cx="32" cy="32" r="5"/></svg>';
  const state = {
    overview: null,
    networks: { interfaces: [], wifi: [] },
    clients: [],
    traffic: { history: [] },
    status: {},
    system: null,
    page: '/',
    filter: 'all',
    query: '',
    iface: 'all',
    drawerMac: null,
    drawerWifi: null,
    drawerWan: null,
    wanConfig: null,
    wanEvents: [],
    wanFilter: 'all',
    wanShown: 20,
    wanTimer: null,
    lastWanOnline: {},
    revertNotice: '',
    huawei: null,
    huaweiError: null,
    huaweiPending: {},
    liveStop: null,
    overviewTimer: null,
    systemTimer: null,
    speedTimer: null,
    speed: null,
    speedHistory: [],
    speedWans: [],
    sqm: null,
    showAllPriority: false,
    alertOff: false,
    error: null,
  };
  const esc = (v) =>
    String(v == null ? '' : v).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const icon = (name) =>
    ({
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/></svg>',
      devices:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>',
      wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 8.8a15.4 15.4 0 0 1 20 0M5 12a10.8 10.8 0 0 1 14 0m-11 3a6.2 6.2 0 0 1 8 0m-4 4h.01"/></svg>',
      ethernet:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3v5m5-5v5m5-5v5M5 8h14v5a7 7 0 0 1-14 0zM12 20v2"/></svg>',
      system:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/><path d="M12 3v2m9 7h-2M5 12H3m9 9v-2"/></svg>',
      globe:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18"/></svg>',
      router:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8V5m10 3V5M7 14h.01M11 14h.01m3 0h3"/></svg>',
      speed:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 18a8 8 0 1 1 16 0M12 14l4-5M6 18h12"/><circle cx="12" cy="14" r="1"/></svg>',
      x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 6-12 12M6 6l12 12"/></svg>',
      chart:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/></svg>',
      apps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
      users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 14.2A5.5 5.5 0 0 1 20.5 19"/></svg>',
      bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>',
      cloud:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9z"/></svg>',
      clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
      shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/></svg>',
      save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v11m-4-4 4 4 4-4M5 19h14"/></svg>',
      copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>',
      more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
      download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
      eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
      eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
      lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
      edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>',
      trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
      vpn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><circle cx="12" cy="11" r="2"/><path d="M12 13v3"/></svg>',
      qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2"/></svg>',
      block: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
      plug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0zM12 17v4"/></svg>',
      logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/></svg>',
      radar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
      router: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 16.5h.01M11 16.5h.01M8 13l-2-6M16 13l2-6"/></svg>',
      menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
      sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
      moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    })[name] || '';
  const APP_VERSION = '1.3.2';
  // [yol, ikon, ad, mobil alt menüde mi (değilse "Menü" sayfasında)]
  const navGroups = [
    ['Ağ', [['/', 'home', 'Ana sayfa', 1], ['/internet', 'globe', 'İnternet', 1], ['/devices', 'devices', 'Cihazlar', 1], ['/wifi', 'wifi', 'Wi-Fi', 1], ['/lan', 'router', 'Yerel ağ'], ['/ports', 'shield', 'Port yönlendirme']]],
    ['Analiz', [['/speed', 'speed', 'Hız & Ping'], ['/stats', 'chart', 'İstatistik'], ['/scanner', 'radar', 'Ağ tarayıcı', 0, 'scanner']]],
    ['Yönetim', [['/adblock', 'block', 'Reklam engelleme', 0, 'adguard'], ['/vpn', 'vpn', 'VPN', 0, 'vpn'], ['/integrations', 'plug', 'Entegrasyon'], ['/system', 'system', 'Sistem']]],
  ];
  const navItems = navGroups.flatMap((g) => g[1]);
  // 5. alan: yalnız o entegrasyon açıkken görünür
  const navShown = (x) => !x[4] || integOn(x[4]);
  const typeKeys = [
    'phone',
    'tablet',
    'laptop',
    'pc',
    'console',
    'tv',
    'nas',
    'server',
    'router',
    'ap',
    'printer',
    'camera',
    'speaker',
    'watch',
    'iot',
    'other',
  ];
  const typeLabels = NP.TYPES || {};
  function typeIcon(t) {
    const paths = {
      phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
      tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18.5h2"/>',
      laptop: '<rect x="5" y="3" width="14" height="13" rx="1.5"/><path d="M2 20h20l-2-4H4z"/>',
      pc: '<rect x="3" y="3" width="14" height="13" rx="1.5"/><path d="M8 20h4m-2-4v4m8-11h3v11h-3z"/>',
      console:
        '<path d="M7 7h10a4 4 0 0 1 3.8 5.2l-1.3 4.2a2 2 0 0 1-3.2 1l-2.5-2h-3.6l-2.5 2a2 2 0 0 1-3.2-1l-1.3-4.2A4 4 0 0 1 7 7z"/><path d="M8 10v4m-2-2h4m6-1h.01m2 2h.01"/>',
      tv: '<rect x="2.5" y="4" width="19" height="14" rx="2"/><path d="m8 22 4-4 4 4"/>',
      nas: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8m-8 5h8m-8 5h5"/>',
      server:
        '<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01m4-10h6m-6 10h6"/>',
      router:
        '<rect x="3" y="11" width="18" height="9" rx="2"/><path d="M7 11V5m10 6V5M5 7l2-2 2 2m6 0 2-2 2 2m-9 8h.01m4 0h.01"/>',
      ap: '<path d="M3 10a13 13 0 0 1 18 0M6 13a9 9 0 0 1 12 0m-9 3a4.5 4.5 0 0 1 6 0m-3 4h.01"/>',
      printer:
        '<path d="M6 8V3h12v5M6 17H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6zM18 11h.01"/>',
      camera:
        '<path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10H2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.5"/>',
      speaker:
        '<rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="14" r="3"/><path d="M10 6h4"/>',
      watch: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="m8 6 1-4h6l1 4m-8 12 1 4h6l1-4"/>',
      iot: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2m0-14-2 2M7 17l-2 2"/>',
      other: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8m-4-4v8"/>',
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[t] || paths.other}</svg>`;
  }
  function go(path) {
    if (location.hash !== '#' + path) location.hash = '#' + path;
    else {
      state.page = path;
      render();
    }
  }
  function route() {
    let prevPage = state.page || '';
    state.page = location.hash.slice(1) || '/';
    // cihaz listesinin sırası sayfaya yeniden girildiğinde tazelenir (cihaz paneli açıp kapamak sırayı bozmaz)
    if (state.page.startsWith('/devices') && !prevPage.startsWith('/devices')) state.devOrder = null;
    state.drawerMac = null;
    state.drawerWifi = null;
    state.xPanel = null;
    if (state.systemTimer) {
      clearInterval(state.systemTimer);
      state.systemTimer = setInterval(
        async () => {
          if (state.page === '/' || state.page === '/system') {
            try {
              state.system = await NP.getSystem();
              if (state.page === '/system') { if (!formBusy()) render(); }
              else updateHomeLive();
            } catch (e) {
              state.error = e;
              updateTop();
            }
          }
        },
        state.page === '/system' ? 3000 : 10000,
      );
    }
    render();
  }
  function fmtUptime(v) {
    return NP.fmt.uptime(v || 0);
  }
  const isActive = (p) => state.page === p || (p === '/devices' && state.page.startsWith('/devices/'));
  function nav() {
    let fw = (state.overview?.firmware || '').match(/OpenWrt\s+[\w.-]+/)?.[0] || 'OpenWrt';
    let link = ([p, i, t]) => `<a href="#${p}" class="${isActive(p) ? 'active' : ''}"${isActive(p) ? ' aria-current="page"' : ''}>${icon(i)}<span>${t}</span></a>`;
    if (NP.hasSession() && !state.xInteg && !state.xIntegError) loadX('xInteg', () => NP.getIntegrations());
    if (NP.hasSession() && !state.xSec && !state.xSecError) loadSec();
    if (NP.hasSession() && state.xSec && !state.wizShown && !state.xSec.wizardDone && !lsGet('np_wiz_seen') && state.page !== '/welcome') {
      state.wizShown = true;
      lsSet('np_wiz_seen', '1');
      setTimeout(() => (location.hash = '#/welcome'));
    }
    if (NP.hasSession() && !state.lanChecked) {
      state.lanChecked = true;
      NP.getLan()
        .then((l) => {
          if (l.pending) {
            state.lanPending = l.pending;
            render();
          }
        })
        .catch(() => {});
    }
    let side = navGroups.map(([g, items]) => `<div class="nav-group"><div class="nav-label">${g}</div>${items.filter(navShown).map(link).join('')}</div>`).join('');
    let mobileMain = navItems.filter((x) => x[3]);
    let moreActive = !mobileMain.some((x) => isActive(x[0]));
    let bottom =
      mobileMain.map(([p, i, t]) => `<a href="#${p}" class="${isActive(p) ? 'active' : ''}">${icon(i)}<span>${p === '/' ? 'Ana' : p === '/devices' ? 'Cihaz' : t}</span></a>`).join('') +
      `<a href="#/more" class="${moreActive ? 'active' : ''}">${icon('menu')}<span>Menü</span></a>`;
    return `<aside class="sidebar"><div class="brand brand-center">${brandMark}<span class="brand-name"><span>Net</span><b>OS</b></span><span class="brand-ver">v${esc(state.status?.version || APP_VERSION)} · ${esc(fw)}</span></div><nav class="nav">${side}</nav><div class="sidebar-foot"><button class="logout-btn" type="button" data-logout>${icon('logout')}<span>Çıkış yap</span></button></div></aside><div class="main"><header class="topbar"><div class="mobile-brand">${brandMark}<span class="brand-name"><span>Net</span><b>OS</b></span></div><div class="top-status">${state.error ? '<span class="pill"><i class="dot bad"></i> Bağlantı sorunu</span>' : ''}${NP.isMock ? '<span class="pill demo">Demo verisi</span>' : ''}<span class="top-host">${state.overview ? esc(state.overview.hostname) : 'NetOS'}</span>${bellButton()}${langButton()}${themeButton()}</div></header><main class="content" id="content"></main></div><nav class="bottom-nav">${bottom}</nav><div id="drawer-host"></div><div class="toast" id="toast" role="status"></div>`;
  }
  // Mobil "Menü" sayfası: alt menüye sığmayan bölümler + tema + çıkış
  function morePage() {
    let rest = navItems.filter((x) => !x[3] && navShown(x));
    return `${pageHead('NetOS', 'Menü', `Sürüm ${state.status?.version || APP_VERSION}`)}<div class="more-list">${rest.map(([p, i, t]) => `<a class="more-item" href="#${p}"><span class="more-icon">${icon(i)}</span><strong>${t}</strong><span class="more-arrow">›</span></a>`).join('')}
      <button class="more-item" type="button" data-theme-toggle-row><span class="more-icon">${icon(isDark() ? 'sun' : 'moon')}</span><strong>${isDark() ? 'Gündüz modu' : 'Gece modu'}</strong></button>
      <button class="more-item danger" type="button" data-logout><span class="more-icon">${icon('logout')}</span><strong>Çıkış yap</strong></button></div>`;
  }
  function pageHead(eyebrow, title, sub, extra = '') {
    return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${sub || ''}</p></div>${extra}</div>`;
  }
  function cardHead(i, title, action = '') {
    if (title === 'İnternet') action = `${action}<a href="#/speed">Hız testi →</a>`;
    return `<div class="card-head"><h2 class="card-title"><span class="card-icon">${icon(i)}</span>${title}</h2>${action}</div>`;
  }
  function chart() {
    let h = state.traffic.history || [];
    if (h.length < 2) return '<div class="chart" aria-label="Trafik geçmişi"></div>';
    const w = 300,
      hh = 54,
      max = Math.max(1, ...h.map((x) => Math.max(x.down || 0, x.up || 0)));
    const pts = (k) =>
      h
        .map(
          (x, n) =>
            `${((n / (h.length - 1)) * w).toFixed(1)},${(hh - 3 - ((x[k] || 0) / max) * (hh - 8)).toFixed(1)}`,
        )
        .join(' ');
    return `<svg class="chart" viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" aria-label="Son trafik geçmişi"><polyline points="${pts('down')}" fill="none" stroke="#42a99c" stroke-width="2.2" vector-effect="non-scaling-stroke"/><polyline points="${pts('up')}" fill="none" stroke="#7189c2" stroke-width="2.2" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function internetCard() {
    let wans = state.overview?.wans || (state.overview?.wan ? [state.overview.wan] : []),
      up = wans.some((w) => w.online);
    let per = state.traffic.perWan || {};
    return `<section class="card span-7">${cardHead('globe', 'İnternet', `<span class="pill"><i class="dot ${up ? '' : 'bad'}"></i>${up ? 'İnternet bağlı' : 'Bağlantı yok'}</span>`)}<div class="wan-list">${
      wans
        .map((w, n) => {
          let status =
              w.status === 'online'
                ? 'Çevrimiçi'
                : w.status === 'offline'
                  ? 'Çevrimdışı'
                  : w.status || 'Bilinmiyor',
            rate = per[w.name] || {};
          return `<article class="wan-item"><div class="wan-item-head"><strong>${esc(w.name || w.label || 'WAN')}</strong><span class="badge">${esc(w.protoLabel || w.proto || '')}</span>${n === 0 ? '<span class="badge ok">Ana hat</span>' : ''}${w.cgnat ? '<span class="badge" title="Operatör NAT\'ı arkasında: dışarıdan port açma çalışmaz.">CGNAT</span>' : ''}<span class="wan-status"><i class="dot ${w.online ? '' : 'off'}"></i>${esc(status)}</span></div><div class="wan-meta"><div class="meta-item"><small>IP</small><strong class="num">${esc(w.ip || '—')}</strong></div><div class="meta-item"><small>Ağ geçidi</small><strong class="num">${esc(w.gateway || '—')}</strong></div><div class="meta-item"><small>Çalışma süresi</small><strong>${fmtUptime(w.uptime)}</strong></div><div class="meta-item"><small>Canlı hız</small><strong>↓ ${esc(NP.fmt.bits(rate.down || 0))} · ↑ ${esc(NP.fmt.bits(rate.up || 0))}</strong></div></div>${w.tracking?.targets?.length ? `<div class="track-info">İzleme: ${w.tracking.targets.map((t) => `${esc(t.ip)} ${t.status === 'online' ? '✓' : `kayıp %${esc(t.loss ?? 100)}`}`).join(' · ')}</div>` : ''}</article>`;
        })
        .join('') || '<div class="empty">WAN bilgisi bulunamadı.</div>'
    }</div><div class="traffic-row"><div class="traffic-value down">↓ ${esc(NP.fmt.bits(state.traffic.down))}<small> indirme</small></div><div class="traffic-value up">↑ ${esc(NP.fmt.bits(state.traffic.up))}<small> yükleme</small></div>${chart()}</div></section>`;
  }
  function huaweiSource() {
    let h = state.huawei;
    return h?.enabled
      ? `<div class="huawei-source">HUAWEI WiFi AX2 · ${esc(h.host || '192.168.1.2')} · ${h.clients || 0} cihaz bağlı</div>`
      : '';
  }
  function huaweiCards(large = false) {
    let h = state.huawei;
    if (!h?.enabled) return '';
    if (!h.connected)
      return `<div class="huawei-error" role="status">${esc(h.error || state.huaweiError || 'Huawei bağlantısı kurulamadı.')}</div>`;
    let radios = h.radios || [];
    if (h.dbho && radios.length)
      radios = [
        { ...radios[0], bandLabel: '2,4 + 5 GHz', ssid: radios[0].ssid || radios[1]?.ssid, band: '2g' },
      ];
    return `<div class="wifi-list ${large ? 'huawei-large' : ''}">${radios
      .map((r) => {
        let enabled = state.huaweiPending[r.band]?.enabled ?? r.enabled;
        let pending = !!state.huaweiPending[r.band];
        return `<div class="wifi-row huawei-row"><span class="wifi-glyph ${enabled ? '' : 'off'}">${icon('wifi')}</span><div class="wifi-info"><div class="wifi-name">${esc(r.ssid || 'Huawei Wi-Fi')}</div><div class="wifi-sub"><span class="badge">${esc(r.bandLabel || (r.band === '2g' ? '2,4 GHz' : '5 GHz'))}</span> · ${enabled ? 'A\u00e7\u0131k' : 'Kapal\u0131'}</div></div><div class="wifi-right"><span class="pill"><i class="dot ${enabled ? '' : 'off'}"></i>${enabled ? 'A\u00e7\u0131k' : 'Kapal\u0131'}</span><label class="switch-wrap"><input class="switch" type="checkbox" aria-label="${esc(r.bandLabel || r.band)} Wi-Fi a\u00e7" data-huawei-band="${esc(r.band)}" ${enabled ? 'checked' : ''} ${pending ? 'disabled' : ''}>${pending ? '<i class="switch-spinner" aria-label="Bekliyor"></i>' : ''}</label></div></div>`;
      })
      .join('')}${huaweiSource()}</div>`;
  }
  function wifiRows() {
    let ow = (state.networks.wifi || [])
      .map(
        (w) =>
          `<div class="wifi-row" data-wifi="${esc(w.section)}"><span class="wifi-glyph ${w.enabled ? '' : 'off'}">${icon('wifi')}</span><div class="wifi-info"><div class="wifi-name">${esc(w.ssid)}</div><div class="wifi-sub">${esc(w.bandLabel || NP.fmt.band(w.band))} · ${w.clients || 0} cihaz ba\u011fl\u0131${w.enabled ? '' : ' · H'}</div></div><div class="wifi-right"><span class="pill"><i class="dot ${w.enabled ? '' : 'off'}"></i>${w.enabled ? 'A\u00e7\u0131k' : 'Kapal\u0131'}</span><input class="switch" type="checkbox" aria-label="${esc(w.ssid)} ağını E" data-wifi-toggle="${esc(w.section)}" ${w.enabled ? 'checked' : ''}></div></div>`,
      )
      .join('');
    let hw = state.huawei?.enabled
      ? huaweiCards()
      : `<div class="empty"><a href="#/integrations">Huawei Wi-Fi'yi ba\u011fla</a></div>`;
    return (
      `${ow ? `<div class="wifi-group"><div class="wifi-group-title">OpenWrt</div>${ow}</div>` : ''}${state.huawei?.enabled ? `<div class="wifi-group"><div class="wifi-group-title">Huawei Wi-Fi AX2</div>${hw}</div>` : !ow ? hw : ''}` ||
      '<div class="empty">Wi-Fi a\u011f\u0131 bulunamad\u0131.</div>'
    );
  }
  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (_) {}
  }
  /* Bir uyarı bant olarak yalnız ilk görüldüğü oturumda çıkar; sonra yalnız zilde durur. */
  function onceBanner(key) {
    if (state.bannerOnce?.[key]) return !state.bannerOnce[key].closed;
    if (lsGet(key)) return false;
    state.bannerOnce = { ...state.bannerOnce, [key]: { closed: false } };
    return true;
  }
  // gösterilen bantlar sayfa kapanınca "görüldü" sayılır (ilk çizimden hemen sonra yönlenme olsa da kaybolmaz)
  addEventListener('pagehide', () => Object.keys(state.bannerOnce || {}).forEach((k) => lsSet(k, '1')));
  /* ── Bildirimler (üst bardaki zil) ── */
  function issues() {
    let out = [];
    if (state.error) out.push({ id: 'conn', level: 'bad', title: 'Router’a ulaşılamıyor', text: 'Veriler güncellenemiyor; bağlantıyı kontrol edin.' });
    if (state.xSec?.rootPwEmpty) out.push({ id: 'pw', level: 'bad', title: 'Router’ın şifresi yok', text: 'Aynı ağdaki herkes bu panele, LuCI’ye ve SSH’a şifresiz girebilir.', href: '#/welcome', action: 'Şifre belirle' });
    for (let w of state.overview?.wans || []) if (w.status === 'offline' || w.online === false) out.push({ id: 'wan:' + w.name, level: 'bad', title: `${w.label || w.name} çevrimdışı`, text: 'Bu internet hattından bağlantı yok; modemi ve kabloyu kontrol edin.', href: '#/internet', action: 'İnternet' });
    if (NP.hasSession() && !state.xNewdev && !state.xNewdevError) loadX('xNewdev', () => NP.getNewDevices(), '-');
    let nd = (state.xNewdev?.items || []).filter((x) => x.unseen);
    if (nd.length) out.push({ id: 'newdev:' + nd.map((x) => x.mac).join(','), level: 'warn', title: `${nd.length} yeni cihaz ağa katıldı`, text: nd.slice(0, 3).map((x) => x.hostname || NP.fmt.mac(x.mac)).join(', ') + (nd.length > 3 ? '…' : ''), href: '#/devices', action: 'Cihazlar' });
    if (NP.hasSession() && (!state.xHeavyT || Date.now() - state.xHeavyT > 60000)) {
      state.xHeavyT = Date.now();
      NP.getHeavy().then((h) => { state.xHeavy = h; refreshBell(); }).catch(() => {});
    }
    for (let h of state.xHeavy || []) {
      let mins = Math.max(1, Math.round((Date.now() - h.since) / 60000)),
        what = h.kinds.map((k) => ({ download: `↓ ${h.down} Mbit/s`, upload: `↑ ${h.up} Mbit/s`, connections: `${h.conns} bağlantı` })[k]).join(' · ');
      let c = state.clients.find((x) => x.mac === h.mac);
      out.push({ id: 'heavy:' + h.mac + ':' + h.since, level: 'warn', title: `${c?.displayName || h.name} hattı yoğun kullanıyor`, text: `${mins} dakikadır ${what}${h.top ? ' · çoğu ' + h.top : ''}. Beklenmiyorsa cihazı kontrol edin (yedekleme, torrent, güncelleme ya da zararlı yazılım olabilir).`, href: '#/devices/' + encodeURIComponent(h.mac), action: 'Cihazı aç' });
    }
    if (state.lanPending) out.push({ id: 'lan', level: 'warn', title: 'Onay bekleyen adres değişikliği', text: 'Yeni router adresini onaylamazsanız eski ayara dönülecek.', href: '#/lan', action: 'Yerel ağ' });
    if (state.status?.offload) out.push({ id: 'offload', level: 'warn', title: 'Flow offloading açık', text: 'Cihaz hızları, hız sınırları ve oyun önceliği tam çalışmaz.', href: '#/system', action: 'Sistem' });
    for (let pt of state.xPorts?.ports || []) {
      if (pt.link && pt.speed && pt.maxSpeed > pt.speed) out.push({ id: 'slow:' + pt.name, level: 'warn', title: `${pt.name} portu düşük hızda`, text: `${portSpeed(pt.maxSpeed)} destekliyor ama ${portSpeed(pt.speed)} ile bağlı. Kabloyu ve karşı cihazı kontrol edin.`, href: '#/', action: 'Portlar' });
      if (pt.link && pt.duplex === 'half') out.push({ id: 'half:' + pt.name, level: 'warn', title: `${pt.name} yarı çift yönlü`, text: 'Genelde kablo ya da karşı cihaz sorunudur ve hızı düşürür.', href: '#/', action: 'Portlar' });
    }
    return out;
  }
  function seenIssues() {
    try {
      return JSON.parse(lsGet('np_seen_issues') || '[]');
    } catch (_) {
      return [];
    }
  }
  function bellButton() {
    if (!NP.hasSession()) return '';
    let list = issues(),
      seen = seenIssues(),
      fresh = list.filter((i) => !seen.includes(i.id)).length,
      worst = list.some((i) => i.level === 'bad') ? 'bad' : list.length ? 'warn' : '';
    let panel = !state.bellOpen
      ? ''
      : `<div class="bell-panel" role="dialog" aria-label="Bildirimler"><div class="bell-head"><strong>Bildirimler</strong><span>${list.length ? `${list.length} uyarı` : ''}</span></div>${
          list.length
            ? `<ul class="bell-list">${list
                .map((i) => `<li class="bell-item ${i.level}"><i class="dot ${i.level === 'bad' ? 'bad' : 'warn'}"></i><div><strong>${esc(i.title)}</strong><p>${esc(i.text)}</p>${i.href ? `<a href="${i.href}" data-bell-go>${esc(i.action || 'Aç')} →</a>` : ''}</div></li>`)
                .join('')}</ul>`
            : '<div class="bell-empty">✓ Her şey yolunda. Sorun ya da arıza yok.</div>'
        }</div>`;
    return `<div class="bell-wrap"><button class="theme-btn bell-btn ${worst}" type="button" data-bell aria-expanded="${!!state.bellOpen}" title="Bildirimler" aria-label="Bildirimler">${icon('bell')}${fresh ? `<span class="bell-badge num">${fresh}</span>` : worst ? '<span class="bell-dot"></span>' : ''}</button>${panel}</div>`;
  }
  function refreshBell() {
    let w = document.querySelector('.bell-wrap');
    if (w) w.outerHTML = bellButton();
  }
  function toggleBell(open) {
    state.bellOpen = open ?? !state.bellOpen;
    if (state.bellOpen) lsSet('np_seen_issues', JSON.stringify(issues().map((i) => i.id)));
    refreshBell();
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-bell]')) return toggleBell();
    if (e.target.closest('[data-bell-go]')) return toggleBell(false);
    if (state.bellOpen && !e.target.closest('.bell-panel')) toggleBell(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.bellOpen) toggleBell(false);
  });
  document.addEventListener('click', async (e) => {
    let b = e.target.closest('[data-ping]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    let mac = b.dataset.ping, c = state.clients.find((x) => x.mac === mac);
    if (!c?.ip) return;
    state.pingRes = { ...state.pingRes, [mac]: { busy: true } };
    if (state.page === '/devices') updateDevicesLive();
    try {
      let r = await NP.pingHost(c.ip);
      state.pingRes[mac] = r;
      toast(r.received ? `${c.displayName}: yanıt veriyor${r.avgMs != null ? ' (' + fmtMs(r.avgMs) + ')' : ''}` : `${c.displayName}: yanıt vermiyor`);
    } catch (x) {
      state.pingRes[mac] = { received: 0, avgMs: null };
      toast(x.message);
    }
    if (state.page === '/devices') updateDevicesLive();
  }, true);
  document.addEventListener('change', (e) => {
    if (!e.target.matches('[data-x-amac]')) return;
    state.stats.amac = e.target.value;
    state.xApps = null;
    render();
  });
  function offloadAlert() {
    return `<div class="alert offload-alert"><span class="offload-i">ⓘ</span><div><strong>Flow offloading açık</strong><p>Bu OpenWrt özelliği, kurulmuş bağlantıların paketlerini güvenlik duvarının yanından geçirerek işlemciyi rahatlatır. Ancak NetOS bu trafiği göremez: cihaz hızları ve kullanım istatistikleri eksik görünür, cihaz hız sınırları ve oyun önceliği çalışmaz.</p><p>Mini PC gibi güçlü bir işlemcide kapatmanız önerilir; zayıf bir router’da (ör. tek çekirdekli) 1 Gbit hızlarda açık kalması daha iyi olabilir.</p><div class="alert-actions"><button class="btn small primary" type="button" data-disable-offload>Kapat (önerilen)</button><button class="btn small" type="button" data-keep-offload>Açık kalsın</button></div></div></div>`;
  }
  /* ── Fiziksel portlar ── */
  const portSpeed = (m) => (!m ? '' : m >= 1000 ? (m % 1000 ? (m / 1000).toFixed(1) : m / 1000) + ' Gbit/s' : m + ' Mbit/s');
  function setPorts(p) {
    let prev = state.xPorts, rate = {};
    if (prev?.t && p.t > prev.t)
      for (const x of p.ports) {
        let o = prev.ports.find((y) => y.name === x.name);
        if (o && x.rx >= o.rx && x.tx >= o.tx) rate[x.name] = { down: ((x.rx - o.rx) * 8) / (p.t - prev.t), up: ((x.tx - o.tx) * 8) / (p.t - prev.t) };
      }
    p.rate = Object.keys(rate).length ? rate : prev?.rate || {};
    state.xPorts = p;
  }
  function portRole(p) {
    let wl = state.wanConfig?.wans || [], wanNames = (state.overview?.wans || []).map((w) => w.name);
    if (p.role === 'wan') {
      let n = p.nets.filter((x) => wanNames.includes(x) || wl.some((w) => w.name === x)),
        lbl = n.map((x) => (state.overview?.wans || []).find((w) => w.name === x)?.label || x);
      return ['wan', 'İnternet', lbl.join(', ') || p.nets.join(', ')];
    }
    if (p.role === 'lan') return ['lan', 'Yerel ağ', p.bridge === 'br-lan' ? 'LAN' : p.bridge];
    if (p.role === 'other') return ['lan', 'Ağ', p.nets.join(', ')];
    return ['free', 'Boş', 'Kullanılmıyor'];
  }
  function portsCard() {
    if (!state.xPorts && !state.xPortsError && !state.xLoading?.xPorts)
      (async () => {
        state.xLoading = { ...state.xLoading, xPorts: true };
        try {
          setPorts(await NP.getPorts());
        } catch (e) {
          state.xPortsError = e.message;
        }
        state.xLoading.xPorts = false;
        if (state.page === '/') updateHomeLive();
      })();
    let P = state.xPorts;
    if (!P?.ports?.length) return '';
    let warns = [];
    let tiles = P.ports
      .map((p) => {
        let [cls, title, sub] = portRole(p),
          slow = p.link && p.speed && p.maxSpeed > p.speed,
          half = p.link && p.duplex === 'half',
          r = P.rate?.[p.name],
          sp = !p.link ? 'Kablo yok' : p.speed ? portSpeed(p.speed) : p.virtual ? 'Sanal bağlantı' : 'Bağlı';
        if (slow) warns.push(`<b>${esc(p.name)}</b> portu ${portSpeed(p.maxSpeed)} destekliyor ama ${portSpeed(p.speed)} ile bağlı. Kabloyu (en az Cat5e, 2.5 Gbit için Cat6) ve karşı cihazın port hızını kontrol edin.`);
        if (half) warns.push(`<b>${esc(p.name)}</b> yarı çift yönlü (half duplex) çalışıyor; bu genelde kablo ya da karşı cihaz sorunudur ve hızı düşürür.`);
        let tip = [p.name, p.mac, p.driver, p.flaps ? `açılıştan beri ${p.flaps} kez koptu` : ''].filter(Boolean).join(' · ');
        return `<div class="port-tile ${cls}${p.link ? ' up' : ''}${slow || half ? ' warn' : ''}" title="${esc(tip)}"><div class="port-jack"><i></i><b></b></div><div class="port-info"><strong>${esc(title)}</strong><span>${esc(sub)}</span><span class="port-speed num">${esc(sp)}${p.link && p.speed && p.duplex === 'full' ? '' : ''}</span>${p.link && r ? `<small class="num">↓ ${esc(NP.fmt.bits(r.down))} · ↑ ${esc(NP.fmt.bits(r.up))}</small>` : ''}<small class="port-name num">${esc(p.name)}${p.flaps ? ` · ${p.flaps} kopma` : ''}</small></div></div>`;
      })
      .join('');
    let virt = P.ports.some((p) => p.virtual && p.link && !p.speed);
    return `<section class="card span-12">${cardHead('ethernet', 'Portlar')}<div class="port-grid">${tiles}</div>${warns.map((w) => `<div class="alert">⚠ ${w}</div>`).join('')}${virt ? '<p class="field-hint">Router sanal makinede çalışıyor: portlar sanal (virtio) olduğu için kablonun gerçek hızı burada görünmez; Proxmox’ta fiziksel ağ kartının hızına bakın. Ağ kartını sanal makineye doğrudan verirseniz (PCI passthrough) hız ve kablo durumu burada görünür.</p>' : '<p class="field-hint">Router’a takılı kabloların bağlantı hızı. Arkadaki cihazların (ör. bir switch’e bağlı PC) hızı yalnız o cihazın kendisinde görünür.</p>'}</section>`;
  }
  function home() {
    let off = state.status.offload && !state.alertOff && !lsGet('np_offload_ok') && onceBanner('np_offload_banner');
    let online = state.clients.filter((c) => c.online && !c.blocked),
      total = state.clients.length;
    let top = [...online].sort((a, b) => b.down + b.up - (a.down + a.up)).slice(0, 5);
    return `${pageHead('Genel bakış', esc(state.overview?.hostname || 'Ağınız'), esc(state.overview?.model || 'Router durumu ve bağlı cihazlar'))}${off ? offloadAlert() : ''}<div class="grid">${internetCard()}<section class="card span-5">${cardHead('wifi', 'Wi-Fi', `<a href="#/wifi">Tüm ağlar →</a>`)}<div class="wifi-list">${wifiRows()}</div></section><section class="card span-6">${cardHead('router', 'Ağlar')}<div class="segment-list">${(
      state.networks.interfaces || []
    )
      .filter((n) => !n.isWan)
      .map(
        (n) =>
          `<div class="segment"><div><div class="segment-label"><i class="dot ${n.up ? '' : 'off'}"></i> ${esc(n.label)}</div><div class="segment-ip num">${esc(n.ip || '—')}${n.cidr ? `/${esc(n.cidr.split('/')[1])}` : ''}</div></div><div class="segment-count">${n.clients || 0} aktif cihaz</div></div>`,
      )
      .join(
        '',
      )}</div></section><section class="card span-6">${cardHead('devices', 'Cihazlar', `<a href="#/devices">Tüm cihazlar →</a>`)}<div class="device-topline"><strong>${online.length}</strong><span>çevrimiçi / ${total} kayıtlı</span></div><div class="traffic-devices">${top.map((c) => `<div class="traffic-device"><span class="traffic-device-name"><span class="type-icon tiny">${typeIcon(c.type)}</span>${esc(c.displayName)}</span><span class="traffic-device-speed">↓ ${esc(NP.fmt.bits(c.down))} · ↑ ${esc(NP.fmt.bits(c.up))}</span><div class="mini-track"><i style="width:${Math.max(3, Math.min(100, ((c.down + c.up) / (top[0]?.down + top[0]?.up || 1)) * 100))}%"></i></div></div>`).join('') || '<div class="empty">Çevrimiçi cihaz yok.</div>'}</div></section>${portsCard()}<section class="card span-12">${cardHead('system', 'Sistem', `<a href="#/system">Sistem bilgileri →</a>`)}<div class="system-stats"><div><span class="metric-label">Çalışma süresi</span><strong>${fmtUptime(state.overview?.uptime)}</strong></div><div><span class="metric-label">CPU yükü · 1 dk</span><strong>${esc(state.overview?.load?.[0] ?? '—')}</strong></div><div><span class="metric-label">Bellek · ${state.overview?.memory?.percent || 0}%</span><strong>${esc(NP.fmt.bytes(state.overview?.memory?.used || 0))} / ${esc(NP.fmt.bytes(state.overview?.memory?.total || 0))}</strong><div class="progress"><i style="width:${Math.min(100, state.overview?.memory?.percent || 0)}%"></i></div></div><div><span class="metric-label">CPU</span><strong>${state.system?.cpuEstimated ? '~' : ''}%${esc(state.system?.cpu ?? '—')}</strong><div class="progress"><i style="width:${Math.min(100, state.system?.cpu || 0)}%"></i></div></div><div><span class="metric-label">Disk · ${esc(state.system?.disk?.percent ?? 0)}%</span><strong>${esc(NP.fmt.bytes(state.system?.disk?.used || 0))} / ${esc(NP.fmt.bytes(state.system?.disk?.total || 0))}</strong><div class="progress"><i style="width:${Math.min(100, state.system?.disk?.percent || 0)}%"></i></div></div><div><span class="metric-label">Firmware</span><strong>${esc(state.overview?.firmware || '—')}</strong></div></div></section></div>`;
  }
  const findIface = (c) =>
    state.networks.interfaces.find((n) => n.name === c.iface) ||
    state.networks.interfaces.find((n) => !n.isWan && NP.validate.inSubnet(c.ip, n.cidr));
  function badges(c) {
    return `${c.schedBlocked ? '<span class="badge err">Plan: internet kapalı</span>' : c.schedule?.length ? '<span class="badge">Saat planı</span>' : ''}${c.static ? '<span class="badge ok">Sabit IP</span>' : ''}${c.staticPending ? '<span class="badge warn">IP bekliyor</span>' : ''}${c.priority ? '<span class="badge ok">Öncelikli</span>' : ''}${c.wan ? `<span class="badge">${c.wan.endsWith('!') ? 'Yalnız' : 'Hat'}: ${esc(c.wan.replace(/!$/, ''))}</span>` : ''}${c.limitDown || c.limitUp ? `<span class="badge warn">S&#305;n&#305;r &#8595;${c.limitDown || '&#8734;'} &#8593;${c.limitUp || '&#8734;'}</span>` : ''}${c.blocked ? '<span class="badge err">Engelli</span>' : ''}`;
  }
  function signal(c) {
    return `<span class="conn-badge">${c.conn === 'wifi' ? icon('wifi') : icon('ethernet')}${esc(c.connLabel || (c.conn === 'wifi' ? 'Wi-Fi' : 'Ethernet'))}</span>`;
  }
  // cihaz hangi erişim noktası üzerinden bağlı
  const fmtMs = (v) => (v < 1 ? "<1 ms" : Math.round(v) + " ms");
  const viaLabel = (c) => (c.via === 'huawei' ? 'Huawei' : c.via === 'tplink' ? 'TP-Link' : 'Router');
  function rowActions(c, web) {
    let p = state.pingRes?.[c.mac];
    return `<div class="row-actions">${p ? `<span class="ping-res ${p.busy ? '' : p.received ? 'ok' : 'bad'}">${p.busy ? '…' : p.received ? `${p.avgMs != null ? fmtMs(p.avgMs) : 'yanıt var'}` : 'yanıt yok'}</span>` : ''}<button class="icon-btn" type="button" data-ping="${esc(c.mac)}" title="Ping at: cihaz yanıt veriyor mu?" aria-label="Ping at" ${c.ip ? '' : 'disabled'}>${icon('radar')}</button>${web.length ? `<a class="icon-btn" href="${esc(web[0])}" target="_blank" rel="noopener" title="Web arayüzünü aç" aria-label="Web arayüzünü aç" onclick="event.stopPropagation()">${icon('globe')}</a>` : '<span class="icon-btn ghost" aria-hidden="true"></span>'}</div>`;
  }
  // Liste sırası sabit kalsın: çevrimiçi/çevrimdışı durumu saniyelik değişse de satırlar zıplamasın.
  // Sıra sayfaya girildiğinde ve 30 dakikada bir yeniden hesaplanır; yeni cihazlar sona eklenir.
  function stableOrder(list) {
    let o = state.devOrder;
    if (!o || Date.now() - o.t > 30 * 60 * 1000) o = state.devOrder = { t: Date.now(), idx: Object.fromEntries(state.clients.map((c, i) => [c.mac, i])) };
    let n = Object.keys(o.idx).length;
    for (let c of list) if (!(c.mac in o.idx)) o.idx[c.mac] = n++;
    return list.slice().sort((a, b) => o.idx[a.mac] - o.idx[b.mac]);
  }
  function filtered() {
    return stableOrder(filteredRaw());
  }
  function filteredRaw() {
    let q = state.query.toLocaleLowerCase('tr');
    return state.clients.filter(
      (c) =>
        (state.filter === 'all' ||
          (state.filter === 'online'
            ? c.online && !c.blocked
            : state.filter === 'offline'
              ? !c.online
              : state.filter === 'blocked'
                ? !!c.blocked
                : state.filter === 'wifi'
                  ? c.conn === 'wifi'
                  : c.conn !== 'wifi')) &&
        (state.iface === 'all' || c.iface === state.iface) &&
        (q === '' ||
          [c.displayName, c.hostname, c.ip, c.mac].some((x) =>
            String(x || '')
              .toLocaleLowerCase('tr')
              .includes(q),
          )),
    );
  }
  function deviceRow(c) {
    let i = findIface(c),
      web = (c.web || []).filter((u) => /^https?:\/\//i.test(u));
    return `<tr data-client="${esc(c.mac)}"><td><span class="status-cell"><i class="dot ${c.blocked ? 'bad' : c.online ? '' : 'off'}"></i>${c.blocked ? 'Engelli' : c.online ? '&#199;evrimi&#231;i' : '&#199;evrimd&#305;&#351;&#305;'}</span></td><td>${signal(c)}</td><td><span class="via-tag ${esc(c.via || 'router')}">${viaLabel(c)}</span></td><td><div class="device-name-cell"><span class="type-icon">${typeIcon(c.type)}</span><span><div class="client-name">${esc(c.displayName)}</div><div class="client-host">${esc(c.hostname || '')}</div></span></div></td><td class="num">${esc(c.ip)}</td><td class="mac">${esc(NP.fmt.mac(c.mac))}</td><td>${esc(i?.label || c.iface || '—')}</td><td class="num">&#8595; ${esc(NP.fmt.bits(c.down))}<br>&#8593; ${esc(NP.fmt.bits(c.up))}</td><td><div style="display:flex;gap:4px;flex-wrap:wrap">${badges(c)}</div></td><td class="actions-cell">${rowActions(c, web)}</td></tr>`;
  }
  function deviceCard(c) {
    let i = findIface(c),
      web = (c.web || []).filter((u) => /^https?:\/\//i.test(u));
    return `<div class="device-card" data-client="${esc(c.mac)}"><div class="device-card-head"><span class="status-cell"><span class="type-icon">${typeIcon(c.type)}</span><i class="dot ${c.blocked ? 'bad' : c.online ? '' : 'off'}"></i><span class="client-name">${esc(c.displayName)}</span></span>${signal(c)}</div><div class="client-host">${esc(c.hostname || '')} · ${esc(c.ip)}</div><div class="device-card-meta"><span class="badge">${esc(i?.label || c.iface || '—')}</span><span class="via-tag ${esc(c.via || 'router')}">${viaLabel(c)}</span>${badges(c)}<span class="badge">&#8595; ${esc(NP.fmt.bits(c.down))} &#8593; ${esc(NP.fmt.bits(c.up))}</span>${rowActions(c, web)}</div></div>`;
  }
  function devices() {
    let list = filtered();
    let tabs = [
      ['all', 'Tümü'],
      ['online', 'Çevrimiçi'],
      ['offline', 'Çevrimdışı'],
      ['blocked', 'Engellenen'],
      ['wifi', 'Wi-Fi'],
      ['ethernet', 'Ethernet'],
    ];
    return `${pageHead('Ağınızdaki cihazlar', 'Cihazlar', `${state.clients.filter((c) => c.online && !c.blocked).length} çevrimiçi · ${state.clients.length} kayıtlı`)}<section class="card">${cardHead('devices', 'Bağlı cihazlar')}<div class="filters"><div class="tabs">${tabs.map(([v, t]) => `<button data-filter="${v}" class="${state.filter === v ? 'active' : ''}">${t}</button>`).join('')}</div><input class="search" type="search" placeholder="İsim, IP veya MAC ara" aria-label="Cihaz ara" value="${esc(state.query)}"><select id="iface-filter" aria-label="Ağa göre filtre"><option value="all">Tüm ağlar</option>${state.networks.interfaces
      .filter((n) => !n.isWan)
      .map(
        (n) =>
          `<option value="${esc(n.name)}" ${state.iface === n.name ? 'selected' : ''}>${esc(n.label)}</option>`,
      )
      .join(
        '',
      )}</select></div><div class="table-wrap"><table class="device-table"><thead><tr><th>Durum</th><th>Bağlantı</th><th>Erişim</th><th>Cihaz</th><th>IP adresi</th><th>MAC adresi</th><th>Ağ</th><th>Canlı hız</th><th>Ayarlar</th><th><span class="sr-only">İşlemler</span></th></tr></thead><tbody id="device-rows">${list.map(deviceRow).join('')}</tbody></table></div><div class="mobile-devices" id="device-cards">${list.map(deviceCard).join('') || '<div class="empty">Bu filtrede cihaz bulunamadı.</div>'}</div></section>`;
  }
  function wifiPage() {
    let ow = (state.networks.wifi || [])
      .map(
        (w) =>
          `<section class="card wifi-detail" data-wifi="${esc(w.section)}"><div class="wifi-detail-head"><span class="wifi-glyph ${w.enabled ? '' : 'off'}">${icon('wifi')}</span><div style="flex:1"><h3>${esc(w.ssid)}</h3><p>${esc(w.bandLabel || NP.fmt.band(w.band))} · Kanal ${esc(w.channel)} · ${w.clients} cihaz</p></div><input class="switch" type="checkbox" aria-label="${esc(w.ssid)} ağını aç" data-wifi-toggle="${esc(w.section)}" ${w.enabled ? 'checked' : ''}></div><div class="segment-ip">Durum: <strong>${w.enabled ? 'Yayında' : 'Kapalı'}</strong></div><button class="btn small" style="margin-top:14px" data-edit-wifi="${esc(w.section)}">Ağı düzenle</button></section>`,
      )
      .join('');
    let h = state.huawei?.enabled
      ? `<section class="card wifi-detail huawei-detail">${cardHead('wifi', 'HUAWEI WiFi AX2', `<a href="http://${esc(state.huawei.host || '192.168.1.2')}/" target="_blank" rel="noopener">Huawei arayüzünü aç ↗</a>`)}${huaweiCards(true)}<p class="field-hint">Ağ adı, şifre ve kanal aşağıdaki "Wi-Fi ayarları" bölümünden, misafir ağı "Misafir Wi-Fi" bölümünden değiştirilir; gelişmiş ayarlar için Huawei arayüzünü kullanın.</p></section>`
      : `<section class="card wifi-detail"><h3>Harici Wi-Fi</h3><p class="subtitle">Huawei Wi-Fi'yi bağlayarak bantları buradan yönetin.</p><a href="#/integrations">Huawei Wi-Fi'yi bağla →</a></section>`;
    return `${pageHead('Kablosuz ağlar', 'Wi-Fi', 'Ağları ve yayın durumunu yönetin.')}<div class="page-wifi">${ow}${h}${guestCard()}${hwWifiSections()}</div>`;
  }

  /* ── Huawei Wi-Fi ayarları + kanal analizi (4. aşama) ───────────────────── */
  async function loadHwWifi(force) {
    if (!state.huawei?.enabled || !state.huawei?.connected) return;
    if (state.hwWifiLoading || (state.hwWifi && !force)) return;
    state.hwWifiLoading = true;
    try {
      state.hwWifi = await NP.getHuaweiWifi();
      state.hwWifiError = '';
    } catch (e) {
      state.hwWifiError = e.message;
    } finally {
      state.hwWifiLoading = false;
      if (state.page === '/wifi') render();
    }
  }
  /* ── Misafir Wi-Fi (Huawei misafir ağı) ── */
  const GUEST_VALID = [[1, '4 saat'], [2, '1 gün'], [3, 'Sınırsız']];
  function fmtRest(s) {
    if (!s) return '';
    let d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d} gün ${h} sa` : h ? `${h} sa ${m} dk` : `${m} dk`;
  }
  function guestCard() {
    let hw = state.huawei;
    if (!hw?.enabled || !hw.connected) return '';
    if (!state.xGuest && !state.xGuestError) loadX('xGuest', () => NP.getGuestWifi(), '/wifi');
    let head = (extra = '') => cardHead('users', 'Misafir Wi-Fi', extra);
    if (state.xGuestError) return `<section class="card guest-card">${head()}<div class="form-error">${esc(state.xGuestError)}</div><p class="field-hint">Bu Huawei modeli misafir ağını desteklemiyor olabilir.</p></section>`;
    let g = state.xGuest;
    if (!g) return `<section class="card guest-card">${head()}<div class="empty">Misafir ağı okunuyor…</div></section>`;
    let F = state.guestF || g,
      timer = g.enabled && g.valid < 3 && g.rest ? `<span class="pill"><i class="dot"></i>${esc(fmtRest(g.rest))} kaldı</span><button class="btn small" type="button" data-guest-extend>+30 dk</button>` : '';
    let status = `<div class="guest-status"><div class="toggle-line"><div><strong>${g.enabled ? esc(g.ssid) : 'Misafir ağı kapalı'}</strong><p>${g.enabled ? `${g.secure ? 'Şifreli' : 'Şifresiz (açık)'} · ${esc(GUEST_VALID.find((x) => x[0] === g.valid)?.[1] || '')}${g.limit ? ` · en fazla ${g.limitMbps} Mbit/s` : ''}` : 'Misafirleriniz ev cihazlarınızı (bilgisayar, kamera, NAS) göremeyen ayrı bir ağa bağlanır.'}</p></div><input class="switch" type="checkbox" data-guest-toggle aria-label="Misafir ağını aç/kapat" ${g.enabled ? 'checked' : ''}></div>${g.enabled ? `<div class="guest-actions">${timer}<button class="btn small" type="button" data-guest-qr>${icon('qr')}QR ile paylaş</button></div>` : ''}</div>`;
    let form = `<form id="guest-form" class="x-form guest-form"><div class="guest-grid">
      <div class="field-wrap"><label for="guest-ssid">Ağ adı</label><input class="field" id="guest-ssid" name="ssid" maxlength="32" value="${esc(F.ssid)}" required></div>
      <div class="field-wrap"><label for="guest-sec">Güvenlik</label><select class="field" id="guest-sec" name="open" data-guest-sec><option value="0" ${F.secure ? 'selected' : ''}>Şifreli (önerilen)</option><option value="1" ${F.secure ? '' : 'selected'}>Şifresiz (açık)</option></select></div>
      <div class="field-wrap guest-pw" ${F.secure ? '' : 'hidden'}><label for="guest-pw">Şifre</label><input class="field" id="guest-pw" name="password" type="password" minlength="8" maxlength="63" autocomplete="new-password" placeholder="${g.secure ? 'Değiştirmek için yazın' : 'En az 8 karakter'}"></div>
      <div class="field-wrap"><label for="guest-valid">Açık kalma süresi</label><select class="field" id="guest-valid" name="valid">${GUEST_VALID.map(([v, l]) => `<option value="${v}" ${F.valid === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field-wrap"><label for="guest-limit">Hız sınırı</label><select class="field" id="guest-limit" name="limit" data-guest-limit><option value="0" ${F.limit ? '' : 'selected'}>Sınırsız</option><option value="1" ${F.limit ? 'selected' : ''}>Sınırla</option></select></div>
      <div class="field-wrap guest-mbps" ${F.limit ? '' : 'hidden'}><label for="guest-mbps">En fazla (Mbit/s)</label><input class="field num" id="guest-mbps" name="limitMbps" type="number" min="1" max="1000" value="${F.limitMbps || 20}"></div>
    </div><p class="field-hint">Süre dolunca Huawei misafir ağını kendisi kapatır. Hız sınırı tüm misafirlerin toplamı içindir.</p><div class="form-error" id="guest-error"></div><div class="x-form-foot"><button class="btn primary" type="submit">Kaydet</button></div></form>`;
    return `<section class="card guest-card">${head()}${status}${form}</section>`;
  }
  function readGuest(f) {
    return { ssid: f.ssid.value.trim(), open: f.open.value === '1', secure: f.open.value !== '1', password: f.password.value, valid: +f.valid.value, limit: f.limit.value === '1', limitMbps: +f.limitMbps.value || 0 };
  }
  async function saveGuest(patch, msg) {
    try {
      await NP.setGuestWifi(patch);
      state.guestF = null;
      state.xGuest = await NP.getGuestWifi();
      toast(msg);
    } catch (e) {
      let el = document.getElementById('guest-error');
      if (el) el.textContent = e.message;
      else toast(e.message);
      return false;
    }
    if (state.page === '/wifi') render();
    return true;
  }
  document.addEventListener('change', async (e) => {
    let t = e.target;
    if (t.matches('[data-guest-sec]')) {
      document.querySelector('.guest-pw').hidden = t.value === '1';
      return;
    }
    if (t.matches('[data-guest-limit]')) {
      document.querySelector('.guest-mbps').hidden = t.value !== '1';
      return;
    }
    if (t.matches('[data-guest-toggle]')) {
      let on = t.checked, g = state.xGuest;
      if (on && !g.secure && !confirm('Misafir ağı şifresiz açılacak; menzildeki herkes bağlanabilir. Devam edilsin mi?')) return (t.checked = false);
      t.disabled = true;
      let ok = await saveGuest({ enabled: on }, on ? 'Misafir ağı açıldı' : 'Misafir ağı kapatıldı');
      if (!ok) { t.checked = !on; t.disabled = false; }
    }
  });
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'guest-form') return;
    e.preventDefault();
    let f = e.target, p = readGuest(f), err = document.getElementById('guest-error');
    err.textContent = '';
    if (!p.ssid) return (err.textContent = 'Ağ adı boş olamaz');
    if (p.secure && p.password && p.password.length < 8) return (err.textContent = 'Şifre en az 8 karakter olmalı');
    if (p.secure && !p.password && !state.xGuest.secure) return (err.textContent = 'Şifreli misafir ağı için bir şifre girin');
    if (p.limit && !(p.limitMbps >= 1 && p.limitMbps <= 1000)) return (err.textContent = 'Hız sınırı 1-1000 Mbit/s olmalı');
    if (p.open && state.xGuest.secure && !confirm('Misafir ağı şifresiz olacak; menzildeki herkes bağlanabilir. Devam edilsin mi?')) return;
    state.guestF = { ...p, password: '' };
    let btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor…';
    if (!(await saveGuest(p, 'Misafir Wi-Fi kaydedildi'))) { btn.disabled = false; btn.textContent = 'Kaydet'; }
  });
  document.addEventListener('click', async (e) => {
    let b = e.target.closest('[data-guest-extend],[data-guest-qr]');
    if (!b) return;
    if (b.matches('[data-guest-extend]')) {
      b.disabled = true;
      try {
        await NP.extendGuestWifi();
        state.xGuest = await NP.getGuestWifi();
        toast('Süre 30 dakika uzatıldı');
      } catch (x) {
        toast(x.message);
      }
      return render();
    }
    let g = state.xGuest, svg = null;
    try {
      let q = await NP.getGuestQr();
      if (!q.secure || q.password) svg = await NP.qrSvg(NP.wifiQrText(q.ssid, q.password, !q.secure));
    } catch (_) {}
    openXPanel({ kind: 'qr', ssid: g.ssid, open: !g.secure, bandLabel: 'Misafir ağı', svg });
  });
  function hwWifiSections() {
    let hw = state.huawei;
    if (!hw?.enabled || !hw.connected) return '';
    if (!state.hwWifi && !state.hwWifiError) {
      loadHwWifi();
      return `<section class="card">${cardHead('wifi', 'Wi-Fi ayarları')}<div class="empty">Huawei ayarları okunuyor…</div></section>`;
    }
    if (state.hwWifiError) {
      return `<section class="card">${cardHead('wifi', 'Wi-Fi ayarları')}<div class="form-error">${esc(state.hwWifiError)}</div><button class="btn small" data-hw-reload>Tekrar dene</button></section>`;
    }
    let w = state.hwWifi,
      bands = w.dbho ? [{ ...w.bands[0], bandLabel: '2,4 + 5 GHz', band: 'both' }] : w.bands;
    let rows = bands
      .map((b) => {
        let ch = b.band === 'both' ? '' : b.auto ? `Kanal: otomatik (şu an ${b.actualChannel || '—'})` : `Kanal: ${b.channel}`;
        return `<div class="wifi-row hw-wifi-row"><span class="wifi-glyph ${b.enabled ? '' : 'off'}">${icon('wifi')}</span><div class="wifi-info"><div class="wifi-name">${esc(b.ssid)}${b.hidden ? ' <span class="badge">Gizli</span>' : ''}</div><div class="wifi-sub"><span class="badge">${esc(b.bandLabel)}</span> · ${esc(b.securityLabel)}${ch ? ' · ' + esc(ch) : ''}</div></div><div class="wifi-right"><button class="btn small" data-hw-edit="${esc(b.band)}">Düzenle</button><button class="btn small" type="button" data-wifi-qr="${esc(b.band)}" title="QR kod ile paylaş">${icon('qr')}QR</button></div></div>`;
      })
      .join('');
    let note = w.dbho
      ? '<p class="field-hint">Huawei "çift bant tek ağ" modunda: ad ve şifre iki bant için ortaktır, kanal Huawei tarafından otomatik seçilir.</p>'
      : '';
    return `<section class="card">${cardHead('wifi', 'Wi-Fi ayarları')}<div class="wifi-list">${rows}</div>${note}</section>${channelCard()}`;
  }
  function channelCard() {
    let w = state.hwWifi;
    if (!w || w.dbho) return '';
    let sc = state.hwScan,
      body;
    if (state.hwScanning) {
      body = '<div class="empty"><i class="dot"></i> Çevredeki ağlar taranıyor (~10 sn)…</div>';
    } else if (!sc) {
      body =
        '<p class="field-hint">Komşu ağların kullandığı kanalları tarar ve her bant için en boş kanalı önerir. Ping dalgalanmasının yaygın sebeplerinden biri kalabalık kanaldır.</p>';
    } else {
      body = ['2g', '5g'].map((band) => channelBand(band, sc)).join('') + neighborList(sc);
    }
    let btn = `<button class="btn small" data-hw-scan ${state.hwScanning ? 'disabled' : ''}>${sc ? 'Tekrar tara' : 'Kanalları tara'}</button>`;
    return `<section class="card">${cardHead('speed', 'Kanal analizi', btn)}${body}${state.hwScanError ? `<div class="form-error">${esc(state.hwScanError)}</div>` : ''}</section>`;
  }
  function channelBand(band, sc) {
    let b = (state.hwWifi?.bands || []).find((x) => x.band === band);
    let rec = sc.recommend?.[band];
    if (!b || !rec) return '';
    let cur = b.auto ? b.actualChannel : b.channel;
    let load = rec.load || {},
      max = Math.max(1, ...Object.values(load));
    let label = (k) => (band === '2g' ? `Kanal ${k}` : `${k}–${+k + 12}${+k >= 52 ? ' (radar)' : ''}`);
    let bars = Object.keys(load)
      .map((k) => {
        let isBest = band === '2g' ? +k === rec.channel : +k === rec.block;
        let isCur = band === '2g' ? +k === cur : cur >= +k && cur <= +k + 12;
        let pct = Math.round((load[k] / max) * 100);
        return `<div class="ch-bar${isBest ? ' best' : ''}${isCur ? ' cur' : ''}"><span>${label(k)}${isCur ? ' <small>şu an</small>' : ''}</span><i class="ch-track"><em style="width:${Math.max(3, pct)}%"></em></i><b>${load[k] === 0 ? 'boş' : load[k]}</b></div>`;
      })
      .join('');
    let same = cur === rec.channel;
    let action = same
      ? '<span class="badge ok">Zaten en iyi kanalda</span>'
      : `<button class="btn small primary" data-hw-apply="${band}" data-ch="${rec.channel}">Kanal ${dat(rec.channel)} geç</button>`;
    return `<div class="ch-band"><div class="ch-band-head"><strong>${esc(b.bandLabel)}</strong><span class="field-hint">Şu an kanal ${cur || '—'}${b.auto ? ' (otomatik)' : ''} · Önerilen: <b>${rec.channel}</b>${rec.dfs ? ' (radar kanalı)' : ''}</span></div><div class="ch-bars">${bars}</div><div class="ch-band-foot"><span class="field-hint">${esc(rec.reason)}</span>${action}</div></div>`;
  }
  // Sayıya Türkçe yönelme eki: 6 -> 6'ya, 11 -> 11'e, 40 -> 40'a, 100 -> 100'e
  function dat(n) {
    n = Math.abs(Math.round(n));
    let ones = ["'e", "'e", "'ye", "'e", "'e", "'e", "'ya", "'ye", "'e", "'a"],
      tens = ['', "'a", "'ye", "'a", "'a", "'ye", "'a", "'e", "'e", "'a"];
    if (n % 10) return n + ones[n % 10];
    if (n % 100) return n + tens[(n % 100) / 10];
    if (n % 1000) return n + "'e";
    return n + "'e";
  }
  function neighborList(sc) {
    let list = (sc.networks || []).slice().sort((a, b) => (b.signal ?? -999) - (a.signal ?? -999));
    if (!list.length) return '<p class="field-hint">Çevrede başka ağ bulunamadı ya da Huawei tarama sonucu vermedi.</p>';
    return `<details class="ch-neighbors"><summary>Çevredeki ağlar (${list.length})</summary>${list
      .map(
        (n) =>
          `<div class="ch-neighbor"><span>${esc(n.ssid)}</span><span class="badge">${n.band === '5g' ? '5 GHz' : '2,4 GHz'}</span><span>Kanal ${n.channel}</span><span class="field-hint">${n.signal != null ? n.signal + ' dBm' : '—'}</span></div>`,
      )
      .join('')}</details>`;
  }
  function drawHwWifi(band) {
    let w = state.hwWifi;
    if (!w) return;
    let b = band === 'both' ? { ...w.bands[0], bandLabel: '2,4 + 5 GHz', band: 'both' } : w.bands.find((x) => x.band === band);
    if (!b) return;
    let rec = state.hwScan?.recommend?.[band]?.channel;
    let chOpts =
      band === 'both'
        ? ''
        : `<div class="field-wrap"><label>Kanal</label><select class="field" name="channel"><option value="0"${b.auto ? ' selected' : ''}>Otomatik${b.actualChannel ? ' (şu an ' + b.actualChannel + ')' : ''}</option>${b.channels
            .map(
              (c) =>
                `<option value="${c}"${!b.auto && b.channel === c ? ' selected' : ''}>${c}${c === rec ? ' — önerilen' : ''}${band === '5g' && c >= 52 && c <= 144 ? ' (radar)' : ''}</option>`,
            )
            .join('')}</select><span class="field-hint">${band === '2g' ? 'Çakışmayı önlemek için 1, 6 veya 11 seçin.' : 'Oyun için radar (DFS) olmayan 36–48 önerilir.'}</span></div>`;
    let host = document.getElementById('drawer-host');
    host.innerHTML = `<div class="drawer-backdrop open" data-close-drawer></div><aside class="drawer open" role="dialog" aria-modal="true"><div class="drawer-head"><div><div class="eyebrow">HUAWEI Wi-Fi</div><h2>${esc(b.ssid)}</h2><p>${esc(b.bandLabel)} · ${esc(b.securityLabel)}</p></div><button class="icon-btn" data-close-drawer>${icon('x')}</button></div><form class="drawer-body" id="hw-wifi-form" data-band="${esc(band)}"><div class="drawer-section"><div class="field-wrap"><label>Ağ adı (SSID)</label><input class="field" name="ssid" maxlength="32" value="${esc(b.ssid)}"></div>${
      b.open
        ? '<p class="field-hint">Bu ağ şifresiz (açık). Güvenlik tipini Huawei arayüzünden değiştirin.</p>'
        : `<div class="field-wrap"><label>Şifre</label><div class="password-line"><input class="field" name="password" type="password" minlength="8" maxlength="63" autocomplete="new-password" placeholder="Kayıtlı — değiştirmek için yazın"></div><span class="field-hint">Boş bırakırsanız mevcut şifre korunur. 8–63 karakter.</span></div>`
    }${chOpts}<div class="toggle-line"><div><strong>Ağı gizle</strong><p>Ağ adı yayınlanmaz; cihazlar adı elle girerek bağlanır.</p></div><input class="switch" type="checkbox" name="hidden"${b.hidden ? ' checked' : ''}></div></div>${
      w.dbho ? '<p class="field-hint drawer-section">Çift bant tek ağ modu: ad ve şifre iki banda birlikte uygulanır.</p>' : ''
    }<div class="drawer-section alert">Kaydedince Huawei Wi-Fi yeniden başlar; bu ağa bağlı cihazlar birkaç saniye kopar ve şifre değiştiyse yeni şifreyle tekrar bağlanmaları gerekir.</div><div class="form-error" id="hw-wifi-error"></div></form><div class="drawer-foot"><span></span><div class="drawer-actions"><button class="btn" data-close-drawer>İptal</button><button class="btn primary" type="submit" form="hw-wifi-form">Kaydet</button></div></div></aside>`;
    state.drawerHwWifi = band;
  }
  async function runHwScan() {
    state.hwScanning = true;
    state.hwScanError = '';
    render();
    try {
      let cur = {};
      (state.hwWifi?.bands || []).forEach((b) => (cur[b.band] = b.auto ? b.actualChannel : b.channel));
      state.hwScan = await NP.scanHuaweiChannels(cur);
    } catch (e) {
      state.hwScanError = e.message;
    } finally {
      state.hwScanning = false;
      if (state.page === '/wifi') render();
    }
  }
  async function saveHwWifi(form) {
    let band = form.dataset.band,
      err = document.getElementById('hw-wifi-error'),
      btn = document.querySelector('.drawer-foot button[type=submit]'),
      cur = band === 'both' ? state.hwWifi.bands[0] : state.hwWifi.bands.find((x) => x.band === band),
      f = new FormData(form),
      patch = {};
    let ssid = String(f.get('ssid') || '').trim();
    if (ssid !== cur.ssid) patch.ssid = ssid;
    let pw = String(f.get('password') || '');
    if (pw) patch.password = pw;
    let hidden = form.querySelector('[name=hidden]').checked;
    if (hidden !== cur.hidden) patch.hidden = hidden;
    if (form.querySelector('[name=channel]')) {
      let ch = +f.get('channel');
      if (ch !== (cur.auto ? 0 : cur.channel)) patch.channel = ch;
    }
    if (!Object.keys(patch).length) {
      err.textContent = 'Değişiklik yok.';
      return;
    }
    if (!confirm('Huawei Wi-Fi yeniden başlayacak; bağlı cihazlar birkaç saniye kopacak. Devam edilsin mi?')) return;
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor…';
    try {
      await NP.saveHuaweiWifi(band, patch);
      document.getElementById('drawer-host').replaceChildren();
      state.drawerHwWifi = null;
      toast('Wi-Fi ayarları kaydedildi');
      await loadHwWifi(true);
      try {
        state.huawei = await NP.getHuawei();
      } catch (_) {}
      if (state.page === '/wifi') render();
    } catch (x) {
      err.textContent = x.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kaydet';
    }
  }
  /* ═══ Keenetic tarzı ekler ═══════════════════════════════════════════════ */
  // Tek seferlik yükleyici: aynı anahtar yüklenirken tekrar çağrılmaz; bitince ilgili sayfayı yeniden çizer
  async function loadX(key, fn, page) {
    state.xLoading = state.xLoading || {};
    if (state.xLoading[key]) return;
    state.xLoading[key] = true;
    try {
      state[key] = await fn();
      state[key + 'Error'] = '';
    } catch (e) {
      state[key + 'Error'] = e.message;
    } finally {
      state.xLoading[key] = false;
      if (!page || state.page === page || (page === '/devices' && state.page.startsWith('/devices/'))) render();
    }
  }
  const nameOf = (key) => {
    let c = state.clients.find((x) => x.mac === key);
    return c ? c.displayName : key.startsWith('ip:') ? key.slice(3) + ' (eski cihaz)' : NP.fmt.mac(key);
  };

  /* ── İstatistik sayfası ── */
  function statsPage() {
    let st = (state.stats = state.stats || { days: 30, hours: 24 });
    st.adays ??= 7;
    st.amac ??= '';
    if (!state.xApps && !state.xAppsError) loadX('xApps', () => NP.getApps(st.adays, st.amac), '/stats');
    if (!state.xUsage && !state.xUsageError) loadX('xUsage', () => NP.getUsage(st.days), '/stats');
    if (!state.xPing && !state.xPingError) loadX('xPing', () => NP.getPingHistory(st.hours), '/stats');
    let seg = (name, cur, opts) =>
      `<div class="seg">${opts.map(([v, l]) => `<button class="seg-btn${cur === v ? ' active' : ''}" data-x-${name}="${v}">${l}</button>`).join('')}</div>`;
    return `${pageHead('Kullanım', 'İstatistik', 'Cihaz başına trafik ve hat kalitesi geçmişi.')}<div class="grid stats-grid">
      <section class="card span-12">${cardHead('chart', 'Trafik', seg('days', st.days, [[7, '7 gün'], [30, '30 gün']]))}${usageBody()}</section>
      <section class="card span-12">${cardHead('apps', 'Uygulamalar', `<div class="apps-head">${appsDevSelect()}${seg('adays', st.adays, [[1, 'Bugün'], [7, '7 gün'], [30, '30 gün']])}</div>`)}${appsBody()}</section>
      <section class="card span-12">${cardHead('speed', 'Hat kalitesi (ping / kayıp)', seg('hours', st.hours, [[24, '24 saat'], [168, '7 gün']]))}${pingBody()}</section>
    </div>`;
  }
  /* ── Uygulama bazlı trafik ── */
  const APP_COLORS = { YouTube: '#e5484d', Netflix: '#c4242b', 'Disney+': '#2f5bd3', 'Prime Video': '#1a98ff', Twitch: '#8f5cf6', Spotify: '#1db954', TikTok: '#25c2c9', Instagram: '#d6409f', Facebook: '#3b6fd8', WhatsApp: '#25b863', Discord: '#5865f2', Steam: '#3a6ea5', 'Windows Update': '#2b88d8', Microsoft: '#2b88d8', Apple: '#8e8e93', Google: '#4285f4', Zoom: '#2d8cff' };
  const appColor = (n) => APP_COLORS[n] || (/^(Web|Diğer|DNS)/.test(n) ? 'var(--muted)' : 'var(--accent)');
  function appsDevSelect() {
    let st = state.stats,
      macs = Object.keys(state.xApps?.devices || {});
    if (st.amac && !macs.includes(st.amac)) macs.unshift(st.amac);
    return `<select class="field apps-dev" data-x-amac aria-label="Cihaz"><option value="">Tüm cihazlar</option>${macs.map((m) => `<option value="${esc(m)}" ${st.amac === m ? 'selected' : ''}>${esc(nameOf(m))}</option>`).join('')}</select>`;
  }
  function appsBody() {
    if (state.xAppsError) return `<div class="form-error">${esc(state.xAppsError)}</div>`;
    let a = state.xApps;
    if (!a) return '<div class="empty">Yükleniyor…</div>';
    if (!a.services.length) return '<div class="empty">Henüz veri yok. Uygulama trafiği her dakika toplanır; birkaç dakika sonra burada görünür.</div>';
    let list = a.services.slice(0, 12),
      all = a.services.reduce((s, x) => s + x.down + x.up, 0),
      max = Math.max(1, ...list.map((x) => x.down + x.up));
    let rows = list
      .map((x) => {
        let t = x.down + x.up,
          who = Object.entries(a.devices)
            .map(([m, l]) => [m, l.find((y) => y.name === x.name)])
            .filter(([, y]) => y)
            .sort((p, q) => q[1].down + q[1].up - (p[1].down + p[1].up))
            .slice(0, 3)
            .map(([m]) => nameOf(m));
        return `<div class="x-rank app-rank"><i class="app-dot" style="background:${appColor(x.name)}"></i><span class="x-rank-name" title="${esc(x.name)}">${esc(x.name)}${!state.stats.amac && who.length ? `<small>${esc(who.join(', '))}</small>` : ''}</span><i class="x-track"><em style="width:${(t / max) * 100}%;background:${appColor(x.name)}"></em></i><b>${NP.fmt.bytes(t)}<small>%${Math.round((t / all) * 100)}</small></b></div>`;
      })
      .join('');
    let note =
      a.source === 'adguard'
        ? 'Servisler AdGuard’ın DNS kayıtlarından tanınır; tahminidir. Şifreli DNS (DoH) kullanan cihazlarda bazı trafik “Web (diğer)” görünür.'
        : 'AdGuard bağlı olmadığı için servisler yalnız porta göre tahmin ediliyor (YouTube, Netflix gibi adlar görünmez). Entegrasyon > AdGuard Home’u bağlayın.';
    return `<div class="x-ranks">${rows}</div><p class="field-hint">${note} Flow offloading açıkken hızlandırılan bağlantılar eksik sayılabilir.</p>`;
  }
  function usageBody() {
    if (state.xUsageError) return `<div class="form-error">${esc(state.xUsageError)}</div>`;
    let u = state.xUsage;
    if (!u) return '<div class="empty">Yükleniyor…</div>';
    if (!u.days.length)
      return '<div class="empty">Henüz veri yok. İstatistikler her dakika toplanır; birkaç dakika sonra burada görünür.</div>';
    let sum = (k) => u.days.reduce((a, d) => a + d.total[k], 0);
    let wanTiles = Object.entries(u.wan)
      .map(([w, v]) => `<div class="x-tile"><small>${esc(w)}</small><b>${NP.fmt.bytes(v.rx + v.tx)}</b><span>↓ ${NP.fmt.bytes(v.rx)} · ↑ ${NP.fmt.bytes(v.tx)}</span></div>`)
      .join('');
    let tiles = `<div class="x-tiles"><div class="x-tile"><small>Tüm cihazlar</small><b>${NP.fmt.bytes(sum('rx') + sum('tx'))}</b><span>↓ ${NP.fmt.bytes(sum('rx'))} · ↑ ${NP.fmt.bytes(sum('tx'))}</span></div>${wanTiles}</div>`;
    let top = u.devices.slice(0, 12),
      max = Math.max(1, ...top.map((d) => d.total));
    let rows = top
      .map((d) => {
        let c = state.clients.find((x) => x.mac === d.key);
        return `<div class="x-rank"><span class="type-icon tiny">${typeIcon(c?.type || 'other')}</span><span class="x-rank-name">${esc(nameOf(d.key))}</span><i class="x-track"><em class="dl" style="width:${(d.rx / max) * 100}%"></em><em class="ul" style="width:${(d.tx / max) * 100}%"></em></i><b>${NP.fmt.bytes(d.total)}</b></div>`;
      })
      .join('');
    return `${tiles}${dayChart(u.days)}<h3 class="x-sub">En çok kullanan cihazlar</h3><div class="x-ranks">${rows}</div><p class="field-hint">Cihaz trafiği yalnız flow offloading kapalıyken tam ölçülür; açıkken hızlandırılan bağlantılar sayılmaz.</p>`;
  }
  function dayChart(days) {
    let W = 720, H = 160, pad = 26, n = days.length, bw = (W - pad) / n,
      max = Math.max(1, ...days.map((d) => d.total.rx + d.total.tx));
    let bars = days
      .map((d, i) => {
        let x = pad + i * bw + 1, hr = (d.total.rx / max) * (H - 6), ht = (d.total.tx / max) * (H - 6),
          lbl = d.date.slice(8) + '.' + d.date.slice(5, 7);
        return `<g><title>${lbl}: ↓ ${NP.fmt.bytes(d.total.rx)} · ↑ ${NP.fmt.bytes(d.total.tx)}</title><rect class="dl" x="${x}" y="${H - 2 - hr - ht}" width="${Math.max(2, bw - 3)}" height="${hr}" rx="2"/><rect class="ul" x="${x}" y="${H - 2 - ht}" width="${Math.max(2, bw - 3)}" height="${ht}" rx="2"/></g>`;
      })
      .join('');
    // eksen yazıları HTML'de: SVG genişliğe göre esnediği için içindeki yazı mobilde ezilirdi
    let axis = days
      .map((d, i) => (n <= 10 || i % Math.ceil(n / 7) === 0 ? `<span style="left:${((pad + i * bw + bw / 2) / W) * 100}%">${d.date.slice(8)}.${d.date.slice(5, 7)}</span>` : ''))
      .join('');
    return `<div class="x-chart"><div class="x-ymax">${NP.fmt.bytes(max)}</div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Günlük trafik">${bars}</svg><div class="x-axis">${axis}</div><div class="x-legend start"><span class="dl">↓ İndirme</span><span class="ul">↑ Yükleme</span></div></div>`;
  }
  function pingBody() {
    if (state.xPingError) return `<div class="form-error">${esc(state.xPingError)}</div>`;
    let p = state.xPing;
    if (!p) return '<div class="empty">Yükleniyor…</div>';
    let wans = Object.entries(p.wans);
    if (!wans.length) return '<div class="empty">Henüz ping verisi yok; her dakika bir ölçüm alınır.</div>';
    return wans
      .map(([w, x]) => {
        let down = x.avg == null;
        let tiles = `<div class="x-tiles small"><div class="x-tile"><small>Ortalama</small><b>${down ? '—' : x.avg + ' ms'}</b></div><div class="x-tile"><small>En kötü</small><b>${x.max == null ? '—' : x.max + ' ms'}</b></div><div class="x-tile"><small>Paket kaybı</small><b class="${x.lossPct >= 5 ? 'bad' : x.lossPct > 0 ? 'warn' : ''}">%${x.lossPct}</b></div><div class="x-tile"><small>Kesinti</small><b class="${x.outages ? 'bad' : ''}">${x.outages}</b></div></div>`;
        return `<div class="x-ping"><div class="ch-band-head"><strong>${esc(w)}</strong>${down ? '<span class="badge err">Ölçüm yok / çevrimdışı</span>' : ''}</div>${tiles}${down ? '' : pingChart(x.samples)}</div>`;
      })
      .join('');
  }
  function pingChart(samples) {
    let W = 720, H = 120, t0 = samples[0].t, t1 = samples[samples.length - 1].t || t0 + 1,
      ok = samples.filter((s) => s.avg != null), max = Math.max(10, ...ok.map((s) => s.avg)) * 1.15;
    let X = (t) => ((t - t0) / Math.max(1, t1 - t0)) * W, Y = (v) => H - 14 - (v / max) * (H - 24);
    let path = '', pen = false;
    samples.forEach((s) => {
      if (s.avg == null) return (pen = false);
      path += (pen ? 'L' : 'M') + X(s.t).toFixed(1) + ' ' + Y(s.avg).toFixed(1);
      pen = true;
    });
    let loss = samples.filter((s) => s.loss > 0).map((s) => `<rect class="loss${s.loss >= 100 ? ' full' : ''}" x="${X(s.t).toFixed(1)}" y="${H - 10}" width="3" height="8"><title>${new Date(s.t).toLocaleString('tr-TR')}: %${s.loss} kayıp</title></rect>`).join('');
    let tl = (t) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `<div class="x-chart"><div class="x-ymax">${Math.round(max)} ms</div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Ping geçmişi"><path class="ping-line" d="${path}"/>${loss}</svg><div class="x-legend"><span>${tl(t0)}</span><span class="loss">sarı: kayıp · kırmızı: kesinti</span><span>${tl(t1)}</span></div></div>`;
  }

  /* ── Yeni cihazlar (Cihazlar sayfası üstü) ── */
  function newDevicesCard() {
    if (!state.xNewdev && !state.xNewdevError) loadX('xNewdev', () => NP.getNewDevices(), '/devices');
    let n = state.xNewdev;
    if (!n || !n.items.length) return '';
    let unseen = n.items.filter((x) => x.unseen);
    let list = (unseen.length ? unseen : n.items.slice(0, 5))
      .map((x) => {
        let c = state.clients.find((y) => y.mac === x.mac);
        return `<div class="wifi-row"><span class="type-icon tiny">${typeIcon(c?.type || 'other')}</span><div class="wifi-info"><div class="wifi-name">${esc(c?.displayName || x.hostname || NP.fmt.mac(x.mac))}${x.unseen ? ' <span class="badge warn">Yeni</span>' : ''}</div><div class="wifi-sub">${esc(NP.fmt.mac(x.mac))} · ${esc(x.ip || '—')} · ${new Date(x.t).toLocaleString('tr-TR')}</div></div><div class="wifi-right">${c?.blocked || state.xBlocked?.[x.mac] ? '<span class="badge err">Engelli</span>' : `<button class="btn small danger" data-x-block="${esc(x.mac)}">Engelle</button>`}${c ? `<button class="btn small" data-client="${esc(x.mac)}">Aç</button>` : ''}</div></div>`;
      })
      .join('');
    let head = unseen.length ? `${unseen.length} yeni cihaz ağa katıldı` : 'Son katılan cihazlar';
    return `<section class="card x-newdev${unseen.length ? ' attention' : ''}">${cardHead('bell', head, unseen.length ? '<button class="btn small" data-x-ack>Tamam, gördüm</button>' : '')}<div class="wifi-list">${list}</div>${n.blockNew ? '<p class="field-hint">Yeni cihazlar otomatik engelleniyor (Sistem > Bildirimler).</p>' : ''}</section>`;
  }

  /* ── Cihaz paneli: internet saat planı ── */
  function injectSchedule(c) {
    let body = document.querySelector('#drawer-host .drawer-body');
    if (!body) return;
    let draft = (state.schedDraft = state.schedDraft?.mac === c.mac ? state.schedDraft : { mac: c.mac, rules: (c.schedule || []).map((r) => ({ ...r })) });
    let sec = document.createElement('div');
    sec.className = 'drawer-section x-sched';
    let dayBtns = [1, 2, 3, 4, 5, 6, 7].map((d) => `<button type="button" class="chip" data-x-day="${d}">${['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][d]}</button>`).join('');
    sec.innerHTML = `<div class="x-sched-head"><strong>${icon('clock')} İnternet saat planı</strong>${c.schedBlocked ? '<span class="badge err">Şu an kapalı</span>' : ''}</div>
      <p class="field-hint">Seçilen gün ve saatlerde bu cihazın interneti kapanır (ör. hafta içi 23:00–07:00). Gece yarısını aşan aralıklar desteklenir.</p>
      <div class="x-rules">${draft.rules.map((r, i) => `<div class="x-rule"><span>${esc(r.label || NP.parseSchedule(r.days.join('') + '|' + r.from + '|' + r.to)?.label || '')}</span><button type="button" class="btn small" data-x-delrule="${i}">Sil</button></div>`).join('') || '<div class="field-hint">Plan yok — cihaz her zaman internete erişebilir.</div>'}</div>
      <div class="x-addrule"><div class="chip-row" id="x-days">${dayBtns}</div><div class="x-quick chip-row"><button type="button" class="chip" data-x-preset="12345">Hafta içi</button><button type="button" class="chip" data-x-preset="67">Hafta sonu</button><button type="button" class="chip" data-x-preset="1234567">Her gün</button></div>
      <div class="x-times"><label>Başlangıç<input class="field" type="time" id="x-from" value="23:00"></label><label>Bitiş<input class="field" type="time" id="x-to" value="07:00"></label><button type="button" class="btn small" data-x-addrule>Ekle</button></div></div>
      <div class="x-sched-foot"><span class="form-error" id="x-sched-error"></span><button type="button" class="btn small primary" data-x-savesched="${esc(c.mac)}">Planı kaydet</button></div>
      ${state.xTz?.isUtc ? '<p class="field-hint warn-text">Router saati UTC. Planın Türkiye saatine göre çalışması için Sistem > Saat dilimi’nden İstanbul’u seçin.</p>' : ''}`;
    body.appendChild(sec);
    if (!state.xTz && !state.xTzError) loadX('xTz', () => NP.getTimezone(), '__none__');
  }

  /* ── Sistem sayfası ekleri ── */
  function systemExtras() {
    if (!state.xTz && !state.xTzError) loadX('xTz', () => NP.getTimezone(), '/system');
    if (!state.xNotify && !state.xNotifyError) loadX('xNotify', () => NP.getNotify(), '/system');
    return securityCard() + maintenanceCard() + `<div class="span-6 x-stack">${tzCard()}${backupCard()}</div>` + notifyCard();
  }
  function tzCard() {
    let t = state.xTz;
    let body = !t
      ? '<div class="empty">Yükleniyor…</div>'
      : `${t.isUtc ? '<div class="alert">Router saati UTC (Türkiye saatinden 3 saat geri). Saat planları ve geçmiş kayıtları yanlış saatte görünür.</div>' : ''}
        <div class="x-inline"><select class="field" id="x-tz">${NP.TIMEZONES.map((z) => `<option value="${z.id}"${z.id === t.zone ? ' selected' : ''}>${esc(z.label)}</option>`).join('')}</select><button class="btn small primary" data-x-savetz>Kaydet</button></div>
        <p class="field-hint">Router saati: ${esc(t.now || '—')} (UTC${esc(t.offset || '')})</p>`;
    return `<section class="card">${cardHead('clock', 'Saat dilimi')}${body}</section>`;
  }
  function notifyCard() {
    let n = state.xNotify;
    if (state.xNotifyError) return `<section class="card span-6">${cardHead('bell', 'Bildirimler (Telegram)')}<div class="form-error">${esc(state.xNotifyError)}</div></section>`;
    if (!n) return `<section class="card span-6">${cardHead('bell', 'Bildirimler (Telegram)')}<div class="empty">Yükleniyor…</div></section>`;
    return `<section class="card span-6">${cardHead('bell', 'Bildirimler (Telegram)')}<form id="x-notify-form" class="x-form">
      <div class="toggle-line"><div><strong>Telegram bildirimleri</strong><p>Hat koptuğunda ve yeni cihaz katıldığında telefonunuza mesaj gelir.</p></div><input class="switch" type="checkbox" name="enabled"${n.enabled ? ' checked' : ''}></div>
      <details${n.tokenSet ? '' : ' open'}><summary>Bot ayarları</summary>
        <ol class="field-hint x-steps"><li>Telegram'da <b>@BotFather</b>'a <code>/newbot</code> yazın, bot oluşturun ve verdiği token'ı kopyalayın.</li><li>Yeni botunuza bir mesaj (<code>/start</code>) gönderin.</li><li>Chat ID'nizi <b>@userinfobot</b>'tan öğrenin.</li></ol>
        <div class="field-wrap"><label>Bot token</label><input class="field" name="token" autocomplete="off" placeholder="${n.tokenSet ? 'Kayıtlı — değiştirmek için yazın' : '123456789:AAH...'}"></div>
        <div class="field-wrap"><label>Chat ID</label><input class="field" name="chatId" inputmode="numeric" value="${esc(n.chatId)}" placeholder="ör. 987654321"></div>
      </details>
      <div class="toggle-line"><div><strong>Hat koptu / geldi</strong></div><input class="switch" type="checkbox" name="wan"${n.wan ? ' checked' : ''}></div>
      <div class="toggle-line"><div><strong>Yeni cihaz katıldı</strong></div><input class="switch" type="checkbox" name="newdev"${n.newdev ? ' checked' : ''}></div>
      <div class="toggle-line"><div><strong>Cihaz eve geldi / ayrıldı</strong><p>Hangi cihazların takip edileceği cihaz panelinden seçilir.</p></div><input class="switch" type="checkbox" name="presence"${n.presence ? ' checked' : ''}></div>
      <div class="toggle-line"><div><strong>Sistem uyarıları</strong><p>Sıcaklık, depolama, bellek; NetOS güncellemeleri.</p></div><input class="switch" type="checkbox" name="system"${n.system ? ' checked' : ''}></div>
      <div class="toggle-line"><div><strong>Yeni cihazları otomatik engelle</strong><p>Tanımadığınız cihaz, siz izin verene kadar internete çıkamaz.</p></div><input class="switch" type="checkbox" name="blockNew"${n.blockNew ? ' checked' : ''}></div>
      ${n.curl ? '' : '<p class="form-error">curl kurulu değil; bildirimler gönderilemez.</p>'}
      <div class="x-form-foot"><span class="form-error" id="x-notify-error"></span><button type="button" class="btn small" data-x-testnotify>Test mesajı</button><button class="btn small primary" type="submit">Kaydet</button></div></form></section>`;
  }
  function backupCard() {
    return `<section class="card">${cardHead('save', 'Yedekleme')}<p class="field-hint">Tüm router ayarlarının (ağ, Wi-Fi, NetOS cihaz kayıtları, SQM, mwan3…) yedeğini indirin. Geri yükleme router'ı yeniden başlatır.</p>
      <div class="x-inline"><button class="btn small primary" data-x-backup>Yedeği indir</button></div>
      <div class="x-inline"><input class="field" type="file" id="x-restore-file" accept=".tar.gz,.tgz,application/gzip"><button class="btn small danger" data-x-restore>Geri yükle</button></div>
      <span class="form-error" id="x-backup-error"></span></section>`;
  }
  function tunnelCard() {
    let t = state.xTunnel, cf = (state.cf = state.cf || {});
    let head = cardHead('cloud', 'Uzaktan erişim (Cloudflare Tunnel)');
    if (state.xTunnelError) return `<section class="card span-12">${head}<div class="form-error">${esc(state.xTunnelError)}</div></section>`;
    if (!t) return `<section class="card span-12">${head}<div class="empty">Yükleniyor…</div></section>`;
    if (!t.installed) return `<section class="card span-12">${head}<p class="field-hint">cloudflared kurulu değil. Router'da: <code>apk add cloudflared luci-app-cloudflared</code></p></section>`;
    let statusLine = `<div class="x-status"><span class="pill"><i class="dot ${t.running && t.connections ? '' : t.running ? 'warn' : 'off'}"></i>${t.running ? (t.connections ? `Bağlı · ${t.connections} bağlantı` : 'Çalışıyor, bağlanıyor…') : 'Kapalı'}</span>${t.tunnelId ? `<span class="field-hint">Tünel ${esc(t.tunnelId.slice(0, 8))}…</span>` : ''}${t.tokenSet ? `<label class="toggle-inline">Açık <input class="switch" type="checkbox" data-x-cfenable${t.enabled ? ' checked' : ''}></label>` : ''}</div>`;
    let hosts = t.hosts.length
      ? `<div class="wifi-list">${t.hosts.map((h) => `<div class="wifi-row"><span class="wifi-glyph">${icon('globe')}</span><div class="wifi-info"><div class="wifi-name"><a href="https://${esc(h.hostname)}" target="_blank" rel="noopener">${esc(h.hostname)} ↗</a></div><div class="wifi-sub">→ ${esc(h.service)}</div></div></div>`).join('')}</div>`
      : '';
    // sihirbaz
    let step;
    if (!cf.lookup) {
      step = `<div class="field-wrap"><label>Cloudflare API token</label><input class="field" type="password" id="x-cf-api" autocomplete="off" value="${esc(cf.apiToken || '')}" placeholder="Cloudflare > My Profile > API Tokens"></div>
        <details class="field-hint"><summary>Token nasıl oluşturulur?</summary><ol class="x-steps"><li>dash.cloudflare.com > Sağ üst profil > <b>My Profile > API Tokens > Create Token > Create Custom Token</b></li><li>İzinler: <b>Account · Cloudflare Tunnel · Edit</b>, <b>Account · Access: Apps and Policies · Edit</b>, <b>Zone · DNS · Edit</b>, <b>Zone · Zone · Read</b></li><li>Token'ı kopyalayıp buraya yapıştırın. NetOS bu token'ı <b>kaydetmez</b>, yalnız bu kurulumda kullanır.</li></ol></details>
        <button class="btn small primary" data-x-cflookup>Hesabı getir</button>`;
    } else {
      let zones = cf.lookup.zones;
      step = `<div class="x-grid2"><label class="field-wrap">Alan adı<select class="field" id="x-cf-zone">${zones.map((z) => `<option value="${z.id}" data-acc="${z.accountId}"${cf.zone === z.id ? " selected" : ""}>${esc(z.name)}</option>`).join('')}</select></label>
        <label class="field-wrap">Alt alan adı<input class="field" id="x-cf-sub" value="${esc(cf.sub || 'panel')}" placeholder="panel"></label></div>
        <label class="field-wrap">Hedef (router'ın ağındaki adres)<input class="field" id="x-cf-svc" value="${esc(cf.svc || 'http://192.168.1.1:80')}"></label>
        <div class="chip-row">${[['NetOS paneli', 'http://192.168.1.1:80'], ...state.clients.filter((c) => c.web?.length).slice(0, 4).map((c) => [c.displayName, c.web[0].replace(/\/$/, '')])].map(([l, v]) => `<button type="button" class="chip" data-x-cfsvc="${esc(v)}">${esc(l)}</button>`).join('')}</div>
        <div class="toggle-line"><div><strong>Cloudflare Access koruması (önerilir)</strong><p>Adrese yalnız bu e-posta, gelen tek kullanımlık kodla girebilir. Kapalıyken adresi bilen herkes giriş ekranına ulaşır.</p></div><input class="switch" type="checkbox" id="x-cf-accesson" checked></div>
        <label class="field-wrap">E-posta<input class="field" type="email" id="x-cf-email" value="${esc(cf.email || '')}" placeholder="ornek@gmail.com"></label>
        ${cf.lookup.existingTunnel ? '<p class="field-hint">Router\'daki mevcut tünel kullanılacak; tüneldeki diğer adresler korunur.</p>' : '<p class="field-hint">Router\'da tünel yok; yeni bir tünel oluşturulup router\'a bağlanacak.</p>'}
        <div class="x-form-foot"><button class="btn small" data-x-cfback>Geri</button><button class="btn small primary" data-x-cfpublish>Yayınla</button></div>`;
    }
    let result = cf.result
      ? `<div class="alert ok-alert">Hazır: <a href="${esc(cf.result.url)}" target="_blank" rel="noopener">${esc(cf.result.url)} ↗</a>${cf.result.access ? (cf.result.access.ok ? ` · Access: yalnız ${esc(cf.result.access.email)}` : ` · <b>${esc(cf.result.access.error)}</b>`) : ' · <b>Access koruması yok</b>'}<br><span class="field-hint">DNS kaydının yayılması 1-2 dakika sürebilir.</span></div>`
      : '';
    return `<section class="card span-12 integ-detail" id="integ-cloudflare">${head}${statusLine}${hosts}
      <div class="x-cf-grid"><div><h3 class="x-sub">Otomatik kurulum (API)</h3>${step}</div>
      <div><h3 class="x-sub">Token ile bağla</h3><p class="field-hint">Cloudflare Zero Trust > Networks > Tunnels > tünel > "Install connector" ekranındaki token'ı yapıştırın. ${t.tokenSet ? '<b>Mevcut token değiştirilir.</b>' : ''}</p><div class="x-inline"><input class="field" type="password" id="x-cf-token" autocomplete="off" placeholder="eyJ..."><button class="btn small" data-x-cftoken>Bağla</button></div></div></div>
      <span class="form-error" id="x-cf-error">${esc(cf.error || '')}</span>${result}
      <p class="field-hint">Uyarı: router panelini internete açmak risklidir; Access korumasını kapatmayın ve güçlü bir panel şifresi kullanın.</p></section>`;
  }

  /* ═══ Entegrasyonlar ═════════════════════════════════════════════════════ */
  // Yeni bir cihaz/servis desteği eklemek: buraya bir kayıt + router'da /usr/libexec/netpanel/ altında bir betik
  const INTEGRATIONS = [
    { id: 'huawei', icon: 'wifi', name: 'Huawei WiFi AX2 / WS5200', cat: 'Wi-Fi erişim noktası', desc: 'Huawei cihazın Wi-Fi’sini aç/kapa; ağ adı, şifre, kanal ve kanal analizi. Bağlı cihazların bandı cihaz listesinde görünür.' },
    { id: 'tplink', icon: 'router', name: 'TP-Link Archer BE230', cat: 'Wi-Fi erişim noktası · Deneysel', desc: 'Wi-Fi 7 router’ı erişim noktası olarak NetOS’tan yönetin: bantları aç/kapa, ağ adı ve şifre. Gerçek cihazda henüz doğrulanmadı.', beta: true },
    { id: 'adguard', icon: 'block', name: 'AdGuard Home', cat: 'Reklam ve site engelleme · Yönetim menüsünde', desc: 'Tüm ağda reklam ve izleyici engelleme; cihaz başına YouTube, TikTok gibi uygulama engeli ve güvenli arama.', page: '/adblock', setup: true },
    { id: 'vpn', icon: 'vpn', name: 'WireGuard VPN', cat: 'Uzaktan erişim · Yönetim menüsünde', desc: 'Dışarıdayken telefonunuzdan ev ağınıza güvenle bağlanın; cihaz eklemek için QR kod.', page: '/vpn' },
    { id: 'cloudflare', icon: 'cloud', name: 'Cloudflare Tunnel', cat: 'Uzaktan erişim', desc: 'Port açmadan panele ve ağdaki servislere dışarıdan güvenli erişim; e-posta ile giriş koruması.' },
    { id: 'scanner', icon: 'radar', name: 'Ağ tarayıcı', cat: 'Araç · Analiz menüsünde', desc: 'Ağdaki tüm IP adreslerini tarar; bilinmeyen cihazları, açık portları ve web arayüzlerini bulur. Açınca Analiz menüsüne eklenir.', page: '/scanner' },
  ];
  const integOn = (id) => (id === 'huawei' || id === 'tplink' ? !!(state.xInteg?.[id] || state.integLocal?.[id]) : !!state.xInteg?.[id]);
  function integrationsPage() {
    if (!state.xInteg && !state.xIntegError) loadX('xInteg', () => NP.getIntegrations(), '/integrations');
    let g = state.xInteg;
    if (state.xIntegError) return `${pageHead('Eklentiler', 'Entegrasyonlar', '')}<div class="form-error">${esc(state.xIntegError)}</div>`;
    if (g && integOn('cloudflare') && !state.xTunnel && !state.xTunnelError) loadX('xTunnel', () => NP.getTunnel(), '/integrations');
    let tiles = INTEGRATIONS.map((x) => {
      let on = integOn(x.id);
      let st = x.soon
        ? '<span class="badge">Yakında</span>'
        : !g
          ? ''
          : x.id === 'huawei' && on
            ? state.huawei?.connected
              ? '<span class="badge ok">Bağlı</span>'
              : state.huawei?.error
                ? `<span class="badge err" title="${esc(state.huawei.error)}">${/şifre/i.test(state.huawei.error) ? 'Şifre yanlış' : 'Bağlanamadı'}</span>`
                : '<span class="badge warn">Ayar bekliyor</span>'
            : x.id === 'cloudflare' && on && state.xTunnel
              ? state.xTunnel.running && state.xTunnel.connections
                ? '<span class="badge ok">Tünel bağlı</span>'
                : '<span class="badge warn">Tünel kapalı</span>'
              : on
                ? '<span class="badge ok">Açık</span>'
                : '<span class="badge">Kapalı</span>';
      let open = !on || x.soon ? '' : (x.setup || !x.page ? `<button class="link-btn" type="button" data-integ-open="${x.id}">Ayarlar</button>` : '') + (x.page ? `<a class="link-btn" href="#${x.page}">Aç →</a>` : '');
      let ctl = x.soon
        ? '<span class="integ-soon">Geliştiriliyor</span>'
        : `<input class="switch" type="checkbox" data-integ="${x.id}" aria-label="${esc(x.name)}"${on ? ' checked' : ''}${g ? '' : ' disabled'}>`;
      return `<article class="integ-tile${on ? ' on' : ''}${x.soon ? ' soon' : ''}"><div class="integ-top"><span class="integ-icon">${icon(x.icon)}</span><div><h3>${esc(x.name)}</h3><small>${esc(x.cat)}</small></div></div><p>${esc(x.desc)}</p><div class="integ-foot">${st}${open}${ctl}</div></article>`;
    }).join('');
    return `${pageHead('Eklentiler', 'Entegrasyonlar', 'NetOS’u ağınızdaki diğer cihaz ve servislerle bağlayın. Kullandıklarınızı etkinleştirin, ayarlarını “Ayarlar”dan yapın.')}<div class="integ-grid">${tiles}</div>`;
  }
  // Entegrasyon ayarları açılır pencerede (sağdan çekmece); sayfa yeniden çizilse de açık kalır
  function drawIntegDrawer() {
    let id = state.integDrawer,
      x = INTEGRATIONS.find((i) => i.id === id),
      host = document.getElementById('drawer-host');
    if (!x || !host) return;
    let body = id === 'tplink' ? tplinkSettings() : id === 'huawei' ? huaweiConfigCard() : id === 'cloudflare' ? tunnelCard() : id === 'adguard' ? adguardSettings() : '';
    let prev = host.querySelector('.drawer-body')?.scrollTop ?? state.integDrawerScroll ?? 0;
    host.innerHTML = `<div class="drawer-backdrop open" data-close-drawer></div><aside class="drawer open integ-drawer" role="dialog" aria-modal="true" aria-label="${esc(x.name)}"><div class="drawer-head"><div class="integ-top"><span class="integ-icon">${icon(x.icon)}</span><div><div class="eyebrow">Entegrasyon</div><h2>${esc(x.name)}</h2><p>${esc(x.cat)}</p></div></div><button class="icon-btn" type="button" aria-label="Kapat" data-close-drawer>${icon('x')}</button></div><div class="drawer-body">${body}</div></aside>`;
    let b = host.querySelector('.drawer-body');
    b.scrollTop = prev;
    b.addEventListener('scroll', () => (state.integDrawerScroll = b.scrollTop), { passive: true });
  }
  function openIntegDrawer(id) {
    state.integDrawer = id;
    state.integDrawerScroll = 0;
    if (id === 'cloudflare' && !state.xTunnel && !state.xTunnelError) loadX('xTunnel', () => NP.getTunnel(), '/integrations');
    drawIntegDrawer();
  }

  /* ── TP-Link (deneysel) ── */
  function loadTp(page) {
    if (!state.xTp && !state.xTpError) loadX('xTp', () => NP.getTplink(), page);
    return state.xTp;
  }
  function tplinkSettings() {
    let t = loadTp('/integrations');
    if (state.xTpError) return `<div class="form-error">${esc(state.xTpError)}</div>`;
    if (!t) return '<div class="empty">Yükleniyor…</div>';
    let st = !t.enabled ? '' : t.connected ? `<div class="sec-ok">✓ Bağlandı · ${t.bands.length} bant okundu</div>` : `<div class="form-error">${esc(t.error || 'Bağlanılamadı')}</div>`;
    return `<div class="alert">Deneysel destek: Archer BE230 v2 (fw 1.3.x) için yazıldı, gerçek cihazda henüz denenmedi. Sorun olursa “Wi-Fi” sayfasındaki ayarlar çalışmayabilir; TP-Link’in kendi arayüzü her zaman kullanılabilir.</div>
      <form id="tp-form" class="x-form"><div class="field-wrap"><label>TP-Link IP adresi</label><input class="field num" name="host" value="${esc(t.host)}" placeholder="ör. 192.168.1.3" inputmode="decimal"></div>
      <div class="x-grid2"><div class="field-wrap"><label>Kullanıcı adı</label><input class="field" name="username" value="${esc(t.username)}"></div><div class="field-wrap"><label>Yönetici şifresi</label><input class="field" name="password" type="password" autocomplete="off" placeholder="${t.passwordSet ? 'Kayıtlı — değiştirmek için yazın' : ''}"></div></div>
      <p class="field-hint">Şifre yalnız router’da saklanır, tarayıcıya geri gönderilmez. BE230’u erişim noktası (AP) modunda kullanın ve ${t.host ? '' : 'IP adresini '}Cihazlar’dan sabit IP verin.</p>
      ${st}<div class="form-error" id="tp-error"></div><div class="x-form-foot">${t.host ? `<a class="link-btn" href="http://${esc(t.host)}/" target="_blank" rel="noopener">TP-Link arayüzü ↗</a>` : ''}<button class="btn primary" type="submit">Kaydet ve bağlan</button></div></form>`;
  }
  // Wi-Fi sayfasındaki TP-Link bölümü
  function tplinkWifiSection() {
    if (!integOn('tplink')) return '';
    let t = loadTp('/wifi');
    let rows = !t
      ? '<div class="empty">Yükleniyor…</div>'
      : !t.connected
        ? `<div class="empty">${esc(t.error || 'Bağlı değil')} · <a href="#/integrations">Ayarlar</a></div>`
        : `<div class="wifi-list">${t.bands.map((b) => `<div class="wifi-row hw-wifi-row"><span class="wifi-glyph ${b.enabled ? '' : 'off'}">${icon('wifi')}</span><div class="wifi-info"><div class="wifi-name">${esc(b.ssid)}</div><div class="wifi-sub">${esc(b.bandLabel)} · TP-Link</div></div><div class="wifi-right"><input class="switch" type="checkbox" data-tp-band="${esc(b.band)}"${b.enabled ? ' checked' : ''} aria-label="${esc(b.bandLabel)} aç/kapat"><button class="btn small" type="button" data-tp-edit="${esc(b.band)}">Düzenle</button></div></div>`).join('')}</div>`;
    return `<section class="card wifi-detail">${cardHead('router', 'TP-Link Archer BE230', '<span class="badge">Deneysel</span>')}${rows}</section>`;
  }
  function tpWifiPanel(p) {
    let b = state.xTp?.bands.find((x) => x.band === p.band) || { ssid: '', bandLabel: '' };
    return {
      icon: 'wifi', eyebrow: 'TP-Link Wi-Fi', title: b.ssid || 'Wi-Fi', sub: b.bandLabel,
      body: `<form id="tp-wifi-form" class="x-form" data-band="${esc(p.band)}"><div class="field-wrap"><label>Ağ adı (SSID)</label><input class="field" name="ssid" maxlength="32" value="${esc(b.ssid)}"></div>
        <div class="field-wrap"><label>Yeni şifre</label><input class="field" name="password" type="password" minlength="8" maxlength="63" autocomplete="off" placeholder="Boş bırakılırsa değişmez"></div>
        <div class="alert">Kaydedince bu banttaki cihazlar birkaç saniye kopar; şifre değiştiyse yeni şifreyle bağlanmaları gerekir.</div>
        <div class="form-error" id="tpw-error"></div><div class="x-form-foot"><button type="button" class="btn" data-close-drawer>İptal</button><button class="btn primary" type="submit">Kaydet</button></div></form>`,
    };
  }

  /* ── Ağ tarayıcı (Analiz > Ağ tarayıcı) ── */
  function scannerPage() {
    let head = pageHead('Analiz', 'Ağ tarayıcı', 'Ağdaki tüm IP adreslerini tarayın: bilinmeyen cihazlar, açık portlar, web arayüzleri.');
    if (state.xInteg && !integOn('scanner'))
      return `${head}<section class="card"><div class="empty">Ağ tarayıcı kapalı. <a href="#/integrations">Entegrasyonlar</a> sayfasından etkinleştirin.</div></section>`;
    return `${head}${scannerBox()}`;
  }
  function scannerBox() {
    let sc = state.xScan;
    if (!sc && !state.xScanError) loadX('xScan', () => NP.getScan(), '/scanner').then(pollScan);
    let busy = sc?.running;
    let phase = !sc ? '' : sc.phase === 'ping' ? 'Adresler taranıyor' : sc.phase === 'ports' ? 'Portlar ve web arayüzleri kontrol ediliyor' : '';
    let pct = sc && sc.total ? Math.round((sc.done / sc.total) * 100) : 0;
    let range = state.scanRange ?? sc?.result?.range ?? '';
    let ctl = `<form class="scan-ctl" id="scan-form"><div class="scan-range"><label for="scan-range">Taranacak adresler</label><input class="field" id="scan-range" value="${esc(range)}" placeholder="Otomatik: routerın yerel ağları" autocomplete="off" spellcheck="false"${busy ? ' disabled' : ''}><span class="field-hint">Örnek: 192.168.1.0/24 · 192.168.1.10-50 · 10.0.0.5 — en fazla 1024 adres</span></div><label class="check-line"><input type="checkbox" id="scan-ports"${state.scanPorts === false ? '' : ' checked'}${busy ? ' disabled' : ''}> Port ve web arayüzü kontrolü</label><button class="btn primary" type="submit"${busy ? ' disabled' : ''}>${icon('radar')}${busy ? 'Taranıyor…' : sc?.result ? 'Yeniden tara' : 'Taramayı başlat'}</button></form><div class="form-error" id="scan-error">${esc(state.scanStartError || '')}</div>`;
    let prog = busy ? `<div class="scan-progress"><div class="scan-bar"><i style="width:${pct}%"></i></div><span>${phase} · ${sc.done}/${sc.total}</span></div>` : '';
    let body = '';
    if (state.xScanError) body = `<div class="form-error">${esc(state.xScanError)}</div>`;
    else if (!sc) body = '<div class="empty">Yükleniyor…</div>';
    else if (!sc.result && !busy) body = '<div class="empty">Henüz tarama yapılmadı. Boş bırakırsanız routerın yerel ağları (ör. 192.168.1.1–254) taranır; 10–30 saniye sürer.</div>';
    else if (sc.result) body = scanResults(sc);
    return `<section class="card scan-card" id="scanner-box">${ctl}${prog}${body}</section>`;
  }
  const scanClient = (h) => (h.mac ? state.clients.find((x) => x.mac === h.mac) : null);
  function scanList(sc) {
    let f = state.scanFilter || 'all',
      q = (state.scanQuery || '').trim().toLowerCase(),
      sort = state.scanSort || { key: 'ip', dir: 1 };
    let ipn = (ip) => ip.split('.').reduce((a, x) => a * 256 + +x, 0);
    let list = sc.result.hosts
      .map((h) => {
        let c = scanClient(h);
        return { h, c, name: c ? c.displayName : h.name || '', type: c?.type && c.type !== 'other' ? c.type : h.type };
      })
      .filter(({ h, c }) => f === 'all' || (f === 'unknown' && !c && !h.self) || (f === 'web' && h.web.length) || (f === 'ports' && h.ports.length))
      .filter(({ h, name }) => !q || [h.ip, h.mac, NP.fmt.mac(h.mac || ''), name, h.name].join(' ').toLowerCase().includes(q));
    let key = {
      ip: (x) => ipn(x.h.ip),
      name: (x) => (x.name || '~').toLowerCase(),
      ping: (x) => (x.h.ping == null ? 1e9 : x.h.ping),
      type: (x) => x.type,
    }[sort.key];
    return list.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * sort.dir);
  }
  function scanRow({ h, c, name, type }) {
    let tags = `${h.self ? '<span class="badge ok">Bu router</span>' : c ? '' : '<span class="badge warn">NetOS’ta yok</span>'}${h.randomMac ? '<span class="badge" title="Telefonların özel (rastgele) Wi-Fi adresi">Rastgele MAC</span>' : ''}`;
    let ports = h.ports.map((p) => `<span class="port-tag" title="TCP ${p.port}">${esc(p.name)}<small>${p.port}</small></span>`).join('');
    let globe = !h.web.length
      ? ''
      : h.web.length === 1
        ? `<a class="icon-btn globe" href="${esc(h.web[0])}" target="_blank" rel="noopener" title="Web arayüzünü aç: ${esc(h.web[0])}" aria-label="Web arayüzünü aç">${icon('globe')}</a>`
        : `<details class="pop"><summary class="icon-btn globe" title="${h.web.length} web arayüzü" aria-label="Web arayüzleri">${icon('globe')}<i class="pop-count">${h.web.length}</i></summary><div class="pop-menu">${h.web.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/\/$/, ''))} ↗</a>`).join('')}</div></details>`;
    let menu = `<details class="pop"><summary class="icon-btn" title="Diğer işlemler" aria-label="Diğer işlemler">${icon('more')}</summary><div class="pop-menu">
      <button type="button" data-copy="${esc(h.ip)}">IP adresini kopyala</button>
      ${h.mac ? `<button type="button" data-copy="${esc(NP.fmt.mac(h.mac))}">MAC adresini kopyala</button>` : ''}
      ${h.mac && !h.self ? `<button type="button" data-wol="${esc(h.mac)}">Uyandır (Wake-on-LAN)</button>` : ''}
      ${c ? `<button type="button" data-client="${esc(c.mac)}">NetOS’ta ayarlarını aç</button>` : ''}
      ${h.web.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/\/$/, ''))} ↗</a>`).join('')}
    </div></details>`;
    return `<div class="scan-row"><span class="type-icon tiny" title="${c?.type && c.type !== 'other' ? '' : 'Tahmini: '}${esc(NP.TYPE_LABELS[type] || 'Diğer')}">${typeIcon(type)}</span>
      <span class="scan-ip num"><button type="button" class="copy-btn" data-copy="${esc(h.ip)}" title="IP adresini kopyala">${esc(h.ip)}${icon('copy')}</button></span>
      <div class="scan-name"><strong>${esc(name || '—')}</strong>${c && h.name && h.name !== name ? `<small>${esc(h.name)}</small>` : ''}<div class="scan-tags">${tags}</div></div>
      <span class="scan-mac num">${h.mac ? `<button type="button" class="copy-btn" data-copy="${esc(NP.fmt.mac(h.mac))}" title="MAC adresini kopyala">${esc(NP.fmt.mac(h.mac))}${icon('copy')}</button>` : '—'}</span>
      <span class="scan-ping num">${h.ping == null ? '<span title="Ping’e yanıt vermedi, ARP ile bulundu">—</span>' : h.ping < 1 ? '<1 ms' : Math.round(h.ping) + ' ms'}</span>
      <div class="scan-ports">${ports}</div><div class="scan-act">${globe}${menu}</div></div>`;
  }
  function scanResults(sc) {
    let r = sc.result,
      all = r.hosts.map((h) => ({ h, c: scanClient(h) }));
    let n = {
      all: r.hosts.length,
      unknown: all.filter(({ h, c }) => !c && !h.self).length,
      web: r.hosts.filter((h) => h.web.length).length,
      ports: r.hosts.filter((h) => h.ports.length).length,
    };
    let f = state.scanFilter || 'all',
      sort = state.scanSort || { key: 'ip', dir: 1 };
    let chip = (id, label) => `<button type="button" class="chip${f === id ? ' active' : ''}" data-scan-filter="${id}">${label} <b>${n[id]}</b></button>`;
    let th = (key, label) => `<button type="button" class="th-sort${sort.key === key ? ' on' : ''}" data-scan-sort="${key}">${label}${sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button>`;
    let secs = sc.finished && sc.started ? Math.max(1, Math.round((sc.finished - sc.started) / 1000)) : 0;
    let where = r.range || r.nets.map((x) => x.cidr.replace(/\.\d+\//, '.0/')).join(', ');
    return `<div class="scan-summary"><div><b>${n.all}</b> cihaz bulundu${secs ? ` · ${secs} sn` : ''} · ${esc(where)}${sc.finished ? ` · ${new Date(sc.finished).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}</div><button class="btn small" type="button" data-scan-csv>${icon('save')}CSV indir</button></div>
      <div class="scan-tools"><div class="chip-row">${chip('all', 'Tümü')}${chip('unknown', 'NetOS’ta olmayan')}${r.portsChecked ? chip('web', 'Web arayüzü') : ''}${r.tcpChecked ? chip('ports', 'Açık port') : ''}</div><input class="field scan-search" id="scan-search" type="search" placeholder="IP, ad veya MAC ara" value="${esc(state.scanQuery || '')}" autocomplete="off"></div>
      ${r.portsChecked && !r.tcpChecked ? '<p class="field-hint">Router’daki curl TCP port kontrolünü desteklemiyor; yalnız web arayüzleri kontrol edildi.</p>' : ''}
      <div class="scan-table"><div class="scan-row scan-head"><span>${th('type', 'Tip')}</span><span>${th('ip', 'IP')}</span><span>${th('name', 'Ad')}</span><span>MAC</span><span>${th('ping', 'Ping')}</span><span>Servisler</span><span></span></div><div id="scan-rows">${scanRowsHtml(sc)}</div></div>
      <p class="field-hint">Simgeler tahminidir (ad ve açık portlara göre). Ping’e yanıt vermeyen cihazlar ARP ile yine bulunur. Port kontrolü yalnız bağlantı açılıp açılmadığına bakar, veri göndermez.</p>`;
  }
  const scanRowsHtml = (sc) => scanList(sc).map(scanRow).join('') || '<div class="empty">Bu filtrede cihaz yok.</div>';
  function redrawScanner() {
    let el = document.getElementById('scanner-box');
    if (!el) return;
    let q = document.activeElement?.id === 'scan-search';
    el.outerHTML = scannerBox();
    if (q) {
      let s = document.getElementById('scan-search');
      s?.focus();
      s?.setSelectionRange(s.value.length, s.value.length);
    }
  }
  function pollScan() {
    clearTimeout(state.scanTimer);
    if (!state.xScan?.running) return;
    state.scanTimer = setTimeout(async () => {
      if (state.page !== '/scanner') return;
      try {
        state.xScan = await NP.getScan();
      } catch (e) {
        state.xScanError = e.message;
      }
      redrawScanner();
      pollScan();
    }, 1000);
  }
  function scanCsv() {
    let r = state.xScan?.result;
    if (!r) return;
    let q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let lines = [['IP', 'Ad', 'Tahmini tip', 'MAC', 'Ping (ms)', 'NetOS kaydı', 'Web', 'Portlar'].map(q).join(',')];
    r.hosts.forEach((h) => {
      let c = scanClient(h);
      lines.push([h.ip, c?.displayName || h.name, NP.TYPE_LABELS[h.type] || h.type, h.mac, h.ping ?? '', c ? 'evet' : 'hayır', h.web.join(' '), h.ports.map((p) => `${p.port}/${p.name}`).join(' ')].map(q).join(','));
    });
    let url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    let a = document.createElement('a');
    a.href = url;
    a.download = `netos-ag-taramasi-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  // http üzerinde navigator.clipboard yok; eski yöntemle de dener
  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch (_) {
      let ta = document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (_) {}
      ta.remove();
      return ok;
    }
  }

  /* ── Sistem > Güncelleme ── */
  function updateCard() {
    if (!state.xUpd && !state.xUpdError) loadX('xUpd', () => NP.getUpdate(), '/system');
    let u = state.xUpd,
      run = state.updRun;
    let body;
    if (run)
      body = `<div class="upd-run"><div class="scan-bar indeterminate"><i></i></div><strong>${run.state === 'error' ? 'Güncelleme başarısız' : 'Güncelleniyor…'}</strong><p class="field-hint">${run.state === 'error' ? 'Ayrıntılar aşağıda. Mevcut sürüm çalışmaya devam ediyor.' : 'Router servisleri birkaç saniye yeniden başlayacak; sayfa kendiliğinden yenilenir. Sonrasında tekrar giriş yapmanız gerekebilir.'}</p>${run.log ? `<pre class="upd-log">${esc(run.log)}</pre>` : ''}${run.state === 'error' ? '<button class="btn small" type="button" data-upd-close>Kapat</button>' : ''}</div>`;
    else if (state.xUpdError) body = `<div class="form-error">${esc(state.xUpdError)}</div>`;
    else if (!u) body = '<div class="empty">Denetleniyor…</div>';
    else
      body = `<div class="upd-head"><div><small>Kurulu sürüm</small><b class="num">v${esc(u.current)}</b></div>${
        u.available
          ? `<span class="badge warn">Yeni sürüm: v${esc(u.latest)}</span>`
          : u.latest
            ? '<span class="badge ok">Güncel</span>'
            : ''
      }</div>
      ${u.error ? `<p class="field-hint warn-text">${esc(u.error)}</p>` : ''}
      ${u.available && u.notes ? `<details class="upd-notes" open><summary>v${esc(u.latest)} yenilikleri${u.published ? ` · ${new Date(u.published).toLocaleDateString('tr-TR')}` : ''}</summary><pre>${esc(u.notes)}</pre>${u.url ? `<a href="${esc(u.url)}" target="_blank" rel="noopener">GitHub’da gör ↗</a>` : ''}</details>` : ''}
      <div class="toggle-line"><div><strong>Otomatik güncelle</strong><p>Her gece 04:30 civarı yeni sürüm varsa kurulur. Kapalıyken yalnız bildirim gönderilir (Telegram açıksa).</p></div><input class="switch" type="checkbox" data-upd-auto${u.auto ? ' checked' : ''}></div>
      <div class="x-form-foot"><span class="field-hint">${u.checked ? `Son kontrol: ${new Date(u.checked).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''} · ${esc(u.repo)}</span><button class="btn small" type="button" data-upd-check>Denetle</button>${u.available ? `<button class="btn small primary" type="button" data-upd-apply>v${esc(u.latest)} sürümüne güncelle</button>` : ''}</div>`;
    return `<section class="card span-7" id="upd-card">${cardHead('download', 'Güncelleme')}${body}</section>`;
  }
  function redrawUpdate() {
    let el = document.getElementById('upd-card');
    if (el) el.outerHTML = updateCard();
  }
  async function pollUpdate(t0 = Date.now()) {
    let r = null;
    try {
      r = await NP.getUpdateStatus();
    } catch (_) {}
    if (r) {
      state.updRun = { state: r.state, log: r.log };
      if (r.state === 'done') {
        toast(`NetOS v${r.current} kuruldu, sayfa yenileniyor…`);
        return setTimeout(() => location.reload(), 1500);
      }
      if (r.state === 'error') return redrawUpdate();
    } else if (Date.now() - t0 > 20000) {
      // servisler yeniden başlarken istekler kısa süre yanıtsız kalır; bitince sayfayı tazele
      return setTimeout(() => location.reload(), 8000);
    }
    redrawUpdate();
    setTimeout(() => pollUpdate(t0), 2000);
  }

  /* ═══ Ağ özellikleri: port yönlendirme, yerel ağ, VPN, QR ═══════════════ */
  // Açılır panel (sağdan çekmece). Sayfa yeniden çizilince state.xPanel'e göre tekrar açılır.
  function drawXPanel() {
    let p = state.xPanel,
      host = document.getElementById('drawer-host');
    if (!p || !host) return;
    let v = { pf: pfPanel, qr: qrPanel, peer: peerPanel, tpwifi: tpWifiPanel, conns: connsPanel }[p.kind]?.(p);
    if (!v) return;
    let prev = host.querySelector('.drawer-body')?.scrollTop || 0;
    host.innerHTML = `<div class="drawer-backdrop open" data-close-drawer></div><aside class="drawer open x-panel" role="dialog" aria-modal="true" aria-label="${esc(v.title)}"><div class="drawer-head"><div class="integ-top"><span class="integ-icon">${icon(v.icon)}</span><div><div class="eyebrow">${esc(v.eyebrow)}</div><h2>${esc(v.title)}</h2>${v.sub ? `<p>${esc(v.sub)}</p>` : ''}</div></div><button class="icon-btn" type="button" aria-label="Kapat" data-close-drawer>${icon('x')}</button></div><div class="drawer-body">${v.body}</div></aside>`;
    host.querySelector('.drawer-body').scrollTop = prev;
  }
  function openXPanel(p) {
    state.xPanel = p;
    drawXPanel();
  }
  // Gerekli paket kurulu değilse: açıklama + "Kur" düğmesi + ilerleme
  function pkgGate(set, what, size) {
    let st = state.pkgRun?.[set];
    let body = st?.running
      ? `<div class="scan-progress"><div class="scan-bar indeterminate"><i></i></div><span>Paket indiriliyor ve kuruluyor… (internet gerekir, 10-60 sn)</span></div>`
      : st?.failed
        ? `<div class="form-error">Kurulum başarısız.</div>${st.log ? `<pre class="upd-log">${esc(st.log)}</pre>` : ''}<button class="btn small" type="button" data-pkg="${set}">Tekrar dene</button>`
        : `<button class="btn primary" type="button" data-pkg="${set}">${icon('download')}Kur</button>`;
    return `<div class="pkg-gate"><p>${what} için gerekli paket router’da kurulu değil (${size}). Kurulum OpenWrt’nin resmi paket deposundan yapılır.</p>${body}</div>`;
  }
  async function pollPkg(set, done) {
    let s = null;
    try {
      s = await NP.pkgStatus(set);
    } catch (_) {}
    state.pkgRun = { ...state.pkgRun, [set]: s || { running: true } };
    if (s?.installed) {
      delete state.pkgRun[set];
      toast('Paket kuruldu');
      return done();
    }
    if (s && !s.running) return render();
    render();
    setTimeout(() => pollPkg(set, done), 2000);
  }
  // WAN türü uyarısı (CGNAT / başka modem arkası): port açma ve VPN dışarıdan çalışmayabilir
  function wanWarning(wans, what) {
    if (!wans?.length) return '';
    let pub = wans.filter((w) => w.kind === 'public');
    let rows = wans.map((w) => `<li><b>${esc(w.name)}</b> <span class="num">${esc(w.ip)}</span> — ${esc(w.kindLabel)}</li>`).join('');
    if (pub.length === wans.length) return '';
    return `<div class="alert wan-alert ${pub.length ? "" : "alert-strong"}"><strong>${pub.length ? `Bazı hatlarda ${what} dışarıdan çalışmaz.` : `Dikkat: ${what} internetten erişilemeyebilir.`}</strong><ul class="wan-kinds">${rows}</ul>${
      pub.length
        ? ''
        : `<span>CGNAT hattında operatörünüzden <b>“statik/gerçek IP”</b> isteyin (çoğu zaman ücretsiz ya da düşük ücretli). Başka modemin arkasındaki hatta ise o modemde de aynı portu bu router’a (${esc(wans.find((w) => w.kind === 'private')?.ip || '')}) yönlendirin ya da DMZ yapın.${what === 'VPN' ? ' Web servisleri için Cloudflare Tunnel bu sorundan etkilenmez.' : ''}</span>`
    }</div>`;
  }
  const clientByIp = (ip) => state.clients.find((c) => c.ip === ip);
  const protoLabel = (p) => (p === 'tcp' ? 'TCP' : p === 'udp' ? 'UDP' : 'TCP+UDP');

  /* ── Port yönlendirme ── */
  const PF_PRESETS = [
    ['Web (HTTP)', 'tcp', '80'],
    ['HTTPS', 'tcp', '443'],
    ['SSH', 'tcp', '22'],
    ['Uzak masaüstü', 'tcp', '3389'],
    ['Minecraft', 'tcp', '25565'],
    ['Plex', 'tcp', '32400'],
    ['Home Assistant', 'tcp', '8123'],
    ['Oyun konsolu (Xbox)', 'tcp udp', '3074'],
    ['Torrent', 'tcp udp', '51413'],
  ];
  function portsPage() {
    if (!state.xPf && !state.xPfError) loadX('xPf', () => NP.getPortForwards(), '/ports');
    let head = pageHead('Ağ', 'Port yönlendirme', 'İnternetten gelen bağlantıları ağınızdaki bir cihaza yönlendirin (oyun, kamera, sunucu).', '<button class="btn primary" type="button" data-pf-new>+ Kural ekle</button>');
    if (state.xPfError) return `${head}<div class="form-error">${esc(state.xPfError)}</div>`;
    let d = state.xPf;
    if (!d) return `${head}<div class="empty">Yükleniyor…</div>`;
    let rows = d.rules
      .map((r) => {
        let c = clientByIp(r.ip);
        return `<div class="pf-row${r.enabled ? '' : ' off'}"><div class="pf-name"><strong>${esc(r.name || '—')}</strong><small>${protoLabel(r.proto)}</small></div><div class="pf-map"><span class="port-tag big">${esc(r.extPort)}</span><span class="pf-arrow">→</span><span class="pf-target">${c ? `<span class="type-icon tiny">${typeIcon(c.type)}</span>${esc(c.displayName)}` : ''}<span class="num">${esc(r.ip)}:${esc(r.intPort)}</span></span></div><div class="pf-act"><input class="switch" type="checkbox" data-pf-toggle="${esc(r.id)}" aria-label="Kuralı aç/kapa"${r.enabled ? ' checked' : ''}><button class="icon-btn" type="button" data-pf-edit="${esc(r.id)}" title="Düzenle" aria-label="Düzenle">${icon('edit')}</button><button class="icon-btn danger" type="button" data-pf-del="${esc(r.id)}" title="Sil" aria-label="Sil">${icon('trash')}</button></div></div>`;
      })
      .join('');
    let u = d.upnp;
    let upnpBody = !u.installed
      ? pkgGate('upnp', 'UPnP', '~150 KB')
      : `<div class="toggle-line"><div><strong>UPnP</strong><p>Oyun konsolları ve programlar gereken portu kendisi açar (ör. Xbox “NAT türü: Açık”). Güvenlik için yalnız ihtiyacınız varsa açın.</p></div><input class="switch" type="checkbox" data-upnp${u.enabled ? ' checked' : ''}></div>
        ${u.enabled ? (u.leases.length ? `<h3 class="x-sub">Programların açtığı portlar</h3><div class="pf-list">${u.leases.map((l) => { let c = clientByIp(l.ip); return `<div class="pf-row"><div class="pf-name"><strong>${esc(l.desc || 'Program')}</strong><small>${esc(l.proto.toUpperCase())}</small></div><div class="pf-map"><span class="port-tag big">${esc(l.extPort)}</span><span class="pf-arrow">→</span><span class="pf-target">${c ? esc(c.displayName) + ' ' : ''}<span class="num">${esc(l.ip)}:${esc(l.intPort)}</span></span></div><div class="pf-act"></div></div>`; }).join('')}</div>` : '<p class="field-hint">Şu an UPnP ile açılmış port yok.</p>') : ''}`;
    return `${head}${wanWarning(d.wans, 'port yönlendirme')}<div class="grid"><section class="card span-12">${cardHead('shield', 'Kurallar')}${rows ? `<div class="pf-list">${rows}</div>` : '<div class="empty">Henüz kural yok. “Kural ekle” ile bir cihaza port açın.</div>'}</section><section class="card span-12">${cardHead('plug', 'UPnP (otomatik port açma)')}${upnpBody}</section>${fwCard(d)}</div>`;
  }
  function pfPanel(p) {
    let r = p.rule || { proto: 'tcp', extPort: '', intPort: '', ip: p.ip || '', name: '', enabled: true };
    let devs = state.clients.filter((c) => c.ip).sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
    let known = devs.some((c) => c.ip === r.ip);
    let body = `<form id="pf-form" class="x-form" data-id="${esc(r.id || '')}">
      ${r.id ? '' : `<div class="field-wrap"><label>Hazır şablon</label><div class="chip-row">${PF_PRESETS.map(([n, pr, port]) => `<button type="button" class="chip" data-pf-preset="${esc(n)}|${pr}|${port}">${esc(n)}</button>`).join('')}</div></div>`}
      <div class="field-wrap"><label>Ad</label><input class="field" name="name" maxlength="40" value="${esc(r.name)}" placeholder="ör. Kamera, Minecraft sunucusu"></div>
      <div class="field-wrap"><label>Cihaz</label><select class="field" name="dev"><option value="">IP adresini elle yaz…</option>${devs.map((c) => `<option value="${esc(c.ip)}"${c.ip === r.ip ? ' selected' : ''}>${esc(c.displayName)} — ${esc(c.ip)}${c.static ? '' : ' (sabit IP değil!)'}</option>`).join('')}</select></div>
      <div class="field-wrap" id="pf-ip-wrap"${known ? ' hidden' : ''}><label>Hedef IP</label><input class="field num" name="ip" value="${esc(r.ip)}" placeholder="192.168.1.50" inputmode="decimal"></div>
      <p class="field-hint" id="pf-static-hint"${devs.find((c) => c.ip === r.ip && !c.static) ? '' : ' hidden'}>Bu cihazın IP’si değişebilir; kuralın çalışmaya devam etmesi için cihaza <b>sabit IP</b> verin (Cihazlar > cihaz > Sabit IP).</p>
      <div class="field-wrap"><label>Protokol</label><div class="seg">${['tcp', 'udp', 'tcp udp'].map((x) => `<button type="button" class="seg-btn${r.proto === x ? ' active' : ''}" data-pf-proto="${x}">${protoLabel(x)}</button>`).join('')}</div><input type="hidden" name="proto" value="${esc(r.proto)}"></div>
      <div class="x-grid2"><div class="field-wrap"><label>Dış port (internet)</label><input class="field num" name="extPort" value="${esc(r.extPort)}" placeholder="8080 ya da 5000-5010" inputmode="numeric"></div><div class="field-wrap"><label>İç port (cihaz)</label><input class="field num" name="intPort" value="${esc(r.intPort === r.extPort ? '' : r.intPort)}" placeholder="boş = dış portla aynı" inputmode="numeric"></div></div>
      <div class="form-error" id="pf-error"></div>
      <div class="x-form-foot"><button type="button" class="btn" data-close-drawer>İptal</button><button class="btn primary" type="submit">${r.id ? 'Kaydet' : 'Kuralı ekle'}</button></div>
    </form>`;
    return { icon: 'shield', eyebrow: 'Port yönlendirme', title: r.id ? 'Kuralı düzenle' : 'Yeni kural', body };
  }

  function fwCard(d) {
    let devs = state.clients.filter((c) => c.ip).sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
    return `<section class="card span-12">${cardHead('shield', 'Güvenlik duvarı')}
      <div class="toggle-line"><div><strong>İnternetten gelen ping’e yanıt ver</strong><p>Kapalıyken router internetten “görünmez”; bazı operatör/oyun bağlantı testleri ping ister.</p></div><input class="switch" type="checkbox" data-fw-ping${d.fw.ping ? ' checked' : ''}></div>
      <form id="dmz-form" class="x-form"><div class="field-wrap"><label>DMZ (tüm gelen bağlantıları tek cihaza yönlendir)</label><div class="x-inline"><select class="field" name="dmz"><option value="">Kapalı</option>${devs.map((c) => `<option value="${esc(c.ip)}"${c.ip === d.fw.dmzIp ? ' selected' : ''}>${esc(c.displayName)} — ${esc(c.ip)}</option>`).join('')}${d.fw.dmzIp && !devs.some((c) => c.ip === d.fw.dmzIp) ? `<option value="${esc(d.fw.dmzIp)}" selected>${esc(d.fw.dmzIp)}</option>` : ''}</select><button class="btn small" type="submit">Kaydet</button></div></div>
      <p class="field-hint warn-text">DMZ’deki cihaz internete tamamen açık olur; yalnız oyun konsolu gibi gerçekten gerekiyorsa ve cihaza sabit IP vererek kullanın. Port kuralları DMZ’den önce uygulanır.</p></form></section>`;
  }
  // Cihazın anlık bağlantıları
  function connsPanel(p) {
    let c = state.clients.find((x) => x.mac === p.mac) || {};
    let r = p.data;
    let body = p.error
      ? `<div class="form-error">${esc(p.error)}</div>`
      : !r
        ? '<div class="empty">Yükleniyor…</div>'
        : !r.items.length
          ? '<div class="empty">Şu an açık bağlantı yok.</div>'
          : `<p class="field-hint">${r.total} açık bağlantı · en çok veri aktaranlar üstte. Adlar, hedefin ters DNS kaydıdır (her zaman olmayabilir).</p><div class="pf-list">${r.items
              .map((x) => `<div class="pf-row conn-row"><div class="pf-name"><strong class="num">${esc(x.name || x.dst)}</strong><small>${x.name ? esc(x.dst) + ' · ' : ''}${esc(x.service)}${x.count > 1 ? ` · ${x.count} bağlantı` : ''}</small></div><div class="vpn-meta num">${NP.fmt.bytes(x.bytes)}</div><div class="pf-act"></div></div>`)
              .join('')}</div>`;
    return { icon: 'chart', eyebrow: 'Anlık bağlantılar', title: c.displayName || p.mac, sub: c.ip || '', body: `${body}<div class="x-form-foot"><button class="btn small" type="button" data-conns="${esc(p.mac)}">Yenile</button></div>` };
  }
  async function loadConns(mac) {
    let c = state.clients.find((x) => x.mac === mac);
    openXPanel({ kind: 'conns', mac });
    try {
      let data = await NP.getConnections(c.ip);
      if (state.xPanel?.kind === 'conns' && state.xPanel.mac === mac) openXPanel({ kind: 'conns', mac, data });
    } catch (e) {
      if (state.xPanel?.kind === 'conns') openXPanel({ kind: 'conns', mac, error: e.message });
    }
  }

  /* ── Yerel ağ (LAN) + DHCP ── */
  const DNS_PRESETS = [
    ['router', 'Router (varsayılan)', []],
    ['cloudflare', 'Cloudflare', ['1.1.1.1', '1.0.0.1']],
    ['google', 'Google', ['8.8.8.8', '8.8.4.4']],
    ['quad9', 'Quad9 (zararlı site engeller)', ['9.9.9.9', '149.112.112.112']],
    ['adguard', 'AdGuard DNS (reklam engeller)', ['94.140.14.14', '94.140.15.15']],
    ['custom', 'Özel…', null],
  ];
  function lanPage() {
    if (!state.xLan && !state.xLanError) loadX('xLan', () => NP.getLan(), '/lan');
    let head = pageHead('Ağ', 'Yerel ağ', 'Router adresi, cihazlara otomatik IP dağıtımı (DHCP) ve DNS.');
    if (state.xLanError) return `${head}<div class="form-error">${esc(state.xLanError)}</div>`;
    let l = state.xLan;
    if (!l) return `${head}<div class="empty">Yükleniyor…</div>`;
    let pre = l.ip.replace(/\.\d+$/, '.');
    let dnsKey = DNS_PRESETS.find(([, , v]) => v && v.join(',') === l.dns.join(','))?.[0] || (l.dns.length ? 'custom' : 'router');
    if (state.lanDns) dnsKey = state.lanDns;
    let end = (+l.dhcp.start || 0) + (+l.dhcp.limit || 0) - 1;
    return `${head}<form id="lan-form" class="grid">
      <section class="card span-6">${cardHead('router', 'Router adresi')}
        <div class="field-wrap"><label>IP adresi</label><input class="field num" name="ip" value="${esc(l.ip)}" inputmode="decimal" ${l.prefix !== 24 ? 'disabled' : ''}></div>
        <p class="field-hint">Ağ maskesi 255.255.255.0 (/${l.prefix}). Adres değişirse paneli yeni adresten açmanız gerekir; ${l.staticHosts} sabit IP kaydı, port kuralları ve Huawei adresi yeni ağa otomatik taşınır.</p>
        <div class="alert subtle">Adres değiştikten sonra bilgisayarınızın Wi-Fi’sini/kablosunu kapatıp açın ki yeni adres alsın. <b>3 dakika</b> içinde yeni adresten girip onaylamazsanız eski ayara otomatik dönülür.</div>
      </section>
      <section class="card span-6">${cardHead('devices', 'DHCP (otomatik IP)')}
        <div class="toggle-line"><div><strong>DHCP sunucusu</strong><p>Kapatırsanız cihazlar IP alamaz (ağda başka DHCP sunucusu yoksa).</p></div><input class="switch" type="checkbox" name="dhcpEnabled"${l.dhcp.enabled ? ' checked' : ''}></div>
        <div class="x-grid2"><div class="field-wrap"><label>Başlangıç</label><div class="ip-suffix"><span class="num">${esc(pre)}</span><input class="field num" name="start" type="number" min="2" max="253" value="${esc(l.dhcp.start)}"></div></div><div class="field-wrap"><label>Cihaz sayısı</label><input class="field num" name="limit" type="number" min="1" max="253" value="${esc(l.dhcp.limit)}"></div></div>
        <p class="field-hint" id="lan-range">Dağıtılan adresler: <b class="num">${esc(pre + l.dhcp.start)} – ${esc(pre + end)}</b></p>
        <div class="field-wrap"><label>Kira süresi</label><select class="field" name="leasetime">${[['1h', '1 saat'], ['12h', '12 saat'], ['24h', '1 gün'], ['7d', '1 hafta']].concat([[l.dhcp.leasetime, l.dhcp.leasetime]]).filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i).map(([v, t]) => `<option value="${esc(v)}"${v === l.dhcp.leasetime ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      </section>
      <section class="card span-12">${cardHead('globe', 'Cihazlara verilen DNS')}
        <p class="field-hint">Cihazlar alan adlarını hangi sunucuya soracak. “Router” seçiliyse istekler routerdan geçer (AdGuard Home gibi bir engelleyici kuruluysa çalışmaya devam eder).</p>
        <div class="dns-options">${DNS_PRESETS.map(([k, t, v]) => `<label class="dns-opt${dnsKey === k ? ' on' : ''}"><input type="radio" name="dnsPreset" value="${k}"${dnsKey === k ? ' checked' : ''}><span><strong>${esc(t)}</strong>${v?.length ? `<small class="num">${esc(v.join(' · '))}</small>` : k === 'router' ? `<small class="num">${esc(l.ip)}</small>` : ''}</span></label>`).join('')}</div>
        <div class="field-wrap" id="dns-custom"${dnsKey === 'custom' ? '' : ' hidden'}><label>DNS sunucuları (virgülle, en fazla 3)</label><input class="field num" name="dnsCustom" value="${esc(dnsKey === 'custom' ? l.dns.join(', ') : '')}" placeholder="1.1.1.1, 9.9.9.9"></div>
        <div class="form-error" id="lan-error"></div>
        <div class="x-form-foot"><button class="btn primary" type="submit">Kaydet</button></div>
      </section></form>`;
  }
  // IP değişikliği sonrası: her sayfanın üstünde onay şeridi
  function lanPendingBanner() {
    let p = state.lanPending;
    if (!p || Date.now() > p.until) return '';
    let left = Math.max(0, Math.round((p.until - Date.now()) / 1000));
    return `<div class="alert lan-pending"><div><strong>Yeni router adresi: ${esc(p.newIp)}</strong><span>Her şey çalışıyorsa onaylayın. <b id="lan-left">${left}</b> sn içinde onaylanmazsa eski adrese (${esc(p.oldIp)}) dönülür.</span></div><button class="btn small primary" type="button" data-lan-confirm>Onayla</button><button class="btn small" type="button" data-lan-revert>Geri al</button></div>`;
  }

  /* ── VPN (WireGuard) ── */
  function vpnPage() {
    if (!state.xVpn && !state.xVpnError) loadX('xVpn', () => NP.getVpn(), '/vpn');
    let head = pageHead('Uzaktan erişim', 'VPN (WireGuard)', 'Dışarıdayken telefonunuzdan ya da bilgisayarınızdan ev ağınıza güvenle bağlanın.');
    if (state.xVpnError) return `${head}<div class="form-error">${esc(state.xVpnError)}</div>`;
    let v = state.xVpn;
    if (!v) return `${head}<div class="empty">Yükleniyor…</div>`;
    if (!v.installed) return `${head}<section class="card">${cardHead('vpn', 'WireGuard')}${pkgGate('wireguard', 'WireGuard VPN', '~1 MB')}</section>`;
    let warn = wanWarning(v.wans, 'VPN');
    let autoEp = v.wans.find((w) => w.kind === 'public')?.ip || '';
    if (!v.configured)
      return `${head}${warn}<section class="card">${cardHead('vpn', 'VPN sunucusunu kur')}<form id="vpn-setup" class="x-form">
        <div class="x-grid2"><div class="field-wrap"><label>Port (UDP)</label><input class="field num" name="port" type="number" min="1024" max="65535" value="51820"></div>
        <div class="field-wrap"><label>Dış adres</label><input class="field" name="endpoint" placeholder="${esc(autoEp || 'ev.ornek.com (DDNS) ya da IP')}"></div></div>
        <p class="field-hint">Telefonun dışarıdan bağlanacağı adres. Boş bırakırsanız ${autoEp ? `gerçek IP’niz (${esc(autoEp)}) kullanılır; IP’niz değişiyorsa bir DDNS alan adı yazın.` : 'hattın IP’si kullanılır.'} VPN ağı: 10.99.0.0/24.</p>
        <div class="form-error" id="vpn-error"></div><div class="x-form-foot"><button class="btn primary" type="submit">VPN sunucusunu kur</button></div></form></section>`;
    let peers = v.peers
      .map((p) => `<div class="pf-row"><div class="pf-name"><strong><i class="dot ${p.online ? '' : 'off'}"></i> ${esc(p.name || 'Cihaz')}</strong><small class="num">${esc(p.ip)}</small></div><div class="vpn-meta">${p.handshake ? `Son bağlantı: ${esc(new Date(p.handshake).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))} · ↓ ${NP.fmt.bytes(p.tx)} · ↑ ${NP.fmt.bytes(p.rx)}` : 'Henüz bağlanmadı'}</div><div class="pf-act"><button class="icon-btn danger" type="button" data-vpn-del="${esc(p.id)}" title="Cihazı sil" aria-label="Cihazı sil">${icon('trash')}</button></div></div>`)
      .join('');
    return `${head}${warn}<div class="grid">
      <section class="card span-5">${cardHead('vpn', 'Sunucu')}
        <div class="toggle-line"><div><strong>VPN ${v.enabled ? 'açık' : 'kapalı'}</strong><p>${v.up ? 'Arayüz çalışıyor' : v.enabled ? 'Başlatılıyor…' : 'Kimse bağlanamaz'}</p></div><input class="switch" type="checkbox" data-vpn-enable${v.enabled ? ' checked' : ''}></div>
        <div class="info-grid"><div><small>Port</small><strong class="num">UDP ${esc(v.port)}</strong></div><div><small>VPN ağı</small><strong class="num">${esc(v.subnet)}</strong></div></div>
        <form id="vpn-ep" class="x-inline"><input class="field" name="endpoint" value="${esc(v.endpoint)}" placeholder="${esc(autoEp || 'Dış adres (DDNS ya da IP)')}"><button class="btn small" type="submit">Kaydet</button></form>
        <p class="field-hint">Dış adres değişirse cihazların yeniden eklenmesi gerekir.</p>
      </section>
      <section class="card span-7">${cardHead('devices', 'Cihazlar', '<button class="btn small primary" type="button" data-vpn-add>+ Cihaz ekle</button>')}${peers ? `<div class="pf-list">${peers}</div>` : '<div class="empty">Henüz cihaz yok. “Cihaz ekle” ile telefonunuz için QR kod oluşturun.</div>'}</section>
    </div>`;
  }
  function peerPanel(p) {
    if (p.result) {
      let r = p.result;
      return {
        icon: 'vpn', eyebrow: 'VPN cihazı', title: p.name, sub: r.ip,
        body: `<div class="alert">Bu QR kod ve dosya <b>yalnız şimdi</b> gösterilir; içindeki gizli anahtar router’da saklanmaz. Kaybederseniz cihazı silip yeniden ekleyin.</div>
          <ol class="x-steps"><li>Telefona <b>WireGuard</b> uygulamasını kurun (App Store / Google Play).</li><li><b>+</b> → <b>QR kodu tara</b> ile aşağıdaki kodu okutun.</li><li>Tüneli açın; ev ağınıza bağlısınız.</li></ol>
          ${r.qr ? `<div class="qr-box">${r.qr}</div>` : '<p class="field-hint">QR kod için qrencode paketi yok; dosyayı indirip uygulamaya aktarın.</p>'}
          <div class="x-form-foot"><button class="btn small" type="button" data-copy-conf>Yapılandırmayı kopyala</button><button class="btn small primary" type="button" data-dl-conf>.conf dosyasını indir</button></div>
          <details class="upd-notes"><summary>Yapılandırma metni</summary><pre>${esc(r.config)}</pre></details>`,
      };
    }
    return {
      icon: 'vpn', eyebrow: 'VPN', title: 'Cihaz ekle',
      body: `<form id="peer-form" class="x-form"><div class="field-wrap"><label>Cihaz adı</label><input class="field" name="name" maxlength="32" placeholder="ör. Telefonum" required></div>
        <div class="field-wrap"><label>Trafik</label><label class="dns-opt on"><input type="radio" name="full" value="1" checked><span><strong>Tüm internet VPN’den</strong><small>Kafe Wi-Fi’ları gibi güvensiz ağlarda önerilir</small></span></label><label class="dns-opt"><input type="radio" name="full" value="0"><span><strong>Yalnız ev ağı</strong><small>İnternet telefondan doğrudan çıkar; daha hızlı</small></span></label></div>
        <div class="form-error" id="peer-error"></div><div class="x-form-foot"><button type="button" class="btn" data-close-drawer>İptal</button><button class="btn primary" type="submit">Oluştur</button></div></form>`,
    };
  }

  /* ── Wi-Fi QR ── */
  function qrPanel(p) {
    let body = p.svg
      ? `<p class="field-hint">Telefonun kamerasıyla okutun; şifre yazmadan <b>${esc(p.ssid)}</b> ağına katılır.</p><div class="qr-box">${p.svg}</div><div class="x-form-foot"><button class="btn small" type="button" data-qr-print>Yazdır</button><button class="btn small" type="button" data-qr-reset>Değiştir</button></div>`
      : `<form id="qr-form" class="x-form"><div class="field-wrap"><label>Ağ adı</label><input class="field" name="ssid" value="${esc(p.ssid)}" maxlength="32"></div>
        ${p.open ? '<p class="field-hint">Bu ağ şifresiz.</p>' : '<div class="field-wrap"><label>Wi-Fi şifresi</label><input class="field" name="password" type="password" minlength="8" maxlength="63" autocomplete="off" required></div><p class="field-hint">Huawei şifreyi geri vermediği için bir kez yazmanız gerekir; şifre kaydedilmez, yalnız QR’a dönüştürülür.</p>'}
        <div class="form-error" id="qr-error"></div><div class="x-form-foot"><button class="btn primary" type="submit">QR oluştur</button></div></form>`;
    return { icon: 'qr', eyebrow: 'Wi-Fi paylaş', title: p.ssid || 'Wi-Fi', sub: p.bandLabel || '', body };
  }

  /* ═══ AdGuard Home (reklam / site engelleme) ═════════════════════════════ */
  const agWeb = (a) => `http://${a?.lanIp || location.hostname}:${a?.webPort || 3000}/`;
  function loadAg(page) {
    if (!state.xAg && !state.xAgError) loadX('xAg', () => NP.getAdguard(), page);
    return state.xAg;
  }
  // Entegrasyon ayar penceresi içeriği
  function adguardSettings() {
    let a = loadAg('/integrations');
    if (state.xAgError) return `<div class="form-error">${esc(state.xAgError)}</div>`;
    if (!a) return '<div class="empty">Yükleniyor…</div>';
    if (!a.installed) return pkgGate('adguard', 'AdGuard Home', '~10 MB');
    if (!a.configured)
      return `<div class="ag-intro"><p>AdGuard Home tüm ağda reklamları, izleyicileri ve zararlı siteleri DNS düzeyinde engeller; cihaz başına YouTube, TikTok gibi uygulamaları kapatmanızı sağlar.</p>
        <ol class="x-steps"><li>AdGuard DNS’i devralır (port 53); dnsmasq DHCP ve yerel adlar için port 54’e geçer.</li><li>Üst DNS olarak şifreli Cloudflare + Quad9 (DoH) kullanılır.</li><li>Kurulumdan sonra DNS test edilir; sorun olursa otomatik eski düzene dönülür.</li></ol></div>
        <form id="ag-setup" class="x-form"><div class="field-wrap"><label>AdGuard yönetici şifresi (kullanıcı: admin)</label><input class="field" name="password" type="password" minlength="8" maxlength="64" autocomplete="new-password" required></div>
        <div class="field-wrap"><label>Şifre (tekrar)</label><input class="field" name="password2" type="password" minlength="8" maxlength="64" autocomplete="new-password" required></div>
        <p class="field-hint">Bu şifreyle AdGuard’ın kendi arayüzüne de girebilirsiniz: ${esc(agWeb(a))}</p>
        <div class="form-error" id="ag-error"></div><div class="x-form-foot"><button class="btn primary" type="submit">Kur ve etkinleştir</button></div></form>`;
    let needAuth = !a.creds || a.stats?.auth;
    let connect = `<form id="ag-connect" class="x-form"><div class="x-grid2"><div class="field-wrap"><label>Kullanıcı adı</label><input class="field" name="user" value="admin" autocomplete="username"></div><div class="field-wrap"><label>Şifre</label><input class="field" name="password" type="password" autocomplete="current-password" required></div></div><div class="form-error" id="ag-error"></div><div class="x-form-foot"><button class="btn ${needAuth ? 'primary' : ''}" type="submit">Bağlan</button></div></form>`;
    if (needAuth) return `<p>AdGuard Home bu router’da zaten kurulu. NetOS’un yönetebilmesi için AdGuard kullanıcı adı ve şifresini girin.</p>${connect}`;
    return `<div class="info-grid"><div><small>Durum</small><strong>${a.active ? 'Ağın DNS’i AdGuard’da' : 'Kapalı (DNS: dnsmasq)'}</strong></div><div><small>Sürüm</small><strong>${esc(a.stats?.version || '—')}</strong></div></div>
      ${a.active ? '' : '<div class="x-form-foot"><button class="btn primary" type="button" data-ag-enable>DNS’i AdGuard’a ver</button></div>'}
      <p><a href="${esc(agWeb(a))}" target="_blank" rel="noopener">AdGuard arayüzünü aç ↗</a> · <a href="#/adblock">NetOS’ta istatistikler →</a></p>
      <details class="upd-notes"><summary>Kayıtlı şifreyi güncelle</summary>${connect}</details>`;
  }
  // Yönetim > Reklam engelleme
  function adblockPage() {
    let head = pageHead('Güvenlik', 'Reklam engelleme', 'AdGuard Home ile tüm ağda reklam, izleyici ve istenmeyen uygulamaları engelleyin.', state.xAg ? `<a class="btn" href="${esc(agWeb(state.xAg))}" target="_blank" rel="noopener">AdGuard ↗</a>` : '');
    if (state.xInteg && !integOn('adguard')) return `${head}<section class="card"><div class="empty">AdGuard entegrasyonu kapalı. <a href="#/integrations">Entegrasyonlar</a>’dan etkinleştirin.</div></section>`;
    let a = loadAg('/adblock');
    if (state.xAgError) return `${head}<div class="form-error">${esc(state.xAgError)}</div>`;
    if (!a) return `${head}<div class="empty">Yükleniyor…</div>`;
    if (!a.configured || !a.creds || !a.active || a.stats?.auth)
      return `${head}<section class="card"><div class="empty">AdGuard henüz hazır değil. <a href="#/integrations">Entegrasyonlar > AdGuard Home > Ayarlar</a>’dan kurulumu tamamlayın.</div></section>`;
    let s = a.stats || {};
    if (s.error) return `${head}<div class="form-error">${esc(s.error)}</div>`;
    let pct = s.queries ? Math.round((s.blocked / s.queries) * 1000) / 10 : 0;
    let paused = !s.protection;
    let tiles = `<div class="x-tiles"><div class="x-tile"><small>DNS sorgusu (24 saat)</small><b>${s.queries.toLocaleString('tr-TR')}</b></div><div class="x-tile"><small>Engellenen</small><b>${s.blocked.toLocaleString('tr-TR')}</b><span>%${pct}</span></div><div class="x-tile"><small>Ortalama yanıt</small><b>${s.avgMs == null ? '—' : Math.round(s.avgMs) + ' ms'}</b></div></div>`;
    let top = s.topBlocked.length
      ? `<div class="x-ranks">${s.topBlocked.map((d) => `<div class="x-rank ag-rank"><span class="x-rank-name">${esc(d.name)}</span><i class="x-track"><em class="dl" style="width:${(d.count / s.topBlocked[0].count) * 100}%"></em></i><b>${d.count.toLocaleString('tr-TR')}</b></div>`).join('')}</div>`
      : '<p class="field-hint">Henüz engellenen alan adı yok.</p>';
    return `${head}<div class="grid">
      <section class="card span-12">${cardHead('block', 'Koruma')}
        <div class="toggle-line"><div><strong>${paused ? 'Koruma durduruldu' : 'Koruma açık'}</strong><p>${paused ? 'Reklamlar ve engellenen servisler şu an geçiyor.' : 'Reklamlar, izleyiciler ve seçili servisler engelleniyor.'}</p></div><input class="switch" type="checkbox" data-ag-protect${paused ? '' : ' checked'}></div>
        ${paused ? '' : '<div class="chip-row"><span class="field-hint">Geçici durdur:</span><button class="chip" type="button" data-ag-pause="10">10 dakika</button><button class="chip" type="button" data-ag-pause="60">1 saat</button></div>'}
        ${tiles}</section>
      <section class="card span-6">${cardHead('chart', 'En çok engellenenler')}${top}</section>
      <section class="card span-6" id="ag-global">${cardHead('devices', 'Tüm ağda engellenen uygulamalar')}${agServicesPicker('global', state.agGlobal)}</section>
    </div>`;
  }
  // Servis seçici (YouTube, TikTok…); scope: 'global' | mac
  function agServicesPicker(scope, selected) {
    if (!state.agServices) {
      if (!state.agServicesLoading) {
        state.agServicesLoading = true;
        Promise.all([NP.getAdguardServices(), scope === 'global' ? NP.getAdguardGlobal() : null])
          .then(([sv, g]) => {
            state.agServices = sv;
            if (g) state.agGlobal = g;
            scope === 'global' ? render() : redrawAgClient();
          })
          .catch((e) => toast(e.message))
          .finally(() => (state.agServicesLoading = false));
      }
      return '<div class="empty">Yükleniyor…</div>';
    }
    if (scope === 'global' && !state.agGlobal) {
      NP.getAdguardGlobal().then((g) => ((state.agGlobal = g), render())).catch((e) => toast(e.message));
      return '<div class="empty">Yükleniyor…</div>';
    }
    let sel = new Set(selected || []);
    let pop = NP.AG_POPULAR.map((id) => state.agServices.find((s) => s.id === id)).filter(Boolean);
    let extra = (selected || []).filter((id) => !NP.AG_POPULAR.includes(id)).map((id) => state.agServices.find((s) => s.id === id) || { id, name: id });
    let chips = [...pop, ...extra].map((s) => `<button type="button" class="chip svc${sel.has(s.id) ? ' active' : ''}" data-ag-svc="${esc(s.id)}" aria-pressed="${sel.has(s.id)}">${esc(s.name)}</button>`).join('');
    let more = state.agServices.filter((s) => !NP.AG_POPULAR.includes(s.id) && !sel.has(s.id));
    return `<div class="ag-svcs" data-ag-scope="${esc(scope)}"><div class="chip-row">${chips}</div>
      <details class="ag-more"><summary>Diğer ${more.length} servis</summary><div class="chip-row">${more.map((s) => `<button type="button" class="chip svc" data-ag-svc="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div></details>
      <div class="x-form-foot"><span class="field-hint">Seçilenler engellenir.</span><button class="btn small primary" type="button" data-ag-save="${esc(scope)}">Kaydet</button></div></div>`;
  }

  /* ── Cihaz paneli ekleri: geldi/gitti bildirimi + içerik filtresi ── */
  function injectDeviceExtras(c) {
    let body = document.querySelector('#drawer-host .drawer-body');
    if (!body) return;
    let sec = document.createElement('div');
    sec.className = 'drawer-section x-devx';
    sec.innerHTML = `<div class="toggle-line"><div><strong>${icon('bell')} Eve gelince / ayrılınca bildir</strong><p>Bu cihaz ağa bağlanınca ya da 10 dakika görünmeyince Telegram’dan mesaj gelir${state.xNotify && !state.xNotify.enabled ? ' (Telegram bildirimleri şu an kapalı: Sistem > Bildirimler)' : ''}.</p></div><input class="switch" type="checkbox" data-presence="${esc(c.mac)}"${c.presence ? ' checked' : ''}></div>`;
    if (c.online && c.ip) sec.insertAdjacentHTML('beforeend', `<button type="button" class="btn small" data-conns="${esc(c.mac)}">${icon('chart')}Anlık bağlantılar</button>`);
    body.appendChild(sec);
    if (integOn('adguard') && state.xAg?.active) {
      let f = document.createElement('div');
      f.className = 'drawer-section x-agc';
      f.id = 'agc-' + c.mac.replace(/:/g, '');
      body.appendChild(f);
      state.agClientMac = c.mac;
      if (!state.agClient?.[c.mac]) {
        f.innerHTML = '<div class="field-hint">İçerik filtresi yükleniyor…</div>';
        NP.getAdguardClient(c.mac, c.ip)
          .then((r) => {
            state.agClient = { ...state.agClient, [c.mac]: r };
            redrawAgClient();
          })
          .catch((e) => (f.innerHTML = `<div class="form-error">${esc(e.message)}</div>`));
      } else redrawAgClient();
    }
  }
  function redrawAgClient() {
    let mac = state.agClientMac,
      f = mac && document.getElementById('agc-' + mac.replace(/:/g, '')),
      r = state.agClient?.[mac],
      c = state.clients.find((x) => x.mac === mac);
    if (!f || !r || !c) return;
    let draft = (state.agDraft = state.agDraft?.mac === mac ? state.agDraft : { mac, ...r, services: [...(r.services || [])] });
    f.innerHTML = `<div class="x-sched-head"><strong>${icon('block')} İçerik filtresi (AdGuard)</strong>${r.custom ? '<span class="badge warn">Özel kural</span>' : ''}</div>
      ${c.static ? '' : '<p class="field-hint warn-text">AdGuard cihazı IP adresinden tanır; filtrenin kalıcı olması için bu cihaza sabit IP verin.</p>'}
      <div class="toggle-line"><div><strong>Reklam ve izleyici engelle</strong></div><input class="switch" type="checkbox" data-agc="filtering"${draft.filtering ? ' checked' : ''}></div>
      <div class="toggle-line"><div><strong>Yetişkin içerik engelle</strong></div><input class="switch" type="checkbox" data-agc="parental"${draft.parental ? ' checked' : ''}></div>
      <div class="toggle-line"><div><strong>Güvenli arama zorunlu</strong><p>Google, YouTube, Bing’de kısıtlı mod.</p></div><input class="switch" type="checkbox" data-agc="safesearch"${draft.safesearch ? ' checked' : ''}></div>
      <h3 class="x-sub">Engellenen uygulamalar</h3>${agServicesPicker(mac, draft.services)}`;
  }
  const svcScopeSel = (scope) => (scope === 'global' ? (state.agGlobal = state.agGlobal || []) : state.agDraft.services);

  /* ── Hız testi zamanlama kartı (Hız & Ping sayfası) ── */
  function speedSchedCard() {
    if (!state.xStSched && !state.xStSchedError) loadX('xStSched', () => NP.getSpeedSchedule(), '/speed');
    let s = state.xStSched;
    let body = !s
      ? '<div class="empty">Yükleniyor…</div>'
      : `<form id="st-sched" class="x-form"><div class="toggle-line"><div><strong>Her gün otomatik test</strong><p>Sonuçlar “Son testler” listesine eklenir; operatörünüze kanıt olur.</p></div><input class="switch" type="checkbox" name="enabled"${s.enabled ? ' checked' : ''}></div>
        <div class="x-grid2"><div class="field-wrap"><label>Saat</label><select class="field" name="hour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}"${+s.hour === h ? ' selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select></div>
        <div class="field-wrap"><label>Hat</label><select class="field" name="wan"><option value="">Varsayılan hat</option><option value="all"${s.wan === 'all' ? ' selected' : ''}>Tüm hatlar</option>${wanList().map((w) => `<option value="${esc(w.name)}"${s.wan === w.name ? ' selected' : ''}>${esc(w.label || w.name)}</option>`).join('')}</select></div></div>
        <p class="field-hint">Gece saatleri (ör. 04:00) önerilir; test sırasında internet kısa süre yavaşlar.</p>
        <div class="x-form-foot"><button class="btn small primary" type="submit">Kaydet</button></div></form>`;
    return `<section class="card span-12">${cardHead('clock', 'Zamanlanmış hız testi')}${body}</section>`;
  }

  /* ═══ Güvenlik, bakım, günlük, ilk kurulum ═══════════════════════════════ */
  const IDLE_KEY = 'np_idle_min';
  const idleMin = () => {
    try {
      let v = localStorage.getItem(IDLE_KEY);
      return v == null ? 30 : +v;
    } catch (_) {
      return 30;
    }
  };
  function loadSec(page) {
    if (!state.xSec && !state.xSecError) loadX('xSec', () => NP.getSecurity(), page);
    return state.xSec;
  }
  // Router şifresizse her sayfanın üstünde uyarı
  function pwBanner() {
    if (!state.xSec?.rootPwEmpty || state.page === '/welcome' || !onceBanner('np_pw_banner')) return '';
    return `<div class="alert alert-strong pw-banner"><div><strong>Router’ın şifresi yok!</strong><span>Aynı ağdaki herkes bu panele, LuCI’ye ve SSH’a şifresiz girebilir.</span></div><a class="btn small primary" href="#/welcome">Şimdi şifre belirle</a><button class="btn small" type="button" data-banner-close="np_pw_banner">Sonra</button></div>`;
  }
  /* Yerel sertifika otoritesi: tarayıcıların "güvenli değil" uyarısını kaldırır */
  function sslBlock() {
    if (!state.xSsl && !state.xSslError) loadX('xSsl', () => NP.getSsl(), '/system');
    let x = state.xSsl;
    if (state.xSslError) return `<p class="form-error">${esc(state.xSslError)}</p>`;
    if (!x) return '';
    let d = (t) => new Date(t).toLocaleDateString('tr-TR');
    if (!x.ca || !x.byNetos)
      return `<div class="ssl-box"><p>Tarayıcının “güvenli değil” uyarısını kaldırmak için NetOS kendi sertifika otoritesini oluşturup panele güvenilir bir sertifika kurabilir. Otorite yalnız yerel adreslere (192.168.x.x, .lan) sertifika verebilir.</p><button class="btn small primary" type="button" data-ssl-setup>Güvenilir sertifika oluştur</button></div>`;
    return `<div class="ssl-box"><div class="sec-ok">✓ NetOS sertifikası kurulu · ${esc(d(x.certExpires))} tarihine kadar geçerli, kendiliğinden yenilenir</div>
      <p class="field-hint">Uyarının kalkması için kök sertifikayı her cihaza <b>bir kez</b> yükleyin:</p>
      <ul class="ssl-steps"><li><b>Windows:</b> dosyayı açın → Sertifika yükle → Geçerli kullanıcı → “Tüm sertifikaları aşağıdaki depolama alanına yerleştir” → <i>Güvenilen Kök Sertifika Yetkilileri</i>.</li>
      <li><b>iPhone / iPad:</b> Safari ile indirin → Ayarlar &gt; İndirilen profil &gt; Yükle → sonra Genel &gt; Hakkında &gt; Sertifika Güven Ayarları’ndan açın.</li>
      <li><b>Android:</b> Ayarlar &gt; Güvenlik &gt; Diğer güvenlik ayarları &gt; Sertifika yükle &gt; CA sertifikası.</li>
      <li><b>Firefox:</b> kendi deposunu kullanır: Ayarlar &gt; Gizlilik ve Güvenlik &gt; Sertifikalar &gt; İçe aktar.</li></ul>
      <div class="x-inline"><a class="btn small primary" href="http://${esc(location.hostname)}${esc(x.caUrl)}" download="NetOS-kok-sertifika.crt">Kök sertifikayı indir</a><button class="btn small" type="button" data-ssl-setup>Sertifikayı yenile</button></div></div>`;
  }
  document.addEventListener('click', async (e) => {
    let b = e.target.closest('[data-ssl-setup]');
    if (!b) return;
    b.disabled = true;
    b.textContent = 'Oluşturuluyor…';
    try {
      state.xSsl = await NP.setupSsl();
      toast('Sertifika kuruldu. Web sunucusu yeniden başladı; sayfayı yenileyin.');
    } catch (x) {
      toast(x.message);
    }
    if (state.page === '/system') render();
  });
  function securityCard() {
    let s = loadSec('/system');
    let body;
    if (!s) body = '<div class="empty">Yükleniyor…</div>';
    else {
      let host = location.hostname;
      body = `${s.rootPwEmpty ? '<div class="alert alert-strong">Router şifresiz. Aşağıdaki “Panel şifresi” bölümünden hemen bir şifre belirleyin.</div>' : '<div class="sec-ok">✓ Router şifresi belirlenmiş</div>'}
        <h3 class="x-sub">HTTPS (şifreli bağlantı)</h3>
        ${!s.httpsAvailable ? pkgGate('https', 'HTTPS', '~60 KB') : `<div class="toggle-line"><div><strong>Paneli her zaman HTTPS ile aç</strong><p>http:// adresleri https://’e yönlenir. Sertifika routerın kendisine ait olduğu için tarayıcı ilk girişte “güvenli değil” uyarısı gösterir; “Gelişmiş > Devam et” ile geçebilirsiniz.</p></div><input class="switch" type="checkbox" data-https${s.httpsRedirect ? ' checked' : ''}></div>
          <p class="field-hint">Şifreli adres: <a href="https://${esc(host)}/netos/">https://${esc(host)}/netos/</a></p>
          ${sslBlock()}
          ${s.tunnelHttpHosts ? `<p class="field-hint warn-text">Cloudflare tünelindeki ${esc(s.tunnelHttpHosts)} panele http (80) üzerinden gidiyor; yönlendirme açılırsa döngüye girer. Tünel hedefini https://${esc(host)}:443 yapın.</p>` : ''}`}
        <h3 class="x-sub">Giriş koruması</h3>
        <p class="field-hint">15 dakika içinde 5 hatalı giriş denemesi yapan cihaz 5 dakika (tekrarında 15 ve 60 dakika) engellenir. NetOS, LuCI ve SSH girişleri birlikte sayılır; Telegram açıksa haber verilir.</p>
        ${lockoutList()}
        <div class="toggle-line"><div><strong>Sıkı mod</strong><p>Web’den doğrudan ubus girişini kapatır; giriş yalnız NetOS ve LuCI üzerinden (deneme sınırıyla) yapılır. Home Assistant gibi ubus ile bağlanan entegrasyonlar çalışmaz.</p></div><input class="switch" type="checkbox" data-strict${s.strictLogin ? ' checked' : ''}></div>
        <h3 class="x-sub">Otomatik oturum kapatma</h3>
        <div class="x-inline"><select class="field" id="idle-min">${[[0, 'Kapalı'], [15, '15 dakika'], [30, '30 dakika'], [60, '1 saat']].map(([v, t]) => `<option value="${v}"${idleMin() === v ? ' selected' : ''}>${t} işlem yapılmazsa</option>`).join('')}</select></div>
        <p class="field-hint">Bu tarayıcı için geçerlidir; ortak bilgisayarlarda açık bırakılan oturumları kapatır.</p>`;
    }
    return `<section class="card span-6" id="sec-card">${cardHead('lock', 'Güvenlik')}${body}</section>`;
  }
  function lockoutList() {
    if (!state.xLock && !state.xLockError) loadX('xLock', () => NP.getLockouts(), '/system');
    let l = state.xLock;
    if (!l) return '';
    if (!l.locked.length) return '<div class="sec-ok">✓ Şu an engelli cihaz yok</div>';
    return `<div class="pf-list">${l.locked
      .map((x) => {
        let c = state.clients.find((y) => y.ip === x.ip);
        return `<div class="pf-row"><div class="pf-name"><strong>${esc(c ? c.displayName : x.ip)}</strong><small class="num">${c ? esc(x.ip) + ' · ' : ''}${esc(x.source)}</small></div><div class="vpn-meta">${Math.max(1, Math.round((x.until - Date.now()) / 60000))} dk kaldı</div><div class="pf-act"><button class="btn small" type="button" data-unban="${esc(x.ip)}">Kilidi kaldır</button></div></div>`;
      })
      .join('')}</div>`;
  }
  function maintenanceCard() {
    if (!state.xOpt && !state.xOptError) loadX('xOpt', () => NP.getSysOpt(), '/system');
    let o = state.xOpt;
    let days = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    let body = !o
      ? '<div class="empty">Yükleniyor…</div>'
      : `<form id="sysopt-form" class="x-form">
        <div class="toggle-line"><div><strong>Sistem uyarıları</strong><p>Sıcaklık ${o.tempLimit}°C, depolama %90 ya da bellek %92’yi aşınca Telegram’dan haber verir ve günlüğe yazar.</p></div><input class="switch" type="checkbox" name="alerts"${o.alerts ? ' checked' : ''}></div>
        <div class="field-wrap"><label>Otomatik yeniden başlatma</label><select class="field" name="rebootMode"><option value="off"${o.rebootMode === 'off' ? ' selected' : ''}>Kapalı</option><option value="daily"${o.rebootMode === 'daily' ? ' selected' : ''}>Her gün</option><option value="weekly"${o.rebootMode === 'weekly' ? ' selected' : ''}>Her hafta</option></select></div>
        <div class="x-grid2" id="reboot-when"${o.rebootMode === 'off' ? ' hidden' : ''}><div class="field-wrap" id="reboot-day"${o.rebootMode === 'weekly' ? '' : ' hidden'}><label>Gün</label><select class="field" name="rebootDay">${days.slice(1).map((d, i) => `<option value="${i + 1}"${o.rebootDay === i + 1 ? ' selected' : ''}>${d}</option>`).join('')}</select></div>
        <div class="field-wrap"><label>Saat</label><select class="field" name="rebootHour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}"${+o.rebootHour === h ? ' selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select></div></div>
        <div class="x-form-foot"><a class="link-btn" href="#/logs">Sistem günlüğü →</a><button class="btn small primary" type="submit">Kaydet</button></div></form>`;
    return `<section class="card span-6">${cardHead('system', 'Bakım')}${body}</section>`;
  }

  /* ── Sistem günlüğü ── */
  function logsPage() {
    let f = (state.logF = state.logF || { level: '', q: '', lines: 200 });
    if (!state.xLog && !state.xLogError) loadX('xLog', () => NP.getLog(f), '/logs');
    let head = pageHead('Sistem', 'Sistem günlüğü', 'Router’ın kayıtları: bağlantılar, hatalar, uyarılar.', '<a class="btn" href="#/system">← Sistem</a>');
    let lv = (k, t) => `<button type="button" class="seg-btn${f.level === k ? ' active' : ''}" data-log-level="${k}">${t}</button>`;
    let tools = `<div class="log-tools"><div class="seg">${lv('', 'Tümü')}${lv('warn', 'Uyarılar')}${lv('err', 'Hatalar')}</div><form id="log-search" class="x-inline"><input class="field" name="q" type="search" value="${esc(f.q)}" placeholder="Ara (ör. dnsmasq, wan, hata)"><button class="btn small" type="submit">Ara</button></form>
      <label class="check-line"><input type="checkbox" id="log-auto"${state.logAuto ? ' checked' : ''}> Canlı</label><button class="btn small" type="button" data-log-dl>${icon('download')}İndir</button></div>`;
    let body;
    if (state.xLogError) body = `<div class="form-error">${esc(state.xLogError)}</div>`;
    else if (!state.xLog) body = '<div class="empty">Yükleniyor…</div>';
    else if (!state.xLog.length) body = '<div class="empty">Kayıt bulunamadı.</div>';
    else
      body = `<div class="log-list" id="log-list">${state.xLog
        .map((l) => `<div class="log-line lv-${esc(l.level)}"><span class="log-time num">${esc(l.time.slice(4, 19))}</span><span class="log-lv">${esc(l.level)}</span><span class="log-text">${esc(l.text)}</span></div>`)
        .join('')}</div><p class="field-hint">${state.xLog.length} satır · en yeni en altta. Günlük RAM’de tutulur, yeniden başlatınca silinir.</p>`;
    return `${head}<section class="card">${tools}${body}</section>`;
  }
  function reloadLog() {
    state.xLog = null;
    state.xLogError = '';
    render();
  }
  function scrollLogEnd() {
    let el = document.getElementById('log-list');
    if (el) el.scrollTop = el.scrollHeight;
  }

  /* ── İlk kurulum sihirbazı ── */
  function welcomePage() {
    let s = loadSec('/welcome');
    if (!s) return '<div class="empty">Yükleniyor…</div>';
    if (!state.xTz && !state.xTzError) loadX('xTz', () => NP.getTimezone(), '/welcome');
    let step = state.wizStep || (s.rootPwEmpty ? 1 : 2);
    let steps = ['Şifre', 'Saat dilimi', 'İnternet', 'Güncelleme', 'Hazır'];
    let bar = `<ol class="wiz-steps">${steps.map((t, i) => `<li class="${i + 1 < step ? 'done' : i + 1 === step ? 'on' : ''}"><i>${i + 1 < step ? '✓' : i + 1}</i>${t}</li>`).join('')}</ol>`;
    let body;
    if (step === 1)
      body = `<h2>Router şifresi</h2><p>${s.rootPwEmpty ? '<b>Router’ınızın şifresi yok.</b> Aynı ağdaki herkes bu panele girebilir. Güçlü bir şifre belirleyin; bu şifre LuCI ve SSH için de geçerli olur.' : 'Şifreniz belirlenmiş. İsterseniz değiştirebilirsiniz.'}</p>
        <form id="wiz-pw" class="x-form wiz-form">${s.rootPwEmpty ? '' : '<div class="field-wrap"><label>Mevcut şifre</label><input class="field" name="old" type="password" autocomplete="current-password"></div>'}
        <div class="field-wrap"><label>Yeni şifre</label><input class="field" name="pw" type="password" minlength="8" autocomplete="new-password" required></div>
        <div class="field-wrap"><label>Yeni şifre (tekrar)</label><input class="field" name="pw2" type="password" minlength="8" autocomplete="new-password" required></div>
        <div class="form-error" id="wiz-error"></div><div class="x-form-foot">${s.rootPwEmpty ? '' : '<button class="btn" type="button" data-wiz-next>Atla</button>'}<button class="btn primary" type="submit">Şifreyi kaydet</button></div></form>`;
    else if (step === 2) {
      let t = state.xTz;
      body = `<h2>Saat dilimi</h2><p>Saat planları, istatistikler ve zamanlanmış işler bu saate göre çalışır.</p>${
        !t
          ? '<div class="empty">Yükleniyor…</div>'
          : `<div class="x-inline"><select class="field" id="wiz-tz">${NP.TIMEZONES.map((z) => `<option value="${z.id}"${(t.isUtc ? 'Europe/Istanbul' : t.zone) === z.id ? ' selected' : ''}>${esc(z.label)}</option>`).join('')}</select></div>`
      }<div class="x-form-foot"><button class="btn" type="button" data-wiz-back>Geri</button><button class="btn primary" type="button" data-wiz-tz>Devam</button></div>`;
    } else if (step === 3) body = wizWanStep();
    else if (step === 4)
      body = `<h2>Güncellemeler</h2><p>NetOS yeni sürümleri GitHub’dan alabilir. Otomatik güncelleme açıksa her gece kendisi kurar; ayarlarınız korunur.</p>
        <div class="toggle-line"><div><strong>Otomatik güncelle</strong><p>Önerilir. Kapalıyken yalnız bildirim gelir.</p></div><input class="switch" type="checkbox" id="wiz-auto" checked></div>
        <div class="x-form-foot"><button class="btn" type="button" data-wiz-back>Geri</button><button class="btn primary" type="button" data-wiz-upd>Devam</button></div>`;
    else
      body = `<h2>Hazırsınız 🎉</h2><p>Temel ayarlar tamam. Sırada yapmak isteyebilecekleriniz:</p>
        <div class="wiz-links"><a class="more-item" href="#/internet"><span class="more-icon">${icon('globe')}</span><strong>İnternet hattını ayarla (PPPoE)</strong><span class="more-arrow">›</span></a>
        <a class="more-item" href="#/integrations"><span class="more-icon">${icon('plug')}</span><strong>Entegrasyonlar: Wi-Fi cihazı, reklam engelleme, VPN</strong><span class="more-arrow">›</span></a>
        <a class="more-item" href="#/system"><span class="more-icon">${icon('bell')}</span><strong>Telegram bildirimlerini kur</strong><span class="more-arrow">›</span></a></div>
        <div class="x-form-foot"><button class="btn primary" type="button" data-wiz-finish>Paneli aç</button></div>`;
    return `<div class="wiz"><div class="wiz-head">${brandMark}<div><div class="eyebrow">NetOS kurulumu</div><h1>Hoş geldiniz</h1></div></div>${bar}<section class="card wiz-card">${body}</section></div>`;
  }

  /* ── İkinci internet hattı (sihirbaz + İnternet sayfası) ── */
  function addWanFields(F) {
    if (!state.xPorts && !state.xPortsError && !state.xLoading?.xPorts) loadX('xPortsRaw', async () => setPorts(await NP.getPorts()), state.page);
    let free = (state.xPorts?.ports || []).filter((p) => p.role === 'free').sort((a, b) => b.link - a.link),
      wans = wanList(),
      f = F || {};
    if (!state.xPorts) return '<div class="empty">Portlar okunuyor…</div>';
    if (!free.length)
      return '<div class="alert">Boş ethernet portu yok. İkinci modemi bağlamak için router’da kullanılmayan bir port gerekir. Bir LAN portunu ayırmak için LuCI > Ağ > Arayüzler > Cihazlar bölümünden br-lan köprüsünden bir portu çıkarın.</div>';
    let proto = f.proto || 'dhcp';
    return `<div class="x-form wan-add">
      <div class="field-wrap"><label>İkinci modemin takılı olduğu port</label><select class="field" name="device">${free
        .map((p) => `<option value="${esc(p.name)}"${f.device === p.name ? ' selected' : ''}>${esc(p.name)} · ${p.link ? 'kablo takılı' + (p.speed ? ' · ' + portSpeed(p.speed) : '') : 'kablo yok'}</option>`)
        .join('')}</select></div>
      <div class="field-wrap"><label>Bağlantı tipi</label><select class="field" name="proto" data-wan-proto><option value="dhcp"${proto === 'dhcp' ? ' selected' : ''}>Modem router modunda (otomatik IP, önerilen)</option><option value="pppoe"${proto === 'pppoe' ? ' selected' : ''}>PPPoE (operatör kullanıcı adı ve şifresi)</option></select></div>
      ${proto === 'pppoe' ? `<div class="field-wrap"><label>PPPoE kullanıcı adı</label><input class="field" name="username" autocomplete="off" value="${esc(f.username || '')}"></div><div class="field-wrap"><label>PPPoE şifresi</label><input class="field" name="password" type="password" autocomplete="new-password"></div><div class="field-wrap"><label>VLAN (gerekmiyorsa boş)</label><input class="field num" name="vlan" type="number" min="0" max="4094" placeholder="ör. 35" value="${esc(f.vlan || '')}"></div>` : ''}
      <div class="field-wrap"><label>İki hat nasıl çalışsın?</label><div class="mode-options two">${[
        ['failover', 'Yedek hat', 'Ana hat koparsa internet otomatik ikinci hatta geçer.'],
        ['balanced', 'Birlikte kullan', 'Trafik iki hatta paylaştırılır; toplam hız artar.'],
      ]
        .map(([v, t, d]) => `<label class="mode-option${(f.mode || 'failover') === v ? ' active' : ''}"><input type="radio" name="mode" value="${v}"${(f.mode || 'failover') === v ? ' checked' : ''}><span><strong>${t}</strong><small>${d}</small></span></label>`)
        .join('')}</div></div>
      ${wans.length > 1 ? `<div class="field-wrap"><label>Ana hat</label><select class="field" name="primary">${wans.map((w) => `<option value="${esc(w.name)}">${esc(w.label || w.name)}</option>`).join('')}</select></div>` : ''}
    </div>`;
  }
  function addWanCard() {
    let c = state.wanConfig || {};
    return `<section class="card">${cardHead('globe', 'İkinci internet hattı')}<p class="subtitle">Tek hattınız var. İkinci bir modeminiz (ör. yedek fiber, ADSL ya da 4G/5G modem) varsa router’ın boş bir portuna takıp buradan ekleyebilirsiniz.</p>${
      !c.mwan3 ? pkgGate('mwan3', 'Çoklu internet hattı (mwan3)', '~100 KB') : `<form id="wan-add-form">${addWanFields(state.wanAddF)}<div class="form-error" id="wan-add-error"></div><button class="btn primary" type="submit">Hattı ekle</button></form>`
    }</section>`;
  }
  function wizWanStep() {
    let c = state.wanConfig;
    if (!c) {
      if (!state.xLoading?.wanCfg) loadX('wanCfgTmp', async () => (state.wanConfig = await NP.getWanConfig()), '/welcome');
      return '<div class="empty">Yükleniyor…</div>';
    }
    let wans = wanList(),
      n = state.wizWan || (wans.length >= 2 ? 2 : 1),
      opt = (v, t, d) => `<label class="mode-option${n === v ? ' active' : ''}"><input type="radio" name="wizwan" value="${v}"${n === v ? ' checked' : ''}><span><strong>${t}</strong><small>${d}</small></span></label>`;
    let extra = '';
    if (n === 1 && wans.length >= 2)
      extra = `<p>Şu an ${wans.length} hat tanımlı. Hangisi kullanılsın?</p><div class="field-wrap"><select class="field" id="wiz-primary">${wans.map((w) => `<option value="${esc(w.name)}"${c.primary === w.name ? ' selected' : ''}>${esc(w.label || w.name)}</option>`).join('')}</select></div>`;
    else if (n === 1) extra = `<p class="field-hint">Hattınız: <b>${esc(wans[0]?.label || wans[0]?.name || 'WAN')}</b>. İnternet ayarlarını (PPPoE vb.) daha sonra İnternet sayfasından değiştirebilirsiniz.</p>`;
    else if (wans.length >= 2) {
      let m = c.mode === 'single' || c.mode === 'custom' ? 'failover' : c.mode;
      extra = `<p>İki hattınız zaten tanımlı (${wans.map((w) => esc(w.label || w.name)).join(', ')}). Nasıl çalışsınlar?</p><div class="mode-options two">${[
        ['failover', 'Yedek hat', 'Ana hat koparsa internet otomatik diğer hatta geçer.'],
        ['balanced', 'Birlikte kullan', 'Trafik iki hatta paylaştırılır.'],
      ]
        .map(([v, t, d]) => `<label class="mode-option${m === v ? ' active' : ''}"><input type="radio" name="wizmode" value="${v}"${m === v ? ' checked' : ''}><span><strong>${t}</strong><small>${d}</small></span></label>`)
        .join('')}</div><div class="field-wrap"><label>Ana hat</label><select class="field" id="wiz-primary">${wans.map((w) => `<option value="${esc(w.name)}"${c.primary === w.name ? ' selected' : ''}>${esc(w.label || w.name)}</option>`).join('')}</select></div>`;
    } else extra = !c.mwan3 ? pkgGate('mwan3', 'İki internet hattı (mwan3)', '~100 KB') : `<form id="wiz-wan-form">${addWanFields(state.wanAddF)}</form>`;
    return `<h2>İnternet hatları</h2><p>Router’a kaç ayrı internet bağlantısı geliyor?</p><div class="mode-options two">${opt(1, 'Tek internet', 'Tüm trafik tek hattan gider. Çoğu ev için doğru seçim.')}${opt(2, 'İki internet', 'İkinci bir modem (yedek fiber, ADSL, 4G/5G) router’ın başka bir portuna bağlı.')}</div>${extra}<div class="form-error" id="wiz-error"></div><div class="x-form-foot"><button class="btn" type="button" data-wiz-back>Geri</button><button class="btn primary" type="button" data-wiz-wan>Devam</button></div>`;
  }
  const readAddWan = (form) => {
    let el = form.elements;
    return { device: el.device?.value, proto: el.proto?.value, username: el.username?.value.trim(), password: el.password?.value, vlan: el.vlan?.value, mode: form.querySelector('[name=mode]:checked')?.value || 'failover', primary: el.primary?.value };
  };
  root.addEventListener('change', (e) => {
    let t = e.target;
    if (t.matches('[name=wizwan]')) {
      state.wizWan = Number(t.value);
      return render();
    }
    if (t.matches('[data-wan-proto]')) {
      let f = t.closest('form');
      state.wanAddF = { ...readAddWan(f), password: '' };
      return render();
    }
    if (t.matches('.wan-add [name=mode], [name=wizmode]')) t.closest('.mode-options').querySelectorAll('.mode-option').forEach((l) => l.classList.toggle('active', l.contains(t)));
  });
  root.addEventListener('submit', async (e) => {
    let f = e.target;
    if (f.id !== 'wan-add-form') return;
    e.preventDefault();
    let btn = f.querySelector('[type=submit]'),
      done = xBusy(btn, 'Ekleniyor…'),
      er = document.getElementById('wan-add-error');
    try {
      let r = await NP.addWan(readAddWan(f));
      state.wanAddF = null;
      toast(`${r.name} eklendi; bağlantıyı kontrol edip onaylayın`);
      state.wanConfig = await NP.getWanConfig();
      state.xPorts = null;
      render();
    } catch (x) {
      if (er) er.textContent = x.message;
      done();
    }
  });
  function wanList() {
    return state.wanConfig?.wans || [];
  }
  function pendingBanner() {
    let until = state.wanConfig?.pendingUntil;
    if (!until) return state.revertNotice ? `<div class="wan-notice">${esc(state.revertNotice)}</div>` : '';
    let sec = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    return `<div class="wan-pending"><div><strong>İnternet ayarları uygulandı</strong><span>Bağlantınız çalışıyorsa onaylayın; <b data-countdown>${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}</b> içinde onaylanmazsa eski ayarlara dönülecek.</span></div><button class="btn primary small" data-confirm-wan>Çalışıyor, onayla</button><button class="btn small" data-revert-wan>Geri al</button></div>`;
  }
  function wanCards() {
    let wans = state.overview?.wans || (state.overview?.wan ? [state.overview.wan] : []),
      per = state.traffic.perWan || {};
    return (
      wans
        .map((w) => {
          let cfg = wanList().find((x) => x.name === w.name) || {};
          return `<article class="internet-wan" tabindex="0" data-open-wan="${esc(w.name)}"><div class="wan-item-head"><strong>${esc(w.label || w.name || 'WAN')}</strong><span class="badge">${esc(w.protoLabel || w.proto || '')}</span><span class="wan-status"><i class="dot ${w.online ? '' : 'off'}"></i>${w.online ? 'Çevrimiçi' : 'Çevrimdışı'}</span></div><div class="wan-meta"><div class="meta-item"><small>IP adresi</small><strong>${esc(w.ip || '—')}</strong></div><div class="meta-item"><small>Canlı hız</small><strong>↓ ${esc(NP.fmt.bits(per[w.name]?.down || 0))} · ↑ ${esc(NP.fmt.bits(per[w.name]?.up || 0))}</strong></div><div class="meta-item"><small>Bağlantı</small><strong>${esc(cfg.protoLabel || w.protoLabel || w.proto || '—')}</strong></div></div><div class="wan-card-actions"><button class="btn small" data-reconnect="${esc(w.name)}">Yeniden bağlan</button><span class="field-hint">Ayarları düzenlemek için karta dokunun</span></div></article>`;
        })
        .join('') || '<div class="empty">WAN bilgisi bulunamadı.</div>'
    );
  }
  function wanModeCard() {
    let c = state.wanConfig || {},
      w = wanList();
    if (c.mwan3 === false || w.length < 2) return addWanCard();
    let mode = c.mode === 'custom' ? 'balanced' : c.mode || 'balanced';
    return `<section class="card">${cardHead('globe', 'Çoklu WAN modu')}${c.mode === 'custom' ? '<div class="alert">Bu ayarlar LuCI\'de özelleştirilmiş; burada kaydetmek NetOS politikasına çevirir.</div>' : ''}<form id="wan-mode-form"><div class="mode-options">${[
      ['balanced', 'Yük dengeleme', 'İki hat birlikte çalışır; trafik hatların ağırlığına göre dağılır.'],
      ['failover', 'Yedek hat', 'Ana hat düşerse bağlantı diğer hatta geçer.'],
      ['single', 'Tek hat', 'Yalnızca seçtiğiniz hat kullanılır.'],
    ]
      .map(
        ([v, t, d]) =>
          `<label class="mode-option ${mode === v ? 'active' : ''}"><input type="radio" name="mode" value="${v}" ${mode === v ? 'checked' : ''}><span><strong>${t}</strong><small>${d}</small></span></label>`,
      )
      .join(
        '',
      )}</div><div class="wan-mode-fields"><div class="field-wrap"><label for="wan-primary">Ana hat</label><select class="field" id="wan-primary" name="primary">${w.map((x) => `<option value="${esc(x.name)}" ${(c.primary || w[0]?.name) === x.name ? 'selected' : ''}>${esc(x.label || x.name)}</option>`).join('')}</select></div><div class="weights">${w.map((x) => `<div class="field-wrap"><label>${esc(x.label || x.name)} ağırlığı</label><input class="field num" type="number" min="1" max="10" name="weight-${esc(x.name)}" value="${Math.min(10, Math.max(1, x.mwan?.weight || 1))}"></div>`).join('')}</div></div><p class="field-hint" id="weight-hint"></p><div class="form-error" id="wan-mode-error"></div><button class="btn primary" type="submit">Uygula</button></form></section>`;
  }
  /* ── Kesinti raporu: mwan3'ün disconnected → connected olaylarından (son 30 gün) ── */
  const fmtDur = (s) => (s < 60 ? `${Math.round(s)} sn` : s < 3600 ? `${Math.round(s / 60)} dk` : `${Math.floor(s / 3600)} sa ${Math.round((s % 3600) / 60)} dk`);
  function outages(days = 30) {
    let from = Date.now() - days * 864e5,
      by = {};
    let ev = [...(state.wanEvents || [])].filter((e) => e.iface !== '*' && /^(dis)?connected$/.test(e.event)).sort((a, b) => a.t - b.t);
    for (let e of ev) {
      let o = (by[e.iface] ||= { list: [], down: null });
      if (e.event === 'disconnected') o.down ??= e.t;
      else if (o.down != null) {
        if (e.t >= from) o.list.push({ start: o.down, end: e.t, sec: (e.t - Math.max(o.down, from)) / 1000 });
        o.down = null;
      }
    }
    for (let o of Object.values(by)) if (o.down != null) o.list.push({ start: o.down, end: null, sec: (Date.now() - Math.max(o.down, from)) / 1000 });
    return wanList().map((w) => {
      let l = by[w.name]?.list || [],
        total = l.reduce((a, x) => a + x.sec, 0);
      return { name: w.name, label: w.label || w.name, count: l.length, total, longest: l.reduce((a, x) => Math.max(a, x.sec), 0), last: l[l.length - 1] || null, uptime: 100 - (total / (days * 864)) };
    });
  }
  function outageText() {
    let d = (t) => new Date(t).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
    return outages()
      .map((o) => {
        let ev = [...(state.wanEvents || [])].filter((e) => e.iface === o.name && e.event === 'disconnected' && e.t >= Date.now() - 30 * 864e5).sort((a, b) => a.t - b.t);
        return `${o.label}: son 30 günde ${o.count} kesinti, toplam ${fmtDur(o.total)}, en uzun ${fmtDur(o.longest)} (erişilebilirlik %${o.uptime.toFixed(2)})${ev.length ? '\nKesinti başlangıçları: ' + ev.map((e) => d(e.t)).join(', ') : ''}`;
      })
      .join('\n\n');
  }
  function outageCard() {
    let rows = outages();
    if (!rows.length) return '';
    return `<section class="card outage-card">${cardHead('chart', 'Kesinti raporu · son 30 gün', '<button class="btn small" type="button" data-copy-outages>Raporu kopyala</button>')}<div class="outage-grid">${rows
      .map(
        (o) =>
          `<div class="outage-line ${o.last && !o.last.end ? 'down' : o.count ? 'warn' : 'ok'}"><strong>${esc(o.label)}</strong><div class="outage-nums"><span><b class="num">${o.count}</b> kesinti</span><span><b class="num">${o.count ? fmtDur(o.total) : '0'}</b> toplam</span><span><b class="num">${o.count ? fmtDur(o.longest) : '—'}</b> en uzun</span><span><b class="num">%${o.uptime.toFixed(2)}</b> erişilebilir</span></div><small>${o.last ? (o.last.end ? `Son kesinti: ${new Date(o.last.start).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })} · ${fmtDur(o.last.sec)}` : '<b>Şu an kesinti var</b>') : 'Kesinti kaydı yok'}</small></div>`,
      )
      .join('')}</div><p class="field-hint">Operatöre şikâyette kanıt olarak kullanabilirsiniz. Hat yoklaması (mwan3) internete ping atamadığında kesinti sayılır.</p></section>`;
  }
  function internetPage() {
    let events = state.wanEvents.filter((x) => state.wanFilter === 'all' || x.iface === state.wanFilter),
      fmtAgo = (t) => {
        let n = Math.max(0, Math.floor((Date.now() - t) / 1000));
        return n < 60
          ? `${n} sn önce`
          : n < 3600
            ? `${Math.floor(n / 60)} dk önce`
            : n < 86400
              ? `${Math.floor(n / 3600)} sa önce`
              : `${Math.floor(n / 86400)} gün önce`;
      };
    return `${pageHead('Bağlantı ayarları', 'İnternet', 'Hatlarınızı, yedek bağlantıyı ve bağlantı geçmişini yönetin.')}<div id="pending-slot">${pendingBanner()}</div><div class="internet-layout"><section class="card">${cardHead('globe', 'İnternet hatları')}<div class="internet-wans">${wanCards()}</div></section>${wanModeCard()}<section class="card">${cardHead(
      'system',
      'Bağlantı geçmişi',
      `<select class="field event-filter" id="wan-event-filter"><option value="all">Tümü</option>${wanList()
        .map(
          (w) =>
            `<option value="${esc(w.name)}" ${state.wanFilter === w.name ? 'selected' : ''}>${esc(w.label || w.name)}</option>`,
        )
        .join('')}</select>`,
    )}<div class="event-list">${
      events
        .slice(0, state.wanShown)
        .map(
          (x) =>
            `<div class="event-row"><i class="event-dot ${esc(x.level)}"></i><div><strong>${esc(x.iface === '*' ? 'Sistem' : wanList().find((w) => w.name === x.iface)?.label || x.iface)}</strong><span>${esc(x.label)}</span></div><time title="${esc(new Date(x.t).toLocaleString('tr-TR'))}">${fmtAgo(x.t)}</time></div>`,
        )
        .join('') || '<div class="empty">Henüz bağlantı olayı yok.</div>'
    }</div>${events.length > state.wanShown ? '<button class="btn small" data-more-events>Daha fazla göster</button>' : ''}</section>${outageCard()}</div>`;
  }
  const speedWans = () =>
    state.sqm?.wans?.length
      ? state.sqm.wans
      : (state.overview?.wans || []).map((w) => ({ name: w.name, device: w.device || w.l3Device || w.name }));
  function multiSpeedResult(cur) {
    let runs = cur.runs || [],
      totalDown = runs.reduce((n, r) => n + (Number(r.down) || 0), 0),
      totalUp = runs.reduce((n, r) => n + (Number(r.up) || 0), 0),
      grades = ['A+', 'A', 'B', 'C', 'D', 'F'],
      worst = runs.map((r) => r.grade).filter(Boolean).sort((a, b) => grades.indexOf(b) - grades.indexOf(a))[0] || '',
      totalGrade = cur.grade || worst,
      good = (grade) => grade === 'A' || grade === 'A+',
      summaryLabel = cur.mode === 'combined' ? 'Genel bufferbloat' : 'Genel not';
    let summary = `<div class="multi-summary"><strong>Toplam &darr; ${totalDown.toFixed(1)} / &uarr; ${totalUp.toFixed(1)} Mbit/s${cur.mode === 'sequential' ? ' (hatlar&#305;n toplam&#305;)' : ''}</strong>${totalGrade ? `<span>${summaryLabel} <b class="grade ${good(totalGrade) ? 'ok' : 'warn'}">${esc(totalGrade)}</b></span>` : ''}</div>`;
    let cards = runs.map((r) => {
      let share = totalDown ? (Number(r.down) || 0) / totalDown * 100 : 0,
        grade = cur.mode === 'sequential' && r.grade
          ? `<span class="grade ${good(r.grade) ? 'ok' : 'warn'}">${esc(r.grade)}</span>`
          : '',
        detail = cur.mode === 'combined'
          ? `<div class="mini-track"><i style="width:${share}%"></i></div><small class="run-ping">${share.toFixed(0)}%</small>`
          : `<small class="run-ping">Ping ${esc(r.idleMs ?? '\u2014')} / ${esc(r.downMs ?? '\u2014')} / ${esc(r.upMs ?? '\u2014')} ms</small>`;
      return `<article class="multi-run"><div class="multi-run-head"><strong>${esc(r.wan || r.name || 'WAN')}</strong>${grade}</div><div class="multi-speed-values">&darr; ${esc(r.down ?? '\u2014')} / &uarr; ${esc(r.up ?? '\u2014')} <small>Mbit/s</small></div>${detail}${r.error ? `<small class="run-error">${esc(r.error)}</small>` : ''}</article>`;
    }).join('');
    return `<div class="speed-result multi-result">${summary}<div class="multi-runs">${cards}</div></div>`;
  }
  // legacySpeedPage ve speedPage aynı metni kullanmalı (speedPage bu metni string replace ile bulur)
  function speedPhaseText(cur) {
    return (
      {
        starting: 'Test başlatılıyor',
        idle: 'Boşta gecikme ölçülüyor',
        download: 'İndirme',
        upload: 'Yükleme',
        done: 'Test tamamlandı',
        error: 'Test başarısız',
      }[cur?.phase] || 'Hazır'
    );
  }
  function legacySpeedPage() {
    let wans = speedWans(),
      cur = state.speed?.current || state.speed;
    let phase = speedPhaseText(cur);
    let grade = cur?.grade || '',
      cls = /^(A\+|A)$/.test(grade) ? 'ok' : grade === 'B' ? 'warn' : grade === 'C' ? 'warn' : 'err';
    let bars = [
        ['Boşta', cur?.idleMs],
        ['İndirirken', cur?.downMs],
        ['Yüklerken', cur?.upMs],
      ],
      max = Math.max(1, ...bars.map((x) => Number(x[1]) || 0));
    let recommendation =
      cur &&
      !cur.running &&
      ['B', 'C', 'D', 'F'].includes(grade) &&
      cur.recommendDownMbit != null &&
      !(state.sqm?.queues || []).some(
        (q) =>
          q.enabled &&
          q.downloadMbit > 0 &&
          q.downloadMbit <= cur.recommendDownMbit + 1 &&
          q.uploadMbit <= cur.recommendUpMbit + 0.5,
      )
        ? `<div class="alert speed-recommend"><span>Ping&#39;i düşürmek için SQM&#39;i ↓ ${esc(cur.recommendDownMbit)} / ↑ ${esc(cur.recommendUpMbit)} Mbit/s yapın</span><button class="btn small" data-apply-recommend>Önerilen değerleri uygula</button></div>`
        : '';
    return `${pageHead('Ağ performansı', 'Hız &amp; Ping', 'Hızınızı ve yük altındaki gecikmeyi ölçün.')}<section class="card speed-hero">${cardHead('speed', 'Hız testi')}<div class="speed-controls"><select class="field" id="speed-wan">${wans.map((w, i) => `<option value="${esc(w.name)}" ${i === 0 ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select><button class="btn primary" data-start-speed ${cur?.running ? 'disabled' : ''}>${cur?.running ? 'Test sürüyor…' : 'Testi başlat'}</button></div><div class="speed-live"><div><div class="eyebrow">${phase}</div><strong>${cur?.phase === 'upload' ? esc(cur.up || 0) : esc(cur?.down || 0)}<small> Mbit/s</small></strong><div class="speed-arrows">↓ ${esc(cur?.down || 0)} <span>·</span> ↑ ${esc(cur?.up || 0)}</div></div><div class="speed-meter"><svg viewBox="0 0 180 100" aria-hidden="true"><path d="M15 90 A75 75 0 0 1 165 90"/><path class="meter-value" d="M15 90 A75 75 0 0 1 165 90" style="stroke-dasharray:${Math.max(0, Math.min(100, Number(cur?.progress) || 0))} 100"/></svg><b>${Math.round(cur?.progress || 0)}%</b></div></div><div class="progress speed-progress"><i style="width:${Math.max(0, Math.min(100, cur?.progress || 0))}%"></i></div>${cur?.error ? `<div class="form-error">${esc(cur.error)}</div>` : ''}${cur && !cur.running && cur.phase === 'done' ? `<div class="speed-result"><div class="result-metrics"><div>↓ <b>${esc(cur.down)}</b><small>Mbit/s indirme</small></div><div>↑ <b>${esc(cur.up)}</b><small>Mbit/s yükleme</small></div><div><b>${esc(cur.idleMs)} ms</b><small>Ping (boşta) · jitter ${esc(cur.jitterMs ?? '—')} ms</small></div></div><div class="grade-panel"><span class="grade ${cls}">${esc(grade)}</span><strong>${esc(cur.gradeText || '')}</strong></div><div class="latency-bars">${bars.map(([label, val]) => `<div><span>${label}<b>${esc(val ?? '—')} ms</b></span><i><em style="width:${Math.min(100, ((Number(val) || 0) / max) * 100)}%"></em></i></div>`).join('')}</div><div class="field-hint">Yük altındaki artış: +${esc(cur.increaseMs ?? '—')} ms</div>${recommendation}<button class="btn" data-start-speed>Tekrar test et</button></div>` : ''}</section><section class="card">${cardHead('system', 'Son testler')}<div class="event-list">${(state.speedHistory || []).map((h) => `<div class="event-row"><i class="grade-dot ${esc(h.grade || '')}"></i><div><strong>${esc(h.wan || 'WAN')} · ↓ ${esc(h.down)} / ↑ ${esc(h.up)} Mbit/s</strong><span>Ping ${esc(h.idleMs ?? '—')} ms <span class="badge ${/^(A\+|A)$/.test(h.grade) ? 'ok' : 'warn'}">${esc(h.grade || '—')}</span></span></div><time>${h.t ? esc(new Date(h.t).toLocaleString('tr-TR')) : ''}</time></div>`).join('') || '<div class="empty">Henüz hız testi yok.</div>'}</div></section><section class="card">${cardHead('router', 'Ping düşürme — SQM')}<p class="field-hint">SQM, hat dolduğunda ping&#39;in yükselmesini (bufferbloat) önler. Sınırları ölçülen hızın ~%90&#39;ına ayarlayın.</p>${sqmCard()}</section><section class="card">${cardHead('devices', 'Oyun önceliği')}${gamingWarnings()}${priorityRows()}<p class="field-hint">Öncelik cihazın gönderdiği (yükleme) trafiğine uygulanır; indirmede SQM her cihaza adil pay verir.</p></section>`;
  }
  function speedPage() {
    let html = legacySpeedPage(),
      wans = speedWans(),
      cur = state.speed?.current || state.speed || {},
      mode = cur.mode || 'single',
      phase = speedPhaseText(cur);
    (state.speedHistory || []).forEach((h) => {
      let at = html.indexOf(`<div class="event-row"><i class="grade-dot ${esc(h.grade || '')}"></i><div><strong>${esc(h.wan || 'WAN')}`);
      if (at < 0) return;
      html = html.slice(0, at) + html.slice(at).replace('<div class="event-row">', '<div class="event-row speed-history-row">');
      let end = html.indexOf('</strong>', at) + 9,
        label = h.mode === 'sequential' ? 'S&#305;rayla' : h.mode === 'combined' ? 'Birlikte' : 'Tek hat';
      html = html.slice(0, end) + ` <small class="badge">${label}</small>` + html.slice(end);
    });
    if (wans.length > 1) {
      html = html.replace('</select>', '<option value="all">T&#252;m hatlar &#8212; s&#305;rayla (kar&#351;&#305;la&#351;t&#305;r)</option><option value="all-combined">T&#252;m hatlar &#8212; birlikte (toplam kapasite)</option></select>');
    }
    html = html.replace('</div><div class="speed-live">', '</div><p class="field-hint speed-mode-hint" id="speed-mode-hint"></p><div class="speed-live">');
    let direction = cur.direction || (cur.phase === 'download' ? 'download' : cur.phase === 'upload' ? 'upload' : null),
      liveValue = cur.liveMbit ?? (direction === 'upload' ? cur.up : cur.down) ?? 0,
      liveLabel = direction === 'download' ? '\u2193 \u0130ndirme testi' : direction === 'upload' ? '\u2191 Y\u00fckleme testi' :
        cur.phaseLabel || phase,
      liveClass = direction === 'upload' ? 'up' : direction === 'download' ? 'down' : 'idle';
    html = html.replace(`<div class="eyebrow">${phase}</div>`,
      `<div class="speed-direction ${liveClass}">${esc(liveLabel)}${!direction && cur.running ? '<i class="dot"></i>' : ''}</div>`);
    let oldLive = esc(cur?.phase === 'upload' ? cur.up || 0 : cur?.down || 0);
    html = html.replace(`<strong>${oldLive}<small> Mbit/s</small></strong>`,
      `<strong>${esc(liveValue)}<small> Mbit/s</small></strong>`);
    if (cur.running && mode === 'sequential' && cur.wan) {
      let position = `${cur.step || (cur.runs || []).length + 1}/${cur.totalWans || wans.length}`;
      html = html.replace('<div class="speed-live">',
        `<div class="speed-wan-step">Hat ${position} &#8212; ${esc(cur.wan)}</div><div class="speed-live">`);
    } else if (cur.running && mode === 'combined') {
      html = html.replace('<div class="speed-live">',
        '<div class="speed-wan-step">T\u00fcm hatlar ayn\u0131 anda</div><div class="speed-live">');
    } else if (cur.running && cur.wan) {
      html = html.replace('<div class="speed-live">',
        `<div class="speed-wan-step">${esc(cur.wan)}</div><div class="speed-live">`);
    }
    html = html.replace('</div><div class="speed-meter">',
      '<div class="speed-steps"><span class="' + (direction === 'download' ? 'active' : direction === 'upload' || cur.phase === 'done' ? 'done' : '') + '">&#8595; &#304;ndirme</span><span class="' + (direction === 'upload' ? 'active' : cur.phase === 'done' ? 'done' : '') + '">&#8593; Y&#252;kleme</span></div></div><div class="speed-meter">');
    html = html.replace('<div class="speed-controls">', '<div class="speed-controls">');
    if (!cur.running && mode !== 'single' && cur.runs?.length) {
      let result = multiSpeedResult(cur);
      html = html.replace('<section class="card speed-hero">', '<section class="card speed-hero multi-active">');
      html = html.replace(/<div class="alert speed-recommend">.*?<\/div>/, '');
      html = html.replace('</section><section class="card">', `${result}</section><section class="card">`);
    }
    // Test sunucusu seçici (mevcut .field stili; seçim state.speedServer'da korunur)
    let servers = NP.SPEED_SERVERS || [],
      srvSel = state.speedServer || cur?.server || (servers[0] && servers[0].id) || '',
      srvGroup = (label, list) =>
        list.length
          ? `<optgroup label="${label}">${list
              .map((s) => `<option value="${esc(s.id)}"${s.id === srvSel ? ' selected' : ''}>${esc(s.label)}</option>`)
              .join('')}</optgroup>`
          : '';
    if (servers.length) {
      let srvHtml =
        `<select class="field" id="speed-server" aria-label="Test sunucusu">` +
        srvGroup('Türkiye', servers.filter((s) => s.country === 'TR')) +
        srvGroup('Avrupa', servers.filter((s) => s.country !== 'TR')) +
        '</select>';
      html = html.replace('<button class="btn primary" data-start-speed', srvHtml + '<button class="btn primary" data-start-speed');
    }
    if (cur?.serverLabel) {
      html = html.replace(
        '<div class="speed-live">',
        `<div class="field-hint">Sunucu: ${esc(cur.serverLabel)}</div><div class="speed-live">`,
      );
    }
    // Hat seçimini koru: sayfa her saniye yeniden çizildiğinde seçici ilk seçeneğe (Turknet) dönmesin
    let sel =
      state.speedSel ||
      (cur?.mode === 'combined' ? 'all-combined' : cur?.mode === 'sequential' ? 'all' : cur?.wan || '');
    if (sel) {
      html = html.replace(/<select class="field" id="speed-wan">[\s\S]*?<\/select>/, (m) =>
        m.includes(`value="${sel}"`)
          ? m.replace(/ selected/g, '').replace(`value="${sel}"`, `value="${sel}" selected`)
          : m,
      );
      html = html.replace(
        '<p class="field-hint speed-mode-hint" id="speed-mode-hint"></p>',
        `<p class="field-hint speed-mode-hint" id="speed-mode-hint">${speedModeHint(sel)}</p>`,
      );
    }
    return html;
  }
  function speedModeHint(v) {
    return v === 'all'
      ? 'Her hat ayrı ölçülür, ping ve not hat başına'
      : v === 'all-combined'
        ? "Hatlar aynı anda yüklenir; çoklu WAN'ın toplam hızını gösterir"
        : '';
  }
  function sqmCard() {
    let q = state.sqm;
    if (!q) return '<div class="empty">SQM bilgisi yükleniyor…</div>';
    if (!q.installed) return '<div class="alert">sqm-scripts kurulu değil.</div>';
    return `<div class="sqm-list">${q.queues
      .map(
        (x) =>
          `<div class="sqm-row"><div class="sqm-head"><strong>${esc(x.wan || x.interface)}</strong><span class="badge ${x.active ? 'ok' : ''}">${x.active ? 'Çalışıyor' : x.enabled ? 'Açık' : 'Kapalı'}</span><label class="toggle-line">Etkin <input class="switch" type="checkbox" data-sqm-enabled="${esc(x.section)}" ${x.enabled ? 'checked' : ''}></label></div><div class="info-grid"><label class="field-wrap">İndirme Mbit/s<input class="field" type="number" data-sqm-down="${esc(x.section)}" value="${esc(x.downloadMbit)}"></label><label class="field-wrap">Yükleme Mbit/s<input class="field" type="number" data-sqm-up="${esc(x.section)}" value="${esc(x.uploadMbit)}"></label></div><label class="field-wrap">Mod<select class="field" data-sqm-script="${esc(x.section)}"><option value="piece_of_cake.qos" ${x.script === 'piece_of_cake.qos' ? 'selected' : ''}>Standart</option><option value="layer_cake.qos" ${x.script === 'layer_cake.qos' ? 'selected' : ''}>Oyun öncelikli</option><option value="${esc(x.script)}" ${!['piece_of_cake.qos', 'layer_cake.qos'].includes(x.script) ? 'selected' : ''}>${!['piece_of_cake.qos', 'layer_cake.qos'].includes(x.script) ? 'Gelişmiş: ' + esc(x.script) : ''}</option></select></label><details><summary>Bağlantı tipi ve gelişmiş</summary><label class="field-wrap">Hazır profil<select class="field" data-sqm-preset="${esc(x.section)}"><option value="">Profil seçin</option>${Object.entries(
            NP.SQM_PRESETS,
          )
            .map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`)
            .join(
              '',
            )}</select></label><div class="info-grid"><label class="field-wrap">Link layer<select class="field" data-sqm-link="${esc(x.section)}"><option ${x.linklayer === 'none' ? 'selected' : ''}>none</option><option ${x.linklayer === 'ethernet' ? 'selected' : ''}>ethernet</option><option ${x.linklayer === 'atm' ? 'selected' : ''}>atm</option></select></label><label class="field-wrap">Overhead (bayt)<input class="field" type="number" data-sqm-overhead="${esc(x.section)}" value="${esc(x.overhead)}"></label></div></details><button class="btn small" data-save-sqm="${esc(x.section)}">Kaydet</button> <button class="btn danger small" data-delete-sqm="${esc(x.section)}">Sil</button></div>`,
      )
      .join('')}${q.wans
      .filter((w) => !q.queues.some((x) => x.interface === w.device || x.interface === w.l3Device))
      .map(
        (w) =>
          `<button class="btn small" data-add-sqm="${esc(w.device)}">Hat için SQM ekle · ${esc(w.name)}</button>`,
      )
      .join('')}</div>`;
  }
  function gamingWarnings() {
    let q = state.sqm || {},
      html = '';
    if (!q.queues?.some((x) => x.gaming))
      html +=
        '<div class="alert">Öncelik için SQM modu Oyun öncelikli olmalı <button class="btn small" data-gaming-mode>Oyun moduna al</button></div>';
    if (q.offload || state.status.offload)
      html +=
        '<div class="alert">Flow offloading açık: öncelik ve cihaz hız sınırları çalışmaz <button class="btn small" data-disable-offload>Offloading’i kapat</button><small>CPU kullanımı biraz artabilir.</small></div>';
    return html;
  }
  function priorityRows() {
    let preferred = state.clients.filter((c) => ['console', 'pc', 'laptop'].includes(c.type)),
      others = state.clients.filter((c) => !['console', 'pc', 'laptop'].includes(c.type));
    let list = state.showAllPriority ? [...preferred, ...others] : preferred;
    list.sort((a, b) => Number(!!b.priority) - Number(!!a.priority));
    return `${list.map((c) => `<div class="priority-row"><span class="type-icon tiny">${typeIcon(c.type)}</span><strong>${esc(c.displayName)}</strong><span class="field-hint">${esc(c.ip)}</span><label><span class="sr-only">Öncelik</span><input class="switch" type="checkbox" data-priority="${esc(c.mac)}" ${c.priority ? 'checked' : ''}></label></div>`).join('') || '<div class="empty">Öncelik verilebilecek cihaz bulunamadı.</div>'}${!state.showAllPriority && others.length ? '<button class="btn small" data-show-priority>Tümünü göster</button>' : ''}`;
  }
  function openWan(name) {
    let w = wanList().find((x) => x.name === name);
    if (!w) return;
    state.drawerWan = name;
    drawWan(w);
  }
  function drawWan(w) {
    let host = document.getElementById('drawer-host');
    host.innerHTML = `<div class="drawer-backdrop open" data-close-drawer></div><aside class="drawer open" role="dialog" aria-modal="true"><div class="drawer-head"><div><div class="eyebrow">İnternet hattı</div><h2>${esc(w.label || w.name)}</h2><p>${esc(w.device || '—')} · ${esc(w.protoLabel || w.proto)}</p></div><button class="icon-btn" data-close-drawer>${icon('x')}</button></div><form class="drawer-body" id="wan-form" data-wan="${esc(w.name)}"><div class="drawer-section"><div class="field-wrap"><label>Bağlantı tipi</label><select class="field" name="proto"><option value="pppoe" ${w.proto === 'pppoe' ? 'selected' : ''}>PPPoE</option><option value="dhcp" ${w.proto === 'dhcp' ? 'selected' : ''}>DHCP (otomatik)</option><option value="static" ${w.proto === 'static' ? 'selected' : ''}>Statik IP</option></select></div><div class="wan-pppoe" ${w.proto === 'pppoe' ? '' : 'hidden'}><div class="field-wrap"><label>Kullanıcı adı</label><input class="field" name="username" value="${esc(w.username || '')}"></div><div class="field-wrap"><label>Şifre</label><div class="password-line"><input class="field" name="password" type="password" placeholder="${w.passwordSet ? 'Kayıtlı — değiştirmek için yazın' : 'Şifre'}"></div><span class="field-hint">Boş bırakırsanız kayıtlı Şifre korunur.</span></div></div><div class="wan-static" ${w.proto === 'static' ? '' : 'hidden'}>${[
      ['ipaddr', 'IP adresi'],
      ['netmask', 'Alt ağ maskesi'],
      ['gateway', 'Ağ geçidi'],
    ]
      .map(
        ([n, l]) =>
          `<div class="field-wrap"><label>${l}</label><input class="field" name="${n}" value="${esc(w[n] || '')}"></div>`,
      )
      .join(
        '',
      )}</div></div><details class="drawer-section" open><summary>Gelişmiş</summary><div class="field-wrap"><label>VLAN ID</label><input class="field num" name="vlan" type="number" min="0" max="4094" value="${w.vlan || 0}"><span class="field-hint">0 = yok. Turknet fiber için genelde 35.</span></div><div class="field-wrap"><label>MTU</label><input class="field num" name="mtu" type="number" min="0" max="9000" value="${w.mtu || 0}" placeholder="Otomatik"><span class="field-hint">0 veya boş = otomatik. PPPoE için Önerilen 1492.</span></div><div class="toggle-line"><div><strong>DNS'i operatörden al</strong></div><input class="switch" type="checkbox" name="peerdns" ${w.peerdns ? 'checked' : ''}></div><div class="field-wrap wan-dns" ${w.peerdns ? 'hidden' : ''}><label>DNS sunucuları</label><input class="field" name="dns" value="${esc((w.dns || []).join(', '))}" placeholder="1.1.1.1, 8.8.8.8"><div class="chip-row">${[
      ['Cloudflare', '1.1.1.1, 1.0.0.1'],
      ['Google', '8.8.8.8, 8.8.4.4'],
      ['Quad9', '9.9.9.9'],
    ]
      .map(([n, d]) => `<button class="chip" type="button" data-dns="${d}">${n}</button>`)
      .join(
        '',
      )}</div></div><div class="toggle-line"><div><strong>Bu hattı kullan</strong></div><input class="switch" type="checkbox" name="enabled" ${w.enabled ? 'checked' : ''}></div></details><div class="drawer-section info-grid"><div><small>Cihaz</small><strong>${esc(w.device || '—')}</strong></div><div><small>Temel port</small><strong>${esc(w.baseDevice || '—')}</strong></div><div><small>Metric</small><strong>${esc(w.metric ?? '—')}</strong></div></div><div class="form-error" id="wan-form-error"></div></form><div class="drawer-foot"><span></span><div class="drawer-actions"><button class="btn" data-close-drawer>İptal</button><button class="btn primary" type="submit" form="wan-form">Kaydet</button></div></div></aside>`;
  }
  function huaweiConfigCard() {
    return `<section class="card span-12 integ-detail" id="integ-huawei">${cardHead('wifi', 'Huawei Wi-Fi ayarları')}<form id="huawei-form"><div class="toggle-line"><strong>Huawei ba&#287;lant&#305;s&#305;n&#305; etkinle&#351;tir</strong><input class="switch" type="checkbox" name="enabled" ${state.huawei?.enabled || state.integLocal?.huawei ? 'checked' : ''}></div><div class="info-grid huawei-fields"><div class="field-wrap"><label>Huawei IP adresi</label><input class="field" name="host" value="${esc(state.huawei?.host || '192.168.1.2')}"></div><div class="field-wrap"><label>Kullan&#305;c&#305; ad&#305;</label><input class="field" name="username" value="${esc(state.huawei?.username || 'admin')}"></div><div class="field-wrap"><label>&#350;ifre</label><input class="field" name="password" type="password" placeholder="${state.huawei?.passwordSet ? 'Kay&#305;tl&#305;' : ''}"></div></div><div class="huawei-status">${state.huawei?.connected ? 'Ba&#287;l&#305;' : esc(state.huawei?.error || state.huaweiError || 'Kapalı')}</div><div class="form-error" id="huawei-error"></div><button class="btn primary" type="submit">Kaydet</button></form></section>`;
  }
  function systemPage() {
    let o = state.overview || {},
      x = state.system || {},
      m = x.memory || {},
      d = x.disk || {},
      cpu = Number(x.cpu || 0),
      pct = (n) => Math.max(0, Math.min(100, Number(n) || 0)),
      tone = (n) => (n >= 95 ? 'danger' : n >= 80 ? 'warn' : '');
    return `${pageHead('Cihaz y&#246;netimi', 'Sistem', 'Router durumu ve y&#246;netim se&#231;enekleri.')}<div class="grid"><section class="card span-12">${cardHead('system', 'Kaynaklar')}<div class="resource-grid"><div class="resource"><div class="resource-head"><strong>CPU</strong><b class="${tone(cpu)}">${x.cpuEstimated ? '~' : ''}%${cpu}</b></div><div class="progress"><i class="${tone(cpu)}" style="width:${pct(cpu)}%"></i></div><small>${esc(x.cores || '—')} &#231;ekirdek · ${esc(x.model || o.model || '')} · Y&#252;k ${esc((x.load || o.load || []).join(' · ') || '—')}</small></div><div class="resource"><div class="resource-head"><strong>RAM</strong><b class="${tone(m.percent)}">%${esc(m.percent ?? 0)}</b></div><div class="progress"><i class="${tone(m.percent)}" style="width:${pct(m.percent)}%"></i></div><small>${esc(NP.fmt.bytes(m.used || 0))} / ${esc(NP.fmt.bytes(m.total || 0))}</small></div><div class="resource"><div class="resource-head"><strong>Disk</strong><b class="${tone(d.percent)}">%${esc(d.percent ?? 0)}</b></div><div class="progress"><i class="${tone(d.percent)}" style="width:${pct(d.percent)}%"></i></div><small>${esc(NP.fmt.bytes(d.used || 0))} / ${esc(NP.fmt.bytes(d.total || 0))}</small></div>${x.temp != null ? `<div class="resource"><strong>S&#305;cakl&#305;k</strong> ${esc(x.temp)} ?C</div>` : ''}</div></section><section class="card span-7">${cardHead('router', 'Cihaz bilgileri')}<div class="info-grid">${[
      ['Model', o.model],
      ['Hostname', o.hostname],
      ['Firmware', o.firmware],
      ['Kernel', o.kernel],
      ['&#199;al&#305;&#351;ma s&#252;resi', fmtUptime(o.uptime)],
      ['CPU y&#252;k&#252;', o.load?.join(' · ')],
      ['Bellek kullan&#305;m&#305;', `${o.memory?.percent || 0}% · ${NP.fmt.bytes(o.memory?.used || 0)}`],
      ['NetOS', state.status.version || '—'],
    ]
      .map(([k, v]) => `<div><small>${k}</small><strong>${esc(v || '—')}</strong></div>`)
      .join(
        '',
      )}</div></section><section class="card span-5">${cardHead('system', 'Y&#246;netim')}<button class="btn danger" data-reboot>Yeniden ba&#351;lat</button><p><a href="/cgi-bin/luci/">Geli&#351;mi&#351; ayarlar (LuCI) ↗</a></p><button class="btn" data-logout>&#199;&#305;k&#305;&#351; yap</button></section>${updateCard()}<section class="card span-5">${cardHead('lock', 'Panel &#351;ifresi')}<form id="password-form"><div class="pw-grid">${[
      ['Mevcut &#351;ifre', 'old'],
      ['Yeni &#351;ifre', 'next'],
      ['Yeni &#351;ifre (tekrar)', 'repeat'],
    ]
      .map(
        ([l, n]) =>
          `<div class="field-wrap"><label>${l}</label><input class="field pass-field" name="${n}" type="password" required></div>`,
      )
      .join(
        '',
      )}</div><div class="password-strength" id="password-strength"></div><div class="form-error" id="password-error"></div><p class="field-hint">Bu &#351;ifre router'&#305;n root &#351;ifresidir; SSH ve LuCI giri&#351;i de de&#287;i&#351;ir.</p><button class="btn primary" id="password-save" type="submit" disabled>&#350;ifreyi kaydet</button></form></section></div>`;
  }
  function render() {
    root.innerHTML = nav();
    let c = document.getElementById('content');
    if (!NP.hasSession()) {
      login();
      return;
    }
    if (state.page === '/')
      c.innerHTML = state.overview ? home() : '<div class="empty">Router bilgileri yükleniyor…</div>';
    else if (state.page === '/devices' || state.page.startsWith('/devices/')) c.innerHTML = devices();
    else if (state.page === '/wifi') c.innerHTML = wifiPage();
    else if (state.page === '/internet') c.innerHTML = internetPage();
    else if (state.page === '/speed') c.innerHTML = speedPage();
    else if (state.page === '/system') c.innerHTML = systemPage();
    else if (state.page === '/stats') c.innerHTML = statsPage();
    else if (state.page === '/integrations') c.innerHTML = integrationsPage();
    else if (state.page === '/more') c.innerHTML = morePage();
    else if (state.page === '/scanner') c.innerHTML = scannerPage();
    else if (state.page === '/lan') c.innerHTML = lanPage();
    else if (state.page === '/ports') c.innerHTML = portsPage();
    else if (state.page === '/vpn') c.innerHTML = state.xInteg && !integOn('vpn') ? `${pageHead('Uzaktan erişim', 'VPN (WireGuard)', '')}<section class="card"><div class="empty">VPN entegrasyonu kapalı. <a href="#/integrations">Entegrasyonlar</a>’dan etkinleştirin.</div></section>` : vpnPage();
    else if (state.page === '/adblock') c.innerHTML = adblockPage();
    else if (state.page === '/logs') c.innerHTML = logsPage();
    else if (state.page === '/welcome') c.innerHTML = welcomePage();
    else {
      state.page = '/';
      c.innerHTML = state.overview ? home() : '';
    }
    if (state.page === '/system') {
      let section = document.createElement('section');
      section.className = 'card span-12';
      section.innerHTML = `<div class="card-head"><h2>Geli&#351;mi&#351;</h2></div><div class="toggle-line"><div><strong>Flow offloading</strong><p>A&#231;&#305;kken CPU y&#252;k&#252; azal&#305;r ama h&#305;z s&#305;n&#305;r&#305;, cihaz h&#305;zlar&#305; ve oyun &#246;nceli&#287;i &#231;al&#305;&#351;maz.</p></div><input class="switch" type="checkbox" data-offload ${(state.sqm?.offload ?? state.status.offload) ? 'checked' : ''}></div>`;
      c.querySelector('.grid')?.append(section);
      c.querySelector('.grid')?.insertAdjacentHTML('beforeend', systemExtras());
    }
    if (state.page === '/devices' || state.page.startsWith('/devices/')) {
      c.querySelector('.page-head')?.insertAdjacentHTML('afterend', newDevicesCard());
    }
    syncGlobalBand();
    if (state.page === '/speed') (c.querySelector('.grid') || c).insertAdjacentHTML('beforeend', speedSchedCard());
    if (state.page === '/wifi') c.insertAdjacentHTML('beforeend', tplinkWifiSection());
    c.insertAdjacentHTML('afterbegin', lanPendingBanner() + pwBanner());
    if (state.page === '/logs') scrollLogEnd();
    if (state.xPanel) drawXPanel();
    if (state.page === '/integrations' && state.integDrawer) drawIntegDrawer();
    else state.integDrawer = null;
    if (state.page.startsWith('/devices/')) {
      let mac = decodeURIComponent(state.page.slice('/devices/'.length));
      openClient(mac, false);
    }
  }
  // gece / gündüz modu
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  function langButton() {
    let l = window.NetI18n?.lang || 'tr';
    return `<div class="lang-seg" role="group" aria-label="Dil / Language" data-no-i18n><button type="button" class="${l === 'tr' ? 'active' : ''}" data-lang="tr" aria-pressed="${l === 'tr'}">TR</button><button type="button" class="${l === 'en' ? 'active' : ''}" data-lang="en" aria-pressed="${l === 'en'}">EN</button></div>`;
  }
  function themeButton() {
    let d = isDark();
    return `<button class="theme-btn" type="button" data-theme-toggle title="${d ? 'Gündüz moduna geç' : 'Gece moduna geç'}" aria-label="${d ? 'Gündüz moduna geç' : 'Gece moduna geç'}">${icon(d ? 'sun' : 'moon')}</button>`;
  }
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem('np_theme', t);
    } catch (_) {}
    let m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = t === 'dark' ? '#11171b' : '#f4f6f8';
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.outerHTML = themeButton());
  }
  document.addEventListener('click', (e) => {
    let lb = e.target.closest('[data-lang]');
    if (lb && window.NetI18n && lb.dataset.lang !== NetI18n.lang) {
      NetI18n.set(lb.dataset.lang);
      location.reload();
      return;
    }
    if (e.target.closest('[data-theme-toggle]')) setTheme(isDark() ? 'light' : 'dark');
    if (e.target.closest('[data-theme-toggle-row]')) {
      setTheme(isDark() ? 'light' : 'dark');
      if (state.page === '/more') render();
    }
  });
  function login() {
    root.innerHTML = `<main class="login-screen"><div class="login-theme">${langButton()}${themeButton()}</div><form class="login-card" id="login-form"><div class="brand">${brandMark}<span class="brand-name"><span>Net</span><b>OS</b></span></div><h1>Tekrar hoş geldiniz</h1><p>Ev ağınıza güvenli şekilde giriş yapın.</p><div class="field-wrap"><label for="username">Kullanıcı adı</label><input class="field" id="username" name="username" autocomplete="username" value="root"></div><div class="field-wrap"><label for="password">Şifre</label><input class="field" id="password" name="password" type="password" autocomplete="current-password"></div><div class="login-error" id="login-error" role="alert"></div><button class="btn primary" type="submit">Giriş yap</button>${NP.isMock ? '<div style="text-align:center;color:var(--muted);font-size:11px;margin-top:12px">Önizleme modunda herhangi bir şifre kabul edilir.</div>' : ''}</form></main>`;
  }
  function openClient(mac, changeHash = true) {
    let c = state.clients.find((x) => x.mac === mac);
    if (!c) return;
    if (changeHash) {
      state.drawerMac = mac;
      history.pushState({ drawer: true }, '', `#/devices/${encodeURIComponent(mac)}`);
    }
    drawClient(c);
  }
  function drawClient(c) {
    state.drawerMac = c.mac;
    let i = findIface(c),
      cidr = i?.cidr || '';
    let wifi = state.networks.wifi.find((w) => w.ssid === c.ssid);
    const backdrop = document.createElement('div');
    backdrop.innerHTML = `<div class="drawer-backdrop open" data-close-drawer></div><aside class="drawer open" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div class="drawer-head"><div><div class="eyebrow">Cihaz ayrıntıları</div><h2 id="drawer-title">${esc(c.displayName)}</h2><p>${esc(c.ip)} · ${esc(NP.fmt.mac(c.mac))}</p></div><button class="icon-btn" aria-label="Kapat" data-close-drawer>${icon('x')}</button></div><form class="drawer-body" id="client-form" data-mac="${esc(c.mac)}"><div class="drawer-section type-section"><div class="type-current"><span class="type-icon large">${typeIcon(c.type)}</span><strong>${c.typeAuto ? `Otomatik (tahmin: ${esc(typeLabels[c.type] || c.type)})` : esc(typeLabels[c.type] || c.type || 'Diğer')}</strong></div><div class="type-grid"><label class="type-option"><input type="radio" name="type" value="" ${c.typeAuto ? 'checked' : ''}><span>${typeIcon(c.type)}<small>Otomatik</small></span></label>${typeKeys.map((t) => `<label class="type-option"><input type="radio" name="type" value="${t}" ${!c.typeAuto && c.type === t ? 'checked' : ''}><span>${typeIcon(t)}<small>${esc(typeLabels[t] || t)}</small></span></label>`).join('')}</div></div><div class="drawer-section"><div class="field-wrap"><label for="client-name">Cihaz adı</label><input class="field" id="client-name" name="name" maxlength="32" value="${esc(c.name || '')}" placeholder="${esc(c.hostname || 'Cihaz adı')}"></div><div class="info-grid"><div><small>MAC adresi</small><strong>${esc(NP.fmt.mac(c.mac))}</strong></div><div><small>Ba&#287;lant&#305;</small><strong>${esc(c.connLabel || (c.conn === 'wifi' ? 'Wi-Fi' : 'Ethernet'))}${c.ssid ? ' · ' + esc(c.ssid) : ''}${c.via === 'huawei' ? ' · Huawei' : ''}</strong></div><div><small>&#220;retici</small><strong>${esc(c.vendor || '—')}</strong></div><div><small>Sinyal</small><strong>${c.signal == null ? '—' : esc(c.signal) + ' dBm'}</strong></div><div><small>Durum</small><strong>${c.online ? 'Çevrimiçi' : 'Çevrimdışı'}</strong></div><div><small>Toplam indirme</small><strong>${esc(NP.fmt.bytes(c.rxBytes))}</strong></div><div><small>Toplam yükleme</small><strong>${esc(NP.fmt.bytes(c.txBytes))}</strong></div></div>${
      (c.web || []).filter((u) => /^https?:\/\//i.test(u)).length
        ? `<div class="web-links"><strong>Web arayüzleri</strong>${c.web
            .filter((u) => /^https?:\/\//i.test(u))
            .map((u) => {
              let a = document.createElement('a');
              a.href = u;
              let label = a.host;
              return `<a class="btn small" href="${esc(u)}" target="_blank" rel="noopener">Web arayüzünü aç · ${esc(label)}</a>`;
            })
            .join('')}</div>`
        : ''
    }</div><div class="drawer-section"><h3>Sabit IP adresi</h3>${c.staticPending ? `<div class="alert pending-ip">Sabit IP kaydedildi (${esc(c.staticIp)}). Cihaz &#351;u an ${esc(c.ip)} adresinde; Wi-Fi'yi kapat&#305;p a&#231;&#305;nca veya yeniden ba&#351;lat&#305;nca yeni IP'yi al&#305;r. Sonras&#305;nda bu IP kal&#305;c&#305;d&#305;r.</div>` : ''}<div class="toggle-line"><div><strong>Bu cihaza IP ayır</strong><p>Cihaz yeniden bağlandığında yeni adresi alır.</p></div><input class="switch" type="checkbox" id="static-toggle" name="static" ${c.static ? 'checked' : ''}></div><div class="field-wrap" style="margin:12px 0 0"><label for="static-ip">IP adresi</label><input class="field num" id="static-ip" name="ip" value="${esc(c.staticIp || c.ip)}" ${c.static ? '' : 'disabled'}><span class="field-hint" id="subnet-hint">${cidr ? 'Bu ağın aralığı: ' + esc(cidr) : 'Cihaz ağı belirlenemedi.'}</span></div></div><div class="drawer-section"><h3>Hız sınırı</h3><div class="info-grid"><div class="field-wrap"><label for="limit-down">İndirme · Mbit/s</label><input class="field num" id="limit-down" name="limitDown" type="number" min="0" max="10000" value="${c.limitDown || ''}" placeholder="Sınırsız"></div><div class="field-wrap"><label for="limit-up">Yükleme · Mbit/s</label><input class="field num" id="limit-up" name="limitUp" type="number" min="0" max="10000" value="${c.limitUp || ''}" placeholder="Sınırsız"></div></div><div class="limit-chips">${[5, 10, 25, 50, 100].map((n) => `<button type="button" class="chip" data-limit="${n}">${n} Mbit/s</button>`).join('')}</div><span class="field-hint">İndirme sınırı IPv4 trafiğe uygulanır. 0 veya boş değer sınırsızdır.</span></div><div class="drawer-section"><div class="toggle-line"><div><strong>İnternet erişimini engelle</strong><p>Bu cihazın internet erişimini durdurur.</p></div><input class="switch red" type="checkbox" name="blocked" ${c.blocked ? 'checked' : ''}></div></div><div class="form-error" id="client-error" role="alert"></div></form><div class="drawer-foot"><button class="btn danger small" data-forget="${esc(c.mac)}">Cihazı unut</button><div class="drawer-actions"><button class="btn" data-close-drawer>İptal</button><button class="btn primary" type="submit" form="client-form">Kaydet</button></div></div></aside>`;
    let clientForm = backdrop.querySelector('#client-form'),
      speedSection = [...clientForm.querySelectorAll('.drawer-section')].find((section) =>
        section.querySelector('h3')?.textContent.includes('H\u0131z s\u0131n\u0131r\u0131'),
      ),
      prioritySection = document.createElement('div');
    prioritySection.className = 'drawer-section';
    prioritySection.innerHTML = `<div class="toggle-line"><div><strong>Oyun &#246;nceli&#287;i</strong><p>Y&#252;kleme trafi&#287;ine &#246;ncelik verir.</p></div><input class="switch" type="checkbox" name="priority" ${c.priority ? 'checked' : ''}></div>`;
    clientForm.insertBefore(prioritySection, speedSection);
    // cihaz başına internet hattı (yalnız birden fazla hat varsa)
    let lines = (state.overview?.wans || []).map((w) => w.name).filter(Boolean);
    if (lines.length > 1 || c.wan) {
      let sec = document.createElement('div'),
        lab = (n) => (state.overview?.wans || []).find((w) => w.name === n)?.label || n;
      sec.className = 'drawer-section';
      sec.innerHTML = `<h3>İnternet hattı</h3><div class="field-wrap"><label for="client-wan">Bu cihaz hangi hattan çıksın?</label><select class="field" id="client-wan" name="wan"><option value="">Otomatik (genel çoklu hat ayarı)</option>${lines
        .map((n) => `<option value="${esc(n)}" ${c.wan === n ? 'selected' : ''}>Önce ${esc(lab(n))} (koparsa diğer hat)</option><option value="${esc(n)}!" ${c.wan === n + '!' ? 'selected' : ''}>Yalnız ${esc(lab(n))}</option>`)
        .join('')}</select><span class="field-hint">“Yalnız” seçilirse o hat koptuğunda bu cihazın interneti de kesilir. Kural cihazın IP adresine bağlıdır; cihaza otomatik sabit IP ayrılır.</span></div>`;
      clientForm.insertBefore(sec, prioritySection);
    }
    document.getElementById('drawer-host').replaceChildren(...backdrop.children);
    state.agDraft = state.agDraft?.mac === c.mac ? state.agDraft : null;
    if (integOn('adguard') && !state.xAg) loadAg('/devices');
    injectDeviceExtras(c);
    injectSchedule(c);
  }
  function openWifi(section) {
    let w = state.networks.wifi.find((x) => x.section === section);
    if (!w) return;
    state.drawerWifi = section;
    const host = document.getElementById('drawer-host');
    const el = document.createElement('div');
    el.innerHTML = `<div class="drawer-backdrop open" data-close-drawer></div><aside class="drawer open" role="dialog" aria-modal="true" aria-labelledby="wifi-title"><div class="drawer-head"><div><div class="eyebrow">Kablosuz ağ ayarları · ${esc(w.bandLabel || NP.fmt.band(w.band))}</div><h2 id="wifi-title">${esc(w.ssid)}</h2><p>${w.clients} bağlı cihaz · Kanal ${esc(w.channel)}</p></div><button class="icon-btn" aria-label="Kapat" data-close-drawer>${icon('x')}</button></div><form class="drawer-body" id="wifi-form" data-section="${esc(w.section)}"><div class="drawer-section"><div class="field-wrap"><label for="wifi-ssid">Ağ adı (SSID)</label><input class="field" id="wifi-ssid" name="ssid" maxlength="32" value="${esc(w.ssid)}"></div><div class="field-wrap"><label for="wifi-key">Wi-Fi şifresi</label><div style="display:flex;gap:8px"><input class="field" id="wifi-key" name="key" type="password" value="${esc(w.key)}" style="flex:1"></div><span class="field-hint">Şifre 8–63 karakter olmalıdır.</span></div><div class="form-error" id="wifi-error" role="alert"></div><div class="alert" style="margin-top:12px"><span>ⓘ</span>Kaydederken Wi-Fi kısa süre kesilecek.</div></div></form><div class="drawer-foot"><span></span><div class="drawer-actions"><button class="btn" data-close-drawer>İptal</button><button class="btn primary" type="submit" form="wifi-form">Kaydet</button></div></div></aside>`;
    host.replaceChildren(...el.children);
  }
  // Global geri sayım bandı: İnternet sayfasında sayfa içi bant zaten var, orada gösterme
  function syncGlobalBand() {
    let band = document.getElementById('global-wan-pending');
    if (state.page !== '/internet' && state.wanConfig?.pendingUntil) {
      if (!band) {
        band = document.createElement('div');
        band.id = 'global-wan-pending';
        document.body.appendChild(band);
      }
      band.innerHTML = pendingBanner();
    } else if (band) band.remove();
  }
  async function refreshWan() {
    state.wanConfig = await NP.getWanConfig();
    state.wanEvents = await NP.getWanEvents();
    syncGlobalBand();
  }
  async function loadData() {
    if (!NP.hasSession()) return;
    try {
      const [o, n, cl, t, s] = await Promise.all([
        NP.getOverview(),
        NP.getNetworks(),
        NP.getClients(),
        NP.getTraffic(),
        NP.getStatus(),
      ]);
      state.overview = o;
      state.networks = n;
      state.clients = cl;
      state.traffic = t;
      state.status = s;
      state.error = null;
      try {
        state.wanConfig = await NP.getWanConfig();
        state.wanEvents = await NP.getWanEvents();
      } catch (wanErr) {
        console.warn('WAN bilgileri alınamadı', wanErr);
      }
      try {
        state.huawei = await NP.getHuawei();
        state.huaweiError = null;
      } catch (hErr) {
        state.huaweiError = hErr.message;
      }
      render();
    } catch (e) {
      state.error = e;
      render();
    }
  }
  function startLive() {
    if (state.liveStop) state.liveStop();
    state.liveStop = NP.live(({ clients, traffic, error }) => {
      if (error) {
        state.error = error;
        updateTop();
        return;
      }
      state.error = null;
      if (clients) state.clients = clients;
      if (traffic) state.traffic = traffic;
      updateTop();
      if (state.page === '/') updateHomeLive();
      if (state.page === '/devices') updateDevicesLive();
      if (state.drawerMac) {
        const f = document.getElementById('client-form');
        const c = state.clients.find((x) => x.mac === state.drawerMac);
        if (f && c) {
          /* Form values remain untouched while live stats update. */ const title =
            document.getElementById('drawer-title');
          if (title) title.textContent = c.displayName;
        }
      }
    }, 2000);
  }
  function updateTop() {
    const top = document.querySelector('.top-status');
    if (!top) return;
    let connection = state.error ? '<span class="pill"><i class="dot bad"></i> Bağlantı sorunu</span>' : '';
    top.innerHTML = `${connection}${NP.isMock ? '<span class="pill demo">Demo verisi</span>' : ''}<span class="top-host">${esc(state.overview?.hostname || 'NetOS')}</span>${bellButton()}${langButton()}${themeButton()}`;
  }
  function updateHomeLive() {
    let fresh = home();
    let temp = document.createElement('div');
    temp.innerHTML = fresh;
    let c = document.getElementById('content');
    if (c) c.innerHTML = temp.innerHTML;
  }
  function updateDevicesLive() {
    let c = document.getElementById('content');
    if (!c) return;
    let rows = document.getElementById('device-rows'),
      cards = document.getElementById('device-cards');
    if (rows) rows.innerHTML = filtered().map(deviceRow).join('');
    if (cards)
      cards.innerHTML =
        filtered().map(deviceCard).join('') || '<div class="empty">Bu filtrede cihaz bulunamadı.</div>';
    let sub = c.querySelector('.page-head .subtitle');
    if (sub)
      sub.textContent = `${state.clients.filter((x) => x.online && !x.blocked).length} çevrimiçi · ${state.clients.length} kayıtlı`;
  }
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }
  async function init() {
    if (!NP.hasSession()) {
      render();
      return;
    }
    await loadData();
    try {
      state.system = await NP.getSystem();
    } catch (_) {}
    startLive();
    if (state.systemTimer) clearInterval(state.systemTimer);
    state.systemTimer = setInterval(
      async () => {
        if (state.page === '/system' || state.page === '/') {
          try {
            state.system = await NP.getSystem();
            if (state.page === '/system') { if (!formBusy()) render(); }
            else updateHomeLive();
          } catch (e) {
            state.error = e;
            updateTop();
          }
        }
      },
      state.page === '/system' ? 3000 : 10000,
    );
    state.overviewTimer = setInterval(async () => {
      if (!NP.hasSession()) return;
      try {
        const [o, n, s] = await Promise.all([NP.getOverview(), NP.getNetworks(), NP.getStatus()]);
        if (state.page === '/' && state.xPorts) NP.getPorts().then(setPorts).catch(() => {});
        const previous = state.overview?.wans || [];
        state.overview = o;
        state.networks = n;
        state.status = s;
        for (const w of o.wans || []) {
          if (
            Object.prototype.hasOwnProperty.call(state.lastWanOnline, w.name) &&
            state.lastWanOnline[w.name] !== !!w.online
          ) {
            let label = w.label || w.name;
            toast(`${label} ${w.online ? 'geri geldi' : 'bağlantısı koptu'}`);
          }
          state.lastWanOnline[w.name] = !!w.online;
        }
        try {
          state.wanConfig = await NP.getWanConfig();
          state.wanEvents = await NP.getWanEvents();
          if (state.drawerWan && !document.getElementById('wan-form')) {
            let fresh = wanList().find((x) => x.name === state.drawerWan);
            if (fresh) drawWan(fresh);
          }
          if (state.page === '/internet') {
            let content = document.getElementById('content');
            if (content) {
              let oldForm = document.getElementById('wan-mode-form');
              let vals = oldForm ? new FormData(oldForm) : null;
              content.innerHTML = internetPage();
              if (vals) {
                for (const [k, v] of vals.entries()) {
                  let el = content.querySelector(`[name="${CSS.escape(k)}"]`);
                  if (el) el.value = v;
                }
                let checked = vals.get('mode');
                if (checked) {
                  let el = content.querySelector(`[name="mode"][value="${CSS.escape(checked)}"]`);
                  if (el) el.checked = true;
                }
              }
            }
          }
          syncGlobalBand();
        } catch (wanErr) {
          console.warn('WAN yenileme başarısız', wanErr);
        }
        try {
          const h = await NP.getHuawei();
          for (const band of Object.keys(state.huaweiPending)) {
            const prev = state.huawei?.radios?.find((r) => r.band === band),
              next = h.radios?.find((r) => r.band === band);
            if (prev && next) next.enabled = prev.enabled;
          }
          state.huawei = h;
          state.huaweiError = null;
        } catch (hErr) {
          state.huaweiError = hErr.message;
        }
        if ((state.page === '/' || state.page === '/wifi' || state.page === '/system') && !formBusy()) render();
      } catch (e) {
        state.error = e;
        updateTop();
      }
    }, 10000);
    if (state.wanTimer) clearInterval(state.wanTimer);
    state.wanTimer = setInterval(() => {
      document.querySelectorAll('[data-countdown]').forEach((el) => {
        let sec = Math.max(0, Math.ceil(((state.wanConfig?.pendingUntil || Date.now()) - Date.now()) / 1000));
        el.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
      });
      if (state.wanConfig?.pendingUntil && Date.now() >= state.wanConfig.pendingUntil) {
        state.wanConfig.pendingUntil = null;
        state.revertNotice = 'Ayarlar geri alındı';
        loadData();
      }
    }, 1000);
  }
  root.addEventListener('click', async (e) => {
    let b = e.target.closest(
      'button,a,[data-client],[data-wifi],[data-edit-wifi],[data-close-drawer],[data-forget],[data-dismiss-alert],[data-reboot],[data-logout],[data-open-wan]',
    );
    if (!b) return;
    if (b.matches('[data-open-wan]')) {
      openWan(b.dataset.openWan);
      return;
    }
    if (b.matches('[data-reconnect]')) {
      if (!confirm('Bağlantı birkaç saniye kesilecek. Devam edilsin mi?')) return;
      try {
        await NP.reconnectWan(b.dataset.reconnect);
        toast('Yeniden bağlanma başlatıldı');
      } catch (x) {
        toast(x.message);
      }
      return;
    }
    if (b.matches('[data-confirm-wan]')) {
      try {
        await NP.confirmWan();
        state.wanConfig = await NP.getWanConfig();
        state.revertNotice = '';
        toast('İnternet ayarları onaylandı');
        render();
      } catch (x) {
        toast(x.message);
      }
      return;
    }
    if (b.matches('[data-revert-wan]')) {
      try {
        await NP.revertWan();
        state.wanConfig = await NP.getWanConfig();
        state.revertNotice = 'Ayarlar geri alındı';
        await loadData();
      } catch (x) {
        toast(x.message);
      }
      return;
    }
    if (b.matches('[data-more-events]')) {
      state.wanShown += 20;
      render();
      return;
    }
    if (b.matches('[data-dns]')) {
      let f = document.querySelector('#wan-form [name=dns]');
      if (f) f.value = b.dataset.dns;
      return;
    }
    if (b.matches('[data-wan-reveal]')) {
      let f = document.querySelector('#wan-form [name=password]');
      if (f) {
        f.type = f.type === 'password' ? 'text' : 'password';
        b.textContent = f.type === 'password' ? 'Göster' : 'Gizle';
      }
      return;
    }
    if (b.matches('[data-scan-web]')) {
      try {
        await NP.scanWeb();
        toast('Tarama başladı, ~30 sn içinde güncellenir');
      } catch (x) {
        toast(x.message);
      }
      return;
    }
    if (b.matches('[data-password-reveal]')) {
      document
        .querySelectorAll('.pass-field')
        .forEach((i) => (i.type = i.type === 'password' ? 'text' : 'password'));
      b.textContent = b.textContent === 'Göster' ? 'Gizle' : 'Göster';
      return;
    }
    if (b.matches('[data-filter]')) {
      state.filter = b.dataset.filter;
      render();
      return;
    }
    if (b.matches('[data-client]')) {
      openClient(b.dataset.client);
      return;
    }
    if (b.matches('[data-edit-wifi]')) {
      openWifi(b.dataset.editWifi);
      return;
    }
    if (b.matches('[data-wifi]') && !e.target.closest('input,button')) {
      openWifi(b.dataset.wifi);
      return;
    }
    if (b.matches('[data-close-drawer]')) {
      document.getElementById('drawer-host').replaceChildren();
      state.drawerMac = null;
      state.drawerWifi = null;
      state.drawerWan = null;
      state.integDrawer = null;
      state.xPanel = null;
      if (state.page.startsWith('/devices/')) {
        history.replaceState({}, '', '#/devices');
        state.page = '/devices';
        render();
      }
      return;
    }
    if (b.matches('[data-copy-outages]')) {
      let txt = outageText();
      (navigator.clipboard?.writeText(txt) || Promise.reject())
        .then(() => toast('Kesinti raporu panoya kopyalandı'))
        .catch(() => prompt('Raporu kopyalayın:', txt));
      return;
    }
    if (b.matches('[data-banner-close]')) {
      let k = b.dataset.bannerClose;
      state.bannerOnce = { ...state.bannerOnce, [k]: { closed: true } };
      lsSet(k, '1');
      render();
      toast('Uyarı üstteki zile taşındı.');
      return;
    }
    if (b.matches('[data-keep-offload]')) {
      try {
        localStorage.setItem('np_offload_ok', '1');
      } catch (_) {}
      toast('Uyarı gizlendi. Sistem > Gelişmiş bölümünden değiştirebilirsiniz.');
      render();
      return;
    }
    if (b.matches('[data-dismiss-alert]')) {
      state.alertOff = true;
      render();
      return;
    }
    if (b.matches('[data-limit]')) {
      let f = document.getElementById('limit-down');
      if (f) f.value = b.dataset.limit;
      return;
    }
    if (b.matches('[data-reveal]')) {
      let input = document.getElementById('wifi-key');
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
        b.textContent = input.type === 'password' ? 'Göster' : 'Gizle';
      }
      return;
    }
    if (b.matches('[data-forget]')) {
      if (confirm('Bu cihazı kayıtlı cihazlardan kaldırmak istiyor musunuz?'))
        try {
          await NP.forgetClient(b.dataset.forget);
          document.getElementById('drawer-host').replaceChildren();
          state.drawerMac = null;
          await loadData();
          toast('Cihaz unutuldu');
        } catch (err) {
          let x = document.getElementById('client-error');
          if (x) x.textContent = err.message;
        }
      return;
    }
    if (b.matches('[data-reboot]')) {
      if (confirm('Router yeniden başlatılsın mı? Bağlantı kısa süre kesilecek.')) {
        try {
          await NP.reboot();
          if (state.liveStop) state.liveStop();
          document.getElementById('content').innerHTML =
            '<div class="reboot-screen"><div><div class="state-orb" style="margin:0 auto 16px">' +
            icon('system') +
            '</div><h1>Yeniden başlatılıyor…</h1><p class="subtitle">Router tekrar çevrimiçi olduğunda bağlanabilirsiniz.</p></div></div>';
        } catch (err) {
          toast(err.message);
        }
      }
      return;
    }
    if (b.matches('[data-logout]')) {
      if (state.liveStop) state.liveStop();
      await NP.logout();
      render();
      return;
    }
  });
  root.addEventListener('change', async (e) => {
    let el = e.target;
    if (el.id === 'wan-event-filter') {
      state.wanFilter = el.value;
      render();
      return;
    }
    if (el.matches('[name=peerdns]')) {
      let box = document.querySelector('.wan-dns');
      if (box) box.hidden = el.checked;
      return;
    }
    if (el.matches('[name=proto]') && document.querySelector('.wan-pppoe')) {
      document.querySelector('.wan-pppoe').hidden = el.value !== 'pppoe';
      document.querySelector('.wan-static').hidden = el.value !== 'static';
      return;
    }
    if (el.matches('[name=mode]')) {
      el.closest('form')
        ?.querySelectorAll('.mode-option')
        .forEach((x) => x.classList.toggle('active', x.querySelector('input').checked));
      return;
    }
    if (el.matches('[data-huawei-band]')) {
      let band = el.dataset.huaweiBand,
        desired = el.checked,
        r = state.huawei?.radios?.find((x) => x.band === band),
        ssid = r?.ssid || 'Bu a\u011f';
      if (
        !desired &&
        !confirm(
          `Bu cihaz Wi-Fi ile ba\u011fl\u0131ysa ba\u011flant\u0131n kopabilir. ${ssid} kapat\u0131ls\u0131n m\u0131?`,
        )
      ) {
        el.checked = true;
        return;
      }
      state.huaweiPending[band] = { enabled: desired };
      el.disabled = true;
      let row = el.closest('.wifi-row'),
        pill = row?.querySelector('.wifi-right .pill');
      if (pill) pill.innerHTML = '<i class="dot off"></i>Bekliyor';
      let sp = document.createElement('i');
      sp.className = 'switch-spinner';
      el.after(sp);
      try {
        await NP.setHuaweiWifi(band, desired);
        state.huawei = await NP.getHuawei();
        state.huaweiError = null;
        state.xInteg = null;
        toast(desired ? 'Huawei Wi-Fi a\u00e7\u0131ld\u0131' : 'Huawei Wi-Fi kapat\u0131ld\u0131');
      } catch (err) {
        toast(err.message);
      } finally {
        delete state.huaweiPending[band];
        if ((state.page === '/' || state.page === '/wifi' || state.page === '/system') && !formBusy()) render();
      }
      return;
    }
    if (el.matches('[data-wifi-toggle]')) {
      el.disabled = true;
      try {
        await NP.setWifi(el.dataset.wifiToggle, { enabled: el.checked });
        await loadData();
        toast(el.checked ? 'Wi-Fi açıldı' : 'Wi-Fi kapatıldı');
      } catch (err) {
        el.checked = !el.checked;
        el.disabled = false;
        toast(err.message);
      }
      return;
    }
    if (el.id === 'static-toggle') {
      let ip = document.getElementById('static-ip');
      if (ip) {
        ip.disabled = !el.checked;
        if (el.checked && !ip.value)
          ip.value = state.clients.find((c) => c.mac === state.drawerMac)?.ip || '';
      }
      return;
    }
    if (el.id === 'iface-filter') {
      state.iface = el.value;
      updateDevicesLive();
    }
  });
  root.addEventListener('input', (e) => {
    if (e.target.matches('.pass-field')) {
      let f = document.getElementById('password-form'),
        n = f?.elements.next.value || '',
        r = f?.elements.repeat.value || '',
        score =
          (n.length >= 8 ? 1 : 0) +
          (n.length >= 12 ? 1 : 0) +
          (/[a-z]/.test(n) && /[A-Z]/.test(n) ? 1 : 0) +
          (/\d/.test(n) ? 1 : 0) +
          (/[^A-Za-z0-9]/.test(n) ? 1 : 0),
        m = document.getElementById('password-strength'),
        b = document.getElementById('password-save');
      if (m)
        m.textContent = n
          ? `Güç: ${['Zayıf', 'Orta', 'İyi', 'Güçlü', 'Çok güçlü'][Math.max(0, score - 1)]}${n.length < 8 ? ' · En az 8 karakter gerekli' : r && n !== r ? ' · Şifreler eşleşmiyor' : ''}`
          : '';
      if (b) b.disabled = n.length < 8 || n !== r;
    }
    if (e.target.matches('.search')) {
      state.query = e.target.value;
      updateDevicesLive();
    }
    if (e.target.id === 'static-ip') {
      let f = document.getElementById('client-form'),
        c = state.clients.find((x) => x.mac === f?.dataset.mac),
        iface = c && findIface(c),
        hint = document.getElementById('subnet-hint');
      if (hint && iface?.cidr) {
        let valid = NP.validate.inSubnet(e.target.value, iface.cidr);
        hint.textContent = valid ? 'Bu IP cihazın ağında.' : `Bu IP ${iface.cidr} ağı içinde değil.`;
        hint.style.color = valid ? '' : 'var(--amber)';
      }
    }
  });
  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    let f = e.target;
    if (f.id === 'wan-mode-form') {
      let err = document.getElementById('wan-mode-error'),
        data = new FormData(f),
        weights = {};
      err.textContent = '';
      for (const w of wanList())
        weights[w.name] = Math.max(1, Math.min(10, Number(data.get('weight-' + w.name) || 1)));
      try {
        let r = await NP.setWanMode(data.get('mode'), data.get('primary'), weights);
        state.wanConfig = { ...state.wanConfig, pendingUntil: r.pendingUntil };
        state.revertNotice = '';
        await refreshWan();
        render();
      } catch (x) {
        err.textContent = x.message;
      }
      return;
    }
    if (f.id === 'wan-form') {
      let err = document.getElementById('wan-form-error'),
        name = f.dataset.wan,
        old = wanList().find((w) => w.name === name),
        d = new FormData(f),
        patch = {};
      err.textContent = '';
      const take = (k, v) => {
        if (v !== undefined && v !== null && String(v) !== String(old[k] ?? '')) patch[k] = v;
      };
      take('proto', d.get('proto'));
      if (d.get('proto') === 'pppoe') {
        take('username', d.get('username'));
        if (d.get('password')) patch.password = d.get('password');
      }
      if (d.get('proto') === 'static') for (const k of ['ipaddr', 'netmask', 'gateway']) take(k, d.get(k));
      take('vlan', Number(d.get('vlan') || 0));
      take('mtu', Number(d.get('mtu') || 0));
      take('peerdns', d.get('peerdns') === 'on');
      if (d.get('peerdns') !== 'on') take('dns', d.get('dns').trim());
      take('enabled', d.get('enabled') === 'on');
      if (!Object.keys(patch).length) {
        toast('Değişiklik yok');
        return;
      }
      try {
        let r = await NP.setWan(name, patch);
        state.wanConfig = { ...state.wanConfig, pendingUntil: r.pendingUntil };
        state.revertNotice = '';
        await refreshWan();
        toast('İnternet ayarları uygulandı');
      } catch (x) {
        err.textContent = x.message;
      }
      return;
    }
    if (f.id === 'password-form') {
      let old = f.elements.old.value,
        n = f.elements.next.value,
        r = f.elements.repeat.value,
        err = document.getElementById('password-error'),
        b = document.getElementById('password-save');
      err.textContent = '';
      if (n.length < 8 || n !== r) return;
      b.disabled = true;
      try {
        await NP.changePassword(old, n);
        toast('Şifre değiştirildi');
        f.reset();
        document.getElementById('password-strength').textContent = '';
      } catch (x) {
        err.textContent = x.message;
      } finally {
        b.disabled = true;
      }
      return;
    }
    if (f.id === 'login-form') {
      let b = f.querySelector('button[type=submit]'),
        err = document.getElementById('login-error');
      b.disabled = true;
      b.textContent = 'Giriş yapılıyor…';
      try {
        await NP.login(f.elements.username.value, f.elements.password.value);
        await init();
      } catch (x) {
        err.textContent = x.message;
        b.disabled = false;
        b.textContent = 'Giriş yap';
      }
      return;
    }
    if (f.id === 'huawei-form') {
      let b = f.querySelector('button[type=submit]'),
        err = document.getElementById('huawei-error'),
        host = f.elements.host.value.trim(),
        username = f.elements.username.value.trim(),
        password = f.elements.password.value;
      err.textContent = '';
      if (!NP.validate.ip(host)) {
        err.textContent = 'Ge\u00e7erli bir IP adresi girin.';
        return;
      }
      b.disabled = true;
      b.textContent = 'Kaydediliyor\u2026';
      try {
        await NP.setHuaweiConfig({ enabled: f.elements.enabled.checked, host, username, password });
        state.huawei = await NP.getHuawei();
        state.huaweiError = null;
        state.xInteg = null;
        render();
        // kaydettikten sonra bağlantının sonucunu açıkça göster
        if (!f.elements.enabled.checked) toast('Huawei ayarlar\u0131 kaydedildi');
        else if (state.huawei?.connected) toast('Huawei’ye bağlandı ✓');
        else {
          toast('Huawei’ye bağlanılamadı');
          let e2 = document.getElementById('huawei-error');
          if (e2) e2.textContent = state.huawei?.error || 'Huawei’ye bağlanılamadı';
        }
      } catch (x) {
        err.textContent = x.message;
      } finally {
        let now = document.querySelector('#huawei-form button[type=submit]');
        if (now) {
          now.disabled = false;
          now.textContent = 'Kaydet';
        }
      }
      return;
    }
    if (f.id === 'client-form') {
      let b = document.querySelector('.drawer-foot button[type=submit]'),
        err = document.getElementById('client-error'),
        data = new FormData(f),
        c = state.clients.find((x) => x.mac === f.dataset.mac),
        patch = {};
      err.textContent = '';
      const name = data.get('name').trim();
      if (name !== (c.name || '')) patch.name = name;
      let picked = data.get('type') || '';
      if (picked !== (c.typeAuto ? '' : c.type)) patch.type = picked;
      if (data.get('static') !== String(!!c.static)) {
        patch.static = data.get('static') === 'on';
        if (patch.static) patch.ip = data.get('ip');
      } else if (data.get('static') === 'on' && data.get('ip') !== c.staticIp) {
        patch.static = true;
        patch.ip = data.get('ip');
      }
      for (const [k, v] of [
        ['limitDown', 'limitDown'],
        ['limitUp', 'limitUp'],
      ]) {
        let n = Number(data.get(k) || 0);
        if (n !== (c[v] || 0)) patch[k] = n;
      }
      let blocked = data.get('blocked') === 'on';
      if (blocked !== !!c.blocked) patch.blocked = blocked;
      let priority = data.get('priority') === 'on';
      if (priority !== !!c.priority) patch.priority = priority;
      if (data.has('wan') && data.get('wan') !== (c.wan || '')) patch.wan = data.get('wan');
      let ip = data.get('ip');
      if (
        data.get('static') === 'on' &&
        (!NP.validate.ip(ip) || !findIface(c) || !NP.validate.inSubnet(ip, findIface(c).cidr))
      ) {
        err.textContent = 'Geçerli, cihazın ağı içinde bir IP adresi girin.';
        return;
      }
      b.disabled = true;
      b.textContent = 'Kaydediliyor…';
      try {
        await NP.setClient(c.mac, patch);
        await loadData();
        toast('Kaydedildi');
        let updated = state.clients.find((x) => x.mac === c.mac);
        if (updated) drawClient(updated);
      } catch (x) {
        err.textContent = x.message;
      } finally {
        let now = document.querySelector('.drawer-foot button[type=submit]');
        if (now) {
          now.disabled = false;
          now.textContent = 'Kaydet';
        }
      }
      return;
    }
    if (f.id === 'wifi-form') {
      let b = document.querySelector('.drawer-foot button[type=submit]'),
        err = document.getElementById('wifi-error'),
        section = f.dataset.section,
        old = state.networks.wifi.find((w) => w.section === section),
        ssid = f.elements.ssid.value,
        key = f.elements.key.value;
      err.textContent = '';
      if (!NP.validate.ssid(ssid)) {
        err.textContent = 'Ağ adı 1–32 bayt arasında olmalıdır.';
        return;
      }
      if (old.encryption !== 'none' && !NP.validate.wifiKey(key)) {
        err.textContent = 'Wi-Fi şifresi 8–63 karakter olmalıdır.';
        return;
      }
      let patch = {};
      if (ssid !== old.ssid) patch.ssid = ssid;
      if (old.encryption !== 'none' && key !== old.key) patch.key = key;
      b.disabled = true;
      b.textContent = 'Kaydediliyor…';
      try {
        await NP.setWifi(section, patch);
        await loadData();
        document.getElementById('drawer-host').replaceChildren();
        state.drawerWifi = null;
        toast('Wi-Fi ayarları kaydedildi');
      } catch (x) {
        err.textContent = x.message;
      } finally {
        let now = document.querySelector('.drawer-foot button[type=submit]');
        if (now) {
          now.disabled = false;
          now.textContent = 'Kaydet';
        }
      }
    }
  });
  root.addEventListener('click', async (e) => {
    let b = e.target.closest(
      'button,a,[data-start-speed],[data-apply-recommend],[data-save-sqm],[data-delete-sqm],[data-add-sqm],[data-gaming-mode],[data-disable-offload],[data-show-priority]',
    );
    if (!b) return;
    if (b.matches('[data-start-speed]')) {
      try {
        let wan = document.getElementById('speed-wan')?.value || 'all',
          mode = wan === 'all-combined' ? 'combined' : wan === 'all' ? 'sequential' : 'single';
        if (mode !== 'single') wan = 'all';
        let server = state.speedServer || document.getElementById('speed-server')?.value || '';
        await NP.startSpeedtest(wan, mode, server);
        if (state.speedTimer) clearInterval(state.speedTimer);
        state.speedTimer = setInterval(async () => {
          if (state.page !== '/speed') {
            clearInterval(state.speedTimer);
            state.speedTimer = null;
            return;
          }
          try {
            state.speed = await NP.getSpeedtest();
            let r = state.speed;
            state.speedHistory = r.history || state.speedHistory;
            if (r.current?.running || r.current?.phase === 'done' || r.current?.phase === 'error') {
              state.speed = r.current;
              let content = document.getElementById('content');
              if (content) content.innerHTML = speedPage();
              if (!r.current?.running) {
                clearInterval(state.speedTimer);
                state.speedTimer = null;
              }
            }
          } catch (err) {
            state.speed = { current: { phase: 'error', error: err.message } };
            let content = document.getElementById('content');
            if (content) content.innerHTML = speedPage();
          }
        }, 1000);
        state.speed = { current: { running: true, phase: 'starting' } };
        render();
      } catch (err) {
        state.speed = { current: { phase: 'error', error: err.message } };
        render();
      }
      return;
    }
    if (b.matches('[data-apply-recommend]')) {
      let c = state.speed?.current || state.speed,
        wan = c?.wan || document.getElementById('speed-wan')?.value,
        q = state.sqm?.queues?.find((x) => x.wan === wan);
      try {
        if (q)
          await NP.setSqm(q.section, {
            enabled: true,
            downloadMbit: c.recommendDownMbit,
            uploadMbit: c.recommendUpMbit,
          });
        else
          await NP.setSqm('', {
            interface: state.sqm?.wans?.find((x) => x.name === wan)?.device || wan,
            enabled: true,
            downloadMbit: c.recommendDownMbit,
            uploadMbit: c.recommendUpMbit,
            ...NP.SQM_PRESETS.fiber_pppoe,
          });
        state.sqm = await NP.getSqm();
        toast('SQM önerisi uygulandı');
        render();
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    if (b.matches('[data-save-sqm]')) {
      let section = b.dataset.saveSqm;
      try {
        let input = (s) => document.querySelector(`[data-sqm-${s}="${CSS.escape(section)}"]`);
        await NP.setSqm(section, {
          enabled: !!input('enabled')?.checked,
          downloadMbit: Number(input('down')?.value || 0),
          uploadMbit: Number(input('up')?.value || 0),
          script: input('script')?.value,
          linklayer: input('link')?.value,
          overhead: Number(input('overhead')?.value || 0),
        });
        state.sqm = await NP.getSqm();
        toast('SQM kaydedildi');
        render();
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    if (b.matches('[data-delete-sqm]')) {
      if (!confirm('Bu SQM kuyruğu silinsin mi?')) return;
      try {
        await NP.deleteSqm(b.dataset.deleteSqm);
        state.sqm = await NP.getSqm();
        render();
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    if (b.matches('[data-add-sqm]')) {
      try {
        await NP.setSqm('', { interface: b.dataset.addSqm, enabled: true, ...NP.SQM_PRESETS.fiber_pppoe });
        state.sqm = await NP.getSqm();
        render();
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    if (b.matches('[data-gaming-mode]')) {
      let q = state.sqm?.queues?.find((x) => x.enabled) || state.sqm?.queues?.[0];
      if (q)
        try {
          await NP.setSqm(q.section, { script: 'layer_cake.qos' });
          state.sqm = await NP.getSqm();
          render();
        } catch (err) {
          toast(err.message);
        }
      return;
    }
    if (b.matches('[data-disable-offload]')) {
      if (!confirm('Flow offloading kapatılacak. İşlemci kullanımı biraz artabilir; cihaz hızları ve hız sınırları tam çalışır. Devam edilsin mi?')) return;
      try {
        await NP.setOffload(false);
        state.status.offload = false;
        toast('Flow offloading kapatıldı');
        state.sqm = await NP.getSqm().catch(() => state.sqm);
        render();
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    if (b.matches('[data-show-priority]')) {
      state.showAllPriority = true;
      render();
    }
  });
  root.addEventListener('change', async (e) => {
    let el = e.target;
    if (el.matches('[data-offload]')) {
      let enabled = el.checked;
      if (!confirm(`Flow offloading ${enabled ? 'a\u00e7\u0131lacak' : 'kapat\u0131lacak'}. De\u011fi\u015fiklik uygulans\u0131n m\u0131?`)) {
        el.checked = !enabled;
        return;
      }
      try {
        await NP.setOffload(enabled);
        state.status.offload = enabled;
        state.sqm = await NP.getSqm();
        render();
      } catch (err) {
        el.checked = !enabled;
        toast(err.message);
      }
      return;
    }
    if (el.id === 'speed-wan') {
      state.speedSel = el.value; // yeniden çizimlerde seçim korunur
      let hint = document.getElementById('speed-mode-hint');
      if (hint) hint.textContent = speedModeHint(el.value);
      return;
    }
    if (el.id === 'speed-server') {
      state.speedServer = el.value; // yeniden çizimlerde sunucu seçimi korunur
      return;
    }
    if (el.matches('[data-priority]')) {
      try {
        await NP.setClient(el.dataset.priority, { priority: el.checked });
        let c = state.clients.find((x) => x.mac === el.dataset.priority);
        if (c) c.priority = el.checked;
        toast('Öncelik güncellendi');
      } catch (err) {
        el.checked = !el.checked;
        toast(err.message);
      }
      return;
    }
    if (el.matches('[data-sqm-enabled]')) {
      try {
        await NP.setSqm(el.dataset.sqmEnabled, { enabled: el.checked });
        state.sqm = await NP.getSqm();
        render();
      } catch (err) {
        el.checked = !el.checked;
        toast(err.message);
      }
      return;
    }
    if (el.matches('[data-sqm-preset]')) {
      let p = NP.SQM_PRESETS[el.value];
      if (p) {
        let s = CSS.escape(el.dataset.sqmPreset),
          link = document.querySelector(`[data-sqm-link="${s}"]`),
          over = document.querySelector(`[data-sqm-overhead="${s}"]`);
        if (link) link.value = p.linklayer;
        if (over) over.value = p.overhead;
      }
    }
  });
  // Huawei Wi-Fi ayarları + kanal analizi
  root.addEventListener('click', async (e) => {
    let b = e.target.closest('[data-hw-edit],[data-hw-scan],[data-hw-apply],[data-hw-reveal],[data-hw-reload]');
    if (!b) return;
    if (b.matches('[data-hw-edit]')) return drawHwWifi(b.dataset.hwEdit);
    if (b.matches('[data-hw-scan]')) return runHwScan();
    if (b.matches('[data-hw-reload]')) {
      state.hwWifiError = '';
      return loadHwWifi(true);
    }
    if (b.matches('[data-hw-reveal]')) {
      let i = b.parentElement.querySelector('input');
      i.type = i.type === 'password' ? 'text' : 'password';
      b.textContent = i.type === 'password' ? 'Göster' : 'Gizle';
      return;
    }
    if (b.matches('[data-hw-apply]')) {
      let band = b.dataset.hwApply,
        ch = +b.dataset.ch;
      if (!confirm(`${band === '2g' ? '2,4' : '5'} GHz kanalı ${ch} yapılacak; bu banda bağlı cihazlar birkaç saniye kopacak. Devam edilsin mi?`)) return;
      b.disabled = true;
      b.textContent = 'Uygulanıyor…';
      try {
        await NP.saveHuaweiWifi(band, { channel: ch });
        toast(`Kanal ${ch} uygulandı`);
        await loadHwWifi(true);
      } catch (x) {
        toast(x.message);
        b.disabled = false;
        b.textContent = `Kanal ${dat(ch)} geç`;
      }
    }
  });
  root.addEventListener('submit', (e) => {
    if (e.target.id === 'hw-wifi-form') saveHwWifi(e.target);
  });
  // Keenetic tarzı ekler: istatistik, yeni cihaz, saat planı, saat dilimi, bildirim, yedek, Cloudflare
  const xBusy = (b, txt) => {
    b.disabled = true;
    let old = b.textContent;
    b.textContent = txt;
    return () => {
      b.disabled = false;
      b.textContent = old;
    };
  };
  const xErr = (id, msg) => {
    let el = document.getElementById(id);
    if (el) el.textContent = msg || '';
    else if (msg) toast(msg);
  };
  root.addEventListener('click', async (e) => {
    let b = e.target.closest(
      '[data-x-days],[data-x-hours],[data-x-adays],[data-x-ack],[data-x-block],[data-x-day],[data-x-preset],[data-x-addrule],[data-x-delrule],[data-x-savesched],[data-x-savetz],[data-x-testnotify],[data-x-backup],[data-x-restore],[data-x-cflookup],[data-x-cfback],[data-x-cfsvc],[data-x-cfpublish],[data-x-cftoken]',
    );
    if (!b) return;
    e.preventDefault();
    let d = b.dataset;
    // istatistik dönemi
    if (d.xAdays) {
      state.stats.adays = +d.xAdays;
      state.xApps = null;
      return render();
    }
    if (d.xDays || d.xHours) {
      state.stats = state.stats || { days: 30, hours: 24 };
      if (d.xDays) {
        state.stats.days = +d.xDays;
        state.xUsage = null;
      } else {
        state.stats.hours = +d.xHours;
        state.xPing = null;
      }
      return render();
    }
    // yeni cihazlar
    if (b.matches('[data-x-ack]')) {
      try {
        await NP.ackNewDevices();
        state.xNewdev = null;
        render();
      } catch (x) {
        toast(x.message);
      }
      return;
    }
    if (d.xBlock) {
      let done = xBusy(b, 'Engelleniyor…');
      try {
        await NP.setClient(d.xBlock, { blocked: true });
        (state.xBlocked = state.xBlocked || {})[d.xBlock] = true;
        state.clients = await NP.getClients();
        toast('Cihaz engellendi');
        render();
      } catch (x) {
        done();
        toast(x.message);
      }
      return;
    }
    // saat planı
    if (d.xDay) return b.classList.toggle('active');
    if (d.xPreset) {
      document.querySelectorAll('#x-days [data-x-day]').forEach((c) => c.classList.toggle('active', d.xPreset.includes(c.dataset.xDay)));
      return;
    }
    if (b.matches('[data-x-addrule]')) {
      let days = [...document.querySelectorAll('#x-days .active')].map((c) => +c.dataset.xDay).sort();
      let from = document.getElementById('x-from').value,
        to = document.getElementById('x-to').value;
      if (!days.length) return xErr('x-sched-error', 'En az bir gün seçin');
      if (!/^\d\d:\d\d$/.test(from) || !/^\d\d:\d\d$/.test(to) || from === to)
        return xErr('x-sched-error', 'Başlangıç ve bitiş saati farklı olmalı');
      if (state.schedDraft.rules.length >= 8) return xErr('x-sched-error', 'En fazla 8 plan eklenebilir');
      let r = NP.parseSchedule(days.join('') + '|' + from + '|' + to);
      state.schedDraft.rules.push(r);
      return redrawSched();
    }
    if (d.xDelrule != null) {
      state.schedDraft.rules.splice(+d.xDelrule, 1);
      return redrawSched();
    }
    if (d.xSavesched) {
      let done = xBusy(b, 'Kaydediliyor…');
      try {
        await NP.setClient(d.xSavesched, { schedule: state.schedDraft.rules.map((r) => ({ days: r.days, from: r.from, to: r.to })) });
        state.clients = await NP.getClients();
        state.schedDraft = null;
        toast('Saat planı kaydedildi');
        let c = state.clients.find((x) => x.mac === d.xSavesched);
        if (c) drawClient(c);
      } catch (x) {
        done();
        xErr('x-sched-error', x.message);
      }
      return;
    }
    // saat dilimi
    if (b.matches('[data-x-savetz]')) {
      let done = xBusy(b, 'Kaydediliyor…');
      try {
        await NP.setTimezone(document.getElementById('x-tz').value);
        state.xTz = null;
        toast('Saat dilimi kaydedildi');
        render();
      } catch (x) {
        done();
        toast(x.message);
      }
      return;
    }
    if (b.matches('[data-x-testnotify]')) {
      let done = xBusy(b, 'Gönderiliyor…');
      try {
        await NP.testNotify();
        toast('Test mesajı gönderildi — Telegram’ı kontrol edin');
        xErr('x-notify-error', '');
      } catch (x) {
        xErr('x-notify-error', x.message);
      }
      return done();
    }
    // yedek
    if (b.matches('[data-x-backup]')) {
      let done = xBusy(b, 'Hazırlanıyor…');
      try {
        let r = await NP.downloadBackup();
        toast(`${r.name} indirildi (${NP.fmt.bytes(r.size)})`);
        xErr('x-backup-error', '');
      } catch (x) {
        xErr('x-backup-error', x.message);
      }
      return done();
    }
    if (b.matches('[data-x-restore]')) {
      let f = document.getElementById('x-restore-file').files[0];
      if (!f) return xErr('x-backup-error', 'Önce bir yedek dosyası seçin');
      if (!confirm(`"${f.name}" geri yüklenecek. Mevcut tüm ayarlar bu yedektekilerle değişecek ve router yeniden başlayacak (~1 dakika). Devam edilsin mi?`)) return;
      let done = xBusy(b, 'Yükleniyor…');
      try {
        await NP.restoreBackup(f);
        toast('Yedek yüklendi, router yeniden başlıyor…');
        xErr('x-backup-error', 'Router yeniden başlıyor; yaklaşık 1 dakika sonra sayfayı yenileyin.');
      } catch (x) {
        done();
        xErr('x-backup-error', x.message);
      }
      return;
    }
    // Cloudflare Tunnel
    let cf = (state.cf = state.cf || {});
    const cfSave = () => {
      let g = (id) => document.getElementById(id);
      if (g('x-cf-sub')) cf.sub = g('x-cf-sub').value.trim();
      if (g('x-cf-svc')) cf.svc = g('x-cf-svc').value.trim();
      if (g('x-cf-email')) cf.email = g('x-cf-email').value.trim();
      if (g('x-cf-zone')) cf.zone = g('x-cf-zone').value;
    };
    if (b.matches('[data-x-cflookup]')) {
      let tok = document.getElementById('x-cf-api').value.trim();
      if (!tok) return xErr('x-cf-error', 'API token yapıştırın');
      let done = xBusy(b, 'Hesap okunuyor…');
      try {
        cf.apiToken = tok; // yalnız bu sayfa açıkken bellekte tutulur
        cf.lookup = await NP.cfLookup(tok);
        if (!cf.lookup.zones.length) throw new Error('Bu token ile erişilebilen alan adı yok (Zone · Zone · Read izni gerekli).');
        cf.error = '';
        render();
      } catch (x) {
        cf.lookup = null;
        done();
        xErr('x-cf-error', x.message);
      }
      return;
    }
    if (b.matches('[data-x-cfback]')) {
      cfSave();
      cf.lookup = null;
      cf.result = null;
      return render();
    }
    if (d.xCfsvc) {
      document.getElementById('x-cf-svc').value = d.xCfsvc;
      return;
    }
    if (b.matches('[data-x-cfpublish]')) {
      cfSave();
      let zoneSel = document.getElementById('x-cf-zone'),
        opt = zoneSel.selectedOptions[0],
        access = document.getElementById('x-cf-accesson').checked;
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(cf.sub)) return xErr('x-cf-error', 'Alt alan adı yalnız harf, rakam ve tire içerebilir');
      if (!/^https?:\/\/[^\s/]+(:\d+)?\/?$/.test(cf.svc)) return xErr('x-cf-error', 'Hedef ör. http://192.168.1.1:80 biçiminde olmalı');
      if (access && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cf.email)) return xErr('x-cf-error', 'Access için geçerli bir e-posta girin');
      if (!access && !confirm('Access koruması kapalı: adresi bilen herkes giriş ekranına ulaşabilir. Yine de yayınlansın mı?')) return;
      let host = `${cf.sub}.${opt.textContent}`;
      let done = xBusy(b, 'Yayınlanıyor…');
      try {
        cf.result = await NP.cfPublish({
          apiToken: cf.apiToken,
          accountId: opt.dataset.acc,
          zoneId: zoneSel.value,
          subdomain: cf.sub,
          service: cf.svc,
          accessEmail: access ? cf.email : '',
        });
        cf.error = '';
        cf.apiToken = ''; // iş bitti, token'ı bellekten de at
        cf.lookup = null;
        toast(`${host} yayında`);
        state.xTunnel = null;
        render();
      } catch (x) {
        done();
        xErr('x-cf-error', x.message);
      }
      return;
    }
    if (b.matches('[data-x-cftoken]')) {
      let inp = document.getElementById('x-cf-token'),
        tok = inp.value.trim();
      if (!/^eyJ[A-Za-z0-9+/=_-]{40,}$/.test(tok)) return xErr('x-cf-error', 'Bu bir tünel token’ı gibi görünmüyor (eyJ… ile başlamalı)');
      let done = xBusy(b, 'Bağlanıyor…');
      try {
        await NP.setTunnelToken(tok);
        inp.value = '';
        toast('Tünel token’ı kaydedildi, cloudflared başlatılıyor');
        state.xTunnel = null;
        render();
      } catch (x) {
        done();
        xErr('x-cf-error', x.message);
      }
    }
  });
  function redrawSched() {
    let c = state.clients.find((x) => x.mac === state.schedDraft?.mac);
    let old = document.querySelector('#drawer-host .x-sched');
    if (!c || !old) return;
    let days = [...old.querySelectorAll('#x-days .active')].map((x) => x.dataset.xDay),
      from = old.querySelector('#x-from').value,
      to = old.querySelector('#x-to').value;
    old.remove();
    injectSchedule(c);
    let sec = document.querySelector('#drawer-host .x-sched');
    sec.querySelectorAll('#x-days [data-x-day]').forEach((x) => x.classList.toggle('active', days.includes(x.dataset.xDay)));
    sec.querySelector('#x-from').value = from;
    sec.querySelector('#x-to').value = to;
  }
  root.addEventListener('change', async (e) => {
    let t = e.target;
    if (!t.matches('[data-x-cfenable]')) return;
    t.disabled = true;
    try {
      await NP.setTunnelEnabled(t.checked);
      toast(t.checked ? 'Tünel açıldı' : 'Tünel kapatıldı');
      state.xTunnel = null;
      render();
    } catch (x) {
      t.checked = !t.checked;
      t.disabled = false;
      toast(x.message);
    }
  });
  root.addEventListener('submit', async (e) => {
    if (e.target.id !== 'x-notify-form') return;
    e.preventDefault();
    let f = e.target,
      btn = f.querySelector('[type=submit]'),
      v = (n) => f.elements[n];
    let done = xBusy(btn, 'Kaydediliyor…');
    try {
      await NP.setNotify({
        enabled: v('enabled').checked,
        token: v('token').value.trim(),
        chatId: v('chatId').value.trim(),
        wan: v('wan').checked,
        newdev: v('newdev').checked,
        presence: v('presence').checked,
        system: v('system').checked,
        blockNew: v('blockNew').checked,
      });
      state.xNotify = null;
      state.xNewdev = null;
      toast('Bildirim ayarları kaydedildi');
      render();
    } catch (x) {
      done();
      xErr('x-notify-error', x.message);
    }
  });
  // Entegrasyonlar: aç/kapa, ayar penceresi
  root.addEventListener('change', async (e) => {
    let t = e.target;
    if (t.id === 'scan-ports') state.scanPorts = t.checked;
    if (t.matches('[data-upd-auto]')) {
      try {
        await NP.setAutoUpdate(t.checked);
        toast(t.checked ? 'Otomatik güncelleme açıldı' : 'Otomatik güncelleme kapatıldı');
        if (state.xUpd) state.xUpd.auto = t.checked;
      } catch (err) {
        t.checked = !t.checked;
        toast(err.message);
      }
      return;
    }
    if (!t.matches('[data-integ]')) return;
    let id = t.dataset.integ,
      on = t.checked,
      x = INTEGRATIONS.find((i) => i.id === id);
    try {
      if (id === 'tplink') {
        if (on) {
          state.integLocal = { ...state.integLocal, tplink: true };
          render();
          return openIntegDrawer('tplink');
        }
        if (!confirm('TP-Link bağlantısı kapatılsın mı? Cihaz çalışmaya devam eder, yalnız NetOS’tan yönetilmez.')) return (t.checked = true);
        await NP.setTplinkConfig({ enabled: false });
        state.integLocal = { ...state.integLocal, tplink: false };
        state.xTp = null;
        state.xInteg = null;
        toast('TP-Link bağlantısı kapatıldı');
        return render();
      }
      if (id === 'huawei') {
        // açınca önce ayar penceresi; bağlantı Kaydet ile etkinleşir (şifresiz deneme Huawei'yi kilitlemesin)
        if (on) {
          state.integLocal = { ...state.integLocal, huawei: true };
          render();
          return openIntegDrawer('huawei');
        }
        if (!confirm('Huawei bağlantısı kapatılsın mı? Huawei Wi-Fi’si çalışmaya devam eder, yalnız NetOS’tan yönetilmez.')) return (t.checked = true);
        await NP.setHuaweiConfig({ enabled: false });
        state.integLocal = { ...state.integLocal, huawei: false };
        state.huawei = await NP.getHuawei().catch(() => state.huawei);
      } else {
        if (!on && id === 'cloudflare' && state.xTunnel?.enabled) {
          if (confirm('Tünel şu an açık. Tünel de durdurulsun mu?\n\nTamam: tünel durur, dışarıdan erişim kesilir.\nİptal: tünel çalışmaya devam eder, yalnız bu bölüm gizlenir.')) await NP.setTunnelEnabled(false);
          state.xTunnel = null;
        }
        if (id === 'adguard' && !on) {
          if (!confirm('AdGuard kapatılsın mı? Ağın DNS’i dnsmasq’a döner, reklam ve uygulama engelleme durur.')) return (t.checked = true);
          let ag = await NP.getAdguard().catch(() => null);
          if (ag?.active) await NP.enableAdguard(false);
        }
        if (id === 'vpn' && !on && state.xVpn?.configured && state.xVpn.enabled) {
          if (confirm('VPN sunucusu da kapatılsın mı?\n\nTamam: kimse bağlanamaz.\nİptal: VPN çalışmaya devam eder, yalnız menüden gizlenir.')) await NP.setVpn({ enabled: false });
          state.xVpn = null;
        }
        await NP.setIntegration(id, on);
        if (id === 'adguard' && on) {
          let ag = await NP.getAdguard().catch(() => null);
          state.xAg = ag;
          state.xInteg = await NP.getIntegrations().catch(() => null);
          render();
          if (ag?.configured && ag.creds && !ag.stats?.auth && !ag.active) await NP.enableAdguard(true).then(() => toast('Ağın DNS’i artık AdGuard’da'), (x) => toast(x.message));
          state.xAg = null;
          return openIntegDrawer('adguard');
        }
      }
      state.xInteg = null;
      toast(`${x.name} ${on ? 'etkinleştirildi' : 'kapatıldı'}`);
      if (id === 'scanner' && on) {
        state.xInteg = await NP.getIntegrations().catch(() => null);
        return render();
      }
      render();
      if (on && id === 'cloudflare') openIntegDrawer('cloudflare');
      if (on && id === 'vpn') location.hash = '#/vpn';
    } catch (err) {
      t.checked = !on;
      toast(err.message);
    }
  });
  root.addEventListener('input', (e) => {
    if (e.target.id === 'scan-search') {
      state.scanQuery = e.target.value;
      let rows = document.getElementById('scan-rows');
      if (rows && state.xScan?.result) rows.innerHTML = scanRowsHtml(state.xScan);
    }
    if (e.target.id === 'scan-range') state.scanRange = e.target.value;
  });
  root.addEventListener('submit', async (e) => {
    if (e.target.id !== 'scan-form') return;
    e.preventDefault();
    let range = document.getElementById('scan-range').value.trim();
    state.scanRange = range;
    if (range && !/^[\d.\s/-]+$/.test(range)) {
      state.scanStartError = 'Aralık anlaşılmadı. Örnek: 192.168.1.0/24, 192.168.1.10-50 ya da 192.168.1.20';
      return redrawScanner();
    }
    try {
      await NP.startScan({ ports: state.scanPorts !== false, range });
      state.scanFilter = 'all';
      state.scanStartError = '';
      state.xScan = await NP.getScan();
      state.xScanError = '';
    } catch (err) {
      state.scanStartError = err.message;
    }
    redrawScanner();
    pollScan();
  });
  root.addEventListener('click', async (e) => {
    // açık açılır menüleri dışarı tıklayınca kapat
    root.querySelectorAll('details.pop[open]').forEach((d) => {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
    let b = e.target.closest('[data-integ-open],[data-scan-filter],[data-scan-sort],[data-scan-csv],[data-copy],[data-wol],[data-upd-check],[data-upd-apply],[data-upd-close]');
    if (!b) return;
    let d = b.dataset;
    if (d.integOpen) return openIntegDrawer(d.integOpen);
    if (d.scanFilter) {
      state.scanFilter = d.scanFilter;
      return redrawScanner();
    }
    if (d.scanSort) {
      let s = state.scanSort || { key: 'ip', dir: 1 };
      state.scanSort = { key: d.scanSort, dir: s.key === d.scanSort ? -s.dir : 1 };
      return redrawScanner();
    }
    if (b.matches('[data-scan-csv]')) return scanCsv();
    if (d.copy) {
      e.preventDefault();
      b.closest('details')?.removeAttribute('open');
      return toast((await copyText(d.copy)) ? `Kopyalandı: ${d.copy}` : 'Kopyalanamadı');
    }
    if (d.wol) {
      b.closest('details')?.removeAttribute('open');
      try {
        await NP.wakeOnLan(d.wol);
        toast('Uyandırma paketi gönderildi');
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    if (b.matches('[data-upd-check]')) {
      b.disabled = true;
      b.textContent = 'Denetleniyor…';
      try {
        state.xUpd = await NP.getUpdate(true);
        state.xUpdError = '';
      } catch (err) {
        state.xUpdError = err.message;
      }
      return redrawUpdate();
    }
    if (b.matches('[data-upd-apply]')) {
      let v = state.xUpd?.latest;
      if (!confirm(`NetOS v${v} indirilip kurulacak. Ayarlarınız ve cihaz kayıtlarınız korunur; panel birkaç saniye erişilemez olur. Devam edilsin mi?`)) return;
      try {
        await NP.applyUpdate();
        state.updRun = { state: 'running', log: '' };
        redrawUpdate();
        pollUpdate();
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    if (b.matches('[data-upd-close]')) {
      state.updRun = null;
      state.xUpd = null;
      return redrawUpdate();
    }
  });
  // Tüm şifre alanlarına göz düğmesi (göster / gizle)
  function addEyes(scope) {
    scope.querySelectorAll('input[type=password]:not([data-eyed])').forEach((i) => {
      i.dataset.eyed = '1';
      let w = document.createElement('span');
      w.className = 'pw-wrap';
      i.replaceWith(w);
      w.append(i);
      w.insertAdjacentHTML('beforeend', `<button type="button" class="pw-eye" data-eye aria-label="Şifreyi göster" title="Şifreyi göster">${icon('eye')}</button>`);
    });
  }
  let eyeQueued = false;
  new MutationObserver(() => {
    if (eyeQueued) return;
    eyeQueued = true;
    queueMicrotask(() => {
      eyeQueued = false;
      addEyes(root);
    });
  }).observe(root, { childList: true, subtree: true });
  root.addEventListener('click', (e) => {
    let b = e.target.closest('[data-eye]');
    if (!b) return;
    e.preventDefault();
    let i = b.parentElement.querySelector('input');
    let show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    b.innerHTML = icon(show ? 'eyeOff' : 'eye');
    b.title = b.ariaLabel = show ? 'Şifreyi gizle' : 'Şifreyi göster';
  });
  // ── Ağ özellikleri: olaylar ──
  const reloadX = (key, page) => {
    state[key] = null;
    state[key + 'Error'] = '';
    if (state.page === page) render();
  };
  root.addEventListener('click', async (e) => {
    let b = e.target.closest(
      '[data-pkg],[data-pf-new],[data-pf-edit],[data-pf-del],[data-pf-preset],[data-pf-proto],[data-lan-confirm],[data-lan-revert],[data-vpn-add],[data-vpn-del],[data-copy-conf],[data-dl-conf],[data-wifi-qr],[data-qr-print],[data-qr-reset]',
    );
    if (!b) return;
    let d = b.dataset;
    if (d.pkg) {
      try {
        await NP.installPkg(d.pkg);
        state.pkgRun = { ...state.pkgRun, [d.pkg]: { running: true } };
        render();
        pollPkg(d.pkg, () => {
          state.xPf = state.xVpn = null;
          if (d.pkg === 'mwan3') NP.getWanConfig().then((c) => ((state.wanConfig = c), render())).catch(() => {});
          render();
        });
      } catch (x) {
        toast(x.message);
      }
      return;
    }
    if (b.matches('[data-pf-new]')) return openXPanel({ kind: 'pf' });
    if (d.pfEdit) return openXPanel({ kind: 'pf', rule: state.xPf?.rules.find((r) => r.id === d.pfEdit) });
    if (d.pfDel) {
      let r = state.xPf?.rules.find((x) => x.id === d.pfDel);
      if (!confirm(`"${r?.name || d.pfDel}" kuralı silinsin mi?`)) return;
      try {
        await NP.deletePortForward(d.pfDel);
        toast('Kural silindi');
      } catch (x) {
        toast(x.message);
      }
      return reloadX('xPf', '/ports');
    }
    if (d.pfPreset) {
      let [n, pr, port] = d.pfPreset.split('|'),
        f = document.getElementById('pf-form');
      if (!f.elements.name.value) f.elements.name.value = n;
      f.elements.extPort.value = port;
      f.elements.proto.value = pr;
      f.querySelectorAll('[data-pf-proto]').forEach((x) => x.classList.toggle('active', x.dataset.pfProto === pr));
      return;
    }
    if (d.pfProto) {
      let f = document.getElementById('pf-form');
      f.elements.proto.value = d.pfProto;
      f.querySelectorAll('[data-pf-proto]').forEach((x) => x.classList.toggle('active', x === b));
      return;
    }
    if (b.matches('[data-lan-confirm],[data-lan-revert]')) {
      let ok = b.matches('[data-lan-confirm]');
      try {
        await (ok ? NP.confirmLan() : NP.revertLan());
        state.lanPending = null;
        toast(ok ? 'Yeni adres onaylandı' : 'Eski ayara dönülüyor…');
        if (!ok && state.lanPrevIp) return setTimeout(() => (location.href = `http://${state.lanPrevIp}/netos/`), 2500);
      } catch (x) {
        toast(x.message);
      }
      state.xLan = null;
      return render();
    }
    if (b.matches('[data-vpn-add]')) return openXPanel({ kind: 'peer' });
    if (d.vpnDel) {
      let p = state.xVpn?.peers.find((x) => x.id === d.vpnDel);
      if (!confirm(`"${p?.name || ''}" VPN cihazı silinsin mi? Bu cihaz artık bağlanamaz.`)) return;
      try {
        await NP.deleteVpnPeer(d.vpnDel);
        toast('Cihaz silindi');
      } catch (x) {
        toast(x.message);
      }
      return reloadX('xVpn', '/vpn');
    }
    if (b.matches('[data-copy-conf]')) return toast((await copyText(state.xPanel?.result?.config || '')) ? 'Yapılandırma kopyalandı' : 'Kopyalanamadı');
    if (b.matches('[data-dl-conf]')) {
      let p = state.xPanel,
        url = URL.createObjectURL(new Blob([p.result.config], { type: 'text/plain' })),
        a = document.createElement('a');
      a.href = url;
      a.download = `netos-${(p.name || 'vpn').replace(/[^\w-]+/g, '-').slice(0, 20)}.conf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }
    if (d.wifiQr) {
      let bnd = state.hwWifi?.bands?.find((x) => x.band === d.wifiQr);
      return openXPanel({ kind: 'qr', ssid: bnd?.ssid || '', open: !!bnd?.open, bandLabel: bnd?.bandLabel || '' });
    }
    if (b.matches('[data-qr-reset]')) return openXPanel({ ...state.xPanel, svg: null });
    if (b.matches('[data-qr-print]')) {
      let p = state.xPanel,
        w = window.open('', '_blank', 'width=480,height=640');
      if (!w) return toast('Açılır pencere engellendi');
      w.document.write(`<!doctype html><meta charset="utf-8"><title>Wi-Fi</title><body style="font-family:system-ui;text-align:center;padding:24px"><h2>Wi-Fi: ${esc(p.ssid)}</h2><div style="width:300px;margin:auto">${p.svg}</div><p>Telefon kamerasıyla okutun</p><script>onload=()=>print()<\/script>`);
      w.document.close();
    }
  });
  root.addEventListener('change', async (e) => {
    let t = e.target;
    if (t.matches('[data-pf-toggle]')) {
      let r = state.xPf?.rules.find((x) => x.id === t.dataset.pfToggle);
      try {
        await NP.savePortForward({ ...r, enabled: t.checked });
        toast(t.checked ? 'Kural açıldı' : 'Kural kapatıldı');
      } catch (x) {
        t.checked = !t.checked;
        toast(x.message);
      }
      return reloadX('xPf', '/ports');
    }
    if (t.matches('[data-upnp]')) {
      try {
        await NP.setUpnp(t.checked);
        toast(t.checked ? 'UPnP açıldı' : 'UPnP kapatıldı');
      } catch (x) {
        t.checked = !t.checked;
        toast(x.message);
      }
      return reloadX('xPf', '/ports');
    }
    if (t.matches('[data-vpn-enable]')) {
      try {
        await NP.setVpn({ enabled: t.checked });
        toast(t.checked ? 'VPN açıldı' : 'VPN kapatıldı');
      } catch (x) {
        t.checked = !t.checked;
        toast(x.message);
      }
      return reloadX('xVpn', '/vpn');
    }
    if (t.closest('#pf-form') && t.name === 'dev') {
      let f = t.form;
      document.getElementById('pf-ip-wrap').hidden = !!t.value;
      if (t.value) f.elements.ip.value = t.value;
      document.getElementById('pf-static-hint').hidden = !state.clients.find((c) => c.ip === t.value && !c.static);
      return;
    }
    if (t.closest('#lan-form') && t.name === 'dnsPreset') {
      state.lanDns = t.value;
      document.querySelectorAll('.dns-opt').forEach((x) => x.classList.toggle('on', x.contains(t)));
      document.getElementById('dns-custom').hidden = t.value !== 'custom';
      return;
    }
    if (t.closest('#peer-form') && t.name === 'full') t.form.querySelectorAll('.dns-opt').forEach((x) => x.classList.toggle('on', x.contains(t)));
  });
  root.addEventListener('input', (e) => {
    let f = e.target.closest('#lan-form');
    if (f && (e.target.name === 'start' || e.target.name === 'limit' || e.target.name === 'ip')) {
      let pre = f.elements.ip.value.replace(/\.\d*$/, '.'),
        s = +f.elements.start.value,
        n = +f.elements.limit.value;
      let h = document.getElementById('lan-range');
      if (h) h.innerHTML = `Dağıtılan adresler: <b class="num">${esc(pre + s)} – ${esc(pre + (s + n - 1))}</b>${s + n - 1 > 254 ? ' <span class="warn-text">(254’ü aşamaz)</span>' : ''}`;
      document.querySelectorAll('.ip-suffix .num').forEach((x) => (x.textContent = pre));
    }
  });
  root.addEventListener('submit', async (e) => {
    let f = e.target,
      id = f.id;
    if (!['pf-form', 'lan-form', 'vpn-setup', 'vpn-ep', 'peer-form', 'qr-form'].includes(id)) return;
    e.preventDefault();
    let btn = f.querySelector('[type=submit]'),
      el = f.elements,
      err = (m) => {
        let x = f.querySelector('.form-error');
        if (x) x.textContent = m || '';
        else if (m) toast(m);
      };
    err('');
    let done = btn ? xBusy(btn, 'Kaydediliyor…') : () => {};
    try {
      if (id === 'pf-form') {
        let ip = el.dev.value || el.ip.value.trim();
        if (!NP.validate.ip(ip)) throw new Error('Geçerli bir hedef IP girin');
        await NP.savePortForward({ id: f.dataset.id, name: el.name.value.trim(), proto: el.proto.value, extPort: el.extPort.value.trim(), intPort: el.intPort.value.trim(), ip });
        state.xPanel = null;
        document.getElementById('drawer-host').replaceChildren();
        toast('Kural kaydedildi');
        return reloadX('xPf', '/ports');
      }
      if (id === 'lan-form') {
        let l = state.xLan,
          ip = el.ip.value.trim(),
          preset = el.dnsPreset.value,
          dns = preset === 'custom' ? el.dnsCustom.value.split(/[\s,]+/).filter(Boolean) : DNS_PRESETS.find((x) => x[0] === preset)[2];
        if (!NP.validate.ip(ip)) throw new Error('Geçerli bir IP adresi girin');
        if (dns.some((x) => !NP.validate.ip(x))) throw new Error('DNS adresleri geçersiz');
        let changed = ip !== l.ip;
        if (changed && !confirm(`Router adresi ${l.ip} → ${ip} olacak.\n\n1) Kaydedince bu sayfa bağlantıyı kaybeder.\n2) Bilgisayarınızın Wi-Fi’sini/kablosunu kapatıp açın.\n3) http://${ip}/netos/ adresinden girip ONAYLAYIN.\n\n3 dakika içinde onaylanmazsa eski ayara döner. Devam edilsin mi?`)) return done();
        if (!el.dhcpEnabled.checked && !confirm('DHCP kapatılınca yeni bağlanan cihazlar IP alamaz. Emin misiniz?')) return done();
        let r = await NP.setLan({ ip, dhcpEnabled: el.dhcpEnabled.checked, start: el.start.value, limit: el.limit.value, leasetime: el.leasetime.value, dns });
        state.lanDns = null;
        if (r.ipChanged) {
          state.lanPrevIp = l.ip;
          document.getElementById('content').innerHTML = `<section class="card lan-moving">${cardHead('router', 'Router adresi değişiyor')}<p>Yeni adres: <b class="num">${esc(r.newIp)}</b>${r.moved ? ` · ${r.moved} kayıt yeni ağa taşındı` : ''}</p><ol class="x-steps"><li>Bilgisayarınızın/telefonunuzun Wi-Fi’sini kapatıp açın (kabloluysa kabloyu çıkarıp takın).</li><li>Yeni adresi açın: <a href="http://${esc(r.newIp)}/netos/">http://${esc(r.newIp)}/netos/</a></li><li>Giriş yapın ve üstteki <b>Onayla</b> düğmesine basın.</li></ol><p class="field-hint">3 dakika içinde onaylanmazsa router eski adrese (${esc(l.ip)}) döner.</p></section>`;
          return;
        }
        toast('Yerel ağ ayarları kaydedildi');
        return reloadX('xLan', '/lan');
      }
      if (id === 'vpn-setup') {
        await NP.setupVpn({ port: el.port.value, endpoint: el.endpoint.value.trim() });
        toast('VPN sunucusu kuruldu');
        return setTimeout(() => reloadX('xVpn', '/vpn'), 1500);
      }
      if (id === 'vpn-ep') {
        await NP.setVpn({ enabled: state.xVpn.enabled, endpoint: el.endpoint.value.trim() });
        toast('Dış adres kaydedildi');
        return reloadX('xVpn', '/vpn');
      }
      if (id === 'peer-form') {
        let name = el.name.value.trim();
        let r = await NP.addVpnPeer(name, el.full.value === '1');
        state.xVpn = null;
        openXPanel({ kind: 'peer', name, result: r });
        if (state.page === '/vpn') loadX('xVpn', () => NP.getVpn(), '/vpn');
        return;
      }
      if (id === 'qr-form') {
        let ssid = el.ssid.value.trim(),
          pw = el.password?.value || '';
        if (!ssid) throw new Error('Ağ adı boş olamaz');
        if (!state.xPanel.open && pw.length < 8) throw new Error('Wi-Fi şifresi en az 8 karakter');
        let svg = await NP.qrSvg(NP.wifiQrText(ssid, pw, state.xPanel.open));
        return openXPanel({ ...state.xPanel, ssid, svg });
      }
    } catch (x) {
      err(x.message);
    }
    done();
  });
  // LAN onay geri sayımı
  setInterval(() => {
    let p = state.lanPending,
      el = document.getElementById('lan-left');
    if (!p) return;
    if (Date.now() > p.until) {
      state.lanPending = null;
      return render();
    }
    if (el) el.textContent = Math.max(0, Math.round((p.until - Date.now()) / 1000));
  }, 1000);
  // ── AdGuard, geldi/gitti, zamanlanmış test: olaylar ──
  root.addEventListener('click', async (e) => {
    let b = e.target.closest('[data-ag-svc],[data-ag-save],[data-ag-pause],[data-ag-enable]');
    if (!b) return;
    let d = b.dataset;
    if (d.agSvc) {
      let scope = b.closest('[data-ag-scope]').dataset.agScope,
        list = svcScopeSel(scope),
        i = list.indexOf(d.agSvc);
      if (i >= 0) list.splice(i, 1);
      else list.push(d.agSvc);
      b.classList.toggle('active', i < 0);
      b.setAttribute('aria-pressed', i < 0);
      return;
    }
    if (d.agSave) {
      let done = xBusy(b, 'Kaydediliyor…');
      try {
        if (d.agSave === 'global') {
          await NP.setAdguardGlobal(state.agGlobal || []);
          toast('Tüm ağ için engellenen uygulamalar kaydedildi');
        } else {
          let c = state.clients.find((x) => x.mac === d.agSave),
            dr = state.agDraft;
          let r = await NP.setAdguardClient(c.mac, c.ip, c.displayName, dr);
          state.agClient = { ...state.agClient, [c.mac]: { ...dr, custom: r.custom } };
          state.agDraft = null;
          toast(r.custom ? 'İçerik filtresi kaydedildi' : 'Cihaz ağın genel ayarlarına döndü');
          redrawAgClient();
        }
      } catch (x) {
        toast(x.message);
      }
      return done();
    }
    if (d.agPause) {
      try {
        await NP.setAdguardProtection(false, +d.agPause);
        toast(`Koruma ${d.agPause === '60' ? '1 saat' : d.agPause + ' dakika'} durduruldu`);
      } catch (x) {
        toast(x.message);
      }
      state.xAg = null;
      return render();
    }
    if (b.matches('[data-ag-enable]')) {
      let done = xBusy(b, 'Açılıyor…');
      try {
        await NP.enableAdguard(true);
        await NP.setIntegration('adguard', true);
        toast('Ağın DNS’i artık AdGuard’da');
      } catch (x) {
        toast(x.message);
      }
      done();
      state.xAg = state.xInteg = null;
      return render();
    }
  });
  root.addEventListener('change', async (e) => {
    let t = e.target;
    if (t.matches('[data-agc]')) {
      if (state.agDraft) state.agDraft[t.dataset.agc] = t.checked;
      return;
    }
    if (t.matches('[data-presence]')) {
      try {
        await NP.setClient(t.dataset.presence, { presence: t.checked });
        let c = state.clients.find((x) => x.mac === t.dataset.presence);
        if (c) c.presence = t.checked;
        toast(t.checked ? 'Geldi/gitti bildirimi açıldı' : 'Geldi/gitti bildirimi kapatıldı');
      } catch (x) {
        t.checked = !t.checked;
        toast(x.message);
      }
      return;
    }
    if (t.matches('[data-ag-protect]')) {
      try {
        await NP.setAdguardProtection(t.checked);
        toast(t.checked ? 'Koruma açıldı' : 'Koruma kapatıldı');
      } catch (x) {
        t.checked = !t.checked;
        toast(x.message);
      }
      state.xAg = null;
      return render();
    }
  });
  root.addEventListener('submit', async (e) => {
    let f = e.target;
    if (!['ag-setup', 'ag-connect', 'st-sched'].includes(f.id)) return;
    e.preventDefault();
    let btn = f.querySelector('[type=submit]'),
      err = (m) => {
        let x = f.querySelector('.form-error');
        if (x) x.textContent = m || '';
        else if (m) toast(m);
      };
    err('');
    let done = xBusy(btn, f.id === 'ag-setup' ? 'Kuruluyor… (1 dk sürebilir)' : 'Kaydediliyor…');
    try {
      if (f.id === 'ag-setup') {
        if (f.elements.password.value !== f.elements.password2.value) throw new Error('Şifreler aynı değil');
        await NP.setupAdguard(f.elements.password.value);
        await NP.setIntegration('adguard', true);
        toast('AdGuard Home kuruldu, ağın DNS’i artık AdGuard’da');
        state.xAg = state.xInteg = null;
        return render();
      }
      if (f.id === 'ag-connect') {
        await NP.connectAdguard(f.elements.user.value.trim(), f.elements.password.value);
        toast('AdGuard’a bağlanıldı');
        state.xAg = null;
        return render();
      }
      if (f.id === 'st-sched') {
        await NP.setSpeedSchedule({ enabled: f.elements.enabled.checked, hour: f.elements.hour.value, wan: f.elements.wan.value });
        toast(f.elements.enabled.checked ? `Her gün ${String(f.elements.hour.value).padStart(2, '0')}:00’da hız testi yapılacak` : 'Zamanlanmış test kapatıldı');
        state.xStSched = null;
        return done();
      }
    } catch (x) {
      err(x.message);
    }
    done();
  });
  // ── Güvenlik duvarı + anlık bağlantılar: olaylar ──
  root.addEventListener('click', (e) => {
    let b = e.target.closest('[data-conns]');
    if (b) loadConns(b.dataset.conns);
  });
  root.addEventListener('change', async (e) => {
    let t = e.target;
    if (!t.matches('[data-fw-ping]')) return;
    try {
      await NP.setFirewall({ ping: t.checked });
      toast(t.checked ? 'Ping’e yanıt veriliyor' : 'Router internetten ping’e yanıt vermiyor');
    } catch (x) {
      t.checked = !t.checked;
      toast(x.message);
    }
  });
  root.addEventListener('submit', async (e) => {
    if (e.target.id !== 'dmz-form') return;
    e.preventDefault();
    let ip = e.target.elements.dmz.value;
    if (ip && !confirm(`${ip} adresli cihaz internete tamamen açılacak (DMZ). Emin misiniz?`)) return;
    try {
      await NP.setFirewall({ dmzIp: ip });
      toast(ip ? `DMZ: ${ip}` : 'DMZ kapatıldı');
    } catch (x) {
      toast(x.message);
    }
    state.xPf = null;
    render();
  });
  // ── TP-Link: olaylar ──
  root.addEventListener('change', async (e) => {
    let t = e.target;
    if (!t.matches('[data-tp-band]')) return;
    t.disabled = true;
    try {
      await NP.setTplinkBand(t.dataset.tpBand, t.checked);
      toast(`TP-Link ${t.checked ? 'açıldı' : 'kapatıldı'}`);
    } catch (x) {
      t.checked = !t.checked;
      toast(x.message);
    }
    state.xTp = null;
    render();
  });
  root.addEventListener('click', (e) => {
    let b = e.target.closest('[data-tp-edit]');
    if (b) openXPanel({ kind: 'tpwifi', band: b.dataset.tpEdit });
  });
  root.addEventListener('submit', async (e) => {
    let f = e.target;
    if (f.id !== 'tp-form' && f.id !== 'tp-wifi-form') return;
    e.preventDefault();
    let btn = f.querySelector('[type=submit]'),
      done = xBusy(btn, f.id === 'tp-form' ? 'Bağlanıyor…' : 'Kaydediliyor…'),
      er = f.querySelector('.form-error');
    er.textContent = '';
    try {
      if (f.id === 'tp-form') {
        await NP.setTplinkConfig({ host: f.elements.host.value.trim(), username: f.elements.username.value, password: f.elements.password.value, enabled: true });
        state.xTp = await NP.getTplink();
        state.xInteg = null;
        toast(state.xTp.connected ? 'TP-Link’e bağlanıldı' : 'Ayarlar kaydedildi; bağlantı kurulamadı');
        render();
        return;
      }
      await NP.saveTplinkWifi(f.dataset.band, { ssid: f.elements.ssid.value.trim(), password: f.elements.password.value });
      state.xPanel = null;
      state.xTp = null;
      document.getElementById('drawer-host').replaceChildren();
      toast('TP-Link Wi-Fi ayarları kaydedildi');
      render();
      return;
    } catch (x) {
      er.textContent = x.message;
    }
    done();
  });
  // ── Giriş koruması: olaylar ──
  root.addEventListener('click', async (e) => {
    let b = e.target.closest('[data-unban]');
    if (!b) return;
    try {
      await NP.unbanIp(b.dataset.unban);
      toast('Kilit kaldırıldı');
    } catch (x) {
      toast(x.message);
    }
    state.xLock = null;
    render();
  });
  root.addEventListener('change', async (e) => {
    let t = e.target;
    if (!t.matches('[data-strict]')) return;
    if (t.checked && !confirm('Sıkı mod açılsın mı? Home Assistant gibi ubus üzerinden bağlanan uygulamalar giriş yapamaz.')) return (t.checked = false);
    try {
      await NP.setStrictLogin(t.checked);
      toast(t.checked ? 'Sıkı giriş modu açıldı' : 'Sıkı giriş modu kapatıldı');
    } catch (x) {
      t.checked = !t.checked;
      toast(x.message);
    }
    state.xSec = null;
  });
  // ── Güvenlik / bakım / günlük / sihirbaz: olaylar ──
  root.addEventListener('change', async (e) => {
    let t = e.target;
    if (t.id === 'idle-min') {
      try {
        localStorage.setItem(IDLE_KEY, t.value);
      } catch (_) {}
      return toast(+t.value ? `${t.value} dakika işlem yapılmazsa oturum kapanacak` : 'Otomatik oturum kapatma kapalı');
    }
    if (t.matches('[data-https]')) {
      if (t.checked && !confirm('Panel bundan sonra https:// ile açılacak; tarayıcı ilk girişte sertifika uyarısı gösterir. Sayfa birkaç saniye içinde yeni adrese geçecek. Devam edilsin mi?')) return (t.checked = false);
      try {
        await NP.setHttpsRedirect(t.checked);
        toast(t.checked ? 'HTTPS açılıyor…' : 'HTTPS yönlendirmesi kapatıldı');
        if (t.checked && location.protocol === 'http:') setTimeout(() => (location.href = `https://${location.host}${location.pathname}${location.hash}`), 3500);
      } catch (x) {
        t.checked = !t.checked;
        toast(x.message);
      }
      state.xSec = null;
      return;
    }
    if (t.closest('#sysopt-form') && t.name === 'rebootMode') {
      document.getElementById('reboot-when').hidden = t.value === 'off';
      document.getElementById('reboot-day').hidden = t.value !== 'weekly';
      return;
    }
    if (t.id === 'log-auto') {
      state.logAuto = t.checked;
      clearInterval(state.logTimer);
      if (t.checked)
        state.logTimer = setInterval(async () => {
          if (state.page !== '/logs') return clearInterval(state.logTimer);
          try {
            state.xLog = await NP.getLog(state.logF);
            let el = document.getElementById('log-list'),
              atEnd = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            render();
            if (atEnd) scrollLogEnd();
          } catch (_) {}
        }, 4000);
    }
  });
  root.addEventListener('click', async (e) => {
    let b = e.target.closest('[data-log-level],[data-log-dl],[data-wiz-next],[data-wiz-back],[data-wiz-tz],[data-wiz-wan],[data-wiz-upd],[data-wiz-finish]');
    if (!b) return;
    let d = b.dataset;
    if (d.logLevel != null) {
      state.logF.level = d.logLevel;
      return reloadLog();
    }
    if (b.matches('[data-log-dl]')) {
      let txt = (state.xLog || []).map((l) => `${l.time} ${l.facility}.${l.level} ${l.text}`).join('\n');
      let url = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })),
        a = document.createElement('a');
      a.href = url;
      a.download = `netos-gunluk-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    let go = (n) => {
      state.wizStep = n;
      render();
    };
    let step = state.wizStep || (state.xSec?.rootPwEmpty ? 1 : 2);
    if (b.matches('[data-wiz-next]')) return go(step + 1);
    if (b.matches('[data-wiz-back]')) return go(Math.max(1, step - 1));
    if (b.matches('[data-wiz-tz]')) {
      let done = xBusy(b, 'Kaydediliyor…');
      try {
        let z = document.getElementById('wiz-tz')?.value;
        if (z && z !== state.xTz?.zone) await NP.setTimezone(z);
        state.xTz = null;
        return go(3);
      } catch (x) {
        toast(x.message);
      }
      return done();
    }
    if (b.matches('[data-wiz-wan]')) {
      let c = state.wanConfig || {},
        wans = wanList(),
        n = state.wizWan || (wans.length >= 2 ? 2 : 1),
        er = document.getElementById('wiz-error'),
        done = xBusy(b, 'Uygulanıyor…'),
        pr = document.getElementById('wiz-primary')?.value;
      try {
        let changed = false;
        if (n === 1 && wans.length >= 2 && (c.mode !== 'single' || c.primary !== pr)) {
          await NP.setWanMode('single', pr);
          changed = true;
        } else if (n === 2 && wans.length >= 2) {
          let m = document.querySelector('[name=wizmode]:checked')?.value || 'failover';
          if (m !== c.mode || pr !== c.primary) {
            await NP.setWanMode(m, pr);
            changed = true;
          }
        } else if (n === 2) {
          let f = document.getElementById('wiz-wan-form');
          if (!f) throw new Error(c.mwan3 ? 'Boş bir port gerekli' : 'Önce mwan3 paketini kurun');
          let r = await NP.addWan(readAddWan(f));
          state.wanAddF = null;
          state.xPorts = null;
          toast(`${r.name} eklendi`);
          changed = true;
        }
        // yerel ağdan bağlıyız; panel yanıt veriyorsa değişikliği onayla (geri alma iptal)
        if (changed) {
          await new Promise((res) => setTimeout(res, 2500));
          await NP.confirmWan();
          state.wanConfig = await NP.getWanConfig();
        }
        return go(4);
      } catch (x) {
        if (er) er.textContent = x.message;
        else toast(x.message);
      }
      return done();
    }
    if (b.matches('[data-wiz-upd]')) {
      try {
        await NP.setAutoUpdate(document.getElementById('wiz-auto').checked);
      } catch (_) {}
      return go(5);
    }
    if (b.matches('[data-wiz-finish]')) {
      try {
        await NP.finishWizard();
      } catch (_) {}
      state.xSec = null;
      state.wizStep = 0;
      location.hash = '#/';
    }
  });
  root.addEventListener('submit', async (e) => {
    let f = e.target;
    if (!['sysopt-form', 'log-search', 'wiz-pw'].includes(f.id)) return;
    e.preventDefault();
    if (f.id === 'log-search') {
      state.logF.q = f.elements.q.value.trim();
      return reloadLog();
    }
    let btn = f.querySelector('[type=submit]'),
      done = xBusy(btn, 'Kaydediliyor…');
    try {
      if (f.id === 'sysopt-form') {
        let el = f.elements;
        await NP.setSysOpt({ alerts: el.alerts.checked, rebootMode: el.rebootMode.value, rebootHour: el.rebootHour.value, rebootDay: el.rebootDay.value });
        toast('Bakım ayarları kaydedildi');
        state.xOpt = null;
      }
      if (f.id === 'wiz-pw') {
        let el = f.elements;
        if (el.pw.value !== el.pw2.value) throw new Error('Şifreler aynı değil');
        if (el.pw.value.length < 8) throw new Error('Şifre en az 8 karakter olmalı');
        await NP.changePassword(el.old?.value || '', el.pw.value);
        toast('Router şifresi kaydedildi');
        state.xSec = null;
        state.wizStep = 2;
        return render();
      }
    } catch (x) {
      let er = f.querySelector('.form-error');
      if (er) er.textContent = x.message;
      else toast(x.message);
    }
    done();
  });
  // Otomatik oturum kapatma: işlem yapılmazsa
  let lastAct = Date.now();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => (lastAct = Date.now()), { passive: true }));
  setInterval(async () => {
    let m = idleMin();
    if (!m || !NP.hasSession() || NP.isMock) return;
    if (Date.now() - lastAct > m * 60000) {
      if (state.liveStop) state.liveStop();
      await NP.logout().catch(() => {});
      render();
      toast('İşlem yapılmadığı için oturum kapatıldı');
    }
  }, 30000);
  // Sistem sayfası birkaç saniyede bir yenilenir; kullanıcı bir alana yazıyorsa yazdığını silme
  function formBusy() {
    let a = document.activeElement,
      c = document.getElementById('content');
    if (!c) return false;
    if (a && c.contains(a) && a.matches('input:not([type=checkbox]),select,textarea')) return true;
    return [...c.querySelectorAll('input:not([type=checkbox]):not([type=file]),textarea')].some((i) => i.value !== i.defaultValue) ||
      [...c.querySelectorAll('input[type=file]')].some((i) => i.files?.length);
  }
  root.addEventListener('keydown', (e) => {
    let w = e.target.closest && e.target.closest('[data-open-wan]');
    if (w && (e.key === 'Enter' || e.key === ' ') && e.target === w) {
      e.preventDefault();
      openWan(w.dataset.openWan);
    }
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', () => {
    if (state.drawerMac || state.drawerWifi) {
      document.getElementById('drawer-host').replaceChildren();
      state.drawerMac = null;
      state.drawerWifi = null;
    }
  });
  NP.on('auth', () => {
    if (state.liveStop) state.liveStop();
    clearInterval(state.overviewTimer);
    clearInterval(state.systemTimer);
    state.overview = null;
    state.clients = [];
    state.drawerMac = null;
    state.drawerWifi = null;
    render();
  });
  state.page = location.hash.slice(1) || '/'; // ilk açılışta adresteki sayfayı kullan
  window.NetI18n?.watch(root);
  async function loadSpeedData() {
    if (state.page !== '/speed' || !NP.hasSession()) return;
    try {
      state.sqm = await NP.getSqm();
      let data = await NP.getSpeedtest();
      state.speedHistory = data.history || [];
      if (data.current) state.speed = data.current;
      render();
    } catch (err) {
      state.error = err;
      updateTop();
    }
  }
  window.addEventListener('hashchange', () => {
    if (state.speedTimer) {
      clearInterval(state.speedTimer);
      state.speedTimer = null;
    }
    if (state.page === '/speed') loadSpeedData();
  });
  if (NP.hasSession()) {
    init();
    if (state.page === '/speed') loadSpeedData();
  } else render();
})();
