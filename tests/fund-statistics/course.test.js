// The Fundamentals course gateway against real content, under the GitHub Pages prefix.
// Run: node tests/fund-statistics/course.test.js
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const root = path.resolve(".");
const output = "/workspace/work/fund-course-redesign";
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const topics = read("content/modules/fund-statistics/topics.json");
const questions = read("content/modules/fund-statistics/questions.json");
const cards = read("content/modules/fund-statistics/flashcards.json");
const guides = read("content/modules/fund-statistics/practical-study.json");
const study = read("content/modules/fund-statistics/course-study.json");
const programme = read("content/programme.json");
const course = programme.cohorts.flatMap(c => c.terms).flatMap(t => t.courses)
  .find(c => c.id === "fund-quant-methods");
const mime = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".md": "text/markdown", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
  ".csv": "text/csv",
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
      .replace(/^\/eu-hem-student-hub\//, "");
    const file = path.resolve(root, name || "index.html");
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end("missing");
    }
    res.setHeader("content-type", mime[path.extname(file)] || "application/octet-stream");
    res.end(fs.readFileSync(file));
  }).listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve); server.once("error", reject);
  });
  const base = `http://127.0.0.1:${server.address().port}/eu-hem-student-hub/`;
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  const errors = [];
  const contexts = [];
  const createContext = async options => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 }, colorScheme: "light",
      reducedMotion: "reduce", ...options,
    });
    contexts.push(context);
    await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.stack));
    return { page, context };
  };
  const open = async (page, tab = "overview") => {
    await page.goto(base + "course.html?course=fund-quant-methods&tab=" + tab);
    await page.locator("body.fund-course-page .fc-header .fc-tabs").waitFor();
    if (tab === "overview") await page.locator(".fc-overview .fc-topic-card").last().waitFor();
  };
  const fits = async (page, label) => {
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label);
  };
  // Query dt/dd semantics instead of matching unrelated numbers in the hero.
  const metric = async (page, label) => page.locator("dl.fc-metrics").evaluate((dl, labelSource) => {
    const label = new RegExp(labelSource, "i");
    for (const dt of dl.querySelectorAll("dt")) {
      if (!label.test(dt.textContent)) continue;
      const parent = dt.parentElement;
      const dd = parent !== dl ? parent.querySelector("dd") : dt.nextElementSibling;
      return dd && dd.textContent.trim();
    }
    return null;
  }, label);
  const numericMetric = async (page, label, expected) => {
    const value = await metric(page, label);
    assert.equal(Number(value?.replace(/[^\d.]/g, "")), expected, label + " metric");
  };
  try {
    const { page, context } = await createContext();
    await open(page);
    assert.equal(await page.locator(".fc-hero h1").count(), 1);
    assert.equal(await page.locator("main h1").count(), 1);
    assert.equal(await page.locator(".fc-hero h1").getAttribute("aria-label"), course.name);
    assert.match(await page.locator("#course-page").innerText(), /96496/);
    assert.equal(await page.locator(".fc-header .fc-tabs a[aria-current=page]").count(), 1);
    assert.match(await page.locator(".fc-header .fc-tabs a[aria-current=page]").getAttribute("href"), /tab=overview/);
    assert.equal(await page.locator("dl.fc-metrics dt").count(), 4);
    await numericMetric(page, "topic", topics.length);
    await numericMetric(page, "question", questions.length);
    await numericMetric(page, "card", cards.length);
    await numericMetric(page, "lab.*report|report.*lab", guides.guides.length);
    assert.doesNotMatch(await page.locator(".fc-overview").innerText(), /60 flashcards|84 flashcards|Topic 5 slides pending/);

    const topicLinks = page.locator(".fc-topic-grid a.fc-topic-card");
    assert.equal(await topicLinks.count(), topics.length);
    for (let i = 0; i < topics.length; i++) {
      const link = topicLinks.nth(i);
      const url = new URL(await link.getAttribute("href"), base);
      assert.equal(url.pathname, "/eu-hem-student-hub/lecture.html");
      assert.equal(url.searchParams.get("topic"), topics[i].id);
      assert.match(await link.innerText(), new RegExp("Topic\\s*0?" + (i + 1), "i"));
    }
    const tools = page.locator("a.fc-tool-card");
    assert.equal(await tools.count(), 6);
    const toolViews = await tools.evaluateAll(all => all.map(a => new URL(a.href).hash.slice(1)).sort());
    assert.deepEqual(toolViews, ["cards", "cases", "explore", "lab-guides", "mock", "reference"].sort());
    for (const href of await tools.evaluateAll(all => all.map(a => a.getAttribute("href")))) {
      assert.equal(new URL(href, base).pathname, "/eu-hem-student-hub/fund-statistics.html");
    }
    // Actual course/module facts cannot silently turn the integrated course into one module.
    const modules = page.locator(".fc-module-card");
    assert.equal(await modules.count(), course.modules.length);
    for (let i = 0; i < course.modules.length; i++) {
      const text = await modules.nth(i).innerText(), info = course.modules[i];
      assert.ok(text.includes(info.name), info.name);
      assert.ok(text.includes(info.code), info.code);
      for (const professor of info.professors) assert.ok(text.includes(professor), professor);
      assert.match(text, new RegExp(info.cfu + "\\s*CFU"));
    }
    assert.match(await modules.last().innerText(), /not yet|awaiting|coming|no interactive/i);
    assert.equal(await modules.last().locator('a[href*="lecture.html"]').count(), 0);
    assert.match(await page.locator(".fc-exam-card").innerText(), new RegExp(study.exam.minutes + " minutes"));
    assert.ok((await page.locator(".fc-exam-card").innerText()).includes(study.exam.passMark));
    assert.deepEqual(await page.locator(".fc-exam-parts li strong").allTextContents(), study.exam.sections.map(s => s.weight + "%"));
    assert.equal(await page.locator('.fc-source-card a[href*="virtuale.unibo.it"]').getAttribute("href"), course.modules[0].virtualeUrl);
    for (const href of await page.locator(".fc-overview a").evaluateAll(all => all.map(a => a.href))) {
      const url = new URL(href);
      if (url.origin !== new URL(base).origin) continue;
      const local = url.pathname.replace(/^\/eu-hem-student-hub\//, "");
      assert.ok(fs.existsSync(path.join(root, local)), "local destination exists: " + local);
    }
    assert.equal(await page.locator(".plan-status-box").count(), 1);
    assert.match(await page.locator(".fc-plan-wrap").innerText(), /Quantitative methods.*Required.*choose one/);
    assert.equal(await page.locator(".fc-resume-card").count(), 1);
    assert.equal(new URL(await page.locator(".fc-resume-link").getAttribute("href"), base).searchParams.get("topic"), topics[0].id);

    // Keep the shared saveButton storage and study-plan status controls operational.
    const bookmark = page.locator("#course-page .save-button").first();
    await bookmark.click(); assert.equal(await bookmark.getAttribute("aria-pressed"), "true");
    await page.reload(); await page.locator(".fc-overview").waitFor();
    assert.equal(await page.locator("#course-page .save-button").first().getAttribute("aria-pressed"), "true");
    assert.equal(await page.evaluate(() => getStudyList().filter(item => item.id === "fund-quant-methods").length), 1);
    await page.evaluate(() => {
      const plan = loadPlan(page.data.programme);
      const group = page.data.term.groups.find(g => g.courses.includes("96496"));
      plan.choices = applyChoice(page.data.term, plan.choices, group.id, "96496", true).choices;
      savePlan(plan);
    });
    await page.reload(); await page.locator(".plan-status-box select").waitFor();
    await page.getByLabel("Your status for this course").selectOption("studying");
    await page.reload(); await page.locator(".fc-overview").waitFor();
    assert.equal(await page.getByLabel("Your status for this course").inputValue(), "studying");

    // Full hrefs remain useful for new tabs, normal clicks and browser back/forward.
    const lectureTab = page.locator('.fc-header .fc-tabs a[href*="tab=lectures"]');
    const lectureTabHref = await lectureTab.getAttribute("href");
    assert.ok(lectureTabHref.includes("course=fund-quant-methods"));
    await lectureTab.click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("tab") === "lectures");
    assert.match(await page.locator(".fc-header .fc-tabs a[aria-current=page]").getAttribute("href"), /tab=lectures/);
    await page.goBack(); await page.locator(".fc-overview").waitFor();
    await page.goForward(); await page.locator(".fc-header .fc-tabs a[aria-current=page]").waitFor();
    assert.match(await page.locator(".fc-header .fc-tabs a[aria-current=page]").getAttribute("href"), /tab=lectures/);
    const secondPage = await context.newPage();
    secondPage.on("pageerror", e => errors.push(e.stack));
    await secondPage.goto(new URL(lectureTabHref, base).href);
    await secondPage.locator(".fc-header .fc-tabs").waitFor();
    assert.equal(new URL(secondPage.url()).searchParams.get("tab"), "lectures");
    await secondPage.close();

    // Course links and native source details also work without a mouse.
    const overviewTab = page.locator('.fc-header .fc-tabs a[href*="tab=overview"]');
    await overviewTab.focus(); await page.keyboard.press("Enter");
    await page.locator(".fc-overview").waitFor();
    const summary = page.locator(".fc-module-details summary").first();
    await summary.focus(); await page.keyboard.press("Space");
    assert.equal(await page.locator(".fc-module-details").first().evaluate(node => node.open), true);
    assert.match(await page.locator(".fc-module-details").first().innerText(), /90-minute computer-based written exam/);
    assert.ok(await summary.evaluate(node => parseFloat(getComputedStyle(node).outlineWidth) >= 3));
    await page.keyboard.press("Space");
    await page.getByRole("link", { name: "View syllabus topics" }).click();
    assert.equal(new URL(page.url()).hash, "#module-fund-econometrics");
    assert.match(await page.locator("#module-fund-econometrics").innerText(), /Econometrics/);

    // Progress comes from the same real lecture state; the redesigned course does not migrate it.
    await page.goto(base + "lecture.html?topic=" + topics[0].id + "#learn");
    await page.locator("#lecture-content:not([hidden])").waitFor();
    await page.locator("#mark-read").click();
    await page.locator('.lecture-toolbar [data-view="practice"]').click();
    const q = questions.find(q => q.topic === topics[0].id);
    await page.locator(`input[name="answer"][value="${q.answer.charCodeAt(0) - 65}"]`).check();
    await page.locator("#check-answer").click();
    await page.evaluate(id => setTopicStatus(id, "understood"), topics[1].id);
    const savedProgress = await page.evaluate(() => loadProgress());
    await open(page);
    assert.equal(new URL(await page.locator(".fc-resume-link").getAttribute("href"), base).searchParams.get("topic"), topics[0].id);
    assert.equal(new URL(await page.locator(".fc-resume-link").getAttribute("href"), base).hash, "#practice");
    assert.match(await page.locator('.fc-compact-facts [data-progress="read"]').innerText(), /2\s*(?:\/|of)\s*6/);
    assert.match(await page.locator('.fc-compact-facts [data-progress="checked"]').innerText(), /1\s*(?:\/|of)\s*90/);
    assert.deepEqual(await page.evaluate(() => loadProgress()), savedProgress);
    assert.match(await topicLinks.nth(0).innerText(), /Read/);
    assert.match(await topicLinks.nth(1).innerText(), /Understood/);
    // Once the partial quiz is complete and the first two topics are understood,
    // the next-step recommendation advances to the first topic still to understand.
    await page.evaluate(id => {
      const progress = loadProgress();
      const quiz = progress.lectures[id];
      quiz.checked = quiz.checked.map(() => true);
      quiz.answers = quiz.answers.map(answer => answer === null ? 0 : answer);
      saveProgress(progress); setTopicStatus(id, "understood");
    }, topics[0].id);
    await page.reload(); await page.locator(".fc-overview").waitFor();
    assert.equal(new URL(await page.locator(".fc-resume-link").getAttribute("href"), base).searchParams.get("topic"), topics[2].id);
    assert.equal(new URL(await page.locator(".fc-resume-link").getAttribute("href"), base).hash, "#learn");
    const completedProgress = await page.evaluate(() => loadProgress());

    // All custom course views remain inside the viewport; nested tab scrolling is allowed.
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await open(page); await fits(page, "overview at " + width);
      await open(page, "lectures"); await fits(page, "lectures at " + width);
      await open(page, "practice"); await fits(page, "practice at " + width);
    }
    await open(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: output + "/course-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: output + "/course-mobile.png", fullPage: true });
    await page.locator(".theme-toggle").click();
    await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
    await fits(page, "dark overview");
    await page.screenshot({ path: output + "/course-mobile-dark.png", fullPage: true });

    // A genuine PWA data cache is populated on the first visit, then the course reloads offline.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => {
      const cache = await caches.open("data");
      return !!(await cache.match(new URL("content/modules/fund-statistics/course-study.json", location.href).href));
    });
    await context.setOffline(true);
    await page.reload(); await page.locator(".fc-overview .fc-topic-card").last().waitFor();
    await numericMetric(page, "card", cards.length);
    assert.equal(await page.locator(".fc-topic-card").count(), topics.length);
    assert.equal(await page.locator("#course-page .save-button").first().getAttribute("aria-pressed"), "true");
    assert.deepEqual(await page.evaluate(() => loadProgress()), completedProgress);
    await fits(page, "offline overview");
    await context.setOffline(false);

    // Adding content changes the gateway counts without a copied number in the renderer.
    const dynamic = await createContext({ serviceWorkers: "block" });
    await dynamic.page.route("**/content/modules/fund-statistics/questions.json", r => r.fulfill({
      contentType: "application/json", body: JSON.stringify([...questions, { ...questions[0], id: "fund-statistics.q.browser-extra" }]),
    }));
    await dynamic.page.route("**/content/modules/fund-statistics/flashcards.json", r => r.fulfill({
      contentType: "application/json", body: JSON.stringify([...cards, { ...cards[0], id: "fund-statistics.card.browser-extra" }]),
    }));
    await dynamic.page.route("**/content/modules/fund-statistics/course-study.json", r => r.fulfill({
      contentType: "application/json", body: JSON.stringify({ ...study, development: {
        ...study.development, labGuides: study.development.labGuides + 1,
      } }),
    }));
    await open(dynamic.page);
    await numericMetric(dynamic.page, "question", questions.length + 1);
    await numericMetric(dynamic.page, "card", cards.length + 1);
    await numericMetric(dynamic.page, "lab.*report|report.*lab", guides.guides.length + 1);

    // Optional overview metadata must not take away the existing lecture and practice content.
    const failed = await createContext({ serviceWorkers: "block" });
    for (const file of ["course-study.json", "practical-study.json", "extended-practice.json"]) {
      await failed.page.route("**/content/modules/fund-statistics/" + file,
        r => r.fulfill({ status: 503, body: "unavailable" }));
    }
    await open(failed.page);
    assert.equal(await failed.page.locator(".fc-topic-card").count(), topics.length);
    assert.equal(await failed.page.locator('a[href="fund-statistics.html"]').count() > 0, true);
    await numericMetric(failed.page, "question", questions.length);
    await numericMetric(failed.page, "card", cards.length);
    await fits(failed.page, "overview with optional metadata unavailable");

    // This scoped design leaves the other statistics course on its existing renderer.
    await failed.page.goto(base + "course.html?course=quant-methods&tab=overview");
    await failed.page.locator("#qm-demo-se").waitFor();
    assert.equal(await failed.page.locator("body.fund-course-page").count(), 0);
    assert.equal(await failed.page.locator(".fc-overview").count(), 0);
    assert.deepEqual(errors, []);
    console.log("Fundamentals course passed: source-driven metrics, six topic destinations, six study tools, module facts, saved progress/bookmark/plan, tab history, responsive/dark, real offline reload and optional-data fallback.");
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await browser.close(); server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
