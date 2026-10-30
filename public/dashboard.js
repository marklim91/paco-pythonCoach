(function () {
  "use strict";
  var base = new URL(".", document.currentScript.src);
  var staticMode = window.PcoDeployment && window.PcoDeployment.mode === "static";
  var byId = function (id) { return document.getElementById(id); };
  var data = null;
  var selected = null;
  var page = 0;
  var pageSize = 15;
  var loading = false;
  var presenceLoading = false;
  var formatNumber = new Intl.NumberFormat("ko-KR");
  var formatTime = new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Asia/Seoul",
  });

  function number(value) { return formatNumber.format(value); }
  function time(value) { return formatTime.format(new Date(value)); }
  function displayName(student) { return student.name || "이름 미등록"; }
  function growth(value) { return value === null ? "관측 대기" : (value > 0 ? "+" : "") + number(value); }
  function cell(row, text, className) {
    var td = document.createElement("td");
    td.textContent = text;
    if (className) td.className = className;
    row.appendChild(td);
    return td;
  }
  function emptyRow(target, count, text) {
    target.replaceChildren();
    var row = document.createElement("tr");
    var td = cell(row, text, "empty");
    td.colSpan = count;
    target.appendChild(row);
  }
  async function getJson(route) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var response = await fetch(new URL(route, base), { cache: "no-store", signal: controller.signal });
      var body = await response.json();
      if (!response.ok) throw new Error(body.message || "서버가 요청을 처리하지 못했습니다.");
      return body;
    } finally { clearTimeout(timeout); }
  }
  function errorText(error) {
    return error.name === "AbortError" ? "조회 시간이 초과되었습니다. 다시 시도해 주세요." :
      error instanceof TypeError || error instanceof SyntaxError ?
        (staticMode ? "정적 리포트 파일과 네트워크를 확인해 주세요. Actions에서 배포가 성공했는지 확인해 주세요." :
          "서버 연결 또는 JSON 응답을 확인해 주세요. Node.js 서버에서 실행해야 합니다.") : error.message;
  }

  function schoolRows() {
    var school = byId("school-filter").value;
    var rows = data.students.filter(function (s) { return !school || s.school === school; });
    var rank = 0;
    return rows.map(function (s, i) {
      if (!i || s.points !== rows[i - 1].points) rank = i + 1;
      return Object.assign({}, s, { rank: rank });
    });
  }
  function renderRanking() {
    if (!data) return;
    var rows = schoolRows();
    byId("metric-students").textContent = number(rows.length);
    byId("metric-points").textContent = number(rows.reduce(function (sum, s) { return sum + s.points; }, 0));
    byId("metric-level").textContent = rows.length ?
      (rows.reduce(function (sum, s) { return sum + s.level; }, 0) / rows.length).toFixed(1) : "—";
    var query = byId("student-search").value.trim().toLowerCase();
    var matches = rows.filter(function (s) {
      return s.school.toLowerCase().includes(query) || (s.name && s.name.toLowerCase().includes(query));
    });
    var pages = Math.ceil(matches.length / pageSize);
    page = Math.max(0, Math.min(page, pages - 1));
    var body = byId("ranking-body");
    body.replaceChildren();
    if (!matches.length) emptyRow(body, 5, rows.length ? "검색 결과가 없습니다." : "조회된 활성 학생이 없습니다.");
    matches.slice(page * pageSize, (page + 1) * pageSize).forEach(function (student) {
      var tr = document.createElement("tr");
      if (selected === student.id) tr.className = "selected";
      cell(tr, String(student.rank).padStart(2, "0"), "rank" + (student.rank <= 3 ? " top" : ""));
      var name = cell(tr, "");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "student-button";
      button.textContent = displayName(student);
      button.setAttribute("aria-label", displayName(student) + " · " + student.school + " 성장 리포트 보기");
      button.setAttribute("aria-pressed", String(selected === student.id));
      button.addEventListener("click", function () { selected = student.id; renderRanking(); });
      var school = document.createElement("span");
      school.className = "student-school";
      school.textContent = student.school;
      name.append(button, school);
      cell(tr, "Lv." + number(student.level));
      cell(tr, number(student.points), "points");
      cell(tr, growth(student.observedGrowth), student.observedGrowth > 0 ? "growth-positive" :
        student.observedGrowth < 0 ? "growth-negative" : "");
      body.appendChild(tr);
    });
    byId("ranking-count").textContent = number(matches.length) + "명" + (pages ? " · " + (page + 1) + " / " + pages + "페이지" : "");
    byId("previous-page").disabled = page === 0;
    byId("next-page").disabled = page + 1 >= pages;
    renderReport(rows.find(function (s) { return s.id === selected; }));
  }

  function renderChart(history) {
    var container = byId("growth-chart");
    container.replaceChildren();
    if (history.length < 2) {
      var note = document.createElement("p");
      note.className = "chart-note";
      note.textContent = staticMode ? "이번 배포의 단일 관측값입니다. 정적 모드에서는 배포 간 성장 추이를 보관하지 않습니다." :
        "첫 관측값이 저장되었습니다. 점수가 변경되거나 다음 날 데이터가 수집되면 추이가 표시됩니다.";
      container.appendChild(note);
      return;
    }
    var ns = "http://www.w3.org/2000/svg";
    function element(tag, attributes) {
      var node = document.createElementNS(ns, tag);
      Object.keys(attributes).forEach(function (key) { node.setAttribute(key, attributes[key]); });
      return node;
    }
    var width = 460, height = 200, padding = 35;
    var minTime = Date.parse(history[0].at);
    var maxTime = Date.parse(history[history.length - 1].at);
    var minPoints = Math.min.apply(null, history.map(function (p) { return p.points; }));
    var maxPoints = Math.max.apply(null, history.map(function (p) { return p.points; }));
    var range = maxPoints - minPoints || Math.max(1, maxPoints * .1);
    var svg = element("svg", { viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": "관측된 학습 점수 추이. 아래 표에서 정확한 값을 확인할 수 있습니다." });
    [0, .5, 1].forEach(function (fraction) {
      var y = padding + (height - padding * 2) * fraction;
      svg.appendChild(element("line", { x1: padding, y1: y, x2: width - 10, y2: y, stroke: "#2b3c58", "stroke-dasharray": "3 5" }));
    });
    var points = history.map(function (p) {
      return [
        padding + ((Date.parse(p.at) - minTime) / (maxTime - minTime || 1)) * (width - padding - 12),
        height - padding - ((p.points - minPoints) / range) * (height - padding * 2),
      ];
    });
    svg.appendChild(element("polyline", { points: points.map(function (p) { return p.join(","); }).join(" "), fill: "none", stroke: "#6de3ba", "stroke-width": "3", "stroke-linejoin": "round" }));
    points.forEach(function (p, i) {
      var circle = element("circle", { cx: p[0], cy: p[1], r: 3, fill: "#b9ffe6" });
      var title = element("title", {});
      title.textContent = time(history[i].at) + " · " + number(history[i].points) + "점";
      circle.appendChild(title);
      svg.appendChild(circle);
    });
    [[padding, 16, number(maxPoints) + "점"], [padding, height - 8, time(history[0].at)]].forEach(function (label) {
      var text = element("text", { x: label[0], y: label[1], fill: "#a4b3cc", "font-size": "11" });
      text.textContent = label[2];
      svg.appendChild(text);
    });
    container.appendChild(svg);
  }

  function renderReport(student) {
    byId("report-empty").hidden = !!student;
    byId("report-content").hidden = !student;
    if (!student) return;
    byId("report-student").textContent = displayName(student);
    byId("report-school").textContent = student.school;
    byId("report-points").textContent = number(student.points);
    byId("report-growth").textContent = growth(student.observedGrowth);
    byId("report-updated").textContent = "Dataverse 최종 수정: " + time(student.modifiedAt) + " (한국 시간)";
    byId("history-status").textContent = student.history.length ?
      "관측 " + student.history.length + "회 · 시작 " + time(student.history[0].at) + " (한국 시간)" : "수집 기록 없음";
    var tbody = byId("history-body");
    tbody.replaceChildren();
    student.history.slice().reverse().forEach(function (point) {
      var tr = document.createElement("tr");
      cell(tr, time(point.at));
      cell(tr, number(point.points));
      cell(tr, "Lv." + number(point.level));
      tbody.appendChild(tr);
    });
    renderChart(student.history);
  }

  async function loadDashboard() {
    if (loading) return;
    loading = true;
    byId("refresh").disabled = true;
    byId("ranking-body").setAttribute("aria-busy", "true");
    try {
      var result = await getJson(staticMode ? "reports/dashboard.json" : "api/dashboard");
      if (!Array.isArray(result.students) || !Array.isArray(result.schools)) throw new Error("대시보드 응답 구조를 확인해 주세요.");
      if (staticMode && (result.mode !== "static" || !Number.isFinite(Date.parse(result.collectedAt)))) {
        throw new Error("정적 리포트의 수집 시각과 모드를 확인해 주세요.");
      }
      data = result;
      var school = byId("school-filter").value;
      var select = byId("school-filter");
      select.replaceChildren(new Option("전체 학교", ""));
      data.schools.forEach(function (name) { select.add(new Option(name, name)); });
      select.value = data.schools.includes(school) ? school : "";
      if (!selected || !data.students.some(function (s) { return s.id === selected; })) {
        selected = data.students.length ? data.students[0].id : null;
      }
      byId("source-status").textContent = staticMode ? "배포 시점 정적 리포트" : "Dataverse 연결됨";
      byId("source-status").dataset.state = "connected";
      byId("collected-at").textContent = "마지막 수집: " + time(data.collectedAt) + " (한국 시간)";
      if (staticMode) {
        byId("overview-metrics").className = "metrics snapshot-metrics";
        var old = Date.now() - Date.parse(data.collectedAt) > 2 * 60 * 60 * 1000;
        byId("source-hint").textContent = old ? "수집 후 2시간 경과 · Actions 갱신 상태를 확인해 주세요." :
          "매시간 예약 배포 · 실행 지연 가능 · 실시간 데이터 아님";
        byId("source-status").dataset.state = old ? "error" : "connected";
        byId("observation-note").textContent = result.historyNote;
      }
      byId("dashboard-error").hidden = true;
      renderRanking();
    } catch (error) {
      byId("source-status").textContent = data ? "갱신 실패 · 이전 수집값" : "데이터 연결 필요";
      byId("source-status").dataset.state = "error";
      byId("dashboard-error").textContent = errorText(error) + (data ? " 아래는 마지막으로 수집한 값이며 현재 데이터가 아닐 수 있습니다." : "");
      byId("dashboard-error").hidden = false;
      if (!data) emptyRow(byId("ranking-body"), 5, "실제 데이터가 연결되면 랭킹이 표시됩니다. 예시 점수는 사용하지 않습니다.");
    } finally {
      loading = false;
      byId("refresh").disabled = false;
      byId("ranking-body").removeAttribute("aria-busy");
    }
  }

  async function loadPresence() {
    if (staticMode) return;
    if (presenceLoading) return;
    presenceLoading = true;
    try {
      var result = await getJson("api/presence");
      if (!Array.isArray(result.recentLogins)) throw new Error("접속 현황 응답 구조를 확인해 주세요.");
      byId("metric-active").textContent = number(result.activeUsers);
      byId("presence-updated").textContent = "조회: " + time(result.generatedAt) + " (한국 시간)";
      byId("tracking-started").textContent = "집계 시작: " + time(result.trackingStartedAt) + " · 최근 30일 로그인 학습자 " + number(result.recentLoginUsers) + "명";
      byId("presence-error").hidden = true;
      var tbody = byId("presence-body");
      tbody.replaceChildren();
      if (!result.recentLogins.length) emptyRow(tbody, 4, "서버에서 검증된 새 로그인 기록이 아직 없습니다.");
      result.recentLogins.forEach(function (student) {
        var tr = document.createElement("tr");
        cell(tr, displayName(student));
        cell(tr, student.school);
        cell(tr, time(student.lastLoginAt));
        var status = document.createElement("span");
        status.className = student.active ? "online" : "offline";
        status.textContent = student.active ? "최근 5분 활동" : "활동 신호 없음";
        cell(tr, "").appendChild(status);
        tbody.appendChild(tr);
      });
      if (result.recentLogins.some(function (student) { return !student.name; })) {
        byId("presence-error").hidden = false;
        byId("presence-error").textContent = "일부 과거 로그인 기록에 이름이 없습니다. 해당 학생이 다시 로그인하거나 이름을 포함한 Dataverse 조회가 성공하면 보완됩니다.";
      }
    } catch (error) {
      byId("presence-error").hidden = false;
      byId("presence-error").textContent = errorText(error) + " 표시된 이전 접속 현황은 최신이 아닐 수 있습니다.";
    } finally { presenceLoading = false; }
  }

  if (staticMode) {
    byId("activity-metric").hidden = true;
    byId("presence-panel").hidden = true;
    byId("refresh").textContent = "배포된 리포트 다시 읽기";
    byId("source-hint").textContent = "실시간 조회 없이 마지막 성공한 배포의 데이터를 표시합니다.";
    byId("observation-note").textContent = "이번 배포의 단일 관측값입니다. 과거 성장과 로그인 기록을 수집하지 않습니다.";
    byId("public-data-note").textContent = "학생 이름·학교·레벨·점수는 공개 JSON 파일로 배포됩니다. 로그인 보호가 없습니다.";
  }
  byId("refresh").addEventListener("click", function () { loadDashboard(); loadPresence(); });
  byId("school-filter").addEventListener("change", function () {
    page = 0;
    if (data) {
      var rows = schoolRows();
      if (!rows.some(function (s) { return s.id === selected; })) selected = rows.length ? rows[0].id : null;
    }
    renderRanking();
  });
  byId("student-search").addEventListener("input", function () { page = 0; renderRanking(); });
  byId("previous-page").addEventListener("click", function () { page--; renderRanking(); });
  byId("next-page").addEventListener("click", function () { page++; renderRanking(); });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) { loadDashboard(); loadPresence(); }
  });
  window.addEventListener("pco-session-changed", loadPresence);
  setInterval(function () { if (!document.hidden) loadDashboard(); }, 60000);
  setInterval(function () { if (!document.hidden) loadPresence(); }, 15000);
  loadDashboard();
  loadPresence();
})();
