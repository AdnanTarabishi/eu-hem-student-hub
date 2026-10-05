# Directory backend: Google Apps Script setup

`Code.gs` receives the form, checks it, stores it in a private Google Sheet,
stores the optional photo in a private Drive folder, and emails a confirmation
link to the student's university address.

No ID or secret is written in the code. Everything is a Script Property.

## 1. Lock the storage first

- Google Sheet → Share → General access → **Restricted**.
- Create a Drive folder such as `EU-HEM Directory Photos (private)` → **Restricted**.

Check in a private browser window that the Sheet link shows "You need access".

## 2. Create the script

1. Open script.google.com → New project.
2. Replace the editor content with `Code.gs`.
3. Project Settings → Script Properties → add:

| Property | Value |
|---|---|
| `SPREADSHEET_ID` | from the Sheet address, between `/d/` and `/edit` |
| `PHOTO_FOLDER_ID` | from the folder address, after `/folders/` (leave out to disable photos) |
| `ALLOWED_EMAIL_DOMAINS` | `studio.unibo.it` (comma-separated if more) |
| `REQUIRE_EMAIL_CONFIRMATION` | `true` |
| `COLLECT_PHONE` | `false` |
| `CONTACT_EMAIL` | the address students should write to (optional) |

## 3. Run setup once

In the editor choose the function `setup` and press Run. Google asks for
permission to use Sheets, Drive and to send email as you. Accept.
`setup` creates the `Submissions` tab and any missing column headers.
The execution log should end with "Setup OK".

## 4. Deploy

Deploy → New deployment → type **Web app**.

- Execute as: **Me**
- Who has access: **Anyone**

"Anyone" is required so students can submit without a Google login. It gives
access only to this script's two functions, never to the Sheet or the folder.

Copy the Web app address ending in `/exec` into `directory-config.js`.

## 5. Test with dummy data before telling anyone

- a minimal profile, and one with every field
- "Other" as academic field
- a photo
- public, EU-HEM only, and hidden profiles
- a non-university email (must be refused)
- the same email twice (must be refused)
- a name starting with `=` (must appear as text in the Sheet)
- the confirmation email arrives at a real @studio.unibo.it inbox, and the link
  changes Status from `unconfirmed` to `pending`
- on a phone

Delete the test rows and test photos afterwards.

## Status values

`unconfirmed` → the student has not opened the email link yet
`pending` → email confirmed, waiting for your review
`approved` / `rejected` → set by you, by hand

Never approve an `unconfirmed` row without checking with the student: anyone
can type someone else's email address.

## Limits built in

- 60 submissions per hour, 400 rows in total (edit `SETTINGS` to change).
- Photos up to 2 MB, JPEG/PNG/WebP, checked by file signature.
- Gmail lets a personal account send about 100 emails a day. If that runs out,
  the profile is still saved and `Confirm Email Sent` shows `failed`.

## Changing the code later

Deploy → Manage deployments → edit the existing deployment → Version: New
version → Deploy. The `/exec` address stays the same.

## Every two weeks (Student Hub addition)

The confirmation email and the privacy page promise that unconfirmed submissions are deleted.
`Code.gs` does not do this automatically, so do it by hand:

- Filter `Status` = `unconfirmed` and delete every row whose `Submitted At` is more than 14 days ago,
  together with its photo (`Photo Drive File ID`). Then empty the Drive bin.

## When the privacy text changes (Student Hub addition)

If the Student Directory section of `privacy.html` changes **meaning** (new field, new use, new place
where data is stored, longer keeping), change the consent version in **both** files, to the same value:

- `CONSENT_VERSION` in `SETTINGS` in `Code.gs` (then deploy a new version, see above)
- `consentVersion` in `directory-config.js` on the website

Old forms still open in someone's browser are then refused with "The privacy information has changed",
so nobody joins under text they have not seen. `node scripts/check-content.js` fails if the two differ.

## Deleting a student's data

Delete the row in the Sheet and the photo file named in `Photo Drive File ID`,
then empty the Drive bin.

## Never

- publish the `Submissions` tab or export it as a public CSV
- commit the Sheet ID or folder ID to the repository
- load this Sheet from the website
