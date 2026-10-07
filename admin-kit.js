// ===== Editor dashboard: small shared helpers =====
// Used by admin-content.js (announcements, events) and admin.js (the app, overview, team, activity).

(function () {
  const $ = (id) => document.getElementById(id);

  // Builds an element safely: text always goes in as text, never as HTML
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === "text") node.textContent = value;
      else if (key === "class") node.className = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of [].concat(children)) if (child != null && child !== false) node.append(child);
    return node;
  }

  // The message bar under the page title (screen readers announce it)
  function say(message, kind = "info") {
    const box = $("admin-status");
    box.textContent = message || "";
    box.dataset.kind = kind;
    box.hidden = !message;
  }

  // Turns database errors into words an editor can act on
  function explain(error) {
    if (!error) return "";
    const message = error.message || "";
    if (error.code === "42501" || /row-level security|permission denied|Only admins/i.test(message)) {
      return /Only admins/.test(message) ? message : "You don't have permission to do this. Editors can change only their own drafts; admins publish.";
    }
    // Messages written for people in supabase/schema.sql (team functions) are passed on as they are
    if (["P0002", "23505", "22023"].includes(error.code) || /at least one admin/.test(message)) return message;
    if (error.code === "23514") return /at least one admin/.test(message) ? message : "The database refused a value (for example a category or a date). Check the form.";
    if (/fetch|network|Failed to fetch/i.test(message)) return "No connection to the database. Check your internet and try again.";
    return message || "Something went wrong. Please try again.";
  }

  // Today as "YYYY-MM-DD" in the editor's own time zone
  function todayKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function addDays(key, days) {
    const date = new Date(key + "T12:00:00");
    date.setDate(date.getDate() + days);
    return todayKey(date);
  }

  // "2026-10-07" -> "7 Oct 2026"
  function formatDate(key) {
    if (!key) return "";
    return new Date(key + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  // A timestamp -> "5 min ago", "3 h ago", "2 Oct 2026"
  function timeAgo(iso, now = Date.now()) {
    const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
    return formatDate(todayKey(new Date(iso)));
  }

  window.AdminKit = { $, el, say, explain, todayKey, addDays, formatDate, timeAgo };
})();
