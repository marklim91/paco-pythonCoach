const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const sync = require('../public/studio-sync');
const progress = require('../public/studio-progress');

// 실제 studio-core.js 의 readProgress 로 서버 기록을 검사해 화면과 같은 규칙을 씁니다.
const context = vm.createContext({ PcoStudio: require('../public/studio-catalog'), PcoProgress: progress, URL, URLSearchParams, AbortSignal });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'studio-core.js'), 'utf8'), context);
const readProgress = vm.runInContext('readProgress', context);
const plain = value => JSON.parse(JSON.stringify(value));

const URL_OF_FLOW = 'https://x.api.powerplatform.com/flow?sig=test';
const student = { school: '현풍중학교', studentId: '30202', studentName: '테스트' };
const entry = (points = 5, extra = {}) => ({ clean: true, first: true, peek: false, coach: false, hints: 0, tries: 1, points, ...extra });
const fresh = () => progress.freshProgress();

// ---- 시험용 도구: 가짜 시계, 가짜 서버 흐름, 가짜 화면 ------------------------------------------
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
function createClock() {
  let now = 0;
  let nextId = 1;
  const pending = new Map();
  return {
    timers: {
      set(fn, ms) { const id = nextId++; pending.set(id, { at: now + ms, fn }); return id; },
      clear(id) { pending.delete(id); },
      now: () => now,
    },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...pending.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        pending.delete(due[0]);
        now = due[1].at;
        due[1].fn();
        await settle();
      }
      now = end;
      await settle();
    },
    pending: () => pending.size,
  };
}
// 흐름의 약속(README)을 그대로 따르는 가짜 서버입니다: load 는 {revision, state}, save 는 번호가 맞을 때만 저장합니다.
function createFlow(initial = {}) {
  const row = { revision: 0, state: '', gems: null, ...initial };
  const flow = {
    row, calls: [], failNext: 0, lostAckNext: false, override: null,
    async fetchImpl(url, init) {
      const body = JSON.parse(init.body);
      flow.calls.push({ url, init, body });
      if (flow.failNext > 0) { flow.failNext--; throw new TypeError('Failed to fetch'); }
      const reply = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
      if (flow.override) return reply(flow.override.status, flow.override.body);
      if (body.action === 'load') return reply(200, { revision: row.revision, points: 120, state: row.state });
      if (body.action === 'save') {
        if (body.baseRevision !== row.revision) return reply(200, { saved: false, revision: row.revision, state: row.state });
        row.revision += 1;
        row.state = body.state;
        row.gems = body.gems;
        if (flow.lostAckNext) { flow.lostAckNext = false; throw new TypeError('Failed to fetch'); }
        return reply(200, { saved: true, revision: row.revision });
      }
      return reply(400, {});
    },
    saves: () => flow.calls.filter(call => call.body.action === 'save'),
    loads: () => flow.calls.filter(call => call.body.action === 'load'),
    stored: () => (row.state ? JSON.parse(row.state) : null),
  };
  return flow;
}
// 화면 대신 상태 하나를 들고, 서버 기록을 합치는 일도 앱과 똑같이 합니다. 앱이 사본에 남기는 기준 기록·미확인 저장도 흉내 냅니다.
function createApp(flow, clock, { initial = {}, initialBase = null, initialAttempts = [] } = {}) {
  const app = {
    state: { ...fresh(), codes: {}, selected: 'l01_01', ...initial },
    statuses: [], bases: [], attemptLists: [], conflicts: 0,
    update(patch) { app.state = { ...app.state, ...patch }; app.engine.notify(); },
    // 화면을 닫았다가 다시 열 때 사본에서 읽어 오는 값입니다.
    persisted: () => ({ initialBase: app.bases.at(-1) || initialBase, initialAttempts: app.attemptLists.at(-1) || initialAttempts, state: app.state }),
  };
  app.engine = sync.createSync({
    url: URL_OF_FLOW, student, fetchImpl: (...args) => flow.fetchImpl(...args), timers: clock.timers, initialBase, initialAttempts, readProgress,
    getProgress: () => app.state,
    applyRemote: (remote, base) => { app.state = { ...app.state, ...sync.mergeProgress(sync.pickProgress(app.state), remote, base) }; },
    onStatus: (status, detail) => app.statuses.push(detail ? `${status}:${detail.kind}` : status),
    onBase: base => app.bases.push(plain(base)),
    onAttempts: list => app.attemptLists.push(list),
    onConflict: () => { app.conflicts++; },
  });
  return app;
}
const serverState = progressPart => JSON.stringify({ v: sync.STATE_VERSION, ...fresh(), ...progressPart });

// ---- 기록 고르기·비교 ----------------------------------------------------------------
test('only the learning record is synced: drafts, selection and addresses stay on the device', () => {
  const picked = sync.pickProgress({ ...fresh(), codes: { l01_01: 'print(1)' }, selected: 'l01_01', coachUrl: 'https://example.com', pointsUrl: 'https://x.api.powerplatform.com/a', awarded: ['a'] });
  assert.deepEqual(Object.keys(picked).sort(), Object.keys(fresh()).sort());
  assert.equal(sync.FIELDS.length, Object.keys(fresh()).length, 'every progress field is listed');
});

test('canonical text ignores key order but not content', () => {
  assert.equal(sync.canonical({ b: 1, a: { d: [1, { y: 1, x: 2 }], c: null } }), sync.canonical({ a: { c: null, d: [1, { x: 2, y: 1 }] }, b: 1 }));
  assert.notEqual(sync.canonical({ a: 1 }), sync.canonical({ a: 2 }));
  assert.notEqual(sync.canonical({ a: [1, 2] }), sync.canonical({ a: [2, 1] }));
});

test('server records are decoded with the screen rules and newer or broken records are refused', () => {
  const decoded = sync.decodeState(serverState({ gems: 7, solved: { l01_01: entry() } }), readProgress);
  assert.equal(decoded.gems, 7);
  assert.equal(decoded.solved.l01_01.points, 5);
  assert.equal(sync.decodeState(JSON.stringify({ gems: 3 }), readProgress).gems, 3, 'a record without a version is version 1');
  for (const text of ['{broken', '[]', JSON.stringify({ v: 2 }), JSON.stringify({ v: 1, gems: -1 }), JSON.stringify({ v: 1, solved: { l01_01: { clean: 'yes' } } })]) {
    assert.throws(() => sync.decodeState(text, readProgress), error => error.kind === 'corrupt', text);
  }
  assert.deepEqual(Object.keys(sync.decodeState(serverState({ solved: { gone: entry(), l01_01: entry() } }), readProgress).solved), ['l01_01'], 'problems that no longer exist are dropped');
});

// ---- 두 기록 합치기 ------------------------------------------------------------------
test('merging keeps every solved problem and passed level from both sides', () => {
  const local = { ...fresh(), solved: { l01_01: entry(5), c6001: entry(2) }, passed: { 1: 'placement', 2: 'exam' }, daily: { '2026-11-14': 10 }, hintsUsed: { l01_01: 1 }, tries: { l01_01: 2 }, peeked: { c6001: true } };
  const remote = { ...fresh(), solved: { l01_01: entry(2, { peek: true }), l01_02: entry(5) }, passed: { 1: 'quiz', 3: 'jump' }, daily: { '2026-11-14': 30, '2026-11-13': 8 }, hintsUsed: { l01_01: 2 }, tries: { l01_01: 1 }, coachUsed: { l01_02: true }, placementDone: true };
  const merged = sync.mergeProgress(local, remote, fresh());
  assert.deepEqual(Object.keys(merged.solved).sort(), ['c6001', 'l01_01', 'l01_02']);
  assert.equal(merged.solved.l01_01.points, 5, 'the better result of the same problem wins');
  assert.deepEqual(plain(merged.passed), { 1: 'quiz', 2: 'exam', 3: 'jump' }, 'a level keeps the stronger way it was passed');
  assert.deepEqual(plain(merged.daily), { '2026-11-14': 30, '2026-11-13': 8 });
  assert.deepEqual([merged.hintsUsed.l01_01, merged.tries.l01_01], [2, 2]);
  assert.deepEqual([plain(merged.peeked), plain(merged.coachUsed)], [{ c6001: true }, { l01_02: true }]);
  assert.equal(merged.placementDone, true);
});

test('gems add what each side changed since the last sync instead of taking the larger or the newer value', () => {
  const base = { ...fresh(), gems: 10 };
  assert.equal(sync.mergeProgress({ ...base, gems: 14 }, { ...base, gems: 12 }, base).gems, 16, 'earned +4 here and +2 there');
  assert.equal(sync.mergeProgress({ ...base, gems: 8 }, { ...base, gems: 13 }, base).gems, 11, 'spent 2 here, earned 3 there');
  assert.equal(sync.mergeProgress({ ...base, gems: 14 }, { ...base, gems: 10 }, base).gems, 14, 'nothing changed on the server');
  assert.equal(sync.mergeProgress({ ...base, gems: 10 }, { ...base, gems: 9 }, base).gems, 9, 'nothing changed here');
  assert.equal(sync.mergeProgress({ ...base, gems: 0 }, { ...base, gems: 4 }, base).gems, 0, 'never below zero');
  assert.equal(sync.mergeProgress({ ...fresh(), gems: 16 }, { ...fresh(), gems: 20 }, null).gems, 26, 'without a base the start gems are the base');
  assert.equal(sync.mergeProgress({ ...base, freeze: 1 }, { ...base, freeze: 2 }, { ...base, freeze: 1 }).freeze, 2, 'the same for streak protections');
});

test('the newer study day decides the streak and solved problems leave the mistake notebook', () => {
  const local = { ...fresh(), streak: 2, lastDay: '2026-11-14', mistakes: { l01_01: { reason: '줄 수', coach: false }, l01_02: { reason: '띄어쓰기', coach: false }, l01_03: { reason: '대소문자', coach: true } } };
  const remote = { ...fresh(), streak: 5, lastDay: '2026-11-15', solved: { l01_01: entry(), l01_03: entry() }, coachUsed: { l01_03: true }, combo: 4 };
  const merged = sync.mergeProgress(local, remote, fresh());
  assert.deepEqual([merged.streak, merged.lastDay], [5, '2026-11-15']);
  assert.deepEqual(Object.keys(merged.mistakes).sort(), ['l01_02', 'l01_03']);
  assert.deepEqual(plain(merged.mistakes.l01_03), { reason: '대소문자', coach: true, resolved: true }, 'solved after talking to the coach stays as a reviewed mistake');
  assert.equal(merged.combo, 0, 'the combo is a live value of this screen');
  assert.deepEqual([sync.mergeProgress({ ...fresh(), streak: 3, lastDay: '2026-11-15' }, { ...fresh(), streak: 3, lastDay: '2026-11-15' }, null).streak], [3]);
});

test('merging a record with itself changes nothing', () => {
  const same = { ...fresh(), gems: 13, solved: { l01_01: entry() }, passed: { 1: 'quiz' }, hintsUsed: { l01_01: 1 }, tries: { l01_01: 1 }, streak: 2, lastDay: '2026-11-14', daily: { '2026-11-14': 5 } };
  assert.equal(sync.canonical(sync.mergeProgress(same, same, same)), sync.canonical(same));
  const staleBase = { ...fresh(), gems: 10 };
  assert.equal(sync.canonical(sync.mergeProgress(same, same, staleBase)), sync.canonical(same), 'two records that already agree are not added to each other, even with an old base');
});

// ---- 불러오기와 저장 -------------------------------------------------------------------
test('a learner without a server record loads quietly and is saved only after the first real change', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  assert.equal(await app.engine.start(), 'synced');
  assert.deepEqual(flow.loads()[0].body, { action: 'load', ...student });
  app.update({ codes: { l01_01: 'print(1)' }, selected: 'l01_02' });
  await clock.advance(10000);
  assert.equal(flow.saves().length, 0, 'drafts and the selected problem are not part of the record');
  app.update({ gems: 12, solved: { l01_01: entry() } });
  assert.equal(app.engine.getStatus().status, 'pending');
  await clock.advance(sync.DEBOUNCE_MS - 1);
  assert.equal(flow.saves().length, 0, 'saving waits for the learner to pause');
  await clock.advance(1);
  assert.equal(flow.saves().length, 1);
  const call = flow.saves()[0];
  assert.deepEqual({ ...call.body, state: undefined }, { action: 'save', ...student, baseRevision: 0, gems: 12, state: undefined });
  assert.equal(typeof call.body.state, 'string', 'the flow stores the record as one opaque text');
  const stored = JSON.parse(call.body.state);
  assert.equal(stored.v, 1);
  assert.deepEqual(Object.keys(stored).sort(), ['v', ...sync.FIELDS].sort());
  assert.equal(stored.solved.l01_01.points, 5);
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.headers['Content-Type'], 'application/json');
  assert.equal(call.init.redirect, 'error');
  assert.equal(call.url, URL_OF_FLOW);
  assert.equal(flow.row.revision, 1);
  assert.equal(flow.row.gems, 12);
  assert.equal(app.engine.getStatus().status, 'synced');
  assert.deepEqual(app.bases.at(-1).revision, 1);
  assert.equal(clock.pending(), 0, 'no timer is left running');
});

test('many quick changes become one save and a long session still saves every 20 seconds', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  for (let i = 1; i <= 5; i++) { app.update({ gems: 10 + i }); await clock.advance(500); }
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(flow.saves().length, 1);
  assert.equal(JSON.parse(flow.saves()[0].body.state).gems, 15);
  let gems = 15;
  for (let second = 0; second < 40; second++) { gems += 1; app.update({ gems }); await clock.advance(1000); }
  assert.ok(flow.saves().length >= 3, 'continuous work does not postpone saving forever: ' + flow.saves().length);
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(flow.stored().gems, gems);
});

test('changes made while a save is running are saved right after it', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  const realFetch = flow.fetchImpl;
  const releases = [];
  flow.fetchImpl = (url, init) => (JSON.parse(init.body).action === 'save'
    ? new Promise(resolve => { releases.push(() => resolve(realFetch(url, init))); })
    : realFetch(url, init));
  app.update({ gems: 11 });
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(app.engine.getStatus().status, 'saving');
  app.update({ gems: 12 });
  await clock.advance(sync.DEBOUNCE_MS * 3);
  assert.equal(releases.length, 1, 'only one save runs at a time');
  releases[0]();
  await settle();
  assert.equal(flow.row.revision, 1);
  assert.equal(flow.stored().gems, 11, 'the first save carries the record it started with');
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(releases.length, 2, 'the newer record follows right after');
  releases[1]();
  await settle();
  assert.equal(flow.row.revision, 2);
  assert.equal(flow.stored().gems, 12);
  assert.equal(app.engine.getStatus().status, 'synced');
});

test('a server record is merged into the screen at start, using the last synced record as the base', async () => {
  const flow = createFlow({ revision: 4, state: serverState({ gems: 15, solved: { l01_01: entry() }, passed: { 1: 'quiz' } }) });
  const clock = createClock();
  // 이 브라우저는 보석 10개일 때 맞춰 둔 뒤 +2 를 더 모아 12개가 됐고, 서버에는 다른 기기에서 +5 가 반영돼 있습니다.
  const app = createApp(flow, clock, {
    initial: { gems: 12, solved: { c6001: entry(2) } },
    initialBase: { revision: 3, progress: { ...fresh(), gems: 10 } },
  });
  await app.engine.start();
  assert.equal(app.state.gems, 17);
  assert.deepEqual(Object.keys(app.state.solved).sort(), ['c6001', 'l01_01']);
  assert.deepEqual(plain(app.state.passed), { 1: 'quiz' });
  assert.equal(app.engine.getBase().revision, 4);
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(flow.saves().length, 1, 'what only this browser has is uploaded');
  assert.equal(flow.saves()[0].body.baseRevision, 4);
  assert.deepEqual(Object.keys(flow.stored().solved).sort(), ['c6001', 'l01_01']);
  assert.equal(flow.stored().gems, 17);
});

test('a new device simply receives the server record', async () => {
  const flow = createFlow({ revision: 9, state: serverState({ gems: 31, streak: 4, lastDay: '2026-11-14', solved: { l01_01: entry(), l01_02: entry() } }) });
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  assert.equal(app.state.gems, 31);
  assert.equal(app.state.streak, 4);
  assert.equal(Object.keys(app.state.solved).length, 2);
  await clock.advance(30000);
  assert.equal(flow.saves().length, 0, 'receiving a record is not a change');
});

test('two devices that save at the same time keep each other\'s progress and gems', async () => {
  const flow = createFlow({ revision: 1, state: serverState({ gems: 10, solved: { l01_01: entry() } }) });
  const clock = createClock();
  const phone = createApp(flow, clock);
  const laptop = createApp(flow, clock);
  await phone.engine.start();
  await laptop.engine.start();
  phone.update({ gems: 13, solved: { ...phone.state.solved, l01_02: entry() } });
  laptop.update({ gems: 8, solved: { ...laptop.state.solved, c6001: entry(2) }, hintsUsed: { c6001: 1 } });
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(flow.row.revision, 2, 'the phone saved first');
  assert.equal(laptop.conflicts, 1, 'the laptop met the phone\'s record');
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(flow.row.revision, 3, 'and then saved the merged record');
  assert.deepEqual(Object.keys(flow.stored().solved).sort(), ['c6001', 'l01_01', 'l01_02']);
  assert.equal(flow.stored().gems, 11, '10 + 3 (phone) - 2 (laptop)');
  assert.equal(laptop.state.gems, 11);
  phone.update({ gems: phone.state.gems + 1 });
  await clock.advance(sync.DEBOUNCE_MS * 2);
  assert.equal(phone.conflicts, 1, 'the phone in turn meets the laptop\'s record');
  assert.deepEqual(Object.keys(phone.state.solved).sort(), ['c6001', 'l01_01', 'l01_02']);
  assert.equal(flow.stored().gems, 12, '11 on the server + the 1 gem the phone just earned');
  assert.equal(flow.row.revision, 4);
});

test('a save that reached the server but lost its answer is not counted twice', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  flow.lostAckNext = true;
  app.update({ gems: 14, solved: { l01_01: entry() } });
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(flow.row.revision, 1, 'the server has it');
  assert.equal(app.engine.getStatus().status, 'offline');
  await clock.advance(sync.RETRY_MS[0]);
  assert.equal(app.state.gems, 14, 'no double count');
  assert.equal(app.conflicts, 0, 'it is our own record, not another device');
  assert.equal(app.engine.getStatus().status, 'synced');
  assert.equal(app.engine.getBase().revision, 1);
  assert.equal(flow.row.revision, 1, 'nothing was saved twice');
});

// ---- 연결이 안 될 때 ------------------------------------------------------------------
test('a save that was on its way when the page closed is not added a second time when the page opens again', async () => {
  for (const [name, gemsAfterClosing, expected] of [['nothing changed afterwards', 14, 14], ['a hint was opened right after sending', 12, 12]]) {
    const flow = createFlow();
    const clock = createClock();
    const first = createApp(flow, clock);
    await first.engine.start();
    first.update({ gems: 14, solved: { l01_01: entry() } });
    // 창을 닫는 순간 보낸 저장: 서버는 반영하지만 응답은 이 화면에 돌아오지 않고, 화면은 사라집니다.
    flow.lostAckNext = true;
    first.engine.flush({ keepalive: true });
    await settle();
    first.update({ gems: gemsAfterClosing });
    first.engine.stop();
    assert.equal(flow.row.revision, 1, name);
    assert.equal(flow.row.gems, 14, name);
    const copy = first.persisted();
    assert.equal(copy.initialBase.revision, 0, 'the saved copy still points at the old base');
    assert.equal(copy.initialAttempts.length, 1, 'but it remembers what was sent');

    const second = createApp(flow, clock, { initial: { gems: gemsAfterClosing, solved: { l01_01: entry() } }, ...copy });
    await second.engine.start();
    assert.equal(second.state.gems, expected, `${name}: gems are not counted twice`);
    await clock.advance(sync.DEBOUNCE_MS);
    assert.equal(flow.row.gems, expected, name);
    assert.equal(flow.row.revision, gemsAfterClosing === 14 ? 1 : 2, `${name}: only a real change is saved again`);
  }
});

test('without the memory of what was sent the same situation would count twice, which is why the copy keeps it', async () => {
  const flow = createFlow({ revision: 1, state: serverState({ gems: 14, solved: { l01_01: entry() } }) });
  const clock = createClock();
  const second = createApp(flow, clock, {
    initial: { gems: 12, solved: { l01_01: entry() } },
    initialBase: { revision: 0, progress: fresh() },
    initialAttempts: [serverState({ gems: 14, solved: { l01_01: entry() } })],
  });
  await second.engine.start();
  assert.equal(second.state.gems, 12);
  const forgetful = createApp(flow, createClock(), { initial: { gems: 12, solved: { l01_01: entry() } }, initialBase: { revision: 0, progress: fresh() } });
  await forgetful.engine.start();
  assert.equal(forgetful.state.gems, 16, 'documents the failure the memory prevents: 14 + (12 - 10)');
});

test('an unreadable local copy leaves no base behind, so the server gems are never lowered', async () => {
  const readStudioState = vm.runInContext('readStudioState', context);
  const key = 'paco-studio-v3:k';
  const unreadable = readStudioState({ getItem: () => '{broken' }, key, null);
  assert.ok(unreadable.warning);
  assert.ok(!unreadable.sync, 'a damaged copy carries no base');
  const flow = createFlow({ revision: 5, state: serverState({ gems: 40, solved: { l01_01: entry() } }) });
  const clock = createClock();
  const app = createApp(flow, clock, { initial: { gems: unreadable.state.gems }, initialBase: unreadable.sync || null });
  await app.engine.start();
  assert.equal(app.state.gems, 40);
  await clock.advance(60000);
  assert.equal(flow.saves().length, 0, 'the learner just receives the server record');
  assert.equal(flow.row.gems, null);
});

test('a flow that refuses a save with the same revision is given up on instead of being asked again and again', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  flow.fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    flow.calls.push({ url, init, body });
    return body.action === 'load'
      ? { status: 200, ok: true, json: async () => ({ revision: 0, points: 0, state: '' }) }
      : { status: 200, ok: true, json: async () => ({ saved: false, revision: body.baseRevision, state: '' }) };
  };
  app.update({ gems: 12 });
  await clock.advance(10 * 60 * 1000);
  assert.equal(flow.saves().length, 1);
  assert.deepEqual([app.engine.getStatus().status, app.engine.getStatus().detail.kind], ['local', 'unsupported']);
  assert.equal(app.conflicts, 0, 'no "merged" message for a refusal');
  assert.equal(clock.pending(), 0);
});

test('conflicts that keep coming wait longer and longer instead of saving every few seconds', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  let rival = 0;
  flow.fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    flow.calls.push({ url, init, body });
    if (body.action === 'load') return { status: 200, ok: true, json: async () => ({ revision: 0, points: 0, state: '' }) };
    // 다른 기기가 계속 먼저 저장하는 것처럼, 저장할 때마다 번호와 내용이 바뀐 서버 기록을 돌려줍니다.
    rival += 1;
    flow.row.revision += 1;
    flow.row.state = serverState({ gems: 10, hintsUsed: { l01_01: rival } });
    return { status: 200, ok: true, json: async () => ({ saved: false, revision: flow.row.revision, state: flow.row.state }) };
  };
  app.update({ gems: 12 });
  await clock.advance(sync.DEBOUNCE_MS * 3 + 1000);
  assert.equal(flow.saves().length, 3, 'the first three conflicts are retried quickly');
  await clock.advance(sync.RETRY_MS[0] - 1000 - 1);
  assert.equal(flow.saves().length, 3, 'then the engine waits');
  await clock.advance(1);
  assert.equal(flow.saves().length, 4, 'and tries again after the first wait');
  await clock.advance(sync.RETRY_MS[1] - 1);
  assert.equal(flow.saves().length, 4, 'with a longer wait the next time');
  await clock.advance(10 * 60 * 1000);
  assert.ok(flow.saves().length >= 5 && flow.saves().length <= 12, 'a request every few minutes at most: ' + flow.saves().length);
  assert.ok(app.conflicts <= flow.saves().length);
  assert.notEqual(app.engine.getStatus().status, 'local', 'it keeps trying, because another device may simply be busy');
});

test('retrying the same save over and over does not make the engine forget an earlier save that may have landed', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  flow.lostAckNext = true; // 첫 저장은 서버에 반영되지만 응답이 사라집니다.
  app.update({ gems: 14 });
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(flow.row.revision, 1);
  app.update({ gems: 12 }); // 그 사이 힌트를 열어 보석이 줄고, 서버에는 한동안 닿지 못합니다.
  flow.failNext = 4;
  for (const wait of sync.RETRY_MS) await clock.advance(wait);
  await clock.advance(sync.RETRY_MS.at(-1));
  assert.equal(app.state.gems, 12, 'what was earned and spent is counted once');
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(flow.row.gems, 12);
  assert.equal(app.conflicts, 0, 'the server record was our own save, not another device');
  assert.equal(app.engine.getStatus().status, 'synced');
});

test('when the server cannot be reached the record is kept and saved later with growing waits', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  flow.failNext = 3;
  app.update({ gems: 12 });
  await clock.advance(sync.DEBOUNCE_MS);
  assert.deepEqual([app.engine.getStatus().status, app.engine.getStatus().detail.kind], ['offline', 'network']);
  app.update({ gems: 13 });
  await clock.advance(sync.RETRY_MS[0] - 1);
  assert.equal(flow.saves().length, 1, 'waiting for the retry');
  await clock.advance(1);
  assert.equal(flow.saves().length, 2);
  await clock.advance(sync.RETRY_MS[1]);
  assert.equal(flow.saves().length, 3);
  await clock.advance(sync.RETRY_MS[2]);
  assert.equal(flow.saves().length, 4, 'the fourth try reaches the server');
  assert.equal(app.engine.getStatus().status, 'synced');
  assert.equal(flow.stored().gems, 13, 'the latest record is what gets saved');
});

test('when loading fails the screen keeps working and the load is retried', async () => {
  const flow = createFlow({ revision: 2, state: serverState({ gems: 20 }) });
  const clock = createClock();
  const app = createApp(flow, clock, { initial: { gems: 10 } });
  flow.failNext = 2;
  assert.equal(await app.engine.start(), 'offline');
  assert.equal(app.state.gems, 10);
  app.update({ gems: 11 });
  await clock.advance(sync.DEBOUNCE_MS * 2);
  assert.equal(flow.saves().length, 0, 'nothing is saved before the server record is known');
  await clock.advance(sync.RETRY_MS[0]);
  await clock.advance(sync.RETRY_MS[1]);
  assert.equal(app.engine.getStatus().status, 'synced');
  assert.equal(app.state.gems, 21, 'the server record plus what was earned meanwhile');
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(flow.stored().gems, 21);
});

test('a missing student row or a flow without this feature leaves the learner on the local record', async () => {
  for (const [status, kind] of [[404, 'missing'], [400, 'unsupported'], [403, 'unsupported'], [405, 'unsupported']]) {
    const flow = createFlow();
    flow.override = { status, body: { updated: false } };
    const clock = createClock();
    const app = createApp(flow, clock);
    assert.equal(await app.engine.start(), 'local', String(status));
    assert.equal(app.engine.getStatus().detail.kind, kind);
    app.update({ gems: 12 });
    await clock.advance(10 * 60 * 1000);
    assert.equal(flow.calls.length, 1, `${status}: no retries and no saves`);
    assert.equal(clock.pending(), 0);
  }
  const flow = createFlow();
  flow.override = { status: 200, body: { updated: true, awarded: true, points: 4 } };
  const app = createApp(flow, createClock());
  assert.equal(await app.engine.start(), 'local', 'an answer in the old points format is not a state record');
  flow.override = { status: 200, body: { revision: 1, state: 7 } };
  assert.equal(await createApp(flow, createClock()).engine.start(), 'local');
});

test('server errors are retried, an unreadable server record is never written over', async () => {
  const flow = createFlow();
  flow.override = { status: 502, body: {} };
  const clock = createClock();
  const app = createApp(flow, clock);
  assert.equal(await app.engine.start(), 'offline');
  flow.override = null;
  await clock.advance(sync.RETRY_MS[0]);
  assert.equal(app.engine.getStatus().status, 'synced');

  for (const state of ['{broken', JSON.stringify({ v: 2, gems: 9 }), JSON.stringify({ v: 1, gems: 'many' })]) {
    const broken = createFlow({ revision: 5, state });
    const brokenClock = createClock();
    const learner = createApp(broken, brokenClock);
    assert.equal(await learner.engine.start(), 'local');
    assert.equal(learner.engine.getStatus().detail.kind, 'corrupt');
    learner.update({ gems: 30 });
    await brokenClock.advance(60000);
    assert.equal(broken.saves().length, 0, 'the record on the server stays as it is: ' + state);
    assert.equal(broken.row.state, state);
  }
});

test('a conflict answer without the server record is refused instead of overwriting it', async () => {
  const flow = createFlow({ revision: 3, state: serverState({ gems: 40 }) });
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  const realFetch = flow.fetchImpl;
  flow.fetchImpl = async (url, init) => (JSON.parse(init.body).action === 'save'
    ? { status: 200, ok: true, json: async () => ({ saved: false, revision: 4 }) }
    : realFetch(url, init));
  app.update({ gems: 45 });
  await clock.advance(sync.DEBOUNCE_MS);
  assert.equal(app.engine.getStatus().status, 'local');
  assert.equal(flow.row.revision, 3);
  assert.equal(flow.row.state, serverState({ gems: 40 }));
});

test('a record too large for the server is not sent', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  app.update({ mistakes: { l01_01: { reason: 'x'.repeat(950000), coach: false } } });
  await clock.advance(sync.DEBOUNCE_MS);
  assert.deepEqual([app.engine.getStatus().status, app.engine.getStatus().detail.kind], ['local', 'too-big']);
  assert.equal(flow.saves().length, 0);
});

// ---- 화면을 떠날 때 ----------------------------------------------------------------------
test('leaving the page saves right away, with keepalive so the request survives', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  assert.equal(await app.engine.flush(), true, 'nothing to save');
  app.update({ gems: 11 });
  const done = app.engine.flush({ keepalive: true });
  await settle();
  assert.equal(await done, true);
  assert.equal(flow.saves().length, 1);
  assert.equal(flow.saves()[0].init.keepalive, true);
  assert.equal(flow.saves()[0].body.baseRevision, 0);
  assert.equal(flow.stored().gems, 11);
  assert.equal(clock.pending(), 0, 'the debounce timer was cancelled');
});

test('logging out does not wait for a slow server forever and reports what is still unsaved', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  flow.failNext = 1;
  app.update({ gems: 11 });
  assert.equal(await app.engine.flush({ timeoutMs: 4000 }), false, 'the save failed');
  assert.equal(app.engine.getStatus().status, 'offline');
  const hanging = createFlow();
  const other = createApp(hanging, clock);
  await other.engine.start();
  hanging.fetchImpl = () => new Promise(() => {});
  other.update({ gems: 12 });
  const result = other.engine.flush({ timeoutMs: 4000 });
  await clock.advance(4000);
  assert.equal(await result, false);
});

test('a stopped engine does nothing more', async () => {
  const flow = createFlow();
  const clock = createClock();
  const app = createApp(flow, clock);
  await app.engine.start();
  app.update({ gems: 11 });
  app.engine.stop();
  await clock.advance(60000);
  assert.equal(flow.saves().length, 0);
  assert.equal(clock.pending(), 0);
  assert.equal(await app.engine.flush(), false);
});
