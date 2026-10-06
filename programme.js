// ===== The programme: courses, modules and study plan rules =====
// Reads content/programme.json - the ONE place where course facts live - and gives every
// page the same helpers: look up courses and modules, apply the study plan rules, and
// save the student's plan in this browser.
//
// The rules are data (in programme.json), not code: a group is "required" (all courses,
// locked), "choose-one" or "optional" (with min/max). Nothing here names a specific course.

const PROGRAMME_URL = "content/programme.json";
const PLAN_KEY = "euhem-study-plan-v1";
const MY_COURSES_KEY = "euhem-my-courses-only";
const COURSE_STATUSES = ["", "studying", "booked", "passed"];
const COURSE_STATUS_LABELS = { "": "Not started", studying: "Studying", booked: "Exam booked", passed: "Passed" };

// ----- Loading and looking things up -----

async function loadProgramme(read) {
  const text = read ? await read(PROGRAMME_URL) : await (await fetch(PROGRAMME_URL)).text();
  if (text === null) throw new Error(`${PROGRAMME_URL} is missing`);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${PROGRAMME_URL} is not valid JSON: ${error.message}`);
  }
}

// The cohort and term the site is about right now: the newest cohort, its first term.
// (When Semester 2 is added, this is where "the current term" will be decided.)
function currentCohort(programme) {
  return programme.cohorts[programme.cohorts.length - 1];
}

function currentTerm(programme) {
  return currentCohort(programme).terms[0];
}

// Every course of every term, with where it belongs: { cohort, term, course }
function allTermCourses(programme) {
  const list = [];
  for (const cohort of programme.cohorts) {
    for (const term of cohort.terms) {
      for (const course of term.courses) list.push({ cohort, term, course });
    }
  }
  return list;
}

// Lookup tables, built once: course by id/code, module by id/code, module -> course
function programmeIndex(programme) {
  const index = { coursesById: {}, coursesByCode: {}, modulesById: {}, modulesByCode: {}, courseOfModule: {} };
  for (const { cohort, term, course } of allTermCourses(programme)) {
    const entry = { cohort, term, course };
    index.coursesById[course.id] = entry;
    index.coursesByCode[course.code] = entry;
    for (const module of course.modules) {
      index.modulesById[module.id] = { ...entry, module };
      index.modulesByCode[module.code] = { ...entry, module };
      index.courseOfModule[module.id] = course.id;
    }
  }
  return index;
}

// The study plan group a course belongs to in a term (or null)
function groupOfCourse(term, courseCode) {
  return term.groups.find((group) => group.courses.includes(courseCode)) || null;
}

// "1", "2" or "1/2" - from the modules' cycles
function courseCycles(course) {
  return [...new Set(course.modules.map((m) => m.cycle))].sort().join("/");
}

// First and last teaching day across the course's modules
function courseDates(course) {
  const starts = course.modules.map((m) => m.teachingStart).filter(Boolean).sort();
  const ends = course.modules.map((m) => m.teachingEnd).filter(Boolean).sort();
  return { start: starts[0] || null, end: ends[ends.length - 1] || null };
}

function courseByCode(term, code) {
  return term.courses.find((course) => course.code === code);
}

// ----- Study plan rules -----
// choices = { <groupId>: "code" for choose-one, [codes] for optional }. Required groups need no choice.

function emptyChoices(term) {
  const choices = {};
  for (const group of term.groups) {
    if (group.kind === "choose-one") choices[group.id] = null;
    if (group.kind === "optional") choices[group.id] = [];
  }
  return choices;
}

// Repairs anything that breaks the rules (unknown codes, too many options, two picks in a
// choose-one group). So a damaged or outdated saved plan can never become an invalid plan.
function sanitizeChoices(term, raw) {
  const choices = emptyChoices(term);
  const source = raw && typeof raw === "object" ? raw : {};
  for (const group of term.groups) {
    const value = source[group.id];
    if (group.kind === "choose-one") {
      choices[group.id] = typeof value === "string" && group.courses.includes(value) ? value : null;
    }
    if (group.kind === "optional") {
      const picked = Array.isArray(value) ? [...new Set(value)].filter((code) => group.courses.includes(code)) : [];
      // keep the course order of the rules, and at most "max"
      choices[group.id] = group.courses.filter((code) => picked.includes(code)).slice(0, group.max ?? group.courses.length);
    }
  }
  return choices;
}

// Changes one choice and returns { choices, refused }. Never produces an invalid plan:
// a third optional course beyond "max" is refused; a choose-one pick replaces the old one.
function applyChoice(term, choices, groupId, code, selected) {
  const group = term.groups.find((g) => g.id === groupId);
  const next = sanitizeChoices(term, choices);
  if (!group || !group.courses.includes(code)) return { choices: next, refused: true };
  if (group.kind === "required") return { choices: next, refused: !selected }; // locked
  if (group.kind === "choose-one") {
    next[groupId] = selected ? code : next[groupId] === code ? null : next[groupId];
    return { choices: next, refused: false };
  }
  const current = next[groupId];
  if (!selected) {
    next[groupId] = current.filter((c) => c !== code);
    return { choices: next, refused: false };
  }
  if (current.includes(code)) return { choices: next, refused: false };
  if (current.length >= (group.max ?? Infinity)) return { choices: next, refused: true };
  next[groupId] = group.courses.filter((c) => current.includes(c) || c === code);
  return { choices: next, refused: false };
}

// Codes of every course in the plan: required + chosen + optional
function selectedCourseCodes(term, choices) {
  const clean = sanitizeChoices(term, choices);
  const codes = [];
  for (const group of term.groups) {
    if (group.kind === "required") codes.push(...group.courses);
    if (group.kind === "choose-one" && clean[group.id]) codes.push(clean[group.id]);
    if (group.kind === "optional") codes.push(...clean[group.id]);
  }
  return codes;
}

// Is each group's rule met? Required: always. Choose-one: one picked. Optional: within min/max.
function groupSatisfied(group, choices) {
  if (group.kind === "required") return true;
  if (group.kind === "choose-one") return !!choices[group.id];
  const count = (choices[group.id] || []).length;
  return count >= (group.min ?? 0) && count <= (group.max ?? Infinity);
}

// { requiredCfu, requiredTotal, optionalCfu, groups: [{ id, label, satisfied }], complete }
function planSummary(term, choices) {
  const clean = sanitizeChoices(term, choices);
  let requiredCfu = 0;
  let optionalCfu = 0;
  for (const code of selectedCourseCodes(term, clean)) {
    const course = courseByCode(term, code);
    const group = groupOfCourse(term, code);
    if (!course || !group) continue;
    if (group.countsTowardRequired === false) optionalCfu += course.cfu;
    else requiredCfu += course.cfu;
  }
  const groups = term.groups.map((group) => ({ id: group.id, label: group.label, satisfied: groupSatisfied(group, clean) }));
  return {
    requiredCfu,
    requiredTotal: term.requiredCfu,
    optionalCfu,
    groups,
    complete: groups.every((g) => g.satisfied) && requiredCfu === term.requiredCfu,
  };
}

// Every valid, complete plan the rules allow (used to build one calendar per plan)
function allPlanCombinations(term) {
  let plans = [emptyChoices(term)];
  for (const group of term.groups) {
    if (group.kind === "required") continue;
    const options = group.kind === "choose-one"
      ? group.courses.map((code) => code)
      : subsets(group.courses).filter((s) => s.length >= (group.min ?? 0) && s.length <= (group.max ?? Infinity));
    plans = plans.flatMap((plan) => options.map((option) => ({ ...plan, [group.id]: option })));
  }
  return plans.filter((plan) => planSummary(term, plan).complete);
}

// All subsets of a list, keeping the original order: [a,b] -> [], [a], [b], [a,b]
function subsets(list) {
  return list.reduce((all, item) => all.concat(all.map((s) => [...s, item])), [[]]);
}

// A short name for a plan, used in calendar file names: "96496-C8393-B1076"
function planKey(term, choices) {
  const clean = sanitizeChoices(term, choices);
  const parts = [];
  for (const group of term.groups) {
    if (group.kind === "choose-one") parts.push(clean[group.id] || "none");
    if (group.kind === "optional") parts.push(...clean[group.id]);
  }
  return parts.join("-");
}

// ----- The student's saved plan (this browser only) -----
// localStorage: a small storage area the browser keeps for each website, on this device.
// It survives closing the browser, but isn't shared with other devices or sent anywhere.

function loadPlan(programme) {
  const cohort = currentCohort(programme);
  const term = currentTerm(programme);
  const stored = readStorage(PLAN_KEY, null);
  const valid = stored && typeof stored === "object" && stored.cohort === cohort.id && stored.term === term.id;
  const statuses = {};
  if (valid && stored.statuses && typeof stored.statuses === "object") {
    for (const [code, status] of Object.entries(stored.statuses)) {
      if (courseByCode(term, code) && COURSE_STATUSES.includes(status) && status) statuses[code] = status;
    }
  }
  return {
    cohort: cohort.id,
    term: term.id,
    saved: !!valid,
    choices: sanitizeChoices(term, valid ? stored.choices : null),
    statuses,
  };
}

function savePlan(plan) {
  return writeStorage(PLAN_KEY, {
    version: 1,
    cohort: plan.cohort,
    term: plan.term,
    choices: plan.choices,
    statuses: plan.statuses,
    savedAt: new Date().toISOString(),
  });
}

function resetPlan() {
  try {
    window.localStorage.removeItem(PLAN_KEY);
    window.localStorage.removeItem(MY_COURSES_KEY);
  } catch {
    // storage blocked: nothing was saved anyway
  }
}

// Module codes of the student's courses, or null if there is no saved plan
function myModuleCodes(programme) {
  const plan = loadPlan(programme);
  if (!plan.saved) return null;
  const term = currentTerm(programme);
  const codes = [];
  for (const code of selectedCourseCodes(term, plan.choices)) {
    const course = courseByCode(term, code);
    if (course) codes.push(course.code, ...course.modules.map((m) => m.code));
  }
  return [...new Set(codes)];
}

// "My courses only" switch: on by default once a plan is saved; the visitor's choice wins
function myCoursesOnly(programme) {
  if (!loadPlan(programme).saved) return false;
  const stored = readStorage(MY_COURSES_KEY, null);
  return stored === null ? true : stored === true;
}

function setMyCoursesOnly(value) {
  writeStorage(MY_COURSES_KEY, !!value);
}

// A labelled on/off switch, shown on the timetable and exams when a plan exists
function myCoursesSwitch(programme, onChange) {
  const label = createElement("label", "checkbox-label my-courses-switch");
  const box = createElement("input");
  box.type = "checkbox";
  box.checked = myCoursesOnly(programme);
  box.addEventListener("change", () => {
    setMyCoursesOnly(box.checked);
    onChange();
  });
  label.appendChild(box);
  label.appendChild(document.createTextNode("My courses only"));
  const link = createElement("a", "schedule-meta", " (from your study plan)");
  link.href = "studyplan.html";
  label.appendChild(link);
  return label;
}

// ----- Key dates (terms, exam periods, deadlines) -----
// A cohort's "keyDates" in programme.json: { id, kind, label, start, end, approximate?, note?, source }.
// start/end are "YYYY-MM-DD", or "YYYY-MM" when only the month is known (then "approximate": true).

const KEY_DATE_KINDS = ["classes", "exams", "deadline", "event"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function keyDates(cohort) {
  return [...(cohort.keyDates || [])].sort((a, b) => a.start.localeCompare(b.start));
}

// The last day a key date covers: "2027-02" -> "2027-02-31" (good enough for comparing with a day)
function keyDateLastDay(keyDate) {
  return keyDate.end.length === 7 ? `${keyDate.end}-31` : keyDate.end;
}

// The next key date of a kind that has not ended yet ("today" is "YYYY-MM-DD"), or null
function nextKeyDate(cohort, kind, today) {
  return keyDates(cohort).find((d) => d.kind === kind && keyDateLastDay(d) >= today) || null;
}

// "26 Oct – 7 Nov 2026", "17–23 Dec 2026", "1 Aug 2027", "Jan – Feb 2027", "May 2027"
function formatKeyDateRange(keyDate) {
  const part = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return { y, m: MONTH_NAMES[m - 1], d };
  };
  const a = part(keyDate.start);
  const b = part(keyDate.end);
  const sameYear = a.y === b.y;
  if (!a.d) { // month only
    if (keyDate.start === keyDate.end) return `${a.m} ${a.y}`;
    return sameYear ? `${a.m} – ${b.m} ${b.y}` : `${a.m} ${a.y} – ${b.m} ${b.y}`;
  }
  if (keyDate.start === keyDate.end) return `${a.d} ${a.m} ${a.y}`;
  if (sameYear && a.m === b.m) return `${a.d}–${b.d} ${b.m} ${b.y}`;
  return sameYear ? `${a.d} ${a.m} – ${b.d} ${b.m} ${b.y}` : `${a.d} ${a.m} ${a.y} – ${b.d} ${b.m} ${b.y}`;
}

if (typeof module !== "undefined") {
  module.exports = {
    loadProgramme, currentCohort, currentTerm, allTermCourses, programmeIndex, groupOfCourse, courseCycles, courseDates,
    courseByCode, emptyChoices, sanitizeChoices, applyChoice, selectedCourseCodes, groupSatisfied, planSummary,
    allPlanCombinations, subsets, planKey, COURSE_STATUSES,
    KEY_DATE_KINDS, keyDates, keyDateLastDay, nextKeyDate, formatKeyDateRange,
  };
}
