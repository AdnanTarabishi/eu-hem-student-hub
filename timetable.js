// Official UniBo classes, with Day / Week / Month / List views.
// Academic facts stay in programme.json and the official feed. No personal events or remote tracking.
const scheduleList = document.getElementById("schedule-list");
const scheduleStatus = document.getElementById("schedule-status");
const courseFilter = document.getElementById("course-filter");
const classSearch = document.getElementById("timetable-search");
const showPastCheckbox = document.getElementById("show-past");
const VIEW_KEY = "euhem-timetable-view";
const TEACHER_KEY = "euhem-timetable-show-teacher";
const VIEW_NAMES = ["day", "week", "month", "list"];
const initialParams = new URLSearchParams(window.location.search);
const initialView = initialParams.get("view") || readStorage(VIEW_KEY, window.innerWidth < 640 ? "day" : "week");
const initialDate = TimetableCalendar.validDate(initialParams.get("date")) ? initialParams.get("date") : Planner.clock().slice(0, 10);
const timetable = { programme: null, index: null, sessions: [], ready: false, loading: false,
  view: VIEW_NAMES.includes(initialView) ? initialView : "week",
  selectedDate: initialDate, weekStart: TimetableCalendar.monday(initialDate), lastClock: "",
  showTeacher: readStorage(TEACHER_KEY, false) === true };
const teacherCheckbox = document.getElementById("show-teacher");
teacherCheckbox.checked = timetable.showTeacher;

function setSelectedDate(date) {
  if (!TimetableCalendar.validDate(date)) return;
  timetable.selectedDate = date;
  timetable.weekStart = TimetableCalendar.monday(date);
}

function teacherLine(session, className = "") {
  if (!session.teacher) return null;
  const line = createElement("span", `tt-teacher ${className}`, session.teacher);
  line.hidden = !timetable.showTeacher;
  return line;
}

function changeTimetableView(view, date) {
  if (!VIEW_NAMES.includes(view)) return;
  if (date) setSelectedDate(date);
  timetable.view = view;
  writeStorage(VIEW_KEY, view);
  render();
}

function navigatePeriod(offset) {
  const next = timetable.view === "month" ? TimetableCalendar.shiftMonth(timetable.selectedDate, offset)
    : TimetableCalendar.addDays(timetable.selectedDate, offset * (timetable.view === "day" ? 1 : 7));
  setSelectedDate(next);
  render();
}

function filteredSessions() {
  const mine = myCoursesOnly(timetable.programme) ? new Set(myModuleCodes(timetable.programme)) : null;
  const query = simplify(classSearch.value.trim());
  return timetable.sessions.filter(session => {
    if (mine && !mine.has(session.moduleCode)) return false;
    if (courseFilter.value && timetable.index.modulesByCode[session.moduleCode]?.course.id !== courseFilter.value) return false;
    const locationSearch = typeof TimetableLocations !== "undefined" ? TimetableLocations.searchText(session.room) : "";
    return !query || simplify([sessionLabel(session, timetable.index), session.room, locationSearch, session.teacher, session.note,
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
    const locationText = session.online ? "Online class" : session.room || "Room to be confirmed";
    const locationLine = createElement("span", "schedule-meta tt-full-location", locationText);
    locationLine.title = locationText;
    item.appendChild(locationLine);
    const teacher = teacherLine(session, "schedule-meta");
    if (teacher) item.appendChild(teacher);
    item.addEventListener("click", () => showSessionDetails(session));
    box.appendChild(item);
  }
  if (!current && !next) box.appendChild(createElement("p", "planning-next-meta", "No upcoming classes for this selection. Browse another week or clear your filters."));
}

function renderSummary(sessions) {
  const hours = sessions.reduce((sum, s) => sum + (Date.parse(s.end + "Z") - Date.parse(s.start + "Z")) / 3600000, 0);
  const courses = new Set(sessions.map(s => timetable.index.modulesByCode[s.moduleCode]?.course.id || s.moduleCode));
  const scope = myCoursesOnly(timetable.programme) ? "Your study plan" : "All courses";
  const range = ({ day: "Selected day", week: "Selected week", month: "Selected month" })[timetable.view] || (showPastCheckbox.checked ? "Full agenda" : "Upcoming agenda");
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
    onClick: () => { setSelectedDate(next.dateKey); render(); },
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
    for (const session of classes) section.appendChild(timetableCard(session, now));
    scheduleList.appendChild(section);
  }
}

function timetableCard(session, now) {
  const item = createElement("article", "agenda-item tt-class-card");
  item.style.setProperty("--course-color", courseColorOf(session));
  const time = createElement("div", "agenda-time", session.time);
  time.appendChild(createElement("span", "tt-duration", `${TimetableCalendar.hours([session])} h`));
  if (session.start <= now && session.end > now) time.appendChild(createElement("span", "badge", "Now"));
  const details = createElement("div", "agenda-details");
  const heading = createElement("h4");
  const title = createElement("button", "tt-class-title", sessionLabel(session, timetable.index));
  title.type = "button";
  title.addEventListener("click", () => showSessionDetails(session));
  heading.appendChild(title);
  details.appendChild(heading);
  if (session.online) details.appendChild(createElement("span", "badge", "Online"));
  details.appendChild(createElement("p", "agenda-meta", session.room || (session.online ? "Online class" : "Room to be confirmed")));
  const teacher = teacherLine(session, "agenda-meta");
  if (teacher) details.appendChild(teacher);
  if (session.note) details.appendChild(createElement("p", "agenda-meta tt-class-note", session.note));
  const actions = sessionActions(session, timetable.index);
  actions.prepend(iconButton("Details", "info", { onClick: () => showSessionDetails(session), ariaLabel: `Details: ${sessionLabel(session, timetable.index)}, ${session.dateKey}` }));
  details.appendChild(actions);
  item.append(time, details);
  return item;
}

function updateWeekControls(dayCount = 7) {
  const { view, selectedDate, weekStart } = timetable;
  const period = view === "month" ? "month" : view === "day" ? "day" : "week";
  document.getElementById("week-prev").setAttribute("aria-label", `Previous ${period}`);
  document.getElementById("week-next").setAttribute("aria-label", `Next ${period}`);
  document.getElementById("week-today").textContent = view === "day" ? "Today" : `This ${period}`;
  document.getElementById("week-label").textContent = view === "month"
    ? formatDay(selectedDate, { month: "long", year: "numeric" })
    : view === "day" ? formatDay(selectedDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : `${formatDay(weekStart, { day: "numeric", month: "short" })} – ${formatDay(TimetableCalendar.addDays(weekStart, dayCount - 1), { day: "numeric", month: "short", year: "numeric" })}`;
  document.getElementById("week-picker").value = view === "week" ? weekStart : selectedDate;
}

function dayHeading(date, count, now) {
  const head = createElement("header", "tt-day-heading");
  head.appendChild(createElement("p", "section-eyebrow", date === now.slice(0, 10) ? "Today · Bologna time" : "Selected day · Bologna time"));
  const title = createElement("h3", null, formatDay(date, { weekday: "long", day: "numeric", month: "long" }));
  head.append(title, createElement("p", "schedule-meta", `${count} ${count === 1 ? "class" : "classes"} in the current selection`));
  return head;
}

function renderDay(sessions, now) {
  scheduleList.replaceChildren();
  const strip = createElement("nav", "tt-day-strip");
  strip.setAttribute("aria-label", "Choose a day in this week");
  const all = filteredSessions();
  for (let offset = 0; offset < 7; offset++) {
    const date = TimetableCalendar.addDays(timetable.weekStart, offset);
    const count = all.filter(session => session.dateKey === date).length;
    const button = createElement("button", `tt-day-choice${count ? " has-classes" : ""}`);
    button.type = "button";
    button.dataset.date = date;
    button.setAttribute("aria-pressed", String(date === timetable.selectedDate));
    button.setAttribute("aria-label", `${formatDay(date)}, ${count} ${count === 1 ? "class" : "classes"}`);
    if (date === now.slice(0, 10)) button.setAttribute("aria-current", "date");
    button.append(createElement("span", null, formatDay(date, { weekday: "short" })), createElement("strong", null, date.slice(8)), createElement("span", "tt-day-count", count ? `${count} ${count === 1 ? "class" : "classes"}` : "—"));
    button.addEventListener("click", () => { setSelectedDate(date); render(); scheduleList.querySelector(`.tt-day-choice[data-date="${date}"]`)?.focus({ preventScroll: true }); });
    strip.appendChild(button);
  }
  scheduleList.append(strip, dayHeading(timetable.selectedDate, sessions.length, now));
  const list = createElement("div", "tt-day-agenda");
  for (const session of sessions) list.appendChild(timetableCard(session, now));
  if (!sessions.length) Planner.empty(list, { title: "No classes listed for this day.", text: "Try another date or clear your filters. An empty day is not an official cancellation notice.", onReset: resetTimetableFilters });
  scheduleList.appendChild(list);
  scheduleStatus.textContent = `${sessions.length} ${sessions.length === 1 ? "class" : "classes"} on ${formatDay(timetable.selectedDate, { day: "numeric", month: "short" })}. Day view includes earlier classes.`;
}

function renderMonth(sessions, now) {
  scheduleList.replaceChildren();
  const month = timetable.selectedDate.slice(0, 7), all = filteredSessions();
  const byDay = new Map();
  for (const session of all) {
    if (!byDay.has(session.dateKey)) byDay.set(session.dateKey, []);
    byDay.get(session.dateKey).push(session);
  }
  const layout = createElement("div", "tt-month-layout");
  const calendar = createElement("div", "tt-month-calendar");
  const key = createElement("p", "tt-month-key");
  key.append(createElement("span", "tt-key-swatch"), document.createTextNode("Coloured days have classes · Select a date for its schedule"));
  const table = createElement("table", "tt-month-table");
  const caption = createElement("caption", "sr-only", `${formatDay(timetable.selectedDate, { month: "long", year: "numeric" })} class calendar. Arrow keys move between dates; Enter opens a day. Page Up and Page Down change month.`);
  table.appendChild(caption);
  const thead = createElement("thead"), weekdays = createElement("tr");
  for (const label of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    const th = createElement("th", null, label); th.scope = "col"; weekdays.appendChild(th);
  }
  thead.appendChild(weekdays); table.appendChild(thead);
  const tbody = createElement("tbody");
  let row;
  const days = TimetableCalendar.monthDays(timetable.selectedDate);
  for (const [position, { date, inMonth }] of days.entries()) {
    if (position % 7 === 0) { row = createElement("tr"); tbody.appendChild(row); }
    const classes = byDay.get(date) || [];
    const td = createElement("td", `${inMonth ? "" : "tt-outside"}${classes.length ? " has-classes" : ""}`);
    const button = createElement("button", "tt-month-day");
    button.type = "button";
    button.dataset.date = date;
    button.tabIndex = date === timetable.selectedDate ? 0 : -1;
    button.setAttribute("aria-pressed", String(date === timetable.selectedDate));
    button.setAttribute("aria-controls", "tt-selected-day");
    button.setAttribute("aria-label", `${formatDay(date)}, ${classes.length} ${classes.length === 1 ? "class" : "classes"}${inMonth ? "" : ", adjacent month"}`);
    if (date === now.slice(0, 10)) button.setAttribute("aria-current", "date");
    const top = createElement("span", "tt-month-day-top");
    top.appendChild(createElement("span", "tt-date-number", String(Number(date.slice(8)))));
    if (date === now.slice(0, 10)) top.appendChild(createElement("span", "tt-today-label", "Today"));
    button.appendChild(top);
    if (classes.length) {
      button.appendChild(createElement("span", "tt-month-count", `${classes.length} ${classes.length === 1 ? "class" : "classes"}`));
      const dots = createElement("span", "tt-course-dots");
      dots.setAttribute("aria-hidden", "true");
      for (const color of [...new Set(classes.map(courseColorOf))].slice(0, 4)) {
        const dot = createElement("span"); dot.style.background = color; dots.appendChild(dot);
      }
      button.appendChild(dots);
      const preview = createElement("span", "tt-month-preview");
      preview.setAttribute("aria-hidden", "true");
      for (const session of classes.slice(0, 2)) {
        const entry = createElement("span", "tt-month-entry");
        entry.appendChild(createElement("span", null, `${session.start.slice(11, 16)} ${sessionLabel(session, timetable.index)}`));
        const teacher = teacherLine(session); if (teacher) entry.appendChild(teacher);
        preview.appendChild(entry);
      }
      if (classes.length > 2) preview.appendChild(createElement("span", "tt-month-more", `+${classes.length - 2} more`));
      button.appendChild(preview);
    } else button.appendChild(createElement("span", "tt-no-classes", "—"));
    button.addEventListener("click", event => {
      setSelectedDate(date); render();
      const target = event.detail > 0 && window.innerWidth < 900 ? document.getElementById("tt-selected-day-title") : scheduleList.querySelector(`.tt-month-day[data-date="${date}"]`);
      target?.focus({ preventScroll: true });
      if (event.detail > 0 && window.innerWidth < 900) target?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    button.addEventListener("keydown", event => {
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
        Home: -((new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7),
        End: 6 - ((new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7) };
      let next;
      if (event.key in offsets) next = TimetableCalendar.addDays(date, offsets[event.key]);
      else if (event.key === "PageUp" || event.key === "PageDown") next = TimetableCalendar.shiftMonth(date, event.key === "PageUp" ? -1 : 1);
      else return;
      event.preventDefault();
      if (!TimetableCalendar.validDate(next)) return;
      if (next.slice(0, 7) !== month) { setSelectedDate(next); render(); }
      const target = scheduleList.querySelector(`.tt-month-day[data-date="${next}"]`);
      if (target) {
        scheduleList.querySelectorAll(".tt-month-day").forEach(day => { day.tabIndex = -1; });
        target.tabIndex = 0; target.focus({ preventScroll: true });
      }
    });
    td.appendChild(button); row.appendChild(td);
  }
  table.appendChild(tbody); calendar.append(key, table);
  const panel = createElement("section", "tt-selected-day");
  panel.id = "tt-selected-day";
  panel.setAttribute("aria-labelledby", "tt-selected-day-title");
  const selected = byDay.get(timetable.selectedDate) || [];
  const head = dayHeading(timetable.selectedDate, selected.length, now);
  const title = head.querySelector("h3"); title.id = "tt-selected-day-title"; title.tabIndex = -1;
  panel.append(head, iconButton("Open day view", "arrow-right", { onClick: () => { changeTimetableView("day"); document.querySelector('[data-view="day"]').focus(); } }));
  for (const session of selected) panel.appendChild(timetableCard(session, now));
  if (!selected.length) panel.appendChild(createElement("p", "tt-month-empty", "No classes listed for this date with the current filters. Check UniBo for updates; an empty date does not confirm a cancellation."));
  layout.append(calendar, panel); scheduleList.appendChild(layout);
  const daysWithClasses = new Set(sessions.map(session => session.dateKey)).size;
  scheduleStatus.textContent = `${sessions.length} ${sessions.length === 1 ? "class" : "classes"} across ${daysWithClasses} teaching ${daysWithClasses === 1 ? "day" : "days"} this month · ${selected.length} on the selected day.`;
}

function sessionLocationDetail(session) {
  const detail = createElement("div", "session-detail session-location-detail");
  detail.appendChild(createElement("span", "session-detail-label", "Location"));
  if (session.online) {
    detail.appendChild(createElement("strong", "session-location-official", "Online class"));
    return detail;
  }
  const classrooms = Array.isArray(session.classrooms) ? session.classrooms.filter(room =>
    room && [room.name, room.floor, room.building, room.address].some(Boolean)) : [];
  if (!classrooms.length && !session.room) {
    detail.appendChild(createElement("strong", "session-location-official", "Room to be confirmed"));
    return detail;
  }

  const official = createElement("div", "session-location-official-list");
  if (classrooms.length) {
    for (const [index, classroom] of classrooms.entries()) {
      const card = createElement("div", "session-location-official-card");
      card.appendChild(createElement("span", "session-location-official-kicker",
        classrooms.length > 1 ? `Official location ${index + 1}` : "Official UniBo location"));
      card.appendChild(createElement("strong", "session-location-official", classroom.name || "Classroom name not listed"));
      const facts = createElement("div", "session-location-facts");
      for (const [label, value] of [["Floor", classroom.floor], ["Building", classroom.building], ["Address", classroom.address]]) {
        if (!value) continue;
        const item = createElement("span", "session-location-fact");
        item.append(createElement("b", null, label), document.createTextNode(value));
        facts.appendChild(item);
      }
      if (facts.childElementCount) card.appendChild(facts);
      official.appendChild(card);
    }
  } else {
    official.appendChild(createElement("strong", "session-location-official", session.room));
  }
  detail.appendChild(official);

  const guide = typeof TimetableLocations !== "undefined" ? TimetableLocations.lookup(session.room) : null;
  const guideBox = createElement("div", "session-location-practical");
  guideBox.appendChild(createElement("strong", "session-location-practical-title", guide ? "Getting there" : "Practical location tip"));
  guideBox.appendChild(createElement("p", "session-location-guide", guide?.guidance ||
    "Use the exact classroom name, floor and street number above. UniBo has several teaching buildings only a few minutes apart, so the room name and civic number are more reliable than the building area alone."));
  detail.appendChild(guideBox);

  const primaryAddress = guide?.address || classrooms.find(room => room.address)?.address || session.room;
  const actions = createElement("div", "session-location-actions");
  const map = createElement("a", "session-location-map",
    guide?.entrance ? "Open the recommended entrance in Maps ↗" : "Open the official address in Maps ↗");
  map.href = mapUrl(primaryAddress); map.target = "_blank"; map.rel = "noopener";
  actions.appendChild(map);
  if (guide?.sourceUrl) {
    const source = createElement("a", "session-location-source", `Official UniBo room reference · checked ${guide.checked} ↗`);
    source.href = guide.sourceUrl; source.target = "_blank"; source.rel = "noopener";
    actions.appendChild(source);
  }
  detail.appendChild(actions);
  return detail;
}

function showSessionDetails(session) {
  let dialog = document.getElementById("session-dialog");
  if (!dialog) {
    dialog = createElement("dialog", "session-dialog");
    dialog.id = "session-dialog";
    dialog.setAttribute("aria-labelledby", "session-detail-title");
    dialog.addEventListener("click", event => {
      const bounds = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
    });
    document.body.appendChild(dialog);
  }
  dialog.replaceChildren(iconButton("Close", "close", { iconOnly: true, className: "dialog-close", onClick: () => dialog.close() }));
  dialog.style.setProperty("--course-color", courseColorOf(session));
  dialog.appendChild(createElement("p", "section-eyebrow", "Official schedule · Class details"));
  const heading = createElement("h2", null, sessionLabel(session, timetable.index));
  heading.id = "session-detail-title";
  dialog.append(heading, createElement("p", "planning-detail-date", `${formatDay(session.dateKey)} · ${session.time}`));
  const grid = createElement("div", "session-detail-grid");
  grid.appendChild(sessionLocationDetail(session));
  for (const [label, value] of [["Teacher", session.teacher], ["Format", session.online ? "Online" : "On campus"], ["Notes", session.note]]) {
    if (!value) continue;
    const detail = createElement("div", "session-detail");
    detail.append(createElement("span", null, label), createElement("strong", null, value));
    grid.appendChild(detail);
  }
  dialog.append(grid, createElement("p", "schedule-meta", "Bologna time · Check UniBo for last-minute changes."), sessionActions(session, timetable.index));
  const course = timetable.index.modulesByCode[session.moduleCode]?.course;
  if (course) {
    const link = createElement("a", "tt-course-link", "Open course & study resources →");
    link.href = `course.html?course=${encodeURIComponent(course.id)}`;
    dialog.appendChild(link);
  }
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
      const weekLocation = session.online ? "Online" : session.room || "Room TBC";
      const roomLine = createElement("span", "week-room", weekLocation); roomLine.title = weekLocation;
      block.append(createElement("strong", null, sessionLabel(session, timetable.index)), createElement("span", null, session.time), roomLine);
      const teacher = teacherLine(session);
      if (teacher) block.insertBefore(teacher, block.querySelector(".week-room"));
      block.setAttribute("aria-label", `${sessionLabel(session, timetable.index)}, ${formatDay(day)}, ${session.time}${timetable.showTeacher && session.teacher ? ", " + session.teacher : ""}`);
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
  const hint = createElement("p", "tt-week-hint", "Swipe across the week, or switch to Day for a focused mobile view.");
  scheduleList.append(hint, scroller);
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
  document.getElementById("week-nav").hidden = timetable.view === "list";
  document.getElementById("week-picker-label").hidden = timetable.view === "list";
  document.getElementById("show-past-label").hidden = timetable.view !== "list";
  const filtered = filteredSessions();
  const sessions = timetable.view === "week" ? weekSessions() : timetable.view === "day"
    ? filtered.filter(session => session.dateKey === timetable.selectedDate) : timetable.view === "month"
    ? filtered.filter(session => session.dateKey.slice(0, 7) === timetable.selectedDate.slice(0, 7)) : listSessions(now);
  updateWeekControls();
  renderNowNext(now);
  renderSummary(sessions);
  if (timetable.view === "week") renderWeek(sessions, now);
  else if (timetable.view === "month") renderMonth(sessions, now);
  else if (timetable.view === "day") renderDay(sessions, now);
  else renderList(sessions, now);
  // Refresh the progress card immediately when switching views or filters.
  if (typeof renderTeachingProgress === "function") renderTeachingProgress(now, "ready");
  timetable.lastClock = now;
}

async function loadTimetable() {
  if (timetable.loading) return;
  timetable.loading = true;
  document.getElementById("timetable-refresh").disabled = true;
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
    const filterBeforeRefresh = courseFilter.value;
    timetable.sessions = await fetchTimetable(cohort.sources.timetableFeed);
    courseFilter.replaceChildren(new Option("All courses", ""));
    for (const course of currentTerm(timetable.programme).courses) {
      if (timetable.sessions.some(s => course.modules.some(m => m.code === s.moduleCode))) courseFilter.appendChild(new Option(course.name, course.id));
    }
    if ([...courseFilter.options].some(option => option.value === filterBeforeRefresh)) courseFilter.value = filterBeforeRefresh;
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
    document.getElementById("timetable-legend").replaceChildren();
  } finally {
    timetable.loading = false;
    document.getElementById("timetable-refresh").disabled = false;
    scheduleList.setAttribute("aria-busy", "false");
    document.querySelectorAll(".planning-toolbar input, .planning-toolbar select, .planning-toolbar button").forEach(control => { control.disabled = !timetable.ready; });
  }
}

document.querySelectorAll("#view-switch [data-view]").forEach(button => button.addEventListener("click", () => changeTimetableView(button.dataset.view)));
document.getElementById("week-prev").addEventListener("click", () => navigatePeriod(-1));
document.getElementById("week-next").addEventListener("click", () => navigatePeriod(1));
document.getElementById("week-today").addEventListener("click", () => { setSelectedDate(Planner.clock().slice(0, 10)); render(); });
document.getElementById("week-picker").addEventListener("change", event => { if (TimetableCalendar.validDate(event.target.value)) { setSelectedDate(event.target.value); render(); } });
teacherCheckbox.addEventListener("change", () => {
  timetable.showTeacher = teacherCheckbox.checked;
  writeStorage(TEACHER_KEY, timetable.showTeacher);
  render();
});
document.getElementById("timetable-refresh").addEventListener("click", loadTimetable);
document.getElementById("timetable-reset").addEventListener("click", resetTimetableFilters);
courseFilter.addEventListener("change", render);
showPastCheckbox.addEventListener("change", render);
classSearch.addEventListener("input", render);
function refreshTimetableClock() {
  if (!timetable.ready || document.hidden || document.getElementById("session-dialog")?.open) return;
  const now = Planner.clock(), previous = timetable.lastClock;
  const changed = now.slice(0, 10) !== previous.slice(0, 10) || (timetable.view !== "week" &&
    timetable.sessions.some(s => [s.start, s.end].some(time => time > previous && time <= now)));
  renderNowNext(now);
  updateCurrentLine(now);
  // Defer replacing agenda/calendar actions until keyboard focus leaves the schedule.
  if (changed && scheduleList.contains(document.activeElement)) return;
  if (changed) {
    if (now.slice(0, 10) !== previous.slice(0, 10) && timetable.selectedDate === previous.slice(0, 10)) setSelectedDate(now.slice(0, 10));
    render();
  }
  else timetable.lastClock = now;
}
setInterval(refreshTimetableClock, 60000);
document.addEventListener("visibilitychange", refreshTimetableClock);
document.addEventListener("focusout", () => setTimeout(refreshTimetableClock, 0));
loadTimetable();
