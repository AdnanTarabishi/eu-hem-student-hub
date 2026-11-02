# Fundamentals of Statistics: practice and quizzes

`fund-statistics.html#quizzes` connects the unchanged 90 lecture MCQs to 50 original mixed-format questions. There are 140 questions in total and 124 in the default core pool: Topics 1–5, excluding the supplementary power question. Topic 6 and supplementary context are explicit opt-ins.

## Learn by solving

- **Learn** checks one response at a time, with explanations, option rationales, numerical steps and links to the topic guide. Hints and “I don’t know” are supported practice, rather than independent successes.
- **Self-test** keeps solutions hidden until submission. Optional 15- or 30-minute deadlines continue across navigation and reload. A late input cannot extend the deadline.
- Filter by topic, type, difficulty and new/missed questions. Selection balances topics and types where the pool permits. Question and option order remain fixed for the saved session.
- The first submitted answer counts once per question in a session. Trying again after feedback cannot erase that miss. A later independent session can update the latest result.
- Numerical answers have explicit absolute rounding tolerances and units. Multiple-select answers require the complete correct set, with no partial credit.
- Written interpretations use a model and concrete self-assessment rubric. They never count as automatically correct answers. Viewed written prompts are tracked separately from automatic performance.
- The dashboard reports latest independent accuracy by topic and a review queue. These are study indicators, not mastery claims or exam-grade predictions.

## Content and provenance

`content/modules/fund-statistics/self-tests.json` contains 10 original items per core topic: two MCQs, two multiple-select questions, four calculations and two written interpretations. It supplements, rather than changes, the lecture-bank schema documented in `content-format.md`. Never copy official examination questions or publish teacher slides, datasets or answer files.

New MCQ answers are zero-based option indices; multiple-select answers are arrays of indices. Choice items have one rationale per option. Numeric items have a finite `answer`, positive absolute `tolerance`, `unit` and worked `steps`. Written items have a model `answer` and `rubric` array. Every item has a stable unique ID, topic, difficulty, hint, explanation and original-practice source label. Keep IDs stable; do not recycle deleted IDs.

The pure helpers are in `fund-statistics-quiz-core.js`; UI and scoped styles are in `fund-statistics-quizzes.js` and `.css`. The course overview, Practice tab and topic cards link to the workspace. `?quizTopic=<topic-id>#quizzes` preselects a valid topic without deleting a saved session.

## Saved progress

The caller stores only `progress.statistics['fund-statistics.quiz-v1']` in the existing Notes progress object. Cases, lab checks and other modules keep their own keys. The ordinary Notes export/import includes this state. No account, server, analytics or remote score collection is added.

Saved responses and option orders are validated against current question signatures; changed keys, tolerances or written rubric criteria invalidate affected state. Explanatory copy changes do not erase automatic results. Storage failure leaves the current in-memory session usable and shows the existing warning.

## Full-format mock

The separate 90-minute rehearsal retains its 35% / 30% / 35% practice weighting and explicitly self-assessed written criteria. New sessions choose balanced MCQs, shuffle options and rotate two original core-safe case forms from `fund-statistics-mock-bank.js`. The earlier form includes Topic 6 and is offered only for optional extended practice; existing version-1 sessions can still be resumed and are labelled accordingly. New session state has a content signature. Mock answers stay in session storage, independently of the Notes backup, as the interface explains.

Exam sitting times are not copied into the practice instructions: use the existing exam listing and confirm the assigned time and room on AlmaEsami.

## Validation

- `npm run test:fund-quizzes`: pure grading/state contracts, independent numerical reference values, mixed-format browser flows, saved-state handling and offline use.
- `npm run test:fund-statistics`: existing lecture/case/lab/course regressions, plus new content/core checks.
- `npm run test:practice`: shared practice regression coverage.
- `node scripts/check-contrast.js`: shared design-token contrast.
- Run `node scripts/stamp-versions.js` after HTML/CSS/JS edits and before the final content check. New scripts/styles are included in the existing service worker; the supplemental JSON is cached through its existing data strategy after an online visit.

Browser tests use the installed Chromium, local fictional practice data and blocked external requests. No real exam submission or external contact endpoint is exercised.
