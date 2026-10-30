const SCHOOLS = [
  "현풍중학교",
  "경북여자고등학교",
  "함양여자중학교",
  "도원중학교",
];
const MAX_BODY_BYTES = 4096;

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let oversized = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        oversized = true;
        chunks.length = 0;
        reject(
          new ApiError(413, "BODY_TOO_LARGE", "입력 데이터가 너무 큽니다."),
        );
      } else if (!oversized) {
        chunks.push(chunk);
      }
    });
    req.on("end", () => {
      if (oversized) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(
          new ApiError(400, "INVALID_JSON", "올바른 JSON 요청이 필요합니다."),
        );
      }
    });
    req.on("error", reject);
  });
}

function getFlowUrl(value) {
  if (!value) {
    throw new ApiError(
      503,
      "FLOW_NOT_CONFIGURED",
      "학생 검증 서비스가 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.",
    );
  }
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new ApiError(
      503,
      "INVALID_FLOW_URL",
      "학생 검증 서비스의 서버 설정을 확인해 주세요.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    !(
      url.hostname.endsWith(".logic.azure.com") ||
      url.hostname.endsWith(".api.powerplatform.com")
    )
  ) {
    throw new ApiError(
      503,
      "INVALID_FLOW_URL",
      "학생 검증 서비스의 서버 설정을 확인해 주세요.",
    );
  }
  return url.href;
}

function createLoginHandler({
  flowUrl = process.env.POWER_AUTOMATE_LOGIN_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000,
  logger = console,
  onVerified = () => {},
} = {}) {
  return async function handleLogin(req, res) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        throw new ApiError(
          405,
          "METHOD_NOT_ALLOWED",
          "POST 요청만 지원합니다.",
        );
      }
      if (
        (req.headers["content-type"] || "")
          .split(";")[0]
          .trim()
          .toLowerCase() !== "application/json"
      ) {
        throw new ApiError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Content-Type을 application/json으로 설정해 주세요.",
        );
      }
      const body = await readJson(req);
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        !SCHOOLS.includes(body.school) ||
        typeof body.studentId !== "string" ||
        !/^[0-9]{1,32}$/.test(body.studentId) ||
        typeof body.studentName !== "string" ||
        body.studentName.length > 100 ||
        !/^\p{L}[\p{L}\p{M}]*$/u.test(body.studentName)
      ) {
        throw new ApiError(
          400,
          "INVALID_STUDENT",
          "학교, 숫자로 된 학번, 문자로 된 이름을 모두 입력해 주세요.",
        );
      }

      const url = getFlowUrl(flowUrl);
      const upstream = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          school: body.school,
          studentId: body.studentId,
          studentName: body.studentName,
        }),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      });
      if (!upstream.ok) {
        throw new ApiError(
          502,
          "FLOW_HTTP_ERROR",
          "학생 정보 확인 서비스에 오류가 발생했습니다. 관리자에게 문의해 주세요.",
        );
      }
      let result;
      try {
        result = await upstream.json();
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new ApiError(
          502,
          "INVALID_FLOW_RESPONSE",
          "데이터가 존재하지 않거나 Active한 사용자가 아닙니다.",
        );
      }
      if (!result || typeof result.verified !== "boolean") {
        throw new ApiError(
          502,
          "INVALID_FLOW_RESPONSE",
          "데이터가 존재하지 않거나 Active한 사용자가 아닙니다.",
        );
      }
      if (!result.verified) {
        throw new ApiError(
          401,
          "STUDENT_NOT_VERIFIED",
          "입력 정보가 일치하는 활성 학생을 찾을 수 없습니다. 학교, 학번, 이름을 확인해 주세요.",
        );
      }
      try {
        await onVerified({
          school: body.school, studentId: body.studentId, studentName: body.studentName,
        }, req, res);
      } catch (error) {
        throw new ApiError(
          503,
          "SESSION_STORE_FAILED",
          "로그인 세션을 저장할 수 없습니다. 관리자에게 서버 저장소 확인을 요청해 주세요.",
        );
      }
      res.writeHead(200);
      res.end(JSON.stringify({ verified: true }));
    } catch (error) {
      const timeout =
        error.name === "TimeoutError" || error.name === "AbortError";
      const status =
        error instanceof ApiError ? error.status : timeout ? 504 : 502;
      const code =
        error instanceof ApiError
          ? error.code
          : timeout
            ? "FLOW_TIMEOUT"
            : "FLOW_REQUEST_FAILED";
      const message =
        error instanceof ApiError
          ? error.message
          : timeout
            ? "학생 정보 확인 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
            : "학생 정보 확인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
      // Do not log errors containing the signed flow URL or student details.
      if (status >= 500) logger.error("[login-api]", code);
      res.writeHead(status);
      res.end(JSON.stringify({ verified: false, code, message }));
    }
  };
}

module.exports = { createLoginHandler };
