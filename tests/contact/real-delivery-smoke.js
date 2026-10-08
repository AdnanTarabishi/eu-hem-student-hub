// Prepared real-delivery smoke check. Do not run until the owner has deployed
// and authorized the Contact service. Execute only inside the Actions workflow.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(process.argv[2] || ".");
const OUTPUT = path.resolve(process.env.CONTACT_SMOKE_OUTPUT || "contact-delivery-results");
const SITE = "https://adnantarabishi.github.io/eu-hem-student-hub/";
const ENDPOINT = process.env.CONTACT_ENDPOINT || "";
const RECOVERY_REQUEST_ID = process.env.CONTACT_SMOKE_REQUEST_ID || "";
const MESSAGE = "Fictional deployment smoke test: an idea for testing delivery. No action needed.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isResponseUrl = (value) => {
  const url = new URL(value);
  return url.origin === "https://script.googleusercontent.com" && url.pathname === "/macros/echo";
};

// Never save Google's temporary URL queries, deployment IDs, raw headers or
// response bodies in public Actions logs/artifacts.
function safeUrl(value) {
  try {
    const url = new URL(value);
    return { origin: url.origin, path: url.pathname.replace(/\/macros\/s\/[^/]+/g, "/macros/s/[deployment]") };
  } catch { return { origin: "[invalid URL]", path: "" }; }
}

function safeText(value) {
  return String(value || "").replace(/https?:\/\/[^\s"'<>]+/gi, (raw) => {
    const url = safeUrl(raw);
    return url.origin + url.path;
  }).replace(/([?&][\w.-]+=)[^\s&"'<>]*/g, "$1[redacted]").slice(0, 3000);
}

function responseMetadata(url, status, headers, mimeType) {
  const normalized = Object.fromEntries(Object.entries(headers || {}).map(([name, value]) => [name.toLowerCase(), value]));
  return {
    ...safeUrl(url), status, mimeType: safeText(mimeType || normalized["content-type"]),
    allowOrigin: safeText(normalized["access-control-allow-origin"]),
    allowCredentials: safeText(normalized["access-control-allow-credentials"]),
    ...(normalized.location ? { redirectTo: safeUrl(normalized.location) } : {}),
  };
}

function isDeliveryRequest(request) {
  for (let current = request; current; current = current.redirectedFrom()) {
    if (current.url() === ENDPOINT && current.method() === "POST") return true;
  }
  return false;
}

async function main() {
  assert.strictEqual(process.env.GITHUB_ACTIONS, "true", "Run only in GitHub Actions, never in the local workspace.");
  assert.strictEqual(process.env.CONTACT_SMOKE_EXECUTE, "true", "This script is prepared only; explicit execution must be enabled.");
  assert.match(ENDPOINT, /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/, "Supply the owner's actual public /exec deployment URL.");
  if (RECOVERY_REQUEST_ID) assert.match(RECOVERY_REQUEST_ID, UUID, "Recovery must reuse the confirmed fictional message's UUID v4.");
  const config = fs.readFileSync(path.join(ROOT, "contact-config.js"), "utf8");
  const version = config.match(/noticeVersion:\s*"([^"]+)"/)?.[1];
  assert.ok(version, "The checked-out Contact configuration declares its notice version.");
  assert.match(config, /endpoint:\s*"[^"]*"/);
  const servedConfig = config.replace(/endpoint:\s*"[^"]*"/, `endpoint: ${JSON.stringify(ENDPOINT)}`);
  const localFiles = new Map([
    ["contact.html", "text/html"], ["contact.css", "text/css"],
    ["contact.js", "text/javascript"], ["contact-config.js", "text/javascript"],
  ]);
  const posts = [], unexpected = [];
  const startedAt = Date.now();
  const diagnostics = { recovery: Boolean(RECOVERY_REQUEST_ID), network: [], console: [], pageErrors: [], blocked: [] };
  const record = (event, details) => diagnostics.network.push({ event, elapsedMs: Date.now() - startedAt, ...details });
  fs.mkdirSync(OUTPUT, { recursive: true });
  let browser, page;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
    context.setDefaultTimeout(30000);
    await context.addInitScript((requestId) => {
      delete Navigator.prototype.serviceWorker;
      // Recovery is confined to this fresh fictional test context. The route
      // below refuses any different UUID, message, identity or extra fields.
      if (requestId) Object.defineProperty(crypto, "randomUUID", { value: () => requestId });
    }, RECOVERY_REQUEST_ID);
    await context.route("**/*", async (route) => {
      const request = route.request(), url = request.url();
      if (url === ENDPOINT && request.method() === "POST") {
        const body = request.postData();
        const payload = JSON.parse(body);
        assert.deepStrictEqual(Object.keys(payload).sort(), ["requestId", "noticeVersion", "topic", "message", "name", "email", "website"].sort());
        assert.match(payload.requestId, UUID);
        if (RECOVERY_REQUEST_ID) assert.strictEqual(payload.requestId, RECOVERY_REQUEST_ID, "Recovery cannot create a new message ID.");
        assert.strictEqual(payload.noticeVersion, version);
        assert.strictEqual(payload.topic, "idea");
        assert.strictEqual(payload.message, MESSAGE);
        for (const key of ["name", "email", "website"]) assert.strictEqual(payload[key], "");
        assert.ok(posts.length < 2, "At most two delivery attempts are authorized.");
        if (posts.length) assert.strictEqual(body, posts[0].body, "The retry must preserve the exact JSON and request ID.");
        posts.push({ body, payload });
        // Keep only enough metadata to reconcile an uncertain delivery in the
        // private Sheet. Do not lose the request UUID if the response is blocked.
        fs.mkdirSync(OUTPUT, { recursive: true });
        fs.writeFileSync(path.join(OUTPUT, "attempt-summary.json"), JSON.stringify({
          requestId: payload.requestId, noticeVersion: version, attempts: posts.length,
          lastAttemptAt: new Date().toISOString(), fictionalTest: true,
          recovery: Boolean(RECOVERY_REQUEST_ID),
        }, null, 2) + "\n");
        return route.continue(); // Real, unmocked CORS request to the private inbox service.
      }
      if (isResponseUrl(url) && request.method() === "GET") return route.continue();
      if (url.startsWith(SITE) && request.method() === "GET") {
        const file = new URL(url).pathname.slice(new URL(SITE).pathname.length);
        if (localFiles.has(file)) {
          return route.fulfill({
            contentType: localFiles.get(file),
            body: file === "contact-config.js" ? servedConfig : fs.readFileSync(path.join(ROOT, file)),
          });
        }
        return route.continue(); // Existing public site assets, at the genuine website origin.
      }
      const blocked = { method: request.method(), ...safeUrl(url) };
      diagnostics.blocked.push(blocked);
      unexpected.push(`${blocked.method} ${blocked.origin}${blocked.path}`);
      return route.abort();
    });
    page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => {
      pageErrors.push(safeText(error.message));
      diagnostics.pageErrors.push(safeText(error.message));
    });
    page.on("console", (message) => {
      if (!["error", "warning"].includes(message.type())) return;
      const text = safeText(message.text());
      diagnostics.console.push({ type: message.type(), elapsedMs: Date.now() - startedAt, category: /cors|cross-origin|access-control/i.test(text) ? "cors" : "other", text });
    });
    page.on("request", (request) => {
      if (isDeliveryRequest(request)) record("request", { method: request.method(), ...safeUrl(request.url()), redirectedFrom: request.redirectedFrom() ? safeUrl(request.redirectedFrom().url()) : null });
    });
    page.on("response", (response) => {
      if (isDeliveryRequest(response.request())) record("response", responseMetadata(response.url(), response.status(), response.headers()));
    });
    page.on("requestfailed", (request) => {
      if (isDeliveryRequest(request)) record("requestfailed", { ...safeUrl(request.url()), error: safeText(request.failure()?.errorText) });
    });
    // Chromium's extra-info events expose the initial redirect headers even
    // when CORS prevents Playwright from emitting a readable Response object.
    const cdp = await context.newCDPSession(page);
    const deliveryRequests = new Map();
    cdp.on("Network.requestWillBeSent", (event) => {
      if (event.request.url !== ENDPOINT && !deliveryRequests.has(event.requestId)) return;
      if (event.redirectResponse) record("redirect-response", responseMetadata(event.redirectResponse.url, event.redirectResponse.status, event.redirectResponse.headers, event.redirectResponse.mimeType));
      deliveryRequests.set(event.requestId, safeUrl(event.request.url()));
      record("network-request", { method: event.request.method, ...safeUrl(event.request.url()) });
    });
    cdp.on("Network.responseReceived", (event) => {
      if (deliveryRequests.has(event.requestId)) record("network-response", responseMetadata(event.response.url, event.response.status, event.response.headers, event.response.mimeType));
    });
    cdp.on("Network.responseReceivedExtraInfo", (event) => {
      if (!deliveryRequests.has(event.requestId)) return;
      const url = deliveryRequests.get(event.requestId);
      // CDP reuses its request ID across redirects. This is the URL current at
      // event arrival; redirect-response above identifies each redirect exactly.
      record("response-extra-headers", { urlAtEvent: url, ...responseMetadata(url.origin + url.path, event.statusCode, event.headers) });
    });
    cdp.on("Network.loadingFailed", (event) => {
      if (deliveryRequests.has(event.requestId)) record("network-failed", { ...deliveryRequests.get(event.requestId), error: safeText(event.errorText), blockedReason: safeText(event.blockedReason), corsError: safeText(event.corsErrorStatus?.corsError), failedParameter: safeText(event.corsErrorStatus?.failedParameter), canceled: event.canceled === true });
    });
    await cdp.send("Network.enable");
    await page.goto(SITE + "contact.html");
    await page.locator("body.contact-form-ready").waitFor();
    assert.strictEqual(await page.evaluate(() => location.origin), new URL(SITE).origin);
    await page.locator("input[name='topic'][value='idea']").check();
    await page.locator("#contact-message").fill(MESSAGE);
    assert.strictEqual(posts.length, 0, "Loading and composing do not send anything.");

    // Observe an unsuccessful final response as well as 200: a Google error
    // page must be diagnosed immediately, not hidden behind the response wait.
    const responsePromise = page.waitForResponse((result) => isDeliveryRequest(result.request()) && !(result.status() >= 300 && result.status() < 400));
    await page.locator("#contact-submit").click();
    const firstResponse = await responsePromise;
    assert.strictEqual(firstResponse.status(), 200, "The delivery chain must end in HTTP 200.");
    const first = await firstResponse.json();
    await page.locator("#contact-success").waitFor({ state: "visible" });
    assert.strictEqual(posts.length, 1);
    validateReceipt(first, posts[0].payload);
    assert.strictEqual((await page.locator("#contact-receipt").textContent()).trim(), first.receiptId);

    // The UI has already confirmed receipt and deliberately has no duplicate-send
    // button. Repeat its exact CORS request once from the same production origin.
    const retry = await page.evaluate(async ({ endpoint, body }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const result = await fetch(endpoint, {
          method: "POST", mode: "cors", redirect: "follow", credentials: "omit",
          cache: "no-store", referrerPolicy: "no-referrer",
          headers: { "Content-Type": "text/plain;charset=utf-8" }, body, signal: controller.signal,
        });
        if (!result.ok) throw new Error(`Retry HTTP ${result.status}`);
        return await result.json();
      } finally { clearTimeout(timeout); }
    }, { endpoint: ENDPOINT, body: posts[0].body });
    assert.strictEqual(posts.length, 2);
    validateReceipt(retry, posts[0].payload);
    assert.deepStrictEqual(retry, first, "An exact retry returns the original receipt, timestamp and request ID.");
    assert.deepStrictEqual(unexpected, [], "No other provider or delivery destination was contacted.");
    assert.deepStrictEqual(pageErrors, [], "The real-origin page has no JavaScript errors.");

    fs.mkdirSync(OUTPUT, { recursive: true });
    const result = { productionOrigin: new URL(SITE).origin, attempts: posts.length, requestId: first.requestId, receiptId: first.receiptId, receivedAt: first.receivedAt, noticeVersion: first.noticeVersion, sameReceiptOnRetry: true };
    fs.writeFileSync(path.join(OUTPUT, "receipt-summary.json"), JSON.stringify(result, null, 2) + "\n");
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo({ top: 0, left: 0, behavior: "instant" }); });
    await page.screenshot({ path: path.join(OUTPUT, "contact-real-receipt.png"), fullPage: true, animations: "disabled" });
    console.log("PASS: production-origin CORS delivery and one exact retry returned the same readable saved receipt.");
    console.log(JSON.stringify(result));
  } catch (error) {
    diagnostics.failure = safeText(error.message);
    throw error;
  } finally {
    if (page && !page.isClosed()) {
      try {
        // Let the frontend finish handling an observed HTTP/JSON failure. This
        // never triggers another submission; its own timeout remains in force.
        await page.waitForFunction(() => document.getElementById("contact-form")?.getAttribute("aria-busy") !== "true", null, { timeout: 21000 });
      } catch { /* Preserve the current state if the page itself is stuck. */ }
      try {
        const state = await page.evaluate(() => {
          const read = (id) => {
            const element = document.getElementById(id);
            return element ? { visible: !element.hidden && element.getClientRects().length > 0, text: element.innerText || "", state: element.dataset.state || "" } : null;
          };
          return { status: read("contact-send-status"), errors: read("contact-errors"), success: read("contact-success"), formBusy: document.getElementById("contact-form")?.getAttribute("aria-busy") || "false", messageRetained: document.getElementById("contact-message")?.value === "Fictional deployment smoke test: an idea for testing delivery. No action needed." };
        });
        for (const key of ["status", "errors", "success"]) if (state[key]) state[key].text = safeText(state[key].text);
        diagnostics.ui = state;
      } catch (error) { diagnostics.uiError = safeText(error.message); }
    }
    diagnostics.attempts = posts.length;
    diagnostics.elapsedMs = Date.now() - startedAt;
    fs.writeFileSync(path.join(OUTPUT, "delivery-diagnostics.json"), JSON.stringify(diagnostics, null, 2) + "\n");
    if (browser) await browser.close();
  }
}

function validateReceipt(receipt, payload) {
  assert.strictEqual(receipt.ok, true);
  assert.strictEqual(receipt.requestId, payload.requestId);
  assert.strictEqual(receipt.noticeVersion, payload.noticeVersion);
  assert.match(receipt.receiptId, UUID);
  assert.strictEqual(new Date(receipt.receivedAt).toISOString(), receipt.receivedAt);
}

main().catch((error) => { console.error(safeText(error.message)); process.exitCode = 1; });
