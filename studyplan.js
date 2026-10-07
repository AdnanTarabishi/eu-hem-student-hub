// Two-year personal planner. Semester 1 uses the existing shared plan and calendars;
// specialisation choices are separate local drafts, never university registration.
const planPage = { programme: null, cohort: null, term: null, plan: null, tracks: null,
  track: null, draft: null, advice: null, view: "choose", semester: 1, calendars: [], ready: false };
const planContent = document.getElementById("plan-content");
const planSummaryBox = document.getElementById("plan-summary");
const PLAN_VIEW_KEY = "euhem-study-view-v1";
const THESIS_LABELS = { "": "Not started", planning: "Planning", researching: "Researching", writing: "Writing", submitted: "Submitted", completed: "Completed" };

function planToast(message) {
  // A quick sequence of choices needs one current message, especially on phones.
  document.querySelectorAll(".sp-feedback-toast").forEach(item => item.remove());
  toast(message).classList.add("sp-feedback-toast");
}

function s1Courses() { return selectedCourseCodes(planPage.term, planPage.plan.choices).map(code => courseByCode(planPage.term, code)); }
function selectedTrack() { return planPage.tracks ? trackById(planPage.tracks, planPage.track) : null; }
function trackSlice() { return planPage.draft?.tracks[planPage.track] || null; }
function shortDate(key) { return formatDay(key, { day: "numeric", month: "short" }); }
function externalLink(label, url, className = "inline-link") {
  const link = createElement("a", className, label);
  link.href = url; link.target = "_blank"; link.rel = "noopener";
  return link;
}
function saveCaption(success) {
  const box = document.getElementById("sp-save-state");
  box.textContent = success ? "Saved on this device" : "Changes kept in this tab · storage unavailable";
  box.classList.toggle("is-temporary", !success);
}
function saveView() { writeStorage(PLAN_VIEW_KEY, { semester: planPage.semester, view: planPage.view }); }
function saveFuture() { return planPage.draft ? writeStorage(StudyPlanData.DRAFT_KEY, planPage.draft) : true; }
function updatePlan(change, message = "Plan saved on this device") {
  change(planPage.plan);
  const saved = savePlan(planPage.plan);
  planPage.plan.saved = saved;
  let futureSaved = true;
  if (planPage.tracks) {
    const before = JSON.stringify(planPage.draft.tracks.ep?.choices);
    planPage.draft = StudyPlanData.sanitizeDraft(planPage.tracks, planPage.draft, s1Courses());
    if (before !== JSON.stringify(planPage.draft.tracks.ep?.choices)) message = "Semester 1 updated. A repeated later elective was removed from your draft.";
    futureSaved = saveFuture();
  }
  saveCaption(saved && futureSaved);
  render();
  planToast(saved && futureSaved ? message : "Changes are available in this tab; device storage is unavailable.");
}
function updateFuture(change, message = "Journey draft saved") {
  if (!selectedTrack()) return;
  change(trackSlice());
  planPage.draft = StudyPlanData.sanitizeDraft(planPage.tracks, planPage.draft, s1Courses());
  const saved = saveFuture();
  saveCaption(saved); render();
  if (message) planToast(saved ? message : "Changes are available in this tab; device storage is unavailable.");
}

function courseLinks(course) {
  const row = createElement("div", "plan-links");
  const page = createElement("a", "inline-link", "Study resources");
  page.href = `course.html?course=${encodeURIComponent(course.id)}`;
  row.appendChild(page);
  if (course.officialUrl) row.appendChild(externalLink("Official course", course.officialUrl));
  row.appendChild(externalLink("Virtuale", course.modules[0].virtualeUrl || planPage.programme.programme.virtualeUrl));
  return row;
}
function statusSelect(course, future = false) {
  const label = createElement("label", "plan-status", "Progress ");
  const select = createElement("select");
  select.id = `${future ? "future-status" : "status"}-${course.id}`;
  select.setAttribute("aria-label", `Status of ${course.name}`);
  for (const status of COURSE_STATUSES) select.appendChild(new Option(COURSE_STATUS_LABELS[status] || "Not started", status));
  select.value = future ? trackSlice().statuses[course.id] || "" : planPage.plan.statuses[course.code] || "";
  select.addEventListener("change", () => {
    const value = select.value;
    if (future) updateFuture(draft => { if (value) draft.statuses[course.id] = value; else delete draft.statuses[course.id]; });
    else updatePlan(plan => { if (value) plan.statuses[course.code] = value; else delete plan.statuses[course.code]; }, `${course.name}: ${COURSE_STATUS_LABELS[value] || "Not started"}`);
  });
  label.appendChild(select); return label;
}
function courseCard(course, group, input, selected) {
  const card = createElement("article", `plan-course${selected ? " is-selected" : ""}`);
  card.style.setProperty("--course-color", course.color || "var(--color-primary)");
  if (input) card.appendChild(input);
  const body = createElement("div", "plan-course-body");
  const title = createElement(input?.tagName === "INPUT" ? "label" : "h4", "plan-course-title");
  if (input?.id) title.htmlFor = input.id;
  title.append(courseIcon(course.icon, "course-icon small"), createElement("span", null, `${course.name}${course.integrated ? " (I.C.)" : ""}`));
  body.appendChild(title);
  const meta = createElement("div", "plan-course-meta");
  meta.append(createElement("span", `plan-badge plan-badge-${group.kind}`, group.badge || group.label),
    createElement("span", "schedule-meta", `${course.cfu} CFU · ${course.code} · cycle ${courseCycles(course)}`));
  body.appendChild(meta);
  const modules = createElement("ul", "plan-modules");
  for (const module of course.modules) {
    const period = module.teachingStart ? `${shortDate(module.teachingStart)} – ${shortDate(module.teachingEnd)}` : "Dates to confirm";
    const name = course.integrated ? `${module.name} · ${module.cfu} CFU · ` : "";
    modules.appendChild(createElement("li", null, `${name}${module.professors.join(", ")} · ${period}`));
  }
  body.append(modules, courseLinks(course));
  const fit = planPage.advice?.courses[course.id]?.trackFits.find(item => item.trackId === planPage.track);
  if (fit && group.kind !== "required") body.appendChild(createElement("p", "sp-course-fit", `${fit.strength === "strong" ? "Strong connection" : "Useful connection"} · ${selectedTrack().abbr}: ${fit.reason}`));
  if (selected) body.appendChild(statusSelect(course));
  card.appendChild(body); return card;
}
function groupRuleText(group) {
  if (group.kind === "required") return "Included for everyone";
  if (group.kind === "choose-one") return "Choose exactly one";
  return `Optional · choose ${group.min ?? 0} to ${group.max ?? group.courses.length}`;
}
function groupNote(note) {
  const paragraph = createElement("p", "schedule-meta plan-group-note", note.text);
  loadSources().then(sources => paragraph.append(" ", sourceLabel(note.source, sources))).catch(() => {});
  return paragraph;
}
function adviceBox(group) {
  const details = createElement("details", "plan-advice");
  details.id = `advice-${group.id}`;
  details.appendChild(createElement("summary", null, "Student choice guide · connect this choice to your track"));
  if (!planPage.advice) {
    details.appendChild(createElement("p", null, "Choice guidance is unavailable right now. Compare the official course outcomes and discuss your background with the lecturers."));
    return details;
  }
  details.appendChild(createElement("p", "sp-advice-label", "Authored planning guidance · track connections are our interpretation of official course outcomes."));
  const grid = createElement("div", "sp-advice-grid");
  for (const code of group.courses) {
    const course = courseByCode(planPage.term, code), advice = planPage.advice.courses[course.id];
    if (!advice) continue;
    const card = createElement("article", "sp-advice-card");
    card.append(createElement("h4", null, course.name), createElement("p", null, advice.summary));
    const skills = createElement("div", "sp-advice-skills");
    advice.skills.forEach(skill => skills.appendChild(createElement("span", null, skill)));
    card.appendChild(skills);
    const fits = createElement("div", "sp-fit-list");
    for (const fit of advice.trackFits) {
      const track = planPage.tracks ? trackById(planPage.tracks, fit.trackId) : null;
      if (!track) continue;
      const chip = createElement("span", `sp-fit${fit.trackId === planPage.track ? " is-current" : ""}`, `${track.abbr} · ${fit.strength === "strong" ? "strong fit" : "useful"}`);
      chip.dataset.track = fit.trackId; chip.title = fit.reason; fits.appendChild(chip);
    }
    card.appendChild(fits);
    const fit = advice.trackFits.find(item => item.trackId === planPage.track);
    if (fit) card.appendChild(createElement("p", "sp-advice-fit", `For ${selectedTrack().name}: ${fit.reason}`));
    card.appendChild(createElement("p", "sp-advice-tip", advice.decisionTip));
    const sources = createElement("div", "sp-advice-sources");
    for (const id of advice.sources) {
      const source = planPage.advice.sources.find(item => item.id === id);
      if (source) sources.appendChild(externalLink(source.title, source.url));
    }
    card.appendChild(sources); grid.appendChild(card);
  }
  details.appendChild(grid); return details;
}
function renderChooseView() {
  const { term, plan } = planPage;
  const order = ["core", "quant", "elective", "crash"];
  for (const group of [...term.groups].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))) {
    const section = createElement("section", "card plan-group"); section.id = `group-${group.id}`;
    const head = createElement("div", "notes-heading");
    head.append(createElement("h3", null, group.label), createElement("span", "schedule-meta", groupRuleText(group)));
    section.appendChild(head);
    if (group.note) section.appendChild(groupNote(group.note));
    const optionalFull = group.kind === "optional" && plan.choices[group.id].length >= (group.max ?? Infinity);
    for (const code of group.courses) {
      const course = courseByCode(term, code);
      let input, selected;
      if (group.kind === "required") {
        selected = true; input = createElement("span", "plan-lock"); input.appendChild(siteIcon("lock"));
        input.setAttribute("aria-label", "Required course, always selected");
      } else {
        input = createElement("input"); input.id = `pick-${code}`;
        input.type = group.kind === "choose-one" ? "radio" : "checkbox"; input.name = `group-${group.id}`;
        selected = group.kind === "choose-one" ? plan.choices[group.id] === code : plan.choices[group.id].includes(code);
        input.checked = selected;
        if (group.kind === "optional" && optionalFull && !selected) input.disabled = true;
        input.addEventListener("change", () => {
          const checked = input.checked;
          updatePlan(p => {
            p.choices = applyChoice(term, p.choices, group.id, code, checked).choices;
            const codes = selectedCourseCodes(term, p.choices);
            for (const key of Object.keys(p.statuses)) if (!codes.includes(key)) delete p.statuses[key];
          });
        });
      }
      section.appendChild(courseCard(course, group, input, selected));
    }
    if (group.kind !== "required") section.appendChild(adviceBox(group));
    planContent.appendChild(section);
  }
  appendTimeline();
}
function renderMyPlanView() {
  const summary = planSummary(planPage.term, planPage.plan.choices);
  if (!summary.complete) planContent.appendChild(createElement("p", "sp-unknown-note", "Your Semester 1 choices are still open. Choose one quantitative route and one elective to complete the 30-CFU plan."));
  const section = createElement("section", "card plan-group");
  section.appendChild(createElement("h3", null, "Your Semester 1 courses"));
  for (const course of s1Courses()) section.appendChild(courseCard(course, groupOfCourse(planPage.term, course.code), null, true));
  planContent.append(section, calendarSection(summary)); appendTimeline();
}
function appendTimeline() {
  const details = createElement("details", "sp-timeline-disclosure"); details.id = "sp-timeline-disclosure";
  details.append(createElement("summary", null, "Teaching timeline · see how your Semester 1 modules fit together"), timelineSection());
  planContent.appendChild(details);
}

function futureCourseCard(course, selected, required = false) {
  const card = createElement("div", "sp-future-course");
  card.dataset.course = course.id;
  card.appendChild(createElement("h4", null, course.name));
  const label = course.credits === null ? "ECTS to confirm" : `${course.credits} ECTS`;
  card.appendChild(createElement("p", "sp-course-meta", `${label}${course.code ? ` · ${course.code}` : ""}${required ? " · Required" : ""}`));
  const university = planPage.tracks.universities[course.university];
  if (university?.programmePage) {
    const links = createElement("div", "plan-links");
    links.appendChild(externalLink("Host university curriculum", university.programmePage.url)); card.appendChild(links);
    if (course.university === "unibo" && course.creditsSource) links.appendChild(externalLink("2026/27 credit source", planPage.cohort.sources.structureDiagram));
  }
  if (selected) card.appendChild(statusSelect(course, true));
  return card;
}
function chooseFuture(semester, groupIndex, optionIndex, checked) {
  const result = StudyPlanData.applyFutureChoice(planPage.tracks, planPage.track, semester, groupIndex, planPage.draft, optionIndex, checked, s1Courses());
  planPage.draft = result.draft;
  if (result.refused) { render(); planToast(result.reason); return; }
  const saved = saveFuture(); saveCaption(saved); render();
  planToast(saved ? "Specialisation choice saved as a draft" : "Choice kept in this tab; device storage is unavailable.");
}
function renderFutureSemester() {
  const track = selectedTrack();
  if (!track) return renderTrackPrompt();
  const semester = track.semesters.find(s => s.number === planPage.semester);
  const summary = StudyPlanData.semesterSummary(planPage.tracks, track, semester.number, planPage.draft, s1Courses());
  planContent.appendChild(createElement("p", "sp-preview-note", "Curriculum preview for your cohort. These are local planning preferences; confirm final course availability, credits and registration with the host university. Teaching and exam dates follow the host university’s published schedule."));
  if (summary.unknownCredits) planContent.appendChild(createElement("p", "sp-unknown-note", `Individual credits are not stated for ${summary.unknownCredits} selected course${summary.unknownCredits === 1 ? "" : "s"} in the overview. The semester target is 30 ECTS; the known-credit subtotal is not a verified full semester total.`));
  const required = createElement("section", "card sp-future-section");
  required.append(createElement("h3", null, "Core specialisation"), createElement("p", "schedule-meta", "Required for this track"));
  const grid = createElement("div", "sp-course-grid");
  for (const id of semester.required) grid.appendChild(futureCourseCard({ ...planPage.tracks.courses[id], id, credits: planPage.tracks.courses[id].credits ?? null }, true, true));
  required.appendChild(grid); planContent.appendChild(required);
  semester.choices.forEach((choice, groupIndex) => {
    const state = summary.choiceStates[groupIndex];
    const section = createElement("section", "card sp-future-section");
    const head = createElement("div", "notes-heading");
    head.append(createElement("h3", null, `${choice.kind === "complementary" ? "Complementary courses" : "Electives"}${semester.choices.length > 1 ? ` · group ${groupIndex + 1}` : ""}`),
      createElement("span", "sp-choice-state", state.complete === true ? "Choice ready" : state.complete === null ? "Needs confirmation" : "Choose your option"));
    section.append(head, createElement("p", "sp-choice-rule", choice.rule || "Selection rule to confirm with your track coordinator"));
    if (state.ruleModel.kind === "credits") section.appendChild(createElement("p", "schedule-meta", `${state.knownCredits} / ${state.ruleModel.target} EC selected from published credits${state.unknownCredits ? ` · ${state.unknownCredits} course credits to confirm` : ""}`));
    if (state.notice) section.appendChild(createElement("p", "sp-unknown-note", state.notice));
    if (semester.choicesNote) section.appendChild(createElement("p", "schedule-meta", semester.choicesNote));
    const options = createElement("div", "sp-option-grid");
    state.options.forEach(option => {
      const selected = state.selected.includes(option.index);
      if (planPage.view === "mine" && !selected && !option.blocked) return;
      const card = createElement("article", `sp-choice-option${selected ? " is-selected" : ""}${option.blocked ? " is-blocked" : ""}`);
      const input = createElement("input");
      input.type = state.ruleModel.kind === "count" && state.ruleModel.target === 1 ? "radio" : "checkbox";
      input.name = `future-${track.id}-${state.key}`;
      input.id = `future-${track.id}-s${semester.number}-${groupIndex}-${option.index}`;
      const countFull = state.ruleModel.kind === "count" && state.ruleModel.target > 1 && state.selected.length >= state.ruleModel.target;
      const creditFull = state.ruleModel.kind === "credits" && state.knownCredits + option.knownCredits > state.ruleModel.target;
      const limited = !selected && (countFull || creditFull);
      input.checked = selected; input.disabled = option.blocked || limited;
      input.addEventListener("change", () => chooseFuture(semester.number, groupIndex, option.index, input.checked));
      const label = createElement("label", null, option.courses.length > 1 ? `Take this pair · ${option.courses.length} courses together` : "Add to my draft");
      label.htmlFor = input.id;
      const optionHead = createElement("div", "sp-option-heading"); optionHead.append(input, label); card.appendChild(optionHead);
      option.courses.forEach(course => card.appendChild(futureCourseCard(course, selected)));
      option.notes.forEach(note => card.appendChild(createElement("p", "schedule-meta", note)));
      if (option.blocked) card.appendChild(createElement("p", "sp-unknown-note", `${option.reason} Choose another option to avoid repeating it.`));
      else if (limited) card.appendChild(createElement("p", "schedule-meta", "Remove a selected option first to stay within this group’s rule."));
      options.appendChild(card);
    });
    if (planPage.view === "mine" && !state.selected.length) section.appendChild(createElement("p", "schedule-meta", "No preference saved for this group yet. Open Choose courses to compare the options."));
    section.appendChild(options); planContent.appendChild(section);
  });
}
function renderTrackPrompt() {
  const box = createElement("div", "sp-empty");
  box.append(createElement("h3", null, "A direction opens the next chapter."),
    createElement("p", null, "Choose one of the four tracks above to explore its Semester 2 and 3 courses and thesis universities. Your Semester 1 plan stays with you."));
  const button = createElement("button", "button", "Choose a track"); button.type = "button";
  button.addEventListener("click", () => {
    const target = document.querySelector("#sp-track-options button");
    if (target) { target.scrollIntoView({ block: "center", behavior: "smooth" }); target.focus({ preventScroll: true }); }
  });
  box.appendChild(button); planContent.appendChild(box);
}
function renderThesis() {
  const track = selectedTrack();
  if (!track) return renderTrackPrompt();
  const draft = trackSlice();
  const section = createElement("section", "card sp-thesis-card");
  section.append(createElement("p", "section-eyebrow", "Semester 4 · 30 ECTS"), createElement("h3", null, "Turn your questions into a contribution."),
    createElement("p", null, `Your thesis connects to ${track.name}. Plan a host university and a research direction; approval belongs to your supervisor and track committee.`));
  const universities = createElement("div", "sp-thesis-universities");
  for (const id of track.thesis) {
    const university = planPage.tracks.universities[id];
    const label = createElement("label", "sp-thesis-option");
    const input = createElement("input"); input.type = "radio"; input.name = "thesis-university"; input.value = id;
    input.id = `thesis-university-${id}`; input.checked = draft.thesisUniversity === id;
    input.addEventListener("change", () => updateFuture(p => { p.thesisUniversity = id; }));
    label.append(input, createElement("strong", null, university.city), createElement("span", null, university.name)); universities.appendChild(label);
  }
  section.appendChild(universities);
  const grid = createElement("div", "sp-thesis-grid");
  const topic = createElement("label", null, "Research direction · optional");
  const area = createElement("textarea"); area.id = "sp-thesis-topic"; area.maxLength = StudyPlanData.THESIS_TOPIC_MAX;
  area.rows = 3; area.placeholder = "Which healthcare question would you like to investigate?"; area.value = draft.thesisTopic;
  area.addEventListener("change", () => updateFuture(p => { p.thesisTopic = area.value; }, "Research direction saved on this device"));
  topic.appendChild(area); grid.appendChild(topic);
  const status = createElement("label", null, "Thesis progress");
  const select = createElement("select"); select.id = "sp-thesis-status";
  for (const value of StudyPlanData.THESIS_STATUSES) select.appendChild(new Option(THESIS_LABELS[value], value));
  select.value = draft.thesisStatus;
  select.addEventListener("change", () => updateFuture(p => { p.thesisStatus = select.value; }));
  status.appendChild(select); grid.appendChild(status); section.appendChild(grid);
  section.appendChild(createElement("p", "sp-preview-note", "An organisation-based research assignment can support data collection alongside the thesis; it adds no extra ECTS. Discuss feasibility and permission with your supervisor."));
  const resources = createElement("div", "sp-thesis-resources");
  for (const [name, url, description] of [["Thesis Explorer", "thesis.html", "Find research themes, methods and examples."], ["Programme Journey", "journey.html#stage-semester-4", "Understand the programme milestones."], ["University support", "universities.html", "Find the host university’s support and official links."]]) {
    const link = createElement("a", "sp-thesis-resource"); link.href = url;
    link.append(createElement("strong", null, name), createElement("span", null, description)); resources.appendChild(link);
  }
  section.appendChild(resources); planContent.appendChild(section);
}

function calendarSection(summary) {
  const box = createElement("section", "card");
  box.appendChild(createElement("h3", null, "Your Semester 1 calendar"));
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
  const today = NotesSchedule.clock().slice(0, 10);

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


function stat(label, value, note) {
  const box = createElement("div", "sp-stat");
  box.append(createElement("span", "sp-stat-label", label), createElement("strong", "sp-stat-value", String(value)), createElement("small", "sp-stat-note", note));
  return box;
}
function renderSummary() {
  const first = planSummary(planPage.term, planPage.plan.choices);
  const ring = document.getElementById("sp-degree-ring");
  ring.style.setProperty("--sp-progress", Math.round(first.requiredCfu / first.requiredTotal * 100));
  ring.setAttribute("role", "progressbar"); ring.setAttribute("aria-label", "Semester 1 required credits planned");
  ring.setAttribute("aria-valuemin", "0"); ring.setAttribute("aria-valuemax", String(first.requiredTotal)); ring.setAttribute("aria-valuenow", String(first.requiredCfu));
  ring.querySelector(".sp-ring-progress").style.strokeDasharray = `${first.requiredCfu / first.requiredTotal * 100} 100`;
  document.getElementById("sp-ring-value").textContent = `${first.requiredCfu} / ${first.requiredTotal}`;
  planSummaryBox.replaceChildren();
  if (planPage.semester === 1) {
    const passed = s1Courses().filter(c => planPage.plan.statuses[c.code] === "passed" && groupOfCourse(planPage.term, c.code).countsTowardRequired !== false).reduce((sum, c) => sum + c.cfu, 0);
    const open = first.groups.filter(g => !g.satisfied).length;
    planSummaryBox.append(stat("Degree credits planned", `${first.requiredCfu} / ${first.requiredTotal} CFU`, `${first.optionalCfu ? `${first.optionalCfu} optional refresher CFU · ` : ""}Semester 1 target`),
      stat("Degree credits passed", `${passed} CFU`, "From your recorded course statuses"), stat("Choices to make", open, first.complete ? "Semester 1 choices are complete" : "Complete the required choice groups"));
    const checklist = createElement("div", "plan-checklist");
    for (const group of first.groups) {
      const check = createElement("span", group.satisfied ? "plan-check is-done" : "plan-check");
      check.append(group.satisfied ? siteIcon("check") : siteIcon("clock"), document.createTextNode(group.label)); checklist.appendChild(check);
    }
    planSummaryBox.appendChild(checklist);
  } else if (!selectedTrack()) {
    planSummaryBox.append(stat("Semester target", "30 ECTS", "The programme allocates 30 ECTS per semester"), stat("Your direction", "Open", "Choose a track to see the curriculum"), stat("Your journey", "120 ECTS", "Across four semesters · two years"));
  } else if (planPage.semester === 4) {
    const draft = trackSlice();
    planSummaryBox.append(stat("Thesis", "30 ECTS", "Semester 4 degree component"), stat("Host preference", draft.thesisUniversity ? planPage.tracks.universities[draft.thesisUniversity].city : "Choose a host", "One of your track’s two universities"), stat("Your progress", THESIS_LABELS[draft.thesisStatus], "A personal record, not an official result"));
  } else {
    const summary = StudyPlanData.semesterSummary(planPage.tracks, planPage.track, planPage.semester, planPage.draft, s1Courses());
    const ready = summary.choiceStates.filter(s => s.complete === true).length;
    planSummaryBox.append(stat("Semester target", "30 ECTS", "Programme requirement · verify the final course plan"),
      stat("Known course credits", summary.knownCredits === 0 && summary.unknownCredits ? "To confirm" : `${summary.knownCredits} ECTS`, summary.unknownCredits ? `${summary.unknownCredits} selected course credits to confirm` : "Selected courses with published credits"),
      stat("Choice groups ready", `${ready} / ${summary.choiceStates.length}`, summary.choicesComplete === null ? "A rule or credit value needs confirmation" : summary.choicesComplete ? "Your draft choices satisfy the listed rules" : "Continue choosing your specialisation"));
  }
}
function renderJourney() {
  const track = selectedTrack(), first = planSummary(planPage.term, planPage.plan.choices);
  for (const tab of document.querySelectorAll("#plan-terms [data-semester]")) {
    const number = Number(tab.dataset.semester), active = number === planPage.semester;
    tab.setAttribute("aria-selected", String(active)); tab.tabIndex = active ? 0 : -1;
    let city = "Bologna", state = first.complete ? "Choices ready" : "Build your foundations";
    if (number === 2 || number === 3) {
      const semester = track?.semesters.find(s => s.number === number);
      city = semester ? planPage.tracks.universities[semester.university].city : "Choose your direction";
      if (semester) {
        const summary = StudyPlanData.semesterSummary(planPage.tracks, track, number, planPage.draft, s1Courses());
        state = summary.choicesComplete === true ? "Draft choices ready" : summary.choicesComplete === null ? "Confirm the rule" : "Specialisation choices";
      } else state = "Track curriculum";
    } else if (number === 4) {
      city = track ? track.thesis.map(id => planPage.tracks.universities[id].city).join(" / ") : "Your thesis";
      state = track ? "Research at your track’s university" : "Choose a track";
    }
    tab.querySelector(".sp-semester-place").textContent = city;
    tab.querySelector(".sp-semester-state").textContent = state;
  }
  for (const button of document.querySelectorAll("#sp-track-options [data-track]")) button.setAttribute("aria-pressed", String(button.dataset.track === planPage.track));
  document.getElementById("sp-clear-track").hidden = !track;
  if (planPage.tracks) document.getElementById("sp-track-status").textContent = track ? `${track.name} · Bologna → ${trackRoute(planPage.tracks, track)} → Thesis. Your drafts in other tracks are retained.` : "No track preference yet. Semester 1 is shared by everyone; choose a direction when you are ready.";
}
function renderSemesterHeading() {
  const track = selectedTrack(), box = document.getElementById("sp-semester-heading");
  box.replaceChildren();
  const title = planPage.semester === 1 ? "Semester 1 · Shared foundations" : planPage.semester === 4 ? "Semester 4 · Master’s thesis" : `Semester ${planPage.semester} · ${track?.name || "Your specialisation"}`;
  box.appendChild(createElement("h2", null, title));
  if (planPage.semester === 1) box.appendChild(createElement("p", null, "Bologna · September–December 2026 · choose courses, follow progress and connect the foundations to your direction."));
  else box.appendChild(createElement("p", null, planPage.semester === 4 ? "Your final research chapter · personal host preference and thesis planning." : "Future curriculum preview · final timetables, assessments and any catalogue changes come from the host university."));
}
function render() {
  if (!planPage.ready) return;
  const focusId = document.activeElement?.id;
  const openDetails = [...planContent.querySelectorAll("details[open][id]")].map(d => d.id);
  const y = window.scrollY;
  document.querySelectorAll("#plan-views [data-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === planPage.view)));
  document.getElementById("plan-views").hidden = planPage.semester === 4;
  planContent.setAttribute("aria-labelledby", `semester-tab-${planPage.semester}`);
  renderJourney(); renderSummary(); renderSemesterHeading();
  planContent.replaceChildren();
  if (planPage.semester === 1) planPage.view === "mine" ? renderMyPlanView() : renderChooseView();
  else if (planPage.semester === 4) renderThesis();
  else renderFutureSemester();
  for (const id of openDetails) { const details = document.getElementById(id); if (details) details.open = true; }
  const focused = focusId ? document.getElementById(focusId) : null;
  if (focused && !focused.disabled && !focused.closest("[hidden]")) focused.focus({ preventScroll: true });
  window.scrollTo(0, y);
  planContent.setAttribute("aria-busy", "false");
  renderPrintSummary();
}
function setTrack(id) {
  if (!planPage.tracks || (id && !trackById(planPage.tracks, id))) return;
  planPage.track = id || null;
  const saved = saveMyTrack(planPage.tracks.id, id);
  saveCaption(saved); render();
  planToast(saved ? id ? "Track preference saved locally. Your course choices stay yours." : "Exploring without a track preference" : "Track preference kept in this tab; device storage is unavailable.");
}
function buildTrackPicker() {
  const box = document.getElementById("sp-track-options"); box.replaceChildren();
  for (const track of planPage.tracks.tracks) {
    const button = createElement("button", "sp-track-option"); button.type = "button";
    button.id = `sp-track-${track.id}`; button.dataset.track = track.id;
    button.style.setProperty("--track-accent", track.accent);
    button.append(createElement("span", "sp-track-abbr", track.abbr), createElement("strong", "sp-track-name", track.name), createElement("span", "sp-track-route", trackRoute(planPage.tracks, track)));
    button.setAttribute("aria-pressed", String(planPage.track === track.id));
    button.addEventListener("click", () => setTrack(track.id)); box.appendChild(button);
  }
}
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}
async function loadPlannerExtras() {
  const results = await Promise.allSettled([fetchJson(TRACKS_URL), fetchJson("content/study-advice.json"), fetchJson("calendar/calendars.json")]);
  if (results[0].status === "fulfilled") {
    planPage.tracks = tracksCohort(results[0].value);
    planPage.draft = StudyPlanData.sanitizeDraft(planPage.tracks, planPage.draft || readStorage(StudyPlanData.DRAFT_KEY, null), s1Courses());
    const preferred = loadMyTrack();
    if (!planPage.track && preferred?.cohort === planPage.tracks.id && trackById(planPage.tracks, preferred.track)) planPage.track = preferred.track;
    buildTrackPicker();
  } else {
    const status = document.getElementById("sp-track-status");
    status.replaceChildren(document.createTextNode("Track data is unavailable. Your Semester 1 plan remains usable. "));
    status.appendChild(iconButton("Reload track data", "arrow-right", { onClick: loadPlannerExtras }));
  }
  if (results[1].status === "fulfilled") planPage.advice = results[1].value;
  if (results[2].status === "fulfilled") planPage.calendars = results[2].value;
  render();
}
function setupOfficialSources() {
  const cohort = planPage.cohort, submission = cohort.studyPlanSubmission || {};
  document.getElementById("plan-submit").href = submission.url || planPage.programme.programme.studentsOnlineUrl;
  const deadline = document.getElementById("plan-deadline");
  deadline.replaceChildren();
  if (submission.deadline) deadline.textContent = `Official submission deadline: ${formatDay(submission.deadline)}.`;
  else if (submission.noDeadline) deadline.textContent = submission.deadlineNote || "No submission deadline is stated. Fill in your official plan before registering for exams.";
  else deadline.textContent = "Check Studenti Online for the official submission deadline.";
  if (submission.deadlineSource) deadline.append(" ", externalLink("Official submission information", submission.deadlineSource));
  const source = document.getElementById("plan-source");
  source.replaceChildren(document.createTextNode(`Semester 1: official UniBo structure, checked ${shortDate(cohort.lastChecked)}. Semesters 2–4: the 2026 track overview and EU-HEM Student Handbook for cohort 2026–2028. Future offerings may change; missing individual ECTS stay unconfirmed. `));
  source.append(externalLink("Official course structure", cohort.sources.structureDiagram), document.createTextNode(" · "), externalLink("EU-HEM programme", "https://eu-hem.eu/programme/"));
}
async function initStudyPlan() {
  planContent.setAttribute("aria-busy", "true");
  planContent.replaceChildren(skeleton(3, "card"));
  try {
    planPage.programme = await loadProgramme(); planPage.cohort = currentCohort(planPage.programme); planPage.term = currentTerm(planPage.programme);
    planPage.plan = loadPlan(planPage.programme);
    const ui = readStorage(PLAN_VIEW_KEY, null);
    planPage.view = ui?.view === "choose" || ui?.view === "mine" ? ui.view : planPage.plan.saved ? "mine" : "choose";
    planPage.semester = [1, 2, 3, 4].includes(ui?.semester) ? ui.semester : 1;
    setupOfficialSources();
    planPage.ready = true;
    document.getElementById("sp-save-state").textContent = planPage.plan.saved ? "Your saved plan · this device" : "Start your personal plan";
    document.getElementById("sp-print").disabled = false; document.getElementById("sp-tools-button").disabled = false;
    render(); await loadPlannerExtras();
  } catch (error) {
    planPage.ready = false; planContent.setAttribute("aria-busy", "false");
    document.getElementById("sp-save-state").textContent = "Study-plan data unavailable";
    const box = createElement("div", "sp-empty");
    box.append(createElement("h3", null, "Let’s reconnect to your study plan."), createElement("p", null, "The course rules could not be loaded. Your saved choices have not been changed."), iconButton("Retry", "arrow-right", { onClick: initStudyPlan }));
    planContent.replaceChildren(box);
  }
}

// A printable overview includes every semester, irrespective of the open screen.
function renderPrintSummary() {
  const box = document.getElementById("sp-print-summary"); box.replaceChildren();
  box.append(createElement("h1", null, "EU-HEM · My two-year study plan"), createElement("p", null, `Cohort 2026–2028 · 120 ECTS · ${selectedTrack()?.name || "Track not selected"}`));
  const first = createElement("section"); first.appendChild(createElement("h2", null, "Semester 1 · Bologna · 30 degree CFU"));
  const courses = createElement("ul");
  for (const course of s1Courses()) courses.appendChild(createElement("li", null, `${course.name} · ${course.cfu} CFU${groupOfCourse(planPage.term, course.code).countsTowardRequired === false ? " · optional, outside degree credits" : ""} · ${COURSE_STATUS_LABELS[planPage.plan.statuses[course.code] || ""]}`));
  first.appendChild(courses); box.appendChild(first);
  for (const number of [2, 3]) {
    const section = createElement("section"); section.appendChild(createElement("h2", null, `Semester ${number} · 30 ECTS target`));
    if (!selectedTrack()) section.appendChild(createElement("p", null, "Choose a track to see its curriculum."));
    else {
      const summary = StudyPlanData.semesterSummary(planPage.tracks, planPage.track, number, planPage.draft, s1Courses());
      section.appendChild(createElement("p", null, planPage.tracks.universities[summary.university].name));
      const list = createElement("ul");
      for (const course of summary.courses) list.appendChild(createElement("li", null, `${course.name} · ${course.credits === null ? "ECTS to confirm" : `${course.credits} ECTS`} · ${course.required ? "required" : "draft preference"} · ${COURSE_STATUS_LABELS[trackSlice().statuses[course.id] || ""]}`));
      section.appendChild(list);
      for (const choice of summary.choiceStates) if (choice.complete !== true) section.appendChild(createElement("p", null, `${choice.rule || "Selection rule to confirm"}: ${choice.notice || "A choice is still needed."}`));
    }
    box.appendChild(section);
  }
  const thesis = createElement("section"); thesis.appendChild(createElement("h2", null, "Semester 4 · Master’s thesis · 30 ECTS"));
  if (selectedTrack()) {
    const draft = trackSlice();
    thesis.appendChild(createElement("p", null, `Host: ${draft.thesisUniversity ? planPage.tracks.universities[draft.thesisUniversity].name : "Not chosen"} · ${THESIS_LABELS[draft.thesisStatus]}`));
    if (draft.thesisTopic) thesis.appendChild(createElement("p", null, draft.thesisTopic));
  } else thesis.appendChild(createElement("p", null, "At one of your chosen track’s two universities."));
  box.append(thesis, createElement("p", null, "Personal planning record. This does not submit course choices or register exams. Future curriculum and missing credits must be checked with the host university."));
}
function exportPlan() {
  const journey = planPage.draft || readStorage(StudyPlanData.DRAFT_KEY, null);
  const preference = loadMyTrack();
  const data = { format: "euhem-study-plan-backup", version: 1, cohort: planPage.cohort.id, trackCohort: planPage.tracks?.id || journey?.cohort || null,
    track: planPage.track || (!planPage.tracks ? preference?.track || null : null), semester1: { choices: planPage.plan.choices, statuses: planPage.plan.statuses }, journey, exportedAt: new Date().toISOString() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = createElement("a"); link.href = url; link.download = "euhem-study-plan-2026-2028.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importPlan(file) {
  const status = document.getElementById("sp-import-status");
  if (!file) return;
  try {
    if (file.size > 1048576) throw new Error("Choose a study-plan backup smaller than 1 MB.");
    const raw = JSON.parse(await file.text());
    if (raw.trackCohort && !planPage.tracks) throw new Error("Reload the track data before restoring a two-year backup.");
    if (raw.format !== "euhem-study-plan-backup" || raw.version !== 1 || raw.cohort !== planPage.cohort.id || !raw.semester1 ||
      (raw.trackCohort && raw.trackCohort !== planPage.tracks?.id)) throw new Error("This backup does not match the current programme and cohort.");
    const choices = sanitizeChoices(planPage.term, raw.semester1.choices), codes = selectedCourseCodes(planPage.term, choices);
    const statuses = {};
    for (const [code, value] of Object.entries(raw.semester1.statuses || {})) if (codes.includes(code) && COURSE_STATUSES.includes(value) && value) statuses[code] = value;
    planPage.plan = { cohort: planPage.cohort.id, term: planPage.term.id, saved: true, choices, statuses };
    if (planPage.tracks) {
      planPage.draft = StudyPlanData.sanitizeDraft(planPage.tracks, raw.journey, s1Courses());
      planPage.track = trackById(planPage.tracks, raw.track)?.id || null;
    }
    const firstSaved = savePlan(planPage.plan), futureSaved = saveFuture();
    if (planPage.tracks) saveMyTrack(planPage.tracks.id, planPage.track);
    planPage.plan.saved = firstSaved; planPage.view = "mine"; planPage.semester = 1;
    saveCaption(firstSaved && futureSaved); saveView();
    status.textContent = "Backup restored. Your imported choices have been checked against the current rules.";
    document.getElementById("sp-tools-dialog").close(); render(); planToast("Study-plan backup restored");
  } catch (error) {
    status.textContent = `Could not restore this backup. ${error instanceof SyntaxError ? "The file is not valid JSON." : error.message}`;
  }
}
function showPlanTools() {
  let dialog = document.getElementById("sp-tools-dialog");
  if (!dialog) {
    dialog = createElement("dialog", "sp-tools-dialog"); dialog.id = "sp-tools-dialog"; dialog.setAttribute("aria-labelledby", "sp-tools-title");
    dialog.appendChild(iconButton("Close", "close", { iconOnly: true, className: "dialog-close", onClick: () => dialog.close() }));
    const title = createElement("h2", null, "Take your plan with you."); title.id = "sp-tools-title"; dialog.appendChild(title);
    const body = createElement("div", "sp-tools-body");
    body.appendChild(createElement("p", null, "Save a backup to move your course choices, progress and thesis draft to another device. Restoring a backup replaces the personal plan in this browser."));
    const exportButton = iconButton("Export backup", "download", { onClick: exportPlan }); exportButton.id = "sp-export"; body.appendChild(exportButton);
    const label = createElement("label", "sp-portable", "Restore a backup");
    const input = createElement("input"); input.type = "file"; input.accept = ".json,application/json"; input.id = "sp-import";
    input.addEventListener("change", () => { importPlan(input.files[0]); input.value = ""; }); label.appendChild(input); body.appendChild(label);
    const status = createElement("p", "sp-import-status"); status.id = "sp-import-status"; status.setAttribute("role", "status"); body.appendChild(status);
    const reset = iconButton("Reset all plans", "close", { className: "button-danger", onClick: () => {
      if (!confirm("Reset your course choices, progress and thesis drafts on this device? Your track preference will remain.")) return;
      resetPlan();
      try { localStorage.removeItem(StudyPlanData.DRAFT_KEY); } catch { /* The in-tab state still resets. */ }
      planPage.plan = loadPlan(planPage.programme);
      if (planPage.tracks) planPage.draft = StudyPlanData.sanitizeDraft(planPage.tracks, null, s1Courses());
      planPage.semester = 1; planPage.view = "choose"; saveView();
      dialog.close(); document.getElementById("sp-save-state").textContent = "Plan reset · choose your courses"; render(); planToast("Your personal plans were reset");
    } });
    reset.id = "plan-reset";
    const actions = createElement("div", "sp-tools-actions"); actions.appendChild(reset);
    body.appendChild(actions); dialog.appendChild(body);
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }); document.body.appendChild(dialog);
  }
  dialog.showModal();
}

for (const button of document.querySelectorAll("#plan-terms [data-semester]")) button.addEventListener("click", () => {
  planPage.semester = Number(button.dataset.semester); saveView(); render();
});
document.getElementById("plan-terms").addEventListener("keydown", event => {
  const buttons = [...event.currentTarget.querySelectorAll("[data-semester]")], index = buttons.indexOf(document.activeElement);
  if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].focus(); planPage.semester = next + 1; saveView(); render();
});
for (const button of document.querySelectorAll("#plan-views [data-view]")) button.addEventListener("click", () => { planPage.view = button.dataset.view; saveView(); render(); });
document.getElementById("sp-clear-track").addEventListener("click", () => setTrack(null));
document.getElementById("sp-tools-button").addEventListener("click", showPlanTools);
document.getElementById("sp-print").addEventListener("click", () => { renderPrintSummary(); window.print(); });
initStudyPlan();
