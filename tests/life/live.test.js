// Read-only checks of the main deployment. These controls only browse public
// information; no forms, contact messages, account sessions or entries are sent.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "../..");
const BASE = "https://adnantarabishi.github.io/eu-hem-student-hub/";
const SHOTS = process.env.LIFE_SCREENSHOT_DIR;
const CITIES = ["bologna", "oslo", "innsbruck", "rotterdam"];

(async () => {
  const expected = ["student-life.html", "mobility-guide.html", "life.css", "life.js", "content/life-guide.json", "site-nav.js", "search.js", "content/tracks.json"]
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
  assert.ok(matched, "Published Life pages, guidance, route source and assets must match this commit before verification");
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined) });
  const errors = [], unsafeRequests = [];
  try {
    for (const scheme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme,
        locale: "en-GB", reducedMotion: "reduce", serviceWorkers: "block" });
      try {
        await context.route("**/*", (route) => {
          const request = route.request(), url = new URL(request.url());
          if (request.method() !== "GET" || request.postData() !== null || url.origin !== new URL(BASE).origin) {
            unsafeRequests.push(request.method() + " " + request.url()); return route.abort();
          }
          return route.continue();
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("response", (response) => { if (response.status() >= 400) errors.push("HTTP " + response.status() + " " + response.url()); });
        const ready = () => page.waitForFunction(() => document.getElementById("life-content")?.getAttribute("aria-busy") === "false");
        const screenshot = async (file) => {
          await page.evaluate(async () => { await document.fonts.ready; window.scrollTo({ top: 0, behavior: "instant" }); });
          if (SHOTS) await page.screenshot({ path: path.join(SHOTS, file), fullPage: true, animations: "disabled" });
        };
        await page.goto(BASE + "student-life.html?city=oslo#wellbeing", { waitUntil: "domcontentloaded" }); await ready();
        assert.equal(await page.locator("#life-city").inputValue(), "oslo");
        assert.equal(await page.locator("#life-topics > .life-topic:visible").count(), 6);
        assert.equal(await page.locator('.menu-dropdown a[href="student-life.html"]').getAttribute("aria-current"), "page");
        await page.locator("#life-search").fill("no-fictional-topic-can-match-this-phrase");
        assert.equal(await page.locator("#life-topics > .life-topic:visible").count(), 0);
        await page.locator("#life-reset").click();
        assert.equal(await page.locator("#life-topics > .life-topic:visible").count(), 6);
        await page.keyboard.press("Control+k");
        await page.locator(".search-dialog .search-input").fill("Housing & Renting Essentials");
        await page.locator('.search-result[href="student-life.html#housing"]').click();
        await page.waitForFunction(() => document.getElementById("housing")?.contains(document.activeElement));
        assert.equal(new URL(page.url()).hash, "#housing");
        await screenshot("live-student-life-desktop-" + scheme + ".png");
        await page.setViewportSize({ width: 390, height: 844 });
        for (const city of CITIES) {
          await page.locator("#life-city").selectOption(city);
          assert.equal(await page.locator("#life-topics > .life-topic:visible").count(), 6);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
        await screenshot("live-student-life-phone-" + scheme + ".png");
        await page.goto(BASE + "mobility-guide.html?city=rotterdam#arrival", { waitUntil: "domcontentloaded" }); await ready();
        await page.locator("#arrival[open]").waitFor();
        assert.equal(await page.locator("#life-city").inputValue(), "rotterdam");
        assert.equal(await page.locator('.menu-dropdown a[href="mobility-guide.html"]').getAttribute("aria-current"), "page");
        await page.locator("#life-track").selectOption("phm");
        assert.match(await page.locator("#life-route").innerText(), /Innsbruck[\s\S]*Rotterdam/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
        await screenshot("live-mobility-phone-" + scheme + ".png");
        await page.setViewportSize({ width: 1440, height: 1000 });
        await screenshot("live-mobility-desktop-" + scheme + ".png");
      } finally { await context.close(); }
    }
    assert.deepEqual(unsafeRequests, [], "the live check made only public GET requests to GitHub Pages");
    assert.deepEqual(errors, []);
    console.log("Published Life assets matched; both pages, city context, topic/global search, track routes, deep links, navigation and phone layouts verified in both themes without submission.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
