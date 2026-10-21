// Whole-site presentation audit. Only local GETs are permitted; no forms are submitted.
// Run: node tests/site/visual-identity.test.js .
// Optional: VISUAL_AUDIT_BASELINE=1 VISUAL_AUDIT_PHASE=before to render committed HTML/CSS/JS.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || '.');
const BASELINE = process.env.VISUAL_AUDIT_BASELINE === '1';
const BASE_REVISION = BASELINE ? execFileSync('git', ['rev-parse', 'HEAD'], { cwd:ROOT, encoding:'utf8' }).trim() : '';
const PHASE = process.env.VISUAL_AUDIT_PHASE || (BASELINE ? 'before' : 'after');
const OUT = path.join(ROOT, 'work/visual-audit', PHASE);
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.md':'text/markdown', '.csv':'text/csv', '.ics':'text/calendar', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.webmanifest':'application/manifest+json' };
const programme = require(path.join(ROOT, 'content/programme.json'));
const markedPath = path.join(path.dirname(require.resolve('marked', { paths:[ROOT] })), 'marked.umd.js');
const markedScript = fs.readFileSync(markedPath, 'utf8');
const katexDirectory = path.dirname(require.resolve('katex', { paths:[ROOT] }));
const katexScript = fs.readFileSync(path.join(katexDirectory, 'katex.min.js'), 'utf8') + '\n;' + fs.readFileSync(path.join(katexDirectory, 'contrib/auto-render.min.js'), 'utf8');
const katexCSS = fs.readFileSync(path.join(katexDirectory, 'katex.min.css'), 'utf8');
const courses = programme.cohorts.at(-1).terms[0].courses;
// Fictional academic records exercise the layouts without claiming a new official check.
const modules = courses.flatMap(course => course.modules.map(module => ({ course, module })));
const timetableFixture = modules.map(({ module }, index) => ({
  extCode:'visual-class-' + index, cod_modulo:module.code, title:'FICTIONAL CLASS / LAYOUT REVIEW',
  start:`2026-10-${21 + index % 3}T09:00:00`, end:`2026-10-${21 + index % 3}T11:00:00`, time:'09:00 - 11:00',
  docente:'Fictional Lecturer', aule:[{ des_edificio:'Example classroom', des_indirizzo:'Example campus address' }], note:'Fictional layout-review session', teledidattica:false,
}));
const examFixture = modules.flatMap(({ course, module }, index) => [2026,2027].map(year => {
  const id=`visual-exam-${index}-${year}`, month=year===2026?'November':'January', day=2+index;
  return `<h3 role="tab" aria-controls="${id}"><a><span class="code">${course.code}</span> Fictional assessment <span class="docente">Fictional Lecturer</span></a></h3><div id="${id}"><table class="single-item"><tr><th>When</th><td>${day} ${month} ${year} at 14:00</td></tr><tr><th>Componente:</th><td>${module.code} - Fictional module</td></tr><tr><th>Place:</th><td>Example classroom, example campus</td></tr><tr><th>Test type:</th><td>Written</td></tr><tr><th>Duration:</th><td>120 min</td></tr><tr><th>Notes:</th><td>Fictional assessment used only for layout checks.</td></tr><tr><th>Subscriptions list:</th><td><span>01 October 2026</span><span>30 October 2026</span></td></tr></table></div>`;
})).join('');
const rootPages = fs.readdirSync(ROOT).filter(file => file.endsWith('.html')).sort();
const lectures = ['statistics', 'fund-statistics', 'fund-health-economics'].flatMap(module => {
  const file = path.join(ROOT, 'content/modules', module, 'topics.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')).filter(topic => topic.lecture).map(topic => 'lecture.html?topic=' + topic.id);
});
let routes = [...new Set([...rootPages,
  ...courses.map(course => 'course.html?course=' + course.id),
  ...['bologna', 'oslo', 'rotterdam', 'innsbruck'].map(city => 'city-guide.html?city=' + city),
  ...['unibo', 'uio', 'eur', 'mci'].map(id => 'university.html?id=' + id),
  ...lectures,
  'course.html?course=quant-methods&tab=lab',
  'course.html?course=fund-health-econ-management&tab=practice',
  'course.html?course=right-to-health&tab=exam',
  'fund-statistics.html#cases', 'fund-statistics.html#methods',
  'statistics.html#practice', 'statistics-lab.html?course=fund-quant-methods',
  'toolkit.html#workbench', 'universities.html?compare=unibo,uio',
])];
if (process.env.VISUAL_AUDIT_ONLY) {
  const wanted = process.env.VISUAL_AUDIT_ONLY.split('|');
  routes = routes.filter(route => wanted.some(value => route === value));
}
const samples = new Set(['index.html', 'studyplan.html', 'thesis.html', 'statistics.html', 'statistics-lab.html',
  'course.html?course=quant-methods', 'course.html?course=fund-quant-methods', 'fhe-session-7.html',
  'notes.html', 'toolkit.html', 'tracks.html', 'timetable.html', 'exams.html', 'visitor-guide.html',
  'student-life.html', 'city-guide.html?city=bologna', 'students.html', 'announcements.html',
  'beyond-euhem.html', 'support.html', 'academic-rules.html', 'universities.html', 'roadmap.html', 'behind-the-build.html']);
if (BASELINE && !process.env.VISUAL_AUDIT_ONLY) routes = routes.filter(route => samples.has(route));
const cases = [
  { width:1440, height:1000, theme:'light' }, { width:1440, height:1000, theme:'dark' },
  { width:390, height:844, theme:'light' }, { width:390, height:844, theme:'dark' },
];
const cssCache = new Map();
const results = [], issues = [], forbidden = [];
function safeName(value) { return value.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, ''); }
async function audit(page, base, route, view) {
  const errors = [], missing = [], optionalMissing = [];
  const onError = error => errors.push(error.message);
  const onResponse = response => {
    if (response.url().startsWith(base) && response.status() >= 400) {
      const pathname=new URL(response.url()).pathname;
      // events.js explicitly keeps this section hidden while its optional publisher is inactive.
      (pathname==='/data/events.json' ? optionalMissing : missing).push(pathname);
    }
  };
  page.on('pageerror', onError); page.on('response', onResponse);
  try {
    await page.goto(base + route, { waitUntil:'domcontentloaded', timeout:15000 });
    await page.waitForFunction(() => document.querySelector('.header-bar, .sl-site-header'), null, { timeout:10000 });
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve=>setTimeout(resolve,2000))]));
    // Wait for the actual destination, rather than accepting a skeleton that fits the viewport.
    await page.waitForFunction(() => ![...document.querySelectorAll('main [role="status"], #course-page, #guide')].some(node => {
      const s=getComputedStyle(node), r=node.getBoundingClientRect();
      return !node.hidden && s.visibility!=='hidden' && r.width>0 && r.height>0 && /^(?:Loading|Checking)\b|^Loading…/i.test(node.textContent.trim());
    }), null, { timeout:20000 });
    if (route.startsWith('course.html?')) await page.waitForFunction(() => {
      // The lab deliberately lives beside #course-page so source refreshes preserve its inputs.
      const lab=new URLSearchParams(location.search).get('tab')==='lab';
      const panel=document.getElementById(lab?'statistics-lab-course-panel':'course-panel');
      return panel && panel.getBoundingClientRect().height>0 && panel.textContent.trim().length>0;
    }, null, { timeout:20000 });
    if (route.startsWith('lecture.html?')) await page.waitForSelector('#lecture-content:not([hidden])', { timeout:20000 });
    if (route.startsWith('city-guide.html?')) await page.waitForSelector('#guide[aria-busy="false"] .cg-hero, #guide[aria-busy="false"] .guide-hero, #guide[aria-busy="false"] .guide-cover', { timeout:20000 });
    await page.waitForTimeout(450);
    const data = await page.evaluate(() => {
      const shown = node => node && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0 && getComputedStyle(node).visibility !== 'hidden';
      const style = node => node ? { color:getComputedStyle(node).color, background:getComputedStyle(node).backgroundColor, image:getComputedStyle(node).backgroundImage, radius:getComputedStyle(node).borderRadius, font:getComputedStyle(node).fontFamily } : null;
      const heading = [...document.querySelectorAll('main h1')].find(shown);
      const hero = document.querySelector('.study-hero, .sp-hero, .tg-hero, .th-hero, .sl3-heading, .eh-hero, .tk-hero, .vg-cover, .fs-hero, .fhs7-hero, .course-hero, .page-intro');
      const header = document.querySelector('.site-header, .sl-site-header');
      const focus = document.querySelector('.skip-link, .sl-site-header a');
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const overflowing = overflow > 1 ? [...document.querySelectorAll('main *')].filter(node => { const r=node.getBoundingClientRect(); return shown(node) && r.right > innerWidth + 2 && getComputedStyle(node).position !== 'absolute'; }).slice(0,8).map(node=>({tag:node.tagName, class:node.className?.baseVal || node.className, text:node.textContent.slice(0,60)})) : [];
      return { title:heading?.textContent.trim() || document.title, overflow, overflowing,
        header:shown(header), footer:!!document.querySelector('.site-footer, footer'),
        skip:!!document.querySelector('.skip-link'), themeButton:!!document.querySelector('.theme-toggle'),
        body:style(document.body), heading:style(heading), hero:style(hero),
        rootTheme:document.documentElement.dataset.theme || '', focusable:!!focus,
        tokens:{ page:getComputedStyle(document.documentElement).getPropertyValue('--surface-page').trim(),
          heading:getComputedStyle(document.documentElement).getPropertyValue('--text-heading').trim(),
          brand:getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim(),
          focus:getComputedStyle(document.documentElement).getPropertyValue('--color-focus').trim() } };
    });
    if (samples.has(route)) {
      const file = `${safeName(route)}-${view.width}-${view.theme}.png`;
      await page.screenshot({ path:path.join(OUT, file), animations:'disabled', timeout:10000 });
      data.screenshot = file;
    }
    await page.keyboard.press('Tab');
    data.focus = await page.evaluate(() => {
      const node=document.activeElement, s=getComputedStyle(node);
      return { tag:node.tagName, visible:node.matches(':focus-visible'), outline:s.outlineStyle,
        width:s.outlineWidth, shadow:s.boxShadow, name:node.getAttribute('aria-label') || node.textContent.trim().slice(0,50) };
    });
    if (!data.header) issues.push({ route, ...view, problem:'header unavailable' });
    if (!data.footer) issues.push({ route, ...view, problem:'footer unavailable' });
    if (!BASELINE && (!data.skip || !data.themeButton)) issues.push({ route, ...view, problem:'shared accessibility controls unavailable', skip:data.skip, themeButton:data.themeButton });
    if (!BASELINE && (!data.focus.visible || (data.focus.outline==='none' && data.focus.shadow==='none'))) issues.push({ route, ...view, problem:'keyboard focus is not visible', focus:data.focus });
    if (data.overflow > 1) issues.push({ route, ...view, problem:'page overflow', pixels:data.overflow, elements:data.overflowing });
    if (errors.length) issues.push({ route, ...view, problem:'uncaught JavaScript', errors });
    if (missing.length) issues.push({ route, ...view, problem:'missing local assets', paths:[...new Set(missing)] });
    if (route==='calendar.html' && optionalMissing.length) assert.equal(await page.locator('#community-events').isHidden(), true, 'an inactive optional event publisher stays hidden');
    results.push({ route, ...view, ...data, errors, missing:[...new Set(missing)], optionalMissing:[...new Set(optionalMissing)] });
    if (results.length % 20 === 0) console.log(`${PHASE}: ${results.length}/${routes.length * cases.length} browser states checked`);
  } catch (error) { issues.push({ route, ...view, problem:'audit navigation failed', error:error.message }); }
  finally { page.off('pageerror', onError); page.off('response', onResponse); }
}
async function contactSheets(browser) {
  for (const theme of ['light', 'dark']) {
    const entries = results.filter(result => result.width === 1440 && result.theme === theme && result.screenshot);
    const page = await browser.newPage({ viewport:{ width:1480, height:1000 }, deviceScaleFactor:1 });
    const html = `<!doctype html><style>*{box-sizing:border-box}body{margin:0;padding:18px;background:${theme==='light'?'#f7f5f1':'#111827'};font:12px Arial;color:${theme==='light'?'#0f2b5b':'#f2f4f7'}}h1{font-size:22px;margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px}figure{margin:0;overflow:hidden;border:1px solid #667085;border-radius:9px;background:#fff}figcaption{height:38px;padding:10px;color:#0f2b5b;white-space:nowrap;overflow:hidden}img{display:block;width:100%;height:auto}</style><h1>${PHASE} · 1440px · ${theme} · all captures use local files</h1><div class="grid">${entries.map(entry=>`<figure><figcaption>${entry.route}</figcaption><img src="data:image/png;base64,${fs.readFileSync(path.join(OUT, entry.screenshot)).toString('base64')}"></figure>`).join('')}</div>`;
    await page.setContent(html); await page.screenshot({ path:path.join(OUT, `contact-sheet-${theme}.png`), fullPage:true });
    await page.close();
  }
}
(async () => {
  fs.mkdirSync(OUT, { recursive:true });
  const server = http.createServer((request, response) => {
    if (request.method !== 'GET') { forbidden.push(request.method + ' ' + request.url); response.writeHead(405); return response.end(); }
    const file = decodeURIComponent(new URL(request.url, 'http://audit').pathname).replace(/^\//, '') || 'index.html';
    const full = path.resolve(ROOT, file);
    if (!full.startsWith(ROOT + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) { response.writeHead(404); return response.end('missing'); }
    let body;
    if (BASELINE && /\.(css|html|js)$/.test(file)) {
      if (!cssCache.has(file)) cssCache.set(file, execFileSync('git', ['show', BASE_REVISION + ':' + file], { cwd:ROOT }));
      body = cssCache.get(file);
    } else body = fs.readFileSync(full);
    response.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' }); response.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args:['--no-sandbox'] });
  try {
    await Promise.all(cases.map(async view => {
      const context = await browser.newContext({ viewport:{ width:view.width, height:view.height }, colorScheme:view.theme, reducedMotion:'reduce', serviceWorkers:'block' });
      await context.addInitScript(theme => { try { localStorage.setItem('euhem-theme', theme); } catch {} }, view.theme);
      await context.addInitScript({ content:markedScript });
      await context.addInitScript({ content:katexScript });
      await context.addInitScript(({ css, url }) => {
        document.addEventListener('DOMContentLoaded', () => {
          const style=document.createElement('style'); style.textContent=css.replaceAll('url(fonts/', 'url(' + url + 'node_modules/katex/dist/fonts/'); document.head.appendChild(style);
        }, { once:true });
      }, { css:katexCSS, url:base });
      await context.addInitScript(() => { delete Navigator.prototype.serviceWorker; });
      await context.route('**/*', route => {
        if (route.request().method() !== 'GET') { forbidden.push(route.request().method() + ' ' + route.request().url()); return route.abort(); }
        if (route.request().url().startsWith(base)) return route.continue();
        const url=new URL(route.request().url());
        if (url.hostname==='corsi.unibo.it' && url.pathname.includes('@@orario_reale_json')) {
          const start=url.searchParams.get('start'), end=url.searchParams.get('end');
          const records=timetableFixture.filter(record=>(!start || record.start.slice(0,10)>=start) && (!end || record.start.slice(0,10)<=end));
          return route.fulfill({ contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body:JSON.stringify(records) });
        }
        if (url.hostname==='corsi.unibo.it' && url.pathname.endsWith('/exam-dates')) return route.fulfill({ contentType:'text/html', headers:{'access-control-allow-origin':'*'}, body:examFixture });
        return route.abort();
      });
      const page = await context.newPage();
      for (const route of routes) await audit(page, base, route, view);
      await context.close();
    }));
    await contactSheets(browser);
    const report = { phase:PHASE, baselineCSS:BASELINE, rootPages:rootPages.length, routes:routes.length, cases:results.length, forbidden, issues, results };
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`${PHASE}: ${results.length} browser states over ${routes.length} routes (${rootPages.length} root HTML files), ${issues.length} findings; report and contact sheets in ${path.relative(ROOT, OUT)}.`);
    for (const issue of issues) console.log(JSON.stringify(issue));
    assert.deepEqual(forbidden, [], 'the presentation audit never submits forms or writes to a service');
    if (!BASELINE) assert.deepEqual(issues, [], 'all audited routes retain their shell, local assets, script execution and responsive layout');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
