// Thesis guidance integrity and personal-draft boundaries.
// Run: node tests/thesis-guide/data.test.js .
const fs = require("fs"), path = require("path"), assert = require("assert");
const ROOT = path.resolve(process.argv[2] || ".");
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const D = require(path.join(ROOT, "thesis-guide-data.js"));
const guide = read("content/thesis-guide.json"), cohort = read("content/tracks.json").cohorts.at(-1);
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log("  ok  " + name); };
const blank = () => D.sanitizeDraft(null, guide, cohort);
const valid = overrides => ({ ...blank(), ...overrides });

check("the guide identifies student-authored advice and resolves every official/source reference", () => {
  assert.strictEqual(guide.schemaVersion, 1);
  assert.match(guide.verifiedAt, /^\d{4}-\d{2}-\d{2}/);
  assert.match(JSON.stringify(guide.disclaimer), /student|authored|unofficial/i);
  const sources = new Map(guide.sources.map(source => [source.id, source]));
  assert.strictEqual(sources.size, guide.sources.length, "source identifiers are unique");
  for (const source of sources.values()) {
    assert.ok(source.title && source.kind);
    assert.strictEqual(new URL(source.url).protocol, "https:");
  }
  let references = 0;
  const walk = item => {
    if (!item || typeof item !== "object") return;
    if (item.sourceIds) for (const id of item.sourceIds) { assert.ok(sources.has(id), `known source ${id}`); references++; }
    for (const value of Object.values(item)) if (typeof value === "object") Array.isArray(value) ? value.forEach(walk) : walk(value);
  };
  walk(guide);
  assert.ok(references > 0, "factual guidance retains named evidence");
  assert.ok(guide.facts.every(fact => fact.title && fact.text && fact.sourceIds.length), "facts have evidence and readable context");
  assert.match(JSON.stringify(guide.facts), /30/);
  assert.match(JSON.stringify(guide.facts), /120/);
});

check("the full journey covers early exploration through defence with distinct actionable checklists", () => {
  assert.deepStrictEqual(guide.journey.map(stage => stage.id), ["semester-1", "semester-2", "summer", "semester-3", "semester-4", "defence"]);
  const ids = D.checklistIds(guide);
  assert.strictEqual(new Set(ids).size, ids.length, "one checkbox cannot complete two distinct actions");
  assert.ok(ids.length > guide.journey.length);
  for (const stage of guide.journey) {
    assert.ok(stage.label && stage.when && stage.timingType && stage.goal && stage.deliverable && stage.pitfall);
    assert.ok(stage.actions.length && stage.checklist.length);
    assert.ok(stage.checklist.every(item => typeof item.id === "string" && item.text));
  }
  assert.match(JSON.stringify(guide), /confirm.*deadline|deadlines.*confirm|host.*deadline/i, "local deadlines remain a verification task");
  assert.match(JSON.stringify(guide), /ethic|approval/i);
});

check("new topic prompts cover the four current tracks and name evidence, method and feasibility limits", () => {
  const ids = new Set(), tracks = cohort.tracks.map(track => track.id);
  for (const topic of guide.topics) {
    assert.ok(!ids.has(topic.id)); ids.add(topic.id);
    assert.ok(topic.title && topic.question && topic.dataIdea && topic.feasibility);
    assert.ok(topic.trackIds.length && topic.trackIds.every(id => tracks.includes(id)));
    assert.ok(topic.methods.length && topic.methods.every(method => guide.methods.some(item => item.name === method)));
    assert.ok(Array.isArray(topic.sourceIds), "authored prompts may have no external factual claim");
  }
  for (const id of tracks) assert.ok(guide.topics.filter(topic => topic.trackIds.includes(id)).length >= 2, `${id} has real choices to explore`);
  for (const method of guide.methods) assert.ok(method.name && method.bestFor && method.requirements.length && method.strength && method.limits && method.questionExample);
  assert.match(JSON.stringify(guide.disclaimer), /topic|project|approval/i, "sample topics do not imply offered projects");
});

check("malformed and different-cohort storage produces a clean personal draft", () => {
  const expected = blank();
  for (const bad of [null, 4, "text", [], { version: 9, cohort: cohort.id }, { version: 1, cohort: "future-cohort", fields: { topic: "stale" } }]) assert.deepStrictEqual(D.sanitizeDraft(bad, guide, cohort), expected);
  assert.strictEqual(expected.cohort, cohort.id);
  assert.strictEqual(expected.selectedStage, guide.journey[0].id);
  assert.strictEqual(expected.trackId, "");
  assert.strictEqual(expected.hostUniversity, "");
  assert.deepStrictEqual(expected.completed, []);
  assert.deepStrictEqual(expected.savedIdeas, []);
});

check("every track accepts only its two canonical thesis hosts and clears incompatible host choices", () => {
  for (const track of cohort.tracks) {
    for (const host of Object.keys(cohort.universities)) {
      const result = D.sanitizeDraft(valid({ trackId: track.id, hostUniversity: host }), guide, cohort);
      assert.strictEqual(result.trackId, track.id);
      assert.strictEqual(result.hostUniversity, track.thesis.includes(host) ? host : "");
    }
  }
  assert.strictEqual(D.sanitizeDraft(valid({ trackId: "legacy-HEP", hostUniversity: "unibo" }), guide, cohort).trackId, "");
  assert.strictEqual(D.sanitizeDraft(valid({ trackId: "", hostUniversity: "unibo" }), guide, cohort).hostUniversity, "");
});

check("bounded draft fields reject objects, ignore extra keys and retain user text without treating it as HTML", () => {
  const fields = Object.fromEntries(Object.keys(D.FIELD_LIMITS).map(key => [key, `  ${"a".repeat(10000)}  `]));
  fields.extra = "not part of the proposal";
  let draft = D.sanitizeDraft(valid({ fields }), guide, cohort);
  assert.deepStrictEqual(Object.keys(draft.fields).sort(), Object.keys(D.FIELD_LIMITS).sort());
  for (const [key, limit] of Object.entries(D.FIELD_LIMITS)) assert.strictEqual(draft.fields[key].length, limit);
  draft = D.sanitizeDraft(valid({ fields: { topic: '<img src=x onerror="globalThis.bad=true">', question: {}, notes: ["bad"] } }), guide, cohort);
  assert.strictEqual(draft.fields.topic, '<img src=x onerror="globalThis.bad=true">');
  assert.strictEqual(draft.fields.question, "");
  assert.strictEqual(draft.fields.notes, "");
});

check("progress and saved ideas count valid unique items and cannot claim institutional thesis approval", () => {
  const checks = D.checklistIds(guide), idea = guide.topics[0].id;
  const draft = D.sanitizeDraft(valid({ selectedStage: "fake", completed: [checks[0], checks[0], "unknown"], savedIdeas: [idea, idea, "gone-topic"] }), guide, cohort);
  assert.deepStrictEqual(draft.completed, [checks[0]]);
  assert.deepStrictEqual(draft.savedIdeas, [idea]);
  assert.strictEqual(draft.selectedStage, guide.journey[0].id);
  assert.deepStrictEqual(D.readiness(draft, guide), { completed: 1, total: checks.length, percent: Math.round(100 / checks.length) });
  assert.deepStrictEqual(D.readiness(valid({ completed: checks }), guide), { completed: checks.length, total: checks.length, percent: 100 });
  assert.deepStrictEqual(D.readiness(blank(), { journey: [] }), { completed: 0, total: 0, percent: 0 });
});

check("backup round-trips the draft while malformed, foreign and cross-cohort imports are refused", () => {
  const track = cohort.tracks[0];
  const original = D.sanitizeDraft(valid({ trackId: track.id, hostUniversity: track.thesis[0], selectedStage: "semester-3", fields: { topic: "Public-data feasibility", question: "What can be estimated?" }, completed: [D.checklistIds(guide)[0]], savedIdeas: [guide.topics[0].id] }), guide, cohort);
  const backup = D.exportBackup(original);
  assert.match(backup.exportedAt, /^\d{4}-/);
  assert.deepStrictEqual(D.importBackup(JSON.parse(JSON.stringify(backup)), guide, cohort), original);
  for (const bad of [null, [], { ...backup, format: "euhem-study-plan-backup" }, { ...backup, version: 2 }, { ...backup, cohort: "wrong" }, { ...backup, draft: { ...original, cohort: "wrong" } }, { ...backup, draft: { ...original, fields: [] } }]) assert.throws(() => D.importBackup(bad, guide, cohort), /valid.*backup.*cohort/i);
  assert.strictEqual(original.fields.topic, "Public-data feasibility", "failed import does not mutate the existing draft");
});

check("the exported brief includes the work, checklist and canonical host, with personal-draft status", () => {
  const track = cohort.tracks[1];
  const draft = D.sanitizeDraft(valid({ trackId: track.id, hostUniversity: track.thesis[0], fields: { topic: "Hospital access", question: "How does access vary?", supervisor: "A potential team, not an appointment" }, completed: [D.checklistIds(guide)[0]] }), guide, cohort);
  const brief = D.briefText(draft, cohort, guide);
  assert.match(brief, /Hospital access/);
  assert.match(brief, /How does access vary\?/);
  assert.ok(brief.includes(track.name) && brief.includes(cohort.universities[track.thesis[0]].name));
  assert.match(brief, /\[x\]/); assert.match(brief, /\[ \]/);
  assert.match(brief, /unofficial.*planning aid/i);
  assert.match(brief, /confirm.*deadlines.*approvals.*submission/i);
});

console.log(`\n${checks} thesis guide data checks passed.`);
