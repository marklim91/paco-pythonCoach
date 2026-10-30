const assert = require('node:assert/strict');
const test = require('node:test');
const { createServer } = require('../server');
const { createLoginHandler } = require('../login-api');

const student = { school: '현풍중학교', studentId: '00123', studentName: '홍길동' };
const flowUrl = 'https://example.environment.api.powerplatform.com/workflows/test?sig=private-test-value';

async function setup(t, overrides = {}) {
  const calls = [];
  const logs = [];
  const handler = createLoginHandler({
    flowUrl,
    logger: { error(...args) { logs.push(args); } },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ verified: true, privateRecord: 'must not reach browser' });
    },
    ...overrides,
  });
  const server = createServer({ loginHandler: handler });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/login/verify`;
  const send = (body = student, options = {}) => fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...options,
  });
  return { send, calls, logs, endpoint };
}

test('verified flow response accepts login and exposes no Dataverse records or secrets', async t => {
  const { send, calls } = await setup(t);
  const res = await send({ ...student, extra: 'do not forward' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { verified: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, flowUrl);
  assert.equal(calls[0].options.redirect, 'error');
  assert.deepEqual(JSON.parse(calls[0].options.body), student);
});

test('missing or inactive student is rejected without echoing flow data', async t => {
  const { send } = await setup(t, {
    fetchImpl: async () => Response.json({ verified: false, studentName: 'private' }),
  });
  const res = await send();
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.verified, false);
  assert.equal(body.code, 'STUDENT_NOT_VERIFIED');
  assert.equal(body.studentName, undefined);
});

test('invalid input, method, content type and request size never invoke the flow', async t => {
  const { send, calls, endpoint } = await setup(t);
  for (const body of [
    null, [], {}, { ...student, school: '다른학교' },
    { ...student, studentId: 123 }, { ...student, studentId: '12a' },
    { ...student, studentId: '1'.repeat(33) },
    { ...student, studentName: '' }, { ...student, studentName: "홍'길동" },
    { ...student, studentName: '가'.repeat(101) },
  ]) {
    assert.equal((await send(body)).status, 400);
  }
  assert.equal((await send(student, { body: '{invalid' })).status, 400);
  assert.equal((await send(student, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await send(student, { body: 'x'.repeat(4097) })).status, 413);
  const get = await fetch(endpoint);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
  assert.equal(calls.length, 0);
});

test('missing or invalid server configuration fails closed', async t => {
  for (const value of ['', 'not a URL', 'http://example.logic.azure.com/test', 'https://example.org/test']) {
    await t.test(value || 'missing URL', async t => {
      const { send, calls, logs } = await setup(t, { flowUrl: value });
      const res = await send();
      assert.equal(res.status, 503);
      assert.equal((await res.json()).verified, false);
      assert.equal(calls.length, 0);
      assert.equal(logs.length, 1);
    });
  }
});

test('upstream HTTP errors and invalid response shapes cannot permit login', async t => {
  const cases = [
    () => new Response('private upstream error', { status: 403 }),
    () => new Response('private upstream error', { status: 500 }),
    () => new Response('<html>not JSON</html>'),
    () => Response.json({ verified: 'true' }),
    () => Response.json({ verified: 'false' }),
    () => Response.json({}),
    () => Response.json(null),
  ];
  for (const response of cases) {
    const { send, logs } = await setup(t, { fetchImpl: async () => response() });
    const res = await send();
    assert.equal(res.status, 502);
    const text = await res.text();
    assert.equal(JSON.parse(text).verified, false);
    assert.ok(!text.includes('private'));
    assert.equal(logs.length, 1);
  }
});

test('network failures and timeouts surface explicitly without logging secrets', async t => {
  for (const [error, status] of [
    [new TypeError(`request failed: ${flowUrl}`), 502],
    [new DOMException('timed out', 'TimeoutError'), 504],
  ]) {
    const { send, logs } = await setup(t, { fetchImpl: async () => { throw error; } });
    const res = await send();
    assert.equal(res.status, status);
    assert.equal((await res.json()).verified, false);
    assert.ok(!JSON.stringify(logs).includes('private-test-value'));
    assert.ok(!JSON.stringify(logs).includes(student.studentName));
  }
});

test('static home and API remain available from the same server', async t => {
  const { endpoint } = await setup(t);
  const res = await fetch(new URL('/index.html', endpoint));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /auth\.js/);
});

test('configured timeout aborts an in-flight flow request', async t => {
  const { send } = await setup(t, {
    timeoutMs: 20,
    fetchImpl: (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    }),
  });
  const res = await send();
  assert.equal(res.status, 504);
  assert.equal((await res.json()).code, 'FLOW_TIMEOUT');
});

test('session persistence failure is explicit and cannot produce a successful login', async t => {
  const { send, logs } = await setup(t, {
    onVerified: () => { throw new Error('disk full'); },
  });
  const response = await send();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal((await response.json()).code, 'SESSION_STORE_FAILED');
  assert.deepEqual(logs, [['[login-api]', 'SESSION_STORE_FAILED']]);
});

test('only successfully verified student names are passed to session tracking', async t => {
  const names = [];
  const { send } = await setup(t, {
    onVerified: value => { names.push(value); },
  });
  assert.equal((await send()).status, 200);
  assert.deepEqual(names, [student]);
  const failed = await setup(t, {
    fetchImpl: async () => Response.json({ verified: false }),
    onVerified: value => { names.push(value); },
  });
  assert.equal((await failed.send()).status, 401);
  assert.equal(names.length, 1);
});
