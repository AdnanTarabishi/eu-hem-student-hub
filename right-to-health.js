// Course 96500: original, source-led learning workspace. No framework or remote personal data.
(function (root) {
  "use strict";
  const ID = "right-to-health";
  const PATH = "content/modules/right-to-health/workspace.json";
  const DRAFT_KEY = "euhem-rth-workshop-v1";
  let data = null;
  let refs = new Map();
  // Temporary study notes: page-lifetime memory only, never browser or remote storage.
  const caseSessions = new Map();
  let lastCaseId = "";
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const add = (parent, tag, cls, text) => { const node = el(tag, cls, text); parent.append(node); return node; };
  const button = (text, fn, cls = "button button-light") => {
    const node = el("button", cls, text); node.type = "button"; node.addEventListener("click", fn); return node;
  };
  function external(label, url) {
    const a = el("a", "rth-source-link", label);
    try { if (new URL(url).protocol !== "https:") return el("span", null, label); } catch { return el("span", null, label); }
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; return a;
  }
  function sources(parent, ids, expanded = false) {
    const box = add(parent, "details", "rth-sources"); box.open = expanded;
    add(box, "summary", null, "Sources & reading notes");
    for (const id of [...new Set(ids)]) {
      const s = refs.get(id); if (!s) continue;
      const item = add(box, "div", "rth-source");
      item.append(external(s.title + " ↗", s.url));
      add(item, "p", "rth-meta", s.kind + " · " + s.locator);
      add(item, "p", "rth-meta", s.note);
    }
  }
  function section(parent, eyebrow, title, intro) {
    const box = add(parent, "section", "rth-section");
    add(box, "p", "rth-eyebrow", eyebrow); add(box, "h2", null, title);
    if (intro) add(box, "p", "rth-lead", intro);
    return box;
  }
  function notice(parent, text) { return add(parent, "p", "rth-notice", text); }
  function progress() {
    const saved = loadProgress();
    const read = data.units.filter(u => getTopicStatus(saved, u.id)).length;
    const understood = data.units.filter(u => getTopicStatus(saved, u.id) === "understood").length;
    return { read, understood, next: data.units.find(u => getTopicStatus(saved, u.id) !== "understood") || data.units[0] };
  }
  async function prepare(read = fetchText) {
    try {
      const value = await readJson(read, PATH, null);
      if (!value || value.schemaVersion !== 1 || value.course !== ID || !Array.isArray(value.units) || !value.units.length || !Array.isArray(value.sources)) throw Error("Invalid Right to Health workspace");
      data = value; refs = new Map(data.sources.map(s => [s.id, s]));
      return true;
    } catch (error) {
      console.warn("Right to Health workspace unavailable; using standard course notes.", error);
      data = null; return false;
    }
  }
  const guideLink = (ctx, u, label = "Read guide →", cls = "button button-light") => ctx.pageLink(label, { tab: "topics", topic: u.id }, cls);
  function header(ctx, tab, tabs) {
    document.body.classList.add("rth-page");
    const box = el("section", "rth-header");
    const top = add(box, "div", "rth-title-row");
    const title = add(top, "div");
    add(title, "p", "rth-eyebrow", "EU-HEM / COURSE " + ctx.course.info.code);
    add(title, "h1", null, "Our Right to Health");
    add(title, "p", "rth-subtitle", "Needs, Resources and Society");
    const meta = add(top, "div", "rth-header-meta");
    add(meta, "span", "rth-pill", ctx.course.info.cfu + " CFU · " + ctx.course.modules[0].info.professors.join(", "));
    add(meta, "span", "rth-meta", "Expanded study edition · " + data.updated);
    meta.append(saveButton(ID));
    const labels = { overview: "Course hub", lectures: "Study guides", topics: "Reader", concepts: "Glossary", casebook: "Casebook", explore: "Explore", workshop: "Workshop", practice: "Practice", schedule: "Schedule", exam: "Exam", resources: "Sources" };
    const nav = add(box, "nav", "rth-tabs"); nav.setAttribute("aria-label", "Right to Health sections");
    for (const t of tabs) {
      const a = ctx.pageLink(labels[t.key] || t.label, { tab: t.key }, "rth-tab");
      if (t.key === tab) a.setAttribute("aria-current", "page"); nav.append(a);
    }
    return box;
  }
  function cards(parent, ctx, units = data.units) {
    const grid = add(parent, "div", "rth-guide-grid");
    for (const u of units) {
      const card = add(grid, "article", "rth-guide-card");
      add(card, "p", "rth-eyebrow", u.kicker);
      add(card, "h3", null, u.title); add(card, "p", null, u.intro);
      const status = getTopicStatus(loadProgress(), u.id);
      add(card, "p", "rth-meta", (status === "understood" ? "✓ Understood" : status === "read" ? "◐ Read" : "○ Not started") + " · " + u.minutes + " min suggested study time");
      card.append(guideLink(ctx, u));
    }
  }
  function overview(panel, ctx) {
    const hero = add(panel, "div", "rth-hero");
    const copy = add(hero, "div", "rth-hero-copy");
    add(copy, "p", "rth-eyebrow", "LAW × HEALTH × SOCIETY");
    const h = add(copy, "h2", null, "A right on paper."); add(h, "span", null, "Access in practice.");
    add(copy, "p", null, "Explore how freedoms, rights, equality and values meet real health systems—and the difficult choices behind care.");
    const actions = add(copy, "div", "button-row");
    const p = progress(); actions.append(guideLink(ctx, p.next, p.read ? "Continue studying →" : "Start the first guide →", "button"), ctx.pageLink("Open the explorers", { tab: "explore" }, "rth-hero-link"));
    const lenses = add(hero, "div", "rth-lenses");
    [["01", "Economic freedoms", "When patients cross borders"],["02", "Human rights", "From entitlement to access"],["03", "Non-discrimination", "Who might be left behind?"],["04", "Values & ethics", "What should guide a decision?"]].forEach(([n,t,d])=>{
      const a=add(lenses,"div","rth-lens");add(a,"span","rth-lens-number",n);const txt=add(a,"div");add(txt,"strong",null,t);add(txt,"span",null,d);
    });
    const stats = add(panel, "div", "rth-stats");
    [[data.units.length, "study guides"], [ctx.course.questions.filter(q=>q.type==="mcq").length,"original MCQs"],[ctx.course.flashcards.length,"flashcards"],["4","country readings"]].forEach(([n,l])=>{const b=add(stats,"div");add(b,"strong",null,String(n));add(b,"span",null,l);});
    const row=add(panel,"div","rth-overview-row");
    const start=section(row,"YOUR STUDY PATH","Understand. Apply. Reflect.","Read a guide, explore a scenario, then use active recall. Suggested times are planning estimates, not official class durations.");
    const steps=add(start,"div","rth-steps");
    [["Read","Source-led explanations and seven-point reviews.","lectures"],["Apply","Reason through 12 cases, then test the course explorers.","casebook"],["Reflect","Build a policy proposal for the workshop.","workshop"]].forEach(([t,d,k])=>{
      const step=add(steps,"div");step.append(ctx.pageLink(t+" →",{tab:k},"rth-step-link"));add(step,"p",null,d);
    });
    const tracker=section(row,"ON THIS DEVICE","Your progress",p.read+" of "+data.units.length+" guides marked read; "+p.understood+" understood.");
    const bar=add(tracker,"progress");bar.max=data.units.length;bar.value=p.read;bar.setAttribute("aria-label","Guides marked read");
    add(tracker,"p","rth-meta","Marks, flashcard review and quiz progress use the Hub’s existing local study storage. Nothing is sent to the lecturer.");
    tracker.append(ctx.pageLink("Practice & recall →",{tab:"practice"},"button button-light"));
    const path=section(panel,"THE FOUR PERSPECTIVES","Build the foundations","");cards(path,ctx,data.units.slice(0,4));
    const bottom=section(panel,"CONNECT THE IDEAS","Four countries. Different choices.","Move from the legal and ethical foundations to financing, service delivery, access and accountability.");
    bottom.append(ctx.pageLink("Compare the systems →",{tab:"explore"},"button button-light"),ctx.pageLink("Browse all 10 guides →",{tab:"lectures"},"button button-light"));
    const casesBox=section(panel,"NEW · CASEBOOK","Practise the argument, not just the answer.","Twelve source-linked cases: make a first choice, build your analysis and uncover the reasoning one step at a time. Hypothetical examples and reading-based cases are clearly labelled.");
    casesBox.classList.add("rth-casebook-banner");
    casesBox.append(ctx.pageLink("Open the casebook →",{tab:"casebook"},"button"));
    notice(panel,data.editorialStatus+" "+data.scope);
    const notes=add(panel,"details","rth-sources");add(notes,"summary",null,"Course organisation & using this edition");organisation(notes);
  }
  function organisation(panel) {
    const list=add(panel,"div","rth-organisation");
    add(list,"p",null,"The supplied organizational deck lists 30 contact hours and a written exam with multiple-choice and open questions. Exam details will be communicated by the teaching assistant. The final Q&A on 23 October is not an independently confirmed exam date.");
    add(list,"p",null,"Contact the lecturer via markus.frischhut@mci.edu, not the Virtuale chat. For organisational and exam questions: Sergio Dino, sergio.dino2@unibo.it. Join Teams through Virtuale using UniBo credentials. Sessions start on time.");
    add(list,"p",null,"The course notice says some full slide versions will appear after the relevant session. Class discussions and Virtuale content may be exam-relevant. These study aids do not replace them.");
    sources(list,["org"]);
  }
  function learningPath(panel,ctx) {
    section(panel,"10 ORIGINAL GUIDES","A structured path through the course", "Study explanations based on the supplied files. Country readings keep their historical dates; supplementary clarifications are explicitly identified.");
    const label=add(panel,"label","rth-field","Find a study guide");
    const input=add(label,"input");input.type="search";input.placeholder="Try waiting, proportionality or financing";
    const count=add(panel,"p","rth-meta");count.setAttribute("role","status");
    const host=add(panel,"div");
    function draw(){const q=input.value.trim().toLocaleLowerCase();const units=data.units.filter(u=>[u.title,u.intro,...u.sections.map(x=>x.title)].join(" ").toLocaleLowerCase().includes(q));host.replaceChildren();count.textContent=units.length+" of "+data.units.length+" guides · "+data.units.reduce((n,u)=>n+u.sections.length,0)+" explanation sections in this edition";if(units.length)cards(host,ctx,units);else notice(host,"No matching guide. Try a broader word.");}
    input.addEventListener("input",draw);draw();
    notice(panel,"The guides are not official lecture transcripts or a statement that future sessions have already taken place. Check Virtuale for full slides and announcements.");
  }
  function reader(panel,ctx) {
    const requested=ctx.params.topic;
    const u=data.units.find(x=>x.id===requested)||data.units[0];
    if(requested && requested!==u.id) notice(panel,"That guide was not found. Showing the first guide instead.");
    const layout=add(panel,"div","rth-reader-layout");
    const toc=add(layout,"nav","rth-toc");toc.setAttribute("aria-label","Study guide navigation");
    add(toc,"p","rth-eyebrow","IN THIS COURSE");
    data.units.forEach((g,i)=>{const a=guideLink(ctx,g,String(i+1).padStart(2,"0")+"  "+g.title,"rth-toc-link");if(g.id===u.id)a.setAttribute("aria-current","page");toc.append(a);});
    const article=add(layout,"article","rth-reading");article.id=u.id;
    add(article,"p","rth-eyebrow",u.kicker);add(article,"h2",null,u.title);add(article,"p","rth-lead",u.intro);
    add(article,"p","rth-meta",u.minutes+" min suggested study time · Original, AI-assisted explanation · Not lecturer-reviewed");
    const review=add(article,"details","rth-review");review.open=true;add(review,"summary",null,"5-minute review");const ul=add(review,"ul");u.review.forEach(t=>add(ul,"li",null,t));
    const jump=labelledSelect(article,"Jump to a section",[["","Choose one of "+u.sections.length+" sections"],...u.sections.map((x,i)=>[String(i),x.title])]);
    jump.classList.add("rth-section-jump");
    const headings=[];
    for(const [i,s] of u.sections.entries()){
      const box=add(article,"section","rth-reading-section");box.id="rth-chapter-"+i;
      if(s.edition)add(box,"p","rth-eyebrow",s.edition);
      const heading=add(box,"h3",null,s.title);heading.tabIndex=-1;headings.push(heading);
      s.paragraphs.forEach(t=>add(box,"p",null,t));
      if(s.locator)add(box,"p","rth-locator","Reading location: "+s.locator);
      sources(box,s.sources);
    }
    jump.addEventListener("change",()=>{if(jump.value!==""){const h=headings[Number(jump.value)];if(h){h.focus({preventScroll:true});h.scrollIntoView({block:"start"});}}});
    const casesForTopic=(data.cases||[]).filter(c=>c.topic===u.id);
    if(casesForTopic.length){const related=add(article,"aside","rth-related-cases");add(related,"h3",null,"Put this guide to work");add(related,"p",null,casesForTopic.length+" related case"+(casesForTopic.length===1?"":"s")+" with step-by-step reasoning. Select a case in the Casebook to begin.");related.append(ctx.pageLink("Practise this topic in the Casebook →",{tab:"casebook",topic:u.id},"button button-light"));}
    const actions=add(article,"div","rth-study-actions");
    const status=add(actions,"p","rth-meta");status.setAttribute("role","status");
    const draw=()=>{const s=getTopicStatus(loadProgress(),u.id);status.textContent=s==="understood"?"✓ Marked understood on this device":s==="read"?"◐ Marked read on this device":"Not marked yet";};
    function mark(value){
      const p=loadProgress();if(value){p.topics[u.id]=value;recordActivity(p,todayKey());}else delete p.topics[u.id];
      if(saveProgress(p))draw();else status.textContent="Your browser could not save this mark. Study content is still available.";
    }
    actions.append(button("Mark as read",()=>mark("read")),button("Mark understood",()=>mark("understood"),"button"),button("Clear this mark",()=>mark("")));draw();
    actions.append(ctx.pageLink("Practice this topic →",{tab:"practice",practiceTopic:u.id},"button button-light"));
    const pager=add(article,"nav","rth-pager");pager.setAttribute("aria-label","Previous and next guides");const i=data.units.indexOf(u);
    if(i>0)pager.append(guideLink(ctx,data.units[i-1],"← Previous guide"));if(i<data.units.length-1)pager.append(guideLink(ctx,data.units[i+1],"Next guide →"));
    sources(article,u.sources);
  }
  function glossary(panel) {
    section(panel,"CONCEPTS","The language of the course","Short, source-linked definitions. They support revision; they are not a complete statement of legal scope.");
    const label=add(panel,"label","rth-field","Find a term");const input=add(label,"input");input.type="search";input.placeholder="Try solidarity, AAAQ or risk equalisation";
    const count=add(panel,"p","rth-meta");count.setAttribute("role","status");const grid=add(panel,"div","rth-glossary-grid");
    function draw(){grid.replaceChildren();const q=input.value.trim().toLocaleLowerCase();const items=data.glossary.filter(t=>(t.term+" "+t.definition).toLocaleLowerCase().includes(q));count.textContent=items.length+" terms";
      items.forEach(t=>{const card=add(grid,"article","rth-glossary-card");add(card,"h3",null,t.term);add(card,"p",null,t.definition);sources(card,[t.source]);});
      if(!items.length)add(grid,"p","rth-notice","No matching term. Try a broader word.");}
    input.addEventListener("input",draw);draw();
  }
  function sourceLibrary(panel) {
    section(panel,"TRACE EVERY IDEA","Sources & assigned reading","Official slides stay on Virtuale. References below explain what was reviewed, what is an assigned reading, and what is a supplementary clarification.");
    const label=add(panel,"label","rth-field","Filter sources");const select=add(label,"select");select.setAttribute("aria-label","Filter sources");
    ["All sources",...new Set(data.sources.map(s=>s.kind))].forEach(t=>select.add(new Option(t,t)));
    const grid=add(panel,"div","rth-source-grid");
    function draw(){grid.replaceChildren();data.sources.filter(s=>select.value==="All sources"||s.kind===select.value).forEach(s=>{
      const card=add(grid,"article","rth-source-card");card.id="right-to-health.r."+String(data.sources.indexOf(s)+1).padStart(3,"0");add(card,"p","rth-eyebrow",s.kind);const h=add(card,"h3");h.append(external(s.title+" ↗",s.url));add(card,"p","rth-meta",s.locator);add(card,"p",null,s.note);
    });} select.addEventListener("change",draw);draw();
    resourceCaveat(panel);
  }
  function resourceCaveat(panel) {
    notice(panel,"A book cited inside a slide deck is not automatically a book reviewed in full. The Italian-language reading’s publisher page could not be independently retrieved. The article behind the workshop’s 2026 proposals was not independently reviewed; the guide attributes those proposals to the deck.");
  }
  const PROFILES={
    netherlands:{name:"Netherlands",tag:"Bismarck family · readings 2007/08, critique 2015",source:["nl07","nl08","risk"],funding:"Mandatory basic insurance through regulated private insurers; premiums, income-related arrangements and risk-equalisation transfers in the historical design.",governance:"Insurer choice and purchasing sit within strong public rules, quality information and competition governance.",access:"Basic acceptance obligations and community rating aim to support access. Contract design and residual selection incentives still matter.",challenge:"Can competition reward better care rather than avoidance of undercompensated groups?"},
    italy:{name:"Italy",tag:"Beveridge family · 2024 report",source:["italy"],funding:"Tax-financed SSN with national pooling and regional allocation, plus household payments for some care.",governance:"The central level defines the benefits package; regions and local health authorities organise delivery, with public and accredited private providers.",access:"National coverage coexists with regional differences, waiting and gaps in some services. GPs and paediatricians provide gatekeeping.",challenge:"How can a common entitlement translate into more equal practical access across regions?"},
    norway:{name:"Norway",tag:"Beveridge family · 2025 chapter",source:["norway"],funding:"Predominantly tax-based budgets, with additional activity incentives and explicit priority setting in the chapter’s account.",governance:"Municipal primary, social and long-term care; specialist care organised through state-owned regional structures.",access:"GP lists, hospital choice and coordination reforms seek better access and use of capacity; resource constraints remain.",challenge:"How can efficiency incentives, professional trust and democratic accountability be balanced?"},
    austria:{name:"Austria",tag:"Bismarck family · 2024/25 reports",source:["austria24","austria25"],funding:"Compulsory social-insurance contributions and taxation, with private payments and supplementary cover.",governance:"Responsibilities are shared among federal, Länder and self-governing insurance/provider actors. Joint planning addresses fragmentation.",access:"Broad coverage coexists with geographical and contracting differences. The 2025 profile describes a wait-or-pay dilemma.",challenge:"How can care shift towards accessible primary and ambulatory services without deepening inequities?"}
  };
  function labelledSelect(parent,label,values){const wrap=add(parent,"label","rth-field",label);const s=add(wrap,"select");s.setAttribute("aria-label",label);values.forEach(([v,t])=>s.add(new Option(t,v)));return s;}
  function compare(parent,ctx) {
    add(parent,"h3",null,"Compare two health systems");add(parent,"p",null,"Qualitative comparison of the assigned readings. There is no ranking and no claim that their historical indicators are a live, comparable dataset.");
    const controls=add(parent,"div","rth-controls");const values=Object.entries(PROFILES).map(([k,v])=>[k,v.name]);const left=labelledSelect(controls,"First country",values);const right=labelledSelect(controls,"Second country",values);right.value="italy";
    const grid=add(parent,"div","rth-compare-grid");
    function draw(){grid.replaceChildren();[left.value,right.value].forEach(k=>{const v=PROFILES[k],card=add(grid,"article","rth-compare-card");add(card,"p","rth-eyebrow",v.tag);add(card,"h4",null,v.name);for(const [field,label]of [["funding","Financing"],["governance","Governance & delivery"],["access","Practical access"],["challenge","Question to take to class"]]){add(card,"h5",null,label);add(card,"p",null,v[field]);}card.append(guideLink(ctx,data.units.find(u=>u.slug===k),"Read country guide →"));sources(card,v.source);});}
    left.addEventListener("change",draw);right.addEventListener("change",draw);draw();
  }
  function aaaq(parent) {
    add(parent,"h3",null,"AAAQ: identify the main barrier");add(parent,"p",null,"Four invented examples for learning. Choose the most direct dimension; real situations can involve several dimensions at once.");
    const cases=[
      ["A district does not have enough functioning clinics to meet its population’s needs.","Availability","The primary issue here is sufficient functioning provision."],
      ["An existing service is too expensive for a patient to use.","Accessibility","Affordability belongs to economic accessibility."],
      ["Care ignores patients’ cultural contexts and does not respect medical ethics.","Acceptability","The scenario points to cultural and ethical acceptability."],
      ["A clinic has equipment and staff, but its medicines are expired.","Quality","Scientific and medical appropriateness are central to quality."]
    ];
    const forms=cases.map(([text,answer,why],i)=>{const row=add(parent,"div","rth-case");add(row,"p",null,(i+1)+". "+text);const s=labelledSelect(row,"Dimension for case "+(i+1),[["","Choose a dimension"],...["Availability","Accessibility","Acceptability","Quality"].map(x=>[x,x])]);const msg=add(row,"p","rth-feedback");return{s,msg,answer,why};});
    const result=add(parent,"p","rth-feedback");result.setAttribute("role","status");
    parent.append(button("Check the four cases",()=>{let n=0;forms.forEach(f=>{const match=f.s.value===f.answer;if(match)n++;f.msg.textContent=!f.s.value?"Choose an answer first.":(match?"✓ ":"Review: ")+f.answer+". "+f.why;});result.textContent=n+" of 4 correct. These results are not saved or sent anywhere.";},"button"));sources(parent,["human"]);
  }
  function mobility(parent) {
    add(parent,"h3",null,"Patient mobility: keep the routes separate");notice(parent,"Learning comparison, not an eligibility checker. Consult your insurer or the relevant national contact point before arranging treatment. This panel is supplementary clarification of the compact slide chart.");
    const select=labelledSelect(parent,"Explore a route",[["ehic","EHIC — necessary care during a temporary stay"],["s2","S2 — authorised planned care"],["directive","Directive 2011/24 — cross-border reimbursement"]]);
    const box=add(parent,"div","rth-output");
    const routes={ehic:["EHIC: not a planned-treatment authorisation","The public-authority sources distinguish necessary treatment during a temporary stay from travel whose purpose is obtaining treatment. Public-system participation and local rules matter. Local cost-sharing or upfront payment can still arise; the card is not a guarantee of zero payment."],s2:["S2: a coordination route for planned care","The cited authority describes prior permission through an S2 document and treatment under the public system’s conditions in the country of care. This is not the same as using an EHIC for a trip intended to obtain treatment. Individual conditions must be checked with the responsible institution."],directive:["Directive route: separate payment and reimbursement questions","The course describes a route involving care abroad and reimbursement under the home system’s conditions and limits, commonly after upfront payment. Coverage, possible prior authorisation and the relevant treatment/provider conditions require separate checks. Do not promise the full foreign invoice will be refunded."]};
    function draw(){box.replaceChildren();add(box,"h4",null,routes[select.value][0]);add(box,"p",null,routes[select.value][1]);}select.addEventListener("change",draw);draw();sources(parent,["economic","mobility","ehic"]);
  }
  function expectedMargin(compensation,cost){if(!Number.isFinite(compensation)||!Number.isFinite(cost)||compensation<0||cost<0||compensation>1e8||cost>1e8)return null;return compensation-cost;}
  function risk(parent) {
    add(parent,"h3",null,"Risk equalisation: follow the incentive");add(parent,"p",null,"Invented numbers, one person per year. Compare total compensation available to an insurer with predicted claims cost. This is not the article’s predictive-ratio statistic or an estimated risk-adjustment model.");
    const controls=add(parent,"div","rth-controls");
    function number(label,value){const l=add(controls,"label","rth-field",label);const input=add(l,"input");input.type="number";input.min="0";input.max="100000000";input.step="any";input.value=String(value);return input;}
    const c=number("Total compensation (€ per person/year)",5500),cost=number("Predicted claims (€ per person/year)",7000);
    const out=add(parent,"div","rth-output");out.setAttribute("role","status");
    function draw(){out.replaceChildren();const margin=c.value.trim()&&cost.value.trim()?expectedMargin(c.valueAsNumber,cost.valueAsNumber):null;if(margin===null){add(out,"p",null,"Enter finite, non-negative amounts up to €100,000,000 in both fields.");return;}
      add(out,"p","rth-eyebrow","EXPECTED CLAIMS MARGIN · BEFORE OTHER COSTS");add(out,"strong","rth-number",new Intl.NumberFormat("en",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(margin));
      add(out,"p",null,margin<0?"Predicted claims exceed compensation. The gap illustrates why an undercompensated group may create a selection incentive.":margin>0?"Compensation exceeds predicted claims in this illustration. That is not a guaranteed profit: administration, uncertainty and other costs are omitted.":"Compensation equals predicted claims in this illustration. It does not prove that a real model removes selection incentives.");
      add(out,"p","rth-meta","Arithmetic: compensation − predicted claims. Try changing compensation from 5,500 to 7,000 while holding claims fixed.");}
    c.addEventListener("input",draw);cost.addEventListener("input",draw);draw();sources(parent,["risk","nl08"]);
  }
  function explore(panel,ctx) {
    section(panel,"LEARN BY TESTING IDEAS","Explore the course","Four lightweight activities. Sources, assumptions and limitations stay visible beside each tool.");
    const tools=[["systems","Compare health systems",compare],["aaaq","AAAQ case practice",aaaq],["mobility","Patient-mobility routes",mobility],["risk","Risk-equalisation arithmetic",risk]];
    const select=labelledSelect(panel,"Choose an activity",tools.map(([k,t])=>[k,t]));const host=add(panel,"div","rth-tool");
    const draw=()=>{host.replaceChildren();tools.find(t=>t[0]===select.value)[2](host,ctx);};select.addEventListener("change",draw);draw();
  }

  function casebook(panel,ctx) {
    const cases=Array.isArray(data.cases)?data.cases:[];
    section(panel,"CASEBOOK · THINK BEFORE REVEALING","From a case to a defensible answer","Choose a first answer, examine the reasoning, then state what the evidence does—and does not—establish. This is an original study exercise, not a lecturer’s answer key or individual legal advice.");
    if(!cases.length){notice(panel,"The casebook is unavailable in this saved content version. The guides and practice tools remain available.");return;}
    const controls=add(panel,"div","rth-casebook-filters");
    const filter=labelledSelect(controls,"Casebook topic",[["all","All topics"],...data.units.map(u=>[u.id,u.title])]);
    if(data.units.some(u=>u.id===ctx.params.topic))filter.value=ctx.params.topic;
    const count=add(controls,"p","rth-meta");count.setAttribute("role","status");
    add(panel,"p","rth-casebook-hint rth-meta","On a small screen, swipe the case cards sideways or use the topic filter to find a case.");
    const layout=add(panel,"div","rth-casebook-layout");
    const list=add(layout,"nav","rth-casebook-list");list.setAttribute("aria-label","Choose a case");
    const host=add(layout,"article","rth-casebook-detail");
    let active=null;
    function session(c){if(!caseSessions.has(c.id))caseSessions.set(c.id,{draft:"",answer:null,revealed:0});return caseSessions.get(c.id);}
    function selectCase(c,focus=false){
      active=c;lastCaseId=c.id;const state=session(c);host.replaceChildren();
      list.querySelectorAll("button").forEach(b=>{b.setAttribute("aria-current",String(b.dataset.caseId===c.id));});
      add(host,"p","rth-eyebrow",c.kind);
      const title=add(host,"h3",null,c.title);title.tabIndex=-1;
      add(host,"p","rth-case-scenario",c.scenario);
      add(host,"p","rth-locator","Reading location: "+c.locator);
      const question=add(host,"fieldset","rth-case-question");add(question,"legend",null,"First, make a choice");
      add(question,"p",null,c.check.question);
      const choices=add(question,"div","rth-case-choices");
      const feedback=add(question,"p","rth-feedback");feedback.setAttribute("role","status");
      const choiceButtons=[];
      function updateChoice(){choiceButtons.forEach((b,i)=>{b.setAttribute("aria-pressed",String(i===state.answer));b.classList.toggle("is-correct",state.answer!==null&&i===c.check.answer);b.classList.toggle("is-wrong",i===state.answer&&i!==c.check.answer);b.querySelector(".study-option-state")?.remove();if(state.answer!==null&&(i===c.check.answer||i===state.answer))add(b,"span","study-option-state",i===c.check.answer?"✓ Correct answer":"× Your answer");});feedback.textContent=state.answer===null?"Choose an answer to see feedback.":(state.answer===c.check.answer?"Correct. ":"Reconsider this choice. ")+c.check.explanation;}
      c.check.options.forEach((option,i)=>{const b=button("",()=>{state.answer=i;updateChoice();},"rth-case-choice");const badge=add(b,"span","study-option-letter",String.fromCharCode(65+i));badge.setAttribute("aria-hidden","true");add(b,"span","study-option-text",option);b.setAttribute("aria-label",String.fromCharCode(65+i)+". "+option);b.setAttribute("aria-pressed","false");choiceButtons.push(b);choices.append(b);});updateChoice();
      const draftLabel=add(host,"label","rth-field","Your analysis (optional)");
      add(draftLabel,"span","rth-meta","Use a hypothetical example. No patient or sensitive personal details. This note stays only in page memory, including when switching cases or tabs. Refreshing or closing the page loses it. Export to keep a copy.");
      const draft=add(draftLabel,"textarea");draft.rows=4;draft.maxLength=3000;draft.value=state.draft;draft.placeholder="Issue → source → application → limitation";
      const draftStatus=add(host,"p","rth-meta");draftStatus.setAttribute("role","status");
      function countWords(){const n=state.draft.trim()?state.draft.trim().split(/\s+/).length:0;draftStatus.textContent=n+" words · Not saved to browser storage or submitted · No automatic grading";}
      draft.addEventListener("input",()=>{state.draft=draft.value.slice(0,3000);countWords();});countWords();
      const exportButton=button("Export my analysis (.txt)",()=>{const text="EU-HEM · Right to Health · Original case exercise\n"+c.title+"\n"+c.kind+"\n\n"+c.scenario+"\n\nMy analysis\n"+state.draft+"\n\nReading location: "+c.locator+"\nNot an official submission or grade.\n";const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));const a=el("a");a.href=url;a.download=c.id+"-analysis.txt";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);draftStatus.textContent="Analysis export prepared. The browser controls where it is saved.";});host.append(exportButton);
      const reasoning=add(host,"section","rth-case-reasoning");add(reasoning,"h4",null,"Build the reasoning");
      const stepStatus=add(reasoning,"p","rth-meta");stepStatus.setAttribute("role","status");
      const steps=add(reasoning,"div","rth-case-steps");
      const reveal=button("Reveal the first step",()=>{if(state.revealed<c.steps.length)state.revealed++;drawSteps(true);},"button");
      const reset=button("Hide reasoning",()=>{state.revealed=0;drawSteps(false);reveal.focus();});
      const actions=add(reasoning,"div","button-row");actions.append(reveal,reset);
      const conclusion=add(reasoning,"div","rth-case-conclusion");
      function drawSteps(focus){
        steps.replaceChildren();conclusion.replaceChildren();
        c.steps.slice(0,state.revealed).forEach((step,i)=>{const box=add(steps,"section","rth-case-step");add(box,"span","rth-case-step-number",String(i+1).padStart(2,"0"));const t=add(box,"h5",null,step.title);t.tabIndex=-1;add(box,"p",null,step.text);});
        stepStatus.textContent=state.revealed+" of "+c.steps.length+" reasoning steps revealed";
        reveal.hidden=state.revealed===c.steps.length;reveal.textContent=state.revealed?"Reveal the next step":"Reveal the first step";reset.hidden=!state.revealed;
        conclusion.hidden=state.revealed<c.steps.length;
        if(!conclusion.hidden){add(conclusion,"h5",null,"A bounded conclusion");add(conclusion,"p",null,c.conclusion);add(conclusion,"h5",null,"Common trap");add(conclusion,"p",null,c.trap);}
        if(focus){const h=steps.querySelector(".rth-case-step:last-child h5");h?.focus({preventScroll:true});h?.scrollIntoView({block:"nearest"});}
      }
      drawSteps(false);sources(host,c.sources);
      const related=add(host,"div","button-row");const unit=data.units.find(u=>u.id===c.topic);if(unit)related.append(guideLink(ctx,unit,"Read the related guide →"));
      related.append(ctx.pageLink("Practice this topic →",{tab:"practice",practiceTopic:c.topic},"button button-light"));
      if(focus){title.focus({preventScroll:true});title.scrollIntoView({block:"start"});}
    }
    function drawList(){
      const visible=cases.filter(c=>filter.value==="all"||c.topic===filter.value);
      list.replaceChildren();count.textContent=visible.length+" of "+cases.length+" cases";
      visible.forEach(c=>{const b=button("",()=>selectCase(c,true),"rth-case-select");b.dataset.caseId=c.id;add(b,"span","rth-eyebrow",c.id.replace("rth-case-","CASE "));add(b,"strong",null,c.title);add(b,"span","rth-meta",c.kind);list.append(b);});
      if(visible.length)selectCase(visible.find(c=>c.id===active?.id)||visible.find(c=>c.id===lastCaseId)||visible[0]);
      else{host.replaceChildren();notice(host,"No cases for this topic in this edition.");}
    }
    filter.addEventListener("change",drawList);drawList();
  }

  const FIELDS=[
    ["need","1. Whose need?","Define a group and a concrete access or health-system problem."],
    ["framework","2. What is the existing framework?","State what the sources establish; distinguish it from a proposal or a point still needing verification."],
    ["values","3. Which value and principle?","Connect a broad commitment to a practical principle. Explain why it is relevant."],
    ["action","4. What action and resources?","Specify a measure, an accountable actor and the resources it requires."],
    ["tradeoff","5. What could go wrong?","Identify a trade-off, a possibly disadvantaged group and a safeguard."],
    ["evaluation","6. How would you assess it?","State a useful indicator, its population and a review or participation process."]
  ];
  function cleanDraft(raw){const d={};for(const[k]of FIELDS)d[k]=raw&&typeof raw[k]==="string"?raw[k].slice(0,2000):"";return d;}
  function workshop(panel) {
    section(panel,"EUROPEAN HEALTH UNION","Your workshop preparation sheet","An original thinking scaffold—not an official assignment, assessment rubric or request to support a political position.");
    notice(panel,"Use hypothetical policy examples only. Do not enter patient details or sensitive personal information. Your draft stays in this page until you choose Save on this device. It is not submitted to the lecturer and is separate from the Hub’s study-progress backup.");
    const prep=add(panel,"div","rth-prep");add(prep,"h3",null,"Before the session");add(prep,"p",null,"Read the manifesto and the 2006 Council conclusions in detail. Compare their purpose, legal status and practical implications. Agreement or signing is not required by this Hub exercise.");sources(prep,["council06","manifesto","ehu"]);
    const draft=cleanDraft(readStorage(DRAFT_KEY,null));const inputs={};
    const grid=add(panel,"div","rth-workshop-grid");for(const[k,title,hint]of FIELDS){const label=add(grid,"label","rth-field",title);add(label,"span","rth-meta",hint);const t=add(label,"textarea");t.rows=5;t.maxLength=2000;t.value=draft[k];inputs[k]=t;}
    const status=add(panel,"p","rth-feedback");status.setAttribute("role","status");
    Object.values(inputs).forEach(t=>t.addEventListener("input",()=>{status.textContent="Unsaved edits in this page. Save or export before leaving.";}));
    function values(){return Object.fromEntries(FIELDS.map(([k])=>[k,inputs[k].value]));}
    const actions=add(panel,"div","button-row");
    actions.append(button("Save on this device",()=>{if(writeStorage(DRAFT_KEY,values())){status.textContent="Saved only in this browser. Not submitted or shared.";}else status.textContent="Storage is unavailable. Export your draft instead.";},"button"));
    actions.append(button("Export draft (.txt)",()=>{const text="EU-HEM · Right to Health · Original workshop preparation\nNot an official submission\n\n"+FIELDS.map(([k,t])=>t+"\n"+inputs[k].value).join("\n\n");const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));const a=el("a");a.href=url;a.download="right-to-health-workshop.txt";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent="Draft export prepared. Your browser controls where the file is saved.";}));
    const reset=button("Clear this draft",()=>{if(reset.dataset.confirm!=="yes"){reset.dataset.confirm="yes";reset.textContent="Confirm clear this draft";status.textContent="This clears only the workshop draft. Click again to confirm.";return;}Object.values(inputs).forEach(t=>t.value="");const saved=writeStorage(DRAFT_KEY,{});status.textContent=saved?"Workshop draft cleared. Study progress is unchanged.":"Draft cleared in this page; browser storage could not be updated.";reset.dataset.confirm="";reset.textContent="Clear this draft";});actions.append(reset);
    // Do not add a permanent beforeunload listener on every render. State is explicit in UI.
    add(panel,"p","rth-meta","There is no automatic grade: a defensible proposal may take different positions when its assumptions and trade-offs are clear.");
  }
  function scheduleNotes(panel) {
    const d=add(panel,"details","rth-sources");add(d,"summary",null,"Guest sessions & workshop: supplied course notice");
    add(d,"p",null,"These are the times copied from the course notice, not a second live timetable. Check the official schedule below and Virtuale for changes. All times are Bologna local time.");
    [["20 Oct 2026 · 09:00–12:00","09:15 Netherlands — Wynand van de Ven; 10:45 Italy — Rosella Levaggi."],["21 Oct 2026 · 08:00–11:00","European Health Union workshop; read the two preparation documents."],["22 Oct 2026 · 08:00–11:00","08:15 Norway — listed as Terje Haagen in the notice (the supplied chapter names Terje P. Hagen); 09:45 Austria — Lukas Kerschbaumer."]].forEach(([t,b])=>{add(d,"h4",null,t);add(d,"p",null,b);});
    add(d,"p","rth-meta","The country slots in the notice are 45 minutes of presentation plus 15 minutes of Q&A, with introductions, a break and a closing discussion in the whole session.");
    d.append(external("Country-session notice on Virtuale ↗","https://virtuale.unibo.it/course/section.php?id=866428"),external("Workshop notice on Virtuale ↗","https://virtuale.unibo.it/course/section.php?id=866430"));
  }
  function render(panel,tab,ctx) {
    if(!data)return false;panel.classList.add("rth-panel");
    const handlers={overview,lectures:learningPath,topics:reader,concepts:glossary,casebook,explore,workshop,resources:sourceLibrary};
    if(handlers[tab]){handlers[tab](panel,ctx);return true;}
    if(tab==="practice") {section(panel,"ACTIVE RECALL","Practice with explanations",ctx.course.questions.filter(q=>q.type==="mcq").length+" original multiple-choice questions, "+ctx.course.questions.filter(q=>q.type==="short-answer").length+" open-answer scaffolds and "+ctx.course.flashcards.length+" flashcards. Every answer includes its source. Not past papers or predictions of the exam.");notice(panel,"Course sources are the basis; invented scenarios are labelled. The shared practice tools below keep their existing local-progress, topic filters and review controls.");}
    if(tab==="exam") {section(panel,"PREPARATION, NOT PREDICTION","Exam information","Use the official exam feed for dates and registration. The organizational material states the assessment format but does not independently confirm an exam date.");organisation(panel);}
    if(tab==="schedule")scheduleNotes(panel);
    return false;
  }
  root.RightToHealth={prepare,ready:()=>Boolean(data),header,render,expectedMargin,cleanDraft,scheduleNotes,organisation,resourceCaveat};
  if(typeof module!=="undefined"&&module.exports)module.exports={expectedMargin,cleanDraft};
})(typeof window!=="undefined"?window:globalThis);
