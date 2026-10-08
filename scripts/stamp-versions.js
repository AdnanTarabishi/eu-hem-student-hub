// ===== Version stamps =====
// Browsers keep copies of style.css and the .js files for a while. After an update they could
// mix an old script with a new page. To prevent that, every page links to its files with a
// fingerprint of the file's content:  <script src="ui.js?v=3fa9c21b">
// When a file changes, its fingerprint changes, so browsers fetch the new file at once.
// The service worker's VERSION (sw.js) is updated too, which shows "Update available" to
// visitors who installed the app.
//
// Run after changing any .css/.js/.html file:   node scripts/stamp-versions.js
// Only check (used by check-content.js):        node scripts/stamp-versions.js --check

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");

function fingerprint(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);
}

// Fingerprint without line-ending differences (Windows vs. GitHub), so it is the same everywhere
function fileFingerprint(file) {
  if (file.endsWith(".png")) return fingerprint(fs.readFileSync(path.join(ROOT, file)));
  return fingerprint(fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n"));
}

const htmlFiles = () => fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

// Adds or updates ?v= on local stylesheets, scripts and linked browser/app icons.
function stampHtml(html) {
  return html.replace(/(<(?:script|link)\b[^>]*\b(?:src|href)=")([\w./-]+\.(?:js|css|svg|png))(?:\?v=[0-9a-f]*)?"/g,
    (all, start, file) => (fs.existsSync(path.join(ROOT, file)) ? `${start}${file}?v=${fileFingerprint(file)}"` : all));
}

// One fingerprint for the whole site (pages + files they use + icons), for the service worker
function siteVersion(stampedPages) {
  const parts = Object.keys(stampedPages).sort().map((file) => stampedPages[file].replace(/\r\n/g, "\n"));
  for (const file of ["icons.svg", "img/student-hub-mark.svg", "manifest.webmanifest"]) parts.push(fileFingerprint(file));
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8").replace(/\r\n/g, "\n").replace(/const VERSION = "[^"]*";/, "");
  parts.push(sw);
  return fingerprint(parts.join("\n"));
}

// What would change: [{ file, before, after }]
function plannedChanges() {
  const changes = [];
  const stamped = {};
  for (const file of htmlFiles()) {
    const before = fs.readFileSync(path.join(ROOT, file), "utf8");
    stamped[file] = stampHtml(before);
    if (stamped[file] !== before) changes.push({ file, before, after: stamped[file] });
  }
  const swBefore = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const swAfter = swBefore.replace(/const VERSION = "[^"]*";/, `const VERSION = "${siteVersion(stamped)}";`);
  if (swAfter !== swBefore) changes.push({ file: "sw.js", before: swBefore, after: swAfter });
  return changes;
}

function main() {
  const changes = plannedChanges();
  if (process.argv.includes("--check")) {
    if (changes.length) {
      console.log(`Version stamps are out of date in: ${changes.map((c) => c.file).join(", ")}`);
      console.log("Run: node scripts/stamp-versions.js");
      process.exitCode = 1;
    } else {
      console.log("✔ Version stamps are up to date.");
    }
    return;
  }
  for (const change of changes) fs.writeFileSync(path.join(ROOT, change.file), change.after);
  console.log(changes.length ? `✔ Updated: ${changes.map((c) => c.file).join(", ")}` : "✔ Already up to date.");
}

if (require.main === module) main();
module.exports = { plannedChanges, stampHtml };
