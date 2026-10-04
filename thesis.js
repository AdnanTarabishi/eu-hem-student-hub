// ===== Past Thesis Explorer (thesis.html) =====
// Draws the page from content/thesis-archive.json and content/thesis-config.json, using the
// helpers in thesis-data.js. Search, filters and sorting are kept in the address (URL), so a view
// can be shared and the Back button works. Every number on the page is counted from the data.

const thesis = {
  config: null,
  records: [], // prepared for searching (thesis-data.js)
  counts: null, // whole-archive counts
  state: { q: "", cohort: "", track: "", university: "", sort: "newest", topic: "" },
  shown: 20, // results shown before "Show more"
};
const THESIS_PAGE_SIZE = 20;
const THESIS_NARROW = "(max-width: 760px)";

function trackLabel(code) {
  return `${code} · ${thesis.config.legacyTracks[code]}`;
}

// "UiO · University of Oslo"; just the name when it already starts with the code ("MCI | …")
function universityLabel(code) {
  const name = thesis.config.universities[code].name;
  return name.startsWith(code) ? name : `${code} · ${name}`;
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (m, key) => values[key] ?? m);
}

// ----- Address (URL) <-> state -----

function writeUrl(push) {
  const url = `thesis.html${paramsFromState(thesis.state)}`;
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

// A filter, sort or search change: back to the first page of results
function changeState(changes, push = true) {
  Object.assign(thesis.state, changes);
  if (!("topic" in changes)) thesis.state.topic = "";
  thesis.shown = THESIS_PAGE_SIZE;
  writeUrl(push);
  renderResults();
}

function clearFilters() {
  changeState({ q: "", cohort: "", track: "", university: "" });
  document.getElementById("thesis-search").value = "";
}

// Applies a filter from the browse cards / examples and scrolls to the results
function showInExplorer(changes) {
  document.getElementById("thesis-search").value = changes.q || "";
  changeState({ q: "", cohort: "", track: "", university: "", ...changes });
  document.getElementById("thesis-explorer").scrollIntoView({ block: "start" });
}

// ----- Intro, notice, statistics -----

function renderIntro() {
  const { texts } = thesis.config;
  const records = thesis.records;
  const cohorts = cohortsNewestFirst(records);
  const section = document.getElementById("thesis-intro");
  const h1 = createElement("h1", null, texts.title);
  h1.id = "thesis-title";
  section.appendChild(h1);
  section.appendChild(createElement("p", "thesis-tagline", fill(texts.tagline, { count: records.length })));
  section.appendChild(createElement("p", "thesis-intro-text", texts.intro));

  // Historical notice (the cohort range is counted from the data)
  const range = cohorts.length > 1
    ? `${cohortLabel(cohorts[cohorts.length - 1])} to ${cohortLabel(cohorts[0])}`
    : cohortLabel(cohorts[0] || "");
  const notice = createElement("div", "thesis-notice");
  notice.setAttribute("role", "note");
  notice.appendChild(siteIcon("info"));
  const body = createElement("div");
  body.appendChild(createElement("p", "thesis-notice-main", fill(texts.historical, { cohortRange: range })));
  body.appendChild(createElement("p", "thesis-notice-small", texts.historicalSmall));
  const link = createElement("a", null, "See the current tracks →");
  link.href = "tracks.html";
  body.appendChild(link);
  notice.appendChild(body);
  section.appendChild(notice);

  // "In this archive"
  const stats = createElement("dl", "thesis-stats");
  stats.setAttribute("aria-label", "In this archive");
  const items = [
    [records.length, records.length === 1 ? "thesis topic" : "thesis topics"],
    [Object.keys(thesis.counts.university).length, "partner universities"],
    [Object.keys(thesis.counts.track).length, "legacy specialisations"],
    [cohorts.length, cohorts.length === 1 ? "cohort" : "cohorts"],
  ];
  const label = createElement("p", "thesis-stats-label", "In this archive");
  section.appendChild(label);
  for (const [value, name] of items) {
    const item = createElement("div", "thesis-stat");
    item.appendChild(createElement("dt", null, name));
    item.appendChild(createElement("dd", null, String(value)));
    stats.appendChild(item);
  }
  section.appendChild(stats);
  section.hidden = false;
}

// ----- Filters -----

function setOptions(select, options, value) {
  select.innerHTML = "";
  for (const [optionValue, text] of options) {
    const option = createElement("option", null, text);
    option.value = optionValue;
    option.selected = optionValue === value;
    select.appendChild(option);
  }
}

function renderFilters() {
  const { state, records } = thesis;
  const synonyms = thesis.config.synonyms;
  const filters = [
    ["cohort", "filter-cohort", "All cohorts", cohortsNewestFirst(records), cohortLabel],
    ["track", "filter-track", "All legacy tracks", Object.keys(thesis.config.legacyTracks).filter((c) => thesis.counts.track[c]), trackLabel],
    ["university", "filter-university", "All universities", Object.keys(thesis.config.universities).filter((c) => thesis.counts.university[c]), universityLabel],
  ];
  for (const [key, id, allText, values, label] of filters) {
    const counts = optionCounts(records, state, synonyms, key);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    setOptions(document.getElementById(id), [
      ["", `${allText} (${total})`],
      ...values.map((v) => [v, `${label(v)} (${counts[v] || 0})`]),
    ], state[key]);
  }
  setOptions(document.getElementById("thesis-sort"), Object.entries(THESIS_SORTS), state.sort);

  // Active filters as removable chips (text, not only colour)
  const chips = document.getElementById("thesis-chips");
  chips.innerHTML = "";
  const active = [
    ["q", state.q && `Search: “${state.q}”`],
    ["cohort", state.cohort && `Cohort: ${cohortLabel(state.cohort)}`],
    ["track", state.track && `Legacy track: ${trackLabel(state.track)}`],
    ["university", state.university && `University: ${universityLabel(state.university)}`],
  ].filter(([, text]) => text);
  for (const [key, text] of active) {
    const chip = createElement("button", "thesis-chip");
    chip.type = "button";
    chip.setAttribute("aria-label", `Remove ${text}`);
    chip.appendChild(createElement("span", null, text));
    chip.appendChild(createElement("span", "thesis-chip-x", "×"));
    chip.lastChild.setAttribute("aria-hidden", "true");
    chip.addEventListener("click", () => {
      if (key === "q") document.getElementById("thesis-search").value = "";
      changeState({ [key]: "" });
    });
    chips.appendChild(chip);
  }
  document.getElementById("thesis-clear").hidden = active.length === 0;
  const filterCount = THESIS_FILTERS.filter((k) => state[k]).length;
  document.getElementById("thesis-filters-summary").textContent = filterCount ? `Filters (${filterCount} active)` : "Filters";
}

// ----- Results -----

// The title with the matched words marked (built without HTML strings)
function highlightedTitle(record, matched) {
  const fragment = document.createDocumentFragment();
  const title = record.titleDisplay;
  let at = 0;
  record.words.forEach((word, i) => {
    if (!matched.has(i)) return;
    if (word.start > at) fragment.appendChild(document.createTextNode(title.slice(at, word.start)));
    fragment.appendChild(createElement("mark", null, title.slice(word.start, word.end)));
    at = word.end;
  });
  if (at < title.length) fragment.appendChild(document.createTextNode(title.slice(at)));
  return fragment;
}

function badge(text, className) {
  return createElement("span", `thesis-badge ${className}`, text);
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    if (typeof toast === "function") toast(message);
  } catch {
    if (typeof toast === "function") toast("Copying is not available here. Select the text and copy it yourself.");
  }
}

function cardDetails(record) {
  const { texts } = thesis.config;
  const uni = thesis.config.universities[record.universityCode];
  const box = createElement("div", "thesis-card-details");
  box.id = `details-${record.id}`;

  const actions = createElement("div", "thesis-card-actions");
  const copy = createElement("button", "button button-quiet", "Copy title");
  copy.type = "button";
  copy.addEventListener("click", () => copyText(record.titleDisplay, "Title copied ✓"));
  actions.appendChild(copy);
  const copyLink = createElement("button", "button button-quiet", "Copy link to this topic");
  copyLink.type = "button";
  copyLink.addEventListener("click", () => {
    const url = new URL(`thesis.html?topic=${record.id}`, window.location.href).href;
    copyText(url, "Link copied ✓");
  });
  actions.appendChild(copyLink);
  box.appendChild(actions);

  box.appendChild(createElement("h4", null, "Look for the full thesis"));
  const links = createElement("ul", "thesis-find");
  const scholar = createElement("li");
  const a = createElement("a", null, "Search this exact title on Google Scholar ↗");
  a.href = `https://scholar.google.com/scholar?q=${encodeURIComponent(`"${record.titleDisplay}"`)}`;
  a.target = "_blank";
  a.rel = "noopener";
  scholar.appendChild(a);
  links.appendChild(scholar);
  if (uni.repository) {
    const li = createElement("li");
    const repo = createElement("a", null, `${uni.repository.label} ↗`);
    repo.href = uni.repository.url;
    repo.target = "_blank";
    repo.rel = "noopener";
    li.appendChild(repo);
    links.appendChild(li);
  }
  box.appendChild(links);
  box.appendChild(createElement("p", "thesis-small", texts.notAvailable));

  const more = createElement("button", "button button-light", `More from ${record.trackName} at ${uni.name}`);
  more.type = "button";
  more.addEventListener("click", () => showInExplorer({ track: record.trackCode, university: record.universityCode }));
  box.appendChild(more);
  box.appendChild(createElement("p", "thesis-small thesis-card-note", texts.cardNote));
  return box;
}

function resultCard({ record, matched }) {
  const li = createElement("li", "thesis-card");
  li.dataset.id = record.id;
  const heading = createElement("h3", "thesis-card-title");
  const toggle = createElement("button", "thesis-card-toggle");
  toggle.type = "button";
  toggle.id = `topic-${record.id}`;
  toggle.setAttribute("aria-controls", `details-${record.id}`);
  toggle.appendChild(highlightedTitle(record, matched));
  heading.appendChild(toggle);
  li.appendChild(heading);
  const badges = createElement("div", "thesis-badges");
  badges.appendChild(badge(cohortLabel(record.cohort), "is-cohort"));
  const track = badge(`Legacy track: ${trackLabel(record.trackCode)}`, "is-track");
  badges.appendChild(track);
  badges.appendChild(badge(universityLabel(record.universityCode), "is-university"));
  li.appendChild(badges);

  const open = thesis.state.topic === record.id;
  toggle.setAttribute("aria-expanded", String(open));
  if (open) li.appendChild(cardDetails(record));
  li.classList.toggle("is-open", open);
  toggle.addEventListener("click", () => {
    const opening = thesis.state.topic !== record.id;
    // Only one card open at a time; the open card is part of the address (shareable)
    thesis.state.topic = opening ? record.id : "";
    writeUrl(false);
    for (const card of document.querySelectorAll(".thesis-card.is-open")) {
      card.classList.remove("is-open");
      card.querySelector(".thesis-card-details")?.remove();
      card.querySelector(".thesis-card-toggle").setAttribute("aria-expanded", "false");
    }
    if (opening) {
      li.appendChild(cardDetails(record));
      li.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    }
  });
  return li;
}

function renderResults() {
  const { state, records } = thesis;
  const results = thesisResults(records, state, thesis.config.synonyms);
  // A shared link to one topic: make sure that card is within the shown results
  if (state.topic) {
    const index = results.findIndex((r) => r.record.id === state.topic);
    if (index >= thesis.shown) thesis.shown = Math.ceil((index + 1) / THESIS_PAGE_SIZE) * THESIS_PAGE_SIZE;
  }
  const list = document.getElementById("thesis-results");
  list.innerHTML = "";
  for (const result of results.slice(0, thesis.shown)) list.appendChild(resultCard(result));
  const n = results.length;
  document.getElementById("thesis-count").textContent = n === 1 ? "1 topic found" : `${n} topics found`;
  document.getElementById("thesis-empty").hidden = n > 0;
  const more = document.getElementById("thesis-more");
  more.hidden = n <= thesis.shown;
  more.textContent = `Show more (${Math.min(THESIS_PAGE_SIZE, n - thesis.shown)} of ${n - thesis.shown} remaining)`;
  renderFilters();
}

// ----- Browse -----

function renderBrowse() {
  const { config, counts } = thesis;
  const section = document.getElementById("thesis-browse");

  // Historical track structure
  const tracksHead = createElement("div", "section-head");
  const h2 = createElement("h2", "section-title", "Browse the historical track structure");
  h2.id = "browse-tracks-title";
  tracksHead.appendChild(h2);
  tracksHead.appendChild(createElement("p", "section-sub", "The six specialisations the programme had when these theses were written. They are not the current tracks."));
  section.appendChild(tracksHead);
  const trackGrid = createElement("div", "thesis-browse-grid");
  for (const code of Object.keys(config.legacyTracks).filter((c) => counts.track[c])) {
    const card = createElement("button", "thesis-browse-card");
    card.type = "button";
    card.appendChild(createElement("span", "thesis-browse-code", `Legacy track · ${code}`));
    card.appendChild(createElement("strong", null, config.legacyTracks[code]));
    card.appendChild(createElement("span", null, `${counts.track[code]} ${counts.track[code] === 1 ? "topic" : "topics"}`));
    card.addEventListener("click", () => showInExplorer({ track: code }));
    trackGrid.appendChild(card);
  }
  section.appendChild(trackGrid);

  // Universities
  const uniHead = createElement("h2", "section-title thesis-subhead", "Browse by university");
  uniHead.id = "browse-universities-title";
  section.appendChild(uniHead);
  const uniGrid = createElement("div", "thesis-browse-grid is-universities");
  for (const code of Object.keys(config.universities).filter((c) => counts.university[c])) {
    const card = createElement("button", "thesis-browse-card");
    card.type = "button";
    card.appendChild(createElement("span", "thesis-browse-code", code));
    card.appendChild(createElement("strong", null, config.universities[code].name));
    card.appendChild(createElement("span", null, `${counts.university[code]} ${counts.university[code] === 1 ? "topic" : "topics"} in this archive`));
    card.addEventListener("click", () => showInExplorer({ university: code }));
    uniGrid.appendChild(card);
  }
  section.appendChild(uniGrid);

  // Legacy tracks × universities (numbers link to both filters)
  const matrixHead = createElement("h2", "section-title thesis-subhead", "Tracks and universities in this archive");
  matrixHead.id = "thesis-matrix-title";
  section.appendChild(matrixHead);
  section.appendChild(createElement("p", "section-sub", "How many topics each legacy track has at each university. Select a number to see those topics."));
  const tracks = Object.keys(config.legacyTracks).filter((c) => counts.track[c]);
  const unis = Object.keys(config.universities).filter((c) => counts.university[c]);
  const link = (track, uni, n) => {
    if (!n) return createElement("span", "thesis-matrix-zero", "–");
    const a = createElement("a", "thesis-matrix-link", String(n));
    a.href = `thesis.html?track=${encodeURIComponent(track)}&university=${encodeURIComponent(uni)}`;
    a.setAttribute("aria-label", `${n} ${n === 1 ? "topic" : "topics"}: ${config.legacyTracks[track]} at ${config.universities[uni].name}`);
    a.addEventListener("click", (event) => {
      event.preventDefault();
      showInExplorer({ track, university: uni });
    });
    return a;
  };
  // Wide screens: a table
  const wrap = createElement("div", "thesis-matrix-wrap");
  const table = createElement("table", "thesis-matrix");
  table.appendChild(createElement("caption", "visually-hidden", "Number of topics per legacy track and university"));
  const head = createElement("tr");
  head.appendChild(createElement("th", null, "Legacy track"));
  head.lastChild.setAttribute("scope", "col");
  for (const uni of unis) {
    const th = createElement("th", null, uni);
    th.setAttribute("scope", "col");
    th.title = config.universities[uni].name;
    head.appendChild(th);
  }
  const thead = createElement("thead");
  thead.appendChild(head);
  table.appendChild(thead);
  const tbody = createElement("tbody");
  for (const track of tracks) {
    const row = createElement("tr");
    const th = createElement("th", null, trackLabel(track));
    th.setAttribute("scope", "row");
    row.appendChild(th);
    for (const uni of unis) {
      const td = createElement("td");
      td.appendChild(link(track, uni, (counts.matrix[track] || {})[uni] || 0));
      row.appendChild(td);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  // Phones: one small card per legacy track
  const stacked = createElement("div", "thesis-matrix-stacked");
  for (const track of tracks) {
    const card = createElement("div", "thesis-matrix-card");
    card.appendChild(createElement("strong", null, trackLabel(track)));
    const list = createElement("ul");
    for (const uni of unis) {
      const n = (counts.matrix[track] || {})[uni] || 0;
      if (!n) continue;
      const li = createElement("li");
      li.appendChild(createElement("span", null, config.universities[uni].name));
      li.appendChild(link(track, uni, n));
      list.appendChild(li);
    }
    card.appendChild(list);
    stacked.appendChild(card);
  }
  section.appendChild(stacked);
  section.hidden = false;
}

// ----- Examples -----

function renderExamples() {
  const examples = (thesis.config.examples || [])
    .map((title) => thesis.records.find((r) => r.titleDisplay === title))
    .filter(Boolean); // titles not found exactly are left out (the checker reports them)
  if (!examples.length) return;
  const section = document.getElementById("thesis-examples");
  const head = createElement("div", "section-head");
  const h2 = createElement("h2", "section-title", "Explore the range of past research");
  h2.id = "thesis-examples-title";
  head.appendChild(h2);
  head.appendChild(createElement("p", "section-sub", "A few varied examples from the archive, chosen to show its breadth, not ranked or selected as the best."));
  section.appendChild(head);
  const list = createElement("ul", "thesis-examples");
  for (const record of examples) {
    const li = createElement("li");
    const a = createElement("a", "thesis-example");
    a.href = `thesis.html?topic=${record.id}`;
    a.appendChild(createElement("span", "thesis-example-title", record.titleDisplay));
    a.appendChild(createElement("span", "thesis-example-meta", `${cohortLabel(record.cohort)} · Legacy track ${record.trackCode} · ${record.universityCode}`));
    a.addEventListener("click", (event) => {
      event.preventDefault();
      showInExplorer({ topic: record.id });
      document.getElementById(`topic-${record.id}`)?.focus();
    });
    li.appendChild(a);
    list.appendChild(li);
  }
  section.appendChild(list);
  section.hidden = false;
}

// ----- Inspiration, your own thesis, source -----

function renderNotes() {
  const { texts } = thesis.config;
  const section = document.getElementById("thesis-notes");
  const inspiration = createElement("div", "thesis-callout");
  const h2 = createElement("h2", null, texts.inspirationTitle);
  h2.id = "thesis-inspiration-title";
  inspiration.appendChild(h2);
  inspiration.appendChild(createElement("p", null, texts.inspiration));
  section.appendChild(inspiration);

  const own = createElement("div", "thesis-own");
  own.appendChild(createElement("h2", null, "Your own thesis"));
  const p = createElement("p", null, `${texts.ownThesis} `);
  const tracks = createElement("a", null, "See where each track's thesis can be written →");
  tracks.href = "tracks.html";
  p.appendChild(tracks);
  own.appendChild(p);
  own.appendChild(createElement("p", null, texts.ownThesisOfficial));
  section.appendChild(own);

  const source = createElement("div", "thesis-source");
  source.appendChild(createElement("h2", null, "About this archive"));
  source.appendChild(createElement("p", null, texts.source));
  const contact = createElement("p", null, `${texts.sourceContact} `);
  const a = createElement("a", null, "Contact us");
  a.href = "contact.html";
  contact.appendChild(a);
  contact.appendChild(document.createTextNode("."));
  source.appendChild(contact);
  section.appendChild(source);
  section.hidden = false;
}

// ----- Start -----

function syncControls() {
  document.getElementById("thesis-search").value = thesis.state.q;
}

async function initThesisPage() {
  const status = document.getElementById("thesis-status");
  try {
    const { archive, config } = await loadThesisFiles();
    thesis.config = config;
    thesis.records = prepareRecords(archive.records);
    thesis.counts = archiveCounts(archive.records);
    thesis.state = stateFromParams(new URLSearchParams(window.location.search), archive.records);
    renderIntro();
    renderBrowse();
    renderExamples();
    renderNotes();
    document.getElementById("thesis-explorer").hidden = false;
    syncControls();
    renderResults();
    status.remove();

    // Search as you type (the address is updated quietly, without filling the Back history)
    let timer = null;
    document.getElementById("thesis-search").addEventListener("input", (event) => {
      clearTimeout(timer);
      timer = setTimeout(() => changeState({ q: event.target.value.trim() }, false), 150);
    });
    for (const [id, key] of [["filter-cohort", "cohort"], ["filter-track", "track"], ["filter-university", "university"], ["thesis-sort", "sort"]]) {
      document.getElementById(id).addEventListener("change", (event) => changeState({ [key]: event.target.value }));
    }
    document.getElementById("thesis-clear").addEventListener("click", clearFilters);
    document.querySelector("#thesis-empty [data-clear]").addEventListener("click", clearFilters);
    document.getElementById("thesis-more").addEventListener("click", () => {
      const first = thesis.shown;
      thesis.shown += THESIS_PAGE_SIZE;
      renderResults();
      // Move keyboard focus to the first new result
      document.querySelectorAll(".thesis-card-toggle")[first]?.focus();
    });
    // Back / Forward: restore the view from the address
    window.addEventListener("popstate", () => {
      thesis.state = stateFromParams(new URLSearchParams(window.location.search), archive.records);
      thesis.shown = THESIS_PAGE_SIZE;
      syncControls();
      renderResults();
    });
    // Filters open on wide screens, folded on phones
    const media = window.matchMedia(THESIS_NARROW);
    const filters = document.getElementById("thesis-filters");
    filters.open = !media.matches;
    media.addEventListener("change", (event) => { filters.open = !event.matches; });
    // A shared link to one topic: show it
    if (thesis.state.topic) {
      const toggle = document.getElementById(`topic-${thesis.state.topic}`);
      toggle?.scrollIntoView({ block: "center" });
      toggle?.focus({ preventScroll: true });
    }
  } catch (error) {
    console.error("Thesis:", error);
    status.textContent = "Sorry, the thesis archive could not be loaded right now. Please try again later.";
  }
}

if (typeof document !== "undefined" && document.getElementById("thesis-status")) initThesisPage();
