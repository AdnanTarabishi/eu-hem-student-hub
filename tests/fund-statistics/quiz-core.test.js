// Independent state/grade contracts; browser interaction is checked separately.
const assert = require('node:assert/strict');
const C = require('../../fund-statistics-quiz-core.js');
const legacy = [{ id: 'fund-statistics.q.001', topic: 'core', type: 'mcq', question: 'Pick three.', options: ['3', '4', '5', '6'], answer: 'A' }];
const supplement = { questions: [
  { id: 'fund-statistics.self.001', topic: 'core', type: 'multi-select', question: 'Pick both.', options: ['a','b','c'], answer: [0, 2] },
  { id: 'fund-statistics.self.002', topic: 'core', type: 'numeric', question: 'A probability?', answer: .125, tolerance: .0005, unit: '' },
  { id: 'fund-statistics.self.003', topic: 'core', type: 'written', question: 'Interpret.', answer: 'Population interpretation', rubric: ['Target','Units','Uncertainty'] },
  { id: 'fund-statistics.q.069', topic: 'core', type: 'mcq', question: 'Power?', options: ['1−β','β'], answer: 'A' },
  { id: 'fund-statistics.q.076', topic: 'fund-statistics.two-means', type: 'mcq', question: 'Additional?', options: ['yes','no'], answer: 'A' }
] };
const bank = C.normalize(legacy, supplement), [mcq, multi, numeric, written] = bank;
assert.equal(bank.length, 6); assert.equal(mcq.answer, 0); assert.equal(bank[4].supplementary, true); assert.equal(bank[5].supplementary, true);
assert.equal(C.normalize([...legacy, ...legacy], supplement).length, 6);
assert.equal(C.grade(mcq, 0).correct, true); assert.equal(C.grade(mcq, 1).correct, false);
assert.equal(C.grade(mcq, null).status, 'empty'); assert.equal(C.grade(mcq, '0').status, 'invalid');
assert.equal(C.grade(multi, [2,0]).correct, true); assert.equal(C.grade(multi, [0]).correct, false);
assert.equal(C.grade(multi, [0,1,2]).correct, false); assert.equal(C.grade(multi, [0,0,2]).status, 'invalid');
assert.equal(C.grade(numeric, '.125').correct, true); assert.equal(C.grade(numeric, '1.25e-1').correct, true);
assert.equal(C.grade(numeric, '.1255').correct, true); assert.equal(C.grade(numeric, '.12551').correct, false);
for (const value of ['NaN','Infinity','1e999','0x10','12.5%','0,125','1 2']) assert.equal(C.grade(numeric, value).status, 'invalid', value);
assert.equal(C.grade(numeric, '').status, 'empty'); assert.equal(C.grade(written, 'An interpretation').correct, null);
assert.equal(C.grade({...numeric, answer: 1e-16, tolerance: 1e-18}, '0').correct, false, 'tolerance does not erase tiny positive answers');
const mixed = [];
for (let t = 0; t < 5; t++) for (const type of ['mcq','multi-select','numeric','written']) for (let n = 0; n < 2; n++) mixed.push({...mcq,id:`fund-statistics.self.${t}-${type}-${n}`,topic:`topic-${t}`,type});
const selected = C.balanced(mixed, 20, () => .3);
assert.equal(new Set(selected.map(q=>q.id)).size,20);
for (let t = 0; t < 5; t++) { const group=selected.filter(q=>q.topic===`topic-${t}`);assert.equal(group.length,4);assert.equal(new Set(group.map(q=>q.type)).size,4); }
let state = C.empty(); state.active = C.createSession([mcq, numeric, written], {mode:'learn',minutes:15}, 1000, () => .1);
assert.equal(state.active.deadline, 901000); const order = JSON.parse(JSON.stringify(state.active.order));
state.active.drafts[mcq.id] = 1; C.freeze(state, mcq, 1); state.active.checked[mcq.id] = true;
state.active.drafts[mcq.id] = 0; assert.equal(C.freeze(state, mcq, 0), false);
assert.equal(state.records[mcq.id].attempts,1); assert.equal(state.records[mcq.id].lastCorrect,false);
let restored = C.repair(JSON.parse(JSON.stringify(state)), bank);
assert.deepEqual(restored.active.order, order); assert.equal(restored.active.drafts[mcq.id],0); assert.equal(restored.active.first[mcq.id].given,1);
C.finish(state, bank, 901001, true); assert.equal(C.finish(state,bank,901002),false); assert.equal(state.history.length,1);
let score = C.summary(state.active,bank);assert.equal(score.total,2);assert.equal(score.correct,0);assert.equal(score.unanswered,1);assert.equal(score.manual,1);assert.equal(state.records[written.id],undefined);assert.equal(state.written[written.id].attempts,1);
state.active=C.createSession([mcq],{mode:'learn'},1000000,()=>.1);C.freeze(state,mcq,0,true);C.finish(state,bank,1000001);
assert.equal(state.records[mcq.id].lastCorrect,true);assert.equal(state.records[mcq.id].lastAssisted,true);
score=C.summary(state.active,bank);assert.equal(score.correct,1);assert.equal(score.assisted,1);assert.equal(score.independentTotal,0);
state.active=C.createSession([mcq],{mode:'test'},2000000,()=>.1);state.active.drafts[mcq.id]=0;C.finish(state,bank,2000001);
assert.equal(state.records[mcq.id].lastAssisted,false);assert.equal(state.records[mcq.id].misses,1);assert.equal(state.records[mcq.id].attempts,3);
// Answer/key/tolerance changes invalidate relevant scores; explanatory edits do not.
const altered=bank.map(q=>q.id===mcq.id?{...q,answer:1}:q);
restored=C.repair(JSON.parse(JSON.stringify(state)),altered);assert.equal(restored.records[mcq.id],undefined);assert.equal(restored.active,null);assert.equal(restored.history.length,0);
restored=C.repair(state,bank.map(q=>({...q,explanation:'Improved explanation'})));assert.ok(restored.records[mcq.id]);
let broken=JSON.parse(JSON.stringify(state));broken.active.order[mcq.id]=[0,0,2,3];assert.equal(C.repair(broken,bank).active,null);
broken=JSON.parse(JSON.stringify(state));broken.active.first[mcq.id].correct=false;assert.equal(C.repair(broken,bank).active.first[mcq.id].correct,true);
for(const bad of [null,[],{version:9},'bad']) assert.deepEqual(C.repair(bad,bank),C.empty());
// A fresh written-only self-test has usable result rubrics before any restore/reload.
const freshWritten=C.empty();freshWritten.active=C.createSession([written],{mode:'test'},1000,()=>.2);
C.finish(freshWritten,bank,2000);assert.deepEqual(freshWritten.active.rubrics[written.id],[false,false,false]);
freshWritten.active.rubrics[written.id][0]=true;assert.equal(freshWritten.active.rubrics[written.id][0],true);
const changedRubric=bank.map(q=>q.id===written.id?{...q,rubric:q.rubric.slice().reverse()}:q);
const repairedWritten=C.repair(freshWritten,changedRubric);assert.equal(repairedWritten.active,null);assert.equal(repairedWritten.written[written.id],undefined);
// A clock deadline determines expiry even if the caller submits before the next timer tick.
let late=C.empty();late.active=C.createSession([mcq],{mode:'test',minutes:15},1000,()=>.2);
C.finish(late,bank,901001,false);assert.equal(late.active.expired,true);assert.equal(late.records[mcq.id].lastCorrect,false);
let reveal=C.empty();reveal.active=C.createSession([numeric],{mode:'learn'},1000,()=>.2);
C.freeze(reveal,numeric,'',true);C.finish(reveal,bank,2000);const revealed=C.summary(reveal.active,bank);
assert.equal(revealed.correct,0);assert.equal(revealed.unanswered,1);assert.equal(revealed.assisted,1);assert.equal(revealed.independentTotal,0);
console.log('Quiz core passed: strict numeric/multi grading, balanced unique sessions, stable shuffle/drafts/deadlines, frozen first results, assisted review, manual exclusion, stale-state repair and idempotent finish.');
