// Resource-first landing regression tests. Uses real public content with external requests blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2] || '.');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.md':'text/plain','.csv':'text/csv','.ics':'text/calendar','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const shots = process.env.NOTES_SCREENSHOT_DIR;
(async () => {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/eu-hem-student-hub\//, '');
    const file = path.resolve(root, name || 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(fs.readFileSync(file));
  }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/eu-hem-student-hub/`;
  const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args:['--no-sandbox']});
  const errors = [], contexts = [];
  const open = async (width=1440, scheme='light', url='notes.html') => {
    const context = await browser.newContext({viewport:{width,height:1000}, colorScheme:scheme, reducedMotion:'reduce', serviceWorkers:'block'});
    contexts.push(context);
    await context.clock.setFixedTime(new Date('2026-10-09T10:00:00+02:00'));
    await context.route(/^https?:\/\//, route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + url);
    await page.waitForFunction(() => typeof landingData !== 'undefined' && landingData && document.getElementById('landing-tabs').children.length === 4);
    return page;
  };
  const find = async (page, query) => {
    await page.locator('#notes-search').fill(query);
    await page.waitForFunction(q => document.getElementById('search-announcement').textContent.includes(q) && document.getElementById('search-results').getAttribute('aria-busy') === 'false', query);
  };
  try {
    let page = await open();
    assert.equal(await page.locator('.course-card').count(), 8);
    assert.equal(await page.locator('.notes-course-planning[open]').count(), 0);
    const first = page.locator('.notes-course-planning').first();
    await first.locator('summary').focus(); await page.keyboard.press('Enter');
    assert.equal(await first.getAttribute('open'), '');
    assert.ok(await first.locator('.notes-course-dates').isVisible());
    await page.keyboard.press('Enter');
    assert.equal(await first.getAttribute('open'), null);
    const overview = page.locator('.notes-overview-group').first();
    assert.ok(await overview.count());
    assert.equal(await overview.getAttribute('open'), null);
    await overview.locator(':scope > summary').click();
    assert.ok(await overview.locator('.course-card').first().isVisible());
    console.log('PASS: native planning and overview disclosures work by pointer and keyboard.');

    await find(page, '97177');
    assert.ok(await page.locator('#search-results a[href="course.html?course=fund-health-econ-management"]').count());
    await find(page, 'health');
    const more = page.getByRole('button', {name:/^Show more /}).first();
    assert.ok(await more.isVisible());
    const before = await page.locator('#search-results .search-list li').count();
    await more.click();
    assert.ok(await page.locator('#search-results .search-list li').count() > before);
    assert.equal(await page.evaluate(() => document.activeElement.className), 'search-title');
    await find(page, 'xyznonexistent987');
    await page.getByRole('button', {name:'Back to the library'}).click();
    assert.ok(await page.locator('#study-library').isVisible());
    assert.equal(await page.evaluate(() => document.activeElement.id), 'notes-search');
    console.log('PASS: course-code search, bounded results, Show more focus and no-match recovery.');

    await page.getByRole('tab', {name:'Key concepts', exact:true}).click();
    const term = await page.locator('.concept-card h4').first().textContent();
    const total = await page.locator('.concept-card').count();
    await page.getByRole('searchbox', {name:'Filter key concepts'}).fill(term.trim());
    const visible = await page.locator('.concept-card:visible').count();
    assert.ok(visible > 0 && visible < total);
    await page.getByRole('searchbox', {name:'Filter key concepts'}).fill('xyznonexistent987');
    assert.equal(await page.locator('.concept-card:visible').count(), 0);
    await page.getByRole('searchbox', {name:'Filter key concepts'}).fill('');
    assert.equal(await page.locator('.concept-card:visible').count(), total);
    await find(page, 'health');
    await page.locator('[data-teaching-filter="upcoming"]').click();
    assert.ok(await page.locator('#study-library').isVisible());
    assert.equal(await page.locator('#notes-search').inputValue(), '');
    assert.equal(await page.getAttribute('#notes-tab-courses','aria-selected'), 'true');
    assert.equal(await page.getByLabel('Filter by teaching status').inputValue(), 'upcoming');
    assert.equal(await page.locator('.notes-overview-group').count(), 0);
    console.log('PASS: glossary filter, cross-tab semester shortcuts and explicit status filters.');

    await page.goto(base+'notes.html?tab=study-list');
    await page.getByRole('link', {name:'Browse courses', exact:true}).click();
    assert.equal(await page.getAttribute('#notes-tab-courses','aria-selected'), 'true');
    await page.locator('.course-card-save').first().click();
    await page.getByRole('tab', {name:/My Study List/}).click();
    assert.equal(await page.locator('.study-item').count(), 1);
    await page.reload();
    await page.locator('.study-item').waitFor();
    assert.equal(await page.locator('.study-item').count(), 1);
    console.log('PASS: empty saved-list action and bookmark persistence across reload.');
    await page.context().close();

    if (shots) fs.mkdirSync(shots,{recursive:true});
    for (const scheme of ['light','dark']) {
      for (const width of [320,390,768,1024,1440]) {
        const responsive = await open(width,scheme);
        await responsive.waitForFunction(() => !landingExamState.refreshing);
        for (const view of ['Grid view','List view']) {
          await responsive.getByRole('button',{name:view,exact:true}).click();
          assert.equal(await responsive.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,`${width}/${scheme}/${view}`);
        }
        await responsive.getByRole('button',{name:'Grid view',exact:true}).click();
        for (const tab of ['Key concepts','My progress','My Study List']) {
          await responsive.getByRole('tab',{name:tab==='My Study List'?/My Study List/:tab,exact:tab!=='My Study List'}).click();
          assert.equal(await responsive.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,`${width}/${scheme}/${tab}`);
        }
        await responsive.getByRole('tab',{name:/^Courses/}).click();
        await responsive.evaluate(()=>window.scrollTo(0,0));
        if (shots && [390,1440].includes(width)) {
          await responsive.screenshot({path:path.join(shots,`workspace-${width}-${scheme}.png`),fullPage:true});
          await responsive.screenshot({path:path.join(shots,`workspace-${width}-${scheme}-top.png`)});
        }
        if (width===1440) assert.ok((await responsive.locator('.course-card').first().boundingBox()).y < 900, 'courses should not be buried beneath a marketing hero');
        await responsive.context().close();
      }
    }
    console.log('PASS: grid/list and all library tabs at five widths in both themes, with rendered screenshots.');
    assert.deepEqual(errors,[]);
    console.log('PASS: no unhandled browser JavaScript errors.');
  } finally {
    for(const c of contexts) await c.close().catch(()=>{});
    await browser.close(); server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
