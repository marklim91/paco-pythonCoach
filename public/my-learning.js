(function () {
  "use strict";
  var base = new URL(".", document.currentScript.src);
  var byId = function (id) { return document.getElementById(id); };
  if (window.PcoDeployment && window.PcoDeployment.mode === "static") {
    byId("learning-status").textContent = "정적 리포트 모드";
    byId("learning-collected").textContent = "GitHub Pages에서는 로그인과 내 학습 조회를 지원하지 않습니다.";
    byId("learning-refresh-note").textContent = "개인 API와 로그인 세션을 사용하지 않습니다.";
    byId("learning-error").textContent = "전체 학생 현황에서 마지막 배포 시점의 공개 리포트를 확인해 주세요.";
    byId("learning-error").hidden = false;
    byId("learning-refresh").disabled = true;
    return;
  }
  var loading = false;
  var requestVersion = 0;
  var activeController = null;
  var number = new Intl.NumberFormat("ko-KR");
  var date = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Asia/Seoul",
  });

  function text(id, value) { byId(id).textContent = value; }
  function time(value) { return date.format(new Date(value)); }
  function list(id, values) {
    var target = byId(id);
    target.replaceChildren();
    values.forEach(function (value) {
      var item = document.createElement("li");
      item.textContent = value;
      target.appendChild(item);
    });
  }
  function reading(id, resource, prefix) {
    var link = byId(id);
    link.hidden = !resource;
    if (resource) {
      link.href = resource.url;
      link.textContent = prefix + resource.title + " (새 창)";
    } else link.removeAttribute("href");
  }
  function clearRecord() {
    byId("learning-content").replaceChildren();
    byId("learning-content").hidden = true;
  }
  function resetView() {
    requestVersion++;
    if (activeController) activeController.abort();
    activeController = null;
    loading = false;
    clearRecord();
  }
  function render(data) {
    var content = byId("learning-content");
    if (!content.firstElementChild) content.appendChild(byId("learning-template").content.cloneNode(true));
    var student = data.student;
    var guide = data.guide;
    text("learner-name", student.name + "님의 학습 현황");
    text("my-identity", student.school);
    text("my-level", "Lv." + number.format(student.level));
    text("my-tier", !guide.current ? "로드맵 확인 필요" : student.level <= 5 ? "입문 단계" : student.level <= 10 ? "성장 단계" : "도전 단계");
    text("my-level-title", guide.current ? guide.current.title : "로드맵에 없는 레벨");
    text("my-focus", guide.current ? guide.current.focus : "레벨 기준을 담당자에게 확인해 주세요.");
    text("my-modified", "Dataverse 마지막 수정: " + time(student.modifiedAt) + " (마지막 학습 시각을 의미하지 않습니다.)");
    text("my-points", number.format(student.points) + "점");
    text("my-rank", number.format(data.ranking.overall) + "위");
    text("my-rank-note", "전체 " + number.format(data.ranking.overallStudents) + "명 · 학교 " +
      number.format(data.ranking.school) + "위 / " + number.format(data.ranking.schoolStudents) + "명 · 동점 공동 순위");
    text("my-growth", student.observedGrowth === null ? "관측 대기" :
      (student.observedGrowth > 0 ? "+" : "") + number.format(student.observedGrowth) + "점");
    byId("my-growth").className = student.observedGrowth > 0 ? "growth-positive" :
      student.observedGrowth < 0 ? "growth-negative" : "";
    text("my-growth-note", student.observedGrowth === null ? "관측값이 더 쌓이면 변화를 비교할 수 있어요." : "보관 중인 첫 관측 점수 대비 변화");

    byId("unmapped-level").hidden = guide.status !== "unmapped";
    byId("learning-guide").hidden = guide.status === "unmapped";
    text("recommendation-note", guide.recommendationNote);
    if (guide.current) {
      var target = guide.next || guide.current;
      text("next-heading", guide.next ? "다음 목표 · Lv." + target.level + " " + target.title : "Lv.15 · 로드맵 마지막 단계");
      text("next-focus", guide.next ? target.focus : "별도의 Lv.16을 가정하지 않습니다. 완성한 프로젝트를 검증하고 개선하며 학습을 이어가요.");
      text("next-goals-heading", guide.next ? "다음 단계를 준비하는 학습 목표" : "마지막 단계에서 더 깊게 도전하기");
      list("next-goals", target.goals);
      text("promotion-note", guide.promotionNote);
      text("practice-title", guide.practice.title);
      text("practice-task", guide.practice.task);
      list("practice-checks", guide.practice.checks);
      list("review-goals", guide.current.goals);
      reading("review-reading", guide.current.reading, "현재 단계 참고: ");
      reading("next-reading", guide.next && guide.next.reading, "다음 단계 참고: ");
      var roadmap = byId("my-roadmap");
      roadmap.replaceChildren();
      guide.roadmap.forEach(function (entry) {
        var item = document.createElement("li");
        item.textContent = String(entry.level).padStart(2, "0");
        item.title = entry.title;
        item.setAttribute("aria-label", "레벨 " + entry.level + " " + entry.title +
          (entry.level === student.level ? " · 현재" : guide.next && entry.level === guide.next.level ? " · 다음 목표" : ""));
        if (entry.level === student.level) item.setAttribute("aria-current", "step");
        var label = document.createElement("span");
        label.textContent = entry.level === student.level ? "현재" : guide.next && entry.level === guide.next.level ? "다음 목표" : "";
        item.appendChild(label);
        roadmap.appendChild(item);
      });
    }

    text("history-note", data.historyNote);
    var history = byId("my-history");
    history.replaceChildren();
    student.history.slice(-7).reverse().forEach(function (sample) {
      var row = document.createElement("tr");
      [time(sample.at), "Lv." + sample.level, number.format(sample.points) + "점"].forEach(function (value) {
        var cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      history.appendChild(row);
    });
    if (!student.history.length) {
      var row = document.createElement("tr");
      var cell = document.createElement("td");
      cell.colSpan = 3;
      cell.className = "empty";
      cell.textContent = "아직 관측 기록이 없습니다. 과거 학습 이력은 임의로 만들지 않습니다.";
      row.appendChild(cell);
      history.appendChild(row);
    }
    content.hidden = false;
    text("learning-collected", "Dataverse 수집: " + time(data.collectedAt));
    text("learning-status", "내 기록 연결됨");
    byId("learning-status").dataset.state = "connected";
  }
  async function load() {
    if (loading || document.hidden) return;
    loading = true;
    var version = ++requestVersion;
    byId("learning-refresh").disabled = true;
    byId("learning-content").setAttribute("aria-busy", "true");
    byId("learning-error").hidden = true;
    byId("learning-login").hidden = true;
    text("learning-status", "내 기록 확인 중");
    var controller = new AbortController();
    activeController = controller;
    var timeout = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var response = await fetch(new URL("api/me/learning", base), {
        cache: "no-store", credentials: "same-origin", signal: controller.signal,
      });
      var data = await response.json();
      if (version !== requestVersion) return;
      if (!response.ok) {
        var error = new Error(data.message || "내 학습 기록을 조회하지 못했습니다.");
        error.status = response.status;
        throw error;
      }
      if (!document.hidden) render(data);
    } catch (error) {
      if (version !== requestVersion) return;
      clearRecord();
      text("learning-collected", "현재 기록을 확인할 수 없습니다. 이전 기록을 대신 표시하지 않습니다.");
      text("learning-status", error.status === 401 ? "로그인 / 재검증 필요" : "내 기록 조회 실패");
      byId("learning-status").dataset.state = "error";
      if (error.status === 401) {
        text("learning-login-message", error.message);
        byId("learning-login").hidden = false;
      } else {
        text("learning-error", error.name === "AbortError" ? "조회 시간이 초과되었습니다. 다시 시도해 주세요." :
          error instanceof TypeError || error instanceof SyntaxError ?
            "서버 연결 또는 JSON 응답을 확인해 주세요. Node.js 서버에서 실행해야 합니다." : error.message);
        byId("learning-error").hidden = false;
        console.error("[my-learning]", error.message);
      }
    } finally {
      clearTimeout(timeout);
      if (version === requestVersion) {
        loading = false;
        activeController = null;
        byId("learning-refresh").disabled = false;
        byId("learning-content").setAttribute("aria-busy", "false");
      }
    }
  }
  byId("learning-refresh").addEventListener("click", load);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) resetView();
    else load();
  });
  window.addEventListener("pco-session-changed", function () { resetView(); load(); });
  window.addEventListener("pagehide", resetView);
  window.addEventListener("pageshow", function (event) { if (event.persisted) { resetView(); load(); } });
  setInterval(load, 60000);
  load();
})();
