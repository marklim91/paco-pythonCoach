import React, { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Flame,
  Gem,
  Lock,
  NotebookPen,
  Pencil,
  Rocket,
  Snowflake,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { h, Button, icon, ProgressBar, HOW_LABEL, levelTitle } from "./studio-ui.js";

const REASON_TEXT = { hint: "힌트를 써서 필수였어요", retry: "틀려서 필수였어요" };

function nodeMeta(problem, node, solved, more, reason) {
  const points = pointsFor(problem);
  if (problem.kind === "practice") {
    if (node.status === "done") return REASON_TEXT[reason] || "연습 완료";
    if (node.required) return `필수 · +${points}점`;
    if (node.skipped) return "건너뜀 · 언제든 풀 수 있어요";
    const tail = more > 0 ? ` · 남은 연습 ${more}개` : "";
    return node.status === "locked" ? "한 번에 통과하면 건너뛸 수 있어요" : `선택 · +${points}점${tail}`;
  }
  const base = `${problem.type} · ${problem.level} · ${points}점`;
  if (node.status === "done") {
    const how = solved.clean ? "한 번에 통과" : solved.peek ? "예시 정답을 보고 풀었어요" : solved.hints > 0 ? `힌트 ${solved.hints}개 사용` : "여러 번 도전해 통과";
    return `${base} · ${how}`;
  }
  return node.status === "current" ? `${base} · 약 ${problem.minutes}분` : base;
}

// 길 위의 한 칸입니다. 핵심 문제는 큰 원, 연습 문제는 작은 원이고 옆으로 살짝 흔들리며 이어집니다.
function RoadNode({ ctx, entry, index }) {
  const problem = PROBLEM_BY_ID.get(entry.id);
  const node = MODEL.nodeState(ctx.state, entry.id);
  const solved = ctx.state.solved[entry.id];
  const core = problem.kind === "core";
  const reason = MODEL.requiredReason(ctx.state, entry.id);
  const label = core ? problem.title : `연습 · ${problem.title}`;
  const action = node.status === "done" ? "다시 풀기" : node.status === "locked" ? "잠김" : "풀기";
  return h(
    "div",
    { className: "road-row", style: { "--x": `${Math.round(Math.sin(index * 0.9) * 64)}px` } },
    h(
      "button",
      {
        className: `road-node ${core ? "core" : "practice"} ${node.status}${node.required ? " required" : ""}${node.skipped ? " skipped" : ""}`,
        "aria-label": `${label} ${action}`,
        onClick: () => (node.status === "locked" ? ctx.toast("앞 칸을 먼저 끝내야 열려요.") : ctx.openProblem(entry.id)),
      },
      node.status === "done"
        ? icon(Check, { size: core ? 26 : 18 })
        : node.status === "locked"
          ? icon(Lock, { size: core ? 22 : 16 })
          : core
            ? icon(Star, { size: 24 })
            : icon(Pencil, { size: 16 }),
    ),
    h(
      "div",
      { className: "road-label" },
      node.status === "current" && !node.required && h("span", { className: "now" }, "지금 여기"),
      node.required && h("span", { className: "now" }, "먼저 풀어요"),
      h("div", { className: "road-title" }, label),
      h("div", { className: "road-meta" }, nodeMeta(problem, node, solved, entry.more, reason)),
    ),
  );
}

function ExamGate({ ctx, track }) {
  const state = MODEL.examState(ctx.state, track.number);
  const next = TRACKS[track.number];
  return h(
    "div",
    { className: "road-row gate", style: { "--x": "0px" } },
    h(
      "button",
      {
        className: `road-node core gate ${state}`,
        "aria-label": `${track.name} 승급 시험`,
        disabled: state === "locked",
        onClick: () => ctx.openExam(track.number),
      },
      icon(state === "locked" ? Lock : Trophy, { size: 26 }),
    ),
    h(
      "div",
      { className: "road-label" },
      state === "current" && h("span", { className: "now" }, "승급 시험!"),
      h("div", { className: "road-title" }, `${track.name} 승급 시험`),
      h(
        "div",
        { className: "road-meta" },
        state === "done"
          ? "통과했어요 · 언제든 복습할 수 있어요"
          : `코딩 ${track.exam.length}문제 · 힌트 없음 · 모두 통과하면 ${next ? `다음 레벨(${next.name})이 열려요` : "모든 과정을 마쳐요"}`,
      ),
    ),
  );
}

// 지금 풀고 있는 레벨의 길입니다. 아직 닿지 못한 칸은 잠긴 칸 두 개까지만 보여주고 나머지는 개수로 알려줍니다.
function LevelPath({ ctx, track, all = false }) {
  const entries = MODEL.pathEntries(ctx.state, track.number);
  const shown = [];
  let locked = 0;
  for (const entry of entries) {
    const status = MODEL.nodeState(ctx.state, entry.id).status;
    if (status === "locked" && !all) {
      if (locked >= 2) break;
      locked += 1;
    }
    shown.push(entry);
  }
  const hiddenCores = entries
    .slice(shown.length)
    .filter((entry) => PROBLEM_BY_ID.get(entry.id).kind === "core").length;
  return h(
    "div",
    { className: "road" },
    shown.map((entry, index) => h(RoadNode, { key: entry.id, ctx, entry, index })),
    hiddenCores > 0 && h("p", { className: "road-more" }, `핵심 문제 ${hiddenCores}개와 연습 칸이 이어져요`),
    h(ExamGate, { ctx, track }),
  );
}

function LevelHero({ ctx, track }) {
  const progress = MODEL.levelProgress(ctx.state, track.number);
  const step = MODEL.nextStep(ctx.state, track.number);
  const exam = MODEL.examState(ctx.state, track.number);
  const resume = () => (step.kind === "exam" ? ctx.openExam(track.number) : ctx.openProblem(step.id));
  return h(
    "section",
    { className: "level-hero", "aria-label": `${track.name} 진행 상황` },
    h("div", null, h("span", { className: "pill" }, `${track.name} · 진행 중`), h("h1", null, track.label)),
    h("p", null, `${track.topics} — 핵심 ${progress.coresDone}/${progress.coresTotal}${progress.slotsTotal ? ` · 연습 ${progress.slotsDone}/${progress.slotsTotal}` : ""}`),
    h(ProgressBar, { value: progress.percent, label: `${track.name} 진도 ${progress.percent}퍼센트`, className: "on-dark" }),
    h(
      "div",
      { className: "hero-actions" },
      h(Button, { className: "hero-cta", onClick: resume }, step.kind === "exam" ? "승급 시험 보기" : "이어서 하기"),
      exam !== "current" &&
        h(Button, { className: "hero-skip", onClick: () => ctx.openExam(track.number) }, icon(Trophy, { size: 16 }), "승급 시험으로 건너뛰기"),
    ),
  );
}

function PassedCard({ ctx, track, open, onToggle }) {
  const how = ctx.state.passed[track.number];
  return h(
    "section",
    { className: "level-card passed" },
    h(
      "div",
      { className: "level-card-head" },
      h("span", { className: "level-mark ok" }, icon(Check, { size: 18 })),
      h("div", { className: "grow" }, h("div", { className: "eyebrow" }, `${track.name} · ${HOW_LABEL[how]}`), h("h2", null, track.label)),
      h(Button, { variant: "outline", size: "sm", onClick: onToggle }, open ? "접기" : "복습하기", icon(open ? ChevronUp : ChevronDown, { size: 14 })),
    ),
    open && h(LevelPath, { ctx, track, all: true }),
  );
}

function LockedCard({ ctx, track }) {
  return h(
    "section",
    { className: "level-card locked" },
    h(
      "div",
      { className: "level-card-head" },
      h("span", { className: "level-mark" }, icon(Lock, { size: 18 })),
      h("div", { className: "grow" }, h("div", { className: "eyebrow" }, `${track.name} · 잠김`), h("h2", null, track.label), h("p", null, track.topics)),
      h(Button, { variant: "outline", size: "sm", onClick: () => ctx.openPlacement(track.number) }, icon(Zap, { size: 14 }), "여기로 점프"),
    ),
  );
}

function FirstRun({ ctx }) {
  return h(
    "section",
    { className: "first-run" },
    h("div", null, h("h2", null, "어디서 시작할까요?"), h("p", null, "처음이라면 Lv.1부터 한 걸음씩, 조금 알고 있다면 객관식 진단평가로 내 레벨을 찾아요.")),
    h(
      "div",
      { className: "hero-actions" },
      h(Button, { variant: "outline", onClick: () => ctx.apply((previous) => ({ ...previous, placementDone: true })) }, icon(Rocket, { size: 16 }), "처음부터 차근차근"),
      h(Button, { onClick: () => ctx.openPlacement() }, icon(Compass, { size: 16 }), "진단평가로 시작"),
    ),
  );
}

function SidePanels({ ctx }) {
  const { state } = ctx;
  const today = PcoProgress.dayKey(new Date());
  const earned = state.daily[today] || 0;
  const goal = Math.min(100, Math.round((Math.min(earned, PcoProgress.DAILY_GOAL) / PcoProgress.DAILY_GOAL) * 100));
  const mistakes = Object.entries(state.mistakes);
  const open = mistakes.filter(([, note]) => !note.resolved);
  const cur = MODEL.currentLevel(state);
  const buyFreeze = () => {
    const result = MODEL.buyFreeze(ctx.getState());
    if (!result.ok) return ctx.toast("보석이 부족해요.");
    ctx.commit(result.state);
    ctx.toast("연속 학습 보호를 얻었어요. 하루 쉬어도 기록이 이어져요.");
  };
  return h(
    "aside",
    { className: "road-side", id: "side", "aria-label": "나의 진도" },
    h(
      "section",
      { className: "side-card" },
      h("h2", null, "오늘의 학습"),
      h("div", { className: "side-row" }, h("span", null, "오늘 목표"), h("b", null, `${Math.min(earned, PcoProgress.DAILY_GOAL)} / ${PcoProgress.DAILY_GOAL}점`)),
      h(ProgressBar, { value: goal, label: `오늘 목표 ${goal}퍼센트` }),
      h(
        "div",
        { className: "stat-grid" },
        h("div", null, h("b", null, `${PcoProgress.liveStreak(state, today)}일`), h("span", null, "연속 학습")),
        h("div", null, h("b", null, `${state.combo}연속`), h("span", null, "정답 콤보")),
        h("div", null, h("b", null, `${state.gems}개`), h("span", null, "보석")),
      ),
    ),
    h(
      "section",
      { className: "side-card" },
      h("h2", null, "부스터"),
      h("p", { className: "tiny muted" }, "보석으로 사요. 포인트는 줄어들지 않아요."),
      h(
        "div",
        { className: "shop" },
        h(
          "div",
          { className: "shop-item" },
          h("div", null, h("b", null, "연속 학습 보호", state.freeze > 0 && ` (보유 ${state.freeze})`), h("span", null, "하루 쉬어도 기록 유지")),
          h(Button, { variant: "outline", size: "sm", onClick: buyFreeze }, icon(Gem, { size: 13 }), `보석 ${PcoProgress.FREEZE_COST}`),
        ),
        h(
          "div",
          { className: "shop-item" },
          h("div", null, h("b", null, "힌트 한 번 더"), h("span", null, "문제 안에서 약한 힌트부터 하나씩")),
          h("span", { className: "price" }, icon(Gem, { size: 13 }), `보석 ${PcoProgress.HINT_COST}`),
        ),
      ),
    ),
    h(
      "section",
      { className: "side-card" },
      h("h2", null, icon(NotebookPen, { size: 16 }), `실수 노트${open.length ? ` ${open.length}` : ""}`),
      h("p", { className: "tiny muted" }, "다시 맞히면 사라져요."),
      mistakes.length === 0
        ? h("p", { className: "tiny muted" }, "틀린 문제가 여기에 모여요.")
        : h(
            "div",
            { className: "mistakes" },
            mistakes.slice(-8).reverse().map(([id, note]) =>
              h(
                "button",
                { key: id, className: "mistake", onClick: () => (MODEL.nodeState(state, id).status === "locked" ? ctx.toast("앞 칸을 먼저 끝내야 열려요.") : ctx.openProblem(id)) },
                `${PROBLEM_BY_ID.get(id).title} · ${note.resolved ? "코치와 해결" : note.reason || "다시 풀어보기"}`,
              ),
            ),
          ),
    ),
    cur < MODEL.levelCount &&
      h(
        "section",
        { className: "side-card" },
        h("h2", null, "조금 알고 있나요?"),
        h("p", { className: "tiny muted" }, "객관식 진단평가로 내 레벨을 찾으면 앞 레벨을 건너뛸 수 있어요."),
        h(Button, { variant: "outline", size: "sm", onClick: () => ctx.openPlacement() }, icon(Compass, { size: 14 }), "진단평가 보기"),
      ),
  );
}

export function RoadmapView({ ctx }) {
  const { state } = ctx;
  const cur = MODEL.currentLevel(state);
  const [expanded, setExpanded] = useState({});
  const firstRun = !state.placementDone && Object.keys(state.solved).length === 0 && Object.keys(state.passed).length === 0;
  return h(
    "div",
    { className: "roadmap" },
    h(
      "main",
      { className: "road-main", id: "road" },
      firstRun && h(FirstRun, { ctx }),
      TRACKS.map((track) => {
        const level = track.number;
        if (MODEL.isPassed(state, level))
          return h(PassedCard, { key: track.id, ctx, track, open: Boolean(expanded[level]), onToggle: () => setExpanded({ ...expanded, [level]: !expanded[level] }) });
        if (level === cur)
          return h("div", { key: track.id }, h(LevelHero, { ctx, track }), h(LevelPath, { ctx, track }));
        return h(LockedCard, { key: track.id, ctx, track });
      }),
      cur > MODEL.levelCount &&
        h("section", { className: "first-run" }, h("div", null, h("h2", null, "모든 레벨을 통과했어요!"), h("p", null, `${levelTitle(TRACKS[MODEL.levelCount - 1])}까지 마쳤어요. 막힌 문제는 언제든 복습할 수 있어요.`))),
    ),
    h(SidePanels, { ctx }),
  );
}
