// Shared identity and learning links for integrated course 96525. No learner data leaves the browser.
(function (root) {
  "use strict";
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const a = (label, href, className = "qm-link") => {
    const node = el("a", className, label);
    node.href = href;
    return node;
  };
  let path = [],
    configs = new Map(),
    prepared = null;
  const guideLink = (id, section = 1) =>
    `lecture.html?topic=${encodeURIComponent(id)}&section=${section}#learn`;
  const studyLink = (id, view) =>
    `statistics.html?topic=${encodeURIComponent(id)}#${view}`;
  function identity(active = "overview") {
    const frame = el("div", "qm-identity");
    const brand = a("", "course.html?course=quant-methods", "qm-brand");
    brand.innerHTML =
      '<span class="qm-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>QUANTITATIVE METHODS<small>Health & Healthcare · 96525</small></span>';
    const nav = el("nav", "qm-global-nav");
    nav.setAttribute("aria-label", "Quantitative Methods workspace");
    const links = [
      ["overview", "Course", "course.html?course=quant-methods"],
      [
        "lectures",
        "Classroom",
        "course.html?course=quant-methods&tab=lectures",
      ],
      ["practice", "Practice", "statistics.html#mock"],
      ["progress", "My progress", "statistics.html#dashboard"],
    ];
    for (const [key, label, href] of links) {
      const link = a(label, href);
      if (key === active) link.setAttribute("aria-current", "page");
      nav.appendChild(link);
    }
    frame.append(brand, nav);
    return frame;
  }
  async function prepare(module, read = fetchText) {
    if (prepared) return prepared;
    prepared = (async () => {
      const raw = await readJson(
        read,
        "content/modules/statistics/study-path.json",
        null,
      );
      if (!raw || raw.schemaVersion !== 1 || raw.course !== "quant-methods")
        throw new Error("The course learning path could not be loaded.");
      path = raw.lessons.filter((x) =>
        module.topics.some((t) => t.id === x.topic && t.lecture),
      );
      const loaded = await Promise.all(
        module.topics
          .filter((t) => path.some((x) => x.topic === t.id))
          .map(async (t) => [t.id, await loadLecture(module, t, read)]),
      );
      configs = new Map(loaded.filter((x) => x[1]));
      return path;
    })();
    return prepared;
  }
  const lesson = (id) => path.find((x) => x.topic === id);
  const section = (q) => lesson(q.topic)?.questionSections[q.id] || 1;
  function progressSummary(module) {
    const p = loadProgress(),
      s = root.StatisticsStudy.reconcile(
        root.StatisticsStudy.read(),
        module.questions,
        p,
        todayKey(),
      );
    return {
      read: path.filter((x) => getTopicStatus(p, x.topic)).length,
      attempted: Object.keys(s.questions).length,
      correct: Object.values(s.questions).filter((x) => x.lastCorrect).length,
      due: root.StatisticsStudy.due(s, module.questions, todayKey(), false)
        .length,
    };
  }
  function header(ctx, tab, tabs) {
    document.body.classList.add("qm-page", "qm-course-page");
    const box = el("div", "qm-course-header");
    box.appendChild(identity(tab === "lectures" ? "lectures" : "overview"));
    const bar = el("nav", "qm-course-tabs");
    bar.setAttribute("aria-label", "Course sections");
    for (const t of tabs) {
      const link = ctx.pageLink(
        t.key === "overview"
          ? "Study workspace"
          : t.key === "lectures"
            ? "Learning path"
            : t.label,
        { tab: t.key },
        "qm-course-tab",
      );
      if (t.key === tab) link.setAttribute("aria-current", "page");
      bar.appendChild(link);
    }
    bar.appendChild(
      a(
        "Formula library →",
        "statistics.html#reference",
        "qm-course-tab qm-library",
      ),
    );
    box.appendChild(bar);
    return box;
  }
  function moduleCard(module, ctx) {
    const card = el("article", "qm-module");
    const covered = module.topics.filter((x) => x.lecture).length;
    const available = covered > 0;
    card.innerHTML = `<p class="qm-kicker">${available ? "01 / Build your foundations" : "02 / Connect models to evidence"}</p><h3>${esc(module.info.name)}</h3><p>${esc(module.info.description)}</p><div class="qm-module-meta"><span>${esc(module.info.professors.join(", "))}</span><span>${module.info.cfu} CFU · cycle ${esc(module.info.cycle)}</span></div>`;
    if (available) {
      card.appendChild(
        ctx.pageLink(
          "Explore the six available classes →",
          { tab: "lectures" },
          "qm-button",
        ),
      );
    } else {
      card.appendChild(
        el(
          "p",
          "qm-availability",
          "Lecture guides awaiting course materials. The topics below are the syllabus, not completed classes.",
        ),
      );
      const syllabus = el("div", "qm-tags");
      module.topics.forEach((t) =>
        syllabus.appendChild(el("span", null, t.title)),
      );
      card.appendChild(syllabus);
      const official = a(
        "Open official course information →",
        module.info.officialUrl,
        "qm-button qm-secondary",
      );
      official.target = "_blank";
      official.rel = "noopener";
      card.appendChild(official);
    }
    return card;
  }
  function heroDemo() {
    const demo = el("article", "qm-evidence");
    demo.innerHTML = `<div class="qm-evidence-heading"><span class="qm-kicker">A question worth exploring</span><span class="qm-live-dot">Interactive</span></div><h3>More data.<br>How much more precision?</h3><p>Known SD = 20 kg. A larger independent sample reduces uncertainty in the mean.</p><svg viewBox="0 0 460 185" role="img" aria-labelledby="qm-chart-title qm-chart-desc"><title id="qm-chart-title">A 95% confidence interval around a sample mean of 70 kg</title><desc id="qm-chart-desc"></desc><g stroke="currentColor" opacity=".12"><path d="M40 35H420M40 85H420M40 135H420"/><path d="M40 20V145M135 20V145M230 20V145M325 20V145M420 20V145"/></g><path id="qm-demo-interval" stroke="#ddf59a" stroke-width="13" stroke-linecap="round"/><path d="M230 38V125" stroke="currentColor" stroke-width="2" stroke-dasharray="4 6"/><circle cx="230" cy="85" r="8" fill="#fff"/>${[50, 60, 70, 80, 90].map((n, i) => `<text x="${40 + i * 95}" y="168" text-anchor="middle" fill="currentColor" font-size="12">${n}</text>`).join("")}</svg><label for="qm-demo-size">Sample size <strong id="qm-demo-n">100</strong></label><input id="qm-demo-size" type="range" min="0" max="2" step="1" value="1" aria-valuetext="100 observations"><div class="qm-range-labels"><span>25</span><span>100</span><span>400</span></div><div class="qm-demo-results" aria-live="polite"><span>STANDARD ERROR<strong id="qm-demo-se"></strong></span><span>95% INTERVAL<strong id="qm-demo-ci"></strong></span></div><a href="${guideLink("statistics.sampling", 6)}">See the assumptions and explanation →</a><p class="qm-caption">Hypothetical teaching example · normal sampling distribution</p>`;
    return demo;
  }
  function updateDemo() {
    const slider = document.getElementById("qm-demo-size");
    if (!slider) return;
    const n = [25, 100, 400][Number(slider.value)],
      se = 20 / Math.sqrt(n),
      margin = 1.959963984540054 * se,
      lo = 70 - margin,
      hi = 70 + margin;
    document.getElementById("qm-demo-n").textContent = n;
    slider.setAttribute("aria-valuetext", n + " observations");
    document.getElementById("qm-demo-se").textContent = se.toFixed(2) + " kg";
    document.getElementById("qm-demo-ci").textContent =
      lo.toFixed(2) + " – " + hi.toFixed(2) + " kg";
    document
      .getElementById("qm-demo-interval")
      .setAttribute("d", `M${40 + (lo - 50) * 9.5} 85H${40 + (hi - 50) * 9.5}`);
    document.getElementById("qm-chart-desc").textContent =
      `For n = ${n}, standard error is ${se.toFixed(2)} kg. The 95% interval extends from ${lo.toFixed(2)} to ${hi.toFixed(2)} kg, centred at 70 kg.`;
  }
  function overview(panel, ctx) {
    const module = ctx.course.modules.find((m) => m.id === "statistics"),
      summary = progressSummary(module);
    const partial = path.find((x) => {
      const q = loadProgress().lectures[x.topic];
      return q?.checked?.some(Boolean) && q.checked.some((v) => !v);
    });
    const next =
      partial ||
      path.find((x) => !getTopicStatus(loadProgress(), x.topic)) ||
      path[0];
    const hero = el("div", "qm-overview-hero");
    const intro = el("div", "qm-hero-copy");
    intro.innerHTML = `<p class="qm-kicker">THE STUDY WORKSPACE / INTEGRATED COURSE · 10 CFU</p><h1>From numbers<br>to <em>understanding.</em></h1><p class="qm-lead">Quantitative Methods in Health and Healthcare (I.C.)</p><p>Build the foundations. Explore what changes. Explain what the evidence means. Your lectures and practice, connected in one place.</p>`;
    const actions = el("div", "qm-actions");
    actions.append(
      a(
        partial ? "Continue your class →" : "Start your next class →",
        guideLink(next.topic),
        "qm-button",
      ),
      a(
        "Review what’s due",
        "statistics.html#review",
        "qm-button qm-secondary",
      ),
    );
    intro.appendChild(actions);
    intro.appendChild(
      el(
        "p",
        "qm-caption",
        `${topicLabel(next.topic, module)} · ${next.title}`,
      ),
    );
    hero.append(intro, heroDemo());
    panel.appendChild(hero);
    const metrics = el("div", "qm-metrics");
    const labs = [...configs.values()].reduce(
      (sum, c) => sum + c.activities.length,
      0,
    );
    for (const [n, label] of [
      [path.length, "Available lectures"],
      [labs, "Interactive labs"],
      [module.questions.length, "Practice questions"],
      [`${summary.read} / ${path.length}`, "Lectures marked read"],
    ]) {
      const item = el("div", "qm-metric");
      item.append(el("strong", null, n), el("span", null, label));
      metrics.appendChild(item);
    }
    panel.appendChild(metrics);
    const heading = el("div", "qm-section-heading");
    heading.innerHTML =
      '<div><p class="qm-kicker">ONE COURSE / TWO CONNECTED MODULES</p><h2>Build it in layers.</h2></div><p>Statistics gives you the language of uncertainty. Econometrics connects models, associations and causal questions.</p>';
    panel.appendChild(heading);
    const modules = el("div", "qm-module-grid");
    ctx.course.modules.forEach((m) => modules.appendChild(moduleCard(m, ctx)));
    panel.appendChild(modules);
    const start = el("div", "qm-section-heading");
    start.innerHTML =
      '<div><p class="qm-kicker">YOUR LEARNING PATH</p><h2>Six classes. One connected story.</h2></div>';
    start.appendChild(
      ctx.pageLink("View the whole path →", { tab: "lectures" }, "qm-link"),
    );
    panel.appendChild(start);
    const tiles = el("div", "qm-path-preview");
    path.forEach((x) => tiles.appendChild(lessonCard(x, module, true)));
    panel.appendChild(tiles);
    const tools = el("section", "qm-tool-shelf");
    tools.innerHTML =
      '<p class="qm-kicker">CHOOSE YOUR NEXT 15 MINUTES</p><h2>A study session with a purpose.</h2>';
    const cards = el("div", "qm-tools-grid");
    for (const [title, text, href, tag] of [
      [
        "Close a knowledge gap",
        `${summary.due} questions due. Retry mistakes and choose your next review date.`,
        "statistics.html#review",
        "01 / RECALL",
      ],
      [
        "Show your working",
        "Solve numeric examples with hints, units and step-by-step solutions.",
        "statistics.html#calculations",
        "02 / CALCULATE",
      ],
      [
        "Make the result meaningful",
        "Write an explanation, compare with a model and assess your reasoning.",
        "statistics.html#interpretation",
        "03 / INTERPRET",
      ],
      [
        "Try a mixed session",
        "Switch between immediate-feedback practice and a timed MCQ mock.",
        "statistics.html#mock",
        "04 / CONNECT",
      ],
    ]) {
      const card = a("", href, "qm-tool-card");
      card.innerHTML = `<span class="qm-kicker">${tag}</span><h3>${title}<span aria-hidden="true">→</span></h3><p>${esc(text)}</p>`;
      cards.appendChild(card);
    }
    tools.appendChild(cards);
    panel.appendChild(tools);
    const details = el("details", "qm-course-details");
    details.appendChild(
      el(
        "summary",
        null,
        "Course information, assessment & official materials",
      ),
    );
    const facts = el("div", "qm-detail-grid");
    ctx.course.modules.forEach((m) => {
      const card = el("div");
      card.innerHTML = `<h3>${esc(m.info.name)} · ${esc(m.info.code)}</h3><p>${esc(m.info.assessment)}</p><p>${esc(m.info.professors.join(", "))} · ${m.info.cfu} CFU</p>`;
      const official = a("Official module page →", m.info.officialUrl);
      official.target = "_blank";
      official.rel = "noopener";
      const materials = a("Virtuale →", m.info.virtualeUrl);
      materials.target = "_blank";
      materials.rel = "noopener";
      card.append(official, document.createTextNode(" · "), materials);
      facts.appendChild(card);
    });
    details.appendChild(facts);
    details.appendChild(ctx.planStatusBox());
    panel.appendChild(details);
    panel.appendChild(
      el(
        "p",
        "qm-caption",
        "Original student study material · Official slides remain on Virtuale · Progress is saved on this device.",
      ),
    );
    document
      .getElementById("qm-demo-size")
      .addEventListener("input", updateDemo);
    updateDemo();
  }
  function topicLabel(id, module) {
    return (
      module.topics.find((x) => x.id === id)?.title.split(":")[0] || "Class"
    );
  }
  function lessonCard(x, module, compact = false) {
    const p = loadProgress(),
      status = getTopicStatus(p, x.topic),
      config = configs.get(x.topic),
      qs = module.questions.filter((q) => q.topic === x.topic);
    const card = el("article", `qm-lesson-card${compact ? " qm-compact" : ""}`);
    card.dataset.topic = x.topic;
    card.innerHTML = `<div class="qm-lesson-top"><span class="qm-lesson-number">${String(x.classNumber).padStart(2, "0")}</span><span class="qm-status${status ? " is-read" : ""}">${status === "understood" ? "Understood" : status === "read" ? "Read" : "Ready to study"}</span></div><p class="qm-kicker">${esc(topicLabel(x.topic, module))}</p><h3><a class="topic-title" href="${guideLink(x.topic)}">${esc(x.title)}</a></h3><p>${esc(x.summary)}</p>`;
    if (!compact) {
      const outcomes = el("ul", "qm-outcomes");
      x.outcomes.forEach((t) => outcomes.appendChild(el("li", null, t)));
      card.appendChild(outcomes);
      card.appendChild(
        el(
          "p",
          "qm-caption",
          `${qs.length} MCQs · ${config?.activities.length || 0} labs · ${config?.date ? formatDay(config.date, { day: "numeric", month: "short" }) : ""}`,
        ),
      );
    }
    const actions = el("div", "qm-lesson-links");
    actions.append(
      a("Learn →", guideLink(x.topic)),
      a("Explore", `lecture.html?topic=${encodeURIComponent(x.topic)}#explore`),
      a(
        "Practice",
        `lecture.html?topic=${encodeURIComponent(x.topic)}#practice`,
      ),
    );
    card.appendChild(actions);
    return card;
  }
  function lectures(panel, ctx) {
    const module = ctx.course.modules.find((m) => m.id === "statistics"),
      heading = el("div", "qm-section-heading");
    heading.innerHTML =
      '<div><p class="qm-kicker">STATISTICS FOR HEALTHCARE / CLASSROOM</p><h1>Your route through the ideas.</h1></div><p>Follow the classes in order, or find the concept you need. Each class connects a guide, an experiment and practice.</p>';
    panel.appendChild(heading);
    const label = el("label", "qm-search-label", "Find a class or concept");
    label.htmlFor = "qm-lesson-search";
    const search = el("input", "qm-lesson-search");
    search.type = "search";
    search.id = "qm-lesson-search";
    search.placeholder = "Try: normal, confidence interval, diagnostic…";
    const count = el("p", "qm-caption", `${path.length} available classes`);
    count.id = "qm-search-count";
    count.setAttribute("role", "status");
    panel.append(label, search, count);
    const list = el("div", "qm-lessons-grid");
    list.id = "qm-lessons";
    path.forEach((x) => list.appendChild(lessonCard(x, module)));
    panel.appendChild(list);
    const empty = el(
      "p",
      "qm-availability",
      "No classes match. Try a broader word or clear the search.",
    );
    empty.id = "qm-search-empty";
    empty.hidden = true;
    panel.appendChild(empty);
    search.addEventListener("input", () => {
      const words = search.value
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      let visible = 0;
      path.forEach((x) => {
        const card = list.querySelector(`[data-topic="${x.topic}"]`);
        const text = [
          x.title,
          x.summary,
          ...x.keywords,
          ...x.outcomes,
          topicLabel(x.topic, module),
        ]
          .join(" ")
          .toLowerCase();
        card.hidden = !words.every((w) => text.includes(w));
        if (!card.hidden) visible++;
      });
      count.textContent = visible + " matching classes";
      empty.hidden = visible !== 0;
    });
    const centre = a(
      "Open Statistics Study Centre →",
      "statistics.html",
      "qm-button",
    );
    panel.appendChild(centre);
    const upcoming = el("details", "qm-upcoming");
    upcoming.appendChild(
      el("summary", null, "What comes next · sessions not taken yet"),
    );
    const entries = el("div", "qm-upcoming-list");
    module.topics
      .filter((t) => t.status === "upcoming")
      .forEach((t) => {
        const row = el("div");
        row.append(
          el("span", null, t.title),
          el("span", "qm-status", "Upcoming"),
        );
        const official = a("Virtuale →", t.virtualeUrl);
        official.target = "_blank";
        official.rel = "noopener";
        row.appendChild(official);
        entries.appendChild(row);
      });
    upcoming.appendChild(entries);
    upcoming.appendChild(
      el(
        "p",
        "qm-caption",
        "New guides will be added after these sessions are covered. Econometrics is the course's second module; its lecture materials are awaiting upload.",
      ),
    );
    panel.appendChild(upcoming);
  }
  function render(panel, tab, ctx) {
    panel.classList.add("qm-course-panel");
    if (tab === "overview") {
      overview(panel, ctx);
      return true;
    }
    if (tab === "lectures") {
      lectures(panel, ctx);
      return true;
    }
    return false;
  }
  function attachLecture({ topic, module, config, selectQuestion }) {
    const x = lesson(topic.id);
    if (!x) return;
    document.body.classList.add("qm-page", "qm-lecture-page");
    const main = document.getElementById("main");
    main.querySelector(".lecture-breadcrumbs").after(identity("lectures"));
    const hero = main.querySelector("#learn .hero");
    hero.classList.add("qm-lesson-hero");
    hero.querySelectorAll('[aria-hidden="true"]').forEach((n) => {
      if (n.textContent.trim() === "↗") n.textContent = "→";
    });
    const official = document.getElementById("lecture-virtuale");
    if (official)
      official.textContent = official.textContent.replace("↗", "→");
    const visual = hero.querySelector(".visual");
    if (visual) {
      visual.removeAttribute("data-activity");
      visual.hidden = false;
      visual.className = "qm-outcome-card";
      visual.innerHTML = `<p class="qm-kicker">AFTER THIS CLASS</p><h2>What you’ll be able to do.</h2><ul>${x.outcomes.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><span class="qm-lesson-number">${String(x.classNumber).padStart(2, "0")}</span>`;
      hero.classList.remove("no-visual");
    }
    const guide = document.getElementById("lecture-guide"),
      sections = [...guide.querySelectorAll(".section-intro")];
    const layout = el("div", "qm-reading-layout"),
      outline = el("aside", "qm-outline"),
      details = el("details");
    details.open = innerWidth > 800;
    details.appendChild(el("summary", null, "In this class"));
    const nav = el("nav");
    nav.setAttribute("aria-label", "Lecture section outline");
    sections.forEach((node, i) => {
      const heading = node.querySelector("h2"),
        link = a(
          `${String(i + 1).padStart(2, "0")}  ${heading.textContent}`,
          "#" + node.id,
          "qm-outline-link",
        );
      link.addEventListener("click", (e) => {
        e.preventDefault();
        node.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "start",
        });
      });
      nav.appendChild(link);
    });
    details.appendChild(nav);
    outline.appendChild(details);
    const tools = el("div", "qm-outline-tools");
    tools.innerHTML = '<p class="qm-kicker">WITH THIS LECTURE</p>';
    tools.append(
      a("Formula reference →", studyLink(topic.id, "reference")),
      a("Work through a calculation →", studyLink(topic.id, "calculations")),
      a("Explain a result →", studyLink(topic.id, "interpretation")),
    );
    outline.appendChild(tools);
    guide.before(layout);
    layout.append(outline, guide);
    // Add one short concept check after each guide section; existing explanatory content stays intact.
    const qs = module.questions.filter(
      (q) => q.topic === topic.id && q.type === "mcq",
    );
    sections.forEach((node, i) => {
      const q = qs.find((q) => section(q) === i + 1);
      if (!q) return;
      const check = el("div", "qm-concept-check");
      check.innerHTML = `<div><span class="qm-kicker">CONNECT / CHECK YOUR UNDERSTANDING</span><p>${esc(q.question)}</p></div>`;
      const button = el(
        "button",
        "qm-button qm-secondary",
        "Try this question →",
      );
      button.type = "button";
      button.dataset.qmQuestion = q.id;
      button.addEventListener("click", () => selectQuestion(q.id));
      check.appendChild(button);
      const next = sections[i + 1];
      if (next) next.before(check);
      else guide.appendChild(check);
    });
    const shelf = el("section", "qm-lesson-next");
    shelf.innerHTML =
      '<p class="qm-kicker">KEEP THE IDEAS CONNECTED</p><h2>Now use what you’ve learned.</h2>';
    const actions = el("div", "qm-actions");
    actions.append(
      a(
        "Practise calculations",
        studyLink(topic.id, "calculations"),
        "qm-button",
      ),
      a(
        "Explain the result",
        studyLink(topic.id, "interpretation"),
        "qm-button qm-secondary",
      ),
      a(
        "See related formulas",
        studyLink(topic.id, "reference"),
        "qm-button qm-secondary",
      ),
    );
    shelf.appendChild(actions);
    const previous = path[path.indexOf(x) - 1],
      next = path[path.indexOf(x) + 1],
      sequence = el("div", "qm-next-links");
    if (previous)
      sequence.appendChild(a("← " + previous.title, guideLink(previous.topic)));
    if (next) sequence.appendChild(a(next.title + " →", guideLink(next.topic)));
    else
      sequence.appendChild(
        a("Bring all six classes together →", "statistics.html#mock"),
      );
    shelf.appendChild(sequence);
    document.getElementById("learn").appendChild(shelf);
  }
  async function cacheFiles(files) {
    if (!("serviceWorker" in navigator) || !("caches" in root)) return false;
    try {
      await navigator.serviceWorker.ready;
      const cache = await caches.open("data");
      await Promise.all(
        [...files].map(([file, text]) =>
          cache.put(
            new URL(file, location.href).href,
            new Response(text, {
              headers: { "x-saved-at": new Date().toISOString() },
            }),
          ),
        ),
      );
      return true;
    } catch {
      return false;
    }
  }
  root.QuantMethods = {
    prepare,
    identity,
    header,
    render,
    attachLecture,
    questionSection: section,
    lesson,
    studyLink,
    guideLink,
    cacheFiles,
  };
})(window);
