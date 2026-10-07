// ===== Editor dashboard (admin.html) =====
// Approved editors sign in with an emailed one-time link. Sections:
//   Overview       what needs attention, what is live, and whether the public site is up to date
//   Announcements  } written and reviewed with admin-content.js:
//   Events         } Draft -> Waiting for review -> Published (by an admin) -> Archived
//   Team           admins add editors, change roles, remove people (database functions in schema.sql)
//   Activity       who did what, written automatically by the database
//
// Where the data lives: the Supabase database (supabase/schema.sql). The database itself decides who
// may do what (Row Level Security), so hiding a button here is only a convenience, never the protection.
// The public site does not read Supabase directly: a GitHub robot copies published items into
// data/announcements.csv and data/events.json every 15 minutes (scripts/fetch-announcements.js).
// Setup and roles: docs/editor-dashboard.md

(function () {
  const { $, el, say, explain, todayKey, addDays, formatDate, timeAgo } = window.AdminKit;
  const D = window.EditorData;
  const config = window.EUHEM_SUPABASE || {};

  const SCREENS = ["admin-offline", "admin-signin", "admin-not-editor", "admin-app"];
  const SECTIONS = [
    { id: "overview", label: "Overview" },
    { id: "announcements", label: "Announcements" },
    { id: "events", label: "Events" },
    { id: "team", label: "Team", adminOnly: true },
    { id: "activity", label: "Activity" },
  ];
  const TYPE_LABELS = { announcements: "Announcement", events: "Event", editors: "Team" };

  let client = null;
  let editor = null; // { id, email, role, display_name }
  let sessionUserId; // avoids reloading when Supabase repeats the same session event
  let panels = {}; // the content panels, by type name
  let currentSection = "overview";

  const isAdmin = () => Boolean(editor && editor.role === "admin");
  const app = {
    get client() { return client; },
    config,
    editor: () => editor,
    isAdmin,
    changed: () => { if (currentSection === "overview") renderOverview(); },
  };

  function showOnly(id) {
    for (const screen of SCREENS) $(screen).hidden = screen !== id;
  }

  // ----- Sections (menu on the left, or on top on phones) -----

  function buildNav() {
    const nav = $("admin-sections");
    nav.replaceChildren(...SECTIONS.filter((s) => !s.adminOnly || isAdmin()).map((section) =>
      el("a", { href: `#${section.id}`, class: "admin-section-link", "data-section": section.id }, [
        section.label, el("span", { class: "admin-badge", "data-badge": section.id, hidden: true }),
      ])));
  }

  function sectionFromHash() {
    const id = window.location.hash.slice(1);
    const section = SECTIONS.find((s) => s.id === id && (!s.adminOnly || isAdmin()));
    return section ? section.id : "overview";
  }

  async function showSection(id) {
    currentSection = id;
    for (const section of SECTIONS) {
      const panel = $(`panel-${section.id}`);
      if (panel) panel.hidden = section.id !== id;
    }
    for (const link of document.querySelectorAll(".admin-section-link")) {
      if (link.dataset.section === id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    say("");
    if (id === "overview") await renderOverview();
    else if (panels[id]) await panels[id].load();
    else if (id === "team") await loadTeam();
    else if (id === "activity") await loadActivity();
  }

  // Red numbers in the menu: items waiting for review (admins) or sent back to you (editors)
  function updateBadges() {
    for (const typeName of Object.keys(panels)) {
      const items = panels[typeName].items();
      const count = isAdmin()
        ? items.filter((i) => i.status === "submitted").length
        : items.filter((i) => i.created_by === editor.id && i.status === "draft" && i.review_note).length;
      const badge = document.querySelector(`[data-badge="${typeName}"]`);
      if (badge) {
        badge.textContent = count ? String(count) : "";
        badge.hidden = count === 0;
        badge.setAttribute("aria-label", isAdmin() ? `${count} waiting for review` : `${count} sent back to you`);
      }
    }
  }

  // ----- Overview -----

  async function renderOverview() {
    await Promise.all(Object.values(panels).map((p) => p.load()));
    updateBadges();
    const today = todayKey();
    const announcements = panels.announcements.items();
    const events = panels.events.items();
    const all = [...announcements.map((i) => ["announcements", i]), ...events.map((i) => ["events", i])];
    const state = (typeName, item) => D.publicState(typeName, item, today);

    const stats = [
      isAdmin()
        ? ["Waiting for review", all.filter(([, i]) => i.status === "submitted").length, "admin-stat-attention"]
        : ["Your drafts", all.filter(([, i]) => i.status === "draft" && i.created_by === editor.id).length, ""],
      ["Live announcements", announcements.filter((i) => (state("announcements", i) || {}).key === "live").length, ""],
      ["Scheduled", announcements.filter((i) => (state("announcements", i) || {}).key === "scheduled").length, ""],
      ["Upcoming events", events.filter((i) => (state("events", i) || {}).key === "live").length, ""],
    ];
    $("overview-stats").replaceChildren(...stats.map(([label, value, extra]) =>
      el("div", { class: `admin-stat ${extra}`.trim() }, [el("span", { class: "admin-stat-value", text: String(value) }), el("span", { class: "admin-stat-label", text: label })])));

    // What needs a person's attention, most important first
    const todo = [];
    const soon = addDays(today, 3);
    for (const [typeName, item] of all) {
      if (isAdmin() && item.status === "submitted") todo.push([typeName, item, "Waiting for your review"]);
      if (!isAdmin() && item.created_by === editor.id && item.status === "draft" && item.review_note) todo.push([typeName, item, `Sent back: ${item.review_note}`]);
      if (typeName === "announcements" && item.status === "published" && item.category === "Urgent" && (state(typeName, item) || {}).key === "live") {
        todo.push([typeName, item, item.expires ? `Urgent banner on every page until ${formatDate(item.expires)}` : "Urgent banner on every page, with no end date"]);
      }
      if (typeName === "announcements" && item.status === "published" && item.expires && item.expires >= today && item.expires <= soon) {
        todo.push([typeName, item, `Disappears after ${formatDate(item.expires)}`]);
      }
    }
    $("overview-todo").replaceChildren(...(todo.length ? todo.map(([typeName, item, why]) => el("li", { class: "admin-todo" }, [
      el("span", { class: "admin-chip", text: TYPE_LABELS[typeName] }),
      el("div", { class: "admin-todo-text" }, [el("strong", { text: item.title }), el("span", { class: "admin-small", text: why })]),
      el("a", { class: "button button-secondary button-sm", href: `#${typeName}`, "data-open": item.id, text: "Open",
        onclick: () => { window.setTimeout(() => panels[typeName].showItem(item.id), 50); } }),
    ])) : [el("li", { class: "admin-empty", text: "Nothing needs your attention. 🎉" })]));

    renderSyncCheck(announcements, events);
    renderRecentActivity();
  }

  // Compares what is published in the database with what the public site shows right now
  async function renderSyncCheck(announcements, events) {
    const box = $("overview-sync");
    box.replaceChildren(el("p", { class: "admin-small", text: "Checking the public site…" }));
    const lines = [];
    try {
      const response = await fetch(`data/announcements.csv?check=${Date.now()}`, { cache: "no-store" });
      const rows = response.ok ? D.parseCsv(await response.text()) : [];
      const [header = [], ...body] = rows;
      const onSite = new Set(body.map((r) => `${r[header.indexOf("Date")]}|${r[header.indexOf("Title")]}`));
      const published = announcements.filter((i) => i.status === "published");
      const missing = published.filter((i) => !onSite.has(`${i.date}|${i.title}`));
      const publishedKeys = new Set(published.map((i) => `${i.date}|${i.title}`));
      const leftover = [...onSite].filter((key) => !publishedKeys.has(key));
      lines.push(missing.length || leftover.length
        ? ["pending", `Announcements: ${missing.length ? `${missing.length} published not on the site yet` : ""}${missing.length && leftover.length ? ", " : ""}${leftover.length ? `${leftover.length} still on the site but no longer published` : ""}.`]
        : ["ok", published.length ? `Announcements: the site shows all ${published.length} published.` : "Announcements: nothing published yet."]);
    } catch (error) {
      lines.push(["pending", "Announcements: could not read the public site."]);
    }
    try {
      const response = await fetch(`data/events.json?check=${Date.now()}`, { cache: "no-store" });
      const onSite = response.ok ? new Set(((await response.json()).events || []).map((e) => e.id)) : new Set();
      const published = events.filter((i) => i.status === "published");
      const missing = published.filter((i) => !onSite.has(i.id));
      const leftover = [...onSite].filter((id) => !published.some((i) => i.id === id));
      lines.push(missing.length || leftover.length
        ? ["pending", `Events: ${missing.length ? `${missing.length} published not on the site yet` : ""}${missing.length && leftover.length ? ", " : ""}${leftover.length ? `${leftover.length} still on the site but no longer published` : ""}.`]
        : ["ok", published.length ? `Events: the site shows all ${published.length} published.` : "Events: nothing published yet."]);
    } catch (error) {
      lines.push(["pending", "Events: could not read the public site."]);
    }
    const pending = lines.some(([kind]) => kind === "pending");
    box.replaceChildren(
      ...lines.map(([kind, text]) => el("p", { class: `admin-sync is-${kind}`, text: (kind === "ok" ? "✓ " : "⏳ ") + text })),
      pending ? el("p", { class: "admin-small", text: "The robot copies published items to the site every 15 minutes (GitHub sometimes runs a few minutes late). No action needed." }) : null,
    );
  }

  async function renderRecentActivity() {
    const { data, error } = await client.from("activity_log").select("*").order("at", { ascending: false }).limit(6);
    const box = $("overview-activity");
    if (error) {
      box.replaceChildren(el("li", { class: "admin-small", text: explain(error) }));
      return;
    }
    box.replaceChildren(...(data && data.length ? data.map(activityItem) : [el("li", { class: "admin-empty", text: "No activity yet." })]));
  }

  function activityItem(entry) {
    return el("li", { class: "admin-activity-item" }, [
      el("span", { class: "admin-activity-time", text: timeAgo(entry.at), title: new Date(entry.at).toLocaleString("en-GB") }),
      el("span", { class: "admin-activity-text" }, [
        el("strong", { text: entry.actor_email || "Someone" }),
        ` ${entry.action} `,
        el("span", { class: "admin-chip", text: TYPE_LABELS[entry.item_table] || entry.item_table }),
        entry.item_title ? ` “${entry.item_title}”` : "",
        entry.detail ? el("span", { class: "admin-activity-detail", text: `Note: ${entry.detail}` }) : null,
      ]),
    ]);
  }

  // ----- Backup (admins) -----
  // Everything the team can read, as one JSON file: drafts, published and archived items, the team and the
  // activity log. The robot's copies on GitHub only contain published items.

  async function downloadBackup() {
    const backup = { savedAt: new Date().toISOString(), cohort: config.cohort, project: config.url };
    for (const table of ["announcements", "events", "editors", "activity_log"]) {
      const { data, error } = await client.from(table).select("*");
      if (error) return say(`Backup failed (${table}): ${explain(error)}`, "error");
      backup[table] = data;
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const link = el("a", { href: URL.createObjectURL(blob), download: `student-hub-backup-${todayKey()}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    say("Backup downloaded. Keep it somewhere private: it contains editors' email addresses and unpublished drafts.", "success");
  }

  // ----- Activity -----

  async function loadActivity() {
    const filter = $("activity-filter").value;
    let query = client.from("activity_log").select("*").order("at", { ascending: false }).limit(200);
    if (filter) query = query.eq("item_table", filter);
    const { data, error } = await query;
    if (error) {
      say(explain(error), "error");
      return;
    }
    $("activity-list").replaceChildren(...(data && data.length ? data.map(activityItem) : [el("li", { class: "admin-empty", text: "No activity yet." })]));
  }

  // ----- Team (admins only) -----

  async function loadTeam() {
    const { data, error } = await client.from("editors").select("*").order("created_at", { ascending: true });
    if (error) {
      say(explain(error), "error");
      return;
    }
    const admins = data.filter((m) => m.role === "admin").length;
    $("team-list").replaceChildren(...data.map((member) => {
      const nameId = `team-name-${member.user_id}`, roleId = `team-role-${member.user_id}`;
      const name = el("input", { id: nameId, type: "text", value: member.display_name, maxlength: 60 });
      const role = el("select", { id: roleId }, ["editor", "admin"].map((r) => el("option", { value: r, text: r === "admin" ? "Admin" : "Editor", selected: r === member.role })));
      const lastAdmin = member.role === "admin" && admins === 1;
      return el("li", { class: "card admin-member", "data-user": member.user_id }, [
        el("div", { class: "admin-member-head" }, [
          el("strong", { text: member.email }),
          member.user_id === editor.id && el("span", { class: "admin-chip", text: "You" }),
          el("span", { class: "admin-small", text: `Since ${formatDate(todayKey(new Date(member.created_at)))}` }),
        ]),
        el("div", { class: "admin-member-fields" }, [
          el("div", { class: "admin-field" }, [el("label", { for: nameId, text: "Shown as “Posted by”" }), name]),
          el("div", { class: "admin-field" }, [el("label", { for: roleId, text: "Role" }), role]),
        ]),
        el("div", { class: "button-row" }, [
          el("button", { type: "button", class: "button button-secondary button-sm", text: "Save changes", onclick: async () => {
            const { error: saveError } = await client.rpc("update_editor", { p_user_id: member.user_id, p_role: role.value, p_display_name: name.value });
            if (saveError) return say(explain(saveError), "error");
            if (member.user_id === editor.id) { editor.role = role.value; editor.display_name = name.value.trim(); }
            say("Saved.", "success");
            if (member.user_id === editor.id && role.value !== "admin") return window.location.reload();
            loadTeam();
          } }),
          el("button", { type: "button", class: "button button-quiet button-sm", text: "Remove from team", disabled: lastAdmin,
            title: lastAdmin ? "The team needs at least one admin" : null, onclick: async () => {
              if (!window.confirm(`Remove ${member.email} from the team? Their published items stay.`)) return;
              const { error: removeError } = await client.rpc("remove_editor", { p_user_id: member.user_id });
              if (removeError) return say(explain(removeError), "error");
              say(`${member.email} was removed from the team.`, "success");
              if (member.user_id === editor.id) return window.location.reload();
              loadTeam();
            } }),
        ]),
      ]);
    }));
  }

  async function addMember(event) {
    event.preventDefault();
    const email = $("team-email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("Enter a valid email address.", "error");
    const { error } = await client.rpc("add_editor", { p_email: email, p_role: $("team-role").value, p_display_name: $("team-display-name").value });
    if (error) return say(explain(error), "error");
    say(`${email} was added to the team. They can now sign in on this page.`, "success");
    event.target.reset();
    loadTeam();
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
    buildNav();
    $("overview-backup").hidden = !isAdmin();
    showOnly("admin-app");
    await showSection(sectionFromHash());
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

  // ----- Start -----

  function start() {
    $("admin-signin-form").addEventListener("submit", sendSignInLink);

    if (!config.url || !config.publishableKey || !window.supabase) {
      showOnly("admin-offline");
      return;
    }
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

    for (const typeName of Object.keys(D.CONTENT_TYPES)) {
      panels[typeName] = window.AdminContent.create(typeName, app);
      panels[typeName].mount($(`panel-${typeName}`));
    }
    $("team-add-form").addEventListener("submit", addMember);
    $("activity-filter").addEventListener("change", loadActivity);
    $("overview-refresh").addEventListener("click", () => renderOverview());
    $("overview-backup").addEventListener("click", downloadBackup);
    window.addEventListener("hashchange", () => { if (editor) showSection(sectionFromHash()); });

    $("admin-signout").addEventListener("click", async () => {
      // Forget unsaved text kept on this device (admin-content.js), so a shared computer keeps nothing
      try {
        for (const key of Object.keys(localStorage)) if (key.startsWith("euhem-editor-draft:")) localStorage.removeItem(key);
      } catch (error) { /* storage unavailable: nothing was kept */ }
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
