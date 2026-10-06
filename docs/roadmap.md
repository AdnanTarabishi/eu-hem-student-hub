# Roadmap & Updates

`roadmap.html` shows what the Student Hub team is working on (**Now**), what is planned with estimated
periods (**Next**), larger ideas without dates (**Later**), every important release (**Updates**), and the
history of the Hub (**Our journey**). The homepage shows the current focus and the three latest releases,
and the site search finds plans and releases. All of them read the same two files.

| What | File |
|---|---|
| Plans (Now / Next / Later), categories, milestones | `content/roadmap.json` |
| Releases (drafts and published) | `content/updates.json` |
| All rules (validation, what is public, grouping, search entries) | `roadmap-data.js` |
| The page | `roadmap.html`, `roadmap.css`, `roadmap.js` |
| Homepage preview | `fillRoadmapPreview()` in `home.js` (styles in `style.css`) |
| Site search | `search.js` (uses `searchEntries()` from `roadmap-data.js`) |
| Draft / publish helper | `scripts/updates.js` |
| Checks | `scripts/check-content.js` (runs `validate()`), `tests/roadmap/` |

## Honesty rules (enforced by `roadmap-data.js` and the checker)

- **Roadmap ≠ released.** Roadmap items are `in-progress`, `planned` or `exploring`, and are labelled
  "Not available yet". When a plan ships, remove it from `roadmap.json` and publish an update.
- **Drafts are never shown**: not on the page, the homepage or in search.
- **A published update needs evidence**: a successful GitHub Pages deployment from `main`, its time, and
  the commits it contained. Its date is the deployment day in Rome time. No invented dates.
- Only important, student-facing releases become updates. Small fixes and visual tweaks do not.
- Dates in Next are estimates, not promises (said on the page). Later ideas never have dates.

## Editing `content/roadmap.json`

```jsonc
{
  "id": "student-stories-experiences",          // stable: used in links (roadmap.html#feature-<id>)
  "title": "Student experiences",
  "summary": "One or two sentences.",
  "category": "community",                       // one of "categories"
  "lane": "next",                                // now | next | later
  "status": "planned",                           // now: in-progress · next: planned or in-progress · later: exploring
  "target": { "start": "2026-10", "end": "2026-11", "label": "October–November 2026" },  // later: null
  "why": "Why it matters to students.",
  "details": ["What it may include…"],
  "dependencies": ["What it depends on…"],
  "links": [{ "label": "Offer your experience", "url": "contact.html" }]   // site pages or https:// links
}
```

- Exactly **one** item is in Now.
- Next items are grouped automatically by `target.start`/`target.end`; change the dates there.
- Update `updatedAt` (YYYY-MM-DD) whenever you review the roadmap; the page shows "Last reviewed …".
- The checker warns when a Next item's period has passed: move it, re-date it or publish it.
- Milestones (`milestones`) feed "Our journey": `completed` (with a date in the past) or `planned`.

## Publishing an update

1. **Draft** while the feature is being built:
   ```
   node scripts/updates.js new student-experiences --title "Student experiences" \
     --summary "Read honest experiences from second-year students and alumni." \
     --type new --category community --highlight "Filter by university and topic." \
     --link "Read student experiences|experiences.html"
   ```
   It is saved with `"status": "draft"`, `"date": null`, `"evidence": null`, and stays hidden.
2. **Review** the text, then merge the feature to `main` as usual.
3. **Wait for the deployment** to succeed (GitHub → Actions → *pages build and deployment*).
4. **Publish** with that run and the feature's commit(s):
   ```
   node scripts/updates.js publish student-experiences --run <run id or URL> --commit <sha>
   ```
   The helper checks on GitHub that the run succeeded from `main`, checks with git that each commit is
   inside the deployed version, then fills in the date and evidence. It never commits or deploys.
5. Run `node scripts/check-content.js`, commit `content/updates.json`, and merge again. The page, the
   homepage and search show the update automatically.

The Roadmap & Updates launch itself (`roadmap-and-updates`) is a draft until this page is deployed; publish
it with step 4 after the merge.

## Saved plans

"Save" keeps a plan in the visitor's own browser (`localStorage`, key `euhem.roadmap.saved.v1`,
`{ "version": 1, "ids": [...] }`). Nothing is sent anywhere. It is not a vote, a subscription or a
notification; the page says so. If the browser blocks storage, saving works for the visit only.

## Links and routes

`roadmap.html#roadmap`, `#updates`, `#journey` open a tab; `#feature-<id>` and `#update-<id>` open the
details of one item (also from search and the homepage). Back/Forward work.

## Offline and caching

The page files are in the service worker's site files (`sw.js`). `content/*.json` is network-first, and the
page asks for fresh copies (`cache: "no-cache"`), so roadmap edits appear on the next visit while the
last copy still works offline.

## Origin

Based on the "Roadmap & Updates V2" handoff (October 2026). Its content, schedule and publishing rules were
kept; the code was rebuilt on the site's design system with one shared rules file, and today's two real
releases (Students explorer, new design) were added with their deployment evidence.
