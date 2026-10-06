---
topic: fund-statistics.two-means
author: Student Hub
updated: 2026-10-06
---

## 5-minute review
- Independent groups contain unrelated observations; paired groups have a matching structure.
- Define Δ=μ₁−μ₂ before interpreting signs.
- Independent-group SE is √(s₁²/n₁+s₂²/n₂).
- The course uses the normal approximation for large-sample two-mean calculations.
- The paired analysis uses the SD of the differences.
- Equal variance is an assumption, not a default fact.
- Read the actual significance-star legend.
- A non-significant result does not prove population equality.

## Study guide

Recognise independent and paired designs, calculate the uncertainty of a difference and interpret a two-group result.

## Choose the comparison from the design

Topic 6 is labelled an additional topic, time permitting, in the syllabus. The paired, equal-variance and two-proportion formulas in slides 15–23 are illustrative; the slides say students will not be asked to use those formulas.

| Design | Example | Unit used for analysis |
| --- | --- | --- |
| Independent samples | Different patients in two clinics | Observations in each group |
| Paired samples | The same patient before and after treatment | Within-patient difference |
| Matched samples | Matched patient/control pairs | Within-pair difference |


Having equal sample sizes does not make a study paired. Pairing is a relationship in the design. Random assignment can support causal reasoning; merely finding a difference between observational groups cannot.

## Define the contrast and direction

Δ = μ₁−μ₂; estimated difference = x̄₁−x̄₂

Specify group 1, group 2, outcome and units before calculating. A negative estimate means group 1 has a lower observed mean. Reversing the group order reverses the sign, but does not change the SE or a two-sided p-value.

The null is H₀:μ₁−μ₂=0; the two-sided alternative is Hₐ:μ₁−μ₂≠0. The parameter is the difference of population means.

## Independent groups: add the variances

SE( x̄₁−x̄₂ ) = √(s₁²/n₁ + s₂²/n₂)

Independence lets variances add. Do not add the two SDs and do not divide by the combined sample size. Use adjusted SDs s₁ and s₂. Each sample contributes its own variance divided by its own n.

The large-sample course statistic is z≈(x̄₁−x̄₂)/SE under H₀. Although the slides call this an independent-samples t test, their assessed calculations use the large-sample normal approximation. A small unequal-variance sample would generally need Welch’s t with estimated df; that calculation is supplementary to this guide.

## Work an original healthcare example

Two independent clinic samples have n₁=160, x̄₁=125, s₁=12 and n₂=180, x̄₂=129, s₂=15, in mmHg. The estimated difference is −4 mmHg. SE=√(144/160+225/180)=√2.15≈1.466. The statistic is about −2.728, giving a two-sided normal p-value about 0.0064.

Reject equal population means at α=0.05. The estimated 95% large-sample CI for the contrast is −4±1.960×1.466≈[−6.87,−1.13] mmHg. This indicates a lower mean in clinic 1 under the sampling assumptions; it does not by itself identify a causal clinic effect.

The calculator uses the course large-sample approximation. It requires at least 30 observations per group and still needs adequate distributional behaviour and independence. It does not implement the small-sample Welch test.

## Recognise the illustrative variations

| Variation | Standard error / method | Condition |
| --- | --- | --- |
| Equal variance assumed | sₚ√(1/n₁+1/n₂); df=n₁+n₂−2 | A justified common population variance |
| Paired means | s_d/√n; df=n−1 | Analyse each matched difference dᵢ |
| Two proportions | Pooled proportion in the null SE | Adequate null success/failure counts |


Paired statistic = (d̄−0)/(s_d/√n)

For a paired analysis, s_d is the adjusted SD of individual differences. It is not the difference between the two SDs. In CHOLESTEROL, the same 24 employees are measured twice. In PRESSURE, the same 32 participants are measured in two positions. Treating either as two independent groups loses the pairing.

Pooled variance, for recognition sₚ²=[(n₁−1)s₁²+(n₂−1)s₂²]/(n₁+n₂−2). This is a variance, not an SD. The pooled two-mean test assumes equal population variances; it is not interchangeable with the unequal-variance method.

## Read results and significance stars

Start with the table’s variable, group definitions, sample sizes, units and legend. Stars report thresholds defined by the authors; the thresholds differ between papers. A smaller p-value is evidence against the stated null under the model, not a measure of the size of the group difference.

If the p-value is 0.08, a pre-specified 5% test does not reject; a pre-specified 10% test does. Do not change α after seeing the result. If p=1 because the sample means are equal, say there is no evidence against the equal-means null from this test, not that population equality is proven.

A useful written comment Report the direction and magnitude of the difference, its uncertainty, the test and α, then state the decision. Distinguish a statistical difference from a clinically useful effect and from a causal treatment effect.

## Sources

Topic 6, slides 1–29; Exercise Book 2026/27, exercises 61–64. Additional topic in the syllabus, time permitting.

[Official course materials](https://virtuale.unibo.it/course/view.php?id=83042).
