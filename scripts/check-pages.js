function pageBase(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('PAGES_INVALID_PUBLIC_URL');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

async function checkPages({ url, expectedCollectedAt, fetchImpl = globalThis.fetch }) {
  if (!expectedCollectedAt) throw new Error('PAGES_EXPECTED_TIMESTAMP_REQUIRED');
  const base = pageBase(url);
  async function get(file) {
    const response = await fetchImpl(new URL(file, base), {
      cache: 'no-store', signal: AbortSignal.timeout(20000), redirect: 'error',
    });
    if (!response.ok) throw new Error('PAGES_HTTP_ERROR');
    return response;
  }
  const html = await (await get('dashboard.html')).text();
  if (!html.includes('site-mode.js') || !html.includes('dashboard.js')) throw new Error('PAGES_HTML_INVALID');
  const mode = await (await get('site-mode.js')).text();
  if (!mode.includes('mode: "static"')) throw new Error('PAGES_MODE_INVALID');
  const report = await (await get('reports/dashboard.json')).json();
  if (report.mode !== 'static' || !Array.isArray(report.students) || !Array.isArray(report.schools) ||
      report.collectedAt !== expectedCollectedAt) throw new Error('PAGES_SNAPSHOT_NOT_CURRENT');
}

async function main() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await checkPages({ url: process.env.PAGES_URL, expectedCollectedAt: process.env.EXPECTED_COLLECTED_AT });
      console.log('Published Pages report verified.');
      return;
    } catch (error) {
      const code = /^PAGES_[A-Z_]+$/.test(error.message) ? error.message : 'PAGES_CHECK_FAILED';
      console.error('[check-pages]', code, `attempt ${attempt}/5`);
      if (attempt === 5) { process.exitCode = 1; return; }
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

if (require.main === module) main();
module.exports = { checkPages };
