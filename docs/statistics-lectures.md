# Statistics for Healthcare · 2026/27

Module 74948, Martin Forster, within Quantitative Methods in Health and Healthcare.
The supplied PDFs' title pages date Classes 1–6 to 14 September, 16 September,
22 September, 24 September, 1 October and 5 October 2026. File creation dates
are not treated as lecture dates. The alternate Economics and Public Policy
course code C8386 is not a second module in the EU-HEM study plan.

| Class | Stable topic ID | Interactive activities | MCQs |
| --- | --- | --- | --- |
| 1 | statistics.risk-uncertainty | Events, union, intersection and conditioning | 20 |
| 2 | statistics.probability | Diagnostic probabilities and binomial PMF | 20 |
| 3 | statistics.random-variables | Normal probabilities and uniform intervals | 20 |
| 4 | statistics.descriptive | Editable sample summaries and study-design scenarios | 20 |
| 5 | statistics.sampling | Repeated samples, exact small-population samples and known-σ CI | 20 |
| 6 | statistics.inference | One-mean z/t test, p-value and matching CI | 20 |

The original `statistics.q.001`–`020` sampling IDs remain stable. New IDs use
`statistics.q.class<number>-<number>`. All six pages use the same template and
shared Notes progress backup, with independent per-topic quiz state.

Sources reviewed: the six supplied full lecture PDFs, course outline, assessed
work 1A and 1B question and answer files, the 2022/23 exam #2 and the normal
distribution spreadsheet. Guides and MCQs are original study explanations and
practice, not reproductions of official assessment papers. The spreadsheet's
CDF and interval calculations informed the normal explorer. Source PDFs, XLSX,
screenshots of slides and official answer sheets are not published in this repository.

The full Class 5 PDF includes confidence intervals, so those explanations and
questions are core material rather than supplementary material. Its sampling
distribution example uses μ=27.5 and σ²=168.75. The five-person example samples
without replacement and requires a finite-population adjustment; the general
σ/√n formula assumes independent draws. SD and SE have original units.

Class 6's worked example n=20, x̄=5, s=3, μ₀=7 yields t(19)=−2.98142397,
p=0.00767061 and a 95% CI [3.59595678,6.40404322]. The page calculates these
without rounding before making a decision. It follows the lecture's boundary
convention: p<α rejects, p>α does not reject, equality is the boundary. Normal
probabilities use an erf approximation; Student's t uses a regularised incomplete
beta calculation, with numerical inversion for critical values. Small non-normal
samples are not accepted by the teaching calculator; n≥30 is explicitly a course
rule of thumb. These tools are for learning, not clinical decision making.

Classes 7, 8, 9, 10 and Tutor Classes 2 and 3 are marked upcoming with the user’s
exact Virtuale section links. Two-mean tests, regression, full Stata output
interpretation and later material are not presented as completed. The course
assessment also includes interpretation and explanations; MCQs alone do not
cover the full exam. Official materials: https://virtuale.unibo.it/course/view.php?id=84235.

Validation: `node scripts/check-content.js`, `node tests/lectures/math.test.js`,
and `node tests/lectures/browser.test.js .` (uses Playwright and installed Chromium).

## Statistics Study Centre

`statistics.html` connects eight study tools to the same 120-question bank:
progress, mistake review, daily spaced review, balanced mixed MCQ sessions,
typed calculations, written interpretation, a concept/formula reference and
synthetic Stata-output practice. It is linked from the course lecture list and
every Statistics lecture. `study-tools.json` contains original teaching prompts,
nine calculations with two examples each, seven interpretation prompts, fourteen
formula entries, six dependency-map nodes and three Stata examples.

`statistics-study.js` owns the pure scheduling and session engine. Lecture and
course-practice MCQs feed the same question records after submission. Reading
status stays separate from latest question accuracy. Earlier checked lecture
answers are imported once when their bank signature matches; their unknown
review date is treated as due today. Editing question wording, options or its
answer key invalidates the affected record and any session containing it.
Successful retries resolve current mistakes but retain earlier miss counts.

Review intervals: incorrect = today; first correct = three days; Hard = at least
one day and 1.2× the previous interval; Good = 2.5×; Easy = seven days initially
and 3× subsequently. Intervals cap at 365 days. Changing confidence repeatedly
does not compound the interval or increment attempts. Dates follow the device's
calendar. This is a transparent revision heuristic rather than a validated
learning prediction.

Practice and review show feedback after checking. Exam mode hides correctness
until submission and uses a persisted wall-clock deadline that continues when
the page is reloaded or another tool is open. Expired sessions submit once;
unanswered exam questions count as incorrect and enter review. Options retain
their shuffled order across reloads; sessions balance coverage across the six
classes. A finished session's result is stored once, with up to 60 recent sessions.

Calculation grading states its rounding tolerance and derives worked solutions
from the same parameters using the existing normal/t math. Interpretation text
and rubrics are local self-assessment, without external AI calls. Stata outputs
are synthetic educational examples; upcoming workshops stay globally upcoming.
A learner can preview preparation or mark a workshop covered on their own device.
The regression example is explicitly a later-workshop preview.

State is additive under `statistics` in the existing progress entry, so Notes
backup, restore and reset include it. No accounts, analytics, server grading or
notifications are introduced. Private-browser storage failures show a visible
message and allow the current page session to continue in memory. Service-worker
assets and captured public content make the study tools work offline after one
connected visit; following a lecture link offline requires having visited that
lecture first. Clearing browser storage removes local progress and offline copies.

Validation: `npm run test:statistics` checks scheduling, import reconciliation,
content references, independently calculated numeric results, shuffled balanced
sessions, deadline/score idempotence, all eight browser flows, local drafts,
backup/restore, mobile/dark rendering, offline reload and unavailable storage.
`npm run test:lectures` remains the shared-lecture regression suite.


## Course 96525 visual redesign

The integrated Quantitative Methods course uses a scoped shared identity in
`quant-methods.css` and `quant-methods.js`: Inter typography, an off-white canvas,
forest-green interactions, lime chart accents and consistent cards and navigation.
The course overview, six Statistics lectures and all eight study tools share it;
other courses retain their existing layouts. Both real modules are represented:
Statistics for Healthcare (74948, Martin Forster) and Econometrics (32626,
Elisabetta De Cao). Econometrics syllabus topics are clearly awaiting lecture
materials; they are not presented as completed guides.

`study-path.json` defines the six learning goals, useful keywords, linked
calculation/interpretation/formula IDs and a guide-section reference for every
MCQ. The overview has a live known-SD confidence-interval demonstration and
resume links; the classroom has concept search, class outcomes and future-session
links. Each lecture has a reading outline, contextual checks that select the
actual quiz question without resetting earlier responses, and related practice
plus previous/next classes.

The study centre accepts `?topic=<stable-topic-id>` for lecture-specific
calculations, explanations, formulas, mistakes and daily review. The chosen
focus survives a reload in the URL. Progress totals and mixed mocks still cover
the six classes; the interface states this explicitly. A new union-probability
exercise and population/estimand interpretation prompt give Class 1 the same
numeric and written practice coverage as the remaining classes. Existing learner
state and question IDs stay compatible with saved backups.

Review checks cover all 120 question-to-section mappings and every learning
path's exercises, formulas and model answers. The existing math/state suite adds
independent references for both new union-probability examples. Public data read
on an initial visit is retained for offline use even while the service worker is
starting. The new design does not require new packages, fonts or a backend.

`npm run test:quant-methods` verifies the two-module overview, live interval demo,
concept search, contextual checks, focus controls, saved progress, 320/390/768px
layouts, dark mode, offline navigation and other-course isolation. Use it together
with `npm run test:statistics` and `npm run test:lectures` before publishing.
