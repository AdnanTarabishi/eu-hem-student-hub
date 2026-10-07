# Interactive Statistics Lab v2

## Seven tools, one course workspace

The existing Normal Distribution and Interactive Z-table tools are retained. Five tools are added:

1. **Cutoffs & percentiles:** inverse-normal values for left tails, right tails, equal-tail central intervals and two cumulative probabilities. Shows z and X cutoffs, shaded area, worked steps and Excel formulas. For mean 0 and SD 2, the 5th and 75th percentiles are approximately -3.28971 and 1.34898, enclosing 70%.
2. **Sample means:** standard error sigma/sqrt(n), normal probabilities for a sample mean and central sampling limits. Exact-normal and approximate-normal model choices are labelled separately. A central sampling interval around known mu is explicitly distinguished from a confidence interval estimating unknown mu.
3. **Confidence intervals:** two-sided intervals for one population mean, using z for known population SD or Student t for sample SD. Includes df, critical value, margin of error, interval plot, interpretation and Excel reproduction.
4. **Data summary:** up to 5000 pasted observations; mean, median, modes, sample/population variance and SD, quartiles, IQR, range, histogram, box plot and sorted deviations. Three quartile conventions: inclusive interpolation (Excel INC / type 7), exclusive interpolation (Excel EXC / type 6, n >= 3) and median of halves excluding the middle observation. Whiskers end at actual non-outlying observations, not at the 1.5 IQR fences.
5. **Student t:** left/right/two-tail probabilities, comparison with standard normal, and two-tailed critical values for specified alpha and df. The observed-t shading and critical-value calculation are clearly distinguished.

The Sample means pane also includes a **seeded CLT simulator**: 500 sample means per experiment, normal/uniform/right-skewed populations standardised to mean 0 and SD 1, sample sizes 1–500, a normal comparison curve and theoretical versus simulated moments.

Each new pane explains when to use it, validates input, includes worked reasoning and links to primary methodological sources. No official slides, assessed answers or third-party website code are republished.

## Where to open it

- `course.html?course=quant-methods&tab=lab`
- `statistics-lab.html`
- Deep links: append `&labtool=quantiles`, `sampling`, `confidence`, `descriptive` or `tdist` to the course URL above.

The course overview launch button now reads **Open 7 interactive statistics tools**.

## Implementation

New runtime files:

- `statistics-lab-tools-math.js`: pure CommonJS/browser numerical extension.
- `statistics-lab-tools.js`: reusable UI extension wrapping the original `StatisticsLab.mount` function.
- `statistics-lab-tools.css`: scoped layout and component styles using the existing lab tokens.

Existing files changed: `course.html` (extension loads), `statistics-lab.html` (extension loads and metadata), `statistics-lab-course.js` (launch button text). The v1 numerical core, normal/Z-table UI, shared course router, programme data and service worker are not replaced.

The extension must load after the v1 math/UI and before `statistics-lab-course.js` or `statistics-lab-page.js`. Only one lab instance per page is supported, matching the existing architecture. All seven tabs share one accessible tab list with arrow/Home/End navigation. New outputs have concise live-region announcements. Invalid results are removed and copy/share actions disabled until corrected.

## Mathematical scope and limits

Normal inversion and Student-t inversion use bracketed bisection; normal tails reuse the tested v1 implementation. Student-t probabilities use the regularised incomplete beta relationship, a continued fraction and log-gamma evaluation. Values remain unrounded until display. These are floating-point educational calculations, not validated research or clinical software.

UI limits: probabilities from 0.000001 to 0.999999; confidence/central sampling levels from 50% to 99.9%; t df from 1 to 10000 and observed t from -100 to 100. Sample-mean and known-SD sample sizes reach 1000000; t mean intervals support n up to 10001. Input numbers have magnitude at most 10^12; SD is between 10^-12 and 10^12. Extreme scale differences may lose representable precision. Graphs are finite windows; tails are not numerically truncated to those windows.

Normal sampling probabilities are exact for iid normal observations. The CLT option is an approximation requiring independence, finite variance and an adequately behaved sampling distribution; there is no universal n=30 guarantee. No finite-population correction or complex-survey design adjustment is implemented.

Mean intervals are two-sided and unadjusted. Student t intervals use df=n-1 and the sample SD. A confidence level describes repeated-sampling coverage, not a posterior probability for the fixed population mean. SD zero is rejected for these interval calculators. A single observation in Data summary has population variance 0 but undefined sample variance/SD.

Data parser: decimal-point mode accepts comma, whitespace or semicolon separators; decimal-comma mode uses whitespace/semicolons. Thousands separators and headers are unsupported. Invalid tokens and explicit empty comma/semicolon/tab cells are rejected, not converted to zero. Histogram bins are equal-width, with the maximum included in the final bin. The detailed deviation table shows at most 100 rows, while all observations enter calculations; at most 300 outlier markers are drawn.

## Privacy and sharing

The lab extension makes no external requests, saves no datasets and requires no backend. Values remain in page memory. Copy setup link encodes scalar settings (including the simulator seed when sharing Sample means); Data summary links deliberately exclude raw data and reopen the demonstration dataset. Shared summaries can still reveal aggregate statistics. Use anonymised practice data. Existing browser history, site-level cache behavior and any other site scripts are unchanged.

## Verification performed

- **33 passing Node tests:** 10 unchanged v1 tests plus 23 v2 tests, covering inverse values, t probabilities/quantiles, sample means, CI selection/validation, parsing, quartile definitions, correct whiskers, constant data, histograms and seeded simulations.
- **87 passing Chromium checks:** all seven tools, invalid input, keyboard navigation, inherited v1 lookup, sharing privacy, simulations, responsive widths 320/390/768/1365, and course-panel rerenders.
- **Independent SciPy comparison:** 8010 Student-t CDF/PDF points across df 1, 2, 3, 5, 9, 24, 30, 100, 1000 and 10000. Maximum absolute errors on this grid were approximately 2.75e-13 (CDF) and 3.63e-13 (PDF). These are measured grid results, not global error guarantees.

Run the numerical suite:

```sh
node --test tests/statistics-lab-math.test.js tests/statistics-lab-tools.test.js
```

The browser runner, logs and screenshots are included in the v2 source-and-test handoff archive. In this environment, browser network navigation was blocked. The test executed actual course/router/data sources from the existing GitHub Pages artifact, loaded inline with adapted fetch, URL and history. External services were disabled. This is a stronger integration check than a synthetic DOM fixture, but **not a live deployed-site end-to-end test**. The service worker and live university feeds were not tested.

## Primary references

- NIST, Normal Distribution: https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm
- NIST, Confidence Limits for the Mean: https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm
- R stats, Student t: https://stat.ethz.ch/R-manual/R-devel/library/stats/html/TDist.html
- R stats, Sample Quantiles: https://stat.ethz.ch/R-manual/R-devel/library/stats/html/quantile.html
- NIST DLMF, Incomplete Beta: https://dlmf.nist.gov/8.17
- Microsoft, QUARTILE.INC: https://support.microsoft.com/en-us/office/quartile-inc-function-1bbacc80-5075-42f1-aed6-47d735c4819d

Possible later additions, not included in v2: hypothesis-test workflows, binomial/Poisson calculators, correlation/regression, sample-size planning, CLT coverage simulations and health-economics tools.
