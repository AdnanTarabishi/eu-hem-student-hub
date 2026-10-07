const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve('.'),bank=require('../../content/modules/fund-statistics/questions.json'),extension=require('../../content/modules/fund-statistics/extended-practice.json');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/markdown','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.csv':'text/csv'};
(async()=>{
  const server=http.createServer((req,res)=>{
    const file=path.resolve(root,decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'')||'index.html');
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end('missing');}
    res.setHeader('content-type',mime[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));
  }).listen(0,'127.0.0.1');
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const base=`http://127.0.0.1:${server.address().port}/`,browser=await chromium.launch({executablePath:'/usr/bin/chromium'});
  try {
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));
    const open=async(hash='learn')=>{await page.goto(base+'fund-statistics.html#'+hash);await page.waitForSelector('#fs-content:not([hidden])');};
    const nav=async(hash)=>{await page.locator(`.fs-nav a[href="#${hash}"]`).click();await page.waitForFunction(h=>document.querySelector('.fs-nav [aria-current]').hash==='#'+h,hash);};
    await page.goto(base+'course.html?course=fund-quant-methods');
    await page.locator('a[href="fund-statistics.html"]').first().waitFor();
    await open();assert.equal(await page.locator('.fs-grid .fs-card').count(),6);
    assert.match(await page.locator('.fs-card').nth(4).innerText(),/36 slides reviewed/);
    assert.doesNotMatch(await page.locator('#fs-view').innerText(),/Topic 5 slides pending/);
    // Every topic guide and quiz is wired to its own 15 questions, and progress survives reload.
    for(const topic of [...new Set(bank.map(q=>q.topic))]) {
      await page.goto(base+'lecture.html?topic='+topic+'#practice');
      await page.waitForSelector('#lecture-content:not([hidden])');
      assert.equal(await page.locator('#question-map button').count(),15);
      assert.equal(await page.locator('#lecture-guide .fs-extension').count(),3);
      assert.equal(await page.locator('#lecture-guide .fs-worked').count(),2);
      const q=bank.find(q=>q.topic===topic);
      await page.locator(`input[name="answer"][value="${q.answer.charCodeAt(0)-65}"]`).check();await page.locator('#check-answer').click();
      assert.match(await page.locator('#answer-feedback').innerText(),/That’s right/);
      await page.reload();await page.waitForSelector('#answer-feedback');
      assert.equal(await page.locator('input[name="answer"]:checked').inputValue(),String(q.answer.charCodeAt(0)-65));
      if(topic==='fund-statistics.hypothesis-tests') {
        assert.equal(await page.locator('#lecture-guide section').count(),13);
        assert.match(await page.locator('#lecture-guide').textContent(),/All 36 Topic 5 slides/);
        assert.match(await page.locator('#lecture-guide').textContent(),/0.05166/);
        await page.locator('.lecture-toolbar [data-view="explore"]').click();
        assert.equal(await page.locator('[data-activity="fund-evidence"] svg').count(),2);
      }
    }
    await open();assert.match(await page.locator('.fs-stats').innerText(),/6 \/ 90/);
    await nav('cards');await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
    await page.getByRole('button',{name:/Good/}).click();
    const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('euhem-progress-v1')));
    assert.equal(Object.keys(progress.cards).filter(k=>k.startsWith('fund-statistics.')).length,1);
    // New cases check all 36 answers, preserve old quiz/card state and save written drafts.
    await nav('cases');assert.equal(await page.locator('#fs-case-solution').isVisible(),false);
    await page.getByRole('button',{name:'Check answer 1',exact:true}).click();
    assert.match(await page.locator('#fs-case-feedback-0').innerText(),/Enter a numerical/);
    await page.locator('#fs-case-answer-0').fill('0');await page.locator('[data-check="0"]').click();
    assert.match(await page.locator('#fs-case-feedback-0').innerText(),/Revisit/);
    await page.locator('[data-hint="0"]').click();assert.equal(await page.locator('#fs-case-hint-0').isVisible(),true);
    await page.locator('[data-hint="0"]').click();assert.equal(await page.locator('#fs-case-hint-0').isVisible(),false);
    for(const c of extension.cases){
      await page.locator('#fs-case-choice').selectOption(c.id);
      for(let i=0;i<3;i++){
        await page.locator('#fs-case-answer-'+i).fill(String(c.fields[i].answer));await page.locator(`[data-check="${i}"]`).click();
        assert.match(await page.locator('#fs-case-feedback-'+i).innerText(),/Correct within/);
      }
      await page.locator('#fs-case-reflection').fill('Interpretation for '+c.id+' <script>bad()</script>');
      await page.locator('#fs-case-reveal').click();assert.equal(await page.locator('#fs-case-solution').isVisible(),true);
      assert.equal(await page.locator('.fs-solution-steps li').count(),4);await page.locator('[data-case-rubric="0"]').check();
    }
    assert.match(await page.locator('#fs-case-progress').innerText(),/36 \/ 36/);
    const backup=await page.evaluate(()=>JSON.parse(exportProgressText()));
    assert.equal(Object.keys(backup.progress.statistics['fund-statistics.cases'].cases).length,12);
    assert.deepEqual(backup.progress.lectures,progress.lectures);assert.deepEqual(backup.progress.cards,progress.cards);
    await page.reload();await page.waitForSelector('#fs-case-choice');
    assert.equal(await page.locator('#fs-case-choice').inputValue(),'uncertain-difference');
    assert.match(await page.locator('#fs-case-reflection').inputValue(),/<script>/);
    assert.equal(await page.locator('#fs-case-solution').isVisible(),true);
    await page.locator('#fs-case-topic').selectOption('1');assert.equal(await page.locator('#fs-case-choice option').count(),2);
    assert.equal(await page.locator('#fs-case-answer-0').inputValue(),'5');
    await page.locator('#fs-case-next').click();assert.equal(await page.locator('#fs-case-choice').inputValue(),'extreme-stay');
    await nav('methods');assert.match(await page.locator('#fs-method-output').innerText(),/Check the design first/);
    await page.locator('#fs-method-independent').check();assert.match(await page.locator('#fs-method-output').innerText(),/unknown-σ t/);
    await page.locator('#fs-method-n').fill('16');assert.match(await page.locator('#fs-method-output').innerText(),/small-sample/);
    await page.locator('#fs-method-normal').check();assert.match(await page.locator('#fs-method-output').innerText(),/df=15/);
    await page.locator('#fs-method-known').check();assert.match(await page.locator('#fs-method-output').innerText(),/known-σ z/);
    await page.locator('#fs-method-target').selectOption('proportion');await page.locator('#fs-method-n').fill('100');await page.locator('#fs-method-k').fill('1');
    assert.match(await page.locator('#fs-method-output').innerText(),/5 observed/);
    await page.locator('#fs-method-goal').selectOption('test');assert.match(await page.locator('#fs-method-output').innerText(),/null-based z/);
    await page.locator('#fs-method-null').fill('0.99');assert.match(await page.locator('#fs-method-output').innerText(),/5 expected/);
    await page.locator('#fs-method-target').selectOption('paired');assert.match(await page.locator('#fs-method-output').innerText(),/illustrative in Topic 6/);
    await nav('explore');assert.equal(await page.locator('[data-activity="fund-descriptive"]').count(),1);
    await page.locator('#fs-values').fill('1, 2, 3, 4');assert.match(await page.locator('.fund-result').innerText(),/1.5 \/ 3.5/);
    await page.locator('#fs-quartiles').selectOption('excel');assert.match(await page.locator('.fund-result').innerText(),/1.75 \/ 3.25/);
    await page.locator('#fs-values').fill('1, oops');assert.match(await page.locator('.fund-result').innerText(),/Use numeric/);
    for(const id of ['normal-distribution','fund-table','fund-sampling','fund-confidence','hypothesis-test','fund-evidence','fund-proportion-test','fund-two-means']) {
      await page.locator('#fs-lab-choice').selectOption(id);assert.equal(await page.locator('#fs-lab [data-activity]').getAttribute('data-activity'),id);
      assert.ok((await page.locator('#fs-lab').innerText()).length>150);
    }
    await page.locator('#fs-two-n1').fill('20');assert.match(await page.locator('.fund-result').innerText(),/from 30/);
    await page.locator('#fs-lab-choice').selectOption('fund-sampling');
    await page.locator('#fs-replace').selectOption('no');assert.match(await page.locator('.fund-result').innerText(),/3.66/);
    await page.locator('#fs-lab-choice').selectOption('fund-confidence');
    await page.locator('#fs-ci-n').fill('16');assert.match(await page.locator('.fund-result').innerText(),/confirm approximately normal/);
    await page.locator('#fs-ci-normal').check();assert.match(await page.locator('.fund-result').innerText(),/Unknown-σ t interval/);
    await page.locator('#fs-ci-mode').selectOption('proportion');await page.locator('#fs-ci-n').fill('200');await page.locator('#fs-ci-k').fill('120');
    assert.match(await page.locator('.fund-result').innerText(),/0.532, 0.668/);
    await page.locator('#fs-lab-choice').selectOption('fund-evidence');
    assert.equal(await page.locator('.fund-result svg').count(),2);
    await page.locator('#fs-evidence-z').fill('2.5');
    assert.match(await page.locator('.fund-result').innerText(),/0.012419/);
    assert.match(await page.locator('.fund-result').innerText(),/Reject H₀/);
    await page.locator('#fs-evidence-z').fill('-2.5');
    assert.match(await page.locator('.fund-result').innerText(),/0.012419/);
    await page.locator('#fs-evidence-alpha').selectOption('.01');
    assert.match(await page.locator('.fund-result').innerText(),/Do not reject H₀/);
    await page.locator('#fs-evidence-z').fill('5');
    assert.match(await page.locator('.fund-result').innerText(),/between −4 and 4/);
    await page.locator('#fs-evidence-z').fill('2.5');
    await page.locator('#fs-lab').screenshot({path:'/workspace/work/statistics/batch-2/evidence-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('#fs-lab').screenshot({path:'/workspace/work/statistics/batch-2/evidence-mobile.png'});
    await page.setViewportSize({width:1440,height:1000});
    await nav('sources');assert.equal(await page.locator('tbody').nth(1).locator('tr').count(),8);assert.match(await page.locator('#fs-view').innerText(),/before−after/);
    assert.match(await page.locator('.fs-stats').innerText(),/37 \/ 21/);
    assert.match(await page.locator('.fs-stats').innerText(),/6 \/ 274/);
    await nav('reference');assert.match(await page.locator('#fs-view').innerText(),/T.DIST.2T/);
    await nav('mock');await page.getByRole('button',{name:'Start 90-minute mock'}).click();
    assert.equal(await page.locator('.fs-feedback').count(),0);assert.match(await page.locator('#fs-timer').innerText(),/^(89|90):/);
    const ids=['012','026','040','053','074','088'];
    for(let i=0;i<6;i++){
      const q=bank.find(q=>q.id==='fund-statistics.q.'+ids[i]);await page.locator(`input[name="fs-answer-${i}"][value="${q.answer.charCodeAt(0)-65}"]`).check();
    }
    const answers=[[75,70.90435,79.09565,2.88675],[.6,.03535534,2.82843,.00467773]];
    for(let i=0;i<2;i++)for(let j=0;j<4;j++)await page.locator(`#fs-num-${i}-${j}`).fill(String(answers[i][j]));
    await page.locator('#fs-text-0').fill('Group 1 has a lower estimated population mean.');
    await page.reload();await page.waitForSelector('#fs-content:not([hidden])');
    assert.equal(await page.locator('#fs-text-0').inputValue(),'Group 1 has a lower estimated population mean.');
    assert.equal(await page.locator('.fs-feedback').count(),0);
    await page.locator('#fs-finish-mock').click();assert.match(await page.locator('#fs-score').innerText(),/MCQs: 6\/6 · Calculations: 8\/8/);
    for(const box of await page.locator('[data-rubric]').all())await box.check();
    assert.match(await page.locator('#fs-score').innerText(),/30.0\/30/);
    await page.locator('#fs-new-mock').click();
    // A deadline is evaluated from timestamps; backgrounding/refreshing cannot pause it.
    await page.evaluate(()=>{const m=JSON.parse(sessionStorage.getItem('euhem-fund-mock-v1'));m.started=Date.now()-5401000;m.deadline=m.started+5400000;sessionStorage.setItem('euhem-fund-mock-v1',JSON.stringify(m));});
    await page.reload();await page.waitForSelector('#fs-score');assert.match(await page.locator('#fs-score').innerText(),/time ended/i);
    // Responsive light and dark views have no page-width overflow.
    for(const width of [390,768,1440]) {
      await page.setViewportSize({width,height:900});
      for(const hash of ['learn','cases','methods','cards','explore','mock','reference','sources']) {
        await open(hash);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}px overflow in ${hash}`);
      }
    }
    await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await open('cases');await page.locator('#fs-case-workspace').screenshot({path:'/workspace/work/statistics/expansion/cases-dark-desktop.png'});
    await page.setViewportSize({width:390,height:844});await page.locator('#fs-case-workspace').screenshot({path:'/workspace/work/statistics/expansion/cases-dark-mobile.png'});
    await page.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));await page.locator('#fs-case-workspace').screenshot({path:'/workspace/work/statistics/expansion/cases-light-mobile.png'});
    await open();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/workspace/work/statistics/workspace-desktop.png'});
    await page.setViewportSize({width:390,height:844});await open();await page.evaluate(()=>window.scrollTo(0,0));
    assert.equal(await page.locator('body.drawer-open').count(),0);
    await page.screenshot({path:'/workspace/work/statistics/workspace-mobile.png'});
    // After a first online visit the new shell, data and registered activities work offline.
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForSelector('#fs-content:not([hidden])');
    await ctx.setOffline(true);await page.reload();await page.waitForSelector('#fs-content:not([hidden])');await nav('explore');
    assert.equal(await page.locator('#fs-lab [data-activity]').count(),1);await nav('cases');assert.equal(await page.locator('#fs-case-choice').count(),1);await nav('methods');assert.equal(await page.locator('#fs-method-target').count(),1);await ctx.setOffline(false);
    assert.deepEqual(errors,[]);await ctx.close();
    const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('blocked');};});
    const p=await blocked.newPage();await p.goto(base+'fund-statistics.html#mock');await p.waitForSelector('#fs-content:not([hidden])');
    assert.equal(await p.locator('#fs-storage-warning').isVisible(),true);await p.locator('#fs-start-mock').click();assert.match(await p.locator('#fs-view').innerText(),/Session storage is unavailable/);
    await p.locator('.fs-nav a[href="#cases"]').click();await p.locator('#fs-case-answer-0').fill('5');await p.locator('[data-check="0"]').click();assert.match(await p.locator('#fs-case-feedback-0').innerText(),/Correct within/);
    await p.locator('#fs-case-choice').selectOption('extreme-stay');await p.locator('#fs-case-choice').selectOption('stay-summary');assert.equal(await p.locator('#fs-case-answer-0').inputValue(),'5');
    await blocked.close();console.log('Fundamentals browser passed: expanded six guides, 36 checked case answers/saved reflections/backups, method/design guards, shared quizzes/cards, nine labs, timed mock, mobile/dark/offline and blocked storage.');
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
