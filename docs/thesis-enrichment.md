# Thesis enrichment: Student Hub classification of past thesis titles

The Thesis page will let students explore past thesis topics by **research theme**, by **potential
relevance to the current four tracks**, and by **related topics**. This document explains where that
information comes from and how to correct it.

## Source versus interpretation (kept strictly apart)
| Layer | File | What it is | Who changes it |
|---|---|---|---|
| Historical source | the thesis spreadsheet (kept outside the repository) | the list shared by a previous student | nobody |
| Imported source records | `content/thesis-archive.json` | generated from the spreadsheet: cohort, **legacy** track, university, titles | only `scripts/import-thesis.js` |
| **Student Hub interpretation** | `content/thesis-enrichment.json` | themes, stated methods, stated places, current-track relevance, confidence, review status | you, by hand |

The archive never contains classifications (the import script no longer writes `topics` or
`relevantCurrentTracks`), and the enrichment never repeats source fields: the checker enforces both.
Legacy tracks (EEH, MHI, HEP, GH, DMH, HFM) are **never** replaced by current tracks.

> Themes are assigned from thesis titles with AI assistance and reviewed by a student. They are not official EU-HEM classifications.

## The shared taxonomy (one definition)
Theme ids and labels used by the **Tracks** page live in `content/tracks.json` (newest cohort). The
thesis taxonomy **reuses** those ids, so a label is written in exactly one place, and **adds** only what
thesis discovery needs:

| Theme id | Label | Defined in |
|---|---|---|
| `evaluation` | Economic evaluation & HTA | tracks.json |
| `pharma` | Pharmaceutical markets & pricing | tracks.json |
| `policy` | Health policy (incl. law & regulation) | tracks.json |
| `leadership` | Leadership & organisation | tracks.json |
| `finance` | Finance (incl. insurance, funding) | tracks.json |
| `epidemiology` | Epidemiology & public health (incl. prevention, population health; environmental topics are under `planetary`) | tracks.json |
| `global` | Global health | tracks.json |
| `ethics` | Ethics | tracks.json |
| `digital` | Digital health & innovation | thesis-enrichment.json |
| `inequalities` | Inequalities & social determinants | thesis-enrichment.json |
| `patient` | Patient-centred care & behaviour | thesis-enrichment.json |
| `planetary` | Environmental & planetary health (sustainability, climate, carbon, pollution, One Health) | thesis-enrichment.json |

`econometrics` and `qualitative` (in tracks.json) are **methods**, not topics: for theses they are covered
by **stated methods** below. `internship` is not a topic. What each theme includes is written in
`taxonomy.scope` in the enrichment file.

## One entry per thesis
```json
{ "id": "t-77b3ec8d", "title": "Impact of mHealth Interventions …", "themes": ["digital", "leadership"],
  "statedMethods": ["case-study"], "statedCountries": [], "confidence": "high", "status": "draft" }
```
- `id`: the thesis id from the archive. `title`: a **reading aid only**; it must equal the archive title.
- `themes`: 1–3 theme ids, from what the **title** supports, never from the legacy track. **Precision over coverage**: when in doubt, fewer themes. `pharma` is only used when the title involves pricing, reimbursement, market access, patents, pharmaceutical regulation or similar market/policy issues; a drug being the intervention is not enough. A title too
  vague for any theme gets `"themes": []` and `"unclassified": true`.
- `statedMethods`: **only** when the title names the method (list in `methods`). Never inferred.
- `statedCountries`: countries or regions **named** in the title (adjectives become the place:
  "Dutch" → Netherlands). Empty when the title names none.
- `confidence`: `high`, `medium` or `uncertain` (for review; not shown prominently).
- `status`: `draft` until a student has checked it, then `reviewed`. While any shown entry is a draft,
  the page says "Draft classification — under review".
- `note`: optional, why a classification is uncertain.
- `trackOverride`: optional, see below.

## Current-track relevance (derived, not judged per thesis)
Relevance is **calculated** from the themes, through one small table: for each theme, a weight (0–1)
per current track (`relevance.weights`).
- **Derived** weights come from the course lists in `tracks.json`: for each track,
  2 × required + 1 × elective courses carrying the theme, divided by the highest track.
- **Proposal** weights (⚑) are set by hand for themes no course carries (`digital`, `inequalities`,
  `patient`, `planetary`), with a `note` saying why.
- **Secondary** themes (`"secondary": true`: `digital`, `inequalities`, `patient`) are supporting
  evidence only: they add to a score but can never justify a track on their own. A track is only possible
  when a non-secondary theme of the thesis gives it at least `primarySupport` (0.3).
- A thesis's score per track = the average weight of its themes. A track is shown if it scores at least
  `threshold`; a second one only if it reaches `secondRatio` × the top score; at most `maxTracks` (2);
  none if more than 2 tracks tie for the top.
- It is fine for a thesis to show **no** current track: the archive should never imply more certainty than
  the title supports. Use `"trackOverride": { "tracks": [], "reason": "…" }` to suppress a weak mapping.
- The page explains each result in one line (always naming the course-backed theme), e.g. "Related to Economic Evaluation in Healthcare because
  that track has required courses in economic evaluation & HTA."
- Always presented as a Student Hub interpretation: "potentially relevant to", never "belongs to".

## How to …
**Change a thesis's themes, method or places**: edit its line in `content/thesis-enrichment.json`, set
`"status": "reviewed"` if you checked it, then run `node scripts/check-content.js`.

**Change the relevance of one thesis**: prefer fixing its themes. If the themes are right but the result
is still wrong, add an override with a reason:
```json
"trackOverride": { "tracks": ["mhi"], "reason": "about hospital procurement rather than evaluation" }
```
(`"tracks": []` shows no track.)

**Change relevance for a whole theme**: edit its row in `relevance.weights`. Derived rows are recalculated
from tracks.json; to refresh them after the curriculum changes, run `node scripts/thesis-weights.js --write`.
To see the table with the course counts behind it: `node scripts/thesis-weights.js`.

**Add a theme**:
1. If tracks.json already has it, add its id to `taxonomy.reused`; otherwise add
   `{ "id", "label", "description" }` to `taxonomy.added`.
2. Add a scope line and synonyms.
3. Add a weights row (derived if courses carry it, otherwise a proposal with a note).
4. Tag the theses, then run the checker.

**Review**: run `node scripts/thesis-review.js` to regenerate `docs/thesis-review.md` (least confident
first, disagreements with the independent second pass, the weights table and counts). Review all
`uncertain` entries and a sample of the rest; mark them `"status": "reviewed"`.

**Validate**: `node scripts/check-content.js` checks:
- every entry points to a visible thesis; no duplicates; hidden records are ignored
- every visible thesis has a theme or `unclassified`
- themes, methods, confidence and status come from the allowed lists
- reused themes exist in tracks.json
- the weights cover every theme × every current track, and derived rows still match tracks.json
- overrides name at most 2 real tracks and give a reason
- no source fields appear in the enrichment, and each `title` equals the archive title

## Limitations of title-only classification
Titles are short and sometimes vague, abbreviated or note-like. A title can mention a method or place the
thesis barely used, or omit what it was mostly about. Themes and relevance are therefore **orientation
aids**, not facts about the thesis. Nothing beyond the title is invented: no abstract, method,
population, data source, findings or supervisor.

## How the first classification was made
- **Pass 1:** all 120 titles were classified with AI assistance, by Claude in the Student Hub
  development session.
- **Pass 2:** independent, by a separate Claude agent that saw only the titles and the written rules.
  It is stored in `docs/thesis-review-pass2.json`.
- **Comparison:** every disagreement between the two passes is listed in `docs/thesis-review.md`, and
  each was reviewed case by case, with the reason in the entry's `note`.
- **Status:** all entries start as `draft` until a student reviews them.
