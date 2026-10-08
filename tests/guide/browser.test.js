// City guides in Playwright's bundled Chromium: programme routes, topic navigation, deep links,
// sources, search, saved sections, original photos/credits, comparison, mobile layouts and themes.
// Run: node tests/guide/browser.test.js .
// SCREENSHOT_DIR optionally saves the visual checks. The public Markdown library needs internet.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || '.');
const SHOTS = process.env.SCREENSHOT_DIR ? path.resolve(process.env.SCREENSHOT_DIR) : null;
const guides = require(path.join(ROOT, 'guide-data.js'));
const tracksFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/tracks.json'), 'utf8'));
const cohort = tracksFile.cohorts[tracksFile.cohorts.length - 1];
const SAVED_KEY = 'euhem.guide.saved.v1';
const TODAY = '2026-10-08';
const TOPICS = [
  { id: 'overview', sections: ['at-a-glance'] },
  { id: 'arriving', sections: ['before-you-move', 'residence-and-registration'] },
  { id: 'housing', sections: ['housing'] },
  { id: 'transport', sections: ['getting-around'] },
  { id: 'everyday', sections: ['money-and-phone', 'cost-of-living', 'food-and-daily-life', 'weather-and-what-to-pack'] },
  { id: 'study', sections: ['study-places-and-campus', 'sport-social-life-and-student-organisations', 'useful-apps-and-websites', 'student-tips'] },
  { id: 'health', sections: ['healthcare', 'emergency-numbers'] },
  { id: 'sources', sections: ['sources'] },
];
// Original guide prose refers to numbered sections. Its links must keep the same meaning
// after those sections move into topics and the numbered heading prefixes disappear.
const SECTION_REFERENCES = {
  bologna: [
    { from: 'before-you-move', to: 'residence-and-registration', label: 'Residence and registration' },
    { from: 'before-you-move', to: 'getting-around', label: 'Getting around' },
  ],
  oslo: [
    { from: 'before-you-move', to: 'residence-and-registration', label: 'Residence and registration' },
    { from: 'residence-and-registration', to: 'before-you-move', label: 'Before you move' },
    { from: 'cost-of-living', to: 'getting-around', label: 'Getting around' },
  ],
};
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.csv': 'text/csv', '.ics': 'text/calendar' };

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const site = http.createServer((req, res) => {
    const file = decodeURIComponent(req.url.split('?')[0].replace(/^\//, '')) || 'index.html';
    const full = path.resolve(ROOT, file);
    if (!full.startsWith(ROOT + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404); return res.end('missing');
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(full)] || 'text/plain' }); res.end(fs.readFileSync(full));
  }).listen(0);
  const base = `http://127.0.0.1:${site.address().port}/`;
  const browser = await chromium.launch();
  let n = 0;
  const ok = (name) => { n++; console.log('  ok  ' + name); };
  const errors = [];
  const listenForErrors = (page, url) => {
    page.on('pageerror', e => errors.push(`${url}: ${e}`));
    page.on('console', m => {
      if (m.type() === 'error' && !/Failed to load resource|ERR_|corsi\.unibo|announcements/i.test(m.text())) errors.push(`${url}: ${m.text()}`);
    });
  };
  const waitGuide = (page) => page.waitForSelector('#guide[aria-busy="false"]');
  const open = async (url, { viewport = { width: 1440, height: 960 }, track = null, scheme = 'light', blockStorage = false, saved = null } = {}) => {
    const context = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
    if (track) await context.addInitScript((t) => localStorage.setItem('euhem-track-v1', JSON.stringify(t)), track);
    if (saved !== null) await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SAVED_KEY, value: typeof saved === 'string' ? saved : JSON.stringify(saved) });
    if (blockStorage) await context.addInitScript(() => {
      const deny = () => { throw new DOMException('blocked', 'SecurityError'); };
      Object.defineProperty(window, 'localStorage', { get: () => ({ getItem: deny, setItem: deny, removeItem: deny }) });
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00+02:00`));
    listenForErrors(page, url);
    await page.goto(base + url);
    if (url.startsWith('city-guide.html')) await waitGuide(page);
    if (/^city-guide\.html(?:$|#)/.test(url)) await page.waitForSelector('.guide-compare table');
    else if (/^city-guide\.html\?city=/.test(url)) {
      const city = new URL(url, base).searchParams.get('city');
      const guide = guides.CITY_GUIDES.find((item) => item.id === city);
      await page.waitForSelector(guide?.file ? '.cg-topic-tabs' : '.coming-soon-badge');
    }
    return page;
  };
  const text = async (page, selector) => ((await page.textContent(selector)) || '').replace(/\s+/g, ' ').trim();
  const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const section = (page, id) => page.locator('.guide-section').filter({ has: page.locator(`h2[id="${id}"]`) });
  const saveButton = (page, id) => section(page, id).locator('.cg-save-section');
  const shownSections = (page) => page.$$eval('.guide-section', (all) => all.filter((s) => s.getClientRects().length > 0 && !s.hidden).map((s) => s.querySelector('h2').id));
  const assertTopic = async (page, id) => {
    await page.waitForFunction((key) => document.getElementById(`tab-${key}`)?.getAttribute('aria-selected') === 'true', id);
    assert.strictEqual(await page.isVisible(`#panel-${id}`), true, `${id}: selected panel visible`);
    for (const other of TOPICS.filter((topic) => topic.id !== id)) {
      assert.strictEqual(await page.getAttribute(`#tab-${other.id}`, 'aria-selected'), 'false');
      assert.strictEqual(await page.isVisible(`#panel-${other.id}`), false, `${other.id}: inactive panel hidden`);
    }
  };
  const chooseTopic = async (page, id) => {
    await page.click(`#tab-${id}`);
    await assertTopic(page, id);
  };
  const assertFocusAtHash = async (page, id) => {
    await page.waitForFunction((key) => document.activeElement?.id === key, id);
    assert.strictEqual(await page.evaluate(() => location.hash), `#${id}`);
    assert.ok(await page.locator(`[id="${id}"]`).evaluate((node) => {
      const rect = node.getBoundingClientRect(); return rect.top >= -1 && rect.top < innerHeight;
    }), `${id}: linked target is in the viewport`);
  };
  const capture = async (page, filename) => {
    if (!SHOTS) return;
    await page.evaluate(async () => {
      await document.fonts.ready;
      const visible = [...document.querySelectorAll('#guide img')].filter((img) => img.getClientRects().length > 0);
      for (const img of visible) {
        img.scrollIntoView();
        if (!img.complete) await new Promise((resolve) => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); });
      }
      window.scrollTo(0, 0);
      await new Promise(requestAnimationFrame);
    });
    await page.screenshot({ path: path.join(SHOTS, `${filename}.png`), fullPage: true, animations: 'disabled' });
  };
  const assertLinks = async (page, city) => {
    const links = await page.$$eval('#guide a[href]', (all) => all.map((a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel })));
    for (const { href, target, rel } of links) {
      if (/^https?:/.test(href)) {
        assert.strictEqual(target, '_blank', `${city}: external link ${href} opens in a new tab`);
        assert.ok(/\bnoopener\b/.test(rel), `${city}: external link ${href} has noopener`);
        continue;
      }
      if (/^(mailto:|tel:)/.test(href)) continue;
      if (href.startsWith('#')) {
        assert.strictEqual(await page.locator(`[id="${decodeURIComponent(href.slice(1))}"]`).count(), 1, `${city}: missing or duplicate anchor ${href}`);
        continue;
      }
      assert.ok(fs.existsSync(path.join(ROOT, href.split(/[?#]/)[0])), `${city}: dead local link ${href}`);
    }
  };

  // ----- Index: programme routes and the original comparison stay intact -----
  let page = await open('city-guide.html');
  assert.ok(await page.locator('body.city-guide-page').count());
  const cards = await page.$$eval('.guide-city-card', (all) => all.map((card) => ({
    href: card.getAttribute('href'), city: card.querySelector('strong').textContent,
    presence: card.querySelector('.guide-city-presence').textContent, ready: card.querySelector('.city-status').classList.contains('is-ready'),
  })));
  assert.strictEqual(cards.length, guides.CITY_GUIDES.length);
  guides.CITY_GUIDES.forEach((guide, index) => {
    assert.strictEqual(cards[index].city, cohort.universities[guide.university].city);
    assert.strictEqual(cards[index].href, `city-guide.html?city=${guide.id}`);
    assert.strictEqual(cards[index].presence, guides.cityPresenceText(cohort, guide.university));
    assert.strictEqual(cards[index].ready, !!guide.file);
  });
  ok('index: one city card per actual university, with the correct tracks, semesters and guide route');
  assert.match(await text(page, '.guide-compare-intro'), /Approximate, checked \d+ \w+ 20\d\d/);
  assert.deepStrictEqual(await page.$$eval('.compare-group th', (all) => all.map((th) => th.textContent)), guides.GUIDE_COMPARE.map((group) => group.group));
  assert.deepStrictEqual(await page.$$eval('.compare-table th[scope="row"]', (all) => all.map((th) => th.textContent)), guides.GUIDE_COMPARE.flatMap((group) => group.keys.map((key) => guides.GUIDE_FACTS[key])));
  assert.ok((await text(page, '.compare-table td[data-city="oslo"]')).includes('NOK 4,510'));
  assert.ok(await page.locator('.guide-compare a.source-tag[href^="city-guide.html?city=oslo#source-s"]').count());
  await capture(page, 'index-1440-light');
  ok('index: money, paperwork, health and daily life comparison keeps its source-linked facts');
  const comparedCities = () => page.$$eval('.compare-table thead th[data-city]', (all) => all.filter((th) => !th.hidden).map((th) => th.dataset.city));
  assert.deepStrictEqual(await comparedCities(), guides.CITY_GUIDES.map((guide) => guide.id));
  await page.click('.compare-chip[data-city="rotterdam"]');
  assert.ok(!(await comparedCities()).includes('rotterdam'));
  assert.strictEqual(await page.getAttribute('.compare-chip[data-city="rotterdam"]', 'aria-pressed'), 'false');
  for (const id of ['bologna', 'oslo', 'innsbruck']) await page.click(`.compare-chip[data-city="${id}"]`);
  assert.deepStrictEqual(await comparedCities(), ['innsbruck'], 'the last city cannot be removed');
  assert.strictEqual(await page.locator('.compare-mine').count(), 0);
  assert.strictEqual(await page.locator('.guide-my-track').count(), 0);
  assert.ok(await page.locator('a[href="contact.html"]').filter({ hasText: 'Report something outdated' }).count());
  await page.context().close();
  ok('index: city buttons toggle columns, keep at least one city and omit personal-track controls without a saved track');

  // Capture the redesigned city views early, so a later regression still leaves reviewable images.
  page = await open('city-guide.html', { viewport: { width: 390, height: 844 } });
  assert.ok(await sideways(page) <= 0, 'index fits a 390px phone');
  await capture(page, 'index-390-light');
  await page.context().close();
  for (const guide of guides.CITY_GUIDES.filter((item) => item.file)) {
    page = await open(`city-guide.html?city=${guide.id}`);
    await assertTopic(page, 'overview');
    assert.match(await text(page, '.cg-hero h1'), new RegExp(cohort.universities[guide.university].city));
    assert.ok(await page.isVisible('.cg-facts-strip'));
    assert.ok(await page.isVisible('.cg-image-label'));
    if (/\/ai-/.test(guide.cover.image)) assert.match(await text(page, '.cg-image-label'), /AI/i);
    await capture(page, `${guide.id}-overview-1440-light`);
    await page.context().close();
  }
  for (const scheme of ['light', 'dark']) {
    page = await open('city-guide.html?city=bologna#housing', { viewport: { width: 390, height: 844 }, scheme });
    await assertTopic(page, 'housing');
    assert.strictEqual(await page.isVisible('#housing-body'), true);
    await capture(page, `bologna-housing-390-${scheme}`);
    await page.context().close();
  }
  page = await open('city-guide.html?city=oslo', { scheme: 'dark' });
  const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.ok((darkBackground.match(/\d+/g) || []).slice(0, 3).every((component) => Number(component) < 100), `dark theme uses a dark page background: ${darkBackground}`);
  await capture(page, 'oslo-overview-1440-dark');
  await page.context().close();
  page = await open('city-guide.html?city=oslo#getting-around', { viewport: { width: 390, height: 844 } });
  await assertTopic(page, 'transport');
  await capture(page, 'oslo-transport-390-light');
  await page.context().close();
  ok('all four city overviews, comparison, mobile housing/transport and dark views render for visual review');

  page = await open('city-guide.html', { track: { cohort: cohort.id, track: 'mhi' } });
  await page.waitForSelector('.guide-my-track');
  const mhi = guides.trackCityTimeline(cohort, cohort.tracks.find((track) => track.id === 'mhi'), TODAY);
  const next = mhi.find((stop) => stop.next);
  assert.strictEqual(await text(page, '.guide-my-track-next'), `Your next city: ${next.city}, Semester ${next.number} (${next.label}) →`);
  assert.strictEqual(await page.getAttribute('.guide-my-track-next a', 'href'), cohort.universities[next.university].guide);
  const mhiCities = mhi.map((stop) => guides.CITY_GUIDES.find((guide) => guide.university === stop.university).id);
  await page.click('.compare-chip[data-city="bologna"]');
  await page.click('.compare-mine');
  assert.deepStrictEqual(await comparedCities(), mhiCities);
  assert.deepStrictEqual(await page.$$eval('.compare-table thead th.is-mine', (all) => all.map((th) => th.dataset.city)), mhiCities);
  await page.context().close();
  ok(`saved MHI track: next-city banner and My cities comparison use ${mhiCities.join(' and ')} from tracks.json`);

  // ----- Every guide retains all original sections, sources, photos and programme facts -----
  for (const guide of guides.CITY_GUIDES.filter((item) => item.file)) {
    const city = cohort.universities[guide.university].city;
    const source = fs.readFileSync(path.join(ROOT, guide.file), 'utf8');
    const parsed = guides.parseGuide(source);
    page = await open(`city-guide.html?city=${guide.id}`, { viewport: { width: 390, height: 844 } });
    const headings = await page.$$eval('.guide-section h2', (all) => all.map((heading) => ({ id: heading.id, text: heading.textContent.trim() })));
    assert.deepStrictEqual(headings.map((heading) => heading.text).sort(), [...guides.GUIDE_SECTIONS].sort());
    assert.deepStrictEqual(headings.map((heading) => heading.id).sort(), guides.GUIDE_SECTIONS.map(guides.guideHeadingId).sort());
    const ids = await page.$$eval('[id]', (all) => all.map((node) => node.id));
    assert.strictEqual(ids.length, new Set(ids).size, `${city}: unique element ids`);
    assert.strictEqual(await page.getAttribute('.cg-topic-tabs', 'role'), 'tablist');
    assert.deepStrictEqual(await page.$$eval('.cg-topic-tab', (all) => all.map((tab) => tab.id)), TOPICS.map((topic) => `tab-${topic.id}`));
    const switcher = await page.$$eval('.cg-city-links a', (all) => all.map((link) => ({ href: link.getAttribute('href'), current: link.getAttribute('aria-current') })));
    assert.deepStrictEqual(switcher.map((link) => link.href).sort(), guides.CITY_GUIDES.map((item) => `city-guide.html?city=${item.id}`).sort());
    assert.deepStrictEqual(switcher.filter((link) => link.current === 'page').map((link) => link.href), [`city-guide.html?city=${guide.id}`]);
    const notice = await text(page, '.guide-notice');
    assert.ok(notice.includes('This is a student-made summary, not legal advice. Rules change. The official pages linked here are authoritative.'));
    assert.ok(notice.includes('Follow those first.'));
    const checked = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }).format(new Date(`${parsed.facts['last-checked']}T12:00:00Z`));
    assert.ok(notice.includes(`Last checked: ${checked}.`), `${city}: original verification date retained`);
    assert.ok(await page.locator('.guide-notice a[href="contact.html"]').count());
    const glance = await text(page, '#at-a-glance-body .guide-glance');
    assert.ok(glance.includes(guides.cityPresenceText(cohort, guide.university)) && glance.includes(cohort.universities[guide.university].name));
    assert.strictEqual(await page.getAttribute('#at-a-glance-body .guide-glance a[href^="university.html"]', 'href'), `university.html?id=${guide.university}&cohort=${cohort.id}`);
    const photos = await page.$$eval('.guide-photos figure', (all) => all.map((figure) => ({
      src: figure.querySelector('img').getAttribute('src'), alt: figure.querySelector('img').alt,
      ai: figure.classList.contains('is-ai'), caption: figure.querySelector('figcaption')?.textContent || '',
      links: [...figure.querySelectorAll('figcaption a')].map((link) => link.href),
    })));
    assert.strictEqual(photos.length, (source.match(/<figure\b/g) || []).length, `${city}: all original gallery images retained`);
    assert.ok(photos.some((photo) => !photo.ai), `${city}: real photographs remain in the gallery`);
    for (const photo of photos) {
      if (photo.ai) {
        assert.match(photo.alt, /^AI-generated illustration/);
        assert.match(photo.caption, /AI-generated illustration, not a photo; the other pictures here are real photos\./);
      } else {
        assert.ok(photo.alt && /Photo: .+, \d{4}/.test(photo.caption), `${city}: ${photo.src} needs its photograph credit`);
        assert.ok(photo.links.some((link) => link.startsWith('https://creativecommons.org/')));
        assert.ok(photo.links.some((link) => link.startsWith('https://commons.wikimedia.org/')));
      }
      await page.locator(`.guide-photos img[src="${photo.src}"]`).scrollIntoViewIfNeeded();
      await page.waitForFunction((src) => [...document.querySelectorAll('.guide-photos img')].some((img) => img.getAttribute('src') === src && img.complete && img.naturalWidth > 0), photo.src);
    }
    for (const topic of TOPICS) {
      assert.strictEqual(await page.getAttribute(`#tab-${topic.id}`, 'role'), 'tab');
      assert.strictEqual(await page.getAttribute(`#tab-${topic.id}`, 'aria-controls'), `panel-${topic.id}`);
      assert.strictEqual(await page.getAttribute(`#panel-${topic.id}`, 'role'), 'tabpanel');
      assert.strictEqual(await page.getAttribute(`#panel-${topic.id}`, 'aria-labelledby'), `tab-${topic.id}`);
      assert.deepStrictEqual(await page.$$eval(`#panel-${topic.id} .guide-section h2`, (all) => all.map((heading) => heading.id)), topic.sections, `${city}: correct sections in ${topic.id}`);
      await chooseTopic(page, topic.id);
      assert.deepStrictEqual(await shownSections(page), topic.sections, `${city}: the complete active topic is visible`);
      for (const id of topic.sections) assert.strictEqual(await page.isVisible(`#${id}-body`), true, `${city}: ${id} content visible`);
      assert.ok(await sideways(page) <= 0, `${city}: ${topic.id} fits a 390px phone`);
    }
    const expectedReferences = SECTION_REFERENCES[guide.id] || [];
    assert.strictEqual((source.match(/\bsection\s+\d+\b/gi) || []).length, expectedReferences.length, `${city}: every original numbered cross-reference is covered`);
    const references = await page.$$eval('.guide-section-body a.cg-section-reference', (all) => all.map((link) => ({
      from: link.closest('.guide-section').querySelector('h2').id,
      to: link.getAttribute('href').slice(1), label: link.textContent.trim(),
    })));
    assert.deepStrictEqual(references, expectedReferences, `${city}: original numbered references become correctly named section links`);
    assert.doesNotMatch(await text(page, '.cg-topic-panels'), /\bsection\s+\d+\b/i, `${city}: no obsolete numbered directions remain in the rendered guide`);
    for (const reference of expectedReferences) {
      const fromTopic = TOPICS.find((topic) => topic.sections.includes(reference.from)).id;
      const toTopic = TOPICS.find((topic) => topic.sections.includes(reference.to)).id;
      await chooseTopic(page, fromTopic);
      await page.locator(`#${reference.from}-body a.cg-section-reference[href="#${reference.to}"]`).click();
      await assertTopic(page, toTopic);
      assert.strictEqual(await page.isVisible(`#${reference.to}-body`), true);
      await assertFocusAtHash(page, reference.to);
    }
    await assertLinks(page, city);
    await page.context().close();
    ok(`${city}: 16 sections in eight working topics, original dates/programme routes/sources, ${photos.length} credited images and no 390px overflow` +
      (expectedReferences.length ? `; ${expectedReferences.length} original section references navigate correctly` : ''));
  }

  // ----- Empty tips remain hidden, including from topic search -----
  const emptied = await browser.newContext({ serviceWorkers: 'block' });
  await emptied.route(/oslo-guide\.md/, async (route) => {
    const source = fs.readFileSync(path.join(ROOT, 'docs/content/oslo-guide.md'), 'utf8').replace(/\r\n/g, '\n');
    await route.fulfill({ contentType: 'text/markdown', body: source.replace(/(## 15\. Student tips\n)[\s\S]*?(\n## 16\.)/, '$1$2') });
  });
  const emptyPage = await emptied.newPage();
  listenForErrors(emptyPage, 'Oslo with empty tips');
  await emptyPage.goto(base + 'city-guide.html?city=oslo');
  await waitGuide(emptyPage);
  await chooseTopic(emptyPage, 'study');
  assert.strictEqual(await emptyPage.isVisible('#student-tips'), false);
  await emptyPage.fill('#guide-search', 'Student tips');
  assert.strictEqual(await emptyPage.locator('.cg-search-result[href="#student-tips"]').count(), 0);
  await emptied.close();
  ok('an empty Student tips section stays hidden and is not offered as a search result');

  // ----- Accessible tabs, deep links and browser history -----
  page = await open('city-guide.html?city=oslo');
  await page.focus('#tab-overview');
  await page.keyboard.press('ArrowRight');
  await assertTopic(page, 'arriving');
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'tab-arriving');
  await page.keyboard.press('End');
  await assertTopic(page, 'sources');
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'tab-sources');
  await page.keyboard.press('ArrowRight');
  await assertTopic(page, 'overview');
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'tab-overview');
  await page.keyboard.press('ArrowLeft');
  await assertTopic(page, 'sources');
  await page.keyboard.press('Home');
  await assertTopic(page, 'overview');
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'tab-overview');
  assert.deepStrictEqual(await page.$$eval('.cg-topic-tab', (all) => all.map((tab) => tab.tabIndex)), [0, -1, -1, -1, -1, -1, -1, -1]);
  await page.check('#guide-read-all');
  assert.deepStrictEqual((await shownSections(page)).sort(), guides.GUIDE_SECTIONS.map(guides.guideHeadingId).sort());
  for (const topic of TOPICS) assert.strictEqual(await page.isVisible(`#panel-${topic.id}`), true);
  await chooseTopic(page, 'housing');
  assert.strictEqual(await page.isChecked('#guide-read-all'), false);
  assert.deepStrictEqual(await shownSections(page), ['housing']);
  await page.emulateMedia({ media: 'print' });
  assert.deepStrictEqual((await shownSections(page)).sort(), guides.GUIDE_SECTIONS.map(guides.guideHeadingId).sort());
  assert.strictEqual(await page.isVisible('.cg-topic-tabs'), false, 'print hides the interactive navigation');
  await page.emulateMedia({ media: 'screen' });
  assert.deepStrictEqual(await shownSections(page), ['housing']);
  await page.context().close();
  ok('tabs: arrow keys and Home/End retain focus; Read all and print reveal every section, then restore the selected topic');

  for (const [id, topic] of [['housing', 'housing'], ['getting-around', 'transport'], ['source-s12', 'sources']]) {
    page = await open(`city-guide.html?city=oslo#${id}`);
    await assertTopic(page, topic);
    await assertFocusAtHash(page, id);
    await page.context().close();
  }
  ok('direct housing, transport and individual-source links select their topic, scroll and focus the original target');
  page = await open('city-guide.html?city=oslo#housing');
  await chooseTopic(page, 'transport');
  assert.strictEqual(await page.evaluate(() => location.hash), '#getting-around');
  await page.goBack();
  await assertTopic(page, 'housing');
  await assertFocusAtHash(page, 'housing');
  await page.goForward();
  await assertTopic(page, 'transport');
  await assertFocusAtHash(page, 'getting-around');
  await page.locator('#getting-around-body a.source-tag').first().click();
  await assertTopic(page, 'sources');
  const sourceTarget = await page.evaluate(() => location.hash.slice(1));
  assert.match(sourceTarget, /^source-s\d+$/);
  await assertFocusAtHash(page, sourceTarget);
  await page.goBack();
  await assertTopic(page, 'transport');
  await page.context().close();
  ok('browser Back/Forward restores topics; inline citations reveal the correct source and return to the guide');

  page = await open('city-guide.html?city=oslo');
  assert.strictEqual(await page.evaluate(() => location.hash), '');
  await page.locator('.cg-emergency-card a.source-tag').first().click();
  await assertTopic(page, 'sources');
  const sourceFromOverview = await page.evaluate(() => location.hash.slice(1));
  await assertFocusAtHash(page, sourceFromOverview);
  await page.goBack();
  await assertTopic(page, 'overview');
  assert.strictEqual(await page.evaluate(() => location.hash), '');
  await page.waitForFunction(() => document.activeElement?.id === 'tab-overview');
  assert.strictEqual(await page.isVisible('#tab-overview'), true);
  assert.strictEqual(await page.isVisible('#sources-body'), false);
  await page.context().close();
  ok('Back to the initial empty hash restores Overview and moves focus out of the hidden Sources panel');

  // ----- Search finds content outside the currently selected topic -----
  page = await open('city-guide.html?city=oslo');
  assert.strictEqual(await page.isVisible('#getting-around-body'), false);
  await page.fill('#guide-search', 'Flytoget');
  await page.waitForSelector('.cg-search-results > .cg-search-result[href="#getting-around"]');
  await page.locator('.cg-search-results > .cg-search-result[href="#getting-around"]').click();
  await assertTopic(page, 'transport');
  assert.strictEqual(await page.inputValue('#guide-search'), '');
  assert.strictEqual(await page.isVisible('#getting-around-body'), true);
  await assertFocusAtHash(page, 'getting-around');
  await page.fill('#guide-search', 'zzzz-unmatched-guide-search');
  assert.strictEqual(await page.locator('.cg-search-result').count(), 0);
  assert.match(await text(page, '#guide'), /No .*?(?:match|result|found)/i);
  await page.fill('#guide-search', '');
  await assertTopic(page, 'transport');
  await page.context().close();
  ok('guide search finds hidden-topic text, opens the correct section, clears the query and explains empty results');

  // ----- Saving is local, per city, and works for the visit if storage is blocked -----
  page = await open('city-guide.html?city=oslo#housing');
  await saveButton(page, 'housing').click();
  assert.strictEqual(await saveButton(page, 'housing').getAttribute('aria-pressed'), 'true');
  assert.deepStrictEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVED_KEY), { version: 1, items: [{ city: 'oslo', section: 'housing' }] });
  await chooseTopic(page, 'transport');
  await saveButton(page, 'getting-around').click();
  await page.reload();
  await waitGuide(page);
  assert.strictEqual(await saveButton(page, 'getting-around').getAttribute('aria-pressed'), 'true');
  await page.check('#guide-saved-only');
  const savedResults = () => page.$$eval('.cg-search-results > .cg-search-result', (all) => all.map((link) => link.getAttribute('href')));
  assert.deepStrictEqual(await savedResults(), ['#housing', '#getting-around'], 'Saved brings together the current city’s saved sections across topics');
  assert.deepStrictEqual(await shownSections(page), [], 'saved results are a separate view from the full sections');
  await page.fill('#guide-search', 'Housing');
  assert.deepStrictEqual(await savedResults(), ['#housing'], 'search can narrow the saved sections');
  await page.locator('.cg-search-result[href="#housing"]').click();
  await assertTopic(page, 'housing');
  assert.strictEqual(await page.isChecked('#guide-saved-only'), false);
  assert.strictEqual(await page.inputValue('#guide-search'), '');
  assert.strictEqual(await page.isVisible('#housing-body'), true);
  await saveButton(page, 'housing').click();
  await page.check('#guide-saved-only');
  assert.deepStrictEqual(await savedResults(), ['#getting-around'], 'unsaved sections leave the saved results');
  await page.uncheck('#guide-saved-only');
  await page.locator('.cg-city-switcher a[href="city-guide.html?city=bologna"]').click();
  await waitGuide(page);
  await chooseTopic(page, 'housing');
  assert.strictEqual(await saveButton(page, 'housing').getAttribute('aria-pressed'), 'false', 'an Oslo bookmark does not mark Bologna housing');
  await saveButton(page, 'housing').click();
  const crossCitySaved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVED_KEY);
  assert.deepStrictEqual(crossCitySaved.items.map((item) => `${item.city}:${item.section}`).sort(), ['bologna:housing', 'oslo:getting-around']);
  await page.check('#guide-saved-only');
  assert.deepStrictEqual(await savedResults(), ['#housing'], 'Bologna’s saved results exclude the Oslo bookmark');
  await page.locator('.cg-saved-links a[href="city-guide.html?city=oslo#getting-around"]').click();
  await waitGuide(page);
  await assertTopic(page, 'transport');
  assert.strictEqual(await saveButton(page, 'getting-around').getAttribute('aria-pressed'), 'true');
  await page.context().close();
  ok('saved sections survive reload, combine with search, open and clear filters, remain city-specific and link across cities from the sidebar');

  page = await open('city-guide.html?city=oslo#housing', { saved: '{broken json' });
  assert.strictEqual(await saveButton(page, 'housing').getAttribute('aria-pressed'), 'false');
  await page.check('#guide-saved-only');
  assert.deepStrictEqual(await shownSections(page), []);
  assert.strictEqual(await page.locator('.cg-search-result').count(), 0);
  assert.match(await text(page, '.cg-empty-state'), /No saved sections yet/);
  await page.context().close();
  page = await open('city-guide.html?city=oslo#housing', { saved: { version: 1, items: [
    { city: 'oslo', section: 'housing' }, { city: 'oslo', section: 'housing' },
    { city: 'unknown-city', section: 'housing' }, { city: 'oslo', section: 'made-up-section' }, null,
  ] } });
  assert.strictEqual(await saveButton(page, 'housing').getAttribute('aria-pressed'), 'true');
  await chooseTopic(page, 'transport');
  await saveButton(page, 'getting-around').click();
  const cleaned = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVED_KEY);
  assert.deepStrictEqual(cleaned, { version: 1, items: [{ city: 'oslo', section: 'housing' }, { city: 'oslo', section: 'getting-around' }] });
  await page.context().close();
  ok('malformed saved data is ignored; unknown cities/sections and duplicates are discarded before a new save');
  page = await open('city-guide.html?city=oslo#housing', { blockStorage: true });
  await saveButton(page, 'housing').click();
  assert.strictEqual(await saveButton(page, 'housing').getAttribute('aria-pressed'), 'true');
  await page.check('#guide-saved-only');
  assert.deepStrictEqual(await page.$$eval('.cg-search-result', (all) => all.map((link) => link.getAttribute('href'))), ['#housing']);
  assert.match(await text(page, '.cg-storage-note'), /this visit only/i);
  await page.locator('.cg-search-result[href="#housing"]').click();
  await assertTopic(page, 'housing');
  assert.strictEqual(await saveButton(page, 'housing').getAttribute('aria-pressed'), 'true');
  await page.context().close();
  ok('blocked storage: saving and saved-only still work for this visit and the page states the limitation');

  const planned = guides.CITY_GUIDES.find((guide) => !guide.file);
  if (planned) {
    page = await open(`city-guide.html?city=${planned.id}`);
    assert.ok((await text(page, '#guide')).includes(guides.cityPresenceText(cohort, planned.university)));
    await page.context().close();
    ok('a city without a completed guide remains clearly marked Coming soon with its programme route');
  }

  // ----- Breakpoints and labelled mobile tables -----
  for (const width of [320, 390, 768, 1440]) {
    for (const url of ['city-guide.html', 'city-guide.html?city=oslo']) {
      page = await open(url, { viewport: { width, height: 844 } });
      assert.ok(await sideways(page) <= 0, `${url} at ${width}px scrolls sideways`);
      if (url.includes('oslo')) {
        for (const topic of ['housing', 'transport', 'study', 'sources']) {
          await chooseTopic(page, topic);
          assert.ok(await sideways(page) <= 0, `${topic} at ${width}px scrolls sideways`);
        }
        if (width === 390) {
          await chooseTopic(page, 'housing');
          assert.strictEqual(await page.$eval('#housing-body table thead', (head) => getComputedStyle(head).position), 'absolute');
          assert.strictEqual(await page.getAttribute('#housing-body td', 'data-label'), 'Type');
        }
      }
      await page.context().close();
    }
  }
  ok('index and city topics fit 320, 390, 768 and 1440px; housing tables become labelled cards on phones');

  // ----- Homepage cards and site-wide search keep their existing city deep links -----
  page = await open('index.html');
  await page.waitForFunction(() => document.querySelector('#city-cards .city-card span:not(.city-country):not(.city-status)'));
  const homeCards = await page.$$eval('#city-cards .city-card', (all) => all.map((card) => card.textContent.replace(/\s+/g, ' ').trim()));
  guides.CITY_GUIDES.forEach((guide, index) => assert.ok(homeCards[index].includes(guides.cityPresenceText(cohort, guide.university)), homeCards[index]));
  assert.ok(!homeCards.join(' ').includes('track</span>') && !/For the \w+ track/.test(homeCards.join(' ')));
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.search-dialog .search-input');
  await page.fill('.search-dialog .search-input', 'Flytoget');
  await page.waitForSelector('a[href="city-guide.html?city=oslo#getting-around"]', { timeout: 15000 });
  await page.goto(base + 'city-guide.html?city=oslo#getting-around');
  await waitGuide(page);
  await assertTopic(page, 'transport');
  assert.strictEqual(await page.isVisible('#getting-around-body'), true);
  await page.context().close();
  ok('homepage cards retain actual study routes; site search finds Flytoget and opens Oslo’s Transport topic');

  assert.deepStrictEqual(errors, []);
  ok('no JavaScript errors');
  console.log(`${n} City Guide browser checks passed`);
  await browser.close(); site.close();
})().catch((error) => { console.error(error); process.exit(1); });
