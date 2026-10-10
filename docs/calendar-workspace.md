# Calendar & Key Dates workspace

`calendar.html`, `calendar-page.css` and `calendar.js` render the cohort's existing `keyDates` from `content/programme.json`. No academic dates or generated ICS files are changed by the visual redesign.

The full timeline is the default. Category, text and current/past filters intersect; Clear filters resets them. The month card shows exact-date periods only. Month-only approximate windows are listed separately, never represented as invented daily appointments. This is a programme-period overview, not the individual exam or class schedule. Dates are evaluated in Europe/Rome, regardless of the visitor's device zone. Calendar navigation supports arrow keys, Home/End and Page Up/Down. Filters stay in page memory and are restored after printing the complete key-date list.

Subscription selection uses the existing saved study plan and `calendar/calendars.json`. A missing plan-specific file falls back to the same cohort's full calendar, with an explicit explanation. Providers receive only the selected public subscription URL after the visitor follows a link. Copy failure selects the URL for a device-native copy operation. Failed programme and subscription loads have independent retry actions. There is no new login, tracking or storage.

The existing Community events renderer and hidden-until-published behavior are preserved. Provider guidance links to primary Google, Apple and Microsoft support documentation. Subscriptions receive later updates on the provider's refresh schedule; a one-time ICS import is not a subscription. A scheduled source refresh is not a guarantee of fresh data, and a calendar action is not an exam booking.

The homepage uses `home-roadmap-preview.js` and `home-roadmap-preview.css`: all Now items can be browsed one at a time, and all validated published releases three at a time, in fixed-height cards. Arrows, counters, boundary states and links remain keyboard accessible. No timer changes the user's selection and no draft updates are included.

Validation: `node tests/home-calendar/browser.test.js .`, existing homepage/roadmap/handbook checks, `node scripts/check-content.js`, colour contrast, and `node scripts/stamp-versions.js --check`.

## October 2026 review

The focused homepage/calendar suite and the existing homepage and roadmap browser suites passed together in [the final layout check](https://github.com/AdnanTarabishi/eu-hem-student-hub/actions/runs/38020760160). Desktop and phone screenshots were reviewed, including both colour themes. The upward release arrow reuses the existing downward sprite with a rotation; no missing icon is referenced. Long shared-menu descriptions are allowed to wrap on these two pages only, without altering the shared navigation or other page styles.

The permanent `home-calendar-checks.yml` workflow repeats the checks on pull requests. Its main-branch run additionally compares the four public JavaScript/CSS assets with the exact checked-out source and runs `tests/home-calendar/live.test.js` against the published site. That smoke test uses only read-only requests and captures the actual homepage and calendar on desktop and phone; it does not register for events, subscribe the user to calendars or submit contact forms.
