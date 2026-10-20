// One-time deterministic integration for Session 7.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const TOPIC_ID = "fund-health-economics.adverse-selection";

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function writeJson(relative, value) {
  fs.writeFileSync(path.join(ROOT, relative), JSON.stringify(value, null, 2) + "\n");
}

function loadSessionData() {
  const source = fs.readFileSync(path.join(ROOT, "fhe-session-7.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: "fhe-session-7.js" });
  const data = sandbox.window.FHESession7;
  if (!data || data.topic !== TOPIC_ID) throw new Error("Session 7 browser data could not be loaded.");
  return data;
}

function appendUnique(relative, items) {
  const current = readJson(relative);
  const ids = new Set(current.map((item) => item.id));
  let added = 0;
  for (const item of items) {
    if (!ids.has(item.id)) {
      current.push(item);
      ids.add(item.id);
      added++;
    }
  }
  writeJson(relative, current);
  console.log(`${relative}: ${added} Session 7 items added`);
}

function replaceFile(relative, transform) {
  const full = path.join(ROOT, relative);
  const before = fs.readFileSync(full, "utf8");
  const after = transform(before);
  if (after === before) return false;
  fs.writeFileSync(full, after);
  console.log(`${relative}: updated`);
  return true;
}

function insertAfter(text, anchor, addition) {
  if (text.includes(addition.trim())) return text;
  if (!text.includes(anchor)) throw new Error(`Anchor not found: ${anchor}`);
  return text.replace(anchor, anchor + "\n" + addition);
}

const data = loadSessionData();
appendUnique("content/modules/fund-health-economics/flashcards.json", data.flashcards);
appendUnique("content/modules/fund-health-economics/questions.json", data.questions);
appendUnique("content/concepts.json", data.concepts);
appendUnique("content/modules/fund-health-economics/resources.json", data.resources);

const pathFile = readJson("content/modules/fund-health-economics/learning-path.json");
const session7 = pathFile.sessions.find((session) => session.number === 7);
if (!session7) throw new Error("Session 7 learning-path entry is missing.");
Object.assign(session7, {
  topic: TOPIC_ID,
  title: "Insurance II: Adverse Selection, Social Insurance & Premium Risk",
  shortTitle: "Insurance II",
  summary: "Hidden risk types, contract space, pooling and separating equilibria, compulsory insurance and premium risk.",
  keywords: [
    "adverse selection",
    "Rothschild Stiglitz",
    "pooling",
    "separating equilibrium",
    "incentive compatibility",
    "social insurance",
    "premium risk",
    "government intervention"
  ],
  status: "available"
});
writeJson("content/modules/fund-health-economics/learning-path.json", pathFile);

const topics = readJson("content/modules/fund-health-economics/topics.json");
const topic = topics.find((item) => item.id === TOPIC_ID);
if (!topic) throw new Error("Adverse-selection topic is missing.");
Object.assign(topic, {
  title: "Session 7: Insurance II — Adverse Selection, Social Insurance and Premium Risk",
  notes: "notes/adverse-selection.md",
  lecture: "lectures/session-7.json"
});
writeJson("content/modules/fund-health-economics/topics.json", topics);

replaceFile("course.html", (text) => {
  text = insertAfter(text, '  <script defer src="fhe-session-6.js', '  <script defer src="fhe-session-7.js"></script>');
  text = insertAfter(text, '  <script defer src="fhe-session-6-links.js', '  <script defer src="fhe-session-7-links.js"></script>');
  return text;
});

replaceFile("notes.html", (text) => {
  text = insertAfter(text, '  <script defer src="fhe-session-6.js', '  <script defer src="fhe-session-7.js"></script>');
  text = insertAfter(text, '  <script defer src="fhe-session-6-links.js', '  <script defer src="fhe-session-7-links.js"></script>');
  return text;
});

replaceFile("fhem-exam.html", (text) => insertAfter(text, '  <script defer src="fhe-session-6.js', '  <script defer src="fhe-session-7.js"></script>'));

replaceFile("sw.js", (text) => {
  const anchor = '  "quant-methods.css", "quant-methods.js", "health-econ-management.css", "health-econ-management.js", "fhem-exam.css", "fhem-exam.js",';
  const replacement = anchor + '\n  "fhe-session-7.html", "fhe-session-7.css", "fhe-session-7.js", "fhe-session-7-runtime.js", "fhe-session-7-page.js", "fhe-session-7-links.js",';
  return text.includes('"fhe-session-7.html"') ? text : text.replace(anchor, replacement);
});

console.log("Session 7 integration complete.");
