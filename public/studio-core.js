// 문제 목록(제목·종류·난이도 등)은 studio-catalog.js에서 읽고, 문제 본문은 loadProblem이 선택한 문제만 불러와 합칩니다.
// 승급·잠금 규칙은 studio-progress.js(PcoProgress)가 정합니다.
const TRACKS = PcoStudio.tracks.map((track) => ({
  ...track,
  problems: track.problems.map((problem) => ({ ...problem, trackId: track.id })),
  exam: track.exam.map((problem) => ({ ...problem, trackId: track.id })),
}));
// 레벨 목록과 같은 객체를 가리키므로 문제 본문을 한 번 불러오면 어디서나 보입니다.
const PROBLEMS = TRACKS.flatMap((track) => [...track.problems, ...track.exam]);
const PROBLEM_BY_ID = new Map(PROBLEMS.map((problem) => [problem.id, problem]));
const MODEL = PcoProgress.createModel(TRACKS);
const STORAGE_KEY = "paco-studio-v2";
// 이전 화면(10단계 목록)의 저장 키입니다. 코치·포인트 주소만 이어받고 학습 기록은 새 방식과 달라 옮기지 않습니다.
const LEGACY_STORAGE_KEY = "paco-studio-v1";
const DEFAULT_COACH_URL =
  "https://copilotstudio.microsoft.com/environments/9324e73a-cd4e-e049-b7ba-177af6165e9c/bots/crbf2_bot_QSDFLs/webchat?__version__=2&enableFileAttachment=false&cliAgent=true";
// 이전 기본 코치 주소를 저장해 둔 브라우저는 새 코치로 옮깁니다. 직접 입력한 다른 주소는 그대로 둡니다.
const LEGACY_COACH_URLS = [
  "https://copilotstudio.microsoft.com/environments/9324e73a-cd4e-e049-b7ba-177af6165e9c/bots/crbf2_agent_dKZZIw/webchat?__version__=2&enableFileAttachment=false&cliAgent=true",
];
// 배포 때 GitHub Actions가 만드는 runtime-config.js(PcoConfig.pointsUrl)에서 읽습니다. 소스에는 비밀 값을 두지 않습니다.
const DEFAULT_POINTS_URL =
  (typeof PcoConfig !== "undefined" && PcoConfig.pointsUrl) || "";
const POINTS_BY_LEVEL = {
  맛보기: 5,
  입문: 10,
  기초: 20,
  응용: 30,
  도전: 50,
  심화: 80,
};
const PRACTICE_POINTS = PcoStudio.PRACTICE_POINTS;
function normalizeOutput(value) {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}
function validateCoachUrl(value) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("인증 정보가 없는 HTTPS 주소를 입력해주세요.");
  return url.href;
}
function validatePointsUrl(value) {
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    !(
      url.hostname.endsWith(".api.powerplatform.com") ||
      url.hostname.endsWith(".logic.azure.com")
    )
  ) {
    throw new Error(
      "Power Automate HTTPS 트리거 주소(*.api.powerplatform.com 또는 *.logic.azure.com)를 입력해주세요.",
    );
  }
  return url.href;
}
// 연습 문제는 난이도와 상관없이 정해진 점수를 받고, 핵심·시험 문제는 난이도에 따라 받습니다.
function pointsFor(problem) {
  if (problem.kind === "practice") return PRACTICE_POINTS;
  return POINTS_BY_LEVEL[problem.level] || 0;
}
function awardKey(student, problemId) {
  return JSON.stringify([student.school, student.studentId, problemId]);
}
function readCookie(cookies, name) {
  const part = cookies
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(name + "="));
  if (!part) return "";
  try {
    return decodeURIComponent(part.slice(name.length + 1));
  } catch {
    return "";
  }
}
// 로그인 때 저장한 쿠키(school, studentId, studentName)를 사용합니다. 이름 쿠키가 없는 이전 로그인은 /api/session으로 보완합니다.
async function loadStudent(fetchImpl, cookies) {
  const school = readCookie(cookies, "school");
  const studentId = readCookie(cookies, "studentId");
  let studentName = readCookie(cookies, "studentName");
  if (!studentName) {
    const response = await fetchImpl("/api/session", {
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => null);
    const body =
      response && response.ok
        ? await response.json().catch(() => null)
        : null;
    if (
      body &&
      body.authenticated === true &&
      body.school === school &&
      typeof body.name === "string"
    ) {
      studentName = body.name;
    }
  }
  if (
    !school ||
    !/^[0-9]{1,32}$/.test(studentId) ||
    studentName.length > 100 ||
    !/^\p{L}[\p{L}\p{M}]*$/u.test(studentName)
  ) {
    throw new Error(
      "로그인한 학생 정보를 확인할 수 없어요. 로그아웃 후 다시 로그인해주세요.",
    );
  }
  return { school, studentId, studentName };
}
const LOGIN_COOKIES = ["school", "studentId", "studentName"];
// 서버 세션이 있으면 끝내고(없거나 정적 배포라 실패해도 계속), 로그인 쿠키를 지웁니다.
async function endSession({ fetchImpl, setCookie, cookiePath }) {
  try {
    await fetchImpl("./api/session/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* 서버 응답이 없어도 이 브라우저의 로그인 정보는 지웁니다. */
  }
  for (const name of LOGIN_COOKIES) {
    setCookie(`${name}=; Max-Age=0; Path=${cookiePath}; SameSite=Lax`);
  }
}
// 흐름은 { updated: true, points: <새 누적 점수> }를 반환합니다. 학생을 찾지 못하면 404입니다.
async function requestPoints({
  url,
  student,
  problemId,
  points,
  fetchImpl,
  timeoutMs = 15000,
}) {
  const response = await fetchImpl(validatePointsUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      school: student.school,
      studentId: student.studentId,
      studentName: student.studentName,
      problemId,
      points,
    }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 404)
    throw new Error(
      "활성 학생 기록을 찾을 수 없어요. 학교·학번·이름을 확인해주세요.",
    );
  if (!response.ok)
    throw new Error(
      "포인트 적립 흐름 실행에 실패했어요. (" + response.status + ")",
    );
  const result = await response.json().catch(() => null);
  if (
    !result ||
    result.updated !== true ||
    !Number.isSafeInteger(result.points) ||
    result.points < 0
  ) {
    throw new Error("포인트 적립 응답 형식이 올바르지 않아요.");
  }
  return { points: result.points, awarded: result.awarded !== false };
}

// ---- 저장된 학습 상태 -------------------------------------------------------
const isRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
function initialState() {
  return {
    selected: PROBLEMS[0].id,
    codes: {},
    coachUrl: DEFAULT_COACH_URL,
    pointsUrl: "",
    awarded: [],
    ...PcoProgress.freshProgress(),
  };
}
// 문제 id를 키로 쓰는 기록입니다. 더는 없는 문제의 기록은 조용히 버리고, 형식이 틀리면 저장 데이터가 깨진 것으로 봅니다.
function readMap(value, name, valid) {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error(`저장된 ${name} 형식이 올바르지 않아요.`);
  const result = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!PROBLEM_BY_ID.has(id)) continue;
    if (!valid(entry)) throw new Error(`저장된 ${name} 형식이 올바르지 않아요.`);
    result[id] = entry;
  }
  return result;
}
function readSolvedEntry(entry) {
  return (
    isRecord(entry) &&
    typeof entry.clean === "boolean" &&
    typeof entry.first === "boolean" &&
    typeof entry.peek === "boolean" &&
    typeof entry.coach === "boolean" &&
    isCount(entry.hints) &&
    isCount(entry.tries) &&
    isCount(entry.points)
  );
}
function readProgress(parsed) {
  const fresh = PcoProgress.freshProgress();
  const count = (name) => {
    if (parsed[name] === undefined) return fresh[name];
    if (!isCount(parsed[name])) throw new Error(`저장된 ${name} 값이 올바르지 않아요.`);
    return parsed[name];
  };
  let passed = {};
  if (parsed.passed !== undefined) {
    if (!isRecord(parsed.passed)) throw new Error("저장된 승급 기록이 올바르지 않아요.");
    for (const [level, how] of Object.entries(parsed.passed)) {
      if (!PcoProgress.HOW.includes(how)) throw new Error("저장된 승급 기록이 올바르지 않아요.");
      if (/^[1-9]\d*$/.test(level) && Number(level) <= MODEL.levelCount) passed[Number(level)] = how;
    }
  }
  let daily = {};
  if (parsed.daily !== undefined) {
    if (!isRecord(parsed.daily)) throw new Error("저장된 오늘의 학습 기록이 올바르지 않아요.");
    for (const [day, points] of Object.entries(parsed.daily)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isCount(points)) throw new Error("저장된 오늘의 학습 기록이 올바르지 않아요.");
      daily[day] = points;
    }
  }
  const lastDay = parsed.lastDay === undefined ? "" : parsed.lastDay;
  if (typeof lastDay !== "string" || (lastDay && !/^\d{4}-\d{2}-\d{2}$/.test(lastDay)))
    throw new Error("저장된 학습 날짜가 올바르지 않아요.");
  if (parsed.placementDone !== undefined && typeof parsed.placementDone !== "boolean")
    throw new Error("저장된 진단평가 기록이 올바르지 않아요.");
  return {
    solved: readMap(parsed.solved, "해결 기록", readSolvedEntry),
    passed,
    hintsUsed: readMap(parsed.hintsUsed, "힌트 기록", isCount),
    peeked: readMap(parsed.peeked, "예시 정답 기록", (entry) => entry === true),
    coachUsed: readMap(parsed.coachUsed, "코치 기록", (entry) => entry === true),
    tries: readMap(parsed.tries, "시도 기록", isCount),
    mistakes: readMap(
      parsed.mistakes,
      "실수 노트",
      (entry) =>
        isRecord(entry) &&
        typeof entry.reason === "string" &&
        typeof entry.coach === "boolean" &&
        (entry.resolved === undefined || typeof entry.resolved === "boolean"),
    ),
    gems: count("gems"),
    streak: count("streak"),
    lastDay,
    freeze: count("freeze"),
    combo: count("combo"),
    daily,
    placementDone: parsed.placementDone === true,
  };
}
// 이전 화면의 코치·포인트 주소만 새 저장소로 옮깁니다. 읽을 수 없는 값은 건너뛰고 오류로 만들지 않습니다.
function readLegacySettings(storage, initial) {
  let raw = null;
  try {
    raw = storage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return { state: initial, warning: "" };
  }
  if (!raw) return { state: initial, warning: "" };
  const state = { ...initial };
  try {
    const old = JSON.parse(raw);
    if (isRecord(old)) {
      if (typeof old.coachUrl === "string") {
        try {
          state.coachUrl = LEGACY_COACH_URLS.includes(old.coachUrl)
            ? DEFAULT_COACH_URL
            : validateCoachUrl(old.coachUrl);
        } catch {
          /* 잘못된 주소는 기본 코치를 씁니다. */
        }
      }
      if (typeof old.pointsUrl === "string" && old.pointsUrl) {
        try {
          state.pointsUrl = validatePointsUrl(old.pointsUrl);
        } catch {
          /* 허용되지 않는 포인트 주소는 가져오지 않습니다. */
        }
      }
    }
  } catch {
    return { state: initial, warning: "" };
  }
  return {
    state,
    warning: "",
    notice:
      "학습 방식이 레벨 로드맵으로 바뀌었어요. 이전 기록은 옮기지 못했지만 진단평가로 내 레벨을 찾을 수 있어요.",
  };
}
function readStudioState(storage) {
  const initial = initialState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return readLegacySettings(storage, initial);
    const parsed = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      !isRecord(parsed.codes) ||
      typeof parsed.coachUrl !== "string" ||
      typeof parsed.selected !== "string"
    )
      throw new Error("저장 형식이 올바르지 않아요.");
    const codes = {};
    for (const [id, code] of Object.entries(parsed.codes)) {
      if (typeof code !== "string") throw new Error("저장된 코드 형식이 올바르지 않아요.");
      if (PROBLEM_BY_ID.has(id)) codes[id] = code;
    }
    const pointsUrl =
      typeof parsed.pointsUrl === "string" && parsed.pointsUrl
        ? validatePointsUrl(parsed.pointsUrl)
        : "";
    const awarded = Array.isArray(parsed.awarded)
      ? [...new Set(parsed.awarded.filter((key) => typeof key === "string"))]
      : [];
    return {
      state: {
        selected: PROBLEM_BY_ID.has(parsed.selected) ? parsed.selected : initial.selected,
        codes,
        coachUrl: LEGACY_COACH_URLS.includes(parsed.coachUrl)
          ? DEFAULT_COACH_URL
          : validateCoachUrl(parsed.coachUrl),
        pointsUrl,
        awarded,
        ...readProgress(parsed),
      },
      warning: "",
    };
  } catch (error) {
    return {
      state: initial,
      warning:
        "이전 학습 기록을 읽을 수 없어 임시 모드로 시작했어요. 기존 저장 데이터는 덮어쓰지 않습니다. " +
        error.message,
    };
  }
}
function browserStorage() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
// 내 학습 현황의 추천 링크(new.html?problem=문제ID)로 열면 저장된 문제 대신 그 문제를 보여줍니다.
function requestedProblemId(search) {
  const requested = new URLSearchParams(search).get("problem");
  return requested && PROBLEM_BY_ID.has(requested) ? requested : "";
}
// 화면 라이브러리를 내려받는 동안 미리 받아 둘 문제입니다: 링크가 가리키는 문제, 없으면 지금 풀 문제입니다.
function startupProblemId(search, storage = browserStorage()) {
  const requested = requestedProblemId(search);
  if (requested) return requested;
  if (!storage) return PROBLEMS[0].id;
  const { state } = readStudioState(storage);
  const next = MODEL.nextStep(state, MODEL.currentLevel(state));
  return next.id && next.kind !== "exam" ? next.id : state.selected;
}

// ---- 문제 본문 ----------------------------------------------------------------
const isText = (value) => typeof value === "string";
function isTest(test) {
  return Boolean(
    test &&
      isText(test.input) &&
      isText(test.output) &&
      (test.files === undefined ||
        (isRecord(test.files) && Object.values(test.files).every(isText))),
  );
}
function problemDetailUrl(problem) {
  const step = problem.trackId.slice(1).padStart(2, "0");
  return `./curriculum/step-${step}/${problem.id}.json`;
}
function parseProblemDetail(problem, data) {
  if (
    !isRecord(data) ||
    data.id !== problem.id ||
    !isText(data.description) ||
    !data.description.trim() ||
    !["input", "output", "starter", "solution", "explanation"].every((key) => isText(data[key])) ||
    !Array.isArray(data.hints) ||
    !data.hints.every((hint) => isText(hint) && hint.trim()) ||
    !Array.isArray(data.tests) ||
    data.tests.length === 0 ||
    !data.tests.every(isTest) ||
    (data.link !== undefined &&
      !(isRecord(data.link) && isText(data.link.url) && isText(data.link.label)))
  )
    throw new Error("문제 파일의 형식이 올바르지 않아요: " + problem.id);
  return {
    description: data.description,
    input: data.input,
    output: data.output,
    starter: data.starter,
    // 예시 정답은 틀린 뒤 코치와 이야기해 본 다음에만 화면에 보여줍니다(PcoProgress.helpStatus).
    solution: data.solution,
    hints: data.hints,
    explanation: data.explanation,
    tests: data.tests.map((test) => ({
      input: test.input,
      output: test.output,
      ...(test.files ? { files: test.files } : {}),
    })),
    ...(data.link ? { link: { url: data.link.url, label: data.link.label } } : {}),
  };
}
const problemLoads = new Map();
// 문제 본문은 처음 열 때 한 번만 불러옵니다. 실패하면 다음에 다시 시도합니다.
function loadProblem(id, fetchImpl = fetch) {
  const problem = PROBLEM_BY_ID.get(id);
  if (!problem) return Promise.reject(new Error("알 수 없는 문제예요: " + id));
  if (problem.tests) return Promise.resolve(problem);
  if (!problemLoads.has(id)) {
    problemLoads.set(
      id,
      fetchImpl(problemDetailUrl(problem))
        .then((response) => {
          if (!response.ok)
            throw new Error(
              "문제를 불러오지 못했어요. (" + response.status + ")",
            );
          return response.json();
        })
        .then((data) =>
          Object.assign(problem, parseProblemDetail(problem, data)),
        )
        .finally(() => problemLoads.delete(id)),
    );
  }
  return problemLoads.get(id);
}
// 승급 시험 문제처럼 여러 문제를 한꺼번에 준비해야 할 때 씁니다.
function loadProblems(ids, fetchImpl = fetch) {
  return Promise.all(ids.map((id) => loadProblem(id, fetchImpl)));
}

// ---- 진단평가 문항 ------------------------------------------------------------
function parsePlacement(data) {
  const valid =
    isRecord(data) &&
    Array.isArray(data.items) &&
    data.items.length > 0 &&
    data.items.every(
      (item) =>
        isRecord(item) &&
        isText(item.id) &&
        Number.isInteger(item.level) &&
        item.level >= 1 &&
        item.level <= MODEL.levelCount &&
        isText(item.question) &&
        (item.code === undefined || item.code === null || isText(item.code)) &&
        (item.files === undefined || (isRecord(item.files) && Object.values(item.files).every(isText))) &&
        Array.isArray(item.choices) &&
        item.choices.length >= 2 &&
        item.choices.every(isText) &&
        Number.isInteger(item.answer) &&
        item.answer >= 0 &&
        item.answer < item.choices.length &&
        isText(item.explanation),
    );
  if (!valid) throw new Error("진단평가 파일의 형식이 올바르지 않아요.");
  const byLevel = {};
  for (const item of data.items) (byLevel[item.level] ||= []).push(item);
  return byLevel;
}
let placementLoad = null;
// 진단평가 문항은 처음 시작할 때 한 번만 불러옵니다. 실패하면 다음에 다시 시도합니다.
function loadPlacement(fetchImpl = fetch) {
  placementLoad ||= fetchImpl("./curriculum/placement.json")
    .then((response) => {
      if (!response.ok)
        throw new Error("진단평가 문항을 불러오지 못했어요. (" + response.status + ")");
      return response.json();
    })
    .then(parsePlacement)
    .catch((error) => {
      placementLoad = null;
      throw error;
    });
  return placementLoad;
}
// 한 번의 진단평가에서는 레벨마다 문항을 섞어 보여주되, 같은 레벨 안의 문항은 겹치지 않습니다.
function shuffled(list, random = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---- 코치에게 전할 질문 -------------------------------------------------------
// 외부 코치에는 문제·내 코드·오류·시도 정보만 붙여넣습니다. 이름·학번 같은 개인정보는 넣지 않습니다.
function buildCoachPrompt({ question, problem, levelLabel, code, error, failures, hintsUsed }) {
  const parts = [
    `[${levelLabel} · ${problem.title}]`,
    `이 학생은 ${levelLabel} 단계예요. 이 단계에서 배운 개념 안에서만 설명해주세요.`,
    problem.description,
  ];
  if (problem.input) parts.push(`입력: ${problem.input}`);
  if (problem.output) parts.push(`출력: ${problem.output}`);
  parts.push("", question);
  const status = [];
  if (failures > 0) status.push(`${failures}번 틀림`);
  if (hintsUsed > 0) status.push(`힌트 ${hintsUsed}개 사용`);
  if (status.length) parts.push(`지금까지: ${status.join(" · ")}`);
  if (error) parts.push(`오류 메시지: ${error}`);
  parts.push("", "현재 코드:", "```python", code, "```");
  return parts.join("\n");
}
