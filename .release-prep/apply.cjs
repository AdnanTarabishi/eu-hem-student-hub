// One bounded test-expectation correction on the isolated preparation branch.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const file='tests/roadmap/browser.test.js';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const before=fs.readFileSync(file,'utf8');
assert.equal(hash(before),'b827f712d5a0efddb05eba17b241c975a52223e1abb537979455589c632f40fe');
assert.equal(before.split('"37Released"').length-1,1);
const after=before.replace('"37Released"','"54Released"');
assert.equal(hash(after),'3122ce404b3b37c73b86b63308689dafb9230d61ce9a4bbaa09e93813e93299d');
fs.writeFileSync(file,after);
console.log('Updated the single stale 37Released assertion to the reviewed 54Released total. No runtime or content changes.');
