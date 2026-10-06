// ===== Roadmap & Updates: data rules (no page code here) =====
// One place for reading content/roadmap.json and content/updates.json, used by:
//   roadmap.js (the page) · home.js (homepage preview) · search.js (site search)
//   scripts/check-content.js (validation) · scripts/updates.js (draft/publish helper) · tests/roadmap/
// So a rule changes in one place. Format and workflow: docs/roadmap.md.
//
// Honesty rules enforced here:
// - Drafts never reach a page, the homepage or search (only status "published" updates are shown).
// - A published update needs a real date and evidence of a successful site deployment.
// - Roadmap items are never "released": when a plan ships, it leaves roadmap.json and becomes an update.

const ROADMAP_STATUS = {
  "in-progress": "In progress",
  planned: "Planned",
  exploring: "Exploring",
};
const RELEASED_LABEL = "Released";

// Which statuses each stage allows
const LANE_STATUSES = { now: ["in-progress"], next: ["planned", "in-progress"], later: ["exploring"] };
const UPDATE_TYPES = { new: "New", improved: "Improved" };
const MILESTONE_STATUSES = ["completed", "planned"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December"];
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const REPOSITORY = "AdnanTarabishi/eu-hem-student-hub";

const isText = (value) => typeof value === "string" && value.trim() !== "" && !/<\/?[a-z][^>]*>/i.test(value);

function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const isMonth = (value) => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

// "2026-10-05" -> "5 October 2026" (a calendar date, not a moment in time)
function dayLabel(value) {
  const [y, m, d] = value.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// The calendar day of a moment in Rome, e.g. "2026-10-06T00:54:30+02:00" -> "2026-10-06"
function dateInRome(timestamp) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(timestamp));
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Links: a page of this site ("tracks.html", "roadmap.html#updates") or an https:// address
function safeUrl(value) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || /[\s\\]/.test(url)) return null;
  if (/^https:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      return parsed.username || parsed.password ? null : parsed.href;
    } catch {
      return null;
    }
  }
  return /^[a-z0-9][a-z0-9_-]*\.html(?:\?[^#]*)?(?:#[\w-]*)?$/i.test(url) ? url : null;
}

const isRunUrl = (url) => new RegExp(`^https://github\\.com/${REPOSITORY}/actions/runs/\\d+$`, "i").test(url || "");
const isCommitUrl = (url, sha) => (url || "").toLowerCase() === `https://github.com/${REPOSITORY}/commit/${sha}`.toLowerCase();

// ----- Validation: returns a list of problems (empty = valid). Used by check-content.js. -----
// options.today ("YYYY-MM-DD") rejects dates in the future; options.pageExists(file) checks local links.
function validate(roadmap, updates, options = {}) {
  const errors = [];
  const error = (where, message) => errors.push(`${where}: ${message}`);
  const today = options.today || null;
  const checkLinks = (links, where) => {
    if (links === undefined) return;
    if (!Array.isArray(links)) return error(where, "must be a list");
    links.forEach((link, i) => {
      if (!link || !isText(link.label)) error(`${where}[${i}]`, "needs a label");
      const url = safeUrl(link && link.url);
      if (!url) error(`${where}[${i}]`, `"${link && link.url}" must be a page of this site (e.g. tracks.html) or an https:// address`);
      else if (!/^https:/.test(url) && options.pageExists && !options.pageExists(url.split(/[?#]/)[0])) {
        error(`${where}[${i}]`, `page ${url.split(/[?#]/)[0]} does not exist`);
      }
    });
  };
  const uniqueIds = (list, where) => {
    const seen = new Set();
    list.forEach((item, i) => {
      if (!item || !ID_PATTERN.test(item.id || "")) error(`${where}[${i}]`, "id must be lowercase words joined by hyphens");
      else if (seen.has(item.id)) error(`${where}[${i}]`, `duplicate id "${item.id}"`);
      else seen.add(item.id);
    });
  };

  // roadmap.json
  if (!roadmap || roadmap.schemaVersion !== 1) error("roadmap", "schemaVersion must be 1");
  else {
    if (!isDate(roadmap.updatedAt)) error("roadmap.updatedAt", "must be a real YYYY-MM-DD date");
    else if (today && roadmap.updatedAt > today) error("roadmap.updatedAt", "cannot be in the future");
    if (!isText(roadmap.planningNote)) error("roadmap.planningNote", "is required");
    const categories = Array.isArray(roadmap.categories) ? roadmap.categories : [];
    uniqueIds(categories, "roadmap.categories");
    categories.forEach((c, i) => { if (!isText(c.label)) error(`roadmap.categories[${i}]`, "needs a label"); });
    const categoryIds = new Set(categories.map((c) => c.id));
    const lanes = Array.isArray(roadmap.lanes) ? roadmap.lanes : [];
    for (const id of Object.keys(LANE_STATUSES)) {
      const lane = lanes.find((l) => l && l.id === id);
      if (!lane || !isText(lane.title) || !isText(lane.description)) error("roadmap.lanes", `needs "${id}" with a title and description`);
    }
    const items = Array.isArray(roadmap.items) ? roadmap.items : [];
    uniqueIds(items, "roadmap.items");
    items.forEach((item, i) => {
      const where = `roadmap.items[${i}] (${item && item.id})`;
      if (!item) return;
      for (const field of ["title", "summary", "why"]) if (!isText(item[field])) error(where, `${field} is required (plain text)`);
      if (!categoryIds.has(item.category)) error(where, `unknown category "${item.category}"`);
      if (!LANE_STATUSES[item.lane]) error(where, `lane must be now, next or later`);
      else if (!LANE_STATUSES[item.lane].includes(item.status)) {
        error(where, `status "${item.status}" is not allowed in ${item.lane} (allowed: ${LANE_STATUSES[item.lane].join(", ")})`);
      }
      for (const field of ["details", "dependencies"]) {
        if (!Array.isArray(item[field]) || item[field].some((t) => !isText(t))) error(where, `${field} must be a list of plain texts`);
      }
      if (item.lane === "later" && item.target !== null) error(where, "Later ideas have no target (use null)");
      if (item.lane !== "later") {
        const t = item.target;
        if (!t || !isMonth(t.start) || !isMonth(t.end) || t.start > t.end || !isText(t.label)) {
          error(where, 'target needs start and end months ("YYYY-MM", start ≤ end) and a label');
        } else if (t.date !== undefined && (!isDate(t.date) || t.date.slice(0, 7) < t.start || t.date.slice(0, 7) > t.end)) {
          error(where, "target.date must be a real date inside the target months");
        }
      }
      checkLinks(item.links, `${where}.links`);
    });
    if (items.filter((item) => item && item.lane === "now").length !== 1) error("roadmap.items", "exactly one item must be in Now");
    const milestones = Array.isArray(roadmap.milestones) ? roadmap.milestones : [];
    uniqueIds(milestones, "roadmap.milestones");
    milestones.forEach((m, i) => {
      const where = `roadmap.milestones[${i}] (${m && m.id})`;
      if (!m) return;
      if (!isDate(m.date)) error(where, "date must be a real YYYY-MM-DD date");
      if (!MILESTONE_STATUSES.includes(m.status)) error(where, "status must be completed or planned");
      if (m.status === "completed" && today && m.date > today) error(where, "a completed milestone cannot be in the future");
      if (!isText(m.title) || !isText(m.summary)) error(where, "title and summary are required");
      if (m.source !== undefined) checkLinks([m.source], `${where}.source`);
    });
  }

  // updates.json
  if (!updates || updates.schemaVersion !== 1) error("updates", "schemaVersion must be 1");
  else {
    if (!isDate(updates.updatedAt)) error("updates.updatedAt", "must be a real YYYY-MM-DD date");
    if (!isText(updates.dateBasis)) error("updates.dateBasis", "is required");
    const categoryIds = new Set(((roadmap && roadmap.categories) || []).map((c) => c.id));
    const items = Array.isArray(updates.items) ? updates.items : [];
    uniqueIds(items, "updates.items");
    items.forEach((item, i) => {
      const where = `updates.items[${i}] (${item && item.id})`;
      if (!item) return;
      if (!isText(item.title) || !isText(item.summary)) error(where, "title and summary are required (plain text)");
      if (!categoryIds.has(item.category)) error(where, `unknown category "${item.category}"`);
      if (!UPDATE_TYPES[item.type]) error(where, "type must be new or improved");
      if (!Array.isArray(item.highlights) || item.highlights.some((t) => !isText(t))) error(where, "highlights must be a list of plain texts");
      checkLinks(item.links, `${where}.links`);
      if (item.status === "draft") {
        if (item.date !== null || item.evidence !== null) error(where, "a draft has date: null and evidence: null (publish it with scripts/updates.js)");
      } else if (item.status === "published") {
        if (!isDate(item.date)) return error(where, "a published update needs a real date");
        if (today && item.date > today) error(where, "a published update cannot be dated in the future");
        const ev = item.evidence;
        if (!ev || !isRunUrl(ev.deploymentUrl)) return error(where, "evidence.deploymentUrl must be a GitHub Actions run of this repository");
        if (typeof ev.deployedAt !== "string" || Number.isNaN(Date.parse(ev.deployedAt)) || !/[zZ]|[+-]\d\d:\d\d$/.test(ev.deployedAt)) {
          return error(where, "evidence.deployedAt must be a timestamp with a timezone");
        }
        if (dateInRome(ev.deployedAt) !== item.date) error(where, "date must be the deployment day in Rome time");
        const commits = Array.isArray(ev.commits) ? ev.commits : [];
        if (!commits.length) error(where, "evidence.commits needs at least one commit");
        const seen = new Set();
        commits.forEach((c, j) => {
          if (!c || !SHA_PATTERN.test(c.sha || "")) error(`${where}.evidence.commits[${j}]`, "sha must be a full 40-character commit id");
          else if (!isCommitUrl(c.url, c.sha)) error(`${where}.evidence.commits[${j}]`, "url must link to that commit in this repository");
          else if (seen.has(c.sha)) error(`${where}.evidence.commits[${j}]`, "duplicate commit");
          if (c && c.sha) seen.add(c.sha);
        });
      } else {
        error(where, "status must be draft or published");
      }
    });
  }
  return errors;
}

// ----- Reading for the pages (assumes validated data; skips anything malformed instead of breaking) -----

function readRoadmap(data) {
  const categories = (data.categories || []).filter((c) => c && ID_PATTERN.test(c.id));
  const items = (data.items || []).filter((item) => item && LANE_STATUSES[item.lane] && ROADMAP_STATUS[item.status] && isText(item.title))
    .map((item) => ({ ...item, links: (item.links || []).filter((l) => l && safeUrl(l.url)) }));
  return {
    updatedAt: data.updatedAt,
    planningNote: data.planningNote,
    categories,
    lanes: data.lanes || [],
    items,
    milestones: (data.milestones || []).filter((m) => m && isDate(m.date)).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// Published updates only, newest first (same day: later deployment first, then the order in the file)
function publishedUpdates(data) {
  const deployed = (item) => Date.parse((item.evidence && item.evidence.deployedAt) || "") || 0;
  return (data.items || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item && item.status === "published" && isDate(item.date) && UPDATE_TYPES[item.type])
    .sort((a, b) => b.item.date.localeCompare(a.item.date) || deployed(b.item) - deployed(a.item) || a.index - b.index)
    .map(({ item }) => ({ ...item, links: (item.links || []).filter((l) => l && safeUrl(l.url)) }));
}

// Next items grouped by their target window, in time order: [{ key, label, items }]
function groupNext(items) {
  const groups = new Map();
  for (const item of items.filter((i) => i.lane === "next")) {
    const key = item.target ? `${item.target.start}/${item.target.end}` : "undecided";
    if (!groups.has(key)) groups.set(key, { key, label: item.target ? item.target.label : "Timing to be decided", items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()].sort((a, b) => (a.key === "undecided") - (b.key === "undecided") || a.key.localeCompare(b.key));
}

function simplify(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Every word of the query must appear (title, summary, details, category, timing)
function matchesQuery(item, query, categoryLabel = "") {
  const words = simplify(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = simplify([item.title, item.summary, item.why, categoryLabel, item.target && item.target.label,
    item.date && dayLabel(item.date), ...(item.details || []), ...(item.highlights || []), ...(item.dependencies || [])].join(" "));
  return words.every((word) => text.includes(word));
}

// Entries for the site search. The status always leads the description, so a plan never looks available.
function searchEntries(roadmap, updates) {
  const list = [];
  if (roadmap) {
    for (const item of readRoadmap(roadmap).items) {
      const when = item.target ? item.target.label : "no date yet";
      list.push({
        type: "roadmap", title: item.title, url: `roadmap.html#feature-${item.id}`,
        status: ROADMAP_STATUS[item.status],
        meta: `${ROADMAP_STATUS[item.status]} · ${when} · not available yet`,
        text: `${item.summary} ${item.why} ${(item.details || []).join(" ")} roadmap`,
      });
    }
  }
  if (updates) {
    for (const item of publishedUpdates(updates)) {
      list.push({
        type: "update", title: item.title, url: `roadmap.html#update-${item.id}`,
        status: RELEASED_LABEL,
        meta: `${RELEASED_LABEL} · ${dayLabel(item.date)} · ${item.summary}`,
        text: `${item.summary} ${(item.highlights || []).join(" ")} update released`,
      });
    }
  }
  return list;
}

const EUHEM_ROADMAP = {
  ROADMAP_STATUS, RELEASED_LABEL, LANE_STATUSES, UPDATE_TYPES, MONTHS, ID_PATTERN, SHA_PATTERN, REPOSITORY,
  isDate, isMonth, dayLabel, dateInRome, safeUrl, isRunUrl, validate, readRoadmap, publishedUpdates, groupNext,
  matchesQuery, searchEntries, simplify,
};
if (typeof module !== "undefined") module.exports = EUHEM_ROADMAP;
else window.EUHEM_ROADMAP = EUHEM_ROADMAP;
