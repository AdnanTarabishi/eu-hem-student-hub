# Resource-first Notes workspace

`notes.html`, `notes-landing.css` and `notes-landing.js` own the landing experience. Shared readers, course pages, published content and local progress keys are unchanged.

## Main changes
- Compact heading/search; primary library with four keyboard-accessible tabs.
- Resource-first cards; native planning disclosures retain original dates, module names, exam registration links and source provenance.
- Desktop secondary rail for the existing personal snapshot, semester filters, actual format totals and study tools. The rail follows the library on smaller screens.
- Overview-only groups start folded when viewing all courses. Explicit status filters keep the selected group's courses expanded.
- Course names/codes and lesson-only topics added to the landing search. The shared `buildSearchIndex` function remains unchanged for other consumers.
- Eight initial results per type, with additional batches of twelve; focus moves to the first newly added result. In-place glossary filtering and a useful empty saved-list state.

## Data and privacy
No academic content is added or rewritten. No new personal data is collected. Existing `localStorage` keys, export/restore behaviour and course URLs are preserved. Dates and counts use the shared data helpers, including the original official/fallback distinction. The semester label comes from the programme file, not a hard-coded cohort.

## Validation
Run `node scripts/check-content.js`, `node scripts/check-contrast.js`, `node tests/notes/schedule.test.js`, `node tests/notes/browser.test.js .`, `node tests/notes/workspace.test.js .`, and `node tests/notes/practice.test.js .`. Browser checks require Playwright and Chromium. `NOTES_SCREENSHOT_DIR` selects where reviewed browser captures are written. Existing date tests wait for attached content before opening the native planning disclosure; their date and registration assertions are retained.

Run `node scripts/stamp-versions.js` after changing HTML/CSS/JS. No new runtime assets need to be added to `SITE_FILES`.

The full design brief is in `docs/notes-workspace-prompt.md`.
