# Student Experiences

`experiences.html` contains a curated collection of source-linked university
interviews and testimonials, plus a contribution questionnaire. The collection
is public editorial content in `experiences-data.js`; it is independent of the
fictional Student Directory and of private contributions.

## Collection and imagery

The overviews summarise stories already published by partner universities and
link to the original articles. Keep source dates, study stages, historical track
names and missing information explicit. An undated alumni interview does not
establish a person's current employment. Personal experiences do not replace
current programme, housing, immigration or financial guidance.

The hero is an optimised AI-generated editorial WebP. The six story covers are original
local SVG illustrations reflecting their topics, using the visual approach of
Announcements. They do not depict the named authors. Each illustration has
alternative text and a visible credit explaining its origin. Do not substitute
a person's photograph without clear reuse permission.

## Questionnaire

The five steps cover context, the actual journey, practical advice, optional
topic details, and a preview with display preferences. A current student can
share one semester or one city without claiming to have completed EU-HEM.

- A connection to EU-HEM and an experience scope are required. Track, cohort,
  previous field and the period of the experience are optional context.
- At least one city must be Completed or In progress. Planned cities are
  labelled separately and cannot qualify as lived experience.
- A title, a main account of at least 30 characters and one practical tip of at
  least 10 characters are required. Further tips and reflections are optional.
- Select at least one topic; only selected topics' detail fields are sent.
- Reply email is optional. A non-anonymous display choice requires a name or
  pseudonym. First-name mode sends only the first name; anonymous mode omits the
  display-name field from the private submission as well as the preview.
- Public and unpublished are preferences for review. There is no members-only
  publication or access system. The review checkbox authorises sending to the
  private inbox under the privacy notice; it does not approve publication.

Cohort and previous field can reach the review team as context even when hidden
in the public preview. The display settings are included in the private message
so an editor can respect them. Removing a name does not guarantee anonymity in
a small cohort, particularly when the narrative or route is distinctive.

The receiver accepts a combined message of at most 5,000 characters, including
context, narrative, selected details and display preferences. The interface counts
the full outgoing message. Oversized answers stay intact: the contributor must
shorten them before sending. Nothing is silently truncated to fit the inbox.

## Existing private intake

`experiences-submit.js` reuses the established Contact receiver as
`topic: "contribution"`, using `contact-config.js` and its existing
`contact-v1-2026-10` notice. It creates no database, spreadsheet, new deployment,
login, public responses feed or publication pipeline. The provider, review
purpose and retention process are those in the Contact privacy notice.

The production Contact receiver was verified with fictional browser delivery and
unchanged retries on **8 October 2026**, as recorded in
[Contact forms](contact-forms.md). Student Experiences was also verified from the
actual deployed website on **10 October 2026**, after
[the release](https://github.com/AdnanTarabishi/eu-hem-student-hub/pull/40).
The [one-off live check](https://github.com/AdnanTarabishi/eu-hem-student-hub/actions/runs/38025103639)
matched the published page and four scripts to the reviewed release, sent exactly
one anonymous, explicitly fictional contribution marked Keep unpublished, and
confirmed the matching private-storage receipt in the form. An unchanged adapter
call returned the same receipt without another POST. No real student answers
were used. The isolated verification branch was removed after completion;
ordinary CI checks use mocked delivery only. This confirms delivery at that
time, not permanent service availability.

Answers reach the restricted Contact Inbox for the Hub administrator to review.
They do not appear in the public collection automatically. Any future story
requires editorial review, author approval and respect for the requested display
preferences. A receipt confirms private storage, not reading, a reply or approval
for publication. Without a reply email, an administrator cannot promise to
contact the contributor from the submission alone.

Clearing or invalidating the shared endpoint disables direct submission for both
Contact and Experiences. Keep drafting and the visitor-initiated email route
available. Do not change the receiver configuration merely to enable this page.

## Submission behaviour

Only submitting the form initiates a POST. Visiting the page, editing fields,
counting characters, rendering the preview and checking configuration do not
contact the receiver. Explicit save/download/import controls remain separate;
there is no automatic draft persistence, offline queue or background retry.
Device drafts and downloaded drafts exclude the reply email and review checkbox.
Restoring or importing a draft requires fresh review permission before sending.

The adapter validates the whole questionnaire before sending. It POSTs JSON as
`text/plain;charset=utf-8` with CORS, redirects followed, credentials omitted,
no-referrer policy and no response caching. It uses a secure random UUID and a
20-second timeout. It accepts success only when the acknowledgement contains a
valid receipt UUID and canonical timestamp matching the request UUID and notice.
An opaque response or a successful HTTP status without that receipt is insufficient.

Unchanged retries reuse the exact request body and UUID while the page remains
open. A confirmed unchanged request can show its existing receipt without another
POST. A timeout, lost response or `SAVE_FAILED` leaves receipt uncertain because
the write may already have happened. Editing those answers displays a warning:
sending them creates a separate submission and may duplicate the earlier one.
Confirming an edited submission does not erase uncertainty about an earlier one.

Offline attempts never POST and preserve any earlier uncertainty. Known service
rejections retain the draft and give a useful next step. Reloading or closing the
page loses the in-memory retry reference; saving a draft does not save or restore
receipt references. Do not treat a newly imported draft as a safe unchanged retry
of an earlier unconfirmed request.

## Adapter API and validation

`window.ExperienceSubmission` exposes:

- `isConfigured()` — validates the existing shared connection without a request.
- `buildMessage(data, journey, topics, DATA)` — full outgoing message, never truncated.
- `validate(data, journey, topics, DATA)` — field-keyed validation problems.
- `getWarning({ data, journey, topics }, DATA)` — earlier unconfirmed-attempt warning.
- `send({ data, journey, topics }, DATA)` — explicit send, returning `ok`, `state`,
  `message`, optional `fieldErrors`, and a `receipt` only after matching confirmation.

States are `received`, `validation`, `offline`, `uncertain`, `unavailable`,
`rejected` and `busy`. Receipt fields are `receiptId`, `requestId`, `receivedAt`
and `noticeVersion`. No response exposes submitted narrative or identity fields.

Run the full content, transport and browser checks from the repository root:

```sh
npm run test:experiences
```

To run either focused suite separately:

```sh
node tests/experiences/submission.test.js
node tests/experiences/browser.test.js .
```

These tests use fictional answers, a fictional endpoint and mocked fetch only.
They check protocol compatibility with the actual receiver's pure validator,
complete answer inclusion, validation and aggregate limits, strict receipts,
secure references, retries, duplicate warnings, offline behaviour, timeouts,
concurrency and service failures. They neither deploy a service nor establish
current production browser delivery. The browser suite intercepts submissions
at a fictional endpoint and blocks other remote requests. It checks questionnaire
validation, matching receipts and unchanged retries, complete answer preservation,
explicit draft privacy, library filtering and saved stories, grid/list layouts,
keyboard reader access, and desktop/mobile layouts in light and dark themes.
Browser checks require the project's Playwright development tool and Chromium.
