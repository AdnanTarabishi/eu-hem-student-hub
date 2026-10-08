'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../toolkit-solve-core'),F=require('../toolkit-formulas'),D=require('../toolkit-data');
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const input={course:'fundamentals',goal:'test',outcome:'numeric',groups:'one',design:'independent',n:25,n2:30,model:'reasonable',sd:'sample',k:12,p0:.5};
const v={ca:14000,cb:10000,ea:2.4,eb:2,lambda:20000};
test('unknown SD uses one-sample t, not automatic z at n=30',()=>{for(const n of [2,25,30,120,10001]){const r=C.chooseMethod({...input,n});assert.match(r.title,/One-sample t/);assert.match(r.href,/sl3_mean-test_method=t/);}});
test('known population SD uses z and permits n=1 under stated normal model',()=>{const r=C.chooseMethod({...input,sd:'known',n:1});assert.match(r.title,/Known-SD z/);assert.match(r.href,/sl3_mean-test_method=z/);});
test('mean interval routes to correct t or z, exact n preset',()=>{for(const sd of ['sample','known']){const r=C.chooseMethod({...input,goal:'estimate',sd});const q=new URL(r.href,'https://x/').searchParams;assert.equal(q.get('labtool'),'confidence');assert.equal(q.get('st_confidence_method'),sd==='sample'?'t':'z');assert.equal(q.get('st_confidence_n'),'25');}});
test('paired t is explicitly on differences and marked supplementary',()=>{const r=C.chooseMethod({...input,groups:'two',design:'paired'});assert.match(r.title,/Paired/);assert.equal(r.status,'supplementary');assert.match(r.checks.join(' '),/SD of DIFFERENCES/);assert.match(r.href,/labtool=mean-test/);});
test('paired mean interval reuses one-mean interval on pair differences',()=>{const r=C.chooseMethod({...input,groups:'two',design:'paired',goal:'estimate'});assert.match(r.title,/paired-difference interval/);assert.match(r.href,/labtool=confidence/);});
test('Fundamentals independent means use its large-sample course method',()=>{const r=C.chooseMethod({...input,groups:'two',n:30,n2:31});assert.match(r.href,/sl3_two-means_method=course-z/);assert.match(r.checks.join(' '),/heuristic/);});
test('other independent mean comparisons use explicitly supplementary Welch',()=>{for(const state of [{groups:'two',n:20},{groups:'two',n:100,course:'statistics'}]){const r=C.chooseMethod({...input,...state});assert.match(r.href,/sl3_two-means_method=welch/);assert.equal(r.status,'supplementary');}});
test('count/ordinal or complex/multi-group designs cannot launch mismatched calculators',()=>{for(const state of [{outcome:'other'},{groups:'many'},{design:'complex'},{design:'unsure'},{model:'poor'},{model:'uncertain'},{sd:'unsure'},{design:'paired',groups:'one'}]){const r=C.chooseMethod({...input,...state});assert.equal(r.href,null);}});
test('two binary groups are never routed to two MEANS calculator',()=>{for(const design of ['independent','paired'])assert.equal(C.chooseMethod({...input,outcome:'binary',groups:'two',design}).href,null);});
test('Wald interval count rule uses observed counts; Wilson fallback is labelled',()=>{const r=C.chooseMethod({...input,goal:'estimate',outcome:'binary',n:100,k:4});assert.equal(r.status,'supplementary');assert.match(r.href,/method=wilson/);assert.match(C.chooseMethod({...input,goal:'estimate',outcome:'binary',n:100,k:5}).href,/method=wald/);});
test('proportion test uses null expected counts, not observed counts',()=>{const state={...input,outcome:'binary',n:100,k:1};assert.match(C.chooseMethod(state).href,/labtool=proportion-test/);assert.equal(C.chooseMethod({...state,k:50,p0:.001}).href,null);});
test('design controls are strict; numeric inputs and solver bounds are validated',()=>{for(const state of [{n:0},{n:2.5},{n:NaN},{n:'25'},{outcome:'evil'},{groups:'bad'},{sd:'bad'},{course:'x'},{goal:'x'},{outcome:'binary',k:26},{outcome:'binary',p0:0},{outcome:'binary',p0:1}])assert.throws(()=>C.chooseMethod({...input,...state}));assert.equal(C.chooseMethod({...input,n:10002}).href,null);assert.equal(C.chooseMethod({...input,groups:'two',course:'statistics',n:6000}).href,null);});
test('descriptive and probability goals do not require irrelevant inference fields',()=>{assert.match(C.chooseMethod({goal:'describe',course:'statistics'}).href,/labtool=descriptive/);assert.match(C.chooseMethod({goal:'probability',course:'fundamentals'}).href,/labtool=normal/);});
test('lab links preserve course and reject unsafe or unknown presets',()=>{assert.match(C.labURL('normal','statistics'),/course=quant-methods/);assert.throws(()=>C.labURL('javascript:foo'));assert.throws(()=>C.labURL('normal','bad'));assert.throws(()=>C.labURL('normal','statistics',{'evil':'x'}));});
test('intent matching is topic-only, bounded and fails honestly',()=>{assert.equal(C.matchIntent('nonsense kdjje').length,0);assert.ok(C.matchIntent('Excel formula variance').some(x=>x.target==='excel'));assert.ok(C.matchIntent('paired before after').some(x=>x.id==='pair'));assert.ok(C.matchIntent('discount present value').some(x=>x.id==='discount'));assert.ok(C.matchIntent('ICER QALY net monetary mean test confidence').length<=3);assert.deepEqual(C.matchIntent(''),[]);});
test('CEA incremental arithmetic and net benefit example',()=>{const r=C.costEffectiveness(v);near(r.dc,4000);near(r.de,.4);near(r.icer,10000);near(r.nmb,4000);assert.equal(r.preference,'A');near(r.nhb,.2);});
test('all quadrants including negative ICER traps are correctly labelled',()=>{const cases=[{ca:8000,ea:2.4,rel:'dominates',choice:'A'},{ca:14000,ea:1.6,rel:'dominated',choice:'B'},{ca:8000,ea:1.8,rel:'SW',choice:'B'}];for(const c of cases){const r=C.costEffectiveness({...v,...c});assert.ok(r.relation.includes(c.rel));assert.equal(r.preference,c.choice);}});
test('southwest threshold decision reverses the naive ICER comparison',()=>{const r=C.costEffectiveness({...v,ca:8000,ea:1.8});near(r.icer,10000);assert.equal(r.preference,'B');assert.equal(C.costEffectiveness({...v,ca:8000,ea:1.8,lambda:5000}).preference,'A');});
test('zero effect difference never divides and equal cases are explicit',()=>{const r=C.costEffectiveness({...v,ea:2});assert.equal(r.icer,null);assert.equal(r.preference,'B');const same=C.costEffectiveness({...v,ca:10000,ea:2});assert.equal(same.preference,'tie');assert.match(same.relation,/Same/);});
test('lambda zero permits cost-only NMB but has no NHB',()=>{const r=C.costEffectiveness({...v,lambda:0});assert.equal(r.nhb,null);assert.equal(r.nmb,-4000);assert.equal(r.preference,'B');});
test('numerical threshold equality is labelled tie',()=>{assert.equal(C.costEffectiveness({...v,lambda:10000}).preference,'tie');});
test('switching comparator reverses incremental quantities and preference',()=>{const a=C.costEffectiveness(v),b=C.costEffectiveness({ca:v.cb,cb:v.ca,ea:v.eb,eb:v.ea,lambda:v.lambda});near(a.dc,-b.dc);near(a.de,-b.de);near(a.nmb,-b.nmb);assert.equal(b.preference,'B');});
test('CEA rejects invalid numeric types rates and magnitudes',()=>{for(const extra of [{ca:NaN},{cb:Infinity},{lambda:-1},{lambda:1e10},{ea:1e7},{ca:'14000'}])assert.throws(()=>C.costEffectiveness({...v,...extra}));});
test('QALYs integrate segmented time and allow negative utility',()=>{const r=C.qaly([[2,.8,.7],[3,.6,.5]]);near(r.a,3.4);near(r.b,2.9);near(r.difference,.5);assert.equal(r.time,5);near(C.qaly([[1,-.2,0]]).a,-.2);});
test('QALY validation horizon and utility limits',()=>{for(const rows of [[],[[0,.8,.7]],[[1,1.1,.7]],[[151,.8,.7]],[[100,.8,.7],[100,.8,.7]],[[1,.8]],[[1,NaN,0]]])assert.throws(()=>C.qaly(rows));});
test('discounting preserves t=0 and explicit missing years',()=>{const r=C.discount([[0,1000,0],[5,1000,1]],.03,.01);near(r.cost,1000+1000/(1.03**5));near(r.effect,1/(1.01**5));assert.equal(r.rawCost,2000);});
test('discount independent rates zero signed flows and row ordering',()=>{const r=C.discount([[3,-100,1],[0,1000,0],[1,200,1]],0,0);assert.equal(r.cost,1100);assert.equal(r.effect,2);assert.deepEqual(r.rows.map(x=>x.year),[0,1,3]);});
test('discount rejects repeated years fractional times and rates outside limits',()=>{for(const rows of [[[1,1,1],[1,2,1]],[[1.5,1,1]],[[101,1,1]],[[0,1]]])assert.throws(()=>C.discount(rows,.03,.03));assert.throws(()=>C.discount([[0,1,1]],-1,.03));});
test('economic numeric parser rejects missing rows and nonnumeric headers',()=>{for(const text of ['','year,cost,effect','1,,2','1\t\t2','1,2','1,Infinity,0','1,<script>,0','1,2,3\n\n2,3,4'])assert.throws(()=>C.parseRows(text,3));assert.deepEqual(C.parseRows('1; -2.5; 3e-2',3),[[1,-2.5,.03]]);});
test('52 unique Excel recipes have worked examples and primary sources',()=>{assert.equal(F.recipes.length,52);assert.equal(F.byId.size,52);for(const r of F.recipes){assert.ok(r.why&&r.setup&&r.caution&&r.source.startsWith('https://'));assert.ok(Number.isFinite(r.expected));assert.ok(F.formatFormula(r.template).startsWith('='));}});
test('range validation uses actual Excel column/row limits',()=>{for(const x of ['A2:A8','$A$2:$A$8','XFD1048576','a1:b5'])assert.ok(F.validRange(x));for(const x of ['XFE1','A1048577','A0','A8:A2','B1:A2','Sheet!A1','A1+1','A1;HYPERLINK("x")','//x',''])assert.equal(F.validRange(x),false);});
test('custom range substitution is exact and can be absolute',()=>{assert.equal(F.formatFormula('=AVERAGE({R})',{range:'$C$2:$C$9'}),'=AVERAGE($C$2:$C$9)');assert.throws(()=>F.formatFormula('=AVERAGE({R})',{range:'bad'}));});
test('formula locale conversion preserves names and quoted punctuation',()=>{assert.equal(F.formatFormula('=IF(0.5>0,"No, 0.5",NORM.DIST(2,1.5,1,TRUE))',{separator:';',decimal:','}),'=IF(0,5>0;"No, 0.5";NORM.DIST(2;1,5;1;TRUE))');assert.throws(()=>F.formatFormula('=SUM(1,2)',{separator:',',decimal:','}));});
test('formula search combines topic and words, with meaningful no match',()=>{assert.ok(F.search('variance','Describe').length>=2);assert.equal(F.search('variance','Health economics').length,0);assert.equal(F.search('<script>').length,0);});
test('high-risk recipe distinctions are present',()=>{assert.match(F.byId.get('ci-t').why,/half-width/);assert.match(F.byId.get('normal-density').why,/not a tail/);assert.match(F.byId.get('npv').template,/^-?=-1000\+NPV/);assert.match(F.byId.get('t-critical').template,/0.05/);assert.match(F.byId.get('paired-test').template,/,2,1\)/);assert.match(F.byId.get('welch-test').template,/,2,3\)/);});
test('Solve tools retain working routes and their original personal-list IDs',()=>{for(const id of ['test-finder','excel-assistant','health-economics-calculator']){const t=D.byId.get(id);assert.equal(t.kind,'builtin');assert.match(t.href,/section=solve/);}assert.equal(D.items.length,70);});
test('new runtime assets are referenced before their entry point and precached',()=>{const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'toolkit.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');for(const f of ['toolkit-solve-core.js','toolkit-formulas.js','toolkit-solve.js','toolkit-solve.css']){assert.ok(html.includes(f));assert.ok(sw.includes('"'+f+'"'));}assert.ok(html.indexOf('toolkit-solve-core.js')<html.indexOf('src="toolkit-solve.js'));});

// Independent numerical reproduction of every fixed recipe. These are not
// Excel execution tests: reference arithmetic reuses our separately tested
// normal/t kernels instead of the SciPy code used to prepare the examples.
const N=require('../statistics-lab-math'),M=require('../statistics-lab-tools-math');
const a=[12,14,14,17,21,24,28],b=[11,13,15,16,20,23,27],d=M.describe(a),e=M.describe(b),delta=M.describe(a.map((x,i)=>x-b[i]));
const fact=n=>{let p=1;for(let i=2;i<=n;i++)p*=i;return p;};
const bp=k=>fact(10)/fact(k)/fact(10-k)*.2**k*.8**(10-k);
const pp=k=>Math.exp(-3)*3**k/fact(k);
const covariance=a.reduce((s,x,i)=>s+(x-d.mean)*(b[i]-e.mean),0);
const tWelch=(d.mean-e.mean)/Math.sqrt(d.sampleVariance/7+e.sampleVariance/7);
const welchDF=(d.sampleVariance/7+e.sampleVariance/7)**2/((d.sampleVariance/7)**2/6+(e.sampleVariance/7)**2/6);
const references={
  count:d.n,sum:d.sum,mean:d.mean,median:d.median,mode:14,min:d.min,max:d.max,
  'var-s':d.sampleVariance,'var-p':d.popVariance,'sd-s':d.sampleSD,'sd-p':d.popSD,devsq:d.ss,range:d.range,
  'q1-inc':d.q1,'q3-inc':d.q3,'q1-exc':M.describe(a,'exclusive').q1,'q3-exc':M.describe(a,'exclusive').q3,
  iqr:d.iqr,p90:M.quantile(a,.9),se:d.sampleSD/Math.sqrt(7),standardize:N.standardize(2,1,1),
  'normal-left':N.cdf(1),'normal-right':N.sf(1),'normal-between':N.between(-2,1),'normal-density':N.pdf(0),
  'normal-inverse':2*M.normalInv(.05),'z-left':N.cdf(1.96),'z-critical':M.normalInv(.975),
  't-left':M.tCDF(2,9),'t-right':M.tSF(2,9),'t-two':2*M.tSF(2,9),'t-critical':M.tInv(.975,24),
  'binomial-exact':bp(3),'binomial-cdf':[0,1,2,3].reduce((s,k)=>s+bp(k),0),
  'poisson-exact':pp(2),'poisson-cdf':[0,1,2].reduce((s,k)=>s+pp(k),0),
  'ci-t':M.tInv(.975,24)*2,'ci-z':M.normalInv(.975)*2,
  'paired-test':2*M.tSF(Math.abs(delta.mean/(delta.sampleSD/Math.sqrt(7))),6),
  'welch-test':2*M.tSF(Math.abs(tWelch),welchDF),
  'proportion-ci-se':Math.sqrt(.6*.4/200),'proportion-null-se':Math.sqrt(.5*.5/200),
  'delta-cost':4000,'delta-effect':.4,icer:10000,inmb:4000,qaly:2.4,
  discount:1000/1.03**5,npv:-1000+[1,2,3].reduce((s,t)=>s+400/1.03**t,0),
  weighted:a.reduce((s,x,i)=>s+x*b[i],0)/b.reduce((s,x)=>s+x,0),correlation:covariance/Math.sqrt(d.ss*e.ss),slope:covariance/d.ss
};
for(const r of F.recipes)test(`fixed Excel example independently reproduced: ${r.id}`,()=>{
  assert.ok(Object.hasOwn(references,r.id));
  const tolerance=2e-10*Math.max(1,Math.abs(r.expected));near(references[r.id],r.expected,tolerance);
});
