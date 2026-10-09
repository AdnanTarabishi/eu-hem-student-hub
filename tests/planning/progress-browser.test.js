// All feeds are fictional. No submission, account or external data provider is contacted.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || '.');
const NOW = '2026-10-09T08:30:00Z';
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2', '.webmanifest':'application/manifest+json' };
const make = (code, day, time, teacher, options = {}) => ({ cod_modulo:code, title:'OFFICIAL / FICTIONAL WORKSHOP', start:`${day}T${time}:00`, end:`${day}T${String(Number(time.slice(0,2))+2).padStart(2,'0')}${time.slice(2)}:00`, time:`${time} - ${String(Number(time.slice(0,2))+2).padStart(2,'0')}${time.slice(2)}`, aule:options.online ? [] : [{des_edificio:options.room || 'QA Classroom', des_indirizzo:'Fictional campus, Bologna'}], docente:teacher, note:options.note || '', teledidattica:!!options.online });
const FEED = [make('96498','2026-10-01','09:00','QA Statistics Teacher'), make('96498','2026-10-08','09:00','QA Statistics Teacher'), make('79060','2026-10-09','10:00','QA Economics Teacher'), {...make('79060','2026-10-20','09:00','QA Economics Teacher'),end:'2026-10-20T13:00:00',time:'09:00 - 13:00'}];
(async () => {
  const server = http.createServer((req,res) => {
    const file = path.resolve(ROOT, decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1) || 'index.html');
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, {'Content-Type':MIME[path.extname(file)] || 'application/octet-stream'}); res.end(fs.readFileSync(file));
  }).listen(0,'127.0.0.1');
  await new Promise(resolve => server.on('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args:['--no-sandbox']});
  const errors=[], contexts=[]; let checks=0;
  const ok = text => { checks++; console.log('  ok  '+text); };
  const open = async (options={}) => {
    const {url='timetable.html', feed=FEED, fail=false, storage={}, blocked=false, clock=false, ...rest}=options;
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',colorScheme:'light',reducedMotion:'reduce',serviceWorkers:'block',...rest}); contexts.push(context);
    if (clock) { await context.clock.install({time:new Date(NOW)}); await context.clock.pauseAt(new Date(NOW)); } else await context.clock.setFixedTime(new Date(NOW));
    await context.addInitScript(items => { for(const [k,v] of Object.entries(items)) localStorage.setItem(k,v); }, storage);
    if (blocked) await context.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
    let attempts=0;
    await context.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.hostname==='corsi.unibo.it' && u.pathname.includes('@@orario_reale_json')) { attempts++; return fail && attempts===1 ? route.fulfill({status:503,body:'unavailable'}) : route.fulfill({contentType:'application/json',body:JSON.stringify(feed)}); }
      return u.origin===new URL(base).origin ? route.continue() : route.abort();
    });
    const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message)); await page.goto(base+url);
    if(!fail) await page.waitForFunction(()=>typeof timetable!=='undefined' && timetable.ready);
    return page;
  };
  const mode = (p,v) => p.locator(`[data-view="${v}"]`).click();
  const date = (p,d) => p.locator('#week-picker').fill(d);
  const teachers = p => p.locator('#schedule-list .tt-teacher:visible');
  const capture = async (p,name) => {
    if(!process.env.PLANNING_SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.PLANNING_SCREENSHOT_DIR,{recursive:true});
    await p.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);});
    await p.screenshot({path:path.join(process.env.PLANNING_SCREENSHOT_DIR,name+'.png'),fullPage:true});
  };
  try {
    let p=await open({url:'timetable.html?view=month'});
    const percent=()=>p.locator('#monthly-progress-percent').innerText();
    assert.equal(await percent(),'40%');
    assert.equal(await p.locator('#monthly-progress-finished').innerText(),'4 h');
    assert.equal(await p.locator('#monthly-progress-total').innerText(),'10 h');
    assert.equal(await p.locator('#monthly-progress-remaining').innerText(),'6 h');
    assert.match(await p.locator('#monthly-progress-status').innerText(),/1 class is in progress/);
    assert.match(await p.locator('#monthly-progress-status').innerText(),/not attendance/);
    assert.equal(await p.locator('#monthly-progress-bar').getAttribute('value'),'40');
    ok('the published-month denominator shows 40%, not the percentage of classes or calendar days');
    for(const v of ['day','week','month','list']) {
      await mode(p,v); assert.equal(await percent(),'40%',v);
      await p.locator('#show-teacher').check(); assert.equal(await percent(),'40%');
      if(v==='list') { await p.locator('#show-past').check(); assert.equal(await percent(),'40%'); await p.locator('#show-past').uncheck(); }
    }
    ok('all views retain the monthly denominator; hiding past classes and toggling names leave it unchanged');
    await p.locator('#course-filter').selectOption('fund-quant-methods'); assert.equal(await percent(),'100%');
    await p.locator('#timetable-reset').click(); await p.locator('#timetable-search').fill('QA Economics Teacher');assert.equal(await percent(),'0%');
    assert.match(await p.locator('#monthly-progress-scope').innerText(),/Search applied/);
    await p.locator('#timetable-search').fill('nothing-matches'); assert.equal(await p.locator('#monthly-progress-values').isVisible(),false);
    assert.match(await p.locator('#monthly-progress-status').innerText(),/No published hours/);
    await p.locator('#timetable-reset').click();assert.equal(await percent(),'40%');
    ok('course and search filters change the scope and hours, with an honest no-matching-hours state');
    await mode(p,'month'); await date(p,'2026-11-01');
    assert.equal(await p.locator('#monthly-progress-values').isVisible(),false);
    assert.match(await p.locator('#monthly-progress-scope').innerText(),/November 2026/);
    await mode(p,'list'); assert.equal(await percent(),'40%');
    assert.match(await p.locator('#monthly-progress-scope').innerText(),/October 2026/);
    await mode(p,'month');await date(p,'2026-10-09');
    await p.locator('.tt-progress-method summary').click();
    await p.locator('.tt-month-day[data-date="2026-10-09"]').focus();
    await p.context().clock.setFixedTime(new Date('2026-10-09T10:00:00Z'));
    await p.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
    assert.equal(await percent(),'60%');
    assert.equal(await p.locator('.tt-progress-method').getAttribute('open'),'');
    assert.equal(await p.evaluate(()=>document.activeElement.dataset.date),'2026-10-09');
    ok('ending a class refreshes progress without disturbing the selected date, keyboard focus or explanation');
    await p.context().clock.setFixedTime(new Date('2026-10-01T06:00:00Z'));await p.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));assert.equal(await percent(),'0%');
    await date(p,'2026-10-15');await p.context().clock.setFixedTime(new Date('2026-11-01T06:00:00Z'));await p.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));assert.equal(await percent(),'100%');
    await p.context().close();
    ok('future sessions remain unfinished and the selected past month reaches 100% only after the final end');
    p=await open({url:'timetable.html?view=month',fail:true}); await p.getByRole('button',{name:'Retry',exact:true}).waitFor();
    assert.equal(await p.locator('#monthly-progress-values').isVisible(),false);
    assert.equal(await p.locator('#monthly-progress').getAttribute('data-state'),'error');
    assert.match(await p.locator('#monthly-progress-status').innerText(),/no percentage has been assumed/i);
    await p.getByRole('button',{name:'Retry',exact:true}).click(); await p.waitForFunction(()=>timetable.ready);assert.equal(await percent(),'40%');
    await p.context().route('**/@@orario_reale_json*',route=>route.fulfill({status:503,body:'unavailable'}));
    await p.locator('#timetable-refresh').click();await p.getByRole('button',{name:'Retry',exact:true}).waitFor();
    assert.equal(await p.locator('#monthly-progress-values').isVisible(),false);
    await p.context().close();
    p=await open({url:'timetable.html?view=month',feed:[]});assert.equal(await p.locator('#monthly-progress-values').isVisible(),false);assert.equal(await p.locator('#monthly-progress').getAttribute('data-state'),'empty');await p.context().close();
    ok('initial and refresh failures remove numeric progress; a successful empty feed stays distinct');
    p=await open({url:'timetable.html?view=month',feed:[{...FEED[0],end:'2026-10-01T08:00:00'}]});
    assert.equal(await p.locator('#monthly-progress-values').isVisible(),false);assert.match(await p.locator('#monthly-progress-status').innerText(),/durations could not be validated/);await p.context().close();
    p=await open({url:'timetable.html?view=month',blocked:true});assert.equal(await percent(),'40%');await p.context().close();
    ok('invalid durations cannot claim completion and storage-blocked visits still calculate progress');
    const plan=JSON.stringify({version:1,cohort:"2026-27",term:"y1-s1",choices:{quant:"96525",elective:"C8393"},statuses:{},savedAt:"2026-10-01T10:00:00Z"});
    p=await open({url:'timetable.html?view=month',storage:{'euhem-study-plan-v1':plan}});
    assert.equal(await percent(),'0%');
    assert.match(await p.locator('#monthly-progress-scope').innerText(),/My courses only/);
    await p.locator('.my-courses-switch input').uncheck();assert.equal(await percent(),'40%');
    assert.equal(await p.evaluate(()=>localStorage.getItem('euhem-study-plan-v1')),plan);
    await p.context().close();
    ok('saved study-plan filtering changes monthly totals without modifying the study plan or adding storage');
    p=await open({url:'timetable.html?view=week',clock:true});
    await p.clock.fastForward(90*60*1000);
    assert.equal(await percent(),'60%');await p.context().close();
    ok('the minute timer refreshes progress at a class end even when the weekly grid is not redrawn');
    for(const width of [320,390,768,1440]) for(const colorScheme of ['light','dark']) {
      p=await open({url:'timetable.html?view=month',viewport:{width,height:1000},colorScheme});
      assert.equal(await percent(),'40%');
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1);
      await p.locator('.tt-progress-method summary').focus();await p.keyboard.press('Enter');
      assert.equal(await p.locator('.tt-progress-method').getAttribute('open'),'');
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1);
      await p.keyboard.press('Enter');
      if([390,1440].includes(width)) await capture(p,`teaching-progress-${width}-${colorScheme}`);
      await p.context().close();
    }
    ok('progress, metrics and keyboard explanation fit phone and desktop in both themes');
    assert.deepEqual(errors,[]);ok('no uncaught JavaScript errors or remote writes during the isolated progress tests');
    console.log(`${checks} teaching-progress browser checks passed`);
  } finally {for(const c of contexts) await c.close().catch(()=>{});await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
