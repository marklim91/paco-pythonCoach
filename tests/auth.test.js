const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'auth.js'), 'utf8');

function loadAuth({ cookies = {}, login = false, base = '/', blocked = false, search = '', scriptUrl } = {}) {
  const jar = new Map(Object.entries(cookies));
  const writes = [];
  const redirects = [];
  const listeners = {};
  const document = {
    currentScript: {
      src: scriptUrl || `https://example.test${base}auth.js`,
      dataset: login ? { page: 'login' } : {},
    },
    documentElement: {},
    get cookie() {
      return [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
    },
    set cookie(value) {
      writes.push(value);
      if (!blocked) {
        const [key, ...parts] = value.split(';')[0].split('=');
        jar.set(key, parts.join('='));
      }
    },
  };
  const window = {
    addEventListener(name, callback) { listeners[name] = callback; },
  };
  vm.runInNewContext(source, {
    URL, document, window,
    location: {
      protocol: 'https:',
      search,
      replace(url) { redirects.push(url); },
    },
  });
  return { auth: window.PcoAuth, document, jar, writes, redirects, listeners };
}

test('missing, partial, malformed and invalid cookies redirect to login', () => {
  for (const cookies of [
    {},
    { school: encodeURIComponent('현풍중학교') },
    { studentId: '0123' },
    { school: '%E0%A4%A', studentId: '0123' },
    { school: encodeURIComponent('다른학교'), studentId: '0123' },
    { school: encodeURIComponent('현풍중학교'), studentId: '12a' },
  ]) {
    const result = loadAuth({ cookies });
    assert.deepEqual(result.redirects, ['https://example.test/login.html']);
    assert.equal(result.document.documentElement.hidden, true);
  }
});

test('each supported school and a numeric student ID allow the existing home', () => {
  const schools = loadAuth({ login: true }).auth.schools;
  assert.equal(schools.length, 4);
  for (const school of schools) {
    const result = loadAuth({
      cookies: { school: encodeURIComponent(school), studentId: '00123' },
    });
    assert.equal(result.auth.isLoggedIn(), true);
    assert.deepEqual(result.redirects, []);
  }
});

test('logged-in visitors skip login without needing a name cookie', () => {
  const result = loadAuth({
    login: true,
    cookies: { school: encodeURIComponent('현풍중학교'), studentId: '00123' },
  });

  assert.deepEqual(result.redirects, ['https://example.test/new.html']);
});

test('reverification can create a server session without being skipped by old display cookies', () => {
  const result = loadAuth({
    login: true, search: '?reverify=1',
    cookies: { school: encodeURIComponent('도원중학교'), studentId: '00123' },
  });
  assert.deepEqual(result.redirects, []);
});

test('saving login preserves leading zeros and scopes secure session cookies', () => {
  const result = loadAuth({ login: true, base: '/paco/' });
  result.auth.saveLogin('함양여자중학교', '00123');
  assert.equal(result.jar.get('studentId'), '00123');
  assert.equal(decodeURIComponent(result.jar.get('school')), '함양여자중학교');
  assert.equal(result.jar.size, 2);
  assert.ok(result.writes.every(value =>
    value.endsWith('; Path=/paco/; SameSite=Lax; Secure')));
  assert.equal(result.auth.homeUrl, 'https://example.test/paco/new.html');
});

test('saving login with a name also stores a studentName cookie and rejects invalid names', () => {
  const result = loadAuth({ login: true, base: '/paco/' });
  result.auth.saveLogin('함양여자중학교', '00123', '이서연');
  assert.equal(decodeURIComponent(result.jar.get('studentName')), '이서연');
  assert.equal(result.jar.size, 3);
  assert.ok(result.writes.every(value => value.endsWith('; Path=/paco/; SameSite=Lax; Secure')));
  const rejected = loadAuth({ login: true });
  for (const name of ['이서연1', 'a b', '<b>', 'x'.repeat(101)]) {
    assert.throws(() => rejected.auth.saveLogin('도원중학교', '123', name), /이름/);
  }
  assert.equal(rejected.writes.length, 0);
});

test('invalid input and blocked cookies produce explicit errors', () => {
  const result = loadAuth({ login: true });
  assert.throws(() => result.auth.saveLogin('다른학교', '123'), /학교와 학번/);
  assert.throws(() => result.auth.saveLogin('도원중학교', '12a'), /학교와 학번/);
  assert.equal(result.writes.length, 0);
  const blocked = loadAuth({ login: true, blocked: true });
  assert.throws(() => blocked.auth.saveLogin('도원중학교', '123'), /쿠키 허용/);
});

test('history restoration rechecks deleted cookies with deployment-relative routing', () => {
  const result = loadAuth({
    base: '/paco/',
    cookies: { school: encodeURIComponent('도원중학교'), studentId: '123' },
  });
  result.jar.clear();
  result.listeners.pageshow();
  assert.deepEqual(result.redirects, ['https://example.test/paco/login.html']);
});

test('every application entry loads the cookie guard synchronously from the deployment root', () => {
  const pages = [
    'index.html', 'v3_4/roadmap.html', 'new.html', 'dashboard.html', 'my-learning.html',
  ];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', ...page.split('/')), 'utf8');
    const head = html.match(/<head(?:\s[^>]*)?>([\s\S]*?)<\/head>/i)[1];
    const guard = head.match(/<script\b[^>]*\bsrc=["']([^"']*auth\.js)["'][^>]*><\/script>/i);
    assert.ok(guard, `${page}: authentication guard must run in head`);
    assert.doesNotMatch(guard[0], /\b(?:async|defer|type)\s*(?:=|>|\s)/i, page);
    const scriptUrl = new URL(guard[1], `https://example.test/paco/${page}`).href;
    assert.equal(scriptUrl, 'https://example.test/paco/auth.js', page);
    for (const cookies of [{}, { studentId: '123' }, { school: encodeURIComponent('도원중학교') }]) {
      const result = loadAuth({ scriptUrl, cookies });
      assert.deepEqual(result.redirects, ['https://example.test/paco/login.html'], page);
      assert.equal(result.document.documentElement.hidden, true, page);
    }
    const loggedIn = loadAuth({
      scriptUrl, cookies: { school: encodeURIComponent('도원중학교'), studentId: '00123' },
    });
    assert.deepEqual(loggedIn.redirects, [], page);
    loggedIn.jar.clear();
    loggedIn.listeners.pageshow();
    assert.deepEqual(loggedIn.redirects, ['https://example.test/paco/login.html'], page);
  }
});
