const assert = require('node:assert/strict');
const calendar = require('../../timetable-calendar.js');
let checks = 0;
function test(label, run) { run(); checks++; console.log('  ok  ' + label); }
test('strict date keys reject impossible dates, malformed values and unsupported ranges', () => {
  for (const date of ['2026-10-09', '2028-02-29', '2000-02-29']) assert.equal(calendar.validDate(date), true);
  for (const date of [null, '', '2026-02-29', '2026-04-31', '2026-1-01', '1900-02-29', '2201-01-01', '<script>']) assert.equal(calendar.validDate(date), false);
});
test('month arithmetic clamps days instead of skipping February and crosses year boundaries', () => {
  assert.equal(calendar.shiftMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(calendar.shiftMonth('2028-01-31', 1), '2028-02-29');
  assert.equal(calendar.shiftMonth('2026-12-31', 1), '2027-01-31');
  assert.equal(calendar.shiftMonth('2026-03-31', -1), '2026-02-28');
});
test('month cells include each actual day once and always start Monday and end Sunday', () => {
  for (let year = 2024; year <= 2032; year++) for (let month = 1; month <= 12; month++) {
    const value = `${year}-${String(month).padStart(2,'0')}-01`, cells = calendar.monthDays(value);
    const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
    assert.equal(cells.filter(c => c.inMonth).length, length);
    assert.equal(new Set(cells.map(c => c.date)).size, cells.length);
    assert.equal(new Date(cells[0].date+'T12:00:00Z').getUTCDay(), 1);
    assert.equal(new Date(cells.at(-1).date+'T12:00:00Z').getUTCDay(), 0);
    assert.ok([28,35,42].includes(cells.length));
  }
});
test('four-, five- and six-row months, leap day and December trailing dates remain complete', () => {
  assert.equal(calendar.monthDays('2027-02-04').length, 28);
  assert.equal(calendar.monthDays('2026-10-09').length, 35);
  assert.equal(calendar.monthDays('2026-08-02').length, 42);
  assert.ok(calendar.monthDays('2028-02-15').some(d => d.date === '2028-02-29' && d.inMonth));
  assert.ok(calendar.monthDays('2026-12-15').some(d => d.date === '2027-01-01' && !d.inMonth));
});
test('day math stays stable across daylight saving and international device time zones', () => {
  assert.equal(calendar.addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(calendar.addDays('2026-03-29', -1), '2026-03-28');
  assert.equal(calendar.monday('2026-10-25'), '2026-10-19');
});
test('teaching time sums published durations, including overlapping sessions', () => {
  assert.equal(calendar.hours([{start:'2026-10-09T09:00:00', end:'2026-10-09T10:30:00'}, {start:'2026-10-09T10:00:00', end:'2026-10-09T11:00:00'}]), 2.5);
  assert.equal(calendar.hours([]), 0);
});
console.log(`${checks} calendar helper checks passed`);
