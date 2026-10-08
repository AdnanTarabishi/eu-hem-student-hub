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
  const li = createElement("li", "rules-item");
  li.append(createElement("span", "rules-item__text", item.text), " ", sourceLabel(item.source, rulesPage.sources));
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
  links.forEach((source) => {
    const a = createElement("a", null, source.link.label);
    a.href = source.link.url;
    a.target = "_blank";
    a.rel = "noopener";
    box.appendChild(a);
  });
  return box;
}

function showSection(id) {
  const section = document.getElementById(id);
  section.hidden = false;
  return section;
}

function renderJoint() {
  const list = ruleList(rulesPage.rules.joint, "rules-list rules-principles");
  Array.from(list.children).forEach((item, index) => {
    const number = createElement("span", "rules-principle__number", String(index + 1).padStart(2, "0"));
    number.setAttribute("aria-hidden", "true");
    const body = createElement("div", "rules-principle__body");
    body.append(...item.childNodes);
    item.append(number, body);
  });
  showSection("joint").querySelector(".rules-list").replaceWith(list);
}

function renderUniversities() {
  const section = showSection("universities");
  const box = section.querySelector(".rules-unis");
  const jumps = section.querySelector(".rules-university-jumps");
  box.replaceChildren();
  jumps.replaceChildren();
  for (const id of UNIVERSITY_ORDER) {
    const university = rulesPage.rules.universities[id];
    const city = rulesPage.names[id]?.city;
    const jump = createElement("a", "rules-university-jump", city || universityName(id));
    jump.href = `#uni-${id}`;
    jumps.appendChild(jump);
    // Native details keep every rule in the document, with keyboard disclosure built in.
    const card = createElement("details", "rules-uni");
    card.id = `uni-${id}`;
    card.open = id === UNIVERSITY_ORDER[0];
    if (city) card.style.setProperty("--city-accent", `var(--city-${city.toLowerCase()})`);
    const summary = createElement("summary", "rules-uni-summary");
    const head = createElement("h3");
    head.appendChild(createElement("span", "rules-uni-name", universityName(id)));
    if (city) head.appendChild(createElement("span", "rules-uni-city", city));
    const toggleLabel = createElement("span", "rules-uni-toggle");
    toggleLabel.setAttribute("aria-hidden", "true");
    toggleLabel.append(createElement("span", "rules-uni-toggle__closed", "View rules"), createElement("span", "rules-uni-toggle__open", "Hide rules"));
    head.appendChild(toggleLabel);
    summary.appendChild(head);
    card.appendChild(summary);
    const body = createElement("div", "rules-uni-body");
    const topics = createElement("div", "rules-uni-topics");
    for (const [topic, label] of UNIVERSITY_TOPICS) {
      if (!university[topic] || !university[topic].length) continue;
      const block = createElement("section", "rules-uni-topic");
      const heading = createElement("h4", null, label);
      heading.id = `uni-${id}-${topic}`;
      block.setAttribute("aria-labelledby", heading.id);
      block.append(heading, ruleList(university[topic]));
      topics.appendChild(block);
    }
    body.appendChild(topics);
    const links = officialLinks(university.links);
    if (links) body.appendChild(links);
    card.appendChild(body);
    card.addEventListener("toggle", updateUniversityControl);
    box.appendChild(card);
  }
  section.querySelector(".rules-expand-all").addEventListener("click", () => {
    const cards = Array.from(box.querySelectorAll(".rules-uni"));
    const expand = cards.some((card) => !card.open);
    cards.forEach((card) => { card.open = expand; });
    updateUniversityControl();
  });
  updateUniversityControl();
}

function updateUniversityControl() {
  const cards = Array.from(document.querySelectorAll(".rules-uni"));
  const button = document.querySelector(".rules-expand-all");
  const allOpen = cards.length > 0 && cards.every((card) => card.open);
  button.textContent = allOpen ? "Collapse all universities" : "Expand all universities";
  button.setAttribute("aria-expanded", String(allOpen));
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
    row.dataset.university = scale.university;
    const th = createElement("th", null, universityName(scale.university));
    th.scope = "row";
    row.appendChild(th);
    for (const [label, value] of [["Scale", scale.scale], ["Pass mark", scale.pass], ["Best grade", scale.best]]) {
      const cell = row.insertCell();
      cell.dataset.label = label;
      cell.textContent = value;
      if (label === "Pass mark") cell.className = "rules-grade-pass";
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
  const questions = visibleQuestions(guide, rulesPage.answers);
  const answered = questions.filter((question) => rulesPage.answers[question.id]).length;
  document.querySelector(".resit-progress-label").textContent = `${answered} of ${questions.length} answered`;
  const progress = document.querySelector(".resit-progress progress");
  progress.max = questions.length;
  progress.value = answered;
  questions.forEach((question, index) => {
    const fieldset = createElement("fieldset", "resit-question");
    fieldset.dataset.question = question.id;
    if (rulesPage.answers[question.id]) fieldset.classList.add("is-answered");
    fieldset.appendChild(createElement("legend", null, `${index + 1}. ${question.text}`));
    const options = createElement("div", "choice-options");
    for (const option of questionOptions(question)) {
      const label = createElement("label", "choice-option");
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
  if (!outcome) {
    const empty = createElement("p", "resit-empty", "Your guidance will appear here once you have answered the questions above.");
    box.appendChild(empty);
    return;
  }
  const card = createElement("div", `resit-result is-${outcome.key}`);
  card.appendChild(createElement("p", "academic-eyebrow", "Your re-sit guidance"));
  card.appendChild(createElement("h3", null, outcome.title));
  card.appendChild(ruleList(outcome.items));
  if (outcome.universityItems.length) {
    card.appendChild(createElement("h4", null, `At ${universityName(rulesPage.answers.university)}`));
    card.appendChild(ruleList(outcome.universityItems));
  }
  const links = officialLinks(rulesPage.rules.universities[rulesPage.answers.university].links);
  if (links) card.appendChild(links);
  const reset = createElement("button", "button button-secondary resit-reset academic-print-hide", "Start again");
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
  renderGuideOutcome();
}

function renderIntegrity() {
  const { integrity } = rulesPage.rules;
  const section = showSection("integrity");
  section.querySelector(".rules-integrity-joint").replaceWith(ruleList(integrity.joint, "rules-list rules-integrity-joint"));
  const box = section.querySelector(".rules-integrity-unis");
  for (const id of UNIVERSITY_ORDER) {
    const card = createElement("div", "rules-integrity-uni");
    if (rulesPage.names[id]?.city) card.appendChild(createElement("p", "rules-card-eyebrow", rulesPage.names[id].city));
    card.appendChild(createElement("h3", null, universityName(id)));
    card.appendChild(ruleList(integrity.universities[id] || []));
    box.appendChild(card);
  }
  const links = officialLinks(integrity.links, "Read the official rules");
  if (links) section.appendChild(links);
}

function renderMore() {
  const box = showSection("more").querySelector(".rules-more");
  const icons = { internship: "briefcase", "research-assignment": "search", "extra-courses": "notes", "special-provisions": "students" };
  for (const topic of rulesPage.rules.more) {
    const block = createElement("div", "rules-more-topic");
    block.id = topic.id;
    const header = createElement("div", "rules-more-topic__heading");
    if (icons[topic.id]) {
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", "icon");
      icon.setAttribute("aria-hidden", "true");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", `icons.svg#${icons[topic.id]}`);
      icon.appendChild(use);
      header.appendChild(icon);
    }
    header.appendChild(createElement("h3", null, topic.title));
    block.appendChild(header);
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
    // Shared navigation can now restore a deep link, including a closed university dossier.
    document.dispatchEvent(new CustomEvent("academic:ready"));
  } catch (error) {
    console.error("Academic rules:", error);
    status.textContent = "Sorry, the rules could not be loaded right now. Please try again later.";
    const retry = createElement("button", "button button-secondary", "Try again");
    retry.type = "button";
    retry.addEventListener("click", () => window.location.reload());
    status.append(" ", retry);
  }
}

if (typeof document !== "undefined" && document.getElementById("rules-status")) initRulesPage();

if (typeof module !== "undefined") module.exports = { visibleQuestions, resitOutcomeKey, resitOutcome, UNIVERSITY_ORDER };
