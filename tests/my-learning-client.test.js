const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'my-learning.js'), 'utf8');

function client() {
  const elements = new Map();
  const windowListeners = {};
  const documentListeners = {};
  const requests = [];
  const errors = [];
  let renderAttempts = 0;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', hidden: false, disabled: false, dataset: {}, attributes: {},
      replaceChildren() { this.firstElementChild = null; },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener() {},
    });
    return elements.get(id);
  }
  element('learning-content').hidden = true;
  element('learning-login').hidden = true;
  element('learning-error').hidden = true;
  element('learning-template').content = {
    cloneNode() {
      renderAttempts++;
      throw new Error('Invalidated responses must not render a profile.');
    },
  };
  const document = {
    currentScript: { src: 'https://example.test/paco/my-learning.js' },
    hidden: false, getElementById: element,
    addEventListener(name, callback) { documentListeners[name] = callback; },
  };
  vm.runInNewContext(source, {
    document, URL, Intl, AbortController,
    window: { addEventListener(name, callback) { windowListeners[name] = callback; } },
    fetch(url, options) {
      return new Promise(resolve => requests.push({ url, options, resolve }));
    },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() {},
    console: { error(...args) { errors.push(args); } },
  });
  return { document, element, windowListeners, documentListeners, requests, errors, renderAttempts: () => renderAttempts };
}

const settled = () => new Promise(resolve => setImmediate(resolve));

test('personal client relies only on the server API and shows session-required guidance', async () => {
  const app = client();
  assert.equal(app.requests.length, 1);
  assert.equal(String(app.requests[0].url), 'https://example.test/paco/api/me/learning');
  assert.equal(app.requests[0].options.cache, 'no-store');
  assert.equal(app.requests[0].options.credentials, 'same-origin');
  app.requests[0].resolve(Response.json({ code: 'SESSION_REQUIRED', message: '로그인해 주세요.' }, { status: 401 }));
  await settled();
  assert.equal(app.element('learning-login').hidden, false);
  assert.equal(app.element('learning-login-message').textContent, '로그인해 주세요.');
  assert.equal(app.element('learning-content').hidden, true);
  assert.equal(app.element('learning-error').hidden, true);
  assert.equal(app.renderAttempts(), 0);
  assert.equal(app.errors.length, 0);
});

for (const transition of ['hidden tab', 'logout', 'back-forward cache']) {
  test(`late personal responses cannot restore a previous profile after ${transition}`, async () => {
    const app = client();
    const oldRequest = app.requests[0];
    if (transition === 'hidden tab') {
      app.document.hidden = true;
      app.documentListeners.visibilitychange();
      assert.equal(app.element('learning-content').hidden, true);
      app.document.hidden = false;
      app.documentListeners.visibilitychange();
    } else if (transition === 'logout') {
      app.windowListeners['pco-session-changed']();
    } else {
      app.windowListeners.pagehide();
      app.windowListeners.pageshow({ persisted: true });
    }
    assert.equal(oldRequest.options.signal.aborted, true);
    assert.equal(app.requests.length, 2);
    app.requests[1].resolve(Response.json({ code: 'SESSION_REQUIRED', message: '다시 로그인해 주세요.' }, { status: 401 }));
    await settled();
    oldRequest.resolve(Response.json({ student: { name: '가상늦은기록' }, guide: {} }));
    await settled();
    assert.equal(app.renderAttempts(), 0);
    assert.equal(app.element('learning-content').hidden, true);
    assert.equal(app.element('learning-login').hidden, false);
    assert.equal(app.element('learning-status').textContent, '로그인 / 재검증 필요');
    assert.equal(app.element('learning-refresh').disabled, false);
    assert.equal(app.errors.length, 0);
  });
}

test('initial pageshow does not duplicate or cancel the initial personal request', () => {
  const app = client();
  app.windowListeners.pageshow({ persisted: false });
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].options.signal.aborted, false);
});
