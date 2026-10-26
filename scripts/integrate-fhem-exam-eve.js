// One-time integration for the FHEM exam-eve review workspace.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const write = (relative, content) => fs.writeFileSync(path.join(ROOT, relative), content);

function replaceFile(relative, transform) {
  const before = read(relative);
  const after = transform(before);
  if (after === before) {
    console.log(`${relative}: unchanged`);
    return;
  }
  write(relative, after);
  console.log(`${relative}: updated`);
}

function appendSection(relative, marker, section) {
  replaceFile(relative, (text) => {
    if (text.includes(marker)) return text;
    return text.trimEnd() + "\n\n" + section.trim() + "\n";
  });
}

appendSection(
  "content/modules/fund-health-economics/notes/health-capital.md",
  "## TA review addendum: Grossman made simple",
  `## TA review addendum: Grossman made simple

The 22 October TA review compresses the Grossman model into five connected pictures. The key is to preserve the economic chain rather than memorise isolated arrows.

### 1. Health is a machine that wears out

Health capital is the **stock**. It depreciates at rate $\\delta$ and is repaired by gross investment $I$:

$$
H_t=(1-\\delta_t)H_{t-1}+I_{t-1}
$$

Gross investment is a chosen **flow**. Depreciation is wear that happens to the inherited stock. Net investment is $I-\\delta H$ and can be negative.

### 2. The machine produces time

The service flow from health is healthy time. More health means fewer days lost to illness and more time for work, health production and the home good.

### 3. The PPF bends

At very low health, an improvement releases so much sick time that health and the home good can rise together. This is the free-lunch region. After the peak of the frontier, extra health uses resources that could have produced the home good, so the true trade-off begins. A person valuing both goods chooses on this downward-sloping section.

### 4. The investment rule

The MEC curve gives the return to the **last** unit of health at each possible stock. The hurdle is $r+\\delta$. Invest while MEC exceeds the hurdle and stop at:

$$
MEC(H^*)=r+\\delta
$$

The MEC curve is a menu of possible health stocks, not one person's health path through age.

### 5. Comparative statics: curve or line?

- Wage and education change the return/productivity side and shift the MEC curve.
- A change in the price or productivity of medical inputs changes the return from producing health.
- Age raises depreciation $\\delta$ and therefore shifts the hurdle line.
- The interest rate $r$ also shifts the hurdle line.

Always separate **health wanted** from **healthcare purchased**. Healthcare is an input. Education and age have clear effects on optimal health but ambiguous effects on healthcare demand because desired output and input efficiency can move in opposite directions.

> **Exam check:** identify the stock, the flows, the hurdle, the object that shifts, and whether the question asks about health or healthcare.`
);

appendSection(
  "content/modules/fund-health-economics/notes/disparities.md",
  "## TA notation addendum: identify Greek letters by role",
  `## TA notation addendum: identify Greek letters by role

The TA review highlights a notation trap: authors may reuse $\\delta$ and $\\gamma$ differently across chapters. Do not identify a parameter by the letter alone.

### Depreciation rate

The depreciation rate is the parameter that physically wears down health capital. It appears in the stock constraint and in the user-cost hurdle:

$$
H_t=(1-\\text{depreciation})H_{t-1}+I_{t-1}
$$

$$
r+\\text{depreciation}
$$

The **allostatic-load hypothesis** is a direct causal story: chronic stress raises physical depreciation, increases the hurdle and lowers optimal health.

### Discount rate or time preference

The discount rate appears in preferences and determines how future utility is weighted. The **Fuchs hypothesis** is a common-factor story: more impatient people place less weight on future returns and may invest less in both schooling and health.

### Why the distinction matters

Allostatic load and Fuchs can both help explain an education–health gradient, but they move different parts of the model and imply different policies. Stress reduction targets physical depreciation; education and long-term investment incentives address a preference or investment channel.

> **Exam rule:** write the role of the parameter before writing its symbol.`
);

appendSection(
  "content/modules/fund-health-economics/notes/physician-agency.md",
  "## TA review addendum: a fee cut in three moves",
  `## TA review addendum: a fee cut in three moves

The 22 October TA review separates an ordinary labour–leisure response from evidence of physician-induced demand.

### Move 1: the budget line pivots inward

A lower fee means that every hour of physician work produces less income.

### Move 2: substitution effect

Leisure has become cheaper in forgone income. The physician therefore tends to consume more leisure and supply fewer services.

### Move 3: income effect

The fee cut also makes the physician poorer. If leisure is a normal good, the physician tends to consume less leisure and supply more work or services.

The two effects oppose each other. Which dominates is an empirical question.

### Identification warning

A fee cut followed by **more** services does not by itself prove physician-induced demand. The ordinary income effect can generate the same volume response. PID requires evidence that the physician influenced patient demand against the physician's own assessment of the patient's best interest.

> **Exam answer:** first decompose the fee response into substitution and income effects; only then discuss inducement and the evidence needed to identify it.`
);

appendSection(
  "content/modules/fund-health-economics/lectures/session-3.html",
  "13 / TA revision lens",
  `<div class="section-intro">
  <div><p class="eyebrow">13 / TA revision lens</p><h2>Five pictures, one Grossman mechanism.</h2></div>
  <p>Use this as an exam-eve compression of the full lesson.</p>
</div>
<div class="grid3">
  <article class="card"><span class="badge">1</span><h3>Machine</h3><p>Health is a depreciating stock repaired by gross investment. Net investment can be negative.</p></article>
  <article class="card"><span class="badge">2</span><h3>Time</h3><p>The stock produces healthy days—the scarce time available for work, health production and other activities.</p></article>
  <article class="card"><span class="badge">3</span><h3>Bent frontier</h3><p>At low H, health and Z rise together; after the peak, extra health genuinely costs Z.</p></article>
  <article class="card"><span class="badge">4</span><h3>Decision rule</h3><p>Hold health until the marginal efficiency of health capital equals r+δ.</p></article>
  <article class="card"><span class="badge">5</span><h3>Curve or line?</h3><p>Wage, education and input prices move returns; age-related depreciation and r move the hurdle.</p></article>
  <article class="card"><span class="badge">!</span><h3>Health ≠ healthcare</h3><p>Output demand and input demand can move differently, creating the age and education ambiguities.</p></article>
</div>
<div class="note"><strong>TA warning:</strong> the MEC curve is a schedule of returns across possible health stocks, not a life-course trajectory.</div>`
);

appendSection(
  "content/modules/fund-health-economics/lectures/session-4.html",
  "13 / TA notation check",
  `<div class="section-intro">
  <div><p class="eyebrow">13 / TA notation check</p><h2>δ or γ? Identify the parameter by its job.</h2></div>
</div>
<div class="grid2">
  <article class="card"><span class="pill">DEPRECIATION</span><h3 style="margin-top:16px">Physical wear on health capital</h3><p>Find it in the health-stock equation and in the hurdle r + depreciation. Allostatic load raises this parameter.</p></article>
  <article class="card"><span class="pill">DISCOUNTING</span><h3 style="margin-top:16px">Preference weight on future utility</h3><p>Find it in intertemporal preferences. The Fuchs hypothesis uses time preference as a common cause of education and health investment.</p></article>
</div>
<div class="note"><strong>Do not write “δ always means depreciation.”</strong> Notation can change across chapters; the economic role is what matters.</div>`
);

appendSection(
  "content/modules/fund-health-economics/lectures/session-5.html",
  "14 / TA fee-cut decomposition",
  `<div class="section-intro">
  <div><p class="eyebrow">14 / TA fee-cut decomposition</p><h2>More services after a fee cut do not prove PID.</h2></div>
  <p>Separate the ordinary labour–leisure response before making an agency claim.</p>
</div>
<div class="flow">
  <div class="flow-step"><span>Fee falls</span><strong>Budget line pivots inward</strong></div>
  <span class="flow-arrow" aria-hidden="true">→</span>
  <div class="flow-step"><span>Substitution</span><strong>Leisure cheaper → work less</strong></div>
  <span class="flow-arrow" aria-hidden="true">↔</span>
  <div class="flow-step"><span>Income</span><strong>Poorer → less leisure → work more</strong></div>
  <span class="flow-arrow" aria-hidden="true">→</span>
  <div class="flow-step"><span>Net volume</span><strong>Empirical, not predetermined</strong></div>
</div>
<div class="note"><strong>Identification rule:</strong> a rise in service volume can be generated by the income effect alone. PID requires evidence of physician influence on patient demand against the physician's own assessment of the patient's interest.</div>`
);

for (const relative of ["course.html", "notes.html", "lecture.html"]) {
  replaceFile(relative, (text) => {
    if (text.includes('src="fhem-exam-eve-data.js')) return text;
    const anchor = relative === "lecture.html"
      ? '<script defer src="fhe-session-8.js'
      : '<script defer src="fhe-session-7.js';
    const index = text.indexOf(anchor);
    if (index < 0) throw new Error(`${relative}: integration anchor not found`);
    const end = text.indexOf("</script>", index) + "</script>".length;
    return text.slice(0, end) + '\n  <script defer src="fhem-exam-eve-data.js"></script>' + text.slice(end);
  });
}

replaceFile("fhem-exam.html", (text) => {
  if (text.includes('src="fhem-exam-eve-data.js')) return text;
  const anchor = '<script defer src="fhe-session-8-exam.js';
  const index = text.indexOf(anchor);
  if (index < 0) throw new Error("fhem-exam.html: Session 8 exam anchor not found");
  const end = text.indexOf("</script>", index) + "</script>".length;
  return text.slice(0, end) + '\n  <script defer src="fhem-exam-eve-data.js"></script>' + text.slice(end);
});

replaceFile("health-econ-management.js", (text) => {
  if (!text.includes('["review", "Final review", "fhem-final-review.html"]')) {
    text = text.replace(
      '["exam", "Exam centre", "fhem-exam.html"],',
      '["exam", "Exam centre", "fhem-exam.html"],\n      ["review", "Final review", "fhem-final-review.html"],',
    );
  }
  if (!text.includes('Final review ready')) {
    text = text.replace(
      '<a href="fhem-exam.html">Current-content mock ready →</a>',
      '<a href="fhem-exam.html">Current-content mock ready →</a>\n        <a href="fhem-final-review.html">Final review ready →</a>',
    );
  }
  if (!text.includes('link("Final review"')) {
    text = text.replace(
      'link("Exam centre", "fhem-exam.html", "hem-button hem-secondary"),',
      'link("Exam centre", "fhem-exam.html", "hem-button hem-secondary"),\n      link("Final review", "fhem-final-review.html", "hem-button hem-secondary"),',
    );
  }
  if (!text.includes('"Final review", "Review all eight sessions')) {
    text = text.replace(
      'toolCard("05 / SIMULATE", "Exam centre", "Run a 90-minute mixed mock or a 20-minute objective drill using the question bank from the available Hub sessions.", "fhem-exam.html", "90 min"),',
      'toolCard("05 / SIMULATE", "Exam centre", "Run a 90-minute mixed mock or a 20-minute objective drill using the question bank from the available Hub sessions.", "fhem-exam.html", "90 min"),\n      toolCard("06 / CONSOLIDATE", "Final review", "Review all eight sessions, TA clarifications, formulas, exam traps and open-answer structure in one exam-eve workspace.", "fhem-final-review.html", "8 sessions"),',
    );
  }
  return text;
});

replaceFile("notes.html", (text) => {
  if (text.includes('href="fhem-final-review.html"')) return text;
  const anchor = '<a class="notes-side-tool" href="statistics-lab.html">';
  const link = '<a class="notes-side-tool" href="fhem-final-review.html"><svg class="icon" aria-hidden="true"><use href="icons.svg#exams"></use></svg><span><strong>FHEM final review</strong><small>Eight sessions, formulas, TA clarifications and exam traps.</small></span><svg class="icon" aria-hidden="true"><use href="icons.svg#arrow-right"></use></svg></a>';
  if (!text.includes(anchor)) throw new Error("notes.html: sidebar tool anchor not found");
  return text.replace(anchor, link + anchor);
});

replaceFile("health-econ-management.css", (text) => {
  if (text.includes("/* Final-review tool-grid override */")) return text;
  return text.trimEnd() + `

/* Final-review tool-grid override */
.hem-tool-grid { grid-template-columns: repeat(auto-fit, minmax(185px, 1fr)); }
`;
});

replaceFile("sw.js", (text) => {
  if (!text.includes('"fhem-final-review.html"')) {
    text = text.replace(
      '"quant-methods.css", "quant-methods.js", "health-econ-management.css", "health-econ-management.js", "fhem-exam.css",',
      '"quant-methods.css", "quant-methods.js", "health-econ-management.css", "health-econ-management.js", "fhem-final-review.html", "fhem-final-review.css", "fhem-final-review.js", "fhem-exam-eve-data.js", "fhem-exam.css",',
    );
  }
  return text.replace(/const VERSION = "[^"]+";/, 'const VERSION = "fhem-exam-eve-20261026";');
});

console.log("FHEM exam-eve integration complete.");
