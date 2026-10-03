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
// │ PROGRAM_END_DATE  "YYYY-MM-DD". "Estimated days to graduation" is counted    │
// │                   from it every day; it's hidden if empty or in the past.    │
// │ DIRECTORY_IS_DEMO true while students.html shows fictional demo profiles.    │
// └──────────────────────────────────────────────────────────────────────────────┘
const HERO_IMAGE = "assets/images/euhem-cohort-2026.jpg";
const HERO_IMAGE_ALT = "The EU-HEM 2026 cohort together under the porticoes of a street in Bologna";
const STUDENT_COUNT = 104;
const COUNTRY_COUNT = 23;
const TRACK_COUNT = 4;
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

// The four numbers in the hero. The days are left out when the date is missing or past.
function homeStats(today = null) {
  const days = today === null ? daysUntil(PROGRAM_END_DATE) : today;
  const stats = [
    { value: STUDENT_COUNT, label: "Students" },
    { value: COUNTRY_COUNT, label: "Countries" },
    { value: TRACK_COUNT, label: "Tracks" },
  ];
  if (days !== null && days > 0) stats.push({ value: days, label: "Estimated days to graduation", noCount: true });
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

  const list = document.getElementById("home-stats");
  if (!list) return;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const stat of homeStats()) {
    const item = document.createElement("li");
    item.className = "home-stat";
    const number = document.createElement("span");
    number.className = "home-stat-number";
    // A fixed width (in digits) so the box doesn't grow while counting up
    number.style.setProperty("--digits", String(stat.value).length);
    number.textContent = reduceMotion || stat.noCount ? stat.value.toLocaleString("en-GB") : "0";
    const label = document.createElement("span");
    label.className = "home-stat-label";
    label.textContent = stat.label;
    item.append(number, label);
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
  if (greeting) greeting.textContent = `${hello} 👋`;
  if (date) {
    const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    date.textContent = noon.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
}

// ----- Below the hero: texts that use the settings (filled when the page has loaded) -----
function fillHomeSettings() {
  for (const element of document.querySelectorAll("[data-setting]")) {
    const value = { STUDENT_COUNT, COUNTRY_COUNT, TRACK_COUNT }[element.dataset.setting];
    if (value !== undefined) element.textContent = value;
  }
  const demo = document.getElementById("cohort-demo-note");
  if (demo) demo.hidden = !DIRECTORY_IS_DEMO;
  // Decorative: one small dot per student (no names, no data)
  const dots = document.getElementById("cohort-dots");
  if (dots && !dots.children.length) {
    for (let i = 0; i < STUDENT_COUNT; i++) dots.appendChild(document.createElement("span"));
  }
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", fillHomeSettings);

if (typeof module !== "undefined") module.exports = { heroSrcset, daysUntil, homeStats };
