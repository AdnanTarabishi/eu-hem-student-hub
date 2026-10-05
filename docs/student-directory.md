# Student Directory: the "Join the Directory" form (onboarding v2)

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
| Privacy text | `privacy.html#student-directory` | Rewritten for v2 on 5 October 2026, **waiting for review** |

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

## Statuses: email, role and review are separate
| Column | Values | Set by |
|---|---|---|
| `Status` | `unconfirmed` → `pending` → `approved` / `rejected` | script (first two), admin (last two) |
| `Email Confirmed At` | date | script, when the confirm button is pressed |
| `Role Verification Status` | `pending` → `verified` / `rejected` | admin only, by hand |
| `Role Verified At` | date | admin only, by hand |

A confirmed email means only that the person controls that address. **Role verification** means an admin has
checked their relationship with EU-HEM. Never approve someone because their email is confirmed.

**Future publishing rules (not built yet, nothing is published now):**
- Public profile: `Directory Eligible` TRUE, `Profile Visibility` public, email confirmed, role `verified`,
  `Status` approved.
- EU-HEM-only profile: the same with visibility public or cohort, **and** a logged-in, verified EU-HEM viewer
  (secure login does not exist yet; do not fake it).
- Public photo: all of the public-profile rules **and** `Photo Visibility` public.

## Sheet columns
The 41 columns of onboarding v1 keep their order. v2 appends 12 columns at the end: `User Type`, `Directory
Eligible`, `EU-HEM Cohort`, `Home Institution`, `Home Programme`, `Programme Role`, `Courses / Areas
Involved`, `Shared Courses`, `Feature Interests`, `Feature Suggestion`, `Role Verification Status`, `Role
Verified At`. Running `setup()` adds missing columns at the end and never moves or rewrites old rows; old rows
simply have empty new columns.

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

## Privacy rules (the same table in the form and the server)
| Profile | Photo | LinkedIn | Email |
|---|---|---|---|
| Public | public / EU-HEM only / hidden | public / EU-HEM only / hidden | EU-HEM only / hidden |
| EU-HEM students only | EU-HEM only / hidden | EU-HEM only / hidden | EU-HEM only / hidden |
| Do not publish yet | hidden | hidden | hidden |

No profile option is preselected; the email defaults to hidden and can never be public. The server clamps any
other request to the next more private value.

## The consent version (change it in both places)
`directory-config.js` → `consentVersion` and `Code.gs` → `SETTINGS.CONSENT_VERSION` must be identical. It is
**`directory-v2-2026-10`** since onboarding v2 (new user types, fields, purposes and confirmation flow).

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
- `Code.gs` keeps the 41 v1 columns in order and has every v2 column.
- `directory-options.js` has exactly the backend's `OPTIONS` and `VIS_RULES`; email is never public; only a
  public profile may have public details; students and alumni are eligible, the other two types are not.
- The current track names in `Code.gs` match `content/tracks.json`.

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
(`tests/directory/browser.test.js`) and the City Guide checks. They use in-memory stand-ins for Google's
services, so they do **not** replace a real test of the deployed Web App.

## Not built yet (later phases)
Real login, accounts and passwords, a dashboard or profile editor, the interactive cohort map, publishing public
or EU-HEM-only profiles, an automatic Sheet → public JSON export, permissions, matching and alumni messaging.
