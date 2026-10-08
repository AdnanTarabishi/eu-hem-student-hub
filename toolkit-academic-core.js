/* Academic Toolkit: bounded, original teaching calculations; no storage or API. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./statistics-lab-tools-math.js'));
  else root.StudentToolkitAcademicCore = factory(root.StatisticsLabToolsMath);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';
  const economicsDefaults = Object.freeze({a:100,b:2,c:10,d:1,shiftA:0,shiftC:0});
  const sampleDefaults = Object.freeze({mode:'mean',confidence:95,sd:10,meanMargin:2,proportion:.5,proportionMargin:.05,loss:0});
  const economicsLimits = Object.freeze({a:[0,1e6],b:[.001,1e6],c:[0,1e6],d:[.001,1e6],shiftA:[-1e6,1e6],shiftC:[-1e6,1e6]});
  const sampleLimits = Object.freeze({confidence:[80,99.9],sd:[.000001,1e6],meanMargin:[.000001,1e6],proportion:[.001,.999],proportionMargin:[.0001,.5],loss:[0,.95]});
  const sampleMaximum = 10000000;

  function plain(raw) {
    return raw !== null && typeof raw === 'object' && !Array.isArray(raw) && [Object.prototype,null].includes(Object.getPrototypeOf(raw));
  }
  function bounded(value, bounds, name) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < bounds[0] || value > bounds[1]) {
      throw new RangeError(`${name}: enter a finite number from ${bounds[0]} to ${bounds[1]}.`);
    }
    return value;
  }
  function clean(raw, strict, defaults, limits) {
    if (!plain(raw)) {
      if (strict) throw new TypeError('Tool data must be a plain object.');
      raw = {};
    }
    const keys = Object.keys(defaults), result = {...defaults};
    if (strict && Object.keys(raw).some(key => !keys.includes(key))) throw new TypeError('Tool data contains an unknown field.');
    for (const key of keys) {
      if (!Object.hasOwn(raw,key)) {
        if (strict) throw new TypeError(`Tool data is missing ${key}.`);
        continue;
      }
      try {
        if (limits[key]) result[key] = bounded(raw[key],limits[key],key);
        else if (key === 'mode' && ['mean','proportion'].includes(raw[key])) result[key] = raw[key];
        else throw new RangeError('Choose mean or proportion planning.');
      } catch (error) { if (strict) throw error; }
    }
    return result;
  }
  function cleanEconomics(raw, strict = false) {
    const s = clean(raw,strict,economicsDefaults,economicsLimits);
    for (const [base,shift] of [['a','shiftA'],['c','shiftC']]) {
      if (s[base]+s[shift] < 0 || s[base]+s[shift] > 1e6) {
        if (strict) throw new RangeError(`The changed ${base === 'a' ? 'demand' : 'supply'} intercept must stay between 0 and 1000000.`);
        s[shift] = 0;
      }
    }
    return s;
  }
  function cleanSample(raw, strict = false) {
    return clean(raw,strict,sampleDefaults,sampleLimits);
  }
  function equilibrium(a,b,c,d) {
    if (a <= c) return {a,b,c,d,quantity:0,price:null,consumerSurplus:0,producerSurplus:0,totalSurplus:0,elasticity:null,trade:false};
    const quantity = (a-c)/(b+d), price = c+d*quantity;
    const consumerSurplus = .5*(a-price)*quantity, producerSurplus = .5*(price-c)*quantity;
    return {a,b,c,d,quantity,price,consumerSurplus,producerSurplus,totalSurplus:consumerSurplus+producerSurplus,elasticity:-price/(b*quantity),trade:true};
  }
  function economics(raw) {
    const state = cleanEconomics(raw,true), baseline = equilibrium(state.a,state.b,state.c,state.d);
    const changed = equilibrium(state.a+state.shiftA,state.b,state.c+state.shiftC,state.d);
    return {state,baseline,changed,quantityChange:changed.quantity-baseline.quantity,priceChange:changed.price === null || baseline.price === null ? null : changed.price-baseline.price};
  }
  function sampleSize(raw) {
    const state = cleanSample(raw,true);
    if (!M || typeof M.normalInv !== 'function') throw new Error('The Statistics Lab numerical helper is unavailable. Reload the page to calculate.');
    const z = M.normalInv((1+state.confidence/100)/2);
    const unrounded = state.mode === 'mean' ? (z*state.sd/state.meanMargin)**2 : z*z*state.proportion*(1-state.proportion)/state.proportionMargin**2;
    const complete = Math.max(1,Math.ceil(unrounded)), recruit = Math.ceil(complete/(1-state.loss));
    if (![unrounded,complete,recruit].every(Number.isFinite) || recruit > sampleMaximum) {
      throw new RangeError('This plan exceeds 10000000 observations. Review the assumptions or use specialist planning software.');
    }
    const achievedMargin = state.mode === 'mean' ? z*state.sd/Math.sqrt(complete) : z*Math.sqrt(state.proportion*(1-state.proportion)/complete);
    const expectedSuccesses = state.mode === 'proportion' ? complete*state.proportion : null;
    const expectedFailures = state.mode === 'proportion' ? complete*(1-state.proportion) : null;
    return {state,z,unrounded,complete,recruit,extra:recruit-complete,achievedMargin,expectedSuccesses,expectedFailures,approximationCaution:state.mode === 'proportion' && Math.min(expectedSuccesses,expectedFailures)<10};
  }
  return Object.freeze({economicsDefaults,sampleDefaults,economicsLimits,sampleLimits,sampleMaximum,cleanEconomics,cleanSample,economics,sampleSize});
});
