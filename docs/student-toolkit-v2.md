# Student Toolkit v2 — collections and personal organisation

## Release scope

This release keeps the existing catalogue and calculators and adds four navigation views: **Browse tools**, **Ready-made collections**, **My lists**, and **Compare**. There is no backend, account integration, new usage analytics or new statistical method.

- 8 editorial collections with 4 suggested steps each: semester start, statistics revision, literature review, health/economic data, writing/presentations, group projects, moving cities, and research/career preparation.
- Each collection opens the real catalogue entries and can be copied into a personal list. Collection links contain only a public collection identifier. These workflows are original suggestions, not official course requirements or mandatory sequences.
- Up to 12 personal lists, 30 catalogue entries per list and 60 characters per name. Create, rename, delete, reorder, add/remove and mark entries reviewed. A planned item can be reviewed as an idea but remains explicitly unavailable.
- JSON export/import for personal lists. Import validates content, previews names/counts and requires confirmation. It adds fresh local list IDs without replacing existing lists; repeated imports create copies. Unknown tool IDs, invalid checked states and over-limit backups are rejected. File limit: 100,000 bytes. This is manual backup, not cloud synchronisation.
- A session-only comparison of up to 3 available entries, showing existing descriptions, uses, access caveats, course links and limitations. There are no ratings, invented prices or automatic quality rankings. Planned items cannot be added as live products.
- Explicit city-specific filter and a “new provider additions” filter, both intersecting with existing search/category/type/course filters. City-specific deliberately excludes generic tools without a city tag; it is not a recommendation engine.

## Catalogue totals and new resources

The catalogue now has **70 entries**: 18 existing Hub/lab entries, 36 external provider entries, and 16 planned ideas. Thus **54 are available catalogue entries**, not 54 newly built calculators. The 12-mode Statistics Lab remains unchanged.

Twelve external additions were checked using official/provider descriptions on **7 October 2026**. All wording is short original editorial copy. Access, routes, interfaces, terms and costs may change; none is continuously monitored or connected to a student's account.

| Entry | Source reviewed |
|---|---|
| WHO Global Health Observatory | https://www.who.int/data/gho |
| World Bank Open Data | https://data.worldbank.org/ |
| OpenAlex | https://openalex.org/ |
| EQUATOR reporting guidelines | https://www.equator-network.org/ |
| Open Science Framework | https://www.cos.io/products/osf |
| EURAXESS Jobs & Opportunities | https://euraxess.ec.europa.eu/jobs |
| ORCID | https://info.orcid.org/what-is-orcid/ |
| CORDIS | https://cordis.europa.eu/ |
| Ruter Journey Planner | https://reise.ruter.no/en |
| Entur | https://entur.no/ (provider search result; JavaScript-only landing page) |
| IVB Innsbruck Transport | https://www.ivb.at/en/ |
| Excalidraw | https://excalidraw.com/ (provider search description) |

Existing provider descriptions keep their previous review metadata; they were not all independently re-reviewed in this release. No actual vacancies, travel quotes, student discounts or eligibility decisions are stored here.

## Local data and privacy

The new key is `euhem-toolkit-lists-v1`:

```json
{"version":1,"lists":[{"id":"l-example","title":"My revision","items":["normal","zotero"],"checked":["normal"]}]}
```

It is created only when the user creates/changes/imports a list. Data are kept in browser localStorage with an in-memory fallback and a visible warning if storage fails. List names are untrusted plain text, escaped on output. The library validates IDs against the catalogue and bounds all inputs. The separate v1 bookmark/history key is preserved. Clear My lists removes only the new key; clearing v1 bookmarks does not remove lists. Other-tab storage events refresh the visible lists.

Backups include list names and reviewed entries; these can reveal interests. Avoid personal/confidential information in titles and treat exported files accordingly. No raw datasets, private URLs, uploaded lectures or course progress are added to a list. An external link follows the existing provider-opening behavior. No notification, application, ticket booking or new provider account is created by the organiser.

## Architecture

- `toolkit-organiser-data.js`: collections and pure bounded list/import/export functions; browser/CommonJS exports.
- `toolkit-organiser.js`: new navigation views, local lists, native dialogs, comparison and manual backups.
- `toolkit-organiser.css`: scoped responsive styles using the site's existing semantic light/dark tokens.
- `toolkit-data.js`: 12 new records and the two filter fields.
- `toolkit.js`: small integration hooks, card/detail list and comparison actions, filter handling and preservation of public section/collection URL parameters.
- `toolkit.html`: navigation/panel shells, new filter controls, assets and notices.
- `privacy.html`: a narrow local-list disclosure; not a legally reviewed policy.
- `sw.js`: three new runtime assets in the existing precache, and normal version stamping. No cache strategy change.

The new component listens for `toolkit:render` and `toolkit:detail` events and uses the explicit `StudentToolkitUI` methods. It does not watch the full DOM or patch unrelated site routers. One toolkit instance per page remains the supported design. Existing course resources, lab computations, navigation, admin/editor and directory logic are not changed.

## Verification

Executed locally:

- **102 passing Node tests**: 22 updated catalogue tests, 20 new organiser tests and 60 unchanged statistical-calculator regression tests.
- **73 existing Toolkit browser checks** with updated expected catalogue totals.
- **68 new browser checks**, covering collections, copying a pack, list CRUD, review flags, ordering, planned labels, malicious-title escaping, export payloads, import confirmation/validation, comparison limits, sharing, simulated reload/storage denial, public URL handling and responsive widths 320, 390, 768 and 1365.
- Existing content validation and shared colour-pair contrast checks pass. These are not a full accessibility audit.

```sh
node --test tests/toolkit.test.js tests/toolkit-organiser.test.js tests/statistics-lab-math.test.js tests/statistics-lab-tools.test.js tests/statistics-lab-inference.test.js
node scripts/stamp-versions.js --check
node scripts/check-content.js
node scripts/check-contrast.js
```

**Browser limitation:** Chromium navigation to localhost was actually attempted and failed with `ERR_BLOCKED_BY_ADMINISTRATOR`. The existing inline test harness therefore loads the actual HTML/CSS/JS/images/fonts with explicit URL/history/localStorage/fetch adapters. These tests do not verify live-site navigation, real persistent storage, service-worker installation or provider transactions. Export tests inspect the generated Blob payload; they do not prove that the operating system saved the downloaded file. Import uses browser file-input payloads and confirmation. Browser scripts, logs and real implementation screenshots are supplied in the v2 handoff archive. Font files are not included in that archive.

Suggested live smoke check after publication: open a collection, copy it into a list, add a tool, reorder it, export/import the backup and compare two available tools.
