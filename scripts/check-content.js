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
    else if (submission.noDeadline) {
      // "No deadline" is a real answer only with the official page that says so
      if (!submission.deadlineSource) error(cw, `"noDeadline": true needs a "deadlineSource" (the official page saying so)`);
      else checkUrl(submission.deadlineSource, "studyPlanSubmission.deadlineSource", cw);
    } else warn(cw, `the study plan submission deadline is still a placeholder ("deadline": null)`);

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

// ----- Thesis archive (thesis.html) -----
// thesis-archive.json is generated by scripts/import-thesis.js; thesis-config.json and
// thesis-overrides.json are edited by hand. Checks they fit together.
// ----- Join the Directory (join.html, directory-config.js, the Apps Script backend) -----
// Real personal data goes through this form, so a few things must always hold:
// - the consent version is the same in the page and in the backend (it changes when the privacy text does)
// - the endpoint is empty or a Google Apps Script /exec address (nothing else may receive the data)
// - the form cannot be switched on while the Contact page still has no way to reach us
// - no Google Sheet or Drive folder ID is ever written in these files (they live in Script Properties)
// City guides (list in guide-data.js, rules in docs/city-guides.md):
// - every guide belongs to a university of tracks.json, and the university's "guide" link matches
// - a guide with a facts block has all facts, the 16 sections in order, each filled in (Student tips
//   may stay empty), and EU/EEA and non-EU parts in "Residence and registration" and "Healthcare"
// - every line with a price (NOK, EUR, €, kr and a number) has a source tag like [S12], every tag is listed in
//   Sources, and every source has a title, an https address and a "checked" date
// - tracks are never typed in a guide: guide.js takes them from tracks.json
// - every photo is a local file with alt text and a caption crediting the photographer, licence and source
// - the disclaimer and the "Report something outdated" link are in the template (guide.js)
function checkCityGuides() {
  const G = "guide-data.js";
  if (!fs.existsSync(path.join(ROOT, G))) return;
  const guides = require("../guide-data.js");
  const tracksFile = JSON.parse(fs.readFileSync(path.join(ROOT, "content/tracks.json"), "utf8"));
  const cohort = tracksFile.cohorts[tracksFile.cohorts.length - 1];
  const today = new Date().toISOString().slice(0, 10);

  const template = fs.readFileSync(path.join(ROOT, "guide.js"), "utf8");
  for (const text of ["This is a student-made summary, not legal advice. Rules change. The official pages linked here are authoritative.",
    "Follow those first.", "Report something outdated"]) {
    if (!template.includes(text)) error("guide.js", `the text "${text}" must be on every guide page`);
  }

  for (const id of Object.keys(cohort.universities)) {
    if (!guides.CITY_GUIDES.some((g) => g.university === id)) error(G, `university "${id}" in tracks.json has no city in CITY_GUIDES`);
  }
  const trackNames = cohort.tracks.map((t) => t.abbr);

  for (const guide of guides.CITY_GUIDES) {
    const university = cohort.universities[guide.university];
    if (!university) {
      error(G, `city "${guide.id}": university "${guide.university}" is not in content/tracks.json`);
      continue;
    }
    if (university.guide !== `city-guide.html?city=${guide.id}`) {
      error("content/tracks.json", `university "${guide.university}": "guide" should be "city-guide.html?city=${guide.id}"`);
    }
    if (guide.cover) {
      const at = `${G}: cover of "${guide.id}"`;
      for (const size of [640, 1200]) {
        if (!fs.existsSync(path.join(ROOT, `${guide.cover.image}-${size}.webp`))) error(at, `"${guide.cover.image}-${size}.webp" does not exist`);
      }
      if (!guide.cover.alt) error(at, "needs alt text");
      const aiCover = /\/ai-[^/]*$/.test(guide.cover.image);
      if (aiCover && !/^AI-generated illustration/.test(guide.cover.alt || "")) error(at, 'an AI cover\'s alt text must start with "AI-generated illustration"');
      if (!aiCover && !/^Photo: .+, (CC|Public domain)/.test(guide.cover.credit || "")) error(at, 'credit must look like "Photo: <name>, CC BY-SA 4.0"');
    }
    if (!guide.file) continue;
    const where = guide.file;
    if (!fs.existsSync(path.join(ROOT, guide.file))) {
      error(G, `city "${guide.id}": file "${guide.file}" does not exist`);
      continue;
    }
    const text = fs.readFileSync(path.join(ROOT, guide.file), "utf8").replace(/\r\n/g, "\n");
    const parsed = guides.parseGuide(text);
    if (!parsed.structured) {
      error(where, "no facts block at the top (see docs/city-guides.md)");
      continue;
    }

    // Facts
    for (const key of guides.GUIDE_REQUIRED_FACTS) {
      if (!parsed.facts[key]) error(where, `fact "${key}" is missing or empty in the block at the top`);
    }
    if (parsed.facts.university && parsed.facts.university !== guide.university) {
      error(where, `"university: ${parsed.facts.university}" but guide-data.js says "${guide.university}"`);
    }
    const checked = parsed.facts["last-checked"];
    if (checked && (!DATE_PATTERN.test(checked) || isNaN(Date.parse(checked)))) error(where, `"last-checked" must be a date like 2026-10-05`);
    else if (checked > today) error(where, `"last-checked" (${checked}) is in the future`);

    // Sections
    const sections = guides.guideSections(parsed.body);
    const expected = guides.GUIDE_SECTIONS.map((title, i) => `${i + 1}. ${title}`);
    const found = sections.map((s) => s.heading);
    if (found.join("|") !== expected.join("|")) {
      const firstWrong = expected.findIndex((heading, i) => found[i] !== heading);
      error(where, `sections must be exactly "## 1. At a glance" … "## 16. Sources" in order; ` +
        `expected "## ${expected[firstWrong]}" but found "${found[firstWrong] ? "## " + found[firstWrong] : "nothing"}"`);
    }
    for (const section of sections) {
      const content = section.text.replace(/<!--[\s\S]*?-->/g, "").trim();
      if (!content && !["At a glance", "Student tips"].includes(section.title)) {
        error(where, `section "${section.heading}" is empty: write it, or write "Not verified. Check the official page: <link>"`);
      }
      if (["Residence and registration", "Healthcare"].includes(section.title)) {
        const subheadings = (section.text.match(/^### .*$/gm) || []).join("\n");
        if (!/EU\/EEA/.test(subheadings)) error(where, `section "${section.heading}" needs a "### EU/EEA students" part`);
        if (!/non-EU/i.test(subheadings)) error(where, `section "${section.heading}" needs a "### Non-EU students" part`);
      }
    }

    // Photos: a local file, a description for screen readers, and the credit the licence asks for.
    // AI-generated pictures are allowed only when labelled: <figure class="is-ai">, an alt text and a
    // caption that say "AI-generated illustration", and an image file name starting with "ai-".
    const figures = parsed.body.match(/<figure[^>]*>[\s\S]*?<\/figure>/g) || [];
    for (const figure of figures) {
      const isAi = /^<figure class="is-ai">/.test(figure);
      const named = (figure.match(/<img[^>]*\ssrc="([^"]+)"/) || [])[1] || "";
      if (isAi !== /\/ai-[^/]*$/.test(named)) error(`${where}: "${named}"`, 'AI images are named "ai-…" and marked <figure class="is-ai">, real photos neither');
      if (isAi) {
        const aiAlt = (figure.match(/<img[^>]*\salt="([^"]*)"/) || [])[1] || "";
        if (!/^AI-generated illustration/.test(aiAlt)) error(`${where}: "${named}"`, 'alt text must start with "AI-generated illustration"');
        if (!/AI-generated illustration, not a photo/.test(figure)) error(`${where}: "${named}"`, 'caption must say "AI-generated illustration, not a photo"');
        if (!fs.existsSync(path.join(ROOT, named))) error(`${where}: "${named}"`, "the image file does not exist");
        continue;
      }
      const src = (figure.match(/<img[^>]*\ssrc="([^"]+)"/) || [])[1];
      const alt = (figure.match(/<img[^>]*\salt="([^"]*)"/) || [])[1];
      const caption = (figure.match(/<figcaption>([\s\S]*?)<\/figcaption>/) || [])[1] || "";
      const at = `${where}: photo "${src || "?"}"`;
      if (!src || !fs.existsSync(path.join(ROOT, src))) error(at, "the image file does not exist");
      for (const file of [...figure.matchAll(/([\w./-]+\.(?:webp|jpg|jpeg|png))\s+\d+w/g)].map((m) => m[1])) {
        if (!fs.existsSync(path.join(ROOT, file))) error(at, `srcset file "${file}" does not exist`);
      }
      if (!alt || !alt.trim()) error(at, "needs alt text describing the photo");
      if (!/Photo: /.test(caption)) error(at, 'the caption needs "Photo: <photographer>"');
      if (!/creativecommons\.org\/|[Pp]ublic domain/.test(caption)) error(at, "the caption needs the licence (with its link)");
      if (!/<a href="https:\/\/[^"]+">/.test(caption)) error(at, "the caption needs a link to the photo's source page");
    }
    if (/<img/.test(parsed.body.replace(/<figure[^>]*>[\s\S]*?<\/figure>/g, ""))) error(where, "every photo must be inside <figure> with a <figcaption> credit");

    // Prices need a source; sources must be listed and well formed
    const lines = text.split("\n");
    const used = new Set();
    const defined = new Map();
    let inSources = false;
    lines.forEach((line, i) => {
      const at = `${where}:${i + 1}`;
      if (/^## /.test(line)) inSources = /Sources\s*$/.test(line);
      if (inSources) {
        if (!line.trim() || /^## /.test(line)) return;
        const source = line.match(/^- \[(S\d+)\] (.+?) — (\S+) — checked (\d{4}-\d{2}-\d{2})$/);
        if (!source) return error(at, `a source must look like "- [S1] Title — https://… — checked 2026-10-05"`);
        const [, tag, , url, date] = source;
        if (defined.has(tag)) error(at, `source ${tag} is listed twice`);
        defined.set(tag, i + 1);
        if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(url)) error(at, `source ${tag}: "${url}" is not a well-formed https address`);
        if (isNaN(Date.parse(date)) || date > today) error(at, `source ${tag}: "checked ${date}" is not a valid past date`);
        return;
      }
      for (const tag of guides.sourceTags(line)) used.add(tag);
      const markers = checkSourceMarkers(line, at);
      if (/\b(NOK|EUR|kr)\b|€/.test(line) && /\d/.test(line) && !guides.sourceTags(line).length && !markers) {
        error(at, `a price without a source tag like [S12] or {tip:source-id}: "${line.trim().slice(0, 70)}"`);
      }
      const track = trackNames.find((name) => new RegExp(`(^|[^\\w&])${name.replace("&", "\\&")}([^\\w&]|$)`).test(line));
      if (track && !line.startsWith("<!--")) {
        error(at, `"${track}": don't type tracks in a guide; the page shows them from content/tracks.json`);
      }
    });
    for (const tag of used) if (!defined.has(tag)) error(where, `source tag [${tag}] is used but not listed in "16. Sources"`);
    for (const [tag, line] of defined) if (!used.has(tag)) warn(`${where}:${line}`, `source ${tag} is listed but never used`);
  }
}

function checkDirectory() {
  const C = "directory-config.js";
  const G = "integrations/directory-apps-script/Code.gs";
  const read = (file) => (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), "utf8") : null);
  const configText = read(C);
  const code = read(G);
  if (configText === null) return; // no directory on this site
  if (code === null) return error(G, "is missing (the backend code belongs in the repository)");

  // Read the settings the same way the browser does
  const sandbox = { window: {} };
  try {
    require("vm").runInNewContext(configText, sandbox);
  } catch (e) {
    return error(C, `cannot be read: ${e.message}`);
  }
  const config = sandbox.window.EUHEM_DIRECTORY_CONFIG || {};

  const backendVersion = (code.match(/CONSENT_VERSION:\s*'([^']+)'/) || [])[1];
  if (!config.consentVersion || config.consentVersion !== backendVersion) {
    error(C, `consentVersion "${config.consentVersion}" must equal CONSENT_VERSION "${backendVersion}" in ${G}. Change both when the privacy text changes meaning (docs/student-directory.md)`);
  }

  const endpoint = String(config.endpoint || "").trim();
  if (endpoint && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)) {
    error(C, `endpoint must be empty or a Google Apps Script address ending in /exec, not "${endpoint}"`);
  }
  const contact = read("contact.html") || "";
  const privacy = read("privacy.html") || "";
  if (endpoint && /\[Placeholder:/.test(contact + privacy)) {
    error(C, "the form is switched on (endpoint set) but contact.html or privacy.html still has a placeholder: people must be able to ask us to change or delete their profile");
  } else if (!endpoint) {
    warn(C, "endpoint is empty, so the Join the Directory form says it is not open yet");
  }

  // Sheet and Drive folder IDs are long random strings; they must only ever be Script Properties
  const idLike = /docs\.google\.com\/spreadsheets\/d\/|drive\.google\.com\/drive\/folders\/|\b1[A-Za-z0-9_-]{32,43}\b/;
  for (const file of [C, "join.html", "join.js", "directory-options.js", G, "integrations/directory-apps-script/README.md"]) {
    const text = read(file);
    if (text && idLike.test(text)) error(file, "contains what looks like a Google Sheet or Drive folder ID. IDs belong only in the Apps Script's Script Properties, never in the repository");
  }

  // Production needs a real way to reach us: a mailto link on the Contact page
  if (endpoint && !/href="mailto:[^"@]+@[^"]+"/.test(contact)) {
    error("contact.html", "the form is switched on but the Contact page has no email (mailto) link");
  }

  // Onboarding v2 accepts any email domain: nothing may still say only @studio.unibo.it is allowed
  if (/allowedEmailDomains/.test(configText + (read("join.js") || ""))) {
    error(C, "allowedEmailDomains is from onboarding v1; the domain restriction was removed (docs/student-directory.md)");
  }
  if (/an @studio\.unibo\.it address|only @studio\.unibo\.it/i.test(privacy)) {
    error("privacy.html", "still says registration needs an @studio.unibo.it address; onboarding v2 accepts any email");
  }

  // The backend must have every column onboarding v2 writes, after the 41 columns of v1
  const headers = (code.match(/const HEADERS = Object\.freeze\(\[([\s\S]*?)\]\);/) || [])[1] || "";
  const listed = [...headers.matchAll(/'((?:[^'\\]|\\.)*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
  const v2 = ["User Type", "Directory Eligible", "EU-HEM Cohort", "Home Institution", "Home Programme", "Programme Role",
    "Courses / Areas Involved", "Shared Courses", "Feature Interests", "Feature Suggestion", "Role Verification Status", "Role Verified At",
    "Rejected At", "Last Reconfirmed At", "Participation Ends"];
  if (listed[0] !== "Submission ID" || listed[40] !== "Confirm Email Sent") error(G, "the first 41 columns (onboarding v1) must keep their order");
  for (const h of v2) if (!listed.includes(h)) error(G, `HEADERS is missing the column "${h}"`);
  const v3 = ["Citizenship Group", "Citizenship Visibility", "Study Visa Experience", "Study Visa Experience Scope",
    "Study Visa Experience Visibility", "Mobility Statistics Consent", "Field Visibility JSON"];
  for (const h of v3) if (!listed.includes(h)) error(G, `HEADERS is missing the v3 column "${h}"`);
  const doubled = listed.filter((h, i) => listed.indexOf(h) !== i);
  if (doubled.length) error(G, `HEADERS lists a column twice: ${doubled.join(", ")}`);

  // The form's choices and privacy rules must be exactly the backend's (the backend enforces them)
  const options = read("directory-options.js");
  if (options === null) return error("directory-options.js", "is missing (the form's choices)");
  let backend, frontend;
  try {
    const box = {};
    require("vm").runInNewContext(`${code}\n;this.__options = OPTIONS; this.__rules = VIS_RULES; this.__retention = RETENTION;`, box);
    backend = { OPTIONS: box.__options, VIS_RULES: box.__rules, RETENTION: box.__retention };
    const page = { window: {} };
    require("vm").runInNewContext(options, page);
    frontend = page.window.EUHEM_DIRECTORY_OPTIONS;
  } catch (e) {
    return error(G, `could not compare the form's options with the backend: ${e.message}`);
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const key of Object.keys(backend.OPTIONS)) {
    if (!same(backend.OPTIONS[key], frontend.OPTIONS[key])) error("directory-options.js", `OPTIONS.${key} differs from ${G}`);
  }
  if (!same(backend.VIS_RULES, frontend.VIS_RULES)) error("directory-options.js", `VIS_RULES differ from ${G}: the form and the server would apply different privacy limits`);
  for (const [profile, rules] of Object.entries(backend.VIS_RULES)) {
    if (rules.email.includes("public")) error(G, `VIS_RULES.${profile}: the email can never be public`);
    for (const kind of Object.keys(rules)) {
      if (profile !== "public" && rules[kind].includes("public")) error(G, `VIS_RULES.${profile}.${kind}: only a public profile may have public details`);
      if (profile === "hidden" && rules[kind].some((v) => v !== "hidden")) error(G, `VIS_RULES.hidden.${kind}: a hidden profile shows nothing`);
    }
  }
  // Citizenship and study-visa answers are never public: their only choices are private / members
  if (!same(Object.keys(backend.OPTIONS.mobilityVisibility || {}), ["private", "cohort"])) {
    error(G, "OPTIONS.mobilityVisibility must be exactly private and cohort (citizenship and visa answers are never public)");
  }
  for (const id of ["current_student", "alumni"]) if (backend.OPTIONS.directoryEligible[id] !== true) error(G, `${id} must be directory eligible`);
  for (const id of ["shared_course_student", "faculty_staff"]) if (backend.OPTIONS.directoryEligible[id] !== false) error(G, `${id} must not be directory eligible`);
  for (const id of Object.values(frontend.FIELD_GROUPS || []).flatMap((g) => g.ids)) {
    if (!backend.OPTIONS.academicFields[id]) error("directory-options.js", `FIELD_GROUPS lists an unknown academic field "${id}"`);
  }

  // Retention periods: RETENTION in Code.gs is the source; the privacy page and the docs table must agree
  const retention = backend.RETENTION || {};
  const shownOnPage = [...privacy.matchAll(/<span data-retention="(\w+)">\s*([\d-]+)/g)];
  if (!shownOnPage.length) error("privacy.html", "shows no retention periods (data-retention spans)");
  for (const [, key, value] of shownOnPage) {
    if (!(key in retention)) error("privacy.html", `data-retention="${key}" is not a key of RETENTION in ${G}`);
    else if (String(retention[key]) !== value) error("privacy.html", `retention "${key}" says ${value}, but RETENTION.${key} in ${G} is ${retention[key]}`);
  }
  const docs = read("docs/student-directory.md") || "";
  for (const key of Object.keys(retention)) {
    const row = docs.match(new RegExp("\\|\\s*`" + key + "`\\s*\\|\\s*([^|]+?)\\s*\\|"));
    if (!row) error("docs/student-directory.md", `the retention table has no row for "${key}"`);
    else if (row[1] !== String(retention[key])) error("docs/student-directory.md", `retention "${key}" says ${row[1]}, but RETENTION.${key} in ${G} is ${retention[key]}`);
  }

  // Current track names: content/tracks.json is the source for the whole site
  const tracksFile = JSON.parse(read("content/tracks.json") || "{}");
  const cohort = (tracksFile.cohorts || []).at(-1);
  for (const track of (cohort && cohort.tracks) || []) {
    if (backend.OPTIONS.currentTracks[track.id] !== track.name) {
      error(G, `OPTIONS.currentTracks.${track.id} should be "${track.name}" as in content/tracks.json`);
    }
  }
}

// Students explorer: demo data only, never a private export (docs/students-explorer.md)
function checkStudents() {
  const read = (file) => (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), "utf8") : null);
  const C = "students-config.js";
  const configText = read(C);
  if (configText === null) return;
  const box = { window: { EUHEM_DIRECTORY_CONFIG: { cohorts: { current: ["x"] } } } };
  try {
    require("vm").runInNewContext(configText, box);
  } catch (e) {
    return error(C, `cannot be read: ${e.message}`);
  }
  const config = box.window.EUHEM_STUDENTS_CONFIG || {};
  if (config.dataMode !== "demo") {
    error(C, `dataMode "${config.dataMode}": Phase 1 has only "demo". Real profiles need a login and a server that applies the privacy rules (docs/students-explorer.md)`);
  }

  // The demo file: fictional, marked, and free of contact data
  const demoText = read(config.demoDataUrl || "data/demo-students.json");
  if (demoText === null) return error(C, `demo data ${config.demoDataUrl} is missing`);
  let demo;
  try { demo = JSON.parse(demoText); } catch (e) { return error(config.demoDataUrl, `is not valid JSON: ${e.message}`); }
  if (demo.isDemo !== true || !Array.isArray(demo.records) || demo.records.some((r) => r.isDemo !== true)) {
    error(config.demoDataUrl, "every record (and the file) must have isDemo: true. Never put real registrations here");
  }
  if (/@|https?:\/\/|www\./i.test(demoText)) error(config.demoDataUrl, "must not contain email or web addresses (demo LinkedIn is the word \"example\")");
  const aggregates = read(config.demoAggregatesUrl || "data/demo-aggregates.json");
  if (aggregates === null || JSON.parse(aggregates).isDemo !== true) error(config.demoAggregatesUrl, "must exist and be marked isDemo: true");

  // No page may suggest publishing the private Sheet ("Publish to web" CSV, gviz, JSON exports)
  // (The README may mention "Publish to web" for the announcements sheet, which is public on purpose.)
  for (const file of ["students.js", "students-config.js", "students-data.js", "join.js", "README.md"]) {
    const text = read(file) || "";
    const pattern = file === "README.md" ? /sample-students\.csv|DATA_SOURCE_URL/ : /Publish to web|gviz|output=csv|sample-students\.csv|DATA_SOURCE_URL/i;
    if (pattern.test(text)) {
      error(file, "mentions a published Sheet export or the old CSV directory. Private registrations are never exported to the site");
    }
  }

  // Track colours as on the Tracks page
  const tracksFile = JSON.parse(read("content/tracks.json") || "{}");
  const cohort = (tracksFile.cohorts || []).at(-1);
  for (const track of (cohort && cohort.tracks) || []) {
    const mine = (config.tracks || {})[track.id];
    if (!mine) error(C, `tracks has no entry for "${track.id}"`);
    else if (track.accent && mine.accent.toLowerCase() !== track.accent.toLowerCase()) error(C, `tracks.${track.id}.accent should be ${track.accent} as in content/tracks.json`);
  }

  // Map asset: local, with its source recorded
  const map = read((config.map || {}).url || "");
  if (map === null) error(C, `map.url ${(config.map || {}).url} is missing`);
  else if (!/data-source="Natural Earth/.test(map)) error(config.map.url, "must record its source (data-source=\"Natural Earth …\")");

  // Offline copies: the explorer's files must be in the service worker
  const sw = read("sw.js") || "";
  for (const file of ["students.css", "students-config.js", "students-data.js", "countries.js", "assets/map/world-countries.svg"]) {
    if (!sw.includes(`"${file}"`)) error("sw.js", `SITE_FILES is missing "${file}"`);
  }
}

// ----- Sources (content/sources.json, docs/sources.md) -----
// Every fact taken from a document points to a source id. The registry must be complete, and every
// "source" in the files below (at any depth) and every {official:id} / {tip:id} marker in a city guide
// must name a listed id of the right kind.
const SOURCES_FILE = "content/sources.json";
const SOURCED_FILES = ["content/programme.json", "content/academic-rules.json", "content/programme-events.json", "content/people.json"];
const SOURCE_MARKER = /\{(official|tip):([a-z0-9-]+)\}/g;
let sourceRegistry = null; // id -> { kind, ... }, filled by checkSources()

function checkSources() {
  const file = JSON.parse(fs.readFileSync(path.join(ROOT, SOURCES_FILE), "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  sourceRegistry = new Map();
  for (const type of file.priority || []) {
    if (!file.types?.[type]) error(SOURCES_FILE, `priority lists "${type}", which is not in "types"`);
  }
  for (const [type, info] of Object.entries(file.types || {})) {
    if (!["official", "tip"].includes(info.kind)) error(SOURCES_FILE, `type "${type}": kind must be "official" or "tip"`);
    if (!info.label) error(SOURCES_FILE, `type "${type}" has no label`);
  }
  for (const [i, source] of (file.sources || []).entries()) {
    const where = `${SOURCES_FILE} source ${source.id || `#${i + 1}`}`;
    if (!ID_PATTERN.test(source.id || "")) { error(where, "needs an id like \"esn-bologna-guide-2026\""); continue; }
    if (sourceRegistry.has(source.id)) error(where, "id is used twice");
    const type = file.types?.[source.type];
    if (!type) error(where, `type "${source.type}" is not in "types"`);
    requireText(source, "title", where);
    if (!DATE_PATTERN.test(source.lastChecked || "") || source.lastChecked > today) error(where, "lastChecked must be a past date YYYY-MM-DD");
    if (source.link) checkUrl(source.link.url, "link.url", where);
    sourceRegistry.set(source.id, { ...source, kind: type?.kind });
  }

  for (const relative of SOURCED_FILES) {
    const visit = (value, at) => {
      if (Array.isArray(value)) return value.forEach((item, i) => visit(item, `${at}[${i}]`));
      if (!value || typeof value !== "object") return;
      for (const [key, inner] of Object.entries(value)) {
        if (key === "source" && !sourceRegistry.has(inner)) {
          error(relative, `${at}.source "${inner}" is not an id in ${SOURCES_FILE}`);
        } else visit(inner, `${at}.${key}`);
      }
    };
    visit(JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8")), "");
  }
}

// Academic Rules page (content/academic-rules.json, academic-rules.js). Every "source" is already
// checked by checkSources(); here: universities exist in tracks.json, official links point to sources
// that have a link, and every answer of the re-sit guide leads to an outcome.
function checkAcademicRules() {
  const F = "content/academic-rules.json";
  if (!fs.existsSync(path.join(ROOT, F))) return;
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, F), "utf8"));
  const page = require("../academic-rules.js");
  const tracksFile = JSON.parse(fs.readFileSync(path.join(ROOT, "content/tracks.json"), "utf8"));
  const universities = Object.keys(tracksFile.cohorts[tracksFile.cohorts.length - 1].universities);
  const hasText = (items, where) => (items || []).forEach((item, i) => requireText(item, "text", `${where}[${i}]`));

  for (const id of page.UNIVERSITY_ORDER) {
    if (!universities.includes(id)) error("academic-rules.js", `university "${id}" is not in content/tracks.json`);
    if (!rules.universities[id]) error(F, `universities: "${id}" is missing`);
    if (!rules.integrity.universities[id]) error(F, `integrity.universities: "${id}" is missing`);
    if (!rules.grading.scales.some((s) => s.university === id)) error(F, `grading: no scale for "${id}"`);
  }
  for (const [id, university] of Object.entries(rules.universities)) {
    if (!universities.includes(id)) error(F, `universities: "${id}" is not in content/tracks.json`);
    for (const [topic, items] of Object.entries(university)) if (topic !== "links") hasText(items, `universities.${id}.${topic}`);
  }
  const checkLinks = (ids, where) => (ids || []).forEach((id) => {
    if (!sourceRegistry.has(id)) error(F, `${where}: "${id}" is not an id in ${SOURCES_FILE}`);
    else if (!sourceRegistry.get(id).link) error(F, `${where}: source "${id}" has no link to show`);
  });
  for (const [id, university] of Object.entries(rules.universities)) checkLinks(university.links, `universities.${id}.links`);
  checkLinks(rules.integrity.links, "integrity.links");
  hasText(rules.joint, "joint");
  hasText(rules.integrity.joint, "integrity.joint");
  for (const topic of rules.more) {
    if (!ID_PATTERN.test(topic.id || "")) error(F, `more: "${topic.id}" needs an id like "extra-courses"`);
    hasText(topic.items, `more.${topic.id}`);
  }

  // Try every combination of answers: each complete one must have an outcome with rules in it
  const guide = rules.resitGuide;
  const optionsOf = (q) => (q.options === "universities" ? page.UNIVERSITY_ORDER : q.options.map((o) => o.value));
  const walk = (answers) => {
    const open = page.visibleQuestions(guide, answers).find((q) => !answers[q.id]);
    if (open) return optionsOf(open).forEach((value) => walk({ ...answers, [open.id]: value }));
    const outcome = page.resitOutcome(rules, answers);
    if (!outcome) error(F, `re-sit guide: no outcome for ${JSON.stringify(answers)} (expected "${page.resitOutcomeKey(guide, answers)}" in outcomes)`);
    else if (!outcome.items.length) error(F, `re-sit guide: outcome "${outcome.key}" has no items`);
  };
  walk({});
}

// Programme Journey (content/programme-events.json, journey.js). Sources are checked by checkSources();
// here: the cohort, tracks and universities exist in tracks.json, semesters 1-4 are all there, fees
// are only listed per cohort, and every stage resolves to a place for every track.
function checkProgrammeEvents() {
  const F = "content/programme-events.json";
  if (!fs.existsSync(path.join(ROOT, F))) return;
  const events = JSON.parse(fs.readFileSync(path.join(ROOT, F), "utf8"));
  const journeyPage = require("../journey.js");
  const guides = require("../guide-data.js");
  const tracksFile = JSON.parse(fs.readFileSync(path.join(ROOT, "content/tracks.json"), "utf8"));
  const cohort = tracksFile.cohorts.find((c) => c.id === events.cohort);
  if (!cohort) return error(F, `cohort "${events.cohort}" is not in content/tracks.json`);
  const trackIds = cohort.tracks.map((t) => t.id);

  const seen = new Set();
  for (const stage of events.stages) {
    const where = `${F} stage ${stage.id}`;
    if (!ID_PATTERN.test(stage.id || "") || seen.has(stage.id)) error(where, "needs a unique id like \"semester-2\"");
    seen.add(stage.id);
    requireText(stage, "title", where);
    if (!stage.semester && !(stage.when && stage.when.label && DATE_PATTERN.test(stage.when.ends || ""))) {
      error(where, "needs \"semester\" (1-4) or \"when\": { label, ends: YYYY-MM-DD }");
    }
    if (!(stage.items || []).length) error(where, "has no items");
  }
  for (const n of [1, 2, 3, 4]) if (!events.stages.some((s) => s.semester === n)) error(F, `no stage for semester ${n}`);
  for (const track of [null, ...cohort.tracks]) {
    for (const stop of journeyPage.journeyStops(events, cohort, track, "2026-10-06", guides.semesterTiming)) {
      if (stop.semester && !stop.place) error(F, `stage ${stop.id}: no place for track ${track ? track.id : "(none)"}`);
    }
  }
  for (const entry of events.jointDegree.titles) {
    if (!cohort.universities[entry.university]) error(F, `jointDegree: university "${entry.university}" is not in content/tracks.json`);
  }
  const grantTracks = events.erasmus.byTrack.map((entry) => entry.track);
  for (const id of grantTracks) if (!trackIds.includes(id)) error(F, `erasmus: track "${id}" is not in content/tracks.json`);
  for (const id of trackIds) if (!grantTracks.includes(id)) error(F, `erasmus: track "${id}" is missing`);
  for (const [cohortId, fee] of Object.entries(events.fees.byCohort)) {
    if (!tracksFile.cohorts.some((c) => c.id === cohortId)) error(F, `fees: cohort "${cohortId}" is not in content/tracks.json`);
    for (const field of ["programmeCountries", "partnerCountries"]) {
      if (!Number.isInteger(fee[field]) || fee[field] <= 0) error(F, `fees ${cohortId}: ${field} must be a whole number of euros`);
    }
    if (!fee.source) error(F, `fees ${cohortId}: needs a source`);
  }
  for (const [part, block] of Object.entries({ cohortNumbers: events.cohortNumbers, history: events.history, jointDegree: events.jointDegree, erasmus: events.erasmus })) {
    if (!block.source) error(F, `${part}: needs a source`);
  }
}

// Privacy for the handbook pages: only these role mailboxes may appear (never a person's own address),
// and no Google Sheets/Docs links (the student reps' housing reviews are private). Changing this list is
// a decision for the site owner, so it lives here and not in the content files.
const ROLE_MAILBOXES = ["didatticasociale.euhem@unibo.it", "euhem@eshpm.eur.nl", "eu-hem@mci.edu", "garante@unibo.it",
  "safe@eur.nl", "mentalhealth@mci.edu", "med-studieinfo@medisin.uio.no"]; // service mailboxes added 2026-10-06 at the owner's request
const HANDBOOK_FILES = ["content/sources.json", "content/academic-rules.json", "content/programme-events.json", "content/people.json"];

function checkHandbookPrivacy() {
  const { emailsIn } = require("../support.js");
  for (const relative of HANDBOOK_FILES) {
    if (!fs.existsSync(path.join(ROOT, relative))) continue;
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    for (const email of new Set(emailsIn(JSON.parse(text)))) {
      if (!ROLE_MAILBOXES.includes(email)) error(relative, `"${email}" is not an approved role mailbox (scripts/check-content.js ROLE_MAILBOXES); link to the official page instead`);
    }
    if (/docs\.google\.com|drive\.google\.com/.test(text)) error(relative, "contains a Google Docs/Sheets/Drive link; private documents must not be published");
  }
}

// Support & Contacts (content/people.json, support.js): every university has a coordinator, safety and
// wellbeing contacts; every answer of the contact guide leads to an outcome with someone to contact.
function checkPeople() {
  const F = "content/people.json";
  if (!fs.existsSync(path.join(ROOT, F))) return;
  const people = JSON.parse(fs.readFileSync(path.join(ROOT, F), "utf8"));
  const page = require("../support.js");
  const tracksFile = JSON.parse(fs.readFileSync(path.join(ROOT, "content/tracks.json"), "utf8"));
  const universities = Object.keys(tracksFile.cohorts[tracksFile.cohorts.length - 1].universities);
  for (const id of page.SUPPORT_UNIVERSITIES) {
    const university = people.universities[id];
    if (!universities.includes(id)) error("support.js", `university "${id}" is not in content/tracks.json`);
    if (!university) { error(F, `universities: "${id}" is missing`); continue; }
    const coordinator = university.coordinator || {};
    if (!coordinator.role) error(F, `${id}: the coordinator needs a role`);
    if (!coordinator.email && !sourceRegistry.get(coordinator.source)?.link) error(F, `${id}: the coordinator needs a role mailbox or a source with an official link`);
    for (const kind of ["safety", "wellbeing"]) if (!(university[kind] || []).length) error(F, `${id}: "${kind}" has no contacts`);
  }
  if (!sourceRegistry.get(people.staffPage)?.link) error(F, `staffPage "${people.staffPage}" must be a source with a link`);
  for (const list of ["leave", "withdrawal", "software", "community"]) {
    (people[list] || []).forEach((item, i) => {
      requireText(item, "text", `${F} ${list}[${i}]`);
      if (item.link) checkUrl(item.link.url, "link.url", `${F} ${list}[${i}]`);
    });
  }

  const guide = people.contactGuide;
  const optionsOf = (q) => (q.options === "universities" ? page.SUPPORT_UNIVERSITIES : q.options.map((o) => o.value));
  const walk = (answers) => {
    const open = page.visibleSupportQuestions(guide, answers).find((q) => !answers[q.id]);
    if (open) return optionsOf(open).forEach((value) => walk({ ...answers, [open.id]: value }));
    const outcome = page.supportOutcome(people, answers);
    if (!outcome) return error(F, `contact guide: no outcome for ${JSON.stringify(answers)}`);
    if (!outcome.items.length) error(F, `contact guide: outcome "${outcome.key}" has no items`);
    if (!outcome.contacts.length && !outcome.page) error(F, `contact guide: outcome "${outcome.key}" names no contact and no page`);
    if (outcome.contacts.some((c) => !c.university || !(c.coordinator || (c.items || []).length))) {
      error(F, `contact guide: outcome "${outcome.key}" for ${JSON.stringify(answers)} has an empty contact (is the university question shown?)`);
    }
    if (outcome.page && !/^(#[a-z0-9-]+|[a-z-]+\.html(#[a-z0-9-]+)?)$/.test(outcome.page.href)) error(F, `contact guide: "${outcome.page.href}" is not a site page link`);
    if (outcome.page && /\.html/.test(outcome.page.href) && !fs.existsSync(path.join(ROOT, outcome.page.href.split("#")[0]))) {
      error(F, `contact guide: page "${outcome.page.href}" does not exist`);
    }
  };
  walk({});
}

// Key dates of each cohort (calendar page, homepage, calendar files): see programme.js
function checkKeyDates() {
  const programme = JSON.parse(fs.readFileSync(path.join(ROOT, "content/programme.json"), "utf8"));
  for (const cohort of programme.cohorts) {
    const seen = new Set();
    for (const [i, keyDate] of (cohort.keyDates || []).entries()) {
      const where = `content/programme.json cohort ${cohort.id} keyDates ${keyDate.id || `#${i + 1}`}`;
      if (!ID_PATTERN.test(keyDate.id || "")) error(where, "needs an id like \"exams-term-1\"");
      if (seen.has(keyDate.id)) error(where, "id is used twice");
      seen.add(keyDate.id);
      if (!programmeRules.KEY_DATE_KINDS.includes(keyDate.kind)) error(where, `kind must be one of ${programmeRules.KEY_DATE_KINDS.join(", ")}`);
      requireText(keyDate, "label", where);
      if (!keyDate.source) error(where, "needs a source (an id from content/sources.json)");
      const valid = (value) => /^\d{4}-\d{2}(-\d{2})?$/.test(value || "") && !isNaN(Date.parse(value));
      if (!valid(keyDate.start) || !valid(keyDate.end)) { error(where, "start and end must be YYYY-MM-DD, or YYYY-MM if only the month is known"); continue; }
      if (keyDate.start.length !== keyDate.end.length) error(where, "start and end must both be days or both be months");
      if (keyDate.end < keyDate.start) error(where, "ends before it starts");
      if (keyDate.start.length === 7 && !keyDate.approximate) error(where, "a month-only date must have \"approximate\": true");
    }
  }
}

// The {official:id} / {tip:id} markers of one guide line; problems are reported at "at"
function checkSourceMarkers(line, at) {
  const found = [...line.matchAll(SOURCE_MARKER)];
  for (const [marker, kind, id] of found) {
    const source = sourceRegistry?.get(id);
    if (!source) error(at, `${marker}: "${id}" is not an id in ${SOURCES_FILE}`);
    else if (source.kind !== kind) error(at, `${marker}: "${id}" is a${source.kind === "official" ? "n official source" : " student tip"}, write {${source.kind}:${id}}`);
  }
  return found.length;
}

// Roadmap & Updates: one set of rules in roadmap-data.js (docs/roadmap.md)
function checkRoadmap() {
  const read = (file) => (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), "utf8") : null);
  const roadmapText = read("content/roadmap.json");
  const updatesText = read("content/updates.json");
  if (roadmapText === null && updatesText === null) return;
  let roadmap, updates;
  try {
    roadmap = JSON.parse(roadmapText);
    updates = JSON.parse(updatesText);
  } catch (e) {
    return error("content/roadmap.json or updates.json", `is not valid JSON: ${e.message}`);
  }
  const R = require(path.join(ROOT, "roadmap-data.js"));
  const today = R.dateInRome(new Date().toISOString());
  const problems = R.validate(roadmap, updates, {
    today,
    pageExists: (file) => fs.existsSync(path.join(ROOT, file)),
  });
  for (const problem of problems) error(problem.startsWith("updates") ? "content/updates.json" : "content/roadmap.json", problem);

  // Category icons must exist in the icon sprite
  const sprite = read("icons.svg") || "";
  for (const c of roadmap.categories || []) {
    if (c.icon && !sprite.includes(`id="${c.icon}"`)) error("content/roadmap.json", `category "${c.id}": icon "${c.icon}" is not in icons.svg`);
  }
  // Each Next item that has passed its end month is probably out of date (a reminder, not an error)
  const month = today.slice(0, 7);
  for (const item of roadmap.items || []) {
    if (item.lane === "next" && item.target && item.target.end < month) {
      warn("content/roadmap.json", `"${item.id}" was expected by ${item.target.label}: move it, re-date it or publish it as an update`);
    }
  }
  const sw = read("sw.js") || "";
  for (const file of ["roadmap.html", "roadmap.css", "roadmap.js", "roadmap-data.js"]) {
    if (!sw.includes(`"${file}"`)) error("sw.js", `SITE_FILES is missing "${file}"`);
  }
  const drafts = (updates.items || []).filter((i) => i.status === "draft").map((i) => i.id);
  if (drafts.length) warn("content/updates.json", `draft (hidden until published): ${drafts.join(", ")}`);
}

function checkThesis() {
  const files = ["thesis-archive.json", "thesis-config.json", "thesis-overrides.json"].map((f) => path.join(ROOT, "content", f));
  if (!files.every((f) => fs.existsSync(f))) {
    if (files.some((f) => fs.existsSync(f))) error("content/thesis-*.json", "the thesis archive needs all three files: thesis-archive.json, thesis-config.json, thesis-overrides.json");
    return;
  }
  const [archive, config, overrides] = files.map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  const C = "content/thesis-config.json";
  const A = "content/thesis-archive.json";
  for (const [code, name] of Object.entries(config.legacyTracks || {})) if (!name) error(C, `legacy track "${code}" has no name`);
  for (const [code, uni] of Object.entries(config.universities || {})) {
    requireText(uni, "name", `${C} university "${code}"`);
    if (uni.repository) checkUrl(uni.repository.url, "repository.url", `${C} university "${code}"`);
  }
  for (const group of config.synonyms || []) {
    if (!Array.isArray(group) || group.length < 2 || group.some((w) => typeof w !== "string" || !w.trim())) {
      error(C, `each "synonyms" entry must be a list of at least two words or phrases, e.g. ["ai", "artificial intelligence"] (found ${JSON.stringify(group)})`);
    }
  }
  const records = archive.records || [];
  if (archive.count !== records.length) error(A, `"count" is ${archive.count} but there are ${records.length} records. Run the import again; don't edit this file by hand.`);
  const ids = new Set();
  for (const r of records) {
    const where = `${A} record ${r.id}`;
    if (!/^t-[0-9a-f]{8}$/.test(r.id || "")) error(where, "id should look like t-1a2b3c4d");
    if (ids.has(r.id)) error(where, "this id is used twice");
    ids.add(r.id);
    if (!config.legacyTracks[r.trackCode]) error(where, `unknown legacy track "${r.trackCode}" (add it to ${C})`);
    else if (r.trackName !== config.legacyTracks[r.trackCode]) warn(where, `track name differs from ${C}: run the import again to update it`);
    if (!config.universities[r.universityCode]) error(where, `unknown university "${r.universityCode}" (add it to ${C})`);
    if (!r.titleDisplay || !r.titleDisplay.trim()) error(where, "titleDisplay is empty");
  }
  for (const title of config.examples || []) {
    if (!records.some((r) => r.titleDisplay === title)) warn(C, `example "${title}" doesn't match any title exactly, so it isn't shown`);
  }
  for (const [id, override] of Object.entries(overrides)) {
    if (!/^t-[0-9a-f]{8}$/.test(id)) error("content/thesis-overrides.json", `"${id}" is not a thesis id (they look like t-1a2b3c4d)`);
    else if (!override.hidden && !ids.has(id)) warn("content/thesis-overrides.json", `"${id}" matches no record in the archive`);
    else if (override.titleDisplay && records.some((r) => r.id === id && r.titleDisplay !== override.titleDisplay.trim())) {
      warn("content/thesis-overrides.json", `the corrected title for "${id}" isn't in the archive yet: run the import again`);
    } else if (override.hidden && ids.has(id)) {
      warn("content/thesis-overrides.json", `"${id}" is marked hidden but still in the archive: run the import again`);
    }
  }
}

// ----- Thesis enrichment (Student Hub classification of the thesis titles) -----
// content/thesis-enrichment.json must fit the archive, the shared taxonomy in tracks.json and its own
// allowed lists, and must never carry historical source fields.
function checkThesisEnrichment() {
  const E = "content/thesis-enrichment.json";
  const file = path.join(ROOT, "content", "thesis-enrichment.json");
  const archiveFile = path.join(ROOT, "content", "thesis-archive.json");
  if (!fs.existsSync(file) || !fs.existsSync(archiveFile) || !fs.existsSync(path.join(ROOT, "thesis-enrichment.js"))) return;
  global.readStorage = global.readStorage || (() => null);
  const tracks = require("../tracks-data.js");
  global.trackCourses = tracks.trackCourses;
  global.courseInfo = tracks.courseInfo;
  const enrich = require("../thesis-enrichment.js");
  const enrichment = JSON.parse(fs.readFileSync(file, "utf8"));
  const archive = JSON.parse(fs.readFileSync(archiveFile, "utf8"));
  const cohort = tracks.tracksCohort(JSON.parse(fs.readFileSync(path.join(ROOT, "content", "tracks.json"), "utf8")));
  const trackIds = cohort.tracks.map((t) => t.id);

  // Taxonomy: reused ids must exist in tracks.json; added ones need id + label; no id twice
  const curriculum = new Set((cohort.themes || []).map((t) => t.id));
  for (const id of enrichment.taxonomy.reused || []) {
    if (!curriculum.has(id)) error(E, `taxonomy.reused: "${id}" is not a theme in content/tracks.json`);
  }
  for (const t of enrichment.taxonomy.added || []) {
    if (!t.id || !t.label) error(E, `taxonomy.added: every added theme needs an "id" and a "label"`);
    if (curriculum.has(t.id)) error(E, `taxonomy.added: "${t.id}" already exists in content/tracks.json; list it under "reused" instead`);
  }
  const themes = enrich.topicThemes(enrichment, cohort).map((t) => t.id);
  if (new Set(themes).size !== themes.length) error(E, "taxonomy: a theme id is listed twice");
  for (const id of Object.keys(enrichment.taxonomy.synonyms || {})) if (!themes.includes(id)) error(E, `taxonomy.synonyms: unknown theme "${id}"`);
  const methods = new Set((enrichment.methods || []).map((m) => m.id));

  // Weights: every theme x every current track; derived rows still match tracks.json
  const weights = enrichment.relevance.weights || {};
  for (const theme of themes) {
    const w = weights[theme];
    if (!w) { error(E, `relevance.weights: theme "${theme}" has no weights`); continue; }
    for (const id of trackIds) if (typeof w[id] !== "number" || w[id] < 0 || w[id] > 1) error(E, `relevance.weights.${theme}: "${id}" needs a number from 0 to 1`);
    if (!["derived", "proposal"].includes(w.basis)) error(E, `relevance.weights.${theme}: "basis" must be "derived" or "proposal"`);
    if ("secondary" in w && typeof w.secondary !== "boolean") error(E, `relevance.weights.${theme}: "secondary" must be true or false`);
    if (w.basis === "proposal" && !w.note) warn(E, `relevance.weights.${theme}: a proposal should explain itself in "note"`);
    if (w.basis === "derived") {
      const derived = enrich.derivedWeights(cohort, theme);
      if (!derived) warn(E, `relevance.weights.${theme}: no course in tracks.json carries this theme any more; make it a "proposal"`);
      else if (trackIds.some((id) => derived[id] !== w[id])) warn(E, `relevance.weights.${theme}: no longer matches the courses in tracks.json. Run: node scripts/thesis-weights.js --write`);
    }
  }
  for (const id of Object.keys(weights)) if (!themes.includes(id)) error(E, `relevance.weights: unknown theme "${id}"`);
  const { threshold, secondRatio, maxTracks, primarySupport = 0 } = enrichment.relevance;
  if (!(threshold > 0 && threshold <= 1) || !(secondRatio > 0 && secondRatio <= 1) || !(maxTracks >= 1 && maxTracks <= 2) || !(primarySupport >= 0 && primarySupport <= 1)) {
    error(E, "relevance: threshold, secondRatio and primarySupport must be between 0 and 1, maxTracks 1 or 2");
  }
  if (themes.every((id) => weights[id] && weights[id].secondary)) error(E, "relevance.weights: at least one theme must not be secondary");

  // Records
  const visible = new Map(archive.records.map((r) => [r.id, r]));
  const seen = new Set();
  const sourceFields = ["cohort", "trackCode", "trackName", "universityCode", "universityName", "titleOriginal", "titleDisplay", "link", "topics", "relevantCurrentTracks"];
  let unclassified = 0;
  for (const entry of enrichment.records || []) {
    const where = `${E} ${entry.id}`;
    if (seen.has(entry.id)) error(where, "this id is listed twice");
    seen.add(entry.id);
    const record = visible.get(entry.id);
    if (!record) {
      // Hidden records (overrides) are ignored; anything else is an unknown id
      if (!/^t-[0-9a-f]{8}$/.test(entry.id || "")) error(where, "not a thesis id (they look like t-1a2b3c4d)");
      else warn(where, "no visible thesis has this id (hidden, or the title changed on re-import); it is ignored");
      continue;
    }
    for (const field of sourceFields) if (field in entry) error(where, `"${field}" is a historical source field and must not be set here`);
    if (entry.title !== record.titleDisplay) error(where, `"title" must equal the archive title exactly (it is only a reading aid): "${record.titleDisplay}"`);
    if (!Array.isArray(entry.themes)) error(where, '"themes" must be a list');
    else {
      if (entry.themes.length > 3) error(where, "at most 3 themes");
      for (const t of entry.themes) if (!themes.includes(t)) error(where, `unknown theme "${t}"`);
      if (!entry.themes.length && !entry.unclassified) error(where, 'needs at least one theme, or "unclassified": true');
      if (entry.themes.length && entry.unclassified) error(where, '"unclassified" is only for entries without themes');
      if (entry.unclassified) unclassified++;
    }
    for (const m of entry.statedMethods || []) if (!methods.has(m)) error(where, `unknown stated method "${m}"`);
    if (!Array.isArray(entry.statedCountries) || entry.statedCountries.some((c) => typeof c !== "string" || !c.trim())) error(where, '"statedCountries" must be a list of names (it can be empty)');
    if (!enrich.ENRICHMENT_CONFIDENCE.includes(entry.confidence)) error(where, `"confidence" must be ${enrich.ENRICHMENT_CONFIDENCE.join(", ")}`);
    if (!enrich.ENRICHMENT_STATUS.includes(entry.status)) error(where, `"status" must be ${enrich.ENRICHMENT_STATUS.join(" or ")}`);
    if (entry.trackOverride) {
      const o = entry.trackOverride;
      if (!Array.isArray(o.tracks) || o.tracks.length > 2 || o.tracks.some((t) => !trackIds.includes(t))) error(where, `trackOverride.tracks: at most 2 of ${trackIds.join(", ")}`);
      if (!o.reason || !String(o.reason).trim()) error(where, "trackOverride needs a short reason");
    }
  }
  const missing = [...visible.keys()].filter((id) => !seen.has(id));
  if (missing.length) error(E, `${missing.length} visible thesis/theses have no entry: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? " …" : ""}`);
  if (unclassified) warn(E, `${unclassified} thesis/theses are marked "unclassified"`);
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
      if (!url) warn("content/settings.json", `"${field}" is empty, so the button opens the Contact page`);
    }
  }

  // --- programme.json (courses, modules, study plan rules) ---
  const modules = await checkProgramme();

  // --- tracks.json (Tracks page) ---
  await checkTracks();

  // --- thesis archive (Past Thesis Explorer) ---
  checkThesis();
  checkThesisEnrichment();

  // --- Join the Directory (form settings, backend, contact) ---
  checkDirectory();
  checkStudents();
  checkRoadmap();

  // --- City guides (docs/content/<city>-guide.md) ---
  checkSources(); // before the guides: they use its ids
  checkKeyDates();
  checkAcademicRules();
  checkProgrammeEvents();
  checkPeople();
  checkHandbookPrivacy();
  checkCityGuides();

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
      if (topic.status !== undefined && topic.status !== "upcoming") error(where, 'Optional topic status must be "upcoming".');
      if (topic.status === "upcoming") {
        if (topic.lecture || topic.notes) error(where, "An upcoming topic must not present a completed lecture or notes.");
        if (!/^https:\/\/virtuale\.unibo\.it\/course\/section\.php\?id=\d+$/.test(topic.virtualeUrl || "")) error(where, "An upcoming class needs a valid Virtuale section URL.");
      }
      topicIds.add(topic.id);
    });
  }

  // --- notes, practice items, resources ---
  for (const course of modules) {
    for (const topic of course.topics) {
      if (topic.lecture) {
        try {
          const lecture = await data.loadLecture(course, topic, readFromDisk);
          if (!lecture) {
            error(`${course.folder}topics.json`, `lecture "${topic.lecture}" was not found`);
          } else {
            const file = course.folder + topic.lecture;
            if (!await readFromDisk(course.folder + lecture.guide)) error(file, `guide "${lecture.guide}" was not found or is empty`);
            checkDate(lecture.date, "date", file);
            checkDate(lecture.updated, "updated", file);
            if (lecture.classNumber !== undefined && (!Number.isInteger(lecture.classNumber) || lecture.classNumber < 1)) error(file, `"classNumber" must be a positive whole number`);
          }
        } catch (problem) {
          error(`${course.folder}topics.json (${topic.id})`, problem.message);
        }
      }
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
