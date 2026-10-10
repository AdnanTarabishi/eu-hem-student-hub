// All feeds are fictional. No submission, account or external data provider is contacted.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || '.');
const NOW = '2026-10-07T08:30:00Z';
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2', '.webmanifest':'application/manifest+json' };
const make = (code, day, time, teacher, options = {}) => ({ cod_modulo:code, title:'OFFICIAL / FICTIONAL WORKSHOP', start:`${day}T${time}:00`, end:`${day}T${String(Number(time.slice(0,2))+2).padStart(2,'0')}${time.slice(2)}:00`, time:`${time} - ${String(Number(time.slice(0,2))+2).padStart(2,'0')}${time.slice(2)}`, aule:options.online ? [] : [{des_risorsa:options.room || 'QA Classroom', des_piano:options.floor || 'Piano Terra', des_edificio:options.building || 'QA Teaching Building', des_indirizzo:options.address || 'Fictional campus, Bologna'}], docente:teacher, note:options.note || '', teledidattica:!!options.online });
const FEED = [make('96500','2026-10-07','07:00','QA Law Teacher'), make('96498','2026-10-07','10:00','QA Statistics Teacher'), make('79060','2026-10-07','10:00','QA Economics Teacher'), make('74948','2026-10-07','14:00','QA Advanced Teacher',{online:true}), make('UNLISTED','2026-10-08','11:00','QA Workshop Teacher'), make('96498','2026-10-09','09:00','QA Statistics Teacher'), make('C8393','2026-10-10','10:00','QA Systems Teacher')];
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
    assert.equal(await p.locator('.tt-month-day').count(),35);
    assert.equal(await p.locator('.tt-month-table td:not(.tt-outside) .tt-month-day').count(),31);
    assert.equal(await p.locator('.tt-month-table td:not(.tt-outside).has-classes').count(),4);
    assert.match(await p.locator('#schedule-status').innerText(),/7 classes across 4 teaching days/);
    assert.equal(await p.locator('.tt-month-day[aria-current="date"]').getAttribute('data-date'),'2026-10-07');
    assert.equal(await p.locator('.tt-month-day[data-date="2026-10-07"] .tt-month-count').innerText(),'4 classes');
    assert.notEqual(await p.locator('td.has-classes .tt-month-day').first().evaluate(e=>getComputedStyle(e).backgroundColor), await p.locator('td:not(.has-classes):not(.tt-outside) .tt-month-day').first().evaluate(e=>getComputedStyle(e).backgroundColor));
    ok('the complete month colours only class dates, with exact counts and Bologna today independent of device zone');
    const day8=p.locator('.tt-month-day[data-date="2026-10-08"]'); await day8.click();
    assert.equal(await p.locator('#tt-selected-day .agenda-item').count(),1);
    assert.match(await p.locator('#tt-selected-day').innerText(),/Fictional Workshop/i);
    await p.getByRole('button',{name:'Open day view',exact:true}).click();
    assert.equal(await p.locator('[data-view="day"]').getAttribute('aria-pressed'),'true');
    assert.equal(await p.locator('.agenda-item').count(),1);
    await p.getByRole('button',{name:'Today',exact:true}).click();
    assert.equal(await p.locator('.agenda-item').count(),4);
    assert.equal(await p.locator('.tt-day-choice').count(),7);
    assert.match(await p.locator('#schedule-status').innerText(),/includes earlier classes/);
    ok('a monthly date opens its own schedule; day view retains earlier classes and all seven selectable dates');
    await p.locator('.agenda-item').first().getByRole('button',{name:/Details:/}).click();
    const location=await p.locator('#session-dialog .session-location-detail').innerText();
    assert.match(location,/QA Classroom/); assert.match(location,/Piano Terra/);
    assert.match(location,/QA Teaching Building/); assert.match(location,/Fictional campus, Bologna/);
    assert.match(location,/Practical location tip|Getting there/);
    await p.locator('#session-dialog').getByRole('button',{name:'Close'}).click();
    ok('class details keep the complete official classroom, floor, building and address');
    for (const v of ['day','week','month','list']) {
      await mode(p,v); assert.equal(await teachers(p).count(),0);
      await p.locator('#show-teacher').check(); assert.ok(await teachers(p).count()>0,`${v} shows teachers`);
      const metrics=await p.locator('#timetable-summary').innerText();
      await p.locator('#show-teacher').uncheck(); assert.equal(await teachers(p).count(),0);
      assert.equal(await p.locator('#timetable-summary').innerText(),metrics,'display setting must not filter classes');
    }
    await p.locator('#show-teacher').check(); await p.reload(); await p.waitForFunction(()=>timetable.ready);
    assert.equal(await p.locator('#show-teacher').isChecked(),true);
    assert.ok(await teachers(p).count()>0);
    await p.locator('#show-teacher').uncheck(); await p.locator('#timetable-search').fill('QA Economics Teacher');
    assert.equal(await p.locator('.agenda-item').count(),1);
    await mode(p,'month'); assert.equal(await p.locator('td.has-classes').count(),1);
    assert.match(await p.locator('#schedule-status').innerText(),/1 class across 1 teaching day/);
    ok('Show teacher is optional, works across all four views, persists locally and does not affect counts or teacher search');
    await p.locator('#timetable-reset').click(); await mode(p,'month');
    await p.locator('.tt-month-day[data-date="2026-10-07"]').focus(); await p.keyboard.press('ArrowRight');
    assert.equal(await p.evaluate(()=>document.activeElement.dataset.date),'2026-10-08');
    await p.keyboard.press('Enter'); assert.equal(await p.locator('.tt-month-day[aria-pressed="true"]').getAttribute('data-date'),'2026-10-08');
    await p.keyboard.press('PageDown'); assert.match(await p.locator('#week-label').innerText(),/November 2026/);
    await p.keyboard.press('PageUp'); assert.match(await p.locator('#week-label').innerText(),/October 2026/);
    await date(p,'2026-10-31'); await p.locator('.tt-month-day[data-date="2026-10-31"]').focus(); await p.keyboard.press('ArrowRight');
    assert.equal(await p.evaluate(()=>document.activeElement.dataset.date),'2026-11-01');
    ok('keyboard date navigation, selection and month-boundary movement preserve meaningful focus');
    await date(p,'2028-02-29'); assert.equal(await p.locator('td:not(.tt-outside) .tt-month-day').count(),29);
    await date(p,'2026-08-31'); assert.equal(await p.locator('.tt-month-day').count(),42);
    await date(p,'2026-12-31'); await p.getByRole('button',{name:'Next month',exact:true}).click(); assert.match(await p.locator('#week-label').innerText(),/January 2027/);
    assert.equal(await p.locator('.tt-month-day[aria-pressed="true"]').getAttribute('data-date'),'2027-01-31');
    await p.getByRole('button',{name:'Next month',exact:true}).click(); assert.equal(await p.locator('#week-picker').inputValue(),'2027-02-28');
    ok('leap years, six-row months and December–January navigation avoid skipped or duplicated dates');
    await p.context().close();
    p=await open({url:'timetable.html?view=month',feed:[]});
    assert.equal(await p.locator('td.has-classes').count(),0); assert.equal(await p.locator('.tt-month-day').count(),35);
    assert.match(await p.locator('#tt-selected-day').innerText(),/does not confirm a cancellation/); await p.context().close();
    p=await open({url:'timetable.html?view=month',fail:true}); await p.getByRole('button',{name:'Retry',exact:true}).waitFor();
    assert.equal(await p.locator('.tt-month-day').count(),0); await p.getByRole('button',{name:'Retry',exact:true}).click();
    await p.locator('.tt-month-day').first().waitFor(); assert.equal(await p.locator('td.has-classes').count(),4);
    await p.locator('#course-filter').selectOption('fund-quant-methods'); await p.locator('#show-teacher').check();
    await p.locator('#timetable-refresh').click(); await p.waitForFunction(()=>timetable.ready);
    assert.equal(await p.locator('#course-filter').inputValue(),'fund-quant-methods'); assert.equal(await p.locator('#show-teacher').isChecked(),true);
    await p.context().close();
    ok('an empty feed is not confused with a failed feed; Retry and Refresh recover without losing display preferences');
    p=await open({blocked:true,url:'timetable.html?view=month&date=2026-02-31'});
    assert.match(await p.locator('#week-label').innerText(),/October 2026/); await p.locator('#show-teacher').check(); assert.ok(await teachers(p).count()>0); await p.context().close();
    ok('blocked storage and invalid deep-link dates do not break the calendar');
    for(const width of [320,390,768,1440]) for(const colorScheme of ['light','dark']) {
      p=await open({viewport:{width,height:1000},colorScheme,url:'timetable.html?view=month'});
      for(const v of ['month','day','week','list']) {
        await mode(p,v); await p.locator('#show-teacher').check();
        assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1,`${width} ${colorScheme} ${v} overflow`);
        if(v==='month') assert.ok((await p.locator('.tt-month-table').boundingBox()).width<width,'month fits without horizontal scroll');
        if(v !== 'list') {
          const boxes = await p.locator('#week-nav > *').evaluateAll(nodes => nodes.map(n => {const r=n.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};}));
          for(let i=1;i<boxes.length;i++) assert.ok(boxes[i].left >= boxes[i-1].right-1, `${width} ${v}: period controls must not overlap`);
          assert.ok(boxes[0].width >= 43 && boxes[2].width >= 43, 'both arrow controls retain an accessible touch target');
        }
        const stat=await p.locator('.planning-stat').first().evaluate(n=>{const label=n.querySelector('.planning-stat-label').getBoundingClientRect();const value=n.querySelector('.planning-stat-value').getBoundingClientRect();return {labelBottom:label.bottom,valueTop:value.top};});
        assert.ok(stat.valueTop>=stat.labelBottom, 'summary numbers remain below their labels, not squeezed alongside them');
        if((width===1440 || width===390) && ['month','day'].includes(v)) await capture(p,`timetable-${v}-${width}-${colorScheme}`);
      }
      await p.context().close();
    }
    ok('Day, Week, Month and List fit 320/390/768/1440px in light and dark; monthly dates never need horizontal scrolling');
    assert.deepEqual(errors,[]); ok('no uncaught JavaScript errors in the new calendar paths');
    console.log(`${checks} timetable upgrade browser checks passed`);
  } finally { for(const c of contexts) await c.close().catch(()=>{}); await browser.close(); server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
