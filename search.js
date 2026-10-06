// ===== Site-wide search (Ctrl+K) =====
// One search window for the whole site: pages, courses and modules, notes, flashcards,
// questions, concepts, resources, announcements, universities, City Guide sections, released updates and roadmap plans.
// Open it with the 🔍 button, Ctrl+K (⌘K on Mac) or "/". Arrow keys move, Enter opens, Esc closes.
// The search data is loaded only the first time the window opens, so pages stay fast.

(function siteSearch() {
  let entries = null;      // everything that can be found, built on first open
  let loading = null;
  let results = [];
  let active = 0;
  let dialog, input, list, status;

  const GROUPS = [
    ["page", "Pages"], ["course", "Courses"], ["topic", "Notes"], ["concept", "Key concepts"],
    ["flashcard", "Flashcards"], ["question", "Questions"], ["resource", "Resources"],
    ["announcement", "Announcements"], ["university", "Universities"], ["guide", "City Guide"], ["rules", "Programme and rules"],
    ["update", "Released updates"], ["roadmap", "Roadmap plans (not available yet)"],
  ];

  // Loads a script once (e.g. notes-data.js on pages that don't have it)
  function loadScript(src) {
    if ([...document.scripts].some((s) => s.src.split("?")[0].endsWith(src))) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function buildEntries() {
    const list = [];
    const add = (type, title, url, text = "", context = "", meta = "") =>
      list.push({ type, title, url, text, context, meta, searchable: simplify(`${title} ${text} ${context}`), titleSimple: simplify(title) });

    // Pages (from the menu in site-nav.js)
    add("page", "Home", "index.html", "dashboard today next exam");
    for (const entry of SITE_MENU) {
      for (const item of entry.items || [entry]) add("page", item.label, item.href, "", entry.items ? entry.label : "");
    }
    add("page", "Create an item", "create.html", "write flashcard question concept resource contribute");

    // Notes & Resources and courses (reuses notes-data.js)
    try {
      await loadScript("programme.js");
      await loadScript("notes-data.js");
      const data = await loadAll();
      for (const course of data.courses) {
        const professors = [...new Set(course.info.modules.flatMap((m) => m.professors))];
        add("course", course.info.name, courseUrl(course.id),
          `${course.code} ${course.info.modules.map((m) => `${m.name} ${m.code}`).join(" ")} ${professors.join(" ")}`,
          "", [`${course.info.cfu} CFU`, ...course.info.modules.map((m) => m.name).filter((n) => n !== course.info.name), ...professors].join(" · "));
      }
      const notesByTopic = {};
      await Promise.all(data.modules.flatMap((module) => module.topics.filter((t) => t.notes).map(async (topic) => {
        const notes = await loadNotes(module, topic);
        if (notes) notesByTopic[topic.id] = notes;
      })));
      for (const entry of buildSearchIndex(data, notesByTopic)) {
        list.push({ type: entry.type, title: entry.title, url: itemUrl(entry.id, data), text: entry.text, context: entry.courseTitle, searchable: entry.searchable, titleSimple: simplify(entry.title) });
      }
    } catch (error) {
      console.error("Search: notes", error);
    }

    // Announcements (reuses announcements.js)
    try {
      if (typeof rowsToAnnouncements === "function") {
        const response = await fetch(ANNOUNCEMENTS_URL);
        if (response.ok) {
          const active = activeAnnouncements(rowsToAnnouncements(parseCsv(await response.text())), todayKey());
          for (const a of active) add("announcement", a.title, `announcements.html#${a.id}`, a.message, a.category);
        }
      }
    } catch (error) {
      console.error("Search: announcements", error);
    }

    // Partner universities and practical university services.
    try {
      const response = await fetch("content/universities.json");
      if (!response.ok) throw new Error(`University guide unavailable (${response.status})`);
      const data = await response.json();
      for (const university of data.universities || []) {
        const url = `university.html?id=${encodeURIComponent(university.id)}`;
        const context = `${university.name} · ${university.city}, ${university.country}`;
        add("university", university.name, url,
          [university.shortName, university.localName, university.tagline, university.summary].filter(Boolean).join(" "), context);
        const groups = [
          ["student-services", [...(university.quickLinks || []), ...(university.services || []), ...(university.resources || [])]],
          ["study-playbook", university.playbook || []],
          ["contacts", university.contacts || []],
          ["research-careers", [...(university.research || []), ...(university.careers || [])]],
          ["campus", university.campus?.places || []],
          ["student-life", university.studentLife || []],
        ];
        for (const [anchor, items] of groups) {
          for (const item of items) {
            const title = item.title || item.label || item.name;
            if (!title) continue;
            add("university", title, `${url}#${anchor}`,
              item.text || item.description || "", context);
          }
        }
      }
    } catch (error) {
      console.error("Search: universities", error);
    }

    // City Guide sections, for every city with a guide (list in guide-data.js)
    try {
      await loadScript("guide-data.js");
      await Promise.all(CITY_GUIDES.filter((g) => g.file).map(async (guide) => {
        const response = await fetch(guide.file);
        if (!response.ok) return;
        const city = guide.id[0].toUpperCase() + guide.id.slice(1);
        for (const section of guideSections(parseGuide(await response.text()).body)) {
          const body = section.text.replace(/<!--[\s\S]*?-->/g, " ").replace(/\[S\d+\]/g, " ").replace(/[#*>|_`-]+/g, " ");
          if (!body.trim()) continue; // e.g. Student tips before anyone wrote one
          add("guide", section.title, `city-guide.html?city=${guide.id}#${guideHeadingId(section.heading)}`, body, city);
        }
      }));
    } catch (error) {
      console.error("Search: guide", error);
    }
    // Roadmap & Updates: published updates and roadmap plans (roadmap-data.js decides what is public).
    // A plan's description always starts with its status, so it never looks like an available feature.
    try {
      await loadScript("roadmap-data.js");
      const [roadmap, updates] = await Promise.all(["content/roadmap.json", "content/updates.json"].map(async (url) => {
        const response = await fetch(url);
        return response.ok ? response.json() : null;
      }));
      for (const entry of EUHEM_ROADMAP.searchEntries(roadmap, updates)) {
        add(entry.type, entry.title, entry.url, entry.text, "", entry.meta);
      }
    } catch (error) {
      console.error("Search: roadmap", error);
    }
    // Academic Rules: one entry per section, per university and per extra topic
    try {
      const response = await fetch("content/academic-rules.json");
      if (response.ok) {
        const rules = await response.json();
        const texts = (items) => (items || []).map((item) => item.text).join(" ");
        const page = "academic-rules.html";
        add("rules", "Shared exam and re-sit rules", `${page}#joint`, texts(rules.joint));
        add("rules", "Re-sit guide", `${page}#resit-guide`, `resit retake exam again failed ${rules.resitGuide.intro}`);
        add("rules", "Grading scales", `${page}#grading`, `grades marks pass ${rules.grading.note} ${rules.grading.scales.map((s) => `${s.scale} ${s.extra}`).join(" ")}`);
        add("rules", "Plagiarism and AI", `${page}#integrity`, `ChatGPT artificial intelligence cheating fraud ${texts(rules.integrity.joint)} ${Object.values(rules.integrity.universities).map(texts).join(" ")}`);
        const tracks = await fetch("content/tracks.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const names = tracks ? tracks.cohorts[tracks.cohorts.length - 1].universities : {};
        for (const [id, university] of Object.entries(rules.universities)) {
          const name = names[id] ? `${names[id].name}, ${names[id].city}` : id;
          add("rules", `Exams and re-sits: ${name}`, `${page}#uni-${id}`,
            ["exams", "resits", "improve", "awayResit", "complaints"].map((topic) => texts(university[topic])).join(" "));
        }
        for (const topic of rules.more) add("rules", topic.title, `${page}#${topic.id}`, texts(topic.items));
      }
    } catch (error) {
      console.error("Search: academic rules", error);
    }
    // Programme Journey: each stage and each part of the page
    try {
      const response = await fetch("content/programme-events.json");
      if (response.ok) {
        const events = await response.json();
        const texts = (items) => (items || []).map((item) => item.text).join(" ");
        const page = "journey.html";
        for (const stage of events.stages) add("rules", stage.title, `${page}#stage-${stage.id}`, texts(stage.items), "Programme Journey");
        add("rules", "Joint degree: one diploma, four titles", `${page}#degree`, `diploma ${events.jointDegree.titles.map((t) => t.title).join(" ")} ${texts(events.jointDegree.items)}`, "Programme Journey");
        add("rules", events.erasmus.title, `${page}#erasmus`, `grant scholarship money ${events.erasmus.intro} ${texts(events.erasmus.items)}`, "Programme Journey");
        add("rules", "Participation fee", `${page}#fees`, "tuition fee cost pay Studielink", "Programme Journey");
        add("rules", events.history.title, `${page}#history`, events.history.events.map((e) => `${e.year} ${e.text}`).join(" "), "Programme Journey");
      }
    } catch (error) {
      console.error("Search: programme journey", error);
    }
    // Support & Contacts: the guide, each university's contacts, leave, software and community
    try {
      const response = await fetch("content/people.json");
      if (response.ok) {
        const people = await response.json();
        const texts = (items) => (items || []).map((item) => `${item.text} ${item.email || ""}`).join(" ");
        const page = "support.html";
        add("rules", "Who should I contact?", `${page}#contact-guide`, `help question ask coordinator ${people.contactGuide.questions[0].options.map((o) => o.label).join(" ")}`, "Support & Contacts");
        const tracks = await fetch("content/tracks.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const names = tracks ? tracks.cohorts[tracks.cohorts.length - 1].universities : {};
        for (const [id, university] of Object.entries(people.universities)) {
          add("rules", `Contacts and support: ${names[id] ? names[id].city : id}`, `${page}#contacts-${id}`,
            `coordinator email ombudsman psychologist counselling mental health wellbeing harassment ${university.coordinator.role} ${university.coordinator.email || ""} ${texts(university.safety)} ${texts(university.wellbeing)}`, "Support & Contacts");
        }
        add("rules", "Leave and withdrawal", `${page}#leave`, `break pause quit stop refund ${texts(people.leave)} ${texts(people.withdrawal)}`, "Support & Contacts");
        add("rules", "Software for students", `${page}#software`, `Office Word Excel licence ${texts(people.software)}`, "Support & Contacts");
        add("rules", "Community", `${page}#community`, `student representatives Instagram LinkedIn alumni ${texts(people.community)}`, "Support & Contacts");
      }
    } catch (error) {
      console.error("Search: support", error);
    }
    return list;
  }

  // Every word must match. Titles that start with / contain the words rank first.
  function search(query) {
    const words = simplify(query).split(/\s+/).filter(Boolean);
    if (!words.length || !entries) return [];
    const order = GROUPS.map(([type]) => type);
    return entries
      .filter((e) => words.every((w) => e.searchable.includes(w)))
      .map((e) => ({
        e,
        score: (e.titleSimple.startsWith(words[0]) ? 0 : words.every((w) => e.titleSimple.includes(w)) ? 1 : 2) * 20 + order.indexOf(e.type),
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map(({ e }) => e);
  }

  // The grey line under a result: a fixed summary (courses) or the text around the first match
  function snippet(entry, query) {
    if (entry.meta) return entry.meta;
    const text = entry.text || "";
    const word = simplify(query).split(/\s+/)[0] || "";
    const at = simplify(text).indexOf(word);
    if (!text) return entry.context || "";
    let start = Math.max(0, at - 40);
    if (start) start = text.indexOf(" ", start) + 1 || start; // begin at a whole word
    return (start ? "…" : "") + text.slice(start, start + 110) + (text.length > start + 110 ? "…" : "");
  }

  function render(query) {
    list.innerHTML = "";
    results = search(query);
    active = 0;
    if (!query.trim()) {
      status.textContent = "Type to search pages, courses, notes, flashcards, announcements, universities, the City Guide and the roadmap.";
      return;
    }
    status.textContent = results.length ? `${results.length} result${results.length === 1 ? "" : "s"}` : `No results for “${query}”`;
    const grouped = GROUPS.map(([type, label]) => [label, results.filter((r) => r.type === type)]).filter(([, items]) => items.length);
    results = grouped.flatMap(([, items]) => items); // keyboard order = shown order
    let i = 0;
    for (const [label, items] of grouped) {
      list.appendChild(createElement("li", "search-group-label", label));
      for (const item of items) {
        const li = createElement("li");
        const link = createElement("a", "search-result");
        link.href = item.url;
        link.id = `search-result-${i}`;
        link.setAttribute("role", "option");
        const title = createElement("span", "search-result-title");
        title.appendChild(highlight(item.title, query));
        link.appendChild(title);
        const meta = snippet(item, query);
        if (meta) {
          const sub = createElement("span", "search-result-meta");
          sub.appendChild(highlight(meta, query));
          link.appendChild(sub);
        }
        const index = i;
        link.addEventListener("mouseenter", () => setActive(index));
        link.addEventListener("click", () => dialog.close());
        li.appendChild(link);
        list.appendChild(li);
        i++;
      }
    }
    setActive(0);
  }

  // Uses highlightMatches from notes-data.js when available (safe: no HTML built from text)
  function highlight(text, query) {
    return typeof highlightMatches === "function" ? highlightMatches(text, query) : document.createTextNode(text);
  }

  function setActive(index) {
    const links = list.querySelectorAll(".search-result");
    if (!links.length) return;
    active = (index + links.length) % links.length;
    links.forEach((link, i) => link.setAttribute("aria-selected", String(i === active)));
    input.setAttribute("aria-activedescendant", links[active].id);
    links[active].scrollIntoView({ block: "nearest" });
  }

  function build() {
    dialog = createElement("dialog", "search-dialog");
    dialog.setAttribute("aria-label", "Search the site");
    const bar = createElement("div", "search-bar");
    if (typeof siteIcon === "function") bar.appendChild(siteIcon("search"));
    input = createElement("input", "search-input");
    input.type = "search";
    input.placeholder = "Search the EU-HEM Student Hub…";
    input.setAttribute("aria-label", "Search");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-controls", "search-results-list");
    input.setAttribute("aria-expanded", "true");
    bar.appendChild(input);
    bar.appendChild(createElement("kbd", "search-esc", "Esc"));
    dialog.appendChild(bar);
    status = createElement("p", "search-status");
    status.setAttribute("aria-live", "polite");
    dialog.appendChild(status);
    list = createElement("ul", "search-results");
    list.id = "search-results-list";
    list.setAttribute("role", "listbox");
    dialog.appendChild(list);
    dialog.appendChild(createElement("p", "search-hint", "↑ ↓ to move · Enter to open · Esc to close"));

    let timer = null;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => render(input.value), 120);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); setActive(active + 1); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActive(active - 1); }
      if (event.key === "Enter") {
        const link = list.querySelectorAll(".search-result")[active];
        if (link) { event.preventDefault(); dialog.close(); window.location.href = link.href; }
      }
    });
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    document.body.appendChild(dialog);
  }

  async function open() {
    if (!dialog) build();
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    if (typeof markSetupDone === "function") markSetupDone("search");
    if (!entries) {
      status.textContent = "Loading…";
      loading = loading || buildEntries().then((list) => { entries = list; });
      await loading;
      render(input.value);
    }
  }

  document.addEventListener("open-search", open);
  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      open();
    } else if (event.key === "/" && !typing && !document.getElementById("notes-search")) {
      // On the Notes page "/" belongs to its own search box
      event.preventDefault();
      open();
    }
  });
})();
