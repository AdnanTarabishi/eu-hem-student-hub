// FHEM exam-eve extension: TA clarifications, final-review content and original practice.
(function (root) {
  "use strict";

  const COURSE_ID = "fund-health-econ-management";
  const MODULE_ID = "fund-health-economics";
  const T = {
    s1: "fund-health-economics.session-1",
    s2: "fund-health-economics.demand",
    s3: "fund-health-economics.health-capital",
    s4: "fund-health-economics.disparities",
    s5: "fund-health-economics.physician-agency",
    s6: "fund-health-economics.insurance-demand",
    s7: "fund-health-economics.adverse-selection",
    s8: "fund-health-economics.moral-hazard",
  };

  const flashcards = [
    { id: "fund-health-economics.fc.501", topic: T.s3, front: "In the Grossman model, what is the machine, what does it produce, and what are its inputs?", back: "Health stock H is the machine; it produces healthy days or productive time; medical care and the individual's own time are inputs used to repair or build it." },
    { id: "fund-health-economics.fc.502", topic: T.s3, front: "What are the stock, the flows and the hurdle in the Grossman model?", back: "H is the health stock. Gross investment I and healthy days are flows during a period. The hurdle is r+δ, the opportunity cost of funds plus health depreciation." },
    { id: "fund-health-economics.fc.503", topic: T.s3, front: "Why can net health investment be negative even though gross investment cannot?", back: "Net investment is I−δH. Gross investment I is non-negative, but depreciation δH can exceed it, causing health stock to fall." },
    { id: "fund-health-economics.fc.504", topic: T.s3, front: "What does the Grossman MEC curve represent—and what does it not represent?", back: "It is a menu of marginal returns associated with possible health stocks. It is not a time path showing one person's health moving through life." },
    { id: "fund-health-economics.fc.505", topic: T.s3, front: "Which variables move the MEC curve and which move the r+δ line?", back: "Wage, education and the price/productivity of health inputs move the return curve. Age through depreciation δ and the interest rate r move the hurdle line." },
    { id: "fund-health-economics.fc.506", topic: T.s3, front: "What is the exam-safe distinction between demand for health and demand for healthcare?", back: "Health is the desired output or stock; healthcare is one input. Wage clearly raises both in the lecture, while education and age have clear effects on H* but ambiguous effects on healthcare use." },
    { id: "fund-health-economics.fc.507", topic: T.s4, front: "If a chapter swaps the Greek letters δ and γ, how should you identify depreciation and discounting?", back: "Identify parameters by role, not by letter. Depreciation appears in the health-stock equation and in r+δ; the discount rate appears in preferences and weights future utility." },
    { id: "fund-health-economics.fc.508", topic: T.s4, front: "How does allostatic load enter the Grossman framework?", back: "Chronic stress raises the physical depreciation rate of health capital, increasing the hurdle and lowering optimal health." },
    { id: "fund-health-economics.fc.509", topic: T.s4, front: "How does the Fuchs hypothesis differ from the allostatic-load hypothesis?", back: "Fuchs uses time preference as a third factor affecting both education and health investment; allostatic load is a direct causal mechanism from chronic stress to faster health depreciation." },
    { id: "fund-health-economics.fc.510", topic: T.s4, front: "What is the safest way to structure a health-inequality open answer?", back: "Name the causal mechanism, explain the pathway to adult health, match a policy to that pathway, and acknowledge evidence or implementation limits." },
    { id: "fund-health-economics.fc.511", topic: T.s5, front: "After a physician fee cut, what is the substitution effect in the labour–leisure diagram?", back: "Leisure becomes cheaper in forgone income, so the physician takes more leisure and supplies fewer services." },
    { id: "fund-health-economics.fc.512", topic: T.s5, front: "After a physician fee cut, what is the income effect if leisure is a normal good?", back: "The physician is poorer and consumes less leisure, so work and service volume can increase." },
    { id: "fund-health-economics.fc.513", topic: T.s5, front: "Does a fee cut followed by more services prove physician-induced demand?", back: "No. The ordinary income effect alone can produce more work and services. PID requires evidence that the physician influenced demand against the physician's own assessment of the patient's interest." },
    { id: "fund-health-economics.fc.514", topic: T.s5, front: "Why is the net service response to a fee cut theoretically ambiguous?", back: "The substitution effect pushes work down, while the income effect can push work up. Their relative size is an empirical question." },
    { id: "fund-health-economics.fc.515", topic: T.s2, front: "What does inelastic healthcare demand mean—and what does it not mean?", back: "Quantity responds proportionally less than price. It does not mean quantity is completely unresponsive or that price has no causal effect." },
    { id: "fund-health-economics.fc.516", topic: T.s6, front: "Why can a risk-averse person reject a fair gamble but buy fair insurance?", back: "The gamble adds dispersion to certain income; insurance removes dispersion from an already risky income distribution." },
    { id: "fund-health-economics.fc.517", topic: T.s7, front: "What four checks are required before calling an insurance allocation an equilibrium?", back: "Participation, incentive compatibility, insurer break-even and absence of a profitable entrant deviation." },
    { id: "fund-health-economics.fc.518", topic: T.s8, front: "What is the central second-best trade-off in moral hazard?", back: "More complete insurance improves risk spreading but lowers the price faced by patients and can increase inefficient utilisation; cost sharing improves incentives but increases financial and access risk." },
    { id: "fund-health-economics.fc.519", topic: T.s8, front: "Why can high elasticity be a misleading reason for high cost sharing?", back: "Demand may be elastic because patients undervalue or misunderstand high-value care. VBID uses clinical value, not elasticity alone, to set cost sharing." },
    { id: "fund-health-economics.fc.520", topic: T.s1, front: "What is the recurring exam logic across the whole course?", back: "Identify the market or information failure, trace the causal mechanism, state the incentive response, discuss efficiency/equity trade-offs and recommend a targeted policy rather than a universal slogan." },
  ];

  const questions = [
    { id: "fund-health-economics.q.501", topic: T.s3, type: "mcq", difficulty: "hard", category: "Grossman stocks and flows", source: "EU-HEM Hub original practice · Exam-eve review", question: "Which classification is fully correct in the Grossman model?", options: ["Health H is a flow; healthy days are a stock; I is a hurdle", "Health H is a stock; healthy days and gross investment I are flows; r+δ is the hurdle", "Health H and I are both stocks; δ is a flow", "Healthy days are the capital stock and H is its price"], answer: "B", explanation: "The TA review stresses that many mistakes come from confusing the health stock with flows produced or added during a period." },
    { id: "fund-health-economics.q.502", topic: T.s3, type: "mcq", difficulty: "hard", category: "Grossman PPF", source: "EU-HEM Hub original practice · Exam-eve review", question: "Why must an optimum for someone valuing both H and Z lie on the downward-sloping part of the Grossman frontier rather than before the peak?", options: ["Before the peak, both H and Z can still be increased together", "The free-lunch region has no scarce inputs", "The individual is dead at every point before the peak", "Indifference curves are vertical in the free-lunch zone"], answer: "A", explanation: "An allocation before the peak is dominated: moving toward the peak can raise health and the home good simultaneously." },
    { id: "fund-health-economics.q.503", topic: T.s3, type: "mcq", difficulty: "hard", category: "Grossman comparative statics", source: "EU-HEM Hub original practice · Exam-eve review", question: "Which change most directly shifts the horizontal user-cost line upward rather than shifting the MEC curve?", options: ["A higher wage", "More education", "A higher depreciation rate with age", "A lower price of medical care"], answer: "C", explanation: "Ageing raises δ, so r+δ rises. Wage, education and input prices affect the return/production side." },
    { id: "fund-health-economics.q.504", topic: T.s3, type: "short-answer", difficulty: "hard", category: "Grossman synthesis", source: "EU-HEM Hub original practice · Exam-eve review", question: "Explain the Grossman model in five connected steps without algebra.", answer: "Health is a stock that depreciates and can be repaired. The stock produces healthy days, which expand the time available for work, health production and other activities. At low health, an improvement can increase both health and other consumption because it releases much sick time; after the frontier's peak, a genuine trade-off appears. The desired stock is where the marginal return to health equals the hurdle r+δ. Comparative statics work by shifting either the return curve or the hurdle line, and demand for health must be distinguished from demand for healthcare inputs.", explanation: "A strong answer connects stock, healthy-time flow, the bent frontier, the MEC rule and comparative statics." },
    { id: "fund-health-economics.q.505", topic: T.s4, type: "mcq", difficulty: "hard", category: "Parameter identification", source: "EU-HEM Hub original practice · Exam-eve review", question: "A textbook uses γ in Ht=(1−γ)Ht−1+It−1 and δ in a utility discount factor. Which interpretation is correct?", options: ["γ is depreciation and δ is discounting because roles—not letters—identify the parameters", "δ must always be depreciation by convention", "Both are depreciation", "Both are discount rates"], answer: "A", explanation: "Notation can change across chapters. Identify depreciation from the health-stock constraint and discounting from preferences." },
    { id: "fund-health-economics.q.506", topic: T.s4, type: "mcq", difficulty: "hard", category: "Allostatic load vs Fuchs", source: "EU-HEM Hub original practice · Exam-eve review", question: "Which answer most accurately distinguishes allostatic load from the Fuchs hypothesis?", options: ["Both are reverse-causality theories", "Allostatic load raises physical health depreciation; Fuchs uses time preference as a common determinant of education and health investment", "Fuchs raises physical depreciation; allostatic load changes only income", "Both assert that education directly causes all health differences"], answer: "B", explanation: "The hypotheses move different parameters and imply different causal stories and policies." },
    { id: "fund-health-economics.q.507", topic: T.s4, type: "short-answer", difficulty: "hard", category: "Health inequality policy", source: "EU-HEM Hub original practice · Exam-eve review", question: "Build a three-mechanism explanation for why low-income childhood can predict poorer adult health, and match one policy to each mechanism.", answer: "Use early-life biological programming such as the thrifty-phenotype mechanism and match it to maternal nutrition and early-childhood support; use the direct-income channel for children's housing, food and healthcare and match it to targeted family income support; use the efficient-producer mechanism and match it to education, health literacy and simplified self-management. A strong answer explains each pathway before naming the policy and notes that no single theory explains every gradient.", explanation: "The mock-answer pattern rewards mechanism→consequence→policy links rather than a list of labels." },
    { id: "fund-health-economics.q.508", topic: T.s5, type: "mcq", difficulty: "hard", category: "Fee cut decomposition", source: "EU-HEM Hub original practice · Exam-eve review", question: "A physician fee falls and the physician supplies more services. What is the most defensible conclusion?", options: ["This proves physician-induced demand", "The income effect may have dominated the substitution effect; the observation alone does not identify inducement", "The substitution effect must increase service volume", "Professional ethics are absent"], answer: "B", explanation: "A fee cut makes leisure cheaper, pushing work down, but also makes the physician poorer, potentially pushing work up. More services are not proof of PID." },
    { id: "fund-health-economics.q.509", topic: T.s5, type: "mcq", difficulty: "hard", category: "Labour-leisure response", source: "EU-HEM Hub original practice · Exam-eve review", question: "After a fee cut, which pair of effects is correctly signed when leisure is a normal good?", options: ["Substitution: less leisure/more work; income: more leisure/less work", "Substitution: more leisure/less work; income: less leisure/more work", "Both imply more work", "Both imply less work"], answer: "B", explanation: "The two effects oppose each other, so theory alone does not determine the net service response." },
    { id: "fund-health-economics.q.510", topic: T.s5, type: "short-answer", difficulty: "hard", category: "Identification of PID", source: "EU-HEM Hub original practice · Exam-eve review", question: "Why is an increase in service volume after a fee reduction not sufficient evidence of physician-induced demand?", answer: "A fee reduction changes the ordinary labour–leisure choice. The substitution effect makes leisure cheaper and tends to reduce work, while the income effect makes the physician poorer and can increase work if leisure is normal. If the income effect dominates, service volume can rise even without manipulation of patient demand. Evidence of PID must identify physician influence on demand against the physician's assessment of the patient's interest rather than infer it from volume alone.", explanation: "Separate an ordinary labour-supply response from the agency mechanism that defines PID." },
    { id: "fund-health-economics.q.511", topic: T.s2, type: "true-false", difficulty: "medium", category: "Elasticity", source: "EU-HEM Hub original practice · Exam-eve review", question: "Because healthcare demand is generally inelastic, an increase in the patient price has no effect on utilisation.", answer: false, explanation: "Inelastic means a smaller proportional quantity response, not zero response." },
    { id: "fund-health-economics.q.512", topic: T.s3, type: "true-false", difficulty: "medium", category: "MEC interpretation", source: "EU-HEM Hub original practice · Exam-eve review", question: "The Grossman MEC curve should be read as the individual's health trajectory through age.", answer: false, explanation: "It is a schedule of marginal returns associated with possible health stocks, not a time path." },
    { id: "fund-health-economics.q.513", topic: T.s4, type: "true-false", difficulty: "medium", category: "Fuchs", source: "EU-HEM Hub original practice · Exam-eve review", question: "The Fuchs hypothesis is a third-factor explanation in which willingness to delay gratification can affect both schooling and health investment.", answer: true, explanation: "That common preference can generate a positive education–health association without education being the only direct cause." },
    { id: "fund-health-economics.q.514", topic: T.s5, type: "true-false", difficulty: "hard", category: "Fee response", source: "EU-HEM Hub original practice · Exam-eve review", question: "If a fee cut is followed by higher physician service volume, physician-induced demand has been demonstrated.", answer: false, explanation: "An income effect in ordinary labour supply can produce the same observation." },
    { id: "fund-health-economics.q.515", topic: T.s6, type: "mcq", difficulty: "hard", category: "Fair vs full", source: "EU-HEM Hub original practice · Exam-eve review", question: "Which statement is fully correct?", options: ["A full contract is necessarily actuarially fair", "A fair contract necessarily provides full coverage", "Full/partial describes indemnity size, while fair/unfair compares premium with expected payout", "Risk aversion implies full insurance at any premium"], answer: "C", explanation: "The two classifications describe different contract dimensions." },
    { id: "fund-health-economics.q.516", topic: T.s7, type: "mcq", difficulty: "hard", category: "Rothschild–Stiglitz", source: "EU-HEM Hub original practice · Exam-eve review", question: "In the standard separating outcome, why is the low-risk contract partial?", options: ["Low risks dislike insurance", "Coverage is restricted to keep high risks from imitating the low-risk contract", "Low risks have higher expected cost", "The insurer is prohibited from breaking even"], answer: "B", explanation: "Partial coverage is the informational cost of incentive compatibility, not a statement that low risks want little insurance." },
    { id: "fund-health-economics.q.517", topic: T.s8, type: "mcq", difficulty: "hard", category: "VBID", source: "EU-HEM Hub original practice · Exam-eve review", question: "Why can uniform high cost sharing for preventive care be inefficient even when preventive demand is price elastic?", options: ["Elasticity proves the care has low value", "Patients may underestimate benefits, so cost sharing can discourage high-value care; VBID uses clinical value as well as behavioural response", "Preventive care has no effect on future treatment", "Moral hazard cannot occur in preventive care"], answer: "B", explanation: "Responsiveness to price does not reveal the clinical value of the services forgone." },
    { id: "fund-health-economics.q.518", topic: T.s8, type: "short-answer", difficulty: "hard", category: "Integrated policy", source: "EU-HEM Hub original practice · Exam-eve review", question: "Explain why a health system may need both demand-side and supply-side controls rather than relying only on patient cost sharing.", answer: "Patient cost sharing can reduce utilisation by raising the patient price, but it exposes patients to financial risk and may deter high-value care because patients are imperfectly informed. Providers also influence treatment choices and may respond to fee-for-service incentives. Supply-side tools—payment reform, selective contracting, utilisation review, gatekeeping and quality monitoring—target provider-driven volume and prices. A combined design can protect high-value care through VBID while constraining low-value patient- and provider-driven use, but it must monitor underprovision, access and quality.", explanation: "A strong answer connects the source of waste to the side of the market being targeted." },
  ];

  const concepts = [
    { id: "concept.grossman-stock-flow-hurdle", term: "Grossman stock–flow–hurdle distinction", explanation: "H is the health stock; gross investment and healthy days are flows; r+δ is the user-cost hurdle that marginal returns must meet.", topics: [T.s3] },
    { id: "concept.mec-schedule-not-path", term: "MEC schedule, not life path", explanation: "The marginal-efficiency curve compares returns across possible health stocks at a point in the model; it is not a trajectory through age.", topics: [T.s3] },
    { id: "concept.parameter-by-role", term: "Identify parameters by role", explanation: "When notation changes, locate depreciation in the health-stock equation and user cost, and locate discounting in preferences over future utility.", topics: [T.s3, T.s4] },
    { id: "concept.allostatic-depreciation", term: "Allostatic depreciation channel", explanation: "Chronic stress damages health by raising the physical depreciation rate of health capital.", topics: [T.s4] },
    { id: "concept.fee-cut-substitution-effect", term: "Fee-cut substitution effect", explanation: "A lower service fee makes leisure cheaper in forgone income, pushing the physician toward more leisure and less work.", topics: [T.s5] },
    { id: "concept.fee-cut-income-effect", term: "Fee-cut income effect", explanation: "A lower service fee makes the physician poorer; if leisure is normal, the physician may reduce leisure and work more.", topics: [T.s5] },
    { id: "concept.volume-not-proof-of-pid", term: "Volume response is not proof of PID", explanation: "A rise in services after a fee cut can arise from an ordinary income effect; identifying PID requires evidence about physician influence on patient demand.", topics: [T.s5] },
    { id: "concept.exam-mechanism-policy-chain", term: "Mechanism-to-policy exam chain", explanation: "A strong open answer defines the failure, traces the causal mechanism, applies it to the scenario, weighs trade-offs and recommends a targeted policy.", topics: [T.s1, T.s4, T.s5, T.s6, T.s7, T.s8] },
  ];

  const resources = [
    { id: "fund-health-economics.r.501", title: "FHEM Final Review — exam-eve workspace", type: "Study guide", url: "fhem-final-review.html", date: "2026-10-26", topic: T.s1, description: "High-yield review of all eight sessions, formulas, common traps, TA clarifications, rapid recall and exam-writing structure." },
  ];

  const sessionReviews = [
    { number: 1, topic: T.s1, title: "Healthcare economy", summary: "Why healthcare markets differ, how financing intermediates risk and why uncertainty, information and equity matter.", points: ["Per-capita spending reflects income and the share of GDP devoted to healthcare.", "Financial intermediation separates payment from the point of use and pools risk.", "The core triad is patient, provider and payer, each with distinct incentives."], trap: "Do not treat more spending as proof of more health or higher productivity." },
    { number: 2, topic: T.s2, title: "Healthcare demand", summary: "Demand, elasticity, causal identification, full price and insurance-induced price changes.", points: ["Own-price change moves along demand; health, income and related-service prices shift it.", "Healthcare demand is downward sloping and generally inelastic—not perfectly inelastic.", "Observed insurance–utilisation associations can reflect selection and confounding."], trap: "A zero copayment does not make the full price zero; time and travel remain." },
    { number: 3, topic: T.s3, title: "Health capital", summary: "Health as a depreciating stock that produces healthy time; the bent PPF and MEC rule.", points: ["Stock equation: Ht=(1−δ)Ht−1+It−1.", "At low H, health and Z can rise together; after the peak, a true trade-off appears.", "Choose H* where MEC=r+δ and distinguish health demand from healthcare demand."], trap: "The MEC curve is not a life-course path, and positive gross investment does not guarantee positive net investment." },
    { number: 4, topic: T.s4, title: "Health disparities", summary: "Direct causality, reverse causality and common-factor explanations of the SES–health gradient.", points: ["Efficient producer: education improves health-production efficiency.", "Allostatic load raises depreciation; Fuchs changes time preference.", "Productive time reverses the arrow from health to income and SES."], trap: "Identify Greek parameters by their role, not by assuming δ or γ always means the same thing." },
    { number: 5, topic: T.s5, title: "Physician agency", summary: "Information asymmetry, PID, payment incentives, income/substitution effects and practice variation.", points: ["PID is influence against the physician's own view of the patient's best interest.", "After a fee cut, substitution reduces work while the income effect can increase it.", "FFS strengthens marginal volume incentives; capitation and salary shift other risks."], trap: "More services after a fee cut do not prove PID; ordinary labour-supply effects can explain the observation." },
    { number: 6, topic: T.s6, title: "Insurance demand", summary: "Risk aversion, fair indemnity, state incomes, insurer break-even and fair/full distinctions.", points: ["Risk-averse people dislike dispersion because utility is concave.", "At a fair premium π=pI, the benchmark optimum equalises state income and gives I=M.", "Insurer expected profit is π−pI."], trap: "Full versus partial concerns I; fair versus unfair concerns π relative to expected payout." },
    { number: 7, topic: T.s7, title: "Adverse selection", summary: "Hidden risk types, pooling, cream-skimming, separating equilibrium, government intervention and premium risk.", points: ["Pooling premium uses the population-average risk and transfers from L to H.", "Pooling can unravel through a profitable low-risk deviation.", "Separation gives H full insurance and rations L to partial coverage."], trap: "Population break-even does not mean type-specific fairness, and separation is not first best." },
    { number: 8, topic: T.s8, title: "Moral hazard & managed care", summary: "Ex-ante and ex-post responses, cost sharing, VBID, provider controls and managed-care organisations.", points: ["Expected loss is p(eP)×L(eL): prevention changes p, loss reduction changes L.", "Insurance trades risk spreading against incentives; elasticity and price distortion affect DWL.", "Managed care combines networks, payment, utilisation review and commitment devices."], trap: "High price elasticity does not automatically mean low-value care; patient knowledge and clinical value matter." },
  ];

  const formulas = [
    ["Healthcare demand", "ε = %ΔQ / %ΔP", "Use the absolute value to classify elastic versus inelastic demand."],
    ["Grossman stock", "Ht = (1−δt)Ht−1 + It−1", "Net investment is I−δH and can be negative."],
    ["Grossman optimum", "MEC(H*) = r + δ", "Invest while marginal return exceeds the hurdle."],
    ["Fair insurance", "π = pI", "Premium equals expected indemnity payout in the competitive benchmark."],
    ["State incomes", "yh=y−π; ys=y−π−M+I", "Full fair insurance equalises the two states when I=M."],
    ["Insurer profit", "E[Π] = π−pI", "Zero for an actuarially fair contract."],
    ["Pooling risk", "p̄ = λpL+(1−λ)pH", "Used to price a contract selected by both risk types."],
    ["Pooling premium", "πP = p̄I", "Breaks even for the population, not each type."],
    ["Zero-profit slope", "−(1−p)/p", "Higher-risk lines are flatter in contract space."],
    ["Expected loss", "E[L] = p(eP)×L(eL)", "Ex-ante effort affects probability; ex-post effort affects loss size."],
  ];

  const distinctions = [
    ["Health vs healthcare", "Desired stock/output versus one input used to produce it."],
    ["Stock vs flow", "H at a point in time versus investment and healthy days during a period."],
    ["Depreciation vs discounting", "Physical wear in the stock equation versus preference weight on the future."],
    ["Own-price movement vs demand shift", "Movement along the curve versus a change in another determinant."],
    ["Inelastic vs perfectly inelastic", "Small proportional response versus no response."],
    ["Direct vs reverse causality", "SES→health versus health→SES."],
    ["Allostatic load vs Fuchs", "Stress raises depreciation versus time preference affects both investments."],
    ["Due influence vs PID", "Advice in the patient's interest versus manipulation against that interest."],
    ["Income vs substitution effect", "Lower income may raise work; lower marginal return makes leisure cheaper and lowers work."],
    ["Fair vs full insurance", "Premium pricing versus indemnity size."],
    ["Adverse selection vs moral hazard", "Hidden type before contracting versus behaviour/use changing after coverage."],
    ["Pooling vs separating", "One shared contract versus type-revealing contract choices."],
    ["Medical-cost risk vs premium risk", "Current treatment spending versus future reclassification and premiums."],
    ["Demand-side vs supply-side control", "Patient price/quantity incentives versus provider payment, networks and review."],
    ["PPO vs HMO", "Tiered network without gatekeeper versus tightly managed network with gatekeeping."],
  ];

  const rapidRecall = [
    [T.s1, "Why does a higher share of GDP devoted to health raise per-capita spending among similarly wealthy countries?", "Per-capita health spending is approximately GDP per capita multiplied by the healthcare share of GDP; holding income similar, a larger share implies more spending per person."],
    [T.s2, "Why does generous insurance plus higher use not identify a causal effect?", "People expecting greater needs can select generous coverage, and health status can influence both plan choice and utilisation."],
    [T.s2, "What is the full price of a visit?", "The money price plus travel costs and the opportunity cost of time spent travelling, waiting and receiving care."],
    [T.s3, "Name the machine, its output and the hurdle in Grossman.", "Health stock H; healthy/productive time; r+δ."],
    [T.s3, "Why does the Grossman frontier bend?", "At low health, improvements release enough sick time to raise H and Z together; later, diminishing time gains create a real resource trade-off."],
    [T.s3, "What moves the MEC curve and what moves the line?", "Wage, education and care price/productivity move the curve; r and age-related δ move the line."],
    [T.s4, "How do you distinguish depreciation from discounting when letters change?", "Depreciation appears in Ht=(1−rate)Ht−1+I and r+rate; discounting appears in preferences over future utility."],
    [T.s4, "Give one direct, one reverse and one third-factor mechanism.", "Direct: allostatic load or efficient production. Reverse: productive time. Third factor: Fuchs/time preference."],
    [T.s5, "Define physician-induced demand precisely.", "Physician influence on patient demand against the physician's own assessment of the patient's best interest."],
    [T.s5, "What are the two effects of a fee cut?", "Substitution: leisure cheaper, work less. Income: poorer, consume less leisure, work more. Net effect is ambiguous."],
    [T.s6, "Why is fair full insurance optimal in the simple benchmark?", "At π=pI, risk aversion makes the individual equalise healthy- and sick-state income, requiring I=M."],
    [T.s6, "Can an insurance contract be full but unfair?", "Yes. Full means I=M; unfair means π>pI in the simplified model."],
    [T.s7, "Why does pooling redistribute?", "The average premium exceeds expected cost for L and is below expected cost for H."],
    [T.s7, "Why is the L contract partial in separation?", "Coverage must be restricted enough that H does not imitate it."],
    [T.s8, "Distinguish ex-ante and ex-post moral hazard.", "Ex ante changes the probability of illness through prevention; ex post changes the size or cost of care after illness."],
    [T.s8, "Why is VBID different from uniform cost sharing?", "VBID lowers cost sharing for high-value services and raises it for lower-value services rather than treating all price-responsive care alike."],
    [T.s8, "Why can managed care improve expected utility despite restricting choice?", "Consumers can precommit ex ante to networks and provider controls that reduce future overuse and premiums."],
    [T.s8, "What four mechanisms can lower managed-care expenditure?", "Negotiated prices, lower quantities through review, lower quality/cost combinations and slower technology adoption."],
  ].map(([topic, question, answer], index) => ({ id: `fhem-eve-r${String(index + 1).padStart(2, "0")}`, topic, question, answer }));

  const checklist = [
    "I can reproduce the exam scoring: +5/+2/−1 for MCQ and +8/−2 for Binary.",
    "I can explain all eight sessions in two minutes each.",
    "I can distinguish health from healthcare and stock from flow.",
    "I can derive or interpret Ht=(1−δ)Ht−1+I and MEC=r+δ.",
    "I can identify depreciation and discounting by role even if symbols change.",
    "I can decompose a physician fee cut into income and substitution effects.",
    "I can distinguish fair/full insurance, adverse selection and moral hazard.",
    "I can explain pooling, cream-skimming and the separating allocation.",
    "I can explain risk-spreading versus incentive trade-offs and VBID.",
    "I can compare FFS, capitation, salary, PPO, POS and HMO incentives.",
    "I can write an open answer as mechanism → application → trade-off → policy.",
    "I have completed at least one 90-minute exam-style mock under closed-book conditions.",
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
  if (typeof originalLoadAll === "function" && !originalLoadAll.__fhemExamEveWrapped) {
    const wrapped = async function (...args) {
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
    wrapped.__fhemExamEveWrapped = true;
    root.loadAll = wrapped;
  }

  const option = (id, text, score, feedback) => ({ id, text, score, feedback });
  const examMcqs = [
    { id: "fhem-eve-m01", topic: T.s3, type: "exam-mcq", category: "Grossman stock-flow logic", prompt: "Which statement most completely describes the Grossman model?", maxScore: 5, blankScore: 0, options: [option("A", "Health is a flow purchased directly through healthcare.", -1, "Health is modelled as a stock; healthcare is an input."), option("B", "Health is a depreciating stock that produces healthy time; investment repairs it and the desired stock balances marginal return against r+δ.", 5, "This combines the stock, flow, investment and decision-rule elements."), option("C", "Health produces healthy days.", 2, "Correct but incomplete."), option("D", "The desired health stock is where gross investment equals zero.", -1, "The decision rule compares MEC with r+δ."), option("E", "Age moves only the MEC curve.", -1, "Age raises depreciation and therefore the hurdle line in the lecture framing.")], tags: ["TA review", "Grossman"] },
    { id: "fhem-eve-m02", topic: T.s3, type: "exam-mcq", category: "Health vs healthcare", prompt: "Education rises. Which answer is most complete?", maxScore: 5, blankScore: 0, options: [option("A", "Optimal health rises because health production becomes more efficient, while healthcare demand is ambiguous.", 5, "This distinguishes the output from the input."), option("B", "Optimal health rises.", 2, "Correct but incomplete."), option("C", "Healthcare demand must rise.", -1, "Efficiency can reduce input needs per unit of health."), option("D", "Both health and healthcare demand fall.", -1, "Not the lecture prediction."), option("E", "Education affects preferences only.", -1, "The efficient-producer channel is central.")], tags: ["Grossman", "comparative statics"] },
    { id: "fhem-eve-m03", topic: T.s4, type: "exam-mcq", category: "Allostatic load and Fuchs", prompt: "A chapter swaps the symbols used for depreciation and discounting. Which answer is most appropriate?", maxScore: 5, blankScore: 0, options: [option("A", "Assume δ always means depreciation.", -1, "Notation is not stable across chapters."), option("B", "Identify depreciation from the health-stock constraint and user cost, and discounting from intertemporal preferences.", 5, "Role, not letter, identifies the parameter."), option("C", "Allostatic load and Fuchs move the same parameter.", -1, "They are distinct mechanisms."), option("D", "Allostatic load raises physical depreciation.", 2, "Correct but it does not answer the notation problem fully."), option("E", "Fuchs concerns income only.", -1, "Fuchs concerns time preference.")], tags: ["TA review", "notation"] },
    { id: "fhem-eve-m04", topic: T.s5, type: "exam-mcq", category: "Fee cut", prompt: "A physician fee cut is followed by more services. Which conclusion is fully correct?", maxScore: 5, blankScore: 0, options: [option("A", "Physician-induced demand has been proven.", -1, "Volume alone does not identify inducement."), option("B", "The income effect may dominate the substitution effect, so ordinary labour supply can explain more services without proving PID.", 5, "This is the complete identification warning."), option("C", "The income effect can increase work.", 2, "Correct but incomplete."), option("D", "The substitution effect increases work.", -1, "A lower fee makes leisure cheaper and pushes work down."), option("E", "The response is theoretically unambiguous.", -1, "The two effects oppose each other.")], tags: ["TA review", "physician"] },
    { id: "fhem-eve-m05", topic: T.s6, type: "exam-mcq", category: "Insurance classification", prompt: "Which contract description is logically possible?", maxScore: 5, blankScore: 0, options: [option("A", "Full but actuarially unfair.", 5, "I can equal M while π exceeds pI."), option("B", "Fair implies full.", -1, "Fair pricing does not determine coverage quantity."), option("C", "Full implies fair.", -1, "Coverage quantity does not determine premium loading."), option("D", "Risk aversion makes any full contract optimal.", -1, "Price matters."), option("E", "A partial fair contract cannot exist.", -1, "It can exist whenever I<M and π=pI.")], tags: ["fair", "full"] },
    { id: "fhem-eve-m06", topic: T.s7, type: "exam-mcq", category: "Separating equilibrium", prompt: "In the Rothschild–Stiglitz separating allocation, why does L receive partial insurance?", maxScore: 5, blankScore: 0, options: [option("A", "L dislikes insurance.", -1, "Risk aversion still creates demand for coverage."), option("B", "Partial coverage is needed to make the L contract unattractive to H.", 5, "This is the incentive-compatibility distortion."), option("C", "L has a higher sickness probability.", -1, "L is the low-risk type."), option("D", "The market bans full coverage for everyone.", -1, "H receives fair full coverage in the standard result."), option("E", "L's premium is actuarially unfair.", 2, "The contract can be fair for L but still partial; this option confuses pricing with quantity.")], tags: ["separation", "rationing"] },
    { id: "fhem-eve-m07", topic: T.s8, type: "exam-mcq", category: "Moral hazard policy", prompt: "Which policy conclusion is most complete when patients are price responsive but may undervalue preventive care?", maxScore: 5, blankScore: 0, options: [option("A", "Apply high coinsurance to all elastic services.", -1, "Elasticity alone does not reveal clinical value."), option("B", "Use value-based cost sharing and provider-side controls, protecting high-value care while targeting low-value use.", 5, "This integrates information, value and both sides of the market."), option("C", "Lower cost sharing for high-value preventive care.", 2, "Correct but incomplete because provider incentives and low-value care are omitted."), option("D", "Eliminate insurance.", -1, "That sacrifices financial protection."), option("E", "Use FFS without review.", -1, "That can strengthen provider-driven volume incentives.")], tags: ["VBID", "managed care"] },
    { id: "fhem-eve-m08", topic: T.s2, type: "exam-mcq", category: "Causal identification", prompt: "A dataset shows generous coverage, worse baseline health and higher utilisation. Which statement is most complete?", maxScore: 5, blankScore: 0, options: [option("A", "Generous insurance necessarily causes all additional use.", -1, "Selection and confounding remain."), option("B", "Expected need and health status can affect plan choice and use, so causal identification needs exogenous or random variation.", 5, "This states the problem and the remedy."), option("C", "Health status is a possible confounder.", 2, "Correct but incomplete."), option("D", "Insurance makes demand perfectly inelastic.", -1, "Not supported."), option("E", "Utilisation cannot be studied empirically.", -1, "The challenge is identification, not impossibility.")], tags: ["causality", "insurance"] },
  ];

  const examBinaries = [
    { id: "fhem-eve-b01", topic: T.s3, type: "exam-binary", category: "Grossman MEC", prompt: "The Grossman MEC curve traces one person's health stock as the person ages.", maxScore: 8, blankScore: 0, options: [option("1", "True", -2, "It is a schedule of marginal returns across possible stocks."), option("2", "False", 8, "Correct: it is not a life path.")], tags: ["TA review"] },
    { id: "fhem-eve-b02", topic: T.s4, type: "exam-binary", category: "Notation", prompt: "If a text uses γ in the health-stock equation, γ should be interpreted as depreciation even if another chapter used δ for depreciation.", maxScore: 8, blankScore: 0, options: [option("1", "True", 8, "Correct: identify the parameter by its role in the equation."), option("2", "False", -2, "The letter itself is not the reliable guide.")], tags: ["TA review"] },
    { id: "fhem-eve-b03", topic: T.s5, type: "exam-binary", category: "Fee response", prompt: "A fee cut followed by more physician services is sufficient evidence of physician-induced demand.", maxScore: 8, blankScore: 0, options: [option("1", "True", -2, "The income effect can produce more work without inducement."), option("2", "False", 8, "Correct: volume alone does not identify the agency mechanism.")], tags: ["TA review"] },
    { id: "fhem-eve-b04", topic: T.s8, type: "exam-binary", category: "VBID", prompt: "A highly price-elastic service should always face high cost sharing, irrespective of its clinical value.", maxScore: 8, blankScore: 0, options: [option("1", "True", -2, "This ignores imperfect information and high-value care."), option("2", "False", 8, "Correct: VBID combines behavioural response with clinical value.")], tags: ["moral hazard"] },
  ];

  const commonRubric = [
    { id: "concepts", label: "Correct economic concepts", max: 15 },
    { id: "mechanisms", label: "Causal mechanisms", max: 12 },
    { id: "application", label: "Application to the scenario", max: 10 },
    { id: "tradeoffs", label: "Trade-offs and unintended effects", max: 8 },
    { id: "policy", label: "Policy recommendations", max: 10 },
    { id: "structure", label: "Structure and conclusion", max: 5 },
  ];

  const examOpens = [
    { id: "fhem-eve-o01", type: "exam-open", title: "Exam-Eve Integrated Policy Case", scenario: "The government of MEDLAND offers universal coverage with almost no patient cost sharing. Most physicians are paid fee-for-service. Spending and specialist use are rising, regional treatment rates vary widely, preventive services remain underused in low-income groups, and insurers report that high-risk people struggle to afford supplementary coverage.", tasks: ["Diagnose the demand-side, provider-side, equity and insurance-market mechanisms.", "Explain which observations are causal claims and which require better identification.", "Propose a coherent reform package using concepts from Sessions 1–8.", "Discuss financial protection, access, quality, selection and innovation trade-offs."], relatedTopics: [T.s2, T.s4, T.s5, T.s6, T.s7, T.s8], maxScore: 60, recommendedMinutes: 55, rubric: commonRubric, modelOutline: ["Begin with strengths: universal pooling improves risk sharing and limits adverse selection in basic coverage.", "Diagnose demand-side moral hazard from near-zero patient price but avoid assuming all extra care is waste.", "Diagnose provider-side volume incentives and possible PID/practice-style variation under FFS.", "Explain why low preventive use can coexist with overuse elsewhere: information, income and value differ across services.", "Use VBID to protect high-value preventive and chronic care, while applying targeted cost sharing to lower-value elastic care.", "Replace pure FFS with a blended/two-part payment and add utilisation review, quality monitoring and selective contracting.", "Protect high-risk affordability through compulsory pooling, risk adjustment or durable cross-subsidy rather than relying only on supplementary markets.", "Conclude with evaluation metrics: utilisation by value, outcomes, equity, provider quality and technology adoption."], commonMisses: ["Calling every increase in use moral hazard or waste", "Treating fee-cut volume as automatic proof of PID", "Ignoring adverse selection and premium risk", "Recommending uniform cost sharing without VBID", "Omitting underprovision and quality risks"], tags: ["integrated", "final review"] },
    { id: "fhem-eve-o02", type: "exam-open", title: "Grossman, Inequality and Provider Incentives", scenario: "A region has an ageing population, large education-related health gaps and a shortage of primary-care physicians. The payer considers raising service fees, expanding health-literacy programmes and increasing copayments to control expenditure.", tasks: ["Use the Grossman model to predict effects of ageing, education and care prices on health and healthcare demand.", "Explain at least three causal interpretations of the education–health gradient.", "Analyse how higher physician fees may affect service volume and whether volume changes identify PID.", "Evaluate the proposed policies and recommend a better package."], relatedTopics: [T.s3, T.s4, T.s5, T.s8], maxScore: 60, recommendedMinutes: 55, rubric: commonRubric, modelOutline: ["Ageing raises depreciation and lowers desired H, but healthcare demand is ambiguous because maintaining health becomes harder.", "Education raises health-production efficiency and H*, while healthcare input demand is ambiguous.", "A lower care price raises desired health and care use; higher copayments can reduce use but may deter high-value care.", "Discuss efficient-producer, direct-income/early-life, allostatic-load, productive-time and Fuchs mechanisms as distinct causal stories.", "A fee increase changes both substitution and income effects in reverse directions; observed volume alone does not identify PID.", "Recommend targeted workforce/payment reform, education and early-life support, VBID rather than uniform copayments, and monitoring of access and quality."], commonMisses: ["Confusing health demand with healthcare demand", "Treating all education effects as direct causality", "Ignoring the two labour–leisure effects", "Using higher copayments as the only cost-control tool"], tags: ["Grossman", "inequality", "provider payment"] },
  ];

  function extendExamStyleBank() {
    const bank = root.FHEMExamStyleBank;
    if (!bank || bank.__examEveExtended) return;
    appendUnique(bank.mcqs, examMcqs);
    appendUnique(bank.binaries, examBinaries);
    appendUnique(bank.opens, examOpens);
    if (!bank.fixedMocks.some((mock) => mock.id === "mock-5")) {
      bank.fixedMocks.push({ id: "mock-5", title: "Mock Exam 5", subtitle: "Final review: Grossman, inequality, provider incentives and insurance", description: "An original exam-eve paper built around the TA clarifications and the course-wide mechanisms most likely to be confused.", mcqIds: ["fhem-eve-m01", "fhem-eve-m03", "fhem-eve-m04", "fhem-eve-m05", "fhem-eve-m06", "fhem-eve-m07"], binaryIds: ["fhem-eve-b01", "fhem-eve-b03"], openId: "fhem-eve-o01" });
    }
    bank.__examEveExtended = true;
  }

  root.FHEMExamEve = {
    schemaVersion: 1,
    flashcards,
    questions,
    concepts,
    resources,
    sessionReviews,
    formulas,
    distinctions,
    rapidRecall,
    checklist,
    plans: {
      full: [
        ["00:00–00:25", "Read the exam format, scoring and common traps; decide when to leave a risky MCQ blank."],
        ["00:25–01:35", "Sessions 1–2: healthcare economy, demand, elasticity, causal identification and full price."],
        ["01:35–03:05", "Sessions 3–5: Grossman, inequalities and physician agency, using the TA clarifications."],
        ["03:05–04:35", "Sessions 6–8: insurance demand, adverse selection, moral hazard and managed care."],
        ["04:35–05:05", "Break, food and a short walk—do not replace retrieval with tired rereading."],
        ["05:05–06:35", "Complete Mock Exam 5 closed-book under 90-minute conditions."],
        ["06:35–07:10", "Review errors and write one open-answer outline from memory."],
        ["Before sleep", "Read only the formula sheet and distinction cards; stop intensive study early enough to sleep."],
      ],
      short: [
        ["00:00–00:35", "Sessions 3–5 TA focus: stock/flow/hurdle, Greek letters by role, fee-cut decomposition."],
        ["00:35–01:20", "Insurance chain: fair/full → pooling/separation → moral hazard/VBID."],
        ["01:20–01:50", "Rapid recall and binary traps."],
        ["01:50–02:50", "One fixed mock objective section plus a full open-answer outline."],
        ["02:50–03:00", "Final checklist and stop."],
      ],
    },
  };

  extendExamStyleBank();
})(typeof window !== "undefined" ? window : globalThis);
