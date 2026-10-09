// Fixture-only integration tests: no real external request, private data or submissions.
const http=require('http'), fs=require('fs'), path=require('path'), assert=require('assert');
const {chromium}=require('playwright');
const ROOT=path.resolve(process.argv[2]||'.'), SHOTS=process.env.EXAMS_SCREENSHOT_DIR;
const MIME={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
const sourceDate=(d,t='')=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})+(t?' at '+t:'');
function event(id,code,component,date,time='09:00',room='Fictional QA room') {return `<h3 role="tab" aria-controls="${id}"><a><span class="code">${code}</span> Course <span class="docente">QA Lecturer</span></a></h3><div id="${id}"><table class="single-item"><tr><th>When</th><td>${sourceDate(date,time)}</td></tr>${component?`<tr><th>Componente:</th><td>${component} - Module</td></tr>`:''}<tr><th>Subscriptions list:</th><td><span>${sourceDate('2026-10-01')}</span><span>${sourceDate('2026-10-25')}</span></td></tr><tr><th>Test type:</th><td>scritto</td></tr><tr><th>Place:</th><td>${room}</td></tr></table></div>`;}
const FEED=[event('i','B1076','','2026-10-27'),event('s','96525','74948','2026-10-27'),event('sr','96525','74948','2027-01-15'),event('f','96496','96498','2026-10-29'),event('fr','96496','96498','2027-01-16'),event('h','97177','79060','2026-10-28'),event('m','97177','87428','2026-12-17'),event('r','96500','','2026-11-05')].join('\n');
const PLAN=JSON.stringify({version:1,cohort:'2026-27',term:'y1-s1',choices:{quant:'96525',elective:'C8393'},statuses:{},savedAt:'2026-10-01T10:00:00Z'});
(async()=>{
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://test'),file=path.resolve(ROOT,url.pathname.replace(/^\/hub\//,''));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('missing');}res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const BASE=`http://127.0.0.1:${server.address().port}/hub/`;
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 let checks=0;const errors=[];const ok=name=>{checks++;console.log('  ok  '+name);};
 async function open({width=1440,scheme='light',feed=FEED,failOnce=false,studyFailure=false,blocked=false,plan=false,nojs=false}={}){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:scheme,timezoneId:'America/New_York',reducedMotion:'reduce',serviceWorkers:'block',javaScriptEnabled:!nojs});
  context.setDefaultTimeout(7000);if(!nojs)await context.clock.setFixedTime(new Date('2026-10-09T17:20:00Z'));
  if(blocked)await context.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked')}}));
  if(plan)await context.addInitScript(p=>localStorage.setItem('euhem-study-plan-v1',p),PLAN);
  let failed=false;
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='corsi.unibo.it'){if(failOnce&&!failed){failed=true;return route.fulfill({status:503,body:'unavailable'});}return route.fulfill({contentType:'text/html',body:feed});}if(u.hostname!=='127.0.0.1')return route.abort();if(studyFailure&&u.pathname.includes('/content/modules/'))return route.fulfill({status:503,body:'unavailable'});return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(BASE+'exams.html');
  if(!nojs)await page.waitForFunction(()=>document.getElementById('exam-list').getAttribute('aria-busy')==='false');
  return {page,context};
 }
 const view=(p,name)=>p.getByRole('button',{name,exact:true}).click();
 async function screenshot(p,name){if(!SHOTS)return;fs.mkdirSync(SHOTS,{recursive:true});await p.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0)});await p.screenshot({path:path.join(SHOTS,name+'.png'),fullPage:true});}
 try{
  let {page:p,context:c}=await open();
  assert.equal(await p.locator('#exam-explainer').getAttribute('open'),null);
  await p.locator('#exam-explainer>summary').focus();await p.keyboard.press('Enter');assert.ok(await p.locator('#exam-explainer').evaluate(n=>n.open));assert.match(await p.locator('#exam-explainer').innerText(),/rolling window/);await p.keyboard.press('Enter');
  ok('explanation starts collapsed and opens/closes with native keyboard interaction');
  assert.equal(await p.locator('#exam-special').count(),0);
  const admin=p.locator('.exam-course-group.is-administrative');assert.equal(await admin.count(),1);assert.equal(await admin.locator('[data-kind="administrative"]').count(),1);assert.match(await admin.innerText(),/No final exam/);
  await admin.locator('.exam-admin-instructions>summary').click();assert.match(await admin.innerText(),/Virtuale|Tuesday/);assert.match(await admin.innerText(),/did not explicitly guarantee/);await admin.locator('.exam-admin-instructions>summary').click();
  ok('Economics guidance lives in its single dated course card; mandatory enrolment is not hidden or called a written test');
  const groups=await p.locator('.exam-course-group').count();assert.equal(groups,5);assert.equal(await p.locator('.exam-card').count(),8);
  assert.equal(await p.locator('#exam-list').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),2);
  const more=p.locator('[data-course="quant-methods"] .exam-more-sittings>summary');await more.click();
  await view(p,'List');assert.equal(await p.locator('.exam-course-group').count(),groups);assert.equal(await p.getByRole('button',{name:'List',exact:true}).getAttribute('aria-pressed'),'true');assert.ok(await more.evaluate(n=>n.parentElement.open));
  assert.equal(await p.evaluate(()=>document.activeElement.textContent.trim()),'List');
  await screenshot(p,'exams-list-desktop');await view(p,'Cards');await more.click();
  ok('two-column Cards and compact List share every date, preserve disclosures and keep focus on the view switch');
  await p.locator('[data-course="quant-methods"] .exam-practice').waitFor();
  assert.match(await p.locator('[data-course="quant-methods"] .exam-practice').getAttribute('href'),/course=quant-methods.*practiceTopic=statistics\./);
  assert.match(await p.locator('[data-course="fund-quant-methods"] .exam-practice').getAttribute('href'),/course=fund-quant-methods.*practiceTopic=fund-statistics\./);
  assert.equal(await admin.locator('.exam-practice').count(),0);assert.match(await admin.locator('.exam-revise').getAttribute('href'),/course=intro-economics&tab=resources/);
  await screenshot(p,'exams-cards-desktop');
  ok('revision and self-test links target the correct course and only advertise real content; no quiz for the crash course');
  await view(p,'Month');assert.match(await p.locator('#exam-month-title').innerText(),/October 2026/);
  assert.equal(await p.locator('#exam-list .exam-card').count(),4);
  const day=p.locator('[data-day="2026-10-27"]');assert.match(await day.getAttribute('aria-label'),/1 exam sitting, 1 administrative recording/);
  await day.click();assert.equal(await p.locator('.exam-card').count(),2);assert.equal(await day.getAttribute('aria-pressed'),'true');
  await screenshot(p,'exams-month-desktop');await p.locator('#exam-clear-day').click();assert.equal(await p.locator('.exam-card').count(),4);
  ok('monthly calendar marks exam days and administrative recording separately; day selection and Show full month filter the same collection');
  await p.locator('[data-day="2026-10-10"]').click();assert.match(await p.locator('.planning-empty').innerText(),/No dates listed/);
  await p.locator('#exam-month-next').click();assert.match(await p.locator('#exam-month-title').innerText(),/November/);assert.equal(await p.locator('.exam-card').count(),1);
  await p.locator('#exam-month-next').click();assert.equal(await p.locator('.exam-card').count(),1);assert.equal(await p.locator('.exam-practice').count(),0,'management-only month must not advertise an economics quiz');
  await p.locator('#exam-month-next').click();assert.match(await p.locator('#exam-month-title').innerText(),/January 2027/);assert.equal(await p.locator('.exam-card').count(),2);
  ok('empty days, semester changes, year rollover and module-specific study availability remain truthful');
  await p.locator('#exam-month-today').click();await day.focus();await p.keyboard.press('ArrowRight');assert.equal(await p.evaluate(()=>document.activeElement.dataset.day),'2026-10-28');await p.keyboard.press('PageDown');assert.equal(await p.evaluate(()=>document.activeElement.dataset.day),'2026-11-28');await p.keyboard.press('Enter');assert.equal(await p.locator('[data-day="2026-11-28"]').getAttribute('aria-pressed'),'true');
  ok('calendar has roving focus, arrow navigation and Page Down across months, independent of browser timezone');
  await p.locator('#exam-month-today').click();await p.locator('#exam-course-filter').selectOption('intro-economics');assert.equal(await p.locator('.exam-card').count(),1);assert.match(await day.getAttribute('aria-label'),/0 exam sittings, 1 administrative recording/);
  await view(p,'List');assert.equal(await p.locator('#exam-course-filter').inputValue(),'intro-economics');await p.locator('#exam-reset').click();await view(p,'Month');assert.equal(await p.locator('.exam-card').count(),4);
  ok('course filters apply to all views and calendar counts, survive view switches and reset without misleading dates');
  await view(p,'Cards');await admin.locator('.exam-sitting-details>summary').click();
  let downloading=p.waitForEvent('download');await admin.getByRole('button',{name:/Add recording reminder:/}).click();let download=await downloading;let ics=fs.readFileSync(await download.path(),'utf8');assert.match(ics,/Pass-Fail recording/);assert.doesNotMatch(ics,/SUMMARY:Exam:/);assert.doesNotMatch(ics,/DTEND/);assert.match(ics,/No final examination/);
  const real=p.locator('[data-course="fund-quant-methods"] .exam-card').first();await real.locator('.exam-sitting-details>summary').click();downloading=p.waitForEvent('download');await real.getByRole('button',{name:/Add exam:/}).click();download=await downloading;ics=fs.readFileSync(await download.path(),'utf8');assert.match(ics,/SUMMARY:Exam:/);assert.match(ics,/Register on AlmaEsami/);
  ok('calendar exports distinguish a recording reminder from an actual exam and never imply registration');
  await c.close();
  ({page:p,context:c}=await open({failOnce:true}));assert.match(await p.locator('#exam-feed-notice').innerText(),/incomplete/);assert.equal(await p.locator('.exam-card').count(),1);assert.match(await p.locator('.exam-card').textContent(),/lecturer email/);await p.getByRole('button',{name:'Retry official dates'}).click();await p.waitForFunction(()=>document.querySelectorAll('.exam-card').length===8);assert.equal(await p.locator('.is-administrative').count(),1);await c.close();
  ok('failed official feed shows only a labelled lecturer date; Retry restores real dates without duplicating the recording entry');
  ({page:p,context:c}=await open({studyFailure:true}));await p.waitForTimeout(100);assert.equal(await p.locator('.exam-practice').count(),0);assert.equal(await p.locator('.exam-revise').count(),5);await c.close();
  ok('unavailable optional study content leaves resource links and fully working exam dates');
  ({page:p,context:c}=await open({feed:event('i','B1076','','2026-10-27','10:00')}));assert.equal(await p.locator('.exam-card').count(),1);assert.match(await p.locator('.exam-card').innerText(),/10:00/);await p.locator('.exam-admin-instructions>summary').click();assert.match(await p.locator('.exam-conflict').innerText(),/09:00.*differs/);await c.close();
  ok('live/email time differences preserve the live time and disclose the mismatch rather than inventing two sessions');
  ({page:p,context:c}=await open({plan:true}));assert.equal(await p.locator('.is-administrative').count(),0);assert.equal(await p.locator('[data-course="fund-quant-methods"]').count(),0);await p.locator('.my-courses-switch input').uncheck();assert.equal(await p.locator('.is-administrative').count(),1);await c.close();
  ({page:p,context:c}=await open({blocked:true}));await view(p,'Month');await p.locator('[data-day="2026-10-27"]').click();assert.equal(await p.locator('.exam-card').count(),2);await c.close();
  ok('saved study-plan scope is respected and blocking storage does not break any view');
  for(const width of [320,390,768,1440])for(const scheme of ['light','dark']){
    ({page:p,context:c}=await open({width,scheme}));
    for(const name of ['Cards','List','Month']){await view(p,name);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0,`${width} ${scheme} ${name} overflow`);}
    if(width===390){await screenshot(p,`exams-month-phone-${scheme}`);await view(p,'Cards');await screenshot(p,`exams-cards-phone-${scheme}`);}
    if(width===1440&&scheme==='dark'){await view(p,'Cards');await screenshot(p,'exams-cards-desktop-dark');}
    await c.close();
  }
  ok('Cards/List/Month fit 320, 390, 768 and 1440px in both themes with no horizontal page overflow');
  ({page:p,context:c}=await open({nojs:true}));await p.locator('#exam-explainer>summary').click();assert.match(await p.locator('#exam-explainer').innerText(),/First sitting/);assert.ok(await p.getByRole('link',{name:'Open official exam dates',exact:true}).count());await c.close();
  ok('without JavaScript the native explanation and official-source fallback still work');
  assert.deepEqual(errors,[]);ok('no uncaught browser errors');
  console.log(`${checks} Exams workspace browser groups passed`);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
