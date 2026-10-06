// Roadmap & Updates in a real browser (installed Chrome): overview, tabs, filters, Later, saved plans
// (and blocked storage), details drawer (focus, Escape, links, Back/Forward), copy link, errors,
// homepage preview, site search, navigation, phones and dark mode. Run: node tests/roadmap/browser.test.js .
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/markdown",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".csv": "text/csv", ".ics": "text/calendar" };

(async () => {
  let failJson = false;
  const site = http.createServer((req, res) => {
    const file = decodeURIComponent(req.url.split("?")[0].replace(/^\//, "")) || "index.html";
    const full = path.join(ROOT, file);
    if ((failJson && /content\/(roadmap|updates)\.json$/.test(file)) || !full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(failJson ? 503 : 404); return res.end("missing");
    }
    if (file === "content/updates.json") {
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      data.items.unshift({ id: "test-draft", date: null, title: "Secret upcoming feature", summary: "Not released yet.", category: "platform",
    type: "new", status: "draft", highlights: [], links: [], evidence: null });
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(data));
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(full)] || "text/plain" }); res.end(fs.readFileSync(full));
  }).listen(0);
  const base = `http://127.0.0.1:${site.address().port}/`;
  const browser = await chromium.launch({ channel: "chrome" });
  let n = 0; const ok = (name) => { n++; console.log("  ok  " + name); };
  const errors = [];
  const open = async (url = "roadmap.html", { viewport = { width: 1280, height: 900 }, scheme = "light", blockStorage = false, reducedMotion = "no-preference" } = {}) => {
    const context = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
    if (blockStorage) {
      await context.addInitScript(() => {
        const deny = () => { throw new DOMException("blocked", "SecurityError"); };
        Object.defineProperty(window, "localStorage", { get: () => ({ getItem: deny, setItem: deny, removeItem: deny }) });
      });
    }
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(`${url}: ${e}`));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_|corsi\.unibo|announcements|Roadmap:|Updates:|Map:/i.test(m.text())) errors.push(`${url}: ${m.text()}`); });
    await page.goto(base + url);
    if (url.startsWith("roadmap")) await page.waitForSelector("#roadmap-board .roadmap-card");
    return page;
  };
  const text = async (page, sel) => ((await page.textContent(sel)) || "").replace(/\s+/g, " ").trim();
  const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const drawerOpen = (page) => page.evaluate(() => document.getElementById("roadmap-drawer").open);

  /* ----- Overview and the three stages ----- */
  let page = await open();
  assert.deepStrictEqual(await page.$$eval(".roadmap-overview-item", (all) => all.map((b) => b.textContent.replace(/\s+/g, ""))),
    ["1Now", "8Next", "11Later", "14Released"]);
  assert.match(await text(page, "#roadmap-reviewed"), /Last reviewed 6 October 2026/);
  assert.match(await text(page, ".roadmap-card.is-now"), /In progress.*Student beta preparation/);
  assert.deepStrictEqual(await page.$$eval(".roadmap-window-label", (all) => all.map((h) => h.textContent)),
    ["October 2026", "October–November 2026", "November–December 2026"]);
  assert.match(await text(page, ".roadmap-lane.is-next"), /Estimated periods, not promises/);
  assert.strictEqual(await page.getAttribute("#roadmap-vision [role=progressbar]", "aria-valuenow"), "10");
  assert.match(await text(page, "#roadmap-vision"), /10%.*Planned finish: 3 March 2027 · \d+ days to go/);
  ok("overview counts, one prominent Now card, Next grouped by estimated period, overall progress 10% with the planned finish");

  assert.strictEqual(await page.locator(".roadmap-card.is-later").count(), 6);
  assert.strictEqual(await page.getAttribute(".roadmap-later-toggle", "aria-expanded"), "false");
  await page.click(".roadmap-later-toggle");
  assert.strictEqual(await page.locator(".roadmap-card.is-later").count(), 11);
  assert.strictEqual(await page.getAttribute(".roadmap-later-toggle", "aria-expanded"), "true");
  assert.strictEqual(await page.evaluate(() => document.activeElement.classList.contains("roadmap-later-toggle")), true);
  ok("Later shows six ideas, expands to all eleven, focus stays on the toggle");

  /* ----- Filters and search ----- */
  await page.click('#roadmap-stage .filter-chip:has-text("Now")');
  assert.match(await text(page, "#roadmap-count"), /Showing 1 of 20 plans/);
  assert.strictEqual(await page.evaluate(() => document.activeElement.textContent), "Now", "focus stays on the chip");
  await page.click('#roadmap-stage .filter-chip:has-text("Next")');
  await page.click('#roadmap-category .filter-chip:has-text("Learning")');
  assert.match(await text(page, "#roadmap-count"), /Showing 2 of 20 plans/);
  await page.click("#roadmap-clear");
  await page.fill("#roadmap-search", "EXPÉRIENCES second-year");
  assert.match(await text(page, "#roadmap-count"), /Showing 1 of 20 plans/);
  assert.match(await text(page, "#roadmap-board"), /Student experiences/);
  await page.fill("#roadmap-search", "zebra unicorn");
  assert.match(await text(page, ".empty-state"), /No plans match these filters/);
  await page.click('.empty-state button:has-text("Clear filters")');
  assert.match(await text(page, "#roadmap-count"), /^20 plans$/);
  assert.strictEqual(await page.inputValue("#roadmap-search"), "");
  ok("stage + topic filters combine, accent-insensitive search, empty state with Clear filters");

  /* ----- Tabs ----- */
  await page.click("#tab-updates");
  assert.strictEqual(await page.evaluate(() => location.hash), "#updates");
  assert.strictEqual(await page.isVisible("#panel-updates"), true);
  assert.strictEqual(await page.isVisible("#panel-roadmap"), false);
  assert.strictEqual(await page.locator(".update-entry").count(), 14);
  assert.ok(!(await text(page, "#updates-list")).includes("Secret upcoming feature"), "the test draft is hidden");
  await page.click('#roadmap-type .filter-chip:has-text("New")');
  const newCount = await page.locator(".update-entry").count();
  await page.click('#roadmap-type .filter-chip:has-text("Improved")');
  assert.strictEqual(newCount + await page.locator(".update-entry").count(), 14);
  await page.click('#roadmap-type .filter-chip:has-text("All updates")');
  await page.focus("#tab-updates");
  await page.keyboard.press("ArrowRight");
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), "tab-journey");
  assert.strictEqual(await page.getAttribute("#tab-journey", "aria-selected"), "true");
  assert.strictEqual(await page.isVisible("#roadmap-toolbar"), false);
  await page.keyboard.press("Home");
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), "tab-roadmap");
  ok("tabs: click and arrow keys, address follows, toolbar hidden on Our journey; Updates filter by type; draft hidden");

  await page.click("#tab-journey");
  const journey = await page.$$eval(".journey-title", (all) => all.map((h) => h.textContent));
  assert.strictEqual(journey[0], "First code");
  assert.strictEqual(journey.at(-1), "First cohort beta");
  assert.ok(journey.indexOf("First academic hub") < journey.indexOf("Bologna guide, announcements & directory preview"), "same-day releases in deployment order");
  assert.match(await text(page, ".journey-event.is-planned"), /Planned/);
  ok("Our journey: milestones and releases in time order, the beta clearly planned");
  await page.context().close();

  /* ----- Details drawer, deep links, Back/Forward, copy link ----- */
  page = await open("roadmap.html#roadmap");
  const opener = page.locator("#feature-student-stories-experiences .roadmap-details-link");
  await opener.click();
  assert.strictEqual(await drawerOpen(page), true);
  assert.strictEqual(await page.evaluate(() => location.hash), "#feature-student-stories-experiences");
  assert.strictEqual(await text(page, "#roadmap-drawer-title"), "Student experiences");
  assert.match(await text(page, "#roadmap-drawer"), /an estimate, not a promise.*Not available yet/);
  assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Close details");
  for (let i = 0; i < 15; i++) await page.keyboard.press("Tab");
  assert.ok(await page.evaluate(() => document.getElementById("roadmap-drawer").contains(document.activeElement)), "focus stays in the drawer");
  await page.click('#roadmap-drawer button:has-text("Copy link")');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /roadmap\.html#feature-student-stories-experiences$/);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => location.hash === "#roadmap");
  assert.strictEqual(await drawerOpen(page), false);
  assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.focusKey), "open-feature-student-stories-experiences-more");
  ok("drawer: opens from Details, own address, focus inside, copy link, Escape closes, focus and address return");

  await opener.click();
  await page.goBack();
  await page.waitForFunction(() => !document.getElementById("roadmap-drawer").open);
  await page.goForward();
  await page.waitForFunction(() => document.getElementById("roadmap-drawer").open);
  assert.strictEqual(await text(page, "#roadmap-drawer-title"), "Student experiences");
  await page.click(".roadmap-drawer-close");
  ok("Back closes the drawer, Forward reopens it");
  await page.context().close();

  page = await open("roadmap.html#feature-alumni-mentoring-skills-exchange");
  await page.waitForFunction(() => document.getElementById("roadmap-drawer").open);
  assert.strictEqual(await text(page, "#roadmap-drawer-title"), "Alumni mentoring & skills exchange");
  assert.match(await text(page, "#roadmap-drawer"), /No date yet/);
  assert.strictEqual(await page.locator("#feature-alumni-mentoring-skills-exchange").count(), 1, "a linked Later idea is revealed");
  await page.keyboard.press("Escape");
  await page.goto(base + "roadmap.html#update-thesis-explorer");
  await page.waitForFunction(() => document.getElementById("roadmap-drawer").open);
  assert.strictEqual(await page.getAttribute("#tab-updates", "aria-selected"), "true");
  assert.match(await text(page, "#roadmap-drawer"), /Released 4 October 2026/);
  assert.strictEqual(await page.locator('#roadmap-drawer a[href*="/actions/runs/"]').count(), 1);
  await page.keyboard.press("Escape");
  await page.goto(base + "roadmap.html#feature-does-not-exist");
  await page.waitForSelector(".toast");
  assert.match(await text(page, ".toast"), /not on the roadmap any more/);
  assert.strictEqual(await drawerOpen(page), false);
  await page.goto(base + "roadmap.html#update-test-draft");
  await page.waitForSelector(".toast");
  assert.strictEqual(await drawerOpen(page), false, "a draft cannot be opened by link");
  ok("direct links: a Later idea, a release (with deployment evidence), unknown ids and drafts get a neutral message");
  await page.context().close();

  /* ----- Saved plans ----- */
  page = await open();
  await page.click("#feature-student-digital-toolkit .roadmap-save");
  assert.strictEqual(await page.getAttribute("#feature-student-digital-toolkit .roadmap-save", "aria-pressed"), "true");
  assert.deepStrictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("euhem.roadmap.saved.v1"))), { version: 1, ids: ["student-digital-toolkit"] });
  assert.match(await text(page, "#roadmap-saved-only"), /Saved \(1\)/);
  await page.reload(); await page.waitForSelector("#roadmap-board .roadmap-card");
  await page.click("#roadmap-saved-only");
  assert.deepStrictEqual(await page.$$eval("#roadmap-board .roadmap-card", (all) => all.map((c) => c.id)), ["feature-student-digital-toolkit"]);
  await page.click("#feature-student-digital-toolkit .roadmap-save");
  assert.match(await text(page, ".empty-state"), /No saved plans yet/);
  await page.click("#feature-student-beta-preparation .roadmap-open, #roadmap-saved-only");
  await page.evaluate(() => localStorage.setItem("euhem.roadmap.saved.v1", "{not json"));
  await page.reload(); await page.waitForSelector("#roadmap-board .roadmap-card");
  assert.match(await text(page, "#roadmap-saved-only"), /Saved \(0\)/, "broken storage is ignored");
  ok("saved plans: on this device only, survive a reload, Saved-only filter, unsave, broken data ignored");
  await page.context().close();

  page = await open("roadmap.html", { blockStorage: true });
  await page.click("#feature-group-trips-adventures .roadmap-save");
  await page.waitForSelector(".toast");
  assert.match(await text(page, ".toast"), /for this visit only/);
  assert.match(await text(page, "#roadmap-saved-only"), /Saved \(1\)/);
  ok("with storage blocked, saving still works for the visit and says so");
  await page.context().close();

  /* ----- Loading errors ----- */
  failJson = true;
  page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(`roadmap (offline): ${e}`));
  await page.goto(base + "roadmap.html");
  await page.waitForSelector('#roadmap-status button:has-text("Retry")');
  failJson = false;
  await page.click('#roadmap-status button:has-text("Retry")');
  await page.waitForSelector("#roadmap-board .roadmap-card");
  ok("if the data cannot load, a clear message with Retry; Retry recovers");
  await page.close();

  /* ----- Homepage preview, search, navigation ----- */
  page = await open("index.html");
  await page.waitForSelector(".roadmap-preview-now");
  assert.match(await text(page, ".roadmap-preview-now"), /Now · In progresss*Student beta preparation/);
  assert.strictEqual(await page.getAttribute(".roadmap-preview-now", "href"), "roadmap.html#feature-student-beta-preparation");
  assert.deepStrictEqual(await page.$$eval(".roadmap-preview-latest a", (all) => all.map((a) => a.getAttribute("href"))),
    ["roadmap.html#update-academic-rules-journey-support", "roadmap.html#update-roadmap-and-updates", "roadmap.html#update-new-design"]);
  assert.match(await text(page, ".roadmap-preview-progress"), /10% of the full Hub built · planned finish 3 March 2027/);
  assert.strictEqual(await page.getAttribute(".roadmap-preview-bar", "aria-valuenow"), "10");
  ok("homepage: current focus and the three latest releases, from the same data");

  await page.keyboard.press("Control+k");
  await page.waitForSelector(".search-dialog .search-input");
  await page.fill(".search-dialog .search-input", "student experiences");
  await page.waitForSelector('.search-group-label:has-text("Roadmap plans (not available yet)")');
  const plan = page.locator('.search-result[href="roadmap.html#feature-student-stories-experiences"]');
  assert.match(await plan.textContent(), /Planned · October–November 2026 · not available yet/);
  await page.fill(".search-dialog .search-input", "past thesis explorer");
  await page.waitForSelector('.search-group-label:has-text("Released updates")');
  assert.match(await page.locator('.search-result[href="roadmap.html#update-thesis-explorer"]').textContent(), /Released · 4 October 2026/);
  await page.fill(".search-dialog .search-input", "secret upcoming feature");
  assert.strictEqual(await page.locator('.search-result[href="roadmap.html#update-test-draft"]').count(), 0);
  await page.keyboard.press("Escape"); // the first Escape clears the search box (browser behaviour)
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".search-dialog").open);
  ok("search finds plans (marked as not available yet) and releases, never drafts");

  await page.click('.menu-group:has-text("About")');
  assert.ok(await page.isVisible('.menu-dropdown a[href="roadmap.html"]'));
  assert.ok(await page.$('.footer-links a[href="roadmap.html"]'));
  ok("About menu and footer link to Roadmap & Updates");
  await page.context().close();

  /* ----- Phones, dark mode, reduced motion ----- */
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    page = await open("roadmap.html", { viewport: { width, height: 860 } });
    assert.strictEqual(await sideways(page), 0, `roadmap ${width}`);
    await page.click("#tab-updates"); assert.strictEqual(await sideways(page), 0, `updates ${width}`);
    await page.click("#tab-journey"); assert.strictEqual(await sideways(page), 0, `journey ${width}`);
    await page.goto(base + "roadmap.html#feature-beyond-euhem-opportunities");
    await page.waitForFunction(() => document.getElementById("roadmap-drawer").open);
    await page.waitForTimeout(450); // the slide-in animation
    const box = await page.locator("#roadmap-drawer").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `drawer fits at ${width}`);
    await page.context().close();
  }
  ok("no sideways scrolling at 320–1440px on every tab; the drawer fits");

  page = await open("roadmap.html", { scheme: "dark", reducedMotion: "reduce" });
  const colours = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor,
    getComputedStyle(document.querySelector(".roadmap-card.is-later")).backgroundColor,
    getComputedStyle(document.querySelector(".roadmap-pill.is-in-progress"), "::before").animationName]);
  assert.notStrictEqual(colours[0], "rgb(247, 245, 241)"); assert.notStrictEqual(colours[1], "rgb(251, 250, 248)");
  assert.strictEqual(colours[2], "none");
  ok("dark mode uses the dark palette; reduced motion stops the pulse");
  await page.context().close();

  assert.deepStrictEqual(errors, []);
  ok("no JavaScript errors");
  await browser.close(); site.close();
  console.log(n + " roadmap browser checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
