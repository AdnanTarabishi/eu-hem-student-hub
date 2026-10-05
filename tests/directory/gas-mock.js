// Minimal in-memory stand-ins for the Google services Code.gs uses.
// Student Hub: supports several tabs (Submissions and Options) and HtmlService.addMetaTag.
const vm = require('vm'), fs = require('fs'), crypto = require('crypto');
function makeSheet() {
  const grid = [[]];            // cells, row 0 = headers
  const disp = v => v instanceof Date ? v.toISOString() : (v === false ? 'FALSE' : v === true ? 'TRUE' : String(v ?? '')).replace(/^'/, '');
  const sheet = {
    grid,
    getLastRow: () => grid.filter(r => r.some(c => c !== '' && c != null)).length,
    getLastColumn: () => Math.max(0, ...grid.map(r => r.length)),
    setFrozenRows() {},
    clear() { grid.length = 0; grid.push([]); },
    appendRow(row) { grid[sheet.getLastRow()] = row.slice(); },
    getRange(r, c, nr = 1, nc = 1) {
      return {
        getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => disp((grid[r - 1 + i] || [])[c - 1 + j]))),
        getValue: () => (grid[r - 1] || [])[c - 1],
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (grid[r - 1 + i] || [])[c - 1 + j] ?? '')),
        setValue(v) { (grid[r - 1] = grid[r - 1] || [])[c - 1] = v; },
        setValues(vals) { vals.forEach((row, i) => row.forEach((v, j) => { (grid[r - 1 + i] = grid[r - 1 + i] || [])[c - 1 + j] = v; })); }
      };
    }
  };
  return sheet;
}
function load(codePath, props) {
  const sheets = {};
  const files = [], mails = [], cache = {};
  const ctx = {
    console: { log() {}, error() {} },
    SpreadsheetApp: { openById: id => { if (id !== props.SPREADSHEET_ID) throw new Error('no access'); return {
      getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = makeSheet()) }; } },
    DriveApp: { getFolderById: () => ({ getName: () => 'photos', createFile: b => { const f = { id: 'file' + files.length, blob: b, trashed: false }; files.push(f);
      return { getId: () => f.id }; } }), getFileById: id => ({ setTrashed: v => { files.find(f => f.id === id).trashed = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: (to, subject, body, opt) => { if (props.__MAIL_FAILS) throw new Error('quota'); mails.push({ to, subject, body, opt }); } },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.example/exec' }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    HtmlService: { createHtmlOutput: h => ({ html: h, addMetaTag() { return this; } }) },
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
  const api = { ctx, files, mails, props, sheets,
    get grid() { return (sheets.Submissions || makeSheet()).grid; },
    post: body => JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).text),
    get: params => ctx.doGet({ parameter: params }).html,
    confirm: (id, token) => ctx.confirmEmailFromPage(id, token),
    row: i => Object.fromEntries(api.grid[0].map((h, j) => [h, api.grid[i][j]])) };
  return api;
}
module.exports = { load };
