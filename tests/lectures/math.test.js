// Independent known results, including the normal and Cauchy special cases.
const assert = require("node:assert/strict");
const m = require("../../lecture-activities.js");
const close = (actual, expected, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  );
close(m.normalCDF(0), 0.5);
close(m.normalCDF(1.96), 0.9750021048517795, 1e-7);
close(m.normalCDF(-1.5), 0.06680720126885807, 1e-7);
close(m.normalCDF(2) + m.normalCDF(-2), 1);
close(m.tTwoSided(1, 1), 0.5); // t(1) is standard Cauchy.
close(m.criticalValue(0.05, 1), 12.706204736432095);
close(m.criticalValue(0.05, 19), 2.093024054408263);
close(m.criticalValue(0.05), 1.959963984540054, 2e-6);
close(m.criticalValue(0.05, 100000), 1.959987707534609, 2e-7);
for (const n of [1, 3, 10, 30])
  for (const p of [0, 0.01, 0.3, 0.5, 0.99, 1]) {
    const mass = m.binomial(n, p);
    close(
      mass.reduce((s, x) => s + x, 0),
      1,
    );
    close(
      mass.reduce((s, x, k) => s + x * k, 0),
      n * p,
    );
    close(
      mass.reduce((s, x, k) => s + x * (k - n * p) ** 2, 0),
      n * p * (1 - p),
    );
  }
assert.deepEqual(m.binomial(3, 0.5), [0.125, 0.375, 0.375, 0.125]);
const d = m.describe([2, 4, 6]);
close(d.mean, 4);
close(d.variance, 4);
close(d.sd, 2);
close(d.median, 4);
close(m.describe([2, 4, 6, 10]).median, 5);
assert.deepEqual(m.describe([1, 1, 3, 3]).modes, [1, 3]);
close(m.describe([7, 7]).variance, 0);
const example = m.oneMean({
  mean: 5,
  nullMean: 7,
  sd: 3,
  n: 20,
  alpha: 0.05,
  known: false,
});
close(example.statistic, -2.9814239699997196);
close(example.p, 0.007670613445788562);
close(example.lower, 3.5959567807402726);
close(example.upper, 6.404043219259727);
assert.equal(example.df, 19);
assert.equal(example.decision, "Reject H₀");
const nullCase = m.oneMean({
  mean: 7,
  nullMean: 7,
  sd: 3,
  n: 20,
  alpha: 0.05,
  known: false,
});
close(nullCase.p, 1);
assert.equal(nullCase.decision, "Do not reject H₀");
const boundary = m.oneMean({
  mean: 7 + example.critical * example.se,
  nullMean: 7,
  sd: 3,
  n: 20,
  alpha: 0.05,
  known: false,
});
assert.equal(boundary.decision, "Boundary: p = α");
const z = m.oneMean({
  mean: 74,
  nullMean: 70,
  sd: 20,
  n: 100,
  alpha: 0.05,
  known: true,
});
close(z.statistic, 2);
close(z.p, 0.04550026389635842, 2e-7);
close(z.lower, 70.08007203091989, 4e-6);
console.log(
  "Lecture maths passed: normal and Student’s t references, binomial moments, sample summaries, test/CI agreement and boundary handling.",
);
