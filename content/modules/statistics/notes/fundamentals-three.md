---
topic: statistics.random-variables
author: EU-HEM study notes
updated: 2026-10-06
---
## 5-minute review
- A continuous PDF gives density; probability is area, and P(X=x)=0.
- A CDF gives F(x)=P(X≤x); interval probability is F(upper)−F(lower).
- For Uniform(a,b), density is 1/(b−a), mean (a+b)/2 and variance (b−a)²/12.
- For X~N(μ,σ²), μ controls location and σ controls spread.
- Standardise with Z=(X−μ)/σ, dividing by the SD rather than the variance.
- About 95% of a normal distribution lies within 1.96 SD of its mean.
- Right skew names the long right tail; left skew names the long left tail.
- E[a+bX]=a+bE[X]. Conditional expectations describe a selected subpopulation or known value of another variable.

## Class 3: Fundamental concepts III: continuous variables and normal distributions

[Open the interactive lecture](lecture.html?topic=statistics.random-variables) for the full guide, topic-specific activities and 20 MCQs with explained answers. Progress stays in this browser and is included in the Notes backup.

### A curve’s height is not a probability.

Continuous outcomes require intervals rather than point masses.

Probability density function  The PDF f(x) is non-negative and its total area is one. The probability of an interval is its area under the curve.  P(l < X < u) = ∫ₗᵘ f(x) dx  For a continuous variable, a single point has zero width and therefore zero probability. A density can exceed one without breaking the probability axioms: area, rather than height, must stay between zero and one.

Cumulative distribution function  The CDF gives F(x) = P(X ≤ x). It is non-decreasing and runs from zero to one.  P(l < X < u) = F(u) − F(l)  For a continuous distribution, including or excluding the interval endpoints gives the same probability. You read a CDF at x to obtain a probability; the area under a CDF is not that probability.

### Equal-width intervals, equal probabilities.

A continuous uniform distribution has constant density on its support.

Uniform(a,b)  Only values between a and b have non-zero density. The density is 1/(b−a) within that interval.  P(l < X < u) = (u − l)/(b − a)  This expression assumes a ≤ l ≤ u ≤ b. If a requested interval extends beyond the support, first clip it to [a,b]. For Uniform(5,50), the probability of 20–35 is 15/45 = 1/3.

Uniform moments  Symmetry puts the mean and median at the midpoint. Every interior point shares the same maximum density, so there is no unique modal peak.  μ = (a+b)/2; σ² = (b−a)²/12  For Uniform(5,50), μ = 27.5, variance = 168.75 and SD ≈ 12.990. Increasing the support width increases the variance. Explore shows how changing the requested interval changes its probability.

### The bell curve has two parameters.

In N(μ,σ²), the second parameter is the variance, not the standard deviation.

Location and spread  A normal distribution is symmetric, unimodal and extends along the entire real line. Its mean, median and mode coincide at μ.  Increasing μ shifts the curve without changing its shape. Increasing σ spreads it out and lowers its peak while preserving total area one. Normality is a model assumption; many healthcare quantities, especially costs, have skewed distributions.

Standardisation  Subtract the mean and divide by the SD to express a value in standard-deviation units.  z = (x − μ)/σ; Z ~ N(0,1)  If IQ is modelled with mean 90 and SD 9, a value of 105 has z = 15/9 ≈ 1.667. Its upper-tail probability is about 0.0478. The normal explorer lets you change both parameters and shade lower, upper or interval probabilities.

### Use the CDF to calculate both tails.

A lower-tail probability, an upper-tail probability and an interval probability answer different questions.

Normal probabilities  Write Φ for the standard normal CDF. Then P(X < x) = Φ((x−μ)/σ).  P(X > x) = 1 − Φ((x−μ)/σ)  For a normal interval, subtract the lower endpoint’s CDF from the upper endpoint’s CDF. For Z, P(−1.5 < Z < 1.5) ≈ 0.8664. Always sketch which region the question asks for before calculating.

Useful landmarks  About 68.27% lies within one SD, 95.45% within two SD and 95% within 1.96 SD of the normal mean.  P(−1.96 < Z < 1.96) ≈ 0.95  The remaining 5% is split into two 2.5% tails. These landmarks describe individual normal observations here; later we apply normal theory to sample means and use their standard error instead.

### Shape matters. So does sample size.

Skewness describes which tail is extended, rather than where most observations sit.

Symmetry and skewness  A right-skewed distribution has a long right tail; a left-skewed distribution has a long left tail.  Healthcare expenditure often has a right tail with a few very large costs. The mean is pulled toward large observations more strongly than the median. A distribution does not become normal simply because we draw its histogram.

A normal approximation to a binomial  Binomial(n,p) has mean np and variance np(1−p). A normal model can approximate it when both expected successes and failures are sufficiently large.  Course rule: np ≥ 5 and n(1−p) ≥ 5  This is a rule of thumb rather than an exact guarantee. The approximation is developed further for proportions later in the course; Classes 1–6 do not yet provide a complete test of proportions.

### Expectations can be transformed or conditioned.

These extensions prepare the groundwork for regression without claiming that regression has already been taught.

Linear transformations  Expectation follows a linear transformation even when the original variable is not normal.  E[a + bX] = a + bE[X]  If E[X] = 10 and Y = 5 + 2X, E[Y] = 25. Adding a constant changes location, while scaling changes spread: Var(a+bX) = b²Var(X). The variance result is additional supporting explanation.

Conditional expectation and independence  E[X | Y=y] averages X in the world where Y is known to equal y. Independent variables leave each other’s distributions unchanged.  For independent fair dice: E[Y₁+Y₂] = 7  If the second die is known to be 3, E[Y₁+Y₂ | Y₂=3] = 3.5+3 = 6.5. Independence does not mean the sum’s expectation is unaffected when a component is fixed.

## Official materials

Original explanations for study, not official assessment questions or clinical guidance. Consult [Virtuale](https://virtuale.unibo.it/course/view.php?id=84235) for the lecture slides, assessed-work questions and official answers.
