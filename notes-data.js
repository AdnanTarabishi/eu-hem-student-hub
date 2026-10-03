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

// Loads everything for one course. Missing files simply mean "no items of that type".
async function loadCourse(courseId, read = fetchText) {
  const folder = `${CONTENT_ROOT}courses/${courseId}/`;
  const course = await readJson(read, folder + "course.json", null);
  if (!course) return null;

  const [topics, flashcards, questions, resources] = await Promise.all([
    readJson(read, folder + "topics.json", []),
    readJson(read, folder + "flashcards.json", []),
    readJson(read, folder + "questions.json", []),
    readJson(read, folder + "resources.json", []),
  ]);
  return { id: courseId, folder, course, topics, flashcards, questions, resources };
}

// Loads one topic's notes file, split into front matter, review and notes
async function loadNotes(courseData, topic, read = fetchText) {
  if (!topic.notes) return null;
  const text = await read(courseData.folder + topic.notes);
  if (text === null) return null;
  const { meta, body } = parseFrontMatter(text);
  return { meta, ...splitReview(body) };
}

// Loads settings, the course list, every course and the shared concepts
async function loadAll(read = fetchText) {
  const [settings, courseIds, concepts] = await Promise.all([
    readJson(read, CONTENT_ROOT + "settings.json", {}),
    readJson(read, CONTENT_ROOT + "courses.json", []),
    readJson(read, CONTENT_ROOT + "concepts.json", []),
  ]);
  const courses = (await Promise.all(courseIds.map((id) => loadCourse(id, read)))).filter(Boolean);
  return { settings, courses, concepts };
}

// ----- IDs and links -----
// Every ID starts with its course: "fund-health-economics.fc.001".
// Concepts are shared, so they start with "concept.".

function courseIdOf(itemId) {
  return itemId.split(".")[0];
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
  const courseId = courseIdOf(itemId);
  if (type === "course") return courseUrl(itemId);
  if (type === "topic") return courseUrl(courseId, { tab: "topics", topic: itemId });
  if (type === "flashcard") return courseUrl(courseId, { tab: "practice", card: itemId });
  if (type === "question") return courseUrl(courseId, { tab: "practice", question: itemId }) + "#" + itemId;
  if (type === "resource") return courseUrl(courseId, { tab: "resources" }) + "#" + itemId;
  // A concept opens on the Key Concepts tab of the course of its first topic
  const concept = data && data.concepts.find((c) => c.id === itemId);
  const firstTopic = concept && concept.topics && concept.topics[0];
  if (firstTopic) return courseUrl(courseIdOf(firstTopic), { tab: "concepts" }) + "#" + itemId;
  return "notes.html?tab=concepts#" + itemId;
}

// Finds an item by its ID in loaded data. Returns { type, item, course } or null.
function findItem(itemId, data) {
  const type = itemTypeOf(itemId);
  if (type === "concept") {
    const item = data.concepts.find((c) => c.id === itemId);
    return item ? { type, item, title: item.term, course: null } : null;
  }
  const course = data.courses.find((c) => c.id === courseIdOf(itemId));
  if (!course) return null;
  if (type === "course") return { type, item: course.course, title: course.course.title, course };
  const lists = { topic: course.topics, flashcard: course.flashcards, question: course.questions, resource: course.resources };
  const item = lists[type].find((i) => i.id === itemId);
  if (!item) return null;
  const title = item.title || item.front || item.question;
  return { type, item, title, course };
}

// Topics whose IDs are listed, looked up across all courses
function topicById(topicId, data) {
  const course = data.courses.find((c) => c.id === courseIdOf(topicId));
  const topic = course && course.topics.find((t) => t.id === topicId);
  return topic ? { topic, course } : null;
}

// Concepts that belong to at least one topic of this course
function conceptsForCourse(courseId, concepts) {
  return concepts.filter((c) => (c.topics || []).some((t) => courseIdOf(t) === courseId));
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
    toggleSaved(itemId);
    update();
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

// One entry per searchable item: { id, type, title, text, courseTitle }
function buildSearchIndex(data, notesByTopic) {
  const entries = [];
  for (const course of data.courses) {
    const courseTitle = course.course.title;
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
  for (const entry of entries) entry.searchable = simplify(`${entry.title} ${entry.text}`);
  return entries;
}

// Every word of the query must appear (in any order, ignoring accents and capitals)
function searchIndex(entries, query) {
  const words = simplify(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return entries.filter((entry) => words.every((word) => entry.searchable.includes(word)));
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

// A link button for a form setting. Empty link -> disabled "(form coming soon)" button.
function formButton(label, url, className = "button") {
  const button = createElement("a", className, label);
  if (url) {
    button.href = url;
    button.target = "_blank";
    button.rel = "noopener";
  } else {
    button.textContent = `${label} (form coming soon)`;
    button.setAttribute("aria-disabled", "true");
    button.classList.add("is-disabled");
  }
  return button;
}

function sampleTag() {
  return createElement("span", "sample-tag", "Sample");
}

// Allows the checker (Node.js) to reuse this file. Browsers ignore this part.
if (typeof module !== "undefined") {
  module.exports = {
    CONTENT_ROOT, QUESTION_TYPES, DIFFICULTIES, RESOURCE_TYPES,
    readJson, parseFrontMatter, splitReview, reviewPoints, loadCourse, loadNotes, loadAll,
    courseIdOf, itemTypeOf,
  };
}
