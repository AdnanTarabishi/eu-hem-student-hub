---
topic: fund-statistics.hypothesis-tests
author: Student Hub
updated: 2026-10-07
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

Work from hypotheses to a test statistic, p-value and decision, then explain the result in healthcare.

## Prepare a test before looking at the result

All 36 Topic 5 slides have now been reviewed, alongside the formula sheet, current Exercise Book and supplied mock-answer explanations. This guide uses original examples and clarifies the links between the lecture’s three decision approaches.

For a mean, write H₀: μ=μ₀ and Hₐ: μ≠μ₀. For a proportion, write H₀: π=π₀ and Hₐ: π≠π₀. The hypotheses concern population parameters, not the observed sample mean or proportion. Choose α and the direction of the alternative before seeing the data.

A two-sided test treats departures in either direction as evidence. A one-sided alternative changes the tail and critical value and must be justified in advance. The course formula sheet and practice here focus on two-sided tests.

## Rejection regions: read the graph under H₀

Start with the sampling distribution assuming the null is true. For a known-variance normal mean model, it is centred on μ₀ with spread σ/√n. Standardising changes the horizontal axis to z, centred on zero. The graph is a distribution of sample means or test statistics, not a histogram of individual patients.

In a two-sided test, allocate α/2 to each extreme tail. Critical values mark the boundaries. An observed statistic far enough in either direction falls in the rejection region. A value inside the central region gives insufficient evidence to reject; it does not prove H₀.


| Chosen α | Tail area on each side | Positive normal percentile | Critical values |
| --- | --- | --- | --- |
| 10% | 5% | 0.95 | ±1.645 |
| 5% | 2.5% | 0.975 | ±1.960 |
| 1% | 0.5% | 0.995 | ±2.576 |

α is selected before seeing the result. Under the null model, it is the Type I error probability for this rejection rule. Reducing α makes the cutoff more demanding. Density height at a point is different from probability area in a tail.

Use the Explore experiment “P-value and α: two different tail areas” to compare the observed-statistic tails with the preselected rejection tails. Both plots use the same reference curve. Slides 7–18 develop this distinction.

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

A Type I error rejects a true H₀; α controls its probability under the model. Additional context beyond this slide deck: a Type II error fails to reject a false H₀; power is 1−β. A non-significant result may reflect limited precision. Choose α in advance rather than selecting a favourable threshold afterwards.

“Do not reject” means insufficient evidence of a difference at the chosen α. It does not prove equality. Statistical significance alone does not establish clinical importance or causation.

## From a cumulative table to a two-sided p-value

Normal reference: p = 2[1−Φ(|z observed|)] = 2Φ(−|z observed|)

The normal table reports the cumulative area to the left of a value. For a two-sided test, look up the magnitude |z|, subtract its cumulative area from 1, then double. This includes both tails. The sign indicates effect direction; it does not change a two-sided p-value.

Original example: z=−1.50. The normal table gives Φ(1.50)≈0.9332, so p≈2×(1−0.9332)=0.1336. At α=0.05, do not reject. The result is compatible with the null under the model, rather than evidence that the null is certainly true.


| Task | Excel expression | Interpretation |
| --- | --- | --- |
| Normal cumulative area | =NORM.S.DIST(ABS(z),TRUE) | Area left of |z| |
| Normal two-sided p | =2*NORM.S.DIST(-ABS(z),TRUE) | Both tails beyond ±|z| |
| Positive t critical value | =T.INV(1−α/2,n−1) | Cutoff for the chosen α |
| t two-sided p | =T.DIST.2T(ABS(t),n−1) | Both tails under the t reference |

A t percentile table helps retrieve cutoffs or bound a p-value, but usually does not provide the exact p-value for an arbitrary observed t. Use Excel for that calculation. For example, t=2.1 with df=64 gives p≈0.03968, which rounds to 0.04; it is not exactly 0.04. Read the function’s argument as a statistic, not a cumulative probability.

Compare unrounded p with α before rounding for presentation. z and t in these expressions stand for your calculated cell references; Excel argument separators depend on your settings. See slides 23–29.

## A proportion uses the null in its test SE

z = (p̂−π₀)/√[π₀(1−π₀)/n]

Unlike the Wald confidence interval, this test uses the null proportion π₀ in the denominator. For 120 successes in 200 trials and H₀:π=0.50, p̂=0.60, SE₀≈0.03536, z≈2.828 and p≈0.0047. Reject at 5%.

Check nπ₀ and n(1−π₀) are at least 5 (a conservative check is 10). Require independent Bernoulli observations and 0<π₀<1. The course does not cover continuity-corrected or exact versions of this test.

The mean-test confidence interval and two-sided test agree when they use the same model, SE and critical value. A Wald proportion CI and the null-based proportion test use different SEs, so their decisions need not agree exactly.

## Three approaches for a mean—and a proportion caveat

For a two-sided mean test, use the same model, standard error and reference distribution for all three approaches. Then the critical-value rule, p-value rule and matching confidence interval give equivalent decisions away from the equality boundary.


| Approach | Reject H₀ when | Check |
| --- | --- | --- |
| Critical values | |z|>z* or |t|>t* | Use the correct reference and degrees of freedom |
| P-value | p<α | Use both tails for a two-sided test |
| Mean confidence interval | μ₀ is outside the matching interval | Confidence is 100(1−α)%; use the same SE and cutoff |

For example, α=0.05 pairs with a 95% interval. If α is entered as the fraction 0.05, calculate 100×(1−α), rather than 100−0.05. At p=α or an endpoint exactly equal to μ₀, state the boundary and follow the specified convention; avoid making a decision from rounded displays. Slides 22 and 30–31 compare the three mean-test approaches.

Slide 35 also mentions a proportion-interval approach. The usual Wald proportion CI uses p̂ in its SE, while the null-based test uses π₀. They are not an exact test/interval pair, so the mean-test equivalence cannot be applied automatically. This is a clarification of the supplied sources.

An original counterexample: the two proportion SEs matter

Take n=100, successes=22 and H₀:π=0.31. The null-based test gives SE₀≈0.04625, z≈−1.94597 and p≈0.05166, so do not reject at 5%. The usual Wald 95% CI uses SE≈0.04142 and is approximately [0.13881,0.30119], excluding 0.31. Both success/failure checks are adequate; the different SEs cause the mismatch. Use the null-based test when answering the course hypothesis-test question.

## Interpret a published output


| Reported result | Defensible reading | Avoid |
| --- | --- | --- |
| p=0.03 at α=0.05 | Evidence against H₀ under the model | 3% probability H₀ is true |
| p=0.40 at α=0.05 | Insufficient evidence to reject | Proof of no effect |
| p printed as 0.000 | Smaller than the output’s precision | Exactly zero probability |
| p=1 for equal observed means | The statistic is zero under this test | Proof the populations are identical |

A complete comment names the groups or population, outcome, direction and size of the estimate, α and decision, plus the limits of the study design. Read the legend before translating significance stars into thresholds.

## Practise an equation and a conclusion

A structured exam answer

1. Define the population parameter. 2. State H₀ and Hₐ. 3. Specify the model, statistic and null distribution. 4. Report n, estimate, σ or s, and SE. 5. Substitute to get the statistic. 6. Give critical values or the p-value. 7. State the decision at α and a population-level conclusion with units and limitations.

Write equations in Word’s equation editor and upload the Word answer to EOL as instructed. These study tools support revision before the exam. During the exam only the teacher-provided formula sheet, Excel-function list and statistical tables are permitted.

## Sources

Topic 5, slides 1–36 (reviewed 7 October 2026); Formula Sheet; Exercise Book 2026/27, exercises 51–60; mock-answer document Q7–Q9. The guide uses the current book numbering; the slide exercise ranges are older. Type II error/power and the proportion counterexample are clearly labelled supplementary context.

[Official course materials](https://virtuale.unibo.it/course/view.php?id=83042).

<!-- Extended original practice -->

## Evidence, decision and effect answer different questions

| Quantity | Meaning | Cannot tell you alone |
| --- | --- | --- |
| Effect estimate | Observed distance from the reference, with units | Whether sampling uncertainty is small. |
| p-value | Extremeness under H₀ and the model | Probability that H₀ is true or the clinical importance. |
| α | Pre-specified Type I error level | The size of the observed effect. |
| Matching mean CI | Range of parameter estimates compatible with that CI procedure | An individual prediction range. For proportions, Wald CI and the null-based test need not agree. |

## Two original healthcare cases

### A decision close to the 5% cutoff

A random sample of 25 independent patients has a mean pulse of 84 bpm. Assume a normal population with known SD σ=10 bpm. Test H₀: μ=80 against Hₐ: μ≠80 at a pre-specified α=0.05.

[Try the interactive checkpoints](fund-statistics.html?case=mean-test#cases).

1. **Set the question before testing.** The parameter is the eligible population’s mean pulse. The two-sided hypotheses compare μ with 80 bpm; α=0.05 is fixed before examining the result.

2. **Standardise under H₀.** Known σ and normal independent sampling justify z. SE₀=10/√25=2 bpm; z=(84−80)/2=2.

3. **Calculate the evidence.** p=2[1−Φ(2)]≈0.04550026. The 5% two-sided critical value is 1.959964, so |z| exceeds it and p<0.05. Retain precision until making the decision.

4. **Cross-check and interpret.** The matching 95% z CI is 84±1.959964×2≈[80.0801,87.9199] bpm, excluding 80. Reject H₀ at 5%, with an estimate above 80. A 4 bpm difference still needs clinical context.

**Excel:**
- Observed z: `= (84-80)/(10/SQRT(25))`
- Two-sided p: `=2*NORM.S.DIST(-ABS(2),TRUE)`
- Positive critical value: `=NORM.S.INV(0.975)`

**Interpretation:** Under H₀ and the normal independent-sampling model, a result at least as extreme in either direction as z=2 has probability about 0.0455. Reject H₀ at 5%; the data provide evidence that the population mean differs from 80 bpm, with an estimated mean of 84 bpm. The p-value does not give the probability that H₀ is true.

**Watch for:** Rounding 0.0455 to 0.05 can obscure the decision. Compare the unrounded result with α.

### A higher observed proportion may be inconclusive

Among 300 randomly sampled independent eligible adults, 192 support a health programme. Test H₀: π=0.60 against Hₐ: π≠0.60 at a pre-specified α=0.05, using the course normal approximation without continuity correction.

[Try the interactive checkpoints](fund-statistics.html?case=proportion-test#cases).

1. **Check the model under H₀.** Expected null successes are 300×0.6=180 and failures 120. Both are ample for the course approximation. The observed support estimate is 192/300=0.64.

2. **Use the null SE.** SE₀=√(0.6×0.4/300)≈0.02828427. It uses π₀=0.6, not p̂=0.64. z=(0.64−0.60)/SE₀≈1.414214.

3. **Make the decision.** Two-sided p≈0.1572992, greater than 0.05. Do not reject H₀. The observed proportion is higher than 0.60, but this test does not provide sufficient evidence of a population difference at 5%.

4. **Keep claims bounded.** Non-rejection is not proof that π=0.60. The 4-percentage-point observed excess is an effect estimate; its sign alone does not determine significance.

**Excel:**
- Null SE: `=SQRT(0.6*(1-0.6)/300)`
- Observed z: `=((192/300)-0.6)/SQRT(0.6*(1-0.6)/300)`
- Two-sided p: `=2*NORM.S.DIST(-ABS(((192/300)-0.6)/SQRT(0.6*(1-0.6)/300)),TRUE)`

**Interpretation:** The sample support proportion is 64%, which is 4 percentage points above the null value of 60%. The null-based two-sided z test gives p≈0.1573, so we do not reject at 5%. This result is insufficient evidence of a population difference at that level; it does not prove equality.

**Watch for:** A numerical difference between p̂ and π₀ is expected under sampling variation. It is not by itself a test decision.

## Catch the common mistakes

- **“A p-value above 0.05 proves H₀.”** It means this pre-specified 5% test did not find sufficient evidence to reject. Equality or equivalence has not been established.

- **“I can choose α after seeing p.”** Select the significance level before inspecting the result. A post hoc switch changes the claimed error-control procedure.

- **“A tiny p-value implies a large useful effect.”** p depends on effect and uncertainty. Report magnitude, units and clinical context as well as statistical evidence.

[Choose a method interactively](fund-statistics.html#methods).
<!-- /Extended original practice -->
