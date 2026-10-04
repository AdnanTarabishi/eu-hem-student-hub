# Past Thesis Explorer: importing the thesis list

The Thesis page (`thesis.html`) shows past thesis titles from a spreadsheet shared by a previous
student. It is an **informal, incomplete list**, never an official archive; the page says so.

## The three files
| File | Edit by hand? | What it holds |
|---|---|---|
| `content/thesis-archive.json` | **No, generated** | One record per thesis (id, cohort, legacy track, university, original and display title, and an empty `link` for later). Replaced on every import. It never contains classifications. |
| `content/thesis-config.json` | Yes | Legacy track names, university names and thesis repository links, **search synonyms**, the example titles, page texts. |
| `content/thesis-overrides.json` | Yes | Your corrections: a better display title, or hide a record. Starts as `{}`. |
| `content/thesis-enrichment.json` | Yes | Student Hub themes, stated methods/places and current-track relevance, by id. See [thesis-enrichment.md](thesis-enrichment.md). |

The spreadsheet itself is **not** kept in the repository (`*.xlsx` is in `.gitignore`). Keep it on
your computer; only the generated JSON is published.

## When a newer spreadsheet arrives
1. Check the columns are still: `cohort | Track | University | Thesis Title` (first row).
2. Run, with the path to the file (quotes are needed because of the spaces):
   ```
   node scripts/import-thesis.js "C:\Users\you\Downloads\Thesis Topics 2023.xlsx"
   ```
3. Read what it prints:
   - **Totals** per cohort, track and university.
   - **Errors stop the import** (nothing is written): unknown track or university code, empty title,
     duplicate row, wrong first row. Fix the spreadsheet, or add a new code to `thesis-config.json`.
   - **"For your decision"**: ALL CAPS titles, titles that were cleaned up, very short or note-like
     titles, titles that name a company, and near-duplicates. The script never changes them; decide
     yourself and use the overrides file if needed.
4. Run `node scripts/check-content.js` (checks the three files fit together), then
   `node scripts/stamp-versions.js`, then preview with `node scripts/preview.js`.
5. Commit `content/thesis-archive.json` (and the overrides/config if you changed them).

No library is needed: `scripts/read-xlsx.js` reads the .xlsx file (a ZIP of XML files) with Node's
built-in tools. The website never reads Excel files.

## How titles are handled
- `titleOriginal` is exactly the spreadsheet text.
- `titleDisplay` gets only this cleanup: trimmed; line breaks and repeated spaces become one space;
  Excel codes like `_x0002_` are removed. Typos, wording, punctuation and capitals are **never** changed.
- To show a different title, use an override (below). The original stays in the data.

## Ids (for shared links)
Each record's id (e.g. `t-77b3ec8d`) is made from its cohort, track, university and cleaned title, not
from its row number. Re-importing, or reordering the spreadsheet, keeps the same ids, so shared links
(`thesis.html?topic=t-77b3ec8d`) keep working. If a title's wording changes in a new spreadsheet, that
record gets a new id.

## Overrides (`content/thesis-overrides.json`)
Find the id in the import output (or in the page address after opening a card), then:
```json
{
  "t-0edde4d7": { "titleDisplay": "The Effectiveness and Cost-Effectiveness of a Dutch Multi-Factored Lifestyle Intervention in Managing Type 2 Diabetes compared with Standard Care.", "reason": "Excel code removed a hyphen" },
  "t-3e0309c9": { "hidden": true, "reason": "removal requested by the author" }
}
```
- `titleDisplay`: shown instead of the cleaned title.
- `hidden: true`: the record is left out of the published file completely.
- `reason`: a note for yourself (not shown).

Run the import again after editing overrides; the checker warns if you forgot.

## Search synonyms (`thesis-config.json` → `synonyms`)
Each line is a group of words or phrases that mean the same thing; searching for one finds all:
```json
"synonyms": [
  ["covid", "covid-19", "covid19", "covid 19"],
  ["ai", "artificial intelligence"],
  ["cea", "cost-effectiveness"]
]
```
Add a group, save, and reload the page (no import needed). Search rules: all words must match in any
order; words of 3 letters or fewer match whole words only; longer words match the start of a word; a
word ending in "y" also finds "-ies" (inequality → inequalities).

## Adding a track or university code
Add it to `legacyTracks` or `universities` in `thesis-config.json` (with a verified `repository`
link, or `null`), then run the import again.

After a re-import, new or changed titles need an entry in `content/thesis-enrichment.json`: the checker lists any thesis without one.
