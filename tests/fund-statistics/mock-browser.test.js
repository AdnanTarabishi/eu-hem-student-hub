// Focused regression checks for Statistics mock selection, saved sessions and deadlines.
// Run: node tests/fund-statistics/mock-browser.test.js .
// Uses only fictional/student-created data and a local GitHub Pages-style subdirectory.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || '.');
const PREFIX = '/eu-hem-student-hub/';
const MOCK_KEY = 'euhem-fund-mock-v1';
const DURATION = 90 * 60 * 1000;
const QUESTIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/modules/fund-statistics/questions.json'), 'utf8'));
const BY_ID = new Map(QUESTIONS.map(question => [question.id, question]));
const FORMS = require(path.join(ROOT, 'fund-statistics-mock-bank.js'));
const CORE_FORMS = new Set(['clinic-b', 'clinic-c']);
const CORE_TOPICS = ['descriptive', 'distributions', 'estimation', 'confidence-intervals', 'hypothesis-tests'].map(topic => 'fund-statistics.' + topic);
const LEGACY_IDS = ['012', '026', '040', '053', '074', '088'].map(id => 'fund-statistics.q.' + id);
const LEGACY_NUMBERS = [['75', '70.90435', '79.09565', '2.88675'], ['0.6', '0.03535534', '2.82843', '0.00467773']];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.csv': 'text/csv', '.webmanifest': 'application/manifest+json' };

function legacyFixture({ finished = false, corruptMean = false } = {}) {
  const started = Date.now() - 1000;
  const numbers = LEGACY_NUMBERS.map(row => row.slice());
  if (corruptMean) numbers[0][0] = '0x4b';
  return { version: 1, started, deadline: started + DURATION, finished,
    mcq: Array(6).fill(null), text: ['Saved legacy interpretation', '', '', ''], numbers,
    rubric: Array(8).fill(false) };
}

function checkCoreSelection(saved) {
  assert.ok(CORE_FORMS.has(saved.form), 'a new core session uses clinic-b or clinic-c, never legacy');
  assert.equal(saved.includeExtra, false);
  assert.equal(saved.questionIds.length, 6);
  assert.equal(new Set(saved.questionIds).size, 6);
  for (const id of saved.questionIds) {
    const question = BY_ID.get(id);
    assert.ok(question && question.type === 'mcq', 'each selected ID is an existing MCQ');
    assert.ok(CORE_TOPICS.includes(question.topic), 'default selection contains only Topics 1–5');
    assert.ok(!question.supplementary, 'default selection excludes supplementary power material');
  }
  assert.ok(!saved.questionIds.includes('fund-statistics.q.069'), 'the power question is excluded');
  assert.equal(new Set(saved.questionIds.map(id => BY_ID.get(id).topic)).size, 5, 'all five core topics are represented');
}

(async () => {
  const errors = [];
  const contexts = [];
  let browser;
  let checks = 0;
  const ok = label => { checks++; console.log('  ok  ' + label); };
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

  async function saved(page) {
    return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), MOCK_KEY);
  }
  async function open({ random = 0, seed = null } = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    contexts.push(context);
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await context.addInitScript(({ key, randomValue, fixture }) => {
      // Constant RNG values exercise both form choices without probabilistic retries.
      Math.random = () => randomValue;
      if (location.hostname !== '127.0.0.1' || !fixture || sessionStorage.getItem('mock-browser-seeded')) return;
      sessionStorage.setItem(key, JSON.stringify(fixture));
      sessionStorage.setItem('mock-browser-seeded', 'yes');
    }, { key: MOCK_KEY, randomValue: random, fixture: seed });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.goto(base + 'fund-statistics.html#mock');
    await page.locator('#fs-content:not([hidden])').waitFor();
    await page.locator(seed ? '#fs-mock-top' : '#fs-start-mock').waitFor();
    return page;
  }
  async function start(page, extra = false) {
    await page.locator('#fs-mock-extra').setChecked(extra);
    await page.locator('#fs-start-mock').click();
    await page.locator('#fs-mock-top').waitFor();
    return saved(page);
  }

  let base;
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}${PREFIX}`;
    browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });

    const page = await open({ random: 0 });
    const initial = await start(page);
    checkCoreSelection(initial);
    assert.equal(initial.form, 'clinic-c');
    assert.equal(await page.locator('.fs-feedback').count(), 0, 'solutions remain hidden during a session');
    assert.ok(initial.orders.some(order => order.some((value, index) => value !== index)), 'the deterministic run actually changes option order');
    ok('default core form and all five topics, excluding Topic 6 and power');

    // Store a selected underlying answer, written drafts and a numerical draft.
    const chosenValue = await page.locator('[data-mcq="0"]').nth(2).inputValue();
    await page.locator('[data-mcq="0"]').nth(2).check();
    await page.locator('#fs-text-0').fill('My population interpretation <script>literal draft</script>.');
    await page.locator('#fs-text-2').fill('My hypotheses, model and units.');
    await page.locator('#fs-num-0-0').fill('42.75');
    const draft = await saved(page);
    const displayedChoices = await page.locator('.fs-mock-options').evaluateAll(groups => groups.map(group => [...group.querySelectorAll('input')].map(input => Number(input.value))));
    assert.deepEqual(displayedChoices, draft.orders);
    await page.reload();
    await page.locator('#fs-mock-top').waitFor();
    assert.deepEqual(await saved(page), draft, 'saved question IDs, form, orders and drafts remain unchanged on reload');
    assert.equal(await page.locator('[data-mcq="0"]:checked').inputValue(), chosenValue);
    assert.equal(await page.locator('#fs-text-0').inputValue(), draft.text[0]);
    assert.equal(await page.locator('#fs-text-2').inputValue(), draft.text[2]);
    assert.equal(await page.locator('#fs-num-0-0').inputValue(), '42.75');
    assert.deepEqual(await page.locator('.fs-mock-options').evaluateAll(groups => groups.map(group => [...group.querySelectorAll('input')].map(input => Number(input.value)))), draft.orders);
    const form = FORMS.find(item => item.id === draft.form);
    assert.equal(await page.locator('.fs-mock-written h4').first().innerText(), form.interpretations[0].title);
    assert.equal(await page.locator('.fs-feedback').count(), 0);
    ok('shuffled option order, selected answers and written/numeric drafts survive reload');

    await page.locator('#fs-finish-mock').click();
    await page.locator('#fs-score').waitFor();
    await page.locator('#fs-new-mock').click();
    const next = await saved(page);
    checkCoreSelection(next);
    assert.notEqual(next.form, initial.form, 'a new session rotates its applied/interpretation form');
    assert.ok(next.questionIds.every(id => !initial.questionIds.includes(id)), 'all six question IDs are fresh relative to the preceding session');
    assert.deepEqual(next.mcq, Array(6).fill(null));
    assert.deepEqual(next.text, Array(4).fill(''));
    assert.deepEqual(next.numbers, [Array(4).fill(''), Array(4).fill('')]);
    ok('another full session rotates form and all six questions, with clean drafts');

    // Leaving Fisher–Yates swaps in place (random close to one) exercises the other core form.
    const otherDefault = await open({ random: 0.999999 });
    const otherState = await start(otherDefault);
    checkCoreSelection(otherState);
    assert.equal(otherState.form, 'clinic-b');
    ok('both deterministic default form choices are core forms, never legacy');

    // With optional Topic 6, the same deterministic RNG selects the first form: legacy.
    const extraPage = await open({ random: 0.999999 });
    const extended = await start(extraPage, true);
    assert.equal(extended.includeExtra, true);
    assert.equal(extended.form, 'legacy', 'legacy is deliberately available only in optional extended practice');
    assert.equal(new Set(extended.questionIds.map(id => BY_ID.get(id).topic)).size, 6);
    assert.deepEqual(new Set(extended.questionIds.map(id => BY_ID.get(id).topic)), new Set([...CORE_TOPICS, 'fund-statistics.two-means']));
    assert.ok(extended.questionIds.every(id => !BY_ID.get(id).supplementary));
    assert.match(await extraPage.locator('#fs-view').innerText(), /additional Topic 6 interpretation/);
    ok('optional Topic 6 gives one question from each of six topics and permits legacy');

    const legacyPage = await open({ seed: legacyFixture() });
    assert.match(await legacyPage.locator('#fs-view').innerText(), /additional Topic 6 interpretation/);
    assert.equal(await legacyPage.locator('.fs-mock-written h4').first().innerText(), 'Two groups, one reported contrast');
    for (let i = 0; i < LEGACY_IDS.length; i++) {
      assert.equal(await legacyPage.locator('#fs-mcq-' + i).innerText(), BY_ID.get(LEGACY_IDS[i]).question);
      assert.deepEqual(await legacyPage.locator(`[data-mcq="${i}"]`).evaluateAll(inputs => inputs.map(input => Number(input.value))), [0, 1, 2, 3]);
    }
    for (let a = 0; a < 2; a++) for (let j = 0; j < 4; j++) assert.equal(await legacyPage.locator(`#fs-num-${a}-${j}`).inputValue(), LEGACY_NUMBERS[a][j]);
    assert.equal(await legacyPage.locator('#fs-text-0').inputValue(), 'Saved legacy interpretation');
    await legacyPage.locator('#fs-finish-mock').click();
    await legacyPage.locator('#fs-score').waitFor();
    assert.match(await legacyPage.locator('#fs-score').innerText(), /Calculations: 8\/8/);
    const restoredLegacy = await saved(legacyPage);
    assert.equal(restoredLegacy.form, 'legacy');
    assert.deepEqual(restoredLegacy.questionIds, LEGACY_IDS);
    assert.deepEqual(restoredLegacy.numbers, LEGACY_NUMBERS);
    ok('v1 sessions restore fixed legacy questions, numbers and the Topic 6 label');

    const corruptPage = await open({ seed: legacyFixture({ finished: true, corruptMean: true }) });
    await corruptPage.locator('#fs-score').waitFor();
    const corrupt = await saved(corruptPage);
    assert.equal(corrupt.numbers[0][0], '0x4b');
    assert.equal(Number(corrupt.numbers[0][0]), 75, 'the fixture would incorrectly pass a plain Number conversion');
    assert.match(await corruptPage.locator('#fs-score').innerText(), /Calculations: 7\/8/);
    assert.match(await corruptPage.locator('label[for="fs-num-0-0"] .fs-meta').innerText(), /Expected 75/);
    assert.doesNotMatch(await corruptPage.locator('label[for="fs-num-0-0"] .fs-meta').innerText(), /Correct within/);
    ok('corrupt hexadecimal saved numeric input is not marked correct');

    const deadlinePage = await open({ random: 0 });
    await start(deadlinePage);
    for (const kind of ['text', 'number', 'radio']) {
      if (kind !== 'text') await deadlinePage.locator('#fs-new-mock').click();
      if (kind === 'text') await deadlinePage.locator('#fs-text-0').fill('Saved before the deadline');
      if (kind === 'number') await deadlinePage.locator('#fs-num-0-0').fill('12.5');
      if (kind === 'radio') await deadlinePage.locator('[data-mcq="0"]').first().check();
      // The clock change and input dispatch share one JS task. The interval cannot run first.
      const result = await deadlinePage.evaluate(({ key, inputKind }) => {
        const before = JSON.parse(sessionStorage.getItem(key));
        const hadReview = !!document.querySelector('#fs-score');
        const input = inputKind === 'text' ? document.querySelector('#fs-text-0') : inputKind === 'number' ? document.querySelector('#fs-num-0-0') : document.querySelectorAll('[data-mcq="0"]')[1];
        const realNow = Date.now;
        Date.now = () => before.deadline + 1;
        try {
          if (inputKind === 'radio') input.checked = true;
          else input.value = inputKind === 'text' ? 'Late change must be discarded' : '99';
          input.dispatchEvent(new Event(inputKind === 'radio' ? 'change' : 'input', { bubbles: true }));
          return { before, hadReview, after: JSON.parse(sessionStorage.getItem(key)) };
        } finally { Date.now = realNow; }
      }, { key: MOCK_KEY, inputKind: kind });
      assert.equal(result.before.finished, false);
      assert.equal(result.hadReview, false, 'the interval had not already submitted the session');
      assert.equal(result.after.finished, true);
      assert.equal(result.after.expired, true);
      assert.deepEqual(result.after.text, result.before.text, 'late text must not overwrite the draft');
      assert.deepEqual(result.after.numbers, result.before.numbers, 'late numeric input must not overwrite the draft');
      assert.deepEqual(result.after.mcq, result.before.mcq, 'late choice must not overwrite the answer');
      assert.match(await deadlinePage.locator('#fs-score').innerText(), /time ended/i);
      assert.equal(await deadlinePage.locator('#fs-text-0').getAttribute('readonly'), '');
    }
    ok('late text, numeric and MCQ input is discarded and expires immediately before any interval');

    await deadlinePage.locator('#fs-new-mock').click();
    const submitted = await deadlinePage.evaluate(key => {
      const before = JSON.parse(sessionStorage.getItem(key));
      const hadReview = !!document.querySelector('#fs-score');
      const realNow = Date.now;
      Date.now = () => before.deadline + 1;
      try {
        document.querySelector('#fs-finish-mock').click();
        return { before, hadReview, after: JSON.parse(sessionStorage.getItem(key)) };
      } finally { Date.now = realNow; }
    }, MOCK_KEY);
    assert.equal(submitted.before.finished, false);
    assert.equal(submitted.hadReview, false);
    assert.equal(submitted.after.finished, true);
    assert.equal(submitted.after.expired, true, 'manual submit after the deadline is still an expired session');
    assert.match(await deadlinePage.locator('#fs-score').innerText(), /time ended/i);
    ok('direct submit after the deadline marks the session expired');

    assert.deepEqual(errors, [], 'no uncaught browser errors');
    console.log(`Statistics mock browser regression passed: ${checks} focused checks.`);
  } finally {
    for (const context of contexts) await context.close();
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
