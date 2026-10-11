// Read-only verification of the published shared footer.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='https://adnantarabishi.github.io/eu-hem-student-hub/';
const SHOTS=process.env.FOOTER_SCREENSHOT_DIR||'/tmp/footer-live';
(async()=>{
 fs.mkdirSync(SHOTS,{recursive:true});
 for(const file of ['site-nav.js','style.css','icons.svg']){
   const expected=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'); let ok=false;
   for(let i=0;i<35;i++){try{const r=await fetch(BASE+file+'?verify='+process.env.GITHUB_SHA,{cache:'no-store'});ok=r.ok&&(await r.text()).replace(/\r\n/g,'\n')===expected;}catch{} if(ok)break;await new Promise(r=>setTimeout(r,5000));}
   assert.ok(ok,'published '+file+' must match the reviewed source');
 }
 const browser=await chromium.launch(); const errors=[];
 try{
   for(const width of [1440,390]){
     const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',colorScheme:'light',reducedMotion:'reduce'});
     const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message)); await page.goto(BASE+'index.html');
     await page.locator('.footer-social-link').first().waitFor();
     assert.deepEqual(await page.locator('.footer-social-link .footer-social-text').allTextContents(),['Website','Instagram','LinkedIn','YouTube']);
     assert.equal(await page.locator('.footer-heading').count(),6);
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     await page.locator('.site-footer').screenshot({path:path.join(SHOTS,'footer-'+width+'.png')});
     await context.close();
   }
   assert.deepEqual(errors,[]);
   console.log('Published global footer verified at desktop and phone widths.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
