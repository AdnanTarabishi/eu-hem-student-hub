// Student Experiences browser checks: node tests/experiences/browser.test.js .
// All answers are fictional. The real receiver is replaced before any page script
// runs, and every other request outside this local server is blocked.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(process.argv[2] || ".");
const SHOTS = path.resolve(process.env.SCREENSHOT_DIR || path.join(ROOT, "work/experience-qa"));
const PREFIX = "/eu-hem-student-hub/";
const ENDPOINT = "https://script.google.com/macros/s/QA_EXPERIENCES_FIXTURE_ONLY/exec";
const RECEIPT = "00000000-0000-4000-8000-000000000042";
const RECEIVED_AT = "2026-10-10T08:30:00.000Z";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORY = "Fictional QA advice: allow time to settle into the new city and check current university guidance before making plans.";
const TIP = "Fictional QA tip: compare the total housing cost before choosing a room.";
const SEED_KEY = "euhem-experience-qa-sentinel";
const DRAFT_KEY = "euhemExperienceDraftV2";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".csv": "text/csv",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};
let checks = 0;
const ok = (message) => { checks++; console.log("  ok  " + message); };
const response = (route, payload) => route.fulfill({
  status: 200, contentType: "application/json",
  headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(payload),
});
const acknowledgement = (payload, overrides = {}) => ({
  ok: true, requestId: payload.requestId, noticeVersion: payload.noticeVersion,
  receiptId: RECEIPT, receivedAt: RECEIVED_AT, ...overrides,
});

function serve(request, result) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch { result.writeHead(400); return result.end("Bad URL"); }
  const relative = pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length) : "";
  const file = path.resolve(ROOT, relative || "index.html");
  if (!pathname.startsWith(PREFIX) || !file.startsWith(ROOT + path.sep)) {
    result.writeHead(404); return result.end("Not found");
  }
  fs.readFile(file, (error, bytes) => {
    if (error) { result.writeHead(404); return result.end("Not found"); }
    result.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    result.end(bytes);
  });
}

async function noSideways(page, label, selector = "html") {
  const overflow = await page.locator(selector).evaluate((element) => element.scrollWidth - element.clientWidth);
  assert.ok(overflow <= 1, `${label}: ${selector} has ${overflow}px horizontal overflow`);
}

async function capture(page, name, fullPage = false) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage, animations: "disabled" });
}

async function showBelowHeader(page, selector) {
  await page.locator(selector).evaluate((element) => {
    const header = document.querySelector(".site-header").getBoundingClientRect().height;
    scrollTo({ top: scrollY + element.getBoundingClientRect().top - header - 16, behavior: "instant" });
  });
}

const activeStep = (page) => page.locator(".ex-form-step.is-active").getAttribute("data-step");
const next = (page) => page.locator("#ex-form-next").click();
const field = (page, name) => page.locator(`#ex-form [name="${name}"]`);

async function fillAbout(page) {
  await field(page, "stage").selectOption("Current student");
  await field(page, "scope").selectOption("City or semester experience");
  await field(page, "cohort").fill("Fictional cohort");
  await field(page, "background").fill("Fictional field");
}

async function fillMainAdvice(page) {
  await field(page, "title").fill("  Fictional first-semester advice  ");
  await field(page, "story").fill("  " + STORY + "  ");
  await field(page, "tip1").fill("  " + TIP + "  ");
}

async function fillToReview(page, { planned = true, audience = "public" } = {}) {
  await fillAbout(page);
  await next(page);
  assert.equal(await activeStep(page), "1");
  await page.locator("#journey-bologna").selectOption("completed");
  if (planned) await page.locator("#journey-oslo").selectOption("planned");
  await next(page);
  assert.equal(await activeStep(page), "2");
  await fillMainAdvice(page);
  await next(page);
  assert.equal(await activeStep(page), "3");
  await page.locator('#ex-form input[name="topics"][value="housing"]').check();
  await field(page, "detail_housing").fill("Fictional housing detail for the QA fixture.");
  await next(page);
  assert.equal(await activeStep(page), "4");
  await field(page, "audience").selectOption(audience);
}

async function values(page) {
  return page.locator("#ex-form").evaluate((form) => Array.from(form.elements)
    .filter((element) => element.matches("input, textarea, select") && element.type !== "file")
    .map((element) => ({ name: element.name || element.id, value: element.value, checked: element.checked })));
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const configSource = fs.readFileSync(path.join(ROOT, "contact-config.js"), "utf8");
  const endpointSetting = /\bendpoint:\s*"(?:[^"\\]|\\.)*"/g;
  assert.equal([...configSource.matchAll(endpointSetting)].length, 1, "replace exactly one public endpoint setting");
  const server = http.createServer(serve);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const base = origin + PREFIX;
  const errors = [], forbidden = [];
  let browser, lastPage, label = "startup";

  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined) });
    const open = async ({ width = 1440, height = 1000, scheme = "light", scripts = true, endpoint = ENDPOINT, handler } = {}) => {
      const context = await browser.newContext({
        viewport: { width, height }, colorScheme: scheme, locale: "en-GB", timezoneId: "Europe/Rome",
        javaScriptEnabled: scripts, reducedMotion: "reduce", serviceWorkers: "block",
      });
      const posts = [], localRequests = [], blocked = [];
      await context.addInitScript((key) => {
        delete Navigator.prototype.serviceWorker;
        if (!localStorage.getItem(key)) localStorage.setItem(key, "keep this fictional value");
      }, SEED_KEY);
      await context.route("**/*", async (route) => {
        const request = route.request(), url = request.url();
        if (url === ENDPOINT) {
          if (request.method() !== "POST") { forbidden.push(`${request.method()} ${url}`); return route.abort(); }
          let payload;
          try { payload = JSON.parse(request.postData()); }
          catch { forbidden.push("non-JSON fixture submission"); return route.abort(); }
          const entry = { payload, raw: request.postData(), headers: request.headers() };
          posts.push(entry);
          return handler ? handler(route, entry, posts.length) : response(route, acknowledgement(payload));
        }
        if (new URL(url).origin !== origin) {
          blocked.push(`${request.method()} ${url}`);
          if (request.method() !== "GET" || request.postData() !== null) forbidden.push(`${request.method()} ${url}`);
          return route.abort();
        }
        localRequests.push({ url, method: request.method(), body: request.postData(), resourceType: request.resourceType() });
        if (request.method() !== "GET" || request.postData() !== null) {
          forbidden.push(`${request.method()} ${url}`); return route.abort();
        }
        if (new URL(url).pathname === PREFIX + "contact-config.js") {
          return route.fulfill({ contentType: "text/javascript", body: configSource.replace(endpointSetting, `endpoint: ${JSON.stringify(endpoint)}`) });
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      if (scripts) await page.clock.setFixedTime(new Date(RECEIVED_AT));
      page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
      page.on("response", (result) => {
        if (result.url().startsWith(base) && result.status() >= 400) errors.push(`HTTP ${result.status()} ${result.url()}`);
      });
      lastPage = page;
      await page.goto(base + "experiences.html");
      if (scripts) await page.locator("#ex-grid .ex-card").first().waitFor();
      return { page, context, posts, localRequests, blocked };
    };
    const close = async (fixture) => {
      assert.equal(await fixture.page.evaluate((key) => localStorage.getItem(key), SEED_KEY), "keep this fictional value", "unrelated device data stays intact");
      assert.deepEqual(fixture.blocked, [], "the page does not request unapproved remote assets or services");
      await fixture.context.close();
    };
    const confirmed = async (fixture) => {
      await fixture.page.waitForFunction((receipt) => document.getElementById("ex-submit-receipt")?.textContent.includes(receipt), RECEIPT);
      assert.match(await fixture.page.locator("#ex-submit-status").innerText(), /receiv|review/i);
    };
    const unconfirmed = async (fixture) => {
      await fixture.page.waitForFunction(() => {
        const button = document.getElementById("ex-submit"), status = document.getElementById("ex-submit-status");
        return button && !button.disabled && /confirm|retry|may have/i.test(status?.textContent || "");
      });
      assert.equal((await fixture.page.locator("#ex-submit-receipt").innerText()).trim(), "");
    };

    // The remaining assertions follow the questionnaire's actual user decisions,
    // rather than reproducing its internal implementation.
    label = "JavaScript-disabled";
    let fixture = await open({ scripts: false }), page = fixture.page;
    assert.equal(await page.locator("#ex-form-fields").evaluate((element) => element.disabled), true);
    assert.equal(await page.locator("#ex-submit").isDisabled(), true);
    assert.match((await page.locator("noscript").allTextContents()).join(" "), /JavaScript/i);
    assert.equal(fixture.posts.length, 0);
    await fixture.context.close();
    ok("disabled JavaScript keeps questionnaire controls disabled with an explanatory notice");

    label = "unconfigured-receiver";
    for (const endpoint of ["", "https://example.invalid/collect"]) {
      fixture = await open({ endpoint }); page = fixture.page;
      assert.equal(await page.locator("#ex-submit").isDisabled(), true);
      assert.equal(await page.locator("#ex-form-fields").evaluate((element) => element.disabled), false, "unavailable delivery still allows a local draft");
      assert.equal(fixture.posts.length, 0, "configuration never probes the receiver");
      await close(fixture);
    }
    ok("empty and invalid receiver settings disable sending while retaining local drafting without remote probes");

    label = "library-interactions";
    fixture = await open(); page = fixture.page;
    const initial = await page.locator("#ex-grid .ex-card").count();
    assert.ok(initial >= 3, "curated source stories are available");
    const firstId = await page.locator("#ex-grid .ex-card").first().getAttribute("data-story-id");
    await page.locator("#ex-grid .ex-card").first().getByRole("button", { name: /^Save$/ }).click();
    await page.locator("#ex-saved-toggle").click();
    assert.equal(await page.locator("#ex-grid .ex-card").count(), 1);
    assert.equal(await page.locator("#ex-grid .ex-card").getAttribute("data-story-id"), firstId);
    await page.locator("#ex-search").fill("no-fixture-story-could-match-this");
    assert.equal(await page.locator("#ex-grid .ex-card").count(), 0);
    assert.match(await page.locator("#ex-grid").innerText(), /No saved stories|No stories/i);
    await page.locator("#ex-reset").click();
    assert.equal(await page.locator("#ex-grid .ex-card").count(), initial);
    await page.locator("#ex-city").selectOption("oslo");
    const matchingCities = await page.locator("#ex-grid .ex-card").evaluateAll((cards) => cards.map((card) => card.dataset.storyId));
    const expectedCities = await page.evaluate(() => window.EUHEM_EXPERIENCES.stories.filter((story) => story.cities.includes("oslo")).map((story) => story.id));
    assert.deepEqual(matchingCities.sort(), expectedCities.sort(), "city filter uses lived cities covered by each source");
    await page.locator("#ex-reset").click();
    await page.locator('[data-ex-view="list"]').click();
    assert.equal(await page.locator('[data-ex-view="list"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#ex-grid").evaluate((element) => element.classList.contains("is-list")), true);
    await page.reload();
    assert.equal(await page.locator('[data-ex-view="list"]').getAttribute("aria-pressed"), "true", "explicit layout choice survives reload");
    await page.locator('[data-ex-view="grid"]').click();
    const opener = page.locator("#ex-grid .ex-card").first().getByRole("button", { name: /Read overview/ });
    await opener.focus(); await page.keyboard.press("Enter");
    await page.locator("#ex-story-dialog").waitFor({ state: "visible" });
    assert.equal(await page.locator("#ex-story-dialog").evaluate((element) => element.matches(":modal")), true);
    await page.keyboard.press("Escape");
    await page.locator("#ex-story-dialog").waitFor({ state: "hidden" });
    await page.waitForFunction(() => !new URLSearchParams(location.search).has("story"));
    assert.equal(new URL(page.url()).searchParams.has("story"), false, "Escape clears the story URL state");
    assert.equal(await opener.evaluate((element) => document.activeElement === element), true, "closing the reader restores keyboard focus");
    assert.equal(fixture.posts.length, 0, "library interactions never submit answers");
    await close(fixture);
    ok("saved stories, source-aware city filtering, no-results feedback, remembered grid/list layout and keyboard reader work");

    label = "questionnaire-validation";
    fixture = await open(); page = fixture.page;
    await next(page); assert.equal(await activeStep(page), "0", "context is required");
    await field(page, "cohort").fill("Early Enter QA marker");
    await field(page, "cohort").press("Enter");
    assert.equal(await activeStep(page), "0");
    assert.equal(new URL(page.url()).searchParams.has("cohort"), false, "Enter must not leak answers into a GET URL");
    assert.equal(fixture.localRequests.filter((request) => request.resourceType === "document").length, 1, "early Enter does not navigate the form");
    await fillAbout(page); await next(page); assert.equal(await activeStep(page), "1");
    await page.locator("#journey-oslo").selectOption("planned");
    await next(page); assert.equal(await activeStep(page), "1", "a plan alone is not lived experience");
    await page.locator("#journey-bologna").selectOption("in_progress");
    await next(page); assert.equal(await activeStep(page), "2");
    await fillMainAdvice(page); await field(page, "title").fill("   ");
    await next(page); assert.equal(await activeStep(page), "2", "whitespace is not a meaningful required title");
    await fillMainAdvice(page); await field(page, "story").fill("   ");
    await next(page); assert.equal(await activeStep(page), "2", "whitespace is not a required answer");
    await fillMainAdvice(page); await field(page, "tip1").fill("   ");
    await next(page); assert.equal(await activeStep(page), "2", "the first practical tip is required");
    await fillMainAdvice(page);
    assert.equal(await field(page, "tip2").getAttribute("required"), null, "one useful practical tip is enough");
    await next(page); assert.equal(await activeStep(page), "3");
    await next(page); assert.equal(await activeStep(page), "3", "a contribution needs at least one topic");
    await page.locator('#ex-form input[name="topics"][value="housing"]').check();
    await next(page); assert.equal(await activeStep(page), "4");
    const audienceOptions = await field(page, "audience").locator("option").evaluateAll((options) => options.map((option) => option.value));
    assert.deepEqual(audienceOptions.sort(), ["public", "unpublished"], "audience records a review preference without promising member access");
    assert.equal(await field(page, "replyEmail").getAttribute("type"), "email");
    assert.equal(await field(page, "replyEmail").getAttribute("required"), null, "a reply email is optional");
    await field(page, "nameMode").selectOption("display");
    await field(page, "displayName").fill("   ");
    await field(page, "reviewConsent").check();
    await page.locator("#ex-submit").click();
    assert.equal(fixture.posts.length, 0, "named attribution needs a nonempty name");
    await field(page, "nameMode").selectOption("anonymous");
    await field(page, "reviewConsent").uncheck();
    await page.locator("#ex-submit").click();
    assert.equal(fixture.posts.length, 0, "private review requires deliberate consent");
    await field(page, "reviewConsent").check();
    await field(page, "replyEmail").fill("not-an-email");
    await page.locator("#ex-submit").click();
    assert.equal(fixture.posts.length, 0, "an invalid optional reply address cannot be sent");
    await field(page, "replyEmail").fill("");
    await page.locator("#ex-submit").click(); await confirmed(fixture);
    assert.equal(fixture.posts.length, 1);
    const payload = fixture.posts[0].payload;
    assert.equal(payload.topic, "contribution");
    assert.match(payload.requestId, UUID);
    assert.equal(payload.noticeVersion, "contact-v1-2026-10");
    assert.equal(payload.email, "");
    assert.equal(payload.name, "", "anonymous choice excludes unused name text");
    assert.equal(payload.website, "");
    assert.match(payload.message, /Fictional first-semester advice/);
    assert.match(payload.message, /Bologna/);
    assert.match(payload.message, /Oslo/);
    await capture(page, "confirmed-private-review");
    ok("five-step validation rejects whitespace, plans-only journeys, missing topics/name/consent and invalid email; valid anonymous answers receive a matching receipt");

    label = "receipt-after-edit-or-import";
    const originalTitle = await field(page, "title").inputValue();
    const originalStory = await field(page, "story").inputValue();
    const originalReceipt = await page.locator("#ex-submit-receipt").innerText();
    await page.locator("#ex-form-back").click();
    await page.locator("#ex-form-back").click();
    await field(page, "title").fill("Fictional advice edited after confirmed receipt");
    await field(page, "story").fill("This fictional experience was edited after sending. These changed answers have not been submitted.");
    await next(page); await next(page);
    assert.match(await page.locator("#ex-submit-status").innerText(), /edited answers have not been sent/i);
    assert.equal(await page.locator("#ex-submit-receipt").isVisible(), false, "an old receipt must not acknowledge edited answers");
    assert.equal(fixture.posts.length, 1, "editing answers does not create another submission");
    await capture(page, "edited-after-receipt");
    await page.locator("#ex-form-back").click();
    await page.locator("#ex-form-back").click();
    await field(page, "title").fill(originalTitle);
    await field(page, "story").fill(originalStory);
    await next(page); await next(page);
    assert.equal(await page.locator("#ex-submit-receipt").isVisible(), true, "restoring the exact accepted answers restores their receipt");
    assert.equal(await page.locator("#ex-submit-receipt").innerText(), originalReceipt);
    assert.match(await page.locator("#ex-submit-status").innerText(), /receiv|review/i);
    assert.equal(fixture.posts.length, 1, "restoring accepted answers does not resend them");
    const afterReceiptDownload = page.waitForEvent("download");
    await page.locator("#ex-download-draft").click();
    const afterReceiptDraft = JSON.parse(fs.readFileSync(await (await afterReceiptDownload).path(), "utf8"));
    afterReceiptDraft.data.title = "Fictional imported advice after receipt";
    await page.locator("#ex-import-file").setInputFiles({
      name: "fictional-edited-experience.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(afterReceiptDraft)),
    });
    await page.waitForFunction(() => document.getElementById("ex-form").elements.title.value === "Fictional imported advice after receipt");
    assert.match(await page.locator("#ex-submit-status").innerText(), /edited answers have not been sent/i);
    assert.equal(await page.locator("#ex-submit-receipt").isVisible(), false, "an imported changed draft must not inherit a previous receipt");
    assert.equal(await field(page, "reviewConsent").isChecked(), false, "import still requires new review permission");
    assert.equal(fixture.posts.length, 1, "importing a draft does not submit it");
    await capture(page, "imported-after-receipt");
    await close(fixture);
    ok("editing or importing answers after success hides the stale receipt, while restoring the accepted text restores its reference without resending");

    label = "draft-privacy";
    fixture = await open(); page = fixture.page;
    await fillToReview(page, { audience: "unpublished" });
    await field(page, "replyEmail").fill("fixture-reply@example.invalid");
    await field(page, "reviewConsent").check();
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY), null, "typing does not save a draft automatically");
    await page.locator("#ex-save-draft").click();
    const draft = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
    assert.equal(draft.version, 2);
    assert.equal(Object.hasOwn(draft.data, "replyEmail"), false, "reply address is excluded from explicit device drafts");
    assert.equal(Object.hasOwn(draft.data, "reviewConsent"), false, "old consent cannot be reused on restore");
    assert.equal(draft.data.journey.bologna, "completed");
    assert.equal(draft.data.journey.oslo, "planned", "draft retains plans separately from lived stages");
    const downloaded = page.waitForEvent("download");
    await page.locator("#ex-download-draft").click();
    const download = await downloaded;
    const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    assert.equal(Object.hasOwn(exported.data, "replyEmail"), false, "downloaded draft excludes the reply address too");
    assert.equal(Object.hasOwn(exported.data, "reviewConsent"), false, "downloaded draft does not carry old consent");
    const byline = await page.locator("#ex-preview .ex-byline").innerText();
    assert.match(byline, /Bologna/);
    assert.doesNotMatch(byline, /Oslo/, "planned Oslo is excluded from the lived-city byline");
    assert.equal(fixture.posts.length, 0, "saving a draft does not submit it");
    await page.reload();
    await page.locator("#ex-restore-draft").click();
    assert.equal(await field(page, "replyEmail").inputValue(), "");
    assert.equal(await field(page, "reviewConsent").isChecked(), false);
    assert.equal(await page.locator("#journey-oslo").inputValue(), "planned");
    await page.locator("#ex-clear-draft").click();
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY), null);
    await close(fixture);
    ok("drafts are saved only on request, exclude reply email and review consent, preserve planned stages and restore without stale permission");

    label = "complete-answer-limit";
    fixture = await open(); page = fixture.page;
    await fillToReview(page);
    await page.locator("#ex-form-back").click();
    await field(page, "detail_housing").fill("Fictional housing detail. ".repeat(35));
    await page.locator("#ex-form-back").click();
    await field(page, "story").fill("Fictional main experience. ".repeat(60));
    await field(page, "tip1").fill("Fictional first tip. ".repeat(22));
    await field(page, "tip2").fill("Fictional second tip. ".repeat(22));
    await field(page, "tip3").fill("Fictional third tip. ".repeat(22));
    await field(page, "surprise").fill("Fictional surprise. ".repeat(32));
    await field(page, "different").fill("Fictional alternative. ".repeat(29));
    await next(page); await next(page);
    await field(page, "nameMode").selectOption("display");
    await field(page, "displayName").fill("  Fictional QA  ");
    await field(page, "replyEmail").fill("fixture-reply@example.invalid");
    await field(page, "reviewConsent").check();
    const oversized = await values(page);
    await page.locator("#ex-submit").click();
    assert.equal(fixture.posts.length, 0, "combined answers must fit the receiver limit before a request is sent");
    assert.deepEqual(await values(page), oversized, "a long contribution is never silently clipped");
    assert.match(await page.locator("#ex-submit-status").innerText(), /5,000|5000|shorten/i);
    assert.match(await page.locator("#ex-submission-count").innerText(), /Shorten/i);
    await page.locator("#ex-form-back").click();
    await field(page, "detail_housing").fill("A concise fictional housing detail.");
    await page.locator("#ex-form-back").click();
    await fillMainAdvice(page);
    await field(page, "tip2").fill(""); await field(page, "tip3").fill("");
    await field(page, "surprise").fill(""); await field(page, "different").fill("");
    await next(page); await next(page);
    await page.locator("#ex-submit").click(); await confirmed(fixture);
    assert.equal(fixture.posts.length, 1);
    assert.equal(fixture.posts[0].payload.name, "Fictional QA");
    assert.equal(fixture.posts[0].payload.email, "fixture-reply@example.invalid");
    assert.ok(fixture.posts[0].payload.message.length <= 5000);
    assert.match(fixture.posts[0].payload.message, /Plans only: Oslo/);
    assert.doesNotMatch(fixture.posts[0].payload.message, /Lived journey:[^\n]*Oslo/, "planned stages are kept apart in the review message");
    await close(fixture);
    ok("oversized complete answers stay intact without sending; a shortened named submission includes optional reply details and separates plans from lived experience");

    label = "uncertain-receipt-retry";
    fixture = await open({ handler: (route, entry, number) => response(route, acknowledgement(entry.payload, number === 1 ? { requestId: "00000000-0000-4000-8000-000000000099" } : {})) });
    page = fixture.page;
    await fillToReview(page); await field(page, "reviewConsent").check();
    const before = await values(page);
    await page.locator("#ex-submit").click(); await unconfirmed(fixture);
    assert.deepEqual(await values(page), before, "uncertainty retains every answer");
    assert.equal(fixture.posts.length, 1);
    await capture(page, "unconfirmed-receipt");
    await page.locator("#ex-submit").click(); await confirmed(fixture);
    assert.equal(fixture.posts.length, 2);
    assert.equal(fixture.posts[1].raw, fixture.posts[0].raw, "unchanged retry reuses the entire request and UUID");
    await close(fixture);
    ok("a mismatched receipt never claims success; answers remain intact and an unchanged retry reuses the same request ID");

    for (const width of [1440, 390]) for (const scheme of ["light", "dark"]) {
      label = `${width}-${scheme}`;
      fixture = await open({ width, height: width === 390 ? 844 : 1000, scheme }); page = fixture.page;
      await page.evaluate(() => document.fonts.ready);
      await noSideways(page, label);
      await noSideways(page, label, "#ex-grid");
      for (const image of await page.locator("#ex-grid .ex-card-media img").all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((element) => element.decode());
        assert.ok(await image.evaluate((element) => element.naturalWidth > 0), "every story cover loads locally");
        assert.equal(new URL(await image.getAttribute("src"), page.url()).origin, origin);
      }
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await capture(page, `page-${label}`, true);
      await page.locator('[data-ex-view="list"]').click();
      await noSideways(page, label + " list");
      await showBelowHeader(page, "#stories");
      await capture(page, `library-list-${label}`);
      await page.locator("#ex-grid .ex-card").first().getByRole("button", { name: /Read overview/ }).click();
      await page.locator("#ex-story-dialog").waitFor({ state: "visible" });
      await noSideways(page, label + " reader", "#ex-story-dialog");
      const closeBounds = await page.locator("#ex-dialog-close").boundingBox();
      assert.ok(closeBounds && closeBounds.x >= 0 && closeBounds.x + closeBounds.width <= width + 1 && closeBounds.y >= 0, "reader close remains inside the viewport");
      await capture(page, `story-reader-${label}`);
      await page.keyboard.press("Escape");
      await page.locator("#ex-story-dialog").waitFor({ state: "hidden" });
      await fillToReview(page); await noSideways(page, label + " final form", "#ex-form");
      const visibleControls = await page.locator("#ex-form input, #ex-form select, #ex-form textarea").evaluateAll((elements) => elements
        .filter((element) => element.getClientRects().length && !element.disabled && element.type !== "file")
        .map((element) => ({ name: element.name, labels: Array.from(element.labels || []).map((label) => label.textContent.trim()) })));
      for (const control of visibleControls) assert.ok(control.labels.some(Boolean), `${label}: ${control.name} has a native accessible label`);
      await showBelowHeader(page, "#ex-form");
      await capture(page, `review-form-${label}`);
      await showBelowHeader(page, ".ex-form-final-actions");
      await capture(page, `review-submit-${label}`);
      assert.equal(fixture.posts.length, 0);
      await close(fixture);
      ok(`${label}: covers load and library plus final questionnaire fit without horizontal overflow`);
    }

    assert.deepEqual(forbidden, [], "no real receiver or nonlocal submission request was permitted");
    assert.deepEqual(errors, [], "no browser exceptions or missing local assets");
    console.log(`Student Experiences browser checks: ${checks} passed. Screenshots: ${path.relative(ROOT, SHOTS)}`);
  } catch (error) {
    if (lastPage && !lastPage.isClosed()) await lastPage.screenshot({ path: path.join(SHOTS, "failure-" + label + ".png"), animations: "disabled" }).catch(() => {});
    console.error(`Student Experiences check failed (${label}):`, error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})();
