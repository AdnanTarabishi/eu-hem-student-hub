# Shared Statistics Lab v3 — Fundamentals integration

## Entry points

- Fundamentals course: `course.html?course=fund-quant-methods&tab=lab`
- Fundamentals study workspace: `fund-statistics.html#calculators`
- Existing Statistics course: `course.html?course=quant-methods&tab=lab`
- Standalone: `statistics-lab.html`
- Choose a tool with `labtool=mean-test`, `proportion-ci`, `proportion-test`, `two-means` or `discrete`. The seven v2 tool identifiers still work.

## What changed

The seven existing tools (normal probability, Z-table, cutoffs, sample means/CLT, mean confidence intervals, descriptive statistics, Student t) are now available inside Fundamentals as the SAME reusable code, not copied implementations. They remain available in Statistics for Healthcare.

Five new workbenches bring the total to 12:

1. One population mean test: known-SD z, sample-SD t, or the explicitly labelled course large-sample estimated-SD z approximation at n >= 120. Two-sided, left-sided and right-sided alternatives are supported.
2. Proportion confidence interval: course Wald recipe and supplementary Wilson score interval. Observed counts govern the Wald check. Wald endpoints are not silently clipped.
3. One proportion z test: null-based SE and expected counts under H0, with all three alternative directions. Invalid normal-approximation cases produce no decision.
4. Independent two-mean comparison: course large-sample normal approximation, plus supplementary Welch t with fractional df. Includes SE, statistic, p-value, critical boundary, contrast direction and a clearly labelled two-sided CI. It is not a paired-data calculator.
5. Discrete probability model: original x/probability table, strict validation, expectation, variance, SD, cumulative probabilities and inclusive event probabilities. Includes a Bernoulli preset and a categorical probability-mass chart. No binomial or Poisson fitting is implied.

New tests show a shaded p-value area on the null distribution, dashed alpha-critical boundaries and an observed-statistic marker. A chart can clip at +/-12 while calculations use the full tails. Default decision uses p < alpha; numerical equality is flagged explicitly instead of being rounded silently into rejection.

All new tools include explanatory steps, assumptions, Excel checks, input errors, result copying and setup sharing. Inputs remain in page memory. Custom datasets and discrete model tables are excluded from setup links. Shared worked summaries may still contain aggregate statistics; do not use confidential patient data.

## Fundamentals topic mapping and scope

Mapping was made from the repository's existing six topic guides, `content/modules/fund-statistics/topics.json`, the original notes and `course-study.json`. No additional professor slides were republished or claimed to be newly reviewed.

| Topic | Shared/new tools |
| --- | --- |
| 1: Descriptive statistics | Data summary, histogram, quartile conventions, box plot |
| 2: Distributions | Normal, Z-table, cutoffs, Student t, discrete expectation/variance |
| 3: Point estimation | Sample means, CLT, SE, sample versus population variance |
| 4: Confidence intervals | Mean intervals, proportion intervals |
| 5: Hypothesis tests | One-mean and one-proportion tests |
| 6: Two means | Independent two-mean comparison |

The source guide labels Topic 6 additional/time permitting. It uses a large-sample normal approximation for assessed two-mean calculations. Welch is therefore labelled supplementary, not an assumed exam requirement. Wilson is also supplementary to the course Wald recipe. Paired, pooled-variance, chi-square variance, F and two-proportion calculators are not added as assessed requirements.

The supplied course material has a n > 120 versus n >= 120 discrepancy for the estimated-SD z approximation. This is disclosed; choosing Student t avoids forcing that boundary choice. Adequate n does not guarantee normality, independence or representative sampling.

The lab is for exercise checking, study and exam preparation, not permission to browse or use it in an actual exam. The existing course notice prohibits browsing and personal devices in the exam. Verify current rules with the instructor.

## Integration and preservation

- `statistics-lab-inference-math.js`: pure functions using the unchanged v1/v2 numerical core; exports CommonJS for tests.
- `statistics-lab-foundations.js`: wraps the v2 mount function, reusing its seven tools alongside five new workbenches and a six-topic chooser. Preserves course context in core and new setup links.
- `statistics-lab-foundations.css`: scoped, responsive styles and focus support using existing tokens.
- `fund-statistics-lab-bridge.js`: a persistent `#calculators` panel beside the original study views. The old `#explore` route is retained and renamed Guided experiments. Six topic-card calculator links are added idempotently.
- `statistics-lab-course.js`: extended from Statistics-only to both course identifiers, using their native `.qm-course-tabs`/`.fc-tabs` headers.
- `course.html`, `fund-statistics.html`, `statistics-lab.html`: load the shared assets in dependency order, with content fingerprints.
- `sw.js`: cache version refreshed and all shared lab runtime assets added to the existing precache list. Cache strategy and unrelated assets are preserved.

The original course router, Fundamentals study router, legacy experiments, mock exam, cases, flashcards, programme data and other course pages are not replaced. Narrow MutationObservers watch child changes only and preserve inputs across native course redraws. The bridge depends on the existing documented DOM selectors; update it if those native layouts are redesigned. Only one lab instance per page is supported.

## Bounds and numerical limitations

New summary numeric inputs are finite, magnitude <= 10^12. SD must be >= 10^-12. Alpha is between 10^-6 and 0.5. Mean t tests use n=2..10001. Large-sample estimated-SD z uses n=120..1000000. The course independent-groups approximation uses n >= 30 per group; Welch accepts 2..5001 per group and df up to 10000. These are implementation limits, not universal statistical validity rules.

The Wald check requires at least 5 observed successes and failures; the normal proportion test requires at least 5 expected successes and failures under H0. Counts below the stricter guideline of 10 are flagged. Wilson is not an exact binomial procedure. Discrete tables accept up to 100 distinct support values, decimal points, finite probabilities in [0,1] and total probability 1 within tolerance 10^-10; values are not silently normalised.

Arithmetic is floating point, with unrounded values used internally. Tiny tails can underflow and extreme scale differences can lose precision. Excel documents t functions in terms of integer df; truncating Welch df can produce a difference from this lab's fractional-df calculations. Use R/SciPy for a fractional-df numerical cross-check. These tools are educational, not independently validated clinical/research software.

## Verification actually performed

- **60 passing Node tests:** the 33 existing v1/v2 tests plus 27 new inference/model tests.
- **82 passing local Chromium checks:** all seven retained tools, five new tools, error cases, one-sided alternatives, course-specific sharing, raw-data exclusion, keyboard navigation, native Fundamentals/Statistics course integration, original Fundamentals guided experiments/mock routing, six topic links, state preservation and responsive widths 320/390/768/1365.
- **167 independent reference cases:** SciPy t/normal and a separately evaluated Wilson formula. Largest measured absolute p-value difference was approximately 4.19e-12; largest Wilson endpoint difference was approximately 2.22e-16. These are grid results, not global error bounds.

Numerical command:

```sh
node --test tests/statistics-lab-math.test.js tests/statistics-lab-tools.test.js tests/statistics-lab-inference.test.js
```

The source handoff archive includes the browser runner, actual logs, numerical comparison results and screenshots. Network navigation was blocked in the execution environment, including localhost. The browser checks loaded actual repository HTML/CSS/JS/data inline and explicitly adapted location, history and fetch. They are NOT live deployed-site end-to-end tests. Service-worker offline behavior and live university services were not browser-tested. The existing cache code is unchanged apart from version/list additions.

## Primary method references

- NIST, mean intervals and one-sample tests: https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm
- NIST, two-sample means and Welch df: https://www.itl.nist.gov/div898/handbook/eda/section3/eda353.htm
- NIST, normal proportion test: https://www.itl.nist.gov/div898/handbook/prc/section2/prc24.htm
- NIST, Wald/Wilson discussion: https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm
- Microsoft, T.DIST: https://support.microsoft.com/en-us/excel/functions/t-dist-function

The discrete-model explanations and examples are original and mapped to the existing Topic 2 guide. Official assessed files remain on Virtuale.
