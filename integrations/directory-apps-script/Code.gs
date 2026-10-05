/**
 * EU-HEM Student Hub — registration backend, onboarding v2 (Google Apps Script, V8 runtime)
 *
 * Receives the "Join the Directory" form, checks it again on the server, stores it in a private
 * Google Sheet (photo in a private Drive folder) and emails a confirmation link.
 *
 * Four kinds of people can register (OPTIONS.userTypes). Only current EU-HEM students and alumni are
 * eligible for the Student Directory; this is decided here, never by the browser.
 *
 * Nothing secret or environment-specific is written in this file.
 * All settings live in Project Settings → Script Properties:
 *
 *   SPREADSHEET_ID              required  ID of the PRIVATE Google Sheet
 *   PHOTO_FOLDER_ID             optional  ID of the PRIVATE Drive folder for photos
 *   REQUIRE_EMAIL_CONFIRMATION  optional  "true" (default) or "false"
 *   CONTACT_EMAIL               optional  the Student Hub address students write to (reply-to of emails)
 *
 * (ALLOWED_EMAIL_DOMAINS and COLLECT_PHONE from onboarding v1 are no longer used.)
 *
 * First use, and after every update of this file: run setup() once from the editor. It authorises the
 * script, adds any missing columns at the END of the "Submissions" tab (existing columns and rows are
 * never moved or rewritten) and rewrites the human-readable "Options" tab.
 */

const SETTINGS = Object.freeze({
  SHEET_NAME: 'Submissions',
  OPTIONS_SHEET_NAME: 'Options',
  CONSENT_VERSION: 'directory-v2-2026-10',
  SOURCE: 'student-hub-registration-v2',
  MIN_FORM_MS: 3000,
  MAX_PHOTO_BYTES: 2 * 1024 * 1024,
  MAX_PER_HOUR: 60,
  MAX_ROWS: 400,
  CONFIRM_DAYS: 14
});

// The order of the first 41 columns is onboarding v1; never reorder or remove them (old rows depend on it).
// Columns marked deprecated in docs/student-directory.md stay, but onboarding v2 leaves them empty.
// 'University Email' holds the registration email of every user type.
const HEADERS = Object.freeze([
  'Submission ID','Submitted At','Status','Full Name','University Email','Primary Country',
  'Additional Country','Previous Degree','Previous Academic Field','Previous University',
  'EU-HEM Track','Short Bio','Professional Interests','Research Interests','Languages',
  'Hobbies / Interests','I Can Help With',"I'd Like to Connect About",'LinkedIn','Instagram',
  'Phone / WhatsApp','Profile Visibility','Photo Visibility','University Email Visibility',
  'LinkedIn Visibility','Instagram Visibility','Phone / WhatsApp Visibility',
  'Anonymous Aggregated Statistics Consent','Consent Version','Consent Timestamp',
  'Photo Drive File ID','Photo File Name','Photo MIME Type','Source','Admin Notes',
  'Approved At','Public Publish Eligible','Cohort Publish Eligible',
  'Email Confirmed At','Confirm Token Hash','Confirm Email Sent',
  // onboarding v2
  'User Type','Directory Eligible','EU-HEM Cohort','Home Institution','Home Programme','Programme Role',
  'Courses / Areas Involved','Shared Courses','Feature Interests','Feature Suggestion',
  'Role Verification Status','Role Verified At'
]);

// Stable ids and their labels. The same lists are in directory-options.js for the form;
// scripts/check-content.js fails if the two differ.
const OPTIONS = Object.freeze({
  userTypes: {
    current_student: 'Current EU-HEM student',
    alumni: 'EU-HEM alumnus / former student',
    shared_course_student: 'Student from another programme',
    faculty_staff: 'Faculty, staff or programme partner'
  },
  directoryEligible: { current_student: true, alumni: true, shared_course_student: false, faculty_staff: false },
  currentTracks: {
    eeh: 'Economic Evaluation in Healthcare',
    ep: 'Health Economics & Policy',
    mhi: 'Management of Healthcare Institutions',
    phm: 'Population Health Management'
  },
  legacyTracks: {
    dmh: 'Decision Making in Healthcare',
    gh: 'Global Health',
    hfm: 'Healthcare Finance and Management'
  },
  trackChoices: {
    not_chosen: "I haven't chosen my track yet",
    other_former: 'Other / former EU-HEM specialisation',
    prefer_not_to_share: 'Prefer not to share'
  },
  academicFields: {
    medicine: 'Medicine',
    dentistry: 'Dentistry & Oral Health',
    nursing_midwifery: 'Nursing & Midwifery',
    pharmacy: 'Pharmacy & Pharmaceutical Sciences',
    public_health: 'Public Health',
    health_sciences: 'Health Sciences / Health Policy & Management',
    allied_health: 'Physiotherapy / Rehabilitation / Allied Health',
    nutrition: 'Nutrition & Dietetics',
    biomedical_life_sciences: 'Biomedical Sciences / Life Sciences / Biotechnology',
    quantitative_data: 'Statistics / Mathematics / Data Science',
    engineering_technology: 'Engineering / Technology',
    economics: 'Economics / Health Economics',
    business_management_finance: 'Business / Management / Finance',
    psychology_behaviour: 'Psychology / Behavioural Sciences',
    political_policy_ir: 'Political Science / Public Policy / International Relations',
    social_sciences: 'Sociology / Social Sciences',
    law: 'Law',
    philosophy_ethics_humanities: 'Philosophy / Ethics / Humanities',
    other: 'Other'
  },
  degrees: {
    bsc: 'Bachelor of Science (BSc / BS)',
    ba: 'Bachelor of Arts (BA)',
    bba: 'Bachelor of Business Administration (BBA)',
    medicine: 'Medicine (MD / MBBS / equivalent)',
    dentistry: 'Dentistry (BDS / DDS / DMD / equivalent)',
    pharmacy: 'Pharmacy (BPharm / PharmD / MPharm)',
    nursing: 'Nursing (BN / BSN / BSc Nursing)',
    msc: 'Master of Science (MSc)',
    ma: 'Master of Arts (MA)',
    mph: 'Master of Public Health (MPH)',
    mba: 'Master of Business Administration (MBA)',
    other_master: "Other master's degree",
    other_professional: 'Other professional degree',
    other: 'Other'
  },
  programmeRoles: {
    faculty: 'Faculty',
    lecturer: 'Lecturer',
    coordinator: 'Programme coordinator',
    thesis_supervisor: 'Thesis supervisor',
    admin_staff: 'Administrative staff',
    partner: 'Partner organisation',
    guest: 'Guest contributor',
    researcher: 'Researcher',
    other: 'Other'
  },
  features: {
    timetable: 'Live Timetable',
    exams: 'Exams & Deadlines',
    calendar: 'Calendar Subscription',
    study_plan: 'Study Plan & Progress',
    tracks: 'Tracks Explorer',
    notes_resources: 'Notes & Resources',
    flashcards_qbank: 'Flashcards & Question Bank',
    thesis: 'Thesis Hub / Past Thesis Explorer',
    student_directory: 'Student Directory & Cohort Map',
    city_guides: 'City Guides / Life Across EU-HEM',
    events: 'Events & Student Activities',
    announcements: 'Announcements',
    useful_links: 'Useful Links & Official Resources',
    mobile_offline: 'Mobile / Offline Experience',
    ai_study_assistant: 'AI Study Assistant',
    careers: 'Internships & Career Opportunities',
    alumni_network: 'Alumni Network',
    peer_matching: 'Study Groups / Peer Matching',
    mobility_housing: 'Housing & Mobility Planner',
    other: 'Other'
  },
  visibility: { public: 'Public', cohort: 'EU-HEM members only', hidden: 'Hidden' },
  roleVerification: { pending: 'Pending', verified: 'Verified', rejected: 'Rejected' }
});

// Which visibility each detail may have, for each profile choice. Email is never public.
// The same table is in directory-options.js; scripts/check-content.js compares them.
const VIS_RULES = Object.freeze({
  public: { photo: ['public', 'cohort', 'hidden'], linkedin: ['public', 'cohort', 'hidden'], email: ['cohort', 'hidden'] },
  cohort: { photo: ['cohort', 'hidden'], linkedin: ['cohort', 'hidden'], email: ['cohort', 'hidden'] },
  hidden: { photo: ['hidden'], linkedin: ['hidden'], email: ['hidden'] }
});

const PHOTO_MIME = ['image/jpeg','image/png','image/webp'];

const LIMITS = Object.freeze({
  fullName: 120, email: 180, primaryCountry: 100, additionalCountry: 100, otherText: 110,
  previousUniversity: 160, shortBio: 350, linkedin: 250, institution: 160, programme: 160,
  courseName: 120, maxCourses: 12, coursesInvolved: 300, featureSuggestion: 300, cohortOther: 40
});

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

/** Run once from the editor after setting the Script Properties, and again after updating this file. */
function setup() {
  const sheet = openSheet_(true);
  const added = ensureHeaders_(sheet);
  sheet.setFrozenRows(1);
  writeOptionsSheet_();
  const folderId = prop_('PHOTO_FOLDER_ID', '');
  if (folderId) DriveApp.getFolderById(folderId).getName();
  MailApp.getRemainingDailyQuota();
  const summary = 'Setup OK. Tab "' + SETTINGS.SHEET_NAME + '" ready, ' + added +
    ' column(s) added. "' + SETTINGS.OPTIONS_SHEET_NAME + '" tab rewritten. Photos: ' +
    (folderId ? 'enabled' : 'disabled (no PHOTO_FOLDER_ID)') +
    '. Email confirmation: ' + (confirmationRequired_() ? 'on' : 'off') +
    '. Contact email: ' + (prop_('CONTACT_EMAIL', '') || 'NOT SET');
  console.log(summary);
  return summary;
}

/**
 * Opening the confirmation link only SHOWS a page with a button; it never changes the Sheet.
 * Email security scanners open links automatically, so only the button press confirms.
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'confirm') {
    const id = safeId_(p.id);
    const token = /^[a-f0-9]{64}$/.test(String(p.token || '')) ? String(p.token) : '';
    if (!id || !token) return page_(CONFIRM_MESSAGES.invalid);
    return confirmPage_(id, token);
  }
  return page_({ title: 'EU-HEM Student Hub', text: 'This address receives registrations from the Student Hub.' });
}

/** Called by the "Confirm my email" button on the confirmation page (google.script.run). */
function confirmEmailFromPage(id, token) {
  return CONFIRM_MESSAGES[confirmEmail_(String(id || ''), String(token || ''))];
}

function doPost(e) {
  let requestId = '';
  try {
    const body = parseBody_(e);
    requestId = safeId_(body.requestId);
    if (!requestId) throw appError_('INVALID_REQUEST', 'Invalid request.');

    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const p = validate_(body);
      const sheet = openSheet_(false);
      const table = readTable_(sheet);

      const existing = findByEmail_(table, p.email);
      if (existing) {
        // Same browser retrying after a lost response: report success, save nothing twice.
        if (existing['Submission ID'] === requestId) {
          return json_({ ok: true, code: 'OK', requestId: requestId,
                         confirmation: existing['Status'] === 'unconfirmed' ? 'sent' : 'not_required' });
        }
        throw appError_('DUPLICATE_EMAIL', 'A registration already exists for this email address. ' +
          'Profile editing will be available later. Please contact the Student Hub team if you need to update your information.');
      }

      rateLimit_(table);

      const photo = savePhoto_(p);
      const token = confirmationRequired_() ? newToken_() : '';
      try {
        appendRecord_(sheet, table.headers, buildRecord_(p, photo, requestId, token));
      } catch (err) {
        if (photo.id) try { DriveApp.getFileById(photo.id).setTrashed(true); } catch (_) {}
        throw err;
      }

      let confirmation = 'not_required';
      if (token) {
        confirmation = sendConfirmation_(p, requestId, token) ? 'sent' : 'failed';
        setCell_(sheet, table.headers, sheet.getLastRow(), 'Confirm Email Sent',
                 confirmation === 'sent' ? 'yes' : 'failed');
      }
      return json_({ ok: true, code: 'OK', requestId: requestId, confirmation: confirmation,
                     directoryEligible: p.directoryEligible });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, requestId: requestId,
                   code: err && err.code ? err.code : 'SUBMISSION_ERROR',
                   message: publicMessage_(err) });
  }
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function parseBody_(e) {
  const raw = e && e.postData && e.postData.contents;
  if (!raw || raw.length > 4 * 1024 * 1024) throw appError_('INVALID_REQUEST', 'Invalid request.');
  let body;
  try { body = JSON.parse(raw); } catch (_) { throw appError_('INVALID_REQUEST', 'Invalid request.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw appError_('INVALID_REQUEST', 'Invalid request.');
  }
  return body;
}

function validate_(b) {
  if (text_(b.website)) throw appError_('INVALID_REQUEST', 'Invalid request.');
  const elapsed = Number(b.elapsedMs);
  if (!isFinite(elapsed) || elapsed < SETTINGS.MIN_FORM_MS) {
    throw appError_('INVALID_REQUEST', 'Please complete the form normally and try again.');
  }
  if (text_(b.consentVersion) !== SETTINGS.CONSENT_VERSION) {
    throw appError_('CONSENT_VERSION', 'The privacy information has changed. Please refresh the page and review it again.');
  }
  if (text_(b.privacyAcknowledgement) !== 'yes') {
    throw appError_('CONSENT_REQUIRED', 'Please review and acknowledge the privacy information.');
  }

  // The user type decides everything else. Eligibility comes from the server's table, never the browser.
  const userType = idOf_(b.userType, OPTIONS.userTypes, 'connection to EU-HEM');
  const directoryEligible = OPTIONS.directoryEligible[userType] === true;

  const p = {
    userType: userType, directoryEligible: directoryEligible,
    fullName: required_(b.fullName, 'Full name', LIMITS.fullName),
    email: required_(b.email, 'Email', LIMITS.email).toLowerCase(),
    cohort: '', primaryCountry: '', previousField: '', track: '', homeInstitution: '', homeProgramme: '',
    programmeRole: '', coursesInvolved: '', sharedCourses: '', additionalCountry: '', previousDegree: '',
    previousUniversity: '', shortBio: '', linkedin: '', profileVisibility: 'hidden', photoVisibility: 'hidden',
    emailVisibility: 'hidden', linkedinVisibility: 'hidden', analyticsConsent: 'not asked',
    photoBase64: '', photoMimeType: ''
  };
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(p.email)) {
    throw appError_('INVALID_EMAIL', 'Please enter a valid email address.');
  }

  if (directoryEligible) {
    p.cohort = cohort_(b);
    p.primaryCountry = required_(b.primaryCountry, 'Primary country', LIMITS.primaryCountry);
    p.previousField = labelWithOther_(b.previousField, b.previousFieldOther, OPTIONS.academicFields,
      'previous academic field', 'Academic field');
    p.track = track_(b, userType);
    p.additionalCountry = optional_(b.additionalCountry, LIMITS.additionalCountry);
    if (text_(b.previousDegree)) {
      p.previousDegree = labelWithOther_(b.previousDegree, b.previousDegreeOther, OPTIONS.degrees, 'degree', 'Degree');
    }
    p.previousUniversity = optional_(b.previousUniversity, LIMITS.previousUniversity);
    p.shortBio = optional_(b.shortBio, LIMITS.shortBio);
    p.analyticsConsent = oneOf_(b.analyticsConsent, ['yes', 'no'], 'statistics choice');
    visibility_(b, p);
    photo_(b, p);
  } else if (userType === 'shared_course_student') {
    p.homeInstitution = required_(b.homeInstitution, 'Home institution', LIMITS.institution);
    p.homeProgramme = required_(b.homeProgramme, 'Home programme', LIMITS.programme);
    p.sharedCourses = sharedCourses_(b);
  } else {
    p.homeInstitution = required_(b.organisation, 'Institution / organisation', LIMITS.institution);
    p.programmeRole = labelWithOther_(b.programmeRole, b.programmeRoleOther, OPTIONS.programmeRoles, 'role', 'Role');
    p.coursesInvolved = optional_(b.coursesInvolved, LIMITS.coursesInvolved);
  }

  p.linkedin = optional_(b.linkedin, LIMITS.linkedin);
  if (p.linkedin && !/^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/[^\s<>"']*$/i.test(p.linkedin)) {
    throw appError_('INVALID_LINKEDIN', 'Please enter a LinkedIn address starting with https://www.linkedin.com/');
  }
  if (!p.linkedin) p.linkedinVisibility = 'hidden';

  const features = list_(b.featureInterests, 30, 40);
  features.forEach(function (id) {
    if (!Object.prototype.hasOwnProperty.call(OPTIONS.features, id)) throw appError_('INVALID_VALUE', 'Invalid feature choice.');
  });
  p.featureInterests = features.filter(function (id, i) { return features.indexOf(id) === i; }).join(', ');
  p.featureSuggestion = features.indexOf('other') !== -1 ? optional_(b.featureSuggestion, LIMITS.featureSuggestion) : '';
  return p;
}

/** "2026–2028" (two years apart), or "Other / not listed" with a short text. */
function cohort_(b) {
  const v = text_(b.cohort);
  if (v === 'other') return 'Other: ' + required_(b.cohortOther, 'EU-HEM cohort', LIMITS.cohortOther);
  const m = v.match(/^(\d{4})[–-](\d{4})$/);
  if (!m || Number(m[2]) !== Number(m[1]) + 2 || Number(m[1]) < 2000 || Number(m[1]) > 2100) {
    throw appError_('INVALID_VALUE', 'Please choose your EU-HEM cohort.');
  }
  return m[1] + '–' + m[2];
}

/** Current students: the four current tracks, "not chosen yet" or "prefer not to share".
 *  Alumni: current and legacy specialisations (never converted into each other), "other" or "prefer not". */
function track_(b, userType) {
  const id = text_(b.track);
  const current = Object.keys(OPTIONS.currentTracks).concat(['not_chosen', 'prefer_not_to_share']);
  const alumni = Object.keys(OPTIONS.currentTracks).concat(Object.keys(OPTIONS.legacyTracks), ['other_former', 'prefer_not_to_share']);
  const allowed = userType === 'alumni' ? alumni : current;
  if (allowed.indexOf(id) === -1) throw appError_('INVALID_VALUE', 'Please choose your EU-HEM track.');
  if (id === 'other_former') {
    return 'Other former specialisation: ' + required_(b.trackOther, 'Specialisation', LIMITS.otherText);
  }
  return OPTIONS.currentTracks[id] || OPTIONS.legacyTracks[id] || OPTIONS.trackChoices[id];
}

function visibility_(b, p) {
  p.profileVisibility = oneOf_(b.profileVisibility, ['public', 'cohort', 'hidden'], 'profile visibility');
  const rules = VIS_RULES[p.profileVisibility];
  // Email can never be public, whatever the profile: a request asking for it is refused.
  const email = oneOf_(b.emailVisibility || 'hidden', ['cohort', 'hidden'], 'email visibility');
  p.emailVisibility = clamp_(email, rules.email);
  p.photoVisibility = clamp_(oneOf_(b.photoVisibility || 'hidden', ['public', 'cohort', 'hidden'], 'photo visibility'), rules.photo);
  p.linkedinVisibility = clamp_(oneOf_(b.linkedinVisibility || 'hidden', ['public', 'cohort', 'hidden'], 'LinkedIn visibility'), rules.linkedin);
}

/** Server-side privacy clamp: a choice the profile does not allow becomes the next more private one. */
function clamp_(wanted, allowed) {
  const order = ['public', 'cohort', 'hidden'];
  for (let i = order.indexOf(wanted); i < order.length; i++) {
    if (allowed.indexOf(order[i]) !== -1) return order[i];
  }
  return 'hidden';
}

function photo_(b, p) {
  const base64 = typeof b.photoBase64 === 'string' ? b.photoBase64 : '';
  const mime = optional_(b.photoMimeType, 50);
  if (!base64) return;
  if (PHOTO_MIME.indexOf(mime) === -1) throw appError_('INVALID_PHOTO', 'Unsupported photo format.');
  if (base64.length > Math.ceil(SETTINGS.MAX_PHOTO_BYTES * 4 / 3) + 16) {
    throw appError_('PHOTO_TOO_LARGE', 'The uploaded photo is too large.');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw appError_('INVALID_PHOTO', 'The photo could not be read.');
  p.photoBase64 = base64;
  p.photoMimeType = mime;
}

function sharedCourses_(b) {
  const courses = list_(b.sharedCourses, LIMITS.maxCourses, LIMITS.courseName);
  const other = optional_(b.sharedCoursesOther, LIMITS.courseName);
  if (other) courses.push('Other: ' + other);
  if (!courses.length) throw appError_('REQUIRED_FIELD', 'Please tell us which EU-HEM course(s) you attend.');
  return courses.join('; ');
}

/** An id from a list, stored as its label; "other" needs and keeps its text. */
function labelWithOther_(value, otherValue, list, label, otherLabel) {
  const id = idOf_(value, list, label);
  if (id === 'other') return 'Other: ' + required_(otherValue, otherLabel, LIMITS.otherText);
  return list[id];
}

function idOf_(value, list, label) {
  const id = text_(value);
  if (!id || !Object.prototype.hasOwnProperty.call(list, id)) throw appError_('INVALID_VALUE', 'Please choose a valid ' + label + '.');
  return id;
}

/** A list of short texts (array from the form). */
function list_(value, maxItems, maxLength) {
  if (value == null || value === '') return [];
  if (!Array.isArray(value) || value.length > maxItems) throw appError_('INVALID_VALUE', 'Invalid list.');
  return value.map(function (v) { return optional_(v, maxLength); }).filter(String);
}

/* ------------------------------------------------------------------ */
/* Sheet access                                                        */
/* ------------------------------------------------------------------ */

function openSheet_(createIfMissing) {
  const id = prop_('SPREADSHEET_ID', '');
  if (!id) throw appError_('NOT_CONFIGURED', 'The directory is not configured yet.');
  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName(SETTINGS.SHEET_NAME);
  if (!sheet && createIfMissing) sheet = ss.insertSheet(SETTINGS.SHEET_NAME);
  if (!sheet) throw appError_('NOT_CONFIGURED', 'The directory is not configured yet.');
  return sheet;
}

/** Appends missing columns at the end. Existing columns and rows are never moved or rewritten. */
function ensureHeaders_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].filter(String);
  const missing = HEADERS.filter(function (h) { return current.indexOf(h) === -1; });
  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
  return missing.length;
}

/** The "Options" tab: every allowed value with its id, for people reviewing the Sheet. No student data. */
function writeOptionsSheet_() {
  const ss = SpreadsheetApp.openById(prop_('SPREADSHEET_ID', ''));
  const sheet = ss.getSheetByName(SETTINGS.OPTIONS_SHEET_NAME) || ss.insertSheet(SETTINGS.OPTIONS_SHEET_NAME);
  const rows = [['List', 'Stored id', 'Label (what the Submissions tab shows)']];
  const add = function (name, list) {
    Object.keys(list).forEach(function (id) { rows.push([name, id, String(list[id])]); });
  };
  add('User type (stored as id)', OPTIONS.userTypes);
  add('Directory eligible (set by the server)', OPTIONS.directoryEligible);
  add('Current track', OPTIONS.currentTracks);
  add('Legacy specialisation (alumni)', OPTIONS.legacyTracks);
  add('Track choice', OPTIONS.trackChoices);
  add('Academic field', OPTIONS.academicFields);
  add('Degree', OPTIONS.degrees);
  add('Programme role', OPTIONS.programmeRoles);
  add('Feature interest (stored as ids, comma-separated)', OPTIONS.features);
  add('Visibility', OPTIONS.visibility);
  add('Role verification status (set by an admin)', OPTIONS.roleVerification);
  rows.push(['Status (set by the script, then an admin)', 'unconfirmed', 'Email not confirmed yet']);
  rows.push(['Status (set by the script, then an admin)', 'pending', 'Email confirmed, waiting for review']);
  rows.push(['Status (set by an admin)', 'approved / rejected', 'Admin decision']);
  sheet.clear();
  sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  sheet.setFrozenRows(1);
}

function readTable_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) throw appError_('NOT_CONFIGURED', 'The directory is not configured yet.');
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const missing = HEADERS.filter(function (h) { return headers.indexOf(h) === -1; });
  if (missing.length) {
    console.error('Missing headers (run setup()): ' + missing.join(', '));
    throw appError_('NOT_CONFIGURED', 'The directory is not configured yet.');
  }
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues() : [];
  return { headers: headers, rows: rows };
}

function rowObject_(table, index) {
  const o = { _row: index + 2 };
  table.headers.forEach(function (h, i) { o[h] = table.rows[index][i]; });
  return o;
}

function findByEmail_(table, email) {
  const col = table.headers.indexOf('University Email');
  for (let i = 0; i < table.rows.length; i++) {
    if (String(table.rows[i][col]).replace(/^'/, '').trim().toLowerCase() === email) return rowObject_(table, i);
  }
  return null;
}

function rateLimit_(table) {
  if (table.rows.length >= SETTINGS.MAX_ROWS) {
    throw appError_('BUSY', 'The Student Hub is not accepting new registrations right now. Please contact the Student Hub team.');
  }
  const cache = CacheService.getScriptCache();
  const key = 'submissions-' + Math.floor(Date.now() / 3600000);
  const count = Number(cache.get(key) || 0);
  if (count >= SETTINGS.MAX_PER_HOUR) {
    throw appError_('BUSY', 'Too many registrations right now. Please try again in an hour.');
  }
  cache.put(key, String(count + 1), 3700);
}

function appendRecord_(sheet, headers, record) {
  sheet.appendRow(headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(record, h) ? record[h] : '';
  }));
}

function setCell_(sheet, headers, row, header, value) {
  const col = headers.indexOf(header) + 1;
  if (col > 0) sheet.getRange(row, col).setValue(value);
}

function buildRecord_(p, photo, requestId, token) {
  const now = new Date();
  const t = safeSheetText_;
  return {
    'Submission ID': requestId,
    'Submitted At': now,
    'Status': token ? 'unconfirmed' : 'pending',
    'Full Name': t(p.fullName),
    'University Email': t(p.email),
    'Primary Country': t(p.primaryCountry),
    'Additional Country': t(p.additionalCountry),
    'Previous Degree': t(p.previousDegree),
    'Previous Academic Field': t(p.previousField),
    'Previous University': t(p.previousUniversity),
    'EU-HEM Track': t(p.track),
    'Short Bio': t(p.shortBio),
    'LinkedIn': t(p.linkedin),
    'Profile Visibility': p.profileVisibility,
    'Photo Visibility': photo.id ? p.photoVisibility : 'hidden',
    'University Email Visibility': p.emailVisibility,
    'LinkedIn Visibility': p.linkedinVisibility,
    'Anonymous Aggregated Statistics Consent': p.analyticsConsent,
    'Consent Version': SETTINGS.CONSENT_VERSION,
    'Consent Timestamp': now,
    'Photo Drive File ID': photo.id,
    'Photo File Name': t(photo.name),
    'Photo MIME Type': photo.mime,
    'Source': SETTINGS.SOURCE,
    'Admin Notes': '',
    'Approved At': '',
    'Public Publish Eligible': false,
    'Cohort Publish Eligible': false,
    'Email Confirmed At': '',
    'Confirm Token Hash': token ? hash_(token) : '',
    'Confirm Email Sent': '',
    'User Type': p.userType,
    'Directory Eligible': p.directoryEligible,
    'EU-HEM Cohort': t(p.cohort),
    'Home Institution': t(p.homeInstitution),
    'Home Programme': t(p.homeProgramme),
    'Programme Role': t(p.programmeRole),
    'Courses / Areas Involved': t(p.coursesInvolved),
    'Shared Courses': t(p.sharedCourses),
    'Feature Interests': p.featureInterests,
    'Feature Suggestion': t(p.featureSuggestion),
    'Role Verification Status': 'pending',
    'Role Verified At': ''
  };
}

/* ------------------------------------------------------------------ */
/* Photo                                                               */
/* ------------------------------------------------------------------ */

function savePhoto_(p) {
  if (!p.photoBase64) return { id: '', name: '', mime: '' };
  const folderId = prop_('PHOTO_FOLDER_ID', '');
  if (!folderId) throw appError_('PHOTO_STORAGE_NOT_CONFIGURED', 'Photo upload is not available yet. Please remove the photo and submit again.');

  let bytes;
  try { bytes = Utilities.base64Decode(p.photoBase64); }
  catch (_) { throw appError_('INVALID_PHOTO', 'The photo could not be read.'); }
  if (bytes.length > SETTINGS.MAX_PHOTO_BYTES) throw appError_('PHOTO_TOO_LARGE', 'The uploaded photo is too large.');
  if (!looksLikeImage_(bytes, p.photoMimeType)) throw appError_('INVALID_PHOTO', 'The file does not look like a valid image.');

  const ext = p.photoMimeType === 'image/webp' ? 'webp' : (p.photoMimeType === 'image/png' ? 'png' : 'jpg');
  const stem = p.email.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 90);
  const name = stem + '-' + Date.now() + '.' + ext;
  const file = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, p.photoMimeType, name));
  // Never call setSharing here: the file inherits the private folder's access.
  return { id: file.getId(), name: name, mime: p.photoMimeType };
}

/** Checks the first bytes of the file against the declared type. */
function looksLikeImage_(bytes, mime) {
  const b = function (i) { return bytes[i] & 0xff; };
  if (bytes.length < 12) return false;
  if (mime === 'image/jpeg') return b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff;
  if (mime === 'image/png') return b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47;
  if (mime === 'image/webp') {
    return b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
           b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Email confirmation                                                  */
/* ------------------------------------------------------------------ */

// What the confirmation page shows. None of them reveals anything about the registration.
const CONFIRM_MESSAGES = Object.freeze({
  confirmed: { title: 'Email confirmed', text: 'Thanks. Your registration is now waiting for review. Nothing is published automatically.' },
  already: { title: 'Already confirmed', text: 'This email has already been confirmed.' },
  expired: { title: 'Link expired', text: 'This confirmation link has expired. Please contact the Student Hub team.' },
  invalid: { title: 'Link not valid', text: 'This confirmation link is not valid.' }
});

function confirmationRequired_() {
  return prop_('REQUIRE_EMAIL_CONFIRMATION', 'true') !== 'false';
}

function newToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(function (x) { return ((x & 0xff) + 0x100).toString(16).slice(1); }).join('');
}

function sendConfirmation_(p, requestId, token) {
  try {
    const link = ScriptApp.getService().getUrl() + '?action=confirm&id=' + encodeURIComponent(requestId) + '&token=' + token;
    const firstName = p.fullName.split(' ')[0];
    const contact = prop_('CONTACT_EMAIL', '');
    const options = { name: 'EU-HEM Student Hub' };
    if (contact) options.replyTo = contact;
    const lines = [
      'Hi ' + firstName + ',',
      '',
      'Thanks for joining the EU-HEM Student Hub.',
      '',
      'Please confirm that this email address belongs to you:',
      link,
      '',
      'Opening the link will take you to a confirmation page. Your email is only confirmed after you press "Confirm my email". The link works for ' + SETTINGS.CONFIRM_DAYS + ' days.',
      '',
      'Your connection to EU-HEM: ' + { current_student: 'Current student', alumni: 'Alumni',
        shared_course_student: 'Shared-course student', faculty_staff: 'Faculty or staff' }[p.userType]
    ];
    if (p.directoryEligible) {
      lines.push('Student Directory profile visibility: ' +
        { public: 'Public', cohort: 'EU-HEM only', hidden: 'Hidden' }[p.profileVisibility]);
    }
    lines.push(
      '',
      'Nothing is published automatically. Every registration is reviewed first.',
      '',
      'If you did not submit this registration, you can ignore this email.',
      '',
      'Questions, or want your information changed or deleted?',
      'Contact: ' + (contact || 'reply to this email'),
      '',
      'EU-HEM Student Hub',
      'Unofficial, student-run platform'
    );
    MailApp.sendEmail(p.email, 'Confirm your EU-HEM Student Hub registration', lines.join('\n'), options);
    return true;
  } catch (err) {
    console.error('Confirmation email failed: ' + err);
    return false;
  }
}

/** The explicit confirmation action. Returns "confirmed", "already", "expired" or "invalid". */
function confirmEmail_(id, token) {
  if (!safeId_(id) || !/^[a-f0-9]{64}$/.test(token)) return 'invalid';
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = openSheet_(false);
    const table = readTable_(sheet);
    const idCol = table.headers.indexOf('Submission ID');
    for (let i = 0; i < table.rows.length; i++) {
      if (table.rows[i][idCol] !== id) continue;
      const row = rowObject_(table, i);
      if (row['Email Confirmed At']) return 'already';
      if (!row['Confirm Token Hash'] || row['Confirm Token Hash'] !== hash_(token)) return 'invalid';
      const submitted = new Date(sheet.getRange(row._row, table.headers.indexOf('Submitted At') + 1).getValue()).getTime();
      if (isFinite(submitted) && Date.now() - submitted > SETTINGS.CONFIRM_DAYS * 86400000) return 'expired';
      setCell_(sheet, table.headers, row._row, 'Email Confirmed At', new Date());
      setCell_(sheet, table.headers, row._row, 'Confirm Token Hash', '');
      if (row['Status'] === 'unconfirmed') setCell_(sheet, table.headers, row._row, 'Status', 'pending');
      // Email confirmed is NOT role verification: 'Role Verification Status' stays as it is.
      return 'confirmed';
    }
    return 'invalid';
  } finally {
    lock.releaseLock();
  }
}

/** The page behind the email link: a button that calls confirmEmailFromPage(). */
function confirmPage_(id, token) {
  const script =
    'var b=document.getElementById("confirm");' +
    'b.addEventListener("click",function(){b.disabled=true;b.textContent="Confirming…";' +
    'google.script.run.withSuccessHandler(function(r){document.getElementById("t").textContent=r.title;' +
    'document.getElementById("x").textContent=r.text;b.remove();})' +
    '.withFailureHandler(function(){b.disabled=false;b.textContent="Confirm my email";' +
    'document.getElementById("x").textContent="Something went wrong. Please try again.";})' +
    '.confirmEmailFromPage(' + JSON.stringify(id) + ',' + JSON.stringify(token) + ');});';
  return page_({
    title: 'Confirm your email',
    text: 'This confirms that you submitted an EU-HEM Student Hub registration using this email address.',
    button: 'Confirm my email',
    script: script
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function prop_(key, fallback) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v == null || String(v).trim() === '' ? fallback : String(v).trim();
}

/** Trims, removes control characters and collapses whitespace. */
function text_(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function required_(value, label, max) {
  const v = text_(value);
  if (!v) throw appError_('REQUIRED_FIELD', label + ' is required.');
  if (v.length > max) throw appError_('FIELD_TOO_LONG', label + ' is too long.');
  return v;
}

function optional_(value, max) {
  const v = text_(value);
  if (v.length > max) throw appError_('FIELD_TOO_LONG', 'One of the fields is too long.');
  return v;
}

function oneOf_(value, allowed, label) {
  const v = text_(value);
  if (allowed.indexOf(v) === -1) throw appError_('INVALID_VALUE', 'Invalid ' + label + '.');
  return v;
}

/** Stops a cell from being read as a spreadsheet formula. */
function safeSheetText_(value) {
  const v = String(value == null ? '' : value);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function safeId_(value) {
  const v = String(value == null ? '' : value).trim();
  return /^[a-zA-Z0-9-]{16,64}$/.test(v) ? v : '';
}

function appError_(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function publicMessage_(err) {
  return err && err.code ? err.message : 'We could not save your registration right now. Please try again later.';
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function page_(content) {
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const button = content.button
    ? '<p><button id="confirm" type="button" style="font:inherit;font-weight:600;padding:.7rem 1.2rem;border:0;' +
      'border-radius:.6rem;background:#a0452a;color:#fff;cursor:pointer">' + esc(content.button) + '</button></p>'
    : '';
  const output = HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8">' +
    '<title>' + esc(content.title) + '</title>' +
    '<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#20242a">' +
    '<h1 id="t" style="font-size:1.5rem">' + esc(content.title) + '</h1><p id="x">' + esc(content.text) + '</p>' +
    button +
    '<p style="color:#667085">EU-HEM Student Hub · unofficial, student-run</p>' +
    (content.script ? '<script>' + content.script + '</script>' : '') + '</body>');
  if (output.addMetaTag) output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return output;
}
