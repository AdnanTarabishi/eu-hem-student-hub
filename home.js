// ===== Homepage: settings, hero photo and cohort numbers =====
// Loaded in <head> of index.html (before the page is drawn), so the hero photo starts
// downloading at once and the hero has its final size before the first paint (nothing jumps).

// ┌──────────────────────────────────────────────────────────────────────────────┐
// │ HOMEPAGE SETTINGS: change the values here.                                   │
// │                                                                              │
// │ HERO_IMAGE        The JPG behind the hero. Next to it there must be WebP     │
// │                   copies named <name>-640.webp, -960, -1280 and -1600.webp   │
// │                   (smaller and faster). Phones get the 640, big and sharp    │
// │                   screens the 1600. Use "" for no photo (dark background).   │
// │ HERO_IMAGE_ALT    What the photo shows, for people using screen readers.     │
// │ Cohort counts, origins and source notes come from cohort-data.js.            │
// │ TRACK_COUNT       Specialisation tracks in semester 2.                       │
// │ PROGRAM_END_DATE  "YYYY-MM-DD". "Estimated days to graduation" is counted    │
// │                   from it every day; it's hidden if empty or in the past.    │
// │ DIRECTORY_IS_DEMO true while students.html shows fictional demo profiles.    │
// └──────────────────────────────────────────────────────────────────────────────┘
const HERO_IMAGE = "assets/images/euhem-cohort-2026.jpg";
const HERO_IMAGE_ALT = "The EU-HEM 2026 cohort together under the porticoes of a street in Bologna";
const HOME_COHORT = typeof EUHEM_COHORT !== "undefined" ? EUHEM_COHORT
  : typeof module !== "undefined" && module.exports ? require("./cohort-data.js") : null;
const PEOPLE_COUNT = HOME_COHORT ? HOME_COHORT.total : undefined;
const COUNTRY_COUNT = HOME_COHORT ? HOME_COHORT.countryCount : undefined;
const CONTINENT_COUNT = HOME_COHORT ? HOME_COHORT.continentCount : undefined;
const COHORT_LABEL = HOME_COHORT ? HOME_COHORT.label : undefined;
const SOURCE_TITLE = HOME_COHORT ? HOME_COHORT.source.title : undefined;
const SOURCE_NOTATION = HOME_COHORT ? HOME_COHORT.source.notation : undefined;
const TRACK_COUNT = 4;
const PROGRAM_END_DATE = "2028-09-30";
const DIRECTORY_IS_DEMO = true;

const HERO_WEBP_WIDTHS = [640, 960, 1280, 1600];
// Tablet portrait crops need a wider source to keep the photo sharp.
const HERO_IMAGE_SIZES = "(max-width: 720px) 100vw, (max-width: 900px) 720px, 51vw";

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
    ...(HOME_COHORT ? [
      { value: PEOPLE_COUNT, label: "People represented", icon: "students" },
      { value: COUNTRY_COUNT, label: "Countries of origin", caption: `Across ${CONTINENT_COUNT} continents`, icon: "globe" },
    ] : []),
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
    preload.setAttribute("imagesizes", HERO_IMAGE_SIZES);
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
    source.sizes = HERO_IMAGE_SIZES;
    const img = document.createElement("img");
    img.src = HERO_IMAGE;
    img.alt = HERO_IMAGE_ALT;
    img.width = 1600;
    img.height = 1200;
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
    const value = { PEOPLE_COUNT, COUNTRY_COUNT, CONTINENT_COUNT, TRACK_COUNT, COHORT_LABEL, SOURCE_TITLE, SOURCE_NOTATION }[element.dataset.setting];
    if (value !== undefined) element.textContent = value;
  }
  const demo = document.querySelector(".people-note");
  if (demo) demo.hidden = !DIRECTORY_IS_DEMO;
  // Decorative: one small dot per person represented (aggregate counts only)
  const dots = document.getElementById("cohort-dots");
  if (dots && !dots.children.length) {
    for (let i = 0; i < PEOPLE_COUNT; i++) dots.appendChild(document.createElement("span"));
  }
}

// A small visual preview of the same tracks shown in the Tracks Explorer.
// Abbreviations and full names always come from the shared programme data.
async function fillHomeTrackPreview() {
  const list = document.getElementById("home-track-preview");
  if (!list || typeof loadTracksFile !== "function" || typeof tracksCohort !== "function") return;
  try {
    const cohort = tracksCohort(await loadTracksFile());
    const tracks = cohort.tracks.filter((track) => /^[a-z0-9-]+$/.test(track.id) && track.abbr && track.name);
    if (!tracks.length) return;
    list.replaceChildren(...tracks.map((track) => {
      const node = createElement("li", "eh-track-node");
      node.style.setProperty("--eh-track-color", `var(--track-${track.id})`);
      const dot = createElement("span", "eh-track-dot");
      dot.setAttribute("aria-hidden", "true");
      const abbreviation = createElement("span", "eh-track-abbr", track.abbr);
      abbreviation.title = track.name;
      node.append(dot, abbreviation, createElement("span", "visually-hidden", `: ${track.name}`));
      return node;
    }));
    list.hidden = false;
  } catch {
    // Keep the existing Tracks Explorer link when this optional preview cannot load.
  }
}

// Progressive enhancement: all content stays visible without these entrance animations.
function prepareHomeReveals() {
  if (!("IntersectionObserver" in window) || typeof Element.prototype.animate !== "function") return;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion && reduceMotion.matches) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (reduceMotion && reduceMotion.matches) continue;
      entry.target.animate([
        { opacity: .84, transform: "translateY(14px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: 480, easing: "cubic-bezier(.22, 1, .36, 1)" });
    }
  }, { threshold: .08 });
  for (const element of document.querySelectorAll("[data-home-reveal]")) observer.observe(element);
}

// A slight perspective response gives the resource cards depth on mouse devices.
// Touch, keyboard navigation and reduced-motion preferences keep the flat layout.
function prepareHomeTilt() {
  if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cards = [...document.querySelectorAll(".eh-resource")];
  for (const card of cards) {
    let frame = null;
    const reset = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      card.style.removeProperty("--eh-tilt-x");
      card.style.removeProperty("--eh-tilt-y");
    };
    card.classList.add("eh-tilt");
    card.addEventListener("pointermove", (event) => {
      if (reduceMotion.matches || event.pointerType !== "mouse") return;
      if (frame !== null) cancelAnimationFrame(frame);
      const { clientX, clientY } = event;
      frame = requestAnimationFrame(() => {
        frame = null;
        const rect = card.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, ((clientX - rect.left) / rect.width - .5) * 2));
        const y = Math.max(-1, Math.min(1, ((clientY - rect.top) / rect.height - .5) * 2));
        card.style.setProperty("--eh-tilt-x", `${(-y * 2).toFixed(2)}deg`);
        card.style.setProperty("--eh-tilt-y", `${(x * 2.5).toFixed(2)}deg`);
      });
    });
    card.addEventListener("pointerleave", reset);
    card.addEventListener("pointercancel", reset);
    reduceMotion.addEventListener("change", reset);
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

// ----- Cohort origins: shared aggregate counts and the local Natural Earth map -----
// This compact overview links to the interactive atlas. It is independent of demo profiles.
async function fillCommunityMap() {
  const box = document.getElementById("community-map");
  if (!box || !HOME_COHORT) return;
  const largest = document.getElementById("community-origin-countries");
  if (largest) {
    const countries = [...HOME_COHORT.countries].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en"));
    largest.replaceChildren(...countries.slice(0, 3).map((country) => {
      const item = createElement("li", "eh-origin-country");
      const flag = createElement("span", "country-flag");
      flag.dataset.countryFlag = country.code;
      flag.setAttribute("aria-hidden", "true");
      const count = createElement("strong", null, country.count);
      count.setAttribute("aria-label", `${country.count} people`);
      item.append(flag, createElement("span", null, country.name), count);
      return item;
    }));
  }
  try {
    const response = await fetch("assets/map/world-countries.svg");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const source = new DOMParser().parseFromString(await response.text(), "image/svg+xml").documentElement;
    if (source.nodeName !== "svg") throw new Error("not an SVG");
    const viewBox = (source.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
    if (viewBox.length !== 4 || !viewBox.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[3] <= 0) throw new Error("invalid map dimensions");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", viewBox.join(" "));
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("aria-hidden", "true");
    const origins = new Map(HOME_COHORT.countries.map((country) => [country.code, country]));
    // Copy only country geometry from the local asset into fresh, inert SVG elements.
    for (const outline of source.querySelectorAll("path")) {
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", outline.getAttribute("d") || "");
      path.setAttribute("class", "map-country");
      const code = outline.getAttribute("data-code");
      if (code && /^[A-Z]{2}$/.test(code)) path.setAttribute("data-code", code);
      const country = origins.get(code);
      if (country) {
        path.classList.add("has-origin");
        path.setAttribute("data-count", country.count);
        const title = document.createElementNS(ns, "title");
        title.textContent = `${country.name}: ${country.count} ${country.count === 1 ? "person" : "people"}`;
        path.appendChild(title);
      }
      svg.appendChild(path);
    }
    box.replaceChildren(svg);
    const legend = document.getElementById("community-map-legend");
    if (legend) legend.hidden = false;
  } catch {
    // Keep the source, figures and atlas link available when the map asset cannot load.
    box.classList.add("is-unavailable");
    box.replaceChildren(createElement("p", "eh-origin-map-error", "The world map is unavailable. The full country overview is available through the link below."));
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


if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", fillRoadmapPreview);
  document.addEventListener("DOMContentLoaded", fillHomeSettings);
  document.addEventListener("DOMContentLoaded", fillHomeTrackPreview);
  document.addEventListener("DOMContentLoaded", prepareHomeReveals);
  document.addEventListener("DOMContentLoaded", prepareHomeTilt);
  document.addEventListener("DOMContentLoaded", fillCommunityMap);
  document.addEventListener("DOMContentLoaded", fillCommunityPeople);
  document.addEventListener("DOMContentLoaded", fillCityCards);
}

if (typeof module !== "undefined") module.exports = { heroSrcset, daysUntil, homeStats };
