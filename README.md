# EU-HEM Student Hub

A free, volunteer website for students of the EU-HEM master's program (European Health Economics & Management), University of Bologna and partner universities.

**Live site:** https://adnantarabishi.github.io/eu-hem-student-hub/

## What's on it
- 1st-year class timetable, loaded live from the official UniBo timetable
- 1st-year exam dates with countdown and registration status, loaded live from the official UniBo exam dates page
- Calendar subscription (Google, Apple, Outlook) with classes, exams and registration deadlines
- Notes, summaries and student resources (coming soon)
- Useful links, including Virtuale for official course materials

## Disclaimer
This is an **unofficial student project**. It is not affiliated with or endorsed by the University of Bologna or any partner university. Always check official university sources for authoritative information.

## Tech
Plain HTML, CSS and JavaScript, hosted on GitHub Pages.

The calendar file in `calendar/` is rebuilt every 6 hours by a GitHub Actions workflow
(`.github/workflows/update-calendar.yml`) running `scripts/build-calendar.js`.
To rebuild it yourself: `node scripts/build-calendar.js` (needs Node.js 18 or newer).
