# Announcements newsroom

The public `announcements.html` noticeboard now uses `announcements-newsroom.css` and
`announcements-newsroom.js`. Shared navigation, global styles, the homepage layout and
the CSV synchronisation job keep their existing roles. The page reuses the shared date,
CSV and election rendering helpers in `announcements.js`. Its independent read of the
same local CSV keeps the new UI isolated from the existing site-wide urgent loader.
`announcementTodayKey()` supplies the same Europe/Rome calendar day to the shared loader,
site-search indexing and newsroom without changing unrelated date helpers in `utils.js`.

The source remains the class Google Sheet, copied to `data/announcements.csv` by
`scripts/fetch-announcements.js` through the **Update announcements** workflow, scheduled every
15 minutes. Edit the Sheet, not the generated CSV. Failed syncs leave the last successful copy
available. The editor dashboard backend is not connected by this design update.

## Behaviour

- One featured active update (urgent first, otherwise pinned/newest), without duplicating
  it in the default grid. Searching, filtering, chronological sorting or switching to list view
  shows a normal feed without a separate spotlight.
- Accent-insensitive, multiword search; original category labels; new-only filter;
  pinned-first / newest / oldest sorting; responsive grid/list layouts.
- Category filters are buttons with `aria-pressed`. Supported source categories are Urgent,
  University, Academic, Student, Social, Programme, Student Hub and Student Community;
  other labels retain a general style. Candidate names are included in election searches.
- Full messages in a native keyboard-accessible dialog. Existing announcement hashes
  still open their full details, including both approved election result groups.
- Closing the reader restores focus and supports browser Back/Forward navigation. The page
  behind an open reader stays still while the message scrolls.
- Copy-link button with a selectable-text fallback when clipboard permission is denied.
- Active/new/pinned counts reflect published items that are currently visible by date.
  The newsroom's active/new/expiry calculations use Europe/Rome; scheduled and expired posts
  stay hidden. A post remains visible on its expiry day. Date state is rechecked when the tab
  becomes visible and every minute, so an open page handles a new calendar day.
- Invalid feeds or failed loads show an error with a retry. Chronological sorts keep undated
  posts after dated posts; duplicate announcement IDs are collapsed to one entry.
- No accounts, tracking, new persistent browser storage, remote photos or new dependencies.

## Covers and optional photos

Current posts use original local SVG illustrations in `assets/announcements/`, selected through
a shared registry in `announcement-media.js` using the story's stable ID. The homepage carousel uses
the same artwork and the existing shared loader, without a second CSV request. It rotates every six
seconds while visible, with previous/next and Pause/Play controls. Hover and the stable controls allow
rotation to continue; arrow browsing gives the selected story a fresh six seconds. Focusing a story
link, hidden tabs, off-screen content and reduced-motion preferences pause rotation. Explicit Pause
stays paused until Play is chosen, including while browsing with the arrows. Covers are decorative;
the adjacent title and accessible text hold the news facts. They do not depict real people or
document events. A general decorative cover is available for other updates and failed images.

A published sheet can still optionally include `Image`, `Image alt`, and `Image credit` columns;
none is required for the original covers. An accepted local photo overrides the illustration.
Use a **local** path such as `img/news/campus.webp` or `assets/images/news/campus.jpg`.
For Sheet-provided images, only local PNG, JPG, WebP and AVIF paths are accepted; remote URLs,
SVG, data URLs, path traversal and executable URLs are rejected. The original SVG covers are
trusted local assets selected by code, not unrestricted paths read from the Sheet. Keep meaningful
alternative text and required attribution with the row. Broken photos fall back to the decorative cover.
Publish only images the team has the right to use, with consent for identifiable people.
The existing Supabase copier does not yet export image columns; the decorative covers
continue to work when that backend is enabled. No schema migration is included.

## Validation

Run the focused checks from the repository root:

```sh
node scripts/check-content.js
node scripts/check-contrast.js
node tests/announcements/data.test.js
node tests/announcements/dom.test.js
```

The data checks exercise the shared public CSV and date rules without a browser. The DOM checks
exercise rendering and interactions; they need `jsdom` installed or `JSDOM_MODULE` set to the path
of an existing jsdom package. They do not establish visual layout or native dialog focus behaviour.

For real browser checks, install the project's development dependencies and Playwright's Chromium,
then run:

```sh
npx playwright install --with-deps chromium
node tests/announcements/browser.test.js .
node tests/home/news-carousel.test.js .
```

This suite serves the actual files locally, waits for local fonts, and exercises counts, controls,
reader navigation and responsive layouts at 320, 390 and 1280 px in both themes. It uses Playwright's
bundled Chromium rather than a machine-specific executable. `SCREENSHOT_DIR` overrides the default
`test-artifacts/announcements` screenshot directory. `.github/workflows/check-announcements.yml`
runs the data and browser checks for relevant pull requests and uploads screenshots for review.

The earlier `python tests/announcements/browser.py` remains available for its inline Chromium
sandbox checks. It adapts fetch, history and storage, so it cannot verify native browser history,
live network or PWA delivery. `EUHEM_SITE_ROOT` and `EUHEM_TEST_OUTPUT` override its directories.
The real browser suite also uses controlled data and does not replace checking a deployed update.

Run `node scripts/stamp-versions.js` after edits. New page assets and election CSS are
listed in `sw.js`; offline data continues to use the existing service-worker strategy.
