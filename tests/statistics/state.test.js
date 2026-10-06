const assert = require("node:assert/strict");
const fs = require("node:fs");
const S = require("../../statistics-study.js");
const C = require("../../statistics-calculations.js");
const bank = require("../../content/modules/statistics/questions.json");
const tools = require("../../content/modules/statistics/study-tools.json");
const topics = require("../../content/modules/statistics/topics.json").filter(
  (t) => t.lecture,
);
const today = "2026-10-06";
assert.equal(S.datePlus("2026-03-28", 3), "2026-03-31");
assert.equal(S.datePlus("2028-02-28", 1), "2028-02-29");
assert.equal(S.datePlus("2026-12-31", 1), "2027-01-01");
assert.deepEqual(S.spacing(0, "hard", today), {
  interval: 1,
  due: "2026-10-07",
});
assert.equal(S.spacing(200, "easy", today).interval, 365);
let s = S.empty(),
  q = bank[0],
  right = q.answer.charCodeAt(0) - 65,
  wrong = (right + 1) % 4;
S.answer(s, q, wrong, today);
assert.equal(s.questions[q.id].needsReview, true);
assert.equal(S.due(s, bank, today, false)[0].id, q.id);
S.answer(s, q, right, today);
assert.equal(s.questions[q.id].needsReview, false);
assert.equal(s.questions[q.id].misses, 1);
assert.equal(s.questions[q.id].attempts, 2);
S.confidence(s, q, "easy", today);
assert.equal(s.questions[q.id].due, "2026-10-13");
S.confidence(s, q, "easy", today);
assert.equal(s.questions[q.id].due, "2026-10-13");
assert.equal(s.questions[q.id].attempts, 2);
assert.equal(S.confidence(s, q, "hard", "2026-10-07"), false);
assert.equal(S.due(s, bank, today, false).length, 0);
const qs = bank.filter((x) => x.topic === q.topic),
  old = {
    lectures: {
      [q.topic]: {
        signature: S.lectureSignature(qs),
        answers: qs.map((x, i) => (i === 0 ? wrong : null)),
        checked: qs.map((x, i) => i === 0),
      },
    },
  };
let seeded = S.reconcile(S.empty(), bank, old, today);
assert.equal(seeded.questions[q.id].due, today);
assert.equal(seeded.questions[q.id].lastDate, null);
S.answer(seeded, q, right, today);
S.reconcile(seeded, bank, old, today);
assert.equal(seeded.questions[q.id].lastCorrect, true);
assert.equal(seeded.questions[q.id].attempts, 2);
const changed = bank.map((x) =>
  x.id === q.id ? { ...x, answer: String.fromCharCode(65 + wrong) } : x,
);
S.reconcile(seeded, changed, old, today);
assert.equal(seeded.questions[q.id], undefined);
for (const size of [12, 24, 60, 120]) {
  const session = S.createSession(bank, {
    size,
    kind: "exam",
    minutes: 20,
    now: 1000,
  });
  assert.equal(S.validSession(session, bank), true);
  assert.equal(session.ids.length, size);
  for (const t of topics)
    assert.equal(
      session.ids
        .map((id) => bank.find((x) => x.id === id))
        .filter((x) => x.topic === t.id).length,
      size / 6,
    );
  assert.equal(S.remaining(session, 1000), 1200);
  assert.equal(S.remaining(session, 1201000), 0);
  assert.equal(
    S.validSession(
      { ...session, order: session.order.map(() => [0, 0, 0, 0]) },
      bank,
    ),
    false,
  );
  assert.equal(
    S.validSession(
      session,
      bank.map((x) => ({ ...x, question: x.question + " updated" })),
    ),
    false,
  );
  const roundTrip = S.repair(
    JSON.parse(JSON.stringify({ ...S.empty(), active: session })),
  );
  assert.deepEqual(roundTrip.active.order, session.order);
}
assert.throws(() => S.createSession(bank, { size: 0 }));
assert.throws(() => S.createSession(bank, { kind: "exam", minutes: Infinity }));
s = S.empty();
s.active = S.createSession(bank, {
  size: 12,
  kind: "exam",
  now: 1000,
  minutes: 10,
});
const first = bank.find((x) => x.id === s.active.ids[0]);
s.active.answers[0] = first.answer.charCodeAt(0) - 65;
const r = S.finish(s, bank, today, 601000);
assert.deepEqual(
  { correct: r.correct, total: r.total, answered: r.answered },
  { correct: 1, total: 12, answered: 1 },
);
assert.equal(
  Object.values(s.questions).filter((x) => x.needsReview).length,
  11,
);
assert.equal(S.finish(s, bank, today, 602000), null);
assert.equal(s.sessions.length, 1);
assert.equal(S.validSession(s.active, bank), true);
s = S.empty();
s.active = S.createSession(bank, { size: 12, kind: "practice", now: 1000 });
S.finish(s, bank, today, 2000);
assert.equal(Object.keys(s.questions).length, 0);
assert.equal(s.sessions[0].total, 12);
const damaged = S.repair({
  version: 1,
  questions: {
    bad: {
      fingerprint: "x",
      lastCorrect: true,
      due: "2026-02-30",
      attempts: -4,
    },
  },
  exercises: { se: { variant: -9, attempts: "x" }, bad: 12 },
  explanations: { ppv: { text: "<script>", checks: "bad" } },
  sessions: [{ total: NaN }],
  workshops: { 7: "true", 10: true },
});
assert.equal(damaged.questions.bad.due, null);
assert.equal(damaged.exercises.se.variant, 0);
assert.equal(damaged.exercises.bad, undefined);
assert.deepEqual(damaged.explanations.ppv.checks, []);
assert.equal(damaged.workshops[7], false);
assert.equal(damaged.workshops[10], true);
// Independent reference answers exercise both examples of every calculation.
const expected = {
  se: [[2], [2]],
  ci: [
    [66.080072, 73.919928],
    [114.120108, 125.879892],
  ],
  ppv: [[65.217391], [66.666667]],
  binomial: [[0.2048], [0.25]],
  normal: [[0.02275013], [0.15865525]],
  variance: [[4], [6.666667]],
  "t-test": [
    [-2.98142397, 19],
    [2, 15],
  ],
  "z-test": [[2], [-2]],
};
for (const ex of tools.calculations)
  for (const [i, p] of ex.variants.entries()) {
    const sol = C.solve(ex.kind, p);
    sol.values.forEach((v, j) =>
      assert.ok(Math.abs(v - expected[ex.id][i][j]) < 0.00001, ex.id),
    );
    assert.equal(C.check(sol, expected[ex.id][i].map(String)).correct, true);
    assert.equal(
      C.check(
        sol,
        sol.values.map(() => ""),
      ).valid,
      false,
    );
    assert.equal(
      C.check(
        sol,
        sol.values.map(() => "Infinity"),
      ).valid,
      false,
    );
    assert.equal(
      C.check(
        sol,
        sol.values.map((v) => String(v + 10)),
      ).correct,
      false,
    );
  }
// Validate all published content references, dependencies and learner-facing answer keys.
assert.equal(tools.schemaVersion, 1);
assert.equal(tools.nodes.length, 6);
assert.equal(tools.calculations.length, 8);
assert.equal(tools.interpretations.length, 6);
for (const key of [
  "nodes",
  "formulas",
  "calculations",
  "interpretations",
  "stata",
]) {
  const list = tools[key];
  assert.equal(new Set(list.map((x) => x.id)).size, list.length);
  for (const item of list) {
    const t = topics.find((t) => t.id === item.topic);
    assert.ok(t, "known covered topic");
    const config = JSON.parse(
      fs.readFileSync("content/modules/statistics/" + t.lecture),
    );
    const html = fs.readFileSync(
      "content/modules/statistics/" + config.guide,
      "utf8",
    );
    assert.ok(
      item.section >= 1 &&
        item.section <= html.split('class="section-intro"').length - 1,
      "valid guide section",
    );
    if (key === "stata") {
      assert.ok([7, 10].includes(item.workshop));
      assert.ok(item.answer >= 0 && item.answer < item.options.length);
    }
    if (key === "interpretations")
      assert.ok(item.rubric.length >= 3 && item.model.length > 100);
  }
}
for (const n of tools.nodes)
  for (const p of n.prerequisites) {
    assert.ok(tools.nodes.some((x) => x.id === p));
    assert.ok(
      tools.nodes.findIndex((x) => x.id === p) < tools.nodes.indexOf(n),
      "acyclic prerequisites",
    );
  }
console.log(
  "Statistics state, scheduling, exam scoring, reference calculations and study content checks passed.",
);
