import { useEffect, useRef, useState } from "react";

// Python 실행기(Web Worker)를 실행·채점 한 번마다 새로 만들어 쓰고, 중지와 제한 시간을 관리합니다.
// run()은 { results, elapsed } 또는 { aborted: 사유 }로 끝나며, 호출한 쪽이 화면에 보여줍니다.
export function usePythonRunner() {
  const job = useRef(null);
  const [busy, setBusy] = useState("");

  const stop = (message) => {
    if (job.current) job.current.finish({ aborted: message });
  };
  useEffect(
    () => () => {
      if (job.current) {
        job.current.worker.terminate();
        clearTimeout(job.current.timer);
        job.current = null;
      }
    },
    [],
  );

  // cases: [{ input, files?, output? }]. output이 있으면 정답과 비교해 passed를 채웁니다.
  function run({ code, cases, grading = false, onProgress }) {
    if (job.current) return Promise.resolve({ aborted: "이미 실행 중이에요." });
    return new Promise((resolve) => {
      setBusy("Python 준비 중…");
      let worker;
      let workerUrl;
      try {
        workerUrl = URL.createObjectURL(
          new Blob([document.getElementById("worker-source").textContent], {
            type: "text/javascript",
          }),
        );
        worker = new Worker(workerUrl, { type: "module" });
      } catch (error) {
        setBusy("");
        resolve({ aborted: "Python 실행기를 만들지 못했어요: " + error.message });
        return;
      } finally {
        if (workerUrl) URL.revokeObjectURL(workerUrl);
      }
      const results = [];
      let current = 0;
      let started = performance.now();
      const active = { worker, timer: null, finish: null };
      job.current = active;
      active.finish = (payload) => {
        clearTimeout(active.timer);
        worker.terminate();
        if (job.current === active) job.current = null;
        setBusy("");
        resolve(payload);
      };
      const arm = (ms, message) => {
        clearTimeout(active.timer);
        active.timer = setTimeout(() => active.finish({ aborted: message }), ms);
      };
      const sendCase = () => {
        setBusy(grading ? `채점 중 ${current + 1}/${cases.length}` : "실행 중…");
        arm(5000, "실행 제한 시간(5초)을 초과했어요. 무한 반복이 있는지 확인해주세요.");
        worker.postMessage({ code, input: cases[current].input, files: cases[current].files });
      };
      arm(90000, "Python을 90초 안에 불러오지 못했어요. 인터넷 연결을 확인한 후 다시 시도해주세요.");
      worker.onerror = (event) => {
        event.preventDefault();
        if (job.current !== active) return;
        active.finish({
          aborted:
            "Python 실행기 오류: " +
            (event.message || "실행기를 불러올 수 없습니다. CDN 접근을 확인해주세요."),
        });
      };
      worker.onmessage = ({ data }) => {
        if (job.current !== active) return;
        if (data.type === "fatal") {
          active.finish({ aborted: data.error });
          return;
        }
        if (data.type === "ready") {
          started = performance.now();
          sendCase();
          return;
        }
        if (data.type !== "result") return;
        const item = cases[current];
        const result = { ...data, input: item.input, expected: item.output };
        result.passed =
          item.output !== undefined &&
          !result.error &&
          normalizeOutput(result.output) === normalizeOutput(item.output);
        results.push(result);
        current += 1;
        if (onProgress) onProgress([...results]);
        if (current < cases.length) {
          sendCase();
          return;
        }
        active.finish({ results, elapsed: Math.round(performance.now() - started) });
      };
    });
  }
  return { busy, run, stop };
}

export const gradingCases = (problem) =>
  problem.tests.map((test) => ({ input: test.input, output: test.output, files: test.files }));
