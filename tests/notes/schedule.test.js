const assert = require("node:assert/strict");
const fs = require("node:fs");
const schedule = require("../../notes-schedule.js");
const programme = require("../../content/programme.json");
const cohort = programme.cohorts.at(-1), term = cohort.terms[0];
const course = id => term.courses.find(c => c.id === id);
const counts = today => term.courses.reduce((all, c) => {
  const key = schedule.courseStatus(c, today).key;
  all[key] = (all[key] || 0) + 1;
  return all;
}, {});

assert.deepEqual(counts("2026-10-07"), { finished: 2, now: 3, upcoming: 3 });
assert.deepEqual(counts("2026-10-08"), { finished: 2, now: 4, upcoming: 2 });
const economics = course("fund-health-econ-management");
assert.equal(schedule.courseStatus(economics, "2026-10-22").key, "now");
const gap = schedule.courseStatus(economics, "2026-10-23");
assert.equal(gap.key, "upcoming");
assert.equal(gap.resumes, true);
assert.equal(gap.nextDate, "2026-11-10");
assert.deepEqual(gap.modules.map(m => m.key), ["finished", "upcoming"]);
assert.equal(schedule.courseStatus(economics, "2026-11-10").key, "now");
assert.equal(schedule.courseStatus(economics, "2026-12-04").key, "finished");
assert.equal(schedule.courseStatus({ modules: [{ teachingStart: "2026-01-01" }] }, "2026-10-07").key, "other");
assert.equal(schedule.courseStatus({ modules: [] }, "2026-10-07").key, "other");
assert.equal(schedule.courseStatus({ modules: [{ teachingStart: "2026-09-01", teachingEnd: "2026-09-10" }, {}] }, "2026-10-07").key, "other");
console.log("PASS: current/upcoming/completed courses, inclusive boundaries, integrated-course gaps and missing dates.");

assert.equal(schedule.clock(new Date("2026-10-06T23:30:00Z")), "2026-10-07T01:30:00");
assert.equal(schedule.clock(new Date("2026-10-27T09:30:00Z")), "2026-10-27T10:30:00");
const exams = [
  { dateKey: "2026-10-06", time: "10:00", courseIds: ["a"] },
  { dateKey: "2026-10-07", time: "09:00", courseIds: ["a"] },
  { dateKey: "2026-10-07", time: "11:00", courseIds: ["b"] },
  { dateKey: "2026-10-07", time: "12:00", courseIds: ["a", "b"] },
  { dateKey: "2026-10-08", time: "9:00", courseIds: ["a"] },
];
assert.equal(schedule.nextExam(exams, "a", "2026-10-07T10:00:00").time, "12:00");
assert.equal(schedule.nextExam(exams, null, "2026-10-07T10:00:00").time, "11:00");
assert.equal(schedule.nextExam(exams, "a", "2026-10-07T12:00:00").time, "12:00");
assert.equal(schedule.nextExam(exams, "a", "2026-10-07T12:00:01").dateKey, "2026-10-08");
assert.equal(schedule.nextExam(exams, "a", "2026-10-07T12:01:00").dateKey, "2026-10-08");
assert.equal(schedule.nextExam(exams, "unknown", "2026-10-07T10:00:00"), null);
assert.equal(schedule.nextExam(exams, "a", "2026-11-01T10:00:00"), null);
assert.equal(schedule.nextExam([{ dateKey: "2026-10-07", time: "", courseIds: ["a"] }], "a", "2026-10-07T23:00:00").dateKey, "2026-10-07");
console.log("PASS: Bologna time across daylight-saving boundaries; past sittings excluded by time and shared course codes preserved.");

const text = fs.readFileSync(`calendar/eu-hem-${cohort.id}-year${term.year}.ics`, "utf8");
const cached = schedule.calendarExams(text, term);
assert.equal(cached.length, 16);
assert.ok(cached.every(e => e.time === ""), "fallback must not assert the calendar export's default time");
assert.ok(cached.find(e => e.title === "Econometrics").courseIds.includes("quant-methods"));
assert.ok(!cached.find(e => e.title === "Econometrics").courseIds.includes("fund-quant-methods"));
assert.ok(cached.find(e => e.title === "Fundamentals of Econometrics").courseIds.includes("fund-quant-methods"));
assert.equal(schedule.nextExam(cached, "fund-health-econ-management", "2026-10-07T10:00:00").dateKey, "2026-10-27");
assert.equal(schedule.nextExam(cached, "right-to-health", "2026-10-07T10:00:00").dateKey, "2026-11-04");
assert.equal(schedule.nextExam(cached, "health-systems", "2026-10-07T10:00:00"), null);
assert.throws(() => schedule.calendarExams("an error page", term), /Invalid calendar/);
console.log("PASS: real calendar folding/escaping, exact module matches, no guessed course matches or exam dates.");
