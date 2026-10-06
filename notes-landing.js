// ===== Notes & Resources landing page =====
// A shared study library: live content totals, a personal study snapshot, course filters,
// bookmarks and two layouts. Course facts and progress keep using the shared data helpers.

const landingTabs = document.getElementById("landing-tabs");
const landingStatus = document.getElementById("landing-status");
const landingContent = document.getElementById("landing-content");
const searchBox = document.getElementById("notes-search");
const searchResults = document.getElementById("search-results");

const LANDING_TABS = [
  { key: "courses", label: "Courses", icon: "library" },
  { key: "concepts", label: "Key concepts", icon: "network" },
  { key: "progress", label: "My progress", icon: "chart-column" },
  { key: "study-list", label: "My Study List", icon: "bookmark" },
];

let landingData = null;
let searchEntries = null; // built the first time someone searches
const searchFilters = { type: "", course: "" };
const courseFilters = { type: "", status: "", mine: false };
let courseView = readStorage("euhem-notes-view", "grid") === "list" ? "list" : "grid";
let searchIndexPromise = null;
let landingExamState = { source: "", exams: [], refreshing: false, error: false };
let landingExamRequest = null;
let landingScheduleDay = NotesSchedule.clock().slice(0, 10);
let landingExamSelection = "";

function landingIcon(name) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "icon");
  icon.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `icons.svg#${name}`);
  icon.appendChild(use);
  return icon;
}

function landingLink(label, href, className) {
  const link = createElement("a", className, label);
  link.href = href;
  return link;
}

function refreshSavedCount() {
  const count = document.getElementById("notes-saved-count");
  if (count) count.textContent = String(getStudyList().length);
}

function plural(count, word, many = word + "s") {
  return `${count} ${count === 1 ? word : many}`;
}

// ----- Tabs -----

function currentLandingTab() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return LANDING_TABS.some((t) => t.key === tab) ? tab : "courses";
}

function showLandingTab(tab, addToHistory) {
  if (addToHistory) history.pushState(null, "", tab === "courses" ? "notes.html" : `notes.html?tab=${tab}`);
  for (const button of landingTabs.children) {
    button.setAttribute("aria-selected", String(button.dataset.tab === tab));
    button.tabIndex = button.dataset.tab === tab ? 0 : -1;
  }
  landingContent.setAttribute("aria-labelledby", `notes-tab-${tab}`);
  landingContent.innerHTML = "";
  if (tab === "courses") renderCourseList();
  if (tab === "concepts") renderGlossary();
  if (tab === "progress") renderMyProgress();
  if (tab === "study-list") renderStudyList();
  refreshSavedCount();
  updateStatSelection();
  renderStudyFocus();

  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (target) {
    target.classList.add("is-highlighted");
    target.scrollIntoView({ block: "center" });
  }
}

function buildLandingTabs() {
  for (const tab of LANDING_TABS) {
    const button = createElement("button", "track-tab");
    button.append(landingIcon(tab.icon), document.createTextNode(tab.label));
    if (tab.key === "courses" || tab.key === "study-list") {
      const count = createElement("span", "notes-tab-count", String(tab.key === "courses" ? landingData.courses.length : getStudyList().length));
      if (tab.key === "study-list") count.id = "notes-saved-count";
      button.appendChild(count);
    }
    button.type = "button";
    button.id = `notes-tab-${tab.key}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", "landing-content");
    button.dataset.tab = tab.key;
    button.addEventListener("click", () => showLandingTab(tab.key, true));
    button.addEventListener("keydown", (event) => {
      const buttons = [...landingTabs.children];
      let next = buttons.indexOf(button);
      if (event.key === "ArrowRight") next = (next + 1) % buttons.length;
      else if (event.key === "ArrowLeft") next = (next + buttons.length - 1) % buttons.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = buttons.length - 1;
      else return;
      event.preventDefault();
      buttons[next].click();
      buttons[next].focus();
    });
    landingTabs.appendChild(button);
  }
}

// ----- Hero totals -----

function renderHeroStats() {
  const box = document.getElementById("hero-stats");
  box.replaceChildren();
  const sum = (list) => landingData.courses.reduce((total, course) => total + list(course), 0);
  const stats = [
    [landingData.courses.length, "course", "courses", "library", ""],
    [sum((c) => c.topics.filter((t) => t.lecture).length), "interactive lecture", "interactive lectures", "sparkles", "lectures"],
    [sum((c) => c.topics.filter((t) => t.notes).length), "note", "notes", "file", "notes"],
    [sum((c) => c.flashcards.length), "flashcard", "flashcards", "flashcards", "flashcards"],
    [sum((c) => c.questions.length), "practice question", "practice questions", "exams", "questions"],
    [landingData.concepts.length, "key concept", "key concepts", "network", "concepts"],
  ];
  for (const [count, one, many, icon, filter] of stats) {
    const stat = createElement("button", "notes-library-stat");
    stat.type = "button";
    stat.dataset.filter = filter;
    stat.setAttribute("aria-label", `Explore ${plural(count, one, many)}`);
    stat.appendChild(landingIcon(icon));
    stat.appendChild(createElement("span", "hero-stat-number", String(count)));
    stat.appendChild(createElement("span", "hero-stat-label", count === 1 ? one : many));
    box.appendChild(stat);
    stat.addEventListener("click", () => {
      clearLandingSearch();
      courseFilters.type = filter === "concepts" ? "" : filter;
      courseFilters.status = "";
      courseFilters.mine = false;
      showLandingTab(filter === "concepts" ? "concepts" : "courses", true);
      document.getElementById("study-library").scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }
}

function updateStatSelection() {
  const tab = [...landingTabs.children].find((b) => b.getAttribute("aria-selected") === "true")?.dataset.tab;
  for (const button of document.querySelectorAll(".notes-library-stat")) {
    button.setAttribute("aria-pressed", String(button.dataset.filter === "concepts" ? tab === "concepts" : tab === "courses" && button.dataset.filter === courseFilters.type));
  }
}

// This is a suggestion based on existing topics and this device's progress, not an invented schedule.
function renderStudyFocus() {
  const box = document.getElementById("study-focus");
  const progress = loadProgress();
  const today = todayKey();
  const courses = landingData.courses;
  const topics = courses.flatMap((c) => c.topics.filter((t) => t.notes));
  const studied = topics.filter((t) => getTopicStatus(progress, t.id)).length;
  const percent = topics.length ? Math.round(studied / topics.length * 100) : 0;
  const cards = courses.flatMap((c) => c.flashcards);
  const due = dueCards(progress, cards, today).length;
  const streak = currentStreak(progress.activity, today);
  box.replaceChildren();
  box.setAttribute("aria-busy", "false");
  box.appendChild(createElement("p", "section-eyebrow", "A little progress, every day"));
  box.appendChild(createElement("h2", null, studied ? "Keep the momentum." : "A good place to start."));
  const overview = createElement("div", "notes-focus-overview");
  const ring = createElement("div", "notes-focus-ring");
  ring.style.setProperty("--ring-progress", `${percent * 3.6}deg`);
  ring.setAttribute("role", "img");
  ring.setAttribute("aria-label", `${studied} of ${topics.length} topics with notes read or understood, ${percent}%`);
  ring.appendChild(createElement("span", null, `${percent}%`));
  const summary = createElement("div", "notes-focus-summary");
  summary.appendChild(createElement("strong", null, studied ? `${studied} of ${topics.length} topics explored` : "Your learning starts here"));
  summary.appendChild(createElement("p", null, studied ? "Topics marked read or understood." : "Open a lecture. Explore an idea.\nMake it yours."));
  overview.append(ring, summary);
  box.appendChild(overview);
  const plan = loadPlan(landingData.programme);
  const codes = plan.saved ? selectedCourseCodes(landingData.term, plan.choices) : [];
  const available = courses.filter((c) => c.topics.some((t) => t.lecture || t.notes));
  const planned = available.filter((c) => codes.includes(c.info.code));
  const pool = planned.length ? planned : available;
  const course = pool.find((c) => c.topics.some((t) => t.notes && getTopicStatus(progress, t.id) === "read"))
    || pool.find((c) => c.topics.some((t) => (t.notes || t.lecture) && !getTopicStatus(progress, t.id))) || pool[0];
  if (course) {
    const topic = course.topics.find((t) => t.notes && getTopicStatus(progress, t.id) === "read")
      || course.topics.find((t) => (t.notes || t.lecture) && !getTopicStatus(progress, t.id))
      || course.topics.find((t) => t.lecture || t.notes);
    const next = landingLink("", itemUrl(topic.id, landingData), "notes-focus-next");
    const label = createElement("span", "notes-focus-next-label", getTopicStatus(progress, topic.id) ? "Continue learning" : "Start here");
    label.prepend(landingIcon(topic.lecture ? "sparkles" : "notes"));
    next.append(label, createElement("span", "notes-focus-next-title", topic.title), landingIcon("arrow-right"));
    box.appendChild(next);
  }
  const footer = createElement("div", "notes-focus-footer");
  footer.appendChild(createElement("span", null, streak ? `${plural(streak, "day")} study streak` : "Saved on this device"));
  const link = landingLink(due ? `${due} cards to review` : "View my progress", "notes.html?tab=progress");
  link.addEventListener("click", (event) => { event.preventDefault(); clearLandingSearch(); showLandingTab("progress", true); document.getElementById("study-library").scrollIntoView({ block: "start" }); });
  footer.appendChild(link);
  box.appendChild(footer);
}

// ----- Courses -----

function courseCounts(course) {
  return {
    lectures: course.topics.filter((t) => t.lecture).length,
    notes: course.topics.filter((t) => t.notes).length,
    flashcards: course.flashcards.length,
    questions: course.questions.length,
    concepts: conceptsForCourse(course, landingData.concepts).length,
    resources: course.resources.length,
  };
}

// A course is active only while at least one of its modules is actually teaching.
function courseTeachingStatus(course, today) {
  return NotesSchedule.courseStatus(course.info, today);
}

function landingDate(dateKey) {
  return formatDay(dateKey, { day: "numeric", month: "short", year: "numeric" });
}

function datedText(dateKey) {
  const time = createElement("time", null, landingDate(dateKey));
  time.dateTime = dateKey;
  return time;
}

function officialExamLink(label = "Check UniBo", className = "notes-exam-link") {
  const link = landingLink(label, landingData.cohort.sources.examDates, className);
  link.target = "_blank";
  link.rel = "noopener";
  link.appendChild(landingIcon("external"));
  return link;
}

function teachingDates(course, today) {
  const section = createElement("section", "notes-course-dates");
  section.setAttribute("aria-label", `Teaching dates for ${course.info.name}`);
  const head = createElement("h4", "notes-card-section-title", course.info.integrated ? "Teaching blocks" : "Teaching dates");
  head.prepend(landingIcon("calendar"));
  section.appendChild(head);
  for (const { info, key } of courseTeachingStatus(course, today).modules) {
    const row = createElement("div", `notes-module-dates is-${key}`);
    row.dataset.module = info.id;
    if (course.info.integrated) row.appendChild(createElement("strong", "notes-module-name", info.name));
    const date = createElement("div", "notes-module-range");
    if (key === "other") date.appendChild(createElement("span", null, "Dates to confirm"));
    else {
      date.appendChild(datedText(info.teachingStart));
      if (info.teachingStart !== info.teachingEnd) date.append(document.createTextNode(" – "), datedText(info.teachingEnd));
    }
    const status = key === "now" ? "In progress" : key === "finished" ? "Teaching completed" : key === "upcoming" ? `Starts ${countdownText(info.teachingStart, today).toLowerCase()}` : "Not yet confirmed";
    date.appendChild(createElement("span", `notes-module-status status-${key}`, status));
    row.appendChild(date);
    section.appendChild(row);
  }
  section.appendChild(landingLink("View course schedule", courseUrl(course.id, { tab: "schedule" }), "notes-schedule-link"));
  return section;
}

function courseExamDetails(course) {
  const box = createElement("section", "notes-course-exam");
  box.dataset.courseExam = course.id;
  box.setAttribute("aria-label", `Next exam for ${course.info.name}`);
  fillCourseExam(box, course);
  return box;
}

function fillCourseExam(box, course) {
  const now = NotesSchedule.clock();
  const today = now.slice(0, 10);
  const exam = NotesSchedule.nextExam(landingExamState.exams, course.id, now);
  box.replaceChildren();
  box.classList.toggle("has-exam", !!exam);
  box.setAttribute("aria-busy", String(landingExamState.refreshing && !landingExamState.source));
  const head = createElement("h4", "notes-card-section-title", "Next exam");
  head.prepend(landingIcon("exams"));
  box.appendChild(head);
  if (exam) {
    const when = createElement("div", "notes-next-exam-date");
    when.appendChild(datedText(exam.dateKey));
    if (exam.time) when.appendChild(createElement("span", null, ` · ${exam.time.padStart(5, "0")} (Bologna)`));
    when.appendChild(createElement("span", "notes-exam-countdown", countdownText(exam.dateKey, today)));
    box.appendChild(when);
    if (course.info.integrated) box.appendChild(createElement("p", "notes-exam-module", `Module: ${exam.title}`));
    const meta = [exam.type, exam.place].filter(Boolean).join(" · ");
    if (meta) box.appendChild(createElement("p", "notes-exam-meta", meta));
    if (!exam.time) box.appendChild(createElement("p", "notes-exam-meta", landingExamState.source === "calendar" ? "Time: confirm on UniBo" : "Time not published"));
    const registration = landingExamState.source === "unibo" ? registrationText(exam, today) : null;
    if (registration) box.appendChild(createElement("p", `notes-exam-registration${registration.open ? " is-open" : ""}`, registration.text));
    else if (exam.registrationCloses) box.appendChild(createElement("p", "notes-exam-registration", `${landingExamState.source === "calendar" ? "Calendar registration deadline" : "Registration deadline"}: ${landingDate(exam.registrationCloses)}`));
    const actions = createElement("div", "notes-exam-actions");
    actions.appendChild(landingLink("Exam details", courseUrl(course.id, { tab: "exam" }), "notes-exam-link"));
    if (registration?.open) {
      const register = landingLink("Register on AlmaEsami", "https://almaesami.unibo.it/almaesami/welcome.htm", "notes-exam-link");
      register.target = "_blank"; register.rel = "noopener";
      actions.appendChild(register);
    } else actions.appendChild(officialExamLink());
    box.appendChild(actions);
    box.appendChild(createElement("span", "notes-exam-source", landingExamState.source === "calendar" ? "Calendar copy · verify on UniBo" : "Source: UniBo exam dates"));
  } else {
    const message = !landingExamState.source && !landingExamState.error ? "Checking published exam dates…"
      : landingExamState.error && !landingExamState.source ? "Exam dates could not be loaded"
      : landingExamState.source === "calendar" ? "No upcoming date in the calendar copy" : "No upcoming exam date published";
    box.appendChild(createElement("p", "notes-exam-empty", message));
    if (landingExamState.source || landingExamState.error) box.appendChild(officialExamLink("Check official exam dates"));
  }
}

function buildSemesterOverview() {
  const box = createElement("div", "notes-semester-overview");
  box.setAttribute("aria-label", "Semester at a glance");
  for (const [key, label, icon] of [["now", "Teaching now", "book"], ["upcoming", "Coming up", "calendar"], ["finished", "Teaching completed", "check"]]) {
    const button = createElement("button", `notes-semester-card notes-semester-${key}`);
    button.type = "button";
    button.dataset.teachingFilter = key;
    button.setAttribute("aria-pressed", String(courseFilters.status === key));
    const title = createElement("span", "notes-overview-label", label);
    title.prepend(landingIcon(icon));
    button.append(title, createElement("strong", "notes-overview-value"), createElement("span", "notes-overview-detail"));
    button.addEventListener("click", () => {
      courseFilters.status = courseFilters.status === key ? "" : key;
      document.querySelector(".notes-status-filter select").value = courseFilters.status;
      renderCourseGrid();
    });
    box.appendChild(button);
  }
  const next = landingLink("", "exams.html", "notes-semester-card notes-semester-exam");
  const title = createElement("span", "notes-overview-label", "Next published exam");
  title.prepend(landingIcon("exams"));
  next.append(title, createElement("strong", "notes-overview-value"), createElement("span", "notes-overview-detail"));
  box.appendChild(next);
  return box;
}

function updateSemesterOverview(entries) {
  const now = NotesSchedule.clock(), today = now.slice(0, 10);
  for (const button of document.querySelectorAll("[data-teaching-filter]")) {
    const key = button.dataset.teachingFilter;
    const members = entries.filter(({ course }) => courseTeachingStatus(course, today).key === key);
    button.querySelector(".notes-overview-value").textContent = plural(members.length, "course");
    button.setAttribute("aria-pressed", String(courseFilters.status === key));
    const nextStart = members.map(({ course }) => courseTeachingStatus(course, today).nextDate).filter(Boolean).sort()[0];
    button.querySelector(".notes-overview-detail").textContent = key === "now" ? "Classes currently in progress" : key === "finished" ? "Keep revising for your exams" : nextStart ? `Next start: ${landingDate(nextStart)}` : "No upcoming teaching blocks";
  }
  const next = document.querySelector(".notes-semester-exam");
  if (!next) return;
  const ids = new Set(entries.map(({ course }) => course.id));
  const exam = NotesSchedule.nextExam(landingExamState.exams.filter(e => e.courseIds.some(id => ids.has(id))), null, now);
  next.querySelector(".notes-overview-value").textContent = exam ? landingDate(exam.dateKey) : landingExamState.source ? "Check official dates" : landingExamState.error ? "Dates unavailable" : "Checking dates…";
  next.querySelector(".notes-overview-detail").textContent = exam ? `${exam.title}${landingExamState.source === "calendar" ? " · calendar copy" : ""}` : "View the exam dates page";
  next.href = exam ? courseUrl(exam.courseIds.find(id => ids.has(id)), { tab: "exam" }) : "exams.html";
}

function updateLandingExamUI() {
  for (const box of document.querySelectorAll("[data-course-exam]")) {
    const course = landingData.courses.find(c => c.id === box.dataset.courseExam);
    if (course) fillCourseExam(box, course);
  }
  const status = document.getElementById("notes-exam-feed-status");
  if (status) {
    status.textContent = landingExamState.refreshing ? "Checking the official exam dates…"
      : landingExamState.source === "unibo" ? "Exam dates from UniBo · times shown in Bologna time. Confirm details before registering."
      : landingExamState.source === "calendar" ? "Official dates could not be refreshed. Showing the saved calendar copy; confirm dates and times on UniBo."
      : "Exam dates are unavailable. Use the official UniBo link to check your next sitting.";
    status.classList.toggle("is-calendar-copy", landingExamState.source === "calendar");
  }
  const refresh = document.getElementById("notes-refresh-exams");
  if (refresh) refresh.disabled = landingExamState.refreshing;
  updateSemesterOverview(filteredCourseEntries());
  landingExamSelection = landingExamSignature();
}

function landingExamSignature() {
  const now = NotesSchedule.clock();
  return JSON.stringify(landingData.courses.map(course => {
    const exam = NotesSchedule.nextExam(landingExamState.exams, course.id, now);
    return exam ? [exam.dateKey, exam.time] : null;
  }));
}

// Refresh local status when a tab stays open overnight or an exam has started.
// Only replace the cards when the date changes; ordinary timer ticks preserve focus.
function refreshLandingSchedule() {
  if (!landingData || document.hidden) return;
  const today = NotesSchedule.clock().slice(0, 10);
  const dayChanged = today !== landingScheduleDay;
  if (dayChanged) {
    landingScheduleDay = today;
    if (document.getElementById("notes-course-results")) renderCourseGrid();
  }
  if (dayChanged || landingExamSignature() !== landingExamSelection) updateLandingExamUI();
}

async function savedCalendarExams() {
  const manifest = await readJson(fetchText, "calendar/calendars.json", []);
  if (!Array.isArray(manifest)) throw new Error("Calendar list unavailable");
  const entry = manifest.find(c => c.cohort === landingData.cohort.id && c.term === landingData.term.id && c.plan === null);
  if (!entry || !/^[a-z0-9-]+\.ics$/i.test(entry.file)) throw new Error("Full calendar unavailable");
  const text = await fetchText(`calendar/${entry.file}`);
  if (!text) throw new Error("Calendar copy unavailable");
  return NotesSchedule.calendarExams(text, landingData.term);
}

function loadLandingExams() {
  if (landingExamRequest) return landingExamRequest;
  landingExamState.refreshing = true;
  updateLandingExamUI();
  landingExamRequest = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(landingData.cohort.sources.examDates, { signal: controller.signal });
      if (!response.ok) throw new Error("Official dates unavailable");
      const text = await response.text();
      if (!/<h3\b[^>]*role=["']tab["']/i.test(text) && !/no (?:upcoming |scheduled )?exam(?: dates)?s?\b|nessun appello|non sono presenti appelli/i.test(text)) throw new Error("Unrecognised exam page");
      landingExamState = { source: "unibo", exams: matchExamsToTerm(parseExamsPage(text), landingData.term), refreshing: false, error: false };
    } catch {
      try {
        landingExamState = { source: "calendar", exams: await savedCalendarExams(), refreshing: false, error: true };
      } catch {
        landingExamState = { source: "", exams: [], refreshing: false, error: true };
      }
    } finally {
      clearTimeout(timer);
      landingExamRequest = null;
      updateLandingExamUI();
    }
  })();
  return landingExamRequest;
}

function courseCard(course, index, progress, today, myCodes) {
  const info = course.info;
  const counts = courseCounts(course);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const card = createElement("article", total ? "course-card" : "course-card is-overview-only");
  card.setAttribute("aria-labelledby", `course-title-${course.id}`);
  card.style.setProperty("--course-color", courseColor(course, index));
  const head = createElement("div", "course-card-top");
  const identity = createElement("div", "course-card-identity");
  identity.appendChild(courseIcon(info.icon, "course-icon"));
  const meta = createElement("div");
  meta.appendChild(createElement("span", "course-card-code", info.code));
  meta.appendChild(createElement("span", "course-card-credit", `${info.cfu} CFU · Cycle ${courseCycles(info)}`));
  identity.appendChild(meta);
  head.appendChild(identity);
  const save = createElement("button", "course-card-save");
  save.type = "button";
  save.appendChild(landingIcon("bookmark"));
  const updateSave = () => {
    const saved = isSaved(course.id);
    save.setAttribute("aria-pressed", String(saved));
    save.setAttribute("aria-label", `${saved ? "Remove" : "Save"} ${info.name}${saved ? " from" : " to"} My Study List`);
    save.title = saved ? "Remove from My Study List" : "Save to My Study List";
  };
  updateSave();
  save.addEventListener("click", () => {
    const saved = toggleSaved(course.id);
    updateSave();
    refreshSavedCount();
    if (typeof toast === "function") toast(saved ? "Course saved to My Study List" : "Course removed from My Study List");
  });
  head.appendChild(save);
  card.appendChild(head);
  const title = createElement("h3");
  title.id = `course-title-${course.id}`;
  title.appendChild(landingLink(info.name + (info.integrated ? " (I.C.)" : ""), courseUrl(course.id), "course-card-title"));
  card.appendChild(title);
  const professors = [...new Set(info.modules.flatMap((m) => m.professors))];
  if (info.integrated) {
    card.appendChild(createElement("p", "notes-course-modules", info.modules.map((m) => m.name).join(" / ")));
  }

  const badges = createElement("div", "course-card-badges");
  if (course.group) badges.appendChild(createElement("span", `plan-badge plan-badge-${course.group.kind}`, course.group.badge || course.group.label));
  if (myCodes && myCodes.includes(info.code)) badges.appendChild(createElement("span", "plan-badge plan-badge-mine", "✓ In my plan"));
  const status = courseTeachingStatus(course, today);
  if (status) {
    badges.appendChild(createElement("span", `status-badge status-${status.key}`, status.label));
  }
  const samples = [...course.flashcards, ...course.questions, ...course.resources].some((i) => i.sample);
  if (samples) badges.appendChild(sampleTag());
  card.appendChild(badges);
  card.appendChild(teachingDates(course, today));
  card.appendChild(courseExamDetails(course));

  if (total) {
    const materials = createElement("div", "notes-course-materials");
    const types = [
      [counts.lectures, "lecture", "sparkles", "lectures"],
      [counts.notes, "note", "file", "topics"],
      [counts.flashcards, "flashcard", "flashcards", "practice", "flashcards"],
      [counts.questions, "question", "exams", "practice", "question-bank"],
      [counts.concepts, "concept", "network", "concepts"],
      [counts.resources, "resource", "link", "resources"],
    ];
    for (const [count, label, icon, tab, anchor] of types) {
      if (!count) continue;
      const link = landingLink(plural(count, label), courseUrl(course.id, { tab }) + (anchor ? `#${anchor}` : ""), "notes-material-link");
      link.prepend(landingIcon(icon));
      materials.appendChild(link);
    }
    card.appendChild(materials);
  } else {
    card.appendChild(createElement("p", "notes-course-empty", "Course overview available. Student notes and practice are still to come."));
  }

  const mine = courseProgress(progress, course);
  if (mine.total) {
    const row = createElement("div", "course-card-progress");
    row.appendChild(progressBar(mine.percent, `Your progress: ${mine.percent}%`));
    row.appendChild(createElement("span", "schedule-meta", `${mine.read + mine.understood}/${mine.total} topics explored`));
    card.appendChild(row);
  }
  const bottom = createElement("div", "notes-course-bottom");
  bottom.appendChild(createElement("span", "notes-course-professors", professors.join(" · ")));
  const open = landingLink(total ? "Start learning" : "View overview", courseUrl(course.id), "notes-course-open");
  if (mine.percent) open.firstChild.textContent = "Continue studying";
  open.appendChild(landingIcon("arrow-right"));
  bottom.appendChild(open);
  card.appendChild(bottom);
  return card;
}

function renderCourseList() {
  landingContent.appendChild(buildSemesterOverview());
  const toolbar = createElement("div", "notes-toolbar");
  const filters = createElement("div", "notes-type-filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Filter courses by study content");
  for (const [key, label, icon] of [["", "All resources", "library"], ["lectures", "Lectures", "sparkles"], ["notes", "Notes", "file"], ["flashcards", "Flashcards", "flashcards"], ["questions", "Questions", "exams"]]) {
    const button = createElement("button", "filter-chip", label);
    button.type = "button";
    button.dataset.contentType = key;
    button.prepend(landingIcon(icon));
    button.setAttribute("aria-pressed", String(courseFilters.type === key));
    button.addEventListener("click", () => {
      courseFilters.type = key;
      for (const chip of filters.children) chip.setAttribute("aria-pressed", String(chip.dataset.contentType === key));
      renderCourseGrid();
      updateStatSelection();
    });
    filters.appendChild(button);
  }
  toolbar.appendChild(filters);
  const plan = loadPlan(landingData.programme);
  if (plan.saved) {
    const mine = createElement("button", "notes-plan-filter", "My plan only");
    mine.type = "button";
    mine.prepend(landingIcon("study-plan"));
    mine.setAttribute("aria-pressed", String(courseFilters.mine));
    mine.addEventListener("click", () => { courseFilters.mine = !courseFilters.mine; mine.setAttribute("aria-pressed", String(courseFilters.mine)); renderCourseGrid(); });
    toolbar.appendChild(mine);
  } else {
    const setup = landingLink("Set up my plan", "studyplan.html", "notes-plan-filter");
    setup.prepend(landingIcon("study-plan"));
    toolbar.appendChild(setup);
  }
  const views = createElement("div", "notes-view-switch");
  views.setAttribute("role", "group");
  views.setAttribute("aria-label", "Course layout");
  for (const view of ["grid", "list"]) {
    const button = createElement("button");
    button.type = "button";
    button.dataset.view = view;
    button.setAttribute("aria-label", `${view === "grid" ? "Grid" : "List"} view`);
    button.setAttribute("aria-pressed", String(courseView === view));
    button.appendChild(landingIcon(view));
    button.addEventListener("click", () => {
      courseView = view;
      writeStorage("euhem-notes-view", view);
      for (const choice of views.children) choice.setAttribute("aria-pressed", String(choice.dataset.view === view));
      renderCourseGrid();
    });
    views.appendChild(button);
  }
  toolbar.appendChild(views);
  landingContent.appendChild(toolbar);
  const meta = createElement("div", "notes-library-meta");
  const count = createElement("p");
  count.id = "notes-course-count";
  count.setAttribute("role", "status");
  meta.appendChild(count);
  const status = createElement("label", "notes-status-filter", "Teaching status");
  const select = createElement("select");
  select.setAttribute("aria-label", "Filter by teaching status");
  for (const [key, label] of [["", "All teaching periods"], ["now", "Teaching now"], ["upcoming", "Coming up"], ["finished", "Teaching completed"], ["other", "Dates to confirm"]]) select.appendChild(new Option(label, key));
  select.value = courseFilters.status;
  select.addEventListener("change", () => { courseFilters.status = select.value; renderCourseGrid(); });
  status.appendChild(select);
  meta.appendChild(status);
  landingContent.appendChild(meta);
  const examFeed = createElement("div", "notes-exam-feed");
  const feedStatus = createElement("p");
  feedStatus.id = "notes-exam-feed-status";
  feedStatus.setAttribute("role", "status");
  examFeed.appendChild(feedStatus);
  const feedActions = createElement("div", "notes-exam-feed-actions");
  feedActions.appendChild(officialExamLink("Official exam dates"));
  const refresh = createElement("button", "notes-refresh-exams", "Refresh dates");
  refresh.id = "notes-refresh-exams";
  refresh.type = "button";
  refresh.setAttribute("aria-label", "Refresh exam dates");
  refresh.addEventListener("click", loadLandingExams);
  feedActions.appendChild(refresh);
  examFeed.appendChild(feedActions);
  landingContent.appendChild(examFeed);
  const results = createElement("div");
  results.id = "notes-course-results";
  landingContent.appendChild(results);
  renderCourseGrid();
  updateLandingExamUI();
}

function filteredCourseEntries() {
  const plan = loadPlan(landingData.programme);
  const myCodes = plan.saved ? selectedCourseCodes(landingData.term, plan.choices) : null;
  return landingData.courses.map((course, index) => ({ course, index, counts: courseCounts(course) })).filter(({ course, counts }) =>
    (!courseFilters.type || counts[courseFilters.type] > 0) && (!courseFilters.mine || (myCodes && myCodes.includes(course.info.code))));
}

function renderCourseGrid() {
  const results = document.getElementById("notes-course-results");
  if (!results) return;
  results.replaceChildren();
  const progress = loadProgress();
  const today = NotesSchedule.clock().slice(0, 10);
  const plan = loadPlan(landingData.programme);
  const myCodes = plan.saved ? selectedCourseCodes(landingData.term, plan.choices) : null;
  const entries = filteredCourseEntries();
  const matches = entries.filter(({ course }) => !courseFilters.status || courseTeachingStatus(course, today).key === courseFilters.status);
  updateSemesterOverview(entries);
  document.getElementById("notes-course-count").textContent = `${plural(matches.length, "course")} · ${courseFilters.mine ? "From your saved study plan" : "First-year study library"}`;
  if (!matches.length) {
    const empty = createElement("div", "notes-empty-state");
    empty.append(landingIcon("search"), createElement("h3", null, "No courses match these filters"), createElement("p", null, "Try another content type or teaching period to explore the library."));
    const reset = createElement("button", "button button-secondary", "Clear filters");
    reset.type = "button";
    reset.addEventListener("click", () => {
      courseFilters.type = ""; courseFilters.status = ""; courseFilters.mine = false;
      showLandingTab("courses", false);
      landingContent.querySelector(".filter-chip").focus();
    });
    empty.appendChild(reset);
    results.appendChild(empty);
    return;
  }
  const groups = [
    { key: "now", title: "Teaching now", icon: "book", description: "Your current courses. Dates are shown for each teaching block." },
    { key: "upcoming", title: "Coming up", icon: "calendar", description: "Your next courses and returning modules, ordered by their next start date." },
    { key: "finished", title: "Teaching completed", icon: "check", description: "Classes have finished. Exams and revision may still be ahead." },
    { key: "other", title: "Dates to confirm", icon: "info", description: "Teaching dates have not yet been confirmed for these courses." },
  ];
  for (const group of groups) {
    const members = matches.filter(({ course }) => courseTeachingStatus(course, today).key === group.key)
      .sort((a, b) => courseTeachingStatus(a.course, today).nextDate.localeCompare(courseTeachingStatus(b.course, today).nextDate) || a.course.info.name.localeCompare(b.course.info.name));
    if (members.length === 0) continue;
    const section = createElement("section", `notes-teaching-group notes-group-${group.key}`);
    section.dataset.teachingGroup = group.key;
    const title = createElement("h3", "course-group-title", group.title);
    title.id = `notes-group-${group.key}`;
    title.prepend(landingIcon(group.icon));
    title.appendChild(createElement("span", "notes-group-count", String(members.length)));
    section.setAttribute("aria-labelledby", title.id);
    section.append(title, createElement("p", "notes-group-description", group.description));
    const list = createElement("div", `course-list${courseView === "list" ? " is-list-view" : ""}`);
    for (const { course, index } of members) list.appendChild(courseCard(course, index, progress, today, myCodes));
    section.appendChild(list);
    results.appendChild(section);
  }
}


// ----- Key concepts (the shared glossary) -----

function renderGlossary() {
  const box = createElement("section", "card");
  box.appendChild(createElement("h3", null, "Key concepts"));
  box.appendChild(createElement("p", "schedule-meta", "One glossary for all courses. Each concept links to the topics where it appears."));
  const concepts = [...landingData.concepts].sort((a, b) => a.term.localeCompare(b.term));
  if (concepts.length === 0) box.appendChild(createElement("p", "placeholder", "No concepts yet."));
  const list = createElement("div", "concept-list");
  for (const concept of concepts) {
    const card = createElement("div", "concept-card");
    card.id = concept.id;
    const head = createElement("div", "notes-heading");
    const term = createElement("h4", null, concept.term);
    if (concept.sample) term.appendChild(sampleTag());
    head.appendChild(term);
    const save = saveButton(concept.id);
    save.addEventListener("click", refreshSavedCount);
    head.appendChild(save);
    card.appendChild(head);
    card.appendChild(renderRichText("p", concept.explanation));
    const where = createElement("p", "schedule-meta", "Appears in: ");
    (concept.topics || []).forEach((topicId, index) => {
      const found = topicById(topicId, landingData);
      if (index > 0) where.appendChild(document.createTextNode(", "));
      const link = createElement("a", null, found ? `${found.course.info.name} › ${found.topic.title}` : topicId);
      link.href = itemUrl(topicId, landingData);
      where.appendChild(link);
    });
    if (concept.topics && concept.topics.length) card.appendChild(where);
    list.appendChild(card);
  }
  box.appendChild(list);
  landingContent.appendChild(box);
  typesetMath(box);
}

// ----- My progress -----

function renderMyProgress() {
  const progress = loadProgress();
  const today = todayKey();
  const box = createElement("section", "card");
  box.appendChild(createElement("h3", null, "My progress"));
  box.appendChild(createElement("p", "demo-note",
    "Saved only in this browser, on this device. Use “Download backup” to move it to another device."));

  // Summary tiles
  const allCards = landingData.courses.flatMap((c) => c.flashcards);
  const streak = currentStreak(progress.activity, today);
  const tiles = createElement("div", "progress-tiles");
  const tile = (number, label) => {
    const t = createElement("div", "progress-tile");
    t.appendChild(createElement("span", "hero-stat-number", String(number)));
    t.appendChild(createElement("span", "hero-stat-label", label));
    tiles.appendChild(t);
  };
  tile(streak, streak === 1 ? "day streak 🔥" : "day streak 🔥");
  tile(Object.values(progress.topics).filter((s) => s === "understood").length, "topics understood");
  tile(Object.keys(progress.cards).length, "cards studied");
  tile(dueCards(progress, allCards, today).length, "cards due today");
  box.appendChild(tiles);

  // Per course
  const table = createElement("div", "progress-table");
  for (const [index, course] of landingData.courses.entries()) {
    const mine = courseProgress(progress, course);
    const due = dueCards(progress, course.flashcards, today).length;
    const quiz = progress.quizzes[course.id];
    if (!mine.total && !course.flashcards.length && !course.questions.length) continue;

    const row = createElement("a", "progress-row");
    row.href = courseUrl(course.id);
    row.style.setProperty("--course-color", courseColor(course, index));
    const name = createElement("div", "progress-row-name");
    name.appendChild(courseIcon(course.info.icon, "course-icon small"));
    name.appendChild(createElement("span", "course-card-title", course.info.name));
    row.appendChild(name);
    const topics = createElement("div", "progress-row-cell");
    topics.appendChild(progressBar(mine.percent));
    topics.appendChild(createElement("span", "schedule-meta",
      `${mine.read + mine.understood}/${mine.total} topics · ${mine.understood} understood`));
    row.appendChild(topics);
    row.appendChild(createElement("div", "progress-row-cell schedule-meta",
      course.flashcards.length ? `${due} card${due === 1 ? "" : "s"} due` : "No flashcards"));
    row.appendChild(createElement("div", "progress-row-cell schedule-meta",
      quiz ? `Best quiz: ${quiz.best}%` : "No quiz yet"));
    table.appendChild(row);
  }
  box.appendChild(table);

  // Backup / restore / reset
  const tools = createElement("div", "button-row progress-tools");
  const download = createElement("button", "button button-light", "⬇ Download backup");
  download.type = "button";
  download.addEventListener("click", () => {
    const blob = new Blob([exportProgressText()], { type: "application/json" });
    const link = createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `eu-hem-study-progress-${today}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  tools.appendChild(download);

  const restoreInput = createElement("input");
  restoreInput.type = "file";
  restoreInput.accept = ".json,application/json";
  restoreInput.hidden = true;
  const restore = createElement("button", "button button-light", "⬆ Restore from backup");
  restore.type = "button";
  restore.addEventListener("click", () => restoreInput.click());
  restoreInput.addEventListener("change", async () => {
    const file = restoreInput.files[0];
    if (!file) return;
    try {
      const summary = importProgressText(await file.text());
      alert(`Progress restored: ${summary.topics} topics, ${summary.cards} flashcards, ${summary.quizzes} quiz scores.`);
      showLandingTab("progress", false);
    } catch (problem) {
      alert(problem.message);
    }
  });
  tools.appendChild(restore);
  tools.appendChild(restoreInput);

  const reset = createElement("button", "button button-danger", "Reset progress");
  reset.type = "button";
  reset.addEventListener("click", () => {
    if (confirm("Reset all your progress on this device? (Topics, flashcard schedule, quiz scores and streak. My Study List is kept.)")) {
      resetProgress();
      showLandingTab("progress", false);
    }
  });
  tools.appendChild(reset);
  box.appendChild(tools);
  landingContent.appendChild(box);
}

// ----- My Study List -----

function renderStudyList() {
  const box = createElement("section", "card");
  box.appendChild(createElement("h3", null, "My Study List"));
  box.appendChild(createElement("p", "demo-note",
    "Saved only in this browser, on this device. It isn't synced to other devices and is lost if you clear your browser data."));

  const saved = getStudyList();
  if (saved.length === 0) {
    box.appendChild(createElement("p", "placeholder",
      "Nothing saved yet. Use ☆ Save on courses, topics, flashcards, questions, concepts and resources."));
    landingContent.appendChild(box);
    return;
  }

  const list = createElement("ul", "study-list");
  for (const entry of saved) {
    const found = findItem(entry.id, landingData);
    const item = createElement("li", "study-item");
    const main = createElement("div");
    main.appendChild(createElement("span", "study-type", TYPE_LABELS[itemTypeOf(entry.id)] || "Item"));
    if (found) {
      const link = createElement("a", "study-title", found.title);
      link.href = itemUrl(entry.id, landingData);
      main.appendChild(link);
      if (found.course && found.type !== "course") main.appendChild(createElement("span", "schedule-meta", found.course.info.name));
    } else {
      main.appendChild(createElement("span", "study-title placeholder", "This item is no longer available."));
    }
    item.appendChild(main);

    const remove = createElement("button", "button button-light", "Remove");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${found ? found.title : "item"} from My Study List`);
    remove.addEventListener("click", () => {
      toggleSaved(entry.id);
      showLandingTab("study-list", false);
    });
    item.appendChild(remove);
    list.appendChild(item);
  }
  box.appendChild(list);
  landingContent.appendChild(box);
}

// ----- Search -----

const SEARCH_GROUPS = ["topic", "concept", "flashcard", "question", "resource"];
const SEARCH_GROUP_LABELS = { topic: "Notes", concept: "Key concepts", flashcard: "Flashcards", question: "Questions", resource: "Resources" };

async function ensureSearchIndex() {
  if (searchEntries) return;
  if (searchIndexPromise) return searchIndexPromise;
  searchIndexPromise = (async () => {
  // Load every notes file once, so notes text can be searched too
  const notesByTopic = {};
  const jobs = [];
  for (const module of landingData.modules) {
    for (const topic of module.topics.filter((t) => t.notes)) {
      jobs.push(loadNotes(module, topic).then((notes) => { if (notes) notesByTopic[topic.id] = notes; }));
    }
  }
  await Promise.all(jobs);
  searchEntries = buildSearchIndex(landingData, notesByTopic);
  })();
  try { await searchIndexPromise; }
  finally { searchIndexPromise = null; }
}

// A row of filter buttons: "All (12)  Notes (3)  Flashcards (5) ..."
function filterChips(results, query) {
  const row = createElement("div", "filter-chips");
  for (const type of ["", ...SEARCH_GROUPS]) {
    const count = type ? results.filter((r) => r.type === type).length : results.length;
    if (type && count === 0) continue;
    const chip = createElement("button", "filter-chip", `${type ? SEARCH_GROUP_LABELS[type] : "All"} (${count})`);
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(searchFilters.type === type));
    chip.addEventListener("click", () => {
      searchFilters.type = type;
      showResults(results, query);
    });
    row.appendChild(chip);
  }
  const courses = [...new Set(results.map((r) => r.courseId).filter(Boolean))];
  if (courses.length > 1) {
    const select = createElement("select", "select-pill filter-course");
    select.setAttribute("aria-label", "Filter results by course");
    select.appendChild(new Option("All courses", ""));
    for (const id of courses) {
      const course = landingData.courses.find((c) => c.id === id);
      select.appendChild(new Option(course ? course.info.name : id, id));
    }
    select.value = searchFilters.course;
    select.addEventListener("change", () => {
      searchFilters.course = select.value;
      showResults(results, query);
    });
    row.appendChild(select);
  }
  return row;
}

function showResults(results, query) {
  searchResults.innerHTML = "";
  const visible = results.filter((r) =>
    (!searchFilters.type || r.type === searchFilters.type) &&
    (!searchFilters.course || r.courseId === searchFilters.course || (r.type === "concept" && !searchFilters.course)));
  searchResults.appendChild(createElement("h3", null,
    results.length ? `${plural(results.length, "result")} for “${query}”` : `No results for “${query}”`));
  document.getElementById("search-announcement").textContent = `${plural(visible.length, "result")} for ${query}`;
  if (results.length === 0) {
    searchResults.appendChild(createElement("p", "placeholder", "Try fewer or different words. Press Esc to clear the search."));
    return;
  }
  searchResults.appendChild(filterChips(results, query));
  if (!visible.length) searchResults.appendChild(createElement("p", "placeholder", "No results match these filters. Choose All or another course."));
  for (const type of SEARCH_GROUPS) {
    const group = visible.filter((r) => r.type === type);
    if (group.length === 0) continue;
    searchResults.appendChild(createElement("h4", "search-group", `${SEARCH_GROUP_LABELS[type]} (${group.length})`));
    const list = createElement("ul", "search-list");
    for (const result of group) {
      const item = createElement("li");
      const link = createElement("a", "search-title");
      link.href = itemUrl(result.id, landingData);
      link.appendChild(highlightMatches(result.title, query));
      item.appendChild(link);
      if (result.courseTitle) item.appendChild(createElement("span", "schedule-meta", ` · ${result.courseTitle}`));
      const snippet = createElement("p", "search-snippet");
      snippet.appendChild(highlightMatches(searchSnippet(result, query), query));
      item.appendChild(snippet);
      list.appendChild(item);
    }
    searchResults.appendChild(list);
  }
}

async function runSearch() {
  const query = searchBox.value.trim();
  const searching = query.length >= 2;
  searchResults.hidden = !searching;
  document.getElementById("study-library").hidden = searching;
  document.getElementById("notes-search-clear").hidden = !searchBox.value;
  searchResults.setAttribute("aria-busy", String(searching));
  if (!searching) {
    searchResults.setAttribute("aria-busy", "false");
    document.getElementById("search-announcement").textContent = "";
    return;
  }
  searchResults.replaceChildren(createElement("p", "placeholder", "Searching the library…"));
  if (!landingData) return;
  try {
    await ensureSearchIndex();
    if (searchBox.value.trim() !== query) return;
    searchFilters.type = "";
    searchFilters.course = "";
    showResults(searchIndex(searchEntries, query), query);
  } catch (error) {
    if (searchBox.value.trim() !== query) return;
    searchResults.replaceChildren(createElement("p", "placeholder", "Search could not be loaded. Clear the search to browse courses, or try again."));
    document.getElementById("search-announcement").textContent = "Search could not be loaded.";
  } finally {
    if (searchBox.value.trim() === query) searchResults.setAttribute("aria-busy", "false");
  }
}

function clearLandingSearch() {
  clearTimeout(searchTimer);
  searchBox.value = "";
  runSearch();
}

let searchTimer = null;
searchBox.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 200); // wait until typing pauses
});
document.getElementById("notes-search-clear").addEventListener("click", () => { clearLandingSearch(); searchBox.focus(); });
for (const button of document.querySelectorAll("[data-search]")) {
  button.addEventListener("click", () => { searchBox.value = button.dataset.search; clearTimeout(searchTimer); runSearch(); searchBox.focus(); });
}

// Keyboard: "/" jumps to search, Esc clears it
document.addEventListener("keydown", (event) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if (event.key === "/" && !typing) {
    event.preventDefault();
    searchBox.focus();
  }
  if (event.key === "Escape" && document.activeElement === searchBox) {
    clearLandingSearch();
  }
});

// ----- Start -----

async function initLanding() {
  try {
    landingData = await loadAll();
    const slot = document.getElementById("contribute-slot");
    slot.replaceChildren();
    const contribute = formButton("Share a resource", landingData.settings.contributeFormUrl, "button button-secondary");
    contribute.appendChild(landingIcon("arrow-right"));
    slot.appendChild(contribute);
    renderHeroStats();
    landingStatus.hidden = true;
    buildLandingTabs();
    showLandingTab(currentLandingTab(), false);
    loadLandingExams();
    setInterval(refreshLandingSchedule, 60000);
    document.addEventListener("visibilitychange", refreshLandingSchedule);
    window.addEventListener("popstate", () => { clearLandingSearch(); showLandingTab(currentLandingTab(), false); });
    window.addEventListener("storage", (event) => {
      if (![PROGRESS_KEY, STUDY_LIST_KEY, PLAN_KEY].includes(event.key) && event.key !== null) return;
      renderStudyFocus();
      refreshSavedCount();
      if (!document.getElementById("study-library").hidden) showLandingTab(currentLandingTab(), false);
    });
    if (searchBox.value.trim()) runSearch(); // the browser may restore typed text
  } catch (error) {
    console.error("Could not load notes:", error);
    landingStatus.textContent = "Sorry, Notes & Resources could not be loaded right now. Please try again later.";
    landingStatus.hidden = false;
    const retry = createElement("button", "button button-secondary", "Try again");
    retry.type = "button";
    retry.addEventListener("click", () => window.location.reload());
    landingStatus.append(document.createTextNode(" "), retry);
    const focus = document.getElementById("study-focus");
    focus.setAttribute("aria-busy", "false");
    focus.replaceChildren(createElement("h2", null, "Your study library"), createElement("p", "notes-focus-loading", "Study content is unavailable right now. Try reloading the page."));
    if (searchBox.value.trim().length >= 2) {
      searchResults.setAttribute("aria-busy", "false");
      searchResults.replaceChildren(createElement("p", "placeholder", "The library could not be loaded. Clear the search and try again."));
    }
  }
}

initLanding();
