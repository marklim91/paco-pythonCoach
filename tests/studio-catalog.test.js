const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const studio = require('../public/studio-catalog');
const { loadCurriculum, curriculumFiles, stepFolder } = require('./support/curriculum');

const core = fs.readFileSync(path.join(__dirname, '..', 'public', 'studio-core.js'), 'utf8');
const curriculum = loadCurriculum();

test('every catalog problem has one file in its step folder and no other problem files exist', () => {
  const expected = studio.tracks.flatMap(track => track.problems.map(problem => `${stepFolder(track)}/${problem.id}.json`));
  assert.equal(expected.length, 100);
  assert.deepEqual(curriculumFiles(), [...expected].sort());
});

test('studio catalog matches the problem files, so dashboards never drift from the problems', () => {
  assert.equal(studio.tracks.length, curriculum.length);
  curriculum.forEach((track, i) => {
    const catalog = studio.tracks[i];
    for (const key of ['id', 'name', 'label', 'description', 'topics']) assert.equal(catalog[key], track[key], `${track.id}.${key}`);
    assert.deepEqual(
      catalog.problems.map(({ id, title, level, topic, minutes }) => ({ id, title, level, topic, minutes })),
      track.problems.map(({ id, title, level, topic, minutes }) => ({ id, title, level, topic, minutes })),
      track.id,
    );
  });
});

test('studio catalog points follow the studio POINTS_BY_LEVEL and add up to the full score', () => {
  const block = core.match(/const POINTS_BY_LEVEL = \{([\s\S]*?)\};/)[1];
  const studioPoints = Object.fromEntries([...block.matchAll(/(\S+):\s*(\d+)/g)].map(match => [match[1], Number(match[2])]));
  assert.deepEqual(studio.POINTS, studioPoints);
  assert.deepEqual(studio.LEVELS, Object.keys(studioPoints));
  const total = curriculum.flatMap(track => track.problems).reduce((sum, problem) => sum + studioPoints[problem.level], 0);
  assert.equal(studio.maxPoints, total);
  assert.equal(studio.problems.length, 100);
});

test('progress and next problems ignore unknown ids and start from the requested stage', () => {
  const progress = studio.progress(['hello', 'hello', 'missing', 42]);
  assert.equal(progress.solved, 1);
  assert.equal(progress.total, 100);
  assert.equal(progress.solvedPoints, 5);
  assert.equal(progress.tracks[0].solved, 1);
  assert.equal(studio.progress('not-an-array').solved, 0);
  const picks = studio.nextProblems(['t3_vending'], 3, 3);
  assert.deepEqual(picks.map(pick => pick.problem.id).slice(0, 1), [studio.tracks[2].problems[1].id]);
  assert.equal(picks.length, 3);
  assert.equal(studio.nextProblems(studio.problems.map(problem => problem.id), 3, 1).length, 0);
});
