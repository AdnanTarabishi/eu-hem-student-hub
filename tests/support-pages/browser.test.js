// Support, Contact and Privacy: real-browser integration checks with fictional fixtures.
// Run only in the browser-check environment: node tests/support-pages/browser.test.js .
// The suite never follows mailto links or allows external/network-write requests.
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const SHOTS = process.env.SCREENSHOT_DIR ? path.resolve(process.env.SCREENSHOT_DIR) : null;
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const people = read("content/people.json");
const registry = read("content/sources.json");
const cohort = read("content/tracks.json").cohorts.find((entry) => entry.id === "2026-2028");
const sources = Object.fromEntries(registry.sources.map((entry) => [entry.id, entry]));
const { CITY_GUIDES, parseGuide } = require(path.join(ROOT, "guide-data.js"));
const UNIVERSITY_ORDER = ["unibo", "uio", "mci", "eur"];
const EMAIL = "euhem.studenthub@gmail.com";
const SEED = { "euhem-privacy-test-sentinel": "fictional local value — do not change" };
const PAGES = [
  { file: "support.html", sections: ["emergency", "contact-guide", "universities", "leave", "software", "community"] },
  { file: "contact.html", sections: [] },
  { file: "privacy.html", sections: ["on-device", "connections", "messages", "student-directory", "public-content", "rights", "responsible"] },
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
  const errors = [], forbiddenRequests = [];
  const ok = (name) => { count++; console.log(`  ok  ${name}`); };
  try {
    browser = await chromium.launch();
    const waitReady = async (page, file, scripts = true) => {
      await page.locator("body.academic-page").waitFor();
      if (!scripts) return;
      if (file === "support.html") await page.waitForFunction(() => !document.getElementById("support-status"));
      if (file === "contact.html") await page.locator("#contact-copy-email:not([hidden])").waitFor();
      else await page.waitForSelector(".academic-nav a[aria-current='location']");
    };
    const open = async (url, { viewport = { width: 1440, height: 960 }, scheme = "light", scripts = true, clipboard } = {}) => {
      const context = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: "reduce", serviceWorkers: "block", javaScriptEnabled: scripts });
      context.setDefaultTimeout(12000);
      // Match the proven academic-page fixture: do not run a stale service worker,
      // and expose normal feature detection instead of a synthetic blocked registration.
      await context.addInitScript(({ seed, clipboard }) => {
        delete Navigator.prototype.serviceWorker;
        for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
        window.__qaStorageWrites = [];
        for (const method of ["setItem", "removeItem", "clear"]) {
          const original = Storage.prototype[method];
          Storage.prototype[method] = function (...args) {
            window.__qaStorageWrites.push({ method, key: args[0] || null });
            return original.apply(this, args);
          };
        }
        if (clipboard) Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
          writeText: async (value) => {
            if (clipboard === "reject") throw new DOMException("Clipboard blocked for this test", "NotAllowedError");
            window.__qaCopiedText = value;
          },
        } });
      }, { seed: SEED, clipboard });
      await context.route("**/*", (route) => {
        const request = route.request();
        if (!request.url().startsWith(base) || request.method() !== "GET" || request.postData() !== null) {
          forbiddenRequests.push(`${url}: ${request.method()} ${request.url()}`);
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      if (scripts) await page.clock.setFixedTime(new Date("2026-10-08T10:00:00+02:00"));
      page.on("pageerror", (error) => errors.push(`${url}: ${error.message}`));
      page.on("console", (message) => { if (message.type() === "error") errors.push(`${url}: ${message.text()}`); });
      page.on("response", (response) => {
        if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${url}: HTTP ${response.status()} ${response.url()}`);
      });
      await page.goto(base + url);
      await waitReady(page, url.split(/[?#]/)[0], scripts);
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
        const body = item.querySelector(".support-item__text");
        const copy = body ? body.cloneNode(true) : item.cloneNode(true);
        copy.querySelectorAll(".source-badge, [aria-hidden='true']").forEach((node) => node.remove());
        return {
          text: copy.textContent.replace(/\s+/g, " ").trim(),
          mail: item.querySelector("a.support-mail")?.getAttribute("href") || null,
          links: [...item.querySelectorAll("a:not(.support-mail):not(.support-official)")].map((link) => ({ text: link.textContent, href: link.getAttribute("href") })),
          badges: [...item.querySelectorAll(".source-badge")].map((badge) => ({ text: badge.textContent, title: badge.title })),
        };
      }));
      const wanted = expected.map((item) => ({
        text: normal(item.text),
        mail: item.email ? `mailto:${item.email}` : null,
        links: item.link ? [{ text: item.link.label, href: item.link.url }] : [],
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
          navHeight: document.querySelector(".academic-nav")?.offsetHeight,
          documentHeight: document.documentElement.scrollHeight,
          documentReady: document.readyState, fonts: document.fonts?.status,
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


    const close = async (page, scripts = true) => {
      if (scripts) {
        assert.deepStrictEqual(await page.evaluate(() => window.__qaStorageWrites), [], "these pages must not write, clear or remove browser storage");
        assert.deepStrictEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))), SEED, "existing local data remains unchanged");
        assert.strictEqual(await page.evaluate(() => sessionStorage.length), 0, "no session data was added");
      }
      await page.context().close();
    };
    const coordinator = async (page, selector, expected) => {
      assert.strictEqual(await text(page, `${selector} .support-coordinator__role`), normal(expected.role + ":"));
      assert.deepStrictEqual(await page.locator(`${selector} .source-badge`).allTextContents(), [labelFor(expected.source)]);
      const mails = await page.locator(`${selector} a[href^='mailto:']`).evaluateAll((items) => items.map((item) => item.getAttribute("href")));
      assert.deepStrictEqual(mails, expected.email ? [`mailto:${expected.email}`] : []);
      const source = sources[expected.source];
      if (source.link && registry.types[source.type].kind === "official" && expected.source !== "euhem-handbook-2026") {
        assert.strictEqual(await page.locator(`${selector} a[href='${source.link.url}']`).count(), 1);
      }
    };
    const progress = (page) => page.locator(".support-progress progress").evaluate((node) => [node.value, node.max]);
    const printRestores = async (page, selector) => {
      const before = await page.locator(selector).evaluateAll((all) => all.map((details) => details.open));
      assert.ok(before.some((value) => !value), "print fixture includes a closed disclosure");
      await page.evaluate((selector) => {
        window.__qaPrintProbe = [];
        const state = () => [...document.querySelectorAll(selector)].map((details) => details.open);
        window.addEventListener("beforeprint", () => window.__qaPrintProbe.push({ event: "before", open: state() }), { once: true });
        window.addEventListener("afterprint", () => window.__qaPrintProbe.push({ event: "after", open: state() }), { once: true });
      }, selector);
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      assert.ok(pdf.length > 1000, "the real browser produces a print document");
      const probe = await page.evaluate(() => window.__qaPrintProbe);
      assert.deepStrictEqual(probe.find((entry) => entry.event === "before")?.open, before.map(() => true), "printing exposes all hidden terms/contacts");
      assert.deepStrictEqual(probe.find((entry) => entry.event === "after")?.open, before, "afterprint restores exact disclosure choices");
      assert.deepStrictEqual(await page.locator(selector).evaluateAll((all) => all.map((details) => details.open)), before);
      await page.emulateMedia({ media: "print" });
      assert.strictEqual(await page.locator(".academic-nav").evaluate((node) => getComputedStyle(node).display), "none");
      await page.emulateMedia({ media: "screen" });
    };
    const mailLinks = async (page) => {
      const expected = { correction: "Correction", idea: "Idea", privacy: "Privacy or removal request", contribution: "Contribution" };
      assert.strictEqual(await page.locator("#contact-email").getAttribute("href"), `mailto:${EMAIL}`);
      const links = await page.locator(".contact-topic-link[data-topic]").evaluateAll((all) => all.map((link) => ({ topic: link.dataset.topic, href: link.getAttribute("href") })));
      assert.strictEqual(links.length, 4);
      for (const { topic, href } of links) {
        assert.ok(Object.hasOwn(expected, topic), `unknown contact topic ${topic}`);
        assert.doesNotMatch(href, /\s/, "mailto query must encode spaces");
        const url = new URL(href);
        assert.strictEqual(url.protocol, "mailto:");
        assert.strictEqual(url.pathname, EMAIL);
        assert.strictEqual(url.searchParams.get("subject"), `EU-HEM Hub | ${expected[topic]}`);
        assert.deepStrictEqual([...url.searchParams.keys()], ["subject"], "topic links contain no entered message or silent extra recipient");
      }
      assert.deepStrictEqual([...new Set(links.map((link) => link.topic))].sort(), Object.keys(expected).sort());
      for (const href of await page.locator("main a[href^='mailto:']").evaluateAll((all) => all.map((link) => link.getAttribute("href")))) {
        assert.strictEqual(new URL(href).pathname, EMAIL);
      }
    };

    // Capture the real rendered heroes before interaction tests can fail.
    for (const config of PAGES) {
      for (const [size, viewport] of [["desktop", { width: 1440, height: 960 }], ["phone", { width: 390, height: 844 }]]) {
        for (const scheme of ["light", "dark"]) {
          const page = await open(config.file, { viewport, scheme });
          const name = `${config.file.replace(".html", "")}-${size}-${scheme}`;
          await capture(page, name);
          await noSideways(page, name);
          assert.strictEqual(await page.locator("main h1").count(), 1);
          if (config.sections.length) {
            assert.deepStrictEqual(await page.locator(".academic-nav ol a").evaluateAll((all) => all.map((link) => link.hash.slice(1))), config.sections);
            for (const id of config.sections) assert.strictEqual(await page.locator(`#${id}:not([hidden])`).count(), 1);
          }
          if (config.file === "support.html") await assertSources(page);
          if (config.file === "contact.html") await mailLinks(page);
          await verifyLinks(page);
          await close(page);
        }
      }
      ok(`${config.file} renders in desktop/phone and light/dark themes, with valid links and no horizontal overflow`);
    }

    let page = await open("support.html");
    assert.strictEqual(await text(page, "#support-intro"), normal(people.intro));
    assert.strictEqual(await text(page, ".support-guide-intro"), normal(people.contactGuide.intro));
    assert.strictEqual(await text(page, ".support-privacy"), normal(people.privacyNote));
    assert.deepStrictEqual(await page.locator(".support-university-name").allTextContents(), UNIVERSITY_ORDER.map((id) => cohort.universities[id].name));
    for (const id of UNIVERSITY_ORDER) {
      await coordinator(page, `#contacts-${id} .support-coordinator`, people.universities[id].coordinator);
      await assertItems(page, `#contacts-${id} .rules-item`, [...people.universities[id].safety, ...people.universities[id].wellbeing], `${id}: original safety/wellbeing prose, mailboxes, links and sources`);
    }
    for (const key of ["leave", "withdrawal"]) await assertItems(page, `.support-${key} .rules-item`, people[key], key);
    for (const key of ["software", "community"]) await assertItems(page, `#${key} .rules-item`, people[key], key);
    assert.strictEqual(await page.locator(".support-staff-page a").getAttribute("href"), sources[people.staffPage].link.url);
    const mails = await page.locator("main a[href^='mailto:']").evaluateAll((all) => [...new Set(all.map((link) => link.getAttribute("href").slice(7)))].sort());
    assert.deepStrictEqual(mails, [...people.allowedEmails].sort());
    ok("Support retains every original university/list fact, role mailbox, official destination and complete source label, including collapsed content");

    const actualEmergency = await page.locator(".support-emergency-list li").evaluateAll((all) => all.map((item) => ({
      city: item.querySelector(".support-emergency__city").textContent.replace(/:\s*$/, ""),
      number: item.querySelector(".support-emergency__number").textContent,
      href: item.querySelector("a").getAttribute("href"),
    })));
    const expectedEmergency = CITY_GUIDES.filter((guide) => guide.file).map((guide) => ({
      city: cohort.universities[guide.university].city,
      number: parseGuide(fs.readFileSync(path.join(ROOT, guide.file), "utf8")).facts["compare-emergency"].replace(/\s*\[S\d+\]/g, "").trim(),
      href: `city-guide.html?city=${guide.id}`,
    }));
    assert.deepStrictEqual(actualEmergency, expectedEmergency);
    ok("all emergency numbers retain their city-specific ambulance/police/fire distinctions and original City Guide destinations");

    assert.strictEqual(await page.locator("details.rules-uni").count(), 4);
    assert.strictEqual(await page.locator("#contacts-unibo").evaluate((node) => node.open), true);
    const osloSummary = page.locator("#contacts-uio > summary");
    await osloSummary.focus(); await page.keyboard.press("Enter");
    assert.strictEqual(await page.locator("#contacts-uio").evaluate((node) => node.open), true);
    assert.strictEqual(await osloSummary.evaluate((node) => node === document.activeElement), true);
    await page.keyboard.press("Enter");
    assert.strictEqual(await page.locator("#contacts-uio").evaluate((node) => node.open), false);
    await page.locator(".support-toggle-all").click();
    assert.strictEqual(await page.locator("details.rules-uni[open]").count(), 4);
    assert.strictEqual(await page.locator(".support-toggle-all").getAttribute("aria-expanded"), "true");
    assert.match(await text(page, ".support-toggle-all"), /Collapse all/);
    await page.locator(".support-toggle-all").click();
    assert.strictEqual(await page.locator("details.rules-uni[open]").count(), 0);
    assert.strictEqual(await page.locator(".support-toggle-all").getAttribute("aria-expanded"), "false");
    await page.locator("#contacts-unibo > summary").click();
    await printRestores(page, "details.rules-uni");
    ok("university disclosures support native keyboard actions, accurate expand/collapse state and complete printing with exact state restoration");

    assert.deepStrictEqual(await progress(page), [0, 1]);
    await page.locator("input[name='support-topic']").first().focus();
    for (let step = 0; step < 6; step++) await page.keyboard.press("ArrowRight");
    assert.strictEqual(await page.locator("input[name='support-topic']:checked").inputValue(), "wellbeing");
    assert.strictEqual(await page.evaluate(() => document.activeElement.name), "support-topic");
    assert.deepStrictEqual(await progress(page), [1, 2]);
    assert.strictEqual(await page.locator(".support-result").count(), 0);
    await page.keyboard.press("Tab"); await page.keyboard.press("Space");
    assert.strictEqual(await page.locator("input[name='support-university']:checked").inputValue(), "unibo");
    assert.deepStrictEqual(await progress(page), [2, 2]);
    assert.strictEqual(await page.locator(".support-outcome").getAttribute("aria-live"), "polite");
    assert.match(await text(page, ".support-result"), /Psychological Support Service/);
    await page.locator(".support-result").scrollIntoViewIfNeeded();
    await activeNav(page, "contact-guide");
    await capture(page, "support-wellbeing-result-desktop");
    ok("keyboard-only contact guidance keeps focus, reveals conditional university choices, updates progress and announces the wellbeing result");

    let outcomeCount = 0;
    for (const option of people.contactGuide.questions[0].options) {
      const outcome = people.contactGuide.outcomes[option.value];
      const needsUniversity = people.contactGuide.questions[1].showIf.topic.includes(option.value);
      for (const university of needsUniversity ? UNIVERSITY_ORDER : [null]) {
        await page.locator(`input[name='support-topic'][value='${option.value}']`).check();
        if (university) await page.locator(`input[name='support-university'][value='${university}']`).check();
        else assert.strictEqual(await page.locator("input[name='support-university']").count(), 0);
        assert.strictEqual(await text(page, ".support-result h3"), outcome.title);
        const localItems = ["safety", "wellbeing"].includes(outcome.contact) ? people.universities[university][outcome.contact] : [];
        await assertItems(page, ".support-result .rules-item", [...outcome.items, ...localItems], `${option.value}/${university || "all"}: exact outcome`);
        const contactUniversity = outcome.contact === "eur" ? "eur" : outcome.contact === "coordinator" ? university : null;
        if (contactUniversity) await coordinator(page, ".support-result .support-coordinator", people.universities[contactUniversity].coordinator);
        else assert.strictEqual(await page.locator(".support-result .support-coordinator").count(), 0);
        assert.deepStrictEqual(await page.locator(".support-result .support-page-link").evaluateAll((all) => all.map((link) => link.getAttribute("href"))), outcome.page ? [outcome.page.href] : []);
        assert.strictEqual(await page.locator(".support-result .support-emergency-note a[href='#emergency']").count(), outcome.emergency ? 1 : 0);
        assert.deepStrictEqual(await progress(page), needsUniversity ? [2, 2] : [1, 1]);
        outcomeCount++;
      }
    }
    assert.strictEqual(outcomeCount, 27);
    ok("all 27 topic/university routes show the correct prose, role contacts, sources, emergency guidance and next-page link");

    await page.locator("input[name='support-topic'][value='enrolment']").check();
    await page.locator("input[name='support-topic'][value='wellbeing']").check();
    assert.strictEqual(await page.locator("input[name='support-university']:checked").count(), 0, "hidden previous university choice must be discarded");
    assert.strictEqual(await page.locator(".support-result").count(), 0);
    await page.locator("input[name='support-university'][value='uio']").check();
    await page.locator(".resit-reset").click();
    assert.strictEqual(await page.locator("#contact-guide input:checked").count(), 0);
    assert.strictEqual(await page.locator(".support-result").count(), 0);
    assert.deepStrictEqual(await progress(page), [0, 1]);
    assert.strictEqual(await page.evaluate(() => document.activeElement.name), "support-topic");
    await close(page);
    ok("changing topics drops irrelevant university state; Start again clears choices/result/progress and returns keyboard focus");

    for (const [id, section] of [["contacts-uio", "universities"], ["contacts-eur-safety", "universities"]]) {
      page = await open(`support.html#${id}`);
      await assertAnchor(page, id, section);
      assert.strictEqual(await page.locator(`#${id}`).evaluate((node) => node.closest("details").open), true);
      await close(page);
    }
    ok("university and nested safety deep links open the correct disclosure, destination focus and navigation item");

    page = await open("privacy.html");
    const privacyText = await text(page, "main");
    assert.match(privacyText, /registration.{0,35}(not open|closed|not active)|not open.{0,35}registration/i);
    assert.deepStrictEqual(await page.locator(".privacy-provenance h3").allTextContents(), ["105 people · 24 countries", "40 demo profiles"], "current supplied origins and fictional profiles remain separate");
    assert.match(privacyText, /fictional/i);
    assert.match(privacyText, /8 October 2026|8 Oct 2026/);
    assert.match(privacyText, /editor dashboard.{0,30}(not connected|unconnected|inactive)/i);
    assert.strictEqual(await page.locator("#responsible a[href='mailto:" + EMAIL + "']").count(), 1);
    const expectedRetention = { unconfirmedDays: 14, rejectedDays: 30, studentMonthsAfterGraduation: 6, alumniMonths: 24, reminderDays: 60, sharedCourseMonths: 12, staffMonthsAfterInvolvement: 12, deletionRequestDays: 30 };
    const retentionOrder = ["unconfirmedDays", "deletionRequestDays", "unconfirmedDays", "rejectedDays", "studentMonthsAfterGraduation", "alumniMonths", "reminderDays", "sharedCourseMonths", "staffMonthsAfterInvolvement"];
    const actualRetention = await page.locator("[data-retention]").evaluateAll((all) => all.map((item) => ({ key: item.dataset.retention, text: item.textContent.trim() })));
    assert.deepStrictEqual(actualRetention, retentionOrder.map((key) => ({ key, text: `${expectedRetention[key]} ${key.endsWith("Days") ? "days" : "months"}` })), "every retention occurrence and unit stays exact, including the confirmation-link lifetime");
    const directoryConfig = fs.readFileSync(path.join(ROOT, "directory-config.js"), "utf8");
    const backend = fs.readFileSync(path.join(ROOT, "integrations/directory-apps-script/Code.gs"), "utf8");
    const editorConfig = fs.readFileSync(path.join(ROOT, "supabase-config.js"), "utf8");
    assert.match(directoryConfig, /endpoint:\s*""/);
    assert.match(directoryConfig, /consentVersion:\s*"directory-v3-2026-10"/);
    assert.match(backend, /CONSENT_VERSION:\s*'directory-v3-2026-10'/);
    assert.match(editorConfig, /url:\s*""/); assert.match(editorConfig, /publishableKey:\s*""/);
    for (const [key, value] of Object.entries(expectedRetention)) assert.match(backend, new RegExp(`\\b${key}:\\s*${value}\\b`), key);
    const terms = await text(page, "#student-directory");
    for (const phrase of ["nothing is published automatically", "Private by default", "never public", "verified participating EU-HEM students and alumni", "fewer than 5", "withdraw", "private Google Sheet", "private Google Drive folder"]) {
      assert.ok(terms.toLowerCase().includes(phrase.toLowerCase()), `directory safeguard retained: ${phrase}`);
    }
    assert.strictEqual(await page.locator("details#mobility-experience").count(), 1);
    ok("Privacy states current rollout/provenance correctly and retains inactive configuration, consent v3, every retention value and core directory safeguards");

    const termCount = await page.locator("details.privacy-term").count();
    assert.ok(termCount >= 5, "detailed terms use native disclosures");
    await page.locator("#privacy-expand-all").click();
    assert.strictEqual(await page.locator("details.privacy-term[open]").count(), termCount);
    assert.strictEqual(await page.locator("#privacy-expand-all").getAttribute("aria-expanded"), "true");
    assert.match(await text(page, "#privacy-expand-all"), /Collapse/i);
    await page.locator("#privacy-expand-all").click();
    assert.strictEqual(await page.locator("details.privacy-term[open]").count(), 0);
    assert.strictEqual(await page.locator("#privacy-expand-all").getAttribute("aria-expanded"), "false");
    const firstTerm = page.locator("details.privacy-term > summary").first();
    await firstTerm.focus(); await page.keyboard.press("Enter");
    assert.strictEqual(await firstTerm.evaluate((node) => node.parentElement.open), true);
    assert.strictEqual(await firstTerm.evaluate((node) => node === document.activeElement), true);
    await printRestores(page, ".academic-content details");
    await close(page);
    page = await open("privacy.html#mobility-experience");
    await assertAnchor(page, "mobility-experience", "student-directory");
    assert.strictEqual(await page.locator("#mobility-experience").evaluate((node) => {
      for (let current = node; current; current = current.parentElement) if (current.tagName === "DETAILS" && !current.open) return false;
      return true;
    }), true, "every disclosure ancestor of the old mobility link is open");
    await capture(page, "privacy-mobility-terms-desktop");
    await close(page);
    ok("Privacy terms support keyboard disclosure, honest expand/collapse state, nested mobility deep links and complete print/restore behavior");

    for (const config of PAGES.filter((entry) => entry.sections.length)) {
      page = await open(config.file);
      const first = config.sections[1], second = config.sections.at(-2), last = config.sections.at(-1);
      await page.locator(`.academic-nav a[href='#${first}']`).click(); await assertAnchor(page, first, first);
      await page.locator(`.academic-nav a[href='#${second}']`).click(); await assertAnchor(page, second, second);
      await page.goBack(); await assertAnchor(page, first, first);
      await page.goForward(); await assertAnchor(page, second, second);
      const previous = await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement.id }));
      await page.locator(`#${last}`).evaluate((node) => {
        const readingTop = document.querySelector(".site-header").getBoundingClientRect().bottom + 20;
        window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top - readingTop, behavior: "instant" });
      });
      await activeNav(page, last);
      assert.deepStrictEqual(await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement.id })), previous);
      await close(page);
    }
    ok("Support and Privacy section links set focus, support Back/Forward, and track ordinary scrolling without rewriting the URL or moving focus");

    page = await open("privacy.html", { scripts: false });
    assert.strictEqual(await page.locator("#privacy-expand-all").isVisible(), false);
    assert.strictEqual(await page.locator("#privacy-print").isVisible(), false);
    await page.locator("#directory-retention > summary").click();
    assert.strictEqual(await page.locator("#directory-retention [data-retention]").first().isVisible(), true);
    await close(page, false);
    ok("the complete Privacy notice and native registration terms remain readable with JavaScript disabled");

    page = await open("contact.html", { scripts: false });
    await mailLinks(page);
    assert.strictEqual(await page.locator("#contact-copy-email").isVisible(), false);
    assert.strictEqual(await page.locator("#contact-form-section").isVisible(), false, "the native form stays hidden when JavaScript is disabled");
    assert.strictEqual(await page.locator("#contact-form-fields").evaluate((fieldset) => fieldset.disabled), true, "the no-JavaScript form keeps its native fieldset disabled");
    assert.strictEqual(await page.locator("#contact-submit").isDisabled(), true, "disabled controls cannot submit an unintended native request");
    assert.strictEqual(await page.locator("#contact-topics").isVisible(), true, "ordinary email routes remain usable without JavaScript");
    await close(page, false);
    ok("all four encoded contact subjects and the main email destination work with JavaScript disabled, without following any mailto link");

    page = await open("contact.html", { clipboard: "success" });
    await page.locator("#contact-copy-email").focus(); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("contact-copy-status").textContent.includes("copied"));
    assert.strictEqual(await page.evaluate(() => window.__qaCopiedText), EMAIL);
    assert.strictEqual(await page.locator("#contact-copy-fallback").isVisible(), false);
    assert.strictEqual(await page.locator("#contact-copy-email").getAttribute("aria-busy"), null);
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "contact-copy-email");
    await close(page);
    page = await open("contact.html", { clipboard: "reject", viewport: { width: 390, height: 844 }, scheme: "dark" });
    await page.locator("#contact-copy-email").click();
    await page.locator("#contact-copy-fallback:not([hidden])").waitFor();
    const fallback = await page.locator("#contact-copy-value").evaluate((node) => ({ value: node.value, readonly: node.readOnly, focus: document.activeElement === node, start: node.selectionStart, end: node.selectionEnd }));
    assert.deepStrictEqual(fallback, { value: EMAIL, readonly: true, focus: true, start: 0, end: EMAIL.length });
    assert.match(await text(page, "#contact-copy-status"), /unavailable|select/i);
    await noSideways(page, "Contact clipboard fallback");
    await capture(page, "contact-copy-fallback-phone-dark");
    await close(page);
    ok("clipboard success announces the exact address; rejected clipboard access reveals, focuses and selects a usable manual-copy field");

    for (const config of PAGES) {
      const last = config.sections.at(-1);
      for (const scheme of ["light", "dark"]) {
        page = await open(config.file + (last ? `#${last}` : ""), { viewport: { width: 320, height: 900 }, scheme });
        if (last) { await assertAnchor(page, last, last); await navVisible(page, last); }
        if (config.file === "support.html") {
          await assertSources(page);
          await page.locator(".academic-nav a[href='#universities']").click();
          await page.locator(".support-toggle-all").click();
          await assertSources(page);
        }
        if (config.file === "privacy.html") {
          await page.locator("#privacy-expand-all").click();
          await page.locator("#mobility-experience").scrollIntoViewIfNeeded();
        }
        await noSideways(page, `${config.file}: 320px ${scheme}`);
        await capture(page, `${config.file.replace(".html", "")}-320-${scheme}`);
        await close(page);
      }
      if (!last) continue;
      page = await open(`${config.file}#${last}`);
      const before = await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement.id }));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const reading = await page.evaluate(() => {
        const nav = document.querySelector(".academic-nav");
        const active = nav.querySelector("a[aria-current='location']")?.hash.slice(1);
        const rect = active && document.getElementById(active).getBoundingClientRect();
        return { active, top: rect?.top, bottom: rect?.bottom, navBottom: nav.getBoundingClientRect().bottom, height: innerHeight };
      });
      assert.ok(config.sections.includes(reading.active));
      await navVisible(page, reading.active);
      assert.ok(reading.bottom > reading.navBottom && reading.top < reading.height, `reading section remains visible after reflow: ${JSON.stringify(reading)}`);
      assert.deepStrictEqual(await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement.id })), before);
      await page.locator(`.academic-nav a[href='#${last}']`).click();
      await assertAnchor(page, last, last); await navVisible(page, last);
      await noSideways(page, `${config.file}: resized phone`);
      await close(page);
    }
    ok("320px layouts fit in both themes with expanded sources/terms; responsive navigation follows the visible section after reflow and keeps its active link in view");

    assert.deepStrictEqual(forbiddenRequests, [], "no remote provider, email, POST or other network-write requests");
    assert.deepStrictEqual(errors, [], "no JavaScript, console or missing-local-asset errors");
    ok("no page stores visitor choices, modifies existing local data, contacts an external provider or emits JavaScript/asset errors");
    console.log(`${count} Support, Contact and Privacy browser checks passed`);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => site.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
