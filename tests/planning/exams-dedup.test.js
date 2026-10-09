// Public-source shapes with fictional lecturer names and rooms; no live requests.
const assert = require("node:assert/strict");
const { mergeExamSittings: merge, parseUniboDate, examPublishedDetails,
  examSittingIdentity, examCalendarTimes } = require("../../unibo-data.js");
const calendar = require("../../scripts/build-calendar.js");
let checks = 0;
function test(label, run) { run(); checks++; console.log("  ok  " + label); }
const row = (codes, overrides = {}) => ({ codes, names: ["Fictional course"], teachers: ["QA Lecturer"],
  dateKey: "2026-11-03", time: "11:00", place: 'QA ROOM "A"', type: "Written",
  registrationOpens: "2026-10-19", registrationCloses: "2026-10-30", ...overrides });

test("exact and formatting-only repeats collapse without mutating source objects", () => {
  const source = [row(["74948"]), row(["74948"], {place: "qa room A", type: "written", teachers: ["qa lecturer"]})];
  const copy = JSON.stringify(source), result = merge(source);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].teachers, ["QA Lecturer"]);
  assert.equal(JSON.stringify(source), copy);
});
test("explicit integrated-parent, component and standalone aliases describe one sitting", () => {
  const result = merge([row(["96525"]), row(["96525", "74948"]), row(["74948"], {teachers: ["Another QA Lecturer"]})]);
  assert.equal(result.length, 1);
  assert.equal(result[0].assessmentCode, "74948");
  assert.deepEqual(result[0].codes, ["96525", "74948"]);
  assert.deepEqual(result[0].teachers, ["QA Lecturer", "Another QA Lecturer"]);
});
test("alias reconciliation is independent of source ordering and survives a second pass", () => {
  for (const codes of [[["74948"],["96525","74948"],["96525"]], [["96525"],["74948"],["96525","74948"]]]) {
    const once = merge(codes.map(value => row(value)));
    assert.equal(once.length, 1);
    assert.equal(merge(once).length, 1);
    assert.deepEqual(once[0].codes, ["96525", "74948"]);
  }
});
test("different components sharing their integrated parent remain distinct", () => {
  assert.equal(merge([row(["96525", "74948"]), row(["96525", "32626"])]).length, 2);
});
test("an ambiguous parent-only row is not assigned to either component", () => {
  const result = merge([row(["96525"]), row(["96525", "74948"]), row(["96525", "32626"])]);
  assert.equal(result.length, 3);
  assert.ok(result.some(exam => exam.assessmentCode === "96525"));
});
test("parent aliases require explicit code relationships, not matching room or lecturer", () => {
  assert.equal(merge([row(["96525"]), row(["74948"])]).length, 2);
  assert.equal(merge([row(["74948"]), row(["96500"])]).length, 2);
});
test("distinct days and start times remain separate", () => {
  assert.equal(merge([row(["96498"], {time:"15:00"}), row(["96498"], {time:"16:30"}),
    row(["96498"], {dateKey:"2027-01-14",time:"15:00"})]).length, 3);
});
test("place, format, booking windows and published-detail conflicts remain separate", () => {
  for (const change of [{place:"QA room B"}, {type:"Oral"}, {registrationOpens:"2026-10-20"},
    {registrationCloses:"2026-10-29"}, {duration:"120 min"}, {endTime:"13:00"}, {notes:"No calculator"}]) {
    const original = row(["74948"], {duration:"90 min",endTime:"12:30",notes:"Bring a calculator"});
    assert.equal(merge([original, {...original,...change}]).length, 2, JSON.stringify(change));
  }
});
test("a unique richer record can fill missing details, with all teachers retained", () => {
  const result = merge([row(["74948"], {place:"",registrationOpens:"",registrationCloses:""}),
    row(["96525","74948"], {duration:"90 min",notes:"Bring a calculator",teachers:["Another QA Lecturer"]})]);
  assert.equal(result.length, 1);
  assert.equal(result[0].duration, "90 min");
  assert.equal(result[0].registrationCloses, "2026-10-30");
  assert.equal(result[0].teachers.length, 2);
});
test("missing details do not bridge two conflicting published rooms", () => {
  assert.equal(merge([row(["74948"], {place:""}), row(["74948"]), row(["74948"], {place:"QA room B"})]).length, 3);
  assert.equal(merge([row(["74948"], {place:""}), row(["74948"]),
    row(["74948"], {place:"QA room B"}), row(["74948"], {place:""})]).length, 3);
});
test("a missing registration boundary does not bridge incompatible booking records", () => {
  assert.equal(merge([row(["74948"], {registrationCloses:""}), row(["74948"]),
    row(["74948"], {registrationCloses:"2026-10-29"})]).length, 3);
});
test("equally detailed complementary records cannot hide whole-slot ambiguity", () => {
  const a=row(["74948"], {place:"QA room A",registrationCloses:"",notes:"Bring a calculator"});
  const b=row(["74948"], {place:"",notes:"Bring a calculator"});
  const c=row(["74948"], {place:"QA room B"});
  for (const source of [[a,b,c],[b,c,a],[c,a,b]]) assert.equal(merge(source).length,3);
});
test("source text normalization keeps room numbers separate and unknown records independent", () => {
  assert.equal(merge([row(["74948"], {place:"QA room 1-2"}), row(["74948"], {place:"QA room 12"})]).length, 2);
  assert.equal(merge([row([]), row([])]).length, 2);
});
test("date parsing pads source clocks consistently for browser and calendar", () => {
  assert.deepEqual(parseUniboDate("3 November 2026 at 9:00"), {dateKey:"2026-11-03",time:"09:00"});
});
test("duration and notes are published text, while only valid explicit end clocks are retained", () => {
  assert.deepEqual(examPublishedDetails({"Duration:":" 90   min ","Notes:":"Bring a calculator.","When":"3 November 2026 at 9:00 – 10:30"}),
    {duration:"90 min",notes:"Bring a calculator.",endTime:"10:30"});
  assert.deepEqual(examPublishedDetails({}), {duration:"",notes:"",endTime:""});
  assert.equal(examPublishedDetails({"End time:":"26:00"}).endTime, "");
});
function html(codes, extra = "", id="qa") {
  return `<h3 role="tab" aria-controls="${id}"><a><span class="code"> ${codes[0]} </span>Fictional course<span class="docente">QA Lecturer</span></a></h3><div id="${id}"><table class="single-item"><tr><th>When</th><td>3 November 2026 at 11:00</td></tr>${codes[1]?`<tr><th>Componente:</th><td>${codes[1]} - QA module</td></tr>`:""}<tr><th>Subscriptions list:</th><td><span>19 October 2026</span><span>30 October 2026</span></td></tr><tr><th>Place:</th><td>QA room A</td></tr><tr><th>Test type:</th><td>scritto</td></tr>${extra}</table></div>`;
}
test("calendar reader retains both booking boundaries, notes and source duration", () => {
  const result = calendar.parseExamsHtml(html(["96525","74948"], '<tr><th>Duration:</th><td>90 min</td></tr><tr><th>Notes:</th><td>Bring a calculator.</td></tr>'));
  assert.equal(result.length, 1);
  assert.equal(result[0].registrationOpens, "2026-10-19");
  assert.equal(result[0].registrationCloses, "2026-10-30");
  assert.equal(result[0].duration, "90 min");
  assert.equal(result[0].notes, "Bring a calculator.");
});
test("calendar uses the browser merger and keeps independent same-slot UIDs distinct", () => {
  const source = calendar.parseExamsHtml(html(["96525"],"","a") + html(["96525","74948"],"","b") + html(["74948"],"","c") + html(["96500"],"","d"));
  const result = calendar.mergeDuplicates(source);
  assert.equal(result.length, 2);
  const identifiers = result.map(exam => calendar.examUid(exam,"exam"));
  assert.equal(new Set(identifiers).size, 2);
  const content = calendar.buildCalendar("Fictional calendar",[],result.map(exam=>({...exam,title:"QA course"})));
  const ids = [...content.matchAll(/^UID:(.+)$/gm)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});
test("manual and generated exports use the same assessment identity", () => {
  const exam = merge([row(["96525"]), row(["96525","74948"]), row(["74948"])])[0];
  const other = row(["96500"]);
  assert.ok(calendar.examUid(exam,"exam").startsWith("exam-" + examSittingIdentity(exam)));
  assert.notEqual(examSittingIdentity(exam), examSittingIdentity(other));
  assert.notEqual(examSittingIdentity(exam), examSittingIdentity({...exam,registrationCloses:"2026-10-29"}));
  assert.notEqual(examSittingIdentity({...exam,place:"QA room A Written",type:""}),
    examSittingIdentity({...exam,place:"QA room A",type:"Written"}));
});
test("published end times are honoured; missing or incompatible end times remain labelled estimates", () => {
  assert.deepEqual(examCalendarTimes(row(["74948"],{endTime:"12:30"})),
    {start:"2026-11-03T11:00:00",end:"2026-11-03T12:30:00",estimated:false});
  for (const endTime of ["", "10:00", "26:00"]) {
    const timing=examCalendarTimes(row(["74948"],{endTime}));
    assert.equal(timing.estimated,true);
    assert.equal(timing.end,"2026-11-03T13:00:00");
  }
  const unknown=examCalendarTimes(row(["74948"],{time:"",endTime:"12:30"}));
  assert.equal(unknown.start,"2026-11-03T09:00:00");
  assert.equal(unknown.estimated,true);
});
test("generated calendar exposes published end time and notes without an estimated-end claim", () => {
  const exam=row(["74948"],{title:"QA course",endTime:"12:30",notes:"Bring a calculator"});
  const content=calendar.buildCalendar("QA",[],[exam]);
  assert.match(content,/DTEND;TZID=Europe\/Rome:20261103T123000/);
  assert.match(content,/Notes: Bring a calculator/);
  assert.doesNotMatch(content,/End time is an estimate/);
});
console.log(`${checks} Exam source reconciliation checks passed`);
