// One workspace for Sara Capacci's module. Uses the existing Notes progress and cards.
(function () {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const views=['learn','lab-guides','cases','methods','cards','explore','mock','reference','sources'];
  const titles={learn:'Your topic pathway',cases:'Solve it. Then explain it.',methods:'Choose the method from the question',cards:'Make the concepts stick',explore:'Change a number. See the idea.',mock:'Practise the exam format',reference:'Keep the essentials together',sources:'The materials behind your study guides'};
  const intros={learn:'Six syllabus topics across 11 lectures and four exercise sessions. Each guide connects explanations, comparisons, experiments, two worked cases and 15 original questions.',cases:'Twelve original cases connect calculations with healthcare interpretation. Use hints, check your numbers, then compare your explanation with the worked solution and rubric.',methods:'Identify the parameter, goal and design before selecting a formula. This interactive guide covers the course mean, proportion and independent-group recipes.',cards:'Recall before you reveal. Review due cards with the same schedule used in your course Notes page.',explore:'Use original examples to investigate descriptive statistics, probability, sampling, confidence intervals and tests.',mock:'An original 90-minute rehearsal with six questions, two output interpretations and two applied tasks. It is separate from the teacher’s mock paper.',reference:'Original summaries of notation, method selection and Excel functions. Open the teacher’s printed-reference files to practise using what is permitted in the exam.',sources:'Supplied workbooks, lab tasks and answers have been checked. Report methods and key tables have been reviewed from full-text extraction, including repeated-copy checks. Official files are linked on Virtuale; the explanations and questions here are original student material.'};
  const MOCK_KEY='euhem-fund-mock-v1';
  titles['lab-guides']='Work with data. Read the evidence.';
  intros['lab-guides']='Seven dataset workflows and four report readers connect the supplied files with the six topics. Inspect checked calculations, follow Excel ranges, read interactive interval charts and answer 22 original review questions.';
  let data, moduleData, study, sourceReview, extension, practical, active='learn', lab='fund-descriptive', mock=null, mockStorage=true;
  const mockQuestionIds=['012','026','040','053','074','088'].map(id=>'fund-statistics.q.'+id);
  const interpretations=[
    {title:'Two groups, one reported contrast',html:'<p>An observational study compares independent groups. Group 1: n=160, mean=125 mmHg, adjusted SD=12. Group 2: n=180, mean=129 mmHg, adjusted SD=15.</p><div class="table-wrap"><table><thead><tr><th>Contrast</th><th>SE</th><th>z</th><th>Two-sided p</th><th>95% CI</th></tr></thead><tbody><tr><td>Group 1 − group 2: −4 mmHg</td><td>1.4663</td><td>−2.7280</td><td>0.00637</td><td>[−6.8739, −1.1261] mmHg</td></tr></tbody></table></div><p>Interpret the direction, decision at 5%, confidence interval and limits of the study design.</p>',answer:'Group 1 has an estimated population mean 4 mmHg lower than group 2. Reject H₀: μ₁−μ₂=0 at 5% (p≈0.00637). The interval estimates a difference from approximately −6.87 to −1.13 mmHg. It excludes zero. Observational group differences alone do not establish causation or clinical importance.',rubric:['Names the contrast and interprets the −4 mmHg direction and units','Rejects at 5% and interprets the CI as uncertainty about the population mean difference','Mentions observational design/confounding and distinguishes statistical from clinical importance']},
    {title:'A confidence interval in a report',html:'<p>A random sample of 400 independent eligible adults includes 248 who support a proposed health programme. A report gives p̂=0.62 and a 95% Wald confidence interval of approximately [0.572, 0.668].</p><p>Explain the target population quantity and the confidence level. Give one claim this interval cannot support.</p>',answer:'The estimated proportion of eligible adults supporting the programme is 62%; the approximate interval for that population proportion is 57.2%–66.8%. In repeated sampling, about 95% of intervals produced by this procedure would cover the fixed population proportion under the assumptions. It does not describe 95% of individuals or assign a frequentist 95% probability to the fixed parameter in this realised interval.',rubric:['Identifies the population proportion and estimates 62%, with endpoints about 57.2%–66.8%','Explains confidence through repeated-sampling coverage','Rejects an individual-level interpretation or a probability claim about the fixed realised parameter']}
  ];
  const applied=[
    {title:'A mean interval and test using Excel',html:'<p>Illustrative baseline heart rates (bpm): <strong>68, 70, 72, 74, 76, 78, 80, 82</strong>. Assume independent observations from an approximately normal population with unknown variance.</p><p>Use Excel to find the mean, a 95% t confidence interval and the two-sided t statistic for H₀: μ=70 bpm. Explain your test decision in a Word-style answer.</p><a class="fs-button fs-secondary" href="content/modules/fund-statistics/practice-heart-rates.csv" download>Download original practice CSV ↓</a>',fields:[['Sample mean (bpm)',75,.01],['95% CI lower endpoint (bpm)',70.9043506554,.02],['95% CI upper endpoint (bpm)',79.0956493446,.02],['Observed t statistic',2.88675134595,.02]],answer:'n=8; mean=75; adjusted SD=4.89898; SE=1.73205; df=7; t critical≈2.36462. The 95% interval is [70.90435,79.09565] bpm. t=(75−70)/1.73205≈2.88675, two-sided p≈0.02342. Reject at 5%; the data support a population mean different from (and estimated above) 70 bpm under the stated model.',excel:'=AVERAGE(A2:A9); =STDEV.S(A2:A9)/SQRT(COUNT(A2:A9)); =T.INV(0.975,7); =T.DIST.2T(ABS(t),7)',rubric:'States the two-sided hypotheses and rejects at 5%, with a population-level conclusion and the normality/independence assumptions'},
    {title:'A proportion test using Excel',html:'<p>A sample of <strong>200 independent adults</strong> contains <strong>120 successes</strong>. Test H₀: π=0.50 against Hₐ: π≠0.50 at 5% using the course normal approximation.</p><p>Check expected counts under H₀, calculate the quantities below and write a conclusion. Use the null proportion in the test SE.</p>',fields:[['Observed proportion p̂',.6,.0005],['Null-based standard error',.0353553390593,.00005],['Observed z statistic',2.82842712475,.005],['Two-sided p-value',.00467773498105,.0001]],answer:'p̂=120/200=0.60. Expected null successes and failures are 100 each. SE₀=√(0.50×0.50/200)=0.03535534. z≈2.82843 and p≈0.0046777. Reject at 5%; evidence that the population proportion differs from 0.50, with an observed estimate above it. This test does not establish a causal effect.',excel:'=120/200; =SQRT(0.5*(1-0.5)/200); =(0.6-0.5)/SE; =2*NORM.S.DIST(-ABS(z),TRUE)',rubric:'Checks the null expected counts and rejects at 5%, with a population-proportion conclusion and the independence assumption'}
  ];
  function header(key) { return `<div class="fs-heading"><div><p class="fs-kicker">Fundamentals / ${esc(key)}</p><h2 id="fs-view-title" tabindex="-1">${titles[key]}</h2><p>${intros[key]}</p></div></div>`; }
  function link(topic,hash='') { return 'lecture.html?topic='+encodeURIComponent(topic)+hash; }
  function saveMock() { try { sessionStorage.setItem(MOCK_KEY,JSON.stringify(mock)); } catch (_) { mockStorage=false; } }
  function restoreMock() {
    try {
      const value=JSON.parse(sessionStorage.getItem(MOCK_KEY)||'null');
      if(value&&value.version===1&&Number.isFinite(value.started)&&Number.isFinite(value.deadline)&&value.deadline-value.started===5400000&&typeof value.finished==='boolean'&&Array.isArray(value.mcq)&&value.mcq.length===6&&value.mcq.every(x=>x===null||Number.isInteger(x)&&x>=0&&x<4)&&Array.isArray(value.text)&&value.text.length===4&&value.text.every(x=>typeof x==='string'&&x.length<=10000)&&Array.isArray(value.numbers)&&value.numbers.length===2&&value.numbers.every(x=>Array.isArray(x)&&x.length===4&&x.every(s=>typeof s==='string'&&s.length<=100))&&Array.isArray(value.rubric)&&value.rubric.length===8&&value.rubric.every(x=>typeof x==='boolean')) mock=value;
    } catch (_) { mockStorage=false; }
  }
  function lessons() {
    const progress=loadProgress();
    const checked=study.lessons.reduce((a,l)=>a+(progress.lectures[l.topic]?.checked||[]).filter(Boolean).length,0);
    const due=dueCards(progress,moduleData.flashcards,todayKey()).length;
    let html=header('learn')+`<dl class="fs-stats"><div><dt>Questions checked in the topic quizzes</dt><dd>${checked} / 90</dd></div><div><dt>Flashcards due today</dt><dd>${due}</dd></div><div><dt>Official exercise book</dt><dd>64 exercises</dd></div></dl><div class="fs-grid">`;
    for(const l of study.lessons) {
      const count=(progress.lectures[l.topic]?.checked||[]).filter(Boolean).length;
      const cards=moduleData.flashcards.filter(c=>c.topic===l.topic).length;
      const firstCase=extension?.cases.find(c=>c.topic===l.topic);
      html+=`<article class="fs-card"><div class="fs-topic-top"><span class="fs-number">${String(l.number).padStart(2,'0')}</span><span class="fs-tag ${!l.slides?'fs-pending':''}">${!l.slides?'Slides pending':l.number===6?'Additional topic, time permitting':l.slides+' slides reviewed'}</span></div><h3>${esc(l.title)}</h3><p>${esc(l.intro)}</p><ul>${l.outcomes.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul><p class="fs-meta">Exercise Book: ${esc(l.exercises)} · 15 original questions · ${cards} cards${firstCase?' · 2 worked cases':''}</p><progress max="15" value="${count}" aria-label="${count} of 15 questions checked in Topic ${l.number}"></progress><p class="fs-meta">${count}/15 questions checked</p><div class="button-row"><a class="fs-button" href="${link(l.topic)}">Open topic guide →</a><a class="fs-button fs-secondary" href="${link(l.topic,'#practice')}">Practise</a><a href="fund-statistics.html?guide=${practical?.guides.find(g=>g.topics.includes(l.topic))?.id||'oecd-lab'}#lab-guides">Apply it in a lab or report →</a>${firstCase?`<a href="fund-statistics.html?case=${firstCase.id}#cases">Work a case →</a>`:''}</div></article>`;
    }
    return html+'</div><p class="fs-notice">All six topic slide decks have been reviewed. Topics describe syllabus sections, not individual class dates. The Materials &amp; review tab lists other referenced resources that have not yet been supplied.</p>';
  }
  function cards() {
    $('fs-view').innerHTML=header('cards');
    const ctx={course:moduleData,params:{},topicTitle:id=>moduleData.topics.find(t=>t.id===id)?.title||id,topicLink:id=>{const a=createElement('a',null,moduleData.topics.find(t=>t.id===id)?.title||id);a.href=link(id);return a;}};
    $('fs-view').appendChild(flashcardSection(ctx));
  }
  function cases() {
    $('fs-view').innerHTML=header('cases')+'<div id="fs-case-workspace"></div>';
    if(!extension){$('fs-case-workspace').textContent='The extended cases are unavailable in this saved copy. Reconnect and refresh to load them.';return;}
    FundStudyPractice.mountCases($('fs-case-workspace'),extension,study.lessons,{
      read:()=>loadProgress().statistics[FundStudyPractice.KEY],
      save:(value,activity)=>{
        const progress=loadProgress();progress.statistics[FundStudyPractice.KEY]=value;
        if(activity)recordActivity(progress,todayKey());
        if(!saveProgress(progress))$('fs-storage-warning').hidden=false;
      }
    });
  }
  function methods() {
    $('fs-view').innerHTML=header('methods')+'<div id="fs-method-workspace"></div>';
    FundStudyPractice.mountMethods($('fs-method-workspace'));
  }
  function labGuides() {
    $('fs-view').innerHTML=header('lab-guides')+'<div id="fs-guide-workspace"></div>';
    if(!practical){$('fs-guide-workspace').textContent='These guides are unavailable in this saved copy. Reconnect and refresh to load them.';return;}
    FundStudyLabs.mount($('fs-guide-workspace'),practical,moduleData.topics,{
      read:()=>loadProgress().statistics[FundStudyLabs.KEY],
      save:(value,activity)=>{
        const progress=loadProgress();progress.statistics[FundStudyLabs.KEY]=value;
        if(activity)recordActivity(progress,todayKey());
        if(!saveProgress(progress))$('fs-storage-warning').hidden=false;
      }
    });
  }
  function explore() {
    const options=[['fund-descriptive','1 · Centre, spread and box plot'],['normal-distribution','2 · Normal probabilities'],['fund-table','2 · Cumulative normal table'],['fund-sampling','3 · Exact sampling distributions'],['fund-confidence','4 · Mean and proportion confidence intervals'],['hypothesis-test','5 · One population mean test'],['fund-evidence','5 · P-value versus α: compare both tail areas'],['fund-proportion-test','5 · One population proportion test'],['fund-two-means','6 · Two independent means']];
    $('fs-view').innerHTML=header('explore')+`<div class="fs-filter"><label for="fs-lab-choice">Choose an experiment<select id="fs-lab-choice">${options.map(([id,label])=>`<option value="${id}" ${id===lab?'selected':''}>${label}</option>`).join('')}</select></label></div><div id="fs-lab"></div>`;
    LectureActivities.init($('fs-lab'),[lab]);
    $('fs-lab-choice').addEventListener('change',event=>{lab=event.target.value;LectureActivities.init($('fs-lab'),[lab]);});
  }
  function examRules() {
    const exam=study.exam;
    return `<details class="fs-card"><summary>Official exam structure, dates and permitted materials</summary><p>${exam.minutes} minutes. Pass mark ${esc(exam.passMark)}. Register using <a href="https://almaesami.unibo.it/">AlmaEsami ↗</a>.</p><div class="table-wrap"><table><thead><tr><th>Part</th><th>Weight</th></tr></thead><tbody>${exam.sections.map(s=>`<tr><td>${esc(s.label)}</td><td>${s.weight}%</td></tr>`).join('')}</tbody></table></div><div class="fs-grid"><div><h3>Permitted</h3><ul>${exam.permitted.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></div><div><h3>Not permitted during the exam</h3><ul>${exam.prohibited.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></div></div><div class="table-wrap"><table><caption>Dates in Europe/Rome, from the supplied course notice</caption><thead><tr><th>Date</th><th>Time</th><th>Location</th></tr></thead><tbody>${exam.dates.map(d=>`<tr><td>${new Date(d.date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Rome'})}</td><td>${esc(d.time)}</td><td>${esc(d.place)}</td></tr>`).join('')}</tbody></table></div><ul>${exam.notes.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul><p class="fs-meta">${esc(exam.source)}</p></details>`;
  }
  function startMock() {
    const started=Date.now();
    mock={version:1,started,deadline:started+5400000,finished:false,mcq:Array(6).fill(null),text:Array(4).fill(''),numbers:[Array(4).fill(''),Array(4).fill('')],rubric:Array(8).fill(false)};
    saveMock();renderMock();$('fs-mock-top')?.focus();
  }
  function finishMock(expired=false) {
    if(!mock||mock.finished)return;
    mock.finished=true;mock.expired=expired;saveMock();
    if(active==='mock'){renderMock();$('fs-score')?.focus();}
  }
  function numericCorrect(a,j) {
    const text=mock.numbers[a][j].trim(),expected=applied[a].fields[j];
    return text!==''&&Number.isFinite(Number(text))&&Math.abs(Number(text)-expected[1])<=expected[2];
  }
  function updateScore() {
    if(!mock?.finished)return;
    const correct=mockQuestionIds.filter((id,i)=>mock.mcq[i]===moduleData.questions.find(q=>q.id===id).answer.charCodeAt(0)-65).length;
    const manual=mock.rubric.slice(0,6).filter(Boolean).length;
    const numerical=applied.reduce((s,a,i)=>s+a.fields.filter((_,j)=>numericCorrect(i,j)).length,0);
    const appliedPoints=numerical+mock.rubric.slice(6).filter(Boolean).length;
    const weighted=35*correct/6+30*manual/6+35*appliedPoints/10;
    $('fs-score').innerHTML=`<p class="fs-kicker">Practice review ${mock.expired?'· time ended':''}</p><h3>MCQs: ${correct}/6 · Calculations: ${numerical}/8</h3><p>Self-assessment: ${manual}/6 interpretation criteria and ${mock.rubric.slice(6).filter(Boolean).length}/2 applied conclusions.</p><p><strong>Weighted practice indicator: ${(weighted*.3).toFixed(1)}/30</strong></p><p class="fs-meta">This combines automatic numerical checks and your rubric ticks, using 35% / 30% / 35%. It is a learning indicator, not an official grade or exam prediction. Unticked criteria count as zero.</p>`;
  }
  function renderMock() {
    if(mock&&!mock.finished&&Date.now()>=mock.deadline) {mock.finished=true;mock.expired=true;saveMock();}
    let html=header('mock')+examRules();
    if(!mock) {
      $('fs-view').innerHTML=html+'<article class="fs-card"><h3>A full-format practice session</h3><p>6 multiple-choice questions (35%), 2 written interpretations (30%), and 2 applied tasks (35%). Feedback stays hidden until you finish or the timer ends. Interpretations and written conclusions are self-assessed with a rubric.</p><p>Use Excel and practise writing equations and conclusions in Word. Topic 6 is included as extra practice; confirm its assessed scope with the teacher.</p><p class="fs-meta">Mock answers remain in this tab and survive refresh when session storage is available. They are separate from the Notes progress backup. The timer continues while you visit another tab or study view.</p><button type="button" class="fs-button" id="fs-start-mock">Start 90-minute mock →</button></article>';
      $('fs-start-mock').addEventListener('click',startMock);return;
    }
    html+=`<div class="fs-mock-toolbar" id="fs-mock-top" tabindex="-1"><div><p class="fs-meta">${mock.finished?'Session submitted':'Time remaining · answers editable until submission'}</p><output class="fs-timer" id="fs-timer" aria-label="Time remaining"></output></div><div class="button-row">${mock.finished?'<button class="fs-button fs-secondary" id="fs-new-mock" type="button">Start another session</button>':'<button class="fs-button" id="fs-finish-mock" type="button">Submit &amp; review</button>'}</div></div>${!mockStorage?'<p class="fs-notice">Session storage is unavailable. Keep this page open; a refresh will lose this mock.</p>':''}${mock.finished?'<div class="fs-card" id="fs-score" tabindex="-1" role="status"></div>':''}<h3>Part A · Six questions · 35%</h3>`;
    mockQuestionIds.forEach((id,i)=>{
      const q=moduleData.questions.find(q=>q.id===id),correct=q.answer.charCodeAt(0)-65;
      html+=`<article class="fs-card fs-mock-question"><p class="fs-meta">Question ${i+1} / 10 · ${esc(q.category)}</p><h3 id="fs-mcq-${i}">${esc(q.question)}</h3><div class="fs-mock-options" role="radiogroup" aria-labelledby="fs-mcq-${i}">${q.options.map((o,j)=>`<label class="${mock.finished&&j===correct?'fs-correct':''}"><input type="radio" name="fs-answer-${i}" value="${j}" data-mcq="${i}" ${mock.mcq[i]===j?'checked':''} ${mock.finished?'disabled':''}><span>${String.fromCharCode(65+j)}. ${esc(o)}</span></label>`).join('')}</div>${mock.finished?`<div class="fs-feedback"><p><strong>${mock.mcq[i]===correct?'Correct.':mock.mcq[i]===null?'Unanswered.':'Revisit this idea.'}</strong> Answer: ${q.answer}.</p><p>${esc(q.explanation)}</p><a href="${link(q.topic)}">Return to this topic →</a></div>`:''}</article>`;
    });
    html+='<h3>Part B · Interpret two outputs · 30%</h3>';
    interpretations.forEach((item,i)=>{
      html+=`<article class="fs-card"><p class="fs-meta">Question ${i+7} / 10</p><h3>${item.title}</h3>${item.html}<label for="fs-text-${i}">Your interpretation<textarea id="fs-text-${i}" rows="5" maxlength="10000" data-text="${i}" ${mock.finished?'readonly':''}>${esc(mock.text[i])}</textarea></label>${mock.finished?`<div class="fs-feedback"><h4>Model interpretation</h4><p>${esc(item.answer)}</p></div><div class="fs-rubric"><h4>Tick only the points your answer includes</h4>${item.rubric.map((r,j)=>`<label class="fund-check"><input type="checkbox" data-rubric="${i*3+j}" ${mock.rubric[i*3+j]?'checked':''}> ${esc(r)}</label>`).join('')}</div>`:''}</article>`;
    });
    html+='<h3>Part C · Two applied tasks · 35%</h3>';
    applied.forEach((item,i)=>{
      html+=`<article class="fs-card"><p class="fs-meta">Question ${i+9} / 10 · Original illustrative data</p><h3>${item.title}</h3>${item.html}<div class="activity-controls">${item.fields.map(([label,value,tolerance],j)=>`<label for="fs-num-${i}-${j}">${esc(label)}<input id="fs-num-${i}-${j}" type="number" step="any" data-applied="${i}" data-field="${j}" value="${esc(mock.numbers[i][j])}" ${mock.finished?'readonly':''}>${mock.finished?`<span class="fs-meta">${numericCorrect(i,j)?'✓ Correct within rounding tolerance':'Expected '+value.toPrecision(6)+' (tolerance ±'+tolerance+')'}</span>`:''}</label>`).join('')}</div><label for="fs-text-${i+2}">Your hypotheses, method and conclusion<textarea id="fs-text-${i+2}" rows="4" maxlength="10000" data-text="${i+2}" ${mock.finished?'readonly':''}>${esc(mock.text[i+2])}</textarea></label>${mock.finished?`<div class="fs-feedback"><h4>Worked answer</h4><p>${esc(item.answer)}</p><p><strong>Excel:</strong> ${esc(item.excel)}</p></div><div class="fs-rubric"><label class="fund-check"><input type="checkbox" data-rubric="${i+6}" ${mock.rubric[i+6]?'checked':''}> ${esc(item.rubric)}</label></div>`:''}</article>`;
    });
    if(!mock.finished)html+='<button class="fs-button" id="fs-finish-bottom" type="button">Submit &amp; review all ten questions →</button><p class="fs-meta">Unanswered items receive zero. Answers and model solutions appear after submission.</p>';
    $('fs-view').innerHTML=html;
    $('fs-view').querySelectorAll('[data-mcq]').forEach(el=>el.addEventListener('change',()=>{if(mock.finished)return;mock.mcq[Number(el.dataset.mcq)]=Number(el.value);saveMock();}));
    $('fs-view').querySelectorAll('[data-text]').forEach(el=>el.addEventListener('input',()=>{if(mock.finished)return;mock.text[Number(el.dataset.text)]=el.value;saveMock();}));
    $('fs-view').querySelectorAll('[data-applied]').forEach(el=>el.addEventListener('input',()=>{if(mock.finished)return;mock.numbers[Number(el.dataset.applied)][Number(el.dataset.field)]=el.value;saveMock();}));
    $('fs-view').querySelectorAll('[data-rubric]').forEach(el=>el.addEventListener('change',()=>{mock.rubric[Number(el.dataset.rubric)]=el.checked;saveMock();updateScore();}));
    for(const id of ['fs-finish-mock','fs-finish-bottom'])$(id)?.addEventListener('click',()=>finishMock());
    $('fs-new-mock')?.addEventListener('click',startMock);
    updateScore();tick();
  }
  function tick() {
    if(!mock)return;
    const left=Math.max(0,Math.ceil((mock.deadline-Date.now())/1000));
    if($('fs-timer'))$('fs-timer').textContent=mock.finished?'Finished':`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
    if(!mock.finished&&left===0)finishMock(true);
  }
  function reference() {
    const formulas=[['Describe the observed data','Vₙ = Σ(xᵢ−x̄)²/n; SDₙ = √Vₙ','VAR.P / STDEV.P describe the entered observations using n.'],['Estimate population variance','S² = Σ(xᵢ−x̄)²/(n−1); s = √S²','VAR.S / STDEV.S use n−1. S² is unbiased for σ² under independent sampling; s is generally biased for σ.'],['Mean SE','SE(x̄) = σ/√n, or estimated s/√n','SE measures the variability of sample means, whereas SD measures individual spread.'],['Mean confidence interval','x̄ ± critical × SD/√n','Known σ: z. Unknown σ: t with n−1 df. Check model and independence.'],['Proportion confidence interval','p̂ ± z × √[p̂(1−p̂)/n]','Wald approximation: check observed success/failure counts.'],['One-mean test','(x̄−μ₀)/(SD/√n)','Known σ: z. Unknown σ: t under the normal model.'],['One-proportion test','(p̂−π₀)/√[π₀(1−π₀)/n]','The test SE uses the null proportion; check expected counts under H₀.'],['Two independent means','(x̄₁−x̄₂)/√(s₁²/n₁+s₂²/n₂)','Course main calculation: a large-sample normal approximation. Paired data require a different analysis.']];
    let html=header('reference')+'<div class="fs-card"><h3>Choose the method before calculating</h3><div class="table-wrap"><table><thead><tr><th>Target</th><th>Conditions</th><th>Reference</th></tr></thead><tbody><tr><td>One mean, σ known</td><td>Normal population, or suitable large-sample approximation</td><td>z</td></tr><tr><td>One mean, σ unknown</td><td>Normal population for exact t; check large-sample adequacy otherwise</td><td>t, df=n−1</td></tr><tr><td>One proportion</td><td>Independent binary observations; adequate counts</td><td>Normal approximation</td></tr><tr><td>Two independent means</td><td>Large independent samples; adjusted SDs</td><td>Course normal approximation</td></tr><tr><td>Before/after on the same people</td><td>Analyse within-person differences</td><td>Paired method (illustrative in Topic 6)</td></tr></tbody></table></div><p>The course uses n≥30 as a CLT heuristic and approximately n≥120 for replacing t by z. Neither boundary removes the need to check the data. At n=120, t avoids inconsistent source conventions and remains appropriate under normal sampling.</p></div><div class="fs-grid">';
    for(const [name,formula,note] of formulas)html+=`<article class="fs-card"><h3>${name}</h3><p class="formula">${formula}</p><p>${note}</p></article>`;
    html+='</div><div class="fs-card"><h3>Read the symbols</h3><div class="table-wrap"><table><thead><tr><th>Symbol</th><th>Meaning</th></tr></thead><tbody><tr><td>μ, σ², π</td><td>Fixed population mean, variance and proportion</td></tr><tr><td>Xᵢ / xᵢ</td><td>Random observation before sampling / realised observed value</td></tr><tr><td>X̄ / x̄</td><td>Random estimator / realised estimate of a population mean</td></tr><tr><td>S² / s²</td><td>Adjusted variance estimator / its observed estimate</td></tr><tr><td>E(X), Var(X)</td><td>Expected value and variance of a random variable</td></tr><tr><td>Σxᵢ² / (Σxᵢ)²</td><td>Sum of squared observations / square of their sum: different quantities</td></tr><tr><td>α / 1−α / β / 1−β</td><td>Significance / confidence / Type II error / power</td></tr></tbody></table></div></div><div class="fs-card"><h3>Excel for this course</h3><div class="table-wrap"><table><thead><tr><th>Goal</th><th>Functions / expression</th><th>Check</th></tr></thead><tbody><tr><td>Count and centre</td><td>COUNT, AVERAGE, MEDIAN, MODE.SNGL</td><td>Do not include headers, answer rows or formulas as observations</td></tr><tr><td>Spread</td><td>VAR.P / STDEV.P; VAR.S / STDEV.S</td><td>Select n versus n−1 for the intended target</td></tr><tr><td>Quartiles</td><td>QUARTILE.INC; PERCENTILE.INC</td><td>Excel interpolates; the slide np convention can differ</td></tr><tr><td>Normal cumulative probability</td><td>NORM.S.DIST(z,TRUE)</td><td>TRUE gives area; FALSE gives density</td></tr><tr><td>Normal upper tail</td><td>1−NORM.S.DIST(z,TRUE)</td><td>Match the tail to the question</td></tr><tr><td>Positive normal critical value</td><td>NORM.S.INV(1−α/2)</td><td>Two-sided cutoff, not 1−α</td></tr><tr><td>Student’s t reference</td><td>T.INV(1−α/2,df); T.DIST.2T(ABS(t),df)</td><td>Use n−1 df for one mean with unknown σ</td></tr><tr><td>Copy a formula</td><td>A2 / $A$2 / $A2 / A$2</td><td>Relative, absolute and mixed references</td></tr></tbody></table></div><p>Function names use English Excel syntax; separators and translated names depend on your settings. A name such as SE or t in these examples stands for your calculated cell reference.</p></div><div class="button-row">';
    for(const name of ['Formula sheet','Excel-function list','Statistical tables','Understanding notation']) {
      const r=moduleData.resources.find(r=>r.title===name);if(r)html+=`<a class="fs-button fs-secondary" href="${esc(r.url)}" target="_blank" rel="noopener">${name} ↗</a>`;
    }
    return html+'</div>';
  }
  function sources() {
    let html=header('sources')+`<dl class="fs-stats"><div><dt>Uploads / distinct files</dt><dd>${study.sourceReview.uploads} / ${study.sourceReview.uniqueFiles}</dd></div><div><dt>PowerPoint decks / slides</dt><dd>${study.sourceReview.slideDecks} / ${study.sourceReview.slides}</dd></div><div><dt>Data workbooks</dt><dd>${study.sourceReview.workbooks}</dd></div><div><dt>Reports / PDF pages extracted</dt><dd>${study.sourceReview.reports||0} / ${study.sourceReview.reportPages||0}</dd></div></dl><div class="fs-card"><h3>Lecture-to-exercise map</h3><div class="table-wrap"><table><thead><tr><th>Topic</th><th>Slide review</th><th>Exercise book</th></tr></thead><tbody>${study.lessons.map(l=>`<tr><td><a href="${link(l.topic)}">${l.number}. ${esc(l.title)}</a></td><td>${l.slides?l.slides+' supplied slides':'Slides pending; other sources reviewed'}</td><td>${esc(l.exercises)}</td></tr>`).join('')}</tbody></table></div></div><div class="fs-card"><h3>Working with the supplied datasets</h3><p>These are checked summary calculations and range-selection notes. Obtain the official data files from Virtuale and calculate them yourself in Excel.</p><div class="table-wrap"><table><thead><tr><th>Workbook</th><th>Observations</th><th>Checked example</th><th>Important note</th></tr></thead><tbody>${sourceReview.workbooks.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(w.n)}</td><td>${esc(w.example)}</td><td>${esc(w.note)}</td></tr>`).join('')}</tbody></table></div></div><div class="fs-card"><h3>Read confidence intervals in the supplied reports</h3><p>Four report readers connect the published estimates with their units, denominators, design and comparison rules. <a href="fund-statistics.html#lab-guides">Open Labs &amp; reports →</a></p><ul class="fs-source-list">${(sourceReview.reports||[]).map(r=>`<li><a href="fund-statistics.html?guide=${r.guide}#lab-guides">${esc(r.title)} →</a><p class="fs-meta">${esc(r.citation)}</p></li>`).join('')}</ul></div><div class="fs-card"><h3>Source discrepancies to keep in mind</h3><ul class="fs-source-list">${sourceReview.findings.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul><p class="fs-meta">These observations document the supplied files. They do not replace a correction or clarification from the teacher.</p></div><details class="fs-card"><summary>Uploaded-file inventory (including duplicates)</summary><ul class="fs-source-list">${sourceReview.files.map(f=>'<li>'+esc(f.name)+(f.duplicate?' — repeated identical copy':'')+'</li>').join('')}</ul></details><details class="fs-card"><summary>Referenced material still needed for a complete review</summary><ul class="fs-source-list">${study.missing.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></details><div class="fs-card"><h3>Official materials and practical help</h3><ul class="fs-source-list">${moduleData.resources.map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)} ↗</a></li>`).join('')}</ul><p class="fs-meta">Virtuale may require a UniBo login. Review date: ${new Date(sourceReview.updated+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Rome'})}. Dates and availability come from the supplied files and notice; verify changes on the official platforms.</p></div>`;
    return html;
  }
  function render(focus=false) {
    active=views.includes(location.hash.slice(1))?location.hash.slice(1):'learn';
    document.querySelectorAll('.fs-nav a').forEach(a=>{if(a.hash==='#'+active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(active==='lab-guides')labGuides();else if(active==='cases')cases();else if(active==='methods')methods();else if(active==='cards')cards();else if(active==='explore')explore();else if(active==='mock')renderMock();else $('fs-view').innerHTML=active==='learn'?lessons():active==='reference'?reference():sources();
    if(focus)$('fs-view-title')?.focus({preventScroll:true});
  }
  async function init() {
    try {
      [data,study,sourceReview,extension,practical]=await Promise.all([loadAll(),readJson(fetchText,'content/modules/fund-statistics/course-study.json',null),readJson(fetchText,'content/modules/fund-statistics/source-review.json',null),readJson(fetchText,'content/modules/fund-statistics/extended-practice.json',null),readJson(fetchText,'content/modules/fund-statistics/practical-study.json',null)]);
      const requestedLab=new URLSearchParams(location.search).get('lab');
      if(['fund-descriptive','normal-distribution','fund-table','fund-sampling','fund-confidence','hypothesis-test','fund-evidence','fund-proportion-test','fund-two-means'].includes(requestedLab))lab=requestedLab;
      moduleData=data.modules.find(m=>m.id==='fund-statistics');
      if(!moduleData||!study||!sourceReview)throw new Error('Study files are unavailable.');
      try{const key='euhem-fund-storage-check';localStorage.setItem(key,'1');localStorage.removeItem(key);}catch(_){$('fs-storage-warning').hidden=false;}
      restoreMock();$('fs-status').hidden=true;$('fs-content').hidden=false;render();
      window.addEventListener('hashchange',()=>render(true));
      document.addEventListener('visibilitychange',tick);setInterval(tick,1000);
    } catch(error) { $('fs-status').textContent='The workspace could not load. Reconnect and refresh, or open the course materials on Virtuale.'; }
  }
  init();
})();
