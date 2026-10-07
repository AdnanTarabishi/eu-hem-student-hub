const assert=require('node:assert/strict');
const fs=require('node:fs');
const labs=require('../../fund-statistics-labs.js');
const math=require('../../fund-statistics-math.js');
const data=require('../../content/modules/fund-statistics/practical-study.json');
const study=require('../../content/modules/fund-statistics/course-study.json');
const review=require('../../content/modules/fund-statistics/source-review.json');
const guides=data.guides,byId=id=>guides.find(g=>g.id===id);
const close=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
assert.equal(guides.length,11);
assert.equal(guides.filter(g=>g.category==='dataset').length,7);
assert.equal(guides.filter(g=>g.category==='report').length,4);
assert.equal(new Set(guides.map(g=>g.id)).size,11);
const topics=require('../../content/modules/fund-statistics/topics.json').map(t=>t.id);
const questionIds=new Set();
for(const g of guides){
  assert.ok(g.citation&&g.files.length&&g.unit&&g.goal);
  assert.equal(g.steps.length,4);assert.equal(g.questions.length,2);
  assert.match(g.url,/^https:\/\/(virtuale\.unibo\.it|doi\.org)\//);
  assert.ok(g.topics.every(t=>topics.includes(t)));
  for(const q of g.questions){
    assert.ok(!questionIds.has(q.id));questionIds.add(q.id);
    assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length);
    assert.ok(q.explanation.trim());
  }
  if(g.intervals)for(const r of g.intervals){
    assert.ok(r.lower<=r.estimate&&r.estimate<=r.upper);
    assert.ok(g.axis.min<=r.lower&&r.upper<=g.axis.max);
    assert.ok(r.meaning);
  }
}
assert.equal(questionIds.size,22);
assert.equal(study.sourceReview.uploads,53);assert.equal(review.files.length,53);
assert.equal(study.sourceReview.uniqueFiles,37);assert.equal(review.files.filter(f=>!f.duplicate).length,37);
assert.equal(study.sourceReview.workbooks,17);assert.equal(review.workbooks.length,17);
assert.equal(review.reports.length,4);
assert.equal(review.files.filter(f=>f.batch===3).reduce((s,f)=>s+(f.pages||0),0),363);
assert.equal(study.missing.length,4);
assert.ok(!JSON.stringify(data).includes('/workspace/'));
// Oracles calculated independently from the uploaded files, not from UI functions.
const oecd=byId('oecd-lab').comparison;
assert.deepEqual(oecd.map(v=>v.n),[38,38,32,38,27,25,37]);
const child=oecd.find(v=>v.variable==='CHILDVACCIN');
close(child.lowerFence,83.1375);close(child.upperFence,105.6375);
assert.deepEqual(child.outliers,['Mexico','Brazil','Argentina']);
assert.equal(child.filtered.n,35);close(child.filtered.mean,94.90571428571428);
assert.equal(oecd.find(v=>v.variable==='HEALTHEXP').filtered.n,36);
const food=byId('food-lab').confidenceExplorer;
const expected=[
  [7.010399993956089,7.190796316614415,5.305461460766523,8.715338527145654],
  [6.170599962174893,5.486619069327297,4.86972202649822,7.471477897851566],
  [10.741999976634979,9.320599193232493,8.532084966215171,12.951914987054787]
];
food.forEach((v,i)=>{
  assert.equal(v.n,50);close(v.mean,expected[i][0]);close(v.sdAdjusted,expected[i][1]);
  close(v.tCritical90,1.6765508926168535);close(v.lower90,expected[i][2]);close(v.upper90,expected[i][3]);
  const r=math.interval({mode:'unknown',n:v.n,mean:v.mean,sd:v.sdAdjusted,confidence:.9});
  close(r.lower,expected[i][2],2e-5);close(r.upper,expected[i][3],2e-5);
  const wider=math.interval({mode:'unknown',n:v.n,mean:v.mean,sd:v.sdAdjusted,confidence:.99});
  assert.equal(wider.estimate,r.estimate);assert.ok(wider.lower<r.lower&&wider.upper>r.upper);
});
assert.deepEqual(food.map(v=>v.zeros),[2,2,4]);
assert.match(byId('food-lab').formulas.at(-1).formula,/VAR.S\(A2:A51\)/);
assert.deepEqual(byId('health-centre-report').intervals[0],{label:'Women',estimate:65.2,lower:63.7,upper:66.7,meaning:'An estimated 65.2% of adult health-centre visits were made by women; the 95% interval is 63.7%–66.7%.'});
assert.equal(byId('medication-report').intervals[0].estimate,88.6);
assert.deepEqual(byId('pisa-report').intervals.map(r=>r.se),[1.6,5.7,3.9,3]);
assert.deepEqual(byId('oecd-performance-report').intervals.map(r=>r.estimate),[.65,.71,.67,.62,.21,.58,.64,.64]);
// Null/invalid choices cannot be treated as checked correct; old and unknown IDs are discarded.
const repaired=labs.repair({version:1,answers:{'oecd-count':{choice:0,checked:true},'oecd-fence':{choice:99,checked:true},'food-critical':{choice:'1',checked:true},extra:{choice:0,checked:true}}},guides);
assert.equal(labs.countCorrect(repaired,guides),1);
assert.deepEqual(repaired.answers['oecd-fence'],{choice:null,checked:false});
assert.equal(Object.keys(repaired.answers).length,22);
assert.equal(labs.countCorrect(labs.repair({version:9,answers:repaired.answers},guides),guides),0);
const all=labs.repair(null,guides);
for(const g of guides)for(const q of g.questions)all.answers[q.id]={choice:q.answer,checked:true};
assert.equal(labs.countCorrect(all,guides),22);
for(const r of guides.filter(g=>g.intervals)){
  const svg=labs.intervalPlot(r.intervals,r.axis,1);
  assert.match(svg,/role="img"/);assert.ok(!/NaN|Infinity/.test(svg));
  assert.equal((svg.match(/<circle /g)||[]).length,r.intervals.length);
}
for(const t of topics){
  const slug=t.split('.').at(-1);
  assert.match(fs.readFileSync(`content/modules/fund-statistics/lectures/${slug}.html`,'utf8'),/fs-lab-connection/);
  assert.match(fs.readFileSync(`content/modules/fund-statistics/notes/${slug}.md`,'utf8'),/#lab-guides/);
}
console.log('Lab/report content passed: 16-file inventory, independent OECD/Food oracles, 4 published interval tables, 22 checks, repaired state and 6 lecture connections.');
