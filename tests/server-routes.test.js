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

test('the studio shell and its problem files are served by the Node server', async t => {
  const base = await listen(t);
  for (const route of ['/', '/studio', '/new.html']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), /<script src="\.\/studio-core\.js">/, route);
  }
  const problem = await fetch(`${base}/curriculum/step-01/hello.json`);
  assert.equal(problem.status, 200);
  assert.match(problem.headers.get('content-type'), /^application\/json/);
  assert.equal((await problem.json()).id, 'hello');
});

test('the old Google Sites style studio address redirects so the studio files resolve', async t => {
  const base = await listen(t);
  const response = await fetch(`${base}/dge.go.kr/pco`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/new.html');
});
