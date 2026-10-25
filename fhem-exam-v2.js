// FHEM Exam Centre v2: fixed exam-style mocks, random mock, focused bank and comprehensive drill.
(function (root) {
  "use strict";

  const COURSE_ID = "fund-health-econ-management";
  const MODULE_ID = "fund-health-economics";
  const PATH_FILE = "content/modules/fund-health-economics/learning-path.json";
  const STORAGE_KEY = "euhem-fhem-exam-v2";
  const host = document.getElementById("fhem-exam");

  let course = null;
  let module = null;
  let learningPath = null;
  let bank = null;
  let styleMap = new Map();
  let normalMap = new Map();
  let timerId = null;

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
  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const random = root.crypto?.getRandomValues
        ? (() => { const value = new Uint32Array(1); root.crypto.getRandomValues(value); return value[0] / 4294967296; })()
        : Math.random();
      const j = Math.floor(random * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || parsed.version !== 2) return { version: 2, active: null, history: [] };
      return {
        version: 2,
        active: parsed.active && typeof parsed.active === "object" ? parsed.active : null,
        history: Array.isArray(parsed.history) ? parsed.history.slice(0, 12) : [],
      };
    } catch {
      return { version: 2, active: null, history: [] };
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

  function sessionForTopic(topic) {
    return learningPath.sessions.find((session) => session.topic === topic) || null;
  }

  function questionFromRef(ref) {
    return ref.source === "style" ? styleMap.get(ref.id) : normalMap.get(ref.id);
  }

  function currentItems(active) {
    return (active.questionRefs || [])
      .map((ref) => ({ ref, question: questionFromRef(ref) }))
      .filter((item) => item.question);
  }

  function isStyleQuestion(question) {
    return question.type === "exam-mcq" || question.type === "exam-binary" || question.type === "exam-open";
  }

  function isOpen(question) {
    return question.type === "exam-open" || question.type === "short-answer";
  }

  function answerPresent(question, value) {
    if (isOpen(question)) return typeof value === "string" && value.trim().length > 0;
    return value !== undefined && value !== null && value !== "";
  }

  function styleOption(question, answer) {
    return question.options?.find((option) => option.id === answer) || null;
  }

  function normalCorrect(question, answer) {
    if (!answerPresent(question, answer) || isOpen(question)) return false;
    if (question.type === "true-false") return answer === String(question.answer);
    return answer === question.answer;
  }

  function scoreQuestion(question, answer) {
    if (!answerPresent(question, answer) || isOpen(question)) return 0;
    if (isStyleQuestion(question)) return styleOption(question, answer)?.score || 0;
    return normalCorrect(question, answer) ? 1 : 0;
  }

  function maxQuestionScore(question) {
    if (question.type === "exam-open") return question.maxScore || 60;
    if (question.type === "exam-mcq" || question.type === "exam-binary") return question.maxScore || Math.max(...question.options.map((option) => option.score));
    if (isOpen(question)) return 0;
    return 1;
  }

  function objectiveStats(active) {
    const items = currentItems(active).filter(({ question }) => !isOpen(question));
    const raw = items.reduce((sum, { question }) => sum + scoreQuestion(question, active.answers?.[question.id]), 0);
    const max = items.reduce((sum, { question }) => sum + maxQuestionScore(question), 0);
    const fullyCorrect = items.filter(({ question }) => {
      if (isStyleQuestion(question)) return scoreQuestion(question, active.answers?.[question.id]) === maxQuestionScore(question);
      return normalCorrect(question, active.answers?.[question.id]);
    }).length;
    return { raw, max, fullyCorrect, total: items.length, percent: max ? Math.round((raw / max) * 100) : 0 };
  }

  function rubricScore(active) {
    const openItems = currentItems(active).filter(({ question }) => question.type === "exam-open");
    let score = 0;
    let max = 0;
    for (const { question } of openItems) {
      for (const criterion of question.rubric || []) {
        score += Number(active.rubricScores?.[question.id]?.[criterion.id] || 0);
        max += criterion.max;
      }
    }
    return { score, max };
  }

  function timeText(milliseconds) {
    if (milliseconds === null || milliseconds === undefined) return "Untimed";
    const total = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function usedTime(active) {
    const end = active.completedAt || Date.now();
    return Math.max(0, end - active.startedAt);
  }

  function identity() {
    return root.HealthEconManagement?.identity?.("exam") || null;
  }

  function styleRef(id, label, section) {
    return { source: "style", id, label, section };
  }

  function normalRef(question, index) {
    return { source: "normal", id: question.id, label: `Q${index + 1}`, section: question.type === "short-answer" ? "Open" : "Objective" };
  }

  function fixedExam(mockId) {
    const mock = bank.fixedMocks.find((item) => item.id === mockId);
    if (!mock) return null;
    const refs = [
      ...mock.mcqIds.map((id, index) => styleRef(id, `A${index + 1}`, "A")),
      ...mock.binaryIds.map((id, index) => styleRef(id, `B${index + 1}`, "B")),
      styleRef(mock.openId, "C", "C"),
    ];
    return {
      mode: mock.id,
      title: mock.title,
      subtitle: mock.subtitle,
      description: mock.description,
      examStyle: true,
      minutes: 90,
      refs,
    };
  }

  function randomExam() {
    const byTopic = new Map();
    for (const question of bank.mcqs) {
      if (!byTopic.has(question.topic)) byTopic.set(question.topic, []);
      byTopic.get(question.topic).push(question);
    }
    const topics = shuffle([...byTopic.keys()]);
    const selected = [];
    for (const topic of topics.slice(0, 6)) {
      selected.push(shuffle(byTopic.get(topic))[0]);
    }
    while (selected.length < 6) {
      const candidate = shuffle(bank.mcqs).find((question) => !selected.some((item) => item.id === question.id));
      if (!candidate) break;
      selected.push(candidate);
    }
    const binaries = [];
    for (const question of shuffle(bank.binaries)) {
      if (binaries.length >= 2) break;
      if (!binaries.some((item) => item.topic === question.topic)) binaries.push(question);
    }
    while (binaries.length < 2) {
      const candidate = shuffle(bank.binaries).find((question) => !binaries.some((item) => item.id === question.id));
      if (!candidate) break;
      binaries.push(candidate);
    }
    const openQuestion = shuffle(bank.opens)[0];
    return {
      mode: "random-official",
      title: "Random Exam-Style Mock",
      subtitle: "A new balanced paper on every attempt",
      description: "Six exam-style MCQs, two binary traps and one policy case selected from the separate exam-style bank.",
      examStyle: true,
      minutes: 90,
      refs: [
        ...selected.map((question, index) => styleRef(question.id, `A${index + 1}`, "A")),
        ...binaries.map((question, index) => styleRef(question.id, `B${index + 1}`, "B")),
        styleRef(openQuestion.id, "C", "C"),
      ],
    };
  }

  function balancedNormal(type, perSession) {
    const selected = [];
    const sessions = learningPath.sessions.filter((session) => session.status === "available" && session.topic);
    for (const session of sessions) {
      const pool = shuffle(module.questions.filter((question) => question.topic === session.topic && question.type === type && !question.sample));
      selected.push(...pool.slice(0, perSession));
    }
    return selected;
  }

  function comprehensiveDrill() {
    const objective = [...balancedNormal("mcq", 3), ...balancedNormal("true-false", 2)];
    const openPool = shuffle(module.questions.filter((question) => question.type === "short-answer" && !question.sample));
    const questions = [...shuffle(objective), ...openPool.slice(0, 4)];
    return {
      mode: "comprehensive",
      title: "Comprehensive Practice Drill",
      subtitle: "Broad coverage without pretending to be the exam format",
      description: "A large untimed review set using the existing session question bank. Scoring is simple mastery scoring, not the exam-style +5/+2/−1 system.",
      examStyle: false,
      minutes: null,
      refs: questions.map(normalRef),
    };
  }

  function focusedBank(kind) {
    if (kind === "bank-mcq") {
      const questions = shuffle(bank.mcqs).slice(0, 12);
      return { mode: kind, title: "MCQ Partial-Credit Lab", subtitle: "Twelve most-appropriate-answer questions", description: "Practise distinguishing fully correct, partly correct and incorrect options.", examStyle: true, minutes: null, refs: questions.map((question, index) => styleRef(question.id, `M${index + 1}`, "MCQ")) };
    }
    if (kind === "bank-binary") {
      return { mode: kind, title: "Binary Trap Lab", subtitle: "Twelve high-yield distinctions", description: "Practise the absolute words, assumptions and reversals that make binary questions difficult.", examStyle: true, minutes: null, refs: shuffle(bank.binaries).map((question, index) => styleRef(question.id, `B${index + 1}`, "Binary")) };
    }
    const question = shuffle(bank.opens)[0];
    return { mode: "bank-open", title: "Open-Question Workshop", subtitle: question.title, description: "Write one full policy answer, then use the 60-point Student Hub rubric and model outline.", examStyle: true, minutes: null, refs: [styleRef(question.id, "C", "Open")] };
  }

  function buildExam(mode) {
    if (mode === "mock-3" || mode === "mock-4") return fixedExam(mode);
    if (mode === "random-official") return randomExam();
    if (mode === "comprehensive") return comprehensiveDrill();
    if (mode === "bank-mcq" || mode === "bank-binary" || mode === "bank-open") return focusedBank(mode);
    return null;
  }

  function startExam(mode) {
    const existing = readState().active;
    if (existing && !existing.submitted && !root.confirm("Starting a new attempt will replace the current in-progress attempt. Continue?")) return;
    const exam = buildExam(mode);
    if (!exam?.refs.length) return;
    const now = Date.now();
    const state = readState();
    state.active = {
      version: 2,
      id: `${mode}-${now}`,
      mode: exam.mode,
      title: exam.title,
      subtitle: exam.subtitle,
      description: exam.description,
      examStyle: exam.examStyle,
      minutes: exam.minutes,
      startedAt: now,
      deadline: exam.minutes ? now + exam.minutes * 60 * 1000 : null,
      questionRefs: exam.refs,
      answers: {},
      current: 0,
      submitted: false,
      completedAt: null,
      timedOut: false,
      rubricScores: {},
      openReviews: {},
    };
    writeState(state);
    render();
  }

  function persistAnswer(question, value) {
    const state = readState();
    if (!state.active || state.active.submitted) return;
    state.active.answers[question.id] = value;
    writeState(state);
    updateNavigation(state.active);
    updateAnswerSheet(state.active);
  }

  function setCurrent(index) {
    const state = readState();
    if (!state.active || state.active.submitted) return;
    state.active.current = clamp(index, 0, state.active.questionRefs.length - 1);
    writeState(state);
    renderActive(state.active);
  }

  function syncHistory(state) {
    const active = state.active;
    if (!active?.submitted) return;
    const objective = objectiveStats(active);
    const rubric = rubricScore(active);
    const item = {
      id: active.id,
      mode: active.mode,
      title: active.title,
      completedAt: active.completedAt,
      timedOut: active.timedOut,
      objectiveRaw: objective.raw,
      objectiveMax: objective.max,
      rubricRaw: rubric.score,
      rubricMax: rubric.max,
      usedMs: usedTime(active),
    };
    const index = state.history.findIndex((history) => history.id === item.id);
    if (index >= 0) state.history[index] = item;
    else state.history.unshift(item);
    state.history = state.history.slice(0, 12);
  }

  function finishExam(timedOut) {
    const state = readState();
    if (!state.active || state.active.submitted) return;
    state.active.submitted = true;
    state.active.completedAt = Date.now();
    state.active.timedOut = Boolean(timedOut);
    syncHistory(state);
    writeState(state);
    render();
  }

  function resetActive() {
    const state = readState();
    state.active = null;
    writeState(state);
    render();
  }

  function renderIdentity(shell) {
    const node = identity();
    if (node) shell.appendChild(node);
  }

  function modeCard(kicker, title, text, specs, buttonText, mode, primary = false) {
    const card = el("article", `hem-exam-mode exam-v2-mode${primary ? " is-primary" : ""}`);
    card.innerHTML = `<p class="hem-kicker">${kicker}</p><h2>${title}</h2><p>${text}</p><div class="hem-mode-spec">${specs.map((spec) => `<span>${spec}</span>`).join("")}</div>`;
    const actions = el("div", "hem-actions");
    const button = el("button", `hem-button${primary ? "" : " hem-secondary"}`, buttonText);
    button.type = "button";
    button.addEventListener("click", () => startExam(mode));
    actions.appendChild(button);
    card.appendChild(actions);
    return card;
  }

  function renderDashboard(state) {
    host.innerHTML = "";
    const shell = el("div", "hem-exam-shell exam-v2-shell");
    renderIdentity(shell);

    const hero = el("section", "hem-exam-hero exam-v2-hero");
    const copy = el("div", "hem-exam-copy");
    copy.innerHTML = `<p class="hem-kicker">FHEM EXAM CENTRE / FORMAT-INFORMED PRACTICE</p><h1>Train the reasoning.<br><em>Simulate the structure.</em></h1><p>The centre now separates true exam-style practice from broad revision. Two fixed original mocks, a random official-format simulation and a comprehensive drill serve different preparation goals.</p><div class="hem-exam-facts"><span>2 fixed original mocks</span><span>${bank.mcqs.length + bank.binaries.length + bank.opens.length} exam-style bank items</span><span>Local-only progress</span></div>`;
    const blueprint = el("aside", "hem-exam-official exam-v2-blueprint");
    blueprint.innerHTML = `<p class="hem-kicker">PATTERN OBSERVED IN TWO 2026 PRACTICE MOCKS</p><h2>90 minutes · 3 sections</h2><div class="hem-official-grid"><div class="hem-official-item"><span>Section A</span><strong>6 MCQ · 30</strong></div><div class="hem-official-item"><span>Section B</span><strong>2 Binary · 16</strong></div><div class="hem-official-item"><span>Section C</span><strong>1 Open · 60</strong></div><div class="hem-official-item"><span>Raw maximum</span><strong>106</strong></div></div><p>MCQ: fully correct +5, partly correct +2, incorrect −1, blank 0. Binary: correct +8, incorrect −2, blank 0. The Student Hub open-question rubric is educational and not an official marking scheme.</p>`;
    hero.append(copy, blueprint);
    shell.appendChild(hero);

    if (state.active && !state.active.submitted) {
      const resume = el("section", "hem-exam-disclaimer exam-v2-resume");
      const answered = currentItems(state.active).filter(({ question }) => answerPresent(question, state.active.answers?.[question.id])).length;
      resume.innerHTML = `<div><strong>Attempt in progress.</strong><br>${state.active.title} · ${answered}/${state.active.questionRefs.length} answered · ${state.active.deadline ? `${timeText(state.active.deadline - Date.now())} remaining` : "untimed"}</div>`;
      const button = el("button", "hem-button", "Resume →");
      button.type = "button";
      button.addEventListener("click", () => renderActive(readState().active));
      resume.appendChild(button);
      shell.appendChild(resume);
    }

    const fixedHeading = el("div", "hem-section-heading");
    fixedHeading.innerHTML = `<div><p class="hem-kicker">FIXED ORIGINAL PAPERS</p><h2>Repeatable mocks for comparable progress.</h2></div><p>These papers imitate the observed structure and difficulty logic without reproducing the uploaded questions.</p>`;
    shell.appendChild(fixedHeading);
    const fixedGrid = el("div", "exam-v2-fixed-grid");
    fixedGrid.append(
      modeCard("MOCK EXAM 3 / 90 MIN", "Cost sharing, incentives and equity", "A cross-session paper on demand, Grossman, disparities, physician behaviour and insurance design.", ["6 MCQ", "2 Binary", "1 Open", "106 raw points"], "Start Mock 3 →", "mock-3", true),
      modeCard("MOCK EXAM 4 / 90 MIN", "Plan competition and premium risk", "A second paper centred on causal identification, practice variation and insurance-market equilibrium.", ["6 MCQ", "2 Binary", "1 Open", "106 raw points"], "Start Mock 4 →", "mock-4"),
    );
    shell.appendChild(fixedGrid);

    const modesHeading = el("div", "hem-section-heading");
    modesHeading.innerHTML = `<div><p class="hem-kicker">ADAPTIVE PRACTICE</p><h2>Random simulation or broad revision.</h2></div><p>The first follows the observed paper format. The second deliberately does not.</p>`;
    shell.appendChild(modesHeading);
    const modes = el("div", "hem-exam-mode-grid exam-v2-mode-grid");
    modes.append(
      modeCard("RANDOM EXAM-STYLE / 90 MIN", "A fresh official-format paper", "Six MCQs are drawn across distinct topics, followed by two binary traps and one open policy case.", ["Partial credit", "Negative marking", "Rubric review"], "Generate random mock →", "random-official", true),
      modeCard("COMPREHENSIVE DRILL / UNTIMED", "Large revision set", "The previous long mock is preserved under its correct name: a broad mastery drill using the ordinary session bank.", ["Sessions 1–7", "Simple mastery score", "4 open responses"], "Start comprehensive drill →", "comprehensive"),
    );
    shell.appendChild(modes);

    const bankHeading = el("div", "hem-section-heading");
    bankHeading.innerHTML = `<div><p class="hem-kicker">SEPARATE EXAM-STYLE BANK</p><h2>Practise the exact skill that is weak.</h2></div><p>The bank is intentionally separate from the standard revision questions.</p>`;
    shell.appendChild(bankHeading);
    const bankGrid = el("div", "exam-v2-bank-grid");
    bankGrid.append(
      modeCard("24 ITEMS", "MCQ Partial-Credit Lab", "Distinguish the most complete answer from options that are true but incomplete.", ["+5 full", "+2 partial", "−1 wrong"], "Practise 12 MCQs →", "bank-mcq"),
      modeCard("12 ITEMS", "Binary Trap Lab", "Train assumptions, absolute wording and reversed causal directions.", ["+8 correct", "−2 wrong", "0 blank"], "Practise all Binary →", "bank-binary"),
      modeCard("8 CASES", "Open-Question Workshop", "Write one policy answer and score it against a structured 60-point rubric.", ["Model outline", "Common misses", "Self-assessment"], "Open a case →", "bank-open"),
    );
    shell.appendChild(bankGrid);

    const strategy = el("section", "exam-v2-strategy");
    strategy.innerHTML = `<div class="hem-section-heading"><div><p class="hem-kicker">STUDENT HUB TIMING PLAN</p><h2>Use the 90 minutes deliberately.</h2></div><p>This allocation is a preparation recommendation, not an official instruction.</p></div><div class="exam-v2-timing"><div><strong>20 min</strong><span>Section A · MCQ</span></div><div><strong>10 min</strong><span>Section B · Binary</span></div><div><strong>55 min</strong><span>Section C · Open</span></div><div><strong>5 min</strong><span>Transfer and review</span></div></div><div class="hem-exam-disclaimer"><div><strong>Negative-marking discipline.</strong><br>Do not treat a partly correct statement as fully correct. Before choosing, ask which option contains the complete mechanism, assumptions and conclusion.</div></div>`;
    shell.appendChild(strategy);

    renderHistory(shell, state.history);
    host.appendChild(shell);
  }

  function renderHistory(shell, history) {
    const section = el("section", "hem-history");
    section.innerHTML = `<div class="hem-section-heading"><div><p class="hem-kicker">RECENT ATTEMPTS</p><h2>Compare like with like.</h2></div><p>Fixed mocks are the best repeated benchmark. Random papers vary in composition; comprehensive drills use a different scoring model.</p></div>`;
    if (!history.length) {
      section.appendChild(el("p", "hem-history-empty", "No completed attempts yet."));
    } else {
      const list = el("div", "hem-history-list");
      for (const item of history) {
        const row = el("div", "hem-history-row exam-v2-history-row");
        const total = item.objectiveRaw + (item.rubricRaw || 0);
        const max = item.objectiveMax + (item.rubricMax || 0);
        row.append(
          el("strong", null, item.title),
          el("span", null, new Date(item.completedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })),
          el("span", null, item.rubricMax ? `${total}/${max} self-assessed` : `${item.objectiveRaw}/${item.objectiveMax} objective`),
          el("span", null, timeText(item.usedMs)),
        );
        list.appendChild(row);
      }
      section.appendChild(list);
    }
    shell.appendChild(section);
  }

  function renderAnswerSheet(active, items) {
    if (!active.examStyle || !items.some(({ ref }) => ref.section === "A")) return null;
    const sheet = el("section", "exam-v2-answer-sheet");
    sheet.innerHTML = `<div><p class="hem-kicker">OBJECTIVE ANSWER SHEET</p><p>Your digital selections are transferred here automatically. Review A1–A6 and B1–B2 before submitting.</p></div>`;
    const table = el("div", "exam-v2-answer-grid");
    table.id = "exam-v2-answer-grid";
    for (const { ref, question } of items.filter(({ ref }) => ref.section === "A" || ref.section === "B")) {
      const cell = el("button", "exam-v2-answer-cell");
      cell.type = "button";
      cell.dataset.refId = ref.id;
      cell.innerHTML = `<span>${ref.label}</span><strong>${active.answers?.[question.id] || "—"}</strong>`;
      cell.addEventListener("click", () => setCurrent(items.findIndex((item) => item.ref.id === ref.id)));
      table.appendChild(cell);
    }
    sheet.appendChild(table);
    return sheet;
  }

  function renderActive(active) {
    if (timerId) clearInterval(timerId);
    timerId = null;
    if (!active) return renderDashboard(readState());
    if (active.deadline && active.deadline <= Date.now() && !active.submitted) return finishExam(true);

    host.innerHTML = "";
    const shell = el("div", "hem-active-exam exam-v2-active");
    renderIdentity(shell);
    const items = currentItems(active);
    if (!items.length) return resetActive();
    active.current = clamp(active.current || 0, 0, items.length - 1);
    const current = items[active.current];
    const answered = items.filter(({ question }) => answerPresent(question, active.answers?.[question.id])).length;

    const toolbar = el("div", "hem-exam-toolbar exam-v2-toolbar");
    const title = el("div", "hem-exam-toolbar-title");
    title.innerHTML = `<p class="hem-kicker">${active.examStyle ? "EXAM-STYLE ATTEMPT" : "COMPREHENSIVE DRILL"}</p><h1>${active.title}</h1><span>${answered}/${items.length} answered · ${active.examStyle ? "answers and scores hidden until submission" : "ordinary mastery scoring"}</span>`;
    const clock = el("div", "hem-exam-clock");
    clock.id = "hem-exam-clock";
    clock.textContent = active.deadline ? timeText(active.deadline - Date.now()) : "Untimed";
    const submit = el("button", "hem-button hem-danger-button", "Submit");
    submit.type = "button";
    submit.addEventListener("click", () => {
      const missing = items.filter(({ question }) => !answerPresent(question, readState().active?.answers?.[question.id])).length;
      if (root.confirm(missing ? `Submit with ${missing} unanswered item${missing === 1 ? "" : "s"}?` : "Submit this attempt?")) finishExam(false);
    });
    toolbar.append(title, clock, submit);
    shell.appendChild(toolbar);

    const progress = el("div", "hem-exam-progress");
    progress.innerHTML = `<span style="width:${Math.round(((active.current + 1) / items.length) * 100)}%"></span>`;
    shell.appendChild(progress);
    const answerSheet = renderAnswerSheet(active, items);
    if (answerSheet) shell.appendChild(answerSheet);

    const layout = el("div", "hem-exam-layout");
    const nav = el("aside", "hem-exam-nav");
    nav.innerHTML = `<p class="hem-kicker">QUESTION MAP</p>`;
    const navGrid = el("div", "hem-exam-nav-grid");
    navGrid.id = "hem-exam-nav-grid";
    nav.appendChild(navGrid);
    nav.appendChild(el("p", "hem-exam-nav-legend", "Filled = answered · dark = current"));

    const main = el("div", "hem-exam-question-wrap");
    main.appendChild(renderQuestionCard(active, current, items));
    const summary = el("div", "hem-exam-submit-card");
    summary.innerHTML = `<strong>${answered}/${items.length} answered</strong><p>${active.examStyle ? "Check the objective answer sheet and reserve time for the open response." : "Use the map to revisit unanswered items."}</p>`;
    const finish = el("button", "hem-button hem-danger-button", "Finish and submit");
    finish.type = "button";
    finish.addEventListener("click", () => submit.click());
    summary.appendChild(finish);
    main.appendChild(summary);
    layout.append(nav, main);
    shell.appendChild(layout);
    host.appendChild(shell);
    updateNavigation(active);

    if (active.deadline) {
      const tick = () => {
        const state = readState();
        if (!state.active || state.active.submitted) return clearInterval(timerId);
        const left = state.active.deadline - Date.now();
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
  }

  function renderQuestionCard(active, item, items) {
    const { ref, question } = item;
    const card = el("article", "hem-exam-question-card study-question exam-v2-question-card");
    const session = sessionForTopic(question.topic || question.relatedTopics?.[0]);
    const header = el("div", "study-question-header");
    header.append(el("span", "study-question-number", ref.label), el("div", "hem-question-meta study-question-meta"));
    const meta = header.lastChild;
    meta.append(
      el("span", null, `Question ${active.current + 1} of ${items.length}`),
      el("span", isOpen(question) ? "is-open" : "", question.type === "exam-mcq" ? "Multiple choice" : question.type === "exam-binary" ? "Binary choice" : isOpen(question) ? "Open question" : question.type === "true-false" ? "True / False" : "Multiple choice"),
      el("span", null, session ? `Session ${session.number}` : "Integrated case"),
    );
    card.appendChild(header);

    if (question.type === "exam-open") {
      card.appendChild(el("h2", "hem-exam-question", question.title));
      card.appendChild(el("p", "exam-v2-scenario", question.scenario));
      const tasks = el("ol", "exam-v2-task-list");
      question.tasks.forEach((task) => tasks.appendChild(el("li", null, task)));
      card.appendChild(tasks);
    } else {
      card.appendChild(el("h2", "hem-exam-question", question.prompt || question.question));
    }

    const value = active.answers?.[question.id];
    if (question.options) {
      const group = el("div", "hem-exam-options");
      question.options.forEach((option, index) => {
        const id = option.id || String.fromCharCode(65 + index);
        const text = typeof option === "string" ? option : option.text;
        const label = el("label", "hem-exam-option");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "exam-answer";
        input.value = id;
        input.checked = value === id;
        input.addEventListener("change", () => persistAnswer(question, id));
        label.append(input, el("span", "study-option-letter", id), el("span", "study-option-text", text));
        group.appendChild(label);
      });
      card.appendChild(group);
    } else if (question.type === "true-false") {
      const group = el("div", "hem-exam-options");
      [["true", "True"], ["false", "False"]].forEach(([id, text]) => {
        const label = el("label", "hem-exam-option");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "exam-answer";
        input.value = id;
        input.checked = value === id;
        input.addEventListener("change", () => persistAnswer(question, id));
        label.append(input, el("span", "study-option-letter", text[0]), el("span", "study-option-text", text));
        group.appendChild(label);
      });
      card.appendChild(group);
    } else {
      const textarea = el("textarea", "hem-exam-textarea");
      textarea.value = typeof value === "string" ? value : "";
      textarea.placeholder = question.type === "exam-open" ? "Write a structured policy answer. Define mechanisms, apply them to the case, discuss trade-offs and conclude." : "Write your answer as you would in a closed-book exam.";
      textarea.addEventListener("input", () => persistAnswer(question, textarea.value));
      card.appendChild(textarea);
      if (question.type === "exam-open") card.appendChild(el("p", "hem-caption", `Suggested time: ${question.recommendedMinutes} minutes · rubric revealed after submission.`));
    }

    const actions = el("div", "hem-exam-question-actions");
    const previous = el("button", "hem-button hem-secondary", "← Previous");
    previous.type = "button";
    previous.disabled = active.current === 0;
    previous.addEventListener("click", () => setCurrent(active.current - 1));
    const saved = el("span", "hem-exam-save", "Saved locally");
    const next = el("button", "hem-button", active.current === items.length - 1 ? "Review map" : "Next →");
    next.type = "button";
    next.addEventListener("click", () => active.current === items.length - 1 ? document.getElementById("hem-exam-nav")?.scrollIntoView({ behavior: "smooth" }) : setCurrent(active.current + 1));
    actions.append(previous, saved, next);
    card.appendChild(actions);
    return card;
  }

  function updateNavigation(active) {
    const grid = document.getElementById("hem-exam-nav-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const items = currentItems(active);
    items.forEach(({ ref, question }, index) => {
      const button = el("button", "", ref.label);
      button.type = "button";
      if (answerPresent(question, active.answers?.[question.id])) button.classList.add("is-answered");
      if (index === active.current) button.classList.add("is-current");
      button.addEventListener("click", () => setCurrent(index));
      grid.appendChild(button);
    });
  }

  function updateAnswerSheet(active) {
    const grid = document.getElementById("exam-v2-answer-grid");
    if (!grid) return;
    const items = currentItems(active);
    grid.querySelectorAll("[data-ref-id]").forEach((cell) => {
      const item = items.find(({ ref }) => ref.id === cell.dataset.refId);
      if (item) cell.querySelector("strong").textContent = active.answers?.[item.question.id] || "—";
    });
  }

  function correctStyleOption(question) {
    return question.options.find((option) => option.score === question.maxScore) || null;
  }

  function renderResult(state) {
    if (timerId) clearInterval(timerId);
    timerId = null;
    const active = state.active;
    const items = currentItems(active);
    const objective = objectiveStats(active);
    const rubric = rubricScore(active);
    const rawTotal = objective.raw + rubric.score;
    const rawMax = objective.max + rubric.max;

    host.innerHTML = "";
    const shell = el("div", "hem-exam-shell exam-v2-results");
    renderIdentity(shell);
    const hero = el("section", "hem-exam-result-hero");
    const copy = el("div");
    copy.innerHTML = `<p class="hem-kicker">${active.timedOut ? "TIME EXPIRED" : "ATTEMPT COMPLETE"}</p><h1>${active.title}</h1><p class="hem-caption">${active.examStyle ? "Objective scoring includes partial credit and negative marking. The open score is your Student Hub rubric self-assessment, not an official grade." : "This comprehensive drill uses ordinary correct/incorrect mastery scoring."}</p>`;
    const ring = el("div", "hem-objective-score");
    ring.innerHTML = `<div><strong>${objective.raw}/${objective.max}</strong><span>objective raw</span></div>`;
    hero.append(copy, ring);
    shell.appendChild(hero);

    const metrics = el("div", "hem-result-grid");
    const metricRows = [
      ["Fully correct objective", `${objective.fullyCorrect}/${objective.total}`],
      ["Time used", timeText(usedTime(active))],
      ["Answered", `${items.filter(({ question }) => answerPresent(question, active.answers?.[question.id])).length}/${items.length}`],
    ];
    if (rubric.max) metricRows.push(["Current self-assessed raw", `${rawTotal}/${rawMax}`]);
    metricRows.forEach(([label, value]) => {
      const node = el("div", "hem-result-metric");
      node.append(el("span", null, label), el("strong", null, value));
      metrics.appendChild(node);
    });
    shell.appendChild(metrics);

    const objectiveItems = items.filter(({ question }) => !isOpen(question));
    if (objectiveItems.length) {
      const section = el("section", "hem-review-section");
      section.innerHTML = `<div class="hem-section-heading"><div><p class="hem-kicker">OBJECTIVE REVIEW</p><h2>Review the completeness of your reasoning.</h2></div><p>Partly correct answers receive credit because they contain a true fragment but miss the full mechanism or conclusion.</p></div>`;
      const list = el("div", "hem-review-list");
      objectiveItems.forEach(({ ref, question }) => {
        const answer = active.answers?.[question.id];
        const score = scoreQuestion(question, answer);
        const max = maxQuestionScore(question);
        const selected = isStyleQuestion(question) ? styleOption(question, answer) : null;
        const card = el("article", `hem-review-card ${score === max ? "is-right" : "is-wrong"}`);
        card.innerHTML = `<p class="hem-kicker">${ref.label} · ${question.category || question.type}</p><h3>${question.prompt || question.question}</h3>`;
        if (isStyleQuestion(question)) {
          const correct = correctStyleOption(question);
          card.appendChild(el("p", "hem-review-answer", `Selected: ${answer || "blank"} · score ${score}/${max}`));
          if (selected) card.appendChild(el("p", "hem-review-answer", selected.feedback));
          const best = el("p", "hem-review-answer");
          best.innerHTML = `<strong>Fully correct:</strong> ${correct?.id || "—"}. ${correct?.text || ""}`;
          card.appendChild(best);
        } else {
          card.appendChild(el("p", "hem-review-answer", `Your answer: ${answer || "blank"}`));
          card.appendChild(el("p", "hem-review-answer", `Correct answer: ${question.type === "true-false" ? (question.answer ? "True" : "False") : question.answer}`));
          if (question.explanation) card.appendChild(el("p", "hem-review-answer", question.explanation));
        }
        const session = sessionForTopic(question.topic);
        if (session?.topic) card.appendChild(link("Review this session →", `lecture.html?topic=${encodeURIComponent(session.topic)}#learn`));
        list.appendChild(card);
      });
      section.appendChild(list);
      shell.appendChild(section);
    }

    items.filter(({ question }) => isOpen(question)).forEach(({ ref, question }) => {
      if (question.type === "exam-open") shell.appendChild(renderOpenRubric(state, ref, question));
      else shell.appendChild(renderNormalOpenReview(state, ref, question));
    });

    const actions = el("div", "hem-result-actions");
    const newAttempt = el("button", "hem-button", "Choose another mode");
    newAttempt.type = "button";
    newAttempt.addEventListener("click", resetActive);
    actions.append(newAttempt, link("Course hub", `course.html?course=${COURSE_ID}`, "hem-button hem-secondary"));
    shell.appendChild(actions);
    host.appendChild(shell);
  }

  function renderOpenRubric(state, ref, question) {
    const active = state.active;
    const section = el("section", "hem-review-section exam-v2-open-review");
    section.innerHTML = `<div class="hem-section-heading"><div><p class="hem-kicker">${ref.label} · OPEN QUESTION / 60</p><h2>${question.title}</h2></div><p>Move each slider only after comparing your answer with the model outline. This is a formative Student Hub rubric.</p></div>`;
    const response = el("article", "exam-v2-open-response");
    response.innerHTML = `<p class="hem-kicker">YOUR RESPONSE</p><div>${(active.answers?.[question.id] || "No answer written.").replace(/\n/g, "<br>")}</div>`;
    section.appendChild(response);

    const outline = el("details", "exam-v2-outline");
    outline.innerHTML = `<summary>Model answer outline</summary><ol>${question.modelOutline.map((item) => `<li>${item}</li>`).join("")}</ol><p><strong>Common missing points:</strong> ${question.commonMisses.join(" · ")}</p>`;
    section.appendChild(outline);

    const rubricGrid = el("div", "exam-v2-rubric-grid");
    question.rubric.forEach((criterion) => {
      const current = Number(active.rubricScores?.[question.id]?.[criterion.id] || 0);
      const card = el("article", "exam-v2-rubric-card");
      card.innerHTML = `<div><strong>${criterion.title}</strong><span><b data-rubric-value>${current}</b>/${criterion.max}</span></div><p>${criterion.guidance}</p>`;
      const input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = String(criterion.max);
      input.step = "1";
      input.value = String(current);
      input.addEventListener("input", () => {
        const fresh = readState();
        fresh.active.rubricScores[question.id] = fresh.active.rubricScores[question.id] || {};
        fresh.active.rubricScores[question.id][criterion.id] = Number(input.value);
        syncHistory(fresh);
        writeState(fresh);
        card.querySelector("[data-rubric-value]").textContent = input.value;
        updateRubricTotal(section, fresh.active, question);
      });
      card.appendChild(input);
      rubricGrid.appendChild(card);
    });
    section.appendChild(rubricGrid);
    const total = el("div", "exam-v2-rubric-total");
    total.dataset.rubricTotal = question.id;
    section.appendChild(total);
    updateRubricTotal(section, active, question);
    return section;
  }

  function updateRubricTotal(section, active, question) {
    const score = question.rubric.reduce((sum, criterion) => sum + Number(active.rubricScores?.[question.id]?.[criterion.id] || 0), 0);
    const target = section.querySelector(`[data-rubric-total="${question.id}"]`);
    if (target) target.innerHTML = `<strong>Open-question self-score: ${score}/60</strong><span>Keep this separate from any official grade conversion.</span>`;
    const state = readState();
    if (state.active?.id === active.id) {
      syncHistory(state);
      writeState(state);
    }
  }

  function renderNormalOpenReview(state, ref, question) {
    const section = el("section", "hem-review-section");
    section.innerHTML = `<div class="hem-section-heading"><div><p class="hem-kicker">${ref.label} · OPEN PRACTICE</p><h2>${question.question}</h2></div></div>`;
    const card = el("article", "hem-review-card");
    card.innerHTML = `<div class="hem-open-model"><strong>Your answer</strong><br>${(state.active.answers?.[question.id] || "No answer written.").replace(/\n/g, "<br>")}</div><div class="hem-open-model"><strong>Model answer</strong><br>${question.answer}</div>${question.explanation ? `<p class="hem-review-answer"><strong>What to look for:</strong> ${question.explanation}</p>` : ""}`;
    section.appendChild(card);
    return section;
  }

  function render() {
    const state = readState();
    if (state.active?.submitted) return renderResult(state);
    if (state.active?.deadline && state.active.deadline <= Date.now()) return finishExam(true);
    renderDashboard(state);
  }

  async function init() {
    try {
      const data = await loadAll();
      course = data.courses.find((item) => item.id === COURSE_ID);
      module = course?.modules.find((item) => item.id === MODULE_ID);
      learningPath = await readJson(fetchText, PATH_FILE, null);
      bank = root.FHEMExamStyleBank;
      if (!course || !module || !learningPath || !bank) throw new Error("Exam Centre data is incomplete.");
      styleMap = new Map([...bank.mcqs, ...bank.binaries, ...bank.opens].map((question) => [question.id, question]));
      normalMap = new Map(module.questions.filter((question) => !question.sample).map((question) => [question.id, question]));
      document.title = "FHEM Exam Centre – EU-HEM Student Hub";
      render();
    } catch (error) {
      console.error("FHEM Exam Centre v2:", error);
      host.innerHTML = `<section class="card"><h2>The exam centre could not be loaded.</h2><p>Please reload or return to the course hub.</p><a href="course.html?course=${COURSE_ID}">← Course hub</a></section>`;
    }
  }

  init();
})(window);
