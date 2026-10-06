// Six guides and 120 questions, genuine browser interactions and offline reload.
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright");
const root = path.resolve(process.argv[2] || ".");
const topics = JSON.parse(
  fs.readFileSync(path.join(root, "content/modules/statistics/topics.json")),
).filter((t) => t.lecture);
const bank = JSON.parse(
  fs.readFileSync(path.join(root, "content/modules/statistics/questions.json")),
);
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
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(
    fs.existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : { channel: "chrome" },
  );
  try {
    assert.equal(topics.length, 6);
    assert.equal(bank.length, 120);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const open = async (topic) => {
      await page.goto(base + "lecture.html?topic=" + topic);
      await page.waitForSelector("#lecture-content:not([hidden])");
    };
    await page.goto(base + "course.html?course=quant-methods&tab=lectures");
    await page.waitForSelector('a.topic-title[href*="lecture.html"]');
    assert.equal(
      await page.locator('a.topic-title[href*="lecture.html"]').count(),
      6,
    );
    assert.equal(
      await page
        .locator('a[href^="https://virtuale.unibo.it/course/section.php"]')
        .count(),
      6,
    );
    assert.match(
      await page.locator(".course-panel").textContent(),
      /not taken yet/,
    );
    for (const topic of topics) {
      await open(topic.id);
      assert.equal(
        await page.locator("#lecture-question-count").textContent(),
        "20 practice questions",
      );
      assert.equal(
        await page.locator('#lecture-sequence [aria-current="page"]').count(),
        1,
      );
      assert.ok(
        (await page.locator("#lecture-guide").textContent()).length > 2000,
      );
      await page.locator("#mark-read").click();
      await page.locator(".nav [data-view=practice]").click();
      const questions = bank.filter((q) => q.topic === topic.id);
      for (const q of questions) {
        await page
          .locator(".option")
          .nth(q.answer.charCodeAt(0) - 65)
          .click();
        await page.locator("#check-answer").click();
        assert.match(
          await page.locator("#answer-feedback").textContent(),
          /That’s right/,
        );
        await page.locator("#next-question").click();
      }
      assert.equal(await page.locator(".review-item").count(), 20);
      assert.match(
        await page.locator(".result-score").textContent(),
        /20\s*\/\s*20/,
      );
      await page.reload();
      await page.waitForSelector("#lecture-content:not([hidden])");
      assert.equal(
        await page.locator("#quiz-progress-text").textContent(),
        "20 of 20 checked",
      );
      await page.locator(".nav [data-view=explore]").click();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          topic.id + " Explore at " + width,
        );
      }
      await page.setViewportSize({ width: 390, height: 1000 });
      await page.locator(".nav [data-view=learn]").click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        topic.id + " Learn on phone",
      );
      await page.locator(".nav [data-view=practice]").click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        topic.id + " Practice on phone",
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    console.log(
      "PASS: six guides, every answer in 120 MCQs, separate saved progress, lecture navigation and responsive layouts.",
    );
    assert.equal(
      await page.evaluate(() => Object.keys(loadProgress().lectures).length),
      6,
    );
    const backup = await page.evaluate(() => exportProgressText());
    await page.evaluate(() => resetProgress());
    await page.evaluate((text) => importProgressText(text), backup);
    assert.equal(
      await page.evaluate(() => Object.keys(loadProgress().lectures).length),
      6,
    );
    await open("statistics.risk-uncertainty");
    await page.locator(".nav [data-view=explore]").click();
    assert.match(await page.locator("#events-output").textContent(), /5\/6/);
    while (await page.locator('[data-set="B"][aria-pressed="true"]').count())
      await page.locator('[data-set="B"][aria-pressed="true"]').first().click();
    assert.match(
      await page.locator("#events-output").textContent(),
      /undefined/,
    );
    await open("statistics.probability");
    await page.locator(".nav [data-view=explore]").click();
    assert.match(await page.locator("#diag-ppv").textContent(), /0.6522/);
    await page.fill("#diag-prev", "1");
    assert.match(await page.locator("#diag-ppv").textContent(), /0.0704/);
    await page.fill("#diag-prev", "0");
    await page.fill("#diag-spec", "100");
    assert.match(await page.locator("#diag-ppv").textContent(), /undefined/);
    await page.fill("#bin-n", "1.5");
    assert.ok(await page.locator("#bin-error").isVisible());
    await page.fill("#bin-n", "3");
    await page.fill("#bin-p", "0");
    assert.ok(await page.locator("#bin-output").isVisible());
    await open("statistics.random-variables");
    await page.locator(".nav [data-view=explore]").click();
    assert.match(
      await page.locator("#normal-probability").textContent(),
      /0.0478/,
    );
    await page.click('[data-normal="standard"]');
    assert.match(
      await page.locator("#normal-probability").textContent(),
      /0.9500/,
    );
    await page.fill("#normal-sd", "0");
    assert.ok(await page.locator("#normal-error").isVisible());
    await page.fill("#normal-sd", "1");
    await page.fill("#normal-high", "-2");
    assert.ok(await page.locator("#normal-error").isVisible());
    assert.match(
      await page.locator("#uniform-probability").textContent(),
      /0.3333/,
    );
    await page.fill("#uniform-low", "60");
    await page.fill("#uniform-high", "70");
    assert.match(
      await page.locator("#uniform-probability").textContent(),
      /0.0000/,
    );
    await open("statistics.descriptive");
    await page.locator(".nav [data-view=explore]").click();
    await page.fill("#describe-values", "2,4,6");
    assert.match(
      await page.locator("#describe-output").textContent(),
      /Sample variance4/,
    );
    await page.fill("#describe-values", "2,abc,6");
    assert.ok(await page.locator("#describe-error").isVisible());
    await page.click('[data-design="0"]');
    assert.match(
      await page.locator("#design-feedback").textContent(),
      /Correct/,
    );
    await page.click("#design-next");
    await page.click('[data-design="0"]');
    assert.match(
      await page.locator("#design-feedback").textContent(),
      /Revisit: Cohort/,
    );
    await open("statistics.inference");
    await page.locator(".nav [data-view=explore]").click();
    assert.equal(await page.locator("#test-p").textContent(), "0.0077");
    assert.equal(await page.locator("#test-ci").textContent(), "3.596 – 6.404");
    await page.selectOption("#test-assumption", "unknown");
    assert.ok(await page.locator("#test-error").isVisible());
    await page.fill("#test-n", "100");
    assert.ok(await page.locator("#test-output").isVisible());
    await page.selectOption("#test-kind", "z");
    await page.fill("#test-mean", "7");
    assert.match(
      await page.locator("#test-decision").textContent(),
      /Do not reject/,
    );
    await page.fill("#test-sd", "");
    assert.ok(await page.locator("#test-error").isVisible());
    console.log(
      "PASS: every new activity, numeric examples, undefined conditioning, endpoint probabilities, invalid inputs and small-sample assumption check.",
    );
    await page.fill("#test-sd", "3");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.waitForFunction(() =>
      document
        .getElementById("lecture-offline-status")
        .textContent.includes("ready"),
    );
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector("#lecture-content:not([hidden])");
    await page.locator(".nav [data-view=explore]").click();
    assert.equal(await page.locator("#test-p").textContent(), "0.0077");
    await page.fill("#test-mean", "7");
    assert.match(
      await page.locator("#test-decision").textContent(),
      /Do not reject/,
    );
    await page.screenshot({
      path: "/tmp/euhem-statistics-class6.png",
      fullPage: true,
    });
    await context.setOffline(false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: shared backup/restore, dark mode and real offline reload with working t calculations; no JavaScript errors.",
    );
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
