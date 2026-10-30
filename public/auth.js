(function () {
  "use strict";

  var script = document.currentScript;
  var baseUrl = new URL(".", script.src);
  if (window.PcoDeployment && window.PcoDeployment.mode === "static") {
    if (script.dataset.page === "login") {
      location.replace(new URL("dashboard.html", baseUrl).href);
    }
    return;
  }
  var schools = [
    "현풍중학교",
    "경북여자고등학교",
    "함양여자중학교",
    "도원중학교",
  ];

  function readCookie(name) {
    var prefix = name + "=";
    var cookie = document.cookie.split(";").map(function (part) {
      return part.trim();
    }).find(function (part) {
      return part.indexOf(prefix) === 0;
    });
    if (!cookie) return "";
    try {
      return decodeURIComponent(cookie.slice(prefix.length));
    } catch (error) {
      if (error instanceof URIError) return "";
      throw error;
    }
  }

  function isLoggedIn() {
    return schools.indexOf(readCookie("school")) !== -1 &&
      /^[0-9]+$/.test(readCookie("studentId"));
  }

  function saveLogin(school, studentId) {
    if (schools.indexOf(school) === -1 || !/^[0-9]+$/.test(studentId)) {
      throw new Error("학교와 학번을 확인해 주세요.");
    }
    var attributes = "; Path=" + baseUrl.pathname + "; SameSite=Lax";
    if (location.protocol === "https:") attributes += "; Secure";
    document.cookie = "school=" + encodeURIComponent(school) + attributes;
    document.cookie = "studentId=" + encodeURIComponent(studentId) + attributes;
    if (readCookie("school") !== school || readCookie("studentId") !== studentId) {
      throw new Error("로그인 정보를 저장할 수 없습니다. 브라우저의 쿠키 허용 설정을 확인해 주세요.");
    }
  }

  window.PcoAuth = {
    schools: schools,
    isLoggedIn: isLoggedIn,
    saveLogin: saveLogin,
    homeUrl: new URL("index.html", baseUrl).href,
    verifyUrl: new URL("api/login/verify", baseUrl).href,
  };

  function checkLogin() {
    var loginPage = script.dataset.page === "login";
    if (!loginPage && !isLoggedIn()) {
      document.documentElement.hidden = true;
      location.replace(new URL("login.html", baseUrl).href);
    } else if (loginPage && isLoggedIn() && !/(?:^\?|&)reverify=1(?:&|$)/.test(location.search || "")) {
      location.replace(window.PcoAuth.homeUrl);
    }
  }

  checkLogin();
  window.addEventListener("pageshow", checkLogin);
})();
