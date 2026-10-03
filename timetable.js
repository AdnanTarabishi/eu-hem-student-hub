// ===== Timetable page =====
// Loads the 1st-year timetable live from UniBo (address in content/programme.json).
// Two views: Week (Mon-Fri grid) and List (grouped by day). "Now / Next" bar at the top.
// Course names come from programme.json. With a saved study plan, "My courses only" shows just your courses.

const scheduleList = document.getElementById("schedule-list");
const scheduleStatus = document.getElementById("schedule-status");
const courseFilter = document.getElementById("course-filter");
const showPastCheckbox = document.getElementById("show-past");
const VIEW_KEY = "euhem-timetable-view";

const timetable = { programme: null, index: null, sessions: [], view: "week", weekStart: null };

// Classes that pass the filters (course, My courses only)
function filteredSessions() {
  const { programme, index } = timetable;
  const mine = myCoursesOnly(programme) ? new Set(myModuleCodes(programme)) : null;
  const courseId = courseFilter.value;
  return timetable.sessions.filter((session) => {
    if (mine && !mine.has(session.moduleCode)) return false;
    if (courseId && (index.modulesByCode[session.moduleCode] || {}).course?.id !== courseId) return false;
    return true;
  });
}

function courseColorOf(session) {
  const found = timetable.index.modulesByCode[session.moduleCode];
  return (found && found.course.color) || "var(--color-primary)";
}

// ----- "Now / Next" bar -----

function renderNowNext() {
  const box = document.getElementById("now-next");
  const sessions = filteredSessions();
  const { now, next } = nowAndNext(sessions, localIso(new Date()));
  box.innerHTML = "";
  box.hidden = !now && !next;
  const card = (label, session, className) => {
    const item = createElement("div", `now-next-item ${className}`);
    item.style.setProperty("--course-color", courseColorOf(session));
    item.appendChild(createElement("span", "now-next-label", label));
    item.appendChild(createElement("strong", null, sessionLabel(session, timetable.index)));
    const when = session.dateKey === todayKey() ? session.time : `${formatDay(session.dateKey, { weekday: "short", day: "numeric", month: "short" })} · ${session.time}`;
    item.appendChild(createElement("span", "schedule-meta", `${when}${session.room ? " · " + session.room.split(",")[0] : ""}`));
    return item;
  };
  if (now) box.appendChild(card("Now", now, "is-now"));
  if (next) box.appendChild(card(now ? "Next" : "Next class", next, "is-next"));
}

// ----- List view -----

function renderList() {
  const today = todayKey();
  const visible = filteredSessions().filter((s) => showPastCheckbox.checked || s.dateKey >= today);
  scheduleList.innerHTML = "";
  const mine = myCoursesOnly(timetable.programme);
  scheduleStatus.textContent = visible.length
    ? `${visible.length} classes${mine ? " for your courses" : ""}.`
    : "No classes to show for this selection.";
  if (visible.length) scheduleList.appendChild(scheduleDays(visible, timetable.index, today));
}

// ----- Week view -----

function shiftWeek(weeks) {
  const date = new Date(timetable.weekStart + "T12:00:00");
  date.setDate(date.getDate() + weeks * 7);
  timetable.weekStart = dateToKey(date);
  render();
}

function renderWeekNav() {
  const nav = document.getElementById("week-nav");
  nav.innerHTML = "";
  const end = new Date(timetable.weekStart + "T12:00:00");
  end.setDate(end.getDate() + 4);
  nav.appendChild(iconButton("Previous week", "chevron-left", { iconOnly: true, onClick: () => shiftWeek(-1) }));
  nav.appendChild(createElement("strong", "week-label",
    `${formatDay(timetable.weekStart, { day: "numeric", month: "short" })} – ${formatDay(dateToKey(end), { day: "numeric", month: "short", year: "numeric" })}`));
  nav.appendChild(iconButton("Next week", "chevron-right", { iconOnly: true, onClick: () => shiftWeek(1) }));
  const thisWeek = weekStartOf(defaultWeekDay());
  if (timetable.weekStart !== thisWeek) {
    const back = createElement("button", "inline-link", "This week");
    back.type = "button";
    back.addEventListener("click", () => { timetable.weekStart = thisWeek; render(); });
    nav.appendChild(back);
  }
}

// On Saturday/Sunday, "this week" means the coming week
function defaultWeekDay() {
  const today = new Date();
  if (today.getDay() === 6) today.setDate(today.getDate() + 2);
  if (today.getDay() === 0) today.setDate(today.getDate() + 1);
  return dateToKey(today);
}

function showSessionDetails(session) {
  let dialog = document.getElementById("session-dialog");
  if (!dialog) {
    dialog = createElement("dialog", "session-dialog");
    dialog.id = "session-dialog";
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    document.body.appendChild(dialog);
  }
  dialog.innerHTML = "";
  const close = iconButton("Close", "close", { iconOnly: true, className: "dialog-close", onClick: () => dialog.close() });
  dialog.appendChild(close);
  dialog.appendChild(createElement("h2", null, sessionLabel(session, timetable.index)));
  dialog.appendChild(createElement("p", null, `${formatDay(session.dateKey)} · ${session.time}`));
  for (const text of [session.room, session.teacher, session.note, session.online ? "Online" : ""]) {
    if (text) dialog.appendChild(createElement("p", "schedule-meta", text));
  }
  dialog.appendChild(sessionActions(session, timetable.index));
  dialog.showModal();
}

function renderWeek() {
  renderWeekNav();
  const days = [0, 1, 2, 3, 4].map((offset) => {
    const date = new Date(timetable.weekStart + "T12:00:00");
    date.setDate(date.getDate() + offset);
    return dateToKey(date);
  });
  const sessions = filteredSessions().filter((s) => days.includes(s.dateKey));
  const today = todayKey();
  scheduleList.innerHTML = "";
  const mine = myCoursesOnly(timetable.programme);
  scheduleStatus.textContent = sessions.length
    ? `${sessions.length} classes this week${mine ? " for your courses" : ""}. Click a class for details.`
    : "No classes this week.";

  // Hours shown: 8:00-19:00, stretched if a class starts earlier or ends later
  const first = Math.min(8, ...sessions.map((s) => Math.floor(hourOf(s.start))));
  const last = Math.max(19, ...sessions.map((s) => Math.ceil(hourOf(s.end))));
  const span = last - first;

  const grid = createElement("div", "week-grid");
  grid.style.setProperty("--hours", String(span));
  const times = createElement("div", "week-times");
  times.appendChild(createElement("div", "week-day-head"));
  const timeBody = createElement("div", "week-body");
  for (let h = first; h < last; h++) {
    const mark = createElement("span", "week-hour", `${String(h).padStart(2, "0")}:00`);
    mark.style.top = `${((h - first) / span) * 100}%`;
    timeBody.appendChild(mark);
  }
  times.appendChild(timeBody);
  grid.appendChild(times);

  for (const day of days) {
    const column = createElement("div", day === today ? "week-day is-today" : "week-day");
    const head = createElement("div", "week-day-head");
    head.appendChild(createElement("strong", null, formatDay(day, { weekday: "short" })));
    head.appendChild(createElement("span", null, formatDay(day, { day: "numeric", month: "short" })));
    column.appendChild(head);
    const body = createElement("div", "week-body");
    for (const { session, lane, lanes } of layoutDay(sessions.filter((s) => s.dateKey === day))) {
      const block = createElement("button", "week-block");
      block.type = "button";
      block.style.top = `${((hourOf(session.start) - first) / span) * 100}%`;
      block.style.height = `${((hourOf(session.end) - hourOf(session.start)) / span) * 100}%`;
      block.style.left = `${(lane / lanes) * 100}%`;
      block.style.width = `${100 / lanes}%`;
      block.style.setProperty("--course-color", courseColorOf(session));
      block.appendChild(createElement("strong", null, sessionLabel(session, timetable.index)));
      block.appendChild(createElement("span", null, session.time));
      if (session.room) block.appendChild(createElement("span", "week-room", session.room.split(",")[0]));
      block.setAttribute("aria-label", `${sessionLabel(session, timetable.index)}, ${formatDay(day)}, ${session.time}`);
      block.addEventListener("click", () => showSessionDetails(session));
      body.appendChild(block);
    }
    // Red line at the current time
    if (day === today) {
      const now = new Date();
      const hour = now.getHours() + now.getMinutes() / 60;
      if (hour >= first && hour <= last) {
        const line = createElement("div", "week-now");
        line.style.top = `${((hour - first) / span) * 100}%`;
        body.appendChild(line);
      }
    }
    column.appendChild(body);
    grid.appendChild(column);
  }
  const scroller = createElement("div", "week-scroller");
  scroller.appendChild(grid);
  scheduleList.appendChild(scroller);
}

// ----- View switch and page -----

function renderViewSwitch() {
  const box = document.getElementById("view-switch");
  box.innerHTML = "";
  for (const [key, label, icon] of [["week", "Week", "grid"], ["list", "List", "list"]]) {
    const button = iconButton(label, icon, {
      className: "segment",
      onClick: () => {
        timetable.view = key;
        writeStorage(VIEW_KEY, key);
        render();
      },
    });
    button.setAttribute("aria-pressed", String(timetable.view === key));
    box.appendChild(button);
  }
}

function render() {
  renderViewSwitch();
  renderNowNext();
  document.getElementById("week-nav").hidden = timetable.view !== "week";
  document.getElementById("show-past-label").hidden = timetable.view !== "list";
  if (timetable.view === "week") renderWeek();
  else renderList();
  scheduleList.classList.remove("fade-in");
  void scheduleList.offsetWidth; // restart the fade-in animation
  scheduleList.classList.add("fade-in");
}

async function loadTimetable() {
  scheduleList.appendChild(skeleton(4, "card"));
  try {
    timetable.programme = await getProgramme();
    timetable.index = programmeIndex(timetable.programme);
    const cohort = currentCohort(timetable.programme);
    timetable.sessions = await fetchTimetable(cohort.sources.timetableFeed);
    timetable.view = readStorage(VIEW_KEY, window.innerWidth < 640 ? "list" : "week") === "list" ? "list" : "week";
    timetable.weekStart = weekStartOf(defaultWeekDay());

    for (const course of currentTerm(timetable.programme).courses) {
      const codes = course.modules.map((m) => m.code);
      if (timetable.sessions.some((s) => codes.includes(s.moduleCode))) courseFilter.appendChild(new Option(course.name, course.id));
    }
    if (loadPlan(timetable.programme).saved) {
      document.querySelector(".toolbar-filters").appendChild(myCoursesSwitch(timetable.programme, render));
    }
    render();
    setInterval(renderNowNext, 60 * 1000); // keep "Now / Next" up to date
  } catch (error) {
    console.error("Could not load timetable:", error);
    scheduleList.innerHTML = "";
    scheduleStatus.textContent = "Sorry, the timetable could not be loaded right now. Please use the official timetable link above.";
  }
}

courseFilter.addEventListener("change", render);
showPastCheckbox.addEventListener("change", render);

loadTimetable();
