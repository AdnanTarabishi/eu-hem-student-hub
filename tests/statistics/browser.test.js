const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright");
const bank = require("../../content/modules/statistics/questions.json");
const root = path.resolve(".");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".md": "text/markdown",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};
(async () => {
  const server = http
    .createServer((req, res) => {
      const p = path.resolve(
        root,
        decodeURIComponent(req.url.split("?")[0]).replace(/^\//, "") ||
          "index.html",
      );
      if (
        !p.startsWith(root + path.sep) ||
        !fs.existsSync(p) ||
        fs.statSync(p).isDirectory()
      ) {
        res.writeHead(404);
        return res.end("missing");
      }
      res.setHeader("content-type", mime[path.extname(p)] || "text/plain");
      res.end(fs.readFileSync(p));
    })
    .listen(0);
  const base = `http://127.0.0.1:${server.address().port}/`,
    browser = await chromium.launch(
      fs.existsSync("/usr/bin/chromium")
        ? { executablePath: "/usr/bin/chromium" }
        : { channel: "chrome" },
    );
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await ctx.route("**/*", (r) =>
      new URL(r.request().url()).hostname === "127.0.0.1"
        ? r.continue()
        : r.abort(),
    );
    const page = await ctx.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.stack));
    const open = async (hash = "dashboard") => {
      await page.goto(base + "statistics.html#" + hash);
      await page.waitForSelector("#study-content:not([hidden])");
    };
    const view = async (hash) => {
      await page.locator('.study-nav a[href="#' + hash + '"]').click();
      await page.waitForFunction(
        (h) =>
          document.querySelector(".study-nav a[aria-current]").hash === "#" + h,
        hash,
      );
    };
    const progress = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("euhem-progress-v1")),
      );
    await page.goto(base + "course.html?course=quant-methods&tab=lectures");
    await page.locator('a[href="statistics.html"]').waitFor();
    // A checked lecture answer is immediately shared, but merely selecting is not recorded.
    const q = bank.find((q) => q.topic === "statistics.risk-uncertainty"),
      right = q.answer.charCodeAt(0) - 65,
      wrong = (right + 1) % 4;
    await page.goto(base + "lecture.html?topic=" + q.topic + "#practice");
    await page.waitForSelector("#lecture-content:not([hidden])");
    await page.locator(`input[name="answer"][value="${wrong}"]`).check();
    assert.equal(
      Object.keys((await progress()).statistics.questions || {}).length,
      0,
    );
    await page.locator("#check-answer").click();
    assert.equal(
      (await progress()).statistics.questions[q.id].needsReview,
      true,
    );
    await open("mistakes");
    assert.match(
      await page.locator("#study-view").innerText(),
      /1 questions need another try/,
    );
    await page.locator('[data-action="retry-mistakes"]').click();
    await page.locator('[data-action="check"]').waitFor();
    await page
      .locator(`input[name="session-answer"][value="${right}"]`)
      .check();
    await page.locator('[data-action="check"]').click();
    assert.equal(
      (await progress()).statistics.questions[q.id].needsReview,
      false,
    );
    await page.locator('[data-grade="easy"]').click();
    const date1 = (await progress()).statistics.questions[q.id].due;
    await page.locator('[data-grade="easy"]').click();
    assert.equal((await progress()).statistics.questions[q.id].due, date1);
    await page.locator('[data-action="finish"]').click();
    await page.locator('[data-action="new-session"]').click();
    await view("mistakes");
    assert.match(
      await page.locator("#study-view").innerText(),
      /0 questions need another try/,
    );
    await page.locator("#mistake-history").check();
    assert.match(
      await page.locator("#study-view").innerText(),
      /1 questions with a mistake/,
    );
    await view("mock");
    await page.locator("#mock-mode").selectOption("exam");
    await page.locator("#mock-size").selectOption("12");
    await page.locator('[data-action="start-mock"]').click();
    const before = (await progress()).statistics.active,
      first = bank.find((q) => q.id === before.ids[0]);
    await page
      .locator(
        `input[name="session-answer"][value="${first.answer.charCodeAt(0) - 65}"]`,
      )
      .check();
    assert.equal(await page.locator(".study-feedback").count(), 0);
    assert.equal(await page.locator('[data-action="check"]').count(), 0);
    await page.reload();
    await page.waitForSelector("#exam-timer");
    const restored = (await progress()).statistics.active;
    assert.equal(restored.deadline, before.deadline);
    assert.deepEqual(restored.order, before.order);
    assert.equal(restored.answers[0], first.answer.charCodeAt(0) - 65);
    assert.equal(await page.locator(".study-feedback").count(), 0);
    // Expire through a persisted wall-clock deadline, avoiding a long test wait.
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem("euhem-progress-v1"));
      p.statistics.active.startedAt = Date.now() - 1200000;
      p.statistics.active.deadline = Date.now() - 1000;
      localStorage.setItem("euhem-progress-v1", JSON.stringify(p));
    });
    await page.reload();
    await page.locator('[data-action="new-session"]').waitFor();
    const ended = (await progress()).statistics;
    assert.equal(ended.sessions.at(-1).correct, 1);
    assert.equal(ended.sessions.at(-1).total, 12);
    assert.equal(ended.sessions.at(-1).answered, 1);
    const history = ended.sessions.length;
    await page.reload();
    await page.locator('[data-action="new-session"]').waitFor();
    assert.equal((await progress()).statistics.sessions.length, history);
    await page.locator('[data-action="new-session"]').click();
    // Numeric feedback, hints, assisted solutions and both parameter variants.
    await view("calculations");
    const se = page.locator('[data-exercise="se"]');
    await se.locator("input").fill("2");
    await se.locator('button[type="submit"]').click();
    assert.match(await se.locator(".calc-feedback").innerText(), /Correct/);
    await se.locator('[data-action="variant"]').click();
    assert.match(await se.innerText(), /n = 36/);
    await se.locator("[data-solution] summary").click();
    await se.locator("input").fill("3");
    await se.locator('button[type="submit"]').click();
    assert.match(
      await se.locator(".calc-feedback").innerText(),
      /needs another look/,
    );
    await se.locator("input").fill("2");
    await se.locator('button[type="submit"]').click();
    assert.equal((await progress()).statistics.exercises.se.assisted, true);
    // Drafts are stored as plain text, never injected as markup; rubric is explicitly self-assessment.
    await view("interpretation");
    const text = '<img src=x onerror="window.injection=1"> My explanation';
    await page.locator("#draft-ppv").fill(text);
    await page
      .locator("#draft-ppv")
      .locator("..")
      .locator("details summary")
      .click();
    await page.locator('[data-rubric="ppv"][data-index="0"]').check();
    await page.reload();
    await page.locator("#draft-ppv").waitFor();
    assert.equal(await page.locator("#draft-ppv").inputValue(), text);
    assert.equal(await page.evaluate(() => window.injection), undefined);
    assert.equal(
      await page.locator('[data-rubric="ppv"][data-index="0"]').isChecked(),
      true,
    );
    await view("reference");
    await page.locator('[data-action="node"][data-id="concept-5"]').click();
    assert.match(
      await page.locator("#study-view").innerText(),
      /Sampling & confidence intervals/,
    );
    await page.locator("#formula-search").fill("Bayes");
    assert.equal(await page.locator("#formula-list article").count(), 1);
    const href = await page.locator("#formula-list a").getAttribute("href");
    await page.goto(base + href);
    await page.waitForSelector("#lecture-content:not([hidden])");
    assert.equal(await page.locator("#study-section-3").count(), 1);
    await page.waitForTimeout(400);
    const sectionTop = await page
      .locator("#study-section-3")
      .evaluate((e) => e.getBoundingClientRect().top);
    assert.ok(Math.abs(sectionTop) < 180, "section top " + sectionTop);
    await open("stata");
    assert.match(
      await page.locator("#study-view").innerText(),
      /Upcoming in the course/,
    );
    await page.locator('[data-workshop="7"]').check();
    await page.locator('input[name="stata-summary"][value="0"]').check();
    await page
      .locator('[data-action="stata-check"][data-id="summary"]')
      .click();
    assert.match(
      await page.locator("#stata-feedback-summary").innerText(),
      /Correct/,
    );
    await page.reload();
    await page.locator('[data-workshop="7"]').waitFor();
    assert.equal(await page.locator('[data-workshop="7"]').isChecked(), true);
    // Existing progress backup includes all eight tools, and reset/restore still works.
    const backup = await page.evaluate(() => exportProgressText());
    assert.equal(
      JSON.parse(backup).progress.statistics.explanations.ppv.text,
      text,
    );
    await page.evaluate(() => resetProgress());
    await page.reload();
    await page.locator('[data-workshop="7"]').waitFor();
    assert.equal(await page.locator('[data-workshop="7"]').isChecked(), false);
    await page.evaluate((b) => importProgressText(b), backup);
    await open();
    assert.match(
      await page.locator("#study-view").innerText(),
      /Questions attempted/,
    );
    assert.ok(
      Object.keys((await progress()).statistics.questions).length > 0,
      "restored questions",
    );
    assert.equal(
      (await progress()).statistics.explanations.ppv.text,
      text,
      "restored draft",
    );
    await page.screenshot({
      path: "/tmp/statistics-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(
      () => (document.documentElement.dataset.theme = "dark"),
    );
    for (const h of [
      "dashboard",
      "mistakes",
      "review",
      "mock",
      "calculations",
      "interpretation",
      "reference",
      "stata",
    ]) {
      await view(h);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        h + " fits mobile",
      );
    }
    await view("review");
    await page.locator('[data-action="start-review"]').click();
    await page.locator('input[name="session-answer"]').first().check();
    await page.locator('[data-action="check"]').click();
    await page.screenshot({
      path: "/tmp/statistics-mobile.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await ctx.close();
    // Both existing course question-bank and quiz submissions feed the shared records.
    const courseCtx = await browser.newContext();
    await courseCtx.route("**/*", (r) =>
      new URL(r.request().url()).hostname === "127.0.0.1"
        ? r.continue()
        : r.abort(),
    );
    const course = await courseCtx.newPage();
    const courseErrors = [];
    course.on("pageerror", (e) => courseErrors.push(e.message));
    await course.goto(
      base +
        "course.html?course=quant-methods&tab=practice&practiceTopic=" +
        q.topic,
    );
    await course
      .locator('[id="' + q.id + '"] .choice')
      .nth(right)
      .click();
    assert.equal(
      await course.evaluate(
        (id) => loadProgress().statistics.questions[id].source,
        q.id,
      ),
      "course practice",
    );
    const second = bank.find((x) => x.topic === q.topic && x.id !== q.id);
    await course.evaluate((question) => {
      const box = document.createElement("div");
      box.id = "bridge-quiz";
      document.body.appendChild(box);
      runQuiz(box, { course: { id: "quant-methods" } }, [question], {
        timed: false,
        onExit: () => {},
      });
    }, second);
    await course
      .locator("#bridge-quiz .choice")
      .nth(second.answer.charCodeAt(0) - 65)
      .click();
    assert.equal(
      await course.evaluate(
        (id) => loadProgress().statistics.questions[id].source,
        second.id,
      ),
      "course quiz",
    );
    assert.deepEqual(courseErrors, []);
    await courseCtx.close();
    // First connected visit seeds public data even before the new service worker takes control.
    const offlineCtx = await browser.newContext(),
      offline = await offlineCtx.newPage(),
      offlineErrors = [];
    offline.on("pageerror", (e) => offlineErrors.push(e.message));
    await offline.goto(base + "statistics.html");
    await offline.waitForSelector("#study-content:not([hidden])");
    await offline.waitForFunction(
      () =>
        document
          .querySelector("#study-offline")
          .textContent.includes("ready for offline"),
      { timeout: 30000 },
    );
    await offlineCtx.setOffline(true);
    await offline.reload();
    await offline.waitForSelector("#study-content:not([hidden])");
    for (const h of [
      "dashboard",
      "mistakes",
      "review",
      "mock",
      "calculations",
      "interpretation",
      "reference",
      "stata",
    ]) {
      await offline.locator('.study-nav a[href="#' + h + '"]').click();
      await offline.waitForFunction(
        (h) =>
          document.querySelector(".study-nav a[aria-current]").hash === "#" + h,
        h,
      );
    }
    await offline.locator('.study-nav a[href="#mock"]').click();
    await offline.locator('[data-action="start-mock"]').click();
    await offline.locator('input[name="session-answer"]').first().check();
    await offline.locator('[data-action="check"]').click();
    assert.equal(await offline.locator("#study-answer").count(), 1);
    assert.deepEqual(offlineErrors, []);
    await offlineCtx.close();
    // Restricted storage keeps the page useful and makes the limitation visible.
    const blockedCtx = await browser.newContext();
    await blockedCtx.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("blocked", "QuotaExceededError");
      };
    });
    const blocked = await blockedCtx.newPage();
    await blocked.goto(base + "statistics.html#mock");
    await blocked.waitForSelector("#study-content:not([hidden])");
    assert.equal(await blocked.locator("#storage-warning").isVisible(), true);
    await blocked.locator('[data-action="start-mock"]').click();
    await blocked.locator('input[name="session-answer"]').first().check();
    await blocked.locator('[data-action="check"]').click();
    assert.equal(await blocked.locator("#study-answer").count(), 1);
    await blockedCtx.close();
    console.log(
      "Statistics browser checks passed: eight tools, lecture bridge, timer/reload, feedback timing, numeric answers, drafts, backup, mobile/dark, offline and blocked storage.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
