// Original Student Hub exam-style bank inferred from the structure of two 2026 practice mocks.
(function (root) {
  "use strict";

  const T = {
    s1: "fund-health-economics.session-1",
    s2: "fund-health-economics.demand",
    s3: "fund-health-economics.health-capital",
    s4: "fund-health-economics.disparities",
    s5: "fund-health-economics.physician-agency",
    s6: "fund-health-economics.insurance-demand",
    s7: "fund-health-economics.adverse-selection",
  };
  const LETTERS = "ABCDEFG";

  const mcq = (id, topic, category, prompt, options, tags = []) => ({
    id,
    topic,
    type: "exam-mcq",
    category,
    prompt,
    maxScore: 5,
    blankScore: 0,
    options: options.map(([text, score, feedback], index) => ({
      id: LETTERS[index],
      text,
      score,
      feedback,
    })),
    tags,
  });

  const binary = (id, topic, category, prompt, choices, tags = []) => ({
    id,
    topic,
    type: "exam-binary",
    category,
    prompt,
    maxScore: 8,
    blankScore: 0,
    options: choices.map(([text, score, feedback], index) => ({
      id: String(index + 1),
      text,
      score,
      feedback,
    })),
    tags,
  });

  const open = (id, title, scenario, tasks, relatedTopics, rubric, modelOutline, commonMisses, tags = []) => ({
    id,
    type: "exam-open",
    title,
    scenario,
    tasks,
    relatedTopics,
    maxScore: 60,
    recommendedMinutes: 55,
    rubric,
    modelOutline,
    commonMisses,
    tags,
  });

  const mcqs = [
    mcq("fhem-style-m01", T.s1, "Healthcare expenditure", "Two countries have similar GDP per capita, but Country A spends more per person on healthcare. The most complete explanation is that:", [
      ["Country A necessarily has a larger population.", -1, "Population size does not explain per-capita spending."],
      ["Country A devotes a larger share of its economic output to healthcare.", 5, "Among similarly wealthy countries, a higher healthcare share of GDP directly raises expenditure per person."],
      ["Country A must have lower life expectancy.", -1, "Outcomes do not mechanically determine spending."],
      ["Country A may value healthcare differently.", 2, "Preferences can contribute, but this does not state the measurable spending relationship as completely as option B."],
      ["Healthcare productivity alone determines the difference.", -1, "Productivity and expenditure are distinct concepts."],
    ], ["HCE/GDP", "per capita"]),

    mcq("fhem-style-m02", T.s1, "Financial intermediation", "A health system moves from direct payment at the clinic to tax-funded coverage through a public purchaser. Which description is most accurate?", [
      ["Out-of-pocket payment rises and financial intermediation falls.", -1, "The direction is reversed."],
      ["Financial intermediation rises because a third party collects funds and pays providers.", 5, "That is the defining institutional change."],
      ["Risk disappears completely.", -1, "Financing changes how risk is pooled; it does not eliminate illness risk."],
      ["Patients face a lower money price at the point of use.", 2, "This may follow, but it is a consequence rather than the most complete institutional description."],
      ["Provider incentives become irrelevant.", -1, "Payment arrangements still shape provider behaviour."],
    ], ["financing", "out of pocket"]),

    mcq("fhem-style-m03", T.s2, "Causal identification", "People with more generous insurance use more healthcare. Which answer most completely explains why this association may overstate the causal effect of insurance?", [
      ["People expecting higher needs may select more generous plans.", 2, "Correct selection mechanism, but incomplete by itself."],
      ["Health status can affect both insurance choice and utilisation.", 2, "Correct confounding mechanism, but incomplete by itself."],
      ["Both selection on expected need and health-status confounding can generate the association.", 5, "This combines the two relevant mechanisms."],
      ["Insurance makes healthcare demand perfectly inelastic.", -1, "Insurance lowers the money price but does not make demand perfectly unresponsive."],
      ["Observed utilisation can never be measured reliably.", -1, "The problem is identification, not impossibility of measurement."],
    ], ["selection", "confounding"]),

    mcq("fhem-style-m04", T.s2, "Full price of care", "A clinic removes a €25 copayment, but travel costs €6 and the visit requires two hours valued at €12 per hour. What is the most complete interpretation?", [
      ["The visit is free because the copayment is zero.", -1, "The full price includes more than the clinic bill."],
      ["The patient's full price is €30.", 5, "€6 travel plus €24 time cost equals €30."],
      ["The patient's monetary price is zero.", 2, "Correct, but it omits travel and time costs."],
      ["Insurance has eliminated all rationing mechanisms.", -1, "Waiting and travel can still ration access."],
      ["The time cost is irrelevant when care is insured.", -1, "Time can become more important when the money price falls."],
    ], ["time price", "access"]),

    mcq("fhem-style-m05", T.s2, "Elasticity", "The absolute price elasticity of outpatient demand is 0.25. A 12% increase in the patient price would, approximately:", [
      ["Reduce quantity by 3%.", 5, "−0.25 × 12% = −3%."],
      ["Reduce quantity by 12%.", -1, "That would imply unit elasticity."],
      ["Reduce quantity by 25%.", -1, "The elasticity is not the percentage change itself."],
      ["Produce a smaller proportional response in quantity than in price.", 2, "Correct interpretation of inelastic demand, but less complete than the numerical answer."],
      ["Have no effect because healthcare demand is inelastic.", -1, "Inelastic does not mean perfectly inelastic."],
    ], ["elasticity", "calculation"]),

    mcq("fhem-style-m06", T.s3, "Grossman PPF", "At very low health capital, why can an improvement in health raise both health and the maximum attainable home good?", [
      ["Health production uses no scarce inputs at low health.", -1, "Health improvement still uses time and market goods."],
      ["The released healthy time can exceed the resources used to improve health.", 5, "That is the free-lunch-zone mechanism."],
      ["The marginal return to health investment is relatively high.", 2, "Correct underlying intuition, but less complete than the time-allocation explanation."],
      ["Health and the home good become perfect complements.", -1, "The model does not require perfect complementarity."],
      ["Depreciation becomes zero.", -1, "The free-lunch zone is not defined by zero depreciation."],
    ], ["free lunch zone", "productive time"]),

    mcq("fhem-style-m07", T.s3, "Comparative statics", "Education rises in the Grossman model. Which statement is most complete?", [
      ["Optimal health rises because health production becomes more efficient; healthcare demand is theoretically ambiguous.", 5, "This separates demand for health from derived demand for healthcare."],
      ["Optimal health rises.", 2, "Correct but incomplete because the healthcare-input effect is omitted."],
      ["Healthcare demand must rise because education always increases spending.", -1, "Efficiency can reduce the inputs needed per unit of health."],
      ["Optimal health falls because educated people value time more.", -1, "That is not the lecture prediction."],
      ["Education affects income only and has no production effect.", -1, "The efficient-producer channel is central."],
    ], ["education", "health production"]),

    mcq("fhem-style-m08", T.s3, "Health-stock accounting", "Inherited health is 90, the depreciation rate is 20%, and gross health investment is 12. What happens to the health stock?", [
      ["It rises to 102.", -1, "This ignores depreciation."],
      ["It falls to 84.", 5, "Surviving health is 72; adding 12 gives 84."],
      ["Net investment is −6.", 2, "Correct because 12−18=−6, but the question asks for the resulting stock."],
      ["It remains 90 because gross investment is positive.", -1, "Positive gross investment can still be below depreciation."],
      ["It falls to 78.", -1, "This subtracts depreciation and fails to add investment correctly."],
    ], ["health stock", "net investment"]),

    mcq("fhem-style-m09", T.s4, "Causal direction", "An adult's chronic illness causes early retirement and lower household wealth. Which explanation of the SES–health gradient is most directly illustrated?", [
      ["Direct income hypothesis.", -1, "That runs from income to health."],
      ["Productive-time hypothesis.", 5, "The causal arrow runs from poor health to lower SES through work capacity and earnings."],
      ["Allostatic load.", 2, "Stress can damage health, but it does not best describe the reverse-causality pathway in the scenario."],
      ["Thrifty phenotype.", -1, "That concerns early-life biological adaptation."],
      ["Efficient producer hypothesis.", -1, "That links education to health-production efficiency."],
    ], ["reverse causality", "productive time"]),

    mcq("fhem-style-m10", T.s4, "Fuchs hypothesis", "What is the most complete interpretation of the Fuchs hypothesis?", [
      ["Education directly causes all observed health differences.", -1, "The hypothesis is a third-factor explanation."],
      ["A stronger orientation toward future benefits can increase investment in both education and health.", 5, "Time preference can generate the positive association between the two investments."],
      ["People who delay gratification may invest more in health.", 2, "Correct but incomplete because the joint effect on education is essential."],
      ["Higher income necessarily improves health regardless of preferences.", -1, "That is not the Fuchs mechanism."],
      ["Time preference affects health but not education.", -1, "The common-factor logic requires both."],
    ], ["time preference", "third factor"]),

    mcq("fhem-style-m11", T.s4, "Policy matching", "A government believes prenatal deprivation has persistent effects on adult disease. Which policy package is most closely matched to that mechanism?", [
      ["Maternal nutrition, food security and early-childhood support.", 5, "These policies intervene at the exposure stage identified by the early-life mechanism."],
      ["General adult income transfers only.", 2, "Resources may help, but this does not target prenatal and early-life exposure as directly."],
      ["More fee-for-service reimbursement for physicians.", -1, "This does not target the causal mechanism."],
      ["Higher copayments for preventive care.", -1, "That could reduce access to relevant care."],
      ["Reducing medical-school places.", -1, "Unrelated to the mechanism."],
    ], ["thrifty phenotype", "policy"]),

    mcq("fhem-style-m12", T.s5, "Physician agency", "A physician recommends an additional procedure mainly to protect income, despite believing it is not in the patient's best interest. This is best classified as:", [
      ["Due professional influence.", -1, "Due influence supports the patient's interest."],
      ["Physician-induced demand.", 5, "The recommendation moves demand against the physician's own assessment of the patient's interest."],
      ["Information asymmetry.", 2, "Information asymmetry enables the influence, but it is not the complete behavioural classification."],
      ["A pure increase in patient need.", -1, "The scenario specifies an income motive rather than higher need."],
      ["Supply-side rationing.", -1, "The physician is increasing rather than withholding care."],
    ], ["PID", "agency"]),

    mcq("fhem-style-m13", T.s5, "Income and substitution effects", "An administered fee per service is reduced. Which answer most completely describes the physician's possible inducement response?", [
      ["Inducement must fall because each service is less profitable.", 2, "This identifies the substitution effect but ignores the income effect."],
      ["Inducement may rise if the income effect dominates the substitution effect.", 5, "The McGuire–Pauly synthesis allows either direction depending on relative strength."],
      ["Inducement must rise because income falls.", 2, "This identifies the income effect but incorrectly treats it as necessarily dominant."],
      ["Fees cannot affect behaviour when professional ethics exist.", -1, "Ethics can dampen but not logically eliminate all incentive responses."],
      ["The result is unrelated to physician preferences.", -1, "Preferences over income, leisure and inducement are central."],
    ], ["PID", "comparative statics"]),

    mcq("fhem-style-m14", T.s5, "Provider payment", "Which payment reform most directly reduces the marginal revenue from delivering one extra service while preserving some activity payment?", [
      ["Pure fee-for-service.", -1, "This keeps the strongest direct marginal payment."],
      ["A two-part tariff combining a fixed component with a lower per-service fee.", 5, "The fixed component protects revenue while the lower marginal fee weakens volume incentives."],
      ["Pure salary.", 2, "This removes most marginal volume payment, but it does not preserve an activity component."],
      ["A higher fee-for-service price.", -1, "This strengthens the marginal volume incentive."],
      ["Patient coinsurance only.", -1, "This changes patient price rather than provider reimbursement directly."],
    ], ["two-part tariff", "FFS"]),

    mcq("fhem-style-m15", T.s5, "Practice variation", "Large geographic differences in procedure rates remain after measured patient needs and supply factors are considered. Which explanation is most consistent with the practice-style hypothesis?", [
      ["Physicians face identical evidence and interpret it identically.", -1, "That would predict less unexplained variation."],
      ["Incomplete knowledge and uneven diffusion of medical information generate different local beliefs and treatment styles.", 5, "That is the central practice-style mechanism."],
      ["Supply factors are completely irrelevant.", -1, "The lecture says supply matters but does not explain everything."],
      ["Clinical discretion can contribute where evidence leaves a grey area.", 2, "Correct component, but option B gives the fuller causal account."],
      ["Every regional difference proves deliberate income maximisation.", -1, "Variation can arise from uncertainty and information as well as self-interest."],
    ], ["small area variation", "practice style"]),

    mcq("fhem-style-m16", T.s6, "Risk aversion", "A person is risk averse and already faces a medical-loss risk. Why can the person reject a fair gamble yet buy fair insurance?", [
      ["The gamble adds dispersion, while insurance reduces dispersion across health states.", 5, "Risk aversion concerns the direction in which risk is changed."],
      ["Insurance necessarily has positive expected monetary value.", -1, "Fair insurance has zero expected insurer profit in the benchmark."],
      ["Concave utility makes smoother state income valuable.", 2, "Correct intuition, but the contrast with the gamble is not fully stated."],
      ["Risk-averse people prefer every contract labelled full.", -1, "Premium loading still matters."],
      ["A fair gamble and fair insurance are economically identical.", -1, "One adds risk; the other removes existing risk."],
    ], ["expected utility", "risk aversion"]),

    mcq("fhem-style-m17", T.s6, "Insurance contract", "A specialist visit costs €120. Contract A pays a fixed indemnity of €40; Contract B requires a €35 copayment. If the provider price rises to €150, what happens to the patient's payment?", [
      ["It rises by €30 under A and remains €35 under B.", 5, "Under A the patient pays price minus €40: €80 then €110. Under B the copayment remains €35."],
      ["It remains unchanged under both contracts.", -1, "The indemnity contract leaves the patient exposed to the price rise."],
      ["It rises under the indemnity contract.", 2, "Correct but incomplete because the copayment result and amount are omitted."],
      ["It rises by €30 under both contracts.", -1, "The copayment is fixed."],
      ["It remains €40 under A and €35 under B.", -1, "€40 is the insurer's indemnity, not the patient's payment."],
    ], ["indemnity", "copayment"]),

    mcq("fhem-style-m18", T.s6, "Fair versus full", "Which statement most accurately separates fairness from completeness of coverage?", [
      ["A contract is fair when I=M and full when π=pI.", -1, "The definitions are reversed."],
      ["Fairness compares premium with expected payout; fullness compares indemnity with the medical loss.", 5, "This correctly separates π from I."],
      ["A fair contract can be partial.", 2, "Correct example, but less complete than the definitional distinction."],
      ["Every full contract is actuarially fair.", -1, "A full contract may carry a loading."],
      ["Partial insurance always yields lower expected utility than full insurance at any premium.", -1, "Premium matters."],
    ], ["fair insurance", "full insurance"]),

    mcq("fhem-style-m19", T.s6, "Insurer profit", "A contract has sickness probability 0.20, indemnity €1,000 and premium €240. Which answer is most complete?", [
      ["Expected insurer profit is €40 and the contract is technically unfair in the benchmark model.", 5, "π−pI=240−200=€40."],
      ["Expected insurer profit is €40.", 2, "Correct calculation but incomplete classification."],
      ["The contract is fair because the premium is below the indemnity.", -1, "Fairness compares premium with expected payout, not total indemnity."],
      ["Expected profit is €240.", -1, "Expected claims must be subtracted."],
      ["The contract must provide full insurance.", -1, "The medical loss is not given."],
    ], ["expected profit", "loading"]),

    mcq("fhem-style-m20", T.s7, "Pooling premium", "Low risks have pL=0.10, high risks pH=0.30, and 60% of the pool is low risk. For indemnity €500, what is the zero-profit pooling premium?", [
      ["€50", 2, "This is the low-risk fair premium, not the pooling premium."],
      ["€90", 5, "Average risk is 0.6×0.10+0.4×0.30=0.18; 0.18×€500=€90."],
      ["€150", 2, "This is the high-risk fair premium, not the pooling premium."],
      ["€200", -1, "The calculation overstates expected cost."],
      ["It cannot be calculated without observing every individual's type.", -1, "The population shares and type probabilities are sufficient."],
    ], ["pooling", "calculation"]),

    mcq("fhem-style-m21", T.s7, "Pooling instability", "Which contract deviation most directly threatens a candidate pooling equilibrium?", [
      ["A contract preferred by both types and priced below both expected costs.", -1, "That would be loss-making rather than a sustainable competitive deviation."],
      ["A less generous contract preferred by low risks, rejected by high risks and profitable at pL.", 5, "This is cream-skimming."],
      ["Any contract with a higher indemnity.", -1, "Generosity alone does not establish profitable selection."],
      ["A contract that reveals type through self-selection.", 2, "Correct feature of separation, but the option does not state the profitable-entry conditions fully."],
      ["A contract above the low-risk zero-profit line.", -1, "That would be loss-making for low risks in the standard diagram."],
    ], ["cream skimming", "pooling"]),

    mcq("fhem-style-m22", T.s7, "Separating equilibrium", "In the standard separating outcome, why is the low-risk contract partial?", [
      ["Low risks dislike insurance more than high risks and never want full coverage.", -1, "Risk aversion alone would favour fair full coverage in the benchmark."],
      ["Coverage is restricted enough to prevent high risks from imitating the cheaper low-risk contract.", 5, "Partial coverage is the informational distortion needed for self-selection."],
      ["The low-risk premium is actuarially unfair.", -1, "The standard separating contract can be fair for L but partial."],
      ["Low risks face a quantity constraint.", 2, "Correct welfare description, but option B states the causal reason."],
      ["The government prohibits full insurance.", -1, "The restriction arises from market incentive compatibility."],
    ], ["separation", "rationing"]),

    mcq("fhem-style-m23", T.s7, "Premium risk", "Which situation best illustrates premium risk rather than current medical-expenditure risk?", [
      ["A hospital bill is larger than expected this year.", 2, "This is current medical-expenditure risk, not the long-run premium problem."],
      ["A diagnosis permanently raises expected future costs and therefore future insurance premiums.", 5, "Premium risk concerns reclassification into a persistently more expensive risk class."],
      ["A patient pays a copayment at a visit.", -1, "That is cost sharing."],
      ["A low-risk person pays more than own expected cost in a pool.", 2, "That is cross-subsidisation; it can finance premium-risk protection but is not itself the defining shock."],
      ["A provider increases the number of services under fee-for-service.", -1, "That concerns provider incentives."],
    ], ["reclassification", "renewability"]),

    mcq("fhem-style-m24", T.s7, "Integrated policy", "A regulator wants to preserve broad risk sharing while reducing low-risk exits from generous plans. Which response is most complete?", [
      ["Allow unrestricted risk rating and remove all pooling.", -1, "This may improve actuarial matching but undermines affordability for high risks."],
      ["Use a compulsory basic pool, allow supplementary coverage, and consider risk adjustment or premium-risk protection.", 5, "This combines pooling, choice and long-run affordability mechanisms."],
      ["Mandate one generous plan only.", 2, "A mandate can preserve pooling, but the response omits choice and the incentive/affordability architecture."],
      ["Ban supplementary insurance in every setting.", -1, "The lecture allows supplementary choice above a compulsory base."],
      ["Ignore selection because zero expected profit guarantees equilibrium.", -1, "Break-even alone does not rule out profitable deviations."],
    ], ["government", "risk adjustment", "premium risk"]),
  ];

  const binaries = [
    binary("fhem-style-b01", T.s2, "Demand", "For non-urgent care, a longer time horizon and more substitutes generally make demand more price-responsive.", [
      ["True", 8, "Correct. Substitutability and the ability to delay care usually increase responsiveness."],
      ["False", -2, "Incorrect. These conditions generally make demand more elastic."],
    ], ["elasticity"]),

    binary("fhem-style-b02", T.s6, "Insurance", "A risk-averse person necessarily prefers full insurance to partial insurance even when the full contract carries a very large loading.", [
      ["True", -2, "Incorrect. Full coverage is optimal under actuarially fair pricing in the benchmark, not at every premium."],
      ["False", 8, "Correct. Premium loading can make a partial contract preferable."],
    ], ["full insurance", "loading"]),

    binary("fhem-style-b03", T.s3, "Grossman", "Other things equal, a higher wage raises the return to healthy productive time and therefore raises optimal health in the pure-investment model.", [
      ["True", 8, "Correct. The MEC shifts outward when healthy time becomes more valuable."],
      ["False", -2, "Incorrect. This is the lecture's wage comparative static."],
    ], ["wage", "MEC"]),

    binary("fhem-style-b04", T.s4, "Income and health", "Evidence that richer adults are healthier is sufficient by itself to prove the direct-income hypothesis.", [
      ["True", -2, "Incorrect. The association may reflect reverse causality or third factors."],
      ["False", 8, "Correct. Causal direction must be identified."],
    ], ["causality"]),

    binary("fhem-style-b05", T.s5, "Payment incentives", "A lower marginal fee per service can reduce inducement through a substitution effect while simultaneously increasing inducement through an income effect.", [
      ["True", 8, "Correct. The net result depends on which effect dominates."],
      ["False", -2, "Incorrect. The opposing effects are central to the model."],
    ], ["PID", "fees"]),

    binary("fhem-style-b06", T.s5, "Agency", "Every physician recommendation that changes a patient's demand is physician-induced demand.", [
      ["True", -2, "Incorrect. Helpful professional guidance can be due influence."],
      ["False", 8, "Correct. PID is undue influence against the physician's own assessment of the patient's interest."],
    ], ["PID"]),

    binary("fhem-style-b07", T.s6, "Fair premium", "In the benchmark with no loading, a competitive insurer's zero-profit premium for indemnity I is π=pI.", [
      ["True", 8, "Correct. Expected premium equals expected payout."],
      ["False", -2, "Incorrect. This is the actuarially fair pricing condition."],
    ], ["fair insurance"]),

    binary("fhem-style-b08", T.s7, "Pooling", "At a population pooling premium, low-risk enrollees can pay above their own expected claims while high-risk enrollees pay below theirs.", [
      ["True", 8, "Correct. The pool embeds a transfer from L to H."],
      ["False", -2, "Incorrect. Population break-even does not imply type-specific fairness."],
    ], ["cross subsidy"]),

    binary("fhem-style-b09", T.s7, "Contract geometry", "Because pH>pL, the high-risk zero-profit line is steeper than the low-risk zero-profit line in yH–yS space.", [
      ["True", -2, "Incorrect. The absolute slope (1−p)/p falls as p rises."],
      ["False", 8, "Correct. The high-risk line is flatter."],
    ], ["zero profit line"]),

    binary("fhem-style-b10", T.s7, "Separating equilibrium", "If a standard Rothschild–Stiglitz separating equilibrium exists, the high-risk type receives fair full insurance while the low-risk type may receive fair partial insurance.", [
      ["True", 8, "Correct. Partial coverage for L supports self-selection."],
      ["False", -2, "Incorrect. This reverses the standard separating allocation."],
    ], ["Rothschild Stiglitz"]),

    binary("fhem-style-b11", T.s7, "Premium risk", "Guaranteed renewability and premium insurance address exactly the same problem in exactly the same way.", [
      ["True", -2, "Incorrect. They address premium risk through different contractual mechanisms and switching implications."],
      ["False", 8, "Correct. Renewability stabilises continuation terms, whereas premium insurance finances future premium increases after reclassification."],
    ], ["renewability"]),

    binary("fhem-style-b12", T.s7, "Government intervention", "The model implies that every compulsory health-insurance mandate is necessarily a Pareto improvement.", [
      ["True", -2, "Incorrect. The welfare result is conditional on policy design and model assumptions."],
      ["False", 8, "Correct. A suitably chosen second-best policy can improve welfare; not every mandate does."],
    ], ["second best"]),
  ];

  const commonRubric = [
    { id: "concepts", title: "Correct economic concepts", max: 15, guidance: "Uses the relevant theories and defines them accurately." },
    { id: "mechanisms", title: "Causal mechanisms", max: 12, guidance: "Explains how each mechanism changes behaviour, risk, utilisation or welfare." },
    { id: "application", title: "Application to the scenario", max: 10, guidance: "Connects the theory to the institutions and facts given in the question." },
    { id: "tradeoffs", title: "Trade-offs and unintended effects", max: 8, guidance: "Identifies benefits, costs, distributional effects and incentive responses." },
    { id: "policy", title: "Policy recommendations", max: 10, guidance: "Recommendations follow logically from the diagnosis and acknowledge conditions." },
    { id: "structure", title: "Structure and conclusion", max: 5, guidance: "Clear organisation, prioritisation and a defensible final recommendation." },
  ];

  const opens = [
    open("fhem-style-o01", "Cost sharing, provider incentives and equity", "A universal health system has almost free access at the point of care, rapidly rising specialist visits, uneven chronic-disease outcomes and large regional spending differences. Most physicians are paid fee-for-service.", [
      "Diagnose the possible roles of demand-side price effects, physician agency and practice variation.",
      "Explain how socioeconomic disparities may influence both need and ability to respond to cost sharing.",
      "Evaluate targeted cost sharing, value-based insurance principles and a blended physician-payment reform.",
      "Give a final recommendation with safeguards for equity and quality.",
    ], [T.s2, T.s4, T.s5, T.s6], commonRubric, [
      "Start with the low patient money price and expected utilisation response; distinguish necessary from discretionary care.",
      "Add the provider side: FFS increases marginal revenue from activity; agency and clinical grey areas can amplify use.",
      "Use practice variation to explain regional differences not fully accounted for by measured need.",
      "Explain why uniform cost sharing can burden low-income or high-need patients and may reduce high-value care.",
      "Recommend targeted or value-sensitive cost sharing, exemptions for high-value chronic care, and a two-part or blended provider tariff.",
      "Add monitoring of quality, access, regional patterns and vulnerable groups.",
    ], ["Treating every extra visit as waste", "Ignoring provider incentives", "Recommending uniform copayments without equity safeguards", "Giving policy suggestions without explaining their incentive effects"], ["policy", "cost sharing", "provider payment"]),

    open("fhem-style-o02", "Competing plans, adverse selection and premium risk", "Citizens choose among competing private health plans. Premiums are community rated and insurers cannot use individual health status. Generous plans experience rising premiums, while healthier members increasingly move to less generous plans. A serious diagnosis can also raise a person's expected future insurance costs.", [
      "Explain the adverse-selection mechanism and the premium feedback across plans.",
      "Assess whether a stable pooling or separating equilibrium is likely.",
      "Distinguish current medical-expenditure risk from premium risk.",
      "Evaluate compulsory basic insurance, risk adjustment, guaranteed renewability and supplementary insurance.",
    ], [T.s6, T.s7], commonRubric, [
      "Separate the coverage effect from the composition effect in generous-plan premiums.",
      "Explain why average pricing transfers resources from low to high risks and why low risks may exit.",
      "Use cream-skimming to challenge pooling; use incentive compatibility and low-risk partial coverage to describe separation.",
      "Define premium risk as future reclassification after persistent health deterioration.",
      "Compare a mandatory pooling base, risk adjustment between plans, renewability and supplementary choice.",
      "Conclude conditionally: preserve durable pooling while limiting plan-selection incentives and protecting switching where possible.",
    ], ["Calling every premium difference moral hazard", "Assuming population break-even guarantees equilibrium", "Ignoring low-risk rationing", "Failing to separate current claims risk from future premium risk"], ["adverse selection", "premium risk"]),

    open("fhem-style-o03", "Early-life inequality and long-run policy", "A Ministry of Health observes that adults raised in low-income families have worse health and lower earnings, even after universal healthcare coverage is introduced.", [
      "Explain at least three mechanisms that can generate the observed pattern.",
      "Separate direct causality, reverse causality and third-factor explanations.",
      "Propose a coherent policy package spanning pregnancy, childhood, education and adult health protection.",
    ], [T.s3, T.s4], commonRubric, [
      "Use early-life deprivation or thrifty-phenotype reasoning.",
      "Use parental resources and child health accumulation rather than assuming adult income causality alone.",
      "Use education as health-production efficiency and time preference as a possible third factor.",
      "Use productive time to explain how poor childhood or adult health can lower schooling and earnings.",
      "Match policies to mechanisms: maternal nutrition, family support, early education, health literacy and protection against earnings losses from illness.",
    ], ["Listing theories without causal chains", "Confusing adult and child income evidence", "Treating universal medical access as sufficient to remove all disparities"], ["inequality", "life course"]),

    open("fhem-style-o04", "Universal coverage and provider-payment reform", "A tax-funded health service offers free care at the point of use through private providers paid pure fee-for-service. Fiscal pressure is rising. The government considers reducing public coverage, allowing supplementary insurance and introducing a fixed payment plus a lower service fee.", [
      "Assess risk sharing, adverse selection and utilisation incentives under the current system.",
      "Identify likely provider-side inefficiencies.",
      "Discuss advantages and disadvantages of each reform.",
      "Give a prioritised recommendation.",
    ], [T.s1, T.s2, T.s5, T.s6, T.s7], commonRubric, [
      "Recognise strong pooling and protection from individual medical risk under tax finance.",
      "Explain how zero point-of-use price can raise utilisation but does not imply every use is inefficient.",
      "Explain FFS volume incentives, agency and potential practice variation.",
      "Explain how reducing public coverage can create access concerns and plan-selection problems in supplementary markets.",
      "Explain why a two-part tariff can reduce marginal volume incentives while maintaining provider participation.",
      "Recommend sequencing: payment reform and targeted demand management before broad erosion of risk sharing.",
    ], ["Equating universal coverage with absence of moral hazard", "Ignoring adverse selection in supplementary insurance", "Assuming capitation or fixed payment has no under-provision risk"], ["NHS", "FFS", "reform"]),

    open("fhem-style-o05", "Regional variation and clinical discretion", "Procedure rates differ threefold across neighbouring regions despite similar measured age, morbidity and insurance coverage. Physician density and hospital capacity explain part, but not all, of the variation.", [
      "Use the Session 5 framework to explain the remaining variation.",
      "Distinguish supplier-induced demand from the practice-style hypothesis.",
      "Design an evaluation and payment response that does not assume all variation is inappropriate.",
    ], [T.s2, T.s5], commonRubric, [
      "Separate measurable need, supply and unexplained residual variation.",
      "PID requires undue influence linked to provider objectives; practice style can arise from uncertainty and information diffusion.",
      "Recognise the clinical grey area and patient-specific benefits.",
      "Recommend audit-and-feedback, evidence dissemination, second opinions or decision support alongside payment reform.",
      "Use outcome and quality measures, not volume alone, to judge performance.",
    ], ["Treating all variation as fraud", "Using physician density alone as proof of PID", "Recommending volume cuts without outcome monitoring"], ["SAV", "PID"]),

    open("fhem-style-o06", "Insurance contract design under heterogeneous risk", "An insurer offers a single generous contract to a mixed population. Low-risk members complain that the premium exceeds their expected costs, while high-risk members fear that risk-rated alternatives would become unaffordable.", [
      "Explain fair/full distinctions at the individual and pool levels.",
      "Analyse pooling, cross-subsidy and possible cream-skimming.",
      "Compare a separating menu with a compulsory pooling base plus supplementary coverage.",
    ], [T.s6, T.s7], commonRubric, [
      "Define full versus partial using indemnity and fair versus unfair using premium relative to expected payout.",
      "Show that pooling can break even overall while not being type-specific fair.",
      "Explain low-risk exit incentives and the conditions for a profitable deviation.",
      "Describe H fair full and L fair partial in separation, including L's welfare loss.",
      "Explain the second-best logic of a mandatory base with supplementary choice.",
    ], ["Calling the pooling premium unfair in a purely moral sense", "Assuming separation restores first best", "Ignoring affordability for H"], ["insurance design", "pooling"]),

    open("fhem-style-o07", "Ageing, education and healthy-time policy", "A country faces rapid population ageing, rising chronic disease and unequal educational attainment. Policymakers propose only expanding hospital capacity.", [
      "Use the Grossman model to analyse age, depreciation, wages and education.",
      "Explain why healthcare demand and demand for health need not move identically.",
      "Evaluate a broader policy mix beyond hospital expansion.",
    ], [T.s3, T.s4], commonRubric, [
      "Ageing raises depreciation and lowers optimal health in the model, while healthcare-input demand can be ambiguous.",
      "Higher wages raise the value of healthy time; education improves health-production efficiency.",
      "Distinguish desired health stock from the derived demand for medical inputs.",
      "Recommend prevention, self-management support, education and healthy-ageing policies alongside capacity planning.",
      "Discuss equity because education and resources affect ability to produce health.",
    ], ["Saying ageing must reduce healthcare use", "Treating education only as income", "Recommending supply expansion without opportunity-cost analysis"], ["Grossman", "ageing"]),

    open("fhem-style-o08", "Evidence, insurance and utilisation", "An observational study finds that insured patients have more visits and worse baseline health than uninsured patients. The government interprets the difference as proof that insurance causes wasteful demand.", [
      "Critique the causal inference.",
      "Explain what randomised insurance evidence can and cannot establish.",
      "Design a policy response that distinguishes financial protection, utilisation and health outcomes.",
    ], [T.s2, T.s6], commonRubric, [
      "Identify selection on expected need and health-status confounding.",
      "Explain why random assignment improves identification of the price/coverage effect.",
      "State that insurance can increase utilisation without every additional service being low value.",
      "Separate utilisation outcomes from objective and self-reported health outcomes.",
      "Recommend targeted cost sharing, protection against catastrophic risk and monitoring of high-value versus low-value care.",
    ], ["Treating association as causation", "Assuming higher use is automatically inefficient", "Ignoring the insurance value of risk protection"], ["RAND", "causality"]),
  ];

  const fixedMocks = [
    {
      id: "mock-3",
      title: "Mock Exam 3",
      subtitle: "Cost sharing, provider incentives and equity",
      description: "A balanced original paper focused on demand, Grossman, disparities, physician incentives and insurance design.",
      mcqIds: ["fhem-style-m01", "fhem-style-m04", "fhem-style-m07", "fhem-style-m11", "fhem-style-m13", "fhem-style-m18"],
      binaryIds: ["fhem-style-b03", "fhem-style-b08"],
      openId: "fhem-style-o01",
    },
    {
      id: "mock-4",
      title: "Mock Exam 4",
      subtitle: "Plan competition, selection and premium risk",
      description: "A second original paper emphasising causal identification, provider variation and insurance-market equilibrium.",
      mcqIds: ["fhem-style-m02", "fhem-style-m03", "fhem-style-m08", "fhem-style-m15", "fhem-style-m20", "fhem-style-m23"],
      binaryIds: ["fhem-style-b02", "fhem-style-b10"],
      openId: "fhem-style-o02",
    },
  ];

  root.FHEMExamStyleBank = {
    schemaVersion: 1,
    title: "FHEM Exam-Style Bank",
    basis: "Original Student Hub questions informed by the structure—not the wording—of two 2026 course practice mocks.",
    format: {
      minutes: 90,
      sections: [
        { id: "A", type: "exam-mcq", count: 6, maxScore: 30, correct: 5, partial: 2, incorrect: -1, blank: 0 },
        { id: "B", type: "exam-binary", count: 2, maxScore: 16, correct: 8, incorrect: -2, blank: 0 },
        { id: "C", type: "exam-open", count: 1, maxScore: 60, grading: "self-assessed Student Hub rubric" },
      ],
      rawMax: 106,
      suggestedTiming: [
        { label: "Section A", minutes: 20 },
        { label: "Section B", minutes: 10 },
        { label: "Section C", minutes: 55 },
        { label: "Final review", minutes: 5 },
      ],
    },
    mcqs,
    binaries,
    opens,
    fixedMocks,
    randomBlueprint: { mcqCount: 6, binaryCount: 2, openCount: 1, distinctMcqTopics: 6 },
  };
})(typeof window !== "undefined" ? window : globalThis);
