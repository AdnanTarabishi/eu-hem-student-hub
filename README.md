# EU-HEM Student Hub

A free, volunteer website for students of the EU-HEM master's program (European Health Economics & Management), University of Bologna and partner universities.

**Live site:** https://adnantarabishi.github.io/eu-hem-student-hub/

## What's on it
- 1st-year class timetable, loaded live from the official UniBo timetable
- 1st-year exam dates with countdown and registration status, loaded live from the official UniBo exam dates page
- Calendar subscription (Google, Apple, Outlook) with classes, exams and registration deadlines
- City guide for Bologna (housing, transport, healthcare, documents, study places and more)
- Students directory, currently a **demo with fictional data** (`data/sample-students.csv`)
- Notes, summaries and student resources (coming soon)
- Useful links, including Virtuale for official course materials

## Disclaimer
This is an **unofficial student project**. It is not affiliated with or endorsed by the University of Bologna or any partner university. Always check official university sources for authoritative information.

## Tech
Plain HTML, CSS and JavaScript, hosted on GitHub Pages.

The calendar file in `calendar/` is rebuilt every 6 hours by a GitHub Actions workflow
(`.github/workflows/update-calendar.yml`) running `scripts/build-calendar.js`.
To rebuild it yourself: `node scripts/build-calendar.js` (needs Node.js 18 or newer).

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
The directory page reads a CSV file set by `DATA_SOURCE_URL` at the top of `students.js`.
It currently uses fictional demo data. Before using real data:
- Only students who **gave consent** may appear.
- Google Sheets "Publish to web" makes the **whole tab public**. Publish a separate tab with only
  consenting students and only the 4 directory columns, never the raw form responses (emails, timestamps).
- Never commit real student data to this repository. `private-data/` and `*.private.csv` are git-ignored.

## Adding a city guide
City guides are Markdown files shown by one template page, `city-guide.html`.
1. Write the guide as `docs/content/<city>-guide.md`, using the same structure as
   `docs/content/bologna-guide.md` (a `>` "Last checked" + disclaimer block under the title,
   then numbered `##` sections).
2. Add one line for the city to `CITY_GUIDES` in `guide.js`.
3. The guide is then at `city-guide.html?city=<city>`.
