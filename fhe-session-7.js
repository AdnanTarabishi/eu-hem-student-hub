// Session 7 — Insurance II: original study content and interactive adverse-selection labs.
(function (root) {
  "use strict";

  const TOPIC_ID = "fund-health-economics.adverse-selection";
  const MODULE_ID = "fund-health-economics";
  const COURSE_ID = "fund-health-econ-management";

  const flashcards = [
    { id: "fund-health-economics.fc.301", topic: TOPIC_ID, front: "What is social insurance in Session 7?", back: "Transfers linked to events such as unemployment, disability, ageing or illness; the lecture frames these mainly as transfers across states or time within an individual." },
    { id: "fund-health-economics.fc.302", topic: TOPIC_ID, front: "How does social insurance contrast with means-tested welfare in the lecture?", back: "Social insurance is framed as a transfer within an individual across states or time, whereas welfare redistributes across individuals according to means tests." },
    { id: "fund-health-economics.fc.303", topic: TOPIC_ID, front: "What is the central second-best trade-off in social insurance?", back: "Risk reduction and smoother consumption versus incentive distortions, inefficient behaviour and deadweight loss." },
    { id: "fund-health-economics.fc.304", topic: TOPIC_ID, front: "Which component of health expenditure creates the basic demand for insurance?", back: "The random or residual component, because it makes an individual's future expenditure uncertain." },
    { id: "fund-health-economics.fc.305", topic: TOPIC_ID, front: "Why does systematic variation matter for insurance markets?", back: "Predictable differences in expected expenditure affect premiums, selection, affordability and the distribution of costs across risk groups." },
    { id: "fund-health-economics.fc.306", topic: TOPIC_ID, front: "What information problem generates adverse selection?", back: "Consumers know more about their probability of becoming sick or expected losses than insurers do, or insurers cannot use that information." },
    { id: "fund-health-economics.fc.307", topic: TOPIC_ID, front: "What is adverse selection in plan competition?", back: "More generous coverage disproportionately attracts higher-risk people, raising its average expected cost and premium." },
    { id: "fund-health-economics.fc.308", topic: TOPIC_ID, front: "What do pL and pH denote?", back: "The sickness probabilities of low-risk/robust and high-risk/frail individuals, with pL < pH." },
    { id: "fund-health-economics.fc.309", topic: TOPIC_ID, front: "What does λ denote in the Rothschild–Stiglitz setup?", back: "The fraction of low-risk individuals in the population or insurance pool." },
    { id: "fund-health-economics.fc.310", topic: TOPIC_ID, front: "What would type-specific fair premiums be if risk were observable?", back: "πL = pL I and πH = pH I." },
    { id: "fund-health-economics.fc.311", topic: TOPIC_ID, front: "What is the actuarially fair average premium for a mixed pool?", back: "π = [λpL + (1−λ)pH]I." },
    { id: "fund-health-economics.fc.312", topic: TOPIC_ID, front: "Why can a full plan cost more than a partial plan for two separate reasons?", back: "It pays a larger indemnity and it may attract a higher-risk mix of enrollees." },
    { id: "fund-health-economics.fc.313", topic: TOPIC_ID, front: "What does the endowment point E represent in yH–yS space?", back: "Income in the healthy and sick states before purchasing insurance." },
    { id: "fund-health-economics.fc.314", topic: TOPIC_ID, front: "How does contract (π,I) move the endowment point?", back: "Healthy-state income falls by π, while sick-state income rises by the net payout I−π." },
    { id: "fund-health-economics.fc.315", topic: TOPIC_ID, front: "What does the 45-degree line represent in contract space?", back: "State-independent income, yS = yH, corresponding to full insurance." },
    { id: "fund-health-economics.fc.316", topic: TOPIC_ID, front: "What is the slope of a type-p zero-profit line in yH–yS space?", back: "−(1−p)/p." },
    { id: "fund-health-economics.fc.317", topic: TOPIC_ID, front: "Where are profitable contracts relative to a type's zero-profit line in the lecture diagram?", back: "Below the zero-profit line; contracts above it generate expected losses for the insurer." },
    { id: "fund-health-economics.fc.318", topic: TOPIC_ID, front: "Why is the frail/high-risk indifference curve flatter at a common contract point?", back: "The high-risk type reaches the sick state more often and therefore values sick-state income more relative to healthy-state income." },
    { id: "fund-health-economics.fc.319", topic: TOPIC_ID, front: "What are the core Rothschild–Stiglitz assumptions used in Session 7?", back: "Two hidden risk types, a static model, no moral hazard, perfect competition, break-even insurers and one contract chosen per individual." },
    { id: "fund-health-economics.fc.320", topic: TOPIC_ID, front: "How is a Rothschild–Stiglitz equilibrium defined in the lecture?", back: "Consumers choose their preferred offered contract and all firms earn zero expected profits." },
    { id: "fund-health-economics.fc.321", topic: TOPIC_ID, front: "What is a pooling equilibrium?", back: "Both risk types choose the same insurance contract." },
    { id: "fund-health-economics.fc.322", topic: TOPIC_ID, front: "What is a separating equilibrium?", back: "Different risk types self-select into different contracts." },
    { id: "fund-health-economics.fc.323", topic: TOPIC_ID, front: "Why are the symmetric-information first-best contracts not an equilibrium under hidden types?", back: "High risks would imitate low risks and choose the low-risk full-insurance contract, causing insurer losses." },
    { id: "fund-health-economics.fc.324", topic: TOPIC_ID, front: "What transfer occurs in an actuarially fair pooling contract?", back: "Low risks pay more than their own expected payout and high risks pay less, producing a transfer from L to H." },
    { id: "fund-health-economics.fc.325", topic: TOPIC_ID, front: "Why does competition drive out a candidate pooling equilibrium?", back: "A firm can offer a profitable contract preferred by low risks but not by high risks, cream-skimming the pool." },
    { id: "fund-health-economics.fc.326", topic: TOPIC_ID, front: "What contract does the high-risk type receive in a separating equilibrium?", back: "Its first-best, fair full-insurance contract with a high premium." },
    { id: "fund-health-economics.fc.327", topic: TOPIC_ID, front: "Why does the low-risk type receive only partial insurance in a separating equilibrium?", back: "Coverage is restricted to make the low-risk contract unattractive to high risks; this is the incentive-compatibility price of separation." },
    { id: "fund-health-economics.fc.328", topic: TOPIC_ID, front: "What does it mean that low risks are quantity constrained or rationed?", back: "They cannot buy the full amount of insurance they prefer, even though they would pay their own fair premium for it." },
    { id: "fund-health-economics.fc.329", topic: TOPIC_ID, front: "How can a large λ affect equilibrium existence?", back: "When low risks are a large majority, a profitable pooling deviation may destabilise the separating menu and the market may have no equilibrium." },
    { id: "fund-health-economics.fc.330", topic: TOPIC_ID, front: "Why can compulsory pooling improve welfare?", back: "It can cross-subsidise high risks and relax the low-risk coverage constraint, allowing both types to reach a better feasible allocation." },
    { id: "fund-health-economics.fc.331", topic: TOPIC_ID, front: "What policy menu does Session 7 associate with partial pooling?", back: "Compulsory basic insurance plus supplementary private insurance, or an equivalent tax on partial coverage and subsidy to fuller coverage." },
    { id: "fund-health-economics.fc.332", topic: TOPIC_ID, front: "What is premium risk?", back: "The risk that a person's systematically expected future healthcare costs and therefore actuarial premium rise after their risk class worsens." },
    { id: "fund-health-economics.fc.333", topic: TOPIC_ID, front: "What is the main limitation of a lifetime insurance contract?", back: "It can preserve pooling but locks people into a long commitment, may be hard to enforce and limits switching and competition." },
    { id: "fund-health-economics.fc.334", topic: TOPIC_ID, front: "What is a guaranteed renewable contract?", back: "A contract with front-loaded premiums designed so both robust and frail consumers voluntarily remain, though switching remains limited." },
    { id: "fund-health-economics.fc.335", topic: TOPIC_ID, front: "What is the Cochrane lifetime-contract idea in the lecture?", back: "Insurers provide premium insurance: a health-status shock triggers a payment that helps finance higher future insurance premiums." },
    { id: "fund-health-economics.fc.336", topic: TOPIC_ID, front: "What are the three major RS predictions emphasised in the conclusion?", back: "Competition eliminates pooling equilibria; separating equilibria ration robust types and make insurance costly for frail types; and the market may fail to reach equilibrium." }
  ];

  const questions = [
    { id: "fund-health-economics.q.301", topic: TOPIC_ID, type: "mcq", difficulty: "easy", category: "Social insurance", source: "EU-HEM Hub original practice · Session 7", question: "Which statement best matches the lecture's distinction between social insurance and means-tested welfare?", options: ["Both are identical transfers across people", "Social insurance mainly transfers across states or time within an individual, while welfare is means-tested across individuals", "Social insurance never involves government", "Welfare only covers health shocks"], answer: "B", explanation: "The lecture uses the within-versus-across distinction to motivate social insurance." },
    { id: "fund-health-economics.q.302", topic: TOPIC_ID, type: "mcq", difficulty: "easy", category: "Variation", source: "EU-HEM Hub original practice · Session 7", question: "Which component of healthcare expenditure is the primary reason insurance exists?", options: ["The random residual component", "Only age variation", "Only provider prices", "Perfectly predictable expenditure"], answer: "A", explanation: "Unpredictable variation creates utility gains from pooling risk." },
    { id: "fund-health-economics.q.303", topic: TOPIC_ID, type: "mcq", difficulty: "medium", category: "Asymmetric information", source: "EU-HEM Hub original practice · Session 7", question: "When consumers know their expected losses better than insurers, what problem may limit efficiency?", options: ["Moral hazard only", "Adverse selection", "Perfect risk adjustment", "State independence"], answer: "B", explanation: "Hidden risk type changes plan choice and the composition of insurance pools." },
    { id: "fund-health-economics.q.304", topic: TOPIC_ID, type: "mcq", difficulty: "medium", category: "Average premium", source: "EU-HEM Hub original practice · Session 7", question: "A pool contains fraction λ of low risks with probability pL and the rest high risks with probability pH. What is the break-even premium for indemnity I?", options: ["(pH−pL)I", "[λpL+(1−λ)pH]I", "λpH I", "pL pH I"], answer: "B", explanation: "The pooling premium uses the population-weighted average sickness probability." },
    { id: "fund-health-economics.q.305", topic: TOPIC_ID, type: "mcq", difficulty: "medium", category: "Adverse selection", source: "EU-HEM Hub original practice · Session 7", question: "Why can a generous health plan charge a higher premium even beyond the direct cost of greater coverage?", options: ["It attracts a healthier mix", "It disproportionately attracts sicker enrollees", "Its indemnity is always zero", "Competition forces all premiums to be identical"], answer: "B", explanation: "Adverse selection worsens the plan's risk mix." },
    { id: "fund-health-economics.q.306", topic: TOPIC_ID, type: "mcq", difficulty: "medium", category: "Contract space", source: "EU-HEM Hub original practice · Session 7", question: "A contract charges premium π and pays indemnity I. Relative to endowment E, what are the changes in healthy- and sick-state income?", options: ["+π and −I", "−π and +(I−π)", "+I and −π", "−I and +π"], answer: "B", explanation: "The premium is paid in both states; the indemnity is received only in the sick state." },
    { id: "fund-health-economics.q.307", topic: TOPIC_ID, type: "mcq", difficulty: "medium", category: "Zero-profit line", source: "EU-HEM Hub original practice · Session 7", question: "What is the slope of the zero-profit line for sickness probability p in yH–yS space?", options: ["−p/(1−p)", "−(1−p)/p", "+(1−p)/p", "−1"], answer: "B", explanation: "The break-even condition implies yS=y−M+[(1−p)/p](y−yH)." },
    { id: "fund-health-economics.q.308", topic: TOPIC_ID, type: "mcq", difficulty: "medium", category: "Preferences", source: "EU-HEM Hub original practice · Session 7", question: "At a common contract point, why is the high-risk/frail indifference curve flatter?", options: ["The frail type values healthy income more", "The frail type reaches the sick state more often and values sick-state income more", "The frail type has no risk aversion", "The low-risk type has a larger medical loss"], answer: "B", explanation: "Different state probabilities generate the single-crossing pattern used for self-selection." },
    { id: "fund-health-economics.q.309", topic: TOPIC_ID, type: "mcq", difficulty: "easy", category: "Equilibrium", source: "EU-HEM Hub original practice · Session 7", question: "Which two conditions define equilibrium in the lecture?", options: ["Government profit and consumer equality", "Consumer optimisation and zero expected profit for firms", "Full insurance and identical premiums", "Pooling and moral hazard"], answer: "B", explanation: "Consumers choose their best available contract and competition drives firms to break even." },
    { id: "fund-health-economics.q.310", topic: TOPIC_ID, type: "mcq", difficulty: "medium", category: "First best", source: "EU-HEM Hub original practice · Session 7", question: "Why do first-best type-specific full-insurance contracts fail under hidden risk?", options: ["Low risks imitate high risks", "High risks imitate the cheaper low-risk contract", "No one wants full insurance", "Insurers observe risk perfectly"], answer: "B", explanation: "The low-risk contract is attractive to high risks but priced using pL, so it would generate losses." },
    { id: "fund-health-economics.q.311", topic: TOPIC_ID, type: "mcq", difficulty: "hard", category: "Pooling", source: "EU-HEM Hub original practice · Session 7", question: "In an actuarially fair pooling contract, which statement is correct?", options: ["Both types pay exactly their own expected payout", "Low risks subsidise high risks", "High risks subsidise low risks", "There is no redistribution"], answer: "B", explanation: "The common premium exceeds pL I and is below pH I." },
    { id: "fund-health-economics.q.312", topic: TOPIC_ID, type: "mcq", difficulty: "hard", category: "Pooling non-existence", source: "EU-HEM Hub original practice · Session 7", question: "What destabilises a candidate pooling equilibrium in the RS model?", options: ["A loss-making contract preferred by everyone", "A profitable cream-skimming contract preferred by low risks but not high risks", "A mandatory public contract", "A contract above every zero-profit line"], answer: "B", explanation: "Competitive entry can separate the profitable low-risk part of the pool." },
    { id: "fund-health-economics.q.313", topic: TOPIC_ID, type: "mcq", difficulty: "medium", category: "Separating equilibrium", source: "EU-HEM Hub original practice · Session 7", question: "What menu characterises the separating equilibrium described in the lecture?", options: ["Full coverage for both types at one premium", "Full high-premium coverage for H and partial low-premium coverage for L", "No insurance for H and full insurance for L", "Partial coverage for H and full coverage for L"], answer: "B", explanation: "The low-risk contract is deliberately limited to deter high-risk imitation." },
    { id: "fund-health-economics.q.314", topic: TOPIC_ID, type: "mcq", difficulty: "medium", category: "Low-risk rationing", source: "EU-HEM Hub original practice · Session 7", question: "Why is the low-risk type quantity constrained in a separating equilibrium?", options: ["It dislikes insurance", "It must accept partial coverage to separate from high risks", "Its fair premium is higher than pH I", "The insurer observes its type"], answer: "B", explanation: "The coverage restriction is an incentive-compatibility device, not the low-risk consumer's first-best choice." },
    { id: "fund-health-economics.q.315", topic: TOPIC_ID, type: "mcq", difficulty: "hard", category: "Government intervention", source: "EU-HEM Hub original practice · Session 7", question: "How can a compulsory partial pooling contract improve welfare in the lecture's model?", options: ["By eliminating all cross-subsidies", "By subsidising H and relaxing L's rationing constraint", "By making risk types observable", "By banning supplementary insurance"], answer: "B", explanation: "A suitable mandatory base contract can lower the cost of separation and move both types to preferred allocations." },
    { id: "fund-health-economics.q.316", topic: TOPIC_ID, type: "true-false", difficulty: "easy", source: "EU-HEM Hub original practice · Session 7", question: "If all medical expenditure variation were random, uniform premiums and competitive insurance markets would work relatively well in the lecture's benchmark.", answer: true, explanation: "True. Predictable systematic differences are what complicate pricing and equity." },
    { id: "fund-health-economics.q.317", topic: TOPIC_ID, type: "true-false", difficulty: "medium", source: "EU-HEM Hub original practice · Session 7", question: "If spending were exactly predictable for each person, the usual risk-pooling utility gain from insurance would disappear.", answer: true, explanation: "True. Insurance against a known expense becomes prepayment rather than risk reduction." },
    { id: "fund-health-economics.q.318", topic: TOPIC_ID, type: "true-false", difficulty: "medium", source: "EU-HEM Hub original practice · Session 7", question: "A pooling premium is actuarially fair for each risk type individually.", answer: false, explanation: "False. It breaks even for the mixed pool but is too high for L and too low for H." },
    { id: "fund-health-economics.q.319", topic: TOPIC_ID, type: "true-false", difficulty: "medium", source: "EU-HEM Hub original practice · Session 7", question: "The 45-degree line in yH–yS space represents full insurance.", answer: true, explanation: "True. Points on it have equal income across health states." },
    { id: "fund-health-economics.q.320", topic: TOPIC_ID, type: "true-false", difficulty: "medium", source: "EU-HEM Hub original practice · Session 7", question: "Contracts above a type's zero-profit line are profitable for insurers.", answer: false, explanation: "False. In the lecture's orientation, they generate expected losses; profitable contracts lie below." },
    { id: "fund-health-economics.q.321", topic: TOPIC_ID, type: "true-false", difficulty: "medium", source: "EU-HEM Hub original practice · Session 7", question: "A separating equilibrium reveals risk type ex post through the contract each consumer selects.", answer: true, explanation: "True. Self-selection sorts types into different contracts." },
    { id: "fund-health-economics.q.322", topic: TOPIC_ID, type: "true-false", difficulty: "hard", source: "EU-HEM Hub original practice · Session 7", question: "A separating equilibrium always exists regardless of the population share λ.", answer: false, explanation: "False. The lecture emphasises that equilibrium may fail when low risks are a large majority." },
    { id: "fund-health-economics.q.323", topic: TOPIC_ID, type: "true-false", difficulty: "medium", source: "EU-HEM Hub original practice · Session 7", question: "Compulsory pooling necessarily means that supplementary private insurance must be prohibited.", answer: false, explanation: "False. The lecture explicitly allows supplementary insurance on top of a mandatory basic policy." },
    { id: "fund-health-economics.q.324", topic: TOPIC_ID, type: "short-answer", difficulty: "medium", source: "EU-HEM Hub original practice · Session 7", question: "Explain the distinction between random and systematic variation in healthcare expenditure and why each matters.", answer: "Random variation is the unpredictable residual component that creates demand for insurance. Systematic variation is predictable across people or groups and shapes premiums, selection, affordability and redistribution. If all variation were random, uniform premiums would work well; if every expense were perfectly predictable, the risk-reduction value of insurance would disappear.", explanation: "A strong answer connects random variation to risk pooling and systematic variation to market functioning." },
    { id: "fund-health-economics.q.325", topic: TOPIC_ID, type: "short-answer", difficulty: "medium", source: "EU-HEM Hub original practice · Session 7", question: "Derive the fair pooling premium for two risk types.", answer: "Let λ be the low-risk share, pL the low-risk probability, pH the high-risk probability and I the indemnity. Expected payout per enrollee is [λpL+(1−λ)pH]I, so the break-even pooling premium is πP=[λpL+(1−λ)pH]I.", explanation: "State the weighted average probability before multiplying by coverage." },
    { id: "fund-health-economics.q.326", topic: TOPIC_ID, type: "short-answer", difficulty: "hard", source: "EU-HEM Hub original practice · Session 7", question: "Why can no pooling equilibrium survive competitive entry in the standard RS argument?", answer: "The pooling contract cross-subsidises high risks and overcharges low risks relative to their own expected cost. Because preferences satisfy a single-crossing pattern, an entrant can design a slightly different partial contract that low risks prefer, high risks reject and that earns positive profit on the selected low-risk group. The deviation breaks the pool.", explanation: "Mention cream-skimming, profitability and different type preferences." },
    { id: "fund-health-economics.q.327", topic: TOPIC_ID, type: "short-answer", difficulty: "hard", source: "EU-HEM Hub original practice · Session 7", question: "Describe the separating equilibrium and its welfare cost for low risks.", answer: "High risks obtain fair full insurance at their high actuarial premium. Low risks obtain a fair but partial contract chosen so high risks do not imitate it. The low-risk type is therefore quantity constrained: it receives less coverage than its first-best full insurance even though it would pay its own fair premium.", explanation: "The key welfare loss is incomplete insurance imposed for incentive compatibility." },
    { id: "fund-health-economics.q.328", topic: TOPIC_ID, type: "short-answer", difficulty: "hard", source: "EU-HEM Hub original practice · Session 7", question: "How can compulsory basic pooling plus supplementary insurance create a Pareto improvement in the lecture's framework?", answer: "The mandatory base policy charges the population-average premium and transfers resources from low to high risks. Starting from that new endowment, supplementary separating contracts can give high risks the subsidy benefit while allowing low risks to buy more complete total coverage than under the original separating equilibrium. A suitably chosen policy can therefore make both types better off.", explanation: "Not every mandate is automatically Pareto improving; the contract must be appropriately chosen." },
    { id: "fund-health-economics.q.329", topic: TOPIC_ID, type: "short-answer", difficulty: "medium", source: "EU-HEM Hub original practice · Session 7", question: "Define premium risk and explain why annual spot insurance does not fully insure it.", answer: "Premium risk is the risk that new information moves a person into a higher expected-cost class, making future actuarial premiums rise. Annual spot insurance covers current medical expenditure risk but reprices future contracts as expected costs change, so it does not protect the person against becoming persistently expensive to insure.", explanation: "Distinguish medical-expense risk from future-premium risk." },
    { id: "fund-health-economics.q.330", topic: TOPIC_ID, type: "short-answer", difficulty: "medium", source: "EU-HEM Hub original practice · Session 7", question: "Compare the three theoretical market responses to premium risk discussed in the lecture.", answer: "A lifetime contract preserves pooling through a binding long-term commitment but restricts switching and may be hard to enforce. A guaranteed renewable contract front-loads premiums so consumers remain voluntarily, but switching and competitive pressure remain limited. A Cochrane-style contract adds premium insurance: a deterioration in health status triggers a payment that finances higher future premiums and can preserve mobility more directly.", explanation: "Cover commitment, renewability and premium-insurance compensation." }
  ];

  const concepts = [
    { id: "concept.social-insurance", term: "Social insurance", explanation: "Insurance-like transfers linked to events such as illness, disability, unemployment or ageing, often organised collectively.", topics: [TOPIC_ID] },
    { id: "concept.systematic-risk-variation", term: "Systematic expenditure variation", explanation: "Predictable differences in expected healthcare spending across people or groups that affect premiums and redistribution.", topics: [TOPIC_ID] },
    { id: "concept.random-expenditure-variation", term: "Random expenditure variation", explanation: "The unpredictable residual component of healthcare spending that creates demand for risk pooling.", topics: [TOPIC_ID] },
    { id: "concept.adverse-selection", term: "Adverse selection", explanation: "A selection problem in which people with higher expected costs disproportionately choose more generous coverage when risk type is hidden.", topics: [TOPIC_ID] },
    { id: "concept.low-high-risk-types", term: "Low- and high-risk types", explanation: "Robust L and frail H consumers with sickness probabilities pL<pH.", topics: [TOPIC_ID] },
    { id: "concept.pooling-premium", term: "Pooling premium", explanation: "The break-even common premium based on the mixed pool: [λpL+(1−λ)pH]I.", topics: [TOPIC_ID] },
    { id: "concept.contract-space", term: "yH–yS contract space", explanation: "A diagram representing income in healthy and sick states after an insurance contract.", topics: [TOPIC_ID] },
    { id: "concept.endowment-point", term: "Endowment point", explanation: "The no-insurance combination of healthy- and sick-state income from which contracts move the consumer.", topics: [TOPIC_ID] },
    { id: "concept.zero-profit-line", term: "Zero-profit line", explanation: "The set of contracts that break even for a given sickness probability, with slope −(1−p)/p in yH–yS space.", topics: [TOPIC_ID] },
    { id: "concept.single-crossing", term: "Single-crossing property", explanation: "High-risk preferences are flatter in contract space because sick-state income is weighted more heavily, enabling self-selection.", topics: [TOPIC_ID] },
    { id: "concept.pooling-equilibrium", term: "Pooling equilibrium", explanation: "An equilibrium in which all risk types choose the same insurance contract.", topics: [TOPIC_ID] },
    { id: "concept.separating-equilibrium", term: "Separating equilibrium", explanation: "An equilibrium in which different hidden risk types self-select into different contracts.", topics: [TOPIC_ID] },
    { id: "concept.incentive-compatibility", term: "Incentive compatibility", explanation: "A contract menu condition requiring each type to prefer the contract intended for it.", topics: [TOPIC_ID] },
    { id: "concept.low-risk-rationing", term: "Low-risk rationing", explanation: "The restriction of low-risk coverage below full insurance to deter high-risk imitation.", topics: [TOPIC_ID] },
    { id: "concept.compulsory-pooling", term: "Compulsory pooling", explanation: "A mandated common insurance contract that can sustain redistribution and improve welfare when private pooling is unstable.", topics: [TOPIC_ID] },
    { id: "concept.premium-risk", term: "Premium risk", explanation: "The risk of facing persistently higher future premiums after becoming predictably high cost.", topics: [TOPIC_ID] },
    { id: "concept.guaranteed-renewability", term: "Guaranteed renewability", explanation: "A long-term design with front-loaded premiums intended to keep consumers in the contract after risk is revealed.", topics: [TOPIC_ID] },
    { id: "concept.premium-insurance", term: "Premium insurance", explanation: "Coverage that pays when health status worsens so the insured can afford higher future health-insurance premiums.", topics: [TOPIC_ID] }
  ];

  const resources = [
    { id: "fund-health-economics.r.207", title: "Official Session 7 materials on Virtuale", type: "Website", url: "https://virtuale.unibo.it/course/view.php?id=80559", date: "2026-10-20", topic: TOPIC_ID, description: "Official University of Bologna materials for Fundamentals in Health Economics. Sign in with your UniBo account." }
  ];

  function appendUnique(target, items) {
    if (!Array.isArray(target)) return;
    const ids = new Set(target.map((item) => item.id));
    for (const item of items) if (!ids.has(item.id)) { target.push(item); ids.add(item.id); }
  }

  const originalLoadAll = root.loadAll;
  if (typeof originalLoadAll === "function" && !originalLoadAll.__fheSession7Wrapped) {
    const wrapped = async function (...args) {
      const data = await originalLoadAll.apply(this, args);
      const module = data.modules?.find((item) => item.id === MODULE_ID);
      const course = data.courses?.find((item) => item.id === COURSE_ID);
      if (module) { appendUnique(module.flashcards, flashcards); appendUnique(module.questions, questions); appendUnique(module.resources, resources); }
      if (course) { appendUnique(course.flashcards, flashcards); appendUnique(course.questions, questions); appendUnique(course.resources, resources); }
      appendUnique(data.concepts, concepts);
      return data;
    };
    wrapped.__fheSession7Wrapped = true;
    root.loadAll = wrapped;
  }

  root.FHESession7 = { topic: TOPIC_ID, flashcards, questions, concepts, resources };

  const fmt = (value, digits = 2) => Number.isFinite(value) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const input = (id, label, value, attrs = "") => `<div class="control"><label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" ${attrs}></div>`;
  const range = (id, label, value, min, max, step, left, right) => `<div class="control"><label for="${id}">${label}: <strong id="${id}-value">${value}</strong></label><input id="${id}" type="range" value="${value}" min="${min}" max="${max}" step="${step}"><div class="range-labels"><span>${left}</span><span>${right}</span></div></div>`;
  const read = (node, id, min = -Infinity, max = Infinity) => { const value = Number(node.querySelector(`#${id}`)?.value); return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); };
  const output = (id) => `<div id="${id}" class="activity-output" aria-live="polite"></div>`;
  const U = (y) => y > 0 ? Math.sqrt(y) : NaN;
  const EU = (p, yh, ys) => (1 - p) * U(yh) + p * U(ys);
  const state = (y, m, premium, indemnity) => ({ yh: y - premium, ys: y - premium - m + indemnity });
  const stats = (items) => `<dl class="activity-stats">${items.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`;

  function registerActivities() {
    if (!root.LectureActivities?.register) return;

    root.LectureActivities.register("selection-pool", {
      title: "Price a mixed risk pool",
      intro: "Change the low-risk share and both sickness probabilities. The common premium breaks even for the pool while redistributing between types.",
      build(node) {
        node.innerHTML = '<div class="activity-controls">' + range("sp-lambda", "Low-risk share λ (%)", 70, 1, 99, 1, "1%", "99%") + range("sp-pl", "Low-risk probability pL (%)", 10, 1, 60, 1, "1%", "60%") + range("sp-ph", "High-risk probability pH (%)", 35, 2, 90, 1, "2%", "90%") + input("sp-i", "Indemnity I (€)", 10000, 'min="0" step="100"') + '</div>' + output("sp-output");
        const render = () => {
          const lambda = read(node, "sp-lambda", 1, 99) / 100;
          let pl = read(node, "sp-pl", 1, 60) / 100;
          let ph = read(node, "sp-ph", 2, 90) / 100;
          if (ph <= pl) ph = Math.min(.99, pl + .01);
          const indemnity = read(node, "sp-i", 0, 1e12);
          node.querySelector("#sp-lambda-value").textContent = fmt(lambda * 100, 0) + "%";
          node.querySelector("#sp-pl-value").textContent = fmt(pl * 100, 0) + "%";
          node.querySelector("#sp-ph-value").textContent = fmt(ph * 100, 0) + "%";
          const pbar = lambda * pl + (1 - lambda) * ph;
          const premium = pbar * indemnity;
          const lContribution = premium - pl * indemnity;
          const hContribution = premium - ph * indemnity;
          node.querySelector("#sp-output").innerHTML = `<div class="formula">πP = [λpL + (1−λ)pH]I = €${fmt(premium)}</div>` + stats([["Average sickness probability", fmt(pbar * 100, 1) + "%"], ["Low-risk own fair premium", "€" + fmt(pl * indemnity)], ["High-risk own fair premium", "€" + fmt(ph * indemnity)], ["L contribution above own expected cost", "€" + fmt(lContribution)], ["H contribution above own expected cost", "€" + fmt(hContribution)]]) + `<div class="selection-transfer"><span>L pays above own risk</span><b>€${fmt(Math.max(0,lContribution))} →</b><span>H pays below own risk</span></div><p>The pooling contract breaks even overall. The signs for L and H are opposite because the common premium lies between their type-specific fair premiums.</p>`;
        };
        node.querySelectorAll("input").forEach((el) => el.addEventListener("input", render)); render();
      }
    });

    root.LectureActivities.register("selection-zero-profit", {
      title: "Compare zero-profit lines",
      intro: "The high-risk line is flatter because pH is larger. The pooling line lies between the two type-specific lines.",
      build(node) {
        node.innerHTML = '<div class="activity-controls">' + range("sz-pl", "pL (%)", 10, 1, 60, 1, "1%", "60%") + range("sz-ph", "pH (%)", 35, 2, 90, 1, "2%", "90%") + range("sz-lambda", "λ (%)", 70, 1, 99, 1, "1%", "99%") + '</div>' + output("sz-output");
        const render = () => {
          const pl = read(node, "sz-pl", 1, 60) / 100;
          const ph = Math.max(pl + .01, read(node, "sz-ph", 2, 90) / 100);
          const lambda = read(node, "sz-lambda", 1, 99) / 100;
          const pbar = lambda * pl + (1-lambda) * ph;
          node.querySelector("#sz-pl-value").textContent = fmt(pl*100,0)+"%";
          node.querySelector("#sz-ph-value").textContent = fmt(ph*100,0)+"%";
          node.querySelector("#sz-lambda-value").textContent = fmt(lambda*100,0)+"%";
          const slope = (p) => -(1-p)/p;
          const line = (p, colour, label) => { const x1=55,y1=250,x2=330,y2=Math.max(25,250+slope(p)*105); return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${colour}" stroke-width="4"/><text x="${x2-5}" y="${Math.max(20,y2-8)}" fill="${colour}" text-anchor="end" font-size="12">${label}</text>`; };
          node.querySelector("#sz-output").innerHTML = `<div class="selection-chart"><svg viewBox="0 0 380 290" role="img" aria-label="Original diagram of low-risk, pooling and high-risk zero-profit lines"><path d="M45 255V25M45 255H360" stroke="currentColor" opacity=".45"/><path d="M45 255L315 25" stroke="currentColor" stroke-dasharray="5 5" opacity=".35"/>${line(pl,"#4c78a8","L zero-profit")}${line(pbar,"#7b61a8","pooling")}${line(ph,"#d06d4f","H zero-profit")}<text x="345" y="276" fill="currentColor" font-size="12">yH</text><text x="12" y="30" fill="currentColor" font-size="12">yS</text></svg></div>` + stats([["L slope", fmt(slope(pl),2)], ["Pooling slope", fmt(slope(pbar),2)], ["H slope", fmt(slope(ph),2)]]) + '<p>As p rises, −(1−p)/p becomes less negative, so the high-risk break-even line is flatter.</p>';
        };
        node.querySelectorAll("input").forEach((el) => el.addEventListener("input", render)); render();
      }
    });

    root.LectureActivities.register("selection-contract-space", {
      title: "Place a contract in yH–yS space",
      intro: "Enter a contract and compare it with the 45-degree full-insurance line and the break-even condition for the selected risk type.",
      build(node) {
        node.innerHTML = '<div class="activity-controls">' + input("sc-y","Income y (€)",100,'min="1" step="1"') + input("sc-m","Medical loss M (€)",60,'min="0" step="1"') + input("sc-p","Sickness probability p (%)",20,'min="1" max="99" step="1"') + input("sc-i","Indemnity I (€)",40,'min="0" step="1"') + input("sc-pi","Premium π (€)",8,'min="0" step="1"') + '</div>' + output("sc-output");
        const render = () => {
          const y=read(node,"sc-y",1,1e9), m=read(node,"sc-m",0,y-.001), p=read(node,"sc-p",1,99)/100, indemnity=read(node,"sc-i",0,1e9), premium=read(node,"sc-pi",0,1e9);
          const s=state(y,m,premium,indemnity), profit=premium-p*indemnity, fair=Math.abs(profit)<.01, full=Math.abs(indemnity-m)<.01;
          const max=Math.max(y, s.yh, s.ys, 1), x=50+(s.yh/max)*260, yy=270-(s.ys/max)*230, ex=50+(y/max)*260, ey=270-((y-m)/max)*230;
          node.querySelector("#sc-output").innerHTML = `<div class="selection-chart"><svg viewBox="0 0 360 300" role="img" aria-label="Original contract-space plot"><path d="M45 270V25M45 270H330" stroke="currentColor" opacity=".45"/><path d="M45 270L315 25" stroke="currentColor" stroke-dasharray="5 5" opacity=".35"/><circle cx="${ex}" cy="${ey}" r="7" fill="#6f7785"/><text x="${ex+10}" y="${ey+4}" fill="currentColor" font-size="12">E</text><path d="M${ex} ${ey}L${x} ${yy}" stroke="#7b61a8" stroke-width="3" marker-end="url(#arrow7)"/><defs><marker id="arrow7" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#7b61a8"/></marker></defs><circle cx="${x}" cy="${yy}" r="8" fill="#d06d4f"/><text x="${x+10}" y="${yy-8}" fill="currentColor" font-size="12">C</text><text x="315" y="289" fill="currentColor" font-size="12">yH</text><text x="12" y="30" fill="currentColor" font-size="12">yS</text></svg></div>` + stats([["Healthy-state income", "€"+fmt(s.yh)], ["Sick-state income", "€"+fmt(s.ys)], ["Expected insurer profit", "€"+fmt(profit)], ["Pricing", fair?"Fair / zero profit":profit>0?"Profitable / unfair":"Loss-making"], ["Coverage", full?"Full":indemnity<m?"Partial":"More than full"]]) + `<p>The contract moves left by the premium and up by the net sick-state payout I−π.</p>`;
        };
        node.querySelectorAll("input").forEach((el) => el.addEventListener("input", render)); render();
      }
    });

    root.LectureActivities.register("selection-separating", {
      title: "Test a separating menu",
      intro: "High risks receive fair full insurance. Adjust low-risk coverage and check whether both types self-select into the intended contracts. Square-root utility is a transparent Student Hub teaching assumption.",
      build(node) {
        node.innerHTML = '<div class="activity-controls">' + input("ss-y","Income y (€)",100,'min="1" step="1"') + input("ss-m","Medical loss M (€)",60,'min="1" step="1"') + range("ss-pl","pL (%)",10,1,50,1,"1%","50%") + range("ss-ph","pH (%)",35,2,90,1,"2%","90%") + range("ss-il","Low-risk indemnity IL (€)",25,0,80,1,"0","80") + '</div>' + output("ss-output");
        const render = () => {
          const y=read(node,"ss-y",1,1e9), m=read(node,"ss-m",1,y-.001), pl=read(node,"ss-pl",1,50)/100, ph=Math.max(pl+.01,read(node,"ss-ph",2,90)/100);
          const slider=node.querySelector("#ss-il"); slider.max=String(Math.max(1,Math.round(m))); const il=Math.min(read(node,"ss-il",0,m),m);
          node.querySelector("#ss-pl-value").textContent=fmt(pl*100,0)+"%"; node.querySelector("#ss-ph-value").textContent=fmt(ph*100,0)+"%"; node.querySelector("#ss-il-value").textContent="€"+fmt(il,0);
          const cl=state(y,m,pl*il,il), ch=state(y,m,ph*m,m);
          const euLL=EU(pl,cl.yh,cl.ys), euLH=EU(pl,ch.yh,ch.ys), euHH=EU(ph,ch.yh,ch.ys), euHL=EU(ph,cl.yh,cl.ys);
          const lOK=euLL>=euLH-.0001, hOK=euHH>=euHL-.0001;
          node.querySelector("#ss-output").innerHTML = stats([["L utility from CL",fmt(euLL,4)], ["L utility from CH",fmt(euLH,4)], ["H utility from CH",fmt(euHH,4)], ["H utility from CL",fmt(euHL,4)], ["L chooses intended contract",lOK?"Yes":"No"], ["H chooses intended contract",hOK?"Yes":"No"]]) + `<div class="selection-verdict ${lOK&&hOK?'is-good':'is-warn'}"><strong>${lOK&&hOK?'Incentive-compatible menu':'Menu fails self-selection'}</strong><span>${!hOK?'High risks would imitate the low-risk contract. Reduce IL or change the menu.':!lOK?'Low risks prefer the high-risk contract.':'Each type selects its intended contract.'}</span></div><p>At IL=M, the low-risk contract is full and normally too attractive to H. Separation usually requires partial insurance for L.</p>`;
        };
        node.querySelectorAll("input").forEach((el) => el.addEventListener("input", render)); render();
      }
    });

    root.LectureActivities.register("selection-government", {
      title: "Explore compulsory pooling",
      intro: "Compare a separating menu with a mandatory basic pooling contract. The lab identifies transfers and whether the selected mandate improves each type's utility under the teaching utility function.",
      build(node) {
        node.innerHTML = '<div class="activity-controls">' + input("sg-y","Income y (€)",100,'min="1" step="1"') + input("sg-m","Medical loss M (€)",60,'min="1" step="1"') + range("sg-pl","pL (%)",10,1,50,1,"1%","50%") + range("sg-ph","pH (%)",35,2,90,1,"2%","90%") + range("sg-lambda","λ (%)",70,1,99,1,"1%","99%") + range("sg-il","Separating IL (€)",25,0,80,1,"0","80") + range("sg-ig","Mandatory basic IG (€)",20,0,80,1,"0","80") + '</div>' + output("sg-output");
        const render = () => {
          const y=read(node,"sg-y",1,1e9),m=read(node,"sg-m",1,y-.001),pl=read(node,"sg-pl",1,50)/100,ph=Math.max(pl+.01,read(node,"sg-ph",2,90)/100),lambda=read(node,"sg-lambda",1,99)/100;
          ["sg-il","sg-ig"].forEach(id=>node.querySelector(`#${id}`).max=String(Math.max(1,Math.round(m))));
          const il=Math.min(read(node,"sg-il",0,m),m),ig=Math.min(read(node,"sg-ig",0,m),m),pbar=lambda*pl+(1-lambda)*ph;
          node.querySelector("#sg-pl-value").textContent=fmt(pl*100,0)+"%"; node.querySelector("#sg-ph-value").textContent=fmt(ph*100,0)+"%"; node.querySelector("#sg-lambda-value").textContent=fmt(lambda*100,0)+"%"; node.querySelector("#sg-il-value").textContent="€"+fmt(il,0); node.querySelector("#sg-ig-value").textContent="€"+fmt(ig,0);
          const sepL=state(y,m,pl*il,il), sepH=state(y,m,ph*m,m), pool=state(y,m,pbar*ig,ig);
          const lSep=EU(pl,sepL.yh,sepL.ys), hSep=EU(ph,sepH.yh,sepH.ys), lPool=EU(pl,pool.yh,pool.ys), hPool=EU(ph,pool.yh,pool.ys);
          const lGain=lPool-lSep,hGain=hPool-hSep;
          node.querySelector("#sg-output").innerHTML = `<div class="formula">πG = [λpL+(1−λ)pH]IG = €${fmt(pbar*ig)}</div>` + stats([["Transfer paid by L above own expected cost","€"+fmt((pbar-pl)*ig)], ["Subsidy to H below own expected cost","€"+fmt((ph-pbar)*ig)], ["Δ utility for L: mandatory basic vs separating",fmt(lGain,4)], ["Δ utility for H: mandatory basic vs separating",fmt(hGain,4)]]) + `<div class="selection-verdict ${lGain>=0&&hGain>=0?'is-good':'is-warn'}"><strong>${lGain>=0&&hGain>=0?'Both types gain in this simplified comparison':'This chosen mandate is not a Pareto improvement by itself'}</strong><span>Session 7 argues that an appropriately designed compulsory base plus supplementary contracts can improve welfare; not every IG will do so.</span></div>`;
        };
        node.querySelectorAll("input").forEach((el)=>el.addEventListener("input",render)); render();
      }
    });

    root.LectureActivities.register("selection-premium-risk", {
      title: "Separate medical-cost risk from premium risk",
      intro: "Move through a stylised lifetime. Annual medical insurance pays current claims; premium insurance protects against becoming predictably expensive in future years.",
      build(node) {
        node.innerHTML = '<div class="activity-controls">' + range("spr-age","Age",18,18,80,1,"18","80") + range("spr-base","Initial annual expected cost (€)",1000,100,5000,100,"100","5,000") + range("spr-shock","Health-status shock at age 50 (€)",6000,0,20000,250,"0","20,000") + '</div>' + output("spr-output");
        const render=()=>{
          const age=read(node,"spr-age",18,80),base=read(node,"spr-base",100,5000),shock=read(node,"spr-shock",0,20000),revealed=age>=50,expected=base*Math.pow(1.025,age-18)+(revealed?shock:0);
          node.querySelector("#spr-age-value").textContent=fmt(age,0); node.querySelector("#spr-base-value").textContent="€"+fmt(base,0); node.querySelector("#spr-shock-value").textContent="€"+fmt(shock,0);
          const max=base*Math.pow(1.025,62)+shock||1;
          node.querySelector("#spr-output").innerHTML = `<div class="premium-timeline"><div class="premium-track"><span style="width:${((age-18)/62)*100}%"></span><b style="left:${((age-18)/62)*100}%"></b></div><div><span>18</span><span>50: information revelation</span><span>80</span></div></div>` + stats([["Current expected annual cost","€"+fmt(expected)], ["Annual spot premium tendency","€"+fmt(expected)], ["Risk status", revealed ? "Higher risk revealed" : "Risk not yet fully revealed"]]) + `<div class="grid3 premium-solutions"><article><strong>Lifetime contract</strong><span>Binding long-run pool; weak switching.</span></article><article><strong>Guaranteed renewable</strong><span>Front-loaded premium; voluntary retention but limited mobility.</span></article><article><strong>Premium insurance</strong><span>Health shock triggers funds for higher future premiums.</span></article></div>`;
        };
        node.querySelectorAll("input").forEach((el)=>el.addEventListener("input",render)); render();
      }
    });
  }

  registerActivities();
})(window);
