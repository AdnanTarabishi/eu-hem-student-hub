---
topic: statistics.descriptive
author: EU-HEM study notes
updated: 2026-10-06
---
## 5-minute review
- Random sampling selects study units; random allocation assigns treatments. They address different problems.
- RCTs use random allocation; observational designs include cohort, case-control and cross-sectional studies.
- A researcher-controlled before–after intervention can be experimental without being randomised.
- Randomisation supports causal inference through balance in expectation; it does not guarantee identical observed groups.
- Start analysis by checking data quality, missing values and distributions.
- Summarise categorical data with counts and proportions; use histograms for quantitative data and scatterplots for pairs.
- Sample mean is Σx/n and sample variance is Σ(x−x̄)²/(n−1).
- State the sign convention for changes and compare treatment groups using common graph scales.

## Class 4: Study designs and descriptive statistics

[Open the interactive lecture](lecture.html?topic=statistics.descriptive) for the full guide, topic-specific activities and 20 MCQs with explained answers. Progress stays in this browser and is included in the Notes backup.

### Selection and treatment assignment are separate.

A representative sample and a valid causal comparison require different kinds of reasoning.

Random sampling  Random sampling chooses units from the target population. In simple random sampling, each possible sample of the stated size is equally likely.  This supports inference to the sampled population. Volunteers from one clinic are not automatically representative of every patient. A large sample can still be systematically selected.

Random allocation  Random allocation assigns recruited participants to treatment groups. It aims to make treatment assignment independent of their baseline characteristics.  It balances measured and unmeasured characteristics in expectation and supports causal comparison. Actual groups need not have identical age or sex distributions. A trial can use random allocation without using random sampling from the general population.

### Recognise how the data were obtained.

The study-design activity asks you to classify new scenarios and explains the clues.

Observational designs  A cohort follows a defined group over time. A case-control study selects people by disease status and examines previous exposure. A cross-sectional study measures a group at one time.  Researchers observe rather than randomise the exposure. These designs can be valuable when randomisation would be unethical or impractical. Confounding, recall error and reverse causation need careful treatment.

Before–after and randomised designs  A before–after study compares periods on either side of a change. If researchers actively introduce the change it can be experimental, but it is not an RCT unless allocation is randomised.  An unrelated time trend can explain a before–after difference. An RCT compares randomly allocated interventions, but loss to follow-up, crossover and difficulties with blinding can still compromise its analysis.

### A design determines what a difference means.

Association alone does not identify the effect of a treatment.

ProFHER  The real study compared surgical and non-surgical management of displaced proximal humeral fractures using random allocation.  Clinical outcomes included the Oxford Shoulder Score; economic evaluation considered costs and quality-adjusted life years. The course later uses a simulated teaching dataset. No patient-level clinical dataset has been supplied for this page.

Minor ailments  The before–after prescribing study introduced pharmacist access and observed GP consultations before and after the change, without random allocation.  School holidays and doctors’ availability could change at the same time as the intervention. A reduction in consultations may reflect the intervention, these other factors, or both. Regression and the detailed Stata analysis belong to later classes.

### Describe before you test.

Inspect values and missingness before interpreting a summary.

Categorical data  Frequency tables count categories. Relative frequency divides each count by the number of observed, eligible values. Bar charts display those counts or proportions.  Relative frequency = count / denominator  A 0/1 indicator’s average is the proportion coded 1. State how missing values were handled and whether the denominator is the whole sample or only observations with recorded data.

Quantitative data  Histograms group values into bins. Scatterplots display paired quantitative values and help identify patterns, outliers and data errors.  Frequency histograms show counts; relative-frequency histograms show shares; density histograms divide share by bin width so total area is one. With unequal bin widths, areas rather than raw heights must represent the shares.

### Location is more than one number.

The live summary activity lets you edit a small, explicitly synthetic sample.

Mean, median and mode  The arithmetic mean uses every value. The median is the middle sorted value, or the average of the two middle values. Modes are values with the highest frequency.  x̄ = Σxᵢ / n  For the lecture’s illustrative sample 1,1,3,3,3,4,7,9,10,12,12, mean ≈ 5.909, median = 4 and mode = 3. A very large additional observation can shift the mean sharply while moving the median much less.

Range, variance and SD  Range uses only the minimum and maximum. Sample variance averages squared deviations using n−1; SD is its square root.  s² = Σ(xᵢ−x̄)²/(n−1); s = √s²  Keep sample statistics x̄, s² and s distinct from population parameters μ, σ² and σ. Variance has squared units; SD and range have original units. A single observation does not define a sample variance.

### Make comparisons interpretable.

Shared axes and a clear change convention prevent misleading displays.

Compare groups on the same scales  When comparing treatment histograms, use common horizontal and vertical scales. Add numerical summaries so shape and average can be assessed together.  Two differently scaled plots can make similar groups look different. Baseline characteristics and distributions should be examined by treatment group, even when allocation was randomised.

Define the change  If change = after − before, a negative blood-pressure change means blood pressure decreased.  140 − 150 = −10 mm Hg  If you instead define reduction = before − after, the sign reverses. Descriptive differences do not by themselves establish statistical significance, clinical importance or causality.

## Official materials

Original explanations for study, not official assessment questions or clinical guidance. Consult [Virtuale](https://virtuale.unibo.it/course/view.php?id=84235) for the lecture slides, assessed-work questions and official answers.
