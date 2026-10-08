import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const data = JSON.parse(read('content/build-effort.json'));
const html = read('behind-the-build.html');
assert.equal(data.totalHours, 60, 'The approved snapshot is 60 hours');
assert.equal(data.categories.length, 6);
assert.equal(data.categories.reduce((a, c) => a + c.hours, 0), data.totalHours);
assert.equal(data.basis, 'Owner-reported estimate');
assert.equal((html.match(/class="build-work"/g) || []).length, data.categories.length);
assert(html.includes('Individual categories were not timed separately.'));
assert(html.includes('not an independently audited or automatically tracked total'));
assert(html.includes('data-total-hours>60</strong>'));
for (const c of data.categories) {
  assert(html.includes(`id="work-${c.id}"`));
  assert(html.includes(`data-hours="${c.hours}"`));
  if (!c.link.startsWith('https://')) assert(fs.existsSync(path.join(root, c.link.split('#')[0])), `Missing destination ${c.link}`);
}
const nav = read('site-nav.js');
assert.equal((nav.match(/key: "behind-build"/g) || []).length, 1);
assert(read('roadmap.html').includes('href="behind-the-build.html"'));
for (const file of ['behind-the-build.html', 'behind-build.css', 'behind-build.js', 'content/build-effort.json']) assert(read('sw.js').includes(`"${file}"`), `Missing offline asset ${file}`);
assert(!/\b(?:fetch|localStorage|sessionStorage|setInterval)\b/.test(read('behind-build.js')), 'The new feature must not collect data or create a live counter');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'IDs must be unique');
for (const match of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(match[1]), `Broken section link ${match[1]}`);
console.log('Behind the Build data, provenance, totals, integration, offline assets and anchor checks passed.');
