// ===== Service worker: offline copies of the site =====
// A small script the browser runs in the background (registered by pwa.js).
// - Site files (pages, styles, scripts, icons, fonts) are saved when the app is installed,
//   then served from the saved copy and refreshed in the background ("stale while revalidate").
// - Data (timetable, exam dates, programme, notes, announcements, calendars, city and university guides, roadmap)
//   is always fetched fresh; the last saved copy is used only when there is no internet.
// - When the site is updated, VERSION changes: the new worker waits, pwa.js shows
//   "Update available · Reload", and old saved copies are deleted.
// Nothing personal is stored here: only public site files and public data.

const VERSION = "58ab44d7";
const SITE_CACHE = `site-${VERSION}`;
const DATA_CACHE = "data"; // kept across versions, so offline data survives an update

const SITE_FILES = [
  "toolkit.html",
  "toolkit-data.js",
  "toolkit.js",
  "toolkit.css",
  "assets/images/cities/bologna/two-towers-640.webp",
  "assets/images/cities/oslo/oslofjord-640.webp",
  "assets/images/cities/rotterdam/cube-houses-640.webp",
  "statistics-lab.html", "statistics-lab.css", "statistics-lab.js", "statistics-lab-math.js",
  "statistics-lab-tools.css", "statistics-lab-tools.js", "statistics-lab-tools-math.js",
  "statistics-lab-foundations.css", "statistics-lab-foundations.js", "statistics-lab-inference-math.js",
  "statistics-lab-page.js", "statistics-lab-course.js", "fund-statistics-lab-bridge.js",
  "studyplan.css", "studyplan-data.js",
  "planning.css", "planning.js",
  "fund-course.css", "fund-course.js",
  "fund-statistics.html", "fund-statistics.css", "fund-statistics.js", "fund-statistics-math.js", "fund-statistics-activities.js", "fund-statistics-practice.js", "fund-statistics-labs.js",
  "quant-methods.css", "quant-methods.js", "health-econ-management.css", "health-econ-management.js", "fhem-exam.css", "fhem-exam.js",
  "statistics.html", "statistics.css", "statistics.js", "statistics-study.js", "statistics-calculations.js",
  "./", "index.html", "home.css", "studyplan.html", "timetable.html", "exams.html", "calendar.html",
  "notes.html", "notes-landing.css", "notes-schedule.js", "course.html", "lecture.html", "create.html", "fhem-exam.html", "city-guide.html", "announcements.html", "students.html",
  "privacy.html", "contact.html", "tracks.html", "thesis.html", "join.html", "experiences.html",
  "universities.html", "university.html", "universities.css", "universities-data.js", "universities.js",
  "join.css", "directory-config.js", "directory-options.js", "join.js",
  "students.css", "students-config.js", "students-data.js", "countries.js", "assets/map/world-countries.svg",
  "assets/flags/country-flags.css", "assets/flags/countries.png",
  "roadmap.html", "roadmap.css", "roadmap.js", "roadmap-data.js",
  "academic-rules.html", "academic-rules.js", "journey.html", "journey.js",
  "support.html", "support.js",
  "style.css", "experiences.css", "experiences-data.js", "experiences.js", "lecture.css", "lecture.js", "lecture-activities.js", "icons.svg", "manifest.webmanifest",
  "fonts/inter-latin.woff2", "fonts/inter-latin-ext.woff2", "fonts/source-serif-4-latin-600.woff2",
  "img/app-icon.svg", "img/app-icon-192.png", "img/favicon-32.png", "img/apple-touch-icon.png",
  "img/universities/mci-campus-600.webp",
  "img/universities/eur-campus-600.webp",
  "img/universities/uio-campus-600.webp",
  "img/universities/unibo-campus-600.webp",
  "assets/images/cities/bologna/archiginnasio-anatomical-theatre-640.webp", "assets/images/cities/bologna/archiginnasio-anatomical-theatre-1200.webp", "assets/images/cities/oslo/blindern-campus-640.webp", "assets/images/cities/oslo/blindern-campus-1200.webp", "assets/images/cities/rotterdam/campus-woudestein-640.webp", "assets/images/cities/rotterdam/campus-woudestein-1200.webp", "assets/images/cities/innsbruck/valley-view-640.webp", "assets/images/cities/innsbruck/valley-view-1200.webp",
  "theme.js", "home.js", "site-nav.js", "utils.js", "ui.js", "search.js", "pwa.js", "announcements.js",
  "programme.js", "unibo-data.js", "dashboard.js", "onboarding.js", "studyplan.js",
  "timetable.js", "exams.js", "calendar.js", "events.js", "events.css", "guide.js", "students.js",
  "notes-data.js", "notes-progress.js", "notes-render.js", "notes-landing.js", "notes-course.js",
  "notes-practice.js", "notes-quiz.js", "notes-create.js",
  "tracks-data.js", "tracks.js", "thesis-enrichment.js", "thesis-data.js", "thesis.js", "thesis-guide.css", "thesis-guide-data.js", "thesis-guide.js", "guide-data.js",
];

// Data: always try the internet first
const DATA_FOLDERS = ["content/", "data/", "calendar/", "docs/content/"];
const DATA_HOSTS = ["corsi.unibo.it"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SITE_CACHE).then((cache) => cache.addAll(SITE_FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("site-") && name !== SITE_CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

// pwa.js sends this when the visitor clicks "Reload" on the update message
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  const local = url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
  const path = local ? url.pathname.slice(scope.pathname.length) : "";

  if (DATA_HOSTS.includes(url.hostname) || (local && DATA_FOLDERS.some((folder) => path.startsWith(folder)))) {
    event.respondWith(networkFirst(event, request));
  } else if (request.mode === "navigate" && local) {
    event.respondWith(pageRequest(request));
  } else if (local || url.hostname === "cdnjs.cloudflare.com") {
    event.respondWith(staleWhileRevalidate(event, request));
  }
  // Anything else (e.g. Google Sheets, maps) goes straight to the internet as usual
});

// Data: internet first, saved copy when offline. The copy remembers when it was saved,
// and the page is told so it can say "showing data saved on …".
async function networkFirst(event, request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set("x-saved-at", new Date().toISOString());
      const copy = new Response(await response.clone().blob(), { status: response.status, statusText: response.statusText, headers });
      event.waitUntil(cache.put(request, copy));
    }
    return response;
  } catch (error) {
    const saved = await cache.match(request);
    if (!saved) throw error;
    tellPage(event, { type: "offline-data", savedAt: saved.headers.get("x-saved-at") });
    return saved;
  }
}

// Pages: internet first (so pages are always current), saved copy when offline
async function pageRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SITE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const saved = (await caches.match(request, { ignoreSearch: true })) || (await caches.match("index.html"));
    if (saved) return saved;
    throw error;
  }
}

// Styles, scripts, icons, fonts: saved copy at once, refreshed in the background
async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(SITE_CACHE);
  const saved = await cache.match(request);
  const fresh = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  if (saved) {
    event.waitUntil(fresh.catch(() => {}));
    return saved;
  }
  try {
    return await fresh;
  } catch (error) {
    // Offline and never saved with this exact address (e.g. "ui.js?v=…"): use any saved version
    const any = await cache.match(request, { ignoreSearch: true });
    if (any) return any;
    throw error;
  }
}

async function tellPage(event, message) {
  const client = await self.clients.get(event.clientId || event.resultingClientId);
  if (client) client.postMessage(message);
}
