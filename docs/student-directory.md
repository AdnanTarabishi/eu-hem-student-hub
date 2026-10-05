# Student Directory: the "Join the Directory" form

Students can send their own directory profile through **join.html**, which is reached from the "Join the
directory" button on the Students page. The page has no menu entry of its own, and search engines are asked
not to list it (`noindex`).

## How the pieces fit together
| Piece | File | Notes |
|---|---|---|
| The form | `join.html`, `join.js` | Reviewed package. **Do not change join.js** without a new review |
| Its styles | `join.css` | Every rule is scoped to `.directory-join` and uses the site's colours, so dark mode works and no other page changes |
| Settings (public) | `directory-config.js` | `endpoint` (the Apps Script `/exec` address), allowed email domain, phone off, consent version |
| The backend | `integrations/directory-apps-script/Code.gs` | Pasted into Google Apps Script. **No IDs or secrets** in the file |
| Backend setup | `integrations/directory-apps-script/README.md` | Step by step, plus the fortnightly clean-up |
| Tests | `tests/directory/` | Backend logic against in-memory stand-ins for Google; the form in a real browser |
| Privacy text | `privacy.html#student-directory` | Draft until reviewed |

### How a submission travels
1. The student fills in three steps. `join.js` checks the answers in the browser and shrinks the photo there
   (this also removes its location data).
2. On **Submit**, `join.js` sends one `fetch` POST to the `endpoint`. The body is JSON, sent as
   `text/plain`. That makes it a "simple request", so the browser sends it straight away without first
   asking Google for permission (a CORS "preflight", which Apps Script cannot answer). The browser can still
   read Google's JSON reply.
3. Google runs `doPost` in `Code.gs` **as the maintainer** ("Execute as: Me"). It checks everything again
   (never trusting the browser), saves a row in the private Sheet and the photo in the private Drive folder,
   and emails a confirmation link.
4. The website never stores or shows the data. Publishing anything is a separate, manual step that does
   not exist yet.

**Why no password or key is in the website:**
- The `/exec` address is public on purpose. It can only run the script's two entry points: submit
  (`doPost`) and confirm the email (`doGet`).
- The right to open the Sheet and the folder belongs to the maintainer's Google account, on Google's side.
- The Sheet and folder IDs are **Script Properties**, also on Google's side.

So someone who reads the website's code learns nothing that unlocks the data.

## The consent version (change it in both places)
`directory-config.js` → `consentVersion` and `Code.gs` → `SETTINGS.CONSENT_VERSION` must be identical.

When the Student Directory section of the privacy page changes **meaning**, change both to the same new
value. Examples of a change in meaning: a new field, a new purpose, a new storage place, keeping data
longer, or a new visibility option. Then deploy a new version of the script.

Forms that are still open in someone's browser are then refused with "The privacy information has changed",
so nobody joins under text they haven't seen. Wording fixes that don't change meaning need no new version.
`node scripts/check-content.js` fails if the two values differ.

## Safety checks built into `scripts/check-content.js`
- The consent versions match.
- `endpoint` is empty, or a `https://script.google.com/macros/s/…/exec` address (nothing else may receive the data).
- The form can't be switched on (endpoint set) while `contact.html` still has a placeholder, because the
  privacy page sends people there to change or delete their profile.
- No Google Sheet or Drive folder ID appears in the directory files.

## Going live (in this order)
0. Create the dedicated Student Hub email as its own Google account, and do steps 1–2 **signed in to that
   account**, not a personal one. Apps Script always sends the confirmation email *from* the account that
   deploys it, so a personal account would show its address to every student. `privacy.html` promises that
   the Sheet, folder and email belong to the Student Hub's own account.
1. Restrict the Google Sheet and create a private photo folder (backend README, step 1).
2. Set up and deploy the Apps Script (backend README, steps 2–4). Use the dedicated Student Hub email as
   `CONTACT_EMAIL`.
3. Put the dedicated email on `contact.html` and in "Who is responsible" on `privacy.html` (replace both
   placeholders; the checker refuses an endpoint while either is there).
4. Review and approve the privacy draft (`privacy.html`), and fill in "Last updated".
5. Paste the `/exec` address into `directory-config.js` → `endpoint`. Run `node scripts/check-content.js`
   and `node scripts/stamp-versions.js`.
6. Test with dummy data (backend README, step 5), including the confirmation email at a real
   @studio.unibo.it inbox. Then delete the test rows and photos.
7. Merge to `main`, and only then share the link with students.

## Running the tests
One-time setup: `npm install`. This installs Playwright, a tool that drives a browser for tests. The site
itself needs no installation. The browser test uses your installed Chrome.

```
npm test
```
This runs the content checker, the backend checks (`tests/directory/backend.test.js`) and the browser checks
(`tests/directory/browser.test.js`). They use in-memory stand-ins for Google's services, so they do **not**
replace a real test of the deployed Web App.

## Known limitation
Confirmation works by opening a link (`doGet`). Some email security scanners (UniBo mail is hosted by
Microsoft) open links automatically, which can mark an address as confirmed without the student clicking.
Before approving a profile, check that it looks genuine. A future fix would be a confirm **button** on the
page the link opens (a change to Code.gs, which would need a new review).
