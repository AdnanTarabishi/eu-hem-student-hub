// ===== Notes & Resources landing page =====
// Hero with totals and search · tabs: Courses · Key concepts · My progress · My Study List

const landingTabs = document.getElementById("landing-tabs");
const landingStatus = document.getElementById("landing-status");
const landingContent = document.getElementById("landing-content");
const searchBox = document.getElementById("notes-search");
const searchResults = document.getElementById("search-results");

const LANDING_TABS = [
  { key: "courses", label: "Courses" },
  { key: "concepts", label: "Key concepts" },
  { key: "progress", label: "My progress" },
  { key: "study-list", label: "My Study List" },
];

let landingData = null;
let searchEntries = null; // built the first time someone searches
const searchFilters = { type: "", course: "" };

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
  }
  landingContent.innerHTML = "";
  if (tab === "courses") renderCourseList();
  if (tab === "concepts") renderGlossary();
  if (tab === "progress") renderMyProgress();
  if (tab === "study-list") renderStudyList();

  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (target) {
    target.classList.add("is-highlighted");
    target.scrollIntoView({ block: "center" });
  }
}

function buildLandingTabs() {
  for (const tab of LANDING_TABS) {
    const button = createElement("button", "track-tab", tab.label);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.dataset.tab = tab.key;
    button.addEventListener("click", () => showLandingTab(tab.key, true));
    landingTabs.appendChild(button);
  }
}

// ----- Hero totals -----

function renderHeroStats() {
  const box = document.getElementById("hero-stats");
  const sum = (list) => landingData.courses.reduce((total, course) => total + list(course), 0);
  const stats = [
    [landingData.courses.length, "course", "courses"],
    [sum((c) => c.topics.filter((t) => t.notes).length), "note", "notes"],
    [sum((c) => c.flashcards.length), "flashcard", "flashcards"],
    [sum((c) => c.questions.length), "question", "questions"],
    [landingData.concepts.length, "concept", "concepts"],
  ];
  for (const [count, one, many] of stats) {
    const stat = createElement("div", "hero-stat");
    stat.appendChild(createElement("span", "hero-stat-number", String(count)));
    stat.appendChild(createElement("span", "hero-stat-label", count === 1 ? one : many));
    box.appendChild(stat);
  }
}

// ----- Courses -----

function courseCounts(course) {
  return {
    notes: course.topics.filter((t) => t.notes).length,
    flashcards: course.flashcards.length,
    questions: course.questions.length,
    concepts: conceptsForCourse(course.id, landingData.concepts).length,
    resources: course.resources.length,
  };
}

function courseCard(course, index, progress, today) {
  const info = course.course;
  const counts = courseCounts(course);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const card = createElement("a", total ? "course-card" : "course-card is-overview-only");
  card.href = courseUrl(course.id);
  card.style.setProperty("--course-color", courseColor(course, index));

  const head = createElement("div", "course-card-head");
  head.appendChild(createElement("span", "course-icon", info.icon || "📘"));
  const titleBox = createElement("div", "course-card-titles");
  titleBox.appendChild(createElement("span", "course-card-title", info.title));
  titleBox.appendChild(createElement("span", "schedule-meta",
    [info.code, info.credits ? `${info.credits} CFU` : "", (info.professors || []).join(", ")].filter(Boolean).join(" · ")));
  head.appendChild(titleBox);
  card.appendChild(head);

  const badges = createElement("div", "course-card-badges");
  const status = teachingStatus(info, today);
  if (status) {
    badges.appendChild(createElement("span", `status-badge status-${status.key}`, status.label));
    if (status.detail) badges.appendChild(createElement("span", "schedule-meta", status.detail));
  } else if (info.teachingPeriod) {
    badges.appendChild(createElement("span", "schedule-meta", info.teachingPeriod));
  }
  const samples = [...course.flashcards, ...course.questions, ...course.resources].some((i) => i.sample);
  if (samples) badges.appendChild(sampleTag());
  card.appendChild(badges);

  if (total) {
    const parts = [
      plural(counts.notes, "note"), plural(counts.flashcards, "flashcard"), plural(counts.questions, "question"),
      plural(counts.concepts, "concept"), plural(counts.resources, "resource"),
    ].filter((text) => !text.startsWith("0 "));
    card.appendChild(createElement("div", "course-card-counts", parts.join(" · ")));
  } else {
    card.appendChild(createElement("div", "course-card-counts is-empty", "Overview only · no student content yet"));
  }

  const mine = courseProgress(progress, course);
  if (mine.total) {
    const row = createElement("div", "course-card-progress");
    row.appendChild(progressBar(mine.percent, `Your progress: ${mine.percent}%`));
    row.appendChild(createElement("span", "schedule-meta", mine.percent ? `${mine.percent}% read` : "Not started"));
    card.appendChild(row);
  }
  return card;
}

function renderCourseList() {
  const progress = loadProgress();
  const today = todayKey();
  const groups = [
    { key: "now", title: "Teaching now" },
    { key: "upcoming", title: "Coming up" },
    { key: "finished", title: "Finished" },
    { key: "other", title: "Other courses" },
  ];
  for (const group of groups) {
    const members = landingData.courses
      .map((course, index) => ({ course, index }))
      .filter(({ course }) => ((teachingStatus(course.course, today) || {}).key || "other") === group.key);
    if (members.length === 0) continue;
    landingContent.appendChild(createElement("h3", "course-group-title", `${group.title} (${members.length})`));
    const list = createElement("div", "course-list");
    for (const { course, index } of members) list.appendChild(courseCard(course, index, progress, today));
    landingContent.appendChild(list);
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
    head.appendChild(saveButton(concept.id));
    card.appendChild(head);
    card.appendChild(renderRichText("p", concept.explanation));
    const where = createElement("p", "schedule-meta", "Appears in: ");
    (concept.topics || []).forEach((topicId, index) => {
      const found = topicById(topicId, landingData);
      if (index > 0) where.appendChild(document.createTextNode(", "));
      const link = createElement("a", null, found ? `${found.course.course.title} › ${found.topic.title}` : topicId);
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
    name.appendChild(createElement("span", "course-icon small", course.course.icon || "📘"));
    name.appendChild(createElement("span", "course-card-title", course.course.title));
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
      if (found.course && found.type !== "course") main.appendChild(createElement("span", "schedule-meta", found.course.course.title));
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
  // Load every notes file once, so notes text can be searched too
  const notesByTopic = {};
  const jobs = [];
  for (const course of landingData.courses) {
    for (const topic of course.topics.filter((t) => t.notes)) {
      jobs.push(loadNotes(course, topic).then((notes) => { if (notes) notesByTopic[topic.id] = notes; }));
    }
  }
  await Promise.all(jobs);
  searchEntries = buildSearchIndex(landingData, notesByTopic);
  for (const entry of searchEntries) entry.courseId = entry.type === "concept" ? "" : courseIdOf(entry.id);
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
      select.appendChild(new Option(course ? course.course.title : id, id));
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
  if (results.length === 0) {
    searchResults.appendChild(createElement("p", "placeholder", "Try fewer or different words. Press Esc to clear the search."));
    return;
  }
  searchResults.appendChild(filterChips(results, query));
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
  landingTabs.hidden = searching;
  landingContent.hidden = searching;
  if (!searching || !landingData) return;

  await ensureSearchIndex();
  if (searchBox.value.trim() !== query) return; // the user kept typing; a newer search will run
  searchFilters.type = "";
  searchFilters.course = "";
  showResults(searchIndex(searchEntries, query), query);
}

let searchTimer = null;
searchBox.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 200); // wait until typing pauses
});

// Keyboard: "/" jumps to search, Esc clears it
document.addEventListener("keydown", (event) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (event.key === "/" && !typing) {
    event.preventDefault();
    searchBox.focus();
  }
  if (event.key === "Escape" && document.activeElement === searchBox) {
    searchBox.value = "";
    runSearch();
    searchBox.blur();
  }
});

// ----- Start -----

async function initLanding() {
  try {
    landingData = await loadAll();
    const slot = document.getElementById("contribute-slot");
    const create = createElement("a", "button button-light", "✎ Create an item");
    create.href = "create.html";
    slot.appendChild(create);
    slot.appendChild(formButton("Contribute", landingData.settings.contributeFormUrl, "button contribute-button"));
    renderHeroStats();
    landingStatus.hidden = true;
    buildLandingTabs();
    showLandingTab(currentLandingTab(), false);
    window.addEventListener("popstate", () => showLandingTab(currentLandingTab(), false));
    if (searchBox.value.trim()) runSearch(); // the browser may restore typed text
  } catch (error) {
    console.error("Could not load notes:", error);
    landingStatus.textContent = "Sorry, Notes & Resources could not be loaded right now. Please try again later.";
  }
}

initLanding();
