const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'fhem-exam-style-bank.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context, { filename: 'fhem-exam-style-bank.js' });
const session8 = fs.readFileSync(path.join(root, 'fhe-session-8-exam.js'), 'utf8');
vm.runInNewContext(session8, context, { filename: 'fhe-session-8-exam.js' });
const bank = context.window.FHEMExamStyleBank;
assert.ok(bank, 'exam-style bank should load');
assert.equal(bank.schemaVersion, 1);
assert.equal(bank.mcqs.length, 30);
assert.equal(bank.binaries.length, 15);
assert.equal(bank.opens.length, 10);
assert.equal(bank.fixedMocks.length, 2);
assert.equal(bank.format.rawMax, 106);

const all = [...bank.mcqs, ...bank.binaries, ...bank.opens];
assert.equal(new Set(all.map((item) => item.id)).size, all.length, 'question ids must be unique');

for (const question of bank.mcqs) {
  assert.equal(question.type, 'exam-mcq');
  assert.ok(question.options.length >= 4);
  assert.equal(question.options.filter((option) => option.score === 5).length, 1, `${question.id}: one fully correct option`);
  assert.ok(question.options.some((option) => option.score === 2), `${question.id}: at least one partly correct option`);
  assert.ok(question.options.every((option) => [-1, 2, 5].includes(option.score)), `${question.id}: valid score values`);
}

for (const question of bank.binaries) {
  assert.equal(question.type, 'exam-binary');
  assert.equal(question.options.length, 2);
  assert.deepEqual([...question.options.map((option) => option.score)].sort((a, b) => a - b), [-2, 8]);
}

for (const question of bank.opens) {
  assert.equal(question.type, 'exam-open');
  assert.equal(question.rubric.reduce((sum, criterion) => sum + criterion.max, 0), 60, `${question.id}: rubric totals 60`);
  assert.ok(question.tasks.length >= 3);
  assert.ok(question.modelOutline.length >= 4);
  assert.ok(question.commonMisses.length >= 3);
}

const ids = new Set(all.map((item) => item.id));
for (const mock of bank.fixedMocks) {
  assert.equal(mock.mcqIds.length, 6);
  assert.equal(mock.binaryIds.length, 2);
  assert.ok(ids.has(mock.openId));
  for (const id of [...mock.mcqIds, ...mock.binaryIds]) assert.ok(ids.has(id), `${mock.id}: ${id} resolves`);
}

const pathData = JSON.parse(fs.readFileSync(path.join(root, 'content/modules/fund-health-economics/learning-path.json'), 'utf8'));
const availableTopics = new Set(pathData.sessions.filter((session) => session.status === 'available').map((session) => session.topic));
for (const question of [...bank.mcqs, ...bank.binaries]) assert.ok(availableTopics.has(question.topic), `${question.id}: topic is available`);
for (const question of bank.opens) for (const topic of question.relatedTopics) assert.ok(availableTopics.has(topic), `${question.id}: related topic ${topic} is available`);

console.log('PASS: 30 MCQs, 15 binary traps, 10 open cases, two fixed 6+2+1 mocks and 60-point rubrics validate.');
