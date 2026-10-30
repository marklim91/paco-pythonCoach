const MAX_ROWS = 100000;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const GUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

class DashboardError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function flowEndpoint(value) {
  if (!value) {
    throw new DashboardError(503, 'DASHBOARD_NOT_CONFIGURED',
      'Dataverse 조회 흐름이 아직 연결되지 않았습니다. 서버의 POWER_AUTOMATE_DASHBOARD_URL을 설정해 주세요.');
  }
  let url;
  try { url = new URL(value); } catch {
    throw new DashboardError(503, 'INVALID_DASHBOARD_URL', '대시보드 조회 흐름 URL 설정을 확인해 주세요.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      !(url.hostname.endsWith('.api.powerplatform.com') || url.hostname.endsWith('.logic.azure.com'))) {
    throw new DashboardError(503, 'INVALID_DASHBOARD_URL', '대시보드 조회 흐름 URL 설정을 확인해 주세요.');
  }
  return url.href;
}

function invalidResponse() {
  return new DashboardError(502, 'INVALID_DASHBOARD_RESPONSE',
    'Dataverse 응답 형식이 올바르지 않습니다. 필수 열, 값 형식과 modifiedon을 확인해 주세요.');
}

function latestStudents(body) {
  if (!body || !Array.isArray(body.value)) throw invalidResponse();
  if (body['@odata.nextLink'] || body['@Microsoft.Dynamics.CRM.totalrecordcountlimitexceeded'] === true ||
      body.value.length >= MAX_ROWS) {
    throw new DashboardError(502, 'INCOMPLETE_DASHBOARD_DATA',
      '일부 학습 기록만 반환되었습니다. 조회 흐름의 페이지 매김과 전체 행 수를 확인해 주세요.');
  }
  const latest = new Map();
  for (const row of body.value) {
    if (!row || typeof row !== 'object' ||
        typeof row.crbf2_schoolname !== 'string' || !row.crbf2_schoolname.trim() ||
        row.crbf2_schoolname.length > 120 ||
        typeof row.crbf2_studentnumber !== 'string' || !/^[0-9]{1,32}$/.test(row.crbf2_studentnumber) ||
        typeof row.crbf2_studentlearningrecordid !== 'string' || !GUID.test(row.crbf2_studentlearningrecordid) ||
        typeof row.crbf2_isactive !== 'boolean' ||
        !Number.isSafeInteger(row.crbf2_learningpoints) || row.crbf2_learningpoints < 0 ||
        !Number.isSafeInteger(row.crbf2_currentlevel) || row.crbf2_currentlevel < 0 ||
        typeof row.modifiedon !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(row.modifiedon) ||
        !Number.isFinite(Date.parse(row.modifiedon))) throw invalidResponse();
    if (typeof row.crbf2_studentname !== 'string' || !row.crbf2_studentname.trim() ||
        row.crbf2_studentname.length > 100) {
      throw new DashboardError(502, 'STUDENT_NAME_REQUIRED',
        '학생 이름이 없습니다. Power Automate 행 나열의 열 선택에 crbf2_studentname을 추가하고 이름 값을 확인해 주세요.');
    }
    const student = {
      school: row.crbf2_schoolname, studentId: row.crbf2_studentnumber,
      name: row.crbf2_studentname.trim(),
      points: row.crbf2_learningpoints, level: row.crbf2_currentlevel,
      active: row.crbf2_isactive, modifiedAt: row.modifiedon,
      recordId: row.crbf2_studentlearningrecordid,
    };
    const key = JSON.stringify([student.school, student.studentId]);
    const previous = latest.get(key);
    if (previous && Date.parse(previous.modifiedAt) === Date.parse(student.modifiedAt) &&
        (previous.points !== student.points || previous.level !== student.level ||
          previous.active !== student.active || previous.name !== student.name)) {
      throw new DashboardError(502, 'AMBIGUOUS_STUDENT_RECORD',
        '동일 학생의 최신 기록을 구분할 수 없습니다. 중복 레코드의 modifiedon과 누적 점수 구조를 확인해 주세요.');
    }
    if (!previous || Date.parse(student.modifiedAt) > Date.parse(previous.modifiedAt)) latest.set(key, student);
  }
  return [...latest.values()].filter(s => s.active);
}

function rankStudents(students, store, school = '') {
  const histories = store.histories();
  const rows = students.filter(s => !school || s.school === school).map(s => {
    const id = store.studentKey(s.school, s.studentId);
    const history = histories.get(id) || [];
    return {
      ...store.publicStudent(id, s.school, s.name), points: s.points, level: s.level,
      modifiedAt: s.modifiedAt, history,
      observedGrowth: history.length > 1 ? s.points - history[0].points : null,
    };
  }).sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
  let rank = 0;
  return rows.map((row, i) => {
    if (i === 0 || row.points !== rows[i - 1].points) rank = i + 1;
    return { ...row, rank };
  });
}

async function readBoundedJson(response) {
  if (!response.body) throw invalidResponse();
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new DashboardError(502, 'DASHBOARD_RESPONSE_TOO_LARGE', '조회 데이터가 처리 한도를 초과했습니다.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw invalidResponse();
  }
}

function createDashboardHandlers({
  store, flowUrl = process.env.POWER_AUTOMATE_DASHBOARD_URL,
  fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 15000,
  cacheMs = 60000, logger = console,
}) {
  let cached;
  let pending;

  async function load() {
    if (cached && now() - cached.at < cacheMs) return cached;
    if (pending) return pending;
    pending = (async () => {
      const students = await fetchDashboardStudents({ flowUrl, fetchImpl, timeoutMs });
      store.observe(students);
      cached = { at: now(), students };
      return cached;
    })();
    try { return await pending; } finally { pending = undefined; }
  }

  function json(res, status, body) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(body));
  }

  function sameOrigin(req) {
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    if (!req.headers.origin) return true;
    try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
  }

  return async function handleDashboard(req, res, url) {
    try {
      const mutation = url.pathname === '/api/session/heartbeat' || url.pathname === '/api/session/logout';
      const method = mutation ? 'POST' : 'GET';
      if (req.method !== method) {
        res.setHeader('Allow', method);
        throw new DashboardError(405, 'METHOD_NOT_ALLOWED', `${method} 요청만 지원합니다.`);
      }
      if (mutation && !sameOrigin(req)) throw new DashboardError(403, 'ORIGIN_NOT_ALLOWED', '같은 사이트에서만 요청할 수 있습니다.');
      if (url.pathname === '/api/session') {
        const session = store.sessionFor(req);
        json(res, 200, session ? {
          authenticated: true, ...store.publicStudent(session.key, session.school),
          expiresAt: new Date(session.expiresAt).toISOString(),
        } : { authenticated: false });
      } else if (url.pathname === '/api/session/heartbeat') {
        if (!store.heartbeat(req)) throw new DashboardError(401, 'SESSION_REQUIRED', '접속 현황에 참여하려면 다시 로그인해 주세요.');
        json(res, 200, { recorded: true });
      } else if (url.pathname === '/api/session/logout') {
        store.logout(req, res);
        json(res, 200, { loggedOut: true });
      } else if (url.pathname === '/api/presence') {
        json(res, 200, store.presence());
      } else if (url.pathname === '/api/me/learning') {
        const session = store.sessionFor(req);
        if (!session) throw new DashboardError(401, 'SESSION_REQUIRED', '내 학습 현황을 보려면 로그인 / 재검증을 진행해 주세요.');
        if (url.search) throw new DashboardError(400, 'PERSONAL_QUERY_NOT_ALLOWED', '내 학습 현황은 로그인 세션으로만 조회합니다. 학생 선택값을 전달하지 마세요.');
        const data = await load();
        if (store.sessionFor(req)?.hash !== session.hash) {
          throw new DashboardError(401, 'SESSION_REQUIRED', '로그인 세션이 만료되거나 변경되었습니다. 다시 로그인해 주세요.');
        }
        const rankings = rankStudents(data.students, store);
        const student = rankings.find(entry => entry.id === session.key);
        if (!student) {
          throw new DashboardError(404, 'LEARNING_RECORD_NOT_FOUND',
            '현재 로그인 학생의 활성 학습 기록을 찾을 수 없습니다. 학생 정보와 실제 활성 여부를 확인해 주세요.');
        }
        const schoolStudents = rankings.filter(entry => entry.school === student.school);
        json(res, 200, {
          collectedAt: new Date(data.at).toISOString(), student,
          ranking: {
            overall: student.rank, overallStudents: rankings.length,
            school: schoolStudents.filter(entry => entry.points > student.points).length + 1,
            schoolStudents: schoolStudents.length,
          },
          guide: getLearningGuide(student.level),
          historyNote: '이 서버가 수집한 최근 90일 점수 관측값입니다. 최초 수집 이전의 성장이나 실제 학습 횟수는 포함하지 않습니다.',
        });
      } else {
        const school = url.searchParams.get('school') || '';
        if (school.length > 120) throw new DashboardError(400, 'INVALID_SCHOOL', '학교 선택값이 올바르지 않습니다.');
        const data = await load();
        const schools = [...new Set(data.students.map(s => s.school))].sort();
        if (school && !schools.includes(school)) throw new DashboardError(400, 'INVALID_SCHOOL', '조회 결과에 없는 학교입니다.');
        const students = rankStudents(data.students, store, school);
        const total = students.reduce((sum, s) => sum + s.points, 0);
        if (!Number.isSafeInteger(total)) throw invalidResponse();
        json(res, 200, {
          collectedAt: new Date(data.at).toISOString(), refreshIntervalSeconds: cacheMs / 1000,
          schools, selectedSchool: school, students,
          summary: {
            students: students.length, totalPoints: total,
            averageLevel: students.length ? students.reduce((sum, s) => sum + s.level, 0) / students.length : null,
            growingStudents: students.filter(s => s.observedGrowth !== null && s.observedGrowth > 0).length,
          },
          historyNote: '이 서버가 수집한 최근 90일 점수 관측값입니다. Dataverse의 과거 학습 이력을 복원한 값이 아닙니다.',
        });
      }
    } catch (error) {
      const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
      const status = error instanceof DashboardError ? error.status : timeout ? 504 : 502;
      const code = error instanceof DashboardError ? error.code : timeout ? 'DASHBOARD_TIMEOUT' : 'DASHBOARD_REQUEST_FAILED';
      if (status >= 500) logger.error('[dashboard-api]', code);
      json(res, status, {
        code, message: error instanceof DashboardError ? error.message :
          timeout ? '조회 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.' :
            '대시보드 데이터를 처리할 수 없습니다. 서버 연결과 저장소 상태를 확인해 주세요.',
      });
    }
  };
}

async function fetchDashboardStudents({ flowUrl, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  const response = await fetchImpl(flowEndpoint(flowUrl), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: '{}', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new DashboardError(502, 'DASHBOARD_FLOW_HTTP_ERROR', 'Dataverse 조회 흐름 실행에 실패했습니다.');
  }
  return latestStudents(await readBoundedJson(response));
}

module.exports = { createDashboardHandlers, latestStudents, rankStudents, fetchDashboardStudents };
const { getLearningGuide } = require('./learning-guide');
