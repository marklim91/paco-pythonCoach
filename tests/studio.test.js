const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const studioCatalog = require('../public/studio-catalog');
const { loadCurriculum } = require('./support/curriculum');

const publicFile = name => fs.readFileSync(path.join(__dirname, '..', 'public', name), 'utf8');
const html = publicFile('new.html');
const core = publicFile('studio-core.js');
const app = publicFile('studio-app.js');
const pageSource = [html, core, app].join('\n');
const script = id => html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`))[1];
const curriculum = loadCurriculum();
const createStudio = (extra = {}) => {
  const sandbox = vm.createContext({ PcoStudio: studioCatalog, URL, URLSearchParams, AbortSignal, ...extra });
  vm.runInContext(core, sandbox);
  return sandbox;
};
const context = createStudio();
const evaluate = expression => vm.runInContext(expression, context);

test('standalone studio module and Python worker have valid JavaScript syntax', () => {
  for (const source of [app, script('worker-source')]) {
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
    for (const key of ['intro', 'code', 'output']) {
      assert.equal(typeof problem.example?.[key], 'string', `${problem.id}: example.${key}`);
      assert.ok(problem.example[key].trim().length, `${problem.id}: empty example.${key}`);
    }
    assert.equal(typeof problem.example.input, 'string', `${problem.id}: example.input`);
  }
});

const pythonCommand = ['python', 'python3', 'py'].find(name => spawnSync(name, ['--version']).status === 0);
// Runs each snippet the way the studio does: input() reads the case input and only stdout is compared.
const pythonRunner = [
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
];
const runPython = (lines, problems) => {
  const result = spawnSync(pythonCommand, ['-X', 'utf8', '-c', [...pythonRunner, ...lines].join('\n')], {
    input: JSON.stringify(problems), encoding: 'utf8', timeout: 120000,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

test('reference solutions pass their own judging cases while starter code does not', { skip: !pythonCommand }, () => {
  const report = runPython([
    'report = {}',
    'for problem in json.load(sys.stdin):',
    '    report[problem["id"]] = {',
    '        "solution": [norm(run(problem["solution"], t["input"])) == t["output"] for t in problem["tests"]],',
    '        "starter": [norm(run(problem["starter"], t["input"])) == t["output"] for t in problem["tests"]],',
    '    }',
    'sys.__stdout__.write(json.dumps(report))',
  ], curriculum.flatMap(track => track.problems));
  for (const [id, { solution, starter }] of Object.entries(report)) {
    assert.ok(solution.every(Boolean), `${id}: solution fails a judging case`);
    assert.ok(!starter.every(Boolean), `${id}: starter code already passes every case`);
  }
});

const withoutComments = code => code.split('\n').map(line => line.replace(/#.*$/, '').trim()).filter(Boolean).join('\n');

test('hint examples print what they claim and are never a disguised answer to their own problem', { skip: !pythonCommand }, () => {
  const problems = curriculum.flatMap(track => track.problems);
  const report = runPython([
    'report = {}',
    'for problem in json.load(sys.stdin):',
    '    example = problem["example"]',
    '    report[problem["id"]] = {',
    '        "own": norm(run(example["code"], example["input"])),',
    '        "cases": [norm(run(example["code"], t["input"])) == t["output"] for t in problem["tests"]],',
    '    }',
    'sys.__stdout__.write(json.dumps(report))',
  ], problems);
  for (const problem of problems) {
    const { own, cases } = report[problem.id];
    context.text = problem.example.output;
    assert.equal(own, evaluate('normalizeOutput(text)'), `${problem.id}: example does not print its stated output`);
    assert.ok(!cases.every(Boolean), `${problem.id}: example already passes every judging case`);
    assert.notEqual(withoutComments(problem.example.code), withoutComments(problem.solution), `${problem.id}: example is the reference solution`);
  }
});

test('the hints tab shows a similar example and never the reference solution', () => {
  assert.match(app, /problem\.example\.code/);
  assert.doesNotMatch(app, /problem\.solution/);
  assert.doesNotMatch(core, /["']solution["']/, 'the loader must not read the reference solution');
});

const practiceItems = curriculum.flatMap(track => track.problems.flatMap(problem =>
  (problem.practice ?? []).map((item, index) => ({ problem, item, index }))));

test('every pilot problem (steps 1-4) has a complete practice problem', () => {
  for (const track of curriculum.slice(0, 4)) {
    for (const problem of track.problems) assert.ok(problem.practice?.length >= 1, `${problem.id}: missing practice problem`);
  }
  const keys = ['title', 'minutes', 'description', 'input', 'output', 'constraints', 'starter', 'solution', 'hints', 'tests'];
  for (const { problem, item } of practiceItems) {
    assert.deepEqual(Object.keys(item), keys, `${problem.id}: practice keys`);
    for (const key of ['title', 'input', 'output', 'starter', 'solution']) {
      assert.equal(typeof item[key], 'string', `${problem.id}: practice.${key}`);
      assert.ok(item[key].trim().length, `${problem.id}: empty practice.${key}`);
    }
    assert.ok(Number.isInteger(item.minutes) && item.minutes > 0, `${problem.id}: practice.minutes`);
    for (const key of ['description', 'constraints', 'hints']) {
      assert.ok(Array.isArray(item[key]) && item[key].length > 0 && item[key].every(text => typeof text === 'string' && text.trim()), `${problem.id}: practice.${key}`);
    }
    assert.ok(item.tests.length > 0 && item.tests.every(sample => typeof sample.input === 'string' && typeof sample.output === 'string'), `${problem.id}: practice.tests`);
    if (/\binput\s*\(/.test(item.solution)) {
      assert.ok(item.tests.length >= 4, `${problem.id}: a practice that reads input needs at least 4 cases`);
      assert.equal(new Set(item.tests.map(sample => sample.input)).size, item.tests.length, `${problem.id}: duplicate practice inputs`);
    }
  }
});

test('practice solutions pass their own cases, while the starter, the original solution and the hint example do not', { skip: !pythonCommand }, () => {
  const problems = curriculum.flatMap(track => track.problems).filter(problem => problem.practice?.length);
  const report = runPython([
    'def passes(code, tests):',
    '    return [norm(run(code, t["input"])) == t["output"] for t in tests]',
    'report = {}',
    'for problem in json.load(sys.stdin):',
    '    for index, item in enumerate(problem["practice"]):',
    '        report[problem["id"] + "#" + str(index)] = {',
    '            "solution": passes(item["solution"], item["tests"]),',
    '            "starter": passes(item["starter"], item["tests"]),',
    '            "original": passes(problem["solution"], item["tests"]),',
    '            "example": passes(problem["example"]["code"], item["tests"]),',
    '            "practiceOnOriginal": passes(item["solution"], problem["tests"]),',
    '        }',
    'sys.__stdout__.write(json.dumps(report))',
  ], problems);
  assert.ok(Object.keys(report).length >= 40);
  for (const [id, result] of Object.entries(report)) {
    assert.ok(result.solution.every(Boolean), `${id}: practice solution fails a judging case`);
    assert.ok(!result.starter.every(Boolean), `${id}: practice starter already passes every case`);
    assert.ok(!result.original.every(Boolean), `${id}: the original solution already solves the practice`);
    assert.ok(!result.example.every(Boolean), `${id}: the hint example already solves the practice`);
    assert.ok(!result.practiceOnOriginal.every(Boolean), `${id}: the practice solution already solves the original`);
  }
});

test('practice is unscored: only a real problem is marked solved and awarded points, and practice always has a way back', () => {
  assert.match(app, /if \(passed && problem\.isPractice\) \{[\s\S]*?practiced:[\s\S]*?\} else if \(passed\) \{[\s\S]*?completed:[\s\S]*?awardPoints\(problem\)/);
  assert.match(app, /showPractice\(null\)/);
  assert.doesNotMatch(app, /p\.id === problem\.id/, 'step lists mark the selected problem, not the practice');
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
  assert.doesNotMatch(pageSource, /src=["'][^"']*(?:presence|app-shell)\.js/);
  assert.deepEqual([...new Set(pageSource.match(/\/api\/[\w/-]+/g))].sort(), ['/api/session', '/api/session/logout']);
  assert.match(app, /new Worker\(workerUrl, \{ type: ['"]module['"] \}\)/);
  assert.match(app, /worker\.terminate\(\)/);
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
  assert.match(app, /onClick: logout/);
  assert.match(app, /window\.location\.replace\(\s*new URL\("login\.html\?reverify=1"/);
});

test('points flow address comes from the deploy-time runtime config, never from the source', () => {
  assert.match(html, /<script src="\.\/runtime-config\.js"><\/script>/);
  assert.equal(evaluate('DEFAULT_POINTS_URL'), '');
  const configured = createStudio({ PcoConfig: { pointsUrl: 'https://x.api.powerplatform.com/a?sig=from-secret' } });
  assert.equal(vm.runInContext('DEFAULT_POINTS_URL', configured), 'https://x.api.powerplatform.com/a?sig=from-secret');
  assert.doesNotMatch(pageSource, /powerautomate\/automations/);
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

test('new.html stays a thin shell: styles, code and problems live in their own files', () => {
  assert.ok(Buffer.byteLength(html) < 16 * 1024, 'new.html must not inline the curriculum or the UI code again');
  assert.doesNotMatch(html, /<style|id="curriculum"|application\/json/);
  assert.match(html, /<link rel="stylesheet" href="\.\/studio\.css" \/>/);
  assert.match(html, /<script src="\.\/studio-catalog\.js"><\/script>\s*<script src="\.\/studio-core\.js"><\/script>/);
  assert.match(html, /<script type="module" src="\.\/studio-app\.js"><\/script>/);
});

test('problem files are found in their step folder and every file passes the loader checks', () => {
  const url = id => evaluate(`problemDetailUrl(PROBLEMS.find((p) => p.id === ${JSON.stringify(id)}))`);
  assert.equal(url('hello'), './curriculum/step-01/hello.json');
  assert.equal(url('t3_vending'), './curriculum/step-03/t3_vending.json');
  assert.equal(url('t10_library_shelf'), './curriculum/step-10/t10_library_shelf.json');

  const fresh = createStudio();
  assert.ok(vm.runInContext('PROBLEMS.every((p) => p.tests === undefined)', fresh), 'the list starts without problem text');
  for (const problem of curriculum.flatMap(track => track.problems)) {
    fresh.file = problem;
    assert.doesNotThrow(() => vm.runInContext('parseProblemDetail(PROBLEMS.find((p) => p.id === file.id), file)', fresh), problem.id);
  }
});

test('problem text is fetched once per problem, even for simultaneous requests, and merged into the list entry', async () => {
  const fresh = createStudio();
  const hello = curriculum[0].problems[0];
  const urls = [];
  fresh.fakeFetch = async url => { urls.push(url); return { ok: true, status: 200, json: async () => structuredClone(hello) }; };
  const load = () => vm.runInContext('loadProblem("hello", fakeFetch)', fresh);
  const [first, second] = await Promise.all([load(), load()]);
  assert.equal(first, second);
  assert.deepEqual(urls, ['./curriculum/step-01/hello.json']);
  assert.deepEqual(JSON.parse(JSON.stringify(first.tests)), hello.tests);
  assert.deepEqual(JSON.parse(JSON.stringify(first.example)), hello.example);
  assert.equal('solution' in first, false, 'the page never keeps the reference solution');
  assert.equal(first.starter, hello.starter);
  assert.equal(first.trackId, 't1');
  assert.deepEqual(JSON.parse(JSON.stringify(first.practice.map(item => item.tests))), hello.practice.map(item => item.tests));
  assert.ok(first.practice.every(item => !('solution' in item)), 'practice answers never reach the page either');
  const asProblem = vm.runInContext('practiceProblem(PROBLEMS.find((p) => p.id === "hello"), 0)', fresh);
  assert.equal(asProblem.id, 'hello-p1');
  assert.equal(asProblem.problemId, 'hello');
  assert.equal(asProblem.isPractice, true);
  assert.equal(asProblem.level, '연습');
  assert.equal(asProblem.concept, hello.concept);
  assert.equal(asProblem.title, hello.practice[0].title);
  assert.equal(vm.runInContext('pointsFor(practiceProblem(PROBLEMS.find((p) => p.id === "hello"), 0))', fresh), 0, 'practice earns no points');
  await load();
  assert.equal(urls.length, 1, 'a loaded problem is not fetched again');
});

test('a failed or malformed problem file is rejected, leaves the problem unloaded and can be retried', async () => {
  const fresh = createStudio();
  const hello = curriculum[0].problems[0];
  let reply;
  fresh.fakeFetch = async () => reply;
  const load = () => vm.runInContext('loadProblem("hello", fakeFetch)', fresh);
  const ok = body => ({ ok: true, status: 200, json: async () => body });
  reply = { ok: false, status: 404, json: async () => ({}) };
  await assert.rejects(load, /\(404\)/);
  for (const body of [null, { ...hello, id: 'sum' }, { ...hello, tests: [] }, { ...hello, hints: [] }, { ...hello, starter: 7 }, { ...hello, tests: [{ input: 1, output: '' }] },
    { ...hello, example: null }, { ...hello, example: { ...hello.example, code: 7 } },
    { ...hello, practice: 'x' }, { ...hello, practice: [null] }, { ...hello, practice: [{ ...hello.practice[0], tests: [] }] },
    { ...hello, practice: [{ ...hello.practice[0], hints: [] }] }, { ...hello, practice: [{ ...hello.practice[0], minutes: 'x' }] }]) {
    reply = ok(body);
    await assert.rejects(load, /형식이 올바르지 않아요/);
  }
  reply = { ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } };
  await assert.rejects(load, /bad json/);
  assert.equal(vm.runInContext('PROBLEMS.find((p) => p.id === "hello").tests', fresh), undefined);
  reply = ok(hello);
  assert.equal((await load()).title, hello.title);
  await assert.rejects(() => vm.runInContext('loadProblem("missing", fakeFetch)', fresh), /알 수 없는 문제/);
});

test('a problem file without practice still loads, with an empty practice list', () => {
  const fresh = createStudio();
  const { practice, ...plain } = structuredClone(curriculum[0].problems[0]);
  assert.ok(practice.length > 0);
  fresh.file = plain;
  const detail = vm.runInContext('parseProblemDetail(PROBLEMS.find((p) => p.id === file.id), file)', fresh);
  assert.deepEqual([...detail.practice], []);
});

test('practice ids, saved practice code and practice marks restore, and unknown practice records are refused', () => {
  assert.equal(evaluate('practiceId("t3_grade", 0)'), 't3_grade-p1');
  assert.equal(evaluate('isPracticeId("t3_grade-p2")'), true);
  for (const id of ['t3_grade', 't3_grade-p0', 'missing-p1', 't3_grade-px']) assert.equal(evaluate(`isPracticeId(${JSON.stringify(id)})`), false, id);

  const read = extra => {
    context.saved = JSON.stringify({ selected: 'hello', codes: {}, completed: [], coachUrl: 'https://example.com/chat', ...extra });
    return evaluate('readStudioState({ getItem() { return saved; } })');
  };
  const restored = read({ codes: { 'hello-p1': 'print(1)' }, practiced: ['hello-p1', 'hello-p1'] });
  assert.equal(restored.warning, '');
  assert.equal(restored.state.codes['hello-p1'], 'print(1)');
  assert.deepEqual([...restored.state.practiced], ['hello-p1']);
  assert.deepEqual([...read({}).state.practiced], [], 'records saved before practice existed still load');
  for (const bad of [{ practiced: ['hello'] }, { practiced: ['missing-p1'] }, { practiced: [7] }, { codes: { 'missing-p1': 'x' } }, { codes: { 'hello-p0': 'x' } }]) {
    const result = read(bad);
    assert.ok(result.warning, JSON.stringify(bad));
    assert.deepEqual([...result.state.practiced], []);
  }
});

test('the first screen shows the saved problem, or the one a link asks for when it exists', () => {
  const record = selected => JSON.stringify({ selected, codes: {}, completed: [], coachUrl: 'https://example.com/chat' });
  const startup = (search, saved) => {
    context.saved = saved;
    return evaluate(`startupProblemId(${JSON.stringify(search)}, { getItem() { return saved; } })`);
  };
  assert.equal(startup('', record('pair')), 'pair');
  assert.equal(startup('?problem=t3_vending', record('pair')), 't3_vending');
  assert.equal(startup('?problem=missing', record('pair')), 'pair');
  assert.equal(startup('', null), 'hello');
  assert.equal(startup('?problem=sum', '{broken'), 'sum');
  assert.equal(evaluate('startupProblemId("?problem=sum", null)'), 'sum');
  assert.equal(evaluate('startupProblemId("")'), 'hello');
});

test('the first problem is requested while the libraries download and the screen waits for it', () => {
  assert.match(html, /loadProblem\(startupProblemId\(location\.search\)\)\.catch\(/);
  assert.match(app, /loadProblem\(startupProblemId\(window\.location\.search\)\)\.then\(/);
  assert.match(app, /await loadProblem\(id\)/);
});
