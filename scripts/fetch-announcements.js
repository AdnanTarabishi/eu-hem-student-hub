// ===== Announcements copier =====
// Downloads the class Google Sheet as CSV and saves it as data/announcements.csv,
// so the website can load announcements from its own address. (Loading straight from
// Google can be blocked by ad blockers or some networks.)
//
// Runs on GitHub Actions every 15 minutes (see .github/workflows/update-announcements.yml).
// Run it yourself with:  node scripts/fetch-announcements.js

const fs = require("fs");
const path = require("path");

// The Google Sheet, as CSV. To use another sheet: take its sharing link and replace
// "/edit?usp=sharing" with "/export?format=csv". The sheet must be shared as
// "Anyone with the link: Viewer".
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1yDfWywa8DWZsKgl_UeA0_8kLzSDnW2PmnH91LbUp6Wg/export?format=csv";

const OUTPUT_FILE = path.join(__dirname, "..", "data", "announcements.csv");

// Columns the website needs. If any is missing, we keep the old copy.
const REQUIRED_COLUMNS = ["Date", "Title", "Category", "Message"];

async function main() {
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

  const old = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, "utf8") : null;
  if (old === csv) {
    console.log("Announcements unchanged.");
    return;
  }
  fs.writeFileSync(OUTPUT_FILE, csv);
  const rows = csv.split(/\r?\n/).filter((line) => line.trim()).length - 1;
  console.log(`Saved data/announcements.csv (about ${rows} rows).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1); // marks the GitHub Actions run as failed; the old copy stays online
});
