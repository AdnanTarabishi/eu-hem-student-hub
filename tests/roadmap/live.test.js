// Read-only live check: no forms, accounts, analytics or changes to published data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='https://adnantarabishi.github.io/eu-hem-student-hub/';
const files=['content/roadmap.json','content/updates.json'];
const expected=Object.fromEntries(files.map(f=>[f,JSON.parse(fs.readFileSync(f,'utf8'))]));
(async()=>{
 let matches=false;
 for(let n=0;n<18;n++) {
   const result=await Promise.all(files.map(async f=>{const r=await fetch(BASE+f+'?review='+process.env.GITHUB_SHA,{signal:AbortSignal.timeout(15000)});return r.ok&&JSON.stringify(await r.json())===JSON.stringify(expected[f]);}));
   if(result.every(Boolean)){matches=true;break;}await new Promise(r=>setTimeout(r,10000));
 }
 assert.equal(matches,true,'live roadmap data must match the reviewed files');
 const browser=await chromium.launch();
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1100},serviceWorkers:'block',colorScheme:'light',reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'roadmap.html#updates',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('.update-entry').length===54);
  assert.deepEqual(await page.locator('.roadmap-overview-item').evaluateAll(xs=>xs.map(x=>x.textContent.replace(/\s+/g,''))),['2Now','9Next','7Later','54Released']);
  const dir=process.env.SCREENSHOT_DIR;if(dir)fs.mkdirSync(dir,{recursive:true});
  if(dir) await page.screenshot({path:path.join(dir,'roadmap-updates-live.png')});
  await page.locator('#update-timetable-monthly-progress .roadmap-details-link').click();
  assert.match(await page.locator('#roadmap-drawer').innerText(),/scheduled.*not attendance/s);
  await page.keyboard.press('Escape');
  await page.locator('#tab-roadmap').click();
  assert.equal(await page.locator('#roadmap-vision [role=progressbar]').getAttribute('aria-valuenow'),'25');
  assert.match(await page.locator('.roadmap-release-following').innerText(),/Early November 2026/);
  if(dir)await page.screenshot({path:path.join(dir,'roadmap-overview-live.png')});
  await page.locator('#tab-journey').click();assert.ok(await page.locator('.journey-event.is-release').count()>=54);
  await page.setViewportSize({width:390,height:844});await page.locator('#tab-updates').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1);
  if(dir)await page.screenshot({path:path.join(dir,'roadmap-updates-phone-live.png')});
  assert.deepEqual(errors,[]);
  if(dir)fs.writeFileSync(path.join(dir,'roadmap-live-result.json'),JSON.stringify({dataMatches:true,releases:54,now:2,next:9,later:7,ownerEstimate:25,errors},null,2));
  console.log('PASS: the live Roadmap, Updates, Journey, monthly-progress release drawer and phone layout match the reviewed release history.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
