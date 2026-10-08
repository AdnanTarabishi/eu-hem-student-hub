// Focused real-browser gate for the cohort bulletin. Run in conventional CI:
// npx playwright install --with-deps chromium
// node tests/announcements/browser.test.js .
// Uses Playwright's bundled Chromium, never a machine-specific executable path.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || '.');
const SHOTS = path.resolve(process.env.SCREENSHOT_DIR || 'test-artifacts/announcements');
const PREFIX = '/eu-hem-student-hub/';
const CSV = fs.readFileSync(path.join(ROOT, 'data/announcements.csv'), 'utf8');
const ELECTION = '2026-10-07-student-representatives-election-results';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
let checks = 0;
const ok = (message) => { checks++; console.log('  ok  ' + message); };

function serve(request, response) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); return response.end('Bad URL'); }
  const relative = pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length) : '';
  const file = path.resolve(ROOT, relative || 'index.html');
  if (!pathname.startsWith(PREFIX) || !file.startsWith(ROOT + path.sep)) {
    response.writeHead(404); return response.end('Not found');
  }
  fs.readFile(file, (error, bytes) => {
    if (error) { response.writeHead(404); return response.end('Not found'); }
    response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(bytes);
  });
}

async function noSidewaysScroll(page, label, selector = 'html') {
  const overflow = await page.locator(selector).evaluate((element) => element.scrollWidth - element.clientWidth);
  assert.ok(overflow <= 1, `${label}: ${selector} has ${overflow}px horizontal overflow`);
}

async function inViewport(page, selector, label) {
  const bounds = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  assert.ok(bounds && bounds.width > 0 && bounds.height > 0, `${label}: ${selector} is visible`);
  assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1,
    `${label}: ${selector} fits horizontally (${JSON.stringify(bounds)})`);
  assert.ok(bounds.y >= -1 && bounds.y + bounds.height <= viewport.height + 1,
    `${label}: ${selector} fits vertically (${JSON.stringify(bounds)})`);
}

async function showControls(page) {
  await page.locator('.news-toolbar').evaluate((element) => {
    const header = document.querySelector('.site-header').getBoundingClientRect().height;
    window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - header - 16, behavior: 'instant' });
  });
}

async function electionResults(page) {
  const reader = page.locator('#news-reader');
  assert.deepEqual(await reader.locator('.election-winner').evaluateAll((items) => items.map((item) => [
    item.querySelector('.election-winner-name').textContent,
    item.querySelector('.election-percentage').textContent,
  ])), [['Filipe Pinheiro', '67%'], ['Nina Kuenen', '54%'], ['Maud Hamster', '53%']]);
  assert.deepEqual(await reader.locator('.election-section').evaluateAll((sections) => sections.map((section) =>
    section.querySelectorAll('.election-column:first-child li').length)), [5, 7]);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = http.createServer(serve);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const base = origin + PREFIX;
  const errors = [];
  let browser, lastPage, lastLabel = 'startup';

  try {
    browser = await chromium.launch();
    const open = async ({ width = 1280, height = 900, scheme = 'light', hash = '' } = {}) => {
      const context = await browser.newContext({
        viewport: { width, height }, colorScheme: scheme, locale: 'en-GB', timezoneId: 'Europe/Rome',
        isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce', serviceWorkers: 'block',
      });
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === PREFIX + 'data/announcements.csv') {
          return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: CSV });
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.clock.setFixedTime(new Date('2026-10-08T12:00:00+02:00'));
      page.on('pageerror', (error) => errors.push(`${width}/${scheme}: ${error.message}`));
      lastPage = page;
      await page.goto(base + 'announcements.html' + hash);
      await page.locator('#news-feed[aria-busy="false"] article.news-card').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      return page;
    };

    for (const { width, height } of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
      for (const scheme of ['light', 'dark']) {
        const label = `${width}x${height}-${scheme}`;
        lastLabel = label;
        const page = await open({ width, height, scheme });
        const cards = page.locator('#news-feature article.news-spotlight, #news-feed article.news-card');
        const initialCount = await cards.count();
        assert.ok(initialCount >= 3, 'the three published stories are present at the fixed date');
        assert.equal(await page.locator('.theme-toggle').getAttribute('aria-label'), scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        const covers = page.locator('#news-feature .news-art img, #news-feed .news-art img');
        assert.equal(await covers.count(), initialCount, 'every published story has its local cover');
        for (const image of await covers.all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate((element) => element.decode());
          assert.ok(await image.evaluate((element) => element.complete && element.naturalWidth > 0), label + ': cover loads');
          assert.equal(await image.getAttribute('alt'), '', 'cover is decorative; news facts remain text');
        }
        await noSidewaysScroll(page, label);
        await noSidewaysScroll(page, label, '#news-feed');
        if (scheme === 'light' && (width === 390 || width === 1280)) {
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
          await page.screenshot({ path: path.join(SHOTS, `full-page-${label}.png`), fullPage: true, animations: 'disabled' });
        }
        await showControls(page);
        for (const selector of ['#news-search', '#news-sort', '[data-news-view="grid"]', '[data-news-view="list"]']) {
          await inViewport(page, selector, label);
        }
        await page.screenshot({ path: path.join(SHOTS, `feed-${label}.png`), fullPage: false, animations: 'disabled' });

        await page.locator('#news-search').fill('Kristina Tergau');
        await page.waitForFunction(() => document.querySelectorAll('#news-feature article.news-spotlight, #news-feed article.news-card').length === 1);
        assert.equal(await cards.first().getAttribute('id'), ELECTION);
        await page.locator('#news-reset').click();
        assert.equal(await cards.count(), initialCount);
        await page.locator('[data-news-view="list"]').click();
        assert.ok(await page.locator('#news-feed').evaluate((element) => element.classList.contains('is-list')));
        assert.ok(await page.locator('#news-feature').isHidden(), 'list layout contains all updates in its compact feed');
        assert.equal(await cards.count(), initialCount);
        await noSidewaysScroll(page, `${label} list`);
        await noSidewaysScroll(page, `${label} list`, '#news-feed');
        const rows = await cards.evaluateAll((elements) => elements.map((element) => {
          const box = element.getBoundingClientRect(); return { top: box.top, bottom: box.bottom };
        }));
        for (let i = 1; i < rows.length; i++) assert.ok(rows[i].top >= rows[i - 1].bottom, label + ': list cards do not overlap');
        await page.locator('[data-news-view="grid"]').click();

        const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
        await page.locator(`[id="${ELECTION}"] .news-title a[data-news-open]`).click();
        const reader = page.locator('#news-reader');
        await reader.waitFor({ state: 'visible' });
        assert.ok(await reader.evaluate((element) => element.matches(':modal')), 'reader uses the native modal dialog');
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden', 'page scrolling locks behind the modal');
        await electionResults(page);
        await inViewport(page, '#news-reader', label + ' reader');
        await inViewport(page, '#news-reader-close', label + ' reader close');
        await noSidewaysScroll(page, label + ' reader', '#news-reader');
        await reader.locator('.election-section').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(SHOTS, `reader-${label}.png`), fullPage: false, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await reader.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => !location.hash);
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), bodyOverflow, 'page scrolling restores after Escape');
        ok(`${label}: loaded covers, controls in viewport, responsive grid/list/search and election reader without horizontal overflow`);
        await page.context().close();
      }
    }

    lastLabel = 'native-dialog-keyboard';
    let page = await open();
    const opener = page.locator(`[id="${ELECTION}"] .news-title a[data-news-open]`);
    await opener.focus();
    await page.keyboard.press('Enter');
    const reader = page.locator('#news-reader');
    await reader.waitFor({ state: 'visible' });
    assert.ok(await page.locator('#news-reader-close').evaluate((element) => document.activeElement === element));
    for (const key of ['Shift+Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      assert.ok(await reader.evaluate((element) => element.contains(document.activeElement)), `${key}: focus remains within native dialog`);
    }
    await page.locator('#news-search').focus();
    assert.ok(await reader.evaluate((element) => element.contains(document.activeElement)), 'background controls are inert while the modal is open');
    await page.keyboard.press('Escape');
    await reader.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !location.hash);
    assert.ok(await opener.evaluate((element) => document.activeElement === element), 'Escape restores the clicked title focus');
    ok('native dialog opens by keyboard, contains focus, makes background inert and returns focus after Escape');
    await page.context().close();

    lastLabel = 'mobile-shared-link';
    page = await open({ width: 390, height: 844, scheme: 'dark', hash: '#' + ELECTION });
    await page.locator('#news-reader').waitFor({ state: 'visible' });
    await electionResults(page);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#news-reader').open && !location.hash);
    await page.locator(`[id="${ELECTION}"] .news-title a[data-news-open]`).click();
    await page.locator('#news-reader').waitFor({ state: 'visible' });
    await page.goBack();
    await page.locator('#news-reader').waitFor({ state: 'hidden' });
    assert.ok(await page.locator(`[id="${ELECTION}"] .news-title a[data-news-open]`).evaluate((element) => document.activeElement === element));
    ok('mobile incoming shared link opens complete results; Escape and browser Back return to the feed');
    await page.context().close();

    assert.deepEqual(errors, [], 'no uncaught page errors');
    ok('shared page scripts complete without uncaught errors across all tested contexts');
    console.log(`${checks} announcements browser checks passed; screenshots: ${SHOTS}`);
  } catch (error) {
    if (lastPage && !lastPage.isClosed()) {
      await lastPage.screenshot({ path: path.join(SHOTS, `failure-${lastLabel}.png`), fullPage: false }).catch(() => {});
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
