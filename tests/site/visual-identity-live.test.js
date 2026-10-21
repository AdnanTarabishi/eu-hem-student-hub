// Read-only verification of the published design; no account or form actions.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || '.');
const BASE = process.env.VISUAL_LIVE_BASE || 'https://adnantarabishi.github.io/eu-hem-student-hub/';
const OUT = path.join(ROOT, 'work/visual-audit/live');
const routes = ['index.html', 'studyplan.html', 'thesis.html', 'students.html', 'statistics.html', 'statistics-lab.html', 'fhe-session-7.html'];
(async () => {
  fs.mkdirSync(OUT, { recursive:true });
  let pending = [...fs.readdirSync(ROOT).filter(file => file.endsWith('.css')), 'statistics-lab.html'];
  for (let attempt = 0; attempt < 20 && pending.length; attempt++) {
    const checked = await Promise.all(pending.map(async file => {
      const response = await fetch(BASE + file + '?design-check=' + Date.now(), { signal:AbortSignal.timeout(15000), cache:'no-store' });
      return response.ok && (await response.text()).replace(/\r\n/g, '\n') === fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
    }));
    pending = pending.filter((_, index) => !checked[index]);
    if (pending.length) await new Promise(resolve => setTimeout(resolve, 8000));
  }
  assert.deepEqual(pending, [], 'published styles and Statistics Lab shell match the reviewed release');
  const browser = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args:['--no-sandbox'] });
  const results = [];
  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport:{ width:390, height:844 }, colorScheme:theme, reducedMotion:'reduce', serviceWorkers:'block' });
      await context.addInitScript(value => localStorage.setItem('euhem-theme', value), theme);
      const errors = [], forbidden = [];
      await context.route('**/*', route => {
        if (route.request().method() !== 'GET') { forbidden.push(route.request().method()); return route.abort(); }
        return route.request().url().startsWith(BASE) ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      for (const route of routes) {
        await page.goto(BASE + route, { waitUntil:'domcontentloaded' });
        await page.locator('.header-bar').waitFor();
        await page.locator('main h1').first().waitFor({ state:'visible' });
        await page.evaluate(() => document.fonts.ready);
        if (route === 'statistics-lab.html') await page.locator('#statistics-lab[data-sl3-mounted="true"]').waitFor();
        assert.equal(await page.locator('.theme-toggle').count(), 1, route + ' has the shared theme switch');
        // Study chapters retain their compact educational footer and source reminder.
        const footer = route === 'fhe-session-7.html' ? 'body > footer' : '.site-footer';
        assert.equal(await page.locator(footer).count(), 1, route + ' retains its footer');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, route + ' fits a phone');
        if (route === 'statistics-lab.html') {
          await page.locator('.theme-toggle').click();
          assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme === 'light' ? 'dark' : 'light');
          await page.locator('.theme-toggle').click();
        }
        await page.screenshot({ path:path.join(OUT, route.replace('.html', '') + '-' + theme + '.png') });
        results.push({ route, theme, title:await page.title() });
      }
      assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
  console.log('All published CSS files match; seven principal pages retain the shared shell, both themes and phone layout. Statistics Lab theme switching works.');
})().catch(error => { console.error(error); process.exitCode = 1; });
