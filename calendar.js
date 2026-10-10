// Calendar workspace: source-backed periods, month exploration and existing subscriptions.
// Filters stay in memory. No university dates or subscription files are changed here.
const CALENDAR_LIST_URL = "calendar/calendars.json";
const KEY_DATE_KIND_LABELS = { classes: "Classes", exams: "Exams", deadline: "Deadline", event: "Event" };
const calendarStatus = document.getElementById("calendar-status");
const calendarLinks = document.getElementById("calendar-links");
const calendarToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const calendarState = { dates: [], sources: {}, kind: "", query: "", period: "all", day: "", month: calendarToday().slice(0, 7), ready: false, loading: false, today: calendarToday() };
let calendarProgrammePromise = null, calendarLinkLoading = false;
function calendarProgramme() {
  if (!calendarProgrammePromise) calendarProgrammePromise = loadProgramme().catch(error => { calendarProgrammePromise = null; throw error; });
  return calendarProgrammePromise;
}
async function setUpCalendarLinks() {
  if (calendarLinkLoading) return;
  calendarLinkLoading = true;
  const retry = document.getElementById("calendar-retry");
  retry.hidden = true; calendarStatus.textContent = "Loading calendar link…";
  try {
    const response = await fetch(CALENDAR_LIST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const calendars = await response.json(), programme = await calendarProgramme();
    const cohort = currentCohort(programme), term = currentTerm(programme), plan = loadPlan(programme);
    const complete = plan.saved && planSummary(term, plan.choices).complete;
    const key = complete ? planKey(term, plan.choices) : null;
    const mine = key && calendars.find(c => c.cohort === cohort.id && c.term === term.id && c.plan === key);
    const full = calendars.find(c => c.cohort === cohort.id && !c.plan), current = mine || full;
    if (!current || !/^[a-z0-9_-]+\.ics$/i.test(current.file)) throw new Error("No valid calendar listed for this cohort");
    const httpsUrl = new URL("calendar/" + current.file, window.location.href).href;
    const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:");
    const name = mine ? `EU-HEM my courses ${cohort.label}` : `EU-HEM 1st year ${cohort.label}`;
    document.getElementById("calendar-plan-note").textContent = mine
      ? "Only the courses in your saved study plan. Changed your choices? Add the new subscription and remove the old one."
      : complete ? "A matching course-specific calendar is not listed yet. This link includes every first-year course."
      : "Every first-year course is included. Save a complete study plan to get a calendar matched to your courses.";
    document.getElementById("calendar-google").href = "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcalUrl);
    document.getElementById("calendar-apple").href = webcalUrl;
    document.getElementById("calendar-outlook").href = "https://outlook.live.com/calendar/0/addfromweb?url=" + encodeURIComponent(httpsUrl) + "&name=" + encodeURIComponent(name);
    document.getElementById("calendar-url").value = httpsUrl;
    calendarStatus.textContent = `Calendar: ${name}`; calendarLinks.hidden = false;
  } catch {
    calendarLinks.hidden = true;
    calendarStatus.textContent = "The calendar link is unavailable. Key dates and setup instructions can still be used.";
    retry.hidden = false;
  } finally { calendarLinkLoading = false; }
}
document.getElementById("calendar-copy").addEventListener("click", async () => {
  const input = document.getElementById("calendar-url"), status = document.getElementById("calendar-copy-status");
  if (!input.value || calendarLinks.hidden) return;
  try {
    await navigator.clipboard.writeText(input.value);
    status.textContent = "Subscription link copied.";
    if (typeof markSetupDone === "function") markSetupDone("calendar");
  } catch {
    input.focus(); input.select(); input.setSelectionRange(0, input.value.length);
    status.textContent = "Automatic copying is unavailable. The link is selected; copy it using your device’s copy command.";
  }
});
for (const id of ["calendar-google", "calendar-apple", "calendar-outlook"]) document.getElementById(id).addEventListener("click", () => {
  if (!calendarLinks.hidden && typeof markSetupDone === "function") markSetupDone("calendar");
});
document.getElementById("calendar-retry").addEventListener("click", setUpCalendarLinks);
// Month-only ranges have real month bounds for filtering, but are never painted as exact appointments.
function approximateDate(item) { return !!item.approximate || item.start.length === 7 || item.end.length === 7; }
function dateBounds(item) {
  const start = item.start.length === 7 ? item.start + "-01" : item.start;
  let end = item.end;
  if (end.length === 7) { const date = new Date(end + "-01T12:00:00Z"); date.setUTCMonth(date.getUTCMonth() + 1, 0); end = date.toISOString().slice(0, 10); }
  return { start, end };
}
function selectedKeyDates(includeDay = true) {
  const today = calendarToday();
  return calendarState.dates.filter(item => {
    const { start, end } = dateBounds(item);
    return (!calendarState.kind || calendarState.kind === item.kind) &&
      (!calendarState.query || simplify([item.label, item.note, formatKeyDateRange(item)].filter(Boolean).join(" ")).includes(simplify(calendarState.query))) &&
      (calendarState.period === "all" || (calendarState.period === "past" ? end < today : end >= today)) &&
      (!includeDay || !calendarState.day || (!approximateDate(item) && start <= calendarState.day && end >= calendarState.day));
  });
}
function drawKeyDates() {
  if (!calendarState.ready) return;
  const list = document.getElementById("key-dates-list"), today = calendarToday(), visible = selectedKeyDates();
  list.replaceChildren();
  for (const item of visible) {
    const { start, end } = dateBounds(item), past = end < today, now = !past && start <= today;
    const li = createElement("li", `key-date is-${item.kind}${past ? " is-past" : now ? " is-now" : ""}`); li.id = `key-date-${item.id}`;
    const when = createElement("p", "key-date-when", (approximateDate(item) ? "About " : "") + formatKeyDateRange(item));
    const body = createElement("div", "key-date-body"), title = createElement("p", "key-date-title");
    title.append(createElement("span", "key-date-kind", KEY_DATE_KIND_LABELS[item.kind] || "Event"), document.createTextNode(item.label + (past ? " (past)" : now ? " (now)" : "")));
    body.appendChild(title);
    if (item.note) body.appendChild(createElement("p", "schedule-meta", item.note));
    body.appendChild(sourceLabel(item.source, calendarState.sources)); li.append(when, body); list.appendChild(li);
  }
  if (!visible.length) list.appendChild(createElement("li", "calendar-empty", calendarState.day ? "No exact-date period matches this day and your filters. Check the timetable or Exams page for individual appointments." : "No key dates match your filters. Try another type, period or search."));
  document.getElementById("key-date-status").textContent = `${visible.length} of ${calendarState.dates.length} key dates${calendarState.day ? ` · ${formatDay(calendarState.day, { day: "numeric", month: "short", year: "numeric" })}` : " · cohort overview"}`;
  document.getElementById("key-date-reset").hidden = !calendarState.kind && !calendarState.query && calendarState.period === "all" && !calendarState.day;
  for (const button of document.querySelectorAll("[data-date-kind]")) button.setAttribute("aria-pressed", String(button.dataset.dateKind === calendarState.kind));
}
function drawKeyMonth(focusDay = "") {
  if (!calendarState.ready) return;
  const month = calendarState.month, dates = selectedKeyDates(false), today = calendarToday();
  const title = formatDay(month + "-01", { month: "long", year: "numeric" }); document.getElementById("key-month-title").textContent = title;
  const table = createElement("table", "key-month-table"); table.appendChild(createElement("caption", "visually-hidden", title + " · programme periods"));
  const head = createElement("thead"), row = createElement("tr");
  for (const name of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) { const th = createElement("th", null, name); th.scope = "col"; row.appendChild(th); }
  head.appendChild(row); table.appendChild(head);
  const body = createElement("tbody"), days = TimetableCalendar.monthDays(month + "-01");
  const desired = focusDay || calendarState.day || (today.startsWith(month) ? today : month + "-01");
  const tabDay = days.some(d => d.date === desired) ? desired : month + "-01";
  for (let index = 0; index < days.length; index += 7) {
    const week = createElement("tr");
    for (const day of days.slice(index, index + 7)) {
      const matching = dates.filter(item => !approximateDate(item) && item.start <= day.date && item.end >= day.date);
      const types = [...new Set(matching.map(item => item.kind))];
      const td = createElement("td"), button = createElement("button", `key-month-day${day.inMonth ? "" : " is-outside"}${types.length ? " has-period" : ""}`, String(Number(day.date.slice(8))));
      button.type = "button"; button.dataset.date = day.date; button.tabIndex = day.date === tabDay ? 0 : -1;
      button.setAttribute("aria-label", `${formatDay(day.date, { day: "numeric", month: "long", year: "numeric" })}${day.date === today ? ", today" : ""}: ${matching.length ? matching.map(item => item.label).join("; ") : "no matching exact-date period"}`);
      button.setAttribute("aria-pressed", String(day.date === calendarState.day));
      if (day.date === today) button.setAttribute("aria-current", "date");
      const dots = createElement("span", "key-month-marks"); dots.setAttribute("aria-hidden", "true");
      for (const kind of types) dots.appendChild(createElement("i", `is-${kind}`)); button.appendChild(dots);
      button.addEventListener("click", () => { calendarState.day = day.date === calendarState.day ? "" : day.date; calendarState.month = day.date.slice(0, 7); drawKeyDates(); drawKeyMonth(day.date); });
      button.addEventListener("keydown", event => {
        let next; const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (Object.hasOwn(offsets, event.key)) next = TimetableCalendar.addDays(day.date, offsets[event.key]);
        else if (event.key === "Home") next = TimetableCalendar.monday(day.date);
        else if (event.key === "End") next = TimetableCalendar.addDays(TimetableCalendar.monday(day.date), 6);
        else if (["PageUp", "PageDown"].includes(event.key)) next = TimetableCalendar.shiftMonth(day.date, event.key === "PageUp" ? -1 : 1);
        if (!next || !TimetableCalendar.validDate(next)) return;
        event.preventDefault(); calendarState.month = next.slice(0, 7); drawKeyMonth(next);
      });
      td.appendChild(button); week.appendChild(td);
    }
    body.appendChild(week);
  }
  table.appendChild(body); document.getElementById("key-month-grid").replaceChildren(table);
  const approx = document.getElementById("key-month-approximate"); approx.replaceChildren();
  const windows = dates.filter(item => approximateDate(item) && item.start.slice(0, 7) <= month && item.end.slice(0, 7) >= month);
  if (windows.length) { approx.appendChild(createElement("strong", null, "Planning windows · exact days unconfirmed")); for (const item of windows) approx.appendChild(createElement("p", null, `${item.label} · About ${formatKeyDateRange(item)}`)); }
  if (focusDay) table.querySelector(`[data-date="${focusDay}"]`)?.focus({ preventScroll: true });
}
function drawCalendarHighlight() {
  const target = document.getElementById("calendar-highlight"), today = calendarToday();
  const next = calendarState.dates.find(item => item.kind === "exams" && dateBounds(item).end >= today); target.replaceChildren();
  const active = next && dateBounds(next).start <= today;
  target.appendChild(createElement("p", "calendar-eyebrow", next ? (active ? "Current exam period" : "Next exam period") : "Your year, connected"));
  const heading = createElement("h2", null, next ? formatKeyDateRange(next) : "Stay one step ahead."); heading.id = "calendar-highlight-title";
  target.append(heading, createElement("p", null, next ? next.label : "Open the official course website for newly announced dates."));
  if (next) target.appendChild(sourceLabel(next.source, calendarState.sources));
  const link = createElement("a", null, "Check individual exam dates →"); link.href = "exams.html"; target.appendChild(link);
}
async function showKeyDates() {
  if (calendarState.loading) return;
  calendarState.loading = true;
  const list = document.getElementById("key-dates-list"), retry = document.getElementById("key-date-retry"); list.setAttribute("aria-busy", "true"); retry.hidden = true;
  document.getElementById("key-date-status").textContent = "Loading key dates…";
  try {
    const [programme, sources] = await Promise.all([calendarProgramme(), loadSources()]);
    calendarState.dates = keyDates(currentCohort(programme)); calendarState.sources = sources; calendarState.ready = true;
    drawKeyDates(); drawKeyMonth(); drawCalendarHighlight();
  } catch {
    document.getElementById("key-date-status").textContent = "Key dates are unavailable. Retry or use the official course website."; retry.hidden = false;
    document.querySelector("#calendar-highlight p:last-child").textContent = "Check the official programme website while key dates are unavailable.";
  } finally { list.setAttribute("aria-busy", "false"); calendarState.loading = false; }
}
function clearDateFilters() {
  Object.assign(calendarState, { kind: "", query: "", period: "all", day: "" });
  document.getElementById("key-date-search").value = ""; document.getElementById("key-date-period").value = "all"; drawKeyDates(); drawKeyMonth();
}
for (const button of document.querySelectorAll("[data-date-kind]")) button.addEventListener("click", () => { calendarState.kind = button.dataset.dateKind; calendarState.day = ""; drawKeyDates(); drawKeyMonth(); });
document.getElementById("key-date-search").addEventListener("input", event => { calendarState.query = event.target.value.trim(); drawKeyDates(); drawKeyMonth(); });
document.getElementById("key-date-period").addEventListener("change", event => { calendarState.period = event.target.value; drawKeyDates(); drawKeyMonth(); });
document.getElementById("key-date-reset").addEventListener("click", () => { clearDateFilters(); document.getElementById("key-date-search").focus({ preventScroll: true }); });
document.getElementById("key-date-retry").addEventListener("click", showKeyDates);
for (const [id, step] of [["key-month-prev", -1], ["key-month-next", 1]]) document.getElementById(id).addEventListener("click", () => { calendarState.month = TimetableCalendar.shiftMonth(calendarState.month + "-01", step).slice(0, 7); calendarState.day = ""; drawKeyDates(); drawKeyMonth(); });
document.getElementById("key-month-today").addEventListener("click", () => { calendarState.month = calendarToday().slice(0, 7); calendarState.day = ""; drawKeyDates(); drawKeyMonth(); });
function refreshCalendarDay() {
  if (!calendarState.ready || document.hidden || calendarState.today === calendarToday() || document.querySelector(".calendar-workspace")?.contains(document.activeElement)) return;
  calendarState.today = calendarToday(); drawKeyDates(); drawKeyMonth(); drawCalendarHighlight();
}
setInterval(refreshCalendarDay, 60000); document.addEventListener("visibilitychange", refreshCalendarDay); document.addEventListener("focusout", () => setTimeout(refreshCalendarDay, 0));
let printFilters = null;
window.addEventListener("beforeprint", () => { printFilters = { kind: calendarState.kind, query: calendarState.query, period: calendarState.period, day: calendarState.day }; Object.assign(calendarState, { kind: "", query: "", period: "all", day: "" }); drawKeyDates(); });
window.addEventListener("afterprint", () => { if (printFilters) { Object.assign(calendarState, printFilters); printFilters = null; drawKeyDates(); } });
setUpCalendarLinks(); showKeyDates();
