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

// ----- Programme Journey -----
const events = read("content/programme-events.json");
const J = require(path.join(ROOT, "journey.js"));
const { semesterTiming } = require(path.join(ROOT, "guide-data.js"));
const tracksCohort = read("content/tracks.json").cohorts.find((c) => c.id === events.cohort);
const trackOf = (id) => tracksCohort.tracks.find((tr) => tr.id === id);
const stops = (trackId, today) => J.journeyStops(events, tracksCohort, trackId ? trackOf(trackId) : null, today, semesterTiming);
const place = (list, id) => list.find((s) => s.id === id).place.text;

t("journey: cities come from the saved track (E&P: Oslo then Bologna)", () => {
  const list = stops("ep", "2026-10-06");
  assert.strictEqual(place(list, "semester-1"), "Bologna (University of Bologna)");
  assert.strictEqual(place(list, "semester-2"), "Oslo (University of Oslo)");
  assert.strictEqual(place(list, "semester-3"), "Bologna (University of Bologna)");
  assert.match(place(list, "semester-4"), / or /);
  assert.strictEqual(place(stops(null, "2026-10-06"), "semester-2"), "Depends on your track");
});

t("journey: timing labels and which stage is current", () => {
  const list = stops("phm", "2026-10-06");
  assert.deepStrictEqual(list.map((s) => s.whenLabel), ["autumn 2026", "spring 2027", "June/July 2027", "autumn 2027", "spring 2028", "autumn 2028"]);
  assert.deepStrictEqual(list.map((s) => s.status), ["current", "later", "later", "later", "later", "later"]);
  assert.deepStrictEqual(stops("phm", "2027-03-01").map((s) => s.status).slice(0, 3), ["done", "current", "later"]);
  assert.ok(stops("phm", "2029-01-01").every((s) => s.status === "done"));
});

t("journey: facts from the brief (104 students, 24 nationalities, fees, four titles, history years)", () => {
  const figures = Object.fromEntries(events.cohortNumbers.figures.map((f) => [f.label, f.value]));
  assert.strictEqual(figures.students, "104");
  assert.strictEqual(figures.nationalities, "24");
  assert.strictEqual(events.cohortNumbers.source, "welcome-days-2026");
  assert.deepStrictEqual(Object.keys(events.fees.byCohort), ["2026-2028"]);
  assert.strictEqual(J.euros(events.fees.byCohort["2026-2028"].programmeCountries), "€4,000");
  assert.strictEqual(J.euros(events.fees.byCohort["2026-2028"].partnerCountries), "€9,000");
  assert.strictEqual(events.jointDegree.titles.length, 4);
  assert.deepStrictEqual(events.history.events.map((e) => e.year), [2009, 2010, 2012, 2015, 2018, 2021, 2025]);
  assert.match(events.erasmus.caveat, /balance/);
});

// ----- Support & Contacts -----
const people = read("content/people.json");
global.parseGuide = require(path.join(ROOT, "guide-data.js")).parseGuide;
const S = require(path.join(ROOT, "support.js"));

t("support: only the approved role mailboxes appear in the handbook content", () => {
  const allowed = ["didatticasociale.euhem@unibo.it", "euhem@eshpm.eur.nl", "eu-hem@mci.edu", "garante@unibo.it"];
  for (const file of ["content/sources.json", "content/academic-rules.json", "content/programme-events.json", "content/people.json"]) {
    for (const email of S.emailsIn(read(file))) assert.ok(allowed.includes(email), `${file}: ${email}`);
  }
  assert.deepStrictEqual(S.emailsIn({ a: "Write to Someone.Else@uni.example or x@y.org" }), ["someone.else@uni.example", "x@y.org"]);
});

t("support: no personal titles (Prof., Dr., Mr., Ms.) or Google Sheets links in the handbook content", () => {
  for (const file of ["content/academic-rules.json", "content/programme-events.json", "content/people.json"]) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.doesNotMatch(text, /\b(Prof|Dr|Mr|Ms|Mrs)\.\s+[A-Z]/, file);
    assert.doesNotMatch(text, /docs\.google\.com|drive\.google\.com/, file);
  }
});

t("support: the contact guide asks the university only when it matters", () => {
  const ids = (answers) => S.visibleSupportQuestions(people.contactGuide, answers).map((q) => q.id);
  assert.deepStrictEqual(ids({}), ["topic"]);
  assert.deepStrictEqual(ids({ topic: "enrolment" }), ["topic"]);
  assert.deepStrictEqual(ids({ topic: "wellbeing" }), ["topic", "university"]);
  assert.strictEqual(S.supportOutcome(people, { topic: "wellbeing" }), null);
});

t("support: outcomes point to the right people", () => {
  const enrol = S.supportOutcome(people, { topic: "enrolment" });
  assert.strictEqual(enrol.contacts[0].coordinator.email, "euhem@eshpm.eur.nl");
  const practical = S.supportOutcome(people, { topic: "practical", university: "mci" });
  assert.strictEqual(practical.contacts[0].coordinator.email, "eu-hem@mci.edu");
  const oslo = S.supportOutcome(people, { topic: "practical", university: "uio" });
  assert.strictEqual(oslo.contacts[0].coordinator.email, undefined, "Oslo: official page, no mailbox");
  assert.strictEqual(oslo.contacts[0].coordinator.source, "uio-hem-contact");
  const safety = S.supportOutcome(people, { topic: "safety", university: "eur" });
  assert.ok(safety.emergency);
  assert.ok(safety.contacts[0].items.some((i) => i.source === "eur-safe"));
  const sad = S.supportOutcome(people, { topic: "wellbeing", university: "unibo" });
  assert.ok(sad.contacts[0].items.some((i) => i.source === "unibo-sap"));
  assert.strictEqual(S.supportOutcome(people, { topic: "provisions" }).page.href, "academic-rules.html#special-provisions");
});

t("support: emergency numbers come from the City Guides", () => {
  const text = fs.readFileSync(path.join(ROOT, "docs/content/oslo-guide.md"), "utf8");
  assert.strictEqual(S.emergencyText(text), "113 ambulance, 112 police, 110 fire");
});

console.log(`${n} handbook data checks passed`);
