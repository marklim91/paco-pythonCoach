const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'new.html'), 'utf8');
const script = id => html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`))[1];
const curriculum = JSON.parse(script('curriculum'));
const context = vm.createContext({
  document: { getElementById: () => ({ textContent: script('curriculum') }) },
  URL, AbortSignal,
});
vm.runInContext(script('studio-core'), context);
const evaluate = expression => vm.runInContext(expression, context);

test('standalone studio module and Python worker have valid JavaScript syntax', () => {
  const moduleSource = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  for (const source of [moduleSource, script('worker-source')]) {
    const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: source, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('curriculum supplies unique problems, runnable references and judging data', () => {
  assert.equal(curriculum.length, 10);
  const problems = curriculum.flatMap(track => track.problems);
  assert.equal(problems.length, 100);
  assert.equal(new Set(problems.map(problem => problem.id)).size, problems.length);
  for (const problem of problems) {
    for (const key of ['id', 'title', 'topic', 'concept', 'starter', 'solution', 'input', 'output']) {
      assert.equal(typeof problem[key], 'string', `${problem.id}: ${key}`);
      assert.ok(problem[key].length, `${problem.id}: empty ${key}`);
    }
    assert.ok(problem.tests.length > 0);
    assert.ok(problem.hints.length > 0);
    assert.ok(problem.constraints.length > 0);
    for (const sample of problem.tests) {
      assert.equal(typeof sample.input, 'string');
      assert.equal(typeof sample.output, 'string');
    }
  }
});

const pythonCommand = ['python', 'python3', 'py'].find(name => spawnSync(name, ['--version']).status === 0);

test('reference solutions pass their own judging cases while starter code does not', { skip: !pythonCommand }, () => {
  const driver = [
    'import sys, io, json, contextlib',
    'def run(code, text):',
    '    sys.stdin = io.StringIO(text)',
    '    out = io.StringIO()',
    '    try:',
    '        with contextlib.redirect_stdout(out):',
    '            exec(compile(code, "x.py", "exec"), {"__name__": "__main__"})',
    '    except BaseException as error:',
    '        return "ERROR " + repr(error)',
    '    return out.getvalue()',
    'def norm(value):',
    '    return "\\n".join(line.rstrip() for line in value.replace("\\r\\n", "\\n").split("\\n")).rstrip("\\n")',
    'report = {}',
    'for problem in json.load(sys.stdin):',
    '    report[problem["id"]] = {',
    '        "solution": [norm(run(problem["solution"], t["input"])) == t["output"] for t in problem["tests"]],',
    '        "starter": [norm(run(problem["starter"], t["input"])) == t["output"] for t in problem["tests"]],',
    '    }',
    'sys.__stdout__.write(json.dumps(report))',
  ].join('\n');
  const result = spawnSync(pythonCommand, ['-X', 'utf8', '-c', driver], {
    input: JSON.stringify(curriculum.flatMap(track => track.problems)), encoding: 'utf8', timeout: 120000,
  });
  assert.equal(result.status, 0, result.stderr);
  for (const [id, { solution, starter }] of Object.entries(JSON.parse(result.stdout))) {
    assert.ok(solution.every(Boolean), `${id}: solution fails a judging case`);
    assert.ok(!starter.every(Boolean), `${id}: starter code already passes every case`);
  }
});

test('output comparison ignores only line endings and trailing whitespace', () => {
  assert.equal(evaluate('normalizeOutput("hello  \\r\\nworld\\n\\n")'), 'hello\nworld');
  assert.equal(evaluate('normalizeOutput(" Hello, Python!\\n")'), ' Hello, Python!');
  assert.notEqual(evaluate('normalizeOutput("hello")'), evaluate('normalizeOutput("Hello")'));
  assert.notEqual(evaluate('normalizeOutput("a  b")'), evaluate('normalizeOutput("a b")'));
  assert.equal(evaluate('normalizeOutput("")'), '');
});

test('fresh storage starts at entry problem with no fake progress', () => {
  const result = evaluate('readStudioState({ getItem() { return null; } })');
  assert.equal(result.state.selected, 'hello');
  assert.equal(result.state.completed.length, 0);
  assert.equal(Object.keys(result.state.codes).length, 0);
  assert.equal(result.warning, '');
});

test('saved drafts, selected problem, coach URL and completed problems restore', () => {
  context.saved = JSON.stringify({
    selected: 'pair', codes: { pair: 'print("YES")' }, completed: ['hello', 'sum', 'hello'],
    coachUrl: 'https://example.com/coach',
  });
  const result = evaluate('readStudioState({ getItem() { return saved; } })');
  assert.equal(result.state.selected, 'pair');
  assert.equal(result.state.codes.pair, 'print("YES")');
  assert.equal(result.state.completed.join(','), 'hello,sum');
  assert.equal(result.state.coachUrl, 'https://example.com/coach');
  assert.equal(result.warning, '');
});

test('a browser that saved the previous default coach moves to the new one, custom coaches stay', () => {
  const legacy = 'https://copilotstudio.microsoft.com/environments/9324e73a-cd4e-e049-b7ba-177af6165e9c/bots/crbf2_agent_dKZZIw/webchat?__version__=2&enableFileAttachment=false&cliAgent=true';
  const read = coachUrl => {
    context.saved = JSON.stringify({ selected: 'hello', codes: {}, completed: [], coachUrl });
    return evaluate('readStudioState({ getItem() { return saved; } })').state.coachUrl;
  };
  assert.equal(read(legacy), evaluate('DEFAULT_COACH_URL'));
  assert.match(evaluate('DEFAULT_COACH_URL'), /\/bots\/crbf2_bot_QSDFLs\/webchat\?/);
  assert.equal(read('https://example.com/my-coach'), 'https://example.com/my-coach');
});

test('invalid saved records warn explicitly without writing over the original', () => {
  const invalidRecords = [
    '{invalid', 'null', '[]',
    JSON.stringify({ selected: 'missing', codes: {}, completed: [], coachUrl: 'https://example.com' }),
    JSON.stringify({ selected: 'hello', codes: { hello: 42 }, completed: [], coachUrl: 'https://example.com' }),
    JSON.stringify({ selected: 'hello', codes: {}, completed: ['missing'], coachUrl: 'https://example.com' }),
    JSON.stringify({ selected: 'hello', codes: {}, completed: [], coachUrl: 'javascript:alert(1)' }),
  ];
  for (const record of invalidRecords) {
    context.saved = record;
    const result = evaluate('readStudioState({ getItem() { return saved; }, setItem() { throw new Error("Must not overwrite"); } })');
    assert.ok(result.warning);
    assert.equal(result.state.selected, 'hello');
    assert.equal(result.state.completed.length, 0);
  }
  assert.match(evaluate('readStudioState({ getItem() { throw new Error("Denied"); } }).warning'), /Denied/);
});

test('coach configuration rejects insecure schemes and embedded credentials', () => {
  for (const url of ['http://example.com', 'javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com', 'not a URL']) {
    context.url = url;
    assert.throws(() => evaluate('validateCoachUrl(url)'));
  }
  assert.equal(evaluate('validateCoachUrl("  https://example.com/chat  ")'), 'https://example.com/chat');
});

test('new page uses the shared cookie guard but stays independent from legacy API scripts', () => {
  assert.match(html, /<script src="\.\/auth\.js"><\/script>/);
  assert.doesNotMatch(html, /src=["'][^"']*(?:presence|app-shell)\.js/);
  assert.deepEqual([...new Set(html.match(/\/api\/[\w/-]+/g))].sort(), ['/api/session', '/api/session/logout']);
  assert.match(html, /new Worker\(workerUrl, \{ type: ['"]module['"] \}\)/);
  assert.match(html, /worker\.terminate\(\)/);
});

const flowUrl = 'https://example.environment.api.powerplatform.com/flow?sig=test-secret';
const student = { school: '경북여자고등학교', studentId: '30202', studentName: '이서연' };
const cookies = 'theme=dark; studentId=30202; school=' + encodeURIComponent(student.school);
const session = (body, ok = true) => async () => ({ ok, json: async () => body });
const flowReply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('logout ends the server session when possible and always clears the login cookies', async () => {
  const calls = [];
  const cleared = [];
  context.logoutCalls = calls;
  context.logoutCookies = cleared;
  context.okFetch = async (url, init) => { calls.push([url, init.method, init.credentials]); return { ok: true }; };
  context.brokenFetch = async () => { throw new TypeError('offline'); };
  await evaluate('endSession({ fetchImpl: okFetch, setCookie: value => logoutCookies.push(value), cookiePath: "/paco/" })');
  assert.deepEqual(calls, [['./api/session/logout', 'POST', 'same-origin']]);
  assert.deepEqual(cleared, ['school', 'studentId', 'studentName'].map(name => `${name}=; Max-Age=0; Path=/paco/; SameSite=Lax`));
  cleared.length = 0;
  await evaluate('endSession({ fetchImpl: brokenFetch, setCookie: value => logoutCookies.push(value), cookiePath: "/" })');
  assert.equal(cleared.length, 3);
  assert.match(html, /onClick: logout/);
  assert.match(html, /window\.location\.replace\(\s*new URL\("login\.html\?reverify=1"/);
});

test('points flow address comes from the deploy-time runtime config, never from the source', () => {
  assert.match(html, /<script src="\.\/runtime-config\.js"><\/script>/);
  assert.equal(evaluate('DEFAULT_POINTS_URL'), '');
  const configured = vm.createContext({
    document: { getElementById: () => ({ textContent: script('curriculum') }) },
    URL, AbortSignal, PcoConfig: { pointsUrl: 'https://x.api.powerplatform.com/a?sig=from-secret' },
  });
  vm.runInContext(script('studio-core'), configured);
  assert.equal(vm.runInContext('DEFAULT_POINTS_URL', configured), 'https://x.api.powerplatform.com/a?sig=from-secret');
  assert.doesNotMatch(html, /powerautomate\/automations/);
});

test('points flow address must be an https Power Automate trigger without credentials', () => {
  assert.equal(evaluate(`validatePointsUrl(${JSON.stringify('  ' + flowUrl + ' ')})`), flowUrl);
  assert.equal(evaluate('validatePointsUrl("https://prod-1.koreacentral.logic.azure.com/workflows/a?sig=x")').startsWith('https://'), true);
  for (const bad of ['http://x.api.powerplatform.com/a', 'https://evil.example.com/a', 'https://u:p@x.api.powerplatform.com/a',
    'https://x.api.powerplatform.com/a#frag', 'not a url', '']) {
    assert.throws(() => evaluate(`validatePointsUrl(${JSON.stringify(bad)})`), undefined, bad);
  }
});

test('points depend on the problem level and every problem earns points', () => {
  const points = { '맛보기': 5, '입문': 10, '기초': 20, '응용': 30, '도전': 50, '심화': 80 };
  const problems = curriculum.flatMap(track => track.problems);
  assert.deepEqual(problems.map(p => evaluate(`pointsFor(${JSON.stringify(p)})`)), problems.map(p => points[p.level]));
  assert.ok(problems.every(p => points[p.level] > 0));
  assert.equal(evaluate('pointsFor({ level: "unknown" })'), 0);
});

test('every track climbs from easier to harder problems and each level is represented', () => {
  const order = ['맛보기', '입문', '기초', '응용', '도전', '심화'];
  for (const track of curriculum) {
    const ranks = track.problems.map(p => order.indexOf(p.level));
    assert.ok(ranks.every(rank => rank >= 0), `${track.id}: unknown level`);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), `${track.id}: not ordered by level`);
  }
  const levels = new Set(curriculum.flatMap(track => track.problems.map(p => p.level)));
  assert.deepEqual([...levels].sort(), [...order].sort());
});

test('student identity comes from the login cookies, falling back to the session for old logins without a name cookie', async () => {
  const load = vm.runInContext('loadStudent', context);
  const encode = encodeURIComponent;
  const full = `theme=dark; school=${encode(student.school)}; studentId=30202; studentName=${encode(student.studentName)}`;
  let calls = 0;
  const unused = async () => { calls += 1; throw new Error('session must not be needed'); };
  assert.deepEqual({ ...await load(unused, full) }, student);
  assert.equal(calls, 0);

  const legacy = cookies;
  const ok = session({ authenticated: true, school: student.school, name: student.studentName });
  assert.deepEqual({ ...await load(ok, legacy) }, student);

  for (const [fetchImpl, cookieString] of [
    [session({ authenticated: false }), legacy],
    [session({ authenticated: true, school: student.school, name: null }), legacy],
    [session({ authenticated: true, school: '다른학교', name: student.studentName }), legacy],
    [session({}, false), legacy],
    [async () => { throw new TypeError('offline'); }, legacy],
    [ok, 'studentId=30202'],
    [ok, `school=${encode(student.school)}; studentId=abc; studentName=${encode(student.studentName)}`],
    [ok, `school=${encode(student.school)}; studentId=30202; studentName=${encode('<b>')}`],
  ]) {
    await assert.rejects(() => load(fetchImpl, cookieString), /다시 로그인/);
  }
});

test('points request sends the student identity and accepts only a well-formed updated response', async () => {
  const request = vm.runInContext('requestPoints', context);
  const calls = [];
  const capture = reply => async (url, init) => { calls.push({ url, init }); return reply(); };
  const added = await request({
    url: flowUrl, student, problemId: 'hello', points: 10, fetchImpl: capture(flowReply(200, { updated: true, points: 4770 })),
  });
  assert.deepEqual({ ...added }, { points: 4770, awarded: true });
  const repeated = await request({
    url: flowUrl, student, problemId: 'hello', points: 10, fetchImpl: capture(flowReply(200, { updated: true, awarded: false, points: 4770 })),
  });
  assert.deepEqual({ ...repeated }, { points: 4770, awarded: false });
  assert.equal(calls[0].url, flowUrl);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].init.redirect, 'error');
  assert.deepEqual(JSON.parse(calls[0].init.body), { ...student, problemId: 'hello', points: 10 });

  const attempt = (reply, url = flowUrl) => request({ url, student, problemId: 'hello', points: 10, fetchImpl: capture(reply) });
  await assert.rejects(() => attempt(flowReply(404, { updated: false })), /활성 학생 기록/);
  await assert.rejects(() => attempt(flowReply(500, {})), /\(500\)/);
  await assert.rejects(() => attempt(flowReply(200, { updated: 'true', points: 1 })), /응답 형식/);
  await assert.rejects(() => attempt(flowReply(200, { updated: true, points: '1' })), /응답 형식/);
  const before = calls.length;
  await assert.rejects(() => attempt(flowReply(200, { updated: true, points: 1 }), 'https://evil.example.com/a'), /Power Automate/);
  assert.equal(calls.length, before, 'invalid addresses must never be called');
});

test('saved studio state without the points fields still loads and invalid flow addresses are not trusted', () => {
  const legacy = { selected: 'hello', codes: {}, completed: ['hello'], coachUrl: 'https://example.com/chat' };
  const loaded = evaluate(`readStudioState({ getItem() { return ${JSON.stringify(JSON.stringify(legacy))}; } })`);
  assert.equal(loaded.warning, '');
  assert.equal(loaded.state.pointsUrl, '');
  assert.equal(loaded.state.awarded.length, 0);
  const saved = { ...legacy, pointsUrl: flowUrl, awarded: ['a', 'a', 7] };
  const restored = evaluate(`readStudioState({ getItem() { return ${JSON.stringify(JSON.stringify(saved))}; } })`);
  assert.equal(restored.state.pointsUrl, flowUrl);
  assert.deepEqual([...restored.state.awarded], ['a']);
  const hostile = { ...legacy, pointsUrl: 'https://evil.example.com/a' };
  const rejected = evaluate(`readStudioState({ getItem() { return ${JSON.stringify(JSON.stringify(hostile))}; } })`);
  assert.equal(rejected.state.pointsUrl, '');
  assert.match(rejected.warning, /Power Automate/);
});
