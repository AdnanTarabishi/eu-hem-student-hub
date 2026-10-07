---
topic: fund-statistics.descriptive
author: Student Hub
updated: 2026-10-06
---

## 5-minute review
- Define population, sample, unit and variable before calculating.
- Choose summaries from the measurement scale.
- Relative frequencies sum to 1; cumulative frequencies require ordering.
- The median is robust to extreme values; the mean uses every magnitude.
- Use denominator n for descriptive variance and n−1 for adjusted variance.
- Name the percentile convention; Excel and slide results may differ.
- Whiskers are observed values inside the 1.5 IQR fences.
- Correlation measures linear association and does not establish causation.

## Study guide

Start with the statistical unit and measurement scale, then describe the centre, spread, shape and association in healthcare data.

## Population, sample and statistical unit

A population is the complete group defined by the research question. A sample is the part actually observed. In a study of hospital stays, the unit may be a patient admission, the variable the number of days in hospital, and the target population all eligible admissions in a specified place and period. A census observes every unit; a sample survey observes a subset.

Descriptive statistics summarise the observations you have. Inferential statistics use a sample to learn about an unknown population parameter, with uncertainty. Reporting a sample average does not automatically establish a population conclusion.

## Measurement scales determine the tools

| Scale | Healthcare example | Meaningful summaries |
| --- | --- | --- |
| Nominal | Blood group; ward name | Counts, percentages, mode; bar chart |
| Ordinal | Mild / moderate / severe pain | Ordered frequencies, cumulative percentages, median category |
| Quantitative discrete | Number of admissions | Mean, median, dispersion; frequency plot |
| Quantitative continuous | Blood pressure; duration | Mean or median, SD or IQR; histogram, box plot |


Numeric category codes are labels: the average of ward codes has no useful interpretation. An ordinal scale orders categories but does not establish equal distances. A binary variable coded 0 and 1 has a useful exception: its mean is the proportion coded 1.

A clarification to the slides: discrete values can be finite or countably infinite. Quantitative scales can have either a meaningful absolute zero (ratio, such as weight) or an arbitrary zero (interval, such as Celsius temperature).

## Frequencies and graphs

Relative frequency = category count / n; percentage = 100 × relative frequency

Absolute frequencies sum to n. Relative frequencies sum to 1. Cumulative frequencies add observations up to an ordered value; ordering is essential, so a cumulative distribution over nominal ward names is not meaningful. Bins must include all observations exactly once, for example 0 ≤ x < 5 and 5 ≤ x < 10.

Bar charts compare categories with separate bars. Histograms show a quantitative distribution using touching intervals. With unequal bin widths, use frequency density so that area, rather than height alone, represents frequency. Describe symmetry, tail direction, number of peaks and unusual values.

## Mean, median, mode and summation

x̄ = Σxᵢ / n; Σ(xᵢ − x̄) = 0

For the illustrative stays 2, 3, 3, 4, 8 days, the mean is 4, the median is 3 and the mode is 3. Order data before finding the median. For even n, average the two central numeric observations. Adding an unusually long stay pulls the mean upward more than the median.

The summation sign tells you what to add and which indices to use. Σxᵢ² and (Σxᵢ)² are different: with 2 and 3 they give 13 and 25. For an ordinal scale, report a median category or the two central categories; do not average arbitrary category codes.

## Spread, percentiles and the two variance denominators

vₙ = Σ(xᵢ − x̄)² / n; s² = Σ(xᵢ − x̄)² / (n − 1); SD = √variance

The course uses denominator n for descriptive variance and denominator n−1 for the adjusted variance used to estimate population variance. These answer different questions. In Excel, VAR.P and STDEV.P use n; VAR.S and STDEV.S use n−1. Variance has squared units; SD has the original units.

| Measure | Definition | Main limitation |
| --- | --- | --- |
| Range | Maximum − minimum | Depends on extremes |
| IQR | Q3 − Q1 | Describes the middle half |
| Coefficient of variation | 100 × SD / mean | Useful on positive ratio scales; unstable near zero |


The slide percentile rule uses r = np: if r is an integer, average the rth and (r+1)th ordered values; otherwise take position ceil(r). Excel QUARTILE.INC interpolates using position 1+(n−1)p. The methods can legitimately differ. Always name the convention. Adding c to every value changes the mean by c but leaves variance unchanged. Multiplying by c multiplies variance by c² and SD by |c|.

## Read a box plot and recognise skewness

Lower fence = Q1 − 1.5 IQR; upper fence = Q3 + 1.5 IQR

The box runs from Q1 to Q3, with a line at the median. Whiskers end at the most extreme observed values inside the fences; they do not necessarily end at the fences themselves. Points beyond a fence are flagged for investigation, not automatically deleted.

Right skew means a long right tail; the mean often exceeds the median. Left skew often reverses this order. These are useful tendencies, not universal rules. Two samples can share a mean and SD while having very different shapes.

## Covariance, correlation and interpretation

Covₙ(x,y) = Σ(xᵢ−x̄)(yᵢ−ȳ)/n; r = Covₙ(x,y)/(SDₙ(x) SDₙ(y))

Use a scatterplot for two quantitative variables. Positive association means higher x tends to accompany higher y; negative association goes in opposite directions. Covariance depends on units. Correlation standardises this linear association to a value between −1 and 1. Keep the same denominator convention in the covariance and SDs.

A correlation near zero does not rule out a nonlinear relationship. A strong correlation does not prove causation. In the hospital data, antibiotic recipients have longer observed stays, but illness severity and treatment selection can explain part of that association.

Explain it in an exam Identify the variable and units, give a measure of centre and spread, describe skewness/outliers, then state the conclusion for the observed sample. Add a population claim only when the sampling design and inferential method support it.

## Sources

Topic 1, slides 1–79; Exercise Book 2026/27, exercises 1–12.

[Official course materials](https://virtuale.unibo.it/course/view.php?id=83042).
