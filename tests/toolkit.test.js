'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const D=require('../toolkit-data.js'),root=path.resolve(__dirname,'..');

test('catalogue contains unique stable identifiers and honest kind totals',()=>{
  assert.equal(D.items.length,70);assert.equal(new Set(D.items.map(t=>t.id)).size,70);
  assert.deepEqual(['builtin','external','planned'].map(k=>D.items.filter(t=>t.kind===k).length),[21,36,13]);
});
test('each entry has a supported category, editorial summary and useful scope',()=>{
  for(const t of D.items){assert.match(t.id,/^[a-z0-9-]+$/);assert.ok(D.categories.some(c=>c.id===t.category&&c.id!=='all'));assert.ok(t.title&&t.summary&&t.note&&t.access);assert.equal(t.includes.length,3);assert.ok(t.includes.every(x=>typeof x==='string'&&x.length>15));}
});
test('exactly 12 records deep-link to actual shared lab modes',()=>{
  const expected=['normal','ztable','quantiles','sampling','confidence','descriptive','tdist','mean-test','proportion-ci','proportion-test','two-means','discrete'];
  const lab=D.items.filter(t=>t.collection==='Statistics Lab');assert.deepEqual(lab.map(t=>t.id),expected);
  for(const t of lab){assert.equal(t.kind,'builtin');assert.equal(new URL(t.href,'https://example.org/').searchParams.get('labtool'),t.id);assert.deepEqual(t.courses,['fundamentals','statistics']);}
});
test('all live internal paths exist without duplicating calculator implementations',()=>{
  for(const t of D.items.filter(t=>t.kind==='builtin')){assert.ok(D.safeHref(t.href));assert.ok(fs.existsSync(path.join(root,t.href.split(/[?#]/)[0])),t.href);}
});
test('planned records have no fake launch URL or release date',()=>{
  for(const t of D.items.filter(t=>t.kind==='planned')){assert.equal(t.href,undefined);assert.equal(t.access,'Not available yet');assert.match(t.note,/No release date/);assert.ok(t.includes.every(x=>x.startsWith('Could')));}
});
test('budget planner names the four correct programme cities',()=>{
  const t=D.byId.get('four-city-budget');assert.deepEqual(t.cities,['bologna','oslo','innsbruck','rotterdam']);assert.match(t.includes.join(' '),/Bologna, Oslo, Innsbruck and Rotterdam/);assert.equal(t.kind,'planned');
});
test('every external service has a safe provider source and dated editorial review',()=>{
  for(const t of D.items.filter(t=>t.kind==='external')){assert.ok(D.safeHref(t.href,true));assert.ok(D.safeHref(t.source,true));assert.equal(t.reviewed,'2026-10-07');assert.equal(t.access,'Check provider access');}
});
test('all icons exist in the shared sprite',()=>{
  const sprite=fs.readFileSync(path.join(root,'icons.svg'),'utf8');for(const name of new Set([...D.items.map(t=>t.icon),...D.categories.map(c=>c.icon)]))assert.ok(sprite.includes(`id="${name}"`),name);
});
test('safeHref rejects executable, protocol-relative and mixed local paths',()=>{
  for(const v of ['javascript:alert(1)','//example.org','https://example.org','../../admin.html','toolkit.html\\evil','toolkit.html?q=<img>','toolkit.html?q=a b',null])assert.equal(D.safeHref(v),false);
  assert.equal(D.safeHref('statistics-lab.html?labtool=normal'),true);assert.equal(D.safeHref('index.html#about'),true);
});
test('external URLs require https and no credentials',()=>{
  for(const v of ['http://example.org','javascript:alert(1)','//example.org','https://user:pass@example.org','https://exa mple.org',null])assert.equal(D.safeHref(v,true),false);
  assert.equal(D.safeHref('https://example.org/data?x=1',true),true);
});
test('cleanState allowlists all query-controlled fields',()=>{
  const r=D.cleanState({category:'evil',kind:'api',course:'bad',sort:'constructor',view:'other',saved:'true',q:'x'.repeat(300)});assert.deepEqual({...r,q:''},{q:'',category:'all',kind:'all',course:'all',sort:'curated',view:'grid',saved:false,city:'all',fresh:false});assert.equal(r.q.length,160);
});
test('filters combine by intersection',()=>{
  const result=D.selectItems({kind:'external',category:'cities'});assert.equal(result.length,6);assert.ok(result.every(t=>t.kind==='external'&&t.category==='cities'));
  assert.equal(D.selectItems({kind:'external',course:'fundamentals'}).length,0);
});
test('each word must match search text, including method tags',()=>{
  assert.ok(D.selectItems({q:'variance sample'}).some(t=>t.id==='descriptive'));assert.equal(D.selectItems({q:'variance zzzz-no-match'}).length,0);
  assert.equal(D.selectItems({q:'Statistics Lab',kind:'builtin'}).length,12);
});
test('provider search supports accents, old and new names',()=>{
  assert.ok(D.selectItems({q:'OBB'}).some(t=>t.id==='oebb'));assert.ok(D.selectItems({q:'NotebookLM'}).some(t=>t.id==='notebooklm'));assert.ok(D.selectItems({q:'Gemini'}).some(t=>t.id==='notebooklm'));
});
test('saved filter includes only requested known entries',()=>{
  assert.deepEqual(D.selectItems({saved:true},['zotero','does-not-exist']).map(t=>t.id),['zotero']);assert.equal(D.selectItems({saved:true},[]).length,0);
});
test('A-Z sort is deterministic and does not mutate the base catalogue',()=>{
  const ids=D.items.map(t=>t.id),sorted=D.selectItems({sort:'az'});assert.equal(sorted[0].id,'9292');for(let i=1;i<sorted.length;i++)assert.ok(sorted[i-1].title.localeCompare(sorted[i].title,'en')<=0);assert.deepEqual(D.items.map(t=>t.id),ids);
});
test('cleanPreferences removes unknown fields and deduplicates IDs',()=>{
  const result=D.cleanPreferences({saved:['zotero','zotero','evil',{},'normal'],secret:'private',rememberRecent:false,recent:['zotero']});assert.deepEqual(result,{version:1,saved:['zotero','normal'],rememberRecent:false,recent:[]});
});
test('recent history is off by default and only explicit boolean true enables it',()=>{
  for(const raw of [null,[],{},'bad',{rememberRecent:'true',recent:['normal']}])assert.equal(D.cleanPreferences(raw).rememberRecent,false);
});
test('recent history contains at most six available IDs, never future plans',()=>{
  const r=D.cleanPreferences({rememberRecent:true,recent:['four-city-budget','normal','normal',...D.items.map(t=>t.id)]});assert.equal(r.recent.length,6);assert.equal(new Set(r.recent).size,6);assert.ok(r.recent.every(id=>D.byId.get(id).kind!=='planned'));
});
test('navigation, Resources landing and privacy documentation include the feature',()=>{
  assert.match(fs.readFileSync(path.join(root,'site-nav.js'),'utf8'),/key: "toolkit"/);assert.match(fs.readFileSync(path.join(root,'notes.html'),'utf8'),/href="toolkit.html"/);assert.match(fs.readFileSync(path.join(root,'privacy.html'),'utf8'),/Toolkit/);
});
test('service worker precaches the four feature assets and they exist',()=>{
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');for(const name of ['toolkit.html','toolkit.css','toolkit.js','toolkit-data.js']){assert.ok(sw.includes('"'+name+'"'));assert.ok(fs.existsSync(path.join(root,name)));}
});
test('hero media are present and every one has an attribution',()=>{
  const html=fs.readFileSync(path.join(root,'toolkit.html'),'utf8');const photos=[...html.matchAll(/src="(assets\/images\/cities\/[^\"]+)"/g)].map(m=>m[1]);assert.equal(photos.length,4);photos.forEach(p=>assert.ok(fs.existsSync(path.join(root,p))));for(const n of ['Vanni Lazzari','Øyvind Holmstad','wuppertaler','Trougnouf'])assert.ok(html.includes(n));
});
