// Students explorer: demo data, privacy projections, filters, statistics (no browser needed).
// Run: node tests/students/data.test.js .
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(process.argv[2] || '.');
const D = require(path.join(ROOT, 'students-data.js'));
const { EUHEM_COUNTRY_BY_CODE } = require(path.join(ROOT, 'countries.js'));
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'directory-options.js'), 'utf8'), sandbox);
const { OPTIONS } = sandbox.window.EUHEM_DIRECTORY_OPTIONS;
const demoText = fs.readFileSync(path.join(ROOT, 'data/demo-students.json'), 'utf8');
const demo = JSON.parse(demoText);
const records = demo.records;
const aggregates = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/demo-aggregates.json'), 'utf8'));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('  ok  ' + name); };
const count = (list, fn) => list.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const sorted = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort()));
const A = '2026–2028', B = '2025–2027';
const PUBLIC = D.makeViewer('public'), MEMBER = D.makeViewer('member');
const pub = D.projectAll(records, PUBLIC), mem = D.projectAll(records, MEMBER);
const byName = (list, name) => list.find((p) => p.name === name);
const rec = (name) => records.find((r) => r.fullName === name);

/* ----- demo data ----- */
t('exactly 40 fictional records, all isDemo, stable non-email ids demo-001…demo-040', () => {
  assert.strictEqual(records.length, 40); assert.strictEqual(demo.isDemo, true);
  records.forEach((r, i) => { assert.strictEqual(r.isDemo, true); assert.strictEqual(r.id, `demo-${String(i + 1).padStart(3, '0')}`); });
});
t('exact country distribution; 36 geographically European and 4 outside Europe', () => {
  assert.strictEqual(sorted(count(records, (r) => r.primaryCountryCode)), sorted({ NL: 12, IT: 8, DE: 6, NO: 6, ES: 2, PT: 1, AT: 1, SY: 1, IN: 1, NG: 1, BR: 1 }));
  assert.strictEqual(records.filter((r) => EUHEM_COUNTRY_BY_CODE[r.primaryCountryCode].europe).length, 36);
  for (const r of records) assert.strictEqual(r.primaryCountryName, EUHEM_COUNTRY_BY_CODE[r.primaryCountryCode].name);
});
t('32 records in 2026–2028 and 8 in 2025–2027, all current students (no invented alumni)', () => {
  assert.strictEqual(sorted(count(records, (r) => r.cohort)), sorted({ [A]: 32, [B]: 8 }));
  for (const r of records) assert.deepStrictEqual([r.userType, r.membershipStatus], ['current_student', 'current_student']);
});
t('tracks: the four current tracks plus the two non-track answers, in the exact numbers', () => {
  assert.strictEqual(sorted(count(records.filter((r) => r.cohort === A), (r) => r.trackId)), sorted({ mhi: 10, eeh: 9, ep: 7, phm: 4, not_chosen: 1, prefer_not_to_share: 1 }));
  assert.strictEqual(sorted(count(records.filter((r) => r.cohort === B), (r) => r.trackId)), sorted({ mhi: 2, eeh: 2, ep: 2, phm: 2 }));
  for (const r of records) assert.ok(D.TRACK_VALUES.includes(r.trackId), r.trackId);
});
t('academic fields use the registration ids, in the exact numbers (Nursing and Dentistry separate)', () => {
  const bucket = { quantitative_data: 'eng', engineering_technology: 'eng', psychology_behaviour: 'psy', social_sciences: 'psy' };
  assert.strictEqual(sorted(count(records, (r) => bucket[r.previousFieldId] || r.previousFieldId)), sorted({
    medicine: 6, economics: 6, public_health: 4, business_management_finance: 4, pharmacy: 3, health_sciences: 3, biomedical_life_sciences: 3,
    nursing_midwifery: 2, dentistry: 2, political_policy_ir: 2, eng: 2, psy: 2, law: 1 }));
  for (const r of records) {
    assert.strictEqual(r.previousFieldLabel, OPTIONS.academicFields[r.previousFieldId]);
    if (r.previousDegreeId) assert.strictEqual(r.previousDegreeLabel, OPTIONS.degrees[r.previousDegreeId]);
  }
  const degrees = new Set(records.map((r) => r.previousDegreeId));
  for (const d of ['bsc', 'ba', 'medicine', 'nursing', 'msc', 'mph']) assert.ok(degrees.has(d), d);
});
t('privacy scenarios: 24 public, 12 EU-HEM only, 4 hidden', () => {
  assert.strictEqual(sorted(count(records, (r) => r.profileVisibility)), sorted({ public: 24, cohort: 12, hidden: 4 }));
});
t('edge cases are present: long names, diacritics, missing optional details, additional countries, field-level choices', () => {
  assert.ok(records.some((r) => r.fullName.length >= 28));
  assert.ok(records.some((r) => /[^\x00-\x7f]/.test(r.fullName)));
  assert.ok(records.some((r) => !r.previousDegreeId)); assert.ok(records.some((r) => !r.previousUniversity));
  assert.ok(records.some((r) => !r.linkedin)); assert.ok(records.some((r) => r.additionalCountryCode));
  assert.ok(records.some((r) => r.profileVisibility === 'public' && Object.values(r.fieldVisibility).some((v) => v !== 'public')));
  assert.ok(records.some((r) => r.shortBio.length < 60) && records.some((r) => r.shortBio.length > 140));
});
t('no real-person data: no emails, no photos, no web addresses, LinkedIn only the word "example"', () => {
  assert.ok(!demoText.includes('@'), 'no email addresses'); assert.ok(!/https?:|www\./i.test(demoText), 'no web addresses');
  for (const r of records) { assert.strictEqual(r.photo, null); assert.ok(r.linkedin === null || r.linkedin === 'example'); assert.ok(!('email' in r)); }
});
t('the demo generator is deterministic (re-running it changes nothing)', () => {
  const before = [demoText, fs.readFileSync(path.join(ROOT, 'data/demo-aggregates.json'), 'utf8')];
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/build-demo-students.js')], { cwd: ROOT });
  assert.deepStrictEqual([fs.readFileSync(path.join(ROOT, 'data/demo-students.json'), 'utf8'), fs.readFileSync(path.join(ROOT, 'data/demo-aggregates.json'), 'utf8')], before);
});

/* ----- privacy projections ----- */
t('public preview shows 24 profiles, member preview 36; hidden profiles in neither', () => {
  assert.strictEqual(pub.length, 24); assert.strictEqual(mem.length, 36);
  const hidden = records.filter((r) => r.profileVisibility === 'hidden').map((r) => r.id);
  for (const id of hidden) { assert.ok(!pub.some((p) => p.id === id)); assert.ok(!mem.some((p) => p.id === id)); }
  for (const p of pub) assert.strictEqual(rec(p.name).profileVisibility, 'public');
});
t('projections are allowlisted: no email, consent, admin, visibility or private citizenship data', () => {
  const allowed = new Set(['id', 'isDemo', 'name', 'cohort', 'membership', 'membersOnly', 'country', 'additionalCountry', 'field', 'degree',
    'university', 'track', 'bio', 'linkedin', 'photo', 'citizenshipGroup', 'studyVisaExperience']);
  for (const p of [...pub, ...mem]) for (const k of Object.keys(p)) assert.ok(allowed.has(k), k);
  const text = JSON.stringify(pub);
  for (const s of ['citizenship', 'Visa', 'fieldVisibility', 'adminStatus', 'Consent', 'emailVerified', 'profileVisibility']) assert.ok(!text.includes(s), s);
});
t('field-level visibility: narrower details disappear for viewers who may not see them', () => {
  assert.strictEqual(byName(pub, 'Daan Verhoeven').degree, undefined); // degree hidden
  assert.strictEqual(byName(pub, 'Joris Kuipers').linkedin, undefined); assert.strictEqual(byName(mem, 'Joris Kuipers').linkedin, 'example'); // LinkedIn members only
  assert.strictEqual(byName(pub, 'Håkon Lyngstad').country, undefined); assert.strictEqual(byName(mem, 'Håkon Lyngstad').country.code, 'NO');
  assert.strictEqual(byName(pub, 'Isa Jansen').university, undefined); assert.strictEqual(byName(mem, 'Isa Jansen').university, 'University of Amsterdam');
});
t('unknown or missing visibility fails closed; unverified or unapproved records are never shown', () => {
  const base = rec('Giulia Ferraretti');
  assert.strictEqual(D.projectProfile({ ...base, profileVisibility: 'everyone' }, MEMBER), null);
  assert.strictEqual(D.projectProfile({ ...base, profileVisibility: undefined }, MEMBER), null);
  assert.strictEqual(D.projectProfile({ ...base, fieldVisibility: { ...base.fieldVisibility, country: 'world' } }, PUBLIC).country, undefined);
  assert.strictEqual(D.projectProfile({ ...base, fieldVisibility: undefined }, PUBLIC).country, undefined);
  for (const change of [{ emailVerified: false }, { roleVerification: 'pending' }, { adminStatus: 'pending' }, { fullName: '' }]) {
    assert.strictEqual(D.projectProfile({ ...base, ...change }, PUBLIC), null, JSON.stringify(change));
  }
});
t('the member preview never unlocks a non-demo (real) record', () => {
  const real = { ...rec('Femke Bakker'), isDemo: false, citizenshipVisibility: 'cohort' };
  assert.strictEqual(D.projectProfile(real, MEMBER), null, 'members-only real record');
  const realPublic = { ...rec('Noor El Amrani'), isDemo: false };
  const p = D.projectProfile(realPublic, MEMBER);
  assert.ok(p && p.citizenshipGroup === undefined && p.studyVisaExperience === undefined);
  assert.strictEqual(D.makeViewer('admin').mode, 'public'); assert.strictEqual(D.makeViewer(undefined).mode, 'public');
});
t('citizenship: never public; members see only voluntarily shared substantive answers', () => {
  for (const p of pub) { assert.strictEqual(p.citizenshipGroup, undefined); assert.strictEqual(p.studyVisaExperience, undefined); }
  const shared = mem.filter((p) => p.citizenshipGroup).map((p) => p.name).sort();
  const expected = records.filter((r) => r.profileVisibility !== 'hidden' && r.citizenshipVisibility === 'cohort' && D.CITIZENSHIP_GROUPS.includes(r.citizenshipGroup)).map((r) => r.fullName).sort();
  assert.deepStrictEqual(shared, expected);
  assert.ok(!mem.some((p) => p.citizenshipGroup === 'prefer_not_to_say'));
  assert.strictEqual(D.projectProfile({ ...rec('Sunniva Bråten'), citizenshipVisibility: 'cohort' }, MEMBER).citizenshipGroup, undefined, 'prefer not to say');
});
t('represented country does not determine citizenship (dual-citizenship counterexamples)', () => {
  const rami = byName(mem, 'Rami Haddad-Kassem'), isa = byName(mem, 'Isa Jansen');
  assert.deepStrictEqual([rami.country.code, rami.citizenshipGroup], ['SY', 'eu_eea_swiss']);
  assert.deepStrictEqual([isa.country.code, isa.citizenshipGroup], ['NL', 'non_eu_eea_swiss']);
  assert.strictEqual(rec('Paul Brandstätter').citizenshipGroup, null, 'skipped stays null (not provided), not "prefer not to say"');
  assert.strictEqual(rec('Sunniva Bråten').citizenshipGroup, 'prefer_not_to_say');
  const src = fs.readFileSync(path.join(ROOT, 'students-data.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'students.js'), 'utf8');
  assert.ok(!/europe[^\n]*citizenship|citizenship[^\n]*\.europe/i.test(src), 'no code links geography to citizenship');
});
t('no automatic visa classification: a non-EU citizen without an answer has no visa value', () => {
  const ananya = rec('Ananya Raghunathan Iyer'); assert.strictEqual(ananya.studyVisaExperience, 'yes');
  assert.strictEqual(rec('Chidinma Okafor-Adeyemi').studyVisaExperienceVisibility, 'private');
  assert.strictEqual(byName(mem, 'Chidinma Okafor-Adeyemi').studyVisaExperience, undefined);
  assert.strictEqual(D.projectProfile({ ...rec('Isa Jansen'), studyVisaExperience: null }, MEMBER).studyVisaExperience, undefined);
});

/* ----- filters, search, counts ----- */
t('private fields never affect public search, filters or counts', () => {
  assert.strictEqual(D.filterProfiles(pub, { q: 'Amsterdam' }).length, 0, 'university visible to members only');
  assert.strictEqual(D.filterProfiles(mem, { q: 'Amsterdam' }).length, 1);
  assert.strictEqual(D.filterProfiles(pub, { country: ['NO'] }).some((p) => p.name === 'Håkon Lyngstad'), false);
  assert.strictEqual(D.facetCounts(pub, {}, 'country').NL, 7);
  assert.strictEqual(D.facetCounts(mem, {}, 'country').NL, 10);
  assert.strictEqual(D.filterProfiles(pub, { citizenship: ['non_eu_eea_swiss'] }).length, 0, 'no citizenship values in public projections');
  assert.strictEqual(D.filterProfiles(pub, { hasLinkedin: true }).some((p) => p.name === 'Joris Kuipers'), false, 'LinkedIn visible to members only');
});
t('member-only filters use only voluntarily shared values', () => {
  const nonEu = D.filterProfiles(mem, { citizenship: ['non_eu_eea_swiss'] }).map((p) => p.name).sort();
  assert.deepStrictEqual(nonEu, ['Ananya Raghunathan Iyer', 'Isa Jansen']);
  const visaYes = D.filterProfiles(mem, { visa: ['yes'] }).map((p) => p.name).sort();
  assert.deepStrictEqual(visaYes, ['Ananya Raghunathan Iyer', 'Isa Jansen']);
});
t('combined filters: OR within a category, AND between categories', () => {
  const f = { track: ['mhi', 'eeh'], background: ['medicine'], cohort: [A] };
  const expected = pub.filter((p) => ['mhi', 'eeh'].includes(p.track) && p.field && p.field.id === 'medicine' && p.cohort === A).map((p) => p.id);
  assert.deepStrictEqual(D.filterProfiles(pub, f).map((p) => p.id), expected);
  assert.ok(expected.length >= 2);
  assert.strictEqual(D.filterProfiles(pub, { country: ['IT', 'NO'] }).length, (D.facetCounts(pub, {}, 'country').IT || 0) + (D.facetCounts(pub, {}, 'country').NO || 0));
});
t('faceted map counts ignore the country selection but follow every other filter', () => {
  const f = { country: ['NL'], track: ['mhi'] };
  const counts = D.facetCounts(pub, f, 'country');
  assert.strictEqual(counts.IT, pub.filter((p) => p.track === 'mhi' && p.country && p.country.code === 'IT').length);
  assert.strictEqual(counts.NL, D.filterProfiles(pub, f).length, 'the selected country matches the results');
});
t('search is case-, accent- and whitespace-insensitive and only uses visible fields', () => {
  for (const q of ['schafermeyer', '  LENA   schäfermeyer ', 'heidelberg']) assert.deepStrictEqual(D.filterProfiles(pub, { q }).map((p) => p.name), ['Lena Schäfermeyer'], q);
  assert.ok(D.filterProfiles(pub, { q: 'population health', labels: { tracks: OPTIONS.currentTracks } }).length >= 1, 'track names are searchable');
});
t('sorting is stable, never splits names, cohort newest first; counts do not depend on the page', () => {
  const names = D.sortProfiles(pub, 'name').map((p) => p.name);
  assert.deepStrictEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
  assert.deepStrictEqual(D.sortProfiles(pub, 'country').map((p) => p.id), D.sortProfiles([...pub].reverse(), 'country').map((p) => p.id));
  const cohorts = D.sortProfiles(mem, 'cohort').map((p) => p.cohort);
  assert.strictEqual(cohorts[0], A); assert.strictEqual(cohorts[cohorts.length - 1], B);
  const p1 = D.paginate(pub, 1, 12), p2 = D.paginate(pub, 2, 12), p9 = D.paginate(pub, 9, 12);
  assert.deepStrictEqual([p1.items.length, p2.items.length, p1.pages, p9.page], [12, 12, 2, 2]);
});
t('the page address carries only public filters: never citizenship or visa; unknown values dropped', () => {
  const allowed = { cohort: [A, B], country: ['NL', 'IT'], track: D.TRACK_VALUES, background: ['medicine'], degree: ['bsc'] };
  const s = D.readUrlState('?country=NL,XX&track=mhi,hack&citizenship=eu_eea_swiss&visa=yes&profile=demo-014&view=list', allowed);
  assert.deepStrictEqual([s.country, s.track, s.profile, s.view], [['NL'], ['mhi'], 'demo-014', 'list']);
  assert.ok(!('citizenship' in s) && !('visa' in s));
  const url = D.writeUrlState({ country: ['NL'], citizenship: ['eu_eea_swiss'], visa: ['yes'], view: 'cards', profile: null });
  assert.strictEqual(url, '?country=NL');
  assert.strictEqual(D.readUrlState('?profile=<script>', allowed).profile, null);
});

/* ----- statistics ----- */
t('disclosure control: small groups suppressed, with complementary suppression; tiny totals not published', () => {
  assert.deepStrictEqual(D.safeBreakdown({ a: 3, b: 1 }, 5).publishable, false, 'total under 5');
  const one = D.safeBreakdown({ a: 20, b: 2, c: 9 }, 5);
  assert.deepStrictEqual(one.cells, { a: 20, b: null, c: null }, 'the next smallest is hidden too');
  const two = D.safeBreakdown({ a: 20, b: 2 }, 5);
  assert.strictEqual(two.publishable, false); assert.strictEqual(two.message, 'Not enough publishable data for this breakdown.');
  assert.deepStrictEqual(D.safeBreakdown({ a: 6, b: 7 }, 5).cells, { a: 6, b: 7 });
  const many = D.safeBreakdown({ a: 30, b: 1, c: 2, d: 0 }, 5);
  assert.deepStrictEqual(many.cells, { a: 30, b: null, c: null, d: 0 });
});
t('mobility aggregates: fictional, consenting substantive answers only, no small visible cells, no names', () => {
  assert.strictEqual(aggregates.isDemo, true); assert.match(aggregates.note, /FICTIONAL/);
  const text = JSON.stringify(aggregates);
  for (const r of records) assert.ok(!text.includes(r.fullName) && !text.includes(r.id));
  for (const [cohort, data] of Object.entries(aggregates.cohorts)) {
    const consenting = records.filter((r) => r.cohort === cohort && r.mobilityStatisticsConsent);
    const citizenship = { eu_eea_swiss: 0, non_eu_eea_swiss: 0 };
    for (const r of consenting) if (r.citizenshipGroup in citizenship) citizenship[r.citizenshipGroup]++;
    assert.deepStrictEqual({ ...data.citizenship, denominator: undefined }, { ...D.safeBreakdown(citizenship, 5), denominator: undefined });
    assert.match(data.citizenship.denominator, /consenting/);
    for (const release of [data.citizenship, data.studyVisaExperience]) {
      for (const v of Object.values(release.cells)) assert.ok(v === null || v === 0 || v >= 5, `${cohort} ${v}`);
      if (!release.publishable) assert.strictEqual(release.total, null);
      assert.ok(!('prefer_not_to_say' in release.cells) && !('not_provided' in release.cells), 'refusals are not a published group');
    }
  }
  assert.strictEqual(aggregates.cohorts[B].citizenship.publishable, false, 'a small cohort is not broken down');
});

console.log(n + ' students data checks passed');
