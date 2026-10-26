// One-time correction to the exam-eve separating-equilibrium MCQ scoring.
const fs = require('fs');
const file = 'fhem-exam-eve-data.js';
let text = fs.readFileSync(file, 'utf8');
const before = 'option("E", "L\'s premium is actuarially unfair.", 2, "The contract can be fair for L but still partial; this option confuses pricing with quantity.")';
const after = 'option("E", "L\'s premium is actuarially unfair.", -1, "Incorrect: the low-risk separating contract can be actuarially fair while remaining partial; this option confuses pricing with quantity.")';
if (!text.includes(after)) {
  if (!text.includes(before)) throw new Error('Target exam option was not found.');
  text = text.replace(before, after);
  fs.writeFileSync(file, text);
  console.log('Corrected separating-equilibrium option score.');
} else {
  console.log('Option score already corrected.');
}
