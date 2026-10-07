// Original guided cases and method selection for Capacci's Fundamentals module.
// Case answers share the Notes backup, while the timed mock keeps its own state.
(function (root) {
  'use strict';
  const KEY='fund-statistics.cases';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let memory=null;
  function grade(value,field) {
    if(typeof value!=='string'||value.trim()==='')return 'empty';
    const n=Number(value);
    if(!Number.isFinite(n)||Math.abs(n)>1e12)return 'invalid';
    return Math.abs(n-field.answer)<=field.tolerance+1e-12?'correct':'revisit';
  }
  function repair(saved,cases) {
    const out={version:1,cases:{}};
    for(const c of cases) {
      const item=saved?.version===1?saved.cases?.[c.id]:null;
      out.cases[c.id]={
        answers:c.fields.map((_,i)=>typeof item?.answers?.[i]==='string'&&item.answers[i].length<=80?item.answers[i]:''),
        checked:c.fields.map((_,i)=>item?.checked?.[i]===true),
        reflection:typeof item?.reflection==='string'?item.reflection.slice(0,4000):'',
        rubric:c.rubric.map((_,i)=>item?.rubric?.[i]===true),
        solution:item?.solution===true
      };
    }
    return out;
  }
  function countCorrect(state,cases) {
    return cases.reduce((sum,c)=>sum+c.fields.filter((f,i)=>state.cases[c.id].checked[i]&&grade(state.cases[c.id].answers[i],f)==='correct').length,0);
  }
  function mountCases(container,extension,lessons,storage) {
    const cases=extension.cases;
    if(!memory)memory=repair(storage.read(),cases);
    const requested=new URLSearchParams(location.search).get('case');
    let selected=cases.find(c=>c.id===requested)||cases[0];
    let topic=requested&&cases.some(c=>c.id===requested)?String(selected.number):'all';
    const persist=activity=>storage.save(memory,activity);
    const rememberCase=()=>{
      const url=new URL(location.href);url.searchParams.set('case',selected.id);
      history.replaceState(null,'',url.pathname+url.search+url.hash);
    };
    function draw() {
      const c=selected,s=memory.cases[c.id],visible=cases.filter(x=>topic==='all'||String(x.number)===topic);
      container.innerHTML=`<div class="fs-practice-summary"><div><span class="fs-kicker">Learn by solving</span><p><strong>12 original healthcare cases</strong> · 36 numerical checkpoints · 12 written reflections</p></div><p id="fs-case-progress" role="status"></p></div>
        <div class="fs-filter"><label for="fs-case-topic">Topic<select id="fs-case-topic"><option value="all">All six topics</option>${lessons.map(l=>`<option value="${l.number}" ${topic===String(l.number)?'selected':''}>${l.number} · ${esc(l.title)}</option>`).join('')}</select></label>
        <label for="fs-case-choice">Healthcare case<select id="fs-case-choice">${visible.map(x=>`<option value="${x.id}" ${x.id===c.id?'selected':''}>${x.number} · ${esc(x.title)}</option>`).join('')}</select></label></div>
        <article class="fs-card fs-case"><div class="fs-case-top"><span class="fs-tag">Topic ${c.number}${c.number===6?' · additional, time permitting':''}</span><a href="lecture.html?topic=${encodeURIComponent(c.topic)}">Return to the topic guide →</a></div><p class="fs-kicker">${esc(c.focus)}</p><h3 id="fs-case-title" tabindex="-1">${esc(c.title)}</h3><p class="fs-case-scenario">${esc(c.scenario)}</p>
        <p class="fs-meta">Try each checkpoint before revealing the solution. Use decimals for probabilities and proportions; keep extra precision until your final answer. Numerical checks allow the stated rounding tolerance.</p>
        <div class="fs-checkpoints">${c.fields.map((f,i)=>`<section class="fs-checkpoint" aria-labelledby="fs-check-label-${i}"><span class="fs-check-number">${i+1}</span><div><label id="fs-check-label-${i}" for="fs-case-answer-${i}">${esc(f.label)}</label><div class="fs-answer-row"><input id="fs-case-answer-${i}" type="number" step="any" value="${esc(s.answers[i])}" aria-describedby="fs-case-feedback-${i}"><button type="button" class="fs-button" data-check="${i}">Check answer ${i+1}</button></div><div class="fs-check-help"><button type="button" class="fs-hint-button" data-hint="${i}" aria-expanded="false" aria-controls="fs-case-hint-${i}">Show hint</button><span class="fs-meta">Rounding tolerance: ±${f.tolerance}</span></div><p class="fs-hint" id="fs-case-hint-${i}" hidden>${esc(f.hint)}</p><p class="fs-case-feedback" id="fs-case-feedback-${i}" role="status"></p></div></section>`).join('')}</div>
        <div class="fs-reflection"><h4>Explain the result</h4><label for="fs-case-reflection">${esc(c.reflection)}</label><textarea id="fs-case-reflection" rows="4" maxlength="4000">${esc(s.reflection)}</textarea><p class="fs-meta">Your draft is saved with study progress. Compare it with the model and rubric below; written answers are self-assessed.</p></div>
        <button class="fs-button fs-secondary" type="button" id="fs-case-reveal" aria-expanded="${s.solution}" aria-controls="fs-case-solution">${s.solution?'Hide':'Reveal'} worked solution</button>
        <div id="fs-case-solution" ${s.solution?'':'hidden'}><ol class="fs-solution-steps">${c.steps.map((x,i)=>`<li><span class="fs-step-label">Step ${i+1}</span><h4>${esc(x.title)}</h4><p>${esc(x.text)}</p></li>`).join('')}</ol><div class="table-wrap"><table><caption>English Excel syntax; check local separators and function names</caption><thead><tr><th scope="col">Goal / range</th><th scope="col">Formula</th></tr></thead><tbody>${c.excel.map(x=>`<tr><td>${esc(x.label)}</td><td><code>${esc(x.formula)}</code></td></tr>`).join('')}</tbody></table></div><div class="fs-feedback"><h4>Model interpretation</h4><p>${esc(c.model)}</p></div><div class="fs-rubric"><h4>Review your written answer</h4>${c.rubric.map((r,i)=>`<label class="fund-check"><input type="checkbox" data-case-rubric="${i}" ${s.rubric[i]?'checked':''}>${esc(r)}</label>`).join('')}</div><p class="fs-notice">${esc(c.trap)}</p><p class="fs-meta">${esc(c.source)} Data and worked explanations in this case are original teaching examples.</p></div></article>
        <div class="fs-case-footer"><button type="button" class="fs-button fs-secondary" id="fs-case-next">Next case →</button><a href="#methods">Check how to choose a method →</a></div>`;
      const q=selector=>container.querySelector(selector);
      function progress(){q('#fs-case-progress').textContent=`${countCorrect(memory,cases)} / 36 checkpoints correct`;}
      function feedback(i) {
        const status=s.checked[i]?grade(s.answers[i],c.fields[i]):'unchecked';
        const messages={empty:'Enter a numerical answer, then check it.',invalid:'Use a finite number with magnitude at most 1 trillion.',correct:'✓ Correct within the stated rounding tolerance.',revisit:'Revisit this calculation. Try the hint, then compare the worked steps.',unchecked:''};
        const el=q('#fs-case-feedback-'+i);el.textContent=messages[status];el.dataset.result=status;
        q('#fs-case-answer-'+i).setAttribute('aria-invalid',String(['empty','invalid','revisit'].includes(status)));
      }
      c.fields.forEach((f,i)=>{
        const input=q('#fs-case-answer-'+i);feedback(i);
        input.addEventListener('input',()=>{s.answers[i]=input.value.slice(0,80);s.checked[i]=false;feedback(i);progress();persist(false);});
        q(`[data-check="${i}"]`).addEventListener('click',()=>{s.checked[i]=true;feedback(i);progress();persist(true);});
        input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();q(`[data-check="${i}"]`).click();}});
        q(`[data-hint="${i}"]`).addEventListener('click',event=>{const hint=q('#fs-case-hint-'+i),open=hint.hidden;hint.hidden=!open;event.currentTarget.setAttribute('aria-expanded',String(open));event.currentTarget.textContent=open?'Hide hint':'Show hint';});
      });
      q('#fs-case-reflection').addEventListener('input',event=>{s.reflection=event.target.value;persist(false);});
      q('#fs-case-reveal').addEventListener('click',event=>{s.solution=!s.solution;q('#fs-case-solution').hidden=!s.solution;event.currentTarget.setAttribute('aria-expanded',String(s.solution));event.currentTarget.textContent=(s.solution?'Hide':'Reveal')+' worked solution';persist(true);});
      container.querySelectorAll('[data-case-rubric]').forEach(el=>el.addEventListener('change',()=>{s.rubric[Number(el.dataset.caseRubric)]=el.checked;persist(true);}));
      q('#fs-case-topic').addEventListener('change',event=>{topic=event.target.value;selected=cases.find(x=>topic==='all'||String(x.number)===topic);rememberCase();draw();});
      q('#fs-case-choice').addEventListener('change',event=>{selected=cases.find(x=>x.id===event.target.value);rememberCase();draw();});
      q('#fs-case-next').addEventListener('click',()=>{selected=visible[(visible.indexOf(selected)+1)%visible.length];rememberCase();draw();q('#fs-case-title').focus({preventScroll:true});container.scrollIntoView({block:'start',behavior:'instant'});});
      progress();
    }
    draw();
  }

  // Returns a recipe only after checking design and the course's approximation conditions.
  function method({target,goal,known=false,n=36,n2=36,k=20,nullProportion=.5,independent=false,normal=false}) {
    const response=(title,formula,steps,warning='',topic='fund-statistics.confidence-intervals',ready=true)=>({title,formula,steps,warning,topic,ready});
    const unavailable=(text,topic)=>response('Check the design first','',[text],'',topic,false);
    if(!['mean','proportion','two-means','paired'].includes(target)||!['interval','test'].includes(goal))return unavailable('Choose a supported target and goal.');
    if(target==='paired')return response('Recognise a paired design','dᵢ = measurement 1ᵢ − measurement 2ᵢ',[
      'Define the within-person or within-pair differences in the requested order.',
      'The sample size counts complete pairs. Independent-group formulas are not appropriate for these linked measurements.',
      'A full paired calculation needs the SD of differences and design checks, not the difference between the two group SDs.'
    ],'Paired formulas are illustrative in Topic 6; the slides say students will not be asked to use them. This guide identifies the design and does not calculate a paired test.','fund-statistics.two-means',false);
    const topic=target==='two-means'?'fund-statistics.two-means':goal==='test'?'fund-statistics.hypothesis-tests':'fund-statistics.confidence-intervals';
    if(!Number.isSafeInteger(n)||n<2||n>10000000)return unavailable('Enter a whole-number sample size from 2 to 10,000,000.',topic);
    if(!independent)return unavailable('The simple course formulas require independent observations and a suitable sampling design. Repeated patients, selected clusters or a convenience sample need further design review; sample size alone cannot resolve this.',topic);
    if(target==='two-means') {
      if(!Number.isSafeInteger(n2)||n2<2||n2>10000000)return unavailable('Enter a valid second-group sample size from 2 to 10,000,000.',topic);
      if(n<30||n2<30)return unavailable('The course two-mean normal approximation requires suitably large samples in both groups (the lab uses at least 30 each). Small samples may need Welch’s t or another justified method; it is not calculated here.',topic);
      const formula=goal==='interval'?'(x̄₁−x̄₂) ± z(1−α/2) √(s₁²/n₁+s₂²/n₂)':'z ≈ [(x̄₁−x̄₂)−Δ₀] / √(s₁²/n₁+s₂²/n₂)';
      return response('Two independent means · course normal approximation',formula,[
        'Define Δ=μ₁−μ₂, the group order, outcome and units. Use each group’s adjusted SD.',
        'Add the sampling variances s₁²/n₁ and s₂²/n₂, then take their square root.',
        goal==='interval'?'Choose a confidence level and use the matching normal critical value. Report both endpoints for the contrast.':'Specify H₀: Δ=Δ₀ and a two-sided alternative, choose α in advance and calculate two-sided p=2Φ(−|z|). The usual equal-means null is Δ₀=0.',
        'Report the effect and uncertainty. An observational difference alone does not establish causation.'
      ],'Topic 6 is additional, time permitting. n≥30 is a heuristic: still check distributions, influential values, independence and sampling quality.',topic);
    }
    if(target==='proportion') {
      if(!Number.isSafeInteger(k)||k<0||k>n)return unavailable('Observed successes must be a whole number between 0 and n.',topic);
      if(goal==='interval') {
        if(k<5||n-k<5)return unavailable('The course Wald interval needs at least 5 observed successes and 5 observed failures. A large n does not fix sparse counts; use a better justified procedure rather than this approximation.',topic);
        return response('One proportion · Wald confidence interval','p̂ ± z(1−α/2) √[p̂(1−p̂)/n]',[
          `Define success and the target population proportion π. Set p̂=k/n; observed counts are ${k} successes and ${n-k} failures.`,
          'Estimate SE with the observed p̂. Use the two-sided normal critical percentile 1−α/2.',
          'Check whether both endpoints are inside [0,1]; do not silently truncate an invalid Wald interval.',
          'Interpret the endpoints for the population proportion and explain confidence as repeated-sampling coverage.'
        ],k<10||n-k<10?'Counts meet the course minimum of 5, but not the common more conservative guideline of 10 each. The Wald method can perform poorly near 0 or 1.':'The Wald method remains an approximation. Its observed-p̂ SE differs from the null-based test SE, so the two procedures need not give matching decisions.',topic);
      }
      if(!Number.isFinite(nullProportion)||nullProportion<=0||nullProportion>=1)return unavailable('Use a null proportion strictly between 0 and 1.',topic);
      if(n*nullProportion<5||n*(1-nullProportion)<5)return unavailable('This normal test needs at least 5 expected successes and 5 expected failures under H₀. Check nπ₀ and n(1−π₀), rather than replacing them with observed counts.',topic);
      return response('One proportion · null-based z test','z = (p̂−π₀) / √[π₀(1−π₀)/n]',[
        `Define H₀: π=π₀ and Hₐ: π≠π₀. Expected null counts are ${(n*nullProportion).toFixed(2)} successes and ${(n*(1-nullProportion)).toFixed(2)} failures.`,
        'Calculate p̂=k/n, but use the null π₀ in the test SE.',
        'Choose α in advance. Calculate two-sided p=2Φ(−|z|) and compare the unrounded p with α.',
        'Non-rejection means insufficient evidence at that level; it does not prove equality.'
      ],'The course uses the normal approximation without a continuity correction. Keep proportions and p-values as decimals in the calculations.',topic);
    }
    if(n<30&&!normal)return unavailable('For a small-sample mean method, first justify a normal or approximately normal population and independence. If those conditions are not credible, this guide cannot recommend the course normal/t recipe.',topic);
    const symbol=known?'σ':'s',reference=known?'z(1−α/2)':'t(n−1, 1−α/2)';
    return response(known?'One mean · known-σ z method':'One mean · unknown-σ t method',goal==='interval'?`x̄ ± ${reference} ${symbol}/√n`:`${known?'z':'t'} = (x̄−μ₀) / (${symbol}/√n)`,[
      `Define the population mean μ and units. ${known?'Use the known population SD σ; take a square root if given a variance.':'Estimate σ with the adjusted sample SD s (STDEV.S), not STDEV.P.'}`,
      `Find SE=${symbol}/√n. ${known?'Use the standard-normal reference.':`Use Student’s t with df=${n-1}.`}`,
      goal==='interval'?`Choose confidence 1−α and the cumulative critical percentile 1−α/2. ${reference} supplies the critical value.`:`Specify H₀: μ=μ₀ and Hₐ: μ≠μ₀, choose α in advance, then calculate ${known?'p=2Φ(−|z|)':'p=T.DIST.2T(ABS(t),n−1)'}.`,
      'Report units, method and assumptions, then interpret the population parameter rather than individual patients.'
    ],n>=30?'n≥30 is a course CLT heuristic, not an assurance against skewness, heavy tails, dependence or biased sampling. Unknown σ uses t here; the course allows an approximate z replacement around n≥120.':'The small-sample calculation relies on the stated normal-population and independence assumptions.',topic);
  }
  function mountMethods(container) {
    container.innerHTML=`<div class="fs-card"><h3>Start with the target and design</h3><p>Select what the question asks you to estimate or test. This guide explains the course recipe after the design checks; it does not assess whether your real data satisfy the assumptions.</p><div class="fs-filter">
      <label for="fs-method-target">Target<select id="fs-method-target"><option value="mean">One population mean</option><option value="proportion">One population proportion</option><option value="two-means">Two independent population means</option><option value="paired">Repeated / paired measurements</option></select></label>
      <label for="fs-method-goal">Goal<select id="fs-method-goal"><option value="interval">Two-sided confidence interval</option><option value="test">Two-sided hypothesis test</option></select></label>
      <label for="fs-method-n">Sample size n<input id="fs-method-n" type="number" min="2" max="10000000" step="1" value="36"></label>
      <label for="fs-method-n2" id="fs-method-n2-wrap" hidden>Second sample size n₂<input id="fs-method-n2" type="number" min="2" max="10000000" step="1" value="40"></label>
      <label for="fs-method-k" id="fs-method-k-wrap" hidden>Observed successes k<input id="fs-method-k" type="number" min="0" step="1" value="20"></label>
      <label for="fs-method-null" id="fs-method-null-wrap" hidden>Null proportion π₀ (decimal)<input id="fs-method-null" type="number" min="0" max="1" step="any" value="0.5"></label></div>
      <label class="fund-check" id="fs-method-known-wrap"><input id="fs-method-known" type="checkbox">Population SD σ is known independently of this sample</label>
      <label class="fund-check"><input id="fs-method-independent" type="checkbox">The relevant observations are independent and the sampling design is suitable</label>
      <label class="fund-check" id="fs-method-normal-wrap"><input id="fs-method-normal" type="checkbox">A normal / approximately normal population is justified for this mean method</label>
      <p class="fs-meta">Check only conditions you can justify. A formula cannot verify sampling quality for you.</p></div><div id="fs-method-output" role="status" aria-live="polite" aria-atomic="true"></div>
      <div class="fs-card"><h3>A complete written answer follows a sequence</h3><ol class="fs-answer-sequence"><li><strong>Target:</strong> population, parameter and units</li><li><strong>Design:</strong> independence, sampling and relevant distribution/count checks</li><li><strong>Recipe:</strong> estimate, SE and reference distribution</li><li><strong>Calculation:</strong> confidence/α, substitution and unrounded result</li><li><strong>Interpretation:</strong> magnitude, uncertainty, decision and limits of the claim</li></ol><a href="#cases">Practise this sequence with a healthcare case →</a></div>`;
    const q=id=>container.querySelector('#'+id);
    function update() {
      const target=q('fs-method-target').value,goal=q('fs-method-goal').value;
      q('fs-method-known-wrap').hidden=target!=='mean';q('fs-method-normal-wrap').hidden=target!=='mean';
      q('fs-method-n2-wrap').hidden=target!=='two-means';q('fs-method-k-wrap').hidden=target!=='proportion';q('fs-method-null-wrap').hidden=target!=='proportion'||goal!=='test';
      const result=method({target,goal,known:q('fs-method-known').checked,n:q('fs-method-n').valueAsNumber,n2:q('fs-method-n2').valueAsNumber,k:q('fs-method-k').valueAsNumber,nullProportion:q('fs-method-null').valueAsNumber,independent:q('fs-method-independent').checked,normal:q('fs-method-normal').checked});
      q('fs-method-output').innerHTML=`<article class="fs-card fs-method-recipe"><p class="fs-kicker">${result.ready?'Course recipe · check the assumptions':'Design / model review'}</p><h3>${esc(result.title)}</h3>${result.formula?`<p class="formula">${esc(result.formula)}</p>`:''}<ol class="fs-answer-sequence">${result.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${result.warning?`<p class="fs-notice">${esc(result.warning)}</p>`:''}${result.topic?`<a href="lecture.html?topic=${encodeURIComponent(result.topic)}">Read the relevant topic guide →</a>`:''}</article>`;
    }
    container.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',update));
    container.querySelectorAll('input[type=number]').forEach(el=>el.addEventListener('input',update));update();
  }
  const api={KEY,grade,repair,countCorrect,method,mountCases,mountMethods};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.FundStudyPractice=api;
})(typeof window!=='undefined'?window:globalThis);
