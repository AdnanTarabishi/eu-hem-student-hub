const assert = require('node:assert/strict');
const fs = require('node:fs');
const W = require('../../exams-workspace.js');
const C = require('../../timetable-calendar.js');
const programme = JSON.parse(fs.readFileSync('content/programme.json', 'utf8'));
const term = programme.cohorts[0].terms[0], intro = term.courses.find(c => c.id === 'intro-economics');
const make = (id, code, date='2026-10-27', time='09:00') => ({courseIds:[id],codes:[code],moduleCodes:[code],title:id,dateKey:date,time,teachers:[],place:'Test room'});
let count=0;
function test(name, run){run();count++;console.log('  ok  '+name);}
test('strict dates reject absent, malformed and impossible dates',()=>{for(const d of ['2026-10-27','2028-02-29'])assert.ok(W.validDate(d));for(const d of ['',null,'2026-02-29','2026-2-01'])assert.equal(W.validDate(d),false);});
test('lecturer date is available once when the feed has no matching entry',()=>{const rows=W.events([],term);assert.equal(rows.length,1);assert.equal(rows[0].origin,'lecturer');assert.equal(rows[0].dateKey,intro.assessmentNotice.sessionDate);assert.equal(rows[0].registrationCloses,'');assert.equal(rows[0].administrative,true);});
test('matching official recording date is enriched, never duplicated or stripped of booking dates',()=>{const input=[{...make(intro.id,intro.code),registrationOpens:'2026-10-10',registrationCloses:'2026-10-25'}];const copy=JSON.stringify(input),rows=W.events(input,term);assert.equal(rows.length,1);assert.equal(rows[0].origin,'unibo');assert.equal(rows[0].registrationCloses,'2026-10-25');assert.equal(JSON.stringify(input),copy);});
test('a different live time is preserved with a conflict note rather than overwritten',()=>{const rows=W.events([make(intro.id,intro.code,'2026-10-27','10:00')],term);assert.equal(rows.length,1);assert.equal(rows[0].time,'10:00');assert.equal(rows[0].noticeTimeDiffers,true);});
test('other sittings are preserved when an email-only date is supplied',()=>{const rows=W.events([make(intro.id,intro.code,'2027-01-15')],term);assert.equal(rows.length,2);assert.equal(rows.filter(r=>r.origin==='lecturer').length,1);});
test('groups preserve all course and component dates without labelling personal attempts',()=>{const rows=[make('quant-methods','32626','2026-12-17'),make('quant-methods','74948'),make('quant-methods','74948','2027-01-15'),make('right-to-health','96500')];const groups=W.groups(rows);assert.equal(groups.length,2);const group=groups.find(g=>g.courseId==='quant-methods');assert.equal(group.modules.size,2);assert.equal(group.exams.length,3);assert.equal(group.exams[0].dateKey,'2026-10-27');});
test('different courses with the same day and time remain independent',()=>{assert.equal(W.groups([make('a','1'),make('b','2')]).length,2);});
test('study routes stay on the right course and require actual supported module practice',()=>{const course=term.courses.find(c=>c.id==='quant-methods');const catalogue={statistics:{revision:true,questions:20,cards:0,questionTopic:'statistics.normal'}};const stats=W.studyLinks(course,[make(course.id,'74948')],catalogue),eco=W.studyLinks(course,[make(course.id,'32626')],catalogue);assert.equal(stats.label,'Revise now');assert.match(stats.practice,/course=quant-methods&tab=practice/);assert.match(stats.practice,/practiceTopic=statistics.normal#quiz/);assert.equal(eco.practice,'');assert.equal(eco.label,'Course resources');assert.match(eco.revise,/course=quant-methods&tab=resources/);});
test('unknown study content falls back to resources, without a fake quiz link',()=>{const c=term.courses.find(c=>c.id==='right-to-health');assert.equal(W.studyLinks(c,[make(c.id,c.code)],{}).practice,'');});
test('calendar helpers cover leap years, winter rollover and Bologna DST boundaries',()=>{assert.equal(C.shiftMonth('2026-12-01',1),'2027-01-01');assert.equal(C.monthDays('2028-02-01').filter(d=>d.inMonth).length,29);assert.equal(C.addDays('2026-10-25',1),'2026-10-26');});
test('table rounds split at the cohort New Year and preserve all published dates without mutating input',()=>{
  const rows=[make('a','1','2027-07-02'),make('a','1','2026-12-31'),make('b','2','2027-01-01'),make('a','1','2027-02-06'),make('a','1','2027-01-22')];
  const copy=JSON.stringify(rows),rounds=W.rounds(rows,programme.cohorts[0]);
  assert.deepEqual(rounds.map(({id,label,cutoff})=>({id,label,cutoff})),[
    {id:'first',label:'First round',cutoff:'2027-01-01'},
    {id:'second',label:'Second round',cutoff:'2027-01-01'},
  ]);
  assert.deepEqual(rounds[0].exams.map(row=>row.dateKey),['2026-12-31']);
  assert.deepEqual(rounds[1].exams.map(row=>row.dateKey),['2027-01-01','2027-01-22','2027-02-06','2027-07-02']);
  assert.equal(rounds.flatMap(round=>round.exams).length,rows.length);
  assert.equal(JSON.stringify(rows),copy);
});
test('table round boundaries use the selected future cohort rather than a hard-coded year',()=>{
  const rows=[make('a','1','2030-12-31'),make('a','1','2031-01-01')];
  const rounds=W.rounds(rows,{...programme.cohorts[0],id:'2030-31',label:'2030/31'});
  assert.equal(rounds[0].cutoff,'2031-01-01');
  assert.deepEqual(rounds.map(round=>round.exams.map(row=>row.dateKey)),[['2030-12-31'],['2031-01-01']]);
});
test('both empty round definitions remain available for absent dates and January-only sources',()=>{
  const empty=W.rounds([],programme.cohorts[0]);
  assert.deepEqual(empty.map(round=>round.exams),[[],[]]);
  const january=W.rounds([make('a','1','2027-01-22')],programme.cohorts[0]);
  assert.deepEqual(january.map(round=>round.exams.length),[0,1]);
});
test('rounds sort times within each date and keep administrative recordings distinct from exams',()=>{
  const rows=[make('a','1','2027-01-22','15:00'),{...make('a','1','2026-12-31'),administrative:true},make('a','1','2027-01-22','09:00')];
  const rounds=W.rounds(rows,programme.cohorts[0]);
  assert.equal(rounds[0].exams[0].administrative,true);
  assert.deepEqual(rounds[1].exams.map(row=>row.time),['09:00','15:00']);
});
console.log(`${count} Exams workspace data checks passed`);
