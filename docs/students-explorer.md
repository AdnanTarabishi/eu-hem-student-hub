# Students explorer (students.html)

"One community. Many perspectives.": a community atlas with a map, profile cards and a compact list, filters, profile details, saved profiles
and statistics. **Phase 1 shows only fictional demo data.** Real profiles need a real login and a server that
applies the rules below (Phase 2); nothing in the browser can unlock private data.

## Files

| What | File |
|---|---|
| Page | `students.html`, `students.css` |
| Page code (rendering, map, drawer, address) | `students.js` |
| **All privacy rules**, filters, counts, statistics checks (no page code, tested on its own) | `students-data.js` |
| Settings (data mode, page size, minimum group size, map views, track colours) | `students-config.js` |
| Countries: names, ISO codes, "in Europe" (geography only) | `countries.js` (shared with the Join form) |
| Fields, degrees, tracks, citizenship and visa answers | `directory-options.js` (same ids as `Code.gs`) |
| Demo records (40 fictional people) | `data/demo-students.json` |
| Demo whole-cohort statistics (fictional, precomputed) | `data/demo-aggregates.json` |
| Generator for both demo files | `scripts/build-demo-students.js` |
| Map | `assets/map/world-countries.svg`, built by `scripts/build-world-map.js` |
| Tests | `tests/students/data.test.js`, `tests/students/browser.test.js` |

## Processing order (privacy depends on it)

1. **Projection** (`projectProfile`): from a source record to what *this viewer* may see, built from an
   allowlist. Only records with email verified, role verified **and** admin approved are considered. A record
   the viewer may not see becomes nothing at all.
2. **Field rules** (inside the projection): each detail has its own visibility and can never be wider than the
   profile. Unknown or missing values count as hidden (fail closed).
3. **Search and filters** run on the projected copies only, so a hidden detail can never make a profile match.
4. **Counts** (map colours, country list, totals, insights) count projected and filtered profiles only.
5. **Pagination** last, so counts never depend on the page.

## Access matrix

| Record | Public preview (and future public site) | Verified-member preview (demo only) | Future real member view |
|---|---|---|---|
| Public profile | shown, public details only | shown, public + members-only details | same, after a real login |
| EU-HEM-only profile | **not sent, not counted, no placeholder** | shown | after a real login checked by a server |
| Hidden profile | never | never | never |
| Citizenship group / study-visa answer | never | only if the person chose "share with verified EU-HEM students" and gave a substantive answer | same, after a real login |
| Email | never | never (demo has none) | only if chosen, after a real login |

Demo counts: **24** profiles in the public preview, **36** in the member preview, **40** fictional records.

### Why the member preview cannot leak real data
- `projectProfile` honours the member view **only for records marked `isDemo: true`**; a real record in member
  mode is treated exactly as in public mode.
- In demo mode the page loads only `data/demo-students.json` and drops any record without `isDemo: true`.
- `students-config.js` has only `dataMode: "demo"`; `scripts/check-content.js` fails for anything else.
- No address parameter, config value or localStorage key selects the member view; the switch is a radio
  button that is shown only in demo mode and starts on "Public preview" on every visit.

### Members-only card
One generic card ("Some profiles are members-only") replaces any per-person placeholder. It is the same in
every view and for every filter, so it reveals no names, initials, countries, numbers or positions. It says that
there is no student login yet, and has no fake login button.

## Filters, search and the page address

- Several values in one category = **OR** (Italy or Norway); different categories = **AND**.
- Primary: search, cohort, country, current track, academic background. More: degree, membership (only shown
  when there is more than one value), "Has LinkedIn" (a LinkedIn action visible to this viewer).
- Members-only (member preview): citizenship group and study-visa experience. Only the two (four) substantive
  answers, only for people who chose to share. **Kept in memory only**; cleared when leaving the member view.
- Track states: the four current tracks, "Not chosen yet", "Not shared". Any other stored value (for example an
  earlier specialisation) shows neutrally as "Track not shown", never converted into a current track.
- Search: case-, accent- and whitespace-insensitive; every word must match; only visible fields.
- **Address (URL)** keeps only: `cohort`, `country`, `track`, `background`, `degree` (comma-separated ids),
  `view=list`, `profile=<id>`. Unknown values are dropped. Citizenship, visa, search text and saved state are never
  in the address. `cohort=all` means all participating cohorts when the default is a single cohort.
- Back/Forward restore filters and the open profile. A profile link (`students.html?profile=demo-014`) opens the
  drawer; a hidden, members-only (in the public view) or unknown id gets the same neutral message: "This profile
  is not available in your current view."
- Sorting: name A–Z (full name as written, never split), country, academic background, track, cohort (newest
  first). Missing values last; ties by name, then id, so the order never jumps.
- "Meet someone new" picks at random from the current, visible results (never AI, never hidden records).
- Saved profiles: profile ids only, in this browser's localStorage (`euhem-saved-profiles-v1`), no server, easy
  "Clear saved". Ids that are not available in the current view are not shown and are only counted.
  If device storage is unavailable, saving works in memory for this tab and feedback states that it will not
  persist after a reload. Save controls retain keyboard focus when profiles are redrawn.

## Community atlas presentation

- Page styles are scoped to `body.students-page` and `#sx`; shared navigation and other pages retain their styles.
- The hero's orbit is decorative, not a depiction of real people or their connections. The fictional notice
  remains above the statistics and every demo profile has a fictional badge.
- Discover, World map, People and Cohort insights links jump to the corresponding visible sections.
  Search and filters support a persistent Clear filters action; the map starts open on phones as well.
- Summary tiles describe matching, viewer-visible profiles, represented countries and academic backgrounds
  before pagination. The separate fictional source-record total is not a count of real EU-HEM students.
- Cards, compact list and the native profile dialog support both colour themes, narrow screens, keyboard
  navigation and reduced motion. If the local map fails to load, Retry map restores it without a page reload;
  the country list and filters remain usable throughout.
- Country names have decorative local image flags in cards, the list, profile details, filters,
  country chips, map tooltips, the selected-country panel and country statistics. They use the
  existing country codes after visibility projection; hidden country fields gain no flag.
  The 197-flag atlas works on Windows without flag-emoji support and is cached for offline use.
  Source, MIT licence and rebuild instructions: [assets/flags/README.md](../assets/flags/README.md).
- Regression coverage: `tests/students/data.test.js`, `tests/students/browser.test.js` and
  `tests/students/design.test.js` (layout, focus, storage failure, retries and unbroken profile text).

## The map

- **Source:** Natural Earth, Admin 0 – Countries, 1:50m, **v5.1.2**,
  `https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_50m_admin_0_countries.geojson`.
  **Licence: public domain** (https://www.naturalearthdata.com/about/terms-of-use/). Credited in the page footer.
- **Build:** `node scripts/build-world-map.js path/to/ne_50m_admin_0_countries.geojson` (only needed to rebuild;
  the SVG is committed). Equal Earth projection, simplified outlines, Antarctica dropped, about 200 KB, no
  external requests, no tiles, no API key.
- **Codes:** ISO 3166-1 alpha-2 from Natural Earth's `ISO_A2_EH` field, because `ISO_A2` is `-99` for Norway,
  France and Kosovo. Kosovo is `XK`. Areas with no code (Somaliland, Northern Cyprus, Siachen Glacier) are drawn
  grey and cannot be selected.
- **Not drawn (too small at 1:50m):** Liechtenstein, Maldives, Monaco, Saint Kitts and Nevis, San Marino, Tonga,
  Tuvalu. They stay in `countries.js`, the filters and "Explore by country"; profiles from them are never dropped.
- **"In Europe"** in `countries.js` is Natural Earth's `CONTINENT` (geography). It is **not** EU/EEA/Swiss
  citizenship and is never used for citizenship. Türkiye was added by hand (Asia, as in Natural Earth).
- **Counts:** colours count visible profiles that match **every filter except Country** (faceted), so you can
  compare countries; the selected country, the panel and the results apply all filters, and therefore agree.
  The page says so under the map. Additional countries ("Also identifies with") are not counted on the map.
- Legend "Visible profiles": 0 plus up to four ranges computed from the counts on screen. Selected countries
  have a dashed outline (not colour alone). Tooltips appear on hover **and** keyboard focus.
- Controls: Europe and World presets, zoom in/out, reset, drag to move. No wheel zoom (page scrolling is never
  trapped); on touch screens vertical swipes scroll the page. Only countries with profiles are tab stops;
  "Explore by country" is the complete accessible alternative. If the map fails to load, everything else works.

## Statistics

Two separate products:

**A. Who is in this view** (directory insights): computed in the browser from the **visible, filtered**
profiles only. Labelled "Based on visible profiles in this view." It can only repeat what is already visible.

**B. Mobility statistics** (whole cohort): citizenship group and self-reported study-visa experience. Never
computed in the browser from people: they must be **precomputed elsewhere** from consenting records and
disclosure-checked before release. The demo file is made by `scripts/build-demo-students.js` from the fictional
records with the same rules (`safeBreakdown` in `students-data.js`):
- only people who ticked the separate mobility-statistics consent;
- denominator = consenting people who gave a substantive answer (stated on the page); skipped and
  "prefer not to say" are never recoded and never shown as a group;
- the whole group must have at least `minGroupSize` (5) people;
- any category with 1–4 people is hidden; if only one is hidden, the next smallest is hidden too
  (complementary suppression), so it cannot be worked out by subtraction;
- if nothing safe is left: "Not enough publishable data for this breakdown.";
- releases are per cohort only. Not cross-filterable by country, track, degree or university, and not affected
  by the page filters, so repeated filtering cannot isolate a person.
- Citizenship is never published per country, so public profile data cannot be subtracted from it.

**Limits:** a minimum group of 5 is a first safeguard, not a guarantee of anonymity. Before releasing real
figures, a person should review each table, ask whether a reader with outside knowledge (for example, knowing
the only student from one country) could learn something, and prefer broader categories or no release.

Demo charts are labelled "Fictional".

## Demo data

40 invented people (names, bios, universities chosen for realism; no real people, no photos, no emails, no web
addresses; LinkedIn is the word "example" and shows a disabled "Example LinkedIn"). These are **design targets**
from the maintainer's rough description, not real cohort statistics.

| | |
|---|---|
| Countries | Netherlands 12, Italy 8, Germany 6, Norway 6, Spain 2, Portugal 1, Austria 1, Syria 1, India 1, Nigeria 1, Brazil 1 (36 in Europe, 4 outside) |
| Cohorts | 2026–2028: 32; 2025–2027: 8 (all current students; no invented alumni) |
| Tracks 2026–2028 | MHI 10, EEH 9, E&P 7, PHM 4, not chosen 1, prefer not to share 1 |
| Tracks 2025–2027 | MHI 2, EEH 2, E&P 2, PHM 2 |
| Academic fields | Medicine 6, Economics 6, Public Health 4, Business/Management/Finance 4, Pharmacy 3, Health Sciences 3, Biomedical/Life Sciences 3, Nursing & Midwifery 2, Dentistry 2, Political Science/Policy 2, Engineering + Statistics/Data 2 (engineering_technology 2), Psychology + Social Sciences 2 (1 + 1), Law 1 |
| Profiles | 24 public, 12 EU-HEM only, 4 hidden |
| Edge cases | long and accented names, short and long bios, missing degree/university/LinkedIn, additional countries, narrower per-detail visibility, a skipped citizenship answer, "prefer not to say", and two dual-citizenship counterexamples (represents Syria + EU citizen; represents the Netherlands + non-EU citizen) |

The generator **refuses to write** unless every number above is exact. Run it after editing the table:
`node scripts/build-demo-students.js`.

## Adding a cohort

Add it to `directory-config.js` → `cohorts` (newest first). The explorer lists only cohorts that have visible
profiles, so an empty future cohort never appears as if it had students. The registration form and the
retention rules pick it up from the same file.

## How real public data could be added later (not now)

Only after the Phase 2 decisions (ask the maintainer first):
1. A **server-side** export that applies the same rules as `projectProfile`: approved + email verified + role
   verified, public profiles only, allowlisted public details only. Manual, fail-closed, tested on synthetic data.
2. Never "Publish to web", CSV, gviz or JSON views of the Sheet; the Submissions tab and photo folder stay
   Restricted.
3. A separate `dataMode` (e.g. `"public"`) that accepts only that allowlisted file, plus a checker rule.
4. Members-only data only through an authenticated, authorised server; never cached by the service worker.
5. Photos only through a reviewed public copy, never Drive IDs.

## Offline (PWA)

The page, styles, scripts, `countries.js` and the map are in the service worker's site files. The demo JSON is
under `data/` (always fetched fresh, saved copy used offline). Real person-level data must never be added to the
service worker's precache.
