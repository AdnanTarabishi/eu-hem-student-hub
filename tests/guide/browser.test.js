// City Guide in a real browser (Chrome): the index, the "My track" banner, a full city guide,
// folding sections, source links, tables as cards on phones, no sideways scrolling, light and dark,
// the homepage city cards and the site search. Run: node tests/guide/browser.test.js .
// Needs the internet once for the Markdown library (cdnjs), like the real page.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || '.');
const guides = require(path.join(ROOT, 'guide-data.js'));
const tracksFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/tracks.json'), 'utf8'));
const cohort = tracksFile.cohorts[tracksFile.cohorts.length - 1];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.csv': 'text/csv', '.ics': 'text/calendar' };

(async () => {
  const site = http.createServer((req, res) => {
    const file = decodeURIComponent(req.url.split('?')[0].replace(/^\//, '')) || 'index.html';
    const full = path.join(ROOT, file);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(full)] || 'text/plain' }); res.end(fs.readFileSync(full));
  }).listen(0);
  const base = `http://127.0.0.1:${site.address().port}/`;

  const browser = await chromium.launch({ channel: 'chrome' });
  let n = 0; const ok = (name) => { n++; console.log('  ok  ' + name); };
  const errors = [];
  const open = async (url, { viewport = { width: 1280, height: 900 }, track = null, scheme = 'light' } = {}) => {
    const context = await browser.newContext({ viewport, colorScheme: scheme });
    if (track) await context.addInitScript((t) => localStorage.setItem('euhem-track-v1', JSON.stringify(t)), track);
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-10-05T10:00:00'));
    page.on('pageerror', e => errors.push(`${url}: ${e}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|corsi\.unibo|announcements/i.test(m.text())) errors.push(`${url}: ${m.text()}`); });
    await page.goto(base + url);
    return page;
  };
  const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  // ----- Index -----
  let page = await open('city-guide.html');
  await page.waitForSelector('.guide-city-card');
  const cards = await page.$$eval('.guide-city-card', (all) => all.map((c) => ({
    href: c.getAttribute('href'), city: c.querySelector('strong').textContent,
    presence: c.querySelector('.guide-city-presence').textContent, status: c.querySelector('.city-status').textContent })));
  assert.strictEqual(cards.length, guides.CITY_GUIDES.length);
  guides.CITY_GUIDES.forEach((g, i) => {
    assert.strictEqual(cards[i].city, cohort.universities[g.university].city);
    assert.strictEqual(cards[i].presence, guides.cityPresenceText(cohort, g.university));
    assert.strictEqual(cards[i].status, g.file ? 'Read the guide →' : 'Coming soon');
  });
  ok('index: one card per city, tracks and semesters taken from tracks.json');
  await page.waitForSelector('.guide-compare table');
  assert.match(await page.textContent('.guide-compare caption'), /^Approximate, checked \d+ \w+ 20\d\d/);
  const osloRow = await page.$$eval('.guide-compare tbody tr', (rows) => rows.map((r) => r.textContent));
  assert.ok(osloRow.some((r) => r.includes('Oslo') && r.includes('NOK 393')));
  assert.ok(await page.$('.guide-compare a.source-tag[href^="city-guide.html?city=oslo#source-s"]'));
  ok('index: comparison table built from the guides\' facts, labelled "Approximate, checked …", with source links');
  assert.strictEqual(await page.$('.guide-my-track'), null);
  assert.ok(await page.$('a[href="contact.html"]:text("Report something outdated")'));
  ok('index: no "My track" banner without a saved track; "Report something outdated" link present');
  await page.context().close();

  page = await open('city-guide.html', { track: { cohort: cohort.id, track: 'mhi' } });
  await page.waitForSelector('.guide-my-track');
  const mhi = guides.trackCityTimeline(cohort, cohort.tracks.find((t) => t.id === 'mhi'), '2026-10-05');
  const next = mhi.find((s) => s.next);
  assert.strictEqual(await page.textContent('.guide-my-track-next'), `Your next city: ${next.city}, Semester ${next.number} (${next.label}) →`);
  assert.strictEqual(await page.getAttribute('.guide-my-track-next a', 'href'), cohort.universities[next.university].guide);
  ok(`"My track" banner: saved MHI on 5 Oct 2026 -> "${next.city}, Semester ${next.number} (${next.label})"`);
  await page.context().close();

  // ----- Oslo guide -----
  page = await open('city-guide.html?city=oslo');
  await page.waitForSelector('.guide-section');
  const headings = await page.$$eval('.guide-section h2', (all) => all.map((h) => h.textContent.trim()));
  assert.deepStrictEqual(headings, guides.GUIDE_SECTIONS.map((t, i) => `${i + 1}. ${t}`));
  assert.strictEqual(await page.isHidden('#student-tips'), true);
  assert.strictEqual(await page.$('.guide-jump a[href="#student-tips"]'), null);
  ok('Oslo: all 16 sections in order; empty "Student tips" hidden and left out of the contents');
  const notice = await page.textContent('.guide-notice');
  assert.ok(notice.includes('This is a student-made summary, not legal advice. Rules change. The official pages linked here are authoritative.'));
  assert.ok(notice.includes('Follow those first.') && notice.includes('Last checked: 5 October 2026.'));
  assert.ok(await page.$('.guide-notice a[href="contact.html"]'));
  ok('Oslo: disclaimer, "follow EU-HEM first", last-checked date and report link at the top');
  const glance = await page.textContent('#at-a-glance-body .guide-glance');
  assert.ok(glance.includes(guides.cityPresenceText(cohort, 'uio')) && glance.includes('University of Oslo'));
  ok('Oslo: "At a glance" shows who studies there, from tracks.json');
  assert.strictEqual(await page.isVisible('#before-you-move-body'), true);
  assert.strictEqual(await page.getAttribute('#housing button.guide-fold', 'aria-expanded'), 'false');
  assert.strictEqual(await page.isVisible('#housing-body'), false);
  await page.click('#housing button.guide-fold');
  assert.strictEqual(await page.isVisible('#housing-body'), true);
  await page.keyboard.press('Enter'); // the focused heading button closes it again
  assert.strictEqual(await page.isVisible('#housing-body'), false);
  ok('Oslo: sections 1-2 open; others fold and open with a click or the keyboard');
  await page.click('.guide-jump summary');
  await page.click('.guide-jump a[href="#getting-around"]');
  await page.waitForFunction(() => !document.getElementById('getting-around-body').hidden);
  assert.ok(await page.evaluate(() => { const r = document.getElementById('getting-around').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }));
  ok('Oslo: a contents link opens its section and scrolls to it');
  await page.click('#getting-around-body a.source-tag >> nth=0');
  await page.waitForFunction(() => !document.getElementById('sources-body').hidden);
  const target = await page.evaluate(() => location.hash);
  assert.match(target, /^#source-s\d+$/);
  assert.ok(await page.$(target));
  ok(`Oslo: a source tag opens "Sources" at that source (${target})`);
  const external = await page.$$eval('#guide a[href^="http"]', (all) => all.filter((a) => a.target !== '_blank').length);
  assert.strictEqual(external, 0);
  ok('Oslo: external links open in a new tab');
  const localLinks = await page.$$eval('#guide a[href]', (all) => [...new Set(all.map((a) => a.getAttribute('href')))]);
  for (const href of localLinks) {
    if (/^(https?:|mailto:)/.test(href)) continue;
    if (href.startsWith('#')) { assert.ok(await page.$(href), `missing anchor ${href}`); continue; }
    const file = href.split(/[?#]/)[0];
    assert.ok(fs.existsSync(path.join(ROOT, file)), `dead link ${href}`);
  }
  ok('Oslo: no dead local links or anchors');
  await page.context().close();

  // ----- Phone widths, dark mode -----
  for (const width of [375, 768, 1024, 1440]) {
    for (const url of ['city-guide.html', 'city-guide.html?city=oslo']) {
      page = await open(url, { viewport: { width, height: 800 } });
      await page.waitForSelector(url.includes('oslo') ? '.guide-section' : '.guide-compare');
      await page.evaluate(() => document.querySelectorAll('.guide-section').forEach((s) => s.querySelector('.guide-fold')?.click()));
      assert.ok(await sideways(page) <= 0, `${url} at ${width}px scrolls sideways`);
      if (width === 375 && url.includes('oslo')) {
        assert.strictEqual(await page.$eval('#housing-body table thead', (t) => getComputedStyle(t).position), 'absolute');
        assert.strictEqual(await page.$eval('#housing-body td', (td) => td.getAttribute('data-label')), 'Type');
      }
      await page.context().close();
    }
  }
  ok('no sideways scrolling at 375, 768, 1024 and 1440px; tables become labelled cards at 375px');
  page = await open('city-guide.html?city=oslo', { scheme: 'dark' });
  await page.waitForSelector('.guide-section');
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notStrictEqual(dark, 'rgb(255, 255, 255)');
  await page.context().close();
  ok('dark mode: the guide renders on the dark background');

  // ----- Every guide: 16 sections, photos load and carry their credit -----
  for (const guide of guides.CITY_GUIDES.filter((g) => g.file)) {
    const city = cohort.universities[guide.university].city;
    page = await open(`city-guide.html?city=${guide.id}`, { viewport: { width: 375, height: 800 } });
    await page.waitForSelector('.guide-section');
    const photos = await page.$$eval('.guide-photos figure', (all) => all.map((f) => ({
      src: f.querySelector('img').getAttribute('src'), alt: f.querySelector('img').alt, caption: f.querySelector('figcaption')?.textContent || '' })));
    for (const photo of photos) {
      assert.ok(photo.alt && /Photo: |AI-generated illustration, not a photo/.test(photo.caption), `${city}: ${photo.src} needs alt text and a credit or AI label`);
      await page.$eval(`img[src="${photo.src}"]`, (img) => img.scrollIntoView());
      await page.waitForFunction((src) => { const img = document.querySelector(`img[src="${src}"]`); return img.complete && img.naturalWidth > 0; }, photo.src);
    }
    const titles = await page.$$eval('.guide-section h2', (all) => all.map((h) => h.textContent.trim()));
    assert.deepStrictEqual(titles, guides.GUIDE_SECTIONS.map((t, i) => `${i + 1}. ${t}`));
    assert.ok((await page.textContent('#at-a-glance-body .guide-glance')).includes(guides.cityPresenceText(cohort, guide.university)));
    await page.evaluate(() => document.querySelectorAll('.guide-fold').forEach((b) => b.click()));
    assert.ok(await sideways(page) <= 0, `${city} scrolls sideways at 375px`);
    for (const href of await page.$$eval('#guide a[href^="#"]', (all) => [...new Set(all.map((a) => a.getAttribute('href')))])) {
      assert.ok(await page.$(href), `${city}: missing anchor ${href}`);
    }
    await page.context().close();
    ok(`${city}: 16 sections, tracks from tracks.json, working anchors, no sideways scrolling at 375px` +
      (photos.length ? `, ${photos.length} photos load with credits` : ''));
  }

  const planned = guides.CITY_GUIDES.find((g) => !g.file);
  if (planned) {
    page = await open(`city-guide.html?city=${planned.id}`);
    await page.waitForSelector('.coming-soon-badge');
    assert.ok((await page.textContent('#guide')).includes(guides.cityPresenceText(cohort, planned.university)));
    await page.context().close();
    ok(`${cohort.universities[planned.university].city}: "Coming soon" page, with who studies there`);
  }

  // ----- Homepage cards and search -----
  page = await open('index.html');
  await page.waitForFunction(() => document.querySelector('#city-cards .city-card span:not(.city-country):not(.city-status)'));
  const homeCards = await page.$$eval('#city-cards .city-card', (all) => all.map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
  guides.CITY_GUIDES.forEach((g, i) => assert.ok(homeCards[i].includes(guides.cityPresenceText(cohort, g.university)), homeCards[i]));
  assert.ok(!homeCards.join(' ').includes('track</span>') && !/For the \w+ track/.test(homeCards.join(' ')));
  ok('homepage: city cards filled from the same data (no "For the Oslo track")');
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.search-dialog .search-input');
  await page.fill('.search-dialog .search-input', 'Flytoget');
  await page.waitForFunction(() => [...document.querySelectorAll('a[href*="city-guide.html?city=oslo#"]')].length > 0, null, { timeout: 15000 });
  const hit = await page.$$eval('a[href*="city-guide.html?city=oslo#"]', (all) => all.map((a) => a.getAttribute('href')));
  assert.ok(hit.includes('city-guide.html?city=oslo#getting-around'), hit.join(', '));
  ok('search: "Flytoget" finds Oslo → Getting around');
  await page.goto(base + hit[0]);
  await page.waitForFunction(() => document.getElementById('getting-around-body') && !document.getElementById('getting-around-body').hidden);
  await page.context().close();
  ok('search result opens the Oslo guide with that section unfolded');

  assert.deepStrictEqual(errors, []);
  ok('no JavaScript errors');
  console.log(`${n} City Guide browser checks passed`);
  await browser.close(); site.close();
})().catch((e) => { console.error(e); process.exit(1); });
