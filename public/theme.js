(function () {
  var KEY = "pco-theme";
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function stored() {
    try {
      var value = window.localStorage.getItem(KEY);
      return value === "dark" || value === "light" ? value : null;
    } catch (e) {
      return null;
    }
  }

  function preferred() {
    return stored() || (media && media.matches ? "dark" : "light");
  }

  function current() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function sync() {
    var checked = String(current() === "dark");
    var toggles = document.querySelectorAll("[data-pco-theme-toggle]");
    for (var i = 0; i < toggles.length; i++) toggles[i].setAttribute("aria-checked", checked);
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    sync();
  }

  function set(theme) {
    if (theme !== "dark" && theme !== "light") return;
    try {
      window.localStorage.setItem(KEY, theme);
    } catch (e) {}
    apply(theme);
  }

  function toggle() {
    set(current() === "dark" ? "light" : "dark");
  }

  // 저장된 설정이 없으면 OS 설정 변경을 따라갑니다. 다른 탭에서 바꾼 설정도 반영합니다.
  if (media && media.addEventListener) {
    media.addEventListener("change", function () {
      if (!stored()) apply(preferred());
    });
  }
  window.addEventListener("storage", function (event) {
    if (event.key === KEY || event.key === null) apply(preferred());
  });

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (target && target.closest && target.closest("[data-pco-theme-toggle]")) toggle();
  });

  document.addEventListener("DOMContentLoaded", function () {
    // 공통 상단 바나 페이지가 직접 토글을 제공하지 않으면 우측 하단에 띄웁니다.
    if (!document.querySelector("[data-pco-theme-toggle]") && root.getAttribute("data-pco-theme-ui") !== "page") {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "pco-theme-toggle pco-theme-floating";
      button.setAttribute("role", "switch");
      button.setAttribute("data-pco-theme-toggle", "");
      button.innerHTML =
        '<span class="pco-theme-label">다크 모드</span><span class="pco-theme-track" aria-hidden="true"></span>';
      document.body.appendChild(button);
    }
    sync();
  });

  apply(preferred());
  window.PcoTheme = { get: current, set: set, toggle: toggle, sync: sync };
})();
