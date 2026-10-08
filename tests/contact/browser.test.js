// Native Contact form integration checks. Run in CI: node tests/contact/browser.test.js .
// Every submission is fictional and intercepted; no external request can leave this suite.
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const SHOTS = process.env.SCREENSHOT_DIR ? path.resolve(process.env.SCREENSHOT_DIR) : null;
const ENDPOINT = "https://script.google.com/macros/s/QA_CONTACT_FIXTURE_ONLY/exec";
const VERSION = "contact-v1-2026-10";
const EMAIL = "euhem.studenthub@gmail.com";
const RECEIPT = "00000000-0000-4000-8000-000000000001";
const MESSAGE = "This is a fictional QA request. Please use it only for the automated fixture.";
const SEED = { "euhem-contact-qa-sentinel": "keep this fictional local value" };
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".csv": "text/csv" };
const acknowledgment = (payload, overrides = {}) => ({ ok: true, requestId: payload.requestId, receiptId: RECEIPT, receivedAt: "2026-10-08T08:30:00.000Z", noticeVersion: payload.noticeVersion, ...overrides });
const response = (route, value, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(value) });

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const server = http.createServer((req, res) => {
    const file = path.resolve(ROOT, decodeURIComponent(req.url.split("?")[0].replace(/^\//, "")) || "index.html");
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end("missing");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "text/plain" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser, count = 0;
  const errors = [], forbidden = [];
  const ok = (name) => { count++; console.log(`  ok  ${name}`); };
  try {
    const configSource = fs.readFileSync(path.join(ROOT, "contact-config.js"), "utf8");
    const endpointSetting = /\bendpoint:\s*"(?:[^"\\]|\\.)*"/g;
    assert.strictEqual([...configSource.matchAll(endpointSetting)].length, 1, "the Contact fixture must replace exactly one endpoint setting");
    const backendSource = fs.readFileSync(path.join(ROOT, "integrations/contact-apps-script/Code.gs"), "utf8");
    assert.strictEqual(configSource.match(/noticeVersion:\s*["']([^"']+)["']/)?.[1], VERSION);
    assert.strictEqual(backendSource.match(/NOTICE_VERSION:\s*["']([^"']+)["']/)?.[1], VERSION, "frontend and backend notice versions stay synchronized");
    browser = await chromium.launch();
    const open = async ({ endpoint = ENDPOINT, scripts = true, viewport = { width: 1440, height: 1000 }, scheme = "light", handler, networkFailure = false, httpErrorStatus = null, clock = false } = {}) => {
      const context = await browser.newContext({ viewport, colorScheme: scheme, javaScriptEnabled: scripts, reducedMotion: "reduce", serviceWorkers: "block" });
      context.setDefaultTimeout(12000);
      const posts = [], pending = [];
      await context.addInitScript((seed) => {
        delete Navigator.prototype.serviceWorker;
        for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
        window.__contactQaWrites = [];
        for (const method of ["setItem", "removeItem", "clear"]) {
          const original = Storage.prototype[method];
          Storage.prototype[method] = function (...args) {
            window.__contactQaWrites.push({ method, key: args[0] || null });
            return original.apply(this, args);
          };
        }
      }, SEED);
      await context.route("**/*", async (route) => {
        const request = route.request(), url = request.url();
        if (url === ENDPOINT) {
          if (request.method() !== "POST") {
            forbidden.push(`${request.method()} ${url}`); return route.abort();
          }
          const raw = request.postData();
          let payload;
          try { payload = JSON.parse(raw); } catch { forbidden.push("non-JSON fixture submission"); return route.abort(); }
          const entry = { payload, raw, headers: request.headers() };
          posts.push(entry);
          if (handler) return handler(route, entry, posts.length, pending);
          return response(route, acknowledgment(payload));
        }
        if (!url.startsWith(base) || request.method() !== "GET" || request.postData() !== null) {
          forbidden.push(`${request.method()} ${url}`); return route.abort();
        }
        if (new URL(url).pathname.endsWith("/contact-config.js")) {
          // Preserve the real validator, but always isolate tests from the deployed
          // receiver. Empty/invalid cases and the mocked URL are explicit fixtures.
          const changed = configSource.replace(endpointSetting, `endpoint: ${JSON.stringify(endpoint)}`);
          return route.fulfill({ contentType: "text/javascript", body: changed });
        }
        return route.continue();
      });
      const page = await context.newPage();
      if (scripts && clock) await page.clock.install({ time: new Date("2026-10-08T08:30:00.000Z") });
      else if (scripts) await page.clock.setFixedTime(new Date("2026-10-08T08:30:00.000Z"));
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        if (networkFailure && /Failed to load resource: net::ERR_(FAILED|INTERNET_DISCONNECTED|ABORTED)/.test(message.text())) return;
        if (httpErrorStatus && message.location().url === ENDPOINT && message.text().includes(`server responded with a status of ${httpErrorStatus}`)) return;
        errors.push(message.text());
      });
      page.on("response", (result) => {
        if (result.url().startsWith(base) && result.status() >= 400) errors.push(`HTTP ${result.status()} ${result.url()}`);
      });
      await page.goto(base + "contact.html");
      if (scripts) await page.locator("#contact-copy-email:not([hidden])").waitFor();
      return { page, context, posts, pending, scripts };
    };
    const close = async (fixture) => {
      if (fixture.scripts) {
        assert.deepStrictEqual(await fixture.page.evaluate(() => window.__contactQaWrites), [], "contact input must not write or clear browser storage");
        assert.deepStrictEqual(await fixture.page.evaluate(() => Object.fromEntries(Object.entries(localStorage))), SEED);
        assert.strictEqual(await fixture.page.evaluate(() => sessionStorage.length), 0);
      }
      await fixture.context.close();
    };
    const settle = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const noSideways = async (page, label) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `${label}: ${overflow}px horizontal overflow`);
    };
    const capture = async (page, name, fullPage = false) => {
      if (!SHOTS) return;
      await page.evaluate(async () => { await document.fonts.ready; });
      if (fullPage) await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
      await settle(page);
      await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage, animations: "disabled" });
    };
    const captureForm = async (page, name) => {
      if (!SHOTS) return;
      await page.evaluate(async () => {
        await document.fonts.ready;
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      });
      await settle(page);
      // Capture the locator's original document region directly. Locator.screenshot()
      // may scroll a tall form first and place the sticky header across its content.
      const clip = await page.locator("#contact-form-section").boundingBox();
      await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true, clip, animations: "disabled" });
    };
    const choose = (page, value) => page.locator(`input[name='topic'][value='${value}']`).check();
    const fill = async (page, topic = "idea") => {
      await choose(page, topic);
      await page.locator("#contact-message").fill(MESSAGE);
      if (topic === "privacy") await page.locator("#contact-request-type").selectOption("removal");
    };
    const sent = (page) => page.locator("#contact-success").waitFor({ state: "visible" });
    const errorState = async (page) => {
      await page.waitForFunction(() => {
        const button = document.getElementById("contact-submit");
        const status = document.getElementById("contact-send-status");
        return !button.matches(":disabled") && !!status.textContent.trim();
      });
      assert.strictEqual(await page.locator("#contact-success").isVisible(), false);
    };
    const waitPosts = async (fixture, expected) => {
      const deadline = Date.now() + 12000;
      while (fixture.posts.length < expected && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
      assert.strictEqual(fixture.posts.length, expected);
    };
    const commonPayload = (payload, topic) => {
      assert.strictEqual(payload.topic, topic);
      assert.strictEqual(payload.noticeVersion, VERSION);
      assert.strictEqual(payload.message, MESSAGE);
      assert.strictEqual(payload.website, "");
      assert.match(payload.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "every request uses the backend's UUID v4 contract");
      assert.strictEqual(payload.email || "", "");
      assert.strictEqual(payload.name || "", "");
    };

    // Configuration failures and disabled JavaScript must never turn into an accidental form POST.
    for (const options of [
      { endpoint: "" }, { endpoint: "https://example.invalid/collect" },
      { endpoint: ENDPOINT + "?unsafe=1" }, { endpoint: "javascript:alert(1)" }, { scripts: false },
    ]) {
      const fixture = await open(options), { page } = fixture;
      assert.strictEqual(await page.locator("#contact-form-section").isVisible(), false);
      assert.strictEqual(await page.locator("#contact-form-fields").evaluate((fieldset) => fieldset.disabled), true);
      assert.strictEqual(await page.locator("#contact-submit").isDisabled(), true, "the disabled fieldset also disables its submit control");
      assert.strictEqual(await page.locator("#contact-topics").isVisible(), true);
      assert.strictEqual(await page.locator("#contact-email").getAttribute("href"), `mailto:${EMAIL}`);
      assert.strictEqual(await page.locator(".contact-topic-link[data-topic][href^='mailto:']").count(), 4);
      assert.strictEqual(fixture.posts.length, 0);
      if (fixture.scripts) {
        await page.goto(base + "privacy.html");
        await page.waitForFunction(() => document.getElementById("contact-privacy-state")?.textContent.includes("not connected yet"));
        assert.strictEqual(fixture.posts.length, 0, "the privacy availability note does not probe the backend");
      }
      await close(fixture);
    }
    ok("empty/invalid endpoints and disabled JavaScript retain four mailto routes and an inaccessible, disabled form with no submission");

    for (const [size, viewport] of [["desktop", { width: 1440, height: 1000 }], ["phone", { width: 390, height: 844 }], ["narrow", { width: 320, height: 900 }]]) {
      for (const scheme of ["light", "dark"]) {
        const fixture = await open({ viewport, scheme }), { page } = fixture;
        await page.locator("#contact-form-section").waitFor({ state: "visible" });
        await fill(page, "correction");
        await page.locator("#contact-page-url").fill("https://example.invalid/fictional-page");
        assert.strictEqual(fixture.posts.length, 0, "typing and topic selection do not submit");
        await page.locator("#contact-form-section").scrollIntoViewIfNeeded();
        await noSideways(page, `${size} ${scheme}`);
        const controls = await page.locator("#contact-form input, #contact-form textarea, #contact-form select").evaluateAll((all) => all.filter((node) => node.getClientRects().length && !node.disabled && node.id !== "contact-website").map((node) => ({
          id: node.id, type: node.type, labels: [...node.labels].map((label) => label.textContent.trim()),
          height: (node.type === "radio" ? node.closest("label") : node).getBoundingClientRect().height,
        })));
        assert.ok(controls.length >= 7);
        for (const control of controls) {
          assert.ok(control.labels.some(Boolean), `visible control ${control.id} has a useful native label`);
          assert.ok(control.height >= 43, `touch target ${control.id} is ${control.height}px`);
        }
        assert.strictEqual(await page.locator("#contact-send-status").getAttribute("role"), "status");
        await capture(page, `contact-form-${size}-${scheme}`, size === "desktop" && scheme === "light");
        if ((size === "desktop" && scheme === "light") || size === "phone") {
          await captureForm(page, `contact-form-section-${size}-${scheme}`);
        }
        if (size === "desktop" && scheme === "light") {
          await page.goto(base + "privacy.html");
          await page.waitForFunction(() => document.getElementById("contact-privacy-state")?.textContent.includes("offers an on-site form"));
          assert.strictEqual(fixture.posts.length, 0, "configured Privacy state is read locally, without contacting the provider");
        }
        await close(fixture);
      }
    }
    ok("configured forms fit desktop, 390px and 320px layouts in both themes with labels, 44px targets and no request while typing");

    let fixture = await open(), page = fixture.page;
    await page.locator("#contact-submit").click();
    await page.locator("#contact-errors").waitFor({ state: "visible" });
    assert.strictEqual(await page.locator("input[name='topic']:checked").count(), 0);
    assert.strictEqual(fixture.posts.length, 0, "a missing topic cannot submit");
    await page.locator("#contact-message").fill(MESSAGE);
    await page.locator("input[name='topic']").first().focus();
    await page.keyboard.press("ArrowDown");
    assert.strictEqual(await page.locator("input[name='topic']:checked").getAttribute("value"), "idea");
    assert.strictEqual(await page.locator("#contact-message").inputValue(), MESSAGE, "choosing the first topic must preserve a message typed beforehand");
    await page.locator("#contact-message").fill("");
    await page.locator("#contact-submit").click();
    await page.locator("#contact-errors").waitFor({ state: "visible" });
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "contact-errors");
    assert.strictEqual(await page.locator("#contact-message").getAttribute("aria-invalid"), "true");
    assert.match(await page.locator("#contact-message").getAttribute("aria-describedby"), /contact-error-/);
    await page.locator("#contact-message").fill("too short");
    await page.locator("#contact-email-input").fill("not-an-email");
    await page.locator("#contact-submit").click();
    assert.strictEqual(fixture.posts.length, 0);
    assert.strictEqual(await page.locator("#contact-email-input").getAttribute("aria-invalid"), "true");
    await fill(page, "privacy");
    await page.locator("#contact-request-type").selectOption("");
    await page.locator("#contact-email-input").fill("");
    await page.locator("#contact-submit").click();
    assert.strictEqual(await page.locator("#contact-request-type").getAttribute("aria-invalid"), "true");
    assert.strictEqual(fixture.posts.length, 0);
    await capture(page, "contact-form-validation-desktop");
    await close(fixture);
    ok("native topic keyboard selection works; invalid message, email and missing privacy request type receive focused, associated errors without a POST");

    for (const topic of ["correction", "idea", "privacy", "contribution"]) {
      fixture = await open(); page = fixture.page;
      await fill(page, topic);
      const extras = {};
      if (topic === "correction" || topic === "privacy") {
        extras.pageUrl = "https://example.invalid/fictional-page?from=qa#item";
        await page.locator("#contact-page-url").fill(`  ${extras.pageUrl}  `);
      }
      if (topic === "correction") {
        extras.sourceUrl = "https://example.invalid/official-reference";
        await page.locator("#contact-source-url").fill(extras.sourceUrl);
      }
      if (topic === "privacy") extras.requestType = "removal";
      if (topic === "contribution") {
        extras.resourceUrl = "http://example.invalid/original-notes";
        extras.preferredCredit = "Fictional QA contributor";
        await page.locator("#contact-resource-url").fill(extras.resourceUrl);
        await page.locator("#contact-preferred-credit").fill(`  ${extras.preferredCredit}  `);
      }
      await page.locator("#contact-message").fill(`  ${MESSAGE}  `);
      await page.locator("#contact-submit").click(); await sent(page);
      assert.strictEqual(fixture.posts.length, 1);
      const { payload, headers } = fixture.posts[0];
      commonPayload(payload, topic);
      assert.deepStrictEqual(Object.keys(payload).sort(), ["requestId", "noticeVersion", "topic", "message", "name", "email", "website", ...Object.keys(extras)].sort());
      for (const [key, value] of Object.entries(extras)) assert.strictEqual(payload[key], value);
      assert.match(headers["content-type"], /^text\/plain/i, "cross-origin simple request uses a readable response, without no-cors");
      assert.strictEqual(headers.cookie, undefined, "no provider cookie accompanies a request");
      assert.strictEqual((await page.locator("#contact-receipt").textContent()).trim(), RECEIPT);
      await close(fixture);
    }
    ok("all four topics submit trimmed, minimal topic-specific JSON and display a matching saved receipt; name and email stay optional, including privacy");

    fixture = await open(); page = fixture.page;
    await fill(page, "correction");
    await page.locator("#contact-page-url").fill("javascript:alert('fictional')");
    await page.locator("#contact-submit").click();
    assert.strictEqual(fixture.posts.length, 0);
    assert.strictEqual(await page.locator("#contact-page-url").getAttribute("aria-invalid"), "true");
    await page.locator("#contact-page-url").fill("https://qa:fictional@example.invalid/private");
    await page.locator("#contact-submit").click();
    assert.strictEqual(fixture.posts.length, 0);
    for (const url of ["https://example.invalid/a b", "https://example.invalid/a\\b"]) {
      await page.locator("#contact-page-url").fill(url);
      await page.locator("#contact-submit").click();
      assert.strictEqual(fixture.posts.length, 0, `raw URL ambiguity must be rejected: ${url}`);
      assert.strictEqual(await page.locator("#contact-page-url").getAttribute("aria-invalid"), "true");
    }
    await page.locator("#contact-page-url").fill("https://example.invalid/discard-this-page");
    await page.locator("#contact-source-url").fill("https://example.invalid/discard-this-source");
    await choose(page, "contribution");
    await page.locator("#contact-resource-url").fill("https://example.invalid/discard-this-resource");
    await page.locator("#contact-preferred-credit").fill("Discarded fictional credit");
    await choose(page, "privacy");
    await page.locator("#contact-request-type").selectOption("access");
    await choose(page, "correction");
    assert.strictEqual(await page.locator("#contact-message").inputValue(), MESSAGE, "returning to a topic restores its unsent in-memory draft");
    await choose(page, "idea");
    await page.locator("#contact-message").fill(MESSAGE);
    await page.locator("#contact-name").fill("  Fictional QA Student  ");
    await page.locator("#contact-email-input").fill("qa.student@example.invalid");
    await page.locator("#contact-submit").click(); await sent(page);
    const payload = fixture.posts[0].payload;
    assert.strictEqual(payload.name, "Fictional QA Student");
    assert.strictEqual(payload.email, "qa.student@example.invalid");
    for (const key of ["pageUrl", "sourceUrl", "resourceUrl", "preferredCredit", "requestType"]) assert.strictEqual(Object.hasOwn(payload, key), false, `${key} from a hidden previous topic must not be sent`);
    await close(fixture);
    ok("unsafe/credentialed links fail validation; changing topics excludes every inactive field and trims optional sender details");

    fixture = await open({ handler: (route, entry, number, pending) => { pending.push({ route, payload: entry.payload }); } }); page = fixture.page;
    await fill(page);
    await page.locator("#contact-submit").evaluate((button) => { button.click(); button.click(); });
    await waitPosts(fixture, 1);
    assert.strictEqual(await page.locator("#contact-success").isVisible(), false, "success waits for a saved acknowledgement");
    assert.strictEqual(await page.locator("#contact-submit").isDisabled(), true);
    await settle(page);
    assert.strictEqual(fixture.posts.length, 1);
    await response(fixture.pending[0].route, acknowledgment(fixture.pending[0].payload)); await sent(page);
    await page.locator("#contact-new-message").click();
    assert.strictEqual(await page.locator("#contact-message").inputValue(), "");
    assert.strictEqual(await page.locator("#contact-success").isVisible(), false);
    await fill(page); await page.locator("#contact-submit").click(); await waitPosts(fixture, 2);
    assert.notStrictEqual(fixture.posts[1].payload.requestId, fixture.posts[0].payload.requestId, "a deliberate new message starts a new idempotency key");
    await response(fixture.pending[1].route, acknowledgment(fixture.pending[1].payload)); await sent(page);
    await close(fixture);
    ok("rapid duplicate clicks create one request, success waits for acknowledgement, and New message clears input and creates a fresh request ID");

    const invalidReceipts = [
      () => ({ ok: true }),
      (value) => acknowledgment(value, { requestId: "unrelated-qa-request" }),
      (value) => acknowledgment(value, { noticeVersion: "different-notice" }),
      (value) => acknowledgment(value, { receiptId: "" }),
      (value) => acknowledgment(value, { receiptId: "not-a-receipt-uuid" }),
      (value) => acknowledgment(value, { receiptId: "00000000-0000-1000-8000-000000000001" }),
      (value) => acknowledgment(value, { receiptId: "   " }),
      (value) => acknowledgment(value, { receiptId: "Q".repeat(121) }),
      (value) => acknowledgment(value, { receivedAt: "not-a-date" }),
      (value) => acknowledgment(value, { receivedAt: "1" }),
      (value) => acknowledgment(value, { receivedAt: "2026-10-08T08:30:00+00:00" }),
      () => ({ ok: false, code: "SAVE_FAILED", message: "The fictional store is unavailable." }),
    ];
    for (const invalid of invalidReceipts) {
      fixture = await open({ handler: (route, entry) => response(route, invalid(entry.payload)) }); page = fixture.page;
      await fill(page); await page.locator("#contact-submit").click(); await waitPosts(fixture, 1); await errorState(page);
      assert.strictEqual(await page.locator("#contact-message").inputValue(), MESSAGE);
      assert.strictEqual(await page.locator("input[name='topic']:checked").getAttribute("value"), "idea");
      await close(fixture);
    }
    ok("incomplete/mismatched/malformed receipts and server rejection never show success and preserve the typed message");

    fixture = await open({ handler: (route, entry, number) => response(route, number < 3
      ? { ok: false, code: "SAVE_FAILED" }
      : acknowledgment(entry.payload)) }); page = fixture.page;
    await fill(page); await page.locator("#contact-submit").click(); await waitPosts(fixture, 1); await errorState(page);
    assert.strictEqual(await page.locator("#contact-send-status").getAttribute("data-state"), "uncertain");
    assert.match(await page.locator("#contact-send-status").textContent(), /may have reached the Hub/);
    await page.locator("#contact-submit").click(); await waitPosts(fixture, 2); await errorState(page);
    assert.strictEqual(fixture.posts[1].raw, fixture.posts[0].raw, "a saved-but-unconfirmed retry retains the exact body and request ID");
    await page.locator("#contact-message").fill(MESSAGE + " An edited detail after an unconfirmed save.");
    assert.match(await page.locator("#contact-send-status").textContent(), /separate submission/i);
    await page.locator("#contact-submit").click(); await sent(page);
    assert.notStrictEqual(fixture.posts[2].payload.requestId, fixture.posts[1].payload.requestId);
    await close(fixture);
    ok("a saved-but-unconfirmed response preserves uncertainty, exact retries, and the edited-message warning before a new request");

    for (const [code, statusCode] of [["UNRECOGNIZED_FIXTURE_ERROR", 200], ["BUSY", 503]]) {
      fixture = await open({ httpErrorStatus: statusCode >= 400 ? statusCode : null, handler: (route) => response(route, { ok: false, code }, statusCode) }); page = fixture.page;
      await fill(page); await page.locator("#contact-submit").click(); await waitPosts(fixture, 1); await errorState(page);
      assert.strictEqual(await page.locator("#contact-send-status").getAttribute("data-state"), "uncertain");
      await page.locator("#contact-message").fill(MESSAGE + " An edited detail.");
      assert.match(await page.locator("#contact-send-status").textContent(), /separate submission/i);
      await close(fixture);
    }
    ok("unknown error codes and non-success HTTP responses cannot imply a confirmed rejection");

    fixture = await open({ handler: (route) => response(route, { ok: false, code: "VALIDATION_ERROR", fieldErrors: { message: "The fictional review service asks for a clearer message." } }) }); page = fixture.page;
    await fill(page); await page.locator("#contact-submit").click(); await waitPosts(fixture, 1);
    await page.locator("#contact-errors").waitFor({ state: "visible" });
    assert.strictEqual(await page.locator("#contact-message").getAttribute("aria-invalid"), "true");
    assert.strictEqual(await page.locator("#contact-message").inputValue(), MESSAGE);
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "contact-errors");
    assert.doesNotMatch(await page.locator("#contact-send-status").textContent(), /sending/i, "a server validation error must not leave an inaccurate sending status");
    assert.strictEqual(await page.locator("#contact-success").isVisible(), false);
    await close(fixture);
    ok("server field errors are associated with the preserved input and move focus to the summary without a stale sending status");

    fixture = await open({ networkFailure: true, handler: (route, entry, number) => number < 3 ? route.abort("failed") : response(route, acknowledgment(entry.payload)) }); page = fixture.page;
    await fill(page); await page.locator("#contact-submit").click(); await waitPosts(fixture, 1); await errorState(page);
    await page.locator("#contact-submit").click(); await waitPosts(fixture, 2); await errorState(page);
    assert.strictEqual(fixture.posts[1].raw, fixture.posts[0].raw, "retry of an uncertain outcome reuses the exact payload and request ID");
    await page.locator("#contact-message").fill(MESSAGE + " A changed detail.");
    assert.match(await page.locator("#contact-send-status").textContent(), /separate submission/i, "editing an uncertain message explains the new-submission consequence");
    await page.locator("#contact-submit").click(); await sent(page);
    assert.notStrictEqual(fixture.posts[2].payload.requestId, fixture.posts[1].payload.requestId, "changed content receives a new request ID");
    await close(fixture);
    ok("network failures preserve input, an exact retry keeps the same idempotency key, and changed content starts a new request");

    fixture = await open({ networkFailure: true }); page = fixture.page;
    await fill(page); await fixture.context.setOffline(true);
    await page.locator("#contact-submit").click(); await errorState(page);
    assert.strictEqual(fixture.posts.length, 0, "offline state is handled before network dispatch");
    assert.strictEqual(await page.locator("#contact-message").inputValue(), MESSAGE);
    await fixture.context.setOffline(false); await page.locator("#contact-submit").click(); await sent(page);
    await close(fixture);
    ok("offline submission keeps the message and makes no POST; reconnecting allows an explicit successful retry");

    fixture = await open({ networkFailure: true, handler: (route, entry, number) => number === 1 ? route.abort("failed") : response(route, acknowledgment(entry.payload)) }); page = fixture.page;
    await fill(page); await page.locator("#contact-submit").click(); await waitPosts(fixture, 1); await errorState(page);
    await fixture.context.setOffline(true);
    for (const message of [MESSAGE, MESSAGE + " An edited detail while offline."]) {
      await page.locator("#contact-message").fill(message);
      await page.locator("#contact-submit").click(); await errorState(page);
      assert.strictEqual(fixture.posts.length, 1, "an offline retry makes no new POST, including after editing");
      assert.strictEqual(await page.locator("#contact-message").inputValue(), message);
      assert.strictEqual(await page.locator("#contact-send-status").getAttribute("data-state"), "uncertain");
      const offlineStatus = await page.locator("#contact-send-status").textContent();
      assert.match(offlineStatus, /offline.*No new request was sent.*earlier message may already have reached the Hub/);
      assert.doesNotMatch(offlineStatus, /This message has not been submitted/);
      assert.match(offlineStatus, message === MESSAGE ? /retry the same message/ : /separate submission/);
    }
    await page.locator("#contact-message").fill(MESSAGE);
    await fixture.context.setOffline(false); await page.locator("#contact-submit").click(); await sent(page);
    assert.strictEqual(fixture.posts[1].raw, fixture.posts[0].raw, "reconnecting and restoring the original message reuses its receipt lookup");
    await close(fixture);
    ok("offline retries retain the earlier delivery uncertainty for unchanged and edited messages without sending another request");

    fixture = await open({ networkFailure: true, clock: true, handler: (route, entry, number, pending) => { pending.push({ route, payload: entry.payload }); } }); page = fixture.page;
    await fill(page); await page.locator("#contact-submit").click(); await waitPosts(fixture, 1);
    await page.clock.fastForward(21000);
    await errorState(page);
    assert.strictEqual(await page.locator("#contact-message").inputValue(), MESSAGE);
    // Release the intercepted request after timeout; it must not turn a cancelled attempt into success.
    await response(fixture.pending[0].route, acknowledgment(fixture.pending[0].payload)).catch(() => {});
    assert.strictEqual(await page.locator("#contact-success").isVisible(), false);
    await page.locator("#contact-submit").click(); await waitPosts(fixture, 2);
    assert.strictEqual(fixture.posts[1].raw, fixture.posts[0].raw);
    await response(fixture.pending[1].route, acknowledgment(fixture.pending[1].payload)); await sent(page);
    await close(fixture);
    ok("timeout preserves the message and ignores a late response; explicit retry sends the same request ID and accepts its receipt");

    assert.deepStrictEqual(forbidden, [], "only intercepted fixture POSTs and local GETs are permitted");
    assert.deepStrictEqual(errors, [], "no unexpected page, console or local asset errors");
    ok("all cases keep existing local/session data unchanged and prevent any real external request");
    console.log(`${count} Contact form browser checks passed`);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
