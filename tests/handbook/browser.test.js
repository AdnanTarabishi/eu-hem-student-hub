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
    const count = (text) => badges.filter(([t]) => t.startsWith(text)).length;
    assert.ok(count("Student tip · EU-HEM student reps") >= 3, JSON.stringify(badges));
    assert.ok(count("Student tip · ESN Bologna") >= 4, JSON.stringify(badges));
    assert.ok(count("Official · EU-HEM Handbook · verified") >= 5, JSON.stringify(badges));
    assert.ok(badges.every(([text, cls]) => cls.includes(text.startsWith("Official") ? "is-official" : "is-tip")), "label colour matches its kind");
    assert.strictEqual(count("Source not listed"), 0);
    assert.ok(!(await page.evaluate(() => /\{(official|tip):/.test(document.body.textContent))), "a raw marker is left");
    const text = await page.evaluate(() => document.body.textContent);
    assert.ok(text.replace(/\s+/g, " ").includes("€161 for master's students like EU-HEM, at any age"), "bus pass");
    assert.ok(!text.includes("€161 / €187"), "old bus pass text");
    const flat = text.replace(/\s+/g, " ");
    for (const fact of ["Via Marco Polo 60", "Via Larga 35", "Via Zamboni 62/b", "Via Montebello 6", "Carta Smeraldo", "RideMovi", "€23.30",
      "Palazzo Paleotti", "Le Serre dei Giardini Margherita", "Papaya", "W. Bigiavi", "AlmaWiFi", "myUniBo", "outside the SEPA area"]) {
      assert.ok(flat.includes(fact), `missing: ${fact}`);
    }
    assert.ok(flat.includes("recommended by earlier EU-HEM students"), "restaurants labelled");
    assert.doesNotMatch(flat, /\bbest (pizza|views|milk)|very good pizza/i, "no rankings");
    ok("Bologna guide: official and student-tip labels, handbook additions, restaurants as earlier students' suggestions");
    await page.context().close();

    // --- Other cities: student tips added where the guide lacked them ---
    for (const [city, fact] of [["oslo", "ankerstudentbolig.no"], ["innsbruck", "Hofer"], ["rotterdam", "kamernet.nl"]]) {
      page = await open(`city-guide.html?city=${city}`);
      await page.locator(".source-badge").first().waitFor({ state: "attached" });
      const cityText = (await page.evaluate(() => document.body.textContent)).replace(/\s+/g, " ");
      assert.ok(cityText.includes(fact), `${city}: ${fact}`);
      assert.ok(await page.locator(".source-badge.is-tip", { hasText: "EU-HEM student reps" }).count() >= 4, `${city}: tip labels`);
      await page.context().close();
    }
    ok("Oslo, Innsbruck and Rotterdam guides: student tips with labels");

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

    // --- Academic Rules page ---
    page = await open("academic-rules.html");
    await page.locator("#joint .rules-item").first().waitFor();
    assert.strictEqual(await page.locator("#rules-status").count(), 0, "loading message left");
    assert.strictEqual(await page.locator("#site-nav a[href='academic-rules.html'][aria-current='page']").count(), 1, "menu marks the page");
    assert.strictEqual(await page.locator(".rules-uni").count(), 4);
    assert.deepStrictEqual(await page.locator(".rules-uni h3").evaluateAll((els) => els.map((e) => e.firstChild.textContent)),
      ["University of Bologna", "University of Oslo", "MCI | The Entrepreneurial School", "Erasmus University Rotterdam"]);
    const ruleCount = await page.locator(".rules-item").count();
    assert.strictEqual(await page.locator(".rules-item .source-badge").count(), ruleCount, "every rule has a label");
    assert.strictEqual(await page.locator(".rules-item .source-badge", { hasText: "Source not listed" }).count(), 0);
    assert.strictEqual(await page.locator(".rules-grades tbody tr").count(), 4);
    assert.match(await page.locator("#grading .rules-note").textContent(), /not a conversion/);
    for (const href of await page.locator(".rules-links a").evaluateAll((els) => els.map((e) => e.href))) assert.match(href, /^https:\/\//);
    ok("academic rules: shared rules, 4 universities, grading table, every rule labelled, official links");

    // Re-sit guide with the keyboard only: Tab into a group, arrows choose, the outcome is announced
    await page.locator("#resit-guide input[name='resit-university']").first().focus();
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); // -> EUR
    assert.strictEqual(await page.locator("input[name='resit-university']:checked").getAttribute("value"), "eur");
    await page.keyboard.press("Tab"); // into "what happened" (first option: failed)
    await page.keyboard.press("Space");
    assert.strictEqual(await page.locator("input[name='resit-attempt']:checked").getAttribute("value"), "failed");
    assert.strictEqual(await page.locator(".resit-result").count(), 0, "no outcome before the last question");
    await page.keyboard.press("Tab"); await page.keyboard.press("ArrowRight"); // "another EU-HEM university"
    const result = page.locator(".resit-outcome .resit-result");
    await result.waitFor();
    assert.strictEqual(await page.locator(".resit-outcome").getAttribute("aria-live"), "polite");
    assert.match(await result.locator("h3").textContent(), /Ask to re-sit where you are now/);
    assert.match(await result.textContent(), /online proctoring/);
    await page.locator("input[name='resit-attempt'][value='improve']").check();
    assert.strictEqual(await page.locator("input[name='resit-location']").count(), 0, "location question hidden again");
    assert.match(await result.textContent(), /higher grade counts/);
    await page.locator(".resit-reset").click();
    assert.strictEqual(await page.locator(".resit-result").count(), 0);
    assert.strictEqual(await page.evaluate(() => document.activeElement.name), "resit-university");
    ok("re-sit guide: keyboard only, location question only after a fail, live outcome, start again");

    await page.goto(base + "academic-rules.html#grading");
    await page.locator(".rules-grades tbody tr").first().waitFor();
    await page.waitForTimeout(300);
    const top = await page.locator("#grading").evaluate((el) => el.getBoundingClientRect().top);
    assert.ok(top >= 0 && top < 300, `#grading not scrolled into view (top ${top})`);
    ok("academic rules: a link to #grading opens at that section");
    await page.context().close();

    page = await open("academic-rules.html", { viewport: { width: 320, height: 800 }, scheme: "dark" });
    await page.locator(".rules-grades tbody tr").first().waitFor();
    await noSideways(page);
    assert.strictEqual(await page.locator(".rules-grades thead").evaluate((el) => getComputedStyle(el).display), "none", "grades are cards on phones");
    const cardBg = await page.locator(".rules-uni").first().evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.ok(!/rgb\(255, 255, 255\)/.test(cardBg), `light card in dark mode: ${cardBg}`);
    ok("academic rules on a 320 px phone in dark mode: no sideways scrolling, grade cards, dark cards");
    await page.context().close();

    // Site search finds the rules
    page = await open("index.html");
    await page.locator("#dash-exam .dash-period").waitFor({ timeout: 30000 });
    await page.keyboard.press("Control+k");
    await page.keyboard.type("proctoring");
    const hit = page.locator("a[href='academic-rules.html#uni-eur']");
    await hit.waitFor({ timeout: 20000 });
    assert.match(await hit.textContent(), /Erasmus University Rotterdam/);
    ok("site search finds a rule and links to its university");
    await page.context().close();

    // --- Programme Journey ---
    page = await open("journey.html");
    await page.locator(".journey-stop").first().waitFor();
    assert.strictEqual(await page.locator(".journey-stop").count(), 6);
    assert.strictEqual(await page.locator(".journey-stop[aria-current='step'] h3").textContent(), "Semester 1: Bologna, all together");
    assert.match(await page.locator("#stage-semester-2 .journey-place").textContent(), /Depends on your track/);
    assert.strictEqual(await page.locator("input[name='journey-track'][value='']").isChecked(), true);
    // Choose a track with the keyboard: the timeline shows its cities, the choice is saved like on the Tracks page
    await page.locator("input[name='journey-track'][value='eeh']").focus();
    await page.keyboard.press("Space");
    assert.match(await page.locator("#stage-semester-2 .journey-place").textContent(), /Rotterdam \(Erasmus University Rotterdam\)/);
    assert.match(await page.locator("#stage-semester-3 .journey-place").textContent(), /Oslo/);
    assert.match(await page.locator(".journey-erasmus-table tr.is-mine").textContent(), /EEH.*your track.*Bologna or University of Oslo/s);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("euhem-track-v1")));
    assert.deepStrictEqual(saved, { cohort: "2026-2028", track: "eeh" });
    ok("journey: 6 stages, You are here, track choice by keyboard shows its cities and grant row, saved like on Tracks");

    await page.goto(base + "tracks.html");
    await page.goto(base + "journey.html");
    await page.locator(".journey-stop").first().waitFor();
    assert.strictEqual(await page.locator("input[name='journey-track'][value='eeh']").isChecked(), true);
    ok("journey: the saved track is remembered on the next visit");

    assert.deepStrictEqual(await page.locator(".journey-titles strong").allTextContents(), [
      "Laurea Magistrale in Health Economics and Management", "Master of Science in Health Economics and Management",
      "Master of Philosophy in Health Economics and Management", "Master of Arts in Business"]);
    const figures = await page.locator("#numbers .journey-figure").allTextContents();
    assert.ok(figures.some((f) => /104/.test(f) && /students/.test(f)) && figures.some((f) => /24/.test(f) && /nationalities/.test(f)), figures.join("|"));
    assert.match(await page.locator("#numbers .source-badge").textContent(), /Welcome Days 2026/);
    assert.deepStrictEqual(await page.locator(".journey-year").allTextContents(), ["2009", "2010", "2012", "2015", "2018", "2021", "2025"]);
    assert.match(await page.locator("#fees").textContent(), /€4,000.*€9,000/s);
    assert.match(await page.locator("#fees").textContent(), /2026\/27/);
    assert.match(await page.locator(".journey-erasmus-caveat").textContent(), /balance/);
    ok("journey: four titles, cohort numbers (Welcome Days), history, fees for 2026-2028, Erasmus+ caveat");
    await page.context().close();

    page = await open("journey.html", { viewport: { width: 320, height: 800 }, scheme: "dark" });
    await page.locator(".journey-stop").first().waitFor();
    await noSideways(page);
    ok("journey on a 320 px phone in dark mode: no sideways scrolling");
    await page.context().close();

    // --- Support & Contacts ---
    page = await open("support.html");
    await page.locator("#contacts-unibo").waitFor();
    await page.locator("#emergency:not([hidden]) li").first().waitFor();
    assert.strictEqual(await page.locator("#emergency li").count(), 4);
    assert.match(await page.locator("#emergency").textContent(), /Oslo: 113 ambulance, 112 police, 110 fire/);
    assert.doesNotMatch(await page.locator("#emergency").textContent(), /\[S\d+\]/);
    assert.strictEqual(await page.locator("#site-nav a[href='support.html'][aria-current='page']").count(), 1, "menu marks the page");
    const mailboxes = await page.locator("a[href^='mailto:']").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")))].sort());
    assert.deepStrictEqual(mailboxes, ["mailto:didatticasociale.euhem@unibo.it", "mailto:eu-hem@mci.edu", "mailto:euhem@eshpm.eur.nl", "mailto:garante@unibo.it"]);
    assert.strictEqual(await page.locator("#contacts-uio a[href^='mailto:']").count(), 0, "Oslo: no mailbox, official page only");
    assert.strictEqual(await page.locator("#contacts-uio a[href='https://www.uio.no/english/studies/programmes/hem-master/contact/']").count(), 1);
    assert.strictEqual(await page.locator(".support-staff-page a").getAttribute("href"), "https://www.eur.nl/en/eshpm/master/european-master-health-economics-and-management/contact");
    assert.doesNotMatch(await page.locator("main").textContent(), /\b(Prof|Dr|Mr|Ms)\.\s+[A-Z]|docs\.google/);
    ok("support: emergency numbers from the City Guides, role mailboxes only, Oslo and staff as official links");

    // Contact guide with the keyboard: wellbeing -> asks the university -> SAP for Bologna
    await page.locator("input[name='support-topic']").first().focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown"); // 7th option: wellbeing
    assert.strictEqual(await page.locator("input[name='support-topic']:checked").getAttribute("value"), "wellbeing");
    assert.strictEqual(await page.locator(".support-result").count(), 0, "no outcome before the university is chosen");
    await page.keyboard.press("Tab"); await page.keyboard.press("Space"); // first university: Bologna
    const supportResult = page.locator(".support-outcome .support-result");
    await supportResult.waitFor();
    assert.strictEqual(await page.locator(".support-outcome").getAttribute("aria-live"), "polite");
    assert.match(await supportResult.textContent(), /Psychological Support Service/);
    assert.match(await supportResult.locator(".support-emergency-note").textContent(), /emergency number/);
    await page.locator("input[name='support-topic'][value='enrolment']").check();
    assert.strictEqual(await page.locator("input[name='support-university']").count(), 0, "university question hidden for enrolment");
    assert.strictEqual(await supportResult.locator("a[href^='mailto:']").getAttribute("href"), "mailto:euhem@eshpm.eur.nl");
    await page.locator("input[name='support-topic'][value='provisions']").check();
    assert.strictEqual(await supportResult.locator(".support-page-link").getAttribute("href"), "academic-rules.html#special-provisions");
    ok("support: contact guide by keyboard, university asked only when needed, live outcome with contacts");
    await page.context().close();

    page = await open("support.html", { viewport: { width: 320, height: 800 }, scheme: "dark" });
    await page.locator("#contacts-unibo").waitFor();
    await page.locator("#emergency:not([hidden])").waitFor();
    await noSideways(page);
    ok("support on a 320 px phone in dark mode: no sideways scrolling");
    await page.context().close();

    assert.deepStrictEqual(errors, [], "page errors");
    ok("no page errors");
  } finally {
    await browser.close();
    site.close();
  }
  console.log(`${n} handbook browser checks passed`);
})().catch((error) => { console.error(error); process.exit(1); });
