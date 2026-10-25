const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.resolve(process.argv[2] || '.');
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.md': 'text/plain', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
  '.webp': 'image/webp', '.webmanifest': 'application/manifest+json',
};

(async () => {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/eu-hem-student-hub\//, '');
    const file = path.resolve(root, pathname || 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end('missing');
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, colorScheme: 'light', serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.route(/^https?:\/\//, (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}/eu-hem-student-hub/`;

    await page.goto(base + 'lecture.html?topic=fund-health-economics.moral-hazard');
    await page.locator('#lecture-content').waitFor({ state: 'visible' });
    assert.match(await page.locator('#lecture-title').innerText(), /Insure the risk/);
    assert.match(await page.locator('#lecture-class-label').innerText(), /CLASS 08/);
    assert.equal((await page.locator('#lecture-question-count').innerText()).trim(), '26 practice questions');
    assert.equal((await page.locator('#lecture-activity-count').innerText()).trim(), '5 interactive activities');
    assert.equal(await page.locator('#lecture-guide .section-intro').count() >= 20, true);
    assert.match(await page.locator('#lecture-guide').innerText(), /Value-Based Insurance Design/);
    assert.match(await page.locator('#lecture-guide').innerText(), /Preferred Provider Organization/);

    await page.getByRole('button', { name: /Explore the lab/ }).click();
    await page.locator('#explore').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#lecture-extra-activities .extended-activity').count(), 5);
    await page.locator('[data-activity="mh-coinsurance-dwl"] input[type="range"]').fill('10');
    assert.match(await page.locator('#mhcd-output').innerText(), /Deadweight loss/);
    await page.locator('[data-activity="mh-plan-compare"] select').selectOption('hmo');
    assert.match(await page.locator('#mhpc-output').innerText(), /Most restrictive/);

    await page.locator('.lecture-toolbar [data-view="practice"]').click();
    await page.locator('#practice').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#question-map button').count(), 26);
    await page.locator('#quiz-card input[type="radio"]').nth(1).check();
    await page.getByRole('button', { name: 'Check answer', exact: true }).click();
    assert.match(await page.locator('#answer-feedback').innerText(), /Correct|Revisit/);
    await context.close();

    for (const scheme of ['light', 'dark']) {
      const mobile = await browser.newContext({ viewport: { width: 320, height: 900 }, colorScheme: scheme, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await mobile.route(/^https?:\/\//, (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      const mobilePage = await mobile.newPage();
      mobilePage.on('pageerror', (error) => errors.push(error.message));
      await mobilePage.goto(base + 'lecture.html?topic=fund-health-economics.moral-hazard');
      await mobilePage.locator('#lecture-content').waitFor({ state: 'visible' });
      assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Session 8 ${scheme} mobile has no horizontal overflow`);
      await mobilePage.getByRole('button', { name: /Explore the lab/ }).click();
      await mobilePage.locator('[data-activity="mh-expected-loss"]').waitFor();
      assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Session 8 lab ${scheme} mobile has no horizontal overflow`);
      await mobile.close();
    }

    const courseContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await courseContext.route(/^https?:\/\//, (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const course = await courseContext.newPage();
    course.on('pageerror', (error) => errors.push(error.message));
    await course.goto(base + 'course.html?course=fund-health-econ-management&tab=lectures');
    await course.locator('[data-session="8"]').waitFor();
    assert.match(await course.locator('[data-session="8"]').innerText(), /Moral Hazard/);
    assert.match(await course.locator('[data-session="8"]').innerText(), /50 flashcards/);
    assert.match(await course.locator('[data-session="8"]').innerText(), /42 questions/);
    assert.match(await course.locator('[data-session="8"]').innerText(), /5 interactive tools/);
    await courseContext.close();

    assert.deepEqual(errors, []);
    console.log('PASS: Session 8 lecture, five labs, quiz, course card, dark mode and 320px layout work without browser errors.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
