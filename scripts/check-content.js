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
  if (endpoint && /\[Placeholder:/.test(contact)) {
    error(C, "the form is switched on (endpoint set) but contact.html still has a placeholder: people must be able to ask us to change or delete their profile");
  } else if (!endpoint) {
    warn(C, "endpoint is empty, so the Join the Directory form says it is not open yet");
  }

  // Sheet and Drive folder IDs are long random strings; they must only ever be Script Properties
  const idLike = /docs\.google\.com\/spreadsheets\/d\/|drive\.google\.com\/drive\/folders\/|\b1[A-Za-z0-9_-]{32,43}\b/;
  for (const file of [C, "join.html", "join.js", G, "integrations/directory-apps-script/README.md"]) {
    const text = read(file);
    if (text && idLike.test(text)) error(file, "contains what looks like a Google Sheet or Drive folder ID. IDs belong only in the Apps Script's Script Properties, never in the repository");
  }
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
      if (!url) warn("content/settings.json", `"${field}" is empty, so the button shows "form coming soon"`);
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
