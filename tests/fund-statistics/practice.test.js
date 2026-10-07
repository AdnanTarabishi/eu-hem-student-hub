const assert=require('node:assert/strict');
const p=require('../../fund-statistics-practice.js'),f=require('../../fund-statistics-math.js');
const extension=require('../../content/modules/fund-statistics/extended-practice.json');
const cards=require('../../content/modules/fund-statistics/flashcards.json');
const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const byId=id=>extension.cases.find(c=>c.id===id);
assert.equal(extension.cases.length,12);assert.equal(new Set(extension.cases.map(c=>c.id)).size,12);
for(const c of extension.cases){
  assert.equal(c.fields.length,3);assert.equal(c.steps.length,4);assert.equal(c.rubric.length,3);
  assert.ok(c.source&&c.reflection&&c.model&&c.excel.length>=2);
  for(const field of c.fields){
    assert.equal(p.grade(String(field.answer),field),'correct');
    assert.equal(p.grade(String(field.answer+field.tolerance*1.1),field),'revisit');
    for(const value of ['','  '])assert.equal(p.grade(value,field),'empty');
    for(const value of ['bad','Infinity','1e999','1e13'])assert.equal(p.grade(value,field),'invalid');
  }
}
assert.equal(cards.length,100);
for(const topic of new Set(extension.cases.map(c=>c.topic))){
  assert.equal(extension.cases.filter(c=>c.topic===topic).length,2);
  assert.equal(cards.filter(c=>c.topic===topic&&Number(c.id.split('.').at(-1))<=84).length,14);
}
// Independent hand/scipy oracles substantiate the answer keys and plotted/calculator reuse.
const expected={
  'stay-summary':[5,3.5,6], 'extreme-stay':[9,4,111.2], 'visit-model':[1.6,.84,.5],
  'normal-wait':[.06680720126885807,.7745375447996848,39.86912176170883],
  'mean-versus-person':[3,.022750131948179195,.3445782583896758],
  'adjusted-variance':[5,20/3,1.2909944487358056],
  'mean-interval':[4.262899091119552,49.73710090888045,58.26289909111955],
  'proportion-interval':[.028982753492378877,.6431948469821349,.756805153017865],
  'mean-test':[2,2,.04550026389635839],
  'proportion-test':[.64,1.4142135623730951,.15729920705028502],
  'two-clinics':[-3,.7071067811865476,-4.242640687119285],
  'uncertain-difference':[.15729920705028502,-4.771807648699356,.7718076486993559]
};
for(const [id,values] of Object.entries(expected))byId(id).fields.forEach((field,i)=>close(field.answer,values[i]));
const d=f.describe([1,2,2,3,4,6,10,12]);close(d.mean,5);close(d.median,3.5);close(d.iqr,6);
close(f.describe([1,2,2,3,4,6,10,12],'excel').iqr,5);
close(f.describe([2,4,4,5,30]).descriptiveVariance,111.2);
const interval=f.interval({mode:'unknown',n:16,mean:54,sd:8,normal:true});
close(interval.lower,expected['mean-interval'][1]);close(interval.upper,expected['mean-interval'][2]);
const proportion=f.proportionTest({n:300,k:192,nullProportion:.6});
close(proportion.p,expected['proportion-test'][2],2e-7);assert.equal(proportion.decision,'Do not reject H₀');
const contrast=f.twoMeans({n1:64,n2:100,mean1:45,mean2:47,sd1:8,sd2:10});
close(contrast.p,expected['uncertain-difference'][0],2e-7);close(contrast.lower,expected['uncertain-difference'][1],4e-6);
// Saved-state repair keeps useful answers but cannot trust corrupted flags or HTML.
const repaired=p.repair({version:1,cases:{'stay-summary':{answers:['5','x'.repeat(90),23],checked:[true,'yes'],reflection:'x'.repeat(5000),rubric:[true,1],solution:true}}},extension.cases);
assert.deepEqual(repaired.cases['stay-summary'].answers,['5','','']);
assert.deepEqual(repaired.cases['stay-summary'].checked,[true,false,false]);
assert.equal(repaired.cases['stay-summary'].reflection.length,4000);
assert.deepEqual(repaired.cases['stay-summary'].rubric,[true,false,false]);
assert.equal(p.countCorrect(repaired,extension.cases),1);
assert.equal(p.countCorrect(p.repair({version:9},extension.cases),extension.cases),0);
// Method choices are constrained by design, not simply by the sample-size dropdown.
const input={target:'mean',goal:'interval',n:16,independent:true,normal:true};
assert.match(p.method(input).title,/unknown-σ t/);assert.match(p.method(input).steps[1],/df=15/);
assert.match(p.method({...input,known:true}).title,/known-σ z/);
assert.equal(p.method({...input,normal:false}).ready,false);
assert.equal(p.method({...input,independent:false}).ready,false);
assert.equal(p.method({...input,n:NaN}).ready,false);
assert.equal(p.method({...input,n:16.5}).ready,false);
assert.match(p.method({...input,n:120,normal:false}).title,/unknown-σ t/);
const binary={target:'proportion',goal:'interval',n:100,k:95,independent:true};
assert.equal(p.method(binary).ready,true);assert.match(p.method(binary).warning,/more conservative/);
assert.equal(p.method({...binary,k:96}).ready,false);
assert.equal(p.method({...binary,k:101}).ready,false);
// Different count checks really matter: sparse observed successes can pass a null test check.
assert.equal(p.method({...binary,k:1,goal:'test',nullProportion:.5}).ready,true);
assert.equal(p.method({...binary,k:50,goal:'test',nullProportion:.99}).ready,false);
assert.equal(p.method({...binary,goal:'test',nullProportion:1}).ready,false);
assert.match(p.method({...binary,goal:'test',nullProportion:.5}).steps[1],/null π₀/);
const independent={target:'two-means',goal:'test',n:40,n2:60,independent:true};
assert.equal(p.method(independent).ready,true);assert.match(p.method(independent).warning,/additional/);
assert.equal(p.method({...independent,n2:20}).ready,false);
assert.match(p.method({...independent,target:'paired'}).warning,/illustrative/);
assert.equal(p.method({...independent,target:'paired'}).ready,false);
console.log('Extended practice passed: 12 independent answer keys, 36 grading checks, repaired progress, count/design guards and 100 review cards.');
