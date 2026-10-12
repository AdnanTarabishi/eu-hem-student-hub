const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {parseCourseHtml}=require("../../scripts/unibo-course-reader.js");
const {verifiedTimetableSessions}=require("../../unibo-data.js");
const {preserveExamEvents}=require("../../scripts/build-calendar.js");
const programme=require("../../content/programme.json");
const statistics=programme.cohorts[0].terms[0].courses.flatMap(c=>c.modules)
  .find(m=>m.code==="96498");
const fake=`<!DOCTYPE html><title>Course Timetable 2026/2027 Fundamentals of Statistics for Healthcare</title>
<h1>Course Timetable 96498 - Fundamentals of Statistics for Healthcare</h1>
<p>A.Y. 2026/2027</p>
<table>
<tr data-start="2015-04-10T13:00:00" data-end="2015-04-10T17:00:00">
<td rowspan="2"><span>Monday</span>, <span class="bigger">12</span> <span class="smaller">October 2026</span></td>
<td>09:00 - 12:00</td>
<td><div><!--! UP1 <span>OLD ROOM</span> !--><span>AULA 8 "SALA DELLE FESTE" (Via Zamboni, 22)</span><br />
<span>Piano Primo</span><br /><span>Palazzo Malvezzi Campeggi</span><br /><span>VIA Zamboni 22 - Bologna</span></div></td>
</tr>
<tr data-start="2015-04-10T13:00:00"><td>14:00 - 16:00</td>
<td>Online only</td><td>Online tutorial</td></tr>
</table>`;
const parsed=parseCourseHtml(fake,statistics,2026);
assert.equal(parsed.length,2);
assert.equal(parsed[0].dateKey,"2026-10-12","visible date must override bogus 2015 HTML attribute");
assert.equal(parsed[0].start,"2026-10-12T09:00:00");
assert.equal(parsed[0].end,"2026-10-12T12:00:00");
assert.match(parsed[0].room,/SALA DELLE FESTE/);
assert.equal(parsed[0].classrooms[0].floor,"Piano Primo");
assert.equal(parsed[0].classrooms[0].address,"VIA Zamboni 22 - Bologna");
assert.equal(parsed[1].dateKey,"2026-10-12","second lesson inherits a row-spanned displayed date");
assert.equal(parsed[1].online,true);
assert.equal(parsed[1].room,"");
assert.throws(()=>parseCourseHtml(fake,{...statistics,code:"74948"},2026),/does not identify module/);
console.log("  ok  Classroom, date, time, online and row-spanned UniBo HTML parsing");

const data=JSON.parse(fs.readFileSync(path.join(__dirname,"../../data/unibo-verified-timetable.json"),"utf8"));
assert.equal(data.schemaVersion,1);assert.ok(data.sessions.length>50);
assert.ok(data.verifiedCurrentModules>=1);
const browser=verifiedTimetableSessions(data,{now:Date.parse(data.checkedAt)});
assert.equal(browser.length,data.sessions.length);
assert.equal(browser.sourceMeta.kind,"course-pages");
assert.equal(browser.sourceMeta.stale,!!data.partial);
const old=verifiedTimetableSessions(data,{now:Date.parse(data.checkedAt)+8*60*60*1000});
assert.equal(old.sourceMeta.stale,true,"eight-hour-old official snapshot must never be labelled current");
assert.throws(()=>verifiedTimetableSessions({checkedAt:"invalid",sessions:[],schemaVersion:1}),/Invalid verified/);
console.log("  ok  Published course snapshot and source timestamps are checked before use");

const previous=`BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:exam-ABC\r\nSUMMARY:Exam: Statistics\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const next=`BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:class-DEF\r\nSUMMARY:Statistics\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const merged=preserveExamEvents(next,previous);
assert.match(merged,/UID:exam-ABC/);assert.match(merged,/UID:class-DEF/);
console.log("  ok  Class calendar updates preserve existing exams during a separate UniBo exam feed outage");
