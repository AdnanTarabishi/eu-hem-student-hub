# Student Toolkit v4 — Your workbench

The sixth Toolkit section turns seven previously planned catalogue entries into working,
local tools for coursework, the two-year programme and career preparation. Browse tools,
Solve a Problem, Ready-made collections, My lists and Compare retain their existing routes.

Open `toolkit.html?section=workbench`. A public tool link adds `planner=<id>` from the table
below. Links contain the tool choice only; entries and personal assumptions are never put
in the URL.

| Stable planner ID | Working scope | Important limits |
| --- | --- | --- |
| `economics-graphs` | Interactive inverse-linear supply/demand, baseline and shifted equilibrium, surplus areas and demand point elasticity; CSV results | A hypothetical competitive market. No taxes, insurance, externalities or healthcare-policy recommendation. Non-positive trade has a separate result. |
| `sample-size` | Approximate two-sided confidence-interval precision for a mean or proportion, rounded usable observations and an optional recruitment-loss allowance; TXT export | Normal approximation, not statistical power or a research approval. No clustering, finite-population correction or repeated-measure model. Small expected binary counts are flagged. |
| `study-session-planner` | Ordered tasks, selected weekdays, daily capacity, session length and buffer; dated sessions, explicit unscheduled hours, CSV and ICS exports | Personal target date, not a fetched official exam date. The target day is excluded. Up to 40 tasks and a 365-day horizon. Calendar entries are all-day reminders, not booked study times. |
| `four-city-budget` | Up to four user-defined Bologna, Oslo, Innsbruck or Rotterdam scenarios; income, recurring costs, one-off spending, refundable deposit and cash needs | No supplied city prices or live FX. NOK scenarios use the user's dated NOK-per-EUR assumption. Deposits count as cash held, separately from spending. Blank amounts remain unknown rather than zero. |
| `moving-checklist` | Before-moving, arrival and settling tasks; chosen city, completion, optional dates and custom tasks | A personal checklist, not legal or immigration advice. City changes preserve completed work and dates. Up to 21 custom tasks alongside nine starter tasks. |
| `document-deadlines` | Up to 30 labels and dates, deadline grouping, optional 0/7/14/30/60/90-day notice and ICS export | No document scans, identity numbers or background notifications. Calendar alerts depend on the calendar application after import. Dates are entered by the user. |
| `career-tracker` | Up to 30 opportunities with stage, deadline, follow-up and next action; nine evidence-based CV, cover-letter and interview preparation checks | Organisation and role labels only: no CV upload or application submission. Progress measures checked preparation tasks, not employability. |

The catalogue retains all 70 stable IDs: **28 built-in/Hub + 36 external + 6 planned =
64 available entries**. These counts include earlier Hub resources and calculators.
The existing 12 recent-provider flags and provider review dates are unchanged. Existing
bookmarks and list references to the seven promoted IDs continue to work. The first-week,
group-project, next-city and career collections now link to relevant working planners.

## Saving, backups and privacy

Opening or editing a tool does not write its inputs to device storage. Drafts remain in
the current tab; switching tools preserves valid drafts. **Save on this device** saves
only the selected tool under `euhem-toolkit-workbench-v1`, separately from Toolkit
bookmarks, catalogue lists and course progress. Pending Add/Edit forms must be added,
updated or cancelled before saving, exporting or switching tools, so typed entries are
not silently omitted. Browser-storage failures display a warning and allow draft export.

JSON export includes the opened workbench drafts, including unsaved edits to committed
entries. It can contain financial estimates, dates and application notes: keep the file
private. Exported calculation/CSV/calendar files are also created locally. No tool sends
user entries to the Hub or to an external service.

Manual imports are bounded to 100,000 UTF-8 bytes and strictly validate the format,
version, known tool IDs, fields, types and per-tool limits. Nothing changes before the
review and **Confirm import** step. Confirmation replaces the workbench only, including
resetting omitted planners; cancellation preserves it. Invalid imports cannot partially
replace data. Loading damaged device storage separately recovers valid tool snapshots
and displays a warning. Cross-tab saved changes prompt a reload instead of overwriting
the active drafts. Reset and Clear controls require confirmation and affect only the
selected tool or the workbench, as labelled.

## Files and browser contract

- `toolkit-academic[-core].js`: economics and sample precision. Precision reuses
  `statistics-lab-tools-math.js` and its existing numerical dependency.
- `toolkit-planning[-core].js`: study sessions and calendar/CSV formatting.
- `toolkit-life[-core].js`: budgets and moving checklists.
- `toolkit-career[-core].js`: document dates and career preparation.
- `toolkit-workbench-core.js`: bounded portable backup validation.
- `toolkit-workbench.js`: tool navigation, explicit local persistence, draft capture,
  backup review and public links.
- `toolkit-workbench.css`: shared design tokens, native forms, responsive tables,
  light/dark themes and print behaviour.

Each browser registry exposes tools with `id`, `title`, `category`, `icon`, `summary`,
`cleanState(raw, strict)` and `mount(container, context)`. Mount returns `getState()`.
The context supplies a detached draft, local current-day helper, status messages and
local file downloads. Tool modules never access storage or the network themselves.
The controller owns persistence; pure cores also run under Node for numerical and
schema checks. All eleven new runtime files are in the service-worker precache.

## Validation

Run `npm run test:toolkit`, then `node scripts/check-contrast.js`. After any source
HTML/CSS/JS edits run `node scripts/stamp-versions.js` before validation or publication.

The focused Node suite covers existing catalogue/list/method-guide behaviour, known
calculation examples, dates, feasible and infeasible workloads, safe CSV/ICS output,
state limits and atomic backup validation. The real HTTP Chromium suite covers all
seven public routes, CRUD, explicit saving/reload, pending-form protection, import
review/confirmation/cancellation, public-only links, isolation from other Hub data,
blocked storage, four viewport widths in both themes and genuine service-worker
offline reload. Fixtures are fictional and external traffic is blocked.

The older `tests/toolkit-browser.py`, `tests/toolkit-organiser-browser.py` and
`tests/toolkit-solve-browser.py` remain regression checks with their documented inline
browser adapters. The new HTTP suite verifies actual navigation, storage and offline
behaviour rather than those adapter substitutions.
