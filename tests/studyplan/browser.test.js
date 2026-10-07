// Four-semester study planning in Chromium: choices, source limits, persistence,
// keyboard operation, export/import and responsive light/dark layouts.
// Run: node tests/studyplan/browser.test.js .
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".webmanifest": "application/manifest+json", ".ics": "text/calendar" };
const PLAN_KEY = "euhem-study-plan-v1", TRACK_KEY = "euhem-track-v1", DRAFT_KEY = "euhem-study-journey-v1";
const SAVED_PLAN = { version: 1, cohort: "2026-27", term: "y1-s1", choices: { quant: "96496", elective: "C8393", crash: [] }, statuses: { "97177": "passed" }, savedAt: "2026-10-01T10:00:00Z" };
let checks = 0;
const ok = name => { checks++; console.log("  ok  " + name); };

(async () => {
  const server = http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/eu-hem-student-hub\//, "");
    const file = path.resolve(ROOT, relative || "index.html");
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); return response.end("missing"); }
    response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    response.end(fs.readFileSync(file));
  }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/eu-hem-student-hub/`;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const contexts = [], errors = [];
  const open = async (options = {}) => {
    const { storage = {}, storageBlocked = false, failure = "", ...contextOptions } = options;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block", acceptDownloads: true, ...contextOptions });
    contexts.push(context);
    await context.clock.setFixedTime(new Date("2026-10-07T08:30:00Z"));
    if (storageBlocked) await context.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } }));
    if (Object.keys(storage).length) await context.addInitScript(items => { for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value); }, storage);
    let failed = false;
    await context.route(/^https?:\/\//, route => {
      const address = new URL(route.request().url());
      if (!failed && failure && address.pathname.endsWith(failure)) { failed = true; return route.fulfill({ status: 503, body: "unavailable" }); }
      return address.hostname === "127.0.0.1" ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "studyplan.html");
    await page.locator('#plan-content:not([aria-busy="true"])').waitFor();
    if (failure !== "content/tracks.json" && failure !== "content/programme.json") await page.locator('#sp-track-options button[data-track="ep"]').waitFor();
    if (failure === "content/tracks.json") await page.getByRole("button", { name: "Reload track data", exact: true }).waitFor();
    return page;
  };
  const text = async (page, selector) => (await page.textContent(selector) || "").replace(/\s+/g, " ").trim();
  const semester = (page, number) => page.locator(`#plan-terms button[data-semester="${number}"]`).click();
  const choose = page => page.locator('#plan-views button[data-view="choose"]').click();
  const mine = page => page.locator('#plan-views button[data-view="mine"]').click();
  const track = (page, id) => page.locator(`#sp-track-options button[data-track="${id}"]`).click();
  const stored = (page, key) => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const option = (page, id, number, group, index) => page.locator(`#future-${id}-s${number}-${group}-${index}`);
  try {
    let page = await open();
    assert.strictEqual(await page.locator("body.study-plan-page").count(), 1);
    assert.strictEqual(await page.locator("h1:visible").count(), 1);
    assert.strictEqual(await page.locator('#plan-terms[role="tablist"] button[role="tab"]').count(), 4);
    assert.strictEqual(await page.locator('#plan-terms button[aria-selected="true"]').getAttribute("data-semester"), "1");
    for (const id of ["eeh", "ep", "mhi", "phm"]) assert.strictEqual(await page.locator(`#sp-track-options button[data-track="${id}"]`).count(), 1);
    assert.match(await text(page, ".plan-notice"), /does not.*submit|not.*submit|official submission is a separate step/i);
    assert.strictEqual(await page.locator("#plan-submit").getAttribute("href"), "https://studenti.unibo.it");
    assert.match(await text(page, "#plan-deadline"), /no deadline|none/i);
    assert.strictEqual(await page.locator('#group-core .plan-lock[aria-label="Required course, always selected"]').count(), 2);
    assert.strictEqual(await page.locator("#group-core input").count(), 0, "required courses have an accessible lock instead of a changeable input");
    await track(page, "ep");
    assert.strictEqual(await page.locator("#pick-96496").isChecked(), false);
    assert.strictEqual(await page.locator("#pick-96525").isChecked(), false);
    assert.strictEqual(await stored(page, PLAN_KEY), null, "track choice does not automatically assign courses or save an S1 plan");
    assert.ok(await stored(page, TRACK_KEY), "track preference is stored using the shared track key");
    ok("the common semester keeps required locks, four real semester tabs, the official submission notice and no automatic course assignment");

    await page.locator("#pick-96496").check();
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "pick-96496", "course selection restores focus after rendering");
    await page.locator("#pick-C8393").check();
    assert.match(await text(page, "#plan-summary"), /30/);
    await page.locator("#pick-B1076").check();
    const plan = await stored(page, PLAN_KEY);
    assert.strictEqual(plan.cohort, "2026-27");
    assert.strictEqual(plan.term, "y1-s1");
    assert.deepStrictEqual(plan.choices, { crash: ["B1076"], quant: "96496", elective: "C8393" });
    assert.match(await text(page, "#plan-summary"), /30/);
    assert.match(await text(page, "#plan-summary"), /3/);
    await mine(page);
    assert.strictEqual(await page.locator('#plan-views button[data-view="mine"]').getAttribute("aria-pressed"), "true");
    const health = page.locator(".plan-course").filter({ hasText: "Fundamental in Health Economics and Management" });
    await health.locator("select").selectOption("passed");
    assert.strictEqual((await stored(page, PLAN_KEY)).statuses["97177"], "passed");
    const calendar = page.locator("#plan-content .plan-calendar-url");
    assert.strictEqual(await calendar.count(), 1, "a complete S1 plan retains its exact calendar subscription");
    assert.match(await calendar.inputValue(), /B1076-96496-C8393\.ics$/);
    assert.ok((await page.evaluate(() => myModuleCodes(planPage.programme))).includes("96498"));
    await page.reload();
    await page.locator('#plan-content:not([aria-busy="true"])').waitFor();
    assert.strictEqual((await stored(page, PLAN_KEY)).statuses["97177"], "passed");
    ok("S1 choices and status persist in the legacy key, optional CFU stay separate, exact-plan calendar and timetable module matching remain compatible");

    await choose(page);
    assert.ok(await page.locator(".sp-fit").count(), "course advice exposes track connections");
    await page.locator("#advice-elective > summary").click();
    assert.strictEqual(await page.locator('#advice-elective .sp-fit[data-track="ep"]').first().isVisible(), true);
    assert.ok(await page.locator("#advice-elective .sp-advice-sources a").count(), "authored guidance retains its named source links");
    assert.match(await text(page, "#plan-content"), /authored|interpretation|not.*official recommendation/i);
    const electiveAdvice = page.locator(".plan-course").filter({ hasText: "Health Systems" });
    assert.ok(await electiveAdvice.locator('a[href^="https://"]').count(), "advice retains external source links");
    await semester(page, 2);
    assert.match(await text(page, "#sp-semester-heading"), /Semester 2|Oslo/i);
    assert.match(await text(page, "#plan-content"), /Applied Micro Econometrics/);
    await option(page, "ep", 2, 0, 3).check();
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "future-ep-s2-0-3");
    await mine(page);
    assert.match(await text(page, "#plan-content"), /Fundamentals in Data Management and Statistics/);
    assert.match(await text(page, "#plan-content"), /Infection Epidemiology/);
    let draft = await stored(page, DRAFT_KEY);
    assert.deepStrictEqual(draft.tracks.ep.choices["s2-choice-0"], [3]);
    await choose(page); await semester(page, 3);
    const pharma = page.locator('.sp-future-course[data-course="unibo-pharma-markets"]');
    assert.match(await pharma.textContent(), /10 ECTS/);
    assert.match(await pharma.getByRole("link", { name: "2026/27 credit source", exact: true }).getAttribute("href"), /course-structure-diagram\/piano\/2026/);
    assert.strictEqual(await option(page, "ep", 3, 1, 1).isDisabled(), true);
    assert.match(await text(page, "#plan-content"), /already.*Semester 1/i);
    await option(page, "ep", 3, 1, 2).check();
    await option(page, "ep", 3, 1, 3).check();
    assert.strictEqual(await option(page, "ep", 3, 1, 4).isDisabled(), true);
    draft = await stored(page, DRAFT_KEY);
    assert.deepStrictEqual(draft.tracks.ep.choices["s3-choice-1"], [2, 3]);
    await track(page, "phm"); await semester(page, 2);
    assert.match(await text(page, "#plan-content"), /Analysis and Epidemiology/);
    await option(page, "phm", 2, 0, 1).check();
    await option(page, "phm", 2, 1, 0).check();
    await track(page, "ep"); await semester(page, 2);
    assert.strictEqual(await option(page, "ep", 2, 0, 3).isChecked(), true);
    assert.deepStrictEqual((await stored(page, DRAFT_KEY)).tracks.phm.choices["s2-choice-1"], [0]);
    assert.deepStrictEqual((await stored(page, PLAN_KEY)).choices, plan.choices, "future preferences do not replace today's S1 plan");
    ok("authored track-fit advice and sources support selection; E&P bundles and repeat restrictions work; PHM choices stay independent when switching tracks");

    await track(page, "eeh"); await semester(page, 3);
    await option(page, "eeh", 3, 0, 0).check();
    assert.strictEqual(await option(page, "eeh", 3, 0, 4).isDisabled(), true);
    await option(page, "eeh", 3, 0, 1).check();
    assert.match(await text(page, "#plan-content"), /10/);
    await option(page, "eeh", 3, 0, 2).check();
    assert.match(await text(page, "#plan-content"), /not all published|unknown|not listed|not stated|confirm/i);
    assert.doesNotMatch(await text(page, "#plan-summary"), /semester complete|study plan complete/i);
    await track(page, "mhi"); await semester(page, 2);
    await option(page, "mhi", 2, 0, 0).check();
    await option(page, "mhi", 2, 0, 1).check();
    assert.match(await text(page, "#plan-content"), /not specified|not stated|confirm.*rule/i);
    assert.doesNotMatch(await text(page, "#plan-summary"), /semester complete|study plan complete/i);
    ok("known-credit overshoots are disabled; unpublished credits and MHI's unstated rule never claim an officially complete semester");

    await semester(page, 4);
    assert.match(await text(page, "#plan-content"), /thesis/i);
    assert.deepStrictEqual((await page.locator('input[name="thesis-university"]').evaluateAll(inputs => inputs.map(input => input.value))).sort(), ["mci", "uio"]);
    await page.locator('input[name="thesis-university"][value="uio"]').check();
    await page.locator("#sp-thesis-status").selectOption("researching");
    const untrusted = "<img src=x onerror=alert(1)> policy evidence";
    await page.locator("#sp-thesis-topic").fill(untrusted);
    await page.locator("#sp-thesis-topic").blur();
    assert.strictEqual((await stored(page, DRAFT_KEY)).tracks.mhi.thesisTopic, untrusted);
    assert.strictEqual(await page.locator('img[src="x"]').count(), 0);
    await page.reload(); await page.locator('#plan-content:not([aria-busy="true"])').waitFor();
    await semester(page, 4);
    assert.strictEqual(await page.locator("#sp-thesis-topic").inputValue(), untrusted);
    assert.strictEqual(await page.locator("#sp-thesis-status").inputValue(), "researching");
    assert.strictEqual(await page.locator('input[name="thesis-university"][value="uio"]').isChecked(), true);
    ok("thesis hosts follow the chosen track, research status/topic persist, and typed HTML stays inert text");

    await page.locator('#plan-terms button[data-semester="1"]').focus();
    await page.keyboard.press("ArrowRight");
    assert.strictEqual(await page.locator('#plan-terms button[aria-selected="true"]').getAttribute("data-semester"), "2");
    assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.semester), "2");
    await page.keyboard.press("End");
    assert.strictEqual(await page.locator('#plan-terms button[aria-selected="true"]').getAttribute("data-semester"), "4");
    await page.keyboard.press("Home");
    assert.strictEqual(await page.locator('#plan-terms button[aria-selected="true"]').getAttribute("data-semester"), "1");
    ok("semester tabs use Arrow/Home/End with synchronized selection and focus");

    await page.locator("#sp-tools-button").click();
    const tools = page.locator("#sp-tools-dialog");
    await tools.waitFor({ state: "visible" });
    assert.ok(await tools.getAttribute("aria-labelledby"), "plan tools dialog has an accessible title");
    const downloading = page.waitForEvent("download");
    await page.locator("#sp-export").click();
    const download = await downloading;
    assert.strictEqual(download.suggestedFilename(), "euhem-study-plan-2026-2028.json");
    const backupText = fs.readFileSync(await download.path(), "utf8");
    const backup = JSON.parse(backupText);
    assert.ok(backup && typeof backup === "object");
    const beforeReset = await stored(page, DRAFT_KEY);
    page.once("dialog", dialog => dialog.dismiss());
    await page.locator("#plan-reset").click();
    assert.deepStrictEqual(await stored(page, DRAFT_KEY), beforeReset, "cancelled reset keeps the complete draft");
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#plan-reset").click();
    assert.strictEqual(await tools.isVisible(), false);
    const resetPlan = await stored(page, PLAN_KEY);
    assert.ok(!resetPlan || !resetPlan.choices.quant);
    assert.strictEqual((await stored(page, TRACK_KEY)).track, "mhi", "reset keeps the selected track preference");
    await page.locator("#sp-tools-button").click();
    await page.locator("#sp-import").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(backupText) });
    await page.waitForFunction(key => !!JSON.parse(localStorage.getItem(key))?.choices?.quant, PLAN_KEY);
    assert.deepStrictEqual((await stored(page, PLAN_KEY)).choices, plan.choices);
    assert.strictEqual((await stored(page, PLAN_KEY)).statuses["97177"], "passed");
    assert.deepStrictEqual(await stored(page, DRAFT_KEY), beforeReset);
    const beforeInvalid = await stored(page, DRAFT_KEY);
    if (!(await tools.isVisible())) await page.locator("#sp-tools-button").click();
    await page.locator("#sp-import").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{ definitely not valid JSON") });
    await page.waitForFunction(() => /invalid|could not|cannot|not.*valid|not.*backup|unrecognised|unrecognized/i.test(document.getElementById("sp-import-status")?.textContent || ""));
    assert.match(await text(page, "#sp-import-status"), /invalid|could not|cannot|not.*valid|not.*backup|unrecognised|unrecognized/i);
    assert.deepStrictEqual(await stored(page, DRAFT_KEY), beforeInvalid, "an invalid backup leaves the current plan intact");
    await page.keyboard.press("Escape");
    assert.strictEqual(await tools.isVisible(), false);
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "sp-tools-button");
    ok("backup downloads and restores S1, all future drafts and statuses; reset is cancellable and preserves track; invalid JSON cannot overwrite a plan; dialog restores focus");

    await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
    await page.locator("#sp-print").click();
    assert.strictEqual(await page.evaluate(() => window.__printed), true);
    const printText = await text(page, "#sp-print-summary");
    for (const number of [1, 2, 3, 4]) assert.match(printText, new RegExp(`Semester ${number}`, "i"));
    assert.match(printText, /Fundamentals of Quantitative Methods|Fundamentals in Health Economics/);
    assert.match(printText, /Leadership|Management/);
    await page.emulateMedia({ media: "print" });
    assert.strictEqual(await page.locator("#sp-print-summary").isVisible(), true);
    await page.emulateMedia({ media: "screen" });
    ok("Print/PDF generates a complete four-semester summary and a readable print layout");
    await page.context().close();

    page = await open({ failure: "content/tracks.json" });
    await choose(page);
    assert.ok(await page.locator("#pick-96496").count(), "S1 choices survive a failed future-curriculum request");
    assert.match(await text(page, "#sp-track-status"), /unavailable|could not|not.*load|failed|reload/i);
    await page.getByRole("button", { name: "Reload track data", exact: true }).click();
    await page.locator('#sp-track-options button[data-track="ep"]').waitFor();
    await track(page, "ep"); await semester(page, 2);
    assert.match(await text(page, "#plan-content"), /Applied Micro Econometrics/);
    await page.context().close();
    page = await open({ failure: "content/study-advice.json" });
    await choose(page);
    assert.match(await text(page, "#plan-content"), /guidance is unavailable|guidance.*unavailable/i);
    await page.locator("#pick-96496").check();
    await page.locator("#pick-70125").check();
    assert.strictEqual((await stored(page, PLAN_KEY)).choices.elective, "70125");
    await page.context().close();
    ok("a failed track feed leaves S1 usable and can reload; unavailable advice falls back to official outcomes without blocking choices");

    page = await open({ failure: "content/programme.json" });
    assert.match(await text(page, "#plan-content"), /could not|unavailable|not.*load|try again/i);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.locator("#pick-96496").waitFor();
    assert.strictEqual(await page.locator('#plan-terms button[role="tab"]').count(), 4);
    await page.locator("#pick-96496").check();
    assert.strictEqual((await stored(page, PLAN_KEY)).choices.quant, "96496");
    await page.context().close();
    ok("an unavailable main curriculum shows a retry action that recovers real course choices");

    page = await open({ storageBlocked: true, viewport: { width: 360, height: 900 } });
    await choose(page); await track(page, "ep");
    await page.locator("#pick-96496").check();
    await page.locator("#pick-70125").check();
    await semester(page, 2);
    await option(page, "ep", 2, 0, 0).check();
    assert.match(await text(page, "#sp-save-state"), /tab|unavailable|not saved|storage/i);
    await semester(page, 1); await mine(page);
    assert.match(await text(page, "#plan-content"), /International Law and Health/);
    await page.context().close();
    ok("blocked device storage still permits complete in-tab S1 and future planning, with an honest save status");

    for (const width of [360, 768, 1440]) {
      for (const colorScheme of ["light", "dark"]) {
        page = await open({ viewport: { width, height: 1000 }, colorScheme, storage: { [PLAN_KEY]: JSON.stringify(SAVED_PLAN), [TRACK_KEY]: JSON.stringify({ cohort: "2026-2028", track: "phm" }) } });
        await choose(page);
        for (const number of [1, 2, 3, 4]) {
          await semester(page, number);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          assert.ok(overflow <= 1, `${width}px ${colorScheme}, S${number}: no horizontal page overflow (${overflow}px)`);
          assert.strictEqual(await page.locator('#plan-terms button[aria-selected="true"]').getAttribute("data-semester"), String(number));
          assert.strictEqual(await page.locator("#plan-content").getAttribute("aria-labelledby"), `semester-tab-${number}`);
        }
        await page.context().close();
      }
    }
    ok("all four semesters work at 360, 768 and 1440 px in light/dark mode with no sideways page scrolling and the correct accessible panel title");

    assert.deepStrictEqual(errors, [], "no uncaught browser errors");
    console.log(`${checks} study plan browser checks passed`);
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
