---
topic: fund-statistics.hypothesis-tests
author: Student Hub
updated: 2026-10-06
---

## 5-minute review
- Hypotheses concern a population parameter.
- Use σ for a known-variance z test and s for an unknown-variance t test.
- The t test has n−1 degrees of freedom.
- A two-sided p-value includes both tails beyond the observed magnitude.
- A p-value assumes H₀; it does not give P(H₀ is true).
- Do not reject does not prove equality.
- For a proportion test, calculate the SE using π₀.
- Statistical significance does not establish clinical importance or causality.

## Study guide

Work from hypotheses to a test statistic, p-value and decision, then explain what the result means in healthcare.

## Prepare a test before looking at the result

Source status: the Topic 5 PowerPoint is missing. This original guide is grounded in the syllabus, formula sheet and attached Exercise Book; its coverage should be checked against the official Topic 5 slides when supplied.

For a mean, write H₀: μ=μ₀ and Hₐ: μ≠μ₀. For a proportion, write H₀: π=π₀ and Hₐ: π≠π₀. The hypotheses concern population parameters, not the observed sample mean or proportion. Choose α and the direction of the alternative before seeing the data.

A two-sided test treats departures in either direction as evidence. A one-sided alternative changes the tail and critical value and must be justified in advance. The course formula sheet and practice here focus on two-sided tests.

## A mean with known variance

z = (x̄−μ₀)/(σ/√n)

Under H₀, use the standard normal reference distribution if sampling is normal or a suitable large-sample approximation is justified. In an original example, x̄=103, μ₀=100, σ=10 and n=100: SE=1 and z=3. The two-sided p-value is approximately 0.0027; reject at α=0.05.

The numerator is the estimated departure from the null. The denominator is the uncertainty of that estimate. A large raw difference is not enough; it must be assessed relative to the SE.

## A mean with unknown variance

t = (x̄−μ₀)/(s/√n); df = n−1

Use adjusted SD s. For normal independent observations, the null statistic follows t with n−1 degrees of freedom. For x̄=12, μ₀=10, s=4 and n=16, t=2 and df=15. The two-sided p-value is about 0.064, so do not reject at 5%. A normal cutoff alone would give a different answer.

Excel =T.DIST.2T(ABS(t),df) gives a two-sided p-value. =T.INV(1−α/2,df) gives the positive critical value. The course allows a normal approximation in large samples, but a t calculation remains appropriate.

## P-value, α and decision

A p-value is the probability, assuming H₀ and the sampling model, of obtaining a test statistic at least as extreme as the observed one. It is not the probability that H₀ is true and not the probability the result arose “by chance”.

Reject if p < α; equivalently, for a two-sided symmetric test, |statistic| > critical value

A Type I error rejects a true H₀; α controls its probability under the model. A Type II error fails to reject a false H₀; power is 1−β. A non-significant result may reflect limited precision. Choose α in advance rather than selecting a favourable threshold afterwards.

“Do not reject” means insufficient evidence of a difference at the chosen α. It does not prove equality. Statistical significance alone does not establish clinical importance or causation.

## A proportion uses the null in its test SE

z = (p̂−π₀)/√[π₀(1−π₀)/n]

Unlike the Wald confidence interval, this test uses the null proportion π₀ in the denominator. For 120 successes in 200 trials and H₀:π=0.50, p̂=0.60, SE₀≈0.03536, z≈2.828 and p≈0.0047. Reject at 5%.

Check nπ₀ and n(1−π₀) are at least 5 (a conservative check is 10). Require independent Bernoulli observations and 0<π₀<1. The course does not cover continuity-corrected or exact versions of this test.

The mean-test confidence interval and two-sided test agree when they use the same model, SE and critical value. A Wald proportion CI and the null-based proportion test use different SEs, so their decisions need not agree exactly.

## Interpret a published output

| Reported result | Defensible reading | Avoid |
| --- | --- | --- |
| p=0.03 at α=0.05 | Evidence against H₀ under the model | 3% probability H₀ is true |
| p=0.40 at α=0.05 | Insufficient evidence to reject | Proof of no effect |
| p printed as 0.000 | Smaller than the output’s precision | Exactly zero probability |
| p=1 for equal observed means | The statistic is zero under this test | Proof the populations are identical |


A complete comment names the groups or population, outcome, direction and size of the estimate, α and decision, plus the limits of the study design. Read the legend before translating significance stars into thresholds.

## Practise an equation and a conclusion

A structured exam answer 1. Define the population parameter. 2. State H₀ and Hₐ. 3. Specify the model, statistic and null distribution. 4. Report n, estimate, σ or s, and SE. 5. Substitute to get the statistic. 6. Give critical values or the p-value. 7. State the decision at α and a population-level conclusion with units and limitations.

Write equations in Word’s equation editor and upload the Word answer to EOL as instructed. These study tools support revision before the exam. During the exam only the teacher-provided formula sheet, Excel-function list and statistical tables are permitted.

## Sources

Syllabus Topic 5; Formula Sheet; Exercise Book 2026/27, exercises 51–60; mock-answer document Q7–Q9. Topic 5 slides were not supplied.

[Official course materials](https://virtuale.unibo.it/course/view.php?id=83042).
