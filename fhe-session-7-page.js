// Dedicated renderer for Fundamentals in Health Economics — Session 7.
(function (root) {
  "use strict";

  const COURSE_ID = "fund-health-econ-management";
  const MODULE_ID = "fund-health-economics";
  const TOPIC_ID = "fund-health-economics.adverse-selection";
  const host = document.getElementById("session7-page");
  const status = document.getElementById("session7-status");

  let module;
  let config;
  let guideHtml;
  let questions = [];
  let flashcards = [];
  let activeView = "learn";

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function statusLabel() {
    const value = getTopicStatus(loadProgress(), TOPIC_ID);
    if (value === "understood") return "Marked as understood on this device.";
    if (value === "read") return "Marked as read on this device.";
    return "Not marked yet. Your progress stays in this browser.";
  }

  function setStatus(value) {
    setTopicStatus(TOPIC_ID, value);
    host.querySelectorAll("[data-session7-status]").forEach((node) => { node.textContent = statusLabel(); });
    host.querySelectorAll("[data-session7-mark]").forEach((button) => button.classList.toggle("is-active", button.dataset.session7Mark === value));
  }

  function switchView(view) {
    activeView = view;
    host.querySelectorAll("[data-session7-view]").forEach((section) => { section.hidden = section.dataset.session7View !== view; });
    host.querySelectorAll("[data-session7-tab]").forEach((button) => button.setAttribute("aria-current", button.dataset.session7Tab === view ? "page" : "false"));
    host.querySelector(`[data-session7-view="${view}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildHero() {
    const hero = el("section", "hero insurance-session-hero selection-session-hero");
    const copy = el("div");
    copy.innerHTML = `
      <span class="pill"><span class="dot"></span> SESSION 7 · INSURANCE II</span>
      <p class="eyebrow">FUNDAMENTALS IN HEALTH ECONOMICS · 79060</p>
      <h1>${config.heroTitle.replace("\n", "<br>")}</h1>
      <p class="lead">${config.intro}</p>
    `;
    const actions = el("div", "hero-actions");
    [["explore", "Open the adverse-selection lab ↗"], ["practice", "Take the Session 7 quiz →"], ["flashcards", "Review flashcards"]].forEach(([view, label], index) => {
      const button = el("button", index === 0 ? "btn" : "btn secondary", label);
      button.type = "button";
      button.addEventListener("click", () => switchView(view));
      actions.appendChild(button);
    });
    copy.appendChild(actions);
    const meta = el("div", "hero-meta");
    meta.append(el("span", null, `${questions.length} practice questions`), el("span", null, `${flashcards.length} flashcards`), el("span", null, `${config.activities.length} interactive tools`));
    copy.appendChild(meta);

    const visual = el("div", "visual insurance-session-visual selection-session-visual");
    visual.innerHTML = `
      <p class="eyebrow">THE SESSION IN ONE PICTURE</p>
      <div class="visual-title">Hidden risk bends the market away from first best.</div>
      <svg viewBox="0 0 440 260" role="img" aria-labelledby="s7-hero-title s7-hero-desc">
        <title id="s7-hero-title">Pooling and separating insurance contracts</title>
        <desc id="s7-hero-desc">An original contract-space diagram with low-risk, pooling and high-risk zero-profit lines and a separating pair of contracts.</desc>
        <path d="M38 220H405M65 238V30" stroke="#ffffff45"/>
        <path d="M65 220L350 42" stroke="#ffffff55" stroke-dasharray="6 5"/>
        <path d="M78 218L255 36" stroke="#8dc9bd" stroke-width="3"/>
        <path d="M78 218L305 72" stroke="#b39ddb" stroke-width="3"/>
        <path d="M78 218L360 126" stroke="#e9a47c" stroke-width="3"/>
        <circle cx="220" cy="72" r="7" fill="#8dc9bd"/><text x="229" y="67" fill="#fff" font-size="12">C′L</text>
        <circle cx="182" cy="146" r="7" fill="#e9a47c"/><text x="191" y="143" fill="#fff" font-size="12">CH</text>
        <circle cx="280" cy="105" r="6" fill="#b39ddb"/><text x="289" y="100" fill="#fff" font-size="12">pooling</text>
        <text x="250" y="28" fill="#8dc9bd" font-size="11">L break-even</text>
        <text x="330" y="70" fill="#b39ddb" font-size="11">mixed pool</text>
        <text x="342" y="143" fill="#e9a47c" font-size="11">H break-even</text>
      </svg>
      <div class="visual-note">Competition can break pooling; separation protects incentives by restricting low-risk coverage. Original Student Hub illustration.</div>
    `;
    hero.append(copy, visual);
    return hero;
  }

  function buildToolbar() {
    const bar = el("div", "lecture-toolbar insurance-session-toolbar");
    bar.appendChild(el("span", "eyebrow", "SESSION 7 STUDY WORKSPACE"));
    const nav = el("nav", "nav");
    nav.setAttribute("aria-label", "Session 7 sections");
    [["learn", "01 · Learn"], ["explore", "02 · Explore"], ["practice", "03 · Practice"], ["flashcards", "04 · Flashcards"]].forEach(([view, label]) => {
      const button = el("button", "", label);
      button.type = "button";
      button.dataset.session7Tab = view;
      button.setAttribute("aria-current", view === activeView ? "page" : "false");
      button.addEventListener("click", () => switchView(view));
      nav.appendChild(button);
    });
    bar.appendChild(nav);
    return bar;
  }

  function buildStudyActions() {
    const actions = el("div", "lecture-study-actions");
    const label = el("span", "small muted", statusLabel());
    label.dataset.session7Status = "true";
    const read = el("button", "btn secondary small-btn", "Mark as read");
    read.type = "button"; read.dataset.session7Mark = "read"; read.addEventListener("click", () => setStatus("read"));
    const understood = el("button", "btn secondary small-btn", "Mark as understood");
    understood.type = "button"; understood.dataset.session7Mark = "understood"; understood.addEventListener("click", () => setStatus("understood"));
    const course = el("a", "small", "Course hub"); course.href = `course.html?course=${COURSE_ID}`;
    actions.append(label, read, understood, course);
    return actions;
  }

  function buildLearn() {
    const section = el("section");
    section.dataset.session7View = "learn";
    section.append(buildHero(), buildStudyActions());
    const notice = el("div", "note lecture-notice");
    notice.innerHTML = `<span>${config.attribution}</span><a href="https://virtuale.unibo.it/course/view.php?id=80559" target="_blank" rel="noopener">Open official materials on Virtuale ↗</a>`;
    section.appendChild(notice);
    const guide = el("div"); guide.innerHTML = guideHtml; section.appendChild(guide);
    const cta = el("div", "cta");
    cta.innerHTML = '<div><h2>Ready to test the market?</h2><p>Change risk composition, draw break-even lines and see when a contract menu separates the types.</p></div>';
    const button = el("button", "btn", "Open the adverse-selection lab →"); button.type = "button"; button.addEventListener("click", () => switchView("explore"));
    cta.appendChild(button); section.appendChild(cta);
    return section;
  }

  function buildExplore() {
    const section = el("section"); section.dataset.session7View = "explore"; section.hidden = true;
    section.innerHTML = '<div class="page-head"><p class="eyebrow">02 / Explore</p><h1>Make hidden risk visible.</h1><p>These original tools preserve the lecture equations and use square-root utility only where a numerical preference comparison is needed.</p></div>';
    const container = el("div"); section.appendChild(container); root.LectureActivities.init(container, config.activities); return section;
  }

  function choice(question, value, text) {
    const label = el("label", "choice"); const input = document.createElement("input"); input.type = "radio"; input.name = `s7-${question.id}`; input.value = value; label.append(input, el("span", null, text)); return label;
  }

  function buildPractice() {
    const section = el("section", "session6-practice"); section.dataset.session7View = "practice"; section.hidden = true;
    section.innerHTML = '<div class="page-head"><p class="eyebrow">03 / Practice</p><h1>Follow the selection logic.</h1><p>A 15-question objective set is drawn from Session 7. Written questions below focus on derivations and policy reasoning.</p></div>';
    const objective = questions.filter((q) => q.type !== "short-answer");
    const written = questions.filter((q) => q.type === "short-answer");
    let quiz = shuffle(objective).slice(0, 15), current = 0;
    const answers = new Map(), checked = new Map();
    const layout = el("div", "quiz-layout"), side = el("aside", "card quiz-side"), card = el("article", "card quiz-card");
    side.innerHTML = '<p class="eyebrow practice-side-title">This Session 7 set</p>';
    const progressText = el("h3", null, "0 of 15 checked"), progress = el("div", "progress-track"), score = el("p", "muted", "Answers are explained after checking."), map = el("div", "question-map"), reset = el("button", "btn secondary small-btn", "New random set");
    progress.setAttribute("role", "progressbar"); progress.innerHTML = '<div class="progress-fill" style="width:0%"></div>'; reset.type = "button";
    side.append(progressText, progress, score, map, reset); layout.append(side, card); section.appendChild(layout);

    const updateSide = () => {
      const done = checked.size, correct = [...checked.values()].filter(Boolean).length;
      progressText.textContent = `${done} of ${quiz.length} checked`;
      progress.querySelector(".progress-fill").style.width = `${Math.round(done / quiz.length * 100)}%`;
      score.textContent = done ? `${correct} correct · ${done-correct} to revisit` : "Answers are explained after checking.";
      map.innerHTML = "";
      quiz.forEach((q, i) => { const b = el("button", "", String(i+1)); b.type = "button"; if (i === current) b.classList.add("is-current"); if (checked.has(q.id)) b.classList.add(checked.get(q.id) ? "is-correct" : "is-revisit"); b.addEventListener("click", () => { current=i; render(); }); map.appendChild(b); });
      if (done === quiz.length) recordQuiz(COURSE_ID, Math.round(correct / quiz.length * 100));
    };

    const render = () => {
      const q = quiz[current], selected = answers.get(q.id), result = checked.get(q.id); card.innerHTML = "";
      card.append(el("p", "eyebrow", `QUESTION ${current+1} / ${quiz.length} · ${q.type === "mcq" ? "MULTIPLE CHOICE" : "TRUE / FALSE"}`), el("h2", null, q.question));
      const choices = el("div", "choices");
      if (q.type === "mcq") q.options.forEach((option, i) => { const value = String.fromCharCode(65+i), label = choice(q, value, `${value}. ${option}`), input = label.querySelector("input"); input.checked = selected === value; input.disabled = result !== undefined; input.addEventListener("change", () => answers.set(q.id, value)); choices.appendChild(label); });
      else [["true","True"],["false","False"]].forEach(([value,text]) => { const label=choice(q,value,text), input=label.querySelector("input"); input.checked=selected===value; input.disabled=result!==undefined; input.addEventListener("change",()=>answers.set(q.id,value)); choices.appendChild(label); });
      card.appendChild(choices);
      const feedback = el("div", "feedback"); if (result !== undefined) { feedback.classList.add(result ? "correct" : "incorrect"); feedback.innerHTML = `<strong>${result ? "Correct." : "Revisit this one."}</strong> ${q.explanation || ""}`; } card.appendChild(feedback);
      const action = el("button", "btn", result === undefined ? "Check answer" : current === quiz.length-1 ? "Review from the start" : "Next question →"); action.type = "button";
      action.addEventListener("click", () => { if (result === undefined) { const value = answers.get(q.id); if (value === undefined) return; checked.set(q.id, q.type === "true-false" ? value === String(q.answer) : value === q.answer); } else current = current === quiz.length-1 ? 0 : current+1; render(); updateSide(); });
      card.appendChild(action); updateSide();
    };
    reset.addEventListener("click", () => { quiz=shuffle(objective).slice(0,15); current=0; answers.clear(); checked.clear(); render(); }); render();

    const open = el("section", "session6-open-practice");
    open.innerHTML = `<div class="section-intro"><div><p class="eyebrow">WRITTEN PRACTICE</p><h2>${written.length} open questions with model answers.</h2></div><p>Write before opening the model answer. Focus on selection, equilibrium and welfare logic.</p></div>`;
    const list = el("div", "details-stack card");
    written.forEach((q, i) => { const details=document.createElement("details"), summary=document.createElement("summary"); summary.textContent=`${i+1}. ${q.question}`; details.appendChild(summary); const answer=el("div","note"); answer.style.marginTop="14px"; answer.innerHTML=`<strong>Model answer</strong><br>${q.answer}`; details.append(answer, el("p","small muted",q.explanation||"")); list.appendChild(details); });
    open.appendChild(list); section.appendChild(open); return section;
  }

  function buildFlashcards() {
    const section = el("section", "session6-flashcards"); section.dataset.session7View = "flashcards"; section.hidden = true;
    section.innerHTML = '<div class="page-head"><p class="eyebrow">04 / Flashcards</p><h1>Recall the market mechanism.</h1><p>Flip each card, grade it and keep the distinction between pooling, separation and policy clear.</p></div>';
    let deck=[...flashcards], index=0, back=false;
    const card=el("button","session6-flashcard"); card.type="button"; const count=el("p","eyebrow"), face=el("div","session6-flashcard-face"); card.append(count,face);
    const controls=el("div","session6-card-controls"), previous=el("button","btn secondary small-btn","← Previous"), shuffleButton=el("button","btn secondary small-btn","Shuffle"), next=el("button","btn secondary small-btn","Next →"); previous.type=shuffleButton.type=next.type="button"; controls.append(previous,shuffleButton,next);
    const grades=el("div","session6-card-grades"); [["again","Again"],["hard","Hard"],["good","Good"],["easy","Easy"]].forEach(([value,label])=>{const b=el("button","btn secondary small-btn",label); b.type="button"; b.addEventListener("click",()=>{gradeCard(deck[index].id,value); index=(index+1)%deck.length; back=false; draw();}); grades.appendChild(b);});
    const draw=()=>{const current=deck[index]; count.textContent=`CARD ${index+1} / ${deck.length} · ${back?"ANSWER":"QUESTION"}`; face.textContent=back?current.back:current.front;};
    card.addEventListener("click",()=>{back=!back;draw();}); previous.addEventListener("click",()=>{index=(index-1+deck.length)%deck.length;back=false;draw();}); next.addEventListener("click",()=>{index=(index+1)%deck.length;back=false;draw();}); shuffleButton.addEventListener("click",()=>{deck=shuffle(deck);index=0;back=false;draw();});
    section.append(card,controls,grades); draw(); return section;
  }

  async function init() {
    try {
      const data = await loadAll();
      const course = data.courses.find((item) => item.id === COURSE_ID);
      module = data.modules.find((item) => item.id === MODULE_ID);
      const topic = module?.topics.find((item) => item.id === TOPIC_ID);
      if (!course || !module || !topic) throw new Error("Session 7 course data is missing.");
      config = await loadLecture(module, topic, fetchText);
      guideHtml = await fetchText(module.folder + config.guide);
      if (!config || guideHtml === null) throw new Error("Session 7 lecture files could not be loaded.");
      questions = module.questions.filter((q) => q.topic === TOPIC_ID && !q.sample);
      flashcards = module.flashcards.filter((q) => q.topic === TOPIC_ID && !q.sample);
      status.hidden = true; host.hidden = false; host.innerHTML = "";
      if (root.HealthEconManagement?.identity) host.appendChild(root.HealthEconManagement.identity("lectures"));
      host.append(buildToolbar(), buildLearn(), buildExplore(), buildPractice(), buildFlashcards());
      setStatus(getTopicStatus(loadProgress(), TOPIC_ID));
    } catch (error) {
      console.error("Session 7 page:", error);
      status.textContent = "Session 7 could not be loaded. Please reload the page or use the official course materials on Virtuale.";
    }
  }

  init();
})(window);
