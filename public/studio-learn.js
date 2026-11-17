import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Eye,
  ExternalLink,
  Flame,
  Gem,
  Lightbulb,
  Lock,
  Pencil,
  Trophy,
} from "lucide-react";
import { h, Button, icon, badge, Markdown, ProgressBar, levelTitle } from "./studio-ui.js";
import { CodePanel, FilesNote } from "./studio-code.js";
import { CoachPanel } from "./studio-coach.js";

const kindLabel = (problem) => (problem.kind === "practice" ? "연습" : "핵심");

// 문제 목록(왼쪽)입니다. 잠긴 칸은 두 개까지만 보여주고 나머지는 개수로 알려줍니다.
function ProblemNav({ ctx, track, currentId }) {
  const { state } = ctx;
  const path = MODEL.paths[track.number - 1];
  const rows = [];
  let lockedShown = 0;
  let hidden = 0;
  for (const id of path.items) {
    const item = PROBLEM_BY_ID.get(id);
    const node = MODEL.nodeState(state, id);
    if (node.status === "locked") {
      if (lockedShown >= 2) {
        hidden += 1;
        continue;
      }
      lockedShown += 1;
    }
    const tag = node.required ? "필수" : node.skipped ? "건너뜀" : node.status === "open" && item.kind === "practice" ? "선택" : "";
    rows.push(
      h(
        "button",
        {
          key: id,
          className: `nav-item ${node.status}${id === currentId ? " selected" : ""}${node.required ? " required" : ""}`,
          disabled: node.status === "locked",
          "aria-current": id === currentId ? "step" : undefined,
          onClick: () => ctx.openProblem(id),
          title: node.status === "locked" ? "앞 칸을 먼저 끝내야 열려요" : item.title,
        },
        h(
          "span",
          { className: "nav-mark" },
          node.status === "done"
            ? icon(Check, { size: 13 })
            : node.status === "locked"
              ? icon(Lock, { size: 12 })
              : node.status === "current"
                ? icon(ArrowRight, { size: 13 })
                : icon(Pencil, { size: 12 }),
        ),
        h("span", { className: "nav-label" }, item.kind === "practice" ? `연습 · ${item.title}` : item.title),
        tag && h("span", { className: "nav-tag" }, tag),
      ),
    );
  }
  const exam = MODEL.examState(state, track.number);
  return h(
    "nav",
    { className: "problem-nav", "aria-label": "문제 목록" },
    h("h2", null, `${track.name} 문제`),
    h("div", { className: "nav-scroll" }, rows, hidden > 0 && h("div", { className: "nav-more" }, `문제 ${hidden}개 더`)),
    h(
      "button",
      {
        className: `nav-exam ${exam}`,
        disabled: exam === "locked",
        onClick: () => ctx.openExam(track.number),
      },
      icon(exam === "locked" ? Lock : Trophy, { size: 14 }),
      exam === "done" ? "승급 시험 복습하기" : "승급 시험 보기",
    ),
  );
}

// 도움 받는 순서: 힌트 → 파코 코치 → 예시 정답. 힌트는 보석으로 하나씩 열고, 예시 정답은 틀린 뒤 코치와 이야기한 다음에 열려요.
function HelpLadder({ ctx, problem }) {
  const { state } = ctx;
  const status = MODEL.helpStatus(state, problem.id, problem.hints.length);
  const peeked = Boolean(state.peeked[problem.id]);
  const hints = problem.hints.slice(0, status.hintsUsed);

  function openHint() {
    const result = MODEL.openHint(ctx.getState(), problem.id, problem.hints.length);
    if (!result.ok) {
      ctx.toast(result.reason === "no-gems" ? "보석이 부족해요. 문제를 풀어 모아 보세요!" : "더 열 수 있는 힌트가 없어요.");
      return;
    }
    ctx.commit(result.state);
  }
  function showAnswer() {
    const gain = pointsFor(problem) > PcoProgress.PEEK_POINTS ? `이 문제의 점수는 ${PcoProgress.PEEK_POINTS}점이 되고 보석은 받지 못해요. ` : "";
    if (!confirm(`예시 정답을 볼까요? ${gain}보고 나서 직접 다시 써 보세요.`)) return;
    ctx.apply((previous) => MODEL.peekAnswer(previous, problem.id));
  }
  return h(
    "div",
    { className: "help" },
    h("h3", { className: "section-title" }, "도움 받는 순서"),
    h(
      "ol",
      { className: "help-steps" },
      h(
        "li",
        null,
        h("div", { className: "help-title" }, icon(Lightbulb, { size: 14 }), "힌트", h("span", { className: "muted tiny" }, problem.hints.length ? `${status.hintsUsed}/${problem.hints.length}개 봄` : "준비된 힌트 없음")),
        hints.map((text, i) => h("div", { className: "hint-card", key: i }, h("b", null, `힌트 ${i + 1}/${problem.hints.length}`), h(Markdown, { text }))),
        problem.hints.length > status.hintsUsed &&
          h(
            Button,
            { variant: "outline", size: "sm", onClick: openHint },
            icon(Gem, { size: 13 }),
            `다음 힌트 열기 · 보석 ${PcoProgress.HINT_COST}`,
          ),
        problem.hints.length === 0 && h("p", { className: "tiny muted" }, "이 문제에는 준비된 힌트가 없어요. 아래 코치에게 물어보세요."),
      ),
      h(
        "li",
        null,
        h(
          "div",
          { className: "help-title" },
          "파코 코치",
          status.coachSuggested && !status.coachUsed && badge("지금 여기", "now"),
          status.coachUsed && h("span", { className: "muted tiny" }, "질문해 봤어요"),
        ),
        h("p", { className: "tiny muted" }, status.coachSuggested ? "세 번 틀렸어요. 코치에게 작은 힌트를 물어보세요. 정답 대신 질문으로 이끌어 줘요." : "내 코드를 보고 질문으로 이끌어 줘요. 세 번 틀리면 꼭 물어보세요."),
      ),
      h(
        "li",
        null,
        h("div", { className: "help-title" }, icon(Eye, { size: 14 }), "예시 정답"),
        peeked
          ? h(
              React.Fragment,
              null,
              h("pre", { className: "concept-code" }, problem.solution),
              problem.explanation && h(Markdown, { text: problem.explanation }),
            )
          : status.answerUnlocked
            ? h(Button, { variant: "outline", size: "sm", onClick: showAnswer }, "예시 정답 보기")
            : h("p", { className: "tiny muted" }, "세 번 틀린 뒤 코치와 이야기해 보면 열려요."),
      ),
    ),
  );
}

// 문제 설명·입출력·예시입니다. 학습 화면과 승급 시험이 함께 씁니다. 해결 기록(solved)은 호출한 쪽이 넘겨 줍니다.
export function ProblemBody({ problem, track, solved }) {
  const points = pointsFor(problem);
  const exam = problem.kind === "exam";
  return h(
    React.Fragment,
    null,
    h("div", { className: "problem-number" }, `${exam ? "승급 시험" : kindLabel(problem)} · ${track.name}`),
    h("h2", { className: "problem-title" }, problem.title),
    h(
      "div",
      { className: "problem-meta" },
      badge(exam ? "승급 시험" : kindLabel(problem)),
      problem.kind === "core" && badge(problem.level),
      h("span", { className: "tiny muted" }, exam ? `약 ${problem.minutes}분` : `약 ${problem.minutes}분 · ${problem.kind === "practice" ? `+${points}점` : `${points}점`}`),
      solved && badge(solved.clean ? "한 번에 해결" : "해결 완료"),
    ),
    h(Markdown, { text: problem.description, className: "prose" }),
    problem.input && h("div", null, h("h3", { className: "section-title" }, "입력"), h("p", { className: "prose" }, problem.input)),
    problem.output && h("div", null, h("h3", { className: "section-title" }, "출력"), h("p", { className: "prose" }, problem.output)),
    h("h3", { className: "section-title" }, "입출력 예시"),
    problem.tests.slice(0, 2).map((test, i) =>
      h(
        "div",
        { className: "io-card", key: i },
        h("div", { className: "io-head" }, `예제 ${i + 1}`),
        h(
          "div",
          { className: "io-body" },
          h("div", { className: "io-col" }, h("label", null, "입력"), h("pre", null, test.input || "(없음)")),
          h("div", { className: "io-col" }, h("label", null, "출력"), h("pre", null, test.output)),
        ),
        h(FilesNote, { files: test.files }),
      ),
    ),
  );
}

function ProblemPanel({ ctx, problem, track }) {
  const solved = ctx.state.solved[problem.id];
  return h(
    "section",
    { className: "panel problem-panel", "aria-label": "문제 설명" },
    h("div", { className: "panel-head" }, icon(BookOpen), "문제", badge(problem.type)),
    h(
      "div",
      { className: "problem-scroll" },
      h(ProblemBody, { problem, track, solved }),
      problem.link &&
        h(
          "p",
          { className: "tiny muted", style: { marginTop: 12 } },
          "더 해 보고 싶다면(선택): 같은 개념의 ",
          h("a", { href: problem.link.url, target: "_blank", rel: "noopener noreferrer" }, problem.link.label, icon(ExternalLink, { size: 11 })),
        ),
      h(HelpLadder, { ctx, problem }),
      solved &&
        h(
          "div",
          { className: "explain-card" },
          h("h3", { className: "section-title" }, "해설"),
          problem.explanation ? h(Markdown, { text: problem.explanation }) : h("p", { className: "tiny muted" }, "이 문제는 따로 준비된 해설이 없어요."),
          h("pre", { className: "concept-code" }, problem.solution),
        ),
    ),
  );
}

// 통과한 직후의 갈림길입니다: 깔끔하게 풀었으면 연습을 건너뛰거나 한 번 더 할 수 있고, 아니면 연습 한 문제를 풀어야 해요.
function PassCard({ ctx, problem, pass }) {
  const { result } = pass;
  // 서버 기록이 늦게 합쳐지는 등 통과한 뒤에 기록이 바뀌어도 '다음'이 지금 기록을 따르도록 그릴 때마다 계산합니다.
  const fork = MODEL.afterSolve(ctx.state, problem.id);
  const level = MODEL.info[problem.id].level;
  const go = (step) => {
    if (!step || step.kind === "done" || step.kind === "locked") ctx.openRoadmap();
    else if (step.kind === "exam") ctx.openExam(level);
    else ctx.openProblem(step.id);
  };
  const nextLabel = fork.next.kind === "exam" ? "승급 시험 보기" : fork.next.kind === "done" ? "로드맵으로" : fork.kind === "practice" ? "이어서 하기" : "다음 핵심 문제로";
  const offer = fork.offer ? PROBLEM_BY_ID.get(fork.offer) : null;
  const reward = result.firstTime
    ? `모든 테스트 통과 · ${result.points}점 적립${result.gems ? ` · 보석 ${result.gems}개` : ""}${ctx.state.combo >= 2 ? ` · ${ctx.state.combo}연속 정답` : ""}`
    : "이미 푼 문제라 점수와 보석은 그대로예요.";
  const title = !result.firstTime ? "다시 풀었어요" : fork.kind === "practice" ? "연습 완료!" : fork.clean ? "한 번에 통과했어요!" : "통과했어요!";
  const blocked = fork.kind === "core" && fork.required;
  return h(
    "div",
    { className: "pass-card", role: "status" },
    h("div", { className: "pass-head" }, icon(Trophy, { size: 20 }), h("div", null, h("h2", null, title), h("p", null, reward))),
    fork.kind === "core" &&
      h("p", { className: "pass-ask" }, blocked ? "조금 헤맸으니 같은 방법을 연습 문제로 한 번 더 익혀요." : "이 개념은 잘 알고 있네요. 어떻게 할까요?"),
    h(
      "div",
      { className: "pass-actions" },
      blocked
        ? h(
            React.Fragment,
            null,
            h(Button, { onClick: () => go(fork.next) }, "연습 문제 풀기", h("small", null, `${offer?.title ?? ""} (+${PRACTICE_POINTS}점)`)),
            h(Button, { variant: "outline", disabled: true, title: "연습 한 문제를 풀어야 열려요" }, icon(Lock, { size: 14 }), "다음 핵심 문제로"),
          )
        : h(
            React.Fragment,
            null,
            h(Button, { onClick: () => go(fork.next) }, nextLabel, fork.kind === "core" && fork.skippable > 0 && fork.next.kind === "core" && h("small", null, `연습 ${fork.skippable}개는 건너뛰어요`)),
            fork.kind === "core" && offer && h(Button, { variant: "outline", onClick: () => ctx.openProblem(offer.id) }, "비슷한 문제 한 번 더", h("small", null, `연습 · ${offer.title} (+${PRACTICE_POINTS}점)`)),
          ),
    ),
    fork.kind === "core" && h("p", { className: "tiny muted" }, "틀렸거나 힌트를 본 뒤에 통과하면 \"다음 핵심 문제로\"가 잠기고, 연습 한 문제를 풀어야 넘어가요."),
  );
}

export function LearnView({ ctx, problem }) {
  const { state } = ctx;
  const meta = MODEL.info[problem.id];
  const track = TRACKS[meta.level - 1];
  const progress = MODEL.levelProgress(state, track.number);
  const code = state.codes[problem.id] ?? problem.starter;
  const [pass, setPass] = useState(null);
  const [outcome, setOutcome] = useState({ error: "", wrong: false });

  function changeCode(value) {
    ctx.apply((previous) => ({ ...previous, codes: { ...previous.codes, [problem.id]: value } }));
  }
  function resetCode() {
    if (confirm("현재 코드를 지우고 이 문제의 시작 코드로 되돌릴까요? 해결 기록은 유지됩니다.")) {
      changeCode(problem.starter);
      ctx.toast("시작 코드로 되돌렸어요.");
    }
  }
  function onGraded({ passed, results }) {
    if (!passed) {
      const failed = results.find((item) => !item.passed);
      const reason = PcoProgress.explainMismatch(failed.expected, failed.output, failed.error);
      ctx.commit(MODEL.fail(ctx.getState(), problem.id, reason));
      setPass(null);
      setOutcome({ error: failed.error || "", wrong: true });
      if (ctx.getState().tries[problem.id] === 3) ctx.toast("세 번 틀렸어요. 파코 코치에게 작은 힌트를 물어볼까요?");
      return;
    }
    const result = MODEL.solve(ctx.getState(), problem.id, PcoProgress.dayKey(new Date()));
    ctx.commit(result.state);
    setOutcome({ error: "", wrong: false });
    setPass({ result });
    ctx.announce(result);
    if (result.firstTime && result.points > 0) ctx.award(problem, result.points);
  }
  const situation = pass || (state.solved[problem.id] && !outcome.wrong) ? "solved" : outcome.error ? "error" : outcome.wrong ? "wrong" : "start";

  return h(
    "div",
    { className: "learn" },
    h(
      "header",
      { className: "learn-bar" },
      h(Button, { variant: "ghost", size: "sm", onClick: ctx.openRoadmap }, icon(ArrowLeft, { size: 14 }), "로드맵으로"),
      h("strong", { className: "learn-level" }, levelTitle(track)),
      h(ProgressBar, { value: progress.percent, label: `${track.name} 진도 ${progress.percent}퍼센트` }),
      state.combo >= 2 && h("span", { className: "combo" }, icon(Flame, { size: 14 }), `${state.combo}연속 정답`),
    ),
    h(
      "div",
      { className: "learn-grid" },
      h(ProblemNav, { ctx, track, currentId: problem.id }),
      h(ProblemPanel, { ctx, problem, track }),
      h(
        CodePanel,
        {
          problem,
          code,
          onCodeChange: changeCode,
          onResetCode: resetCode,
          runner: ctx.runner,
          onGraded,
          onRan: (result) => setOutcome((previous) => ({ ...previous, error: result.error || "" })),
          storageWarning: ctx.storageWarning,
        },
        pass && h(PassCard, { ctx, problem, pass }),
      ),
      h(CoachPanel, { ctx, problem, track, code, situation, error: outcome.error, locked: "" }),
    ),
  );
}
