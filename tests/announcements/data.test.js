// Public announcement rules. No browser or dependencies needed.
// Run: node tests/announcements/data.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../..');

// Load the real shared scripts in one classic-script context. The unresolved
// fetch prevents automatic rendering; these checks exercise their data rules.
const context = vm.createContext({
  console, URL, setTimeout, clearTimeout,
  fetch: () => new Promise(() => {}),
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  window: { location: { hash: '', href: 'https://example.test/announcements.html' }, addEventListener() {} },
});
for (const file of ['utils.js', 'announcements.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
}
const D = vm.runInContext('({ rowsToAnnouncements, parseCsv, activeAnnouncements, isNewAnnouncement, announcementId })', context);
const plain = (value) => JSON.parse(JSON.stringify(value));
let count = 0;
function test(name, run) { run(); count++; console.log('  ok  ' + name); }

test('the public CSV reader preserves multiline messages, custom categories and safe links', () => {
  const csv = 'Title,Message,Category,Date,Expires,Pinned,Link,Posted by\n' +
    '"Café, welcome","First line\nA \"\"quoted\"\" second line",Student Community,08/10/2026,09/10/2026,TRUE,https://example.test/update,Student team\n' +
    'Custom update,Body, New category ,2026-10-08,,,javascript:alert(1),Volunteer team\n' +
    ',An incomplete row,Academic,2026-10-08,,,,Team\n';
  const rows = plain(D.rowsToAnnouncements(D.parseCsv(csv)));
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].title, rows[0].message, rows[0].category, rows[0].date, rows[0].expires, rows[0].pinned, rows[0].link],
    ['Café, welcome', 'First line\nA "quoted" second line', 'Student Community', '2026-10-08', '2026-10-09', true, 'https://example.test/update']);
  assert.equal(rows[1].category, 'New category');
  assert.equal(rows[1].link, '');
});

test('scheduled and expired entries stay out; the publication and expiry days are inclusive', () => {
  const entries = [
    { title: 'Published today', date: '2026-10-08', expires: '' },
    { title: 'Last day today', date: '2026-10-01', expires: '2026-10-08' },
    { title: 'Tomorrow', date: '2026-10-09', expires: '' },
    { title: 'Ended yesterday', date: '2026-10-01', expires: '2026-10-07' },
  ].map((item, row) => ({ ...item, pinned: false, row }));
  assert.deepEqual(plain(D.activeAnnouncements(entries, '2026-10-08')).map((item) => item.title),
    ['Published today', 'Last day today']);
});

test('default priority order is pinned, then newest, then the later same-day row without mutating input', () => {
  const entries = [
    { title: 'Earlier row', date: '2026-10-08', pinned: false, row: 0 },
    { title: 'Pinned older', date: '2026-10-01', pinned: true, row: 1 },
    { title: 'Later row', date: '2026-10-08', pinned: false, row: 2 },
    { title: 'Yesterday', date: '2026-10-07', pinned: false, row: 3 },
  ];
  const before = JSON.stringify(entries);
  assert.deepEqual(plain(D.activeAnnouncements(entries, '2026-10-08')).map((item) => item.title),
    ['Pinned older', 'Later row', 'Earlier row', 'Yesterday']);
  assert.equal(JSON.stringify(entries), before);
});

test('New is limited to today and the two preceding days', () => {
  assert.deepEqual(['2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '']
    .map((date) => D.isNewAnnouncement({ date }, '2026-10-08')), [false, true, true, true, false, false]);
});

test('existing links from the homepage and search keep their original announcement identifiers', () => {
  assert.equal(D.announcementId('2026-10-07', 'Student Representatives Election Results 🗳️'),
    '2026-10-07-student-representatives-election-results');
  assert.equal(D.announcementId('2026-10-06', 'Welcome to the EU-HEM Student Hub — Beta'),
    '2026-10-06-welcome-to-the-eu-hem-student-hub-beta');
  assert.equal(D.announcementId('2026-10-06', 'Track Preferences — First Choices Approved 🎉'),
    '2026-10-06-track-preferences-first-choices-approved');
});

console.log(`${count} announcements data checks passed`);
