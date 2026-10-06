// Universities directory and individual guides. Content comes from two local JSON files:
// universities.json owns institutional information; tracks.json alone owns EU-HEM routes.
(function universityPages() {
  "use strict";

  const app = document.getElementById("university-app");
  if (!app) return;
  const D = window.UniversityData;
  const state = { file: null, tracks: null, cohort: null, cohorts: [], requestedCohort: "", trackId: "", compare: [],
    comparisonInvalid: false, trackMessage: "", tracksError: false, checklistMemory: new Map(), observer: null, loading: false, finder: {}, compareRefresh: null };
  const view = app.dataset.view;
  const items = (value) => D.asArray(value);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function button(label, action, quiet = false) {
    const node = el("button", quiet ? "button button-quiet" : "button", label);
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  }

  function localLink(label, url, className = "") {
    const node = el("a", className, label);
    node.href = url;
    return node;
  }

  function externalLink(label, url, className = "uni-text-link") {
    const safe = D.externalUrl(url);
    if (!safe) return el("span", "uni-muted", label);
    const link = localLink(label, safe, className);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function context() {
    // An explicit "all" keeps shared links independent of a recipient's saved My track.
    return { cohort: state.cohort ? state.cohort.id : state.requestedCohort, track: state.trackId || "all" };
  }

  function universityUrl(university, hash) {
    return D.pageUrl("university.html", { id: university.id, ...context(), hash });
  }

  function directoryUrl(hash) { return D.pageUrl("universities.html", { ...context(), hash }); }

  function trackUrl(trackId) { return D.pageUrl("tracks.html", { cohort: context().cohort, hash: trackId ? `track-${trackId}` : "journey" }); }

  function cityGuideUrl(university) {
    const known = state.cohort && state.cohort.universities && state.cohort.universities[university.id];
    // Only local, expected city-guide routes can come from the shared curriculum file.
    if (known && /^city-guide\.html\?city=[a-z-]+$/.test(known.guide)) return known.guide;
    return "city-guide.html?city=" + encodeURIComponent(university.city.toLowerCase());
  }

  function updateUrl(options = {}) {
    const url = new URL(window.location.href);
    const current = context();
    for (const key of ["cohort", "track"]) {
      if (current[key]) url.searchParams.set(key, current[key]);
      else url.searchParams.delete(key);
    }
    if (view === "directory" && state.compare.length === 2 && options.compare) {
      url.searchParams.set("compare", state.compare.join(","));
      url.hash = "compare";
    }
    try { window.history.replaceState(null, "", url); } catch { /* The guide still works in restricted previews. */ }
    return url.href;
  }

  function dateLabel(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "Not recorded";
    const date = new Date(value + "T12:00:00Z");
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }

  function citations(university, ids) {
    const wrapper = el("span", "uni-citations");
    for (const id of [...new Set(items(ids))]) {
      const number = items(university.sources).findIndex((source) => source.id === id);
      if (number < 0) continue;
      const source = university.sources[number];
      const link = localLink(`[${number + 1}]`, "#" + D.sourceAnchor(id));
      link.setAttribute("aria-label", `${university.shortName || university.name}, source ${number + 1}: ${source.title}`);
      wrapper.appendChild(link);
    }
    return wrapper;
  }

  function paragraph(parent, text, university, sourceIds, className) {
    if (!text) return null;
    const node = el("p", className, text);
    if (university) node.appendChild(citations(university, sourceIds));
    parent.appendChild(node);
    return node;
  }

  function summarySources(university) { return items(university.about).flatMap((item) => items(item.sourceIds)); }

  function section(parent, id, title, intro) {
    const node = el("section", "uni-section");
    node.id = id;
    node.tabIndex = -1;
    node.setAttribute("aria-labelledby", id + "-heading");
    const heading = el("h2", null, title);
    heading.id = id + "-heading";
    const head = el("div", "uni-section-head");
    head.appendChild(el("span", "uni-section-marker", ""));
    head.appendChild(heading);
    node.appendChild(head);
    if (intro) paragraph(node, intro, null, null, "uni-section-intro");
    parent.appendChild(node);
    return node;
  }

  function breadcrumb(university) {
    const nav = el("nav", "uni-breadcrumb");
    nav.setAttribute("aria-label", "Breadcrumb");
    nav.append(localLink("Home", "index.html"), el("span", null, "/"));
    if (university) nav.append(localLink("Universities", directoryUrl()), el("span", null, "/"), el("span", null, university.shortName || university.name));
    else nav.appendChild(el("span", null, "Universities"));
    [...nav.children].filter((node) => node.textContent === "/").forEach((node) => node.setAttribute("aria-hidden", "true"));
    nav.lastElementChild.setAttribute("aria-current", "page");
    app.appendChild(nav);
  }

  function photograph(university, profile = false, eager = false) {
    const image = university.image || {};
    const frame = el("div", "uni-card-image");
    const fallback = el("div", "uni-image-fallback");
    fallback.append(el("strong", null, university.shortName || university.name), el("span", null, "Campus photograph unavailable"));
    const src = D.imageUrl(image.src);
    if (src) {
      const photo = el("img");
      const variants = items(image.variants).filter((v) => D.imageUrl(v.src) && Number.isInteger(v.width) && v.width > 0);
      photo.src = variants.length ? variants[variants.length - 1].src : src;
      if (variants.length) { photo.srcset = variants.map(v => `${v.src} ${v.width}w`).join(", "); photo.sizes = profile ? "(max-width: 700px) 100vw, 48vw" : "(max-width: 700px) 100vw, 45vw"; }
      photo.alt = image.alt || image.caption || `${university.name} campus`;
      photo.width = Number.isInteger(image.width) && image.width > 0 ? image.width : 1200;
      photo.height = Number.isInteger(image.height) && image.height > 0 ? image.height : 800;
      if (typeof image.objectPosition === "string" && /^\d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/.test(image.objectPosition)) photo.style.objectPosition = image.objectPosition;
      photo.loading = eager ? "eager" : "lazy";
      photo.decoding = "async";
      fallback.hidden = true;
      photo.addEventListener("error", () => { photo.hidden = true; fallback.hidden = false; });
      frame.appendChild(photo);
    }
    frame.appendChild(fallback);
    const gallery = items(university.gallery).filter((media) => D.imageUrl(media && media.src));
    if (!profile) {
      frame.appendChild(el("span", "uni-image-location", `${university.city} · ${university.country}`));
      if (gallery.length) frame.appendChild(el("span", "uni-image-count", `${gallery.length + 1} photos`));
      return frame;
    }
    const figure = el("figure", "uni-profile-photo");
    figure.appendChild(frame);
    const caption = el("figcaption", null, image.caption || `${university.name}, ${university.city}.`);
    caption.append(document.createTextNode(" "), localLink("Photo credits", "#photo-credits"));
    figure.appendChild(caption);
    if (gallery.length) {
      const strip = el("div", "uni-profile-thumbs");
      strip.setAttribute("aria-label", `${university.name} photo gallery`);
      for (const [index, media] of gallery.slice(0, 2).entries()) {
        let thumb;
        thumb = button(media.label || `View ${university.name} photo ${index + 2}`, () => openPhotoDialog(university, media, thumb), true);
        thumb.classList.add("uni-gallery-thumb");
        thumb.setAttribute("aria-label", media.label || `View another photograph of ${university.name}`);
        const photo = el("img");
        photo.src = D.imageUrl(media.src);
        photo.alt = media.alt || "";
        photo.loading = "lazy";
        photo.decoding = "async";
        const label = el("span", "uni-gallery-label", media.label || "Another view");
        thumb.append(photo, label);
        strip.appendChild(thumb);
      }
      figure.appendChild(strip);
    }
    return figure;
  }

  function rolesList(university, compact = true, includeThesis = false) {
    if (!state.cohort) return el("p", "uni-role-empty", "Programme roles unavailable for this cohort.");
    const roles = D.universityRoles(state.cohort, university.id, state.trackId).filter((role) => includeThesis || role.kind !== "thesis");
    if (!roles.length) return el("p", "uni-role-empty", state.trackId ? "No teaching semester listed here for this track." : "No teaching semester listed in this cohort's study plan.");
    const list = el("ul", "uni-role-list");
    list.setAttribute("aria-label", "EU-HEM teaching role");
    for (const role of roles) list.appendChild(el("li", null, D.roleLabel(role, compact)));
    return list;
  }

  function renderContext() {
    if (!state.tracks || state.tracksError) {
      const notice = el("div", "uni-notice");
      paragraph(notice, "University information is available. The cohort study plan could not be loaded, so teaching and thesis routes are temporarily unavailable.");
      notice.appendChild(button("Retry programme information", () => loadPage(), true));
      app.appendChild(notice);
      return;
    }
    if (!state.cohort) {
      const warning = el("div", "uni-notice");
      warning.setAttribute("role", "status");
      paragraph(warning, `Programme routes for cohort “${state.requestedCohort.slice(0, 80)}” are not available. Choose an available cohort below; the university guides remain accessible.`);
      app.appendChild(warning);
    }
    if (state.trackMessage) {
      const warning = el("p", "uni-notice", state.trackMessage);
      warning.setAttribute("role", "status");
      app.appendChild(warning);
    }
    const bar = el("div", "uni-context");
    if (state.cohorts.length > 1 || !state.cohort) {
      const field = el("div", "uni-control");
      const label = el("label", null, "Cohort");
      label.htmlFor = "uni-cohort-view";
      const select = el("select");
      select.id = label.htmlFor;
      if (!state.cohort) { const option = el("option", null, "Choose an available cohort"); option.value = ""; option.disabled = true; option.selected = true; select.appendChild(option); }
      for (const cohort of state.cohorts) { const option = el("option", null, cohort.label || cohort.id); option.value = cohort.id; select.appendChild(option); }
      if (state.cohort) select.value = state.cohort.id;
      select.addEventListener("change", () => {
        state.requestedCohort = select.value;
        state.cohort = state.cohorts.find((item) => item.id === select.value);
        if (!state.cohort.tracks.some((track) => track.id === state.trackId)) state.trackId = "";
        state.trackMessage = "";
        updateUrl();
        renderPage({ focus: "uni-cohort-view" });
      });
      field.append(label, select);
      bar.appendChild(field);
    } else {
      const field = el("div", "uni-control");
      field.append(el("p", "uni-context-label", "Programme information for"), el("p", "uni-context-value", state.cohort.label || `Cohort ${state.cohort.id}`));
      bar.appendChild(field);
    }
    if (state.cohort) {
      const field = el("div", "uni-control");
      const label = el("label", null, "Track view");
      label.htmlFor = "uni-track-view";
      const select = el("select");
      select.id = label.htmlFor;
      const all = el("option", null, "All tracks"); all.value = ""; select.appendChild(all);
      for (const track of state.cohort.tracks) { const option = el("option", null, `${track.abbr || track.id} · ${track.name}`); option.value = track.id; select.appendChild(option); }
      select.value = state.trackId;
      select.addEventListener("change", () => { state.trackId = select.value; state.trackMessage = ""; updateUrl(); renderPage({ focus: "uni-track-view" }); });
      field.append(label, select);
      bar.appendChild(field);
    }
    const note = el("p", "uni-context-note", "Teaching semesters and thesis options follow the ");
    note.append(localLink("cohort study plan", trackUrl()), document.createTextNode(". University guides cover each institution more broadly."));
    bar.appendChild(note);
    app.appendChild(bar);
  }

  // Inline, decorative icon paths. No icon font, third-party request or untrusted SVG.
  function productIcon(name) {
    const paths = {
      arrow: "M7 17 17 7M7 7h10v10", book: "M3 4h7c1 0 2 1 2 2v15c0-2-2-3-4-3H3V4Zm18 0h-7c-1 0-2 1-2 2v15c0-2 2-3 4-3h5V4Z",
      pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 7v6M9 10h6",
      compare: "M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4",
      search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
      check: "m5 12 4 4L19 6", digital: "M3 3h18v13H3zM8 21h8M12 16v5", help: "M12 17v.1M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
      academic: "m2 8 10-5 10 5-10 5L2 8Zm4 2v7c4 3 8 3 12 0v-7M22 8v8", library: "M4 3h5v18H4zM10 3h4v18h-4zM15 4l4-1 4 17-4 1Z",
      support: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-4",
      careers: "M9 7V3h6v4M3 7h18v14H3zM3 12c6 4 12 4 18 0M11 12h2v4h-2z", campus: "M3 21V7l9-4 9 4v14M7 11h2m6 0h2M7 15h2m6 0h2M10 21v-3h4v3",
      shield: "m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5l8-3Zm-4 10 3 3 5-6", print: "M6 8V2h12v6M6 18H3V8h18v10h-3M6 14h12v8H6z", close: "m5 5 14 14M5 19 19 5"
    };
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "uni-icon");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.6"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
    const path = document.createElementNS(ns, "path"); path.setAttribute("d", paths[name] || paths.book); svg.appendChild(path); return svg;
  }

  function monogram(university) { return el("span", "uni-monogram", university.ui && university.ui.monogram || university.shortName || university.id.toUpperCase()); }

  function renderPartnerSwitch(parent, current) {
    const nav = el("nav", "uni-partner-switch"); nav.setAttribute("aria-label", "Switch university");
    for (const university of state.file.universities) {
      const a = localLink(university.city, universityUrl(university)); a.prepend(monogram(university));
      if (university.id === current.id) a.setAttribute("aria-current", "page"); nav.appendChild(a);
    }
    parent.appendChild(nav);
  }

  function renderJourney(parent, university = null) {
    const container = section(parent, university ? "your-route" : "journey", "Your route through EU-HEM", "Choose a track to see the teaching sequence and the listed thesis destinations for your cohort.");
    container.classList.add("uni-journey");
    const journey = D.trackJourney(state.cohort, state.trackId);
    if (!journey.length) {
      const picks = el("div", "uni-track-picks");
      for (const track of items(state.cohort && state.cohort.tracks)) {
        const pick = button(`${track.abbr || track.id} · ${track.name}`, () => {
          state.trackId = track.id; state.trackMessage = ""; updateUrl(); renderPage({ focus: "uni-track-view" });
        }, true); picks.appendChild(pick);
      }
      if (picks.children.length) container.appendChild(picks);
      else paragraph(container, "Select an available cohort above to explore its programme routes.");
      return;
    }
    const track = state.cohort.tracks.find((item) => item.id === state.trackId);
    paragraph(container, `${track.name} · ${state.cohort.label || state.cohort.id}`, null, null, "uni-route-caption");
    const list = el("ol", "uni-journey-steps");
    for (const step of journey) {
      const li = el("li", "uni-journey-step"); li.dataset.semester = step.semester;
      if (university && step.universities.includes(university.id)) li.classList.add("is-here");
      li.appendChild(el("span", "uni-step-number", String(step.semester).padStart(2, "0")));
      const body = el("div"); body.appendChild(el("p", "uni-step-label", step.kind === "thesis" ? "Master’s thesis" : `Semester ${step.semester}`));
      for (const [index, id] of step.universities.entries()) {
        const item = state.file.universities.find((candidate) => candidate.id === id);
        if (index) body.appendChild(el("span", "uni-route-or", "or"));
        if (item) body.appendChild(localLink(item.city, universityUrl(item, "eu-hem"), "uni-step-city"));
        else body.appendChild(el("span", "uni-step-city", state.cohort.universities && state.cohort.universities[id] && state.cohort.universities[id].name || id));
      }
      if (step.kind === "common") body.appendChild(el("span", "uni-step-note", "Common foundation"));
      if (step.kind === "thesis") body.appendChild(el("span", "uni-step-note", "Listed options, subject to arrangements"));
      li.appendChild(body); list.appendChild(li);
    }
    container.append(list, localLink("Open the full track guide →", trackUrl(state.trackId), "uni-text-link"));
  }

  function renderQuickDock(parent, university) {
    const dock = el("nav", "uni-quick-dock"); dock.setAttribute("aria-label", "University quick access");
    const library = items(university.quickLinks).find((r) => /librar/i.test(r.id + " " + r.label));
    const learning = items(university.quickLinks).find((r) => /canvas|virtuale|sakai/i.test(r.id));
    const portal = items(university.quickLinks).find((r) => /studenti|studentweb|myeur|mymci/i.test(r.id));
    for (const [title, record, icon] of [["Student portal", portal, "academic"], ["Learning platform", learning, "digital"], ["Library", library, "library"]]) {
      if (!record) continue;
      const link = externalLink(title, record.url, "uni-dock-link"); link.prepend(productIcon(icon));
      const text = el("span"); text.append(el("strong", null, title), el("small", null, record.label));
      link.replaceChildren(productIcon(icon), text, productIcon("arrow")); dock.appendChild(link);
    }
    const help = localLink("Who to contact", "#contacts", "uni-dock-link"); help.prepend(productIcon("help")); dock.appendChild(help);
    parent.appendChild(dock);
  }

  function renderResourceFinder(parent, university = null) {
    const container = university ? parent : section(parent, "service-finder", "Find the service you need", "One place to find official platforms, library resources and student support. Search by task, then choose your university.");
    container.classList.add("uni-resource-section");
    const prefix = university ? "profile" : "directory";
    const records = D.collectResources(university ? [university] : state.file.universities);
    const stored = state.finder[prefix] || { query: "", university: "", category: "", expanded: false };
    state.finder[prefix] = stored;
    const form = el("div", "uni-finder-controls");
    const field = el("div", "uni-control uni-search-field");
    const label = el("label", null, "Search services"); label.htmlFor = `${prefix}-service-search`;
    const input = el("input"); input.type = "search"; input.id = label.htmlFor; input.placeholder = "Try library, Canvas, Wi-Fi, support…"; input.maxLength = 120; input.value = stored.query;
    const wrap = el("div", "uni-input-icon"); wrap.append(productIcon("search"), input); field.append(label, wrap); form.appendChild(field);
    function dropdown(title, id, options, selected, change) {
      const field = el("div", "uni-control"); const lab = el("label", null, title); lab.htmlFor = id;
      const select = el("select"); select.id = id;
      for (const [value, text] of options) { const option = el("option", null, text); option.value = value; select.appendChild(option); }
      select.value = selected; select.addEventListener("change", () => { change(select.value); stored.expanded = false; draw(); }); field.append(lab, select); form.appendChild(field);
    }
    if (!university) dropdown("University", "resource-university", [["", "All universities"], ...state.file.universities.map((u) => [u.id, u.name])], stored.university, (value) => stored.university = value);
    dropdown("Category", `${prefix}-resource-category`, [["", "All categories"], ...Object.entries(D.RESOURCE_CATEGORIES)], stored.category, (value) => stored.category = value);
    container.appendChild(form);
    const statusRow = el("div", "uni-result-toolbar"); const count = el("p", "uni-result-count"); count.setAttribute("role", "status"); count.setAttribute("aria-live", "polite");
    const reset = button("Clear filters", () => { Object.assign(stored, { query: "", university: "", category: "", expanded: false }); input.value = ""; form.querySelectorAll("select").forEach((s) => s.value = ""); draw(); input.focus(); }, true);
    statusRow.append(count, reset); container.appendChild(statusRow);
    const grid = el("div", "uni-resource-grid"); container.appendChild(grid);
    const more = button("Show more services", () => { stored.expanded = !stored.expanded; draw(); }); more.classList.add("uni-load-more"); container.appendChild(more);
    input.addEventListener("input", () => { stored.query = input.value; stored.expanded = false; draw(); });
    function draw() {
      grid.replaceChildren(); const matches = D.balanceResources(D.filterResources(records, stored)); const limit = 6;
      count.textContent = `${matches.length} ${matches.length === 1 ? "service" : "services"}${stored.expanded || matches.length <= limit ? "" : ` · Showing ${limit}`}`;
      reset.hidden = !stored.query && !stored.university && !stored.category;
      for (const record of matches.slice(0, stored.expanded ? matches.length : limit)) {
        const owner = state.file.universities.find((u) => u.id === record.universityId);
        const card = el("article", "uni-resource-card"); card.dataset.category = record.category;
        const top = el("div", "uni-resource-meta"); top.append(productIcon(record.category), el("span", null, D.RESOURCE_CATEGORIES[record.category]));
        if (!university) top.appendChild(el("strong", null, owner.ui && owner.ui.monogram || owner.shortName));
        card.append(top, el("h3", null, record.title));
        paragraph(card, record.text, owner, record.sourceIds);
        const access = el("details", "uni-access-details"); access.append(el("summary", null, "Access information"), el("p", null, record.access)); card.appendChild(access);
        const link = externalLink("Open official resource", record.url); link.appendChild(productIcon("arrow")); card.appendChild(link); grid.appendChild(card);
      }
      if (!matches.length) {
        const empty = el("div", "uni-empty-search"); empty.append(productIcon("search"), el("h3", null, "No services match your search"), el("p", null, "Try a broader term or clear the filters. The official university links remain available in each guide.")); grid.appendChild(empty);
      }
      more.hidden = matches.length <= limit; more.textContent = stored.expanded ? "Show fewer services" : `Show all ${matches.length} services`;
    }
    draw();
  }

  function renderPlaybook(parent, university) {
    const container = section(parent, "study-playbook", "Make the most of your semester", "Student guidance built around the university’s published services. These suggestions are not additional programme requirements.");
    const grid = el("div", "uni-playbook-grid");
    for (const [index, record] of items(university.playbook).entries()) {
      const card = el("article", "uni-playbook-card"); card.append(el("span", "uni-playbook-number", String(index + 1).padStart(2, "0")), el("p", "uni-eyebrow", record.label), el("h3", null, record.title));
      paragraph(card, record.text, university, record.sourceIds); card.appendChild(externalLink("Explore the official guidance →", record.url)); grid.appendChild(card);
    }
    container.appendChild(grid);
  }

  function renderContacts(parent, university) {
    const container = section(parent, "contacts", "The right help, in the right place", "Start with the team responsible for your question. This guide never asks for passwords or university login details.");
    const grid = el("div", "uni-contact-grid");
    for (const record of items(university.contacts)) {
      const card = el("article", "uni-contact-card"); card.append(productIcon("support"), el("h3", null, record.title));
      paragraph(card, record.text, university, record.sourceIds); card.appendChild(externalLink(record.label + " →", record.url)); grid.appendChild(card);
    }
    container.appendChild(grid);
    container.appendChild(localLink("Something out of date? Suggest an update →", "contact.html", "uni-report-link"));
  }

  function renderCoursePreview(container, university) {
    if (!state.cohort || !state.trackId) return;
    const track = state.cohort.tracks.find((t) => t.id === state.trackId);
    const semesters = items(track && track.semesters).filter((s) => s.university === university.id);
    if (!semesters.length) return;
    const fold = el("details", "uni-course-preview"); fold.appendChild(el("summary", null, "Explore courses in the selected track"));
    paragraph(fold, "Course names and choice rules below come from the existing cohort study plan. Confirm current availability and approval with the programme office.", null, null, "uni-muted uni-small");
    const lookup = state.cohort.courses || {};
    function courseList(ids, notes = {}) {
      const list = el("ul");
      for (const id of items(ids)) {
        const course = lookup[id];
        if (!course) continue;
        const row = el("li", null, course.name + (course.code ? ` (${course.code})` : ""));
        if (typeof notes[id] === "string") row.appendChild(el("span", "uni-course-condition", " — " + notes[id]));
        list.appendChild(row);
      }
      return list;
    }
    for (const semester of semesters) {
      fold.appendChild(el("h3", null, `Semester ${semester.number}`));
      if (items(semester.required).length) fold.append(el("h4", null, "Required courses"), courseList(semester.required));
      for (const choice of items(semester.choices)) {
        fold.appendChild(el("h4", null, choice.rule || "Elective options — confirm the selection rule"));
        for (const [index, option] of items(choice.options).entries()) {
          const group = el("div", "uni-course-option");
          group.append(el("strong", null, `Option ${index + 1}${items(option).length > 1 ? " · grouped courses" : ""}`), courseList(option, choice.notes || {}));
          fold.appendChild(group);
        }
      }
      if (semester.choicesNote) paragraph(fold, semester.choicesNote);
    }
    fold.appendChild(localLink("Full track details →", trackUrl(state.trackId), "uni-text-link")); container.appendChild(fold);
  }

  function openPhotoDialog(university, media, returnFocus) {
    if (typeof HTMLDialogElement === "undefined" || !media || !D.imageUrl(media.src)) return;
    const dialog = el("dialog", "uni-photo-dialog");
    dialog.setAttribute("aria-labelledby", "uni-photo-dialog-title");
    const title = el("h2", null, media.label || university.name);
    title.id = "uni-photo-dialog-title";
    const close = button("Close photograph", () => dialog.close(), true);
    const image = el("img");
    image.src = D.imageUrl(media.src);
    image.alt = media.alt || media.caption || `${university.name} photograph`;
    dialog.append(close, title, image);
    paragraph(dialog, media.caption || `${university.name}, ${university.city}.`);
    if (media.credit || media.license) paragraph(dialog, [media.credit, media.license].filter(Boolean).join(" · "));
    if (D.externalUrl(media.sourceUrl)) dialog.appendChild(externalLink("Photo source and licence", media.sourceUrl));
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => { dialog.remove(); if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus(); }, { once: true });
    document.body.appendChild(dialog);
    dialog.showModal();
  }

  function enhancePhotograph(figure, university) {
    if (typeof HTMLDialogElement === "undefined") return;
    let launch;
    launch = button("View campus photo", () => openPhotoDialog(university, university.image, launch), true);
    launch.classList.add("uni-photo-expand");
    launch.prepend(productIcon("arrow"));
    figure.appendChild(launch);
  }

function renderCards(parent) {
    const grid = el("div", "uni-card-grid");
    state.file.universities.forEach((university, index) => {
      const card = el("article", "uni-card"); card.dataset.university = university.id;
      const media = photograph(university, false, false);
      const photoLink = localLink("", universityUrl(university), "uni-card-media-link"); photoLink.setAttribute("aria-label", `Explore ${university.name}`); photoLink.appendChild(media);
      card.appendChild(photoLink);
      const body = el("div", "uni-card-body");
      const brand = el("div", "uni-card-brand"); brand.append(monogram(university), el("span", "uni-eyebrow", `${String(index + 1).padStart(2, "0")} / ${university.country}`));
      const compare = button("Compare", () => {
        if (!state.compare.includes(university.id)) state.compare[1] = university.id;
        if (typeof state.compareRefresh === "function") state.compareRefresh();
        updateUrl({ compare: true }); const target = document.getElementById("compare"); if (target) { target.scrollIntoView({ block: "start", behavior: "auto" }); target.focus({ preventScroll: true }); }
      }, true); compare.classList.add("uni-card-compare"); compare.prepend(productIcon("compare")); compare.setAttribute("aria-label", `Compare ${university.name}`); brand.appendChild(compare);
      body.appendChild(brand);
      const heading = el("h3"); heading.appendChild(localLink(university.name, universityUrl(university))); body.appendChild(heading);
      paragraph(body, university.ui && university.ui.cardSummary || university.summary, university, summarySources(university), "uni-card-summary");
      const meta = el("div", "uni-card-meta");
      for (const [label, value] of [["Academic setting", university.ui && university.ui.academicLabel || university.academic.unit], ["City", university.city]]) {
        const item = el("div"); item.append(el("span", null, label), el("strong", null, value)); meta.appendChild(item);
      }
      body.append(meta, rolesList(university));
      const actions = el("div", "uni-actions"); const more = localLink("Explore university", universityUrl(university), "button");
      more.setAttribute("aria-label", `Explore ${university.name}`); more.appendChild(productIcon("arrow"));
      actions.append(more, localLink(`${university.city} city guide →`, cityGuideUrl(university), "uni-text-link")); body.appendChild(actions); card.appendChild(body); grid.appendChild(card);
    }); parent.appendChild(grid);
  }

  function renderMethodology(parent, heading = true) {
    const methodology = state.file.rankingMethodology || {};
    const box = el("div", "uni-rank-note");
    if (heading) box.appendChild(el("h3", null, "What a ranking can tell you"));
    paragraph(box, methodology.text || "Check the provider, edition, subject and institutional scope before comparing results. A university-wide ranking does not assess the EU-HEM programme itself.");
    if (items(methodology.notes).length) {
      const list = el("ul");
      for (const note of methodology.notes) list.appendChild(el("li", null, note));
      box.appendChild(list);
    }
    if (items(methodology.sources).length) {
      const links = el("div", "uni-actions");
      for (const source of methodology.sources) links.appendChild(externalLink(source.title || source.label || source.publisher || "Ranking methodology", source.url));
      box.appendChild(links);
    }
    parent.appendChild(box);
  }

  function comparisonValue(university, kind) {
    const box = el("div");
    if (kind === "location") paragraph(box, `${university.city}, ${university.country}`);
    if (kind === "roles") box.appendChild(rolesList(university, false));
    if (kind === "academic") {
      const academic = university.academic || {};
      paragraph(box, academic.unit || "Academic unit not listed", university, academic.sourceIds);
      if (D.externalUrl(academic.unitUrl)) box.appendChild(externalLink("Academic unit", academic.unitUrl));
    }
    if (kind === "strengths") {
      const list = el("ul");
      for (const item of items(university.highlights).slice(0, 3)) { const li = el("li", null, item.title); li.appendChild(citations(university, item.sourceIds)); list.appendChild(li); }
      box.appendChild(list.children.length ? list : el("p", "uni-muted", "See the university overview."));
    }
    if (kind === "campus") paragraph(box, university.campus && university.campus.text || "Campus information is not listed.", university, university.campus && university.campus.sourceIds);
    if (kind === "services") {
      const list = el("ul");
      for (const item of items(university.services).slice(0, 3)) { const li = el("li"); li.append(externalLink(item.title, item.url, ""), citations(university, item.sourceIds)); list.appendChild(li); }
      box.appendChild(list.children.length ? list : el("p", "uni-muted", "See official student services."));
    }
    if (kind === "overall" || kind === "accreditation") {
      const entries = items(university.rankings && university.rankings.entries).filter((entry) => entry.kind === kind);
      if (!entries.length) paragraph(box, kind === "overall" ? "No overall rank is listed in this guide. This does not imply a zero or a low rank." : "No accreditation entry is listed in this guide.", null, null, "uni-muted");
      for (const entry of entries) {
        paragraph(box, `${entry.provider || entry.name} · ${entry.edition}: ${entry.result}`, university, [entry.sourceId]);
        if (entry.scope) paragraph(box, entry.scope, null, null, "uni-muted uni-small");
      }
    }
    if (kind === "guide") box.appendChild(localLink(`Open ${university.shortName || university.name} guide`, universityUrl(university), "uni-text-link"));
    return box;
  }

  function renderComparison(parent) {
    const container = section(parent, "compare", "Compare two universities", "Compare their programme roles, academic setting and student services. Choose the same cohort and track view above for both universities.");
    container.classList.add("uni-compare");
    if (state.file.universities.length < 2) { paragraph(container, "A comparison needs two available university guides."); return; }
    const controls = el("div", "uni-compare-controls");
    const selects = [];
    ["First university", "Second university"].forEach((labelText, index) => {
      const field = el("div", "uni-control");
      const label = el("label", null, labelText);
      label.htmlFor = `uni-compare-${index === 0 ? "left" : "right"}`;
      const select = el("select"); select.id = label.htmlFor;
      for (const university of state.file.universities) { const option = el("option", null, university.name); option.value = university.id; select.appendChild(option); }
      select.value = state.compare[index];
      select.addEventListener("change", () => {
        if (select.value === state.compare[1 - index] || !state.file.universities.some((item) => item.id === select.value)) {
          select.value = state.compare[index]; status.textContent = "Choose two different universities."; return;
        }
        state.compare[index] = select.value; state.comparisonInvalid = false; draw(); updateUrl({ compare: true }); status.textContent = "Comparison updated.";
      });
      selects.push(select);
      field.append(label, select); controls.appendChild(field);
    });
    container.appendChild(controls);
    const actions = el("div", "uni-compare-actions");
    const status = el("p", "uni-compare-status");
    status.setAttribute("role", "status");
    const shareBox = el("div", "uni-share-box"); shareBox.hidden = true;
    const shareLabel = el("label", null, "Select and copy this comparison link"); shareLabel.htmlFor = "uni-comparison-link";
    const shareInput = el("input", "uni-share-input"); shareInput.id = shareLabel.htmlFor; shareInput.readOnly = true; shareInput.type = "url";
    shareBox.append(shareLabel, shareInput);
    actions.appendChild(button("Copy comparison link", async () => {
      const url = updateUrl({ compare: true });
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(url);
        status.textContent = "Comparison link copied.";
        shareBox.hidden = true;
      } catch {
        shareInput.value = url;
        shareBox.hidden = false;
        shareInput.focus(); shareInput.select();
        status.textContent = "Copy the selected link below.";
      }
    }, true));
    actions.appendChild(status);
    container.append(actions, shareBox);
    const swap = button("Swap universities", () => { state.compare.reverse(); draw(); updateUrl({ compare: true }); status.textContent = "Universities swapped."; }, true);
    swap.prepend(productIcon("compare")); actions.prepend(swap);
    const table = el("table", "uni-compare-table");
    table.setAttribute("role", "table");
    const caption = el("caption", "uni-sr-only", "Comparison of two EU-HEM partner universities");
    const head = el("thead"); const body = el("tbody");
    table.append(caption, head, body); container.appendChild(table);
    function draw() {
      const universities = state.compare.map((id) => state.file.universities.find((item) => item.id === id));
      selects.forEach((select, index) => { select.value = state.compare[index]; for (const option of select.options) option.disabled = option.value === state.compare[1 - index]; });
      head.replaceChildren(); body.replaceChildren();
      const heading = el("tr");
      const dimension = el("th", null, "Compare"); dimension.scope = "col"; heading.appendChild(dimension);
      for (const university of universities) { const cell = el("th"); cell.scope = "col";
        const top = el("div", "uni-compare-name"); top.append(monogram(university), el("strong", null, university.name)); cell.appendChild(top); heading.appendChild(cell); }
      head.appendChild(heading);
      const rows = [["Location", "location"], ["EU-HEM teaching role", "roles"], ["Academic home", "academic"], ["Academic highlights", "strengths"],
        ["Campus setting", "campus"], ["Student services", "services"], ["Overall rankings", "overall"], ["Accreditation", "accreditation"], ["Full university guide", "guide"]];
      for (const [label, kind] of rows) {
        const row = el("tr"); const title = el("th", null, label); title.scope = "row"; row.appendChild(title);
        for (const university of universities) {
          const cell = el("td");
          const mobileLabel = el("strong", "uni-compare-mobile-label", university.shortName || university.name); mobileLabel.setAttribute("aria-hidden", "true");
          cell.append(mobileLabel, comparisonValue(university, kind)); row.appendChild(cell);
        }
        body.appendChild(row);
      }
      if (state.comparisonInvalid) status.textContent = "This link contains an unavailable comparison. The first two available universities are shown.";
      shareInput.value = new URL(D.pageUrl("universities.html", { ...context(), compare: state.compare.join(","), hash: "compare" }), window.location.href).href;
    }
    state.compareRefresh = draw;
    draw();
    paragraph(container, "Rankings describe a specific institution, subject and edition. Accreditation is a separate quality assurance process; these entries should be read with their scope and sources.", null, null, "uni-review-line");
  }

  function renderPhotoCredit(parent, university, profile) {
    const photos = [university.image, ...items(university.gallery)].filter(Boolean);
    if (!photos.length) return;
    const box = el("div", "uni-photo-credit");
    box.id = profile ? "photo-credits" : `photo-credits-${university.id}`;
    box.appendChild(el("h3", null, photos.length > 1 ? "University photography" : "Campus photograph"));
    photos.forEach((photo, index) => {
      const item = el("div", "uni-photo-credit-item");
      item.appendChild(el("h4", null, photo.label || (index ? `Photo ${index + 1}` : "Main photograph")));
      paragraph(item, photo.caption);
      if (photo.title) paragraph(item, "Image: " + photo.title);
      paragraph(item, photo.credit ? `Credit: ${photo.credit}` : "Photo credit not recorded.");
      if (photo.license) {
        const license = el("p", null, "Licence: ");
        license.appendChild(D.externalUrl(photo.licenseUrl) ? externalLink(photo.license, photo.licenseUrl, "") : el("span", null, photo.license));
        item.appendChild(license);
      }
      paragraph(item, `${photo.changes || ""}${photo.changes ? " " : ""}Cropped to fit the page layout.`);
      if (photo.usageNote) paragraph(item, photo.usageNote);
      const links = el("div", "uni-actions");
      if (D.externalUrl(photo.sourceUrl)) links.appendChild(externalLink("Photo source", photo.sourceUrl));
      if (D.externalUrl(photo.originalUrl) && photo.originalUrl !== photo.sourceUrl) links.appendChild(externalLink("Original image", photo.originalUrl));
      item.appendChild(links);
      box.appendChild(item);
    });
    parent.appendChild(box);
  }

  function renderSourceList(parent, university, profile = false) {
    const list = el("ol", "uni-source-list");
    for (const source of items(university.sources)) {
      const li = el("li"); li.id = D.sourceAnchor(source.id); li.tabIndex = -1;
      li.appendChild(externalLink(source.title || source.publisher, source.url, ""));
      li.appendChild(el("span", "uni-source-meta", `${source.publisher || "Official source"} · Checked ${dateLabel(source.checkedAt)}`));
      if (source.note) li.appendChild(el("span", "uni-source-note", source.note));
      list.appendChild(li);
    }
    parent.appendChild(list);
    renderPhotoCredit(parent, university, profile);
  }

function renderVisualTour(parent) {
    const container = section(parent, "visual-tour", "See the universities, not just their names",
      "A visual introduction to the four partner institutions and their university environments. Captions distinguish campus, heritage and city context from confirmed EU-HEM teaching locations.");
    container.classList.add("uni-visual-tour");
    const grid = el("div", "uni-visual-grid");
    for (const university of state.file.universities) {
      const photos = [university.image, ...items(university.gallery)].filter((media) => media && D.imageUrl(media.src)).slice(0, 2);
      photos.forEach((media, index) => {
        let tile;
        tile = button(media.label || `${university.name} photograph`, () => openPhotoDialog(university, media, tile), true);
        tile.classList.add("uni-visual-tile");
        tile.dataset.university = university.id;
        const image = el("img");
        image.src = D.imageUrl(media.src);
        image.alt = media.alt || "";
        image.loading = "lazy";
        image.decoding = "async";
        if (media.objectPosition) image.style.objectPosition = media.objectPosition;
        const meta = el("span", "uni-visual-meta");
        meta.append(
          el("span", "uni-visual-kicker", `${university.city} · ${university.country}`),
          el("strong", null, media.label || (index ? "Another view" : university.name)),
          el("small", null, index ? "University photo" : "Main guide image")
        );
        tile.append(image, meta);
        grid.appendChild(tile);
      });
    }
    container.appendChild(grid);
    paragraph(container, "Open any image for its caption, photographer/source and licence. Teaching rooms can change, so the timetable remains the source for where your class actually meets.", null, null, "uni-visual-note");
  }

function renderDirectory() {
    document.title = "Universities – EU-HEM Student Hub";
    breadcrumb();
    const hero = el("section", "uni-hero uni-directory-hero"); hero.setAttribute("aria-labelledby", "uni-title");
    const intro = el("div", "uni-hero-copy"); intro.appendChild(el("p", "uni-eyebrow", "THE EU-HEM UNIVERSITY GUIDE"));
    const title = el("h1", null, "Four universities."); title.id = "uni-title"; title.appendChild(el("span", null, "One European journey.")); intro.appendChild(title);
    paragraph(intro, "Move through four distinct academic environments across Europe. Explore each university visually, understand where it sits in your track, and find the services you will actually use.", null, null, "uni-hero-intro");
    const actions = el("div", "uni-actions"); const start = localLink("Explore the universities", "#universities", "button"); start.appendChild(productIcon("arrow"));
    actions.append(start, localLink("Compare two universities", "#compare", "button button-quiet")); intro.appendChild(actions);
    const trust = el("p", "uni-hero-trust"); trust.append(productIcon("shield"), document.createTextNode("Student-built · Source-linked · Made for EU-HEM")); intro.appendChild(trust);
    const mosaic = el("div", "uni-campus-mosaic");
    for (const university of state.file.universities) {
      const tile = localLink("", universityUrl(university), "uni-mosaic-tile"); tile.setAttribute("aria-label", `Explore ${university.name}`);
      tile.appendChild(photograph(university, false, true)); const label = el("div", "uni-mosaic-label"); label.append(el("span", null, university.country), el("strong", null, university.city), productIcon("arrow")); tile.appendChild(label); mosaic.appendChild(tile);
    }
    hero.append(intro, mosaic); app.appendChild(hero);
    const proof = el("div", "uni-proof-strip"); const count = D.collectResources(state.file.universities).length;
    const photoCount = state.file.universities.reduce((total, university) => total + 1 + items(university.gallery).length, 0);
    for (const [number, label] of [[String(state.file.universities.length).padStart(2,"0"), "Partner institutions"], [String(new Set(state.file.universities.map(u => u.country)).size).padStart(2,"0"), "Countries to discover"], [String(count), "Official service links"], [String(photoCount).padStart(2,"0"), "University photos"]]) {
      const item = el("div"); item.append(el("strong", null, number), el("span", null, label)); proof.appendChild(item);
    }
    const note = el("p", null, "Your university, beyond the timetable."); proof.appendChild(note); app.appendChild(proof);
    renderVisualTour(app);
    renderContext();
    const jump = el("nav", "uni-directory-nav"); jump.setAttribute("aria-label", "Explore university resources");
    for (const [id, title, icon] of [["visual-tour","Photo tour","campus"],["universities","University guides","academic"],["journey","Your study route","pin"],["service-finder","Service finder","search"],["compare","Compare","compare"]]) {
      const a = localLink(title, "#"+id); a.prepend(productIcon(icon)); jump.appendChild(a);
    }
    app.appendChild(jump);
    const universities = section(app, "universities", "Four partners, four perspectives", "A shared programme. Distinct academic environments. Explore what each university brings to your experience.");
    renderCards(universities); renderJourney(app); renderResourceFinder(app); renderComparison(app);
    const rankings = section(app, "rankings-guide", "Reputation, with the right context"); renderMethodology(rankings, false);
    const sources = section(app, "sources", "Sources & photo credits", "Every guide links back to its sources. Check each reference’s review date and use the university’s own pages for current procedures.");
    for (const university of state.file.universities) {
      const details = el("details", "uni-sources-fold"); details.appendChild(el("summary", null, university.name)); renderSourceList(details, university); sources.appendChild(details);
    }
    paragraph(sources, `Guide updated: ${dateLabel(state.file.lastReviewed)}. Source review dates vary and are listed individually.`, null, null, "uni-review-line");
  }

  function informationCards(parent, university, records, options = {}) {
    if (!items(records).length) return;
    const grid = el("div", "uni-information-grid");
    for (const record of records) {
      const card = el("article", "uni-information");
      const title = record.title || record.label || record.name;
      if (options.place && record.kind) paragraph(card, record.kind, null, null, "uni-place-kind");
      card.prepend(productIcon(options.place ? "campus" : options.quick ? "digital" : "book"));
      card.appendChild(el("h3", null, title));
      if (options.place && record.address) card.appendChild(el("address", null, record.address));
      paragraph(card, record.text || record.description, university, record.sourceIds);
      if (!record.text && !record.description) card.appendChild(citations(university, record.sourceIds));
      if (record.access) card.appendChild(el("span", "uni-access", record.access));
      const actions = el("div", "uni-actions");
      if (D.externalUrl(record.url)) actions.appendChild(externalLink(options.place ? "Campus information" : options.quick ? "Open resource" : "Official information", record.url));
      if (options.place && D.externalUrl(record.mapUrl)) actions.appendChild(externalLink("Open map", record.mapUrl));
      if (actions.children.length) card.appendChild(actions);
      grid.appendChild(card);
    }
    parent.appendChild(grid);
  }

  function renderOverview(parent, university) {
    const container = section(parent, "overview", "At a glance");

    if (items(university.facts).length) {
      const facts = el("dl", "uni-facts");
      for (const fact of university.facts) {
        const item = el("div", "uni-fact"); const value = el("dd", null, fact.value);
        value.appendChild(citations(university, fact.sourceIds)); item.append(el("dt", null, fact.label), value); facts.appendChild(item);
      }
      container.appendChild(facts);
    }
    for (const item of items(university.about)) paragraph(container, item.text, university, item.sourceIds);
    informationCards(container, university, university.highlights);
  }

  function renderProgramme(parent, university) {
    const container = section(parent, "eu-hem", "EU-HEM at this university");
    const academic = university.academic || {};
    if (academic.unit) {
      const heading = el("h3");
      heading.appendChild(D.externalUrl(academic.unitUrl) ? externalLink(academic.unit, academic.unitUrl, "") : el("span", null, academic.unit));
      container.appendChild(heading);
    }
    paragraph(container, academic.text, university, academic.sourceIds);
    if (state.cohort) {
      const roles = D.universityRoles(state.cohort, university.id, state.trackId);
      paragraph(container, `${state.cohort.label || state.cohort.id}${state.trackId ? " · " + state.cohort.tracks.find((track) => track.id === state.trackId).name : " · All tracks"}`, null, null, "uni-muted uni-small");
      if (!roles.length) paragraph(container, "The selected track has no teaching semester or thesis option listed at this university in the current cohort study plan.", null, null, "uni-notice");
      const list = el("ol", "uni-programme-route");
      for (const role of roles) {
        const row = el("li"); row.appendChild(el("span", "uni-semester-label", `Semester ${role.semester}${role.kind === "thesis" ? " · Thesis" : ""}`));
        const description = el("div");
        if (role.kind === "common") {
          paragraph(description, "Common foundation for all tracks");
          paragraph(description, role.text, null, null, "uni-muted uni-small");
        } else {
          if (role.kind === "thesis") paragraph(description, "Listed thesis option for:", null, null, "uni-small");
          const tracks = el("ul", "uni-route-tracks");
          for (const track of role.tracks) { const li = el("li"); li.appendChild(localLink(track.name, trackUrl(track.id))); tracks.appendChild(li); }
          description.appendChild(tracks);
        }
        row.appendChild(description); list.appendChild(row);
      }
      container.appendChild(list);
      const provenance = el("p", "uni-review-line", "Teaching routes and listed thesis options: ");
      provenance.append(localLink("cohort study plan", trackUrl()), document.createTextNode(". Confirm thesis arrangements and course access with the programme office."));
      container.appendChild(provenance);
      const partner = state.cohort.universities && state.cohort.universities[university.id];
      if (partner && partner.programmePage) container.appendChild(externalLink("Official EU-HEM programme page", partner.programmePage.url, "button button-quiet"));
    } else paragraph(container, "Programme routes are unavailable for the selected cohort. Choose an available cohort above or consult the official programme office.", null, null, "uni-notice");
    if (items(academic.links).length) {
      const links = el("div", "uni-subsection"); informationCards(links, university, academic.links, { quick: true }); container.appendChild(links);
    }
    renderCoursePreview(container, university);
  }

  function renderCampus(parent, university) {
    const campus = university.campus || {};
    const container = section(parent, "campus", "Campus & teaching locations");
    paragraph(container, campus.text, university, campus.sourceIds);
    informationCards(container, university, campus.places, { place: true });
    if (campus.virtualTour && D.externalUrl(campus.virtualTour.url)) {
      const action = el("p", "uni-subsection");
      action.append(externalLink(campus.virtualTour.label || "Explore the virtual campus tour", campus.virtualTour.url, "button button-quiet"), citations(university, campus.virtualTour.sourceIds));
      container.appendChild(action);
    }
  }

function renderServices(parent, university) {
    const container = section(parent, "student-services", "Student services & essential links", "Find the right platform for the task. Filter the official links below; account access depends on your student status.");
    renderResourceFinder(container, university);
  }

  function renderResearch(parent, university) {
    const container = section(parent, "research-careers", "Research & careers");
    if (items(university.research).length) {
      container.appendChild(el("h3", null, "Research to explore"));
      informationCards(container, university, university.research);
    }
    if (items(university.careers).length) {
      const careers = el("div", "uni-subsection"); careers.appendChild(el("h3", null, "Career development"));
      informationCards(careers, university, university.careers); container.appendChild(careers);
    }
  }

  function renderStudentLife(parent, university) {
    const container = section(parent, "student-life", "Life beyond the classroom");
    informationCards(container, university, university.studentLife);
    const city = el("div", "uni-notice");
    city.appendChild(el("h3", null, `Living in ${university.city}`));
    paragraph(city, "For housing, local transport, daily costs and exploring the city, continue to the student city guide.");
    city.appendChild(localLink(`Open the ${university.city} guide`, cityGuideUrl(university), "button button-quiet"));
    container.appendChild(city);
  }

  function renderRankings(parent, university) {
    const container = section(parent, "rankings", "Rankings & recognition");
    const rankings = university.rankings || {};
    if (rankings.statusNote) paragraph(container, rankings.statusNote, null, null, "uni-section-intro");
    const entries = items(rankings.entries);
    if (entries.length) {
      const grid = el("div", "uni-ranking-grid");
      for (const entry of entries) {
        const card = el("article", "uni-ranking-card");
        card.dataset.kind = entry.kind;
        card.appendChild(el("span", "uni-provider-badge", entry.provider));
        const kinds = { overall: "Overall university ranking", subject: "Subject ranking", accreditation: "Accreditation" };
        paragraph(card, kinds[entry.kind] || "Recognition", null, null, "uni-ranking-kind");
        card.appendChild(el("h3", null, entry.name || entry.provider));
        paragraph(card, `${entry.provider}${entry.edition ? " · " + entry.edition : ""}`);
        paragraph(card, entry.result, university, [entry.sourceId], "uni-ranking-result");
        if (entry.subject) paragraph(card, "Subject: " + entry.subject);
        if (entry.scope) paragraph(card, "Scope: " + entry.scope);
        if (entry.note) paragraph(card, entry.note);
        grid.appendChild(card);
      }
      container.appendChild(grid);
    } else paragraph(container, "No ranking entries are currently listed in this guide. A missing entry is not a score or a judgement about quality.", null, null, "uni-notice");
    renderMethodology(container);
  }

  function renderChecklist(parent, university) {
    const container = section(parent, "first-week", "Your first-week checklist", "Use this as a starting point, and follow the university's instructions for your enrolment and access.");
    const records = items(university.gettingStarted);
    if (!records.length) { paragraph(container, "Check the official student services pages for your arrival instructions."); return; }
    const key = D.checklistKey(university.id, state.cohort && state.cohort.id);
    let storage;
    try { storage = window.localStorage; } catch { storage = null; }
    const saved = state.checklistMemory.get(key) || D.readChecklist(storage, key, records.map((item) => item.id));
    let completed = new Set(saved.completed);
    let storageAvailable = saved.available;
    let beforeReset = null;
    const summary = el("div", "uni-checklist-summary");
    const count = el("p", "uni-checklist-count"); count.id = "uni-checklist-count";
    const storageNote = el("p", "uni-checklist-storage");
    const live = el("p", "uni-sr-only"); live.setAttribute("role", "status");
    summary.append(count, storageNote); container.appendChild(summary);
    const progress = el("progress", "uni-checklist-progress"); progress.max = records.length;
    progress.setAttribute("aria-labelledby", count.id); container.appendChild(progress);
    const list = el("ul", "uni-checklist");
    const checkboxes = [];
    for (const item of records) {
      const li = el("li");
      const label = el("label");
      const input = el("input"); input.type = "checkbox"; input.checked = completed.has(item.id); input.dataset.step = item.id;
      input.addEventListener("change", () => {
        if (input.checked) completed.add(item.id); else completed.delete(item.id);
        beforeReset = null; undo.hidden = true;
        save(); draw(); live.textContent = `${completed.size} of ${records.length} steps complete.`;
      });
      label.append(input, el("span", null, item.title)); li.appendChild(label);
      const text = el("div", "uni-checklist-text");
      paragraph(text, item.text, university, item.sourceIds);
      if (D.externalUrl(item.url)) text.appendChild(externalLink("Open instructions", item.url));
      li.appendChild(text); list.appendChild(li); checkboxes.push(input);
    }
    container.appendChild(list);
    const actions = el("div", "uni-actions");
    const reset = button("Reset progress", () => {
      beforeReset = new Set(completed); completed.clear(); save(); draw(); undo.hidden = false; undo.focus(); live.textContent = "Checklist reset. Undo is available.";
    }, true);
    const undo = button("Undo reset", () => { if (!beforeReset) return; completed = new Set(beforeReset); beforeReset = null; undo.hidden = true; save(); draw(); live.textContent = "Checklist progress restored."; reset.focus(); }, true);
    undo.hidden = true;
    actions.append(reset, undo); container.append(actions, live);
    function save() {
      storageAvailable = D.writeChecklist(storage, key, completed);
      state.checklistMemory.set(key, { completed: [...completed], available: storageAvailable, corrupted: false });
    }
    function draw() {
      count.textContent = `${completed.size} of ${records.length} complete`;
      progress.value = completed.size;
      progress.textContent = `${completed.size} of ${records.length}`;
      for (const input of checkboxes) input.checked = completed.has(input.dataset.step);
      reset.disabled = completed.size === 0;
      storageNote.textContent = storageAvailable ? "Saved only in this browser." : "Browser storage is unavailable. Progress stays on this page.";
    }
    draw();
    if (saved.corrupted) storageNote.textContent = "The saved checklist could not be read. Start with the unchecked steps below.";
  }

  function renderFaq(parent, university) {
    const container = section(parent, "faq", "Questions students ask");
    for (const faq of items(university.faq)) {
      const details = el("details", "uni-faq"); details.appendChild(el("summary", null, faq.q));
      paragraph(details, faq.a, university, faq.sourceIds);
      if (D.externalUrl(faq.url)) details.appendChild(externalLink("Official information", faq.url));
      container.appendChild(details);
    }
    if (!items(university.faq).length) paragraph(container, "Contact the official programme or student support office using the links in this guide.");
  }

  function renderToc(parent) {
    const nav = el("nav", "uni-toc"); nav.setAttribute("aria-label", "On this page");
    const fold = el("details"); fold.open = window.matchMedia("(min-width: 901px)").matches;
    fold.appendChild(el("summary", null, "On this page"));
    const list = el("ol");
    const links = [["overview", "At a glance"], ["eu-hem", "EU-HEM programme"], ["your-route", "Your study route"], ["campus", "Campus"], ["student-services", "Student services"],
      ["study-playbook", "Study playbook"], ["research-careers", "Research & careers"], ["student-life", "Student life"], ["rankings", "Rankings"], ["first-week", "First-week checklist"], ["contacts", "Who to contact"], ["faq", "FAQ"], ["sources", "Sources & credits"]];
    for (const [id, label] of links) { const li = el("li"); li.appendChild(localLink(label, "#" + id)); list.appendChild(li); }
    fold.appendChild(list); nav.appendChild(fold); parent.appendChild(nav);
    return nav;
  }

  function renderProfile(university) {
    document.title = `${university.name} – EU-HEM Student Hub`;
    const meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = university.summary;
    breadcrumb(university);
    renderPartnerSwitch(app, university);
    const hero = el("section", "uni-hero uni-profile-hero"); hero.setAttribute("aria-labelledby", "uni-title");
    const intro = el("div", "uni-hero-copy");
    intro.appendChild(el("p", "uni-eyebrow", `${university.city} / ${university.country}`));
    const title = el("h1", null, university.name); title.id = "uni-title"; intro.appendChild(title);
    if (university.localName && university.localName !== university.name) paragraph(intro, university.localName, null, null, "uni-local-name");
    const badge = el("p", "uni-profile-badge", "EU-HEM partner institution"); badge.prepend(productIcon("academic")); intro.appendChild(badge);
    paragraph(intro, university.summary, university, summarySources(university), "uni-hero-intro");
    const actions = el("div", "uni-actions");
    actions.append(localLink("First-week checklist", "#first-week", "button"), localLink(`${university.city} city guide`, cityGuideUrl(university), "button button-quiet"));
    const photo = photograph(university, true, true); enhancePhotograph(photo, university);
    intro.appendChild(actions); hero.append(intro, photo); app.appendChild(hero);
    renderQuickDock(app, university);
    renderContext();
    const layout = el("div", "uni-profile-layout");
    const toc = renderToc(layout);
    const content = el("div", "uni-profile-content"); layout.appendChild(content); app.appendChild(layout);
    renderOverview(content, university);
    renderProgramme(content, university);
    renderJourney(content, university);
    renderCampus(content, university);
    renderServices(content, university);
    renderPlaybook(content, university);
    renderResearch(content, university);
    renderStudentLife(content, university);
    renderRankings(content, university);
    renderChecklist(content, university);
    renderContacts(content, university);
    renderFaq(content, university);
    const sources = section(content, "sources", "Sources & photo credits");
    paragraph(sources, `Guide updated: ${dateLabel(state.file.lastReviewed)}. Source review dates are listed individually. Use the linked university pages for current procedures and eligibility.`, null, null, "uni-section-intro");
    renderSourceList(sources, university, true);
    if (typeof IntersectionObserver === "function") {
      const visibleSections = new Map();
      state.observer = new IntersectionObserver((entries) => {
        for (const entry of entries) { if (entry.isIntersecting) visibleSections.set(entry.target.id, entry.target); else visibleSections.delete(entry.target.id); }
        const visible = [...visibleSections.values()].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        if (!visible) return;
        for (const link of toc.querySelectorAll("a")) {
          if (link.getAttribute("href") === "#" + visible.id) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current");
        }
      }, { rootMargin: "-90px 0px -55% 0px", threshold: 0 });
      for (const node of content.querySelectorAll(":scope > section[id]")) state.observer.observe(node);
    }
  }

  function renderInvalidUniversity(id) {
    document.title = "Choose a university – EU-HEM Student Hub";
    breadcrumb();
    const notice = el("section", "uni-notice");
    notice.appendChild(el("h1", null, id ? "University guide not found" : "Choose a university"));
    paragraph(notice, id ? `There is no published guide for “${id.slice(0, 80)}”. Choose one of the available universities below.` : "Open a university to explore its campus, programme role and student services.");
    const list = el("ul");
    for (const university of state.file.universities) { const li = el("li"); li.appendChild(localLink(university.name, universityUrl(university))); list.appendChild(li); }
    notice.append(list, localLink("All university guides", directoryUrl(), "button button-quiet"));
    app.appendChild(notice);
  }

  function openHashTarget(focus = false) {
    if (!window.location.hash) return;
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !app.contains(target)) return;
    let ancestor = target.parentElement;
    while (ancestor && ancestor !== app) { if (ancestor.tagName === "DETAILS") ancestor.open = true; ancestor = ancestor.parentElement; }
    target.scrollIntoView({ block: "start", behavior: "auto" });
    if (focus) { if (!target.hasAttribute("tabindex")) target.tabIndex = -1; target.focus({ preventScroll: true }); }
  }

  function renderPage(options = {}) {
    if (state.observer) { state.observer.disconnect(); state.observer = null; }
    app.replaceChildren();
    if (view === "profile") {
      const id = new URLSearchParams(window.location.search).get("id");
      const university = state.file.universities.find((item) => item.id === id);
      if (university) renderProfile(university); else renderInvalidUniversity(id);
    } else renderDirectory();
    app.setAttribute("aria-busy", "false");
    if (options.focus) { const node = document.getElementById(options.focus); if (node) node.focus({ preventScroll: true }); }
    else requestAnimationFrame(() => openHashTarget());
  }

  function renderFailure() {
    app.replaceChildren(); app.setAttribute("aria-busy", "false");
    const notice = el("section", "uni-notice"); notice.setAttribute("role", "alert");
    notice.appendChild(el("h1", null, "The university guides could not be loaded"));
    paragraph(notice, "Please try again. You can also use the official university websites while the guide is unavailable.");
    notice.appendChild(button("Try again", () => loadPage()));
    const list = el("ul");
    for (const [label, url] of [["University of Bologna", "https://www.unibo.it/en"], ["University of Oslo", "https://www.uio.no/english/"],
      ["Erasmus University Rotterdam", "https://www.eur.nl/en"], ["MCI | The Entrepreneurial School", "https://www.mci.edu/en/"]]) {
      const li = el("li"); li.appendChild(externalLink(label, url)); list.appendChild(li);
    }
    notice.appendChild(list); app.appendChild(notice);
  }

  async function loadPage() {
    if (state.loading) return;
    state.loading = true;
    app.setAttribute("aria-busy", "true");    // Keep existing content visible during a retry; disable only the initiating buttons.
    for (const control of app.querySelectorAll("button")) control.disabled = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const [content, tracks] = await Promise.allSettled([
        D.loadFile({ signal: controller.signal }),
        typeof loadTracksFile === "function" ? loadTracksFile((path) => D.readLocalText(path, controller.signal)) : Promise.reject(new Error("Track helpers unavailable"))
      ]);
      if (content.status !== "fulfilled") { renderFailure(); return; }
      state.file = content.value;
      state.tracks = tracks.status === "fulfilled" ? tracks.value : null;
      state.tracksError = tracks.status !== "fulfilled";
      const params = new URLSearchParams(window.location.search);
      state.requestedCohort = params.get("cohort") || "";
      const resolution = D.resolveCohort(state.tracks, state.requestedCohort);
      state.cohort = resolution.cohort; state.cohorts = resolution.cohorts;
      if (!state.cohorts.length) state.tracksError = true;
      const saved = typeof loadMyTrack === "function" ? loadMyTrack() : null;
      const requestedTrack = params.has("track") ? (params.get("track") === "all" ? "" : params.get("track")) : (saved && state.cohort && saved.cohort === state.cohort.id ? saved.track : "");
      state.trackId = state.cohort && state.cohort.tracks.some((track) => track.id === requestedTrack) ? requestedTrack : "";
      state.trackMessage = params.get("track") && params.get("track") !== "all" && state.cohort && !state.trackId ? "The requested track is not available for this cohort. All tracks are shown." : "";
      const comparison = D.resolveComparison(state.file.universities, params.get("compare"));
      state.compare = comparison.ids; state.comparisonInvalid = comparison.invalid;
      renderPage();
    } catch (error) {
      console.error("University guide:", error && error.message || error);
      renderFailure();
    } finally {
      clearTimeout(timeout); state.loading = false;
    }
  }

  app.addEventListener("click", (event) => {
    const link = event.target.closest("a[href^='#']");
    if (link && app.contains(link)) requestAnimationFrame(() => openHashTarget(true));
  });
  window.addEventListener("hashchange", () => openHashTarget());
  if (D) loadPage();
  else {
    app.replaceChildren(el("h1", null, "The university guides could not be started"), el("p", null, "Reload the page to try again."));
    app.appendChild(button("Reload page", () => window.location.reload()));
    app.setAttribute("aria-busy", "false");
  }
})();