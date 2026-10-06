// The editorial homepage in a real browser (installed Chrome): the same page hooks as before
// (home.js, dashboard.js, announcements.js, onboarding.js), the shared four-group menu, live-data
// failures, a saved study plan, theme persistence, site search, direct links, widths and dark mode.
// Run: node tests/home/browser.test.js .
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/markdown",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".ics": "text/calendar" };
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
let n = 0; const ok = (name) => { n++; console.log("  ok  " + name); };

// ----- Without a browser: the page keeps every hook the scripts fill, exactly once -----
const HOOKS = ["hero-media", "home-stats", "dash-greeting", "dash-date", "dash-today", "dash-exam", "dash-plan", "dash-today-title",
  "dash-exam-title", "welcome-slot", "explore", "community-map", "community-people", "city-cards", "announcements",
  "latest-announcements", "latest-announcements-status", "home-announcement-demo-note", "home-roadmap", "roadmap-preview", "site-nav"];
for (const id of HOOKS) assert.strictEqual((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `#${id} exactly once`);
for (const cls of ["people-prev", "people-next", "people-note", "community-people", "community-map"]) assert.ok(html.includes(cls), cls);
ok(`index.html keeps all ${HOOKS.length} hooks used by home.js, dashboard.js, announcements.js, onboarding.js and site-nav.js, once each`);

assert.ok(!/homepage-navigation\.js|homepage-redesign\.js|preview-standalone|noindex/.test(html), "no candidate-only scripts or noindex");
assert.ok(!/Standalone design preview|Nora Vermeer|RESOURCE EXAMPLE/.test(html), "no preview fixtures");
assert.ok(!/docs\.google|script\.google|sheets\.googleapis/.test(html), "no backend endpoints");
assert.strictEqual((html.match(/<script[^>]*src="site-nav\.js/g) || []).length, 1, "one shared menu script");
ok("no standalone-preview leftovers: one menu script, no demo dashboard text, no fictional preview people, no endpoints");

(async () => {
  const site = http.createServer((req, res) => {
    const file = decodeURIComponent(req.url.split("?")[0].replace(/^\//, "")) || "index.html";
    const full = path.join(ROOT, file);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end("missing"); }
    res.writeHead(200, { "Content-Type": mime[path.extname(full)] || "text/plain" }); res.end(fs.readFileSync(full));
  }).listen(0);
  const base = `http://127.0.0.1:${site.address().port}/`;
  const browser = await chromium.launch({ channel: "chrome" });
  const errors = [];
  // Fixed date; UniBo answered by default with an error (no network in tests), or blocked
  const open = async (url = "index.html", { viewport = { width: 1280, height: 900 }, scheme = "light", storage = null } = {}) => {
    const context = await browser.newContext({ viewport, colorScheme: scheme, serviceWorkers: "block", reducedMotion: "reduce" });
    await context.clock.setFixedTime(new Date("2026-10-06T10:00:00+02:00"));
    await context.route(/unibo\.it/, (route) => route.abort());
    if (storage) await context.addInitScript((items) => { for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v); }, storage);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(`${url}: ${e.message}`));
    await page.goto(base + url);
    return page;
  };
  const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  try {
    // --- Content from the existing scripts ---
    let page = await open();
    await page.locator("#city-cards .city-card-photo").first().waitFor();
    await page.locator("#community-people .person-card").first().waitFor();
    await page.locator("#roadmap-preview .roadmap-preview-now").waitFor();
    assert.ok(await page.$eval("#hero-media img", (img) => img.complete && img.naturalWidth > 0), "hero photo loads");
    const stats = await page.$$eval("#home-stats .home-stat", (all) => all.map((li) => li.textContent.replace(/\s+/g, " ").trim()));
    assert.strictEqual(stats.length, 4);
    assert.match(stats[0], /104 ?Students ?Cohort 2026–2028/);
    assert.match(stats[3], /Estimated days left ?30 Sep 2028 · provisional/);
    assert.match(await page.textContent(".eh-stats-note"), /Cohort overview · 2026–2028.*estimate, not an official deadline/s);
    ok("hero photo, cohort numbers from home.js (cohort label, provisional date) and the estimate disclaimer");

    assert.strictEqual(await page.locator("#community-people .person-card").count(), 3);
    assert.ok(await page.isVisible(".people-note"), "fictional demo label visible");
    assert.match(await page.textContent(".people-note"), /Fictional demo/);
    const firstPerson = await page.textContent("#community-people .person-name");
    await page.click(".people-next");
    assert.notStrictEqual(await page.textContent("#community-people .person-name"), firstPerson);
    assert.strictEqual(await page.locator("#community-map svg .city-dot").count(), 4);
    assert.deepStrictEqual(await page.$$eval("#community-map svg .city-label", (all) => all.map((t) => t.textContent).sort()), ["Bologna", "Innsbruck", "Oslo", "Rotterdam"]);
    assert.match(await page.textContent("#community-map-caption"), /Not where students come from/);
    ok("community: three public demo profiles with the Fictional demo label, carousel, map of the four universities (not origins)");

    assert.strictEqual(await page.locator("#city-cards .city-card").count(), 4);
    assert.strictEqual(await page.locator("#city-cards .city-card-photo img").count(), 4);
    assert.strictEqual(await page.locator(".eh-resource").count(), 6);
    for (const href of ["tracks.html", "notes.html", "thesis.html", "academic-rules.html", "journey.html", "support.html"]) {
      assert.strictEqual(await page.locator(`.eh-resource a[href="${href}"]`).count(), 1, href);
    }
    assert.strictEqual(await page.locator("#roadmap-preview .roadmap-preview-latest li").count(), 3);
    ok("city cards with the guide photos, six resource cards (incl. Academic Rules, Programme Journey, Support), roadmap preview");

    // --- Live data unavailable: honest messages, the exam period from programme.json still shows ---
    await page.locator("#dash-today .dash-empty").waitFor({ timeout: 30000 });
    assert.match(await page.textContent("#dash-today"), /couldn't be loaded from UniBo/);
    assert.match(await page.textContent("#dash-exam"), /Next exam period: 26 Oct – 7 Nov 2026/);
    assert.ok(!(await page.textContent("main")).includes("Standalone design preview"));
    ok("UniBo offline: the cards say so (no invented classes), the exam period still shows from programme.json");

    // --- Menu: four groups by keyboard; the brand is Home ---
    assert.deepStrictEqual(await page.$$eval(".menu > .menu-item > :first-child", (all) => all.map((e) => e.textContent.trim())), ["Study", "Resources", "Community", "Life"]);
    assert.strictEqual(await page.getAttribute(".site-title a", "aria-current"), "page");
    const menu = await page.evaluate(() => SITE_MENU.flatMap((g) => g.items.map((i) => i.href)));
    for (const href of ["timetable.html", "exams.html", "studyplan.html", "tracks.html", "calendar.html", "academic-rules.html", "journey.html",
      "notes.html", "thesis.html", "announcements.html", "index.html#links", "students.html", "join.html", "support.html", "roadmap.html",
      "index.html#about", "privacy.html", "contact.html", "city-guide.html"]) assert.ok(menu.includes(href), href);
    await page.focus('.menu-group:text("Life")');
    await page.keyboard.press("Enter");
    assert.ok(await page.isVisible('.menu-dropdown a[href="city-guide.html?city=oslo"]'));
    await page.keyboard.press("Escape");
    assert.strictEqual(await page.getAttribute('.menu-group:text("Life")', "aria-expanded"), "false");
    ok("shared menu: Study, Resources, Community, Life (one SITE_MENU), every page reachable, keyboard open/close, brand = Home");

    // --- Site search (search.js) still indexes everything ---
    await page.keyboard.press("Control+k");
    await page.waitForSelector(".search-dialog .search-input");
    await page.fill(".search-dialog .search-input", "academic rules");
    await page.locator('.search-result[href="academic-rules.html"]').first().waitFor();
    await page.keyboard.press("Escape");
    ok("Ctrl+K opens the full site search, which finds the new pages");

    // --- Direct links into the page and the footer ---
    for (const hash of ["#explore", "#links", "#about", "#your-week"]) {
      await page.goto(base + "index.html" + hash);
      await page.waitForTimeout(400);
      const top = await page.evaluate((h) => document.querySelector(h).getBoundingClientRect().top, hash);
      assert.ok(top > -5 && top < 900, `${hash} in view (top ${top})`);
    }
    ok("direct links #explore, #your-week and the footer targets #links and #about land in view");
    await page.context().close();

    // --- A saved study plan: compact hero, the plan card shows progress ---
    const plan = JSON.stringify({ version: 1, cohort: "2026-27", term: "y1-s1", choices: {}, statuses: {}, savedAt: "2026-10-01T10:00:00Z" });
    page = await open("index.html", { storage: { "euhem-study-plan-v1": plan } });
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains("home-compact")));
    await page.locator("#dash-plan .dash-plan-cfu").waitFor();
    assert.match(await page.textContent("#dash-plan"), /CFU/);
    assert.strictEqual(await page.locator('#dash-plan a.button[href="studyplan.html"]').count(), 0, "no 'Plan my semester' when a plan is saved");
    ok("saved study plan: compact hero and the plan card shows CFU progress (dashboard.js)");
    await page.context().close();

    // --- Theme: theme.js keeps the choice ---
    page = await open();
    await page.click(".header-actions .theme-toggle");
    assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
    await page.reload();
    assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
    const statsBg = await page.$eval(".eh-stats", (el) => getComputedStyle(el).backgroundColor);
    assert.notStrictEqual(statsBg, "rgb(255, 255, 255)", "stats card follows dark mode");
    assert.strictEqual(await page.$eval(".eh-hero .eh-button-brand", (el) => getComputedStyle(el).backgroundColor), "rgb(169, 71, 45)");
    ok("theme choice survives a reload; dark mode recolours the cards and keeps the Terracotta button");
    await page.context().close();

    // --- Widths ---
    for (const width of [360, 375, 390, 768, 1024, 1280, 1440]) {
      page = await open("index.html", { viewport: { width, height: 900 } });
      await page.locator("#city-cards .city-card-photo").first().waitFor();
      assert.ok(await sideways(page) <= 0, `${width}px scrolls sideways`);
      assert.strictEqual(await page.isVisible(".menu-toggle"), width <= 900, `${width}px menu button`);
      await page.context().close();
    }
    page = await open("index.html", { viewport: { width: 375, height: 800 }, scheme: "dark" });
    await page.click(".menu-toggle");
    assert.ok(await page.isVisible('.menu-group:text("Community")'));
    await page.keyboard.press("Escape");
    assert.ok(await sideways(page) <= 0);
    await page.context().close();
    ok("no sideways scrolling at 360, 375, 390, 768, 1024, 1280 and 1440 px; phone drawer opens and closes in dark mode");

    assert.deepStrictEqual(errors, [], "page errors");
    ok("no JavaScript errors");
  } finally {
    await browser.close();
    site.close();
  }
  console.log(`${n} homepage checks passed`);
})().catch((error) => { console.error(error); process.exit(1); });
