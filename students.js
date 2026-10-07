// ===== Students explorer (students.html) =====
// Shows the community as a map, profile cards or a compact list, with filters, profile details,
// saved profiles and statistics.
//
// Where things live:
//   students-config.js  settings (data mode, page size, map views, track colours)
//   students-data.js    ALL privacy rules and filtering (tested in tests/students/)
//   countries.js        country names and codes; directory-options.js: fields, degrees, tracks
//   docs/students-explorer.md  how it works, privacy rules, how to add real data safely later
//
// Every render follows the same order (students-data.js explains why):
//   project for this viewer -> filter -> count (map, totals, insights) -> sort -> paginate

const SX_CONFIG = window.EUHEM_STUDENTS_CONFIG;
const SX = window.EUHEM_STUDENTS_DATA;
const SX_OPTIONS = window.EUHEM_DIRECTORY_OPTIONS.OPTIONS;
const IS_DEMO = SX_CONFIG.dataMode === "demo";

// ----- Labels -----

const TRACK_LABELS = {
  ...SX_OPTIONS.currentTracks,
  not_chosen: "Not chosen yet",
  prefer_not_to_share: "Not shared",
  unlisted: "Track not shown",
};
const TRACK_ORDER = ["eeh", "ep", "mhi", "phm", "not_chosen", "prefer_not_to_share"];
const MEMBERSHIP_LABELS = { current_student: "Current student", alumni: "Alumni" };
const CITIZENSHIP_LABELS = { eu_eea_swiss: "EU / EEA / Swiss citizen", non_eu_eea_swiss: "Non-EU / EEA / Swiss citizen" };
const VISA_LABELS = { yes: "Yes", no: "No", not_sure: "Not sure", not_applicable: "Not applicable" };
const LABELS = { tracks: TRACK_LABELS };

const FILTER_TITLES = {
  cohort: "Cohort", country: "Country", track: "Current track", background: "Academic background",
  degree: "Degree", membership: "Membership", citizenship: "Citizenship group", visa: "Study-visa experience",
};

// ----- State: one object for everything the visitor has chosen -----

const state = {
  preview: "public", // demo only: "public" or "member"
  filters: emptyFilters(),
  savedOnly: false,
  sort: "name",
  view: "cards",
  page: 1,
  profile: null, // id of the open profile
  mapView: SX_CONFIG.map.defaultView,
};

let records = []; // demo source records (fictional)
let aggregates = null; // precomputed whole-cohort statistics (fictional)
let profiles = []; // what the current viewer may see
let results = []; // after filters and sorting
let mapReady = false;
let lastShownRandom = null;
let returnFocus = null;
let returnFocusId = null;
let savedInTab = null; // ids only, used when this browser refuses device storage
let mapLoading = false;

function emptyFilters() {
  return { cohort: [], country: [], track: [], background: [], degree: [], membership: [], citizenship: [], visa: [], hasLinkedin: false, q: "" };
}

// ----- Page elements -----

const $ = (id) => document.getElementById(id);
const els = {
  stats: $("sx-stats"), search: $("sx-search"), filtersToggle: $("sx-filters-toggle"), filters: $("sx-filters"),
  filterCount: $("sx-filter-count"), primary: $("sx-primary-filters"), more: $("sx-more-filters"),
  memberFilters: $("sx-member-filters"), chips: $("sx-chips"), count: $("sx-result-count"), clearAll: $("sx-clear-all"),
  profiles: $("sx-profiles"), pagination: $("sx-pagination"), sort: $("sx-sort"), random: $("sx-random"),
  savedToggle: $("sx-saved-toggle"), map: $("sx-map"), tooltip: $("sx-map-tooltip"), legend: $("sx-legend"),
  outside: $("sx-map-outside"), panel: $("sx-country-panel"), countryList: $("sx-country-list"),
  drawer: $("sx-drawer"), drawerBody: $("sx-drawer-body"), directoryInsights: $("sx-directory-insights"),
  mobilityInsights: $("sx-mobility-insights"), mapDetails: $("sx-map-details"),
};

// ----- Small helpers -----

function el(tag, className, text) {
  return createElement(tag, className, text); // utils.js
}

function plural(count, singular, pluralWord = singular + "s") {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

// Keep feedback from rapid filter/save actions from covering the mobile directory.
function sxToast(message, options) {
  document.querySelectorAll(".sx-feedback-toast").forEach((item) => item.remove());
  const item = toast(message, options);
  item.classList.add("sx-feedback-toast");
}

function restoreFocus(id) {
  const target = id && $(id);
  if (target) target.focus({ preventScroll: true });
  return !!target;
}

function scrollToSection(target) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

// A save button's content: the star icon (filled look via .is-saved in CSS) and, unless icon-only, a word
function saveContent(b, isSaved, withText = true) {
  b.replaceChildren(siteIcon("star"));
  if (withText) b.append(document.createTextNode(isSaved ? " Saved" : " Save"));
  b.classList.toggle("is-saved", isSaved);
  return b;
}

function button(text, className, onClick) {
  const b = el("button", className, text);
  b.type = "button";
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

function countryName(code) {
  return (EUHEM_COUNTRY_BY_CODE[code] && EUHEM_COUNTRY_BY_CODE[code].name) || code;
}

// A track's colour: the CSS token from style.css (lighter in dark mode), or the config colour
function trackAccent(trackId) {
  return `var(--track-${trackId}, ${SX_CONFIG.tracks[trackId].accent})`;
}

function trackPill(trackId) {
  const pill = el("span", "sx-track");
  pill.append(el("span", "sx-track-label", TRACK_LABELS[trackId] || TRACK_LABELS.unlisted));
  const track = SX_CONFIG.tracks[trackId];
  if (track) {
    pill.classList.add("sx-track-current");
    pill.style.setProperty("--track-accent", trackAccent(trackId));
    pill.prepend(el("abbr", "sx-track-code", track.short));
    pill.title = TRACK_LABELS[trackId];
  }
  return pill;
}

function avatar(profile, size) {
  const a = el("span", `sx-avatar${size ? " sx-avatar-" + size : ""}`, SX.initialsOf(profile.name));
  a.setAttribute("aria-hidden", "true");
  const track = SX_CONFIG.tracks[profile.track];
  if (track) a.style.setProperty("--track-accent", trackAccent(profile.track));
  return a;
}

// ----- Saved profiles (this browser only; ids only) -----

function savedIds() {
  if (savedInTab) return savedInTab.slice();
  const list = readStorage(SX_CONFIG.savedStorageKey, []);
  return Array.isArray(list) ? list.filter((id) => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id)).slice(0, 200) : [];
}

function storeSavedIds(ids) {
  const persisted = writeStorage(SX_CONFIG.savedStorageKey, ids);
  savedInTab = persisted ? null : ids.slice();
  return persisted;
}

function toggleSaved(id) {
  const list = savedIds();
  const wasSaved = list.includes(id);
  if (!wasSaved && list.length >= 200) {
    sxToast("You can save up to 200 profiles. Remove one before adding another.");
    return;
  }
  const focusId = document.activeElement && document.activeElement.id;
  const next = wasSaved ? list.filter((x) => x !== id) : [...list, id];
  const persisted = storeSavedIds(next);
  sxToast(persisted
    ? wasSaved ? "Removed from saved profiles" : "Saved on this device"
    : wasSaved ? "Removed for this tab; device storage is unavailable" : "Saved for this tab only; device storage is unavailable");
  render();
  if (state.profile === id) renderDrawer();
  if (!restoreFocus(focusId) && focusId && focusId.startsWith("sx-save-")) {
    els.savedToggle.focus({ preventScroll: true });
  }
}

// ----- Address (URL) state: only public filter settings, never citizenship or visa -----

function allowedValues() {
  return {
    cohort: [...new Set(records.map((r) => r.cohort))],
    country: EUHEM_COUNTRIES.map((c) => c.code),
    track: SX.TRACK_VALUES,
    background: Object.keys(SX_OPTIONS.academicFields),
    degree: Object.keys(SX_OPTIONS.degrees),
  };
}

function defaultCohorts() {
  // The demo starts with every participating cohort; real data would start with the configured cohort
  return IS_DEMO || !SX_CONFIG.defaultCohort ? [] : [SX_CONFIG.defaultCohort];
}

function readUrl() {
  const fromUrl = SX.readUrlState(window.location.search, allowedValues());
  const raw = new URLSearchParams(window.location.search).get("cohort");
  for (const key of SX.FILTER_KEYS) state.filters[key] = fromUrl[key];
  if (raw === null) state.filters.cohort = defaultCohorts();
  state.view = fromUrl.view;
  state.profile = fromUrl.profile;
}

function writeUrl(push) {
  const forUrl = { view: state.view, profile: state.profile };
  for (const key of SX.FILTER_KEYS) forUrl[key] = state.filters[key];
  let query = SX.writeUrlState(forUrl);
  if (!state.filters.cohort.length && defaultCohorts().length) query += (query ? "&" : "?") + "cohort=all";
  const url = window.location.pathname + query + window.location.hash;
  if (url === window.location.pathname + window.location.search + window.location.hash) return;
  history[push ? "pushState" : "replaceState"]({ sx: true }, "", url);
}

// ----- The pipeline -----

function viewer() {
  return SX.makeViewer(IS_DEMO ? state.preview : "public");
}

function currentFilters() {
  return { ...state.filters, labels: LABELS, savedIds: state.savedOnly ? savedIds() : null };
}

function compute() {
  profiles = SX.projectAll(records, viewer()); // 1 + 2: projection and field rules
  results = SX.sortProfiles(SX.filterProfiles(profiles, currentFilters()), state.sort, LABELS); // 3
}

function activeFilterCount() {
  const f = state.filters;
  return SX.ALL_FILTER_KEYS.reduce((n, k) => n + f[k].length, 0) + (f.hasLinkedin ? 1 : 0) + (f.q.trim() ? 1 : 0);
}

// Re-run everything after a change. push = add a Back/Forward step.
function update({ push = false, resetPage = true } = {}) {
  if (resetPage) state.page = 1;
  writeUrl(push);
  render();
}

function render() {
  const active = document.activeElement;
  const focusId = active && active.id;
  const countryFocus = active && active.matches("path[data-code]") ? active.dataset.code : null;
  compute();
  renderStats();
  renderFilters();
  renderChips();
  renderResults();
  renderMap();
  renderInsights();
  restoreFocus(focusId);
  if (countryFocus && map.paths.has(countryFocus)) map.paths.get(countryFocus).focus({ preventScroll: true });
}

// ----- 3. Summary statistics -----

function renderStats() {
  els.stats.replaceChildren();
  const countries = new Set(results.filter((p) => p.country).map((p) => p.country.code));
  const fields = new Set(results.filter((p) => p.field).map((p) => p.field.id));
  const items = [
    [String(results.length), state.preview === "member" ? "matching profiles in the member preview" : "matching public profiles"],
    [String(countries.size), "represented countries in results"],
    [String(fields.size), "academic backgrounds in results"],
  ];
  if (IS_DEMO) items.push([String(records.length), "fictional records in this demonstration"]);
  for (const [value, label] of items) {
    const li = el("li", "sx-stat");
    li.append(el("span", "sx-stat-value", value), el("span", "sx-stat-label", label));
    els.stats.append(li);
  }
}

// ----- 4. Filters -----

// The values each filter offers, from the profiles this viewer can see (never from hidden data)
function filterOptions(key) {
  const counts = SX.facetCounts(profiles, currentFilters(), key);
  const present = (fn) => [...new Set(profiles.map(fn).filter(Boolean))];
  let values;
  if (key === "cohort") values = present((p) => p.cohort).sort().reverse();
  else if (key === "country") values = present((p) => p.country && p.country.code).sort((a, b) => countryName(a).localeCompare(countryName(b)));
  else if (key === "track") values = TRACK_ORDER;
  else if (key === "background") values = Object.keys(SX_OPTIONS.academicFields).filter((id) => profiles.some((p) => p.field && p.field.id === id));
  else if (key === "degree") values = Object.keys(SX_OPTIONS.degrees).filter((id) => profiles.some((p) => p.degree && p.degree.id === id));
  else if (key === "membership") values = present((p) => p.membership);
  const label = {
    cohort: (v) => v, country: countryName, track: (v) => TRACK_LABELS[v],
    background: (v) => SX_OPTIONS.academicFields[v], degree: (v) => SX_OPTIONS.degrees[v], membership: (v) => MEMBERSHIP_LABELS[v],
  }[key];
  return values.map((v) => ({ value: v, label: label(v), count: counts[v] || 0 }));
}

function checkboxGroup(key, options, { counts = true, title = FILTER_TITLES[key], note } = {}) {
  const box = el("details", "sx-filter");
  box.dataset.key = key;
  const selected = state.filters[key];
  const summary = el("summary", null, title);
  if (selected.length) summary.append(el("span", "sx-badge", String(selected.length)));
  box.append(summary);
  const fieldset = el("fieldset");
  fieldset.append(el("legend", "visually-hidden", title));
  if (key === "cohort") {
    const all = el("label", "sx-check");
    const input = el("input");
    input.type = "checkbox";
    input.id = "sx-filter-cohort-all";
    input.checked = !selected.length;
    input.addEventListener("change", () => { state.filters.cohort = []; update({ push: true }); });
    all.append(input, " All participating cohorts");
    fieldset.append(all);
  }
  for (const option of options) {
    const label = el("label", "sx-check");
    const input = el("input");
    input.type = "checkbox";
    input.value = option.value;
    input.id = `sx-filter-${key}-${option.value}`;
    input.checked = selected.includes(option.value);
    input.addEventListener("change", () => {
      const list = state.filters[key];
      state.filters[key] = input.checked ? [...list, option.value] : list.filter((v) => v !== option.value);
      update({ push: SX.FILTER_KEYS.includes(key) });
    });
    label.append(input, " " + option.label);
    if (counts) label.append(el("span", "sx-count", String(option.count)));
    fieldset.append(label);
  }
  if (note) fieldset.append(el("p", "sx-hint", note));
  box.append(fieldset);
  return box;
}

function renderFilters() {
  // Keep open dropdowns open across re-renders
  const open = new Set([...els.filters.querySelectorAll("details.sx-filter[open]")].map((d) => d.dataset.key));
  els.primary.replaceChildren(
    checkboxGroup("cohort", filterOptions("cohort")),
    checkboxGroup("country", filterOptions("country")),
    checkboxGroup("track", filterOptions("track")),
    checkboxGroup("background", filterOptions("background")),
  );
  const more = [checkboxGroup("degree", filterOptions("degree"))];
  const memberships = filterOptions("membership");
  if (memberships.length > 1) more.push(checkboxGroup("membership", memberships));

  const linkedin = el("label", "sx-check sx-check-inline");
  const input = el("input");
  input.type = "checkbox";
  input.id = "sx-filter-linkedin";
  input.checked = state.filters.hasLinkedin;
  input.addEventListener("change", () => { state.filters.hasLinkedin = input.checked; update(); });
  linkedin.append(input, " Has LinkedIn");
  more.push(linkedin);
  els.more.replaceChildren(...more);
  for (const d of els.filters.querySelectorAll("details.sx-filter")) if (open.has(d.dataset.key)) d.open = true;

  // Citizenship and study-visa filters: verified members only, voluntarily shared values only,
  // kept in memory (never in the address)
  els.memberFilters.replaceChildren();
  if (state.preview === "member") {
    els.memberFilters.append(
      el("p", "sx-member-title", "Members-only filters (demo)"),
      checkboxGroup("citizenship", Object.entries(CITIZENSHIP_LABELS).map(([value, label]) => ({ value, label })), { counts: false }),
      checkboxGroup("visa", Object.entries(VISA_LABELS).map(([value, label]) => ({ value, label })),
        { counts: false, title: "Self-reported study-visa experience", note: "First EU-HEM semester in Italy. A personal experience, not a legal assessment." }),
      el("p", "sx-hint", "These filters only find people who chose to share these answers with verified members. They are not saved in the page address, so a shared link contains only public filter settings."),
    );
    for (const d of els.memberFilters.querySelectorAll("details.sx-filter")) if (open.has(d.dataset.key)) d.open = true;
  } else {
    els.memberFilters.append(el("p", "sx-hint sx-locked-hint",
      "Citizenship-group and study-visa filters will be available only to verified EU-HEM members, and only for people who chose to share those answers." +
      (IS_DEMO ? " Try them in the Verified-member preview." : "")));
  }

  const n = activeFilterCount();
  els.filterCount.textContent = String(n);
  els.filterCount.hidden = n === 0;
  if (els.clearAll) els.clearAll.disabled = n === 0 && !state.savedOnly;
}

// Removable chips for every active filter, plus "Clear all"
function renderChips() {
  els.chips.replaceChildren();
  const f = state.filters;
  const labelOf = {
    cohort: (v) => v, country: countryName, track: (v) => TRACK_LABELS[v], background: (v) => SX_OPTIONS.academicFields[v],
    degree: (v) => SX_OPTIONS.degrees[v], membership: (v) => MEMBERSHIP_LABELS[v], citizenship: (v) => CITIZENSHIP_LABELS[v], visa: (v) => VISA_LABELS[v],
  };
  const chip = (text, onRemove) => {
    const b = button(`${text} ×`, "sx-chip", onRemove);
    b.setAttribute("aria-label", `Remove filter: ${text}`);
    els.chips.append(b);
  };
  for (const key of SX.ALL_FILTER_KEYS) {
    for (const v of f[key]) chip(`${FILTER_TITLES[key]}: ${labelOf[key](v)}`, () => { f[key] = f[key].filter((x) => x !== v); update({ push: SX.FILTER_KEYS.includes(key) }); });
  }
  if (f.hasLinkedin) chip("Has LinkedIn", () => { f.hasLinkedin = false; update(); });
  if (f.q.trim()) chip(`Search: “${f.q.trim()}”`, () => { f.q = ""; els.search.value = ""; update(); });
  if (state.savedOnly) chip("Saved profiles", () => { state.savedOnly = false; update(); });
  if (!f.cohort.length) els.chips.prepend(el("span", "sx-scope", "Showing all participating cohorts"));
  if (els.chips.querySelector(".sx-chip")) els.chips.append(button("Clear all", "sx-clear", clearAll));
}

function clearAll() {
  state.filters = emptyFilters();
  state.filters.cohort = defaultCohorts();
  state.savedOnly = false;
  els.search.value = "";
  update({ push: true });
}

// ----- 6 + 7. Results -----

function renderResults() {
  const size = SX_CONFIG.pageSize;
  const page = SX.paginate(results, state.page, size); // 5: pagination last
  state.page = page.page;
  els.profiles.removeAttribute("aria-busy");
  els.profiles.className = `sx-profiles sx-${state.view}`;
  els.profiles.replaceChildren();

  const saved = savedIds();
  const visibleSaved = saved.filter((id) => profiles.some((p) => p.id === id));
  els.savedToggle.textContent = `Saved (${visibleSaved.length})`;
  els.savedToggle.setAttribute("aria-pressed", String(state.savedOnly));
  for (const b of document.querySelectorAll("[data-layout]")) b.setAttribute("aria-pressed", String(b.dataset.layout === state.view));
  els.sort.value = state.sort;

  const from = results.length ? (page.page - 1) * size + 1 : 0;
  const to = Math.min(page.page * size, results.length);
  const scope = state.preview === "member" ? "available to verified members" : "public";
  els.count.textContent = results.length
    ? `Showing ${from}–${to} of ${plural(results.length, "matching profile")} (${profiles.length} ${scope} in this view)`
    : `No matching profiles (${profiles.length} ${scope} in this view)`;

  if (!results.length) {
    els.profiles.append(emptyState(saved, visibleSaved));
    els.pagination.replaceChildren();
    return;
  }
  if (state.view === "list") els.profiles.append(profileTable(page.items, saved));
  else for (const p of page.items) els.profiles.append(profileCard(p, saved));
  renderPagination(page);
}

function emptyState(saved, visibleSaved) {
  const box = el("div", "sx-empty");
  if (state.savedOnly) {
    box.append(el("p", "sx-empty-title", visibleSaved.length ? "No saved profiles match these filters." : "No saved profiles yet."));
    box.append(el("p", null, savedInTab
      ? "Use “Save” on a profile to keep it here for this tab. Device storage is unavailable."
      : "Use “Save” on a profile to keep it here. Saved profiles stay on this device only."));
    const gone = saved.length - visibleSaved.length;
    if (gone > 0) box.append(el("p", "sx-hint", `${plural(gone, "saved profile")} ${gone === 1 ? "is" : "are"} not available in this view.`));
    const row = el("div", "button-row");
    row.append(button("Show all profiles", "button", () => { state.savedOnly = false; update(); }));
    if (saved.length) row.append(button("Clear saved", "button button-quiet", () => {
      const persisted = storeSavedIds([]);
      state.savedOnly = false;
      sxToast(persisted ? "Saved profiles cleared" : "Saved profiles cleared for this tab; device storage is unavailable");
      update();
    }));
    box.append(row);
    return box;
  }
  box.append(el("p", "sx-empty-title", "No profiles match these filters."));
  box.append(el("p", "sx-hint", "Only profiles available in this view are searched."));
  const row = el("div", "button-row");
  row.append(button("Clear filters", "button", clearAll));
  if (state.filters.country.length) {
    row.append(button("Explore another country", "button button-quiet", () => {
      state.filters.country = [];
      update({ push: true });
      els.mapDetails.open = true;
      scrollToSection($("sx-map-section"));
    }));
  }
  const join = el("a", "button button-quiet", "Join the directory");
  join.href = SX_CONFIG.joinUrl;
  row.append(join);
  box.append(row);
  return box;
}

function profileCard(p, saved) {
  const card = el("article", "sx-card");
  const track = SX_CONFIG.tracks[p.track];
  if (track) card.style.setProperty("--track-accent", trackAccent(p.track));

  const head = el("div", "sx-card-head");
  const who = el("div", "sx-card-who");
  const name = el("h3", "sx-card-name");
  name.id = `sx-card-heading-${p.id}`;
  card.setAttribute("aria-labelledby", name.id);
  const opener = button(p.name, "sx-name-button", (e) => openProfile(p.id, e.currentTarget));
  opener.id = `sx-name-${p.id}`;
  name.append(opener);
  who.append(name, el("p", "sx-card-meta", [MEMBERSHIP_LABELS[p.membership], p.cohort && `Cohort ${p.cohort}`].filter(Boolean).join(" · ")));
  if (p.isDemo) who.append(el("span", "sx-demo-badge", "Fictional profile"));
  head.append(avatar(p), who);
  card.append(head);

  const facts = el("ul", "sx-card-facts");
  const fact = (label, value, type) => {
    const li = el("li", "sx-fact");
    li.append(el("span", "sx-fact-label", label), el("span", `sx-fact-value sx-fact-${type}`, value));
    facts.append(li);
  };
  if (p.country) fact("Represents", p.country.name, "country");
  if (p.field) fact("Background", p.field.label, "field");
  if (p.degree) fact("Degree", p.degree.label, "degree");
  if (facts.children.length) card.append(facts);
  if (p.track) card.append(trackPill(p.track));
  if (p.bio) card.append(el("p", "sx-card-bio", p.bio));

  const actions = el("div", "sx-card-actions");
  const view = button("View profile", "button button-quiet", (e) => openProfile(p.id, e.currentTarget));
  view.id = `sx-view-${p.id}`;
  actions.append(view);
  const isSaved = saved.includes(p.id);
  const save = saveContent(button("", "sx-save", () => toggleSaved(p.id)), isSaved);
  save.id = `sx-save-${p.id}`;
  save.setAttribute("aria-pressed", String(isSaved));
  save.setAttribute("aria-label", `${isSaved ? "Unsave" : "Save"} ${p.name}`);
  actions.append(save);
  if (p.linkedin) actions.append(linkedinAction(p));
  card.append(actions);
  return card;
}

function profileTable(items, saved) {
  const wrap = el("div", "sx-table-wrap");
  const table = el("table", "sx-table");
  table.append(el("caption", "visually-hidden", IS_DEMO ? "Matching fictional profiles in this demo" : "Profiles matching your filters"));
  const head = el("tr");
  for (const h of ["Name", "Country", "Academic background", "Track", "Cohort", ""]) {
    const cell = el("th", null, h);
    cell.scope = "col";
    head.append(cell);
  }
  const thead = el("thead");
  thead.append(head);
  const tbody = el("tbody");
  for (const p of items) {
    const row = el("tr");
    const nameCell = el("td", "sx-col-name");
    const box = el("div", "sx-name-box");
    const identity = el("div", "sx-list-identity");
    const opener = button(p.name, "sx-name-button", (e) => openProfile(p.id, e.currentTarget));
    opener.id = `sx-name-${p.id}`;
    identity.append(opener);
    if (p.isDemo) identity.append(el("span", "sx-demo-badge", "Fictional profile"));
    box.append(avatar(p, "sm"), identity);
    nameCell.append(box);
    const cell = (label, value) => {
      const td = el("td");
      td.dataset.label = label;
      if (value instanceof Node) td.append(value);
      else td.append(value ? document.createTextNode(value) : el("span", "sx-none", "—"));
      return td;
    };
    const actions = el("td", "sx-col-actions");
    const isSaved = saved.includes(p.id);
    const save = saveContent(button("", "sx-save sx-save-icon", () => toggleSaved(p.id)), isSaved, false);
    save.id = `sx-save-${p.id}`;
    save.setAttribute("aria-pressed", String(isSaved));
    save.setAttribute("aria-label", `${isSaved ? "Unsave" : "Save"} ${p.name}`);
    actions.append(save);
    row.append(nameCell, cell("Country", p.country && p.country.name), cell("Background", p.field && p.field.label),
      cell("Track", p.track ? trackPill(p.track) : null), cell("Cohort", p.cohort), actions);
    tbody.append(row);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

function linkedinAction(p) {
  if (p.linkedin === "example") {
    // Demo: looks like the real button but goes nowhere, so it can never lead to a real person
    const b = el("span", "sx-linkedin is-example", "Example LinkedIn");
    b.setAttribute("role", "img");
    b.setAttribute("aria-label", "Example LinkedIn button (demo, no link)");
    b.title = "Demo: real profiles link to the person's own LinkedIn page";
    return b;
  }
  const a = el("a", "sx-linkedin", "LinkedIn");
  a.href = p.linkedin;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

function renderPagination(page) {
  els.pagination.replaceChildren();
  if (page.pages <= 1) return;
  const go = (n) => { state.page = n; render(); scrollToSection($("sx-results-title").parentElement); };
  const prev = button("← Previous", "button button-quiet", () => go(page.page - 1));
  prev.disabled = page.page === 1;
  const next = button("Next →", "button button-quiet", () => go(page.page + 1));
  next.disabled = page.page === page.pages;
  els.pagination.append(prev, el("span", "sx-page-info", `Page ${page.page} of ${page.pages}`), next);
}

// ----- Profile drawer -----

const NOT_AVAILABLE = "This profile is not available in your current view.";

function openProfile(id, opener, { push = true } = {}) {
  const profile = profiles.find((p) => p.id === id);
  if (!profile) {
    // Same neutral message for hidden, members-only and non-existent ids
    sxToast(NOT_AVAILABLE);
    if (state.profile) { state.profile = null; writeUrl(false); }
    return;
  }
  returnFocus = opener || document.activeElement;
  returnFocusId = returnFocus && returnFocus.id;
  state.profile = id;
  writeUrl(push);
  renderDrawer();
  if (!els.drawer.open) els.drawer.showModal();
  els.drawer.querySelector(".sx-drawer-close").focus();
}

function closeProfile() {
  if (els.drawer.open) els.drawer.close();
}

function renderDrawer() {
  const p = profiles.find((x) => x.id === state.profile);
  const body = els.drawerBody;
  body.replaceChildren();
  if (!p) return;
  const track = SX_CONFIG.tracks[p.track];
  els.drawer.style.setProperty("--track-accent", track ? trackAccent(p.track) : "var(--color-primary)");

  const top = el("div", "sx-drawer-top");
  top.append(button("Close", "button button-quiet sx-drawer-close", () => closeProfile()));
  body.append(top);

  const head = el("div", "sx-drawer-head");
  const who = el("div");
  const h = el("h2", null, p.name);
  h.id = "sx-drawer-name";
  who.append(h, el("p", "sx-card-meta", [MEMBERSHIP_LABELS[p.membership], p.cohort && `Cohort ${p.cohort}`].filter(Boolean).join(" · ")));
  const badges = el("p", "sx-badges");
  if (p.isDemo) badges.append(el("span", "sx-tag", "Example profile (fictional)"));
  if (p.membersOnly) badges.append(el("span", "sx-tag sx-tag-member", "Visible to EU-HEM members only"));
  if (badges.children.length) who.append(badges);
  head.append(avatar(p, "lg"), who);
  body.append(head);

  const dl = el("dl", "sx-details");
  const row = (term, value) => {
    if (!value) return;
    dl.append(el("dt", null, term));
    const dd = el("dd");
    dd.append(value instanceof Node ? value : document.createTextNode(value));
    dl.append(dd);
  };
  if (p.track) {
    const t = el("span", "sx-track-row");
    t.append(trackPill(p.track));
    if (SX_CONFIG.tracks[p.track]) {
      const link = el("a", "sx-small-link", "About this track");
      link.href = `tracks.html#track-${p.track}`;
      t.append(link);
    }
    row("Track", t);
  }
  row("Represents", p.country && p.country.name);
  row("Also identifies with", p.additionalCountry && p.additionalCountry.name);
  row("Academic background", p.field && p.field.label);
  row("Degree", p.degree && p.degree.label);
  row("Previous university", p.university);
  const facts = el("section", "sx-drawer-section");
  facts.append(el("h3", "sx-drawer-section-title", "Profile at a glance"), dl);
  body.append(facts);
  if (p.bio) {
    const about = el("section", "sx-drawer-section");
    about.append(el("h3", "sx-drawer-section-title", "About"), el("p", "sx-drawer-bio", p.bio));
    body.append(about);
  }

  // Only in the member view, and only what this person chose to share with verified members
  if (p.citizenshipGroup || p.studyVisaExperience) {
    const box = el("div", "sx-shared");
    box.append(el("p", "sx-shared-title", "Shared with verified members"));
    const sdl = el("dl", "sx-details");
    if (p.citizenshipGroup) sdl.append(el("dt", null, "Citizenship group"), el("dd", null, CITIZENSHIP_LABELS[p.citizenshipGroup]));
    if (p.studyVisaExperience) {
      sdl.append(el("dt", null, "Self-reported study-visa experience (first semester in Italy)"), el("dd", null, VISA_LABELS[p.studyVisaExperience]));
    }
    box.append(sdl, el("p", "sx-hint", "A personal answer, not a legal assessment. Visa and residence rules depend on each person's circumstances."));
    body.append(box);
  }

  const actions = el("div", "sx-drawer-actions");
  const isSaved = savedIds().includes(p.id);
  const save = saveContent(button("", "button button-quiet sx-save", () => toggleSaved(p.id)), isSaved);
  save.id = "sx-drawer-save";
  save.setAttribute("aria-pressed", String(isSaved));
  save.setAttribute("aria-label", `${isSaved ? "Unsave" : "Save"} ${p.name}`);
  actions.append(save, button("Copy profile link", "button button-quiet", copyProfileLink));
  if (p.linkedin) actions.append(linkedinAction(p));
  body.append(actions);
  if (p.membersOnly) body.append(el("p", "sx-hint", IS_DEMO
    ? "This fictional profile is available only in the verified-member demo preview. Shared links open in public preview."
    : "A link to a members-only profile works only for verified members."));
}

async function copyProfileLink() {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set("profile", state.profile);
  try {
    await navigator.clipboard.writeText(url.toString());
    sxToast("Profile link copied");
  } catch {
    sxToast(`Copy this link: ${url}`, { duration: 8000 });
  }
}

els.drawer.addEventListener("close", () => {
  if (state.profile) {
    state.profile = null;
    writeUrl(false);
  }
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  else if (returnFocusId && !restoreFocus(returnFocusId)) els.savedToggle.focus({ preventScroll: true });
  returnFocus = null;
  returnFocusId = null;
});
// A click on the dark backdrop (outside the panel) closes the drawer
els.drawer.addEventListener("click", (event) => {
  if (event.target === els.drawer) closeProfile();
});

// ----- 5. Map -----

const map = { svg: null, paths: new Map(), box: null, drag: null };

async function loadMap() {
  if (mapLoading) return;
  mapLoading = true;
  els.map.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(SX_CONFIG.map.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const svg = doc.documentElement;
    if (svg.nodeName !== "svg") throw new Error("Not an SVG");
    svg.setAttribute("class", "sx-map-svg");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "World map of the countries students represent");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    els.map.replaceChildren(document.importNode(svg, true));
    map.svg = els.map.querySelector("svg");
    map.paths.clear();
    for (const path of map.svg.querySelectorAll("path[data-code]")) map.paths.set(path.dataset.code, path);
    setMapView(state.mapView);
    wireMap();
    mapReady = true;
    els.map.removeAttribute("aria-busy");
    renderMap();
  } catch (error) {
    console.error("Map:", error);
    mapReady = false;
    map.svg = null;
    map.paths.clear();
    els.map.removeAttribute("aria-busy");
    const retry = button("Retry map", "button button-quiet", loadMap);
    retry.id = "sx-map-retry";
    const fallback = el("div", "sx-map-status");
    fallback.append(el("p", null, "The map could not be loaded. You can still explore by country below and use all filters."), retry);
    els.map.replaceChildren(fallback);
    $("sx-country-list-wrap").open = true;
  } finally {
    mapLoading = false;
  }
}

function parseBox(text) {
  return text.split(/\s+/).map(Number);
}

function setBox(box) {
  const world = parseBox(SX_CONFIG.map.views.world);
  let [x, y, w, h] = box;
  w = Math.min(Math.max(w, 40), world[2]);
  h = Math.min(Math.max(h, 18), world[3] * 1.2);
  x = Math.min(Math.max(x, world[0] - w * 0.25), world[0] + world[2] - w * 0.75);
  y = Math.min(Math.max(y, world[1] - h * 0.25), world[1] + world[3] - h * 0.75);
  map.box = [x, y, w, h];
  if (map.svg) map.svg.setAttribute("viewBox", map.box.map((v) => v.toFixed(1)).join(" "));
}

function setMapView(view) {
  state.mapView = view;
  setBox(parseBox(SX_CONFIG.map.views[view]));
  for (const b of document.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === view));
  if (mapReady) renderMap();
}

function zoom(factor) {
  const [x, y, w, h] = map.box;
  const cx = x + w / 2, cy = y + h / 2;
  setBox([cx - (w * factor) / 2, cy - (h * factor) / 2, w * factor, h * factor]);
  state.mapView = "custom";
  for (const b of document.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed", "false");
  renderMapOutside();
}

function wireMap() {
  const svg = map.svg;
  const codeOf = (target) => target.closest && target.closest("path[data-code]") && target.closest("path[data-code]").dataset.code;

  svg.addEventListener("click", (event) => {
    if (map.drag && map.drag.moved) return;
    const code = codeOf(event.target);
    if (code && EUHEM_COUNTRY_BY_CODE[code]) toggleCountry(code);
  });
  svg.addEventListener("keydown", (event) => {
    const code = codeOf(event.target);
    if (code && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      toggleCountry(code);
    }
  });
  svg.addEventListener("pointerover", (event) => { const code = codeOf(event.target); if (code) showTooltip(code, event); });
  svg.addEventListener("pointermove", (event) => { const code = codeOf(event.target); if (code && !map.drag) showTooltip(code, event); });
  svg.addEventListener("pointerout", () => hideTooltip());
  svg.addEventListener("focusin", (event) => { const code = codeOf(event.target); if (code) showTooltip(code); });
  svg.addEventListener("focusout", () => hideTooltip());

  // Drag to move the map. "touch-action: pan-y" in students.css leaves vertical page scrolling to the
  // browser, and there is no wheel zoom, so the map never traps scrolling.
  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    map.drag = { x: event.clientX, y: event.clientY, box: [...map.box], moved: false };
  });
  window.addEventListener("pointermove", (event) => {
    if (!map.drag) return;
    const dx = event.clientX - map.drag.x, dy = event.clientY - map.drag.y;
    if (!map.drag.moved && Math.hypot(dx, dy) < 6) return;
    map.drag.moved = true;
    hideTooltip();
    const scale = map.drag.box[2] / svg.getBoundingClientRect().width;
    setBox([map.drag.box[0] - dx * scale, map.drag.box[1] - dy * scale, map.drag.box[2], map.drag.box[3]]);
  });
  const endDrag = () => {
    if (!map.drag) return;
    const moved = map.drag.moved;
    if (moved) {
      state.mapView = "custom";
      for (const b of document.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed", "false");
      renderMapOutside();
    }
    setTimeout(() => { map.drag = null; }, 0); // after the click event
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", () => { map.drag = null; });
}

function mapCounts() {
  return SX.facetCounts(profiles, currentFilters(), "country"); // 4: all filters except Country
}

function showTooltip(code, event) {
  const count = mapCounts()[code] || 0;
  els.tooltip.textContent = `${countryName(code)}: ${count ? plural(count, "visible profile") : "no visible matching profiles"}`;
  els.tooltip.hidden = false;
  const box = els.tooltip.parentElement.getBoundingClientRect(); // the map card
  let x, y;
  if (event && event.clientX) { x = event.clientX - box.left; y = event.clientY - box.top; }
  else {
    const r = map.paths.get(code).getBoundingClientRect();
    x = r.left + r.width / 2 - box.left;
    y = r.top - box.top;
  }
  els.tooltip.style.left = `${Math.min(Math.max(x, 60), box.width - 60)}px`;
  els.tooltip.style.top = `${Math.max(y, 24)}px`;
}

function hideTooltip() {
  els.tooltip.hidden = true;
}

function toggleCountry(code) {
  const list = state.filters.country;
  state.filters.country = list.length === 1 && list[0] === code ? [] : [code];
  update({ push: true });
}

// Ranges for the colour legend, from the counts on screen: e.g. 1–3, 4–6, 7–9, 10–12
function legendRanges(max) {
  const n = Math.min(4, max);
  const ranges = [];
  for (let i = 0; i < n; i++) ranges.push([Math.floor((i * max) / n) + 1, Math.floor(((i + 1) * max) / n)]);
  return ranges;
}

function renderMap() {
  const counts = mapCounts();
  const max = Math.max(0, ...Object.values(counts));
  const ranges = legendRanges(max);
  const selected = new Set(state.filters.country);

  if (mapReady) {
    for (const [code, path] of map.paths) {
      const count = counts[code] || 0;
      const level = count ? ranges.findIndex(([lo, hi]) => count >= lo && count <= hi) + 1 : 0;
      path.setAttribute("class", `map-country${level ? " sx-level-" + level : ""}${selected.has(code) ? " is-selected" : ""}`);
      const interactive = count > 0 || selected.has(code);
      if (interactive) {
        path.setAttribute("tabindex", "0");
        path.setAttribute("role", "button");
        path.setAttribute("aria-label", `${countryName(code)}: ${plural(count, "visible profile")}`);
        path.setAttribute("aria-pressed", String(selected.has(code)));
      } else {
        for (const a of ["tabindex", "role", "aria-label", "aria-pressed"]) path.removeAttribute(a);
      }
    }
    // Selected countries are drawn last, so their outline is on top
    for (const code of selected) if (map.paths.has(code)) map.svg.append(map.paths.get(code));
    renderMapOutside();
  }

  els.legend.replaceChildren(el("span", "sx-legend-title", "Visible profiles"));
  const zero = el("span", "sx-legend-item");
  zero.append(el("span", "sx-swatch sx-level-0"), "0");
  els.legend.append(zero);
  ranges.forEach(([lo, hi], i) => {
    const item = el("span", "sx-legend-item");
    item.append(el("span", `sx-swatch sx-level-${i + 1}`), lo === hi ? String(lo) : `${lo}–${hi}`);
    els.legend.append(item);
  });
  const sel = el("span", "sx-legend-item");
  sel.append(el("span", "sx-swatch sx-swatch-selected"), "Selected");
  els.legend.append(sel);

  renderCountryPanel(counts);
  renderCountryList(counts);
}

// "4 visible profiles are from countries outside this view"
function renderMapOutside() {
  if (!map.svg) return;
  const counts = mapCounts();
  const [x, y, w, h] = map.box;
  const outside = Object.entries(counts).filter(([code]) => {
    const path = map.paths.get(code);
    if (!path) return true; // too small to draw: always listed below the map
    const b = path.getBBox();
    return b.x + b.width < x || b.x > x + w || b.y + b.height < y || b.y > y + h;
  });
  const n = outside.reduce((s, [, c]) => s + c, 0);
  els.outside.replaceChildren();
  els.outside.hidden = n === 0;
  if (n) {
    els.outside.append(`${plural(n, "visible profile")} ${n === 1 ? "is" : "are"} from countries outside this map view (${outside.map(([c]) => countryName(c)).join(", ")}). `);
    els.outside.append(button("Show world", "sx-link-button", () => setMapView("world")));
  }
}

function renderCountryPanel(counts) {
  const panel = els.panel;
  panel.replaceChildren();
  const selected = state.filters.country;
  if (!selected.length) {
    panel.append(el("h3", null, "Choose a country"));
    panel.append(el("p", "sx-hint", "Select a country on the map or in “Explore by country”. The directory below updates with it."));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1] || countryName(a[0]).localeCompare(countryName(b[0]))).slice(0, 5);
    if (top.length) {
      const list = el("ul", "sx-panel-list");
      for (const [code, n] of top) {
        const li = el("li");
        li.append(button(`${countryName(code)}`, "sx-link-button", () => toggleCountry(code)), el("span", "sx-count", String(n)));
        list.append(li);
      }
      panel.append(el("p", "sx-panel-sub", "Most represented in this view"), list);
    }
    return;
  }
  const title = selected.length === 1 ? countryName(selected[0]) : `${selected.length} countries selected`;
  const head = el("div", "sx-panel-head");
  if (selected.length === 1) head.append(el("span", "sx-code", selected[0]));
  head.append(el("h3", null, title));
  panel.append(head);
  panel.append(el("p", "sx-panel-count", results.length ? plural(results.length, "visible matching profile") : "No visible matching profiles"));
  if (results.length) {
    const list = el("ul", "sx-panel-list");
    for (const p of results.slice(0, 5)) {
      const li = el("li");
      const opener = button(p.name, "sx-link-button", (e) => openProfile(p.id, e.currentTarget));
      opener.id = `sx-map-profile-${p.id}`;
      li.append(opener);
      list.append(li);
    }
    panel.append(list);
    if (results.length > 5) panel.append(el("p", "sx-hint", `and ${results.length - 5} more`));
  }
  const row = el("div", "button-row");
  row.append(button("View profiles", "button", () => scrollToSection($("sx-results-title").parentElement)));
  row.append(button("Clear country", "button button-quiet", () => { state.filters.country = []; update({ push: true }); }));
  panel.append(row);
}

function renderCountryList(counts) {
  els.countryList.replaceChildren();
  const codes = [...new Set([...profiles.filter((p) => p.country).map((p) => p.country.code), ...state.filters.country])]
    .sort((a, b) => countryName(a).localeCompare(countryName(b)));
  for (const code of codes) {
    const n = counts[code] || 0;
    const li = el("li");
    const b = button("", "sx-country-item", () => toggleCountry(code));
    b.setAttribute("aria-pressed", String(state.filters.country.includes(code)));
    b.append(el("span", "sx-country-name", countryName(code)), el("span", "sx-count", n ? String(n) : "0"));
    b.setAttribute("aria-label", `${countryName(code)}: ${n ? plural(n, "visible matching profile") : "no visible matching profiles"}`);
    if (!map.paths.has(code) && mapReady) b.append(el("span", "sx-hint", " (too small for the map)"));
    li.append(b);
    els.countryList.append(li);
  }
}

// ----- 9. Insights -----

function bars(title, counts, labelOf, { limit = 6, total } = {}) {
  const box = el("div", "sx-bars");
  box.append(el("h4", null, title));
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || String(labelOf(a[0])).localeCompare(String(labelOf(b[0]))));
  if (!entries.length) { box.append(el("p", "sx-hint", "No visible data.")); return box; }
  const sum = total || entries.reduce((s, [, n]) => s + n, 0);
  const shown = entries.slice(0, limit);
  const rest = entries.slice(limit).reduce((s, [, n]) => s + n, 0);
  const list = el("ul");
  const item = (label, n) => {
    const li = el("li", "sx-bar");
    const pct = Math.round((n / sum) * 100);
    li.append(el("span", "sx-bar-label", label), el("span", "sx-bar-value", `${n} · ${pct}%`));
    const track = el("span", "sx-bar-track");
    const fill = el("span", "sx-bar-fill");
    fill.style.width = `${pct}%`;
    track.append(fill);
    li.append(track);
    list.append(li);
  };
  for (const [k, n] of shown) item(labelOf(k), n);
  if (rest) item("Other", rest);
  box.append(list);
  return box;
}

function renderInsights() {
  // A. From visible profiles only (after filters)
  const s = SX.summarize(results);
  const out = els.directoryInsights;
  out.replaceChildren();
  if (!results.length) out.append(el("p", "sx-hint", "No visible profiles match these filters."));
  else {
    const cohorts = results.reduce((m, p) => { if (p.cohort) m[p.cohort] = (m[p.cohort] || 0) + 1; return m; }, {});
    out.append(
      bars("Academic background", s.fields, (id) => SX_OPTIONS.academicFields[id] || id),
      bars("Current track", s.tracks, (id) => TRACK_LABELS[id] || id),
      bars("Country represented", s.countries, countryName),
      bars("Cohort", cohorts, (c) => c),
    );
    const missing = results.length - Object.values(s.fields).reduce((a, b) => a + b, 0);
    if (missing) out.append(el("p", "sx-hint", `${plural(missing, "visible profile")} without a shown background ${missing === 1 ? "is" : "are"} not in the background chart.`));
  }

  // B. Whole-cohort mobility statistics: precomputed and disclosure-checked, never from profiles
  const mob = els.mobilityInsights;
  mob.replaceChildren();
  if (!aggregates) { mob.append(el("p", "sx-hint", "Not available right now.")); return; }
  for (const [cohort, data] of Object.entries(aggregates.cohorts)) {
    const block = el("div", "sx-aggregate");
    block.append(el("h4", null, `Cohort ${cohort}`));
    block.append(aggregateBars("Citizenship group", data.citizenship, CITIZENSHIP_LABELS));
    block.append(aggregateBars("Self-reported study-visa experience (first semester in Italy)", data.studyVisaExperience, VISA_LABELS));
    mob.append(block);
  }
  mob.append(el("p", "sx-hint", "Self-reported experiences, not official immigration statistics. Citizenship groups are never worked out from the countries on the map."));
}

function aggregateBars(title, release, labels) {
  const box = el("div", "sx-bars");
  box.append(el("h5", null, title));
  if (!release || !release.publishable) {
    box.append(el("p", "sx-not-enough", SX.NOT_ENOUGH_DATA));
    return box;
  }
  const list = el("ul");
  for (const [k, n] of Object.entries(release.cells)) {
    const li = el("li", "sx-bar");
    if (n === null) {
      li.append(el("span", "sx-bar-label", labels[k]), el("span", "sx-bar-value", "hidden (small group)"));
    } else {
      const pct = Math.round((n / release.total) * 100);
      li.append(el("span", "sx-bar-label", labels[k]), el("span", "sx-bar-value", `${n} · ${pct}%`));
      const track = el("span", "sx-bar-track");
      const fill = el("span", "sx-bar-fill");
      fill.style.width = `${pct}%`;
      track.append(fill);
      li.append(track);
    }
    list.append(li);
  }
  box.append(list, el("p", "sx-hint", `Out of ${release.total} ${release.denominator}.${release.message ? " " + release.message : ""}`));
  return box;
}

// ----- Controls -----

function wireControls() {
  let typing;
  els.search.addEventListener("input", () => {
    clearTimeout(typing);
    typing = setTimeout(() => { state.filters.q = els.search.value; update(); }, 150);
  });
  els.filtersToggle.addEventListener("click", () => {
    const open = els.filtersToggle.getAttribute("aria-expanded") !== "true";
    els.filtersToggle.setAttribute("aria-expanded", String(open));
    els.filters.classList.toggle("is-open", open);
  });
  els.sort.addEventListener("change", () => { state.sort = els.sort.value; update({ resetPage: true }); });
  for (const b of document.querySelectorAll("[data-layout]")) {
    b.addEventListener("click", () => { state.view = b.dataset.layout; update({ push: true, resetPage: false }); });
  }
  els.savedToggle.addEventListener("click", () => { state.savedOnly = !state.savedOnly; update(); });
  if (els.clearAll) els.clearAll.addEventListener("click", clearAll);
  els.random.addEventListener("click", (e) => {
    const pool = results.filter((p) => p.id !== lastShownRandom || results.length === 1);
    if (!pool.length) { sxToast("No profiles match these filters."); return; }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    lastShownRandom = pick.id;
    openProfile(pick.id, e.currentTarget);
  });
  for (const b of document.querySelectorAll("[data-view]")) b.addEventListener("click", () => setMapView(b.dataset.view));
  for (const b of document.querySelectorAll("[data-zoom]")) {
    b.addEventListener("click", () => {
      if (!map.svg) return;
      if (b.dataset.zoom === "in") zoom(1 / 1.5);
      else if (b.dataset.zoom === "out") zoom(1.5);
      else setMapView(SX_CONFIG.map.defaultView);
    });
  }
  $("sx-explore-map").addEventListener("click", () => { els.mapDetails.open = true; });
  const more = $("sx-locked-more");
  more.addEventListener("click", () => {
    const open = more.getAttribute("aria-expanded") !== "true";
    more.setAttribute("aria-expanded", String(open));
    $("sx-locked-explain").hidden = !open;
  });
  for (const radio of document.querySelectorAll('input[name="sx-preview"]')) {
    radio.addEventListener("change", () => {
      state.preview = radio.value;
      // Member-only filters exist only in member preview, and only in memory
      state.filters.citizenship = [];
      state.filters.visa = [];
      const open = state.profile;
      update({ resetPage: true });
      if (open) {
        if (profiles.some((p) => p.id === open)) renderDrawer();
        else { closeProfile(); sxToast(NOT_AVAILABLE); }
      }
    });
  }
  // Back / Forward: read the address again
  window.addEventListener("popstate", () => {
    readUrl();
    els.search.value = state.filters.q;
    render();
    if (state.profile) openProfile(state.profile, null, { push: false });
    else if (els.drawer.open) els.drawer.close();
  });
}

// ----- Loading -----

function showLoading() {
  els.profiles.setAttribute("aria-busy", "true");
  els.profiles.className = "sx-profiles sx-cards";
  els.profiles.replaceChildren(...Array.from({ length: 6 }, () => el("div", "sx-card sx-card-skeleton")));
  els.count.textContent = "Loading profiles…";
}

function showLoadError() {
  els.profiles.removeAttribute("aria-busy");
  els.profiles.className = "sx-profiles";
  const box = el("div", "sx-empty");
  box.append(el("p", "sx-empty-title", "The profiles could not be loaded."), el("p", null, "Check your internet connection and try again."));
  box.append(button("Retry", "button", loadData));
  els.profiles.replaceChildren(box);
  els.count.textContent = "Profiles not loaded";
}

async function loadData() {
  showLoading();
  try {
    if (!IS_DEMO) throw new Error("Only demo mode exists in Phase 1 (see students-config.js)");
    const response = await fetch(SX_CONFIG.demoDataUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    // Demo mode accepts demo records only: anything not marked isDemo is dropped
    records = (data.records || []).filter((r) => r && r.isDemo === true);
    try {
      const agg = await fetch(SX_CONFIG.demoAggregatesUrl);
      aggregates = agg.ok ? await agg.json() : null;
      if (aggregates && aggregates.isDemo !== true) aggregates = null;
    } catch {
      aggregates = null;
    }
    readUrl();
    els.search.value = state.filters.q;
    render();
    if (state.profile) openProfile(state.profile, null, { push: false });
  } catch (error) {
    console.error("Students:", error);
    showLoadError();
  }
}

function init() {
  $("sx-demo").hidden = !IS_DEMO;
  wireControls();
  loadData();
  loadMap();
}

init();
