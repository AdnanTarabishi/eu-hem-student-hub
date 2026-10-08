// Academic Rules and Programme Journey in Playwright's bundled Chromium.
// Run in the browser-check environment: node tests/academic-pages/browser.test.js .
// SCREENSHOT_DIR saves visual evidence before the interaction checks begin.
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const SHOTS = process.env.SCREENSHOT_DIR ? path.resolve(process.env.SCREENSHOT_DIR) : null;
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const rules = read("content/academic-rules.json");
const events = read("content/programme-events.json");
const registry = read("content/sources.json");
const cohort = read("content/tracks.json").cohorts.find((entry) => entry.id === events.cohort);
const sources = Object.fromEntries(registry.sources.map((entry) => [entry.id, entry]));
const UNIVERSITY_ORDER = ["unibo", "uio", "mci", "eur"];
const UNIVERSITY_TOPICS = ["exams", "resits", "improve", "awayResit", "complaints"];
const TRACK_KEY = "euhem-track-v1";
const PAGES = [
  { file: "academic-rules.html", status: "rules-status", sections: ["joint", "resit-guide", "universities", "grading", "integrity", "more"] },
  { file: "journey.html", status: "journey-status", sections: ["timeline", "degree", "numbers", "history", "erasmus", "fees"] },
];
const mime = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".csv": "text/csv",
};
const normal = (value) => String(value || "").replace(/\s+/g, " ").trim();
const labelFor = (id) => {
  const source = sources[id];
  assert.ok(source, `unknown expected source ${id}`);
  const type = registry.types[source.type];
  const label = `${type.label} · ${source.shortTitle || source.title}`;
  return type.kind === "official" ? `${label} · verified ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${source.lastChecked}T00:00:00Z`))}` : label;
};

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const site = http.createServer((req, res) => {
    const file = decodeURIComponent(req.url.split("?")[0].replace(/^\//, "")) || "index.html";
    const full = path.resolve(ROOT, file);
    if (!full.startsWith(ROOT + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404); return res.end("missing");
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(full)] || "text/plain" });
    res.end(fs.readFileSync(full));
  });
  await new Promise((resolve) => site.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${site.address().port}/`;
  let browser;
  let count = 0;
  const errors = [];
  const ok = (name) => { count++; console.log(`  ok  ${name}`); };
  try {
    browser = await chromium.launch();
    const waitReady = async (page, file) => {
      const config = PAGES.find((entry) => entry.file === file);
      await page.waitForFunction((id) => !document.getElementById(id), config.status);
      await page.waitForSelector(".academic-nav a[aria-current='location']");
      assert.strictEqual(await page.locator("body.academic-page").count(), 1);
    };
    const open = async (url, { viewport = { width: 1440, height: 960 }, scheme = "light", saved } = {}) => {
      const context = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: "reduce", serviceWorkers: "block" });
      // Fetch the current files, not a worker cache. Model an unsupported browser so
      // production capability detection skips register(), rather than getting the
      // synthetic undefined registration returned by Playwright's blocked worker.
      await context.addInitScript(() => { delete Navigator.prototype.serviceWorker; });
      if (saved !== undefined) await context.addInitScript(({ key, value }) => {
        localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      }, { key: TRACK_KEY, value: saved });
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-08T10:00:00+02:00"));
      page.on("pageerror", (error) => errors.push(`${url}: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`${url}: ${message.text()}`);
      });
      page.on("response", (response) => {
        if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${url}: HTTP ${response.status()} ${response.url()}`);
      });
      await page.goto(base + url);
      await waitReady(page, url.split(/[?#]/)[0]);
      return page;
    };
    const text = async (page, selector) => normal(await page.locator(selector).textContent());
    const noSideways = async (page, label) => {
      const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(extra <= 1, `${label}: page overflows horizontally by ${extra}px`);
    };
    const capture = async (page, filename, fullPage = false) => {
      if (!SHOTS) return;
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); });
      await page.screenshot({ path: path.join(SHOTS, `${filename}.png`), fullPage, animations: "disabled" });
    };
    const assertItems = async (page, selector, expected, label) => {
      const actual = await page.locator(selector).evaluateAll((items) => items.map((item) => {
        const body = item.querySelector(".rules-item__text");
        const copy = body ? body.cloneNode(true) : item.cloneNode(true);
        copy.querySelectorAll(".source-badge, [aria-hidden='true']").forEach((node) => node.remove());
        return {
          text: copy.textContent.replace(/\s+/g, " ").trim(),
          badges: [...item.querySelectorAll(".source-badge")].map((badge) => ({ text: badge.textContent, title: badge.title })),
        };
      }));
      const wanted = expected.map((item) => ({
        text: normal(item.text),
        badges: [{ text: labelFor(item.source), title: sources[item.source].title + (sources[item.source].cohort ? `, cohort ${sources[item.source].cohort}` : "") }],
      }));
      assert.deepStrictEqual(actual, wanted, label);
    };
    const assertSources = async (page) => {
      const known = new Set(registry.sources.map((source) => labelFor(source.id)));
      for (const badge of await page.locator("main .source-badge").allTextContents()) {
        assert.ok(known.has(badge), `source label lost or altered: ${badge}`);
      }
      const measurements = await page.locator("main .source-badge").evaluateAll((badges) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const drawing = canvas.getContext("2d", { willReadFrequently: true });
        const rgba = (value) => {
          drawing.clearRect(0, 0, 1, 1); drawing.fillStyle = value; drawing.fillRect(0, 0, 1, 1);
          return [...drawing.getImageData(0, 0, 1, 1).data];
        };
        const over = (foreground, background) => foreground.slice(0, 3).map((channel, index) => channel * foreground[3] / 255 + background[index] * (1 - foreground[3] / 255));
        const luminance = (rgb) => rgb.map((channel) => {
          const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        return badges.filter((badge) => badge.getClientRects().length).map((badge) => {
          const style = getComputedStyle(badge);
          const layers = [];
          for (let node = badge; node; node = node.parentElement) layers.unshift(rgba(getComputedStyle(node).backgroundColor));
          const background = layers.reduce((colour, layer) => over(layer, colour), [255, 255, 255]);
          const foreground = over(rgba(style.color), background);
          const lum = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
          return {
            text: badge.textContent, font: parseFloat(style.fontSize), line: parseFloat(style.lineHeight),
            overflow: badge.scrollWidth - badge.clientWidth, whiteSpace: style.whiteSpace,
            textOverflow: style.textOverflow, contrast: (lum[0] + 0.05) / (lum[1] + 0.05),
          };
        });
      });
      assert.ok(measurements.length > 5, "source samples are rendered");
      for (const badge of measurements) {
        assert.ok(badge.font >= 11 && badge.font <= 12, `${badge.text}: compact readable font (${badge.font}px)`);
        assert.ok(badge.line >= badge.font * 1.25, `${badge.text}: enough line spacing`);
        assert.ok(badge.overflow <= 1, `${badge.text}: clipped badge text (${badge.overflow}px)`);
        assert.notStrictEqual(badge.whiteSpace, "nowrap", `${badge.text}: full text can wrap`);
        assert.notStrictEqual(badge.textOverflow, "ellipsis", `${badge.text}: source/date must not be truncated`);
        assert.ok(badge.contrast >= 4.5, `${badge.text}: text contrast ${badge.contrast.toFixed(2)}:1`);
      }
    };
    const activeNav = async (page, id) => {
      try {
        await page.waitForFunction((key) => document.querySelector(`.academic-nav a[href='#${key}']`)?.getAttribute("aria-current") === "location", id);
      } catch (error) {
        const reading = await page.evaluate(() => ({
          active: document.querySelector(".academic-nav a[aria-current]")?.hash,
          url: location.href, width: innerWidth, height: innerHeight,
          scrollY, headerHeight: document.querySelector(".site-header")?.offsetHeight,
          sections: [...document.querySelectorAll(".academic-section")].map((section) => ({ id: section.id, top: section.getBoundingClientRect().top, hidden: section.hidden })),
        }));
        throw new Error(`Expected active section ${id}; reading position: ${JSON.stringify(reading)}`, { cause: error });
      }
      assert.strictEqual(await page.locator(".academic-nav a[aria-current='location']").count(), 1);
    };
    const assertAnchor = async (page, id, section) => {
      await page.waitForFunction((key) => location.hash === `#${key}` && document.activeElement?.id === key, id);
      await activeNav(page, section);
      const box = await page.locator(`[id='${id}']`).boundingBox();
      assert.ok(box && box.y >= -1 && box.y < page.viewportSize().height - 40, `${id}: target must stay visible after focus/navigation (${JSON.stringify(box)})`);
    };
    const navVisible = async (page, id) => {
      await activeNav(page, id);
      const edges = await page.locator(`.academic-nav a[href='#${id}']`).evaluate((anchor) => {
        const rect = anchor.getBoundingClientRect();
        const nav = anchor.closest("nav").getBoundingClientRect();
        const list = anchor.closest("ol").getBoundingClientRect();
        return { left: rect.left, right: rect.right, height: rect.height, min: Math.max(nav.left, list.left, 0), max: Math.min(nav.right, list.right, innerWidth) };
      });
      assert.ok(edges.left >= edges.min - 2 && edges.right <= edges.max + 2, `${id}: active navigation item is clipped: ${JSON.stringify(edges)}`);
      assert.ok(edges.height >= 44, `${id}: navigation touch target is at least 44px high`);
    };
    const verifyLinks = async (page) => {
      const links = await page.locator("main a[href]").evaluateAll((all) => all.map((link) => ({ href: link.getAttribute("href"), target: link.target, rel: link.rel })));
      for (const link of links) {
        if (/^https:\/\//.test(link.href)) {
          if (link.target === "_blank") assert.match(link.rel, /\bnoopener\b/, link.href);
        } else if (link.href.startsWith("#")) {
          assert.strictEqual(await page.locator(`[id='${decodeURIComponent(link.href.slice(1))}']`).count(), 1, `missing/duplicate anchor ${link.href}`);
        } else if (!/^(mailto:|tel:)/.test(link.href)) {
          assert.ok(fs.existsSync(path.resolve(ROOT, link.href.split(/[?#]/)[0])), `missing local destination ${link.href}`);
        }
      }
    };

    // Save useful evidence first. A later interaction failure must not leave an empty artifact.
    for (const config of PAGES) {
      for (const [size, viewport] of [["desktop", { width: 1440, height: 960 }], ["phone", { width: 390, height: 844 }]]) {
        for (const scheme of ["light", "dark"]) {
          const page = await open(config.file, { viewport, scheme });
          const name = `${config.file.replace(".html", "")}-${size}-${scheme}`;
          await capture(page, name);
          if (size === "desktop" && scheme === "light") await capture(page, `${name}-full`, true);
          await noSideways(page, name);
          await assertSources(page);
          assert.deepStrictEqual(await page.locator(".academic-nav ol a").evaluateAll((links) => links.map((link) => link.hash.slice(1))), config.sections);
          for (const id of config.sections) assert.strictEqual(await page.locator(`#${id}:not([hidden])`).count(), 1);
          await verifyLinks(page);
          await page.context().close();
        }
      }
    }
    ok("both pages render in desktop/phone and light/dark themes; compact source labels retain full text, wrap, fit and pass 4.5:1 contrast");

    let page = await open("academic-rules.html");
    await assertItems(page, "#joint .rules-item", rules.joint, "shared rules retain every original fact and source");
    for (const id of UNIVERSITY_ORDER) {
      await assertItems(page, `#uni-${id} .rules-item`, UNIVERSITY_TOPICS.flatMap((topic) => rules.universities[id][topic] || []), `${id}: all university rules and sources`);
    }
    await assertItems(page, "#integrity .rules-item", [...rules.integrity.joint, ...UNIVERSITY_ORDER.flatMap((id) => rules.integrity.universities[id])], "integrity qualifications and sources");
    for (const topic of rules.more) await assertItems(page, `#${topic.id} .rules-item`, topic.items, topic.id);
    assert.strictEqual(await text(page, "#rules-intro"), normal(rules.intro));
    assert.deepStrictEqual(await page.locator(".rules-uni h3").evaluateAll((headings) => headings.map((heading) => heading.firstChild.textContent)), UNIVERSITY_ORDER.map((id) => cohort.universities[id].name));
    ok("every shared, university, integrity and additional rule retains its exact original prose and source, including collapsed cards");

    assert.strictEqual(await page.locator("details.rules-uni").count(), 4);
    assert.strictEqual(await page.locator("#uni-unibo").evaluate((node) => node.open), true);
    const osloSummary = page.locator("#uni-uio > summary");
    await osloSummary.focus(); await page.keyboard.press("Enter");
    assert.strictEqual(await page.locator("#uni-uio").evaluate((node) => node.open), true);
    assert.strictEqual(await osloSummary.evaluate((node) => node === document.activeElement), true);
    await page.keyboard.press("Enter");
    assert.strictEqual(await page.locator("#uni-uio").evaluate((node) => node.open), false);
    await page.getByRole("button", { name: "Expand all universities", exact: true }).click();
    assert.strictEqual(await page.locator("details.rules-uni[open]").count(), 4);
    assert.strictEqual(await page.locator(".rules-expand-all").getAttribute("aria-expanded"), "true");
    await page.getByRole("button", { name: "Collapse all universities", exact: true }).click();
    assert.strictEqual(await page.locator("details.rules-uni[open]").count(), 0);
    assert.strictEqual(await page.locator(".rules-expand-all").getAttribute("aria-expanded"), "false");
    ok("university disclosures work with the keyboard, keep focus, and support accurate expand/collapse-all state");

    // A real browser print must include closed rules, then return the reader to
    // the same disclosure choices when printing ends. The PDF is test-only.
    await page.locator("#uni-unibo > summary").click();
    const beforePrint = await page.locator("details.rules-uni").evaluateAll((all) => all.map((details) => details.open));
    await page.evaluate(() => {
      window.academicPrintProbe = [];
      const state = () => [...document.querySelectorAll("details.rules-uni")].map((details) => details.open);
      window.addEventListener("beforeprint", () => window.academicPrintProbe.push({ event: "before", open: state() }), { once: true });
      window.addEventListener("afterprint", () => window.academicPrintProbe.push({ event: "after", open: state() }), { once: true });
    });
    const printout = await page.pdf({ format: "A4", printBackground: true });
    assert.ok(printout.length > 1000, "the browser produced a print document");
    const printed = await page.evaluate(() => window.academicPrintProbe);
    assert.deepStrictEqual(printed.find((entry) => entry.event === "before")?.open, [true, true, true, true], "printing exposes all university rules");
    assert.deepStrictEqual(printed.find((entry) => entry.event === "after")?.open, beforePrint, "printing restores the exact disclosure state");
    assert.deepStrictEqual(await page.locator("details.rules-uni").evaluateAll((all) => all.map((details) => details.open)), beforePrint);
    await page.emulateMedia({ media: "print" });
    assert.strictEqual(await page.locator(".academic-nav").evaluate((nav) => getComputedStyle(nav).display), "none");
    await page.emulateMedia({ media: "screen" });
    ok("native printing includes every university dossier, hides reading controls and restores the original disclosure choices afterwards");

    const rows = await page.locator(".rules-grades tbody tr").evaluateAll((all) => all.map((row) => [...row.children].map((cell) => {
      const copy = cell.cloneNode(true); copy.querySelectorAll(".source-badge, [aria-hidden='true']").forEach((node) => node.remove());
      return copy.textContent.replace(/\s+/g, " ").trim();
    })));
    assert.deepStrictEqual(rows, rules.grading.scales.map((scale) => [cohort.universities[scale.university].name, scale.scale, scale.pass, scale.best, scale.extra]));
    assert.strictEqual(await text(page, "#grading .rules-note"), normal(rules.grading.note));
    assert.deepStrictEqual(await page.locator(".rules-grades tbody .source-badge").allTextContents(), rules.grading.scales.map((scale) => labelFor(scale.source)));
    await page.locator(".academic-nav a[href='#grading']").click();
    await assertAnchor(page, "grading", "grading");
    await capture(page, "academic-rules-grading-desktop");
    ok("all four grading scales, pass marks, best grades and qualifications remain intact, with the explicit non-conversion note");

    const progress = () => page.locator(".resit-progress progress").evaluate((node) => [node.value, node.max]);
    assert.deepStrictEqual(await progress(), [0, 2]);
    await page.locator("input[name='resit-university']").first().focus();
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    assert.strictEqual(await page.locator("input[name='resit-university']:checked").inputValue(), "eur");
    await page.keyboard.press("Tab"); await page.keyboard.press("Space");
    assert.strictEqual(await page.locator("input[name='resit-attempt']:checked").inputValue(), "failed");
    assert.deepStrictEqual(await progress(), [2, 3]);
    assert.strictEqual(await page.locator(".resit-result").count(), 0);
    await page.keyboard.press("Tab"); await page.keyboard.press("ArrowRight");
    await page.locator(".resit-result").waitFor();
    assert.strictEqual(await page.locator("input[name='resit-location']:checked").inputValue(), "other");
    assert.deepStrictEqual(await progress(), [3, 3]);
    assert.strictEqual(await page.locator(".resit-outcome").getAttribute("aria-live"), "polite");
    assert.match(await text(page, ".resit-result"), /one month before/);
    assert.match(await text(page, ".resit-result"), /at least two weeks before/);
    assert.match(await text(page, ".resit-result"), /three days before/);
    assert.match(await text(page, ".resit-result"), /online proctoring/);
    await page.locator(".resit-result").scrollIntoViewIfNeeded();
    await activeNav(page, "resit-guide");
    await capture(page, "academic-rules-resit-result-desktop");
    ok("keyboard-only re-sit flow preserves focus and conditional progress, announces the outcome and retains the distinct one-month/two-week/three-day deadlines");

    // Exercise the user-facing outcome for every course university, not just one shared helper.
    for (const university of UNIVERSITY_ORDER) {
      for (const key of ["failed-same", "failed-other", "improve", "skipped"]) {
        await page.locator(`input[name='resit-university'][value='${university}']`).check();
        const attempt = key.startsWith("failed-") ? "failed" : key;
        await page.locator(`input[name='resit-attempt'][value='${attempt}']`).check();
        if (attempt === "failed") await page.locator(`input[name='resit-location'][value='${key.slice(7)}']`).check();
        const outcome = rules.resitGuide.outcomes[key];
        const local = rules.universities[university];
        const expected = [...outcome.items, ...(local[outcome.addUniversity] || []), ...(outcome.addUniversityExtra ? local[outcome.addUniversityExtra] || [] : [])];
        assert.strictEqual(await text(page, ".resit-result h3"), outcome.title);
        await assertItems(page, ".resit-result .rules-item", expected, `${university}: ${key}`);
      }
    }
    ok("all 16 university/re-sit outcomes preserve their full shared and local rules and source labels");

    await page.locator("input[name='resit-attempt'][value='failed']").check();
    await page.locator("input[name='resit-location'][value='other']").check();
    await page.locator("input[name='resit-attempt'][value='improve']").check();
    assert.strictEqual(await page.locator("input[name='resit-location']").count(), 0);
    assert.deepStrictEqual(await progress(), [2, 2]);
    await page.locator("input[name='resit-attempt'][value='failed']").check();
    assert.strictEqual(await page.locator("input[name='resit-location']:checked").count(), 0, "hidden location must be discarded");
    assert.strictEqual(await page.locator(".resit-result").count(), 0, "no stale outcome after returning to failed");
    await page.locator("input[name='resit-location'][value='same']").check();
    await page.locator(".resit-reset").click();
    assert.strictEqual(await page.locator(".resit-result").count(), 0);
    assert.strictEqual(await page.locator("#resit-guide input:checked").count(), 0);
    assert.deepStrictEqual(await progress(), [0, 2]);
    assert.strictEqual(await page.evaluate(() => document.activeElement.name), "resit-university");
    ok("changing answers discards hidden location state; Start again clears the result, choices and progress and restores keyboard focus");

    await page.locator(".academic-nav a[href='#grading']").click();
    await assertAnchor(page, "grading", "grading");
    await page.locator(".academic-nav a[href='#integrity']").click();
    await assertAnchor(page, "integrity", "integrity");
    await page.goBack(); await assertAnchor(page, "grading", "grading");
    await page.goForward(); await assertAnchor(page, "integrity", "integrity");
    const previous = await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement.id }));
    await page.locator("#more").evaluate((node) => {
      // Simulate an ordinary scroll to a reading position. scrollIntoView would
      // add both the site's scroll-padding and this section's anchor margin,
      // leaving the section below the reading line instead of scrolling into it.
      const readingTop = document.querySelector(".site-header").getBoundingClientRect().bottom + 20;
      window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top - readingTop, behavior: "instant" });
    });
    await activeNav(page, "more");
    assert.deepStrictEqual(await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement.id })), previous, "ordinary scrolling must not rewrite the URL or move focus");
    await page.context().close();
    ok("Rules navigation sets meaningful focus, supports Back/Forward, and updates the active section on scrolling without moving focus or rewriting the URL");

    page = await open("academic-rules.html#uni-eur");
    await assertAnchor(page, "uni-eur", "universities");
    assert.strictEqual(await page.locator("#uni-eur").evaluate((node) => node.open), true);
    assert.strictEqual(await page.locator("#uni-eur .rules-item").first().isVisible(), true);
    await page.context().close();
    page = await open("academic-rules.html#special-provisions");
    await assertAnchor(page, "special-provisions", "more");
    assert.match(await text(page, "#special-provisions"), /at least six weeks/);
    await page.context().close();
    ok("original university and special-provisions deep links open the right content, disclosure and navigation state");

    page = await open("journey.html");
    assert.strictEqual(await text(page, "#journey-intro"), normal(events.intro));
    assert.deepStrictEqual(await page.locator(".journey-stop").evaluateAll((stops) => stops.map((stop) => stop.id)), events.stages.map((stage) => `stage-${stage.id}`));
    for (const stage of events.stages) {
      assert.strictEqual(await text(page, `#stage-${stage.id} h3`), stage.title);
      await assertItems(page, `#stage-${stage.id} .rules-item`, stage.items, stage.id);
    }
    await assertItems(page, "#degree .rules-item", events.jointDegree.items, "joint degree rules");
    await assertItems(page, "#erasmus .rules-item", events.erasmus.items, "Erasmus conditions");
    assert.strictEqual(await text(page, ".journey-stop[aria-current='step'] h3"), "Semester 1: Bologna, all together");
    assert.strictEqual(await page.locator("input[name='journey-track'][value='']").isChecked(), true);
    assert.match(await text(page, "#stage-semester-2 .journey-place"), /Depends on your track/);
    assert.match(await text(page, "#stage-semester-3 .journey-place"), /Depends on your track/);
    assert.deepStrictEqual(await page.locator(".journey-route-stops a").evaluateAll((links) => links.map((link) => link.getAttribute("href"))), [1, 2, 3, 4].map((semester) => `#stage-semester-${semester}`));
    assert.strictEqual(await page.locator(".journey-route-selected").getAttribute("aria-live"), "polite");
    ok("the journey retains all six original stages, exact programme guidance and sources, current-stage state and honest unknown cities before choosing a track");

    await page.locator("input[name='journey-track'][value='eeh']").focus();
    await page.keyboard.press("Space");
    assert.strictEqual(await page.locator("input[name='journey-track'][value='eeh']").evaluate((node) => node === document.activeElement), true);
    for (const track of cohort.tracks) {
      await page.locator(`input[name='journey-track'][value='${track.id}']`).check();
      for (const semester of track.semesters) {
        if (![2, 3].includes(semester.number)) continue;
        const university = cohort.universities[semester.university];
        assert.ok((await text(page, `#stage-semester-${semester.number} .journey-place`)).includes(`${university.city} (${university.name})`), `${track.id}: semester ${semester.number}`);
      }
      const thesis = track.thesis.map((id) => `${cohort.universities[id].city} (${cohort.universities[id].name})`).join(" or ");
      assert.ok((await text(page, "#stage-semester-4 .journey-place")).includes(thesis), `${track.id}: thesis options stay complete`);
      const routeCities = [cohort.universities[cohort.semester1.university].city,
        ...[2, 3].map((semester) => cohort.universities[track.semesters.find((entry) => entry.number === semester).university].city),
        track.thesis.map((id) => cohort.universities[id].city).join(" or ")];
      assert.deepStrictEqual(await page.locator(".journey-route-city").allTextContents(), routeCities, `${track.id}: compact route matches the complete timeline`);
      assert.strictEqual(await page.locator(".journey-erasmus-table tr.is-mine").count(), 1);
      const grant = events.erasmus.byTrack.find((entry) => entry.track === track.id);
      const row = await text(page, ".journey-erasmus-table tr.is-mine");
      assert.ok(row.includes(track.abbr) && row.includes("your track") && row.includes(grant.text), row);
    }
    await page.locator("input[name='journey-track'][value='eeh']").check();
    await page.locator("#timeline").evaluate((node) => node.scrollIntoView({ block: "start", behavior: "instant" }));
    await capture(page, "journey-selected-track-desktop");
    ok("keyboard selection keeps focus; every track shows its actual semester cities, all thesis options and the correct grant-paying university");

    assert.deepStrictEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), TRACK_KEY), { cohort: events.cohort, track: "eeh" });
    await page.reload(); await waitReady(page, "journey.html");
    assert.strictEqual(await page.locator("input[name='journey-track'][value='eeh']").isChecked(), true);
    assert.match(await text(page, "#stage-semester-2 .journey-place"), /Rotterdam/);
    assert.match(await text(page, "#stage-semester-3 .journey-place"), /Oslo/);
    await page.locator("input[name='journey-track'][value='']").check();
    assert.strictEqual(await page.locator(".journey-erasmus-table tr.is-mine").count(), 0);
    await page.reload(); await waitReady(page, "journey.html");
    assert.strictEqual(await page.locator("input[name='journey-track'][value='']").isChecked(), true);
    assert.match(await text(page, "#stage-semester-4 .journey-place"), /Depends on your track/);
    ok("the shared on-device track choice survives reload; clearing it removes the selected grant row and remains cleared");

    const figures = await page.locator("#numbers .journey-figure").evaluateAll((items) => items.map((item) => ({ label: item.querySelector("dt").textContent, value: item.querySelector("dd").textContent })));
    assert.deepStrictEqual(figures, events.cohortNumbers.figures);
    assert.ok((await text(page, "#numbers")).includes(normal(events.cohortNumbers.note)));
    assert.match(await text(page, "#numbers h2"), /Welcome Days snapshot/);
    assert.match(await text(page, "#numbers h2"), /2026–2028/);
    assert.strictEqual(await page.locator("#numbers a[href='students.html#sx-map-section']").count(), 1);
    assert.ok((await page.locator("#numbers .source-badge").allTextContents()).includes(labelFor(events.cohortNumbers.source)));
    ok("104/24/94/10 stay a labelled Welcome Days historical snapshot, with its explanation, original source and updated map link");

    assert.strictEqual(await text(page, ".journey-degree-intro"), normal(events.jointDegree.intro));
    assert.deepStrictEqual(await page.locator(".journey-titles strong").allTextContents(), events.jointDegree.titles.map((entry) => entry.title));
    assert.deepStrictEqual(await page.locator(".journey-year").allTextContents(), events.history.events.map((entry) => String(entry.year)));
    for (const event of events.history.events) assert.ok((await text(page, "#history")).includes(normal(event.text)), `history ${event.year}`);
    assert.ok((await text(page, ".journey-erasmus-caveat")).includes(normal(events.erasmus.caveat)));
    assert.ok((await text(page, "#erasmus")).includes("The grant is not guaranteed."));
    assert.deepStrictEqual(await page.locator(".journey-erasmus-table tbody td").allTextContents(), events.erasmus.byTrack.map((entry) => `${entry.text}*`));
    const fee = events.fees.byCohort[events.cohort];
    const feeText = await text(page, "#fees");
    for (const detail of ["€4,000", "€9,000", fee.academicYear, fee.note, events.fees.missing]) assert.ok(feeText.includes(normal(detail)), `fees: ${detail}`);
    assert.ok(feeText.includes(events.cohort) || feeText.includes(events.cohort.replace("-", "–")), "fees specify their cohort");
    ok("the four legal degree titles, full history, grant limitations and academic-year-specific fees retain every original qualification");

    await page.locator(".academic-nav a[href='#degree']").click();
    await assertAnchor(page, "degree", "degree");
    await page.locator(".academic-nav a[href='#erasmus']").click();
    await assertAnchor(page, "erasmus", "erasmus");
    await page.goBack(); await assertAnchor(page, "degree", "degree");
    await page.goForward(); await assertAnchor(page, "erasmus", "erasmus");
    await page.locator(".journey-route-stops a[href='#stage-semester-3']").focus();
    await page.keyboard.press("Enter");
    await assertAnchor(page, "stage-semester-3", "timeline");
    await page.context().close();
    page = await open("journey.html#stage-semester-3");
    await assertAnchor(page, "stage-semester-3", "timeline");
    await page.context().close();
    ok("Journey section links, browser history and original stage deep links preserve focus and the active navigation state");

    for (const saved of ["{broken", { cohort: "2030-2032", track: "eeh" }, { cohort: events.cohort, track: "unknown-track" }]) {
      page = await open("journey.html", { saved });
      assert.strictEqual(await page.locator("input[name='journey-track'][value='']").isChecked(), true);
      assert.match(await text(page, "#stage-semester-2 .journey-place"), /Depends on your track/);
      await page.context().close();
    }
    ok("broken, other-cohort and unknown saved tracks fall back to an unselected journey without inventing a route");

    for (const config of PAGES) {
      const last = config.sections.at(-1);
      for (const width of [320, 768]) {
        for (const scheme of ["light", "dark"]) {
          page = await open(`${config.file}#${last}`, { viewport: { width, height: 900 }, scheme });
          await assertAnchor(page, last, last);
          await navVisible(page, last);
          await noSideways(page, `${config.file} ${width}px ${scheme}`);
          await assertSources(page);
          if (config.file === "academic-rules.html" && width === 320) {
            await page.locator(".academic-nav a[href='#grading']").click();
            await assertAnchor(page, "grading", "grading");
            const mobileCells = await page.locator(".rules-grades tbody tr").first().locator("td").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("data-label")));
            assert.deepStrictEqual(mobileCells, ["Scale", "Pass mark", "Best grade", "Good to know"]);
            assert.strictEqual(await page.locator(".rules-grades thead").evaluate((node) => getComputedStyle(node).display), "none");
            await capture(page, `academic-rules-grades-320-${scheme}`);
          }
          if (config.file === "journey.html" && width === 320) await capture(page, `journey-fees-320-${scheme}`);
          await page.context().close();
        }
      }
      page = await open(`${config.file}#${last}`);
      await assertAnchor(page, last, last);
      const beforeResize = await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement.id }));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      // Reflow can change which section is being read. The contents rail should
      // reveal that section without forcing a vertical jump back to the old hash.
      const reading = await page.evaluate(() => {
        const nav = document.querySelector(".academic-nav");
        const active = nav.querySelector("a[aria-current='location']")?.hash.slice(1);
        const section = active && document.getElementById(active)?.getBoundingClientRect();
        return { active, top: section?.top, bottom: section?.bottom, navBottom: nav.getBoundingClientRect().bottom, viewportHeight: innerHeight };
      });
      assert.ok(config.sections.includes(reading.active), `resize has a known active section: ${JSON.stringify(reading)}`);
      await navVisible(page, reading.active);
      assert.ok(reading.bottom > reading.navBottom && reading.top < reading.viewportHeight,
        `the active section intersects the reading viewport below the sticky navigation: ${JSON.stringify(reading)}`);
      assert.deepStrictEqual(await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement.id })), beforeResize, "resizing preserves the shared link and keyboard focus");
      await page.locator(`.academic-nav a[href='#${last}']`).click();
      await assertAnchor(page, last, last);
      await navVisible(page, last);
      await noSideways(page, `${config.file}: desktop-to-phone resize`);
      await page.context().close();
    }
    ok("320/768px layouts fit in both themes, mobile grades retain labels, deep links stay visible, and the active navigation item is revealed after resizing");

    assert.deepStrictEqual(errors, [], "no JavaScript, console or missing-local-asset errors");
    ok("no JavaScript errors, console errors or failed local assets");
    console.log(`${count} Academic pages browser checks passed`);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => site.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
