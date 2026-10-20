---
topic: fund-health-economics.adverse-selection
updated: 2026-10-20
---

# Session 7 — Insurance II: adverse selection, social insurance and premium risk

## Learning goals

After this session, you should be able to:

- distinguish random from systematic variation in healthcare expenditure;
- explain why hidden risk type creates adverse selection;
- move between a contract `(π,I)` and the corresponding point in `yH–yS` space;
- derive and interpret a zero-profit line;
- define pooling and separating equilibria in the Rothschild–Stiglitz model;
- explain why first-best and pooling contracts do not survive hidden information and competition;
- explain why low risks receive only partial insurance in a separating equilibrium;
- show how population composition can lead to non-existence of equilibrium;
- explain the welfare rationale for compulsory pooling and supplementary insurance;
- distinguish medical-expenditure risk from premium risk.

## 1. Why social insurance?

The lecture frames social insurance as transfers linked to events such as illness, disability, unemployment and ageing. The central policy trade-off is:

- **benefit:** reduce risk and fluctuations in consumption;
- **distortion:** change incentives and potentially create inefficient behaviour and deadweight loss.

Because correcting one problem can create another, policy is generally a **second-best** exercise.

## 2. Random and systematic variation

The **random residual component** of medical expenditure creates the basic demand for insurance. People do not know whether they will incur a large medical loss, so they value risk pooling.

The **systematic predictable component** affects the operation of insurance markets. Expected spending varies with characteristics such as age and health status. Predictability creates pricing, affordability and redistribution questions.

Two limiting cases clarify the distinction:

1. If variation were fully random, uniform premiums and competitive markets could function relatively well.
2. If each person's expenditure were perfectly predictable, insurance would no longer create the usual utility gain from risk reduction. The main issue would become prepayment and redistribution.

## 3. Two hidden risk types

Let:

- `L` = low-risk or robust type;
- `H` = high-risk or frail type;
- `pL < pH` = their probabilities of sickness;
- `λ` = the fraction of low risks in the population;
- `I` = indemnity;
- `π` = premium.

If type were observable, type-specific fair premiums would be:

`πL = pL I`

`πH = pH I`

If insurers cannot observe type and charge one average premium, the mixed-pool break-even premium is:

`πP = [λpL + (1−λ)pH]I`

This premium is above the low-risk type's own expected payout and below the high-risk type's own expected payout. Pooling therefore redistributes from `L` to `H`.

## 4. Adverse selection

When consumers know more about expected losses than insurers, generous plans disproportionately attract high risks. A full plan can therefore have a higher premium for two reasons:

1. it pays a larger indemnity;
2. it attracts a worse risk mix.

The second effect is adverse selection.

## 5. Contract space

Before insurance, the consumer's endowment point is:

`E = (yH, yS) = (y, y−M)`

A contract `(π,I)` produces:

`yH = y−π`

`yS = y−π−M+I`

Relative to the endowment point:

- the horizontal move left is the premium `π`;
- the vertical move up is the net sick-state payout `I−π`.

The 45-degree line satisfies `yS=yH` and represents full insurance.

## 6. Indifference curves

Indifference curves in `yH–yS` space are:

- downward sloping;
- convex because of risk aversion;
- flatter for the high-risk type at a common point.

The high-risk type reaches the sick state more often, so it values sick-state income more relative to healthy-state income. This creates the single-crossing pattern needed for self-selection.

## 7. Zero-profit line

For a type with sickness probability `p`, the insurer breaks even when:

`p(I−π) = (1−p)π`

In contract-space coordinates:

`yS = y−M + [(1−p)/p](y−yH)`

The slope is:

`−(1−p)/p`

A higher `p` creates a flatter zero-profit line. The mixed-pool zero-profit line lies between the low-risk and high-risk lines.

In the lecture's diagram orientation:

- points below the line generate expected profit;
- points on the line break even;
- points above the line generate expected loss.

## 8. Rothschild–Stiglitz environment

The model uses:

- two risk types;
- private information about type;
- a static setting;
- no moral hazard;
- perfect competition;
- zero expected profit for insurers;
- exactly one contract purchased by each individual.

An equilibrium is a set of contracts such that:

1. each consumer chooses the preferred available contract;
2. all insurers earn zero expected profit.

Two candidate forms are:

- **pooling:** both types choose the same contract;
- **separating:** each type chooses a different contract.

## 9. Why the symmetric-information first best fails

Under complete information, each type would buy fair full insurance at its own actuarial premium. With hidden type, the high-risk consumer would choose the cheaper low-risk full-insurance contract. Once high risks enter, the contract priced at `pL` loses money.

The first-best pair is therefore not incentive compatible.

## 10. Candidate pooling and redistribution

For a pooling contract `Z(πZ,IZ)`:

`πZ = [λpL + (1−λ)pH]IZ`

The low-risk contribution above own expected cost is:

`πZ − pL IZ = (pH−pL)(1−λ)IZ > 0`

The high-risk contribution above own expected cost is:

`πZ − pH IZ = −(pH−pL)λIZ < 0`

Pooling breaks even overall but transfers resources from low risks to high risks.

## 11. Why pooling does not survive competition

The pooling contract overcharges low risks relative to their own expected cost. Because low- and high-risk preferences cross only once, an entrant can offer a contract that:

- low risks prefer to the pooling contract;
- high risks do not choose;
- earns positive profit on the selected low-risk group.

This cream-skimming deviation breaks the pool. The standard model therefore has no competitive pooling equilibrium.

## 12. Separating equilibrium

A separating menu contains:

- `CH`: fair full insurance for the high-risk type;
- `C′L`: fair partial insurance for the low-risk type.

The low-risk contract must remain sufficiently far from full insurance that the high-risk type does not imitate it. This is an incentive-compatibility restriction.

Low risks are therefore **quantity constrained** or **rationed**: they receive less insurance than they want, even though they would pay their own fair premium for full coverage.

## 13. Equilibrium existence and λ

When the fraction of low risks is not too large, the separating menu may be stable.

As `λ` rises:

- more people bear the welfare loss from partial insurance;
- a pooling deviation can become more attractive and profitable;
- the separating equilibrium may be destabilised.

For sufficiently large `λ`, the market may fail to reach any equilibrium.

## 14. Compulsory pooling and government intervention

A government can impose a basic pooling contract `G(πG,IG)` that breaks even for the whole population:

`πG = [λpL + (1−λ)pH]IG`

The policy creates a transfer from `L` to `H`. In the model, a suitably chosen compulsory base can also reduce the distortion needed for separation:

- high risks benefit from cross-subsidisation;
- low risks can obtain more complete total coverage once supplementary contracts are allowed.

A policy menu may therefore combine:

- compulsory basic insurance;
- supplementary private insurance.

An equivalent partial-coverage intervention can use a tax on partial coverage and a subsidy to fuller coverage.

The model does **not** imply that every mandate is automatically welfare improving. The mandatory contract must be appropriately designed.

## 15. Premium risk

Annual health insurance covers current medical-expenditure risk, but it does not automatically cover the risk of becoming predictably expensive in the future.

**Premium risk** is the risk that new information moves a person into a higher expected-cost class and raises future actuarial premiums.

The lecture discusses three theoretical market responses:

### Lifetime insurance contract

Consumers make a binding long-run commitment before risk type is revealed. This preserves pooling but can be difficult to enforce and limits switching and competition.

### Guaranteed renewable contract

Premiums are front-loaded so that robust and frail consumers voluntarily remain. The design still limits switching and competitive pressure.

### Cochrane-style premium insurance

The insurer also protects against future premium increases. A deterioration in health status triggers a payment that helps finance higher premiums in future contracts.

## 16. Core conclusions

The Rothschild–Stiglitz model produces three main predictions:

1. competition drives out pooling equilibria;
2. separating equilibria ration robust low-risk consumers and make insurance expensive for frail high-risk consumers;
3. the market may fail to reach an equilibrium.

Compulsory partial pooling can improve efficiency and welfare by moving low risks closer to full coverage and moderately subsidising high risks. Long-run cross-subsidies are central to making coverage affordable after people become high risk.


## 5-minute review

- Random expenditure variation creates the core value of insurance; systematic variation drives pricing and selection problems.
- With hidden risk, generous coverage attracts a higher-risk mix and can become expensive through adverse selection.
- The mixed-pool break-even premium is `πP = [λpL + (1−λ)pH]I`.
- In `yH–yS` space, full insurance lies on the 45-degree line and a type-p zero-profit line has slope `−(1−p)/p`.
- First-best type-specific full insurance is not incentive compatible because high risks imitate the low-risk contract.
- Competitive cream-skimming destroys pooling equilibria in the standard Rothschild–Stiglitz argument.
- A separating equilibrium gives H fair full insurance and L fair partial insurance, so low risks are quantity constrained.
- When low risks are a large majority, the competitive market may have no equilibrium.
- A suitable compulsory pooling base plus supplementary insurance can improve welfare by subsidising H and relaxing L rationing.
- Premium risk is the risk of higher future premiums after health information reveals a persistently higher expected cost.

## Advanced mastery: audit an insurance-market equilibrium

Before calling an allocation an equilibrium, check four separate conditions:

1. **Participation:** each type prefers its selected contract to the uninsured endowment.
2. **Incentive compatibility:** the low-risk type prefers the low-risk contract and the high-risk type prefers the high-risk contract.
3. **Break-even:** each contract earns zero expected profit for the type that selects it.
4. **No profitable deviation:** no entrant can attract a profitable subset of consumers with another contract.

### Worked pooling example

Let (p_L=0.10), (p_H=0.30), (lambda=0.75), and (I=1000).

[
ar p=lambda p_L+(1-lambda)p_H
      =0.75(0.10)+0.25(0.30)=0.15
]

[
pi^P=ar p I=150
]

A low-risk enrollee has expected payout (p_LI=100), so pays (50) above own expected cost. A high-risk enrollee has expected payout (p_HI=300), so pays (150) below own expected cost. Aggregate transfers balance:

[
0.75(50)=0.25(150)=37.5
]

The contract therefore breaks even for the population while redistributing from low risks to high risks.

### Common exam traps

- High expected cost alone is not adverse selection; the mechanism requires hidden risk information and selection into plans.
- A pooling contract that breaks even is not automatically an equilibrium; it must survive cream-skimming.
- Separating equilibrium sorts types but is not first best because low risks remain partially insured.
- Partial versus full concerns the indemnity; fair versus unfair concerns the premium.
- The lecture does not provide a universal numerical threshold for the low-risk share above which equilibrium fails.
- The welfare result concerns a suitably designed compulsory pooling policy, not every possible mandate.
