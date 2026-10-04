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

const programmeRules = require("../programme.js");
let courseCount = 0;

function checkUrl(value, field, where) {
  if (value === null || value === undefined || value === "") return;
  if (typeof value !== "string" || !/^https:\/\//.test(value)) error(where, `"${field}" must start with https:// (or be null)`);
}

// Checks content/programme.json - the one shared course data file - and loads the content of
// every module it lists. Returns the modules' content, for the checks below.
async function checkProgramme() {
  const file = "content/programme.json";
  const programme = await data.readJson(readFromDisk, file, null);
  if (!programme) {
    error(file, "file is missing");
    return [];
  }
  if (!Array.isArray(programme.cohorts) || programme.cohorts.length === 0) {
    error(file, `needs at least one cohort in "cohorts"`);
    return [];
  }
  const modules = [];
  const codes = new Map();
  const ids = new Map();
  const unique = (map, key, where, what) => {
    if (map.has(key)) error(where, `${what} "${key}" is used twice (also in ${map.get(key)})`);
    else map.set(key, where);
  };

  for (const cohort of programme.cohorts) {
    const cw = `${file} (cohort ${cohort.id})`;
    requireText(cohort, "id", cw);
    requireText(cohort, "label", cw);
    checkDate(cohort.lastChecked, "lastChecked", cw);
    for (const [name, url] of Object.entries(cohort.sources || {})) checkUrl(url, `sources.${name}`, cw);
    const submission = cohort.studyPlanSubmission || {};
    checkUrl(submission.url, "studyPlanSubmission.url", cw);
    if (submission.deadline) checkDate(submission.deadline, "studyPlanSubmission.deadline", cw);
    else warn(cw, `the study plan submission deadline is still a placeholder ("deadline": null)`);

    for (const term of cohort.terms || []) {
      const tw = `${file} (${cohort.id} / ${term.id})`;
      const cycles = new Map((term.cycles || []).map((c) => [c.id, c]));
      for (const cycle of term.cycles || []) {
        checkDate(cycle.start, "start", `${tw} cycle ${cycle.id}`);
        checkDate(cycle.end, "end", `${tw} cycle ${cycle.id}`);
        if (cycle.start > cycle.end) error(`${tw} cycle ${cycle.id}`, `starts after it ends`);
      }
      const groups = term.groups || [];
      for (const group of groups) {
        const gw = `${tw} group "${group.id}"`;
        if (!["required", "choose-one", "optional"].includes(group.kind)) error(gw, `"kind" must be required, choose-one or optional`);
        for (const code of group.courses || []) {
          if (!(term.courses || []).some((c) => c.code === code)) error(gw, `lists course "${code}", which isn't in this term's courses`);
        }
        if (group.kind === "optional" && (group.min ?? 0) > (group.max ?? Infinity)) error(gw, `"min" is larger than "max"`);
      }

      for (const course of term.courses || []) {
        const where = `${tw} course ${course.code || "?"}`;
        requireText(course, "code", where);
        requireText(course, "name", where);
        if (!ID_PATTERN.test(course.id || "")) error(where, `"id" must use lowercase letters, numbers and dashes`);
        unique(codes, course.code, where, "Code");
        unique(ids, course.id, where, "ID");
        checkUrl(course.officialUrl, "officialUrl", where);
        if (course.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(course.color)) error(where, `"color" must look like "#2e7d32"`);
        const inGroups = groups.filter((g) => (g.courses || []).includes(course.code)).length;
        if (inGroups === 0) error(where, `isn't in any study plan group`);
        if (inGroups > 1) error(where, `is in more than one study plan group`);
        if (!Array.isArray(course.modules) || course.modules.length === 0) {
          error(where, `needs at least one module (a single-module course lists itself as its module)`);
          continue;
        }
        if (course.integrated && course.modules.length < 2) warn(where, `is marked "integrated" but has only one module`);
        const sum = course.modules.reduce((total, m) => total + (m.cfu || 0), 0);
        if (sum !== course.cfu) error(where, `"cfu" is ${course.cfu} but its modules add up to ${sum}`);

        for (const module of course.modules) {
          const mw = `${where} module ${module.code || "?"}`;
          requireText(module, "code", mw);
          requireText(module, "name", mw);
          if (module.code !== course.code) unique(codes, module.code, mw, "Code");
          if (!ID_PATTERN.test(module.id || "")) error(mw, `"id" must use lowercase letters, numbers and dashes`);
          if (module.id !== course.id) unique(ids, module.id, mw, "ID");
          if (!Array.isArray(module.professors)) error(mw, `"professors" must be a list`);
          checkUrl(module.officialUrl, "officialUrl", mw);
          checkUrl(module.virtualeUrl, "virtualeUrl", mw);
          checkDate(module.teachingStart, "teachingStart", mw);
          checkDate(module.teachingEnd, "teachingEnd", mw);
          if (module.teachingStart > module.teachingEnd) error(mw, `teaching starts after it ends`);
          const cycle = cycles.get(module.cycle);
          if (!cycle) {
            error(mw, `"cycle" "${module.cycle}" isn't one of this term's cycles`);
          } else if (module.teachingStart < cycle.start || module.teachingEnd > cycle.end) {
            error(mw, `teaching dates ${module.teachingStart} to ${module.teachingEnd} are outside ${cycle.label} (${cycle.start} to ${cycle.end})`);
          }
          modules.push(await data.loadModuleContent(module, course.id, readFromDisk, false)); // real files, not the index
        }
        courseCount++;
      }

      // Every way of following the rules must add up to the required CFU
      if (groups.length && term.courses) {
        let plans = [programmeRules.emptyChoices(term)];
        for (const group of groups) {
          if (group.kind === "required") continue;
          const options = group.kind === "choose-one" ? group.courses : [[]];
          plans = plans.flatMap((plan) => options.map((option) => ({ ...plan, [group.id]: option })));
        }
        for (const plan of plans) {
          const summary = programmeRules.planSummary(term, plan);
          if (summary.requiredCfu !== term.requiredCfu) {
            error(tw, `the plan ${programmeRules.planKey(term, plan)} adds up to ${summary.requiredCfu} CFU, not the required ${term.requiredCfu}`);
          }
        }
        if (programmeRules.allPlanCombinations(term).length === 0) error(tw, `no valid study plan is possible with these rules`);
      }
    }
  }

  // content/index.json must match the files on disk (pages only load files it lists)
  const { buildIndex } = require("./build-content-index.js");
  const indexPath = path.join(ROOT, "content", "index.json");
  const currentIndex = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8").replace(/\r\n/g, "\n") : "";
  if (currentIndex !== buildIndex()) {
    error("content/index.json", "is out of date (a content file was added or removed). Run: node scripts/build-content-index.js");
  }

  // ?v= stamps on CSS/JS links and the service worker version (see scripts/stamp-versions.js)
  // (skipped in a copy of only the content, which has no site files)
  const hasSite = fs.existsSync(path.join(ROOT, "sw.js")) && fs.existsSync(path.join(__dirname, "stamp-versions.js"));
  const stale = hasSite ? require("./stamp-versions.js").plannedChanges().map((c) => c.file) : [];
  if (stale.length) warn(stale.join(", "), "version stamps are out of date, so visitors may get old files. Run: node scripts/stamp-versions.js");

  // Content folders that no module uses would be invisible on the site
  const folder = path.join(ROOT, "content", "modules");
  if (fs.existsSync(folder)) {
    for (const name of fs.readdirSync(folder)) {
      if (!modules.some((m) => m.id === name)) warn(`content/modules/${name}`, `no module in programme.json has the ID "${name}", so this content isn't shown`);
    }
  }
  return modules;
}

// ----- tracks.json (the Tracks page) -----
// Checks that every reference points to something that exists, required texts are filled in,
// and a few facts from the official 2026 track overview that must never change by accident.
async function checkTracks() {
  const FILE = "content/tracks.json";
  // Skipped in a copy of only the content, which has no site files
  if (!fs.existsSync(path.join(ROOT, "tracks-data.js"))) return;
  const t = require("../tracks-data.js");
  let file;
  try {
    file = await t.loadTracksFile(readFromDisk);
  } catch {
    error(FILE, "file is missing");
    return;
  }
  const cohortIds = new Set();
  for (const cohort of file.cohorts || []) {
    const at = `${FILE} (cohort ${cohort.id})`;
    if (!/^\d{4}-\d{4}$/.test(cohort.id || "")) error(at, `cohort "id" should look like "2026-2028"`);
    if (cohortIds.has(cohort.id)) error(at, "this cohort id is used twice");
    cohortIds.add(cohort.id);

    const universities = cohort.universities || {};
    for (const [id, uni] of Object.entries(universities)) {
      for (const field of ["name", "city", "country", "guide"]) requireText(uni, field, `${at} university "${id}"`);
      if (uni.programmePage) checkUrl(uni.programmePage.url, "programmePage", `${at} university "${id}"`);
      const guideFile = (uni.guide || "").split("?")[0];
      if (guideFile && !fs.existsSync(path.join(ROOT, guideFile))) error(`${at} university "${id}"`, `guide page "${guideFile}" does not exist`);
    }
    const themeIds = new Set((cohort.themes || []).map((th) => th.id));
    const groupIds = new Set((cohort.sectorGroups || []).map((g) => g.id));

    for (const [id, course] of Object.entries(cohort.courses || {})) {
      const where = `${at} course "${id}"`;
      requireText(course, "name", where);
      if (!universities[course.university]) error(where, `unknown university "${course.university}"`);
      if (!Array.isArray(course.themes)) error(where, `"themes" must be a list (it can be empty: [])`);
      for (const theme of course.themes || []) if (!themeIds.has(theme)) error(where, `unknown theme "${theme}"`);
      if ("credits" in course && course.credits !== null && typeof course.credits !== "number") error(where, `"credits" must be a number or null`);
    }

    const trackIds = new Set();
    for (const track of cohort.tracks || []) {
      const where = `${at} track "${track.id}"`;
      if (trackIds.has(track.id)) error(where, "this track id is used twice");
      trackIds.add(track.id);
      for (const field of ["abbr", "name", "letter"]) requireText(track, field, where);
      const numbers = (track.semesters || []).map((s) => s.number).join(",");
      if (numbers !== "2,3") error(where, `needs Semester 2 and Semester 3 (found: ${numbers || "none"})`);
      for (const semester of track.semesters || []) {
        const sw = `${where} semester ${semester.number}`;
        if (!universities[semester.university]) error(sw, `unknown university "${semester.university}"`);
        const used = [...semester.required, ...semester.choices.flatMap((c) => c.options.flat())];
        for (const id of used) {
          const course = cohort.courses[id];
          if (!course) error(sw, `course "${id}" is not in "courses"`);
          else if (course.university !== semester.university) error(sw, `course "${id}" belongs to "${course.university}", not to this semester's university`);
        }
        for (const choice of semester.choices) {
          if (!["elective", "complementary"].includes(choice.kind)) error(sw, `choice "kind" must be "elective" or "complementary"`);
          if (choice.rule !== null && typeof choice.rule !== "string") error(sw, `choice "rule" must be text, or null for "not stated in the source"`);
        }
      }
      if ((track.thesis || []).length !== 2) error(where, `"thesis" must list the 2 universities of the track`);
      for (const uni of track.thesis || []) {
        if (!track.semesters.some((s) => s.university === uni)) error(where, `thesis university "${uni}" is not one of the track's universities`);
      }
      for (const sector of track.sectors || []) if (!groupIds.has(sector.group)) error(where, `sector "${sector.label}" has unknown group "${sector.group}"`);
      for (const page of track.programmePages || []) checkUrl(page.url, "programmePages", where);
      const s = track.student || {};
      for (const field of ["question", "description", "centralQuestion", "overview", "typicalProblem"]) requireText(s, field, `${where} student`);
      if (!Array.isArray(s.fit) || s.fit.length === 0) error(`${where} student`, `"fit" needs at least one statement`);
    }

    // Facts from the official overview that the comparison must show (sanity checks)
    const cell = (trackId, theme) => {
      const track = t.trackById(cohort, trackId);
      return track ? t.themeCell(cohort, track, theme) : null;
    };
    if (cohort.id === "2026-2028") {
      const expect = (trackId, theme, status, text) => {
        const found = cell(trackId, theme);
        if (!found || found.status !== status) error(at, `sanity check failed: ${text} (found: ${found ? found.status : "no track"})`);
      };
      expect("eeh", "evaluation", "required", "Health Technology Assessment must be a required course in EEH");
      expect("phm", "evaluation", "required", "Health Technology Assessment must be a required course in PHM");
      expect("mhi", "evaluation", "required", "Economic Evaluation must be a required course in MHI");
      expect("ep", "evaluation", "elective", "economic evaluation must be elective only in E&P");
      for (const [trackId, courseId] of [["eeh", "eur-hta"], ["phm", "eur-hta"], ["mhi", "mci-economic-evaluation"]]) {
        const track = t.trackById(cohort, trackId);
        if (track && !t.trackCourses(cohort, track).some((c) => c.id === courseId && c.status === "required")) {
          error(at, `sanity check failed: "${courseId}" must be required in ${trackId.toUpperCase()}`);
        }
      }
    }

    // Quiz: every answer gives points to real tracks
    for (const [i, question] of (cohort.quiz?.questions || []).entries()) {
      for (const answer of question.answers) {
        for (const trackId of Object.keys(answer.points)) {
          if (!trackIds.has(trackId)) error(`${at} quiz question ${i + 1}`, `answer "${answer.text}" gives points to unknown track "${trackId}"`);
        }
      }
    }
    // Quiz: the highest possible score must match "maxScore"
    const best = (cohort.quiz?.questions || []).reduce((sum, q) => sum + Math.max(...q.answers.flatMap((a) => Object.values(a.points))), 0);
    if (cohort.quiz && best !== cohort.quiz.maxScore) error(`${at} quiz`, `"maxScore" is ${cohort.quiz.maxScore} but the questions add up to ${best}`);
    for (const page of cohort.sources?.pages || []) checkUrl(page.url, "sources", at);
  }
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

  // --- programme.json (courses, modules, study plan rules) ---
  const modules = await checkProgramme();

  // --- tracks.json (Tracks page) ---
  await checkTracks();

  // --- topics (first, so everything else can link to them) ---
  const topicIds = new Set();
  for (const course of modules) {
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
  for (const course of modules) {
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

      // Images: ![description](images/file.png), relative to the course folder
      for (const match of `${notes.review}\n${notes.notes}`.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) {
        const [, alt, src] = match;
        if (!alt.trim()) error(file, `image "${src}" needs a short description: ![description](${src})`);
        if (/^https?:\/\//.test(src)) {
          warn(file, `image "${src}" is loaded from another website; it's safer to save it in the course's images/ folder`);
          continue;
        }
        const imagePath = path.join(ROOT, course.folder, src);
        if (!fs.existsSync(imagePath)) {
          error(file, `image "${src}" not found (expected at ${course.folder}${src})`);
        } else if (fs.statSync(imagePath).size > 500 * 1024) {
          warn(file, `image "${src}" is larger than 500 KB; it will load slowly on phones`);
        }
      }
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
  const counts = modules.reduce(
    (total, c) => ({
      topics: total.topics + c.topics.length,
      notes: total.notes + c.topics.filter((t) => t.notes).length,
      flashcards: total.flashcards + c.flashcards.length,
      questions: total.questions + c.questions.length,
      resources: total.resources + c.resources.length,
    }),
    { topics: 0, notes: 0, flashcards: 0, questions: 0, resources: 0 }
  );
  console.log(`Checked ${courseCount} courses (${modules.length} modules), ${counts.topics} topics, ${counts.notes} notes, ` +
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
