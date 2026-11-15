// 문제 설명에 쓰는 작은 마크다운 해석기입니다: 코드 블록, 목록, 표, **굵게**, `코드`.
// 글자를 HTML로 바꾸지 않고 블록·토큰 목록만 돌려주므로 화면은 React 요소로 그립니다(innerHTML 없음).
// 줄 하나가 문단 하나입니다.
(function (root) {
  function inline(text) {
    const tokens = [];
    const pattern = /`([^`]+)`|\*\*(.+?)\*\*/g;
    let last = 0;
    let match;
    while ((match = pattern.exec(text))) {
      if (match.index > last) tokens.push({ type: "text", text: text.slice(last, match.index) });
      tokens.push(match[1] !== undefined ? { type: "code", text: match[1] } : { type: "bold", text: match[2] });
      last = pattern.lastIndex;
    }
    if (last < text.length) tokens.push({ type: "text", text: text.slice(last) });
    return tokens;
  }

  const isRow = (line) => /^\s*\|.*\|\s*$/.test(line);
  const isDivider = (line) => /^\s*\|[\s:|-]+\|\s*$/.test(line);
  const isBullet = (line) => /^\s*[-*] /.test(line);
  const isNumbered = (line) => /^\s*\d+\. /.test(line);
  const cells = (line) => line.trim().slice(1, -1).split("|").map((cell) => cell.trim());

  function parse(source) {
    const lines = String(source ?? "").replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*```/.test(line)) {
        const body = [];
        i += 1;
        while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
        i += 1;
        blocks.push({ type: "code", text: body.join("\n") });
      } else if (isRow(line)) {
        const rows = [];
        while (i < lines.length && isRow(lines[i])) rows.push(lines[i++]);
        const body = rows.filter((row) => !isDivider(row)).map(cells);
        blocks.push({ type: "table", head: body[0], rows: body.slice(1) });
      } else if (isBullet(line)) {
        const items = [];
        while (i < lines.length && isBullet(lines[i])) items.push(lines[i++].replace(/^\s*[-*] /, ""));
        blocks.push({ type: "ul", items: items.map(inline) });
      } else if (isNumbered(line)) {
        const items = [];
        while (i < lines.length && isNumbered(lines[i])) items.push(lines[i++].replace(/^\s*\d+\. /, ""));
        blocks.push({ type: "ol", items: items.map(inline) });
      } else if (line.trim() === "") {
        i += 1;
      } else {
        blocks.push({ type: "p", tokens: inline(line.trim()) });
        i += 1;
      }
    }
    return blocks;
  }

  const api = { parse, inline };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PcoMarkdown = api;
})(typeof window !== "undefined" ? window : globalThis);
