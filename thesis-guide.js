// Thesis Explorer: a sourced guide and a private, local planning workspace.
// The historical archive has its own loader and continues to work independently.
(() => {
  "use strict";
  const VIEWS = ["roadmap", "topics", "toolkit", "planner", "archive"];
  const FIELD_LABELS = { topic: "Working topic", question: "Research question", population: "Population / unit of analysis",
    context: "Setting / context", outcome: "Outcome / decision", method: "Proposed method", data: "Data or evidence",
    access: "Access, ethics and feasibility", supervisor: "Possible supervisor / team", notes: "Notes / next action" };
  const FIELD_HELP = {
    topic: "A working title can change as your question becomes clearer.",
    question: "What exactly will you describe, compare, explain or evaluate?",
    population: "Who or what will you study: patients, organisations, policies, studies or another unit?",
    context: "Specify a country, health system, organisation or time period.",
    outcome: "Which outcome, experience or decision matters, and to whom?",
    method: "Choose the design that fits the question and available evidence.",
    data: "Name the dataset, documents or participants; note the variables or evidence you need.",
    access: "Record access conditions, approvals, consent and a realistic fallback.",
    supervisor: "Record a potential academic contact. This does not assign a supervisor.",
    notes: "What is the next small action that will move this project forward?",
  };
  const state = { guide: null, cohort: null, draft: null, view: "roadmap", trackFilter: "", methodFilter: "", saved: false, saveMessage: "", tracksUnavailable: false, rawDraft: null };
  const element = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const button = (text, id, action, cls = "button button-quiet") => {
    const node = element("button", cls, text);
    node.type = "button";
    if (id) node.id = id;
    if (action) node.addEventListener("click", action);
    return node;
  };
  function link(text, url, cls) {
    const node = element("a", cls, text);
    // All sources come from the reviewed guide, but disallow executable schemes.
    if (typeof url === "string" && (/^https:\/\//.test(url) || /^[a-z][a-z0-9-]*\.html(?:[?#].*)?$/.test(url))) node.href = url;
    if (/^https:\/\//.test(url || "")) { node.target = "_blank"; node.rel = "noopener"; }
    if (/^thesis\.html#guide-/.test(url || "")) node.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); showView(url.split("#guide-")[1], { scroll: true });
    });
    return node;
  }
  function notify(message) {
    document.querySelectorAll(".tg-feedback-toast").forEach((node) => node.remove());
    if (typeof toast === "function") toast(message)?.classList.add("tg-feedback-toast");
  }
  function currentTrack() { return state.cohort?.tracks?.find((track) => track.id === state.draft?.trackId) || null; }
  function sourceLinks(ids) {
    const node = element("p", "tg-source-note");
    const sources = (ids || []).map((id) => state.guide.sources?.find((source) => source.id === id)).filter(Boolean);
    if (!sources.length) return node;
    node.appendChild(element("span", "", "Sources: "));
    sources.forEach((source, index) => { if (index) node.appendChild(document.createTextNode(" · ")); node.appendChild(link(source.title, source.url)); });
    return node;
  }
  function sectionHead(title, intro, kicker) {
    const head = element("div", "tg-section-head");
    if (kicker) head.appendChild(element("p", "tg-kicker", kicker));
    head.appendChild(element("h2", "", title));
    if (intro) head.appendChild(element("p", "", intro));
    return head;
  }
  function saveDraft() {
    if (!state.draft) return false;
    const clean = ThesisGuideData.sanitizeDraft(state.draft, state.guide, state.cohort);
    // Keep a host from the stored draft intact if the track feed failed. Saving
    // resumes only after that feed can validate the full track/host relationship.
    const saved = !state.tracksUnavailable && writeStorage(ThesisGuideData.DRAFT_KEY, clean);
    state.saved = saved;
    state.saveMessage = saved ? "Saved on this device" : state.tracksUnavailable
      ? "Changes kept in this tab · reload track details to save" : "Changes kept in this tab · device storage unavailable";
    const status = document.getElementById("tg-save-state");
    if (status) status.textContent = state.saveMessage;
    renderProgress();
    renderBrief();
    return saved;
  }
  function showView(view, options = {}) {
    if (!VIEWS.includes(view)) view = "roadmap";
    state.view = view;
    document.querySelectorAll("#tg-tabs [data-guide-view]").forEach((tab) => {
      const active = tab.dataset.guideView === view;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && options.focus) tab.focus();
    });
    VIEWS.forEach((id) => { const panel = document.getElementById(`tg-panel-${id}`); if (panel) panel.hidden = id !== view; });
    const loading = document.getElementById("tg-guide-status");
    if (loading) loading.hidden = view === "archive" || !!state.guide;
    const provenance = document.getElementById("tg-guide-provenance");
    if (provenance) provenance.hidden = view === "archive";
    if (options.updateHash !== false) {
      const url = new URL(window.location.href); url.hash = `guide-${view}`;
      window.history.replaceState(null, "", url);
    }
    if (options.scroll) document.getElementById("tg-tabs")?.scrollIntoView({ block: "start", behavior: "auto" });
  }
  function initialView() {
    const hash = window.location.hash.replace(/^#guide-/, "");
    if (VIEWS.includes(hash)) return hash;
    const params = new URLSearchParams(window.location.search);
    return ["q", "cohort", "track", "university", "theme", "currentTrack", "method", "sort", "browse", "topic"].some((key) => params.has(key)) ? "archive" : "roadmap";
  }
  function bindNavigation() {
    const tabs = [...document.querySelectorAll("#tg-tabs [data-guide-view]")];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => showView(tab.dataset.guideView));
      tab.addEventListener("keydown", (event) => {
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault(); showView(tabs[next].dataset.guideView, { focus: true });
      });
    });
    window.addEventListener("hashchange", () => { const view = initialView(); showView(view, { updateHash: false, scroll: true }); });
    window.addEventListener("popstate", () => showView(initialView(), { updateHash: false }));
    showView(initialView(), { updateHash: false });
  }
  function progressNode() {
    const box = element("div", "tg-progress");
    const label = element("p", "tg-progress-label"); label.dataset.guideProgress = "label";
    const bar = element("div", "tg-progress-bar"); bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", "Personal planning checklist"); bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", "100");
    bar.dataset.guideProgress = "bar"; bar.appendChild(element("span"));
    box.append(label, bar, element("p", "tg-source-note", "Your own planning milestones; this does not measure thesis quality or official eligibility."));
    return box;
  }
  function renderProgress() {
    if (!state.draft || !state.guide) return;
    const progress = ThesisGuideData.readiness(state.draft, state.guide);
    document.querySelectorAll('[data-guide-progress="label"]').forEach((node) => { node.textContent = `${progress.completed} of ${progress.total} planning milestones checked`; });
    document.querySelectorAll('[data-guide-progress="bar"]').forEach((node) => {
      node.setAttribute("aria-valuenow", String(progress.percent)); node.firstElementChild.style.width = `${progress.percent}%`;
    });
    (state.guide.journey || []).forEach((stage) => {
      const tab = document.getElementById(`tg-stage-${stage.id}`);
      const count = tab?.querySelector(".tg-stage-count");
      if (count) count.textContent = `${(stage.checklist || []).filter((item) => state.draft.completed.includes(item.id)).length}/${stage.checklist?.length || 0}`;
    });
  }
  function checklist(items, prefix = "tg-check") {
    const list = element("div", "tg-checklist");
    for (const item of items || []) {
      const label = element("label", "tg-check");
      const input = element("input"); input.type = "checkbox"; input.id = `${prefix}-${item.id}`; input.checked = state.draft.completed.includes(item.id);
      input.dataset.milestone = item.id;
      input.addEventListener("change", () => {
        state.draft.completed = input.checked ? [...new Set([...state.draft.completed, item.id])] : state.draft.completed.filter((id) => id !== item.id);
        document.querySelectorAll("[data-milestone]").forEach((other) => { if (other.dataset.milestone === item.id) other.checked = input.checked; });
        saveDraft();
      });
      label.append(input, element("span", "", item.text)); list.appendChild(label);
    }
    return list;
  }
  function renderRoadmap() {
    const panel = document.getElementById("tg-panel-roadmap"); panel.replaceChildren();
    panel.appendChild(sectionHead("Start before you need a title.", "A practical route from your first ideas to the final conversation. Move between stages as your project develops.", "Your thesis journey"));
    const facts = element("div", "tg-fact-grid");
    for (const fact of state.guide.facts || []) {
      const card = element("article", "tg-fact"); card.append(element("h3", "", fact.title), element("p", "", fact.text), sourceLinks(fact.sourceIds)); facts.appendChild(card);
    }
    panel.append(facts, progressNode());
    const journey = element("div", "tg-journey");
    const steps = element("div", "tg-stage-list"); steps.setAttribute("role", "group"); steps.setAttribute("aria-label", "Thesis preparation stages");
    (state.guide.journey || []).forEach((stage, index) => {
      const item = button("", `tg-stage-${stage.id}`, () => {
        state.draft.selectedStage = stage.id; saveDraft(); renderStage();
      }, "tg-stage");
      item.setAttribute("aria-controls", "tg-stage-detail");
      item.append(element("span", "tg-stage-number", String(index + 1).padStart(2, "0")), element("span", "tg-stage-label", stage.label), element("span", "tg-stage-when", stage.when), element("span", "tg-stage-count"));
      steps.appendChild(item);
    });
    const detail = element("article", "tg-stage-detail tg-card"); detail.id = "tg-stage-detail";
    journey.append(steps, detail); panel.appendChild(journey); renderStage();
    panel.appendChild(sectionHead(state.guide.sprint?.title || "A first-project sprint", state.guide.sprint?.disclaimer, "Make your next move"));
    const sprint = element("ol", "tg-sprint-grid");
    for (const week of state.guide.sprint?.weeks || []) {
      const card = element("li", "tg-card"); card.append(element("p", "tg-kicker", week.label), element("h3", "", week.focus), element("p", "", week.deliverable)); sprint.appendChild(card);
    }
    panel.appendChild(sprint);
  }
  function renderStage() {
    const stage = state.guide.journey.find((item) => item.id === state.draft.selectedStage) || state.guide.journey[0];
    document.querySelectorAll(".tg-stage").forEach((node) => node.setAttribute("aria-pressed", String(node.id === `tg-stage-${stage.id}`)));
    const detail = document.getElementById("tg-stage-detail"); detail.replaceChildren();
    detail.append(element("p", "tg-kicker", `${stage.when} · ${stage.timingType}`), element("h3", "", stage.label), element("p", "tg-stage-goal", stage.goal));
    const list = element("ul"); (stage.actions || []).forEach((action) => list.appendChild(element("li", "", action))); detail.appendChild(list);
    const deliverable = element("p", "tg-deliverable"); deliverable.append(element("strong", "", "Leave this stage with: "), document.createTextNode(stage.deliverable)); detail.appendChild(deliverable);
    const pitfall = element("p", "tg-pitfall"); pitfall.append(element("strong", "", "Watch for: "), document.createTextNode(stage.pitfall)); detail.appendChild(pitfall);
    detail.append(element("h4", "", "My planning milestones"), checklist(stage.checklist), sourceLinks(stage.sourceIds));
    renderProgress();
  }
  function options(select, entries, emptyLabel) {
    select.appendChild(new Option(emptyLabel, ""));
    entries.forEach((entry) => select.appendChild(new Option(entry.label, entry.value)));
  }
  function renderTopics() {
    const panel = document.getElementById("tg-panel-topics"); panel.replaceChildren();
    panel.appendChild(sectionHead("Turn an interest into a question.", "These illustrative prompts show how a track can lead to a feasible project. They are starting points to adapt with a supervisor, not available thesis placements.", "Find a topic"));
    const filters = element("div", "tg-filters");
    const trackLabel = element("label", "tg-track-filter", "Track lens");
    const trackSelect = element("select"); trackSelect.id = "tg-topic-track";
    options(trackSelect, (state.cohort.tracks || []).map((track) => ({ value: track.id, label: track.name })), "All tracks"); trackSelect.value = state.trackFilter;
    trackSelect.addEventListener("change", () => { state.trackFilter = trackSelect.value; renderTopicCards(); }); trackLabel.appendChild(trackSelect);
    const methodLabel = element("label", "tg-track-filter", "Method lens"); const methodSelect = element("select"); methodSelect.id = "tg-topic-method";
    options(methodSelect, (state.guide.methods || []).map((method) => ({ value: method.name, label: method.name })), "All methods"); methodSelect.value = state.methodFilter;
    methodSelect.addEventListener("change", () => { state.methodFilter = methodSelect.value; renderTopicCards(); }); methodLabel.appendChild(methodSelect);
    filters.append(trackLabel, methodLabel); panel.appendChild(filters);
    const count = element("p", "tg-topic-count"); count.id = "tg-topic-count"; count.setAttribute("role", "status"); panel.appendChild(count);
    const grid = element("div", "tg-topic-grid"); grid.id = "tg-topic-grid"; panel.appendChild(grid); renderTopicCards();
    panel.appendChild(element("p", "tg-source-note", "Track relevance is Student Hub guidance. An interesting topic still needs a clear question, appropriate supervision and feasible access to evidence."));
    panel.appendChild(link("Explore previous students’ topics →", "thesis.html#guide-archive", "button button-quiet"));
  }
  function topicDetails(rows) {
    const list = element("dl", "tg-topic-details");
    for (const [term, description] of rows) { list.append(element("dt", "", term), element("dd", "", description)); }
    return list;
  }
  function renderTopicCards() {
    const grid = document.getElementById("tg-topic-grid"); if (!grid) return; grid.replaceChildren();
    const topics = (state.guide.topics || []).filter((topic) => (!state.trackFilter || topic.trackIds.includes(state.trackFilter)) && (!state.methodFilter || topic.methods.includes(state.methodFilter)));
    document.getElementById("tg-topic-count").textContent = `${topics.length} illustrative ${topics.length === 1 ? "direction" : "directions"}`;
    for (const topic of topics) {
      const card = element("article", "tg-topic-card tg-card"); card.id = `tg-topic-${topic.id}`;
      const tags = element("div", "tg-track-tags");
      for (const id of topic.trackIds || []) { const track = state.cohort.tracks.find((item) => item.id === id); tags.appendChild(element("span", "tg-tag", track?.shortName || track?.name || id.toUpperCase())); }
      card.append(tags, element("h3", "", topic.title), element("p", "tg-topic-question", topic.question));
      card.appendChild(topicDetails([["Evidence to look for", topic.dataIdea], ["Possible method", topic.methods.join(" · ")], ["Feasibility check", topic.feasibility]]));
      const actions = element("div", "tg-card-actions");
      const saved = state.draft.savedIdeas.includes(topic.id);
      const save = button(saved ? "Saved to my ideas ✓" : "Save this idea", `tg-save-idea-${topic.id}`, () => {
        state.draft.savedIdeas = saved ? state.draft.savedIdeas.filter((id) => id !== topic.id) : [...state.draft.savedIdeas, topic.id];
        const stored = saveDraft(); renderTopicCards(); renderSavedIdeas();
        document.getElementById(`tg-save-idea-${topic.id}`)?.focus({ preventScroll: true });
        notify(stored ? saved ? "Idea removed from your workspace" : "Idea saved to your workspace" : "Idea updated in this tab. Open My thesis for the save status.");
      }); save.dataset.saveIdea = topic.id; save.setAttribute("aria-pressed", String(saved)); actions.appendChild(save);
      const keyword = topic.archiveKeywords?.[0] || topic.title;
      const archiveLink = link("Related past topics →", `thesis.html?q=${encodeURIComponent(keyword)}#guide-archive`);
      archiveLink.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (window.ThesisArchive?.show?.({ q: keyword })) event.preventDefault();
      });
      actions.appendChild(archiveLink);
      card.append(actions, sourceLinks(topic.sourceIds)); grid.appendChild(card);
    }
    if (!topics.length) grid.appendChild(element("p", "tg-card tg-empty", "No prompts match both lenses. Try a broader track or method."));
  }
  function disclosure(title, text, items, sourceIds, open = false) {
    const details = element("details", "tg-disclosure"); details.open = open;
    details.appendChild(element("summary", "", title));
    const body = element("div", "tg-disclosure-body");
    if (text) body.appendChild(element("p", "", text));
    for (const item of items || []) {
      if (typeof item === "string") body.appendChild(element("p", "", item));
      else { body.append(element("h4", "", item.title), element("p", "", item.text)); }
    }
    body.appendChild(sourceLinks(sourceIds)); details.appendChild(body); return details;
  }
  function renderToolkit() {
    const panel = document.getElementById("tg-panel-toolkit"); panel.replaceChildren();
    panel.appendChild(sectionHead("Build a project you can finish.", "Choose a research design, test your assumptions and plan the conversations and checks that make the work credible.", "Research toolkit"));
    const jumps = element("nav", "tg-toolkit-jumps"); jumps.setAttribute("aria-label", "Research toolkit sections");
    [["Methods", "tg-methods"], ["Practical guides", "tg-practical"], ["Supervision", "tg-supervision"], ["Resources", "tg-resources"], ["Questions", "tg-faq"]].forEach(([label, id]) => {
      jumps.appendChild(button(label, "", () => {
        const target = document.getElementById(id); target?.scrollIntoView({ block: "start", behavior: "auto" });
        const heading = target?.querySelector("h2,h3,summary"); if (heading) { if (heading.tagName !== "SUMMARY") heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      }));
    });
    panel.appendChild(jumps);
    const methods = element("div", "tg-method-grid");
    methods.id = "tg-methods";
    for (const method of state.guide.methods || []) {
      const card = element("article", "tg-method-card tg-card");
      card.append(element("h3", "", method.name), element("p", "", method.bestFor));
      const requirements = element("ul"); (method.requirements || []).forEach((text) => requirements.appendChild(element("li", "", text)));
      card.append(element("h4", "", "What it needs"), requirements);
      card.appendChild(topicDetails([["Strength", method.strength], ["Limit", method.limits], ["Question example", method.questionExample]]));
      card.appendChild(sourceLinks(method.sourceIds)); methods.appendChild(card);
    }
    panel.appendChild(methods);
    panel.appendChild(sectionHead("From a broad idea to a defensible study.", "Open the practical guides as you need them."));
    const sections = element("div", "tg-tool-section");
    sections.id = "tg-practical";
    (state.guide.sections || []).forEach((section, index) => sections.appendChild(disclosure(section.title, section.intro, section.items, section.sourceIds, index === 0)));
    panel.appendChild(sections);
    const supervision = state.guide.supervision || {};
    const sup = element("section", "tg-supervision");
    sup.id = "tg-supervision";
    sup.appendChild(sectionHead("Make supervision a working partnership.", supervision.intro));
    const grid = element("div", "tg-panel-grid");
    for (const [title, values] of [["Find a suitable academic contact", supervision.find], ["Prepare your first conversation", supervision.meeting], ["Agree how you will work together", supervision.expectations]]) {
      const card = element("article", "tg-card"); card.appendChild(element("h3", "", title)); const list = element("ul"); (values || []).forEach((value) => list.appendChild(element("li", "", value))); card.appendChild(list); grid.appendChild(card);
    }
    sup.append(grid, sourceLinks(supervision.sourceIds)); panel.appendChild(sup);
    const email = disclosure("First-contact email scaffold", "Adapt this to a specific researcher’s expertise and your actual preparation.", [], supervision.sourceIds);
    const emailText = element("pre", "tg-email-preview", supervision.emailTemplate || ""); email.querySelector(".tg-disclosure-body").prepend(emailText); panel.appendChild(email);
    panel.appendChild(sectionHead("Useful places to begin.", "Check each source’s coverage, definitions and access conditions before designing a study around it."));
    const resources = element("div", "tg-resource-grid");
    resources.id = "tg-resources";
    for (const resource of state.guide.resources || []) {
      const card = element("article", "tg-card"); card.append(element("p", "tg-kicker", resource.category), element("h3", "", resource.title), element("p", "", resource.description), element("p", "tg-resource-access", resource.accessNote), link("Open resource →", resource.url)); resources.appendChild(card);
    }
    panel.appendChild(resources);
    panel.appendChild(sectionHead("Questions students ask."));
    const faq = element("div", "tg-tool-section"); faq.id = "tg-faq"; (state.guide.faq || []).forEach((item) => faq.appendChild(disclosure(item.question, item.answer, [], item.sourceIds))); panel.appendChild(faq);
  }
  function renderPlanner() {
    const panel = document.getElementById("tg-panel-planner"); panel.replaceChildren();
    panel.appendChild(sectionHead("Make your next conversation concrete.", "Keep a working brief, a small idea shortlist and your next actions together. Everything you enter stays in this browser; export a backup before switching devices.", "My thesis workspace"));
    const bar = element("div", "tg-workspace-bar");
    const status = element("p", "tg-status", state.saveMessage || (state.saved ? "Your saved draft · this device" : "Start your personal working draft")); status.id = "tg-save-state"; status.setAttribute("role", "status");
    bar.append(status, button("Export backup", "tg-export-json", exportJSON), button("Download brief", "tg-export-brief", exportBrief), button("Print / PDF", "tg-print", () => { renderBrief(); window.print(); })); panel.appendChild(bar);
    const layout = element("div", "tg-planner-layout");
    const form = element("form", "tg-plan-form"); form.addEventListener("submit", (event) => event.preventDefault());
    const focus = element("div", "tg-field-grid");
    const trackLabel = element("label", "tg-field", "Workspace track focus"); const track = element("select"); track.id = "tg-plan-track";
    options(track, (state.cohort.tracks || []).map((item) => ({ value: item.id, label: item.name })), "Still exploring"); track.value = state.draft.trackId;
    track.addEventListener("change", () => { state.draft.trackId = track.value; state.draft.hostUniversity = ""; saveDraft(); renderHostOptions(); renderBrief(); });
    trackLabel.append(track, element("small", "", "This personal workspace focus does not change your saved study-plan track."));
    const hostLabel = element("label", "tg-field", "Possible thesis host"); const host = element("select"); host.id = "tg-plan-host";
    host.addEventListener("change", () => { state.draft.hostUniversity = host.value; saveDraft(); });
    hostLabel.append(host); focus.append(trackLabel, hostLabel); form.appendChild(focus);
    const hostNote = element("p", "tg-host-note"); hostNote.id = "tg-host-note"; form.appendChild(hostNote);
    if (state.tracksUnavailable) form.appendChild(button("Reload track details", "tg-reload-tracks", retryTracks));
    const fields = element("div", "tg-field-grid");
    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      const wrapper = element("label", `tg-field${["question", "data", "access", "notes"].includes(key) ? " tg-field-wide" : ""}`, label);
      const input = element(["topic", "population", "context", "outcome", "supervisor"].includes(key) ? "input" : "textarea");
      if (input.tagName === "INPUT") input.type = "text"; else input.rows = key === "notes" ? 4 : 3;
      input.id = `tg-field-${key}`; input.maxLength = ThesisGuideData.FIELD_LIMITS[key]; input.value = state.draft.fields[key];
      const help = element("small", "", FIELD_HELP[key]); help.id = `tg-help-${key}`; input.setAttribute("aria-describedby", help.id);
      input.addEventListener("input", () => { state.draft.fields[key] = input.value.slice(0, input.maxLength); saveDraft(); });
      wrapper.append(input, help); fields.appendChild(wrapper);
    }
    form.appendChild(fields);
    const seedContainer = element("div", "tg-studyplan-seed"); seedContainer.id = "tg-studyplan-seed"; form.appendChild(seedContainer);
    const aside = element("aside", "tg-plan-preview");
    aside.appendChild(element("h3", "", "Your working brief"));
    const preview = element("div", "tg-plan-brief"); preview.id = "tg-proposal-preview"; aside.appendChild(preview);
    aside.appendChild(progressNode());
    const next = element("p", "tg-source-note", "Bring a focused question and a realistic evidence plan to a supervisor. Treat this brief as a conversation starter, not an approved proposal."); aside.appendChild(next);
    const feasibility = element("div", "tg-feasibility tg-card");
    feasibility.appendChild(element("h4", "", "Before committing, discuss four questions"));
    const prompts = element("ul");
    ["Is the question precise enough to answer within this thesis?", "Can I obtain suitable evidence, with the required permissions, in time?", "Does the method support the claim I want to make?", "Have I discussed scope, supervision and a fallback with the appropriate academic contact?"].forEach((text) => prompts.appendChild(element("li", "", text)));
    feasibility.appendChild(prompts); aside.appendChild(feasibility);
    layout.append(form, aside); panel.appendChild(layout); renderHostOptions();
    const saved = element("section", "tg-saved-ideas"); saved.id = "tg-saved-ideas"; panel.appendChild(saved); renderSavedIdeas();
    const milestones = disclosure("My complete planning checklist", "Use these prompts at your own pace. Official approvals and deadlines must be confirmed separately.", []);
    for (const stage of state.guide.journey || []) { milestones.querySelector(".tg-disclosure-body").append(element("h4", "", stage.label), checklist(stage.checklist, "tg-plan-check")); }
    panel.appendChild(milestones);
    const restore = element("div", "tg-restore");
    const label = element("label", "tg-field", "Restore a workspace backup"); const file = element("input"); file.id = "tg-import"; file.type = "file"; file.accept = ".json,application/json"; file.addEventListener("change", () => { const selected = file.files?.[0]; file.value = ""; importJSON(selected); }); label.appendChild(file);
    const importStatus = element("p", "tg-status"); importStatus.id = "tg-import-status"; importStatus.setAttribute("role", "status");
    restore.append(label, importStatus, button("Reset thesis workspace", "tg-reset", resetDraft)); panel.appendChild(restore);
    renderBrief(); renderProgress();
  }
  function renderHostOptions() {
    const select = document.getElementById("tg-plan-host"); if (!select) return; select.replaceChildren();
    const track = currentTrack();
    options(select, (track?.thesis || []).map((id) => ({ value: id, label: state.cohort.universities?.[id]?.name || id })), "To confirm with the programme");
    select.value = state.draft.hostUniversity; select.disabled = !track || state.tracksUnavailable;
    const note = document.getElementById("tg-host-note");
    if (state.tracksUnavailable) note.textContent = "Current track details could not be loaded. Your saved host choice will be kept intact; reload those details before saving changes.";
    else if (track) note.textContent = "Semester 4 is at one of your track’s two universities. A choice here is a personal preference: confirm host allocation, supervision, registration and deadlines with the programme.";
    else note.textContent = "Choose a track focus to see its two thesis-host universities. Thesis planning can begin while you are still exploring.";
    renderSeedButton();
  }
  function renderBrief() {
    if (!state.draft) return;
    const preview = document.getElementById("tg-proposal-preview");
    if (preview) {
      preview.replaceChildren();
      preview.append(element("h4", "", state.draft.fields.topic || "Your topic is taking shape"), element("p", "tg-brief-question", state.draft.fields.question || "Start with one answerable research question."));
      preview.appendChild(topicDetails([["Study focus", [state.draft.fields.population, state.draft.fields.context].filter(Boolean).join(" · ") || "Population and setting to define"], ["Outcome / decision", state.draft.fields.outcome || "To define"], ["Method", state.draft.fields.method || "To discuss"], ["Evidence", state.draft.fields.data || "To identify"], ["Access / feasibility", state.draft.fields.access || "To check"], ["Next action", state.draft.fields.notes || "Choose one small next step."]]));
    }
    let print = document.getElementById("tg-print-summary");
    if (!print) { print = element("section", "tg-print-summary"); print.id = "tg-print-summary"; print.hidden = true; document.querySelector("main")?.appendChild(print); }
    print.replaceChildren(element("h1", "", "My thesis — working brief"));
    const text = element("pre", "", ThesisGuideData.briefText(state.draft, state.cohort, state.guide)); print.appendChild(text);
  }
  function renderSavedIdeas() {
    const container = document.getElementById("tg-saved-ideas"); if (!container) return; container.replaceChildren();
    container.appendChild(sectionHead("Your idea shortlist", "Saving an idea collects it here; using it in your brief is a separate choice."));
    if (!state.draft.savedIdeas.length) { container.appendChild(element("p", "tg-empty", "No saved ideas yet. Explore the topic prompts and keep the questions that interest you.")); container.appendChild(button("Find a topic →", "", () => showView("topics", { scroll: true }))); return; }
    const grid = element("div", "tg-panel-grid");
    for (const id of state.draft.savedIdeas) {
      const idea = state.guide.topics.find((item) => item.id === id); if (!idea) continue;
      const card = element("article", "tg-saved-card tg-card"); card.append(element("h3", "", idea.title), element("p", "", idea.question));
      const actions = element("div", "tg-card-actions");
      actions.append(button("Use in my brief", "", () => {
        if ((state.draft.fields.topic || state.draft.fields.question) && !window.confirm("Replace the topic, research question, method and evidence in your current brief with this prompt?")) return;
        Object.assign(state.draft.fields, { topic: idea.title, question: idea.question, method: idea.methods.join("; "), data: idea.dataIdea });
        saveDraft(); renderPlanner(); showView("planner"); document.getElementById("tg-field-question")?.focus(); notify("Prompt copied into your working brief. Adapt it to your project.");
      }), button("Remove idea", "", () => {
        state.draft.savedIdeas = state.draft.savedIdeas.filter((saved) => saved !== id); saveDraft(); renderSavedIdeas(); renderTopicCards();
        const next = document.querySelector("#tg-saved-ideas [data-remove-idea]") || document.querySelector("#tg-saved-ideas h2");
        if (next) { if (next.tagName === "H2") next.tabIndex = -1; next.focus({ preventScroll: true }); }
      }));
      actions.firstElementChild.dataset.useIdea = id; actions.lastElementChild.dataset.removeIdea = id; card.appendChild(actions); grid.appendChild(card);
    }
    container.appendChild(grid);
  }
  function studyPlanSeed() {
    const plan = readStorage("euhem-study-journey-v1", null);
    const preference = loadMyTrack();
    const track = state.draft.trackId || (preference?.cohort === state.cohort.id && state.cohort.tracks.some((item) => item.id === preference.track) ? preference.track : "");
    return plan?.cohort === state.cohort.id && typeof plan.tracks?.[track]?.thesisTopic === "string" ? plan.tracks[track].thesisTopic.trim() : "";
  }
  function renderSeedButton() {
    const container = document.getElementById("tg-studyplan-seed"); if (!container) return; container.replaceChildren();
    if (!studyPlanSeed()) return;
    container.appendChild(button("Use my study-plan thesis idea", "tg-seed-studyplan", () => {
      const idea = studyPlanSeed(); if (!idea) return;
      if (state.draft.fields.topic && !window.confirm("Replace your workspace working topic with the idea from your Study Plan?")) return;
      state.draft.fields.topic = idea.slice(0, ThesisGuideData.FIELD_LIMITS.topic); document.getElementById("tg-field-topic").value = state.draft.fields.topic; saveDraft();
      notify("Working topic copied. Your Study Plan has not changed.");
    }));
  }
  function download(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = element("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportJSON() {
    const clean = ThesisGuideData.sanitizeDraft(state.draft, state.guide, state.cohort);
    if (state.tracksUnavailable && state.rawDraft?.version === 1 && state.rawDraft.cohort === clean.cohort) {
      clean.trackId = typeof state.rawDraft.trackId === "string" ? state.rawDraft.trackId.slice(0, 20) : "";
      clean.hostUniversity = typeof state.rawDraft.hostUniversity === "string" ? state.rawDraft.hostUniversity.slice(0, 20) : "";
    }
    download(JSON.stringify(ThesisGuideData.exportBackup(clean), null, 2), "application/json", "euhem-thesis-workspace.json"); notify("Workspace backup downloaded. Keep it somewhere private.");
  }
  function exportBrief() { download(ThesisGuideData.briefText(state.draft, state.cohort, state.guide), "text/plain;charset=utf-8", "euhem-thesis-working-brief.txt"); notify("Working brief downloaded"); }
  async function importJSON(file) {
    if (!file) return;
    const status = document.getElementById("tg-import-status");
    try {
      if (state.tracksUnavailable) throw new Error("Reload track details before restoring a workspace backup.");
      if (file.size > 1048576) throw new Error("Choose a workspace backup smaller than 1 MB.");
      const next = ThesisGuideData.importBackup(JSON.parse(await file.text()), state.guide, state.cohort);
      if (!window.confirm("Replace this thesis workspace with the selected backup? Your Study Plan will stay unchanged.")) { status.textContent = "Restore cancelled. Your workspace is unchanged."; return; }
      state.draft = next; const saved = saveDraft(); renderRoadmap(); renderPlanner(); renderTopicCards();
      document.getElementById("tg-import-status").textContent = saved ? "Backup restored and saved on this device." : "Backup restored in this tab; device storage is unavailable.";
      document.getElementById("tg-field-topic")?.focus();
    } catch (error) { status.textContent = error instanceof SyntaxError ? "This file is not valid JSON. Choose a thesis-workspace backup." : error.message; }
  }
  function resetDraft() {
    if (!window.confirm("Clear your thesis workspace, saved ideas and checklist on this device? Your Study Plan will stay unchanged.")) return;
    state.rawDraft = null;
    state.draft = ThesisGuideData.sanitizeDraft(null, state.guide, state.cohort);
    const saved = saveDraft(); renderRoadmap(); renderPlanner(); renderTopicCards();
    document.getElementById("tg-field-topic")?.focus();
    notify(saved ? "Thesis workspace reset" : "Thesis workspace reset in this tab; device storage is unavailable.");
  }
  async function readJSON(url) {
    const response = await fetch(url); if (!response.ok) throw new Error(`${url} could not be loaded`); return response.json();
  }
  function validTracksCohort(file) {
    if (!Array.isArray(file?.cohorts) || !file.cohorts.length) return null;
    const cohort = tracksCohort(file);
    return cohort && typeof cohort.id === "string" && Array.isArray(cohort.tracks) &&
      cohort.tracks.every((track) => typeof track.id === "string" && Array.isArray(track.thesis)) &&
      cohort.universities && typeof cohort.universities === "object" ? cohort : null;
  }
  async function retryTracks() {
    const control = document.getElementById("tg-reload-tracks"); if (control) { control.disabled = true; control.textContent = "Loading track details…"; }
    try {
      const file = await readJSON("content/tracks.json"); const cohort = validTracksCohort(file);
      if (!cohort) throw new Error("Track details are incomplete");
      state.cohort = cohort; state.tracksUnavailable = false;
      const previous = state.rawDraft?.version === 1 && state.rawDraft.cohort === cohort.id ? state.rawDraft : null;
      const shared = loadMyTrack();
      const preference = !previous && shared?.cohort === cohort.id && cohort.tracks.some((track) => track.id === shared.track) ? shared.track : "";
      const draft = { ...state.draft, trackId: state.draft.trackId || previous?.trackId || preference, hostUniversity: state.draft.hostUniversity || previous?.hostUniversity || "" };
      state.draft = ThesisGuideData.sanitizeDraft(draft, state.guide, cohort); saveDraft(); renderTopics(); renderPlanner();
    } catch { if (control) { control.disabled = false; control.textContent = "Reload track details"; } notify("Track details are still unavailable. Your changes stay in this tab."); }
  }
  async function loadGuide() {
    const status = document.getElementById("tg-guide-status"); if (status) { status.replaceChildren(document.createTextNode("Loading your thesis guide…")); status.hidden = state.view === "archive"; }
    const results = await Promise.allSettled([readJSON("content/thesis-guide.json"), readJSON("content/tracks.json")]);
    if (results[0].status !== "fulfilled" || results[0].value.schemaVersion !== 1 || !Array.isArray(results[0].value.journey) || !results[0].value.journey.length || !Array.isArray(results[0].value.topics)) {
      if (status) { status.replaceChildren(element("p", "", "The thesis guide could not be loaded. The historical archive is available in Past topics."), button("Retry guide", "tg-retry", loadGuide)); status.hidden = state.view === "archive"; }
      return;
    }
    state.guide = results[0].value;
    const cohort = results[1].status === "fulfilled" ? validTracksCohort(results[1].value) : null;
    state.tracksUnavailable = !cohort;
    state.cohort = cohort || { id: "2026-2028", tracks: [], universities: {} };
    state.rawDraft = readStorage(ThesisGuideData.DRAFT_KEY, null);
    state.draft = ThesisGuideData.sanitizeDraft(state.rawDraft, state.guide, state.cohort);
    state.saved = !!state.rawDraft && state.rawDraft.version === 1 && state.rawDraft.cohort === state.cohort.id;
    const shared = loadMyTrack();
    const preferred = shared?.cohort === state.cohort.id && state.cohort.tracks.some((item) => item.id === shared.track) ? shared.track : "";
    state.trackFilter = preferred;
    if (!state.rawDraft) state.draft.trackId = preferred;
    renderRoadmap(); renderTopics(); renderToolkit(); renderPlanner();
    let provenance = document.getElementById("tg-guide-provenance");
    if (!provenance) { provenance = element("p", "tg-source-note"); provenance.id = "tg-guide-provenance"; document.getElementById("thesis-guide")?.appendChild(provenance); }
    provenance.textContent = `${state.guide.disclaimer} Sources reviewed ${state.guide.verifiedAt}.`;
    if (status) status.hidden = true;
    showView(state.view, { updateHash: false });
  }
  window.ThesisGuide = { showView };
  bindNavigation();
  loadGuide();
})();
