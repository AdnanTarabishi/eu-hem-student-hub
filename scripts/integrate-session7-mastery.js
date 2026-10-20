// One-time canonical integration for the Session 7 mastery expansion.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const TOPIC_ID = "fund-health-economics.adverse-selection";

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function write(relative, content) {
  fs.writeFileSync(path.join(ROOT, relative), content);
}

function readJson(relative) {
  return JSON.parse(read(relative));
}

function writeJson(relative, value) {
  write(relative, JSON.stringify(value, null, 2) + "\n");
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
  console.log(`${relative}: ${added} mastery items added`);
}

function replaceFile(relative, transform) {
  const before = read(relative);
  const after = transform(before);
  if (after === before) {
    console.log(`${relative}: unchanged`);
    return;
  }
  write(relative, after);
  console.log(`${relative}: updated`);
}

function loadMasteryData() {
  const source = read("fhe-session-7-advanced.js");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: "fhe-session-7-advanced.js" });
  const data = sandbox.window.FHESession7Mastery;
  if (!data || data.topic !== TOPIC_ID) {
    throw new Error("Session 7 mastery data could not be loaded.");
  }
  return data;
}

const mastery = loadMasteryData();
appendUnique("content/modules/fund-health-economics/flashcards.json", mastery.flashcards);
appendUnique("content/modules/fund-health-economics/questions.json", mastery.questions);
appendUnique("content/concepts.json", mastery.concepts);

const learningPath = readJson("content/modules/fund-health-economics/learning-path.json");
const session7 = learningPath.sessions.find((session) => session.number === 7);
if (!session7) throw new Error("Session 7 learning-path entry is missing.");
session7.summary =
  "Hidden risk types, contract space, pooling and separating equilibria, compulsory insurance, premium risk and an advanced mastery studio.";
session7.keywords = [...new Set([
  ...(session7.keywords || []),
  "single crossing",
  "incentive compatibility",
  "cream skimming",
  "quantity rationing",
  "premium insurance",
])];
writeJson("content/modules/fund-health-economics/learning-path.json", learningPath);

replaceFile("content/modules/fund-health-economics/notes/adverse-selection.md", (text) => {
  if (text.includes("## Advanced mastery: audit an insurance-market equilibrium")) return text;
  return text.trimEnd() + `

## Advanced mastery: audit an insurance-market equilibrium

Before calling an allocation an equilibrium, check four separate conditions:

1. **Participation:** each type prefers its selected contract to the uninsured endowment.
2. **Incentive compatibility:** the low-risk type prefers the low-risk contract and the high-risk type prefers the high-risk contract.
3. **Break-even:** each contract earns zero expected profit for the type that selects it.
4. **No profitable deviation:** no entrant can attract a profitable subset of consumers with another contract.

### Worked pooling example

Let \(p_L=0.10\), \(p_H=0.30\), \(\lambda=0.75\), and \(I=1000\).

\[
\bar p=\lambda p_L+(1-\lambda)p_H
      =0.75(0.10)+0.25(0.30)=0.15
\]

\[
\pi^P=\bar p I=150
\]

A low-risk enrollee has expected payout \(p_LI=100\), so pays \(50\) above own expected cost. A high-risk enrollee has expected payout \(p_HI=300\), so pays \(150\) below own expected cost. Aggregate transfers balance:

\[
0.75(50)=0.25(150)=37.5
\]

The contract therefore breaks even for the population while redistributing from low risks to high risks.

### Common exam traps

- High expected cost alone is not adverse selection; the mechanism requires hidden risk information and selection into plans.
- A pooling contract that breaks even is not automatically an equilibrium; it must survive cream-skimming.
- Separating equilibrium sorts types but is not first best because low risks remain partially insured.
- Partial versus full concerns the indemnity; fair versus unfair concerns the premium.
- The lecture does not provide a universal numerical threshold for the low-risk share above which equilibrium fails.
- The welfare result concerns a suitably designed compulsory pooling policy, not every possible mandate.
`;
});

replaceFile("fhe-session-7.html", (text) => {
  if (!text.includes("fhe-session-7-advanced.css")) {
    text = text.replace(
      /(\s*<link rel="stylesheet" href="fhe-session-7\.css[^>]*>)/,
      `$1\n  <link rel="stylesheet" href="fhe-session-7-advanced.css">`,
    );
  }
  if (!text.includes("fhe-session-7-advanced.js")) {
    text = text.replace(
      /(\s*<script defer src="fhe-session-7-runtime\.js[^>]*><\/script>)/,
      `$1\n  <script defer src="fhe-session-7-advanced.js"></script>`,
    );
  }
  text = text.replace(
    "Original student study notes, adverse-selection simulators, flashcards and practice for Fundamentals in Health Economics Session 7.",
    "Advanced original study notes, 11 adverse-selection labs, mastery checklists, flashcards and practice for Fundamentals in Health Economics Session 7.",
  );
  return text;
});

const brokenSessionScripts =
`  <script defer src="fhe-session-6.js
  <script defer src="fhe-session-7.js?v=d76aa359"></script>?v=52768bc8"></script>`;

const fixedSessionScripts =
`  <script defer src="fhe-session-6.js"></script>
  <script defer src="fhe-session-7.js"></script>`;

const brokenLinkScripts =
`  <script defer src="fhe-session-6-links.js
  <script defer src="fhe-session-7-links.js?v=b1d47317"></script>?v=f08803d6"></script>`;

const fixedLinkScripts =
`  <script defer src="fhe-session-6-links.js"></script>
  <script defer src="fhe-session-7-links.js"></script>`;

for (const relative of ["course.html", "notes.html"]) {
  replaceFile(relative, (text) => {
    if (text.includes(brokenSessionScripts)) text = text.replace(brokenSessionScripts, fixedSessionScripts);
    if (text.includes(brokenLinkScripts)) text = text.replace(brokenLinkScripts, fixedLinkScripts);
    return text;
  });
}

replaceFile("fhem-exam.html", (text) => {
  if (text.includes(brokenSessionScripts)) text = text.replace(brokenSessionScripts, fixedSessionScripts);
  return text;
});

replaceFile("sw.js", (text) => {
  if (text.includes('"fhe-session-7-advanced.js"')) return text;
  const anchor =
    '  "fhe-session-7.html", "fhe-session-7.css", "fhe-session-7.js", "fhe-session-7-runtime.js", "fhe-session-7-page.js", "fhe-session-7-links.js",';
  const replacement =
    anchor +
    '\n  "fhe-session-7-advanced.css", "fhe-session-7-advanced.js",';
  if (!text.includes(anchor)) throw new Error("Session 7 service-worker cache anchor not found.");
  return text.replace(anchor, replacement);
});

console.log("Session 7 mastery integration complete.");
