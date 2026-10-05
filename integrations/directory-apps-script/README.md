# Registration backend: Google Apps Script setup (onboarding v2)

`Code.gs` receives the "Join the Directory" form, checks it again on the server, stores it in a private
Google Sheet, stores the optional photo in a private Drive folder, and emails a confirmation link.

No ID or secret is written in the code. Everything is a Script Property.

## 0. Use the dedicated Student Hub Google account

**Do every step below signed in as the Student Hub account (euhem.studenthub@gmail.com), never a personal
account.** The account that deploys Apps Script is the account that sends the confirmation emails (MailApp):
students see its address as the sender. That account should own the Sheet, the photo folder, the script and
therefore the emails. Do not use a personal sender account in production.

Tip: sign in in an Incognito window with only that account, so Google cannot switch to another one.

## 1. Lock the storage first

- Create the Google Sheet under the Student Hub account → Share → General access → **Restricted**.
- Create a Drive folder such as `EU-HEM Directory Photos (private)` → **Restricted**. Never "Anyone with the link".

Check in a private browser window that the Sheet link shows "You need access".

## 2. Create the script

1. Open script.google.com → New project.
2. Replace the editor content with `Code.gs`.
3. Project Settings → Script Properties → add:

| Property | Value |
|---|---|
| `SPREADSHEET_ID` | from the Sheet address, between `/d/` and `/edit` |
| `PHOTO_FOLDER_ID` | from the folder address, after `/folders/` (leave out to disable photos) |
| `CONTACT_EMAIL` | `euhem.studenthub@gmail.com` (shown in emails as the address to write to) |
| `REQUIRE_EMAIL_CONFIRMATION` | `true` |

`ALLOWED_EMAIL_DOMAINS` and `COLLECT_PHONE` from onboarding v1 are no longer used; delete them if they exist.
Any email domain is accepted (alumni may no longer have a university address).

## 3. Run setup once (and after every update of Code.gs)

In the editor choose the function `setup` and press Run. Google asks for permission to use Sheets, Drive and
to send email as the Student Hub account. Accept. `setup`:

- creates the `Submissions` tab, or adds any **missing columns at the end** (old columns and rows are never
  moved or rewritten; upgrading from v1 adds the 12 v2 columns);
- rewrites the human-readable `Options` tab (every allowed value with its id; no student data).

The execution log should end with "Setup OK" and show your contact email (not "NOT SET").

## 4. Deploy

Deploy → New deployment → type **Web app**.

- Execute as: **Me** (the Student Hub account)
- Who has access: **Anyone**

"Anyone" is required so people can register without a Google login. It gives access only to this script's
entry points (submit, the confirmation page and its button), never to the Sheet or the folder.

Copy the Web app address ending in `/exec` into `directory-config.js`.

## 5. Test with dummy data before telling anyone

- each user type: current student, alumnus (with a legacy specialisation), student from another programme,
  faculty with an "Other" role
- "I haven't chosen my track yet" and "Prefer not to share"
- "Other" as academic field and as degree
- a photo; public, EU-HEM only and hidden profiles
- feature chips with "Other"
- the same email twice (must be refused)
- a name starting with `=` (must appear as text in the Sheet)
- **email confirmation**: open the link from a real inbox → the page shows a button and the row is still
  `unconfirmed`; press "Confirm my email" → the row becomes `pending` and `Email Confirmed At` is filled;
  `Role Verification Status` stays `pending`; opening the link again says it is already confirmed
- on a phone

Delete the test rows and test photos afterwards.

## Status values

| Column | Values |
|---|---|
| `Status` | `unconfirmed` (email not confirmed yet) → `pending` (confirmed, waiting for review) → `approved` / `rejected` (set by you) |
| `Role Verification Status` | `pending` (every new row) → `verified` / `rejected` (set by you after checking the person's connection to EU-HEM) |

Fill `Role Verified At` when you verify. Confirming an email is **not** role verification: anyone can type
someone else's address, and a confirmed address only shows control of that inbox. Never approve a row whose role
you have not verified.

Students from another programme and faculty/staff (`Directory Eligible` FALSE) never go into the Student
Directory, whatever their status.

## Limits built in

- 60 registrations per hour, 400 rows in total (edit `SETTINGS` to change).
- Photos up to 2 MB, JPEG/PNG/WebP, checked by file signature; only for students and alumni.
- Gmail lets a consumer account send about 100 emails a day. If that runs out, the registration is still saved
  and `Confirm Email Sent` shows `failed`.

## Changing the code later

Paste the new `Code.gs`, run `setup()` again, then Deploy → Manage deployments → edit the existing deployment →
Version: New version → Deploy. The `/exec` address stays the same.

## Every two weeks (Student Hub addition)

The confirmation email and the privacy page promise that unconfirmed registrations are deleted.
`Code.gs` does not do this automatically, so do it by hand:

- Filter `Status` = `unconfirmed` and delete every row whose `Submitted At` is more than 14 days ago,
  together with its photo (`Photo Drive File ID`). Then empty the Drive bin.

## Once a year (Student Hub addition)

The privacy page promises a yearly review of alumni, shared-course and staff registrations: delete those that
are no longer needed. Current students' data is deleted at the latest when their cohort graduates.

## When the privacy text changes (Student Hub addition)

If the Student Directory section of `privacy.html` changes **meaning** (new field, new use, new place where
data is stored, longer keeping), change the consent version in **both** files, to the same value:

- `CONSENT_VERSION` in `SETTINGS` in `Code.gs` (then deploy a new version, see above)
- `consentVersion` in `directory-config.js` on the website

Old forms still open in someone's browser are then refused with "The privacy information has changed",
so nobody joins under text they have not seen. `node scripts/check-content.js` fails if the two differ.

## Deleting someone's data

Delete the row in the Sheet and the photo file named in `Photo Drive File ID`, then empty the Drive bin.

## Never

- publish the `Submissions` tab, export it as a public CSV, or create a public gviz/JSON view of it
- commit the Sheet ID or folder ID to the repository
- load this Sheet from the website
- share the photo folder or a photo with "Anyone with the link"
