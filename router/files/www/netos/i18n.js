/* NetOS dil desteği (tr / en)
 * Arayüz Türkçe yazılır; İngilizce seçiliyse çizilen sayfadaki metinler sözlükle çevrilir.
 * Anahtar: kırpılmış Türkçe metin, içindeki sayılar "#" ile değiştirilmiş hali
 *   ör. "11 çevrimiçi · 12 kayıtlı" -> "# çevrimiçi · # kayıtlı" -> "# online · # saved"
 * Sözlükte yoksa " · " ile ayrılmış parçalar ayrı ayrı denenir; yine yoksa Türkçe kalır.
 * Sözlük: i18n-en.js (window.NETOS_EN). Yeni metin eklerken oraya da ekleyin.
 */
(function (w) {
  'use strict';
  const KEY = 'np_lang';
  let lang = 'tr';
  try {
    lang = localStorage.getItem(KEY) || ((navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en');
  } catch (_) {}
  const NUM = /\d+(?:[.,:]\d+)*/g;

  let fk = null;
  const fragKeys = () => (fk = fk || Object.keys(w.NETOS_EN_FRAG || {}).sort((a, b) => b.length - a.length));
  function lookup(s) {
    const d = w.NETOS_EN || {};
    if (Object.prototype.hasOwnProperty.call(d, s)) return d[s];
    const nums = s.match(NUM);
    if (!nums) return null;
    const k = s.replace(NUM, '#');
    if (!Object.prototype.hasOwnProperty.call(d, k)) return null;
    let i = 0;
    return d[k].replace(/#/g, () => (i < nums.length ? nums[i++] : '#'));
  }
  function tr(text) {
    if (lang !== 'en' || !text) return text;
    const s = String(text);
    const core = s.trim().replace(/\s+/g, ' ');
    if (!core || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(core)) return text;
    let r = lookup(core);
    if (r == null && core.includes(' · ')) {
      const parts = core.split(' · ').map((p) => lookup(p.trim()) ?? p);
      r = parts.join(' · ');
      if (r === core) r = null;
    }
    if (r == null && /[.!?:]$/.test(core)) {
      const base = lookup(core.slice(0, -1));
      if (base != null) r = base + core.slice(-1);
    }
    if (r == null && w.NETOS_EN_FRAG) {
      // değişken içeren metinler: bilinen parçaları yerinde değiştir (uzundan kısaya)
      let out = core;
      for (const k of fragKeys()) if (out.includes(k)) out = out.split(k).join(w.NETOS_EN_FRAG[k]);
      if (out !== core) r = out;
    }
    if (r == null) return text;
    // baştaki/sondaki boşluk korunur (satır içi öğelerin arasındaki boşluklar kaybolmasın)
    const lead = /^\s/.test(s) ? ' ' : '', trail = /\s$/.test(s) ? ' ' : '';
    return lead + r + trail;
  }
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  function translateTree(root) {
    if (lang !== 'en' || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && /^(SCRIPT|STYLE|TEXTAREA|PRE|CODE)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (n.parentElement?.closest('[data-no-i18n],.log-list,.x-chart text')) continue;
      const t = tr(n.nodeValue);
      if (t !== n.nodeValue) n.nodeValue = t;
    }
    const els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label]') : [];
    for (const el of [root, ...els]) {
      if (!el.getAttribute) continue;
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v) {
          const t = tr(v);
          if (t !== v) el.setAttribute(a, t);
        }
      }
    }
  }
  let queued = false;
  function watch(root) {
    new MutationObserver(() => {
      if (lang !== 'en' || queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        translateTree(root);
        translateTree(document.getElementById('toast'));
      });
    }).observe(root, { childList: true, subtree: true, characterData: false });
  }
  // onay pencereleri de çevrilsin
  const nativeConfirm = w.confirm.bind(w);
  w.confirm = (msg) => nativeConfirm(tr(msg));
  const nativeAlert = w.alert.bind(w);
  w.alert = (msg) => nativeAlert(tr(msg));

  w.NetI18n = {
    get lang() { return lang; },
    set(l) {
      lang = l === 'en' ? 'en' : 'tr';
      try {
        localStorage.setItem(KEY, lang);
      } catch (_) {}
      document.documentElement.lang = lang;
    },
    t: tr,
    translateTree,
    watch,
  };
  document.documentElement.lang = lang;
})(window);
