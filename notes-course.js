// ===== Course page =====
// One template for every course: course.html?course=<course-id>
// Tabs: Overview · Topics · Key Concepts · Practice · Resources. A tab with no content is hidden.
// The open tab and topic are kept in the address (e.g. &tab=topics&topic=...), so links,
// bookmarks and the browser's Back button all work.

const coursePage = document.getElementById("course-page");

// Everything the page needs, filled in by initCoursePage()
const page = { data: null, course: null, notesByTopic: {}, settings: {} };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "topics", label: "Topics" },
  { key: "concepts", label: "Key Concepts" },
  { key: "practice", label: "Practice" },
  { key: "resources", label: "Resources" },
];

// ----- Navigation inside the page -----

function currentParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

// Goes to another tab/topic without reloading the page, and adds it to the browser history
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

// Markdown -> HTML with the "marked" library. If the library couldn't load,
// show the text as plain paragraphs so the notes are still readable.
function markdownToHtml(markdown) {
  if (typeof marked !== "undefined") return marked.parse(markdown);
  const box = document.createElement("div");
  for (const paragraph of markdown.split(/\n\s*\n/)) {
    box.appendChild(createElement("p", "plain-markdown", paragraph));
  }
  return box.innerHTML;
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
    const link = createElement("a", className, `${found.course.course.title} › ${title}`);
    link.href = itemUrl(topicId, page.data);
    return link;
  }
  return pageLink(title, { tab: "topics", topic: topicId }, className);
}

function hasSampleContent() {
  const c = page.course;
  const items = [...c.flashcards, ...c.questions, ...c.resources, ...conceptsForCourse(c.id, page.data.concepts)];
  return items.some((item) => item.sample) || Object.values(page.notesByTopic).some((n) => n.meta.sample);
}

// Tabs with content; Overview is always there
function availableTabs() {
  const c = page.course;
  const has = {
    overview: true,
    topics: Object.keys(page.notesByTopic).length > 0,
    concepts: conceptsForCourse(c.id, page.data.concepts).length > 0,
    practice: c.flashcards.length + c.questions.length > 0,
    resources: c.resources.length > 0,
  };
  return TABS.filter((tab) => has[tab.key]);
}

// ----- Building the page -----

function renderPage() {
  const params = currentParams();
  const tabs = availableTabs();
  const tab = tabs.some((t) => t.key === params.tab) ? params.tab : "overview";
  const info = page.course.course;

  coursePage.innerHTML = "";

  const back = createElement("a", "back-link", "← All courses");
  back.href = "notes.html";
  coursePage.appendChild(back);

  const header = createElement("section", "card course-header");
  const titleRow = createElement("div", "notes-heading");
  const title = createElement("h2", null, info.title);
  title.appendChild(createElement("span", "course-code", ` ${info.code}`));
  titleRow.appendChild(title);
  const actions = createElement("div", "course-actions");
  actions.appendChild(saveButton(page.course.id));
  actions.appendChild(formButton("Contribute", page.settings.contributeFormUrl, "button contribute-button"));
  titleRow.appendChild(actions);
  header.appendChild(titleRow);

  if (hasSampleContent()) {
    header.appendChild(createElement("p", "demo-note",
      "Sample content — written to test the layout, not real study notes."));
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
  coursePage.appendChild(header);

  const panel = createElement("section", "card course-panel");
  coursePage.appendChild(panel);
  if (tab === "overview") renderOverview(panel);
  if (tab === "topics") renderTopics(panel, params);
  if (tab === "concepts") renderConcepts(panel);
  if (tab === "practice") renderPractice(panel, { course: page.course, params, topicTitle, topicLink, navigate });
  if (tab === "resources") renderResources(panel);

  highlightTarget();
}

// If the address ends with #some-id, scroll to that item and highlight it
function highlightTarget() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (target) {
    target.classList.add("is-highlighted");
    target.scrollIntoView({ block: "center" });
  }
}

function renderOverview(panel) {
  const info = page.course.course;
  panel.appendChild(createElement("h3", null, "Overview"));
  panel.appendChild(createElement("p", null, info.description));

  const facts = createElement("dl", "course-facts");
  const fact = (label, value) => {
    if (!value) return;
    facts.appendChild(createElement("dt", null, label));
    facts.appendChild(createElement("dd", null, value));
  };
  fact(info.professors && info.professors.length > 1 ? "Professors" : "Professor", (info.professors || []).join(", "));
  fact("Credits", info.credits ? `${info.credits} CFU` : "");
  fact("Teaching period", info.teachingPeriod);
  fact("Academic year", info.academicYear);
  fact("Assessment", info.assessment);
  panel.appendChild(facts);

  if (info.textbooks && info.textbooks.length) {
    panel.appendChild(createElement("h4", null, "Textbooks"));
    const list = createElement("ul", "plain-list");
    for (const book of info.textbooks) list.appendChild(createElement("li", null, book));
    panel.appendChild(list);
  }

  panel.appendChild(createElement("h4", null, "Topics covered"));
  if (page.course.topics.length === 0) {
    panel.appendChild(createElement("p", "placeholder", "The topic list hasn't been published yet. Check the official course page."));
  } else {
    const list = createElement("ol", "topic-preview");
    for (const topic of page.course.topics) {
      const item = createElement("li");
      item.appendChild(page.notesByTopic[topic.id]
        ? pageLink(topic.title, { tab: "topics", topic: topic.id })
        : document.createTextNode(topic.title));
      list.appendChild(item);
    }
    panel.appendChild(list);
  }

  const links = createElement("div", "button-row");
  for (const [label, url] of [["Official course page ↗", info.officialUrl], ["Open on Virtuale ↗", info.virtualeUrl]]) {
    if (!url) continue;
    const link = createElement("a", "button", label);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    links.appendChild(link);
  }
  panel.appendChild(links);
  panel.appendChild(createElement("p", "schedule-meta",
    "Official slides, recordings and materials are only on Virtuale. This site links to them and never re-uploads them."));
}

function renderTopics(panel, params) {
  if (params.topic) {
    renderTopicNotes(panel, params.topic);
    return;
  }
  panel.appendChild(createElement("h3", null, "Topics"));
  const list = createElement("ol", "topic-list");
  for (const topic of page.course.topics) {
    const notes = page.notesByTopic[topic.id];
    const item = createElement("li", notes ? "topic-row" : "topic-row is-empty");
    const main = createElement("div", "topic-row-main");
    main.appendChild(notes ? pageLink(topic.title, { tab: "topics", topic: topic.id }, "topic-title")
      : createElement("span", "topic-title", topic.title));

    const cards = page.course.flashcards.filter((c) => c.topic === topic.id).length;
    const questions = page.course.questions.filter((q) => q.topic === topic.id).length;
    const meta = [notes ? "Notes" : "No notes yet"];
    if (cards) meta.push(`${cards} flashcard${cards === 1 ? "" : "s"}`);
    if (questions) meta.push(`${questions} question${questions === 1 ? "" : "s"}`);
    main.appendChild(createElement("span", "schedule-meta", meta.join(" · ")));
    item.appendChild(main);
    if (notes && notes.meta.sample) item.appendChild(sampleTag());
    list.appendChild(item);
  }
  panel.appendChild(list);
  const invite = createElement("p", "schedule-meta", "Want to write notes for a topic without notes yet? ");
  invite.appendChild(formButton("Contribute", page.settings.contributeFormUrl, "inline-link"));
  panel.appendChild(invite);
}

function renderTopicNotes(panel, topicId) {
  const topic = page.course.topics.find((t) => t.id === topicId);
  panel.appendChild(pageLink("← All topics", { tab: "topics" }, "back-link"));
  if (!topic) {
    panel.appendChild(createElement("p", "placeholder", "This topic doesn't exist (anymore). Pick one from the list."));
    return;
  }
  const notes = page.notesByTopic[topic.id];

  const titleRow = createElement("div", "notes-heading");
  titleRow.appendChild(createElement("h3", null, topic.title));
  titleRow.appendChild(saveButton(topic.id));
  panel.appendChild(titleRow);

  if (!notes) {
    panel.appendChild(createElement("p", "placeholder", "No notes for this topic yet."));
    panel.appendChild(formButton("Contribute", page.settings.contributeFormUrl));
    return;
  }

  // Disclaimer, author, date, report link: on every notes page
  const notice = createElement("div", "notes-disclaimer");
  notice.appendChild(createElement("strong", null, page.settings.disclaimer ||
    "Student-made, may contain errors. Always check the official materials."));
  const meta = [];
  if (notes.meta.updated) meta.push(`Last updated: ${formatDay(notes.meta.updated, { day: "numeric", month: "short", year: "numeric" })}`);
  meta.push(`Author: ${notes.meta.author || "Anonymous"}`);
  const metaLine = createElement("div", "notes-meta", meta.join(" · ") + " · ");
  metaLine.appendChild(formButton("Report an error", page.settings.reportErrorFormUrl, "inline-link"));
  if (notes.meta.sample) metaLine.appendChild(sampleTag());
  notice.appendChild(metaLine);
  panel.appendChild(notice);

  if (notes.review) {
    const review = createElement("div", "review-box");
    review.appendChild(createElement("h4", null, "5-minute review"));
    const body = createElement("div", "markdown");
    body.innerHTML = markdownToHtml(notes.review);
    review.appendChild(body);
    panel.appendChild(review);
  }

  // Notes are written by us and checked before publishing, so they are trusted.
  // If notes could ever be submitted directly by visitors, they must be sanitized first.
  const article = createElement("article", "markdown notes-body");
  article.innerHTML = markdownToHtml(notes.notes);
  openExternalLinksInNewTab(article);
  panel.appendChild(article);

  // Practice and concepts for this topic
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
    panel.appendChild(more);
  }
}

function renderConcepts(panel) {
  panel.appendChild(createElement("h3", null, "Key Concepts"));
  panel.appendChild(createElement("p", "schedule-meta", "One glossary is shared by all courses. These are the concepts used in this course."));
  const concepts = conceptsForCourse(page.course.id, page.data.concepts).sort((a, b) => a.term.localeCompare(b.term));
  const list = createElement("div", "concept-list");
  for (const concept of concepts) list.appendChild(conceptCard(concept));
  panel.appendChild(list);
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
  card.appendChild(createElement("p", null, concept.explanation));
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

async function initCoursePage() {
  const courseId = new URLSearchParams(window.location.search).get("course");
  const showMessage = (text) => {
    coursePage.innerHTML = "";
    const box = createElement("section", "card");
    box.appendChild(createElement("p", null, text));
    const back = createElement("a", null, "← Back to Notes & Resources");
    back.href = "notes.html";
    box.appendChild(back);
    coursePage.appendChild(box);
  };

  if (!courseId) return showMessage("No course was chosen.");
  try {
    page.data = await loadAll();
    page.settings = page.data.settings;
    page.course = page.data.courses.find((c) => c.id === courseId);
    if (!page.course) return showMessage(`Sorry, we couldn't find the course "${courseId}".`);

    // Load the notes of every topic that has notes
    const withNotes = page.course.topics.filter((t) => t.notes);
    const loaded = await Promise.all(withNotes.map((t) => loadNotes(page.course, t)));
    withNotes.forEach((topic, i) => {
      if (loaded[i]) page.notesByTopic[topic.id] = loaded[i];
    });

    document.title = `${page.course.course.title} – Notes – EU-HEM Student Hub`;
    renderPage();
    window.addEventListener("popstate", renderPage);
  } catch (error) {
    console.error("Could not load course:", error);
    showMessage("Sorry, this course could not be loaded right now. Please try again later.");
  }
}

initCoursePage();
