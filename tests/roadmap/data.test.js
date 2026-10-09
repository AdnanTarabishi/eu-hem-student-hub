// Roadmap & Updates: content, publication rules and the shared rules in roadmap-data.js (no browser).
// Run: node tests/roadmap/data.test.js .
const fs = require("fs"), path = require("path"), assert = require("assert"), os = require("os");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(process.argv[2] || ".");
const R = require(path.join(ROOT, "roadmap-data.js"));
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const roadmap = read("content/roadmap.json");
const updates = read("content/updates.json");
const RECENT_IDS = ["timetable-monthly-progress", "universities-directory-galleries", "timetable-month-day-teachers", "future-sections-browsable-previews", "course-study-workspaces", "notes-resource-first-workspace", "behind-the-build-effort", "contact-private-form-delivery", "practice-quiz-flashcard-redesign", "support-contact-privacy-redesign", "academic-guides-visual-redesign", "toolkit-seven-local-workbenches", "right-to-health-guides-casebook", "pulse-to-growth-brand", "city-guides-topic-redesign", "homepage-day-exam-news-browsing", "roadmap-v2-release-windows"];
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
t("Now: Exam Prep and Student beta preparation, both in progress", () => {
  const now = roadmap.items.filter((i) => i.lane === "now");
  assert.deepStrictEqual(now.map((i) => [i.id, i.status]), [["exam-prep", "in-progress"], ["beta-feedback-improvements", "in-progress"]]);
  const exam = now[0];
  assert.strictEqual(exam.category, "learning");
  assert.strictEqual(exam.target.label, "October 2026");
});
t("Next: four dated plans (Oct → Nov → Nov–Dec), the rest After launch", () => {
  const groups = R.groupNext(R.readRoadmap(roadmap).items);
  assert.deepStrictEqual(groups.map((g) => g.label), ["October 2026", "November 2026", "November–December 2026", "After launch"]);
  const ids = (label) => groups.find((g) => g.label === label).items.map((i) => i.id);
  assert.deepStrictEqual(ids("October 2026"), ["domain-admin-dashboard"]);
  assert.deepStrictEqual(ids("November 2026"), ["student-hub-v2", "mobility-checklists"]);
  assert.deepStrictEqual(ids("November–December 2026"), ["student-accounts-cohort-profiles"]);
  assert.deepStrictEqual(ids("After launch").sort(), ["beyond-euhem-opportunities", "community-events", "expanded-notes-interactive-lessons", "expanded-practice-bank", "student-gallery"]);
  assert.ok(roadmap.items.filter((i) => i.lane === "next" && i.target).length <= R.MAX_DATED_NEXT);
  const beyond = roadmap.items.find((i) => i.id === "beyond-euhem-opportunities");
  const text = JSON.stringify(beyond).toLowerCase();
  for (const word of ["jobs", "internships", "research", "career preparation", "phd"]) assert.ok(text.includes(word), word);
});
t("future-section previews are linked while full collections remain in progress without a delivery date", () => {
  for (const [id, url] of [["beyond-euhem-opportunities", "beyond-euhem.html"], ["community-events", "events.html"], ["student-gallery", "gallery.html"]]) {
    const item = roadmap.items.find((i) => i.id === id);
    assert.strictEqual(item.status, "in-progress", id);
    assert.strictEqual(item.target, null, id);
    assert.ok(item.links.some((link) => link.url === url && /preview/i.test(link.label)), id);
  }
  const gallery = roadmap.items.find((i) => i.id === "student-gallery");
  assert.match(gallery.note, /no student photos, uploads or active membership service/);
  assert.ok(gallery.details.some((detail) => /private visibility for verified EU-HEM members/.test(detail)));
});
t("shipped features are no longer listed as plans, including the Student Toolkit and interactive labs", () => {
  for (const id of ["student-stories-experiences", "partner-university-guides", "student-digital-toolkit", "methods-health-economics-labs", "career-application-tracker"]) {
    assert.ok(!roadmap.items.some((i) => i.id === id), id);
  }
});
t("Later: seven remaining ideas without dates, including trips and further thesis planning", () => {
  const later = roadmap.items.filter((i) => i.lane === "later");
  assert.strictEqual(later.length, 7);
  for (const i of later) { assert.strictEqual(i.target, null, i.id); assert.strictEqual(i.status, "exploring", i.id); }
  assert.ok(!later.some((i) => i.id === "mobility-checklists"), "mobility checklists moved to Next");
  for (const id of ["group-trips-adventures", "budget-shared-expenses",
    "cross-device-revision-workspace", "group-project-workspace", "research-reading-workbench",
    "thesis-planning-companion", "alumni-mentoring-skills-exchange"]) assert.ok(later.some((i) => i.id === id), id);
  assert.strictEqual(later.find((i) => i.id === "thesis-planning-companion").title, "Thesis timeline & supervisor meeting planner");
});
t("accounts are planned, never presented as available", () => {
  const accounts = roadmap.items.find((i) => i.id === "student-accounts-cohort-profiles");
  assert.strictEqual(accounts.status, "planned");
  assert.strictEqual(accounts.target.label, "November–December 2026");
  assert.match(accounts.note, /secure sign-in and a privacy review/);
  assert.ok(!updates.items.some((u) => u.status === "published" && /account|sign-in|login/i.test(u.title + u.summary)));
});
t("updates: 54 published with evidence, seventeen recent additions in deployment order; drafts stay hidden", () => {
  const published = R.publishedUpdates(updates);
  assert.strictEqual(published.length, 54);
  assert.deepStrictEqual(published.filter((u) => !RECENT_IDS.includes(u.id)).slice(0, 7).map((u) => [u.id, u.date]), [
    ["homepage-visual-refresh", "2026-10-08"],
    ["announcements-newsroom", "2026-10-08"], ["cohort-origins-distribution", "2026-10-08"], ["toolkit-solve-a-problem", "2026-10-08"],
    ["toolkit-collections-and-lists", "2026-10-07"], ["student-toolkit", "2026-10-07"], ["statistics-lab-course-expansion", "2026-10-07"],
  ]);
  assert.deepStrictEqual(published.filter((u) => !RECENT_IDS.includes(u.id)).slice(7, 11).map((u) => u.id), ["statistics-lab", "students-community-atlas", "thesis-research-guide", "timetable-exam-planners"]);
  assert.deepStrictEqual(R.validate(roadmap, withDraft, { today, pageExists }), [], "a correct draft is valid");
  assert.ok(!R.publishedUpdates(withDraft).some((u) => u.id === "test-draft"), "draft hidden");
  for (const u of published) assert.strictEqual(R.dateInRome(u.evidence.deployedAt), u.date, u.id);
});
t("the historical releases keep their verified dates", () => {
  const dates = Object.fromEntries(updates.items.filter((u) => u.status === "published").map((u) => [u.id, u.date]));
  const historicalDates = {
    "statistics-lab": "2026-10-07", "students-community-atlas": "2026-10-07", "thesis-research-guide": "2026-10-07",
    "four-semester-study-plan": "2026-10-07", "timetable-exam-planners": "2026-10-07", "fundamentals-labs-overview": "2026-10-07",
    "fundamentals-of-statistics": "2026-10-07", "easier-on-every-screen": "2026-10-07", "notes-study-library": "2026-10-07",
    "getting-started-guide": "2026-10-06", "fhem-exam-centre": "2026-10-06", "university-photo-galleries": "2026-10-06",
    "interactive-study-sessions": "2026-10-06", "universities-hub": "2026-10-06", "student-experiences-section": "2026-10-06",
    "homepage-and-menu": "2026-10-06", "academic-rules-journey-support": "2026-10-06", "roadmap-and-updates": "2026-10-06", "students-explorer": "2026-10-06", "new-design": "2026-10-06", "city-guides": "2026-10-05", "thesis-discovery": "2026-10-05",
    "thesis-explorer": "2026-10-04", tracks: "2026-10-04", "home-dashboard": "2026-10-03", "search-offline": "2026-10-03",
    "notes-practice": "2026-10-03", "personal-study-plan": "2026-10-03", "student-life-community": "2026-10-01", "first-academic-hub": "2026-10-01",
  };
  for (const [id, date] of Object.entries(historicalDates)) assert.strictEqual(dates[id], date, `${id}: preserve its verified release date`);
});
t("every evidence commit exists in this repository's history", () => {
  for (const u of updates.items.filter((x) => x.status === "published")) {
    for (const c of u.evidence.commits) execFileSync("git", ["cat-file", "-e", `${c.sha}^{commit}`], { cwd: ROOT });
  }
});

t("progress: the explicit 25% team estimate stays separate from verified releases; the full Hub remains planned for Spring 2027", () => {
  const vision = R.readRoadmap(roadmap).vision;
  assert.strictEqual(vision.targetLabel, "Spring 2027");
  assert.strictEqual(vision.progressPercent, 25);
  assert.match(vision.note, /25%.*estimate/);
  assert.deepStrictEqual(R.releaseCount(updates), { count: 54, since: "2026-10-01", text: "54 releases shipped since 1 Oct 2026" });
  assert.strictEqual(R.releaseCount(withDraft).count, 54, "drafts are not counted");
  const estimate = clone(roadmap); estimate.vision.progressPercent = 15;
  assert.strictEqual(R.readRoadmap(estimate).vision.progressPercent, 15, "explicit optional estimates remain supported");
  const unspecified = clone(roadmap); delete unspecified.vision.progressPercent;
  assert.strictEqual(R.readRoadmap(unspecified).vision.progressPercent, null, "content without an explicit estimate remains supported");
  const bad = clone(roadmap); bad.vision.progressPercent = 150; fails(bad, updates, /whole number from 0 to 100/);
  const bad2 = clone(roadmap); delete bad2.vision.targetLabel; fails(bad2, updates, /targetLabel/);
});
t("release: Beta v0.9, next v1.0 Public Launch on 15 Oct 2026 (a target), with what it contains", () => {
  const release = R.readRoadmap(roadmap).release;
  assert.deepStrictEqual([release.stage, release.version, release.next.version, release.next.name, release.next.targetDate],
    ["Beta", "v0.9", "v1.0", "Public Launch", "2026-10-15"]);
  assert.match(release.note, /targets, not promises/);
  assert.deepStrictEqual(release.next.includes.map((e) => e.label), ["Custom domain", "Admin dashboard", "Exam Prep",
    "Academic Rules", "Programme Journey", "Support & Contacts"]);
  assert.deepStrictEqual([release.following.version, release.following.name, release.following.target],
    ["v2.0", "Study, Connect & Prepare", { start: "2026-11", end: "2026-11", label: "Early November 2026" }]);
  assert.deepStrictEqual(release.following.includes.map((e) => [e.label, e.item]), [
    ["Personal study dashboard", "student-hub-v2"], ["Expanded learning resources", "student-hub-v2"],
    ["Reviewed student contributions", "student-hub-v2"], ["Mobility preparation", "mobility-checklists"],
  ]);
  assert.strictEqual(roadmap.items.find((i) => i.id === "student-hub-v2").status, "planned");
  assert.ok(!R.updateVersions(updates).includes("v2.0"), "a future release is not offered as a shipped version");
  const bad = clone(roadmap); bad.release.version = "0.9"; fails(bad, updates, /version like "v0\.9"/);
  const bad2 = clone(roadmap); bad2.release.next.includes.push({ label: "Ghost", item: "no-such-plan" }); fails(bad2, updates, /roadmap item \(item\) or a published update/);
  const bad3 = clone(roadmap); bad3.release.next.includes.push({ label: "Draft", update: "test-draft" }); fails(bad3, withDraft, /published update/);
});
t("versions: every release has one, by release day; the newest first for the filter", () => {
  const byDay = {};
  for (const u of R.publishedUpdates(updates)) (byDay[u.date] = byDay[u.date] || new Set()).add(u.version);
  assert.deepStrictEqual(Object.fromEntries(Object.entries(byDay).map(([d, v]) => [d, [...v]])),
    { "2026-10-09": ["v0.9"], "2026-10-08": ["v0.9"], "2026-10-07": ["v0.9"], "2026-10-06": ["v0.9"], "2026-10-05": ["v0.5"], "2026-10-04": ["v0.4"], "2026-10-03": ["v0.3"], "2026-10-01": ["v0.1"] });
  assert.deepStrictEqual(R.updateVersions(updates), ["v0.9", "v0.5", "v0.4", "v0.3", "v0.1"]);
  const u = clone(updates); delete u.items.find((i) => i.status === "published").version; fails(roadmap, u, /needs a version/);
});
t("milestones preserve the completed beta and planned v1 launch, with v2 planned for early November", () => {
  const ms = Object.fromEntries(roadmap.milestones.map((m) => [m.id, [m.date, m.status]]));
  assert.deepStrictEqual(ms["first-cohort-beta"], ["2026-10-07", "completed"]); // the beta went out on 7 October 2026
  assert.deepStrictEqual(ms["public-launch-v1"], ["2026-10-15", "planned"]);
  assert.deepStrictEqual(ms["student-hub-v2"], [undefined, "planned"]);
  assert.deepStrictEqual(roadmap.milestones.find((m) => m.id === "student-hub-v2").target,
    { start: "2026-11", end: "2026-11", label: "Early November 2026" });
});
t("known limitations, the domain move and the feedback link", () => {
  const plan = R.readRoadmap(roadmap);
  assert.match(plan.limitations.items.join(" "), /fictional demo/);
  assert.match(plan.limitations.items.join(" "), /on this device and browser/);
  assert.match(plan.limitations.items.join(" "), /Accounts and cross-device sync are not live/);
  assert.match(plan.limitations.items.join(" "), /Editors cannot yet publish through the dashboard/);
  assert.match(plan.domainMove.items.join(" "), /redirect/i);
  assert.match(plan.domainMove.items.join(" "), /each web address.*backup or export/);
  assert.deepStrictEqual(plan.feedback, { label: "Suggest a feature / Report a problem", url: "contact.html" });
});

/* ----- the rules ----- */
t("a following release is optional and preserves the next release and an honest target period", () => {
  const r = clone(roadmap);
  delete r.release.following;
  assert.deepStrictEqual(R.validate(r, updates, { today, pageExists }), [], "old content without a following release stays valid");
  assert.strictEqual(R.readRoadmap(r).release.following, undefined);
  const next = clone(r.release.next);
  r.release.following = { version: "v2.0", name: "Second release", summary: "A planned follow-up, not a published release.",
    target: { start: "2026-11", end: "2026-11", label: "Early November 2026" },
    includes: [{ label: "Planned scope", item: r.items[0].id }, { label: "Existing release", update: "academic-rules-journey-support" }] };
  assert.deepStrictEqual(R.validate(r, updates, { today, pageExists }), []);
  const release = R.readRoadmap(r).release;
  assert.deepStrictEqual(release.next, next, "the following release does not replace the next release");
  assert.deepStrictEqual(release.following, r.release.following);
  assert.strictEqual(release.following.targetDate, undefined, "a target period does not invent an exact release day");
});
t("a following release needs a valid version, summary, period and published or planned references", () => {
  const r = clone(roadmap);
  r.release.following = { version: "v2.0", name: "Second release", summary: "Planned work.",
    target: { start: "2026-11", end: "2026-11", label: "Early November 2026" },
    includes: [{ label: "Planned scope", item: r.items[0].id }] };
  for (const change of [
    (f) => { f.version = "v2"; },
    (f) => { f.summary = "<b>Unavailable</b>"; },
    (f) => { f.target.start = "2026-12"; },
    (f) => { f.target.end = "2026-13"; },
    (f) => { f.target.label = ""; },
    (f) => { f.includes = {}; },
    (f) => { f.includes = [{ label: "Unknown plan", item: "no-such-plan" }]; },
    (f) => { f.includes = [{ label: "Hidden draft", update: "test-draft" }]; },
  ]) {
    const bad = clone(r); change(bad.release.following);
    fails(bad, withDraft, /roadmap\.release\.following/);
  }
  const bad = clone(r); bad.release.following = null;
  fails(bad, updates, /roadmap\.release\.following/);
  assert.strictEqual(R.readRoadmap(bad).release.following, undefined, "a malformed optional release does not break the current release");
});
t("planned milestones keep date precision and sort period targets without creating a release date", () => {
  const r = clone(roadmap);
  const target = { start: "2026-11", end: "2026-11", label: "Early November 2026" };
  r.milestones = [
    { id: "later-checkpoint", title: "Later checkpoint", summary: "Another planned date.", status: "planned", date: "2026-11-15" },
    { id: "period-release", title: "Second release", summary: "Planned for a period.", status: "planned", target },
    { id: "exact-launch", title: "First launch", summary: "An existing planned day.", status: "planned", date: "2026-10-15" },
    { id: "completed-beta", title: "Beta", summary: "Already completed.", status: "completed", date: "2026-10-07" },
  ];
  assert.deepStrictEqual(R.validate(r, updates, { today, pageExists }), []);
  const milestones = R.readRoadmap(r).milestones;
  assert.deepStrictEqual(milestones.map((m) => m.id), ["completed-beta", "exact-launch", "period-release", "later-checkpoint"]);
  const planned = milestones.find((m) => m.id === "period-release");
  assert.deepStrictEqual(planned.target, target);
  assert.strictEqual(planned.date, undefined, "no day is added to a period-only milestone");
  assert.strictEqual(R.milestoneSortDate(planned), "2026-11-01");
  assert.strictEqual(R.milestoneSortDate(milestones[1]), "2026-10-15");
  for (const [change, pattern] of [
    [(m) => { m.date = "2026-11-05"; }, /use a date or a target period, not both/],
    [(m) => { delete m.target; }, /date must be a real/],
    [(m) => { m.target.start = "2026-12"; }, /target needs start and end months/],
    [(m) => { m.status = "completed"; }, /date must be a real/],
    [(m) => { m.status = "completed"; m.date = "2026-10-07"; }, /only a planned milestone/],
  ]) {
    const bad = clone(r); change(bad.milestones[1]);
    fails(bad, updates, pattern);
    assert.ok(!R.readRoadmap(bad).milestones.some((m) => m.id === "period-release"), "invalid milestone timing is not read as a release");
  }
});
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
  const threeNow = clone(roadmap); threeNow.items[2].lane = "now"; threeNow.items[2].status = "in-progress"; fails(threeNow, updates, /Now must have one or 2 items/);
  const fiveDated = clone(roadmap);
  fiveDated.items.find((i) => i.id === "expanded-practice-bank").target = { start: "2026-11", end: "2026-11", label: "November 2026" };
  fails(fiveDated, updates, /at most 4 Next items may have a date/);
  const nowNoDate = clone(roadmap); nowNoDate.items[0].target = null; fails(nowNoDate, updates, /Now item needs a target/);
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
  assert.strictEqual(released.length, 54);
  for (const e of released) assert.match(e.meta, /^Released · \d+ \w+ 2026 · /);
  assert.ok(!entries.some((e) => /test-draft/.test(e.url)));
  assert.ok(entries.every((e) => /^roadmap\.html#(feature|update)-[a-z0-9-]+$/.test(e.url)));
});
t("search matching is case- and accent-insensitive and needs every word", () => {
  const item = roadmap.items.find((i) => i.id === "mobility-checklists");
  assert.ok(R.matchesQuery(item, "MOBILITY chécklists"));
  assert.ok(!R.matchesQuery(item, "mobility zebra"));
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
