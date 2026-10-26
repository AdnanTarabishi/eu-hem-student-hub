// One-time update: make Notes practice regression load the exam-eve runtime additions.
const fs = require('fs');
const path = require('path');
const file = 'tests/notes/practice.test.js';
let text = fs.readFileSync(file, 'utf8');
const before = `const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const bank = read("content/modules/fund-health-economics/questions.json");
const cards = read("content/modules/fund-health-economics/flashcards.json");`;
const after = `const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const examEve = (() => {
  const sandbox = { window: {} };
  require("node:vm").runInNewContext(
    fs.readFileSync(path.join(root, "fhem-exam-eve-data.js"), "utf8"),
    sandbox,
    { filename: "fhem-exam-eve-data.js" },
  );
  return sandbox.window.FHEMExamEve;
})();
const bank = [
  ...read("content/modules/fund-health-economics/questions.json"),
  ...(examEve?.questions || []),
];
const cards = [
  ...read("content/modules/fund-health-economics/flashcards.json"),
  ...(examEve?.flashcards || []),
];`;
if (!text.includes(after)) {
  if (!text.includes(before)) throw new Error('Notes practice bank declarations were not found.');
  text = text.replace(before, after);
  fs.writeFileSync(file, text);
  console.log('Notes practice regression now loads exam-eve runtime additions.');
}
