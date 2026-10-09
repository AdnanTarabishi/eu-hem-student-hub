# Exams workspace

`exams.html`, `exams.js` and `exams-guide.css` present the same course-matched
UniBo collection in three views: two-column **Cards**, compact **List**, and
**Month**. `exams-workspace.js` contains pure source reconciliation, grouping and
study-link helpers. The existing `timetable-calendar.js` supplies date arithmetic.

The explanation of appelli is a native disclosure, closed by default, and works
without JavaScript. A course group contains each module's next available date;
additional published dates and booking details expand in place. These are not
labelled as the student's personal attempts. Disclosure state survives a view or
filter change in the same page. No additional browser storage or tracking is used.

## One administrative card, not a second banner

`assessmentNotice` remains in `content/programme.json`. For Introduction to
Economics, the notice is merged with a same-course, same-day feed entry, preserving
the feed time and booking windows. A conflicting time is disclosed. When that day
is absent, a clearly labelled lecturer-sourced date is added, with no guessed
booking deadline or room. Other published dates are preserved. The course card
always says **No final exam · enrolment required for recording**. The complete
Virtuale and recording-session requirements are in its disclosure, not a separate
full-page banner. The unknown Tuesday deadline and the distinction between a
required enrolment and guaranteed passing are unchanged.

The administrative calendar action exports a transparent point-in-time recording
reminder (no `DTEND`), not an invented two-hour exam. Normal exam exports still use
the shared helper and its duration qualifications. Neither action registers anyone.

## Calendar and preparation

The month view shows all *available* records in the selected month, including past
records still supplied by the source. Cards/List normally show upcoming records.
Navy circles count exam sittings; terracotta squares count administrative records.
Full accessible day labels state both counts; colour is not the only signal.
Selecting a date shows its course cards. **Show full month**, previous/next month,
**This month**, arrow keys, Home/End and Page Up/Down are supported. UTC date-only
arithmetic and the existing Bologna clock avoid travel/DST date shifts.

Course, booking-status, text and existing My courses filters apply to the calendar
and cards together. The displayed summary says whether dates are upcoming or for
a selected day/month. Changing a filter clears the day restriction, not the view.

Study links use the content index and actual non-sample topics, questions and
flashcards for the modules on display. **Revise now** opens that course's Topics;
**Test yourself** opens an available topic in its Practice tab. A course/module
with no practice does not advertise a quiz. Resources remain the fallback when
study content is absent or its metadata cannot load. Capacci's Fundamentals and
Forster's Statistics stay on their distinct course routes. No content or progress
is created or altered by the exam page.

## Unavailable sources

The official-feed timeout is 15 seconds. A failed feed does not look like an empty
calendar: a prominent message says the calendar is incomplete, lecturer-provided
dates are labelled, and **Retry official dates** remains available. A successful
retry removes that warning and reconciles the same date, avoiding duplicates.
Optional learning metadata never prevents the exam page from working. An official
page and Notes fallback remain available without JavaScript.

## Checks

- `node tests/planning/exams-workspace.test.js` — date validation, notice matching,
  non-mutation, component grouping, content-aware study routes and date boundaries.
- `node tests/planning/exams-workspace-browser.test.js .` — disclosures, views,
  calendar selection/keyboard access, filtering, saved-plan scope, source failure,
  truthful calendar exports and responsive light/dark rendering with fictional feeds.
- `node tests/planning/browser.test.js .` — the existing planner regression, with
  ordinary exam fixtures separated from the dedicated administrative-date tests.
- `node scripts/check-content.js`, `node scripts/check-contrast.js`, and
  `node scripts/stamp-versions.js --check` — shared integrity and cache/version checks.
