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
const MESSAGE = "Fictional deployment smoke test: an idea for testing delivery. No action needed.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isResponseUrl = (value) => {
  const url = new URL(value);
  return url.origin === "https://script.googleusercontent.com" && url.pathname === "/macros/echo";
};

async function main() {
  assert.strictEqual(process.env.GITHUB_ACTIONS, "true", "Run only in GitHub Actions, never in the local workspace.");
  assert.strictEqual(process.env.CONTACT_SMOKE_EXECUTE, "true", "This script is prepared only; explicit execution must be enabled.");
  assert.match(ENDPOINT, /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/, "Supply the owner's actual public /exec deployment URL.");
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
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block", reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
    context.setDefaultTimeout(30000);
    await context.addInitScript(() => { delete Navigator.prototype.serviceWorker; });
    await context.route("**/*", async (route) => {
      const request = route.request(), url = request.url();
      if (url === ENDPOINT && request.method() === "POST") {
        const body = request.postData();
        const payload = JSON.parse(body);
        assert.deepStrictEqual(Object.keys(payload).sort(), ["requestId", "noticeVersion", "topic", "message", "name", "email", "website"].sort());
        assert.match(payload.requestId, UUID);
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
      unexpected.push(`${request.method()} ${new URL(url).origin}${new URL(url).pathname}`);
      return route.abort();
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(SITE + "contact.html");
    await page.locator("body.contact-form-ready").waitFor();
    assert.strictEqual(await page.evaluate(() => location.origin), new URL(SITE).origin);
    await page.locator("input[name='topic'][value='idea']").check();
    await page.locator("#contact-message").fill(MESSAGE);
    assert.strictEqual(posts.length, 0, "Loading and composing do not send anything.");

    const responsePromise = page.waitForResponse((result) => result.status() === 200 && (result.url() === ENDPOINT || isResponseUrl(result.url())));
    await page.locator("#contact-submit").click();
    const firstResponse = await responsePromise;
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
  } finally {
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

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
