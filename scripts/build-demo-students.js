// ===== Build the fictional demo data for the Students explorer =====
// Writes:
//   data/demo-students.json    40 FICTIONAL records (invented names, no photos, no emails, no real profiles)
//   data/demo-aggregates.json  FICTIONAL whole-cohort mobility statistics, precomputed with disclosure rules
//
// Run after changing the table below:  node scripts/build-demo-students.js
// The script refuses to write anything unless every distribution in docs/students-explorer.md is exact.
//
// The records use the same ids as registration (directory-options.js) and the same country codes as
// countries.js. They imitate the PRIVATE source shape (with per-field visibility, citizenship, consents),
// so the explorer's privacy projections can be tested. Real private records must never be put in the site.

const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const { EUHEM_COUNTRY_BY_CODE } = require("../countries.js");
const { safeBreakdown } = require("../students-data.js");
const sandbox = { window: {} };
require("vm").runInNewContext(fs.readFileSync(path.join(ROOT, "directory-options.js"), "utf8"), sandbox);
const { OPTIONS } = sandbox.window.EUHEM_DIRECTORY_OPTIONS;

// Visibility shorthands for the per-field settings of a profile (see students-data.js → PROFILE_FIELDS)
const P = "public", C = "cohort", H = "hidden";
const OPEN = { photo: P, country: P, field: P, degree: P, university: P, track: P, bio: P, linkedin: P };
const MEMBERS = { photo: C, country: C, field: C, degree: C, university: C, track: C, bio: C, linkedin: C };

// One row per fictional person:
// [name, country, cohort, track, field, degree, previous university, profile visibility, field overrides,
//  citizenship group, citizenship shared?, visa experience, visa shared?, mobility-statistics consent,
//  additional country, LinkedIn example?, bio]
const A = "2026–2028", B = "2025–2027";
const ROWS = [
  ["Lotte van der Meulen-Oosterbeek", "NL", A, "mhi", "medicine", "medicine", "Erasmus University Rotterdam", P, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Worked for two years as a junior doctor in a regional hospital. Now curious about how hospitals are managed and financed, and always up for a long bike ride."],
  ["Daan Verhoeven", "NL", A, "eeh", "economics", "bsc", "Tilburg University", P, { degree: H }, "eu_eea_swiss", true, "not_applicable", false, true, null, true,
    "Economist interested in cost-effectiveness models."],
  ["Femke Bakker", "NL", A, "ep", "public_health", "mph", "Maastricht University", C, {}, "eu_eea_swiss", false, null, false, true, null, false,
    "Public health graduate who enjoys policy debates, field trips and good coffee."],
  ["Joris Kuipers", "NL", A, "mhi", "business_management_finance", "bba", null, P, { linkedin: C }, "eu_eea_swiss", false, "not_applicable", false, false, null, true,
    "Business background, previously in hospital procurement."],
  ["Maud Hendriksen", "NL", A, "eeh", "pharmacy", "pharmacy", "Utrecht University", P, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, false,
    "Community pharmacist turned health economist in training. Interested in market access and pricing of new medicines, and happy to swap study notes."],
  ["Bram de Wit", "NL", A, "phm", "health_sciences", null, "Radboud University", H, {}, "eu_eea_swiss", false, null, false, false, null, false,
    "Hidden profile (fictional)."],
  ["Noor El Amrani", "NL", A, "ep", "political_policy_ir", "ba", "Leiden University", P, {}, "eu_eea_swiss", true, "not_applicable", true, true, "MA", true,
    "Studied international relations and interned at a health NGO. Interested in equity, migration and health, and in organising study groups."],
  ["Sem Visser", "NL", A, "mhi", "engineering_technology", "msc", "Delft University of Technology", C, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Engineer exploring hospital logistics and digital health."],
  ["Isa Jansen", "NL", A, "eeh", "economics", "bsc", "University of Amsterdam", P, { university: C }, "non_eu_eea_swiss", true, "yes", true, true, "SR", false,
    "Represents the Netherlands, where she grew up. Likes econometrics more than she expected."],
  ["Thijs van Leeuwen", "NL", A, "not_chosen", "biomedical_life_sciences", "msc", "University of Groningen", P, {}, "eu_eea_swiss", false, null, false, false, null, false,
    "Biomedical scientist still deciding between tracks."],
  ["Roos Mulder", "NL", B, "mhi", "nursing_midwifery", "nursing", "Hanze University of Applied Sciences", C, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Registered nurse with ten years on surgical wards. Interested in workforce planning and quality improvement in hospitals."],
  ["Ruben de Groot", "NL", B, "eeh", "medicine", "medicine", "Leiden University", H, {}, "eu_eea_swiss", false, null, false, false, null, false,
    "Hidden profile (fictional)."],

  ["Giulia Ferraretti", "IT", A, "ep", "economics", "ba", "University of Bologna", P, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Bologna-born economist. Happy to recommend the best study rooms and cheapest lunches near the department."],
  ["Matteo Bonacorsi", "IT", A, "mhi", "medicine", "medicine", "University of Padua", P, { bio: C }, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Medical doctor interested in hospital management."],
  ["Chiara Lombardelli", "IT", A, "eeh", "pharmacy", "pharmacy", null, C, {}, "eu_eea_swiss", true, "not_applicable", false, true, null, false,
    "Pharmacist with a soft spot for health technology assessment."],
  ["Lorenzo De Santis", "IT", A, "phm", "public_health", "mph", "Sapienza University of Rome", P, {}, "eu_eea_swiss", false, null, false, false, null, false,
    "Public health trainee interested in population data and prevention programmes."],
  ["Francesca Moretto", "IT", A, "mhi", "law", "other_professional", "University of Milan", P, { degree: C }, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Lawyer moving into healthcare management. Interested in regulation, patient rights and procurement."],
  ["Niccolò Barbieri", "IT", A, "prefer_not_to_share", "social_sciences", "ba", "University of Florence", P, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, false,
    "Sociologist who likes long walks under the porticoes."],
  ["Elena Castellucci", "IT", B, "phm", "dentistry", "dentistry", "University of Bologna", C, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, false,
    "Dentist interested in oral health inequalities and community prevention."],
  ["Tommaso Rinaldi-Vescovi", "IT", B, "ep", "economics", "msc", "Bocconi University", H, {}, "eu_eea_swiss", false, null, false, false, null, false,
    "Hidden profile (fictional)."],

  ["Lena Schäfermeyer", "DE", A, "eeh", "medicine", "medicine", "Heidelberg University", P, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Doctor from Heidelberg, curious about economic evaluation of new treatments."],
  ["Jonas Weißgerber", "DE", A, "mhi", "business_management_finance", "msc", "University of Mannheim", P, { linkedin: H }, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Previously worked in hospital controlling. Interested in finance and operations, and in Bologna's food scene."],
  ["Anna-Lena Krüger", "DE", A, "ep", "public_health", null, null, C, {}, "eu_eea_swiss", false, null, false, true, "SE", false,
    "Public health background with interests in health policy."],
  ["Felix Obermaier", "DE", A, "eeh", "economics", "bsc", "Technical University of Munich", P, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, false,
    "Econometrician who enjoys modelling and teaching R to anyone who asks."],
  ["Marie Lindqvist-Hoffmann", "DE", B, "mhi", "nursing_midwifery", "nursing", "Charité – Universitätsmedizin Berlin", P, {}, "eu_eea_swiss", false, "not_applicable", false, true, "SE", true,
    "Nurse and midwife interested in maternity services and leadership."],
  ["Paul Brandstätter", "DE", B, "phm", "biomedical_life_sciences", "msc", "University of Freiburg", H, {}, null, false, null, false, false, null, false,
    "Hidden profile (fictional)."],

  ["Ingrid Solbakken", "NO", A, "mhi", "health_sciences", "bsc", "University of Bergen", P, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Health sciences graduate interested in primary care organisation."],
  ["Sindre Haugland", "NO", A, "eeh", "economics", "msc", "BI Norwegian Business School", C, {}, "eu_eea_swiss", true, "not_applicable", true, true, null, false,
    "Economist interested in health technology assessment."],
  ["Maren Østby", "NO", A, "ep", "public_health", "mph", "University of Oslo", P, { photo: H }, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Public health graduate from Oslo, happy to share tips about winter in Norway."],
  ["Eirik Fjellstad", "NO", A, "eeh", "engineering_technology", "msc", "Norwegian University of Science and Technology", P, {}, "eu_eea_swiss", false, null, false, false, null, false,
    "Engineer interested in modelling, data and digital health."],
  ["Sunniva Bråten", "NO", A, "phm", "psychology_behaviour", "ba", "University of Tromsø", C, {}, "prefer_not_to_say", false, "prefer_not_to_say", false, false, null, false,
    "Psychologist interested in mental health services."],
  ["Håkon Lyngstad", "NO", B, "eeh", "health_sciences", "other_master", "University of Oslo", P, { country: C }, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Health sciences graduate interested in modelling and Nordic health systems."],

  ["Lucía Fernández-Olmedo", "ES", A, "ep", "political_policy_ir", "ma", "Complutense University of Madrid", P, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Political scientist interested in health policy and European cooperation."],
  ["Álvaro Ibarrondo", "ES", A, "mhi", "medicine", "medicine", "University of the Basque Country", C, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, false,
    "Doctor interested in hospital management."],
  ["João Mendonça Faria", "PT", A, "eeh", "pharmacy", "pharmacy", "University of Lisbon", P, { university: H }, "eu_eea_swiss", false, "not_applicable", false, true, null, false,
    "Pharmacist interested in pricing and reimbursement."],
  ["Theresa Pichlhöfer", "AT", A, "mhi", "business_management_finance", "bba", "WU Vienna University of Economics and Business", C, {}, "eu_eea_swiss", false, "not_applicable", false, true, null, true,
    "Business graduate interested in healthcare finance."],
  ["Rami Haddad-Kassem", "SY", A, "ep", "medicine", "medicine", "Damascus University", P, {}, "eu_eea_swiss", true, "no", true, true, "DE", true,
    "Doctor representing Syria, now curious about how health systems recover after crises. Happy to talk about global health and good food."],
  ["Ananya Raghunathan Iyer", "IN", A, "mhi", "dentistry", "dentistry", "Manipal Academy of Higher Education", C, {}, "non_eu_eea_swiss", true, "yes", true, true, null, false,
    "Dentist interested in health services management and quality."],
  ["Chidinma Okafor-Adeyemi", "NG", B, "ep", "business_management_finance", "mba", "University of Lagos", P, {}, "non_eu_eea_swiss", false, "yes", false, true, null, true,
    "Previously managed a private clinic. Interested in health financing and insurance."],
  ["Thiago Albuquerque Nogueira", "BR", A, "phm", "biomedical_life_sciences", null, null, C, {}, null, false, "not_sure", true, false, null, false,
    "Biomedical scientist interested in Latin American and European health systems."],
];

// ----- Build the records -----
const records = ROWS.map((r, i) => {
  const [name, country, cohort, track, field, degree, university, visibility, overrides, citizenship, citizenshipShared,
    visa, visaShared, mobilityConsent, additional, linkedin, bio] = r;
  const base = visibility === P ? OPEN : visibility === C ? MEMBERS : Object.fromEntries(Object.keys(OPEN).map((k) => [k, H]));
  return {
    id: `demo-${String(i + 1).padStart(3, "0")}`,
    isDemo: true,
    userType: "current_student",
    membershipStatus: "current_student",
    cohort,
    fullName: name,
    primaryCountryCode: country,
    primaryCountryName: EUHEM_COUNTRY_BY_CODE[country].name,
    additionalCountryCode: additional,
    additionalCountryName: additional ? EUHEM_COUNTRY_BY_CODE[additional].name : null,
    previousFieldId: field,
    previousFieldLabel: OPTIONS.academicFields[field],
    previousDegreeId: degree,
    previousDegreeLabel: degree ? OPTIONS.degrees[degree] : null,
    previousUniversity: university,
    trackId: track,
    trackLabel: OPTIONS.currentTracks[track] || OPTIONS.trackChoices[track],
    shortBio: bio,
    linkedin: linkedin ? "example" : null, // never a real address: shown as a disabled "Example LinkedIn"
    photo: null, // no photos in the demo: initials only
    profileVisibility: visibility,
    fieldVisibility: { ...base, ...(visibility === H ? {} : overrides) },
    citizenshipGroup: citizenship, // null = not provided (skipped)
    citizenshipVisibility: citizenshipShared ? "cohort" : "private",
    studyVisaExperience: visa, // null = not provided (skipped)
    studyVisaExperienceVisibility: visaShared ? "cohort" : "private",
    generalStatisticsConsent: true,
    mobilityStatisticsConsent: mobilityConsent,
    emailVerified: true,
    roleVerification: "verified",
    adminStatus: "approved",
  };
});

// ----- Every distribution must be exact (docs/students-explorer.md) -----
const count = (fn) => records.reduce((m, r) => { const k = fn(r); m[k] = (m[k] || 0) + 1; return m; }, {});
const expect = (label, actual, wanted) => {
  const a = JSON.stringify(Object.fromEntries(Object.entries(actual).sort()));
  const w = JSON.stringify(Object.fromEntries(Object.entries(wanted).sort()));
  if (a !== w) { console.error(`✖ ${label}\n  got:  ${a}\n  want: ${w}`); process.exit(1); }
};
if (records.length !== 40) { console.error(`✖ ${records.length} records, need exactly 40`); process.exit(1); }
expect("countries", count((r) => r.primaryCountryCode), { NL: 12, IT: 8, DE: 6, NO: 6, ES: 2, PT: 1, AT: 1, SY: 1, IN: 1, NG: 1, BR: 1 });
expect("cohorts", count((r) => r.cohort), { [A]: 32, [B]: 8 });
expect("tracks 2026–2028", count((r) => (r.cohort === A ? r.trackId : "_")), { mhi: 10, eeh: 9, ep: 7, phm: 4, not_chosen: 1, prefer_not_to_share: 1, _: 8 });
expect("tracks 2025–2027", count((r) => (r.cohort === B ? r.trackId : "_")), { mhi: 2, eeh: 2, ep: 2, phm: 2, _: 32 });
// Academic fields, in the groups of the brief (directory-options.js ids)
const FIELD_BUCKET = { quantitative_data: "engineering_quant_data", engineering_technology: "engineering_quant_data",
  psychology_behaviour: "psychology_social", social_sciences: "psychology_social" };
expect("fields", count((r) => FIELD_BUCKET[r.previousFieldId] || r.previousFieldId), {
  medicine: 6, economics: 6, public_health: 4, business_management_finance: 4, pharmacy: 3, health_sciences: 3,
  biomedical_life_sciences: 3, nursing_midwifery: 2, dentistry: 2, political_policy_ir: 2, engineering_quant_data: 2,
  psychology_social: 2, law: 1,
});
expect("profile visibility", count((r) => r.profileVisibility), { public: 24, cohort: 12, hidden: 4 });
const europe = records.filter((r) => EUHEM_COUNTRY_BY_CODE[r.primaryCountryCode].europe).length;
if (europe !== 36) { console.error(`✖ ${europe} records from geographical Europe, need 36`); process.exit(1); }

// ----- Fictional whole-cohort mobility statistics (consenting, substantive answers only) -----
const MIN_GROUP = 5;
const aggregates = { isDemo: true, note: "FICTIONAL. Computed from the 40 demo records, never from real registrations.", minGroupSize: MIN_GROUP, cohorts: {} };
for (const cohort of [A, B]) {
  const consenting = records.filter((r) => r.cohort === cohort && r.mobilityStatisticsConsent);
  const tally = (key, values) => Object.fromEntries(values.map((v) => [v, consenting.filter((r) => r[key] === v).length]));
  const citizenship = tally("citizenshipGroup", ["eu_eea_swiss", "non_eu_eea_swiss"]);
  const visa = tally("studyVisaExperience", ["yes", "no", "not_sure", "not_applicable"]);
  aggregates.cohorts[cohort] = {
    citizenship: { denominator: "consenting respondents who chose one of the two citizenship groups", ...safeBreakdown(citizenship, MIN_GROUP) },
    studyVisaExperience: { denominator: "consenting respondents who answered yes, no, not sure or not applicable", ...safeBreakdown(visa, MIN_GROUP) },
  };
}

fs.writeFileSync(path.join(ROOT, "data", "demo-students.json"), JSON.stringify({
  isDemo: true,
  note: "FICTIONAL demonstration records. Invented names, no photos, no emails, no real LinkedIn profiles. Generated by scripts/build-demo-students.js.",
  records,
}, null, 1) + "\n");
fs.writeFileSync(path.join(ROOT, "data", "demo-aggregates.json"), JSON.stringify(aggregates, null, 1) + "\n");
console.log(`✔ Wrote data/demo-students.json (${records.length} fictional records) and data/demo-aggregates.json`);
