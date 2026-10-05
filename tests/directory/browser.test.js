// The Join the Directory form (onboarding v2) in a real browser (installed Chrome), sending to
// Code.gs running on in-memory Google services (gas-mock.js). Run: node tests/directory/browser.test.js .
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const { load } = require('./gas-mock');
const ROOT = process.argv[2];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.csv': 'text/csv' };
const PNG = Buffer.from(fs.readFileSync(path.join(__dirname, 'png.b64'), 'utf8').trim(), 'base64');

(async () => {
  const gas = load(path.join(ROOT, 'integrations/directory-apps-script/Code.gs'), { SPREADSHEET_ID: 's', PHOTO_FOLDER_ID: 'f', CONTACT_EMAIL: 'hub@example.com' });
  gas.ctx.setup();
  let failNext = 0, preflights = 0, posts = 0;
  // "Google" on its own port: answers simple requests only, like Apps Script.
  const api = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') { preflights++; res.writeHead(405); return res.end(); }
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      posts++;
      if (failNext > 0) { failNext--; req.socket.destroy(); return; }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(gas.post(body)));
    });
  }).listen(0);
  let endpoint = `http://127.0.0.1:${api.address().port}/exec`;
  const site = http.createServer((req, res) => {
    const file = decodeURIComponent(req.url.split('?')[0].replace(/^\//, '')) || 'join.html';
    if (file === 'directory-config.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, file), 'utf8').replace('endpoint: ""', `endpoint: "${endpoint}"`));
    }
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(full)] || 'text/plain' }); res.end(fs.readFileSync(full));
  }).listen(0);
  const siteUrl = `http://127.0.0.1:${site.address().port}/join.html`;

  const browser = await chromium.launch({ channel: 'chrome' });
  let n = 0; const ok = (name) => { n++; console.log('  ok  ' + name); };
  const errors = [];
  const open = async (viewport = { width: 1280, height: 800 }) => {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push(m.text()); });
    await page.goto(siteUrl);
    await page.waitForFunction(() => document.querySelectorAll('#sharedCourseList input').length > 0);
    return page;
  };
  const role = (page, value) => page.check(`input[name="userType"][value="${value}"]`);
  const next = (page, step) => page.click(`[data-step="${step}"] [data-next]`);
  const visible = (page, sel) => page.locator(sel).isVisible();
  const fillStudent = async (page, email) => {
    await role(page, 'current_student');
    await page.fill('#fullName', 'New Student'); await page.fill('#email', email);
    await page.selectOption('#cohort', '2026–2028'); await page.fill('#primaryCountry', 'Syria');
    await page.selectOption('#previousField', 'nursing_midwifery'); await page.selectOption('#track', 'not_chosen');
  };
  const submit = async (page) => { await page.waitForTimeout(3100); await page.click('#submitButton'); };
  const lastRow = () => gas.row(gas.grid.length - 1);

  /* ----- start ----- */
  let page = await open();
  assert.strictEqual(await page.evaluate(() => window.scrollY), 0);
  assert.strictEqual(await page.evaluate(() => document.activeElement === document.body), true);
  assert.strictEqual(await visible(page, '#roleFields'), false);
  assert.strictEqual(await page.locator('input[name="userType"]:checked').count(), 0);
  assert.match(await page.textContent('.visit-note'), /Just visiting or considering EU-HEM\?/);
  ok('page opens at the top; four connection cards, none chosen, no fields yet; "just visiting" note');

  await next(page, 1);
  assert.match(await page.textContent('#userTypeError'), /how you are connected/);
  ok('continuing without choosing a connection is blocked');

  await role(page, 'current_student');
  assert.strictEqual(await visible(page, '#cohort'), true); assert.strictEqual(await visible(page, '#homeInstitution'), false);
  const tracks = await page.locator('#track option').allTextContents();
  assert.deepStrictEqual(tracks.slice(1), ['Economic Evaluation in Healthcare', 'Health Economics & Policy', 'Management of Healthcare Institutions',
    'Population Health Management', "I haven't chosen my track yet", 'Prefer not to share']);
  assert.ok((await page.locator('#cohort option').allTextContents()).includes('2026–2028'));
  assert.match(await page.textContent('#emailHelp'), /institutional or university email is preferred/);
  assert.match(await page.textContent('#roleAnnouncer'), /current EU-HEM students/);
  ok('current student: cohort, country, field and the six track choices (not chosen ≠ prefer not to share) appear');

  const fieldLabels = await page.locator('#previousField option').allTextContents();
  for (const f of ['Medicine', 'Dentistry & Oral Health', 'Nursing & Midwifery', 'Public Health', 'Law', 'Other']) assert.ok(fieldLabels.includes(f), f);
  assert.strictEqual(await page.locator('#previousField optgroup').count(), 4);
  ok('academic fields are grouped, with Medicine, Dentistry and Nursing separate');

  await role(page, 'alumni');
  const alumniTracks = await page.locator('#track option').allTextContents();
  for (const t of ['Decision Making in Healthcare', 'Global Health', 'Healthcare Finance and Management', 'Other / former EU-HEM specialisation'])
    assert.ok(alumniTracks.includes(t), t);
  assert.ok(!alumniTracks.includes("I haven't chosen my track yet"));
  assert.strictEqual(alumniTracks.filter((t) => t === 'Economic Evaluation in Healthcare').length, 1);
  assert.match(await page.textContent('#emailHelp'), /Otherwise, you may use your current email/);
  await page.selectOption('#track', 'other_former'); assert.strictEqual(await visible(page, '#trackOther'), true);
  ok('alumni: current and earlier specialisations without duplicates, "other former" reveals a text box, alumni email help');

  await role(page, 'shared_course_student');
  assert.strictEqual(await visible(page, '#cohort'), false); assert.strictEqual(await visible(page, '#track'), false);
  assert.strictEqual(await visible(page, '#primaryCountry'), false);
  assert.strictEqual(await page.locator('#sharedCourseList input').count() >= 8, true);
  await role(page, 'faculty_staff');
  await page.selectOption('#programmeRole', 'other'); assert.strictEqual(await visible(page, '#programmeRoleOther'), true);
  ok('shared-course students see institution, programme and course checkboxes (no track, country, cohort); faculty "Other" role reveals a text box');
  await page.close();

  /* ----- current student, full journey ----- */
  page = await open();
  await fillStudent(page, 'Someone@gmail.com');
  await page.selectOption('#previousField', 'other'); await next(page, 1);
  assert.match(await page.textContent('#previousFieldOtherError'), /specify/);
  await page.fill('#previousFieldOther', 'Veterinary Medicine');
  await next(page, 1);
  assert.strictEqual(await visible(page, '[data-step="2"]'), true);
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'step2Title');
  ok('any email domain is accepted; "Other" field needs its text; step 2 opens with focus on its heading');

  for (const gone of ['#instagram', '#phone', '#languages', '#hobbies', '#professionalInterests', '#canHelpWith']) assert.strictEqual(await page.locator(gone).count(), 0, gone);
  assert.match(await page.textContent('label[for="additionalCountry"]'), /Additional country you also identify with/);
  assert.match(await page.textContent('#additionalCountryHelp'), /dual nationality/);
  await page.selectOption('#previousDegree', 'other'); await next(page, 2);
  assert.match(await page.textContent('#previousDegreeOtherError'), /specify your degree/);
  await page.fill('#previousDegreeOther', 'DVM');
  await page.fill('#shortBio', 'Hello'); assert.strictEqual(await page.textContent('#bioCounter'), '5 / 350');
  await page.fill('#linkedin', 'https://evil.example/linkedin.com'); await next(page, 2);
  assert.match(await page.textContent('#linkedinError'), /linkedin\.com/);
  await page.fill('#linkedin', 'https://www.linkedin.com/in/new-student');
  await page.setInputFiles('#profilePhoto', { name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => document.getElementById('photoStatus').textContent.startsWith('Ready'));
  for (const f of ['timetable', 'thesis', 'other']) await page.click(`.feature-chip:has(input[value="${f}"])`);
  assert.strictEqual(await page.textContent('#featureCount'), '3 selected');
  assert.strictEqual(await visible(page, '#featureSuggestion'), true);
  await page.fill('#featureSuggestion', 'A sports calendar');
  ok('step 2: short profile only (no Instagram, phone, interests); degree "Other", 350-character bio, LinkedIn check, photo, feature chips with counter and "Other"');
  await next(page, 2);

  assert.strictEqual(await page.locator('input[name="profileVisibility"]:checked').count(), 0);
  assert.strictEqual(await page.locator('#photoVisibility').isDisabled(), true);
  const cards = await page.locator('.privacy-card strong').allTextContents();
  assert.deepStrictEqual(cards, ['Public', 'EU-HEM students only', 'Do not publish my profile yet']);
  assert.strictEqual(await page.locator('.privacy-card').first().locator('.privacy-badge').textContent(), 'Best for networking');
  assert.ok(!/Recommended/.test(await page.textContent('.privacy-fieldset')));
  assert.match(await page.textContent('.privacy-fieldset'), /Coming soon: you'll have your own Student Hub account/);
  ok('privacy: Public first with "Best for networking" (no "Recommended"), nothing preselected, coming-soon dashboard note');

  await page.check('input[name="profileVisibility"][value="cohort"]');
  assert.deepStrictEqual(await page.locator('#photoVisibility option').allTextContents(), ['EU-HEM members only', 'Hidden']);
  await page.check('input[name="profileVisibility"][value="public"]');
  assert.deepStrictEqual(await page.locator('#photoVisibility option').allTextContents(), ['Public', 'EU-HEM members only', 'Hidden']);
  assert.deepStrictEqual(await page.locator('#emailVisibility option').allTextContents(), ['EU-HEM members only', 'Hidden']);
  assert.strictEqual(await page.locator('#emailVisibility').inputValue(), 'hidden');
  await page.check('input[name="profileVisibility"][value="hidden"]');
  assert.deepStrictEqual(await page.locator('#linkedinVisibility option').allTextContents(), ['Hidden']);
  await page.check('input[name="profileVisibility"][value="public"]');
  await page.click('#advancedPrivacy summary'); await page.selectOption('#photoVisibility', 'cohort');
  ok('advanced privacy follows the profile: cohort cannot choose public; email never public and hidden by default');

  await page.click('#submitButton');
  assert.match(await page.textContent('#analyticsConsentError'), /Yes or No/);
  assert.strictEqual(posts, 0);
  ok('statistics consent is not preselected; submit without it sends nothing');
  await page.check('input[name="analyticsConsent"][value="yes"]'); await page.check('#privacyAcknowledgement');

  failNext = 1; await submit(page);
  await page.waitForFunction(() => /press the button again/.test(document.getElementById('formMessage').textContent));
  assert.strictEqual(gas.grid.length, 1);
  ok('a dropped connection shows a clear message and keeps the form filled');
  await page.click('#submitButton');
  await page.waitForSelector('#successCard:not([hidden])');
  assert.strictEqual(await page.textContent('#successCard h2'), 'Check your email');
  assert.match(await page.textContent('#successCard'), /remain unconfirmed until that step is completed/);
  assert.match(await page.textContent('#successVisibilityText'), /Nothing will appear publicly until your email is confirmed/);
  let row = lastRow();
  assert.deepStrictEqual([row['User Type'], row['Directory Eligible'], row['EU-HEM Cohort'], row['EU-HEM Track']],
    ['current_student', true, '2026–2028', "I haven't chosen my track yet"]);
  assert.deepStrictEqual([row['Previous Academic Field'], row['Previous Degree'], row['University Email']], ['Other: Veterinary Medicine', 'Other: DVM', 'someone@gmail.com']);
  assert.deepStrictEqual([row['Profile Visibility'], row['Photo Visibility'], row['LinkedIn Visibility'], row['University Email Visibility']], ['public', 'cohort', 'public', 'hidden']);
  assert.deepStrictEqual([row['Feature Interests'], row['Feature Suggestion'], row['Role Verification Status'], row['Status']], ['timetable, thesis, other', 'A sports calendar', 'pending', 'unconfirmed']);
  assert.strictEqual(gas.files.length, 1); assert.strictEqual(gas.files[0].blob.mime, 'image/jpeg');
  assert.strictEqual(gas.mails.length, 1); assert.strictEqual(preflights, 0);
  ok('retry succeeds: saved once with every field in its column, photo as JPEG, "Check your email" screen, no CORS preflight');

  const q = new URL(gas.mails[0].body.match(/https:\S+/)[0]).searchParams;
  gas.get({ action: 'confirm', id: q.get('id'), token: q.get('token') });
  assert.strictEqual(lastRow()['Status'], 'unconfirmed');
  gas.confirm(q.get('id'), q.get('token'));
  assert.deepStrictEqual([lastRow()['Status'], lastRow()['Role Verification Status']], ['pending', 'pending']);
  ok('email link alone does not confirm; the button action does; role verification stays pending');
  await page.close();

  /* ----- duplicate ----- */
  page = await open(); await fillStudent(page, 'someone@gmail.com');
  await next(page, 1); await next(page, 2);
  await page.check('input[name="profileVisibility"][value="hidden"]');
  await page.check('input[name="analyticsConsent"][value="no"]'); await page.check('#privacyAcknowledgement');
  await submit(page);
  await page.waitForFunction(() => /already exists for this email address/.test(document.getElementById('formMessage').textContent));
  assert.match(await page.textContent('#formMessage'), /Profile editing will be available later/);
  assert.strictEqual(gas.grid.length, 2);
  ok('second registration with the same email is refused with the friendly message');
  await page.close();

  /* ----- alumnus, legacy specialisation, cohort privacy ----- */
  page = await open(); await role(page, 'alumni');
  await page.fill('#fullName', 'Old Timer'); await page.fill('#email', 'old@example.org');
  await page.selectOption('#cohort', '2022–2024'); await page.fill('#primaryCountry', 'Italy');
  await page.selectOption('#previousField', 'dentistry'); await page.selectOption('#track', 'gh');
  await next(page, 1); await next(page, 2);
  await page.check('input[name="profileVisibility"][value="cohort"]');
  await page.check('input[name="analyticsConsent"][value="yes"]'); await page.check('#privacyAcknowledgement');
  await submit(page); await page.waitForSelector('#successCard:not([hidden])');
  assert.match(await page.textContent('#successVisibilityText'), /remain private/);
  row = lastRow();
  assert.deepStrictEqual([row['User Type'], row['EU-HEM Track'], row['Previous Academic Field'], row['Profile Visibility'], row['Directory Eligible']],
    ['alumni', 'Global Health', 'Dentistry & Oral Health', 'cohort', true]);
  ok('alumnus with a legacy specialisation (Global Health), Dentistry, EU-HEM-only profile');
  await page.close();

  /* ----- shared-course student ----- */
  page = await open(); await role(page, 'shared_course_student');
  await page.fill('#fullName', 'Shared Student'); await page.fill('#email', 'shared@studio.unibo.it');
  await page.fill('#homeInstitution', 'University of Bologna'); await page.fill('#homeProgramme', 'MSc Economics');
  await next(page, 1);
  assert.match(await page.textContent('#sharedCoursesError'), /at least one course/);
  await page.locator('#sharedCourseList input').first().check(); await page.fill('#sharedCoursesOther', 'Seminar X');
  await next(page, 1);
  assert.strictEqual(await page.textContent('#step2Title'), 'Student Hub preferences');
  assert.strictEqual(await visible(page, '.photo-uploader'), false); assert.strictEqual(await visible(page, '#shortBio'), false);
  assert.strictEqual(await visible(page, '#linkedin'), true);
  await next(page, 2);
  assert.strictEqual(await visible(page, '.privacy-fieldset'), false); assert.strictEqual(await visible(page, '#advancedPrivacy'), false);
  assert.strictEqual(await visible(page, '.consent-card'), false);
  assert.match(await page.textContent('.note-card'), /will not be added to the Student Directory/);
  assert.strictEqual(await page.textContent('#submitButtonText'), 'Submit registration');
  await page.check('#privacyAcknowledgement'); await submit(page); await page.waitForSelector('#successCard:not([hidden])');
  assert.match(await page.textContent('#successVisibilityText'), /will not be added to the Student Directory/);
  row = lastRow();
  assert.deepStrictEqual([row['User Type'], row['Directory Eligible'], row['Profile Visibility'], row['Home Programme']], ['shared_course_student', false, 'hidden', 'MSc Economics']);
  assert.match(row['Shared Courses'], /; Other: Seminar X$/);
  ok('shared-course student: no profile, photo or visibility; courses stored; not added to the Directory');
  await page.close();

  /* ----- faculty with an "Other" role ----- */
  page = await open(); await role(page, 'faculty_staff');
  await page.fill('#fullName', 'Prof Example'); await page.fill('#email', 'prof@unibo.it');
  await page.fill('#organisation', 'University of Bologna'); await page.selectOption('#programmeRole', 'other');
  await page.fill('#programmeRoleOther', 'External examiner'); await page.fill('#coursesInvolved', 'Health Systems');
  await next(page, 1); await next(page, 2);
  await page.check('#privacyAcknowledgement'); await submit(page); await page.waitForSelector('#successCard:not([hidden])');
  row = lastRow();
  assert.deepStrictEqual([row['User Type'], row['Programme Role'], row['Courses / Areas Involved'], row['Directory Eligible']],
    ['faculty_staff', 'Other: External examiner', 'Health Systems', false]);
  ok('faculty with an "Other" role: stored privately, not in the Directory');
  await page.close();

  /* ----- phones and tablets ----- */
  for (const width of [375, 768, 1024, 1440]) {
    page = await open({ width, height: 800 });
    await fillStudent(page, `w${width}@example.org`);
    for (const step of [1, 2, 3]) {
      assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${width}px step ${step}`);
      if (step < 3) await next(page, step);
    }
    await page.close();
  }
  ok('no sideways scrolling at 375, 768, 1024 and 1440px on any step');

  /* ----- not open yet ----- */
  endpoint = '';
  page = await open(); await fillStudent(page, 'later@example.org');
  await next(page, 1); await next(page, 2);
  await page.check('input[name="profileVisibility"][value="hidden"]');
  await page.check('input[name="analyticsConsent"][value="no"]'); await page.check('#privacyAcknowledgement');
  const before = posts; await page.click('#submitButton');
  assert.match(await page.textContent('#formMessage'), /not open yet/);
  assert.strictEqual(posts, before);
  ok('with no endpoint configured the form says so and sends nothing');

  assert.deepStrictEqual(errors, []);
  ok('no JavaScript errors');
  console.log(n + ' browser checks passed');
  await browser.close(); api.close(); site.close();
})().catch(e => { console.error(e); process.exit(1); });
