// Timetable and Exams: official-feed fixtures, Bologna time, filtering, calendar
// exports, keyboard access, recovery, saved plans and responsive light/dark layouts.
// Run: node tests/planning/browser.test.js .
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const NOW = "2026-10-07T08:30:00Z"; // 10:30 Bologna; 04:30 New York.
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".webmanifest": "application/manifest+json" };
let checks = 0;
const ok = text => { checks++; console.log("  ok  " + text); };

const session = (code, date, from, to, options = {}) => ({
  cod_modulo: code, title: options.title || "OFFICIAL / CLASS TITLE",
  start: `${date}T${from}:00`, end: `${date}T${to}:00`, time: `${from} - ${to}`,
  aule: options.room === false ? [] : [{ des_edificio: options.room || "LAB 2", des_indirizzo: "Via Zamboni 34, Bologna" }],
  docente: options.teacher || "Sara Capacci", teledidattica: !!options.online, note: options.note || "",
});
const TIMETABLE = [
  session("96500", "2026-10-07", "08:00", "09:00", { note: "Ended morning session" }),
  session("96498", "2026-10-07", "10:00", "12:00", { note: "Bring the exercise workbook" }),
  session("79060", "2026-10-07", "10:00", "11:00", { teacher: "Daniele Fabbri", room: "Aula 4" }),
  session("74948", "2026-10-07", "14:00", "16:00", { teacher: "Martin Forster", room: false, online: true, note: "Join via Virtuale" }),
  session("UNLISTED", "2026-10-08", "11:00", "12:00", { title: "SPECIAL / UNKNOWN CLINICAL WORKSHOP", room: false }),
  session("96498", "2026-10-09", "09:00", "11:00"),
  session("C8393", "2026-10-10", "10:00", "12:00", { teacher: "Rossella Verzulli", room: "Weekend classroom" }),
];
const formatSourceDate = (key, time = "") => new Date(key + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) + (time ? ` at ${time}` : "");
const exam = (id, code, component, date, time, opens, closes, place, teacher = "Sara Capacci") => `<h3 role="tab" aria-controls="${id}"><a><span class="code">${code}</span> Official course title <span class="docente">${teacher}</span></a></h3><div id="${id}"><table class="single-item">
  <tr><th>When</th><td>${formatSourceDate(date, time)}</td></tr>
  ${component ? `<tr><th>Componente:</th><td>${component} - MODULE</td></tr>` : ""}
  ${opens && closes ? `<tr><th>Subscriptions list:</th><td><span>${formatSourceDate(opens)}</span><span>${formatSourceDate(closes)}</span></td></tr>` : ""}
  <tr><th>Test type:</th><td>scritto</td></tr><tr><th>Place:</th><td>${place}</td></tr>
  </table></div>`;
const EXAMS = [
  exam("already-started", "96496", "96498", "2026-10-07", "09:00", "2026-10-01", "2026-10-07", "Past morning room"),
  exam("today", "96496", "96498", "2026-10-07", "15:00", "2026-10-01", "2026-10-07", "LAB 2"),
  exam("tomorrow", "97177", "79060", "2026-10-08", "09:00", "2026-09-30", "2026-10-08", "Aula 4", "Daniele Fabbri"),
  exam("soon", "96500", "", "2026-10-15", "09:00", "2026-10-10", "2026-10-14", "Law room", "Markus Frischhut"),
  exam("closed", "96525", "74948", "2026-10-16", "10:00", "2026-09-15", "2026-10-01", "Statistics room", "Martin Forster"),
  exam("unknown", "C8393", "", "2026-10-17", "11:00", "", "", "Health systems room", "Rossella Verzulli"),
  exam("econometrics", "96525", "32626", "2026-10-18", "09:00", "2026-10-01", "2026-10-10", "Econometrics room", "Elisabetta De Cao"),
  exam("integrated", "96496", "", "2026-10-19", "14:00", "2026-10-01", "2026-10-18", "Integrated course room"),
].join("\n");
const PLAN = JSON.stringify({ version: 1, cohort: "2026-27", term: "y1-s1", choices: { quant: "96496", elective: "C8393" }, statuses: {}, savedAt: "2026-10-01T10:00:00Z" });

(async () => {
  const server = http.createServer((request, response) => {
    const name = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/eu-hem-student-hub\//, "");
    const file = path.resolve(ROOT, name || "index.html");
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); return response.end("missing"); }
    response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    response.end(fs.readFileSync(file));
  }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/eu-hem-student-hub/`;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const contexts = [], errors = [];
  const open = async (url, options = {}) => {
    const { storage = {}, storageBlocked = false, clocked = false, timetable = TIMETABLE, examHtml = EXAMS, failure = null, now = NOW, ...contextOptions } = options;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light", timezoneId: "America/New_York", reducedMotion: "reduce", serviceWorkers: "block", acceptDownloads: true, ...contextOptions });
    contexts.push(context);
    if (clocked) {
      await context.clock.install({ time: new Date(now) });
      await context.clock.pauseAt(new Date(now));
    } else await context.clock.setFixedTime(new Date(now));
    if (storageBlocked) await context.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } }));
    if (Object.keys(storage).length) await context.addInitScript(items => { for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value); }, storage);
    let failed = false;
    await context.route(/^https?:\/\//, route => {
      const address = new URL(route.request().url());
      if (failure === "programme" && !failed && address.hostname === "127.0.0.1" && address.pathname.endsWith("/content/programme.json")) {
        failed = true;
        return route.fulfill({ status: 503, body: "unavailable" });
      }
      const feed = address.hostname === "corsi.unibo.it" && address.pathname.includes("@@orario_reale_json");
      const dates = address.hostname === "corsi.unibo.it" && address.pathname.endsWith("/exam-dates");
      if (feed || dates) {
        if (!failed && failure === (feed ? "timetable" : "exams")) { failed = true; return route.fulfill({ status: 503, body: "unavailable" }); }
        return route.fulfill({ contentType: feed ? "application/json" : "text/html", body: feed ? JSON.stringify(timetable) : examHtml });
      }
      return address.hostname === "127.0.0.1" ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(`${url}: ${error.message}`));
    await page.goto(base + url);
    return page;
  };
  const waitTimetable = page => page.locator("#schedule-list .week-block, #schedule-list .agenda-item, #schedule-list .planning-empty").first().waitFor();
  const waitExams = page => page.locator("#exam-list .exam-card, #exam-list .planning-empty").first().waitFor();
  const countExams = async (page, expected) => assert.strictEqual(await page.locator("#exam-list .exam-card").count(), expected);
  const exportedCalendar = async (page, button) => {
    const downloading = page.waitForEvent("download");
    await button.click();
    const download = await downloading;
    assert.match(download.suggestedFilename(), /\.ics$/);
    return fs.readFileSync(await download.path(), "utf8");
  };
  try {
    let page = await open("timetable.html");
    await waitTimetable(page);
    assert.strictEqual(await page.locator("h1").count(), 1);
    assert.strictEqual(await page.locator("#timetable-summary .planning-stat").count(), 3);
    assert.match(await page.textContent("#now-next"), /now|in progress/i);
    assert.match(await page.textContent("#now-next"), /Fundamentals of Statistics for Healthcare/);
    assert.match(await page.textContent("main"), /Bologna|Europe\/Rome/);
    assert.ok(await page.locator(".week-now").count(), "Bologna-time current line is shown, despite a New York browser timezone");
    const blocks = page.locator(".week-block");
    assert.strictEqual(await blocks.count(), 7, "week view keeps past and weekend classes");
    assert.match(await page.textContent("#schedule-list"), /Health Systems/);
    assert.ok((await page.locator(".week-day").count()) >= 6, "Saturday is included when the feed contains a Saturday class");
    const statBox = await blocks.filter({ hasText: "Fundamentals of Statistics for Healthcare" }).first().boundingBox();
    const healthBox = await blocks.filter({ hasText: "Fundamentals in Health Economics" }).first().boundingBox();
    assert.ok(statBox.x + statBox.width <= healthBox.x + 1 || healthBox.x + healthBox.width <= statBox.x + 1, "overlapping classes have separate visible lanes");
    ok("official timetable keeps weekend and overlapping classes; Now/Next and the current line use Bologna time");

    const opener = blocks.filter({ hasText: "Fundamentals of Statistics for Healthcare" }).first();
    await opener.focus(); await page.keyboard.press("Enter");
    const dialog = page.locator("#session-dialog");
    await dialog.waitFor({ state: "visible" });
    assert.ok(await dialog.getAttribute("aria-labelledby"), "dialog has an accessible title");
    assert.match(await dialog.textContent(), /Sara Capacci.*Bring the exercise workbook/s);
    assert.match(await dialog.getByRole("link", { name: /^Map:/ }).getAttribute("href"), /maps|google/);
    const classIcs = await exportedCalendar(page, dialog.getByRole("button", { name: /^Add to calendar:/ }));
    assert.match(classIcs, /DTSTART;TZID=Europe\/Rome:20261007T100000/);
    assert.match(classIcs, /Bring the exercise workbook/);
    await page.keyboard.press("Escape");
    assert.strictEqual(await dialog.isVisible(), false);
    assert.strictEqual(await opener.evaluate(element => element === document.activeElement), true, "Escape returns focus to the opened class");
    ok("class details preserve teacher, notes and map; calendar export has Europe/Rome; Escape restores focus");

    await page.getByRole("button", { name: "List", exact: true }).click();
    assert.match(await page.evaluate(() => document.activeElement.textContent), /List/);
    assert.strictEqual(await page.locator(".agenda-item").count(), 6, "ended classes today are hidden from the upcoming list");
    assert.doesNotMatch(await page.textContent("#schedule-list"), /Ended morning session/);
    assert.match(await page.textContent("#schedule-list"), /Unknown Clinical Workshop|Unknown clinical workshop/);
    const online = page.locator(".agenda-item").filter({ hasText: /^.*Statistics for Healthcare/ }).filter({ hasText: "Join via Virtuale" });
    assert.match(await online.textContent(), /Online/);
    assert.strictEqual(await online.getByRole("link", { name: /^Map:/ }).count(), 0, "online sessions without a room do not invent a map");
    await page.locator("#show-past").check();
    assert.strictEqual(await page.locator(".agenda-item").count(), 7);
    await page.locator("#show-past").uncheck();
    await page.reload(); await waitTimetable(page);
    assert.strictEqual(await page.getByRole("button", { name: "List", exact: true }).getAttribute("aria-pressed"), "true");
    ok("agenda excludes classes that ended today, keeps active/online/unknown-module classes, and remembers the chosen view");

    await page.locator("#course-filter").selectOption("fund-quant-methods");
    assert.strictEqual(await page.locator(".agenda-item").count(), 2);
    await page.locator("#timetable-search").fill("exercise workbook");
    assert.strictEqual(await page.locator(".agenda-item").count(), 1, "search includes class notes");
    await page.locator("#timetable-search").fill("no matching class anywhere");
    await page.locator("#schedule-list .planning-empty").waitFor();
    await page.locator("#timetable-reset").click();
    assert.strictEqual(await page.locator("#course-filter").inputValue(), "");
    assert.strictEqual(await page.locator("#timetable-search").inputValue(), "");
    assert.strictEqual(await page.locator(".agenda-item").count(), 6);
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await page.getByRole("button", { name: "Next week", exact: true }).click();
    await page.locator("#schedule-list .planning-empty").waitFor();
    assert.strictEqual(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Next week", "week navigation preserves keyboard focus after rendering");
    await page.getByRole("button", { name: "Previous week", exact: true }).click();
    assert.strictEqual(await page.locator(".week-block").count(), 7);
    await page.locator("#week-picker").fill("2026-11-02");
    await page.locator("#schedule-list .planning-empty").waitFor();
    await page.getByRole("button", { name: "This week", exact: true }).click();
    assert.strictEqual(await page.locator(".week-block").count(), 7);
    ok("course and note search combine, reset recovers an empty filter, and week navigation/date picker return to this week");
    await page.context().close();

    page = await open("exams.html"); await waitExams(page);
    assert.strictEqual(await page.locator("h1").count(), 1);
    assert.strictEqual(await page.locator("#exam-summary .planning-stat").count(), 3);
    await countExams(page, 7);
    assert.doesNotMatch(await page.textContent("#exam-list"), /Past morning room/);
    const metricValues = await page.locator("#exam-summary .planning-stat-value").allTextContents();
    assert.match(metricValues[0], /^7$/); assert.match(metricValues[1], /^4$/);
    const today = page.locator(".exam-card").filter({ hasText: "LAB 2" });
    assert.match(await today.textContent(), /Today/);
    assert.match(await today.textContent(), /closes today|Closes today/i);
    const tomorrow = page.locator(".exam-card").filter({ hasText: "Aula 4" });
    assert.match(await tomorrow.textContent(), /Tomorrow/);
    assert.match(await tomorrow.textContent(), /Fundamentals in Health Economics/);
    assert.match(await tomorrow.textContent(), /\(I\.C\.\)/);
    assert.match(await page.textContent("#open-registrations"), /Fundamentals of Statistics for Healthcare/);
    assert.strictEqual(await page.locator('a[href="https://almaesami.unibo.it/almaesami/welcome.htm"]').count() > 0, true);
    const examIcs = await exportedCalendar(page, today.getByRole("button", { name: /^Add exam:/ }));
    assert.match(examIcs, /DTSTART;TZID=Europe\/Rome:20261007T150000/);
    assert.match(examIcs, /End time is an estimate/);
    const reminderIcs = await exportedCalendar(page, today.getByRole("button", { name: /^Registration reminder:/ }));
    assert.match(reminderIcs, /DTSTART;VALUE=DATE:20261007/);
    assert.match(reminderIcs, /DTEND;VALUE=DATE:20261008/);
    ok("exams exclude already-started sittings in Bologna time; integrated modules, deadlines, maps and two calendar exports stay accurate");

    for (const [value, count, expected] of [["open", 4, /Registration open|Closes today/i], ["soon", 1, /opens/i], ["closed", 1, /Registration closed/i], ["unknown", 1, /not published|not available|unavailable|check AlmaEsami/i]]) {
      await page.locator("#exam-registration-filter").selectOption(value);
      await countExams(page, count);
      assert.match(await page.textContent("#exam-list"), expected);
      assert.match((await page.locator("#exam-summary .planning-stat-value").allTextContents())[0], new RegExp(`^${count}$`));
    }
    await page.locator("#exam-reset").click();
    await page.locator("#exam-search").fill("daniele");
    await countExams(page, 1);
    assert.match(await page.textContent("#exam-list"), /Aula 4/);
    await page.locator("#exam-course-filter").selectOption("fund-quant-methods");
    await page.locator("#exam-list .planning-empty").waitFor();
    await page.locator("#exam-reset").click();
    await countExams(page, 7);
    assert.strictEqual(await page.locator("#exam-registration-filter").inputValue(), "");
    assert.strictEqual(await page.locator("#exam-search").inputValue(), "");
    await page.locator("#exam-course-filter").selectOption("fund-quant-methods");
    await countExams(page, 2);
    assert.match(await page.textContent("#exam-list"), /Integrated course room/);
    ok("registration filters cover open/future/closed/unknown; search finds teachers, course matching includes integrated parent codes, metrics follow filters");
    await page.context().close();

    page = await open("exams.html", { examHtml: exam("missing-details", "C8393", "", "2026-10-07", "", "", "", "") });
    await waitExams(page); await countExams(page, 1);
    const missingDetails = page.locator(".exam-card");
    assert.match(await missingDetails.textContent(), /Time not listed/);
    assert.match(await missingDetails.textContent(), /Room not listed/);
    assert.strictEqual(await missingDetails.getByRole("link", { name: /^Map:/ }).count(), 0);
    const incompleteIcs = await exportedCalendar(page, missingDetails.getByRole("button", { name: /^Add exam:/ }));
    assert.match(incompleteIcs, /Start time is a placeholder \(09:00\)/);
    assert.match(incompleteIcs, /confirm the time on UniBo/);
    await page.context().close();
    ok("an exam without a published time or room remains visible, avoids an invented map and labels the calendar start as a placeholder");

    for (const [url, selector, expectedMine, expectedAll] of [["timetable.html", ".agenda-item", 4, 6], ["exams.html", ".exam-card", 5, 7]]) {
      page = await open(url, { storage: { "euhem-study-plan-v1": PLAN, "euhem-timetable-view": JSON.stringify("list") } });
      if (url === "timetable.html") await waitTimetable(page); else await waitExams(page);
      const switchInput = page.locator(".my-courses-switch input");
      assert.strictEqual(await switchInput.isChecked(), true);
      assert.strictEqual(await page.locator(selector).count(), expectedMine);
      await switchInput.uncheck();
      assert.strictEqual(await page.locator(selector).count(), expectedAll);
      await page.reload();
      if (url === "timetable.html") await waitTimetable(page); else await waitExams(page);
      assert.strictEqual(await page.locator(".my-courses-switch input").isChecked(), false);
      assert.strictEqual(await page.locator(selector).count(), expectedAll);
      await page.context().close();
    }
    ok("saved plans include required courses and chosen modules/parent courses; My courses only can be changed and persists");

    page = await open("exams.html", { now: "2026-10-07T22:30:00Z" }); // Thursday in Bologna, Wednesday in New York.
    await waitExams(page); await countExams(page, 6);
    assert.match(await page.locator(".exam-card").filter({ hasText: "Aula 4" }).textContent(), /Today/);
    assert.doesNotMatch(await page.textContent("#exam-list"), /LAB 2/);
    await page.goto(base + "timetable.html"); await waitTimetable(page);
    await page.getByRole("button", { name: "List", exact: true }).click();
    assert.strictEqual(await page.locator(".agenda-item").count(), 3);
    assert.doesNotMatch(await page.textContent("#schedule-list"), /Join via Virtuale|Bring the exercise workbook/);
    await page.context().close();
    ok("Bologna date rollover works even while the browser is still on the previous calendar day");

    page = await open("exams.html", { clocked: true }); await waitExams(page);
    const calendarAction = page.locator(".exam-card").filter({ hasText: "LAB 2" }).getByRole("button", { name: /^Add exam:/ });
    await calendarAction.focus();
    await calendarAction.evaluate(element => { window.__planningFocusedAction = element; });
    await page.clock.fastForward(60 * 1000);
    assert.strictEqual(await page.evaluate(() => window.__planningFocusedAction.isConnected && document.activeElement === window.__planningFocusedAction), true, "an unchanged refresh keeps the focused calendar action");
    await page.clock.fastForward(14 * 60 * 60 * 1000); // Next day at 00:31 Bologna.
    await countExams(page, 7);
    assert.strictEqual(await page.evaluate(() => window.__planningFocusedAction.isConnected && document.activeElement === window.__planningFocusedAction), true, "a day change is deferred while an exam action is focused");
    await page.locator("#exam-search").focus();
    await page.clock.runFor(1);
    await countExams(page, 6);
    assert.match(await page.locator(".exam-card").filter({ hasText: "Aula 4" }).textContent(), /Today/);
    assert.doesNotMatch(await page.textContent("#exam-list"), /LAB 2/);
    await page.context().close();
    ok("automatic refresh keeps focused calendar actions intact and applies a deferred midnight update after focus leaves");

    for (const url of ["timetable.html", "exams.html"]) {
      page = await open(url, { storageBlocked: true });
      if (url === "timetable.html") {
        await waitTimetable(page);
        await page.getByRole("button", { name: "List", exact: true }).click();
        assert.strictEqual(await page.locator(".agenda-item").count(), 6);
        await page.locator("#course-filter").selectOption("fund-quant-methods");
        assert.strictEqual(await page.locator(".agenda-item").count(), 2);
      } else {
        await waitExams(page);
        await page.locator("#exam-search").fill("daniele");
        await countExams(page, 1);
      }
      await page.context().close();
    }
    ok("blocked local storage still permits both planners to load, switch views and filter without errors");

    for (const [url, feed, wait, countSelector] of [["timetable.html", "timetable", waitTimetable, ".week-block"], ["exams.html", "exams", waitExams, ".exam-card"]]) {
      for (const failure of [feed, "programme"]) {
        page = await open(url, { failure });
        await page.locator(".planning-empty").getByRole("button", { name: "Retry", exact: true }).waitFor();
        assert.match(await page.textContent(".planning-empty"), /UniBo|official|unavailable|load/i);
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await wait(page);
        assert.ok(await page.locator(countSelector).count() > 0, `${url} recovers from a failed ${failure} request without reloading the page`);
        await page.context().close();
      }
      page = await open(url, { timetable: [], examHtml: "<p>No scheduled exams</p>" });
      await wait(page);
      assert.match(await page.textContent(".planning-empty"), /no|not|check/i);
      assert.strictEqual(await page.locator(countSelector).count(), 0);
      await page.context().close();
    }
    ok("both official feeds and a failed programme request recover through Retry; empty feeds show an honest empty state");

    for (const width of [360, 768, 1440]) for (const colorScheme of ["light", "dark"]) for (const url of ["timetable.html", "exams.html"]) {
      page = await open(url, { viewport: { width, height: 900 }, colorScheme });
      if (url === "timetable.html") {
        await waitTimetable(page);
        for (const view of ["Week", "List"]) {
          await page.getByRole("button", { name: view, exact: true }).click();
          assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${url} ${view}, ${width}px ${colorScheme}: page horizontal overflow`);
        }
      } else {
        await waitExams(page);
        assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${url}, ${width}px ${colorScheme}: page horizontal overflow`);
      }
      if (process.env.PLANNING_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.PLANNING_SCREENSHOT_DIR, { recursive: true });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(() => !document.querySelector(".site-header").classList.contains("is-compact"));
        await page.screenshot({ path: path.join(process.env.PLANNING_SCREENSHOT_DIR, `${url.replace(".html", "")}-${width}-${colorScheme}.png`), fullPage: true });
        if (width === 360 && colorScheme === "light") await page.screenshot({ path: path.join(process.env.PLANNING_SCREENSHOT_DIR, `${url.replace(".html", "")}-360-light-viewport.png`) });
        if (url === "timetable.html" && width === 1440) {
          await page.getByRole("button", { name: "Week", exact: true }).click();
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForFunction(() => !document.querySelector(".site-header").classList.contains("is-compact"));
          await page.screenshot({ path: path.join(process.env.PLANNING_SCREENSHOT_DIR, `timetable-week-1440-${colorScheme}.png`), fullPage: true });
          await page.screenshot({ path: path.join(process.env.PLANNING_SCREENSHOT_DIR, `timetable-week-1440-${colorScheme}-viewport.png`) });
        }
      }
      await page.context().close();
    }
    ok("timetable Week/List and Exams fit 360/768/1440 px in light and dark without page-level horizontal overflow");
    assert.deepStrictEqual(errors, [], "uncaught page errors");
    ok("no uncaught JavaScript errors");
    console.log(`${checks} planning-page checks passed`);
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close(); server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
