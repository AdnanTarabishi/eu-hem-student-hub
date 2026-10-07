// End-to-end personal thesis planning and historical archive regressions.
// Run: node tests/thesis-guide/browser.test.js .
// CSS-only follow-up: THESIS_LAYOUT_ONLY=1 node tests/thesis-guide/browser.test.js .
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const guide = read("content/thesis-guide.json"), cohort = read("content/tracks.json").cohorts.at(-1);
const archive = read("content/thesis-archive.json"), config = read("content/thesis-config.json"), enrichment = read("content/thesis-enrichment.json");
const D = require(path.join(ROOT, "thesis-guide-data.js"));
global.simplify = text => String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const A = require(path.join(ROOT, "thesis-data.js")), E = require(path.join(ROOT, "thesis-enrichment.js"));
const entries = Object.fromEntries(enrichment.records.map(entry => [entry.id, entry]));
const prepared = A.prepareRecords(archive.records, record => {
  const entry = entries[record.id], relevance = E.trackRelevance(entry, enrichment, cohort.tracks.map(track => track.id));
  return { entry, themes: entry.themes || [], statedMethods: entry.statedMethods || [], currentTracks: relevance.map(item => item.trackId), relevance };
});
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const PLAN_KEY = "euhem-study-plan-v1", TRACK_KEY = "euhem-track-v1", JOURNEY_KEY = "euhem-study-journey-v1";
const SAVED_PLAN = { version: 1, cohort: "2026-27", term: "y1-s1", choices: { quant: "96496", elective: "C8393", crash: [] }, statuses: { "97177": "passed" }, savedAt: "2026-10-01T10:00:00Z" };
let checks = 0;
const ok = name => { checks++; console.log("  ok  " + name); };
const text = async (page, selector) => (await page.textContent(selector) || "").replace(/\s+/g, " ").trim();
const stored = (page, key = D.DRAFT_KEY) => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const view = (page, name) => page.locator(`#tg-tabs button[data-guide-view="${name}"]`).click();
const input = (page, key) => page.locator(`#tg-field-${key}`);
const archiveExpected = state => A.thesisResults(prepared, { q: "", cohort: "", track: "", university: "", theme: "", currentTrack: "", method: "", sort: "newest", ...state }, config.synonyms);
const resultIds = page => page.locator("#thesis-results > .thesis-card").evaluateAll(nodes => nodes.map(node => node.dataset.id));
const archiveCount = async page => Number((await text(page, "#thesis-count")).match(/\d+/)[0]);

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
  const open = async (options = {}) => {
    const { storage = {}, storageBlocked = false, failure = "", failCount = 1, query = "", ...contextOptions } = options;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block", acceptDownloads: true, ...contextOptions });
    contexts.push(context);
    await context.clock.setFixedTime(new Date("2026-10-07T09:00:00Z"));
    if (storageBlocked) await context.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } }));
    if (Object.keys(storage).length) await context.addInitScript(items => { for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value); }, storage);
    let failures = 0;
    await context.route(/^https?:\/\//, route => {
      const address = new URL(route.request().url());
      if (failures < failCount && failure && address.pathname.endsWith(failure)) { failures++; return route.fulfill({ status: 503, body: "unavailable" }); }
      return address.hostname === "127.0.0.1" ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "thesis.html" + query);
    await page.locator("#tg-tabs button").first().waitFor();
    return page;
  };
  try {
    let draftBeforeExport = D.sanitizeDraft({ version: 1, cohort: cohort.id, trackId: "ep", fields: {
      topic: "A".repeat(D.FIELD_LIMITS.topic), question: "An answerable research question", notes: "Confirm evidence access and the next meeting." }, completed: [], savedIdeas: [] }, guide, cohort);
    if (!process.env.THESIS_LAYOUT_ONLY) {
    const sharedStorage = {
      [PLAN_KEY]: JSON.stringify(SAVED_PLAN),
      [TRACK_KEY]: JSON.stringify({ cohort: cohort.id, track: "ep" }),
      [JOURNEY_KEY]: JSON.stringify({ version: 1, cohort: cohort.id, tracks: { ep: { thesisTopic: "My earlier Study Plan idea" } } }),
    };
    let page = await open({ storage: sharedStorage });
    await page.locator("#tg-stage-semester-1").waitFor();
    assert.strictEqual(await page.locator("h1:visible").count(), 1);
    assert.strictEqual(await page.locator('#tg-tabs[role="tablist"] button[role="tab"]').count(), 5);
    assert.strictEqual(await page.locator('#tg-tabs button[aria-selected="true"]').getAttribute("data-guide-view"), "roadmap");
    assert.strictEqual(await page.locator(".tg-stage").count(), guide.journey.length);
    assert.match(await text(page, "#tg-panel-roadmap"), /30 ECTS|30 credits/);
    assert.ok(await page.locator('#tg-panel-roadmap .tg-fact a[href^="https://"]').count(), "published facts link to their sources");
    await page.locator("#tg-tab-roadmap").focus();
    await page.keyboard.press("ArrowRight");
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "tg-tab-topics");
    assert.strictEqual(await page.locator("#tg-panel-topics").isVisible(), true);
    await page.keyboard.press("End");
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "tg-tab-archive");
    await page.keyboard.press("Home");
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "tg-tab-roadmap");
    ok("one visible title, sourced programme facts, six preparation stages and five keyboard-operated guide views make the full guide reachable");

    const firstCheck = guide.journey[0].checklist[0].id, secondStage = guide.journey[1], secondCheck = secondStage.checklist[0].id;
    await page.locator(`#tg-check-${firstCheck}`).check();
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), `tg-check-${firstCheck}`);
    await page.locator(`#tg-stage-${secondStage.id}`).click();
    assert.strictEqual(await page.locator(`#tg-stage-${secondStage.id}`).getAttribute("aria-pressed"), "true");
    assert.ok((await text(page, "#tg-stage-detail")).includes(secondStage.deliverable));
    await page.locator(`#tg-check-${secondCheck}`).check();
    assert.deepStrictEqual((await stored(page)).completed, [firstCheck, secondCheck]);
    assert.strictEqual((await stored(page)).selectedStage, secondStage.id);
    assert.ok((await text(page, '#tg-panel-roadmap [data-guide-progress="label"]')).includes(`2 of ${D.checklistIds(guide).length}`));
    await view(page, "planner");
    const checklist = page.locator("#tg-panel-planner details").filter({ hasText: "My complete planning checklist" });
    await checklist.locator("summary").click();
    assert.strictEqual(await page.locator(`#tg-plan-check-${firstCheck}`).isChecked(), true);
    await page.locator(`#tg-plan-check-${firstCheck}`).uncheck();
    await view(page, "roadmap");
    await page.locator("#tg-stage-semester-1").click();
    assert.strictEqual(await page.locator(`#tg-check-${firstCheck}`).isChecked(), false);
    await page.reload();
    await page.locator("#tg-stage-semester-1").waitFor();
    assert.strictEqual(await page.locator(`#tg-check-${firstCheck}`).isChecked(), false);
    assert.deepStrictEqual((await stored(page)).completed, [secondCheck]);
    ok("planning milestones save, keep focus, update progress and stay synchronized between the roadmap and personal checklist after reload");

    await view(page, "topics");
    assert.match(await text(page, "#tg-panel-topics"), /illustrative.*not available|starting points.*not available/is);
    await page.locator("#tg-topic-track").selectOption("");
    assert.strictEqual(await page.locator("#tg-topic-grid .tg-topic-card").count(), guide.topics.length);
    for (const track of cohort.tracks) {
      await page.locator("#tg-topic-track").selectOption(track.id);
      const expected = guide.topics.filter(topic => topic.trackIds.includes(track.id));
      assert.deepStrictEqual(await page.locator("#tg-topic-grid .tg-topic-card").evaluateAll(nodes => nodes.map(node => node.id)), expected.map(topic => `tg-topic-${topic.id}`));
    }
    const idea = guide.topics[0], method = idea.methods[0];
    await page.locator("#tg-topic-track").selectOption(idea.trackIds[0]);
    await page.locator("#tg-topic-method").selectOption(method);
    assert.strictEqual(await page.locator("#tg-topic-grid .tg-topic-card").count(), guide.topics.filter(topic => topic.trackIds.includes(idea.trackIds[0]) && topic.methods.includes(method)).length);
    const saveIdea = page.locator(`[data-save-idea="${idea.id}"]`);
    await saveIdea.click();
    assert.strictEqual(await saveIdea.getAttribute("aria-pressed"), "true");
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), `tg-save-idea-${idea.id}`);
    assert.deepStrictEqual((await stored(page)).savedIdeas, [idea.id]);
    await view(page, "planner");
    assert.strictEqual(await input(page, "topic").inputValue(), "", "saving an idea does not overwrite the current brief");
    await page.locator(`[data-use-idea="${idea.id}"]`).click();
    assert.strictEqual(await input(page, "topic").inputValue(), idea.title);
    assert.strictEqual(await input(page, "question").inputValue(), idea.question);
    assert.strictEqual(await input(page, "data").inputValue(), idea.dataIdea);
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), "tg-field-question");
    await page.reload();
    await input(page, "topic").waitFor();
    assert.strictEqual(await input(page, "topic").inputValue(), idea.title);
    assert.deepStrictEqual((await stored(page)).savedIdeas, [idea.id]);
    ok("track and method lenses filter real illustrative prompts; saving keeps the brief intact, and an explicit Use action starts a persistent personal proposal");

    assert.strictEqual(await page.locator("#tg-plan-track").inputValue(), "ep");
    assert.strictEqual(await page.locator("#tg-plan-host").inputValue(), "");
    for (const track of cohort.tracks) {
      await page.locator("#tg-plan-track").selectOption(track.id);
      assert.deepStrictEqual(await page.locator("#tg-plan-host option").evaluateAll(nodes => nodes.map(node => node.value).filter(Boolean)), track.thesis);
      await page.locator("#tg-plan-host").selectOption(track.thesis[0]);
      assert.strictEqual((await stored(page)).hostUniversity, track.thesis[0]);
    }
    await page.locator("#tg-plan-track").selectOption("mhi");
    assert.strictEqual(await page.locator("#tg-plan-host").inputValue(), "", "switching the workspace track clears the previous host");
    await page.locator("#tg-plan-host").selectOption(cohort.tracks.find(track => track.id === "mhi").thesis[0]);
    const inert = '<img src=x onerror="window.thesisInjected=true">';
    await input(page, "topic").fill(inert);
    await input(page, "question").fill("How do hospital services affect access in this setting?");
    await input(page, "supervisor").fill("Potential research team — meeting to arrange");
    await input(page, "notes").fill("Verify evidence access before finalising the question.");
    for (const [key, limit] of Object.entries(D.FIELD_LIMITS)) assert.strictEqual(Number(await input(page, key).getAttribute("maxlength")), limit);
    assert.ok((await text(page, "#tg-proposal-preview")).includes(inert));
    assert.strictEqual(await page.locator("#tg-proposal-preview img").count(), 0);
    assert.strictEqual(await page.evaluate(() => !!window.thesisInjected), false);
    await page.reload();
    await input(page, "topic").waitFor();
    assert.strictEqual(await input(page, "topic").inputValue(), inert);
    assert.strictEqual(await input(page, "supervisor").inputValue(), "Potential research team — meeting to arrange");
    for (const [key, value] of Object.entries(sharedStorage)) assert.strictEqual(await page.evaluate(key => localStorage.getItem(key), key), value, "guide edits never mutate the shared Study Plan or track preference");
    ok("the workspace offers only eligible thesis hosts, preserves bounded question and supervisor notes, renders user text inertly and leaves the Study Plan untouched");

    draftBeforeExport = await stored(page);
    const backupDownload = page.waitForEvent("download"); await page.locator("#tg-export-json").click();
    const backupFile = await backupDownload;
    assert.strictEqual(backupFile.suggestedFilename(), "euhem-thesis-workspace.json");
    const backup = JSON.parse(fs.readFileSync(await backupFile.path(), "utf8"));
    assert.deepStrictEqual(D.importBackup(backup, guide, cohort), draftBeforeExport);
    const briefDownload = page.waitForEvent("download"); await page.locator("#tg-export-brief").click();
    const briefFile = await briefDownload, brief = fs.readFileSync(await briefFile.path(), "utf8");
    assert.match(brief, /MY THESIS.*WORKING BRIEF/);
    assert.ok(brief.includes(inert));
    assert.match(brief, /Potential research team/);
    assert.match(brief, /PLANNING CHECKLIST/);
    page.once("dialog", dialog => dialog.dismiss()); await page.locator("#tg-reset").click();
    assert.deepStrictEqual(await stored(page), draftBeforeExport);
    page.once("dialog", dialog => dialog.accept()); await page.locator("#tg-reset").click();
    assert.strictEqual(await input(page, "topic").inputValue(), "");
    assert.deepStrictEqual((await stored(page)).completed, []);
    assert.deepStrictEqual((await stored(page)).savedIdeas, []);
    await page.locator("#tg-import").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("not json") });
    await page.locator("#tg-import-status").filter({ hasText: "not valid JSON" }).waitFor();
    const afterReset = await stored(page);
    await page.locator("#tg-import").setInputFiles({ name: "foreign.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...backup, cohort: "wrong" })) });
    await page.locator("#tg-import-status").filter({ hasText: "valid thesis-workspace backup" }).waitFor();
    assert.deepStrictEqual(await stored(page), afterReset);
    page.once("dialog", dialog => dialog.dismiss());
    await page.locator("#tg-import").setInputFiles({ name: "cancelled.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
    await page.locator("#tg-import-status").filter({ hasText: "cancelled" }).waitFor();
    assert.deepStrictEqual(await stored(page), afterReset);
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#tg-import").setInputFiles({ name: "restore.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
    await page.locator("#tg-import-status").filter({ hasText: "Backup restored" }).waitFor();
    assert.deepStrictEqual(await stored(page), draftBeforeExport);
    await page.evaluate(() => { window.__printCalled = 0; window.print = () => { window.__printCalled++; }; });
    await page.locator("#tg-print").click();
    assert.strictEqual(await page.evaluate(() => window.__printCalled), 1);
    await page.emulateMedia({ media: "print" });
    assert.strictEqual(await page.locator("#tg-print-summary").isVisible(), true);
    assert.ok((await text(page, "#tg-print-summary")).includes(inert));
    assert.match(await text(page, "#tg-print-summary"), /PLANNING CHECKLIST/);
    assert.strictEqual(await page.locator("h1:visible").count(), 1);
    await page.emulateMedia({ media: "screen" });
    ok("local backup and research-brief downloads are complete; invalid or cancelled restores preserve the draft, confirmed reset/restore works, and PDF printing presents the brief and checklist");

    const seedPage = await open({ storage: sharedStorage, query: "#guide-planner" });
    await seedPage.locator("#tg-seed-studyplan").waitFor();
    assert.strictEqual(await input(seedPage, "topic").inputValue(), "", "a saved Study Plan idea is not copied without an action");
    await seedPage.locator("#tg-seed-studyplan").click();
    assert.strictEqual(await input(seedPage, "topic").inputValue(), "My earlier Study Plan idea");
    for (const [key, value] of Object.entries(sharedStorage)) assert.strictEqual(await seedPage.evaluate(key => localStorage.getItem(key), key), value);
    ok("a thesis idea from the existing Study Plan is copied only by the student's explicit action, without modifying either shared plan key");

    await view(page, "toolkit");
    assert.strictEqual(await page.locator(".tg-method-card").count(), guide.methods.length);
    assert.strictEqual(await page.locator(".tg-toolkit-jumps button").count(), 5);
    await page.locator(".tg-toolkit-jumps").getByRole("button", { name: "Supervision", exact: true }).click();
    assert.strictEqual(await page.evaluate(() => !!document.activeElement.closest("#tg-supervision")), true, "toolkit jump moves keyboard focus to its destination");
    assert.strictEqual(new URL(page.url()).hash, "#guide-toolkit");
    const email = page.locator("#tg-panel-toolkit details").filter({ hasText: "First-contact email scaffold" });
    await email.locator("summary").click();
    assert.ok((await email.locator("pre").innerText()).includes(guide.supervision.emailTemplate));
    assert.ok(await page.locator('#tg-resources a[href^="https://"]').count());
    ok("research methods, practical supervision guidance and source resources are reachable through keyboard-focused toolkit shortcuts and an adaptable contact-email scaffold");

    await view(page, "archive");
    await page.locator("#thesis-results > .thesis-card").first().waitFor();
    assert.strictEqual(await archiveCount(page), archive.records.length);
    assert.deepStrictEqual(await resultIds(page), archiveExpected().slice(0, 20).map(item => item.record.id));
    assert.strictEqual(await page.locator("h1:visible").count(), 1);
    await page.locator("#thesis-more").click();
    assert.strictEqual((await resultIds(page)).length, 40);
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), `topic-${archiveExpected()[20].record.id}`);
    const first = page.locator("#thesis-results .thesis-card-toggle").first();
    await first.click();
    assert.strictEqual(await first.getAttribute("aria-expanded"), "true");
    assert.match(await text(page, ".thesis-card.is-open"), /Student Hub classification/);
    assert.match(await text(page, ".thesis-card.is-open"), /Legacy track/);
    assert.ok(await page.locator('.thesis-card.is-open a[href^="https://scholar.google.com/"]').count());
    await first.click();
    assert.strictEqual(await first.getAttribute("aria-expanded"), "false");
    ok("historical records retain their exact count, source metadata, accessible detail toggles, repository search and keyboard-focused pagination");

    await page.locator("#thesis-search").fill("cancer");
    await page.waitForFunction(() => new URLSearchParams(location.search).get("q") === "cancer");
    assert.strictEqual(await archiveCount(page), archiveExpected({ q: "cancer" }).length);
    assert.ok(await page.locator("#thesis-results mark").count());
    await page.locator("#filter-track").selectOption("EEH");
    assert.strictEqual(await archiveCount(page), archiveExpected({ q: "cancer", track: "EEH" }).length);
    await page.locator("#thesis-sort").selectOption("title");
    assert.deepStrictEqual(await resultIds(page), archiveExpected({ q: "cancer", track: "EEH", sort: "title" }).slice(0, 20).map(item => item.record.id));
    await page.goBack();
    await page.waitForFunction(() => !new URLSearchParams(location.search).has("sort"));
    assert.strictEqual(await page.locator("#filter-track").inputValue(), "EEH");
    await page.goBack();
    await page.waitForFunction(() => !new URLSearchParams(location.search).has("track"));
    assert.strictEqual(await page.locator("#thesis-search").inputValue(), "cancer");
    await page.locator("#thesis-search").fill("there-is-no-such-research-zzzz");
    await page.locator("#thesis-empty:visible").waitFor();
    assert.strictEqual(await archiveCount(page), 0);
    await page.locator("#thesis-empty [data-clear]").click();
    assert.strictEqual(await archiveCount(page), archive.records.length);
    await page.locator("#thesis-inspire").click();
    assert.strictEqual(await page.locator(".thesis-card.is-open").count(), 1);
    const inspiredId = (await page.locator(".thesis-card.is-open").getAttribute("data-id"));
    assert.ok(archive.records.some(record => record.id === inspiredId));
    assert.strictEqual(new URL(page.url()).searchParams.get("topic"), inspiredId);
    ok("archive search, title highlights, combined filters, sorting, Back navigation, empty-state clearing and Inspire me still work");

    const linkedRecord = archive.records.at(-1);
    const linked = await open({ query: `?topic=${linkedRecord.id}` });
    await linked.locator(`#topic-${linkedRecord.id}[aria-expanded="true"]`).waitFor();
    assert.strictEqual(await linked.locator(`#topic-${linkedRecord.id}`).isVisible(), true);
    assert.strictEqual(await linked.locator('#tg-tabs button[data-guide-view="archive"]').getAttribute("aria-selected"), "true");
    await linked.locator("#browse-tab-currentTrack").click();
    assert.match(await text(linked, "#thesis-browse-panel"), /not official track assignment/i);
    const pills = linked.locator("#thesis-browse-panel .thesis-pill");
    assert.strictEqual(await pills.count(), 4);
    for (let index = 0; index < cohort.tracks.length; index++) {
      const track = cohort.tracks[index], count = prepared.filter(record => record.currentTracks.includes(track.id)).length;
      assert.ok((await pills.nth(index).innerText()).includes(`${count} historical`));
    }
    await pills.nth(0).click();
    assert.strictEqual(await archiveCount(linked), archiveExpected({ currentTrack: cohort.tracks[0].id }).length);
    assert.strictEqual(new URL(linked.url()).searchParams.get("currentTrack"), cohort.tracks[0].id);
    ok("old shared topic links open the archive directly and current-track relevance remains a labelled interpretation with data-derived counts");

    const guideFailure = await open({ failure: "content/thesis-guide.json" });
    await guideFailure.locator("#tg-retry").waitFor();
    await view(guideFailure, "archive");
    await guideFailure.locator("#thesis-results > .thesis-card").first().waitFor();
    assert.strictEqual(await archiveCount(guideFailure), archive.records.length);
    await view(guideFailure, "roadmap");
    await guideFailure.locator("#tg-retry").click();
    await guideFailure.locator("#tg-stage-semester-1").waitFor();
    assert.strictEqual(await guideFailure.locator(".tg-stage").count(), guide.journey.length);
    const archiveFailure = await open({ failure: "content/thesis-archive.json" });
    await archiveFailure.locator("#tg-stage-semester-1").waitFor();
    await view(archiveFailure, "planner");
    await input(archiveFailure, "topic").fill("A draft survives archive recovery");
    await view(archiveFailure, "archive");
    await archiveFailure.locator("#thesis-retry").waitFor();
    await archiveFailure.locator("#thesis-retry").click();
    await archiveFailure.locator("#thesis-results > .thesis-card").first().waitFor();
    assert.strictEqual(await archiveCount(archiveFailure), archive.records.length);
    assert.strictEqual(await archiveFailure.locator("#thesis-intro .thesis-stats").count(), 1, "retry does not duplicate the archive intro");
    await view(archiveFailure, "planner");
    assert.strictEqual(await input(archiveFailure, "topic").inputValue(), "A draft survives archive recovery");
    ok("a guide failure leaves the archive usable and an archive failure leaves planning usable; each retry recovers independently without losing the draft");

    const trackFailure = await open({ failure: "content/tracks.json", failCount: 2, storage: { [D.DRAFT_KEY]: JSON.stringify(draftBeforeExport) }, query: "#guide-planner" });
    await trackFailure.locator("#tg-reload-tracks").waitFor();
    assert.strictEqual(await trackFailure.locator("#tg-plan-host").isDisabled(), true);
    await input(trackFailure, "notes").fill("Kept while track details are unavailable");
    assert.deepStrictEqual(await stored(trackFailure), draftBeforeExport, "a failed track feed cannot overwrite a previously validated host");
    assert.match(await text(trackFailure, "#tg-save-state"), /kept in this tab.*reload track/i);
    const fallbackDownload = trackFailure.waitForEvent("download"); await trackFailure.locator("#tg-export-json").click();
    const fallbackFile = await fallbackDownload;
    const fallbackBackup = JSON.parse(fs.readFileSync(await fallbackFile.path(), "utf8"));
    assert.strictEqual(fallbackBackup.draft.trackId, draftBeforeExport.trackId);
    assert.strictEqual(fallbackBackup.draft.hostUniversity, draftBeforeExport.hostUniversity);
    assert.strictEqual(fallbackBackup.draft.fields.notes, "Kept while track details are unavailable");
    await trackFailure.locator("#tg-reload-tracks").click();
    await trackFailure.waitForFunction(() => !document.getElementById("tg-plan-host").disabled);
    assert.strictEqual(await trackFailure.locator("#tg-plan-track").inputValue(), draftBeforeExport.trackId);
    assert.strictEqual(await trackFailure.locator("#tg-plan-host").inputValue(), draftBeforeExport.hostUniversity);
    assert.strictEqual((await stored(trackFailure)).fields.notes, "Kept while track details are unavailable");
    ok("a failed current-track feed protects the stored host and track, allows an intact backup of in-tab edits and restores eligible host data before saving again");

    const blocked = await open({ storageBlocked: true });
    await blocked.locator("#tg-stage-semester-1").waitFor();
    await blocked.locator(`#tg-check-${firstCheck}`).check();
    await view(blocked, "planner");
    await input(blocked, "topic").fill("Still useful without browser storage");
    assert.match(await text(blocked, "#tg-save-state"), /kept in this tab.*storage unavailable/i);
    assert.ok((await text(blocked, "#tg-proposal-preview")).includes("Still useful without browser storage"));
    assert.match(await text(blocked, '#tg-panel-planner [data-guide-progress="label"]'), /1 of/);
    const blockedDownload = blocked.waitForEvent("download"); await blocked.locator("#tg-export-json").click();
    const blockedFile = await blockedDownload;
    assert.strictEqual(JSON.parse(fs.readFileSync(await blockedFile.path(), "utf8")).draft.fields.topic, "Still useful without browser storage");
    await view(blocked, "archive");
    await blocked.locator("#thesis-results > .thesis-card").first().waitFor();
    assert.strictEqual(await archiveCount(blocked), archive.records.length);
    await view(blocked, "topics");
    await blocked.evaluate(() => { window.__navigationToken = "same document"; });
    await blocked.locator(`#tg-topic-${guide.topics[0].id} a[href*="?q="]`).click();
    assert.strictEqual(await blocked.evaluate(() => window.__navigationToken), "same document");
    assert.strictEqual(await blocked.locator('#tg-tabs button[data-guide-view="archive"]').getAttribute("aria-selected"), "true");
    assert.strictEqual(await blocked.locator("#thesis-search").inputValue(), guide.topics[0].archiveKeywords[0]);
    await view(blocked, "planner");
    assert.strictEqual(await input(blocked, "topic").inputValue(), "Still useful without browser storage");
    ok("blocked storage has an honest save status while editing and backups remain usable; related archive links preserve the in-tab draft without reloading");
    }

    const screenshots = path.resolve(process.env.THESIS_SCREENSHOT_DIR || "/workspace/work/thesis-redesign/screenshots");
    if (process.env.THESIS_SCREENSHOTS) fs.mkdirSync(screenshots, { recursive: true });
    for (const width of [360, 768, 1440]) {
      for (const colorScheme of ["light", "dark"]) {
        const layoutPage = await open({ viewport: { width, height: 1000 }, colorScheme, storage: { [D.DRAFT_KEY]: JSON.stringify(draftBeforeExport) } });
        await layoutPage.locator("#tg-stage-semester-1").waitFor();
        if (width <= 600) {
          const navigation = await layoutPage.locator("#tg-tabs").evaluate(node => {
            const box = node.getBoundingClientRect();
            return { overflow: node.scrollWidth - node.clientWidth, buttons: [...node.querySelectorAll("button")].map(button => {
              const bounds = button.getBoundingClientRect(); return bounds.left >= box.left - 1 && bounds.right <= box.right + 1 && bounds.top >= box.top - 1 && bounds.bottom <= box.bottom + 1;
            }) };
          });
          assert.strictEqual(navigation.buttons.length, 5);
          assert.ok(navigation.buttons.every(Boolean), "all five phone guide tabs fit within the visible navigation container");
          assert.ok(navigation.overflow <= 1, "the phone navigation needs no horizontal scrolling");
        }
        await layoutPage.locator('.tg-hero-actions a[href="#guide-planner"]').click();
        await layoutPage.waitForFunction(() => document.querySelector('#tg-tab-planner[aria-selected="true"]'));
        const heroJump = await layoutPage.evaluate(() => ({ target: document.getElementById("tg-tabs").getBoundingClientRect().top, header: document.querySelector(".site-header").getBoundingClientRect().bottom }));
        assert.ok(heroJump.target >= heroJump.header - 2, `${width}/${colorScheme}: the hero action exposes navigation below the sticky header`);
        await view(layoutPage, "toolkit");
        await layoutPage.locator(".tg-toolkit-jumps").getByRole("button", { name: "Supervision", exact: true }).click();
        const toolkitJump = await layoutPage.evaluate(() => ({ focused: !!document.activeElement.closest("#tg-supervision"), target: document.activeElement.getBoundingClientRect().top, header: document.querySelector(".site-header").getBoundingClientRect().bottom }));
        assert.strictEqual(toolkitJump.focused, true);
        assert.ok(toolkitJump.target >= toolkitJump.header - 2, `${width}/${colorScheme}: toolkit focus is visible below the sticky header`);
        for (const name of ["roadmap", "topics", "toolkit", "planner", "archive"]) {
          await view(layoutPage, name);
          if (name === "archive") await layoutPage.locator("#thesis-results > .thesis-card").first().waitFor();
          if (name === "toolkit") {
            const contact = layoutPage.locator("#tg-panel-toolkit details").filter({ hasText: "First-contact email scaffold" });
            await contact.locator("summary").click();
          }
          assert.strictEqual(await layoutPage.locator("h1:visible").count(), 1, `${width}/${colorScheme}/${name}: only the page title is exposed`);
          const overflow = await layoutPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          assert.ok(overflow <= 1, `${width}/${colorScheme}/${name}: no horizontal page overflow (${overflow}px)`);
          const truncated = await layoutPage.locator(`#tg-panel-${name} input:not([type=checkbox]), #tg-panel-${name} select, #tg-panel-${name} textarea`).evaluateAll(nodes => nodes.some(node => {
            if (!node.getClientRects().length) return false;
            const box = node.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1;
          }));
          assert.strictEqual(truncated, false, `${width}/${colorScheme}/${name}: form controls remain inside the viewport`);
          if (process.env.THESIS_SCREENSHOTS) {
            await layoutPage.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
            await layoutPage.screenshot({ path: path.join(screenshots, `${width}-${colorScheme}-${name}.png`), fullPage: true });
            if (name === "roadmap") await layoutPage.screenshot({ path: path.join(screenshots, `${width}-${colorScheme}-hero.png`) });
          }
        }
        await layoutPage.context().close();
      }
    }
    ok("all five views fit phone, tablet and desktop widths in light and dark themes, including long user text and the open supervisor email scaffold");

    assert.deepStrictEqual(errors, [], "no uncaught browser exceptions");
    console.log(`\n${checks} thesis guide browser checks passed.`);
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
