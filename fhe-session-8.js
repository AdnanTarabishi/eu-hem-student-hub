// Session 8 — Moral hazard, cost sharing and managed care: original interactive teaching tools.
(function (root) {
  "use strict";

  const TOPIC_ID = "fund-health-economics.moral-hazard";
  const currentTopic = new URLSearchParams(root.location.search).get("topic");
  if (currentTopic !== TOPIC_ID) return;

  root.document.body.classList.add("fhe-session8-page");

  const fmt = (value, digits = 2) =>
    Number.isFinite(value)
      ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })
      : "—";
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const input = (id, label, value, attrs = "") =>
    `<div class="control"><label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" ${attrs}></div>`;
  const range = (id, label, value, min, max, step, left, right) =>
    `<div class="control"><label for="${id}">${label}: <strong id="${id}-value">${value}</strong></label><input id="${id}" type="range" value="${value}" min="${min}" max="${max}" step="${step}"><div class="range-labels"><span>${left}</span><span>${right}</span></div></div>`;
  const select = (id, label, options) =>
    `<div class="control"><label for="${id}">${label}</label><select id="${id}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select></div>`;
  const output = (id) => `<div id="${id}" class="activity-output" aria-live="polite"></div>`;
  const read = (node, id, min = -Infinity, max = Infinity) => {
    const value = Number(node.querySelector(`#${id}`)?.value);
    const safe = Number.isFinite(value) ? value : min;
    return Math.max(min, Math.min(max, safe));
  };
  const stats = (items) =>
    `<dl class="activity-stats">${items.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
  const verdict = (title, text, good = false) =>
    `<div class="mh-verdict ${good ? "is-good" : "is-warn"}"><strong>${esc(title)}</strong><span>${esc(text)}</span></div>`;

  function registerActivities() {
    if (!root.LectureActivities?.register) return;

    root.LectureActivities.register("mh-expected-loss", {
      title: "Decompose expected loss",
      intro:
        "Change prevention and loss-reduction effort. The numerical response is a transparent Student Hub teaching assumption, not an empirical estimate.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("mhel-p0", "Baseline event probability p₀ (%)", 25, 'min="1" max="100" step="1"') +
          input("mhel-l0", "Baseline loss L₀ (€)", 10000, 'min="0" step="100"') +
          range("mhel-prevent", "Prevention effort eP (%)", 30, 0, 100, 1, "0%", "100%") +
          range("mhel-reduce", "Loss-reduction effort eL (%)", 40, 0, 100, 1, "0%", "100%") +
          "</div>" + output("mhel-output");

        const render = () => {
          const p0 = read(node, "mhel-p0", 1, 100) / 100;
          const l0 = read(node, "mhel-l0", 0, 1e12);
          const prevention = read(node, "mhel-prevent", 0, 100) / 100;
          const reduction = read(node, "mhel-reduce", 0, 100) / 100;
          node.querySelector("#mhel-prevent-value").textContent = `${fmt(prevention * 100, 0)}%`;
          node.querySelector("#mhel-reduce-value").textContent = `${fmt(reduction * 100, 0)}%`;

          // Teaching assumptions: maximum prevention effect 60%; maximum loss-reduction effect 70%.
          const p = p0 * (1 - 0.6 * prevention);
          const loss = l0 * (1 - 0.7 * reduction);
          const expected = p * loss;
          const baseline = p0 * l0;
          const avoided = baseline - expected;
          const pOnly = p * l0;
          const lOnly = p0 * loss;

          node.querySelector("#mhel-output").innerHTML =
            `<div class="formula">E[L] = ${fmt(p * 100, 1)}% × €${fmt(loss, 0)} = €${fmt(expected, 0)}</div>` +
            stats([
              ["Baseline expected loss", `€${fmt(baseline, 0)}`],
              ["Probability after prevention effort", `${fmt(p * 100, 1)}%`],
              ["Loss after loss-reduction effort", `€${fmt(loss, 0)}`],
              ["Expected loss with prevention only", `€${fmt(pOnly, 0)}`],
              ["Expected loss with loss reduction only", `€${fmt(lOnly, 0)}`],
              ["Expected loss avoided", `€${fmt(avoided, 0)}`],
            ]) +
            `<p>Insurance may weaken either margin: ex-ante moral hazard raises p by reducing prevention effort; ex-post moral hazard raises L by reducing loss-minimising effort after illness.</p>`;
        };
        node.querySelectorAll("input").forEach((control) => control.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("mh-coinsurance-dwl", {
      title: "Price the moral-hazard triangle",
      intro:
        "Use a linear demand curve. Lower coinsurance lowers the patient's price, increases utilisation and expands the deadweight-loss area beyond the efficient quantity.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("mhcd-intercept", "Demand intercept (€)", 120, 'min="1" step="1"') +
          input("mhcd-slope", "Demand slope (€ per unit)", 1, 'min="0.05" step="0.05"') +
          input("mhcd-mc", "Marginal cost P (€)", 50, 'min="0" step="1"') +
          range("mhcd-k", "Patient coinsurance k (%)", 30, 0, 100, 1, "0% full coverage", "100% no insurance") +
          "</div>" + output("mhcd-output");

        const render = () => {
          const intercept = read(node, "mhcd-intercept", 1, 1e9);
          const slope = read(node, "mhcd-slope", 0.05, 1e9);
          const mc = read(node, "mhcd-mc", 0, intercept);
          const k = read(node, "mhcd-k", 0, 100) / 100;
          node.querySelector("#mhcd-k-value").textContent = `${fmt(k * 100, 0)}%`;
          const patientPrice = k * mc;
          const qEff = Math.max(0, (intercept - mc) / slope);
          const qInsured = Math.max(0, (intercept - patientPrice) / slope);
          const overuse = Math.max(0, qInsured - qEff);
          const dwl = 0.5 * overuse * Math.max(0, mc - patientPrice);
          const total = mc * qInsured;
          const patientSpend = patientPrice * qInsured;
          const insurerSpend = total - patientSpend;

          const maxQ = Math.max(qInsured, qEff, 1) * 1.12;
          const maxP = Math.max(intercept, mc, 1) * 1.12;
          const x = (q) => 62 + (q / maxQ) * 530;
          const y = (p) => 315 - (p / maxP) * 260;
          const demandAtQ = (q) => Math.max(0, intercept - slope * q);
          const triangle = overuse > 0
            ? `<path d="M${x(qEff)} ${y(mc)}L${x(qInsured)} ${y(patientPrice)}L${x(qInsured)} ${y(mc)}Z" fill="rgba(208,109,79,.24)" stroke="#d06d4f" stroke-width="2"/>`
            : "";

          node.querySelector("#mhcd-output").innerHTML =
            `<div class="mh-activity-chart"><svg viewBox="0 0 650 360" role="img" aria-label="Demand, marginal cost, insured price and deadweight loss"><path d="M60 315V35M60 315H615" stroke="currentColor" opacity=".5"/><path d="M${x(0)} ${y(intercept)}L${x(Math.min(intercept / slope, maxQ))} ${y(demandAtQ(Math.min(intercept / slope, maxQ)))}" stroke="#527b6a" stroke-width="4"/><path d="M60 ${y(mc)}H610" stroke="#6f5a9d" stroke-width="3"/><path d="M60 ${y(patientPrice)}H610" stroke="#d06d4f" stroke-width="3" stroke-dasharray="7 6"/>${triangle}<path d="M${x(qEff)} ${y(mc)}V315M${x(qInsured)} ${y(patientPrice)}V315" stroke="currentColor" opacity=".35" stroke-dasharray="5 5"/><circle cx="${x(qEff)}" cy="${y(mc)}" r="6" fill="#6f5a9d"/><circle cx="${x(qInsured)}" cy="${y(patientPrice)}" r="6" fill="#d06d4f"/><text x="${Math.max(70, x(qEff)-12)}" y="335" fill="currentColor" font-size="12">Q*</text><text x="${Math.min(585, x(qInsured)-12)}" y="335" fill="currentColor" font-size="12">Qk</text><text x="470" y="${Math.max(25,y(mc)-9)}" fill="#6f5a9d" font-size="12">MC</text><text x="470" y="${Math.max(25,y(patientPrice)-9)}" fill="#d06d4f" font-size="12">kP</text></svg></div>` +
            stats([
              ["Patient price kP", `€${fmt(patientPrice)}`],
              ["Efficient quantity Q*", fmt(qEff)],
              ["Insured quantity Qk", fmt(qInsured)],
              ["Utilisation above Q*", fmt(overuse)],
              ["Deadweight loss", `€${fmt(dwl)}`],
              ["Patient expenditure", `€${fmt(patientSpend)}`],
              ["Insurer expenditure", `€${fmt(insurerSpend)}`],
            ]) +
            verdict(
              k >= 0.75 ? "Strong price discipline" : k <= 0.15 ? "Strong risk protection, large price distortion" : "Intermediate second-best contract",
              k >= 0.75 ? "The patient price is close to marginal cost, so utilisation distortion is limited but financial protection is weaker." : k <= 0.15 ? "The patient price is far below marginal cost, so use expands substantially in this linear-demand example." : "Partial coverage trades some risk protection for a smaller utilisation distortion.",
              k > 0 && k < 1,
            );
        };
        node.querySelectorAll("input").forEach((control) => control.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("mh-elasticity", {
      title: "Hold the price distortion fixed—change elasticity",
      intro:
        "Both services begin at the same efficient quantity and marginal cost. A common copayment generates different quantity responses because their elasticities differ.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("mhe-mc", "Marginal cost (€)", 50, 'min="1" step="1"') +
          input("mhe-q", "Efficient quantity Q*", 100, 'min="1" step="1"') +
          input("mhe-copay", "Patient copayment (€)", 20, 'min="0" step="1"') +
          range("mhe-e1", "Service A absolute elasticity", 20, 5, 100, 5, "0.05", "1.00") +
          range("mhe-e2", "Service B absolute elasticity", 80, 5, 150, 5, "0.05", "1.50") +
          "</div>" + output("mhe-output");

        const render = () => {
          const mc = read(node, "mhe-mc", 1, 1e9);
          const qStar = read(node, "mhe-q", 1, 1e9);
          const copay = read(node, "mhe-copay", 0, mc);
          const e1 = read(node, "mhe-e1", 5, 100) / 100;
          const e2 = read(node, "mhe-e2", 5, 150) / 100;
          node.querySelector("#mhe-e1-value").textContent = fmt(e1, 2);
          node.querySelector("#mhe-e2-value").textContent = fmt(e2, 2);

          const result = (elasticity) => {
            const inverseSlope = mc / (elasticity * qStar);
            const extra = (mc - copay) / inverseSlope;
            const quantity = qStar + extra;
            const dwl = 0.5 * extra * (mc - copay);
            return { inverseSlope, extra, quantity, dwl };
          };
          const a = result(e1), b = result(e2);
          const maxQ = Math.max(a.quantity, b.quantity) * 1.08;
          const bar = (value, max, label, fill) => `<div class="insurance-income-bar"><span>${label}</span><strong>${fmt(value, 1)}</strong><div class="insurance-income-fill" style="height:${Math.max(2, value / max * 100)}%;background:${fill}"></div></div>`;

          node.querySelector("#mhe-output").innerHTML =
            `<div class="insurance-activity-bars">${bar(a.quantity,maxQ,`Service A · |ε|=${fmt(e1,2)}`,"#527b6a")}${bar(b.quantity,maxQ,`Service B · |ε|=${fmt(e2,2)}`,"#d06d4f")}</div>` +
            stats([
              ["Common price reduction", `€${fmt(mc - copay)}`],
              ["Service A utilisation", fmt(a.quantity, 1)],
              ["Service A DWL", `€${fmt(a.dwl)}`],
              ["Service B utilisation", fmt(b.quantity, 1)],
              ["Service B DWL", `€${fmt(b.dwl)}`],
              ["DWL ratio B/A", a.dwl ? fmt(b.dwl / a.dwl, 2) : "—"],
            ]) +
            verdict(
              b.dwl > a.dwl ? "The more elastic service is more distorted" : "The services currently have similar distortion",
              "With the same price subsidy, the more responsive demand curve produces a larger quantity change and larger triangular welfare loss. This supports higher optimal coinsurance for more elastic services, other things equal.",
              b.dwl <= a.dwl * 1.15,
            );
        };
        node.querySelectorAll("input").forEach((control) => control.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("mh-control-mix", {
      title: "Combine a copayment with a quantity cap",
      intro:
        "Moderately and seriously ill patients have different demand. Apply one common copayment and one common cap, then compare each final allocation with its own first best.",
      build(node) {
        node.innerHTML =
          '<div class="activity-controls">' +
          input("mhcm-mc", "Marginal cost (€)", 50, 'min="1" step="1"') +
          input("mhcm-am", "Moderate-type demand intercept (€)", 90, 'min="1" step="1"') +
          input("mhcm-as", "Severe-type demand intercept (€)", 150, 'min="1" step="1"') +
          input("mhcm-slope", "Common inverse-demand slope", 1, 'min="0.05" step="0.05"') +
          range("mhcm-copay", "Common copayment (€)", 20, 0, 80, 1, "0", "80") +
          range("mhcm-cap", "Quantity cap", 80, 0, 150, 1, "0", "150") +
          "</div>" + output("mhcm-output");

        const render = () => {
          const mc = read(node, "mhcm-mc", 1, 1e9);
          const aM = read(node, "mhcm-am", mc, 1e9);
          const aS = Math.max(aM, read(node, "mhcm-as", mc, 1e9));
          const slope = read(node, "mhcm-slope", 0.05, 1e9);
          const copay = Math.min(mc, read(node, "mhcm-copay", 0, 80));
          const cap = read(node, "mhcm-cap", 0, 150);
          node.querySelector("#mhcm-copay-value").textContent = `€${fmt(copay,0)}`;
          node.querySelector("#mhcm-cap-value").textContent = fmt(cap,0);

          const type = (intercept) => {
            const firstBest = Math.max(0, (intercept - mc) / slope);
            const demandAtCopay = Math.max(0, (intercept - copay) / slope);
            const final = Math.min(demandAtCopay, cap);
            const deviation = final - firstBest;
            const welfareLoss = 0.5 * slope * deviation * deviation;
            return { firstBest, demandAtCopay, final, deviation, welfareLoss };
          };
          const moderate = type(aM), severe = type(aS);
          const maxQ = Math.max(moderate.demandAtCopay, severe.demandAtCopay, cap, 1);
          const width = (value) => Math.max(0, Math.min(100, value / maxQ * 100));
          const row = (label, value, firstBest, cls) => `<div class="mh-allocation-row"><span>${label}</span><div><i class="${cls}" style="width:${width(value)}%"></i><b style="left:${width(firstBest)}%" title="First-best quantity"></b></div><strong>${fmt(value,1)} / Q* ${fmt(firstBest,1)}</strong></div>`;

          const totalLoss = moderate.welfareLoss + severe.welfareLoss;
          const description = moderate.deviation > 0 && severe.deviation < 0
            ? "The common policy gives too much to the moderate type and too little to the severe type."
            : moderate.deviation <= 0 && severe.deviation <= 0
              ? "The common controls are restrictive for both types."
              : moderate.deviation >= 0 && severe.deviation >= 0
                ? "Both types still consume above first best."
                : "The common rules affect the two types differently.";

          node.querySelector("#mhcm-output").innerHTML =
            `<div class="mh-allocation"><p class="small muted">Filled bar = final quantity · vertical marker = type-specific first best</p>${row("Moderately ill M",moderate.final,moderate.firstBest,"is-moderate")}${row("Seriously ill S",severe.final,severe.firstBest,"is-severe")}</div>` +
            stats([
              ["M demand at copay", fmt(moderate.demandAtCopay,1)],
              ["M final deviation", `${moderate.deviation >= 0 ? "+" : ""}${fmt(moderate.deviation,1)}`],
              ["S demand at copay", fmt(severe.demandAtCopay,1)],
              ["S final deviation", `${severe.deviation >= 0 ? "+" : ""}${fmt(severe.deviation,1)}`],
              ["Total welfare-loss index", fmt(totalLoss,1)],
              ["Copayment revenue", `€${fmt(copay * (moderate.final + severe.final),0)}`],
            ]) + verdict("Heterogeneous need defeats a single blunt rule", description, totalLoss < 150);
        };
        node.querySelectorAll("input").forEach((control) => control.addEventListener("input", render));
        render();
      },
    });

    root.LectureActivities.register("mh-plan-compare", {
      title: "Compare FFS, PPO, POS and HMO",
      intro:
        "Select a plan. The matrix highlights how provider networks and gatekeeping combine with patient and provider incentives.",
      build(node) {
        const plans = {
          ffs: {
            name: "Standard fee-for-service",
            network: "No required plan network",
            gatekeeper: "No",
            oop: "Coverage may lower OOP, but the patient retains broad provider choice",
            provider: "Strong volume incentive under FFS",
            commitment: "Weak",
            restriction: "Least restrictive",
            risk: "High risk of patient–provider utilisation expansion",
          },
          ppo: {
            name: "Preferred Provider Organization (PPO)",
            network: "Yes; preferred network with out-of-network option",
            gatekeeper: "No",
            oop: "Lower in network, higher out of network",
            provider: "Negotiated prices and selective contracting",
            commitment: "Moderate",
            restriction: "Moderate",
            risk: "Can lower prices while retaining substantial choice",
          },
          pos: {
            name: "Point of Service (POS)",
            network: "Two-tier network structure",
            gatekeeper: "Yes for in-network terms",
            oop: "Lower in network; higher outside",
            provider: "Network contracts plus referral control",
            commitment: "Moderate–strong",
            restriction: "Moderate–high",
            risk: "Balances choice with gatekeeping but adds complexity",
          },
          hmo: {
            name: "Health Maintenance Organization (HMO)",
            network: "Care generally delivered through plan network",
            gatekeeper: "Usually yes",
            oop: "Relatively low OOP for covered in-network care",
            provider: "Integrated payment, review and stronger supply-side control",
            commitment: "Strong",
            restriction: "Most restrictive",
            risk: "Lower spending incentives, but possible underprovision or delayed access",
          },
        };

        node.innerHTML =
          '<div class="activity-controls">' +
          select("mhpc-plan", "Plan type", [
            ["ffs", "Standard FFS"],
            ["ppo", "PPO"],
            ["pos", "POS"],
            ["hmo", "HMO"],
          ]) + "</div>" + output("mhpc-output");

        const render = () => {
          const key = node.querySelector("#mhpc-plan").value;
          const plan = plans[key];
          const matrix = Object.entries(plans).map(([id, item]) => `<article class="${id === key ? "is-selected" : ""}"><strong>${esc(item.name)}</strong><span>${esc(item.restriction)}</span></article>`).join("");
          node.querySelector("#mhpc-output").innerHTML =
            `<div class="mh-plan-matrix">${matrix}</div>` +
            `<h3>${esc(plan.name)}</h3>` +
            stats([
              ["Provider network", esc(plan.network)],
              ["Gatekeeper", esc(plan.gatekeeper)],
              ["Patient cost-sharing pattern", esc(plan.oop)],
              ["Provider-side mechanism", esc(plan.provider)],
              ["Precommitment strength", esc(plan.commitment)],
              ["Main trade-off", esc(plan.risk)],
            ]) +
            `<p>Moving from FFS toward HMO generally increases network and utilisation controls. It may reduce prices and low-value use, but it also raises the risk of restricting useful care.</p>`;
        };
        node.querySelector("select").addEventListener("change", render);
        render();
      },
    });
  }

  registerActivities();
})(window);
