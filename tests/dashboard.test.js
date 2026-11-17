const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDashboardStore } = require('../dashboard-store');
const { latestStudents, rankStudents, studioLevel } = require('../dashboard-api');
const { createLoginHandler } = require('../login-api');
const { createServer } = require('../server');
const studioCatalog = require('../public/studio-catalog');
const studioProgress = require('../public/studio-progress');
const studioSync = require('../public/studio-sync');

const flowUrl = 'https://example.environment.api.powerplatform.com/test?sig=private-dashboard-secret';
const school = '현풍중학교';
const student = { school, studentId: '00123', studentName: '테스트' };
const row = (changes = {}) => ({
  crbf2_studentlearningrecordid: '11111111-1111-4111-8111-111111111111',
  crbf2_schoolname: school,
  crbf2_studentnumber: '00123',
  crbf2_studentname: '테스트',
  crbf2_learningpoints: 100,
  crbf2_currentlevel: 2,
  crbf2_isactive: true,
  modifiedon: '2026-10-30T01:00:00Z',
  ...changes,
});

async function setup(t, options = {}) {
  const calls = [];
  const logs = [];
  const store = options.store || createDashboardStore();
  const login = createLoginHandler({
    flowUrl, onVerified: store.login,
    fetchImpl: async () => Response.json({ verified: options.verified !== false }),
  });
  const server = createServer({
    dashboardStore: store, loginHandler: login,
    dashboardOptions: {
      flowUrl, fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return Response.json({ value: [row()] });
      },
      logger: { error(...args) { logs.push(args); } },
      ...options.dashboardOptions,
    },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, init) => fetch(base + route, init);
  const signIn = () => request('/api/login/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(student),
  });
  return { request, signIn, store, calls, logs, base };
}

test('latest cumulative values are not summed across sessions and latest inactive records exclude students', () => {
  const rows = [
    row(), row({ modifiedon: '2026-10-29T01:00:00Z', crbf2_learningpoints: 500 }),
    row({ crbf2_studentnumber: '222', crbf2_learningpoints: 999 }),
    row({ crbf2_studentnumber: '222', modifiedon: '2026-10-31T01:00:00Z', crbf2_isactive: false }),
  ];
  const students = latestStudents({ value: rows });
  assert.equal(students.length, 1);
  assert.equal(students[0].points, 100);
});

test('invalid, incomplete and ambiguous Dataverse responses fail explicitly', () => {
  const invalid = [
    {}, { value: null }, { value: [null] },
    { value: [row({ crbf2_learningpoints: '100' })] },
    { value: [row({ crbf2_learningpoints: null })] },
    { value: [row({ crbf2_learningpoints: -1 })] },
    { value: [row({ crbf2_currentlevel: 1.5 })] },
    { value: [row({ crbf2_isactive: 'True' })] },
    { value: [row({ crbf2_studentnumber: 123 })] },
    { value: [row({ modifiedon: 'not-a-date' })] },
    { value: [row({ crbf2_studentlearningrecordid: 'not-a-guid' })] },
    { value: [], '@odata.nextLink': 'private-next-link' },
    { value: [], '@Microsoft.Dynamics.CRM.totalrecordcountlimitexceeded': true },
    { value: Array(100000).fill(row()) },
    { value: [row(), row({ crbf2_learningpoints: 200 })] },
  ];
  invalid.forEach(value => assert.throws(() => latestStudents(value), error => error.status === 502));
});

test('real-name display requires the Dataverse name column and never fabricates a name', () => {
  for (const name of [undefined, null, '', '   ', 123, '가'.repeat(101)]) {
    assert.throws(
      () => latestStudents({ value: [row({ crbf2_studentname: name })] }),
      error => error.status === 502 && error.code === 'STUDENT_NAME_REQUIRED',
    );
  }
  const students = latestStudents({ value: [row({ crbf2_studentname: ' 테스트 ' })] });
  assert.equal(students[0].name, '테스트');
});

test('identical names remain separate students and conflicting latest names are rejected', () => {
  const store = createDashboardStore();
  const students = latestStudents({ value: [row(), row({ crbf2_studentnumber: '222' })] });
  store.observe(students);
  const ranked = rankStudents(students, store);
  assert.deepEqual(ranked.map(s => s.name), ['테스트', '테스트']);
  assert.notEqual(ranked[0].id, ranked[1].id);
  assert.notEqual(ranked[0].alias, ranked[1].alias);
  assert.throws(() => latestStudents({
    value: [row(), row({ crbf2_studentname: '다른이름' })],
  }), error => error.code === 'AMBIGUOUS_STUDENT_RECORD');
});

test('legacy login names are explicitly absent until backfilled from the same student record', () => {
  const store = createDashboardStore();
  const req = { headers: {}, socket: {} };
  store.login({ school, studentId: student.studentId }, req, { setHeader() {} });
  const before = store.presence().recentLogins[0];
  assert.equal(before.name, null);
  store.observe(latestStudents({ value: [row()] }));
  const after = store.presence().recentLogins[0];
  assert.equal(after.name, '테스트');
  assert.equal(after.id, before.id);
  assert.equal(after.alias, before.alias);
  assert.equal(after.lastLoginAt, before.lastLoginAt);
  store.observe(latestStudents({ value: [row({ crbf2_studentname: '변경이름' })] }));
  assert.equal(store.presence().recentLogins[0].name, '변경이름');
});

test('ranking uses competition ranks and separates identical numbers at different schools', () => {
  const store = createDashboardStore();
  const students = latestStudents({ value: [
    row(), row({ crbf2_studentnumber: '222' }),
    row({ crbf2_schoolname: '도원중학교', crbf2_learningpoints: 50 }),
  ] });
  store.observe(students);
  const ranked = rankStudents(students, store);
  assert.deepEqual(ranked.map(s => s.rank), [1, 1, 3]);
  assert.equal(new Set(ranked.map(s => s.id)).size, 3);
  assert.deepEqual(rankStudents(students, store, '도원중학교').map(s => s.rank), [1]);
  assert.ok(ranked.every(s => s.observedGrowth === null));
  assert.ok(!JSON.stringify(ranked).includes('00123'));
  assert.ok(!JSON.stringify(ranked).includes('11111111-1111-4111-8111-111111111111'));
});

test('observed growth persists across restart without inventing historical values', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pco-dashboard-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const filePath = path.join(directory, 'state.json');
  let time = Date.parse('2026-10-30T01:00:00Z');
  const store = createDashboardStore({ filePath, now: () => time });
  const students = latestStudents({ value: [row()] });
  store.observe(students);
  const id = store.studentKey(school, '00123');
  assert.equal(store.history(id).length, 1);
  time += 60000;
  students[0].points = 180;
  store.observe(students);
  const restored = createDashboardStore({ filePath, now: () => time });
  assert.equal(restored.studentKey(school, '00123'), id);
  assert.deepEqual(restored.history(id).map(s => s.points), [100, 180]);
  assert.equal(rankStudents(students, restored)[0].observedGrowth, 80);
  assert.ok(!fs.readFileSync(filePath, 'utf8').includes('00123'));
  time += 91 * 86400000;
  assert.deepEqual(restored.history(id), []);
});

test('corrupted state is rejected instead of silently resetting aliases and history', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pco-dashboard-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const filePath = path.join(directory, 'state.json');
  fs.writeFileSync(filePath, '{"version":0}');
  assert.throws(() => createDashboardStore({ filePath }), /Invalid dashboard state/);
});

test('sessions survive restart using hashed tokens and expire without activity', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pco-dashboard-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const filePath = path.join(directory, 'state.json');
  let time = Date.parse('2026-10-30T01:00:00Z');
  const store = createDashboardStore({ filePath, now: () => time });
  let cookie;
  const req = { headers: {}, socket: { encrypted: true } };
  store.login(student, req, { setHeader(name, value) { cookie = value; } });
  assert.match(cookie, /; Secure$/);
  const token = cookie.split(';')[0];
  assert.ok(!fs.readFileSync(filePath, 'utf8').includes(token.slice('pco_session='.length)));
  const restored = createDashboardStore({ filePath, now: () => time });
  assert.ok(restored.sessionFor({ headers: { cookie: token } }));
  assert.equal(restored.presence().activeUsers, 1);
  assert.equal(restored.presence().recentLogins[0].name, student.studentName);
  time += 5 * 60000;
  assert.equal(restored.presence().activeUsers, 0);
});

test('dashboard API returns real names without raw identifiers and caches concurrent requests', async t => {
  const { request, calls } = await setup(t);
  const responses = await Promise.all([request('/api/dashboard'), request('/api/dashboard')]);
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.summary.totalPoints, 100);
    assert.equal(body.students.length, 1);
    assert.equal(body.students[0].observedGrowth, null);
    assert.match(body.students[0].alias, /^학습자-/);
    assert.equal(body.students[0].name, '테스트');
    const text = JSON.stringify(body);
    for (const secret of ['00123', 'private-dashboard-secret', 'studentId', 'studentName', 'recordId']) {
      assert.ok(!text.includes(secret), secret + ' must not be public');
    }
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.body, '{}');
  const filtered = await request('/api/dashboard?school=' + encodeURIComponent(school));
  assert.equal(filtered.status, 200);
  assert.equal((await request('/api/dashboard?school=unknown')).status, 400);
});

test('missing configuration, upstream failures, malformed and partial responses are never empty success', async t => {
  const cases = [
    [{ flowUrl: '' }, 503, 'DASHBOARD_NOT_CONFIGURED'],
    [{ flowUrl: 'https://example.org/test' }, 503, 'INVALID_DASHBOARD_URL'],
    [{ fetchImpl: async () => new Response('private failure', { status: 401 }) }, 502, 'DASHBOARD_FLOW_HTTP_ERROR'],
    [{ fetchImpl: async () => new Response('not json') }, 502, 'INVALID_DASHBOARD_RESPONSE'],
    [{ fetchImpl: async () => Response.json({ value: [], '@odata.nextLink': 'secret' }) }, 502, 'INCOMPLETE_DASHBOARD_DATA'],
    [{ fetchImpl: async () => { throw new Error(flowUrl); } }, 502, 'DASHBOARD_REQUEST_FAILED'],
    [{ fetchImpl: async () => { throw new DOMException('timeout', 'TimeoutError'); } }, 504, 'DASHBOARD_TIMEOUT'],
  ];
  for (const [dashboardOptions, status, code] of cases) {
    const { request, logs } = await setup(t, { dashboardOptions });
    const response = await request('/api/dashboard');
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.code, code);
    assert.equal(body.students, undefined);
    assert.ok(!JSON.stringify([body, logs]).includes('private-dashboard-secret'));
  }
});

test('empty source data is a real empty result, not sample students', async t => {
  const { request } = await setup(t, {
    dashboardOptions: { fetchImpl: async () => Response.json({ value: [] }) },
  });
  const body = await (await request('/api/dashboard')).json();
  assert.deepEqual(body.students, []);
  assert.equal(body.summary.students, 0);
  assert.equal(body.summary.averageLevel, null);
});

test('verified login issues HttpOnly session; forged display cookies cannot record activity', async t => {
  const { request, signIn } = await setup(t);
  const forged = 'school=' + encodeURIComponent(school) + '; studentId=00123';
  assert.equal((await request('/api/session/heartbeat', { method: 'POST', headers: { Cookie: forged } })).status, 401);
  assert.deepEqual(await (await request('/api/session', { headers: { Cookie: forged } })).json(), { authenticated: false });
  const login = await signIn();
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly; SameSite=Lax/);
  const cookie = setCookie.split(';')[0];
  const session = await (await request('/api/session', { headers: { Cookie: cookie } })).json();
  assert.equal(session.authenticated, true);
  assert.equal(session.school, student.school);
  assert.equal(session.name, student.studentName);
  assert.equal((await request('/api/session/heartbeat', { method: 'POST', headers: { Cookie: cookie } })).status, 200);
  const presence = await (await request('/api/presence')).json();
  assert.equal(presence.activeUsers, 1);
  assert.equal(presence.recentLogins.length, 1);
  assert.equal(presence.recentLogins[0].id, session.id);
  assert.equal(presence.recentLogins[0].name, student.studentName);
  assert.ok(!JSON.stringify(presence).includes('00123'));
  const logout = await request('/api/session/logout', { method: 'POST', headers: { Cookie: cookie } });
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await request('/api/session/heartbeat', { method: 'POST', headers: { Cookie: cookie } })).status, 401);
  assert.equal((await (await request('/api/presence')).json()).activeUsers, 0);
});

test('missing name columns surface an actionable API error without exposing source records', async t => {
  const { request } = await setup(t, {
    dashboardOptions: {
      fetchImpl: async () => Response.json({ value: [row({ crbf2_studentname: undefined })] }),
    },
  });
  const response = await request('/api/dashboard');
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.code, 'STUDENT_NAME_REQUIRED');
  assert.match(body.message, /crbf2_studentname/);
  assert.equal(body.students, undefined);
});

test('rejected login does not create sessions or login activity', async t => {
  const { request, signIn } = await setup(t, { verified: false });
  const response = await signIn();
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal((await (await request('/api/presence')).json()).recentLogins.length, 0);
});

test('activity window, distinct students and session expiry use exact time boundaries', async t => {
  let time = Date.parse('2026-10-30T01:00:00Z');
  const store = createDashboardStore({ now: () => time });
  const { request, signIn } = await setup(t, { store });
  const first = await signIn();
  const cookie = first.headers.get('set-cookie').split(';')[0];
  await signIn();
  assert.equal(store.presence().activeUsers, 1);
  assert.equal(store.presence().recentLoginUsers, 1);
  time += 5 * 60000;
  assert.equal(store.presence().activeUsers, 0);
  assert.equal((await request('/api/session/heartbeat', { method: 'POST', headers: { Cookie: cookie } })).status, 200);
  assert.equal(store.presence().activeUsers, 1);
  time += 12 * 60 * 60000;
  assert.equal((await request('/api/session/heartbeat', { method: 'POST', headers: { Cookie: cookie } })).status, 401);
  assert.equal(store.presence().activeUsers, 0);
});

test('session mutations reject cross-origin requests and API methods are enforced', async t => {
  const { request, signIn } = await setup(t);
  const login = await signIn();
  const cookie = login.headers.get('set-cookie').split(';')[0];
  for (const route of ['/api/session/heartbeat', '/api/session/logout']) {
    assert.equal((await request(route, { method: 'POST', headers: { Cookie: cookie, Origin: 'https://other.example' } })).status, 403);
    assert.equal((await request(route)).status, 405);
  }
  assert.equal((await request('/api/dashboard', { method: 'POST' })).status, 405);
  assert.equal((await request('/api/presence', { method: 'POST' })).status, 405);
});

test('expired cached data is not returned as success after refresh failure', async t => {
  let time = 0;
  let requests = 0;
  const { request } = await setup(t, {
    dashboardOptions: {
      now: () => time, cacheMs: 1000,
      fetchImpl: async () => {
        if (++requests > 1) throw new Error('offline');
        return Response.json({ value: [row()] });
      },
    },
  });
  assert.equal((await request('/api/dashboard')).status, 200);
  time = 1000;
  assert.equal((await request('/api/dashboard')).status, 502);
});

test('configured dashboard timeout aborts an in-flight upstream request', async t => {
  const { request } = await setup(t, {
    dashboardOptions: {
      timeoutMs: 10,
      fetchImpl: (url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      }),
    },
  });
  const response = await request('/api/dashboard');
  assert.equal(response.status, 504);
  assert.equal((await response.json()).code, 'DASHBOARD_TIMEOUT');
});

// 스튜디오가 Dataverse에 저장하는 기록(crbf2_studiostate)은 JSON 문자열이며, 통과한 레벨은 passed에 담깁니다.
const studioState = (passed, extra = {}) => JSON.stringify({ v: 1, passed, ...extra });

test('the level is the one the learner is working on in the studio, taken from the saved studio record', () => {
  // 현풍중학교 30303 임재성: Dataverse 레벨은 1이지만 스튜디오에서는 1~3레벨을 통과해 Lv.4를 학습 중입니다.
  const [shown] = latestStudents({ value: [row({
    crbf2_currentlevel: 1, crbf2_learningpoints: 565,
    crbf2_studiostate: studioState({ 1: 'exam', 2: 'quiz', 3: 'quiz' }),
  })] });
  assert.equal(shown.level, 4);
  assert.equal(shown.levelSource, 'studio');
  assert.equal(shown.points, 565);
});

test('without a readable studio record the level stays as Dataverse stores it', () => {
  const unreadable = [undefined, null, '', '   ', 'not json', '[]', '"text"', '123', 'null', '{"passed":[]}', '{"passed":"1"}', 7, {}];
  for (const state of unreadable) {
    const [shown] = latestStudents({ value: [row({ crbf2_currentlevel: 2, crbf2_studiostate: state })] });
    assert.deepEqual([shown.level, shown.levelSource], [2, 'dataverse'], JSON.stringify(state));
  }
  const [stored] = latestStudents({ value: [row({ crbf2_currentlevel: 16 })] });
  assert.deepEqual([stored.level, stored.levelSource], [16, 'dataverse'], 'a recorded level is shown as stored');
});

test('the studio level is the first level that has not been passed and stops at the last level', () => {
  const levels = studioCatalog.tracks.length;
  const passedThrough = count => Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, 'quiz']));
  const cases = [
    [{}, 1], [{ 1: 'exam' }, 2], [{ 1: 'exam', 2: 'quiz', 3: 'quiz' }, 4],
    [{ 1: 'placement', 2: 'placement', 3: 'jump', 4: 'jump', 5: 'quiz' }, 6],
    [{ 1: 'exam', 2: 'exam', 4: 'exam' }, 3],
    [{ 2: 'exam' }, 1],
    [passedThrough(levels - 1), levels],
    [passedThrough(levels), levels],
    [passedThrough(levels + 5), levels],
  ];
  for (const [passed, level] of cases) assert.equal(studioLevel(studioState(passed)), level, JSON.stringify(passed));
  assert.equal(studioLevel('{"v":1}'), 1, 'a record that passed nothing starts at level 1');
});

test('the dashboard reads the same level the studio shows for every kind of saved record', () => {
  const model = studioProgress.createModel(studioCatalog.tracks);
  let state = studioProgress.freshProgress();
  const check = () => {
    const saved = studioSync.encodeState(studioSync.pickProgress(state));
    assert.equal(studioLevel(saved), Math.min(model.currentLevel(state), model.levelCount));
  };
  check();
  const how = ['exam', 'quiz', 'jump', 'placement'];
  for (let level = 1; level <= model.levelCount; level++) {
    state = model.passLevel(state, level, how[level % how.length], '2026-11-14').state;
    check();
  }
  assert.equal(model.currentLevel(state), model.levelCount + 1);
});

test('the newest row decides the level and rows that disagree at the same time are rejected', () => {
  const early = row({ modifiedon: '2026-10-30T01:00:00Z', crbf2_studiostate: studioState({ 1: 'exam' }) });
  const later = row({ modifiedon: '2026-10-31T01:00:00Z', crbf2_studiostate: studioState({ 1: 'exam', 2: 'quiz' }) });
  assert.equal(latestStudents({ value: [early, later] })[0].level, 3);
  assert.equal(latestStudents({ value: [later, early] })[0].level, 3);
  const withoutRecord = row({ modifiedon: '2026-11-01T01:00:00Z', crbf2_currentlevel: 2 });
  const [newest] = latestStudents({ value: [later, withoutRecord] });
  assert.deepEqual([newest.level, newest.levelSource], [2, 'dataverse'], 'a newer row without a studio record is not replaced by an older one');
  assert.throws(
    () => latestStudents({ value: [row(), row({ crbf2_studiostate: studioState({ 1: 'exam' }) })] }),
    error => error.code === 'AMBIGUOUS_STUDENT_RECORD',
  );
});

test('the dashboard API shows the studio level and its source without exposing the saved studio record', async t => {
  const secret = 'private-mistake-reason';
  const state = studioState({ 1: 'exam', 2: 'quiz', 3: 'quiz' }, { mistakes: { l04_01: { reason: secret, coach: false } } });
  const { request } = await setup(t, {
    dashboardOptions: {
      fetchImpl: async () => Response.json({ value: [
        row({ crbf2_currentlevel: 1, crbf2_studiostate: state }),
        row({ crbf2_studentnumber: '00456', crbf2_currentlevel: 1 }),
      ] }),
    },
  });
  const body = await (await request('/api/dashboard')).json();
  assert.deepEqual(body.students.map(s => [s.level, s.levelSource]).sort(), [[1, 'dataverse'], [4, 'studio']]);
  assert.equal(body.summary.averageLevel, 2.5);
  const text = JSON.stringify(body);
  for (const hidden of [secret, 'studiostate', 'mistakes', 'passed']) assert.equal(text.includes(hidden), false, hidden);
});
