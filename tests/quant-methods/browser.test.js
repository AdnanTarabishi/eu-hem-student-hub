const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright");
const root = path.resolve("."),
  mime = {
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
      const file = path.resolve(
        root,
        decodeURIComponent(req.url.split("?")[0]).replace(/^\//, "") ||
          "index.html",
      );
      if (
        !file.startsWith(root + path.sep) ||
        !fs.existsSync(file) ||
        fs.statSync(file).isDirectory()
      ) {
        res.writeHead(404);
        return res.end("missing");
      }
      res.setHeader("content-type", mime[path.extname(file)] || "text/plain");
      res.end(fs.readFileSync(file));
    })
    .listen(0);
  const browser = await chromium.launch(
      fs.existsSync("/usr/bin/chromium")
        ? { executablePath: "/usr/bin/chromium" }
        : { channel: "chrome" },
    ),
    base = `http://127.0.0.1:${server.address().port}/`;
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.route("**/*", (r) =>
      new URL(r.request().url()).hostname === "127.0.0.1"
        ? r.continue()
        : r.abort(),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.stack));
    const openCourse = async (tab = "overview") => {
      await page.goto(base + "course.html?course=quant-methods&tab=" + tab);
      await page.waitForSelector(
        tab === "overview" ? "#qm-demo-se" : "#qm-lesson-search",
      );
    };
    await openCourse();
    assert.equal(await page.locator(".qm-module").count(), 2);
    assert.match(
      await page.locator(".qm-module").last().innerText(),
      /Econometrics/,
    );
    assert.match(
      await page.locator(".qm-module").last().innerText(),
      /awaiting course materials/,
    );
    assert.equal(await page.locator("#qm-demo-se").innerText(), "2.00 kg");
    assert.equal(
      await page.locator("#qm-demo-ci").innerText(),
      "66.08 – 73.92 kg",
    );
    await page.locator("#qm-demo-size").fill("2");
    assert.equal(await page.locator("#qm-demo-se").innerText(), "1.00 kg");
    assert.equal(
      await page.locator("#qm-demo-ci").innerText(),
      "68.04 – 71.96 kg",
    );
    await page.screenshot({
      path: "/tmp/quant-methods-desktop.png",
      fullPage: true,
    });
    await openCourse("lectures");
    assert.equal(await page.locator(".qm-lesson-card").count(), 6);
    await page.locator("#qm-lesson-search").fill("confidence");
    assert.equal(await page.locator(".qm-lesson-card:visible").count(), 1);
    assert.match(
      await page.locator(".qm-lesson-card:visible").innerText(),
      /uncertainty in a mean/,
    );
    await page.locator("#qm-lesson-search").fill("nonsense-no-match");
    assert.equal(await page.locator("#qm-search-empty").isVisible(), true);
    await page.locator("#qm-lesson-search").fill("");
    await page
      .locator('.qm-lesson-card[data-topic="statistics.sampling"] h3 a')
      .click();
    await page.waitForSelector("#lecture-content:not([hidden])");
    assert.equal(await page.locator(".qm-outline-link").count(), 6);
    assert.equal(await page.locator(".qm-concept-check").count(), 6);
    assert.match(
      await page.locator(".qm-outcome-card").innerText(),
      /Distinguish SD from SE/,
    );
    // Concept checks select their actual bank question, while keeping an earlier saved response.
    const check = page.locator("[data-qm-question]").first();
    const id = await check.getAttribute("data-qm-question");
    await check.click();
    const q = require("../../content/modules/statistics/questions.json").find(
        (q) => q.id === id,
      ),
      right = q.answer.charCodeAt(0) - 65;
    assert.equal(
      await page.locator("#question-heading").innerText(),
      q.question,
    );
    await page.locator(`input[name="answer"][value="${right}"]`).check();
    await page.locator("#check-answer").click();
    await page.locator('.nav [data-view="learn"]').click();
    await page.locator('[data-qm-question="' + id + '"]').click();
    assert.equal(await page.locator("#answer-feedback").count(), 1);
    await page.locator('.nav [data-view="learn"]').click();
    await page.locator("#mark-read").click();
    await page.screenshot({
      path: "/tmp/quant-methods-lecture.png",
      fullPage: true,
    });
    await page.locator('.qm-lesson-next a[href*="#calculations"]').click();
    await page.waitForSelector("#study-content:not([hidden])");
    assert.equal(
      await page.locator("#study-topic-filter").inputValue(),
      "statistics.sampling",
    );
    assert.equal(await page.locator("[data-exercise]").count(), 2);
    assert.equal(await page.locator('[data-exercise="se"]').count(), 1);
    assert.equal(await page.locator('[data-exercise="ci"]').count(), 1);
    await page
      .locator("#study-topic-filter")
      .selectOption("statistics.risk-uncertainty");
    assert.equal(await page.locator("[data-exercise]").count(), 1);
    await page.locator('[data-exercise="union"] input').fill("0.6");
    await page.locator('[data-exercise="union"] button[type="submit"]').click();
    assert.match(await page.locator(".calc-feedback").innerText(), /Correct/);
    await page.locator('.study-nav a[href="#interpretation"]').click();
    await page.locator("#draft-population").waitFor();
    assert.equal(await page.locator("textarea").count(), 1);
    assert.equal(await page.locator("#draft-population").count(), 1);
    await page.locator('.study-nav a[href="#reference"]').click();
    await page.locator("#formula-list article").first().waitFor();
    assert.equal(await page.locator("#formula-list article").count(), 1);
    await page.locator('[data-action="node"][data-id="concept-5"]').click();
    assert.equal(
      await page.locator("#study-topic-filter").inputValue(),
      "statistics.sampling",
    );
    assert.equal(await page.locator("#formula-list article").count(), 2);
    await page.locator('.study-nav a[href="#review"]').click();
    await page.locator('[data-action="start-review"]').click();
    await page.locator('input[name="session-answer"]').first().waitFor();
    const review = await page.evaluate(() => loadProgress().statistics.active);
    assert.ok(
      review.ids.every(
        (id) =>
          require("../../content/modules/statistics/questions.json").find(
            (q) => q.id === id,
          ).topic === "statistics.sampling",
      ),
      "review scoped to Class 5 IDs",
    );
    page.once("dialog", (d) => d.accept());
    await page.locator('[data-action="discard"]').click();
    await page.locator('.study-nav a[href="#mock"]').click();
    await page.waitForFunction(() =>
      document
        .querySelector("#study-focus-note")
        .textContent.includes("all six covered classes"),
    );
    assert.match(
      await page.locator("#study-focus-note").innerText(),
      /all six covered classes/,
    );
    await page.locator("#study-topic-filter").selectOption("");
    await page.screenshot({
      path: "/tmp/quant-methods-tools.png",
      fullPage: true,
    });
    // Small-screen navigation stays reachable; the complete page never scrolls sideways.
    const fits = async (label) =>
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        label + " fits",
      );
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await openCourse();
      await fits("overview " + width);
      await openCourse("lectures");
      await fits("path " + width);
      await page.goto(base + "lecture.html?topic=statistics.probability");
      await page.waitForSelector("#lecture-content:not([hidden])");
      await fits("lecture " + width);
      for (const mode of ["explore", "practice"]) {
        await page.locator('.nav [data-view="' + mode + '"]').click();
        await fits(mode + " " + width);
      }
      await page.goto(base + "statistics.html#calculations");
      await page.waitForSelector("#study-content:not([hidden])");
      await fits("tools " + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator(".theme-toggle").click();
    await page.waitForFunction(
      () =>
        getComputedStyle(document.body).backgroundColor === "rgb(16, 30, 35)",
    );
    assert.equal(
      await page.locator(".theme-toggle").getAttribute("aria-label"),
      "Switch to light mode",
    );
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
      "rgb(16, 30, 35)",
    );
    await page.screenshot({
      path: "/tmp/quant-methods-mobile-dark.png",
      fullPage: true,
    });
    await openCourse();
    await page.screenshot({
      path: "/tmp/quant-methods-mobile-course.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(() => loadProgress().topics["statistics.sampling"]),
      "read",
    );
    // The redesigned workspace, guide links and focused tools remain usable offline.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => {
      const c = await caches.open("data");
      return !!(await c.match(
        new URL("content/modules/statistics/study-path.json", location.href)
          .href,
      ));
    });
    await context.setOffline(true);
    await page.reload();
    await page.locator("#qm-demo-se").waitFor();
    await page.locator("#qm-demo-size").fill("0");
    assert.equal(await page.locator("#qm-demo-se").innerText(), "4.00 kg");
    await page.goto(base + "lecture.html?topic=statistics.sampling#learn");
    await page.waitForSelector("#lecture-content:not([hidden])");
    assert.equal(await page.locator(".qm-outline-link").count(), 6);
    await page.goto(
      base + "statistics.html?topic=statistics.sampling#calculations",
    );
    await page.waitForSelector("#study-content:not([hidden])");
    assert.equal(await page.locator("[data-exercise]").count(), 2);
    await context.setOffline(false);
    await page.goto(base + "course.html?course=fund-health-economics");
    await page.locator(".course-header").waitFor();
    assert.equal(await page.locator("body.qm-page").count(), 0);
    assert.equal(await page.locator(".qm-identity").count(), 0);
    const otherTopic =
      require("../../content/modules/fund-health-economics/topics.json").find(
        (t) => t.lecture,
      );
    await page.goto(base + "lecture.html?topic=" + otherTopic.id);
    await page.waitForSelector("#lecture-content:not([hidden])");
    assert.equal(await page.locator("body.qm-page").count(), 0);
    assert.equal(await page.locator(".qm-outline").count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "Quantitative Methods redesign passed: two modules, live CI demo, search, contextual questions, focused tools, saved progress, mobile/dark, offline and other-course isolation.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
