// Focused real-browser regression for the Fundamentals quiz workspace.
// Run: node tests/fund-statistics/quizzes-browser.test.js .
// All requests stay on a local GitHub Pages-style subdirectory. No private data is used.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || '.');
const OUTPUT = process.env.FUND_QUIZ_SCREENSHOT_DIR || path.join(ROOT, 'work/fund-quiz-upgrade');
const PROGRESS_KEY = 'euhem-progress-v1';
const QUIZ_KEY = 'fund-statistics.quiz-v1';
const PREFIX = '/eu-hem-student-hub/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.csv': 'text/csv', '.webmanifest': 'application/manifest+json' };
const read = name => JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
const normalise = value => String(value).replace(/\s+/g, ' ').trim();

(async () => {
  const legacy = read('content/modules/fund-statistics/questions.json');
  const supplemental = read('content/modules/fund-statistics/self-tests.json');
  const questions = [...legacy, ...supplemental.questions].map(q => ({ ...q,
    answer: q.type === 'mcq' && typeof q.answer === 'string' ? q.answer.charCodeAt(0) - 65 : q.answer,
  }));
  const byId = new Map(questions.map(q => [q.id, q]));
  const newIds = new Set(supplemental.questions.map(q => q.id));
  const coreTopics = ['descriptive', 'distributions', 'estimation', 'confidence-intervals', 'hypothesis-tests'].map(id => 'fund-statistics.' + id);
  const preserved = {
    topics: { 'statistics.normal': 'read' },
    cards: { 'statistics.fixture-card': { reviews: 2, due: '2026-11-03', interval: 4 } },
    quizzes: { statistics: { best: 60, attempts: 2 } },
    lectures: { 'statistics.normal': { fixture: 'retain other module' } },
    statistics: {
      'fund-statistics.cases': { version: 1, fixture: 'retain worked cases' },
      'fund-statistics.labs': { version: 1, fixture: 'retain laboratory work' },
      'statistics.fixture': { fixture: 'retain separate statistics module' },
    },
  };
  const initialProgress = { version: 1, ...preserved, activity: ['2026-10-31'] };
  const errors = [];
  const contexts = [];
  let browser;
  let checks = 0;
  const ok = description => { checks++; console.log('  ok  ' + description); };

  const server = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://local.test').pathname); }
    catch { response.writeHead(400); return response.end('Invalid path'); }
    if (!pathname.startsWith(PREFIX)) { response.writeHead(404); return response.end('Outside test prefix'); }
    const file = path.resolve(ROOT, pathname.slice(PREFIX.length) || 'index.html');
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404); return response.end('Missing local fixture');
    }
    response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    response.end(fs.readFileSync(file));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}${PREFIX}`;

  async function open(options = {}) {
    const { seed = initialProgress, blocked = false, ...settings } = options;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block', ...settings });
    contexts.push(context);
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    if (seed) await context.addInitScript(({ key, value }) => {
      if (sessionStorage.getItem('fsq-browser-fixture') !== 'seeded') {
        localStorage.setItem(key, JSON.stringify(value));
        sessionStorage.setItem('fsq-browser-fixture', 'seeded');
      }
    }, { key: PROGRESS_KEY, value: seed });
    if (blocked) await context.addInitScript(() => {
      Storage.prototype.setItem = function () { throw new Error('Storage blocked in this fictional browser fixture'); };
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.stack || error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(base + 'fund-statistics.html#quizzes');
    await page.locator('#fs-quiz-workspace').waitFor();
    await page.locator('#fsq-start').waitFor();
    return { page, context };
  }
  const state = page => page.evaluate(({ key, quiz }) => JSON.parse(localStorage.getItem(key)).statistics[quiz], { key: PROGRESS_KEY, quiz: QUIZ_KEY });
  async function setup(page, options = {}) {
    if (!(await page.locator('#fsq-start').isVisible())) await page.locator('#fsq-dashboard').click();
    for (const name of ['mode', 'count', 'topic', 'scope', 'type', 'difficulty', 'timer']) {
      if (options[name] !== undefined) await page.locator('#fsq-' + name).selectOption(String(options[name]));
    }
    if (options.extra !== undefined) await page.locator('#fsq-extra').setChecked(options.extra);
  }
  async function start(page, options = {}) {
    await setup(page, options);
    await page.locator('#fsq-start').click();
    await page.waitForFunction(({ key, quiz }) => !!JSON.parse(localStorage.getItem(key))?.statistics?.[quiz]?.active, { key: PROGRESS_KEY, quiz: QUIZ_KEY });
    return (await state(page)).active;
  }
  async function current(page) {
    const active = (await state(page)).active;
    const question = byId.get(active.ids[active.index]);
    assert.ok(question, 'selected question exists in the original student bank');
    return question;
  }
  async function answer(page, question, { correct = true, value } = {}) {
    if (question.type === 'mcq') {
      const chosen = value ?? (correct ? question.answer : (question.answer + 1) % question.options.length);
      await page.locator(`input[data-option="${chosen}"]`).check();
    } else if (question.type === 'multi-select') {
      const indices = value ?? (correct ? question.answer : [question.answer[0]]);
      for (const input of await page.locator('input[data-option]').all()) await input.uncheck();
      for (const index of indices) await page.locator(`input[data-option="${index}"]`).check();
    } else {
      const given = value ?? (question.type === 'numeric' ? String(question.answer + (correct ? 0 : question.tolerance + 10)) : 'My independent interpretation of the population result and its uncertainty.');
      await page.locator('#fsq-answer').fill(given);
    }
  }
  async function feedback(page, correct = true) {
    await page.locator('#fsq-check').click();
    const text = await page.locator('#fsq-feedback').innerText();
    assert.match(text, correct ? /\bcorrect\b|within.*tolerance/i : /revisit|incorrect|not quite|try again/i);
    return text;
  }
  async function resume(page) {
    if (await page.locator('#fsq-resume').isVisible()) await page.locator('#fsq-resume').click();
  }
  async function finish(page) {
    await page.locator('#fsq-submit').click();
    await page.waitForFunction(({ key, quiz }) => JSON.parse(localStorage.getItem(key))?.statistics?.[quiz]?.active?.finished !== null, { key: PROGRESS_KEY, quiz: QUIZ_KEY });
  }
  async function namespaces(page) {
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), PROGRESS_KEY);
    for (const key of ['topics', 'cards', 'quizzes', 'lectures']) assert.deepEqual(saved[key], preserved[key], key + ' namespace preserved');
    for (const [key, value] of Object.entries(preserved.statistics)) assert.deepEqual(saved.statistics[key], value, key + ' preserved');
    const backup = await page.evaluate(() => JSON.parse(exportProgressText()));
    assert.deepEqual(backup.progress.statistics, saved.statistics, 'Notes backup includes quiz state without discarding adjacent data');
  }
  async function fits(page, description) {
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), description);
  }
  async function screenshot(page, name) {
    await page.evaluate(() => document.fonts.ready);
    // Fixed viewport overlays otherwise appear midway through a tall element screenshot.
    const style = await page.addStyleTag({ content: '.site-header, .site-header *, .back-to-top { visibility: hidden !important; }' });
    try {
      await page.locator('#fs-quiz-workspace').screenshot({ path: path.join(OUTPUT, name + '.png') });
    } finally {
      await style.evaluate(element => element.remove());
    }
  }

  try {
    fs.mkdirSync(OUTPUT, { recursive: true });
    const env = { ...process.env };
    delete env.SITES_MANAGED;
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath());
    browser = await chromium.launch({ executablePath, env, args: ['--no-sandbox'] });

    // The ordinary start keeps the supplementary topic out and balances core topics.
    let { page, context } = await open();
    assert.equal(await page.locator('#fsq-extra').isChecked(), false);
    assert.equal(await page.locator('#fsq-mode').inputValue(), 'learn');
    let active = await start(page);
    assert.equal(new Set(active.ids).size, active.ids.length);
    assert.deepEqual([...new Set(active.ids.map(id => byId.get(id).topic))].sort(), coreTopics.slice().sort());
    assert.ok(active.ids.every(id => byId.get(id).topic !== 'fund-statistics.two-means' && id !== 'fund-statistics.q.069'));
    await namespaces(page);
    ok('default session balances Topics 1–5, has no duplicate IDs and excludes optional Topic 6');
    await context.close();

    // MCQ responses use original option identities even when the visible order is shuffled.
    ({ page, context } = await open());
    active = await start(page, { scope: 'new', topic: coreTopics[0], type: 'mcq', count: 'all' });
    const missed = active.ids[0];
    for (let index = 0; index < active.ids.length; index++) {
      const question = await current(page);
      await answer(page, question, { correct: index !== 0 });
      const text = await feedback(page, index !== 0);
      for (const rationale of question.rationales || []) assert.ok(normalise(text).includes(normalise(rationale)), 'all supplied option rationales shown');
      if (index === 0) {
        await page.locator('#fsq-try-again').click();
        await answer(page, question);
        await feedback(page);
        const unchanged = await state(page);
        assert.equal(unchanged.active.first[question.id].correct, false, 'a learning correction does not erase the first miss');
        assert.equal(unchanged.records[question.id].attempts, 1, 'one first submission per session');
      }
      if (index + 1 < active.ids.length) await page.locator('#fsq-next').click();
    }
    await finish(page);
    await page.locator('#fsq-retry-missed').click();
    active = (await state(page)).active;
    assert.deepEqual(active.ids, [missed], 'retry contains the missed item, not the independently correct one');
    await answer(page, await current(page));
    await feedback(page);
    await finish(page);
    assert.equal((await state(page)).records[missed].attempts, 2);
    await namespaces(page);
    ok('shuffled MCQ grading explains every supplied choice and retry-missed targets only mistakes');
    await context.close();

    // Exact-set multiple selection and numerical grading both use the new question bank.
    ({ page, context } = await open());
    await start(page, { scope: 'new', type: 'multi-select', topic: coreTopics[0], count: 'all' });
    let question = await current(page);
    assert.ok(question.answer.length > 1, 'selected multi-answer scenario has more than one correct choice');
    await answer(page, question, { value: [question.answer[0]] });
    await feedback(page, false);
    await page.locator('#fsq-try-again').click();
    await answer(page, question);
    await feedback(page);
    assert.deepEqual((await state(page)).active.drafts[question.id].slice().sort(), question.answer.slice().sort());
    assert.equal((await state(page)).active.first[question.id].correct, false);
    await finish(page);
    await start(page, { scope: 'new', type: 'numeric', topic: coreTopics[2], count: 'all' });
    question = await current(page);
    await page.locator('#fsq-answer').fill('1,5');
    await page.locator('#fsq-check').click();
    assert.match(await page.locator('#fsq-validation').innerText(), /finite decimal|scientific notation/i);
    assert.equal((await state(page)).active.first[question.id], undefined, 'invalid input is not counted as a submitted answer');
    await answer(page, question, { value: String(question.answer + question.tolerance / 2) });
    const numericFeedback = await feedback(page);
    assert.match(await page.locator('#fs-quiz-workspace').innerText(), /absolute rounding tolerance/i);
    for (const step of question.steps) assert.ok(normalise(numericFeedback).includes(normalise(step)), 'numerical calculation steps shown');
    assert.equal((await state(page)).active.first[question.id].correct, true);
    await namespaces(page);
    ok('multi-select uses the full correct set and numerical feedback reports tolerance and calculation steps');
    await context.close();

    // Hints identify supported practice; they cannot become independent mastery.
    ({ page, context } = await open());
    await start(page, { scope: 'new', type: 'numeric', topic: coreTopics[0], count: 'all' });
    question = await current(page);
    await page.locator('#fsq-hint').click();
    await answer(page, question);
    await feedback(page);
    let saved = await state(page);
    assert.equal(saved.active.first[question.id].assisted, true);
    assert.equal(saved.records[question.id].lastAssisted, true);
    await page.locator('#fsq-next').click();
    const revealed = await current(page);
    await page.locator('#fsq-reveal').click();
    const revealedFirst = (await state(page)).active.first[revealed.id];
    assert.equal(revealedFirst.assisted, true);
    assert.equal(revealedFirst.correct, false);
    assert.equal(revealedFirst.given, '', 'showing a solution keeps an unanswered first attempt');
    await page.locator('#fsq-feedback').waitFor();
    await finish(page);
    assert.match(await page.locator('#fs-quiz-workspace').innerText(), /supported|assisted/i);
    const independentScore = await page.locator('#fsq-results div').filter({ has: page.getByText('Independent first checks correct', { exact: true }) }).locator('dd').innerText();
    assert.match(independentScore, /^0\s*\/\s*\d+$/, 'hinted success is excluded from independent correctness');
    ok('a hinted correct answer is labelled supported practice rather than independent mastery');
    await context.close();

    // Written responses are self-assessed against a rubric, outside automatic accuracy.
    ({ page, context } = await open());
    await start(page, { scope: 'new', type: 'written', topic: coreTopics[3], count: 'all' });
    question = await current(page);
    await answer(page, question);
    await page.locator('#fsq-check').click();
    const writtenFeedback = await page.locator('#fsq-feedback').innerText();
    assert.ok(normalise(writtenFeedback).includes(normalise(question.answer)));
    for (const item of question.rubric) assert.ok(normalise(writtenFeedback).includes(normalise(item)));
    const rubric = page.locator('[data-rubric]');
    await rubric.first().check();
    saved = await state(page);
    assert.equal(saved.records[question.id], undefined, 'written response not automatically graded');
    assert.equal(saved.active.rubrics[question.id][0], true);
    await finish(page);
    assert.match(await page.locator('#fs-quiz-workspace').innerText(), /written|self.assess/i);
    await namespaces(page);
    ok('written drafts reveal a model and save self-assessed rubrics without inflating automatic scores');
    await context.close();

    // A fresh written self-test has no learning checks to initialize its rubric arrays.
    ({ page, context } = await open());
    await start(page, { mode: 'test', scope: 'new', type: 'written', topic: coreTopics[3], count: 'all' });
    question = await current(page);
    const writtenDraft = 'The interval estimates a population parameter, and its confidence describes repeated-sampling coverage.';
    await answer(page, question, { value: writtenDraft });
    assert.equal(await page.locator('#fsq-feedback').count(), 0);
    assert.equal(await page.locator('#fsq-reveal').count(), 0);
    await finish(page);
    await page.locator('[data-rubric]').first().check();
    assert.equal((await state(page)).active.rubrics[question.id][0], true, 'first rubric interaction works without a repair reload');
    assert.match(await page.locator('#fsq-results').innerText(), /written.*self.assess/i);
    assert.match(await page.locator('#fs-quiz-workspace').innerText(), /no automatic percentage/i);
    await page.reload();
    await page.locator('#fsq-results').waitFor();
    assert.equal(await page.locator('[data-rubric]').first().isChecked(), true);
    assert.ok((await page.locator('#fs-quiz-workspace').innerText()).includes(writtenDraft));
    await namespaces(page);
    ok('fresh written self-test results accept the first rubric check and preserve the draft/rubric on reload');
    await context.close();

    // Self-tests keep answers hidden, preserve drafts/order/deadline, then expire on resume.
    ({ page, context } = await open());
    await page.clock.install({ time: new Date('2026-11-02T12:00:00Z') });
    active = await start(page, { mode: 'test', scope: 'new', type: 'mcq', topic: coreTopics[0], count: 'all', timer: '15' });
    question = await current(page);
    await answer(page, question);
    await page.locator('#fsq-flag').click();
    const beforeReload = (await state(page)).active;
    assert.deepEqual(beforeReload.first, {}, 'no first-attempt grading before submission');
    assert.equal((await state(page)).records[question.id], undefined);
    assert.equal(await page.locator('#fsq-feedback').isVisible(), false);
    assert.ok(!(await page.locator('#fs-quiz-workspace').innerText()).includes(question.explanation));
    await page.reload();
    await page.locator('#fs-quiz-workspace').waitFor();
    await resume(page);
    saved = await state(page);
    assert.deepEqual(saved.active.ids, beforeReload.ids);
    assert.deepEqual(saved.active.order, beforeReload.order);
    assert.deepEqual(saved.active.drafts, beforeReload.drafts);
    for (const id of beforeReload.ids) assert.equal(!!saved.active.flags[id], !!beforeReload.flags[id], 'flag preserved for ' + id);
    assert.equal(saved.active.deadline, beforeReload.deadline);
    assert.equal(await page.locator(`input[data-option="${question.answer}"]`).isChecked(), true);
    await page.locator('.fs-nav a[href="#learn"]').click();
    await page.clock.fastForward(15 * 60 * 1000 + 1000);
    await page.locator('.fs-nav a[href="#quizzes"]').click();
    await page.locator('#fs-quiz-workspace').waitFor();
    await resume(page);
    await page.waitForFunction(({ key, quiz }) => JSON.parse(localStorage.getItem(key))?.statistics?.[quiz]?.active?.expired === true, { key: PROGRESS_KEY, quiz: QUIZ_KEY });
    saved = await state(page);
    assert.ok(saved.active.finished !== null);
    assert.equal(saved.active.deadline, beforeReload.deadline);
    assert.equal(saved.active.first[question.id].correct, true);
    await namespaces(page);
    ok('self-test hides solutions, resumes stable drafts/options/deadline and finishes after time elapsed in another view');
    await context.close();

    // Change wall-clock time without running the interval: late input must lose the race.
    ({ page, context } = await open());
    await page.clock.install({ time: new Date('2026-11-02T13:00:00Z') });
    await start(page, { mode: 'learn', scope: 'new', type: 'numeric', topic: coreTopics[2], count: 'all', timer: '15' });
    question = await current(page);
    await answer(page, question);
    const beforeLateInput = (await state(page)).active;
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
    await page.clock.setSystemTime(new Date(beforeLateInput.deadline + 100));
    assert.equal(await page.locator('#fsq-results').count(), 0, 'the interval has not expired the session first');
    await page.locator('#fsq-answer').evaluate(input => {
      input.value = '999999';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    saved = await state(page);
    assert.equal(saved.active.expired, true);
    assert.ok(saved.active.finished !== null);
    assert.equal(saved.active.drafts[question.id], String(question.answer), 'late input does not replace the on-time draft');
    assert.equal(saved.active.first[question.id].correct, true);
    await page.locator('#fsq-results').waitFor();
    ok('deadline validation rejects late input before the next interval tick and finishes using the on-time draft');
    await context.close();

    // Damaged or obsolete quiz saves cannot retain a score or affect other workspaces.
    const stale = { ...initialProgress, statistics: { ...preserved.statistics, [QUIZ_KEY]: { version: 1,
      records: { [supplemental.questions[0].id]: { signature: 'old question version', attempts: 999, correct: 999 } },
      active: { ids: ['missing-id'], mode: 'learn' }, history: ['invalid'],
    } } };
    ({ page, context } = await open({ seed: stale }));
    await start(page, { scope: 'new', type: 'numeric', count: 'all' });
    saved = await state(page);
    assert.deepEqual(saved.records, {});
    assert.ok(saved.active.ids.every(id => byId.has(id)));
    await namespaces(page);
    ok('corrupt session and stale signatures fall back safely without retaining stale scores or deleting adjacent progress');
    await context.close();

    // When saving is unavailable, navigation within the open page retains an in-memory draft.
    ({ page, context } = await open({ seed: null, blocked: true }));
    await setup(page, { scope: 'new', type: 'numeric', topic: coreTopics[2], count: 'all' });
    await page.locator('#fsq-start').click();
    const memoryQuestion = await page.locator('#fsq-question-title').innerText();
    const memoryCount = await page.locator('[data-index]').count();
    await page.locator('#fsq-answer').fill('7.25');
    await page.locator('.fs-nav a[href="#learn"]').click();
    await page.locator('.fs-nav a[href="#quizzes"]').click();
    await page.locator('#fsq-answer').waitFor();
    assert.equal(await page.locator('#fsq-question-title').innerText(), memoryQuestion);
    assert.equal(await page.locator('[data-index]').count(), memoryCount);
    assert.equal(await page.locator('#fsq-answer').inputValue(), '7.25');
    assert.match(await page.locator('#fsq-storage-warning').innerText(), /unavailable|memory/i);
    ok('blocked storage retains the same in-memory session and draft through navigation, with an explicit warning');
    await context.close();

    // Both themes fit a narrow phone and desktop, with labelled keyboard-operated controls.
    for (const width of [390, 1440]) for (const scheme of ['light', 'dark']) {
      ({ page, context } = await open({ viewport: { width, height: 950 }, colorScheme: scheme }));
      await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), scheme);
      await fits(page, `${width}px ${scheme} setup`);
      await setup(page, { scope: 'new', type: 'numeric', topic: coreTopics[1], count: 'all' });
      await page.locator('#fsq-start').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('#fs-quiz-workspace')), true);
      question = await current(page);
      assert.ok(await page.locator('label[for="fsq-answer"]').count(), 'answer input has an explicit accessible label');
      await answer(page, question);
      await page.locator('#fsq-answer').press('Enter');
      await page.locator('#fsq-feedback').waitFor();
      assert.equal(await page.evaluate(() => document.activeElement.id), 'fsq-feedback', 'checking moves keyboard focus to the answer explanation');
      await fits(page, `${width}px ${scheme} numerical feedback`);
      await screenshot(page, `quiz-${width}-${scheme}`);
      await context.close();
    }
    ok('390px phone and desktop layouts fit in light/dark themes and work with labelled keyboard controls');

    // A fresh offline render needs the new scripts, CSS and supplemental bank in the PWA cache.
    ({ page, context } = await open({ serviceWorkers: 'allow' }));
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    // Initial data requests may predate control; allow the controlled online visit to finish.
    await page.locator('#fsq-start').waitFor();
    const cacheFiles = ['fund-statistics-quiz-core.js', 'fund-statistics-quizzes.js', 'fund-statistics-quizzes.css', 'content/modules/fund-statistics/self-tests.json'];
    const cached = await page.evaluate(async files => Promise.all(files.map(async file => !!await caches.match(new URL(file, location.href).href, { ignoreSearch: true }))), cacheFiles);
    assert.deepEqual(cached, cacheFiles.map(() => true), 'new quiz files cached under Pages prefix');
    await context.setOffline(true);
    await page.reload();
    await page.locator('#fs-quiz-workspace').waitFor();
    await start(page, { scope: 'new', type: 'numeric', topic: coreTopics[0], count: 'all' });
    active = (await state(page)).active;
    assert.ok(active.ids.length > 0 && active.ids.every(id => newIds.has(id)), 'supplemental questions available in a fresh offline session');
    await answer(page, await current(page));
    await feedback(page);
    await fits(page, 'offline feedback');
    await context.setOffline(false);
    await context.close();
    ok('service-worker cache renders and grades the new question bank after an offline reload');

    assert.deepEqual(errors, [], 'no uncaught page errors');
    console.log(`Fundamentals quiz browser passed: ${checks} focused workflows, local-only requests, preserved Notes namespaces and offline delivery.`);
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
