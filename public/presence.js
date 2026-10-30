(function () {
  "use strict";
  var base = new URL(".", document.currentScript.src);
  var status = document.getElementById("pco-session-status");
  var login = document.getElementById("pco-session-login");
  var logout = document.getElementById("pco-session-logout");
  if (window.PcoDeployment && window.PcoDeployment.mode === "static") {
    if (status) status.textContent = "공개 정적 리포트 · 로그인 미지원";
    if (login) login.hidden = true;
    if (logout) logout.hidden = true;
    return;
  }
  var authenticated = false;
  var authenticatedStatus = "";
  var busy = false;

  function show(message) {
    if (status) status.textContent = message;
  }
  async function request(route, method) {
    var controller = new AbortController();
    var timeout = setTimeout(function () {
      controller.abort();
    }, 10000);
    try {
      var response = await fetch(new URL(route, base), {
        method: method || "GET",
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      var result = await response.json();
      if (!response.ok) {
        var error = new Error(
          result.message || "접속 현황 요청에 실패했습니다.",
        );
        error.status = response.status;
        throw error;
      }
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }
  function updateControls() {
    if (login) login.hidden = authenticated;
    if (logout) logout.hidden = !authenticated;
  }
  function report(error) {
    show(
      error.name === "AbortError"
        ? "접속 확인 시간 초과"
        : "접속 현황 연결 실패",
    );
    console.error("[presence]", error.message);
  }
  async function heartbeat() {
    if (!authenticated || busy || document.hidden) return;
    busy = true;
    try {
      await request("api/session/heartbeat", "POST");
      if (authenticated) show(authenticatedStatus);
    } catch (error) {
      if (error.status === 401) {
        authenticated = false;
        authenticatedStatus = "";
        updateControls();
        show("세션 만료 · 다시 로그인");
      } else report(error);
    } finally {
      busy = false;
    }
  }
  async function checkSession() {
    try {
      var session = await request("api/session");
      authenticated = session.authenticated === true;
      var studentLabel = session.name ? session.name + " 학생" : "이름 미등록";
      authenticatedStatus = authenticated
        ? session.school + " / " + studentLabel
        : "";
      updateControls();
      show(authenticated ? authenticatedStatus : "활동 집계는 로그인 후 시작");
      if (authenticated) await heartbeat();
    } catch (error) {
      report(error);
    }
  }
  if (logout)
    logout.addEventListener("click", async function () {
      logout.disabled = true;
      try {
        await request("api/session/logout", "POST");
        ["school", "studentId"].forEach(function (name) {
          document.cookie =
            name + "=; Max-Age=0; Path=" + base.pathname + "; SameSite=Lax";
        });
        authenticated = false;
        authenticatedStatus = "";
        updateControls();
        show("로그아웃됨");
        window.dispatchEvent(new Event("pco-session-changed"));
        location.replace(new URL("login.html?reverify=1", base).href);
      } catch (error) {
        report(error);
      } finally {
        logout.disabled = false;
      }
    });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) checkSession();
  });
  window.addEventListener("pageshow", checkSession);
  setInterval(function () {
    if (!document.hidden) checkSession();
  }, 60000);
  checkSession();
})();
