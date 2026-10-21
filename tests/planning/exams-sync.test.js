// Academic refresh regression tests. All records and rooms are fictional.
// Run: node tests/planning/exams-sync.test.js .
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const data = require(path.join(ROOT, 'unibo-data.js'));
const BASE = 'https://corsi.unibo.it/2cycle/euHealthEconomicsManagement/exam-dates';

function exam(code = '96500', id = 'qa-health', date = '04 November 2026 at 13:00') {
  return `<h3 role="tab" aria-controls="${id}"><a><span class="code">${code}</span> Fictional assessment <span class="docente">QA Lecturer</span></a></h3><div id="${id}"><table class="single-item"><tr><th>When</th><td>${date}</td></tr><tr><th>Place:</th><td>Fictional audit room</td></tr><tr><th>Test type:</th><td>Scritto</td></tr><tr><th>Subscriptions list:</th><td><span>21 October 2026</span><span>01 November 2026</span></td></tr></table></div>`;
}
function response(html, { status = 200, cachedAt = '' } = {}) {
  return { ok: status >= 200 && status < 300, status,
    headers: new Headers(cachedAt ? { 'x-saved-at': cachedAt } : {}), text: async () => html };
}
function options(fetcher, extra = {}) {
  return { fetcher, attempts: 2, delayMs: 1, timeoutMs: 1000, pause: async () => {}, ...extra };
}

test('official exam requests follow relative pagination and bypass the browser HTTP cache', async () => {
  const first = exam() + '<nav><a rel="next" href="?b_start:int=20&amp;b_size:int=20">Next</a></nav>';
  const second = exam('74948', 'qa-statistics', '03 November 2026 at 11:00');
  const calls = [];
  const result = await data.requestOfficialExams(BASE, options(async (url, init) => {
    calls.push({ url: String(url), init }); return response(calls.length === 1 ? first : second);
  }));
  assert.deepEqual(result.pages, [first, second]);
  assert.equal(result.sourceUrls.length, 2);
  assert.equal(new URL(calls[1].url).origin, new URL(BASE).origin);
  assert.equal(new URL(calls[1].url).searchParams.get('b_start:int'), '20');
  assert.equal(new URL(calls[1].url).searchParams.get('b_size:int'), '20');
  assert.equal(result.cachedAt, '');
  for (const call of calls) {
    assert.equal(call.init.cache, 'no-store');
    assert.ok(call.init.signal instanceof AbortSignal, 'each request has a bounded abort signal');
  }
});

test('next-class pagination retains the oldest saved-copy date across all pages', async () => {
  const dates = ['2026-10-18T08:00:00Z', '2026-10-03T09:30:00Z'];
  let count = 0;
  const result = await data.requestOfficialExams(BASE, options(async () => {
    const index = count++;
    return response(exam() + (index ? '' : '<li class="next"><a href="?b_start:int=20">Next</a></li>'), { cachedAt: dates[index] });
  }));
  assert.equal(result.pages.length, 2);
  assert.equal(result.cachedAt, dates[1], 'a recent first page must not hide an older second page');
});

test('transient official exam errors retry, while HTTP 404 stops immediately', async () => {
  let count = 0;
  const pauses = [];
  const result = await data.requestOfficialExams(BASE, options(async () => response(exam(), { status: ++count === 1 ? 503 : 200 }), {
    pause: async milliseconds => pauses.push(milliseconds)
  }));
  assert.equal(result.pages.length, 1); assert.equal(count, 2); assert.equal(pauses.length, 1);
  count = 0;
  await assert.rejects(data.requestOfficialExams(BASE, options(async () => { count++; return response('', { status: 404 }); })), /404/);
  assert.equal(count, 1, 'permanent errors do not repeat');
});

test('failure on a later exam page never returns a silently incomplete collection', async () => {
  const calls = [];
  await assert.rejects(data.requestOfficialExams(BASE, options(async url => {
    calls.push(String(url));
    return response(calls.length === 1 ? exam() + '<a rel="next" href="?b_start:int=20">Next</a>' : '', { status: calls.length === 1 ? 200 : 503 });
  })), /503|page|exam/i);
  assert.ok(calls.length >= 2);
});

test('exam pagination rejects cross-origin links and repeated next-page loops', async () => {
  let count = 0;
  await assert.rejects(data.requestOfficialExams(BASE, options(async () => {
    count++; return response(exam() + '<a rel="next" href="https://example.invalid/collect">Next</a>');
  })), /origin|page|source|link|exam/i);
  assert.equal(count, 1, 'the untrusted destination is never fetched');
  count = 0;
  await assert.rejects(data.requestOfficialExams(BASE, options(async () => {
    count++; return response(exam() + '<a rel="next" href="?b_start:int=20">Next</a>');
  })), /loop|page|repeat|cycle|exam/i);
  assert.ok(count <= 2, 'a repeated page cannot cause unbounded requests');
});

test('an unbounded official pagination chain fails rather than claiming completeness', async () => {
  let count = 0;
  await assert.rejects(data.requestOfficialExams(BASE, options(async () => {
    count++; return response(exam() + `<a rel="next" href="?b_start:int=${count * 20}">Next</a>`);
  })), /limit|page|many|exam/i);
  assert.ok(count <= 20, 'pagination is capped at twenty source pages');
});

test('HTTP 200 error markup is rejected, while an explicit no-exams page is valid', async () => {
  await assert.rejects(data.requestOfficialExams(BASE, options(async () => response('<html><body>Temporary backend error</body></html>'))), /exam|response|page|recogn/i);
  const result = await data.requestOfficialExams(BASE, options(async () => response('<html><h1>Exam dates</h1><p>No upcoming exams.</p></html>')));
  assert.equal(result.pages.length, 1);
});

test('the visible exam workspace identifies a dated cached source and refreshes all pages truthfully', async () => {
  const { chromium } = require('playwright');
  const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.csv':'text/csv', '.png':'image/png' };
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://fixture').pathname;
    const file = path.resolve(ROOT, pathname.replace(/^\/hub\//, ''));
    if (!pathname.startsWith('/hub/') || !file.startsWith(ROOT + path.sep)) { res.writeHead(404); res.end(); return; }
    fs.readFile(file, (error, body) => { res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'Not found' : body); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser, context;
  try {
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
    context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    await context.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'));
    let cached = true;
    const calls = [], errors = [], forbidden = [];
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') { forbidden.push(request.method() + ' ' + url.pathname); return route.abort(); }
      if (url.hostname === 'corsi.unibo.it') {
        calls.push(url.href);
        const second = url.searchParams.get('b_start:int') === '20';
        return route.fulfill({ contentType: 'text/html', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-saved-at', ...(cached ? { 'x-saved-at': '2026-10-03T09:30:00Z' } : {}) },
          body: second ? exam('74948', 'qa-statistics', '03 November 2026 at 11:00') : exam() + '<a rel="next" href="?b_start:int=20">Next</a>' });
      }
      if (url.hostname !== '127.0.0.1') return route.abort();
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/hub/exams.html`);
    await page.waitForFunction(() => document.getElementById('exam-list')?.getAttribute('aria-busy') === 'false');
    const checked = await page.locator('#exam-checked').innerText();
    assert.match(checked, /saved|cached|copy/i);
    assert.match(checked, /2026|Oct|October|10-03|03\/10/i, 'the actual copy date is visible');
    assert.doesNotMatch(checked, /^Loaded 21 Oct/i, 'a cached response is never relabelled as a fresh current check');
    assert.equal(await page.locator('.exam-registration.is-open').count(),0,'a saved booking window is not a confirmed current registration opening');
    assert.match(await page.locator('#exam-summary').innerText(),/Saved booking windows/i);
    assert.doesNotMatch(await page.locator('#exam-summary').innerText(),/Registration open|days to register|Closes today/i);
    assert.match(await page.locator('#open-registrations').innerText(),/saved booking window/i);
    assert.doesNotMatch(await page.locator('#open-registrations').innerText(),/windows? open|Register on AlmaEsami/i);
    assert.equal(await page.locator('.exam-course-group[data-course="right-to-health"]').count(), 1);
    assert.equal(await page.locator('.exam-course-group[data-course="quant-methods"]').count(), 1, 'the second page contributes its distinct module');
    assert.ok(calls.some(url => new URL(url).searchParams.get('b_start:int') === '20'));
    const retry = page.getByRole('button', { name: /Retry|Refresh/i });
    assert.ok(await retry.count() > 0, 'the dated copy retains a visible refresh action');
    cached = false; await retry.first().click();
    await page.waitForFunction(() => document.getElementById('exam-list')?.getAttribute('aria-busy') === 'false' && !/saved|cached|copy/i.test(document.getElementById('exam-checked').textContent));
    assert.match(await page.locator('#exam-checked').innerText(), /Loaded|Checked|retrieved/i);
    assert.match(await page.locator('#exam-summary').innerText(),/Registration open/i,'fresh verification restores current booking labels');
    assert.equal(await page.locator('.exam-course-group[data-course="quant-methods"]').count(), 1);
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  } finally {
    if (context) await context.close(); if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
