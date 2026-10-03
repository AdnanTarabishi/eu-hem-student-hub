# The Student Hub for EU-HEM — Vision & Roadmap

Unofficial student-run platform — not affiliated with or operated by EU-HEM or its partner universities.

## Vision
One place for EU-HEM students: people, studies, files, dates, cities, experiences and activities.
Think Notion + Google Drive + Calendar + Student Directory + WhatsApp community + AI assistant, designed specifically for EU-HEM.

## Guiding principles
1. Useful alone first: build features that help a single student (timetable, exams, city guides) before social features that need many users.
2. Complement WhatsApp, don't replace it (e.g. a weekly digest that links back to the hub).
3. Privacy by design (GDPR):
   - Login only with a university email.
   - Every personal field (phone, email, etc.) is opt-in.
   - Users can delete their account and all their data.
   - A clear, simple privacy policy.
   - No photos of people without their consent.
   - Collect only the data we actually need.
4. Respect content rights: official lectures, slides and recordings stay on Virtuale. Link to them, never re-upload. AI summaries only of student-created content.
5. Multi-cohort from day one: every piece of data belongs to a cohort, so the archive builds itself.
6. Sustainability: roles (Super Admin, Cohort admins, Course editors, Event editors), the repository moved later to a GitHub Organization, and clear documentation so future students can take over.
7. Mobile-first. Installable on phones (PWA) later.
8. Measure usage with privacy-friendly analytics and improve what students actually use.

## Modules

### 1. Dashboard
- Personal home page after login: next lecture, countdown to the next exam, latest files, upcoming events, new announcements, personal to-do list.
- Announcements: categories (University, Student, Social, Academic, Urgent), with pinning.

### 2. Calendar & Exams
- Unified calendar: lectures, exams, assignments, workshops, social events, university deadlines, holidays.
- Filters by university, course and year.
- Subscribe / add to Google, Apple or Outlook Calendar (ICS feed).
- Exam & Deadline Center: countdown, exam type, location, registration deadline, materials allowed, syllabus covered, linked files.
- Events & RSVP: Going / Maybe / Not going, attendee list, student-created events, photos after the event.

### 3. Academics
- One page per course: syllabus, professors, links to official materials on Virtuale, books, supporting materials, assignments, deadlines, student notes, useful links.
- Shared knowledge: wiki-style lecture summaries by students, key concepts, "the professor emphasized these points", 👍 votes on useful summaries.
- Smart search across students, courses, files, cities, events and links.

### 4. People
- Profile (mini internal LinkedIn): name, country, previous studies, preferred track / mobility track, languages, LinkedIn, professional and research interests, skills (R, Stata, Python...), bio, social links. Phone and university email are opt-in.
- Student directory with search and filters (e.g. "students speaking Italian", "interested in healthcare management").
- Interactive world map: click a country to see its students and what they can help with ("I can help with...").
- Find people: study, research, running, trip, roommate, football, gym, Italian practice partners.
- Later: export a "Cohort Book".

### 5. Life & Mobility
- City guides for each program city (Bologna, Oslo, Innsbruck, Rotterdam...): housing, transport, SIM, banks, groceries, gyms, cafés, libraries, study places, healthcare, residence permits, useful apps, cost of living, discounts, student tips. Kept up to date by students.
- EU-HEM Survival Guide from past cohorts: where they lived, electives, hardest courses, city costs, internships, thesis, mobility experience, "What I wish I knew before starting".
- Mobility Planner (later, not needed now): a checklist for each move (housing, residence permit, registration, insurance, travel, documents, deadlines).

### 6. Community
- Opportunities board: internships, research positions, Erasmus, scholarships, conferences, student jobs, thesis opportunities, traineeships. Students can add opportunities.
- Polls and feedback, including anonymous polls.
- Gallery: Cohort → City → Event, with consent.
- Weekly digest.

### Cross-cutting: Admin & moderation
Roles listed above, plus moderation of user-submitted content.

### Later: AI assistant
Answers students' questions using the hub's own content. Must be cost-aware.

## Phases
- Phase 1 (now, no login, static site on GitHub Pages): live timetable (done), Exam & Deadline Center, city guides, announcements, useful links, calendar subscription.
- Phase 2 (login + database): university-email login, profiles, directory, world map, course pages with student notes. Needs a backend (candidate: Supabase). Decision to be made together with Adnan.
- Phase 3: events and RSVP, opportunities board, polls, find people, admin roles, weekly digest.
- Phase 4: AI assistant, smart search, gallery, Survival Guide archive, Cohort Book, Mobility Planner.
