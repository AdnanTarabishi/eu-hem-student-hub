---
topic: statistics.probability
author: EU-HEM study notes
updated: 2026-10-06
---
## 5-minute review
- P(A | B) = P(A ∩ B) / P(B), provided P(B) > 0.
- Joint probability is symmetric; conditional probability generally is not.
- Independence means P(A ∩ B) = P(A)P(B); positive-probability mutually exclusive events are dependent.
- Sensitivity is P(T+ | D+), specificity is P(T− | D−), and positive predictive value is P(D+ | T+).
- Nominal categories have no natural order; ordinal categories do. Interval and ratio scales differ by a meaningful zero.
- A discrete PMF assigns a non-negative probability to each value and those probabilities sum to one.
- E[X] = Σx p(x); Var(X) = Σ(x − μ)² p(x); SD = √Var(X).
- For Binomial(n,p), independent trials share the same success probability: mean np and variance np(1−p).

## Class 2: Fundamental concepts II: conditional probability and discrete variables

[Open the interactive lecture](lecture.html?topic=statistics.probability) for the full guide, topic-specific activities and 20 MCQs with explained answers. Progress stays in this browser and is included in the Notes backup.

### Conditioning changes the denominator.

The event after the vertical bar defines the world in which you are counting.

Conditional probability  To ask for A given B, retain the outcomes in B and find the share that also belong to A.  P(A | B) = P(A ∩ B) / P(B)  For a fair die, let A = even and B = at least 3. There are four outcomes in B and two are even, so P(A | B) = 2/4. In the opposite direction P(B | A) = 2/3. Conditioning on an event of probability zero is not defined by this formula.

Joint and marginal probabilities  A table’s internal cells give joint probabilities. Its row and column totals give marginal probabilities.  P(A ∩ B) = P(A | B)P(B)  The same joint event can be described in either order: A ∩ B = B ∩ A. That symmetry does not extend to conditional probabilities because their denominators are different.

### Independent is different from exclusive.

Knowing one event occurred may change, or leave unchanged, the probability of another.

Independent events  Occurrence of one leaves the probability of the other unchanged.    Two independent tosses of a fair coin give P(second heads | first heads) = 1/2 and P(both heads) = 1/4. The events can happen together.

Sampling with replacement  Returning an item before the next random draw can preserve the original distribution.    With five red and five white balls, P(second red | first red) is 1/2 with replacement, but 4/9 without replacement. In the latter case P(both red) = (5/10)(4/9), not 1/4.

### A positive result asks a reversed question.

The diagnostic explorer uses a hypothetical test, not clinical advice.

Sensitivity and specificity  Sensitivity conditions on having disease. Specificity conditions on not having disease.  Sensitivity = P(T+ | D+); specificity = P(T− | D−)  Their complements are the false-negative rate among diseased people and the false-positive rate among non-diseased people. They do not directly answer the probability of disease among people testing positive.

Positive predictive value  Use prevalence and both test characteristics to construct the joint table, then condition on the positive row.  PPV = sensitivity × prevalence / P(T+)  At prevalence 20%, sensitivity 75% and specificity 90%, the joint true-positive probability is 0.15 and false-positive probability is 0.08. P(T+) = 0.23, so PPV = 0.15/0.23 ≈ 65.2%. Lower prevalence can reduce PPV even when sensitivity and specificity stay the same.

### Choose a scale before a summary.

Numeric category labels do not turn a qualitative variable into a meaningful measured quantity.

Qualitative variables  Nominal categories have no natural order, such as blood groups. Ordinal categories have an order, such as mild, moderate and severe disease.  A binary indicator coded 0/1 is a special categorical variable: its sum counts the units coded 1, and its mean is their proportion. The numeric gaps between ordinal category codes are not necessarily equal.

Quantitative variables  A discrete variable has countably many possible values; a continuous variable can take any value over an interval. Ratio scales have a meaningful zero; interval scales do not.  Number of visits is a discrete count and has a ratio scale. Weight is continuous with a ratio scale. Celsius temperature has an interval scale: 30°C is not twice as hot as 15°C. Recording a continuous quantity to one decimal place does not change its underlying nature.

### A random variable assigns numbers to outcomes.

Uppercase X describes the random quantity; lowercase x is a realised value.

Probability mass function  For a discrete variable, p(x) = P(X = x). Every mass is non-negative and all masses sum to one.  E[X] = Σx p(x)  A fair die has six masses of 1/6. Its expectation is 3.5, even though no throw can produce 3.5. Expectation is a long-run weighted average, not necessarily a possible outcome.

Location and dispersion  The median divides the distribution into halves; the mode is a value of greatest probability. Variance averages squared deviations from the expectation.  Var(X) = Σ(x − μ)²p(x); SD(X) = √Var(X)  For a fair die, Var(X) = 35/12 ≈ 2.917 and SD ≈ 1.708. Variance has squared units; SD has the variable’s original units. Discrete distributions can have non-unique medians or modes.

### One success or a count of successes.

The binomial model needs independent trials with a common success probability.

Bernoulli(p)  A Bernoulli variable is 1 for success and 0 for failure.  E[X] = p; Var(X) = p(1 − p)  “Success” is a coding label: it can mean an adverse event if that is what you encode as 1. A binary indicator’s variance is highest at p = 1/2.

Binomial(n,p)  Count successes in n independent Bernoulli trials, each with success probability p.  P(X = r) = C(n,r)pʳ(1 − p)ⁿ⁻ʳ  Mean = np and variance = np(1 − p). For three fair coin tosses, probabilities for 0, 1, 2, 3 heads are 1/8, 3/8, 3/8, 1/8. Use Explore to change n and p and inspect the entire PMF.

### Expected value can change a decision.

Include the option to wait, and say what waiting costs.

A simplified investment decision  Suppose an investment costs 100 units. Returns are 150 with probability 0.7 and 10 with probability 0.3.  Expected net return now = 0.7×150 + 0.3×10 − 100 = 8  If waiting reveals the state and does not change costs, probabilities or returns, invest only in the good state. Expected net return becomes 0.7×(150−100) = 35. The value of the flexibility is 27 units.

The assumptions do the work  This comparison is a model result, not a universal recommendation to postpone investment.  Waiting may lose sales, invite competition or change the return distribution. A sound answer explains both the expected values and the assumptions under which the comparison is valid.

## Official materials

Original explanations for study, not official assessment questions or clinical guidance. Consult [Virtuale](https://virtuale.unibo.it/course/view.php?id=84235) for the lecture slides, assessed-work questions and official answers.
