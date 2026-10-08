// Private Contact service: fictional in-memory Google services, no network or real data.
// Run from the repository root: node tests/contact/backend.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const CODE = fs.readFileSync(path.join(ROOT, 'integrations/contact-apps-script/Code.gs'), 'utf8');
const NOW = Date.parse('2026-10-08T12:00:00.000Z');
const VERSION = 'contact-v1-2026-10';
const DAY = 86400000;
let checks = 0;
function test(name, run) { run(); checks++; console.log('  ok  ' + name); }
function body(overrides = {}) {
  return { requestId: crypto.randomUUID(), noticeVersion: VERSION, topic: 'idea',
    message: 'A fictional suggestion to improve the course links.', name: '', email: '', website: '', ...overrides };
}

function harness({ configured = true, setup = true } = {}) {
  const sheets = {};
  const state = { opens: 0, writes: 0, formats: 0, flushes: 0, releases: 0, locked: false, logs: [], formulas: {} };
  const props = configured ? { SPREADSHEET_ID: 'fictional-contact-sheet-id' } : {};
  function makeSheet() {
    const grid = [];
    return {
      grid,
      getLastRow: () => grid.length,
      getLastColumn: () => Math.max(0, ...grid.map((row) => row.length)),
      setFrozenRows() {},
      getRange(r, c, nr = 1, nc = 1) {
        return {
          setNumberFormat(format) { assert.equal(format, '@'); state.formats++; },
          setValues(values) {
            if (state.failWriteBefore) throw new Error('private input and infrastructure must not be disclosed');
            for (let i = 0; i < nr; i++) {
              const row = grid[r - 1 + i] || (grid[r - 1 + i] = []);
              for (let j = 0; j < nc; j++) {
                if (!state.partialWrite || r === 1 || [0, 1, 2, 3, 16].includes(j)) row[c - 1 + j] = values[i][j];
              }
            }
            state.writes++;
            if (state.failWriteAfter) throw new Error('write acknowledgement lost');
          },
          getValues() {
            const result = Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
              let value = grid[r - 1 + i]?.[c - 1 + j] ?? '';
              if (state.stripEscape && typeof value === 'string' && value.startsWith("'")) value = value.slice(1);
              return value;
            }));
            if (r > 1 && state.corruptReadback && nr === 1) result[0][5] = 'different stored message';
            return result;
          },
          getFormulas: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => state.formulas[`${r + i}:${c + j}`] || ''))
        };
      }
    };
  }
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [NOW])); }
    static now() { return NOW; }
  }
  const context = {
    Date: ClockDate,
    console: { log: (...args) => state.logs.push(args.join(' ')), error: (...args) => state.logs.push(args.join(' ')) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => props[key] ?? null }) },
    SpreadsheetApp: {
      openById(id) {
        state.opens++;
        assert.equal(id, props.SPREADSHEET_ID);
        if (state.denySheet) throw new Error('fictional private sheet denied');
        return { getSheetByName: (name) => sheets[name] || null, insertSheet: (name) => (sheets[name] = makeSheet()) };
      },
      flush() { state.flushes++; if (state.failFlush) throw new Error('fictional flush timeout'); }
    },
    LockService: { getScriptLock: () => ({
      tryLock(wait) {
        assert.equal(wait, 10000);
        if (state.throwLock) throw new Error('fictional lock service unavailable');
        if (state.locked || state.denyLock) return false;
        state.locked = true; return true;
      },
      releaseLock() { state.locked = false; state.releases++; }
    }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(value).digest()].map((byte) => byte > 127 ? byte - 256 : byte)
    },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (text) => ({ text, setMimeType(type) { assert.equal(type, 'application/json'); return this; } }) }
  };
  vm.createContext(context);
  vm.runInContext(CODE + '\n;this.__settings = CONTACT; this.__headers = CONTACT_HEADERS;', context);
  const api = {
    context, state, sheets, props,
    get grid() { return sheets['Contact Inbox']?.grid || []; },
    post(value, type = 'text/plain;charset=utf-8') {
      return JSON.parse(context.doPost({ postData: { type, contents: typeof value === 'string' ? value : JSON.stringify(value) } }).text);
    },
    get(parameters) { return JSON.parse(context.doGet({ parameter: parameters }).text); },
    row(index = 1) { return Object.fromEntries(api.grid[0].map((header, n) => [header, api.grid[index][n]])); }
  };
  if (configured && setup) context.setup_();
  return api;
}

test('frontend notice and backend notice match; manifest exposes only the required spreadsheet scope', () => {
  const config = { window: {} }; vm.createContext(config);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'contact-config.js'), 'utf8'), config);
  const g = harness();
  assert.equal(config.window.CONTACT_CONFIG.noticeVersion, g.context.__settings.NOTICE_VERSION);
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'integrations/contact-apps-script/appsscript.json')));
  assert.deepEqual(manifest.oauthScopes, ['https://www.googleapis.com/auth/spreadsheets']);
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS');
  assert.equal(manifest.exceptionLogging, 'NONE');
});
test('only doGet and doPost are public; no mail, file, remote-fetch or HTML/RPC service exists', () => {
  const names = [...CODE.matchAll(/^function\s+(\w+)\s*\(/gm)].map((match) => match[1]);
  assert.deepEqual(names.filter((name) => !name.endsWith('_')).sort(), ['doGet', 'doPost']);
  assert.doesNotMatch(CODE, /\b(?:MailApp|GmailApp|DriveApp|UrlFetchApp|HtmlService)\s*\./);
  const g = harness(); const opens = g.state.opens;
  for (const parameters of [{}, { action: 'list' }, { action: 'status', requestId: crypto.randomUUID() }, { action: 'setup' }]) {
    assert.deepEqual(g.get(parameters), { service: 'euhem-contact', noticeVersion: VERSION });
  }
  assert.equal(g.state.opens, opens, 'GET never opens the private Sheet');
});
test('setup is repeatable, preserves rows, and refuses an unfamiliar schema without rewriting it', () => {
  const g = harness(); const request = body(); assert.equal(g.post(request).ok, true);
  const snapshot = JSON.stringify(g.grid); g.context.setup_(); assert.equal(JSON.stringify(g.grid), snapshot);
  g.grid[0][0] = 'Unexpected header'; const invalid = JSON.stringify(g.grid);
  assert.throws(() => g.context.setup_()); assert.equal(JSON.stringify(g.grid), invalid);
  assert.equal(g.post(body()).code, 'NOT_CONFIGURED');
});
test('configuration and setup are required; posting cannot create a Sheet or expose identifiers', () => {
  assert.deepEqual(harness({ configured: false }).post(body()), { ok: false, code: 'NOT_CONFIGURED' });
  const g = harness({ setup: false }); assert.equal(g.post(body()).code, 'NOT_CONFIGURED');
  assert.deepEqual(Object.keys(g.sheets), []);
  g.state.denySheet = true; assert.deepEqual(g.post(body()), { ok: false, code: 'UNAVAILABLE' });
  assert.deepEqual(g.state.logs, []);
});
test('all four topics persist only their allowed fields, with optional identity and no notifications', () => {
  const samples = [
    { topic: 'correction', pageUrl: 'https://example.invalid/page', sourceUrl: 'https://example.invalid/source' },
    { topic: 'idea' },
    { topic: 'privacy', requestType: 'removal', pageUrl: 'https://example.invalid/item' },
    { topic: 'contribution', resourceUrl: 'https://example.invalid/notes', preferredCredit: 'A fictional contributor' }
  ];
  for (const sample of samples) {
    const g = harness(); const request = body(sample); const result = g.post(request);
    assert.equal(result.ok, true);
    assert.deepEqual(Object.keys(result).sort(), ['noticeVersion', 'ok', 'receiptId', 'receivedAt', 'requestId']);
    assert.equal(result.requestId, request.requestId); assert.equal(result.receivedAt, new Date(NOW).toISOString());
    assert.match(result.receiptId, /^[0-9a-f-]{36}$/); assert.notEqual(result.receiptId, result.requestId);
    const stored = g.row(); assert.equal(stored.Topic, sample.topic); assert.equal(stored['Reply Email'], '');
    assert.equal(stored.Status, 'new'); assert.equal(stored['Closed At'], ''); assert.equal(stored['Last Reviewed At'], '');
    assert.match(stored['Payload Fingerprint'], /^[0-9a-f]{64}$/);
    assert.equal(g.state.formats, 1); assert.equal(g.grid.length, 2); assert.deepEqual(g.state.logs, []);
  }
});
test('optional email is accepted for every topic and never treated as verified identity', () => {
  for (const topic of ['correction', 'idea', 'privacy', 'contribution']) {
    const g = harness(); const request = body({ topic, email: 'fictional@example.invalid', ...(topic === 'privacy' ? { requestType: 'access' } : {}) });
    assert.equal(g.post(request).ok, true); assert.equal(g.row()['Reply Email'], request.email);
    assert.equal(g.grid[0].some((name) => /verified|confirmed/i.test(name)), false);
  }
});
test('invalid JSON, non-objects, oversized bodies and inappropriate media types never reach storage', () => {
  const g = harness(); const writes = g.state.writes;
  for (const value of ['', '{', '[]', 'null', 'true', '5', ' '.repeat(20001)]) assert.equal(g.post(value).code, 'INVALID_REQUEST');
  assert.equal(g.post(body(), 'application/json').code, 'INVALID_REQUEST');
  assert.equal(g.post(body(), 'text/plain; charset=UTF-8').ok, true);
  assert.equal(g.state.writes, writes + 1);
});
test('unknown fields, forged admin fields and inactive-topic fields are refused rather than retained', () => {
  const g = harness();
  for (const extra of [{ title: 'not part of this contract' }, { status: 'closed' }, { receivedAt: '2020-01-01' }, { receiptId: crypto.randomUUID() }, { pageUrl: '' }, { requestType: 'question' }, { action: 'list' }, { ['__proto__']: { polluted: true } }]) {
    assert.equal(g.post(body(extra)).code, 'INVALID_REQUEST');
  }
  assert.equal(g.grid.length, 1); assert.equal({}.polluted, undefined);
});
test('UUID v4, current notice and empty honeypot are enforced without saving rejected messages', () => {
  const g = harness();
  for (const requestId of ['', 'short', '00000000-0000-1000-8000-000000000000', crypto.randomUUID() + 'extra']) assert.equal(g.post(body({ requestId })).code, 'INVALID_REQUEST');
  assert.equal(g.post(body({ noticeVersion: 'old-contact-notice' })).code, 'NOTICE_CHANGED');
  assert.equal(g.post(body({ website: 'https://spam.invalid' })).code, 'INVALID_REQUEST');
  assert.equal(g.post(body({ website: null })).code, 'INVALID_REQUEST');
  assert.equal(g.grid.length, 1);
});
test('topic, required message, length boundaries and string-only fields are validated', () => {
  const invalid = [
    ['message', '         '], ['message', '123456789'], ['message', 'x'.repeat(5001)],
    ['name', 'x'.repeat(81)], ['email', 'x'.repeat(255)], ['message', ['not text']], ['name', null]
  ];
  const g = harness();
  for (const [key, value] of invalid) { const result = g.post(body({ [key]: value })); assert.equal(result.code, 'VALIDATION_ERROR'); assert.ok(result.fieldErrors[key]); }
  for (const topic of ['other', '__proto__', 'constructor', 'CORRECTION', null]) assert.equal(g.post(body({ topic })).code, 'VALIDATION_ERROR');
  assert.equal(g.post(body({ message: '  1234567890  ', name: 'x'.repeat(80) })).ok, true);
  assert.equal(g.row().Message, '1234567890');
  assert.equal(g.post(body({ message: 'x'.repeat(5000) })).ok, true);
});
test('email and HTTP(S) link validation reject controls, credentials and non-web schemes', () => {
  for (const email of ['not-email', 'x@@example.invalid', 'a@b', 'a\n@example.invalid', 'a\u0000@example.invalid']) {
    const result = harness().post(body({ email })); assert.equal(result.code, 'VALIDATION_ERROR'); assert.ok(result.fieldErrors.email);
  }
  for (const pageUrl of ['javascript:alert(1)', 'ftp://example.invalid', 'https://', 'https://user:password@example.invalid', 'https://example.invalid/\nprivate', 'https://example.invalid/\u0000private', 'https://example.invalid:99999', 'https://example.invalid/has space', 'https://example.invalid\\other', 'x'.repeat(2049)]) {
    const result = harness().post(body({ topic: 'correction', pageUrl })); assert.equal(result.code, 'VALIDATION_ERROR', pageUrl); assert.ok(result.fieldErrors.pageUrl);
  }
  for (const pageUrl of ['https://example.invalid/path?x=1#part', 'http://example.invalid:8080/page', 'https://[2001:db8::1]/']) assert.equal(harness().post(body({ topic: 'correction', pageUrl })).ok, true);
});
test('privacy types and contribution credit are specific to their topic', () => {
  for (const requestType of ['question', 'access', 'correction', 'removal', 'other']) assert.equal(harness().post(body({ topic: 'privacy', requestType })).ok, true);
  for (const requestType of ['', 'delete-everything', null]) assert.equal(harness().post(body({ topic: 'privacy', requestType })).code, 'VALIDATION_ERROR');
  assert.equal(harness().post(body({ topic: 'contribution', preferredCredit: 'x'.repeat(120) })).ok, true);
  assert.equal(harness().post(body({ topic: 'contribution', preferredCredit: 'x'.repeat(121) })).code, 'VALIDATION_ERROR');
});
test('formula-like values, leading whitespace/control marks and literal apostrophes remain plain text', () => {
  const g = harness();
  for (const value of ['=IMPORTXML("https://example.invalid")', '+1234567890', '-1234567890', '@fictional-user', ' \t\u0000=SUM(1,2)', '\u200b\u202e=SUM(1,2)', "'literal text"]) {
    const escaped = g.context.contactSheetText_(value); assert.equal(escaped, "'" + value);
    const request = body({ message: value, name: value });
    g.state.stripEscape = true;
    const result = g.post(request); assert.equal(result.ok, true, value);
    assert.equal(g.post(request).receiptId, result.receiptId, 'retry matches either safe Sheet representation');
  }
  assert.equal(g.context.contactSheetText_('ordinary text'), 'ordinary text');
});
test('same canonical request returns its original receipt once; the same email can send another message', () => {
  const g = harness(); const request = body({ email: 'fictional@example.invalid', message: 'Line one\r\nLine two' });
  const first = g.post(request); const writes = g.state.writes;
  assert.deepEqual(g.post({ ...request, message: '  Line one\nLine two  ' }), first);
  assert.equal(g.state.writes, writes); assert.equal(g.grid.length, 2);
  assert.equal(g.post({ ...request, requestId: crypto.randomUUID() }).ok, true);
  assert.equal(g.grid.length, 3);
});
test('reusing a request ID with changed content conflicts without overwriting the original', () => {
  const g = harness(); const request = body(); const first = g.post(request); const snapshot = JSON.stringify(g.grid);
  assert.deepEqual(g.post({ ...request, message: 'A different fictional message.' }), { ok: false, code: 'REQUEST_CONFLICT' });
  assert.equal(JSON.stringify(g.grid), snapshot); assert.deepEqual(g.post(request), first);
});
test('a changed stored message cannot earn a retry acknowledgement from matching metadata/fingerprint alone', () => {
  const g = harness(); const request = body(); assert.equal(g.post(request).ok, true);
  g.grid[1][5] = 'CORRUPTED MESSAGE';
  assert.deepEqual(g.post(request), { ok: false, code: 'SAVE_FAILED' });
});
test('admin status and review dates can change without invalidating an otherwise exact retry', () => {
  const g = harness(); const request = body(); const first = g.post(request);
  g.grid[1][13] = 'closed'; g.grid[1][14] = new Date(NOW).toISOString(); g.grid[1][15] = new Date(NOW).toISOString();
  assert.deepEqual(g.post(request), first);
});
test('a held or failed lock prevents both duplicate writes and success responses', () => {
  for (const flag of ['locked', 'denyLock', 'throwLock']) {
    const g = harness(); g.state[flag] = true; const writes = g.state.writes; const releases = g.state.releases;
    assert.deepEqual(g.post(body()), { ok: false, code: 'BUSY' }); assert.equal(g.state.writes, writes); assert.equal(g.state.releases, releases);
  }
});
test('write, flush and incomplete readback failures never return success; a lost reply is safely retried', () => {
  for (const flag of ['failWriteBefore', 'failWriteAfter', 'failFlush', 'partialWrite', 'corruptReadback']) {
    const g = harness(); const request = body(); g.state[flag] = true;
    assert.deepEqual(g.post(request), { ok: false, code: 'SAVE_FAILED' }, flag);
    assert.equal(g.state.locked, false); assert.deepEqual(g.state.logs, []);
    if (['failWriteAfter', 'failFlush'].includes(flag)) {
      g.state[flag] = false; assert.equal(g.post(request).ok, true); assert.equal(g.grid.length, 2);
    }
  }
});
test('formula presence blocks acknowledgements on both initial write and retry even with matching values', () => {
  const g = harness(); const request = body(); g.state.formulas['2:6'] = '="A fictional suggestion to improve the course links."';
  assert.equal(g.post(request).code, 'SAVE_FAILED');
  assert.equal(g.post(request).code, 'SAVE_FAILED');
});
test('global rolling-hour and total caps limit new writes while allowing exact retries at the cap', () => {
  for (const cap of ['hour', 'total']) {
    const g = harness(); const request = body(); const first = g.post(request); const seed = [...g.grid[1]];
    const limit = cap === 'hour' ? 30 : 1000;
    if (cap === 'total') g.grid[1][2] = new Date(NOW - 2 * DAY).toISOString();
    for (let i = 1; i < limit; i++) { const row = [...seed]; row[0] = crypto.randomUUID(); row[1] = crypto.randomUUID(); if (cap === 'total') row[2] = new Date(NOW - 2 * DAY).toISOString(); g.grid.push(row); }
    const writes = g.state.writes; assert.deepEqual(g.post(body()), { ok: false, code: 'BUSY' }); assert.equal(g.state.writes, writes);
    const retry = g.post(request); assert.equal(retry.ok, true); assert.equal(retry.receiptId, first.receiptId);
    if (cap === 'hour') { for (const row of g.grid.slice(1)) row[2] = new Date(NOW - 3600000).toISOString(); assert.equal(g.post(body()).ok, true); }
  }
});
test('retention reports due reviews and planned deletions without changing or logging private content', () => {
  const g = harness(); const request = body({ name: 'Fictional Private Person', email: 'fictional-private@example.invalid', message: 'Confidential fictional message for test only.' });
  const receipt = g.post(request); const seed = [...g.grid[1]]; g.grid.length = 1;
  const row = (status, receivedDays, closedDays, reviewedDays) => {
    const copy = [...seed]; copy[0] = crypto.randomUUID(); copy[13] = status;
    copy[2] = new Date(NOW - receivedDays * DAY).toISOString();
    copy[14] = closedDays === null ? '' : new Date(NOW - closedDays * DAY).toISOString();
    copy[15] = reviewedDays === null ? '' : new Date(NOW - reviewedDays * DAY).toISOString(); return copy;
  };
  g.grid.push(row('new', 30, null, null), row('in_progress', 60, null, 29), row('closed', 120, 90, null), row('spam', 120, 89, null), row('closed', 100, null, null), row('unexpected', 10, null, null));
  const before = JSON.stringify(g.grid); const report = JSON.parse(JSON.stringify(g.context.retentionReport_()));
  assert.deepEqual(report.actions.map(({ row, action }) => ({ row, action })), [
    { row: 2, action: 'review-unresolved' }, { row: 4, action: 'plan-deletion' }, { row: 6, action: 'check-date' }, { row: 7, action: 'check-status' }
  ]);
  assert.equal(JSON.stringify(g.grid), before);
  const logs = g.state.logs.join('\n');
  for (const secret of [request.name, request.email, request.message, request.requestId, receipt.receiptId]) assert.equal(logs.includes(secret), false);
});
test('private maintenance still works above the public submission row cap', () => {
  const g = harness(); g.post(body()); const seed = [...g.grid[1]];
  seed[2] = new Date(NOW - 31 * DAY).toISOString(); g.grid.length = 1;
  for (let i = 0; i < 1001; i++) g.grid.push([...seed]);
  assert.equal(g.post(body()).code, 'BUSY');
  assert.equal(g.context.retentionReport_().actions.length, 1001);
});
console.log(`${checks} private Contact backend checks passed`);
