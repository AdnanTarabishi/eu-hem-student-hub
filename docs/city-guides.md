# City guides: how to update them

Each city guide is one text file in `docs/content/`, written in Markdown (plain text with `#` for
headings and `-` for bullet points). You never need to touch the code to change a guide.

| City | File | Status |
|---|---|---|
| Bologna | `docs/content/bologna-guide.md` | older format, to be converted to the 16 sections |
| Oslo | `docs/content/oslo-guide.md` | full format, checked 5 October 2026 |
| Rotterdam | — | coming soon |
| Innsbruck | — | coming soon |

The page `city-guide.html` shows the index of all cities; `city-guide.html?city=oslo` shows one city.

## How a guide file is built

**1. The facts block at the top**, between two `---` lines. Each line is `name: value`.
The "At a glance" box and the comparison table of all cities are built from it, so each fact is
written only here.

| Fact | What it is |
|---|---|
| `university` | The university's id in `content/tracks.json` (`unibo`, `uio`, `eur`, `mci`) |
| `last-checked` | The date you last checked the guide, like `2026-10-05` |
| `host` | Faculty or institute that hosts EU-HEM |
| `language` | Teaching language and daily-life language |
| `currency` | The local currency |
| `cost-vs-bologna` | One line: cost level compared with Bologna |
| `compare-rent`, `compare-budget`, `compare-transport`, `compare-permit-non-eu` | The four comparison-table cells |

**2. The guide itself**, with exactly these 16 sections, in this order:
`## 1. At a glance`, `## 2. Before you move`, `## 3. Residence and registration`, `## 4. Healthcare`,
`## 5. Housing`, `## 6. Getting around`, `## 7. Money and phone`, `## 8. Cost of living`,
`## 9. Study places and campus`, `## 10. Food and daily life`, `## 11. Weather and what to pack`,
`## 12. Sport, social life and student organisations`, `## 13. Useful apps and websites`,
`## 14. Emergency numbers`, `## 15. Student tips`, `## 16. Sources`.

Sections 3 and 4 always have two parts: `### EU/EEA students` and `### Non-EU students`.

**What you don't write**, because the page adds it by itself:
- which tracks study in the city and in which semester (from `content/tracks.json`)
- the disclaimer, "follow EU-HEM's instructions first" and the "Report something outdated" link
- the contents menu, and the "Last checked" line at the top

## The rules for facts
- **Every price needs a source tag**, like `NOK 393 [S16]`. The tag points to a line in
  "16. Sources". The checker refuses a price without one.
- **A source line** looks like this:
  `- [S16] Ruter: student in Oslo — https://ruter.no/en/student-in-oslo — checked 2026-10-05`
- Use **official pages first**: the host university, the government or immigration authority, the city,
  the transport operator, the student welfare organisation. Use blogs only for rough cost ranges, and
  say so in the source title.
- Only write what you read on a page you opened. If you couldn't check something, write:
  `**not verified**. Check the official page: [name](https://…)`.
- Prices in local currency (NOK for Oslo, EUR elsewhere), as ranges where possible.
- Never type track names (EEH, E&P, MHI, PHM) in a guide. The checker refuses them, because the page
  takes them from `content/tracks.json`.

## How to update a price
1. Open the official page and find the new price.
2. In the guide, change the number. Keep its tag (for example `[S16]`).
3. In "16. Sources", change that source's date to today: `— checked 2026-11-20`.
4. If the price is also in the facts block (a `compare-…` line), change it there too.
5. Change `last-checked` at the top to today.
6. Run the checks (see below), then commit.

## How to add a student tip
1. Open the city's file and find `## 15. Student tips`.
2. Under the grey `<!-- … -->` note, add one bullet per tip:
   `- Buy a second-hand bike in the first week: they sell out by February.`
3. No names, phone numbers or emails. Facts with prices still need a source tag.
4. As soon as the section has a tip, it appears on the page (it is hidden while empty).

## How to add a new city
1. Make sure the university is in `content/tracks.json` (its `guide` link must be
   `city-guide.html?city=<city>`).
2. Copy `docs/content/oslo-guide.md` to `docs/content/<city>-guide.md` and rewrite every section.
   Start the source numbers again at S1.
3. In `guide-data.js`, set the city's `file` (for a new city, add one line to `CITY_GUIDES`).
4. Run the checks, look at `city-guide.html?city=<city>` in the browser, then commit.

## Checks
- `node scripts/check-content.js` checks every guide: the facts block, the 16 sections, the EU/EEA
  and non-EU parts, a source on every price, well-formed sources, and no typed track names.
- `node tests/guide/browser.test.js .` opens the guide pages in Chrome (needs `npm install` once).
- `npm test` runs everything.
- After changing a `.js`, `.css` or `.html` file, run `node scripts/stamp-versions.js`. Guide files
  (`.md`) don't need it: the site always fetches them fresh.
