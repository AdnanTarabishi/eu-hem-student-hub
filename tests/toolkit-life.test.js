'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../toolkit-life-core.js');

const completeBudget=(extra={})=>({...C.emptyScenario(),months:6,monthlyIncome:1200,rent:500,food:200,transport:50,otherMonthly:100,oneOff:300,deposit:1000,...extra});
const budgetState=scenarios=>({version:1,scenarios});
const movingState=extra=>({...C.cleanMovingState({}),...extra});

test('budget defaults contain no invented amounts or exchange-rate assumptions',()=>{
  const state=C.cleanBudgetState({});
  assert.equal(state.scenarios.length,1);
  const s=state.scenarios[0];
  for(const key of ['months','monthlyIncome','rent','food','transport','otherMonthly','oneOff','deposit','nokPerEur'])assert.equal(s[key],null);
  assert.equal(s.rateDate,'');
  assert.deepEqual(C.cleanBudgetState(state,true),state);
  assert.throws(()=>C.budgetSummary(s),/Complete/);
});
test('supported destinations match all four existing city-guide routes',()=>{
  assert.deepEqual(C.CITIES.map(c=>c.id),['bologna','oslo','innsbruck','rotterdam']);
  assert.deepEqual(C.CITIES.map(c=>c.title),['Bologna','Oslo','Innsbruck','Rotterdam']);
  assert.equal(C.emptyScenario('b-oslo','oslo').currency,'NOK');
});
test('budget separates period spending, deposit cash, upfront cash and balance',()=>{
  const r=C.budgetSummary(completeBudget());
  assert.equal(r.monthlyExpenses,850);
  assert.equal(r.monthlyBalance,350);
  assert.equal(r.periodIncome,7200);
  assert.equal(r.periodSpending,5400);
  assert.equal(r.refundableDeposit,1000);
  assert.equal(r.periodCashRequired,6400);
  assert.equal(r.upfrontCash,2150);
  assert.equal(r.periodBalance,1800);
  assert.equal(r.periodBalanceAfterDeposit,800);
  assert.equal(r.eur.periodSpending,5400);
});
test('changing only the deposit affects cash required but never spending or pre-deposit balance',()=>{
  const a=C.budgetSummary(completeBudget({deposit:0})),b=C.budgetSummary(completeBudget({deposit:2000}));
  assert.equal(b.periodSpending,a.periodSpending);
  assert.equal(b.periodBalance,a.periodBalance);
  assert.equal(b.periodCashRequired-a.periodCashRequired,2000);
  assert.equal(b.upfrontCash-a.upfrontCash,2000);
  assert.equal(b.periodBalanceAfterDeposit-a.periodBalanceAfterDeposit,-2000);
});
test('NOK conversion divides by dated NOK per EUR and preserves original-currency values',()=>{
  const s=completeBudget({city:'oslo',currency:'NOK',monthlyIncome:22000,rent:10000,food:4000,transport:1000,otherMonthly:1000,oneOff:2200,deposit:22000,nokPerEur:11,rateDate:'2026-10-08'});
  const r=C.budgetSummary(s);
  assert.equal(r.monthlyBalance,6000);
  assert.equal(r.periodSpending,98200);
  assert.equal(r.periodCashRequired,120200);
  assert.equal(r.upfrontCash,40200);
  assert.equal(r.eur.monthlyBalance,545.45);
  assert.equal(r.eur.periodSpending,8927.27);
  assert.equal(r.eur.refundableDeposit,2000);
  assert.equal(r.eur.periodCashRequired,10927.27);
  assert.equal(r.eur.upfrontCash,3654.55);
  assert.equal(r.eur.periodBalance,3072.73);
});
test('NOK scenarios require both a positive rate and valid assumption date for comparison',()=>{
  assert.throws(()=>C.budgetSummary(completeBudget({currency:'NOK'})),/NOK per EUR/);
  assert.throws(()=>C.budgetSummary(completeBudget({currency:'NOK',nokPerEur:11})),/date/);
  assert.throws(()=>C.cleanBudgetState(budgetState([completeBudget({nokPerEur:0})]),true),/positive/);
  assert.throws(()=>C.cleanBudgetState(budgetState([completeBudget({rateDate:'2026-02-30'})]),true),/calendar date/);
});
test('money arithmetic combines integer cents before converting the final results',()=>{
  const r=C.budgetSummary(completeBudget({months:3,monthlyIncome:.5,rent:.1,food:.2,transport:0,otherMonthly:0,oneOff:.05,deposit:.15}));
  assert.equal(r.monthlyExpenses,.3);
  assert.equal(r.periodSpending,.95);
  assert.equal(r.periodCashRequired,1.1);
  assert.equal(r.upfrontCash,.5);
  assert.equal(r.periodBalance,.55);
});
test('FX half-cent ties round symmetrically away from zero and tiny balances do not become negative zero',()=>{
  const zero={months:1,currency:'NOK',monthlyIncome:0,rent:0,food:0,transport:0,otherMonthly:0,oneOff:0,deposit:0,nokPerEur:2,rateDate:'2026-10-08'};
  const positive=C.budgetSummary(completeBudget({...zero,monthlyIncome:.01}));
  const negative=C.budgetSummary(completeBudget({...zero,rent:.01}));
  assert.equal(positive.eur.monthlyBalance,.01);
  assert.equal(negative.eur.monthlyBalance,-.01);
  assert.equal(positive.eur.periodBalance,-negative.eur.periodBalance);
  const tiny=C.budgetSummary(completeBudget({...zero,rent:.01,nokPerEur:100}));
  assert.equal(tiny.eur.monthlyBalance,0);
  assert.equal(Object.is(tiny.eur.monthlyBalance,-0),false);
});
test('FX conversion rejects totals beyond safe cent precision rather than showing imprecise money',()=>{
  const extreme=completeBudget({months:24,currency:'NOK',rent:100000000,nokPerEur:.00000001,rateDate:'2026-10-08'});
  assert.doesNotThrow(()=>C.cleanBudgetState(budgetState([extreme]),true));
  assert.throws(()=>C.budgetSummary(extreme),/safe cent precision/);
  const small=completeBudget({months:1,currency:'NOK',monthlyIncome:0,rent:.01,food:0,transport:0,otherMonthly:0,oneOff:0,deposit:0,nokPerEur:.00000001,rateDate:'2026-10-08'});
  assert.equal(C.budgetSummary(small).eur.periodSpending,1000000);
});
test('explicit zero amounts are valid and deficits remain negative',()=>{
  const r=C.budgetSummary(completeBudget({months:24,monthlyIncome:0,rent:100,food:0,transport:0,otherMonthly:0,oneOff:0,deposit:0}));
  assert.equal(r.monthlyBalance,-100);
  assert.equal(r.periodBalance,-2400);
  assert.equal(r.upfrontCash,100);
});
test('incomplete budget drafts can be saved but cannot produce misleading calculations',()=>{
  const s=completeBudget({food:null});
  assert.equal(C.cleanBudgetState(budgetState([s]),true).scenarios[0].food,null);
  assert.throws(()=>C.budgetSummary(s),/Enter 0/);
});
test('strict budget validation rejects malformed, unbounded and unknown import values',()=>{
  const invalid=[
    {...budgetState([completeBudget()]),secret:'not allowed'},
    budgetState([{...completeBudget(),unexpected:true}]),
    budgetState([completeBudget({months:0})]),budgetState([completeBudget({months:25})]),budgetState([completeBudget({months:1.5})]),
    budgetState([completeBudget({rent:-1})]),budgetState([completeBudget({rent:100000001})]),budgetState([completeBudget({rent:1.001})]),
    budgetState([completeBudget({rent:'500'})]),budgetState([completeBudget({rent:NaN})]),budgetState([completeBudget({rent:Infinity})]),
    budgetState([completeBudget({city:'venice'})]),budgetState([completeBudget({currency:'USD'})]),
    budgetState([completeBudget({name:'x'.repeat(81)})]),budgetState([completeBudget({name:'line\nbreak'})]),
    budgetState([completeBudget({rateDate:null})]),budgetState([completeBudget({id:'b-1'}),completeBudget({id:'b-1'})]),
    budgetState(Array.from({length:5},(_,i)=>completeBudget({id:'b-'+i})))
  ];
  for(const raw of invalid)assert.throws(()=>C.cleanBudgetState(raw,true));
});
test('tolerant budget recovery retains usable values without coercing invalid amounts to zero',()=>{
  const s=completeBudget({city:'unknown',rent:-10,months:25,name:' test\nname ',rateDate:'bad'});
  const r=C.cleanBudgetState(budgetState([s])).scenarios[0];
  assert.equal(r.city,'bologna');assert.equal(r.rent,null);assert.equal(r.months,null);
  assert.equal(r.name,'test name');assert.equal(r.rateDate,'');assert.equal(r.food,200);
});
test('budget and moving-state cleaners return fresh plain JSON without mutating their inputs',()=>{
  const raw=budgetState([completeBudget()]),before=JSON.stringify(raw),clean=C.cleanBudgetState(raw,true);
  clean.scenarios[0].rent=1;
  assert.equal(JSON.stringify(raw),before);
  const move=movingState({customTasks:[{id:'m-c-1',title:'Collect keys',phase:'arrival'}],completed:['m-c-1'],dates:[{id:'m-c-1',date:'2026-10-09'}]});
  const copy=C.cleanMovingState(move,true);copy.customTasks[0].title='Changed';copy.dates[0].date='2026-10-10';copy.completed.length=0;
  assert.equal(move.customTasks[0].title,'Collect keys');assert.equal(move.dates[0].date,'2026-10-09');assert.equal(move.completed.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(C.cleanMovingState(move,true))),move);
});
test('calendar validation handles leap days, invalid dates and bounded years independently of timezone',()=>{
  assert.equal(C.validDate('2028-02-29'),true);
  for(const value of ['2027-02-29','2026-04-31','2026-00-01','2026-13-01','2026-1-01','1899-12-31','2201-01-01',null])assert.equal(C.validDate(value),false);
  assert.equal(C.validDate('1900-01-01'),true);assert.equal(C.validDate('2200-12-31'),true);
});
test('moving defaults contain nine original tasks across three preparation phases',()=>{
  const state=C.cleanMovingState({}),tasks=C.movingTasks(state);
  assert.equal(tasks.length,9);
  assert.deepEqual(C.PHASES.map(phase=>tasks.filter(task=>task.phase===phase).length),[3,3,3]);
  assert.deepEqual(C.movingProgress(state),{completed:0,total:9,percent:0});
  assert.deepEqual(C.cleanMovingState(state,true),state);
});
test('changing any of the four destinations preserves completed tasks and custom due dates',()=>{
  const original=movingState({completed:['m-housing','m-c-key'],dates:[{id:'m-c-key',date:'2026-11-01'}],customTasks:[{id:'m-c-key',title:'Arrange key collection',phase:'arrival'}]});
  for(const city of C.CITIES) {
    const next=C.cleanMovingState({...original,city:city.id},true);
    assert.deepEqual(next.completed,original.completed);assert.deepEqual(next.dates,original.dates);assert.deepEqual(next.customTasks,original.customTasks);
    assert.deepEqual(C.movingProgress(next),{completed:2,total:10,percent:20});
  }
});
test('moving view joins completion and date information to known task IDs',()=>{
  const state=movingState({completed:['m-housing','m-c-key'],dates:[{id:'m-housing',date:'2026-10-08'}],customTasks:[{id:'m-c-key',title:'Collect keys',phase:'arrival'}]});
  const tasks=C.movingTasks(state);
  assert.deepEqual(tasks.find(task=>task.id==='m-housing'),{id:'m-housing',phase:'before',title:'Confirm accommodation and arrival access',custom:false,done:true,due:'2026-10-08'});
  assert.deepEqual(tasks.find(task=>task.id==='m-c-key'),{id:'m-c-key',phase:'arrival',title:'Collect keys',custom:true,done:true,due:''});
});
test('strict moving imports reject unknown fields, phases, task IDs and inconsistent dates',()=>{
  const invalid=[
    {...movingState(),unexpected:true},movingState({version:2}),movingState({city:'innbruck'}),movingState({completed:['not-a-task']}),
    movingState({completed:['m-housing','m-housing']}),movingState({dates:[{id:'m-housing',date:'2026-02-29'}]}),
    movingState({dates:[{id:'m-housing',date:'2026-10-08'},{id:'m-housing',date:'2026-10-09'}]}),
    movingState({dates:[{id:'m-c-missing',date:'2026-10-08'}]}),
    movingState({customTasks:[{id:'m-c-1',title:'Task',phase:'future'}]}),
    movingState({customTasks:[{id:'m-housing',title:'Task',phase:'before'}]}),
    movingState({customTasks:[{id:'m-c-1',title:'',phase:'before'}]}),
    movingState({customTasks:[{id:'m-c-1',title:'x'.repeat(121),phase:'before'}]}),
    movingState({customTasks:[{id:'m-c-1',title:'Task\nwith control',phase:'before'}]}),
    movingState({customTasks:[{id:'m-c-1',title:'Task',phase:'before',privateData:'extra'}]}),
    movingState({customTasks:[{id:'m-c-1',title:'A',phase:'before'},{id:'m-c-1',title:'B',phase:'arrival'}]}),
    movingState({customTasks:Array.from({length:22},(_,i)=>({id:'m-c-'+i,title:'Task '+i,phase:'before'}))})
  ];
  for(const raw of invalid)assert.throws(()=>C.cleanMovingState(raw,true));
});
test('moving recovery removes orphan references and invalid tasks without losing legitimate progress',()=>{
  const raw=movingState({completed:['m-housing','missing','m-housing','m-c-good'],dates:[{id:'m-housing',date:'bad'},{id:'m-c-good',date:'2026-10-09'}],customTasks:[{id:'bad',title:'Bad task',phase:'before'},{id:'m-c-good',title:' Collect\nkeys ',phase:'arrival'}]});
  const clean=C.cleanMovingState(raw);
  assert.deepEqual(clean.completed,['m-housing','m-c-good']);assert.deepEqual(clean.dates,[{id:'m-c-good',date:'2026-10-09'}]);
  assert.deepEqual(clean.customTasks,[{id:'m-c-good',title:'Collect keys',phase:'arrival'}]);
});
test('at the custom-task limit a fully completed checklist reports 100 percent',()=>{
  const customTasks=Array.from({length:21},(_,i)=>({id:'m-c-'+i,title:'Task '+i,phase:C.PHASES[i%3]}));
  const state=movingState({customTasks,completed:[...C.DEFAULT_TASKS.map(task=>task.id),...customTasks.map(task=>task.id)]});
  const clean=C.cleanMovingState(state,true);
  assert.deepEqual(C.movingProgress(clean),{completed:30,total:30,percent:100});
});
test('browser registry exposes both existing catalogue IDs and the shared-controller contract',()=>{
  const context={window:{StudentToolkitLifeCore:C}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../toolkit-life.js'),'utf8'),context);
  const tools=context.window.StudentToolkitLifeTools;
  assert.deepEqual(Array.from(tools,tool=>tool.id),['four-city-budget','moving-checklist']);
  for(const tool of tools) {
    assert.equal(typeof tool.mount,'function');assert.equal(typeof tool.cleanState,'function');
    assert.equal(typeof tool.title,'string');assert.equal(typeof tool.summary,'string');assert.equal(typeof tool.icon,'string');
    const state=tool.cleanState({});assert.deepEqual(tool.cleanState(state,true),state);
  }
});

// Opt in when Chromium is permitted: TOOLKIT_LIFE_BROWSER=1 node tests/toolkit-life.test.js
test('browser regressions: inactive FX, discarded invalid scenarios and pending moving-task drafts',{
  skip:process.env.TOOLKIT_LIFE_BROWSER!=='1'
},async()=>{
  const {chromium}=require('playwright');
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.setContent('<!doctype html><html lang="en"><body><main id="tool"></main></body></html>');
    await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../toolkit-life-core.js'),'utf8')});
    await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../toolkit-life.js'),'utf8')});
    await page.evaluate(()=>{window.mounted=StudentToolkitLifeTools[0].mount(document.getElementById('tool'),{draft:{},notify:()=>{},today:()=> '2026-10-08'});});
    for(const [key,value] of Object.entries({months:'6',monthlyIncome:'1200',rent:'500',food:'200',transport:'50',otherMonthly:'100',oneOff:'300',deposit:'1000'}))await page.locator('[data-budget-key="'+key+'"]').fill(value);
    await page.locator('[data-budget-key="currency"]').selectOption('NOK');
    await page.locator('[data-budget-key="nokPerEur"]').fill('0');
    await page.locator('[data-budget-key="rateDate"]').fill('1800-01-01');
    await page.locator('[data-budget-key="currency"]').selectOption('EUR');
    const inactive=await page.evaluate(()=>mounted.getState().scenarios[0]);
    assert.equal(inactive.nokPerEur,null);assert.equal(inactive.rateDate,'');
    await page.getByRole('button',{name:'Compare my estimates'}).click();
    assert.match(await page.locator('#tw-budget-output').innerText(),/5,400\.00/);
    await page.locator('[data-budget-key="currency"]').selectOption('NOK');
    await page.locator('[data-budget-key="nokPerEur"]').fill('11');
    await page.locator('[data-budget-key="rateDate"]').fill('2026-10-08');
    await page.locator('[data-budget-key="currency"]').selectOption('EUR');
    const preserved=await page.evaluate(()=>mounted.getState().scenarios[0]);
    assert.equal(preserved.nokPerEur,11);assert.equal(preserved.rateDate,'2026-10-08');
    await page.locator('#tw-budget-add').click();
    await page.locator('[data-budget-key="rent"]').nth(1).fill('-1');
    await page.locator('[data-budget-remove]').nth(1).click();
    assert.equal(await page.locator('[data-budget-scenario]').count(),1);
    assert.equal(await page.evaluate(()=>mounted.getState().scenarios[0].rent),500);
    await page.evaluate(()=>{window.mounted=StudentToolkitLifeTools[1].mount(document.getElementById('tool'),{draft:{},notify:()=>{},today:()=> '2026-10-08'});});
    assert.equal(await page.evaluate(()=>mounted.getState().customTasks.length),0);
    await page.locator('[data-move-done="m-housing"]').check();
    for(const [selector,value] of [['#tw-move-custom-title','Collect keys'],['#tw-move-custom-date','2026-10-09'],['#tw-move-custom-phase','arrival']]) {
      if(selector.endsWith('phase'))await page.locator(selector).selectOption(value);else await page.locator(selector).fill(value);
      assert.match(await page.evaluate(()=>{try{mounted.getState();return '';}catch(error){return error.message;}}),/Add or clear the new task/);
      await page.locator('#tw-move-custom-clear').click();
      assert.deepEqual(await page.evaluate(()=>mounted.getState().completed),['m-housing']);
    }
    await page.locator('#tw-move-custom-title').fill('Collect keys');
    await page.locator('#tw-move-custom-phase').selectOption('arrival');
    await page.locator('#tw-move-custom-date').fill('2026-10-09');
    await page.getByRole('button',{name:/Add task/}).click();
    const added=await page.evaluate(()=>mounted.getState());
    assert.equal(added.customTasks[0].title,'Collect keys');assert.equal(added.customTasks[0].phase,'arrival');
    assert.equal(added.dates[0].date,'2026-10-09');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
