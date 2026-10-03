// ===== Exams page =====
// Loads upcoming exam dates live from the UniBo exam page (address in content/programme.json),
// keeps the 1st-year exams (matched by official code), and shows them by month as countdown cards.
// Registrations that are open right now are highlighted at the top.

const examList = document.getElementById("exam-list");
const examStatus = document.getElementById("exam-status");
const examCourseFilter = document.getElementById("exam-course-filter");

const examsPage = { programme: null, exams: [] };

function visibleExams() {
  const today = todayKey();
  const mine = myCoursesOnly(examsPage.programme) ? new Set(myModuleCodes(examsPage.programme)) : null;
  const courseId = examCourseFilter.value;
  return examsPage.exams.filter((exam) => {
    if (exam.dateKey < today) return false;
    if (mine && !exam.codes.some((code) => mine.has(code))) return false;
    if (courseId && !exam.courseIds.includes(courseId)) return false;
    return true;
  });
}

// One exam as a card with a big date block
function examCard(exam, today) {
  const card = createElement("article", "exam-card");
  const course = currentTerm(examsPage.programme).courses.find((c) => exam.courseIds.includes(c.id));
  if (course && course.color) card.style.setProperty("--course-color", course.color);
  const date = new Date(exam.dateKey + "T12:00:00");
  const block = createElement("div", "exam-date-block");
  block.appendChild(createElement("span", "exam-day", String(date.getDate())));
  block.appendChild(createElement("span", "exam-weekday", formatDay(exam.dateKey, { weekday: "short" })));
  card.appendChild(block);
  const body = createElement("div", "exam-card-body");
  const head = createElement("div", "exam-card-head");
  head.appendChild(createElement("h3", null, exam.title));
  head.appendChild(createElement("span", "badge", countdownText(exam.dateKey, today)));
  body.appendChild(head);
  if (exam.partOf) body.appendChild(createElement("p", "schedule-meta", `Part of ${exam.partOf}`));
  body.appendChild(createElement("p", "schedule-meta",
    [exam.time && `${exam.time}`, exam.type, exam.place, exam.teachers.join(", ")].filter(Boolean).join(" · ")));
  const registration = registrationText(exam, today);
  if (registration) {
    let text = registration.text;
    if (registration.open) {
      const left = daysBetween(today, exam.registrationCloses);
      text = left === 0 ? "Registration open · closes today" : `Registration open · closes in ${left} day${left === 1 ? "" : "s"}`;
    } else if (today < exam.registrationOpens) {
      const until = daysBetween(today, exam.registrationOpens);
      text = `Registration opens in ${until} day${until === 1 ? "" : "s"} (${formatDay(exam.registrationOpens, { day: "numeric", month: "short" })})`;
    }
    body.appendChild(createElement("span", registration.open ? "reg-chip is-open" : "reg-chip", text));
  }
  body.appendChild(examActions(exam));
  card.appendChild(body);
  return card;
}

function render() {
  const today = todayKey();
  const exams = visibleExams();
  const mine = myCoursesOnly(examsPage.programme);
  examList.innerHTML = "";

  // Registrations open right now
  const open = exams.filter((e) => e.registrationOpens && e.registrationOpens <= today && today <= e.registrationCloses);
  const openBox = document.getElementById("open-registrations");
  openBox.innerHTML = "";
  if (open.length) {
    const alert = createElement("section", "open-alert");
    alert.appendChild(siteIcon("bell"));
    const text = createElement("div");
    text.appendChild(createElement("strong", null, `Registration open now for ${open.length} exam${open.length === 1 ? "" : "s"}`));
    text.appendChild(createElement("p", null, open.map((e) => `${e.title} (closes ${formatDay(e.registrationCloses, { day: "numeric", month: "short" })})`).join(" · ")));
    alert.appendChild(text);
    const link = createElement("a", "button", "Register on AlmaEsami ↗");
    link.href = "https://almaesami.unibo.it/almaesami/welcome.htm";
    link.target = "_blank";
    link.rel = "noopener";
    alert.appendChild(link);
    openBox.appendChild(alert);
  }

  if (exams.length === 0) {
    examStatus.textContent = "No upcoming exams for this selection.";
    return;
  }
  examStatus.textContent = `${exams.length} upcoming ${mine ? "exams for your courses" : "1st-year exams"}.`;
  let month = "";
  for (const exam of exams) {
    const label = formatDay(exam.dateKey, { month: "long", year: "numeric" });
    if (label !== month) {
      month = label;
      examList.appendChild(createElement("h3", "month-heading", label));
    }
    examList.appendChild(examCard(exam, today));
  }
  examList.classList.remove("fade-in");
  void examList.offsetWidth;
  examList.classList.add("fade-in");
}

async function loadExams() {
  examList.appendChild(skeleton(3, "card"));
  try {
    examsPage.programme = await getProgramme();
    const cohort = currentCohort(examsPage.programme);
    const term = currentTerm(examsPage.programme);
    examsPage.exams = matchExamsToTerm(await fetchExams(cohort.sources.examDates), term);
    for (const course of term.courses) {
      if (examsPage.exams.some((exam) => exam.courseIds.includes(course.id))) examCourseFilter.appendChild(new Option(course.name, course.id));
    }
    if (loadPlan(examsPage.programme).saved) {
      document.querySelector(".toolbar-filters").appendChild(myCoursesSwitch(examsPage.programme, render));
    }
    render();
  } catch (error) {
    console.error("Could not load exams:", error);
    examList.innerHTML = "";
    examStatus.textContent = "Sorry, exam dates could not be loaded right now. Please use the official exam dates link above.";
  }
}

examCourseFilter.addEventListener("change", render);

loadExams();
