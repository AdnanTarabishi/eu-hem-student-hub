const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'content', 'modules', 'fund-health-economics', 'lectures', 'session-8.html');
let text = fs.readFileSync(file, 'utf8');
const replacements = new Map([
  ['<tr><th scope="row">Standard FFS</th>', '<tr><th scope="row">Standard Fee for Service (FFS)</th>'],
  ['<tr><th scope="row">PPO</th>', '<tr><th scope="row">Preferred Provider Organization (PPO)</th>'],
  ['<tr><th scope="row">POS</th>', '<tr><th scope="row">Point of Service (POS)</th>'],
  ['<tr><th scope="row">HMO</th>', '<tr><th scope="row">Health Maintenance Organization (HMO)</th>'],
]);
for (const [before, after] of replacements) {
  if (!text.includes(before) && !text.includes(after)) throw new Error(`Plan label anchor not found: ${before}`);
  text = text.replace(before, after);
}
fs.writeFileSync(file, text);
console.log('Expanded Session 8 managed-plan labels.');
