# Private Contact inbox: Google Apps Script

This separate service receives the four forms on `contact.html` and stores messages in a
**restricted Google Sheet owned by the Student Hub account**. The administrator reads and
manages messages in that Sheet. It sends no emails or notifications, creates no student
accounts, and publishes no messages. It does not connect the Directory or Supabase dashboard.

The Hub account authorized and deployed the production receiver on **8 October 2026**.
An actual browser delivery check returned the original saved receipt on exact retries, and
the owner verified one matching private Sheet row. See the
[activation record](../../docs/contact-forms.md#availability). Repeat the deployment checks
below whenever changing the receiver. An empty `CONTACT_CONFIG.endpoint` disables the form;
the frontend must not claim a message was sent in that state.

## Files and public interface

| File | Purpose |
|---|---|
| `Code.gs` | Validation, locked private writes, receipt verification and owner-only maintenance |
| `appsscript.json` | V8, UTC, spreadsheet scope, deploying-account execution and anonymous submissions |
| `../../contact-config.js` | Public `/exec` endpoint and matching notice version; no storage ID |
| `../../tests/contact/backend.test.js` | Fictional in-memory service checks; no network or real registrations |

There are exactly two public functions:

- `doPost`: accepts the form contract below and returns a receipt only after the row is saved.
- `doGet`: returns only `service: "euhem-contact"` and the notice version. Query parameters do
  not enable reading, searching, listing, status lookup, setup or maintenance. This response is
  **not** a check of Sheet configuration, permissions or delivery readiness.

Every other function ends in `_`, including `setup_` and `retentionReport_`. The Apps Script
editor does not list these private helpers in its Run selector. Use the manual initialization
below, or the temporary [owner-only helper procedure](#owner-only-helper-runs) when needed.
There is no HTML Service page or RPC interface.

## Request contract

Send one JSON object in an HTTP POST using `Content-Type: text/plain;charset=utf-8`.
The native website uses normal `fetch` with CORS and follows redirects. Do not use
`mode: "no-cors"`, JSONP, an embedded form or a success message based only on an HTTP redirect.

| Field | Rule |
|---|---|
| `requestId` | Required UUID v4. Reuse it when retrying the same message after a lost response. |
| `noticeVersion` | Required, exactly `contact-v1-2026-10`. |
| `topic` | Required: `correction`, `idea`, `privacy` or `contribution`. |
| `message` | Required text; 10–5,000 characters after trimming. Paragraph breaks are preserved; CRLF is normalized to LF. |
| `name` | Optional text, at most 80 characters. |
| `email` | Optional email, at most 254 characters, for a reply. Optional for **all** topics. It is not a verified identity. |
| `website` | Required blank string: the honeypot, not a user question. |
| `pageUrl` | Optional HTTP(S) reference, at most 2,048 characters; only correction or privacy. |
| `sourceUrl` | Optional HTTP(S) source, at most 2,048 characters; only correction. |
| `resourceUrl` | Optional HTTP(S) resource, at most 2,048 characters; only contribution. |
| `requestType` | Required for privacy: `question`, `access`, `correction`, `removal` or `other`. |
| `preferredCredit` | Optional contribution credit, at most 120 characters. |

Optional fields can be omitted or supplied as empty strings. Send only the fields applicable
to the selected topic. Unknown fields, topic-inapplicable fields, arrays and non-string values
are refused. There is no title, attachment, browser fingerprint, client timestamp, status or
administrator field in the request. Web references need a host and cannot contain credentials,
spaces, backslashes or control characters. The service never fetches submitted URLs.

The raw JSON body is limited to 20,000 JavaScript string characters. The server supplies the
receipt ID, timestamp and initial status. It stores the notice version and a SHA-256 fingerprint
of the canonical submitted fields for retry handling; it does not store the honeypot.

A successful response contains exactly:

```json
{
  "ok": true,
  "requestId": "a10b7514-9a30-4c32-b612-9d3f53c7a124",
  "receiptId": "4d85d892-d81c-47b8-a9f5-931f81c4dc42",
  "receivedAt": "2026-10-08T12:00:00.000Z",
  "noticeVersion": "contact-v1-2026-10"
}
```

These example IDs are fictional. An error contains `ok: false` and a `code`; only validation
errors also include `fieldErrors`, a map from known field names to plain-language messages.
No error response contains an exception, Sheet ID, submitted text or other message's data.

| Code | Meaning |
|---|---|
| `INVALID_REQUEST` | Invalid body, metadata, honeypot, field type for metadata or unexpected fields. |
| `NOTICE_CHANGED` | Refresh the form and review the current notice. |
| `VALIDATION_ERROR` | Correct the named fields in `fieldErrors`. |
| `REQUEST_CONFLICT` | That request ID already belongs to different submitted content. No overwrite occurs. |
| `BUSY` | A write is already locked or a global admission cap has been reached. |
| `NOT_CONFIGURED` | The owner must complete or repair private storage setup. |
| `SAVE_FAILED` | Persistence could not be verified. Keep the message and request ID for a retry. |
| `UNAVAILABLE` | An infrastructure failure prevented processing. No receipt is claimed. |

## Persistence, retries and limits

The script holds a script-wide lock while checking request IDs, counting admissions and saving.
After writing it flushes the spreadsheet, verifies **every cell** against the intended row,
and checks that no formulas are present. Only then is a receipt returned. Formula-like text is
escaped even with leading whitespace or control marks, and the destination range is plain text.
Literal leading apostrophes are preserved. Tests cover either safe apostrophe representation
returned by Sheets; the real deployment check below must verify the actual storage behavior.

An exact canonical retry returns the original receipt without another write. It checks both
the stored fingerprint and the actual immutable submitted fields, so matching metadata alone
cannot disguise a missing or corrupted message. Different content with the same ID is refused.
The same optional email may send multiple messages with different IDs. Administrative status
and review-date changes do not invalidate a valid retry.

`CONTACT` contains modest global caps: **30 stored messages per rolling hour** and **1,000 total
rows**. Exact retries still work at either cap. The blank honeypot and caps are only basic
abuse controls; they are not robust anti-spam, authentication or per-IP limits. A determined
sender can fill the shared allowance. The documented Apps Script request object does not
provide a client IP address or a trustworthy origin-authentication mechanism for this service.
An endpoint address in public frontend code is not a secret.

If the Sheet exceeds 1,000 rows through a manual change, new POSTs are refused conservatively;
the private maintenance report still reads all records. Review and remove records according
to the retention process rather than increasing the cap automatically. Google service quotas
can also make the service unavailable. A lost response or a timeout after persistence must
never be described as proof that nothing was saved; retry the same unchanged request ID.

## Set up under the dedicated Hub account

1. Sign in as **euhem.studenthub@gmail.com**. The Sheet and script must belong to that dedicated
   account. Do not create this service under a personal account or reuse the Directory Sheet.
2. Create a new Sheet, for example **Student Hub Contact (private)**. In **Share**, set general
   access to **Restricted**; keep access limited to the administrator. Confirm that a signed-out
   browser cannot open the Sheet. Do not publish any tab to the web.
3. Create a new standalone Apps Script project owned by the same account. Paste `Code.gs`.
   Enable **Show appsscript.json manifest file** in Project Settings and use the supplied
   `appsscript.json`. It requests only spreadsheet access, with no mail, Drive-file or external
   fetch scope. Google authorization covers spreadsheet access for that account, so the
   dedicated account and code review remain important.
4. Add the Script Property **`SPREADSHEET_ID`**, taking its value from the private Sheet URL.
   Do not put that value in source code, GitHub, frontend configuration, screenshots or chat.
5. Initialize the new, empty Sheet manually: rename its tab **`Contact Inbox`**, select **A1**,
   and paste the exact [tab-separated header row below](#manual-header-row). Check that the
   17 headers occupy **A1:Q1**, then choose **View → Freeze → 1 row**. Do not overwrite an
   existing inbox or its messages. The private `setup_` helper is optional; it is not a
   selectable editor function and is not needed after this manual initialization.
6. Deploy a **Web app**, executing as **Me** (the Hub account), accessible to **Anyone**, including
   people without a Google login. The manifest names these settings `USER_DEPLOYING` and
   `ANYONE_ANONYMOUS`. Complete Google's spreadsheet authorization as the dedicated Hub account
   during this deployment. This permits the two coded entry points; it does not make the Sheet public.
7. Keep the resulting `/exec` URL for the deployment check. It is a public submission endpoint;
   it belongs in `CONTACT_CONFIG.endpoint` only after that check passes. Do not change the
   Directory endpoint or Supabase config.

Do not deploy this project as an API executable or add extra public functions. All maintenance
remains in the editor. The backend intentionally sends no notifications, so the administrator
must check the restricted inbox regularly.

### Manual header row

Copy the following single tab-separated line into cell **A1** of the empty `Contact Inbox` tab.
Preserve the spelling, spaces and order. The last header, `Payload Fingerprint`, belongs in **Q1**.

```tsv
Request ID	Receipt ID	Received At	Notice Version	Topic	Message	Name	Reply Email	Page URL	Source URL	Resource URL	Request Type	Preferred Credit	Status	Closed At	Last Reviewed At	Payload Fingerprint
```

This creates the same schema as `setup_`. The first real fictional delivery check below verifies
that the deployed service can access this tab, validate the headers and persist the whole row.
Freezing row 1 helps the administrator read the inbox; it does not grant access or send data.

### Owner-only helper runs

Private helpers ending in `_` are intentionally absent from the editor's function selector.
Do not rename them or leave a new public maintenance function in deployed source. When the
owner needs a helper, use this temporary editor-only procedure:

1. While signed in as the dedicated Hub account, create a temporary script file named
   `OwnerMaintenance.gs` in the Apps Script editor. Do not add it to this repository.
2. Put only the following wrapper in that file, save, select `runOwnerMaintenance`, and run it:

   ```js
   function runOwnerMaintenance() {
     return retentionReport_();
   }
   ```

   For optional automated initialization instead of the manual header step, replace
   `retentionReport_()` with `setup_()` in this temporary wrapper. Grant the requested
   spreadsheet permission as the owner if prompted. `setup_` preserves an existing valid
   schema and rows, and refuses unfamiliar headers instead of rewriting them.
3. Read the maintenance report in the execution log when applicable. Then **delete the
   entire temporary file and save**. Confirm the selector again contains only `doGet` and
   `doPost` before creating any version or deployment.

**Never create or update a deployment while the wrapper exists.** An existing `/exec`
deployment continues to use its saved version; the temporary helper is run only from the
owner's editor. The final deployed source must remain the reviewed `Code.gs` and manifest,
with no extra public functions. This procedure adds no trigger or recurring automation.

## Required deployment check: real browser delivery

The unit tests use stand-ins for Google services. They cannot establish that a particular
deployment is reachable anonymously or that its redirects/CORS responses work from GitHub
Pages. The harmless `doGet` response also cannot establish delivery.

Before enabling real collection, use fictional messages and an authorized browser test from
the actual website origin with the candidate endpoint. Verify all of the following:

1. The normal CORS `fetch` POST uses `text/plain;charset=utf-8`, follows Google's redirect, and
   yields readable JSON. The response must not be opaque. Google Content Service can redirect
   responses to a temporary `script.googleusercontent.com` URL; do not commit or publish those
   temporary URLs or request bodies from browser logs.
2. A success response matches the exact request ID, notice version and newly saved Sheet row.
   Check **all submitted fields**, paragraph breaks, the server timestamp and receipt ID.
3. Retry the same payload and confirm the same receipt and one row. Change the payload with the
   same ID and confirm a conflict. Check every topic, an anonymous privacy request, invalid
   fields, and formula-like/literal-apostrophe text saved without formulas.
4. A simulated blocked connection never shows success; the form retains the message for a
   retry. No email or notification is sent. No response or GET query can reveal inbox data.
5. Inspect the website on a phone and verify that the dedicated Sheet still requires its
   owner's permission when accessed while signed out.

If redirects/CORS prevent a readable receipt, leave the endpoint disabled and resolve the
deployment problem. Do not bypass this gate with `no-cors` or a fabricated success screen.
Delete the fictional rows after the checks, update the public endpoint, run the repository's
content/version checks, and verify the published Contact and Privacy notices describe the
now-active service. Until then the interface must state that delivery is not connected.

## Managing and reviewing messages

Keep all submitted and receipt fields intact. The administrator may edit only:

- **Status:** `new`, `in_progress`, `closed` or `spam`.
- **Closed At:** the actual date/time when marked `closed` or `spam`.
- **Last Reviewed At:** the actual date/time an unresolved message was reviewed.

Use date values or ISO timestamps for the two administrator dates, not spreadsheet formulas.
If a closed message is reopened, set its status to `in_progress`, clear `Closed At` and update
`Last Reviewed At`. An email entered in a form is unverified; a privacy request does not by
itself authorize disclosure of another person's information. Use the privacy process already
described by the Hub, asking for only what is needed to handle a request.

Generate **`retentionReport_`** regularly, for example weekly, using the
[owner-only helper procedure](#owner-only-helper-runs); it is not directly selectable in the
editor. This supports reviewing unresolved requests at least every **30 days**. It returns and
logs only row numbers, review actions and due dates; it omits message content, names, email
addresses, URLs, request IDs and receipt IDs.

| Report action | Administrator action |
|---|---|
| `review-unresolved` | Review the request and update `Last Reviewed At`. The interval is measured from that date, or from receipt if never reviewed. |
| `plan-deletion` | The message was closed or marked spam at least **90 days** ago. Apply the deletion plan unless a documented legal need requires retaining it. |
| `check-date` | Fill in or correct a missing, invalid or future date. Do not guess a past event date. |
| `check-status` | Review and correct the status value. |

The report **never deletes or changes a row**, sends reminders or schedules a trigger. A
human carries out deletion and reviews any need to retain a specific record; the code makes
no legal determination. Handle an applicable deletion request without waiting for this
routine schedule. Remove the complete row, including contact details and fingerprint, and
account for any private copies or exports. Do not describe this process as automatic removal
from Google's underlying backups or revision history.

## Updating and checking the code

Use a new Apps Script deployment version after a code change; saving the editor source alone
does not update an existing deployment. Keep the frontend notice version and
`CONTACT.NOTICE_VERSION` synchronized. A change to Contact's fields, purpose, recipients or
retention needs a notice review; it does not automatically change Directory consent v3.

Run the focused checks from the repository root:

```sh
node tests/contact/backend.test.js
node --check tests/contact/backend.test.js
node --check < integrations/contact-apps-script/Code.gs
```

These cover the restricted public surface, contract, storage/receipt verification, formula
handling, idempotency, locks, quotas, failure honesty and non-destructive retention reports.
They use only fictional in-memory records and do not contact Google.

Official references, checked while preparing the integration:

- [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Content Service and redirects](https://developers.google.com/apps-script/guides/content)
- [Web app manifest settings](https://developers.google.com/apps-script/manifest/web-app-api-executable)
- [Manifest scopes and exception logging](https://developers.google.com/apps-script/manifest)
- [Private server functions](https://developers.google.com/apps-script/guides/html/communication#private_functions)
- [Google service quotas](https://developers.google.com/apps-script/guides/services/quotas)
