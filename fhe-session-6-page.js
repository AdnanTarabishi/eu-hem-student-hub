// Dedicated renderer for Fundamentals in Health Economics — Session 6.
(function (root) {
  "use strict";

  const COURSE_ID = "fund-health-econ-management";
  const MODULE_ID = "fund-health-economics";
  const TOPIC_ID = "fund-health-economics.insurance-demand";
  const host = document.getElementById("session6-page");
  const status = document.getElementById("session6-status");

  let data;
  let course;
  let module;
  let topic;
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

  const link = (label, href, className = "small") => {
    const node = el("a", className, label);
    node.href = href;
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
    document.querySelectorAll("[data-session6-status]").forEach((node) => {
      node.textContent = statusLabel();
    });
    document.querySelectorAll("[data-session6-mark]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.session6Mark === value);
    });
  }

  function switchView(view) {
    activeView = view;
    host.querySelectorAll("[data-session6-view]").forEach((section) => {
      section.hidden = section.dataset.session6View !== view;
    });
    host.querySelectorAll("[data-session6-tab]").forEach((button) => {
      const active = button.dataset.session6Tab === view;
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    const target = host.querySelector(`[data-session6-view="${view}"]`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildHero() {
    const hero = el("section", "hero insurance-session-hero");
    const copy = el("div");
    copy.innerHTML = `
      <span class="pill"><span class="dot"></span> SESSION 6 · INSURANCE I</span>
      <p class="eyebrow">FUNDAMENTALS IN HEALTH ECONOMICS · 79060</p>
      <h1>${config.heroTitle.replace("\n", "<br>")}</h1>
      <p class="lead">${config.intro}</p>
    `;
    const actions = el("div", "hero-actions");
    for (const [view, label] of [
      ["explore", "Explore the insurance lab ↗"],
      ["practice", "Take the Session 6 quiz →"],
      ["flashcards", "Review flashcards"],
    ]) {
      const button = el("button", view === "explore" ? "btn" : "btn secondary", label);
      button.type = "button";
      button.addEventListener("click", () => switchView(view));
      actions.appendChild(button);
    }
    copy.appendChild(actions);
    const meta = el("div", "hero-meta");
    meta.append(
      el("span", null, `${questions.length} practice questions`),
      el("span", null, `${flashcards.length} flashcards`),
      el("span", null, `${config.activities.length} interactive tools`),
    );
    copy.appendChild(meta);

    const visual = el("div", "visual insurance-session-visual");
    visual.innerHTML = `
      <p class="eyebrow">THE BENCHMARK IN ONE PICTURE</p>
      <div class="visual-title">Move income from the healthy state to the sick state.</div>
      <svg viewBox="0 0 440 250" role="img" aria-labelledby="s6-hero-title s6-hero-desc">
        <title id="s6-hero-title">Insurance equalises income across health states</title>
        <desc id="s6-hero-desc">An original diagram showing healthy and sick incomes before insurance and equal secured incomes after full fair insurance.</desc>
        <path d="M35 210H405" stroke="#ffffff45"/><path d="M70 35V210" stroke="#ffffff45"/>
        <rect x="105" y="65" width="70" height="145" rx="8" fill="#8dc9bd" opacity=".82"/>
        <rect x="195" y="128" width="70" height="82" rx="8" fill="#e9a47c" opacity=".82"/>
        <path d="M140 62 C190 22 250 22 300 62" fill="none" stroke="#dbe6d4" stroke-width="2" stroke-dasharray="5 5"/>
        <path d="M300 62V210" stroke="#dbe6d4" stroke-width="70" opacity=".19"/>
        <text x="140" y="229" text-anchor="middle" fill="#dbe6d4" font-size="11">healthy</text>
        <text x="230" y="229" text-anchor="middle" fill="#dbe6d4" font-size="11">sick</text>
        <text x="300" y="229" text-anchor="middle" fill="#dbe6d4" font-size="11">insured</text>
        <text x="140" y="56" text-anchor="middle" fill="#ffffff" font-size="13">yₕ</text>
        <text x="230" y="119" text-anchor="middle" fill="#ffffff" font-size="13">yₛ</text>
        <text x="300" y="53" text-anchor="middle" fill="#ffffff" font-size="13">yₕ = yₛ</text>
        <path d="M174 78 L194 121" stroke="#e9a47c" stroke-width="2" marker-end="url(#none)"/>
      </svg>
      <div class="visual-note">With fair full insurance, I = M and both states produce income y − pM. Original Student Hub illustration.</div>
    `;
    hero.append(copy, visual);
    return hero;
  }

  function buildToolbar() {
    const bar = el("div", "lecture-toolbar insurance-session-toolbar");
    bar.appendChild(el("span", "eyebrow", "SESSION 6 STUDY WORKSPACE"));
    const nav = el("nav", "nav");
    nav.setAttribute("aria-label", "Session 6 sections");
    const labels = [
      ["learn", "01 · Learn"],
      ["explore", "02 · Explore"],
      ["practice", "03 · Practice"],
      ["flashcards", "04 · Flashcards"],
    ];
    for (const [view, labelText] of labels) {
      const button = el("button", "", labelText);
      button.type = "button";
      button.dataset.session6Tab = view;
      button.setAttribute("aria-current", view === activeView ? "page" : "false");
      button.addEventListener("click", () => switchView(view));
      nav.appendChild(button);
    }
    bar.appendChild(nav);
    return bar;
  }

  function buildStudyActions() {
    const actions = el("div", "lecture-study-actions");
    const label = el("span", "small muted", statusLabel());
    label.dataset.session6Status = "true";
    const read = el("button", "btn secondary small-btn", "Mark as read");
    read.type = "button";
    read.dataset.session6Mark = "read";
    read.addEventListener("click", () => setStatus("read"));
    const understood = el("button", "btn secondary small-btn", "Mark as understood");
    understood.type = "button";
    understood.dataset.session6Mark = "understood";
    understood.addEventListener("click", () => setStatus("understood"));
    actions.append(label, read, understood, link("Course hub", `course.html?course=${COURSE_ID}`));
    return actions;
  }

  function buildLearn() {
    const section = el("section");
    section.dataset.session6View = "learn";
    section.append(buildHero(), buildStudyActions());
    const notice = el("div", "note lecture-notice");
    notice.innerHTML = `<span>${config.attribution}</span><a href="https://virtuale.unibo.it/course/view.php?id=80559" target="_blank" rel="noopener">Open official materials on Virtuale ↗</a>`;
    section.appendChild(notice);
    const guide = el("div");
    guide.innerHTML = guideHtml;
    section.appendChild(guide);
    const cta = el("div", "cta");
    cta.innerHTML = '<div><h2>Ready to apply the model?</h2><p>Use the insurance calculators, then test the distinction between fairness and fullness.</p></div>';
    const button = el("button", "btn", "Open the insurance lab →");
    button.type = "button";
    button.addEventListener("click", () => switchView("explore"));
    cta.appendChild(button);
    section.appendChild(cta);
    return section;
  }

  function buildExplore() {
    const section = el("section");
    section.dataset.session6View = "explore";
    section.hidden = true;
    section.innerHTML = '<div class="page-head"><p class="eyebrow">02 / Explore</p><h1>Make the insurance model move.</h1><p>Change one assumption at a time. The square-root utility examples are explicit Student Hub teaching choices; the contract equations and classifications follow Session 6.</p></div>';
    const container = el("div");
    section.appendChild(container);
    root.LectureActivities.init(container, config.activities);
    return section;
  }

  function choiceLabel(question, value, labelText) {
    const label = el("label", "choice");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = `s6-${question.id}`;
    input.value = value;
    label.append(input, el("span", null, labelText));
    return label;
  }

  function buildPractice() {
    const section = el("section", "session6-practice");
    section.dataset.session6View = "practice";
    section.hidden = true;
    section.innerHTML = '<div class="page-head"><p class="eyebrow">03 / Practice</p><h1>Check the benchmark, not just the vocabulary.</h1><p>A 15-question objective set is drawn from the Session 6 bank. Open questions remain below for written practice.</p></div>';

    const objectivePool = questions.filter((question) => question.type !== "short-answer");
    const openQuestions = questions.filter((question) => question.type === "short-answer");
    let quiz = shuffle(objectivePool).slice(0, 15);
    let current = 0;
    const answers = new Map();
    const checked = new Map();

    const layout = el("div", "quiz-layout");
    const side = el("aside", "card quiz-side");
    side.innerHTML = '<p class="eyebrow practice-side-title">This Session 6 set</p>';
    const progressText = el("h3", null, "0 of 15 checked");
    const progress = el("div", "progress-track");
    progress.setAttribute("role", "progressbar");
    progress.innerHTML = '<div class="progress-fill" style="width:0%"></div>';
    const score = el("p", "muted", "Answers are explained after you check each item.");
    const map = el("div", "question-map");
    const reset = el("button", "btn secondary small-btn", "New random set");
    reset.type = "button";
    side.append(progressText, progress, score, map, reset);
    const card = el("article", "card quiz-card");
    layout.append(side, card);
    section.appendChild(layout);

    const updateSide = () => {
      const done = checked.size;
      const correct = [...checked.values()].filter(Boolean).length;
      progressText.textContent = `${done} of ${quiz.length} checked`;
      progress.querySelector(".progress-fill").style.width = `${Math.round((done / quiz.length) * 100)}%`;
      progress.setAttribute("aria-valuenow", String(done));
      progress.setAttribute("aria-valuemax", String(quiz.length));
      score.textContent = done ? `${correct} correct · ${done - correct} to revisit` : "Answers are explained after you check each item.";
      map.innerHTML = "";
      quiz.forEach((question, index) => {
        const button = el("button", "", String(index + 1));
        button.type = "button";
        if (index === current) button.classList.add("is-current");
        if (checked.has(question.id)) button.classList.add(checked.get(question.id) ? "is-correct" : "is-revisit");
        button.addEventListener("click", () => { current = index; renderQuestion(); });
        map.appendChild(button);
      });
      if (done === quiz.length) recordQuiz(COURSE_ID, Math.round((correct / quiz.length) * 100));
    };

    const renderQuestion = () => {
      const question = quiz[current];
      const chosen = answers.get(question.id);
      const result = checked.get(question.id);
      card.innerHTML = "";
      card.appendChild(el("p", "eyebrow", `QUESTION ${current + 1} / ${quiz.length} · ${question.type === "mcq" ? "MULTIPLE CHOICE" : "TRUE / FALSE"}`));
      card.appendChild(el("h2", null, question.question));
      const choices = el("div", "choices");
      if (question.type === "mcq") {
        question.options.forEach((option, index) => {
          const letter = String.fromCharCode(65 + index);
          const label = choiceLabel(question, letter, `${letter}. ${option}`);
          const input = label.querySelector("input");
          input.checked = chosen === letter;
          input.disabled = result !== undefined;
          input.addEventListener("change", () => answers.set(question.id, letter));
          choices.appendChild(label);
        });
      } else {
        [["true", "True"], ["false", "False"]].forEach(([value, text]) => {
          const label = choiceLabel(question, value, text);
          const input = label.querySelector("input");
          input.checked = chosen === value;
          input.disabled = result !== undefined;
          input.addEventListener("change", () => answers.set(question.id, value));
          choices.appendChild(label);
        });
      }
      card.appendChild(choices);
      const feedback = el("div", "feedback");
      if (result !== undefined) {
        feedback.classList.add(result ? "correct" : "incorrect");
        feedback.innerHTML = `<strong>${result ? "Correct." : "Revisit this one."}</strong> ${question.explanation || ""}`;
      }
      card.appendChild(feedback);
      const actions = el("div", "quiz-actions");
      const check = el("button", "btn", result === undefined ? "Check answer" : current === quiz.length - 1 ? "Review from the start" : "Next question →");
      check.type = "button";
      check.addEventListener("click", () => {
        if (result === undefined) {
          const value = answers.get(question.id);
          if (value === undefined) return;
          const correct = question.type === "true-false" ? value === String(question.answer) : value === question.answer;
          checked.set(question.id, correct);
          renderQuestion();
          updateSide();
        } else {
          current = current === quiz.length - 1 ? 0 : current + 1;
          renderQuestion();
          updateSide();
        }
      });
      actions.appendChild(check);
      card.appendChild(actions);
      updateSide();
    };

    reset.addEventListener("click", () => {
      quiz = shuffle(objectivePool).slice(0, 15);
      current = 0;
      answers.clear();
      checked.clear();
      renderQuestion();
    });
    renderQuestion();

    const open = el("section", "session6-open-practice");
    open.innerHTML = '<div class="section-intro"><div><p class="eyebrow">WRITTEN PRACTICE</p><h2>Six open questions with model answers.</h2></div><p>Write an answer before opening the model. Compare the economic logic and derivation, not exact wording.</p></div>';
    const list = el("div", "details-stack card");
    openQuestions.forEach((question, index) => {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `${index + 1}. ${question.question}`;
      details.appendChild(summary);
      const answer = el("div", "note");
      answer.style.marginTop = "14px";
      answer.append(el("strong", null, "Model answer"), document.createElement("br"), document.createTextNode(question.answer));
      details.appendChild(answer);
      if (question.explanation) details.appendChild(el("p", "small muted", question.explanation));
      list.appendChild(details);
    });
    open.appendChild(list);
    section.appendChild(open);
    return section;
  }

  function buildFlashcards() {
    const section = el("section", "session6-flashcards");
    section.dataset.session6View = "flashcards";
    section.hidden = true;
    section.innerHTML = '<div class="page-head"><p class="eyebrow">04 / Flashcards</p><h1>Recall the distinction before you calculate.</h1><p>Flip each card, then grade it. Review scheduling is stored locally through the Student Hub progress system.</p></div>';
    let deck = [...flashcards];
    let index = 0;
    let showingBack = false;
    const card = el("button", "session6-flashcard");
    card.type = "button";
    const count = el("p", "eyebrow");
    const face = el("div", "session6-flashcard-face");
    card.append(count, face);
    const controls = el("div", "session6-card-controls");
    const previous = el("button", "btn secondary small-btn", "← Previous");
    const shuffleButton = el("button", "btn secondary small-btn", "Shuffle");
    const next = el("button", "btn secondary small-btn", "Next →");
    previous.type = shuffleButton.type = next.type = "button";
    controls.append(previous, shuffleButton, next);
    const grades = el("div", "session6-card-grades");
    for (const [value, label] of [["again", "Again"], ["hard", "Hard"], ["good", "Good"], ["easy", "Easy"]]) {
      const button = el("button", "btn secondary small-btn", label);
      button.type = "button";
      button.addEventListener("click", () => {
        gradeCard(deck[index].id, value);
        index = (index + 1) % deck.length;
        showingBack = false;
        renderCard();
      });
      grades.appendChild(button);
    }
    const renderCard = () => {
      const current = deck[index];
      count.textContent = `CARD ${index + 1} / ${deck.length} · ${showingBack ? "ANSWER" : "QUESTION"}`;
      face.textContent = showingBack ? current.back : current.front;
      card.setAttribute("aria-label", showingBack ? "Show question side" : "Show answer side");
    };
    card.addEventListener("click", () => { showingBack = !showingBack; renderCard(); });
    previous.addEventListener("click", () => { index = (index - 1 + deck.length) % deck.length; showingBack = false; renderCard(); });
    next.addEventListener("click", () => { index = (index + 1) % deck.length; showingBack = false; renderCard(); });
    shuffleButton.addEventListener("click", () => { deck = shuffle(deck); index = 0; showingBack = false; renderCard(); });
    section.append(card, controls, grades);
    renderCard();
    return section;
  }

  async function init() {
    try {
      data = await loadAll();
      course = data.courses.find((item) => item.id === COURSE_ID);
      module = data.modules.find((item) => item.id === MODULE_ID);
      topic = module?.topics.find((item) => item.id === TOPIC_ID);
      if (!course || !module || !topic) throw new Error("Session 6 course data is missing.");
      config = await loadLecture(module, topic, fetchText);
      guideHtml = await fetchText(module.folder + config.guide);
      if (!config || guideHtml === null) throw new Error("Session 6 lecture files could not be loaded.");
      questions = module.questions.filter((question) => question.topic === TOPIC_ID && !question.sample);
      flashcards = module.flashcards.filter((card) => card.topic === TOPIC_ID && !card.sample);

      status.hidden = true;
      host.hidden = false;
      host.innerHTML = "";
      if (root.HealthEconManagement?.identity) host.appendChild(root.HealthEconManagement.identity("lectures"));
      host.append(buildToolbar(), buildLearn(), buildExplore(), buildPractice(), buildFlashcards());
      setStatus(getTopicStatus(loadProgress(), TOPIC_ID));
    } catch (error) {
      console.error("Session 6 page:", error);
      status.textContent = "Session 6 could not be loaded. Please reload the page or use the official course materials on Virtuale.";
    }
  }

  init();
})(window);
