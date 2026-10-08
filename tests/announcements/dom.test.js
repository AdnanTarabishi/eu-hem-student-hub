// Announcements interactions in a DOM, using the real page and shared scripts.
// Run with jsdom installed: node tests/announcements/dom.test.js
// Or point JSDOM_MODULE at an existing jsdom package. No browser is launched.
// This does not test layout, touch, native dialog focus trapping or CSS contrast.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_MODULE || 'jsdom');
const ROOT = path.resolve(__dirname, '../..');
const BASE = 'https://example.test/eu-hem-student-hub/';
const TODAY = '2026-10-08';
const PAGE = fs.readFileSync(path.join(ROOT, 'announcements.html'), 'utf8');
const LIVE_CSV = fs.readFileSync(path.join(ROOT, 'data/announcements.csv'), 'utf8');
const HEADER = ['Date', 'Title', 'Category', 'Message', 'Link', 'Pinned', 'Expires', 'Posted by'];
const csv = (rows, headers = HEADER) => [headers, ...rows].map((row) => row.map((value) => '"' + String(value || '').replace(/"/g, '""') + '"').join(',')).join('\n');
const FIXTURE = csv([
  ['2026-10-01', 'Pinned class notice', 'Student', 'Older information remains pinned.', '', 'Yes', '', 'Student team'],
  [TODAY, 'Room relocation', 'Urgent', 'The workshop is in room 4.', '', '', TODAY, 'Teaching team'],
  ['2026-10-07', 'Earlier urgent notice', 'Urgent', 'Check the timetable.', '', 'Yes', TODAY, 'Teaching team'],
  [TODAY, 'Café methods workshop', 'Academic', 'Explore a linear model together.', 'https://example.test/workshop', '', '', 'Academic team'],
  ['2026-10-06', 'Career mentoring', 'Student Community', 'Meet the alumni team.', '', '', '', 'Community team'],
  ['2026-10-09', 'Scheduled urgent notice', 'Urgent', 'Do not show this yet.', '', '', '', 'Teaching team'],
  ['2026-10-01', 'Expired urgent notice', 'Urgent', 'Do not show this anymore.', '', '', '2026-10-07', 'Teaching team'],
  ['2026-10-06', 'Last day to register', 'Academic', 'Registration closes today.', '', '', TODAY, 'Academic team'],
]);
const turn = () => new Promise((resolve) => setTimeout(resolve, 10));
async function until(condition, message) {
  for (let i = 0; i < 60; i++) { if (condition()) return; await turn(); }
  assert.ok(condition(), message);
}
const normalise = (text) => text.replace(/\s+/g, ' ').trim();

async function page({ source = FIXTURE, hash = '', home = false, failFirst = false, instant = '2026-10-08T12:00:00Z' } = {}) {
  const errors = [];
  const dom = new JSDOM(home ? '<!doctype html><html><body><main><p id="latest-announcements-status">Loading</p><div id="latest-announcements"></div></main></body></html>' : PAGE, {
    url: BASE + (home ? 'index.html' : 'announcements.html') + hash,
    runScripts: 'outside-only', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', (error) => errors.push(error.message)),
  });
  const { window } = dom;
  const NativeDate = window.Date;
  let now = instant;
  window.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return NativeDate.parse(now); }
  };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  // JSDOM does not implement these native dialog methods. Closing still fires
  // the same close event so the application's history/focus handling runs.
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  let fetches = 0, newsroomFetches = 0;
  window.fetch = async (url, options = {}) => {
    assert.match(String(url), /data\/announcements\.csv(?:\?|$)/);
    fetches++;
    // The shared banner loader remains independent; only the page fetch retries.
    if (options.signal) newsroomFetches++;
    if (failFirst && options.signal && newsroomFetches === 1) return { ok: false, status: 503 };
    return { ok: true, text: async () => source };
  };
  window.console.error = (...args) => errors.push(args.map(String).join(' '));
  const context = dom.getInternalVMContext();
  for (const file of ['utils.js', 'ui.js', 'announcements.js', 'announcement-media.js', 'announcements-newsroom.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  await turn();
  const doc = window.document;
  return {
    window, doc, errors, close: () => dom.window.close(), fetches: () => fetches,
    advanceDate: async (value) => { now = value; doc.dispatchEvent(new window.Event('visibilitychange')); await turn(); },
    cards: () => [...doc.querySelectorAll('#news-feature article.news-spotlight, #news-feed article.news-card')],
    titles: () => [...doc.querySelectorAll('#news-feature .news-title a[data-news-open], #news-feed .news-title a[data-news-open]')].map((item) => item.textContent.trim()),
    input: async (selector, value) => {
      const input = doc.querySelector(selector); assert.ok(input, selector);
      input.value = value; input.dispatchEvent(new window.Event('input', { bubbles: true })); await turn();
    },
    select: async (selector, value) => {
      const select = doc.querySelector(selector); assert.ok(select, selector);
      select.value = value; select.dispatchEvent(new window.Event('change', { bubbles: true })); await turn();
    },
    click: async (selector) => { const target = doc.querySelector(selector); assert.ok(target, selector); target.click(); await turn(); },
  };
}

let count = 0;
async function test(name, run) { await run(); count++; console.log('  ok  ' + name); }
async function withPage(options, run) {
  const p = await page(options);
  try { await run(p); assert.deepEqual(p.errors, [], 'no unhandled application errors'); }
  finally { p.close(); }
}

(async () => {
  await test('active feed supports custom categories, accent-insensitive search, sort and grid/list without losing items', () => withPage({}, async (p) => {
    assert.equal(p.cards().length, 6);
    assert.equal(p.titles()[0], 'Earlier urgent notice');
    assert.ok(p.cards()[0].classList.contains('news-spotlight'));
    assert.ok(!p.doc.querySelector('#news-feed').textContent.includes('Scheduled urgent notice'));
    assert.ok(!p.doc.querySelector('#news-feed').textContent.includes('Expired urgent notice'));
    await p.click('#news-filters [data-news-category="Student Community"]');
    assert.deepEqual(p.titles(), ['Career mentoring']);
    assert.equal(p.doc.querySelector('[data-news-category="Student Community"]').getAttribute('aria-pressed'), 'true');
    await p.click('#news-reset');
    await p.input('#news-search', 'cafe');
    assert.deepEqual(p.titles(), ['Café methods workshop']);
    await p.input('#news-search', 'linear model');
    assert.deepEqual(p.titles(), ['Café methods workshop']);
    await p.input('#news-search', 'Community team');
    assert.deepEqual(p.titles(), ['Career mentoring']);
    await p.click('#news-reset');
    await p.select('#news-sort', 'newest');
    assert.equal(p.titles()[0], 'Café methods workshop');
    await p.select('#news-sort', 'oldest');
    assert.equal(p.titles()[0], 'Pinned class notice');
    await p.select('#news-sort', 'priority');
    await p.click('[data-news-view="list"]');
    assert.equal(p.doc.querySelector('#news-feed').classList.contains('is-list'), true);
    assert.equal(p.doc.querySelector('#news-feature').hidden, true, 'list view contains every item in its compact feed');
    assert.equal(p.doc.querySelector('[data-news-view="list"]').getAttribute('aria-pressed'), 'true');
    assert.equal(p.cards().length, 6);
    await p.click('[data-news-view="grid"]');
    assert.equal(p.doc.querySelector('#news-feed').classList.contains('is-list'), false);
    assert.equal(p.doc.querySelector('#news-feature').hidden, false);
    assert.equal(p.cards().length, 6);
    await withPage({ source: csv([
      ['2026-10-01', 'Earlier urgent update', 'Urgent', 'Still important.', '', '', '', 'Test team'],
      [TODAY, 'Recent pinned update', 'Student', 'A newer pinned post.', '', 'Yes', '', 'Test team'],
    ]) }, async (older) => {
      assert.equal(older.titles()[0], 'Earlier urgent update');
      assert.equal(older.doc.querySelector('.news-focus-label').textContent, 'IN FOCUS · URGENT UPDATE');
    });
  }));

  await test('no-match search and reset recover the complete feed', () => withPage({}, async (p) => {
    await p.input('#news-search', 'no-such-announcement-xyz');
    assert.equal(p.cards().length, 0);
    assert.match(p.doc.querySelector('#news-status').textContent, /0|no|match/i);
    await p.click('#news-reset');
    assert.equal(p.doc.querySelector('#news-search').value, '');
    assert.equal(p.cards().length, 6);
  }));

  await test('homepage stays compact with three priority updates; urgent banner uses the newest active Urgent item', () => withPage({ home: true }, async (p) => {
    const compact = [...p.doc.querySelectorAll('#latest-announcements .announcement.compact')];
    assert.equal(compact.length, 3);
    assert.deepEqual(compact.map((item) => item.querySelector('.announcement-title').textContent),
      ['Earlier urgent notice', 'Pinned class notice', 'Café methods workshop']);
    assert.equal(p.doc.querySelector('#latest-announcements-status').hidden, true);
    assert.equal(p.doc.querySelectorAll('.urgent-banner').length, 1);
    assert.match(p.doc.querySelector('.urgent-banner a').textContent, /Room relocation/);
    assert.match(p.doc.querySelector('.urgent-banner a').getAttribute('href'), /#2026-10-08-room-relocation$/);
    assert.equal(p.doc.querySelectorAll('#latest-announcements img, #latest-announcements .news-card').length, 0);
  }));

  await test('live election story retains all candidate names and exact elected percentages', () => withPage({
    source: LIVE_CSV, hash: '#2026-10-07-student-representatives-election-results',
  }, async (p) => {
    const reader = p.doc.querySelector('#news-reader');
    assert.equal(reader.open, true, 'incoming shared link opens the full reader');
    assert.match(p.doc.querySelector('#news-reader-title').textContent, /Student Representatives Election Results/);
    const sections = [...reader.querySelectorAll('.election-section')];
    assert.equal(sections.length, 2);
    const candidates = (section) => [...section.querySelectorAll('.election-column:first-child li')].map((item) => item.textContent.trim());
    assert.deepEqual(candidates(sections[0]), ['Brent Van Berge', 'Heleen Hulsebosch', 'Ghulam Murtaza Ran', 'Filipe Pinheiro', 'Nina Kuenen']);
    assert.deepEqual(candidates(sections[1]), ['Maud Van Ekeren', 'Marcio Jacob', 'Rik Joosse', 'Ties Van Huystee', 'Maud Hamster', 'Heleen Hulsebosch', 'Kristina Tergau']);
    assert.deepEqual([...reader.querySelectorAll('.election-winner')].map((item) => [
      item.querySelector('.election-winner-name').textContent, item.querySelector('.election-percentage').textContent,
    ]), [['Filipe Pinheiro', '67%'], ['Nina Kuenen', '54%'], ['Maud Hamster', '53%']]);
    await p.click('#news-reader-close');
    await until(() => !reader.open, 'arrival reader closes');
    await p.input('#news-search', 'Kristina Tergau');
    assert.equal(p.cards().length, 1, 'candidate names are searchable');
  }));

  await test('changing a hash opens the matching full text; Back and close restore the clicked title focus', () => withPage({}, async (p) => {
    const reader = p.doc.querySelector('#news-reader');
    const opener = p.doc.querySelector('#news-feature .news-title a[data-news-open], #news-feed .news-title a[data-news-open]');
    opener.focus(); opener.click();
    await until(() => reader.open, 'clicked title opens reader');
    assert.match(p.window.location.hash, /earlier-urgent-notice/);
    await p.click('#news-reader-close');
    await until(() => !reader.open && !p.window.location.hash, 'close returns to the feed history entry');
    assert.equal(p.doc.activeElement, opener, 'close restores title focus');
    opener.click();
    await until(() => reader.open, 'reader reopens');
    p.window.history.back();
    await until(() => !reader.open && !p.window.location.hash, 'browser Back closes reader');
    assert.equal(p.doc.activeElement, opener, 'Back restores title focus');
    p.window.location.hash = '#2026-10-08-caf-methods-workshop';
    await until(() => reader.open, 'changing an existing page hash opens another reader');
    assert.equal(p.doc.querySelector('#news-reader-title').textContent, 'Café methods workshop');
    assert.ok(reader.textContent.includes('Explore a linear model together.'));
    p.window.location.hash = '#2026-10-06-career-mentoring';
    await until(() => p.doc.querySelector('#news-reader-title').textContent === 'Career mentoring', 'changing the hash updates an already open reader');
    assert.ok(reader.textContent.includes('Meet the alumni team.'));
    assert.equal(p.doc.querySelectorAll('#news-reader').length, 1);
  }));

  await test('a failed fetch offers Retry and recovers without duplicate cards or banners', () => withPage({ failFirst: true }, async (p) => {
    assert.equal(p.cards().length, 0);
    assert.equal(p.doc.querySelector('#news-empty-action').closest('[hidden]'), null);
    assert.match(p.doc.querySelector('#news-status').textContent, /could not|unable|load|try/i);
    await p.click('#news-empty-action');
    await until(() => p.cards().length === 6, 'retry loads the feed');
    assert.equal(p.fetches(), 3);
    assert.ok(p.doc.querySelector('#news-empty-action').closest('[hidden]'));
    assert.equal(p.doc.querySelectorAll('.urgent-banner').length, 1);
  }));

  await test('source text stays text and unsafe links never become clickable markup', () => withPage({
    source: csv([[TODAY, 'Update <img src=x onerror=alert(1)>', 'Custom <svg onload=alert(1)>',
      'A complete message.\n<script>alert(1)</script>\nFinal paragraph remains available.', 'javascript:alert(1)', '', '', '<img src=x onerror=alert(1)>']]),
  }, async (p) => {
    assert.equal(p.cards().length, 1);
    assert.ok(p.cards()[0].textContent.includes('<img src=x onerror=alert(1)>'));
    await p.click('#news-feature .news-title a[data-news-open], #news-feed .news-title a[data-news-open]');
    const content = p.doc.querySelector('#news-reader-content');
    assert.ok(normalise(content.textContent).includes('A complete message. <script>alert(1)</script> Final paragraph remains available.'));
    for (const element of [p.doc.querySelector('#news-feed'), p.doc.querySelector('#news-filters'), content]) {
      assert.equal(element.querySelectorAll('script, [onerror], [onload], a[href^="javascript:"]').length, 0);
    }
  }));

  await test('copy link works with and without clipboard access; broken artwork and malformed hashes do not break the feed', () => withPage({}, async (p) => {
    const image = p.cards()[0].querySelector('img');
    const title = p.titles()[0];
    image.dispatchEvent(new p.window.Event('error'));
    assert.equal(image.isConnected, false);
    assert.equal(p.titles()[0], title);
    assert.ok(p.cards()[0].querySelector('.news-art'));
    await p.click('#news-feature .news-title a[data-news-open], #news-feed .news-title a[data-news-open]');
    await p.click('#news-reader .news-copy');
    const url = p.doc.querySelector('#news-reader .news-share-box input');
    assert.ok(url, 'denied clipboard has a selectable link');
    assert.equal(url.value, BASE + 'announcements.html#2026-10-07-earlier-urgent-notice');
    assert.equal(p.doc.activeElement, url, 'fallback focuses a selectable link');
    let copied;
    Object.defineProperty(p.window.navigator, 'clipboard', { value: { writeText: async (value) => { copied = value; } }, configurable: true });
    await p.click('#news-reader .news-copy');
    assert.equal(copied, url.value);
    assert.equal(p.doc.querySelector('#toast-region .toast:last-child').textContent, 'Announcement link copied.');
    p.window.location.hash = '#%';
    await until(() => !p.doc.querySelector('#news-reader').open, 'malformed hash closes reader safely');
    assert.equal(p.cards().length, 6);

    let rejectCopy;
    Object.defineProperty(p.window.navigator, 'clipboard', { value: {
      writeText: () => new Promise((resolve, reject) => { rejectCopy = reject; }),
    }, configurable: true });
    const staleButton = p.cards()[0].querySelector('.news-copy');
    const staleHost = staleButton.parentElement.parentElement;
    staleButton.click();
    await p.input('#news-search', 'cafe');
    assert.equal(staleButton.isConnected, false);
    rejectCopy(new Error('Clipboard permission denied'));
    await turn();
    assert.equal(staleHost.querySelector('.news-share-box'), null, 'late clipboard rejection does not modify a detached card');

    await p.click('#news-reset');
    await p.click('#news-feature .news-title a[data-news-open], #news-feed .news-title a[data-news-open]');
    await p.click('#news-reader .news-copy');
    await p.click('#news-reader-close');
    const focusAfterClose = p.doc.activeElement;
    rejectCopy(new Error('Clipboard permission denied'));
    await turn();
    assert.equal(p.doc.querySelector('#news-reader .news-share-box'), null, 'late clipboard rejection does not add a fallback to a closed reader');
    assert.equal(p.doc.activeElement, focusAfterClose, 'late rejection does not steal restored focus');
  }));

  await test('New only, active statistics and a day rollover use the Bologna calendar', () => withPage({ instant: '2026-10-07T23:31:00Z' }, async (p) => {
    const stats = () => ['news-total', 'news-new', 'news-pinned'].map((id) => p.doc.getElementById(id).textContent);
    assert.deepEqual(stats(), ['6', '5', '2'], 'already 8 October in Bologna while UTC is still 7 October');
    await p.click('#news-new-only');
    assert.equal(p.cards().length, 5);
    assert.ok(!p.titles().includes('Pinned class notice'));
    await p.click('#news-reset');
    assert.equal(p.doc.querySelector('#news-new-only').checked, false);
    assert.equal(p.cards().length, 6);
    await p.advanceDate('2026-10-08T23:01:00Z');
    assert.deepEqual(stats(), ['4', '2', '1']);
    assert.ok(p.titles().includes('Scheduled urgent notice'), 'scheduled update appears on the new day');
    assert.ok(!p.titles().includes('Room relocation'), 'an update disappears after its expiry day');
  }));

  await test('optional local image, alt and credit work; external and broken photos keep a readable fallback', () => withPage({
    source: csv([
      [TODAY, 'Photo update', 'Academic', 'A local illustration.', '', '', '', 'Test team', 'img/social-preview.png', 'The Hub overview', 'Test image credit'],
      [TODAY, 'External photo update', 'Student', 'An external image is not loaded.', '', '', '', 'Test team', 'https://external.example/image.jpg', 'External', ''],
      [TODAY, 'Broken photo update', 'Student', 'This text remains readable.', '', '', '', 'Test team', 'assets/images/missing-test.webp', 'Missing image', ''],
    ], [...HEADER, 'Image', 'Image alt', 'Image credit']),
  }, async (p) => {
    const photo = p.doc.querySelector('[id="2026-10-08-photo-update"]');
    const local = photo.querySelector('.news-art--photo img');
    assert.equal(local.getAttribute('src'), 'img/social-preview.png');
    assert.equal(local.getAttribute('alt'), 'The Hub overview');
    assert.equal(photo.querySelector('.news-image-credit').textContent, 'Test image credit');
    assert.equal(p.doc.querySelector('[id="2026-10-08-external-photo-update"] .news-art--photo'), null);
    assert.equal(p.doc.querySelector('img[src^="https://external.example/"]'), null);
    const broken = p.doc.querySelector('[id="2026-10-08-broken-photo-update"]');
    const image = broken.querySelector('.news-art--photo img');
    image.dispatchEvent(new p.window.Event('error'));
    assert.equal(image.isConnected, false);
    assert.equal(broken.querySelector('.news-art--photo'), null);
    assert.ok(broken.textContent.includes('This text remains readable.'));
  }));

  console.log(`${count} announcements DOM checks passed (not a browser layout test)`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
