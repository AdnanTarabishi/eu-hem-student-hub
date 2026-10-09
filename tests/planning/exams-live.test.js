// Read-only public-page verification, only run after publishing main. No forms,
// registrations, messages, personal account sessions or learner data are sent.
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='https://adnantarabishi.github.io/eu-hem-student-hub/';
(async()=>{
  const expected=fs.readFileSync('exams-workspace.js','utf8');
  let matched=false;
  for(let attempt=0;attempt<15;attempt++){
    const response=await fetch(BASE+'exams-workspace.js?verify='+Date.now());
    if(response.ok&&(await response.text()).replace(/\r\n/g,'\n')===expected.replace(/\r\n/g,'\n')){matched=true;break;}
    await new Promise(resolve=>setTimeout(resolve,8000));
  }
  assert.ok(matched,'Published helper must match this commit before live verification');
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(BASE+'exams.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('exam-list')?.getAttribute('aria-busy')==='false',{},{timeout:30000});
    await page.getByRole('button',{name:'Cards',exact:true}).waitFor();
    assert.equal(await page.locator('#exam-explainer').evaluate(n=>n.open),false);
    assert.equal(await page.locator('#exam-special').count(),0);
    const shots=process.env.EXAMS_SCREENSHOT_DIR;
    if(shots)fs.mkdirSync(shots,{recursive:true});
    for(const view of ['Cards','List','Month']){
      await page.getByRole('button',{name:view,exact:true}).click();
      assert.equal(await page.getByRole('button',{name:view,exact:true}).getAttribute('aria-pressed'),'true');
      if(view==='Month')assert.equal(await page.locator('#exam-month').isVisible(),true);
      await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo({top:0,behavior:'instant'});});
      await page.waitForTimeout(400);
      if(shots)await page.screenshot({path:path.join(shots,`live-exams-${view.toLowerCase()}.png`),fullPage:true});
    }
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(250);
    if(shots)await page.screenshot({path:path.join(shots,'live-exams-month-phone.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Published helper matched; Cards/List/Month, collapsed guidance, phone layout and script execution verified.');
    console.log('Feed state:',await page.locator('#exam-checked').innerText());
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
