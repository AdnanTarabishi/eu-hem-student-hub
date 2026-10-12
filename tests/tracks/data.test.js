// Focused Tracks facts and helper checks. Run: node tests/tracks/data.test.js
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ROOT = path.resolve(__dirname, "../..");
const H = require(path.join(ROOT, "tracks-data.js"));
const W = require(path.join(ROOT, "tracks-workspace.js"));
const file = JSON.parse(fs.readFileSync(path.join(ROOT, "content/tracks.json"), "utf8"));
const cohort = H.tracksCohort(file, "2026-2028");
const guide = JSON.parse(fs.readFileSync(path.join(ROOT, "content/tracks-guide.json"), "utf8"));
const track = (id) => H.trackById(cohort, id);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

// Recorded from the approved curriculum before this editorial/design update.
// This protects all course names/codes/credits, exact elective bundles and rules,
// routes, thesis options and official career sectors without copying the file.
// A future intentional curriculum correction must review and refresh this fixture.
const FACTS_SHA256 = "3133ec6b54488b4c7c8d78be1a4a871ba8b1dff4eaf83d37f630b00389b5cbc3";
function curriculumFacts(c) {
  return {
    courses: c.courses,
    universities: Object.fromEntries(Object.entries(c.universities).map(([id, u]) => [id, { name: u.name, city: u.city, country: u.country }])),
    tracks: c.tracks.map((t) => ({ id: t.id, name: t.name, abbr: t.abbr, letter: t.letter,
      semesters: t.semesters, thesis: t.thesis, sectors: t.sectors, alsoMentioned: t.alsoMentioned })),
  };
}

test("the redesign preserves the approved factual curriculum and catalogue", () => {
  assert.equal(Object.keys(cohort.courses).length, 53);
  assert.deepEqual(cohort.tracks.map((t) => t.id), ["eeh", "ep", "mhi", "phm"]);
  const actual = crypto.createHash("sha256").update(JSON.stringify(canonical(curriculumFacts(cohort)))).digest("hex");
  assert.equal(actual, FACTS_SHA256, "course facts, elective rules/bundles, routes or official sectors changed; review the source before refreshing this fixture");
});

test("routes, university ownership and thesis choices remain internally consistent", () => {
  const routes = { eeh: ["eur", "uio"], ep: ["uio", "unibo"], mhi: ["uio", "mci"], phm: ["mci", "eur"] };
  for (const t of cohort.tracks) {
    assert.deepEqual(t.semesters.map((s) => s.number), [2, 3]);
    assert.deepEqual(t.semesters.map((s) => s.university), routes[t.id]);
    assert.deepEqual(t.thesis, routes[t.id]);
    for (const semester of t.semesters) {
      for (const id of [...semester.required, ...semester.choices.flatMap((choice) => choice.options.flat())]) {
        assert.ok(cohort.courses[id], `${t.id}: ${id} exists`);
        assert.equal(cohort.courses[id].university, semester.university, `${t.id}: ${id} belongs to the correct university`);
      }
    }
  }
});

test("the original selection rules retain their pairs, separate groups and unknown limit", () => {
  assert.deepEqual(track("eeh").semesters.map((s) => s.choices.map((choice) => choice.rule)), [["Choose one"], ["Choose 10 EC"]]);
  const ep = track("ep").semesters;
  assert.equal(ep[0].choices[0].rule, "Choose one option");
  assert.deepEqual(ep[0].choices[0].options.at(-1), ["uio-fhe4110", "uio-fhe4130"], "the paired Oslo option must remain a bundle");
  assert.deepEqual(ep[1].choices.map((choice) => choice.rule), ["Choose one", "Choose two"]);
  const mhi = track("mhi").semesters;
  assert.equal(mhi[0].choices[0].rule, null, "the unspecified Oslo rule must not become an invented requirement");
  assert.equal(mhi[1].choices[0].rule, "Choose one pair");
  assert.deepEqual(mhi[1].choices[0].options, [["mci-simulation-methods", "mci-simulation-practice"], ["mci-applied-finance", "mci-inclusive-leadership"]]);
  assert.deepEqual(track("phm").semesters[0].choices.map((choice) => choice.rule), ["Choose one", "Choose one"], "PHM retains one choice from each separate group");
  assert.equal(cohort.courses["uio-fhe5100"].credits, null);
  assert.equal(Object.hasOwn(cohort.courses["eur-hta"], "credits"), false);
});

test("the source list remains public, and no contributor quotes are invented", () => {
  const original = ["https://eu-hem.eu/programme/", "https://eu-hem.eu/economic-evaluation-in-healthcare/",
    "https://eu-hem.eu/health-economics-policy/", "https://eu-hem.eu/management-of-healthcare-institutions/",
    "https://eu-hem.eu/population-health-management/",
    "https://www.eur.nl/en/master/european-master-health-economics-and-management/during-your-study",
    "https://www.mci.edu/en/study/master/european-health-economics-management",
    "https://www.uio.no/english/studies/programmes/hem-master/structure/"];
  const urls = cohort.sources.pages.map((source) => source.url);
  for (const url of original) assert.ok(urls.includes(url), `retain original official destination ${url}`);
  for (const url of urls) assert.equal(new URL(url).protocol, "https:");
  for (const t of cohort.tracks) assert.deepEqual(t.student.secondYearQuotes, [], "this release has no approved student quotations");
});

test("theme comparison reports tagged required/offered courses rather than unproved absence", () => {
  assert.deepEqual(Object.fromEntries(cohort.tracks.map((t) => [t.id, H.themeCell(cohort, t, "evaluation").status])),
    { eeh: "required", ep: "elective", mhi: "required", phm: "required" });
  assert.match(H.TRACK_STATUS.none, /tagged.*Semesters?\s*2\s*[–-]\s*3/i);
  const fixture = { courses: { r: { name: "Fictional required", themes: ["x"] }, e: { name: "Fictional option", themes: ["x"] } } };
  const t = { semesters: [{ number: 2, required: ["r"], choices: [{ kind: "elective", options: [["e"], ["e"]] }] }] };
  assert.deepEqual(H.themeCell(fixture, t, "x"), { status: "required", required: ["Fictional required"], elective: ["Fictional option"] });
  assert.deepEqual(H.themeCell(fixture, t, "untagged"), { status: "none", required: [], elective: [] });
});

test("shared courses are identified by course IDs and emitted once; cities keep semester context", () => {
  const fixture = { courses: { x: { name: "Same fictional name" }, y: { name: "Same fictional name" } } };
  const make = (ids) => ({ semesters: [{ number: 2, required: ids, choices: [] }] });
  assert.deepEqual(H.sharedCourses(fixture, make(["x", "x"]), make(["y"])), []);
  assert.deepEqual(H.sharedCourses(fixture, make(["x", "x"]), make(["x"])), [{ id: "x", name: "Same fictional name" }]);
  assert.deepEqual(H.sharedCities(cohort, track("eeh"), track("ep")), [{ city: "Oslo", semesterA: 3, semesterB: 2 }]);
  assert.equal(H.trackRoute(cohort, track("phm")), "Innsbruck → Rotterdam");
});

test("quiz scoring includes all tracks and handles unanswered questions", () => {
  assert.deepEqual(H.quizScores(cohort, [null, { points: { eeh: 3, ep: 1 } }, { points: { ep: 2, mhi: 2 } }]), { eeh: 3, ep: 3, mhi: 2, phm: 0 });
  for (const t of cohort.tracks) {
    const maximum = cohort.quiz.questions.reduce((sum, question) => sum + Math.max(...question.answers.map((answer) => answer.points[t.id] || 0)), 0);
    assert.equal(maximum, cohort.quiz.maxScore, `${t.id}: the maximum shown in the quiz is attainable`);
  }
  for (const question of cohort.quiz.questions) for (const answer of question.answers) {
    for (const [id, points] of Object.entries(answer.points)) {
      assert.ok(H.trackById(cohort, id));
      assert.ok(Number.isFinite(points) && points >= 0);
    }
  }
});

test("quiz ties preserve data order and close matches include the threshold", () => {
  const ranked = H.rankTracks(cohort, { eeh: 7, ep: 7, mhi: 7, phm: 6 });
  assert.deepEqual(ranked.map(({ track: t }) => t.id), ["eeh", "ep", "mhi", "phm"]);
  assert.equal(H.isCloseMatch([{ score: 7 }, { score: 5 }], 2), true);
  assert.equal(H.isCloseMatch([{ score: 7 }, { score: 4 }], 2), false);
  assert.equal(H.isCloseMatch([{ score: 7 }], 2), false);
  const answers = [1, 2, 3, 4];
  const reordered = H.shuffled(answers, () => 0);
  assert.deepEqual(answers, [1, 2, 3, 4]);
  assert.deepEqual(reordered, [2, 3, 4, 1]);
});

test("requested cohorts resolve explicitly, unknown cohorts fall back to the latest", () => {
  const fixture = { cohorts: [{ id: "old" }, { id: "new" }] };
  assert.equal(H.tracksCohort(fixture, "old").id, "old");
  assert.equal(H.tracksCohort(fixture, "missing").id, "new");
  assert.equal(H.trackById(cohort, "missing"), null);
});

test("card filters match published course tags and names without inferring a city or a ranking", () => {
  assert.equal(W.filterMatches(cohort, track("mhi"), "Real Life Simulation Methods", ""), true);
  assert.equal(W.filterMatches(cohort, track("ep"), "Real Life Simulation Methods", ""), false);
  for (const t of cohort.tracks) for (const theme of cohort.themes) {
    const tagged = H.trackCourses(cohort, t).some((entry) => cohort.courses[entry.id].themes.includes(theme.id));
    assert.equal(W.filterMatches(cohort, t, "", theme.id), tagged, `${t.id}: ${theme.id} is backed by a Semester 2/3 course`);
  }
  const fixture = structuredClone(cohort);
  fixture.tracks[0].student = {};
  fixture.tracks[0].focusAreas = [];
  fixture.tracks[0].name = "Fictional focus";
  assert.equal(W.filterMatches(fixture, fixture.tracks[0], "Rotterdam", ""), false, "route cities alone are outside the labelled focus/course search");
  assert.equal(W.filterMatches(cohort, track("eeh"), "", "unsupported-theme"), false);
});

test("the worksheet export preserves complete paired options, unknown credits, source context and chosen notes", () => {
  const marker = "Fictional private worksheet marker.";
  const selectedCheck = guide.checklist[0];
  const text = W.buildComparisonNotes(cohort, guide, ["ep", "mhi"], [selectedCheck.id], marker);
  assert.match(text, /Choose one option/);
  assert.match(text, /Choose one pair/);
  assert.match(text, /how many to choose: Not stated in the source/i);
  for (const [id, t] of [["ep", track("ep")], ["mhi", track("mhi")]]) {
    assert.ok(text.includes(t.name));
    for (const entry of H.trackCourses(cohort, t)) assert.ok(text.includes(cohort.courses[entry.id].name), `${id}: export retains ${entry.id}`);
    for (const semester of t.semesters) for (const choice of semester.choices) for (const bundle of choice.options) {
      if (bundle.length < 2) continue;
      const line = text.split("\n").find((row) => bundle.every((courseId) => row.includes(cohort.courses[courseId].name)));
      assert.ok(line && /courses taken together/.test(line), `${id}: the bundle remains on one explicitly paired option line`);
    }
  }
  assert.ok(text.includes("credits: " + cohort.texts.notStated));
  assert.ok(text.includes("[x] " + selectedCheck.title));
  assert.ok(text.includes(marker));
  for (const source of cohort.sources.pages) assert.ok(text.includes(source.url));
  const unchanged = structuredClone(cohort);
  unchanged.courses["uio-hfin4210"].credits = 0;
  assert.match(W.buildComparisonNotes(unchanged, guide, ["ep", "mhi"], [], ""), /Finance and Investment \[HFIN4210\] \(0 EC\)/);
  assert.throws(() => W.buildComparisonNotes(cohort, guide, ["ep", "ep"]), /different tracks/);
  assert.throws(() => W.buildComparisonNotes(cohort, guide, ["ep", "missing"]), /available tracks/);
  assert.throws(() => W.buildComparisonNotes(cohort, guide, ["ep", "mhi"], [], "x".repeat(2401)), /2,400/);
});

test("preparation guide links are safe, checklist IDs are unique and prompts refer to the current tracks", () => {
  assert.equal(W.validateGuide(guide), guide);
  assert.deepEqual(Object.keys(guide.tracks).sort(), cohort.tracks.map((t) => t.id).sort());
  const badLink = structuredClone(guide);
  badLink.sources[0].url = "javascript:alert('fictional fixture')";
  assert.throws(() => W.validateGuide(badLink), /source link/);
  const repeated = structuredClone(guide);
  repeated.checklist.push(repeated.checklist[0]);
  assert.throws(() => W.validateGuide(repeated), /checklist/);
});
