// Guard the 9 October review: preserve history, separate released tools from plans,
// and optionally verify every new entry against GitHub's actual deployment record.
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const R=require('../../roadmap-data.js');
const BASE='a0b0001011e04fe5c97010e8e37b2c29fc2df2c7';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const old=JSON.parse(execFileSync('git',['show',`${BASE}:content/updates.json`],{encoding:'utf8'}));
const updates=read('content/updates.json'),roadmap=read('content/roadmap.json');
const oldIds=new Set(old.items.map(i=>i.id)),newItems=updates.items.filter(i=>!oldIds.has(i.id));
for(const item of old.items) assert.deepEqual(updates.items.find(i=>i.id===item.id),item,`Historical record changed: ${item.id}`);
assert.equal(newItems.length,17);assert.equal(updates.items.length,54);
assert.deepEqual(R.publishedUpdates(updates).slice(0,3).map(i=>i.id),['timetable-monthly-progress','universities-directory-galleries','timetable-month-day-teachers']);
console.log('PASS: all 37 historical release records are identical; 17 important releases added in publication order.');
const monthly=newItems.find(i=>i.id==='timetable-monthly-progress');
assert.match(monthly.highlights.join(' '),/scheduled end.*not attendance.*assumed percentage/);
assert.ok(!roadmap.items.some(i=>i.id==='career-application-tracker'));
for(const [id,planner] of [['budget-shared-expenses','four-city-budget'],['mobility-checklists','moving-checklist']]) {
 const item=roadmap.items.find(i=>i.id===id);assert.ok(item.links.some(l=>l.url.includes(`planner=${planner}`)));
 assert.match(item.summary,/already available/);
}
assert.deepEqual([roadmap.release.version,roadmap.release.next.targetDate,roadmap.release.following.target.label,roadmap.vision.progressPercent],['v0.9','2026-10-15','Early November 2026',25]);
const preview=newItems.find(i=>i.id==='future-sections-browsable-previews');assert.match(preview.highlights.join(' '),/structure previews, not live/);
assert.match(newItems.find(i=>i.id==='behind-the-build-effort').highlights.join(' '),/estimate, not an independently measured/);
console.log('PASS: released local tools leave the board; remaining scope and inactive services are described honestly.');
const headers={Accept:'application/vnd.github+json','User-Agent':'euhem-release-verification'};
if(process.env.GH_TOKEN) headers.Authorization=`Bearer ${process.env.GH_TOKEN}`;
(async()=>{
 if(!process.argv.includes('--verify-deployments')) return;
 const cache=new Map();
 for(const item of newItems) {
   const match=item.evidence.deploymentUrl.match(/^https:\/\/github\.com\/AdnanTarabishi\/eu-hem-student-hub\/actions\/runs\/(\d+)$/);assert.ok(match,item.id);
   const id=match[1];
   if(!cache.has(id)) {
     const response=await fetch(`https://api.github.com/repos/AdnanTarabishi/eu-hem-student-hub/actions/runs/${id}`,{headers,signal:AbortSignal.timeout(20000)});
     assert.equal(response.ok,true,`Deployment lookup ${id}: HTTP ${response.status}`);cache.set(id,await response.json());
   }
   const run=cache.get(id);assert.deepEqual([run.name,run.head_branch,run.status,run.conclusion],['pages build and deployment','main','completed','success'],item.id);
   const time=Date.parse(item.evidence.deployedAt);assert.ok(time>=Date.parse(run.created_at)&&time<=Date.parse(run.updated_at),item.id+' deployment time');
   assert.equal(R.dateInRome(item.evidence.deployedAt),item.date);
   for(const commit of item.evidence.commits) execFileSync('git',['merge-base','--is-ancestor',commit.sha,run.head_sha],{stdio:'ignore'});
 }
 console.log(`PASS: ${newItems.length} new entries verified against ${cache.size} successful main-branch deployments and contained commits.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
