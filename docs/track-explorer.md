# Track Explorer

`tracks.html` is a student-built guide for comparing the four specialisations in
the supplied EU-HEM 2026 overview. The academic catalogue stays in
`content/tracks.json`; `tracks-data.js` is its shared reader. The redesign retains
all course identities, credits, theme tags, semester routes, choice groups,
paired options, prior-course restrictions, thesis universities and published
career sectors. See [the format](tracks-format.md) before updating these facts.

## Content and sources

`content/tracks-guide.json` contains student-authored decision prompts,
preparation ideas, coordinator questions and supplementary FAQs. These are
suggestions, not prerequisites or a measure of programme quality. Its review
scope records which official public sources were available on 10 October 2026;
the unavailable UiO structure page does not receive a new credit/code verification
date. Existing credit provenance and the unknown MHI Oslo choice rule stay intact.

UniBo uses Economics and Policy, while consortium/Erasmus pages use Health
Economics & Policy. A linked naming note explains the variation. The canonical
catalogue name is retained for compatibility with the other Hub pages.

Comparison labels describe **student-assigned course tags in Semesters 2–3**.
The common first semester is excluded. No tagged course is not proof that a
topic is absent from teaching. Required courses, elective options and complementary
choices retain their exact rules; available options are not all courses a student
will take. Identical displayed comparison criteria can be hidden with Show
differences only. This does not estimate workload, difficulty or graduate outcomes.

## Design and navigation

`tracks.css` is scoped to `.tracks-page`, leaving shared site styling intact.
Five original local SVG illustrations use the Hub's navy, warm paper and semantic
track accents. They are conceptual artwork. They contain no portraits, university
logos, map claims or numerical findings.

The page puts the illustrated track collection and two-track comparison first.
The complete four-track matrix and shared-course lists are expandable. The
detailed curriculum retains keyboard-operated tabs on wide screens and native
accordions on phones. A section index links to the comparison, explorer, worksheet,
personal preference, interest quiz and sources.

## Personal state and links

- The existing `euhem-track-v1` preference is written only when the visitor picks,
  changes or removes My track. A saved preference must match the displayed cohort.
  It does not submit or change an official university track choice. Storage failures
  do not show a successful save/remove message.
- Quiz answers and their shuffled display order remain in page memory. All tracks
  tied for the highest points are shown equally; points are not percentage fit or
  an assessment of ability. The result explains each answer's contribution and
  supports review, retake and clearing.
- `tracks-workspace.js` keeps checklist choices and free-text comparison notes in
  page memory only. There is no autosave, account, receiver, background queue or
  data submission. Reloading or leaving loses these notes.
- Download comparison notes is an explicit plain-text export. It includes the
  currently compared tracks, required courses, exact option groups, credit
  uncertainty/provenance, checked prompts and the visitor's notes. It excludes quiz
  answers and unrelated Hub storage. A downloaded file can contain personal notes.
- Public comparison links use `cohort`, `compare=eeh,ep`, `differences=1`, and the
  optional collection filters `q` and `theme`. Personal notes and checklist choices
  are excluded. Search/filter values can enter browser history and shared links.
  Copying failure provides a regular link without discarding the comparison.

Course/topic filters narrow only the four overview cards. Detailed curricula
remain available. Topic filtering uses course tags; text search also includes
student explanations and focus areas and is not a recommendation score.

## Failure and offline behaviour

Track data has an explicit retry and an official-source fallback. When the extra
guide cannot load, the comparison worksheet remains usable with generic prompts;
retrying the guide retains current notes and checkmarks. JavaScript-disabled
visitors receive links to official information.

The existing service worker caches the new public stylesheet, script and art.
Track and guide JSON use the existing network-first content cache: offline data
requires a previous successful visit. Personal notes and quiz answers are never
added to this cache.

## Validation

```sh
npm run test:tracks
node scripts/check-contrast.js
node scripts/stamp-versions.js --check
```

Focused tests protect the approved factual catalogue, route/choice integrity,
tag semantics, scoring and ties, exported rules and private-note boundaries.
Browser checks use local fictional fixtures and block external requests. They
cover filtering, comparisons, links/history, My track storage, guide failures,
downloads, quiz interactions, keyboard access and mobile/light/dark layouts.
They never submit a form to a real service.
