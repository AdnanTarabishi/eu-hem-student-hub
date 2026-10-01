// ===== Exams =====
// Loads upcoming EU-HEM exam dates live from the official UniBo "Exam dates" page.
// That page is made for people, not programs, so we read ("parse") its HTML
// and pick out the parts we need. If UniBo redesigns the page, this may need updating.

const EXAMS_URL = "https://corsi.unibo.it/2cycle/euHealthEconomicsManagement/exam-dates";

const examList = document.getElementById("exam-list");
const examStatus = document.getElementById("exam-status");
const examCourseFilter = document.getElementById("exam-course-filter");

let allExams = [];

// True if we could not load the timetable, so we can't tell which exams are 1st year
let showingAllYears = false;

const MONTHS = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

// UniBo lists the exam type in Italian
const TEST_TYPES = { scritto: "Written", orale: "Oral", pratico: "Practical" };

// --- Reading the UniBo page ---

// "05 November 2026 at 09:00" -> { dateKey: "2026-11-05", time: "09:00" }
function parseUniboDate(text) {
  const match = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+at\s+(\d{1,2}:\d{2}))?/);
  if (!match) return null;
  const [, day, monthName, year, time] = match;
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  return { dateKey: `${year}-${month}-${day.padStart(2, "0")}`, time: time || "" };
}

// Reads one exam table into a simple object
function parseExamTable(table, course) {
  // Collect the rows as { "When": "...", "Place:": "...", ... }
  const fields = {};
  for (const row of table.querySelectorAll("tr")) {
    const label = row.querySelector("th")?.textContent.trim();
    const cell = row.querySelector("td");
    if (label && cell) fields[label] = cell;
  }

  const when = parseUniboDate(fields["When"]?.textContent || "");
  if (!when) return null;

  // Registration dates are the two <span>s: "opened from <span>…</span> to <span>…</span>"
  const registrationSpans = fields["Subscriptions list:"]?.querySelectorAll("span") || [];
  const registrationOpens = registrationSpans[0] ? parseUniboDate(registrationSpans[0].textContent) : null;
  const registrationCloses = registrationSpans[1] ? parseUniboDate(registrationSpans[1].textContent) : null;

  // Integrated courses (I.C.) have parts; "Componente" says which part this exam is for
  const componentText = fields["Componente:"]?.textContent.replace(/\s+/g, " ").trim() || "";
  const componentName = componentText.split(" - ").pop().trim();

  const typeText = fields["Test type:"]?.textContent.trim() || "";

  // An exam can be listed under several names (module, integrated course, ...)
  const names = [course.name];
  if (componentName) names.push(toTitleCase(componentName));

  return {
    dateKey: when.dateKey,
    time: when.time,
    names: names,
    teachers: course.teacher ? [course.teacher] : [],
    type: TEST_TYPES[typeText.toLowerCase()] || typeText,
    place: fields["Place:"]?.textContent.trim() || "",
    registrationOpens: registrationOpens?.dateKey || "",
    registrationCloses: registrationCloses?.dateKey || "",
  };
}

// Reads every course and its exams from the downloaded page
function parseExamsPage(html) {
  const page = new DOMParser().parseFromString(html, "text/html");
  const exams = [];

  // Each course is a heading (<h3 role="tab">) linked to a panel holding its exam tables
  for (const heading of page.querySelectorAll('h3[role="tab"]')) {
    const link = heading.querySelector("a");
    const teacherElement = link.querySelector(".docente");
    const codeElement = link.querySelector(".code");

    // The course name is the link text without the code and teacher
    let name = link.textContent;
    if (codeElement) name = name.replace(codeElement.textContent, "");
    if (teacherElement) name = name.replace(teacherElement.textContent, "");

    const course = {
      name: toTitleCase(name.replace(/\s+/g, " ")),
      teacher: teacherElement ? toTitleCase(teacherElement.textContent) : "",
    };

    const panel = page.getElementById(heading.getAttribute("aria-controls"));
    if (!panel) continue;

    for (const table of panel.querySelectorAll("table.single-item")) {
      const exam = parseExamTable(table, course);
      if (exam) exams.push(exam);
    }
  }

  return mergeDuplicates(exams);
}

// UniBo lists the same exam sitting several times: under the module, the
// integrated course (I.C.), and once per teacher. Same date + time + room
// means it is one sitting, so we merge those into a single exam.
function mergeDuplicates(exams) {
  const byKey = new Map();
  for (const exam of exams) {
    const key = [exam.dateKey, exam.time, exam.place.toLowerCase()].join("|");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, exam);
      continue;
    }
    for (const name of exam.names) {
      if (!existing.names.includes(name)) existing.names.push(name);
    }
    for (const teacher of exam.teachers) {
      if (!existing.teachers.includes(teacher)) existing.teachers.push(teacher);
    }
  }
  return [...byKey.values()];
}

// The exam page lists all years. A course counts as 1st year if it appears in the
// 1st-year timetable. We drop other exams, and drop non-1st-year names from merged exams.
function keepFirstYearExams(exams, timetableSessions) {
  const firstYearNames = new Set(timetableSessions.flatMap((session) => session.allNames));
  const result = [];
  for (const exam of exams) {
    const names = exam.names.filter((name) => firstYearNames.has(name));
    if (names.length > 0) result.push({ ...exam, names: names });
  }
  return result;
}

// Main title = the module/course names; integrated course names (I.C.) go in a "Part of" line
function examTitle(exam) {
  const integrated = exam.names.filter((name) => name.includes("(I.C.)"));
  const plain = exam.names.filter((name) => !name.includes("(I.C.)"));
  if (plain.length === 0) return { title: integrated.join(" / "), partOf: "" };
  return { title: plain.join(" / "), partOf: integrated.join(", ") };
}

// --- Building the page ---

// "in 35 days", "Tomorrow", "Today"
function countdownText(dateKey, today) {
  const days = daysBetween(today, dateKey);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

// Registration status, compared with today's date
function registrationText(exam, today) {
  const shortDate = { day: "numeric", month: "short", year: "numeric" };
  if (!exam.registrationOpens || !exam.registrationCloses) return null;
  if (today < exam.registrationOpens) {
    return { text: `Registration opens ${formatDay(exam.registrationOpens, shortDate)}`, open: false };
  }
  if (today <= exam.registrationCloses) {
    return { text: `Registration open until ${formatDay(exam.registrationCloses, shortDate)}`, open: true };
  }
  return { text: "Registration closed", open: false };
}

function fillExamCourseFilter() {
  const names = [...new Set(allExams.flatMap((exam) => exam.names))].sort();
  for (const name of names) {
    examCourseFilter.appendChild(new Option(name, name));
  }
}

function renderExams() {
  const today = todayKey();
  const selectedCourse = examCourseFilter.value;

  const visibleExams = allExams.filter((exam) => {
    if (exam.dateKey < today) return false;
    if (selectedCourse && !exam.names.includes(selectedCourse)) return false;
    return true;
  });

  examList.innerHTML = "";

  if (visibleExams.length === 0) {
    examStatus.textContent = "No upcoming exams for this selection.";
    return;
  }
  examStatus.textContent = showingAllYears
    ? `Showing ${visibleExams.length} upcoming exams for all years (the 1st-year course list could not be loaded).`
    : `Showing ${visibleExams.length} upcoming 1st-year exams.`;

  for (const exam of visibleExams) {
    const item = createElement("div", "exam-item");

    const when = createElement("div", "exam-when");
    when.appendChild(createElement("span", "exam-date", formatDay(exam.dateKey, {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    }) + (exam.time ? `, ${exam.time}` : "")));
    when.appendChild(createElement("span", "badge", countdownText(exam.dateKey, today)));
    item.appendChild(when);

    const { title, partOf } = examTitle(exam);
    item.appendChild(createElement("div", "exam-course", title));
    if (partOf) item.appendChild(createElement("div", "schedule-meta", `Part of ${partOf}`));

    const details = [exam.type, exam.place, exam.teachers.join(", ")].filter(Boolean);
    item.appendChild(createElement("div", "schedule-meta", details.join(" · ")));

    const registration = registrationText(exam, today);
    if (registration) {
      const className = registration.open ? "exam-registration is-open" : "exam-registration";
      item.appendChild(createElement("div", className, registration.text));
    }

    examList.appendChild(item);
  }
}

async function loadExams() {
  try {
    const response = await fetch(EXAMS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    let exams = parseExamsPage(html);
    if (exams.length === 0) throw new Error("No exams found on the page");

    // Keep only 1st-year exams, using the course names from the timetable
    const sessions = await timetableLoaded;
    if (sessions.length > 0) {
      exams = keepFirstYearExams(exams, sessions);
    } else {
      showingAllYears = true;
    }

    allExams = exams.sort((a, b) => (a.dateKey + a.time).localeCompare(b.dateKey + b.time));

    fillExamCourseFilter();
    renderExams();
  } catch (error) {
    console.error("Could not load exams:", error);
    examStatus.textContent =
      "Sorry, exam dates could not be loaded right now. Please use the official exam dates link above.";
  }
}

examCourseFilter.addEventListener("change", renderExams);

loadExams();
