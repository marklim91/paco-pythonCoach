import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Compass, Rocket, Trophy, X, HelpCircle } from "lucide-react";
import { h, Button, icon, badge, Markdown, ProgressBar, levelTitle } from "./studio-ui.js";
import { CodePanel, FilesNote } from "./studio-code.js";
import { CoachPanel } from "./studio-coach.js";
import { ProblemBody } from "./studio-learn.js";

function ResultCard({ mark, title, children, actions }) {
  return h(
    "div",
    { className: "result-screen" },
    h("div", { className: "result-card" }, h("div", { className: "result-mark" }, mark), h("h1", null, title), children, h("div", { className: "hero-actions center" }, actions)),
  );
}

// ---- 승급 시험 ---------------------------------------------------------------
// 코딩 문제를 모두 통과해야 레벨이 열립니다. 문제마다 제출 기회 3번, 힌트와 코치는 쓸 수 없어요.
export function ExamView({ ctx, level }) {
  const track = TRACKS[level - 1];
  const next = TRACKS[level];
  // 시험을 시작할 때의 상태로 고정합니다. 통과하면 레벨이 열려 값이 바뀌지만 결과 화면은 처음 기준으로 보여줘야 해요.
  const [mode] = useState(() => {
    const reviewing = MODEL.isPassed(ctx.state, level);
    const cores = track.problems.filter((problem) => problem.kind === "core");
    return { reviewing, skipping: !reviewing && !cores.every((problem) => ctx.state.solved[problem.id]) };
  });
  const { reviewing, skipping } = mode;
  const [phase, setPhase] = useState("loading");
  const [problems, setProblems] = useState([]);
  const [index, setIndex] = useState(0);
  const [tries, setTries] = useState(0);
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    loadProblems(track.exam.map((p) => p.id))
      .then((list) => active && (setProblems(list), setPhase("intro")))
      .catch(() => active && setLoadError("시험 문제를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요."));
    return () => {
      active = false;
    };
  }, [level]);

  function start() {
    setIndex(0);
    setTries(0);
    setPhase("run");
  }
  function finish() {
    const outcome = MODEL.passLevel(ctx.getState(), level, "exam", PcoProgress.dayKey(new Date()));
    ctx.commit(outcome.state);
    ctx.announce(outcome);
    for (const award of outcome.awards) ctx.award(PROBLEM_BY_ID.get(award.id), award.points);
    setResult(outcome);
    setPhase("pass");
  }
  function quit() {
    if (phase !== "run" || confirm("시험을 그만둘까요? 진행 상황은 저장되지 않아요.")) ctx.openRoadmap();
  }
  function onGraded({ passed }) {
    if (passed) {
      if (index + 1 < problems.length) {
        ctx.toast("통과! 다음 문제예요.");
        setIndex(index + 1);
        setTries(0);
      } else finish();
      return;
    }
    const used = tries + 1;
    setTries(used);
    if (used >= PcoProgress.EXAM_TRIES) setPhase("fail");
    else ctx.toast(`아쉬워요. 제출 기회가 ${PcoProgress.EXAM_TRIES - used}번 남았어요.`);
  }

  if (loadError) return h(ResultCard, { mark: "⚠️", title: "시험을 열 수 없어요", actions: h(Button, { onClick: ctx.openRoadmap }, "로드맵으로") }, h("p", null, loadError));
  if (phase === "loading") return h("div", { className: "loading" }, h("strong", null, "시험 문제를 준비하고 있어요."));
  if (phase === "intro")
    return h(
      ResultCard,
      {
        mark: "📝",
        title: `${track.name} 승급 시험`,
        actions: [h(Button, { key: "go", onClick: start }, "시험 시작"), h(Button, { key: "no", variant: "outline", onClick: ctx.openRoadmap }, "취소")],
      },
      h("p", null, reviewing ? "이미 통과한 레벨의 복습 시험이에요. 점수와 보석은 다시 받지 않아요." : `코딩 ${problems.length}문제를 모두 통과하면 ${next ? `다음 레벨(${levelTitle(next)})이 열려요.` : "모든 과정을 마쳐요."}`),
      h("p", { className: "muted" }, `문제마다 제출 기회 ${PcoProgress.EXAM_TRIES}번 · 힌트와 코치는 쓸 수 없어요`),
      skipping && h("p", { className: "muted" }, "남은 문제를 풀지 않고 바로 도전하는 거예요. 통과하면 이 레벨을 건너뛰어요."),
    );
  if (phase === "pass")
    return h(
      ResultCard,
      {
        mark: "🏆",
        title: reviewing ? "복습 시험 통과!" : `${levelTitle(track)} 통과!`,
        actions: h(Button, { onClick: ctx.openRoadmap }, next && !reviewing ? "다음 레벨로" : "로드맵으로"),
      },
      !reviewing && h("p", null, `+${result.points}점 · 보석 ${result.gems}개`),
      !reviewing && next && h("p", null, `다음 레벨(${levelTitle(next)})이 열렸어요!`),
    );
  if (phase === "fail")
    return h(
      ResultCard,
      {
        mark: "💪",
        title: "조금만 더!",
        actions: [h(Button, { key: "again", onClick: start }, "다시 도전"), h(Button, { key: "map", variant: "outline", onClick: ctx.openRoadmap }, "로드맵으로")],
      },
      h("p", null, "이 레벨의 연습 문제를 풀고 다시 도전해요."),
      h("p", { className: "muted" }, "시험은 몇 번이든 다시 볼 수 있어요."),
    );

  const problem = problems[index];
  const code = ctx.state.codes[problem.id] ?? problem.starter;
  const changeCode = (value) => ctx.apply((previous) => ({ ...previous, codes: { ...previous.codes, [problem.id]: value } }));
  return h(
    "div",
    { className: "learn exam" },
    h(
      "header",
      { className: "learn-bar" },
      h(Button, { variant: "ghost", size: "sm", onClick: quit }, icon(X, { size: 14 }), "시험 그만두기"),
      h("strong", { className: "learn-level" }, `${track.name} 승급 시험 · ${index + 1}/${problems.length}`),
      h(ProgressBar, { value: Math.round((index / problems.length) * 100), label: "시험 진행" }),
      h("span", { className: "combo" }, `제출 기회 ${PcoProgress.EXAM_TRIES - tries}번 남음`),
    ),
    h(
      "div",
      { className: "learn-grid exam-grid" },
      h("section", { className: "panel problem-panel", "aria-label": "시험 문제" }, h("div", { className: "problem-scroll" }, h(ProblemBody, { problem, track }))),
      h(CodePanel, {
        key: problem.id,
        problem,
        code,
        onCodeChange: changeCode,
        onResetCode: () => changeCode(problem.starter),
        runner: ctx.runner,
        onGraded,
        storageWarning: ctx.storageWarning,
        statusNote: `제출 기회 ${PcoProgress.EXAM_TRIES - tries}번 남음 · Ctrl + Enter로 실행`,
      }),
      h(CoachPanel, { ctx, problem, track, code, situation: "start", error: "", locked: "승급 시험 중이에요." }),
    ),
  );
}

// ---- 진단평가 · 점프 ---------------------------------------------------------
// 레벨마다 객관식 문제를 풀어 2문제를 맞히면 그 레벨은 '확인', 2문제를 틀리면 그 레벨에서 학습을 시작해요.
export function PlacementView({ ctx, target }) {
  const jump = typeof target === "number";
  const mode = jump ? "jump" : "placement";
  const [phase, setPhase] = useState("loading");
  const [pool, setPool] = useState(null);
  const [run, setRun] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [picked, setPicked] = useState(null);
  const [answered, setAnswered] = useState(null);
  const [error, setError] = useState("");
  // 시작할 때의 레벨로 고정합니다. 결과를 저장하면 현재 레벨이 바뀌어도 '얼마나 올라갔는지'는 처음 기준으로 보여줘야 해요.
  const [from] = useState(() => MODEL.currentLevel(ctx.state));

  useEffect(() => {
    let active = true;
    loadPlacement()
      .then((byLevel) => active && (setPool(byLevel), setPhase("intro")))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);

  const questionsFor = (level) => shuffled(pool[level] || []);
  function start() {
    const initial = MODEL.placementStart(ctx.getState(), jump ? target : MODEL.levelCount, mode);
    if (!initial) {
      ctx.toast("이미 가장 높은 레벨이에요.");
      ctx.openRoadmap();
      return;
    }
    setRun(initial);
    setQuestions(questionsFor(initial.level));
    setPhase("ask");
  }
  function finish(final) {
    ctx.commit(MODEL.applyPlacement(ctx.getState(), final));
    setRun(final);
    setPhase("result");
  }
  function quit() {
    if (phase !== "ask" || confirm("그만둘까요? 지금까지의 결과는 저장되지 않아요.")) ctx.openRoadmap();
  }
  const question = phase === "ask" && run ? questions[run.asked] : null;
  const choices = useMemo(
    () => (question ? shuffled(question.choices.map((text, i) => ({ text, i }))) : []),
    [question && question.id],
  );
  function submit(correct, choice) {
    setAnswered({ correct, choice, next: MODEL.placementAnswer(run, correct) });
  }
  function proceed() {
    const nextRun = answered.next;
    setAnswered(null);
    setPicked(null);
    setRun(nextRun);
    if (nextRun.done) return finish(nextRun);
    if (nextRun.justConfirmed) {
      setQuestions(questionsFor(nextRun.level));
      setPhase("confirmed");
    }
  }

  if (error) return h(ResultCard, { mark: "⚠️", title: "진단평가를 열 수 없어요", actions: h(Button, { onClick: ctx.openRoadmap }, "로드맵으로") }, h("p", null, error));
  if (phase === "loading") return h("div", { className: "loading" }, h("strong", null, "진단평가 문항을 준비하고 있어요."));
  if (phase === "intro")
    return h(
      ResultCard,
      {
        mark: jump ? "⚡" : "🧭",
        title: jump ? `${levelTitle(TRACKS[target - 1])}(으)로 점프!` : "진단평가",
        actions: [
          h(Button, { key: "go", onClick: start }, jump ? "도전하기" : "시작하기"),
          h(Button, { key: "no", variant: "outline", onClick: () => (jump ? ctx.openRoadmap() : (ctx.apply((previous) => ({ ...previous, placementDone: true })), ctx.openRoadmap())) }, jump ? "취소" : "그냥 여기서부터"),
        ],
      },
      jump
        ? h("p", null, `이미 알고 있다면 앞 레벨을 건너뛸 수 있어요. ${from === target - 1 ? TRACKS[from - 1].name : `${TRACKS[from - 1].name}~${TRACKS[target - 2].name}`} 구간은 레벨마다 객관식 3문제로 확인해요.`)
        : h("p", null, "레벨마다 객관식 3문제씩 풀어요. 코드는 쓰지 않아요."),
      h("p", { className: "muted" }, "2문제 이상 맞히면 그 레벨은 확인되고 다음 레벨로 올라가요. 2문제를 틀리면 그 레벨에서 시작해요. 모르는 문제는 찍지 말고 '잘 모르겠어요'를 눌러요."),
    );
  if (phase === "confirmed")
    return h(
      ResultCard,
      {
        mark: "✅",
        title: `${TRACKS[run.justConfirmed - 1].name} 확인!`,
        actions: [
          h(Button, { key: "go", onClick: () => setPhase("ask") }, "계속"),
          h(Button, { key: "stop", variant: "outline", onClick: () => finish({ ...run, done: true, startLevel: run.level, result: "stopped" }) }, "여기서 시작할래요"),
        ],
      },
      h("p", null, `다음은 ${levelTitle(TRACKS[run.level - 1])} 문항이에요. 계속할까요?`),
    );
  if (phase === "result") {
    const moved = run.startLevel > from;
    const at = TRACKS[Math.min(run.startLevel, MODEL.levelCount) - 1];
    return h(
      ResultCard,
      { mark: moved ? "🚀" : "🧭", title: moved ? "출발 레벨을 찾았어요" : "여기서 시작해요", actions: h(Button, { onClick: ctx.openRoadmap }, "로드맵 보기") },
      h("p", null, `${levelTitle(at)}부터 ${moved ? "시작해요." : "차근차근 시작해요. 금방 올라갈 수 있어요!"}`),
      h("p", { className: "muted" }, moved ? "앞 레벨은 '통과'로 표시되고 언제든 복습할 수 있어요." : "승급 시험으로 한 레벨씩 건너뛸 수도 있어요."),
    );
  }

  const track = TRACKS[run.level - 1];
  const chips = [];
  for (let level = from; level <= Math.min(run.level + 2, run.to); level++) {
    const confirmed = run.confirmed.includes(level);
    chips.push(h("li", { key: level, className: confirmed ? "ok" : level === run.level ? "now" : "" }, confirmed ? `Lv.${level} 확인` : level === run.level ? `Lv.${level} · ${run.right}/3` : `Lv.${level}`));
  }
  if (run.level + 2 < run.to) chips.push(h("li", { key: "more" }, "…"));
  return h(
    "div",
    { className: "learn placement" },
    h(
      "header",
      { className: "learn-bar" },
      h(Button, { variant: "ghost", size: "sm", onClick: quit }, icon(ArrowLeft, { size: 14 }), "진단평가 그만두기"),
      h("strong", { className: "learn-level" }, jump ? "점프 확인" : "진단평가"),
      h(ProgressBar, { value: Math.round(((run.level - from) / Math.max(1, run.to - from)) * 100), label: "진단평가 진행" }),
      h("span", { className: "combo" }, `남은 기회 ${PcoProgress.PLACEMENT_FAIL - run.wrong}번`),
    ),
    h(
      "div",
      { className: "placement-body" },
      h("ul", { className: "level-chips", "aria-label": "레벨별 확인 상태" }, chips),
      h(
        "div",
        { className: "placement-grid" },
        h(
          "section",
          { className: "question-card" },
          h("div", { className: "eyebrow" }, `${track.name} · ${track.label}`),
          h(Markdown, { text: question.question, className: "question" }),
          question.code && h("pre", { className: "md-code" }, question.code),
          !question.code && h(FilesNote, { files: question.files }),
          h(
            "div",
            { className: "choices", role: "group", "aria-label": "보기" },
            choices.map((choice) =>
              h(
                "button",
                {
                  key: choice.i,
                  className: `choice${picked === choice.i ? " picked" : ""}${answered ? (choice.i === question.answer ? " right" : picked === choice.i ? " wrong" : "") : ""}`,
                  "aria-pressed": picked === choice.i,
                  disabled: Boolean(answered),
                  onClick: () => setPicked(choice.i),
                },
                h("pre", null, choice.text),
              ),
            ),
          ),
          answered
            ? h(
                "div",
                { className: `answer-note ${answered.correct ? "ok" : "bad"}` },
                h("strong", null, answered.correct ? "정답이에요!" : answered.choice === null ? "괜찮아요, 정답을 알려줄게요." : "아쉬워요."),
                h(Markdown, { text: question.explanation }),
                h(Button, { onClick: proceed }, answered.next.done ? "결과 보기" : "계속"),
              )
            : h(
                "div",
                { className: "choice-actions" },
                h(Button, { variant: "ghost", onClick: () => submit(false, null) }, icon(HelpCircle, { size: 14 }), "잘 모르겠어요"),
                h(Button, { disabled: picked === null, onClick: () => submit(picked === question.answer, picked) }, icon(Check, { size: 14 }), "확인"),
              ),
        ),
        h(
          "aside",
          { className: "placement-rules" },
          h("h2", null, "이렇게 정해져요"),
          h("ul", null, h("li", null, "레벨마다 객관식 3문제, 코드는 쓰지 않아요."), h("li", null, "2문제 이상 맞히면 그 레벨은 확인되고 다음 레벨로 올라가요."), h("li", null, "2문제를 틀리면 그 레벨에서 학습을 시작해요."), h("li", null, "모르는 문제는 찍지 말고 '잘 모르겠어요'를 누르면 딱 맞는 레벨을 찾을 수 있어요.")),
        ),
      ),
    ),
  );
}
