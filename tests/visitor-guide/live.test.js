// Read-only verification of the exact published Visitor Guide commit.
// Browses public local information only: no forms, accounts, messages or uploads.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "../..");
const BASE = "https://adnantarabishi.github.io/eu-hem-student-hub/";
const SHOTS = process.env.VISITOR_SCREENSHOT_DIR;
const GUIDE = JSON.parse(fs.readFileSync(path.join(ROOT, "content/visitor-guide.json"), "utf8"));
const source = fs.readFileSync(path.join(ROOT, "site-nav.js"), "utf8"), sandbox = {};
vm.runInNewContext(source.slice(source.indexOf("const SITE_MENU"), source.indexOf("// An icon")) + "\nthis.menu = SITE_MENU;", sandbox);
const MENU = JSON.parse(JSON.stringify(sandbox.menu));
const EXPECTED_COUNT = MENU.flatMap((group) => group.items).filter((item) => item.key !== "visitor-guide").length + GUIDE.extras.length;

(async () => {
  const expected = ["visitor-guide.html", "visitor-guide.css", "visitor-guide.js", "content/visitor-guide.json", "site-nav.js", "sw.js", "index.html"]
    .map((file) => ({ file, text: fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n") }));
  let matched = false;
  for (let attempt = 0; attempt < 25; attempt++) {
    const matches = await Promise.all(expected.map(async (asset) => {
      const response = await fetch(BASE + asset.file + "?verify=" + Date.now());
      return response.ok && (await response.text()).replace(/\r\n/g, "\n") === asset.text;
    }));
    if (matches.every(Boolean)) { matched = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 8000));
  }
  assert.ok(matched, "Published guide, data, navigation, homepage and PWA assets must match this commit before verification");
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined) });
  const errors = [], unsafeRequests = [];
  try {
    for (const scheme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme,
        locale: "en-GB", reducedMotion: "reduce", serviceWorkers: "block" });
      context.setDefaultTimeout(15000);
      try {
        await context.route("**/*", (route) => {
          const request = route.request(), url = new URL(request.url());
          if (request.method() !== "GET" || request.postData() !== null ||
            url.origin !== new URL(BASE).origin || !url.pathname.startsWith(new URL(BASE).pathname)) {
            unsafeRequests.push(request.method() + " " + request.url()); return route.abort();
          }
          return route.continue();
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("response", (response) => { if (response.status() >= 400) errors.push("HTTP " + response.status() + " " + response.url()); });
        const ready = () => page.waitForFunction(() => document.getElementById("visitor-main")?.getAttribute("aria-busy") === "false" &&
          document.querySelectorAll("#visitor-directory .visitor-feature").length > 0);
        const screenshot = async (file) => {
          await page.evaluate(async () => { await document.fonts.ready; window.scrollTo({ top: 0, behavior: "instant" }); });
          if (SHOTS) await page.screenshot({ path: path.join(SHOTS, file), fullPage: true, animations: "disabled" });
        };
        const focus = (id) => page.waitForFunction((target) => document.querySelector("#" + target + " h2") === document.activeElement, id);
        const fits = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, "the live guide fits its viewport");

        await page.goto(BASE + "visitor-guide.html#tools", { waitUntil: "domcontentloaded" }); await ready(); await focus("tools");
        assert.equal(await page.locator("#visitor-position").innerText(), "4 / 8");
        assert.equal(await page.locator("#visitor-deck .visitor-chapter:visible").count(), 1);
        assert.equal(await page.locator('.menu-dropdown a[href="visitor-guide.html"]').getAttribute("aria-current"), "page");
        assert.equal(await page.locator("#visitor-directory .visitor-feature").count(), EXPECTED_COUNT);
        await page.locator("#visitor-next").focus(); await page.keyboard.press("Enter"); await focus("research");
        assert.equal(new URL(page.url()).hash, "#research");
        await page.goBack(); await focus("tools");
        for (const route of GUIDE.routes) {
          await page.locator('[data-visitor-route="' + route.id + '"]').click();
          assert.equal(await page.locator('[data-visitor-route="' + route.id + '"]').getAttribute("aria-pressed"), "true");
          assert.deepEqual(await page.locator("#visitor-route-links a").evaluateAll((items) => items.map((item) => item.getAttribute("href"))), route.links.map((item) => item.href));
        }
        await page.locator("#visitor-group").selectOption("Resources");
        await page.locator("#visitor-status-filter").selectOption("preview");
        assert.ok(await page.locator("#visitor-directory .visitor-feature:visible").count() > 0);
        assert.ok((await page.locator("#visitor-directory .visitor-feature:visible").evaluateAll((items) => items.map((item) => ({ group: item.dataset.group, status: item.dataset.status }))))
          .every((item) => item.group === "Resources" && item.status === "preview"));
        await page.locator("#visitor-search").fill("fictional-no-published-feature-can-match");
        assert.equal(await page.locator("#visitor-directory .visitor-feature:visible").count(), 0);
        assert.equal(await page.locator("#visitor-empty").isVisible(), true);
        assert.equal(new URL(page.url()).search, "");
        await page.locator("#visitor-reset").click();
        assert.equal(await page.locator("#visitor-directory .visitor-feature:visible").count(), EXPECTED_COUNT);
        await fits(); await screenshot("live-visitor-desktop-" + scheme + ".png");

        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('[data-visitor-chapter="life"]').first().focus(); await page.keyboard.press("Enter"); await focus("life");
        await page.locator('[data-visitor-route="student"]').click();
        await page.locator("#visitor-group").selectOption("Life");
        await page.locator("#visitor-status-filter").selectOption("available");
        await page.locator("#visitor-search").fill("Bologna");
        assert.ok(await page.locator("#visitor-directory .visitor-feature:visible").count() > 0, "phone filters retain the matching Bologna guide");
        await fits();
        await page.locator("#visitor-reset").click();
        await page.locator("#visitor-all").click();
        assert.equal(await page.locator("#visitor-deck .visitor-chapter:visible").count(), 8);
        await fits(); await screenshot("live-visitor-phone-" + scheme + ".png");
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")), scheme);
      } finally { await context.close(); }
    }
    assert.deepEqual(unsafeRequests, [], "verification made only public GET requests to the deployed Hub");
    assert.deepEqual(errors, []);
    console.log("Published Visitor Guide assets matched this commit; tour/history/focus, three audience routes, combined directory filters, empty/reset states and phone layouts verified in both themes without submission.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
