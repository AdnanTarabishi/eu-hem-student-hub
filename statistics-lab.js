/* EU-HEM Interactive Statistics Lab v1. Original interface and explanations.
 * Single, reusable mount point; no network requests, analytics or stored learner data.
 */
(function (root) {
  "use strict";
  const M = root.StatisticsLabMath;
  const modes = ["between", "left", "right", "outside"];
  const number = (n, digits = 4) => {
    if (n === 0) return "0";
    if (Math.abs(n) >= 1e7 || Math.abs(n) < 1e-4) return n.toExponential(3);
    return Number(n.toFixed(digits)).toString();
  };
  const prob = (p, digits = 6) => p > 0 && p < Math.pow(10, -digits)
    ? p.toExponential(4) : p.toFixed(digits);
  const escape = (v) => String(v).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  const field = (id, label, value, extra = "") => `<label class="sl-field" for="sl-${id}"><span>${label}</span><input id="sl-${id}" name="${id}" type="number" step="any" value="${value}" inputmode="decimal" ${extra}></label>`;

  function mount(host) {
    if (!host || host.dataset.statisticsLabMounted) return;
    host.dataset.statisticsLabMounted = "true";
    host.classList.add("sl-lab");
    if (!M) {
      host.textContent = "The calculation engine did not load. Reload this page to try again.";
      return;
    }
    const $ = (id) => host.querySelector(`#sl-${id}`);
    let state = { mu: 1, sigma: 1, a: -1, b: 2, mode: "between" };
    let tableState = { z: 1.96, view: "left", sign: 1 };
    let active = "normal", tableSign = 0, lastSolution = "", lastNormalResult = null;
    const query = new URLSearchParams(location.search);
    for (const [key, param] of [["mu", "labmu"], ["sigma", "labsd"], ["a", "laba"], ["b", "labb"]]) {
      const value = query.get(param);
      if (value !== null && value.trim() !== "" && Number.isFinite(Number(value))) state[key] = Number(value);
    }
    if (modes.includes(query.get("labarea"))) state.mode = query.get("labarea");
    if (query.has("labz") && query.get("labz").trim() && Number.isFinite(Number(query.get("labz")))) tableState.z = Number(query.get("labz"));
    if (["left", "right", "two"].includes(query.get("labview"))) tableState.view = query.get("labview");
    tableState.sign = tableState.z < 0 ? -1 : 1;
    if (query.get("labtool") === "ztable") active = "ztable";

    host.innerHTML = `
      <header class="sl-header">
        <div><p class="sl-eyebrow">STATISTICS FOR HEALTHCARE <span>LAB / 01</span></p>
        <h1>See the probability.<br><em>Understand the steps.</em></h1>
        <p class="sl-lead">A normal curve, a Z-table and the reasoning that connects them.</p></div>
        <div class="sl-header-note"><span class="sl-version">Interactive Lab · v1</span><p>Change a value.<br>Watch the area.<br>Make it make sense.</p><span class="sl-small">Original student-built study tool</span></div>
      </header>
      <div class="sl-toolbar">
        <div class="sl-tabs" role="tablist" aria-label="Statistics lab tools">
          <button id="sl-tab-normal" type="button" role="tab" aria-selected="true" aria-controls="sl-panel-normal">01 <span>Normal distribution</span></button>
          <button id="sl-tab-ztable" type="button" role="tab" aria-selected="false" aria-controls="sl-panel-ztable" tabindex="-1">02 <span>Interactive Z-table</span></button>
        </div>
        <button class="sl-text-button" type="button" id="sl-share">Copy setup link ↗</button>
      </div>
      <section id="sl-panel-normal" role="tabpanel" aria-labelledby="sl-tab-normal">
        <div class="sl-workspace">
          <div class="sl-controls sl-card">
            <p class="sl-eyebrow">YOUR QUESTION</p><h2>Define the distribution</h2>
            <p class="sl-small">X is normally distributed. Enter the mean and <strong>standard deviation</strong>, not the variance.</p>
            <form id="sl-normal-form" novalidate>
              <div class="sl-fields">${field("mu", "Mean · μ", 1)}${field("sigma", "Standard deviation · σ", 1, 'min="0" aria-describedby="sl-sd-help sl-normal-error"')}</div>
              <p id="sl-sd-help" class="sl-hint">σ must be greater than 0. All X values use the same units.</p>
              <label class="sl-field" for="sl-mode"><span>Which area do you need?</span><select id="sl-mode"><option value="between">Between two values · a &lt; X &lt; b</option><option value="left">Left tail · X &lt; b</option><option value="right">Right tail · X &gt; a</option><option value="outside">Outside an interval · X &lt; a or X &gt; b</option></select></label>
              <div class="sl-fields"><div id="sl-a-wrap">${field("a", "Lower bound · a", -1, 'aria-describedby="sl-normal-error"')}</div><div id="sl-b-wrap">${field("b", "Upper bound · b", 2, 'aria-describedby="sl-normal-error"')}</div></div>
              <div id="sl-sliders" class="sl-sliders">
                <label id="sl-a-slider-wrap" for="sl-a-slider">Move a <span id="sl-a-slider-label"></span><input id="sl-a-slider" type="range" min="-5" max="5" step="0.01" value="-2"></label>
                <label id="sl-b-slider-wrap" for="sl-b-slider">Move b <span id="sl-b-slider-label"></span><input id="sl-b-slider" type="range" min="-5" max="5" step="0.01" value="1"></label>
                <p class="sl-hint">Sliders explore ±5 standard deviations. Type other bounds above.</p>
              </div>
              <p id="sl-normal-error" class="sl-error" role="alert" hidden></p>
              <button type="submit" class="sl-button">Calculate &amp; explain <span aria-hidden="true">→</span></button>
            </form>
            <div class="sl-examples"><span class="sl-eyebrow">TRY A QUESTION</span><button type="button" data-example="class">Your class example · μ = 1, σ = 1</button><button type="button" data-example="central">The central 95% · z = ±1.96</button><button type="button" data-example="health">A hypothetical measurement</button></div>
            <button type="button" id="sl-reset" class="sl-text-button">Reset to class example</button>
          </div>
          <div class="sl-results" id="sl-normal-results">
            <article class="sl-card sl-chart-card">
              <div class="sl-chart-heading"><div><p class="sl-eyebrow">THE SHADED AREA IS YOUR ANSWER</p><h2 id="sl-expression"></h2></div><span class="sl-chip" id="sl-distribution"></span></div>
              <svg id="sl-normal-graph" class="sl-graph" viewBox="0 0 760 345" role="img" aria-labelledby="sl-normal-graph-title sl-normal-graph-desc"></svg>
              <div class="sl-legend"><span><i class="sl-legend-area"></i>Selected probability</span><span><i class="sl-legend-line"></i>Normal density</span></div>
              <p class="sl-hint" id="sl-chart-note">Drag either boundary dot, use the sliders, or type a value. The horizontal axis automatically scales to μ and σ.</p>
              <div class="sl-answer" aria-live="polite" aria-atomic="true"><div><span class="sl-eyebrow">CALCULATED PROBABILITY</span><strong id="sl-answer-value"></strong><span id="sl-answer-percent"></span></div><p id="sl-answer-words"></p></div>
              <p class="sl-hint" id="sl-example-note">Teaching example: X has mean 1 and standard deviation 1.</p>
            </article>
            <div class="sl-precision sl-card"><span class="sl-number-icon" aria-hidden="true">≈</span><div><h3>Why your table may give a slightly different answer</h3><p id="sl-rounding-note"></p><p class="sl-hint">The calculation keeps unrounded z-scores. The table method rounds z to 2 decimals and each cumulative probability to 4 decimals.</p></div></div>
          </div>
        </div>
        <section class="sl-walkthrough" aria-labelledby="sl-steps-title"><div class="sl-section-heading"><div><p class="sl-eyebrow">NOT JUST THE ANSWER</p><h2 id="sl-steps-title">Work through the calculation.</h2></div><button type="button" id="sl-copy-solution" class="sl-text-button">Copy worked solution</button></div><div id="sl-steps" class="sl-steps"></div></section>
      </section>
      <section id="sl-panel-ztable" role="tabpanel" aria-labelledby="sl-tab-ztable" hidden>
        <div class="sl-table-top">
          <div class="sl-card sl-controls"><p class="sl-eyebrow">FROM Z TO AN AREA</p><h2>Look up a z-score</h2><p class="sl-small">The table always shows <strong>Φ(z) = P(Z ≤ z)</strong>: the cumulative area to the left.</p>
            <form id="sl-z-form" novalidate>${field("z", "Z-score", 1.96, 'min="-12" max="12" aria-describedby="sl-z-error"')}<label class="sl-field" for="sl-z-view"><span>Shade the curve</span><select id="sl-z-view"><option value="left">Left tail · P(Z ≤ z)</option><option value="right">Right tail · P(Z &gt; z)</option><option value="two">Two tails · P(|Z| &gt; |z|)</option></select></label><p id="sl-z-error" class="sl-error" role="alert" hidden></p><button type="submit" class="sl-button">Look up &amp; find cell <span aria-hidden="true">→</span></button></form>
            <div class="sl-quick"><span>Try</span><button type="button" data-z="-1.96">−1.96</button><button type="button" data-z="0">0</button><button type="button" data-z="1.96">1.96</button></div>
            <div class="sl-table-instructions"><h3>Read it in three moves</h3><p>1. Choose the positive or negative table.<br>2. Find the row for the first decimal.<br>3. Use the column for the second decimal.</p><p id="sl-cell-explanation" class="sl-formula"></p></div>
          </div>
          <article class="sl-card sl-chart-card" id="sl-z-results"><div class="sl-chart-heading"><div><p class="sl-eyebrow">CONNECT THE CELL TO THE CURVE</p><h2 id="sl-z-expression"></h2></div><span class="sl-chip">Z ~ N(0, 1)</span></div>
            <svg id="sl-z-graph" class="sl-graph" viewBox="0 0 760 345" role="img" aria-labelledby="sl-z-graph-title sl-z-graph-desc"></svg>
            <div class="sl-z-metrics" aria-live="polite" aria-atomic="true"><div><span>Left tail · Φ(z)</span><strong id="sl-z-left"></strong></div><div><span>Right tail · 1 − Φ(z)</span><strong id="sl-z-right"></strong></div><div><span>Outside ±|z|</span><strong id="sl-z-two"></strong></div></div>
            <p class="sl-hint">Two tails means the area outside the symmetric interval [−|z|, +|z|]. It is not the area between those limits.</p><p id="sl-z-rounding" class="sl-small"></p>
          </article>
        </div>
        <section class="sl-card sl-table-card" aria-labelledby="sl-table-title"><div class="sl-section-heading"><div><p class="sl-eyebrow">THE STANDARD NORMAL TABLE</p><h2 id="sl-table-title">Find the row. Follow the column.</h2></div><div class="sl-signs" role="group" aria-label="Table sign"><button type="button" id="sl-positive" aria-pressed="true">Positive z</button><button type="button" id="sl-negative" aria-pressed="false">Negative z</button></div></div>
          <p class="sl-small" id="sl-table-status" role="status"></p>
          <div class="sl-table-scroll" id="sl-table-scroll" tabindex="0" role="region" aria-label="Scrollable standard normal table"><table id="sl-z-table"><caption>Left-tail probabilities Φ(z), rounded to four decimal places.</caption><thead></thead><tbody></tbody></table></div>
          <p class="sl-hint">Click or tap a cell to select it. In the table, arrow keys move and select; Home / End move within a row. The table covers |z| ≤ 3.99; the calculator accepts |z| ≤ 12.</p>
        </section>
        <aside class="sl-info"><strong>Check the convention in your printed table.</strong> Some tables show the area between 0 and z instead. This lab consistently uses the area from −∞ to z. Switching the shading does not change what the table cells mean.</aside>
      </section>
      <details class="sl-methods"><summary>Assumptions, precision &amp; sources</summary><div><p>Use the normal model only when the question states it or it is otherwise justified. μ is the population mean; σ is the positive population standard deviation. X ~ N(μ, σ²) uses the variance as its second parameter. For a continuous normal variable, &lt; and ≤ give the same probability at a boundary.</p><p>Φ is evaluated numerically with a series / continued-fraction implementation of the incomplete gamma function. Right tails are calculated directly to reduce cancellation. Results and graph labels are rounded for display; extreme tails may round to 0 or 1 at machine precision. The drawing is clipped to at most ±12 standard deviations, but probabilities are not truncated to the drawing.</p><p>Original interface, explanations and generated table. No professor slides or third-party website code are republished. Your inputs stay in this browser; using Copy setup link includes the entered numbers in that link.</p><p>Reference: <a href="https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm" target="_blank" rel="noopener noreferrer">NIST / SEMATECH: Normal Distribution ↗</a> · <a href="https://dlmf.nist.gov/8.9" target="_blank" rel="noopener noreferrer">NIST DLMF: Incomplete-gamma continued fractions ↗</a></p><p>This student-made tool supports learning; it does not replace official course guidance or validated software for research or clinical decisions.</p></div></details>
      <p id="sl-status" class="sl-status" role="status" aria-live="polite"></p>
      <div id="sl-copy-fallback" class="sl-card" hidden><label class="sl-field" for="sl-copy-text"><span>Automatic copying is unavailable. Select and copy this text:</span><textarea id="sl-copy-text" rows="5" readonly></textarea></label><button type="button" id="sl-copy-close" class="sl-text-button">Close</button></div>
      <noscript>Enable JavaScript to use this interactive lab.</noscript>`;

    function syncFields() {
      for (const k of ["mu", "sigma", "a", "b", "mode"]) $(k).value = String(state[k]);
      $("z").value = String(tableState.z);
      $("z-view").value = tableState.view;
    }
    function updateMode() {
      const aUsed = $("mode").value !== "left", bUsed = $("mode").value !== "right";
      $("a-wrap").hidden = $("a-slider-wrap").hidden = !aUsed;
      $("b-wrap").hidden = $("b-slider-wrap").hidden = !bUsed;
      $("a").disabled = !aUsed; $("b").disabled = !bUsed;
    }
    function readNormal() {
      updateMode();
      const next = { mode: $("mode").value };
      for (const k of ["mu", "sigma", "a", "b"]) {
        const input = $(k);
        input.removeAttribute("aria-invalid");
        if (input.disabled) { next[k] = state[k]; continue; }
        next[k] = input.value.trim() === "" ? NaN : Number(input.value);
        if (!Number.isFinite(next[k])) {
          input.setAttribute("aria-invalid", "true");
          throw new Error("Enter a finite number in each active field. Empty fields are not treated as zero.");
        }
      }
      if (next.sigma <= 0) { $("sigma").setAttribute("aria-invalid", "true"); throw new Error("Standard deviation σ must be greater than 0."); }
      if (["between", "outside"].includes(next.mode) && next.a > next.b) {
        $("a").setAttribute("aria-invalid", "true"); $("b").setAttribute("aria-invalid", "true");
        throw new Error("The lower bound a must not exceed the upper bound b. Swap or edit the bounds.");
      }
      // Unused bounds are replaced only for numerical evaluation, not in the saved input state.
      const a = M.standardize(next.mode === "left" ? next.mu : next.a, next.mu, next.sigma);
      const b = M.standardize(next.mode === "right" ? next.mu : next.b, next.mu, next.sigma);
      if (![next.mu - 12 * next.sigma, next.mu + 12 * next.sigma].every(Number.isFinite)) throw new Error("These values exceed the supported chart range. Use smaller units.");
      return { next, a, b };
    }
    function expression(s) {
      if (s.mode === "left") return `P(X < ${number(s.b)})`;
      if (s.mode === "right") return `P(X > ${number(s.a)})`;
      if (s.mode === "outside") return `P(X < ${number(s.a)} or X > ${number(s.b)})`;
      return `P(${number(s.a)} < X < ${number(s.b)})`;
    }
    function formula(mode, pa, pb) {
      if (mode === "left") return pb;
      if (mode === "right") return `1 − ${pa}`;
      if (mode === "outside") return `${pa} + (1 − ${pb})`;
      return `${pb} − ${pa}`;
    }
    function renderSteps(a, b, p, table) {
      const useA = state.mode !== "left", useB = state.mode !== "right";
      const rows = [];
      const work = [];
      if (useA) work.push(`zₐ = (${number(state.a)} − (${number(state.mu)})) / ${number(state.sigma)} = ${number(a, 6)}`);
      if (useB) work.push(`zᵦ = (${number(state.b)} − (${number(state.mu)})) / ${number(state.sigma)} = ${number(b, 6)}`);
      rows.push(["Standardize the bounds", "Convert each X value to its distance from the mean in standard deviations.", `z = (x − μ) / σ<br>${work.map(escape).join("<br>")}`]);
      const reads = [];
      if (useA) reads.push(`Φ(${number(a, 6)}) ≈ ${prob(M.cdf(a))}`);
      if (useB) reads.push(`Φ(${number(b, 6)}) ≈ ${prob(M.cdf(b))}`);
      const buttons = (useA ? `<button type="button" class="sl-inline-link" data-lookup="${a}">Find lower z in the table →</button>` : "") + (useB ? `<button type="button" class="sl-inline-link" data-lookup="${b}">Find upper z in the table →</button>` : "");
      rows.push(["Read the cumulative areas", "Φ(z) means all the area to the left of z, not the height of the curve.", `${reads.map(escape).join("<br>")}`, buttons]);
      const rule = state.mode === "between" ? "Subtract the left area at the lower bound from the left area at the upper bound." : state.mode === "left" ? "The cumulative area is already the probability requested." : state.mode === "right" ? "Subtract the left area from the total area, which is 1." : "Add the left tail below a and the right tail above b. This is the complement of the area between the bounds.";
      rows.push(["Choose the area operation", rule + " Displayed intermediates are rounded; the result uses unrounded values and direct tail evaluation when needed.", `${escape(formula(state.mode, `Φ(${number(a, 6)})`, `Φ(${number(b, 6)})`))}<br>≈ ${escape(formula(state.mode, prob(M.cdf(a)), prob(M.cdf(b))))}<br>≈ ${prob(p)}`]);
      rows.push(["Compare with the printed-table method", "A printed table rounds both the z-score and the cell probability. A small difference is expected; neither workflow should silently mix rounding conventions.", `${escape(formula(state.mode, table.pa.toFixed(4), table.pb.toFixed(4)))} = ${table.p.toFixed(4)}<br>Unrounded calculation → ${p.toFixed(4)} (4 d.p.)`]);
      $("steps").innerHTML = rows.map((r, i) => `<article class="sl-step"><span class="sl-step-number">0${i + 1}</span><div><h3>${r[0]}</h3><p>${r[1]}</p><div class="sl-formula">${r[2]}</div>${r[3] || ""}</div></article>`).join("");
      lastSolution = `EU-HEM Interactive Statistics Lab v1\nNormal model: μ = ${state.mu}, σ = ${state.sigma}\n${expression(state)}\n\n1. Standardize: z = (x − μ) / σ\n${work.join("\n")}\n\n2. Read cumulative areas:\n${reads.join("\n")}\n\n3. Select the area:\n${formula(state.mode, `Φ(${number(a, 6)})`, `Φ(${number(b, 6)})`)}\nProbability ≈ ${prob(p)} (${prob(p * 100, 4)}%)\n\n4. Printed-table method (z to 2 d.p.; probabilities to 4 d.p.):\n${formula(state.mode, table.pa.toFixed(4), table.pb.toFixed(4))} = ${table.p.toFixed(4)}\nFull calculation rounded only at the end: ${p.toFixed(4)}\n\nAssumption: X follows the stated normal distribution. Student-made educational tool.`;
    }
    function renderNormal() {
      try {
        const r = readNormal();
        state = r.next;
        const p = M.probability(state.mode, r.a, r.b);
        const t = M.tableCalculation(state.mode, r.a, r.b);
        $("normal-error").hidden = true;
        $("normal-results").removeAttribute("aria-disabled");
        $("normal-results").classList.remove("sl-invalid");
        $("steps").classList.remove("sl-invalid");
        $("copy-solution").disabled = false;
        $("expression").textContent = expression(state);
        $("distribution").textContent = `μ = ${number(state.mu)} · σ = ${number(state.sigma)}`;
        $("answer-value").textContent = prob(p);
        $("answer-percent").textContent = `≈ ${prob(p * 100, 4)}%`;
        $("answer-words").textContent = state.mode === "between" ? "The area between the two bounds, as a fraction of the whole curve." : state.mode === "outside" ? "The combined area outside the interval. The middle is not included." : "The shaded tail, as a fraction of the whole curve.";
        $("rounding-note").textContent = `Table method: ${t.p.toFixed(4)}. Full calculation rounded to 4 decimal places: ${p.toFixed(4)}.${Math.abs(t.p - Number(p.toFixed(4))) > 0.00001 ? " The difference comes from rounding intermediate values." : " They agree to 4 decimal places for these inputs."}`;
        for (const [key, z] of [["a", r.a], ["b", r.b]]) {
          $(`${key}-slider`).value = String(Math.max(-5, Math.min(5, z)));
          $(`${key}-slider-label`).textContent = `z = ${number(z, 2)}${Math.abs(z) > 5 ? " · outside slider" : ""}`;
          $(`${key}-slider`).setAttribute("aria-valuetext", `${key} = ${number(state[key])}; z = ${number(z, 2)}`);
        }
        draw($("normal-graph"), { a: r.a, b: r.b, mode: state.mode, mu: state.mu, sigma: state.sigma, title: expression(state), p, draggable: true });
        renderSteps(r.a, r.b, p, t);
        lastNormalResult = { a: r.a, b: r.b, p };
        return true;
      } catch (err) {
        $("normal-error").textContent = err.message;
        $("normal-error").hidden = false;
        $("normal-results").classList.add("sl-invalid");
        $("normal-results").setAttribute("aria-disabled", "true");
        $("steps").classList.add("sl-invalid");
        $("copy-solution").disabled = true;
        lastNormalResult = null;
        return false;
      }
    }

    // The SVG is deliberately a view of computed state, not the numerical integration source.
    function draw(svg, cfg) {
      const { a, b, mode, mu, sigma, title, p, draggable } = cfg;
      const bounds = mode === "left" ? [b] : mode === "right" ? [a] : [a, b];
      const extent = Math.min(12, Math.max(4, ...bounds.map(z => Math.abs(z) + 0.55)));
      const left = 65, right = 735, baseline = 258, top = 34;
      const sx = (z) => left + (z + extent) / (2 * extent) * (right - left);
      const sy = (z) => baseline - M.pdf(z) / M.pdf(0) * (baseline - top);
      const path = (lo, hi, filled) => {
        lo = Math.max(-extent, lo); hi = Math.min(extent, hi);
        if (!(hi > lo)) return "";
        const pts = [];
        for (let i = 0; i <= 360; i++) {
          const z = lo + (hi - lo) * i / 360;
          pts.push(`${i ? "L" : "M"}${sx(z).toFixed(2)},${sy(z).toFixed(2)}`);
        }
        return filled ? `M${sx(lo)},${baseline} L${sx(lo)},${sy(lo)} ${pts.join(" ").replace(/^M/, "L")} L${sx(hi)},${baseline} Z` : pts.join(" ");
      };
      const regions = mode === "left" ? [[-extent, b]] : mode === "right" ? [[a, extent]] : mode === "between" ? [[a, b]] : [[-extent, a], [b, extent]];
      const id = svg.id;
      let html = `<title id="${id}-title">${escape(title)}</title><desc id="${id}-desc">Normal distribution with mean ${mu} and standard deviation ${sigma}. Selected probability ${prob(p)}. ${bounds.some(z => Math.abs(z) > extent) ? "At least one bound is outside the displayed plot." : ""}</desc>`;
      for (const v of [0.1, 0.2, 0.3, 0.4]) {
        const y = baseline - v / M.pdf(0) * (baseline - top);
        html += `<path class="sl-gridline" d="M${left} ${y}H${right}"/><text class="sl-tick" x="${left - 10}" y="${y + 4}" text-anchor="end">${number(v / sigma, 3)}</text>`;
      }
      const tickStep = extent > 8 ? 3 : extent > 5 || window.innerWidth < 721 ? 2 : 1;
      for (let z = -Math.floor(extent / tickStep) * tickStep; z <= extent; z += tickStep) {
        const x = sx(z);
        html += `<path class="sl-gridline" d="M${x} ${top}V${baseline}"/><text class="sl-tick" x="${x}" y="${baseline + 22}" text-anchor="middle">${number(mu + sigma * z, 2)}</text><text class="sl-tick sl-z-tick" x="${x}" y="${baseline + 43}" text-anchor="middle">${z}</text>`;
      }
      html += `<text class="sl-axis-label" x="${left}" y="18">Density</text><text class="sl-axis-label" x="${left - 24}" y="${baseline + 22}">X</text><text class="sl-axis-label" x="${left - 24}" y="${baseline + 43}">z</text>`;
      for (const [lo, hi] of regions) html += `<path class="sl-area" d="${path(lo, hi, true)}"/>`;
      html += `<path class="sl-curve" d="${path(-extent, extent, false)}"/><path class="sl-axis" d="M${left} ${baseline}H${right}"/>`;
      const markers = mode === "left" ? [["b", b]] : mode === "right" ? [["a", a]] : [["a", a], ["b", b]];
      markers.forEach(([key, z], index) => {
        if (Math.abs(z) > extent) return;
        const x = sx(z), y = sy(z);
        const value = number(mu + sigma * z);
        html += `<path class="sl-boundary" d="M${x} ${Math.max(top + 10, y - 20)}V${baseline}"/><circle class="sl-handle" cx="${x}" cy="${y}" r="7" ${draggable ? `data-bound="${key}"` : ""}/><text class="sl-bound-label" x="${Math.max(left + 38, Math.min(right - 38, x))}" y="${Math.max(top + 14, y - 16 - (index && Math.abs(a - b) < 0.8 ? 24 : 0))}" text-anchor="middle">${draggable ? key + " = " : "z = "}${escape(value)}</text>`;
      });
      if (bounds.some(z => Math.abs(z) > extent)) html += '<text class="sl-tick" x="400" y="334" text-anchor="middle">A bound is outside this drawing; the calculation still uses your entered value.</text>';
      svg.innerHTML = html;
      svg.dataset.extent = String(extent);
    }

    function buildTable(sign) {
      tableSign = sign;
      const table = $("z-table");
      table.querySelector("thead").innerHTML = `<tr><th scope="col">z</th>${Array.from({length:10}, (_, col) => `<th scope="col" data-col="${col}">.0${col}</th>`).join("")}</tr>`;
      const rows = [];
      for (let row = 0; row < 40; row++) {
        const prefix = sign < 0 ? "−" : "";
        const cells = [];
        for (let col = 0; col < 10; col++) {
          const z = sign * (row * 10 + col) / 100;
          const value = M.cdf(z).toFixed(4);
          cells.push(`<td data-col="${col}"><button type="button" data-cell="${row * 10 + col}" data-value="${z}" tabindex="-1" aria-pressed="false" aria-label="z ${z.toFixed(2)}, left-tail probability ${value}">${value}</button></td>`);
        }
        rows.push(`<tr data-row="${row}"><th scope="row">${prefix}${(row / 10).toFixed(1)}</th>${cells.join("")}</tr>`);
      }
      table.querySelector("tbody").innerHTML = rows.join("");
    }
    function highlightCell(scroll = false) {
      const z = tableState.z, sign = tableState.sign;
      if (tableSign !== sign) buildTable(sign);
      $("positive").setAttribute("aria-pressed", String(sign > 0));
      $("negative").setAttribute("aria-pressed", String(sign < 0));
      const index = Math.round(Math.abs(z) * 100), row = Math.floor(index / 10), col = index % 10;
      const inTable = index <= 399 && (z === 0 || (z < 0 ? -1 : 1) === sign);
      const table = $("z-table");
      table.querySelectorAll(".sl-selected-row, .sl-selected-col, .sl-selected-cell").forEach(el => el.classList.remove("sl-selected-row", "sl-selected-col", "sl-selected-cell"));
      table.querySelectorAll('button[aria-pressed="true"], button[tabindex="0"]').forEach(el => { el.setAttribute("aria-pressed", "false"); el.tabIndex = -1; });
      if (inTable) {
        table.querySelector(`[data-row="${row}"]`).classList.add("sl-selected-row");
        table.querySelectorAll(`[data-col="${col}"]`).forEach(el => el.classList.add("sl-selected-col"));
        const cell = table.querySelector(`[data-cell="${index}"]`);
        cell.classList.add("sl-selected-cell"); cell.setAttribute("aria-pressed", "true"); cell.tabIndex = 0;
        if (scroll) {
          const box = $("table-scroll");
          box.scrollTop = cell.offsetTop - box.clientHeight / 2;
          box.scrollLeft = cell.offsetLeft - box.clientWidth / 2;
        }
        const rowText = (sign < 0 ? "−" : "") + (row / 10).toFixed(1);
        const colText = `.0${col}`;
        $("cell-explanation").textContent = sign < 0 ? `−(${(row / 10).toFixed(1)} + 0.0${col}) = ${(sign * index / 100).toFixed(2)}` : `${(row / 10).toFixed(1)} + 0.0${col} = ${(index / 100).toFixed(2)}`;
        $("table-status").textContent = `Selected: row ${rowText}, column ${colText} → Φ(${(sign * index / 100).toFixed(2)}) = ${M.cdf(sign * index / 100).toFixed(4)}. Table cells always show the left-tail area.`;
      } else {
        table.querySelector("button").tabIndex = 0;
        $("cell-explanation").textContent = "This z-score is outside the displayed table; use the calculated probabilities.";
        $("table-status").textContent = "No cell selected: the table covers |z| ≤ 3.99. The curve and results use the entered z-score.";
      }
    }
    function renderZ(scroll = false) {
      const z = $("z").value.trim() === "" ? NaN : Number($("z").value);
      if (!Number.isFinite(z) || Math.abs(z) > 12) {
        $("z-error").textContent = "Enter a z-score between −12 and 12. Empty fields are not zero.";
        $("z-error").hidden = false;
        $("z").setAttribute("aria-invalid", "true");
        $("z-results").classList.add("sl-invalid");
        $("z-table").classList.add("sl-invalid");
        return false;
      }
      $("z-error").hidden = true; $("z").removeAttribute("aria-invalid");
      $("z-results").classList.remove("sl-invalid"); $("z-table").classList.remove("sl-invalid");
      tableState.z = z; tableState.view = $("z-view").value;
      if (z !== 0) tableState.sign = z < 0 ? -1 : 1;
      const left = M.cdf(z), right = M.sf(z), two = 2 * M.sf(Math.abs(z));
      $("z-left").textContent = prob(left); $("z-right").textContent = prob(right); $("z-two").textContent = prob(two);
      const mode = tableState.view === "two" ? "outside" : tableState.view;
      const a = tableState.view === "two" ? -Math.abs(z) : z;
      const b = tableState.view === "two" ? Math.abs(z) : z;
      const p = tableState.view === "two" ? two : tableState.view === "right" ? right : left;
      const label = tableState.view === "two" ? `P(|Z| > ${number(Math.abs(z))})` : `P(Z ${tableState.view === "left" ? "≤" : ">"} ${number(z)})`;
      $("z-expression").textContent = `${label} ≈ ${prob(p, 4)}`;
      $("z-rounding").textContent = Math.abs(z * 100 - Math.round(z * 100)) > 1e-8 ? `The graph uses z = ${number(z, 6)}. The highlighted table cell rounds z to ${(Math.round(Math.abs(z) * 100) / 100 * (z < 0 ? -1 : 1)).toFixed(2)}.` : "The three results above use unrounded calculations. Table cells are rounded to 4 decimal places.";
      draw($("z-graph"), { a, b, mode, mu:0, sigma:1, title:label, p, draggable:false });
      highlightCell(scroll);
      return true;
    }
    function selectTool(tool, focus = false) {
      active = tool;
      for (const key of ["normal", "ztable"]) {
        $(`panel-${key}`).hidden = key !== tool;
        $(`tab-${key}`).setAttribute("aria-selected", String(key === tool));
        $(`tab-${key}`).tabIndex = key === tool ? 0 : -1;
      }
      if (tool === "ztable") renderZ(true);
      if (focus) $(`tab-${tool}`).focus();
    }
    async function copy(text, label) {
      $("copy-fallback").hidden = true;
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(text);
        $("status").textContent = label;
      } catch (_) {
        $("copy-fallback").hidden = false;
        $("copy-text").value = text;
        $("copy-text").focus(); $("copy-text").select();
        $("status").textContent = "Select and copy the text in the box below.";
      }
    }
    $("normal-form").addEventListener("submit", e => { e.preventDefault(); renderNormal(); });
    $("normal-form").addEventListener("input", e => {
      if (e.target.type === "range") return;
      $("example-note").textContent = "Custom setup. The normal-model assumption must be justified for your question.";
      renderNormal();
    });
    $("mode").addEventListener("change", renderNormal);
    for (const key of ["a", "b"]) $(`${key}-slider`).addEventListener("input", () => {
      if (!lastNormalResult) return;
      let z = Number($(`${key}-slider`).value);
      if (["between", "outside"].includes(state.mode)) z = key === "a" ? Math.min(z, lastNormalResult.b) : Math.max(z, lastNormalResult.a);
      $(key).value = String(Number((state.mu + state.sigma * z).toPrecision(12)));
      $("example-note").textContent = "Custom setup. The normal-model assumption must be justified for your question.";
      renderNormal();
    });
    let dragging = null;
    const graph = $("normal-graph");
    graph.addEventListener("pointerdown", e => {
      const key = e.target.dataset.bound;
      if (!key || !lastNormalResult) return;
      dragging = key;
      graph.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    graph.addEventListener("pointermove", e => {
      if (!dragging || !lastNormalResult) return;
      const pt = graph.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const matrix = graph.getScreenCTM(); if (!matrix) return;
      const x = pt.matrixTransform(matrix.inverse()).x;
      const extent = Number(graph.dataset.extent);
      let z = Math.round(Math.max(-extent, Math.min(extent, (x - 65) / 670 * 2 * extent - extent)) * 100) / 100;
      if (["between", "outside"].includes(state.mode)) z = dragging === "a" ? Math.min(z, lastNormalResult.b) : Math.max(z, lastNormalResult.a);
      $(dragging).value = String(Number((state.mu + state.sigma * z).toPrecision(12)));
      renderNormal();
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) graph.addEventListener(event, () => { dragging = null; });
    $("z-form").addEventListener("submit", e => { e.preventDefault(); renderZ(true); });
    $("z-form").addEventListener("input", () => renderZ());
    $("z-view").addEventListener("change", () => renderZ());
    host.querySelectorAll("[data-z]").forEach(button => button.addEventListener("click", () => { $("z").value = button.dataset.z; renderZ(true); }));
    for (const [id, sign] of [["positive", 1], ["negative", -1]]) $(id).addEventListener("click", () => {
      tableState.sign = sign; $("z").value = String(Math.abs(tableState.z) * sign); renderZ();
    });
    $("z-table").addEventListener("click", e => {
      const button = e.target.closest("[data-cell]"); if (!button) return;
      $("z").value = button.dataset.value; renderZ();
    });
    $("z-table").addEventListener("keydown", e => {
      const button = e.target.closest("[data-cell]"); if (!button) return;
      const current = Number(button.dataset.cell);
      const next = {ArrowRight:current + 1, ArrowLeft:current - 1, ArrowDown:current + 10, ArrowUp:current - 10, Home:Math.floor(current / 10) * 10, End:Math.floor(current / 10) * 10 + 9}[e.key];
      if (next === undefined) return;
      e.preventDefault();
      const target = $("z-table").querySelector(`[data-cell="${Math.max(0, Math.min(399, next))}"]`);
      $("z").value = target.dataset.value; renderZ(); target.focus();
    });
    for (const tool of ["normal", "ztable"]) {
      $(`tab-${tool}`).addEventListener("click", () => selectTool(tool));
      $(`tab-${tool}`).addEventListener("keydown", e => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault(); selectTool(e.key === "Home" ? "normal" : e.key === "End" ? "ztable" : active === "normal" ? "ztable" : "normal", true);
      });
    }
    $("steps").addEventListener("click", e => {
      const button = e.target.closest("[data-lookup]"); if (!button) return;
      $("z").value = button.dataset.lookup; $("z-view").value = "left";
      selectTool("ztable", true); renderZ(true);
    });
    function example(which) {
      if (which === "central") state = { mu:0, sigma:1, a:-1.96, b:1.96, mode:"between" };
      else if (which === "health") state = { mu:70, sigma:10, a:60, b:80, mode:"between" };
      else state = { mu:1, sigma:1, a:-1, b:2, mode:"between" };
      syncFields(); renderNormal();
      $("example-note").textContent = which === "health" ? "Hypothetical measurement: assume a normal population with μ = 70 and σ = 10 arbitrary units. This is not a clinical reference range." : which === "central" ? "The limits ±1.96 cover approximately 95%, not exactly 95.000000%." : "Teaching example: X has mean 1 and standard deviation 1.";
    }
    host.querySelectorAll("[data-example]").forEach(b => b.addEventListener("click", () => example(b.dataset.example)));
    $("reset").addEventListener("click", () => example("class"));
    $("copy-solution").addEventListener("click", () => { if (lastNormalResult) copy(lastSolution, "Worked solution copied."); });
    $("share").addEventListener("click", () => {
      if (active === "normal" ? !renderNormal() : !renderZ()) { $("status").textContent = "Correct the invalid input before sharing this setup."; return; }
      const url = new URL(location.href);
      if (url.pathname.endsWith("course.html")) { url.searchParams.set("course", "quant-methods"); url.searchParams.set("tab", "lab"); }
      for (const [key, val] of Object.entries({labtool:active, labmu:state.mu, labsd:state.sigma, laba:state.a, labb:state.b, labarea:state.mode, labz:tableState.z, labview:tableState.view})) url.searchParams.set(key, String(val));
      copy(url.href, "Setup link copied. The link includes the numbers you entered.");
    });
    $("copy-close").addEventListener("click", () => { $("copy-fallback").hidden = true; $("share").focus(); });
    syncFields(); renderNormal(); renderZ(); selectTool(active);
  }
  root.StatisticsLab = Object.freeze({ mount });
})(typeof globalThis !== "undefined" ? globalThis : this);
