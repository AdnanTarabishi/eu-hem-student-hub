(function (root) {
  "use strict";
  const data = root.FHEMFinalReviewData;
  if (!data) return;

  const KEY = "euhem-fhem-final-review-v1";
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

  function readState() {
    try {
      const state = JSON.parse(localStorage.getItem(KEY) || "null");
      if (state && state.version === 1) return state;
    } catch {}
    return { version: 1, plan: "fast", completed: {}, confidence: {}, rapid: { index: 0, correct: 0, answered: {} }, draft: "", rubric: {}, checklist: {} };
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }
  let state = readState();

  function renderFormat() {
    const host = $("#exam-format");
    host.innerHTML = "";
    data.format.sections.forEach((section) => {
      const card = make("article", "format-card");
      card.innerHTML = `<span class="format-letter">${escapeHtml(section.id)}</span><div><strong>${escapeHtml(section.label)}</strong><span>${section.count ? `${section.count} item${section.count > 1 ? "s" : ""} · ${section.max} points` : "5 minutes"}</span><small>${escapeHtml(section.scoring)}</small></div><b>${section.suggestedMinutes} min</b>`;
      host.appendChild(card);
    });
    $("#strategy-note").textContent = data.format.strategyNote;
  }

  function renderPlan() {
    const plan = data.plans[state.plan] || data.plans.fast;
    $$("[data-plan]").forEach((button) => button.classList.toggle("is-active", button.dataset.plan === state.plan));
    const host = $("#review-plan");
    const done = plan.tasks.filter((task) => state.completed[task.id]).length;
    host.innerHTML = `<div class="plan-head"><div><p class="eyebrow">SAVED STUDY ROUTE</p><h3>${escapeHtml(plan.label)}</h3><p>${escapeHtml(plan.description)}</p></div><strong>${done}/${plan.tasks.length} steps complete</strong></div><div class="plan-progress"><span style="width:${Math.round(done / plan.tasks.length * 100)}%"></span></div>`;
    const list = make("div", "plan-list");
    plan.tasks.forEach((task, index) => {
      const label = make("label", "plan-task");
      label.innerHTML = `<input type="checkbox" data-task="${escapeHtml(task.id)}" ${state.completed[task.id] ? "checked" : ""}><span class="plan-number">${String(index + 1).padStart(2, "0")}</span><span><strong>${escapeHtml(task.title)}</strong><small>${task.minutes} minutes</small></span><a href="${escapeHtml(task.target)}" aria-label="Go to ${escapeHtml(task.title)}">→</a>`;
      list.appendChild(label);
    });
    host.appendChild(list);
    $$('input[data-task]', host).forEach((input) => input.addEventListener("change", () => {
      state.completed[input.dataset.task] = input.checked;
      save(state); renderPlan();
    }));
  }

  function renderSessions() {
    const host = $("#session-grid");
    host.innerHTML = "";
    data.sessions.forEach((session) => {
      const value = Number(state.confidence[session.id] || 0);
      const card = make("article", "session-card");
      card.innerHTML = `<div class="session-top"><span>SESSION ${String(session.number).padStart(2, "0")}</span><a href="${escapeHtml(session.link)}">Open guide →</a></div><h3>${escapeHtml(session.title)}</h3><p class="session-short">${escapeHtml(session.short)}</p><p>${escapeHtml(session.core)}</p><div class="exam-target"><strong>You must explain</strong><p>${escapeHtml(session.mustExplain)}</p></div><ul>${session.traps.map((trap) => `<li>${escapeHtml(trap)}</li>`).join("")}</ul><div class="confidence"><span>Confidence</span><div>${[1,2,3].map((level) => `<button type="button" data-confidence-session="${escapeHtml(session.id)}" data-confidence-value="${level}" class="${value === level ? "is-selected" : ""}" aria-label="Confidence ${level} for ${escapeHtml(session.title)}">${level}</button>`).join("")}</div></div>`;
      host.appendChild(card);
    });
    $$('[data-confidence-session]', host).forEach((button) => button.addEventListener("click", () => {
      state.confidence[button.dataset.confidenceSession] = Number(button.dataset.confidenceValue);
      save(state); renderSessions();
    }));
    const ready = data.sessions.filter((session) => Number(state.confidence[session.id]) === 3).length;
    const scored = data.sessions.filter((session) => Number(state.confidence[session.id]) > 0).length;
    const total = data.sessions.reduce((sum, session) => sum + Number(state.confidence[session.id] || 0), 0);
    $("#readiness-summary").textContent = `${ready} of 8 sessions marked ready · ${scored ? Math.round(total / (scored * 3) * 100) : 0}% average confidence across rated sessions`;
  }

  function renderConfusions() {
    const host = $("#confusion-grid");
    host.innerHTML = data.confusionPairs.map((pair, index) => `<details class="confusion-card" ${index < 2 ? "open" : ""}><summary><span>${escapeHtml(pair.left)}</span><b>≠</b><span>${escapeHtml(pair.right)}</span></summary><p>${escapeHtml(pair.rule)}</p></details>`).join("");
  }

  function renderEvidence() {
    $("#evidence-grid").innerHTML = data.evidence.map((item) => `<article class="evidence-card"><strong>${escapeHtml(item.figure)}</strong><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.detail)}</p></article>`).join("");
  }

  function renderRapid() {
    const select = $("#rapid-filter");
    if (!select.options.length) {
      select.innerHTML = `<option value="all">All sessions</option>${data.sessions.map((session) => `<option value="${escapeHtml(session.id)}">Session ${session.number}</option>`).join("")}`;
      select.addEventListener("change", () => { state.rapid.index = 0; save(state); renderRapid(); });
    }
    const pool = select.value === "all" ? data.rapidQuestions : data.rapidQuestions.filter((question) => question.session === select.value);
    if (!pool.length) return;
    const index = Math.max(0, Math.min(state.rapid.index, pool.length - 1));
    const question = pool[index];
    const prior = state.rapid.answered[question.id];
    const card = make("article", "quiz-card");
    card.innerHTML = `<div class="quiz-meta"><span>${index + 1}/${pool.length}</span><strong>${escapeHtml(question.session)}</strong><span>${state.rapid.correct} correct overall</span></div><h3>${escapeHtml(question.prompt)}</h3><div class="quiz-options">${question.options.map((choice) => `<button type="button" data-choice="${escapeHtml(choice.id)}" class="${prior === choice.id ? "is-chosen" : ""}">${escapeHtml(choice.text)}</button>`).join("")}</div><div class="quiz-feedback" aria-live="polite">${prior ? feedbackHtml(question, prior) : "Choose the best answer."}</div><div class="quiz-nav"><button type="button" id="rapid-prev" ${index === 0 ? "disabled" : ""}>← Previous</button><button type="button" id="rapid-next">${index === pool.length - 1 ? "Restart" : "Next →"}</button></div>`;
    const host = $("#rapid-workspace"); host.innerHTML = ""; host.appendChild(card);
    $$("[data-choice]", card).forEach((button) => button.addEventListener("click", () => {
      if (!state.rapid.answered[question.id]) {
        const selected = question.options.find((choice) => choice.id === button.dataset.choice);
        if (selected?.correct) state.rapid.correct += 1;
      }
      state.rapid.answered[question.id] = button.dataset.choice;
      save(state); renderRapid();
    }));
    $("#rapid-prev").addEventListener("click", () => { state.rapid.index = Math.max(0, index - 1); save(state); renderRapid(); });
    $("#rapid-next").addEventListener("click", () => { state.rapid.index = index === pool.length - 1 ? 0 : index + 1; save(state); renderRapid(); });
  }
  function feedbackHtml(question, answerId) {
    const selected = question.options.find((choice) => choice.id === answerId);
    return `<strong>${selected?.correct ? "Correct" : "Revisit"}</strong><p>${escapeHtml(question.takeaway)}</p>`;
  }

  function renderDiagnostic() {
    const host = $("#diagnostic-form");
    const questionHtml = (question, section) => `<fieldset class="diagnostic-question"><legend><span>${escapeHtml(question.label)}</span>${escapeHtml(question.prompt)}</legend>${question.options.map((choice) => `<label><input type="radio" name="${escapeHtml(question.id)}" value="${escapeHtml(choice.id)}"><span><b>${escapeHtml(choice.id)}.</b> ${escapeHtml(choice.text)}</span></label>`).join("")}<div class="answer-feedback" data-feedback="${escapeHtml(question.id)}"></div></fieldset>`;
    host.innerHTML = `<div class="diagnostic-intro"><p>${escapeHtml(data.diagnostic.intro)}</p><strong>Objective maximum: 46 points</strong></div><h3>Section A · six multiple-choice questions</h3>${data.diagnostic.mcqs.map((q) => questionHtml(q, "A")).join("")}<h3>Section B · two binary questions</h3>${data.diagnostic.binaries.map((q) => questionHtml(q, "B")).join("")}<button type="button" id="diagnostic-submit" class="review-primary">Score objective section</button><div id="diagnostic-result" aria-live="polite"></div>`;
    $("#diagnostic-submit").addEventListener("click", () => {
      let total = 0;
      [...data.diagnostic.mcqs, ...data.diagnostic.binaries].forEach((question) => {
        const selected = $(`input[name="${question.id}"]:checked`, host)?.value;
        const choice = question.options.find((item) => item.id === selected);
        total += choice?.score || 0;
        const feedback = $(`[data-feedback="${question.id}"]`, host);
        feedback.innerHTML = selected ? `<strong>${choice.score} points</strong> · ${escapeHtml(choice.feedback)}` : `<strong>0 points</strong> · Blank.`;
      });
      const percent = Math.round(Math.max(0, total) / 46 * 100);
      $("#diagnostic-result").innerHTML = `<div class="diagnostic-score"><strong>${total}/46</strong><span>${percent}% of the objective maximum</span></div><p>${percent >= 80 ? "Strong. Review only the feedback you missed." : percent >= 60 ? "Good base. Revisit the confusion pairs behind missed questions." : "Return to the eight-session map, then retry after active recall."}</p>`;
      $("#diagnostic-result").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function renderOpen() {
    const item = data.diagnostic.open;
    $("#open-case").innerHTML = `<p class="eyebrow">SECTION C · 60 POINTS</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.scenario)}</p><ol>${item.tasks.map((task) => `<li>${escapeHtml(task)}</li>`).join("")}</ol>`;
    const textarea = $("#open-draft-text");
    textarea.value = state.draft || "";
    const updateCount = () => {
      state.draft = textarea.value; save(state);
      const words = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
      $("#draft-word-count").textContent = `${words} words`;
    };
    textarea.addEventListener("input", updateCount); updateCount();
    const rubricHost = $("#rubric-grid");
    rubricHost.innerHTML = data.openRubric.map((criterion) => `<label class="rubric-card"><input type="checkbox" data-rubric="${escapeHtml(criterion.id)}" ${state.rubric[criterion.id] ? "checked" : ""}><span><strong>${escapeHtml(criterion.label)} · ${criterion.max}</strong><small>${escapeHtml(criterion.guidance)}</small></span></label>`).join("");
    $$('[data-rubric]', rubricHost).forEach((input) => input.addEventListener("change", () => { state.rubric[input.dataset.rubric] = input.checked; save(state); renderRubricScore(); }));
    renderRubricScore();
    $("#model-outline").innerHTML = `<ol>${item.modelOutline.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ol>`;
  }
  function renderRubricScore() {
    const max = data.openRubric.reduce((sum, criterion) => sum + (state.rubric[criterion.id] ? criterion.max : 0), 0);
    $("#rubric-score").textContent = `${max}/60 rubric areas covered`;
  }

  function renderChecklist() {
    const host = $("#final-checklist");
    host.innerHTML = data.lastTwenty.map((item, index) => `<label><input type="checkbox" data-check="${index}" ${state.checklist[index] ? "checked" : ""}><span>${escapeHtml(item)}</span></label>`).join("");
    $$('[data-check]', host).forEach((input) => input.addEventListener("change", () => { state.checklist[input.dataset.check] = input.checked; save(state); }));
  }

  function bindControls() {
    $$('[data-plan]').forEach((button) => button.addEventListener("click", () => { state.plan = button.dataset.plan; save(state); renderPlan(); }));
    $("#reset-review").addEventListener("click", () => {
      if (!root.confirm("Reset all final-review progress on this device?")) return;
      localStorage.removeItem(KEY); state = readState(); renderAll();
    });
  }
  function renderAll() {
    renderFormat(); renderPlan(); renderSessions(); renderConfusions(); renderEvidence(); renderRapid(); renderDiagnostic(); renderOpen(); renderChecklist();
  }

  document.addEventListener("DOMContentLoaded", () => { bindControls(); renderAll(); });
})(window);
