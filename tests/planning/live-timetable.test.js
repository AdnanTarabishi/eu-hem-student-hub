// Read-only published-site check. No messages, accounts, analytics or synthetic sessions.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = 'https://adnantarabishi.github.io/eu-hem-student-hub/';
const DIR = process.env.PLANNING_SCREENSHOT_DIR;
(async () => {
  if (DIR) fs.mkdirSync(DIR,{recursive:true});
  const assets=['timetable.js','timetable-calendar.js','timetable-progress.js','timetable-progress.css'];
  let matches=false;
  for(let attempt=0;attempt<18;attempt++) {
    const results=await Promise.all(assets.map(async file=>{
      const r=await fetch(BASE+file+'?verify='+process.env.GITHUB_SHA,{signal:AbortSignal.timeout(15000)});
      return r.ok && (await r.text()).replace(/\r\n/g,'\n')===fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
    }));
    if(results.every(Boolean)) {matches=true;break;}
    await new Promise(resolve=>setTimeout(resolve,10000));
  }
  assert.equal(matches,true,'published script must match the tested release');
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1100},serviceWorkers:'block',colorScheme:'light'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(BASE+'timetable.html?view=month',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof timetable!=='undefined' && (timetable.ready || document.querySelector('.planning-empty')), null, {timeout:45000});
    const ready=await page.evaluate(()=>timetable.ready);
    if(ready) {
      assert.ok(await page.locator('.tt-month-day').count()>=28);
      await page.locator('#show-teacher').check();
      for(const v of ['day','week','list','month']) {await page.locator(`[data-view="${v}"]`).click();assert.equal(await page.locator(`[data-view="${v}"]`).getAttribute('aria-pressed'),'true');}
    }
    if(!ready) assert.equal(await page.locator('#monthly-progress-values').isVisible(),false,'source failure cannot show a percentage');
    else assert.ok(['ready','empty','unavailable'].includes(await page.locator('#monthly-progress').getAttribute('data-state')));
    if(DIR) {
      await page.screenshot({path:path.join(DIR,'timetable-live-month.png'),fullPage:true});
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:path.join(DIR,'timetable-live-phone.png'),fullPage:true});
      fs.writeFileSync(path.join(DIR,'live-result.json'),JSON.stringify({scriptMatches:matches,officialFeedAvailable:ready,progressState:await page.locator('#monthly-progress').getAttribute('data-state'),sourceStatus:await page.locator('#timetable-checked').innerText(),errors},null,2));
    }
    assert.deepEqual(errors,[]);
    console.log(ready ? 'Published Month / Day / Week / List and teacher control verified against the live official feed.' : 'Published code matches; UniBo feed unavailable in this check. No invented sessions or class highlights were shown.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
