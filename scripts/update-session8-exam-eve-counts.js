// One-time update: Session 8 browser expectations after exam-eve runtime expansion.
const fs = require('fs');
const file = 'tests/fhe-session-8/browser.test.js';
let text = fs.readFileSync(file, 'utf8');
const replacements = [
  ["'26 practice questions'", "'27 practice questions'"],
  ["#question-map button').count(), 26", "#question-map button').count(), 27"],
  ["/50 flashcards/", "/52 flashcards/"],
  ["/42 questions/", "/44 questions/"],
];
for (const [before, after] of replacements) {
  if (text.includes(after)) continue;
  if (!text.includes(before)) throw new Error(`Missing expected test fragment: ${before}`);
  text = text.replace(before, after);
}
fs.writeFileSync(file, text);
console.log('Updated Session 8 runtime expansion counts.');
