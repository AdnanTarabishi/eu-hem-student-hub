// ===== Move the current announcements into Supabase (once) =====
// Reads data/announcements.csv (the copy of the Google Sheet) and prints SQL that adds every row to the
// announcements table as "published", owned by the first admin. Paste the output into
// Supabase -> SQL Editor and run it. Step 6 in docs/editor-dashboard.md.
//
// Run:  node scripts/announcements-to-sql.js > announcements-import.sql
// (That file is only for pasting; it is ignored by Git and can be deleted afterwards.)

const fs = require("fs");
const path = require("path");
const { cohort } = require("../supabase-config.js");
const { validateAnnouncement } = require("../editor-data.js");

const CSV_FILE = path.join(__dirname, "..", "data", "announcements.csv");

// Standard CSV: quoted cells may contain commas, "" quotes and line breaks
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((value) => value.trim()));
}

// A text value for SQL: 'it''s' (quotes doubled), or null
const sql = (value) => (value == null || value === "" ? "null" : `'${String(value).replace(/'/g, "''")}'`);

const [header, ...rows] = parseCsv(fs.readFileSync(CSV_FILE, "utf8"));
const column = (row, name) => (row[header.indexOf(name)] || "").trim();

const values = [];
for (const row of rows) {
  const { value, errors } = validateAnnouncement({
    date: column(row, "Date"),
    title: column(row, "Title"),
    category: column(row, "Category"),
    message: column(row, "Message"),
    link: column(row, "Link"),
    pinned: ["yes", "true", "y", "1"].includes(column(row, "Pinned").toLowerCase()),
    expires: column(row, "Expires"),
    posted_by: column(row, "Posted by") || "Student Hub team",
  });
  if (Object.keys(errors).length) {
    console.error(`Skipped "${column(row, "Title")}": ${Object.values(errors).join(" ")}`);
    continue;
  }
  values.push(`  (${[sql(cohort), sql(value.date), sql(value.title), sql(value.category), sql(value.message), sql(value.link),
    value.pinned, sql(value.expires), sql(value.posted_by), "'published'", "(select user_id from admin)"].join(", ")})`);
}

if (!values.length) {
  console.error("No announcements to import.");
  process.exit(1);
}

console.log(`-- ${values.length} announcement(s) from data/announcements.csv. Run once: running twice adds them twice.
with admin as (select user_id from public.editors where role = 'admin' order by created_at limit 1)
insert into public.announcements (cohort, date, title, category, message, link, pinned, expires, posted_by, status, created_by)
values
${values.join(",\n")};`);
