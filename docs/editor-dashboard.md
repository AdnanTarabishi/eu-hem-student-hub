# Editor dashboard (`admin.html`)

Approved editors sign in with an emailed one-time link, write announcements and events, and an admin
reviews and publishes them. This is the first piece of Phase 2 (login + database), agreed on 7 October 2026:
the backend is **Supabase** (a hosted PostgreSQL database with logins).

## Sections

| Section | Who | What |
|---|---|---|
| **Overview** | everyone | Numbers at a glance, what needs attention (waiting for review, sent back to you, Urgent banners, items about to expire), whether the public site already shows what is published, recent activity |
| **Announcements** | everyone | Status tabs, search, category filter, form with a **live preview** (exactly the public card, including the red Urgent banner), character counters, Duplicate |
| **Events** | everyone | Student and social events (date, times, place, description, link). Published ones appear under **Community events** on `calendar.html` until they are over |
| **Team** | admins | Add people, change role or “Posted by” name, remove. The last admin can never be removed |
| **Activity** | everyone | Who created, edited, sent, published, sent back (with the note), archived or deleted what. Written by the database itself; nobody can edit it |

**Safety nets in the form:**
- **Privacy guard:** a phone number or a private email address in the text shows a warning next to the
  preview, and sending or publishing then asks “anyway?”. Insecure `http://` links and Urgent without an end
  date are flagged too. Dates, times and the Student Hub's own address are not flagged.
- **Edit conflicts:** if someone else changed an item since you opened it, your save is refused instead of
  silently overwriting their work (the database compares the item's last-changed time). Your text is kept.
- **Never lose text:** Cancel and Escape ask before throwing away changes, and while you type a copy is kept in
  this browser. After a closed tab or a crash, opening the form offers “Restore it”. The copies are removed
  after saving and when you sign out.

**For students:** every Community event has **Add to calendar**, which downloads the event as an `.ics` file
for Google, Apple or Outlook calendars (`icsFor()` in `events.js`).

**The review flow** (announcements and events): Draft → Waiting for review → Published → Archived.
Editors write and send for review; only admins publish. An admin can **send something back with a note**:
the editor sees the note on the item and on their Overview, and it disappears once the item is published.

**Backups (admins):** *Overview* → *Download a backup* saves everything (drafts, published and archived
items, the team, the activity log) as one JSON file. Do it now and then, for example monthly: as far as we know, the
free Supabase plan keeps no backups you can download, and the robot's copies on GitHub contain only published items.
The file contains editors' emails and unpublished drafts, so keep it private.

## How it fits together

```
Editor (admin.html) ──writes──▶ Supabase database ──every 15 min──▶ GitHub robot ──▶ data/announcements.csv
                                                                                └──▶ data/events.json ──▶ public site
```

- **The public site never reads Supabase directly.** The robot (`scripts/fetch-announcements.js`,
  `.github/workflows/update-announcements.yml`) copies the published items into the site's own files. If
  Supabase is down or paused, the site keeps the last copy. Reading every 15 minutes also counts as activity,
  so the free project does not pause.
- **Cohorts:** every row has a `cohort` (`2026-2028`). The site shows the cohort in `supabase-config.js`.
- **Adding another kind of content** (for example useful links): a table in `schema.sql` (add its name to the
  loop in section 3), an entry in `CONTENT_TYPES` in `editor-data.js`, a preview in `admin-content.js`, a
  panel in `admin.html`, and an export in the robot.

| What | File |
|---|---|
| Database: tables, security rules, activity log, team functions | `supabase/schema.sql` |
| Public connection settings (no secrets) | `supabase-config.js` |
| Shared rules: content types, fields, validation, CSV/JSON export | `editor-data.js` |
| The dashboard | `admin.html`, `admin.css`, `admin.js` (app, overview, team, activity), `admin-content.js` (lists, forms, previews), `admin-kit.js` (helpers) |
| Community events on the Calendar page (also the dashboard preview) | `events.js`, `events.css` |
| Supabase's official browser library (MIT, v2.117.3) | `vendor/supabase/` |
| Robot that copies published items | `scripts/fetch-announcements.js` |
| One-time import of the current announcements | `scripts/announcements-to-sql.js` |
| Tests | `tests/editor/` (`npm run test:editor`) |

## Security in short

- **Row Level Security (RLS)** is on for every table. The database itself refuses anything the rules in
  `schema.sql` do not allow, whatever the browser sends. Hiding buttons in the dashboard is only for convenience.
- The **publishable key** in `supabase-config.js` is public by design: with it, anyone can read *published*
  announcements and events, nothing else.
- The **secret key** (`service_role`) bypasses every rule. It must never be in this repository, in a page or
  in a chat. Nothing here needs it.
- Sign-up is switched **off**: the sign-in form never creates accounts. Only an admin adds people to the team.
- Bookkeeping can't be faked: who created an item, who approved it and when are set by the database.
- Never write phone numbers or private emails in an announcement or event: published text is public.

**Tested:** `tests/editor/schema.test.mjs` runs `schema.sql` on a real PostgreSQL engine (PGlite, a
development-only tool) and tries 43 allowed and forbidden actions as a visitor, two editors and an admin.

## Setup (once)

1. **Create the project.** Sign in at <https://supabase.com> with `euhem.studenthub@gmail.com` (so the Hub
   does not depend on a personal account) → *New project*: name `eu-hem-student-hub`, region **Central EU
   (Frankfurt)** (data stays in the EU), a strong database password saved in a password manager, Free plan.
2. **Create the tables.** *SQL Editor* → *New query* → paste all of `supabase/schema.sql` → *Run*. It should
   say "Success. No rows returned". Running it again later is safe (do it after every change to the file).
3. **Login settings.** *Authentication*:
   - *Sign In / Providers*: Email on; **"Allow new users to sign up" off**.
   - *URL Configuration*: Site URL `https://adnantarabishi.github.io/eu-hem-student-hub/admin.html`;
     Redirect URLs: the same address, and `http://localhost:8000/admin.html` for local tests.
4. **Create your account.** *Authentication* → *Users* → *Add user* → *Create new user*: the email you will
   sign in with, tick *Auto Confirm User*. Use the address of your Supabase account (see "Emails" below).
5. **Make yourself admin** (the only time SQL is needed for the team; afterwards use the Team section).
   In the SQL Editor (change the email):
   ```sql
   insert into public.editors (user_id, email, display_name, role)
   select id, email, 'Student Hub team', 'admin' from auth.users where email = 'euhem.studenthub@gmail.com';
   ```
6. **Move the current announcements.** On your computer: `node scripts/announcements-to-sql.js > announcements-import.sql`,
   open the file, paste it into the SQL Editor, *Run*, then delete the file. Do this once.
7. **Connect the site.** *Project Settings* → *Data API* (Project URL) and *API Keys* (publishable key) →
   paste both into `supabase-config.js` → `node scripts/stamp-versions.js` → commit and merge to main.
   From the next robot run on, announcements and events come from the dashboard. Stop editing the Google
   Sheet then (keep it as a backup).
8. **Test.** Open `admin.html`, sign in, write a draft, publish it, and watch “On the public site” on the
   Overview turn green after about 15 minutes (or run *Actions → Update announcements → Run workflow*).

## Emails (important before adding other editors)

Supabase's built-in email sender only delivers to members of the Supabase team and only about 2 emails per
hour ([docs](https://supabase.com/docs/guides/auth/auth-smtp)). That is enough for the admin alone. Before
inviting other editors, connect a real sender: *Authentication* → *Emails* → *SMTP Settings*, for example the
Student Hub Gmail with an app password, or a free transactional email service. Turn off link tracking in that
service: it breaks one-time links.

## Adding or removing people

1. *Supabase* → *Authentication* → *Users* → *Add user* → *Create new user* (tick *Auto Confirm User*).
2. *Dashboard* → *Team* → *Add someone*: their email, the name shown as “Posted by”, and the role.

To remove someone: *Team* → *Remove from team* (their published items stay). To also delete their account,
delete the user under *Authentication* → *Users*.

## Changing the categories

Change the list in **both** `editor-data.js` (`ANNOUNCEMENT_CATEGORIES` or `EVENT_CATEGORIES`) and the
`category` check in `supabase/schema.sql`, then update the database in the SQL Editor, for example:

```sql
alter table public.events drop constraint events_category_check;
alter table public.events add constraint events_category_check check (category in ('Social', …));
```

`npm run test:editor` fails if the lists differ.

## Next steps (not built yet)

- Useful links and resources in the dashboard.
- The student dashboard (personal home page). It starts without login, saved on the device.
- Optional: email notifications to admins when something is waiting for review.
