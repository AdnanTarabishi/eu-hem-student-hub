/* Shared Fundamentals lab: pure calculations, independent of the DOM.
 * Reuses v1 normal tails and v2 Student-t / inverse calculations.
 * Course recipes and supplementary methods are explicitly separated by the UI.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./statistics-lab-math.js'), require('./statistics-lab-tools-math.js'));
  else root.StatisticsInferenceMath = factory(root.StatisticsLabMath, root.StatisticsLabToolsMath);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N, M) {
  'use strict';
  const finite = (...xs) => { if (!xs.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1e12)) throw new RangeError('Use finite numeric values with magnitude at most 10¹².'); };
  function size(n, min = 1, max = 1000000) { if (!Number.isInteger(n) || n < min || n > max) throw new RangeError(`Sample size must be a whole number from ${min} to ${max}.`); }
  function positive(s) { finite(s); if (s < 1e-12) throw new RangeError('Standard deviation must be at least 10⁻¹². Enter SD, not variance.'); }
  function significance(a) { finite(a); if (a < 0.000001 || a > .5) throw new RangeError('Use α between 0.000001 and 0.5.'); }
  const choose = (v, options) => { if (!options.includes(v)) throw new RangeError('Choose a supported method or alternative.'); };
  function counts(n, k) { size(n); size(k, 0); if (k > n) throw new RangeError('Successes cannot exceed the sample size.'); }
  function reference(statistic, alpha, alternative, df = null) {
    if (!Number.isFinite(statistic)) throw new RangeError('The test statistic exceeds numerical limits. Rescale your units.');
    significance(alpha); choose(alternative, ['two', 'less', 'greater']);
    const cdf = x => df === null ? N.cdf(x) : M.tCDF(x, df);
    const sf = x => df === null ? N.sf(x) : M.tSF(x, df);
    const inv = p => df === null ? M.normalInv(p) : M.tInv(p, df);
    const p = alternative === 'two' ? Math.min(1, 2 * sf(Math.abs(statistic))) : alternative === 'less' ? cdf(statistic) : sf(statistic);
    const critical = alternative === 'less' ? inv(alpha) : inv(1 - alpha / (alternative === 'two' ? 2 : 1));
    const boundary = Math.abs(p - alpha) <= 2e-12 * Math.max(p, alpha);
    return {statistic, alpha, alternative, df, p, critical, boundary,
      reject: !boundary && p < alpha,
      decision: boundary ? 'At the p = α boundary; follow the stated convention.' : p < alpha ? 'Reject H₀' : 'Do not reject H₀'};
  }
  function meanTest({mean, nullMean, sd, n, method = 't', alpha = .05, alternative = 'two'}) {
    finite(mean, nullMean); positive(sd); choose(method, ['t', 'z', 'large-z']);
    size(n, method === 'z' ? 1 : method === 'large-z' ? 120 : 2, method === 't' ? 10001 : 1000000);
    const se = sd / Math.sqrt(n), df = method === 't' ? n - 1 : null;
    return {...reference((mean - nullMean) / se, alpha, alternative, df), mean, nullMean, sd, n, method, se,
      warning: method === 'large-z' ? 'Estimated SD with a large-sample z approximation. The course sources differ at n = 120; Student t avoids this boundary choice.' : method === 't' ? 'Exact t inference requires independent normal observations; other cases need a justified approximation.' : 'Population SD must genuinely be known. A sample SD is not a known population SD.'};
  }
  function proportionCI({n, k, level = .95, method = 'wald'}) {
    counts(n, k); choose(method, ['wald', 'wilson']); significance(1 - level);
    if (method === 'wald' && Math.min(k, n - k) < 5) throw new RangeError('The course Wald method requires at least 5 observed successes and 5 observed failures. Wilson is available as a supplementary method.');
    const estimate = k / n, z = M.normalInv((1 + level) / 2), se = Math.sqrt(estimate * (1 - estimate) / n);
    let centre = estimate, margin = z * se;
    if (method === 'wilson') {
      const denom = 1 + z * z / n;
      centre = (estimate + z * z / (2 * n)) / denom;
      margin = z * Math.sqrt(estimate * (1 - estimate) / n + z * z / (4 * n * n)) / denom;
    }
    let lower = centre - margin, upper = centre + margin;
    // Algebraic endpoint identities, not truncation of a Wald interval.
    if (method === 'wilson' && k === 0) lower = 0;
    if (method === 'wilson' && k === n) upper = 1;
    const warnings = [];
    if (Math.min(k, n-k) < 10) warnings.push('Fewer than 10 observed successes or failures: be cautious about normal-approximation coverage.');
    if (method === 'wald' && (lower < 0 || upper > 1)) warnings.push('The Wald interval extends outside [0,1]. Endpoints are not truncated; the approximation is unsuitable here.');
    if (method === 'wilson') warnings.push('Wilson score interval: supplementary, not the course Wald recipe; it is not an exact binomial interval.');
    return {n, k, level, method, estimate, z, se, centre, margin, lower, upper, warnings};
  }
  function proportionTest({n, k, nullProportion, alpha = .05, alternative = 'two'}) {
    counts(n, k); finite(nullProportion);
    if (!(nullProportion > 0 && nullProportion < 1)) throw new RangeError('The null proportion must lie strictly between 0 and 1.');
    const expectedSuccess = n * nullProportion, expectedFailure = n * (1-nullProportion);
    if (Math.min(expectedSuccess, expectedFailure) < 5) throw new RangeError('The course normal test needs at least 5 expected successes and 5 expected failures under H₀. No normal-test decision is reported.');
    const estimate = k/n, se = Math.sqrt(nullProportion * (1-nullProportion)/n);
    return {...reference((estimate - nullProportion)/se, alpha, alternative), n, k, nullProportion, estimate, se, expectedSuccess, expectedFailure,
      warning: Math.min(expectedSuccess, expectedFailure) < 10 ? 'Null counts meet the course minimum of 5 but not the more conservative guideline of 10.' : 'Null counts are adequate under both the course (5 each) and stricter (10 each) guidelines. Independence is still required.'};
  }
  function twoMeans({mean1, mean2, sd1, sd2, n1, n2, nullDifference = 0, method = 'course-z', alpha = .05, alternative = 'two'}) {
    choose(method, ['course-z', 'welch']); finite(mean1, mean2, nullDifference); positive(sd1); positive(sd2);
    size(n1, method === 'course-z' ? 30 : 2, method === 'welch' ? 5001 : 1000000);
    size(n2, method === 'course-z' ? 30 : 2, method === 'welch' ? 5001 : 1000000);
    const v1 = sd1 ** 2 / n1, v2 = sd2 ** 2 / n2, total = v1+v2, se = Math.sqrt(total), difference = mean1-mean2;
    const df = method === 'welch' ? 1 / ((v1/total)**2/(n1-1) + (v2/total)**2/(n2-1)) : null;
    const r = reference((difference-nullDifference)/se, alpha, alternative, df);
    const ciCritical = df === null ? M.normalInv(1-alpha/2) : M.tInv(1-alpha/2, df);
    return {...r, mean1, mean2, sd1, sd2, n1, n2, nullDifference, method, se, v1, v2, difference, ciCritical,
      lower: difference-ciCritical*se, upper: difference+ciCritical*se,
      warning: method === 'welch' ? 'Supplementary Welch procedure; this is not the course large-sample z recipe. Assumes independent groups, not paired observations.' : 'Course large-sample approximation. n ≥ 30 per group is a heuristic, not a guarantee of a good approximation; check independence, skewness and outliers.'};
  }
  function parseDistribution(text) {
    if (typeof text !== 'string' || !text.trim() || text.length > 20000) throw new RangeError('Enter 1–100 rows, each with a value and its probability.');
    const rows = text.trim().split(/\r?\n/);
    if (rows.length > 100) throw new RangeError('At most 100 support values are supported.');
    const number = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
    return rows.map((row, i) => {
      if (/[,;]\s*[,;]/.test(row) || /\t[ \t]*\t/.test(row)) throw new RangeError(`Row ${i+1}: a blank cell was found.`);
      const tokens = row.trim().split(/[\s,;]+/);
      if (tokens.length !== 2 || !tokens.every(v => number.test(v))) throw new RangeError(`Row ${i+1}: enter exactly two numbers, x and P(X=x). Use decimal points.`);
      return {x: Number(tokens[0]), p: Number(tokens[1])};
    });
  }
  function discrete(rows, mode = 'between', a = 0, b = 1) {
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) throw new RangeError('Use 1–100 support values.');
    choose(mode, ['between', 'left', 'right', 'equal']); finite(a, b);
    if (mode === 'between' && a > b) throw new RangeError('The lower bound must not exceed the upper bound.');
    const seen = new Set(); let sum = 0;
    for (const row of rows) {
      finite(row.x, row.p);
      if (row.p < 0 || row.p > 1) throw new RangeError('Each probability must lie between 0 and 1.');
      if (seen.has(row.x)) throw new RangeError('Each support value must appear once; combine duplicate x values explicitly.');
      seen.add(row.x); sum += row.p;
    }
    if (Math.abs(sum - 1) > 1e-10) throw new RangeError(`Probabilities sum to ${sum}, not 1. Correct them; the lab does not normalise automatically.`);
    const sorted = rows.map(r => ({...r})).sort((a,b) => a.x-b.x);
    const mean = sorted.reduce((s,r) => s+r.x*r.p, 0);
    const variance = sorted.reduce((s,r) => s+(r.x-mean)**2*r.p, 0), secondMoment = sorted.reduce((s,r) => s+r.x*r.x*r.p,0);
    let cumulative = 0, probability = 0;
    const table = sorted.map(r => {
      cumulative += r.p;
      const selected = mode === 'between' ? r.x >= a && r.x <= b : mode === 'left' ? r.x <= b : mode === 'right' ? r.x >= a : r.x === a;
      if (selected) probability += r.p;
      return {...r, cumulative, selected, weighted: r.x*r.p, varianceTerm: (r.x-mean)**2*r.p};
    });
    return {table, mean, variance, sd: Math.sqrt(variance), secondMoment, probability, sum, mode, a, b};
  }
  return Object.freeze({reference, meanTest, proportionCI, proportionTest, twoMeans, parseDistribution, discrete});
});
