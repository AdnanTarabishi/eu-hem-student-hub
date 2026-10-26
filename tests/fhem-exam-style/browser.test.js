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

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const pageErrors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: 'light', serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.route(/^https?:\/\//, (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
    const base = `http://127.0.0.1:${server.address().port}/eu-hem-student-hub/`;
    await page.goto(base + 'fhem-exam.html');
    await page.locator('.exam-v2-shell').waitFor();

    assert.match(await page.locator('.exam-v2-blueprint').innerText(), /6 MCQ/);
    assert.match(await page.locator('.exam-v2-blueprint').innerText(), /2 Binary/);
    assert.match(await page.locator('.exam-v2-blueprint').innerText(), /1 Open/);
    assert.equal(await page.locator('.exam-v2-fixed-grid .exam-v2-mode').count(), 3);
    assert.equal(await page.locator('.exam-v2-bank-grid .exam-v2-mode').count(), 3);

    await page.getByRole('button', { name: 'Start Mock 3' }).click();
    await page.locator('.exam-v2-active').waitFor();
    assert.equal(await page.locator('.exam-v2-answer-cell').count(), 8);
    assert.equal(await page.locator('.hem-exam-nav-grid button').count(), 9);
    assert.match(await page.locator('.hem-exam-toolbar-title').innerText(), /Mock Exam 3/);

    // M01 option D is deliberately partly correct (+2).
    await page.locator('.hem-exam-option').nth(3).click();
    assert.equal(await page.locator('.exam-v2-answer-cell').first().locator('strong').innerText(), 'D');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await page.locator('.exam-v2-results').waitFor();
    assert.match(await page.locator('.hem-objective-score').innerText(), /2\/46/);
    assert.match(await page.locator('.hem-review-list .hem-review-card').first().innerText(), /score 2\/5/);
    assert.equal(await page.locator('.exam-v2-rubric-card').count(), 6);

    const firstRubric = page.locator('.exam-v2-rubric-card').first().locator('input');
    await firstRubric.evaluate((input) => {
      input.value = '10';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.match(await page.locator('.exam-v2-rubric-total').innerText(), /10\/60/);

    await context.close();

    for (const [width, scheme] of [[390, 'dark'], [320, 'light']]) {
      const mobile = await browser.newContext({ viewport: { width, height: 950 }, colorScheme: scheme, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await mobile.route(/^https?:\/\//, (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      const page = await mobile.newPage();
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.goto(base + 'fhem-exam.html');
      await page.locator('.exam-v2-shell').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await mobile.close();
    }

    assert.deepEqual(pageErrors, []);
    console.log('PASS: fixed mocks, partial credit, answer sheet, 60-point rubric, dark mode and 320px layout work without browser errors.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
