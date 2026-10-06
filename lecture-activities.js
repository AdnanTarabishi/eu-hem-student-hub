// Local teaching activities and distribution calculations. No external libraries or data.
(function (root) {
  "use strict";
  function normalCDF(z) {
    if (z === Infinity) return 1;
    if (z === -Infinity) return 0;
    const x = Math.abs(z) / Math.SQRT2,
      t = 1 / (1 + 0.3275911 * x);
    const erf =
      1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
        t +
        0.254829592) *
        t *
        Math.exp(-x * x);
    return (1 + (z < 0 ? -erf : erf)) / 2;
  }
  // Lanczos log-gamma and a continued fraction for the regularised incomplete beta.
  // Student's t probabilities follow I_{df/(df+t²)}(df/2, 1/2).
  function logGamma(z) {
    const c = [
      676.5203681218851, -1259.1392167224028, 771.3234287776531,
      -176.6150291621406, 12.507343278686905, -0.13857109526572012,
      9.984369578019572e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5)
      return (
        Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z)
      );
    z--;
    let x = 0.9999999999998099;
    c.forEach((v, i) => {
      x += v / (z + i + 1);
    });
    const t = z + c.length - 0.5;
    return (
      0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
    );
  }
  function betaFraction(a, b, x) {
    const tiny = 1e-30;
    let c = 1,
      d = 1 - ((a + b) * x) / (a + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
      let aa = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
      d = 1 + aa * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aa / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      h *= d * c;
      aa = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
      d = 1 + aa * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aa / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 3e-14) break;
    }
    return h;
  }
  function betaCDF(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(
      logGamma(a + b) -
        logGamma(a) -
        logGamma(b) +
        a * Math.log(x) +
        b * Math.log1p(-x),
    );
    return x < (a + 1) / (a + b + 2)
      ? (bt * betaFraction(a, b, x)) / a
      : 1 - (bt * betaFraction(b, a, 1 - x)) / b;
  }
  function tTwoSided(t, df) {
    return betaCDF(df / (df + t * t), df / 2, 0.5);
  }
  function criticalValue(alpha, df = null) {
    let lo = 0,
      hi = 1;
    const tail = (x) => (df === null ? 2 * normalCDF(-x) : tTwoSided(x, df));
    while (tail(hi) > alpha && hi < 1e10) hi *= 2;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (tail(mid) > alpha) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function binomial(n, p) {
    let choose = 1;
    return Array.from({ length: n + 1 }, (_, k) => {
      if (k) choose *= (n - k + 1) / k;
      return choose * Math.pow(p, k) * Math.pow(1 - p, n - k);
    });
  }
  function describe(values) {
    const sorted = [...values].sort((a, b) => a - b),
      n = values.length;
    const mean = values.reduce((s, x) => s + x, 0) / n;
    const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
    const counts = new Map();
    sorted.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
    const maxCount = Math.max(...counts.values());
    return {
      n,
      mean,
      variance,
      sd: Math.sqrt(variance),
      median:
        n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
      range: sorted[n - 1] - sorted[0],
      modes: [...counts].filter(([, c]) => c === maxCount).map(([x]) => x),
      maxCount,
      min: sorted[0],
      max: sorted[n - 1],
    };
  }
  function oneMean({ mean, nullMean, sd, n, alpha, known }) {
    const se = sd / Math.sqrt(n),
      statistic = (mean - nullMean) / se;
    const df = known ? null : n - 1;
    const p = known
      ? 2 * normalCDF(-Math.abs(statistic))
      : tTwoSided(statistic, df);
    const critical = criticalValue(alpha, df);
    const boundary = Math.abs(p - alpha) < 1e-10;
    return {
      se,
      statistic,
      df,
      p,
      critical,
      lower: mean - critical * se,
      upper: mean + critical * se,
      decision: boundary
        ? "Boundary: p = α"
        : p < alpha
          ? "Reject H₀"
          : "Do not reject H₀",
    };
  }
  const math = {
    normalCDF,
    tTwoSided,
    criticalValue,
    binomial,
    describe,
    oneMean,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = math;
    return;
  }
  root.LectureMath = math;
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const number = (x, d = 3) =>
    Number(x).toLocaleString("en-US", { maximumFractionDigits: d });
  const probability = (p) =>
    p > 0 && p < 0.0001 ? p.toExponential(3) : p.toFixed(4);
  const input = (id, label, value, extra = "") =>
    `<div class="control"><label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" ${extra}></div>`;
  const select = (id, label, options) =>
    `<div class="control"><label for="${id}">${label}</label><select id="${id}">${options.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></div>`;
  const output = (id) =>
    `<p id="${id}-error" class="note" role="status" hidden></p><div id="${id}-output" class="activity-output" aria-live="polite"></div>`;
  function read(id, min = -1e9, max = 1e9, integer = false) {
    const raw = document.getElementById(id).value.trim(),
      value = Number(raw);
    if (
      !raw ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      throw new Error(
        "Enter a valid " +
          (integer ? "whole number" : "number") +
          " for " +
          document.querySelector(`label[for="${id}"]`).textContent +
          ".",
      );
    return value;
  }
  function reactive(node, id, calculate) {
    const update = () => {
      const error = node.querySelector("#" + id + "-error"),
        out = node.querySelector("#" + id + "-output");
      try {
        calculate(out);
        error.hidden = true;
        out.hidden = false;
      } catch (e) {
        error.textContent = e.message;
        error.hidden = false;
        out.hidden = true;
      }
    };
    node.querySelectorAll("input,select,textarea").forEach((el) => {
      el.addEventListener("input", update);
      el.addEventListener("change", update);
    });
    update();
    return update;
  }
  function bars(values, labels, title) {
    const max = Math.max(...values, 0.001),
      w = 560 / values.length;
    return `<svg viewBox="0 0 640 270" class="activity-chart" role="img" aria-label="${escape(title)}"><path d="M50 20V220H620" fill="none" stroke="currentColor"/>${values.map((v, i) => `<rect x="${50 + i * w + 2}" y="${220 - (v / max) * 180}" width="${Math.max(w - 4, 1)}" height="${(v / max) * 180}" fill="#628473"/><text x="${50 + (i + 0.5) * w}" y="245" text-anchor="middle" fill="currentColor" font-size="12">${escape(labels[i])}</text>`).join("")}<text x="50" y="14" fill="currentColor" font-size="12">${number(max, 4)} (maximum height)</text></svg>`;
  }
  const definitions = {
    "event-builder": {
      title: "Build two events",
      intro:
        "A fair six-sided die gives each outcome probability 1/6. Select the outcomes in A and B, then compare “or”, “and” and a conditional probability.",
      build(node) {
        node.innerHTML =
          ["A", "B"]
            .map(
              (s, i) =>
                `<fieldset class="event-set"><legend>Event ${s}</legend><div class="event-buttons">${[1, 2, 3, 4, 5, 6].map((x) => `<button type="button" class="btn secondary" data-set="${s}" data-outcome="${x}" aria-pressed="${i === 0 ? x % 2 === 0 : x >= 3}">${x}</button>`).join("")}</div></fieldset>`,
            )
            .join("") + output("events");
        const update = () => {
          const set = (name) =>
            [
              ...node.querySelectorAll(
                `[data-set="${name}"][aria-pressed="true"]`,
              ),
            ].map((b) => Number(b.dataset.outcome));
          const a = set("A"),
            b = set("B"),
            joint = a.filter((x) => b.includes(x)),
            union = [...new Set([...a, ...b])].sort();
          node.querySelector("#events-output").innerHTML =
            `<div class="formula">A = {${a.join(", ")}}; B = {${b.join(", ")}}</div><p>A ∩ B = {${joint.join(", ")}}; P(A ∩ B) = ${joint.length}/6.</p><p>A ∪ B = {${union.join(", ")}}; P(A ∪ B) = ${union.length}/6.</p><p>P(A | B) = ${b.length ? probability(joint.length / b.length) : "undefined: P(B) = 0"}.</p><p>${joint.length === 0 ? "Mutually exclusive." : "The events overlap."} ${joint.length * 6 === a.length * b.length ? "Independent under this model." : "Dependent under this model."}</p>`;
        };
        node.querySelectorAll("button").forEach((b) =>
          b.addEventListener("click", () => {
            b.setAttribute(
              "aria-pressed",
              String(b.getAttribute("aria-pressed") !== "true"),
            );
            update();
          }),
        );
        update();
      },
    },
    "diagnostic-test": {
      title: "A positive test in context",
      intro:
        "A hypothetical diagnostic test. Change prevalence while holding test performance fixed and notice how predictive value changes. Table cells are joint probabilities.",
      build(node) {
        node.innerHTML =
          `<div class="activity-controls">${input("diag-prev", "Prevalence (%)", 20, 'min="0" max="100" step="1"')}${input("diag-sens", "Sensitivity (%)", 75, 'min="0" max="100" step="1"')}${input("diag-spec", "Specificity (%)", 90, 'min="0" max="100" step="1"')}</div>` +
          output("diag");
        reactive(node, "diag", (out) => {
          const p = read("diag-prev", 0, 100) / 100,
            s = read("diag-sens", 0, 100) / 100,
            c = read("diag-spec", 0, 100) / 100;
          const tp = p * s,
            fn = p * (1 - s),
            fp = (1 - p) * (1 - c),
            tn = (1 - p) * c,
            positive = tp + fp;
          out.innerHTML = `<div class="table-scroll"><table><caption>Joint and marginal probabilities</caption><thead><tr><th scope="col">Result</th><th scope="col">Disease</th><th scope="col">No disease</th><th scope="col">Total</th></tr></thead><tbody><tr><th scope="row">Positive</th><td>${probability(tp)}</td><td>${probability(fp)}</td><td>${probability(positive)}</td></tr><tr><th scope="row">Negative</th><td>${probability(fn)}</td><td>${probability(tn)}</td><td>${probability(fn + tn)}</td></tr><tr><th scope="row">Total</th><td>${probability(p)}</td><td>${probability(1 - p)}</td><td>1</td></tr></tbody></table></div><div class="formula" id="diag-ppv">P(disease | positive) = ${positive ? probability(tp / positive) : "undefined (no positive tests)"}</div><p>Among 1,000 hypothetical people, expected true positives = ${number(1000 * tp)}; expected false positives = ${number(1000 * fp)}. These expectations may be fractional.</p><p>False-positive rate among people without disease = ${probability(1 - c)}. This differs from the proportion of positive results that are false.</p>`;
        });
      },
    },
    binomial: {
      title: "Count successes, see the PMF",
      intro:
        "Independent trials, a common success probability, and a fixed number of trials. These are the binomial assumptions.",
      build(node) {
        node.innerHTML =
          `<div class="activity-controls">${input("bin-n", "Number of trials n", 3, 'min="1" max="30" step="1"')}${input("bin-p", "Success probability (%)", 50, 'min="0" max="100" step="1"')}</div>` +
          output("bin");
        reactive(node, "bin", (out) => {
          const n = read("bin-n", 1, 30, true),
            p = read("bin-p", 0, 100) / 100,
            mass = binomial(n, p);
          out.innerHTML = `<div class="formula">E[X] = ${number(n * p)}; Var(X) = ${number(n * p * (1 - p))}; SD = ${number(Math.sqrt(n * p * (1 - p)))}</div>${bars(
            mass,
            mass.map((_, k) => k),
            "Binomial probability mass function. Horizontal axis: successes. Vertical axis: probability.",
          )}<details><summary>Read exact probabilities</summary><div class="table-scroll"><table><thead><tr><th scope="col">Successes</th><th scope="col">Probability</th></tr></thead><tbody>${mass.map((v, k) => `<tr><td>${k}</td><td>${probability(v)}</td></tr>`).join("")}</tbody></table></div></details>`;
        });
      },
    },
    "normal-distribution": {
      title: "Shade a normal probability",
      intro:
        "Enter population SD, not variance. Lower and upper tails and an interval use the same CDF. Probabilities are numerical approximations.",
      build(node) {
        node.innerHTML =
          `<div class="activity-controls">${input("normal-mean", "Population mean μ", 90)}${input("normal-sd", "Population SD σ", 9, 'min="0.000001" step="any"')}${select(
            "normal-mode",
            "Region",
            [
              ["above", "Above threshold"],
              ["below", "Below threshold"],
              ["between", "Between lower and upper"],
            ],
          )}${input("normal-low", "Threshold / lower bound", 105)}${input("normal-high", "Upper bound (interval mode)", 110)}</div><div class="activity-presets"><button class="btn secondary small-btn" type="button" data-normal="iq">IQ: above 105</button><button class="btn secondary small-btn" type="button" data-normal="standard">Standard normal: ±1.96</button><button class="btn secondary small-btn" type="button" data-normal="sheet">Spreadsheet-style example</button></div>` +
          output("normal");
        const update = reactive(node, "normal", (out) => {
          const mu = read("normal-mean", -1e6, 1e6),
            sd = read("normal-sd", 1e-6, 1e6),
            low = read("normal-low"),
            mode = node.querySelector("#normal-mode").value;
          node.querySelector("#normal-high").disabled = mode !== "between";
          const high = mode === "between" ? read("normal-high") : low;
          if (mode === "between" && high < low)
            throw new Error("Upper bound must be at least the lower bound.");
          const zl = (low - mu) / sd,
            zh = (high - mu) / sd,
            p =
              mode === "below"
                ? normalCDF(zl)
                : mode === "above"
                  ? normalCDF(-zl)
                  : Math.max(0, normalCDF(zh) - normalCDF(zl));
          let curve = "",
            area = "";
          const points = [];
          for (let i = 0; i <= 240; i++) {
            const z = -4 + i / 30,
              x = 50 + (i * 560) / 240,
              y = 220 - Math.exp((-z * z) / 2) * 180;
            curve += (i ? "L" : "M") + x + " " + y;
            if (
              mode === "below"
                ? z <= zl
                : mode === "above"
                  ? z >= zl
                  : z >= zl && z <= zh
            )
              points.push([x, y]);
          }
          if (points.length)
            area =
              `M${points[0][0]} 220` +
              points.map(([x, y]) => "L" + x + " " + y).join("") +
              `L${points[points.length - 1][0]} 220Z`;
          out.innerHTML = `<div class="formula" id="normal-probability">Probability = ${probability(p)}</div><p>z at threshold/lower bound = ${number(zl)}${mode === "between" ? "; z at upper bound = " + number(zh) : ""}.</p><svg class="activity-chart" viewBox="0 0 640 270" role="img" aria-label="Normal PDF with the requested region shaded; horizontal axis shown in SD units."><path d="${area}" fill="#cc6f4f" opacity="0.45"/><path d="${curve}" fill="none" stroke="#628473" stroke-width="3"/><path d="M50 220H610" stroke="currentColor"/>${[-4, -2, 0, 2, 4].map((z) => `<text x="${50 + (z + 4) * 70}" y="245" fill="currentColor" text-anchor="middle" font-size="12">${z}σ</text>`).join("")}</svg><p class="small">The plot shows ±4 SD; the calculation includes the entire distribution. Excel equivalent: NORM.DIST(threshold, mean, SD, TRUE), with tail or interval adjustments.</p>`;
        });
        node.querySelectorAll("[data-normal]").forEach((b) =>
          b.addEventListener("click", () => {
            const vals =
              b.dataset.normal === "iq"
                ? [90, 9, "above", 105, 110]
                : b.dataset.normal === "standard"
                  ? [0, 1, "between", -1.96, 1.96]
                  : [10, 2, "between", 7, 9];
            [
              "normal-mean",
              "normal-sd",
              "normal-mode",
              "normal-low",
              "normal-high",
            ].forEach(
              (id, i) => (node.querySelector("#" + id).value = vals[i]),
            );
            update();
          }),
        );
      },
    },
    "uniform-distribution": {
      title: "An interval on a uniform distribution",
      intro:
        "Keep a fixed support [5,50] and change the requested interval. Only overlap with the support can contribute probability.",
      build(node) {
        node.innerHTML =
          `<div class="activity-controls">${input("uniform-low", "Lower interval bound", 20)}${input("uniform-high", "Upper interval bound", 35)}</div>` +
          output("uniform");
        reactive(node, "uniform", (out) => {
          const lo = read("uniform-low"),
            hi = read("uniform-high");
          if (hi < lo)
            throw new Error("Upper bound must be at least the lower bound.");
          const width = Math.max(0, Math.min(hi, 50) - Math.max(lo, 5));
          out.innerHTML = `<div class="formula" id="uniform-probability">P(lower &lt; X &lt; upper) = ${probability(width / 45)}</div><p>Width of overlap = ${number(width)}. Divide by the support width, 45. Mean = 27.5; variance = 168.75; SD ≈ 12.990.</p><p>A single exact value still has probability zero. A requested interval outside [5,50] has zero probability.</p>`;
        });
      },
    },
    "descriptive-statistics": {
      title: "Edit a sample, inspect its summaries",
      intro:
        "Enter 2–2,000 finite numbers, separated by commas or spaces. This is a toy teaching sample; do not enter personal patient records.",
      build(node) {
        node.innerHTML =
          '<div class="control"><label for="describe-values">Sample values</label><textarea id="describe-values" rows="3">1, 1, 3, 3, 3, 4, 7, 9, 10, 12, 12</textarea></div>' +
          output("describe");
        reactive(node, "describe", (out) => {
          const raw = node.querySelector("textarea").value.trim();
          const parts = raw ? raw.split(/[\s,;]+/) : [];
          const values = parts.map(Number);
          if (
            parts.length < 2 ||
            parts.length > 2000 ||
            values.some((x) => !Number.isFinite(x) || Math.abs(x) > 1e12)
          )
            throw new Error(
              "Enter 2–2,000 valid finite numbers (absolute value at most 10¹²).",
            );
          const d = describe(values),
            bins = 6,
            start = d.range ? d.min : d.min - 0.5,
            width = d.range ? d.range / bins : 1 / bins,
            frequencies = Array(bins).fill(0);
          values.forEach(
            (x) =>
              frequencies[
                Math.min(bins - 1, Math.floor((x - start) / width))
              ]++,
          );
          out.innerHTML = `<dl class="activity-stats"><div><dt>n</dt><dd>${d.n}</dd></div><div><dt>Mean</dt><dd>${number(d.mean)}</dd></div><div><dt>Median</dt><dd>${number(d.median)}</dd></div><div><dt>Sample variance</dt><dd>${number(d.variance)}</dd></div><div><dt>Sample SD</dt><dd>${number(d.sd)}</dd></div><div><dt>Range</dt><dd>${number(d.range)}</dd></div></dl><p>Mode(s): ${d.maxCount === 1 ? "All values equally frequent (no repeated value)" : d.modes.map((x) => number(x)).join(", ")}.</p>${bars(
            frequencies,
            frequencies.map((_, i) => number(start + (i + 0.5) * width, 2)),
            "Frequency histogram of the entered sample. Labels are bin centres.",
          )}<p class="small">Histogram labels are bin centres; the last bin includes the maximum. Sample variance uses n−1, not n. No inferential test is performed on these values.</p>`;
        });
      },
    },
    "study-design": {
      title: "Spot the design",
      intro:
        "Identify how participants were selected and how exposures were assigned. Select a design to see the reasoning.",
      build(node) {
        const cases = [
          [
            "A clinic measures current sleep and blood pressure in 200 adults during one survey.",
            "Cross-sectional",
            "Both variables are measured in one survey; there is no follow-up or random assignment.",
          ],
          [
            "Researchers record smoking history in healthy adults, then follow them for five years.",
            "Cohort",
            "A defined group is followed over time. Smoking is observed, not randomly assigned.",
          ],
          [
            "Investigators recruit patients with liver disease and controls without it, then ask about past exposures.",
            "Case-control",
            "Selection begins with disease status, then examines previous exposure.",
          ],
          [
            "Eligible patients are allocated by a random sequence to surgery or a sling.",
            "RCT",
            "Treatment is actively assigned using random allocation.",
          ],
          [
            "A team introduces a service and compares visits before and after, without random allocation.",
            "Before–after",
            "The intervention is researcher-controlled, but the allocation is not random. Time trends may confound it.",
          ],
        ];
        const labels = [
          "Cross-sectional",
          "Cohort",
          "Case-control",
          "RCT",
          "Before–after",
        ];
        let i = 0;
        const render = () => {
          node.innerHTML = `<p class="eyebrow">Scenario ${i + 1} / ${cases.length}</p><p>${cases[i][0]}</p><div class="activity-presets">${labels.map((s, k) => `<button type="button" class="btn secondary" data-design="${k}">${s}</button>`).join("")}</div><p id="design-feedback" class="note" role="status" hidden></p><button type="button" class="btn small-btn" id="design-next">Next scenario →</button>`;
          node.querySelectorAll("[data-design]").forEach((b) =>
            b.addEventListener("click", () => {
              const feedback = node.querySelector("#design-feedback");
              feedback.hidden = false;
              feedback.textContent =
                (labels[Number(b.dataset.design)] === cases[i][1]
                  ? "Correct. "
                  : "Revisit: " + cases[i][1] + ". ") + cases[i][2];
            }),
          );
          node.querySelector("#design-next").addEventListener("click", () => {
            i = (i + 1) % cases.length;
            render();
            node.querySelector("[data-design]").focus();
          });
        };
        render();
      },
    },
    "hypothesis-test": {
      title: "One mean, three views of the evidence",
      intro:
        "A two-sided one-sample test. Specify known population SD for z or sample SD for t. For small samples, the normal-population assumption is essential.",
      build(node) {
        node.innerHTML =
          `<div class="activity-controls">${select("test-kind", "Reference", [
            ["t", "Unknown population SD: t"],
            ["z", "Known population SD: z"],
          ])}${input("test-mean", "Sample mean", 5)}${input("test-null", "Null population mean", 7)}${input("test-sd", "SD (sample s for t; population σ for z)", 3, 'min="0.000001" step="any"')}${input("test-n", "Sample size n", 20, 'min="2" max="100000" step="1"')}${select(
            "test-alpha",
            "Significance level",
            [
              ["0.05", "5%"],
              ["0.01", "1%"],
              ["0.10", "10%"],
            ],
          )}${select("test-assumption", "Population shape", [
            ["normal", "Assume a normal population"],
            ["unknown", "Population shape unknown"],
          ])}</div>` + output("test");
        reactive(node, "test", (out) => {
          const n = read("test-n", 2, 100000, true),
            mean = read("test-mean", -1e6, 1e6),
            nullMean = read("test-null", -1e6, 1e6),
            sd = read("test-sd", 1e-6, 1e6),
            alpha = Number(node.querySelector("#test-alpha").value),
            known = node.querySelector("#test-kind").value === "z";
          if (
            n < 30 &&
            node.querySelector("#test-assumption").value === "unknown"
          )
            throw new Error(
              "For n < 30 and unknown population shape, this course’s normal/t reference is not justified. Use a suitable method after checking the distribution.",
            );
          const r = oneMean({ mean, nullMean, sd, n, alpha, known });
          out.innerHTML = `<div class="formula" id="test-decision">${r.decision} at ${number(alpha * 100)}%</div><dl class="activity-stats"><div><dt>Standard error</dt><dd>${number(r.se)}</dd></div><div><dt>${known ? "z statistic" : "t statistic"}</dt><dd>${number(r.statistic)}</dd></div><div><dt>df</dt><dd>${known ? "Not applicable" : r.df}</dd></div><div><dt>Two-sided p-value</dt><dd id="test-p">${probability(r.p)}</dd></div><div><dt>Critical values</dt><dd>±${number(r.critical)}</dd></div><div><dt>${number((1 - alpha) * 100)}% CI</dt><dd id="test-ci">${number(r.lower)} – ${number(r.upper)}</dd></div></dl><p>H₀: μ = ${number(nullMean)}; H₁: μ ≠ ${number(nullMean)}. The null value is ${nullMean < r.lower || nullMean > r.upper ? "outside" : "inside or on the boundary of"} the matching interval.</p><p>${r.decision.startsWith("Reject") ? "The sample supports a mean " + (mean > nullMean ? "above" : "below") + " the null value under the assumptions." : "This does not prove H₀ or demonstrate equivalence."}</p><p class="small">Assumes independent observations. Exact for a normal population with the stated SD conditions; otherwise a large-sample approximation. n ≥ 30 is a course rule of thumb and can be inadequate with strong skewness or extreme tails. The calculator follows the lecture’s equality convention at p = α.</p>`;
        });
      },
    },
    "demand-curve": {
      title: "Move along it. Then shift it.",
      intro:
        "A stylised linear healthcare-demand curve. Change the patient price, then change a non-price demand factor. The numbers are teaching values, not empirical estimates.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          '<div class="control"><label for="demand-price">Patient price (€)</label><input id="demand-price" type="range" min="0" max="100" value="50" step="1"><div class="range-labels"><span>0</span><span>50</span><span>100</span></div></div>' +
          '<div class="control"><label for="demand-shift">Demand shift</label><select id="demand-shift"><option value="-15">Lower demand</option><option value="0" selected>Baseline</option><option value="15">Higher demand</option></select></div>' +
          '</div>' + output("demand");
        reactive(node, "demand", (out) => {
          const price = read("demand-price", 0, 100),
            shift = Number(node.querySelector("#demand-shift").value),
            intercept = 100 + shift,
            quantity = Math.max(0, intercept - price);
          const x = (q) => 55 + (q / 120) * 520,
            y = (p) => 225 - (p / 120) * 185,
            qMax = Math.max(0, intercept);
          out.innerHTML =
            '<div class="formula">Quantity demanded = ' + number(quantity, 0) + '</div>' +
            '<svg class="activity-chart" viewBox="0 0 640 280" role="img" aria-label="Stylised linear demand curve with the selected price and quantity marked.">' +
            '<path d="M55 25V225H610" fill="none" stroke="currentColor"/>' +
            '<path d="M' + x(0) + ' ' + y(intercept) + ' L' + x(Math.min(qMax,120)) + ' ' + y(0) + '" fill="none" stroke="#628473" stroke-width="4"/>' +
            '<path d="M55 ' + y(price) + 'H' + x(quantity) + 'V225" fill="none" stroke="#cc6f4f" stroke-width="2" stroke-dasharray="5 5"/>' +
            '<circle cx="' + x(quantity) + '" cy="' + y(price) + '" r="7" fill="#cc6f4f"/>' +
            '<text x="58" y="16" fill="currentColor" font-size="12">Price</text><text x="555" y="250" fill="currentColor" font-size="12">Quantity</text>' +
            '<text x="' + (x(quantity)+8) + '" y="' + (y(price)-8) + '" fill="currentColor" font-size="12">P=' + number(price,0) + ', Q=' + number(quantity,0) + '</text></svg>' +
            '<p><strong>Own-price change:</strong> move the price slider. You move along the same curve.</p>' +
            '<p><strong>Non-price change:</strong> change the demand-shift control. The whole curve moves because quantity demanded changes at every price.</p>';
        });
      },
    },
    "consumer-surplus": {
      title: "Who buys, and how much surplus do they receive?",
      intro:
        "A hypothetical service with four buyers. Change the price and see who remains in the market. The willingness-to-pay values are invented for teaching.",
      build(node) {
        const buyers = [
          ["Amina", 95],
          ["Luca", 75],
          ["Marta", 55],
          ["Jonas", 35],
        ];
        node.innerHTML =
          '<div class="control"><label for="surplus-price">Market price (€): <strong id="surplus-price-value">60</strong></label><input id="surplus-price" type="range" min="0" max="100" value="60" step="5"><div class="range-labels"><span>0</span><span>50</span><span>100</span></div></div>' +
          output("surplus");
        reactive(node, "surplus", (out) => {
          const price = read("surplus-price", 0, 100);
          node.querySelector("#surplus-price-value").textContent = number(price,0);
          const active = buyers.filter(([,wtp]) => wtp >= price);
          const total = active.reduce((s,[,wtp]) => s + wtp - price, 0);
          out.innerHTML =
            '<div class="formula">Total consumer surplus = €' + number(total,0) + '</div>' +
            '<div class="table-scroll"><table><thead><tr><th>Buyer</th><th>WTP</th><th>Buys?</th><th>Surplus</th></tr></thead><tbody>' +
            buyers.map(([name,wtp]) => '<tr><td>'+escape(name)+'</td><td>€'+wtp+'</td><td>'+(wtp>=price?'Yes':'No')+'</td><td>'+(wtp>=price?'€'+number(wtp-price,0):'—')+'</td></tr>').join("") +
            '</tbody></table></div>' +
            '<p>'+active.length+' of 4 buyers participate at this price. The marginal participating buyer is the one with the lowest WTP among those still buying; if WTP exactly equals price, that buyer receives zero surplus.</p>';
        });
      },
    },
    "arc-elasticity": {
      title: "Calculate arc elasticity",
      intro:
        "Enter two price-quantity observations. The midpoint formula treats the two endpoints symmetrically and gives a unit-free measure of responsiveness.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("arc-p1","Price P₁",20,'min="0.000001" step="any"') +
          input("arc-q1","Quantity Q₁",12,'min="0.000001" step="any"') +
          input("arc-p2","Price P₂",30,'min="0.000001" step="any"') +
          input("arc-q2","Quantity Q₂",10,'min="0.000001" step="any"') +
          '</div>' + output("arc");
        reactive(node, "arc", (out) => {
          const p1=read("arc-p1",1e-6,1e9), q1=read("arc-q1",1e-6,1e9),
            p2=read("arc-p2",1e-6,1e9), q2=read("arc-q2",1e-6,1e9);
          if (p1===p2) throw new Error("The two prices must differ to calculate price elasticity.");
          const dq=(q2-q1)/((q1+q2)/2),
            dp=(p2-p1)/((p1+p2)/2),
            e=dq/dp,
            magnitude=Math.abs(e),
            label=magnitude<1-1e-10?"Inelastic":magnitude>1+1e-10?"Elastic":"Approximately unit elastic";
          out.innerHTML =
            '<div class="formula">Arc elasticity = ' + number(e,3) + '</div>' +
            '<dl class="activity-stats"><div><dt>Midpoint %ΔQ</dt><dd>'+number(dq*100,2)+'%</dd></div><div><dt>Midpoint %ΔP</dt><dd>'+number(dp*100,2)+'%</dd></div><div><dt>|ε|</dt><dd>'+number(magnitude,3)+'</dd></div><div><dt>Classification</dt><dd>'+label+'</dd></div></dl>' +
            '<p>For a standard downward-sloping demand relationship, price and quantity move in opposite directions, so elasticity is negative. Classification normally uses the absolute value.</p>';
        });
      },
    },
    "full-price": {
      title: "Calculate the full price of a visit",
      intro:
        "The clinic bill is only one component. Add travel, waiting, treatment time and the opportunity cost of time.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("full-money","Patient monetary price (€)",40,'min="0" step="any"') +
          input("full-travel-cost","Travel / parking cost (€)",4,'min="0" step="any"') +
          input("full-hourly","Value of time (€/hour)",12,'min="0" step="any"') +
          input("full-oneway","Travel time each way (minutes)",15,'min="0" step="any"') +
          input("full-wait","Waiting time (minutes)",25,'min="0" step="any"') +
          input("full-visit","Time receiving care (minutes)",30,'min="0" step="any"') +
          '</div>' + output("full");
        reactive(node, "full", (out) => {
          const money=read("full-money",0,1e7),
            travelCost=read("full-travel-cost",0,1e7),
            hourly=read("full-hourly",0,1e7),
            oneWay=read("full-oneway",0,1440),
            wait=read("full-wait",0,1440),
            visit=read("full-visit",0,1440),
            minutes=2*oneWay+wait+visit,
            timeCost=hourly*minutes/60,
            full=money+travelCost+timeCost;
          out.innerHTML =
            '<div class="formula">Full price = €' + number(full,2) + '</div>' +
            '<dl class="activity-stats"><div><dt>Money price</dt><dd>€'+number(money,2)+'</dd></div><div><dt>Travel cost</dt><dd>€'+number(travelCost,2)+'</dd></div><div><dt>Total time</dt><dd>'+number(minutes,0)+' min</dd></div><div><dt>Time cost</dt><dd>€'+number(timeCost,2)+'</dd></div></dl>' +
            '<p>If insurance lowers the money price but these other costs do not change, time and travel become a larger share of the patient’s full price.</p>';
        });
      },
    },
    "cost-sharing": {
      title: "Compare what the patient pays",
      intro:
        "A simplified one-service comparison of four contract forms introduced in Session 2. It ignores annual caps, networks, exclusions and other real-world contract details.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("share-price","Market price of service (€)",120,'min="0" step="any"') +
          input("share-indemnity","Fixed indemnity paid by insurer (€)",50,'min="0" step="any"') +
          input("share-rate","Coinsurance paid by patient (%)",20,'min="0" max="100" step="1"') +
          input("share-copay","Copayment (€)",25,'min="0" step="any"') +
          input("share-deductible","Deductible remaining before coverage (€)",80,'min="0" step="any"') +
          '</div>' + output("share");
        reactive(node, "share", (out) => {
          const price=read("share-price",0,1e9),
            indemnity=read("share-indemnity",0,1e9),
            rate=read("share-rate",0,100)/100,
            copay=read("share-copay",0,1e9),
            deductible=read("share-deductible",0,1e9);
          const vals=[
            ["No insurance",price],
            ["Fixed indemnity",Math.max(0,price-indemnity)],
            ["Coinsurance",price*rate],
            ["Copayment",Math.min(price,copay)],
            ["Deductible remaining",Math.min(price,deductible)]
          ];
          out.innerHTML =
            '<div class="table-scroll"><table><thead><tr><th>Arrangement</th><th>Patient pays now</th><th>What changes?</th></tr></thead><tbody>' +
            vals.map(([name,v],i)=>'<tr><td>'+name+'</td><td>€'+number(v,2)+'</td><td>'+[
              "Full service price",
              "Market price minus a fixed insurer contribution",
              "A percentage of the bill",
              "A fixed amount per use, capped here at the service price",
              "Up to the deductible amount still unmet"
            ][i]+'</td></tr>').join("") +
            '</tbody></table></div><p class="small">This is a teaching comparison for one service. A real deductible interacts with cumulative annual spending and later coverage; actual contracts can combine several forms of cost-sharing.</p>';
        });
      },
    },
    "health-stock": {
      title: "Follow the health stock through one period",
      intro:
        "Use the Grossman stock equation. Change inherited health, depreciation and gross investment. The numbers are stylised teaching units, not clinical measurements.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("health-prev","Inherited health H(t−1)",80,'min="0" max="200" step="1"') +
          input("health-delta","Depreciation δ (%)",10,'min="0" max="100" step="1"') +
          input("health-invest","Gross investment I(t−1)",12,'min="0" max="200" step="1"') +
          '</div>' + output("healthstock");
        reactive(node, "healthstock", (out) => {
          const h=read("health-prev",0,200),
            delta=read("health-delta",0,100)/100,
            invest=read("health-invest",0,200),
            deterioration=delta*h,
            surviving=(1-delta)*h,
            next=surviving+invest,
            net=invest-deterioration;
          const direction = Math.abs(net) < 1e-9 ? "maintained" : net > 0 ? "rises" : "falls";
          out.innerHTML =
            '<div class="formula">Hₜ = (1 − δ)Hₜ₋₁ + Iₜ₋₁ = ' + number(next,2) + '</div>' +
            '<dl class="activity-stats"><div><dt>Inherited stock</dt><dd>'+number(h,2)+'</dd></div><div><dt>Deterioration δH</dt><dd>'+number(deterioration,2)+'</dd></div><div><dt>Surviving stock</dt><dd>'+number(surviving,2)+'</dd></div><div><dt>Gross investment</dt><dd>'+number(invest,2)+'</dd></div><div><dt>Net investment</dt><dd>'+number(net,2)+'</dd></div><div><dt>Result</dt><dd>Health '+direction+'</dd></div></dl>' +
            '<p>Gross investment is the chosen inflow. Net investment subtracts deterioration. It can be negative even though gross investment is not.</p>';
        });
      },
    },
    "grossman-ppf": {
      title: "Explore the Grossman PPF",
      intro:
        "A stylised frontier with a rising free-lunch region and a falling trade-off region. Move along it to see why the frontier is not a standard straight trade-off.",
      build(node) {
        node.innerHTML =
          '<div class="control"><label for="ppf-health">Chosen health position: <strong id="ppf-health-value">60</strong></label><input id="ppf-health" type="range" min="5" max="95" value="60" step="1"><div class="range-labels"><span>Low H</span><span>Peak Z</span><span>High H</span></div></div>' +
          output("ppf");
        reactive(node, "ppf", (out) => {
          const h=read("ppf-health",5,95);
          node.querySelector("#ppf-health-value").textContent=number(h,0);
          const z=(x)=>Math.max(0,20+1.7*x-0.015*x*x);
          const peak=1.7/(2*0.015);
          const zone=h<peak ? "Free-lunch zone" : "Trade-off zone";
          let path="";
          for(let x=5;x<=95;x+=2){
            const px=55+(x-5)/90*520,
              py=225-(z(x)/70)*180;
            path+=(x===5?"M":"L")+px+" "+py+" ";
          }
          const px=55+(h-5)/90*520,
            py=225-(z(h)/70)*180,
            peakX=55+(peak-5)/90*520,
            peakY=225-(z(peak)/70)*180;
          out.innerHTML =
            '<div class="formula">'+zone+'</div>' +
            '<svg class="activity-chart" viewBox="0 0 640 280" role="img" aria-label="Stylised Grossman production possibility frontier showing an upward free-lunch section and a downward trade-off section.">' +
            '<path d="M55 25V225H610" fill="none" stroke="currentColor"/>' +
            '<path d="'+path+'" fill="none" stroke="#628473" stroke-width="4"/>' +
            '<path d="M'+peakX+' 35V225" stroke="#a2b199" stroke-dasharray="4 4"/>' +
            '<circle cx="'+px+'" cy="'+py+'" r="7" fill="#cc6f4f"/>' +
            '<text x="57" y="17" fill="currentColor" font-size="12">Home good Z</text><text x="535" y="250" fill="currentColor" font-size="12">Health H</text>' +
            '<text x="'+(peakX+7)+'" y="'+(peakY-8)+'" fill="currentColor" font-size="11">maximum Z</text></svg>' +
            (h<peak
              ? '<p>At this low-health position, a health improvement can release enough sick time to increase both H and Z. Moving toward the peak does not require sacrificing Z.</p>'
              : '<p>Beyond the peak, extra health yields smaller time gains. Increasing H now uses resources that could have produced Z, so the frontier slopes downward.</p>') +
            '<p class="small">This curve is an original teaching illustration of the lecture logic. Its coordinates are not data and do not reproduce the official figure.</p>';
        });
      },
    },
    "mec-equilibrium": {
      title: "Find the Grossman health-capital equilibrium",
      intro:
        "A stylised MEC curve meets a user-cost line r + δ. Change depreciation, the alternative return and a productivity shifter to see how optimal H responds.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("mec-r","Alternative return r (%)",5,'min="0" max="30" step="1"') +
          input("mec-delta","Depreciation δ (%)",10,'min="0" max="40" step="1"') +
          '<div class="control"><label for="mec-shift">MEC productivity / value shifter</label><input id="mec-shift" type="range" min="70" max="140" value="100" step="5"><div class="range-labels"><span>lower</span><span>baseline</span><span>higher</span></div></div>' +
          '</div>' + output("mec");
        reactive(node, "mec", (out) => {
          const r=read("mec-r",0,30),
            delta=read("mec-delta",0,40),
            shift=read("mec-shift",70,140)/100,
            cost=r+delta,
            intercept=40*shift,
            slope=0.3,
            hStar=Math.max(0,Math.min(100,(intercept-cost)/slope)),
            x=(h)=>55+h/100*520,
            y=(ret)=>225-ret/60*185;
          const yCost=y(cost);
          out.innerHTML =
            '<div class="formula">Stylised H* = '+number(hStar,1)+' · user cost r + δ = '+number(cost,1)+'%</div>' +
            '<svg class="activity-chart" viewBox="0 0 640 280" role="img" aria-label="Stylised marginal efficiency of health capital curve and horizontal user-cost line.">' +
            '<path d="M55 25V225H610" fill="none" stroke="currentColor"/>' +
            '<path d="M55 '+y(intercept)+' L575 '+y(Math.max(0,intercept-slope*100))+'" fill="none" stroke="#628473" stroke-width="4"/>' +
            '<path d="M55 '+yCost+'H575" fill="none" stroke="#cc6f4f" stroke-width="3"/>' +
            '<path d="M'+x(hStar)+' '+yCost+'V225" stroke="#a2b199" stroke-dasharray="4 4"/>' +
            '<circle cx="'+x(hStar)+'" cy="'+yCost+'" r="7" fill="#153d35"/>' +
            '<text x="58" y="17" fill="currentColor" font-size="12">Return / cost</text><text x="535" y="250" fill="currentColor" font-size="12">Health H</text>' +
            '<text x="65" y="'+(yCost-8)+'" fill="#cc6f4f" font-size="11">r + δ</text><text x="400" y="'+(y(intercept-slope*65)-10)+'" fill="#628473" font-size="11">MEC</text></svg>' +
            '<p>Higher depreciation raises the user cost and moves the equilibrium left. A stronger return to healthy time or greater production efficiency can shift the MEC outward and move H* right.</p>' +
            '<p class="small">The numerical curve is deliberately stylised. Use it for direction and intuition, not as an empirical calibration.</p>';
        });
      },
    },
    "grossman-drivers": {
      title: "Health or healthcare? Compare the directions.",
      intro:
        "Select one comparative-static change. Session 3 distinguishes the predicted effect on optimal health from the effect on the healthcare input used to produce it.",
      build(node) {
        const drivers = {
          age:["Age / depreciation rises","Optimal health falls","Healthcare demand is ambiguous","Faster depreciation raises the cost of holding health capital. Desired H falls, but more healthcare may be needed to maintain any given H."],
          wage:["Wage rises","Optimal health rises","Healthcare demand rises","Healthy productive time becomes more valuable, shifting the MEC outward in the lecture."],
          education:["Education rises","Optimal health rises","Healthcare demand is ambiguous","Education makes health production more efficient: desired H rises, while fewer healthcare inputs may be needed per unit of health."],
          price:["Medical-care price falls","Optimal health rises","Healthcare demand rises","Cheaper healthcare lowers the cost of producing health, so the lecture predicts more health and more healthcare."]
        };
        node.innerHTML =
          '<div class="activity-presets">'+
          Object.entries(drivers).map(([id,v])=>'<button type="button" class="btn secondary" data-grossman-driver="'+id+'">'+escape(v[0])+'</button>').join("")+
          '</div><div id="grossman-driver-output" class="activity-output" aria-live="polite"></div>';
        const show=(id)=>{
          const v=drivers[id];
          node.querySelectorAll("[data-grossman-driver]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.grossmanDriver===id)));
          node.querySelector("#grossman-driver-output").innerHTML =
            '<div class="grid2"><article class="card"><span class="eyebrow">Demand for health</span><h3>'+escape(v[1])+'</h3></article><article class="card"><span class="eyebrow">Demand for healthcare</span><h3>'+escape(v[2])+'</h3></article></div><p>'+escape(v[3])+'</p>';
        };
        node.querySelectorAll("[data-grossman-driver]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.grossmanDriver)));
        show("age");
      },
    },
  };
  root.LectureActivities = {
    init(container, activityIds) {
      container.textContent = "";
      for (const id of activityIds) {
        const d = definitions[id];
        if (!d) continue;
        const article = document.createElement("article");
        article.className = "card extended-activity";
        article.dataset.activity = id;
        const heading = document.createElement("h3");
        heading.textContent = d.title;
        const intro = document.createElement("p");
        intro.textContent = d.intro;
        const node = document.createElement("div");
        article.append(heading, intro, node);
        container.append(article);
        d.build(node);
      }
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
