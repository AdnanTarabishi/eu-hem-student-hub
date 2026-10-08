# Contact forms

The Contact page uses the Hub's existing plain HTML, CSS and JavaScript. A separate
Google Apps Script receiver can save requests in a private administrator inbox.
The inbox is a restricted Google Sheet, not a public feed or the unconnected editor dashboard.

## Availability

`contact-config.js` is the only public connection setting. Its endpoint starts empty.
The existing email cards and copy-address control remain available until a valid production
endpoint is configured. The form is hidden and disabled without JavaScript.

A syntactically valid endpoint does **not** prove that a deployment works. Activate it only
after the receiver is owned by `euhem.studenthub@gmail.com`, the Sheet is restricted, and a
fictional browser submission has been verified in that Sheet. Follow the
[deployment guide](../integrations/contact-apps-script/README.md).

The expected URL is an HTTPS Google Apps Script address ending in `/exec`.
Query strings, fragments, credentials and other hosts are rejected. The public URL is a
write endpoint; no spreadsheet ID, credential or read token belongs in the frontend.

## Visitor experience

One native form serves four topics. Topic radio cards sit beside the writing area on a
wide screen and above it on phones. Switching topics keeps focus on the choice and preserves
each topic's draft in page memory. Hidden fields are disabled and omitted from submission.

| Field | Required | Available for |
|---|---|---|
| Topic | Yes | All requests |
| Message, 10–5,000 characters | Yes | All requests |
| Name, up to 80 characters | No | All requests |
| Reply email, up to 254 characters | No | All requests |
| Page URL | No | Correction, privacy |
| Source URL | No | Correction |
| Privacy request type | Yes | Privacy |
| Resource URL | No | Contribution |
| Preferred credit, up to 120 characters | No | Contribution |

Links must use HTTP or HTTPS and contain at most 2,048 characters. The form asks for no
password, identity document, student identifier or file upload. A contribution requests
review; it does not grant blanket publication permission.

The page provides visible labels, keyboard-operable choices, inline errors and an error
summary. Name and email remain optional for privacy requests as well; users who want a
private reply need to supply a reachable email. The administrator may need follow-up
before identifying records or acting on a data-rights request.

## Sending and receipts

Only the form's submit action initiates a request. Drafts are not written to localStorage,
sessionStorage, an offline queue or analytics. Navigating away may lose an unsent draft.
Email remains a separate, visitor-initiated fallback.

The browser sends a JSON body using a `text/plain;charset=utf-8` POST, with CORS, redirects
enabled, credentials omitted and no-referrer policy. It never uses an opaque `no-cors`
response as proof of delivery. The service worker does not intercept or cache POST bodies.

The request includes a random UUID, the current notice version and only the selected
topic's fields. The receiver validates everything again, uses a script lock for writes,
and recognises exact retries by the UUID and a fingerprint of the normalised payload.

- **Sending:** keep the draft and prevent a second simultaneous send.
- **Confirmed receipt:** accept only a structurally valid success response matching this
  request and notice version. A receipt confirms storage, not administrator reading or a reply.
- **Validation rejection:** explain the field error and retain the text.
- **Offline before send:** do not initiate a request; keep the draft.
- **Lost response or timeout:** say that receipt could not be confirmed. The earlier
  attempt may have arrived. Retrying the unchanged message reuses its request identifier.
- **Unavailable service:** keep the draft and offer retry and email.

No private message appears in a URL, browser log, public GitHub issue, site search, public
CSV/JSON, announcement or success response. Successful responses contain only a receipt,
request identifier, timestamp and notice version. There is no public read or list endpoint.

## Administration and privacy

The dedicated Hub account owns the receiver and restricted Sheet. The administrator
opens that Sheet to review requests and records their processing status and closure date.
This implementation sends no email notifications and does not activate the editor dashboard.

The privacy notice's Messages section describes the provider, purpose, optional details,
manual retention process and current form availability. The Contact notice is
`contact-v1-2026-10`, independent of Directory consent v3. If Contact's processing changes,
update the notice, frontend version and receiver version together before deploying.

Review unresolved requests at least every 30 days. Closed requests and spam are scheduled
for deletion 90 days after closure or spam classification, subject to an applicable legal
retention need. The backend provides a private review report; it does not delete data
automatically. Keep any copies, exported files and Google's service history in mind when
handling a deletion. Never publish the response Sheet or share it with ordinary content editors.

The basic honeypot, field limits and global volume limits reduce simple abuse; they are
not robust per-person rate limiting. Monitor the inbox and endpoint availability.

## Files and validation

- `contact.html`, `contact.css`, `contact.js`: presentation and interaction.
- `contact-config.js`: public endpoint and shared configuration validation.
- `integrations/contact-apps-script/`: private receiver, manifest and deployment instructions.
- `privacy.html`, `privacy.js`: notice and current availability.
- `tests/contact/backend.test.js`: fictional Sheets/Apps Script validation and storage checks.
- `tests/contact/browser.test.js`: intercepted submission and accessibility/layout checks.
- `.github/workflows/contact-form-checks.yml`: runs those checks and retains screenshots.

Browser checks run in GitHub Actions for this task. Mocked acknowledgements prove the
interface's behavior, not that a real Google deployment accepts cross-origin submissions.
Before activation, verify an actual fictional request from the deployed site's origin,
its confirmed receipt and exactly one private row on an unchanged retry.

## Primary technical references

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages):
  the public host serves static files.
- [Google Apps Script web apps](https://developers.google.com/apps-script/guides/web):
  deployment, execution identity and public entry points.
- [Google Content Service](https://developers.google.com/apps-script/guides/content):
  structured responses and redirects to Google's content-serving host.
- [Google privacy policy](https://policies.google.com/privacy?hl=en):
  provider handling, retention and international processing.
