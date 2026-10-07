---
topic: fund-statistics.confidence-intervals
author: Student Hub
updated: 2026-10-07
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

<!-- Extended original practice -->

## Three interval recipes

| Target | SE | Reference and check |
| --- | --- | --- |
| Mean, σ known | σ/√n | z; exact under normal independent sampling. |
| Mean, σ unknown | s/√n | t, df=n−1; check normality for small samples. |
| Population proportion | √[p̂(1−p̂)/n] | z; check observed successes and failures for the Wald approximation. |
| Individual measurement percentile | Individual SD, not mean SE | A percentile describes individuals; it is not a CI for a parameter. |

## Two original healthcare cases

### A small-sample interval for a mean score

A random sample of 16 independent eligible patients has a quantitative score mean of 54 points and adjusted SD 8 points. Assume the population scores are approximately normal and population variance is unknown. Construct a 95% confidence interval for the population mean.

[Try the interactive checkpoints](fund-statistics.html?case=mean-interval#cases).

1. **Choose t.** The SD of 8 is estimated from the sample. Use t with n−1=15 degrees of freedom, given the normality and independence assumptions.

2. **Find uncertainty.** SE=8/√16=2 points. For 95% confidence, α=0.05 and the cumulative critical percentile is 0.975. t15,0.975≈2.1314495.

3. **Build the interval.** Margin=2.1314495×2≈4.2628991 points. The interval is 54±4.2628991=[49.7371,58.2629] points. Its full width is 8.5258 points.

4. **Explain the level.** This estimates the eligible population’s mean score. The method has 95% repeated-sampling coverage under the stated model; the interval does not contain 95% of patient scores.

**Excel:**
- Critical value: `=T.INV(0.975,15)`
- Lower endpoint: `=54-T.INV(0.975,15)*8/SQRT(16)`
- Upper endpoint: `=54+T.INV(0.975,15)*8/SQRT(16)`

**Interpretation:** We estimate the mean score in the eligible patient population to be between 49.74 and 58.26 points using a 95% t procedure under independent normal sampling. The t critical value allows for estimating population SD; substituting 1.96 gives a narrower z interval that does not use the stated small-sample unknown-variance method.

**Watch for:** The confidence level is 0.95, but the two-sided cumulative critical percentile is 0.975.

### How many patients attend follow-up?

A random sample of 250 independent eligible patients includes 175 who attend follow-up. Estimate the population attendance proportion with the course 95% Wald interval. Enter proportions and SEs as decimals, not percentages.

[Try the interactive checkpoints](fund-statistics.html?case=proportion-interval#cases).

1. **Define success and target.** Success means attending follow-up. The observed estimate is p̂=175/250=0.7; the target π is the proportion among all eligible patients.

2. **Check observed counts.** There are 175 observed successes and 75 failures. Both exceed the course minimum of 5 and the common stricter guideline of 10.

3. **Calculate the Wald interval.** Estimated SE=√(0.7×0.3/250)≈0.02898275. With z*=1.959964, margin≈0.05680515 and CI≈[0.64319485,0.75680515].

4. **Translate to percentages.** The attendance estimate is 70%, with an approximate 95% interval of 64.32%–75.68% for the population proportion. The margin is about 5.68 percentage points, not 5.68% relative growth.

**Excel:**
- SE: `=SQRT((175/250)*(1-175/250)/250)`
- Lower endpoint: `=175/250-NORM.S.INV(0.975)*SQRT((175/250)*(1-175/250)/250)`
- Upper endpoint: `=175/250+NORM.S.INV(0.975)*SQRT((175/250)*(1-175/250)/250)`

**Interpretation:** The sample attendance estimate is 70%; the approximate 95% Wald interval estimates the population proportion as 64.32%–75.68%. The normal approximation is supported by 175 observed successes and 75 observed failures, given independent sampling. The interval’s confidence level refers to repeated-sampling coverage.

**Watch for:** For an interval use the observed p̂ in the SE. A proportion hypothesis test generally uses the null π₀ instead.

## Catch the common mistakes

- **“95% of patients lie in the mean CI.”** The interval estimates a population parameter. Individual spread requires an individual-level distribution or a different interval.

- **“A narrower CI must be better.”** Precision is useful only with a sound design and model. A biased sample can yield a narrow but misleading interval.

- **“A proportion CI should use the null proportion.”** A Wald CI estimates its SE from p̂. The null-based test uses π₀, so they are not automatically interchangeable.

[Choose a method interactively](fund-statistics.html#methods).
<!-- /Extended original practice -->
