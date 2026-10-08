/* Student Toolkit life tools: bounded local drafts and transparent arithmetic. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudentToolkitLifeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CITIES = Object.freeze([
    Object.freeze({id:'bologna',title:'Bologna'}),
    Object.freeze({id:'oslo',title:'Oslo'}),
    Object.freeze({id:'innsbruck',title:'Innsbruck'}),
    Object.freeze({id:'rotterdam',title:'Rotterdam'})
  ]);
  const cityIds = new Set(CITIES.map(city => city.id));
  const PHASES = Object.freeze(['before','arrival','settled']);
  const LIMITS = Object.freeze({scenarios:4,months:24,money:100000000,rate:1000000,name:80,customTasks:21,title:120});
  const DEFAULT_TASKS = Object.freeze([
    ['m-housing','before','Confirm accommodation and arrival access'],
    ['m-budget','before','Plan transport, moving costs and upfront cash'],
    ['m-university','before','Confirm semester dates and arrangements with your university'],
    ['m-handover','arrival','Check your accommodation handover arrangements'],
    ['m-route','arrival','Check the route to campus and local transport options'],
    ['m-contacts','arrival','Find university and city support contacts'],
    ['m-campus','settled','Locate study spaces and campus services'],
    ['m-review-budget','settled','Review your monthly budget after settling in'],
    ['m-routine','settled','Arrange a realistic study and everyday routine']
  ].map(([id,phase,title]) => Object.freeze({id,phase,title,custom:false})));
  const budgetKeys = ['id','name','city','currency','months','monthlyIncome','rent','food','transport','otherMonthly','oneOff','deposit','nokPerEur','rateDate'];
  const moneyKeys = ['monthlyIncome','rent','food','transport','otherMonthly','oneOff','deposit'];
  const baseTaskIds = new Set(DEFAULT_TASKS.map(task => task.id));
  const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  function exactKeys(value, keys, label) {
    if (!object(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value,key))) {
      throw new Error(label+' contains missing or unsupported fields.');
    }
  }
  function text(value, max, strict, label, empty=true) {
    if (typeof value !== 'string') {
      if (strict) throw new Error('Use plain text for '+label+'.');
      return '';
    }
    const cleaned=value.replace(/[\u0000-\u001f\u007f]/g,' ').trim();
    if (strict && (cleaned!==value || value.length>max || (!empty&&!cleaned))) throw new Error('Invalid '+label+'.');
    return cleaned.slice(0,max);
  }
  function validDate(value) {
    if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year,month,day]=value.split('-').map(Number);
    if (year<1900 || year>2200) return false;
    const date=new Date(Date.UTC(year,month-1,day));
    return date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day;
  }
  function date(value, strict, label) {
    if (value==='') return '';
    if (validDate(value)) return value;
    if (strict) throw new Error('Use a valid calendar date for '+label+'.');
    return '';
  }
  function number(value, strict, label, max, digits=2, integer=false) {
    if (value===null || (!strict && (value===undefined || value===''))) return null;
    const factor=10**digits;
    const valid=typeof value==='number' && Number.isFinite(value) && value>=0 && value<=max &&
      (!integer || Number.isInteger(value)) && Math.abs(value*factor-Math.round(value*factor))<0.000001;
    if (valid) return value;
    if (strict) throw new Error('Invalid '+label+'. Enter a non-negative number within the stated limits.');
    return null;
  }
  function emptyScenario(id='b-1', city='bologna') {
    return {id,name:'',city,currency:city==='oslo'?'NOK':'EUR',months:null,monthlyIncome:null,rent:null,food:null,transport:null,otherMonthly:null,oneOff:null,deposit:null,nokPerEur:null,rateDate:''};
  }
  function cleanBudgetState(raw, strict=false) {
    if (strict) {
      exactKeys(raw,['version','scenarios'],'Budget draft');
      if (raw.version!==1 || !Array.isArray(raw.scenarios) || raw.scenarios.length>LIMITS.scenarios) throw new Error('Unsupported budget draft.');
    }
    if (!object(raw) || raw.version!==1 || !Array.isArray(raw.scenarios)) return {version:1,scenarios:[emptyScenario()]};
    const scenarios=[],seen=new Set();
    for (const candidate of raw.scenarios.slice(0,LIMITS.scenarios)) {
      if (strict) exactKeys(candidate,budgetKeys,'Budget scenario');
      if (!object(candidate)) { if (strict) throw new Error('Invalid budget scenario.'); else continue; }
      let id=candidate.id;
      if (typeof id!=='string' || !/^b-[a-z0-9-]{1,70}$/.test(id) || seen.has(id)) {
        if (strict) throw new Error('Invalid or repeated budget scenario identifier.');
        id='b-'+(scenarios.length+1);while(seen.has(id))id+='-new';
      }
      seen.add(id);
      if (strict && (!cityIds.has(candidate.city) || !['EUR','NOK'].includes(candidate.currency))) throw new Error('Choose a supported city and currency.');
      const scenario=emptyScenario(id,cityIds.has(candidate.city)?candidate.city:'bologna');
      scenario.name=text(candidate.name,LIMITS.name,strict,'scenario name');
      scenario.currency=['EUR','NOK'].includes(candidate.currency)?candidate.currency:scenario.currency;
      scenario.months=number(candidate.months,strict,'months',LIMITS.months,0,true);
      if (scenario.months===0) { if (strict) throw new Error('Use between 1 and 24 months.');scenario.months=null; }
      for (const key of moneyKeys) scenario[key]=number(candidate[key],strict,key,LIMITS.money);
      scenario.nokPerEur=number(candidate.nokPerEur,strict,'NOK per EUR rate',LIMITS.rate,8);
      if (scenario.nokPerEur===0) { if (strict) throw new Error('The NOK per EUR rate must be positive.');scenario.nokPerEur=null; }
      scenario.rateDate=date(strict?candidate.rateDate:(candidate.rateDate??''),strict,'exchange-rate assumption');
      scenarios.push(scenario);
    }
    return {version:1,scenarios};
  }
  const roundMoney = value => {
    const magnitude=Math.round((Math.abs(value)+Number.EPSILON)*100)/100;
    return magnitude===0?0:Math.sign(value)*magnitude;
  };
  function budgetSummary(scenario) {
    const s=cleanBudgetState({version:1,scenarios:[scenario]},true).scenarios[0];
    if (s.months===null || moneyKeys.some(key=>s[key]===null)) throw new Error('Complete the months and each amount. Enter 0 when an amount does not apply.');
    if (s.currency==='NOK' && (s.nokPerEur===null || !s.rateDate)) throw new Error('For NOK amounts, enter a positive NOK per EUR rate and the date of your assumption.');
    const cents=key=>Math.round(s[key]*100);
    const monthlyExpenses=cents('rent')+cents('food')+cents('transport')+cents('otherMonthly');
    const periodSpending=monthlyExpenses*s.months+cents('oneOff');
    const periodIncome=cents('monthlyIncome')*s.months;
    const values={monthlyIncome:cents('monthlyIncome'),monthlyExpenses,monthlyBalance:cents('monthlyIncome')-monthlyExpenses,
      periodIncome,periodSpending,refundableDeposit:cents('deposit'),periodCashRequired:periodSpending+cents('deposit'),
      upfrontCash:monthlyExpenses+cents('oneOff')+cents('deposit'),periodBalance:periodIncome-periodSpending,
      periodBalanceAfterDeposit:periodIncome-periodSpending-cents('deposit')};
    const native=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value/100]));
    const rate=s.currency==='NOK'?s.nokPerEur:1,eur={};
    for(const [key,value] of Object.entries(native)) {
      const converted=value/rate;
      if(!Number.isFinite(converted)||Math.abs(converted)>Number.MAX_SAFE_INTEGER/100)throw new Error('Converted amounts exceed safe cent precision. Review the amounts and your NOK per EUR assumption.');
      eur[key]=roundMoney(converted);
    }
    return {...native,months:s.months,currency:s.currency,eur};
  }
  function cleanMovingState(raw, strict=false) {
    if (strict) {
      exactKeys(raw,['version','city','completed','dates','customTasks'],'Moving checklist');
      if (raw.version!==1 || !cityIds.has(raw.city) || !Array.isArray(raw.completed) || !Array.isArray(raw.dates) || !Array.isArray(raw.customTasks) || raw.customTasks.length>LIMITS.customTasks) throw new Error('Unsupported moving checklist.');
    }
    if (!object(raw) || raw.version!==1) return {version:1,city:'bologna',completed:[],dates:[],customTasks:[]};
    const customTasks=[],seen=new Set(baseTaskIds);
    const input=Array.isArray(raw.customTasks)?raw.customTasks:[];
    for (const task of input.slice(0,LIMITS.customTasks)) {
      if (strict) exactKeys(task,['id','title','phase'],'Custom moving task');
      if (!object(task)) { if(strict)throw new Error('Invalid custom moving task.');else continue; }
      const title=text(task.title,LIMITS.title,strict,'moving task',false);
      const valid=typeof task.id==='string' && /^m-c-[a-z0-9-]{1,70}$/.test(task.id) && !seen.has(task.id) && PHASES.includes(task.phase) && title;
      if (!valid) { if(strict)throw new Error('Invalid or repeated custom moving task.');else continue; }
      seen.add(task.id);customTasks.push({id:task.id,title,phase:task.phase});
    }
    const allowed=new Set([...baseTaskIds,...customTasks.map(task=>task.id)]),completed=[];
    for (const id of (Array.isArray(raw.completed)?raw.completed:[]).slice(0,30)) {
      if (!allowed.has(id) || completed.includes(id)) { if(strict)throw new Error('A reviewed task is unknown or repeated.');else continue; }
      completed.push(id);
    }
    const dates=[],dated=new Set();
    for (const entry of (Array.isArray(raw.dates)?raw.dates:[]).slice(0,30)) {
      if(strict)exactKeys(entry,['id','date'],'Task date');
      if (!object(entry) || !allowed.has(entry.id) || dated.has(entry.id) || !validDate(entry.date)) { if(strict)throw new Error('A task date is invalid, unknown or repeated.');else continue; }
      dated.add(entry.id);dates.push({id:entry.id,date:entry.date});
    }
    if(strict && (raw.completed.length>30 || raw.dates.length>30))throw new Error('Too many moving task values.');
    return {version:1,city:cityIds.has(raw.city)?raw.city:'bologna',completed,dates,customTasks};
  }
  function movingTasks(raw) {
    const state=cleanMovingState(raw),done=new Set(state.completed),dates=new Map(state.dates.map(entry=>[entry.id,entry.date]));
    return [...DEFAULT_TASKS,...state.customTasks.map(task=>({...task,custom:true}))].map(task=>({...task,done:done.has(task.id),due:dates.get(task.id)||''}));
  }
  function movingProgress(raw) {
    const tasks=movingTasks(raw),completed=tasks.filter(task=>task.done).length;
    return {completed,total:tasks.length,percent:Math.round(completed/tasks.length*100)};
  }
  return Object.freeze({CITIES,PHASES,LIMITS,DEFAULT_TASKS,validDate,emptyScenario,cleanBudgetState,budgetSummary,cleanMovingState,movingTasks,movingProgress});
});
