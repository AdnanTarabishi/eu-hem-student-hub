// ===== Past Thesis Explorer: data helpers =====
// Search, filters, counts and the address (URL) state for thesis.html. No page drawing here
// (that's thesis.js), so everything can be tested in Node. Uses simplify() from utils.js.
// Historical fields (cohort, legacy track, university) and Student Hub classifications (theme,
// current-track relevance, stated method; from content/thesis-enrichment.json) are filtered alike,
// but the classifications are attached to the records at load time and never stored in the archive.

const THESIS_ARCHIVE_URL = "content/thesis-archive.json";
const THESIS_CONFIG_URL = "content/thesis-config.json";
const THESIS_SORTS = { newest: "Newest cohort first", oldest: "Oldest cohort first", title: "Title A–Z" };
const THESIS_FILTERS = ["cohort", "track", "university", "theme", "currentTrack", "method"];
const THESIS_BROWSE_TABS = ["interest", "currentTrack", "legacy", "university"];

// Downloads the archive first, then the classification (so they do not share the bandwidth on slow
// connections), and returns two promises, so the page can show the archive before the classification:
// { source: Promise<{ archive, config }>, classification: Promise<{ enrichment, tracks }> }
function loadThesisFiles(read) {
  const get = async (url) => JSON.parse(read ? await read(url) : await (await fetch(url)).text());
  const source = Promise.all([get(THESIS_ARCHIVE_URL), get(THESIS_CONFIG_URL)])
    .then(([archive, config]) => ({ archive, config }));
  const classification = source
    .then(() => Promise.all([get("content/thesis-enrichment.json"), get("content/tracks.json")]))
    .then(([enrichment, tracks]) => ({ enrichment, tracks }));
  classification.catch(() => {}); // reported when awaited, not as an unhandled error
  return { source, classification };
}

// ----- Text -----

// "Cost-Effectiveness" -> "cost effectiveness": no accents, lower case, punctuation as spaces
function searchText(text) {
  return simplify(text).replace(/[^a-z0-9]+/g, " ").trim();
}

// Words of a title with their position in the original text, for highlighting:
// [{ word: "cost", start: 0, end: 4 }, …]
function titleWords(title) {
  const words = [];
  let current = null;
  for (let i = 0; i < title.length; i++) {
    const simple = simplify(title[i]);
    if (/^[a-z0-9]+$/.test(simple)) {
      if (!current) current = { word: "", start: i, end: i };
      current.word += simple;
      current.end = i + 1;
    } else if (current) {
      words.push(current);
      current = null;
    }
  }
  if (current) words.push(current);
  return words;
}

// "2020-2022" -> "2020–2022" (en dash for display)
function cohortLabel(cohort) {
  return cohort.replace("-", "–");
}

// ----- Search -----

// One query word against one title word: short words (3 letters or fewer) must be the whole word,
// longer ones can be the start of a word ("pharma" finds "pharmaceutical"). One plural rule:
// a word ending in "y" also finds "-ies" ("inequality" finds "inequalities", "policy" "policies").
function wordMatches(query, word) {
  if (query.length <= 3) return word === query;
  if (word.startsWith(query)) return true;
  return query.endsWith("y") && word.startsWith(`${query.slice(0, -1)}ies`);
}

// The query as "terms". Each term is a list of alternatives, each alternative a list of words that
// must appear one after another. Synonyms become alternatives of the same term:
// "covid-19 hospital" -> [[["covid"], ["covid","19"], ["covid19"]], [["hospital"]]]
function queryTerms(query, synonyms = []) {
  const words = searchText(query).split(" ").filter(Boolean);
  const groups = synonyms.map((group) => group.map((entry) => searchText(entry).split(" ").filter(Boolean)));
  const terms = [];
  let i = 0;
  while (i < words.length) {
    // The longest synonym entry that matches the query at this point
    let best = null;
    for (const group of groups) {
      for (const entry of group) {
        const fits = entry.length > 0 && entry.every((w, k) => words[i + k] === w);
        if (fits && (!best || entry.length > best.entry.length)) best = { group, entry };
      }
    }
    if (best) {
      terms.push(best.group);
      i += best.entry.length;
    } else {
      terms.push([[words[i]]]);
      i += 1;
    }
  }
  return terms;
}

// Indexes of the title words that match one alternative (consecutive words), or [] if none
function phraseMatches(phrase, words) {
  const hits = [];
  for (let start = 0; start + phrase.length <= words.length; start++) {
    if (phrase.every((q, k) => wordMatches(q, words[start + k]))) {
      for (let k = 0; k < phrase.length; k++) hits.push(start + k);
    }
  }
  return hits;
}

// All terms must match (any order). Returns the matched word indexes, or null if no match.
// Optional extra words (the places named in the title) can also satisfy a term; their indexes come
// after the title's (behind a separator that never matches), so only title words get highlighted.
function matchTitle(terms, words, extraWords = []) {
  const plain = [...words.map((w) => w.word), ...(extraWords.length ? ["\u0000", ...extraWords.map((w) => w.word)] : [])];
  const matched = new Set();
  for (const term of terms) {
    let found = false;
    for (const alternative of term) {
      const hits = phraseMatches(alternative, plain);
      if (hits.length) {
        found = true;
        hits.forEach((h) => matched.add(h));
      }
    }
    if (!found) return null;
  }
  return matched;
}

// ----- Filters and counts -----

// The archive prepared once for searching. classify(record) may add Student Hub fields:
// { themes, statedMethods, statedCountries, currentTracks, … } (see thesis.js).
function prepareRecords(records, classify = () => ({})) {
  return records.map((record) => {
    const extra = { themes: [], statedMethods: [], statedCountries: [], currentTracks: [], ...classify(record) };
    return { ...record, ...extra, words: titleWords(record.titleDisplay), placeWords: titleWords(extra.statedCountries.join(" , ")) };
  });
}

const FILTER_FIELD = {
  cohort: "cohort", track: "trackCode", university: "universityCode",
  theme: "themes", currentTrack: "currentTracks", method: "statedMethods",
};

function fieldHas(record, key, value) {
  const field = record[FILTER_FIELD[key]];
  return Array.isArray(field) ? field.includes(value) : field === value;
}

function passesFilters(record, state, except) {
  return THESIS_FILTERS.every((key) => key === except || !state[key] || fieldHas(record, key, state[key]));
}

// Records matching the search (with highlights), before filters: [{ record, matched }]
function searchRecords(prepared, query, synonyms) {
  const terms = queryTerms(query || "", synonyms);
  if (!terms.length) return prepared.map((record) => ({ record, matched: new Set() }));
  const results = [];
  for (const record of prepared) {
    const matched = matchTitle(terms, record.words, record.placeWords || []);
    if (matched) results.push({ record, matched });
  }
  return results;
}

function startYear(cohort) {
  return Number(cohort.slice(0, 4));
}

// The visible results: search + all filters + sorting
function thesisResults(prepared, state, synonyms) {
  const results = searchRecords(prepared, state.q, synonyms).filter(({ record }) => passesFilters(record, state));
  const byTitle = (a, b) => searchText(a.record.titleDisplay).localeCompare(searchText(b.record.titleDisplay));
  if (state.sort === "oldest") results.sort((a, b) => startYear(a.record.cohort) - startYear(b.record.cohort));
  else if (state.sort === "title") results.sort(byTitle);
  else results.sort((a, b) => startYear(b.record.cohort) - startYear(a.record.cohort)); // stable: keeps the list order inside a cohort
  return results;
}

// How many results each option of one filter would give, with the search and the OTHER filters applied
function optionCounts(prepared, state, synonyms, key) {
  const counts = {};
  for (const { record } of searchRecords(prepared, state.q, synonyms)) {
    if (!passesFilters(record, state, key)) continue;
    const field = record[FILTER_FIELD[key]];
    for (const value of Array.isArray(field) ? field : [field]) counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

// Counts over the whole archive: { cohort: {…}, track: {…}, university: {…}, matrix: { EEH: { EUR: 3 } } }
function archiveCounts(records) {
  const counts = { cohort: {}, track: {}, university: {}, matrix: {} };
  for (const r of records) {
    counts.cohort[r.cohort] = (counts.cohort[r.cohort] || 0) + 1;
    counts.track[r.trackCode] = (counts.track[r.trackCode] || 0) + 1;
    counts.university[r.universityCode] = (counts.university[r.universityCode] || 0) + 1;
    counts.matrix[r.trackCode] = counts.matrix[r.trackCode] || {};
    counts.matrix[r.trackCode][r.universityCode] = (counts.matrix[r.trackCode][r.universityCode] || 0) + 1;
  }
  return counts;
}

// Cohorts newest first: ["2020-2022", "2019-2021", …]
function cohortsNewestFirst(records) {
  return [...new Set(records.map((r) => r.cohort))].sort((a, b) => startYear(b) - startYear(a));
}

// ----- The address (URL) -----

// ?q=…&cohort=…&track=…&university=…&theme=…&currentTrack=…&method=…&sort=…&browse=…&topic=…
// -> state. Unknown values are ignored. "topic" is the open thesis; "theme" is a research theme.
// allowed: { themes: [ids], currentTracks: [ids], methods: [ids] }
function stateFromParams(params, records, allowed = {}) {
  const get = (name) => (params.get(name) || "").trim();
  const known = (value, field) => (records.some((r) => r[field] === value) ? value : "");
  const listed = (value, list) => ((list || []).includes(value) ? value : "");
  const sort = get("sort");
  const topic = get("topic");
  return {
    q: get("q").slice(0, 200),
    cohort: known(get("cohort"), "cohort"),
    track: known(get("track"), "trackCode"),
    university: known(get("university"), "universityCode"),
    theme: listed(get("theme"), allowed.themes),
    currentTrack: listed(get("currentTrack"), allowed.currentTracks),
    method: listed(get("method"), allowed.methods),
    sort: THESIS_SORTS[sort] ? sort : "newest",
    browse: listed(get("browse"), THESIS_BROWSE_TABS) || "interest",
    topic: records.some((r) => r.id === topic) ? topic : "",
  };
}

// state -> "?q=cancer&track=EEH" (empty and default values are left out)
function paramsFromState(state) {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  for (const key of THESIS_FILTERS) if (state[key]) params.set(key, state[key]);
  if (state.sort && state.sort !== "newest") params.set("sort", state.sort);
  if (state.browse && state.browse !== "interest") params.set("browse", state.browse);
  if (state.topic) params.set("topic", state.topic);
  const text = params.toString();
  return text ? `?${text}` : "";
}

// ----- "Filter by theme" suggestion -----

// The theme whose name or synonym appears in the query (as whole words), or null. Used only to
// suggest a theme filter; the search results themselves stay title-based.
// themes: [{ id, label }], synonyms: { themeId: ["…"] }
function themeSuggestion(query, themes, synonyms = {}) {
  const q = " " + searchText(query || "") + " ";
  if (!q.trim()) return null;
  let best = null;
  for (const theme of themes) {
    for (const phrase of [theme.label, ...(synonyms[theme.id] || [])]) {
      const p = searchText(phrase || "");
      if (p && q.includes(" " + p + " ") && (!best || p.length > best.length)) best = { id: theme.id, length: p.length };
    }
  }
  return best ? best.id : null;
}

if (typeof module !== "undefined") {
  module.exports = {
    searchText, titleWords, cohortLabel, wordMatches, queryTerms, matchTitle, prepareRecords,
    searchRecords, thesisResults, optionCounts, archiveCounts, cohortsNewestFirst,
    stateFromParams, paramsFromState, themeSuggestion, THESIS_SORTS, THESIS_FILTERS, THESIS_BROWSE_TABS,
  };
}
