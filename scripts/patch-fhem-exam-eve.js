// One-time patch: expose Mock Exam 5 and dynamic exam-bank counts in Exam Centre v2.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function read(file) { return fs.readFileSync(path.join(ROOT, file), "utf8"); }
function write(file, text) { fs.writeFileSync(path.join(ROOT, file), text); }
function replaceRequired(text, before, after, label) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) throw new Error(`Patch target missing: ${label}`);
  return text.replace(before, after);
}

let js = read("fhem-exam-v2.js");
js = replaceRequired(
  js,
  'if (mode === "mock-3" || mode === "mock-4") return fixedExam(mode);',
  'if (bank.fixedMocks.some((mock) => mock.id === mode)) return fixedExam(mode);',
  "dynamic fixed mock selection",
);
js = replaceRequired(
  js,
  '<span>2 fixed original mocks</span>',
  '<span>${bank.fixedMocks.length} fixed original mocks</span>',
  "dynamic hero mock count",
);
js = replaceRequired(
  js,
  `    const fixedGrid = el("div", "exam-v2-fixed-grid");
    fixedGrid.append(
      modeCard("MOCK EXAM 3 / 90 MIN", "Cost sharing, incentives and equity", "A cross-session paper on demand, Grossman, disparities, physician behaviour and insurance design.", ["6 MCQ", "2 Binary", "1 Open", "106 raw points"], "Start Mock 3 →", "mock-3", true),
      modeCard("MOCK EXAM 4 / 90 MIN", "Plan competition and premium risk", "A second paper centred on causal identification, practice variation and insurance-market equilibrium.", ["6 MCQ", "2 Binary", "1 Open", "106 raw points"], "Start Mock 4 →", "mock-4"),
    );
    shell.appendChild(fixedGrid);`,
  `    const fixedGrid = el("div", "exam-v2-fixed-grid");
    bank.fixedMocks.forEach((mock, index) => {
      fixedGrid.appendChild(
        modeCard(
          \`${'${mock.title.toUpperCase()}'} / 90 MIN\`,
          mock.subtitle,
          mock.description,
          ["6 MCQ", "2 Binary", "1 Open", "106 raw points"],
          \`Start ${'${mock.title.replace("Exam ", "")}'} →\`,
          mock.id,
          index === 0,
        ),
      );
    });
    shell.appendChild(fixedGrid);`,
  "dynamic fixed mock cards",
);
js = replaceRequired(js, 'modeCard("24 ITEMS", "MCQ Partial-Credit Lab"', 'modeCard(`${bank.mcqs.length} ITEMS`, "MCQ Partial-Credit Lab"', "dynamic MCQ count");
js = replaceRequired(js, 'modeCard("12 ITEMS", "Binary Trap Lab"', 'modeCard(`${bank.binaries.length} ITEMS`, "Binary Trap Lab"', "dynamic binary count");
js = replaceRequired(js, 'modeCard("8 CASES", "Open-Question Workshop"', 'modeCard(`${bank.opens.length} CASES`, "Open-Question Workshop"', "dynamic open count");
write("fhem-exam-v2.js", js);

let css = read("fhem-exam-v2.css");
if (!css.includes("/* Exam-eve fixed-mock expansion */")) {
  css += `

/* Exam-eve fixed-mock expansion */
.exam-v2-fixed-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
`;
}
write("fhem-exam-v2.css", css);
console.log("FHEM exam-eve Mock 5 patch complete.");
