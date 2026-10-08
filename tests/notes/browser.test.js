// The Notes library against real content, in a browser, including GitHub Pages' subdirectory.
// Run: npm run test:notes (uses system Chromium if available, otherwise Playwright Chromium).
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/plain", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".webmanifest": "application/manifest+json", ".csv": "text/csv" };
let checks = 0;
const ok = (text) => { checks++; console.log("  ok  " + text); };
const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

(async () => {
  const site = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/eu-hem-student-hub\//, "");
    const full = path.resolve(ROOT, name || "index.html");
    if (!full.startsWith(ROOT + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) { res.writeHead(404); return res.end("missing"); }
    res.writeHead(200, { "Content-Type": mime[path.extname(full)] || "application/octet-stream" });
    res.end(fs.readFileSync(full));
  }).listen(0);
  const base = `http://127.0.0.1:${site.address().port}/eu-hem-student-hub/`;
  const browser = await chromium.launch({ executablePath: executable, args: ["--no-sandbox"] });
  const errors = [];
  const contexts = [];
  const open = async (url = "notes.html", options = {}) => {
    const { now = "2026-10-07T10:00:00+02:00", examHtml, calendarError = false, ...contextOptions } = options;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block", ...contextOptions });
    contexts.push(context);
    await context.clock.setFixedTime(new Date(now));
    await context.route(/^https?:\/\//, route => {
      const address = new URL(route.request().url());
      if (address.hostname === "corsi.unibo.it" && examHtml !== undefined) return route.fulfill({ contentType: "text/html", body: examHtml });
      if (calendarError && address.pathname.includes("/calendar/")) return route.fulfill({ status: 503, body: "unavailable" });
      return address.hostname === "127.0.0.1" ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(base + url);
    await page.locator("#notes-course-results, .concept-list, .progress-tiles, .study-list, .notes-empty-state").first().waitFor();
    return page;
  };
  try {
    let page = await open();
    assert.equal(await page.locator(".course-card").count(), 8);
    assert.equal(await page.locator(".notes-library-stat").count(), 6);
    assert.equal(await page.locator("h1").count(), 1);
    assert.match(await page.textContent("#study-focus"), /Your learning starts here/);
    assert.equal(await page.getAttribute("#contribute-slot a", "href"), "contact.html");
    assert.ok((await page.getAttribute(".notes-focus-next", "href")).startsWith("lecture.html?topic="));
    for (const href of await page.locator(".course-card a").evaluateAll(all => all.map(a => a.getAttribute("href")))) {
      if (href.startsWith("https://")) assert.ok(/corsi\.unibo\.it|almaesami\.unibo\.it/.test(href), href);
      else {
        assert.ok(href.startsWith("course.html?course="), href);
        assert.ok(fs.existsSync(path.join(ROOT, href.split("?")[0])), href);
      }
    }
    ok("real course content, personal empty state, working contribution link and course/lecture destinations under the Pages subdirectory");
    assert.equal(await page.locator('[data-teaching-group="now"] .course-card').count(), 3);
    assert.equal(await page.locator('[data-teaching-group="upcoming"] .course-card').count(), 3);
    assert.equal(await page.locator('[data-teaching-group="finished"] .course-card').count(), 2);
    assert.equal(await page.locator(".notes-module-dates").count(), 11);
    assert.match(await page.locator('[data-module="fund-healthcare-management"]').textContent(), /10 Nov 2026.*3 Dec 2026/);
    assert.match(await page.locator('[data-module="right-to-health"]').textContent(), /8 Oct 2026.*23 Oct 2026/);
    await page.locator('[data-course-exam="fund-health-econ-management"].has-exam').waitFor();
    assert.match(await page.locator('[data-course-exam="fund-health-econ-management"]').textContent(), /27 Oct 2026/);
    assert.match(await page.locator("#notes-exam-feed-status").textContent(), /saved calendar copy/);
    assert.match(await page.locator('[data-course-exam="health-systems"]').textContent(), /No upcoming date in the calendar copy/);
    await page.locator('[data-teaching-filter="upcoming"]').click();
    assert.equal(await page.locator(".course-card").count(), 3);
    assert.equal(await page.getByLabel("Filter by teaching status").inputValue(), "upcoming");
    await page.locator('[data-teaching-filter="upcoming"]').click();
    assert.equal(await page.locator(".course-card").count(), 8);
    ok("current/upcoming/completed sections, dates for every module and honest calendar fallback; semester overview filters courses");

    // Controlled HTML in the official parser's format, using the existing calendar's
    // module codes/dates. Registration details below are test fixtures only.
    const liveHtml = `<h3 role="tab" aria-controls="health-exam"><a><span class="code">97177</span>Fundamentals of Health Economics and Management</a></h3>
      <div id="health-exam"><table class="single-item">
      <tr><th>When</th><td>27 October 2026 at 10:00</td></tr>
      <tr><th>Componente:</th><td>79060 - FUNDAMENTALS OF HEALTH ECONOMICS</td></tr>
      <tr><th>Subscriptions list:</th><td><span>30 September 2026</span><span>23 October 2026</span></td></tr>
      <tr><th>Test type:</th><td>scritto</td></tr><tr><th>Place:</th><td>Test room</td></tr>
      </table></div>`;
    const live = await open("notes.html", { examHtml: liveHtml, timezoneId: "America/Los_Angeles" });
    await live.locator('[data-course-exam="fund-health-econ-management"].has-exam').waitFor();
    const liveExam = live.locator('[data-course-exam="fund-health-econ-management"]');
    assert.match(await liveExam.textContent(), /27 Oct 2026.*10:00 \(Bologna\)/);
    assert.match(await liveExam.textContent(), /Module: Fundamentals in Health Economics/);
    assert.ok(await liveExam.getByRole("link", { name: "Register on AlmaEsami" }).isVisible());
    assert.match(await live.locator('[data-course-exam="health-systems"]').textContent(), /No upcoming exam date published/);
    assert.match(await live.locator("#notes-exam-feed-status").textContent(), /Exam dates from UniBo/);
    await live.locator('.course-card:has([data-course-exam="fund-health-econ-management"]) .course-card-save').click();
    await live.locator('[data-teaching-filter="now"]').click();
    await live.route("https://corsi.unibo.it/**/exam-dates", route => route.fulfill({ contentType: "text/html", body: "<p>No scheduled exams</p>" }));
    await live.getByRole("button", { name: "Refresh exam dates" }).click();
    await live.getByRole("button", { name: "Refresh exam dates" }).waitFor({ state: "visible" });
    await live.waitForFunction(() => !document.getElementById("notes-refresh-exams").disabled);
    assert.equal(await live.locator(".has-exam").count(), 0);
    assert.equal(await live.getByLabel("Filter by teaching status").inputValue(), "now");
    assert.equal(await live.textContent("#notes-saved-count"), "1");
    assert.match(await liveExam.textContent(), /No upcoming exam date published/);
    await live.context().clock.setFixedTime(new Date("2026-10-08T00:01:00+02:00"));
    await live.evaluate(() => refreshLandingSchedule());
    assert.equal(await live.locator('[data-teaching-group="now"] .course-card').count(), 4);
    assert.match(await live.locator('[data-module="right-to-health"]').textContent(), /In progress/);
    await live.context().close();
    ok("official exam matching, Bologna times, registration, refresh preserving filters/bookmarks and automatic day changes while travelling");

    const unavailable = await open("notes.html", { calendarError: true });
    await unavailable.getByText("Exam dates are unavailable. Use the official UniBo link to check your next sitting.").waitFor();
    assert.equal(await unavailable.locator(".course-card").count(), 8);
    assert.equal(await unavailable.locator(".has-exam").count(), 0);
    assert.match(await unavailable.locator('[data-course-exam="fund-health-econ-management"]').textContent(), /could not be loaded/);
    await unavailable.context().close();
    ok("when both exam sources fail, courses remain usable and no dates are invented");

    await page.getByRole("button", { name: "Lectures", exact: true }).click();
    assert.equal(await page.locator(".course-card").count(), 3);
    await page.getByRole("button", { name: "Flashcards", exact: true }).click();
    const coursesWithCards = await page.evaluate(() => landingData.courses.filter(course => course.flashcards.length).length);
    assert.equal(await page.locator(".course-card").count(), coursesWithCards);
    await page.getByRole("button", { name: "All resources", exact: true }).click();
    await page.getByLabel("Filter by teaching status").selectOption("other");
    assert.equal(await page.locator(".course-card").count(), 0);
    assert.ok(await page.getByRole("button", { name: "Clear filters" }).isVisible());
    await page.getByRole("button", { name: "Clear filters" }).click();
    assert.equal(await page.locator(".course-card").count(), 8);
    ok("content and teaching-period filters intersect correctly; no-match state resets them");

    await page.getByRole("button", { name: "List view", exact: true }).click();
    assert.ok(await page.locator(".course-list.is-list-view").count());
    await page.reload();
    await page.locator(".course-card").first().waitFor();
    assert.equal(await page.getAttribute('[aria-label="List view"]', "aria-pressed"), "true");
    await page.getByRole("button", { name: "Grid view", exact: true }).click();
    const save = page.locator(".course-card-save").first();
    await save.click();
    assert.equal(await page.getAttribute(".course-card-save", "aria-pressed"), "true");
    assert.equal(await page.textContent("#notes-saved-count"), "1");
    assert.ok(page.url().endsWith("notes.html"));
    await page.getByRole("tab", { name: /My Study List/ }).click();
    assert.equal(await page.locator(".study-item").count(), 1);
    await page.getByRole("button", { name: /^Remove / }).click();
    assert.equal(await page.textContent("#notes-saved-count"), "0");
    ok("layout persists; course bookmarks save without navigation and can be removed from the study list");

    await page.getByRole("tab", { name: /^Courses/ }).click();
    await page.getByRole("tab", { name: /^Courses/ }).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.getAttribute("#notes-tab-concepts", "aria-selected"), "true");
    assert.equal(await page.getAttribute("#landing-content", "aria-labelledby"), "notes-tab-concepts");
    assert.ok(await page.locator(".concept-card").count());
    await page.locator(".concept-card .save-button").first().click();
    assert.equal(await page.textContent("#notes-saved-count"), "1");
    await page.keyboard.press("/");
    assert.equal(await page.evaluate(() => document.activeElement.id), "notes-search");
    await page.locator("#notes-search").fill("probability");
    await page.locator("#search-results .search-title").first().waitFor();
    assert.equal(await page.isVisible("#study-library"), false);
    assert.equal(await page.getAttribute("#search-results", "aria-busy"), "false");
    await page.keyboard.press("Escape");
    assert.ok(await page.isVisible("#study-library"));
    assert.equal(await page.getAttribute("#notes-tab-concepts", "aria-selected"), "true");
    await page.locator('[data-search="demand"]').click();
    await page.locator("#search-results .search-title").first().waitFor();
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    ok("keyboard tabs, glossary bookmarks, full-text search, topic suggestions and Escape preserve the selected library section");

    await page.locator(".notes-library-stat[data-filter=lectures]").click();
    assert.equal(await page.locator(".course-card").count(), 3);
    assert.equal(await page.getAttribute("#notes-tab-courses", "aria-selected"), "true");
    await page.goBack();
    assert.equal(await page.getAttribute("#notes-tab-concepts", "aria-selected"), "true");
    ok("interactive content totals and browser Back select the correct section");

    const storage = await page.evaluate(() => {
      const plan = loadPlan(landingData.programme);
      plan.choices = { ...plan.choices, ...Object.fromEntries(landingData.term.groups.filter(g => g.kind === "choose-one").map(g => [g.id, g.courses[0]])) };
      plan.saved = true;
      savePlan(plan);
      const topic = landingData.courses.find(c => c.topics.some(t => t.notes)).topics.find(t => t.notes);
      setTopicStatus(topic.id, "read");
      return { topic: topic.id, codes: selectedCourseCodes(landingData.term, plan.choices) };
    });
    await page.goto(base + "notes.html");
    await page.locator(".course-card").first().waitFor();
    assert.match(await page.textContent("#study-focus"), /1 of \d+ topics explored/);
    assert.match(await page.getAttribute(".notes-focus-next", "href"), new RegExp(storage.topic));
    await page.getByRole("button", { name: "My plan only", exact: true }).click();
    const codes = await page.locator(".course-card-code").allTextContents();
    assert.ok(codes.length && codes.every(c => storage.codes.includes(c)));
    ok("saved plan filters use actual course codes; existing progress changes the ring and continue-learning link");

    if (process.env.NOTES_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.NOTES_SCREENSHOT_DIR, { recursive: true });
      await page.getByRole("button", { name: "My plan only", exact: true }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForFunction(() => !document.querySelector(".site-header").classList.contains("is-compact"));
      await page.screenshot({ path: path.join(process.env.NOTES_SCREENSHOT_DIR, "notes-desktop.png"), fullPage: true });
    }
    for (const scheme of ["light", "dark"]) {
      for (const width of [320, 360, 390, 768, 1024, 1440]) {
        const responsive = await open("notes.html", { viewport: { width, height: 900 }, colorScheme: scheme });
        for (const view of ["Grid view", "List view"]) {
          await responsive.getByRole("button", { name: view, exact: true }).click();
          assert.equal(await responsive.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${width}px ${scheme} ${view}`);
        }
        if (width === 390 && process.env.NOTES_SCREENSHOT_DIR) {
          await responsive.getByRole("button", { name: "Grid view", exact: true }).click();
          await responsive.evaluate(() => window.scrollTo(0, 0));
          await responsive.waitForFunction(() => !document.querySelector(".site-header").classList.contains("is-compact"));
          await responsive.screenshot({ path: path.join(process.env.NOTES_SCREENSHOT_DIR, `notes-mobile-${scheme}.png`), fullPage: true });
        }
        await responsive.context().close();
      }
    }
    ok("both course layouts at six phone/tablet/desktop widths in light and dark: no horizontal overflow");

    const failureContext = await browser.newContext({ serviceWorkers: "block" });
    contexts.push(failureContext);
    await failureContext.route("**/content/programme.json", route => route.fulfill({ status: 503, body: "unavailable" }));
    await failureContext.route(/^https:\/\//, route => route.abort());
    const failure = await failureContext.newPage();
    await failure.goto(base + "notes.html");
    await failure.getByRole("button", { name: "Try again" }).waitFor();
    assert.equal(await failure.getAttribute("#study-focus", "aria-busy"), "false");
    assert.match(await failure.textContent("#study-focus"), /unavailable/);
    ok("data failure leaves a clear message and a working reload action");

    const searchFailure = await open();
    await searchFailure.route("**/content/modules/**/notes/*.md", route => route.fulfill({ status: 503, body: "unavailable" }));
    await searchFailure.locator("#notes-search").fill("probability");
    await searchFailure.locator("#search-results").getByText(/Search could not be loaded/).waitFor();
    assert.equal(await searchFailure.getAttribute("#search-results", "aria-busy"), "false");
    await searchFailure.getByRole("button", { name: "Clear search", exact: true }).click();
    assert.equal(await searchFailure.locator(".course-card").count(), 8);
    ok("search failures recover to the library without an unhandled promise rejection");

    const offlineContext = await browser.newContext({ serviceWorkers: "allow" });
    contexts.push(offlineContext);
    const offline = await offlineContext.newPage();
    await offline.goto(base + "notes.html");
    await offline.locator(".course-card").first().waitFor();
    await offline.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 30000 });
    assert.ok(await offline.evaluate(async () => !!(await caches.match(new URL("notes-landing.css", location.href).href))));
    await offline.reload();
    await offline.locator(".course-card").first().waitFor();
    await offline.locator('[data-course-exam="fund-health-econ-management"].has-exam').waitFor();
    await offlineContext.setOffline(true);
    await offline.reload();
    await offline.locator(".course-card").first().waitFor();
    assert.equal(await offline.locator(".course-card").count(), 8);
    assert.equal(await offline.locator(".notes-library-stat").count(), 6);
    await offline.locator('[data-course-exam="fund-health-econ-management"].has-exam').waitFor();
    assert.match(await offline.locator('[data-course-exam="fund-health-econ-management"]').textContent(), /27 Oct 2026/);
    ok("service worker caches the new stylesheet and the full library reloads offline under the Pages subdirectory");
    assert.deepEqual(errors, []);
    ok("no uncaught JavaScript errors");
    console.log(`${checks} Notes library checks passed`);
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close();
    site.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
