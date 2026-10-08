// ===== Home dashboard =====
// "Today" (classes now/next), "Next exam", "My plan" and the latest announcements.
// Uses your saved study plan if you have one (only your courses), otherwise all 1st-year courses.
// Old links to sections of the home page (#schedule, #exams, ...) go to their new pages.

const OLD_SECTIONS = { "#schedule": "timetable.html", "#exams": "exams.html", "#calendar": "calendar.html", "#resources": "notes.html" };
if (typeof window !== "undefined" && OLD_SECTIONS[window.location.hash]) window.location.replace(OLD_SECTIONS[window.location.hash]);

const dash = {
  programme: null, index: null, mine: null,
  sessions: null, selectedDay: null, dayBounds: null, nextClassDay: false,
  exams: null, examIndex: 0, dayControls: null, examControls: null,
};

// ----- Pure helpers (tested) -----

// What the Today card shows:
//   { mode: "today", sessions }              classes today
//   { mode: "next-day", sessions, dateKey }  no classes today: the next day with classes
//   { mode: "none" }                         no more classes this semester
function todayPlan(sessions, today) {
  const todays = sessions.filter((s) => s.dateKey === today);
  if (todays.length) return { mode: "today", sessions: todays };
  const future = sessions.filter((s) => s.dateKey > today);
  if (!future.length) return { mode: "none" };
  const dateKey = future[0].dateKey;
  return { mode: "next-day", dateKey, sessions: future.filter((s) => s.dateKey === dateKey) };
}

// "Exam period: 26 Oct – 7 Nov 2026" (or "Exam period now: …") from the cohort's key dates; null if none is left
function examPeriodText(cohort, today) {
  const period = nextKeyDate(cohort, "exams", today);
  if (!period) return null;
  return `${period.start <= today ? "Exam period now" : "Next exam period"}: ${formatKeyDateRange(period)}`;
}

function greeting(hour) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Use a calendar day in UTC so crossing a daylight-saving change still moves exactly one day.
function shiftDashboardDay(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

// Keep separate sittings, including ones on the same day, in chronological order.
function upcomingDashboardExams(exams, today) {
  // UniBo accepts both "9:00" and "09:00". Compare minutes, not the raw text;
  // an unpublished time stays before timed sittings, as it did previously.
  const minutes = (time) => {
    if (!time) return -1;
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
  };
  return exams.filter((exam) => exam.dateKey >= today)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || minutes(a.time) - minutes(b.time));
}

// These controls stay in the heading while only the card content is refreshed.
// Keeping the same buttons means keyboard focus stays in place after each arrow press.
function dashboardBrowseControls(id, unit, onPrevious, onNext) {
  const nav = document.getElementById(id);
  if (!nav) return null;
  nav.hidden = false;
  nav.setAttribute("role", "group");
  nav.setAttribute("aria-label", unit === "day" ? "Browse class days" : "Browse upcoming exams");
  const previous = iconButton(`Previous ${unit}`, "chevron-left", {
    iconOnly: true, className: "dash-browse-button dash-browse-prev", onClick: onPrevious,
  });
  const next = iconButton(`Next ${unit}`, "chevron-right", {
    iconOnly: true, className: "dash-browse-button dash-browse-next", onClick: onNext,
  });
  const status = createElement("span", "dash-browse-status visually-hidden");
  status.setAttribute("role", "status");
  status.setAttribute("aria-atomic", "true");
  previous.disabled = next.disabled = true;
  previous.setAttribute("aria-controls", unit === "day" ? "dash-today" : "dash-exam");
  next.setAttribute("aria-controls", unit === "day" ? "dash-today" : "dash-exam");
  nav.append(previous, next, status);
  return { previous, next, status };
}

// Disabling a focused button blurs it in Chrome. Keep keyboard users in the
// navigation by focusing the available opposite arrow when a boundary is reached.
function updateDashboardBrowseBounds(controls, previousDisabled, nextDisabled) {
  const focused = document.activeElement;
  controls.previous.disabled = previousDisabled;
  controls.next.disabled = nextDisabled;
  if (focused === controls.previous && previousDisabled && !nextDisabled) controls.next.focus();
  if (focused === controls.next && nextDisabled && !previousDisabled) controls.previous.focus();
}

function browseDashboardDay(amount) {
  if (!dash.sessions?.length) return;
  const selectedDay = shiftDashboardDay(dash.selectedDay, amount);
  if (selectedDay < dash.dayBounds.first || selectedDay > dash.dayBounds.last) return;
  dash.selectedDay = selectedDay;
  dash.nextClassDay = false;
  renderToday(undefined, true);
}

function browseDashboardExam(amount) {
  const nextIndex = dash.examIndex + amount;
  if (!dash.exams || nextIndex < 0 || nextIndex >= dash.exams.length) return;
  dash.examIndex = nextIndex;
  renderExam(undefined, true);
}

// ----- Cards -----

function classRow(session, state) {
  const row = createElement("div", `dash-class${state ? " is-" + state : ""}`);
  const found = dash.index.modulesByCode[session.moduleCode];
  row.style.setProperty("--course-color", (found && found.course.color) || "var(--color-primary)");
  row.appendChild(createElement("span", "dash-class-time", session.time.split(" - ")[0]));
  const text = createElement("div", "dash-class-text");
  const title = createElement("strong", null, sessionLabel(session, dash.index));
  if (state === "now") title.appendChild(createElement("span", "live-dot", "Now"));
  text.appendChild(title);
  text.appendChild(createElement("span", "schedule-meta", [session.time, session.room && session.room.split(",")[0]].filter(Boolean).join(" · ")));
  row.appendChild(text);
  if (session.room) row.appendChild(iconButton("Map", "map-pin", { href: mapUrl(session.room), iconOnly: true, ariaLabel: `Map: ${session.room}` }));
  return row;
}

function renderToday(sessions, announce = false) {
  const box = document.getElementById("dash-today");
  const today = todayKey();
  if (sessions !== undefined) {
    dash.sessions = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
    const initial = todayPlan(dash.sessions, today);
    dash.selectedDay = initial.dateKey || today;
    dash.nextClassDay = initial.mode === "next-day";
    const dates = [today, ...dash.sessions.map((session) => session.dateKey)].sort();
    dash.dayBounds = { first: dates[0], last: dates[dates.length - 1] };
  }
  let content = box.querySelector(".dash-day-content");
  if (!content) {
    const meta = createElement("div", "dash-browse-meta");
    const date = createElement("time", "dash-browse-date");
    const reset = createElement("button", "dash-back-today", "Return to today");
    reset.type = "button";
    reset.addEventListener("click", () => {
      dash.selectedDay = todayKey();
      dash.nextClassDay = false;
      renderToday(undefined, true);
      // The reset action is now hidden; put focus on an available, persistent arrow.
      if (dash.dayControls) (dash.dayControls.next.disabled ? dash.dayControls.previous : dash.dayControls.next).focus();
    });
    meta.append(date, reset);
    content = createElement("div", "dash-day-content");
    box.replaceChildren(meta, content);
  }
  const selected = dash.sessions.filter((session) => session.dateKey === dash.selectedDay);
  const isToday = dash.selectedDay === today;
  const dateLabel = formatDay(dash.selectedDay);
  const date = box.querySelector(".dash-browse-date");
  date.textContent = `${isToday ? "Today · " : ""}${dateLabel}`;
  date.dateTime = dash.selectedDay;
  box.querySelector(".dash-back-today").hidden = isToday;
  box.classList.toggle("is-browsing", !isToday);
  const title = document.querySelector("#dash-today-title .dash-card-title");
  if (title) title.textContent = isToday ? "Today" : "Classes";
  if (dash.dayControls) {
    updateDashboardBrowseBounds(dash.dayControls,
      !dash.sessions.length || dash.selectedDay <= dash.dayBounds.first,
      !dash.sessions.length || dash.selectedDay >= dash.dayBounds.last);
    if (announce) dash.dayControls.status.textContent = `${dateLabel}. ${selected.length ? `${selected.length} class${selected.length === 1 ? "" : "es"}.` : "No classes scheduled."}`;
  }
  content.replaceChildren();
  if (!selected.length) {
    const noMore = isToday && !dash.sessions.some((session) => session.dateKey > today);
    content.appendChild(createElement("p", "dash-empty", noMore ? "No more classes this semester. 🎉" : "No classes scheduled for this day."));
    return;
  }
  if (dash.nextClassDay) content.appendChild(createElement("p", "dash-empty", "No classes today. Your next day with classes is shown above."));
  const nowIso = localIso(new Date());
  const { now, next } = nowAndNext(dash.sessions, nowIso);
  for (const session of selected.slice(0, 4)) {
    const state = isToday && session === now ? "now" : isToday && session === next ? "next" : isToday && session.end < nowIso ? "done" : "";
    content.appendChild(classRow(session, state));
  }
  if (selected.length > 4) content.appendChild(createElement("p", "schedule-meta", `+ ${selected.length - 4} more`));
}

function renderExam(exams, announce = false) {
  const box = document.getElementById("dash-exam");
  const today = todayKey();
  if (exams !== undefined) {
    dash.exams = upcomingDashboardExams(exams, today);
    dash.examIndex = 0;
  }
  let content = box.querySelector(".dash-exam-content");
  if (!content) {
    const position = createElement("p", "dash-browse-position");
    content = createElement("div", "dash-exam-content");
    // Keep the programme's exam-period link outside the part that changes when browsing.
    const period = box.querySelector(".dash-period");
    box.replaceChildren(...(period ? [period] : []), position, content);
  }
  const position = box.querySelector(".dash-browse-position");
  position.textContent = dash.exams.length ? `Exam ${dash.examIndex + 1} of ${dash.exams.length}` : "";
  position.hidden = !dash.exams.length;
  const title = document.querySelector("#dash-exam-title .dash-card-title");
  if (title) title.textContent = dash.examIndex === 0 ? "Next exam" : "Upcoming exam";
  if (dash.examControls) {
    updateDashboardBrowseBounds(dash.examControls,
      !dash.exams.length || dash.examIndex === 0,
      !dash.exams.length || dash.examIndex === dash.exams.length - 1);
  }
  content.replaceChildren();
  if (!dash.exams.length) {
    content.appendChild(createElement("p", "dash-empty", "No upcoming exam dates published."));
    return;
  }
  const exam = dash.exams[dash.examIndex];
  if (announce && dash.examControls) dash.examControls.status.textContent = `${position.textContent}: ${exam.title}, ${formatDay(exam.dateKey)}${exam.time ? ` at ${exam.time}` : ""}.`;
  const big = createElement("div", "dash-countdown");
  const days = daysBetween(today, exam.dateKey);
  big.appendChild(createElement("span", "dash-countdown-number", days === 0 ? "Today" : String(days)));
  if (days > 0) big.appendChild(createElement("span", "dash-countdown-label", days === 1 ? "day to go" : "days to go"));
  content.appendChild(big);
  content.appendChild(createElement("strong", "dash-exam-title", exam.title));
  content.appendChild(createElement("p", "schedule-meta",
    `${formatDay(exam.dateKey, { weekday: "short", day: "numeric", month: "short" })}${exam.time ? ", " + exam.time : ""} · ${exam.type || ""}`));
  const registration = registrationText(exam, today);
  if (registration) content.appendChild(createElement("span", registration.open ? "reg-chip is-open" : "reg-chip", registration.text));
}

// The plan on this site is only for you. The official one is filled in on Studenti Online (programme.json)
function officialPlanReminder() {
  const official = currentCohort(dash.programme).studyPlanSubmission;
  const note = createElement("p", "dash-reminder", "Reminder: the official study plan is on ");
  const link = createElement("a", null, "Studenti Online");
  link.href = official.url;
  link.target = "_blank";
  link.rel = "noopener";
  note.append(link, `. ${official.deadlineNote}`);
  return note;
}

async function renderPlan() {
  const box = document.getElementById("dash-plan");
  box.innerHTML = "";
  const plan = loadPlan(dash.programme);
  const term = currentTerm(dash.programme);
  if (!plan.saved) {
    box.appendChild(createElement("p", "dash-empty", "Choose your courses to personalise the timetable, exams and calendar."));
    const link = createElement("a", "button", "Plan my semester");
    link.href = "studyplan.html";
    box.appendChild(link);
    box.appendChild(officialPlanReminder());
    return;
  }
  const summary = planSummary(term, plan.choices);
  const percent = Math.round((summary.requiredCfu / summary.requiredTotal) * 100);
  box.appendChild(progressBar(percent, `${summary.requiredCfu} of ${summary.requiredTotal} required CFU`));
  box.appendChild(createElement("p", "dash-plan-cfu",
    `${summary.requiredCfu} / ${summary.requiredTotal} CFU${summary.optionalCfu ? ` + ${summary.optionalCfu} optional` : ""}${summary.complete ? " · ✓ complete" : ""}`));
  const codes = selectedCourseCodes(term, plan.choices);
  const counts = { studying: 0, booked: 0, passed: 0 };
  for (const code of codes) if (counts[plan.statuses[code]] !== undefined) counts[plan.statuses[code]]++;
  const stats = createElement("div", "dash-stats");
  for (const [label, value] of [["Studying", counts.studying], ["Exam booked", counts.booked], ["Passed", counts.passed]]) {
    const stat = createElement("div", "dash-stat");
    stat.appendChild(createElement("strong", null, String(value)));
    stat.appendChild(createElement("span", null, label));
    stats.appendChild(stat);
  }
  box.appendChild(stats);
  box.appendChild(officialPlanReminder());

  // Flashcards due in my courses (spaced repetition, from Notes & Resources)
  try {
    const data = await loadAll();
    const cards = data.courses.filter((c) => codes.includes(c.code)).flatMap((c) => c.flashcards);
    const due = dueCards(loadProgress(), cards, todayKey()).length;
    if (cards.length) {
      const link = createElement("a", "dash-due", `${due} flashcard${due === 1 ? "" : "s"} due today →`);
      link.href = "notes.html";
      box.appendChild(link);
    }
  } catch (error) {
    console.error("Flashcards:", error);
  }
}

// ----- Start -----

// A request that takes longer than this counts as failed, so a card never shows "loading" forever
const DASH_TIMEOUT_MS = 20000;

function withTimeout(promise, ms = DASH_TIMEOUT_MS) {
  return Promise.race([promise, new Promise((resolve, reject) => setTimeout(() => reject(new Error("Timed out")), ms))]);
}

// Any card still showing grey loading shapes gets an error message instead
function failRemainingCards(message) {
  for (const id of ["dash-today", "dash-exam", "dash-plan"]) {
    const box = document.getElementById(id);
    if (box && box.querySelector(".skeleton-group")) box.replaceChildren(createElement("p", "dash-empty", message));
  }
}

async function initDashboard() {
  const now = new Date();
  document.getElementById("dash-date").textContent = formatDay(todayKey(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  document.getElementById("dash-greeting").textContent = greeting(now.getHours());
  for (const id of ["dash-today", "dash-exam", "dash-plan"]) document.getElementById(id).appendChild(skeleton(3));
  dash.dayControls = dashboardBrowseControls("dash-day-nav", "day", () => browseDashboardDay(-1), () => browseDashboardDay(1));
  dash.examControls = dashboardBrowseControls("dash-exam-nav", "exam", () => browseDashboardExam(-1), () => browseDashboardExam(1));

  try {
    dash.programme = await withTimeout(getProgramme());
    dash.index = programmeIndex(dash.programme);
    dash.mine = myModuleCodes(dash.programme); // null without a saved plan
    renderPlan();
    const cohort = currentCohort(dash.programme);
    const term = currentTerm(dash.programme);
    const isMine = (codes) => !dash.mine || codes.some((c) => dash.mine.includes(c));
    const [sessions, exams] = await Promise.allSettled([withTimeout(fetchTimetable(cohort.sources.timetableFeed)), withTimeout(fetchExams(cohort.sources.examDates))]);
    if (sessions.status === "fulfilled") renderToday(sessions.value.filter((s) => isMine([s.moduleCode])));
    else document.getElementById("dash-today").replaceChildren(createElement("p", "dash-empty", "The timetable couldn't be loaded from UniBo right now."));
    if (exams.status === "fulfilled") renderExam(matchExamsToTerm(exams.value, term).filter((e) => isMine(e.codes)));
    else document.getElementById("dash-exam").replaceChildren(createElement("p", "dash-empty", "Exam dates couldn't be loaded from UniBo right now."));
    // From programme.json, so it shows even when UniBo can't be reached
    const period = examPeriodText(cohort, todayKey());
    if (period) {
      const link = createElement("a", "dash-period", period);
      link.href = "calendar.html#key-dates";
      document.getElementById("dash-exam").prepend(link);
    }
    if (dash.mine) {
      for (const id of ["dash-today-title", "dash-exam-title"]) {
        document.getElementById(id).appendChild(createElement("span", "dash-mine", "my courses"));
      }
    }
  } catch (error) {
    console.error("Dashboard:", error);
    failRemainingCards("This couldn't be loaded right now. Please try again later.");
  }
}

if (typeof document !== "undefined" && document.getElementById("dash-today")) initDashboard();

if (typeof module !== "undefined") module.exports = { todayPlan, greeting, examPeriodText, shiftDashboardDay, upcomingDashboardExams };
