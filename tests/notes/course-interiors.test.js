// Real browser, real public course content; external feeds are explicitly controlled test fixtures.
// Run: node tests/notes/course-interiors.test.js .
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2] || '.');
const shots = process.env.COURSE_SCREENSHOT_DIR;
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const courses = read('content/programme.json').cohorts[0].terms[0].courses;
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.md':'text/plain','.csv':'text/csv','.ics':'text/calendar','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const session = (code, date, start, end) => ({cod_modulo:code,title:'Browser test class',start:`${date}T${start}:00`,end:`${date}T${end}:00`,time:`${start} - ${end}`,aule:[{des_edificio:'Test room',des_indirizzo:'Example address'}],docente:'Example instructor',teledidattica:false,note:''});
const feed = [session('79060','2026-10-08','09:00','11:00'),session('79060','2026-10-09','08:00','10:00'),session('79060','2026-10-09','12:00','13:00'),session('79060','2026-10-12','09:00','11:00'),session('87428','2026-11-12','09:00','11:00')];
const exam = `<h3 role="tab" aria-controls="e1"><a><span class="code">97177</span>Course <span class="docente">Example instructor</span></a></h3><div id="e1"><table class="single-item"><tr><th>When</th><td>26 October 2026 at 09:00</td></tr><tr><th>Subscriptions list:</th><td><span>01 October 2026</span><span>25 October 2026</span></td></tr><tr><th>Test type:</th><td>scritto</td></tr><tr><th>Place:</th><td>Test exam room</td></tr></table></div>`;
(async () => {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/eu-hem-student-hub\//, '');
    const file = path.resolve(root, name || 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}); res.end(fs.readFileSync(file));
  }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/eu-hem-student-hub/`;
  const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args:['--no-sandbox']});
  const errors = [], contexts = [];
  const open = async (url, {width=1440, scheme='light', timetable=feed, examHtml=exam, calendar=true, now='2026-10-09T12:30:00+02:00', timezoneId='Europe/Rome', delay=0} = {}) => {
    const context = await browser.newContext({viewport:{width,height:1000}, colorScheme:scheme, reducedMotion:'reduce', serviceWorkers:'block', timezoneId}); contexts.push(context);
    await context.clock.setFixedTime(new Date(now));
    await context.route(/^https?:\/\//, async route => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1') {
        if (!calendar && u.pathname.includes('/calendar/')) return route.fulfill({status:503, body:'Test: calendar unavailable'});
        return route.continue();
      }
      if (u.hostname === 'corsi.unibo.it') {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        if (u.pathname.includes('@@orario_reale_json')) return timetable === null ? route.abort() : route.fulfill({contentType:'application/json',body:JSON.stringify(timetable)});
        if (u.pathname.endsWith('exam-dates')) return examHtml === null ? route.abort() : route.fulfill({contentType:'text/html',body:examHtml});
      }
      return route.abort();
    });
    const p = await context.newPage(); p.on('pageerror', error => errors.push(error.message));
    await p.goto(base + url); await p.waitForSelector('#course-panel'); return p;
  };
  const settled = p => p.waitForFunction(() => page.unibo !== 'loading' && page.examState !== 'loading');
  const selectTab = async (p, tab) => { await p.locator('.cw-tabs a').filter({hasText:new RegExp(`^${tab}$`)}).click(); await p.waitForSelector('#course-panel'); };
  let checks=0;
  const ok = text => { checks++; console.log('PASS '+text); };
  try {
    let p = await open('course.html?course=fund-health-econ-management&tab=schedule'); await settled(p);
    assert.equal(await p.locator('.cw-session').count(),3);
    assert.match(await p.locator('.cw-next-class').innerText(), /IN PROGRESS/);
    await p.getByRole('button',{name:'Past',exact:true}).click(); assert.equal(await p.locator('.cw-session').count(),2);
    await p.getByRole('button',{name:'All classes',exact:true}).click(); assert.equal(await p.locator('.cw-session').count(),5);
    await p.getByLabel('Module',{exact:true}).selectOption('fund-healthcare-management'); assert.equal(await p.locator('.cw-session').count(),1);
    assert.match(await p.locator('.cw-session').innerText(),/Healthcare Management/);
    const download = p.waitForEvent('download'); await p.locator('.cw-session').getByRole('button',{name:/Add to calendar/}).click();
    assert.match((await download).suggestedFilename(),/\.ics$/);
    ok('Schedule: Rome-time filtering, ongoing/past sessions, module filter and calendar export.');
    await selectTab(p,'Exam'); assert.match(await p.locator('.cw-exam-card').first().innerText(),/26 Oct 2026/);
    assert.match(await p.locator('.cw-registration').innerText(),/Registration open/);
    assert.match(await p.locator('.cw-assessment').innerText(),/90 minutes/);
    assert.equal(await p.locator('.cw-check input').count(),4);
    await p.locator('.cw-check input').first().check();
    await selectTab(p,'Schedule'); await selectTab(p,'Exam'); assert.equal(await p.locator('.cw-check input').first().isChecked(),true);
    ok('Exam: official-date fixture, existing assessment text, registration separation and tab-memory checklist.');
    await selectTab(p,'Topics');
    const total = await p.locator('.cw-topic-card').count(); assert(total>1);
    await p.getByRole('searchbox').fill('healthcare demand'); assert.equal(await p.locator('.cw-topic-card').count(),1);
    await p.getByRole('button',{name:'Clear filters',exact:true}).click(); assert.equal(await p.locator('.cw-topic-card').count(),total);
    await p.getByLabel('Module',{exact:true}).selectOption('fund-healthcare-management');
    assert.match(await p.locator('.cw-topic-list').innerText(),/no study material added yet|topic list is not available/);
    await p.getByRole('button',{name:'Clear filters',exact:true}).click();
    await p.getByRole('searchbox').fill('healthcare demand'); await p.locator('.cw-topic-card .save-button').click();
    const savedBefore = await p.evaluate(() => localStorage.getItem('euhem-study-list'));
    await p.locator('.cw-topic-card').getByRole('link',{name:'Open topic →',exact:true}).click(); await p.waitForSelector('.reader-main');
    await p.getByRole('button',{name:'✓ Understood',exact:true}).click();
    await selectTab(p,'Topics'); await p.getByRole('button',{name:'Clear filters',exact:true}).click();
    await p.getByLabel('Progress',{exact:true}).selectOption('understood'); assert.equal(await p.locator('.cw-topic-card').count(),1);
    assert.equal(await p.evaluate(() => localStorage.getItem('euhem-study-list')),savedBefore);
    ok('Topics: search, modules, syllabus-only state, original reader, saved IDs and progress filters.');
    await selectTab(p,'Resources'); assert.equal(await p.locator('.cw-official-card').count(),2);
    const resourceCount = await p.locator('.cw-resource-card').count(); assert(resourceCount>1);
    const first = p.locator('.cw-resource-card').first(); const id = await first.getAttribute('id'); await first.locator('.save-button').click();
    await p.getByRole('button',{name:'Saved only',exact:true}).click(); assert.equal(await p.locator('.cw-resource-card').count(),1); assert.equal(await p.locator('.cw-resource-card').getAttribute('id'),id);
    await p.locator('.cw-resource-card .save-button').click(); assert.equal(await p.locator('.cw-resource-card').count(),0);
    await p.getByRole('button',{name:'Clear filters',exact:true}).click();
    await p.getByLabel('Source type',{exact:true}).selectOption('university'); assert.equal(await p.locator('.cw-source-university').count(),4);
    await p.getByRole('button',{name:'Clear filters',exact:true}).click(); await p.getByRole('searchbox').fill('cost-sharing');
    assert.match(await p.locator('.cw-resource-grid').innerText(),/no file or external link supplied/);
    assert.equal(await p.locator('.cw-resource-card a[href="#"]').count(),0);
    ok('Resources: pinned official links, source filters, saved-list integrity and honest reference-only entries.');
    p = await open('course.html?course=fund-health-econ-management&tab=schedule',{timetable:null}); await settled(p);
    assert.match(await p.locator('.cw-empty').first().innerText(),/temporarily unavailable/);
    await selectTab(p,'Exam'); assert.equal(await p.locator('.cw-exam-card').count(),1);
    ok('Partial failure: a failed timetable does not hide a working exam feed.');
    p = await open('course.html?course=fund-health-econ-management&tab=exam',{timetable:null,examHtml:null}); await settled(p);
    await p.waitForFunction(() => page.examState === 'copy');
    assert.match(await p.locator('.cw-source').innerText(),/Saved calendar copy/);
    assert.match(await p.locator('.cw-exam-card').first().innerText(),/Not confirmed/);
    assert.equal(await p.locator('.cw-exam-card').getByRole('button',{name:/Add exam/}).count(),0);
    ok('Calendar fallback: explicit provenance, no invented times and no unconfirmed calendar export.');
    p = await open('course.html?course=health-systems&tab=exam',{timetable:null,examHtml:null,calendar:false}); await settled(p);
    assert.match(await p.locator('.cw-empty').first().innerText(),/could not be retrieved/);
    assert.equal(await p.locator('.cw-tabs a').filter({hasText:/^(Schedule|Exam|Topics|Resources)$/}).count(),4);
    await selectTab(p,'Topics'); assert.equal(await p.locator('.cw-intro h2').innerText(),'One topic at a time.');
    await selectTab(p,'Resources'); assert.equal(await p.locator('.cw-official-card').count(),1);
    ok('Empty and offline courses retain all four tabs and official recovery links.');
    p = await open('course.html?course=fund-health-econ-management&tab=topics',{delay:1800});
    await p.getByRole('searchbox').fill('healthcare demand'); await settled(p); await p.waitForTimeout(100);
    assert.equal(await p.getByRole('searchbox').inputValue(),'healthcare demand'); assert.equal(await p.locator('.cw-topic-card').count(),1);
    ok('A delayed feed does not erase topic searches or learner interactions.');
    p = await open('course.html?course=right-to-health&tab=topics'); await settled(p);
    assert.equal(await p.locator('.cw-topic-card').count(),10);
    await p.getByRole('searchbox').fill('patient mobility'); await p.locator('.cw-topic-card').getByRole('link',{name:'Open topic →',exact:true}).click();
    await p.waitForSelector('.rth-reading'); assert.match(await p.locator('.rth-reading').innerText(),/Economic rights/);
    await selectTab(p,'Resources'); assert.match(await p.locator('.cw-rail').innerText(),/not automatically a book reviewed in full/);
    await selectTab(p,'Schedule'); assert.match(await p.locator('.cw-rail').innerText(),/Guest sessions & workshop/);
    await selectTab(p,'Exam'); assert.equal(await p.getByText('Course-specific exam and contact notes',{exact:true}).count(),1);
    ok('Right to Health: all ten guide links, reader, reading caveats and supplied course notices preserved.');
    p = await open('course.html?course=right-to-health&tab=resources#right-to-health.r.024');
    assert.equal(await p.locator('[id="right-to-health.r.024"]').count(), 1);
    assert.equal(await p.locator('.cw-resource-card').count(), 24);
    p = await open('course.html?course=fund-health-econ-management&tab=topics#module-fund-healthcare-management');
    assert.equal(await p.locator('#module-fund-healthcare-management').count(), 1);
    p = await open('course.html?course=fund-health-econ-management&tab=topics#%invalid');
    await p.locator('.cw-tabs a').filter({hasText:/^Resources$/}).focus(); await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.activeElement.id === 'course-panel');
    assert.equal(await p.locator('.cw-panel').getAttribute('data-section'),'resources');
    await p.goBack(); await p.waitForSelector('.cw-topic-list');
    assert.equal(await p.locator('.cw-tabs a[aria-current]').innerText(),'Topics');
    ok('Deep links beyond pagination, invalid hashes, keyboard navigation and browser Back.');
    p = await open('course.html?course=fund-health-econ-management&tab=schedule',{timezoneId:'America/Los_Angeles'}); await settled(p);
    assert.equal(await p.locator('.cw-session').count(),3);
    ok('Session filtering stays in Bologna time even when the browser is abroad.');
    for (const c of courses) {
      p = await open(`course.html?course=${c.id}&tab=resources`,{timetable:null,examHtml:null});
      assert.equal(await p.locator('.cw-header h1').count(),1);
      assert.equal(await p.locator('.cw-official-card').count(),c.modules.length);
    }
    ok('The shared design loads for all eight existing courses.');
    if(shots)fs.mkdirSync(shots,{recursive:true});
    for (const width of [320,390,768,1440]) for (const scheme of ['light','dark']) {
      for (const tab of ['topics','resources','schedule','exam']) {
        p = await open(`course.html?course=fund-health-econ-management&tab=${tab}`,{width,scheme}); await settled(p);
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth+1);
        assert.equal(overflow,false,`${tab} overflow at ${width} ${scheme}`);
        assert.equal(await p.locator('.cw-tabs [aria-current="page"]').count(),1);
        if(shots && [390,1440].includes(width)) await p.screenshot({path:path.join(shots,`${tab}-${width}-${scheme}.png`),fullPage:true});
        if(shots && width===1440 && scheme==='light' && tab==='topics') await p.screenshot({path:path.join(shots,'topics-desktop-top.png')});
        await p.context().close();
      }
    }
    ok('32 layout cases: all four sections, four screen widths, both themes, no horizontal page overflow.');
    assert.deepEqual(errors,[]);
    console.log(`PASS: ${checks} course-interior test groups; no uncaught browser errors.`);
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
