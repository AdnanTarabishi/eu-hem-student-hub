// ===== Editor dashboard (admin.html) =====
// Approved editors sign in with an emailed one-time link, then write announcements.
// The flow: Draft -> Waiting for review -> Published (by an admin) -> Archived.
//
// Where the data lives: the Supabase database (supabase/schema.sql). The database itself decides who
// may do what (Row Level Security), so hiding a button here is only a convenience, never the protection.
// The public site does not read Supabase directly: a GitHub robot copies published announcements into
// data/announcements.csv every 15 minutes (scripts/fetch-announcements.js).
// Setup and roles: docs/editor-dashboard.md

(function () {
  const config = window.EUHEM_SUPABASE || {};
  const D = window.EditorData;
  const $ = (id) => document.getElementById(id);

  const TABS = ["submitted", "draft", "published", "archived"];
  const SECTIONS = ["admin-offline", "admin-signin", "admin-not-editor", "admin-app"];

  let client = null; // the Supabase connection
  let editor = null; // { id, email, role, display_name } of the signed-in editor
  let items = []; // the cohort's announcements, all statuses
  let tab = "submitted";
  let editing = null; // the announcement open in the form, or null for a new one
  let sessionUserId = undefined; // avoids reloading when Supabase repeats the same session event

  // ----- Small helpers -----

  // Builds an element safely: text always goes in as text, never as HTML
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === "text") node.textContent = value;
      else if (key === "class") node.className = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  }

  function showOnly(id) {
    for (const section of SECTIONS) $(section).hidden = section !== id;
  }

  function say(message, kind = "info") {
    const box = $("admin-status");
    box.textContent = message;
    box.dataset.kind = kind;
    box.hidden = !message;
  }

  // Turns database errors into words an editor can act on
  function explain(error) {
    if (!error) return "";
    if (error.code === "42501" || /row-level security|permission/i.test(error.message || "")) {
      return "You don't have permission to do this. Editors can change only their own drafts; admins publish.";
    }
    if (error.code === "23514") return "The database refused a value (for example a category or a date). Check the form.";
    if (/fetch|network/i.test(error.message || "")) return "No connection to the database. Check your internet and try again.";
    return error.message || "Something went wrong. Please try again.";
  }

  const isAdmin = () => editor && editor.role === "admin";
  const isOwn = (item) => editor && item.created_by === editor.id;
  const canEdit = (item) => isAdmin() || (isOwn(item) && (item.status === "draft" || item.status === "submitted"));

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function formatDate(key) {
    if (!key) return "";
    return new Date(key + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  // ----- Signing in -----

  async function handleSession(session) {
    const userId = session ? session.user.id : null;
    if (userId === sessionUserId) return;
    sessionUserId = userId;

    if (!session) {
      editor = null;
      $("admin-account").hidden = true;
      showOnly("admin-signin");
      return;
    }
    $("admin-account").hidden = false;
    $("admin-who").textContent = session.user.email || "";

    const { data, error } = await client.from("editors").select("role, display_name, email").eq("user_id", userId).maybeSingle();
    if (error) {
      say(explain(error), "error");
      showOnly("admin-not-editor");
      return;
    }
    if (!data) {
      showOnly("admin-not-editor");
      return;
    }
    editor = { id: userId, ...data };
    $("admin-who").textContent = `${data.email} · ${data.role === "admin" ? "Admin" : "Editor"}`;
    tab = isAdmin() ? "submitted" : "draft";
    showOnly("admin-app");
    await load();
  }

  async function sendSignInLink(event) {
    event.preventDefault();
    const email = $("admin-email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      say("Enter a valid email address.", "error");
      $("admin-email").focus();
      return;
    }
    const button = event.target.querySelector("button[type=submit]");
    button.disabled = true;
    const { error } = await client.auth.signInWithOtp({
      email,
      // Only invited editors: the database never creates a new account from this form
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
    });
    button.disabled = false;
    if (error && (error.status === 429 || /rate limit/i.test(error.message || ""))) {
      say("Too many sign-in emails were sent. Wait a while (up to an hour) and try again.", "error");
      return;
    }
    // Same answer whether or not the address is invited, so the form doesn't reveal who the editors are
    say("If this email is on the editor list, a sign-in link is on its way. Check your inbox (and spam).", "success");
  }

  // ----- The list -----

  async function load() {
    const { data, error } = await client
      .from("announcements")
      .select("*")
      .eq("cohort", config.cohort)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      say(explain(error), "error");
      return;
    }
    items = data || [];
    render();
  }

  function renderTabs() {
    const box = $("admin-tabs");
    box.replaceChildren();
    for (const status of TABS) {
      const count = items.filter((item) => item.status === status).length;
      box.append(el("button", {
        type: "button",
        role: "tab",
        class: "admin-tab",
        "aria-selected": String(status === tab),
        "data-status": status,
        onclick: () => { tab = status; render(); },
      }, [D.STATUSES[status].label, el("span", { class: "admin-count", text: String(count) })]));
    }
    $("admin-tab-help").textContent = D.STATUSES[tab].help;
  }

  function actionsFor(item) {
    const actions = [];
    const add = (label, handler, kind = "button-secondary") =>
      actions.push(el("button", { type: "button", class: `button ${kind} button-sm`, text: label, onclick: handler }));

    if (canEdit(item)) add("Edit", () => openForm(item));
    if (isAdmin()) {
      if (item.status === "submitted" || item.status === "draft") add("Publish", () => changeStatus(item, "published"), "button-primary");
      if (item.status === "submitted") add("Send back to draft", () => changeStatus(item, "draft"));
      if (item.status === "published") add("Archive", () => changeStatus(item, "archived"));
      if (item.status === "archived") add("Restore as draft", () => changeStatus(item, "draft"));
    } else if (isOwn(item)) {
      if (item.status === "draft") add("Send for review", () => changeStatus(item, "submitted"));
      if (item.status === "submitted") add("Back to draft", () => changeStatus(item, "draft"));
    }
    if (isAdmin() || (isOwn(item) && item.status === "draft")) add("Delete", () => remove(item), "button-quiet");
    return actions;
  }

  function render() {
    renderTabs();
    const list = $("admin-list");
    list.replaceChildren();
    const shown = items.filter((item) => item.status === tab);
    if (!shown.length) {
      list.append(el("li", { class: "admin-empty", text: "Nothing here." }));
      return;
    }
    for (const item of shown) {
      const meta = [formatDate(item.date), item.category, `Posted by ${item.posted_by}`];
      if (item.pinned) meta.push("Pinned");
      if (item.expires) meta.push(`Shown until ${formatDate(item.expires)}`);
      const excerpt = item.message.length > 240 ? item.message.slice(0, 240) + "…" : item.message;
      list.append(el("li", { class: "card admin-item", "data-id": item.id }, [
        el("p", { class: "admin-meta", text: meta.join(" · ") }),
        el("h3", { text: item.title }),
        el("p", { class: "admin-excerpt", text: excerpt }),
        el("div", { class: "button-row admin-actions" }, actionsFor(item)),
      ]));
    }
  }

  // ----- Changing announcements -----

  async function changeStatus(item, status) {
    const { error } = await client.from("announcements").update({ status }).eq("id", item.id).select().single();
    if (error) {
      say(explain(error), "error");
      return;
    }
    const messages = {
      published: "Published. It appears on the site within about 15 minutes.",
      submitted: "Sent for review. An admin will check it.",
      draft: "Moved to drafts.",
      archived: "Archived: it disappears from the site within about 15 minutes.",
    };
    say(messages[status], "success");
    tab = status;
    await load();
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.title}” for good? This cannot be undone.`)) return;
    const { error } = await client.from("announcements").delete().eq("id", item.id);
    if (error) {
      say(explain(error), "error");
      return;
    }
    say("Deleted.", "success");
    await load();
  }

  // ----- The form -----

  function openForm(item) {
    editing = item || null;
    const form = $("admin-form");
    form.reset();
    clearErrors();
    $("admin-form-title").textContent = item ? "Edit announcement" : "New announcement";
    $("f-date").value = item ? item.date : todayKey();
    $("f-category").value = item ? item.category : "Student Hub";
    $("f-title").value = item ? item.title : "";
    $("f-message").value = item ? item.message : "";
    $("f-link").value = item ? item.link || "" : "";
    $("f-expires").value = item ? item.expires || "" : "";
    $("f-posted-by").value = item ? item.posted_by : editor.display_name || "Student Hub team";
    $("f-pinned").checked = item ? item.pinned : false;
    $("admin-publish").hidden = !isAdmin();
    $("admin-submit-review").hidden = isAdmin(); // admins publish directly or save drafts
    $("admin-dialog").showModal();
    $("f-title").focus();
  }

  function clearErrors() {
    $("admin-form-errors").hidden = true;
    for (const input of $("admin-form").querySelectorAll("[aria-invalid]")) input.removeAttribute("aria-invalid");
  }

  const FIELD_IDS = { date: "f-date", title: "f-title", category: "f-category", message: "f-message", link: "f-link", expires: "f-expires", posted_by: "f-posted-by" };

  async function saveForm(event) {
    event.preventDefault();
    const status = (event.submitter && event.submitter.value) || "draft";
    // Read by id: form.title would return the form's own "title" attribute, not the field
    const { value, errors } = D.validateAnnouncement({
      date: $("f-date").value, title: $("f-title").value, category: $("f-category").value, message: $("f-message").value,
      link: $("f-link").value, expires: $("f-expires").value, posted_by: $("f-posted-by").value, pinned: $("f-pinned").checked,
    });
    clearErrors();
    const problems = Object.entries(errors);
    if (problems.length) {
      for (const [field] of problems) $(FIELD_IDS[field]).setAttribute("aria-invalid", "true");
      const box = $("admin-form-errors");
      box.textContent = problems.map(([, message]) => message).join(" ");
      box.hidden = false;
      $(FIELD_IDS[problems[0][0]]).focus();
      return;
    }

    const row = { ...value, status };
    const request = editing
      ? client.from("announcements").update(row).eq("id", editing.id).select().single()
      : client.from("announcements").insert({ ...row, cohort: config.cohort }).select().single();
    const { error } = await request;
    if (error) {
      const box = $("admin-form-errors");
      box.textContent = explain(error);
      box.hidden = false;
      return;
    }
    $("admin-dialog").close();
    say({ draft: "Draft saved.", submitted: "Sent for review. An admin will check it.", published: "Published. It appears on the site within about 15 minutes." }[status], "success");
    tab = status;
    await load();
  }

  // ----- Start -----

  function start() {
    for (const category of D.CATEGORIES) $("f-category").append(el("option", { value: category, text: category }));
    $("admin-new").addEventListener("click", () => openForm(null));
    $("admin-cancel").addEventListener("click", () => $("admin-dialog").close());
    $("admin-form").addEventListener("submit", saveForm);
    $("admin-signin-form").addEventListener("submit", sendSignInLink);

    if (!config.url || !config.publishableKey || !window.supabase) {
      showOnly("admin-offline");
      return;
    }
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    $("admin-signout").addEventListener("click", async () => {
      await client.auth.signOut();
      say("Signed out.", "info");
    });
    // Fires once at start (with the saved session, if any) and after every sign-in or sign-out.
    // The work runs just after the event: Supabase advises not to call it from inside this callback.
    client.auth.onAuthStateChange((_event, session) => setTimeout(() => handleSession(session), 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
