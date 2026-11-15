import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Code2,
  Flame,
  Gem,
  LogOut,
  Map,
  Settings2,
  Star,
  GraduationCap,
} from "lucide-react";
import { h, Button, icon, Modal } from "./studio-ui.js";
import { usePythonRunner } from "./studio-runner.js";
import { RoadmapView } from "./studio-roadmap.js";
import { LearnView } from "./studio-learn.js";
import { ExamView, PlacementView } from "./studio-quiz.js";

const SITE_LINKS = [
  { label: "내 학습", href: "./my-learning.html" },
  { label: "대시보드", href: "./dashboard.html" },
];
function SiteNav({ className, label }) {
  return h(
    "nav",
    { className, "aria-label": label },
    SITE_LINKS.map((link) => h("a", { key: link.href, href: link.href }, link.label)),
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
        state: initialState(),
        warning: "브라우저 저장소에 접근할 수 없어 임시 모드로 시작했어요. " + error.message,
      };
    }
  });
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [storageWarning] = useState(initial.warning);
  const storageDisabled = useRef(Boolean(initial.warning));
  const awarding = useRef(new Set());
  const switchRequest = useRef(0);
  const runner = usePythonRunner();
  const [view, setView] = useState({ name: "roadmap" });
  const [toasts, setToasts] = useState([]);
  const [settings, setSettings] = useState(false);
  const [coachDraft, setCoachDraft] = useState(state.coachUrl);
  const [pointsDraft, setPointsDraft] = useState(state.pointsUrl);
  const [configError, setConfigError] = useState("");
  const [coachLoaded, setCoachLoaded] = useState(false);
  // 로그인한 학생의 학교·이름을 상단에 표시합니다. 확인할 수 없으면 기본 아바타만 보여줍니다.
  const [learner, setLearner] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // 저장과 화면 갱신은 항상 이 두 함수를 거칩니다. 비동기 작업(채점 등)이 끝난 뒤에도 최신 상태에서 이어서 계산합니다.
  const getState = () => stateRef.current;
  const commit = (next) => {
    stateRef.current = next;
    setState(next);
    return next;
  };
  const apply = (update) => commit(update(stateRef.current));
  function toast(message) {
    if (!message) return;
    const id = Math.random().toString(36).slice(2);
    // 같은 안내가 이미 떠 있으면 겹쳐 쌓지 않습니다(승급 시험은 문제 2개의 적립 결과가 함께 나옵니다).
    setToasts((list) => (list.some((item) => item.message === message) ? list : [...list.slice(-2), { id, message }]));
    setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 3800);
  }

  useEffect(() => {
    if (storageDisabled.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      storageDisabled.current = true;
      toast("브라우저에 저장하지 못했어요. 현재 작업은 유지되지만 새로고침하면 사라질 수 있어요. " + error.message);
    }
  }, [state]);
  useEffect(() => {
    let active = true;
    loadStudent(fetch, document.cookie)
      .then((student) => active && setLearner(student))
      .catch(() => {});
    if (initial.notice) toast(initial.notice);
    // 내 학습 현황의 추천 링크(?problem=문제ID)로 열면 그 문제부터 보여줍니다.
    const requested = requestedProblemId(window.location.search);
    if (requested) openProblem(requested);
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    setLoggingOut(true);
    await endSession({
      fetchImpl: fetch,
      setCookie: (value) => {
        document.cookie = value;
      },
      cookiePath: new URL(".", window.location.href).pathname,
    });
    window.location.replace(new URL("login.html?reverify=1", window.location.href).href);
  }

  // ---- 화면 이동 ----
  function go(next) {
    runner.stop();
    setView(next);
    window.scrollTo(0, 0);
  }
  const openRoadmap = () => go({ name: "roadmap" });
  // 아직 불러오지 않은 문제는 본문을 받은 뒤에 엽니다. 그 사이 다른 칸을 누르면 마지막 선택만 적용합니다.
  async function openProblem(id) {
    const target = PROBLEM_BY_ID.get(id);
    if (!target || target.kind === "exam") return;
    if (MODEL.nodeState(stateRef.current, id).status === "locked") {
      toast("앞 칸을 먼저 끝내야 열려요.");
      return;
    }
    const request = ++switchRequest.current;
    if (!target.tests) {
      // 빨리 열리면 알림을 띄우지 않고, 오래 걸릴 때만 알려줍니다.
      const notice = setTimeout(() => toast("문제를 불러오는 중이에요…"), 700);
      try {
        await loadProblem(id);
      } catch {
        if (request === switchRequest.current)
          toast("문제를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러주세요.");
        return;
      } finally {
        clearTimeout(notice);
      }
      if (request !== switchRequest.current) return;
    }
    apply((previous) => ({ ...previous, selected: id }));
    go({ name: "learn", id });
  }
  function openExam(level) {
    if (!MODEL.isOpen(stateRef.current, level)) {
      toast("아직 잠긴 레벨이에요. 앞 레벨을 먼저 통과하거나 ‘여기로 점프’를 써 보세요.");
      return;
    }
    switchRequest.current += 1;
    go({ name: "exam", level });
  }
  function openPlacement(target) {
    switchRequest.current += 1;
    go({ name: "placement", target });
  }
  // '학습하기': 지금 풀 문제(또는 승급 시험)를 바로 엽니다.
  function resume() {
    const level = MODEL.currentLevel(stateRef.current);
    if (level > MODEL.levelCount) return openRoadmap();
    const step = MODEL.nextStep(stateRef.current, level);
    if (step.kind === "exam") openExam(level);
    else if (step.id) openProblem(step.id);
  }

  // ---- 보상 ----
  function announce(result) {
    for (const event of result.events || []) {
      if (event.type === "combo") toast(`🔥 ${event.combo}연속 정답! 보석 +${event.gems}`);
      else if (event.type === "daily-goal") toast(`🎯 오늘 목표를 달성했어요! 보석 +${event.gems}`);
      else if (event.type === "week-streak") toast(`🔥 ${event.streak}일 연속 학습! 보석 +${event.gems}`);
      else if (event.type === "freeze-used") toast("🧊 연속 학습 보호를 사용했어요!");
    }
  }
  // 해결하면 브라우저가 Power Automate 흐름을 직접 호출합니다. 학생·문제당 한 번만 적립하며 기록은 이 브라우저에만 남습니다.
  async function award(solvedProblem, points) {
    const url = stateRef.current.pointsUrl || DEFAULT_POINTS_URL;
    if (!url || !points) {
      if (!url) toast("해결했어요! 포인트 적립 주소가 설정되지 않았어요. 설정(톱니바퀴)에서 입력해주세요.");
      return;
    }
    let key;
    try {
      const student = await loadStudent(fetch, document.cookie);
      key = awardKey(student, solvedProblem.id);
      if (stateRef.current.awarded.includes(key) || awarding.current.has(key)) {
        toast("이미 포인트를 받은 문제예요.");
        return;
      }
      awarding.current.add(key);
      const result = await requestPoints({ url, student, problemId: solvedProblem.id, points, fetchImpl: fetch });
      apply((previous) => ({ ...previous, awarded: [...new Set([...previous.awarded, key])] }));
      toast(
        result.awarded
          ? `+${points}점이 적립됐어요. (누적 ${result.points}점)`
          : `이미 포인트를 받은 문제예요. (누적 ${result.points}점)`,
      );
    } catch (error) {
      const network = error instanceof TypeError || error.name === "TimeoutError" || error.name === "AbortError";
      toast(
        "해결은 저장했지만 포인트를 확인하지 못했어요. " +
          (network
            ? "네트워크 연결이나 흐름 상태를 확인해주세요. 적립됐을 수 있으니 같은 문제를 반복 제출하지 마세요."
            : error.message),
      );
    } finally {
      if (key) awarding.current.delete(key);
    }
  }

  // ---- 설정 ----
  function saveSettings() {
    try {
      const coachUrl = validateCoachUrl(coachDraft);
      const pointsUrl = pointsDraft.trim() ? validatePointsUrl(pointsDraft) : "";
      apply((previous) => ({ ...previous, coachUrl, pointsUrl }));
      setCoachLoaded(false);
      setSettings(false);
      setConfigError("");
      toast("설정을 저장했어요. 코치는 연결 버튼으로 열어주세요.");
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

  const ctx = {
    state,
    getState,
    commit,
    apply,
    runner,
    toast,
    announce,
    award,
    storageWarning,
    openProblem,
    openRoadmap,
    openExam,
    openPlacement,
    coach: { loaded: coachLoaded, setLoaded: setCoachLoaded, openSettings },
  };
  const today = PcoProgress.dayKey(new Date());
  const tab = (active, label, Icon, onClick) =>
    h("button", { type: "button", className: "top-tab" + (active ? " active" : ""), "aria-current": active ? "page" : undefined, onClick }, icon(Icon, { size: 16 }), label);

  let body;
  if (view.name === "learn") body = h(LearnView, { key: view.id, ctx, problem: PROBLEM_BY_ID.get(view.id) });
  else if (view.name === "exam") body = h(ExamView, { key: view.level, ctx, level: view.level });
  else if (view.name === "placement") body = h(PlacementView, { key: "placement-" + view.target, ctx, target: view.target });
  else body = h(RoadmapView, { ctx });

  return h(
    "div",
    { className: "shell" },
    h(
      "header",
      { className: "topbar" },
      h("a", { className: "brand", href: "./new.html", title: "파코 스튜디오" }, h("span", { className: "brand-icon" }, "P"), h("span", { className: "brand-text" }, h("strong", null, "파코 스튜디오"), h("small", null, "나만의 속도로, 한 걸음씩"))),
      h(
        "nav",
        { className: "top-tabs", "aria-label": "주요 메뉴" },
        tab(view.name === "learn", "학습하기", Code2, resume),
        tab(view.name === "roadmap", "로드맵", Map, openRoadmap),
        tab(false, "나의 진도", GraduationCap, () => {
          openRoadmap();
          setTimeout(() => document.getElementById("side")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
        }),
      ),
      h(
        "div",
        { className: "top-chips", "aria-label": "나의 기록" },
        h("span", { className: "stat-chip streak", title: "연속 학습일" }, icon(Flame, { size: 15 }), `${PcoProgress.liveStreak(state, today)}일 연속`),
        h("span", { className: "stat-chip points", title: "이 브라우저에서 얻은 점수" }, icon(Star, { size: 15 }), `${MODEL.totalPoints(state)}점`),
        h("span", { className: "stat-chip gems", title: "보석" }, icon(Gem, { size: 15 }), `${state.gems}`),
      ),
      h(
        "div",
        { className: "top-right" },
        h(SiteNav, { className: "site-nav", label: "주요 페이지" }),
        h(ThemeToggle),
        h(Button, { size: "icon", variant: "ghost", onClick: openSettings, "aria-label": "연결 설정", title: "연결 설정" }, icon(Settings2)),
        learner
          ? h(
              "div",
              { className: "student-chip", title: `${learner.school} · ${learner.studentName} 학생` },
              h("div", { className: "avatar", "aria-hidden": "true" }, learner.studentName.slice(0, 1)),
              h("div", { className: "student-meta" }, h("small", null, learner.school), h("strong", null, `${learner.studentName} 학생`)),
              h(Button, { variant: "ghost", size: "sm", onClick: logout, disabled: loggingOut, title: "로그아웃" }, icon(LogOut, { size: 14 }), h("span", { className: "logout-label" }, "로그아웃")),
            )
          : h("div", { className: "avatar", title: "로그인한 학생 정보 없음" }, "나"),
      ),
    ),
    storageWarning && h("div", { className: "alert", role: "alert" }, storageWarning),
    h("div", { className: "stage" }, body),
    h(
      "footer",
      { className: "workspace-footer" },
      h("span", null, "코드와 진도는 이 브라우저에만 저장돼요."),
      h(SiteNav, { className: "footer-links", label: "바로가기" }),
      h("span", null, `${TRACKS.length}개 레벨 · 핵심 ${PROBLEMS.filter((p) => p.kind === "core").length}문제`),
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
      h("label", { className: "config-label", htmlFor: "coach-url" }, "코치 iframe 주소"),
      h("input", { id: "coach-url", className: "config-input", type: "url", value: coachDraft, onChange: (event) => setCoachDraft(event.target.value) }),
      h("label", { className: "config-label", htmlFor: "points-url" }, "포인트 적립 흐름 주소 (Power Automate)"),
      h("input", {
        id: "points-url",
        className: "config-input",
        type: "url",
        placeholder: "https://….api.powerplatform.com/…",
        autoComplete: "off",
        value: pointsDraft,
        onChange: (event) => setPointsDraft(event.target.value),
      }),
      configError && h("div", { className: "alert", role: "alert" }, configError),
      h(
        "p",
        { className: "prose" },
        "문제를 해결하면 이 브라우저가 위 흐름 주소로 학교·학번·이름과 포인트를 직접 보냅니다. 주소의 서명은 비밀이므로 다른 사람과 공유하지 마세요. 페이지는 AI API를 호출하지 않으며, 코치 대화는 외부 서비스의 정책을 따릅니다. 코치 화면이 차단되면 새 창으로 열어주세요.",
      ),
      h(
        "div",
        { className: "config-actions" },
        h(Button, { variant: "outline", onClick: () => setCoachDraft(DEFAULT_COACH_URL) }, "기본 주소"),
        h(Button, { onClick: saveSettings }, "주소 저장"),
      ),
    ),
    toasts.length > 0 &&
      h("div", { className: "toast-stack", role: "status" }, toasts.map((item) => h("div", { className: "toast", key: item.id }, item.message))),
  );
}
// 로드맵은 문제 본문 없이 목록만으로 그려지므로 바로 시작합니다. 풀 문제의 파일은 new.html이 미리 요청해 둡니다.
createRoot(document.getElementById("root")).render(h(ErrorBoundary, null, h(App)));
