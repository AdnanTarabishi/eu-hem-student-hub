// ===== City guide =====
// One template page for every city (city-guide.html?city=oslo). Without ?city it shows the index:
// a "My track" banner, the city cards and a comparison table of the cities.
// A guide is a Markdown file (list in guide-data.js) converted to HTML with the "marked" library.
// Each guide starts with a facts block and gets the same layout: notice box, "At a glance", a sticky
// contents menu, folding sections, clickable source tags, photos and tables that become cards on phones.
// Which tracks study in a city, and when, always comes from content/tracks.json.

const guideArticle = document.getElementById("guide");

const GUIDE_DISCLAIMER = "This is a student-made summary, not legal advice. Rules change. The official pages linked here are authoritative.";
const GUIDE_FOLLOW_FIRST = "EU-HEM or your host university may send you their own instructions, for example about housing or permits. Follow those first.";
const ALWAYS_OPEN_SECTIONS = 2; // "At a glance" and "Before you move" never fold

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
async function showCityIndex(cohort) {
  document.title = "City Guides – EU-HEM Student Hub";
  guideArticle.innerHTML = "";
  guideArticle.appendChild(createElement("h1", null, "City Guides"));
  guideArticle.appendChild(createElement("p", "guide-intro",
    "Practical guides to the cities of EU-HEM, written by students: what to do before you move, permits, healthcare, housing, transport and daily life."));
  const banner = myTrackBanner(cohort);
  if (banner) guideArticle.appendChild(banner);

  const cards = createElement("ul", "guide-city-cards");
  for (const guide of CITY_GUIDES) {
    const university = cohort ? cohort.universities[guide.university] : null;
    const card = createElement("a", "guide-city-card");
    card.href = `city-guide.html?city=${guide.id}`;
    if (university) card.appendChild(createElement("span", "city-country", university.country));
    card.appendChild(createElement("strong", null, cityName(cohort, guide)));
    if (university) card.appendChild(createElement("span", "guide-city-university", university.name));
    if (cohort) card.appendChild(createElement("span", "guide-city-presence", cityPresenceText(cohort, guide.university)));
    card.appendChild(createElement("span", guide.file ? "city-status is-ready" : "city-status", guide.file ? "Read the guide →" : "Coming soon"));
    const item = createElement("li");
    item.appendChild(card);
    cards.appendChild(item);
  }
  guideArticle.appendChild(cards);

  // The comparison uses the facts block of each guide (the same facts the city pages show)
  const loaded = await Promise.all(CITY_GUIDES.filter((g) => g.file).map(async (guide) => {
    try {
      const response = await fetch(guide.file);
      return response.ok ? { guide, ...parseGuide(await response.text()) } : null;
    } catch {
      return null;
    }
  }));
  const compared = loaded.filter((g) => g && g.structured);
  if (compared.length) guideArticle.appendChild(comparisonSection(cohort, compared));

  const notice = createElement("p", "guide-disclaimer", GUIDE_DISCLAIMER);
  guideArticle.appendChild(notice);
  guideArticle.appendChild(reportOutdatedLink());
}

function comparisonSection(cohort, compared) {
  const section = createElement("section", "guide-compare");
  section.setAttribute("aria-labelledby", "compare-title");
  const title = createElement("h2", null, "Compare the cities");
  title.id = "compare-title";
  section.appendChild(title);

  const columns = ["compare-rent", "compare-budget", "compare-transport", "compare-permit-non-eu", "language"];
  const table = createElement("table", "guide-cards-on-phone");
  const dates = [...new Set(compared.map((g) => g.facts["last-checked"]))].sort().map(checkedDate);
  table.appendChild(createElement("caption", null, `Approximate, checked ${dates.join(", ")}`));
  const head = createElement("tr");
  for (const label of ["City", ...columns.map((key) => GUIDE_FACTS[key])]) head.appendChild(createElement("th", null, label));
  const thead = createElement("thead");
  thead.appendChild(head);
  table.appendChild(thead);
  const tbody = createElement("tbody");
  for (const { guide, facts } of compared) {
    const row = createElement("tr");
    const city = createElement("th");
    city.scope = "row";
    const link = createElement("a", null, cityName(cohort, guide));
    link.href = `city-guide.html?city=${guide.id}`;
    city.appendChild(link);
    row.appendChild(city);
    for (const key of columns) {
      const cell = createElement("td");
      cell.appendChild(textWithSources(facts[key] || "", `city-guide.html?city=${guide.id}`));
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  labelTableCells(table);
  const wrapper = createElement("div", "table-wrapper");
  wrapper.appendChild(table);
  section.appendChild(wrapper);

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

// ----- A city guide in the full layout -----
function renderStructuredGuide(guide, parsed, cohort) {
  guideArticle.innerHTML = marked.parse(parsed.body);
  const title = guideArticle.querySelector("h1");

  const back = createElement("a", "guide-breadcrumb", "← All city guides");
  back.href = "city-guide.html";
  guideArticle.prepend(back);

  const notice = createElement("div", "guide-notice");
  notice.appendChild(createElement("p", null, `Last checked: ${checkedDate(parsed.facts["last-checked"])}.`));
  notice.firstChild.className = "guide-checked";
  notice.appendChild(createElement("p", null, GUIDE_DISCLAIMER));
  notice.appendChild(createElement("p", null, GUIDE_FOLLOW_FIRST));
  notice.appendChild(reportOutdatedLink());
  title.after(notice);
  const banner = myTrackBanner(cohort);
  if (banner) notice.after(banner);

  const sections = wrapSections();
  fillAtAGlance(sections[0], guide, parsed.facts, cohort);
  hideEmptySections(sections);
  buildJumpMenu(sections.filter((s) => !s.hidden));
  makeSectionsFold(sections);
  linkSources();
  for (const table of guideArticle.querySelectorAll("table")) {
    table.classList.add("guide-cards-on-phone");
    labelTableCells(table);
  }
  wrapTables();
}

// Puts every "## " heading and what follows it into <section><h2/><div class="guide-section-body"/></section>
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
    body.id = `${heading.id}-body`;
    section.append(heading, body);
    sections.push(section);
  }
  return sections;
}

function fillAtAGlance(section, guide, facts, cohort) {
  const list = createElement("dl", "guide-glance");
  const add = (label, content) => {
    list.appendChild(createElement("dt", null, label));
    const value = createElement("dd");
    value.append(content);
    list.appendChild(value);
  };
  if (cohort) {
    add("University", cohort.universities[guide.university].name);
    const presence = createElement("span");
    presence.append(cityPresenceText(cohort, guide.university), " (");
    const tracks = createElement("a", null, "see Tracks");
    tracks.href = "tracks.html";
    presence.append(tracks, ")");
    add("Who studies here", presence);
  }
  for (const key of ["host", "language", "currency", "cost-vs-bologna"]) {
    if (facts[key]) add(GUIDE_FACTS[key], facts[key]);
  }
  add("Last checked", checkedDate(facts["last-checked"]));
  section.querySelector(".guide-section-body").prepend(list);
}

// Student tips stay hidden until a tip is written (an HTML comment alone counts as empty)
function hideEmptySections(sections) {
  for (const section of sections) {
    if (!section.querySelector(".guide-section-body").textContent.trim()) section.hidden = true;
  }
}

// A sticky "Contents" menu that stays at the top while scrolling
function buildJumpMenu(sections) {
  const menu = createElement("details", "guide-jump");
  menu.id = "contents";
  const summary = createElement("summary", null, "Contents");
  menu.appendChild(summary);
  const list = createElement("ol");
  for (const section of sections) {
    const heading = section.querySelector("h2");
    const link = createElement("a", null, heading.textContent.replace(/^\d+\.\s*/, ""));
    link.href = `#${heading.id}`;
    link.addEventListener("click", () => { menu.open = false; });
    const item = createElement("li");
    item.appendChild(link);
    list.appendChild(item);
  }
  menu.appendChild(list);
  const toggleAll = createElement("button", "button button-quiet guide-toggle-all", "Open all sections");
  toggleAll.type = "button";
  toggleAll.addEventListener("click", () => {
    const open = toggleAll.textContent.startsWith("Open");
    for (const section of sections.slice(ALWAYS_OPEN_SECTIONS)) setSectionOpen(section, open);
    toggleAll.textContent = open ? "Close all sections" : "Open all sections";
  });
  menu.appendChild(toggleAll);
  sections[0].before(menu);

  // The menu sticks just under the site header, whose height changes with the screen width
  // and when the header gets smaller after scrolling
  const header = document.querySelector(".site-header");
  const placeUnderHeader = () => document.documentElement.style.setProperty("--guide-sticky-top", `${header ? header.offsetHeight : 0}px`);
  placeUnderHeader();
  if (header && typeof ResizeObserver === "function") new ResizeObserver(placeUnderHeader).observe(header);
  else window.addEventListener("resize", placeUnderHeader);
}

// Long sections fold away behind their heading (a button inside the heading, so screen readers
// still see a heading). hidden="until-found" lets the browser's Find (Ctrl+F) open them.
function makeSectionsFold(sections) {
  sections.slice(ALWAYS_OPEN_SECTIONS).forEach((section) => {
    const heading = section.querySelector("h2");
    const body = section.querySelector(".guide-section-body");
    const button = createElement("button", "guide-fold");
    button.type = "button";
    button.setAttribute("aria-controls", body.id);
    button.append(...heading.childNodes);
    heading.appendChild(button);
    button.addEventListener("click", () => setSectionOpen(section, button.getAttribute("aria-expanded") !== "true"));
    body.addEventListener("beforematch", () => setSectionOpen(section, true));
    setSectionOpen(section, false);
  });
}

function setSectionOpen(section, open) {
  const button = section.querySelector(".guide-fold");
  if (!button) return;
  button.setAttribute("aria-expanded", String(open));
  const body = section.querySelector(".guide-section-body");
  if (open) body.removeAttribute("hidden");
  else body.setAttribute("hidden", "until-found");
}

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
  while (walker.nextNode()) if (/\[S\d+\]/.test(walker.currentNode.textContent)) nodes.push(walker.currentNode);
  for (const node of nodes) node.replaceWith(textWithSources(node.textContent));
}

// Opens the folded section that holds the address's #target (a contents link or a source tag)
function revealHashTarget() {
  if (!window.location.hash) return;
  const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
  if (!target) return;
  const section = target.closest(".guide-section");
  if (section) setSectionOpen(section, true);
  target.scrollIntoView();
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
  guideArticle.innerHTML = "";
  guideArticle.appendChild(createElement("p", "placeholder", message));
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
    const response = await fetch(guide.file);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseGuide(await response.text());

    // The guides are written by us, so they are trusted. If students can submit
    // content later (Phase 2), it must be cleaned with a sanitizer first.
    if (!parsed.structured) throw new Error("Guide has no facts block (see docs/city-guides.md)");
    renderStructuredGuide(guide, parsed, cohort);
    openExternalLinksInNewTab(guideArticle);

    // If the address already points at a section (e.g. #housing), open it and jump there
    revealHashTarget();
    window.addEventListener("hashchange", revealHashTarget);
  } catch (error) {
    console.error("Could not load guide:", error);
    showGuideError("Sorry, the guide could not be loaded right now. Please try again later.");
  }
}

loadGuidePage();
