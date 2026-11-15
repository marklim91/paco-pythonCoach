// public/curriculum/ 의 문제 파일에서 public/studio-catalog.js(문제 목록의 공개 요약)를 만듭니다.
//   node scripts/build-studio-catalog.js           카탈로그를 다시 씁니다.
//   node scripts/build-studio-catalog.js --check   파일이 최신인지만 확인합니다(다르면 종료 코드 1).
// 레벨의 순서와 문제 배치는 step-NN/level.json 이 정하고, 제목·종류·난이도·시간은 각 문제 파일에서 가져옵니다.
const fs = require('node:fs');
const path = require('node:path');

const TYPES = ['실습', '도전', '프로젝트', '연습', '승급시험'];
const LEVELS = ['맛보기', '입문', '기초', '응용', '도전', '심화', '연습'];
const publicDir = path.join(__dirname, '..', 'public');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = message => { throw new Error(`카탈로그를 만들 수 없어요: ${message}`); };

function summary(dir, id, allowedKinds) {
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) fail(`문제 파일이 없어요: ${path.relative(publicDir, file)}`);
  const problem = readJson(file);
  if (problem.id !== id) fail(`${id}.json 의 id 가 ${problem.id} 예요.`);
  if (!allowedKinds.includes(problem.kind)) fail(`${id}: 종류가 ${problem.kind} 예요. (${allowedKinds.join(', ')} 만 올 수 있어요)`);
  if (!TYPES.includes(problem.type) || !LEVELS.includes(problem.level)) fail(`${id}: type/level 값이 올바르지 않아요.`);
  if (!problem.title || !Number.isInteger(problem.minutes) || problem.minutes <= 0) fail(`${id}: title/minutes 가 올바르지 않아요.`);
  return { id, title: problem.title, kind: problem.kind, type: problem.type, level: problem.level, minutes: problem.minutes };
}

function loadLevels(curriculumDir = path.join(publicDir, 'curriculum')) {
  const folders = fs.readdirSync(curriculumDir).filter(name => /^step-\d\d$/.test(name)).sort();
  if (!folders.length) fail('step-NN 폴더가 없어요.');
  const seen = new Set();
  return folders.map((folder, index) => {
    const dir = path.join(curriculumDir, folder);
    const meta = readJson(path.join(dir, 'level.json'));
    if (meta.level !== index + 1 || folder !== `step-${String(meta.level).padStart(2, '0')}` || meta.id !== `t${meta.level}`) {
      fail(`${folder}/level.json 의 level/id 가 폴더와 맞지 않아요.`);
    }
    const problems = meta.path.map(id => summary(dir, id, ['core', 'practice']));
    const exam = meta.exam.map(id => summary(dir, id, ['exam']));
    for (const { id } of [...problems, ...exam]) {
      if (seen.has(id)) fail(`문제 id 가 겹쳐요: ${id}`);
      seen.add(id);
    }
    if (problems[0]?.kind !== 'core' || !exam.length) fail(`${folder}: 첫 문제는 핵심 문제여야 하고 승급 시험이 필요해요.`);
    return { meta, problems, exam };
  });
}

const row = (entry, last) => `        ${JSON.stringify(entry)}${last ? '' : ','}`;

function render(levels) {
  const tracks = levels.map(({ meta, problems, exam }) => [
    '    {',
    `      "id": ${JSON.stringify(meta.id)},`,
    `      "name": ${JSON.stringify(`Lv.${meta.level}`)},`,
    `      "label": ${JSON.stringify(meta.label)},`,
    `      "description": ${JSON.stringify(meta.goal)},`,
    `      "topics": ${JSON.stringify(meta.concepts.join(' · '))},`,
    '      "problems": [',
    ...problems.map((entry, i) => row(entry, i === problems.length - 1)),
    '      ],',
    '      "exam": [',
    ...exam.map((entry, i) => row(entry, i === exam.length - 1)),
    '      ]',
    '    }',
  ].join('\n')).join(',\n');
  return `// 파코 스튜디오(new.html) 문제 목록의 공개 요약입니다. 정답·설명·테스트는 포함하지 않습니다.
// 이 파일은 scripts/build-studio-catalog.js 가 public/curriculum/ 의 문제 파일에서 만듭니다. 직접 고치지 말고
// 문제 파일(또는 step-NN/level.json)을 고친 뒤 \`npm run build:catalog\` 를 실행하세요. tests 가 최신 여부를 확인합니다.
(function (root) {
  var POINTS = { 맛보기: 5, 입문: 10, 기초: 20, 응용: 30, 도전: 50, 심화: 80 };
  var LEVELS = ["맛보기", "입문", "기초", "응용", "도전", "심화"];
  var PRACTICE_POINTS = 2;
  // 각 레벨(트랙)은 problems(핵심·연습 문제의 학습 순서)와 exam(승급 시험 문제)을 가집니다.
  var tracks = [
${tracks}
  ];

  function pointsOf(problem) {
    return problem.kind === "practice" ? PRACTICE_POINTS : POINTS[problem.level];
  }
  var maxPoints = 0;
  var requiredPoints = 0;
  var problems = [];
  tracks.forEach(function (track, index) {
    track.number = index + 1;
    // 단계 구간은 꼭 거쳐야 하는 점수(핵심 문제 + 승급 시험)를 이어 붙여 정합니다. 연습 점수는 덤이라 구간에 넣지 않습니다.
    track.startPoints = requiredPoints;
    var all = track.problems.concat(track.exam);
    track.requiredPoints = all.reduce(function (sum, problem) { return sum + (problem.kind === "practice" ? 0 : pointsOf(problem)); }, 0);
    track.totalPoints = all.reduce(function (sum, problem) { return sum + pointsOf(problem); }, 0);
    requiredPoints += track.requiredPoints;
    maxPoints += track.totalPoints;
    all.forEach(function (problem) {
      problem.points = pointsOf(problem);
      problem.trackId = track.id;
      problems.push(problem);
    });
  });

  // 누적 점수가 속한 레벨(1부터). 레벨별 필수 점수를 이어 붙인 구간으로 계산하며 잘못된 값은 0입니다.
  function stageForPoints(points) {
    if (typeof points !== "number" || !Number.isFinite(points) || points < 0) return 0;
    for (var i = tracks.length - 1; i >= 0; i--) if (points >= tracks[i].startPoints) return i + 1;
    return 0;
  }
  function solvedSet(completedIds) {
    var set = {};
    (Array.isArray(completedIds) ? completedIds : []).forEach(function (id) { if (typeof id === "string") set[id] = true; });
    return set;
  }
  function isCore(problem) { return problem.kind === "core"; }
  // solved/total 은 핵심 문제 기준이고, 연습 문제와 점수는 따로 셉니다.
  function progress(completedIds) {
    var solved = solvedSet(completedIds);
    var cores = problems.filter(isCore);
    var practice = problems.filter(function (problem) { return problem.kind === "practice"; });
    var solvedProblems = problems.filter(function (problem) { return solved[problem.id]; });
    return {
      solved: cores.filter(function (problem) { return solved[problem.id]; }).length,
      total: cores.length,
      practiceSolved: practice.filter(function (problem) { return solved[problem.id]; }).length,
      practiceTotal: practice.length,
      solvedPoints: solvedProblems.reduce(function (sum, problem) { return sum + problem.points; }, 0),
      tracks: tracks.map(function (track) {
        var coreProblems = track.problems.filter(isCore);
        return { id: track.id, name: track.name, label: track.label, total: coreProblems.length,
          solved: coreProblems.filter(function (problem) { return solved[problem.id]; }).length };
      }),
    };
  }
  // fromStage 레벨부터 아직 풀지 않은 핵심 문제를 순서대로 limit개 돌려줍니다.
  function nextProblems(completedIds, limit, fromStage) {
    var solved = solvedSet(completedIds);
    var start = Math.max(0, (fromStage || 1) - 1);
    var found = [];
    for (var i = start; i < tracks.length && found.length < limit; i++) {
      for (var j = 0; j < tracks[i].problems.length && found.length < limit; j++) {
        var problem = tracks[i].problems[j];
        if (isCore(problem) && !solved[problem.id]) found.push({ problem: problem, track: tracks[i] });
      }
    }
    return found;
  }

  var api = { POINTS: POINTS, LEVELS: LEVELS, PRACTICE_POINTS: PRACTICE_POINTS, tracks: tracks, problems: problems, maxPoints: maxPoints,
    stageForPoints: stageForPoints, progress: progress, nextProblems: nextProblems };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PcoStudio = api;
})(typeof window !== "undefined" ? window : globalThis);
`;
}

function build({ check = false, curriculumDir, outFile = path.join(publicDir, 'studio-catalog.js') } = {}) {
  const text = render(loadLevels(curriculumDir));
  const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').replace(/\r\n/g, '\n') : null;
  if (check) return current === text;
  if (current !== text) fs.writeFileSync(outFile, text, 'utf8');
  return true;
}

module.exports = { loadLevels, render, build };

if (require.main === module) {
  const check = process.argv.includes('--check');
  try {
    const ok = build({ check });
    if (check && !ok) {
      console.error('public/studio-catalog.js 가 문제 파일과 달라요. `npm run build:catalog` 를 실행하세요.');
      process.exit(1);
    }
    console.log(check ? 'studio-catalog.js 는 최신이에요.' : 'studio-catalog.js 를 만들었어요.');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
