// 문제 목록(제목·난이도 등)은 studio-catalog.js에서 읽고, 문제 본문은 loadProblem이 선택한 문제만 불러와 합칩니다.
const TRACKS = PcoStudio.tracks.map((track) => ({
  ...track,
  problems: track.problems.map((problem) => ({ ...problem })),
}));
const PROBLEMS = TRACKS.flatMap((track) =>
  track.problems.map((problem) => ({ ...problem, trackId: track.id })),
);
const STORAGE_KEY = "paco-studio-v1";
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
function pointsFor(problem) {
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
// 연습 문제는 원래 문제 id 뒤에 -p1, -p2를 붙여 구분합니다. 문제 id는 영문 소문자·숫자·_만 써서 겹치지 않습니다.
function practiceId(problemId, index) {
  return `${problemId}-p${index + 1}`;
}
function isPracticeId(id) {
  const match = /^(.+)-p[1-9]\d*$/.exec(id);
  return Boolean(match && PROBLEMS.some((p) => p.id === match[1]));
}
function readStudioState(storage) {
  const initial = {
    selected: "hello",
    codes: {},
    completed: [],
    practiced: [],
    coachUrl: DEFAULT_COACH_URL,
    pointsUrl: "",
    awarded: [],
  };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: initial, warning: "" };
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      typeof parsed.codes !== "object" ||
      !parsed.codes ||
      Array.isArray(parsed.codes) ||
      !Array.isArray(parsed.completed) ||
      !PROBLEMS.some((p) => p.id === parsed.selected) ||
      typeof parsed.coachUrl !== "string"
    )
      throw new Error("저장 형식이 올바르지 않아요.");
    const codes = {};
    for (const [id, code] of Object.entries(parsed.codes)) {
      if (
        !(PROBLEMS.some((p) => p.id === id) || isPracticeId(id)) ||
        typeof code !== "string"
      )
        throw new Error("저장된 코드 형식이 올바르지 않아요.");
      codes[id] = code;
    }
    if (
      !parsed.completed.every((id) => PROBLEMS.some((p) => p.id === id))
    )
      throw new Error("저장된 진도가 올바르지 않아요.");
    const practiced = Array.isArray(parsed.practiced) ? parsed.practiced : [];
    if (!practiced.every((id) => typeof id === "string" && isPracticeId(id)))
      throw new Error("저장된 연습 기록이 올바르지 않아요.");
    const pointsUrl =
      typeof parsed.pointsUrl === "string" && parsed.pointsUrl
        ? validatePointsUrl(parsed.pointsUrl)
        : "";
    const awarded = Array.isArray(parsed.awarded)
      ? [
          ...new Set(
            parsed.awarded.filter((key) => typeof key === "string"),
          ),
        ]
      : [];
    return {
      state: {
        selected: parsed.selected,
        codes,
        completed: [...new Set(parsed.completed)],
        practiced: [...new Set(practiced)],
        coachUrl: LEGACY_COACH_URLS.includes(parsed.coachUrl)
          ? DEFAULT_COACH_URL
          : validateCoachUrl(parsed.coachUrl),
        pointsUrl,
        awarded,
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
function initialProblemId(saved, search) {
  const requested = new URLSearchParams(search).get("problem");
  return requested && PROBLEMS.some((p) => p.id === requested)
    ? requested
    : saved;
}
function startupProblemId(search, storage = browserStorage()) {
  return initialProblemId(readStudioState(storage).state.selected, search);
}
const PROBLEM_TEXT_KEYS = [
  "input",
  "output",
  "concept",
  "conceptCode",
  "starter",
];
const PROBLEM_LIST_KEYS = ["description", "constraints", "hints"];
// 힌트 탭에서 보여주는 '비슷한 예제'입니다. 문제의 정답 코드(solution)는 테스트 검증용이라 화면에 쓰지 않고 읽지도 않습니다.
const EXAMPLE_TEXT_KEYS = ["intro", "code", "input", "output"];
// 문제마다 둘 수 있는 점수 없는 '비슷한 연습 문제'입니다. 정답 코드(solution)는 역시 읽지 않습니다.
const PRACTICE_TEXT_KEYS = ["title", "input", "output", "starter"];
const PRACTICE_LIST_KEYS = ["description", "constraints", "hints"];
function isPractice(item) {
  const isText = (value) => typeof value === "string";
  return Boolean(
    item &&
      PRACTICE_TEXT_KEYS.every((key) => isText(item[key])) &&
      PRACTICE_LIST_KEYS.every(
        (key) =>
          Array.isArray(item[key]) &&
          item[key].length > 0 &&
          item[key].every(isText),
      ) &&
      Number.isFinite(item.minutes) &&
      Array.isArray(item.tests) &&
      item.tests.length > 0 &&
      item.tests.every(
        (test) => test && isText(test.input) && isText(test.output),
      ),
  );
}
function problemDetailUrl(problem) {
  const step = problem.trackId.slice(1).padStart(2, "0");
  return `./curriculum/step-${step}/${problem.id}.json`;
}
function parseProblemDetail(problem, data) {
  const isText = (value) => typeof value === "string";
  if (
    !data ||
    data.id !== problem.id ||
    !PROBLEM_TEXT_KEYS.every((key) => isText(data[key])) ||
    !PROBLEM_LIST_KEYS.every(
      (key) =>
        Array.isArray(data[key]) &&
        data[key].length > 0 &&
        data[key].every(isText),
    ) ||
    !data.example ||
    !EXAMPLE_TEXT_KEYS.every((key) => isText(data.example[key])) ||
    (data.practice !== undefined &&
      !(Array.isArray(data.practice) && data.practice.every(isPractice))) ||
    !Array.isArray(data.tests) ||
    data.tests.length === 0 ||
    !data.tests.every(
      (test) => test && isText(test.input) && isText(test.output),
    )
  )
    throw new Error("문제 파일의 형식이 올바르지 않아요: " + problem.id);
  return {
    ...Object.fromEntries(
      [...PROBLEM_TEXT_KEYS, ...PROBLEM_LIST_KEYS, "tests"].map((key) => [
        key,
        data[key],
      ]),
    ),
    example: Object.fromEntries(
      EXAMPLE_TEXT_KEYS.map((key) => [key, data.example[key]]),
    ),
    practice: (data.practice ?? []).map((item) =>
      Object.fromEntries(
        [
          ...PRACTICE_TEXT_KEYS,
          ...PRACTICE_LIST_KEYS,
          "minutes",
          "tests",
        ].map((key) => [key, item[key]]),
      ),
    ),
  };
}
// 연습 문제를 일반 문제처럼 화면·채점에 쓸 수 있는 모양으로 만듭니다. 난이도는 점수가 없는 '연습'이고, 개념 설명은 원래 문제의 것을 씁니다.
function practiceProblem(problem, index) {
  return {
    ...problem.practice[index],
    id: practiceId(problem.id, index),
    problemId: problem.id,
    isPractice: true,
    level: "연습",
    topic: problem.topic,
    concept: problem.concept,
    conceptCode: problem.conceptCode,
    trackId: problem.trackId,
  };
}
const problemLoads = new Map();
// 문제 본문(설명·테스트·힌트·비슷한 예제 등)은 처음 열 때 한 번만 불러옵니다. 실패하면 다음에 다시 시도합니다.
function loadProblem(id, fetchImpl = fetch) {
  const problem = PROBLEMS.find((p) => p.id === id);
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
