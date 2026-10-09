// Exams workspace: one source-backed collection, four views, no invented
// attempts. UI choices stay in memory; only existing study-plan preferences persist.
const examList = document.getElementById("exam-list");
const examStatus = document.getElementById("exam-status");
const examCourseFilter = document.getElementById("exam-course-filter");
const examRegistrationFilter = document.getElementById("exam-registration-filter");
const examSearch = document.getElementById("exam-search");
const examReset = document.getElementById("exam-reset");
const ALMAESAMI_URL = "https://almaesami.unibo.it/almaesami/welcome.htm";
const examsPage = {
  programme: null, exams: [], loaded: false, loading: false, scopeSwitch: null,
  view: "list", month: Planner.clock().slice(0, 7), day: "", calendarFocus: "", tableRound: null,
  studies: {}, studyStarted: false, openDetails: new Set(),
  clockSignature: "", clockRefreshPending: false, feedFailed: false,
};
const controls = () => [examCourseFilter, examRegistrationFilter, examSearch, examReset,
  ...document.querySelectorAll("[data-exam-view]")];
const el = createElement;
const fullDate = date => formatDay(date, { day: "numeric", month: "short", year: "numeric" });
const courseFor = id => currentTerm(examsPage.programme).courses.find(c => c.id === id);
function link(label, href, className = "", external = false) {
  const node = el("a", className, label); node.href = href;
  if (external) { node.target = "_blank"; node.rel = "noopener"; }
  return node;
}
function button(label, action, className = "") {
  const node = el("button", className, label); node.type = "button";
  node.addEventListener("click", action); return node;
}
function disclosure(title, key, className = "") {
  const node = el("details", className); node.dataset.disclosure = key;
  node.open = examsPage.openDetails.has(key);
  const summary = el("summary"); summary.append(el("span", null, title), siteIcon("chevron-down"));
  node.appendChild(summary);
  node.addEventListener("toggle", () => {
    if (!node.isConnected) return;
    if (node.open) examsPage.openDetails.add(key); else examsPage.openDetails.delete(key);
  });
  return node;
}
function rememberDisclosures() {
  for (const node of examList.querySelectorAll("details[data-disclosure]")) {
    if (node.open) examsPage.openDetails.add(node.dataset.disclosure);
    else examsPage.openDetails.delete(node.dataset.disclosure);
  }
}
function filteredExams(now = Planner.clock(), includePast = false) {
  if (!examsPage.programme) return [];
  const mine = myCoursesOnly(examsPage.programme) ? new Set(myModuleCodes(examsPage.programme)) : null;
  const query = simplify(examSearch.value.trim());
  return examsPage.exams.filter(exam => {
    if (!includePast && !Planner.upcomingExam(exam, now)) return false;
    if (mine && !exam.codes.some(code => mine.has(code))) return false;
    if (examCourseFilter.value && !exam.courseIds.includes(examCourseFilter.value)) return false;
    if (examRegistrationFilter.value && Planner.registration(exam, now.slice(0,10)).key !== examRegistrationFilter.value) return false;
    const words = [exam.title, exam.partOf, exam.place, exam.notes, ...exam.teachers,
      exam.administrative ? "administrative recording Pass/Fail no final exam" : ""].join(" ");
    return !query || simplify(words).includes(query);
  });
}
function visibleExams(now = Planner.clock()) { return filteredExams(now); }
function resetExamFilters() {
  examCourseFilter.value = ""; examRegistrationFilter.value = ""; examSearch.value = "";
  examsPage.day = ""; render();
}
function coursePageLink(exam) { return ExamWorkspace.courseUrl(exam.courseIds[0], "exam"); }
function registrationNote(reg, exam) {
  if (reg.key === "open") return reg.days === 0 ? "Last day to book · check the closing time on AlmaEsami." : `Book by ${fullDate(exam.registrationCloses)}`;
  if (reg.key === "soon") return `Booking opens ${fullDate(exam.registrationOpens)}`;
  if (reg.key === "closed") return "The published booking window has ended.";
  return exam.origin === "lecturer" ? "Booking window not supplied · check the lecturer’s session." : "Booking dates not listed · check AlmaEsami.";
}
function registrationWindow(exam, today) {
  const reg = Planner.registration(exam, today);
  const box = el("div", `exam-registration is-${reg.key}`);
  const label = exam.origin === "lecturer" && reg.key === "unknown" ? "Check registration" : reg.label;
  box.append(el("strong", "reg-chip", label), el("span", "exam-registration-note", registrationNote(reg, exam)));
  return box;
}
function adminInstructions(course, exam) {
  const info = exam.notice;
  const details = disclosure("Registration instructions · lecturer guidance", `admin-${course.id}`, "exam-admin-instructions");
  const list = el("ol");
  for (const [label, text] of [["Virtuale course enrolment", info.virtualeInstruction],
    ["Recording-session enrolment", info.recordingInstruction], ["Result and credits", info.note]]) {
    const item = el("li"); item.append(el("strong", null, label), el("p", null, text)); list.appendChild(item);
  }
  details.appendChild(list);
  if (exam.noticeTimeDiffers) details.appendChild(el("p", "exam-conflict", `The lecturer’s email gives ${info.sessionTime} on ${fullDate(info.sessionDate)}. The live listing differs; confirm the current time before acting.`));
  const sources = el("p", "exams-source", info.sourceLabel || "Lecturer communication");
  if (course.officialUrl) sources.append(" · ", link("Official syllabus", course.officialUrl, "", true));
  details.appendChild(sources);
  return details;
}
function adminActions(exam) {
  const actions = el("div", "item-actions");
  const add = button("Add recording reminder", () => {
    const start = `${exam.dateKey}T${exam.time}:00`;
    const calendar = eventIcs({
      uid: `recording-${exam.codes.join("-")}-${exam.dateKey}-${exam.time}`,
      title: `Registration / Pass-Fail recording: ${exam.title}`,
      start, end: start,
      description: "No final examination. This is the lecturer's recording session. Complete required enrolment separately; saving a reminder does not register you. Confirm current instructions and deadlines with the lecturer.",
    // A date-time VEVENT without DTEND is a point-in-time reminder. Do not invent
    // an examination duration or mark the student's calendar busy for two hours.
    }).replace(/^DTEND[^\r\n]*\r?\n/m, "").replace("END:VEVENT", "TRANSP:TRANSPARENT\r\nEND:VEVENT");
    const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar" }));
    const download = link("", url); download.download = "course-recording-reminder.ics";
    document.body.appendChild(download); download.click(); download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Reminder downloaded. Enrol separately on the course platform.");
  });
  add.setAttribute("aria-label", `Add recording reminder: ${exam.title}`);
  actions.appendChild(add); return actions;
}
function sittingActions(exam, today) {
  const reg = Planner.registration(exam, today);
  const actions = exam.administrative ? adminActions(exam) : examActions(exam, today);
  if (reg.key === "open" || reg.key === "unknown") actions.prepend(link(
    reg.key === "open" ? "Register on AlmaEsami" : "Check AlmaEsami", ALMAESAMI_URL, "exam-booking-link", true));
  return actions;
}
function examCard(exam, today) {
  const card = el("article", "exam-card");
  const reg = Planner.registration(exam, today), past = !Planner.upcomingExam(exam, Planner.clock());
  card.dataset.registration = reg.key;
  card.dataset.kind = exam.administrative ? "administrative" : "exam";
  card.dataset.date = exam.dateKey;
  const date = el("time", "exam-date-block"); date.dateTime = exam.dateKey;
  date.append(el("span", "exam-day", String(Number(exam.dateKey.slice(8)))),
    el("span", "exam-month", formatDay(exam.dateKey, {month:"short"})),
    el("span", "exam-weekday", formatDay(exam.dateKey, {weekday:"short"})));
  const body = el("div", "exam-card-body"), head = el("div", "exam-card-head");
  const title = el("h4", "exam-title" + (courseFor(exam.courseIds[0])?.integrated ? "" : " visually-hidden")); title.appendChild(link(exam.title, coursePageLink(exam)));
  head.append(title, el("span", "exam-countdown", past ? "Past date" : countdownText(exam.dateKey, today)));
  body.appendChild(head);
  const format = exam.administrative ? "Pass/Fail recording" : exam.type || "Assessment";
  body.appendChild(el("p", "exam-when-line", `${exam.time || "Time not listed"} · ${format} · ${exam.dateKey.slice(0,4)}`));
  if (exam.administrative) body.appendChild(el("p", "exam-no-final", "No final exam · enrolment required for recording"));
  else if (exam.place) body.appendChild(el("p", "exam-room", exam.place));
  body.appendChild(registrationWindow(exam, today));
  const detailKey = JSON.stringify([exam.courseIds, exam.moduleCodes, exam.dateKey, exam.time,
    exam.place, exam.type, exam.registrationOpens, exam.registrationCloses, exam.duration, exam.notes]);
  const extra = disclosure("Details & booking", `sitting-${detailKey}`, "exam-sitting-details");
  const meta = el("p", "exam-meta-text", [exam.time ? "Bologna time (Europe/Rome)" : "Time not listed",
    exam.administrative ? "No final examination" : exam.place || "Room not listed", ...exam.teachers].join(" · "));
  extra.appendChild(meta);
  if (exam.duration && !exam.administrative) extra.appendChild(el("p", "exam-meta-text", `Published duration: ${exam.duration}`));
  if (exam.notes) extra.appendChild(el("p", "exam-meta-text", exam.notes));
  const windowText = [exam.registrationOpens && `Opens ${fullDate(exam.registrationOpens)}`,
    exam.registrationCloses && `Closes ${fullDate(exam.registrationCloses)}`].filter(Boolean).join(" · ");
  if (windowText) extra.appendChild(el("p", "exam-registration-dates", windowText));
  if (!past) extra.appendChild(sittingActions(exam, today));
  extra.appendChild(el("p", "exams-source", exam.origin === "lecturer" ? "Date: lecturer email · not independently confirmed in the current UniBo feed" : "Date & booking window: UniBo · confirm on AlmaEsami"));
  body.appendChild(extra); card.append(date, body); return card;
}
function studyActions(course, exams) {
  const targets = ExamWorkspace.studyLinks(course, exams, examsPage.studies);
  const box = el("div", "exam-study-actions"); box.dataset.studyCourse = course.id;
  const revise = link(targets.label, targets.revise, "exam-revise"); revise.prepend(siteIcon("book"));
  revise.setAttribute("aria-label", `${targets.label}: ${course.name}`); box.appendChild(revise);
  if (targets.practice) {
    const practice = link("Test yourself", targets.practice, "exam-practice"); practice.prepend(siteIcon("flashcards"));
    practice.setAttribute("aria-label", `Test yourself: ${course.name}`); box.appendChild(practice);
  }
  return box;
}
function renderCourseSittings(exams, today) {
  const listView = examsPage.view === "list";
  const groups = ExamWorkspace.groups(exams).sort((a, b) => ExamWorkspace.sort(a.exams[0], b.exams[0]));
  for (const group of groups) {
    const course = courseFor(group.courseId); if (!course) continue;
    const wrapper = el("section", "exam-course-group"); wrapper.dataset.course = course.id;
    if (group.exams.every(exam => exam.administrative)) wrapper.classList.add("is-administrative");
    const heading = el("header", "exam-course-group-head"), identity = el("div");
    const top = el("p", "exam-course-eyebrow", `${course.code} · ${course.integrated ? "Integrated course" : group.exams[0].administrative ? "Administrative registration" : "Course assessment"}`);
    const title = el("h3"); title.appendChild(link(course.name, coursePageLink(group.exams[0])));
    identity.append(top, title, el("p", "exam-course-group-note", `${group.exams.length} published date${group.exams.length === 1 ? "" : "s"}${listView ? " · Nearest date first" : ""}${course.integrated ? " · Separate module assessments" : ""}`));
    heading.append(identity, studyActions(course, group.exams)); wrapper.appendChild(heading);
    const dates = el("div", "exam-course-dates");
    // The default List shows one nearest date for the entire course. Other module
    // assessments remain available in the same course disclosure, in date order.
    const assessments = listView ? [["course", group.exams]] : group.modules;
    for (const [key, sittings] of assessments) {
      const block = el("div", "exam-module-group");
      block.appendChild(examCard(sittings[0], today));
      if (sittings.length > 1) {
        const details = disclosure(`${sittings.length - 1} more date${sittings.length === 2 ? "" : "s"} for this ${listView ? "course" : "assessment"}`, `more-${course.id}-${key}`, "exam-more-sittings");
        for (const sitting of sittings.slice(1)) details.appendChild(examCard(sitting, today));
        block.appendChild(details);
      }
      dates.appendChild(block);
    }
    const admin = group.exams.find(exam => exam.notice);
    if (admin) dates.appendChild(adminInstructions(course, admin));
    wrapper.appendChild(dates); examList.appendChild(wrapper);
  }
}
function renderExamTable(exams, today, round) {
  const scroll = el("div", "exam-table-scroll");
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-labelledby", "exam-table-title");
  scroll.setAttribute("aria-describedby", "exam-table-help");
  const help = el("p", "exam-table-help", "Scroll across to compare all columns. The course column stays visible. Duration is shown only when published.");
  help.id = "exam-table-help";
  const table = el("table", "exam-table");
  const caption = el("caption", null, `${round.label} · Upcoming exam dates · Bologna time (Europe/Rome)`);
  caption.id = "exam-table-title";
  const head = el("thead"), headings = el("tr");
  for (const label of ["Course", "Teacher", "Date", "Time (Bologna)", "Duration", "Location", "Format", "Notes", "Registration", "Actions"]) {
    const th = el("th", null, label); th.scope = "col"; headings.appendChild(th);
  }
  head.appendChild(headings);
  const body = el("tbody");
  for (const exam of [...exams].sort(ExamWorkspace.sort)) {
    const course = courseFor(exam.courseIds[0]);
    const row = el("tr");
    row.dataset.course = exam.courseIds[0]; row.dataset.date = exam.dateKey;
    row.dataset.kind = exam.administrative ? "administrative" : "exam";
    const name = el("th"); name.scope = "row";
    name.appendChild(link(course?.name || exam.title, coursePageLink(exam), "exam-table-course"));
    if (course && course.name !== exam.title) name.appendChild(el("span", "exam-table-module", exam.title));
    if (exam.administrative) name.appendChild(el("span", "exam-table-admin", "Administrative recording"));
    const teacher = el("td", null, exam.teachers.length ? exam.teachers.join(", ") : "Not listed");
    const dateCell = el("td"), date = el("time", null, fullDate(exam.dateKey)); date.dateTime = exam.dateKey;
    dateCell.append(date, el("span", "exam-table-subtext", countdownText(exam.dateKey, today)));
    const time = el("td", null, exam.time || "Not listed");
    const duration = el("td", null, exam.administrative ? "Not applicable" : exam.duration || "Not published");
    const place = el("td", null, exam.place || "Not listed");
    const format = el("td", null, exam.administrative ? "Pass/Fail recording" : exam.type || "Not listed");
    const notes = el("td");
    notes.appendChild(el("p", null, exam.notes || (exam.administrative ? "No final exam · enrolment required for recording" : "No notes published")));
    notes.appendChild(el("span", "exam-table-subtext", exam.origin === "lecturer" ? "Lecturer guidance · confirm current details" : "Source: UniBo · confirm on AlmaEsami"));
    if (exam.administrative && exam.notice && course) notes.appendChild(adminInstructions(course, exam));
    const registration = el("td"); registration.appendChild(registrationWindow(exam, today));
    const window = [exam.registrationOpens && `Opens ${fullDate(exam.registrationOpens)}`,
      exam.registrationCloses && `Closes ${fullDate(exam.registrationCloses)}`].filter(Boolean).join(" · ");
    if (window) registration.appendChild(el("span", "exam-table-subtext", window));
    const actions = el("td"); actions.appendChild(sittingActions(exam, today));
    row.append(name, teacher, dateCell, time, duration, place, format, notes, registration, actions);
    body.appendChild(row);
  }
  table.append(caption, head, body); scroll.appendChild(table); examList.append(help, scroll);
}
function renderRoundControls(round) {
  const position = examsPage.tableRound + 1;
  const count = `${round.exams.length} upcoming date${round.exams.length === 1 ? "" : "s"}`;
  const period = round.id === "first" ? `Before ${fullDate(round.cutoff)}` : `From ${fullDate(round.cutoff)} · including later published sittings`;
  document.getElementById("exam-round-title").textContent = round.label;
  document.getElementById("exam-round-meta").textContent = `${period} · ${count}`;
  document.getElementById("exam-round-position").textContent = `${position} / 2`;
  document.getElementById("exam-round-prev").disabled = examsPage.tableRound === 0;
  document.getElementById("exam-round-next").disabled = examsPage.tableRound === 1;
  document.getElementById("exam-round-status").textContent = `${round.label}, ${position} of 2. ${count}.`;
}
function changeTableRound(offset) {
  if (!examsPage.loaded || examsPage.view !== "table") return;
  const next = examsPage.tableRound + offset;
  if (next < 0 || next > 1) return;
  examsPage.tableRound = next;
  render();
  // At either end the pressed arrow becomes disabled. Focus the enabled arrow
  // so keyboard users can return without losing their place.
  document.getElementById(next === 0 ? "exam-round-next" : "exam-round-prev").focus({ preventScroll: true });
}
function renderExamHighlight(exams, today) {
  const target = document.getElementById("exam-highlight");
  // Keep administrative recording out of the next actual exam countdown when possible.
  const exam = exams.find(item => !item.administrative) || exams[0];
  target.replaceChildren(el("span", "planning-aside-eyebrow", exam?.administrative ? "Next registration task" : "Next assessment"));
  if (!exam) { target.append(el("strong", "planning-aside-title", "Room to plan"), el("p", "planning-aside-note", "No upcoming date matches these filters. Check the official listing.")); return; }
  target.append(el("strong", "planning-aside-title", fullDate(exam.dateKey)), link(exam.title, coursePageLink(exam), "planning-next-exam"),
    el("p", "planning-next-meta", `${exam.time || "Time not listed"} · ${exam.administrative ? "No final exam" : countdownText(exam.dateKey,today)}`));
}
function renderOpenRegistrations(exams, today) {
  const target = document.getElementById("open-registrations"); target.replaceChildren();
  if (!exams.length) return;
  const box = el("details", "exam-open-bookings");
  box.appendChild(el("summary", null, `${exams.length} booking window${exams.length === 1 ? "" : "s"} open · nearest deadline ${fullDate(exams[0].registrationCloses)}`));
  const list = el("div", "exam-booking-list");
  for (const exam of exams) {
    const row = el("div"); row.append(el("span", null, `${exam.title} · closes ${fullDate(exam.registrationCloses)}`), link("Register on AlmaEsami", ALMAESAMI_URL, "", true)); list.appendChild(row);
  }
  box.appendChild(list); target.appendChild(box);
}
function drawCalendar(exams, today) {
  const month = examsPage.month, days = TimetableCalendar.monthDays(month + "-01");
  const monthExams = exams.filter(exam => exam.dateKey.startsWith(month));
  const examDays = new Set(monthExams.map(exam => exam.dateKey));
  document.getElementById("exam-month-title").textContent = formatDay(month + "-01", { month:"long", year:"numeric" });
  document.getElementById("exam-month-meta").textContent = `${monthExams.length} published date${monthExams.length === 1 ? "" : "s"} on ${examDays.size} day${examDays.size === 1 ? "" : "s"} · current filters`;
  const focusDate = examsPage.calendarFocus || examsPage.day || (today.startsWith(month) ? today : month + "-01");
  const table = el("table", "exam-month-table");
  table.setAttribute("aria-describedby", "exam-calendar-help");
  const caption = el("caption", "visually-hidden", formatDay(month+"-01", {month:"long",year:"numeric"}) + " exam dates");
  const head = el("thead"), labels = el("tr");
  for (const weekday of ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]) { const th=el("th",null,weekday); th.scope="col"; labels.appendChild(th); }
  head.appendChild(labels); const body=el("tbody");
  for (let at=0; at<days.length; at+=7) {
    const row=el("tr");
    for (const day of days.slice(at,at+7)) {
      const cell=el("td"), events=exams.filter(exam=>exam.dateKey===day.date);
      const academic=events.filter(exam=>!exam.administrative).length, admin=events.length-academic;
      const node=button("",()=>selectDay(day.date),"exam-calendar-day"); node.dataset.day=day.date;
      node.tabIndex=day.date===focusDate?0:-1;
      node.classList.toggle("is-outside", !day.inMonth); node.classList.toggle("has-exams",academic>0); node.classList.toggle("has-admin",admin>0);
      node.setAttribute("aria-pressed",String(day.date===examsPage.day));
      if (day.date===today) {node.classList.add("is-today"); node.setAttribute("aria-current","date");}
      node.setAttribute("aria-label",`${fullDate(day.date)}${day.date===today?", today":""}: ${academic} exam sitting${academic===1?"":"s"}, ${admin} administrative recording${admin===1?"":"s"}`);
      node.appendChild(el("span","exam-calendar-number",String(Number(day.date.slice(8)))));
      const marks=el("span","exam-calendar-marks");
      if(academic) marks.appendChild(el("span","exam-date-count",String(academic)));
      if(admin) marks.appendChild(el("span","exam-date-count is-admin",String(admin)));
      marks.setAttribute("aria-hidden","true"); node.appendChild(marks);
      node.addEventListener("keydown",event=>calendarKey(event,day.date)); cell.appendChild(node); row.appendChild(cell);
    }
    body.appendChild(row);
  }
  table.append(caption,head,body); document.getElementById("exam-month-grid").replaceChildren(table);
  // Ensure one tab stop when a previously focused date is outside the new month grid.
  if (!table.querySelector('[tabindex="0"]')) table.querySelector("button:not(.is-outside)").tabIndex=0;
}
function calendarKey(event, date) {
  const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}; let next;
  if (Object.hasOwn(offsets,event.key)) next=TimetableCalendar.addDays(date,offsets[event.key]);
  else if(event.key==="Home") next=TimetableCalendar.monday(date);
  else if(event.key==="End") next=TimetableCalendar.addDays(TimetableCalendar.monday(date),6);
  else if(event.key==="PageUp"||event.key==="PageDown") next=TimetableCalendar.shiftMonth(date,event.key==="PageUp"?-1:1);
  if(!next) return; event.preventDefault();
  if(!TimetableCalendar.validDate(next)) return;
  examsPage.calendarFocus=next; examsPage.month=next.slice(0,7); examsPage.day="";
  render(); document.querySelector(`[data-day="${next}"]`)?.focus({preventScroll:true});
}
function selectDay(date) {
  examsPage.day=date; examsPage.month=date.slice(0,7); examsPage.calendarFocus=date;
  render(); document.querySelector(`[data-day="${date}"]`)?.focus({preventScroll:true});
}
function changeMonth(offset) {
  examsPage.month=TimetableCalendar.shiftMonth(examsPage.month+"-01",offset).slice(0,7);
  examsPage.day=""; examsPage.calendarFocus=""; render();
}
function render() {
  if(!examsPage.loaded) return;
  rememberDisclosures();
  const now=Planner.clock(), today=now.slice(0,10), upcoming=filteredExams(now), all=filteredExams(now,true);
  examsPage.clockSignature=examClockSignature(now); examsPage.clockRefreshPending=false;
  const open=upcoming.filter(exam=>Planner.registration(exam,today).key==="open").sort((a,b)=>a.registrationCloses.localeCompare(b.registrationCloses)||ExamWorkspace.sort(a,b));
  const deadline=open[0]?.registrationCloses;
  const admin=upcoming.filter(exam=>exam.administrative).length;
  Planner.summary(document.getElementById("exam-summary"),[
    {label:"Upcoming dates",value:upcoming.length,note:`${ExamWorkspace.groups(upcoming).length} courses${admin?` · ${admin} administrative`:""}`},
    {label:"Registration open",value:open.length,note:"Check and book on AlmaEsami"},
    {label:"Next deadline",value:deadline?fullDate(deadline):"—",note:deadline?(deadline===today?"Closes today · check the time":`${daysBetween(today,deadline)} days to register`):"No open booking windows"},
  ]);
  renderExamHighlight(upcoming,today); renderOpenRegistrations(open,today);
  const monthView=examsPage.view==="month", tableView=examsPage.view==="table";
  document.getElementById("exam-month").hidden=!monthView;
  document.getElementById("exam-rounds").hidden=!tableView;
  let displayed=monthView?all.filter(exam=>exam.dateKey.startsWith(examsPage.month)&&(!examsPage.day||exam.dateKey===examsPage.day)):upcoming;
  let rounds, round;
  if (tableView) {
    rounds = ExamWorkspace.rounds(upcoming, currentCohort(examsPage.programme));
    if (examsPage.tableRound === null) {
      const startWithSecond = !rounds[0].exams.length && (rounds[1].exams.length || today >= rounds[0].cutoff);
      examsPage.tableRound = startWithSecond ? 1 : 0;
    }
    round = rounds[examsPage.tableRound];
    displayed = round.exams;
    examList.dataset.round = round.id;
    renderRoundControls(round);
  } else delete examList.dataset.round;
  if(monthView) drawCalendar(all,today);
  for(const node of document.querySelectorAll("[data-exam-view]")) node.setAttribute("aria-pressed",String(node.dataset.examView===examsPage.view));
  examList.dataset.view=examsPage.view;
  const label=monthView?(examsPage.day?fullDate(examsPage.day):formatDay(examsPage.month+"-01",{month:"long",year:"numeric"})):tableView?`${round.label} · Upcoming dates`:"Upcoming dates";
  examStatus.textContent=`${label} · ${ExamWorkspace.groups(displayed).length} courses · ${displayed.length} published date${displayed.length===1?"":"s"}`;
  document.getElementById("exam-scope").textContent=`${currentCohort(examsPage.programme).label} · ${myCoursesOnly(examsPage.programme)?"Your study plan":"All first-year courses"}`;
  document.getElementById("exam-clear-day").hidden=!(monthView&&examsPage.day);
  examReset.disabled=!(examCourseFilter.value||examRegistrationFilter.value||examSearch.value||examsPage.day);
  examList.replaceChildren();
  if(displayed.length) {
    if (tableView) renderExamTable(displayed, today, round);
    else renderCourseSittings(displayed,today);
  }
  else Planner.empty(examList,{title:tableView?`No upcoming dates in ${round.label}`:monthView?"No dates listed for this selection":"No upcoming dates to show",
    text:tableView?"Try the other round or adjust your filters. New sittings may be published later; check the official dates.":monthView?"Try another day or month, or clear the course and registration filters. No published date is not a guarantee of no exam.":"Adjust your filters or study-plan selection, or check the official dates. New sittings may be published later.",
    onReset:examReset.disabled?null:resetExamFilters,source:document.getElementById("exams-source").href});
  if (tableView && !displayed.length && rounds[1 - examsPage.tableRound].exams.length) {
    const other = rounds[1 - examsPage.tableRound];
    const action = button(`Show ${other.label} (${other.exams.length} date${other.exams.length === 1 ? "" : "s"})`,
      () => changeTableRound(examsPage.tableRound === 0 ? 1 : -1), "exam-other-round");
    examList.querySelector(".planning-empty").appendChild(action);
  }
}
async function jsonFile(path) {
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),8000);
  try {const response=await fetch(path,{signal:controller.signal});if(!response.ok)throw Error("Content unavailable");return await response.json();}
  finally{clearTimeout(timer);}
}
async function loadStudyLinks() {
  if(examsPage.studyStarted) return; examsPage.studyStarted=true;
  try {
    const index=await jsonFile("content/index.json");
    const modules=currentTerm(examsPage.programme).courses.flatMap(course=>course.modules);
    await Promise.all(modules.map(async module=>{
      const available=index.modules?.[module.id]||[];
      const get=async file=>available.includes(file)?jsonFile(`content/modules/${module.id}/${file}`).catch(()=>[]):[];
      const [topics,questions,cards]=await Promise.all([get("topics.json"),get("questions.json"),get("flashcards.json")]);
      const qs=Array.isArray(questions)?questions.filter(q=>q.id&&!q.sample):[];
      const cs=Array.isArray(cards)?cards.filter(c=>c.id&&!c.sample):[];
      examsPage.studies[module.id]={questions:qs.length,cards:cs.length,questionTopic:qs[0]?.topic,cardTopic:cs[0]?.topic,
        revision:Array.isArray(topics)&&topics.some(topic=>(topic.notes||topic.lecture)&&!topic.sample)};
    }));
    // Enhance only the study strips, never destroy a focused action elsewhere.
    for(const strip of document.querySelectorAll("[data-study-course]")) {
      if(strip.contains(document.activeElement)) continue;
      const course=courseFor(strip.dataset.studyCourse);
      const shown=filteredExams(Planner.clock(),examsPage.view==="month").filter(exam=>exam.courseIds.includes(course.id)&&
        (examsPage.view!=="month"||(exam.dateKey.startsWith(examsPage.month)&&(!examsPage.day||exam.dateKey===examsPage.day))));
      strip.replaceWith(studyActions(course,shown));
    }
  } catch { /* Course resources remain useful when optional study metadata fails. */ }
}
async function loadExams() {
  if(examsPage.loading) return;
  examsPage.loading=true; examsPage.loaded=false;
  for(const control of controls()) control.disabled=true;
  examList.setAttribute("aria-busy","true"); examList.replaceChildren(skeleton(2,"card"));
  document.getElementById("exam-month").hidden=true;
  document.getElementById("exam-rounds").hidden=true;
  document.getElementById("exam-feed-notice").replaceChildren();
  examStatus.textContent="Loading official dates…";
  try {
    examsPage.programme=examsPage.programme||await loadProgramme();
    const cohort=currentCohort(examsPage.programme), term=currentTerm(examsPage.programme);
    document.getElementById("exams-source").href=cohort.sources.examDates;
    let raw=[], timeout;
    examsPage.feedFailed=false;
    try { raw=await Promise.race([fetchExams(cohort.sources.examDates),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error("Exam feed timeout")),15000);})]); }
    catch {examsPage.feedFailed=true;} finally{clearTimeout(timeout);}
    examsPage.exams=ExamWorkspace.events(matchExamsToTerm(raw,term),term);
    const selected=examCourseFilter.value;
    examCourseFilter.replaceChildren(new Option("All courses",""));
    for(const course of term.courses) if(examsPage.exams.some(exam=>exam.courseIds.includes(course.id))) examCourseFilter.appendChild(new Option(course.name,course.id));
    if([...examCourseFilter.options].some(option=>option.value===selected)) examCourseFilter.value=selected;
    if(!examsPage.scopeSwitch&&loadPlan(examsPage.programme).saved){examsPage.scopeSwitch=myCoursesSwitch(examsPage.programme,render);document.getElementById("exam-filters").appendChild(examsPage.scopeSwitch);}
    for(const control of controls()) control.disabled=false;
    examsPage.loaded=true;
    const checked=document.getElementById("exam-checked");
    if(examsPage.feedFailed){
      checked.textContent="UniBo feed unavailable · lecturer-provided dates only";
      const warning=el("div","exam-feed-warning");warning.append(el("p",null,"Official exam dates could not be loaded. Any date below comes only from lecturer guidance; the calendar is incomplete."),button("Retry official dates",loadExams));
      document.getElementById("exam-feed-notice").appendChild(warning);
    } else Planner.checked(checked);
    render(); loadStudyLinks();
  } catch {
    document.getElementById("exam-checked").textContent="Course data could not be loaded.";
    examStatus.textContent="Exam workspace unavailable.";
    Planner.empty(examList,{title:"The exam dates are unavailable",text:"Retry loading the course data, or open the official UniBo page.",retry:loadExams,source:document.getElementById("exams-source").href});
  } finally {examsPage.loading=false;examList.setAttribute("aria-busy","false");}
}
for(const control of [examCourseFilter,examRegistrationFilter]) control.addEventListener("change",()=>{examsPage.day="";render();});
examSearch.addEventListener("input",()=>{examsPage.day="";render();}); examReset.addEventListener("click",resetExamFilters);
for(const node of document.querySelectorAll("[data-exam-view]")) node.addEventListener("click",()=>{examsPage.view=node.dataset.examView;render();});
document.getElementById("exam-month-prev").addEventListener("click",()=>changeMonth(-1));
document.getElementById("exam-month-next").addEventListener("click",()=>changeMonth(1));
document.getElementById("exam-month-today").addEventListener("click",()=>{examsPage.month=Planner.clock().slice(0,7);examsPage.day="";examsPage.calendarFocus="";render();});
document.getElementById("exam-clear-day").addEventListener("click",()=>{examsPage.day="";render();document.getElementById("exam-month-today").focus({preventScroll:true});});
document.getElementById("exam-round-prev").addEventListener("click",()=>changeTableRound(-1));
document.getElementById("exam-round-next").addEventListener("click",()=>changeTableRound(1));
document.getElementById("exam-rounds").addEventListener("keydown",event=>{
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault(); changeTableRound(event.key === "ArrowLeft" ? -1 : 1);
});
function examClockSignature(now) {
  return JSON.stringify([now.slice(0,10),examsPage.exams.map(exam=>[Planner.upcomingExam(exam,now),Planner.registration(exam,now.slice(0,10)).key])]);
}
function refreshExamClock() {
  if(!examsPage.loaded||examsPage.loading||document.hidden||examClockSignature(Planner.clock())===examsPage.clockSignature)return;
  const regions=[examList,document.getElementById("exam-month"),document.getElementById("exam-rounds"),document.getElementById("open-registrations"),document.getElementById("exam-highlight")];
  if(regions.some(region=>region.contains(document.activeElement))){examsPage.clockRefreshPending=true;return;}
  render();
}
setInterval(refreshExamClock,60000); document.addEventListener("visibilitychange",refreshExamClock);
document.addEventListener("focusout",()=>{if(examsPage.clockRefreshPending)setTimeout(refreshExamClock,0);});
loadExams();
