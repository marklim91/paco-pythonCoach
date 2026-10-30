const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DAY = 86400000;
const SESSION_MS = 12 * 60 * 60 * 1000;
const ACTIVE_MS = 5 * 60 * 1000;
const COOKIE = 'pco_session';

function createDashboardStore({ filePath, now = Date.now } = {}) {
  let state;
  if (filePath && fs.existsSync(filePath)) {
    state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (state.version !== 1 || typeof state.secret !== 'string' ||
        !/^[a-f0-9]{64}$/.test(state.secret) || !Array.isArray(state.sessions) ||
        !Array.isArray(state.logins) || !Array.isArray(state.snapshots) ||
        !Number.isFinite(state.startedAt)) {
      throw new Error('Invalid dashboard state. Restore the dashboard data file from backup.');
    }
  } else {
    state = {
      version: 1, secret: crypto.randomBytes(32).toString('hex'),
      startedAt: now(), sessions: [], logins: [], snapshots: [],
    };
  }

  function commit(next) {
    if (filePath) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const temporary = filePath + '.tmp';
      fs.writeFileSync(temporary, JSON.stringify(next), { mode: 0o600 });
      fs.renameSync(temporary, filePath);
    }
    state = next;
  }

  function prune(next) {
    const time = now();
    next.sessions = next.sessions.filter(s => s.expiresAt > time);
    next.logins = next.logins.filter(s => s.lastLoginAt > time - 30 * DAY);
    next.snapshots = next.snapshots.filter(s => s.observedAt > time - 90 * DAY);
  }

  function studentKey(school, studentId) {
    return crypto.createHmac('sha256', state.secret)
      .update(JSON.stringify([school, studentId])).digest('hex').slice(0, 24);
  }

  function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  function sessionFor(req) {
    const cookie = (req.headers.cookie || '').split(';')
      .map(value => value.trim()).find(value => value.startsWith(COOKIE + '='));
    if (!cookie) return undefined;
    const token = cookie.slice(COOKIE.length + 1);
    if (!/^[a-f0-9]{64}$/.test(token)) return undefined;
    const hash = hashToken(token);
    return state.sessions.find(s => s.hash === hash && s.expiresAt > now());
  }

  function setCookie(req, res, token, expired = false) {
    const secure = req.socket.encrypted || process.env.SESSION_COOKIE_SECURE === 'true';
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax` +
      (expired ? '; Max-Age=0' : '') + (secure ? '; Secure' : ''));
  }

  function login(student, req, res) {
    const next = structuredClone(state);
    prune(next);
    const time = now();
    const key = studentKey(student.school, student.studentId);
    const token = crypto.randomBytes(32).toString('hex');
    const previous = sessionFor(req);
    if (previous) next.sessions = next.sessions.filter(s => s.hash !== previous.hash);
    if (next.sessions.length >= 100000) throw new Error('Dashboard session capacity exceeded.');
    next.sessions.push({
      hash: hashToken(token), key, school: student.school,
      expiresAt: time + SESSION_MS, lastSeenAt: time,
    });
    const entry = next.logins.find(s => s.key === key);
    if (entry) {
      entry.lastLoginAt = time;
      entry.name = student.studentName;
    } else {
      next.logins.push({ key, school: student.school, name: student.studentName, lastLoginAt: time });
    }
    commit(next);
    setCookie(req, res, token);
  }

  function heartbeat(req) {
    const session = sessionFor(req);
    if (!session) return false;
    const next = structuredClone(state);
    prune(next);
    next.sessions.find(s => s.hash === session.hash).lastSeenAt = now();
    commit(next);
    return true;
  }

  function logout(req, res) {
    const session = sessionFor(req);
    if (session) {
      const next = structuredClone(state);
      next.sessions = next.sessions.filter(s => s.hash !== session.hash);
      prune(next);
      commit(next);
    }
    setCookie(req, res, '', true);
  }

  function publicStudent(key, school, name) {
    if (name === undefined) name = state.logins.find(entry => entry.key === key)?.name;
    return { id: key, alias: '학습자-' + key.slice(0, 8).toUpperCase(), school, name: name ?? null };
  }

  function presence() {
    const time = now();
    const active = new Set(state.sessions
      .filter(s => s.expiresAt > time && s.lastSeenAt > time - ACTIVE_MS)
      .map(s => s.key));
    const logins = state.logins.filter(s => s.lastLoginAt > time - 30 * DAY);
    return {
      trackingStartedAt: new Date(state.startedAt).toISOString(),
      generatedAt: new Date(time).toISOString(),
      activeWindowMinutes: ACTIVE_MS / 60000,
      activeUsers: active.size,
      recentLoginUsers: logins.length,
      recentLogins: logins.slice().sort((a, b) => b.lastLoginAt - a.lastLoginAt)
        .slice(0, 20).map(s => ({
          ...publicStudent(s.key, s.school, s.name ?? null),
          lastLoginAt: new Date(s.lastLoginAt).toISOString(), active: active.has(s.key),
        })),
    };
  }

  function observe(students) {
    const next = structuredClone(state);
    prune(next);
    const time = now();
    const date = new Date(time).toISOString().slice(0, 10);
    const index = new Map(next.snapshots.map(s => [s.key + s.date, s]));
    const logins = new Map(next.logins.map(entry => [entry.key, entry]));
    for (const student of students) {
      const key = studentKey(student.school, student.studentId);
      const login = logins.get(key);
      if (login) login.name = student.name;
      const existing = index.get(key + date);
      if (existing) {
        existing.observedAt = time;
        existing.points = student.points;
        existing.level = student.level;
      } else {
        next.snapshots.push({
          key, date, startedAt: time, startPoints: student.points, startLevel: student.level,
          observedAt: time, points: student.points, level: student.level,
        });
      }
    }
    commit(next);
  }

  function histories() {
    const result = new Map();
    const snapshots = state.snapshots.filter(s => s.observedAt > now() - 90 * DAY)
      .sort((a, b) => a.startedAt - b.startedAt);
    for (const snapshot of snapshots) {
      if (!result.has(snapshot.key)) result.set(snapshot.key, []);
      const values = result.get(snapshot.key);
      values.push({
        at: new Date(snapshot.startedAt).toISOString(), points: snapshot.startPoints, level: snapshot.startLevel,
      });
      if (snapshot.observedAt !== snapshot.startedAt &&
          (snapshot.points !== snapshot.startPoints || snapshot.level !== snapshot.startLevel)) {
        values.push({
          at: new Date(snapshot.observedAt).toISOString(), points: snapshot.points, level: snapshot.level,
        });
      }
    }
    return result;
  }

  if (filePath && !fs.existsSync(filePath)) commit(state);
  return {
    studentKey, publicStudent, login, sessionFor, heartbeat, logout, presence, observe,
    histories, history: key => histories().get(key) || [],
  };
}

module.exports = { createDashboardStore };
