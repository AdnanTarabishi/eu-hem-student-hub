// ===== Editor dashboard: one panel per kind of content (announcements, events) =====
// Everything here is built from the descriptions in CONTENT_TYPES (editor-data.js): the status tabs,
// search and category filter, the list, the form with its live preview, and the review actions.
// admin.js creates one panel per content type: AdminContent.create("events", app).
//
// Permissions are decided by the database (supabase/schema.sql). The buttons shown here only mirror
// those rules, so editors are not offered actions that the database would refuse anyway.

(function () {
  const { el, say, explain, todayKey, formatDate, timeAgo } = window.AdminKit;
  const D = window.EditorData;
  const TABS = ["submitted", "draft", "published", "archived"];

  // Same colours as the public Announcements page (announcements.js)
  const CATEGORY_CLASSES = { University: "category-university", Academic: "category-academic", Student: "category-student",
    Social: "category-social", Urgent: "category-urgent" };

  // ----- Previews: exactly what students will see -----

  function announcementPreview(value) {
    const wrap = el("div", { class: "admin-preview-stack" });
    if (value.category === "Urgent") {
      wrap.append(el("div", { class: "urgent-banner admin-preview-banner" }, [
        el("div", { class: "container" }, [el("strong", { text: "⚠ Urgent: " }), el("span", { text: (value.title || "Title") + " →" })]),
      ]));
    }
    const card = el("article", { class: "announcement" + (value.pinned ? " is-pinned" : "") });
    const meta = el("div", { class: "announcement-meta" }, [
      value.category && el("span", { class: `category-badge ${CATEGORY_CLASSES[value.category] || "category-other"}`, text: value.category }),
      value.pinned && el("span", { class: "pinned-badge", text: "Pinned" }),
      value.date && el("span", { class: "announcement-date", text: formatDate(value.date) }),
    ]);
    card.append(meta, el("h3", { class: "announcement-title", text: value.title || "Title" }));
    if (value.message) card.append(el("p", { class: "announcement-message", text: value.message }));
    const footer = el("div", { class: "announcement-footer" }, [
      value.link && el("span", { class: "read-more", text: "Read more ↗" }),
      value.posted_by && el("span", { class: "posted-by", text: `Posted by ${value.posted_by}` }),
    ]);
    if (footer.children.length) card.append(footer);
    wrap.append(card);
    return wrap;
  }

  function eventPreview(value) {
    if (!value.starts_on || !window.HubEvents) return el("p", { class: "admin-small", text: "Choose a start date to see the preview." });
    const card = window.HubEvents.eventCard(D.eventFromRow({ ...value, title: value.title || "Title", description: value.description || "", posted_by: value.posted_by || "" }));
    // Links and buttons in the preview are only for looking at
    for (const link of card.querySelectorAll("a")) link.removeAttribute("href");
    for (const button of card.querySelectorAll("button")) button.disabled = true;
    return card;
  }

  const PREVIEWS = { announcements: announcementPreview, events: eventPreview };

  // One line under the title in the list
  function metaLine(typeName, item) {
    if (typeName === "announcements") {
      return [formatDate(item.date), item.category, `Posted by ${item.posted_by}`, item.pinned && "Pinned",
        item.expires && `Shown until ${formatDate(item.expires)}`].filter(Boolean).join(" · ");
    }
    const event = D.eventFromRow(item);
    const when = window.HubEvents ? window.HubEvents.whenLabel(event) : formatDate(item.starts_on);
    return [when, item.category, item.location, `Posted by ${item.posted_by}`].filter(Boolean).join(" · ");
  }

  function bodyText(typeName, item) {
    return typeName === "announcements" ? item.message : item.description;
  }

  // ----- Small dialog for the admin's review note -----

  function askNote(title) {
    const dialog = document.getElementById("admin-note-dialog");
    const input = document.getElementById("admin-note-text");
    document.getElementById("admin-note-title").textContent = title;
    input.value = "";
    dialog.returnValue = "";
    dialog.showModal();
    input.focus();
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "send" ? input.value.trim().slice(0, 500) : null), { once: true });
    });
  }

  // ----- The panel -----

  function create(typeName, app) {
    const type = D.CONTENT_TYPES[typeName];
    const state = { items: [], tab: null, search: "", category: "", editing: null };
    let root, list, tabs, help, dialog, form, preview, errorsBox;

    const isOwn = (item) => item.created_by === app.editor().id;
    const canEdit = (item) => app.isAdmin() || (isOwn(item) && (item.status === "draft" || item.status === "submitted"));

    function mount(container) {
      tabs = el("div", { class: "admin-tabs", role: "tablist", "aria-label": `${type.label} by status` });
      const search = el("input", { type: "search", id: `${typeName}-search`, placeholder: `Search ${type.label.toLowerCase()}`, autocomplete: "off" });
      search.addEventListener("input", () => { state.search = search.value.trim().toLowerCase(); render(); });
      const categories = el("select", { id: `${typeName}-category` },
        [el("option", { value: "", text: "All categories" }), ...type.fields.find((f) => f.name === "category").options.map((c) => el("option", { value: c, text: c }))]);
      categories.addEventListener("change", () => { state.category = categories.value; render(); });

      help = el("p", { class: "admin-small admin-tab-help" });
      list = el("ul", { class: "admin-list", "aria-live": "polite" });
      root = el("div", { class: "admin-panel-body" }, [
        el("div", { class: "admin-toolbar" }, [
          tabs,
          el("button", { type: "button", class: "button button-primary", "data-action": "new", text: `New ${type.singular}`, onclick: () => openForm(null) }),
        ]),
        el("div", { class: "admin-filters" }, [
          el("label", { class: "visually-hidden", for: search.id, text: `Search ${type.label.toLowerCase()}` }), search,
          el("label", { class: "visually-hidden", for: categories.id, text: "Category" }), categories,
        ]),
        help,
        list,
      ]);
      container.append(root);
      buildDialog();
    }

    // ----- Loading and the list -----

    async function load() {
      let query = app.client.from(type.table).select("*").eq("cohort", app.config.cohort);
      for (const [column, ascending] of type.order) query = query.order(column, { ascending });
      const { data, error } = await query;
      if (error) {
        say(explain(error), "error");
        return;
      }
      state.items = data || [];
      if (!state.tab) state.tab = app.isAdmin() && state.items.some((i) => i.status === "submitted") ? "submitted" : app.isAdmin() ? "published" : "draft";
      render();
    }

    function matches(item) {
      if (state.category && item.category !== state.category) return false;
      if (!state.search) return true;
      return [item.title, bodyText(typeName, item), item.location, item.posted_by].some((text) => (text || "").toLowerCase().includes(state.search));
    }

    function renderTabs() {
      tabs.replaceChildren(...TABS.map((status) => el("button", {
        type: "button", role: "tab", class: "admin-tab", "data-status": status, "aria-selected": String(status === state.tab),
        onclick: () => { state.tab = status; render(); },
      }, [D.STATUSES[status].label, el("span", { class: "admin-count", text: String(state.items.filter((i) => i.status === status).length) })])));
      help.textContent = D.STATUSES[state.tab].help;
    }

    function actionsFor(item) {
      const actions = [];
      const add = (label, handler, kind = "button-secondary") =>
        actions.push(el("button", { type: "button", class: `button ${kind} button-sm`, text: label, onclick: handler }));
      if (canEdit(item)) add("Edit", () => openForm(item));
      if (app.isAdmin()) {
        if (item.status === "submitted" || item.status === "draft") add("Publish", () => changeStatus(item, "published"), "button-primary");
        if (item.status === "submitted") add("Send back…", async () => {
          const note = await askNote(`Send “${item.title}” back to the editor`);
          if (note !== null) changeStatus(item, "draft", note || null);
        });
        if (item.status === "published") add("Archive", () => changeStatus(item, "archived"));
        if (item.status === "archived") add("Restore as draft", () => changeStatus(item, "draft"));
      } else if (isOwn(item)) {
        if (item.status === "draft") add("Send for review", () => changeStatus(item, "submitted"), "button-primary");
        if (item.status === "submitted") add("Back to draft", () => changeStatus(item, "draft"));
      }
      add("Duplicate", () => openForm(item, { copy: true }), "button-quiet");
      if (app.isAdmin() || (isOwn(item) && item.status === "draft")) add("Delete", () => remove(item), "button-quiet");
      return actions;
    }

    function render() {
      renderTabs();
      const inTab = state.items.filter((item) => item.status === state.tab);
      const shown = inTab.filter(matches);
      const today = todayKey();
      if (!shown.length) {
        list.replaceChildren(el("li", { class: "admin-empty", text: inTab.length ? "Nothing matches your search." : "Nothing here." }));
        return;
      }
      list.replaceChildren(...shown.map((item) => {
        const live = D.publicState(typeName, item, today);
        const text = bodyText(typeName, item);
        return el("li", { class: "card admin-item", "data-id": item.id }, [
          el("div", { class: "admin-chips" }, [
            live && el("span", { class: `admin-chip is-${live.key}`, text: live.label }),
            item.category === "Urgent" && el("span", { class: "admin-chip is-urgent", text: "Urgent banner" }),
            isOwn(item) && el("span", { class: "admin-chip", text: "Yours" }),
          ]),
          el("p", { class: "admin-meta", text: metaLine(typeName, item) }),
          el("h3", { text: item.title }),
          el("p", { class: "admin-excerpt", text: text.length > 240 ? text.slice(0, 240) + "…" : text }),
          item.review_note && el("p", { class: "note admin-review-note" }, [el("strong", { text: "Note from the admin: " }), item.review_note]),
          el("div", { class: "button-row admin-actions" }, actionsFor(item)),
        ]);
      }));
    }

    // ----- Changing items -----

    const DONE = {
      published: "Published. It appears on the site within about 15 minutes.",
      submitted: "Sent for review. An admin will check it.",
      draft: "Saved as a draft.",
      archived: "Archived: it disappears from the site within about 15 minutes.",
    };

    // Updates one item, but only if nobody changed it since it was loaded ("optimistic locking"):
    // the database matches on updated_at too. Without this, two admins working on the same item would
    // silently overwrite each other. No matching row -> Supabase answers with error PGRST116.
    function updateItem(item, change) {
      let query = app.client.from(type.table).update(change).eq("id", item.id);
      if (item.updated_at) query = query.eq("updated_at", item.updated_at);
      return query.select().single();
    }

    async function conflict() {
      say("Someone else changed this item meanwhile (or you can no longer edit it), so nothing was saved. The list now shows the latest version.", "error");
      await load();
      app.changed();
    }

    async function changeStatus(item, status, note) {
      const change = { status };
      if (note !== undefined) change.review_note = note;
      const { error } = await updateItem(item, change);
      if (error && error.code === "PGRST116") return conflict();
      if (error) {
        say(explain(error), "error");
        return;
      }
      say(status === "draft" && note ? "Sent back to the editor with your note." : DONE[status], "success");
      state.tab = status;
      await load();
      app.changed();
    }

    async function remove(item) {
      if (!window.confirm(`Delete “${item.title}” for good? This cannot be undone.`)) return;
      const { error } = await app.client.from(type.table).delete().eq("id", item.id);
      if (error) {
        say(explain(error), "error");
        return;
      }
      say("Deleted.", "success");
      await load();
      app.changed();
    }

    // ----- The form (a dialog with a live preview) -----

    function fieldControl(field) {
      const id = `${typeName}-f-${field.name}`;
      if (field.type === "checkbox") {
        return el("div", { class: "admin-field admin-wide admin-check" }, [
          el("input", { type: "checkbox", id, name: field.name }), el("label", { for: id, text: field.label }),
        ]);
      }
      let control;
      if (field.type === "textarea") control = el("textarea", { id, name: field.name, rows: field.rows || 5, maxlength: field.max });
      else if (field.type === "select") control = el("select", { id, name: field.name }, field.options.map((o) => el("option", { value: o, text: o })));
      else control = el("input", { id, name: field.name, type: field.type === "url" ? "url" : field.type, maxlength: field.max, placeholder: field.placeholder });
      if (!field.optional) control.required = true;
      const hintId = field.hint ? `${id}-hint` : null;
      if (hintId) control.setAttribute("aria-describedby", hintId);
      const counter = field.max && (field.type === "text" || field.type === "textarea") ? el("span", { class: "admin-counter", "aria-hidden": "true" }) : null;
      return el("div", { class: "admin-field" + (field.half ? "" : " admin-wide") }, [
        el("label", { for: id }, [field.label, field.optional && el("span", { class: "admin-optional", text: " (optional)" })]),
        control,
        (field.hint || counter) && el("div", { class: "admin-field-foot" }, [
          field.hint && el("span", { class: "admin-small", id: hintId, text: field.hint }), counter,
        ]),
      ]);
    }

    function buildDialog() {
      errorsBox = el("p", { class: "note admin-errors", role: "alert", hidden: true });
      preview = el("div", { class: "admin-preview-body" });
      const urgentNote = el("p", { class: "note admin-warning", hidden: true, "data-role": "urgent-note",
        text: "Urgent shows a red banner at the top of EVERY page until it expires. Use it only for real emergencies, and set “Show until”." });
      const warnings = el("ul", { class: "note admin-warning admin-warnings", hidden: true, "data-role": "warnings", "aria-live": "polite" });
      const restore = el("div", { class: "note admin-restore", hidden: true, "data-role": "restore" }, [
        el("span", { "data-role": "restore-text" }),
        el("div", { class: "button-row" }, [
          el("button", { type: "button", class: "button button-secondary button-sm", text: "Restore it", onclick: restoreLocalDraft }),
          el("button", { type: "button", class: "button button-quiet button-sm", text: "Discard", onclick: () => { forgetLocalDraft(); restore.hidden = true; } }),
        ]),
      ]);
      form = el("form", { novalidate: true }, [
        el("h2", { id: `${typeName}-form-title`, text: `New ${type.singular}` }),
        restore,
        el("div", { class: "admin-form-layout" }, [
          el("div", { class: "admin-grid" }, type.fields.map(fieldControl)),
          // The warnings sit with the preview, which stays in view while typing
          el("aside", { class: "admin-preview", "aria-label": "Preview and checks" }, [
            urgentNote,
            warnings,
            el("p", { class: "section-eyebrow", text: "Preview: how students will see it" }), preview,
          ]),
        ]),
        errorsBox,
        el("div", { class: "button-row admin-form-actions" }, [
          el("button", { type: "button", class: "button button-quiet", "data-role": "cancel", text: "Cancel", onclick: () => closeForm() }),
          el("button", { type: "submit", class: "button button-secondary", value: "draft", text: "Save draft" }),
          el("button", { type: "submit", class: "button button-secondary", value: "submitted", "data-role": "submit-review", text: "Send for review" }),
          el("button", { type: "submit", class: "button button-primary", value: "published", "data-role": "publish", text: "Publish" }),
        ]),
      ]);
      dialog = el("dialog", { class: "admin-dialog", id: `${typeName}-dialog`, "aria-labelledby": `${typeName}-form-title` }, [form]);
      document.body.append(dialog);

      form.addEventListener("input", onEdit);
      form.addEventListener("change", onEdit);
      form.addEventListener("submit", save);
      // Escape key: same question as Cancel when something was typed
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        closeForm();
      });
    }

    function readForm() {
      const values = {};
      for (const field of type.fields) {
        const control = form.querySelector(`#${typeName}-f-${field.name}`);
        values[field.name] = field.type === "checkbox" ? control.checked : control.value;
      }
      return values;
    }

    function fillForm(values) {
      for (const field of type.fields) {
        const control = form.querySelector(`#${typeName}-f-${field.name}`);
        const value = values[field.name];
        if (field.type === "checkbox") control.checked = Boolean(value);
        else control.value = value == null ? "" : field.type === "time" ? String(value).slice(0, 5) : value;
      }
    }

    // Live preview, character counters, the Urgent note and the warnings (personal data, insecure link)
    function refreshForm() {
      const { value } = D.validateItem(typeName, readForm());
      preview.replaceChildren(PREVIEWS[typeName](value));
      for (const field of type.fields) {
        const control = form.querySelector(`#${typeName}-f-${field.name}`);
        const counter = control.closest(".admin-field").querySelector(".admin-counter");
        if (counter) {
          counter.textContent = `${control.value.length} / ${field.max}`;
          counter.classList.toggle("is-near", control.value.length > field.max * 0.9);
        }
      }
      form.querySelector('[data-role="urgent-note"]').hidden = !(typeName === "announcements" && value.category === "Urgent");
      const found = D.contentWarnings(typeName, value).filter((w) => w.kind !== "urgent"); // Urgent has its own note above
      const box = form.querySelector('[data-role="warnings"]');
      box.replaceChildren(...found.map((w) => el("li", { text: w.message })));
      box.hidden = !found.length;
    }

    // ----- Never lose text: unsaved-changes question + a copy on this device while typing -----
    // The copy lives in this browser only (localStorage), per item, and is removed after saving,
    // after "Discard", and when signing out (admin.js), so a shared computer keeps nothing behind.

    const localKey = () => `euhem-editor-draft:${typeName}:${state.editing ? state.editing.id : "new"}`;
    let snapshot = "";
    let saveTimer = null;
    const isDirty = () => JSON.stringify(readForm()) !== snapshot;

    function onEdit() {
      refreshForm();
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        try {
          if (isDirty()) localStorage.setItem(localKey(), JSON.stringify({ savedAt: new Date().toISOString(), values: readForm() }));
        } catch (error) { /* private mode or storage full: the form still works */ }
      }, 400);
    }

    function localDraft() {
      try { return JSON.parse(localStorage.getItem(localKey()) || "null"); } catch (error) { return null; }
    }

    function forgetLocalDraft() {
      window.clearTimeout(saveTimer);
      try { localStorage.removeItem(localKey()); } catch (error) { /* nothing to remove */ }
    }

    function restoreLocalDraft() {
      const saved = localDraft();
      if (saved) fillForm(saved.values);
      form.querySelector('[data-role="restore"]').hidden = true;
      refreshForm();
    }

    function closeForm() {
      if (isDirty() && !window.confirm("Discard your changes?")) return;
      forgetLocalDraft();
      dialog.close();
    }

    function openForm(item, { copy = false } = {}) {
      state.editing = item && !copy ? item : null;
      form.reset();
      clearErrors();
      form.querySelector("h2").textContent = state.editing ? `Edit ${type.singular}` : copy ? `Copy of ${type.singular}` : `New ${type.singular}`;
      const values = {};
      for (const field of type.fields) {
        let value = item ? item[field.name] : field.initial;
        if (!item && field.name === "posted_by") value = app.editor().display_name || "Student Hub team";
        if ((!item || copy) && field.name === "date") value = todayKey();
        values[field.name] = value;
      }
      fillForm(values);
      snapshot = JSON.stringify(readForm());
      const admin = app.isAdmin();
      form.querySelector('[data-role="publish"]').hidden = !admin;
      form.querySelector('[data-role="submit-review"]').hidden = admin;
      // Text typed earlier that was never saved (closed tab, crash, lost connection)?
      const saved = copy ? null : localDraft();
      const restore = form.querySelector('[data-role="restore"]');
      restore.hidden = !(saved && JSON.stringify(saved.values) !== snapshot);
      if (!restore.hidden) restore.querySelector('[data-role="restore-text"]').textContent = `Unsaved text from ${timeAgo(saved.savedAt)} was found on this device.`;
      refreshForm();
      dialog.showModal();
      form.querySelector(`#${typeName}-f-title`).focus();
    }

    function clearErrors() {
      errorsBox.hidden = true;
      for (const input of form.querySelectorAll("[aria-invalid]")) input.removeAttribute("aria-invalid");
    }

    async function save(event) {
      event.preventDefault();
      const status = (event.submitter && event.submitter.value) || "draft";
      const { value, errors } = D.validateItem(typeName, readForm());
      clearErrors();
      const problems = Object.entries(errors);
      if (problems.length) {
        for (const [field] of problems) form.querySelector(`#${typeName}-f-${field}`).setAttribute("aria-invalid", "true");
        errorsBox.textContent = problems.map(([, message]) => message).join(" ");
        errorsBox.hidden = false;
        form.querySelector(`#${typeName}-f-${problems[0][0]}`).focus();
        return;
      }
      // Personal data: a draft may hold it for a moment, but sending or publishing needs a clear "yes"
      const personal = D.contentWarnings(typeName, value).filter((w) => w.kind === "personal");
      if (status !== "draft" && personal.length &&
        !window.confirm(`${personal.map((w) => w.message).join("\n\n")}\n\n${status === "published" ? "Publish" : "Send"} anyway?`)) return;

      const row = { ...value, status };
      const { error } = state.editing
        ? await updateItem(state.editing, row)
        : await app.client.from(type.table).insert({ ...row, cohort: app.config.cohort }).select().single();
      if (error && error.code === "PGRST116") {
        // Keep the typed text on this device, so it can be restored on the latest version
        errorsBox.textContent = "Someone else changed this item meanwhile, so it was not saved. Your text is kept on this device: close the form, open the item again and choose “Restore it”.";
        errorsBox.hidden = false;
        try { localStorage.setItem(localKey(), JSON.stringify({ savedAt: new Date().toISOString(), values: readForm() })); } catch (e) { /* ignore */ }
        snapshot = JSON.stringify(readForm()); // closing is fine now: the text is kept
        await load();
        return;
      }
      if (error) {
        errorsBox.textContent = explain(error);
        errorsBox.hidden = false;
        return;
      }
      forgetLocalDraft();
      dialog.close();
      say(DONE[status], "success");
      state.tab = status;
      await load();
      app.changed();
    }

    function openFromOverview(id) {
      const item = state.items.find((i) => i.id === id);
      if (item) { state.tab = item.status; render(); }
      return item;
    }

    return { mount, load, items: () => state.items, openNew: () => openForm(null), showItem: openFromOverview, type };
  }

  window.AdminContent = { create };
})();
