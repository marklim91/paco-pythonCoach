const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const studioCatalog = require('../public/studio-catalog');
const progress = require('../public/studio-progress');
const markdown = require('../public/studio-markdown');
const { loadCurriculum, loadPlacement } = require('./support/curriculum');

const publicFile = name => fs.readFileSync(path.join(__dirname, '..', 'public', name), 'utf8');
const html = publicFile('new.html');
const core = publicFile('studio-core.js');
const moduleNames = ['studio-app', 'studio-ui', 'studio-runner', 'studio-code', 'studio-coach', 'studio-learn', 'studio-roadmap', 'studio-quiz'];
const modules = Object.fromEntries(moduleNames.map(name => [name, publicFile(`${name}.js`)]));
const pageSource = [html, core, ...Object.values(modules)].join('\n');
const script = id => html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`))[1];
const curriculum = loadCurriculum();
const allProblems = curriculum.flatMap(track => [...track.problems, ...track.exam]);
const createStudio = (extra = {}) => {
  const sandbox = vm.createContext({ PcoStudio: studioCatalog, PcoProgress: progress, URL, URLSearchParams, AbortSignal, ...extra });
  vm.runInContext(core, sandbox);
  return sandbox;
};
const context = createStudio();
const evaluate = expression => vm.runInContext(expression, context);

test('standalone studio modules, classic scripts and the Python worker have valid JavaScript syntax', () => {
  for (const source of [...Object.values(modules), script('worker-source')]) {
    const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: source, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  for (const name of ['studio-core', 'studio-progress', 'studio-markdown', 'studio-catalog']) {
    const result = spawnSync(process.execPath, ['--check', '--input-type=commonjs'], { input: publicFile(`${name}.js`), encoding: 'utf8' });
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
  }
});

// ---- 문제 파일 -----------------------------------------------------------------
test('curriculum has 15 levels of unique, well formed problem files', () => {
  assert.equal(curriculum.length, 15);
  assert.equal(allProblems.length, 366);
  assert.equal(new Set(allProblems.map(problem => problem.id)).size, allProblems.length);
  const kinds = { core: 120, practice: 216, exam: 30 };
  for (const [kind, count] of Object.entries(kinds)) assert.equal(allProblems.filter(problem => problem.kind === kind).length, count, kind);
  const levels = ['맛보기', '입문', '기초', '응용', '도전', '심화', '연습'];
  const types = { core: ['실습', '도전', '프로젝트'], practice: ['연습'], exam: ['승급시험'] };
  const keys = ['id', 'kind', 'type', 'title', 'level', 'minutes', 'description', 'input', 'output', 'starter', 'solution', 'hints', 'explanation', 'tests'];
  for (const problem of allProblems) {
    assert.match(problem.id, /^[a-z0-9_]+$/);
    assert.deepEqual(Object.keys(problem).filter(key => key !== 'link'), keys, `${problem.id}: keys`);
    assert.ok(types[problem.kind].includes(problem.type), `${problem.id}: type ${problem.type}`);
    assert.ok(levels.includes(problem.level), `${problem.id}: level`);
    assert.equal(problem.level === '연습', problem.kind === 'practice', `${problem.id}: only practice is labelled 연습`);
    assert.ok(Number.isInteger(problem.minutes) && problem.minutes > 0);
    for (const key of ['title', 'description', 'solution']) assert.ok(problem[key].trim().length, `${problem.id}: empty ${key}`);
    for (const key of ['input', 'output', 'starter', 'explanation']) assert.equal(typeof problem[key], 'string', `${problem.id}: ${key}`);
    assert.ok(Array.isArray(problem.hints) && problem.hints.every(hint => typeof hint === 'string' && hint.trim()));
    assert.ok(problem.tests.length > 0);
    for (const sample of problem.tests) {
      assert.equal(typeof sample.input, 'string');
      assert.equal(typeof sample.output, 'string');
      if ('files' in sample) assert.ok(Object.keys(sample.files).length > 0 && Object.values(sample.files).every(text => typeof text === 'string'), `${problem.id}: files`);
    }
    if (problem.link) assert.match(problem.link.url, /^https:\/\//);
    assert.ok(problem.kind === 'practice' || !problem.link, `${problem.id}: only practice problems link out`);
  }
});

test('core problems teach with hints and explanations, exams give no hints, and every level has a two problem exam', () => {
  for (const track of curriculum) {
    assert.equal(track.problems.filter(problem => problem.kind === 'core').length, 8, `${track.id}: core problems`);
    assert.equal(track.exam.length, 2, `${track.id}: exam problems`);
    for (const problem of track.problems.filter(problem => problem.kind === 'core')) {
      assert.ok(problem.hints.length >= 1, `${problem.id}: needs a hint`);
      assert.ok(problem.explanation.trim(), `${problem.id}: needs an explanation`);
    }
    for (const problem of track.exam) assert.deepEqual(problem.hints, [], `${problem.id}: exams give no hints`);
  }
});

// ---- 파코 스타일: 상황 도입 + 할 일의 2문단, 출발점이 있는 시작 코드, 정답을 알려 주지 않는 힌트 ----
const squeeze = text => text.replace(/\s+/g, '');
const outsideCode = text => text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
const proseLines = description => {
  const lines = [];
  let inCode = false;
  for (const raw of description.split('\n')) {
    if (/^\s*```/.test(raw)) inCode = !inCode;
    else if (!inCode && raw.trim()) lines.push(raw.trim());
  }
  return lines;
};
// 정답에서 공백을 뺀 12자 이상인 줄: 힌트나 시작 코드에 통째로 들어 있으면 정답을 알려 주는 것이다.
const solutionLines = problem => problem.solution.split('\n').map(line => line.trim()).filter(line => squeeze(line).length >= 12);

test('every problem is written in the Paco style: a friendly two paragraph description, a guiding starter, and hints that never give away the code', () => {
  for (const problem of allProblems) {
    const prose = proseLines(problem.description);
    assert.ok(prose.length >= 2, `${problem.id}: needs a situation line and a task line`);
    assert.match(prose[0], /(요|죠)[.!?~…]*$/, `${problem.id}: the opening line is friendly 해요체`);
    assert.match(prose[1], /(주세요|세요)/, `${problem.id}: the task line asks politely`);
    for (const text of [problem.description, problem.explanation, ...problem.hints]) {
      assert.doesNotMatch(outsideCode(text), /하세요|합니다|입니다|습니다|됩니다/, `${problem.id}: formal tone is left in the text`);
    }
    assert.ok(problem.starter.trim(), `${problem.id}: the editor starts with a skeleton or guiding comments`);
    if (problem.kind === 'practice') {
      for (const key of ['input', 'output', 'explanation']) assert.ok(problem[key].trim(), `${problem.id}: practice problems describe ${key}`);
      for (const key of ['input', 'output']) assert.doesNotMatch(problem[key], /`/, `${problem.id}: ${key} is shown as plain text`);
    }
    if (problem.kind !== 'exam') assert.ok(problem.hints.length >= 2 && problem.hints.length <= 3, `${problem.id}: 2 or 3 hints`);
    for (const hint of problem.hints) {
      for (const line of solutionLines(problem)) assert.ok(!squeeze(hint).includes(squeeze(line)), `${problem.id}: a hint gives away the code line ${line}`);
    }
  }
});

test('starter code is a starting point: it may read the input but never contains the solving code', () => {
  for (const problem of allProblems) {
    // 버그 고치기 문제는 고장 난 코드가 곧 시작 코드이고 설명에 같은 코드 블록이 있다.
    if (/```python/.test(problem.description)) continue;
    for (const line of solutionLines(problem)) {
      if (/input\(|sys\.stdin|^(import|from)\s/.test(line)) continue;
      assert.ok(!squeeze(problem.starter).includes(squeeze(line)), `${problem.id}: the starter already contains ${line}`);
    }
    assert.notEqual(squeeze(problem.starter), squeeze(problem.solution), `${problem.id}: the starter is the solution`);
  }
});

const pythonCommand = ['python', 'python3', 'py'].find(name => spawnSync(name, ['--version']).status === 0);
// Runs each snippet the way the studio does: input() reads the case input, test files exist in a fresh folder, and only stdout is compared.
const pythonRunner = [
  'import sys, io, json, os, tempfile, contextlib',
  'def run(code, text, files=None):',
  '    sys.stdin = io.StringIO(text)',
  '    out = io.StringIO()',
  '    previous = os.getcwd()',
  '    with tempfile.TemporaryDirectory() as work:',
  '        os.chdir(work)',
  '        try:',
  '            for name, content in (files or {}).items():',
  '                with open(os.path.basename(name), "w", encoding="utf-8") as handle:',
  '                    handle.write(content)',
  '            with contextlib.redirect_stdout(out):',
  '                exec(compile(code, "x.py", "exec"), {"__name__": "__main__"})',
  '        except BaseException as error:',
  '            return "ERROR " + repr(error)',
  '        finally:',
  '            os.chdir(previous)',
  '    return out.getvalue()',
  'def norm(value):',
  '    return "\\n".join(line.rstrip() for line in value.replace("\\r\\n", "\\n").split("\\n")).rstrip("\\n")',
];
const runPython = (lines, problems) => {
  const result = spawnSync(pythonCommand, ['-X', 'utf8', '-c', [...pythonRunner, ...lines].join('\n')], {
    input: JSON.stringify(problems), encoding: 'utf8', timeout: 240000,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

test('reference solutions pass their own judging cases while starter code does not', { skip: !pythonCommand }, () => {
  const report = runPython([
    'report = {}',
    'for problem in json.load(sys.stdin):',
    '    report[problem["id"]] = {',
    '        "solution": [norm(run(problem["solution"], t["input"], t.get("files"))) == t["output"] for t in problem["tests"]],',
    '        "starter": [norm(run(problem["starter"], t["input"], t.get("files"))) == t["output"] for t in problem["tests"]],',
    '    }',
    'sys.__stdout__.write(json.dumps(report))',
  ], allProblems);
  assert.equal(Object.keys(report).length, allProblems.length);
  for (const [id, { solution, starter }] of Object.entries(report)) {
    assert.ok(solution.every(Boolean), `${id}: solution fails a judging case`);
    assert.ok(!starter.every(Boolean), `${id}: starter code already passes every case`);
  }
});

test('descriptions, hints and explanations are plain markdown: no HTML tags and every block parses', () => {
  // The source bank used a few HTML tags; they were converted. (Text like "<Student object at 0x...>" is a Python repr, not markup.)
  const htmlTag = /<\/?(?:a|b|br|code|div|em|i|li|ol|p|pre|span|strong|table|td|th|tr|ul)(?:\s[^>]*)?\/?>/i;
  for (const problem of allProblems) {
    for (const text of [problem.description, problem.explanation, ...problem.hints]) {
      assert.doesNotMatch(text, htmlTag, `${problem.id}: HTML left in text`);
      assert.doesNotThrow(() => markdown.parse(text), problem.id);
    }
    assert.ok(markdown.parse(problem.description).length > 0, `${problem.id}: empty description`);
  }
});

test('placement test has three multiple choice questions for each of the 15 levels', () => {
  const placement = loadPlacement();
  assert.equal(placement.itemsPerLevel, 3);
  assert.equal(placement.passPerLevel, 2);
  assert.equal(placement.items.length, 45);
  assert.equal(new Set(placement.items.map(item => item.id)).size, 45);
  for (let level = 1; level <= 15; level++) assert.equal(placement.items.filter(item => item.level === level).length, 3, `level ${level}`);
  for (const item of placement.items) {
    assert.equal(item.choices.length, 4, item.id);
    assert.equal(new Set(item.choices).size, 4, `${item.id}: duplicate choices`);
    assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < 4, item.id);
    assert.ok(item.question.trim() && item.explanation.trim(), item.id);
    assert.ok(item.code === null || typeof item.code === 'string', item.id);
  }
});

test('placement questions and exam rules match the engine constants', () => {
  assert.equal(loadPlacement().passPerLevel, progress.PLACEMENT_PASS);
  assert.equal(progress.PLACEMENT_FAIL, 2);
  assert.equal(progress.EXAM_TRIES, 3);
});

// ---- 마크다운 ------------------------------------------------------------------
test('markdown: every line is a paragraph, code blocks keep their lines, bold may contain stars', () => {
  const blocks = markdown.parse('첫 줄 `print()` 와 **굵게**\n\n```\na = 1\n  b = 2\n```\n- 하나\n- 둘\n1. 셋\n| 이름 | 값 |\n|---|---|\n| a | 1 |\n한 줄 더');
  assert.deepEqual(blocks.map(block => block.type), ['p', 'code', 'ul', 'ol', 'table', 'p']);
  assert.deepEqual(blocks[0].tokens.map(token => token.type), ['text', 'code', 'text', 'bold']);
  assert.equal(blocks[1].text, 'a = 1\n  b = 2');
  assert.equal(blocks[2].items.length, 2);
  assert.deepEqual(blocks[4].head, ['이름', '값']);
  assert.deepEqual(blocks[4].rows, [['a', '1']]);
  assert.deepEqual(markdown.inline('**a * b** 와 `x*y`').map(token => [token.type, token.text]), [['bold', 'a * b'], ['text', ' 와 '], ['code', 'x*y']]);
  assert.deepEqual(markdown.parse('<script>alert(1)</script>'), [{ type: 'p', tokens: [{ type: 'text', text: '<script>alert(1)</script>' }] }], 'tags stay plain text');
  assert.deepEqual(markdown.parse(''), []);
  assert.deepEqual(markdown.parse(null), []);
});

// ---- 공통 동작 -----------------------------------------------------------------
test('output comparison ignores only line endings and trailing whitespace', () => {
  assert.equal(evaluate('normalizeOutput("hello  \\r\\nworld\\n\\n")'), 'hello\nworld');
  assert.equal(evaluate('normalizeOutput(" Hello, Python!\\n")'), ' Hello, Python!');
  assert.notEqual(evaluate('normalizeOutput("hello")'), evaluate('normalizeOutput("Hello")'));
  assert.notEqual(evaluate('normalizeOutput("a  b")'), evaluate('normalizeOutput("a b")'));
  assert.equal(evaluate('normalizeOutput("")'), '');
});

const saved = extra => ({ selected: 'l01_01', codes: {}, coachUrl: 'https://example.com/chat', ...extra });
const read = (record, legacy) => {
  context.saved = record === null ? null : typeof record === 'string' ? record : JSON.stringify(record);
  context.legacy = legacy ?? null;
  return evaluate('readStudioState({ getItem(key) { return key === "paco-studio-v2" ? saved : key === "paco-studio-v1" ? legacy : null; } })');
};
const solvedEntry = { clean: true, first: true, peek: false, coach: false, hints: 0, tries: 1, points: 5 };

test('fresh storage starts at the first problem with no fake progress', () => {
  const result = evaluate('readStudioState({ getItem() { return null; } })');
  assert.equal(result.state.selected, 'l01_01');
  assert.deepEqual({ ...result.state.solved }, {});
  assert.deepEqual({ ...result.state.passed }, {});
  assert.equal(result.state.gems, progress.START_GEMS);
  assert.equal(result.state.placementDone, false);
  assert.equal(result.warning, '');
  assert.equal(result.notice, undefined);
});

test('saved progress, drafts, selected problem and coach URL restore', () => {
  const result = read(saved({
    selected: 'l01_03', codes: { l01_01: 'print(1)' }, solved: { l01_01: solvedEntry }, passed: { 1: 'exam', 2: 'placement' },
    hintsUsed: { l01_02: 1 }, peeked: { l01_02: true }, coachUsed: { l01_02: true }, tries: { l01_02: 2 },
    mistakes: { l01_02: { reason: '줄 수가 달랐어요', coach: true, resolved: true } },
    gems: 7, streak: 3, lastDay: '2026-11-14', freeze: 1, combo: 2, daily: { '2026-11-14': 12 }, placementDone: true,
  }));
  assert.equal(result.warning, '');
  const { state } = result;
  assert.equal(state.selected, 'l01_03');
  assert.equal(state.codes.l01_01, 'print(1)');
  assert.equal(state.solved.l01_01.points, 5);
  assert.deepEqual({ ...state.passed }, { 1: 'exam', 2: 'placement' });
  assert.deepEqual([state.gems, state.streak, state.lastDay, state.freeze, state.combo, state.placementDone], [7, 3, '2026-11-14', 1, 2, true]);
  assert.equal(state.mistakes.l01_02.resolved, true);
  assert.equal(state.coachUrl, 'https://example.com/chat');
});

test('records of problems that no longer exist are dropped quietly, other mistakes still warn', () => {
  const result = read(saved({ selected: 'gone', codes: { gone: 'x', l01_01: 'y' }, solved: { gone: solvedEntry, l01_01: solvedEntry }, passed: { 99: 'exam', 1: 'quiz' } }));
  assert.equal(result.warning, '');
  assert.equal(result.state.selected, 'l01_01', 'an unknown selection falls back to the first problem');
  assert.deepEqual(Object.keys(result.state.codes), ['l01_01']);
  assert.deepEqual(Object.keys(result.state.solved), ['l01_01']);
  assert.deepEqual({ ...result.state.passed }, { 1: 'quiz' });
});

test('a browser that saved the previous default coach moves to the new one, custom coaches stay', () => {
  const legacy = 'https://copilotstudio.microsoft.com/environments/9324e73a-cd4e-e049-b7ba-177af6165e9c/bots/crbf2_agent_dKZZIw/webchat?__version__=2&enableFileAttachment=false&cliAgent=true';
  assert.equal(read(saved({ coachUrl: legacy })).state.coachUrl, evaluate('DEFAULT_COACH_URL'));
  assert.match(evaluate('DEFAULT_COACH_URL'), /\/bots\/crbf2_bot_QSDFLs\/webchat\?/);
  assert.equal(read(saved({ coachUrl: 'https://example.com/my-coach' })).state.coachUrl, 'https://example.com/my-coach');
});

test('invalid saved records warn explicitly without writing over the original', () => {
  const invalid = [
    '{invalid', 'null', '[]', saved({ codes: [] }), saved({ coachUrl: 'javascript:alert(1)' }), saved({ selected: 7 }),
    saved({ codes: { l01_01: 42 } }), saved({ solved: { l01_01: { clean: 'yes' } } }), saved({ solved: [] }),
    saved({ passed: { 1: 'cheat' } }), saved({ passed: [] }), saved({ gems: -1 }), saved({ gems: 1.5 }), saved({ streak: '3' }),
    saved({ lastDay: 'yesterday' }), saved({ daily: { today: 1 } }), saved({ daily: { '2026-11-14': -1 } }),
    saved({ mistakes: { l01_01: { reason: 1, coach: false } } }), saved({ peeked: { l01_01: false } }), saved({ placementDone: 'yes' }),
    saved({ hintsUsed: { l01_01: -2 } }), saved({ pointsUrl: 'https://evil.example.com/a' }),
  ];
  for (const record of invalid) {
    context.saved = typeof record === 'string' ? record : JSON.stringify(record);
    const result = evaluate('readStudioState({ getItem() { return saved; }, setItem() { throw new Error("Must not overwrite"); } })');
    assert.ok(result.warning, String(context.saved).slice(0, 80));
    assert.equal(result.state.selected, 'l01_01');
    assert.deepEqual({ ...result.state.solved }, {});
  }
  assert.match(evaluate('readStudioState({ getItem() { throw new Error("Denied"); } }).warning'), /Denied/);
});

test('the coach and points addresses of the previous screen are carried over, but its progress is not', () => {
  const legacy = JSON.stringify({
    selected: 'hello', codes: { hello: 'print(1)' }, completed: ['hello'], coachUrl: 'https://example.com/my-coach',
    pointsUrl: 'https://x.api.powerplatform.com/a?sig=secret', awarded: ['x'],
  });
  const result = read(null, legacy);
  assert.equal(result.warning, '');
  assert.match(result.notice, /진단평가/);
  assert.equal(result.state.coachUrl, 'https://example.com/my-coach');
  assert.equal(result.state.pointsUrl, 'https://x.api.powerplatform.com/a?sig=secret');
  assert.deepEqual({ ...result.state.solved }, {});
  assert.deepEqual([...result.state.awarded], []);
  assert.equal(result.state.selected, 'l01_01');
  const hostile = read(null, JSON.stringify({ coachUrl: 'javascript:alert(1)', pointsUrl: 'https://evil.example.com/a' }));
  assert.equal(hostile.state.coachUrl, evaluate('DEFAULT_COACH_URL'));
  assert.equal(hostile.state.pointsUrl, '');
  assert.equal(read(null, '{broken').notice, undefined, 'unreadable old data is ignored');
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
  assert.match(modules['studio-runner'], /new Worker\(workerUrl, \{ type: ['"]module['"] \}\)/);
  assert.match(modules['studio-runner'], /worker\.terminate\(\)/);
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
  assert.match(modules['studio-app'], /onClick: logout/);
  assert.match(modules['studio-app'], /window\.location\.replace\(new URL\("login\.html\?reverify=1"/);
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

test('points depend on the problem level, practice earns a fixed amount and every problem earns points', () => {
  const points = { '맛보기': 5, '입문': 10, '기초': 20, '응용': 30, '도전': 50, '심화': 80 };
  for (const problem of allProblems.filter(problem => problem.kind !== 'practice')) {
    assert.equal(evaluate(`pointsFor(${JSON.stringify({ kind: problem.kind, level: problem.level })})`), points[problem.level], problem.id);
  }
  for (const problem of allProblems.filter(problem => problem.kind === 'practice')) assert.equal(evaluate(`pointsFor(${JSON.stringify({ kind: 'practice', level: problem.level })})`), 2);
  assert.equal(evaluate('pointsFor({ kind: "core", level: "unknown" })'), 0);
  assert.ok(evaluate('PROBLEMS.every((problem) => pointsFor(problem) > 0 && pointsFor(problem) === problem.points)'));
});

test('the level path in the browser follows the catalog: same objects in the list, the model and the lookup', () => {
  assert.equal(evaluate('TRACKS.length'), 15);
  assert.equal(evaluate('PROBLEMS.length'), 366);
  assert.ok(evaluate('PROBLEMS.every((problem) => PROBLEM_BY_ID.get(problem.id) === problem)'));
  assert.ok(evaluate('TRACKS.every((track) => track.problems.every((problem) => PROBLEM_BY_ID.get(problem.id) === problem) && track.exam.every((problem) => PROBLEM_BY_ID.get(problem.id) === problem))'));
  assert.equal(evaluate('MODEL.levelCount'), 15);
  assert.deepEqual({ ...evaluate('MODEL.nextStep(initialState(), 1)') }, { kind: 'core', id: 'l01_01' });
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
    url: flowUrl, student, problemId: 'l01_01', points: 10, fetchImpl: capture(flowReply(200, { updated: true, points: 4770 })),
  });
  assert.deepEqual({ ...added }, { points: 4770, awarded: true });
  const repeated = await request({
    url: flowUrl, student, problemId: 'l01_01', points: 10, fetchImpl: capture(flowReply(200, { updated: true, awarded: false, points: 4770 })),
  });
  assert.deepEqual({ ...repeated }, { points: 4770, awarded: false });
  assert.equal(calls[0].url, flowUrl);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].init.redirect, 'error');
  assert.deepEqual(JSON.parse(calls[0].init.body), { ...student, problemId: 'l01_01', points: 10 });

  const attempt = (reply, url = flowUrl) => request({ url, student, problemId: 'l01_01', points: 10, fetchImpl: capture(reply) });
  await assert.rejects(() => attempt(flowReply(404, { updated: false })), /활성 학생 기록/);
  await assert.rejects(() => attempt(flowReply(500, {})), /\(500\)/);
  await assert.rejects(() => attempt(flowReply(200, { updated: 'true', points: 1 })), /응답 형식/);
  await assert.rejects(() => attempt(flowReply(200, { updated: true, points: '1' })), /응답 형식/);
  const before = calls.length;
  await assert.rejects(() => attempt(flowReply(200, { updated: true, points: 1 }), 'https://evil.example.com/a'), /Power Automate/);
  assert.equal(calls.length, before, 'invalid addresses must never be called');
});

test('saved studio state without the points fields still loads and invalid flow addresses are not trusted', () => {
  const loaded = read(saved({ solved: { l01_01: solvedEntry } }));
  assert.equal(loaded.warning, '');
  assert.equal(loaded.state.pointsUrl, '');
  assert.equal(loaded.state.awarded.length, 0);
  const restored = read(saved({ pointsUrl: flowUrl, awarded: ['a', 'a', 7] }));
  assert.equal(restored.state.pointsUrl, flowUrl);
  assert.deepEqual([...restored.state.awarded], ['a']);
  const rejected = read(saved({ pointsUrl: 'https://evil.example.com/a' }));
  assert.equal(rejected.state.pointsUrl, '');
  assert.match(rejected.warning, /Power Automate/);
});

test('new.html stays a thin shell: styles, code and problems live in their own files', () => {
  assert.ok(Buffer.byteLength(html) < 16 * 1024, 'new.html must not inline the curriculum or the UI code again');
  assert.doesNotMatch(html, /<style|id="curriculum"|application\/json/);
  assert.match(html, /<link rel="stylesheet" href="\.\/studio\.css" \/>/);
  const order = ['studio-catalog', 'studio-progress', 'studio-markdown', 'studio-core'].map(name => html.indexOf(`<script src="./${name}.js"></script>`));
  assert.ok(order.every(index => index > 0) && order.every((index, i) => !i || index > order[i - 1]), 'plain scripts load in dependency order');
  assert.match(html, /<script type="module" src="\.\/studio-app\.js"><\/script>/);
});

// ---- 문제·진단평가 불러오기 -------------------------------------------------------
test('problem files are found in their step folder and every file passes the loader checks', () => {
  const url = id => evaluate(`problemDetailUrl(PROBLEM_BY_ID.get(${JSON.stringify(id)}))`);
  assert.equal(url('l01_01'), './curriculum/step-01/l01_01.json');
  assert.equal(url('c6001'), './curriculum/step-01/c6001.json');
  assert.equal(url('l10_t2'), './curriculum/step-10/l10_t2.json');
  assert.equal(url('l15_08'), './curriculum/step-15/l15_08.json');

  const fresh = createStudio();
  assert.ok(vm.runInContext('PROBLEMS.every((p) => p.tests === undefined)', fresh), 'the list starts without problem text');
  for (const problem of allProblems) {
    fresh.file = problem;
    assert.doesNotThrow(() => vm.runInContext('parseProblemDetail(PROBLEM_BY_ID.get(file.id), file)', fresh), problem.id);
  }
});

test('problem text is fetched once per problem, even for simultaneous requests, and merged into the list entry', async () => {
  const fresh = createStudio();
  const first = curriculum[0].problems[0];
  const urls = [];
  fresh.fakeFetch = async url => { urls.push(url); return { ok: true, status: 200, json: async () => structuredClone(first) }; };
  const load = () => vm.runInContext('loadProblem("l01_01", fakeFetch)', fresh);
  const [a, b] = await Promise.all([load(), load()]);
  assert.equal(a, b);
  assert.deepEqual(urls, ['./curriculum/step-01/l01_01.json']);
  assert.deepEqual(JSON.parse(JSON.stringify(a.tests)), first.tests);
  assert.equal(a.starter, first.starter);
  assert.equal(a.description, first.description);
  assert.equal(a.trackId, 't1');
  assert.equal(vm.runInContext('TRACKS[0].problems[0]', fresh), a, 'the roadmap list shares the loaded object');
  await load();
  assert.equal(urls.length, 1, 'a loaded problem is not fetched again');
  const withFiles = curriculum[9].problems[0];
  fresh.fileFetch = async () => ({ ok: true, status: 200, json: async () => structuredClone(withFiles) });
  const loaded = await vm.runInContext(`loadProblem(${JSON.stringify(withFiles.id)}, fileFetch)`, fresh);
  assert.deepEqual(Object.keys(loaded.tests[0].files), Object.keys(withFiles.tests[0].files), 'test files are kept for the Python worker');
  const practice = curriculum[0].problems.find(problem => problem.link);
  fresh.practiceFetch = async () => ({ ok: true, status: 200, json: async () => structuredClone(practice) });
  assert.deepEqual({ ...(await vm.runInContext(`loadProblem(${JSON.stringify(practice.id)}, practiceFetch)`, fresh)).link }, practice.link);
  const many = await vm.runInContext('loadProblems(["l01_01", "l01_01"], fakeFetch)', fresh);
  assert.equal(many.length, 2);
});

test('a failed or malformed problem file is rejected, leaves the problem unloaded and can be retried', async () => {
  const fresh = createStudio();
  const first = curriculum[0].problems[0];
  let reply;
  fresh.fakeFetch = async () => reply;
  const load = () => vm.runInContext('loadProblem("l01_01", fakeFetch)', fresh);
  const ok = body => ({ ok: true, status: 200, json: async () => body });
  reply = { ok: false, status: 404, json: async () => ({}) };
  await assert.rejects(load, /\(404\)/);
  for (const body of [null, [], { ...first, id: 'l01_02' }, { ...first, description: '  ' }, { ...first, description: 7 }, { ...first, tests: [] },
    { ...first, hints: [''] }, { ...first, hints: 'x' }, { ...first, starter: 7 }, { ...first, solution: undefined }, { ...first, explanation: null },
    { ...first, tests: [{ input: 1, output: '' }] }, { ...first, tests: [{ input: '', output: '', files: { 'a.txt': 5 } }] },
    { ...first, tests: [{ input: '', output: '', files: [] }] }, { ...first, link: { url: 1, label: 'x' } }]) {
    reply = ok(body);
    await assert.rejects(load, /형식이 올바르지 않아요/);
  }
  reply = { ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } };
  await assert.rejects(load, /bad json/);
  assert.equal(vm.runInContext('PROBLEM_BY_ID.get("l01_01").tests', fresh), undefined);
  reply = ok(first);
  assert.equal((await load()).title, first.title);
  await assert.rejects(() => vm.runInContext('loadProblem("missing", fakeFetch)', fresh), /알 수 없는 문제/);
});

test('placement questions load once, accept questions without code and are grouped by level', async () => {
  const fresh = createStudio();
  const placement = loadPlacement();
  let calls = 0;
  fresh.placementFetch = async url => { calls += 1; assert.equal(url, './curriculum/placement.json'); return { ok: true, status: 200, json: async () => structuredClone(placement) }; };
  const [a, b] = await Promise.all([vm.runInContext('loadPlacement(placementFetch)', fresh), vm.runInContext('loadPlacement(placementFetch)', fresh)]);
  assert.equal(a, b);
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(a).map(Number), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.ok(Object.values(a).every(items => items.length === 3));
  assert.ok(placement.items.some(item => item.code === null), 'the real file has questions without code');

  const broken = createStudio();
  let reply;
  broken.badFetch = async () => reply;
  const load = () => vm.runInContext('loadPlacement(badFetch)', broken);
  reply = { ok: false, status: 500, json: async () => ({}) };
  await assert.rejects(load, /\(500\)/);
  for (const body of [null, { items: [] }, { items: [{ ...placement.items[0], answer: 4 }] }, { items: [{ ...placement.items[0], choices: ['one'] }] },
    { items: [{ ...placement.items[0], level: 16 }] }, { items: [{ ...placement.items[0], code: 5 }] }, { items: [{ ...placement.items[0], explanation: undefined }] }]) {
    reply = { ok: true, status: 200, json: async () => body };
    await assert.rejects(load, /형식이 올바르지 않아요/);
  }
  reply = { ok: true, status: 200, json: async () => placement };
  assert.equal(Object.keys(await load()).length, 15, 'a failed load can be retried');
});

test('shuffling keeps every item exactly once', () => {
  const list = [1, 2, 3, 4, 5];
  const result = vm.runInContext('shuffled', context)(list, () => 0.3);
  assert.deepEqual([...result].sort(), list);
  assert.deepEqual(list, [1, 2, 3, 4, 5], 'the input is not changed');
});

test('the first screen asks for the problem a link names, otherwise for the next step of the saved progress', () => {
  const startup = (search, record) => {
    context.saved = record === null ? null : JSON.stringify(record);
    return evaluate(`startupProblemId(${JSON.stringify(search)}, { getItem() { return saved; } })`);
  };
  assert.equal(startup('', null), 'l01_01');
  assert.equal(startup('?problem=l05_03', saved({})), 'l05_03', 'a link wins');
  assert.equal(startup('?problem=missing', saved({})), 'l01_01', 'an unknown link is ignored');
  assert.equal(startup('', saved({ solved: { l01_01: solvedEntry }, selected: 'l01_01' })), 'l01_02', 'the next core problem to solve');
  assert.equal(startup('', saved({ solved: { l01_01: { ...solvedEntry, clean: false } } })), 'c6001', 'a required practice comes first');
  assert.equal(startup('', saved({ passed: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1, 'exam'])), selected: 'l15_08' })), 'l15_08', 'everything passed: the saved problem');
  assert.equal(evaluate('requestedProblemId("?problem=c6001")'), 'c6001');
  assert.equal(evaluate('requestedProblemId("?problem=l10_t1")'), 'l10_t1', 'exam problems are known ids too');
  assert.equal(evaluate('requestedProblemId("")'), '');
});

test('the question for the coach contains the problem, the level, my code and the situation, and never the answer', () => {
  const problem = { title: '첫 인사', description: '화면에 인사를 출력하세요.', input: '입력 없음', output: '인사', solution: 'print("SECRET-ANSWER")' };
  context.promptArgs = {
    question: '정답 말고, 작은 힌트만 줄래?', problem, levelLabel: 'Lv.1 Python 입문자', code: 'print(1)', error: 'NameError: x', failures: 2, hintsUsed: 1,
  };
  const text = evaluate('buildCoachPrompt(promptArgs)');
  for (const part of ['[Lv.1 Python 입문자 · 첫 인사]', 'Lv.1 Python 입문자 단계', '화면에 인사를 출력하세요.', '입력: 입력 없음', '출력: 인사', '정답 말고, 작은 힌트만 줄래?', '2번 틀림', '힌트 1개 사용', '오류 메시지: NameError: x', '```python\nprint(1)\n```']) {
    assert.ok(text.includes(part), part);
  }
  assert.ok(!text.includes('SECRET-ANSWER'));
  context.promptArgs = { question: '질문', problem: { title: 't', description: 'd', input: '', output: '' }, levelLabel: 'Lv.2', code: '', error: '', failures: 0, hintsUsed: 0 };
  const calm = evaluate('buildCoachPrompt(promptArgs)');
  assert.ok(!calm.includes('지금까지') && !calm.includes('오류 메시지') && !calm.includes('입력:'));
});

// ---- 화면 코드 점검 ----------------------------------------------------------------
test('the example answer is shown only after solving or after the three-failure-plus-coach unlock, and never in exams or prompts', () => {
  const learn = modules['studio-learn'];
  const uses = learn.match(/problem\.solution/g) ?? [];
  assert.equal(uses.length, 2, 'the answer appears in exactly two places');
  assert.match(learn, /peeked\s*\?\s*h\(\s*React\.Fragment[\s\S]*?problem\.solution/);
  assert.match(learn, /status\.answerUnlocked\s*\?/);
  assert.match(learn, /solved &&\s*h\(\s*"div",\s*\{ className: "explain-card" \}[\s\S]*?problem\.solution/);
  for (const name of ['studio-quiz', 'studio-coach', 'studio-roadmap', 'studio-code', 'studio-app']) assert.doesNotMatch(modules[name], /\.solution/, `${name} never touches the answer`);
});

test('exams lock the coach, give no hints, count submissions and award points once per problem', () => {
  const quiz = modules['studio-quiz'];
  assert.match(quiz, /locked: "승급 시험 중이에요\."/);
  assert.doesNotMatch(quiz, /HelpLadder|openHint|hints/);
  assert.match(quiz, /PcoProgress\.EXAM_TRIES/);
  assert.match(quiz, /MODEL\.passLevel\(/);
  assert.match(quiz, /for \(const award of outcome\.awards\) ctx\.award\(/);
  assert.match(modules['studio-coach'], /if \(locked\)/);
});

test('solving records the attempt, awards points only for a first-time solve, and failing records the reason', () => {
  const learn = modules['studio-learn'];
  assert.match(learn, /MODEL\.solve\(ctx\.getState\(\), problem\.id, PcoProgress\.dayKey\(new Date\(\)\)\)/);
  assert.match(learn, /if \(result\.firstTime && result\.points > 0\) ctx\.award\(problem, result\.points\)/);
  assert.match(learn, /PcoProgress\.explainMismatch\(failed\.expected, failed\.output, failed\.error\)/);
  assert.match(learn, /MODEL\.fail\(ctx\.getState\(\), problem\.id, reason\)/);
  assert.match(modules['studio-app'], /awarding\.current\.has\(key\)/);
  assert.match(modules['studio-app'], /state\.awarded|stateRef\.current\.awarded\.includes\(key\)/);
});

test('the app opens locked levels and problems only through the rules, with a way back to the roadmap', () => {
  const app = modules['studio-app'];
  assert.match(app, /MODEL\.nodeState\(stateRef\.current, id\)\.status === "locked"/);
  assert.match(app, /if \(!MODEL\.isOpen\(stateRef\.current, level\)\)/);
  assert.match(app, /function openRoadmap|const openRoadmap/);
  assert.match(modules['studio-learn'], /ctx\.openRoadmap/);
  assert.match(modules['studio-quiz'], /ctx\.openRoadmap/);
  assert.match(modules['studio-roadmap'], /ctx\.openPlacement\(track\.number\)/, 'locked levels offer a jump');
  assert.match(modules['studio-roadmap'], /ctx\.openExam\(track\.number\)/, 'the current level offers a shortcut exam');
});

test('exam and placement screens fix their starting state, so results are not recomputed after the level opens', () => {
  const quiz = modules['studio-quiz'];
  assert.match(quiz, /const \[mode\] = useState\(\(\) => \{[\s\S]*?MODEL\.isPassed\(ctx\.state, level\)/);
  assert.match(quiz, /const \[from\] = useState\(\(\) => MODEL\.currentLevel\(ctx\.state\)\)/);
  assert.doesNotMatch(quiz, /^ {2}const (reviewing|from) =/m, 'the starting values must not be recomputed on every render');
});

test('no module writes text into the page as HTML', () => {
  for (const [name, source] of Object.entries(modules)) assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML/, name);
});

test('the Python worker runs each case in a fresh temporary folder with the problem files and removes it afterwards', () => {
  const worker = script('worker-source');
  assert.match(worker, /tempfile\.mkdtemp\(\)/);
  assert.match(worker, /os\.chdir\(workdir\)/);
  assert.match(worker, /os\.path\.basename\(name\)/, 'only plain file names are written');
  assert.match(worker, /shutil\.rmtree\(workdir/);
  assert.match(worker, /_student_files/);
  assert.match(modules['studio-runner'], /files: cases\[current\]\.files/);
  assert.match(modules['studio-code'], /files: problem\.tests\[0\]\.files/, 'a custom run uses the files of the first example');
  assert.match(worker, /20000/, 'the output limit stays');
});
