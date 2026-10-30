const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'login.js'), 'utf8');

function setup(fetchImpl) {
  const saved = [];
  const redirects = [];
  const requests = [];
  let submit;
  const button = { disabled: true, textContent: '로그인' };
  const field = value => ({ value, addEventListener() {} });
  const school = { ...field('현풍중학교'), add() {} };
  const studentId = field('00123');
  const studentName = field('홍길동');
  const error = { textContent: '' };
  const form = {
    querySelector() { return button; },
    reportValidity() { return true; },
    addEventListener(name, callback) { if (name === 'submit') submit = callback; },
    setAttribute() {},
    removeAttribute() {},
  };
  const elements = {
    'login-form': form, school, 'student-id': studentId,
    'student-name': studentName, 'login-error': error,
  };
  vm.runInNewContext(source, {
    window: {},
    document: { getElementById(id) { return elements[id]; } },
    PcoAuth: {
      schools: ['현풍중학교'],
      verifyUrl: 'https://example.test/api/login/verify',
      homeUrl: 'https://example.test/index.html',
      saveLogin(...args) { saved.push(args); },
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return fetchImpl();
    },
    location: { replace(url) { redirects.push(url); } },
    Option: function () {},
    AbortController, setTimeout, clearTimeout, TypeError, SyntaxError,
  });
  return {
    saved, redirects, requests, button, error, school, studentId, studentName,
    submit() { return submit({ preventDefault() {} }); },
  };
}

test('only successful verification saves cookies and routes to the existing home', async () => {
  const result = setup(async () => Response.json({ verified: true }));
  await result.submit();
  assert.deepEqual(result.saved, [['현풍중학교', '00123']]);
  assert.deepEqual(result.redirects, ['https://example.test/index.html']);
  assert.equal(result.requests[0].options.cache, 'no-store');
  assert.deepEqual(JSON.parse(result.requests[0].options.body), {
    school: '현풍중학교', studentId: '00123', studentName: '홍길동',
  });
});

test('pending verification prevents duplicate requests and saves only the verified input', async () => {
  let finish;
  const result = setup(() => new Promise(resolve => { finish = resolve; }));
  const pending = result.submit();
  assert.equal(result.button.disabled, true);
  assert.equal(result.saved.length, 0);
  await result.submit();
  assert.equal(result.requests.length, 1);
  result.school.value = '도원중학교';
  result.studentId.value = '99999';
  finish(Response.json({ verified: true }));
  await pending;
  assert.deepEqual(result.saved, [['현풍중학교', '00123']]);
});

test('rejection, unavailable API, malformed responses and network errors never save cookies', async () => {
  for (const fetchImpl of [
    async () => Response.json({ verified: false, message: '일치하는 학생이 없습니다.' }, { status: 401 }),
    async () => Response.json({ verified: false }, { status: 503 }),
    async () => Response.json({ verified: 'true' }),
    async () => new Response('Not Found', { status: 404 }),
    async () => new Response('<html>invalid</html>'),
    async () => { throw new TypeError('network failed'); },
    async () => { throw new DOMException('timeout', 'AbortError'); },
  ]) {
    const result = setup(fetchImpl);
    await result.submit();
    assert.equal(result.saved.length, 0);
    assert.equal(result.redirects.length, 0);
    assert.ok(result.error.textContent);
    assert.equal(result.button.disabled, false);
    assert.equal(result.button.textContent, '로그인');
  }
});
