/* Pure helpers for the Exams workspace. Source data is not mutated. No remote
   storage, personal results or attempt numbers are inferred from published dates. */
const ExamWorkspace = (() => {
  const sort = (a, b) => (a.dateKey + (a.time || "")).localeCompare(b.dateKey + (b.time || ""));
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + "T12:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function events(exams, term) {
    const result = exams.map(exam => ({ ...exam, origin: "unibo", administrative: false }));
    for (const course of term.courses) {
      const notice = course.assessmentNotice;
      if (notice?.kind !== "administrative-pass-fail" || !validDate(notice.sessionDate) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(notice.sessionTime || "")) continue;
      const matches = result.filter(exam => exam.courseIds.includes(course.id));
      for (const exam of matches) {
        exam.administrative = true;
        exam.notice = notice;
        // A live source's date/time remain intact, even when an email is different.
        exam.noticeTimeDiffers = exam.dateKey === notice.sessionDate && exam.time !== notice.sessionTime;
      }
      if (!matches.some(exam => exam.dateKey === notice.sessionDate)) {
        result.push({ codes: [course.code], moduleCodes: course.modules.map(m => m.code),
          names: [course.name], title: course.name, courseIds: [course.id], partOf: "",
          dateKey: notice.sessionDate, time: notice.sessionTime,
          teachers: [], type: "Pass/Fail recording", place: "",
          registrationOpens: "", registrationCloses: "", origin: "lecturer",
          administrative: true, notice });
      }
    }
    return result.sort(sort);
  }
  function groups(exams) {
    const result = new Map();
    for (const exam of [...exams].sort(sort)) {
      const id = exam.courseIds[0];
      if (!id) continue;
      if (!result.has(id)) result.set(id, { courseId: id, modules: new Map(), exams: [] });
      const group = result.get(id);
      const codes = [...new Set(exam.moduleCodes || [])].sort();
      const moduleKey = codes.length ? codes.join("+") : "parent";
      if (!group.modules.has(moduleKey)) group.modules.set(moduleKey, []);
      group.modules.get(moduleKey).push(exam);
      group.exams.push(exam);
    }
    return [...result.values()];
  }
  // Date groups for the two Table pages. The boundary belongs to the cohort,
  // so reopening the page in January does not move it forward another year.
  function rounds(exams, cohort) {
    const year = Number(/^(\d{4})-/.exec(cohort?.id || "")?.[1]);
    if (!Number.isInteger(year)) throw new Error("The cohort start year is unavailable.");
    const cutoff = `${year + 1}-01-01`;
    const ordered = [...exams].sort(sort);
    return [
      { id: "first", label: "First round", cutoff, exams: ordered.filter(exam => exam.dateKey < cutoff) },
      { id: "second", label: "Second round", cutoff, exams: ordered.filter(exam => exam.dateKey >= cutoff) },
    ];
  }
  function courseUrl(id, tab) {
    return "course.html?" + new URLSearchParams({ course: id, tab });
  }
  // Only advertise preparation that exists for the modules actually on display.
  function studyLinks(course, exams, catalogue) {
    const scope = course.modules.filter(module => exams.some(exam =>
      !exam.moduleCodes?.length || exam.moduleCodes.includes(module.code)));
    const entries = scope.map(module => catalogue[module.id]).filter(Boolean);
    const questions = entries.reduce((n, entry) => n + entry.questions, 0);
    const cards = entries.reduce((n, entry) => n + entry.cards, 0);
    const revision = entries.some(entry => entry.revision);
    const quizTopic = entries.find(entry => entry.questions > 0)?.questionTopic;
    const cardTopic = entries.find(entry => entry.cards > 0)?.cardTopic;
    const practice = questions || cards ? courseUrl(course.id, "practice") +
      ((quizTopic || cardTopic) ? "&practiceTopic=" + encodeURIComponent(quizTopic || cardTopic) : "") +
      (questions ? "#quiz" : "#flashcards") : "";
    return { revise: courseUrl(course.id, revision ? "topics" : "resources"),
      label: revision ? "Revise now" : "Course resources", practice, questions, cards };
  }
  return { sort, validDate, events, groups, rounds, studyLinks, courseUrl };
})();
if (typeof module !== "undefined") module.exports = ExamWorkspace;
