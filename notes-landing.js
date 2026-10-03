// ===== Notes & Resources landing page =====
// Tabs: Courses · Key concepts · My Study List, plus search across all content.

const landingTabs = document.getElementById("landing-tabs");
const landingStatus = document.getElementById("landing-status");
const landingContent = document.getElementById("landing-content");
const searchBox = document.getElementById("notes-search");
const searchResults = document.getElementById("search-results");

const LANDING_TABS = [
  { key: "courses", label: "Courses" },
  { key: "concepts", label: "Key concepts" },
  { key: "study-list", label: "My Study List" },
];

let landingData = null;
let searchEntries = null; // built the first time someone searches

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
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

function renderCourseList() {
  const list = createElement("div", "course-list");
  for (const course of landingData.courses) {
    const info = course.course;
    const counts = courseCounts(course);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const card = createElement("a", total ? "course-card" : "course-card is-overview-only");
    card.href = courseUrl(course.id);
    const head = createElement("div", "course-card-head");
    head.appendChild(createElement("span", "course-card-title", info.title));
    const samples = [...course.flashcards, ...course.questions, ...course.resources].some((i) => i.sample);
    if (samples) head.appendChild(sampleTag());
    card.appendChild(head);

    const facts = [info.code, info.credits ? `${info.credits} CFU` : "", info.teachingPeriod, (info.professors || []).join(", ")];
    card.appendChild(createElement("div", "schedule-meta", facts.filter(Boolean).join(" · ")));

    if (total) {
      const parts = [
        plural(counts.notes, "note"), plural(counts.flashcards, "flashcard"), plural(counts.questions, "question"),
        plural(counts.concepts, "concept"), plural(counts.resources, "resource"),
      ].filter((text) => !text.startsWith("0 "));
      card.appendChild(createElement("div", "course-card-counts", parts.join(" · ")));
    } else {
      card.appendChild(createElement("div", "course-card-counts is-empty", "Overview only · no student content yet"));
    }
    list.appendChild(card);
  }
  landingContent.appendChild(list);
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
    card.appendChild(createElement("p", null, concept.explanation));
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
  const results = searchIndex(searchEntries, query);

  searchResults.innerHTML = "";
  searchResults.appendChild(createElement("h3", null,
    results.length ? `${plural(results.length, "result")} for "${query}"` : `No results for "${query}"`));
  for (const type of SEARCH_GROUPS) {
    const group = results.filter((r) => r.type === type);
    if (group.length === 0) continue;
    searchResults.appendChild(createElement("h4", "search-group", `${SEARCH_GROUP_LABELS[type]} (${group.length})`));
    const list = createElement("ul", "search-list");
    for (const result of group) {
      const item = createElement("li");
      const link = createElement("a", "search-title", result.title);
      link.href = itemUrl(result.id, landingData);
      item.appendChild(link);
      if (result.courseTitle) item.appendChild(createElement("span", "schedule-meta", ` · ${result.courseTitle}`));
      item.appendChild(createElement("p", "search-snippet", searchSnippet(result, query)));
      list.appendChild(item);
    }
    searchResults.appendChild(list);
  }
}

let searchTimer = null;
searchBox.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 200); // wait until typing pauses
});

// ----- Start -----

async function initLanding() {
  try {
    landingData = await loadAll();
    document.getElementById("contribute-slot").appendChild(
      formButton("Contribute", landingData.settings.contributeFormUrl, "button contribute-button"));
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
