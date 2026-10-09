# Teaching progress by selected period (9 October 2026)

A compact card at the end of the timetable, after the schedule and source note,
shows finished / published / remaining teaching hours and a percentage. Its heading,
bar and totals follow the chosen **Day, Week or Month** view and selected date:

- Day uses classes starting on the selected date.
- Week uses the complete Monday–Sunday week, including weeks spanning two months.
- Month uses classes starting in the selected month.
- List retains the current-month summary and states this scope on the card.

It uses **all filtered sessions in that period**, including finished classes hidden
by List. Course/search/My courses only filters apply and the scope is stated on the
card; changing the teacher display or Show past classes cannot change progress.
Smaller padding, a slim bar, inline desktop totals, consistently stacked phone
metrics and no repeated visible date keep the card compact. Supporting text remains at least 12px at the base font size and
the keyboard-accessible explanation uses 14px text and a 44px minimum target.

The numerator includes only sessions whose scheduled end is at or before the current
Europe/Rome clock. An ongoing class remains entirely in Remaining until its end.
Durations use the feed's published wall-clock times; a class belongs to the period of
its start, consistent with the calendar views, and overlaps contribute individual hours.
The percentage is floored to one decimal; 100% is reserved for all valid scheduled
sessions having ended. Actual attendance, credits, learning progress, private study
and exams are not inferred. The denominator contains published classes only and can
change with the source. An empty or failed source never becomes 0% or 100%; invalid
durations yield an explicit unavailable state. No new storage or network request.

Minute updates and visibility/focus refreshes recalculate the card without replacing
its controls, closing its explanation or removing keyboard focus from the timetable.

The page-scoped `timetable-progress.js` observes the existing summary's child changes
and schedule loading attribute. It never watches or rewrites the calendar DOM. Its
independent minute/visibility updates cover class endings even when Week view keeps
focused controls intact. The UI is styled in `timetable-progress.css`; arithmetic
lives in the existing `timetable-calendar.js`. `progressPeriod` provides date-only
boundaries and `periodProgress` calculates the selected scope. `monthlyProgress`
keeps its original API for existing monthly callers. Both card assets are precached.

`node tests/planning/progress.test.js` checks arithmetic, period boundaries,
cross-month weeks, exact class endings, empty/invalid states and timezone independence.
`node tests/planning/progress-browser.test.js .` checks view, filter and date changes,
My courses, loading failures, minute updates, focus/explanation stability and compact
320/390/768/1440px layouts in both themes, including resize. Browser feeds are fictional
and external requests are blocked. Set `PLANNING_SCREENSHOT_DIR` to save previews.
