// ===== Content checker =====
// Checks every file in content/ before you commit: valid JSON, unique IDs,
// links to topics that exist, notes files present, required fields filled in.
// It reads the files with the same code the website uses (notes-data.js).
//
// Run it with:  node scripts/check-content.js
// "Errors" must be fixed. "Warnings" are worth a look but don't break the site.

const fs = require("fs");
const path = require("path");
const data = require("../notes-data.js");

const ROOT = path.join(__dirname, "..");
const errors = [];
const warnings = [];
const error = (where, message) => errors.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);

// Same "read a file" interface as the website, but from disk; null if missing
async function readFromDisk(relativePath) {
  const full = path.join(ROOT, relativePath);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/; // e.g. "fund-health-economics", "demand-for-care"
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const allIds = new Map(); // id -> where it was defined

function registerId(id, where) {
  if (typeof id !== "string" || !id) {
    error(where, `missing "id"`);
    return false;
  }
  if (allIds.has(id)) {
    error(where, `ID "${id}" is already used in ${allIds.get(id)}. Every ID must be unique.`);
    return false;
  }
  allIds.set(id, where);
  return true;
}

function requireText(item, field, where) {
  if (typeof item[field] !== "string" || !item[field].trim()) error(where, `"${field}" is missing or empty`);
}

function checkDate(value, field, where) {
  if (value === undefined || value === "") return;
  if (typeof value !== "string" || !DATE_PATTERN.test(value) || isNaN(Date.parse(value))) {
    error(where, `"${field}" must be a date like 2026-10-03 (got "${value}")`);
  }
}

function requireList(value, file) {
  if (!Array.isArray(value)) {
    error(file, "must be a list: [ ... ]");
    return [];
  }
  return value;
}

// Checks one type of practice/resource item: ID shape, unique, topic exists
function checkItemId(item, courseId, marker, where) {
  if (!registerId(item.id, where)) return;
  const pattern = new RegExp(`^${courseId}\\.${marker}\\.[a-z0-9-]+$`);
  if (!pattern.test(item.id)) error(where, `ID "${item.id}" should look like "${courseId}.${marker}.001"`);
}

function checkTopicLink(topicId, topicIds, where, required) {
  if (topicId === undefined || topicId === "") {
    if (required) error(where, `"topic" is missing`);
    return;
  }
  if (!topicIds.has(topicId)) error(where, `"topic" points to "${topicId}", which is not in any topics.json`);
}

// Every .json file under content/, so we can check them all for broken JSON first
function allJsonFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return allJsonFiles(full);
    return entry.name.endsWith(".json") ? [full] : [];
  });
}

async function main() {
  // --- Step 1: is every JSON file valid? (A broken file stops the rest from being checked.) ---
  for (const file of allJsonFiles(path.join(ROOT, "content"))) {
    try {
      JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (problem) {
      error(path.relative(ROOT, file).replace(/\\/g, "/"), `is not valid JSON: ${problem.message}. ` +
        "Look for a missing comma, a missing quote, or an extra comma before ] or }.");
    }
  }
  if (errors.length > 0) {
    for (const message of errors) console.log(`  ✖ Error    ${message}`);
    console.log(`\n${errors.length} file(s) with broken JSON. Fix them first, then run the checker again.`);
    process.exit(1);
  }

  // --- settings.json ---
  const settings = await data.readJson(readFromDisk, "content/settings.json", null);
  if (!settings) error("content/settings.json", "file is missing");
  else {
    for (const field of ["contributeFormUrl", "reportErrorFormUrl"]) {
      const url = settings[field];
      if (url && !/^https:\/\//.test(url)) error("content/settings.json", `"${field}" must start with https://`);
      if (!url) warn("content/settings.json", `"${field}" is empty, so the button shows "form coming soon"`);
    }
  }

  // --- courses ---
  const courseIds = requireList(await data.readJson(readFromDisk, "content/courses.json", null) ?? [], "content/courses.json");
  const courses = [];
  for (const courseId of courseIds) {
    const where = `content/courses/${courseId}`;
    if (typeof courseId !== "string" || !ID_PATTERN.test(courseId)) {
      error("content/courses.json", `"${courseId}" is not a valid course ID (lowercase letters, numbers and dashes)`);
      continue;
    }
    registerId(courseId, "content/courses.json");
    const course = await data.loadCourse(courseId, readFromDisk);
    if (!course) {
      error(where, "course.json is missing (every course in courses.json needs a folder with course.json)");
      continue;
    }
    if (course.course.id !== courseId) error(`${where}/course.json`, `"id" is "${course.course.id}" but the folder is "${courseId}"`);
    for (const field of ["title", "code", "description"]) requireText(course.course, field, `${where}/course.json`);
    for (const field of ["officialUrl", "virtualeUrl"]) {
      const url = course.course[field];
      if (url && !/^https:\/\//.test(url)) error(`${where}/course.json`, `"${field}" must start with https://`);
    }
    const { teachingStart, teachingEnd, color, icon } = course.course;
    checkDate(teachingStart, "teachingStart", `${where}/course.json`);
    checkDate(teachingEnd, "teachingEnd", `${where}/course.json`);
    if (Boolean(teachingStart) !== Boolean(teachingEnd)) {
      error(`${where}/course.json`, `give both "teachingStart" and "teachingEnd", or neither`);
    } else if (teachingStart && teachingEnd && teachingStart > teachingEnd) {
      error(`${where}/course.json`, `"teachingStart" (${teachingStart}) is after "teachingEnd" (${teachingEnd})`);
    }
    if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      error(`${where}/course.json`, `"color" must look like "#2e7d32" (got "${color}")`);
    }
    if (icon !== undefined && (typeof icon !== "string" || [...icon].length > 4)) {
      warn(`${where}/course.json`, `"icon" should be a single emoji`);
    }
    courses.push(course);
  }

  // --- topics (first, so everything else can link to them) ---
  const topicIds = new Set();
  for (const course of courses) {
    const file = `${course.folder}topics.json`;
    requireList(course.topics, file).forEach((topic, index) => {
      const where = `${file} (topic ${index + 1})`;
      if (!registerId(topic.id, where)) return;
      if (!new RegExp(`^${course.id}\\.[a-z0-9]+(-[a-z0-9]+)*$`).test(topic.id)) {
        error(where, `ID "${topic.id}" should look like "${course.id}.short-name"`);
      }
      if (/\.(fc|q|r)$/.test(topic.id.split(".").slice(0, 2).join("."))) {
        error(where, `topic names "fc", "q" and "r" are reserved`);
      }
      requireText(topic, "title", where);
      topicIds.add(topic.id);
    });
  }

  // --- notes, practice items, resources ---
  for (const course of courses) {
    for (const topic of course.topics) {
      if (!topic.notes) continue;
      const file = `${course.folder}${topic.notes}`;
      const notes = await data.loadNotes(course, topic, readFromDisk);
      if (!notes) {
        error(`${course.folder}topics.json`, `topic "${topic.id}" points to "${topic.notes}", but that file doesn't exist`);
        continue;
      }
      if (notes.meta.topic !== topic.id) error(file, `front matter "topic" should be "${topic.id}" (got "${notes.meta.topic || ""}")`);
      if (!notes.meta.updated) error(file, `front matter needs "updated: YYYY-MM-DD"`);
      checkDate(notes.meta.updated, "updated", file);
      if (!notes.review) {
        error(file, `needs a "## 5-minute review" section with 5 to 10 bullet points`);
      } else {
        const points = data.reviewPoints(notes.review).length;
        if (points < 5 || points > 10) error(file, `"5-minute review" has ${points} bullet points; it should have 5 to 10`);
      }
      if (!notes.notes) warn(file, "has a review but no notes below it");
    }

    const fcFile = `${course.folder}flashcards.json`;
    requireList(course.flashcards, fcFile).forEach((card, index) => {
      const where = `${fcFile} (card ${index + 1})`;
      checkItemId(card, course.id, "fc", where);
      checkTopicLink(card.topic, topicIds, where, true);
      requireText(card, "front", where);
      requireText(card, "back", where);
    });

    const qFile = `${course.folder}questions.json`;
    requireList(course.questions, qFile).forEach((question, index) => {
      const where = `${qFile} (question ${index + 1})`;
      checkItemId(question, course.id, "q", where);
      checkTopicLink(question.topic, topicIds, where, true);
      requireText(question, "question", where);
      requireText(question, "explanation", where);
      if (!data.QUESTION_TYPES.includes(question.type)) {
        error(where, `"type" must be one of: ${data.QUESTION_TYPES.join(", ")}`);
      }
      if (!data.DIFFICULTIES.includes(question.difficulty)) {
        error(where, `"difficulty" must be one of: ${data.DIFFICULTIES.join(", ")}`);
      }
      if (question.type === "mcq") {
        const options = Array.isArray(question.options) ? question.options : [];
        if (options.length < 2) error(where, `an "mcq" needs "options" with at least 2 answers`);
        const letters = options.map((_, i) => String.fromCharCode(65 + i)); // A, B, C...
        if (!letters.includes(question.answer)) error(where, `"answer" must be one of the option letters: ${letters.join(", ")}`);
      }
      if (question.type === "true-false" && typeof question.answer !== "boolean") {
        error(where, `a "true-false" answer must be true or false (without quotes)`);
      }
      if (question.type === "short-answer") requireText(question, "answer", where);
    });

    const rFile = `${course.folder}resources.json`;
    requireList(course.resources, rFile).forEach((resource, index) => {
      const where = `${rFile} (resource ${index + 1})`;
      checkItemId(resource, course.id, "r", where);
      requireText(resource, "title", where);
      if (!data.RESOURCE_TYPES.includes(resource.type)) error(where, `"type" must be one of: ${data.RESOURCE_TYPES.join(", ")}`);
      if (resource.url && !/^https?:\/\//.test(resource.url)) error(where, `"url" must start with https://`);
      checkDate(resource.date, "date", where);
      checkTopicLink(resource.topic, topicIds, where, false);
    });
  }

  // --- concepts (shared glossary) ---
  const concepts = requireList(await data.readJson(readFromDisk, "content/concepts.json", null) ?? [], "content/concepts.json");
  concepts.forEach((concept, index) => {
    const where = `content/concepts.json (concept ${index + 1})`;
    if (!registerId(concept.id, where)) return;
    if (!/^concept\.[a-z0-9]+(-[a-z0-9]+)*$/.test(concept.id)) error(where, `ID "${concept.id}" should look like "concept.short-name"`);
    requireText(concept, "term", where);
    requireText(concept, "explanation", where);
    const topics = Array.isArray(concept.topics) ? concept.topics : [];
    if (topics.length === 0) warn(where, `"${concept.term}" isn't linked to any topic yet`);
    topics.forEach((topicId) => checkTopicLink(topicId, topicIds, where, true));
  });

  // --- report ---
  const counts = courses.reduce(
    (total, c) => ({
      topics: total.topics + c.topics.length,
      notes: total.notes + c.topics.filter((t) => t.notes).length,
      flashcards: total.flashcards + c.flashcards.length,
      questions: total.questions + c.questions.length,
      resources: total.resources + c.resources.length,
    }),
    { topics: 0, notes: 0, flashcards: 0, questions: 0, resources: 0 }
  );
  console.log(`Checked ${courses.length} courses, ${counts.topics} topics, ${counts.notes} notes, ` +
    `${counts.flashcards} flashcards, ${counts.questions} questions, ${counts.resources} resources, ${concepts.length} concepts.`);
  for (const message of warnings) console.log(`  ⚠ Warning  ${message}`);
  for (const message of errors) console.log(`  ✖ Error    ${message}`);
  if (errors.length > 0) {
    console.log(`\n${errors.length} error(s) found. Please fix them before committing.`);
    process.exit(1);
  }
  console.log("\n✔ No errors. The content is ready.");
}

main().catch((problem) => {
  console.log(`✖ Error    ${problem.message}`);
  process.exit(1);
});
