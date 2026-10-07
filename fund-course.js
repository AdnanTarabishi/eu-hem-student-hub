// Course 96496: a focused front door to Capacci's study material and both modules.
// Counts and progress come from existing content; this view creates no new learner state.
(function (root) {
  'use strict';
  const COURSE='fund-quant-methods',MODULE='fund-statistics';
  const el=(tag,className,text)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  };
  const link=(text,href,className='fc-utility-link',external=false)=>{
    const node=el('a',className,text);node.href=href;
    if(external){node.target='_blank';node.rel='noopener';}
    return node;
  };
  const icon=paths=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const icons={
    cases:icon('<path d="M7 4h10v16H7zM9 2h6v4H9zM10 10h4M10 14h4"/>'),
    labs:icon('<path d="M4 20V4M4 20h16M8 15l4-6 4 3 4-7"/><circle cx="12" cy="9" r="1.3"/>'),
    cards:icon('<rect x="4" y="7" width="14" height="13" rx="2"/><path d="M8 4h12v12M8 12h6M8 16h4"/>'),
    explore:icon('<path d="M3 12h18M12 3v18"/><circle cx="12" cy="12" r="7"/><path d="M7 15l3-6 4 7 3-5"/>'),
    mock:icon('<circle cx="12" cy="13" r="8"/><path d="M12 8v5l3 2M9 2h6M12 2v3"/>'),
    reference:icon('<path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4zM12 5v15"/>')
  };
  let study=null,prepared=null;
  async function prepare(read=fetchText) {
    if(prepared)return prepared;
    prepared=(async()=>{
      try {
        const value=await readJson(read,'content/modules/fund-statistics/course-study.json',null);
        if(value?.schemaVersion===1&&value.module===MODULE&&Array.isArray(value.lessons))study=value;
      } catch (_) { /* Optional detail must not block the course or its tools. */ }
    })();
    return prepared;
  }
  function header(ctx,tab,tabs) {
    document.body.classList.add('fund-course-page');
    const box=el('div','fc-header'),identity=el('div','fc-identity');
    const brand=ctx.pageLink('',{tab:'overview'},'fc-brand');
    const mark=el('span','fc-brand-mark');mark.innerHTML=icon('<path d="M4 18V9M10 18V5M16 18v-7M22 18V3"/>');
    const copy=el('span','fc-brand-copy','Fundamentals');
    copy.appendChild(el('small',null,`Health & Healthcare · ${ctx.course.code}`));brand.append(mark,copy);
    const actions=el('div','fc-header-actions');actions.appendChild(saveButton(ctx.course.id));
    actions.append(link('Create an item',`create.html?course=${COURSE}`));
    actions.appendChild(formButton('Contribute',ctx.settings.contributeFormUrl,'fc-utility-link'));
    identity.append(brand,actions);box.appendChild(identity);
    if(tab!=='overview')box.appendChild(el('h1','fc-page-title',ctx.course.info.name));
    const nav=el('nav','fc-tabs');nav.setAttribute('aria-label','Fundamentals course sections');
    for(const t of tabs){
      const a=ctx.pageLink(t.label,{tab:t.key},'fc-tab');
      if(t.key===tab)a.setAttribute('aria-current','page');
      nav.appendChild(a);
    }
    box.appendChild(nav);return box;
  }
  function heading(kicker,title,text) {
    const box=el('div','fc-section-heading');
    box.append(el('p','fc-kicker',kicker),el('h2',null,title));
    if(text)box.appendChild(el('p',null,text));
    return box;
  }
  function fact(list,label,value,key) {
    if(!value)return;
    const box=el('div');if(key)box.dataset.progress=key;
    box.append(el('dt',null,label),el('dd',null,value));list.appendChild(box);
  }
  function checked(progress,module,topic) {
    const total=module.questions.filter(q=>q.type==='mcq'&&q.topic===topic).length;
    return Math.min(total,(Array.isArray(progress.lectures?.[topic]?.checked)?progress.lectures[topic].checked:[]).filter(x=>x===true).length);
  }
  function overview(panel,ctx) {
    const module=ctx.course.modules.find(m=>m.id===MODULE);
    if(!module)return false;
    panel.classList.add('fc-course-panel','fc-overview');
    const topics=module.topics.filter(t=>t.lecture),progress=loadProgress();
    const questions=module.questions.filter(q=>q.type==='mcq');
    const guides=study?.development?.labGuides+study?.development?.reportReaders;
    const cohort=ctx.data.cohort.label;
    const hero=el('section','fc-hero');hero.setAttribute('aria-labelledby','fc-title');
    const copy=el('div','fc-hero-copy');
    copy.appendChild(el('p','fc-kicker',`EU-HEM · ${cohort} · Integrated course ${ctx.course.code}`));
    const h1=el('h1',null,'Fundamentals of');h1.id='fc-title';h1.setAttribute('aria-label',ctx.course.info.name);h1.appendChild(el('span',null,'Quantitative Methods'));
    copy.append(h1,el('p','fc-hero-description','Health & Healthcare. Learn to describe data, read evidence and explain what the numbers mean.'));
    const meta=el('div','fc-hero-meta');
    for(const text of [`${ctx.course.info.cfu} CFU`,`${ctx.course.modules.length} modules`,`Cycles ${courseCycles(ctx.course.info).replace('/',' & ')}`])meta.appendChild(el('span',null,text));
    const dates=courseDates(ctx.course.info),status=teachingStatus({teachingStart:dates.start,teachingEnd:dates.end},todayKey());
    if(status){const badge=el('span',null,status.label);if(status.detail)badge.title=status.detail;meta.appendChild(badge);}
    copy.appendChild(meta);
    const actions=el('div','fc-actions');actions.append(link('Start learning statistics →','fund-statistics.html','fc-button'),ctx.pageLink('Explore the lectures',{tab:'lectures'},'fc-button fc-button-secondary'));copy.appendChild(actions);
    const visual=el('aside','fc-evidence');
    const visualTop=el('div','fc-evidence-top');visualTop.append(el('span','fc-kicker','From data to insight'),el('span','fc-example-label','A mean & its uncertainty'));visual.appendChild(visualTop);
    // Original teaching illustration: 120 ± 1.96×2 mmHg. The link opens the real experiment.
    visual.innerHTML+=`<svg class="fc-hero-chart" viewBox="0 0 380 205" role="img" aria-label="Illustrative mean of 120 mmHg with standard error 2. Under a normal approximation, the 95 percent mean confidence interval is 116.08 to 123.92 mmHg."><path d="M22 55H358M22 100H358M22 145H358" stroke="currentColor" opacity=".12"/><path d="M28 158C95 158 111 53 190 35C269 53 285 158 352 158" fill="none" stroke="#9bdcc7" stroke-width="3"/><path d="M94 158C127 129 138 57 190 35C242 57 253 129 286 158Z" fill="#9bdcc7" opacity=".14"/><path d="M94 178H286M94 168V188M286 168V188" stroke="#f2a677" stroke-width="3"/><path d="M190 35V169" stroke="#f2a677" stroke-dasharray="4 6"/><circle cx="190" cy="178" r="6" fill="#f2a677"/></svg>`;
    const result=el('div','fc-evidence-result');result.append(el('strong',null,'120 mmHg'),el('span','fc-evidence-interval','95% CI: 116.08–123.92'));
    visual.append(result,el('p','fc-example-label','Illustrative estimate · SE = 2 mmHg'),link('Explore how confidence intervals change →','fund-statistics.html?lab=fund-confidence#explore','fc-evidence-link'));
    hero.append(copy,visual);panel.appendChild(hero);
    const metrics=el('dl','fc-metrics');
    for(const [id,value,label] of [['topics',topics.length,'Topic guides'],['questions',questions.length,'Original lecture questions'],['cards',module.flashcards.length,'Review cards'],['guides',Number.isFinite(guides)?guides:module.resources.length,Number.isFinite(guides)?'Lab & report guides':'Study resources']]) {
      const box=el('div');box.dataset.metric=id;box.append(el('dt',null,label),el('dd',null,String(value)));metrics.appendChild(box);
    }
    panel.appendChild(metrics);
    const layout=el('div','fc-content-layout'),learning=el('div','fc-learning-column'),sidebar=el('aside','fc-sidebar');
    learning.appendChild(heading('01 / Understand the foundations','Your statistics pathway','Six topics, one connected story. Build the idea, explore an example, then put it into practice.'));
    const cards=el('div','fc-topic-grid');
    for(const [index,topic] of topics.entries()) {
      const lesson=study?.lessons.find(l=>l.topic===topic.id),status=getTopicStatus(progress,topic.id);
      const card=link('',lectureUrl(topic.id)+'#learn','fc-topic-card');
      const top=el('div','fc-topic-top');top.append(el('span','fc-topic-number',String(index+1).padStart(2,'0')),el('span','fc-status'+(status?' is-'+status:''),status==='understood'?'✓ Understood':status==='read'?'◐ Read':'Topic '+(index+1)));
      const questionCount=questions.filter(q=>q.topic===topic.id).length,cardCount=module.flashcards.filter(c=>c.topic===topic.id).length;
      const text=(lesson?.outcomes?.[0]||'Read the guide and explore the worked examples.')+(topic.id==='fund-statistics.two-means'?' · Additional topic, time permitting.':'');
      const metadata=el('div','fc-topic-meta');metadata.append(el('span',null,`${questionCount} questions`),el('span',null,`${cardCount} cards`));
      card.append(top,el('h3',null,lesson?.title||topic.title.replace(/^Topic \d+:\s*/,'')),el('p',null,text),metadata,el('span','fc-topic-action','Open topic guide →'));cards.appendChild(card);
    }
    learning.appendChild(cards);
    sidebar.appendChild(resume(module,topics,progress));
    sidebar.appendChild(exam());
    const sources=el('section','fc-source-card');sources.append(el('p','fc-kicker','The course essentials'),el('h3',null,'Keep the sources close.'),el('p',null,'Use the original slides and teacher-provided references alongside these student study guides.'),link('Official materials on Virtuale →',module.info.virtualeUrl,'fc-utility-link',true),link('Materials & source review →','fund-statistics.html#sources','fc-utility-link'));
    sidebar.appendChild(sources);layout.append(learning,sidebar);panel.appendChild(layout);
    const tools=el('section','fc-tools');tools.appendChild(heading('02 / Put it into practice','A tool for every study moment','Move from understanding a concept to solving a problem and explaining the result.'));
    const toolsGrid=el('div','fc-tools-grid');
    const development=study?.development;
    const items=[
      ['cases','Worked cases','Calculate, use a hint and compare your explanation with a worked solution.','#cases',development?`${development.originalCases} cases · ${development.numericCheckpoints} numerical checks`:'Guided calculations & interpretations'],
      ['labs','Labs & reports','Follow the Excel workflows and read uncertainty in published reports.','#lab-guides',Number.isFinite(guides)?`${development.labGuides} lab guides · ${development.reportReaders} report readers`:'Datasets, tables & interval charts'],
      ['cards','Flashcards','Recall the idea before revealing the answer. Keep up with your due cards.','#cards',`${module.flashcards.length} cards · spaced review`],
      ['explore','Interactive experiments','Change the numbers and see how a statistical idea behaves.','#explore','Sampling, intervals & tests'],
      ['mock','Mock exam','Rehearse the format, then review calculations and written interpretations.','#mock','Timed practice · separate from the official paper'],
      ['reference','Quick reference','Keep notation, method selection and Excel functions within reach.','#reference','Formulas, symbols & Excel']
    ];
    for(const [key,title,text,hash,meta] of items){
      const card=link('','fund-statistics.html'+hash,'fc-tool-card'),mark=el('span','fc-tool-icon');mark.innerHTML=icons[key];
      card.append(mark,el('h3',null,title),el('p',null,text),el('span','fc-tool-meta',meta),el('span','fc-tool-arrow','Open tool →'));toolsGrid.appendChild(card);
    }
    tools.appendChild(toolsGrid);panel.appendChild(tools);
    const modules=el('section','fc-modules');modules.appendChild(heading('03 / The integrated course','Two modules. A wider perspective.','Start with statistical reasoning, then connect it with econometric models and causal questions.'));
    const moduleGrid=el('div','fc-module-grid');
    for(const m of ctx.course.modules)moduleGrid.appendChild(moduleCard(m,ctx));
    modules.appendChild(moduleGrid);panel.appendChild(modules);
    const plan=el('div','fc-plan-wrap');
    if(ctx.course.group)plan.appendChild(el('p','fc-example-label',`${ctx.course.group.label} · ${ctx.course.group.badge||ctx.course.group.kind}`));
    plan.appendChild(ctx.planStatusBox());panel.appendChild(plan);
    const footer=el('div','fc-footer-note');footer.append(el('p',null,'Original student study material. Official slides, datasets and answer keys stay on Virtuale. Follow the university’s exam rules during the exam.'),link('Official integrated-course page →',ctx.course.info.officialUrl,'fc-utility-link',true));
    if(ctx.unibo==='failed')footer.appendChild(el('p',null,'Live timetable and exam dates are temporarily unavailable. Check the official university platforms for current arrangements.'));
    panel.appendChild(footer);return true;
  }
  function resume(module,topics,progress) {
    const partial=topics.find(t=>checked(progress,module,t.id)>0&&checked(progress,module,t.id)<module.questions.filter(q=>q.topic===t.id&&q.type==='mcq').length);
    const next=partial||topics.find(t=>getTopicStatus(progress,t.id)!=='understood')||topics[0];
    const read=topics.filter(t=>getTopicStatus(progress,t.id)).length,total=module.questions.filter(q=>q.type==='mcq').length,attempted=topics.reduce((sum,t)=>sum+checked(progress,module,t.id),0);
    const box=el('section','fc-resume-card');box.append(el('p','fc-kicker','Your next step'),el('h3',null,partial?'Pick up where you left off.':read>0?'Keep building your understanding.':'Start with a clear foundation.'));
    const bar=el('progress','fc-progress');bar.max=topics.length;bar.value=read;bar.setAttribute('aria-label',`${read} of ${topics.length} topics read or understood`);
    box.appendChild(bar);const facts=el('dl','fc-compact-facts');fact(facts,'Topics read or understood',`${read} / ${topics.length}`,'read');fact(facts,'Lecture questions checked',`${attempted} / ${total}`,'checked');box.appendChild(facts);
    if(next){box.appendChild(el('p','fc-progress-label',next.title.replace(/^Topic \d+:\s*/,'')));box.appendChild(link(partial?'Continue your practice →':'Open your next topic →',lectureUrl(next.id)+(partial?'#practice':'#learn'),'fc-button fc-resume-link'));}
    box.appendChild(el('p','fc-example-label','Progress is saved on this device and shared with your Notes page.'));return box;
  }
  function exam() {
    const box=el('section','fc-exam-card');box.append(el('p','fc-kicker','Statistics assessment'),el('h3',null,'Prepare with confidence.'));
    if(study?.exam){
      const e=study.exam;box.appendChild(el('p','fc-progress-label',`${e.minutes} minutes · pass mark ${e.passMark}`));
      const parts=el('ol','fc-exam-parts');
      for(const part of e.sections){const item=el('li');item.append(el('strong',null,part.weight+'%'),el('span',null,part.label));parts.appendChild(item);}box.appendChild(parts);
      const next=e.dates.find(d=>d.date>=todayKey());
      if(next){const date=el('p','fc-exam-date');date.append(el('strong',null,formatDay(next.date,{day:'numeric',month:'long',year:'numeric'})),el('span',null,`${next.time} · Europe/Rome`));box.appendChild(date);}
      box.appendChild(el('p','fc-example-label','Dates from the supplied course notice. Confirm the sitting and register on AlmaEsami.'));
    } else box.appendChild(el('p',null,'Review the syllabus for the current structure, permitted materials and exam dates.'));
    box.append(link('Try the practice mock →','fund-statistics.html#mock','fc-utility-link'),link('Exam dates & enrolment →','https://almaesami.unibo.it/','fc-utility-link',true));return box;
  }
  function moduleCard(module,ctx) {
    const m=module.info,isStats=module.id===MODULE,box=el('article','fc-module-card'+(isStats?' fc-module-active':''));
    const top=el('div','fc-module-top');top.append(el('span','fc-kicker',`Module ${m.code}`),el('span','fc-status',isStats?'Study guides available':'Syllabus overview'));
    box.append(top,el('h3',null,m.name),el('p',null,m.description));
    const facts=el('dl','fc-module-facts');fact(facts,'Professor',m.professors.join(', '));fact(facts,'Credits / cycle',`${m.cfu} CFU · cycle ${m.cycle}`);
    if(m.teachingStart&&m.teachingEnd)fact(facts,'Teaching period',`${formatDay(m.teachingStart,{day:'numeric',month:'short'})} – ${formatDay(m.teachingEnd,{day:'numeric',month:'short',year:'numeric'})}`);
    box.appendChild(facts);
    if(!isStats&&!module.topics.some(t=>t.lecture))box.appendChild(el('p','fc-example-label','Interactive Econometrics guides are awaiting course materials. The syllabus topics and official course information are available below.'));
    const details=el('details','fc-module-details');details.appendChild(el('summary',null,'Topics, assessment & textbooks'));
    const list=el('ul');for(const topic of module.topics)list.appendChild(el('li',null,topic.title));details.appendChild(list);
    details.append(el('h4',null,'Assessment'),el('p',null,m.assessment));
    if(m.textbooks?.length){details.appendChild(el('h4',null,'Textbooks'));const books=el('ul');for(const book of m.textbooks)books.appendChild(el('li',null,book));details.appendChild(books);}box.appendChild(details);
    const resources=el('div','fc-module-resources');
    resources.appendChild(link('Official module page →',m.officialUrl,'fc-utility-link',true));
    if(isStats)resources.appendChild(link('Open the study workspace →','fund-statistics.html','fc-utility-link'));
    else resources.appendChild(ctx.pageLink('View syllabus topics →',{tab:'topics'},'fc-utility-link','#module-'+module.id));
    box.appendChild(resources);return box;
  }
  function render(panel,tab,ctx){
    panel.classList.add('fc-course-panel');
    return tab==='overview'?overview(panel,ctx):false;
  }
  root.FundCourse={prepare,header,render};
})(window);
