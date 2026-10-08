# EU-HEM Student Hub

A free, volunteer website for students of the EU-HEM master's program (European Health Economics & Management), University of Bologna and partner universities.

**Live site:** https://adnantarabishi.github.io/eu-hem-student-hub/

## What's on it
- **Homepage:** a hero with the cohort photo and cohort numbers, day-by-day class browsing and upcoming-exam browsing within "This Week", your plan, an illustrated news carousel with pause controls, Explore, Meet the Cohort, city guides, and the roadmap's estimated progress; returning students with a saved study plan get a shorter hero. The timetable and exam cards retain the saved-course filter; pointer effects and news rotation respect reduced-motion preferences.
- **Study Plan & Progress:** plan your courses with the official rules (CFU, required and optional groups), track each course (Studying → Exam booked → Passed) and see a timeline. A planning tool only: it does not submit anything.
- **Tracks** (`tracks.html`): the four specialisation tracks (EEH, E&P, MHI, PHM) from the official 2026 overview: journey, courses per semester with exact elective rules, a factual comparison, "My track" (saved on this device only), cities, careers and an informal student-built quiz
- **Past Thesis Explorer** (`thesis.html`): search and filter thesis titles from earlier cohorts (an informal list shared by a previous student, with the old six-track structure), for inspiration
- **Timetable** (`timetable.html`): 1st-year classes loaded live from the official UniBo timetable, in a Week or List view, with "My courses only", room map links and "add this class to my calendar"
- **Exams** (`exams.html`): 1st-year exam dates with countdown and registration status (opens / open / closed), loaded live from the official UniBo exam dates page
- Calendar subscription (Google, Apple, Outlook): one calendar with every course, or one with exactly your study plan
- One page per course: Overview, Schedule, Exam, Topics, Key Concepts, Practice, Resources
- Notes & Resources: student-made notes, flashcards, practice questions and a shared glossary (pilot: Fundamentals in Health Economics)
- **Student Toolkit** (`toolkit.html`): a curated catalogue, collections, local lists and comparisons; statistical method guidance, 52 Excel recipes and health-economics calculators; plus seven working tools for economics graphs, sample precision, study sessions, city budgets, moving, document dates and career applications ([docs/student-toolkit-v4.md](docs/student-toolkit-v4.md)).
- **City guides** for Bologna, Oslo, Rotterdam and Innsbruck: illustrated covers, eight practical topics, within-guide search, saved sections on your device, contextual facts and a city comparison.
- **Roadmap & Updates** (`roadmap.html`): current work, next and following release targets, later ideas and deployment-backed releases, from `content/roadmap.json` and `content/updates.json`. Planned release windows stay separate from what is already available ([docs/roadmap.md](docs/roadmap.md)).
- **Students explorer** (`students.html`): a country-of-origin atlas from the supplied 2026–2028 aggregate counts, plus profile cards, list, filters and privacy-aware directory statistics. Individual profiles remain a **demo with 40 fictional people** (`data/demo-students.json`)
- **Editor dashboard** (`admin.html`, not in the menu): approved editors sign in with an emailed link and write announcements and events (shown as Community events on the Calendar page); admins review, publish and manage the team; an activity log records every change. Backend: Supabase (first Phase 2 piece); a robot copies published announcements into `data/announcements.csv` ([docs/editor-dashboard.md](docs/editor-dashboard.md)). Not connected yet: until then announcements still come from the Google Sheet
- Useful links, including Virtuale for official course materials
- **Search the whole site** with the 🔍 button, Ctrl+K (⌘K on Mac) or `/`
- **Installable app that works offline** (on phones: "Install app" / "Add to Home Screen")

## Disclaimer
This is an **unofficial student project**. It is not affiliated with or endorsed by the University of Bologna or any partner university. Always check official university sources for authoritative information.

## Tech
Plain HTML, CSS and JavaScript, hosted on GitHub Pages. Preview locally: `node scripts/preview.js`,
then open http://localhost:8000.

**One shared course data file:** `content/programme.json` holds every course, module, professor,
teaching period and the study plan rules. Every section reads it; nothing about courses is
written anywhere else. Check it with `node scripts/check-content.js`, and compare it with the
live UniBo timetable with `node scripts/check-programme.js`.

**Calendars** in `calendar/` are rebuilt every 6 hours by a GitHub Actions workflow
(`.github/workflows/update-calendar.yml`) running `scripts/build-calendar.js`: the full
calendar plus one calendar per possible study plan. To rebuild them yourself:
`node scripts/build-calendar.js` (needs Node.js 18 or newer).

**Saved in the browser only (localStorage):** study plans and course statuses, Notes progress,
My Study List, chosen track, Thesis workspace, Toolkit lists and explicitly saved planners,
saved guide sections/stories, feature-specific drafts and display preferences. The Hub does not
automatically upload these choices. Exports, email and calendar actions use the destinations
chosen by the visitor; backups are specific to each feature. The Privacy page describes the
current local, tab-only and in-memory cases.

The header, main menu and footer are drawn on every page by `site-nav.js`.

**Homepage settings:** the photo, track count and programme end date are in one block at the
top of `home.js` (`HERO_IMAGE`, `TRACK_COUNT`, `PROGRAM_END_DATE`).
For a new photo, put the JPG in `assets/images/` with WebP copies named `<name>-640.webp`,
`<name>-960.webp` and `<name>-1280.webp`. The photo credit is at the bottom of `index.html`.
Check the homepage with `node tests/home/browser.test.js .`; focused browsing and carousel checks
are `node tests/home/dashboard-nav.test.js .` and `node tests/home/news-carousel.test.js .`.
They use fictional feeds and the project's Playwright development tool.

**Cohort origins:** `cohort-data.js` is the shared aggregate source for the homepage and the
interactive atlas on `students.html#sx-map-section`. It contains the supplied 2026–2028
country-of-origin counts and source notation, “103+2 pax”. The total (105 people), country
count (24) and continent count (5) are calculated from its 24 country rows. Update those rows
and the source metadata together; homepage figures and country highlights follow automatically.
The source does not explain the additional two people, so the interface says “people represented”.
Its EU, EEA outside the EU and Other countries groups classify countries of origin; they do not
establish anyone's citizenship or visa status. The homepage uses the local Natural Earth SVG
and flag atlas, then links to the full interactive overview. Individual profiles remain fictional
demo data and are independent of these supplied aggregate counts.

**Design system:** the brand palette (terracotta, ink, warm paper) is at the top of `style.css` as
`--brand-…` variables; every other colour, size, corner and shadow variable builds on it (light and dark mode).
Fonts: Inter for text and Source Serif 4 for big titles, stored in `fonts/` (loading them does not make a Google Fonts request).
Icons: `icons.svg` (from Lucide), used as `<svg class="icon"><use href="icons.svg#calendar"></use></svg>`.
The Student Hub's own logo is `img/student-hub-mark.svg`: the user-selected **Pulse to Growth**
design, a rising pulse inside a rounded square, adapted to navy, white and terracotta.
It is the unofficial project's own identity. The shared header, drawer and footer use
that vector, reversed on dark surfaces. `node scripts/make-app-icons.js` rebuilds the
app/browser icons and social-card mark and refreshes the shared logo's versioned address,
then `node scripts/make-social-image.js` renders the updated sharing image.
Shared helpers (toasts, skeletons, add-to-calendar files, map links) are in `ui.js`.
Check colour contrast (WCAG AA, light and dark): `node scripts/check-contrast.js`.

**Toolkit validation:** `npm run test:toolkit` checks the catalogue, planning/calculation
helpers and a real-browser workbench workflow, including mobile themes and offline reload.
It uses fictional entries and blocks external requests. Browser tests need installed Chromium
or Playwright's Chromium; no website installation or account is required.

**App and offline:** `manifest.webmanifest` (name, icons in `img/`) makes the site installable;
`sw.js` (service worker) keeps copies of the site files, and of the data for offline use;
`pwa.js` handles installing, the "Update available" message and the offline banner.
When you add a new page or script, add it to `SITE_FILES` in `sw.js`.

**After changing any .html, .css or .js file, run `node scripts/stamp-versions.js`.**
It adds `?v=…` fingerprints to the links in every page and updates the version in `sw.js`,
so visitors get the new files at once (and installed apps show "Update available").
`check-content.js` warns when you forgot.

**Social preview** (the card shown when a link is shared on WhatsApp, LinkedIn …):
every page has Open Graph tags pointing to `img/social-preview.png`.
After adding a page, changing a title or description, or moving to a new domain
(`siteUrl` in `content/settings.json`), run `node scripts/social-tags.js`.
To change the picture, edit `scripts/social/template.html` and run `node scripts/make-social-image.js`.

## Notes & Resources
Study content (notes, flashcards, questions, concepts, resources) lives in `content/modules/`
as JSON and Markdown files. Adding content never requires code changes.
- **Interactive lectures:** the course's Lectures tab opens original study guides,
  interactive activities and MCQ practice. Statistics for Healthcare covers
  Classes 1–6, with 20 MCQs each, probability and
  distribution explorers, descriptive summaries, sampling activities and a one-mean
  z/t test calculator. Upcoming classes remain labelled separately with Virtuale links.
  `lecture.html?topic=statistics.sampling` uses a reusable template;
  configuration and authoring instructions are in [docs/content-format.md](docs/content-format.md#interactive-lecture-pages).
  Quiz progress is saved on the student's device and included in Notes progress backups.
- Format and examples: [docs/content-format.md](docs/content-format.md)
- Easiest way to write a flashcard, question, concept or resource: the form at `create.html`
- Features: topic notes with formulas and diagrams, spaced-repetition flashcards, quizzes,
  progress tracking and search. Progress is saved only in each student's browser.
- The Notes library has a personal study snapshot, filters for content and teaching period,
  a saved-study-plan filter, course bookmarks and a remembered grid/list layout. Courses
  are grouped by their actual teaching blocks: current, upcoming and teaching completed.
  Each card shows module dates and the next exam, matched by official course codes.
  Exam dates can be refreshed from UniBo; if unavailable, the existing generated calendar
  is shown as a labelled copy with times to confirm. Missing dates are never inferred from
  the term's exam period. Date calculations use Bologna time and update in an open tab.
  Styles live in `notes-landing.css`, scheduling helpers in `notes-schedule.js`.
- Check scheduling, library interactions, responsive layouts and offline reload: `npm run test:notes`.
- Study tools share `study-practice.css`: course flashcards and question banks, lecture quizzes,
  statistics practice, lab checks and mock exams. Check recall, answer feedback, keyboard focus,
  mobile themes and offline delivery with `npm run test:practice`.
- Check content before committing: `node scripts/check-content.js`

## Announcements

The public site reads `data/announcements.csv`, set by `ANNOUNCEMENTS_URL` in `announcements.js`.
This is a local copy of the class Google Sheet, refreshed by `scripts/fetch-announcements.js`
through the **Update announcements** GitHub Actions workflow, scheduled every 15 minutes.
Edit announcements in the source Sheet; direct edits to the copied CSV will be replaced by the next sync.
If a refresh fails, the last successful copy stays available. The editor dashboard backend remains
unconnected; the newsroom redesign does not activate it or change the publishing source.

Sheet columns (any order): `Date | Title | Category | Message | Link | Pinned | Expires | Posted by`

- **Category:** Urgent, University, Academic, Student, Social, Programme, Student Hub or Student Community.
  Original source labels are retained, with a general style for unknown categories. An active Urgent
  announcement shows a red banner on every page.
- **Dates:** format the Date and Expires columns as `yyyy-mm-dd` (Format → Number → Custom date and time). `dd/mm/yyyy` also works.
- **Expires:** optional. The announcement is shown through that day and hidden from the next day.
  A Date in the future hides the announcement until that day (scheduled posts).
- **Pinned:** `Yes` (or a ticked checkbox) puts an item first in priority order, followed by newest date
  and then later same-day rows. The default featured update gives active Urgent items precedence.
- **Link:** optional, must start with `https://`.
- **"New" badge:** posted today or in the previous 2 days.
- Don't put personal data (phone numbers, private emails) in announcements: the published sheet is public.

The page uses its own `announcements-newsroom.js` and `announcements-newsroom.css`, reusing the shared
CSV and election helpers. Readers can search, filter by category or **New only**, sort by priority,
newest or oldest, and switch between grid and list layouts. Announcement dates use the shared
`announcementTodayKey()` helper in Europe/Rome for the newsroom, homepage loader and search.
Full updates open in a native dialog, preserving the approved election
candidate lists and results, stable announcement links, keyboard access and copy-link support.

Covers use original local SVG artwork matched to specific stories in JavaScript, with a general
decorative fallback. No image columns are required. Existing optional `Image`, `Image alt` and
`Image credit` columns can override the illustration with an approved local photo; remote image URLs
are not accepted. The homepage preview and site-wide search keep their existing source and links.
See [docs/announcements-newsroom.md](docs/announcements-newsroom.md) for cover rules and validation.

## Students directory and privacy
Individual profiles in the Students explorer (`students.html`) show **only fictional demo data** in Phase 1
(`data/demo-students.json`, made by `node scripts/build-demo-students.js`). The separate country-of-origin
atlas uses the supplied aggregate counts in `cohort-data.js`. All profile privacy rules live in
`students-data.js`; settings in `students-config.js`. Read [docs/students-explorer.md](docs/students-explorer.md)
before changing anything. In short:
- Never export the private registration Sheet to the site (no "Publish to web", CSV, gviz or JSON exports).
  Real profiles need the Phase 2 login and a server that applies the same privacy rules.
- Never commit real student data to this repository. `private-data/` and `*.private.csv` are git-ignored.

Current students, alumni, students from shared courses and staff register through **join.html** ("Join the
Directory", onboarding v3; only current students and alumni can be in the Directory), which sends to a private Google Apps Script
backend. It stays switched off until `endpoint` is set in `directory-config.js`. See
[docs/student-directory.md](docs/student-directory.md) for how it works, the go-live checklist and the tests
(`npm install` once, then `npm test`).

## Tracks page
Everything on `tracks.html` comes from **one file**, `content/tracks.json` (format and how to add next
year's cohort: [docs/tracks-format.md](docs/tracks-format.md)). Facts come from the official *EU-HEM tracks
overview 2026*; the PDF itself is never added to this repository or linked. Oslo courses use the University
of Oslo's official titles. Descriptions, "fit" statements and the quiz are written by students and labelled
as such. `check-content.js` validates the file, including sanity checks on key facts.

## Thesis page
`thesis.html` reads `content/thesis-archive.json`, which is **generated** from the thesis spreadsheet by
`node scripts/import-thesis.js "<path to .xlsx>"` (no library needed). Corrections and hidden records go in
`content/thesis-overrides.json`; synonyms, names and repository links in `content/thesis-config.json`.
Full guide: [docs/thesis-import.md](docs/thesis-import.md). The spreadsheet itself is not committed.

## Support, Contact and Privacy

`support.html` keeps its source-backed contact guide and university contacts in `content/people.json`.
Its six-section contents rail, native university disclosures and compact source labels reuse
`academic-pages.css` and `academic-pages.js`; `support.css` holds the page-specific presentation.
All questionnaire answers stay in memory. Emergency numbers still come from the City Guides.

`contact.html` includes a topic-aware on-site form for corrections, ideas, privacy requests and
contributions. Topic and message are required; name and reply email are optional. Fields and drafts
stay in page memory until Send, and only the selected topic's fields are submitted. A receipt is
shown only after a matching acknowledgement of private storage; interrupted attempts keep the text.

The separate `contact-config.js` connects the form to the Hub's verified private receiver.
Browser delivery and an unchanged retry were verified on 8 October 2026. Clearing the endpoint
disables the form and restores the email routes, which also work without JavaScript.
The receiver uses a restricted Google Sheet owned by `euhem.studenthub@gmail.com`; its
public endpoint can accept requests but cannot read the inbox. There is no automatic email sending.
It does not activate Directory, Supabase, editor sign-in or announcement publishing. Setup and the
actual-delivery checks are in [integrations/contact-apps-script/README.md](integrations/contact-apps-script/README.md).
Interaction details are in [docs/contact-forms.md](docs/contact-forms.md).

`privacy.html` was reviewed against the current code and updated on 8 October 2026. It distinguishes
the inactive Directory and editor connections, supplied origins totals, fictional demo profiles,
on-device tools, offline copies, service requests, voluntary email and the separate Contact form's
handling. Contact availability is derived from the same public configuration as the form.
Its seven native Directory
disclosures preserve consent v3, the existing fields/visibility and every retention value. A rollout
or substantive processing change needs a new review; see [docs/support-contact-privacy.md](docs/support-contact-privacy.md).

The **Check support and privacy pages** workflow checks the three pages in Chromium: complete
Support content and outcomes, section/history/focus, disclosures and printing, Contact mailto and
clipboard fallback, privacy-state/retention consistency and mobile light/dark layouts. The separate
**Check Contact forms** workflow tests private-receiver logic with fictional services and browser
submission states with an intercepted endpoint. Both save screenshots; mocked checks do not replace
the real deployment's private-storage and browser/CORS checks.

## Fundamentals of Statistics for Healthcare (96498)
`fund-statistics.html` is the study workspace for **Sara Capacci**, in `fund-quant-methods`.
The parent course overview uses `fund-course.js` and `fund-course.css` for a dedicated
course gateway: six topic destinations, direct study-tool links, both module facts,
the Statistics assessment summary and a next step based on shared Notes progress.
Its counts come from the module arrays and optional `course-study.json`; unavailable
metadata never blocks the course. The design is scoped to `fund-course-page`, leaving
the separate Forster course and other course renderers intact. The focused gateway
regression is `tests/fund-statistics/course.test.js` (included in the Fundamentals suite).
It is separate from Martin Forster's `statistics` module and study centre.
The six syllabus topics have original guides, 90 MCQs, 100 spaced-review cards, 24 concepts,
nine experiments and a 90-minute practice mock with self-assessed written interpretations.
Each guide adds two original worked healthcare cases, a comparison table and three
misconception explanations. The Worked cases view has 36 numerical checkpoints,
hints, Excel expressions and 12 self-assessed written reflections. The Choose a method
view checks design, normality and observed versus null counts before showing a recipe.
Cases live in `extended-practice.json`; `fund-statistics-practice.js` handles grading,
case state repair and method selection. Answers and reflections share the Notes backup
under `statistics["fund-statistics.cases"]`, preserving existing quiz/card IDs and answers.
The mock is illustrative: it does not reproduce the teacher's mock paper or predict a grade.
All six slide decks (274 slides) have been reviewed, including the 36-slide Topic 5 deck
added on 7 October 2026. Its guide compares critical values, p-values and mean CIs,
with an original interactive comparison of p-value and α tail areas.
The supplied lab files now support seven dataset guides and four interactive report readers,
with 22 additional reading checks, exact Excel ranges and independently checked aggregates.
`practical-study.json` stores the source-based teaching data; `fund-statistics-labs.js` handles
row inspection, confidence-level comparisons and repaired progress under
`statistics["fund-statistics.labs"]` in the shared Notes backup. Individual report CIs retain
their published endpoints and design cautions; advanced methods are reading context.
The complete mock paper, Nifedipine, SMOKE and inferential-lab answer files are still missing;
`content/modules/fund-statistics/course-study.json` explicitly records those gaps.
`source-review.json` documents 53 uploads across three batches (37 distinct files), 17 checked workbooks, four reports
(363 PDF pages extracted, methods and key tables reviewed), workbook summaries
and source discrepancies. Official slides, datasets and answer keys stay on Virtuale.
The heart-rate CSV is an original illustrative practice dataset.

Update content in `content/modules/fund-statistics/`; calculation methods are in
`fund-statistics-math.js`, registered widgets in `fund-statistics-activities.js`, and the
workspace in `fund-statistics.js`. Topic quizzes/cards share the existing Notes progress.
The timed mock uses tab-scoped `sessionStorage`, separate from progress backups.
Run `npm run test:fund-statistics`, then rebuild the content index and version stamps.

## City guides
`city-guide.html` shows the index of all cities (with a comparison table and "Your next city" for
students who saved a track); `city-guide.html?city=oslo` shows one city. Each guide is a Markdown file
in `docs/content/`, listed in `guide-data.js`. Which tracks study in a city always comes from
`content/tracks.json`. How to update a price, add a student tip or add a city: `docs/city-guides.md`.

Each city uses an illustrated cover and a fact strip, followed by eight topics: Overview, Arriving,
Housing, Transport, Everyday life, Study & social, Health & safety, and Sources. The complete
Markdown sections, original deep links, source labels and photograph credits remain available.
Search finds sections across the current guide; Saved shows its bookmarked sections together,
while the sidebar links to saved sections across all four cities. Bookmarks use
`euhem.guide.saved.v1` in local storage, with a session-only fallback when storage is blocked.
Read all and print expose the complete guide. The layout is scoped to `city-guide.css` and
supports narrow screens, light/dark themes, reduced motion and keyboard navigation.

The **Check city guides** workflow runs content validation and `tests/guide/browser.test.js`
in Chromium. It checks navigation, search, saved sections, sources, programme routes,
photograph credits, comparison data, mobile layouts and printing, and saves visual checks.

## Academic Rules and Programme Journey

`academic-rules.html` reads `content/academic-rules.json`; `journey.html` reads
`content/programme-events.json` and the shared track data. Both retain their existing deep links,
full source labels and official-source qualifications. See `docs/sources.md` for source handling.

The two pages share the editorial layout, sticky section navigation and compact source badges in
`academic-pages.css` and `academic-pages.js`. Page-specific presentation is in `academic-rules.css`
and `journey.css`. University dossiers can be opened individually or together, and old university
links open the right dossier automatically. The re-sit guide remains an in-memory questionnaire.
Journey's track picker uses the existing on-device track preference and updates both the route
and grant comparison. The Welcome Days numbers are a historical snapshot, linked to the current
cohort overview; the documented fees retain their academic-year scope.

The **Check academic pages** workflow runs content and contrast validation, the existing handbook
data tests and `tests/academic-pages/browser.test.js` in Chromium. It checks source preservation,
navigation and keyboard focus, university disclosures, re-sit outcomes, track persistence, mobile
layouts and the light/dark themes, and saves screenshots for visual review.
