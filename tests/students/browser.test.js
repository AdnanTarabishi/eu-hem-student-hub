// Students explorer (students.html) in a real browser (installed Chrome): previews, map, filters, chips,
// sorting, cards/list, pagination, profile drawer, deep links, Back/Forward, discovery, saved profiles,
// map failure, phones, dark mode. Run: node tests/students/browser.test.js .
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || '.');
const D = require(path.join(ROOT, 'students-data.js'));
const { records } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/demo-students.json'), 'utf8'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const pub = D.projectAll(records, D.makeViewer('public'));
const membersOnly = records.filter((r) => r.profileVisibility === 'cohort');
const hidden = records.filter((r) => r.profileVisibility === 'hidden');
const NOT_AVAILABLE = 'This profile is not available in your current view.';

(async () => {
  let breakMap = false;
  const site = http.createServer((req, res) => {
    const file = decodeURIComponent(req.url.split('?')[0].replace(/^\//, '')) || 'index.html';
    const full = path.join(ROOT, file);
    if ((breakMap && file.endsWith('.svg') && file.includes('map')) || !full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404); return res.end('missing');
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(full)] || 'text/plain' }); res.end(fs.readFileSync(full));
  }).listen(0);
  const base = `http://127.0.0.1:${site.address().port}/`;
  const browser = await chromium.launch({ channel: 'chrome' });
  let n = 0; const ok = (name) => { n++; console.log('  ok  ' + name); };
  const errors = [];
  const open = async (url = 'students.html', { viewport = { width: 1280, height: 900 }, scheme = 'light', reducedMotion = 'no-preference' } = {}) => {
    const context = await browser.newContext({ viewport, colorScheme: scheme, reducedMotion });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${url}: ${e}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|announcements|Map:/i.test(m.text())) errors.push(`${url}: ${m.text()}`); });
    await page.goto(base + url);
    await page.waitForSelector('#sx-profiles:not([aria-busy])');
    return page;
  };
  const countText = (page) => text(page, '#sx-result-count');
  // Text with all runs of whitespace (line breaks in the HTML) as single spaces
  const text = async (page, sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
  const cardNames = (page) => page.$$eval('.sx-card-name', (all) => all.map((e) => e.textContent));
  const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const query = (page) => page.evaluate(() => window.location.search);

  /* ----- public preview ----- */
  let page = await open();
  assert.match(await countText(page), /Showing 1–12 of 24 matching profiles \(24 public in this view\)/);
  assert.strictEqual((await cardNames(page)).length, 12);
  assert.match(await text(page, '#sx-pagination'), /Page 1 of 2/);
  assert.match(await text(page, '#sx-stats'), /24\s*matching public profiles/);
  assert.match(await text(page, '#sx-stats'), /40\s*fictional records in this demonstration/);
  assert.match(await text(page, '#sx-demo'), /do not sign you in or grant access to any real student information/);
  await page.click('#sx-pagination button:has-text("Next")');
  assert.match(await countText(page), /Showing 13–24 of 24/);
  ok('public preview: 24 profiles (not 40), 12 per page, two pages; demo notice and "40 fictional records" kept separate');

  const body = await page.evaluate(() => document.body.innerText);
  for (const r of [...membersOnly, ...hidden]) assert.ok(!body.includes(r.fullName), r.fullName);
  assert.strictEqual(await page.locator('.sx-locked-card').count(), 1);
  for (const sel of ['#sx-profiles', '#sx-country-panel', '#sx-chips']) assert.ok(!/citizen|visa/i.test(await text(page, sel)), `no citizenship or visa data in ${sel}`);
  ok('no members-only or hidden person appears anywhere (no per-person placeholders); one generic members-only card; no citizenship text');

  const locked = await text(page, '.sx-locked-card');
  await page.goto(base + 'students.html?country=NL&track=mhi'); await page.waitForSelector('#sx-profiles:not([aria-busy])');
  assert.strictEqual(await text(page, '.sx-locked-card'), locked);
  await page.click('#sx-locked-more');
  assert.match(await text(page, '#sx-locked-explain'), /There is no student login yet/);
  assert.strictEqual(await page.locator('.sx-locked-card a, .sx-locked-card button:has-text("Log in")').filter({ hasText: /log ?in|sign in/i }).count(), 0);
  ok('the members-only card does not change with filters and offers no fake login');

  /* ----- member preview ----- */
  await page.goto(base + 'students.html'); await page.waitForSelector('#sx-profiles:not([aria-busy])');
  await page.check('input[name="sx-preview"][value="member"]');
  assert.match(await countText(page), /of 36 matching profiles \(36 available to verified members in this view\)/);
  const memberBody = await page.evaluate(() => document.body.innerText);
  for (const r of hidden) assert.ok(!memberBody.includes(r.fullName), r.fullName);
  await page.click('#sx-more > summary');
  assert.ok(await page.locator('details[data-key="citizenship"]').count());
  await page.click('details[data-key="citizenship"] > summary');
  await page.check('details[data-key="citizenship"] input[value="non_eu_eea_swiss"]');
  assert.match(await countText(page), /of 2 matching profiles/);
  assert.ok(!/citizenship|non_eu/.test(await query(page)), 'citizenship never goes into the address');
  await page.check('input[name="sx-preview"][value="public"]');
  assert.match(await countText(page), /of 24 matching profiles/);
  assert.strictEqual(await page.locator('details[data-key="citizenship"]').count(), 0);
  ok('member preview: 36 profiles, hidden ones never; citizenship filter only there, only in memory, cleared when leaving');

  /* ----- map and synchronised filters ----- */
  await page.goto(base + 'students.html'); await page.waitForSelector('#sx-map svg path[data-code="NL"]');
  assert.strictEqual(await page.getAttribute('#sx-map path[data-code="NL"]', 'aria-label'), 'Netherlands: 7 visible profiles');
  assert.strictEqual(await page.getAttribute('#sx-map path[data-code="FR"]', 'tabindex'), null, 'countries without profiles are not tab stops');
  await page.dispatchEvent('#sx-map path[data-code="IT"]', 'click');
  assert.match(await text(page, '#sx-chips'), /Country: Italy/);
  assert.match(await countText(page), /of 5 matching profiles/);
  assert.match(await text(page, '#sx-country-panel'), /Italy\s*5 visible matching profiles/);
  assert.match(await query(page), /country=IT/);
  assert.strictEqual(await page.getAttribute('#sx-map path[data-code="IT"]', 'aria-pressed'), 'true');
  await page.dispatchEvent('#sx-map path[data-code="IT"]', 'click');
  assert.match(await countText(page), /of 24 matching/);
  ok('map: clicking a country filters, adds a chip, updates count, panel and address; clicking again clears it');

  await page.focus('#sx-map path[data-code="DE"]');
  assert.strictEqual(await page.isVisible('#sx-map-tooltip'), true);
  assert.match(await text(page, '#sx-map-tooltip'), /Germany: \d+ visible profile/);
  await page.keyboard.press('Enter');
  assert.match(await text(page, '#sx-chips'), /Country: Germany/);
  ok('map keyboard: countries with profiles are focusable, show a tooltip on focus and toggle with Enter');

  await page.click('#sx-country-list-wrap > summary');
  await page.click('.sx-country-item:has-text("Norway")');
  assert.match(await text(page, '#sx-chips'), /Country: Norway/);
  assert.match(await text(page, '.sx-country-item[aria-pressed="true"]'), /Norway/);
  ok('"Explore by country" works as a complete fallback for the map');

  await page.click('.sx-clear');
  await page.click('[data-view="world"]');
  assert.strictEqual(await page.getAttribute('#sx-map svg', 'viewBox'), '0.0 0.0 1000.0 438.0');
  await page.click('[data-view="europe"]'); assert.match(await text(page, '#sx-map-outside'), /outside this map view/);
  await page.click('[data-zoom="in"]'); await page.click('[data-zoom="reset"]');
  assert.strictEqual(await page.getAttribute('[data-view="europe"]', 'aria-pressed'), 'true');
  const legend = await text(page, '#sx-legend');
  assert.match(legend, /Visible profiles/); assert.match(legend, /Selected/);
  ok('map views: Europe and World presets, zoom, reset; legend labelled "Visible profiles"; profiles outside the view are mentioned');

  // Track filter changes the map counts (faceted: every filter except Country)
  await page.goto(base + 'students.html?track=mhi'); await page.waitForSelector('#sx-map svg path[data-code="NL"][aria-label]');
  const nlMhi = pub.filter((p) => p.track === 'mhi' && p.country && p.country.code === 'NL').length;
  assert.strictEqual(await page.getAttribute('#sx-map path[data-code="NL"]', 'aria-label'), `Netherlands: ${nlMhi} visible profile${nlMhi === 1 ? '' : 's'}`);
  ok('track filter updates the map counts');

  /* ----- combined filters, chips, sort, list, URL ----- */
  await page.goto(base + 'students.html?track=mhi,eeh&background=medicine&cohort=2026–2028'); await page.waitForSelector('#sx-profiles:not([aria-busy])');
  const expected = D.filterProfiles(pub, { track: ['mhi', 'eeh'], background: ['medicine'], cohort: ['2026–2028'] });
  assert.match(await countText(page), new RegExp(`of ${expected.length} matching profile`));
  assert.strictEqual(await page.locator('.sx-chip').count(), 4);
  await page.click('.sx-chip:has-text("Academic background")');
  assert.strictEqual(await page.locator('.sx-chip').count(), 3);
  await page.click('.sx-clear');
  assert.match(await countText(page), /of 24 matching/);
  assert.strictEqual(await query(page), '');
  ok('combined filters from the address (OR within, AND between), removable chips, Clear all');

  await page.selectOption('#sx-sort', 'country');
  const firstCountry = await text(page, '.sx-card .sx-fact-country');
  assert.strictEqual(firstCountry, D.sortProfiles(pub, 'country')[0].country.name);
  await page.click('[data-layout="list"]');
  assert.strictEqual(await page.locator('.sx-table tbody tr').count(), 12);
  assert.match(await query(page), /view=list/);
  assert.deepStrictEqual(await page.$$eval('.sx-table th', (all) => all.map((th) => th.textContent)), ['Name', 'Country', 'Academic background', 'Track', 'Cohort', '']);
  ok('sorting by country; compact list with name, country, background, track, cohort; view kept in the address');

  await page.fill('#sx-search', 'SCHAFERMEYER');
  await page.waitForFunction(() => /of 1 matching profile/.test(document.getElementById('sx-result-count').textContent));
  await page.fill('#sx-search', 'nobody-matches-this');
  await page.waitForFunction(() => /No matching profiles/.test(document.getElementById('sx-result-count').textContent));
  assert.match(await text(page, '.sx-empty'), /No profiles match these filters\./);
  for (const b of ['Clear filters', 'Join the directory']) assert.ok(await page.locator(`.sx-empty :text("${b}")`).count(), b);
  await page.click('.sx-empty button:has-text("Clear filters")');
  ok('accent-insensitive search; empty state with Clear filters and Join');

  /* ----- profile drawer, deep links, Back/Forward ----- */
  const target = pub.find((p) => p.additionalCountry && p.degree);
  await page.goto(base + `students.html?profile=${target.id}`); await page.waitForSelector('#sx-drawer[open]');
  assert.strictEqual(await text(page, '#sx-drawer-name'), target.name);
  const drawer = await text(page, '#sx-drawer');
  assert.ok(drawer.includes('Also identifies with') && drawer.includes(target.additionalCountry.name));
  assert.match(drawer, /Example profile \(fictional\)/);
  assert.strictEqual(await page.locator('#sx-drawer a[href*="linkedin"]').count(), 0, 'demo LinkedIn never links anywhere');
  assert.strictEqual(await page.evaluate(() => document.activeElement.textContent), 'Close');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.getElementById('sx-drawer').contains(document.activeElement)), 'focus stays in the drawer');
  await page.keyboard.press('Escape');
  assert.strictEqual(await page.locator('#sx-drawer[open]').count(), 0);
  assert.strictEqual(await query(page), '');
  ok('deep link opens the profile drawer (details, "Also identifies with", demo badge, inert LinkedIn); focus kept inside; Escape closes and clears the address');

  const opener = page.locator('.sx-card .sx-name-button').first();
  const openerName = await opener.textContent();
  await opener.click(); await page.waitForSelector('#sx-drawer[open]');
  await page.click('.sx-drawer-close');
  assert.strictEqual(await page.evaluate(() => document.activeElement.textContent), openerName, 'focus returns to the opener');
  await page.dispatchEvent('#sx-map path[data-code="NO"]', 'click');
  assert.match(await query(page), /country=NO/);
  await page.goBack(); await page.waitForFunction(() => !location.search.includes('country'));
  assert.match(await countText(page), /of 24 matching/);
  await page.goForward(); await page.waitForFunction(() => location.search.includes('country=NO'));
  assert.match(await text(page, '#sx-chips'), /Country: Norway/);
  ok('focus returns to the opener after closing; Back/Forward restore the filters');

  for (const id of [membersOnly[0].id, hidden[0].id, 'demo-999']) {
    await page.goto(base + `students.html?profile=${id}`); await page.waitForSelector('#sx-profiles:not([aria-busy])');
    await page.waitForSelector('.toast');
    assert.strictEqual(await text(page, '.toast'), NOT_AVAILABLE, id);
    assert.strictEqual(await page.locator('#sx-drawer[open]').count(), 0);
  }
  ok('members-only, hidden and unknown profile ids all get the same neutral message');

  /* ----- discovery and saved profiles ----- */
  await page.goto(base + 'students.html?country=IT'); await page.waitForSelector('#sx-profiles:not([aria-busy])');
  const italians = D.filterProfiles(pub, { country: ['IT'] }).map((p) => p.name);
  for (let i = 0; i < 4; i++) {
    await page.click('#sx-random'); await page.waitForSelector('#sx-drawer[open]');
    assert.ok(italians.includes(await text(page, '#sx-drawer-name')));
    await page.keyboard.press('Escape');
  }
  ok('"Meet someone new" only picks from the current, visible results');

  await page.locator('.sx-card .sx-save').first().click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('euhem-saved-profiles-v1')));
  assert.strictEqual(stored.length, 1); assert.match(stored[0], /^demo-\d{3}$/);
  await page.evaluate(() => localStorage.setItem('euhem-saved-profiles-v1', JSON.stringify([...JSON.parse(localStorage.getItem('euhem-saved-profiles-v1')), 'demo-999', '<bad>'])));
  await page.goto(base + 'students.html'); await page.waitForSelector('#sx-profiles:not([aria-busy])');
  assert.strictEqual(await text(page, '#sx-saved-toggle'), 'Saved (1)');
  await page.click('#sx-saved-toggle');
  assert.match(await countText(page), /of 1 matching profile/);
  await page.locator('.sx-card .sx-save').first().click();
  assert.match(await text(page, '.sx-empty'), /No saved profiles yet/);
  assert.match(await text(page, '.sx-empty'), /saved profile is not available in this view/);
  await page.click('.sx-empty button:has-text("Clear saved")');
  assert.deepStrictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('euhem-saved-profiles-v1'))), []);
  ok('saved profiles: ids only, on this device; unavailable ids handled; Clear saved');

  /* ----- insights ----- */
  assert.match(await text(page, '.sx-insights'), /Based on visible profiles in this view/);
  assert.match(await text(page, '#sx-mobility-insights'), /Not enough publishable data for this breakdown\./);
  assert.match(await text(page, '.sx-insights'), /Fictional/);
  assert.match(await text(page, '#sx-mobility-insights'), /hidden \(small group\)/);
  ok('insights: visible-profile charts and fictional whole-cohort statistics are separate; small groups hidden');
  await page.context().close();

  /* ----- map failure, phones, dark mode, reduced motion ----- */
  breakMap = true;
  page = await open();
  await page.waitForSelector('.sx-map-status:has-text("could not be loaded")');
  assert.match(await countText(page), /of 24 matching/);
  await page.click('.sx-country-item:has-text("Italy")');
  assert.match(await countText(page), /of 5 matching/);
  breakMap = false;
  ok('if the map fails to load, the directory and the country list still work');
  await page.context().close();

  for (const width of [360, 375, 768, 1024, 1440]) {
    page = await open('students.html', { viewport: { width, height: 900 } });
    await page.waitForSelector('#sx-map svg');
    assert.strictEqual(await sideways(page), 0, `cards ${width}`);
    await page.click('[data-layout="list"]');
    assert.strictEqual(await sideways(page), 0, `list ${width}`);
    if (width <= 700) {
      assert.strictEqual(await page.isVisible('#sx-filters'), false);
      await page.click('#sx-filters-toggle'); assert.strictEqual(await page.isVisible('#sx-filters'), true);
      await page.goto(base + 'students.html?track=mhi&country=NL'); await page.waitForSelector('#sx-profiles:not([aria-busy])');
      assert.strictEqual(await text(page, '#sx-filter-count'), '2');
    }
    await page.context().close();
  }
  ok('no sideways scrolling at 360, 375, 768, 1024 and 1440px; phone Filters button with active count');

  page = await open('students.html?profile=demo-001', { scheme: 'dark', reducedMotion: 'reduce' });
  await page.waitForSelector('#sx-drawer[open]');
  const colors = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.getElementById('sx-drawer')).backgroundColor,
    getComputedStyle(document.getElementById('sx-drawer')).animationName]);
  assert.notStrictEqual(colors[0], 'rgb(247, 244, 239)'); assert.notStrictEqual(colors[1], 'rgb(255, 255, 255)');
  assert.strictEqual(colors[2], 'none');
  ok('dark mode follows the site theme; reduced motion turns the drawer animation off');
  await page.context().close();

  assert.deepStrictEqual(errors, []);
  ok('no JavaScript errors');
  await browser.close(); site.close();
  console.log(n + ' students browser checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
