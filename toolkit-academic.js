/* Academic workbench adapters. All user input stays in the parent-controlled draft. */
(function (root) {
  'use strict';
  const C = root.StudentToolkitAcademicCore;
  if (!C) return;
  const fmt = value => Number.isFinite(value) ? new Intl.NumberFormat('en',value !== 0 && Math.abs(value) < .0001 ? {notation:'scientific',maximumSignificantDigits:5} : {maximumFractionDigits:4}).format(value) : 'Not defined';
  const el = (tag,className,text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function button(text, handler, className = 'tk-text-button') {
    const node = el('button',className,text); node.type = 'button'; node.addEventListener('click',handler); return node;
  }
  function numberField(prefix,key,label,value,bounds,fields) {
    const wrap = el('label','tw-field'), text = el('span','',label), input = el('input');
    input.id = prefix+'-'+key; input.type = 'number'; input.min = bounds[0]; input.max = bounds[1]; input.step = 'any'; input.value = value; input.required = true;
    wrap.htmlFor = input.id; wrap.append(text,input); fields[key] = input;
    return wrap;
  }
  function read(fields,key) {
    const input = fields[key]; input.removeAttribute('aria-invalid');
    if (input.value.trim() === '' || !Number.isFinite(Number(input.value))) { input.setAttribute('aria-invalid','true'); throw new RangeError('Enter a finite number for '+input.closest('label').querySelector('span').textContent+'. Blank is not zero.'); }
    const value = Number(input.value);
    if (value < Number(input.min) || value > Number(input.max)) { input.setAttribute('aria-invalid','true'); throw new RangeError(input.closest('label').querySelector('span').textContent+': use a value from '+input.min+' to '+input.max+'.'); }
    return value;
  }
  function metric(label,value) {
    const node = el('div','tw-metric'); node.append(el('span','',label),el('strong','',value)); return node;
  }
  function dataTable(headers,rows) {
    const wrap = el('div','tw-table-wrap'), table = el('table','tw-table'), head = el('thead'), body = el('tbody'), hr = el('tr');
    for (const value of headers) { const cell = el('th','',value); cell.scope = 'col'; hr.append(cell); }
    head.append(hr);
    for (const row of rows) { const tr = el('tr'); row.forEach((value,i) => { const cell = el(i === 0 ? 'th' : 'td','',value); if (i === 0) cell.scope = 'row'; tr.append(cell); }); body.append(tr); }
    table.append(head,body); wrap.append(table); return wrap;
  }
  function errorNode(prefix) { const node = el('p','tw-error'); node.id = prefix+'-error'; node.setAttribute('role','alert'); node.hidden = true; return node; }
  function reference(href,label) { const node = el('a','tk-text-link',label); node.href = href; return node; }
  function svgNode(tag,attrs,text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg',tag);
    for (const [key,value] of Object.entries(attrs || {})) node.setAttribute(key,String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function economicChart(r) {
    const chart = svgNode('svg',{viewBox:'0 0 760 370',class:'tw-chart',role:'img','aria-labelledby':'tw-econ-chart-title tw-econ-chart-desc'});
    chart.append(svgNode('title',{id:'tw-econ-chart-title'},'Supply and demand: baseline and changed scenario'));
    chart.append(svgNode('desc',{id:'tw-econ-chart-desc'},`Solid curves are the changed scenario; dashed curves are the baseline. Changed quantity ${fmt(r.changed.quantity)}; changed price ${r.changed.trade ? fmt(r.changed.price) : 'not uniquely determined at zero trade'}. All results also appear in the table.`));
    const L=72,R=720,T=34,B=300, maxP=Math.max(1,r.baseline.a,r.changed.a,r.baseline.c,r.changed.c)*1.16;
    const maxQ=Math.max(1,r.baseline.a/r.baseline.b,r.changed.a/r.changed.b,r.baseline.quantity*1.3,r.changed.quantity*1.3);
    const x=q=>L+q/maxQ*(R-L), y=p=>B-p/maxP*(B-T);
    chart.append(svgNode('path',{d:`M${L} ${T}V${B}H${R}`,stroke:'var(--text-secondary)',fill:'none','stroke-width':1.5}));
    for (const t of [0,.25,.5,.75,1]) {
      chart.append(svgNode('path',{d:`M${L} ${y(t*maxP)}H${R}`,stroke:'var(--border-default)',fill:'none'}));
      chart.append(svgNode('text',{x:L-8,y:y(t*maxP)+4,'text-anchor':'end',fill:'var(--text-secondary)','font-size':12},fmt(t*maxP)));
      chart.append(svgNode('text',{x:x(t*maxQ),y:B+22,'text-anchor':'middle',fill:'var(--text-secondary)','font-size':12},fmt(t*maxQ)));
    }
    for (const [scenario,dashed] of [[r.baseline,true],[r.changed,false]]) {
      const demandEnd=Math.min(maxQ,scenario.a/scenario.b), supplyEnd=Math.min(maxQ,Math.max(0,(maxP-scenario.c)/scenario.d));
      const attrs={fill:'none','stroke-width':dashed?2:3.5,'stroke-dasharray':dashed?'7 6':'none'};
      chart.append(svgNode('path',{...attrs,d:`M${x(0)} ${y(scenario.a)}L${x(demandEnd)} ${y(Math.max(0,scenario.a-scenario.b*demandEnd))}`,stroke:'var(--color-primary)'}));
      chart.append(svgNode('path',{...attrs,d:`M${x(0)} ${y(scenario.c)}L${x(supplyEnd)} ${y(scenario.c+scenario.d*supplyEnd)}`,stroke:'var(--color-accent)'}));
      if (scenario.trade) chart.append(svgNode('circle',{cx:x(scenario.quantity),cy:y(scenario.price),r:dashed?4:6,fill:dashed?'var(--text-secondary)':'var(--text-primary)'}));
    }
    chart.append(svgNode('text',{x:L,y:18,fill:'var(--text-primary)','font-size':13},'Price · monetary units'));
    chart.append(svgNode('text',{x:(L+R)/2,y:356,'text-anchor':'middle',fill:'var(--text-primary)','font-size':13},'Quantity · units'));
    return chart;
  }
  function mountEconomics(container,ctx) {
    container.replaceChildren();
    let draft = C.cleanEconomics(ctx.draft), fields = {}, sliders = {};
    const form = el('form','tw-form'); form.noValidate = true;
    form.append(el('p','tw-note','Worked example: inverse demand P = A − BQ; inverse supply P = C + DQ. Replace these illustrative values with a course exercise.'));
    const grid = el('div','tw-fields');
    for (const [key,label] of [['a','Demand intercept A'],['b','Demand slope B'],['c','Supply intercept C'],['d','Supply slope D'],['shiftA','Change in demand intercept'],['shiftC','Change in supply intercept']]) grid.append(numberField('tw-econ',key,label,draft[key],C.economicsLimits[key],fields));
    form.append(grid);
    const sliderGrid = el('div','tw-fields');
    for (const [key,label] of [['shiftA','Slide the demand curve'],['shiftC','Slide the supply curve']]) {
      const wrap = el('label','tw-field'), input = el('input'); input.id='tw-econ-'+key+'-slider'; input.type='range'; input.step='any'; wrap.htmlFor=input.id; wrap.append(el('span','',label),input); sliders[key]=input; sliderGrid.append(wrap);
    }
    form.append(sliderGrid,el('p','tw-note','Demand shift changes willingness to pay at each quantity. Supply shift changes the minimum supply price. Slopes stay fixed.'));
    const error = errorNode('tw-econ'), actions = el('div','tw-actions'), calculate = el('button','tk-button','Update graph'); calculate.type='submit'; actions.append(calculate);
    const result = el('div','tw-output'); result.id='tw-econ-output';
    function state() { const value={}; for (const key of Object.keys(C.economicsDefaults)) value[key]=read(fields,key); return C.cleanEconomics(value,true); }
    function syncSliders(s) { for (const [key,base] of [['shiftA','a'],['shiftC','c']]) { sliders[key].min=-s[base]; sliders[key].max=Math.min(1e6-s[base],Math.max(100,s[base],Math.abs(s[key]))); sliders[key].value=s[key]; } }
    function update() {
      try {
        draft=state(); const r=C.economics(draft); syncSliders(draft); error.hidden=true; result.replaceChildren();
        result.append(el('h3','',r.changed.trade ? 'The changed market reaches a positive equilibrium.' : 'No positive quantity is mutually acceptable.'));
        const metrics=el('div','tw-metrics'); metrics.append(metric('Changed quantity',fmt(r.changed.quantity)),metric('Changed price',r.changed.trade?fmt(r.changed.price):'No unique trade price'),metric('Quantity change',fmt(r.quantityChange)),metric('Total surplus',fmt(r.changed.totalSurplus))); result.append(metrics,economicChart(r));
        result.append(el('p','tw-note','Blue: demand. Amber: supply. Solid: changed scenario; dashed: baseline. The graph uses one common scale for both scenarios.'));
        const rows=[['Quantity',fmt(r.baseline.quantity),fmt(r.changed.quantity)],['Price',r.baseline.trade?fmt(r.baseline.price):'No unique trade price',r.changed.trade?fmt(r.changed.price):'No unique trade price'],['Consumer surplus',fmt(r.baseline.consumerSurplus),fmt(r.changed.consumerSurplus)],['Producer surplus',fmt(r.baseline.producerSurplus),fmt(r.changed.producerSurplus)],['Total surplus',fmt(r.baseline.totalSurplus),fmt(r.changed.totalSurplus)],['Demand point elasticity',r.baseline.trade?fmt(r.baseline.elasticity):'Undefined at zero quantity',r.changed.trade?fmt(r.changed.elasticity):'Undefined at zero quantity']];
        result.append(dataTable(['Result','Baseline','Changed'],rows));
        const work=el('pre','tw-note'); work.textContent=`Changed demand: P = ${fmt(r.changed.a)} − ${fmt(r.changed.b)}Q\nChanged supply: P = ${fmt(r.changed.c)} + ${fmt(r.changed.d)}Q\n${r.changed.trade ? `Q* = (A − C) / (B + D) = ${fmt(r.changed.quantity)}\nP* = C + DQ* = ${fmt(r.changed.price)}\nCS = ½(A − P*)Q* = ${fmt(r.changed.consumerSurplus)}\nPS = ½(P* − C)Q* = ${fmt(r.changed.producerSurplus)}\nDemand elasticity = −P* / (BQ*) = ${fmt(r.changed.elasticity)}` : 'A ≤ C: no positive-trade intersection. Quantity and surplus are zero; the model does not select a unique transaction price.'}`; result.append(work);
        return r;
      } catch (e) { error.textContent=e.message; error.hidden=false; result.replaceChildren(); return null; }
    }
    actions.append(button('Load worked example',()=>{draft={...C.economicsDefaults}; for (const [key,value] of Object.entries(draft)) fields[key].value=value; update(); ctx.notify('The economics worked example is loaded. Save explicitly to keep it.');}));
    actions.append(button('Download results (CSV)',()=>{const r=update(); if (!r) return; const rows=[['Metric','Baseline','Changed'],['Quantity',r.baseline.quantity,r.changed.quantity],['Price',r.baseline.price??'',r.changed.price??''],['Consumer surplus',r.baseline.consumerSurplus,r.changed.consumerSurplus],['Producer surplus',r.baseline.producerSurplus,r.changed.producerSurplus],['Total surplus',r.baseline.totalSurplus,r.changed.totalSurplus],['Demand elasticity',r.baseline.elasticity??'',r.changed.elasticity??'']]; ctx.download('euhem-economics-results.csv',rows.map(row=>row.join(',')).join('\r\n'),'text/csv;charset=utf-8'); ctx.notify('Results prepared for download. They contain your current scenario values.');}));
    form.append(error,actions); container.append(form,result,el('p','tw-note','A hypothetical competitive market with straight-line curves, no taxes, price controls, externalities, asymmetric information or insurance. These are monetary surplus areas, not QALYs, clinical benefit or a health-policy recommendation. This simplified model does not establish real healthcare-market efficiency.'));
    const links=el('p','tw-note'); links.append(reference('lecture.html?topic=fund-health-economics.demand','Connect to Healthcare Demand'),document.createTextNode(' · '),reference('course.html?course=intro-economics','Introduction to Economics')); container.append(links);
    form.addEventListener('submit',event=>{event.preventDefault();update();});
    form.addEventListener('input',event=>{const key=Object.keys(sliders).find(k=>sliders[k]===event.target); if (key) fields[key].value=event.target.value; update();});
    update(); return {getState:state};
  }
  function mountSample(container,ctx) {
    container.replaceChildren(); let draft=C.cleanSample(ctx.draft), fields={};
    const form=el('form','tw-form'); form.noValidate=true;
    form.append(el('p','tw-note','Plan the approximate sample needed for a chosen confidence-interval half-width. This plans precision, not power to detect an effect. Starting values are a worked example.'));
    const grid=el('div','tw-fields'), modeWrap=el('label','tw-field'), mode=el('select'); mode.id='tw-sample-mode'; modeWrap.htmlFor=mode.id; modeWrap.append(el('span','','What will you estimate?'));
    for (const [value,label] of [['mean','One population mean'],['proportion','One population proportion']]) { const option=el('option','',label); option.value=value; mode.append(option); } mode.value=draft.mode; modeWrap.append(mode); grid.append(modeWrap); fields.mode=mode;
    grid.append(numberField('tw-sample','confidence','Two-sided confidence level (%)',draft.confidence,C.sampleLimits.confidence,fields));
    const meanFields=el('div','tw-fields'); meanFields.id='tw-sample-mean-fields'; meanFields.append(numberField('tw-sample','sd','Planning population SD · σ',draft.sd,C.sampleLimits.sd,fields),numberField('tw-sample','meanMargin','Target margin · in the same units as σ',draft.meanMargin,C.sampleLimits.meanMargin,fields));
    const proportionFields=el('div','tw-fields'); proportionFields.id='tw-sample-proportion-fields'; proportionFields.append(numberField('tw-sample','proportion','Planning proportion · 0 to 1',draft.proportion,C.sampleLimits.proportion,fields),numberField('tw-sample','proportionMargin','Target margin · proportion units',draft.proportionMargin,C.sampleLimits.proportionMargin,fields));
    const lossWrap=numberField('tw-sample','loss','Expected unusable / nonresponse (%)',100*draft.loss,[0,95],fields); grid.append(lossWrap); form.append(grid,meanFields,proportionFields);
    form.append(el('p','tw-note','For a proportion, 0.05 is five percentage points. Choose 0.5 when no justified planning estimate is available; it gives the largest required sample under this formula. Loss allowance is an expected planning adjustment, not a promise of a final response count.'));
    const error=errorNode('tw-sample'), actions=el('div','tw-actions'), submit=el('button','tk-button','Calculate sample plan'); submit.type='submit'; actions.append(submit);
    const result=el('div','tw-output'); result.id='tw-sample-output';
    function state() {
      const value={mode:mode.value};
      for (const key of Object.keys(C.sampleLimits)) {
        const inactive=mode.value==='mean'?['proportion','proportionMargin'].includes(key):['sd','meanMargin'].includes(key);
        const numeric=fields[key].value.trim()===''?NaN:Number(fields[key].value);
        if (inactive && (!Number.isFinite(numeric) || numeric<Number(fields[key].min) || numeric>Number(fields[key].max))) fields[key].value=C.sampleDefaults[key];
        value[key]=read(fields,key)/(key==='loss'?100:1);
      }
      return C.cleanSample(value,true);
    }
    function update() {
      meanFields.hidden=mode.value!=='mean'; proportionFields.hidden=mode.value!=='proportion';
      try {
        draft=state(); const r=C.sampleSize(draft); error.hidden=true; result.replaceChildren();
        result.append(el('h3','','Aim for '+fmt(r.complete)+' usable observations.'));
        const metrics=el('div','tw-metrics'); metrics.append(metric('Usable observations',fmt(r.complete)),metric('Recruitment target',fmt(r.recruit)),metric('Loss allowance',fmt(r.extra)),metric('Normal critical value z*',fmt(r.z))); result.append(metrics);
        const equation=draft.mode==='mean'?'n₀ = (z* × σ / margin)²':'n₀ = z*² × p × (1 − p) / margin²';
        const work=el('pre','tw-note'); work.textContent=`${equation}\nUnrounded requirement = ${fmt(r.unrounded)}\nRound upward: n = ${r.complete}\nRecruitment target = ceil(n / (1 − ${fmt(draft.loss)})) = ${r.recruit}`; result.append(work);
        result.append(dataTable(['Check','Value'],[['Target margin',fmt(draft.mode==='mean'?draft.meanMargin:draft.proportionMargin)],['Formula margin at rounded n',fmt(r.achievedMargin)],['Confidence level',fmt(draft.confidence)+'%'],['Planning SD / proportion',fmt(draft.mode==='mean'?draft.sd:draft.proportion)],['Expected unusable / nonresponse',fmt(draft.loss*100)+'%']]));
        if (draft.mode==='proportion') {
          result.append(el('p','tw-note',`Expected successes at this planning proportion: ${fmt(r.expectedSuccesses)}; expected failures: ${fmt(r.expectedFailures)}.`));
          if (r.approximationCaution) result.append(el('p','tw-note','Small expected counts: the normal approximation may be poor. Ask your supervisor about exact or other design-specific planning. This output does not guarantee the target interval coverage.'));
        }
        result.append(el('p','tw-note',draft.mode==='mean'?'The mean formula treats σ as a known planning value and uses a normal critical value. If σ is estimated, uncertain or the data are strongly non-normal, discuss a more appropriate design-specific method.':'This is normal-approximation planning for independent binary observations. The actual proportion and chosen interval method affect achieved precision and coverage.'));
        return r;
      } catch (e) { error.textContent=e.message; error.hidden=false; result.replaceChildren(); return null; }
    }
    actions.append(button('Load worked example',()=>{draft={...C.sampleDefaults}; mode.value=draft.mode; for (const key of Object.keys(C.sampleLimits)) fields[key].value=draft[key]*(key==='loss'?100:1); update(); ctx.notify('The mean-precision worked example is loaded. Save explicitly to keep it.');}));
    actions.append(button('Download plan (TXT)',()=>{const r=update(); if (!r) return; const text=`EU-HEM Student Toolkit — Sample precision plan\n\nMethod: ${r.state.mode}\nConfidence: ${r.state.confidence}%\nPlanning ${r.state.mode==='mean'?'SD':'proportion'}: ${r.state.mode==='mean'?r.state.sd:r.state.proportion}\nTarget half-width: ${r.state.mode==='mean'?r.state.meanMargin:r.state.proportionMargin}\nLoss allowance: ${r.state.loss*100}%\nz*: ${r.z}\nUnrounded n: ${r.unrounded}\nUsable observations: ${r.complete}\nRecruitment target: ${r.recruit}\n\nEducational precision approximation, not power, guaranteed coverage or approval of a research design. No cluster effects, finite-population correction or repeated observations are modelled.\n`; ctx.download('euhem-sample-precision.txt',text,'text/plain;charset=utf-8'); ctx.notify('The plan is prepared for download. It includes your current planning assumptions.');}));
    form.append(error,actions); container.append(form,result,el('p','tw-note','Assumes independent observations and a suitable sampling design. No power analysis, finite-population correction, clustering, paired/repeated data, survey weights or multiple outcomes are modelled. Counts cannot exceed 10000000. This is educational planning: confirm assumptions and feasibility with your instructor or supervisor.'));
    const links=el('p','tw-note'); links.append(reference('https://www.itl.nist.gov/div898/handbook/prc/section2/prc222.htm','NIST: sample size for a confidence interval'),document.createTextNode(' · '),reference('toolkit.html?section=solve&solver=finder','Review the estimation method')); container.append(links);
    form.addEventListener('submit',event=>{event.preventDefault();update();}); form.addEventListener('input',update); form.addEventListener('change',update); update();
    return {getState:()=>{const s=state();C.sampleSize(s);return s;}};
  }
  root.StudentToolkitAcademicTools = [
    {id:'economics-graphs',title:'Economics Graph Explorer',category:'economics',icon:'trending-up',summary:'Move supply and demand, compare equilibria, and connect price changes to surplus and elasticity.',cleanState:C.cleanEconomics,mount:mountEconomics},
    {id:'sample-size',title:'Sample Precision Planner',category:'study',icon:'calculator',summary:'Explore the sample needed for a target mean or proportion interval margin, with an explicit loss allowance.',cleanState:C.cleanSample,mount:mountSample}
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
