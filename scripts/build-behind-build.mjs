// Generate the public effort page from one owner-maintained data file.
// No build service or runtime fetch is required by the website.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const write = (name, text) => fs.writeFileSync(path.join(root, name), text);
const data = JSON.parse(read('content/build-effort.json'));
assert.equal(data.schemaVersion, 1);
assert(Number.isFinite(data.totalHours) && data.totalHours > 0);
assert.equal(data.categories.reduce((sum, item) => sum + item.hours, 0), data.totalHours, 'Category hours must equal the total');
assert.equal(new Set(data.categories.map(item => item.id)).size, data.categories.length);
assert.equal(data.basis, 'Approximate upper-range estimate');
assert.equal(data.estimateType, 'upper-range');
assert(typeof data.estimateNotes === 'string' && data.estimateNotes.length > 0);
assert(/^\d{4}-\d{2}-\d{2}$/.test(data.asOf));
for (const item of data.categories) {
  assert(/^[a-z-]+$/.test(item.id));
  assert(Number.isFinite(item.hours) && item.hours > 0);
  assert(Array.isArray(item.examples) && item.examples.length > 0);
  assert(/^(?:[a-z][a-z0-9-]*\.html(?:#[a-z0-9-]+)?|https:\/\/github\.com\/AdnanTarabishi\/eu-hem-student-hub(?:\/pulls)?)$/.test(item.link));
}
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate = date => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
const formattedDate = formatDate(data.asOf);
const beta = JSON.parse(read('content/roadmap.json')).milestones.find(item => item.id === 'first-cohort-beta');
assert(beta?.status === 'completed' && /^\d{4}-\d{2}-\d{2}$/.test(beta.date), 'The cohort beta must use the completed Roadmap milestone');
const pct = item => Number((item.hours / data.totalHours * 100).toFixed(1));
let cumulative = 0;
const segments = data.categories.map(item => {
  const start = cumulative;
  cumulative += item.hours / data.totalHours * 100;
  return `var(--build-${item.id}) ${start.toFixed(5)}% ${cumulative.toFixed(5)}%`;
}).join(', ');
const rows = data.categories.map((item, i) => `<details class="build-work" id="work-${esc(item.id)}" style="--work-color:var(--build-${esc(item.id)})">
  <summary><span class="build-index" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="build-work-label"><strong>${esc(item.title)}</strong><span class="build-bar" aria-hidden="true"><span style="width:${pct(item)}%"></span></span></span><span class="build-value" data-hours="${item.hours}" data-share="${pct(item)}">${item.hours} h</span><span class="build-plus" aria-hidden="true">+</span></summary>
  <div class="build-work-body"><p>${esc(item.summary)}</p><ul>${item.examples.map(text => `<li>${esc(text)}</li>`).join('')}</ul><a class="build-text-link" href="${esc(item.link)}">${esc(item.linkLabel)} <span aria-hidden="true">↗</span></a></div>
</details>`).join('\n');
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Behind the Build – EU-HEM Student Hub</title>
  <meta name="description" content="The human effort behind the EU-HEM Student Hub: approximately ${data.totalHours} hours as an upper-range estimate across design, tools, content, testing, planning and launch.">
  <!-- Social preview (scripts/social-tags.js) -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="EU-HEM Student Hub">
  <meta property="og:title" content="Behind the Build – EU-HEM Student Hub">
  <meta property="og:description" content="The human effort behind the EU-HEM Student Hub: approximately ${data.totalHours} hours as an upper-range estimate across design, tools, content, testing, planning and launch.">
  <meta property="og:url" content="https://adnantarabishi.github.io/eu-hem-student-hub/behind-the-build.html">
  <meta property="og:image" content="https://adnantarabishi.github.io/eu-hem-student-hub/img/social-preview.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="EU-HEM Student Hub: less searching, more learning, living and connecting.">
  <meta name="twitter:card" content="summary_large_image">
  <!-- /Social preview -->
  <link rel="canonical" href="https://adnantarabishi.github.io/eu-hem-student-hub/behind-the-build.html">
  <link rel="preload" href="fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="behind-build.css">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="img/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="icon" href="img/app-icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="img/apple-touch-icon.png">
  <meta name="theme-color" content="#0f2b5b" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#091d3a" media="(prefers-color-scheme: dark)">
  <script src="theme.js"></script>
</head>
<body>
  <header class="site-header"><div class="container">
    <p class="site-title"><a href="index.html">EU-HEM Student Hub</a></p>
    <p class="site-tagline">Unofficial, student-run resources for the EU-HEM master's program</p>
    <nav class="site-nav" id="site-nav" data-current="behind-build" aria-label="Main menu"></nav>
    <script src="site-nav.js"></script>
  </div></header>
  <main class="container build-page" id="build-main">
    <section class="build-hero" aria-labelledby="build-title">
      <div class="build-hero-copy">
        <p class="build-eyebrow">About the Hub · Build notes</p>
        <h1 id="build-title">Behind<br>the Build<span>.</span></h1>
        <p class="build-lead">One student-led idea. Many thoughtful iterations. A shared space for the EU-HEM journey.</p>
        <p class="build-intro">A look at the planning, creativity and practical work behind the Hub — not just the code.</p>
        <div class="build-badges"><span>Student-led</span><span>AI-assisted</span><span>Free to use</span></div>
        <div class="build-actions"><a class="button button-primary" href="#effort">Explore the effort <span aria-hidden="true">↓</span></a><a class="build-text-link" href="roadmap.html">What's next <span aria-hidden="true">↗</span></a></div>
      </div>
      <aside class="build-total-card" aria-label="Estimated effort snapshot">
        <p class="build-eyebrow">The human effort</p>
        <p class="build-total"><strong data-total-hours>${data.totalHours}</strong><span>h</span></p>
        <h2>Estimated personal effort · upper range</h2>
        <p>Designing, directing, researching,<br>reviewing and bringing it together.</p>
        <div class="build-card-foot"><span>${esc(data.basis)}</span><time datetime="${data.asOf}">As of ${formattedDate}</time></div>
      </aside>
    </section>
    <nav class="build-jump" aria-label="On this page"><a href="#effort">The effort</a><a href="#milestones">The journey</a><a href="#people">Human + AI</a><a href="#method">About the numbers</a></nav>
    <section class="build-section" id="effort" aria-labelledby="effort-title">
      <div class="build-section-heading"><div><p class="build-eyebrow">01 / The effort</p><h2 id="effort-title">Where the hours went.</h2></div><p>Six kinds of work, one shared purpose:<br>make student life a little easier.</p></div>
      <p class="build-disclosure" id="allocation-note">Illustrative breakdown of the approximate ${data.totalHours}-hour upper-range estimate. Individual categories were not timed separately.</p>
      <div class="build-effort-grid">
        <div class="build-chart-card"><div class="build-donut" aria-hidden="true" style="background:conic-gradient(${segments})"><div><strong>${data.totalHours}<small>h</small></strong><span>estimated effort</span></div></div><h3>More than writing code.</h3><p>The visible pages are only part of the work. Decisions, research, review and improvements matter too.</p><a class="build-text-link" href="#method">How to read the numbers <span aria-hidden="true">↓</span></a></div>
        <div class="build-breakdown" aria-describedby="allocation-note">
          <div class="build-controls" hidden><div class="build-switch" role="group" aria-label="Display effort as"><button type="button" data-build-unit="hours" aria-pressed="true">Hours</button><button type="button" data-build-unit="share" aria-pressed="false">Share %</button></div><button type="button" class="build-expand" aria-expanded="false" aria-controls="build-work-list">Show all details</button></div>
          <div id="build-work-list">${rows}</div>
          <p class="build-sum">Total estimate <strong>${data.totalHours} hours</strong></p>
          <p class="build-rounding">Percentages are calculated from the allocation and rounded; they do not indicate measurement precision.</p>
          <p class="visually-hidden" id="build-announcement" role="status" aria-live="polite"></p>
        </div>
      </div>
    </section>
    <section class="build-section" id="milestones" aria-labelledby="milestone-title">
      <div class="build-section-heading"><div><p class="build-eyebrow">02 / The journey</p><h2 id="milestone-title">An idea, then a useful place.</h2></div><a class="build-text-link" href="roadmap.html">Full roadmap &amp; updates <span aria-hidden="true">↗</span></a></div>
      <ol class="build-timeline"><li><time datetime="2026-10-01">1 October 2026</time><h3>The first public code</h3><p>The homepage, timetable, calendar and announcements began taking shape in the repository.</p><a href="${esc(data.repositoryUrl)}/commits/main/">Browse the code history ↗</a></li><li><time datetime="${beta.date}">${formatDate(beta.date)}</time><h3>${esc(beta.title)}</h3><p>The Hub was shared with classmates — a starting point for feedback, improvements and new ideas.</p><a href="roadmap.html">Read the project journey ↗</a></li><li><time datetime="${data.asOf}">${formattedDate}</time><h3>A moment to look back</h3><p>This approximate ${data.totalHours}-hour upper-range estimate records the effort so far. The Hub continues to evolve beyond this snapshot.</p><a href="#method">Read the estimate notes ↓</a></li></ol>
    </section>
    <section class="build-section" id="people" aria-labelledby="people-title">
      <div class="build-section-heading"><div><p class="build-eyebrow">03 / Human + AI</p><h2 id="people-title">Human direction. AI assistance.</h2></div><p>Built with tools, guided by people.</p></div>
      <div class="build-role-grid"><article class="build-role"><span class="build-role-label">Project lead</span><h3>${esc(data.reportedBy)}</h3><p>Choosing the priorities, shaping the experience, organising content and sources, directing development, checking results and listening to students.</p><p class="build-role-foot">Product decisions and responsibility stay human.</p></article><article class="build-role"><span class="build-role-label">Development assistance</span><h3>ChatGPT · Codex · Claude Code</h3><p>Used to support exploration, drafting, coding, debugging and iteration. Their outputs still need selection, checking and refinement.</p><p class="build-role-foot">Tool execution time is not a measure of personal effort.</p></article></div>
    </section>
    <section class="build-section build-method" id="method" aria-labelledby="method-title"><p class="build-eyebrow">04 / About the numbers</p><h2 id="method-title">Transparent, not a timesheet.</h2><p>The headline is an <strong>approximate upper-range estimate of personal effort</strong>, revised at the project owner's request on ${formattedDate}. It is not an independently audited or automatically tracked total.</p><details><summary>What the estimate covers</summary><p>Planning, design decisions, content and source work, development direction, hands-on review, testing, launch preparation and feedback, including AI-assisted work with ChatGPT, Codex and Claude Code. AI runtime and GitHub activity alone cannot establish how long a person was actively working.</p></details><details><summary>How the estimate was prepared</summary><p>${esc(data.estimateNotes)}</p><p>The six categories are an illustrative allocation of the total, not six measured time logs. A work session can involve several activities; the display assigns the overall estimate once rather than adding overlapping sessions.</p></details><details><summary>How the figures are maintained</summary><p>This is a dated snapshot, not a live counter. The project owner can revise the estimate or request a new assessment of the completed work. The page does not track your visits, create a timer, or collect new personal information.</p><a href="content/build-effort.json">View the public estimate data ↗</a></details><p class="build-evidence">Explore the work itself: <a href="${esc(data.repositoryUrl)}">Source repository</a><span aria-hidden="true"> · </span><a href="${esc(data.repositoryUrl)}/pulls">Development reviews</a><span aria-hidden="true"> · </span><a href="roadmap.html">Roadmap &amp; updates</a></p></section>
    <section class="build-feedback" aria-labelledby="feedback-title"><div><p class="build-eyebrow">Better with your perspective</p><h2 id="feedback-title">Help shape the next hours.</h2><p>A confusing page, a useful idea, a missing feature — your feedback helps decide what comes next.</p></div><a class="button button-primary" href="contact.html">Share feedback <span aria-hidden="true">↗</span></a></section>
  </main>
  <footer class="site-footer"><div class="container"><p>EU-HEM Student Hub · Unofficial student project</p></div></footer>
  <script defer src="utils.js"></script><script defer src="ui.js"></script><script defer src="search.js"></script><script defer src="pwa.js"></script><script defer src="announcements.js"></script><script defer src="behind-build.js"></script>
</body>
</html>
`;
write('behind-the-build.html', html);
// Optional, idempotent integration for this focused feature. Existing content is preserved.
if (process.argv.includes('--integrate')) {
  let nav = read('site-nav.js');
  if (!nav.includes('key: "behind-build"')) {
    const anchor = /^(\s*\{ key: "roadmap",[^\n]+\n)/m;
    assert(anchor.test(nav), 'Shared About menu anchor changed; review instead of overwriting');
    nav = nav.replace(anchor, '$1      { key: "behind-build", label: "Behind the Build", href: "behind-the-build.html", icon: "info", desc: "The effort and people behind the Hub" },\n');
    write('site-nav.js', nav);
  }
  let sw = read('sw.js');
  if (!sw.includes('"behind-the-build.html"')) {
    assert(sw.includes('const SITE_FILES = ['));
    sw = sw.replace('const SITE_FILES = [', 'const SITE_FILES = [\n  "behind-the-build.html", "behind-build.css", "behind-build.js", "content/build-effort.json",');
    write('sw.js', sw);
  }
  let roadmap = read('roadmap.html');
  if (!roadmap.includes('href="behind-build.css')) roadmap = roadmap.replace('</head>', '  <link rel="stylesheet" href="behind-build.css">\n</head>');
  const teaser = `<aside class="build-teaser" aria-label="Behind the Build"><div><p class="build-eyebrow">Behind the Build</p><h2>Approximately ${data.totalHours} hours of personal effort.</h2><p>Upper-range estimate · ${formattedDate}. Explore the design, tools, content and care behind the Hub.</p></div><a class="button button-secondary" href="behind-the-build.html">See the effort <span aria-hidden="true">↗</span></a></aside>`;
  if (roadmap.includes('<!-- build-effort:start -->')) {
    roadmap = roadmap.replace(/<!-- build-effort:start -->[\s\S]*?<!-- build-effort:end -->/, `<!-- build-effort:start -->\n    ${teaser}\n    <!-- build-effort:end -->`);
  } else {
    const anchor = '    <div class="roadmap-tabs"';
    assert(roadmap.includes(anchor), 'Roadmap integration anchor changed; review required');
    roadmap = roadmap.replace(anchor, `    <!-- build-effort:start -->\n    ${teaser}\n    <!-- build-effort:end -->\n\n${anchor}`);
  }
  write('roadmap.html', roadmap);
  let readme = read('README.md');
  if (!readme.includes('## Behind the Build')) {
    readme += '\n\n## Behind the Build\n\n`behind-the-build.html` presents an approximate upper-range effort estimate and an illustrative\nallocation, not tracked hours. Edit `content/build-effort.json`, then run\n`node scripts/build-behind-build.mjs --integrate` and `node scripts/stamp-versions.js`.\nSee `docs/behind-the-build.md` for the data basis, update procedure and checks.\n';
    write('README.md', readme);
  }
}
console.log(`Generated Behind the Build: ${data.totalHours} estimated hours across ${data.categories.length} categories.`);
