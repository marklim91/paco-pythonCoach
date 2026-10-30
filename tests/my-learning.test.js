const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createDashboardStore } = require('../dashboard-store');
const { createLoginHandler } = require('../login-api');
const { createServer } = require('../server');
const { getLearningGuide } = require('../learning-guide');

const flowUrl = 'https://test.environment.api.powerplatform.com/invoke';
const learner = { school: '현풍중학교', studentId: '00123', studentName: '가상하나' };
const otherSchoolLearner = { school: '도원중학교', studentId: '00123', studentName: '가상셋' };
const row = (changes = {}) => ({
  crbf2_studentlearningrecordid: '11111111-1111-4111-8111-111111111111',
  crbf2_schoolname: learner.school,
  crbf2_studentnumber: learner.studentId,
  crbf2_studentname: learner.studentName,
  crbf2_currentlevel: 5,
  crbf2_learningpoints: 150,
  crbf2_isactive: true,
  modifiedon: '2026-10-30T01:00:00Z',
  ...changes,
});

async function setup(t, options = {}) {
  const clock = { value: Date.parse('2026-10-30T06:00:00Z') };
  const now = () => clock.value;
  const source = { rows: [
    row(),
    row({
      crbf2_studentlearningrecordid: '22222222-2222-4222-8222-222222222222',
      crbf2_studentnumber: '00999', crbf2_studentname: '가상둘', crbf2_learningpoints: 500,
    }),
    row({
      crbf2_studentlearningrecordid: '33333333-3333-4333-8333-333333333333',
      crbf2_schoolname: otherSchoolLearner.school, crbf2_studentname: otherSchoolLearner.studentName,
      crbf2_learningpoints: 100,
    }),
  ] };
  const calls = [];
  const store = createDashboardStore({ now });
  const loginHandler = createLoginHandler({
    flowUrl, onVerified: store.login, fetchImpl: async () => Response.json({ verified: true }),
  });
  const server = createServer({
    loginHandler, dashboardStore: store,
    dashboardOptions: {
      flowUrl, now, logger: { error() {} },
      fetchImpl: async () => {
        calls.push(clock.value);
        return options.sourceResponse ? options.sourceResponse() : Response.json({ value: source.rows });
      },
      ...options.dashboardOptions,
    },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = (route, init) => fetch(`http://127.0.0.1:${server.address().port}${route}`, init);
  async function signIn(student = learner, cookie) {
    const response = await request('/api/login/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(student),
    });
    assert.equal(response.status, 200);
    await response.json();
    return response.headers.get('set-cookie').split(';')[0];
  }
  const personal = cookie => request('/api/me/learning', { headers: { Cookie: cookie } });
  return { request, signIn, personal, source, clock, calls };
}

test('all 15 learning guides match existing roadmap titles and have actionable goals and practice', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'v3_4', 'roadmap.html'), 'utf8');
  const titles = [...html.matchAll(/class="name">([^<]+)</g)].map(match => match[1]);
  assert.equal(titles.length, 15);
  for (let level = 1; level <= 15; level++) {
    const guide = getLearningGuide(level);
    assert.equal(guide.current.level, level);
    assert.equal(guide.current.title, titles[level - 1]);
    assert.equal(guide.current.goals.length, 3);
    assert.equal(guide.roadmap.length, 15);
    assert.equal(guide.status, level === 15 ? 'last-level' : 'next-level');
    assert.equal(guide.next?.level ?? null, level === 15 ? null : level + 1);
    assert.deepEqual(guide.practice, (guide.next || guide.current).practice);
    assert.ok(guide.practice.task.length > 10);
    assert.ok(guide.practice.checks.length >= 2);
    assert.equal(new URL(guide.current.reading.url).hostname, 'docs.python.org');
    assert.match(guide.promotionNote, /점수와 평가 기준은 연결된 데이터에 없습니다/);
    assert.match(guide.recommendationNote, /취약점을 분석한 결과는 아닙니다/);
    for (const field of ['remainingXp', 'completionPercent', 'weaknesses', 'completed']) {
      assert.equal(Object.hasOwn(guide, field), false);
    }
  }
});

test('unmapped levels do not invent a current or next curriculum stage', () => {
  for (const level of [0, 16, 999, -1, 1.5, '5', null]) {
    const guide = getLearningGuide(level);
    assert.equal(guide.status, 'unmapped');
    assert.equal(guide.current, null);
    assert.equal(guide.next, null);
    assert.equal(guide.practice, null);
  }
});

test('learning guide values are independent between requests', () => {
  const first = getLearningGuide(5);
  first.next.goals.length = 0;
  first.roadmap[0].title = 'changed';
  assert.equal(getLearningGuide(5).next.goals.length, 3);
  assert.equal(getLearningGuide(1).roadmap[0].title, 'Python 입문자');
});

test('missing or forged server sessions cannot read personal data or trigger the source', async t => {
  const app = await setup(t);
  for (const cookie of ['', 'school=' + encodeURIComponent(learner.school) + '; studentId=00123',
    'pco_session=' + 'a'.repeat(64), 'pco_session=invalid']) {
    const response = await app.personal(cookie);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).code, 'SESSION_REQUIRED');
  }
  assert.equal(app.calls.length, 0);
});

test('personal API returns only the session student with actual values and no original identifiers', async t => {
  const app = await setup(t);
  const cookie = await app.signIn();
  const response = await app.personal(cookie);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.student.name, learner.studentName);
  assert.equal(body.student.school, learner.school);
  assert.equal(body.student.points, 150);
  assert.equal(body.student.level, 5);
  assert.equal(body.student.observedGrowth, null);
  assert.equal(body.student.history.length, 1);
  assert.deepEqual(body.ranking, { overall: 2, overallStudents: 3, school: 2, schoolStudents: 2 });
  assert.equal(body.guide.next.title, '함수 설계자');
  assert.equal(body.guide.next.level, 6);
  assert.equal(body.collectedAt, new Date(app.clock.value).toISOString());
  const encoded = JSON.stringify(body);
  for (const excluded of ['가상둘', '가상셋', 'studentId', 'crbf2_studentlearningrecordid', '11111111-1111-4111-8111-111111111111', cookie]) {
    assert.equal(encoded.includes(excluded), false);
  }
  assert.equal(Object.hasOwn(body, 'students'), false);
});

test('student identity includes school and ignores editable display cookies', async t => {
  const app = await setup(t);
  const firstCookie = await app.signIn();
  const secondCookie = await app.signIn(otherSchoolLearner);
  const first = await (await app.personal(firstCookie + '; school=' + encodeURIComponent(otherSchoolLearner.school) + '; studentId=00999')).json();
  const second = await (await app.personal(secondCookie)).json();
  assert.equal(first.student.name, learner.studentName);
  assert.equal(second.student.name, otherSchoolLearner.studentName);
  assert.notEqual(first.student.id, second.student.id);
  assert.equal(second.ranking.school, 1);
  assert.equal(app.calls.length, 1);
});

test('personal endpoint refuses client selectors and non-GET methods', async t => {
  const app = await setup(t);
  const cookie = await app.signIn();
  for (const query of ['studentId=00999', 'school=other', 'id=other', 'refresh=1']) {
    const response = await app.request('/api/me/learning?' + query, { headers: { Cookie: cookie } });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'PERSONAL_QUERY_NOT_ALLOWED');
  }
  const response = await app.request('/api/me/learning', { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal(app.calls.length, 0);
});

test('personal ranks use competition ranking globally and within school', async t => {
  const app = await setup(t);
  app.source.rows[0].crbf2_learningpoints = 500;
  const cookie = await app.signIn();
  const body = await (await app.personal(cookie)).json();
  assert.equal(body.ranking.overall, 1);
  assert.equal(body.ranking.school, 1);
  const thirdCookie = await app.signIn(otherSchoolLearner);
  assert.equal((await (await app.personal(thirdCookie)).json()).ranking.overall, 3);
});

test('personal and whole-student dashboards share the source cache and observed growth', async t => {
  const app = await setup(t);
  const cookie = await app.signIn();
  await (await app.request('/api/dashboard')).json();
  const initial = await (await app.personal(cookie)).json();
  assert.equal(initial.student.observedGrowth, null);
  assert.equal(app.calls.length, 1);
  app.clock.value += 61000;
  app.source.rows[0].crbf2_learningpoints = 250;
  app.source.rows[0].crbf2_currentlevel = 6;
  app.source.rows[0].modifiedon = new Date(app.clock.value).toISOString();
  const updated = await (await app.personal(cookie)).json();
  assert.equal(updated.student.points, 250);
  assert.equal(updated.student.observedGrowth, 100);
  assert.deepEqual(updated.student.history.map(sample => sample.points), [150, 250]);
  assert.equal(updated.guide.current.level, 6);
  assert.equal(updated.guide.next.level, 7);
  assert.equal(app.calls.length, 2);
});

test('missing and latest inactive records do not fall back to another student or an older active row', async t => {
  const app = await setup(t);
  const cookie = await app.signIn();
  app.source.rows = app.source.rows.filter(source => source.crbf2_studentname !== learner.studentName);
  let response = await app.personal(cookie);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, 'LEARNING_RECORD_NOT_FOUND');
  app.clock.value += 61000;
  app.source.rows.push(row(), row({ crbf2_isactive: false, modifiedon: new Date(app.clock.value).toISOString() }));
  response = await app.personal(cookie);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, 'LEARNING_RECORD_NOT_FOUND');
});

test('expired and logged-out server sessions cannot read even cached personal data', async t => {
  const app = await setup(t);
  const cookie = await app.signIn();
  await (await app.personal(cookie)).json();
  app.clock.value += 12 * 60 * 60 * 1000;
  assert.equal((await app.personal(cookie)).status, 401);
  const nextCookie = await app.signIn();
  await (await app.personal(nextCookie)).json();
  const logout = await app.request('/api/session/logout', { method: 'POST', headers: { Cookie: nextCookie } });
  assert.equal(logout.status, 200);
  assert.equal((await app.personal(nextCookie)).status, 401);
  assert.equal(app.calls.length, 2);
});

test('session revoked during source loading cannot receive a personal result', async t => {
  let release;
  let announceStarted;
  const started = new Promise(resolve => { announceStarted = resolve; });
  const app = await setup(t, {
    sourceResponse: () => new Promise(resolve => {
      release = () => resolve(Response.json({ value: [row()] }));
      announceStarted();
    }),
  });
  const cookie = await app.signIn();
  const pending = app.personal(cookie);
  await started;
  const logout = await app.request('/api/session/logout', { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(logout.status, 200);
  release();
  const response = await pending;
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'SESSION_REQUIRED');
});

test('personal source failures remain explicit instead of returning empty or example records', async t => {
  const app = await setup(t, {
    sourceResponse: () => new Response('unavailable', { status: 503 }),
  });
  const response = await app.personal(await app.signIn());
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.code, 'DASHBOARD_FLOW_HTTP_ERROR');
  assert.equal(Object.hasOwn(body, 'student'), false);
});

test('personal source configuration is required only after a valid session', async t => {
  const app = await setup(t, { dashboardOptions: { flowUrl: '' } });
  assert.equal((await app.personal('')).status, 401);
  const response = await app.personal(await app.signIn());
  assert.equal(response.status, 503);
  assert.equal(Object.hasOwn(await response.json(), 'student'), false);
  assert.equal(app.calls.length, 0);
});

test('last and out-of-roadmap levels preserve actual source levels without invented promotion', async t => {
  const app = await setup(t);
  const cookie = await app.signIn();
  for (const level of [1, 15, 0, 16]) {
    app.source.rows[0].crbf2_currentlevel = level;
    app.source.rows[0].modifiedon = new Date(app.clock.value).toISOString();
    const response = await app.personal(cookie);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.student.level, level);
    assert.equal(body.guide.status, level === 15 ? 'last-level' : level === 1 ? 'next-level' : 'unmapped');
    assert.equal(body.guide.next?.level ?? null, level === 1 ? 2 : null);
    app.clock.value += 61000;
  }
});

test('personal page and aliases serve a static shell without embedding student data', async t => {
  const app = await setup(t);
  for (const route of ['/my-learning.html', '/my-learning', '/' + encodeURIComponent('내학습')]) {
    const response = await app.request(route);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /내 학습 현황/);
    assert.match(html, /my-learning.js/);
    assert.equal(html.includes(learner.studentName), false);
  }
  assert.equal(app.calls.length, 0);
});
