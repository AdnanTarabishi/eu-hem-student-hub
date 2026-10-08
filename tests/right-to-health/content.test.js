const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const folder = path.join(root, 'content/modules/right-to-health');
const read = f => JSON.parse(fs.readFileSync(path.join(folder, f), 'utf8'));
const workspace = read('workspace.json');
const topics = read('topics.json'), questions = read('questions.json'), cards = read('flashcards.json'), resources = read('resources.json');
const { expectedMargin, cleanDraft } = require(path.join(root, 'right-to-health.js'));
const sourceIds = new Set(workspace.sources.map(s => s.id));
const oldIds = ['economic-rights','human-rights','non-discrimination','values-ethics','health-systems','european-health-union'].map(s=>'right-to-health.'+s);
test('All six published topic IDs survive', () => oldIds.forEach(id => assert.ok(topics.some(t=>t.id===id))))
test('Ten guides, one unique topic and notes file each', () => { assert.equal(workspace.units.length,10); assert.equal(new Set(topics.map(t=>t.id)).size,10); for(const t of topics) assert.ok(fs.existsSync(path.join(folder,t.notes))); });
test('Every guide has original explanations, 5–10 review points and valid sources', () => {
 for(const u of workspace.units){assert.ok(u.review.length>=5&&u.review.length<=10);assert.equal(u.sections.length,7);for(const s of u.sections){assert.ok(s.paragraphs.every(p=>p.length>80));assert.ok(s.sources.length>0);s.sources.forEach(id=>assert.ok(sourceIds.has(id)));}}
});
test('All 24 source records use HTTPS and have provenance', () => {assert.equal(workspace.sources.length,24);for(const s of workspace.sources){assert.equal(new URL(s.url).protocol,'https:');assert.ok(s.kind&&s.locator&&s.note);}});
test('Resource IDs are aligned with the source library', () => {assert.equal(resources.length,workspace.sources.length);resources.forEach((r,i)=>assert.equal(r.title,workspace.sources[i].title));});
test('80 MCQs, 20 open prompts and 60 flashcards', () => {assert.equal(questions.filter(q=>q.type==='mcq').length,80);assert.equal(questions.filter(q=>q.type==='short-answer').length,20);assert.equal(cards.length,60);});
test('Unique IDs and unambiguous MCQ option arrays', () => {
 assert.equal(new Set([...questions,...cards,...resources].map(x=>x.id)).size,184);
 for(const q of questions){assert.ok(topics.some(t=>t.id===q.topic));assert.ok(q.explanation.includes('Source:'));if(q.type==='mcq'){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.match(q.answer,/^[ABCD]$/);}}
});
test('Each guide has eight MCQs, two open questions and six source-linked cards', () => {for(const t of topics){assert.equal(questions.filter(q=>q.topic===t.id&&q.type==='mcq').length,8);assert.equal(questions.filter(q=>q.topic===t.id&&q.type==='short-answer').length,2);assert.equal(cards.filter(c=>c.topic===t.id).length,6);}cards.forEach(c=>assert.match(c.back, /Sources?:/));});
test('No replicated slides, copyrighted PDFs or external image dependencies in the module', () => { const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(p,d.name)):[path.join(p,d.name)]); for(const p of walk(folder))assert.ok(!/\.(pdf|pptx?|jpg|png|webp)$/i.test(p)); const js=fs.readFileSync(path.join(root,'right-to-health.js'),'utf8');assert.ok(!js.includes('.innerHTML')); });
test('Historical and supplementary limitations are explicit', () => {assert.match(workspace.scope,/Historical/);assert.match(workspace.editorialStatus,/not reviewed/);assert.match(workspace.sources.find(s=>s.id==='austria25').note,/September 2025/);assert.match(workspace.sources.find(s=>s.id==='italian-reading').note,/could not/);});
test('Glossary has 24 unique terms with sources', () => {assert.equal(workspace.glossary.length,24);assert.equal(new Set(workspace.glossary.map(t=>t.term)).size,24);workspace.glossary.forEach(t=>assert.ok(sourceIds.has(t.source)));});
test('Expected claims margin arithmetic handles losses, equality and surpluses', () => {assert.equal(expectedMargin(5500,7000),-1500);assert.equal(expectedMargin(7000,7000),0);assert.equal(expectedMargin(8000,7000),1000);assert.equal(expectedMargin(0,0),0);assert.equal(expectedMargin(10.5,4.25),6.25);});
test('Invalid financial inputs are rejected', () => {for(const x of [NaN,Infinity,-1,1e9,'5500',null,undefined]){assert.equal(expectedMargin(x,7000),null);assert.equal(expectedMargin(5500,x),null);}});
test('Workshop input normalisation handles missing and corrupt data', () => {assert.equal(Object.keys(cleanDraft(null)).length,6);assert.equal(cleanDraft({need:42}).need,'');assert.equal(cleanDraft({need:'abc'}).need,'abc');assert.equal(cleanDraft({need:'x'.repeat(3000)}).need.length,2000);assert.equal(cleanDraft({other:'not retained'}).other,undefined);});
test('Only exact course ID activates the custom integration', () => {const js=fs.readFileSync(path.join(root,'notes-course.js'),'utf8');assert.match(js,/page\.course\.id === "right-to-health"/);assert.match(js,/RightToHealth\.prepare\(read\)/);assert.match(js,/tab === "topics" && !custom/);});
test('Assets are linked before the course initializer and included in the service worker', () => {const html=fs.readFileSync(path.join(root,'course.html'),'utf8');assert.ok(html.indexOf('right-to-health.js')<html.indexOf('src="notes-course.js'));assert.ok(html.includes('right-to-health.css'));const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.ok(sw.includes('"right-to-health.js", "right-to-health.css"'));});

const { renderNote } = require(path.join(root, 'scripts/build-right-to-health-notes.js'));
test('All thirty expanded sections have specific reading locators', () => {
 const expanded=workspace.units.flatMap(u=>u.sections).filter(s=>s.edition==='Expanded reading');
 assert.equal(expanded.length,30);
 for(const section of expanded){assert.match(section.locator,/PDF p/);assert.equal(section.paragraphs.length,2);}
});
test('Native notes are generated exactly from the published reader content', () => {
 for(const u of workspace.units){const t=topics.find(x=>x.id===u.id);assert.equal(fs.readFileSync(path.join(folder,t.notes),'utf8'),renderNote(u,workspace));}
});
test('Twelve unique cases cover all ten published topics', () => {
 assert.equal(workspace.cases.length,12);assert.equal(new Set(workspace.cases.map(c=>c.id)).size,12);
 assert.equal(new Set(workspace.cases.map(c=>c.topic)).size,10);
 for(const c of workspace.cases){assert.ok(topics.some(t=>t.id===c.topic));assert.match(c.id,/^rth-case-\d{2}$/);}
});
test('Every case distinguishes scenario, reasoning, bounded conclusion and sources', () => {
 for(const c of workspace.cases){assert.ok(c.kind&&c.locator&&c.scenario&&c.trap&&c.conclusion);assert.equal(c.steps.length,3);assert.ok(c.steps.every(s=>s.title&&s.text));assert.ok(c.sources.length);c.sources.forEach(id=>assert.ok(sourceIds.has(id)));assert.equal(c.check.options.length,3);assert.equal(new Set(c.check.options).size,3);assert.ok(Number.isInteger(c.check.answer)&&c.check.answer>=0&&c.check.answer<3);assert.ok(c.check.explanation);}
});
test('The two numerical case examples are explicitly invented and use correct bases', () => {
 const ratio=workspace.cases.find(c=>c.id==='rth-case-06');assert.match(ratio.scenario,/invented/i);assert.equal(ratio.check.options[ratio.check.answer],String(3600/4000).padEnd(4,'0'));
 const tariff=workspace.cases.find(c=>c.id==='rth-case-09');assert.match(tariff.scenario,/invented/);assert.equal(tariff.check.options[tariff.check.answer],'€'+(.8*80));assert.match(tariff.steps[1].text,/€86/);
});
test('Published v1 question and flashcard IDs all remain available', () => {
 for(let i=1;i<=60;i++)assert.ok(questions.some(q=>q.id==='right-to-health.q.'+String(i).padStart(3,'0')));
 for(let i=1;i<=40;i++)assert.ok(cards.some(c=>c.id==='right-to-health.fc.'+String(i).padStart(3,'0')));
});
