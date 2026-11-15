// 파코 스튜디오의 학습 기록(보석·진도·승급 등)을 서버(Power Automate → Dataverse)와 맞추는 규칙입니다.
// 화면·저장소·네트워크를 직접 알지 못하고 필요한 것은 모두 인자로 받으므로 Node 테스트에서 그대로 실행됩니다.
//
// 서버는 학생 행에 기록 전체를 문자열 하나(state)로 보관하고, 저장할 때마다 올라가는 번호(revision)로 충돌을 알려 줍니다.
// 다른 기기에서 먼저 저장했다면 서버 기록을 받아 내 기록과 합친 뒤(mergeProgress) 다시 저장합니다.
(function (root) {
  const P = typeof module === "object" && module.exports ? require("./studio-progress") : root.PcoProgress;
  const STATE_VERSION = 1;
  const TIMEOUT_MS = 15000;
  const DEBOUNCE_MS = 3000;
  const MAX_WAIT_MS = 20000;
  const RETRY_MS = [5000, 15000, 45000, 120000];
  const MAX_STATE_CHARS = 900000;
  const RECENT_ATTEMPTS = 3;
  const MAX_CONFLICTS = 3;
  const FIELDS = ["solved", "passed", "hintsUsed", "peeked", "coachUsed", "tries", "mistakes", "gems", "streak", "lastDay", "freeze", "combo", "daily", "placementDone"];

  const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const failure = (kind, message, cause) => Object.assign(new Error(message), { kind, cause });

  function pickProgress(state) {
    const progress = {};
    for (const name of FIELDS) progress[name] = state[name];
    return progress;
  }
  // 키 순서와 상관없이 같은 내용이면 같은 문자열이 되도록 만듭니다.
  function canonical(value) {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (isRecord(value)) {
      return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
    }
    return value === undefined ? "null" : JSON.stringify(value);
  }

  // ---- 두 기록 합치기 ------------------------------------------------------------
  function mergeMaps(local, remote, pick) {
    const merged = {};
    for (const id of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      if (id in local && id in remote) merged[id] = pick(local[id], remote[id]);
      else merged[id] = id in local ? local[id] : remote[id];
    }
    return merged;
  }
  const rankOf = (how) => (P.HOW.includes(how) ? P.HOW.indexOf(how) : P.HOW.length);
  // 푼 문제는 실수 노트에서 지우고, 코치와 이야기한 뒤 푼 문제만 '코치와 해결'로 남깁니다(PcoProgress.solve 와 같은 규칙).
  function mergeMistakes(local, remote, solved, coachUsed) {
    const merged = {};
    for (const id of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      const mine = local[id];
      const theirs = remote[id];
      let entry = mine || theirs;
      if (mine && theirs) entry = theirs.resolved ? theirs : mine.resolved ? mine : theirs.coach && !mine.coach ? theirs : mine;
      if (solved[id]) {
        if (!coachUsed[id]) continue;
        entry = { ...entry, coach: true, resolved: true };
      }
      merged[id] = entry;
    }
    return merged;
  }
  // local: 지금 화면의 기록, remote: 서버의 기록, base: 마지막으로 서버와 맞췄던 기록(없으면 처음 상태).
  // 해결·승급·쓴 힌트처럼 쌓이기만 하는 값은 합치고, 보석과 연속 학습 보호처럼 늘고 줄 수 있는 값은 내가 바꾼 만큼을 서버 값에 더합니다.
  function mergeProgress(local, remote, base) {
    // 두 기록이 이미 같으면 더할 것이 없습니다(기준이 낡았더라도 내가 바꾼 만큼을 또 더하지 않습니다).
    if (canonical(pickProgress(local)) === canonical(pickProgress(remote))) return pickProgress(remote);
    const origin = base || P.freshProgress();
    const solved = mergeMaps(local.solved, remote.solved, (mine, theirs) => (mine.points > theirs.points ? mine : theirs));
    const coachUsed = mergeMaps(local.coachUsed, remote.coachUsed, () => true);
    const newer = local.lastDay > remote.lastDay || (local.lastDay === remote.lastDay && local.streak >= remote.streak) ? local : remote;
    return {
      solved,
      passed: mergeMaps(local.passed, remote.passed, (mine, theirs) => (rankOf(mine) <= rankOf(theirs) ? mine : theirs)),
      hintsUsed: mergeMaps(local.hintsUsed, remote.hintsUsed, Math.max),
      peeked: mergeMaps(local.peeked, remote.peeked, () => true),
      coachUsed,
      tries: mergeMaps(local.tries, remote.tries, Math.max),
      mistakes: mergeMistakes(local.mistakes, remote.mistakes, solved, coachUsed),
      gems: Math.max(0, remote.gems + local.gems - origin.gems),
      streak: newer.streak,
      lastDay: newer.lastDay,
      freeze: Math.max(0, remote.freeze + local.freeze - origin.freeze),
      combo: local.combo,
      daily: mergeMaps(local.daily, remote.daily, Math.max),
      placementDone: local.placementDone || remote.placementDone,
    };
  }

  // ---- 서버와 주고받기 -----------------------------------------------------------
  // 서버에는 progress 의 모든 항목을 JSON 문자열 하나로 보냅니다. 흐름은 이 문자열을 해석하지 않고 그대로 보관합니다.
  const encodeState = (progress) => JSON.stringify({ v: STATE_VERSION, ...progress });
  function decodeState(text, readProgress) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      throw failure("corrupt", "서버에 저장된 학습 기록을 읽을 수 없어요.", error);
    }
    if (!isRecord(raw) || (raw.v !== undefined && !(Number.isInteger(raw.v) && raw.v <= STATE_VERSION))) {
      throw failure("corrupt", "서버에 저장된 학습 기록이 이 화면보다 새로운 형식이에요. 화면을 새로고침해 주세요.");
    }
    try {
      return pickProgress(readProgress(raw));
    } catch (error) {
      throw failure("corrupt", "서버에 저장된 학습 기록의 형식이 올바르지 않아요. " + error.message, error);
    }
  }

  // 상태: idle(시작 전) · loading · synced(서버와 같음) · pending(저장 예약) · saving · offline(연결이 안 돼 다시 시도 중) · local(이 브라우저에만 저장)
  // 오류 종류(kind): network · server(일시적, 다시 시도) · missing(학생 행 없음) · unsupported(흐름이 지원하지 않음) · corrupt(서버 기록을 읽을 수 없음) · too-big
  function createSync(options) {
    const { url, student, fetchImpl, getProgress, readProgress, applyRemote } = options;
    const onStatus = options.onStatus || (() => {});
    const onBase = options.onBase || (() => {});
    const onAttempts = options.onAttempts || (() => {});
    const onConflict = options.onConflict || (() => {});
    const timers = options.timers || { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id), now: () => Date.now() };
    const identity = { school: student.school, studentId: student.studentId, studentName: student.studentName };

    let base = null; // 서버가 마지막으로 확인해 준 기록 { revision, progress, canon }. 불러오기 전에는 null
    let earlier = options.initialBase || null; // 이 브라우저가 지난번에 서버와 맞춰 둔 기록 { revision, progress }
    let status = "idle";
    let detail = null;
    let timer = null;
    let retryTimer = null;
    let firstDirtyAt = 0;
    let inflight = null;
    let stopped = false;
    let failures = 0;
    let conflicts = 0;
    let checked = null;
    let checkedChanged = false;
    // 최근에 보낸 저장 내용입니다. 응답을 받지 못한 저장(창을 닫는 순간 보낸 것 포함)이 서버에 반영됐는지 알아보는 데 쓰며,
    // 화면을 다시 열어도 알 수 있도록 onAttempts 로 저장소에 남깁니다.
    const attempts = (options.initialAttempts || []).slice(-RECENT_ATTEMPTS);

    const kindOf = (info) => (info ? info.kind : null);
    function setStatus(next, info) {
      const same = status === next && kindOf(detail) === kindOf(info);
      status = next;
      detail = info || null;
      if (!same) onStatus(status, detail);
    }
    function announceAttempts() {
      try {
        onAttempts(attempts.slice());
      } catch (error) {
        /* 보낸 기록을 남기지 못해도 동기화는 계속합니다. */
      }
    }
    function remember(text) {
      // 같은 내용을 다시 보내는 재시도가 쌓이면서 더 오래된(서버에 반영됐을 수 있는) 저장이 밀려나지 않게 중복은 합칩니다.
      const at = attempts.indexOf(text);
      if (at !== -1) attempts.splice(at, 1);
      attempts.push(text);
      if (attempts.length > RECENT_ATTEMPTS) attempts.shift();
      announceAttempts();
    }
    function setBase(revision, progress) {
      base = { revision, progress, canon: canonical(progress) };
      earlier = null;
      checked = null;
      try {
        onBase({ revision, progress });
      } catch (error) {
        /* 마지막으로 맞춘 기록을 저장하지 못해도 동기화는 계속합니다. */
      }
      if (attempts.length) {
        attempts.length = 0;
        announceAttempts();
      }
    }
    // 내 기록이 서버와 다른지 봅니다. 코드 입력처럼 기록과 상관없는 변경은 참조만 비교해 바로 넘깁니다.
    function changed() {
      const state = getProgress();
      if (checked && FIELDS.every((name) => checked[name] === state[name])) return checkedChanged;
      checked = pickProgress(state);
      checkedChanged = canonical(checked) !== base.canon;
      return checkedChanged;
    }

    async function call(body, keepalive) {
      let response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          redirect: "error",
          keepalive: Boolean(keepalive),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        throw failure("network", "서버에 연결하지 못했어요.", error);
      }
      if (response.status === 404) throw failure("missing", "서버에서 내 학생 기록을 찾지 못했어요. 학교·학번·이름을 확인해 주세요.");
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        throw failure("server", "서버가 응답하지 못했어요. (" + response.status + ")");
      }
      if (!response.ok) throw failure("unsupported", "서버가 학습 기록 저장을 지원하지 않아요. (" + response.status + ")");
      let data = null;
      try {
        data = await response.json();
      } catch (error) {
        /* 아래에서 형식 오류로 처리합니다. */
      }
      if (!isRecord(data) || !Number.isSafeInteger(data.revision) || data.revision < 0) {
        throw failure("unsupported", "서버의 응답 형식이 올바르지 않아요.");
      }
      return data;
    }
    const retryDelay = () => RETRY_MS[Math.min(failures - 1, RETRY_MS.length - 1)];
    function retryLater(task, error) {
      failures += 1;
      setStatus("offline", { kind: error.kind, message: error.message });
      timers.clear(retryTimer);
      retryTimer = timers.set(() => {
        retryTimer = null;
        task();
      }, retryDelay());
    }
    function giveUp(error) {
      setStatus("local", { kind: error.kind || "unsupported", message: error.message });
      return false;
    }

    // ---- 불러오기 ----
    function acceptRemote(data) {
      const text = typeof data.state === "string" ? data.state : "";
      const remote = text ? decodeState(text, readProgress) : null;
      let before = earlier ? earlier.progress : null;
      // 창을 닫는 순간 보낸 저장처럼 응답을 받지 못한 저장이 이미 서버에 반영됐다면, 그 기록을 기준으로 삼아 내가 바꾼 만큼을 두 번 더하지 않습니다.
      if (remote && attempts.includes(text)) before = remote;
      if (remote) applyRemote(remote, before);
      setBase(data.revision, remote || P.freshProgress());
    }
    async function start() {
      if (stopped) return status;
      setStatus("loading");
      try {
        const data = await call({ action: "load", ...identity });
        if (data.state !== undefined && data.state !== null && typeof data.state !== "string") {
          throw failure("unsupported", "서버의 응답 형식이 올바르지 않아요.");
        }
        if (stopped) return status;
        failures = 0;
        conflicts = 0;
        acceptRemote(data);
        setStatus("synced");
        notify();
      } catch (error) {
        if (stopped) return status;
        const known = error.kind ? error : failure("unsupported", error.message, error);
        if (known.kind === "network" || known.kind === "server") retryLater(start, known);
        else giveUp(known);
      }
      return status;
    }

    // ---- 저장하기 ----
    function schedule() {
      const now = timers.now();
      if (!firstDirtyAt) firstDirtyAt = now;
      timers.clear(timer);
      timer = timers.set(() => {
        timer = null;
        save();
      }, Math.max(0, Math.min(DEBOUNCE_MS, firstDirtyAt + MAX_WAIT_MS - now)));
      setStatus("pending");
    }
    // 화면의 기록이 바뀔 때마다 부릅니다. 저장 중이거나 다시 시도를 기다리는 중이면 그 뒤에 이어서 확인합니다.
    function notify() {
      if (stopped || !base || status === "local" || status === "loading") return;
      if (!changed() || inflight || retryTimer) return;
      schedule();
    }
    // 서버가 다른 기기의 기록을 먼저 받았을 때입니다. 응답을 받지 못했던 내 저장이 이미 반영된 경우는 합치지 않고 번호만 따라갑니다.
    function resolveConflict(reply) {
      const text = typeof reply.state === "string" ? reply.state : "";
      if (text && attempts.includes(text)) {
        setBase(reply.revision, decodeState(text, readProgress));
        return;
      }
      const remote = text ? decodeState(text, readProgress) : null;
      const before = base.progress;
      const mine = canonical(pickProgress(getProgress()));
      if (remote) applyRemote(remote, before);
      setBase(reply.revision, remote || P.freshProgress());
      if (canonical(pickProgress(getProgress())) !== mine) onConflict();
    }
    // 충돌이 거듭되면 다른 기기와 번갈아 덮어쓰지 않도록 간격을 늘려 가며 기다립니다.
    function waitAfterConflicts() {
      timers.clear(retryTimer);
      retryTimer = timers.set(() => {
        retryTimer = null;
        save();
      }, RETRY_MS[Math.min(conflicts - MAX_CONFLICTS, RETRY_MS.length - 1)]);
      setStatus("pending");
    }
    async function run(keepalive) {
      if (!changed()) {
        firstDirtyAt = 0;
        setStatus("synced");
        return true;
      }
      const progress = pickProgress(getProgress());
      const text = encodeState(progress);
      if (text.length > MAX_STATE_CHARS) return giveUp(failure("too-big", "학습 기록이 너무 커서 서버에 저장할 수 없어요."));
      remember(text);
      setStatus("saving");
      let reply;
      try {
        reply = await call({ action: "save", ...identity, baseRevision: base.revision, gems: progress.gems, state: text }, keepalive);
        // 충돌 응답에 서버 기록(state)이 없으면 내 기록으로 덮어쓸 수 있으니 저장하지 않습니다.
        if (typeof reply.saved !== "boolean" || (!reply.saved && typeof reply.state !== "string")) {
          throw failure("unsupported", "서버의 응답 형식이 올바르지 않아요.");
        }
      } catch (error) {
        if (stopped) return false;
        if (error.kind === "network" || error.kind === "server") {
          retryLater(() => save(), error);
          return false;
        }
        return giveUp(error);
      }
      if (stopped) return false;
      failures = 0;
      try {
        if (reply.saved) {
          conflicts = 0;
          setBase(reply.revision, progress);
        } else {
          // 번호가 같은데 거절하는 흐름은 번호 비교 조건이 잘못된 것입니다. 같은 요청을 계속 보내지 않습니다.
          if (reply.revision === base.revision) {
            throw failure("unsupported", "서버가 같은 번호인데 저장을 거절했어요. 흐름의 번호 비교 조건을 확인해 주세요.");
          }
          conflicts += 1;
          resolveConflict(reply);
        }
      } catch (error) {
        return giveUp(error);
      }
      firstDirtyAt = 0;
      if (!changed()) setStatus("synced");
      else if (conflicts >= MAX_CONFLICTS) waitAfterConflicts();
      else schedule();
      return true;
    }
    function save(saveOptions) {
      if (inflight) return inflight;
      timers.clear(timer);
      timer = null;
      if (stopped || !base || status === "local") return Promise.resolve(false);
      inflight = run(Boolean(saveOptions && saveOptions.keepalive)).finally(() => {
        inflight = null;
      });
      return inflight;
    }
    // 로그아웃·창 닫기 전에 부릅니다. 남은 변경을 바로 저장하고, 모두 저장됐으면 true 를 돌려줍니다.
    async function flush(flushOptions) {
      const settings = flushOptions || {};
      if (stopped || !base || status === "local") return false;
      if (!inflight && !changed()) return true;
      timers.clear(retryTimer);
      retryTimer = null;
      const done = save({ keepalive: settings.keepalive }).then(() => !changed());
      if (!settings.timeoutMs) return done;
      return Promise.race([done, new Promise((resolve) => timers.set(() => resolve(false), settings.timeoutMs))]);
    }
    function stop() {
      stopped = true;
      timers.clear(timer);
      timers.clear(retryTimer);
      timer = null;
      retryTimer = null;
    }

    return { start, notify, flush, stop, getStatus: () => ({ status, detail }), getBase: () => base };
  }

  const api = {
    STATE_VERSION, DEBOUNCE_MS, MAX_WAIT_MS, RETRY_MS, TIMEOUT_MS, FIELDS,
    pickProgress, canonical, mergeProgress, encodeState, decodeState, createSync,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PcoSync = api;
})(typeof window !== "undefined" ? window : globalThis);
