// Original source-based lab and report guides. Only aggregate teaching summaries
// are published; official workbooks and answer keys remain on Virtuale.
(function (root) {
  'use strict';
  const KEY='fund-statistics.labs';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=x=>Number(x).toLocaleString('en-GB',{maximumFractionDigits:4});
  let memory=null;
  function repair(saved,guides) {
    const answers={};
    for(const g of guides)for(const q of g.questions) {
      const item=saved?.version===1?saved.answers?.[q.id]:null;
      const choice=Number.isInteger(item?.choice)&&item.choice>=0&&item.choice<q.options.length?item.choice:null;
      answers[q.id]={choice,checked:choice!==null&&item?.checked===true};
    }
    return {version:1,answers};
  }
  function countCorrect(state,guides) {
    return guides.reduce((total,g)=>total+g.questions.filter(q=>state.answers[q.id]?.checked&&state.answers[q.id].choice===q.answer).length,0);
  }
  function table(t) {
    return `<div class="table-wrap"><table><caption>${esc(t.title)}</caption><thead><tr>${t.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(row=>'<tr>'+row.map((c,i)=>i===0?`<th scope="row">${esc(c)}</th>`:`<td>${esc(c)}</td>`).join('')+'</tr>').join('')}</tbody></table></div>`;
  }
  // Dots and intervals, not bars: the axis limits and units remain visible.
  // A matching table provides exact values and a screen-reader alternative.
  function intervalPlot(rows,axis,selected=0) {
    const width=660,left=155,right=630,top=28,spacing=42,bottom=top+rows.length*spacing,height=bottom+55;
    const x=v=>left+(v-axis.min)/(axis.max-axis.min)*(right-left);
    const ticks=Array.from({length:5},(_,i)=>axis.min+(axis.max-axis.min)*i/4);
    return `<svg class="fs-interval-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="Point estimates and 95 percent confidence intervals. Axis: ${esc(axis.unit)}, from ${axis.min} to ${axis.max}. Exact values follow in the table.">${ticks.map(v=>`<path d="M${x(v)} ${top-14}V${bottom}" class="fs-plot-grid"/><text x="${x(v)}" y="${bottom+24}" text-anchor="middle">${esc(number(v))}</text>`).join('')}${rows.map((r,i)=>{const y=top+i*spacing+10;return `<g class="fs-plot-row ${i===selected?'fs-plot-selected':''}"><text x="${left-12}" y="${y+5}" text-anchor="end">${esc(r.label)}</text><path d="M${x(r.lower)} ${y}H${x(r.upper)}M${x(r.lower)} ${y-7}V${y+7}M${x(r.upper)} ${y-7}V${y+7}"/><circle cx="${x(r.estimate)}" cy="${y}" r="5"/></g>`;}).join('')}<text x="${(left+right)/2}" y="${height-5}" text-anchor="middle">${esc(axis.unit)}</text></svg>`;
  }
  function mount(container,data,topics,storage) {
    const guides=data.guides,saved=storage.read();
    memory=repair(saved||memory,guides);
    const requested=new URLSearchParams(location.search).get('guide');
    let selected=guides.find(g=>g.id===requested)||guides[0],category='all';
    function persist(activity=false){storage.save(memory,activity);}
    function remember() {
      const url=new URL(location.href);url.searchParams.set('guide',selected.id);
      history.replaceState(null,'',url.pathname+url.search+url.hash);
    }
    function draw() {
      const g=selected,visible=guides.filter(x=>category==='all'||x.category===category);
      container.innerHTML=`<div class="fs-practice-summary"><div><strong>7 lab guides · 4 report readers</strong><p>Work in Excel, interpret the result, then check your reasoning.</p></div><p id="fs-reading-progress" role="status"></p></div>
        <div class="fs-filter"><label for="fs-guide-category">Materials<select id="fs-guide-category"><option value="all">All labs and reports</option><option value="dataset" ${category==='dataset'?'selected':''}>Dataset labs</option><option value="report" ${category==='report'?'selected':''}>Published reports</option></select></label><label for="fs-guide-choice">Choose a guide<select id="fs-guide-choice">${visible.map(x=>`<option value="${x.id}" ${x.id===g.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select></label></div>
        <article class="fs-card fs-source-guide"><div class="fs-case-top"><span class="fs-tag">${g.category==='report'?'Read a published result':'Work with the source dataset'}</span><a href="${esc(g.url)}" target="_blank" rel="noopener">Open official source ↗</a></div><h3 id="fs-guide-title" tabindex="-1">${esc(g.title)}</h3><p class="fs-guide-goal">${esc(g.goal)}</p><p class="fs-notice"><strong>Unit &amp; target:</strong> ${esc(g.unit)}</p>
        <ol class="fs-solution-steps">${g.steps.map((s,i)=>`<li><span class="fs-step-label">Step ${i+1}</span><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></li>`).join('')}</ol>
        ${g.comparison?'<section class="fs-source-explorer"><h4>Inspect the effect of flagged values</h4><label for="fs-oecd-variable">Variable<select id="fs-oecd-variable">'+g.comparison.map((v,i)=>`<option value="${i}">${esc(v.variable)}</option>`).join('')+'</select></label><div id="fs-oecd-comparison" aria-live="polite"></div></section>':''}
        ${g.confidenceExplorer?'<section class="fs-source-explorer"><h4>Change the confidence level</h4><p>The same sample mean stays fixed; the critical value changes the margin of error. The lab requests 90%.</p><div class="fs-filter"><label for="fs-food-variable">Expense<select id="fs-food-variable">'+g.confidenceExplorer.map((v,i)=>`<option value="${i}">${esc(v.label)}</option>`).join('')+'</select></label><label for="fs-food-confidence">Confidence<select id="fs-food-confidence"><option value=".9">90% (lab task)</option><option value=".95">95%</option><option value=".99">99%</option></select></label></div><div id="fs-food-result" aria-live="polite"></div></section>':''}
        ${g.intervals?'<section class="fs-source-explorer"><h4>Read a point and its interval</h4><label for="fs-report-row">Inspect a row<select id="fs-report-row">'+g.intervals.map((r,i)=>`<option value="${i}">${esc(r.label)}</option>`).join('')+'</select></label><figure id="fs-report-chart"></figure><div id="fs-report-meaning" class="fs-feedback" aria-live="polite"></div>'+table({title:'Published 95% confidence intervals — '+g.axis.unit,headers:['Row','Estimate',...(g.intervals[0].se!==undefined?['SE']:[]),'Lower','Upper'],rows:g.intervals.map(r=>[r.label,number(r.estimate),...(r.se!==undefined?[number(r.se)]:[]),number(r.lower),number(r.upper)])})+'</section>':''}
        ${g.tables.map(table).join('')}
        ${g.formulas.length?table({title:'Excel workflow — English syntax; replace explanatory text by your calculated cell references',headers:['Goal / range','Expression'],rows:g.formulas.map(f=>[f.label,f.formula])}):''}
        <details class="fs-guide-cautions" open><summary>Checks that change the interpretation</summary><ul>${g.cautions.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details>
        <section class="fs-reading-checks"><h4>Check your reasoning</h4><p>Two original review questions for this guide. Your choices and checked answers share the study-progress backup on the Notes page.</p>${g.questions.map((q,i)=>{const s=memory.answers[q.id];return `<fieldset class="fs-reading-question study-question"><legend class="sr-only">Question ${i+1}. ${esc(q.prompt)}</legend><div class="study-question-header" aria-hidden="true"><span class="study-question-number">${String(i+1).padStart(2,'0')}</span><span class="study-question-prompt">${esc(q.prompt)}</span></div><p class="study-question-kind">Reading check · Choose one answer</p><div class="fs-mock-options fs-reading-options">${q.options.map((o,j)=>`<label for="fs-reading-${i}-${j}"><input type="radio" id="fs-reading-${i}-${j}" name="fs-reading-${i}" value="${j}" ${s.choice===j?'checked':''}><span class="study-option-letter">${String.fromCharCode(65+j)}</span><span class="study-option-text">${esc(o)}</span></label>`).join('')}</div><button type="button" class="fs-button" data-reading-check="${i}">Check reasoning ${i+1}</button><p id="fs-reading-feedback-${i}" class="fs-case-feedback study-feedback" role="status"></p></fieldset>`;}).join('')}</section>
        <details class="fs-guide-citation"><summary>Files and source locations</summary><ul>${g.files.map(f=>`<li>${esc(f)}</li>`).join('')}</ul><p>${esc(g.citation)}</p><p>Original study explanations and independently checked aggregate summaries. Official teaching files remain on Virtuale. Report plots redraw only the selected numerical rows.</p></details>
        <div class="fs-guide-links">${g.topics.map(id=>`<a href="lecture.html?topic=${encodeURIComponent(id)}">${esc(topics.find(t=>t.id===id)?.title||id)} →</a>`).join('')}${g.experiment?`<a href="fund-statistics.html?lab=${g.experiment}#explore">Explore the exact sampling distribution →</a>`:''}</div></article><button class="fs-button fs-secondary" type="button" id="fs-guide-next">Next guide →</button>`;
      const $=selector=>container.querySelector(selector);
      const progress=()=>{$('#fs-reading-progress').textContent=`${countCorrect(memory,guides)} / ${guides.length*2} reading checks correct`;};
      function feedback(i) {
        const q=g.questions[i],s=memory.answers[q.id],el=$('#fs-reading-feedback-'+i);
        el.dataset.result=s.checked?(s.choice===q.answer?'correct':'revisit'):'unchecked';
        container.querySelectorAll(`input[name="fs-reading-${i}"]`).forEach(input=>{
          const label=input.closest('label'),choice=Number(input.value);
          label.classList.toggle('fs-correct',s.checked&&choice===q.answer);
          label.classList.toggle('fs-incorrect',s.checked&&choice===s.choice&&choice!==q.answer);
        });
        el.textContent=s.checked?`${s.choice===q.answer?'✓ Correct.':'Revisit your reasoning.'} ${q.explanation}`:'';
      }
      g.questions.forEach((q,i)=>{
        feedback(i);
        container.querySelectorAll(`input[name="fs-reading-${i}"]`).forEach(input=>input.addEventListener('change',()=>{memory.answers[q.id]={choice:Number(input.value),checked:false};feedback(i);progress();persist();}));
        $(`[data-reading-check="${i}"]`).addEventListener('click',()=>{
          if(memory.answers[q.id].choice===null){$('#fs-reading-feedback-'+i).textContent='Choose an answer first.';return;}
          memory.answers[q.id].checked=true;feedback(i);progress();persist(true);
        });
      });
      if(g.comparison) {
        function compare() {
          const v=g.comparison[Number($('#fs-oecd-variable').value)],f=v.filtered;
          $('#fs-oecd-comparison').innerHTML=table({title:`${v.variable} — ${v.unit}; SD uses n in both rows`,headers:['Calculation','n','Mean','Median','SDₙ'],rows:[['All observed values',v.n,number(v.mean),number(v.median),number(v.sdN)],['Inside the original inclusive fences',f.n,number(f.mean),number(f.median),number(f.sdN)]]})+`<p><strong>Fences:</strong> [${number(v.lowerFence)}, ${number(v.upperFence)}]. <strong>Flagged:</strong> ${esc(v.outliers.join(', ')||'None')}.</p><p class="fs-meta">This comparison excludes individual values for this variable using the full-data fences once. It does not remove whole countries or recalculate fences repeatedly. Investigate before choosing exclusions.</p>`;
        }
        $('#fs-oecd-variable').addEventListener('change',compare);compare();
      }
      if(g.confidenceExplorer) {
        function confidence() {
          const v=g.confidenceExplorer[Number($('#fs-food-variable').value)],level=Number($('#fs-food-confidence').value);
          const r=root.FundStatsMath.interval({mode:'unknown',n:v.n,mean:v.mean,sd:v.sdAdjusted,confidence:level});
          $('#fs-food-result').innerHTML=`<p><strong>${level*100}% ${r.method} for ${esc(v.label.toLowerCase())}:</strong> [${number(r.lower)}, ${number(r.upper)}] £.</p><dl class="fs-stats"><div><dt>Estimate (£)</dt><dd>${number(r.estimate)}</dd></div><div><dt>SE (£)</dt><dd>${number(r.se)}</dd></div><div><dt>Critical t, df=49</dt><dd>${number(r.critical)}</dd></div><div><dt>Margin (£)</dt><dd>${number(r.margin)}</dd></div></dl><p class="fs-meta">A population-mean interval under the lab’s random-sampling assumption, using a large-sample t approximation for the skewed data. Wider confidence does not change the observed sample or estimate.</p>`;
        }
        $('#fs-food-variable').addEventListener('change',confidence);$('#fs-food-confidence').addEventListener('change',confidence);confidence();
      }
      if(g.intervals) {
        function report() {
          const index=Number($('#fs-report-row').value),r=g.intervals[index];
          $('#fs-report-chart').innerHTML=intervalPlot(g.intervals,g.axis,index)+`<figcaption>${esc(g.intervalNote)}</figcaption>`;
          if(!$('#fs-chart-hint'))$('#fs-report-chart').insertAdjacentHTML('afterend','<p class="fs-chart-hint" id="fs-chart-hint">Scroll the chart sideways to see the full axis. The table below gives the exact values.</p>');
          $('#fs-report-meaning').innerHTML=`<strong>${esc(r.label)}:</strong> ${esc(r.meaning)} <p class="fs-meta">The dot is the estimate. The line is a reported 95% confidence interval for the population quantity; it does not describe the spread of individual observations.</p>`;
        }
        $('#fs-report-row').addEventListener('change',report);report();
      }
      $('#fs-guide-category').addEventListener('change',event=>{category=event.target.value;if(category!=='all'&&selected.category!==category)selected=guides.find(x=>x.category===category);remember();draw();});
      $('#fs-guide-choice').addEventListener('change',event=>{selected=guides.find(x=>x.id===event.target.value);remember();draw();});
      $('#fs-guide-next').addEventListener('click',()=>{selected=visible[(visible.indexOf(selected)+1)%visible.length];remember();draw();$('#fs-guide-title').focus({preventScroll:true});container.scrollIntoView({block:'start',behavior:'instant'});});
      progress();
    }
    draw();
  }
  const api={KEY,repair,countCorrect,intervalPlot,mount};
  root.FundStudyLabs=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
