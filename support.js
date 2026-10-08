// ===== Support & Contacts page =====
// Fills support.html from content/people.json: roles and role mailboxes only, never staff names.
// University names come from content/tracks.json, official links from content/sources.json, and the
// emergency numbers from the City Guides' facts (guide-data.js), so they are written in one place only.
// The contact guide's logic is supportOutcome() below: pure, so it is tested in Node.

const PEOPLE_URL = "content/people.json";
const SUPPORT_UNIVERSITIES = ["unibo", "uio", "mci", "eur"];

// ----- Pure helpers (tested) -----

// A question is shown when every "showIf" answer matches (a list means "one of these")
function visibleSupportQuestions(guide, answers) {
  return guide.questions.filter((q) => !q.showIf || Object.entries(q.showIf).every(([id, allowed]) =>
    (Array.isArray(allowed) ? allowed : [allowed]).includes(answers[id])));
}

// { key, title, items, page, contacts, emergency } once every shown question has an answer, else null.
// contacts: [{ university, coordinator }] or [{ university, items }] (safety / wellbeing support)
function supportOutcome(people, answers) {
  const guide = people.contactGuide;
  if (!answers.topic || visibleSupportQuestions(guide, answers).some((q) => !answers[q.id])) return null;
  const outcome = guide.outcomes[answers.topic];
  if (!outcome) return null;
  const contacts = [];
  if (outcome.contact === "coordinator") contacts.push({ university: answers.university, coordinator: people.universities[answers.university].coordinator });
  if (outcome.contact === "eur") contacts.push({ university: "eur", coordinator: people.universities.eur.coordinator });
  if (outcome.contact === "safety" || outcome.contact === "wellbeing") {
    contacts.push({ university: answers.university, items: people.universities[answers.university][outcome.contact] });
  }
  return { key: answers.topic, title: outcome.title, items: outcome.items, page: outcome.page || null, contacts, emergency: Boolean(outcome.emergency) };
}

// Emergency numbers from a guide's facts: "112; 118 ambulance [S4]" -> "112; 118 ambulance"
function emergencyText(guideText) {
  const fact = parseGuide(guideText).facts["compare-emergency"] || "";
  return fact.replace(/\s*\[S\d+\]/g, "").trim();
}

// Every e-mail address written anywhere in a text or object (used by the tests and the checker)
function emailsIn(value) {
  return [...JSON.stringify(value).matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0].toLowerCase());
}

// ----- Drawing -----

const support = { people: null, sources: {}, names: {}, answers: {}, emergency: [] };

function universityLabel(id) {
  const info = support.names[id];
  return info ? `${info.name}, ${info.city}` : id;
}

function supportItem(item) {
  const li = createElement("li", "rules-item");
  li.append(createElement("span", "support-item__text", item.text), " ");
  if (item.email) {
    const mail = createElement("a", "support-mail", item.email);
    mail.href = `mailto:${item.email}`;
    li.append(mail, " ");
  }
  if (item.link) {
    const a = createElement("a", null, item.link.label);
    a.href = item.link.url;
    a.target = "_blank";
    a.rel = "noopener";
    li.append(a, " ");
  }
  const source = support.sources[item.source];
  if (source && source.kind === "official" && source.link && item.source !== "euhem-handbook-2026") {
    const a = createElement("a", "support-official", source.link.label);
    a.href = source.link.url;
    a.target = "_blank";
    a.rel = "noopener";
    li.append(a, " ");
  }
  li.appendChild(sourceLabel(item.source, support.sources));
  return li;
}

function supportList(items) {
  const list = createElement("ul", "rules-list");
  for (const item of items) list.appendChild(supportItem(item));
  return list;
}

// The coordinator line: role, mailbox (or the official page when there is no mailbox), source label
function coordinatorBlock(coordinator) {
  const box = createElement("p", "support-coordinator");
  box.appendChild(createElement("strong", "support-coordinator__role", `${coordinator.role}: `));
  const links = createElement("span", "support-coordinator__links");
  const source = support.sources[coordinator.source];
  if (coordinator.email) {
    const mail = createElement("a", "support-mail", coordinator.email);
    mail.href = `mailto:${coordinator.email}`;
    links.appendChild(mail);
  }
  // An official web page as the source: link it too (after the mailbox, or on its own)
  if (source && source.link && source.kind === "official" && coordinator.source !== "euhem-handbook-2026") {
    const a = createElement("a", coordinator.email ? "support-official" : null, source.link.label);
    a.href = source.link.url;
    a.target = "_blank";
    a.rel = "noopener";
    links.append(coordinator.email ? " · " : "", a);
  }
  box.append(links, " ", sourceLabel(coordinator.source, support.sources));
  return box;
}

function showSupportSection(id) {
  const section = document.getElementById(id);
  section.hidden = false;
  return section;
}

function renderEmergency() {
  const box = showSupportSection("emergency");
  const list = box.querySelector(".support-emergency-list");
  for (const entry of support.emergency) {
    const li = createElement("li");
    li.append(createElement("strong", "support-emergency__city", `${entry.city}: `), createElement("span", "support-emergency__number", entry.text), " ");
    const a = createElement("a", null, "City Guide");
    a.href = `city-guide.html?city=${entry.id}`;
    a.setAttribute("aria-label", `${entry.city} City Guide`);
    li.appendChild(a);
    list.appendChild(li);
  }
  if (support.emergency.length < CITY_GUIDES.filter((guide) => guide.file).length) {
    const note = createElement("p", "support-emergency__unavailable", "Some city information could not be loaded. ");
    const link = createElement("a", null, "Open the City Guides");
    link.href = "city-guide.html";
    note.appendChild(link);
    box.appendChild(note);
  }
}

// ----- Contact guide: real radio buttons, like the re-sit guide on the Academic Rules page -----

function supportQuestionOptions(question) {
  if (question.options !== "universities") return question.options;
  return SUPPORT_UNIVERSITIES.map((id) => ({ value: id, label: universityLabel(id) }));
}

function renderSupportQuestions() {
  const box = document.querySelector("#contact-guide .support-questions");
  box.replaceChildren();
  const questions = visibleSupportQuestions(support.people.contactGuide, support.answers);
  const answered = questions.filter((question) => support.answers[question.id]).length;
  document.querySelector(".support-progress-label").textContent = `${answered} of ${questions.length} answered`;
  const progress = document.querySelector(".support-progress progress");
  progress.max = questions.length;
  progress.value = answered;
  questions.forEach((question, index) => {
    const fieldset = createElement("fieldset", "resit-question");
    fieldset.dataset.question = question.id;
    fieldset.appendChild(createElement("legend", null, `${index + 1}. ${question.text}`));
    const options = createElement("div", "choice-options");
    for (const option of supportQuestionOptions(question)) {
      const label = createElement("label", "choice-option");
      const input = createElement("input");
      input.type = "radio";
      input.name = `support-${question.id}`;
      input.value = option.value;
      input.checked = support.answers[question.id] === option.value;
      input.addEventListener("change", () => answerSupport(question.id, option.value));
      label.append(input, createElement("span", null, option.label));
      options.appendChild(label);
    }
    fieldset.appendChild(options);
    box.appendChild(fieldset);
  });
}

function answerSupport(questionId, value) {
  support.answers[questionId] = value;
  const visible = visibleSupportQuestions(support.people.contactGuide, support.answers).map((q) => q.id);
  for (const id of Object.keys(support.answers)) if (!visible.includes(id)) delete support.answers[id];
  renderSupportQuestions();
  document.querySelector(`input[name="support-${questionId}"][value="${value}"]`)?.focus({ preventScroll: true });
  renderSupportOutcome();
}

function renderSupportOutcome() {
  const box = document.querySelector("#contact-guide .support-outcome");
  box.replaceChildren();
  const outcome = supportOutcome(support.people, support.answers);
  if (!outcome) {
    box.appendChild(createElement("p", "support-empty", "Your next step and relevant contacts will appear here once you have answered the questions above."));
    return;
  }
  const card = createElement("div", `resit-result support-result is-${outcome.key}`);
  card.appendChild(createElement("p", "academic-eyebrow", "Your next step"));
  card.appendChild(createElement("h3", null, outcome.title));
  card.appendChild(supportList(outcome.items));
  for (const contact of outcome.contacts) {
    card.appendChild(createElement("h4", null, universityLabel(contact.university)));
    if (contact.coordinator) card.appendChild(coordinatorBlock(contact.coordinator));
    if (contact.items) card.appendChild(supportList(contact.items));
  }
  if (outcome.page) {
    const link = createElement("a", "support-page-link", `${outcome.page.label} →`);
    link.href = outcome.page.href;
    card.appendChild(link);
  }
  if (outcome.emergency) {
    const note = createElement("p", "support-emergency-note", "If you or someone else is in danger right now, call the emergency number. ");
    const a = createElement("a", null, "Emergency numbers");
    a.href = "#emergency";
    note.appendChild(a);
    card.appendChild(note);
  }
  const reset = createElement("button", "button button-secondary resit-reset academic-print-hide", "Start again");
  reset.type = "button";
  reset.addEventListener("click", () => {
    support.answers = {};
    renderSupportQuestions();
    renderSupportOutcome();
    document.querySelector("#contact-guide input").focus();
  });
  card.appendChild(reset);
  box.appendChild(card);
}

function renderContactGuide() {
  const section = showSupportSection("contact-guide");
  section.querySelector(".support-guide-intro").textContent = support.people.contactGuide.intro;
  renderSupportQuestions();
  renderSupportOutcome();
}

function renderUniversities() {
  const section = showSupportSection("universities");
  section.querySelector(".support-privacy").textContent = support.people.privacyNote;
  const box = section.querySelector(".rules-unis");
  const jumps = section.querySelector(".support-university-jumps");
  for (const id of SUPPORT_UNIVERSITIES) {
    const university = support.people.universities[id];
    const name = support.names[id]?.name || id;
    const city = support.names[id]?.city || "";
    const jump = createElement("a", "support-university-jump", city || name);
    jump.href = `#contacts-${id}`;
    jumps.appendChild(jump);
    const card = createElement("details", "rules-uni");
    card.id = `contacts-${id}`;
    card.open = id === "unibo";
    if (city) card.style.setProperty("--city-accent", `var(--city-${city.toLowerCase()})`);
    const summary = createElement("summary", "support-university-summary");
    const head = createElement("h3");
    head.appendChild(createElement("span", "support-university-name", name));
    if (city) head.appendChild(createElement("span", "rules-uni-city", city));
    const toggle = createElement("span", "support-university-toggle");
    toggle.setAttribute("aria-hidden", "true");
    toggle.append(createElement("span", "support-university-toggle__closed", "View contacts"), createElement("span", "support-university-toggle__open", "Hide contacts"));
    head.appendChild(toggle);
    summary.appendChild(head);
    card.appendChild(summary);

    const body = createElement("div", "support-university-body");
    body.appendChild(coordinatorBlock(university.coordinator));
    const topics = createElement("div", "support-university-topics");
    for (const [key, title] of [["safety", "Feeling unsafe or treated unfairly"], ["wellbeing", "Wellbeing and counselling"]]) {
      const topic = createElement("section", "support-university-topic");
      const heading = createElement("h4", null, title);
      heading.id = `contacts-${id}-${key}`;
      topic.setAttribute("aria-labelledby", heading.id);
      topic.append(heading, supportList(university[key]));
      topics.appendChild(topic);
    }
    body.appendChild(topics);
    card.appendChild(body);
    card.addEventListener("toggle", updateSupportToggle);
    box.appendChild(card);
  }
  section.querySelector(".support-toggle-all").addEventListener("click", () => {
    const cards = Array.from(box.querySelectorAll(".rules-uni"));
    const shouldOpen = !cards.every((card) => card.open);
    for (const card of cards) card.open = shouldOpen;
    updateSupportToggle();
  });
  updateSupportToggle();
  const staff = support.sources[support.people.staffPage];
  if (staff && staff.link) {
    const line = section.querySelector(".support-staff-page");
    line.appendChild(createElement("span", "rules-links-label", "Programme staff: "));
    const a = createElement("a", null, staff.link.label);
    a.href = staff.link.url;
    a.target = "_blank";
    a.rel = "noopener";
    line.appendChild(a);
  }
}

function updateSupportToggle() {
  const cards = Array.from(document.querySelectorAll("#universities .rules-uni"));
  const allOpen = cards.length > 0 && cards.every((card) => card.open);
  const button = document.querySelector(".support-toggle-all");
  button.textContent = allOpen ? "Collapse all universities" : "Expand all universities";
  button.setAttribute("aria-expanded", String(allOpen));
}

function renderLists() {
  const leave = showSupportSection("leave");
  for (const key of ["leave", "withdrawal"]) {
    const list = supportList(support.people[key]);
    list.classList.add(`support-${key}`);
    leave.querySelector(`.support-${key}`).replaceWith(list);
  }
  showSupportSection("software").querySelector(".rules-list").replaceWith(supportList(support.people.software));
  showSupportSection("community").querySelector(".rules-list").replaceWith(supportList(support.people.community));
}

// Emergency numbers of the four cities, from the City Guides (a city whose guide cannot be read is skipped)
async function loadEmergencyNumbers() {
  const entries = await Promise.all(CITY_GUIDES.filter((g) => g.file).map(async (guide) => {
    try {
      const response = await fetch(guide.file);
      if (!response.ok) return null;
      const text = emergencyText(await response.text());
      return text ? { id: guide.id, city: support.names[guide.university]?.city || guide.id, text } : null;
    } catch {
      return null;
    }
  }));
  return entries.filter(Boolean);
}

async function initSupport() {
  const status = document.getElementById("support-status");
  try {
    const [peopleResponse, sources, tracksFile] = await Promise.all([
      fetch(PEOPLE_URL, { cache: "no-cache" }), loadSources(), loadTracksFile().catch(() => null),
    ]);
    if (!peopleResponse.ok) throw new Error(`HTTP ${peopleResponse.status}`);
    support.people = await peopleResponse.json();
    support.sources = sources;
    support.names = tracksFile ? tracksCohort(tracksFile).universities : {};
    document.getElementById("support-intro").textContent = support.people.intro;
    renderContactGuide();
    renderUniversities();
    renderLists();
    support.emergency = await loadEmergencyNumbers();
    renderEmergency();
    status.remove();
    document.dispatchEvent(new CustomEvent("academic:ready"));
  } catch (error) {
    console.error("Support page:", error);
    status.textContent = "Sorry, the contacts could not be loaded right now. ";
    const retry = createElement("button", "button button-secondary", "Try again");
    retry.type = "button";
    retry.addEventListener("click", () => window.location.reload());
    status.appendChild(retry);
  }
}

if (typeof document !== "undefined" && document.getElementById("support-status")) initSupport();

if (typeof module !== "undefined") {
  module.exports = { SUPPORT_UNIVERSITIES, visibleSupportQuestions, supportOutcome, emergencyText, emailsIn };
}
