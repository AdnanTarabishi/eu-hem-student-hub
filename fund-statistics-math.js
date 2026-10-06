// Fundamentals (96498): course conventions and explicit sampling assumptions.
(function (root) {
  'use strict';
  const M = typeof module !== 'undefined' && module.exports ? require('./lecture-activities.js') : root.LectureMath;
  function count(n, min = 1) { if (!Number.isInteger(n) || n < min || n > 10000000) throw new Error(`Sample size must be a whole number from ${min} to 10,000,000.`); }
  function finite(...values) { if (values.some(x => !Number.isFinite(x) || Math.abs(x)>1e12)) throw new Error('Enter finite numeric values with magnitude at most 1 trillion.'); }
  function probability(p) { if (!(p > 0 && p < 1)) throw new Error('Probability must be between 0 and 1, excluding the endpoints.'); }
  function quantile(sorted, p, convention = 'course') {
    if (p === 0) return sorted[0];
    if (p === 1) return sorted.at(-1);
    if (convention === 'excel') {
      const position = (sorted.length - 1) * p, lower = Math.floor(position);
      return sorted[lower] + (position - lower) * (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]);
    }
    const position = sorted.length * p;
    return Number.isInteger(position) ? (sorted[position - 1] + sorted[position]) / 2 : sorted[Math.ceil(position) - 1];
  }
  function describe(values, convention = 'course') {
    if (!Array.isArray(values) || values.length < 2 || values.length > 500) throw new Error('Enter between 2 and 500 observations.');
    finite(...values);
    const result = M.describe(values), sorted = [...values].sort((a,b) => a-b);
    result.descriptiveVariance = result.variance * (result.n - 1) / result.n;
    result.descriptiveSD = Math.sqrt(result.descriptiveVariance);
    result.q1 = quantile(sorted, .25, convention); result.q3 = quantile(sorted, .75, convention);
    result.iqr = result.q3 - result.q1;
    result.lowerFence = result.q1 - 1.5 * result.iqr; result.upperFence = result.q3 + 1.5 * result.iqr;
    result.outliers = sorted.filter(x => x < result.lowerFence || x > result.upperFence);
    const inside = sorted.filter(x => x >= result.lowerFence && x <= result.upperFence);
    result.lowerWhisker = inside[0]; result.upperWhisker = inside.at(-1);
    return result;
  }
  function sampling(replace = true) {
    const population = [8,4,2,11,6], samples = [];
    for (let i = 0; i < 5; i++) for (let j = replace ? 0 : i + 1; j < 5; j++) {
      const values = [population[i],population[j]], d = describe(values);
      samples.push({values, mean:d.mean, variance:d.descriptiveVariance, adjusted:d.variance});
    }
    const means = samples.map(s => s.mean), mean = means.reduce((a,b) => a+b) / samples.length;
    return {population,samples,mean, variance:means.reduce((a,x) => a+(x-mean)**2,0)/means.length,
      expectedVariance:samples.reduce((a,s) => a+s.variance,0)/samples.length,
      expectedAdjusted:samples.reduce((a,s) => a+s.adjusted,0)/samples.length};
  }
  function interval({mode='unknown', n, mean, sd, k, confidence=.95, normal=false, approximate=false}) {
    count(n,2); probability(confidence);
    const alpha = 1-confidence;
    if (mode === 'proportion') {
      count(k,0); if (k > n) throw new Error('Successes cannot exceed sample size.');
      if (k < 5 || n-k < 5) throw new Error('The course Wald approximation requires at least 5 successes and 5 failures.');
      const estimate = k/n, se = Math.sqrt(estimate*(1-estimate)/n), critical = M.criticalValue(alpha);
      const lower=estimate-critical*se, upper=estimate+critical*se;
      return {estimate,se,critical,lower,upper,df:null,margin:critical*se,method:'Wald proportion interval',warning:lower<0 || upper>1 ? 'An endpoint is outside [0,1]; the Wald approximation is unsuitable here. It has not been truncated.' : k<10 || n-k<10 ? 'Counts meet the course minimum of 5; a more conservative guideline requires 10 each.' : ''};
    }
    finite(mean,sd); if (!(sd > 0)) throw new Error('Standard deviation must be positive. Enter SD, not variance.');
    if (n < 30 && !normal) throw new Error('For this small sample, confirm approximately normal population measurements before using the mean interval.');
    if (approximate && mode === 'unknown' && n < 120) throw new Error('The course large-sample z approximation is offered only for n≥120.');
    const df = mode === 'known' || approximate ? null : n-1, critical=M.criticalValue(alpha,df), se=sd/Math.sqrt(n);
    return {estimate:mean,se,critical,df,lower:mean-critical*se,upper:mean+critical*se,margin:critical*se,method:df===null?(mode==='known'?'Known-σ z interval':'Large-sample z approximation'):'Unknown-σ t interval',warning:n>=30?'n≥30 is the course heuristic; still check independence, skewness and sampling quality.':''};
  }
  function proportionTest({n,k,nullProportion,alpha=.05}) {
    count(n); count(k,0); if (k>n) throw new Error('Successes cannot exceed sample size.');
    probability(nullProportion); probability(alpha);
    if (n*nullProportion<5 || n*(1-nullProportion)<5) throw new Error('The normal test needs at least 5 expected successes and 5 expected failures under H₀.');
    const estimate=k/n,se=Math.sqrt(nullProportion*(1-nullProportion)/n),statistic=(estimate-nullProportion)/se;
    const p=2*M.normalCDF(-Math.abs(statistic)),critical=M.criticalValue(alpha);
    return {estimate,se,statistic,p,critical,decision:p<alpha?'Reject H₀':'Do not reject H₀'};
  }
  function twoMeans({n1,n2,mean1,mean2,sd1,sd2,alpha=.05}) {
    count(n1,30); count(n2,30); finite(mean1,mean2,sd1,sd2); probability(alpha);
    if (sd1<=0 || sd2<=0) throw new Error('Both adjusted standard deviations must be positive.');
    const difference=mean1-mean2,se=Math.sqrt(sd1**2/n1+sd2**2/n2),statistic=difference/se;
    const p=2*M.normalCDF(-Math.abs(statistic)),critical=M.criticalValue(alpha);
    return {difference,se,statistic,p,critical,lower:difference-critical*se,upper:difference+critical*se,decision:p<alpha?'Reject H₀':'Do not reject H₀'};
  }
  const api={quantile,describe,sampling,interval,proportionTest,twoMeans};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.FundStatsMath=api;
})(typeof window !== 'undefined' ? window : globalThis);
