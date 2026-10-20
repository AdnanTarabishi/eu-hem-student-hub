// One-time helper used while building Session 6. It copies the reviewed original
// practice content from the Session 6 browser module into the canonical JSON banks.
// Kept deterministic so rerunning it never duplicates IDs.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(ROOT, "fhe-session-6.js"), "utf8");

function extract(name, nextMarker) {
  const declaration = `  const ${name} = [`;
  const start = source.indexOf(declaration);
  if (start < 0) throw new Error(`Could not find ${name} in fhe-session-6.js`);
  const arrayStart = source.indexOf("[", start);
  const end = source.indexOf(`\n\n  ${nextMarker}`, arrayStart);
  if (end < 0) throw new Error(`Could not find the end of ${name}`);
  return vm.runInNewContext(`(${source.slice(arrayStart, end).trim()})`, Object.create(null));
}

const additions = {
  "content/modules/fund-health-economics/flashcards.json": extract("flashcards", "const questions = ["),
  "content/modules/fund-health-economics/questions.json": extract("questions", "const concepts = ["),
  "content/concepts.json": extract("concepts", "const resources = ["),
  "content/modules/fund-health-economics/resources.json": extract("resources", "function appendUnique"),
};

for (const [relative, items] of Object.entries(additions)) {
  const file = path.join(ROOT, relative);
  const current = JSON.parse(fs.readFileSync(file, "utf8"));
  const ids = new Set(current.map((item) => item.id));
  let added = 0;
  for (const item of items) {
    if (!ids.has(item.id)) {
      current.push(item);
      ids.add(item.id);
      added++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(current, null, 2) + "\n");
  console.log(`${relative}: ${added} Session 6 items added`);
}

const testFile = path.join(ROOT, "tests/notes/practice.test.js");
let test = fs.readFileSync(testFile, "utf8");
const fixed = '    assert.match(await page.locator("#flashcards .flashcard-counter").innerText(), /1\\s+(?:of|\\/)\\s+103/);';
const dynamic = '    assert.match(await page.locator("#flashcards .flashcard-counter").innerText(), new RegExp(`1\\\\s+(?:of|/)\\\\s+${cards.length}`));';
if (test.includes(fixed)) {
  test = test.replace(fixed, dynamic);
  fs.writeFileSync(testFile, test);
  console.log("tests/notes/practice.test.js: flashcard total made content-driven");
} else if (!test.includes("${cards.length}")) {
  throw new Error("Could not update the flashcard-count assertion");
}
