---
topic: statistics.risk-uncertainty
author: EU-HEM study notes
updated: 2026-10-06
---
## 5-minute review
- Risk is uncertainty described by probabilities; Knightian uncertainty is not quantified in that way.
- A probabilistic model starts with a probability law; statistical inference learns about a population from observations.
- A population is the target group; a sample is its observed subset; a census observes the whole group.
- An experiment produces one outcome in a collectively exhaustive sample space.
- An event is a collection of outcomes. Elementary outcomes are mutually exclusive.
- Probabilities are non-negative, P(S) = 1, and disjoint-event probabilities add.
- For equally likely outcomes, P(A) = number of outcomes in A / number in S.
- P(A ∪ B) = P(A) + P(B) − P(A ∩ B); independence is a different idea from mutual exclusivity.

## Class 1: Fundamental concepts I: risk, samples and probability

[Open the interactive lecture](lecture.html?topic=statistics.risk-uncertainty) for the full guide, topic-specific activities and 20 MCQs with explained answers. Progress stays in this browser and is included in the Notes backup.

### Why probability belongs in healthcare.

Disease, treatment outcomes and resource needs are uncertain. A model makes our assumptions explicit.

Risk and uncertainty  In the distinction used in this course, risk is measurable uncertainty: we can attach probabilities to possible outcomes. Knightian uncertainty describes situations where those probabilities are not quantified.  A forecast of a 20% chance of an adverse outcome describes risk. Saying that the possible consequences of a new technology are poorly understood describes uncertainty. A number is useful only when its underlying assumptions are credible.

Probability and statistics  A probabilistic model uses a specified probability law to work out what outcomes to expect. A statistical model uses observed data to learn about an unknown population characteristic.  If a test’s properties and disease prevalence are known, probability helps predict results. If they are unknown, we collect data and estimate them. Statistical methods also describe, predict and support decisions; they do not remove uncertainty.

### Who are you trying to understand?

Define the target group before choosing whom to measure.

Population  The complete group relevant to the study question.    For a study of an outpatient clinic, the population might be all eligible adults attending that clinic during a defined year. It is not automatically all adults in Italy.

Sample and census  A sample observes a subset; a census observes all members of the target population.    Interviewing 120 of the clinic’s 2,000 eligible patients gives a sample. Interviewing all 2,000 is a census. Sample size alone does not tell you whether selection is representative.

### An experiment is a set of possibilities.

In probability theory, “experiment” includes a random draw or a die throw. It need not be a clinical intervention.

Outcome, sample space, event  One run produces an outcome. The sample space S contains every possible outcome. An event A is a subset of S.  S = {1, 2, 3, 4, 5, 6}; A = {2, 4, 6}  For one die throw, the outcome might be 4. “An even result” is an event containing three outcomes. The event S always occurs; the empty event never occurs.

Exclusive and exhaustive  Distinct elementary outcomes cannot occur together in one run. A complete sample space also guarantees that at least one listed outcome occurs.  For a single coin toss, heads and tails are mutually exclusive and collectively exhaustive. “Heads” and “a coin result” overlap, because every head is also a coin result.

### Three rules keep probabilities coherent.

Use the equally likely counting rule only when the model justifies equal probabilities.

The axioms  A probability is never negative; the whole sample space has probability one; probabilities of disjoint events add.  P(A) ≥ 0; P(S) = 1  These rules imply P(A) ≤ 1 and P(not A) = 1 − P(A). A probability of 1.2 is a signal that the model or calculation has gone wrong.

The discrete uniform law  With N equally likely elementary outcomes, count how many belong to the event.  P(A) = |A| / N  For a fair die, an even result has probability 3/6 = 1/2. A weighted die still has six faces, but counting faces alone no longer gives the probability.

### “Or” includes overlap. “And” keeps it.

Build your own two events in Explore and watch the selected outcomes change.

Union and intersection  A ∪ B means A or B or both. A ∩ B means both events happen.  P(A ∪ B) = P(A) + P(B) − P(A ∩ B)  For A = even and B = at least 3, their overlap is {4, 6}. The union is {2, 3, 4, 5, 6}, so its probability is 5/6. Adding 3/6 + 4/6 without subtracting 2/6 counts the overlap twice.

Long-run interpretation  Under a frequentist interpretation, a probability describes a limiting relative frequency over repeated runs under the same conditions.  Probability 1/2 does not promise exactly five even results in the next ten throws. Short sequences can vary substantially. The repeated-run interpretation becomes central to sampling distributions and inference later.

### Counting samples from a tiny population.

Sampling without replacement and ignoring order produces combinations.

Choose people, not sequences  There are 10 different two-person samples from five people, and five four-person samples. Reversing the order of two selected people does not create a new sample.  N choose n = N! / [n!(N − n)!]  For a simple random sample, each of these combinations has the same selection probability. Selecting everybody creates one possible sample: the census.

Check the event before dividing  In a five-person population with one female and four males, a four-person sample can contain only males in exactly one of its five possible combinations.  P(only males) = 1/5  A four-person sample containing only females is impossible in this population. Its probability is zero. Sampling error, independence and replacement will be developed in the next classes.

## Official materials

Original explanations for study, not official assessment questions or clinical guidance. Consult [Virtuale](https://virtuale.unibo.it/course/view.php?id=84235) for the lecture slides, assessed-work questions and official answers.
