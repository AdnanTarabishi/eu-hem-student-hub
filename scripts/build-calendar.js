// ===== Calendar builder =====
// Creates a calendar file (.ics) with 1st-year classes, exams and exam registration
// deadlines, so students can subscribe in Google, Apple or Outlook Calendar.
//
// Runs on GitHub Actions every few hours (see .github/workflows/update-calendar.yml).
// Run it yourself with:  node scripts/build-calendar.js
//
// Note: the exam-page reading below mirrors exams.js (which runs in the browser).
// If UniBo changes its exam page, both files need the same update.

const fs = require("fs");
const path = require("path");

const TIMETABLE_URL =
  "https://corsi.unibo.it/2cycle/euHealthEconomicsManagement/timetable/@@orario_reale_json?anno=1";
const EXAMS_URL = "https://corsi.unibo.it/2cycle/euHealthEconomicsManagement/exam-dates";

const OUTPUT_DIR = path.join(__dirname, "..", "calendar");

// Exams on the UniBo page have a start time but no end time
const EXAM_HOURS = 2;

const MONTHS = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};
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

// "05 November 2026 at 09:00" -> { dateKey: "2026-11-05", time: "09:00" }
function parseUniboDate(text) {
  const match = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+at\s+(\d{1,2}:\d{2}))?/);
  if (!match) return null;
  const [, day, monthName, year, time] = match;
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  return { dateKey: `${year}-${month}-${day.padStart(2, "0")}`, time: time ? time.padStart(5, "0") : "" };
}

// Academic year label for a date: Sept 2026 - Aug 2027 -> "2026-27"
function academicYear(dateKey) {
  const [year, month] = dateKey.split("-").map(Number);
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

// --- Reading UniBo data ---

async function fetchTimetable() {
  const response = await fetch(TIMETABLE_URL);
  if (!response.ok) throw new Error(`Timetable: HTTP ${response.status}`);
  const raw = await response.json();
  return raw.map((s) => ({
    id: `${s.extCode}-${s.start}`,
    start: s.start, // "2026-09-07T09:00:00"
    end: s.end,
    course: toTitleCase(s.title.split("/").pop()),
    allNames: s.title.split("/").map(toTitleCase),
    room: s.aule.map((a) => `${a.des_edificio}, ${a.des_indirizzo}`).join(" + "),
    teacher: s.docente || "",
    online: s.teledidattica,
    note: s.note || "",
  }));
}

async function fetchExams() {
  const response = await fetch(EXAMS_URL);
  if (!response.ok) throw new Error(`Exams: HTTP ${response.status}`);
  const html = await response.text();

  const exams = [];
  // Each course starts with <h3 ... role="tab"> and is followed by its exam tables
  const courseBlocks = html.split(/<h3[^>]*role="tab"[^>]*>/).slice(1);
  for (const block of courseBlocks) {
    const [headingHtml, panelHtml] = block.split("</h3>");
    const code = (headingHtml.match(/<span class="code">([\s\S]*?)<\/span>/) || [])[1] || "";
    const teacherHtml = (headingHtml.match(/<span class="docente">([\s\S]*?)<\/span>/) || [])[1] || "";
    const courseName = toTitleCase(
      htmlToText(headingHtml.replace(/<span class="(code|docente)">[\s\S]*?<\/span>/g, ""))
    );
    const teacher = teacherHtml ? toTitleCase(htmlToText(teacherHtml)) : "";

    for (const tableHtml of (panelHtml || "").split('<table class="single-item">').slice(1)) {
      // Rows look like <th>Label</th><td>Value</td>
      const fields = {};
      for (const row of tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
        fields[htmlToText(row[1])] = row[2];
      }
      const when = parseUniboDate(htmlToText(fields["When"] || ""));
      if (!when) continue;

      const registrationDates = [...(fields["Subscriptions list:"] || "").matchAll(/<span>([^<]*)<\/span>/g)]
        .map((m) => parseUniboDate(m[1]));
      const componentName = htmlToText(fields["Componente:"] || "").split(" - ").pop().trim();
      const typeText = htmlToText(fields["Test type:"] || "");

      const names = [courseName];
      if (componentName) names.push(toTitleCase(componentName));

      exams.push({
        code,
        dateKey: when.dateKey,
        time: when.time,
        names,
        teachers: teacher ? [teacher] : [],
        type: TEST_TYPES[typeText.toLowerCase()] || typeText,
        place: htmlToText(fields["Place:"] || ""),
        registrationCloses: registrationDates[1]?.dateKey || "",
      });
    }
  }
  return exams;
}

// Same sitting (date + time + room) listed under several names -> one exam
function mergeDuplicates(exams) {
  const byKey = new Map();
  for (const exam of exams) {
    const key = [exam.dateKey, exam.time, exam.place.toLowerCase()].join("|");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, exam);
      continue;
    }
    for (const name of exam.names) if (!existing.names.includes(name)) existing.names.push(name);
    for (const t of exam.teachers) if (!existing.teachers.includes(t)) existing.teachers.push(t);
  }
  return [...byKey.values()];
}

// Keep exams whose course appears in the 1st-year timetable
function keepFirstYearExams(exams, sessions) {
  const firstYearNames = new Set(sessions.flatMap((s) => s.allNames));
  return exams
    .map((exam) => ({ ...exam, names: exam.names.filter((n) => firstYearNames.has(n)) }))
    .filter((exam) => exam.names.length > 0);
}

function examTitle(exam) {
  const plain = exam.names.filter((n) => !n.includes("(I.C.)"));
  return (plain.length ? plain : exam.names).join(" / ");
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

function addHours(isoLocal, hours) {
  const date = new Date(isoLocal + "Z"); // treat as UTC only for the arithmetic
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString().slice(0, 19);
}

// Unique, stable event id so calendar apps update events instead of duplicating them
function uid(text) {
  return text.replace(/[^A-Za-z0-9]+/g, "-") + "@eu-hem-student-hub";
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

function buildCalendar(cohort, sessions, exams) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EU-HEM Student Hub//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:EU-HEM 1st year ${cohort.replace("-", "/")}`,
    "X-WR-CALDESC:Unofficial. Classes and exams from the official UniBo pages.",
    "X-WR-TIMEZONE:Europe/Rome",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...VTIMEZONE,
  ];

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
    const title = examTitle(exam);
    const start = `${exam.dateKey}T${exam.time || "09:00"}:00`;
    const description = [
      exam.type && `Type: ${exam.type}`,
      exam.teachers.length && `Teacher: ${exam.teachers.join(", ")}`,
      exam.registrationCloses && `Registration closes: ${exam.registrationCloses}`,
      `End time is an estimate (${EXAM_HOURS} h). Register on AlmaEsami.`,
      "Source: official UniBo exam dates",
    ].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid(`exam-${exam.dateKey}-${exam.time}-${exam.place}`)}`,
      DTSTAMP,
      `DTSTART;TZID=Europe/Rome:${icsDateTime(start)}`,
      `DTEND;TZID=Europe/Rome:${icsDateTime(addHours(start, EXAM_HOURS))}`,
      `SUMMARY:${icsEscape("Exam: " + title)}`,
      `LOCATION:${icsEscape(exam.place)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      "END:VEVENT",
    );

    // All-day reminder on the last day to register
    if (exam.registrationCloses) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid(`registration-${exam.dateKey}-${exam.time}-${exam.place}`)}`,
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

async function main() {
  const sessions = await fetchTimetable();
  if (sessions.length === 0) throw new Error("Timetable is empty, not updating the calendar");

  const exams = keepFirstYearExams(mergeDuplicates(await fetchExams()), sessions)
    .sort((a, b) => (a.dateKey + a.time).localeCompare(b.dateKey + b.time));

  // The cohort is the academic year of the first class, e.g. "2026-27"
  const cohort = academicYear(sessions.map((s) => s.start).sort()[0].slice(0, 10));
  const fileName = `eu-hem-${cohort}-year1.ics`;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), buildCalendar(cohort, sessions, exams));

  // A small list of available calendars, so the website knows which file to link to
  const manifestPath = path.join(OUTPUT_DIR, "calendars.json");
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : [];
  if (!manifest.some((c) => c.file === fileName)) {
    manifest.push({ cohort, year: 1, file: fileName });
    manifest.sort((a, b) => a.cohort.localeCompare(b.cohort));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }

  console.log(`Wrote calendar/${fileName}: ${sessions.length} classes, ${exams.length} exams`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1); // marks the GitHub Actions run as failed, and the old calendar stays online
});
