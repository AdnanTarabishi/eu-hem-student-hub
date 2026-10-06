// FHEM Exam Centre: student-created mock exams for the available Health Economics sessions.
(function (root) {
  "use strict";

  const COURSE_ID = "fund-health-econ-management";
  const MODULE_ID = "fund-health-economics";
  const PATH_FILE = "content/modules/fund-health-economics/learning-path.json";
  const STORAGE_KEY = "euhem-fhem-exam-v1";
  const FULL_MINUTES = 90;
  const QUICK_MINUTES = 20;

  const host = document.getElementById("fhem-exam");
  let data = null;
  let course = null;
  let module = null;
  let learningPath = null;
  let questionsById = new Map();
  let timerId = null;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const a = (label, href, className = "hem-link") => {
    const node = el("a", className, label);
    node.href = href;
    return node;
  };

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || parsed.version !== 1) return { version: 1, active: null, history: [] };
      return {
        version: 1,
        active: parsed.active && typeof parsed.active === "object" ? parsed.active : null,
        history: Array.isArray(parsed.history) ? parsed.history.slice(0, 8) : [],
      };
    } catch {
      return { version: 1, active: null, history: [] };
    }
  }

  function writeState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      let n;
      if (root.crypto?.getRandomValues) {
        const buf = new Uint32Array(1);
        root.crypto.getRandomValues(buf);
        n = buf[0] / 4294967296;
      } else {
        n = Math.random();
      }
      const j = Math.floor(n * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function sessionTopics() {
    return learningPath.sessions
      .filter((session) => session.status === "available" && session.topic)
      .sort((a, b) => a.number - b.number);
  }

  function sessionForTopic(topic) {
    return learningPath.sessions.find((session) => session.topic === topic) || null;
  }

  function questionTypeLabel(question) {
    if (question.type === "mcq") return "Multiple choice";
    if (question.type === "true-false") return "True / False";
    return "Open question";
  }

  function selectBalanced(type, perSession) {
    const selected = [];
    for (const session of sessionTopics()) {
      const pool = shuffle(
        module.questions.filter(
          (question) =>
            question.topic === session.topic &&
            question.type === type &&
            !question.sample,
        ),
      );
      selected.push(...pool.slice(0, perSession));
    }
    return selected;
  }

  function buildSet(kind) {
    if (kind === "quick") {
      return shuffle([
        ...selectBalanced("mcq", 2),
        ...selectBalanced("true-false", 1),
      ]);
    }

    const objective = [
      ...selectBalanced("mcq", 3),
      ...selectBalanced("true-false", 2),
    ];
    const shortSessions = shuffle(sessionTopics()).slice(0, 3);
    const short = shortSessions
      .map((session) =>
        shuffle(
          module.questions.filter(
            (question) =>
              question.topic === session.topic &&
              question.type === "short-answer" &&
              !question.sample,
          ),
        )[0],
      )
      .filter(Boolean);
    return [...shuffle(objective), ...shuffle(short)];
  }

  function minutesFor(kind) {
    return kind === "quick" ? QUICK_MINUTES : FULL_MINUTES;
  }

  function startExam(kind) {
    const selected = buildSet(kind);
    if (!selected.length) return;
    const now = Date.now();
    const state = readState();
    state.active = {
      version: 1,
      id: String(now),
      kind,
      startedAt: now,
      deadline: now + minutesFor(kind) * 60 * 1000,
      questionIds: selected.map((question) => question.id),
      answers: {},
      current: 0,
      submitted: false,
      completedAt: null,
      timedOut: false,
      openGrades: {},
    };
    writeState(state);
    render();
  }

  function currentQuestions(active) {
    return active.questionIds
      .map((id) => questionsById.get(id))
      .filter(Boolean);
  }

  function isAnswered(question, value) {
    if (question.type === "short-answer") return typeof value === "string" && value.trim().length > 0;
    return value !== undefined && value !== null && value !== "";
  }

  function objectiveCorrect(question, value) {
    if (!isAnswered(question, value)) return false;
    if (question.type === "true-false") return value === String(question.answer);
    return value === question.answer;
  }

  function objectiveStats(active) {
    const list = currentQuestions(active).filter((question) => question.type !== "short-answer");
    const correct = list.filter((question) =>
      objectiveCorrect(question, active.answers[question.id]),
    ).length;
    return {
      correct,
      total: list.length,
      percent: list.length ? Math.round((correct / list.length) * 100) : 0,
    };
  }

  function timeText(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function usedTime(active) {
    const end = active.completedAt || Date.now();
    return Math.max(0, Math.min(end - active.startedAt, minutesFor(active.kind) * 60 * 1000));
  }

  function persistAnswer(question, value) {
    const state = readState();
    if (!state.active || state.active.submitted) return;
    state.active.answers[question.id] = value;
    writeState(state);
    updateNavigation(state.active);
  }

  function setCurrent(index) {
    const state = readState();
    if (!state.active || state.active.submitted) return;
    const max = state.active.questionIds.length - 1;
    state.active.current = Math.max(0, Math.min(max, index));
    writeState(state);
    renderActive(state.active);
  }

  function finishExam(timedOut) {
    const state = readState();
    const active = state.active;
    if (!active || active.submitted) return;

    active.submitted = true;
    active.completedAt = Date.now();
    active.timedOut = Boolean(timedOut);
    const stats = objectiveStats(active);
    const openCount = currentQuestions(active).filter((q) => q.type === "short-answer").length;
    state.history.unshift({
      id: active.id,
      kind: active.kind,
      completedAt: active.completedAt,
      objectiveCorrect: stats.correct,
      objectiveTotal: stats.total,
      objectivePercent: stats.percent,
      openCount,
      timedOut: active.timedOut,
      usedMs: usedTime(active),
    });
    state.history = state.history.slice(0, 8);
    writeState(state);
    render();
  }

  function resetActive() {
    const state = readState();
    state.active = null;
    writeState(state);
    render();
  }

  function renderIdentity() {
    if (root.HealthEconManagement?.identity) {
      return root.HealthEconManagement.identity("exam");
    }
    return null;
  }

  function renderDashboard(state) {
    host.innerHTML = "";
    const shell = el("div", "hem-exam-shell");
    const identity = renderIdentity();
    if (identity) shell.appendChild(identity);

    const hero = el("section", "hem-exam-hero");
    const copy = el("div", "hem-exam-copy");
    copy.innerHTML = `
      <p class="hem-kicker">FHEM EXAM CENTRE / HEALTH ECONOMICS · 79060</p>
      <h1>Practise the format.<br><em>Keep the score honest.</em></h1>
      <p>This centre uses the original Student Hub question bank from Sessions 1–5. The full mock is timed for 90 minutes and hides answers until you submit.</p>
      <div class="hem-exam-facts">
        <span>5 completed sessions</span>
        <span>${module.questions.filter((q) => !q.sample).length} practice questions</span>
        <span>Progress stays on this device</span>
      </div>
    `;

    const official = el("aside", "hem-exam-official");
    official.innerHTML = `
      <p class="hem-kicker">WHAT THE COURSE MATERIALS SUPPORT</p>
      <h2>Official exam format</h2>
      <div class="hem-official-grid">
        <div class="hem-official-item"><span>Duration</span><strong>90 minutes</strong></div>
        <div class="hem-official-item"><span>Format</span><strong>Written</strong></div>
        <div class="hem-official-item"><span>Conditions</span><strong>Closed book</strong></div>
        <div class="hem-official-item"><span>Question types</span><strong>Open · T/F · MCQ</strong></div>
      </div>
      <p>The available course material does not specify the exact number or weighting of each question type. The Student Hub mock composition below is therefore practice design, not an official blueprint.</p>
    `;
    hero.append(copy, official);
    shell.appendChild(hero);

    if (state.active && !state.active.submitted) {
      const resume = el("section", "hem-exam-disclaimer");
      const remaining = state.active.deadline - Date.now();
      resume.innerHTML = `
        <div><strong>Exam in progress.</strong><br>
        ${state.active.kind === "full" ? "90-minute full mock" : "20-minute quick drill"} ·
        ${currentQuestions(state.active).filter((q) => isAnswered(q, state.active.answers[q.id])).length} of ${state.active.questionIds.length} answered ·
        ${timeText(remaining)} remaining.</div>
      `;
      const button = el("button", "hem-button", "Resume →");
      button.type = "button";
      button.addEventListener("click", () => renderActive(readState().active));
      resume.appendChild(button);
      shell.appendChild(resume);
    }

    const modes = el("section", "hem-exam-mode-grid");

    const full = el("article", "hem-exam-mode is-primary");
    full.innerHTML = `
      <p class="hem-kicker">FULL MOCK / 90 MINUTES</p>
      <h2>Mixed exam simulation</h2>
      <p>Balanced across Sessions 1–5. Answers stay hidden until submission. Objective questions are scored automatically; open questions are reviewed against model answers afterwards.</p>
      <div class="hem-mode-spec">
        <span>15 MCQs</span><span>10 True / False</span><span>3 open questions</span><span>Sessions 1–5</span>
      </div>
    `;
    const fullActions = el("div", "hem-actions");
    const fullButton = el("button", "hem-button", "Start 90-minute mock →");
    fullButton.type = "button";
    fullButton.addEventListener("click", () => startExam("full"));
    fullActions.appendChild(fullButton);
    full.appendChild(fullActions);

    const quick = el("article", "hem-exam-mode");
    quick.innerHTML = `
      <p class="hem-kicker">QUICK DRILL / 20 MINUTES</p>
      <h2>Fast objective check</h2>
      <p>Use this when you want a shorter mixed run before returning to a weak session.</p>
      <div class="hem-mode-spec">
        <span>10 MCQs</span><span>5 True / False</span><span>No open questions</span>
      </div>
    `;
    const quickActions = el("div", "hem-actions");
    const quickButton = el("button", "hem-button hem-secondary", "Start quick drill →");
    quickButton.type = "button";
    quickButton.addEventListener("click", () => startExam("quick"));
    quickActions.appendChild(quickButton);
    quick.appendChild(quickActions);

    modes.append(full, quick);
    shell.appendChild(modes);

    const disclaimer = el("div", "hem-exam-disclaimer");
    disclaimer.innerHTML =
      '<div><strong>Student-created practice.</strong><br>The questions, composition and scoring on this page are original EU-HEM Student Hub material. They are not past exam questions and should not be interpreted as the professor’s official weighting.</div>';
    shell.appendChild(disclaimer);

    const history = el("section", "hem-history");
    history.innerHTML =
      '<div class="hem-section-heading"><div><p class="hem-kicker">YOUR RECENT ATTEMPTS</p><h2>Use the trend, not one score.</h2></div><p>Objective scores are comparable across attempts. Open questions are deliberately kept separate because official weighting is not published.</p></div>';

    if (!state.history.length) {
      history.appendChild(
        el("p", "hem-history-empty", "No completed mock exams yet. Your recent attempts will appear here."),
      );
    } else {
      const list = el("div", "hem-history-list");
      for (const item of state.history) {
        const row = el("div", "hem-history-row");
        const date = new Date(item.completedAt);
        row.append(
          el("strong", null, item.kind === "full" ? "Full mock" : "Quick drill"),
          el("span", null, date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })),
          el("span", null, `${item.objectiveCorrect}/${item.objectiveTotal} objective`),
          el("span", null, `${item.objectivePercent}% · ${timeText(item.usedMs)}`),
        );
        list.appendChild(row);
      }
      history.appendChild(list);
    }
    shell.appendChild(history);
    host.appendChild(shell);
  }

  function renderActive(active) {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    if (!active) return renderDashboard(readState());
    if (active.deadline <= Date.now() && !active.submitted) {
      finishExam(true);
      return;
    }

    host.innerHTML = "";
    const shell = el("div", "hem-active-exam");
    const identity = renderIdentity();
    if (identity) shell.appendChild(identity);

    const questions = currentQuestions(active);
    if (!questions.length) {
      resetActive();
      return;
    }

    active.current = Math.max(0, Math.min(active.current || 0, questions.length - 1));
    const current = questions[active.current];
    const answered = questions.filter((q) => isAnswered(q, active.answers[q.id])).length;

    const toolbar = el("div", "hem-exam-toolbar");
    const title = el("div", "hem-exam-toolbar-title");
    title.innerHTML = `
      <strong>${active.kind === "full" ? "90-minute full mock" : "20-minute quick drill"}</strong>
      <span>${answered} of ${questions.length} answered · objective answers stay hidden until submission</span>
    `;
    const clock = el("div", "hem-exam-clock");
    clock.id = "hem-exam-clock";
    clock.textContent = timeText(active.deadline - Date.now());

    const submit = el("button", "hem-button hem-danger-button", "Submit exam");
    submit.type = "button";
    submit.addEventListener("click", () => {
      const unanswered = questions.length - questions.filter((q) => isAnswered(q, readState().active?.answers?.[q.id])).length;
      const text = unanswered
        ? `Submit now with ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}?`
        : "Submit your exam now?";
      if (root.confirm(text)) finishExam(false);
    });
    toolbar.append(title, clock, submit);
    shell.appendChild(toolbar);

    const progress = el("div", "hem-exam-progress");
    progress.innerHTML = `<span style="width:${Math.round(((active.current + 1) / questions.length) * 100)}%"></span>`;
    shell.appendChild(progress);

    const layout = el("div", "hem-exam-layout");
    const nav = el("aside", "hem-exam-nav");
    nav.id = "hem-exam-nav";
    nav.appendChild(el("p", "hem-kicker", "QUESTION MAP"));
    const navGrid = el("div", "hem-exam-nav-grid");
    navGrid.id = "hem-exam-nav-grid";
    nav.appendChild(navGrid);
    const legend = el("div", "hem-exam-nav-legend");
    legend.innerHTML = '<span>Filled = answered</span><span>Dark = current question</span>';
    nav.appendChild(legend);

    const main = el("div", "hem-exam-question-wrap");
    const card = el("article", "hem-exam-question-card");
    const meta = el("div", "hem-question-meta");
    const session = sessionForTopic(current.topic);
    meta.append(
      el("span", null, `Question ${active.current + 1} of ${questions.length}`),
      el("span", current.type === "short-answer" ? "is-open" : "", questionTypeLabel(current)),
      el("span", null, session ? `Session ${session.number}` : "Health Economics"),
    );
    card.appendChild(meta);
    card.appendChild(el("p", "hem-exam-question", current.question));

    const value = active.answers[current.id];
    if (current.type === "mcq") {
      const list = el("div", "hem-exam-options");
      current.options.forEach((option, index) => {
        const letter = String.fromCharCode(65 + index);
        const label = el("label", "hem-exam-option");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "exam-answer";
        input.value = letter;
        input.checked = value === letter;
        input.addEventListener("change", () => persistAnswer(current, letter));
        label.append(input, el("span", null, `${letter}. ${option}`));
        list.appendChild(label);
      });
      card.appendChild(list);
    } else if (current.type === "true-false") {
      const list = el("div", "hem-exam-options");
      for (const [answerValue, labelText] of [["true", "True"], ["false", "False"]]) {
        const label = el("label", "hem-exam-option");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "exam-answer";
        input.value = answerValue;
        input.checked = value === answerValue;
        input.addEventListener("change", () => persistAnswer(current, answerValue));
        label.append(input, el("span", null, labelText));
        list.appendChild(label);
      }
      card.appendChild(list);
    } else {
      const area = el("textarea", "hem-exam-textarea");
      area.placeholder = "Write your answer as you would in a closed-book written exam. The model answer appears only after submission.";
      area.value = typeof value === "string" ? value : "";
      area.addEventListener("input", () => persistAnswer(current, area.value));
      card.appendChild(area);
    }

    const actions = el("div", "hem-exam-question-actions");
    const previous = el("button", "hem-button hem-secondary", "← Previous");
    previous.type = "button";
    previous.disabled = active.current === 0;
    previous.addEventListener("click", () => setCurrent(active.current - 1));

    const saved = el("span", "hem-exam-save", "Answers are saved locally as you work.");

    const next = el(
      "button",
      "hem-button",
      active.current === questions.length - 1 ? "Review question map" : "Next →",
    );
    next.type = "button";
    next.addEventListener("click", () => {
      if (active.current === questions.length - 1) nav.scrollIntoView({ behavior: "smooth", block: "center" });
      else setCurrent(active.current + 1);
    });
    actions.append(previous, saved, next);
    card.appendChild(actions);
    main.appendChild(card);

    const submitCard = el("div", "hem-exam-submit-card");
    submitCard.innerHTML = `<strong>${answered} / ${questions.length} answered</strong><p>Use the question map to revisit anything blank. Submitting reveals objective answers and model answers for open questions.</p>`;
    const finish = el("button", "hem-button hem-danger-button", "Finish and submit");
    finish.type = "button";
    finish.addEventListener("click", () => submit.click());
    submitCard.appendChild(finish);
    main.appendChild(submitCard);

    layout.append(nav, main);
    shell.appendChild(layout);
    host.appendChild(shell);

    updateNavigation(active);

    const tick = () => {
      const state = readState();
      const nowActive = state.active;
      if (!nowActive || nowActive.submitted) {
        clearInterval(timerId);
        timerId = null;
        return;
      }
      const left = nowActive.deadline - Date.now();
      const node = document.getElementById("hem-exam-clock");
      if (node) {
        node.textContent = timeText(left);
        node.classList.toggle("is-low", left < 5 * 60 * 1000);
      }
      if (left <= 0) finishExam(true);
    };
    timerId = setInterval(tick, 500);
    tick();
  }

  function updateNavigation(active) {
    const grid = document.getElementById("hem-exam-nav-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const questions = currentQuestions(active);
    questions.forEach((question, index) => {
      const button = el("button", "", String(index + 1));
      button.type = "button";
      button.setAttribute("aria-label", `Go to question ${index + 1}`);
      if (isAnswered(question, active.answers[question.id])) button.classList.add("is-answered");
      if (index === active.current) button.classList.add("is-current");
      button.addEventListener("click", () => setCurrent(index));
      grid.appendChild(button);
    });

    const answered = questions.filter((q) => isAnswered(q, active.answers[q.id])).length;
    const title = document.querySelector(".hem-exam-toolbar-title span");
    if (title) {
      title.textContent = `${answered} of ${questions.length} answered · objective answers stay hidden until submission`;
    }
  }

  function correctAnswerText(question) {
    if (question.type === "mcq") {
      const index = question.answer.charCodeAt(0) - 65;
      return `${question.answer}. ${question.options[index]}`;
    }
    if (question.type === "true-false") return question.answer ? "True" : "False";
    return question.answer;
  }

  function renderResult(state) {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    const active = state.active;
    const questions = currentQuestions(active);
    const stats = objectiveStats(active);
    const open = questions.filter((q) => q.type === "short-answer");
    const reviewed = open.filter((q) => active.openGrades?.[q.id]).length;

    host.innerHTML = "";
    const shell = el("div", "hem-exam-shell");
    const identity = renderIdentity();
    if (identity) shell.appendChild(identity);

    const resultHero = el("section", "hem-exam-result-hero");
    const copy = el("div");
    copy.innerHTML = `
      <p class="hem-kicker">${active.timedOut ? "TIME EXPIRED / RESULT" : "MOCK COMPLETE / RESULT"}</p>
      <h1>${stats.correct} of ${stats.total} objective questions correct.</h1>
      <p class="hem-caption">The percentage below covers MCQ and True/False only. Open questions stay separate because the official course material does not publish their weighting.</p>
    `;
    const ring = el("div", "hem-objective-score");
    ring.innerHTML = `<div><strong>${stats.percent}%</strong><span>objective</span></div>`;
    resultHero.append(copy, ring);
    shell.appendChild(resultHero);

    const metrics = el("div", "hem-result-grid");
    const values = [
      ["Time used", timeText(usedTime(active))],
      ["Questions answered", `${questions.filter((q) => isAnswered(q, active.answers[q.id])).length} / ${questions.length}`],
      ["Open answers reviewed", `${reviewed} / ${open.length}`],
    ];
    for (const [label, value] of values) {
      const card = el("div", "hem-result-metric");
      card.append(el("span", null, label), el("strong", null, value));
      metrics.appendChild(card);
    }
    shell.appendChild(metrics);

    const wrong = questions.filter(
      (q) => q.type !== "short-answer" && !objectiveCorrect(q, active.answers[q.id]),
    );
    const objectiveSection = el("section", "hem-review-section");
    objectiveSection.innerHTML = `<div class="hem-section-heading"><div><p class="hem-kicker">OBJECTIVE REVIEW</p><h2>${wrong.length ? `${wrong.length} item${wrong.length === 1 ? "" : "s"} to revisit.` : "No objective mistakes."}</h2></div><p>Use each explanation to return to the underlying session rather than memorising the letter.</p></div>`;

    if (wrong.length) {
      const list = el("div", "hem-review-list");
      for (const q of wrong) {
        const card = el("article", "hem-review-card is-wrong");
        const session = sessionForTopic(q.topic);
        card.innerHTML = `<p class="hem-kicker">${session ? `SESSION ${session.number}` : "HEALTH ECONOMICS"} · ${questionTypeLabel(q).toUpperCase()}</p>`;
        card.appendChild(el("h3", null, q.question));
        card.appendChild(
          el(
            "p",
            "hem-review-answer",
            `Your answer: ${active.answers[q.id] || "(not answered)"}`,
          ),
        );
        const correct = el("p", "hem-review-answer");
        correct.append(el("strong", null, "Correct answer: "), document.createTextNode(correctAnswerText(q)));
        card.appendChild(correct);
        if (q.explanation) {
          const explain = el("p", "hem-review-answer");
          explain.append(el("strong", null, "Why: "), document.createTextNode(q.explanation));
          card.appendChild(explain);
        }
        if (session?.topic) card.appendChild(a("Review this session →", `lecture.html?topic=${encodeURIComponent(session.topic)}#learn`));
        list.appendChild(card);
      }
      objectiveSection.appendChild(list);
    }
    shell.appendChild(objectiveSection);

    if (open.length) {
      const openSection = el("section", "hem-review-section");
      openSection.innerHTML = '<div class="hem-section-heading"><div><p class="hem-kicker">OPEN-QUESTION REVIEW</p><h2>Compare structure, not exact wording.</h2></div><p>Mark each answer only after comparing your reasoning with the model answer. This self-review is not converted into an official grade.</p></div>';
      const list = el("div", "hem-review-list");
      for (const q of open) {
        const card = el("article", "hem-review-card");
        const session = sessionForTopic(q.topic);
        card.innerHTML = `<p class="hem-kicker">${session ? `SESSION ${session.number}` : "HEALTH ECONOMICS"} · OPEN QUESTION</p>`;
        card.appendChild(el("h3", null, q.question));
        const yours = el("div", "hem-open-model");
        const yoursStrong = el("strong", null, "Your answer");
        yours.append(yoursStrong, document.createElement("br"), document.createTextNode(active.answers[q.id] || "(no answer written)"));
        card.appendChild(yours);
        const model = el("div", "hem-open-model");
        const modelStrong = el("strong", null, "Model answer");
        model.append(modelStrong, document.createElement("br"), document.createTextNode(q.answer));
        card.appendChild(model);
        if (q.explanation) {
          const note = el("p", "hem-review-answer");
          note.append(el("strong", null, "What to look for: "), document.createTextNode(q.explanation));
          card.appendChild(note);
        }
        const grade = el("div", "hem-open-grade");
        for (const [value, label] of [["covered", "✓ Core points covered"], ["needs", "↻ Needs more work"]]) {
          const button = el("button", "", label);
          button.type = "button";
          button.setAttribute("aria-pressed", String(active.openGrades?.[q.id] === value));
          button.addEventListener("click", () => {
            const fresh = readState();
            if (!fresh.active?.submitted) return;
            fresh.active.openGrades = fresh.active.openGrades || {};
            fresh.active.openGrades[q.id] = value;
            writeState(fresh);
            renderResult(fresh);
          });
          grade.appendChild(button);
        }
        card.appendChild(grade);
        if (session?.topic) card.appendChild(a("Review this session →", `lecture.html?topic=${encodeURIComponent(session.topic)}#learn`));
        list.appendChild(card);
      }
      openSection.appendChild(list);
      shell.appendChild(openSection);
    }

    const actions = el("div", "hem-result-actions");
    const newExam = el("button", "hem-button", "Start a new mock");
    newExam.type = "button";
    newExam.addEventListener("click", resetActive);
    actions.append(
      newExam,
      a("Back to course hub", `course.html?course=${COURSE_ID}`, "hem-button hem-secondary"),
      a("Open question bank", `course.html?course=${COURSE_ID}&tab=practice#question-bank`, "hem-button hem-secondary"),
    );
    shell.appendChild(actions);
    host.appendChild(shell);
  }

  function render() {
    const state = readState();
    if (state.active?.submitted) return renderResult(state);
    if (state.active && state.active.deadline <= Date.now()) {
      finishExam(true);
      return;
    }
    renderDashboard(state);
  }

  async function init() {
    try {
      data = await loadAll();
      course = data.courses.find((item) => item.id === COURSE_ID);
      module = course?.modules.find((item) => item.id === MODULE_ID);
      learningPath = await readJson(fetchText, PATH_FILE, null);
      if (!course || !module || !learningPath) throw new Error("Course data is incomplete.");
      questionsById = new Map(module.questions.filter((q) => !q.sample).map((q) => [q.id, q]));
      document.title = "FHEM Exam Centre – EU-HEM Student Hub";
      render();
    } catch (error) {
      console.error("FHEM exam centre:", error);
      host.innerHTML = "";
      const box = el("section", "card");
      box.append(
        el("h2", null, "The exam centre could not be loaded."),
        el("p", null, "Please reload the page or return to the FHEM course hub."),
        a("← Back to the course hub", `course.html?course=${COURSE_ID}`),
      );
      host.appendChild(box);
    }
  }

  init();
})(window);
