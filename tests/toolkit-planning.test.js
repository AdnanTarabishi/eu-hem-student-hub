'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../toolkit-planning-core');
const today = '2026-10-05'; // Monday; all task titles in these fixtures are fictional.
const draft = extras => ({...C.initialState(), targetDate: '2026-10-09', bufferPercent: 0,
  tasks: [{title: 'Read a topic', hours: 3}, {title: 'Practise exercises', hours: 6}], ...extras});

test('known four-day schedule respects task order and exposes the one-hour gap', () => {
  const result = C.plan(draft(), today);
  assert.deepEqual(result.availableDays, ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
  assert.equal(result.capacityHours, 8);
  assert.equal(result.scheduledHours, 8);
  assert.equal(result.unscheduledHours, 1);
  assert.equal(result.feasible, false);
  assert.deepEqual(result.tasks.map(task => task.unscheduledHours), [0, 1]);
  assert.deepEqual(result.sessions.slice(0, 4).map(session => [session.date, session.title, session.minutes]), [
    ['2026-10-05', 'Read a topic', 60], ['2026-10-05', 'Read a topic', 60],
    ['2026-10-06', 'Read a topic', 60], ['2026-10-06', 'Practise exercises', 60]
  ]);
});
test('buffer is applied conservatively in quarter-hour blocks, without creating time', () => {
  const result = C.plan(draft({bufferPercent: 20}), today);
  assert.equal(result.rawCapacityHours, 8);
  assert.equal(result.capacityHours, 6);
  assert.equal(result.reservedHours, 2);
  assert.equal(result.unscheduledHours, 3);
  assert.ok(result.sessions.every(session => session.minutes <= 60));
  const perDay = Object.groupBy ? Object.groupBy(result.sessions, session => session.date) : result.sessions.reduce((days, session) => { (days[session.date] ||= []).push(session); return days; }, {});
  for (const sessions of Object.values(perDay)) assert.equal(sessions.reduce((sum, session) => sum + session.minutes, 0), 90);
});
test('completed demand leaves capacity free and does not invent extra tasks', () => {
  const result = C.plan(draft({tasks: [{title: 'A short assignment', hours: 1.25}], sessionMinutes: 30}), today);
  assert.equal(result.feasible, true);
  assert.equal(result.scheduledHours, 1.25);
  assert.equal(result.unscheduledHours, 0);
  assert.deepEqual(result.sessions.map(session => session.minutes), [30, 30, 15]);
  assert.ok(result.sessions.every(session => session.date === today));
});
test('target day is excluded and including today is an explicit choice', () => {
  const result = C.plan(draft({includeToday: false}), today);
  assert.deepEqual(result.availableDays, ['2026-10-06', '2026-10-07', '2026-10-08']);
  assert.equal(result.calendarDays, 3);
  assert.equal(result.capacityHours, 6);
  assert.equal(C.plan(draft({targetDate: '2026-10-06', includeToday: false}), today).capacityHours, 0);
});
test('no selected study date or zero rounded capacity leaves the entire demand unscheduled', () => {
  const noDate = C.plan(draft({targetDate: '2026-10-06', weekdays: [3]}), today);
  assert.equal(noDate.availableDays.length, 0);
  assert.equal(noDate.sessions.length, 0);
  assert.equal(noDate.unscheduledHours, 9);
  const rounded = C.plan(draft({dailyHours: 0.25, bufferPercent: 50}), today);
  assert.equal(rounded.availableHoursPerDay, 0);
  assert.equal(rounded.sessions.length, 0);
  assert.equal(rounded.unscheduledHours, 9);
});
test('calendar dates are validated by their real month lengths, including leap years', () => {
  assert.equal(C.dateKey(C.dateNumber('2028-02-29')), '2028-02-29');
  for (const value of ['2026-02-29', '2028-02-30', '2026-04-31', '2026-13-01', '2026-00-01', '2026-10-00', '2026-1-02', '', '2026-10-08T00:00:00Z', '0000-01-01', '2300-01-01']) assert.throws(() => C.dateNumber(value), /calendar date/);
  const leap = C.plan(draft({targetDate: '2028-03-02', weekdays: [0, 1, 2, 3, 4, 5, 6]}), '2028-02-28');
  assert.deepEqual(leap.availableDays, ['2028-02-28', '2028-02-29', '2028-03-01']);
});
test('a DST transition keeps consecutive calendar dates and capacity intact', () => {
  const result = C.plan(draft({targetDate: '2026-03-31', weekdays: [0, 1, 2, 3, 4, 5, 6]}), '2026-03-27');
  assert.deepEqual(result.availableDays, ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30']);
  assert.equal(result.calendarDays, 4);
  assert.equal(result.capacityHours, 8);
});
test('empty, current, past and too-distant targets do not become plausible plans', () => {
  for (const targetDate of ['', today, '2026-10-04', C.dateKey(C.dateNumber(today) + 366 * 86400000)]) assert.throws(() => C.plan(draft({targetDate}), today));
  const bounded = C.plan(draft({targetDate: C.dateKey(C.dateNumber(today) + 365 * 86400000)}), today);
  assert.equal(bounded.calendarDays, 365);
  assert.ok(bounded.availableDays.length <= 365);
});
test('blank tasks and unselected weekdays are honest planning errors', () => {
  assert.throws(() => C.plan(draft({tasks: []}), today), /at least one task/);
  assert.throws(() => C.plan(draft({weekdays: []}), today), /at least one study weekday/);
  assert.equal(C.cleanState(C.initialState(), true).targetDate, '');
});
test('strict import rejects unknown or malformed fields and unsupported versions', () => {
  for (const raw of [null, [], {}, {...draft(), unexpected: true}, {...draft(), version: 2}, {...draft(), includeToday: 'yes'},
    {...draft(), weekdays: [1, 1]}, {...draft(), weekdays: [7]}, {...draft(), dailyHours: '2'}, {...draft(), dailyHours: NaN},
    {...draft(), sessionMinutes: 61}, {...draft(), bufferPercent: -1}, {...draft(), bufferPercent: 51},
    {...draft(), tasks: [{title: 'Read', hours: 1, hidden: true}]}, {...draft(), tasks: [{title: '', hours: 1}]},
    {...draft(), tasks: [{title: 'Read\nDTSTART:injection', hours: 1}]}, {...draft(), tasks: [{title: 'Read', hours: 0.1}]}]) assert.throws(() => C.cleanState(raw, true));
});
test('tolerant repair keeps valid task rows and returns independent state', () => {
  const raw = {...draft(), bufferPercent: 100, weekdays: [1, 1], unknown: 'ignored',
    tasks: [{title: '  Read  ', hours: 2}, {title: '<script>not markup</script>', hours: 1}, {title: 'Bad estimate', hours: '3'}]};
  const state = C.cleanState(raw);
  assert.equal(state.bufferPercent, 20);
  assert.deepEqual(state.weekdays, [1, 2, 3, 4, 5]);
  assert.deepEqual(state.tasks, [{title: 'Read', hours: 2}, {title: '<script>not markup</script>', hours: 1}]);
  state.tasks[0].title = 'Changed'; state.weekdays.push(6);
  assert.equal(raw.tasks[0].title, '  Read  ');
  assert.deepEqual(C.initialState().weekdays, [1, 2, 3, 4, 5]);
});
test('task count, workload, session and daily-capacity bounds constrain expansion', () => {
  const tasks = Array.from({length: 41}, (_, index) => ({title: 'Task ' + index, hours: 1}));
  assert.throws(() => C.cleanState(draft({tasks}), true), /40/);
  assert.throws(() => C.cleanState(draft({tasks: Array.from({length: 6}, (_, index) => ({title: 'Task ' + index, hours: 200}))}), true), /1000/);
  for (const extras of [{tasks: [{title: 'Large', hours: 201}]}, {dailyHours: 12.25}, {sessionMinutes: 195}, {dailyHours: 0}, {sessionMinutes: 0}]) assert.throws(() => C.cleanState(draft(extras), true));
});
test('CSV escapes quotes and neutralises formula-like task titles', () => {
  const raw = draft({tasks: [{title: '=HYPERLINK("https://example.invalid","Click")', hours: 0.25}, {title: '+SUM(1,2)', hours: 0.25}, {title: '@name', hours: 0.25}, {title: 'A "quoted", topic', hours: 0.25}]});
  const csv = C.csv(raw, today);
  assert.ok(csv.startsWith('"Study date","Task","Session minutes","Session hours","Target date"\r\n'));
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.invalid"",""Click"")"'));
  assert.ok(csv.includes('"\'+SUM(1,2)"'));
  assert.ok(csv.includes('"\'@name"'));
  assert.ok(csv.includes('"A ""quoted"", topic"'));
  assert.ok(csv.endsWith('\r\n'));
});
test('ICS exports calendar-safe all-day reminders, including month and leap boundaries', () => {
  const raw = draft({targetDate: '2028-03-02', weekdays: [0, 1, 2, 3, 4, 5, 6], tasks: [{title: 'Topic; compare, reflect\\review', hours: 6}]});
  const calendar = C.ics(raw, '2028-02-28');
  assert.match(calendar, /DTSTART;VALUE=DATE:20280229\r\nDTEND;VALUE=DATE:20280301/);
  assert.match(calendar, /DTSTART;VALUE=DATE:20280301\r\nDTEND;VALUE=DATE:20280302/);
  const unfolded = calendar.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('SUMMARY:Study: Topic\\; compare\\, reflect\\\\review'));
  assert.ok(unfolded.includes('All-day reminder\\; no study time is booked.'));
  assert.match(calendar, /TRANSP:TRANSPARENT/);
  assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 6);
  assert.equal((calendar.match(/END:VEVENT/g) || []).length, 6);
  assert.equal(new Set([...calendar.matchAll(/UID:([^\r]+)/g)].map(match => match[1])).size, 6);
  assert.ok(!calendar.includes('TZID='));
});
test('ICS lines fold by UTF-8 bytes without splitting characters and preserve gap warnings', () => {
  const title = 'é'.repeat(60) + '😀'.repeat(30);
  const raw = draft({tasks: [{title, hours: 10}]});
  const calendar = C.ics(raw, today);
  for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, 'ICS content line exceeded 75 octets');
  const unfolded = calendar.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('SUMMARY:Study: ' + title));
  assert.ok(unfolded.includes('2 hours remain unscheduled'));
  assert.ok(!calendar.includes('\ufffd'));
});
test('exports validate current inputs instead of copying a stale result', () => {
  assert.throws(() => C.csv(draft({targetDate: ''}), today));
  assert.throws(() => C.ics(draft({targetDate: ''}), today));
  assert.throws(() => C.ics(draft({targetDate: '2026-10-06', weekdays: [3]}), today), /no scheduled sessions/);
});
