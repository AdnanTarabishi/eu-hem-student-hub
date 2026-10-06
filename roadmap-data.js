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
const VERSION_PATTERN = /^v\d+\.\d+$/; // "v0.9", "v1.0"
const MAX_NOW = 2; // one or two items in Now
const MAX_DATED_NEXT = 4; // at most four Next items with a date; the rest are "After launch"
const AFTER_LAUNCH = "After launch";
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
    // Towards the full vision (optional block): progress is counted from releases, the finish is a season
    const vision = roadmap.vision;
    if (vision !== undefined) {
      if (!vision || !isText(vision.title) || !isText(vision.note) || !isText(vision.targetLabel)) {
        error("roadmap.vision", "needs a title, a note and a targetLabel (e.g. \"Spring 2027\")");
      }
      // Optional: the team's own estimate of how much of the full plan is built (shown next to the release count)
      if (vision && vision.progressPercent !== undefined &&
        (!Number.isInteger(vision.progressPercent) || vision.progressPercent < 0 || vision.progressPercent > 100)) {
        error("roadmap.vision.progressPercent", "must be a whole number from 0 to 100");
      }
    }
    // Release stage and the next release (optional block)
    const release = roadmap.release;
    if (release !== undefined) {
      if (!release || !isText(release.stage) || !VERSION_PATTERN.test(release.version || "") || !isText(release.note)) {
        error("roadmap.release", 'needs a stage, a version like "v0.9" and a note');
      } else {
        const next = release.next;
        if (!next || !VERSION_PATTERN.test(next.version || "") || !isText(next.name) || !isDate(next.targetDate)) {
          error("roadmap.release.next", 'needs a version like "v1.0", a name and a real targetDate');
        }
        const itemIds = new Set((Array.isArray(roadmap.items) ? roadmap.items : []).map((i) => i && i.id));
        const published = new Set(((updates && updates.items) || []).filter((u) => u && u.status === "published").map((u) => u.id));
        ((next && next.includes) || []).forEach((entry, i) => {
          const where = `roadmap.release.next.includes[${i}]`;
          if (!entry || !isText(entry.label)) return error(where, "needs a label");
          if (entry.item ? !itemIds.has(entry.item) : !published.has(entry.update)) {
            error(where, "must point to a roadmap item (item) or a published update (update)");
          }
        });
      }
    }
    // Known limitations and the domain move (optional blocks with a title and a list of texts)
    for (const key of ["limitations", "domainMove"]) {
      const block = roadmap[key];
      if (block !== undefined && (!block || !isText(block.title) || !Array.isArray(block.items) || !block.items.length || block.items.some((t) => !isText(t)))) {
        error(`roadmap.${key}`, "needs a title and a list of plain texts");
      }
    }
    if (roadmap.feedback !== undefined) checkLinks([roadmap.feedback], "roadmap.feedback");
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
      if (item.note !== undefined && !isText(item.note)) error(where, "note must be one line of plain text");
      if (item.lane === "later" && item.target !== null) error(where, "Later ideas have no target (use null)");
      if (item.lane === "now" && !item.target) error(where, "a Now item needs a target");
      // Next items without a date are shown as "After launch" (target null)
      if (item.lane !== "later" && item.target !== null) {
        const t = item.target;
        if (!t || !isMonth(t.start) || !isMonth(t.end) || t.start > t.end || !isText(t.label)) {
          error(where, 'target needs start and end months ("YYYY-MM", start ≤ end) and a label');
        } else if (t.date !== undefined && (!isDate(t.date) || t.date.slice(0, 7) < t.start || t.date.slice(0, 7) > t.end)) {
          error(where, "target.date must be a real date inside the target months");
        }
      }
      checkLinks(item.links, `${where}.links`);
    });
    const nowCount = items.filter((item) => item && item.lane === "now").length;
    if (nowCount < 1 || nowCount > MAX_NOW) error("roadmap.items", `Now must have one or ${MAX_NOW} items (it has ${nowCount})`);
    const datedNext = items.filter((item) => item && item.lane === "next" && item.target).length;
    if (datedNext > MAX_DATED_NEXT) error("roadmap.items", `at most ${MAX_DATED_NEXT} Next items may have a date (${datedNext} do); show the rest as "After launch" (target null)`);
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
      if (item.status === "published" && !VERSION_PATTERN.test(item.version || "")) error(where, 'a published update needs a version like "v0.9"');
      if (item.status === "draft" && item.version !== null && item.version !== undefined && !VERSION_PATTERN.test(item.version)) {
        error(where, 'version must look like "v1.0" (or null on a draft)');
      }
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
  const v = data.vision;
  const vision = v && isText(v.title) && isText(v.targetLabel)
    ? { title: v.title, note: v.note, targetLabel: v.targetLabel,
      progressPercent: Number.isInteger(v.progressPercent) ? Math.min(100, Math.max(0, v.progressPercent)) : null }
    : null;
  const r = data.release;
  const release = r && isText(r.stage) && VERSION_PATTERN.test(r.version || "") && r.next && isDate(r.next.targetDate)
    ? { stage: r.stage, version: r.version, note: r.note, next: { ...r.next, includes: (r.next.includes || []).filter((e) => e && isText(e.label)) } }
    : null;
  const block = (b) => (b && isText(b.title) && Array.isArray(b.items) ? { title: b.title, items: b.items.filter(isText) } : null);
  return {
    updatedAt: data.updatedAt,
    vision,
    release,
    limitations: block(data.limitations),
    domainMove: block(data.domainMove),
    feedback: data.feedback && isText(data.feedback.label) && safeUrl(data.feedback.url) ? { label: data.feedback.label, url: safeUrl(data.feedback.url) } : null,
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
    if (!groups.has(key)) groups.set(key, { key, label: item.target ? item.target.label : AFTER_LAUNCH, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()].sort((a, b) => (a.key === "undecided") - (b.key === "undecided") || a.key.localeCompare(b.key));
}

// "15 releases shipped since 1 Oct 2026": counted from the published updates, never typed by hand
function releaseCount(updates) {
  const published = publishedUpdates(updates || {});
  const first = published.map((u) => u.date).sort()[0] || null;
  return { count: published.length, since: first, text: first ? `${published.length} release${published.length === 1 ? "" : "s"} shipped since ${shortDay(first)}` : "No releases yet" };
}

// "2026-10-01" -> "1 Oct 2026"
function shortDay(value) {
  const [y, m, d] = value.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

// The versions of the published updates, newest first: ["v0.9", "v0.5", ...]
function updateVersions(updates) {
  const versions = [...new Set(publishedUpdates(updates || {}).map((u) => u.version).filter((v) => VERSION_PATTERN.test(v || "")))];
  const key = (v) => v.slice(1).split(".").map(Number);
  return versions.sort((a, b) => { const [a1, a2] = key(a), [b1, b2] = key(b); return b1 - a1 || b2 - a2; });
}

// Whole days from "today" (YYYY-MM-DD) to a target date; negative when it has passed
function daysUntil(today, target) {
  const toUtc = (value) => { const [y, m, d] = value.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtc(target) - toUtc(today)) / 86400000);
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
      const when = item.target ? item.target.label : item.lane === "next" ? AFTER_LAUNCH : "no date yet";
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
  isDate, isMonth, dayLabel, shortDay, dateInRome, daysUntil, safeUrl, isRunUrl, validate, readRoadmap, publishedUpdates, groupNext,
  releaseCount, updateVersions, VERSION_PATTERN, MAX_NOW, MAX_DATED_NEXT, AFTER_LAUNCH,
  matchesQuery, searchEntries, simplify,
};
if (typeof module !== "undefined") module.exports = EUHEM_ROADMAP;
else window.EUHEM_ROADMAP = EUHEM_ROADMAP;
