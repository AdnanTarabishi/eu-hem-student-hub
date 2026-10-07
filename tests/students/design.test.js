// Students explorer redesign: responsive presentation, recovery and local interaction details.
// The existing browser suite checks the directory's privacy, filters, map and profile contracts.
// Run: node tests/students/design.test.js .
// CSS follow-up: STUDENTS_LAYOUT_ONLY=1 node tests/students/design.test.js .
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const D = require(path.join(ROOT, "students-data.js"));
const demo = JSON.parse(fs.readFileSync(path.join(ROOT, "data/demo-students.json"), "utf8"));
const pub = D.projectAll(demo.records, D.makeViewer("public"));
const { EUHEM_COUNTRIES } = require(path.join(ROOT, "countries.js"));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".webmanifest": "application/manifest+json" };
let checks = 0;
const ok = message => { checks++; console.log("  ok  " + message); };
const text = async (page, selector) => (await page.textContent(selector) || "").replace(/\s+/g, " ").trim();
const noOverflow = async (page, label) => assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, label);
const openDemoMap = async (page) => {
  if (!(await page.locator('#sx-map-details').evaluate(details => details.open))) {
    await page.locator('#sx-map-details > summary').click();
  }
};
const stressName = '<img src=x onerror="window.profileInjection=true"> ' + "AveryVeryLongNameWithoutSpaces".repeat(10);

(async () => {
  const server = http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/eu-hem-student-hub\//, "");
    const file = path.resolve(ROOT, relative || "index.html");
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); return response.end("missing"); }
    response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    response.end(fs.readFileSync(file));
  }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/eu-hem-student-hub/`;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const contexts = [], errors = [];
  const releaseFailure = new WeakMap();
  const open = async (options = {}) => {
    const { query = "", storageBlocked = false, failure = "", stress = false, demoMap = true, ...contextOptions } = options;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block", ...contextOptions });
    contexts.push(context);
    if (storageBlocked) await context.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } }));
    let failures = 0;
    let failureActive = true;
    await context.route(/^https?:\/\//, route => {
      const address = new URL(route.request().url());
      // The real atlas and fictional map share this SVG. Fail both initial requests,
      // independent of their ordering, until the recovery test releases the asset.
      if (failure && failureActive && (failure === "world-countries.svg" || failures === 0) && address.pathname.endsWith(failure)) {
        failures++;
        return route.fulfill({ status: 503, body: "unavailable" });
      }
      if (stress && address.pathname.endsWith("data/demo-students.json")) {
        const content = structuredClone(demo), profile = content.records.find(record => record.id === "demo-001");
        profile.fullName = stressName;
        profile.shortBio = "Long biography without break points: " + "FutureHealthcareResearch".repeat(30);
        profile.previousUniversity = "LongInstitutionName".repeat(25);
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(content) });
      }
      return address.hostname === "127.0.0.1" ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    releaseFailure.set(page, () => { failureActive = false; });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "students.html" + query);
    await page.locator("#sx-profiles:not([aria-busy])").waitFor();
    if (demoMap) await openDemoMap(page);
    return page;
  };
  try {
    let page;
    if (!process.env.STUDENTS_LAYOUT_ONLY) {
    page = await open();
    const flagCss = fs.readFileSync(path.join(ROOT, "assets/flags/country-flags.css"), "utf8");
    const atlas = fs.readFileSync(path.join(ROOT, "assets/flags/countries.png"));
    assert.strictEqual(atlas.readUInt32BE(16), 14 * 24 * 3);
    assert.strictEqual(atlas.readUInt32BE(20), Math.ceil(EUHEM_COUNTRIES.length / 14) * 18 * 3);
    assert.strictEqual((flagCss.match(/data-country-flag=/g) || []).length, EUHEM_COUNTRIES.length);
    EUHEM_COUNTRIES.forEach((country, index) => {
      assert.ok(flagCss.includes(`[data-country-flag="${country.code}"] { background-position: -${index % 14 * 24}px -${Math.floor(index / 14) * 18}px; }`), country.code);
    });
    for (const card of await page.locator('.sx-card').all()) {
      // Check displayed country fields against the existing code/name mapping.
      const fact = card.locator('.sx-fact-country');
      if (await fact.count()) {
        const flag = fact.locator('.country-flag');
        assert.strictEqual(await flag.count(), 1);
        const code = await flag.getAttribute('data-country-flag');
        assert.strictEqual(await fact.textContent(), EUHEM_COUNTRIES.find(country => country.code === code).name);
        assert.strictEqual(await flag.getAttribute('aria-hidden'), 'true');
      }
    }
    await page.waitForFunction(async () => {
      const flag = document.querySelector('.country-flag');
      const url = getComputedStyle(flag).backgroundImage.slice(5, -2);
      const image = new Image(); image.src = url;
      try { await image.decode(); return image.naturalWidth === 1008; } catch { return false; }
    });
    assert.ok(await page.locator('[data-key="country"] .country-flag').count());
    assert.ok(await page.locator('#sx-country-list .country-flag').count());
    const privateCountry = page.locator('.sx-card').filter({ hasText: 'Håkon Lyngstad' });
    assert.strictEqual(await privateCountry.locator('.country-flag').count(), 0, 'no flag when the country field is private');
    assert.strictEqual(await page.evaluate(() => countryLabel('ZZ', 'Unlisted country').querySelector('.country-flag')), null, 'unknown codes keep their text without a guessed flag');
    await page.goto(base + 'students.html?country=IT');
    await openDemoMap(page);
    await page.locator('#sx-country-panel .country-flag[data-country-flag="IT"]').waitFor();
    assert.strictEqual(await page.locator('#sx-chips .country-flag[data-country-flag="IT"]').count(), 1);
    await page.locator('[data-layout="list"]').click();
    assert.ok(await page.locator('.sx-table td[data-label="Country"] .country-flag').count());
    await page.locator('.sx-table .sx-name-button').first().click();
    await page.locator('#sx-drawer[open]').waitFor();
    assert.ok(await page.locator('#sx-drawer .country-flag[data-country-flag="IT"]').count());
    assert.strictEqual(await page.locator('#sx-chips .sx-chip').first().getAttribute('aria-label'), 'Remove filter: Country: Italy');
    await page.goto(base + 'students.html');
    await page.locator('#sx-profiles:not([aria-busy])').waitFor();
    ok('all 197 atlas positions, real image decoding, flags in cards/filters/country list/panel/chips/table/profile and accessible names');
    const originalStats = await text(page, "#sx-stats");
    await page.locator('#sx-pagination button:has-text("Next")').click();
    assert.strictEqual(await text(page, "#sx-stats"), originalStats, "summary does not change on pagination");
    await page.goto(base + "students.html?country=NL");
    await openDemoMap(page);
    await page.locator("#sx-map svg path[data-code=IT][aria-label]").waitFor();
    const expected = D.filterProfiles(pub, { country: ["NL"] });
    const numbers = await page.locator("#sx-stats .sx-stat-value").allTextContents();
    assert.strictEqual(numbers[0], String(expected.length), "hero count comes from filtered public projections");
    assert.strictEqual(await page.locator('#sx-map path[data-code="IT"]').getAttribute("aria-label"), "Italy: 5 visible profiles", "Country exception remains explicit in the map's faceted counts");
    assert.match(await text(page, "#sx-result-count"), new RegExp(`of ${expected.length} matching profiles`));
    await page.locator("#sx-clear-all").click();
    assert.strictEqual(await page.evaluate(() => location.search), "");
    assert.match(await text(page, "#sx-result-count"), /of 24 matching profiles/);
    assert.strictEqual(await page.locator("#sx-clear-all").isDisabled(), true);
    ok("summary uses matching visible profiles, remains stable on pagination, and Clear all resets public filters while map counts keep the Country exception");

    const save = page.locator(".sx-card .sx-save").first();
    const saveId = await save.getAttribute("id");
    assert.ok(saveId, "save has a stable focus target");
    await save.focus();
    await page.keyboard.press("Enter");
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), saveId);
    assert.strictEqual(await page.locator("#" + saveId).getAttribute("aria-pressed"), "true");
    await page.locator("#sx-saved-toggle").click();
    await page.locator("#" + saveId).focus();
    await page.keyboard.press("Enter");
    assert.ok(await page.locator(".sx-empty").isVisible());
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "sx-saved-toggle", "when the last saved profile vanishes, focus returns to the saved-view control");
    await page.locator("#sx-saved-toggle").click();
    await page.locator(".sx-card .sx-name-button").first().click();
    await page.locator("#sx-drawer-save").focus();
    await page.keyboard.press("Enter");
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "sx-drawer-save");
    await page.keyboard.press("Escape");
    ok("keyboard save retains focus after card and drawer redraws, including a useful fallback when the last saved profile disappears");
    await page.context().close();

    page = await open({ storageBlocked: true });
    await page.locator(".sx-card .sx-save").first().click();
    assert.match(await text(page, ".sx-feedback-toast"), /tab|storage|unavailable/i);
    assert.match(await text(page, "#sx-saved-toggle"), /Saved \(1\)/);
    await page.locator("#sx-saved-toggle").click();
    assert.match(await text(page, "#sx-result-count"), /of 1 matching profile/);
    await page.reload();
    await page.locator("#sx-profiles:not([aria-busy])").waitFor();
    assert.strictEqual(await text(page, "#sx-saved-toggle"), "Saved (0)");
    ok("blocked device storage gives honest feedback and temporary tab-only saved IDs, with no promise of persistence");
    await page.context().close();

    page = await open({ failure: "world-countries.svg" });
    await page.locator("#sx-map-retry").waitFor();
    assert.match(await text(page, "#sx-result-count"), /of 24 matching profiles/);
    releaseFailure.get(page)();
    await page.locator("#sx-map-retry").click();
    await page.locator("#sx-map svg path[data-code=NL][aria-label]").waitFor();
    assert.strictEqual(await page.locator("#sx-map-retry").count(), 0);
    ok("map failure keeps the directory available and Retry recovers the local SVG without a page reload");
    await page.context().close();

    page = await open({ failure: "demo-students.json" });
    assert.match(await text(page, "#sx-profiles"), /profiles could not be loaded/i);
    await page.locator('#sx-profiles button:has-text("Retry")').click();
    await page.locator("#sx-profiles:not([aria-busy]) .sx-card:not(.sx-card-skeleton)").first().waitFor();
    assert.match(await text(page, "#sx-result-count"), /of 24 matching profiles/);
    ok("profile loading errors have a working Retry action");
    await page.context().close();
    }

    for (const width of [360, 768, 1440]) for (const colorScheme of ["light", "dark"]) {
      const label = `${width}px ${colorScheme}`;
      page = await open({ viewport: { width, height: 1000 }, colorScheme, demoMap: false });
      await page.locator("#cm-map svg").waitFor();
      assert.strictEqual(await page.locator("h1:visible").count(), 1, label);
      assert.strictEqual(await page.locator(".sx-section-nav a:visible").count(), 4, "all four section links are visible " + label);
      assert.strictEqual(await page.locator("#sx-map-details").getAttribute("open"), null, "fictional map starts collapsed " + label);
      assert.strictEqual(await page.locator("#sx-map-section[data-cohort-atlas]").isVisible(), true, "real aggregate map is primary " + label);
      const [hero, header] = await Promise.all([page.locator(".sx-hero").boundingBox(), page.locator(".site-header").boundingBox()]);
      assert.ok(hero.y >= header.y + header.height + 12, `hero starts below the header ${label}: hero top ${hero.y}; header bottom ${header.y + header.height}`);
      await noOverflow(page, "cards " + label);
      await openDemoMap(page);
      await page.locator("#sx-map svg").waitFor();
      if (width <= 700) await page.locator("#sx-filters-toggle").click();
      await page.locator("#sx-filters details, #sx-country-list-wrap").evaluateAll(elements => elements.forEach(element => { element.open = true; }));
      const targets = await page.locator("#sx button:visible, #sx .button:visible, #sx summary:visible, #sx select:visible, #sx .sx-preview label:visible, #sx .sx-check:visible, #sx .sx-section-nav a:visible").evaluateAll(elements => elements.filter(element => !element.closest("svg")).map(element => {
        const box = element.getBoundingClientRect();
        return { target: element.id || element.className || element.tagName, width: box.width, height: box.height };
      }));
      assert.deepStrictEqual(targets.filter(target => target.width < 43.8 || target.height < 43.8), [], "44px page controls " + label);
      await noOverflow(page, "expanded filters and country list " + label);
      await page.locator("#sx-filters details, #sx-country-list-wrap").evaluateAll(elements => elements.forEach(element => { element.open = false; }));
      if (width <= 700) await page.locator("#sx-filters-toggle").click();
      await page.locator('[data-layout="list"]').click();
      await noOverflow(page, "list " + label);
      await page.locator(".sx-table .sx-name-button").first().click();
      await page.locator("#sx-drawer[open]").waitFor();
      await noOverflow(page, "drawer " + label);
      assert.strictEqual(await page.locator("#sx-drawer").evaluate(element => getComputedStyle(element).animationName), "none", "reduced motion " + label);
      const close = await page.locator(".sx-drawer-close").boundingBox();
      assert.ok(close.width >= 43.8 && close.height >= 43.8, "drawer close target " + label);
      if (process.env.STUDENTS_SCREENSHOTS) {
        const folder = process.env.STUDENTS_SCREENSHOTS;
        fs.mkdirSync(folder, { recursive: true });
        await page.screenshot({ path: path.join(folder, `${width}-${colorScheme}-drawer.png`) });
        await page.keyboard.press("Escape");
        await page.locator('[data-layout="cards"]').click();
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
        await page.waitForFunction(() => window.scrollY === 0);
        await page.screenshot({ path: path.join(folder, `${width}-${colorScheme}-top.png`) });
        await page.screenshot({ path: path.join(folder, `${width}-${colorScheme}-full.png`), fullPage: true });
        await page.locator("#sx-map-section").screenshot({ path: path.join(folder, `${width}-${colorScheme}-map.png`) });
        await page.locator("#sx-results-section").screenshot({ path: path.join(folder, `${width}-${colorScheme}-cards.png`) });
      }
      await page.context().close();
    }
    ok("six viewport/theme combinations keep cards, compact list and drawer within the page, with one title, 44px controls and reduced-motion support");

    for (const colorScheme of ["light", "dark"]) {
      page = await open({ viewport: { width: 360, height: 1000 }, colorScheme, stress: true, query: "?profile=demo-001", demoMap: false });
      await page.locator("#sx-drawer[open]").waitFor();
      assert.ok((await text(page, "#sx-drawer-name")).includes('<img src=x onerror="window.profileInjection=true">'));
      assert.strictEqual(await page.evaluate(() => !!window.profileInjection), false);
      assert.strictEqual(await page.locator("#sx-drawer-body img").count(), 0);
      await noOverflow(page, "long unbroken drawer strings " + colorScheme);
      await page.keyboard.press("Escape");
      await page.fill("#sx-search", "AveryVeryLongNameWithoutSpaces");
      await page.waitForFunction(() => /of 1 matching profile/.test(document.getElementById("sx-result-count").textContent));
      await noOverflow(page, "long unbroken card strings " + colorScheme);
      await page.locator('[data-layout="list"]').click();
      await noOverflow(page, "long unbroken list strings " + colorScheme);
      await page.context().close();
    }
    ok("long unbroken names, biographies and universities wrap on mobile and markup-like profile text remains inert in both themes");
    if (!process.env.STUDENTS_LAYOUT_ONLY) {
      const offlineContext = await browser.newContext({ serviceWorkers: 'allow' });
      contexts.push(offlineContext);
      await offlineContext.route(/^https?:\/\//, route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      const offline = await offlineContext.newPage();
      await offline.goto(base + 'students.html');
      await offline.locator('#sx-profiles:not([aria-busy])').waitFor();
      await offline.waitForFunction(() => !!navigator.serviceWorker.controller);
      for (const file of ['assets/flags/countries.png', 'assets/flags/country-flags.css']) {
        assert.ok(await offline.evaluate(async file => !!(await caches.match(new URL(file, location.href).href)), file), file + ' cached');
      }
      await offline.reload();
      await offline.locator('#sx-profiles:not([aria-busy])').waitFor();
      await openDemoMap(offline);
      await offline.locator('#sx-map svg').waitFor();
      await offlineContext.setOffline(true);
      await offline.reload();
      await offline.locator('.sx-fact-country .country-flag').first().waitFor();
      assert.ok(await offline.evaluate(async () => {
        const flag = document.querySelector('.sx-fact-country .country-flag');
        const image = new Image(); image.src = getComputedStyle(flag).backgroundImage.slice(5, -2);
        await image.decode(); return image.naturalWidth === 1008;
      }));
      await offlineContext.close();
      ok('flags and their stylesheet are precached, decoded and shown after a true offline page reload');
    }
    assert.deepStrictEqual(errors, []);
    ok("no JavaScript errors during the redesign and failure-recovery checks");
    console.log(checks + " students design checks passed");
  } finally {
    await Promise.all(contexts.map(context => context.close().catch(() => {})));
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exit(1); });
