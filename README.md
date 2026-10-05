# EU-HEM Student Hub

A free, volunteer website for students of the EU-HEM master's program (European Health Economics & Management), University of Bologna and partner universities.

**Live site:** https://adnantarabishi.github.io/eu-hem-student-hub/

## What's on it
- **Homepage:** a hero with the cohort photo and cohort numbers, "This Week" (today's classes, next exam, your plan, announcements), Explore, a Notes & Resources preview, Meet the Cohort, and the programme's cities; returning students (with a saved study plan) get a shorter hero
- **Study Plan & Progress:** plan your courses with the official rules (CFU, required and optional groups), track each course (Studying → Exam booked → Passed) and see a timeline. A planning tool only: it does not submit anything.
- **Tracks** (`tracks.html`): the four specialisation tracks (EEH, E&P, MHI, PHM) from the official 2026 overview: journey, courses per semester with exact elective rules, a factual comparison, "My track" (saved on this device only), cities, careers and an informal student-built quiz
- **Past Thesis Explorer** (`thesis.html`): search and filter thesis titles from earlier cohorts (an informal list shared by a previous student, with the old six-track structure), for inspiration
- **Timetable** (`timetable.html`): 1st-year classes loaded live from the official UniBo timetable, in a Week or List view, with "My courses only", room map links and "add this class to my calendar"
- **Exams** (`exams.html`): 1st-year exam dates with countdown and registration status (opens / open / closed), loaded live from the official UniBo exam dates page
- Calendar subscription (Google, Apple, Outlook): one calendar with every course, or one with exactly your study plan
- One page per course: Overview, Schedule, Exam, Topics, Key Concepts, Practice, Resources
- Notes & Resources: student-made notes, flashcards, practice questions and a shared glossary (pilot: Fundamentals in Health Economics)
- City guides for Bologna, Oslo, Rotterdam and Innsbruck (permits, housing, healthcare, transport, study places and more)
- **Students explorer** (`students.html`): community map, profile cards and list, filters and privacy-aware statistics, currently a **demo with 40 fictional people** (`data/demo-students.json`)
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

**Saved in the browser only (localStorage):** study plan choices and statuses, Notes progress,
My Study List, theme, timetable view, welcome checklist. Nothing is sent anywhere.

The header, main menu and footer are drawn on every page by `site-nav.js`.

**Homepage settings:** the photo, cohort numbers and programme end date are in one block at the
top of `home.js` (`HERO_IMAGE`, `STUDENT_COUNT`, `COUNTRY_COUNT`, `TRACK_COUNT`, `PROGRAM_END_DATE`).
For a new photo, put the JPG in `assets/images/` with WebP copies named `<name>-640.webp`,
`<name>-960.webp` and `<name>-1280.webp`. The photo credit is at the bottom of `index.html`.

**Design system:** the brand palette (terracotta, ink, warm paper) is at the top of `style.css` as
`--brand-…` variables; every other colour, size, corner and shadow variable builds on it (light and dark mode).
Fonts: Inter for text and Source Serif 4 for big titles, stored in `fonts/` (no Google Fonts, so no visitor data goes to Google).
Icons: `icons.svg` (from Lucide), used as `<svg class="icon"><use href="icons.svg#calendar"></use></svg>`.
Shared helpers (toasts, skeletons, add-to-calendar files, map links) are in `ui.js`.
Check colour contrast (WCAG AA, light and dark): `node scripts/check-contrast.js`.

**App and offline:** `manifest.webmanifest` (name, icons in `img/`) makes the site installable;
`sw.js` (service worker) keeps copies of the site files, and of the data for offline use;
`pwa.js` handles installing, the "Update available" message and the offline banner.
When you add a new page or script, add it to `SITE_FILES` in `sw.js`.

**After changing any .html, .css or .js file, run `node scripts/stamp-versions.js`.**
It adds `?v=…` fingerprints to the links in every page and updates the version in `sw.js`,
so visitors get the new files at once (and installed apps show "Update available").
`check-content.js` warns when you forgot.

## Notes & Resources
Study content (notes, flashcards, questions, concepts, resources) lives in `content/modules/`
as JSON and Markdown files. Adding content never requires code changes.
- Format and examples: [docs/content-format.md](docs/content-format.md)
- Easiest way to write a flashcard, question, concept or resource: the form at `create.html`
- Features: topic notes with formulas and diagrams, spaced-repetition flashcards, quizzes,
  progress tracking and search. Progress is saved only in each student's browser.
- Check content before committing: `node scripts/check-content.js`

## Announcements
Announcements come from a CSV set by `ANNOUNCEMENTS_URL` at the top of `announcements.js`
(currently fictional demo data in `data/sample-announcements.csv`).
To use a Google Sheet, publish it as CSV (File → Share → Publish to web → CSV) and paste the link there.

Sheet columns (any order): `Date | Title | Category | Message | Link | Pinned | Expires | Posted by`
- **Category:** University, Academic, Student, Social or Urgent. An active Urgent announcement shows a red banner on every page.
- **Dates:** format the Date and Expires columns as `yyyy-mm-dd` (Format → Number → Custom date and time). `dd/mm/yyyy` also works.
- **Expires:** optional. The announcement is shown through that day and hidden from the next day.
  A Date in the future hides the announcement until that day (scheduled posts).
- **Pinned:** `Yes` (or a ticked checkbox) shows it first.
- **Link:** optional, must start with `https://`.
- **"New" badge:** posted today or in the previous 2 days.
- Don't put personal data (phone numbers, private emails) in announcements: the published sheet is public.

## Students directory and privacy
The Students explorer (`students.html`) shows **only fictional demo data** in Phase 1
(`data/demo-students.json`, made by `node scripts/build-demo-students.js`). All privacy rules live in
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

## Privacy and contact pages
`privacy.html` was written from what the code does and approved on 5 October 2026. Keep it in sync when the code changes.
`contact.html` and the "Who is responsible" section of `privacy.html` give the Student Hub email, euhem.studenthub@gmail.com.

## City guides
`city-guide.html` shows the index of all cities (with a comparison table and "Your next city" for
students who saved a track); `city-guide.html?city=oslo` shows one city. Each guide is a Markdown file
in `docs/content/`, listed in `guide-data.js`. Which tracks study in a city always comes from
`content/tracks.json`. How to update a price, add a student tip or add a city: `docs/city-guides.md`.
