# Timetable workspace — Phase 1

The public timetable still reads the official UniBo feed and the shared programme
index. This update adds navigation and presentation, not inferred class dates,
attendance tracking, personal events, notifications or a new data provider.

## Views

- **Month** shows a Monday-to-Sunday calendar with every date in the selected month.
  A light tint and an explicit count mark dates with classes matching the active
  filters. Dots retain the programme's course colours. Adjacent-month dates are
  visually separate. Selecting a date opens its agenda beside the calendar (below
  it on phones). Open day view keeps the selected date.
- **Day** includes past and upcoming sessions on the chosen date. Its seven-day
  selector includes weekends and class counts. It is the default on a new phone.
- **Week** retains actual time positions, weekend sessions and overlap lanes.
  The existing desktop default and saved Week/List choices are preserved.
- **List** remains the searchable upcoming agenda with an optional past-class switch.

All class times and Today use Europe/Rome, regardless of the visitor's time zone.
Month arithmetic is date-only UTC, supports leap years and clamps the day when
moving from a longer to a shorter month. Day/week/month share a selected date;
Jump to date and the period-specific previous/next/today actions stay in sync.
`?view=month` and an optional validated `date=YYYY-MM-DD` can open a specific view.

## Teacher names and source data

Show teacher starts unchecked and affects schedule cards in all four views,
including Now & next. Searching still includes teachers when names are hidden.
The full details dialog always retains the teacher, room, notes, map and .ics action.
Matched courses link to their existing course workspace; unmatched feed titles are
shown without guessed links.

Only display preferences are stored: `euhem-timetable-view` (existing) and
`euhem-timetable-show-teacher`. Filters and selected dates are not uploaded or stored.
Existing study-plan storage is reused without replacing it. Blocked storage does not
prevent interaction. This falls under Display preferences in the Privacy notice.

Refresh retries the same official source and retains the current filters. A source
failure remains visibly different from an empty date; an empty calendar is never
presented as an official cancellation. The existing offline cache is unchanged.
A change-history tracker, a separately verified last-good data pipeline and automatic
alerts remain outside this visual phase.

## Accessibility and testing

The month is a native table with labelled date buttons and one tab stop. Arrow keys
move dates, Home/End move across the week, Page Up/Down move months and Enter/Space
select a date. The selected day and today have non-colour cues. View switches and
teacher controls use native buttons and checkboxes. The modal preserves Escape and
focus return. Mobile layouts use a full-width seven-column month, not a horizontally
scrolling desktop calendar.

- `node tests/planning/calendar.test.js`: date and duration helpers.
- `node tests/planning/browser.test.js .`: existing timetable and Exams regression suite.
- `node tests/planning/timetable-v2.test.js .`: new views, filters, teacher visibility,
  keyboard paths, empty/error states and 320/390/768/1440px light/dark layouts.
- `node scripts/check-content.js` and `node scripts/check-contrast.js`: shared integrity.
- `.github/workflows/timetable-checks.yml`: runs browser checks using fictional feeds;
  after a main-branch publication, runs a read-only live verification and saves previews.

New CSS is scoped to `.timetable-page`. `planning.css`, Exams and the shared UniBo
reader are not modified. The new stylesheet and date helper are in the service-worker
asset list; run `node scripts/stamp-versions.js` after changing assets.
