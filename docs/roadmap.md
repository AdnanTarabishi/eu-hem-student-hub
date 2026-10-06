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
- Dates in Next are estimates, not promises (said on the page). At most **four** Next items have a date; the
  rest are shown as **After launch** (`"target": null`). Later ideas never have dates.
- Progress is a **count of published releases** ("15 releases shipped since 1 Oct 2026"), never a typed
  percentage. A release counts only once it is published with deployment evidence.

## Editing `content/roadmap.json`

**Release stage.** The `release` block sets the banner at the top of the Roadmap page and the version in
the footer of every page:

```json
"release": {
  "stage": "Beta",
  "version": "v0.9",
  "note": "The launch date is a target, not a promise.",
  "next": {
    "version": "v1.0", "name": "Public Launch", "targetDate": "2026-10-15",
    "includes": [
      { "label": "Exam Prep", "item": "exam-prep" },
      { "label": "Academic Rules", "update": "academic-rules-journey-support" }
    ]
  }
}
```

`includes` lists what the next release contains. Each line points to a roadmap item (`item`, shown with its
status) or a published update (`update`, shown as "Released in v0.9"), so nothing released looks planned and
nothing planned looks released. When a release ships, change `version` and `next`.

**Towards the full Hub.** The `vision` block shows the releases shipped (counted automatically from
updates.json) and when the full Hub is planned, as a season:

```json
"vision": { "title": "Towards the full Student Hub", "targetLabel": "Spring 2027", "note": "…" }
```

**Good to know.** `limitations` and `domainMove` (`{ "title": …, "items": ["…"] }`) appear at the bottom of
the page, with the `feedback` button (`{ "label": …, "url": "contact.html" }`).

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

- **One or two** items are in Now, each with a target.
- An item may have a one-line `note` shown on its card (e.g. what it depends on).
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
   node scripts/updates.js publish student-experiences --run <run id or URL> --commit <sha> [--version v1.0]
   ```
   Without `--version` the update gets the draft's version or the current `release.version`. Every published
   update has a version (`v0.9`); the Updates tab shows it as a tag and can filter by it.
   The helper checks on GitHub that the run succeeded from `main`, checks with git that each commit is
   inside the deployed version, then fills in the date and evidence. It never commits or deploys.
5. Run `node scripts/check-content.js`, commit `content/updates.json`, and merge again. The page, the
   homepage and search show the update automatically.

The Roadmap & Updates launch itself (`roadmap-and-updates`) was published this way on 6 October 2026,
with the deployment that first put the page online.

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
