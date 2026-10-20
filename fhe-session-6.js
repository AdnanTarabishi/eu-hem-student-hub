// Session 6 — Insurance I: original study content, activity definitions and integration.
(function (root) {
  "use strict";

  const TOPIC_ID = "fund-health-economics.insurance-demand";
  const MODULE_ID = "fund-health-economics";
  const COURSE_ID = "fund-health-econ-management";
  const ACTIVITY_IDS = [
    "insurance-risk-utility",
    "insurance-pool",
    "insurance-coverage-path",
    "insurance-contract-lab",
    "insurance-contract-compare",
  ];

  const flashcards = [
    {
      id: "fund-health-economics.fc.201",
      topic: TOPIC_ID,
      front: "What financial problem does health insurance address in Session 6?",
      back: "It protects income against unpredictable medical expenditure that can be rare but financially large.",
    },
    {
      id: "fund-health-economics.fc.202",
      topic: TOPIC_ID,
      front: "Does the benchmark health-insurance contract remove illness itself?",
      back: "No. It covers the financial risk associated with medical care when the specified illness occurs.",
    },
    {
      id: "fund-health-economics.fc.203",
      topic: TOPIC_ID,
      front: "What is risk aversion?",
      back: "A preference for certain income over risky income with the same expected monetary value.",
    },
    {
      id: "fund-health-economics.fc.204",
      topic: TOPIC_ID,
      front: "How is risk aversion represented with utility from income?",
      back: "Utility rises with income but at a decreasing rate: U′(y) > 0 and U″(y) < 0.",
    },
    {
      id: "fund-health-economics.fc.205",
      topic: TOPIC_ID,
      front: "What is expected income?",
      back: "The probability-weighted average of monetary outcomes: E[Y] = Σ pᵢyᵢ.",
    },
    {
      id: "fund-health-economics.fc.206",
      topic: TOPIC_ID,
      front: "What is expected utility?",
      back: "The probability-weighted average of utility in each possible state: E[U(Y)] = Σ pᵢU(yᵢ).",
    },
    {
      id: "fund-health-economics.fc.207",
      topic: TOPIC_ID,
      front: "What is an actuarially fair gamble?",
      back: "A gamble whose price equals its expected monetary value.",
    },
    {
      id: "fund-health-economics.fc.208",
      topic: TOPIC_ID,
      front: "Why does a risk-averse person reject a non-degenerate actuarially fair gamble?",
      back: "Because the gamble adds dispersion to certain income, and concave utility makes expected utility under risk lower than utility at expected income.",
    },
    {
      id: "fund-health-economics.fc.209",
      topic: TOPIC_ID,
      front: "Why can the same person prefer actuarially fair insurance?",
      back: "Insurance removes dispersion from an already risky income by transferring resources from the healthy state to the sick state.",
    },
    {
      id: "fund-health-economics.fc.210",
      topic: TOPIC_ID,
      front: "What is a certainty equivalent?",
      back: "The certain income y* that gives the same utility as the risky prospect: U(y*) = E[U(Y)].",
    },
    {
      id: "fund-health-economics.fc.211",
      topic: TOPIC_ID,
      front: "What is the risk premium?",
      back: "The difference E[Y] − y*: the maximum expected income the person would give up to remove the risk while keeping the same utility.",
    },
    {
      id: "fund-health-economics.fc.212",
      topic: TOPIC_ID,
      front: "What three responses to medical-expenditure risk are compared in the lecture?",
      back: "Borrowing after illness, precautionary saving, and pooling risk through insurance.",
    },
    {
      id: "fund-health-economics.fc.213",
      topic: TOPIC_ID,
      front: "What is the law-of-large-numbers intuition for insurance?",
      back: "In a large pool of similar independent risks, the share becoming sick is more predictable even though each individual's outcome is uncertain.",
    },
    {
      id: "fund-health-economics.fc.214",
      topic: TOPIC_ID,
      front: "What is an indemnity insurance contract?",
      back: "A contract in which the insured pays a premium and receives a specified payout if the covered contingency occurs.",
    },
    {
      id: "fund-health-economics.fc.215",
      topic: TOPIC_ID,
      front: "What do p, M, I and π denote in Session 6?",
      back: "p is sickness probability, M the medical loss, I the indemnity or coverage, and π the premium.",
    },
    {
      id: "fund-health-economics.fc.216",
      topic: TOPIC_ID,
      front: "What is the healthy-state income after buying an indemnity contract?",
      back: "yₕ = y − π.",
    },
    {
      id: "fund-health-economics.fc.217",
      topic: TOPIC_ID,
      front: "What is the sick-state income after buying an indemnity contract?",
      back: "yₛ = y − π − M + I.",
    },
    {
      id: "fund-health-economics.fc.218",
      topic: TOPIC_ID,
      front: "What is the actuarially fair premium for indemnity I?",
      back: "π = pI, equal to expected indemnity expenditure per enrollee in the benchmark.",
    },
    {
      id: "fund-health-economics.fc.219",
      topic: TOPIC_ID,
      front: "Under fair pricing, how do the two state incomes depend on I?",
      back: "yₕ = y − pI and yₛ = y − M + (1 − p)I.",
    },
    {
      id: "fund-health-economics.fc.220",
      topic: TOPIC_ID,
      front: "What first-order condition determines optimal fair coverage?",
      back: "Marginal utility must be equal across states: U′(yₛ) = U′(yₕ).",
    },
    {
      id: "fund-health-economics.fc.221",
      topic: TOPIC_ID,
      front: "Why does the fair-insurance optimum imply I* = M?",
      back: "Strict concavity means equal marginal utility requires yₛ = yₕ; substituting the state incomes then gives full coverage I = M.",
    },
    {
      id: "fund-health-economics.fc.222",
      topic: TOPIC_ID,
      front: "What is state independence?",
      back: "Income is the same whether the individual is healthy or sick; in the benchmark this occurs under full insurance.",
    },
    {
      id: "fund-health-economics.fc.223",
      topic: TOPIC_ID,
      front: "What is the insurer's expected profit on contract (π, I)?",
      back: "E[Π] = (1 − p)π + p(π − I) = π − pI.",
    },
    {
      id: "fund-health-economics.fc.224",
      topic: TOPIC_ID,
      front: "How does Session 6 define fair and unfair insurance?",
      back: "Fair insurance has π = pI. In the lecture's technical terminology, unfair insurance has π > pI and positive expected profit.",
    },
    {
      id: "fund-health-economics.fc.225",
      topic: TOPIC_ID,
      front: "What determines whether insurance is full or partial?",
      back: "The indemnity size: full coverage has I = M; partial coverage has I < M.",
    },
    {
      id: "fund-health-economics.fc.226",
      topic: TOPIC_ID,
      front: "What is the ideal insurance contract in the Session 6 benchmark?",
      back: "An actuarially fair and full contract for a risk-averse individual.",
    },
    {
      id: "fund-health-economics.fc.227",
      topic: TOPIC_ID,
      front: "Can a full but unfair contract always be ranked above a fair partial contract?",
      back: "No. The ranking depends on premium, coverage, loss probability, loss size and risk aversion.",
    },
    {
      id: "fund-health-economics.fc.228",
      topic: TOPIC_ID,
      front: "Which Session 6 assumption is relaxed in Session 7?",
      back: "Session 7 introduces heterogeneous hidden risk types, so consumers can know more about their sickness probability than insurers.",
    },
  ];

  const questions = [
    {
      id: "fund-health-economics.q.201",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "easy",
      category: "Insurance principles",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Which feature of medical expenditure gives health insurance its basic value in Session 6?",
      options: [
        "Medical spending is perfectly predictable",
        "Medical spending can be uncertain and financially catastrophic",
        "Every person incurs the same treatment cost each year",
        "Insurance removes the probability of illness",
      ],
      answer: "B",
      explanation: "The lecture grounds insurance demand in uncertainty and the potentially large financial effect of medical spending.",
    },
    {
      id: "fund-health-economics.q.202",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "easy",
      category: "Risk aversion",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Which utility-function properties represent risk aversion in the lecture?",
      options: ["U′(y) < 0 and U″(y) > 0", "U′(y) > 0 and U″(y) < 0", "U′(y) = 0", "U″(y) = 0 only"],
      answer: "B",
      explanation: "Utility rises with income, but marginal utility declines as income rises.",
    },
    {
      id: "fund-health-economics.q.203",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "easy",
      category: "Expected value",
      source: "EU-HEM Hub original practice · Session 6",
      question: "A prospect pays €200 with probability 0.5 and €0 otherwise. What is its expected monetary value?",
      options: ["€0", "€50", "€100", "€200"],
      answer: "C",
      explanation: "E[Y] = 0.5 × 200 + 0.5 × 0 = €100.",
    },
    {
      id: "fund-health-economics.q.204",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "medium",
      category: "Expected utility",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Which expression is the expected utility of healthy income yₕ and sick income yₛ when sickness probability is p?",
      options: ["pU(yₕ) + (1−p)U(yₛ)", "(1−p)U(yₕ) + pU(yₛ)", "U((1−p)yₕ + pyₛ) only", "U(yₕ) + U(yₛ)"],
      answer: "B",
      explanation: "Expected utility weights the utility in each state by that state's probability.",
    },
    {
      id: "fund-health-economics.q.205",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "medium",
      category: "Certainty equivalent",
      source: "EU-HEM Hub original practice · Session 6",
      question: "The certainty equivalent y* is defined by which condition?",
      options: ["y* = E[Y] in every case", "U(y*) = E[U(Y)]", "U(y*) = E[Y]", "y* = pM"],
      answer: "B",
      explanation: "The certainty equivalent is the certain income that generates the same utility as the risky prospect.",
    },
    {
      id: "fund-health-economics.q.206",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "medium",
      category: "Risk premium",
      source: "EU-HEM Hub original practice · Session 6",
      question: "How is the risk premium represented in Session 6?",
      options: ["y* − E[Y]", "E[Y] − y*", "π − I", "p + M"],
      answer: "B",
      explanation: "It is the amount of expected income above the certainty equivalent that the person would give up to remove risk.",
    },
    {
      id: "fund-health-economics.q.207",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "medium",
      category: "Risk pooling",
      source: "EU-HEM Hub original practice · Session 6",
      question: "A pool has N identical enrollees, sickness probability p and indemnity I. Which premium exactly covers expected indemnity payments?",
      options: ["π = I/p", "π = pI", "π = NI", "π = pN"],
      answer: "B",
      explanation: "Nπ = pNI, so the fair premium per enrollee is π = pI.",
    },
    {
      id: "fund-health-economics.q.208",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "medium",
      category: "Indemnity contract",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Which expression gives sick-state income after buying coverage I for premium π against medical loss M?",
      options: ["y − π", "y − M", "y − π − M + I", "y + π − I"],
      answer: "C",
      explanation: "The person pays the premium and medical loss, then receives the indemnity.",
    },
    {
      id: "fund-health-economics.q.209",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "medium",
      category: "Fair coverage",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Under fair pricing π = pI, what happens to healthy-state income when I rises by €1?",
      options: ["It rises by €1", "It falls by p euros", "It falls by 1−p euros", "It does not change"],
      answer: "B",
      explanation: "Healthy income is yₕ = y − pI, so the marginal cost of another euro of coverage is p in that state.",
    },
    {
      id: "fund-health-economics.q.210",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "medium",
      category: "Optimal insurance",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Why does the fair-insurance first-order condition lead to full coverage in the benchmark?",
      options: [
        "Because the insurer sets I to zero",
        "Because equal marginal utility under strict concavity requires equal income across states",
        "Because sickness probability becomes zero",
        "Because the premium is unrelated to coverage",
      ],
      answer: "B",
      explanation: "U′(yₛ)=U′(yₕ) implies yₛ=yₕ; substituting state incomes yields I=M.",
    },
    {
      id: "fund-health-economics.q.211",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "medium",
      category: "Insurer profit",
      source: "EU-HEM Hub original practice · Session 6",
      question: "What is expected insurer profit for premium π, sickness probability p and indemnity I?",
      options: ["π + pI", "pπ − I", "π − pI", "I − π"],
      answer: "C",
      explanation: "The insurer always collects π and pays I with probability p, giving E[Π]=π−pI.",
    },
    {
      id: "fund-health-economics.q.212",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "medium",
      category: "Contract classification",
      source: "EU-HEM Hub original practice · Session 6",
      question: "A contract has π = pI and I < M. How is it classified?",
      options: ["Fair and full", "Fair and partial", "Unfair and full", "Loss-making and overinsured"],
      answer: "B",
      explanation: "Fairness depends on π=pI; partial coverage means I<M.",
    },
    {
      id: "fund-health-economics.q.213",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "medium",
      category: "Contract classification",
      source: "EU-HEM Hub original practice · Session 6",
      question: "A contract has π > pI and I = M. How is it classified in the lecture's terminology?",
      options: ["Fair and partial", "Unfair and full", "Fair and full", "Negative-profit and partial"],
      answer: "B",
      explanation: "The indemnity fully covers the loss, while the premium exceeds expected payout.",
    },
    {
      id: "fund-health-economics.q.214",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "medium",
      category: "Ideal contract",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Which contract is the ideal benchmark for a risk-averse consumer in Session 6?",
      options: ["Unfair and partial", "Fair and full", "No insurance", "Any full contract regardless of premium"],
      answer: "B",
      explanation: "Fair full insurance removes state-dependent income without charging above expected payout in the benchmark.",
    },
    {
      id: "fund-health-economics.q.215",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "hard",
      category: "Non-ideal contracts",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Why can a fair partial contract sometimes be preferred to a full but unfair contract?",
      options: [
        "Partial insurance always gives state independence",
        "A sufficiently high premium loading can outweigh the value of fuller coverage",
        "Fair contracts always have zero indemnity",
        "Risk aversion makes premiums irrelevant",
      ],
      answer: "B",
      explanation: "Non-ideal contracts trade off coverage against price, so their ranking depends on the magnitude of both.",
    },
    {
      id: "fund-health-economics.q.216",
      topic: TOPIC_ID,
      type: "true-false",
      difficulty: "easy",
      source: "EU-HEM Hub original practice · Session 6",
      question: "A risk-averse person necessarily accepts every actuarially fair gamble.",
      answer: false,
      explanation: "False. A fair gamble can add risk without raising expected income, so concave utility makes it unattractive.",
    },
    {
      id: "fund-health-economics.q.217",
      topic: TOPIC_ID,
      type: "true-false",
      difficulty: "medium",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Full versus partial insurance is determined by premium size.",
      answer: false,
      explanation: "False. It is determined by indemnity size relative to the loss; premium size determines fairness in the benchmark.",
    },
    {
      id: "fund-health-economics.q.218",
      topic: TOPIC_ID,
      type: "true-false",
      difficulty: "medium",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Under fair full insurance, income is the same in the healthy and sick states.",
      answer: true,
      explanation: "True. With π=pM and I=M, both state incomes equal y−pM.",
    },
    {
      id: "fund-health-economics.q.219",
      topic: TOPIC_ID,
      type: "true-false",
      difficulty: "medium",
      source: "EU-HEM Hub original practice · Session 6",
      question: "A profit-seeking insurer in the benchmark would willingly offer a contract with π < pI indefinitely.",
      answer: false,
      explanation: "False. Such a contract has negative expected profit.",
    },
    {
      id: "fund-health-economics.q.220",
      topic: TOPIC_ID,
      type: "true-false",
      difficulty: "medium",
      source: "EU-HEM Hub original practice · Session 6",
      question: "A fair partial contract removes all financial risk across health states.",
      answer: false,
      explanation: "False. If I<M, sick-state income remains below healthy-state income.",
    },
    {
      id: "fund-health-economics.q.221",
      topic: TOPIC_ID,
      type: "true-false",
      difficulty: "medium",
      source: "EU-HEM Hub original practice · Session 6",
      question: "In the indemnity model, the payout is contingent on the specified covered condition occurring.",
      answer: true,
      explanation: "True. Indemnity insurance is presented as a simple contingent-claims contract.",
    },
    {
      id: "fund-health-economics.q.222",
      topic: TOPIC_ID,
      type: "true-false",
      difficulty: "hard",
      source: "EU-HEM Hub original practice · Session 6",
      question: "The label 'unfair insurance' in Session 6 is a complete ethical judgement about every real-world premium above expected payout.",
      answer: false,
      explanation: "False. It is a technical model label; the simplified benchmark omits administration, capital and other real-world costs.",
    },
    {
      id: "fund-health-economics.q.223",
      topic: TOPIC_ID,
      type: "short-answer",
      difficulty: "medium",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Explain why a risk-averse person can reject a fair gamble but prefer fair insurance.",
      answer: "A fair gamble adds risk to an initially certain position without increasing expected income. Fair insurance reduces an existing risk by transferring income from the healthy state to the sick state. Concave utility therefore makes the gamble unattractive but makes risk reduction valuable.",
      explanation: "The answer should distinguish the direction of the change in risk, not merely repeat that the person is risk-averse.",
    },
    {
      id: "fund-health-economics.q.224",
      topic: TOPIC_ID,
      type: "short-answer",
      difficulty: "medium",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Derive the fair premium for a pool of N identical enrollees with sickness probability p and indemnity I.",
      answer: "Expected total payouts are pNI and total premium revenue is Nπ. Setting expected profit to zero gives Nπ=pNI, hence π=pI per enrollee.",
      explanation: "A strong answer should show both the group accounting and the per-person result.",
    },
    {
      id: "fund-health-economics.q.225",
      topic: TOPIC_ID,
      type: "short-answer",
      difficulty: "medium",
      source: "EU-HEM Hub original practice · Session 6",
      question: "An individual has y=100, p=0.2 and M=50. They buy I=30 at a fair premium. Calculate π, yₕ and yₛ, then classify the contract.",
      answer: "π=pI=0.2×30=6. Healthy income is yₕ=100−6=94. Sick income is yₛ=100−6−50+30=74. The contract is fair and partial because π=pI and I<M.",
      explanation: "The remaining state-income gap is M−I=20.",
    },
    {
      id: "fund-health-economics.q.226",
      topic: TOPIC_ID,
      type: "short-answer",
      difficulty: "hard",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Show the logic that leads from the fair-insurance first-order condition to I*=M.",
      answer: "The first-order condition reduces to U′(yₛ)=U′(yₕ). With strictly diminishing marginal utility this implies yₛ=yₕ. Under fair pricing, yₕ=y−pI and yₛ=y−M+(1−p)I. Setting them equal gives y−pI=y−M+(1−p)I, so I=M.",
      explanation: "The derivation relies on strict concavity and fair pricing.",
    },
    {
      id: "fund-health-economics.q.227",
      topic: TOPIC_ID,
      type: "short-answer",
      difficulty: "medium",
      source: "EU-HEM Hub original practice · Session 6",
      question: "What does 'unfair insurance' mean technically in the Session 6 model, and what does it not necessarily mean?",
      answer: "Technically it means π>pI, so the contract generates positive expected profit in the simplified model. It does not by itself provide a complete ethical assessment of real premiums because the benchmark omits administrative costs, capital requirements and other expenses.",
      explanation: "Keep the mathematical definition separate from broader normative judgement.",
    },
    {
      id: "fund-health-economics.q.228",
      topic: TOPIC_ID,
      type: "short-answer",
      difficulty: "hard",
      source: "EU-HEM Hub original practice · Session 6",
      question: "Why can two non-ideal contracts — one fuller but more expensive and one fairer but more partial — not be ranked using the labels alone?",
      answer: "Fullness reduces state-dependent risk, while a higher premium lowers income in both states. The preferred contract depends on the exact premium, indemnity, loss probability, loss size and the person's utility curvature. A sufficiently high loading can outweigh fuller protection, while modest loading may be worth paying for more coverage.",
      explanation: "The lecture's final comparison is about a trade-off, not a universal ordering of all non-ideal contracts.",
    },
  ];

  const concepts = [
    {
      id: "concept.insurance-risk-aversion",
      term: "Risk aversion",
      explanation: "A preference for certain income over risky income with the same expected monetary value, represented by increasing and concave utility.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.insurance-expected-value",
      term: "Expected value",
      explanation: "The probability-weighted average of possible monetary outcomes.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.expected-utility",
      term: "Expected utility",
      explanation: "The probability-weighted average of utility across possible states, not the utility of the probability-weighted average income.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.certainty-equivalent",
      term: "Certainty equivalent",
      explanation: "The certain income that gives the same utility as a risky prospect.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.risk-premium",
      term: "Risk premium",
      explanation: "Expected income minus the certainty equivalent: a utility-based measure of willingness to pay to remove risk.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.actuarially-fair-gamble",
      term: "Actuarially fair gamble",
      explanation: "A gamble whose price equals its expected monetary value.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.indemnity-contract",
      term: "Indemnity insurance contract",
      explanation: "A contract paying a specified amount when a defined covered contingency occurs in exchange for an advance premium.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.insurance-premium",
      term: "Insurance premium (π)",
      explanation: "The amount paid in advance for the insurance contract.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.insurance-indemnity",
      term: "Indemnity (I)",
      explanation: "The specified insurance payout received when the covered sickness occurs.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.actuarially-fair-premium",
      term: "Actuarially fair premium",
      explanation: "A premium equal to expected indemnity expenditure in the benchmark: π=pI.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.risk-pooling",
      term: "Risk pooling",
      explanation: "Combining many uncertain individual risks so expected group expenditure can be financed through shared premiums.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.state-independent-income",
      term: "State-independent income",
      explanation: "Income that is equal in the healthy and sick states, achieved by full insurance in the Session 6 benchmark.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.full-insurance",
      term: "Full insurance",
      explanation: "Coverage for which the indemnity equals the medical loss, I=M, eliminating the income gap across states.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.partial-insurance",
      term: "Partial insurance",
      explanation: "Coverage for which I<M, leaving some financial loss in the sick state.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.unfair-insurance",
      term: "Unfair insurance (technical definition)",
      explanation: "A contract with π>pI and positive expected profit in the lecture's simplified model.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.insurer-expected-profit",
      term: "Insurer expected profit",
      explanation: "Expected premium revenue net of expected indemnity payment: E[Π]=π−pI.",
      topics: [TOPIC_ID],
    },
  ];

  const resources = [
    {
      id: "fund-health-economics.r.206",
      title: "Official Session 6 materials on Virtuale",
      type: "Website",
      url: "https://virtuale.unibo.it/course/view.php?id=80559",
      date: "2026-10-20",
      topic: TOPIC_ID,
      description: "Official University of Bologna materials for Fundamentals in Health Economics. Sign in with your UniBo account.",
    },
  ];

  function appendUnique(target, items) {
    if (!Array.isArray(target)) return;
    const ids = new Set(target.map((item) => item.id));
    for (const item of items) {
      if (!ids.has(item.id)) {
        target.push(item);
        ids.add(item.id);
      }
    }
  }

  const originalLoadAll = root.loadAll;
  if (typeof originalLoadAll === "function" && !originalLoadAll.__fheSession6Wrapped) {
    const wrappedLoadAll = async function (...args) {
      const data = await originalLoadAll.apply(this, args);
      const module = data.modules?.find((item) => item.id === MODULE_ID);
      const course = data.courses?.find((item) => item.id === COURSE_ID);
      if (module) {
        appendUnique(module.flashcards, flashcards);
        appendUnique(module.questions, questions);
        appendUnique(module.resources, resources);
      }
      if (course) {
        appendUnique(course.flashcards, flashcards);
        appendUnique(course.questions, questions);
        appendUnique(course.resources, resources);
      }
      appendUnique(data.concepts, concepts);
      return data;
    };
    wrappedLoadAll.__fheSession6Wrapped = true;
    root.loadAll = wrappedLoadAll;
  }

  const originalLoadLecture = root.loadLecture;
  if (typeof originalLoadLecture === "function" && !originalLoadLecture.__fheSession6Wrapped) {
    const wrappedLoadLecture = async function (moduleData, topic, read) {
      if (topic?.id !== TOPIC_ID) {
        return originalLoadLecture.call(this, moduleData, topic, read);
      }
      const reader = read || root.fetchText;
      const validPath = (file, extension) =>
        typeof file === "string" &&
        new RegExp(`^lectures/[a-z0-9]+(-[a-z0-9]+)*\\.${extension}$`).test(file);
      if (!validPath(topic.lecture, "json")) {
        throw new Error("Session 6 lecture configuration must be a JSON file in the lectures folder.");
      }
      const config = await root.readJson(reader, moduleData.folder + topic.lecture, null);
      if (!config || config.schemaVersion !== 1 || config.topic !== TOPIC_ID) {
        throw new Error("Session 6 lecture schema or topic ID does not match.");
      }
      if (!validPath(config.guide, "html")) {
        throw new Error("Session 6 guide must be an HTML file in the lectures folder.");
      }
      if (
        !Array.isArray(config.activities) ||
        config.activities.some((id) => !ACTIVITY_IDS.includes(id)) ||
        new Set(config.activities).size !== config.activities.length
      ) {
        throw new Error("Session 6 activities must use the supported insurance activity IDs.");
      }
      for (const field of ["intro", "attribution"]) {
        if (typeof config[field] !== "string" || !config[field].trim()) {
          throw new Error(`Session 6 lecture needs ${field}.`);
        }
      }
      return config;
    };
    wrappedLoadLecture.__fheSession6Wrapped = true;
    root.loadLecture = wrappedLoadLecture;
  }

  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const fmt = (value, digits = 2) =>
    Number.isFinite(value)
      ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })
      : "—";
  const input = (id, label, value, attrs = "") =>
    `<div class="control"><label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" ${attrs}></div>`;
  const range = (id, label, value, min, max, step, left, right) =>
    `<div class="control"><label for="${id}">${label}: <strong id="${id}-value">${value}</strong></label><input id="${id}" type="range" value="${value}" min="${min}" max="${max}" step="${step}"><div class="range-labels"><span>${left}</span><span>${right}</span></div></div>`;
  const readNumber = (node, id, min = -Infinity, max = Infinity) => {
    const value = Number(node.querySelector(`#${id}`)?.value);
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
  };
  const output = (id) => `<div id="${id}" class="activity-output" aria-live="polite"></div>`;
  const sqrtUtility = (income) => (income >= 0 ? Math.sqrt(income) : NaN);
  const expectedUtility = (p, healthy, sick) =>
    (1 - p) * sqrtUtility(healthy) + p * sqrtUtility(sick);
  const certaintyEquivalent = (utility) => utility * utility;
  const contractClass = (p, loss, indemnity, premium) => {
    const tolerance = Math.max(0.01, Math.abs(p * indemnity) * 0.001);
    const profit = premium - p * indemnity;
    const pricing = Math.abs(profit) <= tolerance ? "Fair" : profit > 0 ? "Unfair / positive expected profit" : "Negative expected profit";
    const coverageTolerance = Math.max(0.01, Math.abs(loss) * 0.001);
    const coverage = Math.abs(indemnity - loss) <= coverageTolerance ? "Full" : indemnity < loss ? "Partial" : "More than full";
    return { pricing, coverage, profit };
  };

  function stateBars(healthy, sick, baseline) {
    const scale = Math.max(1, baseline, healthy, sick);
    return `
      <div class="insurance-activity-bars">
        <div class="insurance-income-bar"><span>Healthy-state income</span><strong>€${fmt(healthy)}</strong><div class="insurance-income-fill" style="height:${Math.max(0, Math.min(100, (healthy / scale) * 100))}%"></div></div>
        <div class="insurance-income-bar is-sick"><span>Sick-state income</span><strong>€${fmt(sick)}</strong><div class="insurance-income-fill" style="height:${Math.max(0, Math.min(100, (sick / scale) * 100))}%"></div></div>
      </div>`;
  }

  function registerActivities() {
    if (!root.LectureActivities?.register) return;

    root.LectureActivities.register("insurance-risk-utility", {
      title: "Expected income is not expected utility",
      intro:
        "Use a square-root utility function as an explicit Student Hub teaching assumption. Change income, sickness probability and medical loss to see expected income, certainty equivalent and risk premium.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("iru-income", "Income before the health shock (€)", 100, 'min="1" step="1"') +
          input("iru-loss", "Medical loss M (€)", 60, 'min="0" step="1"') +
          range("iru-prob", "Probability of sickness (%)", 20, 1, 95, 1, "1%", "95%") +
          "</div>" +
          output("iru-output");
        const render = () => {
          const income = readNumber(node, "iru-income", 1, 1e9);
          const loss = readNumber(node, "iru-loss", 0, income - 0.0001);
          const p = readNumber(node, "iru-prob", 1, 95) / 100;
          node.querySelector("#iru-prob-value").textContent = fmt(p * 100, 0) + "%";
          const healthy = income;
          const sick = income - loss;
          const expectedIncome = (1 - p) * healthy + p * sick;
          const eu = expectedUtility(p, healthy, sick);
          const ce = certaintyEquivalent(eu);
          const riskPremium = expectedIncome - ce;
          const fairPremium = p * loss;
          const insuredIncome = income - fairPremium;
          const insuredUtility = sqrtUtility(insuredIncome);
          node.querySelector("#iru-output").innerHTML =
            stateBars(healthy, sick, income) +
            `<dl class="activity-stats"><div><dt>Expected income</dt><dd>€${fmt(expectedIncome)}</dd></div><div><dt>Expected utility</dt><dd>${fmt(eu, 4)}</dd></div><div><dt>Certainty equivalent y*</dt><dd>€${fmt(ce)}</dd></div><div><dt>Risk premium E[Y]−y*</dt><dd>€${fmt(riskPremium)}</dd></div><div><dt>Fair full premium pM</dt><dd>€${fmt(fairPremium)}</dd></div><div><dt>Income with fair full insurance</dt><dd>€${fmt(insuredIncome)}</dd></div></dl>` +
            `<p>With fair full insurance, both states produce income €${fmt(insuredIncome)} and utility ${fmt(insuredUtility, 4)}. The square-root utility function is used only to make the lecture's concavity logic numerical.</p>`;
        };
        node.querySelectorAll("input").forEach((control) => control.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("insurance-pool", {
      title: "Build a fair risk pool",
      intro:
        "Change pool size, sickness probability and indemnity. The benchmark fair premium covers expected payouts; actual realised claims can still differ in a finite pool.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("ipool-n", "Number of enrollees N", 1000, 'min="1" step="1"') +
          range("ipool-p", "Sickness probability p (%)", 10, 1, 80, 1, "1%", "80%") +
          input("ipool-i", "Indemnity I (€)", 5000, 'min="0" step="100"') +
          "</div>" +
          output("ipool-output");
        const render = () => {
          const n = readNumber(node, "ipool-n", 1, 1e9);
          const p = readNumber(node, "ipool-p", 1, 80) / 100;
          const indemnity = readNumber(node, "ipool-i", 0, 1e12);
          node.querySelector("#ipool-p-value").textContent = fmt(p * 100, 0) + "%";
          const expectedSick = n * p;
          const fairPremium = p * indemnity;
          const revenue = n * fairPremium;
          const payout = expectedSick * indemnity;
          node.querySelector("#ipool-output").innerHTML =
            `<div class="formula">Nπ = pNI &nbsp; ⇒ &nbsp; π = €${fmt(fairPremium)}</div>` +
            `<dl class="activity-stats"><div><dt>Expected sick enrollees pN</dt><dd>${fmt(expectedSick, 1)}</dd></div><div><dt>Fair premium per enrollee</dt><dd>€${fmt(fairPremium)}</dd></div><div><dt>Total expected premium revenue</dt><dd>€${fmt(revenue)}</dd></div><div><dt>Total expected indemnity payout</dt><dd>€${fmt(payout)}</dd></div></dl>` +
            '<p>The equality is an expected-value statement. In a finite pool, the realised number of claims can be above or below pN.</p>';
        };
        node.querySelectorAll("input").forEach((control) => control.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("insurance-coverage-path", {
      title: "Watch fair coverage equalise state income",
      intro:
        "Move indemnity from zero toward the medical loss while keeping the premium actuarially fair. Healthy income falls and sick income rises until they meet at full insurance.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("icp-income", "Income y (€)", 100, 'min="1" step="1"') +
          input("icp-loss", "Medical loss M (€)", 60, 'min="0" step="1"') +
          range("icp-prob", "Sickness probability p (%)", 20, 1, 95, 1, "1%", "95%") +
          range("icp-coverage", "Indemnity I (€)", 30, 0, 100, 1, "0", "100") +
          "</div>" +
          output("icp-output");
        const render = () => {
          const income = readNumber(node, "icp-income", 1, 1e9);
          const loss = readNumber(node, "icp-loss", 0, income - 0.0001);
          const p = readNumber(node, "icp-prob", 1, 95) / 100;
          const slider = node.querySelector("#icp-coverage");
          slider.max = String(Math.max(1, Math.round(loss * 1.25)));
          const indemnity = Math.min(readNumber(node, "icp-coverage", 0, loss * 1.25), loss * 1.25);
          node.querySelector("#icp-prob-value").textContent = fmt(p * 100, 0) + "%";
          node.querySelector("#icp-coverage-value").textContent = "€" + fmt(indemnity, 0);
          const premium = p * indemnity;
          const healthy = income - premium;
          const sick = income - premium - loss + indemnity;
          const eu = expectedUtility(p, healthy, sick);
          const classification = contractClass(p, loss, indemnity, premium);
          node.querySelector("#icp-output").innerHTML =
            stateBars(healthy, sick, income) +
            `<dl class="activity-stats"><div><dt>Fair premium π=pI</dt><dd>€${fmt(premium)}</dd></div><div><dt>Uninsured gap M−I</dt><dd>€${fmt(loss - indemnity)}</dd></div><div><dt>Expected utility U(y)=√y</dt><dd>${fmt(eu, 4)}</dd></div><div><dt>Coverage</dt><dd>${escapeHtml(classification.coverage)}</dd></div></dl>` +
            `<p>${classification.coverage === "Full" ? "The two state incomes are equal: the benchmark full-insurance point." : classification.coverage === "Partial" ? "Some state-dependent risk remains. Continue toward I=M to equalise incomes." : "Coverage exceeds the medical loss, producing more income when sick than when healthy."}</p>`;
        };
        node.querySelectorAll("input").forEach((control) => control.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("insurance-contract-lab", {
      title: "Classify any indemnity contract",
      intro:
        "Enter a premium and indemnity. The lab calculates state incomes and expected insurer profit, then keeps fairness and fullness as separate labels.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("icl-income", "Income y (€)", 100, 'min="1" step="1"') +
          input("icl-loss", "Medical loss M (€)", 60, 'min="0" step="1"') +
          input("icl-prob", "Sickness probability p (%)", 20, 'min="0" max="100" step="1"') +
          input("icl-indemnity", "Indemnity I (€)", 60, 'min="0" step="1"') +
          input("icl-premium", "Premium π (€)", 12, 'min="0" step="1"') +
          "</div>" +
          output("icl-output");
        const render = () => {
          const income = readNumber(node, "icl-income", 1, 1e9);
          const loss = readNumber(node, "icl-loss", 0, income - 0.0001);
          const p = readNumber(node, "icl-prob", 0, 100) / 100;
          const indemnity = readNumber(node, "icl-indemnity", 0, 1e12);
          const premium = readNumber(node, "icl-premium", 0, 1e12);
          const healthy = income - premium;
          const sick = income - premium - loss + indemnity;
          const classification = contractClass(p, loss, indemnity, premium);
          const validUtility = healthy >= 0 && sick >= 0;
          const eu = validUtility ? expectedUtility(p, healthy, sick) : NaN;
          const pricingClass = classification.pricing === "Fair" ? "is-good" : "is-warning";
          const coverageClass = classification.coverage === "Full" ? "is-good" : "";
          node.querySelector("#icl-output").innerHTML =
            stateBars(healthy, sick, Math.max(income, healthy, sick)) +
            `<div class="insurance-contract-labels"><span class="${pricingClass}">${escapeHtml(classification.pricing)}</span><span class="${coverageClass}">${escapeHtml(classification.coverage)} coverage</span></div>` +
            `<dl class="activity-stats"><div><dt>Expected insurer profit π−pI</dt><dd>€${fmt(classification.profit)}</dd></div><div><dt>Fair premium pI</dt><dd>€${fmt(p * indemnity)}</dd></div><div><dt>Healthy income</dt><dd>€${fmt(healthy)}</dd></div><div><dt>Sick income</dt><dd>€${fmt(sick)}</dd></div><div><dt>State-income gap</dt><dd>€${fmt(Math.abs(healthy - sick))}</dd></div><div><dt>Expected utility U(y)=√y</dt><dd>${validUtility ? fmt(eu, 4) : "Not defined for negative income"}</dd></div></dl>` +
            '<p>“Unfair” is the lecture’s technical expected-profit label. It is not a complete ethical assessment of a real insurer’s price structure.</p>';
        };
        node.querySelectorAll("input").forEach((control) => control.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("insurance-contract-compare", {
      title: "Compare two non-ideal contracts",
      intro:
        "Use the same explicit square-root utility assumption to compare a fuller, more expensive contract with a cheaper, more partial one. Change the numbers and watch the ranking reverse.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("icc-income", "Income y (€)", 100, 'min="1" step="1"') +
          input("icc-loss", "Medical loss M (€)", 60, 'min="0" step="1"') +
          input("icc-prob", "Sickness probability p (%)", 20, 'min="0" max="100" step="1"') +
          "</div>" +
          '<div class="grid2">' +
          '<div class="card"><p class="eyebrow">CONTRACT A</p>' +
          input("icc-a-i", "Indemnity Iₐ (€)", 60, 'min="0" step="1"') +
          input("icc-a-pi", "Premium πₐ (€)", 15, 'min="0" step="1"') +
          '</div><div class="card"><p class="eyebrow">CONTRACT B</p>' +
          input("icc-b-i", "Indemnity Iᵦ (€)", 40, 'min="0" step="1"') +
          input("icc-b-pi", "Premium πᵦ (€)", 8, 'min="0" step="1"') +
          "</div></div>" +
          output("icc-output");
        const calculate = (income, loss, p, indemnity, premium) => {
          const healthy = income - premium;
          const sick = income - premium - loss + indemnity;
          const classification = contractClass(p, loss, indemnity, premium);
          const utility = healthy >= 0 && sick >= 0 ? expectedUtility(p, healthy, sick) : NaN;
          return { healthy, sick, utility, classification };
        };
        const render = () => {
          const income = readNumber(node, "icc-income", 1, 1e9);
          const loss = readNumber(node, "icc-loss", 0, income - 0.0001);
          const p = readNumber(node, "icc-prob", 0, 100) / 100;
          const aResult = calculate(
            income,
            loss,
            p,
            readNumber(node, "icc-a-i", 0, 1e12),
            readNumber(node, "icc-a-pi", 0, 1e12),
          );
          const bResult = calculate(
            income,
            loss,
            p,
            readNumber(node, "icc-b-i", 0, 1e12),
            readNumber(node, "icc-b-pi", 0, 1e12),
          );
          let winner = "The two contracts produce the same expected utility under this teaching function.";
          if (Number.isFinite(aResult.utility) && Number.isFinite(bResult.utility)) {
            if (aResult.utility > bResult.utility + 1e-8) winner = "Contract A produces higher expected utility under U(y)=√y.";
            else if (bResult.utility > aResult.utility + 1e-8) winner = "Contract B produces higher expected utility under U(y)=√y.";
          } else {
            winner = "At least one contract produces negative state income, so square-root utility is not defined.";
          }
          node.querySelector("#icc-output").innerHTML =
            `<div class="insurance-comparison-winner"><strong>${escapeHtml(winner)}</strong></div>` +
            `<div class="table-scroll"><table><thead><tr><th>Contract</th><th>Pricing</th><th>Coverage</th><th>Healthy income</th><th>Sick income</th><th>Expected utility</th></tr></thead><tbody><tr><th>A</th><td>${escapeHtml(aResult.classification.pricing)}</td><td>${escapeHtml(aResult.classification.coverage)}</td><td>€${fmt(aResult.healthy)}</td><td>€${fmt(aResult.sick)}</td><td>${fmt(aResult.utility, 4)}</td></tr><tr><th>B</th><td>${escapeHtml(bResult.classification.pricing)}</td><td>${escapeHtml(bResult.classification.coverage)}</td><td>€${fmt(bResult.healthy)}</td><td>€${fmt(bResult.sick)}</td><td>${fmt(bResult.utility, 4)}</td></tr></tbody></table></div>` +
            '<p class="small muted">This numerical ranking depends on the chosen inputs and the explicit square-root utility assumption. It illustrates the lecture’s point that “fuller” and “fairer” do not by themselves rank every non-ideal contract.</p>';
        };
        node.querySelectorAll("input").forEach((control) => control.addEventListener("input", render));
        render();
      },
    });
  }

  registerActivities();

  function replaceText(rootNode) {
    if (!rootNode || !root.document?.createTreeWalker) return;
    const replacements = [
      ["Sessions 1–5 mock ready", "Sessions 1–6 mock ready"],
      ["current Sessions 1–5 question bank", "current Sessions 1–6 question bank"],
      ["Sessions 6–8", "Sessions 7–8"],
      ["Five sessions ready. Three clearly marked as upcoming.", "Six sessions ready. Two clearly marked as upcoming."],
      ["Demand for insurance, adverse selection and moral hazard are already placed in the roadmap.", "Adverse selection and moral hazard are already placed in the roadmap."],
      ["5 completed sessions", "6 completed sessions"],
      ["five sessions currently published", "six sessions currently published"],
      ["Balanced across the five sessions", "Balanced across the six sessions"],
      ["Sessions 1–5", "Sessions 1–6"],
      ["15 MCQs", "18 MCQs"],
      ["10 True / False", "12 True / False"],
      ["10 MCQs", "12 MCQs"],
      ["5 True / False", "6 True / False"],
      ["Sessions 6–8 are not included", "Sessions 7–8 are not included"],
    ];
    const walker = root.document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      let value = node.nodeValue;
      for (const [from, to] of replacements) value = value.split(from).join(to);
      if (value !== node.nodeValue) node.nodeValue = value;
    }
  }

  if (root.HealthEconManagement?.render && !root.HealthEconManagement.render.__fheSession6Wrapped) {
    const originalRender = root.HealthEconManagement.render;
    const wrappedRender = function (panel, tab, ctx) {
      const result = originalRender.call(this, panel, tab, ctx);
      replaceText(panel);
      return result;
    };
    wrappedRender.__fheSession6Wrapped = true;
    root.HealthEconManagement.render = wrappedRender;
  }

  const examHost = root.document?.getElementById("fhem-exam");
  if (examHost && root.MutationObserver) {
    const patch = () => replaceText(examHost);
    new MutationObserver(patch).observe(examHost, { childList: true, subtree: true, characterData: true });
    patch();
  }

  root.FHESession6 = {
    topicId: TOPIC_ID,
    activityIds: [...ACTIVITY_IDS],
    counts: {
      flashcards: flashcards.length,
      questions: questions.length,
      concepts: concepts.length,
    },
  };
})(window);
