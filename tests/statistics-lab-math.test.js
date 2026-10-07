"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../statistics-lab-math.js");
const close = (actual, expected, tolerance = 2e-14) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

test("standard normal CDF reference values and symmetry", () => {
  for (const [z, p] of [[0,.5],[1,.8413447460685429],[2,.9772498680518208],[1.96,.9750021048517795],[3,.9986501019683699]]) {
    close(M.cdf(z), p); close(M.cdf(-z), 1-p); close(M.cdf(z)+M.sf(z),1);
  }
});
test("class example distinguishes full precision from the printed table", () => {
  close(M.standardize(-1,1,1),-2); close(M.standardize(2,1,1),1);
  close(M.between(-2,1),.8185946141203637);
  assert.equal(M.between(-2,1).toFixed(4),"0.8186");
  assert.deepEqual(M.tableCalculation("between",-2,1), {a:-2,b:1,pa:.0228,pb:.8413,p:.8185});
});
test("left, right, between and outside modes", () => {
  close(M.probability("left",-1,1),M.cdf(1));
  close(M.probability("right",-1,1),M.sf(-1));
  close(M.probability("between",-1,1),.6826894921370859);
  close(M.probability("outside",-1,1),.31731050786291415);
});
test("equal bounds and full real line", () => {
  assert.equal(M.between(1,1),0); assert.equal(M.probability("outside",1,1),1);
  assert.equal(M.between(-Infinity,Infinity),1);
  assert.equal(M.cdf(-Infinity),0); assert.equal(M.sf(Infinity),0);
});
test("direct survival calculation preserves small right tails", () => {
  close(M.sf(8)/6.220960574271784e-16,1,2e-13);
  close(M.sf(12)/1.776482112077679e-33,1,3e-13);
  close(M.between(8,9)/6.21983198586583e-16,1,3e-13);
  close(M.between(-9,-8)/M.between(8,9),1,2e-14);
});
test("narrow intervals avoid cancellation", () => {
  const p = M.between(1,1+1e-10);
  close(p/(M.pdf(1)*(1+1e-10-1)),1,2e-10);
});
test("CDF monotonicity and probabilities over a wide grid", () => {
  let prev=0;
  for(let i=-1200;i<=1200;i++) {
    const z=i/100, p=M.cdf(z);
    assert.ok(p>=prev && p>=0 && p<=1);
    close(p+M.sf(z),1);
    prev=p;
  }
});
test("all 800 generated table cells respect complement symmetry", () => {
  for(let i=0;i<400;i++) {
    const z=i/100;
    close(M.cdf(z)+M.cdf(-z),1);
    close(Number(M.cdf(z).toFixed(4))+Number(M.cdf(-z).toFixed(4)),1,1e-12);
  }
});
test("table arithmetic is explicitly rounded", () => {
  assert.equal(M.tableCalculation("left",0,1.96).p,.975);
  assert.equal(M.tableCalculation("right",1.96,0).p,.025);
  assert.equal(M.tableCalculation("outside",-1.96,1.96).p,.05);
  assert.equal(M.tableCalculation("between",-1.955,1.955).a,-1.96);
});
test("input validation rejects invalid models and regions", () => {
  for(const sigma of [0,-1,NaN,Infinity]) assert.throws(()=>M.standardize(2,1,sigma));
  assert.throws(()=>M.cdf(NaN)); assert.throws(()=>M.cdf("1"));
  assert.throws(()=>M.between(2,-1)); assert.throws(()=>M.probability("bad",0,1));
  assert.throws(()=>M.probability("outside",2,-1));
});
