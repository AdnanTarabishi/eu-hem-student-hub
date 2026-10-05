# Student Directory: the "Join the Directory" form (onboarding v3)

People register with the Student Hub through **join.html**, reached from the "Join the directory" button on the
Students page. The page has no menu entry of its own, and search engines are asked not to list it (`noindex`).
This is the first step towards a future Student Hub account; there is **no login, dashboard or profile editor
yet**, and nothing is published automatically.

## Who can register (user types)
| Stored id | Shown as | Student Directory |
|---|---|---|
| `current_student` | Current EU-HEM student | eligible |
| `alumni` | EU-HEM alumnus / former student | eligible |
| `shared_course_student` | Student from another programme | **never** (private admin data) |
| `faculty_staff` | Faculty, staff or programme partner | **never** (private admin data) |

**Directory eligibility is decided by the server** (`Code.gs` → `OPTIONS.directoryEligible`). Anything the
browser sends about eligibility is ignored. For the two non-eligible types the server also forces
`Profile Visibility`, `Photo Visibility` and `LinkedIn Visibility` to `hidden`, drops any photo, and stores the
statistics answer as `not asked`.

## How the pieces fit together
| Piece | File | Notes |
|---|---|---|
| The form | `join.html`, `join.js` | Shows only the fields of the chosen user type (`data-roles`, `data-when`) |
| Its styles | `join.css` | Every rule is scoped to `.directory-join` and uses the site's colours |
| The choices | `directory-options.js` | Stable ids and labels; the **same lists** as `OPTIONS` and `VIS_RULES` in `Code.gs` (the checker compares them) |
| Settings (public) | `directory-config.js` | `endpoint`, consent version, the cohort lists |
| The backend | `integrations/directory-apps-script/Code.gs` | Pasted into Google Apps Script. **No IDs or secrets** in the file |
| Backend setup | `integrations/directory-apps-script/README.md` | Step by step, plus the fortnightly clean-up |
| Tests | `tests/directory/` | Backend logic against in-memory stand-ins for Google; the form in a real browser |
| Privacy text | `privacy.html#student-directory` | Rewritten for v2, revised 5 October 2026; v3 additions (mobility experience) 6 October 2026 |

Track names: the current tracks (`eeh`, `ep`, `mhi`, `phm`) come from `content/tracks.json`; the checker makes
sure `Code.gs` uses the same names. The legacy specialisations for alumni (`dmh` Decision Making in Healthcare,
`gh` Global Health, `hfm` Healthcare Finance and Management) use the names of the Past Thesis Explorer. Legacy
specialisations are never converted into current tracks.

Shared courses: the checkboxes list the Semester 1 courses of `content/programme.json`, plus a free-text
"another course" box.

Cohorts: `directory-config.js` → `cohorts` (`current`, `upcoming`, `alumni`). Each year, add the new cohort
to `current` and move the graduated one to the top of `alumni`. People not listed choose "Other / not listed".

### How a registration travels
1. The person chooses how they are connected to EU-HEM, then fills in three steps. `join.js` checks the
   visible answers and shrinks the photo in the browser (this also removes its location data).
2. On submit, `join.js` sends one `fetch` POST to the `endpoint`, with only the fields of that user type. The
   body is JSON sent as `text/plain`, a "simple request", so no CORS preflight is needed.
3. Google runs `doPost` in `Code.gs` **as the Student Hub account** ("Execute as: Me"). It checks everything
   again, saves a row in the private Sheet (photo in the private Drive folder) and emails a confirmation link.
4. The link opens a page with a **"Confirm my email"** button. Only the button (a `google.script.run` call to
   `confirmEmailFromPage`) confirms the address; opening the link changes nothing, so email security scanners
   that open links cannot confirm anyone.
5. An administrator then reviews the row (see "Statuses" below). The website never stores or shows the data.

## Three separate states: email verified ≠ EU-HEM role verified ≠ admin approved
| State | Column(s) | Values | Set by |
|---|---|---|---|
| **Email verified** | `Email Confirmed At` (and `Status` unconfirmed → pending) | date | the script, only when the "Confirm my email" button is pressed |
| **EU-HEM role verified** | `Role Verification Status`, `Role Verified At` | `pending` → `verified` / `rejected`; date | an admin, by hand |
| **Admin approved** | `Status` | `pending` → `approved` / `rejected` (+ `Approved At` or `Rejected At`) | an admin, by hand |

They never change each other: confirming an email does not verify the role or approve the row, and verifying
the role does not approve it. Nothing the browser sends can set any of them (tested in
`tests/directory/backend.test.js`). A confirmed email means only that the person controls that address; never
approve someone because their email is confirmed.

**Future publishing rules (not built yet, nothing is published now):**
- Public profile: `Directory Eligible` TRUE, `Profile Visibility` public, email confirmed, role `verified`,
  `Status` approved.
- EU-HEM-only profile: the same with visibility public or cohort, **and** a logged-in, verified EU-HEM viewer
  (secure login does not exist yet; do not fake it).
- Public photo: all of the public-profile rules **and** `Photo Visibility` public.

## Sheet columns
The 41 columns of onboarding v1 keep their order. v2 appends 15 columns at the end: `User Type`, `Directory
Eligible`, `EU-HEM Cohort`, `Home Institution`, `Home Programme`, `Programme Role`, `Courses / Areas
Involved`, `Shared Courses`, `Feature Interests`, `Feature Suggestion`, `Role Verification Status`, `Role
Verified At`, and three dates an admin fills in for the retention rules: `Rejected At`, `Last Reconfirmed At`
(alumni), `Participation Ends` (end of the course / academic period for shared-course students; last confirmed
involvement for staff). Running `setup()` adds missing columns at the end and never moves or rewrites old rows; old rows
simply have empty new columns.

**v3 appends 7 more columns** (63 in total): `Citizenship Group`, `Citizenship Visibility`, `Study Visa
Experience`, `Study Visa Experience Scope`, `Study Visa Experience Visibility`, `Mobility Statistics Consent`,
`Field Visibility JSON`. Values (ids, see the Options tab):
- `Citizenship Group`: `eu_eea_swiss`, `non_eu_eea_swiss`, `prefer_not_to_say`, or `not_provided` (skipped).
  Never filled in from the country or any other column.
- `Study Visa Experience`: `yes`, `no`, `not_sure`, `not_applicable`, `prefer_not_to_say` or `not_provided`.
  `Study Visa Experience Scope` is `first_semester_italy` when answered (the only question asked so far).
  Self-reported; never derived from citizenship.
- `Citizenship Visibility`, `Study Visa Experience Visibility`: `private` (default) or `cohort` (verified EU-HEM
  students). Never public. Forced to `private` for a hidden profile, a skipped question or "Prefer not to say".
- `Mobility Statistics Consent`: `yes` only after an explicit tick; otherwise `no`. Separate from
  `Anonymous Aggregated Statistics Consent`.
- `Field Visibility JSON`: e.g. `{"country":"public","field":"public","degree":"cohort","university":"public","track":"public","bio":"hidden"}`.
  A missing value counts as `hidden`; nothing is wider than the profile (see the table below).
- Shared-course students and staff: all seven are empty.

**Upgrading an existing Sheet:** run `setup()` (adds the columns), then `migrateV3()` once. It fills only
**empty** cells of old rows: citizenship and visa `not_provided`, both visibilities `private`, mobility consent
`no` (never backfilled), every per-detail visibility `hidden`. It never overwrites an answer and never infers
anything, and running it again changes nothing. Because older rows get `hidden` per-detail settings, an older
public profile would show only the name until the person chooses again (correct, since they never chose).

What some columns hold:
- `University Email`: the registration email of every user type (the name is kept for old rows).
- `Home Institution`: the home institution of a shared-course student, or the institution / organisation of
  faculty and staff.
- `Previous Academic Field`, `Previous Degree`, `Programme Role`, `EU-HEM Track`: the **label** of the chosen
  id (for example "Nursing & Midwifery"); "Other" is stored as `Other: <their text>`. The id ↔ label lists are
  in the **Options** tab and in `directory-options.js`.
- `Feature Interests`: the chosen feature **ids**, separated by **comma + space** (for example
  `timetable, thesis, other`). The optional "Other" text is in `Feature Suggestion`.
- `Shared Courses`: course names separated by **semicolon + space**; a typed course is `Other: <text>`.

**Deprecated for onboarding v2** (kept for old rows, left empty by v2): `Professional Interests`, `Research
Interests`, `Languages`, `Hobbies / Interests`, `I Can Help With`, `I'd Like to Connect About`, `Instagram`,
`Phone / WhatsApp`, `Instagram Visibility`, `Phone / WhatsApp Visibility`.

The **Options** tab is rewritten by `setup()`: every allowed value with its stored id and label (user types,
academic fields, current and legacy tracks, degrees, roles, features, visibility, role verification). It holds
no student data.

## Retention schedule
The values live in **one place in the code**: `RETENTION` in `Code.gs`. The confirmation link, the
`retentionReport()` admin function and the tests read them from there. This table and the privacy page
(`data-retention` spans) show the same values, and `scripts/check-content.js` fails if any of them differ. To
change a period: change `RETENTION`, this table and the privacy page, then run the checks.

| Key in `RETENTION` | Value | Rule |
|---|---|---|
| `unconfirmedDays` | 14 | Unconfirmed registration deleted, with its photo, this many days after submission (also how long the confirmation link works) |
| `rejectedDays` | 30 | Rejected / invalid registration deleted this many days after `Rejected At`, unless a privacy or support request is still open |
| `studentMonthsAfterGraduation` | 6 | Current students kept while enrolled, then up to this many months after expected graduation; invite them to continue as alumni first. If they explicitly choose to, change `User Type` to `alumni` and fill in `Last Reconfirmed At` |
| `graduationMonthDay` | 09-30 | Expected graduation: this day of the cohort's final year (2026–2028 → 30 September 2028) |
| `alumniMonths` | 24 | Alumni kept at most this many months after the last confirmation or reconfirmation (`Last Reconfirmed At`, else `Email Confirmed At`) |
| `reminderDays` | 60 | Reminder window: alumni are asked to reconfirm (and graduating students invited to stay as alumni) this many days before the end; no reply → delete |
| `sharedCourseMonths` | 12 | Shared-course students deleted this many months after `Participation Ends` (end of the course / academic period), unless another active use was explicitly agreed |
| `staffMonthsAfterInvolvement` | 12 | Faculty / staff / partners kept while involved and up to this many months after `Participation Ends` (last confirmed involvement) |
| `deletionRequestDays` | 30 | Withdrawal or deletion request: profile and photo deleted without unnecessary delay, at the latest within this many days, unless a legal reason requires keeping a specific record |

**How to apply it:** run `retentionReport()` in the Apps Script editor every two weeks. It lists each row that
is due (`delete`), needs a reminder (`ask`) or needs a missing date (`fill`), using row numbers and
registration ids only. It deletes nothing: delete the row and its photo by hand, then empty the Drive bin. Once a
year, also review all registrations and delete those no longer needed.

## Privacy rules (the same table in the form and the server)
| Profile | Countries, background, degree, university, track, bio, photo, LinkedIn | Email | Citizenship group, study-visa experience |
|---|---|---|---|
| Public | public / EU-HEM only / hidden | EU-HEM only / hidden | private / EU-HEM only |
| EU-HEM students only | EU-HEM only / hidden | EU-HEM only / hidden | private / EU-HEM only |
| Do not publish yet | hidden | hidden | private |

No profile option is preselected; the email defaults to hidden and can never be public. The server clamps any
other request to the next more private value. In the form, details the person does not touch follow the profile;
a detail they set by hand is never widened when they change the profile (it is narrowed if the profile allows
less, and comes back if the profile allows it again). The form shows a final summary of every setting.

"EU-HEM members / students only" means: verified participating EU-HEM students and alumni across the supported
cohorts, checked by the Student Hub administrator. Not staff, not shared-course students. Widening it needs a
privacy-text change and a new consent version.

## The consent version (change it in both places)
`directory-config.js` → `consentVersion` and `Code.gs` → `SETTINGS.CONSENT_VERSION` must be identical. It is
**`directory-v3-2026-10`** since onboarding v3 (optional citizenship group and study-visa experience, mobility
statistics consent, per-detail visibility). v2 was `directory-v2-2026-10`; earlier registrations keep the version
they agreed to and are never treated as having accepted v3.

When the privacy section changes **meaning** (a new field, purpose, storage place, keeping data longer, a new
visibility option), change both to the same new value and deploy a new version of the script. Forms still open
in someone's browser are then refused with "The privacy information has changed".

## Safety checks built into `scripts/check-content.js`
- The consent versions match.
- `endpoint` is empty, or a `https://script.google.com/macros/s/…/exec` address.
- The form can't be switched on while `contact.html` or `privacy.html` has a placeholder, or while the Contact
  page has no email (mailto) link.
- No Google Sheet or Drive folder ID appears in the directory files.
- Nothing still restricts registration to @studio.unibo.it (v1).
- `Code.gs` keeps the 41 v1 columns in order, has every v2 and v3 column, and no column twice.
- Citizenship and visa answers can only be private or EU-HEM only (`OPTIONS.mobilityVisibility`); a hidden
  profile shows nothing; only a public profile may have public details.
- `directory-options.js` has exactly the backend's `OPTIONS` and `VIS_RULES`; email is never public; only a
  public profile may have public details; students and alumni are eligible, the other two types are not.
- The current track names in `Code.gs` match `content/tracks.json`.
- The retention values on the privacy page and in this document equal `RETENTION` in `Code.gs`.

## Going live (in this order)
1. **Use a dedicated Student Hub Google account** (done: **euhem.studenthub@gmail.com**). Do every step below
   **signed in to that account**, never a personal one.
2. **Create (or transfer) the private Sheet and the private photo folder under that account** (backend README,
   step 1).
3. **Deploy the Apps Script from that account** (backend README, steps 2–4). The account that deploys Apps
   Script is the account that sends the confirmation emails (MailApp), so a personal account would show its
   address to everyone.
4. **Set the Script Property `CONTACT_EMAIL`** to `euhem.studenthub@gmail.com` and run `setup()`.
5. Paste the `/exec` address into `directory-config.js` → `endpoint`. Run `node scripts/check-content.js`
   and `node scripts/stamp-versions.js`.
6. **Test the email confirmation** with dummy registrations (backend README, step 5): open the link, check the
   row stays `unconfirmed`, press the button, check it becomes `pending`. Then delete the test rows and photos.
7. Do not enable the form in production with a personal sender account or without a real contact email.
8. Merge to `main`, and only then share the link.

## Running the tests
One-time setup: `npm install` (Playwright, which drives your installed Chrome). Then:
```
npm test
```
This runs the content checker, the backend checks (`tests/directory/backend.test.js`), the form in a browser
(`tests/directory/browser.test.js`), the Students explorer (`tests/students/`) and the City Guide checks. They use in-memory stand-ins for Google's
services, so they do **not** replace a real test of the deployed Web App.

## Not built yet (later phases)
Real login, accounts and passwords, a dashboard or profile editor, publishing real public or EU-HEM-only
profiles (the Students explorer shows fictional demo data only, see docs/students-explorer.md), an automatic
Sheet → public JSON export, permissions, matching and alumni messaging.
