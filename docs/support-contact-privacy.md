# Support, Contact and Privacy

Reviewed against the public site's source on **8 October 2026**, starting from
`e5dd21ad418f30dcd886936fcf3589ad7f98c924`. The separate Contact form addition starts from
`e8b1740d215560fdbb4845b3274166ef6d07d167`. Pages keep the static-site architecture;
Contact's optional private receiver is documented separately in [contact-forms.md](contact-forms.md).

## Files and behavior

| Page | Presentation | Behavior |
|---|---|---|
| `support.html` | Existing shared `academic-pages.css` plus `support.css` | Existing `support.js` renders `content/people.json`, official sources, shared university names and City Guide emergency facts. Native questions, university disclosures, progress and deep links. |
| `contact.html` | Existing shared hero plus `contact.css` | A topic-aware native form sends only when its separate receiver is configured and the visitor submits. With an empty connection or no JavaScript, ordinary email routes remain available. No automatic email, persistent drafts or tracking. |
| `privacy.html` | Existing shared reading layout plus `privacy.css` | `privacy.js` states the configured Contact route, opens/closes prepared terms and opens native printing. Shared `academic-pages.js` handles focused navigation and full printing with state restoration. |

The Support and Privacy section IDs are stable. Existing `contacts-*`, `student-directory`,
`mobility-experience` and `responsible` links remain usable; nested targets open their native disclosure.
No existing shared style or navigation behavior is modified. New page assets are included in `sw.js`.

## Privacy audit: current release versus prepared features

The page describes observable browser behavior and the configured public release. It is not a claim
that an inactive backend has been deployed or that private account settings were inspected.

| Finding | Source in the repository | Notice treatment |
|---|---|---|
| Directory submissions are off | `directory-config.js` has an empty endpoint; `join.js` refuses submission without it | Explicit current-status notice; the complete prepared terms remain below it. |
| Editor sign-in is not connected | Empty URL/key in `supabase-config.js`; `admin.js` returns before creating a client | Public pages need no student account; no active editor or Supabase processing is claimed. |
| Origins totals are supplied, profiles are fictional | `cohort-data.js`; `students-config.js`; `data/demo-students.json` | Separate 105-person / 24-country totals from the 40 invented profile records. No claim of guaranteed anonymity or application of future registration suppression rules to the supplied map. |
| Saved browser data has expanded | `programme.js`, `studyplan-data.js`, `tracks-data.js`, `notes-progress.js`, `thesis-guide.js`, Toolkit scripts, `guide.js`, `experiences.js`, `right-to-health.js`, `fhem-exam.js` | Group by function, explain auto-save versus explicit save, and distinguish separate backups. |
| Statistics mock is tab-scoped, Health Economics mock persists | `fund-statistics.js`; `fhem-exam.js` | Separate session storage from local storage; avoid describing both mocks as temporary. |
| Experiences import does not permanently save by itself | `experiences.js` import and explicit-save handlers | Import fills the page; Save persists it. Neither submits the contribution. |
| Public offline copies can be cached before app installation | `pwa.js` registers on page load; `sw.js` caches during worker installation | Describe normal visits as well as installed-app use. |
| Calendar/feed and exported files can be shared deliberately | `calendar.js`; feature export handlers | No absolute promise that local data can never be shared; clarify visitor-selected destinations and URL/history behavior. |
| Public browser makes limited provider requests | `unibo-data.js`, CDN tags in Notes/Course/Create/City Guide, `universities.js` image loading | Explain UniBo, cdnjs, Wikimedia and GitHub requests, without describing them as Hub analytics. |
| Announcements are copied into site files | `announcements.js`; `scripts/fetch-announcements.js` | Browsers do not contact the source Google Sheet to read announcements. |
| Contact has a separate, initially unconnected private form receiver | `contact-config.js`, `contact.html`, `contact.js`, `integrations/contact-apps-script/` | State actual availability; explain optional details, private Sheet receipt, selected-topic fields, in-memory drafts, manual retention and email fallback. No claim of a deployed service from code or a configured URL alone. |

The existing group-photo removal route and named controller/contact remain accessible. Public election
announcements, programme role contacts and attributed published experiences are not described as fictional.
Current experience covers are local editorial illustrations rather than remote author photographs.

### Directory consent is unchanged

This revision does **not** add fields, change purposes, expand audiences or visibility, change storage
recipients, or extend retention. `directory-v3-2026-10` remains identical in `directory-config.js` and
`integrations/directory-apps-script/Code.gs`. All nine original `data-retention` occurrences retain their
values and units. The original choices, private mobility defaults, separate statistics permissions,
independent email/role/approval checks and no-automatic-publication rule remain present.

The manual retention process remains documented in `docs/student-directory.md` and the integration README;
the notice does not claim there is an automatic deletion job. The Google transfer paragraph now points
to Google's policy instead of claiming that a particular unverified account arrangement has both specified
transfer mechanisms. The intended private setup remains a prerequisite for any later activation.

Before enabling Directory submission or editor sign-in, review this notice against the actual deployment.
A change to Directory processing meaning also requires the synchronized consent-version process in
`docs/student-directory.md`; this design work does not authorize activating either connection.

## Official reference review

The following primary sources informed the revised provider/rights wording. The site's code supplies
the facts about which requests it initiates; provider policies supply those providers' descriptions.

- [GitHub Pages data collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection): visitor IP logging for hosting security.
- [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement): independent hosting-provider handling and transfers.
- [Google privacy policy](https://policies.google.com/privacy?hl=en): provider processing, international transfers and retention; no account-specific contract guarantee is inferred.
- [Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/).
- [Wikimedia privacy policy](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy).
- [European Commission: individual data-protection rights](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en).
- [GDPR official text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679): Articles 6, 12–22 and 77 support the notice's basis/rights/request wording. The general request timing does not replace the existing Directory's 30-day deletion commitment.

## Focused validation

The `Check support and privacy pages` workflow runs content/contrast checks, the 19 existing handbook
data checks and `tests/support-pages/browser.test.js` using bundled Chromium. Browser checks cover
source/prose preservation, all contact-guide cases, native disclosure and print restoration, deep links
and history/focus, mailto and clipboard fallback without sending email, static privacy rollout assertions,
unchanged retention/consent, narrow layouts in both themes, and no new browser-data writes or external posts.
Screenshots are retained as a workflow artifact. No private registration or mailbox data is used in tests.

The separate `Check Contact forms` workflow exercises the configured form against an intercepted
fictional endpoint, including validation, matching receipts, interrupted sends and retries. Its
receiver tests use stubbed private Sheets and Apps Script services. The empty production configuration
keeps collection inactive; successful mock tests do not establish real delivery or deployed sharing.
