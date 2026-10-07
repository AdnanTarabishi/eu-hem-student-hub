// Academic planner: official UniBo classes, with a weekly calendar and searchable agenda.
const scheduleList = document.getElementById("schedule-list");
const scheduleStatus = document.getElementById("schedule-status");
const courseFilter = document.getElementById("course-filter");
const classSearch = document.getElementById("timetable-search");
const showPastCheckbox = document.getElementById("show-past");
const VIEW_KEY = "euhem-timetable-view";
const timetable = { programme: null, index: null, sessions: [], ready: false,
  view: readStorage(VIEW_KEY, window.innerWidth < 640 ? "list" : "week") === "list" ? "list" : "week",
  weekStart: weekStartOf(Planner.clock().slice(0, 10)), lastClock: "" };

function filteredSessions() {
  const mine = myCoursesOnly(timetable.programme) ? new Set(myModuleCodes(timetable.programme)) : null;
  const query = simplify(classSearch.value.trim());
  return timetable.sessions.filter(session => {
    if (mine && !mine.has(session.moduleCode)) return false;
    if (courseFilter.value && timetable.index.modulesByCode[session.moduleCode]?.course.id !== courseFilter.value) return false;
    return !query || simplify([sessionLabel(session, timetable.index), session.room, session.teacher, session.note,
      session.online ? "online" : ""].join(" ")).includes(query);
  });
}

function courseColorOf(session) {
  return timetable.index.modulesByCode[session.moduleCode]?.course.color || "var(--color-primary)";
}

function resetTimetableFilters() {
  courseFilter.value = "";
  classSearch.value = "";
  showPastCheckbox.checked = false;
  render();
}

function weekSessions() {
  const end = Planner.addDays(timetable.weekStart, 6);
  return filteredSessions().filter(s => s.dateKey >= timetable.weekStart && s.dateKey <= end);
}

function listSessions(now) {
  return filteredSessions().filter(s => showPastCheckbox.checked || s.end > now);
}

function renderNowNext(now) {
  const box = document.getElementById("now-next");
  // Automatic updates must not remove a class button that holds keyboard focus.
  if (box.contains(document.activeElement)) return;
  const { now: current, next } = nowAndNext(filteredSessions(), now);
  box.replaceChildren();
  for (const [label, session, state] of [["Happening now", current, "is-now"], ["Next class", next, "is-next"]]) {
    if (!session) continue;
    const item = createElement("button", `now-next-item ${state}`);
    item.type = "button";
    item.style.setProperty("--course-color", courseColorOf(session));
    item.append(createElement("span", "now-next-label", label),
      createElement("strong", null, sessionLabel(session, timetable.index)));
    const day = session.dateKey === now.slice(0, 10) ? "Today" : formatDay(session.dateKey, { weekday: "short", day: "numeric", month: "short" });
    item.appendChild(createElement("span", "schedule-meta", `${day} · ${session.time}`));
    item.appendChild(createElement("span", "schedule-meta", session.online ? "Online class" : session.room.split(",")[0] || "Room to be confirmed"));
    item.addEventListener("click", () => showSessionDetails(session));
    box.appendChild(item);
  }
  if (!current && !next) box.appendChild(createElement("p", "planning-next-meta", "No upcoming classes for this selection. Browse another week or clear your filters."));
}

function renderSummary(sessions) {
  const hours = sessions.reduce((sum, s) => sum + (Date.parse(s.end + "Z") - Date.parse(s.start + "Z")) / 3600000, 0);
  const courses = new Set(sessions.map(s => timetable.index.modulesByCode[s.moduleCode]?.course.id || s.moduleCode));
  const scope = myCoursesOnly(timetable.programme) ? "Your study plan" : "All courses";
  const range = timetable.view === "week" ? "Selected week" : showPastCheckbox.checked ? "Full agenda" : "Upcoming agenda";
  Planner.summary(document.getElementById("timetable-summary"), [
    { label: "Classes in view", value: sessions.length, note: `${range} · ${scope}` },
    { label: "Teaching hours", value: `${Number(hours.toFixed(1))} h`, note: "Total scheduled class time" },
    { label: "Courses in view", value: courses.size, note: "Course colours connect your schedule" },
  ]);
  const legend = document.getElementById("timetable-legend");
  legend.replaceChildren();
  const seen = new Set();
  for (const session of sessions) {
    const course = timetable.index.modulesByCode[session.moduleCode]?.course;
    const key = course?.id || session.moduleCode;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = createElement("span", "planning-legend-item", course?.name || sessionLabel(session, timetable.index));
    item.style.setProperty("--course-color", courseColorOf(session));
    legend.appendChild(item);
  }
}

function noClasses(title, text) {
  Planner.empty(scheduleList, { title, text, onReset: resetTimetableFilters });
  if (timetable.view !== "week") return;
  const next = filteredSessions().find(s => s.dateKey > Planner.addDays(timetable.weekStart, 6));
  if (next) scheduleList.querySelector(".item-actions").appendChild(iconButton("Next week with classes", "arrow-right", {
    onClick: () => { timetable.weekStart = weekStartOf(next.dateKey); render(); },
  }));
}

function renderList(sessions, now) {
  scheduleList.replaceChildren();
  scheduleStatus.textContent = sessions.length ? `${sessions.length} ${sessions.length === 1 ? "class" : "classes"} · ${showPastCheckbox.checked ? "including past classes" : "upcoming and in progress"}.` : "No classes for this selection.";
  if (!sessions.length) return noClasses("A little breathing room.", "No classes match this agenda. Try another course or search, or include past classes. If My courses only is on, check your study plan.");
  const groups = new Map();
  for (const session of sessions) {
    if (!groups.has(session.dateKey)) groups.set(session.dateKey, []);
    groups.get(session.dateKey).push(session);
  }
  for (const [day, classes] of groups) {
    const section = createElement("section", `agenda-day${day === now.slice(0, 10) ? " is-today" : ""}`);
    const head = createElement("div", "agenda-day-head");
    const date = createElement("time", "agenda-date-badge", formatDay(day, { day: "2-digit", month: "short" }));
    date.dateTime = day;
    date.setAttribute("aria-label", formatDay(day));
    head.appendChild(date);
    head.appendChild(createElement("h3", null, day === now.slice(0, 10) ? "Today" : formatDay(day, { weekday: "long" })));
    head.appendChild(createElement("span", "schedule-meta", `${classes.length} ${classes.length === 1 ? "class" : "classes"}`));
    section.appendChild(head);
    for (const session of classes) {
      const item = createElement("article", "agenda-item");
      item.style.setProperty("--course-color", courseColorOf(session));
      const time = createElement("div", "agenda-time", session.time);
      if (session.start <= now && session.end > now) time.appendChild(createElement("span", "badge", "Now"));
      const details = createElement("div", "agenda-details");
      details.appendChild(createElement("h4", null, sessionLabel(session, timetable.index)));
      if (session.online) details.appendChild(createElement("span", "badge", "Online"));
      for (const text of [session.room || (session.online ? "Online class" : "Room to be confirmed"), session.teacher, session.note]) {
        if (text) details.appendChild(createElement("p", "agenda-meta", text));
      }
      details.appendChild(sessionActions(session, timetable.index));
      item.append(time, details);
      section.appendChild(item);
    }
    scheduleList.appendChild(section);
  }
}

function updateWeekControls(dayCount) {
  document.getElementById("week-label").textContent = `${formatDay(timetable.weekStart, { day: "numeric", month: "short" })} – ${formatDay(Planner.addDays(timetable.weekStart, dayCount - 1), { day: "numeric", month: "short", year: "numeric" })}`;
  document.getElementById("week-picker").value = timetable.weekStart;
}

function showSessionDetails(session) {
  let dialog = document.getElementById("session-dialog");
  if (!dialog) {
    dialog = createElement("dialog", "session-dialog");
    dialog.id = "session-dialog";
    dialog.setAttribute("aria-labelledby", "session-detail-title");
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    document.body.appendChild(dialog);
  }
  dialog.replaceChildren(iconButton("Close", "close", { iconOnly: true, className: "dialog-close", onClick: () => dialog.close() }));
  dialog.appendChild(createElement("p", "section-eyebrow", "Class details"));
  const heading = createElement("h2", null, sessionLabel(session, timetable.index));
  heading.id = "session-detail-title";
  dialog.append(heading, createElement("p", "planning-detail-date", `${formatDay(session.dateKey)} · ${session.time}`));
  const grid = createElement("div", "session-detail-grid");
  for (const [label, value] of [["Location", session.room || (session.online ? "Online class" : "Room to be confirmed")], ["Teacher", session.teacher], ["Format", session.online ? "Online" : "On campus"], ["Notes", session.note]]) {
    if (!value) continue;
    const detail = createElement("div", "session-detail");
    detail.append(createElement("span", null, label), createElement("strong", null, value));
    grid.appendChild(detail);
  }
  dialog.append(grid, createElement("p", "schedule-meta", "Bologna time · Check UniBo for last-minute changes."), sessionActions(session, timetable.index));
  dialog.showModal();
}

function renderWeek(sessions, now) {
  const dayCount = sessions.some(s => s.dateKey === Planner.addDays(timetable.weekStart, 6)) ? 7 : sessions.some(s => s.dateKey === Planner.addDays(timetable.weekStart, 5)) ? 6 : 5;
  updateWeekControls(dayCount);
  scheduleList.replaceChildren();
  scheduleStatus.textContent = sessions.length ? `${sessions.length} ${sessions.length === 1 ? "class" : "classes"} in this week. Select a class for details.` : "No classes in this week.";
  if (!sessions.length) return noClasses("No classes in this week.", "Explore another week or adjust your filters. Only published UniBo classes appear here.");
  const first = Math.min(8, ...sessions.map(s => Math.floor(hourOf(s.start))));
  const last = Math.max(19, ...sessions.map(s => Math.ceil(hourOf(s.end))));
  const span = last - first;
  const grid = createElement("div", "week-grid");
  grid.style.setProperty("--hours", String(span));
  grid.style.setProperty("--days", String(dayCount));
  grid.dataset.first = first;
  grid.dataset.span = span;
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
  for (let offset = 0; offset < dayCount; offset++) {
    const day = Planner.addDays(timetable.weekStart, offset);
    const column = createElement("div", `week-day${day === now.slice(0, 10) ? " is-today" : ""}`);
    column.dataset.date = day;
    const head = createElement("div", "week-day-head");
    head.append(createElement("strong", null, formatDay(day, { weekday: "short" })), createElement("span", null, formatDay(day, { day: "numeric", month: "short" })));
    const body = createElement("div", "week-body");
    for (const { session, lane, lanes } of layoutDay(sessions.filter(s => s.dateKey === day))) {
      const block = createElement("button", "week-block");
      block.type = "button";
      block.style.top = `${((hourOf(session.start) - first) / span) * 100}%`;
      block.style.height = `${((hourOf(session.end) - hourOf(session.start)) / span) * 100}%`;
      block.style.left = `${(lane / lanes) * 100}%`;
      block.style.width = `${100 / lanes}%`;
      block.style.setProperty("--course-color", courseColorOf(session));
      block.append(createElement("strong", null, sessionLabel(session, timetable.index)), createElement("span", null, session.time),
        createElement("span", "week-room", session.online ? "Online" : session.room.split(",")[0] || "Room TBC"));
      block.setAttribute("aria-label", `${sessionLabel(session, timetable.index)}, ${formatDay(day)}, ${session.time}`);
      block.addEventListener("click", () => showSessionDetails(session));
      body.appendChild(block);
    }
    column.append(head, body);
    grid.appendChild(column);
  }
  const scroller = createElement("div", "week-scroller");
  scroller.tabIndex = 0;
  scroller.setAttribute("role", "region");
  scroller.setAttribute("aria-label", "Weekly class calendar; scroll horizontally to see all days");
  scroller.appendChild(grid);
  scheduleList.appendChild(scroller);
  updateCurrentLine(now);
}

function updateCurrentLine(now) {
  const grid = scheduleList.querySelector(".week-grid");
  if (!grid) return;
  grid.querySelectorAll(".week-now").forEach(line => line.remove());
  const column = [...grid.querySelectorAll(".week-day")].find(day => day.dataset.date === now.slice(0, 10));
  const hour = hourOf(now), first = Number(grid.dataset.first), span = Number(grid.dataset.span);
  if (column && hour >= first && hour <= first + span) {
    const line = createElement("div", "week-now");
    line.setAttribute("aria-hidden", "true");
    line.style.top = `${((hour - first) / span) * 100}%`;
    column.querySelector(".week-body").appendChild(line);
  }
}

function render() {
  if (!timetable.ready) return;
  const now = Planner.clock();
  document.querySelectorAll("#view-switch [data-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === timetable.view)));
  document.getElementById("week-nav").hidden = timetable.view !== "week";
  document.getElementById("week-picker-label").hidden = timetable.view !== "week";
  document.getElementById("show-past-label").hidden = timetable.view !== "list";
  const sessions = timetable.view === "week" ? weekSessions() : listSessions(now);
  renderNowNext(now);
  renderSummary(sessions);
  if (timetable.view === "week") renderWeek(sessions, now);
  else renderList(sessions, now);
  timetable.lastClock = now;
}

async function loadTimetable() {
  timetable.ready = false;
  scheduleList.replaceChildren(skeleton(4, "card"));
  scheduleList.setAttribute("aria-busy", "true");
  scheduleStatus.textContent = "Loading classes from UniBo…";
  document.querySelectorAll(".planning-toolbar input, .planning-toolbar select, .planning-toolbar button").forEach(control => { control.disabled = true; });
  try {
    timetable.programme = timetable.programme || await loadProgramme();
    timetable.index = programmeIndex(timetable.programme);
    const cohort = currentCohort(timetable.programme);
    const source = document.getElementById("timetable-source");
    source.href = cohort.sources.timetableFeed.split("/@@")[0];
    timetable.sessions = await fetchTimetable(cohort.sources.timetableFeed);
    courseFilter.replaceChildren(new Option("All courses", ""));
    for (const course of currentTerm(timetable.programme).courses) {
      if (timetable.sessions.some(s => course.modules.some(m => m.code === s.moduleCode))) courseFilter.appendChild(new Option(course.name, course.id));
    }
    if (loadPlan(timetable.programme).saved && !document.querySelector(".my-courses-switch")) {
      document.querySelector(".toolbar-filters").appendChild(myCoursesSwitch(timetable.programme, render));
    }
    timetable.ready = true;
    Planner.checked(document.getElementById("timetable-checked"));
    render();
  } catch (error) {
    scheduleStatus.textContent = "The official schedule is unavailable right now.";
    document.getElementById("timetable-checked").textContent = "Could not load UniBo schedule";
    document.getElementById("now-next").replaceChildren(createElement("p", "planning-next-meta", "Check the official timetable while we reconnect."));
    Planner.empty(scheduleList, { title: "Let’s reconnect to your schedule.", text: "We couldn’t load UniBo’s classes. Try again, or open the official timetable.", retry: loadTimetable, source: document.getElementById("timetable-source").href });
    document.getElementById("timetable-summary").replaceChildren();
  } finally {
    scheduleList.setAttribute("aria-busy", "false");
    document.querySelectorAll(".planning-toolbar input, .planning-toolbar select, .planning-toolbar button").forEach(control => { control.disabled = !timetable.ready; });
  }
}

document.querySelectorAll("#view-switch [data-view]").forEach(button => button.addEventListener("click", () => {
  timetable.view = button.dataset.view;
  writeStorage(VIEW_KEY, timetable.view);
  render();
}));
document.getElementById("week-prev").addEventListener("click", () => { timetable.weekStart = Planner.addDays(timetable.weekStart, -7); render(); });
document.getElementById("week-next").addEventListener("click", () => { timetable.weekStart = Planner.addDays(timetable.weekStart, 7); render(); });
document.getElementById("week-today").addEventListener("click", () => { timetable.weekStart = weekStartOf(Planner.clock().slice(0, 10)); render(); });
document.getElementById("week-picker").addEventListener("change", event => { if (event.target.value) { timetable.weekStart = weekStartOf(event.target.value); render(); } });
document.getElementById("timetable-reset").addEventListener("click", resetTimetableFilters);
courseFilter.addEventListener("change", render);
showPastCheckbox.addEventListener("change", render);
classSearch.addEventListener("input", render);
function refreshTimetableClock() {
  if (!timetable.ready || document.hidden || document.getElementById("session-dialog")?.open) return;
  const now = Planner.clock(), previous = timetable.lastClock;
  const changed = now.slice(0, 10) !== previous.slice(0, 10) || (timetable.view === "list" &&
    timetable.sessions.some(s => [s.start, s.end].some(time => time > previous && time <= now)));
  renderNowNext(now);
  updateCurrentLine(now);
  // Defer replacing agenda/calendar actions until keyboard focus leaves the schedule.
  if (changed && scheduleList.contains(document.activeElement)) return;
  if (changed) render();
  else timetable.lastClock = now;
}
setInterval(refreshTimetableClock, 60000);
document.addEventListener("visibilitychange", refreshTimetableClock);
document.addEventListener("focusout", () => setTimeout(refreshTimetableClock, 0));
loadTimetable();
