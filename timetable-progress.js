// A separate read-only monthly teaching-progress card. No storage or network requests.
// Update existing nodes so minute ticks never close the explanation or steal focus.
function renderMonthlyProgress(now, sourceState = "ready") {
  const root = document.getElementById("monthly-progress");
  const values = document.getElementById("monthly-progress-values");
  const status = document.getElementById("monthly-progress-status");
  const put = (id, text) => { const node = document.getElementById(id); if (node.textContent !== text) node.textContent = text; };
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
  const date = timetable.view === "list" ? now.slice(0, 10) : timetable.selectedDate;
  const monthName = formatDay(date, { month: "long", year: "numeric" });
  const result = TimetableCalendar.monthlyProgress(filteredSessions(), date, now);
  const scoped = [];
  if (myCoursesOnly(timetable.programme)) scoped.push("My courses only");
  if (courseFilter.value) scoped.push(courseFilter.selectedOptions[0].textContent);
  if (classSearch.value.trim()) scoped.push("Search applied");
  put("monthly-progress-scope", `${monthName} · ${scoped.join(" · ") || "All courses"}`);
  root.dataset.state = result.state;
  values.hidden = result.state !== "ready";
  if (result.state !== "ready") {
    put("monthly-progress-status", result.state === "empty"
      ? `No published hours for ${monthName} with these filters. There is no percentage to calculate; this does not confirm that the month is free of classes.`
      : "Progress unavailable — some class dates or durations could not be validated. Check the official timetable; no percentage has been assumed.");
    return;
  }
  const number = value => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
  put("monthly-progress-percent", `${result.percentage}%`);
  put("monthly-progress-month", monthName);
  put("monthly-progress-classes", `${result.completedClasses} of ${result.totalClasses} classes finished`);
  put("monthly-progress-finished", `${number(result.completedHours)} h`);
  put("monthly-progress-total", `${number(result.totalHours)} h`);
  put("monthly-progress-remaining", `${number(result.remainingHours)} h`);
  const bar = document.getElementById("monthly-progress-bar");
  bar.value = result.percentage;
  bar.setAttribute("aria-valuetext", `${result.percentage}% — ${number(result.completedHours)} of ${number(result.totalHours)} published teaching hours finished; ${number(result.remainingHours)} hours remaining.`);
  const active = result.activeClasses ? ` ${result.activeClasses} ${result.activeClasses === 1 ? "class is" : "classes are"} in progress and will count after ending.` : "";
  put("monthly-progress-status", `As of ${formatDay(now.slice(0, 10), { day: "numeric", month: "short" })}, ${now.slice(11, 16)} Bologna time. Scheduled time, not attendance.${active}`);
}

// The shared summary is rebuilt on every view/filter/date change. Observe only that
// boundary and loading state, not the calendar subtree; updates here cannot loop.
function refreshMonthlyProgress() {
  if (document.hidden) return;
  renderMonthlyProgress(Planner.clock(), timetable.ready ? "ready" : timetable.loading ? "loading" : "error");
}
const monthlyProgressObserver = new MutationObserver(refreshMonthlyProgress);
monthlyProgressObserver.observe(document.getElementById("timetable-summary"), { childList: true });
monthlyProgressObserver.observe(scheduleList, { attributes: true, attributeFilter: ["aria-busy"] });
setInterval(refreshMonthlyProgress, 60000);
document.addEventListener("visibilitychange", refreshMonthlyProgress);
refreshMonthlyProgress();
