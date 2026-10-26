// FHEM final review workspace: all eight sessions, TA clarifications and exam-eve retrieval.
(function (root) {
  "use strict";

  const COURSE_ID = "fund-health-econ-management";
  const MODULE_ID = "fund-health-economics";
  const CHECK_KEY = "euhem-fhem-final-review-check-v1";
  const RECALL_KEY = "euhem-fhem-final-review-recall-v1";
  const host = document.getElementById("fhem-final-review");

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const link = (label, href, className = "hem-link") => {
    const node = el("a", className, label);
    node.href = href;
    return node;
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);

  function readArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function writeArray(key, values) {
    try { localStorage.setItem(key, JSON.stringify(values)); } catch { /* local progress is optional */ }
  }

  function topicUrl(session) {
    if (session.number === 6) return "fhe-session-6.html";
    if (session.number === 7) return "fhe-session-7.html";
    return `lecture.html?topic=${encodeURIComponent(session.topic)}#learn`;
  }

  function renderIdentity() {
    return root.HealthEconManagement?.identity?.("review") || null;
  }

  function renderPlan(data) {
    const section = el("section", "review-section");
    section.innerHTML = '<div class="review-section-heading"><div><p class="hem-kicker">CHOOSE YOUR ROUTE</p><h2>A last-day plan that prioritises retrieval.</h2></div><p>Do not reread everything line by line. Use the longer route if you have most of the day; use the shorter route if time or energy is limited.</p></div>';
    const grid = el("div", "review-plan-grid");
    for (const [key, title, subtitle] of [
      ["full", "Full review route", "About seven focused hours including a 90-minute mock"],
      ["short", "Compressed route", "Three hours for the highest-yield distinctions and one timed practice block"],
    ]) {
      const card = el("article", "review-plan");
      card.innerHTML = `<p class="hem-kicker">${escapeHtml(subtitle)}</p><h3>${escapeHtml(title)}</h3>`;
      const list = el("ol", "review-timeline");
      for (const [time, task] of data.plans[key]) {
        const item = document.createElement("li");
        item.append(el("strong", null, time), el("span", null, task));
        list.appendChild(item);
      }
      card.appendChild(list);
      grid.appendChild(card);
    }
    section.appendChild(grid);
    return section;
  }

  function renderSessions(data, module) {
    const section = el("section", "review-section");
    section.innerHTML = '<div class="review-section-heading"><div><p class="hem-kicker">THE EIGHT-SESSION MAP</p><h2>Know the mechanism, formula and trap in every session.</h2></div><p>This is a final retrieval map, not a replacement for the full study pages. Open a session only when a point below feels uncertain.</p></div>';
    const grid = el("div", "review-session-grid");
    for (const session of data.sessionReviews) {
      const card = el("article", "review-session-card");
      const flashcards = module.flashcards.filter((item) => item.topic === session.topic).length;
      const questions = module.questions.filter((item) => item.topic === session.topic).length;
      const top = el("div", "review-session-top");
      top.append(el("span", "review-session-number", String(session.number).padStart(2, "0")), el("span", "hem-status", `${flashcards} cards · ${questions} questions`));
      card.appendChild(top);
      card.append(el("h3", null, session.title), el("p", null, session.summary));
      const points = el("ul", "review-session-points");
      session.points.forEach((point) => points.appendChild(el("li", null, point)));
      card.appendChild(points);
      const trap = el("div", "review-session-trap");
      trap.innerHTML = `<strong>Exam trap:</strong> ${escapeHtml(session.trap)}`;
      card.appendChild(trap);
      const actions = el("div", "review-session-actions");
      actions.append(link("Review lesson →", topicUrl(session)), link("Practice", `course.html?course=${COURSE_ID}&tab=practice&practiceTopic=${encodeURIComponent(session.topic)}`));
      card.appendChild(actions);
      grid.appendChild(card);
    }
    section.appendChild(grid);
    return section;
  }

  function renderTAFocus() {
    const section = el("section", "review-section");
    section.innerHTML = '<div class="review-section-heading"><div><p class="hem-kicker">TA SESSION · 22 OCTOBER</p><h2>Three clarifications to carry into the exam.</h2></div><p>The new TA material simplifies Grossman, resolves the Greek-letter notation trap and separates ordinary labour-supply effects from evidence of induced demand.</p></div>';
    const grid = el("div", "review-ta-grid");
    const cards = [
      ["01 / GROSSMAN IN FIVE STEPS", "Health is a machine that produces time", ["Health stock H wears out and is repaired through gross investment I.", "Healthy days are the flow produced by the stock.", "The PPF rises first because health releases sick time, then falls when a true trade-off begins.", "Hold health until MEC=r+δ.", "Comparative statics move either the return curve or the hurdle line."]],
      ["02 / δ OR γ?", "Read the role, not the letter", ["Depreciation sits in Ht=(1−rate)Ht−1+I and in the hurdle r+rate.", "Discounting sits in preferences and determines how future utility is weighted.", "Allostatic load raises physical depreciation.", "Fuchs/time preference raises impatience and can reduce both education and health investment."]],
      ["03 / FEE CUT", "More services do not prove PID", ["Substitution: leisure becomes cheaper in forgone income → more leisure → less work.", "Income: the physician becomes poorer; if leisure is normal → less leisure → more work.", "The effects oppose each other and the net response is empirical.", "A volume increase after a fee cut can occur without manipulation of patient demand."]],
    ];
    for (const [eyebrow, title, points] of cards) {
      const card = el("article", "review-ta-card");
      card.innerHTML = `<p class="hem-kicker">${escapeHtml(eyebrow)}</p><h3>${escapeHtml(title)}</h3>`;
      const list = document.createElement("ul");
      points.forEach((point) => list.appendChild(el("li", null, point)));
      card.appendChild(list);
      grid.appendChild(card);
    }
    section.appendChild(grid);
    return section;
  }

  function renderFormulas(data) {
    const section = el("section", "review-section");
    section.innerHTML = '<div class="review-section-heading"><div><p class="hem-kicker">FORMULA SHEET</p><h2>Write the meaning beside the equation.</h2></div><p>The exam rewards interpretation. Memorising a symbol without knowing the mechanism is not enough.</p></div>';
    const grid = el("div", "review-formula-grid");
    for (const [label, formula, note] of data.formulas) {
      const card = el("article", "review-formula-card");
      card.append(el("span", null, label), el("strong", null, formula), el("p", null, note));
      grid.appendChild(card);
    }
    section.appendChild(grid);
    return section;
  }

  function renderDistinctions(data) {
    const section = el("section", "review-section");
    section.innerHTML = '<div class="review-section-heading"><div><p class="hem-kicker">DISTINCTION DRILL</p><h2>The pairs most likely to generate a partly-correct answer.</h2></div><p>For every pair, say the definition and one implication. These are common sources of negative marking and partial credit.</p></div>';
    const grid = el("div", "review-distinction-grid");
    for (const [title, text] of data.distinctions) {
      const card = el("article", "review-distinction");
      card.append(el("strong", null, title), el("span", null, text));
      grid.appendChild(card);
    }
    section.appendChild(grid);
    return section;
  }

  function renderRapidRecall(data) {
    const section = el("section", "review-section");
    section.innerHTML = '<div class="review-section-heading"><div><p class="hem-kicker">RAPID RECALL</p><h2>Answer before revealing the model response.</h2></div><p>Use a short spoken or written answer. Mark only questions you can explain without relying on keywords alone.</p></div>';
    const layout = el("div", "review-rapid-layout");
    const card = el("article", "review-rapid-card");
    const side = el("aside", "review-rapid-side");
    const completed = new Set(readArray(RECALL_KEY));
    let index = 0;
    let revealed = false;

    const renderSide = () => {
      side.innerHTML = "";
      side.append(el("span", "hem-kicker", "RETRIEVAL PROGRESS"), el("strong", null, `${completed.size} / ${data.rapidRecall.length}`));
      const track = el("div", "review-progress-track");
      track.innerHTML = `<span style="width:${Math.round((completed.size / data.rapidRecall.length) * 100)}%"></span>`;
      side.append(track, el("p", null, "Mark a prompt as secure only when you can state the mechanism and the implication without opening the answer."));
    };

    const renderQuestion = () => {
      revealed = false;
      const item = data.rapidRecall[index];
      const session = data.sessionReviews.find((entry) => entry.topic === item.topic);
      card.innerHTML = "";
      const meta = el("div", "review-question-meta");
      meta.append(el("span", null, `Prompt ${index + 1} of ${data.rapidRecall.length}`), el("span", null, session ? `Session ${session.number}` : "Course review"), el("span", null, completed.has(item.id) ? "Secure" : "Needs recall"));
      card.append(meta, el("p", "review-question-text", item.question));
      const answerArea = el("div", "review-answer-area");
      const textarea = document.createElement("textarea");
      textarea.placeholder = "Say it aloud or write a concise answer before revealing the model response.";
      answerArea.appendChild(textarea);
      card.appendChild(answerArea);
      const model = el("div", "review-model-answer");
      model.hidden = true;
      model.textContent = item.answer;
      card.appendChild(model);
      const actions = el("div", "review-rapid-actions");
      const previous = el("button", "hem-button hem-secondary", "← Previous");
      previous.type = "button";
      previous.disabled = index === 0;
      previous.addEventListener("click", () => { index--; renderQuestion(); });
      const reveal = el("button", "hem-button", "Reveal answer");
      reveal.type = "button";
      reveal.addEventListener("click", () => { revealed = !revealed; model.hidden = !revealed; reveal.textContent = revealed ? "Hide answer" : "Reveal answer"; });
      const secure = el("button", "hem-button hem-secondary", completed.has(item.id) ? "Remove secure mark" : "Mark secure ✓");
      secure.type = "button";
      secure.addEventListener("click", () => { if (completed.has(item.id)) completed.delete(item.id); else completed.add(item.id); writeArray(RECALL_KEY, [...completed]); renderQuestion(); renderSide(); });
      const next = el("button", "hem-button", index === data.rapidRecall.length - 1 ? "Start again" : "Next →");
      next.type = "button";
      next.addEventListener("click", () => { index = index === data.rapidRecall.length - 1 ? 0 : index + 1; renderQuestion(); });
      actions.append(previous, reveal, secure, next);
      card.appendChild(actions);
    };

    renderQuestion();
    renderSide();
    layout.append(card, side);
    section.appendChild(layout);
    return section;
  }

  function renderOpenFramework() {
    const section = el("section", "review-section");
    section.innerHTML = '<div class="review-section-heading"><div><p class="hem-kicker">SECTION C / 60 POINTS</p><h2>Build the open answer as an argument, not a list.</h2></div><p>The two practice papers allocate more than half the raw score to one open question. Your answer needs structure, mechanisms and trade-offs.</p></div>';
    const grid = el("div", "review-open-framework");
    const steps = el("article", "review-open-steps");
    steps.innerHTML = '<h3>Six-paragraph answer architecture</h3><ol><li><strong>Frame the system.</strong> State the financing, payment, information and risk-sharing context.</li><li><strong>Diagnose the failures.</strong> Name only mechanisms supported by the scenario.</li><li><strong>Trace causality.</strong> Explain how incentives or constraints change behaviour and outcomes.</li><li><strong>Evaluate the proposed reforms.</strong> Give advantages, disadvantages and likely unintended responses.</li><li><strong>Recommend a package.</strong> Match each policy instrument to the failure it addresses.</li><li><strong>Conclude conditionally.</strong> State what should be monitored and what could reverse the result.</li></ol>';
    const check = el("article", "review-open-check");
    check.innerHTML = '<h3>What a high-scoring answer contains</h3><ul><li>Correct terminology and assumptions.</li><li>At least one explicit causal chain for every major claim.</li><li>Application to details in the scenario.</li><li>Risk sharing, efficiency, equity, access and quality trade-offs.</li><li>Provider and patient responses—not only policy labels.</li><li>A coherent recommendation rather than mutually inconsistent proposals.</li><li>A short conclusion that identifies evaluation indicators.</li></ul><div class="review-alert"><div><b>Time rule:</b> plan for 5–7 minutes, write for about 45 minutes and reserve the final minutes to check that every sub-question was answered.</div></div>';
    grid.append(steps, check);
    section.appendChild(grid);
    return section;
  }

  function renderChecklist(data) {
    const section = el("section", "review-section review-final-checklist");
    const saved = new Set(readArray(CHECK_KEY));
    const heading = el("div", "review-section-heading");
    const copy = el("div");
    copy.innerHTML = '<p class="hem-kicker">STOP RULE</p><h2>When these are secure, stop studying and sleep.</h2>';
    const score = el("p", "review-final-score");
    heading.append(copy, score);
    section.appendChild(heading);
    const grid = el("div", "review-check-grid");
    const renderScore = () => { score.textContent = `${saved.size} of ${data.checklist.length} ready`; };
    data.checklist.forEach((item, index) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = saved.has(index);
      input.addEventListener("change", () => { if (input.checked) saved.add(index); else saved.delete(index); writeArray(CHECK_KEY, [...saved]); renderScore(); });
      label.append(input, el("span", null, item));
      grid.appendChild(label);
    });
    section.appendChild(grid);
    const reset = el("button", "hem-button hem-secondary", "Reset checklist");
    reset.type = "button";
    reset.addEventListener("click", () => { saved.clear(); writeArray(CHECK_KEY, []); grid.querySelectorAll("input").forEach((input) => { input.checked = false; }); renderScore(); });
    section.appendChild(reset);
    renderScore();
    return section;
  }

  async function init() {
    try {
      const review = root.FHEMExamEve;
      if (!review) throw new Error("Final review data is unavailable.");
      const data = await root.loadAll();
      const course = data.courses.find((item) => item.id === COURSE_ID);
      const module = course?.modules.find((item) => item.id === MODULE_ID) || data.modules.find((item) => item.id === MODULE_ID);
      if (!module) throw new Error("Health Economics module could not be loaded.");

      host.innerHTML = "";
      const shell = el("div", "review-shell");
      const identity = renderIdentity();
      if (identity) shell.appendChild(identity);

      const hero = el("section", "review-hero");
      const copy = el("div", "review-hero-copy");
      copy.innerHTML = '<p class="hem-kicker">FUNDAMENTALS IN HEALTH ECONOMICS · FINAL REVIEW</p><h1>Retrieve the mechanism.<br><em>Then write the policy answer.</em></h1><p>A focused exam-eve workspace covering all eight sessions, the 22 October TA clarifications, the formula sheet, high-risk distinctions, rapid recall and an open-answer structure.</p><div class="review-hero-chips"><span>8 sessions</span><span>90-minute written format</span><span>TA clarifications integrated</span><span>Progress stays on this device</span></div>';
      const actions = el("div", "hem-actions");
      actions.append(link("Open Mock Exam 5 →", "fhem-exam.html", "hem-button"), link("Course sessions", `course.html?course=${COURSE_ID}&tab=lectures`, "hem-button hem-secondary"), link("Question bank", `course.html?course=${COURSE_ID}&tab=practice`, "hem-button hem-secondary"));
      copy.appendChild(actions);

      const exam = el("aside", "review-exam-card");
      exam.innerHTML = '<p class="hem-kicker">OBSERVED PRACTICE-PAPER FORMAT</p><h2>90 minutes · 106 raw points</h2><div class="review-exam-grid"><div><strong>6</strong><span>MCQs · 30 points<br>+5 / +2 / −1 / 0</span></div><div><strong>2</strong><span>Binary · 16 points<br>+8 / −2 / 0</span></div><div><strong>1</strong><span>Open case · 60 points<br>mechanism + policy</span></div></div><p>The exact final paper is not guaranteed. This page follows the structure of the two provided 2026 practice papers and keeps Student Hub questions original.</p>';
      hero.append(copy, exam);
      shell.appendChild(hero);

      const alert = el("div", "review-alert");
      alert.innerHTML = '<div><b>Exam-eve rule:</b> use active recall, timed writing and error review. Do not spend the final hours polishing sections you already know while leaving one major mechanism untested.</div>';
      shell.appendChild(alert);

      shell.append(renderPlan(review), renderSessions(review, module), renderTAFocus(), renderFormulas(review), renderDistinctions(review), renderRapidRecall(review), renderOpenFramework(), renderChecklist(review));

      const endActions = el("div", "review-actions");
      endActions.append(link("Start Mock Exam 5", "fhem-exam.html", "hem-button"), link("Review all sessions", `course.html?course=${COURSE_ID}&tab=lectures`, "hem-button hem-secondary"), link("Back to course hub", `course.html?course=${COURSE_ID}`, "hem-button hem-secondary"));
      shell.appendChild(endActions);
      host.appendChild(shell);
      document.title = "FHEM Final Review – EU-HEM Student Hub";
    } catch (error) {
      console.error("FHEM final review:", error);
      host.innerHTML = "";
      const box = el("section", "card");
      box.append(el("h2", null, "The final review could not be loaded."), el("p", null, "Reload the page or return to the FHEM course hub."), link("← Back to the course hub", `course.html?course=${COURSE_ID}`));
      host.appendChild(box);
    }
  }

  init();
})(window);
