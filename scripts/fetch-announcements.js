// ===== Announcements copier =====
// Saves the published announcements as data/announcements.csv, so the website loads them from its
// own address (fast, works offline, and never depends on another service being up).
//
// Where they come from:
// - the editor dashboard's database (Supabase), once supabase-config.js has a url and key;
// - until then, the class Google Sheet, as before.
//
// Runs on GitHub Actions every 15 minutes (see .github/workflows/update-announcements.yml).
// Run it yourself with:  node scripts/fetch-announcements.js

const fs = require("fs");
const path = require("path");
const supabase = require("../supabase-config.js");
const { announcementsToCsv } = require("../editor-data.js");

// The Google Sheet, as CSV. To use another sheet: take its sharing link and replace
// "/edit?usp=sharing" with "/export?format=csv". The sheet must be shared as
// "Anyone with the link: Viewer".
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yDfWywa8DWZsKgl_UeA0_8kLzSDnW2PmnH91LbUp6Wg/export?format=csv";

const OUTPUT_FILE = path.join(__dirname, "..", "data", "announcements.csv");

// Columns the website needs. If any is missing, we keep the old copy.
const REQUIRED_COLUMNS = ["Date", "Title", "Category", "Message"];

// Published announcements of the current cohort, via the public (read-only) Data API.
// The publishable key can only read what supabase/schema.sql allows: published rows.
async function csvFromSupabase() {
  const url = new URL("/rest/v1/announcements", supabase.url);
  url.searchParams.set("select", "date,title,category,message,link,pinned,expires,posted_by,created_at");
  url.searchParams.set("status", "eq.published");
  url.searchParams.set("cohort", `eq.${supabase.cohort}`);
  const response = await fetch(url, { headers: { apikey: supabase.publishableKey, Accept: "application/json" } });
  if (!response.ok) throw new Error(`Supabase: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Supabase: unexpected answer (not a list). Not updating.");

  // Safety net: an empty answer while the site still shows announcements is more likely a setup
  // mistake (wrong cohort, wrong project) than real. Archive the last one by hand in that rare case.
  const old = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, "utf8") : "";
  if (rows.length === 0 && old.split(/\r?\n/).filter((line) => line.trim()).length > 1 && process.env.ALLOW_EMPTY !== "1") {
    throw new Error("Supabase returned no published announcements, but the site has some. Not updating (set ALLOW_EMPTY=1 to allow).");
  }
  return announcementsToCsv(rows);
}

async function main() {
  if (supabase.url && supabase.publishableKey) {
    const csv = await csvFromSupabase();
    return save(csv, "the editor dashboard (Supabase)");
  }
  return save(await csvFromSheet(), "the Google Sheet");
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

function save(csv, source) {
  const old = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, "utf8") : null;
  if (old === csv) {
    console.log("Announcements unchanged.");
    return;
  }
  fs.writeFileSync(OUTPUT_FILE, csv);
  const rows = csv.split(/\r?\n/).filter((line) => line.trim()).length - 1;
  console.log(`Saved data/announcements.csv from ${source} (about ${rows} rows).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1); // marks the GitHub Actions run as failed; the old copy stays online
});
