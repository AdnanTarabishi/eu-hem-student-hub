// The four-semester planner: existing Bologna rules and separate future drafts.
// Run: node tests/studyplan/data.test.js .
const fs = require("fs"), path = require("path"), assert = require("assert"), vm = require("vm");
const ROOT = path.resolve(process.argv[2] || ".");
const P = require(path.join(ROOT, "programme.js"));
const D = require(path.join(ROOT, "studyplan-data.js"));
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const programme = read("content/programme.json"), cohort = read("content/tracks.json").cohorts.at(-1);
const term = P.currentTerm(programme), calendars = read("calendar/calendars.json");
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log("  ok  " + name); };
const pick = (track, semester, group, raw, option, selected = true, s1 = []) => D.applyFutureChoice(cohort, track, semester, group, raw, option, selected, s1);
const state = (track, semester, group, raw, s1 = []) => D.choiceState(cohort, track, semester, group, raw, s1);

check("Semester 1 still has 16 complete plans, each with its original calendar and 30 degree CFU", () => {
  const plans = P.allPlanCombinations(term);
  assert.strictEqual(plans.length, 16);
  for (const choices of plans) {
    const summary = P.planSummary(term, choices);
    assert.strictEqual(summary.complete, true);
    assert.strictEqual(summary.requiredCfu, 30);
    assert.strictEqual(summary.optionalCfu, choices.crash.length * 3);
    const calendar = calendars.find(item => item.plan === P.planKey(term, choices));
    assert.ok(calendar, `calendar for ${P.planKey(term, choices)}`);
    assert.ok(fs.existsSync(path.join(ROOT, "calendar", calendar.file)));
    assert.deepStrictEqual(calendar.courses, P.selectedCourseCodes(term, choices));
  }
});

check("required courses stay locked; invalid S1 choices are repaired; crash courses do not increase degree credits", () => {
  const clean = P.sanitizeChoices(term, { quant: ["96496", "96525"], elective: "made-up", crash: ["97484", "B1076", "B1076", "unknown"] });
  assert.deepStrictEqual(clean, { crash: ["B1076", "97484"], quant: null, elective: null });
  assert.strictEqual(P.applyChoice(term, clean, "core", "97177", false).refused, true);
  assert.strictEqual(P.applyChoice(term, clean, "core", "97177", true).refused, false);
  assert.strictEqual(P.applyChoice(term, clean, "quant", "96500", true).refused, true);
  assert.strictEqual(P.planSummary(term, clean).requiredCfu, 15);
  assert.strictEqual(P.planSummary(term, clean).optionalCfu, 6);
  assert.strictEqual(P.planSummary(term, clean).complete, false);
});

check("old S1 storage remains compatible with timetable/exams and rejects unknown codes and statuses", () => {
  const stored = { version: 1, cohort: P.currentCohort(programme).id, term: term.id, choices: { quant: "96496", elective: "C8393" }, statuses: { "97177": "passed", "96500": "script", "foreign-course": "passed" } };
  const context = vm.createContext({ readStorage: () => stored, module: { exports: {} } });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "programme.js"), "utf8"), context);
  context.programme = programme;
  const plan = JSON.parse(JSON.stringify(vm.runInContext("loadPlan(programme)", context)));
  assert.deepStrictEqual(plan.statuses, { "97177": "passed" });
  assert.strictEqual(plan.saved, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(vm.runInContext("myModuleCodes(programme)", context))), ["97177", "79060", "87428", "96500", "96496", "96498", "96499", "C8393"]);
  stored.cohort = "wrong-cohort";
  assert.strictEqual(vm.runInContext("loadPlan(programme).saved", context), false);
});

check("future course lists exactly follow each track's university, required courses, choices and thesis hosts", () => {
  assert.deepStrictEqual(cohort.tracks.map(track => track.id), ["eeh", "ep", "mhi", "phm"]);
  for (const track of cohort.tracks) {
    assert.deepStrictEqual(track.semesters.map(semester => semester.number), [2, 3]);
    const required = D.selectedFutureCourses(cohort, track, null);
    assert.deepStrictEqual(required.map(course => course.id), track.semesters.flatMap(semester => semester.required));
    for (const semester of track.semesters) {
      for (let index = 0; index < semester.choices.length; index++) {
        const choice = state(track, semester.number, index, null);
        assert.deepStrictEqual(choice.options.map(option => option.courses.map(course => course.id)), semester.choices[index].options);
      }
      for (const course of required.filter(course => course.semester === semester.number)) assert.strictEqual(course.university, semester.university);
    }
    for (const university of track.thesis) assert.ok(cohort.universities[university]);
  }
});

check("one-option picks replace the prior pick; two-course bundles stay atomic", () => {
  let result = pick("ep", 2, 0, null, 0);
  assert.strictEqual(result.refused, false);
  result = pick("ep", 2, 0, result.draft, 3);
  assert.deepStrictEqual(state("ep", 2, 0, result.draft).selected, [3]);
  const elective = D.selectedFutureCourses(cohort, "ep", result.draft).filter(course => !course.required);
  assert.deepStrictEqual(elective.map(course => course.id), ["uio-fhe4110", "uio-fhe4130"]);
  assert.strictEqual(state("ep", 2, 0, result.draft).knownCredits, 10);
  assert.strictEqual(state("ep", 2, 0, result.draft).complete, true);
  result = pick("mhi", 3, 0, null, 0);
  assert.deepStrictEqual(D.selectedFutureCourses(cohort, "mhi", result.draft).filter(course => !course.required).map(course => course.id), ["mci-simulation-methods", "mci-simulation-practice"]);
  result = pick("mhi", 3, 0, result.draft, 1);
  assert.deepStrictEqual(state("mhi", 3, 0, result.draft).selected, [1]);
  assert.deepStrictEqual(D.selectedFutureCourses(cohort, "mhi", result.draft).filter(course => !course.required).map(course => course.id), ["mci-applied-finance", "mci-inclusive-leadership"]);
});

check("E&P excludes only the law or systems elective already chosen in S1; saved duplicates are repaired", () => {
  for (const [code, id, index] of [["C8393", "unibo-health-systems", 1], ["70125", "unibo-international-law", 0]]) {
    const s1 = [P.courseByCode(term, code)];
    const option = state("ep", 3, 1, null, s1).options[index];
    assert.strictEqual(option.courses[0].id, id);
    assert.strictEqual(option.blocked, true);
    assert.match(option.reason, /Semester 1/);
    assert.strictEqual(pick("ep", 3, 1, null, index, true, s1).refused, true);
    const repair = D.sanitizeDraft(cohort, { tracks: { ep: { choices: { "s3-choice-1": [index, 2] }, statuses: { [id]: "passed", "unibo-lmic": "studying" } } } }, s1);
    assert.deepStrictEqual(state("ep", 3, 1, repair, s1).selected, [2]);
    assert.deepStrictEqual(repair.tracks.ep.statuses, { "unibo-lmic": "studying" });
    assert.strictEqual(state("ep", 3, 1, null).options[index].blocked, false);
  }
  assert.strictEqual(state("ep", 3, 1, null, [{ name: "Health Systems Research" }]).options[1].blocked, false, "a similar course title does not establish equivalence");
});

check("E&P choose-two and PHM's two independent elective pairs keep their stated limits", () => {
  let draft = pick("ep", 3, 1, null, 2).draft;
  draft = pick("ep", 3, 1, draft, 3).draft;
  const over = pick("ep", 3, 1, draft, 4);
  assert.strictEqual(over.refused, true);
  assert.deepStrictEqual(state("ep", 3, 1, over.draft).selected, [2, 3]);
  assert.strictEqual(state("ep", 3, 1, over.draft).complete, true);
  draft = pick("ep", 3, 1, over.draft, 2, false).draft;
  assert.strictEqual(state("ep", 3, 1, draft).complete, false);
  draft = pick("phm", 2, 0, null, 1).draft;
  draft = pick("phm", 2, 1, draft, 0).draft;
  assert.deepStrictEqual(state("phm", 2, 0, draft).selected, [1]);
  assert.deepStrictEqual(state("phm", 2, 1, draft).selected, [0]);
  assert.strictEqual(D.semesterSummary(cohort, "phm", 2, draft).choicesComplete, true);
});

check("every allowed E&P Semester 3 combination totals 30 verified credits and excludes the S1 repeat", () => {
  let combinations = 0;
  for (const s1Code of ["C8393", "70125"]) {
    const s1 = [P.courseByCode(term, s1Code)];
    const available = state("ep", 3, 1, null, s1).options.filter(option => !option.blocked).map(option => option.index);
    assert.strictEqual(available.length, 4);
    for (const complementary of [0, 1]) {
      for (let first = 0; first < available.length; first++) {
        for (let second = first + 1; second < available.length; second++) {
          let draft = pick("ep", 3, 0, null, complementary, true, s1).draft;
          draft = pick("ep", 3, 1, draft, available[first], true, s1).draft;
          draft = pick("ep", 3, 1, draft, available[second], true, s1).draft;
          const summary = D.semesterSummary(cohort, "ep", 3, draft, s1);
          assert.strictEqual(summary.knownCredits, 30);
          assert.strictEqual(summary.unknownCredits, 0);
          assert.strictEqual(summary.complete, true);
          assert.ok(!summary.courses.some(course => D.normalizedTitle(course.name) === D.normalizedTitle(s1[0].name)));
          assert.ok(summary.courses.every(course => course.code && /verified.*2026\/27/i.test(course.creditsSource)));
          combinations++;
        }
      }
    }
  }
  assert.strictEqual(combinations, 24);
});

check("EEH choose-10-EC refuses known-credit overshoots and leaves unpublished credits unconfirmed", () => {
  let draft = pick("eeh", 3, 0, null, 0).draft;
  assert.strictEqual(state("eeh", 3, 0, draft).knownCredits, 5);
  assert.strictEqual(state("eeh", 3, 0, draft).complete, false);
  assert.strictEqual(pick("eeh", 3, 0, draft, 4).refused, true);
  draft = pick("eeh", 3, 0, draft, 1).draft;
  assert.strictEqual(state("eeh", 3, 0, draft).knownCredits, 10);
  assert.strictEqual(state("eeh", 3, 0, draft).complete, true);
  draft = pick("eeh", 3, 0, draft, 2).draft;
  assert.strictEqual(state("eeh", 3, 0, draft).knownCredits, 10);
  assert.strictEqual(state("eeh", 3, 0, draft).unknownCredits, 1);
  assert.strictEqual(state("eeh", 3, 0, draft).complete, null);
  assert.match(state("eeh", 3, 0, draft).notice, /not all published|Confirm/);
  assert.strictEqual(D.semesterSummary(cohort, "eeh", 3, draft).complete, null);
});

check("MHI's unspecified selection rule permits preferences without claiming a complete semester", () => {
  let draft = null;
  for (const index of [0, 1, 2]) draft = pick("mhi", 2, 0, draft, index).draft;
  const choice = state("mhi", 2, 0, draft);
  assert.deepStrictEqual(choice.selected, [0, 1, 2]);
  assert.deepStrictEqual(choice.ruleModel, { kind: "unknown", target: null });
  assert.strictEqual(choice.complete, null);
  assert.match(choice.notice, /not specified/);
  assert.strictEqual(D.semesterSummary(cohort, "mhi", 2, draft).complete, null);
});

check("track drafts stay independent; malformed envelopes, excessive selections and removed statuses are repaired", () => {
  let draft = pick("ep", 2, 0, null, 1).draft;
  const ep = JSON.stringify(draft.tracks.ep);
  draft = pick("phm", 2, 0, draft, 0).draft;
  assert.strictEqual(JSON.stringify(draft.tracks.ep), ep);
  draft.tracks.ep.statuses["uio-hman4210"] = "passed";
  draft = pick("ep", 2, 0, draft, 2).draft;
  assert.deepStrictEqual(draft.tracks.ep.statuses, {});
  draft.tracks.ep.statuses = { "uio-heval4210": "studying", "uio-hecon4270": "evil-status", "not-a-course": "passed" };
  assert.deepStrictEqual(D.sanitizeDraft(cohort, draft).tracks.ep.statuses, { "uio-heval4210": "studying" });
  const malformed = D.sanitizeDraft(cohort, { tracks: { ep: { choices: { "s2-choice-0": [3, 3, 99, "0", -1], "s3-choice-1": [0, 1, 2, 3, 4] } } } });
  assert.deepStrictEqual(malformed.tracks.ep.choices["s2-choice-0"], [3]);
  assert.deepStrictEqual(malformed.tracks.ep.choices["s3-choice-1"], [0, 1]);
  for (const bad of [null, [], "not an object", { version: 99, tracks: draft.tracks }, { cohort: "2020-2022", tracks: draft.tracks }]) assert.deepStrictEqual(D.sanitizeDraft(cohort, bad), D.sanitizeDraft(cohort, null));
  assert.strictEqual(D.trackDraft(cohort, "not-a-track", draft), null);
  assert.strictEqual(pick("ep", 2, 0, draft, 99).refused, true);
});

check("thesis state accepts only eligible hosts/statuses and bounded text; unknown credits stay explicit", () => {
  const raw = { tracks: { eeh: { thesisUniversity: "unibo", thesisStatus: "made-up", thesisTopic: "  " + "x".repeat(400) + "  " }, ep: { thesisUniversity: "uio", thesisStatus: "researching", thesisTopic: "<img src=x onerror=alert(1)>" } } };
  const clean = D.sanitizeDraft(cohort, raw);
  assert.strictEqual(clean.tracks.eeh.thesisUniversity, "");
  assert.strictEqual(clean.tracks.eeh.thesisStatus, "");
  assert.strictEqual(clean.tracks.eeh.thesisTopic.length, 300);
  assert.strictEqual(clean.tracks.ep.thesisUniversity, "uio");
  assert.strictEqual(clean.tracks.ep.thesisStatus, "researching");
  assert.strictEqual(clean.tracks.ep.thesisTopic, "<img src=x onerror=alert(1)>", "untrusted strings remain text for the UI to render safely");
  for (const track of cohort.tracks) {
    for (const semester of track.semesters) {
      const summary = D.semesterSummary(cohort, track, semester.number, null);
      assert.strictEqual(summary.unknownCredits, summary.courses.filter(course => course.credits === null).length);
      assert.strictEqual(summary.knownCredits, summary.courses.reduce((sum, course) => sum + (course.credits || 0), 0));
      if (summary.unknownCredits) assert.notStrictEqual(summary.complete, true);
    }
  }
});

check("authored advice has valid courses, all track links, real source references and a clear interpretation disclaimer", () => {
  const advice = read("content/study-advice.json");
  assert.strictEqual(advice.schemaVersion, 1);
  assert.match(advice.disclaimer, /Authored.*interpretation.*not an official recommendation.*testimonial/i);
  const sourceIds = new Set(advice.sources.map(source => source.id));
  assert.strictEqual(sourceIds.size, advice.sources.length);
  for (const source of advice.sources) {
    assert.ok(source.title && /^https:\/\//.test(source.url));
    assert.ok(["corsi.unibo.it", "www.unibo.it", "eu-hem.eu", "www.uio.no", "www.eur.nl", "www.mci.edu"].includes(new URL(source.url).hostname));
  }
  const courseIds = new Set(term.courses.map(course => course.id));
  for (const [id, entry] of Object.entries(advice.courses)) {
    assert.ok(courseIds.has(id), id);
    assert.ok(entry.summary && entry.decisionTip && entry.skills.length);
    assert.strictEqual(new Set(entry.trackFits.map(fit => fit.trackId)).size, 4);
    for (const fit of entry.trackFits) {
      assert.ok(cohort.tracks.some(track => track.id === fit.trackId));
      assert.ok(["strong", "useful"].includes(fit.strength));
      assert.ok(fit.reason);
    }
    for (const source of entry.sources) assert.ok(sourceIds.has(source), `${id}: ${source}`);
    assert.ok(entry.sources.length > 0);
    assert.doesNotMatch(entry.summary + " " + entry.decisionTip, /guaranteed job|guaranteed career|easy exam|easy grades|students say|students report/i);
  }
  for (const id of ["intro-economics", "intro-management", "fund-quant-methods", "quant-methods", "health-systems", "international-law-health"]) assert.ok(advice.courses[id]);
});

console.log(`${checks} study plan data checks passed`);
