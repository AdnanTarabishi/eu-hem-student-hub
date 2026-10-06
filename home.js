// ===== Homepage: settings, hero photo and cohort numbers =====
// Loaded in <head> of index.html (before the page is drawn), so the hero photo starts
// downloading at once and the hero has its final size before the first paint (nothing jumps).

// ┌──────────────────────────────────────────────────────────────────────────────┐
// │ HOMEPAGE SETTINGS: change the values here.                                   │
// │                                                                              │
// │ HERO_IMAGE        The JPG behind the hero. Next to it there must be WebP     │
// │                   copies named <name>-640.webp, <name>-960.webp and          │
// │                   <name>-1280.webp (smaller and faster). Phones get the 640, │
// │                   big screens the 1280. Use "" for no photo (dark background).│
// │ HERO_IMAGE_ALT    What the photo shows, for people using screen readers.     │
// │ STUDENT_COUNT     Students in the cohort.                                    │
// │ COUNTRY_COUNT     Countries they come from.                                  │
// │ TRACK_COUNT       Specialisation tracks in semester 2.                       │
// │ COHORT_LABEL      The cohort these numbers describe, e.g. "2026–2028".      │
// │ PROGRAM_END_DATE  "YYYY-MM-DD". "Estimated days to graduation" is counted    │
// │                   from it every day; it's hidden if empty or in the past.    │
// │ DIRECTORY_IS_DEMO true while students.html shows fictional demo profiles.    │
// └──────────────────────────────────────────────────────────────────────────────┘
const HERO_IMAGE = "assets/images/euhem-cohort-2026.jpg";
const HERO_IMAGE_ALT = "The EU-HEM 2026 cohort together under the porticoes of a street in Bologna";
const STUDENT_COUNT = 104;
const COUNTRY_COUNT = 23;
const TRACK_COUNT = 4;
const COHORT_LABEL = "2026–2028";
const PROGRAM_END_DATE = "2028-09-30";
const DIRECTORY_IS_DEMO = true;

const HERO_WEBP_WIDTHS = [640, 960, 1280];

// "assets/images/x.jpg" -> "assets/images/x-640.webp 640w, ..." (for the browser to choose a size)
function heroSrcset(image) {
  const base = image.replace(/\.[a-z]+$/i, "");
  return HERO_WEBP_WIDTHS.map((w) => `${base}-${w}.webp ${w}w`).join(", ");
}

// Whole days from today (this device's date) to "YYYY-MM-DD"; null if there's no valid date
function daysUntil(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || "")) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
}

// "2028-09-30" -> "30 Sep 2028"
function formatEndDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}

// The four numbers in the hero. The days are left out when the date is missing or past.
function homeStats(today = null) {
  const days = today === null ? daysUntil(PROGRAM_END_DATE) : today;
  const stats = [
    { value: STUDENT_COUNT, label: "Students", caption: `Cohort ${COHORT_LABEL}`, icon: "students" },
    { value: COUNTRY_COUNT, label: "Countries", caption: "Cohort overview", icon: "globe" },
    { value: TRACK_COUNT, label: "Tracks", caption: "Different perspectives", icon: "route" },
  ];
  if (days !== null && days > 0) {
    stats.push({ value: days, label: "Estimated days left", caption: `${formatEndDate(PROGRAM_END_DATE)} · provisional`, noCount: true, icon: "calendar" });
  }
  return stats;
}

// ----- Runs at once, in <head> -----
(function prepareHomepage() {
  if (typeof document === "undefined") return; // tests in Node
  // 1. Start downloading the photo now (the browser picks the right size)
  if (HERO_IMAGE) {
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.type = "image/webp";
    preload.setAttribute("imagesrcset", heroSrcset(HERO_IMAGE));
    preload.setAttribute("imagesizes", "100vw");
    preload.setAttribute("fetchpriority", "high");
    document.head.appendChild(preload);
  }
  // 2. Returning students (a study plan is saved in this browser) get a compact hero,
  //    so today's classes are higher up. Same key as the Study Plan page (programme.js).
  try {
    if (window.localStorage.getItem("euhem-study-plan-v1")) document.documentElement.classList.add("home-compact");
  } catch {
    // storage blocked: show the full hero
  }
})();

// ----- Called from index.html right after the hero's HTML (still before the first paint) -----
function buildHomeHero() {
  const media = document.getElementById("hero-media");
  if (HERO_IMAGE && media) {
    const picture = document.createElement("picture");
    const source = document.createElement("source");
    source.type = "image/webp";
    source.srcset = heroSrcset(HERO_IMAGE);
    source.sizes = "100vw";
    const img = document.createElement("img");
    img.src = HERO_IMAGE;
    img.alt = HERO_IMAGE_ALT;
    img.width = 1280;
    img.height = 960;
    img.decoding = "async";
    img.setAttribute("fetchpriority", "high");
    // Photo missing or broken: remove it, the dark background stays (no broken-image icon)
    img.addEventListener("error", () => picture.remove());
    picture.append(source, img);
    media.appendChild(picture);
  }

}

// ----- Called from index.html right after the stats list (still before the first paint) -----
function buildHomeStats() {
  const list = document.getElementById("home-stats");
  if (!list) return;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const stat of homeStats()) {
    const item = document.createElement("li");
    item.className = "home-stat";
    if (stat.icon) {
      item.insertAdjacentHTML("beforeend", `<svg class="icon home-stat-icon" aria-hidden="true"><use href="icons.svg#${stat.icon}"></use></svg>`);
    }
    const number = document.createElement("span");
    number.className = "home-stat-number";
    // A fixed width (in digits) so the box doesn't grow while counting up
    number.style.setProperty("--digits", String(stat.value).length);
    number.textContent = reduceMotion || stat.noCount ? stat.value.toLocaleString("en-GB") : "0";
    const label = document.createElement("span");
    label.className = "home-stat-label";
    label.textContent = stat.label;
    const text = document.createElement("span");
    text.className = "home-stat-text";
    text.append(number, label);
    if (stat.caption) {
      const caption = document.createElement("span");
      caption.className = "home-stat-caption";
      caption.textContent = stat.caption;
      text.appendChild(caption);
    }
    item.appendChild(text);
    list.appendChild(item);
    if (!reduceMotion && !stat.noCount) countUp(number, stat.value);
  }
  list.hidden = false;
}

// 0 -> value in about 1.2 s, fast at first and slowing down at the end
function countUp(element, value, duration = 1200) {
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(value * eased).toLocaleString("en-GB");
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ----- Called from index.html right after the "This Week" title -----
// Writes the greeting and date at once, so the line doesn't grow (and push the cards down)
// when dashboard.js fills it a moment later. Same wording and format as dashboard.js.
function fillWeekGreeting() {
  const now = new Date();
  const hour = now.getHours();
  const hello = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const greeting = document.getElementById("dash-greeting");
  const date = document.getElementById("dash-date");
  if (greeting) greeting.textContent = hello;
  if (date) {
    const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    date.textContent = noon.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
}

// ----- Below the hero: texts that use the settings (filled when the page has loaded) -----
function fillHomeSettings() {
  for (const element of document.querySelectorAll("[data-setting]")) {
    const value = { STUDENT_COUNT, COUNTRY_COUNT, TRACK_COUNT, COHORT_LABEL }[element.dataset.setting];
    if (value !== undefined) element.textContent = value;
  }
  const demo = document.querySelector(".people-note");
  if (demo) demo.hidden = !DIRECTORY_IS_DEMO;
  // Decorative: one small dot per student (no names, no data)
  const dots = document.getElementById("cohort-dots");
  if (dots && !dots.children.length) {
    for (let i = 0; i < STUDENT_COUNT; i++) dots.appendChild(document.createElement("span"));
  }
}

// ----- "Life Across EU-HEM": the city cards, from the same data as the City Guide -----
// (guide-data.js lists the guides; content/tracks.json says who studies where and when)
async function fillCityCards() {
  const container = document.getElementById("city-cards");
  if (!container || typeof CITY_GUIDES === "undefined" || typeof loadTracksFile !== "function") return;
  try {
    const cohort = tracksCohort(await loadTracksFile());
    container.innerHTML = "";
    for (const guide of CITY_GUIDES) {
      const university = cohort.universities[guide.university];
      const card = document.createElement("a");
      card.className = "city-card";
      card.href = `city-guide.html?city=${guide.id}`;
      if (guide.cover) card.appendChild(cityCoverPhoto(guide.cover));
      card.append(createElement("span", "city-country", university.country), createElement("strong", null, university.city),
        createElement("span", null, cityPresenceText(cohort, guide.university)),
        createElement("span", guide.file ? "city-status is-ready" : "city-status", guide.file ? "Read the guide →" : "Coming soon"));
      container.appendChild(card);
    }
  } catch (error) {
    console.error("City cards:", error); // the cards written in index.html stay
  }
}

// ----- "Students from around the world": a decorative world map with the four programme cities -----
// The same local map as the Students page (assets/map/world-countries.svg, Natural Earth, public domain).
// The dots mark the four universities only: there is no real data on where students come from.
// Positions are the cities' coordinates in the map's projection (scripts/build-world-map.js).
const PROGRAMME_CITIES = [
  { name: "Bologna", x: 527.1, y: 84.1 },
  { name: "Oslo", x: 522.5, y: 40.6 },
  { name: "Rotterdam", x: 510.1, y: 61.9, labelLeft: true },
  { name: "Innsbruck", x: 526.7, y: 75.6, labelLeft: true },
];
const COMMUNITY_MAP_VIEW = "470 22 100 76"; // Europe, around the four cities

async function fillCommunityMap() {
  const box = document.getElementById("community-map");
  if (!box) return;
  try {
    const response = await fetch("assets/map/world-countries.svg");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const svg = new DOMParser().parseFromString(await response.text(), "image/svg+xml").documentElement;
    if (svg.nodeName !== "svg") throw new Error("not an SVG");
    svg.setAttribute("viewBox", COMMUNITY_MAP_VIEW);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("focusable", "false");
    const ns = "http://www.w3.org/2000/svg";
    for (const city of PROGRAMME_CITIES) {
      const halo = document.createElementNS(ns, "circle");
      halo.setAttribute("cx", city.x);
      halo.setAttribute("cy", city.y);
      halo.setAttribute("r", "2.6");
      halo.setAttribute("class", "city-halo");
      const dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", city.x);
      dot.setAttribute("cy", city.y);
      dot.setAttribute("r", "1.1");
      dot.setAttribute("class", "city-dot");
      // City name next to the dot (Bologna and Innsbruck are close together: one left, one right)
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", city.x + (city.labelLeft ? -3.2 : 3.2));
      label.setAttribute("y", city.y + 1.3);
      label.setAttribute("text-anchor", city.labelLeft ? "end" : "start");
      label.setAttribute("class", "city-label");
      label.textContent = city.name;
      svg.append(halo, dot, label);
    }
    box.replaceChildren(document.importNode(svg, true));
  } catch {
    box.closest(".community-map").hidden = true; // decorative only: hide it quietly
  }
}

// ----- "Meet the community": three public profiles at a time from the Students page's demo data -----
// Fictional people only (data/demo-students.json, isDemo). The same privacy rules as the Students page
// (students-data.js, public view), so a members-only or hidden detail never appears here.
let peopleProfiles = [];
let peopleStart = 0;

function personCard(p) {
  const li = createElement("li", "person-card");
  const avatar = createElement("span", "person-avatar", EUHEM_STUDENTS_DATA.initialsOf(p.name));
  avatar.setAttribute("aria-hidden", "true");
  const name = createElement("a", "person-name", p.name);
  name.href = `students.html?profile=${encodeURIComponent(p.id)}`;
  li.append(avatar, name);
  const meta = [p.field && p.field.label, p.country && p.country.name].filter(Boolean).join(" · ");
  if (meta) li.appendChild(createElement("span", "person-meta", meta));
  if (p.bio) li.appendChild(createElement("span", "person-bio", p.bio.length > 90 ? p.bio.slice(0, 88).trim() + "…" : p.bio));
  return li;
}

function showPeople() {
  const list = document.getElementById("community-people");
  if (!list || !peopleProfiles.length) return;
  const shown = [0, 1, 2].map((i) => peopleProfiles[(peopleStart + i) % peopleProfiles.length]);
  list.replaceChildren(...shown.map(personCard));
}

async function fillCommunityPeople() {
  const list = document.getElementById("community-people");
  if (!list || typeof EUHEM_STUDENTS_DATA === "undefined") return;
  try {
    const response = await fetch("data/demo-students.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const records = ((await response.json()).records || []).filter((r) => r && r.isDemo === true);
    const D = EUHEM_STUDENTS_DATA;
    peopleProfiles = D.projectAll(records, D.makeViewer("public")).filter((p) => p.bio && p.field);
    showPeople();
    const step = (delta) => {
      peopleStart = (peopleStart + delta + peopleProfiles.length) % peopleProfiles.length;
      showPeople();
    };
    document.querySelector(".people-prev").addEventListener("click", () => step(-3));
    document.querySelector(".people-next").addEventListener("click", () => step(3));
  } catch {
    list.closest(".community-people").hidden = true;
  }
}

// ----- "What's new, and what's next": the current focus and the three latest releases -----
// From the same files as roadmap.html (content/roadmap.json, content/updates.json) and the same rules
// (roadmap-data.js): drafts never appear, and the current focus is labelled as work in progress.
async function fillRoadmapPreview() {
  const box = document.getElementById("roadmap-preview");
  if (!box || typeof EUHEM_ROADMAP === "undefined") return;
  const R = EUHEM_ROADMAP;
  const load = async (url) => {
    try {
      const response = await fetch(url, { cache: "no-cache" });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  };
  const [roadmap, updates] = await Promise.all([load("content/roadmap.json"), load("content/updates.json")]);
  const plan = roadmap && R.readRoadmap(roadmap);
  const now = plan && plan.items.find((item) => item.lane === "now");
  const latest = updates ? R.publishedUpdates(updates).slice(0, 3) : [];
  if (!now && !latest.length) {
    box.closest("section").hidden = true; // nothing to show: no broken box on the homepage
    return;
  }
  box.replaceChildren();
  if (now) {
    const card = createElement("a", "roadmap-preview-now");
    card.href = `roadmap.html#feature-${now.id}`;
    const label = createElement("span", "roadmap-preview-label");
    label.append(createElement("span", "roadmap-preview-dot"), document.createTextNode(`Now · ${R.ROADMAP_STATUS[now.status]}`));
    card.append(label, createElement("strong", null, now.title), createElement("span", null, now.summary));
    // Stage, releases shipped (counted from updates.json) and the season of the full Hub (roadmap.json)
    const parts = [
      plan.release && `${plan.release.stage} ${plan.release.version}`,
      updates && R.releaseCount(updates).text,
      plan.vision && `full Hub: ${plan.vision.targetLabel}`,
    ].filter(Boolean);
    if (parts.length) card.appendChild(createElement("span", "roadmap-preview-progress", parts.join(" · ")));
    card.appendChild(createElement("span", "roadmap-preview-more", "See what is planned next →"));
    box.appendChild(card);
  }
  if (latest.length) {
    const panel = createElement("div", "roadmap-preview-latest");
    panel.appendChild(createElement("h3", null, "Latest releases"));
    const list = createElement("ol");
    for (const item of latest) {
      const li = createElement("li");
      const date = createElement("time", null, R.dayLabel(item.date));
      date.dateTime = item.date;
      const link = createElement("a", null, item.title);
      link.href = `roadmap.html#update-${item.id}`;
      li.append(date, createElement("span", `roadmap-preview-type is-${item.type}`, R.UPDATE_TYPES[item.type]), link);
      list.appendChild(li);
    }
    panel.appendChild(list);
    box.appendChild(panel);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", fillRoadmapPreview);
  document.addEventListener("DOMContentLoaded", fillHomeSettings);
  document.addEventListener("DOMContentLoaded", fillCommunityMap);
  document.addEventListener("DOMContentLoaded", fillCommunityPeople);
  document.addEventListener("DOMContentLoaded", fillCityCards);
}

if (typeof module !== "undefined") module.exports = { heroSrcset, daysUntil, homeStats };
