# Tracks data format (`content/tracks.json`)

The Tracks page (`tracks.html`) is generated entirely from **one file**: `content/tracks.json`.
To change a course name, a rule, a FAQ answer or a quiz question, edit that file. No code changes needed.
Run `node scripts/check-content.js` afterwards: it checks the file and refuses mistakes such as a course
that doesn't exist or a quiz answer for a track that doesn't exist.

## Where the facts come from
- **Official facts** (courses, credits, elective rules, cities, thesis, sectors): the official
  *EU-HEM tracks overview 2026* sent to students. The PDF itself is **never** added to the repository
  or linked.
- **Course names of Oslo courses**: spelled exactly as the University of Oslo lists them, with their
  course code (e.g. `HFIN4210 Finance and Investment`).
- **UniBo course codes and credits**: supplemented from the official 2026/27 course structure, verified on 7 October 2026. `creditsSource` records this provenance; these values describe the published curriculum and do not confirm future teaching dates or availability.
- **Student texts** (everything inside `"student"`, the `"texts"`, the FAQ wording and the quiz):
  written by students, not official. The page says so.
- **Never invent** a course, credit, rule or career claim. If the source doesn't say: use `null`,
  and the page shows "Not stated in the source".

## Structure
```
{
  "note": "…",
  "cohorts": [ { one cohort, e.g. "2026-2028" }, … ]
}
```
The page shows the **newest cohort** (the last one in the list). To add next year's cohort, copy the whole
cohort block, change its `"id"` (e.g. `"2027-2029"`) and edit what changed. The old cohort stays as an archive.

### One cohort
| Field | What it is |
|---|---|
| `id`, `label` | `"2026-2028"`, `"Cohort 2026-2028"` |
| `lastReviewed` | Shown under Sources, e.g. `"October 2026"` |
| `choiceFinal` | `true`: the page says the choice is final |
| `universities` | The four universities by short id (`unibo`, `uio`, `eur`, `mci`): `name`, `city`, `country`, `guide` (City Guide link), `programmePage` (`label` + `url`) |
| `semester1`, `semester4` | The common first semester and the thesis semester, as short texts |
| `sectorsAllTracks` | Sectors where graduates of all tracks work (official list) |
| `sectorGroups` | Groups used to show how career sectors **overlap** across tracks (each track sector points to a group) |
| `themes` | The rows of the comparison table: `id` + `label` |
| `courses` | **The course catalogue**: every course once (see below) |
| `tracks` | The four tracks (see below) |
| `texts` | Page texts: hero, labels, notes, quiz messages |
| `faq` | Questions and answers |
| `quiz` | The "Which track fits you?" questions and points |
| `sources` | The official document (as text) and the public pages (with links) |

### A course (in `courses`)
Each course is written **once** and the tracks refer to it by its id. That way a course is always spelled
the same, and the page can tell which courses two tracks share.
```json
"uio-hfin4210": {
  "name": "Finance and Investment",
  "code": "HFIN4210",
  "university": "uio",
  "credits": 10,
  "themes": ["finance"]
}
```
- `id` (the key): `<university>-<short-name>`, lower case with dashes.
- `code`: optional (only when the university publishes one). Not shown on the page.
- `credits`: a number = shown as "10 EC"; `null` = "Credits not stated in the source";
  leave it out = nothing shown (used for required courses whose credits the source doesn't give).
- `creditsSource`: optional, where the credits come from when the official overview states them for this
  course in another track's list only (the course is the same, so the credits are shown in every track).
- `themes`: which comparison rows the course counts for (can be `[]`). **The comparison table is built
  from these tags**, so tagging a course changes the table.

### A track (in `tracks`)
```json
{
  "id": "eeh", "letter": "A", "abbr": "EEH", "name": "Economic Evaluation in Healthcare",
  "accent": "#a64b2a",
  "focusAreas": ["Health Technology Assessment", "…"],
  "semesters": [
    { "number": 2, "university": "eur",
      "required": ["eur-hta", "…"],
      "choices": [
        { "kind": "elective", "rule": "Choose one", "options": [["eur-global-health-econ"], ["…"]] }
      ] },
    { "number": 3, "university": "uio", "required": ["…"], "choices": ["…"] }
  ],
  "thesis": ["eur", "uio"],
  "sectors": [ { "label": "Consultancy", "group": "consultancy" } ],
  "alsoMentioned": [],
  "programmePages": [ { "label": "…", "url": "https://…" } ],
  "student": { "question": "…", "description": "…", "tags": ["…"], "centralQuestion": "…",
               "overview": "…", "typicalProblem": "…", "fit": ["…"], "secondYearQuotes": [] }
}
```
- **`accent`**: a colour used only for small accents (borders, dots). The track name or abbreviation is
  always shown too, never colour alone.
- **`semesters`**: Semester 2 and Semester 3, each at one university. Every course in a semester must
  belong to that semester's university (the checker tests this).
- **`choices`**: each choice has:
  - **`kind`**: `"elective"` or `"complementary"` (the words the official overview uses).
  - **`rule`**: the exact rule text shown to students: `"Choose one"`, `"Choose 10 EC"`, `"Choose two"`,
    `"Choose one pair"`. Use `null` when the source doesn't state it; the page then shows "Not stated in
    the source".
  - **`options`**: a list of options. **Each option is a list of courses**: one course `["id"]`, or a pair
    taken together `["id1", "id2"]`.
  - **`notes`** (optional): a short note per course, e.g. `{ "unibo-health-systems": "If not taken in Semester 1" }`.
- **`choicesNote`** (optional): one sentence under the choices (e.g. PHM: "Two electives in total: one
  from each pair").
- **`thesis`**: the two universities where the thesis can be written (they must be the track's two
  universities).
- **`sectors`**: the official "most common sectors", exactly as worded; `group` links each one to a
  `sectorGroups` id for the overlap view.
- **`alsoMentioned`**: sectors the overview mentions as relevant but not among the most common.
- **`student.secondYearQuotes`**: quotes from second-year students, added later. While the list is empty,
  the "From second-year students" box is hidden. Format: `{ "text": "…", "by": "Second-year student, EEH" }`.
  Only add real quotes with the person's permission.

### FAQ
```json
{ "q": "Can I change tracks later?", "a": "No. The submitted choice is final." }
```
Add `"audience": "future"` for questions mainly meant for future students; the page labels them.

### Quiz
```json
{ "text": "Which question interests you most?",
  "answers": [ { "text": "Is this new treatment worth its cost?", "points": { "eeh": 3 } }, … ] }
```
- `points`: which track(s) the answer counts for, and how much. An answer can give points to several
  tracks (e.g. `{ "mhi": 2, "phm": 1, "ep": 1 }`).
- `maxScore`: the highest total any track can reach (the checker recalculates and compares it).
- `closeMatchPoints`: if the top two tracks are this close, the result says it's a close match.
- The answers are shuffled on screen, so their order in the file doesn't matter.

## Checks (`node scripts/check-content.js`)
- Every course id, university, theme and sector group referenced exists.
- Every track has Semester 2 and Semester 3, and its courses belong to the right university.
- Thesis universities are the track's own universities.
- Required student texts are filled in; links start with `https://`.
- Quiz answers only name real tracks, and `maxScore` is correct.
- **Sanity checks for 2026-2028** (facts that must never change by accident):
  - Health Technology Assessment is required in EEH and PHM.
  - Economic Evaluation is required in MHI.
  - In E&P, economic evaluation is elective only.
