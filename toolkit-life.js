/* Student Toolkit life-tool registry. Drafts stay with the shared controller. */
(function () {
  'use strict';
  const C=window.StudentToolkitLifeCore;
  if (!C) return;
  const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const cityName=id=>C.CITIES.find(city=>city.id===id)?.title||'Bologna';
  const cityOptions=selected=>C.CITIES.map(city=>`<option value="${city.id}"${city.id===selected?' selected':''}>${city.title}</option>`).join('');
  const uniqueId=prefix=>prefix+(window.crypto?.randomUUID?window.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  const money=value=>new Intl.NumberFormat('en',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  const notify=(ctx,message)=>{if(typeof ctx.notify==='function')ctx.notify(message);};
  function shellFor(container) {
    const shell=document.createElement('div');
    shell.className='tw-form';container.replaceChildren(shell);return shell;
  }
  function showError(shell,error) {
    const box=shell.querySelector('.tw-error');
    box.textContent=error.message||String(error);box.hidden=false;
  }
  function mountBudget(container,ctx) {
    const shell=shellFor(container);
    let state=C.cleanBudgetState(ctx.draft);
    const numeric=['months','monthlyIncome','rent','food','transport','otherMonthly','oneOff','deposit','nokPerEur'];
    function field(s,key,label,attrs='') {
      const id='tw-budget-'+s.id+'-'+key;
      return `<label class="tw-field" for="${id}"><span>${label}</span><input id="${id}" data-budget-key="${key}" type="number" inputmode="${key==='months'?'numeric':'decimal'}" value="${s[key]===null?'':s[key]}" ${attrs}></label>`;
    }
    function amount(s,key,label) {return field(s,key,label,'min="0" max="100000000" step="0.01" placeholder="Enter 0 if none"');}
    function scenarioCard(s,index) {
      return `<fieldset class="tw-card" data-budget-scenario="${s.id}"><legend id="tw-budget-${s.id}-legend">Scenario ${index+1} · ${cityName(s.city)}</legend><div class="tw-actions"><button type="button" class="tk-text-button" data-budget-remove="${s.id}">Remove scenario</button></div><div class="tw-fields">
        <label class="tw-field" for="tw-budget-${s.id}-name"><span>Scenario name (optional)</span><input id="tw-budget-${s.id}-name" data-budget-key="name" maxlength="80" value="${esc(s.name)}" placeholder="e.g. Shared apartment" autocomplete="off"></label>
        <label class="tw-field" for="tw-budget-${s.id}-city"><span>Programme city</span><select id="tw-budget-${s.id}-city" data-budget-key="city">${cityOptions(s.city)}</select></label>
        <label class="tw-field" for="tw-budget-${s.id}-currency"><span>Currency of every amount in this scenario</span><select id="tw-budget-${s.id}-currency" data-budget-key="currency"><option value="EUR"${s.currency==='EUR'?' selected':''}>EUR</option><option value="NOK"${s.currency==='NOK'?' selected':''}>NOK</option></select></label>
        ${field(s,'months','Months in this scenario · 1–24','min="1" max="24" step="1"')}
        ${amount(s,'monthlyIncome','Monthly income')}${amount(s,'rent','Monthly rent')}${amount(s,'food','Monthly food')}${amount(s,'transport','Monthly transport')}${amount(s,'otherMonthly','Other monthly spending')}${amount(s,'oneOff','One-off spending at the start')}${amount(s,'deposit','Refundable deposit · cash held, not spending')}
      </div><div class="tw-fields" data-budget-rate="${s.id}"${s.currency==='EUR'?' hidden':''}>
        ${field(s,'nokPerEur','Manual exchange rate · NOK per 1 EUR','min="0.00000001" max="1000000" step="0.00000001"')}
        <label class="tw-field" for="tw-budget-${s.id}-rateDate"><span>Date of your exchange-rate assumption</span><input id="tw-budget-${s.id}-rateDate" data-budget-key="rateDate" type="date" min="1900-01-01" max="2200-12-31" value="${s.rateDate}"></label>
      </div><p class="tw-note">All amounts are your estimates. No city prices or live exchange rates are supplied. Enter 0 for an amount that does not apply.</p></fieldset>`;
    }
    function render() {
      shell.innerHTML=`<h3 id="tw-budget-title">Plan the cost of your next chapter.</h3><p>Compare up to four scenarios using your own prices, income and time horizon. Each scenario can cover up to 24 months.</p><form id="tw-budget-form" novalidate>${state.scenarios.map(scenarioCard).join('')}<div class="tw-actions"><button type="button" id="tw-budget-add" class="tk-text-button"${state.scenarios.length>=4?' disabled':''}>Add a city scenario (${state.scenarios.length}/4)</button><button type="submit" class="tk-button"${state.scenarios.length?'':' disabled'}>Compare my estimates</button></div></form><p class="tw-error" role="alert" hidden></p><div id="tw-budget-output" class="tw-output" aria-live="polite"><p>Fill in a scenario and compare your estimates. Empty fields are not treated as zero.</p></div><details class="tw-note"><summary>How the numbers are calculated</summary><p>Monthly spending = rent + food + transport + other monthly spending. Period spending = monthly spending × months + one-off spending. Monthly balance = income − monthly spending.</p><p>Total cash needed = period spending + refundable deposit. Upfront cash = first month’s spending + one-off spending + deposit, before any income is received. One-off spending and deposits are assumed due at the start. The deposit is shown separately and is not counted as an expense; its actual return is not guaranteed.</p><p>Period balance = income × months − period spending, before money held in the deposit. NOK values are divided by your NOK-per-EUR assumption for the EUR comparison. Different durations are different scenarios, not a ranking of city affordability.</p></details>`;
    }
    function readState(omitId=null) {
      const next={version:1,scenarios:state.scenarios.filter(s=>s.id!==omitId).map(s=>({...s}))};
      for (const s of next.scenarios) {
        const card=shell.querySelector(`[data-budget-scenario="${s.id}"]`);
        s.currency=card.querySelector('[data-budget-key="currency"]').value;
        for (const input of card.querySelectorAll('[data-budget-key]')) {
          const key=input.dataset.budgetKey;
          if(s.currency==='EUR'&&key==='nokPerEur') {
            const rate=input.value===''?null:input.valueAsNumber;
            s.nokPerEur=input.checkValidity()&&Number.isFinite(rate)&&rate>0?rate:null;
            continue;
          }
          if(s.currency==='EUR'&&key==='rateDate') {
            s.rateDate=input.checkValidity()&&C.validDate(input.value)?input.value:'';
            continue;
          }
          if (!input.checkValidity()) throw new Error('Check '+input.closest('label').querySelector('span').textContent+' in '+(s.name||cityName(s.city))+'.');
          s[key]=numeric.includes(key)?(input.value===''?null:input.valueAsNumber):input.value;
          if(key==='name')s[key]=s[key].trim();
        }
      }
      return C.cleanBudgetState(next,true);
    }
    function changed() {
      shell.querySelector('.tw-error').hidden=true;
      const output=shell.querySelector('#tw-budget-output');output.replaceChildren();
      const p=document.createElement('p');p.textContent='Your inputs changed. Compare again to refresh the results.';output.appendChild(p);
    }
    function compare() {
      state=readState();
      if(!state.scenarios.length)throw new Error('Add a scenario before comparing.');
      const rows=state.scenarios.map(s=>({scenario:s,result:C.budgetSummary(s)}));
      shell.querySelector('#tw-budget-output').innerHTML=`<h4>Your estimates · EUR comparison</h4><div class="tw-table-wrap" role="region" tabindex="0" aria-label="Scrollable budget comparison"><table class="tw-table"><caption>Student-entered scenarios; NOK converted using your dated assumption. All displayed amounts are EUR.</caption><thead><tr><th scope="col">Scenario</th><th scope="col">Monthly balance</th><th scope="col">Period spending</th><th scope="col">Deposit held</th><th scope="col">Total cash needed</th><th scope="col">Upfront cash</th><th scope="col">Period balance before deposit</th></tr></thead><tbody>${rows.map(({scenario:s,result:r})=>`<tr><th scope="row">${esc(s.name||cityName(s.city))}<br><small>${cityName(s.city)} · ${r.months} months · entered in ${r.currency}</small></th><td>${money(r.eur.monthlyBalance)}</td><td>${money(r.eur.periodSpending)}</td><td>${money(r.eur.refundableDeposit)}</td><td>${money(r.eur.periodCashRequired)}</td><td>${money(r.eur.upfrontCash)}</td><td>${money(r.eur.periodBalance)}</td></tr>`).join('')}</tbody></table></div>${rows.map(({scenario:s,result:r})=>`<p class="tw-note"><strong>${esc(s.name||cityName(s.city))}:</strong> monthly spending ${money(r.monthlyExpenses)} ${r.currency}; period income ${money(r.periodIncome)} ${r.currency}. ${s.currency==='NOK'?`Your assumption: 1 EUR = ${s.nokPerEur} NOK, dated ${s.rateDate}.`:'Amounts entered in EUR; no currency conversion.'}</p>`).join('')}<p class="tw-note">A negative balance identifies a gap in this scenario. Deposit-held cash is separate from spending. These estimates exclude any costs you have not entered.</p>`;
      shell.querySelector('.tw-error').hidden=true;notify(ctx,'Budget comparison refreshed using your estimates.');
    }
    shell.addEventListener('input',event=>{if(event.target.matches('[data-budget-key]'))changed();});
    shell.addEventListener('change',event=>{
      if(!event.target.matches('[data-budget-key]'))return;
      const card=event.target.closest('[data-budget-scenario]'),s=state.scenarios.find(item=>item.id===card.dataset.budgetScenario);
      if(event.target.dataset.budgetKey==='currency')shell.querySelector(`[data-budget-rate="${s.id}"]`).hidden=event.target.value==='EUR';
      if(event.target.dataset.budgetKey==='city')shell.querySelector(`#tw-budget-${s.id}-legend`).textContent='Scenario '+(state.scenarios.indexOf(s)+1)+' · '+cityName(event.target.value);
      changed();
    });
    shell.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      try {
        if(button.id==='tw-budget-add') {
          state=readState();if(state.scenarios.length>=4)throw new Error('Compare up to four scenarios.');
          const city=C.CITIES.find(c=>!state.scenarios.some(s=>s.city===c.id))||C.CITIES[0];
          const s=C.emptyScenario(uniqueId('b-'),city.id);state.scenarios.push(s);render();
          shell.querySelector('#tw-budget-'+s.id+'-name').focus();notify(ctx,'Empty '+city.title+' scenario added.');
        }
        if(button.dataset.budgetRemove) {
          state=readState(button.dataset.budgetRemove);render();shell.querySelector('#tw-budget-add').focus();notify(ctx,'Scenario removed from this draft.');
        }
      } catch(error) {showError(shell,error);}
    });
    shell.addEventListener('submit',event=>{if(event.target.id!=='tw-budget-form')return;event.preventDefault();try{compare();}catch(error){shell.querySelector('#tw-budget-output').replaceChildren();showError(shell,error);}});
    render();
    return {getState:()=>readState()};
  }
  function mountMoving(container,ctx) {
    const shell=shellFor(container);
    let state=C.cleanMovingState(ctx.draft);
    const phaseTitles={before:'Before departure',arrival:'On arrival',settled:'After settling in'};
    function taskRow(task) {
      const id='tw-move-'+task.id;
      const today=typeof ctx.today==='function'?ctx.today():'';
      const timing=!task.done&&task.due&&C.validDate(today)?task.due<today?'Overdue':task.due===today?'Due today':'':'';
      return `<li class="tw-card" data-moving-task="${task.id}"><label for="${id}-done"><input type="checkbox" id="${id}-done" data-move-done="${task.id}"${task.done?' checked':''}> <span>${esc(task.title)}</span></label><label class="tw-field" for="${id}-due"><span>Optional due date</span><input type="date" id="${id}-due" data-move-date="${task.id}" min="1900-01-01" max="2200-12-31" value="${task.due}"></label><span data-move-timing="${task.id}">${timing}</span>${task.custom?`<button type="button" class="tk-text-button" data-move-remove="${task.id}" aria-label="Remove ${esc(task.title)}">Remove task</button>`:''}</li>`;
    }
    function updateProgress() {
      const progress=C.movingProgress(state),tasks=C.movingTasks(state);
      shell.querySelector('#tw-move-progress').value=progress.completed;
      shell.querySelector('#tw-move-progress').max=progress.total;
      shell.querySelector('#tw-move-count').textContent=progress.completed+' of '+progress.total+' tasks complete · '+progress.percent+'%';
      for(const phase of C.PHASES) {
        const items=tasks.filter(task=>task.phase===phase);
        shell.querySelector('[data-move-phase-count="'+phase+'"]').textContent=items.filter(task=>task.done).length+' / '+items.length+' complete';
      }
      const today=typeof ctx.today==='function'?ctx.today():'';
      for(const task of tasks) shell.querySelector('[data-move-timing="'+task.id+'"]').textContent=!task.done&&task.due&&C.validDate(today)?task.due<today?'Overdue':task.due===today?'Due today':'':'';
    }
    function render() {
      const tasks=C.movingTasks(state);
      shell.innerHTML=`<h3 id="tw-move-title">A calmer move, one task at a time.</h3><p>A student-made preparation checklist for your next programme city. Add the tasks and dates that fit your own situation.</p><div class="tw-fields"><label class="tw-field" for="tw-move-city"><span>Your destination</span><select id="tw-move-city">${cityOptions(state.city)}</select></label><div class="tw-actions"><a id="tw-move-guide" class="tk-text-button" href="city-guide.html?city=${state.city}">Open the ${cityName(state.city)} city guide →</a></div></div><p class="tw-note">Changing destination keeps your tasks, due dates and progress. These suggestions do not determine visa, residence, insurance or university requirements; confirm relevant arrangements with their official sources.</p><div class="tw-output"><p id="tw-move-count" role="status"></p><progress id="tw-move-progress" aria-label="Moving checklist completion"></progress></div><div class="tw-checklist">${C.PHASES.map(phase=>`<section class="tw-card" aria-labelledby="tw-move-phase-${phase}"><h4 id="tw-move-phase-${phase}">${phaseTitles[phase]}</h4><p data-move-phase-count="${phase}"></p><ul class="tw-checklist">${tasks.filter(task=>task.phase===phase).map(taskRow).join('')}</ul></section>`).join('')}</div><form id="tw-move-add-form" class="tw-card" novalidate><h4>Add a task for your situation</h4><div class="tw-fields"><label class="tw-field" for="tw-move-custom-title"><span>Task title · up to 120 characters</span><input id="tw-move-custom-title" maxlength="120" autocomplete="off" placeholder="e.g. Arrange a key collection time"></label><label class="tw-field" for="tw-move-custom-phase"><span>When to do it</span><select id="tw-move-custom-phase">${C.PHASES.map(phase=>`<option value="${phase}">${phaseTitles[phase]}</option>`).join('')}</select></label><label class="tw-field" for="tw-move-custom-date"><span>Optional due date</span><input id="tw-move-custom-date" type="date" min="1900-01-01" max="2200-12-31"></label></div><div class="tw-actions"><button type="submit" class="tk-button"${state.customTasks.length>=C.LIMITS.customTasks?' disabled':''}>Add task (${state.customTasks.length}/${C.LIMITS.customTasks})</button><button type="button" id="tw-move-custom-clear" class="tk-text-button">Clear new task</button></div><p class="tw-note">Add this task or clear its inputs before saving or changing tools.</p></form><p class="tw-error" role="alert" hidden></p><p class="tw-note">Record short practical tasks. Keep identity numbers, document scans and confidential information out of this checklist. Saving and backups are managed by this workspace’s controls.</p>`;
      updateProgress();
    }
    function readState() {
      const next={...state,city:shell.querySelector('#tw-move-city').value,completed:[],dates:[],customTasks:state.customTasks.map(task=>({...task}))};
      for(const task of C.movingTasks(state)) {
        if(shell.querySelector('[data-move-done="'+task.id+'"]').checked)next.completed.push(task.id);
        const input=shell.querySelector('[data-move-date="'+task.id+'"]');
        if(!input.checkValidity())throw new Error('Use a valid calendar date for '+task.title+'.');
        if(input.value)next.dates.push({id:task.id,date:input.value});
      }
      return C.cleanMovingState(next,true);
    }
    function requireFinishedTask() {
      const title=shell.querySelector('#tw-move-custom-title'),phase=shell.querySelector('#tw-move-custom-phase'),date=shell.querySelector('#tw-move-custom-date');
      if(title.value!==''||phase.value!=='before'||date.value!==''||!date.checkValidity())throw new Error('Add or clear the new task before saving or changing tools.');
    }
    shell.addEventListener('change',event=>{
      try {
        if(event.target.id==='tw-move-city') {
          state.city=event.target.value;
          const link=shell.querySelector('#tw-move-guide');link.href='city-guide.html?city='+state.city;link.textContent='Open the '+cityName(state.city)+' city guide →';
          notify(ctx,'Destination changed. Your tasks, due dates and completion were kept.');
        }
        if(event.target.dataset.moveDone||event.target.dataset.moveDate) {state=readState();updateProgress();shell.querySelector('.tw-error').hidden=true;}
      } catch(error) {showError(shell,error);}
    });
    shell.addEventListener('submit',event=>{
      if(event.target.id!=='tw-move-add-form')return;event.preventDefault();
      try {
        state=readState();if(state.customTasks.length>=C.LIMITS.customTasks)throw new Error('Keep up to 21 custom moving tasks.');
        const title=shell.querySelector('#tw-move-custom-title').value.trim(),phase=shell.querySelector('#tw-move-custom-phase').value,input=shell.querySelector('#tw-move-custom-date');
        if(!title)throw new Error('Give your task a short title.');
        if(!input.checkValidity()||(input.value&&!C.validDate(input.value)))throw new Error('Use a valid due date for your task.');
        const id=uniqueId('m-c-'),next={...state,customTasks:[...state.customTasks,{id,title,phase}],dates:[...state.dates]};
        if(input.value)next.dates.push({id,date:input.value});
        state=C.cleanMovingState(next,true);render();shell.querySelector('#tw-move-custom-title').focus();notify(ctx,'Task added to your moving draft.');
      } catch(error) {showError(shell,error);}
    });
    shell.addEventListener('click',event=>{
      if(event.target.closest('#tw-move-custom-clear')) {
        shell.querySelector('#tw-move-custom-title').value='';shell.querySelector('#tw-move-custom-phase').value='before';shell.querySelector('#tw-move-custom-date').value='';
        shell.querySelector('.tw-error').hidden=true;shell.querySelector('#tw-move-custom-title').focus();notify(ctx,'New task inputs cleared. Existing checklist tasks were kept.');return;
      }
      const button=event.target.closest('[data-move-remove]');if(!button)return;
      try {
        requireFinishedTask();state=readState();const id=button.dataset.moveRemove;
        state.customTasks=state.customTasks.filter(task=>task.id!==id);state.completed=state.completed.filter(value=>value!==id);state.dates=state.dates.filter(entry=>entry.id!==id);
        render();shell.querySelector('#tw-move-custom-title').focus();notify(ctx,'Custom task removed from this moving draft.');
      } catch(error) {showError(shell,error);}
    });
    render();return {getState:()=>{requireFinishedTask();return readState();}};
  }
  window.StudentToolkitLifeTools=Object.freeze([
    Object.freeze({id:'four-city-budget',title:'Four-City Budget Planner',category:'life',icon:'calculator',summary:'Compare your own living-cost scenarios, upfront cash and monthly balance.',cleanState:C.cleanBudgetState,mount:mountBudget}),
    Object.freeze({id:'moving-checklist',title:'Moving Checklist',category:'cities',icon:'list',summary:'Plan departure, arrival and settling in while keeping your progress on this device.',cleanState:C.cleanMovingState,mount:mountMoving})
  ]);
})();
