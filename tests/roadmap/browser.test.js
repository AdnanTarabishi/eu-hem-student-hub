// Roadmap & Updates in a real browser (Playwright Chromium): overview, tabs, filters, Later, saved plans
// (and blocked storage), details drawer (focus, Escape, links, Back/Forward), copy link, errors,
// homepage preview, site search, navigation, phones and dark mode. Run: node tests/roadmap/browser.test.js .
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const SHOTS = path.resolve(process.env.SCREENSHOT_DIR || path.join(ROOT, "test-artifacts/roadmap"));
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/markdown",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".csv": "text/csv", ".ics": "text/calendar" };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
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
  const browser = await chromium.launch();
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
  const captureReleaseViews = async (page, label) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(SHOTS, `overview-${label}.png`), animations: "disabled" });
    await page.locator("#roadmap-v2").screenshot({ path: path.join(SHOTS, `v2-${label}.png`), animations: "disabled" });
  };

  /* ----- Overview and the three stages ----- */
  let page = await open();
  assert.deepStrictEqual(await page.$$eval(".roadmap-overview-item", (all) => all.map((b) => b.textContent.replace(/\s+/g, ""))),
    ["2Now", "7Next", "8Later", "37Released"]);
  assert.match(await text(page, "#roadmap-reviewed"), /Last reviewed 8 October 2026/);
  assert.deepStrictEqual(await page.$$eval(".roadmap-card.is-now .roadmap-card-title", (all) => all.map((h) => h.textContent)),
    ["Exam Prep", "Beta feedback & essential improvements"]);
  assert.deepStrictEqual(await page.$$eval(".roadmap-window-label", (all) => all.map((h) => h.textContent)),
    ["October 2026", "November 2026", "November–December 2026", "After launch"]);
  assert.match(await text(page, ".roadmap-lane.is-next"), /Estimated periods, not promises/);
  assert.strictEqual(await page.locator("#roadmap-vision [role=progressbar]").count(), 0);
  assert.ok(!(await text(page, "#roadmap-vision")).includes("%"), "the release count does not imply a completion percentage");
  assert.match(await text(page, "#roadmap-vision"), /37 releases shipped since 1 Oct 2026.*Full Hub: Spring 2027/s);
  ok("overview counts, two Now cards, Next by period with After launch, verified release count, full Hub Spring 2027");

  // Release banner, What's in v1.0, the plan note, limitations, domain move, feedback
  assert.match(await text(page, "#roadmap-release"), /Beta\s*v0\.9.*Next: v1\.0 — Public Launch · target 15 October 2026.*targets, not promises/s);
  assert.match(await text(page, ".roadmap-release-following"), /Following: v2\.0 — Study, Connect & Prepare · target Early November 2026/);
  assert.strictEqual(await page.getAttribute(".roadmap-release-following time", "datetime"), "2026-11");
  const v1 = await page.$$eval("#roadmap-v1 .roadmap-v1-item", (all) => all.map((li) => [li.querySelector(".roadmap-pill").textContent, li.querySelector("button").textContent]));
  assert.deepStrictEqual(v1, [["In progress", "Custom domain"], ["In progress", "Admin dashboard"], ["In progress", "Exam Prep"],
    ["Released in v0.9", "Academic Rules"], ["Released in v0.9", "Programme Journey"], ["Released in v0.9", "Support & Contacts"]]);
  const v2 = await page.$$eval("#roadmap-v2 .roadmap-v1-item", (all) => all.map((li) => [li.querySelector(".roadmap-pill").textContent, li.querySelector("button").textContent]));
  assert.deepStrictEqual(v2, [["Planned", "Personal study dashboard"], ["Planned", "Expanded learning resources"],
    ["Planned", "Reviewed student contributions"], ["Planned", "Mobility preparation"]]);
  assert.match(await text(page, "#feature-student-accounts-cohort-profiles"), /Needs a secure sign-in and a privacy review first/);
  assert.match(await text(page, "#roadmap-info"), /Known limitations.*fictional demos.*on this device and browser.*not live.*cannot yet publish through the dashboard.*Moving to a new domain.*Redirects.*each web address.*backup or export/s);
  assert.strictEqual(await page.getAttribute(".roadmap-feedback-button", "href"), "contact.html");
  assert.match(await text(page, ".roadmap-feedback-button"), /Suggest a feature \/ Report a problem/);
  await page.locator(".site-footer .footer-version").waitFor();
  assert.strictEqual(await text(page, ".site-footer .footer-version"), "Beta · v0.9");
  ok("release banner preserves Beta v0.9 and v1.0, adds an early-November v2 target with planned scope, limitations and footer version");
  await page.click('#roadmap-v1 .roadmap-v1-item button:has-text("Academic Rules")');
  assert.strictEqual(await page.evaluate(() => location.hash), "#update-academic-rules-journey-support");
  await page.keyboard.press("Escape");
  await page.click("#tab-roadmap");
  ok("a released part of v1.0 opens its release");
  await page.click('#roadmap-v2 .roadmap-v1-item button:has-text("Expanded learning resources")');
  assert.strictEqual(await page.evaluate(() => location.hash), "#feature-student-hub-v2");
  assert.match(await text(page, "#roadmap-drawer"), /Not available yet/);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => location.hash === "#roadmap");
  assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.focusKey), "roadmap-v2-include-1");
  ok("v2 scope opens the planned feature and restores focus to its distinct included-item control");

  assert.strictEqual(await page.locator(".roadmap-card.is-later").count(), 6);
  assert.strictEqual(await page.getAttribute(".roadmap-later-toggle", "aria-expanded"), "false");
  await page.click(".roadmap-later-toggle");
  assert.strictEqual(await page.locator(".roadmap-card.is-later").count(), 8);
  assert.strictEqual(await page.getAttribute(".roadmap-later-toggle", "aria-expanded"), "true");
  assert.strictEqual(await page.evaluate(() => document.activeElement.classList.contains("roadmap-later-toggle")), true);
  ok("Later shows six ideas, expands to all eight, focus stays on the toggle");

  /* ----- Filters and search ----- */
  await page.click('#roadmap-stage .filter-chip:has-text("Now")');
  assert.match(await text(page, "#roadmap-count"), /Showing 2 of 17 plans/);
  assert.strictEqual(await page.evaluate(() => document.activeElement.textContent), "Now", "focus stays on the chip");
  await page.click('#roadmap-stage .filter-chip:has-text("Next")');
  await page.click('#roadmap-category .filter-chip:has-text("Learning")');
  assert.match(await text(page, "#roadmap-count"), /Showing 2 of 17 plans/);
  await page.click("#roadmap-clear");
  await page.fill("#roadmap-search", "MOBILITY chécklists");
  assert.match(await text(page, "#roadmap-count"), /Showing 1 of 17 plans/);
  assert.match(await text(page, "#roadmap-board"), /Personal mobility checklists/);
  await page.fill("#roadmap-search", "zebra unicorn");
  assert.match(await text(page, ".empty-state"), /No plans match these filters/);
  await page.click('.empty-state button:has-text("Clear filters")');
  assert.match(await text(page, "#roadmap-count"), /^17 plans$/);
  assert.strictEqual(await page.inputValue("#roadmap-search"), "");
  ok("stage + topic filters combine, accent-insensitive search, empty state with Clear filters");

  /* ----- Tabs ----- */
  await page.click("#tab-updates");
  assert.strictEqual(await page.evaluate(() => location.hash), "#updates");
  assert.strictEqual(await page.isVisible("#panel-updates"), true);
  assert.strictEqual(await page.isVisible("#panel-roadmap"), false);
  assert.strictEqual(await page.locator(".update-entry").count(), 37);
  assert.ok(!(await text(page, "#updates-list")).includes("Secret upcoming feature"), "the test draft is hidden");
  await page.click('#roadmap-type .filter-chip:has-text("New")');
  const newCount = await page.locator(".update-entry").count();
  await page.click('#roadmap-type .filter-chip:has-text("Improved")');
  assert.strictEqual(newCount + await page.locator(".update-entry").count(), 37);
  await page.click('#roadmap-type .filter-chip:has-text("All updates")');
  await page.focus("#tab-updates");
  await page.keyboard.press("ArrowRight");
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), "tab-journey");
  assert.strictEqual(await page.getAttribute("#tab-journey", "aria-selected"), "true");
  assert.strictEqual(await page.isVisible("#roadmap-toolbar"), false);
  await page.keyboard.press("Home");
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), "tab-roadmap");
  ok("tabs: click and arrow keys, address follows, toolbar hidden on Our journey; Updates filter by type; draft hidden");

  // Version tags and the version filter on the Updates tab
  await page.click("#tab-updates");
  assert.deepStrictEqual(await page.$$eval("#roadmap-version .filter-chip", (all) => all.map((b) => b.textContent)),
    ["All versions", "v0.9", "v0.5", "v0.4", "v0.3", "v0.1"]);
  assert.strictEqual(await page.locator(".update-entry .roadmap-version").count(), 37);
  await page.click('#roadmap-version .filter-chip:has-text("v0.5")');
  assert.deepStrictEqual(await page.$$eval(".update-entry .roadmap-version", (all) => [...new Set(all.map((t) => t.textContent))]), ["v0.5"]);
  assert.match(await text(page, "#roadmap-count"), /Showing 2 of 37 updates/);
  await page.click("#roadmap-clear");
  assert.match(await text(page, "#roadmap-count"), /^37 updates$/);
  ok("Updates: a version tag on every release; the version filter shows one version; Clear filters resets it");

  await page.click("#tab-journey");
  const journey = await page.$$eval(".journey-title", (all) => all.map((h) => h.textContent));
  assert.strictEqual(journey[0], "First code");
  assert.strictEqual(journey[journey.length - 1], "v2.0 — Study, Connect & Prepare");
  assert.ok(journey.indexOf("Public Launch v1.0 — custom domain and dashboard") < journey.indexOf("v2.0 — Study, Connect & Prepare"));
  // The beta (completed on 7 Oct) comes before that day's releases: completed milestones lead their day
  assert.ok(journey.indexOf("First cohort beta") < journey.indexOf("Fundamentals of Statistics study guides"), "completed milestone leads its day");
  assert.ok(await page.locator('.journey-event:not(.is-planned) .journey-title:text-is("First cohort beta")').count() === 1, "the beta is shown as done");
  assert.ok(journey.indexOf("First academic hub") < journey.indexOf("Bologna guide, announcements & directory preview"), "same-day releases in deployment order");
  assert.strictEqual(await page.locator(".journey-event.is-planned").count(), 2); // both upcoming versions; the beta is completed
  const v2Milestone = page.locator('.journey-event.is-planned:has(.journey-title:text-is("v2.0 — Study, Connect & Prepare"))');
  assert.strictEqual(await v2Milestone.locator("time").textContent(), "Early November 2026");
  assert.strictEqual(await v2Milestone.locator("time").getAttribute("datetime"), "2026-11");
  assert.match(await text(page, ".journey-event.is-release"), /Released · v0\.1/);
  ok("Our journey: historical releases stay ordered, beta is completed, v1 and v2 are planned with their original date precision");
  await page.context().close();

  /* ----- Details drawer, deep links, Back/Forward, copy link ----- */
  page = await open("roadmap.html#roadmap");
  const opener = page.locator("#feature-expanded-practice-bank .roadmap-details-link");
  await opener.click();
  assert.strictEqual(await drawerOpen(page), true);
  assert.strictEqual(await page.evaluate(() => location.hash), "#feature-expanded-practice-bank");
  assert.strictEqual(await text(page, "#roadmap-drawer-title"), "More quizzes, flashcards & question banks");
  assert.match(await text(page, "#roadmap-drawer"), /After launch: planned, no date yet.*Not available yet/);
  assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Close details");
  const focusState = () => page.locator("#roadmap-drawer").evaluate((dialog) => {
    const active = document.activeElement;
    return { modal: dialog.open && dialog.matches(":modal"), inDialog: dialog.contains(active),
      isBody: active === document.body, documentHasFocus: document.hasFocus(), tag: active?.tagName || null, id: active?.id || null };
  });
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const focus = await focusState();
    const browserControls = focus.isBody && !focus.documentHasFocus;
    assert.ok(focus.modal && (focus.inDialog || browserControls), `Tab ${i + 1}: unexpected focus target ${JSON.stringify(focus)}`);
    if (browserControls) {
      console.log(`  info  Tab ${i + 1}: focus left the document ${JSON.stringify(focus)}`);
      await page.keyboard.press("Shift+Tab");
      const returned = await focusState();
      assert.ok(returned.modal && returned.inDialog && returned.documentHasFocus, `Return from browser controls: ${JSON.stringify(returned)}`);
    }
  }
  await page.locator("#roadmap-search").focus();
  assert.ok(await page.evaluate(() => document.getElementById("roadmap-drawer").contains(document.activeElement)), "background controls remain inert while the native drawer is open");
  await page.click('#roadmap-drawer button:has-text("Copy link")');
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /roadmap\.html#feature-expanded-practice-bank$/);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => location.hash === "#roadmap");
  assert.strictEqual(await drawerOpen(page), false);
  assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.focusKey), "open-feature-expanded-practice-bank-more");
  ok("drawer: opens from Details, own address, focus inside, copy link, Escape closes, focus and address return");

  await opener.click();
  await page.goBack();
  await page.waitForFunction(() => !document.getElementById("roadmap-drawer").open);
  await page.goForward();
  await page.waitForFunction(() => document.getElementById("roadmap-drawer").open);
  assert.strictEqual(await text(page, "#roadmap-drawer-title"), "More quizzes, flashcards & question banks");
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
  await page.click("#feature-group-trips-adventures .roadmap-save");
  assert.strictEqual(await page.getAttribute("#feature-group-trips-adventures .roadmap-save", "aria-pressed"), "true");
  assert.deepStrictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("euhem.roadmap.saved.v1"))), { version: 1, ids: ["group-trips-adventures"] });
  assert.match(await text(page, "#roadmap-saved-only"), /Saved \(1\)/);
  await page.reload(); await page.waitForSelector("#roadmap-board .roadmap-card");
  await page.click("#roadmap-saved-only");
  assert.deepStrictEqual(await page.$$eval("#roadmap-board .roadmap-card", (all) => all.map((c) => c.id)), ["feature-group-trips-adventures"]);
  await page.click("#feature-group-trips-adventures .roadmap-save");
  assert.match(await text(page, ".empty-state"), /No saved plans yet/);
  await page.click("#roadmap-saved-only");
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
  assert.match(await text(page, ".roadmap-preview-now"), /Now · In progress\s*Exam Prep/);
  assert.strictEqual(await page.getAttribute(".roadmap-preview-now", "href"), "roadmap.html#feature-exam-prep");
  assert.deepStrictEqual(await page.$$eval(".roadmap-preview-latest a", (all) => all.map((a) => a.getAttribute("href"))),
    ["roadmap.html#update-homepage-visual-refresh", "roadmap.html#update-announcements-newsroom", "roadmap.html#update-cohort-origins-distribution"]);
  assert.strictEqual(await text(page, ".roadmap-preview-progress"), "Beta v0.9 · 37 releases shipped since 1 Oct 2026 · full Hub: Spring 2027");
  ok("homepage: current focus, stage, releases shipped and the three latest releases, from the same data");

  await page.keyboard.press("Control+k");
  await page.waitForSelector(".search-dialog .search-input");
  await page.fill(".search-dialog .search-input", "mobility checklists");
  await page.waitForSelector('.search-group-label:has-text("Roadmap plans (not available yet)")');
  const plan = page.locator('.search-result[href="roadmap.html#feature-mobility-checklists"]');
  assert.match(await plan.textContent(), /Planned · November 2026 · not available yet/);
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
    if (width === 390 || width === 1440) await captureReleaseViews(page, `${width}-light`);
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

  for (const width of [390, 1440]) {
    page = await open("roadmap.html", { viewport: { width, height: 860 }, scheme: "dark", reducedMotion: "reduce" });
    const colours = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor,
      getComputedStyle(document.querySelector(".roadmap-card.is-later")).backgroundColor,
      getComputedStyle(document.querySelector(".roadmap-pill.is-in-progress"), "::before").animationName]);
    assert.notStrictEqual(colours[0], "rgb(247, 245, 241)"); assert.notStrictEqual(colours[1], "rgb(251, 250, 248)");
    assert.strictEqual(colours[2], "none");
    assert.strictEqual(await sideways(page), 0, `dark roadmap ${width}`);
    await captureReleaseViews(page, `${width}-dark`);
    await page.context().close();
  }
  ok("dark mode uses the dark palette on mobile and desktop; reduced motion stops the pulse");

  assert.deepStrictEqual(errors, []);
  ok("no JavaScript errors");
  await browser.close(); site.close();
  console.log(n + " roadmap browser checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
