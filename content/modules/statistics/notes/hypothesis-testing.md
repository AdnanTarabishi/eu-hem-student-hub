---
topic: statistics.inference
author: EU-HEM study notes
updated: 2026-10-06
---
## 5-minute review
- Hypotheses refer to population parameters, not observed sample means.
- For a two-sided one-mean test use H₀: μ=μ₀ and H₁: μ≠μ₀.
- Choose the significance level before examining the evidence.
- With known population SD, z=(x̄−μ₀)/(σ/√n). With unknown SD, t=(x̄−μ₀)/(s/√n) and df=n−1.
- The exact small-sample t procedure assumes independent normal observations; large-sample use is approximate.
- The p-value measures how extreme the observed evidence is under H₀; it is not P(H₀ is true).
- A matching two-sided test and confidence interval give the same conclusion.
- Do not reject is not proof of no effect. Type I error rejects a true H₀; Type II error does not reject a false H₀.
- Statistical significance does not establish clinical importance or causality.

## Class 6: Hypothesis testing: one population mean

[Open the interactive lecture](lecture.html?topic=statistics.inference) for the full guide, topic-specific activities and 20 MCQs with explained answers. Progress stays in this browser and is included in the Notes backup.

### Put the hypothesis in the population.

Data are observed in a sample; the claim concerns the population from which it was drawn.

Null and alternative  For a two-sided one-mean comparison, H₀ states a chosen population mean and H₁ allows differences in either direction.  H₀: μ = μ₀; H₁: μ ≠ μ₀  For example, μ₀ = 7 is a fixed reference value. The observed sample mean x̄ is evidence used to test that claim, not the quantity appearing in the null hypothesis.

Significance level  Choose α before examining the results. The course commonly uses α = 0.05, placing 0.025 in each tail of a two-sided reference distribution.  A smaller α requires more extreme evidence for rejection. “Do not reject” means insufficient evidence against the null under the method and assumptions; it does not prove equivalence or no effect.

### Measure distance in standard errors.

A difference of two units means something different when uncertainty is large rather than small.

Known population SD  If σ is genuinely known and the sample mean has a normal or approximately normal distribution, use a standard normal reference.  z = (x̄ − μ₀) / (σ/√n)  For independent normal observations the normal reference is exact. Otherwise normal approximation depends on sample size and population shape. The course’s n ≥ 30 convention is a rule of thumb, not a guarantee.

Unknown population SD  Usually σ is unknown. Estimate it with s and account for the additional uncertainty with Student’s t distribution.  t = (x̄ − μ₀) / (s/√n); df = n − 1  For independent observations from a normal population this one-sample t test is exact, including at small n. At large n the approximation is often useful. Small, markedly non-normal samples need methods outside this page.

### Student’s t has heavier tails.

Degrees of freedom distinguish one t reference distribution from another.

Why the reference changes  Estimating the population spread makes the denominator uncertain. Student’s t allows more probability in the tails than the standard normal distribution.  The smaller the degrees of freedom, the larger the 95% two-sided critical value. As df grows, t approaches the standard normal. Replacing σ with s while keeping a z critical value can understate uncertainty in a small sample.

Critical values  Reject when the absolute test statistic exceeds the matching two-sided critical value.  For df = 19 and α = 0.05: critical t ≈ 2.093  The lab implements the lecture’s convention: reject for p < α, do not reject for p > α, and describe exact equality as the boundary. Rounded printed values should not decide a borderline case.

### A p-value is conditional on the null.

It is a probability about possible sample evidence, under an assumed hypothesis.

The question it answers  How often would evidence at least this extreme arise if H₀ and the model assumptions held?    For a two-sided test, include both tails beyond ±|t observed| (or ±|z observed|). A p-value of 0.02 means such extreme evidence would occur with probability 0.02 under the null model.

The question it does not answer  It does not assign a probability that H₀ is true, that H₁ is true, or that an effect is clinically important.    A large p-value can occur when a real effect is small relative to uncertainty. A small p-value can occur for a clinically unimportant difference in a very precise study.

### Three routes to the same conclusion.

Use the same assumptions, reference distribution and significance level for all three routes.

The worked one-mean example  A normal population yields an independent sample with n=20, x̄=5 and s=3. Test H₀: μ=7 against μ≠7 at 5%.  SE ≈ 0.671; t ≈ −2.981; df = 19  The critical value is 2.093. The two-sided p-value is approximately 0.0077. The 95% t interval is approximately [3.596, 6.404], excluding 7. All three approaches reject; the estimated mean lies below the null value.

The matching confidence interval  A two-sided α-level t test corresponds to a 100(1−α)% t confidence interval.  x̄ ± t(df, 1−α/2) × s/√n  A null value outside the interval is rejected by the matching test. Repeatedly constructed intervals have the stated coverage; a particular interval either contains the fixed parameter or does not. The lab displays the statistic, p-value and interval side by side.

### Errors describe the decision and the truth.

These are repeated-testing properties, not retrospective probabilities that your particular conclusion is wrong.

Type I error  Rejecting H₀ when it is true. Under the test assumptions, the chosen significance level controls its probability.  P(Type I error | H₀ true) = α  This is analogous to concluding a treatment difference exists when the null of no difference is true. It is not the probability that a rejected hypothesis was actually true.

Type II error  Not rejecting H₀ when it is false. Its probability β depends on a specified alternative effect, the spread and the sample size.  Power = 1 − β  Power is supplementary terminology supporting the lecture’s Type II error discussion. Reducing α with everything else fixed generally makes rejection harder and can increase Type II error.

### Report enough to judge the result.

A binary decision leaves out the size and uncertainty of the estimated effect.

A clear interpretation  Report the estimate, sample size, SD, test statistic, degrees of freedom where relevant, exact p-value and confidence interval.  For the worked example: “The sample mean was 5 (n=20, SD=3). A two-sided one-sample t test against 7 gave t(19)=−2.981, p≈0.0077; the 95% CI was 3.596–6.404. The data support a population mean below 7 under the assumptions.”

Know the current boundary  Statistical significance does not automatically imply a clinically meaningful difference or a causal effect.  Two independent means and the full analysis of the ProFHER trial are extended in Class 7. Regression and tests for proportions belong to later classes. The upcoming links let you reach the official materials without presenting those classes as completed.

## Official materials

Original explanations for study, not official assessment questions or clinical guidance. Consult [Virtuale](https://virtuale.unibo.it/course/view.php?id=84235) for the lecture slides, assessed-work questions and official answers.
