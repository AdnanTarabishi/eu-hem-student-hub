// Minimal in-memory stand-ins for the Google services Code.gs uses.
const vm = require('vm'), fs = require('fs'), crypto = require('crypto');
function load(codePath, props) {
  const grid = [[]];            // sheet cells, row 0 = headers
  const files = [], mails = [], cache = {};
  const disp = v => v instanceof Date ? v.toISOString() : (v === false ? 'FALSE' : v === true ? 'TRUE' : String(v ?? '')).replace(/^'/, '');
  const sheet = {
    getLastRow: () => grid.filter(r => r.some(c => c !== '' && c != null)).length,
    getLastColumn: () => Math.max(0, ...grid.map(r => r.length)),
    setFrozenRows() {},
    appendRow(row) { grid[sheet.getLastRow()] = row.slice(); },
    getRange(r, c, nr = 1, nc = 1) {
      return {
        getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => disp((grid[r - 1 + i] || [])[c - 1 + j]))),
        getValue: () => (grid[r - 1] || [])[c - 1],
        setValue(v) { (grid[r - 1] = grid[r - 1] || [])[c - 1] = v; },
        setValues(vals) { vals.forEach((row, i) => row.forEach((v, j) => { (grid[r - 1 + i] = grid[r - 1 + i] || [])[c - 1 + j] = v; })); }
      };
    }
  };
  let hasSheet = false;
  const ctx = {
    console: { log() {}, error() {} },
    SpreadsheetApp: { openById: id => { if (id !== props.SPREADSHEET_ID) throw new Error('no access'); return {
      getSheetByName: n => hasSheet && n === 'Submissions' ? sheet : null, insertSheet: () => { hasSheet = true; return sheet; } }; } },
    DriveApp: { getFolderById: () => ({ getName: () => 'photos', createFile: b => { const f = { id: 'file' + files.length, blob: b, trashed: false }; files.push(f);
      return { getId: () => f.id }; } }), getFileById: id => ({ setTrashed: v => { files.find(f => f.id === id).trashed = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: (to, subject, body, opt) => { if (props.__MAIL_FAILS) throw new Error('quota'); mails.push({ to, subject, body, opt }); } },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.example/exec' }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    HtmlService: { createHtmlOutput: h => ({ html: h }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      base64Decode: s => [...Buffer.from(s, 'base64')].map(b => b > 127 ? b - 256 : b),
      newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
      DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
      computeDigest: (_, v) => [...crypto.createHash('sha256').update(v, 'utf8').digest()].map(b => b > 127 ? b - 256 : b)
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), ctx);
  return { ctx, grid, files, mails, props,
    post: body => JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text),
    get: params => ctx.doGet({ parameter: params }).html,
    row: i => Object.fromEntries(grid[0].map((h, j) => [h, grid[i][j]])) };
}
module.exports = { load };
