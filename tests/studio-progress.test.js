const assert = require('node:assert/strict');
const test = require('node:test');
const P = require('../public/studio-progress');

const item = (id, kind, points) => ({ id, kind, points });
// Level 1: three cores, practice slots after the first two. Level 2: two cores without practice. Level 3: a single core.
const tracks = [
  {
    problems: [item('a1', 'core', 5), item('a1p1', 'practice', 2), item('a1p2', 'practice', 2), item('a2', 'core', 10), item('a2p1', 'practice', 2), item('a3', 'core', 50)],
    exam: [item('ax1', 'exam', 10), item('ax2', 'exam', 10)],
  },
  { problems: [item('b1', 'core', 5), item('b2', 'core', 10)], exam: [item('bx1', 'exam', 10)] },
  { problems: [item('c1', 'core', 5)], exam: [item('cx1', 'exam', 10)] },
];
const model = P.createModel(tracks);
const DAY = '2026-11-14';
const status = (state, id) => model.nodeState(state, id).status;
// Solves a problem the way the studio records it: failed submissions first, then the passing one.
const solveWith = (state, id, { fails = 0, hints = 0, peek = false, day = DAY } = {}) => {
  let next = state;
  for (let i = 0; i < fails; i++) next = model.fail(next, id, '출력이 달랐어요');
  if (hints) next = { ...next, hintsUsed: { ...next.hintsUsed, [id]: hints } };
  if (peek) next = model.peekAnswer(next, id);
  return model.solve(next, id, day);
};

test('a level path groups the practice problems after the core problem they follow', () => {
  const path = P.levelPath(tracks[0]);
  assert.deepEqual(path.cores, ['a1', 'a2', 'a3']);
  assert.deepEqual(path.groups, { a1: ['a1p1', 'a1p2'], a2: ['a2p1'], a3: [] });
  assert.deepEqual(path.exam, ['ax1', 'ax2']);
});

test('a fresh learner can only open level 1 and its first core problem', () => {
  const state = P.freshProgress();
  assert.equal(model.currentLevel(state), 1);
  assert.equal(model.isOpen(state, 1), true);
  assert.equal(model.isOpen(state, 2), false);
  assert.equal(status(state, 'a1'), 'current');
  for (const id of ['a1p1', 'a1p2', 'a2', 'a2p1', 'a3', 'b1']) assert.equal(status(state, id), 'locked', id);
  assert.equal(model.examState(state, 1), 'open', 'the exam can be taken early as a shortcut');
  assert.equal(model.examState(state, 2), 'locked');
  assert.deepEqual(model.nextStep(state, 1), { kind: 'core', id: 'a1' });
  assert.deepEqual(model.nextStep(state, 2), { kind: 'locked', id: null });
});

test('a clean pass (first try, no hint) makes the practice optional and opens the next core', () => {
  const { state, clean, points } = solveWith(P.freshProgress(), 'a1');
  assert.equal(clean, true);
  assert.equal(points, 5);
  assert.equal(status(state, 'a1'), 'done');
  assert.equal(status(state, 'a2'), 'current');
  assert.deepEqual(model.nodeState(state, 'a1p1'), { status: 'open', required: false, skipped: false });
  assert.equal(model.requirement(state, 'a1').required, false);
  const fork = model.afterSolve(state, 'a1');
  assert.deepEqual({ clean: fork.clean, required: fork.required, offer: fork.offer, skippable: fork.skippable, next: fork.next }, {
    clean: true, required: false, offer: 'a1p1', skippable: 2, next: { kind: 'core', id: 'a2' },
  });
});

test('a practice problem is marked skipped once the learner moves past it', () => {
  let state = solveWith(P.freshProgress(), 'a1').state;
  state = solveWith(state, 'a2').state;
  assert.deepEqual(model.nodeState(state, 'a1p1'), { status: 'open', required: false, skipped: true });
  assert.deepEqual(model.nodeState(state, 'a1p2'), { status: 'open', required: false, skipped: true });
});

test('a failed submission or a used hint makes one practice problem required before the next core', () => {
  for (const options of [{ fails: 1 }, { hints: 1 }, { peek: true }]) {
    const { state, clean } = solveWith(P.freshProgress(), 'a1', options);
    assert.equal(clean, false, JSON.stringify(options));
    assert.equal(status(state, 'a2'), 'locked', 'the next core stays locked');
    assert.deepEqual(model.nodeState(state, 'a1p1'), { status: 'current', required: true, skipped: false });
    assert.deepEqual(model.nodeState(state, 'a1p2'), { status: 'open', required: false, skipped: false });
    assert.deepEqual(model.requirement(state, 'a1'), { required: true, practiceId: 'a1p1' });
    assert.deepEqual(model.nextStep(state, 1), { kind: 'practice', id: 'a1p1' });
    const fork = model.afterSolve(state, 'a1');
    assert.equal(fork.required, true);
    assert.deepEqual(fork.next, { kind: 'practice', id: 'a1p1' });
  }
});

test('solving any practice problem of the slot satisfies the requirement and remembers why it was required', () => {
  let state = solveWith(P.freshProgress(), 'a1', { hints: 1 }).state;
  state = solveWith(state, 'a1p2').state;
  assert.equal(status(state, 'a2'), 'current');
  assert.equal(model.requirement(state, 'a1').required, false);
  assert.equal(model.requiredReason(state, 'a1p2'), 'hint');
  let retry = solveWith(P.freshProgress(), 'a1', { fails: 2 }).state;
  retry = solveWith(retry, 'a1p1').state;
  assert.equal(model.requiredReason(retry, 'a1p1'), 'retry');
  const clean = solveWith(solveWith(P.freshProgress(), 'a1').state, 'a1p1').state;
  assert.equal(model.requiredReason(clean, 'a1p1'), '');
});

test('the last core problem never blocks the exam, and the exam becomes the next step after the last core', () => {
  let state = P.freshProgress();
  state = solveWith(state, 'a1').state;
  state = solveWith(state, 'a2', { fails: 1 }).state;
  assert.equal(status(state, 'a3'), 'locked');
  state = solveWith(state, 'a2p1').state;
  assert.equal(status(state, 'a3'), 'current');
  assert.equal(model.examState(state, 1), 'open');
  state = solveWith(state, 'a3', { fails: 2 }).state;
  assert.equal(model.examState(state, 1), 'current');
  assert.deepEqual(model.nextStep(state, 1), { kind: 'exam', id: 'ax1' });
});

test('passing the exam opens the next level, awards each exam problem once and unlocks every problem for review', () => {
  let state = solveWith(P.freshProgress(), 'a1').state;
  const result = model.passLevel(state, 1, 'exam', DAY);
  assert.equal(result.state.passed[1], 'exam', 'unsolved core problems were skipped');
  assert.deepEqual(result.awards, [{ id: 'ax1', points: 10 }, { id: 'ax2', points: 10 }]);
  assert.equal(result.points, 20);
  assert.equal(result.gems, P.GEMS.levelPass);
  state = result.state;
  assert.equal(model.isOpen(state, 2), true);
  assert.equal(model.examState(state, 1), 'done');
  assert.equal(status(state, 'a1'), 'done');
  assert.deepEqual(model.nodeState(state, 'a3'), { status: 'open', required: false, skipped: true });
  assert.deepEqual(model.nextStep(state, 1), { kind: 'done', id: null });
  assert.equal(model.currentLevel(state), 2);
  assert.equal(model.totalPoints(state), 25);

  const again = model.passLevel(state, 1, 'exam', DAY);
  assert.equal(again.state, state, 'a repeated pass changes nothing');
  assert.deepEqual(again.awards, []);

  let walked = P.freshProgress();
  for (const id of ['a1', 'a2', 'a3']) walked = solveWith(walked, id).state;
  assert.equal(model.passLevel(walked, 1, 'exam', DAY).state.passed[1], 'quiz', 'all core problems were solved, so it is a regular pass');
  assert.throws(() => model.passLevel(P.freshProgress(), 1, 'cheat', DAY), /알 수 없는/);
});

test('failed submissions reset the combo, are noted in the mistake book and disappear when solved', () => {
  let state = solveWith(P.freshProgress(), 'a1').state;
  assert.equal(state.combo, 1);
  state = model.fail(state, 'a2', '줄 수가 달랐어요');
  assert.equal(state.combo, 0);
  assert.equal(state.tries.a2, 1);
  assert.deepEqual(state.mistakes.a2, { reason: '줄 수가 달랐어요', coach: false });
  const alone = model.solve(state, 'a2', DAY);
  assert.equal(alone.state.mistakes.a2, undefined, 'solved without the coach: the note disappears');
  assert.equal(alone.state.solved.a2.clean, false);
  assert.equal(model.fail(state, 'ax1', 'x'), state, 'exam problems have their own attempt rules');
});

test('a mistake solved after talking with the coach stays in the notebook as solved with the coach', () => {
  let state = model.fail(P.freshProgress(), 'a2', '줄 수가 달랐어요');
  state = model.useCoach(state, 'a2');
  assert.deepEqual(state.mistakes.a2, { reason: '줄 수가 달랐어요', coach: true });
  const solved = model.solve(state, 'a2', DAY);
  assert.deepEqual(solved.state.mistakes.a2, { reason: '줄 수가 달랐어요', coach: true, resolved: true });
  assert.equal(solved.state.solved.a2.coach, true);
});

test('the roadmap shows every solved practice problem but only the next unsolved one of each slot', () => {
  let state = P.freshProgress();
  assert.deepEqual(model.pathEntries(state, 1), [
    { id: 'a1', more: 0 }, { id: 'a1p1', more: 1 }, { id: 'a2', more: 0 }, { id: 'a2p1', more: 0 }, { id: 'a3', more: 0 },
  ]);
  state = solveWith(solveWith(state, 'a1').state, 'a1p1').state;
  assert.deepEqual(model.pathEntries(state, 1).slice(0, 3), [{ id: 'a1', more: 0 }, { id: 'a1p1', more: 0 }, { id: 'a1p2', more: 0 }]);
  assert.deepEqual(model.pathEntries(state, 2).map((entry) => entry.id), ['b1', 'b2']);
});

test('points and gems: full points, two points after peeking at the answer, nothing for a repeat', () => {
  const base = P.freshProgress();
  const normal = model.solve(base, 'a2', DAY);
  assert.deepEqual([normal.points, normal.gems], [10, P.GEMS.core]);
  assert.equal(normal.state.gems, P.START_GEMS + P.GEMS.core);
  const peeked = solveWith(base, 'a3', { peek: true });
  assert.deepEqual([peeked.points, peeked.gems], [P.PEEK_POINTS, 0]);
  const practice = model.solve(base, 'a1p1', DAY);
  assert.deepEqual([practice.points, practice.gems], [2, P.GEMS.practice]);
  const repeat = model.solve(normal.state, 'a2', DAY);
  assert.deepEqual([repeat.points, repeat.gems, repeat.firstTime], [0, 0, false]);
  assert.equal(repeat.state.gems, normal.state.gems);
  assert.equal(model.solve(base, 'missing', DAY).points, 0);
});

test('every fifth correct answer in a row gives bonus gems and a daily goal gives gems once', () => {
  const ids = ['a1', 'a1p1', 'a1p2', 'a2', 'a2p1'];
  let state = P.freshProgress();
  const events = [];
  for (const id of ids) {
    const result = model.solve(state, id, DAY);
    events.push(...result.events.map((event) => event.type));
    state = result.state;
  }
  assert.equal(state.combo, 5);
  assert.ok(events.includes('combo'));
  assert.equal(state.daily[DAY], 5 + 2 + 2 + 10 + 2);
  assert.equal(events.filter((type) => type === 'daily-goal').length, 0, 'under the daily goal');
  const goal = model.solve(state, 'a3', DAY);
  assert.deepEqual(goal.events.map((event) => event.type), ['daily-goal']);
  assert.equal(goal.state.gems, state.gems + P.GEMS.core + P.GEMS.dailyGoal);
});

test('streak counts consecutive days, a missed day resets it unless a freeze is owned, and every 7th day gives gems', () => {
  const touch = (state, day) => model.solve(state, 'a1p1', day).state;
  let state = touch(P.freshProgress(), '2026-11-10');
  assert.equal(state.streak, 1);
  state = touch({ ...state, solved: {} }, '2026-11-10');
  assert.equal(state.streak, 1, 'the same day does not count twice');
  state = touch({ ...state, solved: {} }, '2026-11-11');
  assert.equal(state.streak, 2);
  const missed = touch({ ...state, solved: {} }, '2026-11-14');
  assert.equal(missed.streak, 1);
  const frozen = model.solve({ ...state, solved: {}, freeze: 1 }, 'a1p1', '2026-11-14');
  assert.equal(frozen.state.streak, 3);
  assert.equal(frozen.state.freeze, 0);
  assert.deepEqual(frozen.events.map((event) => event.type), ['freeze-used']);
  const six = { ...P.freshProgress(), streak: 6, lastDay: '2026-11-13' };
  const seventh = model.solve(six, 'a1p1', '2026-11-14');
  assert.equal(seventh.state.streak, 7);
  assert.ok(seventh.events.some((event) => event.type === 'week-streak'));
  assert.equal(seventh.state.gems, six.gems + P.GEMS.practice + P.GEMS.weekStreak);
  assert.equal(P.dayDiff('2026-11-30', '2026-12-01'), 1);
  assert.equal(P.dayKey(new Date(2026, 10, 4)), '2026-11-04');
  assert.equal(P.liveStreak(state, '2026-11-12'), 2, 'yesterday still counts');
  assert.equal(P.liveStreak(state, '2026-11-14'), 0, 'two idle days break the streak');
  assert.equal(P.liveStreak({ ...state, freeze: 1 }, '2026-11-14'), 2, 'a freeze keeps it');
  assert.equal(P.liveStreak(P.freshProgress(), '2026-11-14'), 0);
});

test('hints cost gems one at a time and the example answer needs three failures plus a coach question', () => {
  let state = P.freshProgress();
  const first = model.openHint(state, 'a1', 2);
  assert.equal(first.ok, true);
  assert.equal(first.state.gems, P.START_GEMS - P.HINT_COST);
  assert.equal(first.state.hintsUsed.a1, 1);
  assert.equal(model.openHint(first.state, 'a1', 1).reason, 'none-left');
  assert.equal(model.openHint({ ...state, gems: 1 }, 'a1', 2).reason, 'no-gems');

  state = model.fail(model.fail(state, 'a1', ''), 'a1', '');
  assert.deepEqual(model.helpStatus(state, 'a1', 2), {
    failures: 2, hintsUsed: 0, hintsLeft: 2, canBuyHint: true, coachSuggested: false, coachUsed: false, answerUnlocked: false,
  });
  state = model.fail(state, 'a1', '');
  assert.equal(model.helpStatus(state, 'a1', 2).coachSuggested, true);
  assert.equal(model.helpStatus(state, 'a1', 2).answerUnlocked, false, 'the coach comes first');
  state = model.useCoach(state, 'a1');
  assert.equal(model.helpStatus(state, 'a1', 2).answerUnlocked, true);
  assert.equal(model.peekAnswer(state, 'a1').peeked.a1, true);
});

test('boosters: a streak freeze costs gems and cannot be bought without them', () => {
  const rich = { ...P.freshProgress(), gems: 25 };
  const bought = model.buyFreeze(rich);
  assert.equal(bought.ok, true);
  assert.deepEqual([bought.state.gems, bought.state.freeze], [25 - P.FREEZE_COST, 1]);
  assert.equal(model.buyFreeze(P.freshProgress()).ok, false);
});

test('level progress counts core problems and practice slots, and reaches 100% only when the level is passed', () => {
  let state = P.freshProgress();
  assert.deepEqual(model.levelProgress(state, 1), { coresDone: 0, coresTotal: 3, slotsDone: 0, slotsTotal: 2, practiceDone: 0, practiceTotal: 3, percent: 0 });
  state = solveWith(state, 'a1').state;
  state = solveWith(state, 'a1p1').state;
  const progress = model.levelProgress(state, 1);
  assert.deepEqual([progress.coresDone, progress.slotsDone, progress.practiceDone, progress.percent], [1, 1, 1, 33]);
  assert.equal(model.levelProgress(model.passLevel(state, 1, 'exam', DAY).state, 1).percent, 100);
});

test('placement test: two right answers confirm a level, two wrong answers stop there', () => {
  const state = P.freshProgress();
  let run = model.placementStart(state, tracks.length, 'placement');
  assert.deepEqual([run.from, run.to, run.level, run.mode], [1, 3, 1, 'placement']);
  run = model.placementAnswer(run, true);
  assert.equal(run.level, 1);
  run = model.placementAnswer(run, false);
  assert.deepEqual([run.asked, run.right, run.wrong, run.done], [2, 1, 1, false], 'one miss is allowed');
  run = model.placementAnswer(run, true);
  assert.deepEqual([run.level, run.justConfirmed, run.confirmed, run.done], [2, 1, [1], false]);
  run = model.placementAnswer(model.placementAnswer(run, false), false);
  assert.deepEqual([run.done, run.startLevel, run.result, run.confirmed], [true, 2, 'stopped', [1]]);
  const placed = model.applyPlacement(state, run);
  assert.deepEqual(placed.passed, { 1: 'placement' });
  assert.equal(placed.placementDone, true);
  assert.equal(model.currentLevel(placed), 2);
});

test('placement test: confirming every tested level starts at the last level, and a jump stops before the target', () => {
  const state = P.freshProgress();
  let run = model.placementStart(state, tracks.length, 'placement');
  for (let i = 0; i < 4; i++) run = model.placementAnswer(run, true);
  assert.deepEqual([run.done, run.startLevel, run.result, run.confirmed], [true, 3, 'reached', [1, 2]]);
  assert.equal(model.currentLevel(model.applyPlacement(state, run)), 3);

  let jump = model.placementStart(state, 2, 'jump');
  jump = model.placementAnswer(model.placementAnswer(jump, true), true);
  assert.deepEqual([jump.done, jump.startLevel, jump.confirmed], [true, 2, [1]]);
  assert.deepEqual(model.applyPlacement(state, jump).passed, { 1: 'jump' });
  assert.equal(model.placementStart(state, 1, 'jump'), null, 'nothing to test when the target is the current level');
  assert.equal(model.placementStart(model.passLevel(state, 1, 'exam', DAY).state, 2, 'jump'), null);
});

test('mismatch reasons describe what went wrong without revealing the answer', () => {
  assert.equal(P.explainMismatch('a\nb', 'a\nb\n', ''), '');
  assert.equal(P.explainMismatch('a\nb', 'a', ''), '줄 수가 달랐어요');
  assert.equal(P.explainMismatch('Hello', 'hello', ''), '대소문자가 달랐어요');
  assert.equal(P.explainMismatch('a b', 'a  b', ''), '띄어쓰기가 달랐어요');
  assert.equal(P.explainMismatch('a', '', ''), '출력이 없었어요');
  assert.equal(P.explainMismatch('a', 'b', ''), '출력이 달랐어요');
  assert.equal(P.explainMismatch('a', 'b', 'Traceback...\nSyntaxError: invalid syntax'), '문법이 틀렸어요');
  assert.equal(P.explainMismatch('a', '', 'EOFError: input'), 'input()을 너무 많이 불렀어요');
  assert.equal(P.explainMismatch('a', '', 'NameError: x'), '실행 중 오류가 났어요');
});
