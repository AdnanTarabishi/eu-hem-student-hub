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

t("categories in editor-data.js and the database check are the same list", () => {
  const match = schema.match(/category in\s*\(([^)]*)\)/);
  assert.ok(match, "category check not found in schema.sql");
  const fromSchema = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepStrictEqual(fromSchema, D.CATEGORIES);
});

t("a correct announcement passes and is cleaned (spaces trimmed, empty optional fields become null)", () => {
  const { value, errors } = D.validateAnnouncement({ ...good, title: "  Exam room changed  " });
  assert.deepStrictEqual(errors, {});
  assert.strictEqual(value.title, "Exam room changed");
  assert.strictEqual(value.link, null);
  assert.strictEqual(value.expires, null);
});

t("wrong values are refused with a message per field", () => {
  const { errors } = D.validateAnnouncement({ date: "2026-02-31", title: "Hi", category: "Gossip", message: " ",
    link: "javascript:alert(1)", expires: "2026-01-01", posted_by: "" });
  assert.deepStrictEqual(Object.keys(errors).sort(), ["category", "date", "link", "message", "posted_by", "title"]);
  const before = D.validateAnnouncement({ ...good, expires: "2026-10-01" }).errors;
  assert.match(before.expires, /before the date/);
});

t("CSV: same columns as the Google Sheet, newest first, quotes/commas/line breaks kept, pinned as Yes", () => {
  const csv = D.announcementsToCsv([
    { date: "2026-10-06", title: "Old", category: "Student", message: "a", pinned: false, posted_by: "X", created_at: "1" },
    { date: "2026-10-07", title: 'Say "hi", all', category: "Social", message: "line 1\nline 2", link: "https://x.org", pinned: true, expires: "2026-10-09", posted_by: "Y", created_at: "2" },
  ]);
  const lines = csv.split("\n");
  assert.strictEqual(lines[0], "Date,Title,Category,Message,Link,Pinned,Expires,Posted by");
  assert.strictEqual(lines[1], '2026-10-07,"Say ""hi"", all",Social,"line 1');
  assert.strictEqual(lines[2], 'line 2",https://x.org,Yes,2026-10-09,Y');
  assert.strictEqual(lines[3], "2026-10-06,Old,Student,a,,,,X");
  assert.ok(csv.endsWith("\n"));
});

t("same-day announcements: the newer one gets the later row (the site shows later rows first)", () => {
  const csv = D.announcementsToCsv([
    { date: "2026-10-07", title: "Second", category: "Student", message: "b", posted_by: "X", created_at: "2026-10-07T10:00:00Z" },
    { date: "2026-10-07", title: "First", category: "Student", message: "a", posted_by: "X", created_at: "2026-10-07T09:00:00Z" },
  ]);
  assert.ok(csv.indexOf("First") < csv.indexOf("Second"));
});

t("schema: Row Level Security on both tables, nobody can insert editors from the website", () => {
  assert.match(schema, /alter table public\.editors enable row level security/);
  assert.match(schema, /alter table public\.announcements enable row level security/);
  assert.ok(!/grant[^;]*(insert|update|delete)[^;]*on public\.editors/i.test(schema), "editors must not be writable through the API");
  assert.match(schema, /grant select on public\.announcements to anon;/);
  // anon may only read published rows
  assert.match(schema, /using \(status = 'published' or public\.is_editor\(\)\)/);
  // only admins may publish
  assert.match(schema, /with check \(public\.is_editor\(\) and \(status in \('draft', 'submitted'\) or public\.is_admin\(\)\)\)/);
});

t("supabase-config.js holds no secret key and a valid cohort", () => {
  const text = fs.readFileSync(path.join(ROOT, "supabase-config.js"), "utf8");
  assert.ok(!/service_role|sb_secret_/i.test(text.replace(/\/\/.*$/gm, "")), "a secret key must never be in the repository");
  assert.match(config.cohort, /^\d{4}-\d{4}$/);
  if (config.url) assert.match(config.url, /^https:\/\/[a-z0-9-]+\.supabase\.co$/);
});

console.log(`${n} editor data checks passed`);
