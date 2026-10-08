'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const W = require('../toolkit-workbench-core.js'), A = require('../toolkit-academic-core.js');
const L = require('../toolkit-life-core.js'), P = require('../toolkit-planning-core.js'), R = require('../toolkit-career-core.js');
const cleaners = {
  'economics-graphs': A.cleanEconomics, 'sample-size': A.cleanSample,
  'study-session-planner': P.cleanState, 'four-city-budget': L.cleanBudgetState,
  'moving-checklist': L.cleanMovingState, 'document-deadlines': R.cleanDocuments,
  'career-tracker': R.cleanCareer
};
const full = () => ({ ...W.empty(), tools: Object.fromEntries(W.IDS.map(id => [id, cleaners[id]({})])) });
test('seven tool snapshots survive one bounded workbench backup without other Hub data', () => {
  const source = full(); source.tools['economics-graphs'].shiftA = 25;
  source.tools['career-tracker'].opportunities = [{id:'o-test',organisation:'Fictional Health Team',role:'Analyst',stage:'interested',deadline:'2027-02-01',followup:'',nextAction:'Review the role description'}];
  const text = W.exportStore(source, cleaners);
  assert.deepEqual(W.parseImport(text, cleaners), source);
  assert.deepEqual(Object.keys(JSON.parse(text)), ['format','version','tools']);
  assert.equal(JSON.parse(text).tools['economics-graphs'].shiftA, 25);
});
test('a malformed second tool rejects the whole import rather than partially accepting it', () => {
  const source = full(); source.tools['document-deadlines'] = {version:1,documents:[{id:'d-test',label:'Fictional insurance',date:'2027-02-30',noticeDays:7}]};
  const before = JSON.stringify(source.tools['economics-graphs']);
  assert.throws(() => W.parseImport(JSON.stringify(source), cleaners), /document-deadlines/);
  assert.equal(JSON.stringify(source.tools['economics-graphs']), before);
});
test('foreign backups and unknown tool IDs are rejected', () => {
  for (const raw of [{version:1,lists:[]}, {...W.empty(),version:2}, {...W.empty(),tools:[]}, {...W.empty(),secret:'x'}, {...W.empty(),tools:{'future-tool':{}}}]) {
    assert.throws(() => W.parseImport(JSON.stringify(raw), cleaners));
  }
});
test('prototype names and extra tool fields cannot enter a restored store', () => {
  assert.throws(() => W.parseImport('{"format":"euhem-toolkit-workbench","version":1,"tools":{"__proto__":{"polluted":true}}}', cleaners), /unknown planner/);
  const source=full(); source.tools['sample-size'].constructor='bad';
  assert.throws(() => W.parseImport(JSON.stringify(source), cleaners), /unknown field/);
  assert.equal({}.polluted, undefined);
});
test('backup limits count UTF-8 bytes rather than only JavaScript characters', () => {
  assert.equal(W.bytes('€🙂'), 7);
  assert.throws(() => W.parseImport(' '.repeat(100001), cleaners), /100 KB/);
  assert.throws(() => W.parseImport('€'.repeat(33334), cleaners), /100 KB/);
});
test('invalid JSON, null and oversized array payloads are rejected', () => {
  for (const text of ['not JSON','null','[]','{"format":']) assert.throws(() => W.parseImport(text, cleaners));
});
test('lenient device recovery retains valid tools while dropping damaged snapshots', () => {
  const source=full(); source.tools['sample-size'].confidence=100; source.tools['unknown']={};
  const recovered=W.cleanStore(source,cleaners);
  assert.equal(Object.keys(recovered.tools).length,6);
  assert.equal(recovered.tools['sample-size'],undefined);
  assert.deepEqual(recovered.tools['economics-graphs'],A.cleanEconomics({}));
});
test('empty backup is valid and explicitly represents resetting workbench planners', () => {
  assert.deepEqual(W.parseImport(W.exportStore(W.empty(),cleaners),cleaners),W.empty());
});
