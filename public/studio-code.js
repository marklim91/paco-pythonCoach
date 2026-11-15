import React, { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Code2,
  Play,
  Send,
  RotateCcw,
  Square,
  Terminal,
  ListChecks,
  LoaderCircle,
  X,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { h, Button, icon } from "./studio-ui.js";
import { gradingCases } from "./studio-runner.js";

const tab = (value, label) =>
  h(Tabs.Trigger, { className: "tab-trigger", value, key: value }, label);
const content = (value, ...children) =>
  h(Tabs.Content, { className: "tab-content", value }, ...children);

// 문제가 미리 만들어 주는 파일(파일 처리 문제)을 보여줍니다.
export function FilesNote({ files }) {
  const names = Object.keys(files || {});
  if (!names.length) return null;
  return h(
    "div",
    { className: "files-note" },
    names.map((name) =>
      h(
        "div",
        { className: "file-box", key: name },
        h("div", { className: "file-name" }, icon(FileText, { size: 13 }), `${name} (문제가 준비한 파일)`),
        h("pre", null, files[name] || "(빈 파일)"),
      ),
    ),
  );
}

// 코드 에디터 + 실행/채점 결과 패널입니다. 문제가 바뀌면 부모가 key를 바꿔 상태를 비웁니다.
export function CodePanel({
  problem,
  code,
  onCodeChange,
  onResetCode,
  runner,
  onGraded,
  onRan,
  storageWarning,
  locked = "",
  statusNote = "",
  children,
}) {
  const [stdin, setStdin] = useState(problem.tests[0].input);
  const [runnerTab, setRunnerTab] = useState("input");
  const [runResult, setRunResult] = useState(null);
  const [grade, setGrade] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const [scrollTop, setScrollTop] = useState(0);
  const { busy } = runner;

  async function execute(mode) {
    if (busy || locked) return;
    setGrade(null);
    setRunResult(null);
    setElapsed(null);
    setRunnerTab(mode === "grade" ? "tests" : "output");
    const grading = mode === "grade";
    const outcome = await runner.run({
      code,
      grading,
      cases: grading ? gradingCases(problem) : [{ input: stdin, files: problem.tests[0].files }],
      onProgress: grading
        ? (results) => setGrade({ results, total: problem.tests.length, finished: false })
        : undefined,
    });
    if (outcome.aborted) {
      setRunResult({ output: "", error: outcome.aborted });
      setGrade(null);
      setRunnerTab("output");
      return;
    }
    setElapsed(outcome.elapsed);
    if (!grading) {
      setRunResult(outcome.results[0]);
      if (onRan) onRan(outcome.results[0]);
      return;
    }
    const passed = outcome.results.every((item) => item.passed);
    setGrade({ results: outcome.results, total: problem.tests.length, finished: true, passed });
    onGraded({ passed, results: outcome.results });
  }
  function onEditorKey(event) {
    if (event.nativeEvent.isComposing) return;
    const node = event.currentTarget;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const value = node.value;
    const replace = (next, caret) => {
      event.preventDefault();
      onCodeChange(next);
      requestAnimationFrame(() => {
        node.selectionStart = node.selectionEnd = caret;
      });
    };
    if (event.key === "Tab") {
      replace(value.slice(0, start) + "    " + value.slice(end), start + 4);
    } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      execute(event.shiftKey ? "grade" : "run");
    } else if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      // 앞 줄의 들여쓰기를 이어 가고, 콜론(:)으로 끝났다면 한 단계 더 들여씁니다.
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const line = value.slice(lineStart, start);
      let indent = (line.match(/^ */) || [""])[0];
      if (/:\s*$/.test(line)) indent += "    ";
      replace(value.slice(0, start) + "\n" + indent + value.slice(end), start + 1 + indent.length);
    } else if (event.key === "Backspace" && start === end) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const before = value.slice(lineStart, start);
      if (before.length >= 4 && /^ +$/.test(before) && before.length % 4 === 0)
        replace(value.slice(0, start - 4) + value.slice(end), start - 4);
    }
  }

  return h(
    "section",
    { className: "panel editor-panel", "aria-label": "Python 코드 작성 및 실행" },
    h(
      "div",
      { className: "panel-head" },
      icon(Code2),
      "코드 에디터",
      h("span", { className: "grow" }),
      h(
        "span",
        { className: "tiny muted", style: { fontWeight: 400 } },
        storageWarning ? "임시 저장 모드" : "브라우저 자동 저장",
      ),
    ),
    h(
      "div",
      { className: "editor-toolbar" },
      h(
        "div",
        { className: "language" },
        h("span", { className: "python-logo" }, "Py"),
        "Python 3",
        h("span", { className: "muted" }, "· solution.py"),
      ),
      h(
        Button,
        {
          size: "icon",
          variant: "ghost",
          onClick: onResetCode,
          disabled: Boolean(busy),
          title: "시작 코드로 되돌리기",
          "aria-label": "코드 초기화",
        },
        icon(RotateCcw, { size: 13 }),
      ),
    ),
    h(
      "div",
      { className: "code-wrap" },
      h(
        "pre",
        { className: "line-numbers", "aria-hidden": true },
        h(
          "div",
          { style: { transform: `translateY(-${scrollTop}px)` } },
          code
            .split("\n")
            .map((_, i) => i + 1)
            .join("\n"),
        ),
      ),
      h("textarea", {
        className: "editor",
        "aria-label": "Python 코드",
        value: code,
        spellCheck: false,
        autoCapitalize: "off",
        autoComplete: "off",
        placeholder: "여기에 파이썬 코드를 써요",
        readOnly: Boolean(busy),
        onChange: (event) => onCodeChange(event.target.value),
        onKeyDown: onEditorKey,
        onScroll: (event) => setScrollTop(event.currentTarget.scrollTop),
      }),
    ),
    h(
      "div",
      { className: "editor-status" },
      h("span", null, "UTF-8", "　·　", "들여쓰기 4칸"),
      h("span", null, "Python · WebAssembly"),
    ),
    children,
    h(
      Tabs.Root,
      { className: "runner", value: runnerTab, onValueChange: setRunnerTab },
      h(
        Tabs.List,
        { className: "tab-list", "aria-label": "실행 정보" },
        tab("input", "테스트 입력"),
        tab("output", "실행 결과"),
        tab("tests", "채점 결과"),
      ),
      content(
        "input",
        h("div", { className: "input-label" }, "직접 입력해보세요"),
        h("textarea", {
          className: "stdin",
          "aria-label": "테스트 입력",
          placeholder: "이 문제는 입력이 필요하지 않아요.",
          value: stdin,
          onChange: (event) => setStdin(event.target.value),
        }),
        h("p", { className: "input-note" }, "실행은 이 입력을, 제출은 문제의 모든 테스트 케이스를 사용해요."),
        h(FilesNote, { files: problem.tests[0].files }),
      ),
      content("output", renderRun(runResult, elapsed, busy)),
      content("tests", renderGrade(grade, busy)),
    ),
    h(
      "div",
      { className: "execution-bar" },
      h("span", { className: "execution-note", role: "status" }, busy || locked || statusNote || "Ctrl + Enter로 실행"),
      h(
        "div",
        { className: "execution-buttons" },
        busy
          ? h(
              Button,
              {
                variant: "outline",
                onClick: () => runner.stop("실행을 중지했어요. 코드를 수정하고 다시 시도해보세요."),
              },
              icon(Square),
              "중지",
            )
          : h(
              React.Fragment,
              null,
              h(Button, { variant: "outline", onClick: () => execute("run"), disabled: Boolean(locked) }, icon(Play), "실행"),
              h(Button, { onClick: () => execute("grade"), disabled: Boolean(locked) }, icon(Send), "제출하기"),
            ),
      ),
    ),
  );
}

function renderRun(runResult, elapsed, busy) {
  if (!runResult)
    return h(
      "div",
      { className: "empty-result" },
      icon(busy ? LoaderCircle : Terminal),
      busy || "코드를 실행하면 여기에 결과가 나타나요.",
    );
  return h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "result-head " + (runResult.error ? "result-fail" : "result-pass") },
      icon(runResult.error ? X : CheckCircle2, { size: 14 }),
      runResult.error ? "실행 중 오류가 발생했어요" : "실행 완료",
      elapsed !== null && h("span", { className: "muted tiny" }, `${elapsed} ms`),
    ),
    h("pre", { className: "output" }, runResult.output || (!runResult.error ? "(출력 없음)" : "")),
    runResult.stderr && h("pre", { className: "output error" }, runResult.stderr),
    runResult.error && h("pre", { className: "output error" }, runResult.error),
  );
}

function renderGrade(grade, busy) {
  if (!grade)
    return h(
      "div",
      { className: "empty-result" },
      icon(busy ? LoaderCircle : ListChecks),
      busy || "제출하면 테스트 케이스별 결과를 볼 수 있어요.",
    );
  return h(
    React.Fragment,
    null,
    h(
      "div",
      {
        className:
          "result-head " + (grade.passed ? "result-pass" : grade.finished ? "result-fail" : "muted"),
        role: "status",
      },
      icon(grade.passed ? CheckCircle2 : ListChecks, { size: 15 }),
      grade.finished
        ? grade.passed
          ? "모든 테스트를 통과했어요!"
          : "조금만 더 생각해볼까요?"
        : "채점하고 있어요…",
      h("span", { className: "tiny muted" }, `${grade.results.filter((r) => r.passed).length} / ${grade.total}`),
    ),
    grade.results.map((result, i) =>
      h(
        "div",
        { className: "case-row", key: i },
        h(
          "details",
          null,
          h(
            "summary",
            { className: result.passed ? "result-pass" : "result-fail" },
            `${result.passed ? "✓" : "×"} 테스트 ${i + 1} · ${result.passed ? "통과" : result.error ? "실행 오류" : "출력이 달라요"}`,
          ),
          h(
            "div",
            { className: "case-detail" },
            h("div", null, "기대 출력", h("pre", null, result.expected)),
            h("div", null, "내 출력", h("pre", null, result.output || "(없음)")),
          ),
          result.error && h("pre", { className: "output error" }, result.error),
        ),
      ),
    ),
  );
}
