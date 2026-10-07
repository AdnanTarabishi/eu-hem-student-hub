// ===== Notes & Resources: shared data code =====
// Loads the content files in content/ and gives every page the same helpers:
// reading notes (Markdown + front matter), item IDs and links, search, and My Study List.
// The checker (scripts/check-content.js) uses this same file, so it reads content exactly
// like the website does.
//
// The content format is documented in docs/content-format.md.

const CONTENT_ROOT = "content/";

const QUESTION_TYPES = ["mcq", "true-false", "short-answer"];
const DIFFICULTIES = ["easy", "medium", "hard"];
const RESOURCE_TYPES = ["Notes", "Summary", "Book", "Website", "Video", "Exercise", "Cheat sheet"];

// Shown on the page next to each type of item
const TYPE_LABELS = {
  course: "Course",
  topic: "Topic",
  flashcard: "Flashcard",
  question: "Question",
  resource: "Resource",
  concept: "Key concept",
};

// ----- Reading files -----

// Browser version: fetch a file; returns null if it doesn't exist (404)
async function fetchText(path) {
  const response = await fetch(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not load ${path} (HTTP ${response.status})`);
  return response.text();
}

// Reads a JSON file. A missing file gives "fallback"; broken JSON gives a clear error.
async function readJson(read, path, fallback) {
  const text = await read(path);
  if (text === null) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

// Front matter = the small header between "---" lines at the top of a notes file:
//   ---
//   topic: fund-health-economics.demand
//   author: Anonymous
//   ---
// Returns { meta: { topic: "...", author: "..." }, body: "the rest of the file" }
function parseFrontMatter(text) {
  const match = text.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/);
    if (!pair) continue;
    let value = pair[2].replace(/^["']|["']$/g, "");
    if (value === "true") value = true;
    else if (value === "false") value = false;
    meta[pair[1]] = value;
  }
  return { meta, body: match[2] };
}

// Splits a notes body into the "## 5-minute review" section and the rest
function splitReview(body) {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+5-minute review\s*$/i.test(line.trim()));
  if (start === -1) return { review: "", notes: body.trim() };
  let end = lines.findIndex((line, i) => i > start && /^##\s/.test(line));
  if (end === -1) end = lines.length;
  return {
    review: lines.slice(start + 1, end).join("\n").trim(),
    notes: [...lines.slice(0, start), ...lines.slice(end)].join("\n").trim(),
  };
}

// The bullet points in the review ("- ..." or "* ..." lines)
function reviewPoints(review) {
  return review.split(/\r?\n/).filter((line) => /^\s*[-*]\s+\S/.test(line));
}

// Structure: Course -> Module -> Topic.
// Course and module facts come from content/programme.json (the one shared data file).
// Student content for a module lives in content/modules/<module-id>/ (all files optional).

// content/index.json lists which files each module has (built by scripts/build-content-index.js),
// so only existing files are requested. Without it, every file is tried.
let contentIndexPromise = null;
function loadContentIndex(read) {
  contentIndexPromise = contentIndexPromise || readJson(read, CONTENT_ROOT + "index.json", null).catch(() => null);
  return contentIndexPromise;
}

// Loads the student content of one module. Missing files simply mean "no items of that type".
async function loadModuleContent(moduleInfo, courseId, read = fetchText, useIndex = true) {
  const folder = `${CONTENT_ROOT}modules/${moduleInfo.id}/`;
  const index = useIndex ? await loadContentIndex(read) : null;
  const has = (file) => !index || (index.modules[moduleInfo.id] || []).includes(file);
  const load = (file) => (has(file) ? readJson(read, folder + file, []) : Promise.resolve([]));
  const [topics, flashcards, questions, resources] = await Promise.all([
    load("topics.json"), load("flashcards.json"), load("questions.json"), load("resources.json"),
  ]);
  return { id: moduleInfo.id, courseId, folder, info: moduleInfo, topics, flashcards, questions, resources };
}

// Loads one topic's notes file, split into front matter, review and notes
async function loadNotes(moduleData, topic, read = fetchText) {
  if (!topic.notes) return null;
  const text = await read(moduleData.folder + topic.notes);
  if (text === null) return null;
  const { meta, body } = parseFrontMatter(text);
  return { meta, ...splitReview(body) };
}

// Lecture files stay inside the module folder. Reject absolute URLs and traversal.
function isLecturePath(file, extension) {
  return typeof file === "string" && new RegExp(`^lectures/[a-z0-9]+(-[a-z0-9]+)*\\.${extension}$`).test(file);
}

const LECTURE_ACTIVITIES = ["sampling","tiny-population","confidence-interval","event-builder","diagnostic-test","binomial","normal-distribution","uniform-distribution","descriptive-statistics","study-design","hypothesis-test","demand-curve","consumer-surplus","arc-elasticity","full-price","cost-sharing","health-stock","grossman-ppf","mec-equilibrium","grossman-drivers","causal-directions","disparity-theories","stress-depreciation","policy-mechanism","agency-map","pid-forces","physician-payment","practice-variation","fund-descriptive","fund-sampling","fund-table","fund-confidence","fund-proportion-test","fund-two-means","fund-evidence"];

async function loadLecture(moduleData, topic, read = fetchText) {
  if (!isLecturePath(topic.lecture, "json")) throw new Error("Lecture configuration must be a JSON file in the module's lectures folder.");
  const config = await readJson(read, moduleData.folder + topic.lecture, null);
  if (!config) return null;
  if (config.schemaVersion !== 1 || config.topic !== topic.id) throw new Error("Lecture schema or topic ID does not match.");
  if (!isLecturePath(config.guide, "html")) throw new Error("Lecture guide must be an HTML file in the module's lectures folder.");
  if (!Array.isArray(config.activities) || config.activities.some((a) => !LECTURE_ACTIVITIES.includes(a)) || new Set(config.activities).size !== config.activities.length) {
    throw new Error("Lecture activities must be a list of unique supported activity names.");
  }
  for (const field of ["intro", "attribution"]) {
    if (typeof config[field] !== "string" || !config[field].trim()) throw new Error(`Lecture needs ${field}.`);
  }
  return config;
}

function lectureUrl(topicId) {
  return "lecture.html?" + new URLSearchParams({ topic: topicId }).toString();
}

// Loads settings, the programme, every course with its modules' content, and the shared concepts.
// Each course also gets combined lists of all its modules' topics, flashcards, questions, resources.
async function loadAll(read = fetchText) {
  const [settings, programme, concepts] = await Promise.all([
    readJson(read, CONTENT_ROOT + "settings.json", {}),
    loadProgramme(read),
    readJson(read, CONTENT_ROOT + "concepts.json", []),
  ]);
  const cohort = currentCohort(programme);
  const term = currentTerm(programme);
  const courses = await Promise.all(term.courses.map(async (info) => {
    const modules = await Promise.all(info.modules.map((m) => loadModuleContent(m, info.id, read)));
    const all = (list) => modules.flatMap((m) => m[list]);
    return {
      id: info.id, code: info.code, info, group: groupOfCourse(term, info.code), modules,
      topics: all("topics"), flashcards: all("flashcards"), questions: all("questions"), resources: all("resources"),
    };
  }));
  const modules = courses.flatMap((c) => c.modules);
  return { settings, programme, index: programmeIndex(programme), cohort, term, courses, modules, concepts };
}

// ----- IDs and links -----
// Every item ID starts with its MODULE: "fund-health-economics.fc.001".
// Concepts are shared, so they start with "concept.". Course IDs have no dot.

function moduleIdOf(itemId) {
  return itemId.split(".")[0];
}

// The course an item belongs to. Also accepts a course ID, or a module ID (old links).
function courseIdOf(itemId, data) {
  const first = moduleIdOf(itemId);
  if (data.courses.some((c) => c.id === first)) return first;
  const module = data.modules.find((m) => m.id === first);
  return module ? module.courseId : first;
}

function moduleById(moduleId, data) {
  return data.modules.find((m) => m.id === moduleId) || null;
}

function itemTypeOf(itemId) {
  if (itemId.startsWith("concept.")) return "concept";
  if (!itemId.includes(".")) return "course";
  if (itemId.includes(".fc.")) return "flashcard";
  if (itemId.includes(".q.")) return "question";
  if (itemId.includes(".r.")) return "resource";
  return "topic";
}

function courseUrl(courseId, params = {}) {
  const query = new URLSearchParams({ course: courseId, ...params });
  return "course.html?" + query.toString();
}

// The address that opens an item on its page
function itemUrl(itemId, data) {
  const type = itemTypeOf(itemId);
  if (type === "concept") {
    // A concept opens on the Key Concepts tab of the course of its first topic
    const concept = data && data.concepts.find((c) => c.id === itemId);
    const firstTopic = concept && concept.topics && concept.topics[0];
    if (firstTopic) return courseUrl(courseIdOf(firstTopic, data), { tab: "concepts" }) + "#" + itemId;
    return "notes.html?tab=concepts#" + itemId;
  }
  const courseId = courseIdOf(itemId, data);
  if (type === "course") return courseUrl(courseId);
  if (type === "topic") {
    const found = data && topicById(itemId, data);
    return found && found.topic.lecture ? lectureUrl(itemId) : courseUrl(courseId, { tab: "topics", topic: itemId });
  }
  if (type === "flashcard") return courseUrl(courseId, { tab: "practice", card: itemId });
  if (type === "question") return courseUrl(courseId, { tab: "practice", question: itemId }) + "#" + itemId;
  return courseUrl(courseId, { tab: "resources" }) + "#" + itemId;
}

// Finds an item by its ID in loaded data. Returns { type, item, title, course, module } or null.
function findItem(itemId, data) {
  const type = itemTypeOf(itemId);
  if (type === "concept") {
    const item = data.concepts.find((c) => c.id === itemId);
    return item ? { type, item, title: item.term, course: null, module: null } : null;
  }
  const course = data.courses.find((c) => c.id === courseIdOf(itemId, data));
  if (!course) return null;
  if (type === "course") return { type, item: course.info, title: course.info.name, course, module: null };
  const module = moduleById(moduleIdOf(itemId), data);
  if (!module) return null;
  const lists = { topic: module.topics, flashcard: module.flashcards, question: module.questions, resource: module.resources };
  const item = lists[type].find((i) => i.id === itemId);
  if (!item) return null;
  return { type, item, title: item.title || item.front || item.question, course, module };
}

// A topic, with its module and course
function topicById(topicId, data) {
  const module = moduleById(moduleIdOf(topicId), data);
  const topic = module && module.topics.find((t) => t.id === topicId);
  if (!topic) return null;
  return { topic, module, course: data.courses.find((c) => c.id === module.courseId) };
}

// Concepts that belong to at least one topic of this course (any of its modules)
function conceptsForCourse(course, concepts) {
  const moduleIds = course.modules.map((m) => m.id);
  return concepts.filter((c) => (c.topics || []).some((t) => moduleIds.includes(moduleIdOf(t))));
}

// ----- Course colour and teaching status -----

// Used when a course has no "color" in programme.json
const COURSE_PALETTE = ["#1f6fb2", "#2e7d32", "#6a1b9a", "#ef6c00", "#00838f", "#ad1457", "#5d4037", "#3949ab"];

function courseColor(course, index) {
  const color = course.info.color;
  return /^#[0-9a-fA-F]{6}$/.test(color || "") ? color : COURSE_PALETTE[index % COURSE_PALETTE.length];
}

// "Teaching now" / "Coming up" / "Finished", from teachingStart/teachingEnd and today's date
function teachingStatus(info, today) {
  const start = info.teachingStart;
  const end = info.teachingEnd;
  if (!start || !end) return null;
  const inDays = (n, what) => (n === 0 ? `${what} today` : n === 1 ? `${what} tomorrow` : `${what} in ${n} days`);
  if (today < start) return { key: "upcoming", label: "Coming up", detail: inDays(daysBetween(today, start), "starts") };
  if (today > end) return { key: "finished", label: "Finished", detail: "" };
  return { key: "now", label: "Teaching now", detail: inDays(daysBetween(today, end), "ends") };
}

// ----- My Study List (bookmarks) -----
// Saved in this browser only (localStorage), as a list of { id, savedAt }.

const STUDY_LIST_KEY = "euhem-study-list";

function getStudyList() {
  const list = readStorage(STUDY_LIST_KEY, []);
  return Array.isArray(list) ? list.filter((entry) => entry && typeof entry.id === "string") : [];
}

function isSaved(itemId) {
  return getStudyList().some((entry) => entry.id === itemId);
}

// Adds the item if it isn't saved yet, removes it if it is. Returns true if it's now saved.
function toggleSaved(itemId) {
  const list = getStudyList();
  const saved = list.some((entry) => entry.id === itemId);
  const updated = saved ? list.filter((entry) => entry.id !== itemId) : [...list, { id: itemId, savedAt: new Date().toISOString() }];
  writeStorage(STUDY_LIST_KEY, updated);
  return !saved;
}

// A ☆ button that saves / removes an item
function saveButton(itemId) {
  const button = createElement("button", "save-button");
  button.type = "button";
  const update = () => {
    const saved = isSaved(itemId);
    button.textContent = saved ? "★ Saved" : "☆ Save";
    button.setAttribute("aria-pressed", String(saved));
    button.title = saved ? "Remove from My Study List" : "Add to My Study List";
  };
  button.addEventListener("click", () => {
    const saved = toggleSaved(itemId);
    update();
    if (typeof toast === "function") toast(saved ? "Saved to My Study List ✓" : "Removed from My Study List");
  });
  update();
  return button;
}

// ----- Search -----

// Removes Markdown symbols so notes can be searched as plain text
function markdownToPlainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// One entry per searchable item: { id, type, title, text, courseTitle, courseId }
function buildSearchIndex(data, notesByTopic) {
  const entries = [];
  for (const course of data.courses) {
    const courseTitle = course.info.name;
    for (const topic of course.topics) {
      const notes = notesByTopic[topic.id];
      if (!notes) continue; // only topics with notes are searchable content
      entries.push({ id: topic.id, type: "topic", title: topic.title, courseTitle,
        text: markdownToPlainText(`${notes.review} ${notes.notes}`) });
    }
    for (const card of course.flashcards) {
      entries.push({ id: card.id, type: "flashcard", title: card.front, courseTitle, text: card.back });
    }
    for (const question of course.questions) {
      entries.push({ id: question.id, type: "question", title: question.question, courseTitle,
        text: `${(question.options || []).join(" ")} ${question.explanation || ""}` });
    }
    for (const resource of course.resources) {
      entries.push({ id: resource.id, type: "resource", title: resource.title, courseTitle,
        text: `${resource.type} ${resource.description || ""}` });
    }
  }
  for (const concept of data.concepts) {
    entries.push({ id: concept.id, type: "concept", title: concept.term, courseTitle: "", text: concept.explanation });
  }
  for (const entry of entries) {
    entry.searchable = simplify(`${entry.title} ${entry.text}`);
    entry.courseId = entry.type === "concept" ? "" : courseIdOf(entry.id, data);
  }
  return entries;
}

// Every word of the query must appear (in any order, ignoring accents and capitals)
function searchIndex(entries, query) {
  const words = simplify(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return entries.filter((entry) => words.every((word) => entry.searchable.includes(word)));
}

// Wraps the matching words of "text" in <mark>, safely (no HTML is built from text).
// Matching ignores accents and capitals, like the search itself.
function highlightMatches(text, query) {
  const fragment = document.createDocumentFragment();
  const words = simplify(query).split(/\s+/).filter(Boolean);
  // Simplified version of the text + where each simplified letter came from in the original
  let simple = "";
  const origin = [];
  for (let i = 0; i < text.length; i++) {
    const s = simplify(text[i]);
    for (let k = 0; k < s.length; k++) {
      simple += s[k];
      origin.push(i);
    }
  }
  const marked = new Array(text.length).fill(false);
  for (const word of words) {
    let at = simple.indexOf(word);
    while (at !== -1) {
      for (let k = at; k < at + word.length; k++) marked[origin[k]] = true;
      at = simple.indexOf(word, at + word.length);
    }
  }
  let i = 0;
  while (i < text.length) {
    let j = i;
    while (j < text.length && marked[j] === marked[i]) j++;
    const piece = text.slice(i, j);
    fragment.appendChild(marked[i] ? createElement("mark", null, piece) : document.createTextNode(piece));
    i = j;
  }
  return fragment;
}

// A short piece of text around the first matching word
function searchSnippet(entry, query) {
  const word = simplify(query).split(/\s+/).filter(Boolean)[0] || "";
  const plain = entry.text;
  const index = simplify(plain).indexOf(word);
  if (index === -1) return plain.slice(0, 140) + (plain.length > 140 ? "…" : "");
  const start = Math.max(0, index - 60);
  return (start > 0 ? "…" : "") + plain.slice(start, start + 160) + (start + 160 < plain.length ? "…" : "");
}

// ----- Small shared page helpers -----

// A link button for a form setting. Empty link -> the Contact page, so the button always leads somewhere.
function formButton(label, url, className = "button") {
  const button = createElement("a", className, label);
  if (url) {
    button.href = url;
    button.target = "_blank";
    button.rel = "noopener";
  } else {
    button.href = "contact.html";
    button.title = "Send it through the Contact page";
  }
  return button;
}

function sampleTag() {
  return createElement("span", "sample-tag", "Sample");
}

// Allows the checker (Node.js) to reuse this file. Browsers ignore this part.
// In Node, the programme helpers (loadProgramme, currentTerm, ...) come from programme.js.
if (typeof module !== "undefined") {
  const programmeHelpers = require("./programme.js");
  for (const [name, value] of Object.entries(programmeHelpers)) {
    if (typeof globalThis[name] === "undefined") globalThis[name] = value;
  }
  module.exports = {
    CONTENT_ROOT, QUESTION_TYPES, DIFFICULTIES, RESOURCE_TYPES,
    readJson, parseFrontMatter, splitReview, reviewPoints, loadModuleContent, loadNotes, loadAll,
    isLecturePath, LECTURE_ACTIVITIES, loadLecture, lectureUrl,
    moduleIdOf, courseIdOf, itemTypeOf, teachingStatus,
  };
}
