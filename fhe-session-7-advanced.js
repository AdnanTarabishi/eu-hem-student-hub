// Session 7 mastery layer: deeper original study content, advanced labs and exam-ready practice.
(function (root) {
  "use strict";

  const TOPIC_ID = "fund-health-economics.adverse-selection";
  const COURSE_ID = "fund-health-econ-management";
  const STORAGE_KEY = "euhem-fhe-session7-mastery-v1";
  const ADVANCED_ACTIVITY_IDS = [
    "selection-premium-decomposition",
    "selection-single-crossing",
    "selection-cream-skimming",
    "selection-contract-menu",
    "selection-public-base",
  ];

  const flashcards = [
    {
      id: "fund-health-economics.fc.337",
      topic: TOPIC_ID,
      front: "What is the marginal rate of substitution between healthy- and sick-state income in Session 7 contract space?",
      back: "Along an indifference curve, dyS/dyH = −[(1−p)U′(yH)]/[pU′(yS)]. It is negative because income in one state can compensate for income in the other.",
    },
    {
      id: "fund-health-economics.fc.338",
      topic: TOPIC_ID,
      front: "How are the L, pooling and H zero-profit lines ordered by slope?",
      back: "Because pL < p̄ < pH, the low-risk line is steepest, the pooling line is intermediate, and the high-risk line is flattest.",
    },
    {
      id: "fund-health-economics.fc.339",
      topic: TOPIC_ID,
      front: "Why does the pooling transfer balance in aggregate?",
      back: "Each low risk pays (pH−pL)(1−λ)I above own expected cost and each high risk receives (pH−pL)λI below own expected cost; weighting by λ and 1−λ makes aggregate contributions equal aggregate subsidies.",
    },
    {
      id: "fund-health-economics.fc.340",
      topic: TOPIC_ID,
      front: "What two forces can raise the premium of a more generous plan?",
      back: "A coverage effect—larger indemnity—and a composition effect—the plan attracts a larger share of high-risk enrollees.",
    },
    {
      id: "fund-health-economics.fc.341",
      topic: TOPIC_ID,
      front: "Write the two incentive-compatibility constraints for a separating menu.",
      back: "Low risk must prefer CL to CH, and high risk must prefer CH to CL: EUL(CL) ≥ EUL(CH) and EUH(CH) ≥ EUH(CL).",
    },
    {
      id: "fund-health-economics.fc.342",
      topic: TOPIC_ID,
      front: "How does participation differ from incentive compatibility?",
      back: "Participation asks whether a type prefers an offered contract to remaining uninsured. Incentive compatibility asks whether each type prefers the contract intended for it to the other offered contract.",
    },
    {
      id: "fund-health-economics.fc.343",
      topic: TOPIC_ID,
      front: "What is a cream-skimming deviation?",
      back: "A contract designed to attract profitable low risks away from a pooling contract while remaining unattractive to high risks.",
    },
    {
      id: "fund-health-economics.fc.344",
      topic: TOPIC_ID,
      front: "What information is disclosed ex post in a separating equilibrium?",
      back: "A consumer's contract choice reveals the risk type implied by self-selection, even though the insurer could not observe type ex ante.",
    },
    {
      id: "fund-health-economics.fc.345",
      topic: TOPIC_ID,
      front: "Why is solving adverse selection through separation not first best?",
      back: "Sorting is achieved, but low risks receive only partial coverage and therefore bear residual risk; high-risk insurance also remains expensive.",
    },
    {
      id: "fund-health-economics.fc.346",
      topic: TOPIC_ID,
      front: "How does a compulsory pooling base change the starting point for supplementary insurance?",
      back: "The mandatory premium lowers healthy-state income and the mandatory indemnity raises sick-state income, moving the common endowment from A to a new point G.",
    },
    {
      id: "fund-health-economics.fc.347",
      topic: TOPIC_ID,
      front: "Why can supplementary private insurance coexist with compulsory basic insurance in the lecture?",
      back: "The compulsory layer creates pooling and cross-subsidy; supplementary contracts can then add coverage from the new endowment while preserving plan choice above the base.",
    },
    {
      id: "fund-health-economics.fc.348",
      topic: TOPIC_ID,
      front: "What is the long-run institutional conclusion of Session 7?",
      back: "Keeping insurance affordable after people become high risk requires durable cross-subsidies from low-risk to high-risk individuals, which are difficult to sustain without collective or government-backed arrangements.",
    },
  ];

  const questions = [
    {
      id: "fund-health-economics.q.331",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "hard",
      category: "Plan premium decomposition",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "A fuller plan has both a larger indemnity and a lower fraction of low-risk enrollees. Which statement is correct?",
      options: [
        "Its premium can rise only because indemnity rises",
        "Its premium can rise through both the coverage effect and a less favourable enrollee mix",
        "Its premium must fall because high risks value insurance more",
        "The enrollee mix is irrelevant to expected cost",
      ],
      answer: "B",
      explanation: "Session 7 separates the direct effect of more coverage from the adverse-selection composition effect.",
    },
    {
      id: "fund-health-economics.q.332",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "hard",
      category: "Pooling transfer",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "Let pL=0.10, pH=0.30, λ=0.75 and I=€1,000. What is the pooling premium?",
      options: ["€100", "€150", "€225", "€300"],
      answer: "B",
      explanation: "p̄=0.75×0.10+0.25×0.30=0.15, so πP=0.15×€1,000=€150.",
    },
    {
      id: "fund-health-economics.q.333",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "hard",
      category: "Pooling transfer",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "Using pL=0.10, pH=0.30, λ=0.75 and I=€1,000, how much does each low-risk enrollee pay above own expected payout?",
      options: ["€25", "€50", "€100", "€150"],
      answer: "B",
      explanation: "The pooling premium is €150 and the low-risk expected payout is €100, so the individual contribution above own cost is €50.",
    },
    {
      id: "fund-health-economics.q.334",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "hard",
      category: "Contract space",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "If y=100, M=60, π=12 and I=40, what are the contract coordinates (yH,yS)?",
      options: ["(88,68)", "(88,48)", "(100,80)", "(92,72)"],
      answer: "A",
      explanation: "yH=100−12=88 and yS=100−12−60+40=68.",
    },
    {
      id: "fund-health-economics.q.335",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "hard",
      category: "Zero-profit line",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "Which risk type has the flatter zero-profit line in yH–yS space?",
      options: ["The lower-risk type", "The higher-risk type", "Both have slope −1", "The slope does not depend on p"],
      answer: "B",
      explanation: "The absolute slope is (1−p)/p, which falls as p rises.",
    },
    {
      id: "fund-health-economics.q.336",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "hard",
      category: "Incentive compatibility",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "Which inequality is required to stop the high-risk type from imitating the low-risk contract?",
      options: ["EUH(CH) ≥ EUH(CL)", "EUL(CH) ≥ EUL(CL)", "πH ≤ πL", "IH = 0"],
      answer: "A",
      explanation: "The high-risk type must weakly prefer the contract intended for H.",
    },
    {
      id: "fund-health-economics.q.337",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "hard",
      category: "Cream-skimming",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "A deviation Q can destroy pooling when Q is:",
      options: [
        "Preferred by both types and loss-making",
        "Preferred by L, rejected by H and profitable when selected by L",
        "Rejected by both types",
        "Located above the H zero-profit line",
      ],
      answer: "B",
      explanation: "That is the competitive cream-skimming logic used to show non-existence of pooling equilibrium.",
    },
    {
      id: "fund-health-economics.q.338",
      topic: TOPIC_ID,
      type: "mcq",
      difficulty: "hard",
      category: "Government intervention",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "Why can a compulsory partial pooling base improve efficiency in the lecture model?",
      options: [
        "It removes all risk without any transfer",
        "It moderately subsidises H and can relax the coverage restriction imposed on L",
        "It makes every consumer identical",
        "It guarantees that no insurer ever earns zero profit",
      ],
      answer: "B",
      explanation: "The policy can lower the informational cost of separating types while introducing a controlled cross-subsidy.",
    },
    {
      id: "fund-health-economics.q.339",
      topic: TOPIC_ID,
      type: "true-false",
      difficulty: "medium",
      category: "Single crossing",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "At a common contract point, the high-risk indifference curve is flatter because the high-risk type puts more probability weight on sick-state income.",
      answer: true,
      explanation: "This type-dependent slope supports self-selection between contracts.",
    },
    {
      id: "fund-health-economics.q.340",
      topic: TOPIC_ID,
      type: "true-false",
      difficulty: "medium",
      category: "Pooling",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "A pooling contract that breaks even for the whole population is actuarially fair for each risk type separately.",
      answer: false,
      explanation: "It is less favourable than type-specific fair pricing for L and more favourable for H.",
    },
    {
      id: "fund-health-economics.q.341",
      topic: TOPIC_ID,
      type: "true-false",
      difficulty: "hard",
      category: "Equilibrium",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "Session 7 provides a universal numerical threshold for λ above which equilibrium never exists.",
      answer: false,
      explanation: "The lecture states that a very large low-risk share can eliminate equilibrium, but it does not provide a universal threshold independent of preferences and other parameters.",
    },
    {
      id: "fund-health-economics.q.342",
      topic: TOPIC_ID,
      type: "true-false",
      difficulty: "medium",
      category: "Premium risk",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "Premium insurance is designed to help finance higher future premiums after a health-status shock reveals persistently higher expected costs.",
      answer: true,
      explanation: "That is the Cochrane-style solution described in the final part of the lecture.",
    },
    {
      id: "fund-health-economics.q.343",
      topic: TOPIC_ID,
      type: "short-answer",
      difficulty: "hard",
      category: "Worked derivation",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "Derive the pooling premium and the individual transfer for each type when pL=0.10, pH=0.30, λ=0.75 and I=€1,000.",
      answer: "The mixed probability is p̄=λpL+(1−λ)pH=0.75×0.10+0.25×0.30=0.15. Therefore πP=p̄I=€150. A low risk has expected payout pLI=€100 and pays €50 above own expected cost. A high risk has expected payout pHI=€300 and pays €150 below own expected cost. Aggregate contributions and subsidies balance: 0.75×€50=0.25×€150=€37.50 per member of the total population.",
      explanation: "Show both the per-person transfer and the population-weighted balance.",
    },
    {
      id: "fund-health-economics.q.344",
      topic: TOPIC_ID,
      type: "short-answer",
      difficulty: "hard",
      category: "Pooling non-existence",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "Explain the complete competitive logic by which a candidate pooling contract unravels.",
      answer: "The pooling contract charges an average premium and is therefore less favourable than type-specific fair pricing for low risks. Because low- and high-risk indifference curves have different slopes, an entrant can design a less generous contract that low risks prefer but high risks reject. If that contract lies below the low-risk zero-profit line, it earns positive expected profit when selected by low risks. Low risks leave the pool, the remaining pool becomes more expensive, and the original pooling contract cannot be an equilibrium.",
      explanation: "A strong answer links average pricing, single crossing, profitable entry and the change in the remaining risk mix.",
    },
    {
      id: "fund-health-economics.q.345",
      topic: TOPIC_ID,
      type: "short-answer",
      difficulty: "hard",
      category: "Separating equilibrium",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "State the participation and incentive-compatibility checks for a two-contract separating menu.",
      answer: "Participation requires each type to prefer its chosen contract to the uninsured endowment. Incentive compatibility requires EUL(CL)≥EUL(CH) and EUH(CH)≥EUH(CL). Competitive feasibility additionally requires that each contract break even for the type selecting it. In the standard separating outcome H receives fair full insurance, while L receives fair partial insurance restricted enough that H does not imitate it.",
      explanation: "Keep participation, self-selection and insurer break-even as separate conditions.",
    },
    {
      id: "fund-health-economics.q.346",
      topic: TOPIC_ID,
      type: "short-answer",
      difficulty: "hard",
      category: "Policy evaluation",
      source: "EU-HEM Hub original practice · Session 7 mastery",
      question: "Explain why compulsory basic pooling plus supplementary insurance can be welfare enhancing in the lecture model.",
      answer: "The compulsory base pools both types at the population break-even premium and creates a transfer from L to H. This makes coverage more affordable for H. It also moves the common endowment and can relax the incentive-compatibility restriction that previously forced L to accept very partial coverage. Supplementary contracts can then add coverage above the mandatory base. A suitable policy can therefore make H better off through subsidy and L better off through less rationing, although the result is conditional on the chosen policy and model assumptions.",
      explanation: "Do not claim that every mandate is beneficial; the welfare result concerns an appropriately chosen second-best policy.",
    },
  ];

  const concepts = [
    {
      id: "concept.mixed-risk-break-even",
      term: "Mixed-risk break-even probability",
      explanation: "The population-weighted sickness probability p̄=λpL+(1−λ)pH used to price a contract chosen by both types.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.single-crossing",
      term: "Single-crossing property",
      explanation: "At a common contract point, high- and low-risk indifference curves have different slopes because the two types weight health states differently.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.incentive-compatibility",
      term: "Incentive compatibility",
      explanation: "A contract menu is incentive compatible when each risk type prefers the contract intended for it to the contract intended for the other type.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.cream-skimming",
      term: "Cream-skimming deviation",
      explanation: "A profitable entrant contract that attracts low risks away from a mixed pool without attracting high risks.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.quantity-rationing-insurance",
      term: "Insurance quantity rationing",
      explanation: "A low-risk consumer is prevented from buying the preferred full amount of insurance because greater coverage would attract high risks.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.equilibrium-nonexistence",
      term: "Equilibrium non-existence",
      explanation: "A situation in which neither a pooling nor a separating set of contracts survives all profitable competitive deviations.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.compulsory-pooling-base",
      term: "Compulsory pooling base",
      explanation: "A mandatory basic contract priced at the population average risk, creating a common insured endowment before supplementary choice.",
      topics: [TOPIC_ID],
    },
    {
      id: "concept.premium-insurance",
      term: "Premium insurance",
      explanation: "Protection against the future premium increase caused by a persistent deterioration in an individual's expected risk class.",
      topics: [TOPIC_ID],
    },
  ];

  root.FHESession7Mastery = {
    topic: TOPIC_ID,
    flashcards,
    questions,
    concepts,
    activityIds: ADVANCED_ACTIVITY_IDS,
  };

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);

  const fmt = (value, digits = 2) =>
    Number.isFinite(value)
      ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })
      : "—";

  const read = (node, id, min = -Infinity, max = Infinity) => {
    const value = Number(node.querySelector(`#${id}`)?.value);
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
  };

  const numberInput = (id, label, value, attrs = "") =>
    `<div class="control"><label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" ${attrs}></div>`;

  const rangeInput = (id, label, value, min, max, step, left, right) =>
    `<div class="control"><label for="${id}">${label}: <strong id="${id}-value">${value}</strong></label><input id="${id}" type="range" value="${value}" min="${min}" max="${max}" step="${step}"><div class="range-labels"><span>${left}</span><span>${right}</span></div></div>`;

  const stats = (rows) =>
    `<dl class="activity-stats">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;

  const sqrtEU = (p, healthy, sick) => {
    if (healthy < 0 || sick < 0) return NaN;
    return (1 - p) * Math.sqrt(healthy) + p * Math.sqrt(sick);
  };

  function registerAdvancedActivities() {
    if (!root.LectureActivities?.register) return;

    root.LectureActivities.register("selection-premium-decomposition", {
      title: "Decompose a generous plan's premium",
      intro: "Separate the direct coverage effect from the adverse-selection composition effect. The plan-specific low-risk shares are teaching inputs based on the lecture's premium equations.",
      build(node) {
        node.innerHTML =
          `<div class="activity-controls">` +
          rangeInput("spd-pL", "Low-risk sickness probability (%)", 10, 1, 40, 1, "1%", "40%") +
          rangeInput("spd-pH", "High-risk sickness probability (%)", 30, 5, 80, 1, "5%", "80%") +
          numberInput("spd-IP", "Partial-plan indemnity (€)", 600, 'min="0" step="50"') +
          numberInput("spd-IF", "Fuller-plan indemnity (€)", 1000, 'min="0" step="50"') +
          rangeInput("spd-lambdaP", "Low-risk share in partial plan (%)", 80, 0, 100, 1, "0%", "100%") +
          rangeInput("spd-lambdaF", "Low-risk share in fuller plan (%)", 55, 0, 100, 1, "0%", "100%") +
          `</div><div id="spd-output" class="activity-output" aria-live="polite"></div>`;

        const render = () => {
          const pL = read(node, "spd-pL", 1, 40) / 100;
          const pH = Math.max(read(node, "spd-pH", 5, 80) / 100, pL + 0.001);
          const IP = read(node, "spd-IP", 0, 1e9);
          const IF = read(node, "spd-IF", 0, 1e9);
          const lambdaP = read(node, "spd-lambdaP", 0, 100) / 100;
          const lambdaF = read(node, "spd-lambdaF", 0, 100) / 100;
          node.querySelector("#spd-pL-value").textContent = `${fmt(pL * 100, 0)}%`;
          node.querySelector("#spd-pH-value").textContent = `${fmt(pH * 100, 0)}%`;
          node.querySelector("#spd-lambdaP-value").textContent = `${fmt(lambdaP * 100, 0)}%`;
          node.querySelector("#spd-lambdaF-value").textContent = `${fmt(lambdaF * 100, 0)}%`;

          const pbarP = lambdaP * pL + (1 - lambdaP) * pH;
          const pbarF = lambdaF * pL + (1 - lambdaF) * pH;
          const premiumP = pbarP * IP;
          const premiumF = pbarF * IF;
          const coverageOnly = pbarP * IF;
          const coverageEffect = coverageOnly - premiumP;
          const mixEffect = premiumF - coverageOnly;

          node.querySelector("#spd-output").innerHTML =
            `<div class="formula">π<sup>Partial</sup> = €${fmt(premiumP)} &nbsp; · &nbsp; π<sup>Fuller</sup> = €${fmt(premiumF)}</div>` +
            stats([
              ["Premium increase", `€${fmt(premiumF - premiumP)}`],
              ["Coverage effect at old mix", `€${fmt(coverageEffect)}`],
              ["Composition effect", `€${fmt(mixEffect)}`],
              ["Partial-plan average risk", `${fmt(pbarP * 100, 1)}%`],
              ["Fuller-plan average risk", `${fmt(pbarF * 100, 1)}%`],
            ]) +
            `<p>${mixEffect > 0 ? "The fuller plan is more expensive partly because its enrollee mix is riskier." : mixEffect < 0 ? "With these inputs, the fuller plan has a more favourable risk mix, offsetting part of the coverage cost." : "Both plans have the same average risk mix; the premium difference comes only from coverage."}</p>`;
        };
        node.querySelectorAll("input").forEach((input) => input.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("selection-single-crossing", {
      title: "See single crossing from the MRS formula",
      intro: "At the same contract point, change pL and pH. A higher sickness probability makes the indifference curve flatter because sick-state income receives more weight.",
      build(node) {
        node.innerHTML =
          `<div class="activity-controls">` +
          numberInput("ssc-yH", "Healthy-state income yH", 90, 'min="1" step="1"') +
          numberInput("ssc-yS", "Sick-state income yS", 60, 'min="1" step="1"') +
          rangeInput("ssc-pL", "pL (%)", 10, 1, 50, 1, "1%", "50%") +
          rangeInput("ssc-pH", "pH (%)", 30, 5, 80, 1, "5%", "80%") +
          `</div><div id="ssc-output" class="activity-output" aria-live="polite"></div>`;

        const render = () => {
          const yH = read(node, "ssc-yH", 1, 1e9);
          const yS = read(node, "ssc-yS", 1, 1e9);
          const pL = read(node, "ssc-pL", 1, 50) / 100;
          const pH = Math.max(read(node, "ssc-pH", 5, 80) / 100, pL + 0.001);
          node.querySelector("#ssc-pL-value").textContent = `${fmt(pL * 100, 0)}%`;
          node.querySelector("#ssc-pH-value").textContent = `${fmt(pH * 100, 0)}%`;

          const uprimeH = 1 / (2 * Math.sqrt(yH));
          const uprimeS = 1 / (2 * Math.sqrt(yS));
          const slopeL = -((1 - pL) * uprimeH) / (pL * uprimeS);
          const slopeH = -((1 - pH) * uprimeH) / (pH * uprimeS);
          const scale = 2.5;
          const x0 = 300;
          const y0 = 150;
          const line = (slope, color, label, offset) => {
            const dx = 90;
            const dy = Math.max(-105, Math.min(105, slope * dx / scale));
            return `<path d="M${x0 - dx} ${y0 + dy} Q${x0} ${y0 - offset} ${x0 + dx} ${y0 - dy}" fill="none" stroke="${color}" stroke-width="4"/><text x="${x0 + 98}" y="${y0 - dy + 4}" fill="${color}" font-size="13">${label}</text>`;
          };

          node.querySelector("#ssc-output").innerHTML =
            `<div class="formula">MRS<sub>H,S</sub> = −[(1−p)U′(yH)]/[pU′(yS)]</div>` +
            `<svg class="activity-chart" viewBox="0 0 640 300" role="img" aria-label="Original single-crossing illustration with a steeper low-risk indifference curve and flatter high-risk curve."><path d="M55 25V245H590" fill="none" stroke="currentColor" opacity=".55"/><circle cx="${x0}" cy="${y0}" r="7" fill="currentColor"/>${line(slopeL, "#2f7b73", "Low risk L", 18)}${line(slopeH, "#c96548", "High risk H", -18)}<text x="535" y="270" fill="currentColor" font-size="12">healthy income yH</text><text x="14" y="28" fill="currentColor" font-size="12">sick income yS</text></svg>` +
            stats([
              ["Low-risk slope", fmt(slopeL, 3)],
              ["High-risk slope", fmt(slopeH, 3)],
              ["Flatter curve", Math.abs(slopeH) < Math.abs(slopeL) ? "High-risk / frail" : "Check probabilities"],
            ]) +
            `<p>Square-root utility is used only to make the lecture's slope formula numerical. The qualitative single-crossing result comes from pH &gt; pL.</p>`;
        };
        node.querySelectorAll("input").forEach((input) => input.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("selection-cream-skimming", {
      title: "Test a cream-skimming deviation",
      intro: "Compare a population pooling contract Z with an entrant contract Q. A classic deviation attracts L, is rejected by H and earns positive profit when selected by L.",
      build(node) {
        node.innerHTML =
          `<div class="activity-controls">` +
          numberInput("scs-y", "Income y", 100, 'min="1" step="1"') +
          numberInput("scs-M", "Medical loss M", 60, 'min="0" step="1"') +
          rangeInput("scs-pL", "pL (%)", 10, 1, 40, 1, "1%", "40%") +
          rangeInput("scs-pH", "pH (%)", 30, 5, 80, 1, "5%", "80%") +
          rangeInput("scs-lambda", "Low-risk share λ (%)", 70, 1, 99, 1, "1%", "99%") +
          numberInput("scs-IZ", "Pooling indemnity IZ", 45, 'min="0" step="1"') +
          numberInput("scs-IQ", "Deviation indemnity IQ", 12, 'min="0" step="1"') +
          numberInput("scs-piQ", "Deviation premium πQ", 1.5, 'min="0" step="0.1"') +
          `</div><div id="scs-output" class="activity-output" aria-live="polite"></div>`;

        const render = () => {
          const y = read(node, "scs-y", 1, 1e9);
          const M = read(node, "scs-M", 0, y - 0.001);
          const pL = read(node, "scs-pL", 1, 40) / 100;
          const pH = Math.max(read(node, "scs-pH", 5, 80) / 100, pL + 0.001);
          const lambda = read(node, "scs-lambda", 1, 99) / 100;
          const IZ = read(node, "scs-IZ", 0, M * 2);
          const IQ = read(node, "scs-IQ", 0, M * 2);
          const piQ = read(node, "scs-piQ", 0, y);
          node.querySelector("#scs-pL-value").textContent = `${fmt(pL * 100, 0)}%`;
          node.querySelector("#scs-pH-value").textContent = `${fmt(pH * 100, 0)}%`;
          node.querySelector("#scs-lambda-value").textContent = `${fmt(lambda * 100, 0)}%`;

          const pbar = lambda * pL + (1 - lambda) * pH;
          const piZ = pbar * IZ;
          const zH = y - piZ;
          const zS = y - piZ - M + IZ;
          const qH = y - piQ;
          const qS = y - piQ - M + IQ;
          const euLZ = sqrtEU(pL, zH, zS);
          const euHZ = sqrtEU(pH, zH, zS);
          const euLQ = sqrtEU(pL, qH, qS);
          const euHQ = sqrtEU(pH, qH, qS);
          const lPrefersQ = euLQ > euLZ;
          const hRejectsQ = euHQ <= euHZ;
          const profitL = piQ - pL * IQ;
          const classic = lPrefersQ && hRejectsQ && profitL > 0;

          node.querySelector("#scs-output").innerHTML =
            `<div class="formula">${classic ? "Cream-skimming deviation found" : "Conditions not all satisfied"}</div>` +
            stats([
              ["Pooling premium πZ", fmt(piZ)],
              ["L: EU(Q) − EU(Z)", fmt(euLQ - euLZ, 4)],
              ["H: EU(Q) − EU(Z)", fmt(euHQ - euHZ, 4)],
              ["Entrant profit if only L selects Q", fmt(profitL)],
              ["L prefers Q", lPrefersQ ? "Yes" : "No"],
              ["H rejects Q", hRejectsQ ? "Yes" : "No"],
            ]) +
            `<p>${classic ? "Q attracts the profitable low-risk group without attracting high risks, so Z cannot be a pooling equilibrium." : "Adjust Q. The classic deviation needs L to prefer it, H not to prefer it, and positive expected profit at pL."}</p>` +
            `<p class="small">Utility uses U(y)=√y as a transparent teaching assumption; the competitive logic follows the lecture.</p>`;
        };
        node.querySelectorAll("input").forEach((input) => input.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("selection-contract-menu", {
      title: "Audit a separating contract menu",
      intro: "Check participation, self-selection and break-even separately. The low-risk contract is priced fairly at pL; the high-risk contract is fair full insurance at pH.",
      build(node) {
        node.innerHTML =
          `<div class="activity-controls">` +
          numberInput("scm-y", "Income y", 100, 'min="1" step="1"') +
          numberInput("scm-M", "Medical loss M", 60, 'min="0" step="1"') +
          rangeInput("scm-pL", "pL (%)", 10, 1, 40, 1, "1%", "40%") +
          rangeInput("scm-pH", "pH (%)", 30, 5, 80, 1, "5%", "80%") +
          rangeInput("scm-IL", "Low-risk indemnity IL", 8, 0, 60, 1, "0", "60") +
          `</div><div id="scm-output" class="activity-output" aria-live="polite"></div>`;

        const render = () => {
          const y = read(node, "scm-y", 1, 1e9);
          const M = read(node, "scm-M", 0, y - 0.001);
          const pL = read(node, "scm-pL", 1, 40) / 100;
          const pH = Math.max(read(node, "scm-pH", 5, 80) / 100, pL + 0.001);
          const slider = node.querySelector("#scm-IL");
          slider.max = String(Math.max(1, Math.round(M)));
          const IL = read(node, "scm-IL", 0, M);
          node.querySelector("#scm-pL-value").textContent = `${fmt(pL * 100, 0)}%`;
          node.querySelector("#scm-pH-value").textContent = `${fmt(pH * 100, 0)}%`;
          node.querySelector("#scm-IL-value").textContent = fmt(IL, 0);

          const piL = pL * IL;
          const lH = y - piL;
          const lS = y - piL - M + IL;
          const IH = M;
          const piH = pH * IH;
          const hIncome = y - piH;
          const uninsuredL = sqrtEU(pL, y, y - M);
          const uninsuredH = sqrtEU(pH, y, y - M);
          const euLCL = sqrtEU(pL, lH, lS);
          const euLCH = Math.sqrt(hIncome);
          const euHCL = sqrtEU(pH, lH, lS);
          const euHCH = Math.sqrt(hIncome);
          const partL = euLCL >= uninsuredL;
          const partH = euHCH >= uninsuredH;
          const icL = euLCL >= euLCH;
          const icH = euHCH >= euHCL;
          const menuWorks = partL && partH && icL && icH;

          node.querySelector("#scm-output").innerHTML =
            `<div class="formula">${menuWorks ? "Separating menu is incentive compatible" : "Menu fails at least one check"}</div>` +
            stats([
              ["Low-risk premium πL", fmt(piL)],
              ["High-risk premium πH", fmt(piH)],
              ["L participation", partL ? "Pass" : "Fail"],
              ["H participation", partH ? "Pass" : "Fail"],
              ["L prefers CL to CH", icL ? "Pass" : "Fail"],
              ["H prefers CH to CL", icH ? "Pass" : "Fail"],
            ]) +
            `<p>${menuWorks ? "The low-risk indemnity is restricted enough to deter H while remaining attractive to L." : "Move IL. More low-risk coverage helps L but can eventually tempt H to imitate."}</p>` +
            `<p class="small">The numerical preference comparison uses square-root utility. The lecture itself does not impose this specific utility function.</p>`;
        };
        node.querySelectorAll("input").forEach((input) => input.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("selection-public-base", {
      title: "Layer compulsory pooling and supplementary coverage",
      intro: "Build a mandatory population-priced base, then inspect its transfer and the remaining uninsured loss before supplementary contracts.",
      build(node) {
        node.innerHTML =
          `<div class="activity-controls">` +
          numberInput("spb-y", "Income y", 100, 'min="1" step="1"') +
          numberInput("spb-M", "Medical loss M", 60, 'min="0" step="1"') +
          rangeInput("spb-pL", "pL (%)", 10, 1, 40, 1, "1%", "40%") +
          rangeInput("spb-pH", "pH (%)", 30, 5, 80, 1, "5%", "80%") +
          rangeInput("spb-lambda", "Low-risk share λ (%)", 70, 1, 99, 1, "1%", "99%") +
          rangeInput("spb-IG", "Mandatory base indemnity IG", 20, 0, 60, 1, "0", "60") +
          `</div><div id="spb-output" class="activity-output" aria-live="polite"></div>`;

        const render = () => {
          const y = read(node, "spb-y", 1, 1e9);
          const M = read(node, "spb-M", 0, y - 0.001);
          const pL = read(node, "spb-pL", 1, 40) / 100;
          const pH = Math.max(read(node, "spb-pH", 5, 80) / 100, pL + 0.001);
          const lambda = read(node, "spb-lambda", 1, 99) / 100;
          const slider = node.querySelector("#spb-IG");
          slider.max = String(Math.max(1, Math.round(M)));
          const IG = read(node, "spb-IG", 0, M);
          node.querySelector("#spb-pL-value").textContent = `${fmt(pL * 100, 0)}%`;
          node.querySelector("#spb-pH-value").textContent = `${fmt(pH * 100, 0)}%`;
          node.querySelector("#spb-lambda-value").textContent = `${fmt(lambda * 100, 0)}%`;
          node.querySelector("#spb-IG-value").textContent = fmt(IG, 0);

          const pbar = lambda * pL + (1 - lambda) * pH;
          const piG = pbar * IG;
          const healthy = y - piG;
          const sick = y - piG - M + IG;
          const transferL = piG - pL * IG;
          const subsidyH = pH * IG - piG;

          node.querySelector("#spb-output").innerHTML =
            `<div class="formula">πG = [λpL+(1−λ)pH]IG = ${fmt(piG)}</div>` +
            stats([
              ["New healthy-state endowment", fmt(healthy)],
              ["New sick-state endowment", fmt(sick)],
              ["Remaining uninsured loss M−IG", fmt(M - IG)],
              ["Contribution above own cost per L", fmt(transferL)],
              ["Subsidy below own cost per H", fmt(subsidyH)],
            ]) +
            `<div class="s7-layer-diagram"><span>Mandatory pooling base</span><b>+</b><span>Supplementary private choice</span><b>→</b><span>More complete final coverage</span></div>` +
            `<p>The base contract itself does not guarantee a Pareto improvement. Session 7's welfare result requires a suitably chosen policy that both supports H and relaxes L's rationing constraint.</p>`;
        };
        node.querySelectorAll("input").forEach((input) => input.addEventListener("input", render));
        render();
      },
    });
  }

  function wrapLectureLoader() {
    const previous = root.loadLecture;
    if (typeof previous !== "function" || previous.__fheSession7MasteryWrapped) return;
    const wrapped = async function (moduleData, topic, readText) {
      const config = await previous.call(this, moduleData, topic, readText);
      if (topic?.id === TOPIC_ID && config) {
        const activities = Array.isArray(config.activities) ? config.activities : [];
        return {
          ...config,
          activities: [...activities, ...ADVANCED_ACTIVITY_IDS.filter((id) => !activities.includes(id))],
        };
      }
      return config;
    };
    wrapped.__fheSession7MasteryWrapped = true;
    root.loadLecture = wrapped;
  }

  function masteryHtml() {
    return `
      <div class="page-head s7-mastery-head">
        <p class="eyebrow">05 / Mastery studio</p>
        <h1>Move from recognising terms to solving the model.</h1>
        <p>A structured route through derivations, equilibrium logic, common traps and exam-ready explanations. All examples are original Student Hub teaching material built from the Session 7 framework.</p>
      </div>

      <section class="s7-mastery-route" aria-labelledby="s7-route-title">
        <div class="section-intro">
          <div><p class="eyebrow">A 70-MINUTE ROUTE</p><h2 id="s7-route-title">Study in the order the model needs.</h2></div>
          <p>Do not start with pooling versus separating. First secure the benchmark, the geometry and the information problem.</p>
        </div>
        <div class="s7-route-grid">
          <article><span>01 · 10 min</span><strong>Recall Session 6</strong><p>Fair premium, state incomes and why risk aversion favours full insurance.</p></article>
          <article><span>02 · 15 min</span><strong>Learn contract space</strong><p>Endowment, 45° line, indifference curves and zero-profit lines.</p></article>
          <article><span>03 · 20 min</span><strong>Trace market failure</strong><p>First-best imitation, pooling deviation and separating rationing.</p></article>
          <article><span>04 · 15 min</span><strong>Evaluate policy</strong><p>Compulsory pooling, supplementary insurance and premium risk.</p></article>
          <article><span>05 · 10 min</span><strong>Write from memory</strong><p>Use the four answer frameworks and check every equilibrium condition.</p></article>
        </div>
      </section>

      <section class="s7-bridge">
        <div class="section-intro">
          <div><p class="eyebrow">SESSION 6 → SESSION 7</p><h2>One assumption changes. The entire market result changes.</h2></div>
        </div>
        <div class="s7-bridge-grid">
          <article class="card"><span class="pill">SESSION 6 BENCHMARK</span><h3>One known risk probability</h3><p>At π=pI, a risk-averse consumer chooses I=M. Competitive fair full insurance is the ideal contract.</p></article>
          <article class="card"><span class="pill">SESSION 7 INFORMATION PROBLEM</span><h3>Two privately known probabilities</h3><p>Consumers know whether p=pL or p=pH, while insurers know only the population share λ.</p></article>
          <article class="card"><span class="pill">MARKET CONSEQUENCE</span><h3>First best is not incentive compatible</h3><p>H imitates the cheaper L contract. Pooling is vulnerable to cream-skimming; separation rations L.</p></article>
        </div>
      </section>

      <section class="s7-worked-case" aria-labelledby="s7-worked-title">
        <div class="section-intro">
          <div><p class="eyebrow">WORKED CASE</p><h2 id="s7-worked-title">Price a mixed pool and verify the transfer.</h2></div>
          <p>Use pL=0.10, pH=0.30, λ=0.75 and I=€1,000.</p>
        </div>
        <div class="s7-calculation-chain">
          <div><span>1 · Average probability</span><strong>p̄ = 0.75(0.10)+0.25(0.30)=0.15</strong></div>
          <div><span>2 · Pooling premium</span><strong>πP = 0.15×€1,000 = €150</strong></div>
          <div><span>3 · Low-risk account</span><strong>€150−€100 = €50 contribution</strong></div>
          <div><span>4 · High-risk account</span><strong>€300−€150 = €150 subsidy</strong></div>
          <div><span>5 · Aggregate balance</span><strong>0.75×€50 = 0.25×€150 = €37.50</strong></div>
        </div>
        <div class="note"><strong>Exam phrase:</strong> the pooling contract breaks even for the population, not for each type. It embeds redistribution from L to H.</div>
      </section>

      <section class="s7-derivations">
        <div class="section-intro">
          <div><p class="eyebrow">DERIVATION DESK</p><h2>Four derivations worth being able to reproduce.</h2></div>
        </div>
        <div class="details-stack">
          <details open>
            <summary>1. Contract coordinates from (π,I)</summary>
            <div class="s7-derivation-body"><p>Start from endowment E=(y,y−M). The premium is paid in both states and the indemnity only when sick:</p><div class="formula">yH=y−π &nbsp;&nbsp; and &nbsp;&nbsp; yS=y−π−M+I</div><p>Graphically, move left by π and upward by I−π.</p></div>
          </details>
          <details>
            <summary>2. Zero-profit line</summary>
            <div class="s7-derivation-body"><p>Break-even requires expected net payout in sickness to equal premium revenue from healthy states:</p><div class="formula">p(I−π)=(1−p)π</div><p>Substitute π=y−yH and I−π=yS−(y−M):</p><div class="formula">yS=y−M+[(1−p)/p](y−yH)</div><p>The slope is −(1−p)/p.</p></div>
          </details>
          <details>
            <summary>3. Indifference-curve slope</summary>
            <div class="s7-derivation-body"><p>Hold expected utility constant:</p><div class="formula">dEU=pU′(yS)dyS+(1−p)U′(yH)dyH=0</div><div class="formula">dyS/dyH=−[(1−p)U′(yH)]/[pU′(yS)]</div><p>A larger p reduces the absolute slope, so H is flatter than L at a common point.</p></div>
          </details>
          <details>
            <summary>4. Pooling transfers</summary>
            <div class="s7-derivation-body"><div class="formula">πP=[λpL+(1−λ)pH]I</div><div class="formula">πP−pLI=(pH−pL)(1−λ)I&gt;0</div><div class="formula">πP−pHI=−(pH−pL)λI&lt;0</div><p>The first expression is L's contribution above own expected cost; the second is H's subsidy.</p></div>
          </details>
        </div>
      </section>

      <section class="s7-equilibrium-check">
        <div class="section-intro">
          <div><p class="eyebrow">EQUILIBRIUM CHECKLIST</p><h2>Never call an allocation an equilibrium before checking all four questions.</h2></div>
        </div>
        <div class="s7-check-grid">
          <article><span>01</span><strong>Participation</strong><p>Does each type prefer its selected contract to no insurance?</p></article>
          <article><span>02</span><strong>Self-selection</strong><p>Does L prefer CL and H prefer CH?</p></article>
          <article><span>03</span><strong>Break-even</strong><p>Does each contract earn zero expected profit for the type selecting it?</p></article>
          <article><span>04</span><strong>No profitable deviation</strong><p>Can an entrant offer a contract that attracts a profitable subset?</p></article>
        </div>
      </section>

      <section class="s7-decision-tree">
        <div class="section-intro">
          <div><p class="eyebrow">DECISION TREE</p><h2>How to reason from information to outcome.</h2></div>
        </div>
        <div class="s7-tree">
          <div><strong>Can insurers observe type?</strong><span>Yes → type-specific fair full insurance: first best.</span><span>No → continue.</span></div>
          <div><strong>Can one pooling contract survive cream-skimming?</strong><span>Standard RS result: no.</span></div>
          <div><strong>Can a separating menu satisfy participation, IC, break-even and no deviation?</strong><span>Yes → H full, L partial.</span><span>No → market equilibrium may not exist.</span></div>
          <div><strong>Can policy improve the feasible allocation?</strong><span>A suitable compulsory pooling base may subsidise H and relax L rationing.</span></div>
        </div>
      </section>

      <section class="s7-misconceptions">
        <div class="section-intro">
          <div><p class="eyebrow">COMMON TRAPS</p><h2>Six statements to correct before the exam.</h2></div>
        </div>
        <div class="s7-misconception-grid">
          <article><strong>“High risks cause adverse selection simply because they cost more.”</strong><p>Correction: the key is hidden information plus selection into plans, not high cost alone.</p></article>
          <article><strong>“A pooling contract that breaks even is an equilibrium.”</strong><p>Correction: it must also survive profitable cream-skimming deviations.</p></article>
          <article><strong>“Separating equilibrium solves the problem without welfare loss.”</strong><p>Correction: L is quantity constrained and retains residual risk.</p></article>
          <article><strong>“Partial insurance means the premium is unfair.”</strong><p>Correction: fullness concerns I; fairness concerns π relative to expected payout.</p></article>
          <article><strong>“The lecture gives a fixed λ threshold for non-existence.”</strong><p>Correction: it states that a sufficiently large L share can destabilise equilibrium, without a universal number.</p></article>
          <article><strong>“Any compulsory insurance is welfare improving.”</strong><p>Correction: the result concerns an appropriately designed second-best policy under the model assumptions.</p></article>
        </div>
      </section>

      <section class="s7-answer-frameworks">
        <div class="section-intro">
          <div><p class="eyebrow">EXAM WRITING</p><h2>Four answer frameworks that preserve the economic chain.</h2></div>
        </div>
        <div class="details-stack">
          <details>
            <summary>Explain adverse selection in health-plan competition</summary>
            <ol><li>Define heterogeneous expected risks and asymmetric information.</li><li>Write the average-premium equation.</li><li>Explain why generous plans attract a worse risk mix.</li><li>Separate the coverage effect from the composition effect.</li><li>Conclude with the effect on premiums and competition.</li></ol>
          </details>
          <details>
            <summary>Show why pooling equilibrium does not exist</summary>
            <ol><li>Define candidate Z on the pooling zero-profit line.</li><li>Show that Z redistributes from L to H.</li><li>Use single crossing to construct Q preferred by L but rejected by H.</li><li>Place Q below the L zero-profit line so it is profitable.</li><li>Conclude that free entry unravels Z.</li></ol>
          </details>
          <details>
            <summary>Describe separating equilibrium and its welfare cost</summary>
            <ol><li>Give H fair full insurance.</li><li>Restrict L to fair partial insurance.</li><li>State both incentive-compatibility inequalities.</li><li>Explain self-selection and ex-post information disclosure.</li><li>Identify L's quantity rationing and possible non-existence when λ is large.</li></ol>
          </details>
          <details>
            <summary>Explain the rationale for government intervention</summary>
            <ol><li>Start from L rationing or equilibrium non-existence.</li><li>Introduce a compulsory pooling contract on the population break-even line.</li><li>Show the L-to-H transfer.</li><li>Explain the move from A to G and supplementary coverage.</li><li>State the conditional welfare result and the long-run premium-risk problem.</li></ol>
          </details>
        </div>
      </section>

      <section class="s7-cases">
        <div class="section-intro">
          <div><p class="eyebrow">CASE CHALLENGE</p><h2>Diagnose the mechanism before opening the answer.</h2></div>
        </div>
        <div class="details-stack card">
          <details><summary>Case A · The generous plan keeps getting more expensive</summary><p>A generous plan attracts people who expect high use. Premiums rise; healthier members leave; the remaining mix worsens.</p><div class="note"><strong>Diagnosis:</strong> adverse selection with a composition feedback. The premium rise is not explained only by larger benefits.</div></details>
          <details><summary>Case B · Two fair full contracts are offered, but one collapses</summary><p>The low-risk contract is cheaper. High risks select it, and claims exceed the premium calculated with pL.</p><div class="note"><strong>Diagnosis:</strong> symmetric-information first best is not incentive compatible under hidden type.</div></details>
          <details><summary>Case C · Low risks ask for more coverage but cannot buy it</summary><p>Additional low-risk coverage would also attract high risks. The insurer therefore caps the low-risk indemnity.</p><div class="note"><strong>Diagnosis:</strong> quantity rationing in a separating equilibrium.</div></details>
          <details><summary>Case D · A diagnosis raises all future premiums</summary><p>Current medical bills may be insured, but the diagnosis permanently changes expected future cost.</p><div class="note"><strong>Diagnosis:</strong> premium risk. Lifetime commitment, guaranteed renewability or premium insurance address different parts of the problem.</div></details>
        </div>
      </section>

      <section class="s7-mastery-progress" aria-labelledby="s7-progress-title">
        <div class="section-intro">
          <div><p class="eyebrow">YOUR MASTERY CHECK</p><h2 id="s7-progress-title">Can you do these without looking?</h2></div>
          <p id="s7-mastery-score" aria-live="polite">0 of 10 mastered</p>
        </div>
        <div class="s7-checklist">
          ${[
            "Derive the average pooling premium.",
            "Calculate the L-to-H transfer.",
            "Map (π,I) into (yH,yS).",
            "Derive the zero-profit line.",
            "Explain why H's indifference curve is flatter.",
            "State the two equilibrium conditions.",
            "Explain the cream-skimming deviation.",
            "Write both incentive-compatibility constraints.",
            "Explain why L is quantity constrained.",
            "Distinguish medical-cost risk from premium risk.",
          ].map((item, index) => `<label><input type="checkbox" data-s7-mastery-item="${index}"><span>${item}</span></label>`).join("")}
        </div>
        <button class="btn secondary small-btn" type="button" id="s7-reset-mastery">Reset mastery check</button>
      </section>
    `;
  }

  function loadMasteryState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function initialiseMastery(section) {
    const state = new Set(loadMasteryState());
    const boxes = [...section.querySelectorAll("[data-s7-mastery-item]")];
    const score = section.querySelector("#s7-mastery-score");

    const render = () => {
      boxes.forEach((box) => {
        box.checked = state.has(Number(box.dataset.s7MasteryItem));
      });
      if (score) score.textContent = `${state.size} of ${boxes.length} mastered`;
    };

    boxes.forEach((box) => {
      box.addEventListener("change", () => {
        const id = Number(box.dataset.s7MasteryItem);
        if (box.checked) state.add(id);
        else state.delete(id);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...state]));
        } catch {
          // Storage is optional.
        }
        render();
      });
    });

    section.querySelector("#s7-reset-mastery")?.addEventListener("click", () => {
      state.clear();
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage is optional.
      }
      render();
    });
    render();
  }

  function installMasteryWorkspace() {
    const host = document.getElementById("session7-page");
    const nav = host?.querySelector(".lecture-toolbar nav");
    if (!host || !nav || host.querySelector('[data-session7-tab="mastery"]')) return false;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.session7Tab = "mastery";
    button.textContent = "05 · Mastery";
    button.setAttribute("aria-current", "false");

    const section = document.createElement("section");
    section.className = "s7-mastery";
    section.dataset.session7View = "mastery";
    section.hidden = true;
    section.innerHTML = masteryHtml();

    button.addEventListener("click", () => {
      host.querySelectorAll("[data-session7-view]").forEach((view) => {
        view.hidden = view.dataset.session7View !== "mastery";
      });
      host.querySelectorAll("[data-session7-tab]").forEach((tab) => {
        tab.setAttribute("aria-current", tab.dataset.session7Tab === "mastery" ? "page" : "false");
      });
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    nav.appendChild(button);
    host.appendChild(section);
    initialiseMastery(section);

    const heroActions = host.querySelector(".selection-session-hero .hero-actions");
    if (heroActions && !heroActions.querySelector("[data-open-s7-mastery]")) {
      const heroButton = document.createElement("button");
      heroButton.type = "button";
      heroButton.className = "btn secondary";
      heroButton.dataset.openS7Mastery = "true";
      heroButton.textContent = "Open mastery studio";
      heroButton.addEventListener("click", () => button.click());
      heroActions.appendChild(heroButton);
    }

    return true;
  }

  registerAdvancedActivities();
  wrapLectureLoader();

  if (typeof document !== "undefined") {
    if (!installMasteryWorkspace()) {
      const observer = new MutationObserver(() => {
        if (installMasteryWorkspace()) observer.disconnect();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      root.setTimeout(() => observer.disconnect(), 15000);
    }
  }

  root.FHESession7MasteryReady = true;
})(typeof window !== "undefined" ? window : globalThis);
