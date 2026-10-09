# Monthly teaching progress (9 October 2026)

A separate card below the view totals shows finished / published / remaining teaching
hours and a percentage for the selected date's month (the current month in List).
It uses **all filtered sessions for that month**, including finished classes hidden
by List; changing the teacher display or Show past classes cannot change progress.
Course/search/My courses only filters do apply and the scope is stated on the card.

The numerator includes only sessions whose scheduled end is at or before the current
Europe/Rome clock. An ongoing class remains entirely in Remaining until its end.
Durations use the feed's published wall-clock times; a class belongs to the month of
its start, consistent with Month view, and overlaps contribute their individual hours.
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
lives in the existing `timetable-calendar.js`. Both new assets are precached.
