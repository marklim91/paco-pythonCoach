// 파코 스튜디오의 승급 규칙입니다: 레벨 잠금, 연습 필수 판정, 승급 시험, 진단평가, 점수·보석 계산.
// 화면과 저장소를 모르는 순수 함수만 둡니다. 상태는 바꾸지 않고 새 객체를 돌려주므로 React에서 그대로 쓸 수 있습니다.
(function (root) {
  const HINT_COST = 2;
  const FREEZE_COST = 20;
  const DAILY_GOAL = 30;
  const START_GEMS = 10;
  const EXAM_TRIES = 3;
  const PLACEMENT_PASS = 2;
  const PLACEMENT_FAIL = 2;
  const PEEK_POINTS = 2;
  const COMBO_STEP = 5;
  const GEMS = { core: 2, practice: 1, levelPass: 10, comboBonus: 3, dailyGoal: 5, weekStreak: 10 };
  const HOW = ["quiz", "exam", "jump", "placement"];

  function freshProgress() {
    return {
      solved: {},
      passed: {},
      hintsUsed: {},
      peeked: {},
      coachUsed: {},
      tries: {},
      mistakes: {},
      gems: START_GEMS,
      streak: 0,
      lastDay: "",
      freeze: 0,
      combo: 0,
      daily: {},
      placementDone: false,
    };
  }

  const pad = (value) => String(value).padStart(2, "0");
  function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  function dayDiff(from, to) {
    const parse = (key) => {
      const [y, m, d] = key.split("-").map(Number);
      return Date.UTC(y, m - 1, d);
    };
    return Math.round((parse(to) - parse(from)) / 86400000);
  }
  // 화면에 보여줄 연속 학습일입니다. 하루 넘게 쉬었고 보호 장치도 없으면 이어지지 않은 것으로 봅니다.
  function liveStreak(state, today) {
    if (!state.lastDay) return 0;
    const gap = dayDiff(state.lastDay, today);
    return gap <= 1 || (gap > 1 && state.freeze > 0) ? state.streak : 0;
  }

  function normalizeLines(value) {
    return String(value)
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .replace(/\n+$/, "");
  }
  // 채점이 실패했을 때 실수 노트에 남길 짧은 이유입니다. 정답 내용은 알려주지 않습니다.
  function explainMismatch(expected, actual, error) {
    if (error) {
      if (/SyntaxError|IndentationError|TabError/.test(error)) return "문법이 틀렸어요";
      if (/EOFError/.test(error)) return "input()을 너무 많이 불렀어요";
      return "실행 중 오류가 났어요";
    }
    const want = normalizeLines(expected);
    const got = normalizeLines(actual);
    if (want === got) return "";
    if (!got) return "출력이 없었어요";
    if (want.split("\n").length !== got.split("\n").length) return "줄 수가 달랐어요";
    if (want.toLowerCase() === got.toLowerCase()) return "대소문자가 달랐어요";
    if (want.replace(/\s+/g, "") === got.replace(/\s+/g, "")) return "띄어쓰기가 달랐어요";
    return "출력이 달랐어요";
  }

  // 레벨(트랙)마다 핵심 문제와, 각 핵심 문제 뒤에 이어지는 연습 문제 묶음을 만듭니다.
  function levelPath(track) {
    const items = [];
    const cores = [];
    const groups = {};
    const lead = [];
    let current = null;
    for (const problem of track.problems) {
      items.push(problem.id);
      if (problem.kind === "core") {
        cores.push(problem.id);
        groups[problem.id] = [];
        current = problem.id;
      } else if (current) groups[current].push(problem.id);
      else lead.push(problem.id);
    }
    return { items, cores, groups, lead, exam: (track.exam || []).map((problem) => problem.id) };
  }

  function createModel(tracks) {
    const paths = tracks.map(levelPath);
    const info = {};
    tracks.forEach((track, index) => {
      const path = paths[index];
      for (const problem of track.problems) {
        info[problem.id] = { level: index + 1, kind: problem.kind, problem };
      }
      path.cores.forEach((id, k) => {
        info[id].coreIndex = k;
        for (const practiceId of path.groups[id]) info[practiceId].coreId = id;
      });
      for (const id of path.exam) info[id] = { level: index + 1, kind: "exam", problem: track.exam.find((e) => e.id === id) };
    });
    const levelCount = tracks.length;
    const solvedOf = (state, id) => Boolean(state.solved[id]);
    const isPassed = (state, level) => Boolean(state.passed[level]);
    const isOpen = (state, level) => level >= 1 && level <= levelCount && (level === 1 || isPassed(state, level - 1));
    const isClean = (state, id) => Boolean(state.solved[id] && state.solved[id].clean);

    function currentLevel(state) {
      for (let level = 1; level <= levelCount; level++) if (!isPassed(state, level)) return level;
      return levelCount + 1;
    }
    // 핵심 문제를 깔끔하지 않게(틀렸거나 힌트를 보고) 풀었다면, 연습 한 문제를 풀어야 다음 핵심 문제가 열립니다.
    function requirement(state, coreId) {
      const meta = info[coreId];
      if (!meta || meta.kind !== "core" || !solvedOf(state, coreId)) return { required: false, practiceId: null };
      const path = paths[meta.level - 1];
      if (meta.coreIndex === path.cores.length - 1) return { required: false, practiceId: null };
      const group = path.groups[coreId];
      if (!group.length || isClean(state, coreId) || group.some((id) => solvedOf(state, id))) return { required: false, practiceId: null };
      return { required: true, practiceId: group[0] };
    }
    function requiredReason(state, practiceId) {
      const meta = info[practiceId];
      if (!meta || meta.kind !== "practice" || !meta.coreId || !solvedOf(state, practiceId)) return "";
      const core = state.solved[meta.coreId];
      if (!core || core.clean) return "";
      return core.hints > 0 || core.peek ? "hint" : "retry";
    }

    function nodeState(state, id) {
      const meta = info[id];
      if (!meta || meta.kind === "exam") return { status: "locked", required: false, skipped: false };
      const { level } = meta;
      const path = paths[level - 1];
      if (!isOpen(state, level)) return { status: "locked", required: false, skipped: false };
      if (solvedOf(state, id)) return { status: "done", required: false, skipped: false };
      if (isPassed(state, level)) return { status: "open", required: false, skipped: true };
      if (meta.kind === "core") {
        const k = meta.coreIndex;
        const reachable = k === 0 || (solvedOf(state, path.cores[k - 1]) && !requirement(state, path.cores[k - 1]).required);
        return { status: reachable ? "current" : "locked", required: false, skipped: false };
      }
      if (!meta.coreId) return { status: "open", required: false, skipped: false };
      if (!solvedOf(state, meta.coreId)) return { status: "locked", required: false, skipped: false };
      const need = requirement(state, meta.coreId);
      if (need.required) {
        const first = path.groups[meta.coreId].find((practiceId) => !solvedOf(state, practiceId));
        return { status: first === id ? "current" : "open", required: first === id, skipped: false };
      }
      const nextCore = path.cores[info[meta.coreId].coreIndex + 1];
      return { status: "open", required: false, skipped: Boolean(nextCore && solvedOf(state, nextCore)) };
    }
    function examState(state, level) {
      if (!isOpen(state, level)) return "locked";
      if (isPassed(state, level)) return "done";
      const path = paths[level - 1];
      const ready = path.cores.every((id) => solvedOf(state, id)) && !path.cores.some((id) => requirement(state, id).required);
      return ready ? "current" : "open";
    }
    // '이어서 하기'가 열어야 할 곳: 지금 풀 핵심 문제 → 필수 연습 → 승급 시험 순서입니다.
    function nextStep(state, level) {
      if (!isOpen(state, level)) return { kind: "locked", id: null };
      if (isPassed(state, level)) return { kind: "done", id: null };
      const path = paths[level - 1];
      const target = path.items.find((id) => nodeState(state, id).status === "current");
      if (target) return { kind: info[target].kind, id: target };
      return { kind: "exam", id: path.exam[0] || null };
    }
    function levelProgress(state, level) {
      const path = paths[level - 1];
      const slots = path.cores.filter((id) => path.groups[id].length > 0);
      const coresDone = path.cores.filter((id) => solvedOf(state, id)).length;
      const slotsDone = slots.filter((id) => path.groups[id].some((practiceId) => solvedOf(state, practiceId))).length;
      const passed = isPassed(state, level);
      return {
        coresDone,
        coresTotal: path.cores.length,
        slotsDone,
        slotsTotal: slots.length,
        practiceDone: path.items.filter((id) => info[id].kind === "practice" && solvedOf(state, id)).length,
        practiceTotal: path.items.filter((id) => info[id].kind === "practice").length,
        percent: passed ? 100 : Math.floor((coresDone / Math.max(1, path.cores.length)) * 100),
      };
    }
    // 로드맵에 그릴 항목입니다. 연습 칸은 푼 문제를 모두, 안 푼 문제는 다음 하나만 보여주고 나머지 개수를 알려줍니다.
    function pathEntries(state, level) {
      const path = paths[level - 1];
      const entries = [];
      const slot = (group) => {
        for (const id of group) if (solvedOf(state, id)) entries.push({ id, more: 0 });
        const todo = group.filter((id) => !solvedOf(state, id));
        if (todo.length) entries.push({ id: todo[0], more: todo.length - 1 });
      };
      slot(path.lead);
      for (const core of path.cores) {
        entries.push({ id: core, more: 0 });
        slot(path.groups[core]);
      }
      return entries;
    }
    // 문제를 푼 직후 보여줄 갈림길입니다. 깔끔하게 풀었으면 연습을 건너뛸 수 있고, 아니면 연습 한 문제가 필수입니다.
    function afterSolve(state, id) {
      const meta = info[id];
      if (!meta) return null;
      const level = meta.level;
      const path = paths[level - 1];
      const flow = nextStep(state, level);
      if (meta.kind !== "core") return { kind: meta.kind, clean: true, next: flow, offer: null, required: false };
      const need = requirement(state, id);
      const group = path.groups[id];
      const offer = group.find((practiceId) => !solvedOf(state, practiceId)) || null;
      return {
        kind: "core",
        clean: isClean(state, id),
        required: need.required,
        offer: need.required ? need.practiceId : offer,
        skippable: group.filter((practiceId) => !solvedOf(state, practiceId)).length,
        next: need.required ? { kind: "practice", id: need.practiceId } : flow,
      };
    }

    function touchStreak(state, today, events) {
      if (state.lastDay === today) return state;
      let { streak, freeze, gems } = state;
      if (!state.lastDay) streak = 1;
      else {
        const gap = dayDiff(state.lastDay, today);
        if (gap === 1) streak += 1;
        else if (gap > 1 && freeze > 0) {
          freeze -= 1;
          streak += 1;
          events.push({ type: "freeze-used" });
        } else streak = 1;
      }
      if (streak > 0 && streak % 7 === 0) {
        gems += GEMS.weekStreak;
        events.push({ type: "week-streak", streak, gems: GEMS.weekStreak });
      }
      return { ...state, streak, freeze, gems, lastDay: today };
    }
    function addPoints(state, points, today, events) {
      if (points <= 0) return state;
      let next = touchStreak(state, today, events);
      const before = next.daily[today] || 0;
      const after = before + points;
      next = { ...next, daily: { ...next.daily, [today]: after } };
      if (before < DAILY_GOAL && after >= DAILY_GOAL) {
        next = { ...next, gems: next.gems + GEMS.dailyGoal };
        events.push({ type: "daily-goal", gems: GEMS.dailyGoal });
      }
      return next;
    }

    // 제출이 통과했을 때의 기록입니다. 이미 푼 문제를 다시 풀면 보상은 없습니다.
    function solve(state, id, today) {
      const meta = info[id];
      const events = [];
      if (!meta || meta.kind === "exam") return { state, events, points: 0, gems: 0, firstTime: false };
      if (solvedOf(state, id)) return { state: withoutMistake(state, id), events: [{ type: "review" }], points: 0, gems: 0, firstTime: false };
      const hints = state.hintsUsed[id] || 0;
      const peek = Boolean(state.peeked[id]);
      const first = !(state.tries[id] > 0);
      const base = meta.problem.points || 0;
      const points = peek ? Math.min(base, PEEK_POINTS) : base;
      let gems = peek ? 0 : meta.kind === "core" ? GEMS.core : GEMS.practice;
      const combo = state.combo + 1;
      if (combo % COMBO_STEP === 0) {
        gems += GEMS.comboBonus;
        events.push({ type: "combo", combo, gems: GEMS.comboBonus });
      }
      let next = {
        ...state,
        combo,
        gems: state.gems + gems,
        solved: {
          ...state.solved,
          [id]: { clean: first && hints === 0 && !peek, first, hints, peek, coach: Boolean(state.coachUsed[id]), tries: (state.tries[id] || 0) + 1, points },
        },
      };
      next = withoutMistake(next, id);
      next = addPoints(next, points, today, events);
      return { state: next, events, points, gems, firstTime: true, clean: first && hints === 0 && !peek };
    }
    function withoutMistake(state, id) {
      const mistake = state.mistakes[id];
      if (!mistake) return state;
      // 코치와 이야기한 뒤 해결한 실수는 지우지 않고 '코치와 해결'로 남겨 복습할 수 있게 합니다.
      if (state.coachUsed[id]) {
        return { ...state, mistakes: { ...state.mistakes, [id]: { ...mistake, coach: true, resolved: true } } };
      }
      const mistakes = { ...state.mistakes };
      delete mistakes[id];
      return { ...state, mistakes };
    }
    // 제출이 통과하지 못했을 때의 기록입니다. 콤보는 끊기고 실수 노트에 이유가 남습니다.
    function fail(state, id, reason) {
      const meta = info[id];
      if (!meta || meta.kind === "exam") return state;
      return {
        ...state,
        combo: 0,
        tries: { ...state.tries, [id]: (state.tries[id] || 0) + 1 },
        mistakes: { ...state.mistakes, [id]: { reason: reason || "", coach: Boolean(state.coachUsed[id]) } },
      };
    }
    function openHint(state, id, total) {
      const used = state.hintsUsed[id] || 0;
      if (used >= total) return { state, ok: false, reason: "none-left" };
      if (state.gems < HINT_COST) return { state, ok: false, reason: "no-gems" };
      return { state: { ...state, gems: state.gems - HINT_COST, hintsUsed: { ...state.hintsUsed, [id]: used + 1 } }, ok: true };
    }
    function peekAnswer(state, id) {
      return state.peeked[id] ? state : { ...state, peeked: { ...state.peeked, [id]: true } };
    }
    function useCoach(state, id) {
      const mistake = state.mistakes[id];
      return {
        ...state,
        coachUsed: { ...state.coachUsed, [id]: true },
        mistakes: mistake ? { ...state.mistakes, [id]: { ...mistake, coach: true } } : state.mistakes,
      };
    }
    // 예시 정답은 틀린 뒤 코치와 이야기해 본 다음에 열립니다. (코치는 외부 서비스라 질문 버튼을 쓴 기록으로 판단합니다.)
    function helpStatus(state, id, hintTotal) {
      const failures = state.tries[id] || 0;
      const used = state.hintsUsed[id] || 0;
      return {
        failures,
        hintsUsed: used,
        hintsLeft: Math.max(0, hintTotal - used),
        canBuyHint: state.gems >= HINT_COST,
        coachSuggested: failures >= 3,
        coachUsed: Boolean(state.coachUsed[id]),
        answerUnlocked: failures >= 3 && Boolean(state.coachUsed[id]),
      };
    }
    function buyFreeze(state) {
      if (state.gems < FREEZE_COST) return { state, ok: false };
      return { state: { ...state, gems: state.gems - FREEZE_COST, freeze: state.freeze + 1 }, ok: true };
    }

    // 승급 시험 통과: 레벨을 열고, 처음 통과한 시험 문제의 점수를 모아 돌려줍니다.
    function passLevel(state, level, how, today) {
      const events = [];
      if (!HOW.includes(how)) throw new Error("알 수 없는 승급 방식이에요: " + how);
      if (isPassed(state, level)) return { state, events: [{ type: "review" }], awards: [], points: 0, gems: 0 };
      const path = paths[level - 1];
      const awards = [];
      let solved = state.solved;
      // 핵심 문제를 모두 풀고 본 시험은 'quiz', 풀지 않은 문제를 건너뛰며 본 시험은 'exam'으로 기록합니다.
      if (how === "quiz" || how === "exam") how = path.cores.every((id) => solvedOf(state, id)) ? "quiz" : "exam";
      if (how === "quiz" || how === "exam") {
        for (const id of path.exam) {
          if (solved[id]) continue;
          const points = info[id].problem.points || 0;
          solved = { ...solved, [id]: { clean: true, first: true, hints: 0, peek: false, coach: false, tries: 1, points } };
          awards.push({ id, points });
        }
      }
      const gems = how === "quiz" || how === "exam" ? GEMS.levelPass : 0;
      let next = { ...state, solved, passed: { ...state.passed, [level]: how }, gems: state.gems + gems };
      const points = awards.reduce((sum, award) => sum + award.points, 0);
      next = addPoints(next, points, today, events);
      return { state: next, events, awards, points, gems };
    }
    function totalPoints(state) {
      return Object.values(state.solved).reduce((sum, entry) => sum + (entry.points || 0), 0);
    }

    // 진단평가·점프: 레벨마다 객관식 문제를 풀어 2문제를 맞히면 그 레벨은 '확인'이고, 2문제를 틀리면 그 레벨에서 시작합니다.
    function placementStart(state, targetLevel, mode) {
      const from = currentLevel(state);
      const to = Math.min(targetLevel, levelCount);
      if (from >= to) return null;
      return { mode, from, to, level: from, asked: 0, right: 0, wrong: 0, confirmed: [], done: false, startLevel: from };
    }
    function placementAnswer(run, correct) {
      const right = run.right + (correct ? 1 : 0);
      const wrong = run.wrong + (correct ? 0 : 1);
      const asked = run.asked + 1;
      if (wrong >= PLACEMENT_FAIL) {
        return { ...run, asked, right, wrong, done: true, startLevel: run.level, result: "stopped", justConfirmed: null };
      }
      if (right >= PLACEMENT_PASS) {
        const confirmed = [...run.confirmed, run.level];
        const level = run.level + 1;
        const reset = { asked: 0, right: 0, wrong: 0, confirmed, level, justConfirmed: run.level };
        if (level >= run.to) return { ...run, ...reset, done: true, startLevel: run.to, result: "reached" };
        return { ...run, ...reset };
      }
      return { ...run, asked, right, wrong, justConfirmed: null };
    }
    function applyPlacement(state, run) {
      const passed = { ...state.passed };
      for (const level of run.confirmed) if (!passed[level]) passed[level] = run.mode === "jump" ? "jump" : "placement";
      return { ...state, passed, placementDone: true };
    }

    return {
      levelCount, paths, info, isOpen, isPassed, currentLevel, nodeState, examState, nextStep, levelProgress, pathEntries,
      requirement, requiredReason, afterSolve, solve, fail, openHint, peekAnswer, useCoach, helpStatus, buyFreeze,
      passLevel, totalPoints, placementStart, placementAnswer, applyPlacement,
    };
  }

  const api = {
    HINT_COST, FREEZE_COST, DAILY_GOAL, START_GEMS, EXAM_TRIES, PLACEMENT_PASS, PLACEMENT_FAIL, PEEK_POINTS, COMBO_STEP, GEMS, HOW,
    freshProgress, dayKey, dayDiff, liveStreak, explainMismatch, levelPath, createModel,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PcoProgress = api;
})(typeof window !== "undefined" ? window : globalThis);
