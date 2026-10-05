const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const { load } = require('./gas-mock');
const ROOT = process.argv[2];
// Adapted for the Student Hub: the page now also loads the site's fonts, icons, manifest and data files
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.csv': 'text/csv' };
const PNG = Buffer.from(fs.readFileSync(path.join(__dirname, 'png.b64'), 'utf8').trim(), 'base64');

(async () => {
  const gas = load(path.join(ROOT, 'integrations/directory-apps-script/Code.gs'), { SPREADSHEET_ID: 's', PHOTO_FOLDER_ID: 'f' });
  gas.ctx.setup();
  let failNext = 0, preflights = 0, posts = 0;
  // "Google" on its own port: answers simple requests only, like Apps Script.
  const api = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') { preflights++; res.writeHead(405); return res.end(); }
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      posts++;
      if (failNext > 0) { failNext--; req.socket.destroy(); return; }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(gas.post(body)));
    });
  }).listen(0);
  const apiUrl = `http://127.0.0.1:${api.address().port}/exec`;
  let endpoint = apiUrl;
  const site = http.createServer((req, res) => {
    const file = req.url.split('?')[0].replace(/^\//, '') || 'join.html';
    if (file === 'directory-config.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(path.join(ROOT, file), 'utf8').replace('endpoint: ""', `endpoint: "${endpoint}"`));
    }
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(full)] || 'text/plain' }); res.end(fs.readFileSync(full));
  }).listen(0);
  const siteUrl = `http://127.0.0.1:${site.address().port}/join.html`;

  // Adapted for the Student Hub: use the installed Chrome (no separate browser download needed)
  const browser = await chromium.launch({ channel: 'chrome' });
  let n = 0; const ok = (name) => { n++; console.log('  ok  ' + name); };
  const errors = [];
  const open = async (viewport = { width: 1280, height: 800 }) => {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push(m.text()); });
    await page.goto(siteUrl); return page;
  };
  const fillStep1 = async (page, email = 'new.student@studio.unibo.it') => {
    await page.fill('#fullName', 'New Student'); await page.fill('#universityEmail', email);
    await page.fill('#primaryCountry', 'Syria'); await page.selectOption('#previousField', 'Other');
    await page.fill('#previousFieldOther', 'Nursing'); await page.selectOption('#euhemTrack', 'Health Economics & Policy');
  };

  let page = await open();
  assert.strictEqual(await page.evaluate(() => window.scrollY), 0);
  assert.strictEqual(await page.evaluate(() => document.activeElement === document.body), true);
  ok('page opens at the top without stealing focus');
  assert.strictEqual(await page.locator('[data-phone-field]').count(), 0);
  ok('phone fields are absent by default');
  assert.strictEqual(await page.locator('#countryList option').count() > 190, true);
  ok('country list is filled');

  await page.click('[data-step="1"] [data-next]');
  assert.strictEqual(await page.locator('[data-step="1"]').isVisible(), true);
  assert.strictEqual(await page.locator('#fullNameError').textContent(), 'Please enter your full name.');
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'fullName');
  ok('empty step 1 is blocked, error shown, focus moved to the first problem');

  await fillStep1(page, 'someone@gmail.com');
  await page.click('[data-step="1"] [data-next]');
  assert.match(await page.locator('#universityEmailError').textContent(), /@studio\.unibo\.it/);
  ok('non-university email is refused in the browser');

  await page.fill('#universityEmail', 'New.Student@studio.unibo.it');
  await page.click('[data-step="1"] [data-next]');
  assert.strictEqual(await page.locator('[data-step="2"]').isVisible(), true);
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'step2Title');
  ok('step 2 opens and its heading receives focus');

  await page.fill('#linkedin', 'https://evil.example/linkedin.com');
  await page.click('[data-step="2"] [data-next]');
  assert.match(await page.locator('#linkedinError').textContent(), /linkedin\.com/);
  await page.fill('#linkedin', 'https://www.linkedin.com/in/new-student');
  await page.fill('#shortBio', 'Hello'); assert.strictEqual(await page.locator('#bioCounter').textContent(), '5 / 250');
  await page.setInputFiles('#profilePhoto', { name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => document.getElementById('photoStatus').textContent.startsWith('Ready'));
  ok('bad LinkedIn refused, photo prepared in the browser');
  await page.click('[data-step="2"] [data-next]');

  assert.deepStrictEqual(await page.locator('#linkedinVisibility option').allTextContents(), ['EU-HEM students only', 'Hidden']);
  await page.check('input[name="profileVisibility"][value="public"]');
  assert.deepStrictEqual(await page.locator('#linkedinVisibility option').allTextContents(), ['Public', 'EU-HEM students only', 'Hidden']);
  assert.deepStrictEqual(await page.locator('#emailVisibility option').allTextContents(), ['EU-HEM students only', 'Hidden']);
  assert.strictEqual(await page.locator('#emailVisibility').inputValue(), 'hidden');
  ok('visibility choices follow the profile setting; email can never be public and defaults to hidden');

  await page.click('#submitButton');
  assert.match(await page.locator('#analyticsConsentError').textContent(), /Yes or No/);
  assert.strictEqual(posts, 0);
  ok('submit without consent choices sends nothing');
  await page.check('input[name="analyticsConsent"][value="yes"]'); await page.check('#privacyAcknowledgement');

  failNext = 1; await page.waitForTimeout(3100);
  await page.click('#submitButton');
  await page.waitForFunction(() => /press Submit again/.test(document.getElementById('formMessage').textContent));
  assert.strictEqual(gas.grid.length, 1);
  ok('a dropped connection shows a clear message and keeps the form filled');
  await page.click('#submitButton');
  await page.waitForSelector('#successCard:not([hidden])');
  assert.match(await page.locator('#successConfirmText').textContent(), /new\.student@studio\.unibo\.it/i);
  const row = gas.row(1);
  assert.strictEqual(row['Previous Academic Field'], 'Other: Nursing');
  assert.strictEqual(row['University Email'], 'new.student@studio.unibo.it');
  assert.strictEqual(row['Status'], 'unconfirmed');
  assert.strictEqual(row['LinkedIn Visibility'], 'public');
  assert.strictEqual(gas.files.length, 1); assert.strictEqual(gas.files[0].blob.mime, 'image/jpeg');
  assert.strictEqual(gas.mails.length, 1);
  assert.strictEqual(preflights, 0);
  ok('retry succeeds: saved once, "Other" field kept, photo stored as JPEG, confirmation email sent, no CORS preflight');
  await page.close();

  page = await open(); await fillStep1(page);
  await page.click('[data-step="1"] [data-next]'); await page.click('[data-step="2"] [data-next]');
  await page.check('input[name="analyticsConsent"][value="no"]'); await page.check('#privacyAcknowledgement');
  await page.waitForTimeout(3100); await page.click('#submitButton');
  await page.waitForFunction(() => /already exists/.test(document.getElementById('formMessage').textContent));
  assert.strictEqual(gas.grid.length, 2);
  ok('second submission with the same email is refused with a helpful message');
  await page.close();

  page = await open({ width: 375, height: 700 });
  for (const step of [1, 2, 3]) {
    assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'step ' + step);
    if (step === 1) await fillStep1(page, 'phone.user@studio.unibo.it');
    if (step < 3) await page.click(`[data-step="${step}"] [data-next]`);
  }
  ok('no sideways scrolling at 375px on any step');
  await page.close();

  endpoint = '';
  page = await open(); await fillStep1(page, 'later@studio.unibo.it');
  await page.click('[data-step="1"] [data-next]'); await page.click('[data-step="2"] [data-next]');
  await page.check('input[name="analyticsConsent"][value="no"]'); await page.check('#privacyAcknowledgement');
  const before = posts; await page.click('#submitButton');
  assert.match(await page.locator('#formMessage').textContent(), /not open for submissions yet/);
  assert.strictEqual(posts, before);
  ok('with no endpoint configured the form says so and sends nothing');

  assert.deepStrictEqual(errors, []);
  ok('no JavaScript errors');
  console.log(n + ' browser checks passed');
  await browser.close(); api.close(); site.close();
})().catch(e => { console.error(e); process.exit(1); });
