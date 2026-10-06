// ===== Academic Rules page =====
// Fills academic-rules.html from content/academic-rules.json. University names come from
// content/tracks.json (tracks-data.js), source labels and official links from content/sources.json.
// The re-sit guide's logic is resitOutcome() below: pure, so it is tested in Node.

const RULES_URL = "content/academic-rules.json";
const UNIVERSITY_ORDER = ["unibo", "uio", "mci", "eur"];
const UNIVERSITY_TOPICS = [
  ["exams", "Exams"],
  ["resits", "Re-sits"],
  ["improve", "Improving a passed grade"],
  ["awayResit", "Re-sits away from this university"],
  ["complaints", "Questions and complaints about grades"],
];

// ----- Pure helpers (tested) -----

// The questions to show for the answers so far (a question with "showIf" appears only when it matches)
function visibleQuestions(guide, answers) {
  return guide.questions.filter((q) => !q.showIf || Object.entries(q.showIf).every(([id, value]) => answers[id] === value));
}

// The outcome key for complete answers, or null while a visible question is still open
function resitOutcomeKey(guide, answers) {
  if (visibleQuestions(guide, answers).some((q) => !answers[q.id])) return null;
  return answers.attempt === "failed" ? `failed-${answers.location}` : answers.attempt;
}

// { key, title, items, universityItems } for the answers, or null if not complete.
// items: the shared rules; universityItems: what the course's university adds (its own rules)
function resitOutcome(rules, answers) {
  const key = resitOutcomeKey(rules.resitGuide, answers);
  const outcome = key && rules.resitGuide.outcomes[key];
  if (!outcome) return null;
  const university = rules.universities[answers.university] || {};
  const universityItems = [
    ...(university[outcome.addUniversity] || []),
    ...(outcome.addUniversityExtra ? university[outcome.addUniversityExtra] || [] : []),
  ];
  return { key, title: outcome.title, items: outcome.items, universityItems };
}

// ----- Drawing -----

const rulesPage = { rules: null, sources: {}, names: {}, answers: {} };

function universityName(id) {
  return (rulesPage.names[id] && rulesPage.names[id].name) || id;
}

// One rule: its text, then its source label
function ruleItem(item) {
  const li = createElement("li", "rules-item", `${item.text} `);
  li.appendChild(sourceLabel(item.source, rulesPage.sources));
  return li;
}

function ruleList(items, className = "rules-list") {
  const list = createElement("ul", className);
  for (const item of items) list.appendChild(ruleItem(item));
  return list;
}

// "Official rules: UiO: grading … ↗" links, from the sources' own links
function officialLinks(sourceIds, label = "Official rules") {
  const links = sourceIds.map((id) => rulesPage.sources[id]).filter((source) => source && source.link);
  if (!links.length) return null;
  const box = createElement("p", "rules-links");
  box.appendChild(createElement("span", "rules-links-label", `${label}: `));
  links.forEach((source, i) => {
    const a = createElement("a", null, source.link.label);
    a.href = source.link.url;
    a.target = "_blank";
    a.rel = "noopener";
    box.appendChild(a);
    if (i < links.length - 1) box.appendChild(document.createTextNode(" · "));
  });
  return box;
}

function showSection(id) {
  const section = document.getElementById(id);
  section.hidden = false;
  return section;
}

function renderJoint() {
  showSection("joint").querySelector(".rules-list").replaceWith(ruleList(rulesPage.rules.joint));
}

function renderUniversities() {
  const box = showSection("universities").querySelector(".rules-unis");
  for (const id of UNIVERSITY_ORDER) {
    const university = rulesPage.rules.universities[id];
    const card = createElement("article", "card rules-uni");
    card.id = `uni-${id}`;
    card.style.setProperty("--city-accent", `var(--city-${(rulesPage.names[id]?.city || "").toLowerCase()})`);
    const head = createElement("h3", null, universityName(id));
    if (rulesPage.names[id]) head.appendChild(createElement("span", "rules-uni-city", rulesPage.names[id].city));
    card.appendChild(head);
    for (const [topic, label] of UNIVERSITY_TOPICS) {
      if (!university[topic] || !university[topic].length) continue;
      card.appendChild(createElement("h4", null, label));
      card.appendChild(ruleList(university[topic]));
    }
    const links = officialLinks(university.links);
    if (links) card.appendChild(links);
    box.appendChild(card);
  }
}

function renderGrading() {
  const { grading } = rulesPage.rules;
  const section = showSection("grading");
  section.querySelector(".rules-note").textContent = grading.note;
  const table = section.querySelector(".rules-grades");
  const columns = ["University", "Scale", "Pass mark", "Best grade", "Good to know"];
  const head = table.createTHead().insertRow();
  for (const column of columns) {
    const th = createElement("th", null, column);
    th.scope = "col";
    head.appendChild(th);
  }
  const body = table.createTBody();
  for (const scale of grading.scales) {
    const row = body.insertRow();
    const th = createElement("th", null, universityName(scale.university));
    th.scope = "row";
    row.appendChild(th);
    for (const [label, value] of [["Scale", scale.scale], ["Pass mark", scale.pass], ["Best grade", scale.best]]) {
      const cell = row.insertCell();
      cell.dataset.label = label;
      cell.textContent = value;
    }
    const extra = row.insertCell();
    extra.dataset.label = "Good to know";
    extra.append(`${scale.extra} `, sourceLabel(scale.source, rulesPage.sources));
  }
}

// ----- Re-sit guide: real radio buttons (keyboard and screen readers work as usual) -----

function questionOptions(question) {
  if (question.options !== "universities") return question.options;
  return UNIVERSITY_ORDER.map((id) => ({ value: id, label: universityName(id) }));
}

function renderGuideQuestions() {
  const guide = rulesPage.rules.resitGuide;
  const box = document.querySelector("#resit-guide .resit-questions");
  box.replaceChildren();
  visibleQuestions(guide, rulesPage.answers).forEach((question, index) => {
    const fieldset = createElement("fieldset", "resit-question");
    fieldset.appendChild(createElement("legend", null, `${index + 1}. ${question.text}`));
    const options = createElement("div", "resit-options");
    for (const option of questionOptions(question)) {
      const label = createElement("label", "resit-option");
      const input = createElement("input");
      input.type = "radio";
      input.name = `resit-${question.id}`;
      input.value = option.value;
      input.checked = rulesPage.answers[question.id] === option.value;
      input.addEventListener("change", () => answerQuestion(question.id, option.value));
      label.append(input, createElement("span", null, option.label));
      options.appendChild(label);
    }
    fieldset.appendChild(options);
    box.appendChild(fieldset);
  });
}

function answerQuestion(questionId, value) {
  rulesPage.answers[questionId] = value;
  // Drop answers to questions that are no longer shown (e.g. "where" after changing "what happened")
  const visible = visibleQuestions(rulesPage.rules.resitGuide, rulesPage.answers).map((q) => q.id);
  for (const id of Object.keys(rulesPage.answers)) if (!visible.includes(id)) delete rulesPage.answers[id];
  renderGuideQuestions();
  // Keep keyboard focus on the radio that was just chosen (the questions were redrawn)
  const chosen = document.querySelector(`input[name="resit-${questionId}"][value="${value}"]`);
  if (chosen) chosen.focus();
  renderGuideOutcome();
}

function renderGuideOutcome() {
  const box = document.querySelector("#resit-guide .resit-outcome");
  box.replaceChildren();
  const outcome = resitOutcome(rulesPage.rules, rulesPage.answers);
  if (!outcome) return;
  const card = createElement("div", `resit-result is-${outcome.key}`);
  card.appendChild(createElement("h3", null, outcome.title));
  card.appendChild(ruleList(outcome.items));
  if (outcome.universityItems.length) {
    card.appendChild(createElement("h4", null, `At ${universityName(rulesPage.answers.university)}`));
    card.appendChild(ruleList(outcome.universityItems));
  }
  const links = officialLinks(rulesPage.rules.universities[rulesPage.answers.university].links);
  if (links) card.appendChild(links);
  const reset = createElement("button", "button button-secondary resit-reset", "Start again");
  reset.type = "button";
  reset.addEventListener("click", () => {
    rulesPage.answers = {};
    renderGuideQuestions();
    renderGuideOutcome();
    document.querySelector("#resit-guide input").focus();
  });
  card.appendChild(reset);
  box.appendChild(card);
}

function renderGuide() {
  const section = showSection("resit-guide");
  section.querySelector(".rules-guide-intro").textContent = rulesPage.rules.resitGuide.intro;
  renderGuideQuestions();
}

function renderIntegrity() {
  const { integrity } = rulesPage.rules;
  const section = showSection("integrity");
  section.querySelector(".rules-integrity-joint").replaceWith(ruleList(integrity.joint));
  const box = section.querySelector(".rules-integrity-unis");
  for (const id of UNIVERSITY_ORDER) {
    const card = createElement("div", "rules-integrity-uni");
    card.appendChild(createElement("h3", null, universityName(id)));
    card.appendChild(ruleList(integrity.universities[id] || []));
    box.appendChild(card);
  }
  const links = officialLinks(integrity.links, "Read the official rules");
  if (links) section.appendChild(links);
}

function renderMore() {
  const box = showSection("more").querySelector(".rules-more");
  for (const topic of rulesPage.rules.more) {
    const block = createElement("div", "rules-more-topic");
    block.id = topic.id;
    block.appendChild(createElement("h3", null, topic.title));
    block.appendChild(ruleList(topic.items));
    box.appendChild(block);
  }
}

async function initRulesPage() {
  const status = document.getElementById("rules-status");
  try {
    const [rulesResponse, sources, tracksFile] = await Promise.all([
      fetch(RULES_URL, { cache: "no-cache" }),
      loadSources(),
      loadTracksFile().catch(() => null),
    ]);
    if (!rulesResponse.ok) throw new Error(`HTTP ${rulesResponse.status}`);
    rulesPage.rules = await rulesResponse.json();
    rulesPage.sources = sources;
    rulesPage.names = tracksFile ? tracksCohort(tracksFile).universities : {};
    document.getElementById("rules-intro").textContent = rulesPage.rules.intro;
    renderJoint();
    renderGuide();
    renderUniversities();
    renderGrading();
    renderIntegrity();
    renderMore();
    status.remove();
    // A link to a section (#grading) works once the section exists
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  } catch (error) {
    console.error("Academic rules:", error);
    status.textContent = "Sorry, the rules could not be loaded right now. Please try again later.";
  }
}

if (typeof document !== "undefined" && document.getElementById("rules-status")) initRulesPage();

if (typeof module !== "undefined") module.exports = { visibleQuestions, resitOutcomeKey, resitOutcome, UNIVERSITY_ORDER };
