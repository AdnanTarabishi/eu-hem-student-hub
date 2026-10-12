const assert = require("node:assert/strict");
const { reconcileEventRevisions } = require("../../scripts/build-calendar.js");

const make = room => [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:class-96498-20261012@eu-hem-student-hub",
  "DTSTAMP:20260101T000000Z",
  "DTSTART;TZID=Europe/Rome:20261012T090000",
  "SUMMARY:Fundamentals of Statistics for Healthcare",
  "LOCATION:" + room,
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n") + "\r\n";

const first = reconcileEventRevisions(make("AULA 1"), "", "20261012T101000Z");
assert.match(first, /SEQUENCE:0/);
assert.match(first, /DTSTAMP:20261012T101000Z/);
assert.match(first, /LAST-MODIFIED:20261012T101000Z/);
assert.equal(reconcileEventRevisions(make("AULA 1"), first, "20261012T110000Z"), first,
  "unchanged subscriptions must keep their revisions and content exactly");
const moved = reconcileEventRevisions(make("AULA 8 SALA DELLE FESTE"), first, "20261012T120000Z");
assert.match(moved, /SEQUENCE:1/);
assert.match(moved, /DTSTAMP:20261012T120000Z/);
assert.match(moved, /LOCATION:AULA 8 SALA DELLE FESTE/);
assert.equal(reconcileEventRevisions(make("AULA 8 SALA DELLE FESTE"), moved, "20261012T130000Z"), moved);
const movedAgain = reconcileEventRevisions(make("AULA 2"), moved, "20261012T140000Z");
assert.match(movedAgain, /SEQUENCE:2/);
assert.match(movedAgain, /DTSTAMP:20261012T140000Z/);
console.log("  ok  Event revisions advance only on real changes; calendar subscriptions stay deterministic");
