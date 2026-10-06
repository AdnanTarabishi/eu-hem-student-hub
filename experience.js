/* A source overview for external stories; full article layout for reviewed student contributions. */
(function () {
  'use strict';
  const EX = window.EUHEMExperiences, UI = window.EUHEMExperienceUI;
  if (!EX || !UI || document.body.dataset.exPage !== 'story') return;
  const params = new URLSearchParams(UI.queryString()); const id = params.get('id') || ''; const container = document.getElementById('ex-story'); const aside = document.getElementById('ex-detail-aside');
  const returnQuery = (params.get('return') || '').slice(0, 1000);
  if (returnQuery) { const allowed = new URLSearchParams(returnQuery), kept = new URLSearchParams(); ['q', 'city', 'track', 'topic', 'stage', 'source', 'saved', 'sort', 'page'].forEach(function (k) { if (allowed.has(k)) kept.set(k, allowed.get(k).slice(0, 200)); }); document.getElementById('ex-back-library').href = 'experiences.html?' + kept.toString(); }
  function unavailable(failed) {
    const error = EX.el('div', 'ex-error'); error.appendChild(EX.icon('compass')); error.appendChild(EX.el('h1', '', failed ? 'This story is taking a little longer.' : 'This experience isn’t available.')); error.appendChild(EX.el('p', '', failed ? 'Check your connection, then try reopening the experience.' : 'The link may have changed or the experience may no longer be published. You can explore the rest of the collection.')); error.appendChild(EX.link('Back to experiences', 'experiences.html', 'ex-button-secondary')); container.replaceChildren(error); container.setAttribute('aria-busy', 'false'); aside.hidden = true;
  }
  async function start() {
    try {
      const stories = await UI.loadCollection(), story = stories.find(function (s) { return s.id === id; }); if (!story) return unavailable(false);
      document.title = story.title + ' · EU-HEM Student Hub'; document.getElementById('ex-breadcrumb-name').textContent = story.author.displayName;
      EX.renderStory(container, story, { preview: false }); container.setAttribute('aria-busy', 'false');
      const image = EX.el('img', 'ex-aside-image'); image.src = UI.assetUrl(story.illustration); image.alt = 'Decorative illustration inspired by the EU-HEM cities'; image.width = 1000; image.height = 600; aside.appendChild(image);
      const toc = EX.el('section', 'ex-aside-card'); toc.appendChild(EX.el('h2', '', story.kind === 'external' ? 'In this overview' : 'In this experience')); const nav = EX.el('nav'); nav.setAttribute('aria-label', 'Sections in this experience');
      container.querySelectorAll('section[id]').forEach(function (section) { const heading = section.querySelector('h2'); if (heading) nav.appendChild(EX.link(heading.textContent, '#' + section.id)); }); toc.appendChild(nav); if (nav.children.length) aside.appendChild(toc);
      const actions = EX.el('section', 'ex-aside-card'); actions.appendChild(EX.el('h2', '', 'Keep this perspective')); const controls = EX.el('div', 'ex-actions'); const save = EX.el('button', 'ex-button-secondary', 'Save story'); save.type = 'button'; save.prepend(EX.icon('save')); save.setAttribute('aria-pressed', String(UI.savedIds().includes(story.id))); save.addEventListener('click', function () { UI.toggleSave(story.id); save.setAttribute('aria-pressed', String(UI.savedIds().includes(story.id))); }); controls.appendChild(save);
      const share = EX.el('button', 'ex-button-secondary', 'Copy link'); share.type = 'button'; share.prepend(EX.icon('share')); share.addEventListener('click', async function () { const canonical = window.EUHEM_PREVIEW_QUERY !== undefined ? story.source && EX.safeUrl(story.source.url) || 'https://adnantarabishi.github.io/eu-hem-student-hub/experience.html?id=' + encodeURIComponent(story.id) : new URL('experience.html?id=' + encodeURIComponent(story.id), location.href).href; try { await navigator.clipboard.writeText(canonical); UI.toast('Story link copied.'); } catch (_) { UI.toast('Copy the story link from your browser’s address bar.'); } }); controls.appendChild(share); actions.appendChild(controls); actions.appendChild(EX.el('p', '', 'Bookmarks are saved on this device. They do not create an account.')); aside.appendChild(actions);
      const resources = EX.el('section', 'ex-aside-card'); resources.appendChild(EX.el('h2', '', 'Plan your own next step')); const links = EX.el('nav'); links.setAttribute('aria-label', 'Related Student Hub resources'); EX.actualCities(story).forEach(function (city) { links.appendChild(EX.link(EX.CITIES[city].name + ' city guide', 'city-guide.html?city=' + city)); }); links.appendChild(EX.link('Explore EU-HEM tracks', 'tracks.html')); links.appendChild(EX.link('Share your experience', 'share-experience.html')); links.appendChild(EX.link('Request a correction', 'contact.html')); resources.appendChild(links); aside.appendChild(resources);
      const related = stories.filter(function (s) { return s.id !== id; }).map(function (s) { return { story: s, score: (s.track && s.track === story.track ? 3 : 0) + (s.topics || []).filter(function (t) { return (story.topics || []).includes(t); }).length + EX.actualCities(s).filter(function (c) { return EX.actualCities(story).includes(c); }).length }; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
      const relatedGrid = document.getElementById('ex-related-grid'); related.forEach(function (r) { relatedGrid.appendChild(UI.card(r.story)); }); document.getElementById('ex-related').hidden = !related.length;
    } catch (_) { unavailable(true); }
  }
  start();
})();
