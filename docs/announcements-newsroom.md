# Announcements newsroom

The public `announcements.html` noticeboard now uses `announcements-newsroom.css` and
`announcements-newsroom.js`. Shared navigation, global styles, `announcements.js`,
the homepage summary and the CSV synchronisation job are unchanged. The page reuses
the shared date, CSV and election rendering helpers. Its independent read of the
same local CSV keeps the new UI isolated from the existing site-wide urgent loader.

## Behaviour

- One featured active update (urgent first, otherwise pinned/newest), without duplicating
  it in the default feed. Searching, filtering or chronological sorting shows a normal feed.
- Accent-insensitive, multiword search; original category labels; new-only filter;
  pinned-first / newest / oldest sorting; responsive grid/list layouts.
- Full messages in a native keyboard-accessible dialog. Existing announcement hashes
  still open their full details, including both approved election result groups.
- Copy-link button with a selectable-text fallback when clipboard permission is denied.
- Active/new/expiry calculations use Europe/Rome; no date-future or expired posts appear.
- No accounts, tracking, new persistent browser storage, remote photos or new dependencies.

## Covers and optional photos

Current posts have decorative CSS covers using existing site icons. These are illustrations,
not photographs of people or real events. There are no additional photo downloads.

A published sheet can optionally include `Image`, `Image alt`, and `Image credit` columns.
Use a **local** path such as `img/news/campus.webp` or `assets/images/news/campus.jpg`.
Only local PNG, JPG, WebP and AVIF paths are accepted; remote URLs, SVG, data URLs,
path traversal and executable URLs are rejected. Keep meaningful alternative text
and required attribution with the row. Broken photos fall back to the decorative cover.
Publish only images the team has the right to use, with consent for identifiable people.
The existing Supabase copier does not yet export image columns; the decorative covers
continue to work when that backend is enabled. No schema migration is included.

## Validation

`node scripts/check-content.js` and `node scripts/check-contrast.js` check site integrity
and shared theme tokens. `python tests/announcements/browser.py` exercises the current
CSV, filters, source safety, results, dialog, themes and 320/390/1440 px layouts. It uses
actual sources in an inline Chromium sandbox because browser network navigation is
blocked in this development environment. It does not validate live network or PWA delivery.
Use `EUHEM_SITE_ROOT` and `EUHEM_TEST_OUTPUT` to override its directories.

Run `node scripts/stamp-versions.js` after edits. New page assets and election CSS are
listed in `sw.js`; offline data continues to use the existing service-worker strategy.
