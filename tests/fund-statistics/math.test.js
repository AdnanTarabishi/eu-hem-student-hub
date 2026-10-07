const assert=require('node:assert/strict');
const f=require('../../fund-statistics-math.js');
const close=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
// Independent values from hand calculations and scipy.stats (not the site implementation).
const d=f.describe([2,3,3,4,8]);
close(d.mean,4);close(d.descriptiveVariance,4.4);close(d.variance,5.5);close(d.median,3);
assert.deepEqual(d.modes,[3]);
close(f.describe([1,2,3,4]).q1,1.5);close(f.describe([1,2,3,4],'excel').q1,1.75);
assert.deepEqual(f.describe([1,2,2,3,100]).outliers,[100]);
close(f.describe([1,2,2,3,100]).upperWhisker,3);
for(const [replacement,n,variance,adjusted] of [[true,25,4.88,9.76],[false,10,3.66,12.2]]) {
  const s=f.sampling(replacement);assert.equal(s.samples.length,n);close(s.mean,6.2);close(s.variance,variance);close(s.expectedAdjusted,adjusted);
}
const known=f.interval({mode:'known',n:36,mean:80,sd:12});
close(known.se,2);close(known.lower,76.0800720309199,4e-6);close(known.upper,83.9199279690801,4e-6);
const t=f.interval({n:16,mean:12,sd:4,normal:true});
assert.equal(t.df,15);close(t.critical,2.131449545559323);close(t.lower,9.86855045444068);
const w=f.interval({mode:'proportion',n:200,k:120});
close(w.se,.03464101615137755);close(w.lower,.532104855955,1e-6);close(w.upper,.667895144045,1e-6);
assert.match(f.interval({mode:'proportion',n:100,k:5,confidence:.99}).warning,/outside/);
const p=f.proportionTest({n:200,k:120,nullProportion:.5});
close(p.se,.035355339059327376);close(p.statistic,2.82842712474619);close(p.p,.004677734981047266,2e-7);
assert.equal(p.decision,'Reject H₀');
const two=f.twoMeans({n1:160,n2:180,mean1:125,mean2:129,sd1:12,sd2:15});
close(two.se,1.466287829861518);close(two.statistic,-2.727977357881894);close(two.p,.006372398187870522,2e-7);close(two.lower,-6.87387133749789,4e-6);
const reverse=f.twoMeans({n1:180,n2:160,mean1:129,mean2:125,sd1:15,sd2:12});
close(two.p,reverse.p);close(two.lower,-reverse.upper);
assert.equal(f.proportionTest({n:20,k:10,nullProportion:.5}).decision,'Do not reject H₀');
for(const run of [()=>f.describe([1]),()=>f.describe([2,NaN]),()=>f.describe([1e308,1e308]),()=>f.interval({n:16,mean:12,sd:4}),()=>f.interval({n:36,mean:12,sd:4,approximate:true}),()=>f.interval({mode:'proportion',n:20,k:19}),()=>f.interval({mode:'proportion',n:20,k:21}),()=>f.interval({n:36,mean:1,sd:0}),()=>f.proportionTest({n:10,k:3,nullProportion:.1}),()=>f.twoMeans({n1:20,n2:100,mean1:2,mean2:3,sd1:1,sd2:1})]) assert.throws(run);
console.log('Fundamentals maths passed: course/Excel quartiles, exact sampling moments, z/t/Wald intervals, tests, group-order invariance and invalid-input guards.');
