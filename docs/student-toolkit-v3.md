# Student Toolkit v3 — Solve a Problem

## What is live in this release

This phase implements the three academic priorities, inside a fifth Toolkit section: **Solve a Problem**. It preserves Browse tools, Ready-made collections, My lists and Compare.

- Entry: `toolkit.html?section=solve`
- Method guide: `toolkit.html?section=solve&solver=finder`
- Formula assistant: `toolkit.html?section=solve&solver=excel`
- Health economics: `toolkit.html?section=solve&solver=health`
- Optional public parameters: `recipe=<recipe-id>` for Excel, `mode=cea|qaly|discount` for economics.

The existing planned IDs `test-finder`, `excel-assistant` and `health-economics-calculator` are promoted in place to built-in tools. This retains their saved/list references. The catalogue still has 70 records: **21 built-in/Hub + 36 external + 13 planned = 57 available entries**. This is not a count of 57 newly written calculators. No external provider was added or re-reviewed in this release.

## 1. Statistical Test Finder

A deterministic, rule-based guide asks about the goal, numeric/binary/other outcome, number of groups, independence/pairing, sample sizes, available SD and adequacy of the model. The result includes the method family, reasoning, assumptions, limitations and a deep link into the existing Statistics Lab, preserving the selected Fundamentals/Statistics course.

Supported routes: one-mean known-SD z or sample-SD t; two-sided mean intervals; paired mean inference using the **mean and SD of differences and number of pairs**; independent two-mean comparison; one-proportion Wald/Wilson intervals and normal-approximation tests. Sample size and method are passed as calculator presets, not a full data analysis.

Pairing is not inferred from equal group sizes. The paired route does not subtract raw datasets itself. It explicitly explains how the existing one-mean calculator applies to differences. The course-specific large-sample two-mean route remains distinguished from supplementary Welch. Wald checks observed successes/failures; proportion tests check null-expected counts. Wilson is supplementary, not an exact interval.

Unsupported/uncertain designs stop without a calculator launch: multicategory/ordinal/count/survival outcomes, more than two groups, clustering/complex sampling, two binary groups, unclear dependence or unreviewed numeric-model assumptions. Ordinary t/z methods are not selected simply because n exceeds 30. Calculator numerical limits are disclosed, not bypassed by silently changing methods.

The question box matches a small local list of topic keywords and offers up to three possible starting points. It is **not AI, natural-language equation solving, automatic data inspection or a research analysis-plan generator**. Users must still confirm the model in the selected tool. Course exam rules continue to apply.

## 2. Excel Formula Assistant

**52 original worked recipes** covering descriptive statistics, inclusive/exclusive quartiles, normal/t probabilities, binomial/Poisson formulas, intervals, paired/Welch tests, proportions, correlation/regression, QALYs, ICER/INMB, discounting and NPV.

Each recipe has a formula, explanation, fixed example inputs, expected result, caveat and official/provider method reference. Search and category filters find recipes. Users can customise two validated A1 ranges and argument/decimal separators, then copy the formula. English function names remain unchanged. Decimal-comma syntax requires a semicolon argument separator. The converter preserves punctuation within quoted strings.

**This is not an Excel engine.** It does not open/read the student's workbook or recalculate the displayed fixed example when a range changes. No arbitrary expression is evaluated. The example result is labelled explicitly. The range controls reject sheet/external references, expressions, reversed bounds and addresses beyond XFD1048576; their current scope is local A1 references only. A fixed two-column practice dataset can be copied as TSV; it contains only numeric constants.

Important distinctions in the recipes: CONFIDENCE functions return a half-width, not both endpoints; NORM.DIST with FALSE is a density, not a probability; sample/population variance differ; normal right tails use symmetry; T.TEST type 1 is paired and type 3 unequal variance; T.TEST examples are two-sided; a time-zero cash flow is added outside Excel NPV. Recipes requiring weights or matched pairs describe the necessary interpretation of their example columns.

## 3. Health Economics Calculator

### Cost-effectiveness comparison

User-supplied comparable costs and QALYs for A and B, plus a chosen threshold lambda. Outputs DeltaC, DeltaE, ICER (undefined when DeltaE = 0) and incremental net monetary benefit `lambda*DeltaE - DeltaC`. The chart shows the cost-effectiveness plane, A relative to B and the threshold line. Scenarios illustrate dominance, being dominated, northeast and southwest trade-offs. Preference is based on incremental NMB, not a sign or a naive threshold rule for the ICER. Small floating-point ties are explicitly handled.

A threshold-only sensitivity table varies lambda while holding the cost/effect estimates fixed. This is not probabilistic sensitivity analysis, a tornado analysis or a cost-effectiveness acceptability curve. Display currency is a label, not currency conversion. No national threshold, discount rate, perspective or affordability criterion is assumed. Users must align horizon, population denominator, currency/price year and perspective. The result is not a clinical recommendation or an assessment of equity, uncertainty, affordability or extended dominance across multiple options.

### QALY builder

A table of consecutive durations, utility A and utility B. The calculator sums years times utility, displays both profiles and a per-period table, and can transfer the totals into the cost-effectiveness pane. Transfer preserves costs and lambda and warns the user to check the same horizon/basis.

This is a **constant-within-period, undiscounted time-alive model**. No mortality/survival model, baseline adjustment, missing-value imputation or confidence interval is implemented. Utilities may be negative; the input range [-1,1] is an implementation limit, not a statement that every instrument has that universal lower bound. Maximum 30 periods and 150 years total.

### Discount future values

An explicit table of integer year, cost and effect. Separate annual cost/effect rates; time 0 is undiscounted. Dates need not be consecutive, repeated years are rejected with an instruction to combine them, and signed flows are allowed. Outputs include original and present-value totals and all per-year workings. This is present-value arithmetic, not a full budget-impact model. Supports years 0–100 and rates 0–100%; inputs use decimal points, with rates entered as percentages in the UI and converted internally.

## Connected learning and integration

Three original multiple-choice checks require an attempt before giving feedback: paired differences, the Excel interval half-width and interpreting a negative ICER. They store no grades or learner profile.

The new entries work with existing bookmarks, personal lists and comparison. Resources for the two statistics modules link to the chooser/formula assistant. Fundamentals in Health Economics receives a **supplementary** link to the economics workbench, not an assertion that economic evaluation is required in its current introductory syllabus. The content index includes the new Statistics resources file. Official slides, course questions, current curricula and unrelated course-router code are not replaced.

The four new runtime files are `toolkit-solve-core.js`, `toolkit-formulas.js`, `toolkit-solve.js`, `toolkit-solve.css`. Existing Toolkit code gains a section hook and preserves public solver/recipe/mode URL parameters. These inputs are allowlisted; entered calculations are never restored from arbitrary query strings. Shared asset fingerprints and the existing precache list are refreshed without changing the service-worker cache strategy.

## Privacy and accessibility

The new tools make no remote requests and add no localStorage key. Calculation inputs and practice selections exist only in page memory. Copy tool link contains the public tool/recipe/mode, not entered values, personal lists or raw data. Copy working can expose the user's entered summaries and is labelled accordingly. Clipboard denial offers selectable text. Existing v1/v2 preferences retain their existing behavior.

Controls use labels, focus styles and concise live status. Invalid input clears the stale calculation and disables copying it. The responsive layout and dark theme reuse site tokens. Numerical results are available as text outside SVGs. The cost-effectiveness chart's small-screen quadrant captions are hidden for space; the quadrant relationship remains stated in the result heading. Print styles keep the selected workbench. This is not a full accessibility certification.

## Verification performed

- **191 passing Node tests**: 102 existing catalogue/organiser/statistical tests plus 37 new rules/arithmetic/validation/integration tests and 52 per-recipe independent numerical reproductions.
- **226 local Chromium checks**: 73 updated catalogue checks, 68 organiser regression checks, and 85 new problem-solving checks. They include calculator deep-link presets, routing and stopping cases, formula locales/injection rejection, quadrant and zero-effect handling, QALY transfer, time-zero discounting, practice feedback, saved-list/compare integration, public links, and widths 320/390/768/1365.
- Shared content validation, content-index verification, version stamping and existing colour-pair contrast checks pass. The existing unconfigured contribution/report/directory warnings remain unrelated to this release.

```sh
node --test tests/toolkit.test.js tests/toolkit-organiser.test.js tests/statistics-lab-math.test.js tests/statistics-lab-tools.test.js tests/statistics-lab-inference.test.js tests/toolkit-solve.test.js
node scripts/stamp-versions.js --check
node scripts/check-content.js
node scripts/check-contrast.js
```

**Testing limits:** Real browser navigation to localhost was attempted and blocked with ERR_BLOCKED_BY_ADMINISTRATOR. The browser harness loads the actual site sources inline with explicit URL/history/localStorage/fetch adapters; it is not live deployed-site, real persistent-storage or offline/service-worker E2E testing. Fixed formula examples were numerically reproduced independently (including SciPy-derived examples checked against the separate JavaScript normal/t core), but were **not executed in Microsoft Excel**. Clipboard fallbacks are exercised as browser actions; operating-system printing has not been tested. Logs, browser runners and screenshots are included in the source handoff; font files are excluded.

## Primary references

These sources support methods, not official course assessment scope or jurisdictional thresholds. Descriptions and examples are original, not copied lecture content.

- NIST, mean inference: https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm
- NIST, paired/independent two-mean and Welch methods: https://www.itl.nist.gov/div898/handbook/eda/section3/eda353.htm
- NIST, normal proportion test: https://www.itl.nist.gov/div898/handbook/prc/section2/prc24.htm
- NIST, proportion intervals: https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm
- Microsoft, statistical functions: https://support.microsoft.com/en-us/excel/statistical-functions-reference
- Microsoft, T.TEST: https://support.microsoft.com/en-us/excel/functions/t-test-function
- Microsoft, CONFIDENCE.T: https://support.microsoft.com/en-us/excel/functions/confidence-t-function
- Microsoft, NPV timing: https://support.microsoft.com/en-us/excel/functions/npv-function
- York Health Economics Consortium, incremental NMB: https://www.yhec.co.uk/glossary-term/net-monetary-benefit/
- York Health Economics Consortium, QALYs: https://www.yhec.co.uk/glossary-term/quality-adjusted-life-year-qaly/

Not delivered in this phase: the planned budget/mobility planners, real workbook execution, AI equation solving, full statistical model selection, multiple-option economic frontiers and probabilistic uncertainty modelling. Their catalogue availability is not changed.
