// ===== Exams (home page) =====
// Loads upcoming exam dates live from the UniBo exam page (address in content/programme.json)
// and keeps the exams of 1st-year courses, matched by official course/module code.
// With a saved study plan, "My courses only" shows just your exams.

const examList = document.getElementById("exam-list");
const examStatus = document.getElementById("exam-status");
const examCourseFilter = document.getElementById("exam-course-filter");

const examsPage = { programme: null, exams: [] };

function renderExams() {
  const today = todayKey();
  const { programme } = examsPage;
  const mine = myCoursesOnly(programme) ? new Set(myModuleCodes(programme)) : null;
  const courseId = examCourseFilter.value;

  const visible = examsPage.exams.filter((exam) => {
    if (exam.dateKey < today) return false;
    if (mine && !exam.codes.some((code) => mine.has(code))) return false;
    if (courseId && !exam.courseIds.includes(courseId)) return false;
    return true;
  });

  examList.innerHTML = "";
  if (visible.length === 0) {
    examStatus.textContent = "No upcoming exams for this selection.";
    return;
  }
  examStatus.textContent = `Showing ${visible.length} upcoming ${mine ? "exams for your courses" : "1st-year exams"}.`;
  for (const exam of visible) examList.appendChild(examItem(exam, today));
}

async function loadExams() {
  try {
    examsPage.programme = await getProgramme();
    const cohort = currentCohort(examsPage.programme);
    const term = currentTerm(examsPage.programme);
    examsPage.exams = matchExamsToTerm(await fetchExams(cohort.sources.examDates), term);

    for (const course of term.courses) {
      if (examsPage.exams.some((exam) => exam.courseIds.includes(course.id))) {
        examCourseFilter.appendChild(new Option(course.name, course.id));
      }
    }
    if (loadPlan(examsPage.programme).saved) {
      document.querySelector("#exams .schedule-filters").appendChild(myCoursesSwitch(examsPage.programme, renderExams));
    }
    renderExams();
  } catch (error) {
    console.error("Could not load exams:", error);
    examStatus.textContent =
      "Sorry, exam dates could not be loaded right now. Please use the official exam dates link above.";
  }
}

examCourseFilter.addEventListener("change", renderExams);

loadExams();
