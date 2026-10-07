---
topic: fund-statistics.estimation
author: Student Hub
updated: 2026-10-06
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
