// Explicitly enabled release check. Never run during normal tests or send student data.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { chromium } = require('playwright');

const ROOT = path.resolve(process.argv[2] || '.');
const SITE = 'https://adnantarabishi.github.io/eu-hem-student-hub/';
const ENDPOINT = process.env.DIRECTORY_ENDPOINT || '';
const OUTPUT = process.env.DIRECTORY_SMOKE_OUTPUT;
const RECOVERY = process.env.DIRECTORY_SMOKE_REQUEST_ID || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.csv': 'text/csv', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

async function main() {
  assert.strictEqual(process.env.GITHUB_ACTIONS, 'true', 'Use the explicitly enabled GitHub workflow.');
  assert.strictEqual(process.env.DIRECTORY_SMOKE_EXECUTE, 'true', 'Real delivery is off by default.');
  assert.match(ENDPOINT, /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/);
  assert.ok(OUTPUT, 'Provide a private workflow output directory.');
  if (RECOVERY) assert.match(RECOVERY, UUID);
  const requestId = RECOVERY || randomUUID();
  const email = `euhem.studenthub+directory-test-${requestId.slice(0, 8)}@gmail.com`;
  const source = fs.readFileSync(path.join(ROOT, 'directory-config.js'), 'utf8');
  const consentVersion = source.match(/consentVersion:\s*"([^"]+)"/)[1];
  const config = source.replace(/endpoint:\s*"[^"]*"/, `endpoint: ${JSON.stringify(ENDPOINT)}`);
  const summary = { fictionalTest: true, requestId, consentVersion, recovery: Boolean(RECOVERY),
    phase: 'starting', attempts: 0, receipts: [], network: [], blockedRequests: 0 };
  fs.mkdirSync(OUTPUT, { recursive: true });
  // No email, payload, confirmation token, private storage ID or temporary Google URL is recorded.
  const save = () => fs.writeFileSync(path.join(OUTPUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  save();
  let browser;
  let receiptError = false;
  const receipts = [];
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    context.setDefaultTimeout(30000);
    await context.addInitScript(id => {
      Object.defineProperty(crypto, 'randomUUID', { value: () => id });
      delete Navigator.prototype.serviceWorker;
    }, requestId);
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.url() === ENDPOINT && request.method() === 'POST') {
        try {
          const p = JSON.parse(request.postData());
          assert.strictEqual(p.requestId, requestId);
          assert.strictEqual(p.consentVersion, consentVersion);
          assert.strictEqual(p.userType, 'current_student');
          assert.strictEqual(p.fullName, 'Fictional Directory Test');
          assert.strictEqual(p.email, email);
          assert.strictEqual(p.profileVisibility, 'hidden');
          assert.strictEqual(p.analyticsConsent, 'no');
          assert.strictEqual(p.mobilityStatisticsConsent, 'no');
          assert.strictEqual(p.photoBase64, '');
          assert.strictEqual(p.website, '');
          assert.strictEqual(p.linkedin, '');
          assert.strictEqual(p.shortBio, undefined);
          assert.deepStrictEqual(p.featureInterests, []);
          assert.ok(summary.attempts < 2, 'Only an initial submission and one retry are enabled.');
          summary.attempts++;
          summary.phase = 'awaiting-receipt'; save();
          return route.continue();
        } catch (_) {
          summary.phase = 'payload-check-failed'; save();
          return route.abort();
        }
      }
      if (url.origin === 'https://script.googleusercontent.com' && url.pathname === '/macros/echo' &&
          request.method() === 'GET') return route.continue();
      if (request.url().startsWith(SITE) && request.method() === 'GET') {
        const file = decodeURIComponent(url.pathname.slice(new URL(SITE).pathname.length));
        const full = path.resolve(ROOT, file);
        if (!full.startsWith(ROOT + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
          return route.fulfill({ status: 404, body: 'Not found' });
        }
        return route.fulfill({ contentType: mime[path.extname(full)] || 'application/octet-stream',
          body: file === 'directory-config.js' ? config : fs.readFileSync(full) });
      }
      summary.blockedRequests++; save();
      return route.abort();
    });
    const page = await context.newPage();
    page.on('response', async response => {
      const url = new URL(response.url());
      if (response.url() !== ENDPOINT && url.origin !== 'https://script.googleusercontent.com') return;
      summary.network.push({ origin: url.origin, status: response.status() }); save();
      if (response.status() !== 200) return;
      try {
        const r = await response.json();
        assert.strictEqual(r.ok, true); assert.strictEqual(r.code, 'OK');
        assert.strictEqual(r.requestId, requestId); assert.strictEqual(r.consentVersion, consentVersion);
        assert.strictEqual(r.directoryEligible, true);
        assert.ok(r.confirmation === 'sent' || (RECOVERY && r.confirmation === 'not_required'),
          'Verify the actual confirmation email before activation.');
        receipts.push(r);
        summary.receipts.push({ matching: true, confirmation: r.confirmation }); save();
      } catch (_) { receiptError = true; }
    });
    // Candidate files execute at the real site's origin. Only the Google POST/reply is unmocked.
    for (let attempt = 0; attempt < 2; attempt++) {
      summary.phase = attempt ? 'testing-unchanged-retry' : 'testing-submission'; save();
      await page.goto(SITE + 'join.html');
      await page.waitForFunction(() => document.querySelectorAll('#sharedCourseList input').length > 0);
      await page.check('input[name="userType"][value="current_student"]');
      await page.fill('#fullName', 'Fictional Directory Test'); await page.fill('#email', email);
      await page.selectOption('#cohort', '2026–2028'); await page.fill('#primaryCountry', 'Italy');
      await page.selectOption('#previousField', 'health_sciences'); await page.selectOption('#track', 'not_chosen');
      await page.locator('[data-step="1"] [data-next]').click();
      await page.locator('[data-step="2"] [data-next]').click();
      await page.check('input[name="profileVisibility"][value="hidden"]');
      await page.check('input[name="analyticsConsent"][value="no"]'); await page.check('#privacyAcknowledgement');
      await page.waitForTimeout(3100); await page.click('#submitButton');
      await page.locator('#successCard:not([hidden])').waitFor({ timeout: 70000 });
      // The response observer above must independently validate the actual server receipt.
      const deadline = Date.now() + 5000;
      while (receipts.length < attempt + 1 && !receiptError && Date.now() < deadline) {
        await page.waitForTimeout(100);
      }
      assert.strictEqual(receiptError, false);
      assert.strictEqual(receipts.length, attempt + 1);
      assert.match(await page.locator('#successConfirmText').innerText(),
        receipts[attempt].confirmation === 'sent' ? /We've sent a confirmation/ : /waiting for review/);
    }
    assert.strictEqual(summary.attempts, 2);
    summary.phase = 'browser-delivery-passed-owner-checks-required'; save();
    console.log('Matching submission and retry receipts received. Owner must verify one private row and complete email confirmation.');
  } finally {
    save();
    if (browser) await browser.close();
  }
}

main().catch(() => {
  // Never print Playwright errors containing temporary URLs or email confirmation tokens.
  console.error('Directory delivery check did not complete. Inspect its sanitized summary and private test row before retrying.');
  process.exitCode = 1;
});
