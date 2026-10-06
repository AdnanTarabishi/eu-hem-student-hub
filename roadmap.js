// ===== Roadmap & Updates (roadmap.html) =====
// Tabs: Roadmap (Now / Next / Later), Updates (published releases) and Our journey (milestones + releases).
// Every plan and update has a direct link: roadmap.html#feature-<id> or roadmap.html#update-<id> opens its
// details; #roadmap, #updates and #journey open a tab. Back/Forward follow these links.
// Data rules live in roadmap-data.js; content in content/roadmap.json and content/updates.json.
(function roadmapPage() {
  "use strict";
  const root = document.getElementById("roadmap-main");
  if (!root || !window.EUHEM_ROADMAP) return;
  const R = window.EUHEM_ROADMAP;

  const TABS = ["roadmap", "updates", "journey"];
  const SAVED_KEY = "euhem.roadmap.saved.v1"; // { version: 1, ids: [...] } on this device only
  const LATER_PREVIEW = 6; // Later ideas shown before "Show all"
  const $ = (id) => document.getElementById(id);

  const state = {
    tab: "roadmap",
    query: "",
    category: "all",
    stage: "all",
    type: "all",
    version: "all", // Updates tab: "v0.9", ...
    savedOnly: false,
    laterOpen: false,
    saved: new Set(),
    storageWorks: true,
    roadmap: null, // readRoadmap() result
    updates: null, // publishedUpdates() result
    openId: null, // "feature-x" / "update-y" while the drawer is open
  };
  let returnFocusKey = null; // the control that opened the drawer (by key: the lists are redrawn)

  // ----- Small helpers -----
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function icon(name, className = "icon") {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(ns, "use");
    use.setAttribute("href", `icons.svg#${name}`);
    svg.appendChild(use);
    return svg;
  }

  function button(text, className, onClick, focusKey) {
    const b = el("button", className, text);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    // Lists are redrawn after every change: the key lets focus return to the same control
    if (focusKey) b.dataset.focusKey = focusKey;
    return b;
  }

  function linkTo(link, className) {
    const a = el("a", className, link.label);
    a.href = link.url;
    if (/^https:/.test(link.url)) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    return a;
  }

  const category = (id) => (state.roadmap && state.roadmap.categories.find((c) => c.id === id)) || { id, label: id, icon: "info" };

  function statusPill(statusKey) {
    const label = statusKey === "released" ? R.RELEASED_LABEL : R.ROADMAP_STATUS[statusKey];
    return el("span", `roadmap-pill is-${statusKey}`, label);
  }

  function categoryTag(id) {
    const c = category(id);
    const tag = el("span", "roadmap-category");
    tag.append(icon(c.icon), document.createTextNode(c.label));
    return tag;
  }

  function say(message) {
    if (typeof toast === "function") toast(message); // ui.js: also read out by screen readers
  }

  // ----- Saved plans (this device only; not a vote, subscription or notification) -----
  function readSaved() {
    try {
      const data = JSON.parse(window.localStorage.getItem(SAVED_KEY) || "null");
      if (data && data.version === 1 && Array.isArray(data.ids)) {
        state.saved = new Set(data.ids.filter((id) => typeof id === "string" && R.ID_PATTERN.test(id)).slice(0, 200));
      }
    } catch {
      state.storageWorks = false;
    }
  }

  function writeSaved() {
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify({ version: 1, ids: [...state.saved] }));
      state.storageWorks = true;
    } catch {
      state.storageWorks = false; // the choice still works until the page is closed
    }
  }

  function toggleSaved(item) {
    const wasSaved = state.saved.has(item.id);
    if (wasSaved) state.saved.delete(item.id);
    else state.saved.add(item.id);
    writeSaved();
    say(`${wasSaved ? "Removed" : "Saved on this device"}: ${item.title}${state.storageWorks ? "" : " (for this visit only: this browser blocks saving)"}`);
    render();
    if (state.openId === `feature-${item.id}`) renderDrawer();
  }

  function saveButton(item, extraClass = "") {
    const saved = state.saved.has(item.id);
    const b = button("", `roadmap-save ${extraClass}`, () => toggleSaved(item), `save-${item.id}-${extraClass ? "drawer" : "card"}`);
    b.setAttribute("aria-pressed", String(saved));
    b.setAttribute("aria-label", `${saved ? "Saved" : "Save"}: ${item.title}`);
    b.append(icon(saved ? "check" : "bookmark"), el("span", null, saved ? "Saved" : "Save"));
    return b;
  }

  // ----- Filters -----
  const hasFilters = () => Boolean(state.query.trim() || state.category !== "all" ||
    (state.tab === "roadmap" && (state.stage !== "all" || state.savedOnly)) || (state.tab === "updates" && (state.type !== "all" || state.version !== "all")));

  function visiblePlans() {
    if (!state.roadmap) return [];
    return state.roadmap.items.filter((item) =>
      (state.category === "all" || item.category === state.category) &&
      (state.stage === "all" || item.lane === state.stage) &&
      (!state.savedOnly || state.saved.has(item.id)) &&
      R.matchesQuery(item, state.query, category(item.category).label));
  }

  function visibleUpdates() {
    if (!state.updates) return [];
    return state.updates.filter((item) =>
      (state.category === "all" || item.category === state.category) &&
      (state.type === "all" || item.type === state.type) &&
      (state.version === "all" || item.version === state.version) &&
      R.matchesQuery(item, state.query, category(item.category).label));
  }

  function clearFilters() {
    Object.assign(state, { query: "", category: "all", stage: "all", type: "all", version: "all", savedOnly: false });
    $("roadmap-search").value = "";
    render();
  }

  function chipGroup(container, options, current, onPick) {
    container.replaceChildren(...options.map(([value, label]) => {
      const chip = button(label, "filter-chip", () => onPick(value), `chip-${container.id}-${value}`);
      chip.setAttribute("aria-pressed", String(value === current));
      return chip;
    }));
  }

  function renderToolbar() {
    const roadmapTab = state.tab === "roadmap";
    $("roadmap-toolbar").hidden = state.tab === "journey";
    $("roadmap-stage").hidden = !roadmapTab;
    $("roadmap-saved-only").hidden = !roadmapTab;
    $("roadmap-type").hidden = state.tab !== "updates";
    $("roadmap-version").hidden = state.tab !== "updates";
    chipGroup($("roadmap-stage"), [["all", "All stages"], ["now", "Now"], ["next", "Next"], ["later", "Later"]], state.stage,
      (value) => { state.stage = value; render(); });
    chipGroup($("roadmap-type"), [["all", "All updates"], ["new", "New"], ["improved", "Improved"]], state.type,
      (value) => { state.type = value; render(); });
    const versions = R.updateVersions({ items: state.updates || [] });
    chipGroup($("roadmap-version"), [["all", "All versions"], ...versions.map((v) => [v, v])], state.version,
      (value) => { state.version = value; render(); });
    const categories = state.roadmap ? state.roadmap.categories : [];
    chipGroup($("roadmap-category"), [["all", "All topics"], ...categories.map((c) => [c.id, c.label])], state.category,
      (value) => { state.category = value; render(); });
    const savedCount = state.roadmap ? state.roadmap.items.filter((i) => state.saved.has(i.id)).length : 0;
    const saved = $("roadmap-saved-only");
    saved.replaceChildren(icon("bookmark"), document.createTextNode(` Saved (${savedCount})`));
    saved.setAttribute("aria-pressed", String(state.savedOnly));
    saved.title = "Plans you saved on this device";

    const total = roadmapTab ? (state.roadmap ? state.roadmap.items.length : 0) : (state.updates ? state.updates.length : 0);
    const shown = roadmapTab ? visiblePlans().length : visibleUpdates().length;
    const noun = roadmapTab ? "plan" : "update";
    $("roadmap-count").textContent = hasFilters() ? `Showing ${shown} of ${total} ${noun}s` : `${total} ${noun}s`;
    $("roadmap-clear").hidden = !hasFilters();
  }

  // ----- Overview shortcuts in the page header -----
  function renderOverview() {
    const items = state.roadmap ? state.roadmap.items : [];
    const count = (lane) => items.filter((i) => i.lane === lane).length;
    const entries = [
      ["now", "Now", count("now"), "roadmap"], ["next", "Next", count("next"), "roadmap"],
      ["later", "Later", count("later"), "roadmap"], ["released", "Released", state.updates ? state.updates.length : 0, "updates"],
    ];
    $("roadmap-overview").replaceChildren(...entries.map(([key, label, n, tab]) => {
      const li = el("li");
      const b = button("", `roadmap-overview-item is-${key}`, () => {
        state.stage = key === "released" ? "all" : key;
        if (key !== "released") state.savedOnly = false;
        selectTab(tab, { focusPanel: true });
      });
      b.append(el("span", "roadmap-overview-number", n), el("span", "roadmap-overview-label", label));
      b.setAttribute("aria-label", `${label}: ${n} ${key === "released" ? "releases" : "plans"}`);
      li.appendChild(b);
      return li;
    }));
    if (state.roadmap) $("roadmap-reviewed").textContent = `Last reviewed ${R.dayLabel(state.roadmap.updatedAt)}`;
    renderVision();
  }

  // Progress: the releases shipped so far (counted from updates.json) and the season of the full Hub
  function renderVision() {
    const box = $("roadmap-vision");
    const vision = state.roadmap && state.roadmap.vision;
    box.hidden = !vision;
    if (!vision) return;
    const shipped = R.releaseCount({ items: state.updates || [] });
    const head = el("div", "roadmap-vision-head");
    head.append(el("span", "roadmap-vision-title", vision.title), el("span", "roadmap-vision-count", shipped.text));
    const meta = el("p", "roadmap-vision-meta");
    meta.append(el("strong", null, `Full Hub: ${vision.targetLabel}`));
    box.replaceChildren(head, meta, el("p", "roadmap-vision-note", vision.note));
  }

  // Release stage (Beta · v0.9) and the next release with its target date
  function renderRelease() {
    const box = $("roadmap-release");
    const release = state.roadmap && state.roadmap.release;
    box.hidden = !release;
    if (!release) return;
    const stage = el("p", "roadmap-release-stage");
    stage.append(el("span", "roadmap-release-badge", release.stage), el("strong", null, release.version));
    const next = el("p", "roadmap-release-next");
    next.append(document.createTextNode("Next: "), el("strong", null, `${release.next.version} — ${release.next.name}`),
      document.createTextNode(" · target "));
    const date = el("time", null, R.dayLabel(release.next.targetDate));
    date.dateTime = release.next.targetDate;
    next.appendChild(date);
    box.replaceChildren(stage, next, el("p", "roadmap-release-note", release.note));
  }

  // "What's in v1.0": each part with its real status (planned / in progress / released in a version)
  function renderV1() {
    const box = $("roadmap-v1");
    const release = state.roadmap && state.roadmap.release;
    const includes = release ? release.next.includes : [];
    box.hidden = !includes.length || hasFilters();
    if (box.hidden) return;
    const head = el("div", "roadmap-v1-head");
    const title = el("h2", "roadmap-v1-title", `What's in ${release.next.version}`);
    title.id = "roadmap-v1-title";
    head.append(title, el("p", "roadmap-estimate", `${release.next.name} · target ${R.dayLabel(release.next.targetDate)}`));
    const list = el("ul", "roadmap-v1-list");
    for (const entry of includes) {
      const li = el("li", "roadmap-v1-item");
      const plan = entry.item && state.roadmap.items.find((i) => i.id === entry.item);
      const update = entry.update && (state.updates || []).find((u) => u.id === entry.update);
      if (plan) {
        li.append(statusPill(plan.status), openButton(plan, "feature", entry.label));
      } else if (update) {
        const pill = el("span", "roadmap-pill is-released", `${R.RELEASED_LABEL} in ${update.version}`);
        li.append(pill, openButton(update, "update", entry.label));
      } else {
        continue; // points to something not on the page (e.g. an unpublished update): leave it out
      }
      li.lastChild.dataset.focusKey = `v1-${entry.label}`;
      list.appendChild(li);
    }
    box.replaceChildren(head, list);
  }

  // Known limitations, the domain move and the feedback button
  function renderInfo() {
    const box = $("roadmap-info");
    const r = state.roadmap;
    const blocks = r ? [r.limitations, r.domainMove].filter(Boolean) : [];
    box.hidden = !blocks.length && !(r && r.feedback);
    if (box.hidden) return;
    const grid = el("div", "roadmap-info-grid");
    for (const block of blocks) {
      const card = el("section", "roadmap-info-card");
      card.append(el("h2", "roadmap-info-title", block.title));
      const list = el("ul");
      for (const line of block.items) list.appendChild(el("li", null, line));
      card.appendChild(list);
      grid.appendChild(card);
    }
    box.replaceChildren(grid);
    if (r.feedback) {
      const row = el("p", "roadmap-feedback");
      const a = linkTo(r.feedback, "button button-primary roadmap-feedback-button");
      a.prepend(icon("mail"), document.createTextNode(" "));
      row.appendChild(a);
      box.appendChild(row);
    }
  }

  // ----- Roadmap tab -----
  function openButton(item, kind, text) {
    const b = button(text, "roadmap-open", (e) => openDetail(`${kind}-${item.id}`, e.currentTarget),
      `open-${kind}-${item.id}-${text === "Details" ? "more" : "title"}`);
    b.setAttribute("aria-haspopup", "dialog");
    return b;
  }

  function planCard(item, variant) {
    const card = el("article", `roadmap-card is-${variant}${state.saved.has(item.id) ? " is-saved" : ""}`);
    card.id = `feature-${item.id}`;
    const head = el("div", "roadmap-card-head");
    head.append(categoryTag(item.category), statusPill(item.status));
    const title = el(variant === "now" ? "h3" : "h4", "roadmap-card-title");
    title.appendChild(openButton(item, "feature", item.title));
    card.append(head, title, el("p", "roadmap-card-summary", item.summary));
    if (item.note) card.appendChild(el("p", "roadmap-card-note", item.note));
    if (variant === "now") {
      const list = el("ul", "roadmap-now-list");
      for (const line of item.details) list.appendChild(el("li", null, line));
      card.appendChild(list);
    }
    const foot = el("div", "roadmap-card-foot");
    if (item.target && variant === "now") foot.appendChild(el("span", "roadmap-when", `Target: ${item.target.label}`));
    const actions = el("div", "roadmap-card-actions");
    const more = openButton(item, "feature", "Details");
    more.classList.add("roadmap-details-link");
    more.setAttribute("aria-label", `Details: ${item.title}`);
    more.appendChild(el("span", "arrow", " →")).setAttribute("aria-hidden", "true");
    actions.append(saveButton(item), more);
    foot.appendChild(actions);
    card.appendChild(foot);
    return card;
  }

  function laneHeader(laneId, extra) {
    const lane = state.roadmap.lanes.find((l) => l.id === laneId) || { title: laneId, description: "" };
    const head = el("div", "roadmap-lane-head");
    const titleBox = el("div");
    const h2 = el("h2", "roadmap-lane-title");
    h2.append(el("span", `roadmap-lane-dot is-${laneId}`), document.createTextNode(lane.title));
    titleBox.append(h2, el("p", "roadmap-lane-description", lane.description));
    head.appendChild(titleBox);
    if (extra) head.appendChild(extra);
    return head;
  }

  function renderRoadmap() {
    const board = $("roadmap-board");
    board.replaceChildren();
    if (!state.roadmap) return;
    const plans = visiblePlans();
    if (!plans.length) {
      board.appendChild(emptyState(state.savedOnly && !state.query && state.category === "all"
        ? "No saved plans yet" : "No plans match these filters",
        state.savedOnly ? "Use Save on a plan to keep it here. Saved plans stay on this device only." : "Try other words or clear the filters."));
      return;
    }
    const now = plans.filter((i) => i.lane === "now");
    const next = plans.filter((i) => i.lane === "next");
    const later = plans.filter((i) => i.lane === "later");

    if (now.length) {
      const section = el("section", "roadmap-lane is-now");
      section.setAttribute("aria-labelledby", "lane-now");
      section.appendChild(laneHeader("now"));
      section.querySelector("h2").id = "lane-now";
      now.forEach((item) => section.appendChild(planCard(item, "now")));
      board.appendChild(section);
    }

    if (next.length) {
      const section = el("section", "roadmap-lane is-next");
      section.setAttribute("aria-labelledby", "lane-next");
      section.appendChild(laneHeader("next", el("p", "roadmap-estimate", "Estimated periods, not promises")));
      section.querySelector("h2").id = "lane-next";
      const timeline = el("ol", "roadmap-windows");
      for (const group of R.groupNext(next)) {
        const li = el("li", "roadmap-window");
        const label = el("h3", "roadmap-window-label");
        label.append(el("span", "roadmap-window-dot"), document.createTextNode(group.label));
        const count = el("span", "roadmap-window-count", `${group.items.length} ${group.items.length === 1 ? "plan" : "plans"}`);
        const grid = el("div", "roadmap-grid");
        group.items.forEach((item) => grid.appendChild(planCard(item, "next")));
        li.append(label, count, grid);
        timeline.appendChild(li);
      }
      section.appendChild(timeline);
      board.appendChild(section);
    }

    if (later.length) {
      const section = el("section", "roadmap-lane is-later");
      section.setAttribute("aria-labelledby", "lane-later");
      section.appendChild(laneHeader("later", el("p", "roadmap-estimate", "Ideas · no dates yet")));
      section.querySelector("h2").id = "lane-later";
      // Filtering, a direct link or "Show all" reveals every idea; otherwise a short preview
      const linked = state.openId && later.some((i) => state.openId === `feature-${i.id}`);
      const showAll = Boolean(state.laterOpen || hasFilters() || linked);
      const grid = el("div", "roadmap-grid is-later");
      grid.id = "roadmap-later-grid";
      (showAll ? later : later.slice(0, LATER_PREVIEW)).forEach((item) => grid.appendChild(planCard(item, "later")));
      section.appendChild(grid);
      if (later.length > LATER_PREVIEW && !hasFilters()) {
        const toggle = button(showAll ? "Show fewer ideas" : `Show all ${later.length} ideas`, "button button-secondary roadmap-later-toggle", () => {
          state.laterOpen = !showAll;
          renderRoadmap();
          const again = root.querySelector(".roadmap-later-toggle");
          if (again) again.focus();
        });
        toggle.setAttribute("aria-expanded", String(showAll));
        toggle.setAttribute("aria-controls", "roadmap-later-grid");
        section.appendChild(toggle);
      }
      board.appendChild(section);
    }
  }

  // ----- Updates tab -----
  function updateEntry(item) {
    const article = el("article", "update-entry");
    article.id = `update-${item.id}`;
    const head = el("div", "roadmap-card-head");
    head.append(el("span", `roadmap-pill is-${item.type}`, R.UPDATE_TYPES[item.type]), categoryTag(item.category));
    if (item.version) head.appendChild(el("span", "roadmap-version", item.version));
    const title = el("h3", "roadmap-card-title");
    title.appendChild(openButton(item, "update", item.title));
    article.append(head, title, el("p", "roadmap-card-summary", item.summary));
    if (item.highlights.length) {
      const list = el("ul", "update-highlights");
      for (const line of item.highlights.slice(0, 2)) list.appendChild(el("li", null, line));
      article.appendChild(list);
    }
    const foot = el("div", "roadmap-card-foot");
    const actions = el("div", "roadmap-card-actions");
    if (item.links[0]) actions.appendChild(linkTo(item.links[0], "link-arrow"));
    const more = openButton(item, "update", "Details");
    more.classList.add("roadmap-details-link");
    more.setAttribute("aria-label", `Details: ${item.title}`);
    actions.appendChild(more);
    foot.appendChild(actions);
    article.appendChild(foot);
    return article;
  }

  function renderUpdates() {
    const box = $("updates-list");
    box.replaceChildren();
    if (!state.updates) return;
    const list = visibleUpdates();
    if (!list.length) {
      box.appendChild(emptyState("No updates match these filters", "Try other words or clear the filters."));
      return;
    }
    const days = el("ol", "update-days");
    let current = null;
    for (const item of list) {
      if (!current || current.date !== item.date) {
        current = { date: item.date, li: el("li", "update-day"), entries: el("div", "update-day-entries") };
        const date = el("time", "update-date", R.dayLabel(item.date));
        date.dateTime = item.date;
        current.li.append(date, current.entries);
        days.appendChild(current.li);
      }
      current.entries.appendChild(updateEntry(item));
    }
    box.appendChild(days);
  }

  // Order within one day: completed milestones, then releases by deployment time, then planned milestones
  function dayOrder(event) {
    if (event.kind === "milestone") return event.item.status === "planned" ? Infinity : -Infinity;
    return Date.parse((event.item.evidence && event.item.evidence.deployedAt) || "") || 0;
  }

  // ----- Our journey: milestones and releases, oldest first -----
  function renderJourney() {
    const list = $("journey-list");
    list.replaceChildren();
    if (!state.roadmap) return;
    const events = [
      ...state.roadmap.milestones.map((m) => ({ kind: "milestone", date: m.date, item: m })),
      ...(state.updates || []).map((u) => ({ kind: "release", date: u.date, item: u })),
    ].sort((a, b) => a.date.localeCompare(b.date) || dayOrder(a) - dayOrder(b));
    for (const event of events) {
      const planned = event.kind === "milestone" && event.item.status === "planned";
      const li = el("li", `journey-event is-${event.kind}${planned ? " is-planned" : ""}`);
      const date = el("time", "journey-date", R.dayLabel(event.date));
      date.dateTime = event.date;
      const body = el("div", "journey-body");
      const tag = event.kind === "milestone"
        ? el("span", `roadmap-pill is-${planned ? "planned" : "milestone"}`, planned ? "Planned" : "Milestone")
        : el("span", "roadmap-pill is-released", event.item.version ? `${R.RELEASED_LABEL} · ${event.item.version}` : R.RELEASED_LABEL);
      const title = el("h3", "journey-title");
      if (event.kind === "release") title.appendChild(openButton(event.item, "update", event.item.title));
      else title.textContent = event.item.title;
      body.append(tag, title, el("p", "journey-summary", event.item.summary));
      if (event.kind === "milestone" && event.item.source && R.safeUrl(event.item.source.url)) {
        body.appendChild(linkTo(event.item.source, "journey-source"));
      }
      li.append(date, body);
      list.appendChild(li);
    }
  }

  function emptyState(title, text) {
    const box = el("div", "empty-state");
    box.append(icon("search"), el("strong", null, title), el("p", null, text));
    if (hasFilters()) box.appendChild(button("Clear filters", "button button-secondary", clearFilters));
    return box;
  }

  function render() {
    const active = document.activeElement;
    const key = active && active.dataset ? active.dataset.focusKey : null;
    renderOverview();
    renderRelease();
    renderToolbar();
    renderV1();
    renderRoadmap();
    renderInfo();
    renderUpdates();
    renderJourney();
    // The focused control was replaced: focus its new copy (if it is still shown)
    if (key && !active.isConnected) {
      const again = root.querySelector(`[data-focus-key="${key}"]`);
      if (again && !again.closest("[hidden]")) again.focus({ preventScroll: true });
    }
  }

  // ----- Tabs (arrow keys move between tabs, Home/End jump) -----
  function selectTab(tab, { focusPanel = false, updateHash = true } = {}) {
    state.tab = tab;
    for (const name of TABS) {
      const tabButton = $(`tab-${name}`);
      const selected = name === tab;
      tabButton.setAttribute("aria-selected", String(selected));
      tabButton.tabIndex = selected ? 0 : -1;
      $(`panel-${name}`).hidden = !selected;
    }
    if (updateHash && location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`);
    render();
    if (focusPanel) $(`panel-${tab}`).focus({ preventScroll: false });
  }

  function wireTabs() {
    TABS.forEach((name, index) => {
      const tabButton = $(`tab-${name}`);
      tabButton.addEventListener("click", () => selectTab(name));
      tabButton.addEventListener("keydown", (event) => {
        const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 };
        if (!(event.key in moves)) return;
        event.preventDefault();
        const target = TABS[(moves[event.key] + TABS.length) % TABS.length];
        selectTab(target);
        $(`tab-${target}`).focus();
      });
    });
  }

  // ----- Details drawer -----
  function findDetail(id) {
    if (id.startsWith("feature-") && state.roadmap) {
      const item = state.roadmap.items.find((i) => `feature-${i.id}` === id);
      return item ? { kind: "feature", item } : null;
    }
    if (id.startsWith("update-") && state.updates) {
      const item = state.updates.find((i) => `update-${i.id}` === id);
      return item ? { kind: "update", item } : null;
    }
    return null;
  }

  function section(title, content) {
    const box = el("section", "roadmap-drawer-section");
    box.appendChild(el("h3", null, title));
    box.appendChild(content);
    return box;
  }

  function bulletList(lines) {
    const ul = el("ul");
    for (const line of lines) ul.appendChild(el("li", null, line));
    return ul;
  }

  function renderDrawer() {
    const body = $("roadmap-drawer-body");
    const found = state.openId && findDetail(state.openId);
    body.replaceChildren();
    if (!found) return;
    const { kind, item } = found;
    const top = el("div", "roadmap-drawer-top");
    const tags = el("div", "roadmap-card-head");
    tags.append(kind === "feature" ? statusPill(item.status) : statusPill("released"), categoryTag(item.category));
    const close = button("", "header-button roadmap-drawer-close", closeDetail);
    close.setAttribute("aria-label", "Close details");
    close.appendChild(icon("close"));
    top.append(tags, close);
    const title = el("h2", null, item.title);
    title.id = "roadmap-drawer-title";
    body.append(top, title, el("p", "roadmap-drawer-summary", item.summary));

    if (kind === "feature") {
      const when = item.target ? `${item.target.label} · an estimate, not a promise`
        : item.lane === "next" ? `${R.AFTER_LAUNCH}: planned, no date yet` : "No date yet: an idea we are exploring";
      body.appendChild(el("p", "roadmap-drawer-when", when));
      body.appendChild(el("p", "roadmap-drawer-note",
        item.status === "in-progress" ? "Being worked on now. Not available yet." : "Not available yet."));
      body.appendChild(section("Why it matters", el("p", null, item.why)));
      if (item.details.length) body.appendChild(section("What it may include", bulletList(item.details)));
      if (item.note) body.appendChild(el("p", "roadmap-card-note", item.note));
      if (item.dependencies.length) body.appendChild(section("Depends on", bulletList(item.dependencies)));
    } else {
      const date = el("p", "roadmap-drawer-when", `Released ${R.dayLabel(item.date)}`);
      body.appendChild(date);
      if (item.highlights.length) body.appendChild(section("What's included", bulletList(item.highlights)));
    }
    if (item.links.length) {
      const links = el("ul", "roadmap-drawer-links");
      for (const link of item.links) {
        const li = el("li");
        li.appendChild(linkTo(link, "link-arrow"));
        links.appendChild(li);
      }
      body.appendChild(section("Related", links));
    }

    const actions = el("div", "roadmap-drawer-actions");
    if (kind === "feature") actions.appendChild(saveButton(item, "button button-secondary"));
    actions.appendChild(button("Copy link", "button button-secondary", copyLink));
    body.appendChild(actions);
    if (kind === "feature") {
      body.appendChild(el("p", "roadmap-drawer-help",
        "Saving keeps this plan in your Saved list on this device. It is not a vote, a subscription or a notification."));
    } else if (item.evidence && R.isRunUrl(item.evidence.deploymentUrl)) {
      const source = el("p", "roadmap-drawer-help");
      source.append(document.createTextNode("Release date from the site deployment: "),
        linkTo({ label: "view on GitHub", url: item.evidence.deploymentUrl }));
      body.appendChild(source);
    }
  }

  function openDetail(id, opener, { push = true } = {}) {
    const found = findDetail(id);
    if (!found) {
      say("That item is not on the roadmap any more.");
      return false;
    }
    if (found.kind === "feature" && state.tab !== "roadmap") selectTab("roadmap", { updateHash: false });
    if (found.kind === "update" && state.tab === "roadmap") selectTab("updates", { updateHash: false });
    state.openId = id;
    if (opener && opener.dataset.focusKey) returnFocusKey = opener.dataset.focusKey;
    if (push && location.hash !== `#${id}`) history.pushState({ roadmapDetail: true }, "", `#${id}`);
    render(); // reveals a linked Later idea
    renderDrawer();
    const drawer = $("roadmap-drawer");
    if (!drawer.open) drawer.showModal();
    drawer.querySelector(".roadmap-drawer-close").focus();
    return true;
  }

  function closeDetail() {
    const drawer = $("roadmap-drawer");
    if (drawer.open) drawer.close();
  }

  function onDrawerClosed() {
    const id = state.openId;
    state.openId = null;
    // Leave the item's address: go back if we added it, otherwise show the tab
    if (location.hash === `#${id}`) {
      if (history.state && history.state.roadmapDetail) history.back();
      else history.replaceState(null, "", `#${state.tab}`);
    }
    const target = (returnFocusKey && root.querySelector(`[data-focus-key="${returnFocusKey}"]`)) ||
      (id && document.getElementById(id) && document.getElementById(id).querySelector(".roadmap-open"));
    if (target) target.focus();
    returnFocusKey = null;
  }

  async function copyLink() {
    const url = `${location.href.split("#")[0]}#${state.openId}`;
    try {
      await navigator.clipboard.writeText(url);
      say("Link copied");
    } catch {
      say(`Copy this link: ${url}`);
    }
  }

  // ----- Address (hash) routing: initial load and Back/Forward -----
  function route() {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (/^(feature|update)-/.test(hash)) {
      if (state.openId !== hash) openDetail(hash, null, { push: false });
      return;
    }
    if ($("roadmap-drawer").open) {
      state.openId = null;
      $("roadmap-drawer").close();
    }
    selectTab(TABS.includes(hash) ? hash : state.tab, { updateHash: false });
  }

  // ----- Loading -----
  async function loadJson(url) {
    const response = await fetch(url, { cache: "no-cache" }); // always ask for the latest roadmap
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function showError(statusId, what, retry) {
    const status = $(statusId);
    status.hidden = false;
    status.className = "roadmap-status feedback feedback-error";
    status.replaceChildren(document.createTextNode(`The ${what} could not be loaded. Check your connection. `),
      button("Retry", "button button-secondary button-sm", retry));
  }

  async function loadRoadmap() {
    $("roadmap-status").hidden = false;
    $("roadmap-status").className = "roadmap-status";
    $("roadmap-status").textContent = "Loading the roadmap…";
    try {
      state.roadmap = R.readRoadmap(await loadJson("content/roadmap.json"));
      $("roadmap-status").hidden = true;
      $("roadmap-planning-note").textContent = state.roadmap.planningNote;
    } catch (error) {
      console.error("Roadmap:", error);
      showError("roadmap-status", "roadmap", () => loadRoadmap().then(afterLoad));
    }
  }

  async function loadUpdates() {
    $("updates-status").hidden = false;
    $("updates-status").className = "roadmap-status";
    $("updates-status").textContent = "Loading updates…";
    try {
      const data = await loadJson("content/updates.json");
      state.updates = R.publishedUpdates(data); // drafts never reach the page
      $("updates-status").hidden = true;
      $("updates-date-basis").textContent = data.dateBasis || "";
    } catch (error) {
      console.error("Updates:", error);
      showError("updates-status", "updates", () => loadUpdates().then(afterLoad));
    }
  }

  function afterLoad() {
    render();
    route();
  }

  function init() {
    readSaved();
    wireTabs();
    $("roadmap-search").addEventListener("input", (event) => { state.query = event.target.value; render(); });
    $("roadmap-saved-only").addEventListener("click", () => { state.savedOnly = !state.savedOnly; render(); });
    $("roadmap-clear").addEventListener("click", clearFilters);
    const drawer = $("roadmap-drawer");
    drawer.addEventListener("close", onDrawerClosed);
    drawer.addEventListener("click", (event) => { if (event.target === drawer) closeDetail(); }); // backdrop
    window.addEventListener("hashchange", route);
    window.addEventListener("popstate", route);
    Promise.all([loadRoadmap(), loadUpdates()]).then(afterLoad);
  }

  init();
})();
