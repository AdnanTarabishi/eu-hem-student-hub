---
topic: fund-health-economics.insurance-demand
author: EU-HEM Student Hub
updated: 2026-10-20
---
## 5-minute review
- Health insurance transfers some income from the healthy state to the sick state and protects against unpredictable, potentially catastrophic medical expenditure.
- A risk-averse person prefers certain income to a risky income with the same expected value because utility is increasing and concave: $U'(y)>0$ and $U''(y)<0$.
- Expected income and expected utility are different objects: $E[Y]=\sum p_i y_i$, while $E[U(Y)]=\sum p_iU(y_i)$.
- The certainty equivalent $y^*$ gives the certain income with the same utility as the risky prospect; the risk premium is $E[Y]-y^*$.
- Borrowing and precautionary saving can help with medical shocks, but pooling spreads expected expenditure across many enrollees.
- In the benchmark indemnity contract, sickness occurs with probability $p$, the medical loss is $M$, coverage is $I$, and the premium is $\pi$.
- A fair premium satisfies $\pi=pI$; under full and fair insurance, $I=M$ and income is equal in the healthy and sick states.
- The risk-averse consumer offered fair insurance chooses full coverage because the optimum equalises marginal utility across states.
- From the insurer's perspective, expected profit is $E[\Pi]=\pi-pI$; fair insurance gives zero expected profit, while $\pi>pI$ is called unfair in the model.
- Full versus partial is determined by indemnity size; fair versus unfair is determined by premium size. These are separate dimensions.

## Notes

### 1. Why insurance is central to the health economy

Session 6 asks why people insure against health shocks and how a simple insurance market works.

The lecture begins from the institutional fact that healthcare is often financed through public or private insurance rather than entirely through direct payment at the point of use. Countries combine institutions differently, but insurers or public payers commonly collect resources in advance, pool risks and purchase care.

The lecture's cross-country charts are historical course illustrations. Their qualitative message is that, as national income rises, direct out-of-pocket financing tends to become less dominant while public or private insurance becomes more important. The slides also use historical coverage examples to show that universal basic coverage can coexist with voluntary supplementary insurance.

### 2. The basic reason to insure

The value of health insurance is rooted in two features of medical expenditure:

- it is uncertain;
- when illness occurs, the financial loss can be large.

Insurance in this session covers the **financial risk associated with medical care**. It does not eliminate illness itself. The individual gives up some income in the healthy state by paying a premium and receives a payment in the sick state if the covered contingency occurs.

The value of this protection depends on both:

- the probability of illness;
- the size of the potential loss.

### 3. Three ways to face medical-expenditure risk

The lecture compares three broad responses.

#### Borrow after becoming sick

The person could borrow to pay for treatment and repay later. The difficulty is that borrowing may be particularly hard when the person is already ill or financially weakened.

#### Save in advance

The person could build precautionary savings. But if everyone saves enough to cover a rare catastrophic cost, many people substantially reduce current consumption for an expense that only a minority will actually incur.

#### Pool risk through insurance

A large group contributes premiums. The expected expenditure of those who become sick is shared across the pool. Each member's annual consumption falls by the premium rather than by the full possible medical loss.

### 4. Risk aversion

**Risk aversion** is the preference for certain income over risky income with the same expected value.

The lecture represents risk aversion using utility from income:

$$
U'(y)>0, \qquad U''(y)<0.
$$

The first condition means more income gives more utility. The second means marginal utility declines as income rises.

A one-euro loss from a relatively low income therefore reduces utility by more than a one-euro gain at a relatively high income increases it. This is why a risk-averse individual rejects a non-degenerate actuarially fair gamble that adds risk to an initially certain position.

### 5. Expected value and actuarial fairness

For outcomes $y_1,\ldots,y_n$ with probabilities $p_1,\ldots,p_n$:

$$
E[Y]=\sum_i p_i y_i.
$$

A gamble is actuarially fair when its price equals its expected monetary value.

This concept is monetary. It does not imply that the gamble provides the same utility as certainty to a risk-averse person.

### 6. Expected utility

Expected utility weights the utility of each possible outcome by its probability:

$$
E[U(Y)]=\sum_i p_iU(y_i).
$$

With a healthy-state income $y_h$, a sick-state income $y_s$, and sickness probability $p$:

$$
E[U(Y)]=(1-p)U(y_h)+pU(y_s).
$$

Because the utility function is concave, the utility of expected income exceeds expected utility for a non-degenerate risk:

$$
U(E[Y])>E[U(Y)].
$$

This gap creates willingness to pay for risk reduction.

### 7. Certainty equivalent and risk premium

The **certainty equivalent** $y^*$ is defined by:

$$
U(y^*)=E[U(Y)].
$$

It is the certain income that makes the individual just as well off as the risky prospect.

The **risk premium** is:

$$
E[Y]-y^*.
$$

It measures how much expected income the person would be willing to give up, at most, to remove the risk while remaining at the same utility level.

Do not confuse this risk premium with the insurance premium $\pi$. The insurance premium is the price of the contract; the risk premium is a utility-based measure of willingness to pay for certainty above the expected loss.

### 8. Why fair insurance is not the same as a fair gamble

A fair gamble adds dispersion to an initially certain income. A risk-averse person dislikes that added risk.

Fair insurance does the opposite. It takes an already risky income — high if healthy and low if sick — and moves income toward equality across states.

Thus a risk-averse person can reject a fair gamble and still prefer fair insurance. The direction of the risk change is different.

### 9. The benchmark indemnity contract

The lecture uses a deliberately simple contract:

- income before medical spending: $y$;
- probability of sickness: $p$;
- medical loss or treatment cost: $M$;
- indemnity paid if sick: $I$;
- premium paid in advance: $\pi$.

The model assumes one disease, one treatment and a fixed loss. It also abstracts from behavioural responses after signing the contract. Those simplifying assumptions allow the session to isolate insurance demand.

Income after buying the contract is:

$$
y_h=y-\pi
$$

when healthy, and

$$
y_s=y-\pi-M+I
$$

when sick.

### 10. The pool and the fair premium

Suppose there are $N$ identical enrollees. A fraction $p$ is expected to become sick.

Total premium revenue is:

$$
N\pi.
$$

Expected total indemnity payments are:

$$
pNI.
$$

A premium that exactly covers expected payments satisfies:

$$
N\pi=pNI
\quad\Rightarrow\quad
\pi=pI.
$$

This is the **actuarially fair premium** in the benchmark model.

The law-of-large-numbers intuition is that, in a large pool of independent similar risks, the share becoming sick is increasingly predictable even though no individual knows with certainty whether they will become sick.

### 11. Demand for a fair indemnity

Under fair pricing, $\pi=pI$. The state incomes become:

$$
y_h=y-pI,
$$

$$
y_s=y-M+(1-p)I.
$$

The individual chooses $I$ to maximise:

$$
EU(I)=pU\big(y-M+(1-p)I\big)+(1-p)U(y-pI).
$$

The first-order condition simplifies to equality of marginal utility across states:

$$
U'(y_s)=U'(y_h).
$$

With a strictly concave utility function, equal marginal utility requires equal income:

$$
y_s=y_h.
$$

Substituting the two state-income expressions gives:

$$
I^*=M.
$$

Therefore, in this benchmark, a risk-averse person offered actuarially fair insurance chooses **full insurance**.

### 12. Full insurance and state independence

Full insurance means the indemnity exactly covers the medical loss:

$$
I=M.
$$

Then income no longer depends on whether the person is healthy or sick:

$$
y_h=y_s=y-pM.
$$

The lecture calls this **state independence** or secured income across health states.

Partial insurance leaves some income difference between states:

$$
I<M
\quad\Rightarrow\quad
y_s<y_h.
$$

The person remains exposed to some financial risk.

### 13. Supply of indemnity contracts

From the insurer's perspective:

- the premium $\pi$ is collected in either state;
- the indemnity $I$ is paid only with probability $p$.

Expected profit is:

$$
E[\Pi]=(1-p)\pi+p(\pi-I)=\pi-pI.
$$

Under the lecture's competitive benchmark, expected profit is zero:

$$
E[\Pi]=0
\quad\Rightarrow\quad
\pi=pI.
$$

Thus the insurer's zero-profit condition gives the same fair-premium formula as the pooling argument.

### 14. Fair versus unfair

A contract is **fair** when:

$$
\pi=pI.
$$

A contract is called **unfair** in the lecture's technical model when it gives positive expected profit:

$$
\pi>pI.
$$

A contract with:

$$
\pi<pI
$$

has negative expected profit and would not be offered by a profit-seeking insurer in the benchmark.

The word *unfair* here is a technical label tied to expected payout. It should not be read as a complete ethical judgement about real-world administrative costs, capital requirements or other expenses that the simplified model omits.

### 15. Fairness and fullness are separate dimensions

The lecture insists on a distinction that is easy to miss:

- **full versus partial** is determined by the size of $I$;
- **fair versus unfair** is determined by the size of $\pi$ relative to $pI$.

| Contract | Premium condition | Coverage condition |
|---|---:|---:|
| Fair and full | $\pi=pI$ | $I=M$ |
| Fair and partial | $\pi=pI$ | $I<M$ |
| Unfair and full | $\pi>pI$ | $I=M$ |
| Unfair and partial | $\pi>pI$ | $I<M$ |

For fair contracts, the lecture ranks full insurance above partial insurance, and partial insurance above no insurance for the risk-averse individual.

### 16. Comparing non-ideal contracts

When one contract is fuller but more expensive and another is fairer but more partial, there is no universal ranking based only on the labels.

A full but sufficiently overpriced contract can be less attractive than a fair partial contract. Conversely, a relatively modest premium loading can be outweighed by the value of more complete risk protection.

The ranking depends on:

- the premium;
- the indemnity;
- the probability and magnitude of loss;
- the individual's degree of risk aversion.

The interactive contract comparator on the lecture page illustrates this point using an explicit teaching utility function. That numerical utility function is an EU-HEM Hub illustration, not an additional assumption stated in the slides.

### 17. Comparative-statics questions

The lecture lists several changes the model can study:

- the magnitude of the loss;
- the shape of the utility function;
- the degree of risk aversion;
- the probability of loss.

The available slides identify these comparative-static dimensions but do not provide a complete derivation of every directional result. The Student Hub therefore uses them as study questions rather than silently adding unsupported conclusions.

### 18. What the benchmark leaves out

The result that full and fair insurance is ideal is conditional on the model's assumptions. The session abstracts from, among other things:

- hidden differences in risk types;
- moral hazard after insurance is purchased;
- multiple treatments and variable expenditure;
- administrative and capital costs;
- market power and contract complexity.

Session 7 relaxes the symmetric-information assumption and studies adverse selection. Session 8 later studies moral hazard.

> **Student note:** This is an original EU-HEM Hub explanation of Session 6. It follows the terminology and sequence of the official lecture without reproducing its slides, charts or textbook materials. Use Virtuale for the official course material.
