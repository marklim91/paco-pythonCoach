(function () {
  var scriptEl = document.currentScript || document.querySelector('script[src*="app-shell.js"]');
  var basePath = '/';
  if (scriptEl && scriptEl.src) {
    try {
      basePath = new URL('.', scriptEl.src).pathname;
    } catch (e) {}
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      var isSample = window.location.pathname.indexOf('/pwa-sample') !== -1;
      if (!isSample) {
        navigator.serviceWorker.register(basePath + 'sw.js').catch(function () {});
      }
    });
  }

  var pages = [
    { label: '파코(v3)', rel: 'index.html', match: ['', 'index.html', '파코v3'] },
    { label: '대시보드', rel: 'dashboard.html', match: ['dashboard.html', '대시보드'] },
    { label: '파코(v3_4)', rel: 'v3_4/index.html', match: ['v3_4', 'v3_4/', 'v3_4/index.html', '파코v3_4'] },
    { label: '↳ AI코치', rel: 'v3_4/coach.html', match: ['v3_4/coach.html', '파코v3_4/ai코치'] },
    { label: '↳ 레벨 로드맵', rel: 'v3_4/roadmap.html', match: ['v3_4/roadmap.html', '파코v3_4/레벨-로드맵'] },
    { label: '파코(v2)', rel: 'v2.html', match: ['v2.html', '파코v2'] },
    { label: '🧪 PWA 핸즈온 샘플', rel: 'pwa-sample/index.html', match: ['pwa-sample', 'pwa-sample/', 'pwa-sample/index.html'] }
  ];

  var currentPath = decodeURIComponent(window.location.pathname);
  var relCurrent = currentPath.indexOf(basePath) === 0
    ? currentPath.slice(basePath.length)
    : currentPath.replace(/^\//, '');

  var bar = document.createElement('div');
  bar.id = 'pco-global-bar';
  bar.innerHTML =
    '<style>' +
    '#pco-global-bar{background:#182039;color:#e2e8f0;font-family:"Pretendard Variable",Pretendard,-apple-system,sans-serif;font-size:12.5px;padding:6px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.1);z-index:9999;position:relative}' +
    '#pco-global-bar .pco-brand{font-weight:700;color:#2ec98a;display:flex;align-items:center;gap:6px;white-space:nowrap}' +
    '#pco-global-bar .pco-links{display:flex;align-items:center;gap:4px;flex-wrap:wrap}' +
    '#pco-global-bar a{color:#cbd5e1;text-decoration:none;padding:4px 10px;border-radius:6px;font-weight:600;transition:all .15s}' +
    '#pco-global-bar a:hover{background:rgba(255,255,255,.1);color:#fff}' +
    '#pco-global-bar a.active{background:#2ec98a;color:#111827;font-weight:700}' +
    '</style>' +
    '<div class="pco-brand">🐍 파코(파이썬 코치) PWA & Hands-on</div>' +
    '<nav class="pco-links">' +
    pages
      .map(function (p) {
        var isActive = p.match.indexOf(relCurrent) !== -1;
        return '<a href="' + basePath + p.rel + '" class="' + (isActive ? 'active' : '') + '">' + p.label + '</a>';
      })
      .join('') +
    '</nav>';

  if (document.body) {
    document.body.insertBefore(bar, document.body.firstChild);
  } else {
    window.addEventListener('DOMContentLoaded', function () {
      document.body.insertBefore(bar, document.body.firstChild);
    });
  }
})();
