---
topic: fund-statistics.estimation
author: Student Hub
updated: 2026-10-07
---

## 5-minute review
- The estimand is the target, estimator the rule, estimate the observed number.
- X describes individuals; X̄ describes sample means.
- Under independent sampling E(X̄)=μ and Var(X̄)=σ²/n.
- SD measures individual spread; SE measures estimator precision.
- To halve SE, multiply sample size by four.
- S² with denominator n−1 is unbiased for population variance.
- S itself is generally not an unbiased estimator of σ.
- The CLT concerns the mean and relies on assumptions.

## Study guide

Understand why an estimator varies across samples, how standard error measures precision, and why variance estimation uses n−1.

## Read the notation as a story

| Symbol | Meaning | Example |
| --- | --- | --- |
| X; xᵢ | Random individual measurement; observed value | A patient’s waiting time |
| μ; σ² | Population mean; population variance | Unknown targets |
| X̄; x̄ | Sample-mean random variable; observed mean | Rule before sampling; number afterwards |
| S²; s² | Adjusted-variance estimator; observed variance | A rule and its realised value |
| N; n | Population size; sample size | All eligible patients; patients observed |


The estimand is the target parameter. The estimator is a rule applied to random sample data. The estimate is the number obtained from one sample. X and X̄ are different random variables, even though their expected values can be equal.

## A sampling distribution is a distribution of summaries

Imagine repeatedly drawing a sample of the same size and computing its mean. The distribution of those means is the sampling distribution of X̄. It is different from the distribution of individual patients and from the histogram of one sample.

For the population 8, 4, 2, 11, 6, the mean is 6.2 and the variance is exactly 9.76 (rounded to 9.8 in the slides). Two independent draws with replacement give 25 equally likely ordered pairs. Without replacement and ignoring order, there are 10 equally likely pairs; the two observations in a pair are then dependent.

## Unbiasedness and precision

E(X̄)=μ; Var(X̄)=σ²/n; SE(X̄)=σ/√n

For independent identically distributed observations with finite variance, the sample mean is unbiased. Its expected value across samples equals the target; a particular estimate can still be far away. Precision concerns the spread of the estimator, not whether a single estimate happens to be close.

With replacement in the five-unit example and n=2, Var(X̄)=9.76/2=4.88. Without replacement, the finite-population correction changes this to (9.76/2)×(5−2)/(5−1)=3.66. The activity makes the design explicit.

Unbiased does not mean every sample is correct. More data reduce random error but do not automatically fix systematic selection or measurement bias.

## SD is not SE

| Quantity | Describes | Effect of larger n |
| --- | --- | --- |
| SD of X | Variation among individuals | Not mechanically reduced |
| SE of X̄ | Variation among repeated sample means | Decreases as 1/√n |


If population SD is 12 and n=36, SE=2. With n=144, SE=1. To halve SE, quadruple n. Increasing n from 25 to 100 does not make individual patients less variable. When σ is unknown, estimate SE using s/√n, with s from STDEV.S.

## Why the adjusted variance uses n−1

Vₙ = Σ(Xᵢ−X̄)²/n; E(Vₙ)=[(n−1)/n]σ²; S²=Σ(Xᵢ−X̄)²/(n−1)

Estimating the mean from the same observations constrains the deviations: they sum to zero, leaving n−1 freely varying deviations. Dividing by n tends to underestimate population variance. Dividing by n−1 corrects that average bias for independent sampling.

For the 25 ordered pairs in the five-unit example, average Vₙ is 4.88 and average S² is 9.76. S=√S² estimates population SD, but S itself is not generally unbiased. The unbiasedness result applies to S².

Excel choices Use VAR.P or STDEV.P to describe the observed values with denominator n. Use VAR.S or STDEV.S for adjusted estimates in inference. Do not use STDEV.P in the standard error of a t interval.

## Normality and the central limit theorem

If X is normal and observations are independent: X̄ ~ N(μ, σ²/n)

For non-normal observations with suitable independent sampling and finite variance, the central limit theorem gives an approximately normal sample mean as n increases. It does not turn the individual observations into normal data.

The course uses n≥30 as a working rule. This is a heuristic, not a universal guarantee: strong skewness, heavy tails or dependence can require a larger sample or a different method.

To calculate P(X̄>a), standardise with the standard error: (a−μ)/(σ/√n). To calculate P(X>a) for one individual, standardise with σ. Replacing SE by SD answers a different question.

## Sources

Topic 3, slides 1–33; Understanding Notation; Exercise Book 2026/27, exercises 29–32.

[Official course materials](https://virtuale.unibo.it/course/view.php?id=83042).

<!-- Extended original practice -->

## Separate the three levels of variation

| Level | Random quantity | Relevant spread |
| --- | --- | --- |
| Individuals in the population | X | Population SD σ; original units. |
| Averages from repeated samples | X̄ | SE=σ/√n under independent identically distributed sampling. |
| A summary of observed spread | S² | Adjusted estimator of σ²; squared units. |
| A realised set of observations | x̄, s² | Numbers from one sample; unbiasedness is a repeated-sample property. |

## Two original healthcare cases

### A patient and a sample mean are different

Assume independent systolic blood-pressure measurements from a normal population with mean 120 mmHg and SD 15 mmHg. Draw n=25 patients. Compare the probability that their sample mean exceeds 126 mmHg with the probability that one individual exceeds 126 mmHg.

[Try the interactive checkpoints](fund-statistics.html?case=mean-versus-person#cases).

1. **Identify two random variables.** X represents one individual measurement. X̄ represents the average of 25 independent measurements. They share expected value 120 but do not share spread.

2. **Find the sampling spread.** SE(X̄)=15/√25=3 mmHg, while SD(X)=15 mmHg. Normality of X makes the normal sampling distribution exact even though n<30.

3. **Calculate the two tails.** For X̄, z=(126−120)/3=2, giving P≈0.0227501. For X, z=(126−120)/15=0.4, giving P≈0.3445783.

4. **Explain precision.** An average smooths independent individual variation. Raising n to 100 would halve SE to 1.5 mmHg but would leave individual SD at 15 mmHg; it would not cure sampling bias.

**Excel:**
- Mean SE: `=15/SQRT(25)`
- Sample-mean tail: `=1-NORM.S.DIST((126-120)/(15/SQRT(25)),TRUE)`
- Individual tail: `=1-NORM.S.DIST((126-120)/15,TRUE)`

**Interpretation:** The sample mean has SE=3 mmHg, so 126 is two standard errors above its expectation. For an individual it is only 0.4 SD above the mean. Larger independent samples narrow the sampling distribution of averages; they do not make individual blood pressures less variable.

**Watch for:** The CLT is about the distribution of summaries. In this case the normal population already supplies an exact normal distribution for X̄.

### Why one denominator changes the estimate

Four illustrative independent observations are 4, 6, 8 and 10 minutes. Compute the descriptive variance, adjusted variance estimate and estimated SE of the mean. You are estimating spread, not performing a variance hypothesis test.

[Try the interactive checkpoints](fund-statistics.html?case=adjusted-variance#cases).

1. **Calculate deviations.** x̄=7, so deviations are −3,−1,1,3 and their sum is zero. Squared deviations sum to 9+1+1+9=20 minutes².

2. **Choose the target.** The observed descriptive variance is 20/4=5 minutes². To estimate population variance with the course adjustment, s²=20/3≈6.666667 minutes².

3. **Estimate mean uncertainty.** s=√(20/3)≈2.581989 minutes and estimated SE=s/√4≈1.290994 minutes. Neither s nor SE is a variance.

4. **Interpret unbiasedness.** Under independent identically distributed sampling, S² is unbiased across repeated samples for σ². This does not mean the single realised estimate 6.666667 must equal the unknown population variance, and √S² is not generally unbiased for σ.

**Excel:**
- Descriptive variance, A2:A5: `=VAR.P(A2:A5)`
- Adjusted variance: `=VAR.S(A2:A5)`
- Estimated mean SE: `=STDEV.S(A2:A5)/SQRT(COUNT(A2:A5))`

**Interpretation:** Estimating the mean from these same four observations forces their deviations to sum to zero, leaving three degrees of freedom. The n−1 adjustment corrects average bias in variance estimation across independent samples. This one estimate still varies from sample to sample.

**Watch for:** Use STDEV.S, not VAR.S, in s/√n. The unit of SE should match the original measurement.

## Catch the common mistakes

- **“Unbiased means this estimate is accurate.”** Unbiasedness concerns the average over repeated samples. A particular estimate may still be far from its target.

- **“Four times as many patients halves their SD.”** It halves the SE of the mean under independence and fixed population variance, while individual SD stays the same.

- **“S is unbiased because S² is unbiased.”** The square-root transformation is nonlinear. Unbiasedness of the adjusted variance does not generally transfer to the adjusted SD.

[Choose a method interactively](fund-statistics.html#methods).
<!-- /Extended original practice -->
