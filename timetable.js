// ===== Timetable =====
// Loads the 1st-year EU-HEM timetable live from the official UniBo website
// and shows it on our page, grouped by day.

// Where UniBo publishes the timetable data (the same source the official page uses)
const TIMETABLE_URL =
  "https://corsi.unibo.it/2cycle/euHealthEconomicsManagement/timetable/@@orario_reale_json?anno=1";

// References to the HTML elements we fill in or listen to
const scheduleList = document.getElementById("schedule-list");
const scheduleStatus = document.getElementById("schedule-status");
const courseFilter = document.getElementById("course-filter");
const showPastCheckbox = document.getElementById("show-past");

// All class sessions, after we download them
let allSessions = [];

// --- Helper functions (shared helpers like createElement are in utils.js) ---

// "QUANTITATIVE METHODS (I.C.) / ECONOMETRICS" -> "Econometrics"
function shortCourseName(fullTitle) {
  return toTitleCase(fullTitle.split("/").pop());
}

// Turns the list of rooms into one readable line, e.g. "AULA 1, Via Irnerio 48 - Bologna"
function roomText(session) {
  const rooms = session.aule.map((room) => `${room.des_edificio}, ${room.des_indirizzo}`);
  return rooms.join(" + ");
}

// --- Building the page ---

// Fills the course dropdown with one option per course
function fillCourseFilter() {
  const courseNames = [...new Set(allSessions.map((s) => s.course))].sort();
  for (const name of courseNames) {
    courseFilter.appendChild(new Option(name, name));
  }
}

// Shows the sessions that match the current filter settings
function renderSchedule() {
  const selectedCourse = courseFilter.value;
  const showPast = showPastCheckbox.checked;
  const today = todayKey();

  const visibleSessions = allSessions.filter((session) => {
    if (selectedCourse && session.course !== selectedCourse) return false;
    if (!showPast && session.dateKey < today) return false;
    return true;
  });

  scheduleList.innerHTML = "";

  if (visibleSessions.length === 0) {
    scheduleStatus.textContent = "No classes to show for this selection.";
    return;
  }
  scheduleStatus.textContent = `Showing ${visibleSessions.length} classes.`;

  // Group sessions by day: { "2026-10-05": [session, session], ... }
  const sessionsByDay = {};
  for (const session of visibleSessions) {
    if (!sessionsByDay[session.dateKey]) sessionsByDay[session.dateKey] = [];
    sessionsByDay[session.dateKey].push(session);
  }

  for (const dateKey of Object.keys(sessionsByDay).sort()) {
    const dayBlock = createElement("div", "schedule-day");
    if (dateKey === today) dayBlock.classList.add("is-today");

    const heading = dateKey === today ? `Today, ${formatDay(dateKey)}` : formatDay(dateKey);
    dayBlock.appendChild(createElement("h3", null, heading));

    for (const session of sessionsByDay[dateKey]) {
      const item = createElement("div", "schedule-item");
      item.appendChild(createElement("div", "schedule-time", session.time));

      const details = createElement("div", "schedule-details");
      details.appendChild(createElement("div", "schedule-course", session.course));
      if (session.online) details.appendChild(createElement("span", "badge", "Online"));
      if (session.room) details.appendChild(createElement("div", "schedule-meta", session.room));
      if (session.teacher) details.appendChild(createElement("div", "schedule-meta", session.teacher));
      if (session.note) details.appendChild(createElement("div", "schedule-meta", session.note));

      item.appendChild(details);
      dayBlock.appendChild(item);
    }

    scheduleList.appendChild(dayBlock);
  }
}

// Downloads the timetable from UniBo and prepares it for display
async function loadTimetable() {
  try {
    const response = await fetch(TIMETABLE_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rawSessions = await response.json();

    // Keep only the fields we need, in a simpler shape
    allSessions = rawSessions
      .map((raw) => ({
        dateKey: raw.start.slice(0, 10),
        start: raw.start,
        time: raw.time,
        course: shortCourseName(raw.title),
        room: roomText(raw),
        teacher: raw.docente,
        online: raw.teledidattica,
        note: raw.note,
      }))
      .sort((a, b) => a.start.localeCompare(b.start));

    fillCourseFilter();
    renderSchedule();
  } catch (error) {
    console.error("Could not load timetable:", error);
    scheduleStatus.textContent =
      "Sorry, the timetable could not be loaded right now. Please use the official timetable link above.";
  }
}

// Re-draw the list whenever the user changes a filter
courseFilter.addEventListener("change", renderSchedule);
showPastCheckbox.addEventListener("change", renderSchedule);

loadTimetable();
