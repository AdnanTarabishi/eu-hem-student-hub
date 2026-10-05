// Backend checks for Code.gs (onboarding v2), run against in-memory Google services (gas-mock.js).
const { load } = require('./gas-mock');
const assert = require('assert');
const CODE = process.argv[2];
let n = 0; const t = (name, fn) => { fn(); n++; console.log('  ok  ' + name); };
const uuid = () => require('crypto').randomUUID();
const common = { elapsedMs: 9000, website: '', consentVersion: 'directory-v2-2026-10', privacyAcknowledgement: 'yes' };
const student = (over = {}) => Object.assign({ requestId: uuid() }, common, {
  userType: 'current_student', fullName: 'Test Student', email: 'Test.Student@studio.unibo.it', cohort: '2026–2028',
  primaryCountry: 'Italy', previousField: 'medicine', track: 'phm', profileVisibility: 'public', analyticsConsent: 'yes' }, over);
const alumnus = (over = {}) => student(Object.assign({ userType: 'alumni', email: 'old@example.com', cohort: '2022–2024', track: 'gh' }, over));
const shared = (over = {}) => Object.assign({ requestId: uuid() }, common, {
  userType: 'shared_course_student', fullName: 'Shared Student', email: 'shared@studio.unibo.it',
  homeInstitution: 'University of Bologna', homeProgramme: 'MSc Economics', sharedCourses: ['Health Systems'] }, over);
const faculty = (over = {}) => Object.assign({ requestId: uuid() }, common, {
  userType: 'faculty_staff', fullName: 'Prof Example', email: 'prof@unibo.it', organisation: 'University of Bologna',
  programmeRole: 'lecturer' }, over);
const fresh = (props = {}) => { const g = load(CODE, Object.assign({ SPREADSHEET_ID: 'sheet1', PHOTO_FOLDER_ID: 'folder1', CONTACT_EMAIL: 'hub@example.com' }, props)); g.ctx.setup(); return g; };
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]).toString('base64');
const linkOf = (g, i = 0) => new URL(g.mails[i].body.match(/https:\S+/)[0]).searchParams;

/* ----- setup and Sheet schema ----- */
t('setup creates all 53 columns and the Options tab', () => {
  const g = fresh(); assert.strictEqual(g.grid[0].length, 53);
  assert.strictEqual(g.grid[0][40], 'Confirm Email Sent'); assert.strictEqual(g.grid[0][41], 'User Type');
  const options = g.sheets.Options.grid.map((r) => r.join('|')).join('\n');
  for (const s of ['current_student', 'Nursing & Midwifery', 'Decision Making in Healthcare', 'ai_study_assistant', 'verified']) assert.ok(options.includes(s), s);
});
t('an existing v1 Sheet gets the new columns appended; old columns and rows stay in place', () => {
  const g = fresh(); const v1 = g.grid[0].slice(0, 41);
  g.grid.length = 0; g.grid.push(v1.slice(), v1.map((h) => 'old ' + h));
  g.ctx.setup();
  assert.deepStrictEqual(g.grid[0].slice(0, 41), v1); assert.strictEqual(g.grid[0].length, 53);
  assert.strictEqual(g.grid[1][3], 'old Full Name'); assert.strictEqual(g.grid[1][45], undefined);
  assert.strictEqual(g.post(student()).ok, true); assert.strictEqual(g.row(2)['User Type'], 'current_student');
});
t('not configured without SPREADSHEET_ID', () => { const g = load(CODE, {}); assert.strictEqual(g.post(student()).code, 'NOT_CONFIGURED'); });

/* ----- user types and directory eligibility ----- */
t('current student: complete submission stored, eligible, role verification pending', () => {
  const g = fresh();
  const r = g.post(student({ additionalCountry: 'Syria', previousDegree: 'medicine', previousUniversity: 'Damascus University',
    shortBio: 'Hello', linkedin: 'https://www.linkedin.com/in/x', linkedinVisibility: 'public', featureInterests: ['timetable', 'thesis'] }));
  assert.deepStrictEqual([r.ok, r.confirmation, r.directoryEligible], [true, 'sent', true]);
  const row = g.row(1);
  assert.deepStrictEqual([row['User Type'], row['Directory Eligible'], row['EU-HEM Cohort'], row['EU-HEM Track']],
    ['current_student', true, '2026–2028', 'Population Health Management']);
  assert.deepStrictEqual([row['Previous Academic Field'], row['Previous Degree'], row['Additional Country']],
    ['Medicine', 'Medicine (MD / MBBS / equivalent)', 'Syria']);
  assert.deepStrictEqual([row['Status'], row['Role Verification Status'], row['Role Verified At']], ['unconfirmed', 'pending', '']);
  assert.deepStrictEqual([row['Feature Interests'], row['Consent Version'], row['Public Publish Eligible']], ['timetable, thesis', 'directory-v2-2026-10', false]);
  assert.strictEqual(row['University Email'], 'test.student@studio.unibo.it');
});
t('directoryEligible from the browser is ignored', () => {
  const g = fresh(); const r = g.post(shared({ directoryEligible: true, profileVisibility: 'public' }));
  assert.strictEqual(r.directoryEligible, false); assert.strictEqual(g.row(1)['Directory Eligible'], false);
  assert.strictEqual(g.row(1)['Profile Visibility'], 'hidden');
});
t('unknown user type is refused', () => { const g = fresh();
  for (const ut of ['', 'admin', 'visitor', 'Current EU-HEM student']) assert.strictEqual(g.post(student({ userType: ut })).code, 'INVALID_VALUE', ut); });
t('"I haven\'t chosen my track yet" and "Prefer not to share" stay distinct', () => {
  const g = fresh(); g.post(student({ track: 'not_chosen' })); g.post(student({ email: 'b@x.org', track: 'prefer_not_to_share' }));
  assert.strictEqual(g.row(1)['EU-HEM Track'], "I haven't chosen my track yet"); assert.strictEqual(g.row(2)['EU-HEM Track'], 'Prefer not to share');
});
t('current students cannot pick legacy specialisations', () => { const g = fresh();
  assert.strictEqual(g.post(student({ track: 'gh' })).code, 'INVALID_VALUE'); assert.strictEqual(g.post(student({ track: 'Population Health Management' })).code, 'INVALID_VALUE'); });
t('alumni: current track, legacy specialisation (never converted), other former', () => {
  const g = fresh(); g.post(alumnus({ track: 'eeh' })); g.post(alumnus({ email: 'b@x.org', track: 'dmh' }));
  g.post(alumnus({ email: 'c@x.org', track: 'other_former', trackOther: 'Health Technology' }));
  assert.strictEqual(g.row(1)['EU-HEM Track'], 'Economic Evaluation in Healthcare'); assert.strictEqual(g.row(2)['EU-HEM Track'], 'Decision Making in Healthcare');
  assert.strictEqual(g.row(3)['EU-HEM Track'], 'Other former specialisation: Health Technology');
  assert.strictEqual(g.row(1)['Directory Eligible'], true); assert.strictEqual(g.row(1)['User Type'], 'alumni');
  assert.strictEqual(g.post(alumnus({ email: 'd@x.org', track: 'not_chosen' })).code, 'INVALID_VALUE');
});
t('any email domain is accepted (alumni may use a personal address)', () => { const g = fresh();
  assert.strictEqual(g.post(alumnus({ email: 'someone@gmail.com' })).ok, true);
  assert.strictEqual(g.post(student({ email: 'x@uio.no' })).ok, true);
  assert.strictEqual(g.post(student({ email: 'not-an-email' })).code, 'INVALID_EMAIL'); });
t('cohort: two-year label, or "other" with text', () => { const g = fresh();
  assert.strictEqual(g.post(student({ cohort: '2026-2029' })).code, 'INVALID_VALUE');
  assert.strictEqual(g.post(student({ cohort: '' })).code, 'INVALID_VALUE');
  assert.strictEqual(g.post(student({ cohort: 'other' })).code, 'REQUIRED_FIELD');
  g.post(student({ cohort: 'other', cohortOther: '2014–2016' })); assert.strictEqual(g.row(1)['EU-HEM Cohort'], 'Other: 2014–2016');
  g.post(student({ email: 'h@x.org', cohort: '2025-2027' })); assert.strictEqual(g.row(2)['EU-HEM Cohort'], '2025–2027'); });
t('required fields per user type', () => { const g = fresh();
  for (const f of ['fullName', 'email', 'primaryCountry']) assert.strictEqual(g.post(student({ [f]: '' })).code, f === 'email' ? 'REQUIRED_FIELD' : 'REQUIRED_FIELD', f);
  assert.strictEqual(g.post(student({ previousField: '' })).code, 'INVALID_VALUE');
  assert.strictEqual(g.post(student({ track: '' })).code, 'INVALID_VALUE');
  assert.strictEqual(g.post(shared({ homeInstitution: '' })).code, 'REQUIRED_FIELD');
  assert.strictEqual(g.post(shared({ homeProgramme: '' })).code, 'REQUIRED_FIELD');
  assert.strictEqual(g.post(shared({ sharedCourses: [] })).code, 'REQUIRED_FIELD');
  assert.strictEqual(g.post(faculty({ organisation: '' })).code, 'REQUIRED_FIELD');
  assert.strictEqual(g.post(faculty({ programmeRole: '' })).code, 'INVALID_VALUE');
  assert.strictEqual(g.grid.length, 1); });
t('shared-course student: stored privately, no directory fields, no photo', () => {
  const g = fresh(); const r = g.post(shared({ sharedCourses: ['Health Systems', 'Introduction to Economics'], sharedCoursesOther: 'Seminar X',
    primaryCountry: 'Italy', track: 'eeh', photoBase64: JPEG, photoMimeType: 'image/jpeg', analyticsConsent: 'yes', linkedin: 'https://www.linkedin.com/in/s', linkedinVisibility: 'public' }));
  assert.strictEqual(r.ok, true); const row = g.row(1);
  assert.deepStrictEqual([row['Home Institution'], row['Home Programme'], row['Shared Courses']], ['University of Bologna', 'MSc Economics', 'Health Systems; Introduction to Economics; Other: Seminar X']);
  assert.deepStrictEqual([row['Primary Country'], row['EU-HEM Track'], row['Photo Drive File ID']], ['', '', '']);
  assert.deepStrictEqual([row['Profile Visibility'], row['Photo Visibility'], row['LinkedIn Visibility'], row['Anonymous Aggregated Statistics Consent']], ['hidden', 'hidden', 'hidden', 'not asked']);
  assert.strictEqual(g.files.length, 0); assert.ok(!/visibility/i.test(g.mails[0].body));
});
t('faculty: role stored; "Other" role needs its text; never in the directory', () => {
  const g = fresh(); g.post(faculty({ coursesInvolved: 'Health Systems' }));
  assert.deepStrictEqual([g.row(1)['Programme Role'], g.row(1)['Home Institution'], g.row(1)['Courses / Areas Involved'], g.row(1)['Directory Eligible']],
    ['Lecturer', 'University of Bologna', 'Health Systems', false]);
  assert.strictEqual(g.post(faculty({ email: 'o@x.org', programmeRole: 'other' })).code, 'REQUIRED_FIELD');
  g.post(faculty({ email: 'o@x.org', programmeRole: 'other', programmeRoleOther: 'External examiner' }));
  assert.strictEqual(g.row(2)['Programme Role'], 'Other: External examiner');
  assert.strictEqual(g.post(faculty({ email: 'z@x.org', programmeRole: 'dean' })).code, 'INVALID_VALUE');
});

/* ----- fields ----- */
t('academic fields: Medicine, Dentistry and Nursing stay separate; Other needs and keeps its text', () => {
  const g = fresh(); g.post(student({ previousField: 'dentistry' })); g.post(student({ email: 'n@x.org', previousField: 'nursing_midwifery' }));
  assert.strictEqual(g.row(1)['Previous Academic Field'], 'Dentistry & Oral Health'); assert.strictEqual(g.row(2)['Previous Academic Field'], 'Nursing & Midwifery');
  assert.strictEqual(g.post(student({ email: 'o@x.org', previousField: 'other' })).code, 'REQUIRED_FIELD');
  g.post(student({ email: 'o@x.org', previousField: 'other', previousFieldOther: 'Veterinary Medicine' }));
  assert.strictEqual(g.row(3)['Previous Academic Field'], 'Other: Veterinary Medicine');
  assert.strictEqual(g.post(student({ email: 'p@x.org', previousField: 'Astrology' })).code, 'INVALID_VALUE'); });
t('degree: controlled list; "Other" needs its text; optional', () => {
  const g = fresh(); g.post(student({ previousDegree: 'other', previousDegreeOther: 'DVM' })); g.post(student({ email: 'q@x.org' }));
  assert.strictEqual(g.row(1)['Previous Degree'], 'Other: DVM'); assert.strictEqual(g.row(2)['Previous Degree'], '');
  assert.strictEqual(g.post(student({ email: 'r@x.org', previousDegree: 'PhD' })).code, 'INVALID_VALUE'); });
t('feature interests: only known ids; Other suggestion stored separately', () => {
  const g = fresh(); g.post(student({ featureInterests: ['careers', 'other', 'careers'], featureSuggestion: 'A sports calendar' }));
  assert.deepStrictEqual([g.row(1)['Feature Interests'], g.row(1)['Feature Suggestion']], ['careers, other', 'A sports calendar']);
  g.post(student({ email: 's@x.org', featureInterests: ['timetable'], featureSuggestion: 'ignored without Other' }));
  assert.strictEqual(g.row(2)['Feature Suggestion'], '');
  assert.strictEqual(g.post(student({ email: 'u@x.org', featureInterests: ['hack'] })).code, 'INVALID_VALUE');
  assert.strictEqual(g.post(student({ email: 'u@x.org', featureInterests: 'timetable' })).code, 'INVALID_VALUE'); });
t('removed v1 fields are not stored (Instagram, phone, interests, languages…)', () => {
  const g = fresh(); g.post(student({ instagram: '@x', phone: '+39 333', languages: 'English', hobbies: 'x', professionalInterests: 'y' }));
  const row = g.row(1);
  for (const col of ['Instagram', 'Phone / WhatsApp', 'Languages', 'Hobbies / Interests', 'Professional Interests']) assert.strictEqual(row[col], '', col); });
t('short bio up to 350 characters', () => { const g = fresh();
  assert.strictEqual(g.post(student({ shortBio: 'x'.repeat(350) })).ok, true);
  assert.strictEqual(g.post(student({ email: 'v@x.org', shortBio: 'x'.repeat(351) })).code, 'FIELD_TOO_LONG'); });

/* ----- privacy ----- */
t('privacy: public, cohort and hidden profiles', () => { const g = fresh();
  for (const [i, v] of ['public', 'cohort', 'hidden'].entries()) { g.post(student({ email: `${v}@x.org`, profileVisibility: v })); assert.strictEqual(g.row(i + 1)['Profile Visibility'], v); }
  assert.strictEqual(g.post(student({ email: 'w@x.org', profileVisibility: '' })).code, 'INVALID_VALUE'); });
t('privacy: public profile with hidden or cohort photo', () => { const g = fresh();
  g.post(student({ photoBase64: JPEG, photoMimeType: 'image/jpeg', photoVisibility: 'hidden' }));
  g.post(student({ email: 'y@x.org', photoBase64: JPEG, photoMimeType: 'image/jpeg', photoVisibility: 'cohort' }));
  assert.strictEqual(g.row(1)['Photo Visibility'], 'hidden'); assert.strictEqual(g.row(2)['Photo Visibility'], 'cohort'); });
t('privacy clamp: a cohort profile cannot have a public photo or LinkedIn; email never public', () => { const g = fresh();
  g.post(student({ profileVisibility: 'cohort', photoBase64: JPEG, photoMimeType: 'image/jpeg', photoVisibility: 'public', linkedin: 'https://www.linkedin.com/in/x', linkedinVisibility: 'public', emailVisibility: 'cohort' }));
  const r = g.row(1); assert.deepStrictEqual([r['Photo Visibility'], r['LinkedIn Visibility'], r['University Email Visibility']], ['cohort', 'cohort', 'cohort']);
  assert.strictEqual(g.post(student({ email: 'c@x.org', emailVisibility: 'public' })).code, 'INVALID_VALUE'); });
t('hidden profile forces everything hidden; email defaults to hidden', () => { const g = fresh();
  g.post(student({ profileVisibility: 'hidden', linkedin: 'https://linkedin.com/in/x', linkedinVisibility: 'public', emailVisibility: 'cohort' }));
  g.post(student({ email: 'e@x.org' }));
  assert.deepStrictEqual([g.row(1)['LinkedIn Visibility'], g.row(1)['University Email Visibility'], g.row(2)['University Email Visibility']], ['hidden', 'hidden', 'hidden']); });
t('statistics consent is required (yes/no) for students and alumni', () => { const g = fresh();
  assert.strictEqual(g.post(student({ analyticsConsent: '' })).code, 'INVALID_VALUE');
  g.post(alumnus({ analyticsConsent: 'no' })); assert.strictEqual(g.row(1)['Anonymous Aggregated Statistics Consent'], 'no'); });

/* ----- email confirmation: two stages ----- */
t('confirmation email: wording, link, contact; no profile details', () => {
  const g = fresh(); g.post(student({ shortBio: 'secret bio', primaryCountry: 'Syria' })); const m = g.mails[0];
  assert.strictEqual(m.subject, 'Confirm your EU-HEM Student Hub registration'); assert.strictEqual(m.opt.replyTo, 'hub@example.com');
  for (const s of ['Hi Test,', 'press "Confirm my email"', 'Your connection to EU-HEM: Current student', 'Student Directory profile visibility: Public',
    'Nothing is published automatically', 'Contact: hub@example.com', 'Unofficial, student-run platform']) assert.ok(m.body.includes(s), s);
  for (const s of ['secret bio', 'Syria', 'Medicine']) assert.ok(!m.body.includes(s), s);
  const q = linkOf(g); assert.strictEqual(q.get('action'), 'confirm'); assert.match(q.get('token'), /^[a-f0-9]{64}$/);
  assert.ok(!g.row(1)['Confirm Token Hash'].includes(q.get('token')), 'only the hash is stored');
});
t('opening the link (GET) does NOT confirm; it shows a page with a button and no profile data', () => {
  const g = fresh(); g.post(student({ fullName: 'Visible Name' })); const q = linkOf(g);
  const html = g.get({ action: 'confirm', id: q.get('id'), token: q.get('token') });
  assert.ok(html.includes('Confirm my email') && html.includes('confirmEmailFromPage'));
  assert.ok(!html.includes('Visible Name') && !html.includes('studio.unibo.it'));
  assert.deepStrictEqual([g.row(1)['Status'], g.row(1)['Email Confirmed At']], ['unconfirmed', '']);
  g.get({ action: 'confirm', id: q.get('id'), token: q.get('token') });
  assert.strictEqual(g.row(1)['Status'], 'unconfirmed');
});
t('the button action confirms once; role verification stays pending', () => {
  const g = fresh(); g.post(student()); const q = linkOf(g);
  assert.strictEqual(g.confirm(q.get('id'), q.get('token')).title, 'Email confirmed');
  const row = g.row(1);
  assert.deepStrictEqual([row['Status'], row['Confirm Token Hash'], row['Role Verification Status']], ['pending', '', 'pending']);
  assert.ok(row['Email Confirmed At']);
  assert.strictEqual(g.confirm(q.get('id'), q.get('token')).text, 'This email has already been confirmed.');
});
t('invalid, expired and malformed links are refused safely', () => {
  const g = fresh(); g.post(student()); const q = linkOf(g);
  assert.strictEqual(g.confirm(q.get('id'), 'f'.repeat(64)).text, 'This confirmation link is not valid.');
  assert.strictEqual(g.confirm('x'.repeat(20), q.get('token')).text, 'This confirmation link is not valid.');
  assert.ok(g.get({ action: 'confirm', id: '<script>', token: 'zz' }).includes('This confirmation link is not valid.'));
  assert.ok(g.get({ id: q.get('id'), c: q.get('token') }).includes('EU-HEM Student Hub'), 'old-style link only shows the info page');
  assert.strictEqual(g.row(1)['Status'], 'unconfirmed');
  g.grid[1][g.grid[0].indexOf('Submitted At')] = new Date(Date.now() - 15 * 86400000);
  assert.strictEqual(g.confirm(q.get('id'), q.get('token')).text, 'This confirmation link has expired. Please contact the Student Hub team.');
  assert.strictEqual(g.row(1)['Status'], 'unconfirmed');
});
t('mail failure still saves and reports it', () => { const g = fresh({ __MAIL_FAILS: true }); const r = g.post(student());
  assert.deepStrictEqual([r.ok, r.confirmation], [true, 'failed']); assert.strictEqual(g.row(1)['Confirm Email Sent'], 'failed'); });
t('confirmation can be switched off', () => { const g = fresh({ REQUIRE_EMAIL_CONFIRMATION: 'false' }); const r = g.post(student());
  assert.strictEqual(r.confirmation, 'not_required'); assert.strictEqual(g.row(1)['Status'], 'pending'); assert.strictEqual(g.mails.length, 0); });

/* ----- protections kept from v1 ----- */
t('retry with the same requestId is not saved twice', () => { const g = fresh(); const b = student(); g.post(b); const r = g.post(b);
  assert.strictEqual(r.ok, true); assert.strictEqual(g.grid.length, 2); assert.strictEqual(g.mails.length, 1); });
t('duplicate email is refused with the friendly message and no stored data', () => { const g = fresh(); g.post(student({ shortBio: 'private' }));
  const r = g.post(alumnus({ email: 'TEST.student@studio.unibo.it' }));
  assert.strictEqual(r.code, 'DUPLICATE_EMAIL'); assert.match(r.message, /Profile editing will be available later/); assert.ok(!JSON.stringify(r).includes('private')); });
t('honeypot, too-fast, bad consent, bad JSON are refused', () => { const g = fresh();
  assert.strictEqual(g.post(student({ website: 'x' })).code, 'INVALID_REQUEST');
  assert.strictEqual(g.post(student({ elapsedMs: 500 })).code, 'INVALID_REQUEST');
  assert.strictEqual(g.post(student({ privacyAcknowledgement: '' })).code, 'CONSENT_REQUIRED');
  assert.strictEqual(g.post(student({ consentVersion: 'directory-v1-2026-10' })).code, 'CONSENT_VERSION');
  assert.strictEqual(g.post('not json').code, 'INVALID_REQUEST');
  assert.strictEqual(g.post(student({ requestId: '<script>' })).code, 'INVALID_REQUEST');
  assert.strictEqual(g.grid.length, 1); });
t('LinkedIn must be an https linkedin.com address', () => { const g = fresh();
  for (const bad of ['http://www.linkedin.com/in/x', 'https://evil.com/linkedin.com', 'https://linkedin.com.evil.com/in/x', 'javascript:alert(1)'])
    assert.strictEqual(g.post(student({ linkedin: bad })).code, 'INVALID_LINKEDIN', bad);
  assert.strictEqual(g.post(faculty({ linkedin: 'https://it.linkedin.com/in/some-one-123/' })).ok, true); });
t('formula injection is neutralised', () => { const g = fresh();
  g.post(student({ fullName: '=HYPERLINK("http://x","y")', shortBio: '+1', primaryCountry: '@x', previousUniversity: '-1' }));
  g.post(shared({ homeInstitution: '=1+1', sharedCourses: ['=CMD()'] }));
  const h = g.grid[0];
  for (const col of ['Full Name', 'Short Bio', 'Primary Country', 'Previous University']) assert.ok(String(g.grid[1][h.indexOf(col)]).startsWith("'"), col);
  for (const col of ['Home Institution', 'Shared Courses']) assert.ok(String(g.grid[2][h.indexOf(col)]).startsWith("'"), col); });
t('control characters and line breaks are cleaned', () => { const g = fresh(); g.post(student({ fullName: 'Ana\u0000\n  Maria\t‮X' }));
  assert.strictEqual(g.row(1)['Full Name'], 'Ana Maria X'); });
t('valid photo is stored privately; fake or wrong-type photo refused', () => { const g = fresh();
  assert.strictEqual(g.post(student({ photoBase64: JPEG, photoMimeType: 'image/jpeg', photoVisibility: 'public' })).ok, true);
  assert.strictEqual(g.files.length, 1); assert.strictEqual(g.row(1)['Photo Visibility'], 'public'); assert.ok(g.row(1)['Photo Drive File ID']);
  const other = { email: 'f@x.org' };
  assert.strictEqual(g.post(student(Object.assign({ photoBase64: Buffer.from('<html>not an image at all</html>').toString('base64'), photoMimeType: 'image/jpeg' }, other))).code, 'INVALID_PHOTO');
  assert.strictEqual(g.post(student(Object.assign({ photoBase64: JPEG, photoMimeType: 'image/svg+xml' }, other))).code, 'INVALID_PHOTO');
  assert.strictEqual(g.post(student(Object.assign({ photoBase64: JPEG, photoMimeType: 'image/png' }, other))).code, 'INVALID_PHOTO');
  assert.strictEqual(g.post(student(Object.assign({ photoBase64: 'A'.repeat(3 * 1024 * 1024), photoMimeType: 'image/jpeg' }, other))).code, 'PHOTO_TOO_LARGE');
  assert.strictEqual(g.files.length, 1); });
t('photo without a configured folder gives a clear message', () => { const g = fresh({ PHOTO_FOLDER_ID: '' });
  assert.strictEqual(g.post(student({ photoBase64: JPEG, photoMimeType: 'image/jpeg' })).code, 'PHOTO_STORAGE_NOT_CONFIGURED'); assert.strictEqual(g.grid.length, 1); });
t('hourly limit stops a flood', () => { const g = fresh(); let last;
  for (let i = 0; i < 62; i++) last = g.post(student({ email: `s${i}@x.org` }));
  assert.strictEqual(last.code, 'BUSY'); assert.strictEqual(g.grid.length, 61); });
t('unexpected errors do not leak details', () => { const g = fresh(); g.ctx.SpreadsheetApp.openById = () => { throw new Error('secret internal detail'); };
  const r = g.post(student()); assert.strictEqual(r.ok, false); assert.ok(!JSON.stringify(r).includes('secret')); });
console.log(n + ' backend checks passed');
