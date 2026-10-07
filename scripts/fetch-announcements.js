// ===== Announcements and events copier =====
// Saves the published announcements as data/announcements.csv (and, from the dashboard, the published
// events as data/events.json), so the website loads them from its own address: fast, works offline,
// and never depends on another service being up.
//
// Where they come from:
// - the editor dashboard's database (Supabase), once supabase-config.js has a url and key;
// - until then, the class Google Sheet, as before (announcements only).
//
// Runs on GitHub Actions every 15 minutes (see .github/workflows/update-announcements.yml).
// Run it yourself with:  node scripts/fetch-announcements.js

const fs = require("fs");
const path = require("path");
const supabase = require("../supabase-config.js");
const { announcementsToCsv, eventsToJson } = require("../editor-data.js");

// The Google Sheet, as CSV. To use another sheet: take its sharing link and replace
// "/edit?usp=sharing" with "/export?format=csv". The sheet must be shared as
// "Anyone with the link: Viewer".
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yDfWywa8DWZsKgl_UeA0_8kLzSDnW2PmnH91LbUp6Wg/export?format=csv";

const ROOT = path.join(__dirname, "..");
const ANNOUNCEMENTS_FILE = path.join(ROOT, "data", "announcements.csv");
const EVENTS_FILE = path.join(ROOT, "data", "events.json");

// Columns the website needs. If any is missing, we keep the old copy.
const REQUIRED_COLUMNS = ["Date", "Title", "Category", "Message"];

// Published rows of one table for the current cohort, via the public (read-only) Data API.
// The publishable key can only read what supabase/schema.sql allows: published rows.
async function publishedRows(table, columns) {
  const url = new URL(`/rest/v1/${table}`, supabase.url);
  url.searchParams.set("select", columns);
  url.searchParams.set("status", "eq.published");
  url.searchParams.set("cohort", `eq.${supabase.cohort}`);
  const response = await fetch(url, { headers: { apikey: supabase.publishableKey, Accept: "application/json" } });
  if (!response.ok) throw new Error(`Supabase (${table}): HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`Supabase (${table}): unexpected answer (not a list). Not updating.`);
  return rows;
}

async function csvFromSupabase() {
  const rows = await publishedRows("announcements", "date,title,category,message,link,pinned,expires,posted_by,created_at");

  // Safety net: an empty answer while the site still shows announcements is more likely a setup
  // mistake (wrong cohort, wrong project) than real. Archive the last one by hand in that rare case.
  const old = fs.existsSync(ANNOUNCEMENTS_FILE) ? fs.readFileSync(ANNOUNCEMENTS_FILE, "utf8") : "";
  if (rows.length === 0 && old.split(/\r?\n/).filter((line) => line.trim()).length > 1 && process.env.ALLOW_EMPTY !== "1") {
    throw new Error("Supabase returned no published announcements, but the site has some. Not updating (set ALLOW_EMPTY=1 to allow).");
  }
  return announcementsToCsv(rows);
}

// Events: all published ones (events.js hides finished events). No safety net needed: "no events" is normal.
async function eventsFromSupabase() {
  const rows = await publishedRows("events", "id,title,category,starts_on,start_time,ends_on,end_time,location,description,link,posted_by");
  return eventsToJson(rows, supabase.cohort);
}

async function csvFromSheet() {
  const response = await fetch(SHEET_CSV_URL);
  if (!response.ok) throw new Error(`Google Sheets: HTTP ${response.status}`);

  // If sharing is turned off, Google sends a login page (HTML) instead of CSV
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/csv")) {
    throw new Error(`Expected CSV but got "${contentType}". Is the sheet still shared with "Anyone with the link"?`);
  }

  const csv = await response.text();
  const headerLine = csv.split(/\r?\n/)[0];
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    throw new Error(`The sheet is missing these columns: ${missing.join(", ")}. Not updating.`);
  }
  return csv;
}

// Writes the file only when something changed (the robot then commits it)
function save(file, text, source) {
  const name = path.relative(ROOT, file).split(path.sep).join("/");
  const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (old === text) {
    console.log(`${name} unchanged.`);
    return;
  }
  fs.writeFileSync(file, text);
  console.log(`Saved ${name} from ${source}.`);
}

async function main() {
  if (!supabase.url || !supabase.publishableKey) {
    save(ANNOUNCEMENTS_FILE, await csvFromSheet(), "the Google Sheet");
    return;
  }
  // Each copy on its own: a problem with events never stops announcements, and the other way round
  const source = "the editor dashboard (Supabase)";
  const problems = [];
  try { save(ANNOUNCEMENTS_FILE, await csvFromSupabase(), source); } catch (error) { problems.push(error.message); }
  try { save(EVENTS_FILE, await eventsFromSupabase(), source); } catch (error) { problems.push(error.message); }
  if (problems.length) throw new Error(problems.join("\n"));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1); // marks the GitHub Actions run as failed; the old copies stay online
});
