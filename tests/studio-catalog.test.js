const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const studio = require('../public/studio-catalog');
const { build, loadLevels } = require('../scripts/build-studio-catalog');
const { loadCurriculum, curriculumFiles, stepFolder, curriculumRoot } = require('./support/curriculum');

const core = fs.readFileSync(path.join(__dirname, '..', 'public', 'studio-core.js'), 'utf8');
const curriculum = loadCurriculum();
const allProblems = curriculum.flatMap(track => [...track.problems, ...track.exam]);

test('the catalog file is generated from the curriculum files and is up to date', () => {
  assert.equal(build({ check: true }), true, 'run `npm run build:catalog`');
});

test('every catalog problem has one file in its step folder, next to level.json, and nothing else is left over', () => {
  const expected = [
    ...studio.tracks.flatMap(track => [
      ...track.problems.map(problem => `${stepFolder(track)}/${problem.id}.json`),
      ...track.exam.map(problem => `${stepFolder(track)}/${problem.id}.json`),
      `${stepFolder(track)}/level.json`,
    ]),
    'placement.json',
  ];
  assert.deepEqual(curriculumFiles(), [...expected].sort((a, b) => a.localeCompare(b)));
  assert.equal(studio.tracks.length, 15);
  assert.equal(studio.problems.length, allProblems.length);
  assert.equal(new Set(allProblems.map(problem => problem.id)).size, allProblems.length, 'problem ids are unique');
});

test('catalog entries match the problem files, and each level starts with a core problem and ends in an exam', () => {
  curriculum.forEach((track, index) => {
    const entry = studio.tracks[index];
    assert.equal(entry.name, `Lv.${index + 1}`);
    assert.equal(entry.label, track.level.label);
    assert.equal(entry.description, track.level.goal);
    assert.equal(entry.topics, track.level.concepts.join(' · '));
    const summary = ({ id, title, kind, type, level, minutes }) => ({ id, title, kind, type, level, minutes });
    assert.deepEqual(entry.problems.map(({ id, title, kind, type, level, minutes }) => ({ id, title, kind, type, level, minutes })), track.problems.map(summary), entry.id);
    assert.deepEqual(entry.exam.map(({ id, title, kind, type, level, minutes }) => ({ id, title, kind, type, level, minutes })), track.exam.map(summary), `${entry.id} exam`);
    assert.equal(entry.problems[0].kind, 'core', `${entry.id}: the path starts with a core problem`);
    assert.ok(entry.problems.filter(problem => problem.kind === 'core').length >= 1);
    assert.ok(entry.exam.length >= 1 && entry.exam.every(problem => problem.kind === 'exam'));
    assert.deepEqual(track.level.path, entry.problems.map(problem => problem.id));
    assert.deepEqual(track.level.exam, entry.exam.map(problem => problem.id));
  });
});

test('studio catalog points follow the studio POINTS_BY_LEVEL, practice is worth a fixed amount and everything adds up', () => {
  const block = core.match(/const POINTS_BY_LEVEL = \{([\s\S]*?)\};/)[1];
  const studioPoints = Object.fromEntries([...block.matchAll(/(\S+):\s*(\d+)/g)].map(match => [match[1], Number(match[2])]));
  assert.deepEqual(studio.POINTS, studioPoints);
  assert.deepEqual(studio.LEVELS, Object.keys(studioPoints));
  assert.equal(studio.PRACTICE_POINTS, 2);
  const points = problem => (problem.kind === 'practice' ? 2 : studioPoints[problem.level]);
  assert.ok(allProblems.every(problem => points(problem) > 0), 'every problem earns points');
  assert.equal(studio.maxPoints, allProblems.reduce((sum, problem) => sum + points(problem), 0));
  let start = 0;
  for (const track of studio.tracks) {
    const required = [...track.problems, ...track.exam].filter(problem => problem.kind !== 'practice').reduce((sum, problem) => sum + points(problem), 0);
    assert.equal(track.requiredPoints, required, `${track.id} required points`);
    assert.equal(track.startPoints, start, `${track.id} start`);
    assert.equal(track.totalPoints, [...track.problems, ...track.exam].reduce((sum, problem) => sum + points(problem), 0));
    start += required;
  }
});

test('the stage follows the required-point ranges of the levels and stays inside the roadmap', () => {
  const { tracks } = studio;
  assert.equal(studio.stageForPoints(0), 1);
  tracks.forEach((track, index) => {
    assert.equal(studio.stageForPoints(track.startPoints), index + 1, `${track.id} start`);
    if (track.startPoints > 0) assert.equal(studio.stageForPoints(track.startPoints - 1), index, `${track.id} just below`);
  });
  assert.equal(studio.stageForPoints(studio.maxPoints), tracks.length);
  assert.equal(studio.stageForPoints(99999), tracks.length);
  for (const invalid of [-1, NaN, Infinity, '100', null, undefined]) assert.equal(studio.stageForPoints(invalid), 0);
});

test('progress counts core problems separately from practice and ignores unknown ids', () => {
  const first = studio.tracks[0];
  const core1 = first.problems.find(problem => problem.kind === 'core');
  const practice1 = first.problems.find(problem => problem.kind === 'practice');
  const progress = studio.progress([core1.id, core1.id, practice1.id, first.exam[0].id, 'missing', 42]);
  assert.equal(progress.solved, 1);
  assert.equal(progress.total, 120);
  assert.equal(progress.practiceSolved, 1);
  assert.equal(progress.practiceTotal, allProblems.filter(problem => problem.kind === 'practice').length);
  assert.equal(progress.solvedPoints, core1.points + 2 + first.exam[0].points);
  assert.equal(progress.tracks[0].solved, 1);
  assert.equal(progress.tracks[0].total, first.problems.filter(problem => problem.kind === 'core').length);
  assert.equal(studio.progress('not-an-array').solved, 0);
});

test('next problems are the unsolved core problems from the requested level on', () => {
  const second = studio.tracks[1];
  const cores = second.problems.filter(problem => problem.kind === 'core');
  const picks = studio.nextProblems([cores[0].id], 3, 2);
  assert.deepEqual(picks.map(pick => pick.problem.id), cores.slice(1, 4).map(problem => problem.id));
  assert.ok(picks.every(pick => pick.problem.kind === 'core' && pick.track === second));
  assert.equal(studio.nextProblems(studio.problems.map(problem => problem.id), 3, 1).length, 0);
  assert.equal(studio.nextProblems([], 2).length, 2);
});

function scratch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pco-catalog-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(path.join(curriculumRoot, 'step-01'), path.join(dir, 'step-01'), { recursive: true });
  return dir;
}

test('the catalog builder refuses broken curriculum folders instead of writing a wrong catalog', t => {
  const dir = scratch(t);
  assert.equal(loadLevels(dir).length, 1);
  const metaFile = path.join(dir, 'step-01', 'level.json');
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  const write = value => fs.writeFileSync(metaFile, JSON.stringify(value));

  write({ ...meta, path: [...meta.path, meta.path[0]] });
  assert.throws(() => loadLevels(dir), /겹쳐요/);
  write({ ...meta, path: ['missing_problem', ...meta.path] });
  assert.throws(() => loadLevels(dir), /문제 파일이 없어요/);
  const practiceFirst = [...meta.path].sort((a, b) => (a.startsWith('l01_') ? 1 : 0) - (b.startsWith('l01_') ? 1 : 0));
  write({ ...meta, path: practiceFirst });
  assert.throws(() => loadLevels(dir), /첫 문제는 핵심 문제/);
  write({ ...meta, level: 2 });
  assert.throws(() => loadLevels(dir), /폴더와 맞지 않아요/);
  write({ ...meta, exam: [meta.path[0]] });
  assert.throws(() => loadLevels(dir), /종류가/);
});
