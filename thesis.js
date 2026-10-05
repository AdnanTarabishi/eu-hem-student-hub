// ===== Past Thesis Explorer (thesis.html) =====
// Draws the page from the historical archive (content/thesis-archive.json), its settings
// (content/thesis-config.json), the Student Hub classification (content/thesis-enrichment.json) and
// the current tracks (content/tracks.json), using thesis-data.js, thesis-enrichment.js and
// tracks-data.js. Search, filters, sorting and the browse tab are kept in the address (URL), so a
// view can be shared and the Back button works. Every number on the page is counted from the data.
// Historical facts and Student Hub interpretation are always shown, and labelled, separately.

const thesis = {
  config: null,
  enrichment: null,
  cohort: null, // the current tracks (tracks.json, newest cohort)
  themes: [], // topic themes [{ id, label, … }]
  entries: {}, // enrichment by thesis id
  records: [], // prepared for searching (thesis-data.js), with their classification attached
  counts: null, // whole-archive counts
  state: { q: "", cohort: "", track: "", university: "", theme: "", currentTrack: "", method: "", sort: "newest", browse: "interest", topic: "" },
  shown: 20, // results shown before "Show more"
};
const THESIS_PAGE_SIZE = 20;
const THESIS_NARROW = "(max-width: 760px)";
const THESIS_THEMES_ON_CARD = 2;

function trackLabel(code) {
  return `${code} · ${thesis.config.legacyTracks[code]}`;
}

// "UiO · University of Oslo"; just the name when it already starts with the code ("MCI | …")
function universityLabel(code) {
  const name = thesis.config.universities[code].name;
  return name.startsWith(code) ? name : `${code} · ${name}`;
}

function themeLabel(id) {
  return (thesis.themes.find((t) => t.id === id) || {}).label || id;
}

function methodLabel(id) {
  return (thesis.enrichment.methods.find((m) => m.id === id) || {}).label || id;
}

function currentTrack(id) {
  return thesis.cohort.tracks.find((t) => t.id === id);
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (m, key) => values[key] ?? m);
}

// True while any classification shown on the page is still a draft (not yet reviewed by a student)
function classificationIsDraft() {
  return thesis.records.some((r) => r.entry && r.entry.status === "draft");
}

function draftLabel() {
  return createElement("span", "thesis-draft", "Draft classification — under review");
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
  renderBrowsePanel();
}

const NO_FILTERS = { q: "", cohort: "", track: "", university: "", theme: "", currentTrack: "", method: "" };

function clearFilters() {
  changeState({ ...NO_FILTERS });
  document.getElementById("thesis-search").value = "";
}

// Applies filters from the browse panel / examples / related topics and moves to the results
function showInExplorer(changes) {
  document.getElementById("thesis-search").value = changes.q || "";
  changeState({ ...NO_FILTERS, ...changes });
  document.getElementById("thesis-explorer").scrollIntoView({ block: "start" });
}

// ----- Intro, notice, statistics -----

// Needs only the archive and its settings, so it is drawn before the classification arrives
function renderIntro(records) {
  const { texts } = thesis.config;
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
  section.appendChild(createElement("p", "thesis-stats-label", "In this archive"));
  for (const [value, name] of items) {
    const item = createElement("div", "thesis-stat");
    item.appendChild(createElement("dt", null, name));
    item.appendChild(createElement("dd", null, String(value)));
    stats.appendChild(item);
  }
  section.appendChild(stats);
  section.hidden = false;
}

// ----- Browse: one panel with tabs -----

const BROWSE_TABS = [
  ["interest", "Interest"],
  ["currentTrack", "Current track"],
  ["legacy", "Legacy track"],
  ["university", "University"],
];

function renderBrowse() {
  const section = document.getElementById("thesis-browse");
  const head = createElement("div", "thesis-browse-head");
  const h2 = createElement("h2", "section-title", "Explore the archive");
  h2.id = "thesis-browse-title";
  head.appendChild(h2);
  // "My track" from the Tracks page (saved on this device), if set: a subtle shortcut
  const saved = typeof loadMyTrack === "function" ? loadMyTrack() : null;
  const mine = saved && currentTrack(saved.track);
  if (mine) {
    const hint = createElement("p", "thesis-mytrack");
    hint.appendChild(document.createTextNode(`Your track: ${mine.name}. `));
    const go = createElement("button", "thesis-link-button", `Explore historical topics potentially relevant to ${mine.abbr} →`);
    go.type = "button";
    go.addEventListener("click", () => showInExplorer({ currentTrack: mine.id }));
    hint.appendChild(go);
    head.appendChild(hint);
  }
  section.appendChild(head);

  const tabs = createElement("div", "track-tabs thesis-browse-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Explore by");
  for (const [key, label] of BROWSE_TABS) {
    const tab = createElement("button", "track-tab", label);
    tab.type = "button";
    tab.id = `browse-tab-${key}`;
    tab.dataset.key = key;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "thesis-browse-panel");
    tab.addEventListener("click", () => selectBrowseTab(key));
    tabs.appendChild(tab);
  }
  tabs.addEventListener("keydown", (event) => {
    const keys = BROWSE_TABS.map(([k]) => k);
    const at = keys.indexOf(document.activeElement.dataset.key);
    if (at < 0) return;
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: keys.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectBrowseTab(keys[(next + keys.length) % keys.length], true);
  });
  section.appendChild(tabs);
  const panel = createElement("div", "thesis-browse-panel");
  panel.id = "thesis-browse-panel";
  panel.setAttribute("role", "tabpanel");
  panel.tabIndex = 0;
  section.appendChild(panel);
  section.hidden = false;
  renderBrowsePanel();
}

// The tab choice is kept in the address, without adding a Back step
function selectBrowseTab(key, focus = false) {
  thesis.state.browse = key;
  writeUrl(false);
  renderBrowsePanel();
  if (focus) document.getElementById(`browse-tab-${key}`).focus();
}

// A browse choice: a button showing its name and how many topics it has. Selected = ✓ + aria-pressed.
function browsePill(name, countText, selected, onClick, code) {
  const pill = createElement("button", "thesis-pill");
  pill.type = "button";
  pill.setAttribute("aria-pressed", String(selected));
  if (code) pill.appendChild(createElement("span", "thesis-pill-code", code));
  pill.appendChild(createElement("strong", null, `${selected ? "✓ " : ""}${name}`));
  pill.appendChild(createElement("span", "thesis-pill-count", countText));
  pill.addEventListener("click", onClick);
  return pill;
}

function classificationLabel(text) {
  const label = createElement("p", "thesis-class-note");
  label.appendChild(createElement("strong", null, text));
  if (classificationIsDraft()) {
    label.appendChild(document.createTextNode(" "));
    label.appendChild(draftLabel());
  }
  return label;
}

function renderBrowsePanel() {
  const panel = document.getElementById("thesis-browse-panel");
  if (!panel) return;
  const { state, config, counts, records } = thesis;
  for (const tab of document.querySelectorAll(".thesis-browse-tabs [role=tab]")) {
    const on = tab.dataset.key === state.browse;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
  }
  panel.setAttribute("aria-labelledby", `browse-tab-${state.browse}`);
  panel.innerHTML = "";
  const grid = createElement("div", "thesis-pills");
  const topics = (n) => `${n} ${n === 1 ? "topic" : "topics"}`;

  if (state.browse === "interest") {
    panel.appendChild(createElement("p", "thesis-browse-intro", "Start with a research area and see how previous EU-HEM students approached it."));
    panel.appendChild(classificationLabel("Student Hub classification of the titles"));
    for (const theme of thesis.themes) {
      const n = records.filter((r) => r.themes.includes(theme.id)).length;
      if (!n) continue;
      grid.appendChild(browsePill(theme.label, topics(n), state.theme === theme.id, () => showInExplorer({ theme: theme.id })));
    }
  } else if (state.browse === "currentTrack") {
    panel.appendChild(createElement("p", "thesis-browse-intro", "See historical thesis topics that may be relevant to the focus of today's four EU-HEM tracks."));
    panel.appendChild(classificationLabel("Student Hub thematic classification — not official track assignment."));
    for (const track of thesis.cohort.tracks) {
      const n = records.filter((r) => r.currentTracks.includes(track.id)).length;
      grid.appendChild(browsePill(track.name, `${n} historical ${n === 1 ? "topic" : "topics"} potentially relevant`, state.currentTrack === track.id,
        () => showInExplorer({ currentTrack: track.id }), track.abbr));
    }
  } else if (state.browse === "legacy") {
    panel.appendChild(createElement("p", "thesis-browse-intro", "The six specialisations the programme had when these theses were written. They are not the current tracks."));
    for (const code of Object.keys(config.legacyTracks).filter((c) => counts.track[c])) {
      grid.appendChild(browsePill(config.legacyTracks[code], topics(counts.track[code]), state.track === code,
        () => showInExplorer({ track: code }), `Legacy track · ${code}`));
    }
  } else {
    panel.appendChild(createElement("p", "thesis-browse-intro", "Where the theses were written."));
    for (const code of Object.keys(config.universities).filter((c) => counts.university[c])) {
      grid.appendChild(browsePill(config.universities[code].name, `${topics(counts.university[code])} in this archive`, state.university === code,
        () => showInExplorer({ university: code }), code));
    }
  }
  panel.appendChild(grid);
  if (state.browse === "currentTrack") panel.appendChild(createElement("p", "thesis-small", thesis.enrichment.relevanceNote));
  if (state.browse === "university") panel.appendChild(archiveMatrix());
}

// Legacy tracks × universities (numbers link to both filters): a table, or stacked cards on phones
function archiveMatrix() {
  const { config, counts } = thesis;
  const box = createElement("div", "thesis-matrix-box");
  const h3 = createElement("h3", null, "Tracks and universities in this archive");
  h3.id = "thesis-matrix-title";
  box.appendChild(h3);
  box.appendChild(createElement("p", "section-sub", "How many topics each legacy track has at each university. Select a number to see those topics."));
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
  box.appendChild(wrap);
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
  box.appendChild(stacked);
  return box;
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
  const { state, records, config } = thesis;
  const synonyms = config.synonyms;
  const filters = [
    ["cohort", "filter-cohort", "All cohorts", cohortsNewestFirst(records), cohortLabel],
    ["track", "filter-track", "All legacy tracks", Object.keys(config.legacyTracks).filter((c) => thesis.counts.track[c]), trackLabel],
    ["university", "filter-university", "All universities", Object.keys(config.universities).filter((c) => thesis.counts.university[c]), universityLabel],
    ["theme", "filter-theme", "All themes", thesis.themes.map((t) => t.id), themeLabel],
    ["currentTrack", "filter-current-track", "Any current track", thesis.cohort.tracks.map((t) => t.id), (id) => `${currentTrack(id).abbr} · ${currentTrack(id).name}`],
    ["method", "filter-method", "Any (or none named)", thesis.enrichment.methods.map((m) => m.id), methodLabel],
  ];
  for (const [key, id, allText, values, label] of filters) {
    const counts = optionCounts(records, state, synonyms, key);
    const total = records.filter((r) => passesFilters(r, state, key) && searchMatches(r)).length;
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
    ["theme", state.theme && `Theme: ${themeLabel(state.theme)}`],
    ["currentTrack", state.currentTrack && `Current track: ${currentTrack(state.currentTrack).name}`],
    ["method", state.method && `Stated method: ${methodLabel(state.method)}`],
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

// Whether a record matches the current search (used for the "All …" option counts)
let searchCache = { q: null, ids: null };
function searchMatches(record) {
  if (searchCache.q !== thesis.state.q) {
    searchCache = { q: thesis.state.q, ids: new Set(searchRecords(thesis.records, thesis.state.q, thesis.config.synonyms).map((r) => r.record.id)) };
  }
  return searchCache.ids.has(record.id);
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

// A current track's abbreviation, with its full name for screen readers and on hover
function trackAbbr(id) {
  const track = currentTrack(id);
  const abbr = createElement("abbr", "thesis-rel-track", track.abbr);
  abbr.title = track.name;
  abbr.setAttribute("aria-label", track.name);
  return abbr;
}

// The Student Hub layer on a card: up to 2 themes (+n) and the potentially relevant tracks
function cardClassification(record) {
  const box = createElement("div", "thesis-classification");
  box.appendChild(createElement("span", "thesis-class-label", "Student Hub classification"));
  const items = createElement("div", "thesis-class-items");
  if (!record.themes.length) items.appendChild(createElement("span", "thesis-theme is-none", "Unclassified"));
  for (const id of record.themes.slice(0, THESIS_THEMES_ON_CARD)) items.appendChild(createElement("span", "thesis-theme", themeLabel(id)));
  const extra = record.themes.length - THESIS_THEMES_ON_CARD;
  if (extra > 0) {
    const more = createElement("span", "thesis-theme is-more", `+${extra}`);
    more.setAttribute("aria-label", `${extra} more ${extra === 1 ? "theme" : "themes"}: ${record.themes.slice(THESIS_THEMES_ON_CARD).map(themeLabel).join(", ")}`);
    items.appendChild(more);
  }
  if (record.currentTracks.length) {
    const rel = createElement("span", "thesis-rel");
    rel.appendChild(document.createTextNode("Potentially relevant to: "));
    record.currentTracks.forEach((id, i) => {
      if (i) rel.appendChild(document.createTextNode(", "));
      rel.appendChild(trackAbbr(id));
    });
    items.appendChild(rel);
  }
  box.appendChild(items);
  return box;
}

function detailClassification(record) {
  const box = createElement("div", "thesis-detail-class");
  const h4 = createElement("h4", null, "Student Hub classification");
  if (record.entry && record.entry.status === "draft") {
    h4.appendChild(document.createTextNode(" "));
    h4.appendChild(draftLabel());
  }
  box.appendChild(h4);
  const list = createElement("dl", "thesis-detail-list");
  const row = (term, value) => {
    list.appendChild(createElement("dt", null, term));
    const dd = createElement("dd");
    if (typeof value === "string") dd.textContent = value;
    else dd.appendChild(value);
    list.appendChild(dd);
  };
  row("Research themes", record.themes.length ? record.themes.map(themeLabel).join(" · ") : "Unclassified (the title is too general to assign a theme)");
  if (record.statedMethods.length) row("Stated method", record.statedMethods.map(methodLabel).join(" · "));
  if (record.statedCountries.length) row("Places named in the title", record.statedCountries.join(" · "));
  const relevance = createElement("div");
  if (record.relevance.length) {
    const ul = createElement("ul", "thesis-relevance");
    for (const result of record.relevance) {
      const track = currentTrack(result.trackId);
      const li = createElement("li");
      const a = createElement("a", null, `${track.name} →`);
      a.href = `tracks.html#track-${track.id}`;
      li.appendChild(a);
      li.appendChild(createElement("span", "thesis-small", relevanceExplanation(result, thesis.enrichment, thesis.cohort, thesis.themes)));
      ul.appendChild(li);
    }
    relevance.appendChild(ul);
  } else {
    relevance.appendChild(createElement("span", null, "No current track is suggested: the title does not give enough evidence."));
  }
  row("Potential relevance to current tracks", relevance);
  box.appendChild(list);
  box.appendChild(createElement("p", "thesis-small", "These labels are Student Hub thematic classifications based on the thesis title and current EU-HEM curriculum."));
  box.appendChild(createElement("p", "thesis-small", thesis.enrichment.relevanceNote));
  return box;
}

function relatedPastTopics(record) {
  const box = createElement("div", "thesis-related");
  box.appendChild(createElement("h4", null, "Related past topics"));
  const related = relatedTopics(record, thesis.records, thesis.entries);
  if (!related.length) {
    box.appendChild(createElement("p", "thesis-small", "No closely related topics in this archive."));
    return box;
  }
  const ul = createElement("ul", "thesis-related-list");
  for (const { record: other } of related) {
    const li = createElement("li");
    const a = createElement("a", "thesis-related-item");
    a.href = `thesis.html?topic=${other.id}`;
    a.appendChild(createElement("span", "thesis-related-title", other.titleDisplay));
    a.appendChild(createElement("span", "thesis-related-meta", `${cohortLabel(other.cohort)} · Legacy track ${trackLabel(other.trackCode)} · ${universityLabel(other.universityCode)}`));
    a.addEventListener("click", (event) => {
      event.preventDefault();
      showInExplorer({ topic: other.id });
      document.getElementById(`topic-${other.id}`)?.focus();
    });
    li.appendChild(a);
    ul.appendChild(li);
  }
  box.appendChild(ul);
  return box;
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

  box.appendChild(detailClassification(record));
  box.appendChild(relatedPastTopics(record));
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
  // Historical source metadata
  const badges = createElement("div", "thesis-badges");
  badges.appendChild(badge(cohortLabel(record.cohort), "is-cohort"));
  badges.appendChild(badge(`Legacy track: ${trackLabel(record.trackCode)}`, "is-track"));
  badges.appendChild(badge(universityLabel(record.universityCode), "is-university"));
  li.appendChild(badges);
  // Student Hub interpretation, visibly separate
  li.appendChild(cardClassification(record));

  const open = thesis.state.topic === record.id;
  toggle.setAttribute("aria-expanded", String(open));
  if (open) li.appendChild(cardDetails(record));
  li.classList.toggle("is-open", open);
  toggle.addEventListener("click", () => openCard(record.id, thesis.state.topic !== record.id));
  return li;
}

// Only one card open at a time; the open card is part of the address (shareable)
function openCard(id, opening) {
  thesis.state.topic = opening ? id : "";
  writeUrl(false);
  for (const card of document.querySelectorAll(".thesis-card.is-open")) {
    card.classList.remove("is-open");
    card.querySelector(".thesis-card-details")?.remove();
    card.querySelector(".thesis-card-toggle").setAttribute("aria-expanded", "false");
  }
  if (!opening) return;
  const li = document.querySelector(`.thesis-card[data-id="${id}"]`);
  const record = thesis.records.find((r) => r.id === id);
  if (!li || !record) return;
  li.appendChild(cardDetails(record));
  li.classList.add("is-open");
  li.querySelector(".thesis-card-toggle").setAttribute("aria-expanded", "true");
}

let currentResults = [];

function renderResults() {
  const { state, records } = thesis;
  const results = thesisResults(records, state, thesis.config.synonyms);
  currentResults = results;
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
  document.getElementById("thesis-inspire").hidden = n === 0;
  // Said once above the results (not on every card) while any shown classification is a draft
  document.getElementById("thesis-draft-note").hidden = !results.some((r) => r.record.entry && r.record.entry.status === "draft");
  const more = document.getElementById("thesis-more");
  more.hidden = n <= thesis.shown;
  more.textContent = `Show more (${Math.min(THESIS_PAGE_SIZE, n - thesis.shown)} of ${n - thesis.shown} remaining)`;
  renderSuggestion();
  renderFilters();
}

// "Filter by theme: …" when the search words name a theme (results stay title-based)
function renderSuggestion() {
  const box = document.getElementById("thesis-suggest");
  box.innerHTML = "";
  const id = themeSuggestion(thesis.state.q, thesis.themes, thesis.enrichment.taxonomy.synonyms);
  box.hidden = !id || thesis.state.theme === id;
  if (box.hidden) return;
  box.appendChild(document.createTextNode("Filter by theme: "));
  const button = createElement("button", "thesis-link-button", themeLabel(id));
  button.type = "button";
  button.addEventListener("click", () => {
    document.getElementById("thesis-search").value = "";
    changeState({ q: "", theme: id });
  });
  box.appendChild(button);
  box.appendChild(createElement("span", "thesis-small", " (Student Hub classification)"));
}

// "Inspire me": a random topic from the current results (or the whole archive), opened in place
function inspireMe() {
  if (!currentResults.length) return;
  const pick = currentResults[Math.floor(Math.random() * currentResults.length)].record;
  thesis.state.topic = pick.id;
  writeUrl(false);
  renderResults();
  const toggle = document.getElementById(`topic-${pick.id}`);
  toggle?.scrollIntoView({ block: "center" });
  toggle?.focus({ preventScroll: true });
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
  source.appendChild(createElement("p", null,
    "Historical thesis metadata comes from a list shared by a previous EU-HEM student. Research themes and relevance to the current four-track structure are classifications created by the Student Hub for discovery and orientation. They are not official EU-HEM classifications."));
  source.appendChild(createElement("p", null, thesis.enrichment.provenance));
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

function allowedValues() {
  return {
    themes: thesis.themes.map((t) => t.id),
    currentTracks: thesis.cohort.tracks.map((t) => t.id),
    methods: thesis.enrichment.methods.map((m) => m.id),
  };
}

async function initThesisPage() {
  const status = document.getElementById("thesis-status");
  try {
    const files = loadThesisFiles();
    const { archive, config } = await files.source;
    thesis.config = config;
    thesis.counts = archiveCounts(archive.records);
    renderIntro(archive.records);
    const { enrichment, tracks } = await files.classification;
    thesis.enrichment = enrichment;
    thesis.cohort = tracksCohort(tracks);
    thesis.themes = topicThemes(enrichment, thesis.cohort);
    thesis.entries = Object.fromEntries(enrichment.records.map((e) => [e.id, e]));
    const trackIds = thesis.cohort.tracks.map((t) => t.id);
    // Attach the Student Hub classification to each record (the archive itself is not changed)
    thesis.records = prepareRecords(archive.records, (record) => {
      const entry = thesis.entries[record.id];
      if (!entry) return { entry: null, relevance: [] };
      const relevance = trackRelevance(entry, enrichment, trackIds);
      return {
        entry,
        themes: entry.themes || [],
        statedMethods: entry.statedMethods || [],
        statedCountries: entry.statedCountries || [],
        relevance,
        currentTracks: relevance.map((r) => r.trackId),
      };
    });
    thesis.state = stateFromParams(new URLSearchParams(window.location.search), archive.records, allowedValues());
    renderBrowse();
    document.getElementById("thesis-explorer").hidden = false;
    syncControls();
    renderResults();
    status.remove();
    // Let the browser show the top of the page before drawing the sections further down
    // (smaller pieces of work keep the page responsive on slow phones)
    await new Promise((resolve) => setTimeout(resolve, 0));
    renderExamples();
    renderNotes();

    // Search as you type (the address is updated quietly, without filling the Back history)
    let timer = null;
    document.getElementById("thesis-search").addEventListener("input", (event) => {
      clearTimeout(timer);
      timer = setTimeout(() => changeState({ q: event.target.value.trim() }, false), 150);
    });
    for (const [id, key] of [["filter-cohort", "cohort"], ["filter-track", "track"], ["filter-university", "university"],
      ["filter-theme", "theme"], ["filter-current-track", "currentTrack"], ["filter-method", "method"], ["thesis-sort", "sort"]]) {
      document.getElementById(id).addEventListener("change", (event) => changeState({ [key]: event.target.value }));
    }
    document.getElementById("thesis-clear").addEventListener("click", clearFilters);
    document.querySelector("#thesis-empty [data-clear]").addEventListener("click", clearFilters);
    document.getElementById("thesis-inspire").addEventListener("click", inspireMe);
    document.getElementById("thesis-more").addEventListener("click", () => {
      const first = thesis.shown;
      thesis.shown += THESIS_PAGE_SIZE;
      renderResults();
      // Move keyboard focus to the first new result
      document.querySelectorAll(".thesis-card-toggle")[first]?.focus();
    });
    // Back / Forward: restore the view from the address
    window.addEventListener("popstate", () => {
      thesis.state = stateFromParams(new URLSearchParams(window.location.search), archive.records, allowedValues());
      thesis.shown = THESIS_PAGE_SIZE;
      syncControls();
      renderResults();
      renderBrowsePanel();
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
