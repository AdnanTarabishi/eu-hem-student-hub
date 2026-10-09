// Shared course interiors. The public content and existing learner IDs remain the source of truth.
// Filters and the preparation checklist live in memory; bookmarks/progress use the existing stores.
(function (root) {
  'use strict';
  const SECTIONS = ['schedule', 'exam', 'topics', 'resources'];
  const memories = new Map();
  const el = (tag, cls, text) => createElement(tag, cls || null, text);
  const add = (parent, tag, cls, text) => { const node = el(tag, cls, text); parent.append(node); return node; };
  const clock = () => NotesSchedule.clock();
  const day = value => formatDay(value, { day: 'numeric', month: 'short', year: 'numeric' });
  const normal = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  function state(id, section) {
    const key = `${id}:${section}`;
    if (!memories.has(key)) memories.set(key, { q: '', module: '', status: '', scope: 'upcoming', kind: '', saved: false, limit: 12, checks: new Set() });
    return memories.get(key);
  }
  function button(label, action, cls = 'cw-button cw-secondary') {
    const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', action); return b;
  }
  function safeLink(label, address, cls = 'cw-link') {
    if (typeof address !== 'string' || !address.trim()) return el('span', 'cw-meta', label);
    try {
      const url = new URL(address, location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return el('span', 'cw-meta', label);
      const a = el('a', cls, label); a.href = address;
      if (url.origin !== location.origin) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      return a;
    } catch (_) { return el('span', 'cw-meta', label); }
  }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(svg.namespaceURI, 'use'); use.setAttribute('href', `icons.svg#${name}`); svg.append(use); return svg;
  }
  function intro(parent, kicker, title, text) {
    const box = add(parent, 'header', 'cw-intro'); add(box, 'p', 'cw-eyebrow', kicker);
    add(box, 'h2', 'cw-section-title', title); add(box, 'p', 'cw-lead', text); return box;
  }
  function frame(parent) {
    const box = add(parent, 'div', 'cw-layout');
    const main = add(box, 'div', 'cw-main'), aside = add(box, 'aside', 'cw-rail');
    aside.setAttribute('aria-label', 'Course guidance'); return { main, aside };
  }
  function rail(parent, title, text) {
    const box = add(parent, 'section', 'cw-rail-card'); add(box, 'h3', '', title);
    if (text) add(box, 'p', 'cw-meta', text); return box;
  }
  function facts(parent, entries) {
    const dl = add(parent, 'dl', 'cw-facts');
    for (const [label, value] of entries) { const row = add(dl, 'div'); add(row, 'dt', '', label); add(row, 'dd', '', String(value)); }
    return dl;
  }
  function empty(parent, title, text, action) {
    const box = add(parent, 'div', 'cw-empty'); box.append(icon('search')); add(box, 'h3', '', title); add(box, 'p', '', text);
    if (action) box.append(action); return box;
  }
  function source(parent, ctx, type) {
    const status = type === 'schedule' ? ctx.page.timetableState : ctx.page.examState;
    const labels = { loading: 'Checking university feed', ready: navigator.onLine ? 'University feed retrieved' : 'Offline feed copy', copy: 'Saved calendar copy', failed: 'University feed unavailable' };
    const box = add(parent, 'div', 'cw-source'); box.append(icon('info'));
    add(box, 'span', '', `${labels[status] || 'Check university sources'} · Europe/Rome`);
    const url = type === 'schedule' ? ctx.data.cohort.sources.timetableFeed.replace(/\/@@.*$/, '') : ctx.data.cohort.sources.examDates;
    box.append(safeLink('Official source ↗', url));
    if (status === 'failed' || status === 'copy') box.append(button('Retry live data', ctx.retry, 'cw-text-button'));
    return box;
  }
  function select(parent, title, options, value, change) {
    const label = add(parent, 'label', 'cw-field', title), s = add(label, 'select');
    s.setAttribute('aria-label', title);
    for (const [v, name] of options) s.add(new Option(name, v));
    s.value = value; s.addEventListener('change', () => change(s.value)); return s;
  }
  function modules(parent, ctx, s, draw) {
    if (ctx.course.modules.length < 2) return;
    return select(parent, 'Module', [['', 'All modules'], ...ctx.course.modules.map(m => [m.id, m.info.name])], s.module, v => { s.module = v; s.limit = 12; draw(); });
  }
  function search(parent, label, s, draw) {
    const wrap = add(parent, 'label', 'cw-search'); wrap.append(icon('search')); add(wrap, 'span', 'sr-only', label);
    const input = add(wrap, 'input'); input.type = 'search'; input.value = s.q; input.placeholder = label; input.setAttribute('aria-label', label);
    input.addEventListener('input', () => { s.q = input.value; s.limit = 12; draw(); }); return input;
  }
  function count(parent) { const c = add(parent, 'p', 'cw-result-count'); c.setAttribute('role', 'status'); c.setAttribute('aria-live', 'polite'); return c; }
  function more(parent, total, s, draw) {
    if (total <= s.limit) return;
    parent.append(button(`Show more (${total - s.limit} remaining)`, () => {
      const old = s.limit; s.limit += 12; draw();
      const next = parent.querySelectorAll('[data-cw-result]')[old];
      if (next) { next.tabIndex = -1; next.focus({ preventScroll: true }); next.scrollIntoView({ block: 'nearest' }); }
    }));
  }
  // Shared links must still reach entries beyond the first page of results.
  function revealLinkedEntry(s, entries, matches) {
    let hash; try { hash = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    if (!hash) return;
    const index = entries.findIndex(entry => matches(entry, hash));
    if (index < 0) return;
    s.q = s.module = s.status = s.kind = ''; s.saved = false;
    s.limit = Math.max(s.limit, Math.ceil((index + 1) / 12) * 12);
  }
  function header(ctx, active, tabs) {
    const box = el('section', 'cw-header');
    const top = add(box, 'div', 'cw-course-heading'), copy = add(top, 'div', 'cw-course-copy');
    add(copy, 'p', 'cw-eyebrow', `THE STUDY LIBRARY / ${ctx.course.code} / ${ctx.data.cohort.label}`);
    add(copy, 'h1', '', ctx.course.info.name + (ctx.course.info.integrated ? ' (I.C.)' : ''));
    const meta = add(copy, 'div', 'cw-course-meta');
    [`${ctx.course.info.cfu} CFU`, plural(ctx.course.modules.length, 'module'), `Cycle ${courseCycles(ctx.course.info)}`].forEach(t => add(meta, 'span', '', t));
    const actions = add(top, 'div', 'cw-course-actions'); actions.append(saveButton(ctx.course.id), ctx.pageLink('Course overview →', { tab: 'overview' }, 'cw-link'));
    const nav = add(box, 'nav', 'cw-tabs'); nav.setAttribute('aria-label', 'Course sections');
    for (const t of tabs) {
      const a = ctx.pageLink(t.label, { tab: t.key }, 'cw-tab');
      if (t.key === active) a.setAttribute('aria-current', 'page');
      // The existing pageLink preserves normal URLs, browser history and modified clicks.
      a.addEventListener('click', event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) queueMicrotask(() => document.getElementById('course-panel')?.focus({ preventScroll: true })); });
      nav.append(a);
    }
    requestAnimationFrame(() => { const a = nav.querySelector('[aria-current]'); if (a) nav.scrollLeft = Math.max(0, a.offsetLeft - nav.offsetLeft - 32); });
    return box;
  }
  function teachingBlocks(parent, ctx) {
    const box = rail(parent, 'Teaching blocks', 'Published module dates, not a substitute for the current timetable.');
    for (const m of ctx.course.modules) {
      const item = add(box, 'div', 'cw-module-brief'); add(item, 'h4', '', m.info.name);
      add(item, 'p', 'cw-meta', m.info.teachingStart && m.info.teachingEnd ? `${day(m.info.teachingStart)} – ${day(m.info.teachingEnd)}` : 'Teaching dates to confirm');
      add(item, 'p', 'cw-meta', (m.info.professors || []).join(', '));
      if (m.info.officialUrl) item.append(safeLink('Module information ↗', m.info.officialUrl));
    }
    add(box, 'p', 'cw-footnote', `Programme record last checked: ${ctx.data.cohort.lastChecked || 'not recorded'}.`);
  }
  function schedule(parent, ctx, params) {
    const s = state(ctx.course.id, 'schedule');
    if (params.past === '1') s.scope = 'all'; // Keep old shared links working.
    intro(parent, 'PLAN YOUR WEEK', 'Your class schedule.', 'The next session, the room and the route there. Keep the practical details together.');
    source(parent, ctx, 'schedule');
    const { main, aside } = frame(parent);
    teachingBlocks(aside, ctx);
    const tools = rail(aside, 'Keep your week in sync', 'Add a session to your calendar or open the full timetable. Always check for room and time changes.');
    tools.append(safeLink('Calendar subscriptions →', 'calendar.html'), safeLink('Full timetable →', 'timetable.html'));
    if (ctx.course.id === 'right-to-health' && root.RightToHealth?.ready()) root.RightToHealth.scheduleNotes(aside);
    const status = ctx.page.timetableState;
    if (status === 'loading') return empty(main, 'Checking the timetable…', 'Your course information is available while the university feed loads.');
    if (status !== 'ready') return empty(main, 'The timetable is temporarily unavailable.', 'This does not mean there are no classes. Open the official timetable or retry the feed.', button('Retry timetable', ctx.retry));
    const sessions = ctx.sessions().slice().sort((a, b) => a.start.localeCompare(b.start));
    const now = clock();
    const future = item => (item.end || `${item.dateKey}T23:59:59`).slice(0, 19) >= now;
    const upcoming = sessions.filter(future), next = upcoming[0];
    if (next) {
      const spot = add(main, 'section', 'cw-next-class'); add(spot, 'p', 'cw-eyebrow', next.start.slice(0, 19) <= now ? 'IN PROGRESS' : 'NEXT CLASS');
      add(spot, 'h3', '', sessionLabel(next, ctx.data.index));
      add(spot, 'p', 'cw-next-date', `${day(next.dateKey)} · ${next.time}`);
      add(spot, 'p', '', next.room || (next.online ? 'Online session' : 'Room to confirm'));
      if (next.teacher) add(spot, 'p', 'cw-meta', next.teacher);
      spot.append(sessionActions(next, ctx.data.index));
    }
    const toolbar = add(main, 'div', 'cw-toolbar');
    const scope = add(toolbar, 'div', 'cw-segmented'); scope.setAttribute('role', 'group'); scope.setAttribute('aria-label', 'Class period');
    const outputs = add(main, 'div'), summary = count(outputs), list = add(outputs, 'div', 'cw-agenda');
    const buttons = [];
    for (const [v, label] of [['upcoming', 'Upcoming'], ['all', 'All classes'], ['past', 'Past']]) {
      const b = button(label, () => { s.scope = v; s.limit = 12; draw(); }, 'cw-segment'); buttons.push([v, b]); scope.append(b);
    }
    modules(toolbar, ctx, s, draw);
    function draw() {
      buttons.forEach(([v, b]) => b.setAttribute('aria-pressed', String(s.scope === v)));
      const module = ctx.course.modules.find(m => m.id === s.module);
      const filtered = sessions.filter(item => (!module || item.moduleCode === module.info.code) && (s.scope === 'all' || (s.scope === 'past' ? !future(item) : future(item))));
      summary.textContent = `${plural(filtered.length, 'class')} · ${s.scope === 'past' ? 'completed sessions' : s.scope === 'all' ? 'whole teaching period' : 'upcoming or in progress'} · Bologna time`;
      list.replaceChildren();
      if (!filtered.length) empty(list, s.scope === 'upcoming' ? 'No upcoming sessions in this feed.' : 'No sessions match this view.', 'Check another module or the official timetable. An empty feed does not confirm a cancellation.');
      for (const item of filtered.slice(0, s.limit)) {
        const card = add(list, 'article', 'cw-session'); card.dataset.cwResult = '';
        const date = add(card, 'div', 'cw-date-stamp'); add(date, 'span', '', formatDay(item.dateKey, { weekday: 'short' })); add(date, 'strong', '', item.dateKey.slice(8)); add(date, 'span', '', formatDay(item.dateKey, { month: 'short' }));
        const body = add(card, 'div', 'cw-session-body'); add(body, 'p', 'cw-session-time', `${item.time} · ${item.dateKey.slice(0, 4)}${item.dateKey === now.slice(0, 10) ? ' · Today' : ''}`);
        add(body, 'h3', '', sessionLabel(item, ctx.data.index));
        add(body, 'p', 'cw-meta', item.room || (item.online ? 'Online' : 'Room to confirm'));
        if (item.teacher) add(body, 'p', 'cw-meta', item.teacher);
        if (item.note) add(body, 'p', 'cw-session-note', item.note);
        if (item.online && item.room) add(body, 'span', 'cw-chip', 'Online option listed');
        body.append(sessionActions(item, ctx.data.index));
      }
      more(list, filtered.length, s, draw);
    }
    draw();
  }
  function exam(parent, ctx) {
    intro(parent, 'PREPARE, THEN REGISTER', 'Your exam, in focus.', 'Separate the official arrangements from your own revision. A practice score is not an exam prediction.');
    source(parent, ctx, 'exam');
    const { main, aside } = frame(parent);
    const register = rail(aside, 'Registration happens on AlmaEsami', 'Adding a date to your calendar or changing your study-plan status does not book an exam. Confirm the exact sitting and registration deadline.');
    register.append(safeLink('Open AlmaEsami ↗', 'https://almaesami.unibo.it/almaesami/welcome.htm', 'cw-button'), safeLink('Your study plan →', 'studyplan.html'));
    const progress = rail(aside, 'Your course status', 'A personal planning aid, saved on this device—not an official enrolment record.'); progress.append(ctx.planStatusBox());
    const prep = rail(aside, 'Before exam day', 'A preparation checklist for this open page. It is not saved or submitted.');
    const s = state(ctx.course.id, 'exam');
    ['Read the current assessment instructions', 'Review the syllabus and your uncertain topics', 'Practise without looking at the answer', 'Confirm registration, time and room'].forEach((text, i) => {
      const label = add(prep, 'label', 'cw-check'); const input = add(label, 'input'); input.type = 'checkbox'; input.checked = s.checks.has(i); add(label, 'span', '', text);
      input.addEventListener('change', () => input.checked ? s.checks.add(i) : s.checks.delete(i));
    });
    const status = ctx.page.examState;
    if (status === 'loading') empty(main, 'Checking exam dates…', 'Assessment information is available below while dates load.');
    else if (status === 'failed') empty(main, 'Exam dates could not be retrieved.', 'No conclusion about published sittings can be drawn from a connection failure. Check AlmaEsami or the university exam page.', button('Retry exam dates', ctx.retry));
    else {
      if (status === 'copy') add(main, 'p', 'cw-notice', 'These dates come from the existing exported calendar, not a successful live check. Times and registration windows must be confirmed on AlmaEsami.');
      const now = clock(), today = now.slice(0, 10);
      const exams = ctx.exams().filter(e => e.dateKey >= today).sort((a, b) => `${a.dateKey}T${a.time || '23:59'}`.localeCompare(`${b.dateKey}T${b.time || '23:59'}`));
      const list = add(main, 'div', 'cw-exams');
      if (!exams.length) empty(list, 'No current or future sittings in this source.', 'The assessment format below is separate from the exam-date feed. Recheck the official platforms for new sittings.');
      exams.forEach((e, i) => {
        const card = add(list, 'article', `cw-exam-card${i === 0 ? ' cw-exam-next' : ''}`);
        add(card, 'p', 'cw-eyebrow', i === 0 ? (e.dateKey === today ? 'TODAY · CONFIRM THE SITTING' : 'NEXT LISTED SITTING') : 'ANOTHER LISTED SITTING');
        add(card, 'h3', '', day(e.dateKey)); add(card, 'p', 'cw-exam-title', e.title);
        facts(card, [['Start time', e.time ? `${e.time} · Europe/Rome` : 'Not confirmed'], ['Location', e.place || 'To be confirmed'], ['Type', e.type || 'Check assessment instructions']]);
        const registration = registrationText(e, today);
        add(card, 'p', `cw-registration${registration?.open && status === 'ready' ? ' is-open' : ''}`, status === 'copy' ? 'Registration status not confirmed from this copy.' : registration?.text || 'Registration window not available here. Check AlmaEsami.');
        if (status === 'ready') {
          card.append(examActions(e, today));
          add(card, 'p', 'cw-footnote', e.time ? 'Calendar end time is estimated; it is not the exam duration.' : 'Calendar export uses 09:00 as a placeholder; confirm the start time.');
        } else card.append(safeLink('Confirm this sitting ↗', 'https://almaesami.unibo.it/almaesami/welcome.htm'));
      });
    }
    const assessment = add(main, 'section', 'cw-assessment'); add(assessment, 'h3', '', 'How is this course assessed?');
    add(assessment, 'p', 'cw-meta', 'From the existing course record. Follow any newer instructions published by your teaching team.');
    for (const m of ctx.course.modules) {
      const box = add(assessment, 'article', 'cw-assessment-module'); add(box, 'h4', '', m.info.name);
      add(box, 'p', '', m.info.assessment || 'The assessment format is not recorded here yet. Check the official course page.');
      if (m.info.officialUrl) box.append(safeLink('Check module assessment ↗', m.info.officialUrl));
    }
    if (ctx.course.id === 'right-to-health' && root.RightToHealth?.ready()) {
      const notes = add(main, 'details', 'cw-disclosure'); add(notes, 'summary', '', 'Course-specific exam and contact notes'); root.RightToHealth.organisation(notes);
    }
    const actions = add(main, 'div', 'cw-study-actions');
    actions.append(ctx.pageLink('Review course topics →', { tab: 'topics' }, 'cw-button cw-secondary'));
    if (ctx.course.questions.length || ctx.course.flashcards.length) actions.append(ctx.pageLink('Open practice →', { tab: 'practice' }, 'cw-button'));
  }
  function topics(parent, ctx) {
    const s = state(ctx.course.id, 'topics'), p = loadProgress(), course = ctx.course;
    revealLinkedEntry(s, course.topics, (t, hash) => hash === `topic-${t.id}` || hash === `module-${moduleIdOf(t.id)}`);
    intro(parent, 'UNDERSTAND THE COURSE', 'One topic at a time.', 'Explore the syllabus, see what is ready to study, and track your understanding—one topic at a time.');
    const { main, aside } = frame(parent);
    const available = t => Boolean(ctx.notes[t.id] || t.lecture);
    const ready = course.topics.filter(available), seen = ready.filter(t => getTopicStatus(p, t.id)), understood = ready.filter(t => getTopicStatus(p, t.id) === 'understood');
    const progress = rail(aside, 'Your learning trail', 'Self-reported progress on this device. It is not a test of exam readiness.');
    const bar = add(progress, 'progress', 'cw-progress'); bar.max = Math.max(ready.length, 1); bar.value = seen.length; bar.setAttribute('aria-label', `${seen.length} of ${ready.length} available topics read or understood`);
    facts(progress, [['Available topics', ready.length], ['Read or understood', seen.length], ['Understood', understood.length]]);
    const next = ready.find(t => getTopicStatus(p, t.id) !== 'understood');
    if (next) { add(progress, 'p', 'cw-eyebrow', 'SUGGESTED NEXT STEP'); add(progress, 'p', 'cw-next-topic', next.title); progress.append(topicAction(next, ctx, 'Continue learning →')); }
    const loop = rail(aside, 'A simple study loop');
    const ol = add(loop, 'ol', 'cw-steps'); ['Read the explanation in your own time.', 'Try a question before revealing the answer.', 'Return to anything that still feels unclear.'].forEach(t => add(ol, 'li', '', t));
    loop.append(safeLink('Saved study list →', 'notes.html?tab=study-list'), safeLink('Share an original resource →', 'contact.html'));
    const toolbar = add(main, 'div', 'cw-discovery'); const q = search(toolbar, 'Search topics or a concept…', s, draw);
    const filters = add(toolbar, 'div', 'cw-toolbar'); const module = modules(filters, ctx, s, draw);
    const status = select(filters, 'Progress', [['', 'Any progress'], ['new', 'Not started'], ['read', 'Read'], ['understood', 'Understood'], ['available', 'Study material available']], s.status, v => { s.status = v; s.limit = 12; draw(); });
    filters.append(button('Clear filters', () => { s.q = s.module = s.status = ''; s.limit = 12; q.value = ''; if (module) module.value = ''; status.value = ''; draw(); q.focus(); }, 'cw-text-button'));
    const summary = count(main), list = add(main, 'div', 'cw-topic-list');
    function draw() {
      list.replaceChildren(); const progress = loadProgress();
      const filtered = course.topics.filter(t => (!s.module || moduleIdOf(t.id) === s.module) && normal(t.title).includes(normal(s.q)) && (!s.status || (s.status === 'available' ? available(t) : s.status === 'new' ? !getTopicStatus(progress, t.id) : getTopicStatus(progress, t.id) === s.status)));
      summary.textContent = `${filtered.length} of ${plural(course.topics.length, 'topic')} · ${plural(ready.length, 'topic')} with study material`;
      if (!filtered.length) empty(list, course.topics.length ? 'No topics match these filters.' : 'The topic list is not available yet.', course.topics.length ? 'Try a broader search or clear the filters.' : 'Use the Resources tab to open the official syllabus and teaching materials.');
      let last = '';
      filtered.slice(0, s.limit).forEach(t => {
        const m = ctx.course.modules.find(m => m.id === moduleIdOf(t.id));
        if (m && m.id !== last) { const h = add(list, 'h3', 'cw-module-label', m.info.name); h.id = `module-${m.id}`; last = m.id; }
        const card = add(list, 'article', 'cw-topic-card'); card.dataset.cwResult = ''; card.id = `topic-${t.id}`;
        add(card, 'span', 'cw-topic-number', String(course.topics.indexOf(t) + 1).padStart(2, '0'));
        const body = add(card, 'div', 'cw-topic-body'); const top = add(body, 'div', 'cw-card-top');
        const h = add(top, 'h4'); h.append(topicAction(t, ctx)); top.append(saveButton(t.id));
        const notes = ctx.notes[t.id], meta = add(body, 'div', 'cw-tags');
        if (notes) add(meta, 'span', 'cw-chip', `${readingMinutes(notes)} min read`);
        if (t.lecture) add(meta, 'span', 'cw-chip', 'Interactive guide');
        const questions = course.questions.filter(q => q.topic === t.id).length, cards = course.flashcards.filter(c => c.topic === t.id).length;
        if (questions) add(meta, 'span', 'cw-chip', plural(questions, 'question'));
        if (cards) add(meta, 'span', 'cw-chip', plural(cards, 'flashcard'));
        if (!available(t)) add(body, 'p', 'cw-meta', t.status === 'upcoming' ? 'Upcoming topic · study material not added yet.' : 'Syllabus topic · no study material added yet.');
        if (notes?.meta.sample) body.append(sampleTag());
        const bottom = add(body, 'div', 'cw-topic-bottom');
        const current = getTopicStatus(progress, t.id); add(bottom, 'span', `cw-topic-status ${current ? 'is-started' : ''}`, `${STATUS_ICONS[current]} ${STATUS_LABELS[current]}`);
        if (available(t)) bottom.append(topicAction(t, ctx, 'Open topic →'));
        if (t.lecture && notes) bottom.append(safeLink('Interactive guide →', lectureUrl(t.id)));
        if (t.virtualeUrl && !available(t)) bottom.append(safeLink('Find on Virtuale ↗', t.virtualeUrl));
      });
      more(list, filtered.length, s, draw);
    }
    draw();
  }
  function topicAction(topic, ctx, label) {
    if (ctx.notes[topic.id]) return ctx.pageLink(label || topic.title, { tab: 'topics', topic: topic.id }, 'cw-link');
    if (topic.lecture) return safeLink(label || topic.title, lectureUrl(topic.id));
    return el('span', '', label || topic.title);
  }
  function kind(resource) {
    if (resource.sample) return 'sample';
    if (!resource.url) return 'reference';
    try {
      const url = new URL(resource.url, location.href);
      if (url.hostname === 'unibo.it' || url.hostname.endsWith('.unibo.it')) return 'university';
      if (url.origin === location.origin || (url.hostname === 'adnantarabishi.github.io' && url.pathname.startsWith('/eu-hem-student-hub/'))) return 'hub';
    } catch (_) { return 'reference'; }
    return 'external';
  }
  const KIND_LABELS = { university: 'University', hub: 'Student Hub', external: 'External reading', reference: 'Reference only', sample: 'Example content' };
  function resources(parent, ctx) {
    const s = state(ctx.course.id, 'resources'), entries = ctx.course.resources;
    revealLinkedEntry(s, entries, (r, hash) => hash === r.id);
    intro(parent, 'THE RIGHT SOURCE, FASTER', 'Your course resource shelf.', 'Official materials first. Student-made tools and supporting references alongside them, clearly labelled.');
    const official = add(parent, 'section', 'cw-official'); add(official, 'p', 'cw-eyebrow', 'START WITH THE ORIGINAL');
    const pins = add(official, 'div', 'cw-official-grid');
    const modules = ctx.course.modules;
    for (const m of modules) {
      const card = add(pins, 'article', 'cw-official-card'); card.append(icon('library')); add(card, 'h3', '', m.info.name);
      add(card, 'p', 'cw-meta', 'Official slides, recordings and lecturer announcements stay on university platforms.');
      const links = add(card, 'div', 'cw-study-actions');
      links.append(safeLink('Virtuale ↗', m.info.virtualeUrl || ctx.data.programme.programme.virtualeUrl, 'cw-button cw-secondary'));
      if (m.info.officialUrl || ctx.course.info.officialUrl) links.append(safeLink('Course syllabus ↗', m.info.officialUrl || ctx.course.info.officialUrl));
      add(card, 'p', 'cw-footnote', 'University sign-in may be required.');
    }
    const { main, aside } = frame(parent);
    const note = rail(aside, 'Know what you are opening');
    const dl = add(note, 'dl', 'cw-source-key');
    [['University', 'Links to university platforms—not copied lectures.'], ['Student Hub', 'Original, supplementary tools—not official assessed work.'], ['External reading', 'A reference link, not a claim that it is required or lecturer-approved.'], ['Example content', 'Layout examples; not real study contributions.']].forEach(([a, b]) => { add(dl, 'dt', '', a); add(dl, 'dd', '', b); });
    const share = rail(aside, 'Make the shelf more useful', 'Share your own notes or a public link. Do not upload official slides, answer keys or someone else’s copyrighted material.');
    share.append(safeLink('Suggest a resource →', 'contact.html'), safeLink('Create a study item →', `create.html?course=${encodeURIComponent(ctx.course.id)}`));
    if (ctx.course.id === 'right-to-health' && root.RightToHealth?.ready()) root.RightToHealth.resourceCaveat(aside);
    const toolbar = add(main, 'div', 'cw-discovery'); const q = search(toolbar, 'Search resources, source or topic…', s, draw);
    const controls = add(toolbar, 'div', 'cw-toolbar');
    const type = select(controls, 'Source type', [['', 'All source types'], ...Object.entries(KIND_LABELS).filter(([k]) => entries.some(r => kind(r) === k))], s.kind, value => { s.kind = value; s.limit = 12; draw(); });
    const saved = button('Saved only', () => { s.saved = !s.saved; s.limit = 12; draw(); }, 'cw-filter-toggle'); controls.append(saved);
    controls.append(button('Clear filters', () => { s.q = s.kind = ''; s.saved = false; s.limit = 12; q.value = ''; type.value = ''; draw(); q.focus(); }, 'cw-text-button'));
    const summary = count(main), list = add(main, 'div', 'cw-resource-grid');
    function draw() {
      saved.setAttribute('aria-pressed', String(s.saved));
      const savedIds = getStudyList();
      const filtered = entries.filter(r => (!s.kind || kind(r) === s.kind) && (!s.saved || savedIds.some(entry => entry.id === r.id)) && normal([r.title, r.description, r.type, r.url, r.topic ? ctx.topicTitle(r.topic) : ''].join(' ')).includes(normal(s.q)));
      summary.textContent = `${filtered.length} of ${plural(entries.length, 'resource')}${s.saved ? ' · saved on this device' : ' · curated links and references'}`;
      list.replaceChildren();
      if (!filtered.length) empty(list, entries.length ? 'Nothing matches this view yet.' : 'No additional resources have been added yet.', s.saved ? 'Save a resource using its bookmark, or turn off Saved only.' : 'The official materials above are still available. Try another search or suggest a useful source.');
      for (const r of filtered.slice(0, s.limit)) {
        const k = kind(r), card = add(list, 'article', 'cw-resource-card'); card.id = r.id; card.dataset.cwResult = '';
        const head = add(card, 'div', 'cw-card-top'); add(head, 'span', `cw-source-badge cw-source-${k}`, KIND_LABELS[k]);
        const save = saveButton(r.id); head.append(save);
        // Refilter after the existing bookmark handler runs; never rewrite the saved-list format.
        save.addEventListener('click', () => { if (s.saved) { draw(); saved.focus({ preventScroll: true }); } });
        const h = add(card, 'h3'); h.append(r.url ? safeLink(r.title, r.url, 'cw-resource-title') : el('span', '', r.title));
        if (r.description) add(card, 'p', '', r.description);
        if (r.sample) card.append(sampleTag());
        if (r.topic) { const topic = add(card, 'p', 'cw-resource-topic'); topic.append(ctx.topicLink(r.topic)); }
        const meta = [r.type];
        if (r.date) meta.push(`Added ${day(r.date)}`);
        if (r.contributor) meta.push(`Shared by ${r.contributor}`);
        add(card, 'p', 'cw-footnote', meta.filter(Boolean).join(' · '));
        const bottom = add(card, 'div', 'cw-resource-bottom');
        if (r.url) {
          let host = ''; try { host = new URL(r.url, location.href).hostname; } catch (_) { /* Invalid URL stays non-clickable. */ }
          add(bottom, 'span', 'cw-meta', host); bottom.append(safeLink(k === 'hub' ? 'Open tool →' : 'Open resource ↗', r.url));
        } else add(bottom, 'span', 'cw-meta', 'Reference entry · no file or external link supplied');
      }
      more(list, filtered.length, s, draw);
    }
    draw();
  }
  function render(parent, tab, params, ctx) {
    if (!SECTIONS.includes(tab) || (tab === 'topics' && params.topic)) return false;
    parent.classList.add('cw-panel'); parent.dataset.section = tab;
    ({ schedule, exam, topics, resources })[tab](parent, ctx, params); return true;
  }
  root.CourseWorkspace = { header, render, handles: tab => SECTIONS.includes(tab), kind };
})(window);
