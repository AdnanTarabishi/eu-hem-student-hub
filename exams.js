// Exam planner: official first-year sittings, registration windows and calendar actions.
// All comparisons use Bologna time, even when the student is elsewhere.
const examList = document.getElementById("exam-list");
const examStatus = document.getElementById("exam-status");
const examCourseFilter = document.getElementById("exam-course-filter");
const examRegistrationFilter = document.getElementById("exam-registration-filter");
const examSearch = document.getElementById("exam-search");
const examReset = document.getElementById("exam-reset");
const ALMAESAMI_URL = "https://almaesami.unibo.it/almaesami/welcome.htm";

const examsPage = {
  programme: null, exams: [], loaded: false, loading: false, scopeSwitch: null,
  clockSignature: "", clockRefreshPending: false,
};

function visibleExams(now = Planner.clock()) {
  const today = now.slice(0, 10);
  const mine = myCoursesOnly(examsPage.programme) ? new Set(myModuleCodes(examsPage.programme)) : null;
  const courseId = examCourseFilter.value;
  const query = simplify(examSearch.value.trim());
  return examsPage.exams.filter((exam) => {
    if (!Planner.upcomingExam(exam, now)) return false;
    if (mine && !exam.codes.some((code) => mine.has(code))) return false;
    if (courseId && !exam.courseIds.includes(courseId)) return false;
    if (examRegistrationFilter.value && Planner.registration(exam, today).key !== examRegistrationFilter.value) return false;
    const searchText = [exam.title, exam.partOf, exam.place, ...exam.teachers].filter(Boolean).join(" ");
    return !query || simplify(searchText).includes(query);
  });
}

function resetExamFilters() {
  examCourseFilter.value = "";
  examRegistrationFilter.value = "";
  examSearch.value = "";
  render();
}

function registrationNote(registration) {
  if (registration.key === "open") return registration.days === 0
    ? "Last day to book. Check the closing time on AlmaEsami."
    : `Closes in ${registration.days} day${registration.days === 1 ? "" : "s"}. Book on AlmaEsami.`;
  if (registration.key === "soon") return `Opens in ${registration.days} day${registration.days === 1 ? "" : "s"}. You can save a reminder below.`;
  if (registration.key === "closed") return "The published registration window has ended.";
  return "A complete registration window is not listed. Check AlmaEsami for booking details.";
}

function coursePageLink(exam) {
  return `course.html?course=${encodeURIComponent(exam.courseIds[0])}&tab=exam`;
}

function examMeta(label, text, icon) {
  const item = createElement("li");
  item.appendChild(siteIcon(icon));
  const content = createElement("span");
  content.appendChild(createElement("span", "visually-hidden", `${label}: `));
  content.appendChild(document.createTextNode(text));
  item.appendChild(content);
  return item;
}

function examCard(exam, today) {
  const registration = Planner.registration(exam, today);
  const card = createElement("article", "exam-card");
  const course = currentTerm(examsPage.programme).courses.find((c) => exam.courseIds.includes(c.id));
  if (course && course.color) card.style.setProperty("--course-color", course.color);
  card.dataset.registration = registration.key;

  const block = createElement("time", "exam-date-block");
  block.dateTime = exam.dateKey;
  block.append(createElement("span", "exam-day", String(Number(exam.dateKey.slice(8)))),
    createElement("span", "exam-month", formatDay(exam.dateKey, { month: "short" })),
    createElement("span", "exam-weekday", formatDay(exam.dateKey, { weekday: "short" })));
  card.appendChild(block);

  const body = createElement("div", "exam-card-body");
  const head = createElement("div", "exam-card-head");
  const title = createElement("h4", "exam-title");
  const courseLink = createElement("a", null, exam.title);
  courseLink.href = coursePageLink(exam);
  title.appendChild(courseLink);
  head.append(title, createElement("span", "badge exam-countdown", countdownText(exam.dateKey, today)));
  body.appendChild(head);
  if (exam.partOf) body.appendChild(createElement("p", "exam-integrated schedule-meta", `Part of ${exam.partOf}`));

  const metadata = createElement("ul", "exam-meta");
  metadata.appendChild(examMeta("Time", exam.time ? `${exam.time} · Bologna time` : "Time not listed", "clock"));
  if (exam.type) metadata.appendChild(examMeta("Format", exam.type, "file"));
  metadata.appendChild(examMeta("Location", exam.place || "Room not listed", "map-pin"));
  if (exam.teachers.length) metadata.appendChild(examMeta("Teacher", exam.teachers.join(", "), "graduation"));
  body.appendChild(metadata);

  const window = createElement("div", `exam-registration is-${registration.key}${registration.key === "open" && registration.days <= 3 ? " is-urgent" : ""}`);
  window.append(createElement("strong", "reg-chip", registration.label),
    createElement("p", "exam-registration-note", registrationNote(registration)));
  const dates = createElement("div", "exam-registration-dates");
  const shortDate = { day: "numeric", month: "short", year: "numeric" };
  if (exam.registrationOpens) dates.appendChild(createElement("span", null, `Opens ${formatDay(exam.registrationOpens, shortDate)}`));
  if (exam.registrationCloses) dates.appendChild(createElement("span", null, `Closes ${formatDay(exam.registrationCloses, shortDate)}`));
  if (dates.childElementCount) window.appendChild(dates);
  body.appendChild(window);

  const actions = examActions(exam, today);
  if (registration.key === "open" || registration.key === "unknown") {
    const booking = iconButton(registration.key === "open" ? "Register on AlmaEsami" : "Check AlmaEsami", "external", {
      href: ALMAESAMI_URL,
      ariaLabel: `${registration.key === "open" ? "Register on AlmaEsami" : "Check AlmaEsami"}: ${exam.title}`,
      className: "exam-booking-link",
    });
    actions.prepend(booking);
  }
  body.appendChild(actions);
  card.appendChild(body);
  return card;
}

function renderExamHighlight(exams, today) {
  const aside = document.getElementById("exam-highlight");
  aside.replaceChildren(createElement("span", "planning-aside-eyebrow", "Your next milestone"));
  const exam = exams[0];
  if (!exam) {
    aside.append(createElement("strong", "planning-aside-title", "Space to plan ahead"),
      createElement("p", "planning-aside-note", "No upcoming sitting matches this selection. Adjust the filters or check the official dates."));
    return;
  }
  const date = createElement("strong", "planning-aside-title",
    formatDay(exam.dateKey, { day: "numeric", month: "long" }));
  const name = createElement("a", "planning-next-exam", exam.title);
  name.href = coursePageLink(exam);
  aside.append(date, name,
    createElement("p", "planning-next-meta", `${exam.time || "Time not listed"} · ${countdownText(exam.dateKey, today)}`),
    createElement("p", "planning-aside-note", Planner.registration(exam, today).label));
}

function renderOpenRegistrations(open, today) {
  const target = document.getElementById("open-registrations");
  target.replaceChildren();
  if (!open.length) return;
  const section = createElement("section", "deadline-panel");
  section.setAttribute("aria-labelledby", "deadline-title");
  const head = createElement("div", "deadline-head");
  const title = createElement("h2", null, "Registration is open");
  title.id = "deadline-title";
  head.append(title, createElement("p", null, "Take the next step. The nearest booking deadline comes first."));
  section.appendChild(head);
  const list = createElement("div", "deadline-list");
  for (const exam of open) {
    const days = daysBetween(today, exam.registrationCloses);
    const item = createElement("div", `deadline-item${days <= 3 ? " is-urgent" : ""}`);
    const details = createElement("div");
    details.appendChild(createElement("strong", null, exam.title));
    const closes = days === 0 ? "Closes today" : days === 1 ? "Closes tomorrow" : `Closes in ${days} days`;
    details.appendChild(createElement("p", null,
      `${closes} · ${formatDay(exam.registrationCloses, { day: "numeric", month: "short" })} · Exam ${formatDay(exam.dateKey, { day: "numeric", month: "short" })}`));
    const link = createElement("a", "deadline-register", "Register on AlmaEsami");
    link.href = ALMAESAMI_URL;
    link.target = "_blank";
    link.rel = "noopener";
    link.setAttribute("aria-label", `Register on AlmaEsami: ${exam.title}`);
    link.appendChild(siteIcon("external"));
    item.append(details, link);
    list.appendChild(item);
  }
  section.appendChild(list);
  target.appendChild(section);
}

function render() {
  if (!examsPage.loaded) return;
  const now = Planner.clock(), today = now.slice(0, 10);
  examsPage.clockSignature = examClockSignature(now);
  examsPage.clockRefreshPending = false;
  const exams = visibleExams(now);
  const mine = myCoursesOnly(examsPage.programme);
  const open = exams.filter((exam) => Planner.registration(exam, today).key === "open")
    .sort((a, b) => a.registrationCloses.localeCompare(b.registrationCloses) || a.dateKey.localeCompare(b.dateKey));
  const scope = mine ? "Your study plan" : "All first-year courses";
  document.getElementById("exam-scope").textContent = `${currentCohort(examsPage.programme).label} · ${scope}`;
  const deadline = open[0]?.registrationCloses;
  Planner.summary(document.getElementById("exam-summary"), [
    { label: "Upcoming sittings", value: exams.length, note: "Matching your selection" },
    { label: "Registration open", value: open.length, note: "Book on AlmaEsami" },
    { label: "Next deadline", value: deadline ? formatDay(deadline, { day: "numeric", month: "short" }) : "—",
      note: deadline ? (deadline === today ? "Closes today · check the time" : `${daysBetween(today, deadline)} days to register`) : "No open booking windows" },
  ]);
  renderExamHighlight(exams, today);
  renderOpenRegistrations(open, today);
  examReset.disabled = !examCourseFilter.value && !examRegistrationFilter.value && !examSearch.value;
  examStatus.textContent = `${exams.length} upcoming sitting${exams.length === 1 ? "" : "s"}${mine ? " for your courses" : ""}${examCourseFilter.value || examRegistrationFilter.value || examSearch.value ? " match these filters" : ""}.`;
  examList.replaceChildren();
  if (!exams.length) {
    const filtered = examCourseFilter.value || examRegistrationFilter.value || examSearch.value;
    Planner.empty(examList, {
      title: filtered ? "No exams match these filters" : "No upcoming sittings to show",
      text: filtered ? "Try another course, registration status or search. Your study-plan selection also applies." :
        mine ? "No future sitting is listed for your saved courses. Turn off My courses only to see all courses, or check UniBo." :
          "New dates may be published later. Check the official page for the latest sittings.",
      onReset: filtered ? resetExamFilters : null,
      source: currentCohort(examsPage.programme).sources.examDates,
    });
    return;
  }
  let month = "", section = null;
  for (const exam of exams) {
    const key = exam.dateKey.slice(0, 7);
    if (key !== month) {
      month = key;
      section = createElement("section", "exam-month-group");
      const heading = createElement("h3", "month-heading", formatDay(exam.dateKey, { month: "long", year: "numeric" }));
      heading.id = `exam-month-${key}`;
      section.setAttribute("aria-labelledby", heading.id);
      section.appendChild(heading);
      examList.appendChild(section);
    }
    section.appendChild(examCard(exam, today));
  }
}

async function loadExams() {
  if (examsPage.loading) return;
  examsPage.loading = true;
  examsPage.loaded = false;
  examList.replaceChildren(skeleton(3, "card"));
  examList.setAttribute("aria-busy", "true");
  examStatus.textContent = "Loading official exam dates…";
  document.getElementById("exam-checked").textContent = "Loading UniBo exam dates…";
  for (const control of [examCourseFilter, examRegistrationFilter, examSearch, examReset]) control.disabled = true;
  try {
    // Retry a rejected programme request as well as a failed exam feed.
    examsPage.programme = examsPage.programme || await loadProgramme();
    const cohort = currentCohort(examsPage.programme), term = currentTerm(examsPage.programme);
    document.getElementById("exams-source").href = cohort.sources.examDates;
    examsPage.exams = matchExamsToTerm(await fetchExams(cohort.sources.examDates), term);
    const selected = examCourseFilter.value;
    examCourseFilter.replaceChildren(new Option("All courses", ""));
    for (const course of term.courses) {
      if (examsPage.exams.some((exam) => exam.courseIds.includes(course.id))) examCourseFilter.appendChild(new Option(course.name, course.id));
    }
    if ([...examCourseFilter.options].some((option) => option.value === selected)) examCourseFilter.value = selected;
    if (!examsPage.scopeSwitch && loadPlan(examsPage.programme).saved) {
      examsPage.scopeSwitch = myCoursesSwitch(examsPage.programme, render);
      document.getElementById("exam-filters").appendChild(examsPage.scopeSwitch);
    }
    for (const control of [examCourseFilter, examRegistrationFilter, examSearch]) control.disabled = false;
    examsPage.loaded = true;
    Planner.checked(document.getElementById("exam-checked"));
    render();
  } catch (error) {
    console.warn("Could not load exams:", error);
    examStatus.textContent = "Exam dates could not be loaded.";
    document.getElementById("exam-checked").textContent = "Could not load UniBo exam dates.";
    document.getElementById("open-registrations").replaceChildren();
    const aside = document.getElementById("exam-highlight");
    aside.replaceChildren(createElement("span", "planning-aside-eyebrow", "Stay ready"),
      createElement("strong", "planning-aside-title", "Check official dates"),
      createElement("p", "planning-aside-note", "UniBo lists the sittings. AlmaEsami confirms your registration."));
    Planner.summary(document.getElementById("exam-summary"), [
      { label: "Upcoming sittings", value: "—", note: "Dates unavailable" },
      { label: "Registration open", value: "—", note: "Check AlmaEsami" },
      { label: "Next deadline", value: "—", note: "Check the official dates" },
    ]);
    Planner.empty(examList, {
      title: "The exam dates are unavailable",
      text: "Try loading the dates again, or open the official UniBo page.",
      retry: loadExams,
      source: document.getElementById("exams-source").href,
    });
  } finally {
    examsPage.loading = false;
    examList.setAttribute("aria-busy", "false");
  }
}

examCourseFilter.addEventListener("change", render);
examRegistrationFilter.addEventListener("change", render);
examSearch.addEventListener("input", render);
examReset.addEventListener("click", resetExamFilters);
loadExams();

// Refresh only when time changes the information shown. Keep a focused booking,
// map or calendar action intact; apply a pending update once focus moves away.
function examClockSignature(now) {
  const today = now.slice(0, 10);
  return JSON.stringify([today, examsPage.exams.map((exam, index) => {
    if (!Planner.upcomingExam(exam, now)) return null;
    const registration = Planner.registration(exam, today);
    return [index, registration.key, registration.days];
  })]);
}

function refreshExamClock() {
  if (!examsPage.loaded || examsPage.loading || document.hidden) return;
  if (examClockSignature(Planner.clock()) === examsPage.clockSignature) {
    examsPage.clockRefreshPending = false;
    return;
  }
  const active = document.activeElement;
  const protectedRegions = [examList, document.getElementById("open-registrations"), document.getElementById("exam-highlight")];
  if (protectedRegions.some((region) => region.contains(active))) {
    examsPage.clockRefreshPending = true;
    return;
  }
  render();
}

setInterval(refreshExamClock, 60 * 1000);
document.addEventListener("visibilitychange", refreshExamClock);
document.addEventListener("focusout", () => {
  if (examsPage.clockRefreshPending) setTimeout(refreshExamClock, 0);
});
