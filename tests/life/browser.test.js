// Meaningful Life guide interaction, privacy and offline checks.
// Run: node tests/life/browser.test.js .
// The local server emulates the GitHub Pages prefix. External requests and
// submissions are blocked; tests never follow university/contact destinations.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "../.."));
const SHOTS = path.resolve(process.env.LIFE_SCREENSHOT_DIR || path.join(ROOT, "work/life-verification"));
const PREFIX = "/eu-hem-student-hub/";
const GUIDE = JSON.parse(fs.readFileSync(path.join(ROOT, "content/life-guide.json"), "utf8"));
const TRACKS_FILE = JSON.parse(fs.readFileSync(path.join(ROOT, "content/tracks.json"), "utf8"));
const TRACKS = TRACKS_FILE.cohorts.at(-1);
const CITIES = ["bologna", "oslo", "innsbruck", "rotterdam"];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".csv": "text/csv", ".webmanifest": "application/manifest+json", ".md": "text/markdown" };
const SENTINEL = "euhem-life-fictional-qa-sentinel";
const contexts = new Set();
const errors = [], forbidden = [];
let checks = 0, browser, lastPage, label = "startup";
const ok = (message) => { checks++; console.log("  ok  " + message); };
const sorted = (items) => [...new Set(items)].sort();

function serve(request, response) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch { response.writeHead(400); response.end("Bad URL"); return; }
  const file = path.resolve(ROOT, pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length) || "index.html" : "");
  if (request.method !== "GET" || !pathname.startsWith(PREFIX) || !file.startsWith(ROOT + path.sep)) {
    response.writeHead(404); response.end("Not found"); return;
  }
  fs.readFile(file, (error, bytes) => {
    if (error) { response.writeHead(404); response.end("Not found"); return; }
    response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(bytes);
  });
}

async function ready(page) {
  await page.waitForFunction(() => document.getElementById("life-content")?.getAttribute("aria-busy") === "false");
  await page.locator("#life-city").waitFor();
}
async function capture(page, name) {
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo({ top: 0, behavior: "instant" }); });
  await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true, animations: "disabled" });
}
async function noSideways(page, message) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, message + ": " + overflow + "px horizontal overflow");
}
async function focusedWithin(page, id) {
  await page.waitForFunction((target) => document.getElementById(target)?.contains(document.activeElement), id);
}
async function close({ page, context }, { allowTheme = false } = {}) {
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), SENTINEL), "keep this fictional value");
  const writes = await page.evaluate(() => window.__lifeQaWrites);
  if (allowTheme) assert.ok(writes.every((write) => /theme/.test(write.key || "")), "only explicit theme preference may be saved");
  else assert.deepEqual(writes, [], "Life filters, route choices and disclosures stay in memory");
  await context.close(); contexts.delete(context);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = http.createServer(serve);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`, base = origin + PREFIX;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined) });
    const open = async ({ file = "student-life.html", query = "", width = 1440, scheme = "light", scripts = true,
      lifeFailures = 0, trackFailures = 0, invalidLife = false, invalidTracks = null, tracksFile = null, offline = false } = {}) => {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: scheme,
        locale: "en-GB", reducedMotion: "reduce", serviceWorkers: offline ? "allow" : "block", javaScriptEnabled: scripts });
      contexts.add(context); context.setDefaultTimeout(12000);
      await context.addInitScript((sentinel) => {
        localStorage.setItem(sentinel, "keep this fictional value");
        window.__lifeQaWrites = [];
        for (const method of ["setItem", "removeItem", "clear"]) {
          const original = Storage.prototype[method];
          Storage.prototype[method] = function (...args) {
            window.__lifeQaWrites.push({ method, key: args[0] || null });
            return original.apply(this, args);
          };
        }
      }, SENTINEL);
      let lifeAttempts = 0, trackAttempts = 0;
      const failedPaths = new Set();
      const guard = (request) => {
        const url = new URL(request.url());
        if (url.origin !== origin || !url.pathname.startsWith(PREFIX) || request.method() !== "GET" || request.postData() !== null)
          forbidden.push(request.method() + " " + request.url());
      };
      context.on("request", guard);
      await context.route("**/*", (route) => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin || !url.pathname.startsWith(PREFIX) || request.method() !== "GET" || request.postData() !== null) return route.abort();
        if (url.pathname === PREFIX + "content/life-guide.json") {
          if (++lifeAttempts <= lifeFailures) {
            failedPaths.add(url.pathname);
            return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Fictional temporary failure"}' });
          }
          if (invalidLife && lifeAttempts === 1) return route.fulfill({ status: 200, contentType: "application/json", body: '{"version":1,"topics":[]}' });
        }
        if (url.pathname === PREFIX + "content/tracks.json") {
          if (++trackAttempts <= trackFailures) {
            failedPaths.add(url.pathname);
            return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Fictional temporary failure"}' });
          }
          if (invalidTracks !== null && trackAttempts === 1) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(invalidTracks) });
          if (tracksFile) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tracksFile) });
        }
        return route.continue();
      });
      const page = await context.newPage(); lastPage = page;
      page.on("pageerror", (error) => errors.push(label + ": " + error.message));
      page.on("response", (response) => {
        if (response.status() >= 400 && !failedPaths.has(new URL(response.url()).pathname)) errors.push(label + ": HTTP " + response.status() + " " + response.url());
      });
      await page.goto(base + file + query, { waitUntil: "domcontentloaded" });
      if (scripts && !lifeFailures && !trackFailures && !invalidLife && invalidTracks === null) await ready(page);
      return { page, context };
    };

    label = "student-city-context";
    let fixture = await open(), page = fixture.page;
    assert.equal(await page.locator("body").getAttribute("data-life-page"), "student");
    assert.equal(await page.locator("#life-city").inputValue(), "all");
    assert.equal(await page.locator("#life-topics > .life-topic:visible").count(), 6);
    assert.equal(await page.locator("#life-status").getAttribute("role"), "status");
    assert.ok(await page.locator('a[href="support.html#universities"]').count() > 0);
    for (const city of CITIES) {
      await page.locator("#life-city").selectOption(city);
      assert.equal(await page.locator("#life-topics > .life-topic:visible").count(), 6, "city context retains every general-life topic");
      const localLinks = await page.locator('#life-topics a[href^="city-guide.html?"]').evaluateAll((links) => links.map((link) => new URL(link.href).searchParams.get("city")));
      assert.ok(localLinks.length > 0 && localLinks.every((value) => value === city), city + " contextual guides point to this city only");
      const actual = await page.locator('#life-sources .life-source a[href^="https://"]').evaluateAll((links) => links.map((link) => link.href));
      const expected = GUIDE.sources.filter((source) => source.city === "all" || source.city === city).map((source) => source.url);
      assert.deepEqual(sorted(actual), sorted(expected), city + " source cards contain city-specific and shared official entry points only");
      assert.equal(new URL(page.url()).searchParams.get("city"), city);
    }
    await capture(page, "student-life-desktop-light"); await close(fixture);
    ok("city context preserves all six general-life topics, updates only local links/source cards and exposes a public city URL");

    label = "student-search-reset";
    fixture = await open({ query: "?city=oslo" }); page = fixture.page;
    await page.locator("#life-search").fill(GUIDE.topics[0].title);
    assert.ok(await page.locator("#housing").isVisible(), "topic-title search finds its matching guidance");
    await page.locator("#life-search").fill("no-fictional-topic-can-match-this-phrase");
    assert.equal(await page.locator("#life-topics > .life-topic:visible").count(), 0);
    assert.match(await page.locator("#life-status").innerText(), /no|0/i);
    await page.locator("#life-reset").click();
    assert.equal(await page.locator("#life-search").inputValue(), "");
    assert.equal(await page.locator("#life-topics > .life-topic:visible").count(), 6);
    assert.equal(await page.locator("#life-city").inputValue(), "all");
    assert.ok(!new URL(page.url()).searchParams.has("q"), "search text is not published in the URL");
    await close(fixture);
    ok("topic search reports an empty result, reset restores all topics and search text is kept out of links and storage");

    label = "topic-deep-links";
    fixture = await open({ query: "?city=rotterdam#wellbeing" }); page = fixture.page;
    await focusedWithin(page, "wellbeing");
    assert.equal(await page.locator("#life-city").inputValue(), "rotterdam");
    await page.locator("#life-search").fill("no-fictional-topic-can-match-this-phrase");
    await page.evaluate(() => { location.hash = "inclusion"; });
    await page.locator("#inclusion").waitFor(); await focusedWithin(page, "inclusion");
    assert.equal(await page.locator("#life-search").inputValue(), "", "opening a hidden topic clears the in-memory search");
    await close(fixture);
    ok("direct and changed topic fragments reveal filtered content and move keyboard focus to the requested topic");

    label = "source-citations";
    fixture = await open({ query: "?city=rotterdam" }); page = fixture.page;
    assert.equal(await page.locator(".life-source-disclosure").evaluate((element) => element.open), false);
    await page.locator('#wellbeing a[href="#life-source-eur-support"]').click();
    await page.locator("#life-source-eur-support").waitFor();
    assert.equal(await page.locator(".life-source-disclosure").evaluate((element) => element.open), true);
    await focusedWithin(page, "life-source-eur-support");
    await close(fixture);
    fixture = await open({ query: "?city=rotterdam#life-source-sio-health" }); page = fixture.page;
    await page.locator("#life-source-sio-health").waitFor(); await focusedWithin(page, "life-source-sio-health");
    assert.equal(await page.locator("#life-city").inputValue(), "all", "a direct source link broadens city context instead of hiding the source");
    await close(fixture);
    ok("topic citations reveal their collapsed source cards; direct source fragments resolve a conflicting city context and receive focus");

    label = "mobility-routes";
    fixture = await open({ file: "mobility-guide.html" }); page = fixture.page;
    assert.equal(await page.locator("body").getAttribute("data-life-page"), "mobility");
    assert.equal(await page.locator("#life-city").inputValue(), "bologna");
    assert.equal(await page.locator("#life-track").inputValue(), "");
    assert.equal(await page.locator("#life-stages > details").count(), 6);
    assert.equal(await page.locator("#prepare").evaluate((element) => element.open), true);
    assert.equal(await page.locator("#departure").evaluate((element) => element.open), false);
    const options = await page.locator("#life-track option").evaluateAll((items) => items.map((item) => item.value).filter(Boolean));
    assert.deepEqual(options, TRACKS.tracks.map((track) => track.id));
    for (const track of TRACKS.tracks) {
      await page.locator("#life-track").selectOption(track.id);
      const route = await page.locator("#life-route").innerText();
      const expected = [TRACKS.universities[TRACKS.semester1.university].city, ...track.semesters.map((semester) => TRACKS.universities[semester.university].city)];
      let index = -1;
      for (const city of expected) {
        const next = route.indexOf(city, index + 1);
        assert.ok(next > index, track.id + ": route preserves shared semester order for " + city);
        index = next;
      }
      assert.match(route, /thesis/i, "Semester 4 is explained as thesis choices rather than an invented mandatory return");
    }
    await page.locator("#life-city").selectOption("innsbruck");
    for (const stage of GUIDE.stages) {
      const links = await page.locator(`#${stage.id} .life-topic-links a`).evaluateAll((items) => items.map((item) => item.getAttribute("href")));
      const related = new Set(stage.related.map((item) => item.href));
      const context = links.filter((href) => href.startsWith("city-guide.html?") && !related.has(href));
      assert.ok(context.length > 0 && context.every((href) => new URL(href, base).searchParams.get("city") === "innsbruck"), stage.id + " contextual links follow Innsbruck without replacing intentional related destinations");
    }
    await capture(page, "mobility-desktop-light"); await close(fixture);
    ok("all four mobility routes derive their semester cities from the shared track source; destination context updates stage links");

    label = "shared-route-source-fixture";
    const changedTracks = structuredClone(TRACKS_FILE), changedCohort = changedTracks.cohorts.at(-1);
    changedCohort.universities.unibo.city = "Fictional Start City";
    changedCohort.universities.eur.city = "Fictional Harbour City";
    changedCohort.universities.uio.city = "Fictional Northern City";
    fixture = await open({ file: "mobility-guide.html", tracksFile: changedTracks }); page = fixture.page;
    await page.locator("#life-track").selectOption("eeh");
    const changedRoute = await page.locator("#life-route").innerText();
    assert.match(changedRoute, /Fictional Start City[\s\S]*Fictional Harbour City[\s\S]*Fictional Northern City/,
      "the route uses university cities from the fetched source");
    await close(fixture);
    ok("a fictional shared-data fixture changes route city labels without duplicated route facts");

    label = "mobility-stage-deep-links";
    fixture = await open({ file: "mobility-guide.html", query: "?city=oslo#arrival" }); page = fixture.page;
    await page.locator("#arrival[open]").waitFor(); await focusedWithin(page, "arrival");
    await page.locator("#departure > summary").focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator("#departure").evaluate((element) => element.open), true);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#departure").evaluate((element) => element.open), false);
    await page.evaluate(() => { location.hash = "leaving"; });
    await page.locator("#leaving[open]").waitFor(); await focusedWithin(page, "leaving");
    await close(fixture);
    for (const file of ["student-life.html", "mobility-guide.html"]) {
      fixture = await open({ file, query: "?city=fictional-unknown-city#fictional-missing-anchor" }); page = fixture.page;
      assert.equal(await page.locator("#life-city").inputValue(), file === "student-life.html" ? "all" : "bologna");
      await close(fixture);
    }
    ok("stage fragments open native disclosures, Enter toggles them, and invalid public links retain usable defaults");

    label = "load-retry";
    for (const options of [{ lifeFailures: 1 }, { invalidLife: true }, { file: "mobility-guide.html", trackFailures: 1 },
      { file: "mobility-guide.html", invalidTracks: {} }, { file: "mobility-guide.html", invalidTracks: { cohorts: [] } }]) {
      fixture = await open(options); page = fixture.page;
      await page.locator("#life-retry").waitFor();
      assert.ok(await page.locator('a[href^="city-guide.html"]').count() > 0, "failure preserves basic city destinations");
      await page.locator("#life-retry").click(); await ready(page);
      assert.equal(await page.locator("#life-retry").isVisible(), false);
      assert.equal(await page.locator(options.file ? "#life-stages > details" : "#life-topics > .life-topic").count(), 6);
      await close(fixture);
    }
    fixture = await open({ trackFailures: 1, query: "?city=rotterdam#life-source-sio-health" }); page = fixture.page;
    await page.locator("#life-retry").waitFor();
    await page.locator("#life-source-sio-health").waitFor(); await focusedWithin(page, "life-source-sio-health");
    assert.equal(await page.locator("#life-city").isDisabled(), true);
    assert.equal(await page.locator("#life-city").inputValue(), "all", "an existing source is accessible without university metadata");
    assert.equal(await page.locator("#life-content").getAttribute("aria-busy"), "false");
    await page.locator("#life-retry").click(); await ready(page);
    assert.equal(await page.locator("#life-city").isEnabled(), true);
    await close(fixture);
    ok("temporary data failures, malformed guide/tracks and a source hash without university metadata retain useful content and recover through Retry");

    label = "print-disclosure-state";
    fixture = await open({ file: "mobility-guide.html" }); page = fixture.page;
    await page.locator("#departure > summary").click();
    const beforePrint = await page.locator(".life-main details").evaluateAll((items) => items.map((item) => ({ id: item.id, open: item.open })));
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    assert.equal(await page.locator(".life-main details:not([open])").count(), 0, "printing includes content from every moving stage and source collection");
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    const afterPrint = await page.locator(".life-main details").evaluateAll((items) => items.map((item) => ({ id: item.id, open: item.open })));
    assert.deepEqual(afterPrint, beforePrint, "printing restores the student's disclosure choices");
    await close(fixture);
    ok("print preparation includes all guidance and restores the previous disclosure state afterwards");

    label = "global-search";
    fixture = await open(); page = fixture.page;
    await page.keyboard.press("Control+k");
    await page.locator(".search-dialog .search-input").fill(GUIDE.topics[0].title);
    const housingResult = page.locator('.search-result[href="student-life.html#housing"]');
    await housingResult.waitFor(); await housingResult.click();
    await focusedWithin(page, "housing");
    assert.equal(new URL(page.url()).hash, "#housing");
    await page.keyboard.press("Control+k");
    await page.locator(".search-dialog .search-input").fill(GUIDE.stages.find((stage) => stage.id === "arrival").title);
    const arrivalResult = page.locator('.search-result[href="mobility-guide.html#arrival"]');
    await arrivalResult.waitFor(); await arrivalResult.click();
    await ready(page); await page.locator("#arrival[open]").waitFor(); await focusedWithin(page, "arrival");
    assert.equal(new URL(page.url()).pathname, PREFIX + "mobility-guide.html");
    assert.equal(new URL(page.url()).hash, "#arrival");
    await close(fixture);
    ok("shared site search finds the new housing topic and arrival stage, follows stable page fragments and focuses their content");

    label = "no-script";
    for (const file of ["student-life.html", "mobility-guide.html"]) {
      fixture = await open({ file, scripts: false }); page = fixture.page;
      assert.ok(await page.locator('a[href^="city-guide.html"]').count() >= 1, file + " retains city-guide links without scripts");
      assert.ok(await page.locator('a[href^="toolkit.html"]').count() >= 1, file + " retains existing tools without scripts");
      assert.ok(await page.locator('a[href^="support.html"]').count() >= 1, file + " retains university support without scripts");
      assert.ok(await page.locator("h1").isVisible(), file + " keeps the page introduction");
      await fixture.context.close(); contexts.delete(fixture.context);
    }
    ok("both script-free pages remain useful through their introduction, city guides, existing Toolkit and support destinations");

    label = "themes-keyboard-mobile";
    for (const file of ["student-life.html", "mobility-guide.html"]) for (const width of [360, 1440]) for (const scheme of ["light", "dark"]) {
      fixture = await open({ file, width, scheme }); page = fixture.page;
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")), scheme);
      assert.equal(await page.locator(".theme-toggle").getAttribute("aria-label"), scheme === "light" ? "Switch to dark mode" : "Switch to light mode");
      await noSideways(page, file + " " + width + " " + scheme);
      assert.ok(await page.locator(".skip-link").count() > 0);
      await page.locator("#life-city").focus();
      assert.equal(await page.locator("#life-city").evaluate((element) => document.activeElement === element), true);
      const focus = await page.locator("#life-city").evaluate((element) => {
        const css = getComputedStyle(element); return { outline: css.outlineStyle, width: css.outlineWidth, shadow: css.boxShadow };
      });
      assert.ok((focus.outline !== "none" && parseFloat(focus.width) > 0) || focus.shadow !== "none", "keyboard control has a visible focus treatment");
      if (file === "student-life.html") await page.locator("#life-city").selectOption("oslo");
      else { await page.locator("#life-track").selectOption("eeh"); await page.locator("#arrival > summary").click(); }
      await noSideways(page, file + " expanded " + width + " " + scheme);
      await capture(page, `${file.replace(".html", "")}-${width}-${scheme}`);
      await close(fixture);
    }
    ok("both pages and expanded content fit 360px and desktop in both themes, with keyboard focus and reduced-motion previews");

    label = "actual-service-worker-offline";
    fixture = await open({ offline: true }); page = fixture.page;
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 45000 });
    await page.reload({ waitUntil: "domcontentloaded" }); await ready(page);
    await page.goto(base + "mobility-guide.html?city=oslo#arrival", { waitUntil: "domcontentloaded" }); await ready(page);
    await page.waitForFunction(async () => {
      const keys = (await caches.keys()).find((key) => key.startsWith("site-"));
      const cache = await caches.open(keys);
      const paths = (await cache.keys()).map((request) => new URL(request.url).pathname);
      return ["student-life.html", "mobility-guide.html", "life.css", "life.js"].every((file) => paths.some((item) => item.endsWith("/" + file)));
    });
    await page.waitForFunction(async () => {
      const cache = await caches.open("data");
      const paths = (await cache.keys()).map((request) => new URL(request.url).pathname);
      return ["content/life-guide.json", "content/tracks.json"].every((file) => paths.some((item) => item.endsWith("/" + file)));
    });
    await fixture.context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" }); await ready(page);
    await page.locator("#life-track").selectOption("phm");
    assert.match(await page.locator("#life-route").innerText(), /Innsbruck[\s\S]*Rotterdam/);
    await page.goto(base + "student-life.html?city=rotterdam#benefits", { waitUntil: "domcontentloaded" }); await ready(page);
    await focusedWithin(page, "benefits");
    assert.equal(await page.locator("#life-topics > .life-topic:visible").count(), 6);
    await page.locator("#life-search").fill(GUIDE.topics[0].title);
    assert.equal(await page.locator("#housing").isVisible(), true);
    assert.ok(await page.locator("#offline-banner").isVisible(), "the PWA identifies the saved offline copy");
    await capture(page, "student-life-offline"); await close(fixture);
    ok("the actual service worker precaches both pages/assets and their first-visited data works offline, including routes, city links and search");

    assert.deepEqual(forbidden, [], "there were no external requests, submissions or uploads");
    assert.deepEqual(errors, [], "there were no unexpected script or resource errors");
    ok("all Life interactions preserved unrelated storage and made only public local GET requests without JavaScript errors");
    console.log(checks + " Life browser checks passed");
  } catch (error) {
    console.error("Failed scenario:", label);
    if (lastPage && !lastPage.isClosed()) {
      try { await capture(lastPage, "failure-" + label); } catch (_) { /* Preserve the original assertion. */ }
    }
    throw error;
  } finally {
    await Promise.allSettled([...contexts].map((context) => context.close()));
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
