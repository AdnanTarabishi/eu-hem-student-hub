// ===== Course page =====
// One page for every course: course.html?course=<course-id>
// Tabs: Overview · Schedule · Exam · Topics · Key Concepts · Practice · Resources. A tab with no content is hidden.
// Course facts come from content/programme.json; Schedule and Exam are loaded live from UniBo;
// notes and practice come from content/modules/<module-id>/ (Course -> Module -> Topic).

const coursePage = document.getElementById("course-page");

const page = {
  data: null, course: null, index: 0, notesByTopic: {}, settings: {},
  unibo: "loading", // "loading" | "ready" | "failed"
  sessions: [], exams: [],
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "schedule", label: "Schedule" },
  { key: "exam", label: "Exam" },
  { key: "lectures", label: "Lectures" },
  { key: "topics", label: "Topics" },
  { key: "concepts", label: "Key Concepts" },
  { key: "practice", label: "Practice" },
  { key: "resources", label: "Resources" },
];

const STATUS_LABELS = { "": "Not started", read: "Read", understood: "Understood" };
const STATUS_ICONS = { "": "○", read: "◐", understood: "✓" };

// ----- Navigation inside the page -----

function currentParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

function navigate(params, hash = "") {
  history.pushState(null, "", courseUrl(page.course.id, params) + hash);
  renderPage();
  if (!hash) window.scrollTo(0, 0);
}

// A normal link (so "open in new tab" works) that navigates inside the page on a normal click
function pageLink(text, params, className, hash = "") {
  const link = createElement("a", className, text);
  link.href = courseUrl(page.course.id, params) + hash;
  link.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(params, hash);
  });
  return link;
}

function topicTitle(topicId) {
  const found = topicById(topicId, page.data);
  return found ? found.topic.title : topicId;
}

// Link to a topic: its notes if it has any, otherwise the topic list
function topicLink(topicId, className) {
  const found = topicById(topicId, page.data);
  const title = found ? found.topic.title : topicId;
  if (found && found.course.id !== page.course.id) {
    const link = createElement("a", className, `${found.course.info.name} › ${title}`);
    link.href = itemUrl(topicId, page.data);
    return link;
  }
  return pageLink(title, { tab: "topics", topic: topicId }, className);
}

function hasSampleContent() {
  const c = page.course;
  const items = [...c.flashcards, ...c.questions, ...c.resources, ...conceptsForCourse(c, page.data.concepts)];
  return items.some((item) => item.sample) || Object.values(page.notesByTopic).some((n) => n.meta.sample);
}

function courseSessions() {
  const codes = page.course.modules.map((m) => m.info.code);
  return page.sessions.filter((s) => codes.includes(s.moduleCode));
}

function courseExams() {
  return page.exams.filter((exam) => exam.courseIds.includes(page.course.id));
}

// Tabs with content; Overview is always there. Schedule/Exam show while loading from UniBo.
function availableTabs() {
  const c = page.course;
  const loading = page.unibo === "loading";
  const has = {
    overview: true,
    schedule: loading || courseSessions().length > 0,
    exam: loading || courseExams().length > 0,
    lectures: c.topics.some((t) => t.lecture),
    topics: Object.keys(page.notesByTopic).length > 0,
    concepts: conceptsForCourse(c, page.data.concepts).length > 0,
    practice: c.flashcards.length + c.questions.length > 0,
    resources: c.resources.length > 0,
  };
  return TABS.filter((tab) => has[tab.key]);
}

// Topics with notes, in order: module by module (for the sidebar and Previous/Next)
function topicsWithNotes() {
  return page.course.topics.filter((t) => page.notesByTopic[t.id]);
}

function moduleOfTopic(topicId) {
  return page.course.modules.find((m) => m.id === moduleIdOf(topicId));
}

// ----- Header -----

function renderHeader(tab, tabs) {
  if (page.course.id === "quant-methods" && window.QuantMethods) return QuantMethods.header({ pageLink }, tab, tabs);
  if (page.course.id === "fund-health-econ-management" && window.HealthEconManagement) {
    return HealthEconManagement.header({ pageLink, course: page.course }, tab, tabs);
  }
  const info = page.course.info;
  const term = page.data.term;
  const header = createElement("section", "card course-header");
  header.style.setProperty("--course-color", courseColor(page.course, page.index));

  const titleRow = createElement("div", "notes-heading");
  const titleBox = createElement("div", "course-title-box");
  titleBox.appendChild(courseIcon(info.icon, "course-icon"));
  const title = createElement("h2", null, info.name + (info.integrated ? " (I.C.)" : ""));
  title.appendChild(createElement("span", "course-code", ` ${info.code}`));
  titleBox.appendChild(title);
  titleRow.appendChild(titleBox);
  const actions = createElement("div", "course-actions");
  actions.appendChild(saveButton(page.course.id));
  const create = createElement("a", "button button-light", "✎ Create an item");
  create.href = `create.html?course=${encodeURIComponent(page.course.id)}`;
  actions.appendChild(create);
  actions.appendChild(formButton("Contribute", page.settings.contributeFormUrl, "button contribute-button"));
  titleRow.appendChild(actions);
  header.appendChild(titleRow);

  // Badges: group, CFU, cycle, teaching status, personal progress
  const statusRow = createElement("div", "course-status-row");
  const group = page.course.group;
  if (group) statusRow.appendChild(createElement("span", `plan-badge plan-badge-${group.kind}`, group.badge || group.label));
  statusRow.appendChild(createElement("span", "schedule-meta", `${info.cfu} CFU · cycle ${courseCycles(info)}`));
  const dates = courseDates(info);
  const status = teachingStatus({ teachingStart: dates.start, teachingEnd: dates.end }, todayKey());
  if (status) {
    statusRow.appendChild(createElement("span", `status-badge status-${status.key}`, status.label));
    if (status.detail) statusRow.appendChild(createElement("span", "schedule-meta", status.detail));
  }
  const mine = courseProgress(loadProgress(), page.course);
  if (mine.total) {
    const box = createElement("div", "course-progress");
    box.appendChild(progressBar(mine.percent, `Your progress: ${mine.percent}%`));
    box.appendChild(createElement("span", "schedule-meta",
      `${mine.read + mine.understood} of ${mine.total} topics read · ${mine.understood} understood`));
    statusRow.appendChild(box);
  }
  header.appendChild(statusRow);

  if (hasSampleContent()) {
    header.appendChild(createElement("p", "demo-note", "Sample content — written to test the layout, not real study notes."));
  }

  const tabBar = createElement("div", "track-tabs page-tabs");
  tabBar.setAttribute("role", "tablist");
  for (const t of tabs) {
    const link = pageLink(t.label, { tab: t.key }, "track-tab");
    link.setAttribute("role", "tab");
    link.setAttribute("aria-selected", String(t.key === tab));
    tabBar.appendChild(link);
  }
  header.appendChild(tabBar);
  return header;
}

function renderPage() {
  const params = currentParams();
  const tabs = availableTabs();
  const tab = tabs.some((t) => t.key === params.tab) ? params.tab : "overview";

  coursePage.innerHTML = "";
  const back = createElement("a", "back-link", "← All courses");
  back.href = "notes.html";
  coursePage.appendChild(back);
  coursePage.appendChild(renderHeader(tab, tabs));

  const panel = createElement("section", "card course-panel");
  coursePage.appendChild(panel);
  const custom =
    (page.course.id === "quant-methods" &&
      window.QuantMethods &&
      QuantMethods.render(panel, tab, {
        course: page.course,
        data: page.data,
        pageLink,
        planStatusBox,
      })) ||
    (page.course.id === "fund-health-econ-management" &&
      window.HealthEconManagement &&
      HealthEconManagement.render(panel, tab, {
        course: page.course,
        data: page.data,
        pageLink,
        planStatusBox,
      }));
  if (tab === "overview" && !custom) renderOverview(panel);
  if (tab === "schedule") renderSchedule(panel, params);
  if (tab === "exam") renderExam(panel);
  if (tab === "lectures" && !custom) renderLectures(panel);
  if (tab === "topics") renderTopics(panel, params);
  if (tab === "concepts") renderConcepts(panel);
  if (tab === "practice") renderPractice(panel, { course: page.course, params, topicTitle, topicLink, navigate });
  if (tab === "resources") renderResources(panel);
  highlightTarget();
}

function highlightTarget() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (target) {
    target.classList.add("is-highlighted");
    target.scrollIntoView({ block: "center" });
  }
}

function externalButton(label, url) {
  const link = createElement("a", "button", label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  return link;
}

// ----- Overview -----

function planStatusBox() {
  const box = createElement("div", "plan-status-box");
  const programme = page.data.programme;
  const plan = loadPlan(programme);
  const term = page.data.term;
  const inPlan = selectedCourseCodes(term, plan.choices).includes(page.course.code);
  if (!plan.saved) {
    box.appendChild(document.createTextNode("Planning your semester? "));
    const link = createElement("a", null, "Open the Study Plan →");
    link.href = "studyplan.html";
    box.appendChild(link);
    return box;
  }
  if (!inPlan) {
    box.appendChild(document.createTextNode("Not in your study plan. "));
    const link = createElement("a", null, "Change your plan →");
    link.href = "studyplan.html";
    box.appendChild(link);
    return box;
  }
  box.appendChild(createElement("strong", null, "✓ In your study plan · "));
  const select = createElement("select", "course-status-select");
  select.setAttribute("aria-label", "Your status for this course");
  for (const status of COURSE_STATUSES) select.appendChild(new Option(COURSE_STATUS_LABELS[status], status));
  select.value = plan.statuses[page.course.code] || "";
  select.addEventListener("change", () => {
    const fresh = loadPlan(programme);
    if (select.value) fresh.statuses[page.course.code] = select.value;
    else delete fresh.statuses[page.course.code];
    savePlan(fresh);
  });
  box.appendChild(select);
  return box;
}

function renderOverview(panel) {
  const info = page.course.info;
  panel.appendChild(createElement("h3", null, "Overview"));
  panel.appendChild(planStatusBox());

  const facts = createElement("dl", "course-facts");
  const fact = (label, value) => {
    if (!value) return;
    facts.appendChild(createElement("dt", null, label));
    facts.appendChild(createElement("dd", null, value));
  };
  fact("Code", info.code);
  fact("Credits", `${info.cfu} CFU`);
  if (page.course.group) fact("Study plan group", `${page.course.group.label} · ${page.course.group.badge || ""}`);
  fact("Cycle", courseCycles(info));
  fact("Integrated course", info.integrated ? `Yes: ${info.modules.length} modules, examined together as one course` : "");
  fact("Cohort", page.data.cohort.label);
  panel.appendChild(facts);

  const links = createElement("div", "button-row");
  if (info.officialUrl) links.appendChild(externalButton("Official UniBo page ↗", info.officialUrl));
  links.appendChild(externalButton("Open on Virtuale ↗", info.modules[0].virtualeUrl || page.data.programme.programme.virtualeUrl));
  panel.appendChild(links);
  if (!info.officialUrl) panel.appendChild(createElement("p", "schedule-meta", "The official course page hasn't been published yet."));

  if (page.unibo === "failed") {
    panel.appendChild(createElement("p", "demo-note", "The class schedule and exam dates couldn't be loaded from UniBo right now. Please try again later."));
  }

  for (const module of page.course.modules) {
    const m = module.info;
    const box = createElement("section", "module-box");
    box.appendChild(createElement("h4", null, info.integrated ? `Module: ${m.name} (${m.code})` : `About this course`));
    if (m.description) box.appendChild(createElement("p", null, m.description));
    const mf = createElement("dl", "course-facts");
    const add = (label, value) => {
      if (!value) return;
      mf.appendChild(createElement("dt", null, label));
      mf.appendChild(createElement("dd", null, value));
    };
    add(m.professors.length > 1 ? "Professors" : "Professor", m.professors.join(", "));
    if (info.integrated) add("Credits", `${m.cfu} CFU`);
    add("Teaching period", m.teachingStart && m.teachingEnd
      ? `${formatDay(m.teachingStart, { day: "numeric", month: "short" })} – ${formatDay(m.teachingEnd, { day: "numeric", month: "short", year: "numeric" })} (cycle ${m.cycle})`
      : "");
    add("Assessment", m.assessment);
    box.appendChild(mf);
    if (m.textbooks && m.textbooks.length) {
      box.appendChild(createElement("h5", null, "Textbooks"));
      const list = createElement("ul", "plain-list");
      for (const book of m.textbooks) list.appendChild(createElement("li", null, book));
      box.appendChild(list);
    }
    box.appendChild(createElement("h5", null, "Topics covered"));
    if (module.topics.length === 0) {
      box.appendChild(createElement("p", "placeholder", "The topic list hasn't been published yet."));
    } else {
      const list = createElement("ol", "topic-preview");
      for (const topic of module.topics) {
        const item = createElement("li");
        item.appendChild(page.notesByTopic[topic.id] ? pageLink(topic.title, { tab: "topics", topic: topic.id }) : document.createTextNode(topic.title));
        list.appendChild(item);
      }
      box.appendChild(list);
    }
    if (info.integrated && m.officialUrl) {
      const link = createElement("a", "inline-link", "Official module page ↗");
      link.href = m.officialUrl;
      link.target = "_blank";
      link.rel = "noopener";
      box.appendChild(link);
    }
    panel.appendChild(box);
  }
  panel.appendChild(createElement("p", "schedule-meta",
    "Official slides, recordings and materials are only on Virtuale. This site links to them and never re-uploads them."));
}

// ----- Schedule and Exam (live from UniBo) -----

function renderSchedule(panel, params) {
  panel.appendChild(createElement("h3", null, "Schedule"));
  if (page.unibo === "loading") {
    panel.appendChild(createElement("p", "placeholder", "Loading the timetable from UniBo…"));
    return;
  }
  const showPast = params.past === "1";
  const today = todayKey();
  const all = courseSessions();
  const visible = all.filter((s) => showPast || s.dateKey >= today);
  const bar = createElement("div", "schedule-filters");
  bar.appendChild(pageLink(showPast ? "Hide past classes" : `Show past classes (${all.length - visible.length})`,
    showPast ? { tab: "schedule" } : { tab: "schedule", past: "1" }, "inline-link"));
  panel.appendChild(bar);
  panel.appendChild(createElement("p", "schedule-meta", `${visible.length} class${visible.length === 1 ? "" : "es"} · from the official UniBo timetable`));
  if (visible.length === 0) panel.appendChild(createElement("p", "placeholder", "No upcoming classes. This course's teaching period has ended."));
  else panel.appendChild(scheduleDays(visible, page.data.index, today));
}

function renderExam(panel) {
  panel.appendChild(createElement("h3", null, "Exam"));
  if (page.unibo === "loading") {
    panel.appendChild(createElement("p", "placeholder", "Loading exam dates from UniBo…"));
    return;
  }
  const today = todayKey();
  const exams = courseExams();
  const upcoming = exams.filter((e) => e.dateKey >= today);
  const note = createElement("p", "note", "Register for exams on ");
  const alma = createElement("a", null, "AlmaEsami");
  alma.href = "https://almaesami.unibo.it/almaesami/welcome.htm";
  alma.target = "_blank";
  alma.rel = "noopener";
  note.appendChild(alma);
  note.appendChild(document.createTextNode(" or the myUniBo app. Dates come from the official UniBo exam page."));
  panel.appendChild(note);
  if (upcoming.length === 0) panel.appendChild(createElement("p", "placeholder", "No upcoming exam dates published yet."));
  const list = createElement("div", "exam-list");
  for (const exam of upcoming) list.appendChild(examItem(exam, today));
  panel.appendChild(list);
}

// ----- Topics -----

function renderLectures(panel) {
  panel.appendChild(createElement("h3", null, "Interactive lectures"));
  panel.appendChild(createElement("p", "schedule-meta", "Original study explanations, interactive activities and practice questions. Official slides and assessed-work answers stay on Virtuale."));
  for (const module of page.course.modules) {
    const lectures = module.topics.filter((t) => t.lecture);
    if (!lectures.length) continue;
    if (page.course.modules.length > 1) panel.appendChild(createElement("h4", "module-heading", module.info.name));
    if (module.id === "statistics") {
      const centre = createElement("a", "button", "Statistics Study Centre →");
      centre.href = "statistics.html";
      panel.appendChild(centre);
      panel.appendChild(createElement("p", "schedule-meta", "Review mistakes, plan today's revision, take a timed mock, solve calculations and practise explaining results."));
    }
    const list = createElement("ol", "topic-list");
    for (const topic of lectures) {
      const item = createElement("li", "topic-row");
      const main = createElement("div", "topic-row-main");
      const link = createElement("a", "topic-title", topic.title);
      link.href = lectureUrl(topic.id);
      main.appendChild(link);
      const count = module.questions.filter((q) => q.topic === topic.id && q.type === "mcq").length;
      main.appendChild(createElement("span", "schedule-meta", `Study guide · Interactive activities${count ? ` · ${count} MCQs` : ""}`));
      item.appendChild(main);
      const status = getTopicStatus(loadProgress(), topic.id);
      item.appendChild(createElement("span", `topic-status status-${status || "none"}`, `${STATUS_ICONS[status]} ${STATUS_LABELS[status]}`));
      list.appendChild(item);
    }
    panel.appendChild(list);
    const upcoming = module.topics.filter(t => t.status === "upcoming");
    if (upcoming.length) {
      panel.appendChild(createElement("h4", "module-heading", "Upcoming classes · not taken yet"));
      panel.appendChild(createElement("p", "schedule-meta", "Links supplied for the next sessions. Interactive guides and quizzes will be added after those classes are covered."));
      const upcomingList = createElement("ul", "topic-list");
      for (const topic of upcoming) {
        const item = createElement("li", "topic-row");
        const main = createElement("div", "topic-row-main");
        main.appendChild(createElement("span", "topic-title", topic.title));
        const link = createElement("a", "inline-link", "Open class on Virtuale ↗");
        link.href = topic.virtualeUrl;
        link.target = "_blank";
        link.rel = "noopener";
        main.appendChild(link);
        item.appendChild(main);
        item.appendChild(createElement("span", "schedule-meta", "Upcoming"));
        upcomingList.appendChild(item);
      }
      panel.appendChild(upcomingList);
    }
  }
}

function renderTopics(panel, params) {
  if (params.topic) {
    renderTopicReader(panel, params.topic);
    return;
  }
  const progress = loadProgress();
  panel.appendChild(createElement("h3", null, "Topics"));
  for (const module of page.course.modules) {
    if (page.course.modules.length > 1) panel.appendChild(createElement("h4", "module-heading", `${module.info.name} (${module.info.code})`));
    if (module.topics.length === 0) {
      panel.appendChild(createElement("p", "placeholder", "No topics yet."));
      continue;
    }
    const list = createElement("ol", "topic-list");
    for (const topic of module.topics) {
      const notes = page.notesByTopic[topic.id];
      const item = createElement("li", notes ? "topic-row" : "topic-row is-empty");
      const main = createElement("div", "topic-row-main");
      main.appendChild(notes ? pageLink(topic.title, { tab: "topics", topic: topic.id }, "topic-title") : createElement("span", "topic-title", topic.title));
      const cards = page.course.flashcards.filter((c) => c.topic === topic.id).length;
      const questions = page.course.questions.filter((q) => q.topic === topic.id).length;
      const meta = [notes ? `Notes · ${readingMinutes(notes)} min read` : topic.status === "upcoming" ? "Upcoming · not taken yet" : "No notes yet"];
      if (cards) meta.push(`${cards} flashcard${cards === 1 ? "" : "s"}`);
      if (questions) meta.push(`${questions} question${questions === 1 ? "" : "s"}`);
      main.appendChild(createElement("span", "schedule-meta", meta.join(" · ")));
      item.appendChild(main);
      const side = createElement("div", "topic-row-side");
      if (topic.lecture) {
        const lecture = createElement("a", "inline-link", "Interactive lecture →");
        lecture.href = lectureUrl(topic.id);
        main.appendChild(lecture);
      }
      if (topic.status === "upcoming" && topic.virtualeUrl) {
        const link = createElement("a", "inline-link", "Open class on Virtuale ↗");
        link.href = topic.virtualeUrl;
        link.target = "_blank";
        link.rel = "noopener";
        main.appendChild(link);
      }
      if (notes && notes.meta.sample) side.appendChild(sampleTag());
      if (notes) {
        const status = getTopicStatus(progress, topic.id);
        side.appendChild(createElement("span", `topic-status status-${status || "none"}`, `${STATUS_ICONS[status]} ${STATUS_LABELS[status]}`));
      }
      item.appendChild(side);
      list.appendChild(item);
    }
    panel.appendChild(list);
  }
  const invite = createElement("p", "schedule-meta", "Want to write notes for a topic without notes yet? ");
  invite.appendChild(formButton("Contribute", page.settings.contributeFormUrl, "inline-link"));
  panel.appendChild(invite);
}

function readingMinutes(notes) {
  const words = `${notes.review} ${notes.notes}`.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// Sidebar (wide screens) or dropdown (phones), grouped by module
function topicNavigator(currentId) {
  const progress = loadProgress();
  const nav = createElement("nav", "topic-sidebar");
  nav.setAttribute("aria-label", "Topics");
  nav.appendChild(createElement("h4", null, "Topics"));
  for (const module of page.course.modules) {
    if (page.course.modules.length > 1) nav.appendChild(createElement("p", "sidebar-module", module.info.name));
    const list = createElement("ol");
    for (const topic of module.topics) {
      const item = createElement("li");
      if (page.notesByTopic[topic.id]) {
        const status = getTopicStatus(progress, topic.id);
        const link = pageLink("", { tab: "topics", topic: topic.id }, topic.id === currentId ? "is-current" : "");
        link.appendChild(createElement("span", `topic-status-icon status-${status || "none"}`, STATUS_ICONS[status]));
        link.appendChild(document.createTextNode(topic.title));
        if (topic.id === currentId) link.setAttribute("aria-current", "page");
        item.appendChild(link);
      } else {
        item.appendChild(createElement("span", "is-empty", topic.title));
      }
      list.appendChild(item);
    }
    nav.appendChild(list);
  }
  const select = createElement("select", "topic-jump");
  select.setAttribute("aria-label", "Go to topic");
  for (const topic of topicsWithNotes()) select.appendChild(new Option(topic.title, topic.id));
  select.value = currentId;
  select.addEventListener("change", () => navigate({ tab: "topics", topic: select.value }));
  const jump = createElement("label", "topic-jump-label", "Topic ");
  jump.appendChild(select);
  return { nav, jump };
}

function onThisPage(article) {
  const headings = [...article.querySelectorAll("h2, h3")];
  if (headings.length < 2) return null;
  const box = createElement("nav", "on-this-page");
  box.setAttribute("aria-label", "On this page");
  box.appendChild(createElement("strong", null, "On this page"));
  const list = createElement("ul");
  headings.forEach((heading, i) => {
    heading.id = heading.id || `section-${i + 1}`;
    const link = createElement("a", heading.tagName === "H3" ? "is-sub" : "", heading.textContent);
    link.href = "#" + heading.id;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      heading.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const item = createElement("li");
    item.appendChild(link);
    list.appendChild(item);
  });
  box.appendChild(list);
  return box;
}

function statusButtons(topicId) {
  const box = createElement("div", "status-buttons");
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Your progress on this topic");
  const current = getTopicStatus(loadProgress(), topicId);
  for (const status of TOPIC_STATUSES) {
    const button = createElement("button", `status-button status-${status || "none"}`, `${STATUS_ICONS[status]} ${STATUS_LABELS[status]}`);
    button.type = "button";
    button.setAttribute("aria-pressed", String(status === current));
    button.addEventListener("click", () => {
      setTopicStatus(topicId, status);
      const y = window.scrollY;
      renderPage();
      window.scrollTo(0, y);
    });
    box.appendChild(button);
  }
  return box;
}

function renderTopicReader(panel, topicId) {
  const topic = page.course.topics.find((t) => t.id === topicId);
  panel.classList.add("reader-panel");
  if (!topic) {
    panel.appendChild(pageLink("← All topics", { tab: "topics" }, "back-link"));
    panel.appendChild(createElement("p", "placeholder", "This topic doesn't exist (anymore). Pick one from the list."));
    return;
  }
  const notes = page.notesByTopic[topic.id];
  const module = moduleOfTopic(topic.id);
  if (!notes) {
    panel.appendChild(pageLink("← All topics", { tab: "topics" }, "back-link"));
    panel.appendChild(createElement("h3", null, topic.title));
    panel.appendChild(createElement("p", "placeholder", "No notes for this topic yet."));
    panel.appendChild(formButton("Contribute", page.settings.contributeFormUrl));
    return;
  }

  const { nav, jump } = topicNavigator(topic.id);
  const layout = createElement("div", "reader-layout");
  layout.appendChild(nav);
  const main = createElement("div", "reader-main");
  layout.appendChild(main);
  panel.appendChild(layout);

  main.appendChild(jump);
  if (page.course.modules.length > 1) main.appendChild(createElement("p", "reader-module", `Module: ${module.info.name}`));
  const titleRow = createElement("div", "notes-heading");
  titleRow.appendChild(createElement("h3", "reader-title", topic.title));
  titleRow.appendChild(saveButton(topic.id));
  main.appendChild(titleRow);
  main.appendChild(createElement("p", "schedule-meta reader-meta", `${readingMinutes(notes)} min read`));

  const notice = createElement("div", "notes-disclaimer");
  notice.appendChild(createElement("strong", null, page.settings.disclaimer || "Student-made, may contain errors. Always check the official materials."));
  const meta = [];
  if (notes.meta.updated) meta.push(`Last updated: ${formatDay(notes.meta.updated, { day: "numeric", month: "short", year: "numeric" })}`);
  meta.push(`Author: ${notes.meta.author || "Anonymous"}`);
  const metaLine = createElement("div", "notes-meta", meta.join(" · ") + " · ");
  metaLine.appendChild(formButton("Report an error", page.settings.reportErrorFormUrl, "inline-link"));
  if (notes.meta.sample) metaLine.appendChild(sampleTag());
  notice.appendChild(metaLine);
  main.appendChild(notice);

  if (topic.lecture) {
    const lecture = createElement("a", "button", "Open interactive lecture: notes, activities & MCQs →");
    lecture.href = lectureUrl(topic.id);
    main.appendChild(lecture);
  }

  if (notes.review) {
    const review = createElement("div", "review-box");
    review.appendChild(createElement("h4", null, "5-minute review"));
    const body = createElement("div", "markdown");
    renderNotesInto(body, notes.review, module.folder);
    review.appendChild(body);
    main.appendChild(review);
  }
  const article = createElement("article", "markdown notes-body");
  renderNotesInto(article, notes.notes, module.folder);
  const contents = onThisPage(article);
  if (contents) main.appendChild(contents);
  main.appendChild(article);

  const progressBox = createElement("div", "topic-progress-box");
  progressBox.appendChild(createElement("h4", null, "How well do you know this topic?"));
  progressBox.appendChild(statusButtons(topic.id));
  main.appendChild(progressBox);

  const cards = page.course.flashcards.filter((c) => c.topic === topic.id).length;
  const questions = page.course.questions.filter((q) => q.topic === topic.id).length;
  const concepts = page.data.concepts.filter((c) => (c.topics || []).includes(topic.id));
  if (cards || questions || concepts.length) {
    const more = createElement("div", "topic-extras");
    more.appendChild(createElement("h4", null, "Practise this topic"));
    const row = createElement("div", "button-row");
    if (cards) row.appendChild(pageLink(`${cards} flashcard${cards === 1 ? "" : "s"}`, { tab: "practice", practiceTopic: topic.id }, "button button-light"));
    if (questions) row.appendChild(pageLink(`${questions} question${questions === 1 ? "" : "s"}`, { tab: "practice", practiceTopic: topic.id }, "button button-light", "#question-bank"));
    more.appendChild(row);
    if (concepts.length) {
      const chips = createElement("p", "concept-chips", "Key concepts: ");
      for (const concept of concepts) chips.appendChild(pageLink(concept.term, { tab: "concepts" }, "chip", "#" + concept.id));
      more.appendChild(chips);
    }
    main.appendChild(more);
  }

  const ordered = topicsWithNotes();
  const position = ordered.findIndex((t) => t.id === topic.id);
  const pager = createElement("div", "topic-pager");
  const previous = ordered[position - 1];
  const next = ordered[position + 1];
  pager.appendChild(previous ? pageLink(`◀ ${previous.title}`, { tab: "topics", topic: previous.id }, "pager-link") : createElement("span"));
  pager.appendChild(next ? pageLink(`${next.title} ▶`, { tab: "topics", topic: next.id }, "pager-link is-next") : createElement("span"));
  main.appendChild(pager);
}

// ----- Key Concepts and Resources -----

function renderConcepts(panel) {
  panel.appendChild(createElement("h3", null, "Key Concepts"));
  panel.appendChild(createElement("p", "schedule-meta", "One glossary is shared by all courses. These are the concepts used in this course."));
  const concepts = conceptsForCourse(page.course, page.data.concepts).sort((a, b) => a.term.localeCompare(b.term));
  const list = createElement("div", "concept-list");
  for (const concept of concepts) list.appendChild(conceptCard(concept));
  panel.appendChild(list);
  typesetMath(list);
}

function conceptCard(concept) {
  const card = createElement("div", "concept-card");
  card.id = concept.id;
  const head = createElement("div", "notes-heading");
  const term = createElement("h4", null, concept.term);
  if (concept.sample) term.appendChild(sampleTag());
  head.appendChild(term);
  head.appendChild(saveButton(concept.id));
  card.appendChild(head);
  card.appendChild(renderRichText("p", concept.explanation));
  if (concept.topics && concept.topics.length) {
    const where = createElement("p", "schedule-meta", "Appears in: ");
    concept.topics.forEach((topicId, index) => {
      if (index > 0) where.appendChild(document.createTextNode(", "));
      where.appendChild(topicLink(topicId));
    });
    card.appendChild(where);
  }
  return card;
}

function renderResources(panel) {
  panel.appendChild(createElement("h3", null, "Resources"));
  const list = createElement("div", "resource-list");
  for (const resource of page.course.resources) {
    const card = createElement("div", "resource-card");
    card.id = resource.id;
    const head = createElement("div", "notes-heading");
    const titleBox = createElement("div");
    titleBox.appendChild(createElement("span", "resource-type", resource.type));
    if (resource.sample) titleBox.appendChild(sampleTag());
    const title = createElement(resource.url ? "a" : "span", "resource-title", resource.title);
    if (resource.url) {
      title.href = resource.url;
      title.target = "_blank";
      title.rel = "noopener";
      title.textContent += " ↗";
    }
    titleBox.appendChild(title);
    head.appendChild(titleBox);
    head.appendChild(saveButton(resource.id));
    card.appendChild(head);
    if (resource.description) card.appendChild(createElement("p", null, resource.description));
    const meta = createElement("p", "schedule-meta");
    const parts = [];
    if (resource.contributor) parts.push(`Shared by ${resource.contributor}`);
    if (resource.date) parts.push(formatDay(resource.date, { day: "numeric", month: "short", year: "numeric" }));
    meta.textContent = parts.join(" · ");
    if (resource.topic) {
      if (parts.length) meta.appendChild(document.createTextNode(" · "));
      meta.appendChild(topicLink(resource.topic));
    }
    card.appendChild(meta);
    list.appendChild(card);
  }
  panel.appendChild(list);
}

// ----- Start -----

// Loads the class schedule and exam dates from UniBo, then redraws (keeping the scroll position)
async function loadUniboData() {
  const sources = page.data.cohort.sources;
  const [sessions, exams] = await Promise.allSettled([fetchTimetable(sources.timetableFeed), fetchExams(sources.examDates)]);
  if (sessions.status === "fulfilled") page.sessions = sessions.value;
  if (exams.status === "fulfilled") page.exams = matchExamsToTerm(exams.value, page.data.term);
  page.unibo = sessions.status === "rejected" && exams.status === "rejected" ? "failed" : "ready";
  if (sessions.status === "rejected" || exams.status === "rejected") {
    console.error("UniBo data:", sessions.reason || exams.reason);
  }
  const y = window.scrollY;
  renderPage();
  window.scrollTo(0, y);
}

async function initCoursePage() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("course");
  const showMessage = (text) => {
    coursePage.innerHTML = "";
    const box = createElement("section", "card");
    box.appendChild(createElement("p", null, text));
    const back = createElement("a", null, "← Back to Notes & Resources");
    back.href = "notes.html";
    box.appendChild(back);
    coursePage.appendChild(box);
  };

  if (!requested) return showMessage("No course was chosen.");
  try {
    const publicFiles = new Map();
    const read = async file => { const text = await fetchText(file); if (text !== null) publicFiles.set(file, text); return text; };
    page.data = await loadAll(read);
    page.settings = page.data.settings;
    // Old links used module IDs (e.g. course=fund-health-economics): forward to the course
    let courseId = requested;
    if (!page.data.courses.some((c) => c.id === requested)) {
      const module = page.data.modules.find((m) => m.id === requested);
      if (module) {
        courseId = module.courseId;
        params.set("course", courseId);
        history.replaceState(null, "", "course.html?" + params.toString() + window.location.hash);
      }
    }
    page.index = page.data.courses.findIndex((c) => c.id === courseId);
    page.course = page.data.courses[page.index];
    if (!page.course) return showMessage(`Sorry, we couldn't find the course "${requested}".`);

    for (const module of page.course.modules) {
      const withNotes = module.topics.filter((t) => t.notes);
      const loaded = await Promise.all(withNotes.map((t) => loadNotes(module, t, read)));
      withNotes.forEach((topic, i) => { if (loaded[i]) page.notesByTopic[topic.id] = loaded[i]; });
    }

    document.title = `${page.course.info.name} – EU-HEM Student Hub`;
    if (page.course.id === "quant-methods" && window.QuantMethods) {
      await QuantMethods.prepare(page.course.modules.find((m) => m.id === "statistics"), read);
    }
    if (page.course.id === "fund-health-econ-management" && window.HealthEconManagement) {
      await HealthEconManagement.prepare(
        page.course.modules.find((m) => m.id === "fund-health-economics"),
        read,
      );
    }
    renderPage();
    if (page.course.id === "quant-methods" && window.QuantMethods) QuantMethods.cacheFiles(publicFiles);
    window.addEventListener("popstate", renderPage);
    loadUniboData();
  } catch (error) {
    console.error("Could not load course:", error);
    showMessage("Sorry, this course could not be loaded right now. Please try again later.");
  }
}

initCoursePage();
