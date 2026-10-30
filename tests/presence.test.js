const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'presence.js'), 'utf8');
const student = { authenticated: true, school: '현풍중학교', name: '가상하나' };
const expected = '현풍중학교 / 가상하나 학생';
const settled = () => new Promise(resolve => setImmediate(resolve));

function loadPresence({ hidden = false, session = student, heartbeatStatus = 200 } = {}) {
  const nodes = {};
  const windowListeners = {};
  const documentListeners = {};
  const requests = [];
  const writes = [];
  const redirects = [];
  const events = [];
  const errors = [];
  const state = { session, heartbeatStatus };
  let interval;
  let cookieReads = 0;
  for (const id of ['pco-session-status', 'pco-session-login', 'pco-session-logout']) {
    nodes[id] = {
      textContent: '', hidden: false, disabled: false, listeners: {},
      addEventListener(name, callback) { this.listeners[name] = callback; },
      set innerHTML(value) { throw new Error('Student text must not be interpreted as HTML: ' + value); },
    };
  }
  const document = {
    currentScript: { src: 'https://example.test/paco/presence.js' },
    hidden,
    getElementById(id) { return nodes[id]; },
    addEventListener(name, callback) { documentListeners[name] = callback; },
    get cookie() {
      cookieReads++;
      return 'school=forged-school; studentId=00999; studentName=forged-name';
    },
    set cookie(value) { writes.push(value); },
  };
  vm.runInNewContext(source, {
    document, URL, AbortController, Event,
    window: {
      addEventListener(name, callback) { windowListeners[name] = callback; },
      dispatchEvent(event) { events.push(event.type); },
    },
    location: { replace(url) { redirects.push(url); } },
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      if (url.pathname.endsWith('/session')) return Response.json(state.session);
      if (url.pathname.endsWith('/heartbeat')) {
        return Response.json(state.heartbeatStatus === 200 ? { recorded: true } :
          { message: '세션 만료' }, { status: state.heartbeatStatus });
      }
      if (url.pathname.endsWith('/logout')) return Response.json({ loggedOut: true });
      throw new Error('Unexpected request: ' + url);
    },
    setTimeout() { return 1; }, clearTimeout() {},
    setInterval(callback) { interval = callback; },
    console: { error(...args) { errors.push(args); } },
  });
  return {
    nodes, state, document, windowListeners, documentListeners, requests, writes, redirects, events, errors,
    interval: () => interval(), cookieReads: () => cookieReads,
    status: () => nodes['pco-session-status'].textContent,
  };
}

test('login status displays verified school and name and survives heartbeat completion', async () => {
  const app = loadPresence();
  await settled();
  assert.equal(app.status(), expected);
  assert.equal(app.nodes['pco-session-login'].hidden, true);
  assert.equal(app.nodes['pco-session-logout'].hidden, false);
  assert.deepEqual(app.requests.map(request => request.url), [
    'https://example.test/paco/api/session', 'https://example.test/paco/api/session/heartbeat',
  ]);
  assert.equal(app.requests[1].options.method, 'POST');
  assert.equal(app.cookieReads(), 0);
});

test('hidden tabs display the verified student without requiring a heartbeat', async () => {
  const app = loadPresence({ hidden: true });
  await settled();
  assert.equal(app.status(), expected);
  assert.equal(app.requests.length, 1);
  app.document.hidden = false;
  app.documentListeners.visibilitychange();
  await settled();
  assert.equal(app.status(), expected);
  assert.equal(app.requests.length, 3);
});

test('periodic and page restoration checks update the displayed server-session identity', async () => {
  const app = loadPresence();
  await settled();
  app.state.session = { authenticated: true, school: '도원중학교', name: '가상둘' };
  await app.windowListeners.pageshow();
  assert.equal(app.status(), '도원중학교 / 가상둘 학생');
  app.state.session = { authenticated: true, school: '현풍중학교', name: '가상셋' };
  app.interval();
  await settled();
  assert.equal(app.status(), '현풍중학교 / 가상셋 학생');
});

test('forged display cookies cannot produce a confirmed school or student identity', async () => {
  const app = loadPresence({ session: { authenticated: false } });
  await settled();
  assert.equal(app.status(), '활동 집계는 로그인 후 시작');
  assert.equal(app.nodes['pco-session-login'].hidden, false);
  assert.equal(app.nodes['pco-session-logout'].hidden, true);
  assert.equal(app.requests.length, 1);
  assert.equal(app.cookieReads(), 0);
});

test('legacy sessions without a name explicitly display name unavailable', async () => {
  const app = loadPresence({ session: { ...student, name: null } });
  await settled();
  assert.equal(app.status(), '현풍중학교 / 이름 미등록');
});

test('student names remain literal text, not HTML', async () => {
  const app = loadPresence({ session: { ...student, name: '<b>가상하나</b>' } });
  await settled();
  assert.equal(app.status(), '현풍중학교 / <b>가상하나</b> 학생');
  assert.equal(app.errors.length, 0);
});

test('expired sessions replace the student identity with reverification guidance', async () => {
  const app = loadPresence({ heartbeatStatus: 401 });
  await settled();
  assert.equal(app.status(), '세션 만료 · 다시 로그인');
  assert.equal(app.nodes['pco-session-login'].hidden, false);
  assert.equal(app.nodes['pco-session-logout'].hidden, true);
});

test('logout removes the student label, clears display cookies and retains deployment-relative navigation', async () => {
  const app = loadPresence();
  await settled();
  await app.nodes['pco-session-logout'].listeners.click();
  assert.equal(app.status(), '로그아웃됨');
  assert.equal(app.nodes['pco-session-logout'].hidden, true);
  assert.equal(app.nodes['pco-session-login'].hidden, false);
  assert.equal(app.writes.length, 2);
  assert.ok(app.writes.every(cookie => cookie.includes('Max-Age=0; Path=/paco/')));
  assert.deepEqual(app.redirects, ['https://example.test/paco/login.html?reverify=1']);
  assert.deepEqual(app.events, ['pco-session-changed']);
});

test('failed heartbeats show an explicit error instead of confirming the student', async () => {
  const app = loadPresence({ heartbeatStatus: 503 });
  await settled();
  assert.equal(app.status(), '접속 현황 연결 실패');
  assert.equal(app.errors.length, 1);
});
