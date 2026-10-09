// One-time review preparation on an isolated branch. Never modifies main.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const spec=JSON.parse(fs.readFileSync('.release-prep/changes.json','utf8'));
spec.releases=JSON.parse(fs.readFileSync('.release-prep/releases.json','utf8'));
const allowed=['content/updates.json','content/roadmap.json','tests/roadmap/data.test.js','tests/roadmap/browser.test.js','README.md','docs/roadmap.md'];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.deepEqual(Object.keys(spec.inputHashes).sort(),[...allowed].sort());
assert.deepEqual(Object.keys(spec.outputHashes).sort(),[...allowed].sort());
const texts={};
for(const file of allowed) {texts[file]=fs.readFileSync(file,'utf8');assert.equal(hash(texts[file]),spec.inputHashes[file],`Input changed: ${file}`);}
const updates=JSON.parse(texts['content/updates.json']),old=structuredClone(updates.items);
assert.equal(old.length,37);assert.equal(spec.releases.length,17);
assert.equal(new Set([...old,...spec.releases].map(i=>i.id)).size,54);
for(const item of spec.releases) {assert.equal(item.status,'published');assert.ok(item.evidence && item.evidence.commits.length);}
updates.items=[...spec.releases,...updates.items];updates.updatedAt=spec.reviewedAt;
assert.deepEqual(updates.items.slice(17),old);
texts['content/updates.json']=JSON.stringify(updates,null,2)+'\n';
const roadmap=JSON.parse(texts['content/roadmap.json']),originalRelease=JSON.stringify(roadmap.release),originalVision=JSON.stringify(roadmap.vision);
assert.deepEqual(spec.removePlans,['career-application-tracker']);
roadmap.updatedAt=spec.reviewedAt;roadmap.items=roadmap.items.filter(i=>!spec.removePlans.includes(i.id));
for(const id of Object.keys(spec.planEdits)) {const item=roadmap.items.find(i=>i.id===id);assert.ok(item,`Unknown plan ${id}`);Object.assign(item,spec.planEdits[id]);}
roadmap.limitations.items.push(...spec.extraLimits);
assert.equal(JSON.stringify(roadmap.release),originalRelease);assert.equal(JSON.stringify(roadmap.vision),originalVision);
assert.equal(roadmap.items.length,18);
texts['content/roadmap.json']=JSON.stringify(roadmap,null,2)+'\n';
for(const [file,changes] of Object.entries(spec.textChanges)) {
  assert.ok(allowed.includes(file));
  for(const c of changes) {
    if(c.regex) {
      assert.equal(c.old,'\\b37\\b');const re=new RegExp(c.old,'g');assert.equal([...texts[file].matchAll(re)].length,c.count);texts[file]=texts[file].replace(re,()=>c.new);
    } else {assert.ok(c.old.length && c.count>0);assert.equal(texts[file].split(c.old).length-1,c.count,`Unexpected match count: ${file}`);texts[file]=texts[file].split(c.old).join(c.new);}
  }
}
texts['docs/roadmap.md']+=spec.docAppend;
// Prepare all outputs in memory and validate before writing any file.
for(const file of allowed) assert.equal(hash(texts[file]),spec.outputHashes[file],`Unexpected output: ${file}`);
for(const file of allowed) fs.writeFileSync(file,texts[file]);
console.log('Prepared exactly six reviewed files; all 37 historical records, release targets and the owner estimate are unchanged.');
