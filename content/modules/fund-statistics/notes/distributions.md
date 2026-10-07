---
topic: fund-statistics.distributions
author: Student Hub
updated: 2026-10-07
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

<!-- Extended original practice -->

## Probability questions have different operations

| Question | Operation | Main check |
| --- | --- | --- |
| A left tail up to a | F(a) | Cumulative probability, not density height. |
| A right tail beyond a | 1−F(a) | Choose the complement. |
| Between a and b | F(b)−F(a) | For discrete X, check endpoint inclusion. |
| A percentile at probability q | Inverse CDF | Normal xq=μ+σzq; use SD in original units. |

## Two original healthcare cases

### A probability model for follow-up visits

An illustrative model for next-month follow-up visits has X=0,1,2,3 with probabilities 0.10,0.40,0.30,0.20. Treat these as model probabilities, not observed sample frequencies.

[Try the interactive checkpoints](fund-statistics.html?case=visit-model#cases).

1. **Validate the model.** All probabilities are nonnegative and their sum is 1. The possible counts are discrete; there is no outcome of 1.6 visits for a single person.

2. **Weight outcomes.** E(X)=0×0.1+1×0.4+2×0.3+3×0.2=1.6 visits. This is a long-run average, not the most likely outcome.

3. **Calculate spread.** E(X²)=0+0.4+4×0.3+9×0.2=3.4 visits². Var(X)=3.4−1.6²=0.84 visits²; SD≈0.9165 visits.

4. **Choose the tail.** P(X≥2)=P(X=2)+P(X=3)=0.5. Here P(X>2)=0.2, so a strict versus inclusive inequality matters.

**Excel:**
- Expected value, counts A2:A5 and probabilities B2:B5: `=SUMPRODUCT(A2:A5,B2:B5)`
- Second moment, squared counts in C2:C5: `=SUMPRODUCT(C2:C5,B2:B5)`

**Interpretation:** The expectation is the probability-weighted long-run average of visit counts and need not be an individual outcome. In this discrete model, “at least 2” includes the mass at 2, giving 0.5; “more than 2” includes only 3, giving 0.2.

**Watch for:** An unweighted average of the four possible counts would ignore how likely each outcome is.

### Translate a normal waiting-time question

For an illustrative planning model, an individual waiting time X is normal with mean 30 minutes and SD 6 minutes. Find the probability above 39 minutes, the probability between 24 and 39 minutes, and the 95th percentile. Evaluate whether a normal model is plausible before using it with real waiting-time data.

[Try the interactive checkpoints](fund-statistics.html?case=normal-wait#cases).

1. **Standardise individuals.** z(39)=(39−30)/6=1.5 and z(24)=(24−30)/6=−1. This question concerns individuals, so use SD=6, not a standard error.

2. **Find the right tail.** P(X>39)=1−Φ(1.5)≈0.0668072, about 6.68%.

3. **Subtract cumulative areas.** P(24<X<39)=Φ(1.5)−Φ(−1)≈0.7745375, about 77.45%. For this continuous model, including an endpoint does not change the probability.

4. **Reverse the operation.** z0.95≈1.644854, so x0.95=30+6×1.644854≈39.8691 minutes. This is a percentile of individual waits, not a confidence limit for the mean.

**Excel:**
- Right tail: `=1-NORM.S.DIST(1.5,TRUE)`
- Interval probability: `=NORM.S.DIST(1.5,TRUE)-NORM.S.DIST(-1,TRUE)`
- 95th percentile: `=30+6*NORM.S.INV(0.95)`

**Interpretation:** Under the stated normal model, about 95% of individual waits are at or below 39.87 minutes. This cutoff describes the distribution of individual waits; a confidence interval would instead describe uncertainty about a population parameter estimated from sample data.

**Watch for:** NORM.S.DIST(z,FALSE) returns a density height, not the area needed for these probabilities.

## Catch the common mistakes

- **“A continuous density of 0.2 is a 20% point probability.”** Density is height. Probability is area over an interval; a point has probability zero under a continuous model.

- **“Every large sample is representative.”** Volunteer selection or an incomplete sampling frame can introduce bias. More observations alone do not remove systematic selection problems.

- **“The 95th percentile means use Φ(0.95).”** 0.95 is a probability. Use the inverse cumulative function to find z0.95, then translate back to the original units.

[Choose a method interactively](fund-statistics.html#methods).
<!-- /Extended original practice -->


## Apply probabilities and inspect real sampling designs

Othitis.xlsx is a probability model for counts 0–6, not a seven-person sample. E(X)=2.038 and Var(X)=1.966556. P(X≥3)=.336 differs from P(X>3)=.151 because the former includes the mass at 3.

Real reports need a defined sampling unit and design. NHSR 211 summarizes weighted visits, whereas NHSR 209 estimates proportions among older adults. A probability table, a sample of people and a weighted file of visits are different objects.

- [Otitis counts: expected value and discrete tails](fund-statistics.html?guide=otitis-probability#lab-guides)
- [All 25 samples: see bias and precision exactly](fund-statistics.html?guide=sampling-enumeration#lab-guides)
- [Health-centre visits: define the denominator](fund-statistics.html?guide=health-centre-report#lab-guides)
