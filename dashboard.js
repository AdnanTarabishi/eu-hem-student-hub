// ===== Home dashboard =====
// "Today" (classes now/next), "Next exam", "My plan" and the latest announcements.
// Uses your saved study plan if you have one (only your courses), otherwise all 1st-year courses.
// Old links to sections of the home page (#schedule, #exams, ...) go to their new pages.

const OLD_SECTIONS = { "#schedule": "timetable.html", "#exams": "exams.html", "#calendar": "calendar.html", "#resources": "notes.html" };
if (typeof window !== "undefined" && OLD_SECTIONS[window.location.hash]) window.location.replace(OLD_SECTIONS[window.location.hash]);

const dash = { programme: null, index: null, mine: null };

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

function greeting(hour) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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

function renderToday(sessions) {
  const box = document.getElementById("dash-today");
  box.innerHTML = "";
  const today = todayKey();
  const plan = todayPlan(sessions, today);
  if (plan.mode === "none") {
    box.appendChild(createElement("p", "dash-empty", "No more classes this semester. 🎉"));
    return;
  }
  const { now, next } = nowAndNext(sessions, localIso(new Date()));
  if (plan.mode === "next-day") {
    box.appendChild(createElement("p", "dash-empty",
      `No classes today. Next: ${formatDay(plan.dateKey, { weekday: "long", day: "numeric", month: "long" })}`));
  }
  for (const session of plan.sessions.slice(0, 4)) {
    const state = now && session === now ? "now" : next && session === next ? "next" : session.end < localIso(new Date()) && plan.mode === "today" ? "done" : "";
    box.appendChild(classRow(session, state));
  }
  if (plan.sessions.length > 4) box.appendChild(createElement("p", "schedule-meta", `+ ${plan.sessions.length - 4} more`));
}

function renderExam(exams) {
  const box = document.getElementById("dash-exam");
  box.innerHTML = "";
  const today = todayKey();
  const upcoming = exams.filter((e) => e.dateKey >= today);
  if (!upcoming.length) {
    box.appendChild(createElement("p", "dash-empty", "No upcoming exam dates published."));
    return;
  }
  const exam = upcoming[0];
  const big = createElement("div", "dash-countdown");
  const days = daysBetween(today, exam.dateKey);
  big.appendChild(createElement("span", "dash-countdown-number", days === 0 ? "Today" : String(days)));
  if (days > 0) big.appendChild(createElement("span", "dash-countdown-label", days === 1 ? "day to go" : "days to go"));
  box.appendChild(big);
  box.appendChild(createElement("strong", "dash-exam-title", exam.title));
  box.appendChild(createElement("p", "schedule-meta",
    `${formatDay(exam.dateKey, { weekday: "short", day: "numeric", month: "short" })}${exam.time ? ", " + exam.time : ""} · ${exam.type || ""}`));
  const registration = registrationText(exam, today);
  if (registration) box.appendChild(createElement("span", registration.open ? "reg-chip is-open" : "reg-chip", registration.text));
  if (upcoming.length > 1) box.appendChild(createElement("p", "schedule-meta", `+ ${upcoming.length - 1} more upcoming`));
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
  document.getElementById("dash-greeting").textContent = `${greeting(now.getHours())} 👋`;
  for (const id of ["dash-today", "dash-exam", "dash-plan"]) document.getElementById(id).appendChild(skeleton(3));

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

if (typeof module !== "undefined") module.exports = { todayPlan, greeting };
