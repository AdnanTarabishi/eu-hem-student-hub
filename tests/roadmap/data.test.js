// Roadmap & Updates: content, publication rules and the shared rules in roadmap-data.js (no browser).
// Run: node tests/roadmap/data.test.js .
const fs = require("fs"), path = require("path"), assert = require("assert"), os = require("os");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(process.argv[2] || ".");
const R = require(path.join(ROOT, "roadmap-data.js"));
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const roadmap = read("content/roadmap.json");
const updates = read("content/updates.json");
const clone = (x) => JSON.parse(JSON.stringify(x));
// The real file may have no draft at a given moment, so draft rules are tested with this extra one
const withDraft = clone(updates);
withDraft.items.unshift({ id: "test-draft", date: null, title: "Secret upcoming feature", summary: "Not released yet.", category: "platform",
    type: "new", status: "draft", highlights: [], links: [], evidence: null });
const today = R.dateInRome(new Date().toISOString());
const pageExists = (file) => fs.existsSync(path.join(ROOT, file));
let n = 0; const t = (name, fn) => { fn(); n++; console.log("  ok  " + name); };
const problems = (r, u) => R.validate(r, u, { today: "2026-10-06", pageExists });
const fails = (r, u, pattern) => assert.ok(problems(r, u).some((p) => pattern.test(p)), `expected a problem matching ${pattern}, got:\n${problems(r, u).join("\n")}`);

/* ----- the real content ----- */
t("both files are valid (today's date, real pages)", () => {
  assert.deepStrictEqual(R.validate(roadmap, updates, { today, pageExists }), []);
});
t("Now: exactly one current focus, Student beta preparation, in progress", () => {
  const now = roadmap.items.filter((i) => i.lane === "now");
  assert.deepStrictEqual(now.map((i) => [i.id, i.status]), [["student-beta-preparation", "in-progress"]]);
});
t("Next: the requested plans, grouped Oct → Oct–Nov → Nov–Dec, from target dates in the data", () => {
  const groups = R.groupNext(R.readRoadmap(roadmap).items);
  assert.deepStrictEqual(groups.map((g) => g.label), ["October 2026", "October–November 2026", "November–December 2026"]);
  const ids = (label) => groups.find((g) => g.label === label).items.map((i) => i.id);
  assert.deepStrictEqual(ids("October 2026"), ["beta-feedback-improvements", "student-accounts-cohort-profiles", "domain-admin-dashboard"]);
  for (const id of ["student-stories-experiences", "partner-university-guides", "expanded-notes-interactive-lessons", "expanded-practice-bank"]) {
    assert.ok(ids("October–November 2026").includes(id), id);
  }
  assert.deepStrictEqual(ids("November–December 2026"), ["beyond-euhem-opportunities"]);
  const beyond = roadmap.items.find((i) => i.id === "beyond-euhem-opportunities");
  const text = JSON.stringify(beyond).toLowerCase();
  for (const word of ["jobs", "internships", "research", "career preparation", "phd"]) assert.ok(text.includes(word), word);
});
t("Student experiences describe sources, contributions, questions, review, privacy and later filtering", () => {
  const text = JSON.stringify(roadmap.items.find((i) => i.id === "student-stories-experiences")).toLowerCase();
  for (const word of ["partner universities", "second-year", "alumni", "submit", "housing", "costs", "career impact",
    "what they would do differently", "review", "name, photo and contact", "filter"]) assert.ok(text.includes(word), word);
});
t("Later: ideas without dates, including trips and the Student Digital Toolkit", () => {
  const later = roadmap.items.filter((i) => i.lane === "later");
  assert.ok(later.length >= 10 && later.length <= 12, "a focused list, not a huge wishlist");
  for (const i of later) { assert.strictEqual(i.target, null, i.id); assert.strictEqual(i.status, "exploring", i.id); }
  for (const id of ["group-trips-adventures", "student-digital-toolkit", "mobility-checklists", "budget-shared-expenses",
    "cross-device-revision-workspace", "group-project-workspace", "research-reading-workbench", "career-application-tracker",
    "methods-health-economics-labs", "alumni-mentoring-skills-exchange"]) assert.ok(later.some((i) => i.id === id), id);
});
t("accounts are planned, never presented as available", () => {
  const accounts = roadmap.items.find((i) => i.id === "student-accounts-cohort-profiles");
  assert.strictEqual(accounts.status, "planned");
  assert.ok(!updates.items.some((u) => u.status === "published" && /account|sign-in|login/i.test(u.title + u.summary)));
});
t("updates: 15 published with evidence, newest first; same day ordered by deployment time; drafts stay hidden", () => {
  const published = R.publishedUpdates(updates);
  assert.strictEqual(published.length, 15);
  assert.deepStrictEqual(published.slice(0, 4).map((u) => u.id), ["homepage-and-menu", "academic-rules-journey-support", "roadmap-and-updates", "new-design"]);
  assert.deepStrictEqual(R.validate(roadmap, withDraft, { today, pageExists }), [], "a correct draft is valid");
  assert.ok(!R.publishedUpdates(withDraft).some((u) => u.id === "test-draft"), "draft hidden");
  for (const u of published) assert.strictEqual(R.dateInRome(u.evidence.deployedAt), u.date, u.id);
});
t("the historical releases keep their verified dates", () => {
  const dates = Object.fromEntries(updates.items.filter((u) => u.status === "published").map((u) => [u.id, u.date]));
  assert.deepStrictEqual(dates, {
    "homepage-and-menu": "2026-10-06", "academic-rules-journey-support": "2026-10-06", "roadmap-and-updates": "2026-10-06", "students-explorer": "2026-10-06", "new-design": "2026-10-06", "city-guides": "2026-10-05", "thesis-discovery": "2026-10-05",
    "thesis-explorer": "2026-10-04", tracks: "2026-10-04", "home-dashboard": "2026-10-03", "search-offline": "2026-10-03",
    "notes-practice": "2026-10-03", "personal-study-plan": "2026-10-03", "student-life-community": "2026-10-01", "first-academic-hub": "2026-10-01",
  });
});
t("every evidence commit exists in this repository's history", () => {
  for (const u of updates.items.filter((x) => x.status === "published")) {
    for (const c of u.evidence.commits) execFileSync("git", ["cat-file", "-e", `${c.sha}^{commit}`], { cwd: ROOT });
  }
});

t("overall progress: 10% of the full vision, planned finish 3 March 2027", () => {
  const vision = R.readRoadmap(roadmap).vision;
  assert.deepStrictEqual([vision.progressPercent, vision.targetDate], [10, "2027-03-03"]);
  assert.strictEqual(R.daysUntil("2026-10-06", "2027-03-03"), 148);
  const bad = clone(roadmap); bad.vision.progressPercent = 150; fails(bad, updates, /whole number from 0 to 100/);
  const bad2 = clone(roadmap); bad2.vision.targetDate = "2027-02-30"; fails(bad2, updates, /real YYYY-MM-DD date/);
});

/* ----- the rules ----- */
t("drafts must not carry a date or evidence; published needs both", () => {
  const u = clone(withDraft);
  u.items[0].date = "2026-10-06";
  fails(roadmap, u, /draft has date: null/);
  const v = clone(updates);
  const pub = v.items.find((i) => i.status === "published");
  pub.evidence = null;
  fails(roadmap, v, /evidence\.deploymentUrl/);
});
t("a published date must match the deployment day in Rome, and cannot be in the future", () => {
  const u = clone(updates);
  u.items.find((i) => i.id === "new-design").date = "2026-10-05";
  fails(roadmap, u, /deployment day in Rome/);
  const v = clone(updates);
  const item = v.items.find((i) => i.id === "new-design");
  item.date = "2026-12-01";
  item.evidence.deployedAt = "2026-12-01T10:00:00+01:00";
  fails(roadmap, v, /future/);
});
t("evidence must point to this repository (runs and commits)", () => {
  const u = clone(updates);
  u.items.find((i) => i.id === "tracks").evidence.deploymentUrl = "https://github.com/someone/else/actions/runs/1";
  fails(roadmap, u, /GitHub Actions run of this repository/);
  const v = clone(updates);
  v.items.find((i) => i.id === "tracks").evidence.commits[0].url = "https://example.com/commit";
  fails(roadmap, v, /link to that commit/);
});
t("ids are unique slugs; statuses fit their stage; Later has no dates; Next needs a valid period", () => {
  const dup = clone(roadmap); dup.items[2].id = dup.items[1].id; fails(dup, updates, /duplicate id/);
  const slug = clone(roadmap); slug.items[1].id = "Not A Slug"; fails(slug, updates, /lowercase words/);
  const status = clone(roadmap); status.items.find((i) => i.lane === "later").status = "planned"; fails(status, updates, /not allowed in later/);
  const dated = clone(roadmap); dated.items.find((i) => i.lane === "later").target = { start: "2027-01", end: "2027-01", label: "Jan" }; fails(dated, updates, /no target/);
  const order = clone(roadmap); order.items[1].target.start = "2026-12"; fails(order, updates, /start ≤ end/);
  const twoNow = clone(roadmap); twoNow.items[1].lane = "now"; twoNow.items[1].status = "in-progress"; fails(twoNow, updates, /exactly one item must be in Now/);
});
t("links: only pages of this site or https; missing pages are reported", () => {
  for (const bad of ["javascript:alert(1)", "//evil.example", "../secret.html", "http://insecure.example", "data:text/html,x"]) {
    assert.strictEqual(R.safeUrl(bad), null, bad);
    const r = clone(roadmap); r.items[0].links = [{ label: "x", url: bad }]; fails(r, updates, /must be a page of this site/);
  }
  assert.strictEqual(R.safeUrl("tracks.html#track-eeh"), "tracks.html#track-eeh");
  const r = clone(roadmap); r.items[0].links = [{ label: "x", url: "not-a-page.html" }]; fails(r, updates, /does not exist/);
});
t("no HTML in text fields", () => {
  const r = clone(roadmap); r.items[0].title = "<b>Bold</b>"; fails(r, updates, /title is required/);
});
t("search entries: plans lead with their status and say 'not available yet'; releases say Released; drafts never appear", () => {
  const entries = R.searchEntries(roadmap, withDraft);
  const plans = entries.filter((e) => e.type === "roadmap");
  assert.strictEqual(plans.length, roadmap.items.length);
  for (const e of plans) assert.match(e.meta, /^(In progress|Planned|Exploring) · .* · not available yet$/);
  const released = entries.filter((e) => e.type === "update");
  assert.strictEqual(released.length, 15);
  for (const e of released) assert.match(e.meta, /^Released · \d+ \w+ 2026 · /);
  assert.ok(!entries.some((e) => /test-draft/.test(e.url)));
  assert.ok(entries.every((e) => /^roadmap\.html#(feature|update)-[a-z0-9-]+$/.test(e.url)));
});
t("search matching is case- and accent-insensitive and needs every word", () => {
  const item = roadmap.items.find((i) => i.id === "student-stories-experiences");
  assert.ok(R.matchesQuery(item, "STUDENT expériences"));
  assert.ok(!R.matchesQuery(item, "student zebra"));
});

/* ----- the helper script (on a copy; publishing needs GitHub and is not run here) ----- */
t("scripts/updates.js adds a hidden draft and refuses bad input", () => {
  const copy = path.join(os.tmpdir(), `updates-test-${process.pid}.json`);
  fs.copyFileSync(path.join(ROOT, "content/updates.json"), copy);
  const run = (...args) => execFileSync(process.execPath, [path.join(ROOT, "scripts/updates.js"), ...args],
    { cwd: ROOT, env: { ...process.env, UPDATES_FILE: copy }, stdio: "pipe" }).toString();
  try {
    run("new", "test-feature", "--title", "Test feature", "--summary", "A test.", "--type", "new", "--category", "learning",
      "--link", "Notes|notes.html");
    const data = JSON.parse(fs.readFileSync(copy, "utf8"));
    const draft = data.items.find((i) => i.id === "test-feature");
    assert.deepStrictEqual([draft.status, draft.date, draft.evidence], ["draft", null, null]);
    assert.ok(!R.publishedUpdates(data).some((i) => i.id === "test-feature"));
    assert.throws(() => run("new", "test-feature", "--title", "x", "--summary", "x", "--type", "new", "--category", "learning"));
    assert.throws(() => run("new", "Bad Id", "--title", "x", "--summary", "x", "--type", "new", "--category", "learning"));
    assert.throws(() => run("new", "other", "--title", "x", "--summary", "x", "--type", "new", "--category", "learning", "--link", "x|javascript:alert(1)"));
  } finally {
    fs.unlinkSync(copy);
  }
});

console.log(n + " roadmap data checks passed");
