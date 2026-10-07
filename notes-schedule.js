// Pure scheduling helpers for the Notes library. Course dates come from programme.json;
// exams come from UniBo or the existing generated calendar. Never infer an exam from a term period.
const NotesSchedule = (() => {
  const dateKey = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

  // All teaching and exam dates refer to Bologna, even when a student travels abroad.
  function clock(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
  }

  function moduleStatus(module, today) {
    const start = module.teachingStart, end = module.teachingEnd;
    if (!dateKey(start) || !dateKey(end) || end < start) return "other";
    if (today < start) return "upcoming";
    if (today > end) return "finished";
    return "now";
  }

  function courseStatus(course, today) {
    const modules = (course.modules || []).map(info => ({ info, key: moduleStatus(info, today) }));
    const active = modules.filter(m => m.key === "now").sort((a, b) => a.info.teachingEnd.localeCompare(b.info.teachingEnd));
    const future = modules.filter(m => m.key === "upcoming").sort((a, b) => a.info.teachingStart.localeCompare(b.info.teachingStart));
    const past = modules.filter(m => m.key === "finished");
    if (active.length) return { key: "now", label: "Teaching now", nextDate: active[0].info.teachingEnd, modules };
    if (future.length) return { key: "upcoming", label: past.length ? "Next module coming up" : "Coming up", nextDate: future[0].info.teachingStart, resumes: !!past.length, modules };
    if (modules.length && past.length === modules.length) return { key: "finished", label: "Teaching completed", nextDate: past.map(m => m.info.teachingEnd).sort().pop(), modules };
    return { key: "other", label: "Dates to confirm", nextDate: "", modules };
  }

  function nextExam(exams, courseId, now) {
    const today = now.slice(0, 10);
    return exams.filter(exam => dateKey(exam.dateKey) && (!courseId || (exam.courseIds || []).includes(courseId)) &&
      (exam.dateKey > today || (exam.dateKey === today && (!exam.time || `${exam.dateKey}T${exam.time.padStart(5, "0")}:00` >= now))))
      .sort((a, b) => `${a.dateKey}T${(a.time || "23:59").padStart(5, "0")}`.localeCompare(`${b.dateKey}T${(b.time || "23:59").padStart(5, "0")}`))[0] || null;
  }

  // A fallback, using only the full calendar already produced from official UniBo sources.
  // Exact programme names are matched; partial-name guesses could confuse the two quantitative courses.
  // Calendar export supplies 09:00 when the official time is missing, so fallback times are not asserted.
  function calendarExams(text, term) {
    if (!/^BEGIN:VCALENDAR\r?\n/.test(text) || !/END:VCALENDAR/.test(text)) throw new Error("Invalid calendar copy");
    const decode = value => value.replace(/\\([nN,;\\])/g, (_, char) => /[nN]/.test(char) ? "\n" : char);
    const normalise = value => value.toLowerCase().replace(/\s+/g, " ").trim();
    const events = text.replace(/\r?\n[ \t]/g, "").split("BEGIN:VEVENT").slice(1);
    const exams = [];
    for (const event of events) {
      const fields = {};
      for (const line of event.split("END:VEVENT")[0].split(/\r?\n/)) {
        const at = line.indexOf(":");
        if (at < 0) continue;
        fields[line.slice(0, at)] = decode(line.slice(at + 1));
      }
      if (!fields.SUMMARY?.startsWith("Exam: ") || !fields.DESCRIPTION?.includes("Source: official UniBo exam dates")) continue;
      const start = fields["DTSTART;TZID=Europe/Rome"];
      if (!/^\d{8}T\d{6}$/.test(start || "")) continue;
      const title = fields.SUMMARY.slice(6);
      const titles = title.split(" / ").map(normalise);
      const courses = term.courses.filter(c => titles.includes(normalise(c.name)) || c.modules.some(m => titles.includes(normalise(m.name))));
      if (!courses.length) continue;
      const codes = [...new Set(courses.flatMap(c => [c.code, ...c.modules.filter(m => titles.includes(normalise(m.name))).map(m => m.code)]))];
      const closes = fields.DESCRIPTION.match(/Registration closes: (\d{4}-\d{2}-\d{2})/);
      exams.push({
        dateKey: `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`,
        time: "", title, courseIds: courses.map(c => c.id), codes,
        moduleCodes: courses.flatMap(c => c.modules.filter(m => titles.includes(normalise(m.name))).map(m => m.code)),
        type: (fields.DESCRIPTION.match(/Type: ([^\n]+)/) || [])[1] || "",
        place: fields.LOCATION || "", teachers: [], registrationOpens: "", registrationCloses: closes?.[1] || "",
      });
    }
    return exams.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }

  return { clock, moduleStatus, courseStatus, nextExam, calendarExams };
})();
if (typeof module !== "undefined") module.exports = NotesSchedule;
