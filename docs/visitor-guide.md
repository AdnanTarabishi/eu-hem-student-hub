# Visitor Guide

The Visitor Guide is an interactive introduction to the current public EU-HEM Student Hub. It combines an editorial chapter tour, suggested first-visit routes and a searchable feature directory. The content snapshot was reviewed on 15 October 2026.

The guide explains where existing features lead. It does not activate registration, accounts, editor publishing, uploads, new collection or remote saving.

## Illustrated visitor edition

The hero contains six manually selected feature previews: Plan, Learn, Tools, Research, Life and Connect. Each is an original decorative composition with a real destination link and a visible illustrative label. They do not show live records or calculate results. Standard buttons support keyboard activation; previews never rotate automatically and work independently of the optional directory JSON. Without JavaScript, the first preview and its destination remain readable.

The eight chapters have distinct illustrations, and suggested starting routes are numbered pathways. An interactive section map shares the directory’s group filter; category shortcuts preserve the current search and availability filter. Cards and Compact list use the same records and result set. Layout changes, preview choices and filters stay in page memory and do not update student data or the URL. Reset filters preserves the chosen layout.

Motion is limited to short transitions and a gentle pointer hover effect. Reduced-motion preferences remove these effects. Printed output hides the illustrative hero and discovery controls while preserving complete chapters, destinations, status labels and boundary notes.

## Content and navigation

`content/visitor-guide.json` contains:

- `version` and `reviewed`: the guide schema version and the date of this content review. The review date does not verify every external source or live feed.
- `chapters`: the ordered welcome, plan, learn, tools, research, life, community and project tour. Each chapter has a title, eyebrow, summary, three highlights, local linked actions and an important boundary note.
- `routes`: suggested starting links for current students, people exploring EU-HEM and readers seeking the programme overview.
- `extras`: deep features that are not separate shared-menu destinations, including specialist learning spaces, a course workspace example, an interactive lecture, the content authoring form, Toolkit workbenches and solvers, and Thesis guide views.

Build the main feature directory from the existing `SITE_MENU` in `site-nav.js`. Do not copy that menu into this JSON. This keeps the guide aligned with navigation changes. Add extras only for useful distinct destinations, avoiding another record for an existing canonical menu link.

Preserve existing course and feature routers. Chapter navigation, route selection, directory search and filters are guide browsing state; they must not update a student's Study Plan, chosen track, learning progress or saved lists. Directory search and route selection stay in page memory. A chapter fragment may provide a shareable entry point.

All authored action and extra links are local HTML destinations. Existing destination pages handle their own official, external, email, export and submission actions. Guide illustrations are representative CSS compositions, not live timetable or exam records, student photos or working submission forms.

## Maturity labels and factual boundaries

Use consistent visible status labels:

| Status | Meaning |
| --- | --- |
| `available` | A public feature visitors can use; this is not a live-source health check. |
| `demo` | A functioning interface with fictional individual profile data. |
| `preview` | A browsable structure for a section whose collection or service is unfinished. |
| `not-open` | The route exists, but registration or the relevant connection is not open. |

Apply these shared-menu overrides:

- `students`: `demo`. Individual profiles are fictional. The supplied aggregate country-of-origin atlas is a separate dataset.
- `join`: `not-open` while `directory-config.js` has an empty endpoint. No student account, profile editor or cross-device sync is available.
- Menu items with `preview: true`: `preview`. This currently covers Beyond EU-HEM, Events and Gallery. Keep the preview label on chapter actions as well as directory entries.

Check the underlying configuration and feature documentation before changing these labels. Do not turn a status change into activation of a service.

Preserve the following distinctions in copy:

- The Hub is unofficial, student-run and volunteer. University sources remain authoritative.
- A saved Study Plan is not an official submission. A calendar action is not exam registration. Scheduled teaching progress is not attendance or earned credit.
- Official slides, lectures, datasets and answer keys remain on university platforms. Original student guides, quizzes, mocks and calculators have varying coverage and stated limits.
- Statistics Study Centre and Fundamentals of Statistics are separate learning workspaces. Statistics Lab is shared educational tooling, also available within those courses.
- Historical thesis records use legacy track names. Current-track relevance and themes are explicitly Hub interpretation of titles, not full-text assessment or approved research proposals.
- Local persistence differs by feature. Some information is saved automatically in the browser, some tools require explicit saving, and some drafts last only in memory or the current tab. Backups are feature-specific.
- Contact links lead to the current contact options; Privacy links lead to current information. Do not describe either as legal approval. Do not change their flows from the guide.
- Experiences contributions go to the existing private Contact inbox only when a visitor sends them. Public stories require separate review and author approval.
- Beyond EU-HEM has no populated vacancy collection, Events accepts no registration, and Gallery has no uploads or member access.
- The editor dashboard is outside the visitor directory. Its existence does not mean editor publishing or student accounts are connected.
- Roadmap targets and owner-reported effort are estimates. Avoid fixed catalogue totals, adoption claims, completion percentages or implied launch promises in guide prose.

## Accessibility, printing and offline use

Keep chapter and directory destinations available as ordinary links. Navigation, route controls, filters and search need accessible names, visible keyboard focus and useful empty states. Honour reduced motion, narrow screens and both themes. Representative UI illustrations must not create misleading interactive controls.

Printing should expose the complete guide and useful destination labels, including boundaries and maturity labels. Do not print only the active chapter or hide features because an in-memory filter was selected.

Include the guide page, runtime assets and JSON in the existing service-worker file list. Offline availability means cached Hub content; it does not make external services live or guarantee that cached academic dates are current. Reuse the existing app update mechanism.

## Maintenance and validation

When a feature changes, update its source documentation and implementation first, then check the relevant chapter, routes, extra cards and maturity override. Shared-menu additions should appear automatically. Keep route identifiers, course identifiers, deep links and saved-data keys unchanged.

Useful source files for this snapshot include `README.md`, `site-nav.js`, `content/programme.json`, `directory-config.js`, `contact-config.js`, and the feature guides in `docs/`: Track Explorer, course interiors, Statistics lectures and Lab, Student Toolkit v4, Thesis guide, Student Experiences, Student Life, future sections, Calendar workspace, and Roadmap.

The older placeholder wording for Contact and Privacy in `AGENTS.md` conflicts with newer implementation documentation. This guide links to the current pages without treating that wording as a reason to change those flows.

Validate JSON structure, unique IDs, safe local links, chapter and route counts, and every extra destination against the repository. Check that no private source document, private file pointer, personal contact detail, student photo or secret has entered public assets. The design reference is not a publication source.

Run the content and contrast checks, focused Visitor Guide browser checks and relevant shared-navigation checks. Verify desktop and mobile layouts in both themes, keyboard navigation, direct chapter entry, search/filter clearing, all-content printing and service-worker offline reload. Browser fixtures must be fictional and must not send real forms or book anything.

After HTML, CSS or JavaScript changes, run `node scripts/stamp-versions.js` and validate the resulting asset fingerprints and service-worker version. Generate social metadata through the existing script when introducing the page. Report only checks actually run; an authored guide or an unreferenced Git blob is not evidence of a deployed release.
