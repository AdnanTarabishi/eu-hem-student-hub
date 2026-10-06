# Sources and labels ("Official" / "Student tip")

Facts taken from documents (the EU-HEM Student Handbook, the UniBo welcome letter, the Welcome Days slides,
the student representatives' slides, the ESN Bologna guide) and from official web pages carry a small label:

- **Official · EU-HEM Handbook · verified 6 Oct 2026** (blue): an official document or university page.
- **Student tip · ESN Bologna** (amber): advice from students, useful but not official.

The documents themselves are **never** put in this repository (they are not public). Write everything in
your own words and link to the official page instead.

## The registry: `content/sources.json`

Every source has one entry:

```json
{
  "id": "uio-grades",
  "title": "University of Oslo: grading and grading scales",
  "shortTitle": "UiO grading",
  "type": "official-university-page",
  "cohort": "2026-2028",
  "lastChecked": "2026-10-06",
  "link": { "label": "UiO: grading and grading scales", "url": "https://www.uio.no/english/studies/examinations/grades/" }
}
```

- `type` decides the label: `official-handbook`, `official-university-page`, `official-letter` → **Official**;
  `student-reps`, `esn-guide` → **Student tip**.
- `link` is optional: documents that are not public have none. Pages use it to show "official rules" links.
- `cohort` is optional: use it for documents written for one cohort.
- When sources disagree, `priority` says which wins (newest official web page first for prices and codes).

## Using a source

| Where | How |
|---|---|
| `content/programme.json` (key dates, notes), `content/academic-rules.json`, `content/programme-events.json`, `content/people.json` | `"source": "<id>"` on the item |
| A City Guide (`docs/content/<city>-guide.md`) | `{official:<id>}` or `{tip:<id>}` at the end of the line; guide.js turns it into the label. Web sources keep their `[S12]` tags. |

The kind in the guide marker must match the source: `{tip:esn-bologna-guide-2026}` is right,
`{official:esn-bologna-guide-2026}` is an error.

## What the checker enforces (`node scripts/check-content.js`)

- Every `source` and every guide marker names an id in `sources.json`, of the right kind.
- Every source has a title, a known type and a past `lastChecked` date; links are `https://`.
- A price in a guide has a `[S#]` tag or a `{official:…}`/`{tip:…}` marker.
- **Privacy:** only these role mailboxes may appear in the handbook content: `didatticasociale.euhem@unibo.it`,
  `euhem@eshpm.eur.nl`, `eu-hem@mci.edu`, `garante@unibo.it`, and the service mailboxes `safe@eur.nl`,
  `mentalhealth@mci.edu`, `med-studieinfo@medisin.uio.no` (list `ROLE_MAILBOXES` in the checker).
  Never staff or student names, never personal emails, never Google Docs/Sheets links.

## Adding a new cohort's handbook

1. Add a source, e.g. `euhem-handbook-2027`, with `cohort: "2027-2029"`.
2. Add the new cohort's `keyDates` in `content/programme.json` and its fee under `fees.byCohort` in
   `content/programme-events.json` (only figures from the official document).
3. Check every fact that changed; update the `source` of items you re-checked.
4. Run `node scripts/check-content.js` and `npm test`.

## Pages that use this

`academic-rules.html` (Academic Rules), `journey.html` (Programme Journey), `support.html` (Support &
Contacts), the key dates on `calendar.html` and the homepage, the crash-course note on `studyplan.html`,
and the City Guides. Tests: `tests/handbook/`.
