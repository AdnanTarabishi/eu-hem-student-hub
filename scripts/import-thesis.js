// ===== Import the thesis spreadsheet into content/thesis-archive.json =====
// Run:  node scripts/import-thesis.js "C:\path\to\Thesis Topics 2021-2022.xlsx"
//
// What it does:
// 1. Reads the spreadsheet (columns: cohort, Track, University, Thesis Title).
// 2. Checks it: unknown track or university codes, empty titles and duplicate ids stop the import.
// 3. Builds one record per row. titleOriginal is the exact spreadsheet text; titleDisplay only gets
//    a minimal cleanup (spaces, line breaks, Excel "_x0002_" codes). Wording is never changed.
// 4. Applies content/thesis-overrides.json (your corrections and hidden records, by id).
// 5. Writes content/thesis-archive.json and prints totals and a "for your decision" report.
// The website only reads the JSON file; it never sees the spreadsheet.
// Full guide: docs/thesis-import.md

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { readXlsx } = require("./read-xlsx.js");

const ROOT = path.join(__dirname, "..");
const CONFIG_FILE = path.join(ROOT, "content", "thesis-config.json");
const OVERRIDES_FILE = path.join(ROOT, "content", "thesis-overrides.json");
const OUTPUT_FILE = path.join(ROOT, "content", "thesis-archive.json");
const EXPECTED_HEADER = ["cohort", "track", "university", "thesis title"];

// Excel writes some invisible characters as codes like "_x0002_"
const EXCEL_CODE = /_x[0-9A-Fa-f]{4}_/g;

// The only cleanup allowed: Excel codes removed, all runs of whitespace (spaces, line breaks,
// non-breaking spaces) become one space, and the ends are trimmed. Nothing else changes.
function cleanTitle(original) {
  return original.replace(EXCEL_CODE, "").replace(/[\s\u00a0]+/g, " ").trim();
}

// A short id from the content (not the row number), so links survive a re-import
function recordId(cohort, trackCode, universityCode, cleanedTitle) {
  const hash = crypto.createHash("sha1").update(`${cohort}|${trackCode}|${universityCode}|${cleanedTitle}`).digest("hex");
  return `t-${hash.slice(0, 8)}`;
}

class ImportError extends Error {}

// rows: spreadsheet rows (first row = header). Returns { records, hidden, report }.
function buildArchive(rows, config, overrides = {}) {
  const header = (rows[0] || []).map((h) => String(h).trim().toLowerCase());
  if (EXPECTED_HEADER.some((name, i) => header[i] !== name)) {
    throw new ImportError(`The first row must be: cohort | Track | University | Thesis Title (found: ${rows[0] ? rows[0].join(" | ") : "nothing"}).`);
  }
  const problems = [];
  const records = [];
  const hidden = [];
  const seen = new Map();
  rows.slice(1).forEach((row, i) => {
    const line = i + 2; // spreadsheet row number, for messages
    const [cohortRaw = "", trackRaw = "", universityRaw = "", titleOriginal = ""] = row;
    if (![cohortRaw, trackRaw, universityRaw, titleOriginal].some((v) => String(v).trim())) return; // empty row
    const cohort = String(cohortRaw).trim();
    const trackCode = String(trackRaw).trim();
    const universityCode = String(universityRaw).trim();
    const titleDisplay = cleanTitle(String(titleOriginal));
    if (!/^\d{4}-\d{4}$/.test(cohort)) problems.push(`Row ${line}: cohort "${cohort}" should look like 2020-2022.`);
    if (!config.legacyTracks[trackCode]) problems.push(`Row ${line}: unknown track code "${trackCode}". Known: ${Object.keys(config.legacyTracks).join(", ")} (add new codes to content/thesis-config.json).`);
    if (!config.universities[universityCode]) problems.push(`Row ${line}: unknown university code "${universityCode}". Known: ${Object.keys(config.universities).join(", ")}.`);
    if (!titleDisplay) problems.push(`Row ${line}: the thesis title is empty.`);
    const id = recordId(cohort, trackCode, universityCode, titleDisplay);
    if (seen.has(id)) problems.push(`Row ${line}: duplicate of row ${seen.get(id)} (same cohort, track, university and title; id ${id}).`);
    seen.set(id, line);
    const record = {
      id,
      cohort,
      trackCode,
      trackName: config.legacyTracks[trackCode] || "",
      universityCode,
      universityName: config.universities[universityCode] ? config.universities[universityCode].name : "",
      titleOriginal: String(titleOriginal),
      titleDisplay,
      // Themes and current-track relevance are NOT stored here: they are a Student Hub interpretation
      // and live only in content/thesis-enrichment.json (see docs/thesis-enrichment.md)
      link: "",
      row: line,
    };
    const override = overrides[id];
    if (override && override.hidden) {
      hidden.push(record);
      return;
    }
    if (override && typeof override.titleDisplay === "string" && override.titleDisplay.trim()) {
      record.titleDisplay = override.titleDisplay.trim();
      record.overridden = true;
    }
    records.push(record);
  });
  if (problems.length) throw new ImportError(`The spreadsheet has ${problems.length} problem(s). Nothing was written.\n  ${problems.join("\n  ")}`);
  const unknownOverrides = Object.keys(overrides).filter((id) => !seen.has(id));
  return { records, hidden, unknownOverrides, report: irregularities(records, config) };
}

// ----- "For your decision": titles worth a human look (the script never changes them) -----

function words(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

const STOP = new Set(["a", "an", "the", "of", "in", "on", "for", "and", "to", "with", "from", "by", "as", "at", "its", "is", "or", "vs", "versus"]);

function irregularities(records, config) {
  const allCaps = [];
  const cleaned = [];
  const shortOrNote = [];
  const names = [];
  for (const r of records) {
    const letters = r.titleDisplay.replace(/[^A-Za-z]/g, "");
    if (letters.length > 10 && letters === letters.toUpperCase()) allCaps.push(r);
    if (r.titleDisplay !== r.titleOriginal && !r.overridden) cleaned.push({ record: r, what: describeCleanup(r.titleOriginal) });
    if (r.titleDisplay.split(" ").length <= 6 || /\bQ[1-4]\b|being published|\btbd\b|\btbc\b|working title/i.test(r.titleDisplay)) shortOrNote.push(r);
    const found = [];
    for (const name of config.reportNames || []) if (r.titleDisplay.toLowerCase().includes(name.toLowerCase())) found.push(name);
    // Words with a capital letter after a small one, e.g. HealthKIC, PCaVision (but not mHealth/eHealth)
    for (const m of r.titleDisplay.matchAll(/\b\w*[a-z][A-Z]\w*\b/g)) if (!/^(mHealth|eHealth)$/.test(m[0])) found.push(m[0]);
    if (/in partnership with/i.test(r.titleDisplay)) found.push("“in partnership with”");
    if (found.length) names.push({ record: r, found: [...new Set(found)] });
  }
  // Near-duplicates: most meaningful words shared, or one title inside another
  const near = [];
  const sets = records.map((r) => new Set(words(r.titleDisplay).filter((w) => !STOP.has(w))));
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = sets[i];
      const b = sets[j];
      const shared = [...a].filter((w) => b.has(w)).length;
      const similarity = shared / new Set([...a, ...b]).size;
      const inside = records[i].titleDisplay.toLowerCase().includes(records[j].titleDisplay.toLowerCase()) ||
        records[j].titleDisplay.toLowerCase().includes(records[i].titleDisplay.toLowerCase());
      if (similarity >= 0.5 || inside) near.push({ a: records[i], b: records[j], similarity });
    }
  }
  return { allCaps, cleaned, shortOrNote, names, near };
}

function describeCleanup(original) {
  const what = [];
  if (EXCEL_CODE.test(original)) what.push(`removed Excel code ${original.match(EXCEL_CODE).join(" ")}`);
  EXCEL_CODE.lastIndex = 0;
  if (/[\r\n]/.test(original)) what.push("line break → space");
  if (/\u00a0/.test(original)) what.push("non-breaking space");
  if (/^\s|\s$/.test(original)) what.push("spaces at the start/end trimmed");
  if (/ {2,}/.test(original.trim())) what.push("double space → one space");
  return what.join("; ");
}

// ----- Running it -----

function countBy(records, key) {
  const counts = {};
  for (const r of records) counts[r[key]] = (counts[r[key]] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `${k} ${n}`).join(" · ");
}

function main() {
  const source = process.argv[2];
  if (!source) {
    console.log('Usage: node scripts/import-thesis.js "C:\\path\\to\\Thesis Topics.xlsx"');
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  const overrides = fs.existsSync(OVERRIDES_FILE) ? JSON.parse(fs.readFileSync(OVERRIDES_FILE, "utf8")) : {};
  let result;
  try {
    result = buildArchive(readXlsx(source), config, overrides);
  } catch (problem) {
    console.log(`✖ ${problem.message}`);
    process.exit(1);
  }
  const { records, hidden, unknownOverrides, report } = result;
  const archive = {
    note: "GENERATED by scripts/import-thesis.js from the thesis spreadsheet. Do not edit by hand: change the spreadsheet or content/thesis-overrides.json, then run the import again.",
    source: path.basename(source),
    count: records.length,
    records: records.map(({ row, overridden, ...record }) => record),
  };
  // One record per line: small, and a re-import shows clearly in Git which titles changed
  const { records: list, ...head } = archive;
  const text = JSON.stringify(head, null, 2).replace(/\n}$/, ',\n  "records": [\n') +
    list.map((r) => "    " + JSON.stringify(r)).join(",\n") + "\n  ]\n}\n";
  fs.writeFileSync(OUTPUT_FILE, text);

  console.log(`✔ Imported ${records.length + hidden.length} rows from ${path.basename(source)}`);
  console.log(`  Published: ${records.length} · hidden by overrides: ${hidden.length}`);
  console.log(`  Cohorts:      ${countBy(records, "cohort")}`);
  console.log(`  Tracks:       ${countBy(records, "trackCode")}`);
  console.log(`  Universities: ${countBy(records, "universityCode")}`);
  for (const id of unknownOverrides) console.log(`  ⚠ Override "${id}" matches no record (the title may have changed). Check content/thesis-overrides.json.`);
  const examplesMissing = (config.examples || []).filter((t) => !records.some((r) => r.titleDisplay === t));
  for (const t of examplesMissing) console.log(`  ⚠ Example not found exactly in the data: "${t}"`);

  console.log("\nFor your decision (nothing has been changed; use content/thesis-overrides.json if you want to):");
  const line = (r, extra = "") => `    ${r.id}  ${r.cohort} ${r.trackCode} ${r.universityCode}  "${r.titleDisplay}"${extra}`;
  console.log(`  ALL CAPS (${report.allCaps.length}):`);
  for (const r of report.allCaps) console.log(line(r));
  console.log(`  Cleaned up for display (${report.cleaned.length}):`);
  for (const c of report.cleaned) console.log(line(c.record, `  [${c.what}]`));
  console.log(`  Very short or note-like (${report.shortOrNote.length}):`);
  for (const r of report.shortOrNote) console.log(line(r));
  console.log(`  Name a company, product or organisation (${report.names.length}):`);
  for (const n of report.names) console.log(line(n.record, `  [${n.found.join(", ")}]`));
  console.log(`  Near-duplicates (${report.near.length}):`);
  for (const n of report.near) console.log(`${line(n.a)}\n  ~ ${line(n.b).trim()}`);
  console.log(`\nWrote ${path.relative(ROOT, OUTPUT_FILE)} (${Math.round(fs.statSync(OUTPUT_FILE).size / 1024)} KB). Next: node scripts/check-content.js, then node scripts/stamp-versions.js`);
}

if (require.main === module) main();
module.exports = { cleanTitle, recordId, buildArchive, ImportError, EXPECTED_HEADER };
