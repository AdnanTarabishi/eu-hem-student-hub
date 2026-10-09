// Browser checks use the real local repository, without external services or personal data.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const root = path.resolve(process.argv[2] || '.');
const out = process.env.SCREENSHOT_DIR || path.join(root, 'artifacts/behind-build');
fs.mkdirSync(out, { recursive: true });
// Public source only, no fonts, private records or submissions: useful for reproducing a failed layout check.
const fixtures = path.join(out, 'public-fixture');
fs.mkdirSync(fixtures, { recursive: true });
for (const file of ['style.css','site-nav.js','ui.js','theme.js','utils.js','search.js','behind-build.css','behind-build.js','behind-the-build.html']) fs.copyFileSync(path.join(root,file), path.join(fixtures,file));
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.webmanifest':'application/manifest+json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const options = { headless: true };
if (process.env.CHROME_BIN) options.executablePath = process.env.CHROME_BIN;
const browser = await chromium.launch(options);
let assertions = 0;
const check = (ok, message) => { assert(ok, message); assertions++; };
try {
  for (const [name, width, theme] of [['desktop-light',1365,'light'],['desktop-dark',1365,'dark'],['mobile-light',390,'light'],['mobile-dark',390,'dark'],['small-phone',320,'light'],['tablet',768,'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 920 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/behind-the-build.html`, { waitUntil: 'networkidle' });
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    check(await page.locator('[data-total-hours]').innerText() === '120', `${name}: total`);
    check(await page.locator('.build-timeline li').filter({ hasText: 'First cohort beta' }).locator('time').getAttribute('datetime') === '2026-10-07', `${name}: cohort beta date`);
    check(await page.locator('.build-work').count() === 6, `${name}: workstreams`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: horizontal overflow`);
    await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
    await page.getByRole('button', { name: 'Share %', exact: true }).click();
    check(await page.locator('#work-design .build-value').innerText() === '25%', `${name}: percentage toggle`);
    await page.getByRole('button', { name: 'Hours', exact: true }).click();
    check(await page.locator('#work-tools .build-value').innerText() === '28 h', `${name}: hours toggle`);
    await page.getByRole('button', { name: 'Show all details', exact: true }).click();
    check(await page.locator('.build-work[open]').count() === 6, `${name}: expand all`);
    await page.getByRole('button', { name: 'Hide all details', exact: true }).click();
    check(await page.locator('.build-work[open]').count() === 0, `${name}: collapse all`);
    const summary = page.locator('#work-content > summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    check(await page.locator('#work-content').getAttribute('open') !== null, `${name}: keyboard details`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: expanded overflow`);
    if (width <= 900) {
      // On phones the existing drawer shows all groups as non-interactive headings.
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      await page.waitForFunction(() => document.getElementById('site-nav').classList.contains('is-open') && document.getElementById('site-nav').getBoundingClientRect().right <= innerWidth + 1);
    } else {
      await page.locator('#site-nav button.menu-group').filter({ hasText: /^About$/ }).click();
    }
    const link = page.locator('#site-nav a[href="behind-the-build.html"]');
    await link.scrollIntoViewIfNeeded();
    // Shared reduced-motion rules still start a tiny inherited visibility transition
    // on links. Wait for the actual target, not only the drawer's final geometry.
    await link.waitFor({ state: 'visible', timeout: 10000 });
    await page.screenshot({ path: path.join(out, name + '-menu.png') });
    const diagnostic = await link.evaluate(element => {
      const ancestors = [];
      for (let node = element; node; node = node.parentElement) {
        const css = getComputedStyle(node), rect = node.getBoundingClientRect();
        ancestors.push({tag:node.tagName,id:node.id,class:node.className,current:node.getAttribute('aria-current'),display:css.display,visibility:css.visibility,position:css.position,overflow:css.overflow,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},scrollTop:node.scrollTop});
      }
      return {width:innerWidth,height:innerHeight,scrollY,ancestors};
    });
    fs.writeFileSync(path.join(out, name + '-menu.json'), JSON.stringify(diagnostic,null,2));
    check(await link.isVisible() && await link.getAttribute('aria-current') === 'page', `${name}: shared current menu ${JSON.stringify(diagnostic)}`);
    await link.click();
    await page.waitForLoadState('networkidle');
    check(await page.locator('[data-total-hours]').innerText() === '120' && new URL(page.url()).pathname === '/behind-the-build.html', `${name}: real menu navigation`);
    check(errors.length === 0, `${name}: page errors ${errors.join('; ')}`);
    await context.close();
  }
  const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width:390,height:844 } });
  const page = await nojs.newPage();
  await page.goto(`${base}/behind-the-build.html`);
  check(await page.locator('[data-total-hours]').innerText() === '120', 'No-JS total');
  check(await page.locator('.build-controls').isHidden(), 'No-JS controls hidden');
  await page.locator('#work-design > summary').click();
  check(await page.locator('#work-design .build-work-body').isVisible(), 'Native details without JS');
  await nojs.close();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const roadmap = await context.newPage();
  await roadmap.goto(`${base}/roadmap.html`, {waitUntil:'networkidle'});
  check(await roadmap.locator('.build-teaser').isVisible(), 'Roadmap teaser visible');
  await roadmap.locator('.build-teaser a').click();
  check(roadmap.url().includes('behind-the-build.html'), 'Roadmap opens page');
  await context.close();
  console.log(`Behind the Build: ${assertions} browser assertions passed; six viewport/theme previews and actual menu interactions checked.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
