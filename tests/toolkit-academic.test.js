'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../toolkit-academic-core.js');
const near=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const economics=(extra={})=>({...C.economicsDefaults,...extra});
const sample=(extra={})=>({...C.sampleDefaults,...extra});

test('baseline equilibrium, surplus and elasticity match independent arithmetic',()=>{
  const r=C.economics(economics());
  near(r.baseline.quantity,30);near(r.baseline.price,40);near(r.baseline.consumerSurplus,900);near(r.baseline.producerSurplus,450);near(r.baseline.totalSurplus,1350);near(r.baseline.elasticity,-2/3);
  assert.deepEqual(r.baseline,r.changed);assert.equal(r.quantityChange,0);assert.equal(r.priceChange,0);
});
test('demand shift increases quantity and price with slopes unchanged',()=>{
  const r=C.economics(economics({shiftA:20}));near(r.changed.quantity,110/3);near(r.changed.price,140/3);near(r.changed.consumerSurplus,12100/9);near(r.changed.producerSurplus,6050/9);near(r.quantityChange,20/3);near(r.priceChange,20/3);assert.equal(r.changed.b,2);assert.equal(r.changed.d,1);
});
test('positive supply cost shift reduces quantity and raises price',()=>{const r=C.economics(economics({shiftC:15}));near(r.changed.quantity,25);near(r.changed.price,50);near(r.changed.consumerSurplus,625);near(r.changed.producerSurplus,312.5);});
test('no-trade corners have zero quantity/surplus and no invented price',()=>{
  for(const a of [0,10]){const r=C.economics(economics({a})).changed;assert.equal(r.trade,false);assert.equal(r.quantity,0);assert.equal(r.price,null);assert.equal(r.elasticity,null);assert.equal(r.totalSurplus,0);}
  const r=C.economics(economics({shiftC:100}));assert.equal(r.priceChange,null);assert.equal(r.quantityChange,-30);
});
test('all stated numeric economics boundaries produce finite outputs',()=>{
  const r=C.economics(economics({a:1e6,b:.001,c:0,d:.001}));near(r.changed.quantity,5e8);assert.ok(Number.isFinite(r.changed.totalSurplus));
  assert.equal(C.economics(economics({shiftA:-100,shiftC:-10})).changed.quantity,0);
});
test('economics strict state rejects unknown missing nonnumeric and inconsistent shifts',()=>{
  for(const extra of [{extra:'x'},{b:0},{d:-1},{a:Infinity},{c:NaN},{a:'100'},{shiftA:-101},{shiftC:-11},{a:1e6,shiftA:1}])assert.throws(()=>C.cleanEconomics(economics(extra),true));
  for(const raw of [null,[],new Date(),{},Object.create({a:100})])assert.throws(()=>C.cleanEconomics(raw,true));
});
test('economics lenient cleaning recovers malformed saved fields independently',()=>{
  assert.deepEqual(C.cleanEconomics(null),economics());assert.deepEqual(C.cleanEconomics({a:80,b:'x',shiftC:-999,unknown:'ignored'}),economics({a:80}));
});
test('95% known-SD mean precision requires 97 usable observations',()=>{
  const r=C.sampleSize(sample());near(r.z,1.959963984540054,1e-12);assert.equal(r.complete,97);assert.equal(r.recruit,97);assert.equal(r.extra,0);near(r.unrounded,96.03647051735311,1e-10);assert.ok(r.achievedMargin<=2);assert.equal(r.expectedSuccesses,null);
});
test('95% proportion precision requires 385 and 20% expected loss needs 482',()=>{
  const r=C.sampleSize(sample({mode:'proportion',loss:.2}));assert.equal(r.complete,385);assert.equal(r.recruit,482);assert.equal(r.extra,97);near(r.expectedSuccesses,192.5);assert.equal(r.approximationCaution,false);assert.ok(r.achievedMargin<=.05);
});
test('0.5 is the conservative proportion and complementary proportions agree',()=>{
  const a=C.sampleSize(sample({mode:'proportion',proportion:.2})),b=C.sampleSize(sample({mode:'proportion',proportion:.8})),max=C.sampleSize(sample({mode:'proportion'}));assert.equal(a.complete,b.complete);assert.ok(a.complete<max.complete);
});
test('small expected binary counts are flagged, not portrayed as guaranteed coverage',()=>{const r=C.sampleSize(sample({mode:'proportion',proportion:.001,proportionMargin:.5}));assert.equal(r.complete,1);assert.equal(r.approximationCaution,true);near(r.expectedSuccesses,.001);});
test('narrower margins and higher confidence increase required sample',()=>{
  const r=C.sampleSize(sample()),double=C.sampleSize(sample({meanMargin:1}));near(double.unrounded,4*r.unrounded);assert.ok(C.sampleSize(sample({confidence:99})).complete>r.complete);
});
test('loss allowance and count cap are enforced without infinite or unsafe counts',()=>{
  assert.equal(C.sampleSize(sample({loss:.95})).recruit,1940);
  assert.throws(()=>C.sampleSize(sample({sd:1e6,meanMargin:.000001})),/exceeds 10000000/);
});
test('sample strict state rejects missing fields unsafe numbers and unsupported modes',()=>{
  for(const extra of [{unknown:1},{mode:'power'},{confidence:100},{confidence:79},{sd:0},{meanMargin:0},{proportion:0},{proportion:1},{proportionMargin:0},{loss:1},{loss:-.1},{confidence:'95'},{sd:NaN}])assert.throws(()=>C.cleanSample(sample(extra),true));
  for(const raw of [null,[],{},Object.create({mode:'mean'})])assert.throws(()=>C.cleanSample(raw,true));
});
test('sample lenient cleaning retains valid fields and returns safe complete JSON',()=>{
  const r=C.cleanSample({mode:'proportion',proportion:.3,loss:Infinity});assert.deepEqual(r,sample({mode:'proportion',proportion:.3}));assert.deepEqual(JSON.parse(JSON.stringify(r)),r);assert.deepEqual(C.cleanSample([]),sample());
});
test('strict cleaned states are detached from mutable source objects',()=>{
  const raw=economics(),r=C.cleanEconomics(raw,true);raw.a=999;assert.equal(r.a,100);const s=sample(),p=C.cleanSample(s,true);s.sd=999;assert.equal(p.sd,10);
});
