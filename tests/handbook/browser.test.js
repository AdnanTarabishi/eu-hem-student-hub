// Handbook content in a real browser (installed Chrome): source labels in the Bologna guide and the
// study plan, key dates on the calendar page and the homepage, phones and dark mode.
// Run: node tests/handbook/browser.test.js .
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/markdown",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".ics": "text/calendar" };

(async () => {
  const site = http.createServer((req, res) => {
    const file = decodeURIComponent(req.url.split("?")[0].replace(/^\//, "")) || "index.html";
    const full = path.join(ROOT, file);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end("missing"); }
    res.writeHead(200, { "Content-Type": mime[path.extname(full)] || "text/plain" }); res.end(fs.readFileSync(full));
  }).listen(0);
  const base = `http://127.0.0.1:${site.address().port}/`;
  const browser = await chromium.launch({ channel: "chrome" });
  let n = 0; const ok = (name) => { n++; console.log("  ok  " + name); };
  const errors = [];

  // Every page opens on 6 October 2026 (so "next exam period" is stable) and without UniBo (no network in tests)
  const open = async (url, { viewport = { width: 1280, height: 900 }, scheme = "light" } = {}) => {
    const context = await browser.newContext({ viewport, colorScheme: scheme, serviceWorkers: "block" });
    await context.clock.setFixedTime(new Date("2026-10-06T10:00:00+02:00"));
    await context.route(/unibo\.it/, (route) => route.abort());
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(`${url}: ${e.message}`));
    await page.goto(base + url);
    return page;
  };
  const noSideways = async (page) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "scrolls sideways");

  try {
    // --- Bologna guide: {tip:…} markers become labels ---
    let page = await open("city-guide.html?city=bologna");
    await page.locator(".source-badge").first().waitFor({ state: "attached" });
    const badges = await page.$$eval(".source-badge", (els) => els.map((e) => [e.textContent, e.className]));
    assert.ok(badges.length >= 2, "two labels");
    assert.ok(badges.every(([text, cls]) => text === "Student tip · EU-HEM student reps" && cls.includes("is-tip")), JSON.stringify(badges));
    assert.ok(!(await page.evaluate(() => /\{(official|tip):/.test(document.body.textContent))), "a raw marker is left");
    const text = await page.evaluate(() => document.body.textContent);
    assert.ok(text.replace(/\s+/g, " ").includes("€161 for master's students like EU-HEM, at any age"), "bus pass");
    assert.ok(!text.includes("€161 / €187"), "old bus pass text");
    ok("Bologna guide: student-tip labels, no raw markers, bus pass €161 at any age");
    await page.context().close();

    // --- Study plan: crash courses note with an Official label ---
    page = await open("studyplan.html");
    const note = page.locator("#group-crash .plan-group-note");
    await note.locator(".source-badge").waitFor();
    assert.match(await note.textContent(), /do not count towards the 120 credits/);
    assert.match(await note.locator(".source-badge").textContent(), /^Official · EU-HEM Handbook · verified 6 Oct 2026$/);
    ok("study plan: crash courses note labelled Official");
    await page.context().close();

    // --- Calendar page: key dates list ---
    page = await open("calendar.html");
    const items = page.locator("#key-dates-list .key-date");
    await items.first().waitFor();
    assert.strictEqual(await items.count(), 10);
    const first = await items.nth(0).textContent();
    assert.match(first, /14 Sep – 24 Oct 2026/); assert.match(first, /first term \(now\)/);
    assert.ok(await items.nth(0).evaluate((el) => el.classList.contains("is-now")));
    const exams = items.nth(1);
    assert.match(await exams.textContent(), /26 Oct – 7 Nov 2026.*Exams, first term/s);
    assert.ok(!(await exams.evaluate((el) => el.classList.contains("is-past"))));
    assert.match(await items.filter({ hasText: "Erasmus+" }).textContent(), /About Jan – Feb 2027/);
    assert.match(await items.filter({ hasText: "Re-enrolment deadline" }).textContent(), /1 Aug 2027.*payment deadline may change/s);
    assert.strictEqual(await page.locator("#key-dates-list .source-badge.is-official").count(), 10);
    ok("calendar: 10 key dates in order, the current one marked now, approximate ones say About, all labelled");
    await page.context().close();

    page = await open("calendar.html", { viewport: { width: 320, height: 800 }, scheme: "dark" });
    await page.locator("#key-dates-list .key-date").first().waitFor();
    await noSideways(page);
    const [bg, fg] = await page.locator(".key-date").nth(1).evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el.querySelector(".key-date-when")).color]);
    assert.notStrictEqual(bg, fg);
    assert.ok(!/rgb\(255, 255, 255\)/.test(bg), `light card in dark mode: ${bg}`);
    ok("calendar key dates on a 320 px phone in dark mode: no sideways scrolling, dark cards");
    await page.context().close();

    // --- Homepage: next exam period and the official study plan reminder, even without UniBo ---
    page = await open("index.html");
    const period = page.locator("#dash-exam .dash-period");
    await period.waitFor({ timeout: 30000 });
    assert.strictEqual(await period.textContent(), "Next exam period: 26 Oct – 7 Nov 2026");
    assert.strictEqual(await period.getAttribute("href"), "calendar.html#key-dates");
    const reminder = page.locator("#dash-plan .dash-reminder");
    assert.match(await reminder.textContent(), /^Reminder: the official study plan is on Studenti Online\. There is no deadline, .*before you can register for exams on AlmaEsami/);
    assert.strictEqual(await reminder.locator("a").getAttribute("href"), "https://studenti.unibo.it");
    ok("homepage: next exam period (from programme.json, UniBo offline) and the Studenti Online reminder");
    await page.context().close();

    assert.deepStrictEqual(errors, [], "page errors");
    ok("no page errors");
  } finally {
    await browser.close();
    site.close();
  }
  console.log(`${n} handbook browser checks passed`);
})().catch((error) => { console.error(error); process.exit(1); });
