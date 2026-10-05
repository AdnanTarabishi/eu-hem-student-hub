// ===== Students explorer: data rules (no page code here) =====
// Pure functions used by students.js and by the tests (tests/students/). Nothing here touches the page.
//
// The order is fixed and matters for privacy (docs/students-explorer.md → "Processing order"):
//   1. projectProfile   private record  -> what THIS viewer may see (or nothing)
//   2. field rules      inside projectProfile: a detail is never more visible than its profile
//   3. filterProfiles   filters run on the projected copy only, so a hidden detail can never match
//   4. counts           facetCounts / summarize count projected, filtered profiles only
//   5. paginate         last
// So nothing a viewer cannot see can influence a result, a count, a map colour or a page number.

// The details a profile can show, each with its own visibility
const PROFILE_FIELDS = ["photo", "country", "field", "degree", "university", "track", "bio", "linkedin"];

// Wider = higher number. Unknown values count as "hidden" (fail closed).
const VISIBILITY_RANK = { hidden: 0, cohort: 1, public: 2 };

const CITIZENSHIP_GROUPS = ["eu_eea_swiss", "non_eu_eea_swiss"];
const VISA_ANSWERS = ["yes", "no", "not_sure", "not_applicable"];

// The only track values the explorer shows: the four current tracks and two non-track answers.
// Anything else (e.g. a former specialisation) is kept in the private record but shown neutrally.
const TRACK_VALUES = ["eeh", "ep", "mhi", "phm", "not_chosen", "prefer_not_to_share"];
const MEMBERSHIP_VALUES = ["current_student", "alumni"];

// The viewer. "member" (verified EU-HEM member) is only a DEMO preview: it is honoured for demo records
// only. Real members-only data will need a real login checked on a server (Phase 2), so no URL
// parameter, config value or localStorage flag can ever unlock a real record.
function makeViewer(mode) {
  return { mode: mode === "member" ? "member" : "public" };
}

function rankOf(value) {
  return Object.prototype.hasOwnProperty.call(VISIBILITY_RANK, value) ? VISIBILITY_RANK[value] : 0;
}

function canSee(rank, isMember) {
  return rank === 2 || (rank === 1 && isMember);
}

// 1 + 2. Returns a NEW object built from an allowlist, or null when the viewer may not see the profile.
// Only approved, email-verified, role-verified records are ever shown.
function projectProfile(record, viewer) {
  if (!record || typeof record !== "object") return null;
  if (record.emailVerified !== true || record.roleVerification !== "verified" || record.adminStatus !== "approved") return null;
  const name = typeof record.fullName === "string" ? record.fullName.trim() : "";
  if (!name || typeof record.id !== "string") return null;

  const isMember = Boolean(viewer && viewer.mode === "member" && record.isDemo === true);
  const profileRank = rankOf(record.profileVisibility);
  if (!canSee(profileRank, isMember)) return null;

  const fieldVisibility = record.fieldVisibility && typeof record.fieldVisibility === "object" ? record.fieldVisibility : {};
  const shows = (field) => canSee(Math.min(profileRank, rankOf(fieldVisibility[field])), isMember);

  const profile = {
    id: record.id,
    isDemo: record.isDemo === true,
    name,
    cohort: record.cohort || null,
    membership: MEMBERSHIP_VALUES.includes(record.membershipStatus) ? record.membershipStatus : null,
    membersOnly: profileRank === 1,
  };
  if (shows("country") && record.primaryCountryCode) {
    profile.country = { code: record.primaryCountryCode, name: record.primaryCountryName || record.primaryCountryCode };
    if (record.additionalCountryCode) {
      profile.additionalCountry = { code: record.additionalCountryCode, name: record.additionalCountryName || record.additionalCountryCode };
    }
  }
  if (shows("field") && record.previousFieldId) profile.field = { id: record.previousFieldId, label: record.previousFieldLabel || record.previousFieldId };
  if (shows("degree") && record.previousDegreeId) profile.degree = { id: record.previousDegreeId, label: record.previousDegreeLabel || record.previousDegreeId };
  if (shows("university") && record.previousUniversity) profile.university = record.previousUniversity;
  if (shows("track") && record.trackId) profile.track = TRACK_VALUES.includes(record.trackId) ? record.trackId : "unlisted";
  if (shows("bio") && record.shortBio) profile.bio = record.shortBio;
  if (shows("linkedin") && record.linkedin) {
    // Demo records only ever carry the word "example": the page shows a link that goes nowhere
    if (profile.isDemo) profile.linkedin = "example";
    else if (/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[\w%-]+\/?$/i.test(record.linkedin)) profile.linkedin = record.linkedin;
  }
  if (shows("photo") && record.photo && !profile.isDemo) profile.photo = record.photo;

  // Citizenship group and study-visa experience: private unless the person chose "verified members",
  // never public, and only the substantive answers. Never inferred from country, name or anything else.
  if (isMember && record.citizenshipVisibility === "cohort" && CITIZENSHIP_GROUPS.includes(record.citizenshipGroup)) {
    profile.citizenshipGroup = record.citizenshipGroup;
  }
  if (isMember && record.studyVisaExperienceVisibility === "cohort" && VISA_ANSWERS.includes(record.studyVisaExperience)) {
    profile.studyVisaExperience = record.studyVisaExperience;
  }
  return profile;
}

function projectAll(records, viewer) {
  return (records || []).map((r) => projectProfile(r, viewer)).filter(Boolean);
}

// ----- 3. Filters -----
// filters = { cohort: [], country: [], track: [], background: [], degree: [], membership: [],
//             citizenship: [], visa: [], hasLinkedin: false, q: "", savedIds: null | [] }
// Several values in one category = OR ("Italy or Norway"); different categories = AND.
// FILTER_KEYS may go in a shareable address; MEMBER_FILTER_KEYS (citizenship, visa) never do.
const FILTER_KEYS = ["cohort", "country", "track", "background", "degree"];
const MEMBER_FILTER_KEYS = ["citizenship", "visa"];
const ALL_FILTER_KEYS = [...FILTER_KEYS, "membership", ...MEMBER_FILTER_KEYS];

const FILTER_VALUE = {
  cohort: (p) => p.cohort,
  country: (p) => p.country && p.country.code,
  track: (p) => p.track,
  background: (p) => p.field && p.field.id,
  degree: (p) => p.degree && p.degree.id,
  membership: (p) => p.membership,
  citizenship: (p) => p.citizenshipGroup, // present only when shared with members (projection)
  visa: (p) => p.studyVisaExperience,
};

function normalizeText(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function searchText(profile, labels) {
  const trackLabel = profile.track && labels && labels.tracks ? labels.tracks[profile.track] : "";
  return normalizeText([trackLabel,
    profile.name, profile.country && profile.country.name, profile.additionalCountry && profile.additionalCountry.name,
    profile.field && profile.field.label, profile.degree && profile.degree.label, profile.university, profile.bio,
  ].filter(Boolean).join(" "));
}

function matches(profile, filters, skipKey) {
  for (const key of ALL_FILTER_KEYS) {
    if (key === skipKey) continue;
    const wanted = filters[key];
    if (wanted && wanted.length && !wanted.includes(FILTER_VALUE[key](profile))) return false;
  }
  if (filters.hasLinkedin && !profile.linkedin) return false;
  if (filters.savedIds && !filters.savedIds.includes(profile.id)) return false;
  const q = normalizeText(filters.q).trim();
  if (q && !q.split(/\s+/).every((word) => searchText(profile, filters.labels).includes(word))) return false;
  return true;
}

function filterProfiles(profiles, filters) {
  return profiles.filter((p) => matches(p, filters || {}));
}

// ----- 4. Counts -----
// Faceted counts: how many profiles each value of `key` would show, with every OTHER filter applied.
// The map uses key "country", so its colours follow the other filters but not its own selection.
function facetCounts(profiles, filters, key) {
  const counts = {};
  for (const p of profiles) {
    if (!matches(p, filters || {}, key)) continue;
    const value = FILTER_VALUE[key](p);
    if (value) counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

// Totals for the "insights" panel, from already projected and filtered profiles
function summarize(profiles) {
  const tally = (fn) => profiles.reduce((m, p) => { const k = fn(p); if (k) m[k] = (m[k] || 0) + 1; return m; }, {});
  return {
    total: profiles.length,
    countries: tally((p) => p.country && p.country.code),
    tracks: tally((p) => p.track),
    fields: tally((p) => p.field && p.field.id),
    withoutCountry: profiles.filter((p) => !p.country).length,
  };
}

// ----- Disclosure control for statistics about people who are NOT individually visible -----
// counts = { category: number }. Rules (docs/students-explorer.md → "Statistics"):
//   - nothing is published when the whole group is smaller than minGroup;
//   - any category with 1..minGroup-1 people is suppressed;
//   - if exactly one category is suppressed, the next smallest one is suppressed too (complementary
//     suppression), so the hidden number cannot be worked out by subtraction from the total;
//   - if no category is left to show, nothing is published.
const NOT_ENOUGH_DATA = "Not enough publishable data for this breakdown.";

function safeBreakdown(counts, minGroup) {
  const entries = Object.entries(counts || {}).map(([k, n]) => [k, Math.max(0, Number(n) || 0)]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  const none = () => ({ publishable: false, total: null, cells: Object.fromEntries(entries.map(([k]) => [k, null])), message: NOT_ENOUGH_DATA });
  if (total < minGroup) return none();

  const hidden = new Set(entries.filter(([, n]) => n > 0 && n < minGroup).map(([k]) => k));
  if (hidden.size === 1) {
    const next = entries.filter(([k, n]) => !hidden.has(k) && n > 0).sort((a, b) => a[1] - b[1])[0];
    if (!next) return none();
    hidden.add(next[0]);
  }
  if (entries.every(([k, n]) => hidden.has(k) || n === 0)) return none();
  return {
    publishable: true,
    total,
    cells: Object.fromEntries(entries.map(([k, n]) => [k, hidden.has(k) ? null : n])),
    message: hidden.size ? "Some small groups are hidden to protect privacy." : "",
  };
}

// ----- Sorting and 5. pagination -----
// Sorts by the full name as written (no guessing of first/last names). Missing values go last, and
// ties fall back to name, then id, so the order never jumps. labels = { tracks: {id: label} }
const SORTS = ["name", "country", "background", "track", "cohort"];

function sortProfiles(profiles, by, labels) {
  const text = (v) => (v == null ? null : String(v));
  const key = {
    name: () => null,
    country: (p) => text(p.country && p.country.name),
    background: (p) => text(p.field && p.field.label),
    track: (p) => text(p.track && labels && labels.tracks ? labels.tracks[p.track] || p.track : p.track),
    cohort: () => null,
  }[SORTS.includes(by) ? by : "name"];
  const compare = (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });
  return [...profiles].sort((a, b) => {
    if (by === "cohort" && a.cohort !== b.cohort) {
      if (!a.cohort) return 1;
      if (!b.cohort) return -1;
      return compare(b.cohort, a.cohort); // newest first
    }
    const ka = key(a), kb = key(b);
    if (ka !== kb) {
      if (ka == null) return 1;
      if (kb == null) return -1;
      const c = compare(ka, kb);
      if (c) return c;
    }
    return compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

function paginate(items, page, size) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages };
}

// ----- Safe page-address (URL) state -----
// Only these keys are ever read from or written to the address. Citizenship and visa answers are
// never part of it. Unknown values are dropped. `allowed` = { cohort: [...ids], country: [...], ... }
const URL_KEYS = ["cohort", "country", "track", "background", "degree", "view", "profile"];

function readUrlState(search, allowed) {
  const params = new URLSearchParams(search || "");
  const state = { view: "cards", profile: null };
  for (const key of FILTER_KEYS) {
    const raw = params.get(key);
    state[key] = raw ? [...new Set(raw.split(",").filter((v) => (allowed[key] || []).includes(v)))] : [];
  }
  if (params.get("view") === "list") state.view = "list";
  const profile = params.get("profile");
  if (profile && /^[a-z0-9-]{1,40}$/.test(profile)) state.profile = profile;
  return state;
}

function writeUrlState(state) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) if (state[key] && state[key].length) params.set(key, state[key].join(","));
  if (state.view === "list") params.set("view", "list");
  if (state.profile) params.set("profile", state.profile);
  const text = params.toString().replace(/%2C/g, ",");
  return text ? "?" + text : "";
}

// "Amara Okonkwo-Lindqvist" -> "AO"
function initialsOf(name) {
  const words = String(name || "").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

const EUHEM_STUDENTS_DATA = {
  PROFILE_FIELDS, FILTER_KEYS, MEMBER_FILTER_KEYS, ALL_FILTER_KEYS, URL_KEYS, SORTS, TRACK_VALUES, CITIZENSHIP_GROUPS, VISA_ANSWERS, NOT_ENOUGH_DATA,
  makeViewer, projectProfile, projectAll, filterProfiles, facetCounts, summarize, safeBreakdown,
  sortProfiles, paginate, readUrlState, writeUrlState, initialsOf, normalizeText,
};
if (typeof module !== "undefined") module.exports = EUHEM_STUDENTS_DATA;
else window.EUHEM_STUDENTS_DATA = EUHEM_STUDENTS_DATA;
