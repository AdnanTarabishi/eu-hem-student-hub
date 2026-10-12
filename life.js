// Public Life guidance. City/search/route choices stay in memory; no inputs are saved or sent.
(() => {
  const page = document.body.dataset.lifePage;
  if (!page) return;
  const $ = id => document.getElementById(id);
  const cityIds = new Set(CITY_GUIDES.map(city => city.id));
  const params = new URLSearchParams(location.search);
  const state = {
    content: null, cohort: null, loading: false,
    city: cityIds.has(params.get('city')) ? params.get('city') : page === 'student' ? 'all' : 'bologna',
    track: params.get('track') || '', search: '',
  };
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const icon = id => siteIcon(id);
  const link = (label, href, cls = 'life-link', external = false) => {
    const node = make('a', cls, label); node.href = href;
    if (external) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    return node;
  };
  const cityInfo = id => {
    const city = CITY_GUIDES.find(item => item.id === id);
    const university = city && state.cohort?.universities[city.university];
    return university ? { ...university, id, university: city.university } : null;
  };
  const date = value => new Date(value + 'T12:00:00Z').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' });
  const sourceDate = source => source.status === 'verified' && source.checked ? `Page checked ${date(source.checked)}` : 'Not verified · confirm on the official page';
  const matchesCity = source => state.city === 'all' || source.city === 'all' || source.city === state.city;
  const normalise = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function publicAddress() {
    const query = new URLSearchParams();
    if (state.city !== (page === 'student' ? 'all' : 'bologna')) query.set('city', state.city);
    if (page === 'mobility' && state.track) query.set('track', state.track);
    const address = location.pathname + (query.size ? '?' + query : '') + location.hash;
    history.replaceState(null, '', address);
  }
  function guidanceLinks(entry) {
    const links = make('div', 'life-topic-links');
    for (const item of entry.related || []) links.append(link(item.label, item.href));
    if (state.city !== 'all' && cityInfo(state.city)) {
      const city = cityInfo(state.city);
      for (const section of entry.guideSections || []) {
        const title = GUIDE_SECTIONS.find(title => guideHeadingId(title) === section) || section;
        links.append(link(`${city.city}: ${title}`, `${city.guide}#${section}`));
      }
    } else if (entry.guideSections?.length) links.append(link('Compare the city guides', 'city-guide.html'));
    return links;
  }
  function citations(entry) {
    const box = make('div', 'life-topic-sources');
    for (const id of entry.sourceIds || []) {
      const source = state.content.sources.find(source => source.id === id);
      if (!source || !matchesCity(source)) continue;
      const item = make('span');
      item.append(link(source.title, '#life-source-' + source.id, ''), make('br'), make('span', null, sourceDate(source)));
      if (source.city === 'all') item.append(make('br'), make('span', 'life-citation-scope', source.note));
      box.append(item);
    }
    return box;
  }
  function drawStudent() {
    for (const topic of state.content.topics) {
      const article = $(topic.id);
      if (!article) continue;
      article.querySelector('h2').textContent = topic.title;
      article.querySelector('.life-topic-summary').textContent = topic.summary;
      const body = article.querySelector('.life-topic-body');
      const advice = make('ul', 'life-advice');
      for (const text of topic.advice) advice.append(make('li', null, text));
      const questions = make('details', 'life-question-box');
      questions.append(make('summary', null, 'Questions to ask before deciding'));
      const list = make('ul', 'life-questions');
      for (const text of topic.questions) list.append(make('li', null, text));
      questions.append(list);
      body.replaceChildren(advice, questions, guidanceLinks(topic), citations(topic));
    }
    filterTopics();
  }
  function filterTopics() {
    if (!state.content) return;
    const words = normalise(state.search.trim()).split(/\s+/).filter(Boolean);
    let count = 0;
    for (const topic of state.content.topics) {
      const text = normalise([topic.title, topic.summary, ...topic.advice, ...topic.questions].join(' '));
      const visible = words.every(word => text.includes(word));
      $(topic.id).hidden = !visible;
      if (visible) count++;
    }
    $('life-status').textContent = `${count} of ${state.content.topics.length} topics · ${state.city === 'all' ? 'All programme cities' : cityInfo(state.city)?.city || 'City information unavailable'}. City context changes links and resources; all topics apply across the programme.`;
    $('life-empty').hidden = count > 0;
    $('life-reset').disabled = !(state.search || state.city !== 'all');
  }
  function drawStages() {
    for (const stage of state.content.stages) {
      const details = $(stage.id);
      if (!details) continue;
      details.querySelector('summary strong').textContent = stage.title;
      details.querySelector('summary small').textContent = stage.kicker;
      const list = make('ul', 'life-stage-tasks');
      for (const text of stage.tasks) { const item = make('li'); item.append(icon('check'), make('span', null, text)); list.append(item); }
      details.querySelector('.life-stage-body').replaceChildren(make('p', null, stage.summary), list, guidanceLinks(stage), citations(stage));
    }
    $('life-status').textContent = `Six moving stages · ${cityInfo(state.city)?.city || 'City information unavailable'} destination context. Your checklist opens in Student Toolkit.`;
  }
  function drawCity() {
    const box = $('life-city-context');
    const city = cityInfo(state.city);
    if (!city) {
      box.replaceChildren(make('p', null, state.cohort ? 'Explore shared practical guidance, then choose a city for its local details.' : 'Local city information is unavailable. The shared guidance and existing city guides remain available.'), link('Explore all city guides', 'city-guide.html'));
      return;
    }
    const text = make('div');
    text.append(make('p', null, `${page === 'mobility' ? 'Destination' : 'City context'}: ${city.city}`), make('small', null, `${city.name} · ${city.country}`));
    box.replaceChildren(text, link(`Open the ${city.city} guide`, city.guide));
  }
  function drawSources() {
    const box = $('life-sources'); box.replaceChildren();
    const sources = state.content.sources.filter(matchesCity);
    $('life-source-count').textContent = `(${sources.length})`;
    for (const source of sources) {
      const article = make('article', 'life-source'); article.id = 'life-source-' + source.id;
      article.tabIndex = -1;
      article.append(make('span', 'life-source-city', source.city === 'all' ? 'Across destinations' : cityInfo(source.city)?.city || 'Official resource'));
      const title = make('h3'); title.append(link(source.title, source.url, '', true));
      article.append(title, make('p', null, source.note), make('p', 'life-source-date', sourceDate(source)));
      box.append(article);
    }
    if (!sources.length) box.append(make('p', 'life-muted', 'No official resource matches this city context yet. Follow the local city guide sources for further information.'));
    $('life-reviewed').textContent = `Guide editorial review: ${date(state.content.reviewed)} · Individual source checks are listed below.`;
  }
  function drawRoute() {
    const box = $('life-route');
    const track = state.cohort && trackById(state.cohort, state.track);
    if (!track) {
      box.replaceChildren(make('p', null, state.cohort ? 'Choose a track to explore its semester destinations. This selection is for browsing and does not change your saved track.' : 'The track route could not be loaded. Open Track Explorer for programme destinations.'), ...(!state.cohort ? [link('Open Track Explorer', 'tracks.html')] : []));
      return;
    }
    const list = make('ol'); list.setAttribute('aria-label', `${track.abbr} semester destinations`);
    for (const semester of [{ number:1, university:state.cohort.semester1.university }, ...track.semesters]) {
      const university = state.cohort.universities[semester.university];
      const item = make('li'); item.dataset.semester = semester.number;
      item.append(make('small', null, `Semester ${semester.number} · ${semesterTiming(state.cohort.id, semester.number).label}`), make('strong', null, university.city), link(university.name, university.guide, ''));
      list.append(item);
    }
    const thesis = make('li'); thesis.dataset.semester = '4';
    thesis.append(make('small', null, `Semester 4 · ${semesterTiming(state.cohort.id, 4).label}`), make('strong', null, 'Thesis host choice'));
    for (const [index, id] of track.thesis.entries()) {
      const university = state.cohort.universities[id];
      if (index) thesis.append(' or ');
      thesis.append(link(university.city, university.guide, ''));
    }
    list.append(thesis);
    box.replaceChildren(make('h3', null, `${track.abbr} · ${track.name}`), list, make('p', 'life-meta', `${state.cohort.id} cohort · Track information reviewed ${state.cohort.lastReviewed}. Semester labels describe the study sequence, not exact moving dates. Confirm your individual arrangements with the programme.`));
  }
  function draw() {
    drawCity();
    if (state.content) { if (page === 'student') drawStudent(); else drawStages(); drawSources(); }
    if (page === 'mobility') drawRoute();
  }
  function setChoices() {
    const select = $('life-city'); select.replaceChildren();
    if (page === 'student') { const option = make('option', null, 'All programme cities'); option.value = 'all'; select.append(option); }
    for (const guide of CITY_GUIDES) {
      const city = cityInfo(guide.id);
      if (!city) continue;
      const option = make('option', null, `${city.city} · ${city.country}`); option.value = guide.id; select.append(option);
    }
    select.value = state.city; select.disabled = !state.cohort;
    if (page === 'mobility') {
      const trackSelect = $('life-track'); trackSelect.replaceChildren();
      const placeholder = make('option', null, 'Choose a track (optional)'); placeholder.value = ''; trackSelect.append(placeholder);
      for (const track of state.cohort?.tracks || []) {
        const option = make('option', null, `${track.abbr} — ${track.name}`); option.value = track.id; trackSelect.append(option);
      }
      if (!state.cohort?.tracks.some(track => track.id === state.track)) state.track = '';
      trackSelect.value = state.track; trackSelect.disabled = !state.cohort;
    } else $('life-search').disabled = !state.content;
  }
  function revealHash() {
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!hash || !state.content) return;
    const source = state.content.sources.find(source => 'life-source-' + source.id === hash);
    if (source && !matchesCity(source)) {
      state.city = page === 'student' ? 'all' : source.city === 'all' ? state.city : source.city;
      $('life-city').value = state.city; draw(); publicAddress();
    }
    const target = $(hash);
    if (!target) return;
    let focus = target;
    if (target.matches('.life-topic')) {
      state.search = ''; $('life-search').value = ''; filterTopics();
      focus = target.querySelector('h2');
    } else if (target.matches('.life-stage')) {
      target.open = true; focus = target.querySelector('summary');
    } else if (target.matches('.life-source')) {
      target.closest('details').open = true;
    } else return;
    requestAnimationFrame(() => { target.scrollIntoView({ block:'start', behavior:'instant' }); focus.focus({ preventScroll:true }); });
  }
  function validContent(content) {
    const text = value => typeof value === 'string' && value.trim().length > 0;
    const texts = list => Array.isArray(list) && list.length > 0 && list.every(text);
    const dateValue = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
    const ids = (entries, expected) => Array.isArray(entries) && entries.length === expected.length && new Set(entries.map(item => item?.id)).size === expected.length && entries.every(item => expected.includes(item?.id));
    if (!content || content.version !== 1 || !dateValue(content.reviewed) || !ids(content.topics, ['housing','wellbeing','benefits','language','inclusion','work']) || !ids(content.stages, ['prepare','departure','arrival','settling','returning','leaving']) || !Array.isArray(content.sources) || !content.sources.length) return false;
    const sourceIds = new Set(content.sources.map(item => item?.id));
    if (sourceIds.size !== content.sources.length || !content.sources.every(item => item && text(item.id) && text(item.title) && /^https:\/\//.test(item.url) && text(item.note) && (item.city === 'all' || cityIds.has(item.city)) && (item.status === 'verified' ? dateValue(item.checked) : item.status === 'not-verified' && item.checked === null))) return false;
    const sections = new Set(GUIDE_SECTIONS.map(guideHeadingId));
    const common = item => text(item.title) && text(item.summary) && Array.isArray(item.related) && item.related.every(link => text(link.label) && text(link.href) && !/^(?:[a-z]+:|\/\/)/i.test(link.href)) && Array.isArray(item.guideSections) && item.guideSections.every(id => sections.has(id)) && Array.isArray(item.sourceIds) && item.sourceIds.every(id => sourceIds.has(id));
    return content.topics.every(item => common(item) && texts(item.advice) && texts(item.questions)) && content.stages.every(item => common(item) && text(item.kicker) && texts(item.tasks));
  }
  function validCohort(cohort) {
    if (!cohort || !Array.isArray(cohort.tracks) || !cohort.tracks.length || !cohort.universities || !cohort.semester1 || !/^\d{4}-\d{4}$/.test(cohort.id)) return false;
    const university = id => ['name','city','country','guide'].every(key => typeof cohort.universities[id]?.[key] === 'string');
    return CITY_GUIDES.every(city => university(city.university)) && university(cohort.semester1.university) && cohort.tracks.every(track => typeof track.id === 'string' && typeof track.name === 'string' && typeof track.abbr === 'string' && Array.isArray(track.semesters) && track.semesters.every(semester => Number.isInteger(semester.number) && university(semester.university)) && Array.isArray(track.thesis) && track.thesis.length && track.thesis.every(university));
  }
  async function readJson(path) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
    try { const response = await fetch(path, { signal:controller.signal }); if (!response.ok) throw new Error('Unavailable'); return await response.json(); }
    finally { clearTimeout(timeout); }
  }
  async function load() {
    if (state.loading) return;
    state.loading = true; $('life-content').setAttribute('aria-busy', 'true'); $('life-retry').disabled = true;
    const results = await Promise.allSettled([readJson('content/life-guide.json'), readJson(TRACKS_URL)]);
    const problems = [];
    if (results[0].status === 'fulfilled' && validContent(results[0].value)) state.content = results[0].value;
    else problems.push('The full guidance could not be loaded. Follow the city guides, tools and support links, or retry.');
    let cohort = null;
    if (results[1].status === 'fulfilled' && Array.isArray(results[1].value?.cohorts) && results[1].value.cohorts.length) cohort = tracksCohort(results[1].value);
    if (validCohort(cohort)) state.cohort = cohort;
    else problems.push('City and track information could not be loaded. The shared guidance remains available.');
    setChoices(); draw();
    const notice = $('life-retry').closest('.life-load-notice'); notice.hidden = !problems.length;
    $('life-load-message').textContent = problems.join(' ');
    if (!state.content) $('life-status').textContent = 'The full guide is unavailable. Existing guides, tools and support remain available below.';
    $('life-content').setAttribute('aria-busy', 'false'); state.loading = false; $('life-retry').disabled = false;
    revealHash();
  }
  $('life-city').addEventListener('change', event => { state.city = event.target.value; draw(); publicAddress(); });
  if (page === 'student') {
    $('life-search').addEventListener('input', event => { state.search = event.target.value; filterTopics(); });
    $('life-reset').addEventListener('click', () => { state.city = 'all'; state.search = ''; $('life-city').value = 'all'; $('life-search').value = ''; draw(); publicAddress(); $('life-search').focus(); });
  } else $('life-track').addEventListener('change', event => { state.track = event.target.value; drawRoute(); publicAddress(); });
  $('life-retry').addEventListener('click', load);
  window.addEventListener('hashchange', revealHash);
  document.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a[href^="#"]');
    if (anchor && anchor.hash === location.hash) revealHash();
  });
  let printDetails = [];
  window.addEventListener('beforeprint', () => { printDetails = [...document.querySelectorAll('.life-main details')].map(node => [node, node.open]); for (const [node] of printDetails) node.open = true; });
  window.addEventListener('afterprint', () => { for (const [node, open] of printDetails) node.open = open; printDetails = []; });
  load();
})();
