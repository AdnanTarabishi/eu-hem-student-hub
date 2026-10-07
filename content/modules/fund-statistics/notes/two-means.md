---
topic: fund-statistics.two-means
author: Student Hub
updated: 2026-10-07
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

<!-- Extended original practice -->

## Design controls the comparison

| Design / claim | Analysis | Check before concluding |
| --- | --- | --- |
| Two independent groups | Add the variances s₁²/n₁+s₂²/n₂ | Group order determines the sign; use course large-sample approximation only when justified. |
| Before and after in the same people | Analyse within-person differences | Pairing is in the design; equal sample sizes alone do not establish it. |
| Equal-variance pooled method | A separate assumption and formula | Do not assume equal variances merely because sample sizes match. Illustrative in Topic 6. |
| A significant observational difference | Evidence of an association | Statistical significance does not resolve confounding or establish a causal effect. |

## Two original healthcare cases

### Compare two independent clinic means

Independent random clinic samples have n₁=144, mean₁=12 minutes, adjusted SD₁=6 minutes; n₂=100, mean₂=15 minutes, adjusted SD₂=5 minutes. Assume well-behaved sampling distributions. Use the course large-sample normal approximation for H₀: μ₁−μ₂=0 at 5%. Topic 6 is additional, time permitting.

[Try the interactive checkpoints](fund-statistics.html?case=two-clinics#cases).

1. **Define the contrast.** Δ=μ₁−μ₂ in minutes, so the observed estimate is 12−15=−3. Different patients in the two clinics make this an independent comparison, given the stated design.

2. **Add sampling variances.** SE=√(36/144+25/100)=√(0.25+0.25)=√0.5≈0.7071068 minutes. Each group uses its own n and adjusted SD.

3. **Test and attach uncertainty.** z=−3/0.7071068≈−4.242641. Two-sided normal p≈0.00002209. The 95% large-sample CI is about [−4.3859,−1.6141] minutes.

4. **Explain direction, not causation.** Reject equal means at 5%. Clinic 1’s estimated population mean is 3 minutes lower. An observational comparison cannot establish that the clinic itself caused the difference; patient mix may matter.

**Excel:**
- SE: `=SQRT(6^2/144+5^2/100)`
- Observed z: `= (12-15)/SQRT(6^2/144+5^2/100)`
- Two-sided p: `=2*NORM.S.DIST(-ABS((12-15)/SQRT(6^2/144+5^2/100)),TRUE)`

**Interpretation:** Clinic 1 has an estimated mean wait 3 minutes lower than clinic 2, with a large-sample 95% CI from about 1.61 to 4.39 minutes lower. Reversing the contrast reverses the estimate and interval signs, leaving SE and the two-sided p-value unchanged. An observed group difference alone does not establish a causal clinic effect.

**Watch for:** Do not add SDs or use s/√(n₁+n₂). Independence makes the variances of the two sample means add.

### An interval that includes zero

Two independent random samples of quantitative patient scores have n₁=64, mean₁=45, adjusted SD₁=8; n₂=100, mean₂=47, adjusted SD₂=10. Assume well-behaved large-sample means and use the course normal approximation at 5%. Topic 6 is additional, time permitting.

[Try the interactive checkpoints](fund-statistics.html?case=uncertain-difference#cases).

1. **Keep the group order.** The estimated mean contrast is 45−47=−2 points. Scores vary within each group; the target is a difference of population means, not a difference for every patient.

2. **Compute uncertainty.** SE=√(8²/64+10²/100)=√2≈1.414214 points. The standardised contrast is −2/√2≈−1.414214.

3. **Read p and CI together.** Two-sided p≈0.1572992. The matching 95% normal CI is −2±1.959964×√2≈[−4.7718,0.7718] points. It includes zero, agreeing with non-rejection at 5%.

4. **Describe what remains plausible.** The estimated difference is below zero, but the interval also includes small positive values. Statistical non-rejection does not establish equivalence or absence of an important effect. Clinical importance needs a relevant effect threshold and study context.

**Excel:**
- SE: `=SQRT(8^2/64+10^2/100)`
- Lower endpoint: `=45-47-NORM.S.INV(0.975)*SQRT(8^2/64+10^2/100)`
- Upper endpoint: `=45-47+NORM.S.INV(0.975)*SQRT(8^2/64+10^2/100)`

**Interpretation:** The estimated mean contrast is −2 points, with p≈0.1573 and a 95% interval [−4.77,0.77] points. We do not reject equal population means at 5%. The interval includes zero and differences in both directions, so this is uncertainty rather than proof of no difference, equivalence or lack of clinical importance.

**Watch for:** An interval spanning zero is not an equivalence test. Do not replace “insufficient evidence” with “the treatments are identical”.

## Catch the common mistakes

- **“Equal n means paired samples.”** Pairing comes from repeated or matched measurements on linked units. Two samples of 40 unrelated people remain independent.

- **“Reversing groups changes significance.”** It reverses the estimate and interval signs, but leaves the SE and a two-sided p-value unchanged.

- **“An interval spanning zero proves no useful effect.”** It reflects uncertainty; it may include clinically meaningful effects. Equivalence needs a separate justified procedure and margin.

[Choose a method interactively](fund-statistics.html#methods).
<!-- /Extended original practice -->


## Check dependence before comparing means in a report

PISA reports Quebec−Canada=17 points with SE=3.6. Quebec is part of Canada, so the two mean estimates share observations. Do not use the independent-groups formula √(SE₁²+SE₂²) for this contrast.

The standalone cholesterol workbook has five observations per group, equal means and different spread. It does not state the pairing/independence design and does not meet the course large-sample independent recipe. OECD’s cluster rankings require its reported Tukey comparisons; a larger point estimate alone is not proven superiority or a causal finding.

- [PISA: mean, SE and a dependent comparison](fund-statistics.html?guide=pisa-report#lab-guides)
- [Two cholesterol samples: same mean, different spread](fund-statistics.html?guide=cholesterol-spread#lab-guides)
- [Health systems: intervals do not make a league table](fund-statistics.html?guide=oecd-performance-report#lab-guides)
