// Read-only smoke check after a main-branch deployment. Never submits forms or changes user data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='https://adnantarabishi.github.io/eu-hem-student-hub/';
const SHOTS=process.env.SCREENSHOT_DIR||'/tmp/home-calendar-live';
(async()=>{
 fs.mkdirSync(SHOTS,{recursive:true});
 const files=['home-roadmap-preview.js','home-roadmap-preview.css','calendar.js','calendar-page.css'];
 // Wait for Pages/CDN to serve this checked-out revision, not simply any earlier redesign.
 for(const file of files){const expected=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');let matches=false;
  for(let attempt=0;attempt<35;attempt++){try{const response=await fetch(BASE+file+'?verify='+process.env.GITHUB_SHA,{cache:'no-store'});matches=response.ok&&(await response.text()).replace(/\r\n/g,'\n')===expected;}catch{}if(matches)break;await new Promise(r=>setTimeout(r,5000));}
  assert.ok(matches,'Published source must match the reviewed '+file);console.log('Live source matches: '+file);
 }
 const browser=await chromium.launch();const errors=[];
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce',colorScheme:'light'});
  await context.route('**/*',route=>{const request=route.request();return request.method()==='GET'&&request.url().startsWith(BASE)?route.continue():route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'index.html');await page.locator('.roadmap-preview-now').waitFor();
  const first=await page.locator('.roadmap-preview-now').getAttribute('href'),height=(await page.locator('.home-focus-panel').boundingBox()).height;
  await page.getByRole('button',{name:'Next work in progress'}).click();assert.notEqual(await page.locator('.roadmap-preview-now').getAttribute('href'),first);assert.equal((await page.locator('.home-focus-panel').boundingBox()).height,height);
  await page.getByRole('button',{name:'Older releases'}).click();assert.match(await page.locator('.roadmap-preview-latest .home-preview-counter').textContent(),/^4–6/);
  await page.locator('#home-roadmap').screenshot({path:path.join(SHOTS,`home-live-${width}.png`)});
  await page.goto(BASE+'calendar.html');await page.locator('.key-date').first().waitFor();assert.equal(await page.locator('.key-date').count(),10);
  await page.getByRole('button',{name:'Exams',exact:true}).click();assert.equal(await page.locator('.key-date').count(),3);
  await page.locator('#key-date-reset').click();await page.locator('#calendar-links').waitFor({state:'visible'});
  assert.ok((await page.locator('#calendar-url').inputValue()).startsWith(BASE+'calendar/'));
  await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo({top:0,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(SHOTS,`calendar-live-${width}.png`),fullPage:true});
  await page.screenshot({path:path.join(SHOTS,`calendar-live-top-${width}.png`)});await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Published home arrows, fixed panels, calendar filters, subscription URLs and desktop/mobile rendering verified.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
