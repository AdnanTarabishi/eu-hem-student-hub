# Editor dashboard (`admin.html`)

Approved editors sign in with an emailed one-time link and write announcements. An admin reviews and
publishes them. This is the first piece of Phase 2 (login + database), agreed on 7 October 2026: the
backend is **Supabase** (a hosted PostgreSQL database with logins).

## How it fits together

```
Editor (admin.html) ──writes──▶ Supabase database ──every 15 min──▶ GitHub robot ──▶ data/announcements.csv ──▶ public site
```

- **The public site never reads Supabase directly.** The robot (`scripts/fetch-announcements.js`,
  `.github/workflows/update-announcements.yml`) copies the published announcements into
  `data/announcements.csv`, the same file the Google Sheet filled before. If Supabase is down or paused, the
  site keeps the last copy. Reading every 15 minutes also counts as activity, so the free project does not pause.
- **Statuses:** Draft → Waiting for review → Published → Archived. Editors write and submit; only admins publish.
- **Roles** (table `editors`): `admin` (everything) and `editor` (own drafts only). More roles from the vision
  (cohort admins, course editors) can be added later as new values.
- **Cohorts:** every announcement has a `cohort` (`2026-2028`). The site shows the cohort in `supabase-config.js`.

| What | File |
|---|---|
| Database tables and security rules | `supabase/schema.sql` |
| Public connection settings (no secrets) | `supabase-config.js` |
| Shared rules: categories, validation, CSV | `editor-data.js` |
| The dashboard | `admin.html`, `admin.js`, `admin.css` |
| Supabase's official browser library (MIT, v2.117.3) | `vendor/supabase/` |
| Robot that copies published announcements | `scripts/fetch-announcements.js` |
| One-time import of the current announcements | `scripts/announcements-to-sql.js` |
| Tests | `tests/editor/` (`npm run test:editor`) |

## Security in short

- **Row Level Security (RLS)** is on for both tables. The database itself refuses anything the rules in
  `schema.sql` do not allow, whatever the browser sends. Hiding buttons in `admin.js` is only for convenience.
- The **publishable key** in `supabase-config.js` is public by design: with it, anyone can read *published*
  announcements, nothing else.
- The **secret key** (`service_role`) bypasses every rule. It must never be in this repository, in a page or
  in a chat. Nothing here needs it.
- Sign-up is switched **off**: the sign-in form never creates accounts. Only an admin adds editors.
- Never write phone numbers or private emails in an announcement: published text is public.

## Setup (once)

1. **Create the project.** Sign in at <https://supabase.com> with `euhem.studenthub@gmail.com` (so the Hub
   does not depend on a personal account) → *New project*: name `eu-hem-student-hub`, region **Central EU
   (Frankfurt)** (data stays in the EU), a strong database password saved in a password manager, Free plan.
2. **Create the tables.** *SQL Editor* → *New query* → paste all of `supabase/schema.sql` → *Run*. It should
   say "Success. No rows returned". Running it again later is safe.
3. **Login settings.** *Authentication*:
   - *Sign In / Providers*: Email on; **"Allow new users to sign up" off**.
   - *URL Configuration*: Site URL `https://adnantarabishi.github.io/eu-hem-student-hub/admin.html`;
     Redirect URLs: the same address, and `http://localhost:8000/admin.html` for local tests.
4. **Create your account.** *Authentication* → *Users* → *Add user* → *Create new user*: the email you will
   sign in with, tick *Auto Confirm User*. Use the address of your Supabase account (see "Emails" below).
5. **Make yourself admin.** In the SQL Editor (change the email):
   ```sql
   insert into public.editors (user_id, email, display_name, role)
   select id, email, 'Student Hub team', 'admin' from auth.users where email = 'euhem.studenthub@gmail.com';
   ```
6. **Move the current announcements.** On your computer: `node scripts/announcements-to-sql.js > announcements-import.sql`,
   open the file, paste it into the SQL Editor, *Run*, then delete the file. Do this once.
7. **Connect the site.** *Project Settings* → *Data API* (Project URL) and *API Keys* (publishable key) →
   paste both into `supabase-config.js` → `node scripts/stamp-versions.js` → commit and merge to main.
   From the next robot run on, announcements come from the dashboard. Stop editing the Google Sheet then
   (keep it as a backup).
8. **Test.** Open `admin.html`, sign in, write a draft, publish it, and check the Announcements page about
   15 minutes later (or run *Actions → Update announcements → Run workflow*).

## Emails (important before adding other editors)

Supabase's built-in email sender only delivers to members of the Supabase team and only about 2 emails per
hour ([docs](https://supabase.com/docs/guides/auth/auth-smtp)). That is enough for the admin alone. Before
inviting other editors, connect a real sender: *Authentication* → *Emails* → *SMTP Settings*, for example the
Student Hub Gmail with an app password, or a free transactional email service. Turn off link tracking in that
service: it breaks one-time links.

## Adding or removing an editor

- Add: *Authentication* → *Users* → *Add user* (auto confirm), then in the SQL Editor:
  ```sql
  insert into public.editors (user_id, email, display_name, role)
  select id, email, 'Student Hub team', 'editor' from auth.users where email = 'new.editor@example.com';
  ```
- Remove: `delete from public.editors where email = 'old.editor@example.com';` (their drafts stay), and delete
  the user under *Authentication* → *Users*.

## Changing the categories

Change the list in **both** `editor-data.js` (`CATEGORIES`) and the `category` check in `supabase/schema.sql`,
then run the changed part of the schema in the SQL Editor:

```sql
alter table public.announcements drop constraint announcements_category_check;
alter table public.announcements add constraint announcements_category_check check (category in ('Urgent', …));
```

`npm run test:editor` fails if the two lists differ.

## Next steps (not built yet)

- Useful links and Roadmap updates in the dashboard.
- The student dashboard (personal home page). It starts without login, saved on the device.
