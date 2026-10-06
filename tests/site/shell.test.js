// The site frame on every page (site-nav.js, theme.js, style.css) in a real browser (installed Chrome):
// brand lockup, menu dropdowns by keyboard, the phone drawer (focus trap, Escape, no background scroll),
// the theme button, the footer, and no sideways scrolling or JavaScript errors on any page in light and dark.
// Run: node tests/site/shell.test.js .
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || '.');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.csv': 'text/csv', '.ics': 'text/calendar' };
const PAGES = ['index.html', 'studyplan.html', 'tracks.html', 'timetable.html', 'exams.html', 'calendar.html', 'notes.html',
  'thesis.html', 'city-guide.html', 'city-guide.html?city=bologna', 'announcements.html', 'students.html', 'join.html',
  'privacy.html', 'contact.html'];

(async () => {
  const site = http.createServer((req, res) => {
    const file = decodeURIComponent(req.url.split('?')[0].replace(/^\//, '')) || 'index.html';
    const full = path.join(ROOT, file);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(full)] || 'text/plain' }); res.end(fs.readFileSync(full));
  }).listen(0);
  const base = `http://127.0.0.1:${site.address().port}/`;
  const browser = await chromium.launch({ channel: 'chrome' });
  let n = 0; const ok = (name) => { n++; console.log('  ok  ' + name); };
  const errors = [];
  const open = async (url, { viewport = { width: 1280, height: 900 }, scheme = 'light' } = {}) => {
    const context = await browser.newContext({ viewport, colorScheme: scheme });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${url} (${scheme}): ${e}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|corsi\.unibo|announcements|Map:|cdnjs/i.test(m.text())) errors.push(`${url}: ${m.text()}`); });
    await page.goto(base + url);
    await page.waitForSelector('.header-bar');
    return page;
  };
  const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  /* ----- Desktop header ----- */
  let page = await open('tracks.html');
  assert.strictEqual(await page.textContent('.site-title .brand-name'), 'EU-HEM');
  assert.strictEqual(await page.textContent('.site-title .brand-product'), 'Student Hub');
  assert.strictEqual(await page.getAttribute('.site-title a', 'aria-label'), 'EU-HEM Student Hub, home');
  assert.deepStrictEqual(await page.$$eval('.menu > .menu-item > :first-child', (all) => all.map((e) => e.textContent.trim())),
    ['Home', 'Students', 'Tracks', 'Academics', 'Resources', 'Thesis', 'Life', 'Contact']);
  assert.strictEqual(await page.getAttribute('.menu > .menu-item > a[href="tracks.html"]', 'aria-current'), 'page');
  assert.ok(await page.isVisible('.header-cta'));
  assert.strictEqual(await page.isVisible('.menu-toggle'), false);
  ok('header: brand lockup, eight menu entries, current page marked, Join the Directory, no phone menu button');

  await page.focus('.menu-group:text("Resources")');
  await page.keyboard.press('Enter');
  assert.strictEqual(await page.getAttribute('.menu-group:text("Resources")', 'aria-expanded'), 'true');
  assert.ok(await page.isVisible('.menu-dropdown a[href="notes.html"]'));
  assert.match(await page.textContent('.menu-dropdown a[href="notes.html"]'), /Notes, flashcards, practice/);
  await page.keyboard.press('Escape');
  assert.strictEqual(await page.getAttribute('.menu-group:text("Resources")', 'aria-expanded'), 'false');
  assert.strictEqual(await page.evaluate(() => document.activeElement.textContent.trim()), 'Resources');
  ok('dropdown by keyboard: Enter opens (with descriptions), Escape closes and returns focus');

  const theme = await page.evaluate(() => document.querySelector('.theme-toggle').innerHTML);
  assert.match(theme, /icons\.svg#moon/);
  await page.click('.theme-toggle');
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.match(await page.evaluate(() => document.querySelector('.theme-toggle').innerHTML), /icons\.svg#sun/);
  ok('theme button uses outline icons (no emoji) and switches to dark');

  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForFunction(() => document.querySelector('.site-header').classList.contains('is-compact'));
  const footer = await page.$$eval('.footer-links a', (all) => all.map((a) => a.textContent));
  for (const label of ['Home', 'Timetable', 'Notes & Resources', 'City Guide', 'Privacy', 'Contact', 'GitHub']) assert.ok(footer.includes(label), label);
  assert.match(await page.textContent('.footer-bottom'), /Unofficial student project/);
  ok('header compacts on scroll; slim navy footer with every page and the unofficial disclaimer');
  await page.context().close();

  page = await open('join.html');
  assert.strictEqual(await page.$('.header-cta'), null);
  assert.ok(await page.$('.menu > .menu-item > a.is-current[href="students.html"]'));
  ok('the Join page hides the header Join button and marks Students');
  await page.context().close();

  /* ----- Phone drawer ----- */
  page = await open('index.html', { viewport: { width: 375, height: 800 } });
  assert.strictEqual(await page.isVisible('.menu-toggle'), true);
  assert.strictEqual(await page.isVisible('.menu-dropdown a[href="studyplan.html"]'), false);
  await page.click('.menu-toggle');
  await page.waitForFunction(() => document.getElementById('site-nav').getBoundingClientRect().right <= window.innerWidth + 1);
  assert.strictEqual(await page.getAttribute('#site-nav', 'aria-modal'), 'true');
  assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close menu');
  assert.ok(await page.evaluate(() => document.body.classList.contains('drawer-open') && getComputedStyle(document.body).overflow === 'hidden'));
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.getElementById('site-nav').contains(document.activeElement)), 'focus stays in the drawer');
  assert.ok(await page.isVisible('.drawer-extras a[href="privacy.html"]'));
  await page.keyboard.press('Escape');
  assert.strictEqual(await page.getAttribute('#site-nav', 'aria-modal'), null);
  assert.strictEqual(await page.evaluate(() => document.activeElement.classList.contains('menu-toggle')), true);
  assert.strictEqual(await page.evaluate(() => document.body.classList.contains('drawer-open')), false);
  ok('phone drawer: opens as a modal, focus starts on Close and stays inside, page does not scroll, Escape closes and returns focus');
  await page.click('.menu-toggle');
  await page.click('.drawer-backdrop', { position: { x: 10, y: 400 } });
  assert.strictEqual(await page.getAttribute('#site-nav', 'aria-modal'), null);
  ok('a tap on the dimmed page closes the drawer');
  await page.context().close();

  /* ----- Every page: light and dark, phone and wide ----- */
  for (const url of PAGES) {
    for (const [viewport, scheme] of [[{ width: 360, height: 760 }, 'light'], [{ width: 1440, height: 900 }, 'dark']]) {
      page = await open(url, { viewport, scheme });
      await page.waitForTimeout(300);
      assert.strictEqual(await sideways(page), 0, `${url} ${viewport.width} ${scheme}`);
      assert.ok(await page.$('.skip-link'), `${url}: skip link`);
      await page.context().close();
    }
  }
  ok(`all ${PAGES.length} pages: no sideways scrolling at 360px (light) and 1440px (dark), skip link present`);

  assert.deepStrictEqual(errors, []);
  ok('no JavaScript errors');
  await browser.close(); site.close();
  console.log(n + ' site shell checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
