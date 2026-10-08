'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../toolkit-career-core.js');
const document = (patch = {}) => ({ id: 'd-example', label: 'Insurance renewal', date: '2026-11-05', noticeDays: 14, ...patch });
const opportunity = (patch = {}) => ({ id: 'o-example', organisation: 'Fictional Health Institute', role: 'Research internship', stage: 'preparing', deadline: '2026-10-15', followup: '', nextAction: 'Check the published requirements', ...patch });
const documents = entries => ({ version: 1, documents: entries });
const career = (entries = [], prepared = []) => ({ version: 1, opportunities: entries, prepared });

test('real calendar dates include leap years and reject impossible or loosely formatted dates', () => {
  for (const value of ['2024-02-29', '2000-02-29', '1900-01-01', '2200-12-31']) assert.equal(C.isDate(value), true, value);
  for (const value of ['1900-02-29', '2100-02-29', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-20', '2026-01-00', '2026-1-02', '2026-10-08T00:00:00Z', '1899-12-31', '2201-01-01', null, 20261008]) assert.equal(C.isDate(value), false, String(value));
});

test('day differences use whole UTC days across leap and daylight-saving boundaries', () => {
  assert.equal(C.daysUntil('2024-03-01', '2024-02-28'), 2);
  assert.equal(C.daysUntil('2026-03-30', '2026-03-28'), 2);
  assert.equal(C.daysUntil('2026-10-26', '2026-10-24'), 2);
  assert.equal(C.daysUntil('2026-10-07', '2026-10-08'), -1);
  assert.equal(C.daysUntil('2026-10-08', '2026-10-08'), 0);
  assert.throws(() => C.daysUntil('2026-02-31', '2026-10-08'));
  assert.throws(() => C.daysUntil('2026-10-08', 'not-a-day'));
});

test('document grouping has explicit overdue, today, next-30 and later boundaries', () => {
  const state = documents(['2026-10-07', '2026-10-08', '2026-10-09', '2026-11-07', '2026-11-08'].reverse().map((date, i) => document({ id: 'd-' + i, date })));
  const result = C.groupDocuments(state, '2026-10-08');
  assert.deepEqual(Object.values(result).map(items => items.length), [1, 1, 2, 1]);
  assert.deepEqual(result.next30.map(item => item.days), [1, 30]);
  assert.equal(result.later[0].days, 31);
  assert.equal(state.documents[0].date, '2026-11-08', 'grouping must not mutate caller order');
});

test('strict document state accepts a valid bounded record and returns a fresh plain object', () => {
  const raw = documents([document({ label: '  Insurance renewal  ' })]);
  const clean = C.cleanDocuments(raw, true);
  assert.equal(clean.documents[0].label, 'Insurance renewal');
  clean.documents[0].label = 'Edited';
  assert.equal(raw.documents[0].label, '  Insurance renewal  ');
  assert.deepEqual(JSON.parse(JSON.stringify(C.cleanDocuments(documents([document()]), true))), documents([document()]));
});

test('strict document imports reject unknown root and entry fields, missing fields and invalid dates', () => {
  const bad = [null, {}, [], { version: 2, documents: [] }, { ...documents([]), extra: true }, documents([document({ scan: 'private' })]), documents([{ id: 'd-one', label: 'Expiry', date: '2026-11-05' }]), documents([document({ date: '2026-02-31' })]), documents([document({ noticeDays: '14' })]), documents([document({ noticeDays: -7 })]), documents([document({ label: ' ' })]), documents([document({ id: '__proto__' })])];
  for (const value of bad) assert.throws(() => C.cleanDocuments(value, true));
});

test('strict document imports enforce record count, identifier uniqueness and text limits', () => {
  assert.throws(() => C.cleanDocuments(documents([document(), document()]), true), /unique/);
  assert.throws(() => C.cleanDocuments(documents(Array.from({ length: 31 }, (_, i) => document({ id: 'd-' + i }))), true), /30/);
  assert.throws(() => C.cleanDocuments(documents([document({ label: 'x'.repeat(81) })]), true), /limit/);
  assert.throws(() => C.cleanDocuments(documents([document({ label: 'x\u0000y' })]), true), /unsupported/);
});

test('document recovery drops invalid records, strips unknown fields and bounds safe text', () => {
  const raw = documents([
    document({ label: '  Permit\u0000 review ', noticeDays: 999, scan: 'never retain this' }),
    document({ id: 'd-other', label: 'x'.repeat(200) }),
    document({ id: 'd-other', label: 'Duplicate' }),
    document({ id: 'd-impossible', date: '2026-02-30' }),
    document({ id: 'd-empty', label: '' }),
    document({ id: 'bad' }),
    null
  ]);
  const result = C.cleanDocuments(raw);
  assert.equal(result.documents.length, 2);
  assert.equal(result.documents[0].label, 'Permit review');
  assert.equal(result.documents[0].noticeDays, 0);
  assert.equal(result.documents[1].label.length, 80);
  assert.equal('scan' in result.documents[0], false);
});

test('document and career recovery are empty for invalid versions, types and non-plain objects', () => {
  for (const raw of [undefined, null, [], 'text', new Date(), { version: 9 }, Object.create({ version: 1, documents: [] })]) assert.deepEqual(C.cleanDocuments(raw), documents([]));
  for (const raw of [undefined, null, [], 'text', new Date(), { version: 9 }, { version: 1, opportunities: [], prepared: 'bad' }]) assert.deepEqual(C.cleanCareer(raw), career());
});

test('strict imports reject JSON prototype keys without changing any prototype', () => {
  for (const raw of [JSON.parse('{"version":1,"documents":[],"__proto__":{"polluted":true}}'), JSON.parse('{"version":1,"documents":[],"constructor":{}}')]) assert.throws(() => C.cleanDocuments(raw, true), /unknown/);
  assert.throws(() => C.cleanCareer(JSON.parse('{"version":1,"opportunities":[],"prepared":[],"__proto__":{}}'), true), /unknown/);
  assert.equal({}.polluted, undefined);
});

test('career state supports all six stages, optional dates and bounded preparation IDs', () => {
  const entries = C.stages.map((stage, i) => opportunity({ id: 'o-' + i, stage: stage.id, deadline: '', followup: '' }));
  const raw = career(entries, C.preparation.map(item => item.id));
  const result = C.cleanCareer(raw, true);
  assert.equal(result.opportunities.length, 6);
  assert.equal(result.prepared.length, 9);
  assert.deepEqual(result, raw);
  result.opportunities[0].role = 'Changed';
  assert.equal(raw.opportunities[0].role, 'Research internship');
});

test('strict career imports reject malformed dates, stages, text, checklist IDs and unknown fields', () => {
  const missing = opportunity(); delete missing.nextAction;
  for (const raw of [career([opportunity({ stage: 'hired-automatically' })]), career([opportunity({ deadline: '2026-02-29' })]), career([opportunity({ followup: null })]), career([opportunity({ organisation: '' })]), career([opportunity({ role: 123 })]), career([opportunity({ nextAction: 'x'.repeat(241) })]), career([opportunity({ contactEmail: 'do-not-store@example.invalid' })]), career([missing]), career([], ['unknown']), career([], ['cv-evidence', 'cv-evidence']), { ...career(), userProfile: {} }]) assert.throws(() => C.cleanCareer(raw, true));
});

test('strict career imports enforce unique IDs and at most 30 opportunities', () => {
  assert.throws(() => C.cleanCareer(career([opportunity(), opportunity()]), true), /unique/);
  assert.throws(() => C.cleanCareer(career(Array.from({ length: 31 }, (_, i) => opportunity({ id: 'o-' + i }))), true), /limit/);
  assert.throws(() => C.cleanCareer(career([opportunity({ id: 'o-<script>' })]), true), /identifier/);
});

test('career recovery keeps only bounded useful fields and known checklist items', () => {
  const raw = career([
    opportunity({ organisation: ' Fictional\u0000 Institute ', stage: 'unknown', deadline: '2026-04-31', nextAction: 'x'.repeat(500), email: 'not-retained@example.invalid' }),
    opportunity({ id: 'o-blank', role: '' }), opportunity(), null
  ], ['cv-evidence', 'unknown', 'cv-evidence', 'interview-method']);
  const result = C.cleanCareer(raw);
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].organisation, 'Fictional Institute');
  assert.equal(result.opportunities[0].stage, 'interested');
  assert.equal(result.opportunities[0].deadline, '');
  assert.equal(result.opportunities[0].nextAction.length, 240);
  assert.equal('email' in result.opportunities[0], false);
  assert.deepEqual(result.prepared, ['cv-evidence', 'interview-method']);
});

test('career metrics separate upcoming deadlines and due follow-ups and exclude closed records', () => {
  const raw = career([
    opportunity({ id: 'o-today', deadline: '2026-10-08', followup: '2026-10-07' }),
    opportunity({ id: 'o-seven', deadline: '2026-10-15', followup: '2026-10-08' }),
    opportunity({ id: 'o-eight', deadline: '2026-10-16', followup: '2026-10-09' }),
    opportunity({ id: 'o-overdue', deadline: '2026-10-07', followup: '' }),
    opportunity({ id: 'o-closed', deadline: '2026-10-08', followup: '2026-10-08', stage: 'closed' })
  ], ['cv-evidence', 'cv-methods', 'cv-review']);
  assert.deepEqual(C.careerMetrics(raw, '2026-10-08'), { total: 5, active: 4, dueSoon: 2, followupDue: 2, prepared: 3, preparationTotal: 9, preparationPercent: 33 });
});

test('all preparation groups use original practical advice and avoid promised eligibility', () => {
  assert.equal(C.preparation.length, 9);
  assert.deepEqual([...new Set(C.preparation.map(item => item.group))], ['CV', 'Cover letter', 'Interview']);
  assert.equal(new Set(C.preparation.map(item => item.id)).size, 9);
  assert.ok(C.preparation.every(item => item.title.length > 10 && item.advice.length > 80));
  assert.match(C.preparation.find(item => item.id === 'letter-rules').advice, /does not decide/);
  assert.match(C.preparation.find(item => item.id === 'cv-evidence').advice, /avoid invented/);
});

test('iCalendar escaping neutralises newline/property injection and reserved punctuation', () => {
  const escaped = C.icsEscape('A\\B;C,D\r\nEND:VEVENT\rBEGIN:VEVENT\nSUMMARY:Injected');
  assert.equal(escaped, 'A\\\\B\\;C\\,D\\nEND:VEVENT\\nBEGIN:VEVENT\\nSUMMARY:Injected');
  assert.equal(/[\r\n]/.test(escaped), false);
});

test('UTF-8 calendar folding preserves Unicode with no physical line over 75 bytes', () => {
  const original = 'SUMMARY:' + 'é📚漢'.repeat(70);
  const folded = C.foldLine(original);
  for (const line of folded.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  assert.equal(folded.replace(/\r\n /g, ''), original);
  assert.ok(folded.includes('\r\n '));
});

test('calendar exports valid all-day dates, exclusive next-day ends, stable UIDs and opt-in alerts', () => {
  const raw = documents([document({ id: 'd-leap', label: 'Review; insurance, renewal', date: '2024-02-29', noticeDays: 14 }), document({ id: 'd-newyear', date: '2026-12-31', noticeDays: 0 })]);
  const text = C.documentCalendar(raw, '2026-10-08');
  assert.match(text, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  assert.match(text, /DTSTART;VALUE=DATE:20240229\r\nDTEND;VALUE=DATE:20240301/);
  assert.match(text, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/);
  assert.match(text, /UID:document-d-leap@euhem-student-hub\.invalid/);
  assert.match(text, /DTSTAMP:20261008T000000Z/);
  assert.match(text, /SUMMARY:Review\\; insurance\\, renewal/);
  assert.equal((text.match(/BEGIN:VALARM/g) || []).length, 1);
  assert.match(text, /TRIGGER:-P14D/);
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(text.endsWith('END:VCALENDAR\r\n'));
  assert.equal(C.documentCalendar(raw, '2026-10-08'), text, 'the same IDs and dates produce stable exports');
});

test('calendar export cannot inject new events from user labels', () => {
  const text = C.documentCalendar(documents([document({ label: 'Renewal\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Injected' })]), '2026-10-08');
  assert.equal((text.match(/\r\nBEGIN:VEVENT\r\n/g) || []).length, 1);
  assert.equal((text.match(/\r\nEND:VEVENT\r\n/g) || []).length, 1);
  assert.equal((text.match(/\r\nSUMMARY:/g) || []).length, 1);
});

test('calendar export rejects empty or malformed state and never includes private unknown fields', () => {
  assert.throws(() => C.documentCalendar(documents([]), '2026-10-08'), /Add/);
  assert.throws(() => C.documentCalendar(documents([document({ scan: 'secret' })]), '2026-10-08'), /unknown/);
  assert.throws(() => C.documentCalendar(documents([document()]), '2026-02-31'), /valid/);
});

test('browser registry exposes exactly the agreed tools and neither module accesses persistence or network', () => {
  const file = path.join(__dirname, '../toolkit-career.js');
  const source = fs.readFileSync(file, 'utf8');
  const window = { StudentToolkitCareerCore: C };
  vm.runInNewContext(source, { window });
  assert.equal(window.StudentToolkitCareerTools.length, 2);
  assert.deepEqual(Array.from(window.StudentToolkitCareerTools, item => item.id), ['document-deadlines', 'career-tracker']);
  assert.equal(window.StudentToolkitCareerTools[0].cleanState, C.cleanDocuments);
  assert.equal(window.StudentToolkitCareerTools[1].cleanState, C.cleanCareer);
  const icons = fs.readFileSync(path.join(__dirname, '../icons.svg'), 'utf8');
  for (const item of window.StudentToolkitCareerTools) {
    assert.equal(typeof item.mount, 'function');
    assert.ok(icons.includes('id="' + item.icon + '"'));
  }
  for (const contents of [source, fs.readFileSync(path.join(__dirname, '../toolkit-career-core.js'), 'utf8')]) {
    assert.doesNotMatch(contents, /\blocalStorage\b|\bsessionStorage\b|\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/);
  }
  assert.doesNotMatch(source, /\.innerHTML\s*=/, 'user data is rendered through safe DOM text APIs');
});
