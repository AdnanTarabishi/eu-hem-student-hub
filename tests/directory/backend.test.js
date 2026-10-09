// Backend checks for Code.gs (onboarding v2), run against in-memory Google services (gas-mock.js).
const { load } = require('./gas-mock');
const assert = require('assert');
const CODE = process.argv[2];
let n = 0; const t = (name, fn) => { fn(); n++; console.log('  ok  ' + name); };
const uuid = () => require('crypto').randomUUID();
const common = { elapsedMs: 9000, website: '', consentVersion: 'directory-v3-2026-10', privacyAcknowledgement: 'yes' };
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
const fresh = (props = {}) => { const g = load(CODE, Object.assign({ SPREADSHEET_ID: 'sheet1', PHOTO_FOLDER_ID: 'folder1', CONTACT_EMAIL: 'hub@example.com' }, props)); g.ctx.setup_(); return g; };
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]).toString('base64');
const linkOf = (g, i = 0) => new URL(g.mails[i].body.match(/https:\S+/)[0]).searchParams;

/* ----- setup and Sheet schema ----- */
t('only registration and email confirmation are callable from the public web app', () => {
  const source = require('fs').readFileSync(CODE, 'utf8');
  const publicFunctions = [...source.matchAll(/^function ([A-Za-z0-9_]+)\(/gm)]
    .map(match => match[1]).filter(name => !name.endsWith('_')).sort();
  assert.deepStrictEqual(publicFunctions, ['confirmEmailFromPage', 'doGet', 'doPost']);
  const manifest = JSON.parse(require('fs').readFileSync(require('path').join(require('path').dirname(CODE), 'appsscript.json'), 'utf8'));
  assert.strictEqual(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.strictEqual(manifest.webapp.access, 'ANYONE_ANONYMOUS');
  assert.strictEqual(manifest.exceptionLogging, 'NONE');
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/userinfo.email'),
    'the temporary setup wrapper can verify the executing account');
});
t('setup creates all 63 columns and the Options tab', () => {
  const g = fresh(); assert.strictEqual(g.grid[0].length, 63);
  assert.strictEqual(g.grid[0][40], 'Confirm Email Sent'); assert.strictEqual(g.grid[0][41], 'User Type');
  const options = g.sheets.Options.grid.map((r) => r.join('|')).join('\n');
  for (const s of ['current_student', 'Nursing & Midwifery', 'Decision Making in Healthcare', 'ai_study_assistant', 'verified']) assert.ok(options.includes(s), s);
});
t('an existing v1 Sheet gets the new columns appended; old columns and rows stay in place', () => {
  const g = fresh(); const v1 = g.grid[0].slice(0, 41);
  g.grid.length = 0; g.grid.push(v1.slice(), v1.map((h) => 'old ' + h));
  g.ctx.setup_();
  assert.deepStrictEqual(g.grid[0].slice(0, 41), v1); assert.strictEqual(g.grid[0].length, 63);
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
  assert.deepStrictEqual([row['Feature Interests'], row['Consent Version'], row['Public Publish Eligible']], ['timetable, thesis', 'directory-v3-2026-10', false]);
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

/* ----- v3: citizenship group, study-visa experience, mobility consent, per-detail visibility ----- */
const V3_COLUMNS = ['Citizenship Group', 'Citizenship Visibility', 'Study Visa Experience', 'Study Visa Experience Scope',
  'Study Visa Experience Visibility', 'Mobility Statistics Consent', 'Field Visibility JSON'];
const mob = (row) => V3_COLUMNS.slice(0, 6).map((c) => row[c] ?? '');
t('v3 columns are appended at the end, in order', () => {
  const g = fresh(); assert.deepStrictEqual(g.grid[0].slice(56), V3_COLUMNS);
  const options = g.sheets.Options.grid.map((r) => r.join('|')).join('\n');
  for (const s of ['eu_eea_swiss', 'non_eu_eea_swiss', 'prefer_not_to_say', 'not_applicable', 'Share with verified EU-HEM students']) assert.ok(options.includes(s), s);
});
t('citizenship: three answers stored as ids; skipped is "not_provided", distinct from "prefer_not_to_say"', () => {
  const g = fresh();
  ['eu_eea_swiss', 'non_eu_eea_swiss', 'prefer_not_to_say'].forEach((v, i) => g.post(student({ email: `c${i}@x.org`, citizenshipGroup: v })));
  g.post(student({ email: 'skip@x.org' }));
  assert.deepStrictEqual([1, 2, 3, 4].map((i) => g.row(i)['Citizenship Group']), ['eu_eea_swiss', 'non_eu_eea_swiss', 'prefer_not_to_say', 'not_provided']);
  for (const bad of ['EU', 'eu', 'stateless', 'Italy']) assert.strictEqual(g.post(student({ email: 'b@x.org', citizenshipGroup: bad })).code, 'INVALID_VALUE', bad);
});
t('citizenship is never worked out from the country (dual-citizenship counterexamples)', () => {
  const g = fresh();
  g.post(student({ primaryCountry: 'Syria', additionalCountry: 'Germany', citizenshipGroup: 'eu_eea_swiss' }));
  g.post(student({ email: 'nl@x.org', primaryCountry: 'Netherlands', citizenshipGroup: 'non_eu_eea_swiss' }));
  g.post(student({ email: 'it@x.org', primaryCountry: 'Italy' }));
  g.post(student({ email: 'sy@x.org', primaryCountry: 'Syria' }));
  assert.deepStrictEqual([1, 2, 3, 4].map((i) => g.row(i)['Citizenship Group']), ['eu_eea_swiss', 'non_eu_eea_swiss', 'not_provided', 'not_provided']);
});
t('citizenship and visa sharing: private by default, never public, members only, nothing from a hidden profile', () => {
  const g = fresh();
  g.post(student({ citizenshipGroup: 'eu_eea_swiss', studyVisaExperience: 'no' })); // public profile, no sharing choice
  g.post(student({ email: 'a@x.org', profileVisibility: 'cohort', citizenshipGroup: 'non_eu_eea_swiss', citizenshipVisibility: 'cohort',
    studyVisaExperience: 'yes', studyVisaExperienceVisibility: 'cohort' }));
  g.post(student({ email: 'h@x.org', profileVisibility: 'hidden', citizenshipGroup: 'eu_eea_swiss', citizenshipVisibility: 'cohort',
    studyVisaExperience: 'no', studyVisaExperienceVisibility: 'cohort' }));
  g.post(student({ email: 'p@x.org', citizenshipGroup: 'prefer_not_to_say', citizenshipVisibility: 'cohort', studyVisaExperienceVisibility: 'cohort' }));
  const vis = (i) => [g.row(i)['Citizenship Visibility'], g.row(i)['Study Visa Experience Visibility']];
  assert.deepStrictEqual(vis(1), ['private', 'private'], 'a public profile does not make citizenship public');
  assert.deepStrictEqual(vis(2), ['cohort', 'cohort']);
  assert.deepStrictEqual(vis(3), ['private', 'private'], 'hidden profile');
  assert.deepStrictEqual(vis(4), ['private', 'private'], 'prefer not to say / skipped are never shared');
  assert.strictEqual(g.post(student({ email: 'x@x.org', citizenshipGroup: 'eu_eea_swiss', citizenshipVisibility: 'public' })).code, 'INVALID_VALUE');
});
t('study-visa experience: five answers, self-reported scope; skipped stays "not_provided"; never derived from citizenship', () => {
  const g = fresh();
  ['yes', 'no', 'not_sure', 'not_applicable', 'prefer_not_to_say'].forEach((v, i) => g.post(student({ email: `v${i}@x.org`, studyVisaExperience: v })));
  g.post(student({ email: 'n@x.org', citizenshipGroup: 'non_eu_eea_swiss', primaryCountry: 'India' }));
  for (let i = 1; i <= 5; i++) assert.strictEqual(g.row(i)['Study Visa Experience Scope'], 'first_semester_italy');
  assert.deepStrictEqual([g.row(6)['Study Visa Experience'], g.row(6)['Study Visa Experience Scope']], ['not_provided', '']);
  assert.strictEqual(g.post(student({ email: 'b@x.org', studyVisaExperience: 'visa D-123' })).code, 'INVALID_VALUE');
});
t('mobility-statistics consent: separate, "no" unless an explicit "yes"', () => {
  const g = fresh();
  g.post(student({ citizenshipGroup: 'eu_eea_swiss' })); g.post(student({ email: 'y@x.org', mobilityStatisticsConsent: 'yes' }));
  g.post(student({ email: 't@x.org', mobilityStatisticsConsent: true })); g.post(student({ email: 's@x.org', analyticsConsent: 'yes', mobilityStatisticsConsent: 'no' }));
  assert.deepStrictEqual([1, 2, 3, 4].map((i) => g.row(i)['Mobility Statistics Consent']), ['no', 'yes', 'no', 'no']);
  assert.strictEqual(g.row(4)['Anonymous Aggregated Statistics Consent'], 'yes', 'general and mobility statistics are separate');
});
t('per-detail visibility: missing = hidden, clamped to the profile, never wider', () => {
  const g = fresh(); const fv = (i) => JSON.parse(g.row(i)['Field Visibility JSON']);
  g.post(student());
  g.post(student({ email: 'a@x.org', fieldVisibility: { country: 'public', field: 'cohort', degree: 'hidden', university: 'public', track: 'public', bio: 'cohort' } }));
  g.post(student({ email: 'b@x.org', profileVisibility: 'cohort', fieldVisibility: { country: 'public', field: 'public', degree: 'public', university: 'public', track: 'public', bio: 'public' } }));
  g.post(student({ email: 'c@x.org', profileVisibility: 'hidden', fieldVisibility: { country: 'public', track: 'cohort' } }));
  const all = (v) => ({ country: v, field: v, degree: v, university: v, track: v, bio: v });
  assert.deepStrictEqual(fv(1), all('hidden'));
  assert.deepStrictEqual(fv(2), { country: 'public', field: 'cohort', degree: 'hidden', university: 'public', track: 'public', bio: 'cohort' });
  assert.deepStrictEqual(fv(3), all('cohort'));
  assert.deepStrictEqual(fv(4), all('hidden'));
  assert.strictEqual(g.post(student({ email: 'd@x.org', fieldVisibility: { country: 'everyone' } })).code, 'INVALID_VALUE');
});
t('shared-course and staff registrations get no mobility or directory-visibility data', () => {
  const g = fresh(); const extra = { citizenshipGroup: 'non_eu_eea_swiss', citizenshipVisibility: 'cohort', studyVisaExperience: 'yes',
    mobilityStatisticsConsent: 'yes', fieldVisibility: { country: 'public' } };
  g.post(shared(extra)); g.post(faculty(extra));
  for (const i of [1, 2]) for (const c of V3_COLUMNS) assert.strictEqual(g.row(i)[c], '', `${i} ${c}`);
});
t('confirmation email never mentions citizenship or visa answers', () => {
  const g = fresh(); g.post(student({ citizenshipGroup: 'non_eu_eea_swiss', citizenshipVisibility: 'cohort', studyVisaExperience: 'yes', profileVisibility: 'cohort' }));
  assert.ok(!/citizen|visa|EEA|mobility/i.test(g.mails[0].body));
});
t('migrateV3 fills only empty cells with "nothing given" values, never infers, and is repeatable', () => {
  const g = fresh(); const v2 = g.grid[0].slice(0, 56);
  const oldRow = v2.map((h) => (h === 'Primary Country' ? 'Syria' : h === 'Profile Visibility' ? 'public' : 'old ' + h));
  g.grid.length = 0; g.grid.push(v2.slice(), oldRow.slice(), oldRow.slice());
  g.ctx.setup_();
  assert.strictEqual(g.grid[0].length, 63); assert.strictEqual(g.grid[1][56], undefined, 'setup alone writes no values');
  g.grid[2][g.grid[0].indexOf('Citizenship Group')] = 'eu_eea_swiss'; // an answer already there
  assert.match(g.ctx.migrateV3_(), /2 row\(s\) checked, 11 empty cell/);
  assert.deepStrictEqual(mob(g.row(1)), ['not_provided', 'private', 'not_provided', '', 'private', 'no']);
  assert.deepStrictEqual(JSON.parse(g.row(1)['Field Visibility JSON']), { country: 'hidden', field: 'hidden', degree: 'hidden', university: 'hidden', track: 'hidden', bio: 'hidden' });
  assert.strictEqual(g.row(2)['Citizenship Group'], 'eu_eea_swiss', 'existing values are never overwritten');
  assert.strictEqual(g.row(1)['Full Name'], 'old Full Name');
  assert.match(g.ctx.migrateV3_(), /0 empty cell/);
});
t('duplicate headers stop the script instead of writing to the wrong column', () => {
  const g = fresh(); g.grid[0].push('Citizenship Group');
  assert.strictEqual(g.post(student()).code, 'NOT_CONFIGURED'); assert.strictEqual(g.grid.length, 1);
});

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
  assert.strictEqual(r.ok, true); assert.strictEqual(g.grid.length, 2); assert.strictEqual(g.mails.length, 1);
  assert.strictEqual(r.requestId, b.requestId); assert.strictEqual(r.consentVersion, b.consentVersion); assert.strictEqual(r.directoryEligible, true); });
t('a lost response followed by an email change cannot save a second row with the same request ID', () => {
  const g = fresh(); const b = student(); g.post(b);
  const r = g.post({ ...b, email: 'different@example.org' });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'REQUEST_CONFLICT');
  assert.strictEqual(g.grid.length, 2); assert.strictEqual(g.mails.length, 1);
});
t('retry reports a failed email truthfully and keeps a private non-directory registration private', () => {
  const g = fresh({ __MAIL_FAILS: true }); const b = shared(); g.post(b); const r = g.post(b);
  assert.strictEqual(r.confirmation, 'failed'); assert.strictEqual(r.directoryEligible, false);
  assert.strictEqual(g.row(1)['Status'], 'unconfirmed'); assert.strictEqual(g.grid.length, 2);
  assert.strictEqual(g.mails.length, 0);
});
t('retry after explicit email confirmation reports the saved review status without sending another email', () => {
  const g = fresh(); const b = student(); g.post(b); const q = linkOf(g);
  g.confirm(q.get('id'), q.get('token'));
  assert.strictEqual(g.post(b).confirmation, 'not_required'); assert.strictEqual(g.mails.length, 1);
  assert.strictEqual(g.row(1)['Role Verification Status'], 'pending');
});
t('duplicate email is refused with the friendly message and no stored data', () => { const g = fresh(); g.post(student({ shortBio: 'private' }));
  const r = g.post(alumnus({ email: 'TEST.student@studio.unibo.it' }));
  assert.strictEqual(r.code, 'DUPLICATE_EMAIL'); assert.match(r.message, /Profile editing will be available later/); assert.ok(!JSON.stringify(r).includes('private')); });
t('honeypot, too-fast, bad consent, bad JSON are refused', () => { const g = fresh();
  assert.strictEqual(g.post(student({ website: 'x' })).code, 'INVALID_REQUEST');
  assert.strictEqual(g.post(student({ elapsedMs: 500 })).code, 'INVALID_REQUEST');
  assert.strictEqual(g.post(student({ privacyAcknowledgement: '' })).code, 'CONSENT_REQUIRED');
  assert.strictEqual(g.post(student({ consentVersion: 'directory-v1-2026-10' })).code, 'CONSENT_VERSION');
  assert.strictEqual(g.post(student({ consentVersion: 'directory-v2-2026-10' })).code, 'CONSENT_VERSION', 'v2 consent does not count as v3');
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
t('hourly limit uses stored timestamps rather than locale-dependent displayed dates', () => {
  const g = fresh(); const sheet = g.sheets.Submissions, getRange = sheet.getRange;
  sheet.getRange = (...args) => {
    const range = getRange(...args);
    return { ...range, getDisplayValues: () => range.getValues().map(row => row.map(value =>
      Object.prototype.toString.call(value) === '[object Date]' ? '31/12/1999 12:00:00' : String(value ?? ''))) };
  };
  let last;
  for (let i = 0; i < 61; i++) last = g.post(student({ email: `locale${i}@example.org` }));
  assert.strictEqual(last.code, 'BUSY'); assert.strictEqual(g.grid.length, 61);
});
t('unexpected errors do not leak details', () => { const g = fresh(); g.ctx.SpreadsheetApp.openById = () => { throw new Error('secret internal detail'); };
  const r = g.post(student()); assert.strictEqual(r.ok, false); assert.ok(!JSON.stringify(r).includes('secret')); });

/* ----- three separate states: email confirmed ≠ role verified ≠ admin approved ----- */
t('email confirmed, role verified and admin approved are three separate states', () => {
  const g = fresh(); g.post(student()); const q = linkOf(g);
  g.confirm(q.get('id'), q.get('token'));
  let row = g.row(1);
  assert.ok(row['Email Confirmed At'], 'email confirmed');
  assert.strictEqual(row['Role Verification Status'], 'pending', 'confirming the email does not verify the role');
  assert.strictEqual(row['Status'], 'pending', 'confirming the email does not approve');
  assert.deepStrictEqual([row['Public Publish Eligible'], row['Cohort Publish Eligible']], [false, false]);
  // An admin verifies the role by hand: the status is still not approved
  g.grid[1][g.grid[0].indexOf('Role Verification Status')] = 'verified';
  row = g.row(1); assert.strictEqual(row['Status'], 'pending');
  // Nothing the browser sends can set these states
  g.post(student({ email: 'z@x.org', Status: 'approved', roleVerificationStatus: 'verified', emailConfirmedAt: '2026-01-01' }));
  row = g.row(2); assert.deepStrictEqual([row['Status'], row['Role Verification Status'], row['Email Confirmed At']], ['unconfirmed', 'pending', '']);
});
t('old Script Properties ALLOWED_EMAIL_DOMAINS and COLLECT_PHONE have no effect', () => {
  const g = fresh({ ALLOWED_EMAIL_DOMAINS: 'studio.unibo.it', COLLECT_PHONE: 'true' });
  assert.strictEqual(g.post(alumnus({ email: 'someone@gmail.com', phone: '+39 333 1234567' })).ok, true);
  assert.strictEqual(g.row(1)['Phone / WhatsApp'], '');
});

/* ----- retention (values from RETENTION in Code.gs, never typed here) ----- */
const vm = require('vm');
const R = (g) => vm.runInContext('RETENTION', g.ctx);
const DAY = 86400000;
const col = (g, name) => g.grid[0].indexOf(name);
const setCell = (g, i, name, v) => { g.grid[i][col(g, name)] = v; };
const report = (g, now) => [...g.ctx.retentionReport_(now)].map((x) => `${x.row}:${x.action}`);
t('retention: every value lives in RETENTION; the confirmation link lasts unconfirmedDays', () => {
  const g = fresh(); const ret = R(g);
  for (const k of ['unconfirmedDays', 'rejectedDays', 'studentMonthsAfterGraduation', 'graduationMonthDay', 'alumniMonths', 'reminderDays',
    'sharedCourseMonths', 'staffMonthsAfterInvolvement', 'deletionRequestDays']) assert.ok(ret[k] !== undefined, k);
  g.post(student()); assert.ok(g.mails[0].body.includes(`works for ${ret.unconfirmedDays} days`));
  const q = linkOf(g);
  setCell(g, 1, 'Submitted At', new Date(Date.now() - (ret.unconfirmedDays + 1) * DAY));
  assert.strictEqual(g.confirm(q.get('id'), q.get('token')).title, 'Link expired');
});
t('retention: unconfirmed rows are due after unconfirmedDays; rejected rows rejectedDays after "Rejected At"', () => {
  const g = fresh(); const ret = R(g); g.post(student()); g.post(alumnus({ email: 'r@x.org' }));
  const now = Date.now();
  assert.ok(!report(g, now).includes('2:delete'));
  assert.ok(report(g, now + (ret.unconfirmedDays + 1) * DAY).includes('2:delete'));
  setCell(g, 2, 'Status', 'rejected');
  assert.ok(report(g, now).includes('3:fill'), 'asks for Rejected At');
  setCell(g, 2, 'Rejected At', new Date(now));
  assert.ok(!report(g, now + (ret.rejectedDays - 1) * DAY).includes('3:delete'));
  assert.ok(report(g, now + (ret.rejectedDays + 1) * DAY).includes('3:delete'));
});
t('retention: current students until studentMonthsAfterGraduation after the cohort ends, with an alumni invitation first', () => {
  const g = fresh(); const ret = R(g); g.post(student({ cohort: '2026–2028' })); setCell(g, 1, 'Status', 'pending');
  const end = new Date('2028-' + ret.graduationMonthDay + 'T00:00:00'); end.setMonth(end.getMonth() + ret.studentMonthsAfterGraduation);
  assert.deepStrictEqual(report(g, new Date('2027-06-01').getTime()), []);
  assert.deepStrictEqual(report(g, end.getTime() - (ret.reminderDays - 1) * DAY), ['2:ask']);
  assert.deepStrictEqual(report(g, end.getTime() + DAY), ['2:delete']);
});
t('retention: alumni alumniMonths after the last (re)confirmation, reminder reminderDays before', () => {
  const g = fresh(); const ret = R(g); g.post(alumnus()); setCell(g, 1, 'Status', 'approved');
  const base = new Date('2026-10-05T00:00:00'); setCell(g, 1, 'Email Confirmed At', base);
  const end = new Date(base); end.setMonth(end.getMonth() + ret.alumniMonths);
  assert.deepStrictEqual(report(g, end.getTime() - (ret.reminderDays + 5) * DAY), []);
  assert.deepStrictEqual(report(g, end.getTime() - (ret.reminderDays - 5) * DAY), ['2:ask']);
  assert.deepStrictEqual(report(g, end.getTime() + DAY), ['2:delete']);
  setCell(g, 1, 'Last Reconfirmed At', new Date(end.getTime() - 10 * DAY));
  assert.deepStrictEqual(report(g, end.getTime() + DAY), [], 'reconfirming restarts the period');
});
t('retention: shared-course and staff rows need "Participation Ends", then sharedCourseMonths / staffMonthsAfterInvolvement', () => {
  const g = fresh(); const ret = R(g); g.post(shared()); g.post(faculty());
  setCell(g, 1, 'Status', 'pending'); setCell(g, 2, 'Status', 'approved');
  assert.deepStrictEqual(report(g, Date.now()), ['2:fill', '3:fill']);
  const ends = new Date('2027-01-31T00:00:00'); setCell(g, 1, 'Participation Ends', ends); setCell(g, 2, 'Participation Ends', ends);
  const after = (m) => { const d = new Date(ends); d.setMonth(d.getMonth() + m); return d.getTime(); };
  assert.deepStrictEqual(report(g, after(ret.sharedCourseMonths) - DAY), []);
  assert.deepStrictEqual(report(g, after(Math.max(ret.sharedCourseMonths, ret.staffMonthsAfterInvolvement)) + DAY), ['2:delete', '3:delete']);
});
t('retention report shows row numbers and ids only, never names or emails', () => {
  const g = fresh(); g.post(student({ fullName: 'Secret Person' })); const logs = [];
  g.ctx.console.log = (s) => logs.push(s);
  g.ctx.retentionReport_(Date.now() + 400 * DAY);
  assert.ok(logs.join(' ').includes('Row 2')); assert.ok(!/Secret|studio\.unibo/.test(logs.join(' ')));
});
console.log(n + ' backend checks passed');
