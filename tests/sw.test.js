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
