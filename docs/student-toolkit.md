# Student Toolkit — v1

## Purpose and entry points

`toolkit.html` is a curated catalogue of useful tools, existing Hub workspaces and future ideas. It does not replace course pages, embed provider accounts or duplicate calculator implementations.

The catalogue is linked from the Resources navigation group, the shared footer, the Notes & Resources landing page and site-wide search. `toolkit.html?tool=<id>` opens a specific entry; the search/category/type/course/layout settings can also be represented in its URL.

## Included in this release

- **12 existing Statistics Lab tools**, linking directly to their working modes, plus **6 existing Hub workspaces**: Study Plan, Calendar, Thesis Explorer, Four-City Guides and both statistics study workspaces.
- **24 selected external services**, with short original descriptions, use cases, provider links, access caveats and a dated editorial review.
- **16 planned ideas**, with proposed scope, intended benefit and an explicit not-available notice. No launch URL, release date, vote count, notification subscription or invented usage statistics is attached to these ideas.

The interface counts 42 available catalogue entries (18 built-in/Hub and 24 external) and 16 plans. The featured Statistics Lab banner is a gateway, not another item added to the count. Existing calculators continue to be available inside both Fundamentals and Statistics for Healthcare.

## Interaction and design

The visual identity uses the Hub's shared navigation, local fonts, icons and semantic colour tokens. A navy hero combines four existing, correctly identified and credited city photographs: Bologna, Oslo, Innsbruck and Rotterdam. The fictional cities, official-funding claim, signed-in person and popularity percentages in earlier concept images are not implemented.

Search matches all typed words across titles, descriptions, tags, collection labels and relevant cities. Filters combine by intersection: category, entry type, linked statistics course and saved-only. A–Z or editorial-first order, grid/list layouts, meaningful empty states and progressive Show more controls keep the collection manageable.

Entry details use a native modal dialog with labelled controls, Escape/close handling, keyboard focus restoration and a fallback. Planned items describe what a tool could include; they cannot launch an unbuilt calculator. External links open the provider with `noopener noreferrer`. Lab details also link into the corresponding course pages. Invalid/unknown entry IDs return to the current catalogue.

The sidebar contains an explicitly editorial starting selection, the user's actual saved IDs, optional recent-tool history and the existing city guides. It does not claim recommendations based on a profile or popularity measured among students. The suggestion and correction actions lead to the existing Contact page; no new form/backend is activated.

## Local preferences and privacy

The only new storage key is `euhem-toolkit-v1`. It holds known catalogue IDs, not source data, profiles or a server-side analytics stream:

```json
{"version":1,"saved":["zotero"],"rememberRecent":false,"recent":[]}
```

Bookmarks are saved when the user selects a bookmark. Recent-tool history is **off by default**; the user must explicitly enable it. It then stores at most six distinct available-tool IDs opened from this catalogue. Turning it off clears that list. A planned idea can be bookmarked but never enters the opened-tools history.

Invalid JSON/unknown IDs are sanitised. When browser storage is denied, bookmarks work in current page memory and the interface shows that they may not persist. The clear action removes only this Toolkit key and leaves course progress and all other Hub data alone. Other-tab storage changes are reflected in the interface.

Entry links include filter settings and the selected entry, not the saved/recent ID lists. External providers have their own terms, privacy practices, eligibility and paid features. Users should not upload protected lectures or confidential data without permission. The existing privacy page has a narrow explanatory addition; this does not make it a legally reviewed policy.

## Catalogue maintenance

`toolkit-data.js` contains one record per entry and pure helpers. Each record has a stable id, title, category, kind, description, three use cases and an access/limitations note. Available entries have a checked destination; planned entries intentionally have no `href`. External entries include `source` and `reviewed`. Provider descriptions were reviewed on **7 October 2026**, not monitored live. The provider's current name is used where verified; NotebookLM remains a search alias for Gemini Notebook.

When a planned tool becomes real, verify it first, change its kind, add its route and update its scope. Do not mark it available based on a mockup. Review provider pages again before changing access claims or dates. Never invent ratings, user counts, testimonials, official endorsement or release deadlines.

The 16 proposed additions cover a test finder, Excel formula assistant, health-economics calculator, economics graph explorer, study-session planner, four-city budget, moving checklist, document dates, language phrases, research-question builder, literature matrix, dataset finder, career applications, discount finder, sample-size planning and travel budgets. The current Thesis Explorer and city guides are linked as existing workspaces rather than falsely marked as future.

## Files and integration

- `toolkit.html`: accessible page shell, hero, filters, sections, fallback content, modal and photo attribution.
- `toolkit.css`: scoped visual system, responsive grid/list layout and dark-theme support using existing tokens.
- `toolkit-data.js`: catalogue plus safe links, sanitisation and filtering helpers; CommonJS export for tests.
- `toolkit.js`: state, rendering, local preferences, details, URL sharing and actual interactions.
- `site-nav.js`: a single Resources menu entry; the native footer uses the same data.
- `search.js`: lazy catalogue indexing; plans are labelled not available in search results.
- `notes.html`: a Toolkit launch card using the existing landing-page layout.
- `privacy.html`: disclosure of the new local preferences.
- `sw.js`: new runtime assets and reused hero photographs added to its existing precache list; cache strategy unchanged.

Running `node scripts/stamp-versions.js` updates stylesheet/script fingerprints and the service-worker version. Because navigation/search are shared, HTML files across the site receive reference-only changes. No unrelated page content, course router, laboratory math, calendar data or directory submission behaviour is changed.

## Verification

Commands:

```sh
node --test tests/toolkit.test.js
node --test tests/toolkit.test.js tests/statistics-lab-math.test.js tests/statistics-lab-tools.test.js tests/statistics-lab-inference.test.js
node scripts/stamp-versions.js --check
node scripts/check-content.js
node scripts/check-contrast.js
```

The local checks passed: **22 Toolkit catalogue/security/integration tests**, and **82 Node tests including the 60 existing Lab regressions**. The content validator and the existing shared colour-pair contrast checker also passed; existing warnings about unconfigured forms and the directory endpoint were not changed.

`tests/toolkit-browser.py` exercised **73 local Chromium checks**: live/planned separation, search/filter intersections, the 12-mode shortcut, details/keyboard/escape, safe links, saved and opt-in recent state, sharing, clearing only this feature's key, invalid state, widths 320/390/768/1365/1720 and site-wide search integration. Screenshots come from the actual implementation, not image generation.

**Browser-test limitation:** network navigation is blocked in this execution environment. The browser harness loaded the actual repository sources inline and explicitly adapted location/history, localStorage and local fetch. It reorders the head theme script to simulate DOM-ready execution, inlines local fonts/images for rendering and omits service-worker registration. It does not test the live deployed website, real persistent browser storage, offline installation or external-provider transactions. Shared colour-pair checks are not a full accessibility audit.

After deployment, smoke-test the live page, save/unsave, provider link, planned detail, course link and search from another page. All future release plans remain proposals regardless of this catalogue's publication.

## Hero image credits

The photos are reused from the site's existing city guides, not newly sourced or AI-generated. Full linked attribution is visible under “Hero photo credits” on the page: Vanni Lazzari (Bologna, CC BY-SA 4.0), Øyvind Holmstad (Oslo, CC BY-SA 3.0), -wuppertaler (Innsbruck, CC BY-SA 4.0), and Trougnouf / Benoit Brummer (Rotterdam, CC BY 4.0). See the corresponding `docs/content/*-guide.md` for the original source records.
