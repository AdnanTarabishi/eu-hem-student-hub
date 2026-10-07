/* EU-HEM Interactive Statistics Lab v1 — dependency-free numerical core.
 * Normal tail uses the regularized upper incomplete gamma Q(1/2, z²/2).
 * A convergent series is used near zero; a continued fraction in the tails.
 * See docs/statistics-lab.md for assumptions, precision and references.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StatisticsLabMath = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LOG_SQRT_PI = Math.log(Math.PI) / 2;
  const SQRT_2PI = Math.sqrt(2 * Math.PI);
  const EPS = 4e-16;
  const TINY = 1e-300;
  const clamp = (p) => Math.max(0, Math.min(1, p));

  function positiveTail(z) {
    if (z === 0) return 0.5;
    if (z > 38.5) return 0; // Below the range of IEEE-754 double precision.
    const x = z * z / 2;
    const scale = Math.exp(-x + 0.5 * Math.log(x) - LOG_SQRT_PI);
    if (x < 1.5) {
      let term = 2, sum = 2, a = 0.5;
      for (let i = 1; i <= 300; i++) {
        term *= x / ++a;
        sum += term;
        if (Math.abs(term) <= Math.abs(sum) * EPS) break;
      }
      return clamp(0.5 * (1 - scale * sum));
    }
    let b = x + 0.5, c = 1 / TINY, d = 1 / b, h = d;
    for (let i = 1; i <= 300; i++) {
      const an = -i * (i - 0.5);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < TINY) d = TINY;
      c = b + an / c;
      if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < EPS) break;
    }
    return clamp(0.5 * scale * h);
  }
  function numeric(z) {
    if (typeof z !== "number" || Number.isNaN(z)) throw new TypeError("A numeric z-score is required.");
  }
  function pdf(z) {
    numeric(z);
    return Math.exp(-0.5 * z * z) / SQRT_2PI;
  }
  function cdf(z) {
    numeric(z);
    return z <= 0 ? positiveTail(-z) : 1 - positiveTail(z);
  }
  function sf(z) {
    numeric(z);
    return z >= 0 ? positiveTail(z) : 1 - positiveTail(-z);
  }
  function between(a, b) {
    numeric(a); numeric(b);
    if (a > b) throw new RangeError("The lower bound must not exceed the upper bound.");
    if (a === b) return 0;
    // Integrate very narrow intervals directly to avoid subtracting nearly equal CDFs.
    const width = b - a;
    if (Number.isFinite(width) && width * (1 + Math.max(Math.abs(a), Math.abs(b))) < 1e-3) {
      const mid = a + width / 2;
      return clamp(width / 6 * (pdf(a) + 4 * pdf(mid) + pdf(b)));
    }
    if (a >= 0) return clamp(sf(a) - sf(b));
    if (b <= 0) return clamp(cdf(b) - cdf(a));
    return clamp(1 - cdf(a) - sf(b));
  }
  function probability(mode, a, b) {
    if (mode === "left") return cdf(b);
    if (mode === "right") return sf(a);
    if (mode === "between") return between(a, b);
    if (mode === "outside") {
      if (a > b) throw new RangeError("The lower bound must not exceed the upper bound.");
      return clamp(cdf(a) + sf(b));
    }
    throw new RangeError("Unknown probability region.");
  }
  function standardize(x, mu, sigma) {
    if (![x, mu, sigma].every(Number.isFinite) || sigma <= 0) {
      throw new RangeError("Use finite values and a strictly positive standard deviation.");
    }
    const z = (x - mu) / sigma;
    if (!Number.isFinite(z)) throw new RangeError("These values exceed the supported numerical range.");
    return z;
  }
  function rounded(z, digits = 4) { return Number(cdf(z).toFixed(digits)); }
  function tableCalculation(mode, a, b) {
    const za = Math.round(Math.abs(a) * 100) / 100 * (a < 0 ? -1 : 1);
    const zb = Math.round(Math.abs(b) * 100) / 100 * (b < 0 ? -1 : 1);
    const pa = rounded(za), pb = rounded(zb);
    let p;
    if (mode === "left") p = pb;
    else if (mode === "right") p = 1 - pa;
    else if (mode === "between") p = pb - pa;
    else if (mode === "outside") p = pa + 1 - pb;
    else throw new RangeError("Unknown probability region.");
    return { a: za, b: zb, pa, pb, p: Number(clamp(p).toFixed(4)) };
  }
  return Object.freeze({ pdf, cdf, sf, between, probability, standardize, tableCalculation });
});
