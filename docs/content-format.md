# Content format: Notes & Resources

This document describes how study content is stored. Adding or changing content never
requires code changes: you only add or edit the files described here.

Structure: **Course → Topic → Resource type** (notes, flashcards, questions, resources),
plus **one shared glossary** of key concepts for all courses.

## Folder layout

```
content/
  settings.json              ← form links and disclaimer text
  courses.json               ← which courses exist, in display order
  concepts.json              ← the shared glossary (all courses)
  courses/
    <course-id>/
      course.json            ← overview: description, professors, books, assessment, links
      topics.json            ← ordered list of topics
      notes/<name>.md        ← notes for one topic (Markdown + front matter)
      flashcards.json        ← optional
      questions.json         ← optional
      resources.json         ← optional
```

Every file except `course.json` is optional. A missing file means "no items yet", and the
matching tab on the course page is hidden.

## Before you commit: run the checker

```
node scripts/check-content.js
```

It reads every file the same way the website does, and lists problems in plain English:
broken JSON (a missing comma or quote), duplicate IDs, links to topics that don't exist,
missing notes files, wrong answer formats, and a "5-minute review" outside 5–10 points.
**Errors** must be fixed; **warnings** are worth a look.

To see your changes before publishing: `node scripts/preview.js`, then open
http://localhost:8000/notes.html.

## IDs: the most important rule

Every item has an `id`. Links, search results and bookmarks ("My Study List") use the ID,
so **once an item is published, never change its ID**. You can rename titles, edit text and
reorder items freely; just keep the ID.

| Item | ID pattern | Example |
|---|---|---|
| Course | `<course>` | `fund-health-economics` |
| Topic | `<course>.<short-name>` | `fund-health-economics.demand` |
| Flashcard | `<course>.fc.<number>` | `fund-health-economics.fc.007` |
| Question | `<course>.q.<number>` | `fund-health-economics.q.007` |
| Resource | `<course>.r.<number>` | `fund-health-economics.r.004` |
| Concept | `concept.<short-name>` | `concept.moral-hazard` |

- Use lowercase letters, numbers and dashes only.
- For new flashcards/questions/resources, use the next free number. Don't reuse the number of a deleted item.
- The part before the first dot tells which course an item belongs to.

## Writing JSON safely

JSON is a strict text format for data. The usual mistakes:
- Text must be in **double quotes**: `"title": "Moral hazard"`.
- Items in a list are separated by **commas**, but there's **no comma after the last one**.
- `true` and `false` are written **without quotes**.
- A `"` inside a text must be written as `\"`. An apostrophe (`'`) is fine as it is.

The checker tells you the file, line and column of any JSON mistake.

---

## settings.json

```json
{
  "contributeFormUrl": "https://forms.gle/...",
  "reportErrorFormUrl": "https://forms.gle/...",
  "disclaimer": "Student-made, may contain errors. Always check the official materials."
}
```
An empty form link shows the button as "(form coming soon)".

## courses.json

The course IDs, in the order they appear on the landing page. Each needs a folder
`content/courses/<id>/` with a `course.json`.

```json
["intro-economics", "fund-statistics", "fund-health-economics"]
```

## course.json (Overview tab)

Official facts, summarised **in our own words**. Link to official materials; never copy them.

```json
{
  "id": "fund-health-economics",
  "code": "79060",
  "title": "Fundamentals in Health Economics",
  "academicYear": "2026/27",
  "credits": 5,
  "teachingPeriod": "16 Sep – 22 Oct 2026",
  "professors": ["Daniele Fabbri"],
  "description": "How economists analyse health and health care ...",
  "assessment": "Closed-book written exam, 90 minutes. Grades on the 18–30 scale.",
  "textbooks": ["Bhattacharya, J., Hyde, T. & Tu, P. (2014). Health Economics. Palgrave Macmillan."],
  "officialUrl": "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2026/518742",
  "virtualeUrl": "https://virtuale.unibo.it"
}
```
Required: `id` (same as the folder name), `code`, `title`, `description`.

## topics.json

An ordered list. **Order in the file = order on the page.** To reorder, move lines up or
down; to rename, change `title`; to remove, delete the line (and check nothing else links to it).

```json
[
  {"id": "fund-health-economics.demand", "title": "Demand for health care", "notes": "notes/demand.md"},
  {"id": "fund-health-economics.market-failures", "title": "Market failures in health care"}
]
```
`notes` is optional: the path of the topic's notes file, relative to the course folder.

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

## Sample content

Any item can have `"sample": true` (in front matter: `sample: true`). It shows a grey
"Sample" tag, and the course page shows a "Sample content" banner. Remove it, or delete the
sample items, when real content replaces them.
