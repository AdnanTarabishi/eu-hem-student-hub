// ===== UniBo data: timetable feed and exam dates =====
// Loads the official UniBo timetable and exam pages (their addresses are in
// content/programme.json, under "sources"), and matches classes and exams to our
// courses and modules by their official codes.
// Shared by the home page (timetable, exams) and the course pages (Schedule, Exam tabs).

const EXAM_MONTHS = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};
const EXAM_TYPES = { scritto: "Written", orale: "Oral", pratico: "Practical" };

// Loaded once per page, even if several parts ask for it
let programmePromise = null;
function getProgramme() {
  programmePromise = programmePromise || loadProgramme();
  return programmePromise;
}

// ----- Timetable -----

// Every class in the feed: { moduleCode, dateKey, start, end, time, room, teacher, online, note }
async function fetchTimetable(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Timetable: HTTP ${response.status}`);
  const raw = await response.json();
  return raw
    .map((s) => ({
      moduleCode: s.cod_modulo,
      feedTitle: s.title,
      dateKey: s.start.slice(0, 10),
      start: s.start,
      end: s.end,
      time: s.time,
      room: s.aule.map((room) => `${room.des_edificio}, ${room.des_indirizzo}`).join(" + "),
      teacher: s.docente,
      online: s.teledidattica,
      note: s.note,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

// ----- Exam dates -----

// "05 November 2026 at 09:00" -> { dateKey: "2026-11-05", time: "09:00" }
function parseUniboDate(text) {
  const match = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+at\s+(\d{1,2}:\d{2}))?/);
  if (!match) return null;
  const [, day, monthName, year, time] = match;
  const month = EXAM_MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  return { dateKey: `${year}-${month}-${day.padStart(2, "0")}`, time: time || "" };
}

// Reads the exam dates page. Each exam: { codes, names, dateKey, time, teachers, type, place, registration... }
// The page is made for people, not programs: if UniBo redesigns it, this needs updating.
function parseExamsPage(html) {
  const page = new DOMParser().parseFromString(html, "text/html");
  const exams = [];
  for (const heading of page.querySelectorAll('h3[role="tab"]')) {
    const link = heading.querySelector("a");
    const codeElement = link.querySelector(".code");
    const teacherElement = link.querySelector(".docente");
    let name = link.textContent;
    if (codeElement) name = name.replace(codeElement.textContent, "");
    if (teacherElement) name = name.replace(teacherElement.textContent, "");
    const courseCode = codeElement ? codeElement.textContent.trim() : "";
    const teacher = teacherElement ? toTitleCase(teacherElement.textContent) : "";

    const panel = page.getElementById(heading.getAttribute("aria-controls"));
    if (!panel) continue;
    for (const table of panel.querySelectorAll("table.single-item")) {
      const fields = {};
      for (const row of table.querySelectorAll("tr")) {
        const label = row.querySelector("th")?.textContent.trim();
        const cell = row.querySelector("td");
        if (label && cell) fields[label] = cell;
      }
      const when = parseUniboDate(fields["When"]?.textContent || "");
      if (!when) continue;
      const spans = fields["Subscriptions list:"]?.querySelectorAll("span") || [];
      const opens = spans[0] ? parseUniboDate(spans[0].textContent) : null;
      const closes = spans[1] ? parseUniboDate(spans[1].textContent) : null;
      // Integrated courses: "Componente: 32626 - ECONOMETRICS" says which module the exam is for
      const component = fields["Componente:"]?.textContent.replace(/\s+/g, " ").trim() || "";
      const componentCode = (component.match(/^([A-Z0-9]+)\s*-/) || [])[1] || "";
      const typeText = fields["Test type:"]?.textContent.trim() || "";

      exams.push({
        codes: [courseCode, componentCode].filter(Boolean),
        names: [toTitleCase(name.replace(/\s+/g, " "))],
        dateKey: when.dateKey,
        time: when.time,
        teachers: teacher ? [teacher] : [],
        type: EXAM_TYPES[typeText.toLowerCase()] || typeText,
        place: fields["Place:"]?.textContent.trim() || "",
        registrationOpens: opens?.dateKey || "",
        registrationCloses: closes?.dateKey || "",
      });
    }
  }
  return mergeExamSittings(exams);
}

// UniBo lists one sitting several times (per module, per integrated course, per teacher).
// Same date + time + room = one sitting.
function mergeExamSittings(exams) {
  const byKey = new Map();
  for (const exam of exams) {
    const key = [exam.dateKey, exam.time, exam.place.toLowerCase()].join("|");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, exam);
      continue;
    }
    for (const list of ["codes", "names", "teachers"]) {
      for (const value of exam[list]) if (!existing[list].includes(value)) existing[list].push(value);
    }
  }
  return [...byKey.values()];
}

async function fetchExams(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Exams: HTTP ${response.status}`);
  return parseExamsPage(await response.text());
}

// ----- Matching to our courses (by official code) -----

// Keeps exams of this term's courses and names them from programme.json:
// exam.courseIds, exam.title ("Econometrics"), exam.partOf ("Quantitative Methods ... (I.C.)")
function matchExamsToTerm(exams, term) {
  const result = [];
  for (const exam of exams) {
    const modules = [];
    const courses = [];
    for (const course of term.courses) {
      const matchedModules = course.modules.filter((m) => exam.codes.includes(m.code));
      if (matchedModules.length || exam.codes.includes(course.code)) {
        courses.push(course);
        modules.push(...matchedModules);
      }
    }
    if (courses.length === 0) continue;
    const course = courses[0];
    const moduleNames = [...new Set(modules.map((m) => m.name))];
    result.push({
      ...exam,
      courseIds: courses.map((c) => c.id),
      moduleCodes: modules.map((m) => m.code),
      title: course.integrated && moduleNames.length ? moduleNames.join(" / ") : course.name,
      partOf: course.integrated ? `${course.name} (I.C.)` : "",
    });
  }
  return result.sort((a, b) => (a.dateKey + a.time).localeCompare(b.dateKey + b.time));
}

// Module name for a class, from programme.json (falls back to the feed's title)
function sessionLabel(session, index) {
  const found = index.modulesByCode[session.moduleCode];
  return found ? found.module.name : toTitleCase(session.feedTitle.split("/").pop());
}

// ----- Shared pieces of page -----

// "in 35 days", "Tomorrow", "Today"
function countdownText(dateKey, today) {
  const days = daysBetween(today, dateKey);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

function registrationText(exam, today) {
  const shortDate = { day: "numeric", month: "short", year: "numeric" };
  if (!exam.registrationOpens || !exam.registrationCloses) return null;
  if (today < exam.registrationOpens) return { text: `Registration opens ${formatDay(exam.registrationOpens, shortDate)}`, open: false };
  if (today <= exam.registrationCloses) return { text: `Registration open until ${formatDay(exam.registrationCloses, shortDate)}`, open: true };
  return { text: "Registration closed", open: false };
}

// One exam sitting as a card (home page and course page)
function examItem(exam, today) {
  const item = createElement("div", "exam-item");
  const when = createElement("div", "exam-when");
  when.appendChild(createElement("span", "exam-date", formatDay(exam.dateKey, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  }) + (exam.time ? `, ${exam.time}` : "")));
  if (exam.dateKey >= today) when.appendChild(createElement("span", "badge", countdownText(exam.dateKey, today)));
  item.appendChild(when);
  item.appendChild(createElement("div", "exam-course", exam.title));
  if (exam.partOf) item.appendChild(createElement("div", "schedule-meta", `Part of ${exam.partOf}`));
  const details = [exam.type, exam.place, exam.teachers.join(", ")].filter(Boolean);
  item.appendChild(createElement("div", "schedule-meta", details.join(" · ")));
  const registration = registrationText(exam, today);
  if (registration) item.appendChild(createElement("div", registration.open ? "exam-registration is-open" : "exam-registration", registration.text));
  return item;
}

// Classes grouped by day (home page and course page)
function scheduleDays(sessions, index, today) {
  const box = createElement("div");
  const byDay = {};
  for (const session of sessions) (byDay[session.dateKey] = byDay[session.dateKey] || []).push(session);
  for (const dateKey of Object.keys(byDay).sort()) {
    const day = createElement("div", dateKey === today ? "schedule-day is-today" : "schedule-day");
    day.appendChild(createElement("h3", null, dateKey === today ? `Today, ${formatDay(dateKey)}` : formatDay(dateKey)));
    for (const session of byDay[dateKey]) {
      const item = createElement("div", "schedule-item");
      item.appendChild(createElement("div", "schedule-time", session.time));
      const details = createElement("div", "schedule-details");
      details.appendChild(createElement("div", "schedule-course", sessionLabel(session, index)));
      if (session.online) details.appendChild(createElement("span", "badge", "Online"));
      if (session.room) details.appendChild(createElement("div", "schedule-meta", session.room));
      if (session.teacher) details.appendChild(createElement("div", "schedule-meta", session.teacher));
      if (session.note) details.appendChild(createElement("div", "schedule-meta", session.note));
      item.appendChild(details);
      day.appendChild(item);
    }
    box.appendChild(day);
  }
  return box;
}
