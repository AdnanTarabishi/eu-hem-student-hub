---
topic: fund-statistics.distributions
author: Student Hub
updated: 2026-10-06
---

## 5-minute review
- Simple random sampling makes every size-n subset equally likely.
- Stratified samples use every stratum; cluster samples select clusters.
- Probability mass sums to 1; density has total area 1.
- The expected value is a probability-weighted average.
- For Bernoulli X, mean π and variance π(1−π).
- Normal standardisation divides by SD, not variance.
- A CDF reports area to the left; upper tails use its complement.
- A two-sided 95% interval uses the 97.5th percentile.

## Study guide

Connect sampling design to probability models, expected values, normal standardisation and the Student’s t table.

## Sampling design comes first

| Design | How selection works | Watch for |
| --- | --- | --- |
| Simple random | Every subset of size n is equally likely | Incomplete sampling frame |
| Systematic | Random start, then every kth unit | Periodicity in the list |
| Stratified | Sample within every stratum | Appropriate stratum weights |
| Cluster | Randomly select clusters | Dependence within clusters |
| Multistage | Combine selection stages | Design-specific standard errors |
| Volunteer | People select themselves | Unknown selection probabilities |


Sampling variability is how a statistic changes across samples. Sampling error is its difference from the target parameter in a particular sample. A random sample still has sampling error. A large volunteer sample can still be biased. The course’s simple formulas do not automatically apply to complex survey designs.

## Random variables and probability distributions

A random variable assigns a numeric value to an uncertain outcome. Its distribution describes the possible values and how likely they are. Under a long-run interpretation, probabilities describe relative frequencies across many repetitions. A probability distribution describes a model; a frequency distribution describes recorded observations.

For a discrete X: 0 ≤ P(X=x) ≤ 1 and ΣP(X=x) = 1

Discrete random variables have countable possible values. For an illustrative number of clinic visits X = 0, 1, 2 with probabilities 0.2, 0.5, 0.3, the probabilities sum to 1 and P(X≥1)=0.8. Counting favourable outcomes works only when elementary outcomes are equally likely.

## Expected value, variance and Bernoulli variables

E(X)=ΣxP(X=x); Var(X)=Σ[x−E(X)]²P(X=x)

In the clinic example E(X)=1.1 visits and Var(X)=0.49 visits². The expected value is a probability-weighted average and need not be a possible individual outcome. For a binary indicator with P(X=1)=π, X follows a Bernoulli distribution: E(X)=π and Var(X)=π(1−π). Its SD is √[π(1−π)].

## PDF, CDF and area

F(a)=P(X≤a); P(a<X<b)=F(b)−F(a)

A continuous probability density f(x) is nonnegative and has total area 1. Probability is an area over an interval, not the height of the curve. A density can exceed 1 if its area still integrates to 1. In a continuous model, P(X=a)=0, so including an endpoint does not change an interval probability. Recorded rounded measurements may still repeat.

The CDF accumulates probability from the far left up to a. It increases from 0 to 1. This course uses statistical tables and Excel, rather than requiring integral calculations.

## Normal models and standardisation

X ~ N(μ, σ²); Z=(X−μ)/σ ~ N(0,1)

The normal curve is symmetric about μ. Its mean, median and mode coincide. Changing μ moves the centre; changing σ changes the spread. In N(120, 100), the second argument is variance, so the SD is 10. An observed value of 135 has z=1.5.

To find an upper-tail probability, use 1−Φ(z). To find an interval, subtract cumulative probabilities. For example P(110<X<130)=Φ(1)−Φ(−1)≈0.6827. To find a percentile, reverse the calculation: xₐ=μ+σzₐ. Not every biomedical variable is normally distributed.

## Use the tables in the correct direction

| Question | Calculation | Example |
| --- | --- | --- |
| Left tail | Φ(z) | Φ(1.73)=0.9582 |
| Right tail | 1−Φ(z) | P(Z>1.73)=0.0418 |
| Negative value | Φ(−z)=1−Φ(z) | Φ(−1.73)=0.0418 |
| Central area | Φ(b)−Φ(a) | P(−1.96<Z<1.96)≈0.95 |


Table D.1 in the supplied PDF gives cumulative normal probabilities. The row gives the units and first decimal of z; the column gives its second decimal. The density table D.6 reports curve heights, so it cannot replace D.1 for tail probabilities.

The 95th percentile z₀.₉₅≈1.645 is not the critical value for a two-sided 95% CI. That interval needs z₀.₉₇₅≈1.960 because 2.5% lies in each tail.

## Student’s t and the extra tables

A t distribution is symmetric about zero and has heavier tails than the standard normal. Degrees of freedom determine its shape. With unknown population SD, a normal-population sample mean standardised using s follows t with n−1 degrees of freedom. As df increases, t approaches normal.

95% two-sided t critical value = t(df, 0.975); Excel: =T.INV(0.975, df)

The t table D.2 lists cumulative percentiles, including 0.90, 0.95, 0.975, 0.99 and 0.995. For df=20, t₀.₉₅≈1.725. The supplied PDF also contains chi-square and F tables. Their presence does not mean variance tests or F tests are assessed in this Fundamentals course; the syllabus excludes inference on variance.

Normal or t? Normal standardisation uses the known population SD σ. A mean with an estimated SD s introduces additional uncertainty; use t with n−1 degrees of freedom under normal sampling. The course permits a normal approximation in large samples, around n≥120.

## Sources

Topic 2, slides 1–64; Exercise Book 2026/27, exercises 13–28; Statistical Tables, tables D.1 and D.2.

[Official course materials](https://virtuale.unibo.it/course/view.php?id=83042).
