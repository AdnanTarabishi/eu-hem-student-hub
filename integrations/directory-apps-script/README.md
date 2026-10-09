# Registration backend: Google Apps Script setup (onboarding v3)

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
3. Project Settings → **Show appsscript.json manifest file in editor**, then replace that file with
   the accompanying `appsscript.json`. It declares Sheets, Drive and confirmation-email permissions,
   the V8 runtime, and execution as the deploying account. Automatic exception logging is disabled.
4. Project Settings → Script Properties → add:

| Property | Value |
|---|---|
| `SPREADSHEET_ID` | from the Sheet address, between `/d/` and `/edit` |
| `PHOTO_FOLDER_ID` | from the folder address, after `/folders/` (leave out to disable photos) |
| `CONTACT_EMAIL` | `euhem.studenthub@gmail.com` (shown in emails as the address to write to) |
| `REQUIRE_EMAIL_CONFIRMATION` | `true` (optional: confirmation is on unless this is `false`) |

`ALLOWED_EMAIL_DOMAINS` and `COLLECT_PHONE` from onboarding v1 are **not read by the code any more**. If
they exist they have no effect, and they are safe to delete (a test checks this). Any email domain is accepted
(alumni may no longer have a university address).

## 3. Run setup once (and after every update of Code.gs)

Maintenance functions end in `_`, so anonymous visitors cannot call them through the email-confirmation
page's `google.script.run` API. They also do not appear in the editor's Run selector.

Create a **temporary** script file named `OwnerOnly.gs`, paste the following, save, select
`runDirectoryMaintenance`, then press Run:

```js
function runDirectoryMaintenance() {
  const account = 'euhem.studenthub@gmail.com';
  if (Session.getActiveUser().getEmail() !== account ||
      Session.getEffectiveUser().getEmail() !== account) {
    throw new Error('Run only from the Student Hub account in the Apps Script editor.');
  }
  return setup_();
}
```

Google asks for permission to use Sheets, Drive and to send email as the Student Hub account. Accept.
`setup_()`:

- creates the `Submissions` tab, or adds any **missing columns at the end** (old columns and rows are never
  moved or rewritten; upgrading from v1 adds the 15 v2 columns, from v2 the 7 v3 columns);
- rewrites the human-readable `Options` tab (every allowed value with its id; no student data).

The execution log should end with "Setup OK" and show your contact email (not "NOT SET").

**Only if the Sheet already has registrations from v2 (or v1):** after setup, replace `setup_()` in the
temporary wrapper with `migrateV3_()` and run it once. It fills only the empty v3 cells of old rows with "nothing given" values (`not_provided`, `private`, mobility
consent `no`, every per-detail visibility `hidden`), never changes an existing value and never infers citizenship
or visa answers. The log says how many rows were checked and cells filled. Running it again is harmless
("0 empty cell(s) filled").

**Delete the entire `OwnerOnly.gs` file and save before creating or updating any deployment.** The final
Run selector must contain only `doGet`, `doPost` and `confirmEmailFromPage`. Never deploy a maintenance wrapper.
For later maintenance, temporarily recreate it, run the chosen private helper, then remove it again.

## 4. Deploy

Deploy → New deployment → type **Web app**.

- Execute as: **Me** (the Student Hub account)
- Who has access: **Anyone**

"Anyone" is required so people can register without a Google login. It gives access only to this script's
entry points (submit, the confirmation page and its button), never to the Sheet or the folder.

Keep the website's endpoint empty until the checks below pass. Send the Web app address ending in `/exec`
to the developer for a candidate browser test; it is the public submission address, not a password.
Use a **separate Directory deployment**, not the Contact receiver.

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

The browser's success screen requires a readable receipt with this request's ID, consent version and
directory eligibility. A timeout or unreadable reply may happen after a row was saved: retry unchanged
answers with the same request ID, then check that there is exactly one row and one confirmation email.
The form preserves that uncertainty when offline and prevents changed answers from being silently
treated as the earlier registration. A failed confirmation email remains reported as failed on a retry.

### Candidate browser delivery through GitHub

The `Check Directory registration` workflow normally runs **only local fictional services**. Its manual
Run workflow screen can enable `run_live_delivery` with the owner-deployed `directory_endpoint`. This sends
one fictional hidden-profile registration, followed by one unchanged retry, at the website's actual origin
using the candidate Join files. It sends a confirmation email only to a plus-address of
`euhem.studenthub@gmail.com`; it submits no student information, photo or statistics consent.

The sanitized `directory-real-delivery` artifact records the fictional request ID, version, HTTP status and
matching receipts. It omits answers, email addresses, private storage IDs, confirmation tokens and temporary
Google response URLs. A passing browser check establishes readable delivery, not private row contents or
email ownership. The owner must still:

1. Inspect the restricted Sheet: exactly **one row** for the artifact's request ID, the fictional answers in
   their correct columns, `Status` unconfirmed, `Directory Eligible` TRUE and `Confirm Email Sent` yes.
2. Check the confirmation email's sender is the dedicated account. Open its link, confirm that the row is
   still unconfirmed, then press **Confirm my email** and verify pending plus a confirmation timestamp.
   Role verification must remain pending and no profile may be published.
3. Delete the fictional row after verification. If you test photos separately, remove those too.

If a delivery attempt fails, inspect the artifact and private Sheet **before running again**. Supply the
same artifact request ID as `recovery_request_id` to recover the same fictional registration rather than
creating another one. The recovery uses the same Hub-owned plus-address; an already-confirmed recovery can
report pending review, but it does not replace checking the email-confirmation action yourself.

Only after the deployed checks and owner verification pass: put the actual `/exec` URL in
`directory-config.js`, update the Privacy page's inactive-registration and intended-storage statements,
run `npm run test:directory` and `node scripts/stamp-versions.js`, then publish and verify the website.
Never use `no-cors` or a mock response as evidence that a live registration was saved.

## Three separate states

| State | Column | Values |
|---|---|---|
| Email verified | `Email Confirmed At`; `Status` `unconfirmed` → `pending` | set by the script when the button is pressed |
| EU-HEM role verified | `Role Verification Status` (+ `Role Verified At`) | `pending` → `verified` / `rejected`, set by you after checking the person's connection to EU-HEM |
| Admin approved | `Status` (+ `Approved At` or `Rejected At`) | `pending` → `approved` / `rejected`, set by you |

Email verified ≠ role verified ≠ approved. Anyone can type someone else's address, and a confirmed address only
shows control of that inbox. Never approve a row whose role you have not verified. When you reject, fill in
`Rejected At` (the retention rules count from it).

Students from another programme and faculty/staff (`Directory Eligible` FALSE) never go into the Student
Directory, whatever their status.

## Limits built in

- 60 registrations per hour, 400 rows in total (edit `SETTINGS` to change).
- Photos up to 2 MB, JPEG/PNG/WebP, checked by file signature; only for students and alumni.
- Gmail lets a consumer account send about 100 emails a day. If that runs out, the registration is still saved
  and `Confirm Email Sent` shows `failed`.

## Changing the code later

Paste the new `Code.gs` and manifest, run `setup_()` through the temporary wrapper again (and `migrateV3_()` once when upgrading to v3),
remove the wrapper, then Deploy → Manage deployments → edit the existing deployment →
Version: New version → Deploy. The `/exec` address stays the same.

## Every two weeks: the retention report

The privacy page promises fixed retention periods (see "Retention schedule" in docs/student-directory.md; the
values are `RETENTION` at the top of `Code.gs`). Use the temporary wrapper above with `retentionReport_()` instead
of `setup_()`, then remove the wrapper before any deployment. The log
lists, by row number and registration id only:

- `delete`: delete the row and its photo (`Photo Drive File ID`), then empty the Drive bin;
- `ask`: send the reminder (alumni: "do you want to stay?"; graduating students: "continue as alumni?");
  when an alumnus confirms, fill in `Last Reconfirmed At`; when a student chooses to continue as alumni,
  change `User Type` to `alumni` and fill in `Last Reconfirmed At`;
- `fill`: a date the rules need is missing (`Rejected At`, or `Participation Ends` for shared-course
  students and staff).

The report never deletes anything itself. Deletion requests are handled within 30 days (`deletionRequestDays`).

## Once a year

Review all registrations and delete those that are no longer needed.

## When the privacy text changes (Student Hub addition)

If the Student Directory section of `privacy.html` changes **meaning** (new field, new use, new place where
data is stored, longer keeping), change the consent version in **both** files, to the same value:

- `CONSENT_VERSION` in `SETTINGS` in `Code.gs` (then deploy a new version, see above)
- `consentVersion` in `directory-config.js` on the website

Old forms still open in someone's browser are then refused with "The privacy information has changed",
so nobody joins under text they have not seen. `node scripts/check-content.js` fails if the two differ.

## Deleting someone's data

Delete the row in the Sheet and the photo file named in `Photo Drive File ID`, then empty the Drive bin.
The row includes the citizenship-group and study-visa answers, so they go with it.

## Never

- publish the `Submissions` tab, export it as a public CSV, or create a public gviz/JSON view of it
- commit the Sheet ID or folder ID to the repository
- load this Sheet from the website
- share the photo folder or a photo with "Anyone with the link"
