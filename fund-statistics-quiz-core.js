// Pure session and grading helpers. Browser progress storage is supplied by the caller.
(function (root) {
  'use strict';
  const KEY = 'fund-statistics.quiz-v1';
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const count = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 100000) : 0;
  const text = value => typeof value === 'string' ? value.slice(0, 8000) : '';
  function normalize(legacy, supplemental) {
    const seen = new Set();
    return [...(Array.isArray(legacy) ? legacy : []), ...(Array.isArray(supplemental?.questions) ? supplemental.questions : [])].filter(q => {
      if (!object(q) || typeof q.id !== 'string' || seen.has(q.id) || !q.id.startsWith('fund-statistics.') || typeof q.topic !== 'string' || typeof q.question !== 'string') return false;
      seen.add(q.id); return true;
    }).map(q => ({ ...q, answer: q.type === 'mcq' && typeof q.answer === 'string' ? q.answer.charCodeAt(0) - 65 : q.answer,
      options: Array.isArray(q.options) ? q.options.slice() : [], rationales: Array.isArray(q.rationales) ? q.rationales.slice() : [],
      steps: Array.isArray(q.steps) ? q.steps.slice() : [], rubric: Array.isArray(q.rubric) ? q.rubric.slice() : [],
      supplementary: q.supplementary === true || q.id === 'fund-statistics.q.069' || q.topic === 'fund-statistics.two-means' }));
  }
  function fingerprint(q) {
    const content = [q.id, q.type, q.question, q.options, q.answer, q.tolerance, q.unit];
    if (q.type === 'written') content.push(q.rubric);
    return JSON.stringify(content);
  }
  function grade(q, value) {
    if (q.type === 'written') return { status: text(value).trim() ? 'manual' : 'empty', correct: null };
    if (q.type === 'numeric') {
      const s = typeof value === 'string' ? value.trim() : '';
      if (!s) return { status: 'empty', correct: false };
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s) || !Number.isFinite(Number(s)) || Math.abs(Number(s)) > 1e12) return { status: 'invalid', correct: false };
      const correct = Number.isFinite(q.answer) && Number.isFinite(q.tolerance) && q.tolerance >= 0 && Math.abs(Number(s) - q.answer) <= q.tolerance + Number.EPSILON * Math.max(Math.abs(q.answer), Math.abs(Number(s)), q.tolerance, 1e-300) * 4;
      return { status: correct ? 'correct' : 'revisit', correct };
    }
    if (q.type === 'multi-select') {
      if (!Array.isArray(value) || !value.length) return { status: 'empty', correct: false };
      if (new Set(value).size !== value.length || value.some(i => !Number.isInteger(i) || i < 0 || i >= q.options.length)) return { status: 'invalid', correct: false };
      const correct = Array.isArray(q.answer) && value.length === q.answer.length && value.every(i => q.answer.includes(i));
      return { status: correct ? 'correct' : 'revisit', correct };
    }
    if (value === null || value === undefined) return { status: 'empty', correct: false };
    if (!Number.isInteger(value) || value < 0 || value >= q.options.length) return { status: 'invalid', correct: false };
    const correct = value === q.answer;
    return { status: correct ? 'correct' : 'revisit', correct };
  }
  function shuffle(list, rng = Math.random) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  // Round-robin topics and question types so a large MCQ bank cannot crowd out calculations.
  function balanced(pool, size, rng = Math.random) {
    const topics = shuffle([...new Set(pool.map(q => q.topic))], rng);
    const queues = topics.map(topic => {
      const group = pool.filter(q => q.topic === topic), types = shuffle([...new Set(group.map(q => q.type))], rng);
      const byType = types.map(type => shuffle(group.filter(q => q.type === type), rng));
      const queue = [];
      while (byType.some(items => items.length)) for (const items of byType) if (items.length) queue.push(items.pop());
      return queue;
    });
    const result = [], target = Math.min(size, pool.length);
    while (result.length < target && queues.some(items => items.length)) for (const queue of queues) {
      if (queue.length && result.length < target) result.push(queue.shift());
    }
    return result;
  }
  function empty() { return { version: 1, records: {}, written: {}, active: null, history: [] }; }
  function blank(q) { return q.type === 'multi-select' ? [] : q.type === 'mcq' ? null : ''; }
  function draft(q, value) {
    if (q.type === 'mcq') return Number.isInteger(value) && value >= 0 && value < q.options.length ? value : null;
    if (q.type === 'multi-select') return Array.isArray(value) ? [...new Set(value.filter(i => Number.isInteger(i) && i >= 0 && i < q.options.length))] : [];
    return text(value);
  }
  function createSession(questions, options = {}, now = Date.now(), rng = Math.random) {
    const ids = questions.map(q => q.id);
    return { id: `${now}-${Math.floor(rng() * 1e9)}`, mode: options.mode === 'test' ? 'test' : 'learn', started: now,
      deadline: [15, 30].includes(Number(options.minutes)) ? now + Number(options.minutes) * 60000 : null,
      finished: null, expired: false, ids, signatures: Object.fromEntries(questions.map(q => [q.id, fingerprint(q)])),
      order: Object.fromEntries(questions.map(q => [q.id, shuffle(q.options.map((_, i) => i), rng)])),
      drafts: Object.fromEntries(questions.map(q => [q.id, blank(q)])), first: {}, checked: {}, assisted: {}, flags: {}, rubrics: Object.fromEntries(questions.map(q => [q.id, Array.isArray(q.rubric) ? q.rubric.map(() => false) : []])), index: 0 };
  }
  function session(raw, bank) {
    const map = new Map(bank.map(q => [q.id, q]));
    if (!object(raw) || typeof raw.id !== 'string' || !Array.isArray(raw.ids) || !raw.ids.length || raw.ids.length > bank.length || new Set(raw.ids).size !== raw.ids.length || !['learn', 'test'].includes(raw.mode) || !Number.isFinite(raw.started) || !object(raw.signatures)) return null;
    if (raw.ids.some(id => !map.has(id) || raw.signatures[id] !== fingerprint(map.get(id)))) return null;
    if (raw.deadline !== null && (![900000, 1800000].includes(raw.deadline - raw.started))) return null;
    if (raw.finished !== null && (!Number.isFinite(raw.finished) || raw.finished < raw.started)) return null;
    const out = { ...raw, order: {}, drafts: {}, first: {}, checked: {}, assisted: {}, flags: {}, rubrics: {}, expired: raw.expired === true,
      index: Number.isInteger(raw.index) && raw.index >= 0 && raw.index < raw.ids.length ? raw.index : 0 };
    for (const id of raw.ids) {
      const q = map.get(id), order = raw.order?.[id];
      if (!Array.isArray(order) || order.length !== q.options.length || new Set(order).size !== order.length || order.some(i => !Number.isInteger(i) || i < 0 || i >= q.options.length)) return null;
      out.order[id] = order.slice(); out.drafts[id] = draft(q, raw.drafts?.[id]);
      const first = raw.first?.[id];
      if (object(first)) { const given = draft(q, first.given); out.first[id] = { given, correct: grade(q, given).correct, assisted: first.assisted === true }; }
      out.checked[id] = raw.mode === 'learn' && raw.checked?.[id] === true && !!out.first[id];
      out.assisted[id] = raw.assisted?.[id] === true; out.flags[id] = raw.flags?.[id] === true;
      out.rubrics[id] = q.rubric.map((_, i) => raw.rubrics?.[id]?.[i] === true);
    }
    return out;
  }
  function repair(raw, bank) {
    const out = empty(), map = new Map(bank.map(q => [q.id, q]));
    if (!object(raw) || raw.version !== 1) return out;
    if (object(raw.records)) for (const [id, r] of Object.entries(raw.records)) {
      const q = map.get(id);
      if (!q || q.type === 'written' || !object(r) || r.signature !== fingerprint(q) || count(r.attempts) < 1) continue;
      const lastAnswer = draft(q, r.lastAnswer);
      out.records[id] = { signature: r.signature, attempts: count(r.attempts), correct: Math.min(count(r.correct), count(r.attempts)), misses: Math.min(count(r.misses), count(r.attempts)),
        lastCorrect: grade(q, lastAnswer).correct === true, lastAnswer, lastAssisted: r.lastAssisted === true };
    }
    if (object(raw.written)) for (const [id, r] of Object.entries(raw.written)) {
      const q = map.get(id);
      if (q?.type === 'written' && object(r) && r.signature === fingerprint(q) && count(r.attempts) > 0) out.written[id] = { signature: r.signature, attempts: count(r.attempts) };
    }
    out.active = session(raw.active, bank);
    out.history = (Array.isArray(raw.history) ? raw.history : []).map(item => session(item, bank)).filter(item => item && item.finished !== null).slice(-12);
    return out;
  }
  function freeze(state, q, value, assisted = false) {
    const active = state.active;
    if (!active || active.finished !== null || active.first[q.id]) return false;
    const given = draft(q, value), result = grade(q, given);
    active.first[q.id] = { given, correct: result.correct, assisted: assisted === true };
    if (q.type === 'written') {
      state.written ||= {}; state.written[q.id] = { signature: fingerprint(q), attempts: count(state.written[q.id]?.attempts) + 1 };
    } else {
      const old = state.records[q.id] || { attempts: 0, correct: 0, misses: 0 };
      state.records[q.id] = { signature: fingerprint(q), attempts: count(old.attempts) + 1, correct: count(old.correct) + (result.correct ? 1 : 0), misses: count(old.misses) + (result.correct ? 0 : 1), lastCorrect: result.correct, lastAnswer: given, lastAssisted: assisted === true };
    }
    return true;
  }
  function finish(state, bank, now = Date.now(), expired = false) {
    const active = state.active;
    if (!active || active.finished !== null) return false;
    const map = new Map(bank.map(q => [q.id, q]));
    for (const id of active.ids) freeze(state, map.get(id), active.drafts[id], active.assisted[id]);
    active.finished = Math.max(now, active.started); active.expired = expired || (active.deadline !== null && now >= active.deadline);
    state.history.push(JSON.parse(JSON.stringify(active))); state.history = state.history.slice(-12);
    return true;
  }
  function summary(active, bank) {
    const map = new Map(bank.map(q => [q.id, q]));
    const out = { total: 0, correct: 0, unanswered: 0, assisted: 0, manual: 0, independentCorrect: 0, independentTotal: 0, byTopic: {} };
    for (const id of active.ids) {
      const q = map.get(id), first = active.first[id], result = grade(q, first?.given);
      if (q.type === 'written') { out.manual++; continue; }
      const row = out.byTopic[q.topic] || (out.byTopic[q.topic] = { total: 0, correct: 0 });
      out.total++; row.total++;
      if (result.correct) { out.correct++; row.correct++; }
      if (!first || result.status === 'empty') out.unanswered++;
      if (first?.assisted) out.assisted++;
      else { out.independentTotal++; if (result.correct) out.independentCorrect++; }
    }
    out.percent = out.total ? Math.round(out.correct / out.total * 100) : null;
    return out;
  }
  const api = { KEY, normalize, fingerprint, grade, shuffle, balanced, empty, createSession, repair, freeze, finish, summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FundQuizCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
