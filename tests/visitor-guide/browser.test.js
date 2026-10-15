// Visitor Guide interactions, accessibility, privacy and real PWA offline checks.
// Run: node tests/visitor-guide/browser.test.js .
// All fixtures are fictional. No forms, messages, accounts or external links are used.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "../.."));
const SHOTS = path.resolve(process.env.VISITOR_SCREENSHOT_DIR || path.join(ROOT, "work/visitor-verification"));
const PREFIX = "/eu-hem-student-hub/";
const GUIDE = JSON.parse(fs.readFileSync(path.join(ROOT, "content/visitor-guide.json"), "utf8"));
const CHAPTERS = ["welcome", "plan", "learn", "tools", "research", "life", "community", "project"];
const GROUPS = ["Study", "Resources", "Community", "Life", "About"];
const STATUSES = ["available", "preview", "demo", "not-open"];
const SCENES = [
  { id: "plan", href: "studyplan.html" },
  { id: "learn", href: "notes.html" },
  { id: "tools", href: "toolkit.html?section=workbench" },
  { id: "research", href: "thesis.html#guide-roadmap" },
  { id: "life", href: "student-life.html" },
  { id: "community", href: "experiences.html" }
];
const navSource = fs.readFileSync(path.join(ROOT, "site-nav.js"), "utf8"), sandbox = {};
vm.runInNewContext(navSource.slice(navSource.indexOf("const SITE_MENU"), navSource.indexOf("// An icon")) + "\nthis.menu = SITE_MENU;", sandbox);
const MENU = JSON.parse(JSON.stringify(sandbox.menu));
const EXPECTED = MENU.flatMap((group) => group.items.filter((item) => item.key !== "visitor-guide").map((item) => ({
  id: item.key, href: item.href, group: group.label,
  status: item.key === "students" ? "demo" : item.key === "join" ? "not-open" : item.preview ? "preview" : "available"
}))).concat(GUIDE.extras.map((item) => ({ id: item.id, href: item.href, group: item.group, status: item.status })));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".csv": "text/csv", ".webmanifest": "application/manifest+json", ".md": "text/markdown" };
const SENTINEL = "euhem-visitor-fictional-qa-sentinel";
const contexts = new Set(), errors = [], forbidden = [];
let browser, lastPage, label = "startup", checks = 0;
const ok = (message) => { checks++; console.log("  ok  " + message); };
const cards = (page) => page.locator("#visitor-directory .visitor-feature");
const visible = (page) => page.locator("#visitor-directory .visitor-feature:visible");

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
  await page.waitForFunction(() => document.getElementById("visitor-main")?.getAttribute("aria-busy") === "false" &&
    document.querySelectorAll("#visitor-directory .visitor-feature").length > 0);
}
async function capture(page, name, inline = false) {
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo({ top: 0, behavior: "instant" }); });
  const file = path.join(SHOTS, name + ".png");
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
  if (inline && process.env.VISITOR_INLINE_PREVIEWS === "1")
    console.log("VISITOR_PREVIEW " + JSON.stringify({ name, data: (await page.screenshot({ fullPage: false, animations: "disabled" })).toString("base64") }));
}
async function noSideways(page, message) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, message + ": " + overflow + "px horizontal overflow");
}
async function chapter(page, id) {
  await page.waitForFunction((target) => {
    const heading = document.querySelector("#" + target + " h2");
    return heading && heading === document.activeElement && !heading.closest(".visitor-chapter").hidden;
  }, id);
  assert.equal(await page.locator("#visitor-deck .visitor-chapter:visible").count(), 1);
  assert.equal(await page.locator("#visitor-position").innerText(), (CHAPTERS.indexOf(id) + 1) + " / 8");
  assert.equal(new URL(page.url()).hash, "#" + id);
  assert.equal(await page.locator('[data-visitor-chapter="' + id + '"]').first().getAttribute("aria-current"), "step");
}
async function selectChapter(page, id) {
  await page.locator('[data-visitor-chapter="' + id + '"]').first().focus();
  await page.keyboard.press("Enter"); await chapter(page, id);
}
async function resultCount(page, count) {
  assert.equal(await visible(page).count(), count);
  assert.match(await page.locator("#visitor-results").innerText(), new RegExp("\\b" + count + "\\b"), "the live result count follows visible features");
  assert.equal(await page.locator("#visitor-empty").isVisible(), count === 0);
}
async function close(fixture) {
  assert.equal(await fixture.page.evaluate((key) => localStorage.getItem(key), SENTINEL), "keep this fictional value");
  const writes = await fixture.page.evaluate(() => window.__visitorQaWrites);
  assert.deepEqual(writes, [], "tour, filters and route choices do not write, remove or clear browser storage");
  await fixture.context.close(); contexts.delete(fixture.context);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = http.createServer(serve);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = "http://127.0.0.1:" + server.address().port, base = origin + PREFIX;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined) });
    const open = async ({ hash = "", width = 1440, scheme = "light", scripts = true, dataIssue = "", offline = false, holdData = false, clock = false } = {}) => {
      const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 1000 }, colorScheme: scheme,
        locale: "en-GB", reducedMotion: "reduce", serviceWorkers: offline ? "allow" : "block", javaScriptEnabled: scripts });
      contexts.add(context); context.setDefaultTimeout(12000);
      await context.addInitScript((sentinel) => {
        localStorage.setItem(sentinel, "keep this fictional value");
        window.__visitorQaWrites = [];
        for (const method of ["setItem", "removeItem", "clear"]) {
          const original = Storage.prototype[method];
          Storage.prototype[method] = function (...args) {
            window.__visitorQaWrites.push({ method, key: args[0] || null });
            return original.apply(this, args);
          };
        }
      }, SENTINEL);
      let attempts = 0, releaseData;
      const dataGate = holdData ? new Promise((resolve) => { releaseData = resolve; }) : null;
      const failedPaths = new Set();
      const unsafe = (request) => {
        const url = new URL(request.url());
        return url.origin !== origin || !url.pathname.startsWith(PREFIX) || request.method() !== "GET" || request.postData() !== null;
      };
      context.on("request", (request) => { if (unsafe(request)) forbidden.push(request.method() + " " + request.url()); });
      // Keep the actual service-worker scenario free of interception.
      if (!offline) await context.route("**/*", async (route) => {
        const request = route.request(), url = new URL(request.url());
        if (unsafe(request)) return route.abort();
        if (dataGate && url.pathname === PREFIX + "content/visitor-guide.json") await dataGate;
        if (url.pathname === PREFIX + "content/visitor-guide.json" && ++attempts === 1 && dataIssue) {
          if (dataIssue === "http") {
            failedPaths.add(url.pathname);
            return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Fictional temporary failure"}' });
          }
          return route.fulfill({ status: 200, contentType: "application/json",
            body: dataIssue === "syntax" ? '{"fictional":' : '{"version":1,"chapters":[],"routes":[],"extras":[]}' });
        }
        return route.continue();
      });
      const page = await context.newPage(); lastPage = page;
      if (clock) await page.clock.install();
      page.on("pageerror", (error) => errors.push(label + ": " + error.message));
      page.on("response", (response) => {
        if (response.status() >= 400 && !failedPaths.has(new URL(response.url()).pathname)) errors.push(label + ": HTTP " + response.status() + " " + response.url());
      });
      await page.goto(base + "visitor-guide.html" + (hash ? "#" + hash : ""), { waitUntil: "domcontentloaded" });
      if (scripts && !dataIssue && !holdData) await ready(page);
      return { page, context, releaseData };
    };

    label = "tour-keyboard-history";
    let fixture = await open(), page = fixture.page;
    assert.equal(await page.locator("body.visitor-page").count(), 1);
    assert.equal(await page.locator("#visitor-deck .visitor-chapter:visible").count(), 1);
    assert.equal(await page.locator("#visitor-prev").isDisabled(), true);
    assert.equal(await page.locator("#visitor-position").innerText(), "1 / 8");
    assert.equal(await page.locator("#visitor-tour-status").getAttribute("role"), "status");
    assert.equal(await page.locator("#visitor-results").getAttribute("role"), "status");
    assert.equal(await page.locator('.menu-dropdown a[href="visitor-guide.html"]').getAttribute("aria-current"), "page");
    await page.locator("#visitor-next").focus(); await page.keyboard.press("Enter"); await chapter(page, "plan");
    await page.locator("#visitor-next").focus(); await page.keyboard.press("Space"); await chapter(page, "learn");
    await page.goBack(); await chapter(page, "plan");
    await page.goForward(); await chapter(page, "learn");
    await selectChapter(page, "project");
    assert.equal(await page.locator("#visitor-next").isDisabled(), true);
    await page.locator("#visitor-prev").focus(); await page.keyboard.press("Enter"); await chapter(page, "community");
    await selectChapter(page, "welcome");
    assert.equal(await page.locator("#visitor-prev").isDisabled(), true);
    await capture(page, "visitor-desktop-1440-light", true); await close(fixture);
    ok("native keyboard navigation, bounded previous/next, live position, history and heading focus work together");

    label = "direct-chapter-links";
    fixture = await open({ hash: "tools" }); page = fixture.page; await chapter(page, "tools");
    await page.evaluate(() => { location.hash = "research"; }); await chapter(page, "research");
    await close(fixture);
    fixture = await open({ hash: "fictional-unknown-chapter" }); page = fixture.page;
    assert.equal(await page.locator("#welcome").isVisible(), true);
    assert.equal(await page.locator("#visitor-position").innerText(), "1 / 8");
    await close(fixture);
    ok("direct and changed chapter fragments select and focus useful content; unknown fragments keep the guide usable");

    label = "view-all-and-print";
    fixture = await open({ hash: "research" }); page = fixture.page; await chapter(page, "research");
    await page.locator('[data-visitor-scene="tools"]').click();
    const beforePrintScene = await page.locator('[data-visitor-scene][aria-pressed="true"]').getAttribute("data-visitor-scene");
    for (const all of [false, true]) {
      if (all) await page.locator("#visitor-all").click();
      assert.equal(await page.locator("#visitor-all").getAttribute("aria-pressed"), String(all));
      const before = await page.locator("#visitor-deck .visitor-chapter").evaluateAll((items) => items.map((item) => ({ id: item.id, hidden: item.hidden })));
      const beforeURL = page.url();
      await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.locator("#visitor-deck .visitor-chapter:visible").count(), 8, "the printed guide includes every chapter");
      await page.emulateMedia({ media: "screen" });
      await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
      assert.deepEqual(await page.locator("#visitor-deck .visitor-chapter").evaluateAll((items) => items.map((item) => ({ id: item.id, hidden: item.hidden }))), before);
      assert.equal(page.url(), beforeURL, "printing preserves the chapter link");
      assert.equal(await page.locator('[data-visitor-scene][aria-pressed="true"]').getAttribute("data-visitor-scene"), beforePrintScene,
        "printing preserves the selected illustrative preview");
      assert.equal(await page.locator(".vg-showcase-scene:visible").count(), 1);
      assert.equal(await page.locator("#visitor-all").getAttribute("aria-pressed"), String(all));
    }
    await page.locator("#visitor-all").click();
    assert.equal(await page.locator("#visitor-deck .visitor-chapter:visible").count(), 1);
    assert.equal(await page.locator("#research").isVisible(), true);
    await close(fixture);
    ok("read-as-document mode shows all eight chapters; print includes them and restores either reading mode and the current chapter");

    label = "audience-routes";
    fixture = await open(); page = fixture.page;
    assert.equal(await page.locator('[data-visitor-route="student"]').getAttribute("aria-pressed"), "true");
    for (const route of GUIDE.routes) {
      const control = page.locator('[data-visitor-route="' + route.id + '"]');
      await control.focus(); await page.keyboard.press("Enter");
      assert.equal(await control.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('[data-visitor-route][aria-pressed="true"]').count(), 1);
      assert.deepEqual(await page.locator("#visitor-route-links a").evaluateAll((items) => items.map((item) => item.getAttribute("href"))), route.links.map((item) => item.href));
      assert.equal(new URL(page.url()).search, "", "route choices do not enter the address");
    }
    assert.deepEqual(await page.evaluate(() => window.__visitorQaWrites), [], "changing each audience route does not mutate storage");
    await page.reload({ waitUntil: "domcontentloaded" }); await ready(page);
    assert.equal(await page.locator('[data-visitor-route="student"]').getAttribute("aria-pressed"), "true", "audience preference is in memory only");
    await close(fixture);
    ok("all three audience choices change suggested links with one pressed button and reset on reload without storage");

    label = "interactive-feature-showcase";
    fixture = await open({ hash: "learn", clock: true }); page = fixture.page; await chapter(page, "learn");
    assert.equal(await page.locator('[data-visitor-scene="plan"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#visitor-showcase-position").innerText(), "01 / 06");
    assert.equal(await page.locator("[data-visitor-scene]").count(), 6);
    assert.equal(await page.locator(".vg-showcase-scene").count(), 6);
    assert.equal(await page.locator("#visitor-showcase-panel").count(), 1);
    assert.equal(await page.getByText("Illustrative feature previews", { exact: true }).isVisible(), true);
    const showcaseStatus = page.locator("#visitor-showcase-status");
    const showcaseLive = await showcaseStatus.getAttribute("aria-live");
    assert.ok(showcaseLive === "polite" || (showcaseLive === null && await showcaseStatus.getAttribute("role") === "status"),
      "scene changes have a polite live announcement without an assertive override");
    let previousSceneStatus = await showcaseStatus.innerText();
    const showcaseURL = page.url();
    for (const [index, scene] of SCENES.entries()) {
      const control = page.locator('[data-visitor-scene="' + scene.id + '"]');
      assert.equal(await control.getAttribute("aria-controls"), "visitor-showcase-panel");
      assert.equal(await control.isEnabled(), true);
      await control.focus(); await page.keyboard.press(index % 2 ? "Space" : "Enter");
      const active = page.locator('.vg-showcase-scene[data-scene="' + scene.id + '"]');
      await active.waitFor({ state: "visible" });
      assert.equal(await page.locator(".vg-showcase-scene:visible").count(), 1);
      assert.equal(await control.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('[data-visitor-scene][aria-pressed="true"]').count(), 1);
      assert.ok((await active.locator("h3").innerText()).trim().length > 3);
      assert.ok((await active.locator(".vg-showcase-description").innerText()).trim().length > 20);
      assert.equal(await active.locator(".vg-showcase-link").getAttribute("href"), scene.href);
      assert.equal(await page.locator("#visitor-showcase-position").innerText(), String(index + 1).padStart(2, "0") + " / 06");
      const currentSceneStatus = await showcaseStatus.innerText();
      assert.ok(currentSceneStatus.trim().length > 3);
      if (index > 0) assert.notEqual(currentSceneStatus, previousSceneStatus, "changing the preview updates its live announcement");
      previousSceneStatus = currentSceneStatus;
      assert.equal(page.url(), showcaseURL, "preview choices do not change the address or current chapter");
      assert.equal(await page.locator("#visitor-position").innerText(), "3 / 8");
      assert.equal(await page.locator("#learn").isVisible(), true);
      assert.equal(await page.locator("#visitor-deck .visitor-chapter:visible").count(), 1);
      assert.equal(await page.getByText("Illustrative feature previews", { exact: true }).isVisible(), true);
    }
    await page.locator('[data-visitor-scene="tools"]').click();
    await page.clock.fastForward(120000);
    assert.equal(await page.locator('[data-visitor-scene="tools"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('.vg-showcase-scene[data-scene="tools"]').isVisible(), true);
    assert.equal(await page.locator("#visitor-showcase-position").innerText(), "03 / 06", "previews do not advance automatically after two virtual minutes");
    assert.equal(page.url(), showcaseURL);
    await close(fixture);
    ok("all six clearly labelled illustrative previews support Enter and Space, update their scene and real destination, and preserve the chapter and address without autoplay");

    label = "directory-views-and-category-shortcuts";
    fixture = await open(); page = fixture.page;
    assert.equal(await page.locator("#visitor-directory").getAttribute("data-view"), "grid");
    assert.equal(await page.locator('[data-visitor-view="grid"]').getAttribute("aria-pressed"), "true");
    const shortcutRows = await cards(page).evaluateAll((items) => items.map((item) => ({
      id: item.dataset.featureId, group: item.dataset.group, status: item.dataset.status, text: item.textContent.toLowerCase()
    })));
    const directoryURL = page.url();
    await page.locator("#visitor-search").fill("thesis");
    await page.locator("#visitor-status-filter").selectOption("available");
    for (const group of ["all", ...GROUPS]) {
      const chip = page.locator('[data-visitor-group="' + group + '"]');
      await chip.focus(); await page.keyboard.press("Space");
      assert.equal(await chip.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('[data-visitor-group][aria-pressed="true"]').count(), 1);
      assert.equal(await page.locator("#visitor-group").inputValue(), group);
      assert.equal(await page.locator("#visitor-search").inputValue(), "thesis", "category shortcuts preserve search");
      assert.equal(await page.locator("#visitor-status-filter").inputValue(), "available", "category shortcuts preserve maturity");
      const expected = shortcutRows.filter((item) => (group === "all" || item.group === group) && item.status === "available" && item.text.includes("thesis"));
      assert.deepEqual(await visible(page).evaluateAll((items) => items.map((item) => item.dataset.featureId)), expected.map((item) => item.id));
      await resultCount(page, expected.length);
    }
    await page.locator("#visitor-group").selectOption("Resources");
    assert.equal(await page.locator('[data-visitor-group="Resources"]').getAttribute("aria-pressed"), "true", "the native select also updates category shortcuts");
    const beforeViewChange = await visible(page).evaluateAll((items) => items.map((item) => item.dataset.featureId));
    assert.ok(beforeViewChange.length > 0, "the layout comparison uses real matching destinations");
    for (const view of ["list", "grid", "list"]) {
      const control = page.locator('[data-visitor-view="' + view + '"]');
      await control.focus(); await page.keyboard.press(view === "list" ? "Enter" : "Space");
      assert.equal(await page.locator("#visitor-directory").getAttribute("data-view"), view);
      assert.equal(await control.getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('[data-visitor-view][aria-pressed="true"]').count(), 1);
      assert.deepEqual(await visible(page).evaluateAll((items) => items.map((item) => item.dataset.featureId)), beforeViewChange,
        "changing the directory layout preserves the combined filter result");
      await resultCount(page, beforeViewChange.length);
      const geometry = await visible(page).evaluateAll((items) => items.slice(0, 3).map((item) => {
        const box = item.getBoundingClientRect(); return { top: box.top, bottom: box.bottom };
      }));
      assert.equal(geometry.length, 3, "the layout comparison has at least three matching destinations");
      if (view === "list") assert.ok(geometry[2].top >= geometry[0].bottom - 1, "the compact desktop list starts a new row after two destinations");
      else assert.ok(Math.abs(geometry[0].top - geometry[2].top) <= 1, "the desktop grid places three matching destinations in its first row");
    }
    await page.locator("#visitor-reset").click(); await resultCount(page, EXPECTED.length);
    assert.equal(await page.locator('[data-visitor-group="all"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#visitor-directory").getAttribute("data-view"), "list", "resetting filters preserves the chosen layout");
    assert.equal(page.url(), directoryURL, "category and layout choices stay out of the address");
    await close(fixture);
    ok("category shortcuts stay in sync with the select while retaining search and maturity; grid/list views retain results and reset affects filters");

    label = "complete-directory-and-maturity";
    fixture = await open(); page = fixture.page;
    assert.equal(await cards(page).count(), EXPECTED.length);
    const actual = await cards(page).evaluateAll((items) => items.map((item) => ({
      id: item.dataset.featureId, href: item.querySelector(".visitor-feature-link").getAttribute("href"),
      group: item.dataset.group, status: item.dataset.status
    })));
    assert.deepEqual(actual.slice().sort((a, b) => a.id.localeCompare(b.id)), EXPECTED.slice().sort((a, b) => a.id.localeCompare(b.id)),
      "the directory includes every current shared-menu entry and each editorial extra exactly once");
    assert.equal(await page.locator('#visitor-directory [data-feature-id="visitor-guide"]').count(), 0);
    assert.match(await page.locator('#visitor-directory [data-feature-id="students"]').innerText(), /demo|fictional/i);
    assert.match(await page.locator('#visitor-directory [data-feature-id="join"]').innerText(), /not open|closed|unavailable/i);
    for (const status of STATUSES) {
      await page.locator("#visitor-status-filter").selectOption(status);
      await resultCount(page, EXPECTED.filter((item) => item.status === status).length);
      assert.ok((await visible(page).evaluateAll((items) => items.map((item) => item.dataset.status))).every((value) => value === status));
    }
    await page.locator("#visitor-reset").click(); await resultCount(page, EXPECTED.length);
    for (const group of GROUPS) {
      await page.locator("#visitor-group").selectOption(group);
      await resultCount(page, EXPECTED.filter((item) => item.group === group).length);
    }
    await close(fixture);
    ok("the feature directory follows the complete current menu and extras, with separate preview, fictional-demo and closed statuses");

    label = "combined-search-filters-empty-reset";
    fixture = await open(); page = fixture.page;
    const allRows = await cards(page).evaluateAll((items) => items.map((item) => ({
      id: item.dataset.featureId, group: item.dataset.group, status: item.dataset.status, text: item.textContent.toLowerCase()
    })));
    await page.locator("#visitor-search").fill("timetable");
    await page.locator("#visitor-group").selectOption("Study");
    await page.locator("#visitor-status-filter").selectOption("available");
    const matching = allRows.filter((item) => item.group === "Study" && item.status === "available" && item.text.includes("timetable"));
    assert.ok(matching.length > 0, "the combined positive fixture has real results");
    assert.deepEqual(await visible(page).evaluateAll((items) => items.map((item) => item.dataset.featureId)), matching.map((item) => item.id));
    await resultCount(page, matching.length);
    await page.locator("#visitor-search").fill("fictional-no-guide-feature-can-match-this-private-query");
    await resultCount(page, 0);
    assert.match(await page.locator("#visitor-empty").innerText(), /no|nothing|try|match/i);
    assert.ok(!page.url().includes("fictional-no-guide-feature"), "search text is absent from the URL");
    assert.equal(new URL(page.url()).search, "");
    await page.locator("#visitor-reset").click();
    assert.equal(await page.locator("#visitor-search").inputValue(), "");
    assert.equal(await page.locator("#visitor-group").inputValue(), "all");
    assert.equal(await page.locator("#visitor-status-filter").inputValue(), "all");
    await resultCount(page, EXPECTED.length); await close(fixture);
    ok("search, group and status filters form an intersection, announce an explicit empty state, and reset together without publishing the query");

    label = "content-failure-retry";
    fixture = await open({ holdData: true }); page = fixture.page;
    try {
      await page.locator('[data-visitor-scene="tools"]').click();
      assert.equal(await page.locator('.vg-showcase-scene[data-scene="tools"]').isVisible(), true);
      assert.equal(await page.locator("#visitor-main").getAttribute("aria-busy"), "true",
        "local previews are interactive while the editorial JSON request is still pending");
    } finally { fixture.releaseData(); }
    await ready(page); await close(fixture);
    for (const dataIssue of ["http", "syntax", "schema"]) {
      fixture = await open({ dataIssue }); page = fixture.page;
      await page.locator("#visitor-retry").waitFor();
      assert.equal(await page.locator("#visitor-main").getAttribute("aria-busy"), "false");
      assert.equal(await page.locator("#visitor-deck .visitor-chapter:visible").count(), 8, "a failed enhancement keeps the complete static guide");
      if (dataIssue === "http") {
        await page.locator('[data-visitor-scene="life"]').click();
        assert.equal(await page.locator('.vg-showcase-scene[data-scene="life"]').isVisible(), true,
          "the local illustrative showcase works even when editorial JSON is unavailable");
      }
      for (const href of ["timetable.html", "notes.html", "toolkit.html", "support.html"])
        assert.ok(await page.locator('main a[href="' + href + '"]').count() > 0, "fallback keeps " + href);
      await page.locator("#visitor-retry").click(); await ready(page);
      assert.equal(await page.locator("#visitor-retry").isVisible(), false);
      assert.equal(await cards(page).count(), EXPECTED.length);
      assert.equal(await page.locator("#visitor-deck .visitor-chapter:visible").count(), 1);
      await close(fixture);
    }
    ok("HTTP failure, malformed JSON and invalid schema retain stable public guidance and recover through Retry");

    label = "no-javascript";
    fixture = await open({ scripts: false }); page = fixture.page;
    assert.equal(await page.locator("#visitor-deck .visitor-chapter:visible").count(), 8);
    assert.equal(await page.getByText("Illustrative feature previews", { exact: true }).isVisible(), true);
    assert.equal(await page.locator(".vg-showcase-scene:visible").count(), 1);
    assert.equal(await page.locator('.vg-showcase-scene[data-scene="plan"]').isVisible(), true);
    assert.equal(await page.locator('.vg-showcase-scene[data-scene="plan"] .vg-showcase-link').getAttribute("href"), "studyplan.html");
    assert.ok((await page.locator('.vg-showcase-scene[data-scene="plan"] .vg-showcase-description').innerText()).trim().length > 20);
    assert.equal(await page.locator("[data-visitor-scene]").count(), 6, "all six scene controls are present in the static page");
    assert.ok(await page.locator("[data-visitor-scene]").evaluateAll((items) => items.every((item) => item.tagName === "BUTTON" && item.disabled)),
      "script-free showcase controls are disabled native buttons");
    for (const id of CHAPTERS) {
      assert.ok((await page.locator("#" + id).innerText()).trim().length > 80, id + " has meaningful static text");
      assert.ok(await page.locator('#' + id + ' a[href$=".html"], #' + id + ' a[href*=".html#"], #' + id + ' a[href*=".html?"]').count() > 0, id + " has real next steps");
    }
    await page.locator('[data-visitor-chapter="life"]').first().click();
    assert.equal(new URL(page.url()).hash, "#life", "native chapter links still navigate without scripts");
    await fixture.context.close(); contexts.delete(fixture.context);
    ok("without JavaScript, eight substantial chapters and their normal local links remain readable");

    label = "responsive-themes-and-keyboard";
    for (const width of [320, 390, 768, 1440]) for (const scheme of ["light", "dark"]) {
      fixture = await open({ width, scheme }); page = fixture.page;
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")), scheme);
      await noSideways(page, width + " " + scheme + " tour");
      const longestScene = await page.locator(".vg-showcase-scene").evaluateAll((items) =>
        items.map((item) => ({ id: item.dataset.scene, length: item.querySelector(".vg-showcase-description").textContent.length }))
          .sort((a, b) => b.length - a.length)[0].id);
      await page.locator('[data-visitor-scene="' + longestScene + '"]').click();
      await page.locator('.vg-showcase-scene[data-scene="' + longestScene + '"]').waitFor({ state: "visible" });
      await noSideways(page, width + " " + scheme + " longest illustrative preview");
      await page.locator("#visitor-search").focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
      assert.equal(await page.locator("#visitor-search").evaluate((element) => document.activeElement === element), true);
      const focus = await page.locator("#visitor-search").evaluate((element) => {
        const css = getComputedStyle(element); return { outline: css.outlineStyle, width: css.outlineWidth, shadow: css.boxShadow };
      });
      assert.ok((focus.outline !== "none" && parseFloat(focus.width) > 0) || focus.shadow !== "none", "keyboard focus is visible");
      assert.ok(await page.locator(".skip-link").count() > 0);
      await page.locator("#visitor-all").click();
      assert.equal(await page.locator("#visitor-deck .visitor-chapter:visible").count(), 8);
      await noSideways(page, width + " " + scheme + " full guide");
      for (const view of ["list", "grid"]) {
        await page.locator('[data-visitor-view="' + view + '"]').click();
        assert.equal(await page.locator("#visitor-directory").getAttribute("data-view"), view);
        await noSideways(page, width + " " + scheme + " " + view + " directory");
      }
      await page.locator("#visitor-search").fill("fictional-no-feature-can-match");
      await resultCount(page, 0); await noSideways(page, width + " " + scheme + " empty directory");
      await page.locator("#visitor-reset").click(); await page.locator("#visitor-all").click();
      await capture(page, "visitor-" + width + "-" + scheme, width === 390 && scheme === "dark");
      await close(fixture);
    }
    ok("320px, 390px, tablet and desktop layouts fit both themes, including the longest preview, both directory views, full-document and empty states, with visible keyboard focus");

    label = "actual-service-worker-offline";
    fixture = await open({ offline: true }); page = fixture.page;
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 45000 });
    await page.reload({ waitUntil: "domcontentloaded" }); await ready(page);
    await page.waitForFunction(async () => {
      const siteName = (await caches.keys()).find((key) => key.startsWith("site-"));
      if (!siteName) return false;
      const site = await caches.open(siteName), data = await caches.open("data");
      const sitePaths = (await site.keys()).map((request) => new URL(request.url).pathname);
      const dataPaths = (await data.keys()).map((request) => new URL(request.url).pathname);
      return ["visitor-guide.html", "visitor-guide.css", "visitor-guide.js"].every((file) => sitePaths.some((item) => item.endsWith("/" + file))) &&
        dataPaths.some((item) => item.endsWith("/content/visitor-guide.json"));
    });
    await fixture.context.setOffline(true);
    assert.equal(await page.evaluate(async () => {
      try { await fetch("visitor-offline-uncached-fictional-probe.txt", { cache: "no-store" }); return false; }
      catch { return true; }
    }), true, "an uncached local network request really fails offline");
    await page.reload({ waitUntil: "domcontentloaded" }); await ready(page);
    await page.locator('[data-visitor-scene="community"]').click();
    assert.equal(await page.locator('.vg-showcase-scene[data-scene="community"]').isVisible(), true, "illustrative previews work from the saved local assets");
    await page.locator('[data-visitor-view="list"]').click();
    assert.equal(await page.locator("#visitor-directory").getAttribute("data-view"), "list");
    await selectChapter(page, "life");
    await page.locator('[data-visitor-route="exploring"]').click();
    assert.deepEqual(await page.locator("#visitor-route-links a").evaluateAll((items) => items.map((item) => item.getAttribute("href"))),
      GUIDE.routes.find((route) => route.id === "exploring").links.map((item) => item.href));
    await page.locator("#visitor-group").selectOption("Resources");
    await resultCount(page, EXPECTED.filter((item) => item.group === "Resources").length);
    await page.locator("#visitor-search").fill("fictional-no-offline-feature"); await resultCount(page, 0);
    await page.locator("#visitor-reset").click(); await resultCount(page, EXPECTED.length);
    assert.ok(await page.locator("#offline-banner").isVisible(), "the PWA identifies the saved offline copy");
    await capture(page, "visitor-offline"); await close(fixture);
    ok("the actual service worker caches the guide and data; tour, audience routes and combined directory filters work after an offline reload");

    assert.deepEqual(forbidden, [], "there were no external requests, submissions or uploads");
    assert.deepEqual(errors, [], "there were no unexpected script or resource errors");
    ok("all scenarios preserved unrelated storage and used only local public GET requests");
    console.log(checks + " Visitor Guide browser checks passed");
  } catch (error) {
    console.error("Failed scenario:", label);
    if (lastPage && !lastPage.isClosed()) {
      try { await capture(lastPage, "failure-" + label); } catch (_) { /* Keep the original failure. */ }
    }
    throw error;
  } finally {
    await Promise.allSettled([...contexts].map((context) => context.close()));
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
