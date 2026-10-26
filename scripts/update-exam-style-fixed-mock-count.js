// One-time update: Exam Centre now exposes Mock Exams 3, 4 and 5.
const fs = require('fs');
const file = 'tests/fhem-exam-style/browser.test.js';
let text = fs.readFileSync(file, 'utf8');
const before = "assert.equal(await page.locator('.exam-v2-fixed-grid .exam-v2-mode').count(), 2);";
const after = "assert.equal(await page.locator('.exam-v2-fixed-grid .exam-v2-mode').count(), 3);";
if (!text.includes(after)) {
  if (!text.includes(before)) throw new Error('Fixed-mock count assertion not found.');
  text = text.replace(before, after);
  fs.writeFileSync(file, text);
  console.log('Updated fixed-mock browser expectation to 3.');
}
