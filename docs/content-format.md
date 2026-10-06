# Content format: courses, study plan, Notes & Resources

This document describes how course data and study content are stored. Adding or changing
content never requires code changes: you only add or edit the files described here.

- **Course facts and study plan rules** live in ONE file: `content/programme.json`. Every
  section of the site reads it (study plan, timetable, exams, calendar, Notes & Resources).
- **Student content** lives per module in `content/modules/<module-id>/`.
- Structure: **Course → Module → Topic → Resource type** (notes, flashcards, questions,
  resources), plus **one shared glossary** of key concepts for all courses.

## Folder layout

```
content/
  programme.json             ← THE shared course data: cohorts, terms, study plan rules, courses, modules
  settings.json              ← form links and disclaimer text
  concepts.json              ← the shared glossary (all courses)
  modules/
    <module-id>/             ← one folder per module (all files optional)
      topics.json            ← ordered list of topics
      notes/<name>.md        ← notes for one topic (Markdown + front matter)
      images/                ← pictures used in the notes
      flashcards.json · questions.json · resources.json
```

Every file in a module folder is optional. A missing file means "no items yet", and the
matching tab on the course page is hidden. A module without a folder simply has no
student content yet.

## Before you commit: run the checker

```
node scripts/check-content.js      ← checks programme.json and all content
node scripts/check-programme.js    ← compares programme.json with the live UniBo timetable
```

The checker reads every file the same way the website does, and lists problems in plain
English: broken JSON (a missing comma or quote), duplicate IDs or codes, a course in no study
plan group, CFU that don't add up, module dates outside their cycle, links to topics that
don't exist, missing notes files, wrong answer formats, and a "5-minute review" outside 5–10
points. **Errors** must be fixed; **warnings** are worth a look.

To see your changes before publishing: `node scripts/preview.js`, then open
http://localhost:8000.

## IDs: the most important rule

Every item has an `id`. Links, search results and bookmarks ("My Study List") use the ID,
so **once an item is published, never change its ID**. You can rename titles, edit text and
reorder items freely; just keep the ID.

| Item | ID pattern | Example |
|---|---|---|
| Course | `<course>` | `fund-health-econ-management` |
| Module | `<module>` | `fund-health-economics` |
| Topic | `<module>.<short-name>` | `fund-health-economics.demand` |
| Flashcard | `<module>.fc.<number>` | `fund-health-economics.fc.007` |
| Question | `<module>.q.<number>` | `fund-health-economics.q.007` |
| Resource | `<module>.r.<number>` | `fund-health-economics.r.004` |
| Concept | `concept.<short-name>` | `concept.moral-hazard` |

- Use lowercase letters, numbers and dashes only.
- For new flashcards/questions/resources, use the next free number. Don't reuse the number of a deleted item.
- The part before the first dot tells which **module** an item belongs to; `programme.json` says which course that module is in.
- A course with a single module uses the same ID for the course and its module (e.g. `right-to-health`).

## Writing JSON safely

JSON is a strict text format for data. The usual mistakes:
- Text must be in **double quotes**: `"title": "Moral hazard"`.
- Items in a list are separated by **commas**, but there's **no comma after the last one**.
- `true`, `false` and `null` are written **without quotes**.
- A `"` inside a text must be written as `\"`. An apostrophe (`'`) is fine as it is.

The checker tells you the file, line and column of any JSON mistake.

---

## programme.json (the shared course data)

Official facts, summarised **in our own words**. Link to official materials; never copy them.
Nesting: **cohort → term → study plan rules + courses → modules**. To add Semester 2, add a
term; for Year 2 or the next cohort, add a term or a cohort. No code changes.

```json
{
  "schemaVersion": 1,
  "programme": { "code": "6759", "name": "Health Economics and Management",
                 "virtualeUrl": "https://virtuale.unibo.it", "studentsOnlineUrl": "https://studenti.unibo.it" },
  "cohorts": [{
    "id": "2026-27", "label": "2026/27", "lastChecked": "2026-10-03",
    "sources": { "structureDiagram": "https://…", "timetableFeed": "https://…", "examDates": "https://…" },
    "studyPlanSubmission": { "url": "https://studenti.unibo.it", "deadline": null },
    "terms": [{
      "id": "y1-s1", "year": 1, "semester": 1, "label": "Semester 1", "requiredCfu": 30,
      "cycles": [
        { "id": "1", "label": "Cycle 1", "start": "2026-09-07", "end": "2026-10-24" },
        { "id": "2", "label": "Cycle 2", "start": "2026-11-09", "end": "2026-12-16" }
      ],
      "groups": [
        { "id": "crash", "label": "Crash courses", "badge": "Optional", "kind": "optional",
          "min": 0, "max": 2, "countsTowardRequired": false, "courses": ["B1076", "97484"] },
        { "id": "core", "label": "Core courses", "badge": "Required", "kind": "required", "courses": ["97177", "96500"] },
        { "id": "quant", "label": "Quantitative methods", "badge": "Required · choose one", "kind": "choose-one",
          "courses": ["96496", "96525"], "advice": null }
      ],
      "courses": [{
        "code": "97177", "id": "fund-health-econ-management",
        "name": "Fundamental in Health Economics and Management", "integrated": true,
        "cfu": 10, "type": "B", "icon": "🩺", "color": "#2e7d32", "officialUrl": "https://…",
        "modules": [{
          "code": "79060", "id": "fund-health-economics", "name": "Fundamentals in Health Economics",
          "cfu": 5, "cycle": "1", "ssd": "ECON-01/A", "professors": ["Daniele Fabbri"],
          "teachingStart": "2026-09-16", "teachingEnd": "2026-10-22",
          "officialUrl": "https://…/course-unit/2026/518742", "virtualeUrl": "https://virtuale.unibo.it",
          "description": "…", "assessment": "…", "textbooks": ["…"]
        }]
      }]
    }]
  }]
}
```

**Study plan rules** (`groups`): `kind` is `required` (all courses, locked), `choose-one`
(radio buttons) or `optional` (checkboxes with `min`/`max`). `countsTowardRequired: false`
makes CFU "extra" (crash courses). `advice: null` shows a "to be written by students"
placeholder; put the students' text there when it exists. `deadline: null` shows a
placeholder; replace it with a date like `"2026-11-20"` when the official deadline is known.

**Courses:** every course is in exactly one group; its `cfu` equals its modules' total; a
course with one module lists itself as that module. `officialUrl` can be `null` if UniBo
hasn't published a page yet. `icon` (one emoji) and `color` (`#RRGGBB`) are optional.

**Modules:** `cycle` must be one of the term's cycles, and the teaching dates must fall
inside it. Run `node scripts/check-programme.js` from time to time: it compares professors and
teaching dates with the live UniBo timetable.

## topics.json

An ordered list. **Order in the file = order on the page.** To reorder, move lines up or
down; to rename, change `title`; to remove, delete the line (and check nothing else links to it).

```json
[
  {"id": "fund-health-economics.demand", "title": "Demand for health care", "notes": "notes/demand.md"},
  {"id": "fund-health-economics.market-failures", "title": "Market failures in health care"}
]
```
`notes` is optional: the path of the topic's notes file, relative to the module folder.

## Interactive lecture pages

Use `lecture.html?topic=<topic-id>` for a reusable Learn / Explore / Practice page.
In `topics.json`, add the optional `lecture` field alongside the regular notes:

```json
{
  "id": "statistics.sampling",
  "title": "Class 5: Sampling, sampling error and confidence intervals",
  "notes": "notes/sampling.md",
  "lecture": "lectures/sampling.json"
}
```

The referenced JSON lives in that module's `lectures/` folder:

```json
{
  "schemaVersion": 1,
  "topic": "statistics.sampling",
  "classNumber": 5,
  "date": "2026-10-01",
  "updated": "2026-10-06",
  "heroTitle": "Small samples.\nBig questions.",
  "intro": "An original introduction to the lecture's ideas.",
  "guide": "lectures/sampling.html",
  "activities": ["sampling", "tiny-population", "confidence-interval"],
  "attribution": "Identify the lecture and clearly label supplementary explanations."
}
```

- `guide` is a reviewed HTML fragment containing **original study explanations**, not copied
  slides. Use semantic headings, paragraphs, tables, and buttons with the classes in
  `lecture.css`; the sampling guide is a working example. Content is trusted repository
  HTML, so never place unreviewed visitor submissions, scripts, or event handlers in it.
- Guide and configuration filenames must use lowercase letters, numbers and hyphens
  directly inside `lectures/`. Absolute URLs and `../` paths are rejected.
- `activities` can be `[]`. Supported activities currently use the sampling lecture's
  fixed examples: `sampling` (uniform weights from 5–50 kg), `tiny-population`
  (65, 89, 75, 64, 86 kg), and `confidence-interval` (known-σ z calculator).
  New types of experiment require a corresponding renderer in `lecture.js`.
- Put the lecture's MCQs in the module's existing `questions.json`, with the same `topic`
  ID. The lecture filters those questions; they also appear in the course question bank.
  Optional `category`, `source`, and `supplementary: true` fields give the lecture quiz
  short labels, attribution, and a supplementary-material notice. State necessary
  assumptions in the question itself so it also makes sense in the course question bank.
- Provide regular Markdown notes with a 5-minute review for search, topic progress,
  and the standard reader. The full interactive guide remains a separate HTML fragment.
- Courses with a lecture gain a **Lectures** tab. Search results and saved topics open
  the interactive page; the standard reader keeps a link to it.
- Lecture answers are stored inside `euhem-progress-v1.lectures`, so Notes progress
  backups, restoration, and reset include them. Checked answers stay locked until that
  lecture is reset. A changed question, option order, or answer key resets only that
  lecture's saved quiz state. Explanations can be updated without clearing answers.
- Offline use requires one connected visit to that lecture first. The service worker
  stores its guide, configuration, and module data. There are no external dependencies
  on the lecture page itself.

After adding content, run `node scripts/build-content-index.js`, then
`node scripts/stamp-versions.js` and `node scripts/check-content.js`.

## Notes: notes/<name>.md

A Markdown file. It starts with **front matter** (a small header between `---` lines),
then a `## 5-minute review` section with **5 to 10 bullet points**, then the full notes.

```markdown
---
topic: fund-health-economics.demand
author: Anonymous
updated: 2026-10-03
---
## 5-minute review
- Health care is wanted mainly because it produces health (derived demand).
- ... (5 to 10 points, one idea per line)

## Notes
Full notes in Markdown: ### headings, **bold**, lists, tables, > quotes, [links](https://...).
```
- `topic` must match the topic's ID. `updated` is a date `YYYY-MM-DD`. `author` is optional ("Anonymous" if missing).
- Every notes page automatically shows the disclaimer, the date, the author and a "Report an error" link.

## flashcards.json

```json
[
  {
    "id": "fund-health-economics.fc.001",
    "topic": "fund-health-economics.demand",
    "front": "Why is the demand for health care called a 'derived demand'?",
    "back": "Because what people really want is health. Health care is a means to produce it."
  }
]
```

## questions.json

Student-written practice questions. **Never copy real exam questions.**

| `type` | `answer` | Extra field |
|---|---|---|
| `mcq` | the letter of the right option: `"B"` | `options`: a list of 2+ answers (A, B, C… in order) |
| `true-false` | `true` or `false` (no quotes) | — |
| `short-answer` | a model answer (text) | — |

`difficulty` is `easy`, `medium` or `hard`. `explanation` is shown by the "Explain answer" button.

```json
[
  {
    "id": "fund-health-economics.q.001",
    "topic": "fund-health-economics.demand",
    "type": "mcq",
    "difficulty": "easy",
    "question": "The price elasticity of demand for doctor visits is -0.2. If the price rises by 10%, visits will:",
    "options": ["Fall by about 20%", "Fall by about 2%", "Rise by about 2%", "Not change at all"],
    "answer": "B",
    "explanation": "-0.2 × 10% = -2%: visits fall by about 2%."
  }
]
```

## resources.json

```json
[
  {
    "id": "fund-health-economics.r.001",
    "title": "RAND Health Insurance Experiment",
    "type": "Website",
    "url": "https://www.rand.org/health-care/projects/hie.html",
    "contributor": "Anonymous",
    "date": "2026-10-03",
    "topic": "fund-health-economics.moral-hazard",
    "description": "Overview of the experiment on cost-sharing and use of care."
  }
]
```
- `type` is one of: `Notes`, `Summary`, `Book`, `Website`, `Video`, `Exercise`, `Cheat sheet`.
- Optional: `url` (must start with `https://`), `contributor`, `topic`, `description`.
- Link to official materials on Virtuale; never upload them here.

## concepts.json (shared glossary)

One glossary for all courses. `topics` lists the topic IDs where the concept appears
(from any course); the concept then shows on those courses' Key Concepts tab.

```json
[
  {
    "id": "concept.moral-hazard",
    "term": "Moral hazard",
    "explanation": "When being insured changes behaviour: people use more care because insurance lowers the price they face.",
    "topics": ["fund-health-economics.moral-hazard"]
  }
]
```

## Maths formulas

Formulas work in notes, flashcards, questions, explanations and concepts. They are typeset
with KaTeX (the same formula language as LaTeX).

| Where | Write | Shows |
|---|---|---|
| Inside a sentence | `$\varepsilon = \frac{\%\Delta Q}{\%\Delta P}$` | ε = %ΔQ / %ΔP as a proper fraction |
| On its own line | `$$ E = mc^2 $$` | a centred formula |

Two catches:
- **In JSON files, every backslash must be doubled:** write `"$\\frac{a}{b}$"` in
  `flashcards.json`, but `$\frac{a}{b}$` in a Markdown notes file.
- **`$` starts a formula,** so write money as "€" or "USD".

A typo in a formula shows it in red instead of breaking the page.

## Images and diagrams (in notes)

1. Save the image in the module's `images/` folder, e.g.
   `content/modules/fund-health-economics/images/demand-curve.svg`.
2. In the notes, write `![Short description of the image](images/demand-curve.svg)`.

- The description is required: it is shown as the caption and read aloud by screen readers.
- Students can click an image to enlarge it.
- Prefer SVG (sharp at any size) or PNG/JPG under 500 KB. Only use images you drew yourself or
  are allowed to share. Never copy slides from Virtuale.

## The "Create an item" helper

`create.html` (button "✎ Create an item" on the Notes pages) is a form for flashcards,
questions, concepts and resources. It shows a live preview, fills in the next free ID, checks
the item with the same rules as the checker, and gives you JSON to paste into the right file.
It doesn't send or save anything.

## Study progress (not content)

Topic status (Read / Understood), the flashcard review schedule, quiz scores and the study
streak are saved only in each student's browser (`euhem-progress-v1`), never in this
repository. Students can download a backup and restore it on another device from the
"My progress" tab.

## Sample content

Any item can have `"sample": true` (in front matter: `sample: true`). It shows a grey
"Sample" tag, and the course page shows a "Sample content" banner. Remove it, or delete the
sample items, when real content replaces them.
