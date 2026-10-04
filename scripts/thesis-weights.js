// ===== Theme -> current-track weights for the thesis enrichment =====
// Prints the table of weights used to show "potential relevance to the current tracks", with the
// course counts it is derived from (content/tracks.json), and compares it with what is stored in
// content/thesis-enrichment.json.
//
// Run:            node scripts/thesis-weights.js
// Update stored:  node scripts/thesis-weights.js --write   (only the "derived" rows; proposals are kept)
//
// Derived weight = (2 x required + 1 x elective courses carrying the theme) / the highest track (0-1).
// Themes no course carries have "proposal" weights, set by hand in the enrichment file.

const fs = require("fs");
const path = require("path");
global.readStorage = () => null;
const tracks = require("../tracks-data.js");
global.trackCourses = tracks.trackCourses;
global.courseInfo = tracks.courseInfo;
const enrich = require("../thesis-enrichment.js");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "content", "thesis-enrichment.json");

function compare(enrichment, cohort) {
  const ids = cohort.tracks.map((t) => t.id);
  const rows = [];
  for (const theme of enrich.topicThemes(enrichment, cohort)) {
    const stored = enrichment.relevance.weights[theme.id] || {};
    const derived = enrich.derivedWeights(cohort, theme.id);
    const counts = enrich.themeCourseCounts(cohort, theme.id);
    const stale = stored.basis === "derived" && derived && ids.some((id) => stored[id] !== derived[id]);
    rows.push({ theme, stored, derived, counts, stale });
  }
  return { ids, rows };
}

function main() {
  const enrichment = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const cohort = tracks.tracksCohort(JSON.parse(fs.readFileSync(path.join(ROOT, "content", "tracks.json"), "utf8")));
  const { ids, rows } = compare(enrichment, cohort);
  console.log(`${"Theme".padEnd(36)}${ids.map((id) => id.toUpperCase().padEnd(13)).join("")}Basis`);
  for (const { theme, stored, derived, counts, stale } of rows) {
    const cells = ids.map((id) => `${stored[id] ?? "?"} (${counts[id].required}R ${counts[id].elective}E)`.padEnd(13));
    console.log(`${(theme.label || theme.id).padEnd(36)}${cells.join("")}${stored.basis || "MISSING"}${stale ? `  ⚠ tracks.json now gives ${ids.map((id) => derived[id]).join(" / ")}` : ""}${!derived && stored.basis === "derived" ? "  ⚠ no course carries this theme any more: make it a proposal" : ""}`);
  }
  if (process.argv.includes("--write")) {
    let changed = 0;
    for (const { theme, derived, stored } of rows) {
      if (stored.basis !== "derived" || !derived) continue;
      enrichment.relevance.weights[theme.id] = { ...derived, basis: "derived" };
      changed++;
    }
    const { records, ...head } = enrichment;
    const text = JSON.stringify(head, null, 2).replace(/\n}$/, ',\n  "records": [\n') +
      records.map((r) => "    " + JSON.stringify(r)).join(",\n") + "\n  ]\n}\n";
    fs.writeFileSync(FILE, text);
    console.log(`\n✔ Updated ${changed} derived rows in content/thesis-enrichment.json (proposals unchanged).`);
  } else if (rows.some((r) => r.stale)) {
    console.log("\nSome derived weights no longer match tracks.json. Run: node scripts/thesis-weights.js --write");
  }
}

if (require.main === module) main();
module.exports = { compare };
