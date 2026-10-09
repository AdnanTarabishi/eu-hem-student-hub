// ===== Calendar builder =====
// Creates calendar files (.ics) with classes, exams and exam registration deadlines,
// so students can subscribe in Google, Apple or Outlook Calendar:
// - one full calendar with every 1st-year course (eu-hem-2026-27-year1.ics)
// - one calendar per possible study plan (e.g. eu-hem-2026-27-y1s1-96496-C8393-B1076.ics)
// Courses, modules, study plan rules and the UniBo addresses all come from content/programme.json.
//
// Runs on GitHub Actions every few hours (see .github/workflows/update-calendar.yml).
// Run it yourself with:  node scripts/build-calendar.js
//
// The HTML reader mirrors unibo-data.js; sitting reconciliation and optional
// published details are shared with that browser helper.

const fs = require("fs");
const path = require("path");

const programmeRules = require("../programme.js");
const uniboData = require("../unibo-data.js");
const PROGRAMME_FILE = path.join(__dirname, "..", "content", "programme.json");

const OUTPUT_DIR = path.join(__dirname, "..", "calendar");

// Most exam records publish a start time without an end time.
const EXAM_HOURS = 2;

const TEST_TYPES = { scritto: "Written", orale: "Oral", pratico: "Practical" };

// --- Small helpers ---

function toTitleCase(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

// Removes HTML tags and decodes the few HTML codes UniBo uses
function htmlToText(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Reading UniBo data ---

async function fetchTimetable(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Timetable: HTTP ${response.status}`);
  const raw = await response.json();
  return raw.map((s) => ({
    id: `${s.extCode}-${s.start}`,
    start: s.start, // "2026-09-07T09:00:00"
    end: s.end,
    moduleCode: s.cod_modulo,
    feedTitle: s.title,
    room: s.aule.map((a) => `${a.des_edificio}, ${a.des_indirizzo}`).join(" + "),
    teacher: s.docente || "",
    online: s.teledidattica,
    note: s.note || "",
  }));
}

async function fetchExams(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Exams: HTTP ${response.status}`);
  return parseExamsHtml(await response.text());
}

function parseExamsHtml(html) {
  const exams = [];
  // Each course starts with <h3 ... role="tab"> and is followed by its exam tables
  const courseBlocks = html.split(/<h3[^>]*role="tab"[^>]*>/).slice(1);
  for (const block of courseBlocks) {
    const [headingHtml, panelHtml] = block.split("</h3>");
    const code = htmlToText((headingHtml.match(/<span class="code">([\s\S]*?)<\/span>/) || [])[1] || "").toUpperCase();
    const teacherHtml = (headingHtml.match(/<span class="docente">([\s\S]*?)<\/span>/) || [])[1] || "";
    const courseName = toTitleCase(
      htmlToText(headingHtml.replace(/<span class="(code|docente)">[\s\S]*?<\/span>/g, ""))
    );
    const teacher = teacherHtml ? toTitleCase(htmlToText(teacherHtml)) : "";

    const tables = [...(panelHtml || "").matchAll(/<table\b[^>]*class=["'][^"']*\bsingle-item\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/gi)];
    for (const [, tableHtml] of tables) {
      // Rows look like <th>Label</th><td>Value</td>
      const fields = {};
      for (const row of tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
        fields[htmlToText(row[1])] = row[2];
      }
      const when = uniboData.parseUniboDate(htmlToText(fields["When"] || ""));
      if (!when) continue;

      const registrationDates = [...(fields["Subscriptions list:"] || "").matchAll(/<span>([^<]*)<\/span>/g)]
        .map((m) => uniboData.parseUniboDate(m[1]));
      const component = htmlToText(fields["Componente:"] || "");
      const componentCode = (component.match(/^([A-Z0-9]+)\s*-/) || [])[1] || "";
      const componentName = component.split(" - ").pop().trim();
      const typeText = htmlToText(fields["Test type:"] || "");

      const names = [courseName];
      if (componentName) names.push(toTitleCase(componentName));

      exams.push({
        codes: [code, componentCode].filter(Boolean),
        dateKey: when.dateKey,
        time: when.time,
        names,
        teachers: teacher ? [teacher] : [],
        type: TEST_TYPES[typeText.toLowerCase()] || typeText,
        place: htmlToText(fields["Place:"] || ""),
        registrationOpens: registrationDates[0]?.dateKey || "",
        registrationCloses: registrationDates[1]?.dateKey || "",
        ...uniboData.examPublishedDetails(Object.fromEntries(Object.entries(fields)
          .map(([label, value]) => [label, htmlToText(value)]))),
      });
    }
  }
  return exams;
}

// Use the same conservative assessment aliases and conflict checks as the page.
function mergeDuplicates(exams) {
  return uniboData.mergeExamSittings(exams);
}

// Keeps the exams of this term's courses (matched by official code) and names them from
// programme.json. exam.courseCodes says which courses an exam belongs to.
function matchExamsToTerm(exams, term) {
  const result = [];
  for (const exam of exams) {
    const courses = term.courses.filter((c) => exam.codes.includes(c.code) || c.modules.some((m) => exam.codes.includes(m.code)));
    if (courses.length === 0) continue;
    const modules = courses.flatMap((c) => c.modules.filter((m) => exam.codes.includes(m.code)));
    const course = courses[0];
    const title = course.integrated && modules.length ? [...new Set(modules.map((m) => m.name))].join(" / ") : course.name;
    result.push({ ...exam, courseCodes: courses.map((c) => c.code), title });
  }
  return result;
}

// Classes of this term's modules, named from programme.json
function matchSessionsToTerm(sessions, term) {
  const modules = new Map(term.courses.flatMap((c) => c.modules.map((m) => [m.code, { course: c, module: m }])));
  return sessions
    .filter((s) => modules.has(s.moduleCode))
    .map((s) => ({ ...s, courseCode: modules.get(s.moduleCode).course.code, course: modules.get(s.moduleCode).module.name }));
}

// --- Writing the .ics calendar file ---
// Format reference: RFC 5545 (the iCalendar standard)

// Calendar text must escape \ ; , and new lines
function icsEscape(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Lines longer than 75 bytes must be split, continuing with a space
function foldLine(line) {
  const parts = [];
  let current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char) > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
    }
    current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

// "2026-09-07T09:00:00" -> "20260907T090000"
function icsDateTime(isoLocal) {
  return isoLocal.replace(/[-:]/g, "").slice(0, 15);
}

// "2026-11-03" -> "20261103"
function icsDate(dateKey) {
  return dateKey.replace(/-/g, "");
}

function nextDayKey(dateKey) {
  const date = new Date(dateKey + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// Unique, stable event id so calendar apps update events instead of duplicating them
function uid(text) {
  return text.replace(/[^A-Za-z0-9]+/g, "-") + "@eu-hem-student-hub";
}

// Keep independent components and conflicting published records independent in
// calendar apps too, even when they share the same date, time and classroom.
function examUid(exam, prefix) {
  return prefix + "-" + uniboData.examSittingIdentity(exam) + "@eu-hem-student-hub";
}

// Italian time zone, so times show correctly for everyone
const VTIMEZONE = [
  "BEGIN:VTIMEZONE", "TZID:Europe/Rome",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST",
  "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET",
  "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
];

// A fixed timestamp keeps the file identical when nothing changed (no needless updates)
const DTSTAMP = "DTSTAMP:20260101T000000Z";

// Key dates from programme.json that belong in a calendar: exact days only (a month-only date
// such as "May 2027" has no day to put it on), and no "classes" ranges (the classes themselves are there)
function calendarKeyDates(cohort) {
  return programmeRules.keyDates(cohort).filter((d) => !d.approximate && d.start.length === 10 && d.kind !== "classes");
}

function buildCalendar(calendarName, sessions, exams, keyDates = []) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EU-HEM Student Hub//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calendarName}`,
    "X-WR-CALDESC:Unofficial. Classes and exams from the official UniBo pages; exam periods and deadlines from the EU-HEM handbook.",
    "X-WR-TIMEZONE:Europe/Rome",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...VTIMEZONE,
  ];

  for (const keyDate of keyDates) {
    const description = [keyDate.note, "Source: EU-HEM Student Handbook. Dates can change; check the official pages."]
      .filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid(`key-${keyDate.id}`)}`,
      DTSTAMP,
      `DTSTART;VALUE=DATE:${icsDate(keyDate.start)}`,
      `DTEND;VALUE=DATE:${icsDate(nextDayKey(keyDate.end))}`, // the end of an all-day event is the day after
      `SUMMARY:${icsEscape(keyDate.label)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      "END:VEVENT",
    );
  }

  for (const s of sessions) {
    const description = [s.teacher, s.note, s.online ? "Online" : "", "Source: official UniBo timetable"]
      .filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid("class-" + s.id)}`,
      DTSTAMP,
      `DTSTART;TZID=Europe/Rome:${icsDateTime(s.start)}`,
      `DTEND;TZID=Europe/Rome:${icsDateTime(s.end)}`,
      `SUMMARY:${icsEscape(s.course)}`,
      `LOCATION:${icsEscape(s.online && !s.room ? "Online" : s.room)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      "END:VEVENT",
    );
  }

  for (const exam of exams) {
    const title = exam.title;
    const timing = uniboData.examCalendarTimes(exam, EXAM_HOURS);
    const description = [
      exam.type && `Type: ${exam.type}`,
      exam.teachers.length && `Teacher: ${exam.teachers.join(", ")}`,
      exam.registrationCloses && `Registration closes: ${exam.registrationCloses}`,
      exam.duration && `Published duration: ${exam.duration}`,
      exam.notes && `Notes: ${exam.notes}`,
      !exam.time && "Start time is a placeholder (09:00); confirm the time on UniBo.",
      timing.estimated ? `End time is an estimate (${EXAM_HOURS} h). Register on AlmaEsami.` :
        "End time is published by UniBo. Register on AlmaEsami.",
      "Source: official UniBo exam dates",
    ].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${examUid(exam, "exam")}`,
      DTSTAMP,
      `DTSTART;TZID=Europe/Rome:${icsDateTime(timing.start)}`,
      `DTEND;TZID=Europe/Rome:${icsDateTime(timing.end)}`,
      `SUMMARY:${icsEscape("Exam: " + title)}`,
      `LOCATION:${icsEscape(exam.place)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      "END:VEVENT",
    );

    // All-day reminder on the last day to register
    if (exam.registrationCloses) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${examUid(exam, "registration")}`,
        DTSTAMP,
        `DTSTART;VALUE=DATE:${icsDate(exam.registrationCloses)}`,
        `DTEND;VALUE=DATE:${icsDate(nextDayKey(exam.registrationCloses))}`,
        `SUMMARY:${icsEscape("Last day to register: " + title)}`,
        `DESCRIPTION:${icsEscape(`Exam on ${exam.dateKey} at ${exam.time}. Register on AlmaEsami.`)}`,
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// --- Main ---

function writeIfChanged(fileName, content) {
  const full = path.join(OUTPUT_DIR, fileName);
  if (fs.existsSync(full) && fs.readFileSync(full, "utf8") === content) return false;
  fs.writeFileSync(full, content);
  return true;
}

async function main() {
  const programme = JSON.parse(fs.readFileSync(PROGRAMME_FILE, "utf8"));
  const cohort = programmeRules.currentCohort(programme);
  const term = programmeRules.currentTerm(programme);

  const sessions = matchSessionsToTerm(await fetchTimetable(cohort.sources.timetableFeed), term)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (sessions.length === 0) throw new Error("Timetable is empty, not updating the calendar");
  const exams = matchExamsToTerm(mergeDuplicates(await fetchExams(cohort.sources.examDates)), term)
    .sort((a, b) => (a.dateKey + a.time).localeCompare(b.dateKey + b.time));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const entries = [];
  let changed = 0;
  const keyDates = calendarKeyDates(cohort);

  // 1. The full calendar (same file name as before, so existing subscriptions keep working)
  const fullFile = `eu-hem-${cohort.id}-year${term.year}.ics`;
  changed += writeIfChanged(fullFile, buildCalendar(`EU-HEM 1st year ${cohort.label}`, sessions, exams, keyDates));
  entries.push({ cohort: cohort.id, term: term.id, year: term.year, file: fullFile, plan: null });

  // 2. One calendar per possible study plan (worked out from the rules)
  for (const choices of programmeRules.allPlanCombinations(term)) {
    const key = programmeRules.planKey(term, choices);
    const codes = programmeRules.selectedCourseCodes(term, choices);
    const file = `eu-hem-${cohort.id}-y${term.year}s${term.semester}-${key}.ics`;
    const mySessions = sessions.filter((s) => codes.includes(s.courseCode));
    const myExams = exams.filter((e) => e.courseCodes.some((c) => codes.includes(c)));
    changed += writeIfChanged(file, buildCalendar(`EU-HEM my courses ${cohort.label} (${key})`, mySessions, myExams, keyDates));
    entries.push({ cohort: cohort.id, term: term.id, year: term.year, file, plan: key, courses: codes });
  }

  // A list of the calendars, so the website knows which file to link to.
  // Entries of other cohorts/terms are kept.
  const manifestPath = path.join(OUTPUT_DIR, "calendars.json");
  const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : [];
  const kept = old.filter((c) => !(c.cohort === cohort.id && (c.term === term.id || c.term === undefined)));
  const manifest = [...kept, ...entries].sort((a, b) => (a.cohort + (a.plan || "")).localeCompare(b.cohort + (b.plan || "")));
  writeIfChanged("calendars.json", JSON.stringify(manifest, null, 2) + "\n");

  console.log(`${entries.length} calendars (${changed} changed): ${sessions.length} classes, ${exams.length} exams in the full calendar`);
}

if (require.main === module) main().catch((error) => {
  console.error(error);
  process.exit(1); // marks the GitHub Actions run as failed, and the old calendar stays online
});

module.exports = { parseExamsHtml, mergeDuplicates, matchExamsToTerm, buildCalendar, examUid };
