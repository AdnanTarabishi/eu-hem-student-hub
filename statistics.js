// Eight connected study tools. All learner state remains in the existing local progress backup.
(function () {
  "use strict";
  const S = window.StatisticsStudy,
    C = window.StatisticsCalculations;
  const $ = (id) => document.getElementById(id);
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  const views = [
    "dashboard",
    "mistakes",
    "review",
    "mock",
    "calculations",
    "interpretation",
    "reference",
    "stata",
  ];
  let bank = [],
    topics = [],
    tools,
    state,
    view = "dashboard",
    selectedNode = "concept-1",
    mistakeTopic = "",
    mistakeHistory = false;
  let notice = "",
    lastDay = todayKey(),
    loading = true;
  const topicLabel = (id) =>
    topics.find((t) => t.id === id)?.title.split(":")[0] || "Statistics";
  const lookup = (id) => bank.find((q) => q.id === id);
  const active = () => state.active && state.active.finishedAt === null;
  const link = (topic, section = 1) =>
    `lecture.html?topic=${encodeURIComponent(topic)}&section=${section}#learn`;
  const button = (action, label, extra = "", secondary = false) =>
    `<button type="button" class="study-button${secondary ? " secondary" : ""}" data-action="${action}" ${extra}>${label}</button>`;
  function save() {
    S.save(state);
    $("storage-warning").hidden = !S.storageUnavailable();
  }
  function questionSection(q) {
    const i = topics.findIndex((t) => t.id === q.topic),
      cat = q.category;
    const groups = [
      [
        ["Risk", "Models"],
        ["Population", "Sample", "Census"],
        [
          "Experiment",
          "Sample space",
          "Events",
          "Exclusivity",
          "Exhaustiveness",
        ],
        ["Axioms", "Complement", "Uniform law", "Impossible event"],
        ["Union", "Intersection", "Overlap", "Repeated experiments"],
        ["Counting samples", "Simple random sampling"],
      ],
      [
        ["Conditional probability", "Reversing the condition", "Conditioning"],
        ["Independence", "Exclusive vs independent", "Replacement"],
        [
          "Sensitivity",
          "Specificity",
          "Joint table",
          "Predictive value",
          "Base rates",
        ],
        ["Measurement scales", "Interval scale"],
        ["Random variables", "PMF", "Expectation", "Variance"],
        ["Bernoulli", "Binomial", "Binomial probability"],
      ],
      [
        ["PDF", "Density", "CDF", "Interval probability"],
        ["Uniform probability", "Uniform moments", "Uniform shape"],
        ["Normal notation", "Normal location", "Standardisation"],
        [
          "Upper tail",
          "Central interval",
          "Normal symmetry",
          "Probability calculation",
          "Landmarks",
        ],
        ["Skewness", "Approximation"],
        ["Transformation", "Conditional expectation", "Independence"],
      ],
      [
        ["Randomisation", "RCT"],
        ["Cohort", "Case-control", "Cross-sectional", "Before–after"],
        ["Confounding", "Balance", "RCT limitations"],
        [
          "Data preparation",
          "Categorical summary",
          "Graph choice",
          "Scatterplot",
          "Density histogram",
        ],
        ["Sample median", "Sample variance", "Units", "Outliers"],
        ["Change convention", "Comparing graphs"],
      ],
      [
        ["Population & sample"],
        ["The three terms", "Random sampling", "Sampling error"],
        ["Sampling distributions", "Random variables", "SD versus SE"],
        ["Unbiasedness", "Consistency", "The normal distribution"],
        [
          "Calculate standard error",
          "Increase the sample size",
          "Choose a sample size",
          "Exercise 5.1",
          "Exercise 5.2",
        ],
        [
          "95% confidence interval",
          "Interpret confidence",
          "Compare precision",
          "99% confidence interval",
        ],
      ],
      [
        ["Hypotheses", "Two-sided tests"],
        ["Known variance", "Direction"],
        [
          "Unknown variance",
          "Degrees of freedom",
          "Normality",
          "T distribution",
          "Worked statistic",
        ],
        ["P-value"],
        [
          "Critical values",
          "Decision",
          "Confidence interval",
          "Matching levels",
          "Significance threshold",
        ],
        ["Non-rejection", "Type I error", "Type II error"],
        ["Clinical importance", "Reporting"],
      ],
    ];
    const section = groups[i]?.findIndex((group) => group.includes(cat));
    return section >= 0 ? section + 1 : 1;
  }
  function heading(title, text) {
    return `<div class="study-heading"><h2 id="view-title" tabindex="-1">${title}</h2><p>${text}</p></div>`;
  }
  function feedback(q, chosen, live = false) {
    const right = chosen === q.answer.charCodeAt(0) - 65;
    return `<div class="study-feedback${right ? "" : " incorrect"}" tabindex="-1" ${live ? 'id="study-answer"' : ""}><strong>${chosen === null ? "Unanswered" : right ? "Correct" : "Try this idea again"}</strong><p>Correct answer: ${esc(q.options[q.answer.charCodeAt(0) - 65])}</p><p>${esc(q.explanation)}</p><a href="${link(q.topic, questionSection(q))}">Review the matching lecture section →</a></div>`;
  }
  function render(focus = false) {
    if (loading) return;
    view = views.includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "dashboard";
    document.querySelectorAll(".study-nav a").forEach((a) => {
      if (a.hash === "#" + view) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const banner = $("session-banner");
    banner.hidden = !active();
    if (active())
      banner.innerHTML = `${state.active.kind === "exam" ? "A timed mock is running; its deadline continues while you use other tools." : "Your practice session is saved."} <a href="#${state.active.kind === "review" ? "review" : "mock"}">Resume session →</a>`;
    const renderers = {
      dashboard: dashboard,
      mistakes: mistakes,
      review: review,
      mock: mock,
      calculations: calculations,
      interpretation: interpretation,
      reference: reference,
      stata: stata,
    };
    $("study-view").innerHTML =
      (notice
        ? `<p class="study-notice" role="status">${esc(notice)}</p>`
        : "") + renderers[view]();
    bindView();
    tickLabel();
    if (focus) $("view-title")?.focus();
  }
  function dashboard() {
    const records = Object.values(state.questions),
      read = topics.filter((t) => getTopicStatus(loadProgress(), t.id));
    const due = S.due(state, bank, todayKey(), false),
      correct = records.filter((r) => r.lastCorrect).length;
    let html = heading(
      "Your progress, in two different ways.",
      "Reading is a self-reported milestone. Question accuracy shows your latest submitted answers; it is a study signal, not a prediction of your exam grade.",
    );
    html += `<div class="study-stats">${[
      [read.length + " / 6", "Lectures marked read"],
      [records.length + " / " + bank.length, "Questions attempted"],
      [correct + " / " + records.length, "Latest answers correct"],
      [due.length, "Questions due today"],
    ]
      .map(
        ([n, l]) =>
          `<div class="study-card"><strong class="study-number">${n}</strong><span>${l}</span></div>`,
      )
      .join("")}</div><div class="study-grid">`;
    const weaknesses = [];
    for (const [i, t] of topics.entries()) {
      const qs = bank.filter((q) => q.topic === t.id),
        attempted = qs.filter((q) => state.questions[q.id]),
        c = attempted.filter((q) => state.questions[q.id].lastCorrect).length;
      const pct = attempted.length
        ? Math.round((c / attempted.length) * 100)
        : null;
      if (attempted.length >= 3)
        weaknesses.push({ i, pct, total: attempted.length });
      html += `<article class="study-card"><h3>${esc(t.title)}</h3><p>Reading: ${esc(getTopicStatus(loadProgress(), t.id) || "not marked read")}</p><label for="meter-${i}">Question coverage: ${attempted.length} / ${qs.length}</label><progress id="meter-${i}" class="study-meter" max="${qs.length}" value="${attempted.length}">${attempted.length}/${qs.length}</progress><p>${pct === null ? "No submitted answers yet." : `${pct}% latest accuracy (${c} of ${attempted.length} attempted questions).`}</p><div class="study-actions"><a href="${link(t.id)}">Open lecture →</a><a href="#reference" data-node="concept-${i + 1}">Review concepts</a></div></article>`;
    }
    html += '</div><article class="study-card"><h3>Where to focus next</h3>';
    weaknesses.sort((a, b) => a.pct - b.pct);
    html += weaknesses.length
      ? `<ul>${weaknesses
          .slice(0, 3)
          .map(
            (x) =>
              `<li><a href="#reference" data-node="concept-${x.i + 1}">${esc(tools.nodes[x.i].title)}</a> — ${x.pct}% latest accuracy across ${x.total} questions.</li>`,
          )
          .join("")}</ul>`
      : "<p>Attempt at least three questions in a class to see its accuracy here.</p>";
    html += `<div class="study-actions"><a class="study-button" href="#review">Start today’s review</a><a class="study-button secondary" href="#calculations">Practise calculations</a></div></article><article class="study-card"><h3>Recent sessions</h3>`;
    html += state.sessions.length
      ? `<ul>${state.sessions
          .slice(-8)
          .reverse()
          .map(
            (r) =>
              `<li>${esc(new Date(r.finishedAt).toLocaleString())}: ${r.kind} · ${r.correct}/${r.total} correct · ${r.answered} answered.</li>`,
          )
          .join("")}</ul>`
      : "<p>Your completed review and mock sessions will appear here.</p>";
    return html + "</article>";
  }
  function mistakes() {
    const qs = bank.filter((q) => {
      const r = state.questions[q.id];
      return (
        r &&
        (mistakeHistory ? r.misses > 0 : r.needsReview) &&
        (!mistakeTopic || q.topic === mistakeTopic)
      );
    });
    return (
      heading(
        "Turn mistakes into a revision plan.",
        "A correct retry clears a question from the current list. Its earlier mistakes remain in your history.",
      ) +
      `<div class="study-controls"><div><label for="mistake-topic">Lecture</label><select id="mistake-topic"><option value="">All covered classes</option>${topics.map((t) => `<option value="${t.id}" ${t.id === mistakeTopic ? "selected" : ""}>${esc(topicLabel(t.id))}</option>`).join("")}</select></div><label class="study-check"><input type="checkbox" id="mistake-history" ${mistakeHistory ? "checked" : ""}> Include previously corrected mistakes</label></div><p>${qs.length} questions ${mistakeHistory ? "with a mistake in their history" : "need another try"}.</p>${qs.length ? button("retry-mistakes", "Retry this list", `data-topic="${esc(mistakeTopic)}"`) : "<p>When an answer needs work, it will appear here with its explanation.</p>"}<div class="study-actions"></div>${qs.map((q) => `<article class="study-card"><p class="study-meta">${esc(topicLabel(q.topic))} · ${esc(q.category)} · ${state.questions[q.id].misses} previous mistake(s)</p><h3>${esc(q.question)}</h3><details><summary>See the explanation and lecture link</summary>${feedback(q, state.questions[q.id].lastAnswer)}</details></article>`).join("")}`
    );
  }
  function review() {
    const due = S.due(state, bank, todayKey(), false),
      unseen = bank.filter((q) => !state.questions[q.id]);
    let html = heading(
      "A little review, at the right time.",
      "Questions you miss return today. Correct answers return in three days by default; Hard, Good and Easy adjust the next date. Dates use this device’s local calendar.",
    );
    if (state.active?.kind === "review") return html + runner();
    html += `<article class="study-card"><h3>${due.length} due · ${unseen.length} new</h3><p>Start with difficult questions and older due items. Add new questions when you have room in your session.</p><label class="study-check"><input type="checkbox" id="review-new" checked> Include new questions (up to 12 questions total)</label><div class="study-actions">${button("start-review", "Start today’s review", !due.length && !unseen.length ? "disabled" : "")}</div>${active() ? "<p>Finish or discard the current session before starting another.</p>" : ""}</article>`;
    const future = bank
      .filter((q) => state.questions[q.id]?.due > todayKey())
      .sort((a, b) =>
        state.questions[a.id].due.localeCompare(state.questions[b.id].due),
      );
    html += `<article class="study-card"><h3>Next up</h3>${
      future.length
        ? `<ul>${future
            .slice(0, 8)
            .map(
              (q) =>
                `<li>${esc(q.category)} · ${esc(topicLabel(q.topic))} · ${state.questions[q.id].due}</li>`,
            )
            .join("")}</ul>`
        : "<p>Your next review dates appear after you submit answers.</p>"
    }</article>`;
    return html;
  }
  function mock() {
    let html = heading(
      "Practise a mix. Then try it under time.",
      "This original MCQ mock covers Classes 1–6. Questions are balanced across lectures and answer options are shuffled. Calculations and written interpretation have separate practice tools; this is not an official exam simulation.",
    );
    if (state.active && state.active.kind !== "review") return html + runner();
    html += `<form id="mock-setup" class="study-card"><div class="study-controls"><div><label for="mock-mode">Feedback</label><select id="mock-mode"><option value="practice">Practice · check each answer</option><option value="exam">Exam · feedback on submission</option></select></div><div><label for="mock-size">Questions</label><select id="mock-size">${[12, 24, 60, 120].map((n) => `<option ${n === 24 ? "selected" : ""}>${n}</option>`).join("")}</select></div><div><label for="mock-minutes">Exam time (minutes)</label><select id="mock-minutes">${[10, 20, 40, 60].map((n) => `<option ${n === 20 ? "selected" : ""}>${n}</option>`).join("")}</select></div></div><p>During an exam session, the timer continues after reloads or visits to other tools. Unanswered questions count as incorrect when time ends.</p>${button("start-mock", "Start session", active() ? "disabled" : "")}</form>`;
    if (active())
      html += `<p class="study-notice">A review is in progress. <a href="#review">Resume it</a> or ${button("discard", "discard this session", "", true)}.</p>`;
    return html;
  }
  function runner() {
    const a = state.active;
    if (a.finishedAt !== null) {
      const r = S.score(a, bank);
      return `<article class="study-card"><h3 id="session-result" tabindex="-1">Session complete · ${r.correct} / ${r.total}</h3><p>${r.percent}% correct · ${r.answered} answered. Review the explanations below, then revisit the lecture when needed.</p><div class="study-actions">${button("new-session", "Set up another session")}<a href="#mistakes">Review mistakes →</a></div></article><article class="study-card">${a.ids
        .map((id, i) => {
          const q = lookup(id);
          return `<details><summary>${i + 1}. ${esc(q.category)} — ${a.answers[i] === null ? "unanswered" : a.answers[i] === q.answer.charCodeAt(0) - 65 ? "correct" : "incorrect"}</summary><p>${esc(q.question)}</p><p>Your answer: ${a.answers[i] === null ? "none" : esc(q.options[a.answers[i]])}</p>${feedback(q, a.answers[i])}</details>`;
        })
        .join("")}</article>`;
    }
    const i = a.index,
      q = lookup(a.ids[i]),
      checked = a.checked[i],
      exam = a.kind === "exam";
    return `<article class="study-card"><div class="study-controls"><strong>Question ${i + 1} / ${a.ids.length}</strong><span>${esc(topicLabel(q.topic))} · ${esc(q.category)}</span>${exam ? '<span class="study-timer" id="exam-timer" role="timer" aria-label="Time remaining"></span>' : ""}</div><fieldset class="study-question"><legend id="session-prompt" tabindex="-1">${esc(q.question)}</legend>${a.order[i].map((original, n) => `<label class="study-choice"><input type="radio" name="session-answer" value="${original}" ${a.answers[i] === original ? "checked" : ""} ${!exam && checked ? "disabled" : ""}><span>${String.fromCharCode(65 + n)}. ${esc(q.options[original])}</span></label>`).join("")}</fieldset>${checked && !exam ? feedback(q, a.answers[i], true) : ""}${checked && !exam && state.questions[q.id]?.lastCorrect ? `<div class="study-actions" aria-label="Review confidence">${["hard", "good", "easy"].map((grade) => button("confidence", grade[0].toUpperCase() + grade.slice(1), `data-grade="${grade}"`, true)).join("")}<span id="next-review" class="study-meta">Next review: ${state.questions[q.id].due}</span></div>` : ""}<div class="study-actions">${!exam && !checked ? button("check", "Check answer", a.answers[i] === null ? "disabled" : "") : ""}${button("previous", "← Previous", i === 0 ? "disabled" : "", true)}${button("next", "Next →", i === a.ids.length - 1 ? "disabled" : "", true)}${button("finish", exam ? "Submit exam" : "Finish session")}</div><div class="study-jump" aria-label="Jump to question">${a.ids.map((id, n) => `<button type="button" data-action="jump" data-index="${n}" ${n === i ? 'aria-current="step"' : ""} data-answered="${a.answers[n] !== null}" aria-label="Question ${n + 1}${a.answers[n] !== null ? ", answered" : ", unanswered"}">${n + 1}</button>`).join("")}</div>${button("discard", "Discard this unfinished session", "", true)}</article>`;
  }
  function calculations() {
    return (
      heading(
        "Work it out, then check your method.",
        "Enter numbers, including signs. Probabilities use decimals except where a percentage is requested. Each exercise has two teaching examples, a hint and a worked solution.",
      ) +
      tools.calculations
        .map((ex) => {
          const saved = state.exercises[ex.id] || {},
            variant = Number.isInteger(saved.variant)
              ? saved.variant % ex.variants.length
              : 0,
            result = C.solve(ex.kind, ex.variants[variant]);
          return `<article class="study-card" data-exercise="${ex.id}"><p class="study-meta">${esc(topicLabel(ex.topic))} · Example ${variant + 1} of ${ex.variants.length}</p><h3>${esc(ex.title)}</h3><p>${esc(result.prompt)}</p><form data-calculation="${ex.id}"><div class="study-numeric-grid">${result.labels.map((l, i) => `<div><label for="calc-${ex.id}-${i}">${esc(l)}</label><input id="calc-${ex.id}-${i}" name="value-${i}" type="number" step="any" required><p class="study-meta">${result.tolerances[i] === 0 ? "Exact integer" : `Accepted rounding: ±${result.tolerances[i]}`}</p></div>`).join("")}</div><button class="study-button" type="submit">Check calculation</button></form><p class="calc-feedback" role="status"></p><details><summary>Hint</summary><p>${esc(ex.hint)}</p></details><details data-solution="${ex.id}"><summary>Worked solution</summary><ol>${result.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><a href="${link(ex.topic, ex.section)}">Review the lecture →</a></details><div class="study-actions">${button("variant", "Try the other example", `data-id="${ex.id}"`, true)}<span class="study-meta">${Number.isInteger(saved.attempts) ? saved.attempts : 0} checked attempt(s)${saved.lastCorrect === true ? " · latest answer correct" : ""}</span></div></article>`;
        })
        .join("")
    );
  }
  function interpretation() {
    return (
      heading(
        "Explain what the numbers mean.",
        "Write a response before opening the model. Use the checklist to assess your own explanation. The checklist is self-assessment; your text is saved locally and is not sent for automatic grading.",
      ) +
      tools.interpretations
        .map((ex) => {
          const r = state.explanations[ex.id] || {};
          return `<article class="study-card"><p class="study-meta">${esc(topicLabel(ex.topic))}</p><h3>${esc(ex.title)}</h3><p>${esc(ex.prompt)}</p><label for="draft-${ex.id}">Your explanation</label><textarea id="draft-${ex.id}" data-draft="${ex.id}" maxlength="8000" placeholder="Explain it in your own words…">${esc(typeof r.text === "string" ? r.text : "")}</textarea><p class="study-meta">Saved on this device as you type.</p><details><summary>Model explanation & self-assessment</summary><p>${esc(ex.model)}</p>${ex.rubric.map((text, i) => `<label class="study-check"><input type="checkbox" data-rubric="${ex.id}" data-index="${i}" ${r.checks?.[i] === true ? "checked" : ""}>${esc(text)}</label>`).join("")}<p class="study-meta" id="rubric-${ex.id}">${ex.rubric.filter((_, i) => r.checks?.[i] === true).length} / ${ex.rubric.length} criteria you marked as met.</p><a href="${link(ex.topic, ex.section)}">Review the lecture →</a></details></article>`;
        })
        .join("")
    );
  }
  function reference() {
    const n = tools.nodes.find((x) => x.id === selectedNode) || tools.nodes[0];
    return (
      heading(
        "Connect the ideas, then choose a formula.",
        "Click a concept to see what it builds on and which ideas come next. Search the reference by topic, formula or assumption.",
      ) +
      `<div class="study-map" aria-label="Concept dependency map">${tools.nodes.map((x) => `<button type="button" data-action="node" data-id="${x.id}" aria-pressed="${x.id === n.id}"><strong>${esc(topicLabel(x.topic))} · ${esc(x.title)}</strong><small>Builds on: ${x.prerequisites.map((id) => esc(tools.nodes.find((y) => y.id === id).title)).join(" + ") || "start here"}</small></button>`).join("")}</div><article class="study-card"><h3>${esc(n.title)}</h3><p>${esc(n.description)}</p><p>Before this: ${n.prerequisites.map((id) => `<a href="#reference" data-node="${id}">${esc(tools.nodes.find((y) => y.id === id).title)}</a>`).join(" · ") || "no prerequisite in this map"}.</p><p>Next: ${
        tools.nodes
          .filter((x) => x.prerequisites.includes(n.id))
          .map(
            (x) =>
              `<a href="#reference" data-node="${x.id}">${esc(x.title)}</a>`,
          )
          .join(" · ") || "connect these ideas when reporting results"
      }.</p><a href="${link(n.topic, n.section)}">Study this concept in the lecture →</a></article><label for="formula-search">Search the formula reference</label><input id="formula-search" type="search" placeholder="Try: standard error, Bayes, normal, independent…"><p id="formula-count" role="status"></p><div id="formula-list">${formulaList("")}</div>`
    );
  }
  function formulaList(query) {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const list = tools.formulas.filter((f) =>
      terms.every((t) =>
        [f.title, f.expression, f.purpose, f.assumptions, topicLabel(f.topic)]
          .join(" ")
          .toLowerCase()
          .includes(t),
      ),
    );
    return `${list.length ? "" : "<p>No formulas match. Try a broader term.</p>"}${list.map((f) => `<article class="study-card"><p class="study-meta">${esc(topicLabel(f.topic))}</p><h3>${esc(f.title)}</h3><p class="study-formula">${esc(f.expression)}</p><p>${esc(f.purpose)}</p><p><strong>Assumptions:</strong> ${esc(f.assumptions)}</p><a href="${link(f.topic, f.section)}">See the explanation →</a></article>`).join("")}`;
  }
  function stata() {
    return (
      heading(
        "Read the output before drawing a conclusion.",
        "Synthetic Stata-style outputs provide interpretation practice linked to upcoming workshops. Mark a workshop as covered when you have attended it, or open its preparation preview. Commands are shown as teaching references.",
      ) +
      [7, 10]
        .map((number) => {
          const unlocked = state.workshops[number] === true;
          return `<article class="study-card"><h3>Class ${number} · Stata workshop ${number === 7 ? 1 : 2}</h3><p class="study-meta">${unlocked ? "Marked covered on this device" : "Upcoming in the course · preparation examples"}</p><label class="study-check"><input type="checkbox" data-workshop="${number}" ${unlocked ? "checked" : ""}> I have covered this workshop</label><details ${unlocked ? "open" : ""}><summary>${unlocked ? "Workshop interpretation exercises" : "Preview preparation exercises"}</summary>${tools.stata
            .filter((ex) => ex.workshop === number)
            .map(
              (ex) =>
                `<section class="study-card"><h3>${esc(ex.title)}</h3><p>Hypothetical teaching example${number === 10 ? " · regression preview beyond the current Classes 1–6" : ""}.</p><pre><code>${esc(ex.command)}\n\n${esc(ex.output)}</code></pre><fieldset class="study-question"><legend>${esc(ex.question)}</legend>${ex.options.map((o, i) => `<label class="study-choice"><input type="radio" name="stata-${ex.id}" value="${i}"><span>${esc(o)}</span></label>`).join("")}</fieldset>${button("stata-check", "Check interpretation", `data-id="${ex.id}"`)}<div id="stata-feedback-${ex.id}" role="status"></div><p class="study-meta">${state.exercises["stata-" + ex.id]?.lastCorrect === true ? "Latest checked interpretation: correct" : ""}</p></section>`,
            )
            .join("")}</details></article>`;
        })
        .join("")
    );
  }
  function startSession(list, options) {
    if (active()) {
      notice =
        "You have an unfinished session. Resume it or use its Discard button before starting another.";
      render();
      return;
    }
    if (!list.length) {
      notice =
        "No questions are due with these settings. You can include new questions or return on the next review date.";
      render();
      return;
    }
    notice = "";
    state.active = S.createSession(list, options);
    save();
    const next = options.kind === "review" ? "review" : "mock";
    if (location.hash === "#" + next) render();
    else location.hash = next;
  }
  function expire() {
    if (
      active() &&
      state.active.kind === "exam" &&
      S.remaining(state.active) === 0
    ) {
      S.finish(state, bank, todayKey());
      save();
      notice =
        "Time is up. Your answers were submitted; unanswered questions count as incorrect.";
      render();
      return true;
    }
    return false;
  }
  function tickLabel() {
    const timer = $("exam-timer");
    if (timer && active()) {
      const n = S.remaining(state.active);
      timer.textContent = `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")} remaining`;
    }
  }
  function bindView() {
    $("mistake-topic")?.addEventListener("change", (e) => {
      mistakeTopic = e.target.value;
      render();
    });
    $("mistake-history")?.addEventListener("change", (e) => {
      mistakeHistory = e.target.checked;
      render();
    });
    $("formula-search")?.addEventListener("input", (e) => {
      $("formula-list").innerHTML = formulaList(e.target.value);
      $("formula-count").textContent =
        $("formula-list").querySelectorAll("article").length +
        " matching formulas";
    });
    document.querySelectorAll("[data-draft]").forEach((el) =>
      el.addEventListener("input", () => {
        const id = el.dataset.draft;
        state.explanations[id] = { ...state.explanations[id], text: el.value };
        save();
      }),
    );
    document.querySelectorAll("[data-rubric]").forEach((el) =>
      el.addEventListener("change", () => {
        const id = el.dataset.rubric,
          r = state.explanations[id] || {};
        const ex = tools.interpretations.find((x) => x.id === id);
        r.checks = ex.rubric.map((_, i) =>
          i === Number(el.dataset.index) ? el.checked : r.checks?.[i] === true,
        );
        state.explanations[id] = r;
        save();
        $("rubric-" + id).textContent =
          r.checks.filter(Boolean).length +
          " / " +
          r.checks.length +
          " criteria you marked as met.";
      }),
    );
    document.querySelectorAll("[data-workshop]").forEach((el) =>
      el.addEventListener("change", () => {
        const number = el.dataset.workshop;
        state.workshops[number] = el.checked;
        save();
        render();
        document
          .querySelector(`[data-workshop="${number}"]`)
          ?.focus({ preventScroll: true });
      }),
    );
    document.querySelectorAll("form[data-calculation]").forEach((form) =>
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = form.dataset.calculation,
          ex = tools.calculations.find((x) => x.id === id),
          r = state.exercises[id] || {},
          variant = Number.isInteger(r.variant)
            ? r.variant % ex.variants.length
            : 0;
        const solution = C.solve(ex.kind, ex.variants[variant]),
          result = C.check(
            solution,
            [...form.querySelectorAll("input")].map((x) => x.value),
          );
        const feedback = form.parentElement.querySelector(".calc-feedback");
        if (!result.valid) {
          feedback.textContent = "Enter a finite number in every answer field.";
          return;
        }
        const assisted =
          r.solutionSeen === true ||
          form.parentElement.querySelector("[data-solution]").open;
        state.exercises[id] = {
          ...r,
          variant,
          attempts: (Number.isInteger(r.attempts) ? r.attempts : 0) + 1,
          lastCorrect: result.correct,
          assisted,
        };
        save();
        feedback.textContent = result.correct
          ? `Correct within the stated rounding.${assisted ? " Recorded as practice with the solution available." : ""}`
          : "At least one value needs another look. Check the sign, units and denominator; use the hint if needed.";
      }),
    );
    document.querySelectorAll("[data-solution]").forEach((el) =>
      el.addEventListener("toggle", () => {
        if (el.open) {
          const id = el.dataset.solution;
          state.exercises[id] = { ...state.exercises[id], solutionSeen: true };
          save();
        }
      }),
    );
    document.querySelectorAll('input[name="session-answer"]').forEach((el) =>
      el.addEventListener("change", () => {
        if (expire()) return;
        const a = state.active;
        if (!active() || (a.checked[a.index] && a.kind !== "exam")) return;
        a.answers[a.index] = Number(el.value);
        save();
        const check = document.querySelector('[data-action="check"]');
        if (check) check.disabled = false;
        document.querySelector(
          `[data-action="jump"][data-index="${a.index}"]`,
        ).dataset.answered = "true";
      }),
    );
  }
  $("study-view").addEventListener("click", (e) => {
    const node = e.target.closest("[data-node]");
    if (node) {
      selectedNode = node.dataset.node;
      if (view === "reference") render();
      return;
    }
    const el = e.target.closest("[data-action]");
    if (!el || loading) return;
    e.preventDefault();
    if (expire()) return;
    const a = state.active,
      action = el.dataset.action;
    switch (action) {
      case "start-mock":
        startSession(bank, {
          kind: $("mock-mode").value,
          size: Number($("mock-size").value),
          minutes: Number($("mock-minutes").value),
        });
        return;
      case "start-review":
        startSession(S.due(state, bank, todayKey(), $("review-new").checked), {
          kind: "review",
          size: 12,
        });
        return;
      case "retry-mistakes":
        startSession(
          bank.filter((q) => {
            const r = state.questions[q.id];
            return (
              r &&
              (mistakeHistory ? r.misses > 0 : r.needsReview) &&
              (!mistakeTopic || q.topic === mistakeTopic)
            );
          }),
          { kind: "review", size: 120 },
        );
        return;
      case "new-session":
        state.active = null;
        notice = "";
        save();
        render();
        return;
      case "discard":
        if (
          !window.confirm(
            "Discard this unfinished session? Checked practice answers remain in your progress; unsubmitted exam answers will be discarded.",
          )
        )
          return;
        state.active = null;
        notice = "Session discarded.";
        save();
        render();
        return;
      case "check":
        if (
          !active() ||
          a.answers[a.index] === null ||
          a.checked[a.index] ||
          a.kind === "exam"
        )
          return;
        S.answer(
          state,
          lookup(a.ids[a.index]),
          a.answers[a.index],
          todayKey(),
          a.kind,
        );
        a.checked[a.index] = true;
        save();
        render();
        $("study-answer")?.focus();
        return;
      case "confidence":
        if (!active() || !a.checked[a.index]) return;
        S.confidence(
          state,
          lookup(a.ids[a.index]),
          el.dataset.grade,
          todayKey(),
        );
        save();
        $("next-review").textContent =
          "Next review: " + state.questions[a.ids[a.index]].due;
        return;
      case "previous":
        if (active()) a.index = Math.max(0, a.index - 1);
        break;
      case "next":
        if (active()) a.index = Math.min(a.ids.length - 1, a.index + 1);
        break;
      case "jump":
        if (active()) a.index = Number(el.dataset.index);
        break;
      case "finish":
        if (!active()) return;
        if (
          a.kind === "exam" &&
          a.answers.some((v) => v === null) &&
          !window.confirm(
            "Submit with unanswered questions? They will count as incorrect.",
          )
        )
          return;
        S.finish(state, bank, todayKey());
        notice = "";
        break;
      case "variant": {
        const ex = tools.calculations.find((x) => x.id === el.dataset.id),
          r = state.exercises[ex.id] || {};
        state.exercises[ex.id] = {
          ...r,
          variant:
            ((Number.isInteger(r.variant) ? r.variant : 0) + 1) %
            ex.variants.length,
          solutionSeen: false,
        };
        save();
        const y = el.closest("article").getBoundingClientRect().top;
        render();
        const card = document.querySelector(`[data-exercise="${ex.id}"]`);
        window.scrollBy(0, card.getBoundingClientRect().top - y);
        card.querySelector("input").focus({ preventScroll: true });
        return;
      }
      case "node":
        selectedNode = el.dataset.id;
        render();
        document
          .querySelector(`[data-action="node"][data-id="${selectedNode}"]`)
          ?.focus({ preventScroll: true });
        return;
      case "stata-check": {
        const ex = tools.stata.find((x) => x.id === el.dataset.id),
          selected = document.querySelector(
            `input[name="stata-${ex.id}"]:checked`,
          ),
          out = $("stata-feedback-" + ex.id);
        if (!selected) {
          out.textContent = "Choose an interpretation first.";
          return;
        }
        const right = Number(selected.value) === ex.answer,
          r = state.exercises["stata-" + ex.id] || {};
        state.exercises["stata-" + ex.id] = {
          attempts: (Number.isInteger(r.attempts) ? r.attempts : 0) + 1,
          lastCorrect: right,
        };
        save();
        out.innerHTML = `<div class="study-feedback${right ? "" : " incorrect"}"><strong>${right ? "Correct" : "Review the interpretation"}</strong><p>${esc(ex.explanation)}</p><a href="${link(ex.topic, ex.section)}">Review the relevant foundation →</a></div>`;
        return;
      }
      default:
        return;
    }
    save();
    render();
    if (["previous", "next", "jump"].includes(action))
      $("session-prompt")?.focus();
    if (action === "finish") $("session-result")?.focus();
  });
  window.addEventListener("hashchange", () => {
    notice = "";
    expire();
    render(true);
  });
  window.addEventListener("storage", (e) => {
    if (!loading && e.key === PROGRESS_KEY) {
      state = S.reconcile(S.read(), bank, loadProgress(), todayKey());
      expire();
      render();
    }
  });
  // Deadlines use wall-clock time, so background throttling and reloads cannot pause an exam.
  window.setInterval(() => {
    if (loading) return;
    if (lastDay !== todayKey()) {
      lastDay = todayKey();
      render();
    }
    if (!expire()) tickLabel();
  }, 1000);
  async function init() {
    const files = new Map();
    const read = async (file) => {
      const text = await fetchText(file);
      if (text !== null) files.set(file, text);
      return text;
    };
    try {
      const [data, raw] = await Promise.all([
        loadAll(read),
        read("content/modules/statistics/study-tools.json"),
      ]);
      const module = data.modules.find((x) => x.id === "statistics");
      if (!module || !raw)
        throw new Error("Statistics content is unavailable.");
      tools = JSON.parse(raw);
      if (tools.schemaVersion !== 1)
        throw new Error("Unsupported study tools version.");
      topics = module.topics.filter((t) => t.lecture);
      bank = module.questions.filter(
        (q) => q.type === "mcq" && topics.some((t) => t.id === q.topic),
      );
      if (!bank.length || topics.length !== 6)
        throw new Error("The covered lecture bank could not be loaded.");
      state = S.reconcile(S.read(), bank, loadProgress(), todayKey());
      // Migration itself is not a study activity.
      const p = loadProgress();
      p.statistics = state;
      if (!saveProgress(p)) S.save(state);
      $("storage-warning").hidden = !S.storageUnavailable();
      $("study-status").hidden = true;
      $("study-content").hidden = false;
      loading = false;
      expire();
      render();
      if ("serviceWorker" in navigator && "caches" in window) {
        navigator.serviceWorker.ready
          .then(async () => {
            const cache = await caches.open("data");
            await Promise.all(
              [...files].map(([file, text]) =>
                cache.put(
                  new URL(file, location.href).href,
                  new Response(text, {
                    headers: {
                      "content-type": "application/json",
                      "x-saved-at": new Date().toISOString(),
                    },
                  }),
                ),
              ),
            );
            $("study-offline").textContent =
              "Study tools ready for offline use on this device.";
          })
          .catch(() => {
            $("study-offline").textContent =
              "Offline copies are unavailable in this browser.";
          });
      }
    } catch (error) {
      $("study-status").innerHTML =
        `Unable to open the study centre. ${esc(error.message)} ${button("reload", "Try again")}`;
      $("study-status")
        .querySelector("button")
        .addEventListener("click", () => location.reload());
    }
  }
  init();
})();
