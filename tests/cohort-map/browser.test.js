// Real aggregate cohort atlas: source totals, interactions, independence from fictional
// directory filters, map failure, keyboard access and responsive themes.
// Run: node tests/cohort-map/browser.test.js .
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(process.argv[2] || ".");
// Independent transcription of the supplied country distribution, not computed from app data.
const EXPECTED = {
  AT: 2, BE: 1, HR: 1, FR: 1, DE: 15, GR: 1, IT: 20, LU: 1, NL: 35,
  PL: 1, PT: 1, RO: 1, ES: 5, IS: 1, NO: 7, BR: 1, IN: 2, MN: 1,
  MK: 1, PH: 2, ZA: 1, CH: 1, SY: 1, US: 2,
};
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const text = async (page, selector) => (await page.locator(selector).textContent() || "").replace(/\s+/g, " ").trim();
const listButton = (page, code) => page.locator(`#cm-countries button[data-cm-country="${code}"]`);
const mapPath = (page, code) => page.locator(`#cm-map path[data-cm-country="${code}"]`);
const selectedDetail = page => text(page, "#cm-country-detail");
const countryCodes = page => page.locator("#cm-countries button[data-cm-country]").evaluateAll(buttons => buttons.map(button => button.dataset.cmCountry));
const waitForCountryCount = (page, count) => page.waitForFunction(expected => document.querySelectorAll("#cm-countries button[data-cm-country]").length === expected, count);
const noOverflow = async (page, label) => assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, label);

(async () => {
  const server = http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/eu-hem-student-hub\//, "");
    const file = path.resolve(ROOT, relative || "index.html");
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404); return response.end("missing");
    }
    response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    response.end(fs.readFileSync(file));
  }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/eu-hem-student-hub/`;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  const browser = await chromium.launch({ ...(executablePath ? { executablePath } : { channel: "chrome" }), args: ["--no-sandbox"] });
  const contexts = [], errors = [];
  let checks = 0;
  const ok = message => { checks++; console.log("  ok  " + message); };
  const open = async ({ failMap = false, ...settings } = {}) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block", ...settings });
    contexts.push(context);
    await context.route(/^https?:\/\//, route => {
      const url = new URL(route.request().url());
      if (failMap && url.pathname.endsWith("world-countries.svg")) return route.fulfill({ status: 503, body: "unavailable" });
      return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "students.html");
    await page.locator("#cm-countries button[data-cm-country]").first().waitFor();
    await page.locator("#sx-profiles:not([aria-busy])").waitFor();
    if (!failMap) await page.locator("#cm-map path[data-cm-country]").first().waitFor();
    return page;
  };
  try {
    let page = await open();
    const initialSummary = await text(page, "#cm-summary");
    assert.deepStrictEqual(await page.locator("#cm-summary .cm-stat-number").allTextContents(), ["105", "24", "5"]);
    assert.ok(await page.locator("#sx-map-section").evaluate(section => !!(section.compareDocumentPosition(document.getElementById("sx-demo")) & Node.DOCUMENT_POSITION_FOLLOWING)));
    assert.strictEqual(await page.locator("#sx-map-details").evaluate(details => details.open), false);
    await page.locator("#sx-explore-map").click();
    assert.strictEqual(await page.locator("#sx-map-details").evaluate(details => details.open), false, "hero action must not open the fictional map");
    assert.deepStrictEqual((await countryCodes(page)).sort(), Object.keys(EXPECTED).sort());
    for (const [code, count] of Object.entries(EXPECTED)) {
      assert.strictEqual(await listButton(page, code).locator(".cm-country-count").textContent(), String(count), `${code} exact participant count`);
      assert.strictEqual(await listButton(page, code).locator(".cm-country-share").textContent(), (count / 105 * 100).toFixed(1) + "%", `${code} percentage uses the full cohort denominator`);
    }
    assert.strictEqual(await page.locator('#cm-map path[data-cm-country][role="button"]').count(), 24);
    assert.match(await text(page, "#sx-map-section"), /103\s*\+\s*2/);
    ok("primary real atlas: 105 participants, 24 countries, 5 continents, all exact counts and full-cohort shares; fictional map starts collapsed");

    await listButton(page, "NL").click();
    assert.match(await selectedDetail(page), /Netherlands/);
    assert.strictEqual(await text(page, "#cm-country-detail .cm-detail-number strong"), "35");
    assert.match(await selectedDetail(page), /33\.3%/);
    assert.strictEqual(await mapPath(page, "NL").getAttribute("aria-pressed"), "true");
    assert.strictEqual(await page.evaluate(() => location.search), "", "country selection does not enter fictional profile filters");
    await mapPath(page, "SY").focus();
    await page.keyboard.press("Enter");
    assert.match(await selectedDetail(page), /Syria/);
    assert.strictEqual(await text(page, "#cm-country-detail .cm-detail-number strong"), "1");
    assert.match(await selectedDetail(page), /1\.0%/);
    assert.strictEqual(await mapPath(page, "SY").getAttribute("aria-pressed"), "true");
    assert.strictEqual(await mapPath(page, "NL").getAttribute("aria-pressed"), "false");
    assert.strictEqual(await mapPath(page, "SY").evaluate(element => document.activeElement === element), true, "map keyboard selection retains focus");
    ok("list selection and keyboard map selection show Netherlands 35/33.3% and Syria 1/1.0% without changing directory filters");

    await page.locator("#cm-country-search").fill("India");
    await waitForCountryCount(page, 1);
    assert.deepStrictEqual(await countryCodes(page), ["IN"]);
    assert.ok((await listButton(page, "IN").textContent()).includes("1.9%"), "filtered list retains 105 denominator");
    await page.locator("#cm-country-search").fill("no-such-country");
    await waitForCountryCount(page, 0);
    assert.strictEqual(await page.locator("#cm-countries button[data-cm-country]").count(), 0);
    assert.match(await text(page, "#cm-results-count"), /0|no/i);
    await page.locator("#cm-reset").click();
    await waitForCountryCount(page, 24);
    assert.strictEqual(await page.locator("#cm-country-search").inputValue(), "");
    assert.strictEqual((await countryCodes(page)).length, 24);
    await page.locator("#cm-continent-filter").selectOption({ label: "Asia" });
    await waitForCountryCount(page, 4);
    assert.deepStrictEqual((await countryCodes(page)).sort(), ["IN", "MN", "PH", "SY"]);
    assert.strictEqual(await text(page, "#cm-summary"), initialSummary);
    const nameSort = await page.locator("#cm-sort option").evaluateAll(options => options.find(option => /A.?Z|alphabet|name/i.test(option.textContent))?.value);
    assert.ok(nameSort, "alphabetical sorting is available");
    await page.locator("#cm-sort").selectOption(nameSort);
    assert.deepStrictEqual(await countryCodes(page), ["IN", "MN", "PH", "SY"]);
    await page.locator("#cm-reset").click();
    await waitForCountryCount(page, 24);
    assert.strictEqual((await countryCodes(page)).length, 24);
    ok("country search, empty results, continent filter, alphabetical sort and reset work without changing cohort denominators");

    const geography = await page.locator("#cm-geography .cm-region-heading").evaluateAll(rows => Object.fromEntries(rows.map(row => [row.querySelector("strong").textContent, row.querySelector("span").textContent])));
    for (const [region, count] of [["Europe", 95], ["Asia", 6], ["North America", 2], ["South America", 1], ["Africa", 1]]) {
      assert.strictEqual(geography[region], `${count} · ${(count / 105 * 100).toFixed(1)}%`, region);
    }
    for (const [group, count] of [["eu", 85], ["eea", 8], ["other", 12]]) {
      assert.strictEqual(await text(page, `#cm-source-groups .cm-group-${group} .cm-group-count`), String(count));
    }
    ok("geographic breakdown totals 95/6/2/1/1 and supplied source groups total 85/8/12");

    const realRows = await page.locator("#cm-countries").textContent();
    await page.locator('input[name="sx-preview"][value="member"]').check();
    assert.match(await text(page, "#sx-result-count"), /36 matching profiles/);
    const allDemoResults = await text(page, "#sx-result-count");
    await page.locator('#sx-map-details > summary').click();
    await page.locator('#sx-map path[data-code="IT"]').dispatchEvent("click");
    assert.notStrictEqual(await text(page, "#sx-result-count"), allDemoResults);
    assert.strictEqual(await text(page, "#cm-summary"), initialSummary);
    assert.strictEqual(await page.locator("#cm-countries").textContent(), realRows);
    const realWorld = await page.locator("#cm-map svg").getAttribute("viewBox");
    await page.locator('#sx-demo-map-section [data-view="world"]').click();
    assert.strictEqual(await page.locator("#cm-map svg").getAttribute("viewBox"), realWorld);
    await page.locator('[data-cm-view="europe"]').click();
    assert.notStrictEqual(await page.locator("#cm-map svg").getAttribute("viewBox"), realWorld);
    assert.strictEqual(await page.locator('#sx-demo-map-section [data-view="world"]').getAttribute("aria-pressed"), "true");
    const europeView = await page.locator("#cm-map svg").getAttribute("viewBox");
    await page.locator('[data-cm-zoom="in"]').click();
    assert.notStrictEqual(await page.locator("#cm-map svg").getAttribute("viewBox"), europeView);
    await page.locator('[data-cm-zoom="reset"]').click();
    assert.strictEqual(await page.locator('[data-cm-view="world"]').getAttribute("aria-pressed"), "true");
    ok("real data and both maps' controls stay independent from member preview, fictional country filters and each other");
    await page.context().close();

    page = await open({ failMap: true });
    await page.waitForFunction(() => !document.getElementById("cm-map").hasAttribute("aria-busy") || document.getElementById("cm-map").getAttribute("aria-busy") === "false");
    assert.match(await text(page, "#cm-map"), /could not|unavailable|unable/i);
    assert.strictEqual((await countryCodes(page)).length, 24);
    await listButton(page, "NL").click();
    assert.match(await selectedDetail(page), /Netherlands/);
    assert.match(await selectedDetail(page), /33\.3%/);
    ok("unavailable SVG leaves all country counts and country selection usable");
    await page.context().close();

    for (const width of [360, 768, 1440]) for (const colorScheme of ["light", "dark"]) {
      page = await open({ viewport: { width, height: 1000 }, colorScheme });
      const label = `${width}px ${colorScheme}`;
      await noOverflow(page, label);
      assert.strictEqual(await page.locator("#sx-map-details").evaluate(details => details.open), false, label);
      const undersized = await page.locator("#sx-map-section button:visible, #sx-map-section select:visible, #sx-map-section input:visible").evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { control: element.id || element.textContent.trim(), width: rect.width, height: rect.height };
      }).filter(rect => rect.width < 43.8 || rect.height < 43.8));
      assert.deepStrictEqual(undersized, [], "44px controls " + label);
      if (process.env.COHORT_SCREENSHOTS) {
        fs.mkdirSync(process.env.COHORT_SCREENSHOTS, { recursive: true });
        await page.locator("#sx-map-section").screenshot({ path: path.join(process.env.COHORT_SCREENSHOTS, `${width}-${colorScheme}-atlas.png`) });
      }
      await listButton(page, "LU").click();
      assert.match(await selectedDetail(page), /Luxembourg/);
      await noOverflow(page, "country selection " + label);
      if (process.env.COHORT_SCREENSHOTS) {
        await page.locator("#sx-map-section .cm-map-layout").screenshot({ path: path.join(process.env.COHORT_SCREENSHOTS, `${width}-${colorScheme}-selection.png`) });
      }
      await page.context().close();
    }
    ok("six viewport/theme combinations fit the page, preserve the primary atlas and provide 44px controls");
    assert.deepStrictEqual(errors, []);
    ok("no JavaScript errors");
    console.log(checks + " cohort atlas browser checks passed");
  } finally {
    await Promise.all(contexts.map(context => context.close().catch(() => {})));
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exit(1); });
