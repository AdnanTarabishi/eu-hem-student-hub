/* Page-only noticeboard controller.
   Reuses the CSV/date/election helpers in announcements.js, which still owns the
   site-wide urgent banner. This page reads the same CSV independently so the
   shared loader and all other pages can remain unchanged. No account or tracking.
   Optional image columns: Image | Image alt | Image credit (local files only). */
(function () {
  "use strict";
  const root = document.getElementById("newsroom");
  if (!root) return;
  const $ = (id) => document.getElementById(id);
  const el = (tag, className, text) => createElement(tag, className, text);
  const feed = $("news-feed");
  const feature = $("news-feature");
  const reader = $("news-reader");
  const state = { all: [], active: [], today: "", category: "", query: "", newOnly: false, sort: "priority", view: "grid", openedId: "", loading: true, failed: false };
  const categoryTones = Object.freeze({
    "Student Community": "community", Student: "community", Programme: "programme",
    "Student Hub": "hub", Academic: "academic", University: "university", Social: "social", Urgent: "urgent",
  });
  let readerOpener = null;
  let fetching = false;

  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "icons.svg#" + name);
    svg.append(use);
    return svg;
  }

  // Calendar dates are interpreted in the programme's Bologna timezone.
  function todayInBologna() {
    if (typeof announcementTodayKey === "function") return announcementTodayKey();
    // Compatibility if an older cached shared script is still being refreshed.
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type) => parts.find((p) => p.type === type).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  function localImage(value) {
    const path = String(value || "").trim();
    return /^(?:img|assets)\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.(?:png|jpe?g|webp|avif)$/i.test(path) ? path : "";
  }

  function readRows(text) {
    const rows = parseCsv(text);
    const headers = (rows[0] || []).map((h) => h.trim());
    if (!["Date", "Title", "Category", "Message"].every((h) => headers.includes(h))) {
      throw new Error("The announcements feed is missing its required columns.");
    }
    const optional = (row, name) => String(row[headers.indexOf(name)] || "").trim();
    const unique = new Map();
    for (const item of rowsToAnnouncements(rows)) {
      const raw = rows[item.row + 1] || [];
      item.image = localImage(optional(raw, "Image"));
      item.imageAlt = optional(raw, "Image alt");
      item.imageCredit = optional(raw, "Image credit");
      item.category = item.category || "Other";
      unique.set(item.id, item);
    }
    return [...unique.values()];
  }

  function textForSearch(item) {
    const names = isElectionResultsAnnouncement(item) ? ELECTION_RESULTS_2026.flatMap((group) => group.candidates).join(" ") : "";
    return simplify([item.title, item.message, item.category, item.postedBy, names].join(" "));
  }

  function filteredItems() {
    const words = simplify(state.query.trim()).split(/\s+/).filter(Boolean);
    const result = state.active.filter((item) =>
      (!state.category || item.category === state.category) &&
      (!state.newOnly || isNewAnnouncement(item, state.today)) &&
      words.every((word) => textForSearch(item).includes(word))
    );
    if (state.sort !== "priority") {
      result.sort((a, b) => {
        // Undated posts follow dated posts in either chronological order.
        if (!a.date !== !b.date) return a.date ? -1 : 1;
        const order = a.date.localeCompare(b.date) || a.row - b.row;
        return state.sort === "oldest" ? order : -order;
      });
    }
    return result;
  }

  function displayTitle(item) {
    // The source text and legacy deep-link ID are unchanged.
    return item.title.replace(/\s*(?:🗳️|🎉)\s*$/u, "");
  }

  function excerpt(item) {
    if (isElectionResultsAnnouncement(item)) return item.message.split(/\r?\n/)[0].trim();
    const text = item.message.replace(/\s+/g, " ").trim();
    if (text.length <= 170) return text;
    const short = text.slice(0, 167);
    return short.slice(0, Math.max(short.lastIndexOf(" "), 120)) + "…";
  }

  function badge(text, modifier, symbol) {
    const node = el("span", "news-badge" + (modifier ? " news-badge--" + modifier : ""));
    if (symbol) node.append(icon(symbol));
    node.append(document.createTextNode(text));
    return node;
  }

  function meta(item) {
    const box = el("div", "news-meta");
    box.append(badge(item.category, categoryTones[item.category] || "other"));
    if (item.pinned) box.append(badge("Pinned", "pin", "bookmark"));
    if (isNewAnnouncement(item, state.today)) box.append(badge("New", "new"));
    return box;
  }

  function byline(item) {
    const box = el("p", "news-byline");
    if (item.postedBy) box.append(el("span", "", item.postedBy));
    if (item.date) {
      const time = el("time", "", formatDay(item.date, { day: "numeric", month: "short", year: "numeric" }));
      time.dateTime = item.date;
      box.append(time);
    }
    return box;
  }

  function artwork(item) {
    let kind = "generic", symbol = "bell", label = "COHORT UPDATE", title = "Good to know.";
    if (isElectionResultsAnnouncement(item)) {
      kind = "election"; symbol = "students"; label = "STUDENT VOICE"; title = "Your voice. Your representatives.";
    } else if (/track preferences/i.test(item.title)) {
      kind = "tracks"; symbol = "route"; label = "THE NEXT CHAPTER"; title = "Your journey continues.";
    } else if (/welcome.*student hub/i.test(item.title)) {
      kind = "beta"; symbol = "rocket"; label = "THE HUB · BETA"; title = "Made for the cohort.";
    } else if (item.category === "Urgent") {
      kind = "urgent"; symbol = "alert"; label = "IMPORTANT UPDATE"; title = "Worth your attention.";
    }
    const box = el("div", `news-art news-art--${kind}`);
    box.setAttribute("aria-hidden", "true");
    const tile = el("span", "news-art-icon"); tile.append(icon(symbol));
    box.append(tile, el("span", "news-art-title", title), el("span", "news-art-label", label));
    if (kind === "tracks") {
      const chips = el("div", "news-art-chips");
      for (const name of ["EEH", "E&P", "MHI", "PHM"]) chips.append(el("span", "news-art-chip", name));
      box.append(chips);
    }
    // Trusted artwork paths are defined in code, separately from the optional
    // photo paths validated from the Sheet. Keep every news fact in adjacent text.
    const addIllustration = () => {
      const image = el("img", "news-art-illustration");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.width = 800; image.height = 500;
      box.classList.add("news-art--illustrated");
      image.addEventListener("error", () => {
        image.remove(); box.classList.remove("news-art--illustrated");
      }, { once: true });
      image.src = announcementCoverPath(item);
      box.prepend(image);
    };
    if (item.image) {
      const image = el("img");
      image.alt = item.imageAlt;
      image.loading = "lazy";
      image.decoding = "async";
      image.width = 800; image.height = 450;
      box.classList.add("news-art--photo");
      if (item.imageAlt) box.removeAttribute("aria-hidden");
      let credit = null;
      if (item.imageCredit) { credit = el("span", "news-image-credit", item.imageCredit); box.append(credit); }
      image.addEventListener("error", () => {
        image.remove(); if (credit) credit.remove();
        box.classList.remove("news-art--photo"); box.setAttribute("aria-hidden", "true");
        addIllustration();
      }, { once: true });
      image.src = item.image;
      box.prepend(image);
    } else addIllustration();
    return box;
  }

  function openLink(item, text, className = "news-read") {
    const a = el("a", className, text);
    a.href = "#" + item.id;
    a.dataset.newsOpen = item.id;
    return a;
  }

  function copyButton(item) {
    const button = el("button", "news-copy");
    button.type = "button";
    button.setAttribute("aria-label", "Copy link to " + displayTitle(item));
    button.append(icon("link"), document.createTextNode("Copy link"));
    button.addEventListener("click", () => copyLink(item, button));
    return button;
  }

  async function copyLink(item, button) {
    const url = new URL("announcements.html", window.location.href);
    url.hash = item.id;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url.href);
      toast("Announcement link copied.");
    } catch {
      // A selectable fallback also works with denied clipboard permission or offline.
      const host = button.parentElement?.parentElement;
      if (!button.isConnected || !host?.isConnected || (reader.contains(button) && !reader.open)) return;
      let box = host.querySelector(".news-share-box");
      if (!box) {
        box = el("div", "news-share-box");
        const label = el("label", "", "Copy this announcement link");
        const input = el("input"); input.readOnly = true;
        input.setAttribute("aria-label", "Announcement link to copy");
        label.append(input); box.append(label); host.append(box);
      }
      const input = box.querySelector("input");
      input.value = url.href; input.focus(); input.select();
      toast("Select and copy the announcement link below.");
    }
  }

  function card(item, spotlight = false) {
    const article = el("article", spotlight ? "news-spotlight" : "news-card");
    // The featured post is not duplicated in the feed; legacy hashes stay unique.
    article.id = item.id;
    article.append(artwork(item));
    const copy = el("div", spotlight ? "news-spotlight-copy" : "news-card-copy");
    if (spotlight) {
      const label = el("p", "news-focus-label");
      const reason = item.category === "Urgent" ? "URGENT UPDATE" : item.pinned ? "PINNED UPDATE" : "LATEST UPDATE";
      label.append(icon("star"), document.createTextNode("IN FOCUS · " + reason));
      copy.append(label);
    }
    copy.append(meta(item));
    const heading = el(spotlight ? "h2" : "h3", "news-title");
    heading.append(openLink(item, displayTitle(item), ""));
    copy.append(heading, el("p", "news-excerpt", excerpt(item)));
    if (spotlight && isElectionResultsAnnouncement(item)) {
      const winners = el("div", "news-election-highlights");
      winners.setAttribute("aria-label", "Elected representatives");
      for (const winner of ELECTION_RESULTS_2026.flatMap((group) => group.elected)) {
        const chip = el("span");
        chip.append(el("strong", "", winner.percentage), el("span", "", winner.name));
        winners.append(chip);
      }
      copy.append(winners);
    }
    copy.append(byline(item));
    const actions = el("div", "news-card-actions");
    const link = openLink(item, isElectionResultsAnnouncement(item) ? "View full results" : "Read update");
    link.append(icon("arrow-right")); actions.append(link, copyButton(item));
    copy.append(actions); article.append(copy);
    return article;
  }

  function buildFilters() {
    const categories = [...new Set(state.active.map((item) => item.category))];
    categories.sort((a, b) => {
      const priority = (v) => CATEGORY_ORDER.includes(v) ? CATEGORY_ORDER.indexOf(v) : CATEGORY_ORDER.length;
      return priority(a) - priority(b) || a.localeCompare(b);
    });
    const filters = $("news-filters"); filters.replaceChildren();
    for (const category of ["", ...categories]) {
      const count = category ? state.active.filter((item) => item.category === category).length : state.active.length;
      const button = el("button", "news-filter"); button.type = "button";
      button.dataset.newsCategory = category;
      button.append(document.createTextNode(category || "All updates"), el("span", "news-filter-count", String(count)));
      button.addEventListener("click", () => { state.category = category; draw(); });
      filters.append(button);
    }
  }

  function showEmpty(title, message, action) {
    $("news-empty").hidden = false;
    $("news-empty-title").textContent = title;
    $("news-empty-message").textContent = message;
    $("news-empty-action").hidden = !action;
    $("news-empty-action").textContent = action || "Clear filters";
  }

  function draw() {
    if (state.loading || state.failed) return;
    const visible = filteredItems();
    const unfiltered = !state.category && !state.query.trim() && !state.newOnly;
    const featured = unfiltered && state.sort === "priority" && state.view === "grid" && visible.length > 1
      ? visible.find((item) => item.category === "Urgent") || visible[0] : null;
    feature.replaceChildren(); feature.hidden = !featured;
    if (featured) feature.append(card(featured, true));
    feed.replaceChildren(...visible.filter((item) => item !== featured).map((item) => card(item)));
    feed.classList.toggle("is-list", state.view === "list");
    feed.setAttribute("aria-busy", "false");
    $("news-feed-heading").textContent = featured ? "More updates" : "All updates";
    $("news-reset").hidden = unfiltered && state.sort === "priority";
    $("news-status").textContent = `Showing ${visible.length} of ${state.active.length} updates` + (featured ? " · 1 in focus" : "");
    for (const button of $("news-filters").children) button.setAttribute("aria-pressed", String(button.dataset.newsCategory === state.category));
    for (const button of root.querySelectorAll("[data-news-view]")) button.setAttribute("aria-pressed", String(button.dataset.newsView === state.view));
    $("news-empty").hidden = true;
    if (!visible.length) {
      showEmpty(state.active.length ? "No matching updates" : "You're all caught up.", state.active.length ? "Try a different keyword or clear your filters." : "There are no active announcements right now. New updates will appear here when published.", state.active.length ? "Clear filters" : "");
    }
  }

  function updateActive() {
    state.today = todayInBologna();
    state.active = activeAnnouncements(state.all, state.today);
    $("news-total").textContent = state.active.length;
    $("news-new").textContent = state.active.filter((item) => isNewAnnouncement(item, state.today)).length;
    $("news-pinned").textContent = state.active.filter((item) => item.pinned).length;
    const dates = state.active.map((item) => item.date).filter(Boolean).sort();
    $("news-latest-date").textContent = dates.length ? "Latest published · " + formatDay(dates[dates.length - 1], { day: "numeric", month: "short", year: "numeric" }) : "No dated updates to show";
    if (state.category && !state.active.some((item) => item.category === state.category)) state.category = "";
    buildFilters(); draw(); syncHash();
  }

  function resetFilters() {
    state.query = ""; state.category = ""; state.newOnly = false; state.sort = "priority";
    $("news-search").value = ""; $("news-new-only").checked = false;
    $("news-sort").value = "priority";
    draw(); $("news-search").focus();
  }

  function showReader(item) {
    if (reader.open && state.openedId === item.id) return;
    state.openedId = item.id;
    const content = $("news-reader-content"); content.replaceChildren();
    const title = el("h2", "", displayTitle(item)); title.id = "news-reader-title";
    content.append(meta(item), title, byline(item));
    const body = el("div", "news-reader-body");
    if (isElectionResultsAnnouncement(item)) {
      // Reuse the approved full candidate lists and results, not a screenshot.
      const election = el("div", "announcement"); election.append(renderElectionResults(item, 3)); body.append(election);
    } else {
      for (const paragraph of item.message.split(/\r?\n\s*\r?\n/).filter((p) => p.trim())) body.append(el("p", "", paragraph));
    }
    content.append(body);
    const actions = el("div", "news-card-actions");
    if (item.link) {
      const link = el("a", "news-read", "Open source link"); link.href = item.link;
      link.target = "_blank"; link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", "Open source link for " + displayTitle(item) + " (opens in a new tab)");
      link.append(icon("external")); actions.append(link);
    }
    actions.append(copyButton(item)); content.append(actions);
    content.append(el("p", "news-reader-source-note", "Shared on an unofficial, student-run noticeboard. For authoritative information, refer to the original university or programme communication."));
    if (!reader.open) reader.showModal();
    document.body.classList.add("news-reader-open");
    reader.scrollTop = 0;
    $("news-reader-close").focus({ preventScroll: true });
  }

  function hashId() {
    try { return decodeURIComponent(window.location.hash.slice(1)); }
    catch { return ""; }
  }

  function closeReader() {
    const wasOpen = reader.open;
    const previousId = state.openedId;
    state.openedId = "";
    if (wasOpen) reader.close();
    document.body.classList.remove("news-reader-open");
    if (wasOpen) {
      const fallback = document.getElementById(previousId)?.querySelector("[data-news-open]") || $("news-search");
      (readerOpener?.isConnected ? readerOpener : fallback).focus({ preventScroll: true });
    }
  }

  function requestClose() {
    const previousId = state.openedId;
    closeReader();
    if (previousId && hashId() === previousId) {
      if (history.state?.newsroomReader) history.back();
      else history.replaceState(history.state, "", window.location.pathname + window.location.search);
    }
  }

  function syncHash() {
    const id = hashId();
    const item = state.active.find((a) => a.id === id);
    if (item) showReader(item);
    else {
      closeReader();
      if (id && state.all.some((a) => a.id === id)) toast("This announcement is not currently active.");
    }
  }

  async function load() {
    if (fetching) return;
    fetching = true;
    state.loading = true; state.failed = false;
    $("news-empty").hidden = true; $("news-loading").hidden = false;
    $("news-status").textContent = "Loading announcements…"; feed.setAttribute("aria-busy", "true");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(ANNOUNCEMENTS_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.all = readRows(await response.text());
      state.loading = false; updateActive();
    } catch (error) {
      state.failed = true; state.loading = false;
      feature.hidden = true; feed.replaceChildren(); feed.setAttribute("aria-busy", "false");
      $("news-status").textContent = "The noticeboard could not be loaded.";
      $("news-latest-date").textContent = "Updates temporarily unavailable";
      showEmpty("Unable to load updates", "Check your connection and try again. Previously cached announcements may still be available in the installed app.", "Try again");
      console.warn("Newsroom:", error.message);
    } finally { fetching = false; clearTimeout(timeout); $("news-loading").hidden = true; }
  }

  $("news-search").addEventListener("input", (event) => { state.query = event.target.value; draw(); });
  $("news-sort").addEventListener("change", (event) => { state.sort = event.target.value; draw(); });
  $("news-new-only").addEventListener("change", (event) => { state.newOnly = event.target.checked; draw(); });
  $("news-reset").addEventListener("click", resetFilters);
  $("news-empty-action").addEventListener("click", () => state.failed ? load() : resetFilters());
  for (const button of root.querySelectorAll("[data-news-view]")) button.addEventListener("click", () => { state.view = button.dataset.newsView; draw(); });
  root.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-news-open]");
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const item = state.active.find((a) => a.id === link.dataset.newsOpen);
    if (!item) return;
    event.preventDefault();
    readerOpener = link;
    if (hashId() !== item.id) history.pushState({ ...history.state, newsroomReader: true }, "", "#" + item.id);
    showReader(item);
  });
  $("news-reader-close").addEventListener("click", requestClose);
  reader.addEventListener("cancel", (event) => { event.preventDefault(); requestClose(); });
  reader.addEventListener("close", () => {
    // A queued close event from an earlier story must not clear a newly opened one.
    if (!reader.open) document.body.classList.remove("news-reader-open");
  });
  reader.addEventListener("click", (event) => {
    if (event.target !== reader) return;
    const bounds = reader.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) requestClose();
  });
  window.addEventListener("hashchange", syncHash);
  window.addEventListener("popstate", syncHash);
  const updateDay = () => { if (!state.loading && !state.failed && state.today !== todayInBologna()) updateActive(); };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) updateDay(); });
  setInterval(updateDay, 60000);
  load();
})();
