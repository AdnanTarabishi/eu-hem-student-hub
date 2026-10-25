const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const TOPIC = 'fund-health-economics.moral-hazard';

const topics = readJson('content/modules/fund-health-economics/topics.json');
const topic = topics.find((item) => item.id === TOPIC);
assert.ok(topic, 'Session 8 topic exists');
assert.equal(topic.notes, 'notes/moral-hazard.md');
assert.equal(topic.lecture, 'lectures/session-8.json');

const learningPath = readJson('content/modules/fund-health-economics/learning-path.json');
const session = learningPath.sessions.find((item) => item.number === 8);
assert.equal(session.status, 'available');
assert.equal(session.topic, TOPIC);
assert.ok(session.keywords.includes('VBID'));

const config = readJson('content/modules/fund-health-economics/lectures/session-8.json');
assert.equal(config.topic, TOPIC);
assert.equal(config.classNumber, 8);
assert.equal(config.activities.length, 5);
assert.equal(new Set(config.activities).size, 5);

const notes = fs.readFileSync(path.join(root, 'content/modules/fund-health-economics/notes/moral-hazard.md'), 'utf8');
assert.match(notes, /E\[L\] = p\(eP\) × L\(eL\)/);
assert.match(notes, /Value-Based Insurance Design/);
assert.match(notes, /HMO/);
const review = notes.split('## 5-minute review')[1];
assert.ok(review, '5-minute review exists');
assert.equal((review.match(/^- /gm) || []).length, 10, '5-minute review has ten bullets');

const guide = fs.readFileSync(path.join(root, 'content/modules/fund-health-economics/lectures/session-8.html'), 'utf8');
assert.match(guide, /Ex-ante moral hazard/);
assert.match(guide, /Second-best result/);
assert.match(guide, /HMO/);
assert.doesNotMatch(guide, /<script/i);
assert.doesNotMatch(guide, /FHE_8 Moral Hazard\.pptx/i);

const flashcards = readJson('content/modules/fund-health-economics/flashcards.json').filter((item) => item.topic === TOPIC);
const questions = readJson('content/modules/fund-health-economics/questions.json').filter((item) => item.topic === TOPIC);
assert.equal(flashcards.length, 50);
assert.equal(questions.length, 42);
assert.equal(questions.filter((item) => item.type === 'mcq').length, 26);
assert.equal(questions.filter((item) => item.type === 'true-false').length, 8);
assert.equal(questions.filter((item) => item.type === 'short-answer').length, 8);
assert.equal(new Set([...flashcards, ...questions].map((item) => item.id)).size, 92);

const resources = readJson('content/modules/fund-health-economics/resources.json').filter((item) => item.topic === TOPIC);
assert.ok(resources.some((item) => item.id === 'fund-health-economics.r.208'));

const concepts = readJson('content/concepts.json');
for (const id of ['concept.moral-hazard', 'concept.ex-ante-moral-hazard', 'concept.ex-post-moral-hazard', 'concept.value-based-insurance-design', 'concept.managed-care']) {
  const concept = concepts.find((item) => item.id === id);
  assert.ok(concept, `${id} exists`);
  assert.ok(concept.topics.includes(TOPIC), `${id} links Session 8`);
}

const context = { window: {}, globalThis: {} };
context.globalThis = context.window;
vm.runInNewContext(fs.readFileSync(path.join(root, 'fhem-exam-style-bank.js'), 'utf8'), context, { filename: 'fhem-exam-style-bank.js' });
vm.runInNewContext(fs.readFileSync(path.join(root, 'fhe-session-8-exam.js'), 'utf8'), context, { filename: 'fhe-session-8-exam.js' });
const bank = context.window.FHEMExamStyleBank;
assert.equal(bank.mcqs.filter((item) => item.topic === TOPIC).length, 6);
assert.equal(bank.binaries.filter((item) => item.topic === TOPIC).length, 3);
assert.equal(bank.opens.filter((item) => item.relatedTopics.includes(TOPIC)).length >= 2, true);
for (const item of bank.mcqs.filter((question) => question.topic === TOPIC)) {
  assert.equal(item.options.filter((option) => option.score === 5).length, 1);
  assert.ok(item.options.some((option) => option.score === 2));
}
for (const item of bank.opens.filter((question) => question.id === 'fhem-style-o09' || question.id === 'fhem-style-o10')) {
  assert.equal(item.rubric.reduce((sum, criterion) => sum + criterion.max, 0), 60);
}

console.log('PASS: Session 8 topic, 50 flashcards, 42 questions, five labs, glossary links and exam-style extensions validate.');
