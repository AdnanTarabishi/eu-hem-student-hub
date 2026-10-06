// Statistics study state, scheduling and session scoring. Shared by lectures and the study centre.
(function (root) {
  "use strict";
  const object = (x) => x && typeof x === "object" && !Array.isArray(x);
  const count = (x) =>
    Number.isInteger(x) && x >= 0 ? Math.min(x, 100000) : 0;
  const dateValid = (d) =>
    typeof d === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !Number.isNaN(Date.parse(d)) &&
    new Date(d + "T12:00:00Z").toISOString().slice(0, 10) === d;
  function datePlus(date, days) {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  const fingerprint = (q) =>
    JSON.stringify([q.id, q.question, q.options, q.answer]);
  const lectureSignature = (questions) =>
    JSON.stringify(
      questions.map((q) => [
        q.id,
        q.question,
        q.options,
        q.answer.charCodeAt(0) - 65,
      ]),
    );
  function empty() {
    return {
      version: 1,
      questions: {},
      sessions: [],
      active: null,
      exercises: {},
      explanations: {},
      workshops: {},
    };
  }
  function repair(raw) {
    const s = empty();
    if (!object(raw) || raw.version !== 1) return s;
    if (object(raw.questions))
      for (const [id, r] of Object.entries(raw.questions)) {
        if (
          !object(r) ||
          typeof r.fingerprint !== "string" ||
          typeof r.lastCorrect !== "boolean"
        )
          continue;
        s.questions[id] = {
          fingerprint: r.fingerprint,
          attempts: count(r.attempts),
          correct: count(r.correct),
          misses: count(r.misses),
          lastCorrect: r.lastCorrect,
          needsReview: r.needsReview === true,
          interval: Math.min(count(r.interval), 365),
          reviewBase: Math.min(count(r.reviewBase), 365),
          due: dateValid(r.due) ? r.due : null,
          lastDate: dateValid(r.lastDate) ? r.lastDate : null,
          source:
            typeof r.source === "string" ? r.source.slice(0, 30) : "practice",
          lastAnswer: Number.isInteger(r.lastAnswer) ? r.lastAnswer : null,
        };
      }
    if (Array.isArray(raw.sessions))
      s.sessions = raw.sessions
        .filter(
          (r) =>
            object(r) &&
            Number.isFinite(r.finishedAt) &&
            Number.isInteger(r.total) &&
            r.total > 0 &&
            Number.isInteger(r.correct) &&
            r.correct >= 0 &&
            r.correct <= r.total &&
            Number.isInteger(r.answered) &&
            r.answered >= 0 &&
            r.answered <= r.total &&
            ["practice", "exam", "review"].includes(r.kind),
        )
        .slice(-60);
    if (object(raw.active)) s.active = raw.active; // Validated against the current bank before use.
    if (object(raw.exercises))
      for (const [id, r] of Object.entries(raw.exercises)) {
        if (!/^[a-z][a-z0-9-]*$/.test(id) || !object(r)) continue;
        s.exercises[id] = {
          attempts: count(r.attempts),
          variant: count(r.variant),
          lastCorrect: r.lastCorrect === true,
          assisted: r.assisted === true,
          solutionSeen: r.solutionSeen === true,
        };
      }
    if (object(raw.explanations))
      for (const [id, r] of Object.entries(raw.explanations)) {
        if (!/^[a-z][a-z0-9-]*$/.test(id) || !object(r)) continue;
        s.explanations[id] = {
          text: typeof r.text === "string" ? r.text.slice(0, 8000) : "",
          checks: Array.isArray(r.checks)
            ? r.checks.slice(0, 20).map((x) => x === true)
            : [],
        };
      }
    if (object(raw.workshops))
      for (const id of [7, 10]) s.workshops[id] = raw.workshops[id] === true;
    return s;
  }
  function reconcile(s, bank, progress, today) {
    const byId = new Map(bank.map((q) => [q.id, q]));
    for (const id of Object.keys(s.questions))
      if (
        !byId.has(id) ||
        s.questions[id].fingerprint !== fingerprint(byId.get(id))
      )
        delete s.questions[id];
    // Older lecture answers have no review date. Seed them due today once, never replay them.
    const topics = [...new Set(bank.map((q) => q.topic))];
    for (const topic of topics) {
      const list = bank.filter((q) => q.topic === topic),
        old = progress.lectures && progress.lectures[topic];
      if (
        !object(old) ||
        old.signature !== lectureSignature(list) ||
        !Array.isArray(old.checked) ||
        !Array.isArray(old.answers)
      )
        continue;
      list.forEach((q, i) => {
        const a = old.answers[i];
        if (
          !s.questions[q.id] &&
          old.checked[i] === true &&
          Number.isInteger(a) &&
          a >= 0 &&
          a < q.options.length
        ) {
          const correct = a === q.answer.charCodeAt(0) - 65;
          s.questions[q.id] = {
            fingerprint: fingerprint(q),
            attempts: 1,
            correct: correct ? 1 : 0,
            misses: correct ? 0 : 1,
            lastCorrect: correct,
            needsReview: !correct,
            interval: 0,
            reviewBase: 0,
            due: today,
            lastDate: null,
            source: "lecture import",
            lastAnswer: a,
          };
        }
      });
    }
    if (s.active && !validSession(s.active, bank)) s.active = null;
    return s;
  }
  function spacing(base, grade, today) {
    if (!["again", "hard", "good", "easy"].includes(grade))
      throw new Error("Unknown review grade.");
    const interval =
      grade === "again"
        ? 0
        : grade === "hard"
          ? Math.max(1, Math.round(base * 1.2))
          : grade === "easy"
            ? base
              ? Math.round(base * 3)
              : 7
            : base
              ? Math.round(base * 2.5)
              : 3;
    return {
      interval: Math.min(interval, 365),
      due: datePlus(today, Math.min(interval, 365)),
    };
  }
  function answer(s, q, selected, today, source = "practice") {
    if (
      selected !== null &&
      (!Number.isInteger(selected) ||
        selected < 0 ||
        selected >= q.options.length)
    )
      throw new Error("Invalid answer.");
    const prev =
      s.questions[q.id]?.fingerprint === fingerprint(q)
        ? s.questions[q.id]
        : null;
    const correct = selected === q.answer.charCodeAt(0) - 65,
      base = prev?.interval || 0;
    const next = {
      fingerprint: fingerprint(q),
      attempts: (prev?.attempts || 0) + 1,
      correct: (prev?.correct || 0) + (correct ? 1 : 0),
      misses: (prev?.misses || 0) + (correct ? 0 : 1),
      lastCorrect: correct,
      needsReview: !correct,
      reviewBase: base,
      ...spacing(base, correct ? "good" : "again", today),
      lastDate: today,
      source,
      lastAnswer: selected,
    };
    s.questions[q.id] = next;
    return next;
  }
  function confidence(s, q, grade, today) {
    const r = s.questions[q.id];
    if (!r || !r.lastCorrect || r.lastDate !== today) return false;
    if (!["hard", "good", "easy"].includes(grade)) return false;
    Object.assign(r, spacing(r.reviewBase, grade, today));
    return true;
  }
  function due(s, bank, today, includeNew = true) {
    return bank
      .filter((q) =>
        !s.questions[q.id]
          ? includeNew
          : !s.questions[q.id].due || s.questions[q.id].due <= today,
      )
      .sort((a, b) => {
        const x = s.questions[a.id],
          y = s.questions[b.id];
        return (
          Number(!!y?.needsReview) - Number(!!x?.needsReview) ||
          Number(!x) - Number(!y) ||
          (x?.due || today).localeCompare(y?.due || today)
        );
      });
  }
  function shuffle(list, rng = Math.random) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function balanced(bank, size, rng = Math.random) {
    const topics = shuffle([...new Set(bank.map((q) => q.topic))], rng),
      buckets = topics.map((t) =>
        shuffle(
          bank.filter((q) => q.topic === t),
          rng,
        ),
      );
    const result = [];
    while (result.length < size && buckets.some((b) => b.length))
      for (const b of buckets) {
        if (b.length && result.length < size) result.push(b.pop());
      }
    return shuffle(result, rng);
  }
  function createSession(
    bank,
    {
      kind = "practice",
      size = 24,
      minutes = 20,
      now = Date.now(),
      rng = Math.random,
    } = {},
  ) {
    if (!["practice", "exam", "review"].includes(kind) || !bank.length)
      throw new Error("No questions available for this session.");
    if (
      !Number.isInteger(size) ||
      size < 1 ||
      !Number.isFinite(now) ||
      now < 0 ||
      (kind === "exam" &&
        (!Number.isFinite(minutes) || minutes < 1 || minutes > 180))
    )
      throw new Error("Invalid session settings.");
    const list =
      kind === "review" ? bank.slice(0, size) : balanced(bank, size, rng);
    return {
      kind,
      ids: list.map((q) => q.id),
      fingerprints: list.map(fingerprint),
      order: list.map((q) =>
        shuffle(
          q.options.map((_, i) => i),
          rng,
        ),
      ),
      answers: list.map(() => null),
      checked: list.map(() => false),
      index: 0,
      startedAt: now,
      deadline: kind === "exam" ? now + minutes * 60000 : null,
      finishedAt: null,
    };
  }
  function validSession(a, bank) {
    if (
      !object(a) ||
      !["practice", "exam", "review"].includes(a.kind) ||
      !Array.isArray(a.ids) ||
      !a.ids.length ||
      a.ids.length > bank.length ||
      new Set(a.ids).size !== a.ids.length ||
      !Number.isInteger(a.index) ||
      a.index < 0 ||
      a.index >= a.ids.length ||
      !Number.isFinite(a.startedAt) ||
      a.startedAt < 0 ||
      !(
        a.finishedAt === null ||
        (Number.isFinite(a.finishedAt) && a.finishedAt >= a.startedAt)
      ) ||
      (a.kind === "exam" &&
        (!Number.isFinite(a.deadline) ||
          a.deadline <= a.startedAt ||
          a.deadline > a.startedAt + 180 * 60000)) ||
      (a.kind !== "exam" && a.deadline !== null)
    )
      return false;
    const map = new Map(bank.map((q) => [q.id, q]));
    if (
      ![a.fingerprints, a.order, a.answers, a.checked].every(
        (x) => Array.isArray(x) && x.length === a.ids.length,
      )
    )
      return false;
    return a.ids.every((id, i) => {
      const q = map.get(id),
        o = a.order[i],
        v = a.answers[i];
      return (
        q &&
        a.fingerprints[i] === fingerprint(q) &&
        Array.isArray(o) &&
        o.length === q.options.length &&
        new Set(o).size === o.length &&
        o.every((x) => Number.isInteger(x) && x >= 0 && x < q.options.length) &&
        (v === null ||
          (Number.isInteger(v) && v >= 0 && v < q.options.length)) &&
        typeof a.checked[i] === "boolean" &&
        !(a.checked[i] && v === null && a.kind !== "exam") &&
        !(a.kind === "exam" && a.finishedAt === null && a.checked[i])
      );
    });
  }
  function remaining(a, now = Date.now()) {
    return a.kind === "exam"
      ? Math.max(0, Math.ceil((a.deadline - now) / 1000))
      : null;
  }
  function score(a, bank) {
    const map = new Map(bank.map((q) => [q.id, q]));
    let correct = 0,
      answered = 0;
    a.ids.forEach((id, i) => {
      if (a.answers[i] !== null) {
        answered++;
        if (a.answers[i] === map.get(id).answer.charCodeAt(0) - 65) correct++;
      }
    });
    return {
      total: a.ids.length,
      answered,
      correct,
      percent: Math.round((100 * correct) / a.ids.length),
    };
  }
  function finish(s, bank, today, now = Date.now()) {
    const a = s.active;
    if (!a || a.finishedAt !== null) return null;
    const map = new Map(bank.map((q) => [q.id, q]));
    a.ids.forEach((id, i) => {
      if (!a.checked[i] && (a.answers[i] !== null || a.kind === "exam")) {
        answer(s, map.get(id), a.answers[i], today, a.kind);
        a.checked[i] = true;
      }
    });
    a.finishedAt = now;
    const result = { ...score(a, bank), kind: a.kind, finishedAt: now };
    s.sessions.push(result);
    s.sessions = s.sessions.slice(-60);
    return result;
  }
  const api = {
    empty,
    repair,
    fingerprint,
    lectureSignature,
    reconcile,
    datePlus,
    spacing,
    answer,
    confidence,
    due,
    shuffle,
    balanced,
    createSession,
    validSession,
    remaining,
    score,
    finish,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }
  let memory = null,
    unavailable = false;
  api.read = () =>
    unavailable && memory ? memory : repair(loadProgress().statistics);
  api.save = (s) => {
    const p = loadProgress();
    p.statistics = s;
    recordActivity(p, todayKey());
    memory = s;
    unavailable = !saveProgress(p);
    return !unavailable;
  };
  api.storageUnavailable = () => unavailable;
  root.StatisticsStudy = api;
  root.recordStatisticsAnswer = (q, selected, source = "lecture") => {
    if (!q?.id.startsWith("statistics.")) return;
    const s = api.read();
    answer(s, q, selected, todayKey(), source);
    api.save(s);
  };
})(typeof window !== "undefined" ? window : globalThis);
