// Real HTTP navigation, browser storage and service-worker checks for the Toolkit.
// All personal entries are fictional. External traffic is blocked.
// Run: node tests/toolkit-workbench-browser.test.js .
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const KEY = "euhem-toolkit-workbench-v1";
const IDS = ["economics-graphs", "sample-size", "study-session-planner", "four-city-budget", "moving-checklist", "document-deadlines", "career-tracker"];
const OUTPUT = process.env.EUHEM_TEST_OUTPUT ? path.resolve(process.env.EUHEM_TEST_OUTPUT) : null;
const FILTER = process.env.EUHEM_TEST_FILTER || "";
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".csv": "text/csv", ".md": "text/markdown", ".ics": "text/calendar", ".webmanifest": "application/manifest+json" };
const ANNOUNCEMENTS = "Date,Title,Category,Message,Link,Pinned,Expires,Posted by\n2099-01-01,Fictional toolkit notice,Academic,Original testing announcement,,,,Test team\n";
let browser, server, origin, passed = 0;
const serverRequests = [];
const checks = [];
const contexts = new Set();
const ok = (name) => { passed++; checks.push(name); console.log("  ok  " + name); };

async function createServer() {
  server = http.createServer((request, response) => {
    serverRequests.push({ url: request.url, method: request.method });
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
    catch (_) { response.writeHead(400); response.end("Bad request"); return; }
    if (pathname === "/data/announcements.csv") {
      response.writeHead(200, { "Content-Type": "text/csv", "Cache-Control": "no-store" });
      response.end(ANNOUNCEMENTS); return;
    }
    let file = path.resolve(ROOT, "." + pathname);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { response.writeHead(403); response.end("Forbidden"); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404); response.end("Not found"); return; }
      response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(data);
    });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  origin = "http://127.0.0.1:" + server.address().port;
}

async function fixture({ planner = "economics-graphs", width = 1440, storage = {}, blocked = false, offline = false, query } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce", timezoneId: "UTC", serviceWorkers: offline ? "allow" : "block", acceptDownloads: true });
  contexts.add(context);
  const requests = [], external = [], errors = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    external.push(url.origin); return route.abort();
  });
  if (Object.keys(storage).length || blocked) await context.addInitScript(({ values, denied }) => {
    if (denied) {
      const fail = () => { throw new DOMException("Fictional storage denial", "SecurityError"); };
      Object.defineProperty(window, "localStorage", { get: fail });
    } else if (!sessionStorage.getItem("fixture-storage-loaded")) {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
      sessionStorage.setItem("fixture-storage-loaded", "true");
    }
  }, { values: storage, denied: blocked });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.clock.install({ time: new Date("2026-10-05T12:00:00Z") });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method(), body: request.postData() || "" }));
  await page.goto(origin + "/toolkit.html" + (query || "?section=workbench&planner=" + planner));
  await page.locator("#tw-tool-content").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#tw-tool-content").textContent.trim().length > 80);
  return { page, context, requests, external, errors, close: async () => { contexts.delete(context); await context.close(); } };
}

async function run(name, options, callback) {
  if (FILTER && !name.includes(FILTER)) return;
  const f = await fixture(options);
  try { await callback(f); assert.deepEqual(f.errors, [], "application runtime errors"); ok(name); }
  finally { await f.close(); }
}

async function choose(page, id) {
  const picker = page.locator("#tw-tool-select");
  if (await picker.count() && (await picker.evaluate((element) => element.tagName)) === "SELECT") await picker.selectOption(id);
  else await page.locator('[data-planner="' + id + '"]').click();
  await page.waitForFunction((id) => new URL(location.href).searchParams.get("planner") === id, id);
  await page.waitForFunction(() => document.querySelector("#tw-tool-content").textContent.trim().length > 80);
}

async function stored(page) { return page.evaluate((key) => localStorage.getItem(key), KEY); }
async function importJSON(page, raw) {
  await page.locator("#tw-import-file").setInputFiles({ name: "fictional-workbench.json", mimeType: "application/json", buffer: Buffer.from(typeof raw === "string" ? raw : JSON.stringify(raw)) });
}
async function downloadText(page, selector) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator(selector).click()]);
  return fs.readFileSync(await download.path(), "utf8");
}
async function openBackups(page) { await page.locator(".tw-backups").evaluate((element) => { element.open = true; }); }

(async () => {
  try {
    await createServer();
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium";
    browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
    await run("six sections and public planner routing work with real browser history", {}, async ({ page }) => {
      assert.equal(await page.locator("#tk2-sections button").count(), 6);
      assert.equal(await page.locator("#tk2-workbench").isVisible(), true);
      assert.equal(await page.locator("#tk2-browse").isVisible(), false);
      assert.equal(await stored(page), null, "loading defaults must not save personal data");
      await choose(page, "sample-size");
      await page.goto(origin + "/toolkit.html?section=workbench&planner=four-city-budget");
      await page.locator("#tw-tool-content").waitFor({ state: "visible" });
      await page.goBack();
      await page.waitForFunction(() => new URL(location.href).searchParams.get("planner") === "sample-size");
      assert.match(await page.locator("#tw-tool-content").innerText(), /sample/i);
      await page.locator('#tk2-sections [data-section="solve"]').click();
      assert.equal(await page.locator("#tk2-solve").isVisible(), true);
      await page.locator('#tk2-sections [data-section="workbench"]').click();
      assert.equal(await page.locator("#tw-tool-content").isVisible(), true);
    });
    await run("older bookmarks and personal lists retain promoted stable IDs", {
      storage: {
        "euhem-toolkit-v1": JSON.stringify({ version: 1, saved: IDS, rememberRecent: true, recent: ["four-city-budget"] }),
        "euhem-toolkit-lists-v1": JSON.stringify({ version: 1, lists: [{ id: "l-fictional", title: "Fictional older shortlist", items: IDS, checked: ["four-city-budget"] }] })
      }
    }, async ({ page }) => {
      await page.locator('#tk2-sections [data-section="lists"]').click();
      assert.equal(await page.locator(".tk2-list-entries [data-entry]").count(), 7);
      assert.equal(await page.locator('[data-entry="four-city-budget"] [data-reviewed]').isChecked(), true);
      for (const id of IDS) assert.match(await page.locator('[data-entry="' + id + '"] [data-launch]').getAttribute("href"), new RegExp("section=workbench&planner=" + id));
      await page.locator('[data-entry="four-city-budget"] [data-launch]').click();
      await page.waitForURL(/section=workbench&planner=four-city-budget/);
      assert.equal(await page.locator("#tw-tool-content").isVisible(), true);
    });
    for (const id of IDS) await run("deep link mounts " + id + " without automatic storage", { planner: id }, async ({ page }) => {
      assert.equal(new URL(page.url()).searchParams.get("planner"), id);
      assert.ok(await page.locator("#tw-tool-content input, #tw-tool-content select, #tw-tool-content button").count() > 0);
      assert.equal(await stored(page), null);
    });

    await run("economics inputs and sliders calculate equilibrium and clear invalid results", {}, async ({ page }) => {
      const metrics = page.locator("#tw-econ-output .tw-metric strong");
      assert.deepEqual(await metrics.allTextContents(), ["30", "40", "0", "1,350"]);
      await page.locator("#tw-econ-shiftA").fill("30");
      assert.deepEqual(await metrics.allTextContents(), ["40", "50", "10", "2,400"]);
      await page.locator("#tw-econ-shiftA-slider").evaluate((element) => { element.value = "0"; element.dispatchEvent(new Event("input", { bubbles: true })); });
      assert.equal(await page.locator("#tw-econ-shiftA").inputValue(), "0");
      assert.equal(await page.locator("#tw-econ-chart-desc").count(), 1);
      await page.locator("#tw-econ-a").fill("5");
      assert.match(await page.locator("#tw-econ-output").innerText(), /No positive quantity|No unique trade price/);
      await page.locator("#tw-econ-a").fill("");
      assert.equal(await page.locator("#tw-econ-error").isVisible(), true);
      assert.equal(await page.locator("#tw-econ-output").innerText(), "");
      await page.locator("#tw-save").click();
      assert.equal(await stored(page), null, "invalid input must not save stale data");
      assert.equal(await page.locator("#tw-error").isVisible(), true);
    });
    await run("sample precision calculator handles mean, proportion, loss and inactive inputs", { planner: "sample-size" }, async ({ page }) => {
      const metrics = page.locator("#tw-sample-output .tw-metric strong");
      assert.equal(await metrics.nth(0).innerText(), "97");
      await page.locator("#tw-sample-mode").selectOption("proportion");
      assert.equal(await metrics.nth(0).innerText(), "385");
      await page.locator("#tw-sample-loss").fill("20");
      assert.equal(await metrics.nth(1).innerText(), "482");
      await page.locator("#tw-sample-meanMargin").evaluate((element) => { element.value = ""; });
      await page.locator("#tw-sample-proportion").fill(".1");
      assert.equal(await page.locator("#tw-sample-error").isVisible(), false, "inactive mean fields must not block proportion planning");
      await page.locator("#tw-sample-proportionMargin").fill("");
      assert.equal(await page.locator("#tw-sample-error").isVisible(), true);
      assert.equal(await page.locator("#tw-sample-output").innerText(), "");
      assert.match(await page.locator("#tw-tool-content").innerText(), /precision, not power/);
    });
    await run("study sessions expose capacity gaps, task priority and calendar exports", { planner: "study-session-planner" }, async ({ page }) => {
      await page.locator("#tw-study-target").fill("2026-10-09");
      await page.locator("#tw-study-daily").fill("2");
      await page.locator("#tw-study-session").fill("60");
      await page.locator("#tw-study-buffer").fill("0");
      await page.locator("#tw-study-today").check();
      await page.locator("[data-study-title]").first().fill("Fictional review task");
      await page.locator("[data-study-hours]").first().fill("3");
      await page.locator("#tw-study-add").click();
      await page.locator("[data-study-title]").nth(1).fill("Fictional practice task");
      await page.locator("[data-study-hours]").nth(1).fill("6");
      assert.deepEqual(await page.locator("#tw-study-output .tw-metric strong").allTextContents(), ["4", "8 h", "9 h", "8 h", "1 h", "0 h"]);
      assert.match(await page.locator("#tw-study-feasibility").innerText(), /1 hour does not fit/);
      assert.equal(await page.locator("#tw-study-sessions tbody tr").count(), 8);
      await page.locator("[data-study-up]").nth(1).click();
      assert.equal(await page.locator("[data-study-title]").first().inputValue(), "Fictional practice task");
      assert.equal(await page.locator("#tw-study-sessions tbody tr").first().locator("td").nth(1).innerText(), "Fictional practice task");
      const calendar = await downloadText(page, "#tw-study-ics");
      assert.match(calendar, /DTSTART;VALUE=DATE:20261005/);
      assert.doesNotMatch(calendar, /DTSTART:\d{8}T/);
      assert.doesNotMatch(calendar, /DTSTART;VALUE=DATE:20261009/);
      const csv = await downloadText(page, "#tw-study-csv");
      assert.match(csv, /Fictional practice task/);
      await page.locator("[data-study-hours]").first().fill("");
      assert.equal(await page.locator("#tw-study-error").isVisible(), true);
      assert.equal(await page.locator("#tw-study-output").innerText(), "");
      assert.equal(await page.locator("#tw-study-csv").isDisabled(), true);
      await page.locator("[data-study-hours]").first().fill("6");
      await page.locator("[data-study-remove]").first().click();
      assert.equal(await page.locator("[data-study-title]").count(), 1);
      assert.match(await page.locator("#tw-study-feasibility").innerText(), /fits/);
    });
    await run("four-city budgets distinguish spending, refundable cash and explicit NOK assumptions", { planner: "four-city-budget" }, async ({ page }) => {
      const values = { months: "6", monthlyIncome: "1000", rent: "600", food: "200", transport: "50", otherMonthly: "50", oneOff: "300", deposit: "1200" };
      const submit = () => page.locator("#tw-budget-form").evaluate((form) => form.requestSubmit());
      await submit();
      assert.equal(await page.locator("#tw-budget-output table").count(), 0, "Missing amounts must not become zero");
      const first = page.locator("[data-budget-scenario]").first();
      for (const [key, value] of Object.entries(values)) await first.locator('[data-budget-key="' + key + '"]').fill(value);
      await first.locator('[data-budget-key="name"]').fill('<img src=x onerror="window.__fictionalXss=1">');
      await submit();
      assert.deepEqual(await page.locator("#tw-budget-output tbody td").allTextContents(), ["100.00", "5,700.00", "1,200.00", "6,900.00", "2,400.00", "300.00"]);
      assert.equal(await page.locator("#tw-budget-output img").count(), 0);
      await page.locator("#tw-budget-add").click();
      const second = page.locator("[data-budget-scenario]").nth(1);
      assert.equal(await second.locator('[data-budget-key="city"]').inputValue(), "oslo");
      assert.equal(await second.locator('[data-budget-key="currency"]').inputValue(), "NOK");
      for (const [key, value] of Object.entries(values)) await second.locator('[data-budget-key="' + key + '"]').fill(key === "months" ? value : String(Number(value) * 11));
      await submit();
      assert.equal(await page.locator("#tw-budget-output table").count(), 0, "NOK needs a rate and dated assumption");
      await second.locator('[data-budget-key="nokPerEur"]').fill("11");
      await second.locator('[data-budget-key="rateDate"]').fill("2026-10-05");
      await submit();
      assert.deepEqual(await page.locator("#tw-budget-output tbody tr").nth(1).locator("td").allTextContents(), ["100.00", "5,700.00", "1,200.00", "6,900.00", "2,400.00", "300.00"]);
      await second.locator('[data-budget-key="nokPerEur"]').fill("-1");
      await second.locator('[data-budget-key="currency"]').selectOption("EUR");
      await submit();
      assert.equal(await page.locator("#tw-budget-output tbody tr").count(), 2, "An inactive invalid NOK rate must not block an EUR scenario");
      await page.locator("#tw-budget-add").click();
      await page.locator("#tw-budget-add").click();
      assert.deepEqual(await page.locator('[data-budget-key="city"]').evaluateAll((elements) => elements.map((element) => element.value)), ["bologna", "oslo", "innsbruck", "rotterdam"]);
      assert.equal(await page.locator("#tw-budget-add").isDisabled(), true);
      await page.locator("[data-budget-remove]").last().click();
      assert.equal(await page.locator("[data-budget-scenario]").count(), 3);
      await first.locator('[data-budget-key="rent"]').fill("-1");
      await submit();
      assert.equal(await page.locator("#tw-budget-output table").count(), 0);
      assert.equal(await page.locator("#tw-tool-content .tw-error").isVisible(), true);
      await page.locator("[data-budget-remove]").first().click();
      assert.equal(await page.locator("[data-budget-scenario]").count(), 2, "An invalid scenario must remain removable");
      assert.equal(await page.evaluate(() => window.__fictionalXss), undefined);
      assert.equal(await stored(page), null);
    });
    await run("moving checklists preserve dates and completion across city changes and custom task CRUD", { planner: "moving-checklist" }, async ({ page }) => {
      assert.match(await page.locator("#tw-move-count").innerText(), /0 of 9 tasks complete/);
      await page.locator('[data-move-done="m-housing"]').check();
      await page.locator('[data-move-date="m-budget"]').fill("2026-10-04");
      assert.equal(await page.locator('[data-move-timing="m-budget"]').innerText(), "Overdue");
      await page.locator("#tw-move-city").selectOption("oslo");
      assert.equal(await page.locator('[data-move-done="m-housing"]').isChecked(), true);
      assert.equal(await page.locator('[data-move-date="m-budget"]').inputValue(), "2026-10-04");
      assert.equal(await page.locator("#tw-move-guide").getAttribute("href"), "city-guide.html?city=oslo");
      const malicious = '<img src=x onerror="window.__fictionalXss=1">';
      await page.locator("#tw-move-custom-title").fill(malicious);
      await page.locator("#tw-move-custom-phase").selectOption("arrival");
      await page.locator("#tw-move-custom-date").fill("2026-10-05");
      await page.locator("#tw-move-add-form").evaluate((form) => form.requestSubmit());
      assert.match(await page.locator("#tw-move-count").innerText(), /1 of 10 tasks complete/);
      assert.equal(await page.locator("#tw-tool-content img").count(), 0);
      const custom = page.locator('[data-moving-task^="m-c-"]');
      assert.match(await custom.innerText(), /Due today/);
      assert.ok((await custom.innerText()).includes(malicious));
      await custom.locator("[data-move-done]").check();
      assert.match(await page.locator("#tw-move-count").innerText(), /2 of 10 tasks complete · 20%/);
      await custom.locator("[data-move-remove]").click();
      assert.match(await page.locator("#tw-move-count").innerText(), /1 of 9 tasks complete/);
      await page.locator("#tw-save").click();
      await page.reload();
      await page.locator("#tw-move-count").waitFor();
      assert.equal(await page.locator("#tw-move-city").inputValue(), "oslo");
      assert.equal(await page.locator('[data-move-done="m-housing"]').isChecked(), true);
      assert.equal(await page.locator('[data-move-date="m-budget"]').inputValue(), "2026-10-04");
    });
    await run("document dates support safe CRUD, urgency groups and optional ICS alerts", { planner: "document-deadlines" }, async ({ page, requests }) => {
      const label = '<img src=x onerror="window.__fictionalXss=1">';
      assert.equal(await page.locator("#tw-doc-calendar").isDisabled(), true);
      await page.locator("#tw-doc-label").fill(label);
      await page.locator("#tw-doc-date").fill("2026-10-18");
      await page.locator("#tw-doc-notice").selectOption("14");
      await page.getByRole("button", { name: "Add document date", exact: true }).click();
      assert.match(await page.locator("#tw-doc-list").innerText(), /Next 30 days/);
      assert.equal(await page.locator("#tw-doc-list h4").innerText(), label);
      assert.equal(await page.locator("#tw-doc-list img").count(), 0);
      const calendar = await downloadText(page, "#tw-doc-calendar");
      assert.match(calendar, /DTSTART;VALUE=DATE:20261018/);
      assert.match(calendar, /TRIGGER:-P14D/);
      await page.locator("[data-doc-edit]").click();
      await page.locator("#tw-doc-label").fill("Fictional renewal date");
      await page.locator("#tw-doc-date").fill("2026-10-04");
      await page.getByRole("button", { name: "Update document date", exact: true }).click();
      assert.match(await page.locator("#tw-doc-list").innerText(), /Overdue/);
      assert.equal(await page.locator("#tw-doc-list h4").innerText(), "Fictional renewal date");
      await page.locator("[data-doc-remove]").click();
      assert.equal(await page.locator("#tw-doc-calendar").isDisabled(), true);
      assert.equal(await page.evaluate(() => window.__fictionalXss), undefined);
      assert.ok(requests.every((request) => !request.url.includes("Fictional") && !request.body.includes("renewal")));
      assert.equal(await stored(page), null);
    });
    await run("career tracker updates opportunities and the preparation progress indicator", { planner: "career-tracker" }, async ({ page }) => {
      await page.locator("#tw-career-organisation").fill("Fictional health research centre");
      await page.locator("#tw-career-role").fill("Fictional analyst opportunity");
      await page.locator("#tw-career-deadline").fill("2026-10-10");
      await page.locator("#tw-career-followup").fill("2026-10-05");
      await page.locator("#tw-career-next-action").fill("Prepare a fictional methods portfolio");
      await page.getByRole("button", { name: "Add opportunity", exact: true }).click();
      assert.equal(await page.locator("#tw-career-list article").count(), 1);
      assert.match(await page.locator("#tw-career-list").innerText(), /in 5 days|today/);
      await page.locator("#tw-career-cv-evidence").check();
      assert.equal(await page.locator("#tw-career-progress").getAttribute("max"), "9");
      assert.equal(await page.locator("#tw-career-progress").evaluate((element) => element.value), 1);
      assert.match(await page.locator("#tw-career-progress-text").innerText(), /1 \/ 9/);
      await page.locator("[data-career-edit]").click();
      await page.locator("#tw-career-stage").selectOption("interview");
      await page.locator("#tw-career-role").fill("Fictional analyst interview");
      await page.getByRole("button", { name: "Update opportunity", exact: true }).click();
      assert.equal(await page.locator("#tw-career-list article").count(), 1);
      assert.match(await page.locator("#tw-career-list").innerText(), /Interview/);
      await page.locator("[data-career-remove]").click();
      assert.equal(await page.locator("#tw-career-list article").count(), 0);
      assert.equal(await stored(page), null);
    });
    await run("explicit saving, draft backups, strict import confirmation and scoped clearing protect other progress", {
      planner: "career-tracker", storage: {
        "fictional-course-progress": "keep-unchanged",
        "euhem-toolkit-v1": JSON.stringify({ version: 1, saved: ["four-city-budget"], rememberRecent: false, recent: [] }),
        "euhem-toolkit-lists-v1": JSON.stringify({ version: 1, lists: [{ id: "l-fictional", title: "Fictional list", items: ["career-tracker"], checked: [] }] })
      }
    }, async ({ page, context, requests }) => {
      const beforeOther = await page.evaluate(() => Object.fromEntries(["fictional-course-progress", "euhem-toolkit-v1", "euhem-toolkit-lists-v1"].map((key) => [key, localStorage.getItem(key)])));
      const token = "fictional-private-planning-73091";
      await page.locator("#tw-career-organisation").fill(token);
      await page.locator("#tw-career-role").fill("Fictional researcher role");
      await page.getByRole("button", { name: "Add opportunity", exact: true }).click();
      assert.equal(await stored(page), null);
      await choose(page, "document-deadlines");
      await choose(page, "career-tracker");
      assert.match(await page.locator("#tw-career-list").innerText(), new RegExp(token));
      await page.locator("#tw-save").click();
      const initial = await stored(page);
      assert.deepEqual(Object.keys(JSON.parse(initial).tools), ["career-tracker"], "Save only persists the active tool");
      await page.reload();
      await page.locator("#tw-career-list article").waitFor();
      assert.match(await page.locator("#tw-career-list").innerText(), new RegExp(token));
      await page.locator("[data-career-edit]").click();
      await page.locator("#tw-career-organisation").fill(token + "-unsaved");
      await page.getByRole("button", { name: "Update opportunity", exact: true }).click();
      await openBackups(page);
      const exported = await downloadText(page, "#tw-export"), backup = JSON.parse(exported);
      assert.equal(backup.format, "euhem-toolkit-workbench");
      assert.equal(backup.tools["career-tracker"].opportunities[0].organisation, token + "-unsaved");
      assert.equal(await stored(page), initial, "Export must not save session edits");
      for (const privateKey of Object.keys(beforeOther)) assert.ok(!exported.includes(privateKey));
      const corruptBackups = ["not JSON", "null", { format: "euhem-toolkit-workbench", version: 9, tools: {} }, { ...backup, secret: "extra field" }, { ...backup, tools: { "not-a-planner": {} } }, { ...backup, tools: { "career-tracker": { ...backup.tools["career-tracker"], scan: "unsupported field" } } }, "x".repeat(100001)];
      for (const raw of corruptBackups) {
        await importJSON(page, raw);
        await page.locator("#tw-error").waitFor({ state: "visible" });
        assert.equal(await stored(page), initial, "Malformed import must be non-destructive");
        assert.equal(await page.locator("#tw-import-preview").isVisible(), false);
        assert.match(await page.locator("#tw-career-list").innerText(), /-unsaved/);
      }
      await importJSON(page, exported);
      await page.locator("#tw-import-preview").waitFor({ state: "visible" });
      assert.equal(await stored(page), initial, "Valid import must wait for confirmation");
      await page.locator("#tw-import-cancel").click();
      assert.equal(await stored(page), initial);
      await importJSON(page, exported);
      await page.locator("#tw-import-confirm").click();
      assert.equal(JSON.parse(await stored(page)).tools["career-tracker"].opportunities[0].organisation, token + "-unsaved");
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.locator("#tw-copy-link").click();
      await page.waitForFunction(() => /copied|Select and copy/.test(document.querySelector("#tw-status").textContent));
      const link = await page.locator("#tw-copy-box").isVisible() ? await page.locator("#tw-copy-fallback").inputValue() : await page.evaluate(() => navigator.clipboard.readText());
      const url = new URL(link);
      assert.deepEqual([...url.searchParams], [["section", "workbench"], ["planner", "career-tracker"]]);
      assert.ok(!link.includes(token));
      const imported = await stored(page);
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.locator("#tw-clear").click();
      assert.equal(await stored(page), imported, "Cancelling clear preserves saved tools");
      page.once("dialog", (dialog) => dialog.accept());
      await page.locator("#tw-clear").click();
      assert.equal(await stored(page), null);
      assert.equal(await page.locator("#tw-career-list article").count(), 0);
      assert.deepEqual(await page.evaluate(() => Object.fromEntries(["fictional-course-progress", "euhem-toolkit-v1", "euhem-toolkit-lists-v1"].map((key) => [key, localStorage.getItem(key)]))), beforeOther);
      assert.ok(requests.every((request) => !request.url.includes(token) && !request.body.includes(token)), "Private planner entries must never appear in network requests");
      assert.ok(serverRequests.every((request) => !request.url.includes(token)));
    });
    await run("unsaved drafts disappear on reload and blocked storage stays usable with a visible warning", { planner: "career-tracker", blocked: true }, async ({ page }) => {
      assert.equal(await page.locator("#tw-storage-warning").isVisible(), true);
      await page.locator("#tw-career-organisation").fill("Fictional session-only centre");
      await page.locator("#tw-career-role").fill("Fictional session-only role");
      await page.getByRole("button", { name: "Add opportunity", exact: true }).click();
      await page.locator("#tw-save").click();
      assert.match(await page.locator("#tw-status").innerText(), /storage is unavailable/);
      assert.equal(await page.locator("#tw-career-list article").count(), 1);
      await openBackups(page);
      assert.match(await downloadText(page, "#tw-export"), /Fictional session-only centre/);
      await page.reload();
      await page.locator("#tw-career-list").waitFor();
      assert.equal(await page.locator("#tw-career-list article").count(), 0);
    });
    await run("imported HTML-like labels stay literal and resetting one tool preserves other saved tools", { planner: "document-deadlines" }, async ({ page }) => {
      const malicious = '<img src=x onerror="window.__fictionalXss=1">';
      const raw = { format: "euhem-toolkit-workbench", version: 1, tools: {
        "document-deadlines": { version: 1, documents: [{ id: "d-fictional", label: malicious, date: "2099-01-15", noticeDays: 30 }] },
        "career-tracker": { version: 1, opportunities: [], prepared: ["cv-evidence"] }
      } };
      await openBackups(page);
      await importJSON(page, raw);
      await page.locator("#tw-import-preview").waitFor({ state: "visible" });
      assert.equal(await page.locator("#tw-doc-list h4").count(), 0, "Preview must not display imported entries as current records");
      assert.equal(await stored(page), null);
      await page.locator("#tw-import-confirm").click();
      assert.equal(await page.locator("#tw-doc-list h4").innerText(), malicious);
      assert.equal(await page.locator("#tw-doc-list img").count(), 0);
      assert.equal(await page.evaluate(() => window.__fictionalXss), undefined);
      page.once("dialog", (dialog) => dialog.accept());
      await page.locator("#tw-reset").click();
      assert.deepEqual(Object.keys(JSON.parse(await stored(page)).tools), ["career-tracker"]);
      await choose(page, "career-tracker");
      assert.equal(await page.locator("#tw-career-cv-evidence").isChecked(), true);
    });
    for (const planner of ["document-deadlines", "career-tracker"]) await run(planner + ": pending Add or Edit fields survive Save, export and tool switching", { planner }, async ({ page }) => {
      const isDocument = planner === "document-deadlines";
      const primary = isDocument ? "#tw-doc-label" : "#tw-career-organisation";
      const secondary = isDocument ? "#tw-doc-date" : "#tw-career-role";
      const cancel = isDocument ? "#tw-doc-cancel" : "#tw-career-cancel";
      const edit = isDocument ? "[data-doc-edit]" : "[data-career-edit]";
      const addName = isDocument ? "Add document date" : "Add opportunity";
      const updateName = isDocument ? "Update document date" : "Update opportunity";
      let downloads = 0;
      page.on("download", () => downloads++);
      await page.locator(primary).fill("Fictional pending entry");
      await page.locator(secondary).fill(isDocument ? "2026-10-18" : "Fictional analyst role");
      await page.locator("#tw-save").click();
      assert.equal(await stored(page), null);
      assert.match(await page.locator("#tw-error").innerText(), /Add\/update or cancel/);
      await page.locator('[data-planner="' + planner + '"]').click();
      assert.equal(await page.locator(primary).inputValue(), "Fictional pending entry", "Re-selecting the active tool must not discard a form");
      await openBackups(page);
      await page.locator("#tw-export").click();
      assert.match(await page.locator("#tw-error").innerText(), /Add\/update or cancel/);
      await page.locator('[data-planner="sample-size"]').click();
      assert.equal(new URL(page.url()).searchParams.get("planner"), planner);
      assert.equal(await page.locator(primary).inputValue(), "Fictional pending entry");
      assert.equal(await stored(page), null);
      assert.equal(downloads, 0);
      await page.locator(cancel).click();
      await choose(page, "sample-size");
      await choose(page, planner);
      assert.equal(await page.locator(primary).inputValue(), "");
      await page.locator(primary).fill("Fictional committed entry");
      await page.locator(secondary).fill(isDocument ? "2026-10-18" : "Fictional analyst role");
      await page.getByRole("button", { name: addName, exact: true }).click();
      await page.locator(edit).click();
      await page.locator("#tw-save").click();
      assert.equal(await stored(page), null, "An unchanged active Edit must be completed or cancelled explicitly");
      assert.match(await page.locator("#tw-error").innerText(), /Add\/update or cancel/);
      await page.locator(cancel).click();
      await page.locator(edit).click();
      await page.locator(primary).fill("Fictional updated entry");
      await page.locator("#tw-save").click();
      assert.equal(await stored(page), null);
      assert.equal(await page.locator(primary).inputValue(), "Fictional updated entry");
      if (isDocument) {
        await page.locator("#tw-doc-calendar").click();
        assert.match(await page.locator("#tw-doc-error").innerText(), /Add\/update or cancel/);
        assert.equal(downloads, 0);
      }
      await page.getByRole("button", { name: updateName, exact: true }).click();
      await page.locator("#tw-save").click();
      assert.ok((await stored(page)).includes("Fictional updated entry"));
      await choose(page, "sample-size");
    });
    const longLabelTools = {
      "document-deadlines": { version: 1, documents: [{ id: "d-fictional-stress", label: "D".repeat(80), date: "2099-01-15", noticeDays: 30 }] },
      "career-tracker": { version: 1, opportunities: [{ id: "o-fictional-stress", organisation: "O".repeat(100), role: "R".repeat(120), stage: "interview", deadline: "2099-01-15", followup: "2026-10-05", nextAction: "N".repeat(240) }], prepared: ["cv-evidence"] },
      "moving-checklist": { version: 1, city: "oslo", completed: ["m-c-fictional-stress"], dates: [{ id: "m-c-fictional-stress", date: "2026-10-05" }], customTasks: [{ id: "m-c-fictional-stress", title: "M".repeat(120), phase: "arrival" }] },
      "study-session-planner": { version: 1, targetDate: "2026-10-09", includeToday: true, weekdays: [1, 2, 3, 4, 5], dailyHours: 2, sessionMinutes: 60, bufferPercent: 0, tasks: [{ title: "S".repeat(120), hours: 9 }] },
      "four-city-budget": { version: 1, scenarios: ["bologna", "oslo", "innsbruck", "rotterdam"].map((city, index) => ({ id: "b-fictional-stress-" + index, name: "B".repeat(79) + index, city, currency: "EUR", months: 6, monthlyIncome: 1000, rent: 600, food: 200, transport: 50, otherMonthly: 50, oneOff: 300, deposit: 1200, nokPerEur: null, rateDate: "" })) }
    };
    await run("populated saved planners with maximum-length unbroken labels fit 320px", {
      planner: "document-deadlines", width: 320, storage: { [KEY]: JSON.stringify({ format: "euhem-toolkit-workbench", version: 1, tools: longLabelTools }) }
    }, async ({ page }) => {
      for (const theme of ["light", "dark"]) {
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
        for (const id of Object.keys(longLabelTools)) {
          await choose(page, id);
          if (id === "four-city-budget") {
            assert.equal(await page.locator("[data-budget-scenario]").count(), 4);
            await page.locator("#tw-budget-form").evaluate((form) => form.requestSubmit());
            assert.equal(await page.locator("#tw-budget-output tbody tr").count(), 4);
          }
          if (id === "study-session-planner") assert.equal(await page.locator("#tw-study-sessions tbody tr").count(), 8);
          if (id === "document-deadlines") assert.equal((await page.locator("#tw-doc-list h4").innerText()).length, 80);
          if (id === "career-tracker") assert.equal((await page.locator("#tw-career-list h4").innerText()).length, 120);
          if (id === "moving-checklist") assert.match(await page.locator("#tw-move-count").innerText(), /1 of 10/);
          const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
          if (!fits) console.error("POPULATED OVERFLOW", id, theme, await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflowing: [...document.querySelectorAll("#tw-tool-content *")].filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => ({ tag: element.tagName, id: element.id, className: element.className, scrollWidth: element.scrollWidth, width: element.clientWidth })).slice(0, 12) })));
          assert.equal(fits, true, id + ": long saved labels overflow in " + theme);
          assert.equal(await page.locator("#tw-tool-content img").count(), 0);
        }
      }
    });

    for (const width of [320, 390, 768, 1440]) await run("all seven tools fit " + width + "px in light and dark themes", { width }, async ({ page }) => {
      for (const theme of ["light", "dark"]) {
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
        for (const id of IDS) {
          await choose(page, id);
          const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
          if (!fits) console.error("OVERFLOW", width, id, theme, await page.evaluate(() => ({ width: innerWidth, scrollX, scrollWidth: document.documentElement.scrollWidth, elements: [...document.querySelectorAll("body *")].filter((element) => !element.closest("#site-nav") && (element.getBoundingClientRect().right + scrollX > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1)).slice(0, 16).map((element) => ({ tag: element.tagName, id: element.id, className: typeof element.className === "string" ? element.className : "SVG", right: element.getBoundingClientRect().right, scrollWidth: element.scrollWidth, width: element.clientWidth, whiteSpace: getComputedStyle(element).whiteSpace })) })));
          assert.equal(fits, true, id + ": horizontal overflow in " + theme);
          const unnamed = await page.locator("#tw-tool-content input:not([type=hidden]), #tw-tool-content select, #tw-tool-content textarea").evaluateAll((elements) => elements.filter((element) => !element.labels?.length && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby")).map((element) => element.id || element.type));
          assert.deepEqual(unnamed, [], id + ": controls need accessible names");
          if (OUTPUT && width === 390) {
            fs.mkdirSync(path.join(OUTPUT, "screenshots"), { recursive: true });
            await page.locator("#tk2-workbench").screenshot({ path: path.join(OUTPUT, "screenshots", "workbench-" + id + "-" + theme + "-390.png") });
          }
        }
      }
    });
    await run("real service worker precaches the workbench and all seven tools work after an offline reload", { planner: "career-tracker", offline: true }, async ({ page, context }) => {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
      const files = ["toolkit-workbench-core.js", "toolkit-workbench.js", "toolkit-workbench.css", "toolkit-academic-core.js", "toolkit-academic.js", "toolkit-planning-core.js", "toolkit-planning.js", "toolkit-life-core.js", "toolkit-life.js", "toolkit-career-core.js", "toolkit-career.js"];
      const cacheURLs = await page.evaluate(async () => {
        const key = (await caches.keys()).find((key) => key.startsWith("site-"));
        return (await (await caches.open(key)).keys()).map((request) => request.url);
      });
      const cachedPaths = cacheURLs.map((url) => new URL(url).pathname);
      for (const name of files) assert.ok(cachedPaths.includes("/" + name), name + " must be precached");
      await page.locator("#tw-career-organisation").fill("Fictional offline research centre");
      await page.locator("#tw-career-role").fill("Fictional offline role");
      await page.getByRole("button", { name: "Add opportunity", exact: true }).click();
      await page.locator("#tw-save").click();
      await context.setOffline(true);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("#tw-career-list article").waitFor();
      assert.match(await page.locator("#tw-career-list").innerText(), /Fictional offline research centre/);
      for (const id of IDS) {
        await choose(page, id);
        assert.ok((await page.locator("#tw-tool-content").innerText()).length > 80);
      }
      await page.goto(origin + "/toolkit.html?section=workbench&planner=sample-size", { waitUntil: "domcontentloaded" });
      await page.locator("#tw-sample-mode").waitFor();
      await page.locator("#tw-sample-mode").selectOption("proportion");
      assert.equal(await page.locator("#tw-sample-output .tw-metric strong").first().innerText(), "385");
      assert.ok(cacheURLs.every((url) => !url.includes("Fictional") && !url.includes("offline research")), "Service-worker cache keys must contain public resources only");
    });
  } finally {
    await Promise.allSettled([...contexts].map((context) => context.close()));
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  }
  if (OUTPUT) { fs.mkdirSync(OUTPUT, { recursive: true }); fs.writeFileSync(path.join(OUTPUT, "workbench-browser-results.json"), JSON.stringify({ passed, checks, harness: "Real local HTTP server, Chromium, persistent browser storage and actual service worker. Fictional data only; external traffic blocked." }, null, 2)); }
  console.log("PASS " + passed + " Workbench browser checks");
})().catch((error) => { console.error(error); process.exitCode = 1; });
