// ===== Tracks page (tracks.html) =====
// Draws every section from content/tracks.json, using the helpers in tracks-data.js.
// Sections: hero, journey, the four track cards, the detailed explorer (tabs on wide screens,
// an accordion on phones), careers across tracks, cities, FAQ and sources.

// tabs: the open section per track, kept when the layout switches between tabs and accordion
const tracksPage = { cohort: null, narrow: null, tabs: {} };
const NARROW_QUERY = "(max-width: 640px)";

// ----- Small helpers -----

function trackBadge(track) {
  const badge = createElement("span", "track-badge", `${track.letter} · ${track.abbr}`);
  badge.style.setProperty("--track-accent", track.accent);
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
    li.style.setProperty("--track-accent", track.accent);
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
    const callout = createElement("p", "tracks-callout");
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
    card.style.setProperty("--track-accent", track.accent);
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
    details.style.setProperty("--track-accent", track.accent);
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
      chip.style.setProperty("--track-accent", track.accent);
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
    renderJourney();
    renderTrackCards();
    renderExplorer();
    renderCareers();
    renderCities();
    renderFaq();
    renderSources();
    renderTracksHero(); // last: its buttons depend on which sections exist
    status.remove();
    // Screen width changed between phone and wide: redraw the explorer in the other layout
    media.addEventListener("change", (event) => {
      tracksPage.narrow = event.matches;
      const open = [...document.querySelectorAll(".track-detail[open]")].map((d) => d.dataset.track);
      renderExplorer();
      for (const id of open) document.getElementById(`track-${id}`).open = true;
    });
    // Arriving with tracks.html#track-eeh: open that track
    const match = window.location.hash.match(/^#track-([a-z]+)$/);
    if (match) openTrack(match[1]);
  } catch (error) {
    console.error("Tracks:", error);
    status.textContent = "Sorry, the tracks could not be loaded right now. Please try again later.";
  }
}

if (typeof document !== "undefined" && document.getElementById("tracks-status")) initTracksPage();
