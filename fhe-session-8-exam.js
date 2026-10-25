// Original Session 8 additions to the FHEM exam-style preparation bank.
(function (root) {
  "use strict";

  const bank = root.FHEMExamStyleBank;
  if (!bank) return;
  const TOPIC = "fund-health-economics.moral-hazard";
  const LETTERS = "ABCDEFG";

  const mcq = (id, category, prompt, options, tags = []) => ({
    id,
    topic: TOPIC,
    type: "exam-mcq",
    category,
    prompt,
    maxScore: 5,
    blankScore: 0,
    options: options.map(([text, score, feedback], index) => ({ id: LETTERS[index], text, score, feedback })),
    tags,
  });

  const binary = (id, category, prompt, choices, tags = []) => ({
    id,
    topic: TOPIC,
    type: "exam-binary",
    category,
    prompt,
    maxScore: 8,
    blankScore: 0,
    options: choices.map(([text, score, feedback], index) => ({ id: String(index + 1), text, score, feedback })),
    tags,
  });

  const rubric = [
    { id: "concepts", label: "Correct economic concepts", max: 15, guidance: "Define and distinguish the relevant insurance, incentive and organisational concepts accurately." },
    { id: "mechanisms", label: "Causal mechanisms", max: 12, guidance: "Explain how prices, payment rules, networks or information change behaviour and expenditure." },
    { id: "application", label: "Application to the scenario", max: 10, guidance: "Use the facts of the case rather than giving a generic lecture summary." },
    { id: "tradeoffs", label: "Trade-offs and unintended effects", max: 8, guidance: "Discuss risk protection, access, equity, underprovision, quality or innovation." },
    { id: "policy", label: "Policy recommendations", max: 10, guidance: "Recommend a coherent instrument mix and justify why it targets the identified margins." },
    { id: "structure", label: "Structure and conclusion", max: 5, guidance: "Organise the answer and end with a clear recommendation." },
  ];

  const open = (id, title, scenario, tasks, modelOutline, commonMisses, tags = []) => ({
    id,
    type: "exam-open",
    title,
    scenario,
    tasks,
    relatedTopics: [TOPIC, "fund-health-economics.physician-agency", "fund-health-economics.insurance-demand"],
    maxScore: 60,
    recommendedMinutes: 55,
    rubric: rubric.map((item) => ({ ...item })),
    modelOutline,
    commonMisses,
    tags,
  });

  const mcqs = [
    mcq("fhem-style-m25", "Expected loss", "A health plan covers the financial consequences of an event. Which statement most completely distinguishes ex-ante from ex-post moral hazard?", [
      ["Ex-ante moral hazard raises the probability of the event; ex-post moral hazard raises the loss after the event.", 5, "This maps directly to p(eP) and L(eL)."],
      ["Ex-ante moral hazard occurs before illness.", 2, "Correct timing, but it does not state which expected-loss margin changes or define ex-post moral hazard."],
      ["Ex-post moral hazard is the same as adverse selection.", -1, "Adverse selection concerns hidden risk type and contract choice; ex-post moral hazard concerns behaviour after illness."],
      ["Only providers can generate ex-post moral hazard.", -1, "Patients and providers may both influence treatment intensity."],
      ["Both forms necessarily involve fraud.", -1, "Moral hazard can arise through ordinary incentive responses without fraud."],
    ], ["expected loss", "timing"]),

    mcq("fhem-style-m26", "Coinsurance and welfare", "Marginal cost is €80 and the patient pays 25% coinsurance. Which answer is most complete?", [
      ["The patient price is €20, so use may exceed the quantity where marginal benefit equals €80.", 5, "The patient faces kP=€20 while society still incurs €80 per unit."],
      ["The patient price is €20.", 2, "The calculation is correct but the welfare implication is omitted."],
      ["The insurer pays €20.", -1, "The insurer pays €60."],
      ["The social marginal cost falls to €20.", -1, "Insurance changes the private price, not the resources used to produce care."],
      ["There can be no deadweight loss because coinsurance is positive.", -1, "Positive coinsurance can reduce but not necessarily eliminate the distortion."],
    ], ["coinsurance", "DWL"]),

    mcq("fhem-style-m27", "Elasticity", "Two services have the same marginal cost and patient copayment. Demand for A is much more elastic than demand for B. Other things equal, which statement is most appropriate?", [
      ["A has a larger utilisation response and generally warrants a higher optimal coinsurance rate.", 5, "A common price subsidy generates a larger quantity distortion for the more elastic service."],
      ["A has a larger utilisation response.", 2, "Correct, but it omits the insurance-design implication."],
      ["B should always be excluded from coverage.", -1, "Inelastic demand generally supports more complete coverage, not exclusion."],
      ["Both must receive identical coverage because marginal cost is equal.", -1, "Elasticity is also relevant to optimal coverage."],
      ["Elasticity is irrelevant once a service is clinically effective.", -1, "Effectiveness does not eliminate the incentive response."],
    ], ["elasticity", "optimal insurance"]),

    mcq("fhem-style-m28", "Interrelated demand", "A covered physiotherapy programme reduces use of another covered service that is itself overused. What is the most complete insurance-design implication?", [
      ["The programme may merit more generous coverage because its offset effect reduces use of the other service.", 5, "Substitution can create an efficiency gain outside the programme's own demand curve."],
      ["The programme is a substitute for another service.", 2, "Correct classification, but the cost-sharing implication is missing."],
      ["The programme should face higher cost sharing because all additional use is moral hazard.", -1, "This ignores the reduction in the other covered service."],
      ["Complementarity and substitution have the same policy implication.", -1, "Complements can increase total use while substitutes can offset it."],
      ["Interrelated demand can always be handled with one uniform copayment.", -1, "Clinical context can change whether the same service is a substitute or complement."],
    ], ["offset effect", "substitution"]),

    mcq("fhem-style-m29", "Managed-plan structure", "Which plan description is fully correct?", [
      ["A PPO uses preferred-network terms but normally no physician gatekeeper; a POS plan combines network tiers with gatekeeping.", 5, "This correctly distinguishes the two organisational structures."],
      ["A PPO offers lower cost sharing in its network.", 2, "Correct but incomplete because it does not distinguish PPO from POS or HMO."],
      ["An HMO is the least restrictive plan because OOP is low.", -1, "HMO is generally the most restrictive in network and gatekeeping terms."],
      ["Standard FFS requires both a network and a gatekeeper.", -1, "The standard FFS plan occupies the no-network/no-gatekeeper cell."],
      ["A POS plan has no network distinction.", -1, "POS plans retain two tiers of benefits."],
    ], ["HMO", "PPO", "POS"]),

    mcq("fhem-style-m30", "Managed-care evidence", "An MCO has similar measured treatment and quality but lower expenditure than FFS. Which explanation is best supported by that pattern?", [
      ["The MCO negotiated a lower price per unit of service.", 5, "Lower prices reconcile similar treatment quantities with lower spending."],
      ["The MCO must have reduced utilisation.", -1, "The premise says measured treatment is similar."],
      ["Lower negotiated prices are a possible mechanism.", 2, "Correct, but less direct than the fully specified answer."],
      ["The MCO necessarily reduced welfare.", -1, "Expenditure alone does not establish welfare loss."],
      ["The MCO necessarily accelerated technology adoption.", -1, "The lecture discusses potentially slower diffusion under higher managed-care penetration."],
    ], ["prices", "empirical evidence"]),
  ];

  const binaries = [
    binary("fhem-style-b13", "Expected-loss margin", "Ex-ante moral hazard mainly operates by changing the probability p that an insured event occurs.", [
      ["TRUE", 8, "Correct. Prevention effort changes p before the event."],
      ["FALSE", -2, "Ex-post moral hazard acts mainly through loss size L; ex-ante moral hazard acts through p."],
    ], ["ex ante"]),
    binary("fhem-style-b14", "Plan structure", "A Preferred Provider Organization normally requires a primary-care physician gatekeeper before specialist care.", [
      ["TRUE", -2, "In the lecture's classification, PPOs have network tiers but no physician gatekeeper."],
      ["FALSE", 8, "Correct. Gatekeeping distinguishes POS/HMO from PPO in the simplified matrix."],
    ], ["PPO"]),
    binary("fhem-style-b15", "Evidence", "Lower expenditure in a managed-care plan proves that the plan provides a lower quantity of care.", [
      ["TRUE", -2, "Lower prices per unit can reduce expenditure with similar utilisation."],
      ["FALSE", 8, "Correct. Price, quantity, quality and technology channels must be separated."],
    ], ["managed care", "causal interpretation"]),
  ];

  const opens = [
    open(
      "fhem-style-o09",
      "Zero-price public coverage with private FFS providers",
      "A tax-funded regional health plan offers free access at the point of care. Most physicians and hospitals are private and paid fee for service. Utilisation and expenditure are rising, preventive adherence is uneven, and the ministry is reluctant to expose low-income patients to financial barriers.",
      [
        "Diagnose the demand-side and provider-side moral-hazard mechanisms in the current system.",
        "Explain the risk-spreading versus incentive trade-off of introducing patient cost sharing.",
        "Compare uniform cost sharing, value-based insurance design, provider-payment reform and managed-care controls.",
        "Recommend a coherent package and identify access, quality and innovation indicators that should be monitored.",
      ],
      [
        "Start with the insurance value of universal tax-funded coverage: broad pooling, protection from catastrophic expenditure and limited adverse-selection problems in the compulsory public pool.",
        "Identify ex-post demand-side moral hazard from a zero patient price and supply-side expansion from pure FFS; mention that provider influence makes observed demand partly endogenous.",
        "Explain why uniform copayments reduce low- and high-value use and can disproportionately burden low-income and chronically ill patients.",
        "Use VBID: preserve zero or very low prices for prevention, essential chronic medication and catastrophic care while applying targeted cost sharing to low-value discretionary use.",
        "Replace pure FFS with a blended or prospective component, selective contracting, utilisation review and quality safeguards rather than relying on patients alone.",
        "Recommend income protection, exemptions or caps; monitor unmet need, avoidable admissions, outcomes, waiting times, patient experience, provider behaviour and technology adoption.",
        "Conclude that a targeted demand-and-supply mix is preferable to either free unrestricted FFS or blunt across-the-board cost sharing.",
      ],
      [
        "Treating all additional insured care as waste",
        "Ignoring the insurance and equity value of universal coverage",
        "Recommending a copayment without explaining which services or patients it applies to",
        "Ignoring provider payment and quality safeguards",
      ],
      ["policy", "FFS", "VBID", "managed care"],
    ),
    open(
      "fhem-style-o10",
      "Designing a benefit package across heterogeneous services",
      "An employer plan must redesign benefits for preventive visits, chronic-disease medicines, physiotherapy, elective imaging and major hospital care. The finance team proposes one 30% coinsurance rate for every service. Clinical leaders argue that some services substitute for costly care, some complement it, and patients often underestimate long-run benefits.",
      [
        "Explain why one uniform coinsurance rate is unlikely to be optimal.",
        "Use elasticity, price distortion, offset effects, complementarity and patient information to classify the services.",
        "Propose a value-based benefit design and explain where provider-side controls are needed.",
        "Discuss the main risks and evaluation plan.",
      ],
      [
        "State the second-best objective: retain risk protection while reducing utilisation whose marginal value is below marginal cost.",
        "High elasticity by itself does not prove low value; prevention and chronic adherence can be elastic because patients undervalue future benefits.",
        "Apply generous coverage to catastrophic hospital care and high-value prevention/chronic medication; consider subsidies when adherence generates future offsets.",
        "Evaluate physiotherapy by clinical context because it can substitute for medication or complement surgery; avoid a single service label across all diagnoses.",
        "Use higher cost sharing or prior review for low-value discretionary imaging, but protect clinically indicated imaging and vulnerable patients.",
        "Combine patient prices with provider guidelines, utilisation review, payment reform and shared decision support.",
        "Monitor total and service-specific use, substitution across services, outcomes, financial burden, disparities and delayed care.",
      ],
      [
        "Equating elasticity with low clinical value",
        "Ignoring interrelated demand",
        "Applying the same rule to all health states",
        "Leaving provider incentives unchanged",
      ],
      ["benefit design", "elasticity", "offset effects", "VBID"],
    ),
  ];

  const appendUnique = (target, items) => {
    const ids = new Set(target.map((item) => item.id));
    for (const item of items) if (!ids.has(item.id)) target.push(item);
  };
  appendUnique(bank.mcqs, mcqs);
  appendUnique(bank.binaries, binaries);
  appendUnique(bank.opens, opens);
  bank.basis += " Session 8 additions cover moral hazard, targeted cost sharing and managed care using original Student Hub questions.";
})(typeof window !== "undefined" ? window : globalThis);
