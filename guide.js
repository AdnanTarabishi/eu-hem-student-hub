// ===== City guide =====
// One template page for every city (city-guide.html?city=oslo). Without ?city it shows the index:
// a "My track" banner, the city cards and a comparison table of the cities.
// A guide is a Markdown file (list in guide-data.js) converted to HTML with the "marked" library.
// Each guide starts with a facts block and gets an illustrated hero, topic navigation, guide search,
// saved sections, contextual facts, source links and tables that become cards on phones.
// Which tracks study in a city, and when, always comes from content/tracks.json.

const guideArticle = document.getElementById("guide");

const GUIDE_DISCLAIMER = "This is a student-made summary, not legal advice. Rules change. The official pages linked here are authoritative.";
const GUIDE_FOLLOW_FIRST = "EU-HEM or your host university may send you their own instructions, for example about housing or permits. Follow those first.";

// "2026-10-05" -> "5 October 2026"
function checkedDate(dateKey) {
  return formatDay(dateKey, { day: "numeric", month: "long", year: "numeric" });
}

function cityName(cohort, guide) {
  return cohort ? cohort.universities[guide.university].city : guide.id[0].toUpperCase() + guide.id.slice(1);
}

function reportOutdatedLink() {
  const p = createElement("p", "guide-report");
  const link = createElement("a", null, "Report something outdated");
  link.href = "contact.html";
  p.appendChild(link);
  return p;
}

// Text with source tags -> the same text with each [S12] as a link to that source
function textWithSources(text, linkBase) {
  const fragment = document.createDocumentFragment();
  for (const part of text.split(/(\[S\d+\])/)) {
    const tag = part.match(/^\[(S\d+)\]$/);
    fragment.appendChild(tag ? sourceLink(tag[1], linkBase) : document.createTextNode(part));
  }
  return fragment;
}

function sourceLink(tag, linkBase = "") {
  const link = createElement("a", "source-tag", `[${tag}]`);
  link.href = `${linkBase}#source-${tag.toLowerCase()}`;
  link.setAttribute("aria-label", `Source ${tag.slice(1)}`);
  return link;
}

// ----- "Your next city" (only when a track is saved on the Tracks page) -----
function myTrackBanner(cohort) {
  const saved = loadMyTrack();
  const track = saved && cohort ? trackById(cohort, saved.track) : null;
  if (!track) return null;
  const timeline = trackCityTimeline(cohort, track, todayKey());
  const nextIndex = timeline.findIndex((stop) => stop.next);
  if (nextIndex === -1) return null;

  const box = createElement("aside", "guide-my-track");
  box.setAttribute("aria-label", "Your next city");
  const next = timeline[nextIndex];
  const line = createElement("p", "guide-my-track-next");
  line.append("Your next city: ");
  const link = createElement("a", null, `${next.city}, Semester ${next.number} (${next.label}) →`);
  link.href = cohort.universities[next.university].guide;
  line.appendChild(link);
  box.appendChild(line);
  const later = timeline.slice(nextIndex + 1).map((stop) => `${stop.city}, Semester ${stop.number} (${stop.label})`);
  if (later.length) box.appendChild(createElement("p", null, `Then: ${later.join("; ")}.`));
  const note = createElement("p", "guide-my-track-note");
  note.append(`Based on the track you saved (${track.abbr}). `);
  const change = createElement("a", null, "Change it on the Tracks page");
  change.href = "tracks.html";
  note.appendChild(change);
  box.appendChild(note);
  return box;
}

// ----- Index: city cards and the comparison table -----

// A city directory that leads into the same practical information in every destination.
function cityIndexHeader() {
  document.querySelector(".cg-index-intro")?.remove();
  const intro = createElement("section", "cg-index-intro");
  intro.appendChild(createElement("p", "cg-index-kicker", "Life · City guides"));
  const title = createElement("h1", null, "Four cities. ");
  title.appendChild(createElement("span", "cg-index-title-accent", "One shared journey."));
  intro.append(title, createElement("p", "cg-index-description",
    "From finding a room to finding your routine. Practical guides for life in Bologna, Oslo, Rotterdam and Innsbruck."));
  const actions = createElement("div", "cg-index-actions");
  const choose = cgLink("Find your city", "#city-guides", "button");
  choose.appendChild(cgIcon("arrow-right"));
  actions.append(choose, cgLink("Compare the cities", "#compare-title", "button button-quiet"));
  intro.appendChild(actions);
  return intro;
}

async function showCityIndex(cohort) {
  cityGuideState = null;
  document.title = "City Guides – EU-HEM Student Hub";
  guideArticle.replaceChildren();
  guideArticle.classList.add("cg-index-content", "is-index");
  guideArticle.setAttribute("aria-label", "City guides directory");
  guideArticle.before(cityIndexHeader());
  const banner = myTrackBanner(cohort);
  if (banner) guideArticle.appendChild(banner);
  const title = createElement("h2", "cg-directory-title", "Where will you make yourself at home?");
  title.id = "city-guides";
  guideArticle.appendChild(title);
  const cards = createElement("ul", "guide-city-cards");
  for (const [index, guide] of CITY_GUIDES.entries()) {
    const university = cohort ? cohort.universities[guide.university] : null;
    const card = cgLink("", "city-guide.html?city=" + guide.id, "guide-city-card");
    card.dataset.city = guide.id;
    if (guide.cover) card.appendChild(cityCoverPhoto(guide.cover));
    const number = createElement("span", "cg-city-card-number", String(index + 1).padStart(2, "0"));
    number.setAttribute("aria-hidden", "true");
    card.appendChild(number);
    const body = createElement("span", "cg-city-card-body");
    if (university) body.appendChild(createElement("span", "city-country", university.country));
    body.appendChild(createElement("strong", null, cityName(cohort, guide)));
    if (university) body.appendChild(createElement("span", "guide-city-university", university.name));
    if (cohort) body.appendChild(createElement("span", "guide-city-presence", cityPresenceText(cohort, guide.university)));
    const cta = createElement("span", guide.file ? "city-status is-ready" : "city-status",
      guide.file ? "Explore the guide" : "Coming soon");
    cta.appendChild(cgIcon("arrow-right"));
    body.appendChild(cta);
    card.appendChild(body);
    const item = createElement("li");
    item.appendChild(card);
    cards.appendChild(item);
  }
  guideArticle.appendChild(cards);
  const loaded = await Promise.all(CITY_GUIDES.filter((guide) => guide.file).map(async (guide) => {
    try {
      const response = await fetch(guide.file, { cache: "no-cache" });
      return response.ok ? { guide, ...parseGuide(await response.text()) } : null;
    } catch { return null; }
  }));
  const compared = loaded.filter((guide) => guide && guide.structured);
  if (compared.length) guideArticle.appendChild(comparisonSection(cohort, compared));
  else guideArticle.appendChild(createElement("p", "guide-compare-note",
    "The city comparison could not load. You can still open an individual guide above."));
  const notice = createElement("aside", "guide-notice");
  notice.append(createElement("p", "guide-disclaimer", GUIDE_DISCLAIMER), reportOutdatedLink());
  guideArticle.appendChild(notice);
  if (window.location.hash === "#compare-title") guideArticle.querySelector("#compare-title")?.scrollIntoView();
}

function comparisonSection(cohort, compared) {
  const section = createElement("section", "guide-compare");
  section.setAttribute("aria-labelledby", "compare-title");
  const title = createElement("h2", null, "Compare the cities");
  title.id = "compare-title";
  section.appendChild(title);
  const dates = [...new Set(compared.map((g) => g.facts["last-checked"]))].sort().map(checkedDate);
  section.appendChild(createElement("p", "guide-compare-intro",
    `Choose the cities to compare. Approximate, checked ${dates.join(", ")}; the small [S] tags open the source.`));

  // The cities of the saved track (Semester 2 and 3), to select them in one tap and highlight them
  const saved = loadMyTrack();
  const track = saved && cohort ? trackById(cohort, saved.track) : null;
  const myCities = track ? track.semesters.map((s) => CITY_GUIDES.find((g) => g.university === s.university)?.id).filter(Boolean) : [];

  const picker = createElement("div", "compare-picker");
  picker.setAttribute("role", "group");
  picker.setAttribute("aria-label", "Cities to compare");
  const chips = compared.map(({ guide }) => {
    const chip = createElement("button", "compare-chip", cityName(cohort, guide));
    chip.type = "button";
    chip.dataset.city = guide.id;
    if (myCities.includes(guide.id)) chip.classList.add("is-mine");
    return chip;
  });
  let myButton = null;
  if (myCities.length) {
    myButton = createElement("button", "compare-chip compare-mine", `My cities (${track.abbr})`);
    myButton.type = "button";
    picker.appendChild(myButton);
  }
  picker.append(...chips);
  section.appendChild(picker);

  const table = createElement("table", "compare-table");
  table.appendChild(createElement("caption", "visually-hidden", "Comparison of the EU-HEM cities"));
  const head = createElement("tr");
  const corner = createElement("th", null, "Topic");
  corner.scope = "col";
  head.appendChild(corner);
  for (const { guide } of compared) {
    const th = createElement("th");
    th.scope = "col";
    th.dataset.city = guide.id;
    const link = createElement("a", null, cityName(cohort, guide));
    link.href = `city-guide.html?city=${guide.id}`;
    th.appendChild(link);
    if (cohort) th.appendChild(createElement("span", "compare-who", cityPresenceText(cohort, guide.university)));
    if (myCities.includes(guide.id)) th.classList.add("is-mine");
    head.appendChild(th);
  }
  const thead = createElement("thead");
  thead.appendChild(head);
  table.appendChild(thead);

  for (const { group, keys } of GUIDE_COMPARE) {
    const tbody = createElement("tbody");
    const groupRow = createElement("tr", "compare-group");
    const groupCell = createElement("th", null, group);
    groupCell.scope = "colgroup";
    groupCell.colSpan = compared.length + 1;
    groupRow.appendChild(groupCell);
    tbody.appendChild(groupRow);
    for (const key of keys) {
      // On phones the topic gets its own line above the values (see style.css), so cities have room
      const topicRow = createElement("tr", "compare-topic");
      const topic = createElement("th", null, GUIDE_FACTS[key]);
      topic.colSpan = compared.length + 1;
      topicRow.appendChild(topic);
      tbody.appendChild(topicRow);
      const row = createElement("tr");
      const label = createElement("th", null, GUIDE_FACTS[key]);
      label.scope = "row";
      row.appendChild(label);
      for (const { guide, facts } of compared) {
        const cell = createElement("td");
        cell.dataset.city = guide.id;
        if (myCities.includes(guide.id)) cell.classList.add("is-mine");
        cell.appendChild(textWithSources(facts[key] || "Not in this guide yet", `city-guide.html?city=${guide.id}`));
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
  }
  const wrapper = createElement("div", "table-wrapper compare-wrapper");
  wrapper.appendChild(table);
  section.appendChild(wrapper);

  // Show only the chosen cities; at least one always stays chosen
  const phone = window.matchMedia("(max-width: 600px)");
  const show = (ids) => {
    for (const chip of chips) chip.setAttribute("aria-pressed", String(ids.includes(chip.dataset.city)));
    for (const cell of table.querySelectorAll("[data-city]")) cell.hidden = !ids.includes(cell.dataset.city);
    // On phones the topic column is hidden, so the full-width lines span one column less
    for (const cell of table.querySelectorAll(".compare-group th, .compare-topic th")) cell.colSpan = ids.length + (phone.matches ? 0 : 1);
    if (myButton) myButton.setAttribute("aria-pressed", String(ids.length === myCities.length && myCities.every((id) => ids.includes(id))));
  };
  const chosen = () => chips.filter((c) => c.getAttribute("aria-pressed") === "true").map((c) => c.dataset.city);
  for (const chip of chips) {
    chip.addEventListener("click", () => {
      const ids = chosen();
      const next = ids.includes(chip.dataset.city) ? ids.filter((id) => id !== chip.dataset.city) : [...ids, chip.dataset.city];
      if (next.length) show(compared.map((c) => c.guide.id).filter((id) => next.includes(id)));
    });
  }
  if (myButton) myButton.addEventListener("click", () => show(myCities));
  phone.addEventListener("change", () => show(chosen()));
  // Phones start with two cities (yours, if a track is saved); wider screens with all of them
  const all = compared.map((c) => c.guide.id);
  show(window.matchMedia("(max-width: 700px)").matches ? (myCities.length ? myCities : all.slice(0, 2)) : all);

  const missing = CITY_GUIDES.filter((g) => !compared.some((c) => c.guide.id === g.id)).map((g) => cityName(cohort, g));
  if (missing.length) {
    section.appendChild(createElement("p", "guide-compare-note", `Not in the comparison yet: ${missing.join(", ")}. They are added when their guides are completed.`));
  }
  return section;
}

// On phones each row becomes a card, so every cell needs its column name
function labelTableCells(table) {
  const labels = [...table.querySelectorAll("thead th")].map((th) => th.textContent);
  for (const row of table.querySelectorAll("tbody tr")) {
    [...row.children].forEach((cell, i) => cell.setAttribute("data-label", labels[i] || ""));
  }
}

// ----- A city guide: one reading space, organised into practical topics -----
const CITY_GUIDE_TOPICS = [
  { id: "overview", label: "Overview", icon: "globe", sections: ["at-a-glance"],
    facts: ["host", "cost-vs-bologna"] },
  { id: "arriving", label: "Arriving", icon: "briefcase", sections: ["before-you-move", "residence-and-registration"],
    facts: ["compare-registration", "compare-permit-non-eu"] },
  { id: "housing", label: "Housing", icon: "home", sections: ["housing"],
    facts: ["compare-rent", "compare-budget"] },
  { id: "transport", label: "Transport", icon: "route", sections: ["getting-around"],
    facts: ["compare-transport", "compare-age-limits"] },
  { id: "everyday", label: "Everyday life", icon: "sun",
    sections: ["money-and-phone", "cost-of-living", "food-and-daily-life", "weather-and-what-to-pack"],
    facts: ["currency", "compare-budget", "compare-climate"] },
  { id: "study", label: "Study & social", icon: "book",
    sections: ["study-places-and-campus", "sport-social-life-and-student-organisations", "useful-apps-and-websites", "student-tips"],
    facts: ["host", "language"] },
  { id: "health", label: "Health & safety", icon: "stethoscope", sections: ["healthcare", "emergency-numbers"],
    facts: ["compare-health-eu", "compare-health-non-eu"] },
  { id: "sources", label: "Sources", icon: "link", sections: ["sources"], facts: [] },
];
const GUIDE_SAVED_KEY = "euhem.guide.saved.v1";
let cityGuideState = null;
let guideStorageAvailable = true;
let savedGuideSections = readSavedGuideSections();

function readSavedGuideSections() {
  const stored = readStorage(GUIDE_SAVED_KEY, null);
  if (!stored || stored.version !== 1 || !Array.isArray(stored.items)) return [];
  const sectionIds = new Set(GUIDE_SECTIONS.map(guideHeadingId));
  const cityIds = new Set(CITY_GUIDES.filter((guide) => guide.file).map((guide) => guide.id));
  const seen = new Set();
  return stored.items.filter((item) => {
    if (!item || !cityIds.has(item.city) || !sectionIds.has(item.section)) return false;
    const key = item.city + ":" + item.section;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => ({ city: item.city, section: item.section }));
}

function cgIcon(name) {
  return typeof siteIcon === "function" ? siteIcon(name) : document.createTextNode("");
}

function cgLink(label, href, className) {
  const link = createElement("a", className, label);
  link.href = href;
  return link;
}

function cgButton(label, className) {
  const button = createElement("button", className, label);
  button.type = "button";
  return button;
}

function guideCitySwitcher(guide, cohort) {
  const nav = createElement("nav", "cg-city-switcher");
  nav.setAttribute("aria-label", "City guides");
  nav.appendChild(cgLink("All city guides", "city-guide.html", "guide-breadcrumb"));
  const links = createElement("div", "cg-city-links");
  for (const city of CITY_GUIDES) {
    const link = cgLink(cityName(cohort, city), "city-guide.html?city=" + city.id);
    if (city.id === guide.id) link.setAttribute("aria-current", "page");
    links.appendChild(link);
  }
  nav.appendChild(links);
  return nav;
}

function guideHero(guide, facts, cohort) {
  const name = cityName(cohort, guide);
  const hero = createElement("header", "cg-hero");
  hero.dataset.city = guide.id;
  if (guide.cover) {
    const image = createElement("img", "cg-hero-image");
    image.src = guide.cover.image + "-1200.webp";
    image.srcset = guide.cover.image + "-640.webp 640w, " + guide.cover.image + "-1200.webp 1200w";
    image.sizes = "100vw";
    image.width = 1200;
    image.height = 800;
    image.alt = guide.cover.alt;
    image.fetchPriority = "high";
    hero.appendChild(image);
  }
  const copy = createElement("div", "cg-hero-copy");
  copy.appendChild(createElement("p", "cg-eyebrow", "EU-HEM · Student life"));
  const title = createElement("h1", null, name + " ");
  title.appendChild(createElement("span", "cg-hero-title-accent", "City Guide"));
  copy.appendChild(title);
  copy.appendChild(createElement("p", "cg-hero-subtitle", "Find your feet. Make it your city."));
  copy.appendChild(createElement("p", "cg-hero-description",
    "A practical companion for your move: finding a room, getting around, studying and building an everyday routine."));
  const actions = createElement("div", "cg-hero-actions");
  const start = cgLink("Start your move", "#before-you-move", "button");
  start.appendChild(cgIcon("arrow-right"));
  actions.append(start, cgLink("Explore housing", "#housing", "button button-quiet"));
  copy.appendChild(actions);
  hero.appendChild(copy);
  if (guide.cover) {
    const ai = /\/ai-/.test(guide.cover.image);
    hero.appendChild(createElement("p", "cg-image-label",
      ai ? "AI illustration · City-inspired cover" : (guide.cover.credit || "City guide cover")));
  }
  return hero;
}

function guideFactsStrip(guide, facts, cohort) {
  const strip = createElement("dl", "cg-facts-strip");
  const add = (label, value, icon) => {
    if (!value) return;
    const item = createElement("div", "cg-fact");
    const term = createElement("dt");
    term.append(cgIcon(icon), document.createTextNode(label));
    const detail = createElement("dd");
    detail.append(typeof value === "string" ? textWithSources(value) : value);
    item.append(term, detail);
    strip.appendChild(item);
  };
  if (cohort) {
    add("Your university", cgLink(cohort.universities[guide.university].name,
      "university.html?id=" + encodeURIComponent(guide.university) + "&cohort=" + encodeURIComponent(cohort.id)), "graduation");
  } else add("Your university", facts.host, "graduation");
  add("Currency", facts.currency, "calculator");
  add("Languages", facts.language, "globe");
  add("Information checked", checkedDate(facts["last-checked"]), "check");
  return strip;
}

async function renderStructuredGuide(guide, parsed, cohort) {
  guideArticle.innerHTML = marked.parse(parsed.body);
  guideArticle.classList.remove("cg-index-content", "is-index");
  guideArticle.dataset.city = guide.id;
  guideArticle.querySelector("h1")?.remove();
  const sections = wrapSections();
  fillAtAGlance(sections[0], guide, parsed.facts, cohort);
  hideEmptySections(sections);
  const scene = guideArticle.querySelector(".guide-photos figure:not(.is-ai)")?.cloneNode(true);
  const records = sections.map((section) => {
    const heading = section.querySelector("h2");
    const body = section.querySelector(".guide-section-body");
    const id = heading.id;
    const topic = CITY_GUIDE_TOPICS.find((item) => item.sections.includes(id)) || CITY_GUIDE_TOPICS[0];
    return { id, section, heading, body, title: heading.textContent, topic, empty: section.hidden };
  });
  linkGuideSectionReferences(records);
  // Keep the original section IDs and source nodes, moving them rather than copying their content.
  const fragment = document.createDocumentFragment();
  sections.forEach((section) => fragment.appendChild(section));
  guideArticle.replaceChildren(guideCitySwitcher(guide, cohort), guideHero(guide, parsed.facts, cohort),
    guideFactsStrip(guide, parsed.facts, cohort));
  const shell = createElement("div", "cg-content-shell");
  const banner = myTrackBanner(cohort);
  if (banner) shell.appendChild(banner);
  const state = cityGuideState = {
    guide, facts: parsed.facts, cohort, records, activeTopic: "overview",
    query: "", savedOnly: false, readAll: false, tabs: [], panels: [], scene,
  };
  const bar = createElement("nav", "cg-topic-bar");
  bar.setAttribute("aria-label", "Browse this city guide");
  const tablist = createElement("div", "cg-topic-tabs");
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", "City guide topics");
  for (const topic of CITY_GUIDE_TOPICS) {
    const tab = cgButton("", "cg-topic-tab");
    tab.id = "tab-" + topic.id;
    tab.dataset.topic = topic.id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "panel-" + topic.id);
    tab.setAttribute("aria-selected", String(topic.id === state.activeTopic));
    tab.tabIndex = topic.id === state.activeTopic ? 0 : -1;
    tab.append(cgIcon(topic.icon), createElement("span", null, topic.label));
    tab.addEventListener("click", () => {
      state.readAll = false;
      state.readAllInput.checked = false;
      const first = state.records.find((record) => record.topic.id === topic.id && !record.empty);
      if (first) navigateGuideTarget(first.id, { focus: false });
    });
    tab.addEventListener("keydown", (event) => {
      let index = state.tabs.indexOf(tab);
      if (event.key === "ArrowRight") index = (index + 1) % state.tabs.length;
      else if (event.key === "ArrowLeft") index = (index - 1 + state.tabs.length) % state.tabs.length;
      else if (event.key === "Home") index = 0;
      else if (event.key === "End") index = state.tabs.length - 1;
      else return;
      event.preventDefault();
      state.tabs[index].focus();
      state.tabs[index].click();
    });
    state.tabs.push(tab);
    tablist.appendChild(tab);
  }
  bar.appendChild(tablist);
  state.topicBar = bar;
  shell.appendChild(bar);
  const workspace = createElement("div", "cg-workspace");
  const reading = createElement("div", "cg-reading");
  reading.appendChild(guideTools(state));
  const status = createElement("p", "cg-results-status");
  status.id = "guide-results-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  state.status = status;
  reading.appendChild(status);
  state.results = createElement("div", "cg-search-results");
  state.results.hidden = true;
  reading.appendChild(state.results);
  state.panelList = createElement("div", "cg-topic-panels");
  for (const topic of CITY_GUIDE_TOPICS) {
    const panel = createElement("section", "cg-topic-panel");
    panel.id = "panel-" + topic.id;
    panel.dataset.topic = topic.id;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", "tab-" + topic.id);
    panel.hidden = topic.id !== state.activeTopic;
    for (const record of records.filter((item) => item.topic.id === topic.id)) {
      const headingRow = createElement("div", "cg-section-heading");
      record.heading.before(headingRow);
      const save = cgButton("", "cg-save-section");
      save.dataset.section = record.id;
      save.setAttribute("aria-label", "Save: " + record.title);
      save.append(cgIcon("bookmark"), createElement("span", null, "Save"));
      save.addEventListener("click", () => toggleGuideSaved(record.id));
      record.saveButton = save;
      headingRow.append(record.heading, save);
      record.section.setAttribute("aria-labelledby", record.id);
      panel.appendChild(record.section);
    }
    state.panels.push(panel);
    state.panelList.appendChild(panel);
  }
  reading.appendChild(state.panelList);
  workspace.append(reading, guideSidebar(state));
  shell.appendChild(workspace);
  const notice = createElement("aside", "guide-notice");
  notice.setAttribute("aria-label", "About this student guide");
  notice.append(createElement("p", "guide-checked", "Last checked: " + checkedDate(parsed.facts["last-checked"]) + "."),
    createElement("p", null, GUIDE_DISCLAIMER), createElement("p", null, GUIDE_FOLLOW_FIRST), reportOutdatedLink());
  shell.appendChild(notice);
  guideArticle.appendChild(shell);
  linkSources();
  const indexSections = () => records.forEach((record) => {
    record.text = record.body.textContent.replace(/\s+/g, " ").trim();
    record.searchText = simplify(record.title + " " + record.text);
  });
  indexSections();
  for (const table of guideArticle.querySelectorAll("table")) {
    table.classList.add("guide-cards-on-phone");
    labelTableCells(table);
  }
  wrapTables();
  updateGuideSavedUI();
  renderGuideView();
  placeGuideNavigation(bar);
  await labelSourceMarkers();
  indexSections();
  renderGuideView();
}

function guideTools(state) {
  const tools = createElement("div", "cg-guide-tools");
  const field = createElement("div", "cg-search-field");
  const label = createElement("label", "visually-hidden", "Search this city guide");
  label.htmlFor = "guide-search";
  const search = createElement("input");
  search.type = "search";
  search.id = "guide-search";
  search.placeholder = "Search this guide…";
  search.autocomplete = "off";
  search.maxLength = 160;
  search.setAttribute("aria-describedby", "guide-results-status");
  const clear = cgButton("", "cg-search-clear");
  clear.setAttribute("aria-label", "Clear search");
  clear.appendChild(cgIcon("close"));
  clear.hidden = true;
  clear.addEventListener("click", () => {
    state.query = "";
    search.value = "";
    renderGuideView();
    search.focus();
  });
  search.addEventListener("input", () => {
    state.query = search.value.trim();
    renderGuideView();
  });
  field.append(label, cgIcon("search"), search, clear);
  state.searchInput = search;
  state.clearSearch = clear;
  const savedLabel = createElement("label", "cg-saved-filter");
  const saved = createElement("input");
  saved.type = "checkbox";
  saved.id = "guide-saved-only";
  const savedText = createElement("span", null, "Saved (0)");
  saved.addEventListener("change", () => {
    state.savedOnly = saved.checked;
    renderGuideView();
  });
  savedLabel.append(saved, cgIcon("bookmark"), savedText);
  state.savedInput = saved;
  state.savedLabel = savedText;
  const allLabel = createElement("label", "cg-saved-filter cg-read-all-filter");
  const all = createElement("input");
  all.type = "checkbox";
  all.id = "guide-read-all";
  all.title = "Show every section for reading, printing or browser Find";
  all.addEventListener("change", () => {
    state.readAll = all.checked;
    state.query = "";
    state.savedOnly = false;
    search.value = "";
    saved.checked = false;
    renderGuideView();
  });
  allLabel.append(all, cgIcon("list"), createElement("span", null, "Read all"));
  state.readAllInput = all;
  tools.append(field, savedLabel, allLabel);
  return tools;
}

function guideSideCard(title, icon, className) {
  const card = createElement("section", "cg-side-card" + (className ? " " + className : ""));
  const heading = createElement("h2", "cg-side-title");
  heading.append(cgIcon(icon), document.createTextNode(title));
  card.appendChild(heading);
  return card;
}

function guideSidebar(state) {
  const sidebar = createElement("aside", "cg-sidebar");
  sidebar.setAttribute("aria-label", "Useful information for " + cityName(state.cohort, state.guide));
  const onPage = guideSideCard("In this topic", "list", "cg-on-page");
  state.onPageCard = onPage;
  state.onPageList = createElement("ul");
  onPage.appendChild(state.onPageList);
  const quick = guideSideCard("Good to know", "info", "cg-context-card");
  state.quickFacts = createElement("dl", "cg-quick-facts");
  quick.appendChild(state.quickFacts);
  state.quickCard = quick;
  const emergency = guideSideCard("Emergency contacts", "phone", "cg-emergency-card");
  const numbers = createElement("p", "cg-emergency-numbers");
  numbers.appendChild(textWithSources(state.facts["compare-emergency"] || "See the emergency section below."));
  emergency.append(numbers, cgLink("Health & safety details", "#emergency-numbers", "cg-side-link"));
  const saved = guideSideCard("Saved for your move", "bookmark", "cg-saved-card");
  state.savedList = createElement("ul", "cg-saved-links");
  state.savedEmpty = createElement("p", "cg-saved-empty", "Save useful sections and keep them close for your next move.");
  state.storageNote = createElement("p", "cg-storage-note", "Saved on this device. No account needed.");
  state.storageNote.setAttribute("aria-live", "polite");
  saved.append(state.savedList, state.savedEmpty, state.storageNote);
  sidebar.append(onPage, quick, emergency, saved);
  if (state.scene) {
    const scene = guideSideCard("A feel for the city", "map-pin", "cg-city-scene");
    scene.appendChild(state.scene);
    sidebar.appendChild(scene);
  }
  return sidebar;
}

function renderGuideSidebar() {
  const state = cityGuideState;
  const topic = CITY_GUIDE_TOPICS.find((item) => item.id === state.activeTopic);
  const records = state.records.filter((record) => record.topic.id === topic.id && !record.empty);
  state.onPageList.replaceChildren();
  for (const record of records) {
    const item = createElement("li");
    item.appendChild(cgLink(record.title, "#" + record.id));
    state.onPageList.appendChild(item);
  }
  state.onPageCard.hidden = records.length < 2;
  state.quickFacts.replaceChildren();
  for (const key of topic.facts) {
    if (!state.facts[key]) continue;
    const row = createElement("div");
    const value = createElement("dd");
    value.appendChild(textWithSources(state.facts[key]));
    row.append(createElement("dt", null, GUIDE_FACTS[key]), value);
    state.quickFacts.appendChild(row);
  }
  if (topic.id === "study" && state.cohort) {
    const row = createElement("div");
    row.append(createElement("dt", null, "Who studies here"),
      createElement("dd", null, cityPresenceText(state.cohort, state.guide.university)));
    state.quickFacts.appendChild(row);
  }
  if (topic.id === "sources") {
    const row = createElement("div");
    row.append(createElement("dt", null, "Guide checked"),
      createElement("dd", null, checkedDate(state.facts["last-checked"])));
    state.quickFacts.appendChild(row);
    const note = createElement("dd", null, "Open a source to check current details. Source labels distinguish official information from student tips.");
    const term = createElement("dt", null, "Keep the context");
    const context = createElement("div");
    context.append(term, note);
    state.quickFacts.appendChild(context);
  }
}

function isGuideSectionSaved(city, section) {
  return savedGuideSections.some((item) => item.city === city && item.section === section);
}

function toggleGuideSaved(section) {
  const state = cityGuideState;
  const city = state.guide.id;
  if (isGuideSectionSaved(city, section)) {
    savedGuideSections = savedGuideSections.filter((item) => !(item.city === city && item.section === section));
  } else {
    savedGuideSections.push({ city, section });
  }
  guideStorageAvailable = writeStorage(GUIDE_SAVED_KEY, { version: 1, items: savedGuideSections });
  updateGuideSavedUI();
  renderGuideView();
}

function updateGuideSavedUI() {
  const state = cityGuideState;
  for (const record of state.records) {
    const saved = isGuideSectionSaved(state.guide.id, record.id);
    record.saveButton.setAttribute("aria-pressed", String(saved));
    record.saveButton.querySelector("span").textContent = saved ? "Saved" : "Save";
  }
  const count = state.records.filter((record) => !record.empty && isGuideSectionSaved(state.guide.id, record.id)).length;
  state.savedLabel.textContent = "Saved (" + count + ")";
  state.savedList.replaceChildren();
  for (const item of savedGuideSections) {
    const city = CITY_GUIDES.find((guide) => guide.id === item.city);
    const title = GUIDE_SECTIONS.find((name) => guideHeadingId(name) === item.section);
    if (item.city === state.guide.id && state.records.some((record) => record.id === item.section && record.empty)) continue;
    const line = createElement("li");
    const href = item.city === state.guide.id ? "#" + item.section : "city-guide.html?city=" + item.city + "#" + item.section;
    const link = cgLink(title, href);
    link.appendChild(createElement("span", "cg-saved-city", cityName(state.cohort, city)));
    line.appendChild(link);
    state.savedList.appendChild(line);
  }
  state.savedEmpty.hidden = state.savedList.children.length > 0;
  state.savedList.hidden = !state.savedList.children.length;
  state.storageNote.textContent = guideStorageAvailable ? "Saved on this device. No account needed." :
    "Saved for this visit only. Your browser is blocking storage.";
}

function guideSearchSnippet(record, query) {
  const text = record.text;
  const words = simplify(query).split(/\s+/).filter(Boolean);
  const first = words.length ? simplify(text).indexOf(words[0]) : 0;
  const start = first > 65 ? first - 45 : 0;
  const snippet = text.slice(start, start + 190).trim();
  return (start ? "…" : "") + snippet + (start + 190 < text.length ? "…" : "");
}

function renderGuideView() {
  const state = cityGuideState;
  if (!state) return;
  const filtering = !!state.query || state.savedOnly;
  state.clearSearch.hidden = !state.query;
  state.results.hidden = !filtering;
  state.panelList.hidden = filtering;
  for (const tab of state.tabs) {
    const active = tab.dataset.topic === state.activeTopic;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  revealActiveGuideTab();
  for (const panel of state.panels) panel.hidden = !state.readAll && panel.dataset.topic !== state.activeTopic;
  if (filtering) {
    const words = simplify(state.query).split(/\s+/).filter(Boolean);
    const matches = state.records.filter((record) => !record.empty &&
      (!state.savedOnly || isGuideSectionSaved(state.guide.id, record.id)) &&
      words.every((word) => record.searchText.includes(word)));
    state.results.replaceChildren();
    state.status.textContent = matches.length + (matches.length === 1 ? " section" : " sections") +
      (state.savedOnly ? " saved" : " found") + (state.query ? " for “" + state.query + "”" : "") + ".";
    for (const record of matches) {
      const link = cgLink("", "#" + record.id, "cg-search-result");
      link.append(createElement("span", "cg-result-topic", record.topic.label),
        createElement("h3", null, record.title), createElement("p", null, guideSearchSnippet(record, state.query)));
      state.results.appendChild(link);
    }
    if (!matches.length) {
      const empty = createElement("div", "cg-empty-state");
      empty.append(createElement("h2", null, state.savedOnly && !state.query ? "No saved sections yet" : "No matching sections"),
        createElement("p", null, state.savedOnly && !state.query ?
          "Use Save beside a section heading to keep it here." : "Try another word or explore the guide by topic."));
      const reset = cgButton("Show the guide", "button button-quiet");
      reset.addEventListener("click", () => {
        clearGuideFilters();
        renderGuideView();
        state.searchInput.focus();
      });
      empty.appendChild(reset);
      state.results.appendChild(empty);
    }
  } else {
    const count = state.records.filter((record) => !record.empty).length;
    const topic = CITY_GUIDE_TOPICS.find((item) => item.id === state.activeTopic);
    state.status.textContent = state.readAll ? "All " + count + " sections · Read at your own pace." :
      topic.label + " · Search across all " + count + " sections.";
  }
  renderGuideSidebar();
}

function clearGuideFilters() {
  const state = cityGuideState;
  state.query = "";
  state.savedOnly = false;
  state.searchInput.value = "";
  state.savedInput.checked = false;
}

function guideHashId(hash) {
  try { return decodeURIComponent((hash || "").replace(/^#/, "")); }
  catch { return ""; }
}

function navigateGuideTarget(id, { history = true, focus = true } = {}) {
  const state = cityGuideState;
  if (!state || !id) return;
  const target = document.getElementById(id);
  const section = target?.closest(".guide-section");
  const record = state.records.find((item) => item.section === section && !item.empty);
  if (!record) return;
  clearGuideFilters();
  state.activeTopic = record.topic.id;
  renderGuideView();
  if (history && guideHashId(window.location.hash) !== id) {
    window.history.pushState(null, "", "#" + encodeURIComponent(id));
  }
  if (focus) {
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
  target.scrollIntoView({ block: "start" });
}

function revealHashTarget() {
  if (!cityGuideState) return;
  const id = guideHashId(window.location.hash);
  if (id) navigateGuideTarget(id, { history: false });
  else {
    const focusedPanel = document.activeElement?.closest(".cg-topic-panel");
    clearGuideFilters();
    cityGuideState.readAll = false;
    cityGuideState.readAllInput.checked = false;
    cityGuideState.activeTopic = "overview";
    renderGuideView();
    if (focusedPanel?.hidden) document.getElementById("tab-overview").focus({ preventScroll: true });
  }
}

// A deep link may select a tab beyond the phone's viewport. Reveal it within its own scroller
// without moving the page away from the linked heading or source.
function revealActiveGuideTab() {
  const tab = cityGuideState?.tabs.find((item) => item.dataset.topic === cityGuideState.activeTopic);
  if (!tab) return;
  const scroller = tab.parentElement;
  const bounds = scroller.getBoundingClientRect();
  const selected = tab.getBoundingClientRect();
  if (selected.left < bounds.left) scroller.scrollLeft += selected.left - bounds.left - 4;
  else if (selected.right > bounds.right) scroller.scrollLeft += selected.right - bounds.right + 4;
}

function placeGuideNavigation(bar) {
  const header = document.querySelector(".site-header");
  const place = () => {
    document.documentElement.style.setProperty("--guide-sticky-top", (header ? header.offsetHeight : 0) + "px");
    document.documentElement.style.setProperty("--cg-topic-height", bar.offsetHeight + "px");
    revealActiveGuideTab();
  };
  place();
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(place);
    if (header) observer.observe(header);
    observer.observe(bar);
  } else window.addEventListener("resize", place);
}

function wrapSections() {
  const sections = [];
  for (const heading of [...guideArticle.querySelectorAll("h2")]) {
    const section = createElement("section", "guide-section");
    const body = createElement("div", "guide-section-body");
    heading.before(section);
    let next = heading.nextSibling;
    while (next && !(next.nodeType === 1 && (next.tagName === "H2" || next.tagName === "HR"))) {
      const move = next;
      next = next.nextSibling;
      body.appendChild(move);
    }
    if (next && next.tagName === "HR") next.remove();
    heading.id = guideHeadingId(heading.textContent);
    heading.textContent = heading.textContent.replace(/^\d+\.\s*/, "");
    body.id = heading.id + "-body";
    section.append(heading, body);
    sections.push(section);
  }
  return sections;
}

// Preserve cross-references such as "see section 3" after regrouping the original numbered sections.
function linkGuideSectionReferences(records) {
  for (const record of records) {
    const walker = document.createTreeWalker(record.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement.closest("a, code, pre, script, style") && /\bsection\s+\d+\b/i.test(node.textContent)) nodes.push(node);
    }
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\bsection\s+\d+\b)/i)) {
        const number = part.match(/^section\s+(\d+)$/i);
        const target = number ? records[Number(number[1]) - 1] : null;
        fragment.appendChild(target && !target.empty ? cgLink(target.title, "#" + target.id, "cg-section-reference") :
          document.createTextNode(part));
      }
      node.replaceWith(fragment);
    }
  }
}

function fillAtAGlance(section, guide, facts, cohort) {
  const list = createElement("dl", "guide-glance");
  const add = (label, content) => {
    list.appendChild(createElement("dt", null, label));
    const value = createElement("dd");
    value.append(typeof content === "string" ? textWithSources(content) : content);
    list.appendChild(value);
  };
  if (cohort) {
    add("University", cgLink(cohort.universities[guide.university].name,
      "university.html?id=" + encodeURIComponent(guide.university) + "&cohort=" + encodeURIComponent(cohort.id)));
    const presence = createElement("span");
    presence.append(cityPresenceText(cohort, guide.university), " (", cgLink("see Tracks", "tracks.html"), ")");
    add("Who studies here", presence);
  }
  for (const key of ["host", "language", "currency", "cost-vs-bologna"]) {
    if (facts[key]) add(GUIDE_FACTS[key], facts[key]);
  }
  add("Last checked", checkedDate(facts["last-checked"]));
  const body = section.querySelector(".guide-section-body");
  const photos = body.querySelector(".guide-photos");
  if (photos) photos.before(list);
  else body.prepend(list);
}

function hideEmptySections(sections) {
  for (const section of sections) {
    if (!section.querySelector(".guide-section-body").textContent.trim()) section.hidden = true;
  }
}

// Handle repeated same-section links as well as links into an inactive topic.
guideArticle.addEventListener("click", (event) => {
  if (!cityGuideState || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest("a[href^='#']");
  if (!link || !guideArticle.contains(link)) return;
  const id = guideHashId(link.getAttribute("href"));
  const target = document.getElementById(id);
  if (!target?.closest(".guide-section")) return;
  event.preventDefault();
  navigateGuideTarget(id);
});

// [S12] in the text -> a link to source 12; the Sources list gets matching ids
function linkSources() {
  const sources = guideArticle.querySelector("#sources-body");
  if (sources) {
    for (const item of sources.querySelectorAll("li")) {
      const tag = item.textContent.trim().match(/^\[(S\d+)\]/);
      if (!tag) continue;
      item.id = `source-${tag[1].toLowerCase()}`;
      const first = item.firstChild;
      if (first && first.nodeType === 3) {
        first.textContent = first.textContent.replace(/^\s*\[S\d+\]\s*/, "");
        item.prepend(createElement("strong", "source-label", `${tag[1]} `));
      }
    }
  }
  const walker = document.createTreeWalker(guideArticle, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    if (!walker.currentNode.parentElement.closest("a, script, style") && /\[S\d+\]/.test(walker.currentNode.textContent)) {
      nodes.push(walker.currentNode);
    }
  }
  for (const node of nodes) node.replaceWith(textWithSources(node.textContent));
}

// {official:euhem-handbook-2026} or {tip:student-reps-2026} in a guide -> the source label from
// content/sources.json (utils.js → sourceLabel). Unknown ids still show a neutral label.
const SOURCE_MARKER = /\{(?:official|tip):([a-z0-9-]+)\}/;

async function labelSourceMarkers() {
  const walker = document.createTreeWalker(guideArticle, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (SOURCE_MARKER.test(walker.currentNode.textContent)) nodes.push(walker.currentNode);
  if (!nodes.length) return;
  const sources = await loadSources();
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    for (const part of node.textContent.split(/(\{(?:official|tip):[a-z0-9-]+\})/)) {
      const match = part.match(SOURCE_MARKER);
      fragment.appendChild(match ? sourceLabel(match[1], sources) : document.createTextNode(part));
    }
    node.replaceWith(fragment);
  }
}

// ----- Shared -----

// Wide tables scroll sideways inside their own box instead of stretching the page
function wrapTables() {
  for (const table of guideArticle.querySelectorAll("table")) {
    if (table.parentElement.classList.contains("table-wrapper")) continue;
    const wrapper = createElement("div", "table-wrapper");
    table.before(wrapper);
    wrapper.appendChild(table);
  }
}

// A planned city without a guide yet
function showComingSoon(name, cohort, guide) {
  guideArticle.innerHTML = "";
  const back = createElement("a", "guide-breadcrumb", "← All city guides");
  back.href = "city-guide.html";
  guideArticle.appendChild(back);
  guideArticle.appendChild(createElement("p", "coming-soon-badge", "Coming soon"));
  guideArticle.appendChild(createElement("h1", null, `${name} City Guide`));
  guideArticle.appendChild(createElement("p", null,
    `A practical guide to living and studying in ${name}: what to do before you move, permits, healthcare, housing, transport and daily life.`));
  if (cohort) guideArticle.appendChild(createElement("p", null, `Who studies here: ${cityPresenceText(cohort, guide.university)}.`));
}

function showGuideError(message) {
  cityGuideState = null;
  guideArticle.replaceChildren();
  const empty = createElement("div", "cg-empty-state");
  empty.append(
    createElement("h1", null, "City guide unavailable"),
    createElement("p", null, message),
    cgLink("Browse all city guides", "city-guide.html", "button button-quiet")
  );
  const retry = cgButton("Try again", "button");
  retry.addEventListener("click", refreshGuidePage);
  empty.appendChild(retry);
  guideArticle.appendChild(empty);
}

async function loadGuidePage() {
  // The tracks file says who studies where; the guides still work if it cannot be loaded
  let cohort = null;
  try {
    cohort = tracksCohort(await loadTracksFile(), loadMyTrack()?.cohort);
  } catch (error) {
    console.error("Could not load tracks:", error);
  }

  const cityKey = new URLSearchParams(window.location.search).get("city");
  if (!cityKey) {
    await showCityIndex(cohort);
    openExternalLinksInNewTab(guideArticle);
    return;
  }
  const guide = CITY_GUIDES.find((g) => g.id === cityKey.toLowerCase());
  if (!guide) {
    showGuideError(`Sorry, there is no guide for "${cityKey}" yet.`);
    return;
  }
  const name = cityName(cohort, guide);
  document.title = `${name} City Guide – EU-HEM Student Hub`;
  if (!guide.file) {
    showComingSoon(name, cohort, guide);
    return;
  }

  try {
    if (typeof marked === "undefined") throw new Error("Markdown library did not load");
    const response = await fetch(guide.file, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseGuide(await response.text());

    // The guides are written by us, so they are trusted. If students can submit
    // content later (Phase 2), it must be cleaned with a sanitizer first.
    if (!parsed.structured) throw new Error("Guide has no facts block (see docs/city-guides.md)");
    await renderStructuredGuide(guide, parsed, cohort);
    openExternalLinksInNewTab(guideArticle);

    // If the address already points at a section (e.g. #housing), open it and jump there
    revealHashTarget();
    window.addEventListener("hashchange", revealHashTarget);
  } catch (error) {
    console.error("Could not load guide:", error);
    showGuideError("Sorry, the guide could not be loaded right now. Please try again later.");
  }
}

function refreshGuidePage() {
  guideArticle.setAttribute("aria-busy", "true");
  return loadGuidePage().catch((error) => {
    console.error("Could not show city guides:", error);
    showGuideError("The guide could not be loaded. Please try again.");
  }).finally(() => guideArticle.setAttribute("aria-busy", "false"));
}

refreshGuidePage();
