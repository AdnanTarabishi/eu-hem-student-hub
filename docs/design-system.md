# Design system: EU-HEM Student Hub

One visual identity for every page: **navy + terracotta + warm ivory**. European, academic and trustworthy,
but warm and student-made. It is not an official EU-HEM or university look.

Everything lives in plain CSS. There is no framework or build step.

| File | What |
|---|---|
| `style.css` §1 | **Design tokens** (colours, type, spacing, radius, shadows, motion), light and dark |
| `style.css` §2–9 | Base and layout, header/navigation/drawer, footer, buttons, cards, pills, filters, feedback states |
| `style.css` §13 | Homepage |
| `style.css` (later sections) | Page styles: Study Plan, Timetable/Exams, Notes, Tracks, Thesis, City Guide… |
| `students.css`, `join.css` | Students explorer and Join form (only loaded there) |
| `study-practice.css` | Shared study cards, lettered choices, answer states and recaps across Notes study tools |
| `site-nav.js` | Header, menu, phone drawer and footer for every page |
| `theme.js` | Light/dark button (outline sun/moon icons) |
| `icons.svg` | The icon sprite (Lucide, ISC licence): outline, 1.75 stroke, rounded ends |

## Colour roles

| Role | Light | Dark | Use for |
|---|---|---|---|
| Navy (`--navy-900`, `--color-heading`) | #0F2B5B | #F2F4F7 (headings) | Headings, navigation text, big numbers, footer, navy action buttons |
| Secondary navy (`--navy-800`) | #163A63 | n/a | Hover of navy actions |
| Blue (`--color-link`, `--color-primary`) | #1F5FAE | #74A7DF | **Interaction**: links, focus ring, selected controls, info |
| Soft blue (`--color-primary-light`) | #EAF2FB | #1C2F47 | Icon circles, hover backgrounds |
| Terracotta (`--color-brand`) | #C75B3A | #E78562 | **Personality, used sparingly**: active-page underline, map highlights, selected chips, the editorial rule |
| Terracotta CTA (`--color-brand-action`) | #C0562F | #E78562 | Filled main call-to-action buttons (a touch darker than #C75B3A so white text passes AA) |
| Dark terracotta (`--color-brand-hover`, `--color-brand-text`) | #A9472D | #F0A184 | CTA hover; terracotta as text |
| Soft terracotta (`--color-brand-soft`) | #F8E9E2 | #3A2621 | Selected chips, highlights |
| Page (`--surface-page`) | #F7F5F1 | #111827 | Page background |
| Card (`--surface-card`) | #FFFFFF | #182230 | Cards |
| Warm white (`--surface-warm`) | #FFFDF9 | #151F2C | Header, alternating sections |
| Elevated (`--surface-elevated`) | #FFFFFF | #202B3A | Dropdowns, drawers, the stats strip |
| Footer navy (`--surface-navy`) | #0F2B5B | #091D3A | Footer, navy blocks |
| Text (`--text-primary` / `--text-secondary` / `--text-muted`) | #20242A / #667085 / #8A94A6 | #F2F4F7 / #CBD5E1 / #98A2B3 | Body / secondary / decorative only |
| Borders (`--border-default` / `--border-subtle` / `--border-input`) | #E4E7EC / #EEEAE4 / #D0D5DD | #344054 / #2A3546 / #475467 | |

**Semantic states** (terracotta is never an error colour):

| | Text | Background |
|---|---|---|
| Success | #2B7556 (dark #6FC29B) | #E9F5EF |
| Warning | #9A6416 text, #B7791F borders (`--color-accent`) | #FFF4DB |
| Error | #B42318 | #FDECEC |
| Info | #2F6DAA | #EBF3FB |

**Rules of thumb**
- One terracotta filled button per visual region at most. Most actions are navy (`.button`) or outline
  (`.button-secondary`).
- Links are blue. Navy is for important inline calls to action. Terracotta is never used for every link.
- Notices, demo labels and "last checked" boxes use the warning amber (`--color-accent`), not terracotta.

## Track colours (canonical, the same on every page)

| Track | Colour | Soft | Text on soft | Dark mode |
|---|---|---|---|---|
| EEH, Economic Evaluation in Healthcare | #2F6DAA | #EAF2FA | #2F6DAA | #74A7DF |
| E&P, Health Economics & Policy | #6B5AA6 | #F0EDF8 | #6B5AA6 | #A79ADD |
| MHI, Management of Healthcare Institutions | #C75B3A | #F8E9E2 | #A9472D | #E78562 |
| PHM, Population Health Management | #3D7D6A | #E9F3EF | #336A5A | #6FC29B |

- Tokens: `--track-eeh`, `--track-eeh-soft`, `--track-eeh-text` (and so on).
- The hex values are also in `content/tracks.json` (`accent`) and `students-config.js`.
- `scripts/check-content.js` checks that those two agree.
- Pages apply a track colour as `var(--track-<id>, <hex>)` (`trackAccent()` in `tracks.js` and `students.js`),
  so dark mode automatically uses the lighter versions.
- Pill classes: `.track-pill-eeh`, `.track-pill-ep`, `.track-pill-mhi`, `.track-pill-phm`. The older
  `.track-color-0…3` classes map onto the same colours.
- A track is always shown with its name or abbreviation too, never by colour alone.

## City accents (secondary only)

Bologna #C75B3A · Oslo #3B6E8F · Innsbruck #497560 · Rotterdam #426983. Tokens: `--city-<name>`.
They are used only for the thin border under a city photo and the country label on city cards. City pages
keep the global design.

## Community map scale

- `--map-0` (none) #E7E9EE
- `--map-1` #F3D8CC
- `--map-2` #E9A98E
- `--map-3` #D97957
- `--map-4` #B94A2C
- `--map-selected` #8F321D (white in dark mode)
- `--map-sea` #F4F6F9

The Students map and the small homepage map use the same scale.

## Typography

- **Inter** (local) for body text, buttons, navigation, forms, filters, tables and metadata.
- **Source Serif 4** (local) for page titles, section titles, the homepage hero, editorial headings and big
  numbers.
- No external fonts are loaded.

| Token | Size |
|---|---|
| `--fs-display` | 40 → 64px (homepage hero) |
| `--fs-h1` | 32 → 48px |
| `--fs-h2` | 26 → 36px |
| `--fs-h3` | 18 → 22px |
| `--fs-body-lg` / `--fs-body` / `--fs-small` / `--fs-meta` | 18 / 16 / 14 / 13px |
| `--fs-eyebrow` | 11.5px, uppercase, letter-spacing 0.12em |

## Spacing, layout, radius, shadow, motion

- **Spacing** `--space-1…12`: 4 8 12 16 20 24 32 40 48 64 80 96. Sections use `--section-y` (48–88px).
- **Widths:**
  - `.container`: 1240px, general content.
  - `.container-wide` and `body.wide-page main`: 1320px, data-heavy pages.
  - `.container-reading`: 820px, long reading.
  - The header uses 1320px.
- **Radius:** `--radius-sm` 8, `--radius-md` 12, `--radius-lg` 18, `--radius-xl` 24, `--radius-pill`.
  - Cards use 12–18.
  - The hero image uses 24.
  - Inputs use 8.
- **Shadows:** `--shadow-xs` (cards: almost invisible), `--shadow-md` (hover), `--shadow-lg` (dropdowns, drawers,
  dialogs).
- **Motion:** 160–300ms (`--dur-fast`, `--dur`, `--dur-slow`).
  - Cards lift 2px.
  - Arrows (`.arrow`) move 3px.
  - Dropdowns fade in.
  - The drawer slides in.
  - Everything is switched off with `prefers-reduced-motion`.

## Components

- **Section head:** `.section-head` > `.section-eyebrow` + `.section-title` (serif) + `.section-description`,
  with an optional action on the right.
- **Buttons:**
  - `.button`: navy action.
  - `.button-primary`: terracotta CTA.
  - `.button-secondary` and `.button-quiet`: outline.
  - `.button-ghost`.
  - `.button-danger`: semantic red.
  - `.button-sm`.
  - All are at least 44px tall.
- **Cards:** `.card`, `.card-interactive` (lifts on hover), `.card-muted`, `.card-feature` (terracotta top line).
- **Pills:** `.pill`, `.pill-info`, `.pill-brand`, `.pill-success`, `.pill-warning`, `.pill-danger`,
  `.demo-pill`, and the track pills.
- **Filters:** `.filter-chip`. When selected it uses `aria-pressed="true"` or `.is-active`, and turns soft
  terracotta.
- **States:** `.empty-state` (icon, short explanation, one action), `.feedback-error|success|info|warning`.
- **Focus:** one 3px blue ring with a 2px offset (`--color-focus`) everywhere, in both themes.
- **Editorial accent:** `.brand-rule` (a thin terracotta line) and the hero eyebrow's terracotta dash. Use rarely.

## Navigation (site-nav.js)

| Group | Items |
|---|---|
| Academics | Study Plan, Tracks, Timetable, Exams, Calendar |
| Resources | Notes & Resources, Thesis, Useful Links |
| Community | Students, Announcements (Join the Directory belongs here too) |
| Life | City Guide |
| About | |

- **Wide screens:** dropdowns with an icon, label and one line of description. The current page gets a thin
  terracotta underline.
- **900px and below:** a drawer from the right. It contains the brand, search, every group, a theme switch,
  Join, Privacy and Contact. It behaves as a modal: focus stays inside, Escape and the backdrop close it, and
  the page behind does not scroll.
- **Header actions:** search, Join the Directory (hidden on the Join page and below 1080px), the theme button
  and the phone menu.
- **No account UI:** there is no login yet.

## Dark mode

A parallel palette, not an inversion: deep navy-grey surfaces (#111827 / #182230 / #202B3A), light text,
lighter blue / terracotta / green / purple, and lighter track colours.

- Photos are not darkened.
- The hero keeps its navy overlay.
- Filled terracotta buttons use dark text in dark mode.
- The token blocks under `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]` must stay
  identical.

## Browser theme colour

`<meta name="theme-color">` is #0F2B5B (light) / #091D3A (dark) on every page.
`manifest.webmanifest`: theme #0F2B5B, background #F7F5F1.

## Academic companion pages

Academic Rules and Programme Journey share `academic-pages.css` and `academic-pages.js`.
Their page-specific details live in `academic-rules.css` and `journey.css`; the global shell and
colour tokens still come from `style.css`.

- An editorial serif heading sits beside one navy overview panel. Terracotta marks section
  numbers and the active location, while blue remains the interaction colour.
- A sticky contents rail sits beside the reading column on desktop. At 860px and below it
  becomes a horizontally scrollable rail beneath the site header. The active item stays visible
  without moving the page away from the reader's section.
- Choosing a section updates its deep link and moves keyboard focus to the destination.
  Scrolling updates the active location only. Back/Forward and old nested deep links still work.
- University rules use native disclosures with an expand/collapse-all control. Deep links open
  the required dossier. Printing temporarily opens all dossiers and restores their prior state.
- Source badges use 11px text, a smaller dot and restrained padding. Full source names and
  verification dates remain visible and wrap naturally; they are never truncated or tooltip-only.
- Journey keeps the shared native track choice and shows the four-semester city route alongside
  the detailed timeline. Its Welcome Days figures remain explicitly labelled as a historical snapshot.
- All interactions retain visible keyboard focus, comfortable touch targets, both themes and
  reduced-motion support. These pages do not introduce a new storage system or remote tracking.

## Support, Contact and Privacy

These pages reuse the academic companion's editorial hero, palette, local fonts and compact sources.
`support.css`, `contact.css` and `privacy.css` keep their refinements scoped to the relevant page;
the shared header and existing academic pages are unchanged.

- Support and Privacy use the same sticky contents rail and focused deep links. Support keeps
  emergency information visible and presents university contacts as native disclosures.
- Contact has a shorter two-column layout: a navy inbox panel, four topic links, message tips
  and a university-support route. Every email action works without JavaScript; copying adds
  a status announcement and a manual fallback when clipboard access fails.
- Privacy groups storage and service requests into readable definition lists. It separates
  current features from prepared registration terms, which can be opened individually or together.
  The full notice prints, including normally closed terms, and restores the prior reading state.
- A notice of inactive registration is textually explicit; its amber rule is supplementary.
  Main content and source references remain readable in both themes and on narrow screens.

## Accessibility notes

Contrast was checked for the main pairs (WCAG AA 4.5:1 for text):
- Secondary text on ivory: 4.57.
- Links on ivory: 5.83.
- White on the CTA terracotta: 4.55.
- Track text on its soft background: ≥ 4.8.
- All dark-mode pairs: ≥ 5.3.

`--text-muted` (#8A94A6, 3.1:1) is only for decorative dashes and placeholders, never for information.
