// ===== Shared helpers =====
// Small functions used by both timetable.js and exams.js.
// This file must be loaded before them in index.html.

// "INTRODUCTION TO ECONOMICS" -> "Introduction To Economics"
function toTitleCase(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// A Date -> "YYYY-MM-DD". This format sorts and compares correctly as plain text.
function dateToKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Today's date as "YYYY-MM-DD"
function todayKey() {
  return dateToKey(new Date());
}

// "2026-10-05" -> "Monday 5 October 2026"
function formatDay(dateKey, options = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  const date = new Date(dateKey + "T12:00:00");
  return date.toLocaleDateString("en-GB", options);
}

// Number of days from one "YYYY-MM-DD" to another
function daysBetween(fromKey, toKey) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / oneDay);
}

// Creates an HTML element with optional CSS class and text
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

// Turns CSV text into rows of fields. Handles the CSV rules Google Sheets uses:
// fields in "quotes" may contain commas or line breaks, and "" inside quotes means one ".
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (insideQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++; // skip the second quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      insideQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++; // Windows line ending (\r\n)
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  // Last line, if the file doesn't end with a line break
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// "José" -> "jose": lower case and without accents, so searches match either way
function simplify(text) {
  return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Links to other websites (inside "container") open in a new tab
function openExternalLinksInNewTab(container) {
  for (const link of container.querySelectorAll("a[href]")) {
    if (link.hostname && link.hostname !== window.location.hostname) {
      link.target = "_blank";
      link.rel = "noopener";
    }
  }
}

// Browser storage that never crashes the page: some browsers block it (e.g. some private modes).
// Values are stored as JSON text. readStorage returns "fallback" if nothing can be read.
function readStorage(key, fallback) {
  try {
    const text = window.localStorage.getItem(key);
    return text === null ? fallback : JSON.parse(text);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// A progress bar element: <div class="progress-bar"><span style="width: 40%"></span></div>
function progressBar(percent, label) {
  const bar = createElement("div", "progress-bar");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", String(percent));
  bar.setAttribute("aria-label", label || `${percent}% done`);
  const fill = createElement("span");
  fill.style.width = `${percent}%`;
  bar.appendChild(fill);
  return bar;
}

// A course's icon. content/programme.json gives each course an emoji; on the page it is drawn as the
// matching outline icon from icons.svg (one icon style for the whole site). Unknown emoji stay as they are.
const COURSE_ICONS = {
  "📈": "trending-up", "💼": "briefcase", "🩺": "stethoscope", "⚖️": "scale", "📊": "chart-column",
  "🧮": "calculator", "🌍": "globe", "🌐": "network", "📘": "book",
};

function courseIcon(emoji, className) {
  const box = createElement("span", className);
  const id = COURSE_ICONS[emoji || "📘"];
  if (id) box.innerHTML = `<svg class="icon" aria-hidden="true"><use href="icons.svg#${id}"></use></svg>`;
  else box.textContent = emoji;
  return box;
}

// ----- Source labels: "Official · EU-HEM Handbook · verified 6 Oct 2026" or "Student tip · ESN Bologna" -----
// Every fact taken from a document points to a source id in content/sources.json (docs/sources.md).
let sourcesPromise = null;

// Loads content/sources.json once per page: { "euhem-handbook-2026": { ...source, kind, typeLabel } }
function loadSources() {
  if (!sourcesPromise) {
    sourcesPromise = fetch("content/sources.json")
      .then((response) => (response.ok ? response.json() : { sources: [], types: {} }))
      .then((data) => Object.fromEntries((data.sources || []).map((source) => {
        const type = (data.types || {})[source.type] || { label: "Source", kind: "tip" };
        return [source.id, { ...source, kind: type.kind, typeLabel: type.label }];
      })))
      .catch(() => ({}));
  }
  return sourcesPromise;
}

// The label element for one source id (sources = the result of loadSources())
function sourceLabel(sourceId, sources) {
  const source = sources[sourceId];
  const label = createElement("span", `source-badge is-${source ? source.kind : "tip"}`);
  if (!source) {
    label.textContent = "Source not listed";
    return label;
  }
  const parts = [source.typeLabel, source.shortTitle || source.title];
  if (source.kind === "official" && source.lastChecked) {
    const [y, m, d] = source.lastChecked.split("-").map(Number);
    parts.push(`verified ${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`);
  }
  label.textContent = parts.join(" · ");
  label.title = source.title + (source.cohort ? `, cohort ${source.cohort}` : "");
  return label;
}
