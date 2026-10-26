const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..", "..");
const dataSource = fs.readFileSync(path.join(root, "review", "fhem-final-review-data.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(dataSource, context, { filename: "fhem-final-review-data.js" });
const data = context.window.FHEMFinalReviewData;

assert.ok(data, "final review data should load");
assert.equal(data.schemaVersion, 1);
assert.equal(data.examDate, "2026-10-27");
assert.equal(data.format.minutes, 90);
assert.equal(data.format.sections.find((item) => item.id === "A").count, 6);
assert.equal(data.format.sections.find((item) => item.id === "B").count, 2);
assert.equal(data.format.sections.find((item) => item.id === "C").count, 1);
assert.equal(data.format.rawMax, 106);

assert.equal(data.sessions.length, 8);
assert.deepEqual([...data.sessions.map((item) => item.number)], [1, 2, 3, 4, 5, 6, 7, 8]);
assert.equal(new Set(data.sessions.map((item) => item.id)).size, 8);
for (const session of data.sessions) {
  assert.ok(session.core.length > 80, `Session ${session.number}: substantial core summary`);
  assert.ok(session.mustExplain.length > 60, `Session ${session.number}: exam target`);
  assert.ok(session.traps.length >= 2, `Session ${session.number}: traps`);
  assert.match(session.link, /^\.\.\/lecture\.html\?topic=/);
}

assert.ok(data.confusionPairs.length >= 10);
assert.ok(data.rapidQuestions.length >= 26);
assert.equal(new Set(data.rapidQuestions.map((item) => item.id)).size, data.rapidQuestions.length);
for (const question of data.rapidQuestions) {
  assert.ok(question.options.length >= 2);
  assert.equal(question.options.filter((item) => item.correct).length, 1, `${question.id}: one correct option`);
  assert.ok(question.takeaway.length > 20);
}

assert.equal(data.diagnostic.mcqs.length, 6);
assert.equal(data.diagnostic.binaries.length, 2);
for (const question of data.diagnostic.mcqs) {
  assert.equal(question.options.filter((item) => item.score === 5).length, 1, `${question.id}: one fully correct option`);
  assert.ok(question.options.some((item) => item.score === 2), `${question.id}: partial-credit option`);
  assert.ok(question.options.every((item) => [-1, 2, 5].includes(item.score)), `${question.id}: valid MCQ scores`);
}
for (const question of data.diagnostic.binaries) {
  assert.deepEqual([...question.options.map((item) => item.score)].sort((a, b) => a - b), [-2, 8]);
}
assert.ok(data.diagnostic.open.tasks.length >= 4);
assert.ok(data.diagnostic.open.modelOutline.length >= 6);
assert.equal(data.openRubric.reduce((sum, item) => sum + item.max, 0), 60);
assert.ok(data.lastTwenty.length >= 8);

const html = fs.readFileSync(path.join(root, "review", "fhem-final-review.html"), "utf8");
for (const id of ["exam-strategy", "study-plan", "session-map", "grossman-ta", "confusions", "graphs", "rapid-recall", "diagnostic", "open-question", "last-twenty"]) {
  assert.match(html, new RegExp(`id="${id}"`), `HTML contains ${id}`);
}
assert.match(html, /Grossman in five pictures/);
assert.match(html, /A physician fee cut has two opposing effects/);
assert.match(html, /fhem-final-review-data\.js/);
assert.match(html, /fhem-final-review\.js/);

const resources = JSON.parse(fs.readFileSync(path.join(root, "content", "modules", "fund-health-economics", "resources.json"), "utf8"));
const finalReview = resources.find((item) => item.id === "fund-health-economics.r.final-review");
const taReview = resources.find((item) => item.id === "fund-health-economics.r.ta-22oct");
assert.ok(finalReview, "final review resource is registered");
assert.ok(taReview, "TA review anchor is registered");
assert.match(finalReview.url, /review\/fhem-final-review\.html$/);
assert.match(taReview.url, /review\/fhem-final-review\.html#grossman-ta$/);

console.log(`PASS: final review validates 8 sessions, ${data.rapidQuestions.length} rapid questions, exact 6+2+1 diagnostic and 60-point rubric.`);
