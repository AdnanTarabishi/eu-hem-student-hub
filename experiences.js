(function () {
  "use strict";

  // Prevent native GET submission even if later initialization fails.
  const contributionForm = document.getElementById("ex-form");
  let contributionHandler = null;
  if (contributionForm) contributionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (contributionHandler) contributionHandler();
  });

  const DATA = window.EUHEM_EXPERIENCES;
  if (!DATA) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const savedKey = "euhemExperienceSavedV1";
  const draftKey = "euhemExperienceDraftV2";
  const state = { q: "", city: "", track: "", topic: "", stage: "", sort: "featured", saved: false, view: "grid" };

  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }

  function safeSavedIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(savedKey) || "[]");
      return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
    } catch (_) {
      return [];
    }
  }

  function writeSaved(ids) {
    try { localStorage.setItem(savedKey, JSON.stringify(ids)); } catch (_) {}
  }

  function toggleSaved(id) {
    const set = new Set(safeSavedIds());
    if (set.has(id)) set.delete(id); else set.add(id);
    writeSaved(Array.from(set));
    renderLibrary();
  }

  function formatDate(value) {
    if (!value) return "Date not shown";
    const date = new Date(value + "T12:00:00");
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function trackName(id) { return id && DATA.tracks[id] ? DATA.tracks[id] : ""; }
  function cityName(id) { return id && DATA.cities[id] ? DATA.cities[id].name : ""; }
  function topicName(id) { return id && DATA.topics[id] ? DATA.topics[id] : id; }

  function readUrlState() {
    const p = new URLSearchParams(location.search);
    state.q = (p.get("q") || "").slice(0, 180);
    state.city = DATA.cities[p.get("city")] ? p.get("city") : "";
    state.track = DATA.tracks[p.get("track")] ? p.get("track") : "";
    state.topic = DATA.topics[p.get("topic")] ? p.get("topic") : "";
    state.stage = ["student", "alumni"].includes(p.get("stage")) ? p.get("stage") : "";
    state.sort = ["featured", "recent", "name"].includes(p.get("sort")) ? p.get("sort") : "featured";
    state.saved = p.get("saved") === "1";
    state.view = p.get("view") === "list" ? "list" : "grid";
  }

  function syncControls() {
    $("#ex-search").value = state.q;
    $("#ex-city").value = state.city;
    $("#ex-track").value = state.track;
    $("#ex-topic").value = state.topic;
    $("#ex-stage").value = state.stage;
    $("#ex-sort").value = state.sort;
    const savedButton = $("#ex-saved-toggle");
    savedButton.setAttribute("aria-pressed", String(state.saved));
    savedButton.classList.toggle("is-active", state.saved);
    $("#ex-saved-count").textContent = String(safeSavedIds().length);
    ["grid", "list"].forEach((view) => $("#ex-view-" + view).setAttribute("aria-pressed", String(state.view === view)));
    $("#ex-grid").classList.toggle("is-list", state.view === "list");
  }

  function updateUrl(extra) {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.city) p.set("city", state.city);
    if (state.track) p.set("track", state.track);
    if (state.topic) p.set("topic", state.topic);
    if (state.stage) p.set("stage", state.stage);
    if (state.sort !== "featured") p.set("sort", state.sort);
    if (state.saved) p.set("saved", "1");
    if (state.view === "list") p.set("view", "list");
    if (extra && extra.story) p.set("story", extra.story);
    const query = p.toString();
    history.replaceState(null, "", "experiences.html" + (query ? "?" + query : "") + (extra && extra.hash ? extra.hash : ""));
  }

  function searchable(story) {
    return [
      story.title, story.author, story.publisher, story.summary, story.context,
      story.stageLabel, story.periodLabel, trackName(story.track),
      ...(story.cities || []).map(cityName),
      ...(story.topics || []).map(topicName),
      ...(story.takeaways || [])
    ].join(" ").toLowerCase();
  }

  function filteredStories() {
    const saved = new Set(safeSavedIds());
    const words = state.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let rows = DATA.stories.filter((story) => {
      const haystack = searchable(story);
      return (!words.length || words.every((w) => haystack.includes(w))) &&
        (!state.city || story.cities.includes(state.city)) &&
        (!state.track || story.track === state.track) &&
        (!state.topic || story.topics.includes(state.topic)) &&
        (!state.stage || story.stage === state.stage) &&
        (!state.saved || saved.has(story.id));
    });
    if (state.sort === "name") rows.sort((a, b) => a.author.localeCompare(b.author));
    if (state.sort === "recent") rows.sort((a, b) => (b.sourceDate || "").localeCompare(a.sourceDate || ""));
    if (state.sort === "featured") rows.sort((a, b) => Number(b.featured) - Number(a.featured) || (b.sourceDate || "").localeCompare(a.sourceDate || ""));
    return rows;
  }

  function tag(text, extra) {
    return node("span", "ex-tag" + (extra ? " " + extra : ""), text);
  }

  function storyPicture(story, className, eager) {
    if (!story.image) return null;
    const picture = node("picture", className || "");
    const img = node("img");
    img.src = story.image.small || story.image.large;
    if (story.image.small && story.image.large && story.image.small !== story.image.large) {
      img.srcset = story.image.small + " 640w, " + story.image.large + " 1200w";
      img.sizes = className && className.includes("feature") ? "(max-width: 780px) 100vw, 44vw" :
        className && className.includes("dialog") ? "(max-width: 760px) 100vw, 850px" :
        "(max-width: 650px) 100vw, 50vw";
    }
    img.alt = story.image.alt || "";
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    img.width = 800; img.height = 500;
    if (eager) img.fetchPriority = "high";
    picture.appendChild(img);
    return picture;
  }

  function imageFigure(story, className, eager) {
    const figure = node("figure", className);
    const picture = storyPicture(story, className + "-picture", eager);
    if (picture) figure.appendChild(picture);
    if (story.image && story.image.credit) {
      figure.appendChild(node("figcaption", "ex-image-credit", story.image.credit));
    }
    return figure;
  }

  function buildCard(story) {
    const article = node("article", "ex-card");
    article.dataset.storyId = story.id;

    const media = imageFigure(story, "ex-card-media", false);
    const tags = node("div", "ex-tags");
    tags.appendChild(tag(story.stageLabel, "ex-tag-brand"));
    if (story.track) tags.appendChild(tag(trackName(story.track), "ex-tag-track"));
    if (story.cities.length) tags.appendChild(tag(cityName(story.cities[story.cities.length - 1])));
    media.appendChild(tags);

    const body = node("div", "ex-card-body");
    body.appendChild(node("h3", "", story.title));
    const byline = node("p", "ex-byline");
    byline.appendChild(document.createTextNode(story.author));
    byline.appendChild(node("span", "", " · " + story.publisher));
    body.appendChild(byline);
    body.appendChild(node("p", "ex-card-summary", story.summary));

    const footer = node("div", "ex-card-footer");
    footer.appendChild(node("small", "", story.sourceDate ? formatDate(story.sourceDate) : story.periodLabel));
    const action = node("div", "");
    const save = node("button", "ex-link-button", safeSavedIds().includes(story.id) ? "Saved" : "Save");
    save.type = "button";
    save.setAttribute("aria-pressed", String(safeSavedIds().includes(story.id)));
    save.addEventListener("click", (event) => { event.stopPropagation(); toggleSaved(story.id); });
    const open = node("button", "ex-link-button", "Read overview →");
    open.type = "button";
    open.style.marginLeft = "12px";
    open.addEventListener("click", () => openStory(story.id));
    action.append(save, open);
    footer.appendChild(action);
    body.appendChild(footer);
    article.append(media, body);
    return article;
  }

  function renderActiveFilters() {
    const box = $("#ex-active-filters");
    box.replaceChildren();
    const items = [];
    if (state.q) items.push(["q", "Search: " + state.q]);
    if (state.city) items.push(["city", cityName(state.city)]);
    if (state.track) items.push(["track", trackName(state.track)]);
    if (state.topic) items.push(["topic", topicName(state.topic)]);
    if (state.stage) items.push(["stage", state.stage === "alumni" ? "Alumni perspective" : "Student perspective"]);
    if (state.saved) items.push(["saved", "Saved stories"]);
    for (const [key, label] of items) {
      const button = node("button", "ex-filter-chip", label + " ×");
      button.type = "button";
      button.addEventListener("click", () => {
        if (key === "saved") state.saved = false; else state[key] = "";
        syncControls(); renderLibrary();
      });
      box.appendChild(button);
    }
    if (items.length) {
      const clear = node("button", "ex-filter-chip", "Clear all");
      clear.type = "button";
      clear.addEventListener("click", resetFilters);
      box.appendChild(clear);
    }
  }

  function renderLibrary() {
    const rows = filteredStories();
    const grid = $("#ex-grid");
    grid.replaceChildren();
    if (!rows.length) {
      const empty = node("div", "ex-empty");
      empty.append(node("h3", "", state.saved ? "No saved stories match these filters." : "No stories match yet."));
      empty.append(node("p", "", state.saved ? "Turn off Saved or remove another filter." : "Try a broader search, another city or a different topic."));
      grid.appendChild(empty);
    } else {
      rows.forEach((story) => grid.appendChild(buildCard(story)));
    }
    $("#ex-result-count").textContent = rows.length + " experience" + (rows.length === 1 ? "" : "s") + " in this view";
    $("#ex-saved-count").textContent = String(safeSavedIds().length);
    renderActiveFilters();
    updateUrl();
  }

  function resetFilters() {
    Object.assign(state, { q: "", city: "", track: "", topic: "", stage: "", sort: "featured", saved: false });
    syncControls();
    renderLibrary();
  }

  function populateSelects() {
    const city = $("#ex-city");
    Object.entries(DATA.cities).forEach(([id, info]) => {
      const option = node("option", "", info.name);
      option.value = id; city.appendChild(option);
    });
    const track = $("#ex-track");
    Object.entries(DATA.tracks).forEach(([id, label]) => {
      const option = node("option", "", label);
      option.value = id; track.appendChild(option);
    });
    const topic = $("#ex-topic");
    Object.entries(DATA.topics).forEach(([id, label]) => {
      const option = node("option", "", label);
      option.value = id; topic.appendChild(option);
    });
  }

  function renderFeatured() {
    const story = DATA.stories.find((s) => s.featured) || DATA.stories[0];
    if (!story) return;
    $("#ex-feature-title").textContent = story.title;
    $("#ex-feature-author").textContent = story.author + " · " + story.publisher;
    $("#ex-feature-summary").textContent = story.summary;
    const meta = $("#ex-feature-meta");
    meta.replaceChildren(tag(story.stageLabel, "ex-tag-brand"));
    if (story.track) meta.appendChild(tag(trackName(story.track), "ex-tag-track"));
    story.cities.forEach((id) => meta.appendChild(tag(cityName(id))));

    const panel = $(".ex-feature-panel");
    panel.replaceChildren(imageFigure(story, "ex-feature-media", true));

    $("#ex-feature-open").addEventListener("click", () => openStory(story.id));
  }

  function openStory(id) {
    const story = DATA.stories.find((s) => s.id === id);
    if (!story) return;
    $("#ex-dialog-kicker").textContent = story.stageLabel + " · " + story.publisher;
    $("#ex-dialog-title").textContent = story.title;
    $("#ex-dialog-author").textContent = story.author;
    $("#ex-dialog-summary").textContent = story.summary;

    const dialogMedia = $("#ex-dialog-media");
    dialogMedia.replaceChildren();
    const dialogPicture = storyPicture(story, "ex-dialog-picture", false);
    if (dialogPicture) dialogMedia.appendChild(dialogPicture);
    if (story.image && story.image.credit) {
      dialogMedia.appendChild(node("figcaption", "ex-image-credit", story.image.credit));
    }

    const facts = $("#ex-at-glance");
    facts.replaceChildren();
    const factData = [
      ["Perspective", story.stageLabel],
      ["Track", story.track ? trackName(story.track) : "Not stated in source"],
      ["Cities covered", story.cities.length ? story.cities.map(cityName).join(", ") : "Not specified"],
      ["Time context", story.periodLabel]
    ];
    factData.forEach(([label, value]) => {
      const box = node("div", "ex-fact");
      box.append(node("small", "", label), node("strong", "", value));
      facts.appendChild(box);
    });

    const topics = $("#ex-dialog-topics");
    topics.replaceChildren();
    story.topics.forEach((id) => topics.appendChild(tag(topicName(id))));

    const list = $("#ex-dialog-takeaways");
    list.replaceChildren();
    story.takeaways.forEach((text) => list.appendChild(node("li", "", text)));
    $("#ex-dialog-context").textContent = story.context;
    $("#ex-dialog-source-label").textContent = story.sourceLabel;
    $("#ex-dialog-source").href = story.sourceUrl;

    const save = $("#ex-dialog-save");
    const refreshSave = () => {
      const yes = safeSavedIds().includes(story.id);
      save.textContent = yes ? "Saved to this device" : "Save this story";
      save.setAttribute("aria-pressed", String(yes));
    };
    refreshSave();
    save.onclick = () => { toggleSaved(story.id); refreshSave(); };

    const dialog = $("#ex-story-dialog");
    updateUrl({ story: story.id, hash: "#stories" });
    if (!dialog.open) dialog.showModal();
  }

  function closeStory() {
    const dialog = $("#ex-story-dialog");
    if (dialog.open) dialog.close();
    updateUrl({ hash: "#stories" });
  }

  /* Contribution form */
  const formState = { step: 0, receivedSignature: "", receivedMessage: "", receivedReceipt: "" };
  const stepNames = ["About your experience", "Your journey", "Main advice", "Useful details", "Preview & privacy"];

  function formData() {
    return Object.fromEntries(new FormData($("#ex-form")).entries());
  }

  function journeyData() {
    const result = {};
    Object.keys(DATA.cities).forEach((city) => {
      result[city] = $("#journey-" + city).value;
    });
    return result;
  }

  function selectedTopics() {
    return $$('input[name="topics"]:checked', $("#ex-form")).map((x) => x.value);
  }

  function validateStep(step) {
    updateNameRequirement();
    const section = $('.ex-form-step[data-step="' + step + '"]');
    for (const field of $$("input, select, textarea", section)) {
      if (field.disabled) continue;
      field.setCustomValidity("");
      if (field.type !== "checkbox" && field.type !== "file") {
        const value = field.value.trim();
        if (field.required && !value) field.setCustomValidity("Please complete this question.");
        else if (value && field.minLength > 0 && value.length < field.minLength) field.setCustomValidity("Please write at least " + field.minLength + " characters.");
        else if (field.maxLength > 0 && field.value.length > field.maxLength) field.setCustomValidity("Please use " + field.maxLength + " characters or fewer.");
      }
      if (!field.checkValidity()) {
        if (section.hidden) setStep(step, true);
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    if (step === 1) {
      const lived = Object.values(journeyData()).some((status) => status === "completed" || status === "in_progress");
      if (!lived) {
        formMessage("Mark at least one city as Completed or In progress. Planned cities do not count as lived experience.");
        $("#journey-bologna").focus();
        return false;
      }
    }
    if (step === 3 && !selectedTopics().length) {
      formMessage("Choose at least one topic you can help another student with.");
      const first = $('input[name="topics"]', section);
      if (first) first.focus();
      return false;
    }
    formMessage("");
    return true;
  }

  function formMessage(text, success) {
    const box = $("#ex-form-message");
    box.textContent = text || "";
    box.style.color = success ? "var(--success)" : "";
  }

  function setStep(next, focusHeading) {
    formState.step = Math.max(0, Math.min(4, next));
    $$(".ex-form-step").forEach((step, i) => {
      step.classList.toggle("is-active", i === formState.step);
      step.hidden = i !== formState.step;
    });
    $$(".ex-progress span").forEach((bar, i) => {
      bar.classList.toggle("is-active", i === formState.step);
      bar.classList.toggle("is-done", i < formState.step);
    });
    $("#ex-step-label").textContent = "Step " + (formState.step + 1) + " of 5 · " + stepNames[formState.step];
    $("#ex-form-back").disabled = formState.step === 0;
    $("#ex-form-next").hidden = formState.step === 4;
    if (formState.step === 4) renderPreview();
    if (focusHeading) {
      const heading = $('.ex-form-step[data-step="' + formState.step + '"] h3');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  function serializeDraft() {
    const data = formData();
    data.topics = selectedTopics();
    data.journey = journeyData();
    delete data.replyEmail;
    delete data.reviewConsent;
    delete data.website;
    return { version: 2, savedAt: new Date().toISOString(), data };
  }

  function applyDraft(payload) {
    if (!payload || payload.version !== 2 || !payload.data || Array.isArray(payload.data) || typeof payload.data !== "object") throw new Error("Unsupported draft");
    const data = payload.data;
    const clean = {};
    Object.entries(data).forEach(([name, value]) => {
      if (["topics", "journey", "replyEmail", "reviewConsent", "website"].includes(name)) return;
      const field = $("#ex-form").elements[name];
      if (!field || !["INPUT", "TEXTAREA", "SELECT"].includes(field.tagName)) return;
      if (typeof value !== "string" || (field.maxLength > 0 && value.length > field.maxLength)) throw new Error("Invalid draft field");
      const migrated = name === "audience" && value === "members" ? "unpublished" : name === "formTrack" && value === "Health Economics & Policy" ? "Health Economics & Policy (earlier track name)" : value;
      if (field.tagName === "SELECT" && !Array.from(field.options).some((option) => option.value === migrated)) throw new Error("Invalid draft choice");
      clean[name] = migrated;
    });
    if (data.topics !== undefined && (!Array.isArray(data.topics) || data.topics.some((id) => !Object.hasOwn(DATA.topics, id)))) throw new Error("Invalid draft topics");
    if (data.journey !== undefined && (!data.journey || Array.isArray(data.journey) || typeof data.journey !== "object" || Object.entries(data.journey).some(([city, status]) => !Object.hasOwn(DATA.cities, city) || !["", "completed", "in_progress", "planned"].includes(status)))) throw new Error("Invalid draft journey");
    $("#ex-form").reset();
    Object.entries(clean).forEach(([name, value]) => { $("#ex-form").elements[name].value = value; });
    if (Array.isArray(data.topics)) {
      $$('input[name="topics"]').forEach((box) => { box.checked = data.topics.includes(box.value); });
    }
    if (data.journey && typeof data.journey === "object") {
      Object.keys(DATA.cities).forEach((city) => {
        const select = $("#journey-" + city);
        const value = data.journey[city];
        if (["", "completed", "in_progress", "planned"].includes(value)) select.value = value;
      });
    }
    updateTopicDetails();
    updateNameRequirement();
    renderPreview();
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey, JSON.stringify(serializeDraft()));
      formMessage("Draft saved on this device. It has not been submitted.", true);
      showDraftNotice();
    } catch (_) {
      formMessage("This browser could not save the draft.");
    }
  }

  function downloadDraft() {
    const blob = new Blob([JSON.stringify(serializeDraft(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "euhem-student-experience-draft.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function importDraft(file) {
    if (!file || file.size > 100000) return formMessage("That draft file is too large.");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        applyDraft(parsed);
        formMessage("Draft imported. Review every field before using it.", true);
      } catch (_) {
        formMessage("That file is not a valid Student Experiences draft.");
      }
    };
    reader.readAsText(file);
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey); } catch (_) {}
    $("#ex-draft-note").hidden = true;
    formMessage("Saved draft cleared from this device.", true);
  }

  function showDraftNotice() {
    try { $("#ex-draft-note").hidden = !localStorage.getItem(draftKey); } catch (_) { $("#ex-draft-note").hidden = true; }
  }

  function updateTopicDetails() {
    const selected = new Set(selectedTopics());
    $$(".ex-topic-detail").forEach((field) => {
      const active = selected.has(field.dataset.topicDetail);
      field.classList.toggle("is-active", active);
      const textarea = $("textarea", field);
      if (textarea) textarea.disabled = !active;
    });
  }

  function publicDisplayName(data) {
    if (data.nameMode === "anonymous") return "Name not shared";
    if (data.nameMode === "first") return (data.displayName || "First name").trim().split(/\s+/)[0];
    if (data.nameMode === "display") return (data.displayName || "Display name").trim();
    return (data.displayName || "Name to be confirmed").trim();
  }

  function updateNameRequirement() {
    const form = $("#ex-form");
    const required = form.elements.nameMode.value !== "anonymous";
    form.elements.displayName.required = required;
    form.elements.displayName.setCustomValidity("");
    form.elements.displayName.closest("label").querySelector("span").textContent = required ? "Name or display name *" : "Name or display name · not needed";
  }

  function renderPreview() {
    const data = formData();
    const preview = $("#ex-preview");
    preview.replaceChildren();

    const card = node("article", "ex-preview-card");
    const top = node("div", "ex-preview-top");
    top.appendChild(tag(data.audience === "public" ? "Publication preference preview" : "Private review", "ex-tag-brand"));
    const body = node("div", "ex-preview-body");
    body.appendChild(node("h4", "", data.title || "Your experience title"));
    const meta = [];
    meta.push(publicDisplayName(data));
    const journey = journeyData();
    const lived = Object.entries(journey).filter(([, status]) => status === "completed" || status === "in_progress").map(([city]) => cityName(city));
    if (lived.length) meta.push(lived.join(", "));
    if (data.showCohort === "yes" && data.cohort) meta.push("Cohort " + data.cohort);
    if (data.showBackground === "yes" && data.background) meta.push(data.background);
    if (data.period) meta.push(data.period);
    body.appendChild(node("p", "ex-byline", meta.join(" · ")));
    body.appendChild(node("p", "", data.story || "Your main advice will appear here."));

    const tips = node("ol", "ex-takeaways");
    [data.tip1, data.tip2, data.tip3].filter(Boolean).forEach((tipText) => tips.appendChild(node("li", "", tipText)));
    if (tips.children.length) body.appendChild(tips);
    [["What surprised me", data.surprise], ["What I would approach differently", data.different], ...selectedTopics().map((id) => [topicName(id), data["detail_" + id]])].forEach(([label, answer]) => {
      if (!answer || !answer.trim()) return;
      body.appendChild(node("h5", "", label));
      body.appendChild(node("p", "", answer));
    });

    const chosen = selectedTopics();
    if (chosen.length) {
      const labels = node("div", "ex-tags");
      chosen.forEach((id) => labels.appendChild(tag(topicName(id))));
      body.appendChild(labels);
    }
    card.append(top, body);
    preview.appendChild(card);

    const privacy = $("#ex-preview-privacy");
    const hidden = ["reply email", data.showCohort === "yes" ? "" : "cohort", data.showBackground === "yes" ? "" : "previous field"].filter(Boolean);
    privacy.textContent = "Excluded from a future public story preview: " + hidden.join(", ") + ". All answers and preferences are sent privately for review. You approve any final public wording separately.";
    updateSubmissionCount();
  }

  function submissionValues() {
    return { data: formData(), journey: journeyData(), topics: selectedTopics() };
  }

  function submissionSignature(values) {
    return JSON.stringify([window.ExperienceSubmission.buildMessage(values.data, values.journey, values.topics, DATA), (values.data.replyEmail || "").trim()]);
  }

  function updateSubmissionCount() {
    if (!window.ExperienceSubmission) return;
    const values = submissionValues();
    const count = window.ExperienceSubmission.buildMessage(values.data, values.journey, values.topics, DATA).length;
    $("#ex-submission-count").textContent = count.toLocaleString("en-GB") + " / 5,000 characters including context and labels." + (count > 5000 ? " Shorten your contribution by at least " + (count - 5000).toLocaleString("en-GB") + " characters before sending. Your answers have not been cut." : " Optional topic details can be left blank.");
    const warning = window.ExperienceSubmission.getWarning(values, DATA);
    if (warning) {
      $("#ex-submit-status").textContent = warning;
      $("#ex-submit-receipt").hidden = true;
    } else if (formState.receivedSignature) {
      const unchanged = submissionSignature(values) === formState.receivedSignature;
      $("#ex-submit-status").textContent = unchanged ? formState.receivedMessage : "You changed your answers after the confirmed contribution. These edited answers have not been sent.";
      $("#ex-submit-receipt").hidden = !unchanged;
      if (unchanged) $("#ex-submit-receipt").textContent = formState.receivedReceipt;
    }
  }

  async function submitExperience() {
    if (formState.step !== 4) {
      formMessage("Continue through the questions and review your answers before sending.");
      return;
    }
    for (let step = 0; step < 5; step++) {
      if (!validateStep(step)) { setStep(step, true); return; }
    }
    const button = $("#ex-submit");
    if (button.disabled || !window.ExperienceSubmission?.isConfigured()) return;
    const values = submissionValues();
    const fields = $("#ex-form-fields");
    fields.disabled = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    $("#ex-submit-status").textContent = "Sending your contribution…";
    $("#ex-submit-receipt").hidden = true;
    try {
      const result = await window.ExperienceSubmission.send(values, DATA);
      $("#ex-submit-status").textContent = result.message + (result.fieldErrors ? " " + Object.values(result.fieldErrors).join(" ") : "");
      for (const [name, message] of Object.entries(result.fieldErrors || {})) {
        const field = $("#ex-form").elements[name];
        if (field && field.setCustomValidity) {
          field.setCustomValidity(message);
          field.setAttribute("aria-invalid", "true");
        }
      }
      if (result.ok && result.receipt) {
        const receipt = $("#ex-submit-receipt");
        const time = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(result.receipt.receivedAt));
        receipt.textContent = "Reference: " + result.receipt.receiptId + " · Received " + time + " (Rome time). This confirms private storage, not publication or a reply.";
        receipt.hidden = false;
        formState.receivedSignature = submissionSignature(values);
        formState.receivedMessage = result.message;
        formState.receivedReceipt = receipt.textContent;
      }
    } catch (_) {
      $("#ex-submit-status").textContent = "Receipt could not be confirmed. Your contribution may have arrived; your answers remain here. Retry unchanged answers to check receipt safely.";
    } finally {
      fields.disabled = false;
      button.disabled = false;
      button.removeAttribute("aria-busy");
      $("#ex-submit-status").focus({ preventScroll: true });
    }
  }

  function initForm() {
    $("#ex-form-next").addEventListener("click", () => {
      if (!validateStep(formState.step)) return;
      setStep(formState.step + 1, true);
      $("#share-experience").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#ex-form-back").addEventListener("click", () => {
      setStep(formState.step - 1, true);
      $("#share-experience").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $$('input[name="topics"]').forEach((box) => box.addEventListener("change", updateTopicDetails));
    ["nameMode", "displayName", "audience", "showCohort", "showBackground", "cohort", "background", "period", "title", "story", "tip1", "tip2", "tip3"].forEach((name) => {
      const field = $("#ex-form").elements[name];
      if (field) field.addEventListener("input", () => { if (formState.step === 4) renderPreview(); });
    });
    Object.keys(DATA.cities).forEach((city) => $("#journey-" + city).addEventListener("change", () => { if (formState.step === 4) renderPreview(); }));
    $("#ex-save-draft").addEventListener("click", saveDraft);
    $("#ex-download-draft").addEventListener("click", downloadDraft);
    $("#ex-import-draft").addEventListener("click", () => $("#ex-import-file").click());
    $("#ex-import-file").addEventListener("change", (event) => { importDraft(event.target.files && event.target.files[0]); event.target.value = ""; });
    $("#ex-restore-draft").addEventListener("click", () => {
      try { applyDraft(JSON.parse(localStorage.getItem(draftKey) || "null")); formMessage("Draft restored. Review it before continuing.", true); }
      catch (_) { formMessage("The saved draft could not be restored."); }
    });
    $("#ex-clear-draft").addEventListener("click", clearDraft);
    $("#ex-preview-refresh").addEventListener("click", renderPreview);
    $("#ex-form").addEventListener("input", (event) => {
      if (event.target.setCustomValidity) event.target.setCustomValidity("");
      event.target.removeAttribute("aria-invalid");
      updateNameRequirement();
      if (formState.step === 4) renderPreview(); else updateSubmissionCount();
    });
    contributionHandler = submitExperience;
    showDraftNotice();
    updateTopicDetails();
    setStep(0);
    updateNameRequirement();
    $("#ex-form-fields").disabled = false;
    $("#ex-submit").disabled = !window.ExperienceSubmission?.isConfigured();
    if ($("#ex-submit").disabled) $("#ex-submit-status").textContent = "Private review is currently unavailable. Download your draft or use Contact to contribute.";
  }

  function initFilters() {
    ["grid", "list"].forEach((view) => $("#ex-view-" + view).addEventListener("click", () => {
      state.view = view; syncControls(); renderLibrary();
    }));
    $("#ex-search").addEventListener("input", (e) => { state.q = e.target.value.slice(0, 180); renderLibrary(); });
    $("#ex-city").addEventListener("change", (e) => { state.city = e.target.value; renderLibrary(); });
    $("#ex-track").addEventListener("change", (e) => { state.track = e.target.value; renderLibrary(); });
    $("#ex-topic").addEventListener("change", (e) => { state.topic = e.target.value; renderLibrary(); });
    $("#ex-stage").addEventListener("change", (e) => { state.stage = e.target.value; renderLibrary(); });
    $("#ex-sort").addEventListener("change", (e) => { state.sort = e.target.value; renderLibrary(); });
    $("#ex-reset").addEventListener("click", resetFilters);
    $("#ex-saved-toggle").addEventListener("click", () => { state.saved = !state.saved; syncControls(); renderLibrary(); });
    $$("[data-topic-shortcut]").forEach((button) => {
      button.addEventListener("click", () => {
        state.topic = button.dataset.topicShortcut;
        syncControls(); renderLibrary();
        $("#stories").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function initDialog() {
    $("#ex-dialog-close").addEventListener("click", closeStory);
    $("#ex-story-dialog").addEventListener("click", (event) => { if (event.target === $("#ex-story-dialog")) closeStory(); });
    $("#ex-story-dialog").addEventListener("close", () => updateUrl({ hash: "#stories" }));
  }

  function init() {
    const storyId = new URLSearchParams(location.search).get("story");
    populateSelects();
    readUrlState();
    syncControls();
    renderFeatured();
    initFilters();
    initDialog();
    initForm();
    renderLibrary();
    $("#ex-reviewed").textContent = "Sources checked " + formatDate(DATA.reviewed);
    $("#ex-story-total").textContent = String(DATA.stories.length);
    $("#ex-city-total").textContent = String(new Set(DATA.stories.flatMap((story) => story.cities)).size);
    if (storyId) {
      const exists = DATA.stories.some((story) => story.id === storyId);
      if (exists) setTimeout(() => openStory(storyId), 0);
    }
  }

  init();
})();
