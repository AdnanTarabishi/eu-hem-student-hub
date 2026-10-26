const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const root = path.resolve(process.argv[2] || ".");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json",
};

(async () => {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
      .replace(/^\/eu-hem-student-hub\//, "");
    const file = path.resolve(root, pathname || "index.html");
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      return res.end("missing");
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  }).listen(0, "127.0.0.1");

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const errors = [];
  try {
    const base = `http://127.0.0.1:${server.address().port}/eu-hem-student-hub/`;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      colorScheme: "light",
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.route(/^https?:\/\//, (route) => {
      const url = new URL(route.request().url());
      return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
    });

    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "review/fhem-final-review.html");
    await page.locator("#session-grid .session-card").first().waitFor();

    assert.equal(await page.locator("#session-grid .session-card").count(), 8);
    assert.equal(await page.locator("#rapid-workspace .quiz-card").count(), 1);
    assert.match(await page.locator("#exam-format").innerText(), /6|Multiple choice/);
    assert.match(await page.locator("#grossman-ta").innerText(), /Grossman in five pictures/);
    assert.match(await page.locator("#grossman-ta").innerText(), /More services after a fee cut/);

    await page.locator('[data-confidence-session="grossman"][data-confidence-value="3"]').click();
    assert.match(await page.locator("#readiness-summary").innerText(), /1 of 8 sessions marked ready/);

    await page.locator("#rapid-workspace .quiz-options button").nth(1).click();
    assert.match(await page.locator("#rapid-workspace .quiz-feedback").innerText(), /Correct/);

    const correct = {
      "d-a1": "B",
      "d-a2": "A",
      "d-a3": "A",
      "d-a4": "A",
      "d-a5": "B",
      "d-a6": "A",
      "d-b1": "2",
      "d-b2": "2",
    };
    for (const [name, value] of Object.entries(correct)) {
      await page.locator(`input[name="${name}"][value="${value}"]`).check();
    }
    await page.locator("#diagnostic-submit").click();
    assert.match(await page.locator(".diagnostic-score").innerText(), /46/);

    await page.locator("#open-draft-text").fill("Diagnosis mechanisms trade-offs policy recommendation monitoring.");
    assert.match(await page.locator("#draft-word-count").innerText(), /6 words/);

    await page.locator('#review-plan input[data-task="fast-format"]').check();
    assert.match(await page.locator(".plan-head").innerText(), /1\/8 steps complete/);

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await context.close();

    for (const scheme of ["light", "dark"]) {
      const mobile = await browser.newContext({
        viewport: { width: 320, height: 900 },
        colorScheme: scheme,
        serviceWorkers: "block",
        reducedMotion: "reduce",
      });
      await mobile.route(/^https?:\/\//, (route) => {
        const url = new URL(route.request().url());
        return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
      });
      const mobilePage = await mobile.newPage();
      mobilePage.on("pageerror", (error) => errors.push(error.message));
      await mobilePage.goto(base + "review/fhem-final-review.html");
      await mobilePage.locator("#session-grid .session-card").first().waitFor();
      assert.equal(
        await mobilePage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
        `${scheme} 320px layout has no horizontal overflow`
      );
      await mobilePage.locator("#rapid-workspace .quiz-options button").first().waitFor();
      await mobile.close();
    }

    assert.deepEqual(errors, []);
    console.log("PASS: final review renders, saves progress, scores 6+2 diagnostic, supports dark mode and has no 320px overflow.");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
