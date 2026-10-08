/* Bounded, versioned backups for the Toolkit's seven local planners. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudentToolkitWorkbenchCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const IDS = Object.freeze(['economics-graphs', 'sample-size', 'study-session-planner',
    'four-city-budget', 'moving-checklist', 'document-deadlines', 'career-tracker']);
  const KEY = 'euhem-toolkit-workbench-v1', LIMIT_BYTES = 100000;
  const empty = () => ({ format: 'euhem-toolkit-workbench', version: 1, tools: {} });
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function bytes(text) { return new TextEncoder().encode(text).length; }
  function cleanStore(raw, cleaners, strict = false) {
    const result = empty();
    if (!object(raw) || raw.format !== result.format || raw.version !== 1 || !object(raw.tools)) {
      if (strict) throw new Error('Choose a version 1 Student Toolkit workbench backup.');
      return result;
    }
    if (strict && Object.keys(raw).some(key => !['format', 'version', 'tools'].includes(key))) {
      throw new Error('The backup has unexpected fields. No planners were changed.');
    }
    for (const [id, state] of Object.entries(raw.tools)) {
      if (!IDS.includes(id) || typeof cleaners[id] !== 'function') {
        if (strict) throw new Error('The backup includes an unknown planner.');
        continue;
      }
      try { result.tools[id] = cleaners[id](state, true); }
      catch (error) { if (strict) throw new Error(`${id}: ${error.message}`); }
    }
    return result;
  }
  function parseImport(text, cleaners) {
    if (typeof text !== 'string' || bytes(text) > LIMIT_BYTES) throw new Error('Choose a JSON backup no larger than 100 KB.');
    let raw;
    try { raw = JSON.parse(text); } catch (_) { throw new Error('This file is not valid JSON.'); }
    return cleanStore(raw, cleaners, true);
  }
  function exportStore(raw, cleaners) {
    const text = JSON.stringify(cleanStore(raw, cleaners, true), null, 2);
    if (bytes(text) > LIMIT_BYTES) throw new Error('This backup exceeds 100 KB. Shorten the planner notes before exporting.');
    return text;
  }
  return Object.freeze({ IDS, KEY, LIMIT_BYTES, empty, bytes, cleanStore, parseImport, exportStore });
});
