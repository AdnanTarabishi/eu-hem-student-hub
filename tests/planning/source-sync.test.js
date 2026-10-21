// Independent public-source refreshes must preserve the other source on failure.
// All records are fictional fixtures; there are no remote requests or student data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const rules = require('../../programme.js');
const builder = require('../../scripts/build-calendar.js');
const programme = JSON.parse(fs.readFileSync(path.join(__dirname, '../../content/programme.json'), 'utf8'));
const cohort = rules.currentCohort(programme), term = rules.currentTerm(programme);
const course = term.courses[0], moduleRecord = course.modules[0];
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'euhem-source-sync-'));
const logger = { log() {}, error() {} };
const fullFile = `eu-hem-${cohort.id}-year${term.year}.ics`;
const session = room => ({ id: 'fictional-public-session-20261021', moduleCode: moduleRecord.code,
  feedTitle: moduleRecord.name, dateKey: '2026-10-21', start: '2026-10-21T09:00:00', end: '2026-10-21T11:00:00',
  time: '09:00 - 11:00', classrooms: [], room, teacher: 'Fictional Teacher', online: false, note: '' });
const exam = place => ({ codes: [...new Set([course.code, moduleRecord.code])], names: [moduleRecord.name],
  teachers: ['Fictional Teacher'], dateKey: '2026-11-04', time: '15:00', type: 'Written', place,
  registrationOpens: '2026-10-20', registrationCloses: '2026-10-31' });
const snapshot = (dir, kind) => fs.readFileSync(path.join(dir, kind + '.json'), 'utf8');
const json = (dir, kind) => JSON.parse(snapshot(dir, kind));
const readFull = dir => fs.readFileSync(path.join(dir, fullFile), 'utf8');
const events = (text, prefix) => [...text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n')
  .matchAll(/BEGIN:VEVENT\n[\s\S]*?END:VEVENT/g)].map(match => match[0])
  .filter(event => event.includes('\nUID:' + prefix)).sort();
let checks = 0;
const ok = text => { checks++; console.log('  ok  ' + text); };
const failed = async () => { throw new Error('Fictional source HTTP 503'); };
const run = (dir, stamp, timetable, exams) => builder.syncCalendars({ programme, outputDir: dir, logger,
  now: () => new Date(stamp), loadTimetable: timetable, loadExams: exams });

(async () => {
  const dir = path.join(temporary, 'independent');
  let result = await run(dir, '2026-10-21T08:00:00Z', async () => [session('Fictional classroom A')], async () => [exam('Fictional exam room A')]);
  assert.equal(result.ok, true);
  assert.equal(result.entries.length, rules.allPlanCombinations(term).length + 1);
  for (const name of ['timetable', 'exams']) {
    assert.equal(json(dir, name).verifiedAt, '2026-10-21T08:00:00.000Z');
    assert.equal(json(dir, name).sourceType, 'official');
    assert.equal(json(dir, name).cohort, cohort.id);
    assert.equal(json(dir, 'sync-status')[name].ok, true);
  }
  const firstTimetable = snapshot(dir, 'timetable'), firstClasses = events(readFull(dir), 'class-');
  assert.equal(firstClasses.length, 1);
  ok('successful independent requests create dated public snapshots and every existing subscription choice');

  result = await run(dir, '2026-10-21T09:00:00Z', failed, async () => [exam('Fictional exam room B')]);
  assert.equal(result.ok, false, 'a partial refresh remains a failed source check');
  assert.equal(snapshot(dir, 'timetable'), firstTimetable, 'a failed source cannot advance its verification or replace records');
  assert.equal(json(dir, 'exams').verifiedAt, '2026-10-21T09:00:00.000Z');
  assert.match(readFull(dir), /LOCATION:Fictional exam room B/);
  assert.deepEqual(events(readFull(dir), 'class-'), firstClasses, 'published class UIDs, revisions and details remain intact');
  assert.equal(json(dir, 'sync-status').timetable.ok, false);
  assert.equal(json(dir, 'sync-status').exams.ok, true);
  assert.equal(json(dir, 'sync-status').timetable.verifiedAt, '2026-10-21T08:00:00.000Z');
  assert.match(json(dir, 'sync-status').timetable.error, /503/);
  ok('a timetable outage still updates exams and reports failure while preserving the prior verified timetable and class events');

  const goodExams = snapshot(dir, 'exams'), examEvents = events(readFull(dir), 'exam-');
  result = await run(dir, '2026-10-21T10:00:00Z', async () => [session('Fictional classroom C')], failed);
  assert.equal(result.ok, false);
  assert.equal(snapshot(dir, 'exams'), goodExams);
  assert.equal(json(dir, 'timetable').verifiedAt, '2026-10-21T10:00:00.000Z');
  assert.match(readFull(dir), /LOCATION:Fictional classroom C/);
  assert.deepEqual(events(readFull(dir), 'exam-'), examEvents);
  assert.equal(json(dir, 'sync-status').timetable.ok, true);
  assert.equal(json(dir, 'sync-status').exams.ok, false);
  ok('an exam outage still updates classes without losing published exam events or changing exam verification');

  const goodTimetable = snapshot(dir, 'timetable'), beforeOutage = readFull(dir);
  result = await run(dir, '2026-10-21T11:00:00Z', failed, failed);
  assert.equal(result.ok, false);
  assert.equal(snapshot(dir, 'timetable'), goodTimetable);
  assert.equal(snapshot(dir, 'exams'), goodExams);
  assert.equal(readFull(dir), beforeOutage);
  assert.equal(json(dir, 'sync-status').checkedAt, '2026-10-21T11:00:00.000Z');
  ok('a complete outage advances only the attempt status and leaves both source snapshots and subscriptions unchanged');

  result = await run(dir, '2026-10-21T12:00:00Z', async () => [], async () => [exam('Fictional exam room D')]);
  assert.equal(result.ok, false);
  assert.equal(snapshot(dir, 'timetable'), goodTimetable);
  assert.match(readFull(dir), /LOCATION:Fictional exam room D/);
  assert.match(json(dir, 'sync-status').timetable.error, /invalid|empty/i);
  ok('an empty or malformed timetable cannot erase the previous official sessions or block healthy exam updates');

  const recovered = path.join(temporary, 'historical');
  fs.mkdirSync(recovered);
  fs.writeFileSync(path.join(recovered, fullFile), readFull(dir));
  result = await run(recovered, '2026-10-21T13:00:00Z', failed, failed);
  assert.equal(result.ok, false);
  const historical = json(recovered, 'timetable');
  assert.equal(historical.verifiedAt, null, 'fixed ICS DTSTAMP is not an official verification date');
  assert.equal(historical.sourceType, 'calendar-copy');
  assert.equal(historical.records.length, 1);
  assert.equal(historical.records[0].room, 'Fictional classroom C');
  assert.equal(historical.records[0].teacher, '', 'historical recovery does not guess unstructured teacher details');
  assert.equal(historical.records[0].calendarUid, events(readFull(dir), 'class-')[0].match(/UID:(.*)/)[1]);
  assert.equal(json(recovered, 'sync-status').timetable.verifiedAt, null);
  assert.deepEqual(events(readFull(recovered), 'exam-'), events(readFull(dir), 'exam-'));
  ok('initial recovery labels an old calendar copy honestly, preserves its UIDs and never infers a verification date or teacher');

  const unavailable = path.join(temporary, 'unavailable');
  result = await run(unavailable, '2026-10-21T14:00:00Z', failed, failed);
  assert.equal(result.ok, false);
  assert.equal(result.entries.length, 0);
  assert.equal(fs.existsSync(path.join(unavailable, fullFile)), false);
  assert.equal(fs.existsSync(path.join(unavailable, 'calendars.json')), false);
  assert.equal(json(unavailable, 'sync-status').timetable.sourceType, 'unavailable');
  ok('without any verified or historical data, no incomplete subscription is created');

  const intro = term.courses.find(course => course.assessmentNotice?.kind === 'administrative-pass-fail');
  assert.ok(intro, 'the current programme defines an administrative recording notice');
  const officialRecording = { codes: [intro.code], names: [intro.name], teachers: ['Fictional Teacher'],
    dateKey: intro.assessmentNotice.sessionDate, time: '09:00', type: 'Written', place: 'Fictional recording room',
    registrationOpens: '2026-10-12', registrationCloses: '2026-10-23' };
  const changedNoticeTerm = structuredClone(term);
  changedNoticeTerm.courses.find(course => course.id === intro.id).assessmentNotice.sessionTime = '08:00';
  const recording = builder.matchExamsToTerm([officialRecording], changedNoticeTerm).find(row => row.codes.includes(intro.code));
  assert.equal(recording.administrative, true);
  assert.equal(recording.time, '09:00', 'the official start is not overwritten by a differing lecturer notice');
  assert.equal(recording.registrationCloses, '2026-10-23');
  assert.equal(builder.examUid(recording, 'exam'), builder.examUid(officialRecording, 'exam'), 'recording classification preserves an existing subscription event UID');
  const recordingCalendar = builder.buildCalendar('Fictional recording calendar', [], [recording]);
  const recordingEvent = events(recordingCalendar, 'exam-')[0];
  assert.match(recordingEvent, /DTSTART;TZID=Europe\/Rome:\d{8}T090000/);
  assert.doesNotMatch(recordingEvent, /^DTEND/m, 'a recording reminder has no invented examination duration');
  assert.match(recordingEvent, /SUMMARY:Pass\/Fail recording:/);
  assert.match(recordingEvent, /TRANSP:TRANSPARENT/);
  assert.match(recordingEvent, /No final examination/);
  assert.match(recordingEvent, /Registration opens: 2026-10-12/);
  assert.match(recordingEvent, /Registration closes: 2026-10-23/);
  assert.match(recordingEvent, /lecturer notice gives 08:00/);
  assert.match(events(recordingCalendar, 'registration-')[0], /DTSTART;VALUE=DATE:20261023/);
  ok('administrative Pass/Fail recording reuses notice reconciliation, preserves official start/booking and UID, and never invents a two-hour exam');

  const singleQuoted = `<h3 role='tab'><a><span class="code">QA999</span> Fictional course</a></h3>
    <table class="single-item"><tr><th>When</th><td>04 November 2026 at 15:00</td></tr></table>`;
  assert.equal(builder.parseExamsHtml(singleQuoted).length, 1);
  assert.deepEqual(builder.parseExamsHtml(singleQuoted)[0].codes, ['QA999']);
  ok('the Node exam reader accepts either official heading quote style without losing rows');

  console.log(checks + ' independent academic-source synchronization checks passed');
})().finally(() => fs.rmSync(temporary, { recursive: true, force: true })).catch(error => {
  console.error(error); process.exitCode = 1;
});
