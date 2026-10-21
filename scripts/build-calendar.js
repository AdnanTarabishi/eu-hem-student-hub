// ===== Calendar builder =====
// Creates calendar files (.ics) with classes, exams and exam registration deadlines,
// so students can subscribe in Google, Apple or Outlook Calendar:
// - one full calendar with every 1st-year course (eu-hem-2026-27-year1.ics)
// - one calendar per possible study plan (e.g. eu-hem-2026-27-y1s1-96496-C8393-B1076.ics)
// Courses, modules, study plan rules and the UniBo addresses all come from content/programme.json.
//
// Runs on GitHub Actions every hour (see .github/workflows/update-calendar.yml).
// Run it yourself with:  node scripts/build-calendar.js
//
// The HTML reader mirrors unibo-data.js; sitting reconciliation and optional
// published details are shared with that browser helper.

const fs = require("fs");
const path = require("path");

const programmeRules = require("../programme.js");
const uniboData = require("../unibo-data.js");
const examWorkspace = require("../exams-workspace.js");
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
  // Shared retry policy with the live website, with longer backoff for Actions.
  const { raw, cachedAt, sourceUrl, sourceUrls } = await uniboData.requestOfficialTimetable(url, {
    attempts: 5, delayMs: 1500, timeoutMs: 20000,
  });
  if (cachedAt) throw new Error("Timetable returned a saved response, not a fresh verification");
  return { records: normalizeTimetableRecords(raw), sourceUrls: sourceUrls || [sourceUrl || url] };
}

function normalizeTimetableRecords(raw) {
  return raw.map((s) => {
    const classrooms = (s.aule || []).map(uniboData.timetableClassroomRecord);
    return {
      id: `${s.extCode}-${s.start}`,
      dateKey: s.start.slice(0, 10),
      time: s.time || `${s.start.slice(11, 16)} - ${s.end.slice(11, 16)}`,
      start: s.start, // "2026-09-07T09:00:00"
      end: s.end,
      moduleCode: s.cod_modulo,
      feedTitle: s.title,
      classrooms,
      room: uniboData.timetableClassroomsText(classrooms),
      teacher: s.docente || "",
      online: s.teledidattica,
      note: s.note || "",
    };
  });
}

async function fetchExams(url) {
  const { pages, cachedAt, sourceUrls } = await uniboData.requestOfficialExams(url, {
    attempts: 4, delayMs: 1000, timeoutMs: 20000,
  });
  if (cachedAt) throw new Error("Exams returned a saved response, not a fresh verification");
  return { records: mergeDuplicates(pages.flatMap(parseExamsHtml)), sourceUrls: sourceUrls || [url] };
}

function parseExamsHtml(html) {
  const exams = [];
  // Each course starts with <h3 ... role="tab"> and is followed by its exam tables
  const courseBlocks = html.split(/<h3\b[^>]*\brole\s*=\s*["']tab["'][^>]*>/i).slice(1);
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
    result.push({ ...exam, courseCodes: courses.map((c) => c.code), courseIds: courses.map(c => c.id),
      moduleCodes: modules.map(module => module.code), title });
  }
  // Use the same lecturer-notice reconciliation as the public Exams workspace.
  // The official date, time, booking window and assessment UID remain intact.
  return examWorkspace.events(result, term).map(exam => ({ ...exam,
    courseCodes: exam.courseCodes || term.courses.filter(course => exam.courseIds.includes(course.id)).map(course => course.code) }));
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
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
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
      `UID:${s.calendarUid || uid("class-" + s.id)}`,
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
    if (exam.administrative) {
      const description = [
        "No final examination. This is an administrative Pass/Fail recording session, not a timed exam.",
        "Complete the required enrolment separately. Saving this reminder does not register you.",
        exam.notice?.virtualeInstruction, exam.notice?.recordingInstruction, exam.notice?.note,
        exam.registrationOpens && `Registration opens: ${exam.registrationOpens}`,
        exam.registrationCloses && `Registration closes: ${exam.registrationCloses}`,
        exam.noticeTimeDiffers && `The lecturer notice gives ${exam.notice.sessionTime}; the official listing gives ${exam.time}. Confirm the current time before acting.`,
        exam.origin === "lecturer" ? "Source: lecturer notice. No official booking window is inferred." : "Source: official UniBo listing, interpreted with the lecturer's recording notice.",
      ].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT", `UID:${examUid(exam, "exam")}`, DTSTAMP,
        exam.time ? `DTSTART;TZID=Europe/Rome:${icsDateTime(`${exam.dateKey}T${exam.time}:00`)}` : `DTSTART;VALUE=DATE:${icsDate(exam.dateKey)}`,
        `SUMMARY:${icsEscape("Pass/Fail recording: " + title)}`,
        `LOCATION:${icsEscape(exam.place || "")}`,
        `DESCRIPTION:${icsEscape(description)}`, "TRANSP:TRANSPARENT", "END:VEVENT",
      );
      if (exam.registrationCloses) lines.push(
        "BEGIN:VEVENT", `UID:${examUid(exam, "registration")}`, DTSTAMP,
        `DTSTART;VALUE=DATE:${icsDate(exam.registrationCloses)}`,
        `DTEND;VALUE=DATE:${icsDate(nextDayKey(exam.registrationCloses))}`,
        `SUMMARY:${icsEscape("Last day to enrol for recording: " + title)}`,
        `DESCRIPTION:${icsEscape(`Administrative recording on ${exam.dateKey}${exam.time ? " at " + exam.time : ""}. No final examination. Enrol separately; this reminder is not registration.`)}`,
        "END:VEVENT",
      );
      continue;
    }
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

// Revisions are stable when the event is unchanged and increase when a room,
// time or exam detail changes. Calendar clients use SEQUENCE and DTSTAMP to
// recognise modified events. Do not rewrite every subscription every hour.
function reconcileEventRevisions(next, previous = "", stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")) {
  const unfold = text => text.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n");
  const events = text => [...unfold(text).matchAll(/BEGIN:VEVENT\n([\s\S]*?)END:VEVENT/g)].map(([, body]) => body.trim().split("\n"));
  const field = (lines, name) => lines.find(line => line.startsWith(name + ":"))?.slice(name.length + 1) || "";
  const semantic = lines => lines.filter(line => !/^(DTSTAMP|LAST-MODIFIED|SEQUENCE):/.test(line)).join("\n");
  const oldByUid = new Map(events(previous).map(lines => [field(lines, "UID"), lines]));

  const prepared = unfold(next).replace(/BEGIN:VEVENT\n([\s\S]*?)END:VEVENT/g, (_, body) => {
    const lines = body.trim().split("\n");
    const old = oldByUid.get(field(lines, "UID"));
    const unchanged = old && semantic(old) === semantic(lines);
    const revision = unchanged ? Number(field(old, "SEQUENCE") || 0)
      : old ? Number(field(old, "SEQUENCE") || 0) + 1 : 0;
    const when = unchanged ? (field(old, "DTSTAMP") || stamp) : stamp;
    const modified = unchanged ? (field(old, "LAST-MODIFIED") || when) : stamp;
    const details = lines.filter(line => !/^(DTSTAMP|LAST-MODIFIED|SEQUENCE):/.test(line));
    const at = Math.max(0, details.findIndex(line => line.startsWith("UID:")) + 1);
    details.splice(at, 0, `SEQUENCE:${revision}`, `DTSTAMP:${when}`, `LAST-MODIFIED:${modified}`);
    return "BEGIN:VEVENT\n" + details.join("\n") + "\nEND:VEVENT";
  });
  return prepared.trimEnd().split("\n").map(foldLine).join("\r\n") + "\r\n";
}

// --- Main ---

// Public source snapshots are separate: a failure in one source must not stop
// healthy updates from the other. A verification timestamp only advances after
// a complete successful official request, never after using a saved copy.
function validRecords(kind, records) {
  if (!Array.isArray(records) || records.length > 5000) return false;
  if (kind === "timetable") return records.length > 0 && records.every(record =>
    typeof record.moduleCode === "string" && record.moduleCode.length > 0 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(record.start || "") &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(record.end || "") && record.end > record.start);
  return records.every(record => Array.isArray(record.codes) && record.codes.length > 0 &&
    Array.isArray(record.names) && Array.isArray(record.teachers) &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.dateKey || ""));
}

function readSnapshot(outputDir, kind, source, cohort) {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(outputDir, kind + ".json"), "utf8"));
    const verified = typeof saved.verifiedAt === "string" && Number.isFinite(Date.parse(saved.verifiedAt));
    const historical = saved.sourceType === "calendar-copy" && saved.verifiedAt === null;
    return saved.version === 1 && saved.source === source && (!saved.cohort || saved.cohort === cohort) &&
      (verified || historical) && validRecords(kind, saved.records) ? saved : null;
  } catch { return null; }
}

function writeIfChanged(fileName, content, outputDir = OUTPUT_DIR) {
  const full = path.join(outputDir, fileName);
  const previous = fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
  if (fileName.endsWith(".ics")) content = reconcileEventRevisions(content, previous);
  if (previous === content) return false;
  const temporary = full + "." + process.pid + ".tmp";
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, full);
  return true;
}

function jsonFile(fileName, value, outputDir) {
  return writeIfChanged(fileName, JSON.stringify(value, null, 2) + "\n", outputDir);
}

function icsEvents(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n");
  return [...unfolded.matchAll(/BEGIN:VEVENT\n[\s\S]*?END:VEVENT/g)].map(match => match[0]);
}

// On an outage, retain that source's existing events verbatim. In particular,
// refreshing exams must not delete or relabel the last published class schedule.
function retainFailedSourceEvents(next, previous, { timetable, exams }) {
  const kind = event => {
    const id = (event.match(/^UID:(.*)$/m) || [])[1] || "";
    return id.startsWith("class-") ? "timetable" : /^(exam-|registration-)/.test(id) ? "exams" : "key";
  };
  const keep = event => (kind(event) === "timetable" && timetable) || (kind(event) === "exams" && exams);
  const oldEvents = icsEvents(previous).filter(keep);
  if (!oldEvents.length) return next;
  const nextEvents = icsEvents(next).filter(event => !keep(event));
  const withoutEvents = next.replace(/BEGIN:VEVENT\r?\n[\s\S]*?END:VEVENT\r?\n?/g, "");
  const events = [...nextEvents, ...oldEvents].map(event => event.split("\n").map(foldLine).join("\r\n")).join("\r\n");
  return withoutEvents.replace("END:VCALENDAR", events + "\r\nEND:VCALENDAR");
}

// Initial recovery only: old ICS files are historical public copies, not a new
// source verification. No teacher, floor or verification date is guessed.
function timetableFromCalendar(text, term) {
  const clean = text => String(text || "").replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
  const simple = text => clean(text).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const modules = term.courses.flatMap(course => course.modules);
  const iso = value => /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.test(value || "")
    ? value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/, "$1-$2-$3T$4:$5:$6") : "";
  return icsEvents(text).flatMap(event => {
    const field = key => (event.match(new RegExp("^" + key + "(?:;[^:]*)?:(.*)$", "m")) || [])[1] || "";
    const calendarUid = field("UID");
    if (!calendarUid.startsWith("class-")) return [];
    const matches = modules.filter(module => simple(module.name) === simple(field("SUMMARY")));
    const start = iso(field("DTSTART")), end = iso(field("DTEND"));
    if (matches.length !== 1 || !start || !end || end <= start) return [];
    return [{ calendarUid, id: calendarUid.split("@")[0].slice(6), moduleCode: matches[0].code,
      feedTitle: matches[0].name, dateKey: start.slice(0, 10), start, end,
      time: start.slice(11, 16) + " - " + end.slice(11, 16),
      classrooms: [], room: clean(field("LOCATION")), teacher: "", online: false, note: "" }];
  });
}

async function syncCalendars(options = {}) {
  const programme = options.programme || JSON.parse(fs.readFileSync(PROGRAMME_FILE, "utf8"));
  const outputDir = options.outputDir || OUTPUT_DIR;
  const checkedAt = (options.now || (() => new Date()))().toISOString();
  const logger = options.logger || console;
  const cohort = programmeRules.currentCohort(programme);
  const term = programmeRules.currentTerm(programme);
  fs.mkdirSync(outputDir, { recursive: true });
  const fullFile = `eu-hem-${cohort.id}-year${term.year}.ics`;
  const fullPath = path.join(outputDir, fullFile);
  const oldFull = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
  const sources = { timetable: cohort.sources.timetableFeed, exams: cohort.sources.examDates };
  const loaders = { timetable: options.loadTimetable || fetchTimetable, exams: options.loadExams || fetchExams };
  const sourceState = {};

  await Promise.all(Object.keys(sources).map(async kind => {
    const source = sources[kind];
    let saved = readSnapshot(outputDir, kind, source, cohort.id);
    try {
      const loaded = await loaders[kind](source);
      const records = Array.isArray(loaded) ? loaded : loaded.records;
      if (!validRecords(kind, records)) throw new Error(kind + ": invalid or empty official records");
      if (kind === "timetable" && matchSessionsToTerm(records, term).length === 0)
        throw new Error("Timetable has no classes for the configured modules");
      saved = { version: 1, cohort: cohort.id, source, sourceUrls: loaded.sourceUrls || [source],
        sourceType: "official", verifiedAt: checkedAt, records };
      jsonFile(kind + ".json", saved, outputDir);
      sourceState[kind] = { ok: true, snapshot: saved, error: "" };
    } catch (error) {
      if (kind === "timetable" && !saved) {
        const records = timetableFromCalendar(oldFull, term);
        if (records.length) {
          saved = { version: 1, cohort: cohort.id, source, sourceUrls: [source], sourceType: "calendar-copy", verifiedAt: null, records };
          jsonFile(kind + ".json", saved, outputDir);
        }
      }
      const message = String(error.message || error).replace(/\s+/g, " ").slice(0, 500);
      sourceState[kind] = { ok: false, snapshot: saved, error: message };
      logger.error(kind + " synchronization failed: " + message + ". Previous verified data is retained where available.");
    }
  }));

  const status = { version: 1, cohort: cohort.id, checkedAt };
  for (const [kind, current] of Object.entries(sourceState)) status[kind] = {
    ok: current.ok, source: sources[kind], checkedAt,
    verifiedAt: current.snapshot?.verifiedAt || null,
    sourceType: current.snapshot?.sourceType || "unavailable",
    recordCount: current.snapshot?.records.length || 0,
    error: current.error,
  };
  // Stable key order keeps concurrent source timing out of the generated output.
  const syncStatus = { version: status.version, cohort: status.cohort, checkedAt,
    timetable: status.timetable, exams: status.exams };
  jsonFile("sync-status.json", syncStatus, outputDir);

  const sessions = matchSessionsToTerm(sourceState.timetable.snapshot?.records || [], term)
    .sort((a, b) => a.start.localeCompare(b.start));
  const exams = matchExamsToTerm(mergeDuplicates(sourceState.exams.snapshot?.records || []), term)
    .sort((a, b) => (a.dateKey + a.time).localeCompare(b.dateKey + b.time));
  const entries = [], keyDates = calendarKeyDates(cohort);
  let changed = 0;
  const writeCalendar = (file, name, mySessions, myExams) => {
    const full = path.join(outputDir, file);
    const previous = fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
    // Avoid creating an incomplete subscription if neither a verified snapshot
    // nor the old subscription can supply an unavailable source.
    if (!previous && Object.values(sourceState).some(source => !source.ok && !source.snapshot)) return false;
    const next = retainFailedSourceEvents(buildCalendar(name, mySessions, myExams, keyDates), previous,
      { timetable: !sourceState.timetable.ok, exams: !sourceState.exams.ok });
    changed += Number(writeIfChanged(file, next, outputDir));
    return true;
  };
  if (writeCalendar(fullFile, `EU-HEM 1st year ${cohort.label}`, sessions, exams))
    entries.push({ cohort: cohort.id, term: term.id, year: term.year, file: fullFile, plan: null });
  for (const choices of programmeRules.allPlanCombinations(term)) {
    const key = programmeRules.planKey(term, choices);
    const codes = programmeRules.selectedCourseCodes(term, choices);
    const file = `eu-hem-${cohort.id}-y${term.year}s${term.semester}-${key}.ics`;
    if (writeCalendar(file, `EU-HEM my courses ${cohort.label} (${key})`,
      sessions.filter(session => codes.includes(session.courseCode)),
      exams.filter(exam => exam.courseCodes.some(code => codes.includes(code)))))
      entries.push({ cohort: cohort.id, term: term.id, year: term.year, file, plan: key, courses: codes });
  }

  const manifestPath = path.join(outputDir, "calendars.json");
  const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : [];
  const updatedFiles = new Set(entries.map(entry => entry.file));
  const kept = old.filter(entry => !updatedFiles.has(entry.file));
  const manifest = [...kept, ...entries].sort((a, b) => (a.cohort + (a.plan || "")).localeCompare(b.cohort + (b.plan || "")));
  if (entries.length) jsonFile("calendars.json", manifest, outputDir);
  logger.log(`${entries.length} calendars (${changed} changed): ${sessions.length} class records, ${exams.length} matched exam records. See calendar/sync-status.json for source verification.`);
  return { ok: Object.values(sourceState).every(source => source.ok), changed, entries, status: syncStatus };
}

if (require.main === module) syncCalendars().then(result => {
  if (!result.ok) process.exitCode = 1; // healthy source outputs have already been safely written
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});

module.exports = { parseExamsHtml, mergeDuplicates, matchExamsToTerm, buildCalendar, examUid,
  reconcileEventRevisions, syncCalendars, retainFailedSourceEvents, timetableFromCalendar, readSnapshot,
  normalizeTimetableRecords };
