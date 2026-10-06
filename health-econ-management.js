// Integrated course 97177: polished study hub for Health Economics & Management.
(function (root) {
  "use strict";

  const COURSE_ID = "fund-health-econ-management";
  const ECON_MODULE_ID = "fund-health-economics";
  const PATH_FILE = "content/modules/fund-health-economics/learning-path.json";

  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
    );

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const link = (label, href, className = "hem-link") => {
    const node = el("a", className, label);
    node.href = href;
    return node;
  };

  let path = null;
  let configs = new Map();
  let prepared = null;

  const lectureLink = (topic, hash = "#learn") =>
    `lecture.html?topic=${encodeURIComponent(topic)}${hash}`;

  const practiceLink = (topic = "") => {
    const params = new URLSearchParams({ course: COURSE_ID, tab: "practice" });
    if (topic) params.set("practiceTopic", topic);
    return "course.html?" + params.toString();
  };

  function sessionByTopic(topic) {
    return path?.sessions.find((session) => session.topic === topic) || null;
  }

  function availableSessions(module) {
    if (!path) return [];
    const ids = new Set(module.topics.map((topic) => topic.id));
    return path.sessions.filter(
      (session) =>
        session.status === "available" &&
        session.topic &&
        ids.has(session.topic),
    );
  }

  async function prepare(module, read = fetchText) {
    if (prepared) return prepared;
    prepared = (async () => {
      const raw = await readJson(read, PATH_FILE, null);
      if (
        !raw ||
        raw.schemaVersion !== 1 ||
        raw.course !== COURSE_ID ||
        raw.module !== ECON_MODULE_ID ||
        !Array.isArray(raw.sessions)
      ) {
        throw new Error("The Health Economics learning path could not be loaded.");
      }
      path = raw;
      const available = availableSessions(module);
      const loaded = await Promise.all(
        available.map(async (session) => {
          const topic = module.topics.find((item) => item.id === session.topic);
          return [session.topic, topic?.lecture ? await loadLecture(module, topic, read) : null];
        }),
      );
      configs = new Map(loaded.filter((item) => item[1]));
      return path;
    })();
    return prepared;
  }

  function sessionStatus(topic) {
    if (!topic) return "";
    return getTopicStatus(loadProgress(), topic);
  }

  function progressSummary(module) {
    const sessions = availableSessions(module);
    const progress = loadProgress();
    const read = sessions.filter((session) => getTopicStatus(progress, session.topic)).length;
    const understood = sessions.filter(
      (session) => getTopicStatus(progress, session.topic) === "understood",
    ).length;
    const partial = sessions.filter((session) => {
      const quiz = progress.lectures?.[session.topic];
      return (
        Array.isArray(quiz?.checked) &&
        quiz.checked.some(Boolean) &&
        quiz.checked.some((value) => !value)
      );
    }).length;
    return {
      available: sessions.length,
      read,
      understood,
      partial,
      percent: sessions.length ? Math.round((read / sessions.length) * 100) : 0,
    };
  }

  function nextSession(module) {
    const sessions = availableSessions(module);
    const progress = loadProgress();
    return (
      sessions.find((session) => {
        const quiz = progress.lectures?.[session.topic];
        return (
          Array.isArray(quiz?.checked) &&
          quiz.checked.some(Boolean) &&
          quiz.checked.some((value) => !value)
        );
      }) ||
      sessions.find((session) => getTopicStatus(progress, session.topic) !== "understood") ||
      sessions[0]
    );
  }

  function identity(active = "overview") {
    const frame = el("div", "hem-identity");
    const brand = link("", `course.html?course=${COURSE_ID}`, "hem-brand");
    brand.innerHTML =
      '<span class="hem-mark" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span>FHEM <small>Fundamental in Health Economics &amp; Management · 97177</small></span>';

    const nav = el("nav", "hem-global-nav");
    nav.setAttribute("aria-label", "FHEM study workspace");
    const items = [
      ["overview", "Course hub", `course.html?course=${COURSE_ID}`],
      ["lectures", "Sessions", `course.html?course=${COURSE_ID}&tab=lectures`],
      ["practice", "Practice", `course.html?course=${COURSE_ID}&tab=practice`],
      ["exam", "Exam centre", "fhem-exam.html"],
      ["resources", "Resources", `course.html?course=${COURSE_ID}&tab=resources`],
    ];
    for (const [key, label, href] of items) {
      const a = link(label, href);
      if (key === active) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    }
    frame.append(brand, nav);
    return frame;
  }

  function header(ctx, tab, tabs) {
    document.body.classList.add("hem-page", "hem-course-page");
    const wrapper = el("div", "hem-course-header");
    wrapper.appendChild(
      identity(
        tab === "lectures"
          ? "lectures"
          : tab === "practice"
            ? "practice"
            : tab === "resources"
              ? "resources"
              : "overview",
      ),
    );

    const labels = {
      overview: "Course hub",
      schedule: "Schedule",
      exam: "Exam dates",
      lectures: "Learning path",
      topics: "Study notes",
      concepts: "Key concepts",
      practice: "Practice",
      resources: "Resources",
    };

    const nav = el("nav", "hem-course-tabs");
    nav.setAttribute("aria-label", "Course sections");
    for (const item of tabs) {
      const a = ctx.pageLink(
        labels[item.key] || item.label,
        { tab: item.key },
        "hem-course-tab",
      );
      if (item.key === tab) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    }
    wrapper.appendChild(nav);
    return wrapper;
  }

  function statusBadge(session) {
    const status = sessionStatus(session.topic);
    const badge = el("span", "hem-status");
    if (session.status === "upcoming") {
      badge.classList.add("is-upcoming");
      badge.textContent = "Upcoming";
    } else if (status === "understood") {
      badge.classList.add("is-complete");
      badge.textContent = "Understood";
    } else if (status === "read") {
      badge.classList.add("is-read");
      badge.textContent = "Read";
    } else {
      badge.textContent = "Ready to study";
    }
    return badge;
  }

  function sessionCard(session, module, compact = false) {
    const card = el(
      "article",
      `hem-session-card hem-stage-${session.stage}${compact ? " hem-session-compact" : ""}${session.status === "upcoming" ? " is-upcoming" : ""}`,
    );
    card.dataset.session = String(session.number);

    const top = el("div", "hem-session-top");
    top.append(
      el("span", "hem-session-number", String(session.number).padStart(2, "0")),
      statusBadge(session),
    );
    card.appendChild(top);
    card.appendChild(el("p", "hem-kicker", `SESSION ${session.number}`));
    card.appendChild(el("h3", null, session.title));
    card.appendChild(el("p", "hem-session-summary", session.summary));

    if (session.status === "available" && session.topic) {
      const cards = module.flashcards.filter((item) => item.topic === session.topic).length;
      const questions = module.questions.filter((item) => item.topic === session.topic).length;
      const labs = configs.get(session.topic)?.activities?.length || 0;
      const meta = el("div", "hem-session-meta");
      meta.append(
        el("span", null, `${cards} flashcards`),
        el("span", null, `${questions} questions`),
      );
      if (labs) {
        meta.appendChild(
          el("span", null, `${labs} interactive ${labs === 1 ? "tool" : "tools"}`),
        );
      }
      card.appendChild(meta);

      const actions = el("div", "hem-session-actions");
      actions.append(
        link("Learn →", lectureLink(session.topic), "hem-link hem-primary-link"),
        link("Practice", practiceLink(session.topic), "hem-link"),
      );
      card.appendChild(actions);
    } else {
      const note = el(
        "p",
        "hem-upcoming-note",
        "Awaiting the official lecture materials. The syllabus topic is shown here so the learning path stays complete.",
      );
      card.appendChild(note);
    }
    return card;
  }

  function heroGraphic(availableCount) {
    const visual = el("article", "hem-system-map");
    visual.innerHTML = `
      <div class="hem-map-head">
        <span class="hem-kicker">THE SYSTEM / ONE CONNECTED STORY</span>
        <span class="hem-live">${availableCount} sessions live</span>
      </div>
      <div class="hem-triad" aria-label="Patient, provider and payer are connected across the course">
        <div class="hem-node hem-patient"><span>PATIENT</span><small>Demand · health · disparities</small></div>
        <div class="hem-node hem-provider"><span>PROVIDER</span><small>Agency · payment · practice</small></div>
        <div class="hem-node hem-payer"><span>PAYER</span><small>Insurance · incentives · policy</small></div>
        <svg viewBox="0 0 520 245" aria-hidden="true">
          <path d="M260 46 L122 190 L398 190 Z" fill="none" stroke="currentColor" stroke-width="2"/>
          <circle cx="260" cy="46" r="4"/><circle cx="122" cy="190" r="4"/><circle cx="398" cy="190" r="4"/>
        </svg>
        <div class="hem-map-centre"><strong>HEALTH ECONOMICS</strong><span>choices · trade-offs · incentives</span></div>
      </div>
      <p class="hem-map-caption">The first module explains the relationships. The second module turns toward managing the organisations that operate within them.</p>
    `;
    return visual;
  }

  function moduleCard(module, index, ctx) {
    const card = el("article", "hem-module-card");
    const isEconomics = module.id === ECON_MODULE_ID;
    const dates = module.info.teachingStart && module.info.teachingEnd
      ? `${formatDay(module.info.teachingStart, { day: "numeric", month: "short" })} – ${formatDay(module.info.teachingEnd, { day: "numeric", month: "short" })}`
      : `Cycle ${module.info.cycle}`;
    card.innerHTML = `
      <div class="hem-module-index">0${index + 1}</div>
      <div class="hem-module-copy">
        <p class="hem-kicker">${isEconomics ? "CURRENT STUDY LIBRARY" : "SECOND MODULE / CYCLE 2"}</p>
        <h3>${esc(module.info.name)}</h3>
        <p>${esc(module.info.description)}</p>
        <div class="hem-module-meta">
          <span>${esc(module.info.professors.join(", "))}</span>
          <span>${module.info.cfu} CFU</span>
          <span>${esc(dates)}</span>
        </div>
      </div>
    `;
    const footer = el("div", "hem-module-footer");
    if (isEconomics) {
      const available = availableSessions(module).length;
      footer.append(
        el("span", "hem-module-availability", `${available} of 8 sessions available`),
        ctx.pageLink("Open learning path →", { tab: "lectures" }, "hem-button"),
      );
    } else {
      footer.append(
        el(
          "span",
          "hem-module-availability is-upcoming",
          "Study materials will be added when the official teaching content becomes available.",
        ),
      );
      if (module.info.officialUrl) {
        const official = link("Official module page →", module.info.officialUrl, "hem-button hem-secondary");
        official.target = "_blank";
        official.rel = "noopener";
        footer.appendChild(official);
      }
    }
    card.appendChild(footer);
    return card;
  }

  function toolCard(tag, title, text, href, value = "") {
    const card = link("", href, "hem-tool-card");
    card.innerHTML = `
      <div class="hem-tool-top"><span class="hem-kicker">${esc(tag)}</span>${value ? `<strong>${esc(value)}</strong>` : ""}</div>
      <h3>${esc(title)} <span aria-hidden="true">→</span></h3>
      <p>${esc(text)}</p>
    `;
    return card;
  }

  function overview(panel, ctx) {
    const economics = ctx.course.modules.find((module) => module.id === ECON_MODULE_ID);
    const summary = progressSummary(economics);
    const next = nextSession(economics);
    const available = availableSessions(economics);
    const questionCount = available.reduce(
      (sum, session) => sum + economics.questions.filter((q) => q.topic === session.topic).length,
      0,
    );
    const flashcardCount = available.reduce(
      (sum, session) => sum + economics.flashcards.filter((c) => c.topic === session.topic).length,
      0,
    );
    const labCount = available.reduce(
      (sum, session) => sum + (configs.get(session.topic)?.activities?.length || 0),
      0,
    );
    const conceptCount = ctx.data
      ? conceptsForCourse(ctx.course, ctx.data.concepts).filter((concept) =>
          concept.topics.some((topic) => available.some((session) => session.topic === topic)),
        ).length
      : 0;

    const hero = el("section", "hem-hero");
    const copy = el("div", "hem-hero-copy");
    copy.innerHTML = `
      <p class="hem-kicker">INTEGRATED COURSE · 97177 · 10 CFU</p>
      <h1>Understand the system.<br><em>Then learn to manage it.</em></h1>
      <p class="hem-lead">Fundamental in Health Economics and Management (I.C.)</p>
      <p>One course, two connected modules. Start with the economics of health, healthcare demand, inequality and provider behaviour; then move into healthcare management in Cycle 2.</p>
      <div class="hem-hero-chips">
        <span>Current module · Health Economics</span>
        <span>${summary.available}/8 sessions live</span>
        <a href="fhem-exam.html">90-minute mock ready →</a>
      </div>
    `;
    const actions = el("div", "hem-actions");
    if (next?.topic) {
      actions.append(
        link(
          summary.partial ? "Continue where you left off →" : `Continue with Session ${next.number} →`,
          lectureLink(next.topic),
          "hem-button",
        ),
      );
    }
    actions.append(
      ctx.pageLink("View all sessions", { tab: "lectures" }, "hem-button hem-secondary"),
      ctx.pageLink("Practice", { tab: "practice" }, "hem-button hem-secondary"),
      link("Exam centre", "fhem-exam.html", "hem-button hem-secondary"),
    );
    copy.appendChild(actions);
    if (next) {
      copy.appendChild(
        el(
          "p",
          "hem-caption",
          `Next suggested · Session ${next.number} · ${next.shortTitle || next.title}`,
        ),
      );
    }
    hero.append(copy, heroGraphic(summary.available));
    panel.appendChild(hero);

    const metrics = el("section", "hem-metrics");
    for (const [value, label] of [
      [`${summary.available} / 8`, "Health Economics sessions live"],
      [flashcardCount, "Flashcards"],
      [questionCount, "Practice questions"],
      [labCount, "Interactive tools"],
      [conceptCount, "Linked concepts"],
    ]) {
      const metric = el("div", "hem-metric");
      metric.append(el("strong", null, value), el("span", null, label));
      metrics.appendChild(metric);
    }
    panel.appendChild(metrics);

    const progressBox = el("section", "hem-progress-card");
    progressBox.innerHTML = `
      <div>
        <p class="hem-kicker">YOUR COURSE PROGRESS</p>
        <h2>${summary.read} of ${summary.available} available sessions visited.</h2>
        <p>Progress is stored only in this browser. Mark a session as read or understood from its lecture page.</p>
      </div>
      <div class="hem-progress-visual">
        <strong>${summary.percent}%</strong>
        <div class="hem-progress-track" role="progressbar" aria-label="Available session progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${summary.percent}">
          <span style="width:${summary.percent}%"></span>
        </div>
        <small>${summary.understood} understood · ${summary.partial} in progress</small>
      </div>
    `;
    panel.appendChild(progressBox);

    const moduleHeading = el("div", "hem-section-heading");
    moduleHeading.innerHTML =
      '<div><p class="hem-kicker">ONE INTEGRATED COURSE / TWO MODULES</p><h2>See the whole course before diving into a topic.</h2></div><p>Economics builds the analytical framework. Management follows with the organisational perspective in the second teaching cycle.</p>';
    panel.appendChild(moduleHeading);

    const modules = el("div", "hem-module-grid");
    ctx.course.modules.forEach((module, index) =>
      modules.appendChild(moduleCard(module, index, ctx)),
    );
    panel.appendChild(modules);

    const pathHeading = el("div", "hem-section-heading");
    pathHeading.innerHTML =
      '<div><p class="hem-kicker">HEALTH ECONOMICS / LEARNING PATH</p><h2>Five sessions ready. Three clearly marked as upcoming.</h2></div><p>The roadmap follows the course structure rather than presenting notes as a loose archive.</p>';
    pathHeading.appendChild(
      ctx.pageLink("Open full learning path →", { tab: "lectures" }, "hem-link"),
    );
    panel.appendChild(pathHeading);

    const preview = el("div", "hem-session-preview");
    available.forEach((session) => preview.appendChild(sessionCard(session, economics, true)));
    const remaining = path.sessions.filter((session) => session.status === "upcoming");
    const upcoming = el("article", "hem-upcoming-cluster");
    upcoming.innerHTML = `
      <p class="hem-kicker">NEXT / INSURANCE</p>
      <h3>Sessions 6–8</h3>
      <p>Demand for insurance, adverse selection and moral hazard are already placed in the roadmap. Detailed lecture pages will wait for the official slides.</p>
      <div class="hem-upcoming-list">${remaining.map((session) => `<span>0${session.number} · ${esc(session.shortTitle)}</span>`).join("")}</div>
    `;
    preview.appendChild(upcoming);
    panel.appendChild(preview);

    const tools = el("section", "hem-tool-shelf");
    tools.innerHTML =
      '<div class="hem-section-heading hem-tools-heading"><div><p class="hem-kicker">STUDY WITH INTENT</p><h2>Choose what you need right now.</h2></div><p>Move between understanding, recall, application and exam preparation without leaving the course hub.</p></div>';
    const toolGrid = el("div", "hem-tool-grid");
    toolGrid.append(
      toolCard("01 / READ", "Session notes", "Open the structured notes and quick reviews for the available Health Economics sessions.", `course.html?course=${COURSE_ID}&tab=topics`, `${summary.available} live`),
      toolCard("02 / RECALL", "Flashcards", "Review definitions, mechanisms and model intuition across the available sessions.", `course.html?course=${COURSE_ID}&tab=practice#flashcards`, String(flashcardCount)),
      toolCard("03 / APPLY", "Question bank", "Work through MCQs, true/false and short-answer practice written for this Student Hub.", `course.html?course=${COURSE_ID}&tab=practice#question-bank`, String(questionCount)),
      toolCard("04 / CONNECT", "Key concepts", "Jump across linked ideas such as information asymmetry, health capital, causality and physician agency.", `course.html?course=${COURSE_ID}&tab=concepts`, String(conceptCount)),
      toolCard("05 / SIMULATE", "Exam centre", "Run a 90-minute mixed mock or a 20-minute objective drill using the current Sessions 1–5 question bank.", "fhem-exam.html", "90 min"),
    );
    tools.appendChild(toolGrid);
    panel.appendChild(tools);

    const assessment = el("section", "hem-assessment");
    assessment.innerHTML =
      '<div class="hem-section-heading"><div><p class="hem-kicker">ASSESSMENT & OFFICIAL MATERIALS</p><h2>Study here. Verify there.</h2></div><p>The Student Hub adds original explanations and practice. Virtuale and UniBo remain the source of record for official teaching material and exam information.</p></div>';
    const assessmentGrid = el("div", "hem-assessment-grid");
    ctx.course.modules.forEach((module) => {
      const card = el("article", "hem-info-card");
      card.innerHTML = `
        <span class="hem-kicker">${esc(module.info.name.toUpperCase())} · ${esc(module.info.code)}</span>
        <h3>${esc(module.info.assessment)}</h3>
        <p>${esc(module.info.professors.join(", "))} · ${module.info.cfu} CFU · Cycle ${esc(module.info.cycle)}</p>
      `;
      const row = el("div", "hem-info-links");
      if (module.info.virtualeUrl) {
        const virtuale = link("Virtuale →", module.info.virtualeUrl);
        virtuale.target = "_blank";
        virtuale.rel = "noopener";
        row.appendChild(virtuale);
      }
      if (module.info.officialUrl) {
        const official = link("Official module page →", module.info.officialUrl);
        official.target = "_blank";
        official.rel = "noopener";
        row.appendChild(official);
      }
      card.appendChild(row);
      assessmentGrid.appendChild(card);
    });
    assessment.appendChild(assessmentGrid);
    assessment.appendChild(ctx.planStatusBox());
    assessment.appendChild(
      el(
        "p",
        "hem-caption",
        "Original student study material · Restricted slides and answer keys are not republished · Progress stays on this device.",
      ),
    );
    panel.appendChild(assessment);
  }

  function learningPath(panel, ctx) {
    const economics = ctx.course.modules.find((module) => module.id === ECON_MODULE_ID);
    const heading = el("section", "hem-path-hero");
    heading.innerHTML = `
      <div>
        <p class="hem-kicker">FUNDAMENTALS IN HEALTH ECONOMICS · 79060</p>
        <h1>One path through<br>eight connected sessions.</h1>
      </div>
      <p>Start with the system and healthcare demand, move into health and inequality, then finish with provider behaviour and insurance. Sessions 6–8 stay visible without pretending their lecture notes are available yet.</p>
    `;
    panel.appendChild(heading);

    const controls = el("div", "hem-path-controls");
    const searchLabel = el("label", "hem-search-label", "Find a session or concept");
    searchLabel.htmlFor = "hem-session-search";
    const search = el("input", "hem-session-search");
    search.id = "hem-session-search";
    search.type = "search";
    search.placeholder = "Try: elasticity, Grossman, stress, physician…";
    const count = el("p", "hem-caption", "8 sessions in the course roadmap");
    count.id = "hem-session-count";
    count.setAttribute("role", "status");
    controls.append(searchLabel, search, count);
    panel.appendChild(controls);

    const container = el("div", "hem-stage-list");
    container.id = "hem-stage-list";

    for (const stage of path.stages) {
      const section = el("section", "hem-stage");
      section.dataset.stage = stage.id;
      const stageHead = el("div", "hem-stage-head");
      stageHead.innerHTML = `
        <span class="hem-stage-number">${esc(stage.number)}</span>
        <div><p class="hem-kicker">STAGE ${esc(stage.number)}</p><h2>${esc(stage.title)}</h2><p>${esc(stage.description)}</p></div>
      `;
      section.appendChild(stageHead);
      const grid = el("div", "hem-session-grid");
      path.sessions
        .filter((session) => session.stage === stage.id)
        .forEach((session) => grid.appendChild(sessionCard(session, economics)));
      section.appendChild(grid);
      container.appendChild(section);
    }
    panel.appendChild(container);

    const empty = el(
      "p",
      "hem-empty",
      "No sessions match that search. Try a broader concept or clear the field.",
    );
    empty.hidden = true;
    panel.appendChild(empty);

    search.addEventListener("input", () => {
      const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      let visible = 0;
      path.sessions.forEach((session) => {
        const card = container.querySelector(`[data-session="${session.number}"]`);
        const haystack = [
          session.title,
          session.summary,
          ...(session.keywords || []),
        ]
          .join(" ")
          .toLowerCase();
        const match = words.every((word) => haystack.includes(word));
        card.hidden = !match;
        if (match) visible++;
      });
      container.querySelectorAll(".hem-stage").forEach((stage) => {
        stage.hidden = ![...stage.querySelectorAll(".hem-session-card")].some(
          (card) => !card.hidden,
        );
      });
      count.textContent = `${visible} matching ${visible === 1 ? "session" : "sessions"}`;
      empty.hidden = visible !== 0;
    });

    const management = ctx.course.modules.find((module) => module.id === "fund-healthcare-management");
    if (management) {
      const transition = el("section", "hem-management-next");
      transition.innerHTML = `
        <div>
          <p class="hem-kicker">MODULE 02 / CYCLE 2</p>
          <h2>${esc(management.info.name)}</h2>
          <p>${esc(management.info.description)}</p>
        </div>
        <div class="hem-management-meta">
          <strong>${management.info.cfu} CFU</strong>
          <span>${esc(management.info.professors.join(", "))}</span>
          <span>${formatDay(management.info.teachingStart, { day: "numeric", month: "short" })} – ${formatDay(management.info.teachingEnd, { day: "numeric", month: "short" })}</span>
          <small>Lecture study pages will be added when the official module materials become available.</small>
        </div>
      `;
      panel.appendChild(transition);
    }
  }

  function render(panel, tab, ctx) {
    if (tab === "overview") {
      panel.classList.add("hem-course-panel");
      overview(panel, ctx);
      return true;
    }
    if (tab === "lectures") {
      panel.classList.add("hem-course-panel");
      learningPath(panel, ctx);
      return true;
    }
    panel.classList.add("hem-generic-panel");
    return false;
  }

  root.HealthEconManagement = {
    prepare,
    header,
    render,
    identity,
    sessionByTopic,
  };
})(window);
