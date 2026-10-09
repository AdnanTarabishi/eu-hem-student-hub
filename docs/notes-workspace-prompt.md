# Notes & Resources — design and development brief

## Role and outcome
Act as a senior product designer, accessibility reviewer and front-end engineer. Rebuild the Notes & Resources landing experience of the EU-HEM Student Hub as a calm, resource-first study workspace, not a marketing landing page or a wall of timetable cards.

A student should quickly answer: “Where is my course?”, “What can I study now?”, “How do I practise?” and “Where did I save that?”

## Visual direction
Use the existing navy, terracotta and warm-ivory identity, local Inter/Source Serif fonts and shared SVG icons. Establish a clear hierarchy, restrained surfaces, generous but purposeful spacing, readable type and unmistakable selected states. The redesign must feel noticeably different without changing the global header or unrelated pages. Avoid decorative hero illustrations, oversized statistics, gratuitous animations and new external assets.

## Information architecture
1. Put a compact, clearly named page heading and library search first.
2. Make courses, concepts, progress and the saved study list the primary navigation.
3. Prioritise actual study materials inside course cards; disclose teaching blocks and exam details on demand.
4. Preserve clear distinctions between ready resources and overview-only courses. Group by real teaching status; collapse overview-only groups only when no explicit status filter is selected.
5. Move personal progress, the semester snapshot, format counts and relevant tools into a secondary column on desktop. On mobile, keep course browsing before secondary panels.
6. Retain useful grid/list layouts, plan filters, bookmarks, direct material links and the contribution route. Do not create duplicate storage systems or fake functionality.

## Functional improvements
- Search course names and codes, notes, concepts, questions, flashcards, resources and interactive lessons that do not have a Markdown note.
- Use bounded batches for large result sets, with a real Show more action, an announced result count and sensible keyboard focus.
- Provide an in-place glossary filter and clear empty/loading/error states.
- Preserve meaningful URLs, Back navigation, keyboard tabs, slash-to-search and Escape-to-clear.
- Derive all counts and dates from existing data. Keep calendar-copy provenance visible, even in collapsed exam summaries. Never claim a fallback date is live or guess an exam time.

## Non-negotiables
Plain HTML/CSS/JavaScript only. Preserve all academic content, course IDs, study progress, backup/restore semantics, existing storage keys, user choices and deep links. No accounts, backend, analytics, remote tracking, private student data or new paid services. Official lectures and slides stay on Virtuale. Do not modify the global design tokens or other teams' work.

## Delivery and acceptance
Inspect current code and tests before editing. Work from a pinned repository snapshot and use a dedicated branch. Produce readable, scoped source changes and targeted regression tests. Run content and contrast checks, schedule/date tests and real-browser tests at phone/tablet/desktop widths in both themes. Cover search, pagination, filters, native disclosures, keyboard navigation, saved progress, offline fallback and no horizontal overflow. Inspect actual rendered screenshots. Run the repository's version-stamping script so installed copies can update. Merge only the reviewed change and verify the Pages deployment separately from browser-preview evidence.

Explain the delivered result, the tests actually run and any limitations. Do not describe a mock-up or an unmerged branch as a live deployment.
