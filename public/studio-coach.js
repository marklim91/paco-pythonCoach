import React from "react";
import {
  Sparkles,
  Bot,
  ArrowRight,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Settings2,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { h, Button, icon, badge } from "./studio-ui.js";

// 지금 상황에 맞는 질문 버튼입니다. 눌러도 정답을 달라는 말은 없고, 외부 코치에 붙여넣을 글이 복사됩니다.
const QUESTIONS = {
  start: [
    "이 문제에 필요한 개념이 궁금해",
    "정답 말고, 작은 힌트만 줄래?",
    "내 코드를 함께 살펴봐줄래?",
  ],
  wrong: [
    "내 출력이 기대 출력과 왜 다른지 같이 볼까?",
    "내 코드에서 어느 줄을 봐야 할까?",
    "정답 말고, 작은 힌트만 줄래?",
  ],
  error: [
    "이 오류 메시지가 무슨 뜻이야?",
    "내 코드에서 어느 줄을 봐야 할까?",
    "비슷한 쉬운 예시를 보여 줘",
  ],
  solved: [
    "내 코드를 더 짧게 쓸 수 있을까?",
    "다른 방법도 있는지 궁금해",
    "다음 문제에 필요한 개념 미리 보기",
  ],
};
const SITUATION_TITLE = {
  start: "이렇게 질문해보세요",
  wrong: "지금 상황에 맞는 질문",
  error: "지금 상황에 맞는 질문",
  solved: "통과한 뒤에는 이렇게 물어보세요",
};

export function CoachPanel({ ctx, problem, track, code, situation, error, locked }) {
  const { state, coach } = ctx;
  const failures = state.tries[problem.id] || 0;
  const hintsUsed = state.hintsUsed[problem.id] || 0;
  const scope = `${track.name} 범위 안에서`;

  async function ask(question) {
    const text = buildCoachPrompt({
      question,
      problem,
      levelLabel: `${track.name} ${track.label}`,
      code,
      error,
      failures,
      hintsUsed,
    });
    try {
      await navigator.clipboard.writeText(text);
      ctx.apply((previous) => MODEL.useCoach(previous, problem.id));
      ctx.toast("질문과 코드를 복사했어요. 코치 채팅에 붙여넣어주세요.");
    } catch {
      ctx.toast("복사하지 못했어요. 브라우저의 클립보드 권한을 확인해주세요.");
    }
  }

  const head = h(
    "div",
    { className: "panel-head" },
    icon(Sparkles),
    "파코 코치",
    badge(locked ? "잠김" : "AI PARTNER", "coach-label"),
  );
  if (locked)
    return h(
      "section",
      { className: "panel coach-panel", "aria-label": "코딩 코치" },
      head,
      h(
        "div",
        { className: "coach-body" },
        h(
          "div",
          { className: "coach-greeting" },
          h("div", { className: "coach-avatar locked" }, icon(Lock)),
          h("h3", null, "시험 중에는 코치를 쓸 수 없어요"),
          h("p", null, locked, h("br"), "끝난 뒤에 틀린 문제를 코치와 함께 복습해요."),
        ),
      ),
    );
  if (coach.loaded)
    return h(
      "section",
      { className: "panel coach-panel", "aria-label": "코딩 코치" },
      head,
      h(
        "div",
        { className: "coach-frame-tools" },
        h(
          Button,
          { variant: "ghost", size: "sm", onClick: () => ask(QUESTIONS[situation][1]) },
          icon(Copy, { size: 12 }),
          "문제·코드 복사",
        ),
        h(
          "a",
          {
            href: state.coachUrl,
            target: "_blank",
            rel: "noopener noreferrer",
            title: "연결이 안 되면 새 창에서 열기",
          },
          icon(ExternalLink, { size: 13 }),
        ),
      ),
      h("iframe", {
        className: "coach-frame",
        title: "파코 코딩 코치 대화",
        src: state.coachUrl,
        referrerPolicy: "no-referrer",
        sandbox:
          "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox",
      }),
      h(
        "div",
        { className: "coach-frame-tools" },
        "연결·로그인은 외부 서비스에서 제공해요.",
        h(Button, { variant: "ghost", size: "sm", onClick: () => coach.setLoaded(false) }, "도움말"),
      ),
    );
  return h(
    "section",
    { className: "panel coach-panel", "aria-label": "코딩 코치" },
    head,
    h(
      "div",
      { className: "coach-body" },
      h(
        "div",
        { className: "coach-greeting" },
        h("div", { className: "coach-avatar" }, icon(Bot)),
        h("h3", null, situation === "solved" ? "통과 축하해요!" : "막히는 순간, 함께 생각해요."),
        h(
          "p",
          null,
          scope + " 정답 대신 질문으로 도와줘요.",
          h("br"),
          situation === "solved"
            ? "왜 그렇게 풀었는지 한 문장으로 설명해 볼래요?"
            : "파코와 대화하며 나만의 답을 찾아보세요.",
        ),
      ),
      h("div", { className: "coach-section-label" }, "코치에게 함께 전해지는 것"),
      h(
        "div",
        { className: "chip-row" },
        h("span", { className: "chip" }, `${track.name} · ${problem.title}`),
        h("span", { className: "chip" }, "문제 내용"),
        h("span", { className: "chip" }, "내 코드"),
        error && h("span", { className: "chip" }, "오류 메시지"),
        (failures > 0 || hintsUsed > 0) &&
          h("span", { className: "chip" }, `${failures + 1}번째 시도 · 힌트 ${hintsUsed}개 봄`),
      ),
      h("p", { className: "tiny muted", style: { margin: "4px 0 10px" } }, "이름·학번은 전하지 않아요."),
      h("div", { className: "coach-section-label" }, SITUATION_TITLE[situation]),
      QUESTIONS[situation].map((question) =>
        h(
          "button",
          { className: "prompt-button", key: question, onClick: () => ask(question) },
          question,
          icon(ArrowUpRight),
        ),
      ),
      h(
        "div",
        { className: "coach-bottom" },
        h(
          "div",
          { className: "coach-note" },
          icon(ShieldCheck),
          h(
            "span",
            null,
            "질문 버튼은 문제와 코드를 복사해요. 외부 코치에 자동 전송하지 않으니, 직접 붙여넣어주세요. 이름 등 개인정보는 입력하지 마세요.",
          ),
        ),
        h(Button, { className: "wide", onClick: () => coach.setLoaded(true) }, icon(Bot), "코치 연결하기", icon(ArrowRight)),
        h(
          "div",
          { className: "coach-links" },
          h("span", { className: "tiny muted" }, "외부 iframe · 인터넷 필요"),
          h(Button, { variant: "ghost", size: "sm", onClick: coach.openSettings }, icon(Settings2, { size: 12 }), "연결 설정"),
        ),
      ),
    ),
  );
}
