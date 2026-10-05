// ===== Study Plan & Progress =====
// Built entirely from content/programme.json: the groups, rules, courses, modules and cycles.
// The plan can't become invalid: required courses are locked, "choose one" groups use radio
// buttons, optional groups use checkboxes limited by their maximum.
// Choices and statuses are saved in this browser only (localStorage), never sent anywhere.

const planPage = {
  programme: null, cohort: null, term: null, plan: null,
  view: "choose", // "choose" | "mine"
  calendars: [],
};

const planContent = document.getElementById("plan-content");
const planSummaryBox = document.getElementById("plan-summary");

// ----- Saving -----

function updatePlan(change, message = "Plan saved on this device ✓") {
  const y = window.scrollY;
  change(planPage.plan);
  planPage.plan.saved = true;
  savePlan(planPage.plan);
  render();
  window.scrollTo(0, y); // keep the place on the page
  if (typeof toast === "function") toast(message);
}

// ----- Small pieces -----

function shortDate(dateKey) {
  return formatDay(dateKey, { day: "numeric", month: "short" });
}

function externalLink(label, url, className = "inline-link") {
  const link = createElement("a", className, label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  return link;
}

function courseLinks(course) {
  const row = createElement("div", "plan-links");
  const page = createElement("a", "inline-link", "Course page");
  page.href = `course.html?course=${encodeURIComponent(course.id)}`;
  row.appendChild(page);
  if (course.officialUrl) row.appendChild(externalLink("Official UniBo page ↗", course.officialUrl));
  else row.appendChild(createElement("span", "schedule-meta", "Official page not published yet"));
  row.appendChild(externalLink("Open on Virtuale ↗", course.modules[0].virtualeUrl || planPage.programme.programme.virtualeUrl));
  return row;
}

function statusSelect(course) {
  const label = createElement("label", "plan-status", "Status ");
  const select = createElement("select");
  select.setAttribute("aria-label", `Status of ${course.name}`);
  for (const status of COURSE_STATUSES) select.appendChild(new Option(COURSE_STATUS_LABELS[status] || "—", status));
  select.value = planPage.plan.statuses[course.code] || "";
  select.addEventListener("change", () => updatePlan((plan) => {
    if (select.value) plan.statuses[course.code] = select.value;
    else delete plan.statuses[course.code];
  }, `${course.name}: ${COURSE_STATUS_LABELS[select.value] || "Not started"} ✓`));
  label.appendChild(select);
  return label;
}

// One course: name, CFU, group, cycle, badge, modules, links, (status if selected)
function courseCard(course, group, input, selected) {
  const card = createElement("div", `plan-course${selected ? " is-selected" : ""}`);
  card.style.setProperty("--course-color", course.color || "var(--color-primary)");
  if (input) card.appendChild(input);
  const body = createElement("div", "plan-course-body");

  const title = createElement("label", "plan-course-title");
  if (input && input.id) title.htmlFor = input.id;
  title.appendChild(createElement("span", "course-icon small", course.icon || "📘"));
  title.appendChild(createElement("span", null, `${course.name}${course.integrated ? " (I.C.)" : ""}`));
  body.appendChild(title);

  const meta = createElement("div", "plan-course-meta");
  meta.appendChild(createElement("span", `plan-badge plan-badge-${group.kind}`, group.badge || group.label));
  meta.appendChild(createElement("span", "schedule-meta", `${course.code} · ${course.cfu} CFU · ${group.label} · cycle ${courseCycles(course)}`));
  body.appendChild(meta);

  const modules = createElement("ul", "plan-modules");
  for (const module of course.modules) {
    const period = module.teachingStart ? `${shortDate(module.teachingStart)} – ${shortDate(module.teachingEnd)}` : "";
    const text = course.integrated
      ? `${module.name} (${module.code}, ${module.cfu} CFU) · ${module.professors.join(", ")} · ${period}`
      : `${module.professors.join(", ")} · ${period}`;
    modules.appendChild(createElement("li", null, text));
  }
  body.appendChild(modules);
  body.appendChild(courseLinks(course));
  if (selected) body.appendChild(statusSelect(course));
  card.appendChild(body);
  return card;
}

// ----- Choose courses -----

function groupRuleText(group) {
  if (group.kind === "required") return "All required";
  if (group.kind === "choose-one") return "Choose exactly one";
  const max = group.max ?? group.courses.length;
  return `Optional · choose ${group.min ?? 0} to ${max}`;
}

function adviceBox(group) {
  const details = createElement("details", "plan-advice");
  details.appendChild(createElement("summary", null, "Which one should I choose?"));
  if (group.advice) {
    details.appendChild(createElement("p", null, group.advice));
  } else {
    details.appendChild(createElement("p", "placeholder-text",
      "✍ PLACEHOLDER: advice to be written by students who took these courses. Nothing here yet."));
  }
  const links = createElement("p", "schedule-meta", "Official course pages: ");
  group.courses.forEach((code, i) => {
    const course = courseByCode(planPage.term, code);
    if (i > 0) links.appendChild(document.createTextNode(" · "));
    if (course.officialUrl) links.appendChild(externalLink(`${course.name} ↗`, course.officialUrl));
    else links.appendChild(document.createTextNode(`${course.name} (not published yet)`));
  });
  details.appendChild(links);
  return details;
}

function renderChooseView() {
  const { term, plan } = planPage;
  for (const group of term.groups) {
    const section = createElement("section", "card plan-group");
    section.id = `group-${group.id}`;
    const head = createElement("div", "notes-heading");
    head.appendChild(createElement("h3", null, group.label));
    head.appendChild(createElement("span", "schedule-meta", groupRuleText(group)));
    section.appendChild(head);

    const optionalFull = group.kind === "optional" && plan.choices[group.id].length >= (group.max ?? Infinity);
    for (const code of group.courses) {
      const course = courseByCode(term, code);
      let input = null;
      let selected = false;
      if (group.kind === "required") {
        selected = true;
        input = createElement("span", "plan-lock", "🔒");
        input.title = "Required: always part of the plan";
        input.setAttribute("aria-label", "Required course, always selected");
      } else {
        input = createElement("input");
        input.id = `pick-${code}`;
        input.type = group.kind === "choose-one" ? "radio" : "checkbox";
        input.name = `group-${group.id}`;
        selected = group.kind === "choose-one" ? plan.choices[group.id] === code : plan.choices[group.id].includes(code);
        input.checked = selected;
        if (group.kind === "optional" && optionalFull && !selected) input.disabled = true;
        input.addEventListener("change", () => updatePlan((p) => {
          p.choices = applyChoice(term, p.choices, group.id, code, input.checked).choices;
          if (!selectedCourseCodes(term, p.choices).includes(code)) delete p.statuses[code];
        }));
      }
      section.appendChild(courseCard(course, group, input, selected));
    }
    if (group.kind === "optional" && optionalFull && group.courses.length > group.max) {
      section.appendChild(createElement("p", "schedule-meta", `Maximum ${group.max} reached. Untick one to choose another.`));
    }
    if (group.kind === "choose-one") section.appendChild(adviceBox(group));
    planContent.appendChild(section);
  }
  planContent.appendChild(timelineSection());
}

// ----- My Study Plan -----

function renderMyPlanView() {
  const { term, plan } = planPage;
  const summary = planSummary(term, plan.choices);
  const box = createElement("section", "card");
  box.appendChild(createElement("h3", null, "My Study Plan"));
  if (!summary.complete) {
    const missing = summary.groups.filter((g) => !g.satisfied).map((g) => g.label).join(", ");
    const note = createElement("p", "demo-note", `Your plan isn't complete yet: choose ${missing}. `);
    const back = createElement("button", "inline-link", "Go to choices");
    back.type = "button";
    back.addEventListener("click", () => { planPage.view = "choose"; render(); });
    note.appendChild(back);
    box.appendChild(note);
  }

  const codes = selectedCourseCodes(term, plan.choices);
  const counts = { "": 0, studying: 0, booked: 0, passed: 0 };
  for (const code of codes) counts[plan.statuses[code] || ""]++;
  box.appendChild(createElement("p", "student-totals",
    `${codes.length} courses · ${summary.requiredCfu} CFU required${summary.optionalCfu ? ` + ${summary.optionalCfu} CFU optional` : ""} · ` +
    `Studying ${counts.studying} · Exam booked ${counts.booked} · Passed ${counts.passed}`));

  for (const code of codes) {
    const course = courseByCode(term, code);
    box.appendChild(courseCard(course, groupOfCourse(term, code), null, true));
  }

  const back = createElement("button", "button button-light", "View full programme");
  back.type = "button";
  back.addEventListener("click", () => { planPage.view = "choose"; render(); });
  box.appendChild(back);
  planContent.appendChild(box);
  planContent.appendChild(calendarSection(summary));
  planContent.appendChild(timelineSection());
}

// The calendar subscription for exactly this plan (one file per possible plan)
function calendarSection(summary) {
  const box = createElement("section", "card");
  box.appendChild(createElement("h3", null, "📅 My calendar"));
  const key = planKey(planPage.term, planPage.plan.choices);
  const entry = planPage.calendars.find((c) => c.term === planPage.term.id && c.plan === key);
  if (!summary.complete) {
    box.appendChild(createElement("p", "placeholder", "Complete your plan to get a calendar with exactly your courses."));
    return box;
  }
  if (!entry) {
    box.appendChild(createElement("p", "placeholder", "The calendar for this plan isn't available yet. Use the full calendar on the home page for now."));
    return box;
  }
  const httpsUrl = new URL("calendar/" + entry.file, window.location.href).href;
  const webcal = httpsUrl.replace(/^https?:/, "webcal:");
  box.appendChild(createElement("p", null, "Classes, exams and registration deadlines for your courses only. Updated from UniBo every 6 hours."));
  const row = createElement("div", "button-row");
  row.appendChild(externalLink("Google Calendar", "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcal), "button"));
  const apple = createElement("a", "button", "Apple Calendar");
  apple.href = webcal;
  row.appendChild(apple);
  row.appendChild(externalLink("Outlook", "https://outlook.live.com/calendar/0/addfromweb?url=" + encodeURIComponent(httpsUrl) + "&name=" + encodeURIComponent("EU-HEM: my courses"), "button"));
  box.appendChild(row);
  const copy = createElement("input", "plan-calendar-url");
  copy.readOnly = true;
  copy.value = httpsUrl;
  copy.setAttribute("aria-label", "Calendar link for your plan");
  box.appendChild(copy);
  box.appendChild(createElement("p", "schedule-meta",
    "If you change your plan later, subscribe to the new link and remove the old calendar from your app."));
  return box;
}

// ----- Timeline (built from the cycles and the module dates) -----

function timelineSection() {
  const { term, plan } = planPage;
  const box = createElement("section", "card plan-timeline");
  box.appendChild(createElement("h3", null, "Timeline"));
  const start = term.cycles.map((c) => c.start).sort()[0];
  const end = term.cycles.map((c) => c.end).sort().pop();
  const total = daysBetween(start, end) || 1;
  const position = (dateKey) => Math.min(100, Math.max(0, (daysBetween(start, dateKey) / total) * 100));
  const today = todayKey();

  const chart = createElement("div", "timeline-chart");
  // Month labels
  const months = createElement("div", "timeline-row timeline-months");
  months.appendChild(createElement("span", "timeline-label"));
  const monthTrack = createElement("div", "timeline-track");
  const first = new Date(start + "T12:00:00");
  for (let d = new Date(first.getFullYear(), first.getMonth(), 1); dateToKey(d) <= end; d.setMonth(d.getMonth() + 1)) {
    const key = dateToKey(d) < start ? start : dateToKey(d);
    const label = createElement("span", "timeline-month", d.toLocaleDateString("en-GB", { month: "short" }));
    label.style.left = `${position(key)}%`;
    monthTrack.appendChild(label);
  }
  months.appendChild(monthTrack);
  chart.appendChild(months);

  // Cycles
  const cycles = createElement("div", "timeline-row");
  cycles.appendChild(createElement("span", "timeline-label", "Cycles"));
  const cycleTrack = createElement("div", "timeline-track");
  for (const cycle of term.cycles) {
    const bar = createElement("span", "timeline-cycle", cycle.label);
    bar.style.left = `${position(cycle.start)}%`;
    bar.style.width = `${position(cycle.end) - position(cycle.start)}%`;
    bar.title = `${cycle.label}: ${shortDate(cycle.start)} – ${shortDate(cycle.end)}`;
    cycleTrack.appendChild(bar);
  }
  cycles.appendChild(cycleTrack);
  chart.appendChild(cycles);

  // One row per module of the selected courses, in date order
  const modules = selectedCourseCodes(term, plan.choices)
    .map((code) => courseByCode(term, code))
    .flatMap((course) => course.modules.map((module) => ({ course, module })))
    .filter(({ module }) => module.teachingStart && module.teachingEnd)
    .sort((a, b) => a.module.teachingStart.localeCompare(b.module.teachingStart));
  for (const { course, module } of modules) {
    const row = createElement("div", "timeline-row");
    row.appendChild(createElement("span", "timeline-label", module.name));
    const track = createElement("div", "timeline-track");
    const bar = createElement("span", "timeline-bar");
    bar.style.left = `${position(module.teachingStart)}%`;
    bar.style.width = `${Math.max(1.5, position(module.teachingEnd) - position(module.teachingStart))}%`;
    bar.style.setProperty("--course-color", course.color || "var(--color-primary)");
    bar.title = `${module.name}: ${shortDate(module.teachingStart)} – ${shortDate(module.teachingEnd)}`;
    track.appendChild(bar);
    row.appendChild(track);
    chart.appendChild(row);
  }

  // "You are here"
  if (today >= start && today <= end) {
    const marker = createElement("div", "timeline-today");
    marker.style.setProperty("--today", String(position(today))); // a plain number (0-100)
    marker.appendChild(createElement("span", "timeline-today-label", `You are here · ${shortDate(today)}`));
    chart.appendChild(marker);
  }
  box.appendChild(chart);
  if (today < start) box.appendChild(createElement("p", "schedule-meta", `${term.label} starts in ${daysBetween(today, start)} days.`));
  if (today > end) box.appendChild(createElement("p", "schedule-meta", `${term.label} teaching has finished.`));
  box.appendChild(createElement("p", "schedule-meta", "Built automatically from the official cycles and each module's teaching dates."));
  return box;
}

// ----- Summary and page -----

function renderSummary() {
  const summary = planSummary(planPage.term, planPage.plan.choices);
  planSummaryBox.innerHTML = "";
  const percent = Math.round((summary.requiredCfu / summary.requiredTotal) * 100);
  const row = createElement("div", "plan-summary-row");
  row.appendChild(progressBar(percent, `${summary.requiredCfu} of ${summary.requiredTotal} required CFU`));
  row.appendChild(createElement("strong", "plan-cfu",
    `${summary.requiredCfu} / ${summary.requiredTotal} CFU required` + (summary.optionalCfu ? ` + ${summary.optionalCfu} CFU optional` : "")));
  planSummaryBox.appendChild(row);
  const checklist = createElement("div", "plan-checklist");
  for (const group of summary.groups) {
    checklist.appendChild(createElement("span", group.satisfied ? "plan-check is-done" : "plan-check", `${group.satisfied ? "✓" : "○"} ${group.label}`));
  }
  planSummaryBox.appendChild(checklist);
  if (summary.complete) planSummaryBox.appendChild(createElement("p", "plan-complete", "✓ Study plan complete"));
}

function renderViews() {
  const box = document.getElementById("plan-views");
  box.innerHTML = "";
  for (const [key, label] of [["choose", "Choose courses"], ["mine", "My Study Plan"]]) {
    const chip = createElement("button", "filter-chip", label);
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(planPage.view === key));
    chip.addEventListener("click", () => { planPage.view = key; render(); });
    box.appendChild(chip);
  }
}

function render() {
  renderViews();
  renderSummary();
  planContent.innerHTML = "";
  if (planPage.view === "mine") renderMyPlanView();
  else renderChooseView();
}

async function initStudyPlan() {
  try {
    planPage.programme = await loadProgramme();
    planPage.cohort = currentCohort(planPage.programme);
    planPage.term = currentTerm(planPage.programme);
    planPage.plan = loadPlan(planPage.programme);
    if (planPage.plan.saved) planPage.view = "mine";

    const { cohort } = planPage;
    const submission = cohort.studyPlanSubmission || {};
    document.getElementById("plan-submit").href = submission.url || planPage.programme.programme.studentsOnlineUrl;
    const deadline = document.getElementById("plan-deadline");
    deadline.textContent = "Official submission deadline: ";
    if (submission.deadline) deadline.appendChild(createElement("strong", null, formatDay(submission.deadline)));
    else if (submission.noDeadline) {
      // The course states there is no deadline; the note says what the plan is needed for
      deadline.appendChild(createElement("strong", null, "none."));
      if (submission.deadlineNote) deadline.appendChild(document.createTextNode(` ${submission.deadlineNote.replace(/^There is no deadline, but y/, "Y")} `));
      if (submission.deadlineSource) deadline.appendChild(externalLink("Source ↗", submission.deadlineSource));
    } else deadline.appendChild(createElement("strong", "placeholder-text", "⚠ PLACEHOLDER: deadline to be added"));

    const source = document.getElementById("plan-source");
    source.textContent = `Rules for cohort ${cohort.label}. Last checked: ${formatDay(cohort.lastChecked, { day: "numeric", month: "short", year: "numeric" })}. `;
    source.appendChild(externalLink("Official course structure ↗", cohort.sources.structureDiagram));

    // Only semesters that have courses get a tab (just Semester 1 for now)
    const terms = document.getElementById("plan-terms");
    for (const term of cohort.terms.filter((t) => t.courses.length)) {
      const tab = createElement("button", "track-tab", `${term.label}${cohort.terms.length > 1 ? "" : ""}`);
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(term.id === planPage.term.id));
      terms.appendChild(tab);
    }

    document.getElementById("plan-reset").addEventListener("click", () => {
      if (!confirm("Reset your study plan on this device? Your choices and course statuses will be cleared.")) return;
      resetPlan();
      if (typeof toast === "function") toast("Your plan was reset");
      planPage.plan = loadPlan(planPage.programme);
      planPage.view = "choose";
      render();
    });

    try {
      const response = await fetch("calendar/calendars.json");
      if (response.ok) planPage.calendars = await response.json();
    } catch {
      planPage.calendars = [];
    }
    render();
  } catch (error) {
    console.error("Could not load the study plan:", error);
    planContent.appendChild(createElement("p", "placeholder", "Sorry, the study plan could not be loaded right now. Please try again later."));
  }
}

initStudyPlan();
