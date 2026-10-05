// ===== Tracks page (tracks.html) =====
// Draws every section from content/tracks.json, using the helpers in tracks-data.js.
// Sections: hero, my track, journey, the four track cards, the comparison, the detailed explorer
// (tabs on wide screens, an accordion on phones), careers across tracks, cities, quiz, FAQ and sources.

// tabs: the open section per track, kept when the layout switches between tabs and accordion
const tracksPage = { cohort: null, narrow: null, compareNarrow: null, compareTwo: null, tabs: {} };
const NARROW_QUERY = "(max-width: 640px)";

// ----- Small helpers -----

// A track's colour: the CSS token (--track-eeh …, with lighter dark-mode versions in style.css),
// falling back to the colour in content/tracks.json
function trackAccent(track) {
  return `var(--track-${track.id}, ${track.accent})`;
}

function trackBadge(track) {
  const badge = createElement("span", "track-badge", `${track.letter} · ${track.abbr}`);
  badge.style.setProperty("--track-accent", trackAccent(track));
  return badge;
}

function sectionHead(section, id, title, intro) {
  const head = createElement("div", "section-head");
  const h2 = createElement("h2", "section-title", title);
  h2.id = id;
  head.appendChild(h2);
  if (intro) head.appendChild(createElement("p", "section-sub", intro));
  section.appendChild(head);
  return head;
}

function externalLink(label, url) {
  const a = createElement("a", null, label);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

function cityOf(universityId) {
  return tracksPage.cohort.universities[universityId];
}

// "Health Technology Assessment" (+ credits, + note)
function courseLabel(courseId, note) {
  const course = courseInfo(tracksPage.cohort, courseId);
  const item = createElement("span", "course-name", course.name);
  const extras = [];
  if (typeof course.credits === "number") extras.push(`${course.credits} EC`);
  else if (course.credits === null) extras.push(`credits: ${tracksPage.cohort.texts.notStated}`);
  if (note) extras.push(note);
  if (extras.length) item.appendChild(createElement("span", "course-extra", ` (${extras.join("; ")})`));
  return item;
}

function show(id) {
  document.getElementById(id).hidden = false;
}

// ----- 1. Hero -----

function renderTracksHero() {
  const { texts } = tracksPage.cohort;
  const hero = document.getElementById("tracks-hero");
  hero.appendChild(createElement("p", "hero-badge", texts.hero.badge));
  const h1 = createElement("h1", null, texts.hero.heading);
  h1.id = "tracks-title";
  hero.appendChild(h1);
  hero.appendChild(createElement("p", "tracks-tagline", texts.hero.tagline));
  hero.appendChild(createElement("p", "tracks-hero-text", texts.hero.text));
  // The buttons only appear once their sections exist (My track, Compare)
  const actions = createElement("div", "hero-actions");
  for (const [label, target, primary] of [["Set my track", "my-track", true], ["Compare the tracks", "compare", false]]) {
    if (document.getElementById(target).hidden) continue;
    const a = createElement("a", primary ? "button" : "button button-quiet", label);
    a.href = `#${target}`;
    actions.appendChild(a);
  }
  if (actions.children.length) hero.appendChild(actions);
  hero.appendChild(createElement("p", "tracks-hero-note", texts.hero.note));
  const label = createElement("p", "student-label");
  label.appendChild(siteIcon("info"));
  label.appendChild(document.createTextNode(` ${texts.studentLabel}`));
  hero.appendChild(label);
  show("tracks-hero");
}

// ----- 3. Journey: one foundation, four paths -----

function renderJourney() {
  const c = tracksPage.cohort;
  const section = document.getElementById("journey");
  sectionHead(section, "journey-title", c.texts.journeyHeading);

  const journey = createElement("div", "journey");
  const start = createElement("div", "journey-start");
  start.appendChild(createElement("span", "journey-step-label", "Semester 1 · all students"));
  start.appendChild(createElement("strong", null, cityOf(c.semester1.university).city));
  start.appendChild(createElement("span", null, `${cityOf(c.semester1.university).name}: common foundation`));
  journey.appendChild(start);

  const paths = createElement("ol", "journey-paths");
  paths.setAttribute("aria-label", "The four tracks from Semester 2");
  for (const track of c.tracks) {
    const li = createElement("li", "journey-path");
    li.dataset.track = track.id;
    li.style.setProperty("--track-accent", trackAccent(track));
    const name = createElement("div", "journey-track");
    name.appendChild(trackBadge(track));
    name.appendChild(createElement("strong", null, track.name));
    li.appendChild(name);
    const steps = createElement("div", "journey-steps");
    for (const semester of track.semesters) {
      const step = createElement("div", "journey-step");
      step.appendChild(createElement("span", "journey-step-label", `Semester ${semester.number}`));
      step.appendChild(createElement("strong", null, cityOf(semester.university).city));
      steps.appendChild(step);
    }
    const thesis = createElement("div", "journey-step journey-thesis");
    thesis.appendChild(createElement("span", "journey-step-label", "Semester 4 · thesis"));
    thesis.appendChild(createElement("strong", null, track.thesis.map((u) => cityOf(u).city).join(" or ")));
    steps.appendChild(thesis);
    li.appendChild(steps);
    paths.appendChild(li);
  }
  journey.appendChild(paths);
  section.appendChild(journey);

  if (c.choiceFinal) {
    const callout = createElement("p", "tracks-callout tracks-callout-warning");
    callout.appendChild(siteIcon("alert"));
    callout.appendChild(document.createTextNode(` ${c.texts.finalCallout}`));
    section.appendChild(callout);
  }
  show("journey");
}

// ----- 4. The four track cards -----

function renderTrackCards() {
  const c = tracksPage.cohort;
  const section = document.getElementById("track-cards");
  sectionHead(section, "track-cards-title", "The four tracks");
  const grid = createElement("div", "track-card-grid");
  for (const track of c.tracks) {
    const card = createElement("article", "track-card");
    card.dataset.track = track.id;
    card.style.setProperty("--track-accent", trackAccent(track));
    card.appendChild(trackBadge(track));
    card.appendChild(createElement("h3", null, track.name));
    card.appendChild(createElement("p", "track-question", track.student.question));
    const route = createElement("p", "track-route");
    route.appendChild(siteIcon("route"));
    route.appendChild(document.createTextNode(` ${trackRoute(c, track)}`));
    card.appendChild(route);
    card.appendChild(createElement("p", "track-description", track.student.description));
    const tags = createElement("ul", "track-tags");
    tags.setAttribute("aria-label", "Topics");
    for (const tag of track.student.tags) tags.appendChild(createElement("li", null, tag));
    card.appendChild(tags);
    const more = createElement("a", "button button-light", `Explore ${track.abbr}`);
    more.href = `#track-${track.id}`;
    more.addEventListener("click", () => openTrack(track.id));
    card.appendChild(more);
    grid.appendChild(card);
  }
  section.appendChild(grid);
  show("track-cards");
}

// ----- 6. Detailed explorer -----

const EXPLORER_TABS = [
  ["overview", "Overview"],
  ["courses", "Courses"],
  ["careers", "Careers"],
  ["cities", "Cities"],
  ["fit", "Is it for me?"],
];

function overviewPanel(track) {
  const panel = createElement("div", "explorer-panel-body");
  panel.appendChild(createElement("p", "track-central", track.student.centralQuestion));
  panel.appendChild(createElement("p", null, track.student.overview));
  panel.appendChild(createElement("h3", null, "Key focus areas (official overview)"));
  const focus = createElement("ul", "track-tags");
  for (const area of track.focusAreas) focus.appendChild(createElement("li", null, area));
  panel.appendChild(focus);
  const problem = createElement("div", "typical-problem");
  problem.appendChild(createElement("h3", null, "A typical problem"));
  problem.appendChild(createElement("p", null, track.student.typicalProblem));
  problem.appendChild(createElement("p", "typical-problem-note", tracksPage.cohort.texts.typicalProblemNote));
  panel.appendChild(problem);
  return panel;
}

function coursesPanel(track) {
  const c = tracksPage.cohort;
  const panel = createElement("div", "explorer-panel-body");
  panel.appendChild(createElement("p", "course-context", `Semester 1 · ${cityOf(c.semester1.university).city}: ${c.semester1.summary}`));
  for (const semester of track.semesters) {
    const uni = cityOf(semester.university);
    const block = createElement("div", "course-semester");
    block.appendChild(createElement("h3", null, `Semester ${semester.number} · ${uni.city} · ${uni.name}`));
    block.appendChild(createElement("p", "course-group-label", "Required courses"));
    const required = createElement("ul", "track-course-list");
    for (const id of semester.required) {
      const li = createElement("li");
      li.appendChild(courseLabel(id));
      required.appendChild(li);
    }
    block.appendChild(required);
    for (const choice of semester.choices) {
      const kind = choice.kind === "complementary" ? "Complementary courses" : "Electives";
      const rule = choice.rule || c.texts.notStated;
      const label = createElement("p", "course-group-label", `${kind} · `);
      label.appendChild(createElement("span", choice.rule ? "course-rule" : "course-rule is-unknown",
        choice.rule ? rule : `how many to choose: ${rule}`));
      block.appendChild(label);
      const list = createElement("ul", "track-course-list course-options");
      for (const option of choice.options) {
        const li = createElement("li");
        option.forEach((id, i) => {
          if (i > 0) li.appendChild(createElement("span", "course-plus", " + "));
          li.appendChild(courseLabel(id, choice.notes && choice.notes[id]));
        });
        list.appendChild(li);
      }
      block.appendChild(list);
    }
    if (semester.choicesNote) block.appendChild(createElement("p", "course-note", semester.choicesNote));
    if (uni.programmePage) {
      const more = createElement("p", "course-source");
      more.appendChild(document.createTextNode("Official course information: "));
      more.appendChild(externalLink(uni.programmePage.label, uni.programmePage.url));
      block.appendChild(more);
    }
    panel.appendChild(block);
  }
  const thesis = createElement("div", "course-semester");
  thesis.appendChild(createElement("h3", null, "Semester 4 · Thesis"));
  thesis.appendChild(createElement("p", null, `${c.semester4} For this track: ${track.thesis.map((u) => cityOf(u).city).join(" or ")}.`));
  const past = createElement("a", null, "Browse past thesis topics from earlier cohorts →");
  past.href = "thesis.html";
  thesis.appendChild(past);
  panel.appendChild(thesis);
  for (const page of track.programmePages) {
    const more = createElement("p", "course-source");
    more.appendChild(document.createTextNode("Track page: "));
    more.appendChild(externalLink(page.label, page.url));
    panel.appendChild(more);
  }
  return panel;
}

function careersPanel(track) {
  const panel = createElement("div", "explorer-panel-body");
  panel.appendChild(createElement("h3", null, "Most common sectors after this track (official overview)"));
  const list = createElement("ul", "sector-list");
  for (const sector of track.sectors) list.appendChild(createElement("li", null, sector.label));
  panel.appendChild(list);
  if (track.alsoMentioned.length) {
    panel.appendChild(createElement("p", "course-note", `Also mentioned as relevant: ${track.alsoMentioned.join(", ")}.`));
  }
  panel.appendChild(createElement("p", "course-note",
    "These are sectors where graduates have found work, not a guarantee of any job. Careers overlap across tracks."));
  const link = createElement("a", null, "See how careers overlap across tracks →");
  link.href = "#careers";
  panel.appendChild(link);
  return panel;
}

function citiesPanel(track) {
  const panel = createElement("div", "explorer-panel-body");
  const grid = createElement("div", "track-city-grid");
  for (const semester of track.semesters) {
    const uni = cityOf(semester.university);
    const card = createElement("div", "track-city");
    card.appendChild(createElement("span", "journey-step-label", `Semester ${semester.number}${track.thesis.includes(semester.university) ? " · thesis possible" : ""}`));
    card.appendChild(createElement("strong", null, uni.city));
    card.appendChild(createElement("span", null, `${uni.name}, ${uni.country}`));
    const guide = createElement("a", null, uni.city === "Bologna" ? "Read the City Guide →" : "City Guide (coming soon) →");
    guide.href = uni.guide;
    card.appendChild(guide);
    grid.appendChild(card);
  }
  panel.appendChild(grid);
  return panel;
}

function fitPanel(track) {
  const panel = createElement("div", "explorer-panel-body");
  panel.appendChild(createElement("p", "student-written", "Written by students"));
  const list = createElement("ul", "fit-list");
  for (const line of track.student.fit) {
    const li = createElement("li");
    li.appendChild(siteIcon("check"));
    li.appendChild(document.createTextNode(` ${line}`));
    list.appendChild(li);
  }
  panel.appendChild(list);
  // Quotes from second-year students: shown only when there are some
  const quotes = track.student.secondYearQuotes || [];
  if (quotes.length) {
    const box = createElement("div", "second-year");
    box.appendChild(createElement("h3", null, "From second-year students"));
    for (const quote of quotes) {
      const q = createElement("blockquote", null, quote.text);
      if (quote.by) q.appendChild(createElement("cite", null, quote.by));
      box.appendChild(q);
    }
    panel.appendChild(box);
  }
  return panel;
}

const PANEL_BUILDERS = { overview: overviewPanel, courses: coursesPanel, careers: careersPanel, cities: citiesPanel, fit: fitPanel };

// Wide screens: tabs (arrow keys move between them, like the course pages)
function tabbedBody(track) {
  const box = createElement("div", "explorer-tabs");
  const list = createElement("div", "track-tabs");
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", `${track.name}: sections`);
  const panels = [];
  const select = (key, focus) => {
    tracksPage.tabs[track.id] = key;
    for (const tab of list.children) {
      const on = tab.dataset.key === key;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    }
    for (const panel of panels) panel.hidden = panel.dataset.key !== key;
  };
  EXPLORER_TABS.forEach(([key, label]) => {
    const tab = createElement("button", "track-tab", label);
    tab.type = "button";
    tab.id = `tab-${track.id}-${key}`;
    tab.dataset.key = key;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `panel-${track.id}-${key}`);
    tab.addEventListener("click", () => select(key));
    list.appendChild(tab);
    const panel = createElement("div", "explorer-panel");
    panel.id = `panel-${track.id}-${key}`;
    panel.dataset.key = key;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.tabIndex = 0;
    panel.appendChild(PANEL_BUILDERS[key](track));
    panels.push(panel);
  });
  list.addEventListener("keydown", (event) => {
    const keys = EXPLORER_TABS.map(([k]) => k);
    const current = keys.indexOf(document.activeElement.dataset.key);
    if (current < 0) return;
    const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: keys.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(keys[(next + keys.length) % keys.length], true);
  });
  box.appendChild(list);
  for (const panel of panels) box.appendChild(panel);
  select(tracksPage.tabs[track.id] || "overview");
  return box;
}

// Phones: an accordion (each section opens on its own)
function accordionBody(track) {
  const box = createElement("div", "explorer-accordion");
  const current = tracksPage.tabs[track.id] || "overview";
  EXPLORER_TABS.forEach(([key, label]) => {
    const details = createElement("details", "explorer-fold");
    details.open = key === current;
    details.addEventListener("toggle", () => {
      if (details.open) tracksPage.tabs[track.id] = key;
    });
    details.appendChild(createElement("summary", null, label));
    details.appendChild(PANEL_BUILDERS[key](track));
    box.appendChild(details);
  });
  return box;
}

function renderExplorer() {
  const c = tracksPage.cohort;
  const section = document.getElementById("explorer");
  section.innerHTML = "";
  sectionHead(section, "explorer-title", "Explore each track", "Courses, careers and cities per track. Open a track to see the details.");
  for (const track of c.tracks) {
    const details = createElement("details", "track-detail");
    details.id = `track-${track.id}`;
    details.dataset.track = track.id;
    details.style.setProperty("--track-accent", trackAccent(track));
    const summary = createElement("summary");
    summary.appendChild(trackBadge(track));
    const title = createElement("span", "track-detail-title");
    title.appendChild(createElement("strong", null, track.name));
    title.appendChild(createElement("span", null, trackRoute(c, track)));
    summary.appendChild(title);
    details.appendChild(summary);
    const body = createElement("div", "track-detail-body");
    // The content is built when the track is opened (lighter page)
    details.addEventListener("toggle", () => {
      if (details.open && !body.children.length) body.appendChild(tracksPage.narrow ? accordionBody(track) : tabbedBody(track));
    });
    details.appendChild(body);
    section.appendChild(details);
  }
  show("explorer");
}

// Opens a track in the explorer (track cards, links like tracks.html#track-eeh)
function openTrack(trackId) {
  const details = document.getElementById(`track-${trackId}`);
  if (!details) return;
  details.open = true;
  details.scrollIntoView({ block: "start" });
}

// ----- 2. My track (saved in this browser only) -----

// The saved track, if it exists in this cohort; otherwise null
function myTrack() {
  const saved = loadMyTrack();
  return saved ? trackById(tracksPage.cohort, saved.track) : null;
}

// Marks "my track" everywhere on the page (journey, cards, explorer, comparison)
function highlightMyTrack() {
  const mine = myTrack();
  for (const element of document.querySelectorAll(".tracks [data-track]")) {
    element.classList.toggle("is-mine", !!mine && element.dataset.track === mine.id);
  }
  for (const label of document.querySelectorAll(".mine-label")) label.remove();
  if (!mine) return;
  for (const element of document.querySelectorAll(`.journey-path[data-track="${mine.id}"] .journey-track, .track-card[data-track="${mine.id}"], th[data-track="${mine.id}"]`)) {
    element.appendChild(createElement("span", "mine-label", "Your track"));
  }
}

function semesterSummary(track, semester) {
  const c = tracksPage.cohort;
  const uni = cityOf(semester.university);
  const box = createElement("div", "my-track-semester");
  box.appendChild(createElement("span", "journey-step-label", `Semester ${semester.number}`));
  box.appendChild(createElement("strong", null, uni.city));
  box.appendChild(createElement("span", "tracks-city-uni", uni.name));
  const list = createElement("ul", "track-course-list");
  for (const id of semester.required) list.appendChild(createElement("li", null, courseInfo(c, id).name));
  box.appendChild(list);
  for (const choice of semester.choices) {
    const kind = choice.kind === "complementary" ? "Complementary courses" : "Electives";
    box.appendChild(createElement("p", "course-note", `+ ${kind}: ${choice.rule ? choice.rule.toLowerCase() : `how many to choose is ${c.texts.notStated.toLowerCase()}`} (see Courses below)`));
  }
  return box;
}

function renderMyTrack(editing = false) {
  const c = tracksPage.cohort;
  const section = document.getElementById("my-track");
  section.innerHTML = "";
  sectionHead(section, "my-track-title", "My track");
  const mine = myTrack();

  if (mine && !editing) {
    const card = createElement("div", "my-track-card");
    card.dataset.track = mine.id;
    card.style.setProperty("--track-accent", trackAccent(mine));
    const head = createElement("div", "my-track-head");
    head.appendChild(trackBadge(mine));
    head.appendChild(createElement("h3", null, mine.name));
    const change = createElement("button", "button button-quiet", "Change");
    change.type = "button";
    change.addEventListener("click", () => {
      renderMyTrack(true);
      document.querySelector("#my-track .track-pick")?.focus();
    });
    head.appendChild(change);
    card.appendChild(head);
    const grid = createElement("div", "my-track-grid");
    for (const semester of mine.semesters) grid.appendChild(semesterSummary(mine, semester));
    const thesis = createElement("div", "my-track-semester");
    thesis.appendChild(createElement("span", "journey-step-label", "Semester 4 · thesis"));
    thesis.appendChild(createElement("strong", null, mine.thesis.map((u) => cityOf(u).city).join(" or ")));
    const guides = createElement("ul", "my-track-guides");
    for (const semester of mine.semesters) {
      const uni = cityOf(semester.university);
      const li = createElement("li");
      const a = createElement("a", null, `${uni.city} City Guide${uni.city === "Bologna" ? "" : " (coming soon)"} →`);
      a.href = uni.guide;
      li.appendChild(a);
      guides.appendChild(li);
    }
    thesis.appendChild(guides);
    grid.appendChild(thesis);
    card.appendChild(grid);
    const more = createElement("a", null, `All ${mine.abbr} courses, careers and cities →`);
    more.href = `#track-${mine.id}`;
    more.addEventListener("click", () => openTrack(mine.id));
    card.appendChild(more);
    card.appendChild(createElement("p", "course-note", c.texts.myTrackNote));
    section.appendChild(card);
  } else {
    section.appendChild(createElement("p", "section-sub",
      "Already chose your track? Pick it here to see your own summary, and to have it highlighted on this page."));
    const picker = createElement("div", "track-picker");
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "Choose your track");
    for (const track of c.tracks) {
      const button = createElement("button", "track-pick");
      button.type = "button";
      button.style.setProperty("--track-accent", trackAccent(track));
      button.setAttribute("aria-pressed", String(!!mine && mine.id === track.id));
      button.appendChild(trackBadge(track));
      button.appendChild(createElement("strong", null, track.name));
      button.appendChild(createElement("span", null, trackRoute(c, track)));
      button.addEventListener("click", () => {
        saveMyTrack(c.id, track.id);
        renderMyTrack();
        highlightMyTrack();
        if (typeof toast === "function") toast(`Saved: ${track.abbr} is your track (on this device only) ✓`);
        document.querySelector("#my-track .my-track-card h3")?.focus?.();
      });
      picker.appendChild(button);
    }
    section.appendChild(picker);
    const foot = createElement("div", "my-track-foot");
    foot.appendChild(createElement("p", "course-note", c.texts.myTrackNote));
    if (mine) {
      const cancel = createElement("button", "button button-quiet", "Cancel");
      cancel.type = "button";
      cancel.addEventListener("click", () => renderMyTrack());
      foot.appendChild(cancel);
      const clear = createElement("button", "button button-quiet", "Remove my track");
      clear.type = "button";
      clear.addEventListener("click", () => {
        saveMyTrack(c.id, null);
        renderMyTrack();
        highlightMyTrack();
        if (typeof toast === "function") toast("Your track was removed from this device");
      });
      foot.appendChild(clear);
    }
    section.appendChild(foot);
  }
  show("my-track");
}

// ----- 5. Compare the tracks (factual, from the course tags) -----

const COMPARE_QUERY = "(max-width: 900px)";
const STATUS_MARK = { required: "●", elective: "◐", none: "○" };

function statusBlock(cell) {
  const box = createElement("div", `compare-cell is-${cell.status}`);
  const label = createElement("span", "compare-status");
  label.appendChild(createElement("span", "compare-mark", STATUS_MARK[cell.status]));
  label.lastChild.setAttribute("aria-hidden", "true");
  label.appendChild(document.createTextNode(` ${TRACK_STATUS[cell.status]}`));
  box.appendChild(label);
  const names = [...cell.required, ...cell.elective.map((n) => (cell.status === "required" ? `${n} (elective)` : n))];
  if (names.length) box.appendChild(createElement("span", "compare-courses", names.join("; ")));
  return box;
}

// The extra factual rows: mobility, thesis, most common sectors
function factRows() {
  const c = tracksPage.cohort;
  return [
    ["Mobility", (t) => trackRoute(c, t)],
    ["Thesis", (t) => t.thesis.map((u) => cityOf(u).city).join(" or ")],
    ["Most common sectors", (t) => t.sectors.map((s) => s.label).join("; ")],
  ];
}

function compareLegend() {
  const legend = createElement("ul", "compare-legend");
  legend.setAttribute("aria-label", "Legend");
  for (const status of ["required", "elective", "none"]) {
    const li = createElement("li", `is-${status}`);
    const mark = createElement("span", "compare-mark", STATUS_MARK[status]);
    mark.setAttribute("aria-hidden", "true");
    li.appendChild(mark);
    li.appendChild(document.createTextNode(` ${TRACK_STATUS[status]}`));
    legend.appendChild(li);
  }
  return legend;
}

function compareTable() {
  const c = tracksPage.cohort;
  const wrap = createElement("div", "compare-table-wrap");
  const table = createElement("table", "compare-table");
  table.appendChild(createElement("caption", "visually-hidden", "Comparison of the four tracks by theme"));
  const head = createElement("thead");
  const headRow = createElement("tr");
  headRow.appendChild(createElement("th", null, "Theme"));
  headRow.lastChild.setAttribute("scope", "col");
  for (const track of c.tracks) {
    const th = createElement("th");
    th.setAttribute("scope", "col");
    th.dataset.track = track.id;
    th.style.setProperty("--track-accent", trackAccent(track));
    th.appendChild(trackBadge(track));
    th.appendChild(createElement("span", "compare-track-name", track.name));
    headRow.appendChild(th);
  }
  head.appendChild(headRow);
  table.appendChild(head);
  const body = createElement("tbody");
  for (const theme of c.themes) {
    const row = createElement("tr");
    const th = createElement("th", null, theme.label);
    th.setAttribute("scope", "row");
    row.appendChild(th);
    for (const track of c.tracks) {
      const td = createElement("td");
      td.dataset.track = track.id;
      td.appendChild(statusBlock(themeCell(c, track, theme.id)));
      row.appendChild(td);
    }
    body.appendChild(row);
  }
  for (const [label, value] of factRows()) {
    const row = createElement("tr", "compare-fact");
    const th = createElement("th", null, label);
    th.setAttribute("scope", "row");
    row.appendChild(th);
    for (const track of c.tracks) {
      const td = createElement("td", null, value(track));
      td.dataset.track = track.id;
      row.appendChild(td);
    }
    body.appendChild(row);
  }
  table.appendChild(body);
  wrap.appendChild(table);
  return wrap;
}

// Phones: one card per theme, the four tracks listed underneath
function compareCards() {
  const c = tracksPage.cohort;
  const list = createElement("div", "compare-cards");
  const rows = [
    ...c.themes.map((theme) => [theme.label, (t) => statusBlock(themeCell(c, t, theme.id))]),
    ...factRows().map(([label, value]) => [label, (t) => createElement("span", "compare-courses", value(t))]),
  ];
  for (const [label, render] of rows) {
    const card = createElement("section", "compare-card");
    card.appendChild(createElement("h3", null, label));
    const items = createElement("ul");
    for (const track of c.tracks) {
      const li = createElement("li");
      li.dataset.track = track.id;
      li.appendChild(trackBadge(track));
      li.appendChild(render(track));
      items.appendChild(li);
    }
    card.appendChild(items);
    list.appendChild(card);
  }
  return list;
}

function renderCompare() {
  const c = tracksPage.cohort;
  const section = document.getElementById("compare");
  section.innerHTML = "";
  sectionHead(section, "compare-title", "Compare the tracks", c.texts.compareIntro);
  section.appendChild(createElement("p", "course-note",
    "Built from the official course lists: each course is tagged with the themes it covers, and every cell names the courses behind it."));
  section.appendChild(compareLegend());
  section.appendChild(tracksPage.compareNarrow ? compareCards() : compareTable());
  renderCompareTwo(section);
  renderOverlaps(section);
  show("compare");
}

// ----- Compare two tracks side by side -----

function compareTwoBody(a, b) {
  const c = tracksPage.cohort;
  const box = createElement("div", "compare-two-body");
  if (a.id === b.id) {
    box.appendChild(createElement("p", "course-note", "Pick two different tracks to compare."));
    return box;
  }
  const rows = [
    ["Mobility", (t) => document.createTextNode(trackRoute(c, t))],
    ["Thesis", (t) => document.createTextNode(t.thesis.map((u) => cityOf(u).city).join(" or "))],
    ...requiredSemesterRows(),
    ...c.themes.map((theme) => [theme.label, (t) => statusBlock(themeCell(c, t, theme.id))]),
    ["Most common sectors", (t) => document.createTextNode(t.sectors.map((s) => s.label).join("; "))],
  ];
  const grid = createElement("div", "compare-two-grid");
  grid.appendChild(createElement("span", "compare-two-corner"));
  for (const track of [a, b]) {
    const head = createElement("div", "compare-two-head");
    head.dataset.track = track.id;
    head.style.setProperty("--track-accent", trackAccent(track));
    head.appendChild(trackBadge(track));
    head.appendChild(createElement("strong", null, track.name));
    grid.appendChild(head);
  }
  for (const [label, render] of rows) {
    grid.appendChild(createElement("div", "compare-two-label", label));
    for (const track of [a, b]) {
      const cell = createElement("div", "compare-two-cell");
      cell.dataset.label = label;
      cell.appendChild(render(track));
      grid.appendChild(cell);
    }
  }
  box.appendChild(grid);
  const shared = sharedCourses(c, a, b);
  const cities = sharedCities(c, a, b);
  const note = createElement("p", "compare-two-shared");
  note.appendChild(createElement("strong", null, "In common: "));
  const parts = [];
  if (cities.length) parts.push(cities.map((x) => `${x.city} (Semester ${x.semesterA} for ${a.abbr}, Semester ${x.semesterB} for ${b.abbr})`).join("; "));
  if (shared.length) parts.push(`${shared.length} shared course${shared.length === 1 ? "" : "s"}: ${shared.map((x) => x.name).join("; ")}`);
  note.appendChild(document.createTextNode(parts.length ? parts.join(". ") + "." : "no shared city or course in Semesters 2 and 3."));
  box.appendChild(note);
  return box;
}

// Rows "Semester 2: required" and "Semester 3: required": the city and its required courses
function requiredSemesterRows() {
  const c = tracksPage.cohort;
  return [2, 3].map((n) => [`Semester ${n}: required`, (t) => {
    const semester = t.semesters.find((s) => s.number === n);
    const span = createElement("span");
    span.appendChild(createElement("strong", null, cityOf(semester.university).city));
    span.appendChild(createElement("span", "compare-courses", semester.required.map((id) => courseInfo(c, id).name).join("; ")));
    return span;
  }]);
}

function renderCompareTwo(section) {
  const c = tracksPage.cohort;
  const box = createElement("div", "compare-two");
  box.id = "compare-two";
  box.appendChild(createElement("h3", null, "Compare two tracks"));
  const pickers = createElement("div", "compare-two-pickers");
  const mine = myTrack();
  const first = tracksPage.compareTwo?.[0] || (mine ? mine.id : c.tracks[0].id);
  const second = tracksPage.compareTwo?.[1] || c.tracks.find((t) => t.id !== first).id;
  const selects = [first, second].map((value, i) => {
    const label = createElement("label", null, i === 0 ? "Track 1" : "Track 2");
    const select = createElement("select");
    select.id = `compare-pick-${i + 1}`;
    for (const track of c.tracks) {
      const option = createElement("option", null, `${track.abbr} · ${track.name}`);
      option.value = track.id;
      option.selected = track.id === value;
      select.appendChild(option);
    }
    label.appendChild(select);
    pickers.appendChild(label);
    return select;
  });
  box.appendChild(pickers);
  let body = compareTwoBody(trackById(c, first), trackById(c, second));
  box.appendChild(body);
  const update = () => {
    tracksPage.compareTwo = selects.map((s) => s.value);
    const next = compareTwoBody(trackById(c, selects[0].value), trackById(c, selects[1].value));
    body.replaceWith(next);
    body = next;
  };
  for (const select of selects) select.addEventListener("change", update);
  section.appendChild(box);
}

// Used by the quiz result (step 4): show two tracks side by side
function showCompareTwo(idA, idB) {
  tracksPage.compareTwo = [idA, idB];
  renderCompare();
  highlightMyTrack();
  document.getElementById("compare-two").scrollIntoView({ block: "start" });
}

// ----- What tracks share (computed from the data) -----

function renderOverlaps(section) {
  const c = tracksPage.cohort;
  const box = createElement("div", "track-overlaps");
  box.appendChild(createElement("h3", null, "What tracks share"));
  const list = createElement("ul");
  for (const pair of trackOverlaps(c)) {
    const li = createElement("li", "overlap-item");
    const head = createElement("div", "overlap-head");
    head.appendChild(trackBadge(pair.a));
    head.appendChild(createElement("span", null, "+"));
    head.appendChild(trackBadge(pair.b));
    li.appendChild(head);
    const facts = createElement("ul", "overlap-facts");
    for (const city of pair.cities) {
      facts.appendChild(createElement("li", null, city.semesterA === city.semesterB
        ? `Both spend Semester ${city.semesterA} in ${city.city}.`
        : `Both include ${city.city}: Semester ${city.semesterA} for ${pair.a.abbr}, Semester ${city.semesterB} for ${pair.b.abbr}.`));
    }
    if (pair.courses.length) {
      facts.appendChild(createElement("li", null,
        `${pair.courses.length === 1 ? "Shared course" : `${pair.courses.length} shared courses`}: ${pair.courses.map((x) => x.name).join("; ")}.`));
    }
    li.appendChild(facts);
    list.appendChild(li);
  }
  box.appendChild(list);
  box.appendChild(createElement("p", "course-note",
    "A shared course means the same course at the same university appears in both tracks (as a required course or an option)."));
  section.appendChild(box);
}

// ----- 7. Careers across tracks -----

function renderCareers() {
  const c = tracksPage.cohort;
  const section = document.getElementById("careers");
  sectionHead(section, "careers-title", c.texts.careerHeading);
  section.appendChild(createElement("p", "careers-text", c.texts.careerText));

  const table = createElement("ul", "sector-overlap");
  table.setAttribute("aria-label", "Most common sectors, and which tracks name them");
  for (const group of c.sectorGroups) {
    const tracks = c.tracks.filter((t) => t.sectors.some((s) => s.group === group.id));
    if (!tracks.length) continue;
    const row = createElement("li", "sector-row");
    const name = createElement("div", "sector-name");
    name.appendChild(createElement("strong", null, group.label));
    name.appendChild(createElement("span", null, `${tracks.length} of ${c.tracks.length} tracks`));
    row.appendChild(name);
    const chips = createElement("div", "sector-tracks");
    for (const track of c.tracks) {
      const listed = tracks.includes(track);
      const chip = createElement("span", listed ? "sector-chip is-listed" : "sector-chip", track.abbr);
      chip.style.setProperty("--track-accent", trackAccent(track));
      if (!listed) chip.setAttribute("aria-hidden", "true");
      chips.appendChild(chip);
    }
    chips.appendChild(createElement("span", "visually-hidden", `Most common for: ${tracks.map((t) => t.abbr).join(", ")}`));
    row.appendChild(chips);
    table.appendChild(row);
  }
  section.appendChild(table);
  section.appendChild(createElement("p", "course-note",
    "From each track's “most common sectors” in the official overview, grouped by students. The exact wording per track is in the explorer above."));
  const all = createElement("p", "course-note", `Across all tracks, the official overview lists: ${c.sectorsAllTracks.join("; ")}.`);
  section.appendChild(all);
  show("careers");
}

// ----- 8. Cities -----

function renderCities() {
  const c = tracksPage.cohort;
  const section = document.getElementById("cities");
  sectionHead(section, "cities-title", "Your track is also a journey", "Where each track spends Semesters 2 and 3.");
  const grid = createElement("div", "tracks-city-cards");
  for (const id of ["unibo", "uio", "mci", "eur"]) {
    const uni = c.universities[id];
    const card = createElement("article", "tracks-city-card");
    card.appendChild(createElement("span", "city-country", uni.country));
    card.appendChild(createElement("h3", null, uni.city));
    card.appendChild(createElement("p", "tracks-city-uni", uni.name));
    const list = createElement("ul", "city-presence");
    if (c.semester1.university === id) list.appendChild(createElement("li", null, "Semester 1: everyone"));
    const presence = cityPresence(c, id);
    for (const number of [2, 3]) {
      const here = presence.filter((p) => p.semester === number);
      if (here.length) list.appendChild(createElement("li", null, `Semester ${number}: ${here.map((p) => p.track.abbr).join(", ")}`));
    }
    const thesis = c.tracks.filter((t) => t.thesis.includes(id));
    if (thesis.length) list.appendChild(createElement("li", null, `Thesis possible: ${thesis.map((t) => t.abbr).join(", ")}`));
    card.appendChild(list);
    const guide = createElement("a", null, id === "unibo" ? "Read the City Guide →" : "City Guide (coming soon) →");
    guide.href = uni.guide;
    card.appendChild(guide);
    grid.appendChild(card);
  }
  section.appendChild(grid);
  const all = createElement("a", "button", "Explore the City Guides");
  all.href = "city-guide.html";
  section.appendChild(all);
  show("cities");
}

// ----- 9. Quiz "Which track fits you?" -----
// One question at a time, answers shuffled every time, nothing saved or sent anywhere.

const quizState = { index: 0, answers: [] };

function quizBox() {
  return document.getElementById("quiz-box");
}

function renderQuiz() {
  const c = tracksPage.cohort;
  const section = document.getElementById("quiz");
  sectionHead(section, "quiz-title", "Which track fits you?");
  const label = createElement("p", "student-label");
  label.appendChild(siteIcon("info"));
  label.appendChild(document.createTextNode(` ${c.texts.quizLabel}`));
  section.appendChild(label);
  const box = createElement("div", "quiz-box");
  box.id = "quiz-box";
  section.appendChild(box);
  quizIntro();
  show("quiz");
}

function quizIntro() {
  const c = tracksPage.cohort;
  const box = quizBox();
  box.innerHTML = "";
  box.appendChild(createElement("p", "quiz-intro",
    `${c.quiz.questions.length} short questions, one at a time. Nothing is saved or sent anywhere.`));
  const start = createElement("button", "button", "Start the quiz");
  start.type = "button";
  start.addEventListener("click", () => {
    quizState.index = 0;
    quizState.answers = [];
    quizQuestion();
  });
  box.appendChild(start);
}

function quizQuestion() {
  const c = tracksPage.cohort;
  const { questions } = c.quiz;
  const question = questions[quizState.index];
  const box = quizBox();
  box.innerHTML = "";

  const progress = createElement("div", "quiz-progress");
  const count = createElement("span", "quiz-count", `Question ${quizState.index + 1} of ${questions.length}`);
  progress.appendChild(count);
  progress.appendChild(progressBar(Math.round((quizState.index / questions.length) * 100), `${quizState.index} of ${questions.length} questions answered`));
  box.appendChild(progress);

  const title = createElement("h3", "quiz-question", question.text);
  title.tabIndex = -1; // receives focus, so screen readers read the new question
  box.appendChild(title);

  const list = createElement("div", "quiz-answers");
  list.setAttribute("role", "group");
  list.setAttribute("aria-label", question.text);
  const chosen = quizState.answers[quizState.index];
  for (const answer of shuffled(question.answers)) {
    const button = createElement("button", "quiz-answer", answer.text);
    button.type = "button";
    if (answer === chosen) button.setAttribute("aria-pressed", "true");
    button.addEventListener("click", () => {
      quizState.answers[quizState.index] = answer;
      if (quizState.index + 1 < questions.length) {
        quizState.index++;
        quizQuestion();
      } else {
        quizResult();
      }
    });
    list.appendChild(button);
  }
  // Arrow keys move between answers (Tab works too)
  list.addEventListener("keydown", (event) => {
    const buttons = [...list.children];
    const at = buttons.indexOf(document.activeElement);
    if (at < 0) return;
    const next = { ArrowDown: at + 1, ArrowRight: at + 1, ArrowUp: at - 1, ArrowLeft: at - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    buttons[(next + buttons.length) % buttons.length].focus();
  });
  box.appendChild(list);

  if (quizState.index > 0) {
    const back = createElement("button", "button button-quiet quiz-back", "← Back");
    back.type = "button";
    back.addEventListener("click", () => {
      quizState.index--;
      quizQuestion();
    });
    box.appendChild(back);
  }
  title.focus({ preventScroll: true });
  box.scrollIntoView({ block: "nearest" });
}

function quizResult() {
  const c = tracksPage.cohort;
  const box = quizBox();
  box.innerHTML = "";
  const ranked = rankTracks(c, quizScores(c, quizState.answers));
  const max = c.quiz.maxScore;

  const title = createElement("h3", "quiz-question", "Your result");
  title.tabIndex = -1;
  box.appendChild(title);

  // All four tracks as labelled bars, not just a winner
  const bars = createElement("ul", "quiz-bars");
  bars.setAttribute("aria-label", "Points per track");
  for (const { track, score } of ranked) {
    const li = createElement("li", "quiz-bar-row");
    li.style.setProperty("--track-accent", trackAccent(track));
    const name = createElement("div", "quiz-bar-label");
    name.appendChild(trackBadge(track));
    name.appendChild(createElement("span", null, track.name));
    li.appendChild(name);
    const bar = createElement("div", "quiz-bar");
    bar.setAttribute("aria-hidden", "true");
    const fill = createElement("span");
    fill.style.width = `${Math.round((score / max) * 100)}%`;
    bar.appendChild(fill);
    li.appendChild(bar);
    li.appendChild(createElement("span", "quiz-bar-score", `${score} of ${max} points`));
    bars.appendChild(li);
  }
  box.appendChild(bars);

  if (isCloseMatch(ranked, c.quiz.closeMatchPoints)) {
    box.appendChild(createElement("p", "tracks-callout quiz-close", c.texts.quizCloseMatch));
  }

  // The top two, each with one sentence and a way to explore it
  const top = createElement("div", "quiz-top");
  ranked.slice(0, 2).forEach(({ track }, i) => {
    const card = createElement("div", "quiz-top-card");
    card.style.setProperty("--track-accent", trackAccent(track));
    card.appendChild(createElement("span", "journey-step-label", i === 0 ? "Closest match" : "Second closest"));
    const head = createElement("div", "quiz-top-head");
    head.appendChild(trackBadge(track));
    head.appendChild(createElement("strong", null, track.name));
    card.appendChild(head);
    card.appendChild(createElement("p", null, c.texts.quizResultSentence.replace("{centralQuestion}", track.student.centralQuestion)));
    const explore = createElement("a", "button button-light", `Explore ${track.abbr}`);
    explore.href = `#track-${track.id}`;
    explore.addEventListener("click", () => openTrack(track.id));
    card.appendChild(explore);
    top.appendChild(card);
  });
  box.appendChild(top);

  const actions = createElement("div", "quiz-actions");
  const compare = createElement("button", "button", `Compare ${ranked[0].track.abbr} and ${ranked[1].track.abbr} side by side`);
  compare.type = "button";
  compare.addEventListener("click", () => showCompareTwo(ranked[0].track.id, ranked[1].track.id));
  actions.appendChild(compare);
  const retake = createElement("button", "button button-quiet", "Retake");
  retake.type = "button";
  retake.addEventListener("click", () => {
    quizState.index = 0;
    quizState.answers = [];
    quizQuestion();
  });
  actions.appendChild(retake);
  box.appendChild(actions);
  box.appendChild(createElement("p", "quiz-advice", c.texts.quizAdvice));
  title.focus({ preventScroll: true });
  box.scrollIntoView({ block: "nearest" });
}

// ----- 10. FAQ -----

function renderFaq() {
  const c = tracksPage.cohort;
  const section = document.getElementById("faq");
  sectionHead(section, "faq-title", "Questions");
  for (const item of c.faq) {
    const details = createElement("details", "faq-item");
    const summary = createElement("summary", null, item.q);
    if (item.audience === "future") summary.appendChild(createElement("span", "faq-audience", "For future students"));
    details.appendChild(summary);
    details.appendChild(createElement("p", null, item.a));
    section.appendChild(details);
  }
  show("faq");
}

// ----- 11. Sources -----

function renderSources() {
  const c = tracksPage.cohort;
  const section = document.getElementById("sources");
  sectionHead(section, "sources-title", "Sources & verification");
  const list = createElement("ul", "sources-list");
  list.appendChild(createElement("li", null, c.sources.official));
  for (const page of c.sources.pages) {
    const li = createElement("li");
    li.appendChild(externalLink(page.label, page.url));
    list.appendChild(li);
  }
  section.appendChild(list);
  section.appendChild(createElement("p", "course-note", `Last reviewed: ${c.lastReviewed}`));
  section.appendChild(createElement("p", "course-note", c.texts.sourcesDisclaimer));
  show("sources");
}

// ----- Start -----

async function initTracksPage() {
  const status = document.getElementById("tracks-status");
  try {
    const file = await loadTracksFile();
    tracksPage.cohort = tracksCohort(file);
    const media = window.matchMedia(NARROW_QUERY);
    tracksPage.narrow = media.matches;
    tracksPage.compareNarrow = window.matchMedia(COMPARE_QUERY).matches;
    renderMyTrack();
    renderJourney();
    renderTrackCards();
    renderCompare();
    renderExplorer();
    renderCareers();
    renderCities();
    renderQuiz();
    renderFaq();
    renderSources();
    renderTracksHero(); // last: its buttons depend on which sections exist
    highlightMyTrack();
    status.remove();
    // The comparison is a table on wide screens and cards on phones
    window.matchMedia(COMPARE_QUERY).addEventListener("change", (event) => {
      tracksPage.compareNarrow = event.matches;
      renderCompare();
      highlightMyTrack();
    });
    // Screen width changed between phone and wide: redraw the explorer in the other layout
    media.addEventListener("change", (event) => {
      tracksPage.narrow = event.matches;
      const open = [...document.querySelectorAll(".track-detail[open]")].map((d) => d.dataset.track);
      renderExplorer();
      for (const id of open) document.getElementById(`track-${id}`).open = true;
      highlightMyTrack();
    });
    // Arriving with tracks.html#track-eeh: open that track
    const match = window.location.hash.match(/^#track-([a-z]+)$/);
    if (match) openTrack(match[1]);
    else if (myTrack()) document.getElementById(`track-${myTrack().id}`).open = true; // my track open by default
  } catch (error) {
    console.error("Tracks:", error);
    status.textContent = "Sorry, the tracks could not be loaded right now. Please try again later.";
  }
}

if (typeof document !== "undefined" && document.getElementById("tracks-status")) initTracksPage();
