import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import { cva } from "class-variance-authority";
import {
  BookOpen,
  Code2,
  Bot,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowRight,
  Play,
  Send,
  RotateCcw,
  Check,
  CheckCircle2,
  Circle,
  Map,
  Lightbulb,
  Terminal,
  X,
  Settings2,
  ShieldCheck,
  Copy,
  Sparkles,
  ExternalLink,
  GraduationCap,
  ListChecks,
  LoaderCircle,
  Square,
  PanelLeft,
  Clock3,
  HelpCircle,
  LogOut,
} from "lucide-react";

const h = React.createElement;
// shadcn/ui's open-code Button, Tabs and Dialog composition, adapted to inline CSS without a build step.
const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: "btn-primary",
      outline: "btn-outline",
      ghost: "btn-ghost",
    },
    size: { default: "", sm: "btn-small", icon: "btn-icon" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
const Button = React.forwardRef(
  ({ className = "", variant, size, ...props }, ref) =>
    h("button", {
      type: "button",
      ref,
      className: buttonVariants({ variant, size, className }),
      ...props,
    }),
);
const icon = (Icon, props = {}) =>
  h(Icon, { size: 18, "aria-hidden": true, ...props });
const tab = (value, label) =>
  h(Tabs.Trigger, { className: "tab-trigger", value, key: value }, label);
const content = (value, ...children) =>
  h(Tabs.Content, { className: "tab-content", value }, ...children);
const badge = (text, className = "") =>
  h("span", { className: "badge " + className }, text);
function Modal({ open, onOpenChange, title, description, children }) {
  return h(
    Dialog.Root,
    { open, onOpenChange },
    h(
      Dialog.Portal,
      null,
      h(Dialog.Overlay, { className: "dialog-overlay" }),
      h(
        Dialog.Content,
        { className: "dialog-content" },
        h(Dialog.Title, { className: "dialog-title" }, title),
        h(
          Dialog.Description,
          { className: "dialog-description" },
          description,
        ),
        h(
          Dialog.Close,
          { asChild: true },
          h(
            Button,
            {
              variant: "ghost",
              size: "icon",
              className: "dialog-close",
              "aria-label": "닫기",
            },
            icon(X),
          ),
        ),
        children,
      ),
    ),
  );
}
const SITE_LINKS = [
  { label: "파코 스튜디오", href: "./new.html" },
  { label: "내 학습", href: "./my-learning.html" },
  { label: "대시보드", href: "./dashboard.html" },
];
function SiteNav({ className, label }) {
  return h(
    "nav",
    { className, "aria-label": label },
    SITE_LINKS.map((link) =>
      h(
        "a",
        {
          key: link.href,
          href: link.href,
          "aria-current": link.href === "./new.html" ? "page" : undefined,
        },
        link.label,
      ),
    ),
  );
}
function ThemeToggle() {
  useEffect(() => {
    if (window.PcoTheme) window.PcoTheme.sync();
  }, []);
  return h(
    "button",
    {
      type: "button",
      className: "pco-theme-toggle",
      role: "switch",
      "aria-checked": "false",
      "data-pco-theme-toggle": "",
    },
    h("span", { className: "pco-theme-label" }, "다크 모드"),
    h("span", { className: "pco-theme-track", "aria-hidden": "true" }),
  );
}
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error("[paco-studio]", error);
  }
  render() {
    if (this.state.error)
      return h(
        "div",
        { className: "loading", role: "alert" },
        h(
          "div",
          null,
          h("strong", null, "화면을 표시하지 못했어요."),
          h("p", null, this.state.error.message),
          h("a", { href: "./new.html" }, "새로고침하기"),
        ),
      );
    return this.props.children;
  }
}
function App() {
  const [initial] = useState(() => {
    try {
      return readStudioState(localStorage);
    } catch (error) {
      return {
        state: {
          selected: "hello",
          codes: {},
          completed: [],
          coachUrl: DEFAULT_COACH_URL,
          pointsUrl: "",
          awarded: [],
        },
        warning:
          "브라우저 저장소에 접근할 수 없어 임시 모드로 시작했어요. " +
          error.message,
      };
    }
  });
  const [state, setState] = useState(() => ({
    ...initial.state,
    selected: initialProblemId(initial.state.selected, window.location.search),
  }));
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const storageDisabled = useRef(Boolean(initial.warning));
  const awarding = useRef(new Set());
  // 로그인한 학생의 학교·이름을 상단에 표시합니다. 확인할 수 없으면 기본 아바타만 보여줍니다.
  const [learner, setLearner] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() {
    setLoggingOut(true);
    await endSession({
      fetchImpl: fetch,
      setCookie: (value) => {
        document.cookie = value;
      },
      cookiePath: new URL(".", window.location.href).pathname,
    });
    window.location.replace(
      new URL("login.html?reverify=1", window.location.href).href,
    );
  }
  useEffect(() => {
    let active = true;
    loadStudent(fetch, document.cookie)
      .then((student) => active && setLearner(student))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [roadmap, setRoadmap] = useState(false);
  const [settings, setSettings] = useState(false);
  const [coachDraft, setCoachDraft] = useState(state.coachUrl);
  const [pointsDraft, setPointsDraft] = useState(state.pointsUrl);
  const [configError, setConfigError] = useState("");
  const [coachLoaded, setCoachLoaded] = useState(false);
  const [problemTab, setProblemTab] = useState("problem");
  const [runnerTab, setRunnerTab] = useState("input");
  const [stdin, setStdin] = useState("");
  const [runResult, setRunResult] = useState(null);
  const [grade, setGrade] = useState(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [elapsed, setElapsed] = useState(null);
  const job = useRef(null);
  const switchRequest = useRef(0);
  const editorRef = useRef(null);
  const problem = PROBLEMS.find((p) => p.id === state.selected);
  const track = TRACKS.find((t) => t.id === problem.trackId);
  const trackIndex = track.problems.findIndex((p) => p.id === problem.id);
  const problemIndex = PROBLEMS.findIndex((p) => p.id === problem.id);
  const code = state.codes[problem.id] ?? problem.starter;
  const solved = state.completed.includes(problem.id);
  const trackCompleted = track.problems.filter((p) =>
    state.completed.includes(p.id),
  ).length;

  useEffect(() => {
    if (storageDisabled.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      storageDisabled.current = true;
      setStorageWarning(
        "브라우저에 저장하지 못했어요. 현재 작업은 유지되지만 새로고침하면 사라질 수 있어요. " +
          error.message,
      );
    }
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(
    () => () => {
      if (job.current) {
        job.current.worker.terminate();
        clearTimeout(job.current.timer);
      }
    },
    [],
  );
  useEffect(() => {
    setStdin(problem.tests[0].input);
  }, [problem.id]);

  function stopJob(message) {
    if (job.current) {
      job.current.worker.terminate();
      clearTimeout(job.current.timer);
      job.current = null;
    }
    setBusy("");
    if (message) {
      setRunResult({ output: "", error: message });
      setGrade(null);
      setRunnerTab("output");
    }
  }
  // 아직 불러오지 않은 문제는 본문을 받은 뒤에 바꿉니다. 그 사이 다른 문제를 누르면 마지막 선택만 적용합니다.
  async function selectProblem(id) {
    const request = ++switchRequest.current;
    if (id === problem.id) {
      setRoadmap(false);
      return;
    }
    const target = PROBLEMS.find((p) => p.id === id);
    if (!target) return;
    if (!target.tests) {
      setToast("문제를 불러오는 중이에요…");
      try {
        await loadProblem(id);
      } catch (error) {
        if (request === switchRequest.current)
          setToast(
            "문제를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러주세요.",
          );
        return;
      }
      if (request !== switchRequest.current) return;
      setToast("");
    }
    stopJob();
    setState((previous) => ({ ...previous, selected: id }));
    setRunResult(null);
    setGrade(null);
    setElapsed(null);
    setProblemTab("problem");
    setRunnerTab("input");
    setRoadmap(false);
    setScrollTop(0);
    if (editorRef.current) editorRef.current.scrollTop = 0;
  }
  function changeCode(value) {
    setState((previous) => ({
      ...previous,
      codes: { ...previous.codes, [problem.id]: value },
    }));
  }
  function execute(mode) {
    if (job.current) return;
    setBusy("Python 준비 중…");
    setGrade(null);
    setRunResult(null);
    setElapsed(null);
    setRunnerTab(mode === "grade" ? "tests" : "output");
    const cases = mode === "grade" ? problem.tests : [{ input: stdin }];
    const results = [];
    let current = 0;
    let started;
    let worker;
    let workerUrl;
    try {
      workerUrl = URL.createObjectURL(
        new Blob([document.getElementById("worker-source").textContent], {
          type: "text/javascript",
        }),
      );
      worker = new Worker(workerUrl, { type: "module" });
    } catch (error) {
      setBusy("");
      setRunResult({
        output: "",
        error: "Python 실행기를 만들지 못했어요: " + error.message,
      });
      setRunnerTab("output");
      return;
    } finally {
      if (workerUrl) URL.revokeObjectURL(workerUrl);
    }
    const active = { worker, timer: null };
    job.current = active;
    function armTimeout(ms, message) {
      clearTimeout(active.timer);
      active.timer = setTimeout(() => stopJob(message), ms);
    }
    function sendCase() {
      setBusy(
        mode === "grade"
          ? `채점 중 ${current + 1}/${cases.length}`
          : "실행 중…",
      );
      armTimeout(
        5000,
        "실행 제한 시간(5초)을 초과했어요. 무한 반복이 있는지 확인해주세요.",
      );
      worker.postMessage({ code, input: cases[current].input });
    }
    armTimeout(
      90000,
      "Python을 90초 안에 불러오지 못했어요. 인터넷 연결을 확인한 후 다시 시도해주세요.",
    );
    worker.onerror = (event) => {
      event.preventDefault();
      if (job.current !== active) return;
      stopJob(
        "Python 실행기 오류: " +
          (event.message ||
            "실행기를 불러올 수 없습니다. CDN 접근을 확인해주세요."),
      );
    };
    worker.onmessage = ({ data }) => {
      if (job.current !== active) return;
      if (data.type === "fatal") {
        stopJob(data.error);
        return;
      }
      if (data.type === "ready") {
        started = performance.now();
        sendCase();
        return;
      }
      if (data.type !== "result") return;
      const result = {
        ...data,
        input: cases[current].input,
        expected: cases[current].output,
      };
      result.passed =
        !result.error &&
        normalizeOutput(result.output) ===
          normalizeOutput(result.expected ?? "");
      results.push(result);
      current += 1;
      if (mode === "grade")
        setGrade({
          results: [...results],
          total: cases.length,
          finished: false,
        });
      if (current < cases.length) {
        sendCase();
        return;
      }
      setElapsed(Math.round(performance.now() - started));
      stopJob();
      if (mode === "run") setRunResult(result);
      else {
        const passed = results.every((item) => item.passed);
        setGrade({
          results,
          total: cases.length,
          finished: true,
          passed,
        });
        if (passed) {
          setState((previous) => ({
            ...previous,
            completed: [...new Set([...previous.completed, problem.id])],
          }));
          setToast("해결 완료! 한 걸음 더 성장했어요.");
          awardPoints(problem);
        }
      }
    };
  }
  // 제출 통과 시 브라우저가 Power Automate 흐름을 직접 호출합니다. 학생·문제당 한 번만 적립하며 기록은 이 브라우저에만 남습니다.
  async function awardPoints(solvedProblem) {
    const url = state.pointsUrl || DEFAULT_POINTS_URL;
    const points = pointsFor(solvedProblem);
    if (!url || !points) {
      if (!url)
        setToast(
          "해결 완료! 포인트 적립 주소가 설정되지 않았어요. 설정(톱니바퀴)에서 입력해주세요.",
        );
      return;
    }
    let key;
    try {
      const student = await loadStudent(fetch, document.cookie);
      key = awardKey(student, solvedProblem.id);
      if (state.awarded.includes(key) || awarding.current.has(key)) {
        setToast("이미 포인트를 받은 문제예요.");
        return;
      }
      awarding.current.add(key);
      const result = await requestPoints({
        url,
        student,
        problemId: solvedProblem.id,
        points,
        fetchImpl: fetch,
      });
      setState((previous) => ({
        ...previous,
        awarded: [...new Set([...previous.awarded, key])],
      }));
      setToast(
        result.awarded
          ? `해결 완료! +${points}점이 적립됐어요. (누적 ${result.points}점)`
          : `이미 포인트를 받은 문제예요. (누적 ${result.points}점)`,
      );
    } catch (error) {
      const network =
        error instanceof TypeError ||
        error.name === "TimeoutError" ||
        error.name === "AbortError";
      setToast(
        "해결은 저장했지만 포인트를 확인하지 못했어요. " +
          (network
            ? "네트워크 연결이나 흐름 상태를 확인해주세요. 적립됐을 수 있으니 같은 문제를 반복 제출하지 마세요."
            : error.message),
      );
    } finally {
      if (key) awarding.current.delete(key);
    }
  }
  async function copyPrompt(kind) {
    const question =
      kind === "concept"
        ? "이 문제에 필요한 개념을 쉬운 예시로 설명해주세요."
        : kind === "hint"
          ? "정답 코드를 바로 알려주지 말고, 다음 단계의 힌트만 주세요."
          : "제 코드에서 개선할 점을 찾아주세요. 제가 스스로 고칠 수 있도록 질문해주세요.";
    const text = `[${problem.title}]\n${problem.description.join("\n")}\n입력: ${problem.input}\n출력: ${problem.output}\n\n${question}\n\n현재 코드:\n\`\`\`python\n${code}\`\`\``;
    try {
      await navigator.clipboard.writeText(text);
      setToast("질문과 코드를 복사했어요. 코치 채팅에 붙여넣어주세요.");
    } catch (error) {
      setToast(
        "복사하지 못했어요. 브라우저의 클립보드 권한을 확인해주세요.",
      );
    }
  }
  function saveCoach() {
    try {
      const url = validateCoachUrl(coachDraft);
      const pointsUrl = pointsDraft.trim()
        ? validatePointsUrl(pointsDraft)
        : "";
      setState((previous) => ({ ...previous, coachUrl: url, pointsUrl }));
      setCoachLoaded(false);
      setSettings(false);
      setConfigError("");
      setToast("설정을 저장했어요. 코치는 연결 버튼으로 열어주세요.");
    } catch (error) {
      setConfigError(error.message);
    }
  }
  function openSettings() {
    setCoachDraft(state.coachUrl);
    setPointsDraft(state.pointsUrl);
    setConfigError("");
    setSettings(true);
  }
  function resetCode() {
    if (
      confirm(
        "현재 코드를 지우고 이 문제의 시작 코드로 되돌릴까요? 해결 기록은 유지됩니다.",
      )
    ) {
      changeCode(problem.starter);
      setToast("시작 코드로 되돌렸어요.");
    }
  }
  function onEditorKey(event) {
    if (event.key === "Tab") {
      event.preventDefault();
      const node = event.currentTarget;
      const start = node.selectionStart,
        end = node.selectionEnd;
      changeCode(code.slice(0, start) + "    " + code.slice(end));
      requestAnimationFrame(() => {
        node.selectionStart = node.selectionEnd = start + 4;
      });
    } else if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      execute(event.shiftKey ? "grade" : "run");
    }
  }
  const promptButton = (Icon, text, kind) =>
    h(
      "button",
      { className: "prompt-button", onClick: () => copyPrompt(kind) },
      icon(Icon),
      text,
      icon(ArrowUpRight),
    );

  return h(
    "div",
    { className: "shell" },
    h(
      "aside",
      { className: "rail", "aria-label": "주요 메뉴" },
      h("div", { className: "brand-icon", title: "파코 스튜디오" }, "p"),
      h(
        "nav",
        { className: "rail-nav" },
        h(
          "button",
          {
            className: "rail-button active",
            onClick: () => {
              setRoadmap(false);
              editorRef.current?.focus();
            },
            "aria-label": "코딩 학습",
          },
          icon(Code2),
          "학습하기",
        ),
        h(
          "button",
          { className: "rail-button", onClick: () => setRoadmap(true) },
          icon(Map),
          "로드맵",
        ),
        h(
          "button",
          { className: "rail-button", onClick: () => setRoadmap(true) },
          icon(GraduationCap),
          "나의 진도",
        ),
      ),
      h(
        "div",
        { className: "rail-bottom" },
        h(
          Button,
          {
            size: "icon",
            variant: "ghost",
            onClick: openSettings,
            "aria-label": "코치 설정",
          },
          icon(Settings2),
        ),
      ),
    ),
    h(
      "main",
      { className: "main" },
      h(
        "header",
        { className: "topbar" },
        h(
          "a",
          {
            className: "wordmark",
            href: "./new.html",
            title: "파코 스튜디오",
            style: { textDecoration: "none" },
          },
          "파코",
          h("span", null, "CODE STUDIO"),
        ),
        h(
          "div",
          { className: "top-right" },
          h(
            "span",
            null,
            h("i", { className: "local-dot" }),
            "나만의 속도로, 한 걸음씩",
          ),
          h(SiteNav, { className: "site-nav", label: "주요 페이지" }),
          h(
            Button,
            {
              variant: "ghost",
              size: "sm",
              onClick: () => setRoadmap(true),
            },
            icon(BookOpen),
            "학습 둘러보기",
          ),
          h(ThemeToggle),
          h("span", { className: "divider" }),
          learner
            ? h(
                "div",
                {
                  className: "student-chip",
                  title: `${learner.school} · ${learner.studentName} 학생`,
                },
                h(
                  "div",
                  { className: "avatar", "aria-hidden": "true" },
                  learner.studentName.slice(0, 1),
                ),
                h(
                  "div",
                  { className: "student-meta" },
                  h("small", null, learner.school),
                  h("strong", null, `${learner.studentName} 학생`),
                ),
                h(
                  Button,
                  {
                    variant: "ghost",
                    size: "sm",
                    onClick: logout,
                    disabled: loggingOut,
                    title: "로그아웃",
                  },
                  icon(LogOut, { size: 14 }),
                  h("span", { className: "logout-label" }, "로그아웃"),
                ),
              )
            : h(
                "div",
                { className: "avatar", title: "로그인한 학생 정보 없음" },
                "나",
              ),
        ),
      ),
      h(
        "div",
        { className: "workspace" },
        h(
          "div",
          { className: "breadcrumb" },
          icon(BookOpen),
          "학습 공간",
          icon(ChevronRight),
          track.name,
          icon(ChevronRight),
          h("strong", null, track.label),
        ),
        h(
          "div",
          { className: "heading" },
          h(
            "div",
            null,
            h("div", { className: "eyebrow" }, "YOUR CODING JOURNEY"),
            h("h1", null, track.label),
            h("p", null, track.description),
          ),
          h(
            "div",
            { className: "heading-actions" },
            h(
              "div",
              { className: "progress-pill" },
              icon(CheckCircle2, { size: 14, color: "#19705b" }),
              h(
                "span",
                null,
                "트랙 진도 ",
                h(
                  "b",
                  null,
                  `${trackCompleted} / ${track.problems.length}`,
                ),
              ),
              h(
                "div",
                {
                  className: "progress-track",
                  role: "progressbar",
                  "aria-label": "현재 트랙 진도",
                  "aria-valuenow": trackCompleted,
                  "aria-valuemin": 0,
                  "aria-valuemax": track.problems.length,
                },
                h("div", {
                  className: "progress-fill",
                  style: {
                    width: `${(trackCompleted / track.problems.length) * 100}%`,
                  },
                }),
              ),
            ),
            h(
              Button,
              { variant: "outline", onClick: () => setRoadmap(true) },
              icon(PanelLeft),
              "문제 목록",
            ),
          ),
        ),
        storageWarning &&
          h("div", { className: "alert", role: "alert" }, storageWarning),
        h(
          "section",
          { className: "lesson-bar", "aria-label": "트랙 및 문제 선택" },
          h(
            "select",
            {
              className: "track-select",
              value: track.id,
              "aria-label": "학습 트랙",
              onChange: (event) =>
                selectProblem(
                  TRACKS.find((t) => t.id === event.target.value)
                    .problems[0].id,
                ),
            },
            TRACKS.map((t) =>
              h(
                "option",
                { key: t.id, value: t.id },
                `${t.name} · ${t.label}`,
              ),
            ),
          ),
          h(
            "div",
            { className: "step-list" },
            track.problems.map((p, index) =>
              h(
                React.Fragment,
                { key: p.id },
                index > 0 && h("span", { className: "step-link" }),
                h(
                  "button",
                  {
                    className:
                      "step" + (p.id === problem.id ? " current" : ""),
                    onClick: () => selectProblem(p.id),
                    title: `${p.title} · ${p.level}`,
                    "aria-label": `${index + 1}번 ${p.title} (${p.level})${state.completed.includes(p.id) ? " · 해결 완료" : ""}`,
                    "aria-current":
                      p.id === problem.id ? "step" : undefined,
                  },
                  h(
                    "span",
                    {
                      className:
                        "step-number" +
                        (state.completed.includes(p.id) ? " done" : ""),
                    },
                    state.completed.includes(p.id)
                      ? icon(Check)
                      : String(index + 1).padStart(2, "0"),
                  ),
                  h("span", { className: "step-label" }, p.topic),
                ),
              ),
            ),
          ),
          h(
            Button,
            {
              variant: "ghost",
              size: "sm",
              onClick: () => setRoadmap(true),
            },
            "전체 보기",
            icon(ChevronRight),
          ),
        ),
        h(
          "p",
          { className: "mobile-note" },
          "작은 화면에서는 문제 → 코드 → 코치 순서로 학습할 수 있어요.",
        ),
        h(
          "div",
          { className: "panels" },
          h(
            "section",
            {
              className: "panel problem-panel",
              "aria-label": "문제 설명",
            },
            h(
              "div",
              { className: "panel-head" },
              icon(BookOpen),
              "문제",
              badge("SAMPLE"),
            ),
            h(
              Tabs.Root,
              {
                className: "tabs",
                value: problemTab,
                onValueChange: setProblemTab,
              },
              h(
                Tabs.List,
                { className: "tab-list", "aria-label": "문제 정보" },
                tab("problem", "문제 설명"),
                tab("concept", "개념 배우기"),
                tab("hints", "힌트 & 해설"),
              ),
              content(
                "problem",
                h(
                  "div",
                  { className: "problem-number" },
                  `PROBLEM ${String(problemIndex + 1).padStart(2, "0")}`,
                ),
                h("h2", { className: "problem-title" }, problem.title),
                h(
                  "div",
                  { className: "problem-meta" },
                  badge(problem.level),
                  h("span", { className: "tag" }, problem.topic),
                  h(
                    "span",
                    { className: "tiny muted" },
                    `약 ${problem.minutes}분 · ${pointsFor(problem)}점`,
                  ),
                  solved && badge("해결 완료"),
                ),
                h(
                  "div",
                  { className: "prose" },
                  problem.description.map((text, i) =>
                    h("p", { key: i }, text),
                  ),
                ),
                h(
                  "div",
                  { className: "concept-callout" },
                  icon(Lightbulb),
                  h(
                    "span",
                    null,
                    problem.id === "hello"
                      ? "처음이라도 괜찮아요! 오른쪽에 코드를 적고 실행 버튼을 눌러보세요."
                      : `${problem.topic} 개념이 낯설다면 위의 ‘개념 배우기’ 탭부터 살펴보세요.`,
                  ),
                ),
                h("h3", { className: "section-title" }, "입력"),
                h("p", { className: "prose" }, problem.input),
                h("h3", { className: "section-title" }, "출력"),
                h("p", { className: "prose" }, problem.output),
                h("h3", { className: "section-title" }, "입출력 예시"),
                problem.tests
                  .slice(0, 2)
                  .map((test, i) =>
                    h(
                      "div",
                      { className: "io-card", key: i },
                      h(
                        "div",
                        { className: "io-head" },
                        `예제 ${i + 1}`,
                        icon(Code2, { size: 12 }),
                      ),
                      h(
                        "div",
                        { className: "io-body" },
                        h(
                          "div",
                          { className: "io-col" },
                          h("label", null, "입력"),
                          h("pre", null, test.input || "(없음)"),
                        ),
                        h(
                          "div",
                          { className: "io-col" },
                          h("label", null, "출력"),
                          h("pre", null, test.output),
                        ),
                      ),
                    ),
                  ),
                h("h3", { className: "section-title" }, "기억해주세요"),
                h(
                  "ul",
                  { className: "constraint-list" },
                  problem.constraints.map((text, i) =>
                    h("li", { key: i }, text),
                  ),
                ),
              ),
              content(
                "concept",
                h("div", { className: "eyebrow" }, "LEARN THE BASICS"),
                h("h2", { className: "problem-title" }, problem.topic),
                h("p", { className: "prose" }, problem.concept),
                h(
                  "pre",
                  { className: "concept-code" },
                  problem.conceptCode,
                ),
                h(
                  "div",
                  { className: "concept-callout" },
                  icon(Lightbulb),
                  "예제 코드를 직접 바꿔 실행해보면 더 쉽게 이해할 수 있어요.",
                ),
              ),
              content(
                "hints",
                h(
                  "h2",
                  { className: "problem-title" },
                  "조금씩, 스스로 풀어봐요",
                ),
                h(
                  "p",
                  { className: "prose", style: { marginBottom: 20 } },
                  "힌트를 하나씩 열어보세요. 해설을 보기 전에 직접 시도하는 것을 추천해요.",
                ),
                problem.hints.map((text, i) =>
                  h(
                    "details",
                    { className: "hint", key: problem.id + i },
                    h("summary", null, `힌트 ${i + 1}`),
                    h("p", null, text),
                  ),
                ),
                h(
                  "details",
                  { className: "hint", key: problem.id + "-solution" },
                  h("summary", null, "예시 정답 확인하기"),
                  h(
                    "p",
                    null,
                    "정답을 읽는 것만으로 해결 처리되지는 않아요. 직접 실행하고 제출해보세요.",
                  ),
                  h(
                    "pre",
                    { className: "concept-code" },
                    problem.solution,
                  ),
                ),
              ),
            ),
            h(
              "div",
              { className: "problem-footer" },
              h(
                "span",
                null,
                `${trackIndex + 1} / ${track.problems.length} 문제`,
              ),
              h(
                "div",
                { className: "row" },
                h(
                  Button,
                  {
                    variant: "ghost",
                    size: "sm",
                    disabled: problemIndex === 0,
                    onClick: () =>
                      selectProblem(PROBLEMS[problemIndex - 1].id),
                    "aria-label": "이전 문제",
                  },
                  icon(ChevronLeft),
                ),
                h(
                  Button,
                  {
                    variant: "ghost",
                    size: "sm",
                    disabled: problemIndex === PROBLEMS.length - 1,
                    onClick: () =>
                      selectProblem(PROBLEMS[problemIndex + 1].id),
                  },
                  "다음 문제",
                  icon(ChevronRight),
                ),
              ),
            ),
          ),
          h(
            "section",
            {
              className: "panel editor-panel",
              "aria-label": "Python 코드 작성 및 실행",
            },
            h(
              "div",
              { className: "panel-head" },
              icon(Code2),
              "코드 에디터",
              h("span", { className: "grow" }),
              h(
                "span",
                { className: "tiny muted", style: { fontWeight: 400 } },
                storageWarning ? "임시 저장 모드" : "브라우저 자동 저장",
              ),
            ),
            h(
              "div",
              { className: "editor-toolbar" },
              h(
                "div",
                { className: "language" },
                h("span", { className: "python-logo" }, "Py"),
                "Python 3",
                h("span", { className: "muted" }, "· solution.py"),
              ),
              h(
                Button,
                {
                  size: "icon",
                  variant: "ghost",
                  onClick: resetCode,
                  disabled: Boolean(busy),
                  title: "시작 코드로 되돌리기",
                  "aria-label": "코드 초기화",
                },
                icon(RotateCcw, { size: 13 }),
              ),
            ),
            h(
              "div",
              { className: "code-wrap" },
              h(
                "pre",
                { className: "line-numbers", "aria-hidden": true },
                h(
                  "div",
                  { style: { transform: `translateY(-${scrollTop}px)` } },
                  code
                    .split("\n")
                    .map((_, i) => i + 1)
                    .join("\n"),
                ),
              ),
              h("textarea", {
                ref: editorRef,
                className: "editor",
                "aria-label": "Python 코드",
                value: code,
                spellCheck: false,
                autoCapitalize: "off",
                autoComplete: "off",
                readOnly: Boolean(busy),
                onChange: (event) => changeCode(event.target.value),
                onKeyDown: onEditorKey,
                onScroll: (event) =>
                  setScrollTop(event.currentTarget.scrollTop),
              }),
            ),
            h(
              "div",
              { className: "editor-status" },
              h("span", null, "UTF-8", "　·　", "들여쓰기 4칸"),
              h("span", null, "Python · WebAssembly"),
            ),
            h(
              Tabs.Root,
              {
                className: "runner",
                value: runnerTab,
                onValueChange: setRunnerTab,
              },
              h(
                Tabs.List,
                { className: "tab-list", "aria-label": "실행 정보" },
                tab("input", "테스트 입력"),
                tab("output", "실행 결과"),
                tab("tests", "채점 결과"),
              ),
              content(
                "input",
                h(
                  "div",
                  { className: "input-label" },
                  "직접 입력해보세요",
                ),
                h("textarea", {
                  className: "stdin",
                  "aria-label": "테스트 입력",
                  placeholder: "이 문제는 입력이 필요하지 않아요.",
                  value: stdin,
                  onChange: (event) => setStdin(event.target.value),
                }),
                h(
                  "p",
                  { className: "input-note" },
                  "실행은 이 입력을, 제출은 문제의 모든 테스트 케이스를 사용해요.",
                ),
              ),
              content(
                "output",
                runResult
                  ? h(
                      React.Fragment,
                      null,
                      h(
                        "div",
                        {
                          className:
                            "result-head " +
                            (runResult.error
                              ? "result-fail"
                              : "result-pass"),
                        },
                        icon(runResult.error ? X : CheckCircle2, {
                          size: 14,
                        }),
                        runResult.error
                          ? "실행 중 오류가 발생했어요"
                          : "실행 완료",
                        elapsed !== null &&
                          h(
                            "span",
                            { className: "muted tiny" },
                            `${elapsed} ms`,
                          ),
                      ),
                      h(
                        "pre",
                        { className: "output" },
                        runResult.output ||
                          (!runResult.error ? "(출력 없음)" : ""),
                      ),
                      runResult.stderr &&
                        h(
                          "pre",
                          { className: "output error" },
                          runResult.stderr,
                        ),
                      runResult.error &&
                        h(
                          "pre",
                          { className: "output error" },
                          runResult.error,
                        ),
                    )
                  : h(
                      "div",
                      { className: "empty-result" },
                      icon(busy ? LoaderCircle : Terminal),
                      busy || "코드를 실행하면 여기에 결과가 나타나요.",
                    ),
              ),
              content(
                "tests",
                grade
                  ? h(
                      React.Fragment,
                      null,
                      h(
                        "div",
                        {
                          className:
                            "result-head " +
                            (grade.passed
                              ? "result-pass"
                              : grade.finished
                                ? "result-fail"
                                : "muted"),
                          role: "status",
                        },
                        icon(grade.passed ? CheckCircle2 : ListChecks, {
                          size: 15,
                        }),
                        grade.finished
                          ? grade.passed
                            ? "모든 테스트를 통과했어요!"
                            : "조금만 더 생각해볼까요?"
                          : "채점하고 있어요…",
                        h(
                          "span",
                          { className: "tiny muted" },
                          `${grade.results.filter((r) => r.passed).length} / ${grade.total}`,
                        ),
                      ),
                      grade.results.map((result, i) =>
                        h(
                          "div",
                          { className: "case-row", key: i },
                          h(
                            "details",
                            null,
                            h(
                              "summary",
                              {
                                className: result.passed
                                  ? "result-pass"
                                  : "result-fail",
                              },
                              `${result.passed ? "✓" : "×"} 테스트 ${i + 1} · ${result.passed ? "통과" : result.error ? "실행 오류" : "출력이 달라요"}`,
                            ),
                            h(
                              "div",
                              { className: "case-detail" },
                              h(
                                "div",
                                null,
                                "기대 출력",
                                h("pre", null, result.expected),
                              ),
                              h(
                                "div",
                                null,
                                "내 출력",
                                h("pre", null, result.output || "(없음)"),
                              ),
                            ),
                            result.error &&
                              h(
                                "pre",
                                { className: "output error" },
                                result.error,
                              ),
                          ),
                        ),
                      ),
                    )
                  : h(
                      "div",
                      { className: "empty-result" },
                      icon(busy ? LoaderCircle : ListChecks),
                      busy ||
                        "제출하면 테스트 케이스별 결과를 볼 수 있어요.",
                    ),
              ),
            ),
            h(
              "div",
              { className: "execution-bar" },
              h(
                "span",
                { className: "execution-note", role: "status" },
                busy || "Ctrl + Enter로 실행",
              ),
              h(
                "div",
                { className: "execution-buttons" },
                busy
                  ? h(
                      Button,
                      {
                        variant: "outline",
                        onClick: () =>
                          stopJob(
                            "실행을 중지했어요. 코드를 수정하고 다시 시도해보세요.",
                          ),
                      },
                      icon(Square),
                      "중지",
                    )
                  : h(
                      React.Fragment,
                      null,
                      h(
                        Button,
                        {
                          variant: "outline",
                          onClick: () => execute("run"),
                        },
                        icon(Play),
                        "실행",
                      ),
                      h(
                        Button,
                        { onClick: () => execute("grade") },
                        icon(Send),
                        "제출하기",
                      ),
                    ),
              ),
            ),
          ),
          h(
            "section",
            { className: "panel coach-panel", "aria-label": "코딩 코치" },
            h(
              "div",
              { className: "panel-head" },
              icon(Sparkles),
              "파코 코치",
              badge("AI PARTNER", "coach-label"),
            ),
            coachLoaded
              ? h(
                  React.Fragment,
                  null,
                  h(
                    "div",
                    { className: "coach-frame-tools" },
                    h(
                      Button,
                      {
                        variant: "ghost",
                        size: "sm",
                        onClick: () => copyPrompt("hint"),
                      },
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
                    h(
                      Button,
                      {
                        variant: "ghost",
                        size: "sm",
                        onClick: () => setCoachLoaded(false),
                      },
                      "도움말",
                    ),
                  ),
                )
              : h(
                  "div",
                  { className: "coach-body" },
                  h(
                    "div",
                    { className: "coach-greeting" },
                    h("div", { className: "coach-avatar" }, icon(Bot)),
                    h("h3", null, "막히는 순간, 함께 생각해요."),
                    h(
                      "p",
                      null,
                      "정답보다 중요한 건 생각하는 과정이에요.",
                      h("br"),
                      "파코와 대화하며 나만의 답을 찾아보세요.",
                    ),
                  ),
                  h(
                    "div",
                    { className: "coach-section-label" },
                    "이렇게 질문해보세요",
                  ),
                  promptButton(
                    Lightbulb,
                    "이 문제에 필요한 개념이 궁금해",
                    "concept",
                  ),
                  promptButton(
                    HelpCircle,
                    "정답 말고, 작은 힌트만 줄래?",
                    "hint",
                  ),
                  promptButton(
                    Code2,
                    "내 코드를 함께 살펴봐줄래?",
                    "review",
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
                    h(
                      Button,
                      {
                        className: "wide",
                        onClick: () => setCoachLoaded(true),
                      },
                      icon(Bot),
                      "코치 연결하기",
                      icon(ArrowRight),
                    ),
                    h(
                      "div",
                      { className: "coach-links" },
                      h(
                        "span",
                        { className: "tiny muted" },
                        "외부 iframe · 인터넷 필요",
                      ),
                      h(
                        Button,
                        {
                          variant: "ghost",
                          size: "sm",
                          onClick: openSettings,
                        },
                        icon(Settings2, { size: 12 }),
                        "연결 설정",
                      ),
                    ),
                  ),
                ),
          ),
        ),
        h(
          "footer",
          { className: "workspace-footer" },
          h(
            "span",
            null,
            icon(ShieldCheck),
            storageWarning
              ? "임시 모드 · 학습 기록 저장 불가"
              : "코드와 진도는 이 브라우저에만 저장돼요.",
          ),
          h(SiteNav, { className: "footer-links", label: "바로가기" }),
          h(
            "span",
            null,
            "샘플 커리큘럼 · ",
            `${PROBLEMS.length}개 문제`,
            "　·　작은 시도가 큰 변화를 만들어요.",
          ),
        ),
      ),
    ),
    h(
      Modal,
      {
        open: roadmap,
        onOpenChange: setRoadmap,
        title: "나만의 코딩 여정",
        description: `입문부터 도전까지, 원하는 문제를 자유롭게 선택하세요. 전체 ${PROBLEMS.length}개 중 ${state.completed.length}개 해결 · 제공 전 샘플 문제입니다.`,
      },
      h(
        "div",
        { className: "track-grid" },
        TRACKS.map((t) =>
          h(
            "section",
            { className: "track-card", key: t.id },
            h(
              "div",
              { className: "track-card-header" },
              badge(t.name),
              h("h3", null, t.label),
              h("p", null, t.topics),
            ),
            t.problems.map((p) =>
              h(
                "button",
                {
                  className:
                    "roadmap-item" +
                    (p.id === problem.id ? " selected" : ""),
                  key: p.id,
                  onClick: () => selectProblem(p.id),
                },
                icon(
                  state.completed.includes(p.id) ? CheckCircle2 : Circle,
                ),
                h(
                  "div",
                  { className: "grow" },
                  p.title,
                  h(
                    "small",
                    null,
                    `${p.level} · ${pointsFor(p)}점 · ` +
                      (state.completed.includes(p.id)
                        ? "해결 완료"
                        : state.codes[p.id] !== undefined ||
                            p.id === state.selected
                          ? "진행 중"
                          : "시작 전"),
                  ),
                ),
                icon(ChevronRight),
              ),
            ),
          ),
        ),
      ),
    ),
    h(
      Modal,
      {
        open: settings,
        onOpenChange: setSettings,
        title: "연결 설정",
        description:
          "코치 주소와 포인트 적립 흐름 주소를 이 브라우저에 저장해요. 코치는 기존 파코의 공개 주소를 기본으로 사용하며, 다른 코치는 iframe 삽입이 허용된 HTTPS 주소를 입력해주세요.",
      },
      h(
        "label",
        { className: "config-label", htmlFor: "coach-url" },
        "코치 iframe 주소",
      ),
      h("input", {
        id: "coach-url",
        className: "config-input",
        type: "url",
        value: coachDraft,
        onChange: (event) => setCoachDraft(event.target.value),
      }),
      h(
        "label",
        { className: "config-label", htmlFor: "points-url" },
        "포인트 적립 흐름 주소 (Power Automate)",
      ),
      h("input", {
        id: "points-url",
        className: "config-input",
        type: "url",
        placeholder: "https://….api.powerplatform.com/…",
        autoComplete: "off",
        value: pointsDraft,
        onChange: (event) => setPointsDraft(event.target.value),
      }),
      configError &&
        h("div", { className: "alert", role: "alert" }, configError),
      h(
        "p",
        { className: "prose" },
        "문제를 해결하면 이 브라우저가 위 흐름 주소로 학교·학번·이름과 포인트를 직접 보냅니다. 주소의 서명은 비밀이므로 다른 사람과 공유하지 마세요. 페이지는 AI API를 호출하지 않으며, 코치 대화는 외부 서비스의 정책을 따릅니다. 코치 화면이 차단되면 새 창으로 열어주세요.",
      ),
      h(
        "div",
        { className: "config-actions" },
        h(
          Button,
          {
            variant: "outline",
            onClick: () => setCoachDraft(DEFAULT_COACH_URL),
          },
          "기본 주소",
        ),
        h(Button, { onClick: saveCoach }, "주소 저장"),
      ),
    ),
    toast && h("div", { className: "toast", role: "status" }, toast),
  );
}
// 첫 화면에 필요한 문제 본문을 받은 뒤에 화면을 그립니다.
loadProblem(startupProblemId(window.location.search)).then(
  () =>
    createRoot(document.getElementById("root")).render(
      h(ErrorBoundary, null, h(App)),
    ),
  () => {
    const message = document.getElementById("boot-message");
    if (message)
      message.textContent =
        "첫 문제를 불러오지 못했습니다. 인터넷 연결을 확인한 후 새로고침해주세요.";
  },
);
