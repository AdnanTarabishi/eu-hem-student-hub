// Focused homepage news interactions in Chromium with a controlled clock and
// fictional CSV. No university requests, external images or real student data.
// Run: node tests/home/news-carousel.test.js .
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "../.."));
const BASE = "https://example.test/eu-hem-student-hub/";
const TODAY = "2026-10-08";
const HEADERS = ["Date", "Title", "Category", "Message", "Link", "Pinned", "Expires", "Posted by"];
const csv = (rows) => [HEADERS, ...rows].map((row) => row.map((cell) => '"' + String(cell || "").replace(/"/g, '""') + '"').join(",")).join("\n");
const ROWS = [
  [TODAY, "Pinned workshop update", "Academic", "An original fictional workshop notice for interaction testing.", "", "Yes", "", "Test team"],
  [TODAY, "Fictional reading circle", "Student Community", "Discuss the next chapter together.", "https://example.test/reading", "", "", "Test team"],
  ["2026-10-07", "Fictional campus welcome", "Social", "Find the welcome information on the full noticeboard.", "", "", "", "Test team"],
  ["2026-10-06", "Fictional study checklist", "Student Hub", "A fourth notice remains reachable from the homepage.", "", "", "", "Test team"],
  ["2026-10-09", "Scheduled fictional update", "Student", "This must stay hidden until tomorrow.", "", "", "", "Test team"],
  ["2026-10-01", "Expired fictional update", "Student", "This notice already expired.", "", "", "2026-10-07", "Test team"],
];
const FIXTURE = `<!doctype html><html><head><base href="${BASE}"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body class="eh-home"><main><section id="announcements" style="width:min(640px,100%);margin:20px auto">
<div class="eh-news-panel"><p id="latest-announcements-status">Loading announcements…</p>
<p id="home-announcement-demo-note" hidden>Demo announcements</p><div id="latest-announcements" aria-live="off"></div></div>
</section><button id="outside">Outside the carousel</button></main></body></html>`;
let browser;
let checks = 0;
const ok = (name) => { checks++; console.log("  ok  " + name); };

async function fixture({ rows = ROWS, reduced = false, fail = false, width = 1280, nativeObserver = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: reduced ? "reduce" : "no-preference", serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  let fetches = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/data/announcements.csv", (route) => {
    fetches++;
    return route.fulfill({ status: fail ? 503 : 200, contentType: "text/csv", body: fail ? "Unavailable" : csv(rows) });
  });
  await page.route("**/assets/announcements/*.svg", (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop();
    const file = path.join(ROOT, "assets/announcements", name);
    return fs.existsSync(file) ? route.fulfill({ contentType: "image/svg+xml", body: fs.readFileSync(file) }) : route.abort();
  });
  await page.route("**/fonts/**", (route) => route.abort());
  await page.clock.install({ time: new Date(TODAY + "T12:00:00Z") });
  await page.clock.pauseAt(new Date(TODAY + "T12:00:00Z"));
  await page.setContent(FIXTURE);
  await page.addStyleTag({ content: fs.readFileSync(path.join(ROOT, "style.css"), "utf8") });
  await page.addStyleTag({ content: fs.readFileSync(path.join(ROOT, "home.css"), "utf8") });
  await page.evaluate((feed) => { window.testFeed = feed; }, csv(rows));
  if (!nativeObserver) await page.evaluate(() => {
    // Keep timer tests deterministic; native intersection/layout is checked below.
    window.IntersectionObserver = class {
      constructor(callback) { this.callback = callback; window.newsObserver = this; }
      observe(target) { this.target = target; this.emit(true); }
      emit(visible) { this.callback([{ target: this.target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]); }
      disconnect() { this.disconnected = true; }
    };
  });
  for (const file of ["utils.js", "announcement-media.js", "home-news.js", "announcements.js"]) {
    await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, file), "utf8") });
  }
  if (fail) await page.locator("#latest-announcements-status").filter({ hasText: "could not be loaded" }).waitFor();
  else if (rows.length) await page.locator(".eh-news-slide").first().waitFor({ state: "attached" });
  else await page.locator("#latest-announcements-status").filter({ hasText: "No announcements" }).waitFor();
  return {
    page, context, errors, fetches: () => fetches,
    title: () => page.locator(".eh-news-slide:not([hidden]) .eh-news-title").textContent(),
    step: (milliseconds = 6000) => page.clock.runFor(milliseconds),
    close: () => context.close(),
  };
}

async function test(name, options, run) {
  const p = await fixture(options);
  try { await run(p); assert.deepEqual(p.errors, [], "no application errors"); ok(name); }
  finally { await p.close(); }
}

(async () => {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ["--no-sandbox"] });
  try {
    await test("one CSV request supplies all active stories; automatic changes hide inactive links and keep live regions quiet", {}, async (p) => {
      assert.equal(p.fetches(), 1);
      assert.equal(await p.page.locator(".eh-news-slide").count(), 4);
      assert.equal(await p.title(), "Pinned workshop update");
      assert.equal(await p.page.locator(".eh-news-count").textContent(), "1 / 4");
      assert.equal(await p.page.locator(".eh-news-carousel").getAttribute("aria-live"), "off");
      assert.equal(await p.page.locator(".eh-news-status").textContent(), "");
      for (const slide of await p.page.locator(".eh-news-slide[hidden]").all()) {
        assert.equal(await slide.isVisible(), false);
        assert.equal(await slide.locator("a").first().isVisible(), false);
        assert.equal(await slide.getAttribute("aria-hidden"), "true");
      }
      await p.step(5999);
      assert.equal(await p.title(), "Pinned workshop update");
      await p.step(1);
      assert.equal(await p.title(), "Fictional reading circle");
      assert.equal(await p.page.locator(".eh-news-status").textContent(), "", "autoplay does not announce the story");
      assert.equal(await p.page.locator(".eh-news-slide:not([hidden]) .eh-news-title a").getAttribute("href"), "announcements.html#2026-10-08-fictional-reading-circle");
      assert.equal(await p.page.locator(".eh-news-cover img").first().getAttribute("alt"), "");
    });

    await test("manual arrows wrap, retain button focus, announce the count, and pause until Play is chosen", {}, async (p) => {
      await p.page.locator(".eh-news-prev").focus();
      await p.page.keyboard.press("Enter");
      assert.equal(await p.title(), "Fictional study checklist");
      assert.equal(await p.page.locator(".eh-news-count").textContent(), "4 / 4");
      assert.equal(await p.page.evaluate(() => document.activeElement.className), "eh-news-prev");
      assert.match(await p.page.locator(".eh-news-status").textContent(), /Update 4 of 4/);
      assert.equal(await p.page.locator(".eh-news-toggle").textContent(), "Play");
      await p.page.locator("#outside").focus();
      await p.step(18000);
      assert.equal(await p.title(), "Fictional study checklist");
      await p.page.locator(".eh-news-next").focus();
      await p.page.keyboard.press("Enter");
      assert.equal(await p.title(), "Pinned workshop update");
      await p.page.locator(".eh-news-toggle").focus();
      await p.page.keyboard.press("Enter");
      await p.step(12000);
      assert.equal(await p.title(), "Pinned workshop update", "focus on Play holds the story still");
      await p.page.locator("#outside").focus();
      await p.step();
      assert.equal(await p.title(), "Fictional reading circle");
      assert.equal(await p.page.evaluate(() => document.activeElement.id), "outside", "automatic changes never move focus");
    });

    await test("hover, focused story, hidden document and out-of-view state suspend rotation with a fresh delay on return", {}, async (p) => {
      await p.page.locator(".eh-news-carousel").hover();
      await p.step(12000);
      assert.equal(await p.title(), "Pinned workshop update");
      await p.page.mouse.move(2, 2);
      await p.step();
      assert.equal(await p.title(), "Fictional reading circle");
      await p.page.locator(".eh-news-slide:not([hidden]) .eh-news-title a").focus();
      await p.step(12000);
      assert.equal(await p.title(), "Fictional reading circle");
      await p.page.locator("#outside").focus();
      await p.page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await p.step(12000);
      assert.equal(await p.title(), "Fictional reading circle");
      await p.page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, value: false });
        document.dispatchEvent(new Event("visibilitychange"));
        window.newsObserver.emit(false);
      });
      await p.step(12000);
      assert.equal(await p.title(), "Fictional reading circle");
      await p.page.evaluate(() => window.newsObserver.emit(true));
      await p.step(5999);
      assert.equal(await p.title(), "Fictional reading circle");
      await p.step(1);
      assert.equal(await p.title(), "Fictional campus welcome");
    });

    await test("reduced motion starts paused and still supports manual browsing", { reduced: true }, async (p) => {
      assert.equal(await p.page.locator(".eh-news-toggle").textContent(), "Play");
      await p.step(24000);
      assert.equal(await p.title(), "Pinned workshop update");
      await p.page.locator(".eh-news-next").click();
      assert.equal(await p.title(), "Fictional reading circle");
    });

    await test("changing to reduced motion stops a running carousel", {}, async (p) => {
      await p.page.emulateMedia({ reducedMotion: "reduce" });
      // Media changes arrive through the browser event queue.
      await p.page.waitForFunction(() => document.querySelector(".eh-news-toggle").textContent === "Play");
      await p.step(18000);
      assert.equal(await p.title(), "Pinned workshop update");
    });

    await test("rerender replaces the old timer, retains controls/focus and avoids duplicate story IDs", {}, async (p) => {
      await p.step(3000);
      await p.page.evaluate(() => {
        const control = document.querySelector(".eh-news-next");
        window.savedNewsControl = control;
        control.focus();
        const all = activeAnnouncements(rowsToAnnouncements(parseCsv(window.testFeed)), "2026-10-08");
        renderHomeNews([...all, all[0]], "2026-10-08");
      });
      assert.equal(await p.page.evaluate(() => document.querySelector(".eh-news-next") === window.savedNewsControl && document.activeElement === window.savedNewsControl), true);
      assert.equal(await p.page.locator(".eh-news-slide").count(), 4);
      await p.page.locator("#outside").focus();
      await p.step(3000);
      assert.equal(await p.title(), "Pinned workshop update", "the timer before rerender was cancelled");
      await p.step(3000);
      assert.equal(await p.title(), "Fictional reading circle");
    });

    await test("one story has no active rotation or controls", { rows: [ROWS[0]] }, async (p) => {
      assert.equal(await p.page.locator(".eh-news-controls").isVisible(), false);
      assert.equal(await p.page.locator(".eh-news-next").isDisabled(), true);
      await p.step(24000);
      assert.equal(await p.title(), "Pinned workshop update");
      assert.equal(await p.page.locator(".eh-news-slide:not([hidden]) .eh-news-title a").isVisible(), true);
    });

    await test("empty feed and CSV failures retain honest loading-status messages", { rows: [] }, async (p) => {
      assert.equal(await p.page.locator(".eh-news-carousel").isVisible(), false);
      assert.equal(await p.page.locator("#latest-announcements-status").isVisible(), true);
      assert.equal(await p.page.locator("#latest-announcements-status").textContent(), "No announcements right now.");
      const failed = await fixture({ fail: true });
      try {
        assert.match(await failed.page.locator("#latest-announcements-status").textContent(), /could not be loaded/);
        assert.equal(await failed.page.locator(".eh-news-carousel").count(), 0);
        assert.equal(failed.fetches(), 1);
      } finally { await failed.close(); }
    });

    await test("failed artwork falls back to the generic cover and then to a decorative icon", {}, async (p) => {
      await p.page.evaluate(() => {
        const image = document.querySelector(".eh-news-cover img");
        image.dispatchEvent(new Event("error"));
      });
      // Generic stories already use the generic cover, so failure produces line art.
      assert.equal(await p.page.locator(".eh-news-cover-fallback .icon").count(), 1);
      await p.page.evaluate(() => {
        const all = activeAnnouncements(rowsToAnnouncements(parseCsv(window.testFeed)), "2026-10-08");
        all[0].id = "2026-10-07-student-representatives-election-results";
        renderHomeNews(all, "2026-10-08");
        const image = document.querySelector(".eh-news-cover img");
        image.dispatchEvent(new Event("error"));
      });
      assert.match(await p.page.locator(".eh-news-cover img").first().getAttribute("src"), /community-update\.svg$/);
      await p.page.locator(".eh-news-cover img").first().evaluate((image) => image.dispatchEvent(new Event("error")));
      assert.equal(await p.page.locator(".eh-news-cover-fallback .icon").count(), 1);
    });

    await test("native browser intersection stops rotation when the card leaves the viewport", { nativeObserver: true }, async (p) => {
      await p.page.waitForTimeout(50);
      await p.step();
      assert.equal(await p.title(), "Fictional reading circle");
      await p.page.evaluate(() => { document.querySelector("#announcements").style.marginTop = "1500px"; });
      await p.page.waitForTimeout(50);
      await p.step(12000);
      assert.equal(await p.title(), "Fictional reading circle");
      await p.page.evaluate(() => { document.querySelector("#announcements").style.marginTop = "20px"; });
      await p.page.waitForTimeout(50);
      await p.step();
      assert.equal(await p.title(), "Fictional campus welcome");
    });

    for (const width of [320, 390, 1280]) {
      await test(`news is readable at ${width}px and both themes without horizontal overflow`, { width, reduced: true }, async (p) => {
        for (const theme of ["light", "dark"]) {
          await p.page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
          assert.equal(await p.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          assert.equal(await p.page.locator(".eh-news-title a").first().isVisible(), true);
          assert.equal(await p.page.locator(".eh-news-next").isVisible(), true);
        }
      });
    }
  } finally { if (browser) await browser.close(); }
  console.log(`${checks} homepage news checks passed`);
})().catch((error) => { console.error(error); process.exit(1); });
