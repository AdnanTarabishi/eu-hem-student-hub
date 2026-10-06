---
topic: statistics.sampling
author: EU-HEM study notes
updated: 2026-10-06
---
## 5-minute review
- A population is the group we want to understand; a sample is the group we actually observe.
- An estimand is the target parameter, an estimator is a calculation rule, and an estimate is its observed result.
- A sampling distribution describes an estimator across repeated samples of the same size.
- The sample mean is unbiased: E[X̄] = μ under random sampling.
- Under independent, identically distributed sampling with finite variance, the sample mean is consistent.
- Standard deviation describes individual observations; standard error describes the variation of sample means.
- For independent observations with a common population standard deviation, SE(X̄) = σ / √n. Quadrupling n halves SE.
- A known-σ 95% z confidence interval is x̄ ± 1.96 × σ / √n when the sampling distribution is normal or approximately normal.

## Class 5 interactive study page

[Open the interactive lecture](lecture.html?topic=statistics.sampling) for the full explanations, three activities, and 20 multiple-choice questions with feedback.

The page includes a simulation of repeated samples, exact enumeration of samples from a five-person population, and a known-population-SD confidence-interval calculator. Your quiz answers and topic status are saved in this browser and included in the Notes progress backup.

## The two lecture examples

In Exercise 5.1, the five population weights are 65, 89, 75, 64, and 86 kg. Their mean is 379 / 5 = **75.8 kg**. Across all equally likely samples of a fixed size, the average sample mean equals this population mean. Because sampling is without replacement from a small population, its exact standard error needs the finite-population correction.

In Exercise 5.2, individual weights are uniformly distributed with mean **27.5 kg** and standard deviation approximately **12.99 kg**. For 100 independent observations, the expected sample mean remains 27.5 kg and its standard error is approximately **1.299 kg**. The sample mean is approximately normally distributed.

## Confidence intervals: supplementary explanation

The short lecture lists confidence intervals as an objective but does not develop their calculation. The interactive page’s interval activities and Questions 17–20 are supplementary practice.

If the observed mean is 70 kg, the population SD is known to be 20 kg, and the sample size is 100, SE = 2 kg. Assuming independent sampling and a normal or approximately normal sampling distribution, the 95% interval is **66.08–73.92 kg**.

About 95% of intervals constructed by this method across repeated samples contain the fixed true population mean. This does not mean that 95% of individual weights fall in the interval, or assign a 95% probability to μ after observing a particular interval.

The lecture uses n ≥ 30 as a normal-approximation rule of thumb. Strong skewness or extreme tails can require larger samples. When population SD is unknown, the usual normal-population method uses sample SD and a t critical value instead; that calculation is outside this page’s known-σ calculator.

## Official materials

These are original, paraphrased study explanations based on Martin Forster’s Statistics for Healthcare, Class 5, University of Bologna, 1 October 2026. They may contain errors. The original slides remain on [Virtuale](https://virtuale.unibo.it); they are not uploaded to this site.
