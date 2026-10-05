/**
 * EU-HEM Student Directory — Phase 1 backend (Google Apps Script, V8 runtime)
 *
 * Nothing secret or environment-specific is written in this file.
 * All settings live in Project Settings → Script Properties:
 *
 *   SPREADSHEET_ID              required  ID of the PRIVATE Google Sheet
 *   PHOTO_FOLDER_ID             optional  ID of the PRIVATE Drive folder for photos
 *   ALLOWED_EMAIL_DOMAINS       optional  comma-separated, default "studio.unibo.it"
 *   REQUIRE_EMAIL_CONFIRMATION  optional  "true" (default) or "false"
 *   COLLECT_PHONE               optional  "true" or "false" (default)
 *   CONTACT_EMAIL               optional  reply-to address shown in emails
 *
 * First use: run setup() once from the editor. It authorises the script,
 * creates the "Submissions" tab and any missing column headers.
 */

const SETTINGS = Object.freeze({
  SHEET_NAME: 'Submissions',
  CONSENT_VERSION: 'directory-v1-2026-10',
  SOURCE: 'student-directory-form-v1',
  MIN_FORM_MS: 3000,
  MAX_PHOTO_BYTES: 2 * 1024 * 1024,
  MAX_PER_HOUR: 60,
  MAX_ROWS: 400,
  CONFIRM_DAYS: 14
});

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
  'Email Confirmed At','Confirm Token Hash','Confirm Email Sent'
]);

const TRACKS = [
  'Economic Evaluation in Healthcare',
  'Health Economics & Policy',
  'Management of Healthcare Institutions',
  'Population Health Management',
  'Not decided yet'
];

const FIELDS = [
  'Medicine','Economics','Public Health','Pharmacy','Business & Management','Health Sciences',
  'Life Sciences','Social Sciences','Psychology / Behavioural Sciences',
  'Engineering / Technology','Law'
];

const VIS_ALL = ['public','cohort','hidden'];
const VIS_PRIVATE = ['cohort','hidden'];
const PHOTO_MIME = ['image/jpeg','image/png','image/webp'];

const LIMITS = Object.freeze({
  fullName: 120, universityEmail: 180, primaryCountry: 100, additionalCountry: 100,
  previousDegree: 100, previousField: 120, previousUniversity: 160, shortBio: 250,
  professionalInterests: 400, researchInterests: 400, languages: 300, hobbies: 300,
  canHelpWith: 350, connectAbout: 350, linkedin: 250, instagram: 120, phone: 40
});

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

/** Run once from the editor after setting the Script Properties. */
function setup() {
  const sheet = openSheet_(true);
  const added = ensureHeaders_(sheet);
  sheet.setFrozenRows(1);
  const folderId = prop_('PHOTO_FOLDER_ID', '');
  if (folderId) DriveApp.getFolderById(folderId).getName();
  MailApp.getRemainingDailyQuota();
  const summary = 'Setup OK. Tab "' + SETTINGS.SHEET_NAME + '" ready, ' + added +
    ' header(s) added. Photos: ' + (folderId ? 'enabled' : 'disabled (no PHOTO_FOLDER_ID)') +
    '. Email confirmation: ' + (confirmationRequired_() ? 'on' : 'off') +
    '. Allowed domains: ' + allowedDomains_().join(', ');
  console.log(summary);
  return summary;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.c && p.id) return page_(confirmEmail_(String(p.id), String(p.c)));
  return page_({ title: 'EU-HEM Student Directory',
                 text: 'This address receives submissions from the Student Hub directory form.' });
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

      const existing = findByEmail_(table, p.universityEmail);
      if (existing) {
        // Same browser retrying after a lost response: report success, save nothing twice.
        if (existing['Submission ID'] === requestId) {
          return json_({ ok: true, code: 'OK', requestId: requestId,
                         confirmation: existing['Status'] === 'unconfirmed' ? 'sent' : 'not_required' });
        }
        throw appError_('DUPLICATE_EMAIL', 'A submission already exists for this university email.');
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
      return json_({ ok: true, code: 'OK', requestId: requestId, confirmation: confirmation });
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
    throw appError_('CONSENT_REQUIRED', 'Please review and acknowledge the Directory privacy information.');
  }

  const fullName = required_(b.fullName, 'Full name', LIMITS.fullName);
  const universityEmail = required_(b.universityEmail, 'University email', LIMITS.universityEmail).toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(universityEmail)) {
    throw appError_('INVALID_EMAIL', 'Please enter a valid university email.');
  }
  const domains = allowedDomains_();
  if (domains.indexOf(universityEmail.split('@')[1]) === -1) {
    throw appError_('EMAIL_DOMAIN', 'Please use your university email (' +
      domains.map(function (d) { return '@' + d; }).join(' or ') + ').');
  }

  const primaryCountry = required_(b.primaryCountry, 'Primary country', LIMITS.primaryCountry);

  let previousField = required_(b.previousField, 'Previous academic field', LIMITS.previousField);
  if (previousField === 'Other') {
    previousField = 'Other: ' + required_(b.previousFieldOther, 'Academic field', LIMITS.previousField - 7);
  } else if (FIELDS.indexOf(previousField) === -1) {
    throw appError_('INVALID_VALUE', 'Please choose a valid academic field.');
  }

  const euhemTrack = oneOf_(b.euhemTrack, TRACKS, 'EU-HEM track');
  const profileVisibility = oneOf_(b.profileVisibility, VIS_ALL, 'profile visibility');
  const analyticsConsent = oneOf_(b.analyticsConsent, ['yes','no'], 'statistics choice');

  let photoVisibility = oneOf_(b.photoVisibility || 'hidden', VIS_ALL, 'photo visibility');
  let emailVisibility = oneOf_(b.emailVisibility || 'hidden', VIS_PRIVATE, 'email visibility');
  let linkedinVisibility = oneOf_(b.linkedinVisibility || 'hidden', VIS_ALL, 'LinkedIn visibility');
  let instagramVisibility = oneOf_(b.instagramVisibility || 'hidden', VIS_ALL, 'Instagram visibility');
  let phoneVisibility = oneOf_(b.phoneVisibility || 'hidden', VIS_PRIVATE, 'phone visibility');

  // Server-side privacy clamp. Never trust the browser.
  if (profileVisibility === 'hidden') {
    photoVisibility = emailVisibility = linkedinVisibility = instagramVisibility = phoneVisibility = 'hidden';
  } else if (profileVisibility === 'cohort') {
    if (photoVisibility === 'public') photoVisibility = 'cohort';
    if (linkedinVisibility === 'public') linkedinVisibility = 'cohort';
    if (instagramVisibility === 'public') instagramVisibility = 'cohort';
  }

  const linkedin = optional_(b.linkedin, LIMITS.linkedin);
  if (linkedin && !/^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/[^\s<>"']*$/i.test(linkedin)) {
    throw appError_('INVALID_LINKEDIN', 'Please enter a LinkedIn address starting with https://www.linkedin.com/');
  }

  let instagram = optional_(b.instagram, LIMITS.instagram);
  if (instagram) {
    const m = instagram.match(/^(?:https?:\/\/(?:www\.)?instagram\.com\/|@)?([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/);
    if (!m) throw appError_('INVALID_INSTAGRAM', 'Please enter an Instagram username such as @name.');
    instagram = '@' + m[1];
  }

  let phone = '';
  if (prop_('COLLECT_PHONE', 'false') === 'true') {
    phone = optional_(b.phone, LIMITS.phone);
    if (phone && !/^\+?[0-9][0-9 ()\-]{5,24}$/.test(phone)) {
      throw appError_('INVALID_PHONE', 'Please enter a valid phone number, for example +39 333 1234567.');
    }
  }

  const photoBase64 = typeof b.photoBase64 === 'string' ? b.photoBase64 : '';
  const photoMimeType = optional_(b.photoMimeType, 50);
  if (photoBase64) {
    if (PHOTO_MIME.indexOf(photoMimeType) === -1) throw appError_('INVALID_PHOTO', 'Unsupported photo format.');
    if (photoBase64.length > Math.ceil(SETTINGS.MAX_PHOTO_BYTES * 4 / 3) + 16) {
      throw appError_('PHOTO_TOO_LARGE', 'The uploaded photo is too large.');
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(photoBase64)) throw appError_('INVALID_PHOTO', 'The photo could not be read.');
  }

  return {
    fullName: fullName, universityEmail: universityEmail, primaryCountry: primaryCountry,
    additionalCountry: optional_(b.additionalCountry, LIMITS.additionalCountry),
    previousDegree: optional_(b.previousDegree, LIMITS.previousDegree),
    previousField: previousField,
    previousUniversity: optional_(b.previousUniversity, LIMITS.previousUniversity),
    euhemTrack: euhemTrack,
    shortBio: optional_(b.shortBio, LIMITS.shortBio),
    professionalInterests: optional_(b.professionalInterests, LIMITS.professionalInterests),
    researchInterests: optional_(b.researchInterests, LIMITS.researchInterests),
    languages: optional_(b.languages, LIMITS.languages),
    hobbies: optional_(b.hobbies, LIMITS.hobbies),
    canHelpWith: optional_(b.canHelpWith, LIMITS.canHelpWith),
    connectAbout: optional_(b.connectAbout, LIMITS.connectAbout),
    linkedin: linkedin, instagram: instagram, phone: phone,
    profileVisibility: profileVisibility, photoVisibility: photoVisibility,
    emailVisibility: emailVisibility, linkedinVisibility: linkedinVisibility,
    instagramVisibility: instagramVisibility, phoneVisibility: phoneVisibility,
    analyticsConsent: analyticsConsent,
    photoBase64: photoBase64, photoMimeType: photoMimeType
  };
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

function ensureHeaders_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].filter(String);
  const missing = HEADERS.filter(function (h) { return current.indexOf(h) === -1; });
  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
  return missing.length;
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
    throw appError_('BUSY', 'The directory is not accepting new profiles right now. Please contact the Student Hub team.');
  }
  const cache = CacheService.getScriptCache();
  const key = 'submissions-' + Math.floor(Date.now() / 3600000);
  const count = Number(cache.get(key) || 0);
  if (count >= SETTINGS.MAX_PER_HOUR) {
    throw appError_('BUSY', 'Too many submissions right now. Please try again in an hour.');
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
    'University Email': t(p.universityEmail),
    'Primary Country': t(p.primaryCountry),
    'Additional Country': t(p.additionalCountry),
    'Previous Degree': t(p.previousDegree),
    'Previous Academic Field': t(p.previousField),
    'Previous University': t(p.previousUniversity),
    'EU-HEM Track': t(p.euhemTrack),
    'Short Bio': t(p.shortBio),
    'Professional Interests': t(p.professionalInterests),
    'Research Interests': t(p.researchInterests),
    'Languages': t(p.languages),
    'Hobbies / Interests': t(p.hobbies),
    'I Can Help With': t(p.canHelpWith),
    "I'd Like to Connect About": t(p.connectAbout),
    'LinkedIn': t(p.linkedin),
    'Instagram': t(p.instagram),
    'Phone / WhatsApp': t(p.phone),
    'Profile Visibility': p.profileVisibility,
    'Photo Visibility': photo.id ? p.photoVisibility : 'hidden',
    'University Email Visibility': p.emailVisibility,
    'LinkedIn Visibility': p.linkedin ? p.linkedinVisibility : 'hidden',
    'Instagram Visibility': p.instagram ? p.instagramVisibility : 'hidden',
    'Phone / WhatsApp Visibility': p.phone ? p.phoneVisibility : 'hidden',
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
    'Confirm Email Sent': ''
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
  const stem = p.universityEmail.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 90);
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
    const link = ScriptApp.getService().getUrl() + '?id=' + encodeURIComponent(requestId) + '&c=' + token;
    const visibility = { public: 'Public', cohort: 'EU-HEM students only', hidden: 'Not published' }[p.profileVisibility];
    const contact = prop_('CONTACT_EMAIL', '');
    const options = { name: 'EU-HEM Student Hub' };
    if (contact) options.replyTo = contact;
    MailApp.sendEmail(p.universityEmail, 'Confirm your EU-HEM Student Directory profile', [
      'Hi ' + p.fullName + ',',
      '',
      'Someone, hopefully you, submitted a profile to the EU-HEM Student Directory with this email address.',
      '',
      'Confirm it is yours by opening this link within ' + SETTINGS.CONFIRM_DAYS + ' days:',
      link,
      '',
      'Profile visibility you chose: ' + visibility,
      'Nothing is published automatically. Every profile is reviewed first.',
      '',
      'If this was not you, ignore this email and the submission will be deleted.',
      'To change or delete your profile at any time, ' +
        (contact ? 'write to ' + contact + '.' : 'reply to this email.'),
      '',
      'EU-HEM Student Hub (unofficial, student-run)'
    ].join('\n'), options);
    return true;
  } catch (err) {
    console.error('Confirmation email failed: ' + err);
    return false;
  }
}

function confirmEmail_(id, token) {
  const invalid = { title: 'This link is not valid',
                    text: 'The confirmation link is wrong, already used or expired. Please contact the Student Hub team.' };
  if (!safeId_(id) || !/^[a-f0-9]{64}$/.test(token)) return invalid;
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = openSheet_(false);
    const table = readTable_(sheet);
    const idCol = table.headers.indexOf('Submission ID');
    for (let i = 0; i < table.rows.length; i++) {
      if (table.rows[i][idCol] !== id) continue;
      const row = rowObject_(table, i);
      if (row['Email Confirmed At']) {
        return { title: 'Already confirmed', text: 'Your email was already confirmed. Thank you.' };
      }
      if (!row['Confirm Token Hash'] || row['Confirm Token Hash'] !== hash_(token)) return invalid;
      const submitted = new Date(sheet.getRange(row._row, table.headers.indexOf('Submitted At') + 1).getValue()).getTime();
      if (isFinite(submitted) && Date.now() - submitted > SETTINGS.CONFIRM_DAYS * 86400000) return invalid;
      setCell_(sheet, table.headers, row._row, 'Email Confirmed At', new Date());
      setCell_(sheet, table.headers, row._row, 'Confirm Token Hash', '');
      if (row['Status'] === 'unconfirmed') setCell_(sheet, table.headers, row._row, 'Status', 'pending');
      return { title: 'Email confirmed',
               text: 'Thank you. Your profile is now waiting for review. Nothing is published automatically.' };
    }
    return invalid;
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function prop_(key, fallback) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v == null || String(v).trim() === '' ? fallback : String(v).trim();
}

function allowedDomains_() {
  return prop_('ALLOWED_EMAIL_DOMAINS', 'studio.unibo.it').toLowerCase()
    .split(',').map(function (d) { return d.trim().replace(/^@/, ''); }).filter(String);
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
  return err && err.code ? err.message : 'We could not save your profile right now. Please try again later.';
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function page_(content) {
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(content.title) + '</title>' +
    '<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#20242a">' +
    '<h1 style="font-size:1.5rem">' + esc(content.title) + '</h1><p>' + esc(content.text) + '</p>' +
    '<p style="color:#667085">EU-HEM Student Hub · unofficial, student-run</p></body>');
}
