const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { getLearningGuide } = require('../learning-guide');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.value = '';
    this.hidden = false;
    this.ownText = '';
  }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  get firstElementChild() { return this.children[0] || null; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) { this.ownText = ''; this.children = children; }
  add(child) { this.append(child); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
}

const fixtureStudent = (changes = {}) => ({
  id: 'student-a', alias: '학습자-2F0AB3C0', name: '가상하나', school: '현풍중학교',
  points: 300, level: 5, rank: 1, observedGrowth: 100, modifiedAt: '2026-10-30T06:00:00Z',
  history: [
    { at: '2026-10-29T06:00:00Z', points: 200, level: 4 },
    { at: '2026-10-30T06:00:00Z', points: 300, level: 5 },
  ],
  ...changes,
});
const settled = () => new Promise(resolve => setImmediate(resolve));
// The studio keeps each student's record under its own key (studentStorageKey in studio-core.js): school and student number come from the login cookies.
const studentCookie = `school=${encodeURIComponent('현풍중학교')}; studentId=30202; studentName=${encodeURIComponent('가상하나')}`;
const studioKey = `paco-studio-v3:${encodeURIComponent('현풍중학교')}:30202:${encodeURIComponent('가상하나')}`;

function loadClient(script = 'dashboard.js', { staticMode = false, reportFailure = false, collectedAt, solved, passed, cookie = studentCookie, guides = false, stage = 3 } = {}) {
  const nodes = new Map();
  const errors = [];
  const requests = [];
  const students = [fixtureStudent(), fixtureStudent({
    id: 'student-b', alias: '학습자-ABC12345', school: '도원중학교', points: 200, rank: 2,
  })];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  node('learning-template').content = { cloneNode: () => new Element() };
  const document = {
    currentScript: { src: 'https://example.test/paco-pythonCoach/' + script }, hidden: false, cookie,
    getElementById: node, createElement: tag => new Element(tag),
    createElementNS: (namespace, tag) => new Element(tag), addEventListener() {},
  };
  const responses = {
    '/reports/dashboard.json': {
      mode: 'static', students, schools: students.map(student => student.school),
      collectedAt: collectedAt || new Date().toISOString(), historyNote: '이번 배포의 단일 관측값입니다.',
    },
    '/reports/learning-guides.json': { mode: 'static', guides: { 3: getLearningGuide(3), 4: getLearningGuide(4) } },
    '/api/dashboard': {
      students, schools: students.map(student => student.school), collectedAt: students[0].modifiedAt,
    },
    '/api/presence': {
      activeUsers: 1, generatedAt: students[0].modifiedAt, trackingStartedAt: students[0].modifiedAt,
      recentLoginUsers: 2,
      recentLogins: students.map(student => ({ ...student, lastLoginAt: student.modifiedAt, active: true })),
    },
    '/api/me/learning': {
      student: students[0], collectedAt: students[0].modifiedAt,
      ranking: { overall: 1, overallStudents: 2, school: 1, schoolStudents: 1 },
      guide: getLearningGuide(stage), historyNote: '서버의 관측 기록입니다.',
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', script), 'utf8'), {
    document, URL, Intl, AbortController,
    window: {
      addEventListener() {}, PcoStudio: require('../public/studio-catalog'),
      // my-learning.html loads learning-guide.js as well; most tests leave it out to show the page does not depend on it.
      ...(guides ? { PcoLearningGuide: require('../learning-guide') } : {}),
      // The studio saves each student's record in this browser: solved problems and passed levels.
      ...(solved || passed ? {
        localStorage: {
          getItem: key => (key === studioKey
            ? JSON.stringify({ solved: Object.fromEntries((solved || []).map(id => [id, { clean: true, points: 5 }])), passed: passed || {} })
            : null),
        },
      } : {}),
      ...(staticMode ? { PcoDeployment: { mode: 'static' } } : {}),
    },
    Option: function (text, value) {
      const option = new Element('option');
      option.textContent = text;
      option.value = value;
      return option;
    },
    fetch: async url => {
      requests.push(String(url));
      if (reportFailure) throw new TypeError('Fixture report unavailable');
      const body = responses[url.pathname.replace('/paco-pythonCoach', '')];
      if (!body) throw new Error('Unexpected request: ' + url);
      return { ok: true, json: async () => body };
    },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() {},
    console: { error(...args) { errors.push(args); } },
  });
  return { node, nodes, students, errors, requests };
}

test('ranking and report mask the middle of names and display only school beneath them', async () => {
  const app = loadClient();
  await settled();
  const row = app.node('ranking-body').children[0];
  assert.equal(row.children[1].children[0].textContent, '가**나');
  assert.equal(row.children[1].children[1].textContent, '현풍중학교');
  assert.equal(row.children[2].textContent, 'Lv.5');
  assert.equal(app.node('report-student').textContent, '가**나');
  assert.equal(app.node('report-school').textContent, '현풍중학교');
  assert.equal(app.node('report-points').textContent, '300');
  assert.equal(app.node('history-body').children.length, 2);
  assert.equal(app.node('growth-chart').firstElementChild.tagName, 'svg');
});

test('student aliases are absent from dashboard text and accessibility labels', async () => {
  const app = loadClient();
  await settled();
  for (const element of app.nodes.values()) {
    assert.doesNotMatch(element.textContent, /학습자-|2F0AB3C0|ABC12345/);
  }
  for (const row of app.node('ranking-body').children) {
    const label = row.children[1].children[0].attributes['aria-label'];
    assert.doesNotMatch(label, /학습자-|2F0AB3C0|ABC12345/);
    assert.match(label, /학교 성장 리포트 보기/);
  }
  assert.equal(app.node('presence-body').children[0].children[0].textContent, '가**나');
  assert.equal(app.node('presence-body').children[0].children[1].textContent, '현풍중학교');
});

test('search matches the visible masked name and the school, never the hidden letters or an alias', async () => {
  const app = loadClient();
  await settled();
  const search = app.node('student-search');
  const count = query => {
    search.value = query;
    search.listeners.input();
    return app.node('ranking-count').textContent;
  };
  assert.match(count('가'), /^2명/);
  assert.match(count('나'), /^2명/);
  assert.match(count('도원'), /^1명/);
  assert.equal(app.node('ranking-body').children[0].children[1].children[1].textContent, '도원중학교');
  for (const hidden of ['가상하나', '상하', '학습자-2F0AB3C0']) assert.equal(count(hidden), '0명', hidden);
});

test('same-name students remain separately selectable by internal student ID', async () => {
  const app = loadClient();
  await settled();
  const secondButton = app.node('ranking-body').children[1].children[1].children[0];
  secondButton.listeners.click();
  assert.equal(app.node('report-student').textContent, '가**나');
  assert.equal(app.node('report-school').textContent, '도원중학교');
  assert.equal(app.node('report-points').textContent, '200');
  assert.equal(app.node('ranking-body').children[1].className, 'selected');
});

test('names keep their first and last letter and hide the rest, whatever the length or script', async () => {
  const cases = [
    ['임재성', '임*성'], ['이수', '이*'], ['남궁민수', '남**수'], ['김', '*'], ['박 서연', '박**연'],
    ['임재성'.normalize('NFD'), '임*성'], ['Alice', 'A***e'], ['Jose\u0301', 'J**é'], ['', '이름 미등록'],
  ];
  for (const [name, masked] of cases) {
    const app = loadClient();
    app.students[0].name = name;
    await settled();
    const button = app.node('ranking-body').children[0].children[1].children[0];
    assert.equal(button.textContent, masked, JSON.stringify(name));
    assert.equal(button.attributes['aria-label'].startsWith(masked + ' · 현풍중학교'), true, JSON.stringify(name));
    assert.equal(app.node('report-student').textContent, masked, JSON.stringify(name));
  }
});

test('no dashboard text or accessibility label contains an unmasked student name', async () => {
  const app = loadClient();
  await settled();
  const seen = [];
  const walk = element => {
    seen.push(element.textContent, ...Object.values(element.attributes));
    element.children.forEach(walk);
  };
  for (const element of app.nodes.values()) walk(element);
  assert.ok(seen.some(text => text.includes('가**나')), 'the masked name is shown');
  for (const text of seen) assert.doesNotMatch(String(text), /가상하나/);
});

test('personal learning page displays school only while retaining name, level and points', async () => {
  const app = loadClient('my-learning.js');
  await settled();
  assert.equal(app.node('my-identity').textContent, '현풍중학교');
  assert.equal(app.node('learner-name').textContent, '가상하나님의 학습 현황');
  assert.equal(app.node('my-level').textContent, 'Lv.5');
  assert.equal(app.node('my-points').textContent, '300점');
  assert.equal(app.node('learning-content').hidden, false);
  for (const element of app.nodes.values()) {
    assert.doesNotMatch(element.textContent, /학습자-|2F0AB3C0/);
  }
  assert.equal(app.errors.length, 0);
});

test('dashboard shows score progress against the full score, a score distribution and the scoring guide', async () => {
  const app = loadClient();
  await settled();
  const pointsCell = app.node('ranking-body').children[0].children[3];
  assert.match(pointsCell.textContent, /^300 · 10%/);
  assert.equal(pointsCell.children[1].attributes['aria-label'], '스튜디오 만점 2,972점 중 10%');
  const bins = app.node('distribution-list').children;
  assert.equal(bins.length, 7);
  assert.equal(bins[2].textContent.startsWith('101~500점'), true);
  assert.match(bins[2].textContent, /2명 · 100%/);
  assert.match(bins[0].textContent, /0명 · 0%/);
  assert.equal(bins[6].children[0].textContent, '만점 2,972점 이상');
  assert.match(app.node('distribution-note').textContent, /스튜디오 만점 2,972점을 기준/);
  const levels = app.node('scoring-body').children.map(row => row.children.map(cell => cell.textContent).join('|'));
  assert.deepEqual(levels, [
    '맛보기|5점|28문제|140점', '입문|10점|65문제|650점', '기초|20점|32문제|640점',
    '응용|30점|10문제|300점', '도전|50점|13문제|650점', '심화|80점|2문제|160점', '연습|2점|216문제|432점',
  ]);
  assert.equal(app.node('scoring-total').textContent, '366문제 · 만점 2,972점');
  assert.equal(app.node('scoring-tracks').children.length, 15);
  assert.match(app.node('scoring-tracks').children[0].children[1].textContent, /핵심 8문제 · 연습 29문제 · /);
  assert.doesNotMatch(app.node('scoring-tracks').children[6].children[1].textContent, /연습/, 'a level without practice problems names none');
  assert.equal(app.node('studio-panels').hidden, false);
  assert.equal(app.errors.length, 0);
});

test('personal page shows score progress, this browser studio progress and the next problems', async () => {
  const app = loadClient('my-learning.js', { solved: ['l01_01', 'l01_02', 'c6001', 'not-a-problem'] });
  await settled();
  assert.equal(app.node('my-tier').textContent, '3단계 / 15단계');
  assert.equal(app.node('my-level-title').textContent, '출력 마스터');
  assert.equal(app.node('score-progress-text').textContent, '300점 / 만점 2,972점 (10%)');
  assert.match(app.node('studio-progress-text').textContent, /핵심 120문제 중 2문제를 해결했어요\. \(연습 1개 해결\)/);
  assert.equal(app.node('track-progress').children.length, 15);
  assert.equal(app.node('track-progress').children[0].children[1].textContent, '2 / 8');
  assert.match(app.node('track-progress').children[2].children[0].textContent, /Lv\.3 · 출력 마스터 \(현재\)/);
  const next = app.node('next-problems').children;
  assert.equal(next.length, 3);
  assert.equal(next[0].children[0].href, 'https://example.test/paco-pythonCoach/new.html?problem=l01_03', 'suggestions follow the levels opened in this browser');
  assert.match(next[0].children[1].textContent, /맛보기 · 5점 · 약 5분 · 실습/);
  assert.equal(app.node('my-scoring-body').children.length, 7);
  assert.equal(app.errors.length, 0);
});

test('personal page without a studio record still recommends problems from the stage the points point to', async () => {
  const app = loadClient('my-learning.js');
  await settled();
  assert.match(app.node('studio-progress-text').textContent, /해결한 스튜디오 문제 기록이 아직 없어요/);
  assert.equal(app.node('next-problems').children[0].children[0].href.endsWith('?problem=l03_01'), true);
});

test('personal page never reads the record another student left on the same browser', async () => {
  const school = encodeURIComponent('현풍중학교');
  const others = [
    `school=${school}; studentId=30203; studentName=${encodeURIComponent('가상하나')}`,
    `school=${school}; studentId=30202; studentName=${encodeURIComponent('다른학생')}`,
    `school=${school}; studentId=30202`,
    '',
  ];
  for (const cookie of others) {
    const app = loadClient('my-learning.js', { solved: ['l01_01', 'l01_02'], passed: { 1: 'exam' }, cookie });
    await settled();
    assert.match(app.node('studio-progress-text').textContent, /해결한 스튜디오 문제 기록이 아직 없어요/, `cookie: ${cookie || 'none'}`);
    assert.doesNotMatch(app.node('track-progress').children[0].children[0].textContent, /통과/);
  }
});

test('personal page recommends from the first level this browser has not passed yet and marks passed levels', async () => {
  const app = loadClient('my-learning.js', { passed: { 1: 'exam', 2: 'placement', 3: 'placement', 4: 'jump' } });
  await settled();
  assert.equal(app.node('next-problems').children[0].children[0].href.endsWith('?problem=l05_01'), true);
  assert.match(app.node('track-progress').children[3].children[0].textContent, /Lv\.4 · 조건문 도전자 · 통과/);
  assert.doesNotMatch(app.node('track-progress').children[4].children[0].textContent, /통과/);
  assert.match(app.node('studio-progress-text').textContent, /해결한 스튜디오 문제 기록이 아직 없어요/, 'no solved problem is invented for levels passed by a test');
});

test('the ranking tells where each level comes from', async () => {
  const app = loadClient();
  app.students[0].levelSource = 'studio';
  await settled();
  const rows = app.node('ranking-body').children;
  assert.equal(rows[0].children[2].title, '스튜디오에서 지금 학습 중인 레벨');
  assert.match(rows[1].children[2].title, /^Dataverse에 기록된 레벨/);
});

test('personal page shows the level the learner is working on in the studio', async () => {
  const app = loadClient('my-learning.js', { stage: 4 });
  Object.assign(app.students[0], { level: 4, levelSource: 'studio', points: 565 });
  await settled();
  assert.equal(app.node('my-level').textContent, 'Lv.4');
  assert.equal(app.node('my-tier').textContent, '4단계 / 15단계');
  assert.equal(app.node('my-level-title').textContent, '조건문 도전자');
  assert.match(app.node('my-level-note').textContent, /스튜디오에서 지금 학습 중인 레벨/);
  assert.equal(app.errors.length, 0);
});

test('personal page without any studio record says the level is the one Dataverse recorded', async () => {
  const app = loadClient('my-learning.js', { guides: true });
  await settled();
  assert.equal(app.node('my-level').textContent, 'Lv.5');
  assert.equal(app.node('my-tier').textContent, '3단계 / 15단계');
  assert.match(app.node('my-level-note').textContent, /Dataverse에 기록된 레벨/);
});

test('personal page follows this browser studio record when the server has none, even if Dataverse says Lv.1', async () => {
  const app = loadClient('my-learning.js', { guides: true, passed: { 1: 'exam', 2: 'quiz', 3: 'quiz' } });
  Object.assign(app.students[0], { level: 1, points: 565 });
  await settled();
  assert.equal(app.node('my-level').textContent, 'Lv.4');
  assert.equal(app.node('my-tier').textContent, '4단계 / 15단계');
  assert.equal(app.node('my-level-title').textContent, '조건문 도전자');
  assert.match(app.node('my-level-note').textContent, /스튜디오에서 지금 학습 중인 레벨/);
  assert.match(app.node('track-progress').children[3].children[0].textContent, /Lv\.4 · 조건문 도전자 \(현재\)/);
  assert.match(app.node('track-progress').children[2].children[0].textContent, /Lv\.3 · 출력 마스터 · 통과/);
  assert.equal(app.errors.length, 0);
});

test('the studio level from the server is only moved up by this browser record, never down', async () => {
  const older = loadClient('my-learning.js', { guides: true, passed: { 1: 'exam', 2: 'quiz' }, stage: 6 });
  Object.assign(older.students[0], { level: 6, levelSource: 'studio' });
  await settled();
  assert.equal(older.node('my-level').textContent, 'Lv.6');
  assert.equal(older.node('my-tier').textContent, '6단계 / 15단계');

  const ahead = loadClient('my-learning.js', { guides: true, passed: { 1: 'exam', 2: 'quiz', 3: 'quiz', 4: 'jump' }, stage: 3 });
  Object.assign(ahead.students[0], { level: 3, levelSource: 'studio' });
  await settled();
  assert.equal(ahead.node('my-level').textContent, 'Lv.5');
  assert.equal(ahead.node('my-tier').textContent, '5단계 / 15단계');
});

test('static personal page shows the chosen learner, not the record of whoever is signed in on this browser', async () => {
  const app = loadClient('my-learning.js', { staticMode: true, guides: true, passed: { 1: 'exam', 2: 'quiz', 3: 'quiz' } });
  await settled();
  app.node('static-school').value = '현풍중학교';
  app.node('static-school').listeners.change();
  app.node('static-student').value = 'student-a';
  app.node('static-student').listeners.change();
  assert.equal(app.node('my-level').textContent, 'Lv.5');
  assert.match(app.node('my-level-note').textContent, /Dataverse에 기록된 레벨/);
});

test('static personal page uses the guide of the studio level when the report says the level came from the studio', async () => {
  const app = loadClient('my-learning.js', { staticMode: true });
  Object.assign(app.students[0], { level: 4, levelSource: 'studio' });
  await settled();
  app.node('static-school').value = '현풍중학교';
  app.node('static-school').listeners.change();
  app.node('static-student').value = 'student-a';
  app.node('static-student').listeners.change();
  assert.equal(app.node('my-level').textContent, 'Lv.4');
  assert.equal(app.node('my-tier').textContent, '4단계 / 15단계');
  assert.equal(app.node('my-level-title').textContent, '조건문 도전자');
  assert.equal(app.errors.length, 0);
});

test('static report uses the repository-relative snapshot, hides presence and preserves ranking selection', async () => {
  const app = loadClient('dashboard.js', { staticMode: true });
  await settled();
  assert.deepEqual(app.requests, ['https://example.test/paco-pythonCoach/reports/dashboard.json']);
  assert.equal(app.node('activity-metric').hidden, true);
  assert.equal(app.node('presence-panel').hidden, true);
  assert.equal(app.node('source-status').textContent, '배포 시점 정적 리포트');
  assert.match(app.node('source-hint').textContent, /실시간 데이터 아님/);
  assert.equal(app.node('ranking-body').children.length, 2);
  app.node('ranking-body').children[1].children[1].children[0].listeners.click();
  assert.equal(app.node('report-school').textContent, '도원중학교');
  assert.match(app.node('public-data-note').textContent, /공개 JSON/);
});

test('static report labels old data and never replaces failed data with sample students', async () => {
  const old = loadClient('dashboard.js', { staticMode: true, collectedAt: '2020-01-01T00:00:00Z' });
  await settled();
  assert.match(old.node('source-hint').textContent, /2시간 경과/);
  assert.equal(old.node('source-status').dataset.state, 'error');
  const failed = loadClient('dashboard.js', { staticMode: true, reportFailure: true });
  await settled();
  assert.equal(failed.node('dashboard-error').hidden, false);
  assert.match(failed.node('source-hint').textContent, /실시간 조회 없이/);
  assert.doesNotMatch(failed.node('ranking-body').textContent, /가상하나/);
  assert.ok(failed.requests.every(url => !url.includes('/api/')));
});

test('static personal page lets a student pick their public record and computes ranks without API calls', async () => {
  const app = loadClient('my-learning.js', { staticMode: true });
  await settled();
  assert.deepEqual(app.requests, [
    'https://example.test/paco-pythonCoach/reports/dashboard.json',
    'https://example.test/paco-pythonCoach/reports/learning-guides.json',
  ]);
  assert.equal(app.node('learning-picker').hidden, false);
  assert.equal(app.node('learning-status').textContent, '학생 선택 필요');
  assert.equal(app.node('learning-refresh').disabled, false);
  assert.equal(app.node('static-school').children.length, 3);
  app.node('static-school').value = '현풍중학교';
  app.node('static-school').listeners.change();
  assert.equal(app.node('static-student').children.length, 2);
  app.node('static-student').value = 'student-a';
  app.node('static-student').listeners.change();
  assert.equal(app.node('learner-name').textContent, '가상하나님의 학습 현황');
  assert.equal(app.node('my-points').textContent, '300점');
  assert.equal(app.node('my-rank').textContent, '1위');
  assert.match(app.node('my-rank-note').textContent, /전체 2명 · 학교 1위 \/ 1명/);
  assert.equal(app.node('learning-status').textContent, '공개 정적 리포트 기준');
  assert.ok(app.requests.every(url => !url.includes('/api/')));
});

test('static personal page reports failures instead of showing stale records', async () => {
  const app = loadClient('my-learning.js', { staticMode: true, reportFailure: true });
  await settled();
  assert.equal(app.node('learning-status').textContent, '리포트 조회 실패');
  assert.equal(app.node('learning-error').hidden, false);
  assert.equal(app.node('learning-picker').hidden, true);
});
