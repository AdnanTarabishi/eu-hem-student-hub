// Handbook content: sources, key dates and the rules that use them (no browser).
// Run: node tests/handbook/data.test.js .
const fs = require("fs"), path = require("path"), assert = require("assert");
const ROOT = path.resolve(process.argv[2] || ".");
const P = require(path.join(ROOT, "programme.js"));
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const programme = read("content/programme.json");
const sources = read("content/sources.json");
const cohort = P.currentCohort(programme);
let n = 0; const t = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

// dashboard.js runs in the browser, where programme.js functions are globals
Object.assign(global, P);
const { examPeriodText } = require(path.join(ROOT, "dashboard.js"));

t("every source has an id, a known type and a check date", () => {
  for (const s of sources.sources) {
    assert.ok(/^[a-z0-9-]+$/.test(s.id), s.id);
    assert.ok(sources.types[s.type], `${s.id}: type ${s.type}`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(s.lastChecked), s.id);
  }
});

t("the student reps and ESN are tips, the handbook is official", () => {
  const kind = (id) => sources.types[sources.sources.find((s) => s.id === id).type].kind;
  assert.strictEqual(kind("euhem-handbook-2026"), "official");
  assert.strictEqual(kind("student-reps-2026"), "tip");
  assert.strictEqual(kind("esn-bologna-guide-2026"), "tip");
});

t("the 2026 key dates match the handbook", () => {
  const byId = Object.fromEntries(P.keyDates(cohort).map((d) => [d.id, d]));
  assert.deepStrictEqual([byId["exams-term-1"].start, byId["exams-term-1"].end], ["2026-10-26", "2026-11-07"]);
  assert.deepStrictEqual([byId["exams-term-2"].start, byId["exams-term-2"].end], ["2026-12-17", "2026-12-23"]);
  assert.deepStrictEqual([byId["resits-winter"].start, byId["resits-winter"].end], ["2027-01-07", "2027-02-06"]);
  assert.strictEqual(byId["reenrolment-deadline"].start, "2027-08-01");
  for (const d of P.keyDates(cohort)) assert.ok(sources.sources.some((s) => s.id === d.source), d.id);
});

t("key dates are sorted by start", () => {
  const starts = P.keyDates(cohort).map((d) => d.start);
  assert.deepStrictEqual(starts, [...starts].sort());
});

t("date ranges read naturally", () => {
  const f = (start, end) => P.formatKeyDateRange({ start, end });
  assert.strictEqual(f("2026-10-26", "2026-11-07"), "26 Oct – 7 Nov 2026");
  assert.strictEqual(f("2026-12-17", "2026-12-23"), "17–23 Dec 2026");
  assert.strictEqual(f("2027-08-01", "2027-08-01"), "1 Aug 2027");
  assert.strictEqual(f("2026-12-17", "2027-01-06"), "17 Dec 2026 – 6 Jan 2027");
  assert.strictEqual(f("2027-01", "2027-02"), "Jan – Feb 2027");
  assert.strictEqual(f("2027-05", "2027-05"), "May 2027");
});

t("the homepage shows the next exam period, or the current one", () => {
  assert.strictEqual(examPeriodText(cohort, "2026-10-06"), "Next exam period: 26 Oct – 7 Nov 2026");
  assert.strictEqual(examPeriodText(cohort, "2026-10-30"), "Exam period now: 26 Oct – 7 Nov 2026");
  assert.strictEqual(examPeriodText(cohort, "2026-11-08"), "Next exam period: 17–23 Dec 2026");
  assert.strictEqual(examPeriodText(cohort, "2027-01-10"), "Exam period now: 7 Jan – 6 Feb 2027");
  assert.strictEqual(examPeriodText(cohort, "2027-03-01"), null);
});

t("month-only dates count until the end of their month", () => {
  const erasmus = P.keyDates(cohort).find((d) => d.id === "erasmus-almarm");
  assert.strictEqual(P.nextKeyDate(cohort, "deadline", "2027-02-20"), erasmus);
  assert.strictEqual(P.nextKeyDate(cohort, "deadline", "2027-03-01").id, "reenrolment-deadline");
});

// ----- Academic Rules: the re-sit guide -----
const rules = read("content/academic-rules.json");
const R = require(path.join(ROOT, "academic-rules.js"));
const texts = (outcome) => [...outcome.items, ...outcome.universityItems].map((i) => i.text).join(" ");

t("re-sit guide: the location question appears only after a failed exam", () => {
  const ids = (answers) => R.visibleQuestions(rules.resitGuide, answers).map((q) => q.id);
  assert.deepStrictEqual(ids({}), ["university", "attempt"]);
  assert.deepStrictEqual(ids({ university: "eur", attempt: "improve" }), ["university", "attempt"]);
  assert.deepStrictEqual(ids({ university: "eur", attempt: "failed" }), ["university", "attempt", "location"]);
  assert.strictEqual(R.resitOutcome(rules, { university: "eur", attempt: "failed" }), null);
});

t("re-sit guide: failed an EUR exam, now elsewhere -> ask a month ahead, EUR only on campus or proctored", () => {
  const outcome = R.resitOutcome(rules, { university: "eur", attempt: "failed", location: "other" });
  assert.strictEqual(outcome.key, "failed-other");
  assert.match(texts(outcome), /one month before/);
  assert.match(texts(outcome), /online proctoring/);
  assert.match(texts(outcome), /one re-sit per academic year/);
});

t("re-sit guide: improving a grade shows that university's own rule", () => {
  assert.match(texts(R.resitOutcome(rules, { university: "unibo", attempt: "improve" })), /before the grade is registered/);
  assert.match(texts(R.resitOutcome(rules, { university: "eur", attempt: "improve" })), /higher grade counts/);
  assert.doesNotMatch(texts(R.resitOutcome(rules, { university: "unibo", attempt: "failed", location: "other" })), /proctoring/);
});

t("academic rules: grading scales for all four universities, with the pass marks from the brief", () => {
  const pass = Object.fromEntries(rules.grading.scales.map((s) => [s.university, s.pass]));
  assert.deepStrictEqual(Object.keys(pass).sort(), ["eur", "mci", "uio", "unibo"]);
  assert.strictEqual(pass.unibo, "18");
  assert.strictEqual(pass.uio, "E");
  assert.strictEqual(pass.eur, "5.5");
  assert.match(rules.grading.note, /not a conversion/);
});

console.log(`${n} handbook data checks passed`);
