/**
 * Private Contact inbox for the EU-HEM Student Hub.
 * Deploy separately from the Directory, using the dedicated Hub Google account.
 * SPREADSHEET_ID belongs in Script Properties, never in this file or the website.
 * Only doGet/doPost are public entry points. No email, public reads or status lookup.
 */
const CONTACT = Object.freeze({
  SERVICE: 'euhem-contact',
  NOTICE_VERSION: 'contact-v1-2026-10',
  SHEET_NAME: 'Contact Inbox',
  MAX_BODY_LENGTH: 20000,
  MAX_PER_HOUR: 30,
  MAX_ROWS: 1000,
  LOCK_WAIT_MS: 10000,
  REVIEW_DAYS: 30,
  CLOSED_REVIEW_DAYS: 90
});

const CONTACT_HEADERS = Object.freeze([
  'Request ID', 'Receipt ID', 'Received At', 'Notice Version', 'Topic',
  'Message', 'Name', 'Reply Email', 'Page URL', 'Source URL', 'Resource URL',
  'Request Type', 'Preferred Credit', 'Status', 'Closed At', 'Last Reviewed At',
  'Payload Fingerprint'
]);
const CONTACT_COMMON_FIELDS = Object.freeze(['requestId', 'noticeVersion', 'topic', 'message', 'name', 'email', 'website']);
const CONTACT_TOPIC_FIELDS = Object.freeze({
  correction: ['pageUrl', 'sourceUrl'],
  idea: [],
  privacy: ['pageUrl', 'requestType'],
  contribution: ['resourceUrl', 'preferredCredit']
});
const CONTACT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// A health response is deliberately independent of the private Sheet and request parameters.
function doGet() {
  return contactJson_({ service: CONTACT.SERVICE, noticeVersion: CONTACT.NOTICE_VERSION });
}

function doPost(event) {
  let lock;
  let locked = false;
  try {
    const payload = validateContact_(parseContactBody_(event));
    const fingerprint = contactFingerprint_(payload);
    lock = LockService.getScriptLock();
    try { locked = lock.tryLock(CONTACT.LOCK_WAIT_MS); } catch (_) { throw contactError_('BUSY'); }
    if (!locked) throw contactError_('BUSY');

    const sheet = contactSheet_(false);
    const rows = contactRows_(sheet);
    const existingIndex = rows.findIndex(function (row) { return row[0] === payload.requestId; });
    if (existingIndex !== -1) {
      const existing = rows[existingIndex];
      if (existing[16] !== fingerprint) throw contactError_('REQUEST_CONFLICT');
      const expected = contactRecord_(payload, existing[1], existing[2], fingerprint);
      const immutable = [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16];
      if (!contactCellsMatch_(existing, expected, immutable) ||
          !contactNoFormulas_(sheet.getRange(existingIndex + 2, 1, 1, CONTACT_HEADERS.length))) {
        throw contactError_('SAVE_FAILED');
      }
      return contactJson_(contactReceipt_(existing));
    }

    const now = new Date();
    const recent = rows.filter(function (row) {
      const date = contactDate_(row[2]);
      // A malformed stored date must not silently bypass the admission limit.
      if (!date) throw contactError_('NOT_CONFIGURED');
      return date.getTime() > now.getTime() - 3600000;
    }).length;
    if (rows.length >= CONTACT.MAX_ROWS || recent >= CONTACT.MAX_PER_HOUR) throw contactError_('BUSY');

    const expected = contactRecord_(payload, Utilities.getUuid(), now.toISOString(), fingerprint);
    const row = expected.map(contactSheetText_);
    const rowNumber = sheet.getLastRow() + 1;
    try {
      const range = sheet.getRange(rowNumber, 1, 1, CONTACT_HEADERS.length);
      range.setNumberFormat('@');
      range.setValues([row]);
      SpreadsheetApp.flush();
      const saved = range.getValues()[0];
      // Acknowledgement follows persistence, not just acceptance of a browser request.
      if (!contactCellsMatch_(saved, expected, CONTACT_HEADERS.map(function (_, index) { return index; })) ||
          !contactNoFormulas_(range)) throw contactError_('SAVE_FAILED');
      return contactJson_(contactReceipt_(saved));
    } catch (_) {
      // A timeout can occur after a write. A retry with the same ID recovers its receipt.
      throw contactError_('SAVE_FAILED');
    }
  } catch (error) {
    const result = { ok: false, code: error && error.contactCode ? error.contactCode : 'UNAVAILABLE' };
    if (error && error.fieldErrors) result.fieldErrors = error.fieldErrors;
    return contactJson_(result);
  } finally {
    if (locked) try { lock.releaseLock(); } catch (_) { /* Never expose infrastructure errors or input. */ }
  }
}

function parseContactBody_(event) {
  const data = event && event.postData;
  if (!data || typeof data.contents !== 'string' || !data.contents || data.contents.length > CONTACT.MAX_BODY_LENGTH) {
    throw contactError_('INVALID_REQUEST');
  }
  if (data.type && !/^text\/plain(?:\s*;\s*charset=utf-8)?$/i.test(data.type)) throw contactError_('INVALID_REQUEST');
  let body;
  try { body = JSON.parse(data.contents); } catch (_) { throw contactError_('INVALID_REQUEST'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw contactError_('INVALID_REQUEST');
  return body;
}

function validateContact_(body) {
  if (typeof body.topic !== 'string' || !Object.prototype.hasOwnProperty.call(CONTACT_TOPIC_FIELDS, body.topic)) {
    throw contactError_('VALIDATION_ERROR', { topic: 'Choose one of the four contact topics.' });
  }
  const fields = CONTACT_COMMON_FIELDS.concat(CONTACT_TOPIC_FIELDS[body.topic]);
  if (Object.keys(body).some(function (key) { return fields.indexOf(key) === -1; })) throw contactError_('INVALID_REQUEST');
  if (typeof body.requestId !== 'string' || !CONTACT_UUID.test(body.requestId)) throw contactError_('INVALID_REQUEST');
  if (body.noticeVersion !== CONTACT.NOTICE_VERSION) throw contactError_('NOTICE_CHANGED');
  if (typeof body.website !== 'string' || body.website.trim()) throw contactError_('INVALID_REQUEST');

  const errors = {};
  function field_(key, max, min) {
    const raw = body[key];
    if (raw !== undefined && typeof raw !== 'string') {
      errors[key] = 'Enter text in this field.';
      return '';
    }
    const value = (raw || '').replace(/\r\n?/g, '\n').trim();
    if (value.length < (min || 0)) errors[key] = key === 'message' ? 'Enter a message of at least 10 characters.' : 'Complete this field.';
    else if (value.length > max) errors[key] = 'Use no more than ' + max + ' characters.';
    return value;
  }
  const payload = {
    requestId: body.requestId.toLowerCase(), noticeVersion: CONTACT.NOTICE_VERSION, topic: body.topic,
    message: field_('message', 5000, 10), name: field_('name', 80), email: field_('email', 254)
  };
  if (payload.email && !/^[^\s@\u0000-\u001f\u007f]+@[^\s@\u0000-\u001f\u007f]+\.[^\s@\u0000-\u001f\u007f]+$/.test(payload.email)) {
    errors.email = 'Enter an email address, or leave it empty if you do not need a reply.';
  }
  for (const key of CONTACT_TOPIC_FIELDS[body.topic]) {
    const max = key === 'preferredCredit' ? 120 : key === 'requestType' ? 20 : 2048;
    payload[key] = field_(key, max, key === 'requestType' ? 1 : 0);
    if (key.endsWith('Url') && payload[key] && !contactHttpUrl_(payload[key])) {
      errors[key] = 'Enter a complete http:// or https:// link, or leave this field empty.';
    }
  }
  if (body.topic === 'privacy' && ['question', 'access', 'correction', 'removal', 'other'].indexOf(payload.requestType) === -1) {
    errors.requestType = 'Choose a privacy request type.';
  }
  if (Object.keys(errors).length) throw contactError_('VALIDATION_ERROR', errors);
  return payload;
}

// Apps Script does not provide the browser URL constructor. These are stored references,
// never fetched by this service. Refuse missing hosts, credentials, whitespace and controls.
function contactHttpUrl_(value) {
  const match = /^https?:\/\/([^\/?#]+)(?:[\/?#][^\s]*)?$/i.exec(value);
  if (!match || /[\s\u0000-\u001f\u007f\\]/.test(value) || /@/.test(match[1])) return false;
  const authority = match[1];
  const host = authority.charAt(0) === '['
    ? /^\[[0-9a-f:.]+\](?::([0-9]+))?$/i.exec(authority)
    : /^[^:<>"'`{}|^%]+(?::([0-9]+))?$/.exec(authority);
  return Boolean(host && (!host[1] || (Number(host[1]) > 0 && Number(host[1]) <= 65535)));
}

function contactFingerprint_(payload) {
  // Canonical keys are built by validateContact_; trimming/CRLF normalization is consistent.
  const content = Object.keys(payload).filter(function (key) { return key !== 'requestId'; })
    .map(function (key) { return [key, payload[key]]; });
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(content), Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function contactReceipt_(row) {
  if (!CONTACT_UUID.test(String(row[0])) || !CONTACT_UUID.test(String(row[1])) ||
      !contactDate_(row[2]) || row[3] !== CONTACT.NOTICE_VERSION) throw contactError_('SAVE_FAILED');
  return { ok: true, requestId: row[0], receiptId: row[1], receivedAt: contactDate_(row[2]).toISOString(), noticeVersion: row[3] };
}

function contactRecord_(payload, receiptId, receivedAt, fingerprint) {
  return [
    payload.requestId, receiptId, receivedAt, CONTACT.NOTICE_VERSION, payload.topic,
    payload.message, payload.name, payload.email, payload.pageUrl || '', payload.sourceUrl || '',
    payload.resourceUrl || '', payload.requestType || '', payload.preferredCredit || '',
    'new', '', '', fingerprint
  ];
}

function contactCellsMatch_(saved, expected, indexes) {
  return saved.length === CONTACT_HEADERS.length && indexes.every(function (index) {
    const raw = expected[index];
    const escaped = contactSheetText_(raw);
    // Sheets may omit the special leading apostrophe in getValues(). Only permit
    // that representation change when this service actually added the apostrophe.
    return saved[index] === escaped || (escaped !== raw && saved[index] === raw);
  });
}

function contactNoFormulas_(range) {
  return range.getFormulas()[0].every(function (formula) { return formula === ''; });
}

function contactSheet_(create) {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id || !String(id).trim()) throw contactError_('NOT_CONFIGURED');
  const book = SpreadsheetApp.openById(String(id).trim());
  let sheet = book.getSheetByName(CONTACT.SHEET_NAME);
  if (!sheet && create) sheet = book.insertSheet(CONTACT.SHEET_NAME);
  if (!sheet) throw contactError_('NOT_CONFIGURED');
  if (sheet.getLastRow() === 0 && create) {
    sheet.getRange(1, 1, 1, CONTACT_HEADERS.length).setValues([CONTACT_HEADERS.slice()]);
  }
  const headers = sheet.getRange(1, 1, 1, CONTACT_HEADERS.length).getValues()[0];
  if (sheet.getLastColumn() !== CONTACT_HEADERS.length || headers.some(function (header, index) { return header !== CONTACT_HEADERS[index]; })) {
    throw contactError_('NOT_CONFIGURED');
  }
  return sheet;
}

function contactRows_(sheet, maintenance) {
  const count = sheet.getLastRow() - 1;
  if (count > CONTACT.MAX_ROWS && !maintenance) throw contactError_('BUSY');
  return count > 0 ? sheet.getRange(2, 1, count, CONTACT_HEADERS.length).getValues() : [];
}

// Defend even when a formula is preceded by whitespace, a zero-width mark or controls.
// Apply to every stored string, in addition to setting the destination range to plain text.
function contactSheetText_(value) {
  const text = String(value == null ? '' : value);
  return text.charAt(0) === "'" || /^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]*[=+\-@]/.test(text) ? "'" + text : text;
}

function contactDate_(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function contactError_(code, fieldErrors) {
  const error = new Error(code);
  error.contactCode = code;
  if (fieldErrors) error.fieldErrors = fieldErrors;
  return error;
}

function contactJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

/** Owner only: run from the Apps Script editor after restricting the dedicated Sheet. */
function setup_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONTACT.LOCK_WAIT_MS)) throw contactError_('BUSY');
  try {
    const sheet = contactSheet_(true);
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
    return { ready: true, noticeVersion: CONTACT.NOTICE_VERSION };
  } finally { lock.releaseLock(); }
}

/** Owner only: a review report, never a deletion job. No message text or identifiers in logs. */
function retentionReport_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONTACT.LOCK_WAIT_MS)) throw contactError_('BUSY');
  try {
    const rows = contactRows_(contactSheet_(false), true);
    const now = new Date();
    const actions = [];
    rows.forEach(function (row, index) {
      const status = row[13];
      const action = { row: index + 2 };
      let start;
      let days;
      if (status === 'new' || status === 'in_progress') {
        start = contactDate_(row[15] || row[2]);
        days = CONTACT.REVIEW_DAYS;
        action.action = 'review-unresolved';
      } else if (status === 'closed' || status === 'spam') {
        start = contactDate_(row[14]);
        days = CONTACT.CLOSED_REVIEW_DAYS;
        action.action = 'plan-deletion';
      } else {
        action.action = 'check-status'; actions.push(action); return;
      }
      if (!start || start.getTime() > now.getTime()) {
        action.action = 'check-date'; actions.push(action); return;
      }
      const due = new Date(start.getTime() + days * 86400000);
      if (due.getTime() <= now.getTime()) { action.dueAt = due.toISOString(); actions.push(action); }
    });
    const report = { generatedAt: now.toISOString(), actions: actions };
    // Row numbers locate work in the restricted Sheet without logging messages, names,
    // emails, receipt/request IDs or URL fields. This operational report remains private.
    console.log(JSON.stringify(report));
    return report;
  } finally { lock.releaseLock(); }
}
