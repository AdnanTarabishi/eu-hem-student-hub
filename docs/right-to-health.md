# Right to Health study workspace

Course 96500, at the existing `course.html?course=right-to-health` address.
This is an unofficial, AI-assisted original study edition, not lecturer-approved
content, legal advice, an exam prediction, or a replacement for Virtuale.

## Expanded edition — 8 October 2026

The original ten guides now contain **70 explanation sections** (40 existing +
30 expanded), with precise PDF page locators on each addition. Existing topic,
question and flashcard identifiers are retained. The current practice collection
contains **80 MCQs, 20 open-answer scaffolds and 60 flashcards**. There remain
24 glossary entries and 24 source records. These counts describe the current
edition; the initial edition and its tests are documented below.

### Casebook and reading improvements

The Casebook has **12 source-linked cases covering all ten topics**. Each case
includes a labelled scenario, a first-choice check with explanation, three
progressively revealed reasoning steps, a bounded conclusion, a misconception
warning, and links to the associated guide, practice and source. It distinguishes
hypothetical applications from comparisons of cases discussed in the lectures.
No case response is represented as the lecturer's answer or an official grade.

Optional analysis is held in JavaScript memory for this open page only. Switching
cases or course tabs retains it; refresh or closing the page loses it. Export to
plain text is provided. The Casebook neither writes to localStorage nor submits
anything over the network. Workshop and native study-progress storage retain
their existing, separate behaviour and keys. A late timetable response does not
redraw the Casebook and erase an in-progress response.

Study guides can be filtered by title, description and section headings. The
reader has a keyboard-accessible chapter jump control, visibly labelled expanded
sections, precise reading locations and topic-filtered Casebook links.
`scripts/build-right-to-health-notes.js` deterministically regenerates the native
Markdown notes from workspace.json so search and the course reader agree.

### Content boundaries

The additions retain the lectures' four perspectives, judicial-procedure versus
merits distinctions, AAAQ and duty frameworks, the ground–field–instrument
approach to non-discrimination, and the values/principles diagrams. Country
readings preserve their years and separate reform mechanisms from results and
proposals. The final EHU values diagram remains a proposal attributed to the
workshop, not enacted law. The cited article or complete books are not claimed
to have been independently reviewed. Numerical cases use explicitly invented
values and do not determine real reimbursement or insurance eligibility.

### Expanded-edition validation

22 Node tests and 131 adapted inline Chromium checks pass locally, including
12-case coverage, section-to-Markdown parity, retention of old identifiers,
choice feedback, progressive reveal, temporary draft behaviour, export content,
source/topic navigation, blocked storage, late timetable responses, fallback and
unrelated-course regression. Layout checks cover 320, 390, 768 and 1440 pixels
in both themes. Content integrity, shared colour pairs and syntax checks pass.
The existing empty contribution/report-form and directory-endpoint warnings
remain unrelated and unchanged. Inline tests are not proof of live HTTP,
genuine browser persistence or service-worker delivery; localhost navigation was
blocked by the execution environment. The additional `http-browser.py` test uses real HTTP and browser storage in CI,
with external feeds blocked and service workers disabled. It is not run locally
because navigation is blocked. Deployment checks are recorded separately in
GitHub Actions rather than inferred from these local tests.

## Scope and provenance

The source review covers the fourteen different documents supplied for the
2026/27 course: Organizational issues; Economic rights; Human rights;
Non-discrimination and its four-page short summary; Values and ethics; the
European Health Union workshop; Going Dutch (2007); the van de Ven/Schut
working paper (24 January 2008); Risk Selection (2015); the Hagen/Feiring
Norwegian reforms chapter (2025); Italy and Austria system summaries (2024);
and the Austrian Country Health Profile (2025). A duplicate organizational
PDF is not counted twice. The course notice supplies guest-session details.

Original short explanations preserve the four legal/ethical perspectives,
the Bismarck/Beveridge teaching framework, separate country readings and the
workshop. Every guide section identifies sources. Original practice items
include explanations and source locators. The full books listed in the reading
map have not been reviewed and are not treated as the source of unseen content.

Public Council conclusions and the linked manifesto are workshop preparation
sources. Four separately labelled supplementary public-authority references
clarify the Charter's scope and the difference between EHIC and planned care.
Supplementary material does not claim to extend the assessed syllabus.
The Italian publisher page could not be retrieved; that reading's year and
open-access status remain explicitly attributed to the lecturer's notice.

Keep source dates visible. The 2007/2008/2015 Dutch figures are historical;
country reports do not constitute current 2026 statistics. Do not compare
unmet-need percentages with different denominators. EHU proposals described
in the workshop slides are proposals, not enacted law. Unfilled slide answers
are not supplied as the lecturer's answers.

No slides, recordings, article PDFs, report figures, student data or photos are
republished. Link to Virtuale/DOI/public sources instead. Source text was
paraphrased into a study aid rather than reproduced as slide-by-slide copies.

## Initial-edition files and integration

- `content/modules/right-to-health/workspace.json`: 10 guides, 24 glossary
  entries and a 24-record source register, with locators and limitations.
- `topics.json`: the six pre-existing topic IDs are preserved; four country
  guide IDs are added. Do not rename published IDs.
- `notes/*.md`: native searchable notes with the same guide explanations.
- `questions.json`: 50 original MCQs and 10 open-answer scaffolds.
- `flashcards.json`: 40 source-attributed cards.
- `resources.json`: source records use matching numbered resource anchors.
- `right-to-health.js` and `.css`: page-scoped presentation, local exercises,
  source search and the workshop sheet.
- `notes-course.js`: guarded hooks for this exact course ID. Workspace-load
  failure leaves the ordinary course reader and practice tools available.
- `course.html`, `content/index.json`, `sw.js`: loading/index/offline wiring.
  Other root HTML changes are generated asset fingerprints only.

Metadata remains in `content/programme.json`. Schedule and exam feeds retain
existing UniBo readers. The supplied guest-session notice is visibly labelled
as a copy, not a second live timetable. The 23 October Q&A is not an exam date.

## Interactions and local data

Guide progress uses existing `euhem-progress-v1` data and backup/reset tools.
Workshop drafts use the separate `euhem-rth-workshop-v1` key, only after the
student presses Save. They are not included in the ordinary progress backup.
The UI explains this and offers a plain-text export. Clearing the draft requires
confirmation and does not reset guide progress. No network submissions exist.
Students must use hypothetical examples and avoid sensitive personal data.

The independent timetable response does not redraw an in-progress workshop or
exercise. An unsaved draft is still page-local: save/export before navigation.
The arithmetic explorer uses invented numbers and calculates compensation
minus expected claims. It does not estimate actual insurer profit, select
patients or determine reimbursement eligibility. The mobility explorer is a
source-labelled comparison, not an individual eligibility decision tool.

Offline assets are registered in the existing service worker. Content requires
an online visit before a saved data response can be used offline. Real offline
and persistent-browser behaviour need a deployed-browser check.

## Initial-edition validation (8 October 2026)

```
node --test tests/right-to-health/content.test.js
node scripts/check-content.js
node scripts/check-contrast.js
node --check right-to-health.js
node --check notes-course.js
EUHEM_SITE_ROOT=. python tests/right-to-health/browser.py
```

The browser script requires Python Playwright and Chromium. It uses the real
HTML/CSS/JS with adapted fetch, URL, history and localStorage because navigation
is restricted in the build environment. 93 checks cover interactions, native
practice, source filters, late timetable response, blocked storage, workspace
failure and an unrelated course. Layout checks cover 320/390/768/1440px in
light/dark modes. These do not establish live HTTP, genuine persistence or
service-worker delivery. The contrast script tests registered shared colour
pairs, not complete WCAG conformance of every page element.

Before publishing, rebuild `content/index.json`, run `scripts/stamp-versions.js`
and inspect the complete diff. Existing empty contribution/error-report form
settings and directory endpoint remain unchanged.
