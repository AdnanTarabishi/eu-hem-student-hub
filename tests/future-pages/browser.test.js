// Public previews: real HTTP, keyboard navigation and offline checks.
// No real student records are used. External traffic and writes are blocked.
// Run: node tests/future-pages/browser.test.js .
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "../.."));
const OUTPUT = process.env.EUHEM_TEST_OUTPUT ? path.resolve(process.env.EUHEM_TEST_OUTPUT) : null;
const FILTER = process.env.EUHEM_TEST_FILTER || "";
const ROUTES = [
  { file: "beyond-euhem.html", group: "Resources", title: /Beyond EU-HEM/i, ids: ["career-paths", "opportunities", "alumni-paths", "prepare-apply", "further-study"], useful: "toolkit.html" },
  { file: "events.html", group: "Community", title: /Events/i, ids: ["upcoming", "activities", "past-events", "event-principles"], useful: "calendar.html" },
  { file: "gallery.html", group: "Community", title: /Gallery/i, ids: ["city-albums", "community-albums", "visibility", "contributions"], useful: "city-guide.html" },
];
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".csv": "text/csv", ".md": "text/markdown", ".ics": "text/calendar", ".webmanifest": "application/manifest+json" };
const ANNOUNCEMENTS = "Date,Title,Category,Message,Link,Pinned,Expires,Posted by\n2099-01-01,Fictional preview notice,Academic,Fictional browser fixture,,,,Test team\n";
const SENTINEL = "euhem-preview-test-sentinel";
const checks = [], contexts = new Set(), serverRequests = [];
let browser, server, origin;

async function createServer() {
  server = http.createServer((request, response) => {
    serverRequests.push({ method: request.method, url: request.url });
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
    catch (_) { response.writeHead(400); response.end("Bad request"); return; }
    if (pathname === "/data/announcements.csv") {
      response.writeHead(200, { "Content-Type": "text/csv", "Cache-Control": "no-store" });
      response.end(ANNOUNCEMENTS); return;
    }
    let file = path.resolve(ROOT, "." + pathname);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { response.writeHead(403); response.end("Forbidden"); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404); response.end("Not found"); return; }
      response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(data);
    });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  origin = "http://127.0.0.1:" + server.address().port;
}

async function fixture(route, { width = 1440, theme = "light", scripts = true, hash = "", offline = false, storageBlocked = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: "reduce", timezoneId: "Europe/Rome", javaScriptEnabled: scripts, serviceWorkers: offline ? "allow" : "block" });
  contexts.add(context);
  const external = [], forbidden = [], errors = [], missing = [];
  await context.route("**/*", (requestRoute) => {
    const request = requestRoute.request();
    if (new URL(request.url()).origin !== origin) { external.push(request.url()); return requestRoute.abort(); }
    if (request.method() !== "GET" || request.postData() !== null) { forbidden.push({ method: request.method(), url: request.url() }); return requestRoute.abort(); }
    return requestRoute.continue();
  });
  if (scripts) await context.addInitScript(({ sentinel, blocked }) => {
    window.__qaStorageWrites = [];
    if (blocked) {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Fictional storage denial", "SecurityError"); } });
    } else {
      localStorage.setItem(sentinel, "Fictional value; must remain untouched");
      for (const method of ["setItem", "removeItem", "clear"]) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args) { window.__qaStorageWrites.push({ method, key: args[0] || null }); return original.apply(this, args); };
      }
    }
  }, { sentinel: SENTINEL, blocked: storageBlocked });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.url().startsWith(origin) && response.status() >= 400) missing.push(response.url() + " -> " + response.status()); });
  await page.goto(origin + "/" + route.file + hash);
  await page.locator("main h1").waitFor({ state: "visible" });
  if (scripts) await page.locator('.fp-tabs [data-fp-tab][role="tab"]').first().waitFor();
  await page.evaluate(async () => document.fonts.ready);
  return { page, context, errors, missing, external, forbidden, scripts, storageBlocked, close: async () => { contexts.delete(context); await context.close(); } };
}

async function run(name, route, options, callback) {
  if (FILTER && !name.includes(FILTER)) return;
  const f = await fixture(route, options);
  try {
    await callback(f);
    assert.deepEqual(f.errors, [], "runtime errors");
    assert.deepEqual(f.missing, [], "missing local assets");
    assert.deepEqual(f.forbidden, [], "public previews must not send submissions");
    if (f.scripts && !f.storageBlocked) {
      assert.equal(await f.page.evaluate((key) => localStorage.getItem(key), SENTINEL), "Fictional value; must remain untouched");
      assert.deepEqual(await f.page.evaluate(() => window.__qaStorageWrites), [], "preview interactions must not save personal inputs or preferences");
    }
    checks.push(name); console.log("  ok  " + name);
  } catch (error) {
    await capture(f.page, "failed-" + name.replace(/[^a-z0-9]+/gi, "-"), true);
    console.error("Preview diagnostic", await f.page.evaluate(() => ({ url: location.href, width: innerWidth, nav: document.getElementById("site-nav")?.className, navVisibility: getComputedStyle(document.getElementById("site-nav")).visibility, menuExpanded: document.querySelector(".menu-toggle")?.getAttribute("aria-expanded"), activeElement: document.activeElement?.outerHTML, scrollWidth: document.documentElement.scrollWidth })));
    throw error;
  } finally { await f.close(); }
}

async function selected(page, id, focus = false) {
  await page.waitForFunction((target) => document.querySelector('[data-fp-tab][href="#' + target + '"]')?.getAttribute("aria-selected") === "true", id);
  assert.equal(await page.locator('[data-fp-tab][aria-selected="true"]').count(), 1);
  assert.equal(await page.locator('[data-fp-tab][tabindex="0"]').count(), 1);
  assert.equal(await page.locator('[data-fp-panel]:visible').count(), 1);
  assert.equal(await page.locator("#" + id).isVisible(), true);
  const tab = page.locator('[data-fp-tab][href="#' + id + '"]');
  assert.equal(await tab.getAttribute("aria-controls"), id);
  assert.equal(await page.locator("#" + id).getAttribute("role"), "tabpanel");
  assert.equal(await page.locator("#" + id).getAttribute("aria-labelledby"), await tab.getAttribute("id"));
  if (focus) assert.equal(await tab.evaluate((element) => element === document.activeElement), true, id + ": selected tab gets keyboard focus");
}

async function fits(page, label) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(extra <= 1, label + ": horizontal overflow by " + extra + "px");
  const unnamed = await page.locator("button:visible, main a:visible, main input:visible, main select:visible, main textarea:visible").evaluateAll((items) => items.filter((element) => {
    const labelled = element.getAttribute("aria-labelledby");
    const name = element.getAttribute("aria-label") || (labelled && labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ")) || element.textContent || element.getAttribute("title") || element.labels?.[0]?.textContent;
    return !String(name || "").trim();
  }).map((element) => element.outerHTML));
  assert.deepEqual(unnamed, [], label + ": visible controls need names");
}

async function capture(page, name, fullPage = false) {
  if (!OUTPUT) return;
  fs.mkdirSync(path.join(OUTPUT, "screenshots"), { recursive: true });
  await page.screenshot({ path: path.join(OUTPUT, "screenshots", name + ".png"), fullPage, animations: "disabled" });
}

(async () => {
  try {
    await createServer();
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
    for (const route of ROUTES) {
      await run(route.file + ": honest previews and useful existing resources", route, {}, async ({ page }) => {
        assert.match(await page.title(), route.title);
        assert.ok((await page.locator("main h1").innerText()).trim().length > 10, "meaningful page heading");
        assert.match(await page.locator("main").innerText(), /in development|under development|being developed|work in progress/i);
        assert.equal(await page.locator("main form, main input, main textarea, main select").count(), 0, "no data collection or unusable submission forms in previews");
        assert.equal(await page.locator("main button").count(), 0, "preview cards should not promise unavailable actions");
        assert.equal(await page.locator("main iframe").count(), 0, "no remote photo or alumni embeds");
        const links = await page.locator("main a[href]").evaluateAll((items) => items.map((element) => element.getAttribute("href")));
        assert.ok(links.some((href) => href.split(/[?#]/)[0] === route.useful), "useful live resource " + route.useful);
        for (const href of links) {
          if (href.startsWith("#") || /^https?:|^mailto:/.test(href)) continue;
          const local = new URL(href, origin + "/" + route.file);
          assert.ok(fs.existsSync(path.join(ROOT, decodeURIComponent(local.pathname))), "broken local preview link " + href);
        }
        const sprite = fs.readFileSync(path.join(ROOT, "icons.svg"), "utf8");
        const icons = await page.locator('svg use[href*="icons.svg#"]').evaluateAll((items) => items.map((element) => element.getAttribute("href").split("#")[1]));
        for (const icon of new Set(icons)) assert.ok(sprite.includes('id="' + icon + '"'), "unknown shared icon " + icon);
        if (route.file === "gallery.html") {
          assert.deepEqual(await page.locator('.fp-city-grid [data-city]').evaluateAll((items) => items.map((element) => element.dataset.city).sort()), ["bologna", "innsbruck", "oslo", "rotterdam"]);
          assert.equal(await page.locator("main img, main picture").count(), 0, "album concepts must not imply photographs are already published");
          assert.match(await page.locator("#visibility").textContent(), /verified EU-HEM members/i);
          assert.match(await page.locator("#visibility").textContent(), /protected photo storage/i);
          assert.match(await page.locator("#visibility").textContent(), /originals, thumbnails and downloads/i);
        }
        await selected(page, route.ids[0]);
      });

      await run(route.file + ": hash, keyboard tabs and browser history", route, { hash: "#" + route.ids[1] }, async ({ page }) => {
        await selected(page, route.ids[1]);
        const tabs = page.locator(".fp-tabs [data-fp-tab]");
        assert.equal(await tabs.count(), route.ids.length);
        assert.equal(await page.locator('.fp-tabs[role="tablist"]').count(), 1);
        await tabs.nth(1).focus();
        await page.keyboard.press("ArrowRight"); await selected(page, route.ids[2], true);
        await page.keyboard.press("End"); await selected(page, route.ids.at(-1), true);
        await page.keyboard.press("ArrowRight"); await selected(page, route.ids[0], true);
        await page.keyboard.press("ArrowLeft"); await selected(page, route.ids.at(-1), true);
        await page.keyboard.press("Home"); await selected(page, route.ids[0], true);
        await tabs.nth(1).click();
        assert.equal(new URL(page.url()).hash, "#" + route.ids[1]);
        await tabs.nth(2).click();
        assert.equal(new URL(page.url()).hash, "#" + route.ids[2]);
        await page.goBack(); await selected(page, route.ids[1]);
        await page.goForward(); await selected(page, route.ids[2]);
      });

      await run(route.file + ": ordinary in-page links activate planned sections", route, {}, async ({ page }) => {
        const hero = page.locator('.fp-hero a[href="#' + route.ids[0] + '"]');
        await hero.click(); await selected(page, route.ids[0]);
        if (route.file === "gallery.html") {
          await page.locator('.fp-hero a[href="#visibility"]').click();
          await selected(page, "visibility");
        }
        if (route.file === "beyond-euhem.html") {
          await page.locator('[data-fp-tab][href="#further-study"]').click();
          await page.locator('#further-study a[href="#opportunities"]').click();
          await selected(page, "opportunities");
        }
      });

      for (const width of [390, 1440]) await run(route.file + ": shared " + (width < 900 ? "mobile drawer" : "desktop menu") + " navigation", route, { width }, async ({ page }) => {
        const nav = page.locator("#site-nav");
        const current = nav.locator('a[href="' + route.file + '"][aria-current="page"]');
        assert.equal(await current.count(), 1);
        assert.equal(await page.locator('.site-footer a[href="' + route.file + '"]').count(), 1);
        if (width < 900) {
          await page.locator(".menu-toggle").click();
          assert.equal(await nav.getAttribute("aria-modal"), "true");
          await page.keyboard.press("Escape");
          assert.equal(await page.locator(".menu-toggle").getAttribute("aria-expanded"), "false");
          assert.equal(await page.locator(".menu-toggle").evaluate((element) => element === document.activeElement), true);
          await page.locator(".menu-toggle").click();
        }
        if (width >= 900) await nav.getByRole("button", { name: route.group, exact: true }).click();
        await current.waitFor({ state: "visible" });
        for (const item of ROUTES.filter((item) => item.group === route.group)) assert.equal(await nav.locator('a[href="' + item.file + '"]').isVisible(), true);
        await Promise.all([page.waitForURL(origin + "/" + route.file), current.click()]);
        await selected(page, route.ids[0]);
        assert.equal(await nav.evaluate((element) => element.classList.contains("is-open")), false);
      });

      await run(route.file + ": all planned content remains readable without JavaScript", route, { scripts: false, width: 390 }, async ({ page }) => {
        assert.equal(await page.locator("[data-fp-panel]:visible").count(), route.ids.length);
        for (const id of route.ids) {
          const panel = page.locator("#" + id);
          assert.equal(await panel.isVisible(), true, id + ": readable without scripts");
          assert.ok((await panel.innerText()).trim().length > 80, id + ": meaningful planned content");
        }
        assert.equal(await page.locator(".fp-tabs [data-fp-tab][role=tab]").count(), 0, "static anchors keep native link semantics");
        await fits(page, route.file + " no JS");
      });

      await run(route.file + ": unknown fragments and unavailable storage degrade safely", route, { hash: "#fictional-unknown-panel", storageBlocked: true }, async ({ page }) => {
        await selected(page, route.ids[0]);
        await page.locator('[data-fp-tab][href="#' + route.ids[1] + '"]').click();
        await selected(page, route.ids[1]);
      });

      for (const width of [320, 390, 768, 1440]) await run(route.file + ": " + width + "px light and dark layouts", route, { width }, async ({ page }) => {
        for (const theme of ["light", "dark"]) {
          await page.evaluate((mode) => { document.documentElement.dataset.theme = mode; }, theme);
          for (const id of route.ids) {
            await page.locator('[data-fp-tab][href="#' + id + '"]').click();
            await selected(page, id);
            await fits(page, route.file + "/" + id + " " + width + " " + theme);
          }
          await page.locator('[data-fp-tab][href="#' + route.ids[0] + '"]').click();
          await page.evaluate(() => window.scrollTo(0, 0));
          if (width === 390 || width === 1440) await capture(page, route.file.replace(".html", "") + "-" + width + "-" + theme, width === 390);
        }
      });
    }

    await run("site search labels planned alumni and Gallery visibility honestly", ROUTES[0], { storageBlocked: true }, async ({ page }) => {
      await page.locator(".header-actions .search-button").click();
      await page.locator(".search-input").fill("Alumni Paths");
      const alumni = page.locator('.search-results a[href="beyond-euhem.html#alumni-paths"]');
      await alumni.waitFor({ state: "visible" });
      assert.match(await alumni.locator(".search-result-meta").innerText(), /in development/i);
      await alumni.click(); await selected(page, "alumni-paths");
      await page.locator(".header-actions .search-button").click();
      await page.locator(".search-input").fill("Gallery visibility");
      const visibility = page.locator('.search-results a[href="gallery.html#visibility"]');
      await visibility.waitFor({ state: "visible" });
      assert.match(await visibility.locator(".search-result-meta").innerText(), /in development/i);
      await Promise.all([page.waitForURL(origin + "/gallery.html#visibility"), visibility.click()]);
      await selected(page, "visibility");
    });

    await run("three previews and shared files are precached and usable offline", ROUTES[0], { offline: true }, async ({ page, context }) => {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
      const paths = await page.evaluate(async () => {
        const key = (await caches.keys()).find((name) => name.startsWith("site-"));
        return (await (await caches.open(key)).keys()).map((request) => new URL(request.url).pathname);
      });
      for (const file of [...ROUTES.map((route) => route.file), "future-pages.css", "future-pages.js"]) assert.ok(paths.includes("/" + file), file + " needs offline precache");
      await context.setOffline(true);
      for (const route of ROUTES) {
        await page.goto(origin + "/" + route.file + "#" + route.ids[1], { waitUntil: "domcontentloaded" });
        assert.match(await page.title(), route.title);
        await selected(page, route.ids[1]);
        await page.locator('[data-fp-tab][href="#' + route.ids.at(-1) + '"]').click();
        await selected(page, route.ids.at(-1));
        await page.reload({ waitUntil: "domcontentloaded" });
        await selected(page, route.ids.at(-1));
        const nav = page.locator("#site-nav");
        await nav.getByRole("button", { name: route.group, exact: true }).click();
        assert.equal(await nav.locator('a[href="' + route.file + '"][aria-current="page"]').isVisible(), true);
      }
    });

    assert.ok(serverRequests.every((request) => request.method === "GET"), "public previews must not write to a receiver");
  } finally {
    await Promise.allSettled([...contexts].map((context) => context.close()));
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  }
  if (OUTPUT) {
    fs.mkdirSync(OUTPUT, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT, "browser-results.json"), JSON.stringify({ passed: checks.length, checks, harness: "Real local HTTP server and Chromium, actual service worker, no-JS fallback, fictional announcement fixture, external traffic blocked." }, null, 2));
  }
  console.log("PASS " + checks.length + " future-page browser checks");
})().catch((error) => { console.error(error); process.exitCode = 1; });
