/* Track-card filters and a private, in-memory comparison worksheet.
   Only the static editorial guide is fetched. Notes and checklist choices are
   never saved automatically, put into links, or sent to a service. */
(function () {
  "use strict";
  const dataHelpers = typeof module !== "undefined" && module.exports ? require("./tracks-data.js") : null;
  const byId = (cohort, id) => typeof trackById === "function" ? trackById(cohort, id) : dataHelpers.trackById(cohort, id);
  const info = (cohort, id) => typeof courseInfo === "function" ? courseInfo(cohort, id) : dataHelpers.courseInfo(cohort, id);
  const route = (cohort, track) => typeof trackRoute === "function" ? trackRoute(cohort, track) : dataHelpers.trackRoute(cohort, track);
  const courses = (cohort, track) => (typeof trackCourses === "function" ? trackCourses(cohort, track) : dataHelpers.trackCourses(cohort, track))
    .filter((entry) => entry.semester === 2 || entry.semester === 3);
  const clean = (value) => typeof value === "string" ? value.trim() : "";
  const normalise = (value) => clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const safeLink = (value) => {
    if (typeof value !== "string" || value !== value.trim() || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return false;
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
    catch { return false; }
  };
  function provenanceText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(provenanceText).filter(Boolean).join("; ");
    if (isObject(value)) return Object.entries(value).map(([key, entry]) => {
      const text = provenanceText(entry);
      return text ? key.replace(/([a-z])([A-Z])/g, "$1 $2") + ": " + text : "";
    }).filter(Boolean).join("; ");
    return "";
  }

  function filterMatches(cohort, track, query = "", theme = "") {
    const rows = courses(cohort, track).map((entry) => ({ ...entry, course: info(cohort, entry.id) })).filter((entry) => entry.course);
    const student = track.student || {};
    const words = normalise(query).split(/\s+/).filter(Boolean);
    const haystack = normalise([
      track.name, track.abbr, ...(track.focusAreas || []), student.question, student.description,
      student.centralQuestion, student.overview, student.typicalProblem, ...(student.fit || []),
      ...(student.tags || []), ...rows.map((entry) => entry.course.name),
    ].filter(Boolean).join(" "));
    const textMatches = words.every((word) => haystack.includes(word));
    const themeMatches = !theme || rows.some((entry) => (entry.course.themes || []).includes(theme));
    return textMatches && themeMatches;
  }

  function buildComparisonNotes(cohort, guide, trackIds, checks = [], notes = "") {
    if (!Array.isArray(trackIds) || trackIds.length !== 2 || trackIds[0] === trackIds[1]) throw new Error("Choose two different tracks in Compare before downloading your notes.");
    const selected = trackIds.map((id) => byId(cohort, id));
    if (selected.some((track) => !track)) throw new Error("Choose two available tracks in Compare before downloading your notes.");
    if (typeof notes !== "string" || notes.length > 2400) throw new Error("Keep your personal notes to 2,400 characters or fewer before downloading.");
    const unknown = cohort.texts?.notStated || "Not stated in the source";
    const lines = ["EU-HEM track comparison notes", cohort.label || cohort.id, "",
      "Student-built planning aid. This file does not submit or change your official track choice.",
      "Elective options are published curriculum references; confirm current offerings and rules with the programme.", ""];
    const creditsSources = new Set();
    function courseText(id, note) {
      const course = info(cohort, id);
      if (!course) return "Course reference unavailable: " + id;
      const credits = typeof course.credits === "number" && Number.isFinite(course.credits) ? course.credits + " EC" : "credits: " + unknown;
      let value = course.name + (course.code ? " [" + course.code + "]" : "") + " (" + credits + ")";
      if (note) value += " — " + note;
      if (course.creditsSource) creditsSources.add(course.name + ": " + provenanceText(course.creditsSource));
      return value;
    }
    for (const track of selected) {
      lines.push(track.abbr + " — " + track.name, "Specialisation route: " + route(cohort, track));
      const foundation = cohort.universities[cohort.semester1?.university];
      if (foundation) lines.push("Semester 1 · common foundation: " + foundation.city + ". " + (cohort.semester1.summary || ""));
      for (const semester of track.semesters.filter((item) => item.number === 2 || item.number === 3)) {
        const university = cohort.universities[semester.university];
        lines.push("", "Semester " + semester.number + " · " + university.city + " · " + university.name, "Required courses:");
        for (const id of semester.required) lines.push("- " + courseText(id));
        for (const choice of semester.choices || []) {
          const label = choice.kind === "complementary" ? "Complementary courses" : "Electives";
          lines.push(label + " — " + (choice.rule || "how many to choose: " + unknown));
          choice.options.forEach((option, index) => {
            const bundle = option.length > 1 ? " (courses taken together)" : "";
            lines.push("  Option " + (index + 1) + bundle + ": " + option.map((id) => courseText(id, choice.notes?.[id])).join(" + "));
          });
        }
        if (semester.choicesNote) lines.push("Choice note: " + semester.choicesNote);
        if (university.programmePage?.url) lines.push("Official semester source: " + university.programmePage.label + " — " + university.programmePage.url);
      }
      lines.push("", "Semester 4 · thesis: " + track.thesis.map((id) => cohort.universities[id].city).join(" or "));
      if (cohort.semester4) lines.push(cohort.semester4);
      for (const page of track.programmePages || []) lines.push("Official track source: " + page.label + " — " + page.url);
      lines.push("");
    }
    lines.push("CURRICULUM AND CREDIT PROVENANCE", cohort.sources?.official || "Official curriculum source not supplied.", "Curriculum last reviewed: " + (cohort.lastReviewed || unknown));
    if (creditsSources.size) lines.push(...creditsSources);
    else lines.push("No additional course-specific credit provenance is stated in this selection.");
    const sourceLinks = [...(cohort.sources?.pages || []), ...(guide?.sources || []), ...(guide?.naming?.links || [])];
    const seen = new Set();
    for (const page of sourceLinks) {
      if (!page || !safeLink(page.url) || seen.has(page.url)) continue;
      seen.add(page.url);
      lines.push(page.label + " — " + page.url);
    }
    if (guide?.reviewed) lines.push("Student guide reviewed: " + guide.reviewed);
    if (guide?.coverage) lines.push("Guide review scope: " + guide.coverage);
    if (guide?.naming?.text && trackIds.includes(guide.naming.track)) lines.push("Track naming context: " + guide.naming.text);
    lines.push("", "CHECKS I MARKED", "These are personal reflection checks, not programme requirements.");
    const checked = new Set(checks);
    const marked = (guide?.checklist || fallbackGuide().checklist).filter((item) => checked.has(item.id));
    if (marked.length) marked.forEach((item) => lines.push("[x] " + item.title + " — " + item.prompt));
    else lines.push("No checks marked.");
    lines.push("", "MY PERSONAL NOTES", notes || "No personal notes entered.", "",
      "This download may contain your personal notes. Share it only if you choose; notes and checklist choices are not included in the page's comparison links.");
    return lines.join("\n");
  }

  function fallbackGuide() {
    return { checklist: [
      { id: "focus", title: "Compare the questions", prompt: "Which healthcare questions would you like to work on?" },
      { id: "courses", title: "Read the required courses", prompt: "Compare the actual Semester 2 and 3 course lists." },
      { id: "electives", title: "Check the choice rules", prompt: "Keep required courses, options and course bundles separate." },
      { id: "mobility", title: "Consider the route", prompt: "Think about the practical effect of moving between the two cities." },
      { id: "thesis", title: "Discuss research interests", prompt: "Ask about thesis topics and supervision at the track's universities." },
      { id: "advice", title: "Confirm the open questions", prompt: "Discuss current requirements with the programme and perspectives with students." },
    ], tracks: {} };
  }

  function validateGuide(guide) {
    if (!isObject(guide) || !clean(guide.reviewed) || !clean(guide.coverage) || !Array.isArray(guide.checklist) ||
        !guide.checklist.length || !isObject(guide.tracks) || !Object.keys(guide.tracks).length || !Array.isArray(guide.sources) ||
        !Array.isArray(guide.faqs) || guide.faqs.some((item) => !isObject(item) || !clean(item.q) || !clean(item.a))) throw new Error("The preparation guide has an unsupported format.");
    const ids = new Set();
    for (const item of guide.checklist) {
      if (!isObject(item) || !/^[a-z][a-z0-9-]{0,63}$/.test(item.id || "") || ids.has(item.id) || !clean(item.title) || !clean(item.prompt)) throw new Error("The preparation checklist has an unsupported format.");
      ids.add(item.id);
    }
    for (const entry of Object.values(guide.tracks)) {
      if (!isObject(entry) || ![entry.prepare, entry.ask].every((rows) => Array.isArray(rows) && rows.length && rows.every((row) => clean(row)))) throw new Error("The track preparation prompts have an unsupported format.");
    }
    if (guide.sources.some((page) => !isObject(page) || !clean(page.label) || !safeLink(page.url))) throw new Error("The preparation guide has an unsupported source link.");
    if (!isObject(guide.naming) || !clean(guide.naming.track) || !clean(guide.naming.text) || !Array.isArray(guide.naming.links) ||
        guide.naming.links.some((page) => !isObject(page) || !clean(page.label) || !safeLink(page.url))) throw new Error("The preparation guide has unsupported naming context.");
    return guide;
  }

  async function loadTrackGuide() {
    const response = await fetch("content/tracks-guide.json");
    if (!response.ok) throw new Error("The preparation guide is unavailable.");
    return validateGuide(await response.json());
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { buildComparisonNotes, filterMatches, validateGuide };
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const worksheet = { notes: "", checked: new Set(), guide: null, cohort: null };
  const filters = { q: "", theme: "", cohort: null, initialised: false };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function comparisonIds() {
    return [document.getElementById("compare-pick-1")?.value || "", document.getElementById("compare-pick-2")?.value || ""];
  }
  function syncGuidePair() {
    if (!worksheet.cohort) return;
    const ids = comparisonIds();
    const tracks = ids.map((id) => byId(worksheet.cohort, id));
    const usable = tracks.every(Boolean) && ids[0] !== ids[1];
    const label = document.getElementById("tx-guide-pair");
    if (label) label.textContent = usable ? "Your current comparison: " + tracks.map((track) => track.abbr).join(" and ") + "." : "Choose two different tracks in Compare before downloading your notes.";
    const button = document.getElementById("tx-download-notes");
    if (button) button.disabled = !usable;
  }

  function renderTrackGuide(guide, cohort) {
    const host = document.getElementById("decision-guide");
    if (!host) return;
    worksheet.guide = guide || fallbackGuide();
    worksheet.cohort = cohort;
    host.replaceChildren();
    const head = element("div", "section-head");
    const heading = element("h2", "section-title", "Make your comparison useful");
    heading.id = "decision-guide-title";
    head.append(heading, element("p", "tx-guide-intro", "Use these student-written prompts to identify what matters to you. They are reflection aids, not admission requirements or a ranking of tracks."));
    host.append(head);
    const pair = element("p", "tx-guide-intro");
    pair.id = "tx-guide-pair";
    host.append(pair);
    const checklist = element("fieldset", "tx-decision-checklist");
    checklist.append(element("legend", "", "Checks before deciding"));
    for (const row of worksheet.guide.checklist) {
      const label = element("label", "tx-decision-item");
      const input = element("input");
      input.type = "checkbox";
      input.name = "decision-check";
      input.value = row.id;
      input.checked = worksheet.checked.has(row.id);
      input.addEventListener("change", () => { if (input.checked) worksheet.checked.add(row.id); else worksheet.checked.delete(row.id); });
      const text = element("span");
      text.append(element("strong", "", row.title), element("span", "", row.prompt));
      label.append(input, text);
      checklist.append(label);
    }
    host.append(checklist);
    const notesLabel = element("label", "tx-decision-notes");
    notesLabel.append(element("strong", "", "Your comparison notes"));
    const notes = element("textarea");
    notes.id = "tx-decision-notes";
    notes.maxLength = 2400;
    notes.rows = 5;
    notes.placeholder = "What matters to you? Which differences or questions do you want to discuss?";
    notes.value = worksheet.notes;
    notes.setAttribute("aria-describedby", "tx-notes-privacy");
    notes.addEventListener("input", () => { worksheet.notes = notes.value; });
    notesLabel.append(notes);
    host.append(notesLabel);
    const privacy = element("p", "course-note", "Notes and checklist choices stay in this page's memory only and disappear when you reload or leave. Downloading creates a text file with your notes and the currently compared tracks; share that file only if you choose. Comparison links do not include your notes.");
    privacy.id = "tx-notes-privacy";
    host.append(privacy);
    const actions = element("div", "tx-guide-actions");
    const download = element("button", "button", "Download comparison notes");
    download.type = "button";
    download.id = "tx-download-notes";
    const status = element("p", "tx-guide-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.tabIndex = -1;
    download.addEventListener("click", () => {
      let url;
      try {
        const content = buildComparisonNotes(cohort, worksheet.guide, comparisonIds(), worksheet.checked, worksheet.notes);
        url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
        const link = element("a");
        link.href = url;
        link.download = "euhem-track-comparison-" + String(cohort.id).replace(/[^a-z0-9-]/gi, "-") + ".txt";
        link.hidden = true;
        document.body.append(link);
        try { link.click(); } finally { link.remove(); }
        status.textContent = "Download prepared with your selected checks and notes. Nothing was sent to the Hub.";
      } catch (error) {
        status.textContent = error instanceof Error && /^(Choose two|Keep your personal)/.test(error.message) ? error.message : "This browser could not prepare the download. Your notes are still here.";
      } finally {
        if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
    actions.append(download);
    if (!guide) {
      status.textContent = "The extra preparation guide could not be loaded. The comparison worksheet still works. Retry to load the track-specific prompts.";
      const retry = element("button", "button button-quiet", "Retry preparation guide");
      retry.id = "tx-guide-retry";
      retry.type = "button";
      retry.addEventListener("click", async () => {
        retry.disabled = true;
        status.textContent = "Loading the preparation guide…";
        try {
          const loadedGuide = await loadTrackGuide();
          renderTrackGuide(loadedGuide, cohort);
          document.dispatchEvent(new CustomEvent("tracks:guide-loaded", { detail: loadedGuide }));
          const loaded = document.querySelector("#decision-guide .tx-guide-status");
          loaded.textContent = "The preparation guide is loaded. Your checks and notes are still here.";
          loaded.focus({ preventScroll: true });
        }
        catch { retry.disabled = false; status.textContent = "The preparation guide is still unavailable. Your checks and notes remain here; the download still works."; }
      });
      actions.append(retry);
    }
    host.append(actions, status);

    const preparation = element("div", "tx-preparation-grid");
    for (const track of cohort.tracks) {
      const prompts = worksheet.guide.tracks[track.id];
      if (!prompts) continue;
      const card = element("details", "tx-preparation-card");
      card.dataset.track = track.id;
      const summary = element("summary");
      if (typeof trackBadge === "function") summary.append(trackBadge(track));
      summary.append(element("strong", "", "Prepare for " + track.name));
      card.append(summary, element("p", "course-note", route(cohort, track)));
      for (const [key, title] of [["prepare", "Skills to explore"], ["ask", "Questions to ask"]]) {
        card.append(element("h3", "", title));
        const list = element("ul");
        prompts[key].forEach((prompt) => list.append(element("li", "", prompt)));
        card.append(list);
      }
      const links = element("p", "tx-guide-links");
      for (const source of track.programmePages || []) {
        if (!safeLink(source.url)) continue;
        const link = typeof externalLink === "function" ? externalLink(source.label, source.url) : element("a", "", source.label);
        link.href = source.url;
        link.rel = "noopener noreferrer";
        link.target = "_blank";
        links.append(link);
      }
      card.append(links);
      preparation.append(card);
    }
    if (preparation.children.length) host.append(element("h3", "", "Prepare questions for each track"), preparation);
    const sources = element("p", "course-note", "Check the published curriculum and current programme information before deciding. ");
    const sourceLink = element("a", "", "Sources and guide context →");
    sourceLink.href = "#sources";
    sources.append(sourceLink);
    host.append(sources);
    host.hidden = false;
    syncGuidePair();
  }

  function readFilterUrl() {
    const query = new URLSearchParams(window.location.search);
    filters.q = (query.get("q") || "").slice(0, 160);
    const selected = query.get("theme") || "";
    filters.theme = filters.cohort?.themes.some((theme) => theme.id === selected) ? selected : "";
  }
  function writeFilterUrl() {
    const url = new URL(window.location.href);
    if (filters.q.trim()) url.searchParams.set("q", filters.q.trim()); else url.searchParams.delete("q");
    if (filters.theme) url.searchParams.set("theme", filters.theme); else url.searchParams.delete("theme");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
  function applyFilters() {
    const cohort = filters.cohort;
    if (!cohort) return;
    let visible = 0;
    for (const card of document.querySelectorAll("#track-cards .track-card[data-track]")) {
      const track = byId(cohort, card.dataset.track);
      if (!track) continue;
      const matches = filterMatches(cohort, track, filters.q, filters.theme);
      card.hidden = !matches;
      if (matches) visible++;
      card.querySelector(".tx-card-match")?.remove();
      if (!matches || (!filters.q.trim() && !filters.theme)) continue;
      const words = normalise(filters.q).split(/\s+/).filter(Boolean);
      const rows = courses(cohort, track).map((entry) => ({ ...entry, course: info(cohort, entry.id) })).filter((entry) => entry.course);
      const candidates = rows.filter((entry) => (!filters.theme || (entry.course.themes || []).includes(filters.theme)) &&
        (!words.length || words.some((word) => normalise(entry.course.name).includes(word))));
      const named = candidates.length ? candidates : filters.theme ? rows.filter((entry) => (entry.course.themes || []).includes(filters.theme)) : [];
      const seen = new Set();
      const names = named.filter((entry) => !seen.has(entry.id) && seen.add(entry.id)).slice(0, 3)
        .map((entry) => entry.course.name + (entry.status === "required" ? " (required)" : " (available option)"));
      if (names.length) {
        const explanation = element("p", "tx-card-match", "Course coverage: " + names.join("; ") + ".");
        const copy = card.querySelector(".tx-card-copy") || card;
        copy.insertBefore(explanation, copy.querySelector(":scope > .tx-card-actions"));
      }
    }
    const status = document.querySelector("#track-cards .tx-filter-status");
    if (status) status.textContent = visible
      ? visible + " of " + cohort.tracks.length + " tracks shown. Topic filters use tagged required courses and available options in Semesters 2 and 3; they are not a ranking or a complete inventory of skills."
      : "No tracks match these filters. Clear filters to show the full collection. Topic tags cover the listed Semester 2 and 3 courses; they may not describe every skill taught.";
  }

  function initTrackFilters(cohort) {
    const host = document.getElementById("track-cards");
    const grid = host?.querySelector(".track-card-grid");
    if (!host || !grid) return;
    filters.cohort = cohort;
    if (!filters.initialised) { readFilterUrl(); filters.initialised = true; }
    if (!cohort.themes.some((theme) => theme.id === filters.theme)) filters.theme = "";
    host.querySelector(".tx-filter-bar")?.remove();
    host.querySelector(".tx-filter-status")?.remove();
    const bar = element("div", "tx-filter-bar");
    const searchLabel = element("label");
    searchLabel.append(element("span", "", "Search track focus or course names"));
    const search = element("input");
    search.type = "search";
    search.id = "tx-track-search";
    search.maxLength = 160;
    search.value = filters.q;
    search.placeholder = "e.g. modelling, epidemiology, leadership";
    searchLabel.append(search);
    const themeLabel = element("label");
    themeLabel.append(element("span", "", "Course theme (student tags)"));
    const theme = element("select");
    theme.id = "tx-track-theme";
    const all = element("option", "", "All course themes");
    all.value = "";
    theme.append(all);
    for (const row of cohort.themes) { const option = element("option", "", row.label); option.value = row.id; theme.append(option); }
    theme.value = filters.theme;
    themeLabel.append(theme);
    const reset = element("button", "button button-quiet", "Clear filters");
    reset.type = "button";
    reset.id = "tx-track-filter-reset";
    bar.append(searchLabel, themeLabel, reset);
    const status = element("p", "tx-filter-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    search.addEventListener("input", () => { filters.q = search.value.slice(0, 160); applyFilters(); writeFilterUrl(); });
    theme.addEventListener("change", () => { filters.theme = theme.value; applyFilters(); writeFilterUrl(); });
    reset.addEventListener("click", () => { filters.q = ""; filters.theme = ""; search.value = ""; theme.value = ""; applyFilters(); writeFilterUrl(); search.focus(); });
    host.insertBefore(bar, grid);
    host.insertBefore(status, grid);
    applyFilters();
  }

  window.addEventListener("popstate", () => {
    if (!filters.cohort) return;
    readFilterUrl();
    const search = document.getElementById("tx-track-search");
    const theme = document.getElementById("tx-track-theme");
    if (search) search.value = filters.q;
    if (theme) theme.value = filters.theme;
    applyFilters();
    syncGuidePair();
  });
  document.addEventListener("tracks:comparison-change", syncGuidePair);
  window.addEventListener("tracks:comparison-change", syncGuidePair);
  document.addEventListener("change", (event) => { if (/^compare-pick-[12]$/.test(event.target.id || "")) syncGuidePair(); });
  window.loadTrackGuide = loadTrackGuide;
  window.renderTrackGuide = renderTrackGuide;
  window.initTrackFilters = initTrackFilters;
  window.TrackWorkspace = Object.freeze({ buildComparisonNotes, filterMatches, validateGuide });
})();
