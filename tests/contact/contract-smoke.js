// Temporary, explicitly authorized deployment gate. Never merge into main.
// These fixed fictional IDs must survive any recovery run; do not replace them.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const OUTPUT = path.resolve(process.env.CONTACT_SMOKE_OUTPUT || "contact-contract-results");
const SITE = "https://adnantarabishi.github.io/eu-hem-student-hub/";
const ENDPOINT = process.env.CONTACT_ENDPOINT || "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fixtures = [
  { requestId: "3cdd4fa5-0447-4acb-94dd-cc106b292d81", topic: "correction", message: "Fictional deployment correction test. No action needed.", extra: { pageUrl: SITE + "contact.html", sourceUrl: SITE + "privacy.html" } },
  { requestId: "9786f66d-8418-48c2-9625-32847b4d031f", topic: "privacy", message: "=SUM(1,2)\nFictional deployment privacy test. No action needed.", extra: { requestType: "question", pageUrl: "" } },
  { requestId: "0e24e1f1-3118-4c07-90fb-82947f99e22c", topic: "contribution", message: "Fictional deployment contribution test. No action needed.", extra: { resourceUrl: SITE + "support.html", preferredCredit: "'Fictional deployment credit" } },
];
const conflictFixture = { requestId: "7503a71c-bdb8-46c6-afda-bdede2cf12ed", topic: "idea", message: "Fictional deployment changed-content conflict test. Do not overwrite the original message.", extra: {} };
const fieldSelectors = { pageUrl: "#contact-page-url", sourceUrl: "#contact-source-url", requestType: "#contact-request-type", resourceUrl: "#contact-resource-url", preferredCredit: "#contact-preferred-credit" };
function payloadFor(fixture, version) {
  // Same order as the current frontend's requestId + collect() object.
  return { requestId: fixture.requestId, noticeVersion: version, topic: fixture.topic, name: "", email: "", message: fixture.message, ...fixture.extra, website: "" };
}
function safeUrl(value) {
  try { const url = new URL(value); return { origin: url.origin, path: url.pathname.replace(/\/macros\/s\/[^/]+/g, "/macros/s/[deployment]") }; }
  catch { return { origin: "[invalid URL]", path: "" }; }
}
function safeText(value) {
  return String(value || "").replace(/https?:\/\/[^\s"'<>]+/gi, (raw) => { const url = safeUrl(raw); return url.origin + url.path; }).replace(/([?&][\w.-]+=)[^\s&"'<>]*/g, "$1[redacted]").slice(0, 2000);
}
function isDeliveryRequest(request) {
  for (let current = request; current; current = current.redirectedFrom()) if (current.url() === ENDPOINT && current.method() === "POST") return true;
  return false;
}
function receiptSummary(result, expected) {
  assert.ok(result?.ok === true && result.requestId === expected.requestId && result.noticeVersion === expected.noticeVersion, "Receipt must acknowledge the exact fixed fictional request.");
  assert.ok(typeof result.receiptId === "string" && UUID.test(result.receiptId), "Receipt must have a UUID v4.");
  const time = Date.parse(result.receivedAt);
  assert.ok(Number.isFinite(time) && new Date(time).toISOString() === result.receivedAt, "Receipt must have a canonical ISO time.");
  return { topic: expected.topic, requestId: result.requestId, receiptId: result.receiptId, receivedAt: result.receivedAt, noticeVersion: result.noticeVersion };
}
async function main() {
  assert.strictEqual(process.env.GITHUB_ACTIONS, "true", "GitHub Actions only; never launch a local browser.");
  assert.strictEqual(process.env.CONTACT_SMOKE_EXECUTE, "true", "Explicit execution gate required.");
  assert.match(ENDPOINT, /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/, "Provide the public /exec endpoint.");
  const config = fs.readFileSync(path.join(ROOT, "contact-config.js"), "utf8");
  const version = config.match(/noticeVersion:\s*"([^"]+)"/)?.[1];
  assert.strictEqual(version, "contact-v1-2026-10", "These fixtures are approved for this notice version only.");
  assert.match(config, /endpoint:\s*"[^"]*"/);
  const servedConfig = config.replace(/endpoint:\s*"[^"]*"/, `endpoint: ${JSON.stringify(ENDPOINT)}`);
  const sequence = [...fixtures, conflictFixture].map(fixture => payloadFor(fixture, version));
  for (const payload of sequence) assert.match(payload.requestId, UUID);
  assert.strictEqual(new Set(sequence.map(payload => payload.requestId)).size, 4);
  const localFiles = new Map([["contact.html", "text/html"], ["contact.css", "text/css"], ["contact.js", "text/javascript"], ["contact-config.js", "text/javascript"]]);
  const attempts = [], receipts = [], diagnostics = { network: [], console: [], blocked: [], pageErrors: [] };
  const startedAt = Date.now();
  const write = (name, value) => fs.writeFileSync(path.join(OUTPUT, name), JSON.stringify(value, null, 2) + "\n");
  let browser, page, conflictConfirmed = false;
  fs.mkdirSync(OUTPUT, { recursive: true });
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
    context.setDefaultTimeout(30000);
    await context.addInitScript((ids) => {
      delete Navigator.prototype.serviceWorker;
      Object.defineProperty(crypto, "randomUUID", { value: () => {
        const id = ids[document.querySelector("input[name='topic']:checked")?.value];
        if (!id) throw new Error("Only a declared fictional topic ID is permitted.");
        return id;
      } });
    }, Object.fromEntries(fixtures.map(fixture => [fixture.topic, fixture.requestId])));
    await context.route("**/*", async route => {
      const request = route.request(), url = request.url();
      if (url === ENDPOINT && request.method() === "POST") {
        const expected = sequence[attempts.length];
        // Reject extra writes or any body variation before traffic leaves the browser.
        if (!expected || request.postData() !== JSON.stringify(expected)) {
          diagnostics.blocked.push({ reason: "Body outside the four fixed authorized payloads", ...safeUrl(url) });
          return route.abort();
        }
        attempts.push({ attempt: attempts.length + 1, requestId: expected.requestId, topic: expected.topic, intent: attempts.length < 3 ? "fixed-fictional-row" : "changed-content-conflict", at: new Date().toISOString() });
        // Written BEFORE each actual POST so uncertain delivery can be reconciled.
        write("attempt-summary.json", { noticeVersion: version, fictionalTest: true, maximumPosts: 4, attempts });
        return route.continue();
      }
      const parsed = new URL(url);
      if (parsed.origin === "https://script.googleusercontent.com" && parsed.pathname === "/macros/echo" && request.method() === "GET") return route.continue();
      if (url.startsWith(SITE) && request.method() === "GET") {
        const file = parsed.pathname.slice(new URL(SITE).pathname.length);
        if (localFiles.has(file)) return route.fulfill({ contentType: localFiles.get(file), body: file === "contact-config.js" ? servedConfig : fs.readFileSync(path.join(ROOT, file)) });
        return route.continue();
      }
      diagnostics.blocked.push({ method: request.method(), ...safeUrl(url) });
      return route.abort();
    });
    page = await context.newPage();
    page.on("pageerror", error => diagnostics.pageErrors.push(safeText(error.message)));
    page.on("console", message => { if (["error", "warning"].includes(message.type())) diagnostics.console.push({ type: message.type(), text: safeText(message.text()) }); });
    page.on("response", response => {
      if (!isDeliveryRequest(response.request())) return;
      const headers = response.headers();
      diagnostics.network.push({ elapsedMs: Date.now() - startedAt, ...safeUrl(response.url()), status: response.status(), method: response.request().method(), mimeType: safeText(headers["content-type"]), allowOrigin: safeText(headers["access-control-allow-origin"]) });
    });
    page.on("requestfailed", request => { if (isDeliveryRequest(request)) diagnostics.network.push({ elapsedMs: Date.now() - startedAt, ...safeUrl(request.url()), error: safeText(request.failure()?.errorText) }); });
    await page.goto(SITE + "contact.html");
    await page.locator("body.contact-form-ready").waitFor();
    assert.strictEqual(await page.evaluate(() => location.origin), new URL(SITE).origin);
    for (const [index, fixture] of fixtures.entries()) {
      if (index) await page.locator("#contact-new-message").click();
      await page.locator(`input[name='topic'][value='${fixture.topic}']`).check();
      await page.locator("#contact-message").fill(fixture.message);
      for (const [key, value] of Object.entries(fixture.extra)) {
        if (key === "requestType") await page.locator(fieldSelectors[key]).selectOption(value);
        else await page.locator(fieldSelectors[key]).fill(value);
      }
      assert.strictEqual(attempts.length, index, "Composing must not send a request.");
      const responsePromise = page.waitForResponse(response => isDeliveryRequest(response.request()) && !(response.status() >= 300 && response.status() < 400));
      await page.locator("#contact-submit").click();
      const response = await responsePromise;
      assert.strictEqual(response.status(), 200, "A saved receipt requires HTTP 200.");
      const receipt = receiptSummary(await response.json(), sequence[index]);
      await page.locator("#contact-success").waitFor({ state: "visible" });
      assert.strictEqual((await page.locator("#contact-receipt").textContent()).trim(), receipt.receiptId);
      assert.strictEqual(attempts.length, index + 1);
      receipts.push(receipt);
      write("contract-receipts.json", { productionOrigin: new URL(SITE).origin, receipts, conflictConfirmed });
    }
    // Use the same frontend CORS options from the genuine production origin.
    // The original idea's UUID is fixed; changed text must be rejected, not saved.
    const conflict = await page.evaluate(async ({ endpoint, body }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(endpoint, { method: "POST", mode: "cors", redirect: "follow", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, signal: controller.signal });
        return { status: response.status, result: await response.json() };
      } finally { clearTimeout(timeout); }
    }, { endpoint: ENDPOINT, body: JSON.stringify(sequence[3]) });
    assert.strictEqual(conflict.status, 200);
    assert.ok(conflict.result?.ok === false && conflict.result.code === "REQUEST_CONFLICT" && Object.keys(conflict.result).sort().join(",") === "code,ok", "Changed content must return only REQUEST_CONFLICT without overwriting the original.");
    conflictConfirmed = true;
    assert.strictEqual(attempts.length, 4);
    assert.deepStrictEqual(diagnostics.blocked, []);
    assert.deepStrictEqual(diagnostics.pageErrors, []);
    write("contract-receipts.json", { productionOrigin: new URL(SITE).origin, receipts, conflictConfirmed, conflictRequestId: conflictFixture.requestId });
    console.log("PASS: three fixed fictional topic receipts and the original idea's changed-content conflict. Private Sheet verification of literal text, line break, blank identities and exactly four total fixture rows remains required.");
  } catch (error) {
    diagnostics.failure = safeText(error.message);
    throw error;
  } finally {
    if (page && !page.isClosed()) {
      try {
        const ui = await page.evaluate(() => ({ status: document.getElementById("contact-send-status")?.innerText || "", errors: document.getElementById("contact-errors")?.innerText || "", successVisible: document.getElementById("contact-success")?.hidden === false }));
        diagnostics.ui = { status: safeText(ui.status), errors: safeText(ui.errors), successVisible: ui.successVisible };
      } catch (error) { diagnostics.uiError = safeText(error.message); }
    }
    write("contract-diagnostics.json", { ...diagnostics, attempts: attempts.length, elapsedMs: Date.now() - startedAt });
    if (browser) await browser.close();
  }
}
main().catch(error => { console.error(safeText(error.message)); process.exitCode = 1; });
