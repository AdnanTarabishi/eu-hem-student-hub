// ===== Editor dashboard: one panel per kind of content (announcements, events) =====
// Everything here is built from the descriptions in CONTENT_TYPES (editor-data.js): the status tabs,
// search and category filter, the list, the form with its live preview, and the review actions.
// admin.js creates one panel per content type: AdminContent.create("events", app).
//
// Permissions are decided by the database (supabase/schema.sql). The buttons shown here only mirror
// those rules, so editors are not offered actions that the database would refuse anyway.

(function () {
  const { el, say, explain, todayKey, formatDate } = window.AdminKit;
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
    // Links in the preview should not leave the dashboard
    for (const link of card.querySelectorAll("a")) link.removeAttribute("href");
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

    async function changeStatus(item, status, note) {
      const change = { status };
      if (note !== undefined) change.review_note = note;
      const { error } = await app.client.from(type.table).update(change).eq("id", item.id).select().single();
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
      form = el("form", { novalidate: true }, [
        el("h2", { id: `${typeName}-form-title`, text: `New ${type.singular}` }),
        el("div", { class: "admin-form-layout" }, [
          el("div", { class: "admin-grid" }, type.fields.map(fieldControl)),
          el("aside", { class: "admin-preview", "aria-label": "Preview" }, [
            el("p", { class: "section-eyebrow", text: "Preview: how students will see it" }), preview,
          ]),
        ]),
        urgentNote,
        errorsBox,
        el("div", { class: "button-row admin-form-actions" }, [
          el("button", { type: "button", class: "button button-quiet", text: "Cancel", onclick: () => dialog.close() }),
          el("button", { type: "submit", class: "button button-secondary", value: "draft", text: "Save draft" }),
          el("button", { type: "submit", class: "button button-secondary", value: "submitted", "data-role": "submit-review", text: "Send for review" }),
          el("button", { type: "submit", class: "button button-primary", value: "published", "data-role": "publish", text: "Publish" }),
        ]),
      ]);
      dialog = el("dialog", { class: "admin-dialog", id: `${typeName}-dialog`, "aria-labelledby": `${typeName}-form-title` }, [form]);
      document.body.append(dialog);

      form.addEventListener("input", refreshForm);
      form.addEventListener("change", refreshForm);
      form.addEventListener("submit", save);
    }

    function readForm() {
      const values = {};
      for (const field of type.fields) {
        const control = form.querySelector(`#${typeName}-f-${field.name}`);
        values[field.name] = field.type === "checkbox" ? control.checked : control.value;
      }
      return values;
    }

    // Live preview, character counters and the Urgent warning
    function refreshForm() {
      const { value } = D.validateItem(typeName, readForm());
      preview.replaceChildren(PREVIEWS[typeName](value));
      for (const field of type.fields) {
        const box = form.querySelector(`#${typeName}-f-${field.name}`).closest(".admin-field");
        const counter = box && box.querySelector(".admin-counter");
        if (counter) {
          const length = form.querySelector(`#${typeName}-f-${field.name}`).value.length;
          counter.textContent = `${length} / ${field.max}`;
          counter.classList.toggle("is-near", length > field.max * 0.9);
        }
      }
      const urgent = form.querySelector('[data-role="urgent-note"]');
      urgent.hidden = !(typeName === "announcements" && value.category === "Urgent");
    }

    function openForm(item, { copy = false } = {}) {
      state.editing = item && !copy ? item : null;
      form.reset();
      clearErrors();
      form.querySelector("h2").textContent = state.editing ? `Edit ${type.singular}` : copy ? `Copy of ${type.singular}` : `New ${type.singular}`;
      for (const field of type.fields) {
        const control = form.querySelector(`#${typeName}-f-${field.name}`);
        let value = item ? item[field.name] : field.initial;
        if (!item && field.name === "posted_by") value = app.editor().display_name || "Student Hub team";
        if (!item && field.name === "date") value = todayKey();
        if (copy && (field.name === "date")) value = todayKey();
        if (field.type === "checkbox") control.checked = Boolean(value);
        else control.value = value == null ? "" : field.type === "time" ? String(value).slice(0, 5) : value;
      }
      const admin = app.isAdmin();
      form.querySelector('[data-role="publish"]').hidden = !admin;
      form.querySelector('[data-role="submit-review"]').hidden = admin;
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
      const row = { ...value, status };
      const request = state.editing
        ? app.client.from(type.table).update(row).eq("id", state.editing.id).select().single()
        : app.client.from(type.table).insert({ ...row, cohort: app.config.cohort }).select().single();
      const { error } = await request;
      if (error) {
        errorsBox.textContent = explain(error);
        errorsBox.hidden = false;
        return;
      }
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
