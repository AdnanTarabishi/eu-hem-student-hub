---
topic: fund-statistics.confidence-intervals
author: Student Hub
updated: 2026-10-06
---

## 5-minute review
- An interval is estimate ± critical value × SE.
- Use z with known σ; use t with estimated s.
- A two-sided confidence level 1−α needs percentile 1−α/2.
- Use STDEV.S for the s in a t interval.
- Coverage refers to repeated intervals, not individual observations.
- Higher confidence widens a CI; a larger sample narrows it.
- For proportion CIs, use the observed proportion in the SE.
- Check both success and failure counts before using a Wald interval.

## Study guide

Build a point estimate plus a margin of error, choose z or t correctly, and write a confidence statement that matches the target.

## Point estimate plus margin of error

Confidence interval = estimate ± critical value × standard error

A point estimate reports one number. An interval attaches uncertainty to the estimated population parameter. The margin of error is the distance from the estimate to either endpoint. It is not SD and not the full interval width.

State the population, outcome, units and confidence level. For example, a 95% interval [8.1, 9.7] days estimates a population mean hospital stay. It does not say 95% of individual stays are in that range.

## A mean with known population variance

x̄ ± z(1−α/2) σ/√n

Use the population SD σ, taking a square root if you are given σ². Under normal independent sampling this is exact; a sufficiently well-behaved large sample can justify a normal approximation. For an original teaching example, x̄=80, σ=12, n=36 gives SE=2 and a 95% interval 80±1.960×2 = [76.08, 83.92].

| Confidence | α | Cumulative percentile | z critical |
| --- | --- | --- | --- |
| 90% | 0.10 | 0.95 | 1.645 |
| 95% | 0.05 | 0.975 | 1.960 |
| 99% | 0.01 | 0.995 | 2.576 |


The cumulative percentile is 1−α/2, not the confidence level itself.

## A mean with unknown population variance

x̄ ± t(n−1, 1−α/2) s/√n

Estimate σ with the adjusted SD s and use t with n−1 degrees of freedom. For x̄=80, s=12, n=16 and a normally distributed population, SE=3 and t₁₅,₀.₉₇₅≈2.131, giving [73.61, 86.39]. Using z would ignore some uncertainty about SD.

The course permits z in place of t for large samples, around n≥120. This is an approximation; t remains usable. The supplied sources differ slightly at the boundary (n>120 versus n≥120). Using t avoids a forced boundary decision.

Small sample checklist Independent random observations, a quantitative outcome, and an approximately normal population are needed for the small-sample t method. Large n is not a cure for selection bias or correlated observations.

## Confidence describes the procedure

Before sampling, the interval endpoints are random and μ is fixed. Across repeated samples, about 95% of intervals produced by a valid 95% procedure contain μ. Once an interval has been calculated, it either contains μ or it does not.

Do not say that there is a 95% probability that this fixed μ lies in this one frequentist interval. Say: “We estimate the population mean to be between L and U, using a method with 95% repeated-sampling coverage.”

The 95% CI does not describe 95% of future sample means, nor 95% of individual measurements. Those are different distributions and would require different intervals.

## What changes the width?

Width = 2 × critical value × SE

A higher confidence level increases the critical value and widens the interval. Larger SD widens it. Larger n narrows it approximately at rate 1/√n. At a fixed critical value and SD, quadrupling n halves the width.

Narrow intervals are precise but can still be misleading under biased sampling. An interval alone does not establish clinical usefulness: consider the units, plausible effect sizes and how the sample was obtained.

## A population proportion

p̂ = successes/n; SE(p̂)≈√[p̂(1−p̂)/n]; Wald CI = p̂ ± z* SE(p̂)

For an indicator coded 0/1, the sample mean is a sample proportion. The population proportion is π; we use p̂ for an observed sample proportion to avoid confusing it with a test p-value. In an original example, 120 of 200 patients attend a follow-up: p̂=0.60, SE≈0.0346 and the 95% interval is about [0.532, 0.668].

The course uses the large-sample Wald approximation with enough successes and failures (at least 5 each; 10 each is a common more conservative guideline). Merely having n≥30 is not enough when the proportion is near zero or one.

A Wald interval can perform poorly near boundaries and can extend outside [0,1]. Do not silently truncate it and call the result the same procedure. The calculator flags unsuitable cases. Alternatives such as Wilson intervals are supplementary and are not implemented here.

## Write the result, then check the method

| Target | SE | Critical value |
| --- | --- | --- |
| Mean, σ known | σ/√n | z |
| Mean, σ unknown | s/√n | t with n−1 df; large-sample z approximation allowed |
| Proportion | √[p̂(1−p̂)/n] | z, with adequate success/failure counts |


A complete answer Name the parameter and population. Report n, estimate, σ or s, SE, confidence level and critical value. Show the substitution, give both endpoints with units, then interpret the interval and the sampling assumptions.

Exercise numbering in older slide footers is offset. This workspace uses the attached 2026/27 book: mean intervals 33–43 and proportion intervals 44–50.

## Sources

Topic 4, slides 1–33; Formula Sheet; Exercise Book 2026/27, exercises 33–50.

[Official course materials](https://virtuale.unibo.it/course/view.php?id=83042).
