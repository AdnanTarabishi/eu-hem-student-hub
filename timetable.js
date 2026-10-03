// ===== Timetable (home page) =====
// Loads the 1st-year timetable live from UniBo (address in content/programme.json) and shows
// it grouped by day. Course names come from programme.json. With a saved study plan,
// "My courses only" shows just your courses.

const scheduleList = document.getElementById("schedule-list");
const scheduleStatus = document.getElementById("schedule-status");
const courseFilter = document.getElementById("course-filter");
const showPastCheckbox = document.getElementById("show-past");

const timetable = { programme: null, index: null, sessions: [] };

function renderSchedule() {
  const today = todayKey();
  const { programme, index } = timetable;
  const mine = myCoursesOnly(programme) ? new Set(myModuleCodes(programme)) : null;
  const courseId = courseFilter.value;

  const visible = timetable.sessions.filter((session) => {
    if (mine && !mine.has(session.moduleCode)) return false;
    if (courseId && (index.modulesByCode[session.moduleCode] || {}).course?.id !== courseId) return false;
    if (!showPastCheckbox.checked && session.dateKey < today) return false;
    return true;
  });

  scheduleList.innerHTML = "";
  if (visible.length === 0) {
    scheduleStatus.textContent = "No classes to show for this selection.";
    return;
  }
  scheduleStatus.textContent = `Showing ${visible.length} classes${mine ? " for your courses" : ""}.`;
  scheduleList.appendChild(scheduleDays(visible, index, today));
}

async function loadTimetable() {
  try {
    timetable.programme = await getProgramme();
    timetable.index = programmeIndex(timetable.programme);
    timetable.sessions = await fetchTimetable(currentCohort(timetable.programme).sources.timetableFeed);

    // One option per course that has classes, in programme order
    for (const course of currentTerm(timetable.programme).courses) {
      const codes = course.modules.map((m) => m.code);
      if (timetable.sessions.some((s) => codes.includes(s.moduleCode))) courseFilter.appendChild(new Option(course.name, course.id));
    }
    if (loadPlan(timetable.programme).saved) {
      document.querySelector("#schedule .schedule-filters").appendChild(myCoursesSwitch(timetable.programme, renderSchedule));
    }
    renderSchedule();
  } catch (error) {
    console.error("Could not load timetable:", error);
    scheduleStatus.textContent =
      "Sorry, the timetable could not be loaded right now. Please use the official timetable link above.";
  }
}

courseFilter.addEventListener("change", renderSchedule);
showPastCheckbox.addEventListener("change", renderSchedule);

loadTimetable();
