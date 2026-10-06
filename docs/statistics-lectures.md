# Statistics for Healthcare · 2026/27

Module 74948, Martin Forster, within Quantitative Methods in Health and Healthcare.
The supplied PDFs' title pages date Classes 1–6 to 14 September, 16 September,
22 September, 24 September, 1 October and 5 October 2026. File creation dates
are not treated as lecture dates. The alternate Economics and Public Policy
course code C8386 is not a second module in the EU-HEM study plan.

| Class | Stable topic ID | Interactive activities | MCQs |
| --- | --- | --- | --- |
| 1 | statistics.risk-uncertainty | Events, union, intersection and conditioning | 20 |
| 2 | statistics.probability | Diagnostic probabilities and binomial PMF | 20 |
| 3 | statistics.random-variables | Normal probabilities and uniform intervals | 20 |
| 4 | statistics.descriptive | Editable sample summaries and study-design scenarios | 20 |
| 5 | statistics.sampling | Repeated samples, exact small-population samples and known-σ CI | 20 |
| 6 | statistics.inference | One-mean z/t test, p-value and matching CI | 20 |

The original `statistics.q.001`–`020` sampling IDs remain stable. New IDs use
`statistics.q.class<number>-<number>`. All six pages use the same template and
shared Notes progress backup, with independent per-topic quiz state.

Sources reviewed: the six supplied full lecture PDFs, course outline, assessed
work 1A and 1B question and answer files, the 2022/23 exam #2 and the normal
distribution spreadsheet. Guides and MCQs are original study explanations and
practice, not reproductions of official assessment papers. The spreadsheet's
CDF and interval calculations informed the normal explorer. Source PDFs, XLSX,
screenshots of slides and official answer sheets are not published in this repository.

The full Class 5 PDF includes confidence intervals, so those explanations and
questions are core material rather than supplementary material. Its sampling
distribution example uses μ=27.5 and σ²=168.75. The five-person example samples
without replacement and requires a finite-population adjustment; the general
σ/√n formula assumes independent draws. SD and SE have original units.

Class 6's worked example n=20, x̄=5, s=3, μ₀=7 yields t(19)=−2.98142397,
p=0.00767061 and a 95% CI [3.59595678,6.40404322]. The page calculates these
without rounding before making a decision. It follows the lecture's boundary
convention: p<α rejects, p>α does not reject, equality is the boundary. Normal
probabilities use an erf approximation; Student's t uses a regularised incomplete
beta calculation, with numerical inversion for critical values. Small non-normal
samples are not accepted by the teaching calculator; n≥30 is explicitly a course
rule of thumb. These tools are for learning, not clinical decision making.

Classes 7, 8, 9, 10 and Tutor Classes 2 and 3 are marked upcoming with the user’s
exact Virtuale section links. Two-mean tests, regression, full Stata output
interpretation and later material are not presented as completed. The course
assessment also includes interpretation and explanations; MCQs alone do not
cover the full exam. Official materials: https://virtuale.unibo.it/course/view.php?id=84235.

Validation: `node scripts/check-content.js`, `node tests/lectures/math.test.js`,
and `node tests/lectures/browser.test.js .` (uses Playwright and installed Chromium).
