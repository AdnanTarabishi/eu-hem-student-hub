// Public academic fallback regression. Fixtures are fictional; no remote submissions.
// Run: node tests/planning/academic-copy.test.js .
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const unibo = require(path.join(ROOT, 'unibo-data.js'));
const cohort = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/programme.json'), 'utf8')).cohorts.at(-1);
const VERIFIED = '2026-10-19T08:30:00Z';
const session = {
  moduleCode: '96500', feedTitle: 'Fictional copied lesson', dateKey: '2026-10-21',
  start: '2026-10-21T14:00:00', end: '2026-10-21T16:00:00', time: '14:00 - 16:00',
  classrooms: [{ name: 'Fictional copy seminar room', floor: 'Ground floor', building: 'QA building', address: 'Fictional QA address' }],
  room: 'Fictional copy seminar room · Ground floor · Fictional QA address',
  teacher: 'QA Copy Lecturer', online: false, note: 'Fictional copied lesson.'
};
const sitting = {
  codes: ['96500'], names: ['Fictional copied assessment'], dateKey: '2026-11-02', time: '14:00',
  teachers: ['QA Exam Copy Lecturer'], type: 'Written', place: 'Fictional copied exam room',
  registrationOpens: '2026-10-13', registrationCloses: '2026-10-30', duration: '', endTime: '',
  notes: 'Fictional copied booking details.', assessmentCode: '96500'
};
function snapshot(kind, overrides = {}) {
  return { version: 1, cohort: cohort.id, source: kind === 'timetable' ? cohort.sources.timetableFeed : cohort.sources.examDates,
    sourceType: 'official', verifiedAt: VERIFIED, records: [kind === 'timetable' ? { ...session } : { ...sitting }], ...overrides };
}
function fixtureFetcher(value, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => structuredClone(value) };
  };
}

test('published academic copies preserve original verification metadata and normalized records', async () => {
  for (const kind of ['timetable', 'exams']) {
    const saved = snapshot(kind), calls = [];
    const records = await unibo.publishedAcademicCopy(kind, saved.source, { fetcher: fixtureFetcher(saved, calls) });
    assert.deepEqual([...records], saved.records);
    assert.deepEqual(records.sourceMeta, { cachedAt: VERIFIED, verifiedAt: VERIFIED, sourceType: 'published-copy' });
    assert.equal(calls.length, 1); assert.equal(calls[0].url, `calendar/${kind}.json`);
    assert.equal(calls[0].options.cache, 'no-store'); assert.ok(calls[0].options.signal instanceof AbortSignal);
    assert.ok(!Object.keys(records).includes('sourceMeta'), 'metadata does not become an academic record');
    const oldCalendar = snapshot(kind, { sourceType: 'calendar-copy', verifiedAt: null });
    const unknown = await unibo.publishedAcademicCopy(kind, oldCalendar.source, { fetcher: fixtureFetcher(oldCalendar) });
    assert.deepEqual(unknown.sourceMeta, { cachedAt: '', verifiedAt: null, sourceType: 'calendar-copy' },
      'a migrated calendar with unknown verification never receives today’s timestamp');
  }
});

test('unverified official snapshots, wrong sources and malformed records cannot mask a source failure', async () => {
  for (const kind of ['timetable', 'exams']) {
    const good = snapshot(kind);
    const invalid = [
      { ...good, source: good.source + '&wrong-source=fictional' },
      { ...good, verifiedAt: null },
      { ...good, verifiedAt: 'not-a-verification-date' },
      { ...good, version: 999 },
      { ...good, records: [{ unrelated: 'not an academic record' }] }
    ];
    for (const value of invalid) await assert.rejects(
      unibo.publishedAcademicCopy(kind, good.source, { fetcher: fixtureFetcher(value) }), /invalid|unavailable/i);
    await assert.rejects(unibo.publishedAcademicCopy(kind, good.source, {
      fetcher: async () => ({ ok: false, status: 503 })
    }), /unavailable/i);
  }
});

test('first-time visitors see dated public copies during official outages, with rooms and teachers and no fresh claim', async () => {
  const { chromium } = require('playwright');
  const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.csv':'text/csv', '.png':'image/png' };
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://fixture').pathname, file = path.resolve(ROOT, pathname.replace(/^\/hub\//, ''));
    if (!pathname.startsWith('/hub/') || !file.startsWith(ROOT + path.sep)) { res.writeHead(404); res.end(); return; }
    fs.readFile(file, (error, body) => { res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'Not found' : body); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const contexts = [];
  try {
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
    for (const unknown of [false, true]) {
      const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 }, timezoneId: 'America/New_York' });
      contexts.push(context); context.setDefaultTimeout(20000);
      await context.clock.setFixedTime(new Date('2026-10-21T08:00:00Z'));
      await context.addInitScript(() => {
        localStorage.setItem('euhem-fictional-copy-qa', 'keep this unrelated value');
        window.__academicCopyWrites = [];
        for (const method of ['setItem', 'removeItem', 'clear']) {
          const original = Storage.prototype[method];
          Storage.prototype[method] = function (...args) {
            window.__academicCopyWrites.push({ method, key: args[0] || null });
            return original.apply(this, args);
          };
        }
      });
      const sourceCalls = [], snapshotCalls = [], forbidden = [], errors = [];
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() !== 'GET') { forbidden.push(request.method() + ' ' + url.pathname); return route.abort(); }
        if (url.hostname === 'corsi.unibo.it') {
          sourceCalls.push(url.href);
          return route.fulfill({ status: 503, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'Fictional university outage' });
        }
        if (url.hostname !== '127.0.0.1') return route.abort();
        const kind = url.pathname.endsWith('/calendar/timetable.json') ? 'timetable' : url.pathname.endsWith('/calendar/exams.json') ? 'exams' : '';
        if (kind) {
          snapshotCalls.push(kind);
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify(snapshot(kind,
            unknown ? { sourceType: 'calendar-copy', verifiedAt: null } : {})) });
        }
        return route.continue();
      });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/hub/timetable.html`);
      await page.waitForFunction(() => document.getElementById('schedule-list')?.getAttribute('aria-busy') === 'false');
      const timetableStatus = await page.locator('#timetable-checked').innerText();
      assert.match(timetableStatus, /cached|saved|copy/i);
      assert.doesNotMatch(timetableStatus, /^Checked /i);
      assert.match(timetableStatus, unknown ? /unknown/i : /19 Oct 2026/);
      assert.equal(await page.locator('#timetable-sync-notice').isVisible(), true);
      await page.locator('[data-view="list"]').click();
      await page.locator('#show-teacher').check();
      assert.match(await page.locator('#schedule-list').innerText(), /Fictional copy seminar room/i);
      assert.match(await page.locator('#schedule-list').innerText(), /QA Copy Lecturer/i);
      assert.equal(await page.evaluate(() => localStorage.getItem('euhem-official-timetable-snapshot-v1')), null,
        'downloading a public copy does not create a falsely verified per-device timetable');
      assert.equal(await page.evaluate(() => localStorage.getItem('euhem-fictional-copy-qa')), 'keep this unrelated value');
      assert.ok((await page.evaluate(() => window.__academicCopyWrites)).every(write => write.method !== 'clear'),
        'the timetable outage does not clear unrelated student preferences');
      await page.goto(`http://127.0.0.1:${server.address().port}/hub/exams.html`);
      await page.waitForFunction(() => document.getElementById('exam-list')?.getAttribute('aria-busy') === 'false');
      const examStatus = await page.locator('#exam-checked').innerText();
      assert.match(examStatus, /saved|cached|copy/i);
      assert.match(examStatus, unknown ? /unknown/i : /19 Oct 2026/);
      assert.doesNotMatch(examStatus, /^Loaded 21 Oct|^Checked /i);
      const course = page.locator('.exam-course-group[data-course="right-to-health"]');
      assert.equal(await course.count(), 1);
      assert.match(await course.innerText(), /Fictional copied exam room/i);
      await course.locator('.exam-sitting-details > summary').click();
      assert.match(await course.innerText(), /QA Exam Copy Lecturer/i);
      assert.ok(await page.getByRole('button', { name: /Retry official dates/i }).count());
      await page.getByRole('button', { name: /Retry official dates/i }).click();
      await page.waitForFunction(() => document.getElementById('exam-list')?.getAttribute('aria-busy') === 'false');
      assert.match(await page.locator('#exam-checked').innerText(), unknown ? /unknown/i : /19 Oct 2026/,
        'a failed retry cannot refresh the saved copy’s verification clock');
      assert.ok(sourceCalls.some(url => url.includes('/timetable/')));
      assert.ok(sourceCalls.some(url => url.includes('/exam-dates')));
      assert.ok(snapshotCalls.includes('timetable') && snapshotCalls.includes('exams'));
      assert.equal(await page.evaluate(() => localStorage.getItem('euhem-fictional-copy-qa')), 'keep this unrelated value');
      assert.ok((await page.evaluate(() => window.__academicCopyWrites)).every(write => write.method !== 'clear'), 'source outages never clear student preferences');
      assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);
      await context.close(); contexts.splice(contexts.indexOf(context), 1);
    }
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
    if (browser) await browser.close(); await new Promise(resolve => server.close(resolve));
  }
});
