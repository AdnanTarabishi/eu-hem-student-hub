// Public Student Life guidance integrity. Run: node tests/life/data.test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ROOT = path.resolve(__dirname, "../..");
const guide = JSON.parse(fs.readFileSync(path.join(ROOT, "content/life-guide.json"), "utf8"));
const TOPICS = ["housing", "wellbeing", "benefits", "language", "inclusion", "work"];
const STAGES = ["prepare", "departure", "arrival", "settling", "returning", "leaving"];
const CITIES = ["bologna", "oslo", "innsbruck", "rotterdam"];
const PLANNERS = ["four-city-budget", "moving-checklist", "document-deadlines", "career-tracker"];
const { GUIDE_SECTIONS, guideHeadingId } = require(path.join(ROOT, "guide-data.js"));
const sections = GUIDE_SECTIONS.map(guideHeadingId);
const sources = new Map(guide.sources.map((source) => [source.id, source]));
const slugs = new Set(sections);
const date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
const text = (value, label) => assert.ok(typeof value === "string" && value.trim().length > 3, label);

function checkLocalLink(href, label) {
  const url = new URL(href, "https://example.invalid/");
  if (url.origin !== "https://example.invalid") {
    assert.equal(url.protocol, "https:", label + " must use HTTPS");
    return;
  }
  const localPath = decodeURIComponent(url.pathname).replace(/^\//, "");
  assert.ok(localPath && !localPath.includes(".."), label + " is a safe local path");
  assert.ok(fs.existsSync(path.join(ROOT, localPath)), label + " file exists");
  if (localPath === "city-guide.html") {
    if (url.searchParams.has("city")) assert.ok(CITIES.includes(url.searchParams.get("city")), label + " has a known city");
    if (url.hash) assert.ok(slugs.has(url.hash.slice(1)), label + " uses an existing guide section");
  } else if (localPath === "toolkit.html" && url.searchParams.has("planner")) {
    assert.equal(url.searchParams.get("section"), "workbench");
    assert.ok(PLANNERS.includes(url.searchParams.get("planner")), label + " reuses an existing planner");
  } else if (url.hash && localPath.endsWith(".html")) {
    const id = decodeURIComponent(url.hash.slice(1));
    if (localPath === "student-life.html") assert.ok(TOPICS.includes(id) || fs.readFileSync(path.join(ROOT, localPath), "utf8").includes(`id="${id}"`), label + " topic anchor exists");
    else if (localPath === "mobility-guide.html") assert.ok(STAGES.includes(id) || fs.readFileSync(path.join(ROOT, localPath), "utf8").includes(`id="${id}"`), label + " stage anchor exists");
    else {
      const html = fs.readFileSync(path.join(ROOT, localPath), "utf8");
      const scriptPath = path.join(ROOT, localPath.replace(/\.html$/, ".js"));
      const script = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, "utf8") : "";
      assert.ok(html.includes(`id="${id}"`) || html.includes(`id='${id}'`) || script.includes(`"${id}"`), label + " anchor exists");
    }
  }
}

test("six Life topics and six moving stages have distinct, complete editorial content", () => {
  assert.equal(guide.version, 1);
  assert.ok(date(guide.reviewed), "reviewed is a valid calendar date");
  assert.deepEqual(guide.topics.map((item) => item.id), TOPICS);
  assert.deepEqual(guide.stages.map((item) => item.id), STAGES);
  const studentPage = fs.readFileSync(path.join(ROOT, "student-life.html"), "utf8");
  const mobilityPage = fs.readFileSync(path.join(ROOT, "mobility-guide.html"), "utf8");
  const iconIds = new Set([...fs.readFileSync(path.join(ROOT, "icons.svg"), "utf8").matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  for (const item of [...guide.topics, ...guide.stages]) {
    assert.ok((TOPICS.includes(item.id) ? studentPage : mobilityPage).includes(`id="${item.id}"`), item.id + " has a static deep-link anchor");
    text(item.title, item.id + " title"); text(item.summary, item.id + " summary");
    const entries = TOPICS.includes(item.id) ? item.advice : item.tasks;
    assert.ok(Array.isArray(entries) && entries.length >= 2, item.id + " has practical guidance");
    for (const entry of entries) text(entry, item.id + " practical guidance");
    if (TOPICS.includes(item.id)) {
      assert.ok(iconIds.has(item.icon), item.id + " reuses a shared icon");
      assert.ok(Array.isArray(item.questions) && item.questions.length > 0, item.id + " has preparation questions");
      for (const question of item.questions) text(question, item.id + " question");
    } else text(item.kicker, item.id + " timeline label");
  }
});

test("official source records distinguish reviewed guidance from unverified destinations", () => {
  assert.ok(guide.sources.length >= 4, "official entry points cover all host cities");
  assert.equal(sources.size, guide.sources.length, "source IDs are unique");
  for (const source of guide.sources) {
    assert.match(source.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    text(source.title, source.id + " title"); text(source.note, source.id + " scope note");
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:"); assert.equal(url.username, ""); assert.equal(url.password, "");
    assert.ok(["all", ...CITIES].includes(source.city), source.id + " city context");
    assert.ok(["verified", "not-verified"].includes(source.status), source.id + " verification status");
    if (source.status === "verified") assert.ok(date(source.checked), source.id + " verified record has a checked date");
    else assert.ok(source.checked === null || date(source.checked), source.id + " optional attempt date");
    assert.ok(Array.isArray(source.topics) && source.topics.length > 0, source.id + " topic scope");
    for (const topic of source.topics) assert.ok(TOPICS.includes(topic), source.id + " references an existing topic");
  }
  for (const city of CITIES) assert.ok(guide.sources.some((source) => source.city === city), city + " has local official entry points");
});

test("topic/stage references reuse existing city sections, tools and valid local destinations", () => {
  const usedPlanners = new Set();
  for (const item of [...guide.topics, ...guide.stages]) {
    assert.ok(Array.isArray(item.sourceIds) && item.sourceIds.length > 0, item.id + " cites sources");
    assert.equal(new Set(item.sourceIds).size, item.sourceIds.length, item.id + " has no duplicate source references");
    for (const id of item.sourceIds) {
      assert.ok(sources.has(id), item.id + ": source " + id + " exists");
      if (TOPICS.includes(item.id)) assert.ok(sources.get(id).topics.includes(item.id), item.id + ": source " + id + " covers the topic");
    }
    assert.ok(Array.isArray(item.guideSections) && item.guideSections.length > 0, item.id + " links to contextual city details");
    for (const slug of item.guideSections) assert.ok(slugs.has(slug), item.id + ": guide section " + slug + " exists");
    assert.ok(Array.isArray(item.related) && item.related.length > 0, item.id + " connects existing Hub resources");
    for (const link of item.related) {
      text(link.label, item.id + " related link label");
      checkLocalLink(link.href, item.id + ": " + link.label);
      const url = new URL(link.href, "https://example.invalid/");
      if (url.pathname === "/toolkit.html" && url.searchParams.has("planner")) usedPlanners.add(url.searchParams.get("planner"));
    }
  }
  for (const planner of PLANNERS) assert.ok(usedPlanners.has(planner), "existing " + planner + " is connected");
});

test("Life editorial data remains public guidance without duplicating track routes or collecting private entries", () => {
  const forbiddenKeys = new Set(["tracks", "routes", "semesters", "students", "profiles", "email", "phone", "passport", "citizenship", "visaStatus", "healthRecords", "account", "answers"]);
  const inspect = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      assert.ok(!forbiddenKeys.has(key), "no duplicate route/private collection field: " + key);
      inspect(item);
    }
  };
  inspect(guide);
  const script = fs.readFileSync(path.join(ROOT, "life.js"), "utf8");
  assert.doesNotMatch(script, /(?:localStorage|sessionStorage)\s*\.|\b(?:sendBeacon|XMLHttpRequest)\b|method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i,
    "Life controls must stay in memory and must not submit personal data");
});
