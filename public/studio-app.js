import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Cloud,
  CloudOff,
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

// 서버 저장 상태를 헤더 칩에 보여줄 말입니다. off 는 서버 저장을 쓰지 않으므로 칩을 숨깁니다.
// idle 은 서버 기록을 불러오기 직전(서버 저장을 쓰는 학생의 첫 화면)이라 loading 과 똑같이 보여 줍니다. 칩이 한두 프레임 늦게 나타나면 헤더가 한 번 더 바뀌어요.
const SYNC_VIEW = {
  idle: { label: "불러오는 중", title: "서버에서 내 학습 기록을 불러오고 있어요.", Icon: Cloud },
  loading: { label: "불러오는 중", title: "서버에서 내 학습 기록을 불러오고 있어요.", Icon: Cloud },
  synced: { label: "저장됨", title: "보석과 진도가 서버에 저장돼 있어요. 다른 기기에서도 이어서 학습할 수 있어요.", Icon: Cloud },
  pending: { label: "저장 중", title: "바뀐 기록을 곧 서버에 저장해요.", Icon: Cloud },
  saving: { label: "저장 중", title: "바뀐 기록을 서버에 저장하고 있어요.", Icon: Cloud },
  offline: { label: "저장 대기", title: "서버에 연결하지 못했어요. 연결되면 자동으로 저장하니 그때까지 이 창을 닫지 마세요.", Icon: CloudOff },
  local: { label: "이 브라우저에만 저장", title: "서버에 저장하지 못해요.", Icon: CloudOff },
};
const SERVER_STATUSES = ["idle", "loading", "synced", "pending", "saving", "offline"];

function App() {
  const [initial] = useState(() => {
    const owner = studentFromCookies(document.cookie);
    const key = studentStorageKey(document.cookie);
    try {
      return { ...readStudioState(localStorage, key, owner), key, owner };
    } catch (error) {
      return {
        state: initialState(),
        warning: "브라우저 저장소에 접근할 수 없어 임시 모드로 시작했어요. " + error.message,
        key,
        owner,
      };
    }
  });
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [storageWarning] = useState(initial.warning);
  const storageDisabled = useRef(Boolean(initial.warning));
  const awarding = useRef(new Set());
  // 서버 흐름은 점수를 읽어 더한 뒤 저장하므로 요청이 겹치면 한쪽이 지워집니다. 포인트 요청은 한 번에 하나씩 차례로 보냅니다.
  const [enqueueAward] = useState(createSerialQueue);
  const switchRequest = useRef(0);
  // 학습 기록(보석·진도)은 서버가 원본입니다. 이 브라우저에는 오프라인일 때를 위한 사본과 작성 중인 코드를 학생별로 둡니다.
  const syncRef = useRef(null);
  // 서버와 마지막으로 맞춘 기록, 응답을 받지 못했을 수 있는 최근 저장은 사본과 같은 JSON 에 함께 보관해 서로 어긋나지 않게 합니다.
  const syncMeta = useRef({ sync: initial.sync || null, attempts: initial.attempts || [] });
  const [syncUrl] = useState(() => stateFlowUrl(initial.state));
  // 서버는 학교·학번·이름으로 학생 행을 찾으므로 이름까지 알 때만 서버와 맞춥니다.
  const syncOn = Boolean(initial.owner && initial.owner.studentName && syncUrl);
  const [sync, setSync] = useState({ status: syncOn ? "idle" : "off", detail: null });
  // 이 브라우저에 사본이 없으면(처음 쓰는 기기) 서버 기록을 받을 때까지 잠깐 기다립니다.
  const [booting, setBooting] = useState(syncOn && !initial.restored);
  const bootingRef = useRef(booting);
  bootingRef.current = booting;
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

  // 사본은 상태가 바뀔 때마다, 그리고 서버와 맞춘 기록이 바뀔 때마다 한 번에 저장합니다.
  function persist() {
    if (storageDisabled.current) return;
    const { sync: base, attempts } = syncMeta.current;
    try {
      localStorage.setItem(
        initial.key,
        JSON.stringify({ ...stateRef.current, ...(base ? { sync: base } : {}), ...(attempts.length ? { attempts } : {}) }),
      );
    } catch (error) {
      storageDisabled.current = true;
      toast("브라우저에 저장하지 못했어요. 현재 작업은 유지되지만 새로고침하면 사라질 수 있어요. " + error.message);
    }
  }
  useEffect(persist, [state]);
  // 보석·해결·승급 기록이 바뀌면 서버 저장을 예약합니다. 코드를 입력하는 동안에는 아무 일도 하지 않습니다.
  useEffect(() => {
    if (syncRef.current) syncRef.current.notify();
  }, [state]);
  useEffect(() => {
    if (!syncOn) return undefined;
    let cancelled = false;
    let engine = null;
    // 서버가 느려도 화면은 8초 안에 열고, 불러오기는 뒤에서 이어갑니다.
    const gate = setTimeout(() => setBooting(false), 8000);
    (async () => {
      try {
        const student = await loadStudent(fetch, document.cookie);
        if (
          student.school !== initial.owner.school ||
          student.studentId !== initial.owner.studentId ||
          student.studentName !== initial.owner.studentName
        )
          throw new Error("로그인한 학생 정보가 달라졌어요. 화면을 새로고침해주세요.");
        const url = validatePointsUrl(syncUrl);
        if (cancelled) return;
        engine = PcoSync.createSync({
          url,
          student,
          fetchImpl: (...args) => fetch(...args),
          getProgress: getState,
          readProgress,
          initialBase: syncMeta.current.sync,
          initialAttempts: syncMeta.current.attempts,
          applyRemote: (remote, before) => {
            const was = stateRef.current;
            const next = apply((previous) => ({
              ...previous,
              ...PcoSync.mergeProgress(PcoSync.pickProgress(previous), remote, before),
            }));
            // 화면이 열린 뒤에 서버 기록이 도착해 점수나 레벨이 바뀌면 말없이 바뀌지 않도록 알려 줍니다.
            if (!bootingRef.current && (MODEL.totalPoints(next) !== MODEL.totalPoints(was) || MODEL.currentLevel(next) !== MODEL.currentLevel(was)))
              toast("서버에 저장된 학습 기록을 불러와 합쳤어요.");
          },
          onStatus: (status, detail) => {
            if (!cancelled) setSync({ status, detail });
          },
          onBase: (base) => {
            syncMeta.current.sync = base;
            persist();
          },
          onAttempts: (attempts) => {
            syncMeta.current.attempts = attempts;
            persist();
          },
          onConflict: () => toast("다른 기기에서 학습한 기록을 합쳤어요."),
        });
        syncRef.current = engine;
        await engine.start();
      } catch (error) {
        if (!cancelled) setSync({ status: "local", detail: { kind: "unsupported", message: error.message } });
      } finally {
        clearTimeout(gate);
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(gate);
      if (engine) engine.stop();
      syncRef.current = null;
    };
  }, []);
  // 창을 닫거나 다른 탭으로 옮기기 전에 남은 변경을 바로 보냅니다.
  useEffect(() => {
    const leave = () => {
      if (syncRef.current) syncRef.current.flush({ keepalive: true }).catch(() => {});
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") leave();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", leave);
    };
  }, []);
  useEffect(() => {
    let active = true;
    loadStudent(fetch, document.cookie)
      .then((student) => active && setLearner(student))
      .catch(() => {});
    if (initial.notice) toast(initial.notice);
    // 내 학습 현황의 추천 링크(?problem=문제ID)로 열면 그 문제부터 보여줍니다.
    const requested = requestedProblemId(window.location.search);
    if (requested) openProblem(requested);
    // 그 매개변수는 한 번만 쓰고 주소에서 지웁니다. 남겨 두면 새로고침할 때마다 처음 그 문제로 되돌아가요.
    const cleaned = withoutRequestedProblem(window.location);
    if (cleaned) {
      try {
        window.history.replaceState(null, "", cleaned);
      } catch {
        /* 주소를 바꿀 수 없어도 문제 열기에는 영향이 없습니다. */
      }
    }
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    setLoggingOut(true);
    // 남은 변경을 서버에 저장한 뒤 나갑니다. 서버가 느리면 4초만 기다리고, 저장하지 못한 기록은 이 브라우저에 남습니다.
    if (syncRef.current) await syncRef.current.flush({ timeoutMs: 4000 }).catch(() => false);
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
    // 옮길 때마다 아직 문제 본문을 받는 중인 요청은 취소합니다. 그러지 않으면 다른 화면으로 옮긴 뒤에도 늦게 도착한 문제가 화면을 가로채요.
    switchRequest.current += 1;
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
    go({ name: "exam", level });
  }
  function openPlacement(target) {
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
  function award(solvedProblem, points) {
    return enqueueAward(() => sendAward(solvedProblem, points));
  }
  async function sendAward(solvedProblem, points) {
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
      const result = await requestPointsWithRetry({ url, student, problemId: solvedProblem.id, points, fetchImpl: fetch });
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

  if (booting)
    return h(
      "div",
      { className: "loading", role: "status" },
      h("div", null, h("strong", null, "내 학습 기록을 불러오고 있어요."), h("p", null, "이 기기에서 처음 열면 서버에 저장된 보석과 진도를 가져와요.")),
    );

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
        h("span", { className: "stat-chip points", title: "얻은 점수" }, icon(Star, { size: 15 }), `${MODEL.totalPoints(state)}점`),
        h("span", { className: "stat-chip gems", title: "보석" }, icon(Gem, { size: 15 }), `${state.gems}`),
        SYNC_VIEW[sync.status] &&
          h(
            "span",
            {
              // 상태 이름을 그대로 클래스로 쓰면 부팅 화면용 .loading 같은 전역 규칙이 칩에 적용돼 헤더가 세로로 늘어납니다.
              className: `stat-chip sync sync-${sync.status}`,
              role: "status",
              title: sync.status === "local" && sync.detail ? `${SYNC_VIEW.local.title} ${sync.detail.message}` : SYNC_VIEW[sync.status].title,
            },
            icon(SYNC_VIEW[sync.status].Icon, { size: 15 }),
            SYNC_VIEW[sync.status].label,
          ),
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
      h("span", null, SERVER_STATUSES.includes(sync.status) ? "보석과 진도는 서버에 저장되고, 작성 중인 코드는 이 브라우저에 자동 저장돼요." : "코드와 진도는 이 브라우저에만 저장돼요."),
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
        "문제를 해결하면 이 브라우저가 위 흐름 주소로 학교·학번·이름과 포인트를 직접 보내고, 보석·진도 같은 학습 기록도 같은 흐름에 저장합니다(배포 설정에 학습 기록용 흐름이 따로 있으면 그 주소를 씁니다). 주소의 서명은 비밀이므로 다른 사람과 공유하지 마세요. 페이지는 AI API를 호출하지 않으며, 코치 대화는 외부 서비스의 정책을 따릅니다. 코치 화면이 차단되면 새 창으로 열어주세요.",
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
