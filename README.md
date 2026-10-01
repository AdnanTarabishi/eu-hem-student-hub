# EU-HEM Student Hub

A free, volunteer website for students of the EU-HEM master's program (European Health Economics & Management), University of Bologna and partner universities.

**Live site:** https://adnantarabishi.github.io/eu-hem-student-hub/

## What's on it
- 1st-year class timetable, loaded live from the official UniBo timetable
- 1st-year exam dates with countdown and registration status, loaded live from the official UniBo exam dates page
- Calendar subscription (Google, Apple, Outlook) with classes, exams and registration deadlines
- City guide for Bologna (housing, transport, healthcare, documents, study places and more)
- Notes, summaries and student resources (coming soon)
- Useful links, including Virtuale for official course materials

## Disclaimer
This is an **unofficial student project**. It is not affiliated with or endorsed by the University of Bologna or any partner university. Always check official university sources for authoritative information.

## Tech
Plain HTML, CSS and JavaScript, hosted on GitHub Pages.

The calendar file in `calendar/` is rebuilt every 6 hours by a GitHub Actions workflow
(`.github/workflows/update-calendar.yml`) running `scripts/build-calendar.js`.
To rebuild it yourself: `node scripts/build-calendar.js` (needs Node.js 18 or newer).

## Adding a city guide
City guides are Markdown files shown by one template page, `city-guide.html`.
1. Write the guide as `docs/content/<city>-guide.md`, using the same structure as
   `docs/content/bologna-guide.md` (a `>` "Last checked" + disclaimer block under the title,
   then numbered `##` sections).
2. Add one line for the city to `CITY_GUIDES` in `guide.js`.
3. The guide is then at `city-guide.html?city=<city>`.
