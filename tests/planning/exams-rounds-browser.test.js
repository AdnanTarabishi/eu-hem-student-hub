// Fictional source records only. No external requests or student data are used.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || '.'), SHOTS = process.env.EXAMS_SCREENSHOT_DIR;
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const sourceDate = (date, time = '') => new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) + (time ? ' at ' + time : '');
const before = (date, days) => new Date(new Date(date + 'T12:00:00Z').getTime() - days * 86400000).toISOString().slice(0, 10);
function event(id, code, component, date, { time = '09:00', notes = '', duration = '' } = {}) {
  return `<h3 role="tab" aria-controls="${id}"><a><span class="code">${code}</span> Fictional course <span class="docente">QA Lecturer</span></a></h3><div id="${id}"><table class="single-item"><tr><th>When</th><td>${sourceDate(date, time)}</td></tr>${component ? `<tr><th>Componente:</th><td>${component} - Fictional module</td></tr>` : ''}<tr><th>Subscriptions list:</th><td><span>${sourceDate(before(date, 14))}</span><span>${sourceDate(before(date, 2))}</span></td></tr><tr><th>Test type:</th><td>scritto</td></tr><tr><th>Place:</th><td>Fictional QA room</td></tr>${notes ? `<tr><th>Notes:</th><td>${notes}</td></tr>` : ''}${duration ? `<tr><th>Duration:</th><td>${duration}</td></tr>` : ''}</table></div>`;
}
const FEED = [
  event('summer', '96525', '74948', '2027-07-02'),
  event('new-year', '96525', '74948', '2027-01-01', { duration: '90 min', notes: 'Bring a calculator.' }),
  event('new-year-parent', '96525', '', '2027-01-01', { duration: '90 min', notes: 'Bring a calculator.' }),
  event('new-year-standalone', '74948', '', '2027-01-01', { duration: '90 min', notes: 'Bring a calculator.' }),
  event('late-december', '97177', '79060', '2026-12-31'),
  event('late-december-parent', '97177', '', '2026-12-31'),
  event('late-december-repeat', '97177', '79060', '2026-12-31'),
  event('late-december-standalone', '79060', '', '2026-12-31'),
  event('january', '97177', '79060', '2027-01-22'),
  event('right-to-health', '96500', '', '2027-01-22', { time: '11:00' }),
  event('february', '96496', '96498', '2027-02-06'),
  event('first-only', 'C8393', '', '2026-10-14', { time: '14:00' }),
  event('recording', 'B1076', '', '2026-10-27'),
  event('past', 'C8393', '', '2026-09-20'),
].join('\n');
const PLAN = JSON.stringify({ version: 1, cohort: '2026-27', term: 'y1-s1', choices: { quant: '96525', elective: 'C8393' }, statuses: {}, savedAt: '2026-10-01T10:00:00Z' });
const FIRST_DATES = ['2026-10-14', '2026-10-27', '2026-12-31'];
const SECOND_DATES = ['2027-01-01', '2027-01-22', '2027-01-22', '2027-02-06', '2027-07-02'];

(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://test'), file = path.resolve(ROOT, url.pathname.replace(/^\/hub\//, ''));
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const BASE = `http://127.0.0.1:${server.address().port}/hub/`;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  let checks = 0; const errors = [];
  const ok = name => { checks++; console.log('  ok  ' + name); };
  const view = (page, name) => page.getByRole('button', { name, exact: true }).click();
  const rows = page => page.locator('.exam-table tbody tr');
  const dates = page => rows(page).evaluateAll(nodes => nodes.map(node => node.dataset.date));
  async function open({ width = 1440, scheme = 'light', feed = FEED, now = '2026-10-09T17:20:00Z', plan = false, failOnce = false } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: scheme, timezoneId: 'America/New_York', reducedMotion: 'reduce', serviceWorkers: 'block' });
    context.setDefaultTimeout(7000);
    await context.clock.setFixedTime(new Date(now));
    if (plan) await context.addInitScript(value => localStorage.setItem('euhem-study-plan-v1', value), PLAN);
    let failed = false;
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'corsi.unibo.it') {
        if (failOnce && !failed) { failed = true; return route.fulfill({ status: 503, body: 'unavailable' }); }
        return route.fulfill({ contentType: 'text/html', body: feed });
      }
      if (url.hostname !== '127.0.0.1') return route.abort();
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE + 'exams.html');
    await page.waitForFunction(() => document.getElementById('exam-list').getAttribute('aria-busy') === 'false');
    return { page, context };
  }
  async function assertRound(page, id, expectedDates) {
    assert.equal(await page.locator('#exam-list').getAttribute('data-round'), id);
    assert.equal(await page.locator('#exam-round-title').innerText(), id === 'first' ? 'First round' : 'Second round');
    assert.match(await page.locator('#exam-round-position').innerText(), id === 'first' ? /1\s*\/\s*2/ : /2\s*\/\s*2/);
    assert.equal(await page.locator('#exam-round-prev').isDisabled(), id === 'first');
    assert.equal(await page.locator('#exam-round-next').isDisabled(), id === 'second');
    assert.deepEqual(await dates(page), expectedDates);
    assert.equal(await page.locator('.exam-table:visible').count(), expectedDates.length ? 1 : 0);
  }
  async function screenshot(page, name) {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
    await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true });
  }
  try {
    let { page: p, context: c } = await open();
    assert.equal(await p.locator('#exam-list').getAttribute('data-view'), 'list');
    assert.equal(await p.locator('#exam-rounds').isVisible(), false);
    await view(p, 'Table');
    assert.equal(await p.locator('#exam-rounds').isVisible(), true);
    assert.equal(await p.getByRole('button', { name: 'Previous exam round', exact: true }).count(), 1);
    assert.equal(await p.getByRole('button', { name: 'Next exam round', exact: true }).count(), 1);
    await assertRound(p, 'first', FIRST_DATES);
    assert.match(await p.locator('#exam-round-meta').innerText(), /Before .*2027.*3 upcoming dates/);
    assert.equal(await p.locator('tr[data-date="2026-12-31"]').count(), 1);
    const admin = p.locator('tbody tr[data-kind="administrative"]');
    assert.equal(await admin.count(), 1);
    assert.match(await admin.innerText(), /No final exam/);
    assert.equal(await admin.getByRole('button', { name: /Add recording reminder:/ }).count(), 1);
    assert.equal(await admin.getByRole('button', { name: /Add exam:/ }).count(), 0);
    await screenshot(p, 'exams-first-round-desktop-light');
    ok('Table opens First round with a single chronological table, deduplicated December aliases and a distinct administrative reminder');

    const next = p.locator('#exam-round-next'), previous = p.locator('#exam-round-prev');
    await next.focus(); await p.keyboard.press('Enter');
    await assertRound(p, 'second', SECOND_DATES);
    assert.equal(await previous.evaluate(node => node === document.activeElement), true);
    assert.equal(await p.locator('#exam-round-status').getAttribute('aria-live'), 'polite');
    assert.match(await p.locator('#exam-round-status').textContent(), /Second round.*5/i);
    assert.match(await p.locator('#exam-round-meta').innerText(), /2027/);
    assert.equal(await p.locator('tr[data-date="2027-01-01"]').count(), 1);
    assert.equal(await p.locator('tbody tr[data-kind="administrative"]').count(), 0);
    await screenshot(p, 'exams-second-round-desktop-light');
    await p.keyboard.press('Enter');
    await assertRound(p, 'first', FIRST_DATES);
    assert.equal(await next.evaluate(node => node === document.activeElement), true);
    assert.match(await p.locator('#exam-round-status').textContent(), /First round.*3/i);
    await p.keyboard.press('ArrowRight'); await assertRound(p, 'second', SECOND_DATES);
    await p.keyboard.press('ArrowRight'); await assertRound(p, 'second', SECOND_DATES);
    await p.keyboard.press('ArrowLeft'); await assertRound(p, 'first', FIRST_DATES);
    ok('keyboard arrows preserve enabled focus, announce the round and date count, and retain Jan 1, January, February and later published dates');

    await next.click(); await view(p, 'Cards');
    assert.equal(await p.locator('#exam-rounds').isVisible(), false);
    assert.equal(await p.locator('.exam-card').count(), 8);
    await view(p, 'Table'); await assertRound(p, 'second', SECOND_DATES);
    await p.locator('#exam-course-filter').selectOption('fund-health-econ-management');
    await assertRound(p, 'second', ['2027-01-22']);
    await p.locator('#exam-search').fill('calculator');
    await assertRound(p, 'second', []);
    assert.equal(await p.locator('#exam-rounds').isVisible(), true);
    await p.locator('#exam-reset').click(); await assertRound(p, 'second', SECOND_DATES);
    await p.locator('#exam-search').fill('calculator');
    await assertRound(p, 'second', ['2027-01-01']);
    assert.equal(await rows(p).getByRole('button', { name: /Add exam:/ }).count(), 1);
    assert.equal(await rows(p).locator('th,td').nth(4).innerText(), '90 min');
    const downloading = p.waitForEvent('download');
    await rows(p).getByRole('button', { name: /Add exam:/ }).click();
    const download = await downloading, ics = fs.readFileSync(await download.path(), 'utf8');
    assert.match(ics, /SUMMARY:Exam:/); assert.match(ics, /20270101T090000/);
    await p.locator('#exam-reset').click();
    ok('selected round survives view changes and shared filters/reset; source notes, published duration and calendar actions remain available');

    await previous.click();
    await p.locator('#exam-course-filter').selectOption('right-to-health');
    await assertRound(p, 'first', []);
    assert.match(await p.locator('#exam-list').innerText(), /No .*dates|No .*exams/i);
    const otherRound = p.locator('#exam-list').getByRole('button', { name: /Second round/i });
    assert.equal(await otherRound.count(), 1);
    await otherRound.click(); await assertRound(p, 'second', ['2027-01-22']);
    assert.equal(await p.locator('#exam-course-filter').inputValue(), 'right-to-health');
    await p.locator('#exam-course-filter').selectOption('health-systems');
    await assertRound(p, 'second', []);
    await p.locator('#exam-list').getByRole('button', { name: /First round/i }).click();
    await assertRound(p, 'first', ['2026-10-14']);
    await p.locator('#exam-reset').click(); await next.click();
    await p.locator('#exam-registration-filter').selectOption('open');
    await assertRound(p, 'second', []);
    await p.locator('#exam-list').getByRole('button', { name: /First round/i }).click();
    await assertRound(p, 'first', ['2026-10-14']);
    await c.close();
    ok('an empty selected round keeps navigation visible and offers the other matching table without clearing course or booking filters');

    ({ page: p, context: c } = await open({ plan: true }));
    await view(p, 'Table');
    await assertRound(p, 'first', ['2026-10-14', '2026-12-31']);
    await p.locator('#exam-round-next').click();
    await assertRound(p, 'second', ['2027-01-01', '2027-01-22', '2027-01-22', '2027-07-02']);
    await p.locator('.my-courses-switch input').uncheck();
    await assertRound(p, 'second', SECOND_DATES);
    await c.close();
    ok('both round tables respect My courses and restore all matching dates when the saved-plan scope is disabled');

    ({ page: p, context: c } = await open({ now: '2027-01-09T17:20:00Z' }));
    await view(p, 'Table');
    await assertRound(p, 'second', ['2027-01-22', '2027-01-22', '2027-02-06', '2027-07-02']);
    await c.close();
    ({ page: p, context: c } = await open({ feed: event('january-only', '96525', '74948', '2027-01-22'), plan: true }));
    await view(p, 'Table'); await assertRound(p, 'second', ['2027-01-22']);
    await c.close();
    ({ page: p, context: c } = await open({ feed: '', now: '2027-08-01T17:20:00Z' }));
    await view(p, 'Table');
    assert.equal(await p.locator('#exam-rounds').isVisible(), true);
    assert.equal(await p.locator('.exam-table').count(), 0);
    assert.match(await p.locator('#exam-list').innerText(), /No .*dates|No .*exams/i);
    assert.equal(await p.locator('#exam-list').getByRole('button', { name: /(?:First|Second) round/i }).count(), 0);
    await c.close();
    ok('first entry selects Second round after New Year or with a January-only source, while no future dates remain an explicit empty state');

    ({ page: p, context: c } = await open({ failOnce: true }));
    assert.match(await p.locator('#exam-feed-notice').innerText(), /incomplete/);
    await view(p, 'Table'); await assertRound(p, 'first', ['2026-10-27']);
    await p.locator('#exam-round-next').click(); await assertRound(p, 'second', []);
    assert.match(await p.locator('#exam-feed-notice').innerText(), /incomplete/);
    await p.getByRole('button', { name: 'Retry official dates', exact: true }).click();
    await p.waitForFunction(() => document.getElementById('exam-list').getAttribute('aria-busy') === 'false' && document.querySelectorAll('.exam-table tbody tr').length === 5);
    await assertRound(p, 'second', SECOND_DATES);
    assert.equal(await p.locator('#exam-feed-notice').innerText(), '');
    await c.close();
    ok('source failure remains visible in either round and a successful retry preserves the selected round without duplicated dates');

    for (const width of [320, 390, 768, 1440]) for (const scheme of ['light', 'dark']) {
      ({ page: p, context: c } = await open({ width, scheme }));
      await view(p, 'Table');
      for (const id of ['first', 'second']) {
        await assertRound(p, id, id === 'first' ? FIRST_DATES : SECOND_DATES);
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${width}px ${scheme} ${id} page overflow`);
        const bounds = await p.locator('#exam-rounds').evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: document.documentElement.clientWidth }; });
        assert.ok(bounds.left >= 0 && bounds.right <= bounds.width, `${width}px ${scheme} ${id}: round controls outside viewport`);
        const enabled = p.locator(id === 'first' ? '#exam-round-next' : '#exam-round-prev');
        const size = await enabled.evaluate(node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height }; });
        assert.ok(size.width >= 44 && size.height >= 44, `${width}px ${scheme} ${id}: arrow touch target smaller than 44px`);
        if (width <= 390) assert.ok(await p.locator('.exam-table-scroll').evaluate(node => node.scrollWidth > node.clientWidth));
        if (width === 390 || width === 1440) await screenshot(p, `exams-${id}-round-${width === 390 ? 'phone' : 'desktop'}-${scheme}`);
        if (id === 'first') await enabled.click();
      }
      await c.close();
    }
    ok('both round tables and arrow controls fit 320–1440px in both themes with accessible touch targets and internal table scrolling');
    assert.deepEqual(errors, []); ok('no uncaught browser errors');
    console.log(`${checks} Exams round browser groups passed`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
