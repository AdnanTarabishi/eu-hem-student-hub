// ===== Thesis enrichment: Student Hub classifications of the historical thesis titles =====
// The historical records (content/thesis-archive.json) are never changed. Themes, stated methods,
// stated countries and current-track relevance live in content/thesis-enrichment.json and are
// interpreted here. Pure functions only: used by scripts/check-content.js and, later, the Thesis page.
// Needs trackCourses() and courseInfo() from tracks-data.js.

const THESIS_ENRICHMENT_URL = "content/thesis-enrichment.json";
const ENRICHMENT_CONFIDENCE = ["high", "medium", "uncertain"];
const ENRICHMENT_STATUS = ["draft", "reviewed"];

// ----- The shared taxonomy -----

// The thesis topic themes: ids reused from tracks.json keep the label written there (one definition),
// the themes added for thesis discovery are defined in the enrichment file.
// -> [{ id, label, description, source: "tracks" | "thesis", scope }]
function topicThemes(enrichment, tracksCohort) {
  const fromTracks = Object.fromEntries((tracksCohort.themes || []).map((t) => [t.id, t]));
  const scope = enrichment.taxonomy.scope || {};
  const reused = enrichment.taxonomy.reused.map((id) => ({
    id,
    label: fromTracks[id] ? fromTracks[id].label : null, // null = missing in tracks.json (the checker reports it)
    description: "",
    source: "tracks",
    scope: scope[id] || "",
  }));
  const added = enrichment.taxonomy.added.map((t) => ({ ...t, source: "thesis", scope: scope[t.id] || t.description || "" }));
  return [...reused, ...added];
}

// ----- Theme -> current-track weights, derived from the course lists in tracks.json -----

// For each theme and track: how many required and elective courses carry the theme (each course once)
function themeCourseCounts(tracksCohort, themeId) {
  const counts = {};
  for (const track of tracksCohort.tracks) {
    const seen = new Set();
    let required = 0;
    let elective = 0;
    for (const item of trackCourses(tracksCohort, track)) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const course = courseInfo(tracksCohort, item.id);
      if (!course || !course.themes.includes(themeId)) continue;
      if (item.status === "required") required++;
      else elective++;
    }
    counts[track.id] = { required, elective };
  }
  return counts;
}

// Weight per track = (2 × required + 1 × elective) ÷ the highest track's value, rounded to 2 decimals.
// Returns null when no course carries the theme (its weights must then be proposed by a person).
function derivedWeights(tracksCohort, themeId) {
  const counts = themeCourseCounts(tracksCohort, themeId);
  const raw = Object.fromEntries(Object.entries(counts).map(([id, c]) => [id, 2 * c.required + c.elective]));
  const max = Math.max(...Object.values(raw));
  if (!max) return null;
  return Object.fromEntries(Object.entries(raw).map(([id, value]) => [id, Math.round((value / max) * 100) / 100]));
}

// ----- Relevance of one thesis to the current tracks -----

// -> [{ trackId, score, because: themeId }] (at most maxTracks), following the rules in
// enrichment.relevance; a per-thesis trackOverride replaces the calculation.
// "Secondary" themes (weights row with secondary: true) add to a score but can never justify a track
// on their own: a track is only possible when a non-secondary theme of the thesis gives it a weight of
// at least primarySupport.
function trackRelevance(entry, enrichment, trackIds) {
  if (!entry) return [];
  if (entry.trackOverride) {
    return entry.trackOverride.tracks.map((trackId) => ({ trackId, score: null, because: null, override: entry.trackOverride.reason }));
  }
  const themes = entry.themes || [];
  if (!themes.length) return [];
  const { weights, threshold, secondRatio, maxTracks, primarySupport = 0 } = enrichment.relevance;
  const weightOf = (theme, trackId) => (weights[theme] ? weights[theme][trackId] || 0 : 0);
  const primary = themes.filter((theme) => !(weights[theme] && weights[theme].secondary));
  const allScores = trackIds.map((trackId) => {
    const score = themes.reduce((sum, theme) => sum + weightOf(theme, trackId), 0) / themes.length;
    // The explanation names the strongest non-secondary theme (the one backed by courses)
    const because = [...primary].sort((a, b) => weightOf(b, trackId) - weightOf(a, trackId))[0] || null;
    const supported = because !== null && weightOf(because, trackId) >= primarySupport;
    return { trackId, score: Math.round(score * 1000) / 1000, because, supported };
  });
  const scores = allScores.filter((s) => s.supported).map(({ supported, ...s }) => s);
  scores.sort((a, b) => b.score - a.score || trackIds.indexOf(a.trackId) - trackIds.indexOf(b.trackId));
  const top = scores[0];
  if (!top || top.score < threshold) return [];
  const near = scores.filter((s) => s.score >= threshold && s.score >= top.score * secondRatio);
  // More tracks close to the top than we may show: not distinctive enough, show none
  if (near.length > maxTracks) {
    const tiedAtTop = scores.filter((s) => s.score === top.score).length;
    if (tiedAtTop > maxTracks) return [];
    return [top];
  }
  return near.slice(0, maxTracks);
}

// "Related to Economic Evaluation in Healthcare because that track has required courses in Economic
// evaluation & HTA." (or the override reason)
function relevanceExplanation(result, enrichment, tracksCohort, themes) {
  const track = tracksCohort.tracks.find((t) => t.id === result.trackId);
  if (!track) return "";
  if (result.override) return `Related to ${track.name}: ${result.override}`;
  const theme = themes.find((t) => t.id === result.because);
  const weight = enrichment.relevance.weights[result.because] || {};
  const label = theme ? theme.label : result.because;
  if (weight.basis === "proposal") {
    return `Related to ${track.name} through the theme ${label} (a Student Hub proposal: ${weight.note || "no course is tagged with this theme"}).`;
  }
  const counts = themeCourseCounts(tracksCohort, result.because)[result.trackId];
  const kind = counts.required ? "required courses" : "elective courses";
  const inSentence = label.charAt(0).toLowerCase() + label.slice(1); // keeps acronyms such as HTA
  return `Related to ${track.name} because that track has ${kind} in ${inSentence}.`;
}

// ----- Related past topics (deterministic) -----

const RELATED_STOP_WORDS = new Set(("a an and are as at be by for from in into is its of on or the to with without " +
  "analysis study case impact effect effects role use using towards toward how what does do between among among " +
  "health healthcare care patients patient new evidence approach perspective").split(" "));

function significantWords(title) {
  return new Set(searchText(title).split(" ").filter((w) => w.length > 3 && !RELATED_STOP_WORDS.has(w)));
}

// Up to `limit` other records most similar to `record`:
// shared themes weighted by rarity (rare themes count more) + shared stated method (small)
// + shared significant title words (small). Ties are broken by id, so the order is stable.
function relatedTopics(record, records, entries, { limit = 4, minScore = 1 } = {}) {
  const entry = entries[record.id];
  if (!entry) return [];
  const themeCount = {};
  for (const r of records) for (const t of (entries[r.id] || {}).themes || []) themeCount[t] = (themeCount[t] || 0) + 1;
  const total = records.length;
  const rarity = (theme) => Math.log(total / (themeCount[theme] || 1)) + 1; // rarer theme -> larger
  const myWords = significantWords(record.titleDisplay);
  const scored = [];
  for (const other of records) {
    if (other.id === record.id) continue;
    const e = entries[other.id];
    if (!e) continue;
    let score = 0;
    for (const t of e.themes || []) if (entry.themes.includes(t)) score += rarity(t);
    if ((e.statedMethods || []).some((m) => (entry.statedMethods || []).includes(m))) score += 0.5;
    let shared = 0;
    for (const w of significantWords(other.titleDisplay)) if (myWords.has(w)) shared++;
    score += Math.min(shared, 3) * 0.4;
    if (score >= minScore) scored.push({ record: other, score: Math.round(score * 1000) / 1000 });
  }
  scored.sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));
  return scored.slice(0, limit);
}

if (typeof module !== "undefined") {
  module.exports = {
    THESIS_ENRICHMENT_URL, ENRICHMENT_CONFIDENCE, ENRICHMENT_STATUS, topicThemes, themeCourseCounts,
    derivedWeights, trackRelevance, relevanceExplanation, relatedTopics, significantWords,
  };
}
