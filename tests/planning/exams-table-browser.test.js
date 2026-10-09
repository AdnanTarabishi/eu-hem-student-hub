// Fictional fixtures only: source deduplication, nearest-course List and accessible Table.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || '.'), SHOTS = process.env.EXAMS_SCREENSHOT_DIR;
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const sourceDate = (date, time = '') => new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) + (time ? ' at ' + time : '');
function event(id, code, component, date, { time = '09:00', room = 'Fictional QA room', duration = '', notes = '' } = {}) {
  return `<h3 role="tab" aria-controls="${id}"><a><span class="code">${code}</span> Fixture course <span class="docente">QA Lecturer</span></a></h3><div id="${id}"><table class="single-item"><tr><th>When</th><td>${sourceDate(date, time)}</td></tr>${component ? `<tr><th>Componente:</th><td>${component} - Fixture module</td></tr>` : ''}<tr><th>Subscriptions list:</th><td><span>${sourceDate('2026-10-01')}</span><span>${sourceDate('2026-10-25')}</span></td></tr><tr><th>Test type:</th><td>scritto</td></tr><tr><th>Place:</th><td>${room}</td></tr>${duration ? `<tr><th>Duration:</th><td>${duration}</td></tr>` : ''}${notes ? `<tr><th>Notes:</th><td>${notes}</td></tr>` : ''}</table></div>`;
}
const statistics = { duration: '90 min', notes: 'Bring a calculator.' };
// Deliberately unsorted, with two repeated source blocks and distinct assessments
// sharing a parent code, date, time and room. Neither shared slots nor later dates
// are evidence that two assessments are the same.
const FEED = [
  event('later-statistics', '96525', '74948', '2026-11-20'),
  event('management', '97177', '87428', '2026-12-17'),
  event('statistics-original', '96525', '74948', '2026-10-18', statistics),
  event('statistics-repeat', '96525', '74948', '2026-10-18', statistics),
  event('statistics-whitespace', '96525', '74948', '2026-10-18', { ...statistics, room: '  FICTIONAL   QA room  ' }),
  event('fundamentals-same-slot', '96496', '96498', '2026-10-18'),
  event('econometrics-same-slot', '96525', '32626', '2026-10-18'),
  event('health-economics', '97177', '79060', '2026-10-19'),
  event('health-parent-alias', '97177', '', '2026-10-19'),
  event('health-module-alias', '79060', '', '2026-10-19'),
  event('recording', 'B1076', '', '2026-10-27'),
  event('right-to-health', '96500', '', '2026-11-05'),
  event('nearest', 'C8393', '', '2026-10-14', { time: '14:00' }),
  event('past', 'C8393', '', '2026-10-05', { time: '14:00' }),
].join('\n');
const PLAN = JSON.stringify({ version: 1, cohort: '2026-27', term: 'y1-s1', choices: { quant: '96525', elective: 'C8393' }, statuses: {}, savedAt: '2026-10-01T10:00:00Z' });

(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://test'), file = path.resolve(ROOT, url.pathname.replace(/^\/hub\//, ''));
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const BASE = `http://127.0.0.1:${server.address().port}/hub/`;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  const errors = []; let checks = 0;
  const ok = name => { checks++; console.log('  ok  ' + name); };
  const view = (page, name) => page.getByRole('button', { name, exact: true }).click();
  async function open({ width = 1440, scheme = 'light', plan = false } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: scheme, timezoneId: 'America/New_York', reducedMotion: 'reduce', serviceWorkers: 'block' });
    context.setDefaultTimeout(7000);
    await context.clock.setFixedTime(new Date('2026-10-09T17:20:00Z'));
    if (plan) await context.addInitScript(value => localStorage.setItem('euhem-study-plan-v1', value), PLAN);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'corsi.unibo.it') return route.fulfill({ contentType: 'text/html', body: FEED });
      if (url.hostname !== '127.0.0.1') return route.abort();
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE + 'exams.html');
    await page.waitForFunction(() => document.getElementById('exam-list').getAttribute('aria-busy') === 'false');
    return { page, context };
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
    for (const name of ['Cards', 'List', 'Month', 'Table']) assert.equal(await p.getByRole('button', { name, exact: true }).count(), 1);
    assert.equal(await p.getByRole('button', { name: 'List', exact: true }).getAttribute('aria-pressed'), 'true');
    const groups = p.locator('.exam-course-group');
    assert.equal(await groups.count(), 6);
    for (const group of await groups.all()) assert.equal(await group.locator('.exam-card:visible').count(), 1);
    const nearest = await groups.evaluateAll(nodes => nodes.map(node => node.querySelector('.exam-card').dataset.date));
    assert.deepEqual(nearest, ['2026-10-14', '2026-10-18', '2026-10-18', '2026-10-19', '2026-10-27', '2026-11-05']);
    assert.equal(await p.locator('.exam-card').count(), 9);
    assert.equal(await p.locator('.exam-card[data-date="2026-10-05"]').count(), 0);
    await screenshot(p, 'exams-list-nearest-desktop');
    ok('List is the default, with one visible nearest date per course in chronological order and no past dates');

    const quant = p.locator('.exam-course-group[data-course="quant-methods"]');
    const more = quant.locator('.exam-more-sittings > summary');
    assert.equal(await more.count(), 1);
    await more.focus(); await p.keyboard.press('Enter');
    assert.ok(await more.evaluate(node => node.parentElement.open));
    assert.equal(await quant.locator('.exam-card:visible').count(), 3);
    assert.match(await quant.innerText(), /Statistics for Healthcare/);
    assert.match(await quant.innerText(), /Econometrics/);
    assert.equal(await quant.locator('.exam-card[data-date="2026-11-20"]:visible').count(), 1);
    await p.keyboard.press('Enter');
    assert.equal(await quant.locator('.exam-card:visible').count(), 1);
    ok('one course-wide native disclosure exposes other modules and later sittings and works with the keyboard');

    await view(p, 'Table');
    const table = p.locator('table.exam-table'), rows = table.locator('tbody tr');
    assert.equal(await table.count(), 1);
    assert.deepEqual(await table.locator('thead th').allTextContents(), ['Course', 'Teacher', 'Date', 'Time (Bologna)', 'Duration', 'Location', 'Format', 'Notes', 'Registration', 'Actions']);
    assert.equal(await rows.count(), 9);
    const dates = await rows.evaluateAll(nodes => nodes.map(node => node.dataset.date));
    assert.deepEqual(dates, [...dates].sort());
    assert.equal(await rows.locator('th,td').count(), 90);
    assert.equal(await rows.locator('th[scope="row"]').count(), 9);
    const shared = table.locator('tbody tr[data-date="2026-10-18"]');
    assert.equal(await shared.count(), 3);
    assert.equal(await shared.filter({ hasText: 'Statistics for Healthcare' }).count(), 2);
    assert.equal(await shared.filter({ hasText: 'Econometrics' }).count(), 1);
    const statisticsRow = table.locator('tbody tr[data-course="quant-methods"][data-date="2026-10-18"]').filter({ hasText: 'Statistics for Healthcare' });
    assert.equal(await statisticsRow.count(), 1);
    assert.match(await statisticsRow.innerText(), /QA Lecturer/i);
    assert.match(await statisticsRow.locator('th,td').nth(3).innerText(), /09:00/);
    assert.equal(await statisticsRow.locator('th,td').nth(4).innerText(), '90 min');
    assert.match(await statisticsRow.locator('th,td').nth(7).innerText(), /Bring a calculator\./);
    const missing = table.locator('tbody tr[data-course="fund-quant-methods"]');
    assert.equal(await missing.locator('th,td').nth(4).innerText(), 'Not published');
    const administrative = table.locator('tbody tr[data-kind="administrative"]');
    assert.equal(await administrative.count(), 1);
    assert.equal(await administrative.locator('th,td').nth(4).innerText(), 'Not applicable');
    assert.match(await administrative.innerText(), /No final exam|No final examination/);
    assert.match(await administrative.innerText(), /recording/i);
    assert.equal(await administrative.getByRole('button', { name: /Add exam:/ }).count(), 0);
    assert.equal(await administrative.getByRole('button', { name: /Add recording reminder:/ }).count(), 1);
    assert.equal(await statisticsRow.getByRole('link', { name: /Register on AlmaEsami/ }).count(), 1);
    assert.equal(await statisticsRow.getByRole('button', { name: /Add exam:/ }).count(), 1);
    await screenshot(p, 'exams-table-desktop');
    ok('Table deduplicates repeated source blocks while preserving three genuinely different same-slot assessments and all nine future sittings');
    ok('Table has every essential column, published notes/duration, honest missing duration, booking actions and distinct administrative guidance');

    const scroll = p.locator('.exam-table-scroll');
    assert.equal(await scroll.getAttribute('tabindex'), '0');
    assert.equal(await scroll.getAttribute('role'), 'region');
    assert.ok(await scroll.getAttribute('aria-label') || await scroll.getAttribute('aria-labelledby'));
    await scroll.focus(); assert.equal(await scroll.evaluate(node => node === document.activeElement), true);
    const instructions = administrative.locator('.exam-admin-instructions > summary');
    await instructions.focus(); await p.keyboard.press('Enter');
    assert.ok(await instructions.evaluate(node => node.parentElement.open));
    assert.match(await administrative.innerText(), /Virtuale|Tuesday/);
    await p.keyboard.press('Enter');
    ok('Table scrolling is keyboard reachable and native administrative details retain full guidance');

    await p.locator('#exam-course-filter').selectOption('quant-methods');
    assert.equal(await rows.count(), 3);
    await view(p, 'List'); assert.equal(await p.locator('.exam-course-group').count(), 1);
    assert.equal(await p.locator('#exam-course-filter').inputValue(), 'quant-methods');
    await p.locator('.exam-more-sittings > summary').click();
    await view(p, 'Table'); assert.equal(await rows.count(), 3);
    await view(p, 'List'); assert.ok(await p.locator('.exam-more-sittings').evaluate(node => node.open));
    await view(p, 'Cards'); assert.equal(await p.locator('.exam-card:visible').count(), 2);
    await view(p, 'Month'); assert.equal(await p.locator('.exam-card').count(), 2);
    assert.match(await p.locator('[data-day="2026-10-18"]').getAttribute('aria-label'), /2 exam sittings, 0 administrative recordings/);
    await view(p, 'Table'); await p.locator('#exam-search').fill('calculator');
    assert.equal(await rows.count(), 1);
    await p.locator('#exam-reset').click(); assert.equal(await rows.count(), 9);
    await p.locator('#exam-registration-filter').selectOption('open'); assert.equal(await rows.count(), 9);
    await view(p, 'Month'); assert.match(await p.locator('[data-day="2026-10-27"]').getAttribute('aria-label'), /0 exam sittings, 1 administrative recording/);
    await c.close();
    ok('shared filters and disclosure state survive every view; note search and registration filters apply to Table and Month truthfully');

    ({ page: p, context: c } = await open({ plan: true }));
    await view(p, 'Table');
    assert.equal(await p.locator('tbody tr[data-course="fund-quant-methods"]').count(), 0);
    assert.equal(await p.locator('tbody tr[data-kind="administrative"]').count(), 0);
    await p.locator('.my-courses-switch input').uncheck();
    assert.equal(await p.locator('.exam-table tbody tr').count(), 9);
    await c.close();
    ok('Table respects the saved course plan and restores the complete collection when My courses is disabled');

    for (const width of [320, 390, 768, 1440]) for (const scheme of ['light', 'dark']) {
      ({ page: p, context: c } = await open({ width, scheme }));
      for (const name of ['List', 'Table', 'Cards', 'Month']) {
        await view(p, name);
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${width}px ${scheme} ${name} page overflow`);
      }
      if (width === 390 || (width === 1440 && scheme === 'dark')) {
        await view(p, 'List');
        await screenshot(p, `exams-list-${width === 390 ? 'phone' : 'desktop'}-${scheme}`);
      }
      await view(p, 'Table');
      if (width <= 390) {
        assert.ok(await p.locator('.exam-table-scroll').evaluate(node => node.scrollWidth > node.clientWidth));
        const geometry = await p.locator('.exam-table-scroll').evaluate(node => {
          const course = node.querySelector('tbody th').getBoundingClientRect();
          return { container: node.clientWidth, course: course.width, usable: node.clientWidth - course.width };
        });
        assert.ok(geometry.usable >= 150, `${width}px ${scheme}: sticky course leaves only ${geometry.usable}px for other columns`);
        console.log(`  geometry  ${width}px ${scheme}: ${geometry.container}px table viewport, ${geometry.course}px course, ${geometry.usable}px readable columns`);
        if (width === 390) await screenshot(p, `exams-table-phone-${scheme}`);
        await p.locator('.exam-table-scroll').focus();
        await p.keyboard.press('ArrowRight');
        await p.waitForFunction(() => document.querySelector('.exam-table-scroll').scrollLeft > 0);
        await p.locator('.exam-table-scroll').evaluate(node => { node.scrollLeft = 0; });
        await p.locator('.exam-table thead').hover();
        await p.mouse.wheel(700, 0);
        await p.waitForFunction(() => document.querySelector('.exam-table-scroll').scrollLeft > 0);
        assert.ok(await p.locator('.exam-table-scroll').evaluate(node => node.scrollLeft > 0));
        if (width === 390) await screenshot(p, `exams-table-phone-pan-${scheme}`);
        await p.locator('.exam-table-scroll').evaluate(node => { node.scrollLeft = node.scrollWidth; });
        const actionsGeometry = await p.locator('.exam-table-scroll').evaluate(node => {
          const frame = node.getBoundingClientRect(), course = node.querySelector('tbody th').getBoundingClientRect();
          const actions = node.querySelector('tbody tr td:last-child').getBoundingClientRect();
          return { visible: Math.min(frame.right - 1, actions.right) - Math.max(course.right, actions.left), overlap: course.right - actions.left };
        });
        assert.ok(actionsGeometry.visible >= 150, `${width}px ${scheme}: only ${actionsGeometry.visible}px of the Actions cell remains visible`);
        assert.ok(actionsGeometry.overlap <= 2, `${width}px ${scheme}: sticky course hides ${actionsGeometry.overlap}px of the final Actions cell`);
        await screenshot(p, `exams-table-phone-${width}-actions-${scheme}`);
        if (SHOTS && width === 320) {
          await p.locator('.exam-table-scroll').evaluate(node => window.scrollTo(0, window.scrollY + node.querySelector('thead').getBoundingClientRect().top - 48));
          await p.screenshot({ path: path.join(SHOTS, `exams-table-phone-320-actions-viewport-${scheme}.png`), fullPage: false });
        }
      }
      if (width === 1440 && scheme === 'dark') await screenshot(p, 'exams-table-desktop-dark');
      await c.close();
    }
    ok('all four views fit 320–1440px in both themes; the mobile table scrolls within its own labelled region');
    assert.deepEqual(errors, []); ok('no uncaught browser errors');
    console.log(`${checks} Exams table and default List browser groups passed`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
