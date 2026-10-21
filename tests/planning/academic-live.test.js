// Read-only publication check: real public feeds/copies, no form or account actions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const BASE='https://adnantarabishi.github.io/eu-hem-student-hub/';
const shots=path.resolve('work/academic-sync-previews');
async function json(file){const r=await fetch(BASE+file+'?verify='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.ok(r.ok,file+' is published');return r.json();}
(async()=>{
  fs.mkdirSync(shots,{recursive:true});
  const assets=['unibo-data.js','timetable.js','timetable-sync.js','exams.js','content/programme.json'];
  let matched=false;
  for(let attempt=0;attempt<20;attempt++){
    const checks=await Promise.all(assets.map(async file=>{const r=await fetch(BASE+file+'?verify='+Date.now(),{signal:AbortSignal.timeout(15000)});return r.ok&&(await r.text()).replace(/\r\n/g,'\n')===fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');}));
    if(checks.every(Boolean)){matched=true;break;}
    await new Promise(r=>setTimeout(r,8000));
  }
  assert.ok(matched,'published academic scripts and course facts match the reviewed commit');
  const [status,timetable,exams]=await Promise.all(['sync-status','timetable','exams'].map(name=>json('calendar/'+name+'.json')));
  for(const [kind,snapshot] of [['timetable',timetable],['exams',exams]]){
    assert.equal(status[kind].ok,true,kind+' automatic source verification succeeded');
    assert.ok(snapshot.records.length>0,kind+' published records exist');
    assert.equal(status[kind].recordCount,snapshot.records.length);
    const age=Date.now()-Date.parse(snapshot.verifiedAt);
    assert.ok(age>=-300000&&age<48*3600000,kind+' has a recent real verification');
    assert.ok(Array.isArray(snapshot.sourceUrls)&&snapshot.sourceUrls.length>0);
    if(kind==='timetable')for(const value of snapshot.sourceUrls){const u=new URL(value),start=u.searchParams.get('start'),end=u.searchParams.get('end');assert.ok(start&&end&&Date.parse(end)-Date.parse(start)<=30*86400000,'each published source request is bounded');}
  }
  const browser=await chromium.launch();
  const result={status,timetableRecords:timetable.records.length,examRecords:exams.records.length,pages:[]};
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(BASE+'timetable.html?view=month',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof timetable!=='undefined'&&timetable.ready,null,{timeout:35000});
    const timetableState=await page.evaluate(()=>({count:timetable.sessions.length,copy:timetable.stale,verifiedAt:timetable.verifiedAt}));
    assert.ok(timetableState.count>0);const timetableLabel=await page.locator('#timetable-checked').innerText();
    if(timetableState.copy)assert.match(timetableLabel,/cached|copy/i);else assert.match(timetableLabel,/checked/i);
    result.pages.push({page:'timetable',...timetableState,label:timetableLabel});
    await page.screenshot({path:path.join(shots,'live-timetable.png'),fullPage:true});
    await page.goto(BASE+'exams.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof examsPage!=='undefined'&&examsPage.loaded&&!examsPage.loading,null,{timeout:35000});
    const examState=await page.evaluate(()=>({count:examsPage.exams.length,failed:examsPage.feedFailed,source:examsPage.sourceMeta}));
    assert.ok(examState.count>1,'published exam page has the verified university collection');
    const examLabel=await page.locator('#exam-checked').innerText();
    if(examState.source?.sourceType&&examState.source.sourceType!=='live')assert.match(examLabel,/saved|copy|cached/i);else assert.match(examLabel,/loaded|checked/i);
    result.pages.push({page:'exams',...examState,label:examLabel});
    await page.screenshot({path:path.join(shots,'live-exams.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(shots,'live-exams-phone.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1);
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(shots,'live-result.json'),JSON.stringify(result,null,2));
    console.log('Published academic assets matched; bounded timetable and complete exam snapshots are recently verified; real timetable/exam pages and phone layout preserve honest source labels.');
    console.log(JSON.stringify(result.pages));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
