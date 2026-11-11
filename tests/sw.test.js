const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

test('service worker never caches or supplies offline responses for API data', async () => {
  const handlers = {};
  const puts = [];
  const precached = [];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8'), {
    URL,
    self: {
      location: { origin: 'https://example.test', href: 'https://example.test/paco/sw.js' },
      addEventListener(name, callback) { handlers[name] = callback; },
      skipWaiting() {},
    },
    caches: { open: async () => ({
      put(...args) { puts.push(args); },
      addAll(assets) { precached.push(...assets); },
    }) },
    fetch: async () => new Response('{}', { headers: { 'Cache-Control': 'no-store' } }),
  });
  let installation;
  handlers.install({ waitUntil(promise) { installation = promise; } });
  await installation;
  for (const asset of ['./my-learning.html', './my-learning.css', './my-learning.js']) {
    assert.ok(precached.includes(asset));
    assert.ok(fs.statSync(path.join(__dirname, '..', 'public', asset)).isFile());
  }
  for (const route of ['dashboard', 'me/learning', 'presence', 'session']) {
    let intercepted = false;
    handlers.fetch({
      request: { method: 'GET', url: `https://example.test/paco/api/${route}` },
      respondWith() { intercepted = true; },
    });
    assert.equal(intercepted, false);
  }
  let response;
  handlers.fetch({
    request: { method: 'GET', url: 'https://example.test/paco/dashboard.html' },
    respondWith(promise) { response = promise; },
  });
  await response;
  assert.equal(puts.length, 0);
});

function loadWorker({ online, cached = {} }) {
  const handlers = {};
  const puts = [];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8'), {
    URL,
    Response,
    self: {
      location: { origin: 'https://example.test', href: 'https://example.test/paco/sw.js' },
      addEventListener(name, callback) { handlers[name] = callback; },
    },
    caches: {
      open: async () => ({ put(...args) { puts.push(args); } }),
      match: async request => cached[typeof request === 'string' ? request : request.url],
    },
    fetch: async () => {
      if (!online) throw new TypeError('offline');
      return new Response('ok');
    },
  });
  const run = async (url, mode = 'navigate') => {
    let intercepted = false;
    let response;
    handlers.fetch({
      request: { method: 'GET', url, mode },
      respondWith(promise) { intercepted = true; response = promise; },
    });
    return { intercepted, response: intercepted ? await response.catch(error => error) : undefined };
  };
  return { run, puts };
}

test('offline navigation falls back to the cached page, then to offline.html', async () => {
  const cachedPage = new Response('cached');
  const offlinePage = new Response('offline');
  const worker = loadWorker({
    online: false,
    cached: {
      'https://example.test/paco/index.html': cachedPage,
      './offline.html': offlinePage,
    },
  });
  assert.equal((await worker.run('https://example.test/paco/index.html')).response, cachedPage);
  assert.equal((await worker.run('https://example.test/paco/unknown.html')).response, offlinePage);
  assert.equal((await worker.run('https://example.test/paco/new.html')).response, offlinePage);
  const asset = await worker.run('https://example.test/paco/unknown.js', 'no-cors');
  assert.ok(asset.response instanceof Error || asset.response?.type === 'error');
});

test('studio page and connectivity probes are never cached or answered from cache', async () => {
  const worker = loadWorker({ online: true, cached: { './offline.html': new Response('offline') } });
  const studio = await worker.run('https://example.test/paco/new.html');
  assert.equal(await studio.response.text(), 'ok');
  assert.equal(worker.puts.length, 0);
  const probe = await worker.run('https://example.test/paco/manifest.json?pco-probe=1', 'cors');
  assert.equal(probe.intercepted, false);
});

test('studio problem files are left to the network and never cached', async () => {
  const worker = loadWorker({ online: true });
  const problem = await worker.run('https://example.test/paco/curriculum/step-01/hello.json', 'cors');
  assert.equal(problem.intercepted, false);
  assert.equal(worker.puts.length, 0);
});

test('offline page is precached and self-contained', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
  assert.match(sw, /const OFFLINE_URL = '\.\/offline\.html'/);
  assert.match(sw, /ASSETS = \[[^\]]*OFFLINE_URL/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'offline.html'), 'utf8');
  assert.doesNotMatch(html, /(?:src|href)=["'](?!#|https?:)[^"']*\.(?:js|css|png|svg)/i);
});
