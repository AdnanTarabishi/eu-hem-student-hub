const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'tests', 'fhe-session-8', 'data.test.js');
let text = fs.readFileSync(file, 'utf8');
text = text.replace(
  'assert.match(guide, /Risk-spreading versus incentive trade-off/);',
  'assert.match(guide, /Second-best result/);',
);
fs.writeFileSync(file, text);
console.log('Adjusted Session 8 guide assertion to the authored second-best wording.');
