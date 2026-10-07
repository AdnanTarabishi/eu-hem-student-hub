/* Toolkit v2 collections and pure local-list helpers. No network or DOM access. */
(function(root,factory){
  'use strict';
  const api=typeof module==='object'&&module.exports?factory(require('./toolkit-data.js')):factory(root.StudentToolkitData);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentToolkitOrganiser=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D){
  'use strict';
  const collections=[
    {id:'first-week',title:'Start your EU-HEM semester',category:'Study & life',icon:'graduation',summary:'A small set of tools for dates, course choices and settling into your city.',steps:[
      ['Map your semester','Review your course choices and confirm important dates with official sources.',['study-plan','calendar']],
      ['Choose a study home','Open the workspace for the statistics course you are taking.',['fundamentals-workspace','statistics-workspace']],
      ['Organise your reading','Keep references and a simple working outline in one place.',['zotero','notion']],
      ['Get oriented locally','Use the city guide; verify any time-sensitive detail at its original source.',['city-guides']]]},
    {id:'statistics-revision',title:'Prepare for a statistics exercise',category:'Study & statistics',icon:'calculator',summary:'Move from the data and question to a calculation you can explain.',steps:[
      ['Inspect the data','Check the variable, sample size and summary measures before choosing a method.',['descriptive']],
      ['Understand the probability','Translate the question into bounds or cumulative probabilities.',['normal','quantiles','ztable']],
      ['Work through inference','Use the matching interval or test only after checking its assumptions.',['confidence','mean-test','proportion-test']],
      ['Practise independently','Attempt your answer first, then use the existing workspace to review.',['fundamentals-workspace']]]},
    {id:'literature-review',title:'Build a literature-review starter kit',category:'Research',icon:'library',summary:'Find papers, organise references and keep reporting expectations in view.',steps:[
      ['Frame a question','Use the thesis guide to narrow a question and define your scope.',['thesis']],
      ['Search deliberately','Record queries, filters and search dates; discovery tools do not replace a complete search strategy.',['pubmed','openalex']],
      ['Follow useful connections','Explore related papers and save checked reference metadata.',['researchrabbit','zotero']],
      ['Plan transparent reporting','Discuss a protocol and relevant reporting guidance with your supervisor.',['equator','osf']]]},
    {id:'health-data',title:'Explore health and economic data',category:'Health economics',icon:'chart-column',summary:'Find public indicators, check definitions and start a reproducible analysis.',steps:[
      ['Choose a source','Identify the population, unit of analysis and period you need.',['oecd','who-gho']],
      ['Read the metadata','Check definitions, units and missing years before comparing countries.',['eurostat','world-bank']],
      ['Inspect before modelling','Describe an anonymised practice dataset and look for data-quality issues.',['descriptive','jamovi']],
      ['Keep an analysis record','Save code and document the source and extraction date.',['rstudio','colab']]]},
    {id:'write-present',title:'Write and present with clarity',category:'Writing',icon:'sparkles',summary:'Turn an argument into a readable report and a focused presentation.',steps:[
      ['Sketch the argument','Outline the question, evidence and take-home message before styling.',['excalidraw']],
      ['Keep citations traceable','Check source metadata and cite the original evidence.',['zotero']],
      ['Choose a writing workflow','Pick the writing tool appropriate to your assignment; verify any language suggestions.',['overleaf','deepl']],
      ['Present the essentials','Use readable figures and confirm any reporting checklist the task requires.',['canva','equator']]]},
    {id:'group-project',title:'Organise a group project',category:'Collaboration',icon:'students',summary:'Agree a plan, assemble sources and build a shared explanation.',steps:[
      ['Agree roles and dates','Define deliverables and arrange check-ins in tools your group already uses.',['notion','google-calendar']],
      ['Map the problem together','Sketch the argument before dividing the writing.',['excalidraw']],
      ['Share reliable references','Keep sources and citation metadata consistent across the group.',['zotero']],
      ['Prepare the presentation','Combine the contributions, then rehearse and check the assignment requirements.',['canva']]]},
    {id:'next-city',title:'Prepare for your next programme city',category:'Cities & mobility',icon:'globe',summary:'A practical source shortlist for Bologna, Oslo, Innsbruck and Rotterdam.',steps:[
      ['Start with the city guide','Read the relevant arrival guide and check links to official sources.',['city-guides']],
      ['Find local transport','Choose the operator matching your destination; check routes and ticket rules there.',['tper','ruter','ivb','9292']],
      ['Plan onward travel','Compare connections using the appropriate country planner.',['entur','oebb']],
      ['Discuss shared costs','Agree how to track shared expenses; a discount card requires an eligibility check.',['splitwise','esncard']]]},
    {id:'research-career',title:'Explore a research or internship path',category:'Career',icon:'briefcase',summary:'Connect your interests to organisations, opportunities and a clear application.',steps:[
      ['Identify your interests','Explore thesis themes and research project records for inspiration.',['thesis','cordis']],
      ['Look for actual opportunities','Check role-specific qualifications, languages, deadlines and work eligibility.',['euraxess','eures']],
      ['Prepare your materials','Tailor your CV; keep researcher identifiers and affiliations accurate.',['europass','orcid']],
      ['Plan a follow-up','Track deadlines yourself; no application or notification is sent by this collection.',['google-calendar']]]}
  ].map(c=>Object.freeze({...c,items:[...new Set(c.steps.flatMap(s=>s[2]))]}));
  const packs=new Map(collections.map(c=>[c.id,c]));
  const LIMITS=Object.freeze({lists:12,items:30,title:60,bytes:100000});
  const ids=a=>Array.isArray(a)?[...new Set(a.filter(id=>typeof id==='string'&&D.byId.has(id)))].slice(0,LIMITS.items):[];
  const title=s=>typeof s==='string'?s.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,LIMITS.title):'';
  function cleanStore(raw){
    const lists=[],seen=new Set();
    if(raw&&raw.version===1&&Array.isArray(raw.lists))for(const list of raw.lists.slice(0,LIMITS.lists)){
      if(!list||typeof list!=='object'||typeof list.id!=='string'||!/^l-[a-z0-9-]{1,80}$/.test(list.id)||seen.has(list.id))continue;
      const name=title(list.title);if(!name)continue;seen.add(list.id);
      const items=ids(list.items);lists.push({id:list.id,title:name,items,checked:ids(list.checked).filter(id=>items.includes(id))});
    }
    return {version:1,lists};
  }
  function newList(store,name,items,id){
    const s=cleanStore(store),n=title(name);
    if(!n)throw new Error('Give your list a name.');
    if(s.lists.length>=LIMITS.lists)throw new Error('You can keep up to 12 lists. Delete a list before adding another.');
    if(typeof id!=='string'||!/^l-[a-z0-9-]{1,80}$/.test(id)||s.lists.some(l=>l.id===id))throw new Error('Could not create a unique list identifier. Try again.');
    return {version:1,lists:[...s.lists,{id,title:n,items:ids(items),checked:[]}]};
  }
  function changeList(store,listId,op,value){
    const s=cleanStore(store),l=s.lists.find(l=>l.id===listId);if(!l)throw new Error('That list is no longer available.');
    if(op==='rename'){const n=title(value);if(!n)throw new Error('Give your list a name.');l.title=n;}
    else if(op==='delete')s.lists=s.lists.filter(x=>x.id!==listId);
    else if(op==='add'){
      if(!D.byId.has(value))throw new Error('That tool is not in this catalogue.');
      if(!l.items.includes(value)){if(l.items.length>=LIMITS.items)throw new Error('A list can contain up to 30 entries.');l.items.push(value);}
    }else if(op==='remove'){l.items=l.items.filter(id=>id!==value);l.checked=l.checked.filter(id=>id!==value);}
    else if(op==='check'){
      if(!l.items.includes(value))throw new Error('Add that tool to the list first.');
      l.checked=l.checked.includes(value)?l.checked.filter(id=>id!==value):[...l.checked,value];
    }else if(op==='up'||op==='down'){
      const i=l.items.indexOf(value),j=i+(op==='up'?-1:1);
      if(i<0)throw new Error('That entry is no longer in this list.');
      if(j>=0&&j<l.items.length)[l.items[i],l.items[j]]=[l.items[j],l.items[i]];
    }else throw new Error('Unsupported list action.');
    return s;
  }
  function exportStore(store){return JSON.stringify({format:'euhem-toolkit-lists',...cleanStore(store)},null,2);}
  function parseImport(text){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMITS.bytes)throw new Error('Use a Toolkit JSON backup smaller than 100 KB.');
    let raw;try{raw=JSON.parse(text);}catch(_){throw new Error('This is not valid JSON. Choose a Toolkit backup.');}
    if(!raw||raw.format!=='euhem-toolkit-lists'||raw.version!==1||!Array.isArray(raw.lists)||!raw.lists.length||raw.lists.length>LIMITS.lists)throw new Error('This is not a supported Toolkit lists backup.');
    for(const l of raw.lists){
      if(!l||!title(l.title)||l.title.length>LIMITS.title||!Array.isArray(l.items)||!Array.isArray(l.checked)||l.items.length>LIMITS.items||new Set(l.items).size!==l.items.length||l.items.some(id=>typeof id!=='string'||!D.byId.has(id))||l.checked.some(id=>!l.items.includes(id)))throw new Error('A list contains invalid values or unknown tools. Nothing has been imported.');
    }
    return raw.lists.map(l=>({title:title(l.title),items:[...l.items],checked:[...new Set(l.checked)]}));
  }
  function mergeImport(store,imported,makeId){
    let s=cleanStore(store);
    if(!Array.isArray(imported)||s.lists.length+imported.length>LIMITS.lists)throw new Error('Import would exceed 12 lists. No lists were changed.');
    for(const l of imported){const id=makeId();s=newList(s,l.title,l.items,id);s.lists.at(-1).checked=[...l.checked];}
    return s;
  }
  return Object.freeze({collections,packs,LIMITS,cleanStore,newList,changeList,exportStore,parseImport,mergeImport});
});
