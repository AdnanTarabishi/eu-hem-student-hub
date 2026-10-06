// University data and small, testable helpers. Rendering lives in universities.js.
// Programme routes are derived from content/tracks.json, never copied into this file.
(function universityDataModule(root) {
  "use strict";

  const CONTENT_URL = "content/universities.json";
  const CHECKLIST_PREFIX = "euhem-university-checklist-v1";
  const asArray = (value) => Array.isArray(value) ? value : [];

  function externalUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }

  // Campus photography is served with the site. Data cannot introduce a remote image.
  function imageUrl(value) {
    return typeof value === "string" && /^(?:img\/universities\/[a-zA-Z0-9._-]+|assets\/images\/cities\/[a-z0-9-]+\/[a-zA-Z0-9._-]+)\.(?:jpe?g|png|webp|avif)$/i.test(value) ? value : null;
  }

  function validateFile(file) {
    if (!file || file.schemaVersion !== 1 || !Array.isArray(file.universities) || !file.universities.length) {
      throw new Error("The university guide file is missing or has an unsupported format.");
    }
    const ids = new Set();
    const allSourceIds = new Set();
    for (const university of file.universities) {
      if (!university || typeof university.id !== "string" || !/^[a-z0-9-]+$/.test(university.id) || ids.has(university.id)) {
        throw new Error("The university guide contains an invalid or duplicate university ID.");
      }
      ids.add(university.id);
      for (const field of ["name", "city", "country", "summary"]) {
        if (typeof university[field] !== "string" || !university[field].trim()) {
          throw new Error(`The ${university.id} guide is missing its ${field}.`);
        }
      }
      const sources = new Map();
      for (const source of asArray(university.sources)) {
        if (!source || typeof source.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(source.id) || allSourceIds.has(source.id) || !externalUrl(source.url)) {
          throw new Error(`The ${university.id} guide contains an invalid source.`);
        }
        sources.set(source.id, source);
        allSourceIds.add(source.id);
      }
      const stepIds = new Set();
      for (const step of asArray(university.gettingStarted)) {
        if (!step || typeof step.id !== "string" || !step.id || stepIds.has(step.id)) {
          throw new Error(`The ${university.id} checklist contains an invalid or duplicate step ID.`);
        }
        stepIds.add(step.id);
      }
      // Check references recursively, including places, FAQs, links and ranking entries.
      function checkReferences(value) {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) { value.forEach(checkReferences); return; }
        if (Array.isArray(value.sourceIds) && value.sourceIds.some((id) => !sources.has(id))) {
          throw new Error(`A source reference in the ${university.id} guide could not be found.`);
        }
        if (typeof value.sourceId === "string" && !sources.has(value.sourceId)) {
          throw new Error(`A ranking source in the ${university.id} guide could not be found.`);
        }
        Object.values(value).forEach(checkReferences);
      }
      checkReferences(university);
    }
    return file;
  }

  async function readLocalText(path, signal) {
    const response = await fetch(path, { signal, credentials: "same-origin" });
    if (!response.ok) throw new Error(`The guide could not be loaded (${response.status}).`);
    return response.text();
  }

  async function loadFile(options = {}) {
    const text = await (options.read || readLocalText)(CONTENT_URL, options.signal);
    return validateFile(JSON.parse(text));
  }

  function resolveCohort(file, requested) {
    const cohorts = asArray(file && file.cohorts).filter((cohort) => cohort && typeof cohort.id === "string" && Array.isArray(cohort.tracks));
    const cohort = requested ? cohorts.find((item) => item.id === requested) || null : cohorts[cohorts.length - 1] || null;
    return { cohort, cohorts, unavailable: Boolean(requested && !cohort) };
  }

  // Includes common teaching, track semesters and explicitly listed thesis options.
  function universityRoles(cohort, universityId, trackId = "") {
    if (!cohort || !Array.isArray(cohort.tracks)) return [];
    const tracks = cohort.tracks.filter((track) => !trackId || track.id === trackId);
    if (!tracks.length) return [];
    const roles = [];
    if (cohort.semester1 && cohort.semester1.university === universityId) {
      roles.push({ semester: 1, kind: "common", tracks, text: cohort.semester1.summary || "" });
    }
    const semesters = new Map();
    for (const track of tracks) {
      for (const semester of asArray(track.semesters)) {
        if (semester.university !== universityId) continue;
        if (!semesters.has(semester.number)) semesters.set(semester.number, []);
        if (!semesters.get(semester.number).some((item) => item.id === track.id)) semesters.get(semester.number).push(track);
      }
    }
    for (const [semester, members] of [...semesters].sort((a, b) => a[0] - b[0])) {
      roles.push({ semester, kind: "teaching", tracks: members });
    }
    const thesisTracks = tracks.filter((track) => asArray(track.thesis).includes(universityId));
    if (thesisTracks.length) roles.push({ semester: 4, kind: "thesis", tracks: thesisTracks });
    return roles;
  }

  function roleLabel(role, compact = false) {
    if (role.kind === "common") return "Semester 1 · Common foundation";
    const names = role.tracks.map((track) => compact ? track.abbr || track.name : track.name).join(compact ? ", " : "; ");
    return `Semester ${role.semester} · ${role.kind === "thesis" ? "Thesis option: " : ""}${names}`;
  }

  function resolveComparison(universities, requested) {
    const list = asArray(universities);
    const ids = list.map((item) => item.id);
    const wanted = typeof requested === "string" ? requested.split(",") : [];
    const valid = wanted.length === 2 && wanted[0] !== wanted[1] && wanted.every((id) => ids.includes(id));
    return { ids: valid ? wanted : ids.slice(0, 2), invalid: Boolean(requested && !valid) };
  }

  function pageUrl(page, options = {}) {
    const params = new URLSearchParams();
    for (const key of ["id", "cohort", "track", "compare"]) if (options[key]) params.set(key, options[key]);
    return `${page}${params.size ? "?" + params.toString() : ""}${options.hash ? "#" + encodeURIComponent(options.hash) : ""}`;
  }

  function sourceAnchor(sourceId) { return "university-source-" + sourceId; }
  function checklistKey(universityId, cohortId) { return `${CHECKLIST_PREFIX}:${universityId}:${cohortId || "general"}`; }

  function readChecklist(storage, key, itemIds) {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return { completed: [], available: true, corrupted: false };
      let parsed;
      try { parsed = JSON.parse(raw); } catch { return { completed: [], available: true, corrupted: true }; }
      if (!parsed || !Array.isArray(parsed.completed)) return { completed: [], available: true, corrupted: true };
      return { completed: [...new Set(parsed.completed.filter((id) => typeof id === "string" && itemIds.includes(id)))], available: true, corrupted: false };
    } catch { return { completed: [], available: false, corrupted: false }; }
  }

  function writeChecklist(storage, key, completed) {
    try { storage.setItem(key, JSON.stringify({ completed: [...completed] })); return true; }
    catch { return false; }
  }

  // Product UI helpers stay independent from rendering and never write curriculum data.
  const RESOURCE_CATEGORIES = { academic: "Study & exams", digital: "Digital & IT", library: "Library & spaces", support: "Support & languages", careers: "Careers", campus: "Campus" };

  function normaliseSearch(value) {
    return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function collectResources(universities) {
    const result = [];
    for (const university of asArray(universities)) {
      const seen = new Map();
      for (const [group, records] of [["resources", university.resources], ["quickLinks", university.quickLinks], ["services", university.services]]) {
        asArray(records).forEach((record, index) => {
          const url = externalUrl(record.url);
          if (!url) return;
          const identity = url.replace(/\/$/, "");
          const title = record.title || record.label || "University resource";
          const searchText = normaliseSearch([title, record.text || record.description, university.name, university.shortName, university.city, record.category].join(" "));
          if (seen.has(identity)) {
            const existing = seen.get(identity);
            existing.searchText += " " + searchText;
            existing.sourceIds = [...new Set([...existing.sourceIds, ...asArray(record.sourceIds)])];
            return;
          }
          const item = { id: `${university.id}:${group}:${record.id || index}`, universityId: university.id, universityName: university.name,
            title, text: record.text || record.description || "", url, access: record.access || "Check the official page for current access requirements.",
            category: RESOURCE_CATEGORIES[record.category] ? record.category : "academic", sourceIds: asArray(record.sourceIds), searchText };
          seen.set(identity, item); result.push(item);
        });
      }
    }
    return result;
  }

  // Keep the first visible results balanced across the four partners; never rank universities.
  function balanceResources(records) {
    const queues = new Map();
    for (const record of asArray(records)) {
      if (!queues.has(record.universityId)) queues.set(record.universityId, []);
      queues.get(record.universityId).push(record);
    }
    const result = []; let index = 0, added = true;
    while (added) {
      added = false;
      for (const group of queues.values()) if (index < group.length) { result.push(group[index]); added = true; }
      index++;
    }
    return result;
  }

  function filterResources(records, options = {}) {
    const terms = normaliseSearch(options.query).split(/\s+/).filter(Boolean);
    return asArray(records).filter((item) => (!options.university || item.universityId === options.university)
      && (!options.category || item.category === options.category)
      && terms.every((term) => item.searchText.includes(term) || normaliseSearch(RESOURCE_CATEGORIES[item.category]).includes(term)));
  }

  function trackJourney(cohort, trackId) {
    const track = cohort && asArray(cohort.tracks).find((item) => item.id === trackId);
    if (!track) return [];
    const steps = [];
    if (cohort.semester1 && cohort.semester1.university) steps.push({ semester: 1, universities: [cohort.semester1.university], kind: "common" });
    for (const semester of asArray(track.semesters)) steps.push({ semester: semester.number, universities: [semester.university], kind: "teaching" });
    if (asArray(track.thesis).length) steps.push({ semester: 4, universities: [...track.thesis], kind: "thesis" });
    return steps.sort((a, b) => a.semester - b.semester);
  }

  const api = { balanceResources, RESOURCE_CATEGORIES, normaliseSearch, collectResources, filterResources, trackJourney, CONTENT_URL, CHECKLIST_PREFIX, asArray, externalUrl, imageUrl, validateFile, readLocalText, loadFile,
    resolveCohort, universityRoles, roleLabel, resolveComparison, pageUrl, sourceAnchor, checklistKey, readChecklist, writeChecklist };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.UniversityData = api;
})(typeof window !== "undefined" ? window : null);