# Interactive Statistics Lab v1

## Entry points

- Course tab: `course.html?course=quant-methods&tab=lab`
- Standalone view of the same component: `statistics-lab.html`
- Course overview: the Statistics for Healthcare module gets a launch button.

The interface is English, responsive and student-made. It does not include official slides or copied third-party site code.

## Files and integration

- `statistics-lab-math.js`: pure numerical core; browser global and CommonJS export for tests.
- `statistics-lab.js`: reusable `StatisticsLab.mount(host)` interface, SVG graphs and generated table.
- `statistics-lab.css`: scoped component styles, dark mode, keyboard focus and reduced-motion support.
- `statistics-lab-course.js`: a small adapter for the existing asynchronous course router.
- `statistics-lab.html` and `statistics-lab-page.js`: independent entry point using the same component.

The only edited existing file is `course.html`: one stylesheet and three deferred script tags are added. No shared router, programme data or other course material is replaced.

The adapter runs only for `course=quant-methods`. It inserts a native course link in `.qm-course-tabs` and a launch button in the first `.qm-module` (Statistics). Its panel sits directly after `#course-page`, in the same main container. When `tab=lab`, it hides the native `.course-panel` and shows the lab. A narrowly scoped, idempotent MutationObserver reinserts links after the native router refreshes; attributes are not observed. Inputs survive timetable refreshes. If these native selectors or module ordering change, update the adapter. This is not an iframe.

## Features

Normal probabilities: between, left tail, right tail and outside an interval; typed parameters, movable boundaries, sliders, shaded SVG curve, X/z axes and four worked steps. Includes original examples, table lookups from steps, worked-solution copying and reusable setup links.

Z-table: positive and negative tables, row/column/cell highlighting, keyboard navigation, direct lookup, left/right/two-tail shading and explicit cumulative-area convention. Cells always show Phi(z), regardless of the shading mode.

Invalid inputs are explained; stale results are visibly disabled. Empty inputs are not zero. Standard deviation must be positive; lower bounds must not exceed upper bounds.

## Mathematics and limits

X is assumed normal with mean mu and positive standard deviation sigma. Standardization is z = (x - mu) / sigma. In N(mu, sigma^2), the second parameter is variance.

CDF/tail evaluation uses Q(1/2, z^2/2): a convergent series near zero and an upper incomplete-gamma continued fraction in the tails. Right tails are evaluated directly to reduce cancellation. Very narrow intervals use a small-interval Simpson approximation. IEEE-754 underflow/rounding still applies to extreme inputs. This is educational software, not validated clinical or research software.

The graph shows at least +/-4 and at most +/-12 standard deviations; its extent does not truncate the computed probability. Bound sliders cover +/-5 standard deviations. The printed table covers |z| <= 3.99; its calculator accepts |z| <= 12.

The normal calculator retains unrounded z-scores. Printed-table working rounds z to two decimals and each CDF cell to four. For mu=1, sigma=1, a=-1, b=2:

- Full calculation: 0.8185946141203637, rounded to 0.8186.
- Table calculation: 0.8413 - 0.0228 = 0.8185.

Both workflows are labelled explicitly. Two tails means outside the symmetric interval [-|z|,+|z|], not its central area.

## Privacy

The lab itself makes no network requests and stores no inputs. Copy setup link encodes the entered numbers in the URL; do not share confidential data through it. Clipboard denial has a selectable-text fallback. Existing site-wide scripts retain their existing behavior.

## Verification

Run the dependency-free numerical tests from the repository root:

```sh
node --test tests/statistics-lab-math.test.js
```

Ten numerical tests passed: reference values, symmetry, the rounding example, four area modes, extreme/narrow tails, validation and all generated table cells. An independent local SciPy comparison over 2,401 z values from -12 to 12 gave maximum CDF absolute error about 2.22e-16 on that grid; this is not an error bound for all inputs.

Fifty local Chromium interface checks also passed, including mobile widths 320/390/768, dragging, keyboard lookup, errors, copied setup state and course-panel refreshes. The browser test used inline-loaded files and an explicit native-router DOM fixture because this execution environment blocked network navigation. These checks do not constitute an end-to-end test of the deployed site. Test evidence and screenshots are available with the implementation handoff.

Recommended deployment smoke check: open the course tab, change bounds, switch to the Z-table, follow a worked-step lookup, leave/re-enter the tab and check the browser Back button.

## References

- NIST/SEMATECH, Normal Distribution: https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm
- NIST DLMF, Incomplete Gamma Continued Fractions: https://dlmf.nist.gov/8.9

Future tools can share this mount-point architecture; v1 deliberately does not add CLT, confidence intervals or hypothesis-testing calculators yet.
