// Each worked solution derives from the same teaching parameters as its expected answers.
(function (root) {
  "use strict";
  const math =
    typeof module !== "undefined" && module.exports
      ? require("./lecture-activities.js")
      : root.LectureMath;
  const f = (n) => Number(n.toFixed(5)).toString();
  function solve(kind, p) {
    let prompt, values, labels, steps;
    const se = p.sd / Math.sqrt(p.n);
    switch (kind) {
      case "se":
        prompt = `An independent sample has n = ${p.n}. The population SD is ${p.sd} kg. Find the standard error of the sample mean in kg.`;
        labels = ["Standard error (kg)"];
        values = [se];
        steps = [
          `SE = σ/√n = ${p.sd}/√${p.n} = ${f(se)} kg.`,
          "This describes variation between sample means, rather than between individuals.",
        ];
        break;
      case "ci": {
        const critical = math.criticalValue(0.05),
          margin = critical * se;
        prompt = `An independent random sample has mean ${p.mean} kg, known population SD ${p.sd} kg and n = ${p.n}. Assume a normal sampling distribution. Find the two bounds of the 95% interval.`;
        labels = ["Lower bound (kg)", "Upper bound (kg)"];
        values = [p.mean - margin, p.mean + margin];
        steps = [
          `SE = ${p.sd}/√${p.n} = ${f(se)}.`,
          `z₀.₉₇₅ ≈ ${f(critical)}; margin = ${f(margin)}.`,
          `Bounds: ${p.mean} ± ${f(margin)} → [${f(values[0])}, ${f(values[1])}] kg.`,
          "Repeated intervals from this method cover the fixed population mean about 95% of the time under the assumptions.",
        ];
        break;
      }
      case "ppv": {
        const tp = p.prevalence * p.sensitivity,
          fp = (1 - p.prevalence) * (1 - p.specificity);
        prompt = `A hypothetical population has prevalence ${p.prevalence * 100}%, sensitivity ${p.sensitivity * 100}% and specificity ${p.specificity * 100}%. Find PPV as a percentage.`;
        labels = ["PPV (%)"];
        values = [(100 * tp) / (tp + fp)];
        steps = [
          `True-positive fraction = prevalence × sensitivity = ${f(tp)}.`,
          `False-positive fraction = (1 − prevalence) × (1 − specificity) = ${f(fp)}.`,
          `PPV = ${f(tp)}/(${f(tp)} + ${f(fp)}) × 100 = ${f(values[0])}%.`,
        ];
        break;
      }
      case "binomial":
        prompt = `There are ${p.n} independent trials, each with success probability ${p.p}. Find the probability of exactly ${p.k} successes as a decimal.`;
        labels = ["Probability (0 to 1)"];
        values = [math.binomial(p.n, p.p)[p.k]];
        steps = [
          `P(X = ${p.k}) = C(${p.n},${p.k}) × ${p.p}^${p.k} × (1 − ${p.p})^${p.n - p.k}.`,
          `The result is ${f(values[0])}, or ${f(values[0] * 100)}%.`,
        ];
        break;
      case "normal": {
        const z = (p.x - p.mean) / p.sd;
        prompt = `X follows a normal distribution with mean ${p.mean} and SD ${p.sd}. Find P(X > ${p.x}) as a decimal.`;
        labels = ["Upper-tail probability (0 to 1)"];
        values = [1 - math.normalCDF(z)];
        steps = [
          `z = (${p.x} − ${p.mean})/${p.sd} = ${f(z)}.`,
          `P(X > ${p.x}) = 1 − Φ(${f(z)}) = ${f(values[0])}.`,
        ];
        break;
      }
      case "variance": {
        const d = math.describe(p.values),
          sum = d.variance * (d.n - 1);
        prompt = `Values: ${p.values.join(", ")}. Find the sample variance (using n − 1).`;
        labels = ["Sample variance"];
        values = [d.variance];
        steps = [
          `Mean = ${f(d.mean)}.`,
          `Sum of squared deviations = ${f(sum)}.`,
          `s² = ${f(sum)}/${d.n - 1} = ${f(d.variance)}.`,
        ];
        break;
      }
      case "t":
      case "z": {
        const known = kind === "z",
          r = math.oneMean({ ...p, alpha: 0.05, known });
        prompt = `An independent random sample has mean ${p.mean}, ${known ? "known population" : "sample"} SD ${p.sd} and n = ${p.n}. Test μ = ${p.nullMean} against μ ≠ ${p.nullMean}. Assume the ${known ? "sampling distribution" : "population"} is normal. Find the ${kind} statistic${known ? "" : " and degrees of freedom"}.`;
        labels = known
          ? ["z statistic"]
          : ["t statistic", "Degrees of freedom"];
        values = known ? [r.statistic] : [r.statistic, r.df];
        steps = [
          `SE = ${p.sd}/√${p.n} = ${f(se)}.`,
          `${kind} = (${p.mean} − ${p.nullMean})/${f(se)} = ${f(r.statistic)}.`,
          ...(known ? [] : [`df = n − 1 = ${r.df}.`]),
          `Two-sided p ≈ ${f(r.p)}. ${r.p < 0.05 ? "Reject" : "Do not reject"} H₀ at α = 0.05.`,
          "The decision depends on the stated model and sampling assumptions.",
        ];
        break;
      }
      default:
        throw new Error("Unknown calculation exercise.");
    }
    return {
      prompt,
      labels,
      values,
      steps,
      tolerances: values.map((v, i) =>
        labels[i] === "Degrees of freedom"
          ? 0
          : kind === "normal" || kind === "binomial"
            ? 0.0001
            : kind === "ppv"
              ? 0.1
              : 0.02,
      ),
    };
  }
  function check(solution, raw) {
    if (
      raw.length !== solution.values.length ||
      raw.some(
        (v) =>
          typeof v !== "string" || !v.trim() || !Number.isFinite(Number(v)),
      )
    )
      return { valid: false, correct: false };
    return {
      valid: true,
      correct: raw.every(
        (v, i) =>
          Math.abs(Number(v) - solution.values[i]) <=
          solution.tolerances[i] + 1e-10,
      ),
    };
  }
  const api = { solve, check };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StatisticsCalculations = api;
})(typeof window !== "undefined" ? window : globalThis);
