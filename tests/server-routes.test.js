const assert = require('node:assert/strict');
const test = require('node:test');
const { createServer } = require('../server');

async function listen(t) {
  const server = createServer({ loginHandler: () => {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('the studio shell, its scripts and its problem files are served by the Node server', async t => {
  const base = await listen(t);
  for (const route of ['/', '/studio', '/new.html']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), /<script src="\.\/studio-core\.js">/, route);
  }
  for (const file of ['studio-catalog.js', 'studio-progress.js', 'studio-sync.js', 'studio-markdown.js', 'studio-core.js', 'studio-app.js', 'studio-learn.js', 'studio-quiz.js']) {
    const response = await fetch(`${base}/${file}`);
    assert.equal(response.status, 200, file);
    assert.match(response.headers.get('content-type'), /javascript/, file);
  }
  const problem = await fetch(`${base}/curriculum/step-01/l01_01.json`);
  assert.equal(problem.status, 200);
  assert.match(problem.headers.get('content-type'), /^application\/json/);
  assert.equal((await problem.json()).id, 'l01_01');
  const level = await fetch(`${base}/curriculum/step-10/level.json`);
  assert.equal((await level.json()).level, 10);
  const placement = await fetch(`${base}/curriculum/placement.json`);
  assert.equal((await placement.json()).items.length, 45);
});

test('the old Google Sites style studio address redirects so the studio files resolve', async t => {
  const base = await listen(t);
  const response = await fetch(`${base}/dge.go.kr/pco`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/new.html');
});
