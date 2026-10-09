// Deterministic teaching progress; no network, private data or attendance assumptions.
const assert = require('node:assert/strict');
const { monthlyProgress: progress } = require('../../timetable-calendar.js');
let count = 0;
const test = (name, fn) => { fn(); console.log('  ok  ' + name); count++; };
const lesson = (date, start, end) => ({ dateKey: date, start: `${date}T${start}:00`, end: `${date}T${end}:00` });
const month = '2026-10-09', now = '2026-10-09T10:30:00';
const sessions = [lesson('2026-10-01','09:00','11:00'), lesson('2026-10-08','09:00','11:00'), lesson('2026-10-09','10:00','12:00'), lesson('2026-10-20','09:00','13:00')];
test('4 of 10 scheduled hours finished gives 40%, with an ongoing class left in Remaining', () => {
  assert.deepEqual(progress(sessions,month,now), { state:'ready',month:'2026-10',percentage:40,completedHours:4,totalHours:10,remainingHours:6,completedClasses:2,totalClasses:4,activeClasses:1 });
});
test('a class counts at its exact scheduled end, not at the start of its day', () => {
  assert.equal(progress(sessions,month,'2026-10-09T11:59:59').percentage,40);
  assert.equal(progress(sessions,month,'2026-10-09T12:00:00').percentage,60);
  assert.equal(progress(sessions,month,'2026-10-01T08:59:59').percentage,0);
});
test('past and future months return 100 and 0 only when published hours exist', () => {
  assert.equal(progress(sessions,month,'2026-11-01T00:00:00').percentage,100);
  assert.equal(progress(sessions,month,'2026-09-30T23:59:59').percentage,0);
  assert.equal(progress(sessions,'2026-11-01',now).percentage,null);
  assert.equal(progress([],month,now).state,'empty');
});
test('the denominator excludes other months, keeps overlaps, and measures hours rather than class counts', () => {
  const rows=[...sessions,lesson('2026-09-30','08:00','14:00'),lesson('2026-11-01','08:00','14:00')];
  assert.equal(progress(rows,month,now).percentage,40);
  assert.equal(progress([...sessions,lesson('2026-10-08','10:00','11:00')],month,now).totalHours,11);
  assert.equal(progress(sessions,month,now).completedClasses/progress(sessions,month,now).totalClasses,0.5);
});
test('fractional hours are summed without per-class rounding; partial completion never rounds to 100%', () => {
  const rows=[lesson('2026-10-01','09:00','09:15'),lesson('2026-10-20','09:00','09:30')];
  assert.equal(progress(rows,month,now).totalHours,0.75);
  assert.equal(progress(rows,month,now).percentage,33.3);
  const almost=[{dateKey:'2026-10-01',start:'2026-10-01T00:00:00',end:'2026-10-08T23:59:59'},lesson('2026-10-20','09:00','09:01')];
  assert.equal(progress(almost,month,now).percentage,99.9);
});
test('cross-month sessions follow the same start-month rule as Month view and finish only at their end', () => {
  const row={dateKey:'2026-10-31',start:'2026-10-31T23:00:00',end:'2026-11-01T01:00:00'};
  assert.equal(progress([row],month,'2026-11-01T00:00:00').completedHours,0);
  assert.equal(progress([row],month,'2026-11-01T01:00:00').completedHours,2);
  assert.equal(progress([row],'2026-11-01','2026-11-01T01:00:00').state,'empty');
});
test('invalid durations, calendar dates and clocks never yield a misleading numeric percentage', () => {
  for(const row of [null,{},lesson('2026-10-09','11:00','10:00'),lesson('2026-10-09','10:00','10:00'),lesson('2026-10-09','10:00','25:00'),{...sessions[0],end:'2026-10-33T12:00:00'}, {...sessions[0],start:'2026-10-01T09:60:00'}, {...sessions[0],dateKey:'2026-10-02'}])
    assert.equal(progress([row],month,now).state,'unavailable');
  assert.equal(progress(null,month,now).state,'unavailable');
  assert.equal(progress(sessions,'2026-02-31',now).state,'unavailable');
  assert.equal(progress(sessions,month,'2026-10-09T24:00:00').state,'unavailable');
});
test('leap years and international device timezones do not change the same Bologna wall-clock calculation', () => {
  const before=process.env.TZ;
  for(const zone of ['Pacific/Honolulu','Europe/Rome','Asia/Tokyo']) {
    process.env.TZ=zone;
    assert.equal(progress(sessions,month,now).percentage,40);
    assert.equal(progress([lesson('2028-02-29','09:00','11:00')],'2028-02-29','2028-02-29T11:00:00').percentage,100);
    assert.equal(progress([lesson('2026-10-25','09:00','11:00')],month,'2026-10-25T11:00:00').completedHours,2);
  }
  if(before===undefined) delete process.env.TZ; else process.env.TZ=before;
});
console.log(`${count} teaching-progress calculation checks passed`);
