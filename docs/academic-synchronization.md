# Academic synchronization

## Source failure and repair, 21 October 2026

The scheduled job was running hourly, but an unbounded UniBo timetable request
returned HTTP 503. It stopped before fetching exam dates. The last published ICS
copy had changed on 6 October, so successful page loads did not establish that
academic records were current.

A read-only source check on 21 October compared the failing unbounded URL with
four bounded official requests. The old URL returned 503; September, October,
November and December requests returned 27, 35, 36 and 20 classes respectively.
All 118 records were retained. Both official exam pages were retrieved: 71
published rows reconciled into 55 distinct sittings across the programme,
including 21 matched first-year sittings. These are source snapshot counts,
not permanent totals or a promise that future publications will be unchanged.

The source check is recorded in GitHub Actions run 39541250840. Source HTML and
raw diagnostic captures stay in ignored `work/`; only normalized public records
are published.

## Requests and provenance

`unibo-data.js` is shared by browser pages and the calendar generator. The
timetable URL in `content/programme.json` supplies an explicit semester coverage
range. The reader divides it into contiguous inclusive windows of at most 31
days and preserves `anno` and `calendar_view`. Change the configured coverage
when a cohort or teaching period changes. A failed window rejects the whole
refresh; a partial semester is never described as complete.

Exam reading follows same-origin, same-path next-page links, with a twenty-page
limit and loop detection. Every page must be recognizable; later-page failures
cannot silently remove courses. Reconciliation remains conservative: different
components, dates, times and conflicting published details remain distinct.

Both sources use bounded requests, transient-error retries and `cache: no-store`.
Service-worker copies retain their `x-saved-at` provenance. The public reader's
array metadata contains `cachedAt`, `verifiedAt` and `sourceType`; matching or
filtering code must preserve that metadata separately. `navigator.onLine` is not
evidence of successful source verification.

## Independent published copies

The hourly generator writes `calendar/timetable.json` and `calendar/exams.json`
with schema version, cohort, canonical source, requested source URLs, actual
verification time and normalized records. These contain public university
timetable and assessment information, never student choices or private notes.

`calendar/sync-status.json` separates the latest attempt from each source's last
successful verification. If one source fails, its previous verified snapshot
remains unchanged while the healthy source can still update. A historical ICS
recovery is explicitly `calendar-copy` with `verifiedAt: null`; the old fixed ICS
DTSTAMP is never treated as a verification date.

On source failure browser pages can read a validated same-origin snapshot with
the exact configured source. They show its saved-copy status and original date,
or say that verification time is unknown. Downloading a copy cannot advance
freshness. The timetable's browser fallback retains up to 90 days of public data
through prolonged outages; it remains visibly stale and cohort-specific.

## Subscriptions and publication

The existing full and plan-specific subscription addresses remain the same.
Unchanged events keep their revisions; changed records advance SEQUENCE and
DTSTAMP. During a partial outage the failed source's existing event blocks are
retained. An incomplete new subscription is not created without either verified
records or a historical copy. Administrative Pass/Fail recording sessions use
the shared assessment notice, retain official booking details and have no
invented exam duration.

`update-calendar.yml` runs hourly and immediately after relevant source-code
changes on main. Healthy outputs and source status are saved even if the other
source failed; the job then reports failure honestly. Publication HTTP errors
are checked. A branch run never pushes to main. Calendar-only bot commits do
not retrigger the generator. Provider refresh schedules still determine when an
external subscribed calendar receives an update; a one-time import does not sync.

## Course review boundaries

The 21 October review compared all eleven module teachers and teaching bounds
with the complete official feed, plus available public catalogue names, credits
and assessment descriptions. Introduction to Economics ends on 22 September.
An unpublished syllabus remains unpublished; private Virtuale materials are not
re-uploaded or treated as reviewed. Structural and numerical practice checks do
not claim a new substantive review of every authored question.

Pending Hub guides are labelled as pending guides rather than future university
classes. Health Economics guide availability and mock counts are derived from
the current learning path and question pools, including saved-attempt scopes.

## Verification

Run content and fingerprint checks, timetable-sync, source-sync, exam-sync,
academic-copy and existing planning/notes/course/practice regressions. The
academic-sync-checks workflow also fetches both official sources using production
readers, compares programme metadata, and checks the published source snapshots
and browser labels after deployment. Tests use fictional data and do not submit
forms, register for exams or change student preferences.
