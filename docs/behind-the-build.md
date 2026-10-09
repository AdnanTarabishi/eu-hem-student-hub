# Behind the Build

The public page is `behind-the-build.html`, under About in the shared menu and footer.
Roadmap & Updates includes a compact link card. The existing search indexes the menu,
so the new page is discoverable without changing Resources search logic.

## What the numbers mean

At the owner's request, the personal-effort estimate was restored to **approximately
60 hours** on 9 October 2026. Repository history and completed feature scope provide
evidence of the work, including development supported by ChatGPT, Codex and Claude Code,
but cannot establish hours worked. A complete time log and private Claude Code
conversation histories were not available. The 60-hour total is the owner's estimate,
not a stopwatch measurement, an audit, or a number derived from commit counts.
The allocation (15 design, 14 tools, 13 content, 9 testing, 6 planning, 3 launch) is
illustrative and sums to 60. Do not describe the categories as measured time logs.
No daily distribution is published because the available records cannot substantiate it.
AI tool runtime is not presented as measured human effort. No private conversations,
user activity records, third-party analytics or new personal data are published.

## Updating

1. Update `content/build-effort.json` after the owner supplies a revised estimate or
   authorizes a reassessment. Keep the category sum equal to `totalHours`; update
   `asOf` and the explanation in `estimateNotes` at the same time.
2. Run `node scripts/build-behind-build.mjs --integrate`. This regenerates the static page,
   updates the Roadmap teaser, and idempotently ensures menu and offline integration.
3. Run `node scripts/stamp-versions.js`, content checks and feature tests.
4. Review the diff before publishing. Amend the approved-snapshot test for a new total.

The generator has no network access or dependency. The First cohort beta date comes
from `content/roadmap.json` (7 October 2026), so the Behind the Build journey and the
Roadmap use the same milestone. The published page is static and readable without
JavaScript. JavaScript only switches hours/percentages and opens or
closes details. There is no tracking, timer or feature-specific local storage.
`behind-build.css` is scoped to this page and the Roadmap teaser. Shared HTML changes
from version stamping do not change Resources content or behavior.

## Validation

- `node tests/behind-build/data.test.mjs .`
- `node tests/behind-build/browser.test.mjs .`
- `node scripts/check-content.js`
- `node scripts/check-contrast.js`
- Existing shared-shell and Roadmap tests after integration.

The browser suite covers desktop/mobile light and dark layouts, a 320px viewport,
keyboard details, display controls, navigation, no-JavaScript use and the Roadmap link.
It uses only local files, with external requests blocked. Visual artifacts contain
only the public feature page, not student submissions or private information.
