// Public Visitor Guide data and boundaries. Run: node tests/visitor-guide/data.test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ROOT = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const guide = JSON.parse(read("content/visitor-guide.json"));
const CHAPTERS = ["welcome", "plan", "learn", "tools", "research", "life", "community", "project"];
const ROUTES = ["student", "exploring", "programme"];
const GROUPS = ["Study", "Resources", "Community", "Life", "About"];
const STATUSES = ["available", "preview", "demo", "not-open"];
const navSource = read("site-nav.js");
const sandbox = {};
vm.runInNewContext(navSource.slice(navSource.indexOf("const SITE_MENU"), navSource.indexOf("// An icon")) + "\nthis.menu = SITE_MENU;", sandbox);
const menu = JSON.parse(JSON.stringify(sandbox.menu));
const menuItems = menu.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
const icons = new Set([...read("icons.svg").matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
const text = (value, label) => assert.ok(typeof value === "string" && value.trim().length > 3, label);
const date = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + "T12:00:00Z")) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;

function localLink(href, label) {
  assert.equal(typeof href, "string", label + " is a link");
  assert.match(href, /^[a-z0-9-]+\.html(?:[?#].*)?$/, label + " uses a canonical local page");
  const url = new URL(href, "https://example.invalid/");
  assert.equal(url.origin, "https://example.invalid", label + " stays on the Hub");
  const file = url.pathname.slice(1);
  assert.ok(fs.existsSync(path.join(ROOT, file)), label + " destination exists");
  assert.ok(!/private-data|\.private\.|apps-script|registration|response-sheet/i.test(href), label + " avoids private sources");
  if (url.hash) {
    const id = decodeURIComponent(url.hash.slice(1));
    assert.match(id, /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, label + " has a simple stable anchor");
    if (file === "thesis.html" && id.startsWith("guide-")) {
      const declaration = read("thesis-guide.js").match(/const VIEWS = (\[[^\]]+\]);/);
      assert.ok(declaration, "the existing thesis view declarations are readable");
      assert.ok(JSON.parse(declaration[1]).includes(id.slice(6)), label + " selects an existing thesis view");
      return;
    }
    let source = read(file);
    const script = file.replace(/\.html$/, ".js");
    if (fs.existsSync(path.join(ROOT, script))) source += read(script);
    if (file === "index.html") source += navSource;
    // Existing pages generate some section IDs from their shared helpers.
    for (const shared of ["guide-data.js", "toolkit-data.js", "statistics-lab-page.js"]) {
      if (source.includes(shared) && fs.existsSync(path.join(ROOT, shared))) source += read(shared);
    }
    assert.ok(source.includes('id="' + id + '"') || source.includes("id='" + id + "'") ||
      source.includes('"' + id + '"') || source.includes("'" + id + "'"), label + " anchor is declared by the destination");
  }
}

function links(items, label) {
  assert.ok(Array.isArray(items) && items.length > 0, label + " provides next steps");
  for (const item of items) {
    text(item.label, label + " link label");
    localLink(item.href, label + ": " + item.label);
  }
}

test("eight editorial chapters have stable HTML anchors and complete public guidance", () => {
  assert.equal(guide.version, 1);
  assert.ok(date(guide.reviewed), "review date is a real calendar date");
  assert.deepEqual(guide.chapters.map((item) => item.id), CHAPTERS);
  const html = read("visitor-guide.html");
  assert.match(html, /class="[^"]*\bvisitor-page\b/);
  for (const chapter of guide.chapters) {
    assert.ok(html.includes('id="' + chapter.id + '"'), chapter.id + " remains a native deep link without scripts");
    for (const field of ["title", "eyebrow", "summary", "note"]) text(chapter[field], chapter.id + " " + field);
    assert.ok(Array.isArray(chapter.highlights) && chapter.highlights.length === 3, chapter.id + " has three useful highlights");
    for (const highlight of chapter.highlights) text(highlight, chapter.id + " highlight");
    links(chapter.actions, chapter.id);
  }
  assert.equal(new Set(guide.chapters.map((item) => item.title)).size, CHAPTERS.length, "chapters have distinct titles");
});

test("three audience routes provide useful existing destinations without duplicating programme facts", () => {
  assert.deepEqual(guide.routes.map((item) => item.id), ROUTES);
  for (const route of guide.routes) {
    text(route.label, route.id + " label");
    text(route.intro, route.id + " introduction");
    links(route.links, route.id);
  }
  assert.equal(new Set(guide.routes.map((route) => route.links.map((link) => link.href).join("|"))).size, ROUTES.length,
    "the three audiences receive different suggested routes");
  for (const field of ["courses", "tracks", "universities", "semesters", "credits", "students", "profiles"]) {
    assert.ok(!Object.hasOwn(guide, field), "the guide does not copy the shared " + field + " data");
  }
});

test("extra destinations extend the current menu with shared icons and explicit maturity", () => {
  assert.ok(Array.isArray(guide.extras) && guide.extras.length > 0, "the guide also exposes useful deeper pages");
  const ids = new Set(menuItems.map((item) => item.key));
  for (const extra of guide.extras) {
    assert.match(extra.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!ids.has(extra.id), extra.id + " is not duplicated in the directory"); ids.add(extra.id);
    text(extra.title, extra.id + " title"); text(extra.description, extra.id + " description");
    assert.ok(GROUPS.includes(extra.group), extra.id + " has a current menu group");
    assert.ok(STATUSES.includes(extra.status), extra.id + " has a clear availability label");
    assert.ok(icons.has(extra.icon), extra.id + " reuses the local icon sprite");
    localLink(extra.href, extra.id);
  }
  const guideMenu = menuItems.find((item) => item.key === "visitor-guide");
  assert.ok(guideMenu && guideMenu.group === "About" && guideMenu.href === "visitor-guide.html", "the guide is discoverable in About");
  assert.ok(menuItems.find((item) => item.key === "students"), "the fictional directory remains a separate menu destination");
  assert.ok(menuItems.find((item) => item.key === "join"), "the closed registration destination remains identifiable");
  const content = JSON.stringify(guide);
  assert.doesNotMatch(content, /private-data\/|\.private\.(?:csv|json)|docs\.google\.com\/spreadsheets|script\.google\.com|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    "public editorial data contains no private file, response sheet, endpoint or personal email");
  assert.doesNotMatch(content, /approved privacy|privacy (?:is |has been )?approved|legally approved/i, "the guide makes no privacy approval claim");
});

test("the page remains public, read-only and available through the existing PWA", () => {
  const script = read("visitor-guide.js");
  assert.doesNotMatch(script, /(?:localStorage|sessionStorage)\s*\.|\b(?:sendBeacon|XMLHttpRequest)\b|method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i,
    "guide controls stay in memory and do not submit");
  const html = read("visitor-guide.html");
  assert.doesNotMatch(html, /<form\b|<iframe\b/i, "the visitor page adds no submission or embedded account surface");
  const sw = read("sw.js");
  for (const file of ["visitor-guide.html", "visitor-guide.css", "visitor-guide.js"]) {
    assert.ok(sw.includes('"' + file + '"') || sw.includes("'" + file + "'"), file + " is included in the existing app cache");
  }
});
