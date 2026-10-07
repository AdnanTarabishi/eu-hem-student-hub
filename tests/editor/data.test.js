// Editor dashboard rules (editor-data.js) and the database file (supabase/schema.sql), without a browser.
// Run: node tests/editor/data.test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const ROOT = path.resolve(__dirname, "..", "..");
const D = require(path.join(ROOT, "editor-data.js"));
const config = require(path.join(ROOT, "supabase-config.js"));
const schema = fs.readFileSync(path.join(ROOT, "supabase", "schema.sql"), "utf8");

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("  ok  " + name); };

const good = { date: "2026-10-07", title: "Exam room changed", category: "Academic", message: "Room 3 instead of Room 1.",
  link: "", pinned: false, expires: "", posted_by: "Student Hub team" };
const goodEvent = { title: "Cohort aperitivo", category: "Social", location: "", starts_on: "2026-11-02", start_time: "18:00",
  ends_on: "", end_time: "", description: "Meet the cohort.", link: "", posted_by: "Reps" };

t("categories in editor-data.js and the database checks are the same lists", () => {
  const lists = [...schema.matchAll(/category in\s*\(([^)]*)\)/g)].map((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  assert.deepStrictEqual(lists, [D.ANNOUNCEMENT_CATEGORIES, D.EVENT_CATEGORIES]);
  assert.deepStrictEqual(D.CONTENT_TYPES.announcements.fields.find((f) => f.name === "category").options, D.ANNOUNCEMENT_CATEGORIES);
  assert.deepStrictEqual(D.CONTENT_TYPES.events.fields.find((f) => f.name === "category").options, D.EVENT_CATEGORIES);
});

t("every form field is a column of its table in the database", () => {
  for (const type of Object.values(D.CONTENT_TYPES)) {
    const table = schema.match(new RegExp(`create table if not exists public\\.${type.table} \\(([\\s\\S]*?)\\n\\);`))[1];
    for (const field of type.fields) assert.match(table, new RegExp(`^\\s+${field.name}\\s`, "m"), `${type.table}.${field.name}`);
  }
});

t("announcements: a correct one passes and is cleaned (spaces trimmed, empty optional fields become null)", () => {
  const { value, errors } = D.validateAnnouncement({ ...good, title: "  Exam room changed  " });
  assert.deepStrictEqual(errors, {});
  assert.strictEqual(value.title, "Exam room changed");
  assert.strictEqual(value.link, null);
  assert.strictEqual(value.expires, null);
});

t("announcements: wrong values are refused with a message per field", () => {
  const { errors } = D.validateAnnouncement({ date: "2026-02-31", title: "Hi", category: "Gossip", message: " ",
    link: "javascript:alert(1)", expires: "2026-01-01", posted_by: "" });
  assert.deepStrictEqual(Object.keys(errors).sort(), ["category", "date", "link", "message", "posted_by", "title"]);
  assert.match(D.validateAnnouncement({ ...good, expires: "2026-10-01" }).errors.expires, /cannot be before/);
});

t("events: correct values pass; times from the database (18:00:00) are accepted", () => {
  assert.deepStrictEqual(D.validateItem("events", goodEvent).errors, {});
  const { value } = D.validateItem("events", { ...goodEvent, start_time: "18:00:00" });
  assert.strictEqual(value.start_time, "18:00");
  assert.strictEqual(value.ends_on, null);
});

t("events: impossible dates and times are refused", () => {
  assert.match(D.validateItem("events", { ...goodEvent, ends_on: "2026-11-01" }).errors.ends_on, /cannot end before/);
  assert.match(D.validateItem("events", { ...goodEvent, end_time: "17:00" }).errors.end_time, /before the start time/);
  // over several days, an earlier end time on a later day is fine
  assert.deepStrictEqual(D.validateItem("events", { ...goodEvent, ends_on: "2026-11-03", end_time: "10:00" }).errors, {});
  assert.ok(D.validateItem("events", { ...goodEvent, start_time: "25:00" }).errors.start_time);
  assert.ok(D.validateItem("events", { ...goodEvent, starts_on: "" }).errors.starts_on);
});

t("public state: live, scheduled, expired, past event", () => {
  const today = "2026-10-07";
  const state = (type, item) => (D.publicState(type, { status: "published", ...item }, today) || {}).key;
  assert.strictEqual(state("announcements", { date: "2026-10-07" }), "live");
  assert.strictEqual(state("announcements", { date: "2026-10-09" }), "scheduled");
  assert.strictEqual(state("announcements", { date: "2026-10-01", expires: "2026-10-06" }), "expired");
  assert.strictEqual(state("announcements", { date: "2026-10-01", expires: "2026-10-07" }), "live", "still shown on its last day");
  assert.strictEqual(state("events", { starts_on: "2026-10-05", ends_on: "2026-10-08" }), "live");
  assert.strictEqual(state("events", { starts_on: "2026-10-06" }), "expired");
  assert.strictEqual(D.publicState("announcements", { status: "draft", date: today }, today), null);
});

t("CSV: same columns as the Google Sheet, newest first, quotes/commas/line breaks kept, and it reads back", () => {
  const rows = [
    { date: "2026-10-06", title: "Old", category: "Student", message: "a", pinned: false, posted_by: "X", created_at: "1" },
    { date: "2026-10-07", title: 'Say "hi", all', category: "Social", message: "line 1\nline 2", link: "https://x.org", pinned: true, expires: "2026-10-09", posted_by: "Y", created_at: "2" },
  ];
  const csv = D.announcementsToCsv(rows);
  const lines = csv.split("\n");
  assert.strictEqual(lines[0], "Date,Title,Category,Message,Link,Pinned,Expires,Posted by");
  assert.strictEqual(lines[1], '2026-10-07,"Say ""hi"", all",Social,"line 1');
  assert.strictEqual(lines[3], "2026-10-06,Old,Student,a,,,,X");
  assert.deepStrictEqual(D.parseCsv(csv)[1], ["2026-10-07", 'Say "hi", all', "Social", "line 1\nline 2", "https://x.org", "Yes", "2026-10-09", "Y"]);
});

t("same-day announcements: the newer one gets the later row (the site shows later rows first)", () => {
  const csv = D.announcementsToCsv([
    { date: "2026-10-07", title: "Second", category: "Student", message: "b", posted_by: "X", created_at: "2026-10-07T10:00:00Z" },
    { date: "2026-10-07", title: "First", category: "Student", message: "a", posted_by: "X", created_at: "2026-10-07T09:00:00Z" },
  ]);
  assert.ok(csv.indexOf("First") < csv.indexOf("Second"));
});

t("events.json: soonest first, times without seconds, only public fields", () => {
  const json = JSON.parse(D.eventsToJson([
    { id: "b", title: "Later", category: "Social", starts_on: "2026-11-05", start_time: null, description: "d", posted_by: "X", created_by: "secret-id", review_note: "internal" },
    { id: "a", title: "Sooner", category: "Career", starts_on: "2026-11-01", start_time: "18:30:00", end_time: "20:00:00", description: "d", posted_by: "X" },
  ], "2026-2028"));
  assert.strictEqual(json.cohort, "2026-2028");
  assert.deepStrictEqual(json.events.map((e) => e.title), ["Sooner", "Later"]);
  assert.strictEqual(json.events[0].startTime, "18:30");
  assert.strictEqual(json.events[0].endTime, "20:00");
  assert.ok(!JSON.stringify(json).includes("secret-id") && !JSON.stringify(json).includes("internal"), "no internal fields");
});

t("schema: Row Level Security on every table; editors and the log are never writable through the API", () => {
  for (const table of ["editors", "activity_log"]) assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(schema, /foreach t in array array\['announcements', 'events'\] loop\s+execute format\('alter table public\.%I enable row level security'/);
  assert.ok(!/grant[^;]*(insert|update|delete)[^;]*on public\.(editors|activity_log)/i.test(schema), "editors/activity_log must not be writable");
  assert.match(schema, /using \(status = 'published' or public\.is_editor\(\)\)/);
  assert.match(schema, /with check \(public\.is_editor\(\) and \(status in \('draft', 'submitted'\) or public\.is_admin\(\)\)\)/);
  assert.match(schema, /revoke execute on function public\.add_editor[^;]*from public, anon;/);
});

t("supabase-config.js holds no secret key and a valid cohort", () => {
  const text = fs.readFileSync(path.join(ROOT, "supabase-config.js"), "utf8");
  assert.ok(!/service_role|sb_secret_/i.test(text.replace(/\/\/.*$/gm, "")), "a secret key must never be in the repository");
  assert.match(config.cohort, /^\d{4}-\d{4}$/);
  if (config.url) assert.match(config.url, /^https:\/\/[a-z0-9-]+\.supabase\.co$/);
});

console.log(`${n} editor data checks passed`);
