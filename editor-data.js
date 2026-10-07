// ===== Editor dashboard: shared rules =====
// Used by the dashboard in the browser (admin.js) and by the robot in Node
// (scripts/fetch-announcements.js), so both agree on what valid content is.
// The database (supabase/schema.sql) checks the same rules again: never trust only the browser.
//
// Each kind of content (announcements, events) is described once in CONTENT_TYPES: its table, its form
// fields and its extra rules. The dashboard builds its lists and forms from these descriptions, so a new
// section (for example useful links) is mostly a new entry here plus a table in schema.sql.

(function (root) {
  // Keep these lists the same as the "category" checks in supabase/schema.sql (tests/editor compares them).
  // The first five announcement categories have their own colour and filter button on the Announcements page.
  const ANNOUNCEMENT_CATEGORIES = ["Urgent", "University", "Academic", "Student", "Social", "Programme", "Student Hub", "Student Community"];
  const EVENT_CATEGORIES = ["Social", "Academic", "Career", "Sports", "Culture", "Wellbeing", "Programme"];

  const STATUSES = {
    draft: { label: "Draft", help: "Only editors can see it." },
    submitted: { label: "Waiting for review", help: "An admin checks it before it goes public." },
    published: { label: "Published", help: "Public. It appears on the site within about 15 minutes." },
    archived: { label: "Archived", help: "Hidden from the site, kept for the record." },
  };

  // The columns of data/announcements.csv, in this order (announcements.js reads them by name)
  const CSV_COLUMNS = ["Date", "Title", "Category", "Message", "Link", "Pinned", "Expires", "Posted by"];

  const POSTED_BY = { name: "posted_by", label: "Posted by", type: "text", min: 2, max: 60, half: true, required: true };
  const LINK = { name: "link", label: "Link", type: "url", optional: true, placeholder: "https://" };

  const CONTENT_TYPES = {
    announcements: {
      table: "announcements",
      label: "Announcements",
      singular: "announcement",
      order: [["date", false], ["created_at", false]],
      fields: [
        { name: "date", label: "Date", type: "date", required: true, half: true, hint: "A future date schedules it: it appears on that day." },
        { name: "category", label: "Category", type: "select", options: ANNOUNCEMENT_CATEGORIES, required: true, half: true, initial: "Student Hub" },
        { name: "title", label: "Title", type: "text", min: 3, max: 120, required: true },
        { name: "message", label: "Message", type: "textarea", min: 1, max: 4000, rows: 7, required: true,
          hint: "Plain text. Line breaks are kept. Never include phone numbers or private emails." },
        LINK,
        { name: "expires", label: "Show until", type: "date", optional: true, half: true, hint: "Empty: shown until archived." },
        POSTED_BY,
        { name: "pinned", label: "Pin to the top", type: "checkbox" },
      ],
      rules: [(v) => (v.expires && v.date && v.expires < v.date ? ["expires", "“Show until” cannot be before the date."] : null)],
    },
    events: {
      table: "events",
      label: "Events",
      singular: "event",
      order: [["starts_on", true], ["start_time", true]],
      fields: [
        { name: "title", label: "Title", type: "text", min: 3, max: 120, required: true },
        { name: "category", label: "Category", type: "select", options: EVENT_CATEGORIES, required: true, half: true, initial: "Social" },
        { name: "location", label: "Place", type: "text", min: 2, max: 120, optional: true, half: true, placeholder: "e.g. Piazza Scaravilli, Bologna" },
        { name: "starts_on", label: "Starts on", type: "date", required: true, half: true },
        { name: "start_time", label: "Start time", type: "time", optional: true, half: true },
        { name: "ends_on", label: "Ends on", type: "date", optional: true, half: true, hint: "Only for events over several days." },
        { name: "end_time", label: "End time", type: "time", optional: true, half: true },
        { name: "description", label: "Description", type: "textarea", min: 1, max: 2000, rows: 6, required: true,
          hint: "What, for whom, what to bring, how to sign up. Never include phone numbers or private emails." },
        LINK,
        POSTED_BY,
      ],
      rules: [
        (v) => (v.ends_on && v.starts_on && v.ends_on < v.starts_on ? ["ends_on", "The event cannot end before it starts."] : null),
        (v) => (v.end_time && v.start_time && (!v.ends_on || v.ends_on === v.starts_on) && v.end_time < v.start_time
          ? ["end_time", "The end time is before the start time."] : null),
      ],
    },
  };

  // Is "2026-10-07" a real calendar date?
  function isDateKey(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const date = new Date(value + "T12:00:00Z");
    return !isNaN(date) && date.toISOString().slice(0, 10) === value;
  }

  // "18:30" (the database may answer "18:30:00")
  const isTime = (value) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value || "");

  // Cleans form values for one content type. Returns { value, errors }: errors maps a field name to a message.
  function validateItem(typeName, input) {
    const type = CONTENT_TYPES[typeName];
    const value = {};
    const errors = {};
    for (const field of type.fields) {
      const raw = input[field.name];
      if (field.type === "checkbox") { value[field.name] = Boolean(raw); continue; }
      let text = String(raw == null ? "" : raw).replace(/\r\n/g, "\n").trim();
      if (field.type === "time") text = text.slice(0, 5);
      value[field.name] = text || (field.optional ? null : "");
      if (!text) {
        if (!field.optional) errors[field.name] = `${field.label} is required.`;
        continue;
      }
      if (field.type === "date" && !isDateKey(text)) errors[field.name] = `${field.label}: choose a valid date.`;
      else if (field.type === "time" && !isTime(text)) errors[field.name] = `${field.label}: choose a valid time.`;
      else if (field.type === "url" && !/^https?:\/\/\S+$/i.test(text)) errors[field.name] = `${field.label} must start with https:// (or http://).`;
      else if (field.type === "select" && !field.options.includes(text)) errors[field.name] = `${field.label}: choose from the list.`;
      else if (field.min && (text.length < field.min || text.length > field.max)) errors[field.name] = `${field.label} needs ${field.min}–${field.max} characters.`;
    }
    // Rules that compare two fields (end after start) only make sense once each field is valid on its own
    if (Object.keys(errors).length === 0) {
      for (const rule of type.rules) {
        const problem = rule(value);
        if (problem && !errors[problem[0]]) errors[problem[0]] = problem[1];
      }
    }
    return { value, errors };
  }

  // Addresses that may appear in public text (shared mailboxes, never a person's own address)
  const PUBLIC_EMAILS = ["euhem.studenthub@gmail.com"];

  // Warnings that don't block saving but should make the editor stop and think.
  // Above all: the site must never publish students' personal data (phone numbers, private emails).
  // Returns [{ kind, message }]; kind "personal" asks for confirmation before sending or publishing.
  function contentWarnings(typeName, value) {
    const text = [value.title, value.message, value.description, value.location].filter(Boolean).join("\n");
    const warnings = [];
    const emails = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
      .filter((email) => !PUBLIC_EMAILS.includes(email.toLowerCase()));
    if (emails.length) {
      warnings.push({ kind: "personal", message: `Contains an email address (${[...new Set(emails)].join(", ")}). Never publish private emails: link to the Contact page or an official address instead.` });
    }
    // 9 or more digits, possibly with spaces, dots, dashes or brackets, starting with + or 00 or a digit:
    // phone numbers, but not dates ("2026-10-07"), times or room numbers
    const phones = (text.match(/(?:\+|\b00|\b)\d(?:[\s().-]*\d){8,}/g) || []).filter((match) => !/\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4}/.test(match)); // dates are not phones
    if (phones.length) {
      warnings.push({ kind: "personal", message: `Looks like a phone number (${phones[0].trim()}). Never publish students' phone numbers.` });
    }
    if (value.link && /^http:\/\//i.test(value.link)) {
      warnings.push({ kind: "link", message: "The link is not secure (http://). Use https:// if the website supports it." });
    }
    if (typeName === "announcements" && value.category === "Urgent" && !value.expires) {
      warnings.push({ kind: "urgent", message: "Urgent with no “Show until” date stays as a red banner on every page until it is archived." });
    }
    return warnings;
  }

  // Kept for the import script and older callers
  const validateAnnouncement = (input) => validateItem("announcements", input);

  // What a published item looks like on the public site today ("YYYY-MM-DD" in local time)
  function publicState(typeName, item, today) {
    if (item.status !== "published") return null;
    if (typeName === "announcements") {
      if (item.date > today) return { key: "scheduled", label: `Scheduled for ${item.date}` };
      if (item.expires && item.expires < today) return { key: "expired", label: "Expired: no longer shown" };
      return { key: "live", label: "Live on the site" };
    }
    if ((item.ends_on || item.starts_on) < today) return { key: "expired", label: "Past event" };
    return { key: "live", label: "Upcoming: listed on the site" };
  }

  // One CSV cell: quoted when it contains a comma, quote or line break (standard CSV)
  function csvCell(text) {
    const value = text == null ? "" : String(text);
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  // Standard CSV text -> rows of cells (quoted cells may contain commas, "" quotes and line breaks)
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((value) => value.trim()));
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

  // One database row -> the event shape used by data/events.json and events.js
  function eventFromRow(row) {
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      startsOn: row.starts_on,
      startTime: row.start_time ? row.start_time.slice(0, 5) : null,
      endsOn: row.ends_on || null,
      endTime: row.end_time ? row.end_time.slice(0, 5) : null,
      location: row.location || null,
      description: row.description,
      link: row.link || null,
      postedBy: row.posted_by,
    };
  }

  // Database rows -> the text of data/events.json (read by events.js on the Calendar page), soonest first
  function eventsToJson(rows, cohort) {
    const events = rows
      .slice()
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on) || (a.start_time || "").localeCompare(b.start_time || "") || a.title.localeCompare(b.title))
      .map(eventFromRow);
    return JSON.stringify({ schemaVersion: 1, cohort, events }, null, 2) + "\n";
  }

  const api = {
    ANNOUNCEMENT_CATEGORIES, EVENT_CATEGORIES, CATEGORIES: ANNOUNCEMENT_CATEGORIES, STATUSES, CSV_COLUMNS, CONTENT_TYPES,
    isDateKey, isTime, validateItem, validateAnnouncement, contentWarnings, publicState, csvCell, parseCsv, announcementsToCsv, eventFromRow, eventsToJson,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EditorData = api;
})(typeof window !== "undefined" ? window : globalThis);
