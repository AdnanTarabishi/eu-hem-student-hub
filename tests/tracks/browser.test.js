// Tracks interaction and privacy checks: node tests/tracks/browser.test.js .
// Static fixtures only. All requests outside this local Pages-style prefix and
// all POSTs are blocked; no official links, mail routes or services are followed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
const H = require("../../tracks-data.js");
const ROOT = path.resolve(process.argv[2] || ".");
const SHOTS = path.resolve(process.env.SCREENSHOT_DIR || path.join(ROOT, "work/track-qa"));
const PREFIX = "/eu-hem-student-hub/";
const FILE = JSON.parse(fs.readFileSync(path.join(ROOT, "content/tracks.json"), "utf8"));
const C = H.tracksCohort(FILE, "2026-2028");
const GUIDE = JSON.parse(fs.readFileSync(path.join(ROOT, "content/tracks-guide.json"), "utf8"));
const SENTINEL = "euhem-tracks-qa-sentinel";
const NOTE = "Fictional private worksheet marker: do not put this in a link or browser storage.";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".csv": "text/csv", ".webmanifest": "application/manifest+json" };
let checks = 0;
const ok = (message) => { checks++; console.log("  ok  " + message); };

function serve(request, response) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch { response.writeHead(400); return response.end("Bad URL"); }
  const file = path.resolve(ROOT, pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length) || "index.html" : "");
  if (!pathname.startsWith(PREFIX) || !file.startsWith(ROOT + path.sep)) { response.writeHead(404); return response.end("Not found"); }
  fs.readFile(file, (error, bytes) => {
    if (error) { response.writeHead(404); return response.end("Not found"); }
    response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(bytes);
  });
}

async function noSideways(page, label, selector = "html") {
  const overflow = await page.locator(selector).evaluate((element) => element.scrollWidth - element.clientWidth);
  assert.ok(overflow <= 1, `${label}: ${selector} has ${overflow}px horizontal overflow`);
}
async function show(page, selector) {
  await page.locator(selector).evaluate((element) => {
    const header = document.querySelector(".site-header").getBoundingClientRect().height;
    scrollTo({ top: scrollY + element.getBoundingClientRect().top - header - 16, behavior: "instant" });
  });
}
async function capture(page, name, fullPage = false) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage, animations: "disabled" });
}
const storage = (page) => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
const visibleCards = (page) => page.locator("#track-cards .track-card:visible").evaluateAll((cards) => cards.map((card) => card.dataset.track));
async function ready(page) {
  await page.waitForFunction(() => !document.getElementById("tracks-status"));
  await page.locator("#tx-track-search").waitFor();
  await page.locator("#tx-decision-notes").waitFor();
}
async function selectPair(page, first, second) {
  await page.locator("#compare-pick-1").selectOption(first);
  await page.locator("#compare-pick-2").selectOption(second);
}
async function comparisonRows(page) {
  return page.locator(".compare-two-grid").evaluate((grid) => Array.from(grid.querySelectorAll(".compare-two-label")).map((label) => {
    const a = label.nextElementSibling, b = a.nextElementSibling;
    return { label: label.textContent, a: a.textContent, b: b.textContent };
  }));
}
async function answerQuiz(page, indices) {
  for (let i = 0; i < indices.length; i++) {
    await page.locator("#quiz-box").getByRole("button", { name: C.quiz.questions[i].answers[indices[i]].text, exact: true }).click();
  }
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = http.createServer(serve);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`, base = origin + PREFIX;
  const errors = [], forbidden = [];
  let browser, lastPage, label = "startup";
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined) });
    const open = async ({ width = 1440, height = 1000, scheme = "light", query = "", seed = {}, blockedStorage = false,
      scripts = true, trackFailures = 0, guideFailures = 0, tracksFile = null, clipboard = "success" } = {}) => {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, locale: "en-GB",
        timezoneId: "Europe/Rome", reducedMotion: "reduce", serviceWorkers: "block", javaScriptEnabled: scripts });
      context.setDefaultTimeout(12000);
      await context.addInitScript(({ seed, blockedStorage, clipboard, sentinel }) => {
        delete Navigator.prototype.serviceWorker;
        localStorage.setItem(sentinel, "keep this fictional value");
        for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
        window.__trackQaWrites = [];
        for (const method of ["setItem", "removeItem", "clear"]) {
          const original = Storage.prototype[method];
          Storage.prototype[method] = function (...args) {
            window.__trackQaWrites.push({ method, key: args[0] || null });
            if (blockedStorage) throw new DOMException("Storage disabled for this fixture", "SecurityError");
            return original.apply(this, args);
          };
        }
        if (blockedStorage) Storage.prototype.getItem = function () { throw new DOMException("Storage disabled for this fixture", "SecurityError"); };
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value) => {
          if (clipboard === "failure") throw new DOMException("Clipboard disabled for this fixture", "NotAllowedError");
          window.__trackQaCopied = value;
        } } });
      }, { seed, blockedStorage, clipboard, sentinel: SENTINEL });
      const requests = [], failedPaths = new Set();
      let tracksAttempts = 0, guideAttempts = 0;
      await context.route("**/*", (route) => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin || !url.pathname.startsWith(PREFIX) || request.method() !== "GET" || request.postData() !== null) {
          forbidden.push(`${request.method()} ${request.url()}`); return route.abort();
        }
        requests.push({ url: request.url(), method: request.method() });
        if (url.pathname === PREFIX + "content/tracks.json") {
          if (++tracksAttempts <= trackFailures) { failedPaths.add(url.pathname); return route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"fictional fixture"}' }); }
          if (tracksFile) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tracksFile) });
        }
        if (url.pathname === PREFIX + "content/tracks-guide.json" && ++guideAttempts <= guideFailures) {
          failedPaths.add(url.pathname); return route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"fictional fixture"}' });
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
      page.on("response", (response) => {
        if (response.status() >= 400 && !failedPaths.has(new URL(response.url()).pathname)) errors.push(`${label}: HTTP ${response.status()} ${response.url()}`);
      });
      lastPage = page;
      if (scripts) await page.clock.setFixedTime(new Date("2026-10-10T12:00:00+02:00"));
      await page.goto(base + "tracks.html" + query);
      if (scripts && !trackFailures) await ready(page);
      return { page, context, requests, blockedStorage };
    };
    const close = async (fixture) => {
      if (!fixture.blockedStorage) assert.equal(await fixture.page.evaluate((key) => localStorage.getItem(key), SENTINEL), "keep this fictional value");
      await fixture.context.close();
    };

    label = "fallback-and-retry";
    let fixture = await open({ scripts: false }), page = fixture.page;
    assert.match((await page.locator("noscript").allTextContents()).join(" "), /JavaScript|four tracks/i);
    assert.ok(await page.locator("noscript a[href^='https://']").count() >= 1, "the script-free page retains an official destination");
    await fixture.context.close();
    fixture = await open({ trackFailures: 1, seed: { [H.MY_TRACK_KEY]: JSON.stringify({ cohort: C.id, track: "mhi" }) } }); page = fixture.page;
    await page.locator("#tx-retry-tracks").waitFor();
    assert.match(await page.locator("#tracks-status").innerText(), /saved choices|could not be loaded/i);
    await page.locator("#tx-retry-tracks").click(); await ready(page);
    assert.equal(await page.locator('.my-track-card[data-track="mhi"]').count(), 1);
    assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), H.MY_TRACK_KEY), { cohort: C.id, track: "mhi" });
    await close(fixture);
    fixture = await open({ guideFailures: 1 }); page = fixture.page;
    await page.locator("#tx-guide-retry").waitFor();
    await page.locator("#tx-decision-notes").fill(NOTE);
    await page.locator('input[name="decision-check"]').first().check();
    await page.locator("#tx-guide-retry").click();
    await page.locator(".tx-preparation-card").first().waitFor();
    assert.equal(await page.locator("#tx-decision-notes").inputValue(), NOTE, "guide retry preserves in-memory notes");
    assert.equal(await page.locator('input[name="decision-check"]:checked').count(), 1);
    assert.deepEqual(await page.evaluate(() => window.__trackQaWrites), []);
    await close(fixture);
    ok("JavaScript-disabled official links, curriculum retry and guide retry work without losing saved choices or in-memory notes");

    label = "stored-track-integrity";
    const previous = structuredClone(C); previous.id = "2025-2027"; previous.label = "Fictional previous cohort";
    const twoCohorts = { ...FILE, cohorts: [previous, C] };
    for (const seedValue of ["{malformed fictional JSON", JSON.stringify({ cohort: "2025-2027", track: "eeh" }), JSON.stringify({ cohort: C.id, track: "unknown" }), JSON.stringify({ track: "mhi" })]) {
      fixture = await open({ seed: { [H.MY_TRACK_KEY]: seedValue } }); page = fixture.page;
      assert.equal(await page.locator(".my-track-card").count(), 0);
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), H.MY_TRACK_KEY), seedValue, "invalid or other-cohort storage is ignored without deleting it");
      assert.deepEqual(await page.evaluate(() => window.__trackQaWrites), []);
      await close(fixture);
    }
    fixture = await open({ tracksFile: twoCohorts, query: "?cohort=2025-2027", seed: { [H.MY_TRACK_KEY]: JSON.stringify({ cohort: C.id, track: "eeh" }) } }); page = fixture.page;
    assert.equal(await page.locator(".my-track-card").count(), 0, "current-cohort choice is not applied to an archived cohort");
    await page.locator(".track-pick").nth(1).click();
    assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), H.MY_TRACK_KEY), { cohort: "2025-2027", track: "ep" });
    await close(fixture);
    fixture = await open({ blockedStorage: true }); page = fixture.page;
    await page.locator(".track-pick").nth(2).click();
    assert.equal(await page.locator(".my-track-card").count(), 0);
    assert.doesNotMatch(await page.locator("#my-track").innerText(), /saved.*on this device/i, "disabled storage cannot claim persistence");
    assert.match(await page.locator("#my-track").innerText(), /could not|unavailable|save/i);
    await close(fixture);
    ok("malformed, missing and mismatched cohort choices are ignored safely; archived choices keep their cohort and disabled storage reports the failure");

    label = "compare-filter-and-worksheet";
    fixture = await open({ query: "?cohort=2026-2028&compare=ep,mhi#compare-two" }); page = fixture.page;
    assert.equal(await page.locator("#compare-pick-1").inputValue(), "ep");
    assert.equal(await page.locator("#compare-pick-2").inputValue(), "mhi");
    assert.equal(await page.locator("details.tx-full-compare").getAttribute("open"), null, "the complete four-track matrix begins collapsed");
    assert.match(await page.locator('.compare-two-cell[data-label="Semester 3: choices"]').nth(1).innerText(), /Choose one pair/);
    assert.match(await page.locator('.compare-two-cell[data-label="Semester 2: choices"]').nth(1).innerText(), /not stated in the source/i);
    const fullRows = await comparisonRows(page);
    await page.locator(".tx-differences").check();
    assert.deepEqual(await comparisonRows(page), fullRows.filter((row) => row.a !== row.b), "differences hide only factually identical displayed criteria");
    await page.locator("#tx-track-search").fill("Real Life Simulation Methods");
    assert.deepEqual(await visibleCards(page), ["mhi"]);
    assert.equal(await page.locator("#explorer .track-detail").count(), 4, "card filtering preserves the complete curriculum explorer");
    let url = new URL(page.url());
    assert.equal(url.searchParams.get("compare"), "ep,mhi"); assert.equal(url.searchParams.get("differences"), "1");
    assert.equal(url.searchParams.get("cohort"), C.id); assert.equal(url.hash, "#compare-two");
    await page.locator("#tx-track-filter-reset").click();
    await page.locator("#tx-track-theme").selectOption("qualitative");
    const thematic = C.tracks.filter((t) => H.trackCourses(C, t).some((entry) => C.courses[entry.id].themes.includes("qualitative"))).map((t) => t.id);
    assert.deepEqual(await visibleCards(page), thematic);
    await page.locator("#tx-track-search").fill("no-fictional-course-matches-this");
    assert.deepEqual(await visibleCards(page), []);
    assert.match(await page.locator(".tx-filter-status").innerText(), /No tracks match/i);
    await page.locator("#tx-track-filter-reset").click();
    assert.deepEqual(await visibleCards(page), C.tracks.map((t) => t.id));
    await page.locator("#tx-decision-notes").fill(NOTE);
    await page.locator(`input[name="decision-check"][value="${GUIDE.checklist[0].id}"]`).check();
    await page.locator(".tx-share-compare").click();
    await page.waitForFunction(() => Boolean(window.__trackQaCopied));
    const copied = new URL(await page.evaluate(() => window.__trackQaCopied));
    assert.equal(copied.searchParams.get("compare"), "ep,mhi"); assert.equal(copied.searchParams.get("differences"), "1");
    assert.equal(copied.hash, "#compare-two");
    assert.doesNotMatch(decodeURIComponent(copied.href), /Fictional private|decision-check|checks=/i);
    assert.doesNotMatch(decodeURIComponent(page.url()), /Fictional private|notes=|decision-check/i, "the current address also excludes worksheet answers");
    assert.doesNotMatch(JSON.stringify(await storage(page)), /Fictional private|decision-check/);
    assert.deepEqual(await page.evaluate(() => window.__trackQaWrites), [], "filters, compare, sharing and worksheet typing do not write browser storage");
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#tx-download-notes").click();
    const download = await downloadPromise;
    const exported = fs.readFileSync(await download.path(), "utf8");
    assert.ok(exported.includes(NOTE));
    assert.ok(exported.includes(GUIDE.checklist[0].title));
    assert.match(exported, /Choose one pair/); assert.match(exported, /courses taken together/);
    assert.match(exported, /credits: Not stated in the source/i);
    assert.match(exported, /how many to choose: Not stated in the source/i);
    assert.ok(exported.includes(C.tracks[1].name) && exported.includes(C.tracks[2].name));
    for (const source of C.sources.pages) assert.ok(exported.includes(source.url));
    assert.deepEqual(await page.evaluate(() => window.__trackQaWrites), [], "explicit download creates a file without autosaving notes");
    await page.locator("#compare-pick-2").selectOption("ep");
    assert.match(await page.locator(".compare-two-body").innerText(), /different tracks/i);
    assert.equal(await page.locator(".tx-share-compare").isDisabled(), true);
    assert.equal(await page.locator("#tx-download-notes").isDisabled(), true);
    await page.reload(); await ready(page);
    assert.equal(await page.locator("#tx-decision-notes").inputValue(), "");
    assert.equal(await page.locator('input[name="decision-check"]:checked').count(), 0, "worksheet choices are cleared when leaving page memory");
    await close(fixture);
    ok("comparison differences, focus/course filters, duplicate handling and accurate explicit downloads keep worksheet content out of links and storage");

    label = "clipboard-and-history";
    fixture = await open({ clipboard: "failure", query: "?compare=eeh,ep&differences=1&q=modelling#compare-two" }); page = fixture.page;
    await page.locator(".tx-share-compare").click();
    const fallback = page.locator(".tx-comparison-link"); await fallback.waitFor();
    const shared = new URL(await fallback.getAttribute("href"));
    assert.equal(shared.searchParams.get("q"), "modelling"); assert.equal(shared.searchParams.get("compare"), "eeh,ep");
    await page.evaluate(() => history.pushState(null, "", "?cohort=2026-2028&compare=mhi,phm&theme=qualitative#compare-two"));
    await page.reload(); await ready(page);
    await page.goBack();
    await page.waitForFunction(() => document.getElementById("compare-pick-1").value === "eeh");
    assert.equal(await page.locator("#compare-pick-2").inputValue(), "ep");
    assert.equal(await page.locator(".tx-differences").isChecked(), true);
    assert.equal(await page.locator("#tx-track-search").inputValue(), "modelling");
    await page.goForward();
    await page.waitForFunction(() => document.getElementById("compare-pick-1").value === "mhi");
    assert.equal(await page.locator("#compare-pick-2").inputValue(), "phm");
    assert.equal(await page.locator("#tx-track-theme").inputValue(), "qualitative");
    assert.equal(await page.locator(".tx-differences").isChecked(), false);
    await page.evaluate(() => { location.hash = "track-phm"; });
    await page.locator("#track-phm[open] .track-detail-body > div").waitFor();
    await close(fixture);
    fixture = await open({ query: "?compare=unknown,ep&theme=unsupported#compare-two" }); page = fixture.page;
    assert.notEqual(await page.locator("#compare-pick-1").inputValue(), await page.locator("#compare-pick-2").inputValue());
    assert.equal(await page.locator("#tx-track-theme").inputValue(), "");
    assert.match(await page.locator(".tx-compare-status").innerText(), /not valid|different tracks/i);
    await close(fixture);
    ok("clipboard fallback and comparison/filter Back/Forward work; changed track fragments open and invalid links retain usable defaults");

    label = "quiz-reflection";
    fixture = await open(); page = fixture.page;
    const before = await storage(page);
    await page.locator("#quiz-box").getByRole("button", { name: "Start the quiz", exact: true }).click();
    const initialOrder = await page.locator(".quiz-answer").allTextContents();
    await page.locator(".quiz-answer").first().focus(); await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator(".quiz-answer").nth(1).evaluate((element) => document.activeElement === element), true);
    await page.locator("#quiz-box").getByRole("button", { name: C.quiz.questions[0].answers[0].text, exact: true }).click();
    await page.locator(".quiz-back").click();
    assert.deepEqual(await page.locator(".quiz-answer").allTextContents(), initialOrder, "Back preserves the shuffled answer order");
    assert.equal(await page.locator("#quiz-box").getByRole("button", { name: C.quiz.questions[0].answers[0].text, exact: true }).getAttribute("aria-pressed"), "true");
    await answerQuiz(page, Array(8).fill(0));
    assert.deepEqual(await page.locator(".quiz-bar-score").allTextContents(), ["21 of 21 points", "1 of 21 points", "0 of 21 points", "0 of 21 points"]);
    assert.match(await page.locator(".quiz-top-card").first().innerText(), /Highest points/i);
    assert.match(await page.locator(".quiz-top-card").nth(1).innerText(), /Next starting point/i);
    assert.equal(await page.locator(".quiz-close").count(), 0, "a wide score gap is not presented as a close match");
    await page.locator("#tx-quiz-explanation > summary").click();
    const reasons = await page.locator("#tx-quiz-explanation ol > li").allTextContents();
    assert.equal(reasons.length, 8);
    for (let i = 0; i < reasons.length; i++) {
      const answer = C.quiz.questions[i].answers[0]; assert.ok(reasons[i].includes(answer.text));
      for (const [id, points] of Object.entries(answer.points)) assert.ok(reasons[i].includes(H.trackById(C, id).abbr + ": +" + points));
    }
    await page.locator("#tx-quiz-review").click();
    assert.match(await page.locator(".quiz-count").innerText(), /8 of 8/);
    await page.locator(".quiz-back").click(); assert.match(await page.locator(".quiz-count").innerText(), /7 of 8/);
    await page.locator("#quiz-box").getByRole("button", { name: C.quiz.questions[6].answers[0].text, exact: true }).click();
    await page.locator("#quiz-box").getByRole("button", { name: C.quiz.questions[7].answers[0].text, exact: true }).click();
    await page.locator(".quiz-actions").getByRole("button", { name: /side by side/ }).click();
    assert.equal(await page.locator("#compare-pick-1").inputValue(), "eeh"); assert.equal(await page.locator("#compare-pick-2").inputValue(), "mhi");
    await page.locator("#tx-quiz-clear").click();
    assert.equal(await page.locator(".quiz-bars").count(), 0);
    await page.locator("#quiz-box").getByRole("button", { name: "Start the quiz", exact: true }).click();
    await answerQuiz(page, [0, 1, 1, 2, 0, 3, 0, 3]);
    assert.deepEqual(await page.locator(".quiz-bar-score").allTextContents(), ["7 of 21 points", "7 of 21 points", "7 of 21 points", "2 of 21 points"]);
    assert.equal(await page.locator(".quiz-top-card").count(), 3, "every track tied for highest points is represented equally");
    assert.equal(await page.locator(".quiz-close").count(), 1);
    for (const card of await page.locator(".quiz-top-card").all()) assert.match(await card.innerText(), /Joint closest on these points/i);
    await capture(page, "quiz-three-way-tie");
    assert.deepEqual(await storage(page), before);
    assert.deepEqual(await page.evaluate(() => window.__trackQaWrites), [], "quiz answers and explanations do not write storage");
    await close(fixture);
    ok("quiz keyboard/Back/review/clear, exact scores and explanations work; all three tied tracks are honest equal starting points without persistence");

    for (const width of [1440, 390, 320]) for (const scheme of ["light", "dark"]) {
      label = `${width}-${scheme}`;
      fixture = await open({ width, height: width === 1440 ? 1000 : 900, scheme, query: "?compare=eeh,ep#track-mhi" }); page = fixture.page;
      await page.locator("#track-mhi[open] .track-detail-body > div").waitFor();
      const covers = page.locator("#tracks-hero img, #track-cards .track-card img");
      assert.ok(await covers.count() >= 4, "the illustrated library has local editorial covers");
      for (const image of await covers.all()) {
        await image.scrollIntoViewIfNeeded(); await image.evaluate((element) => element.decode());
        assert.ok(await image.evaluate((element) => element.naturalWidth > 0));
        assert.equal(new URL(await image.getAttribute("src"), page.url()).origin, origin);
      }
      await noSideways(page, label);
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await capture(page, "page-" + label, true);
      if (width > 640) {
        await page.locator("#tab-mhi-overview").focus(); await page.keyboard.press("ArrowRight");
        assert.equal(await page.locator("#tab-mhi-courses").getAttribute("aria-selected"), "true");
        await page.keyboard.press("End");
        assert.equal(await page.locator('#track-mhi [role="tab"][aria-selected="true"]').getAttribute("data-key"), "fit");
        await page.keyboard.press("Home");
      } else {
        const coursesFold = page.locator("#track-mhi .explorer-fold").filter({ has: page.getByText("Courses", { exact: true }) });
        await coursesFold.locator("summary").focus(); await page.keyboard.press("Enter");
        assert.equal(await coursesFold.getAttribute("open"), "");
      }
      await show(page, "#track-mhi"); await noSideways(page, label + " explorer", "#track-mhi"); await capture(page, "explorer-" + label);
      await page.locator("details.tx-full-compare > summary").focus(); await page.keyboard.press("Enter");
      assert.equal(await page.locator("details.tx-full-compare").getAttribute("open"), "");
      assert.equal(await page.locator(width > 900 ? ".compare-table tbody tr" : ".compare-card").count(), C.themes.length + 3);
      await noSideways(page, label + " matrix"); await noSideways(page, label + " matrix", "details.tx-full-compare");
      await show(page, "#compare-two"); await capture(page, "comparison-" + label);
      await show(page, "#decision-guide"); await noSideways(page, label + " guide", "#decision-guide"); await capture(page, "decision-guide-" + label);
      const controls = await page.locator("#tx-track-search, #tx-track-theme, #compare-pick-1, #compare-pick-2, #tx-decision-notes, input[name='decision-check']").evaluateAll((elements) => elements.map((element) => ({ id: element.id || element.value, label: Array.from(element.labels || []).some((label) => label.textContent.trim()) })));
      for (const control of controls) assert.ok(control.label, `${label}: ${control.id} has a native label`);
      await close(fixture);
      ok(`${label}: local covers, keyboard explorer, complete matrix, labelled controls and worksheet fit without horizontal overflow`);
    }

    label = "resize-and-persistence";
    fixture = await open({ query: "#track-mhi" }); page = fixture.page;
    await page.locator("#track-mhi[open] .explorer-tabs").waitFor();
    await page.locator("#tab-mhi-courses").click();
    await selectPair(page, "ep", "mhi"); await page.locator(".tx-differences").check();
    await page.locator("details.tx-full-compare > summary").click();
    await page.locator("#tx-decision-notes").fill(NOTE);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.locator("#track-mhi[open] .explorer-accordion").waitFor();
    assert.equal((await page.locator("#track-mhi .explorer-fold[open] > summary").textContent()).trim(), "Courses");
    assert.equal(await page.locator(".tx-differences").isChecked(), true);
    assert.equal(await page.locator("#compare-pick-2").inputValue(), "mhi");
    assert.equal(await page.locator("details.tx-full-compare").getAttribute("open"), "", "the complete matrix stays expanded after mobile redraw");
    assert.equal(await page.locator("#tx-decision-notes").inputValue(), NOTE);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("#track-mhi[open] .explorer-tabs").waitFor();
    assert.equal(await page.locator("#tab-mhi-courses").getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("details.tx-full-compare").getAttribute("open"), "", "the complete matrix stays expanded after desktop redraw");
    await page.locator(".track-pick").nth(2).click();
    await page.reload(); await ready(page);
    assert.equal(await page.locator('.my-track-card[data-track="mhi"]').count(), 1);
    await page.locator("#my-track").getByRole("button", { name: "Change", exact: true }).click();
    await page.getByRole("button", { name: "Remove my track", exact: true }).click();
    assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), H.MY_TRACK_KEY), null);
    await close(fixture);
    ok("responsive redraw preserves open track/tab, comparison choices and in-memory notes; My track persists and removes using the shared storage contract");

    assert.deepEqual(forbidden, [], "no external request or POST can leave this suite");
    assert.deepEqual(errors, [], "no browser exception or missing local asset");
    console.log(`Tracks browser checks: ${checks} passed. Screenshots: ${path.relative(ROOT, SHOTS)}`);
  } catch (error) {
    if (lastPage && !lastPage.isClosed()) await lastPage.screenshot({ path: path.join(SHOTS, "failure-" + label + ".png"), animations: "disabled" }).catch(() => {});
    console.error(`Tracks check failed (${label}):`, error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})();
