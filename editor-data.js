// ===== Editor dashboard: shared rules =====
// Used by the dashboard in the browser (admin.js) and by the announcements robot in Node
// (scripts/fetch-announcements.js), so both agree on what a valid announcement is.
// The database (supabase/schema.sql) checks the same rules again: never trust only the browser.

(function (root) {
  // Keep the same list as the "category" check in supabase/schema.sql (tests/editor compares them).
  // The first five have their own colour and filter button on the Announcements page.
  const CATEGORIES = ["Urgent", "University", "Academic", "Student", "Social", "Programme", "Student Hub", "Student Community"];

  const STATUSES = {
    draft: { label: "Draft", help: "Only editors can see it." },
    submitted: { label: "Waiting for review", help: "An admin checks it before it goes public." },
    published: { label: "Published", help: "Public. It appears on the site within about 15 minutes." },
    archived: { label: "Archived", help: "Hidden from the site, kept for the record." },
  };

  // The columns of data/announcements.csv, in this order (announcements.js reads them by name)
  const CSV_COLUMNS = ["Date", "Title", "Category", "Message", "Link", "Pinned", "Expires", "Posted by"];

  const LIMITS = { title: [3, 120], message: [1, 4000], postedBy: [2, 60] };

  // Is "2026-10-07" a real calendar date?
  function isDateKey(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const date = new Date(value + "T12:00:00Z");
    return !isNaN(date) && date.toISOString().slice(0, 10) === value;
  }

  // Cleans the form values. Returns { value, errors }: errors maps a field name to a message.
  function validateAnnouncement(input) {
    const value = {
      date: String(input.date || "").trim(),
      title: String(input.title || "").trim(),
      category: String(input.category || "").trim(),
      message: String(input.message || "").replace(/\r\n/g, "\n").trim(),
      link: String(input.link || "").trim() || null,
      pinned: Boolean(input.pinned),
      expires: String(input.expires || "").trim() || null,
      posted_by: String(input.posted_by || "").trim(),
    };
    const errors = {};
    const length = (field, key, label) => {
      const [min, max] = LIMITS[key];
      if (value[field].length < min || value[field].length > max) errors[field] = `${label} needs ${min}–${max} characters.`;
    };
    if (!isDateKey(value.date)) errors.date = "Choose a valid date.";
    length("title", "title", "The title");
    if (!CATEGORIES.includes(value.category)) errors.category = "Choose a category from the list.";
    length("message", "message", "The message");
    if (value.link && !/^https?:\/\/\S+$/i.test(value.link)) errors.link = "The link must start with https:// (or http://).";
    if (value.expires && !isDateKey(value.expires)) errors.expires = "Choose a valid date, or leave it empty.";
    else if (value.expires && isDateKey(value.date) && value.expires < value.date) errors.expires = "The end date cannot be before the date.";
    length("posted_by", "postedBy", "“Posted by”");
    return { value, errors };
  }

  // One CSV cell: quoted when it contains a comma, quote or line break (standard CSV)
  function csvCell(text) {
    const value = text == null ? "" : String(text);
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  // Database rows -> the text of data/announcements.csv, newest first (same format as the Google Sheet copy)
  function announcementsToCsv(rows) {
    const sorted = rows.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || (a.created_at || "").localeCompare(b.created_at || ""));
    const lines = [CSV_COLUMNS.join(",")];
    for (const row of sorted) {
      lines.push([row.date, row.title, row.category, row.message, row.link || "", row.pinned ? "Yes" : "", row.expires || "", row.posted_by]
        .map(csvCell).join(","));
    }
    return lines.join("\n") + "\n";
  }

  const api = { CATEGORIES, STATUSES, CSV_COLUMNS, LIMITS, isDateKey, validateAnnouncement, csvCell, announcementsToCsv };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EditorData = api;
})(typeof window !== "undefined" ? window : globalThis);
