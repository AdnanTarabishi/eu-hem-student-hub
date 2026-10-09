// A read-only teaching-progress card for the selected period. No storage or requests.
// Update existing nodes so minute ticks never close the explanation or steal focus.
function teachingPeriodLabel(period) {
  if (!period) return "Selected period";
  if (period.view === "month") return formatDay(period.start, { month: "long", year: "numeric" });
  if (period.view === "day") return formatDay(period.start, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const first = { day: "numeric", month: "short" };
  if (period.start.slice(0, 4) !== period.end.slice(0, 4)) first.year = "numeric";
  return `${formatDay(period.start, first)} – ${formatDay(period.end, { day: "numeric", month: "short", year: "numeric" })}`;
}

function renderTeachingProgress(now, sourceState = "ready") {
  const root = document.getElementById("monthly-progress");
  const values = document.getElementById("monthly-progress-values");
  const status = document.getElementById("monthly-progress-status");
  const put = (id, text) => { const node = document.getElementById(id); if (node.textContent !== text) node.textContent = text; };
  const view = timetable.view === "list" ? "month" : timetable.view;
  const date = timetable.view === "list" ? now.slice(0, 10) : timetable.selectedDate;
  const period = TimetableCalendar.progressPeriod(date, view);
  const name = { day: "Daily", week: "Weekly", month: "Monthly" }[view];
  const periodName = teachingPeriodLabel(period);
  put("monthly-progress-title", `${name} teaching progress`);
  put("monthly-progress-eyebrow", `One ${view} at a time`);
  root.dataset.period = view;
  root.setAttribute("aria-busy", String(sourceState === "loading"));
  if (sourceState !== "ready") {
    values.hidden = true;
    root.dataset.state = sourceState;
    put("monthly-progress-scope", "Bologna time · Europe/Rome");
    const text = sourceState === "loading" ? "Waiting for the official timetable. Progress is not available yet."
      : "Progress unavailable — the official timetable could not be loaded. Use Retry or Refresh; no percentage has been assumed.";
    if (status.textContent !== text) status.textContent = text;
    return;
  }
  const result = TimetableCalendar.periodProgress(filteredSessions(), date, now, view);
  const scoped = [];
  if (myCoursesOnly(timetable.programme)) scoped.push("My courses only");
  if (courseFilter.value) scoped.push(courseFilter.selectedOptions[0].textContent);
  if (classSearch.value.trim()) scoped.push("Search applied");
  put("monthly-progress-scope", `${periodName} · ${scoped.join(" · ") || "All courses"}${timetable.view === "list" ? " · Current month in List" : ""}`);
  root.dataset.state = result.state;
  values.hidden = result.state !== "ready";
  if (result.state !== "ready") {
    put("monthly-progress-status", result.state === "empty"
      ? `No published hours for ${periodName} with these filters. There is no percentage to calculate; this does not confirm that this ${view} is free of classes.`
      : "Progress unavailable — some class dates or durations could not be validated. Check the official timetable; no percentage has been assumed.");
    return;
  }
  const number = value => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
  put("monthly-progress-percent", `${result.percentage}%`);
  put("monthly-progress-month", periodName);
  put("monthly-progress-classes", `${result.completedClasses} of ${result.totalClasses} classes finished`);
  put("monthly-progress-finished", `${number(result.completedHours)} h`);
  put("monthly-progress-total", `${number(result.totalHours)} h`);
  put("monthly-progress-remaining", `${number(result.remainingHours)} h`);
  const bar = document.getElementById("monthly-progress-bar");
  bar.value = result.percentage;
  bar.setAttribute("aria-valuetext", `${result.percentage}% — ${number(result.completedHours)} of ${number(result.totalHours)} published teaching hours finished; ${number(result.remainingHours)} hours remaining.`);
  const active = result.activeClasses ? ` ${result.activeClasses} ${result.activeClasses === 1 ? "class is" : "classes are"} in progress.` : "";
  put("monthly-progress-status", `As of ${formatDay(now.slice(0, 10), { day: "numeric", month: "short" })}, ${now.slice(11, 16)} Bologna time. Scheduled hours, not attendance.${active}`);
}

// The shared summary is rebuilt on every view/filter/date change. Observe only that
// boundary and loading state, not the calendar subtree; updates here cannot loop.
function refreshTeachingProgress() {
  if (document.hidden) return;
  renderTeachingProgress(Planner.clock(), timetable.ready ? "ready" : timetable.loading ? "loading" : "error");
}
const teachingProgressObserver = new MutationObserver(refreshTeachingProgress);
teachingProgressObserver.observe(document.getElementById("timetable-summary"), { childList: true });
teachingProgressObserver.observe(scheduleList, { attributes: true, attributeFilter: ["aria-busy"] });
setInterval(refreshTeachingProgress, 60000);
document.addEventListener("visibilitychange", refreshTeachingProgress);
refreshTeachingProgress();
