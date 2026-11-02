// A connected practice workspace. The caller supplies its namespaced Notes storage adapter.
(function (root) {
  'use strict';
  const K = root.FundQuizCore;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = { mcq: 'Single choice', 'multi-select': 'Select all that apply', numeric: 'Calculation', written: 'Written interpretation' };
  const clock = seconds => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;
  const button = (id, label, secondary = false, attributes = '') => `<button type="button" id="${id}" class="fs-button${secondary ? ' fs-secondary' : ''}" ${attributes}>${label}</button>`;
  function mount(container, options) {
    const bank = K.normalize(options.questions, options.bank), lookup = new Map(bank.map(q => [q.id, q]));
    const topics = options.topics || [], topicName = id => topics.find(t => t.id === id)?.title || id;
    let unavailable = false, destroyed = false, timer = null, panel = 'setup', validation = '';
    let stored; try { stored = options.storage.read(); } catch (_) { unavailable = true; }
    let state = K.repair(stored, bank);
    const initialTopic = topics.some(topic => topic.id === options.initialTopic) ? options.initialTopic : '';
    const settings = { topic: initialTopic || 'all', type: 'all', difficulty: 'all', scope: 'all', count: '10', mode: 'learn', extra: initialTopic === 'fund-statistics.two-means', minutes: '0' };
    const save = activity => { try { if (options.storage.save(state, activity) === false) unavailable = true; } catch (_) { unavailable = true; } };
    const q = selector => container.querySelector(selector);
    const on = (selector, event, handler) => q(selector)?.addEventListener(event, handler);
    const remaining = () => state.active?.deadline === null ? null : Math.max(0, Math.ceil((state.active.deadline - Date.now()) / 1000));
    const needsReview = id => state.records[id] && (!state.records[id].lastCorrect || state.records[id].lastAssisted);
    const answered = (item, value) => !['empty', 'invalid'].includes(K.grade(item, value).status);
    const feedbackAllowed = id => state.active.finished !== null || (state.active.mode === 'learn' && state.active.checked[id]);
    function expire() {
      if (state.active && state.active.finished === null && state.active.deadline !== null && remaining() === 0) {
        K.finish(state, bank, Date.now(), true); save(true); panel = 'results'; return true;
      }
      return false;
    }
    function heading(title, description) {
      return `<div class="fs-heading"><div><p class="fs-kicker">Learn by solving · original student practice</p><h3 tabindex="-1" class="fsq-heading">${title}</h3><p>${description}</p></div></div>`;
    }
    function pool() {
      return bank.filter(item => (settings.extra || !item.supplementary) &&
        (settings.topic === 'all' || item.topic === settings.topic) && (settings.type === 'all' || item.type === settings.type) &&
        (settings.difficulty === 'all' || item.difficulty === settings.difficulty) &&
        (settings.scope === 'all' || settings.scope === 'new' && !state.records[item.id] && !state.written[item.id] || settings.scope === 'missed' && needsReview(item.id)));
    }
    function setup() {
      const records = Object.values(state.records), independent = records.filter(r => !r.lastAssisted);
      return heading('Build a session around what you need next.', 'Learn with feedback after each check, or hide all solutions until you submit a self-test. Your answers stay on this device and share the Notes progress backup.') +
        `<dl class="fs-stats" id="fsq-dashboard-stats"><div><dt>Auto-marked questions attempted</dt><dd>${records.length}</dd></div><div><dt>Latest independent checks correct</dt><dd>${independent.filter(r => r.lastCorrect).length} / ${independent.length}</dd></div><div><dt>Missed or supported: revisit</dt><dd>${records.filter(r => !r.lastCorrect || r.lastAssisted).length}</dd></div></dl>
        <p class="fs-meta">Independent checks exclude answers supported by a hint. First submissions count once per question per session; correcting a learning answer does not erase its first miss. Written responses are self-assessed separately.</p>
        ${state.active ? `<div class="fsq-resume fs-card"><h4>${state.active.finished === null ? 'Your saved session is ready to resume.' : 'Your last session is available to review.'}</h4><p>${state.active.ids.length} questions · ${state.active.mode === 'test' ? 'Self-test' : 'Learn'}${state.active.finished === null && state.active.deadline ? ' · its original timer continues' : ''}</p>${button('fsq-resume', state.active.finished === null ? 'Resume saved session' : 'Review last results')}${state.active.finished === null ? button('fsq-submit-saved', 'Submit saved session', true) : ''}</div>` : ''}
        <section class="fs-card" aria-labelledby="fsq-setup-title"><h4 id="fsq-setup-title">Choose your practice</h4><div class="fs-filter fsq-setup">
        <label for="fsq-mode">Feedback<select id="fsq-mode"><option value="learn">Learn · check each answer</option><option value="test">Self-test · feedback after submission</option></select></label>
        <label for="fsq-topic">Topic<select id="fsq-topic"><option value="all">All selected topics</option>${topics.map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}</select></label>
        <label for="fsq-type">Question type<select id="fsq-type"><option value="all">Mixed types</option>${Object.entries(labels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <label for="fsq-difficulty">Difficulty<select id="fsq-difficulty"><option value="all">Any difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
        <label for="fsq-scope">Review focus<select id="fsq-scope"><option value="all">All questions</option><option value="new">Not attempted yet</option><option value="missed">Missed or hint-supported</option></select></label>
        <label for="fsq-count">Session length<select id="fsq-count"><option value="10">10 questions</option><option value="20">20 questions</option><option value="all">All matching questions</option></select></label>
        <label for="fsq-timer">Timer<select id="fsq-timer"><option value="0">No timer</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select></label></div>
        <label class="fund-check"><input type="checkbox" id="fsq-extra">Include additional Topic 6 and supplementary context</label>
        <p id="fsq-pool-count" class="fs-meta" role="status"></p><p class="fs-meta">The default covers core Topics 1–5. Selection balances topics and question types where available; question and option order stay fixed throughout your session. These are original revision questions, not an official exam or a grade prediction.</p>
        ${button('fsq-start', 'Start practice session')}<p id="fsq-validation" role="status" class="fsq-validation">${esc(validation)}</p></section>
        <section class="fs-card"><h4>Your topic review</h4><div class="table-wrap"><table id="fsq-topic-progress"><thead><tr><th>Topic</th><th>Attempted</th><th>Latest independent accuracy</th><th>Revisit</th></tr></thead><tbody>${topics.map(t => {
          const items = bank.filter(item => item.topic === t.id && state.records[item.id]), usable = items.filter(item => !state.records[item.id].lastAssisted), correct = usable.filter(item => state.records[item.id].lastCorrect).length;
          return `<tr><th scope="row"><a href="${esc(options.topicLink(t.id))}">${esc(topicName(t.id))}</a></th><td>${items.length}</td><td>${usable.length ? `${correct}/${usable.length} (${Math.round(100 * correct / usable.length)}%)${usable.length < 3 ? ' · small sample' : ''}` : 'No independent check yet'}</td><td>${items.filter(item => needsReview(item.id)).length}</td></tr>`;
        }).join('')}</tbody></table></div><p class="fs-meta">Accuracy describes your latest submitted auto-marked answer to each question. It is not mastery or an exam forecast. Hint-supported answers remain in review until an independent attempt.</p></section>`;
    }
    function bindSetup() {
      for (const [key, id] of Object.entries({ mode: 'fsq-mode', topic: 'fsq-topic', type: 'fsq-type', difficulty: 'fsq-difficulty', scope: 'fsq-scope', count: 'fsq-count', minutes: 'fsq-timer' })) {
        q('#' + id).value = settings[key];
        on('#' + id, 'change', event => { settings[key] = event.target.value; if (key === 'topic' && settings.topic === 'fund-statistics.two-means') { settings.extra = true; q('#fsq-extra').checked = true; } updatePool(); });
      }
      q('#fsq-extra').checked = settings.extra;
      on('#fsq-extra', 'change', event => { settings.extra = event.target.checked; updatePool(); });
      on('#fsq-start', 'click', () => {
        if (state.active && state.active.finished === null) { q('#fsq-validation').textContent = 'Resume or submit your saved session before starting another.'; return; }
        const available = pool(), size = settings.count === 'all' ? available.length : Math.min(Number(settings.count), available.length);
        if (!size) return;
        state.active = K.createSession(K.balanced(available, size), settings); save(true); panel = 'session'; validation = ''; render(true);
      });
      on('#fsq-resume', 'click', () => { panel = state.active.finished === null ? 'session' : 'results'; render(true); });
      on('#fsq-submit-saved', 'click', submit); updatePool();
    }
    function updatePool() {
      const available = pool(), n = settings.count === 'all' ? available.length : Math.min(Number(settings.count), available.length);
      q('#fsq-pool-count').textContent = available.length ? `${available.length} matching questions · ${n} will be selected.` : 'No questions match. Broaden the topic, type or review filters.';
      q('#fsq-start').disabled = !available.length;
    }
    function answerControls(item, disabled = false) {
      const a = state.active, value = a.drafts[item.id];
      if (item.type === 'numeric') return `<label for="fsq-answer">Your numerical answer${item.unit ? ` (${esc(item.unit)})` : ''}<input id="fsq-answer" type="text" inputmode="decimal" autocomplete="off" value="${esc(value)}" ${disabled ? 'disabled' : ''} aria-describedby="fsq-answer-help fsq-validation"></label><p class="fs-meta" id="fsq-answer-help">Use a decimal point; scientific notation is accepted. Absolute rounding tolerance: ±${esc(item.tolerance)}${item.unit ? ' ' + esc(item.unit) : ''}. Do not add a unit or percent sign.</p>`;
      if (item.type === 'written') return `<label for="fsq-answer">Your interpretation<textarea id="fsq-answer" rows="6" maxlength="8000" ${disabled ? 'readonly' : ''}>${esc(value)}</textarea></label><p class="fs-meta">No automatic marking: compare your draft with the model and concrete rubric after checking or submission.</p>`;
      return `<fieldset class="fsq-choices"><legend>${item.type === 'multi-select' ? 'Select every correct statement. All selections must match; no partial credit.' : 'Choose one answer.'}</legend>${a.order[item.id].map((original, display) => {
        const selected = item.type === 'multi-select' ? value.includes(original) : value === original;
        return `<label><input type="${item.type === 'multi-select' ? 'checkbox' : 'radio'}" name="fsq-choice" data-option="${original}" value="${original}" ${selected ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="fsq-option-letter">${String.fromCharCode(65 + display)}</span><span>${esc(item.options[original])}</span></label>`;
      }).join('')}</fieldset>`;
    }
    function feedback(item) {
      const a = state.active, result = K.grade(item, a.finished === null ? a.drafts[item.id] : a.first[item.id]?.given);
      const correctText = item.type === 'mcq' ? item.options[item.answer] : item.type === 'multi-select' ? item.answer.map(i => item.options[i]).join('; ') : item.type === 'numeric' ? `${item.answer}${item.unit ? ' ' + item.unit : ''}` : item.answer;
      return `<section class="fsq-feedback" id="fsq-feedback" tabindex="-1" data-result="${result.status}" aria-label="Answer explanation"><h4>${item.type === 'written' ? 'Compare and self-assess' : result.correct ? 'Correct on this check' : result.status === 'empty' ? 'Unanswered' : 'Revisit this answer'}</h4>
        <p><strong>${item.type === 'written' ? 'Model interpretation' : 'Expected answer'}:</strong> ${esc(correctText)}</p><p>${esc(item.explanation)}</p>
        ${item.rationales.length ? `<h5>Why each option is right or wrong</h5><ul>${a.order[item.id].map(i => `<li><strong>${esc(item.options[i])}</strong> — ${esc(item.rationales[i])}</li>`).join('')}</ul>` : ''}
        ${item.steps.length ? `<ol>${item.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>` : ''}
        ${item.type === 'written' ? `<fieldset class="fsq-rubric"><legend>Tick only the points your draft includes · self-assessment</legend>${item.rubric.map((point, i) => `<label class="fund-check"><input type="checkbox" data-rubric="${i}" ${a.rubrics[item.id]?.[i] ? 'checked' : ''}>${esc(point)}</label>`).join('')}</fieldset>` : ''}
        ${a.first[item.id]?.assisted ? '<p><strong>Hint-supported first attempt.</strong> It remains in your review list until a later independent attempt.</p>' : ''}
        ${a.finished === null && a.first[item.id] && a.first[item.id].correct !== result.correct ? '<p class="fs-meta">Your first submission is kept for this session’s results; this corrected check does not replace it.</p>' : ''}
        <p class="fs-meta">${esc(item.source || 'Original student practice')}</p><a href="${esc(options.topicLink(item.topic))}">Review this topic →</a></section>`;
    }
    function sessionPage() {
      const a = state.active, item = lookup.get(a.ids[a.index]), done = feedbackAllowed(item.id);
      const answeredCount = a.ids.filter(id => answered(lookup.get(id), a.drafts[id])).length;
      return heading(a.mode === 'test' ? 'Self-test: solutions stay hidden until submission.' : 'Learn: commit an answer, then study the explanation.', `${a.ids.length} questions · ${answeredCount} answered · ${Object.values(a.flags).filter(Boolean).length} flagged`) +
        `<div class="fsq-toolbar"><strong>Question ${a.index + 1} of ${a.ids.length}</strong><output id="fsq-clock" aria-label="Time remaining">${a.deadline ? clock(remaining()) : 'Untimed'}</output>${button('fsq-dashboard', 'Save & return to setup', true)}</div>
        <nav class="fsq-map" aria-label="Questions in this session">${a.ids.map((id, i) => `<button type="button" data-index="${i}" ${a.index === i ? 'aria-current="step"' : ''} aria-label="Question ${i + 1}${answered(lookup.get(id), a.drafts[id]) ? ', answered' : ', unanswered'}${a.flags[id] ? ', flagged' : ''}" class="${answered(lookup.get(id), a.drafts[id]) ? 'is-answered' : ''}">${i + 1}${a.flags[id] ? ' ⚑' : ''}</button>`).join('')}</nav>
        <article class="fs-card fsq-question"><p class="fs-kicker">${esc(labels[item.type])} · ${esc(item.difficulty)} · ${esc(topicName(item.topic))}</p><h4 id="fsq-question-title" tabindex="-1">${esc(item.question)}</h4>${answerControls(item, done)}
        <p id="fsq-validation" class="fsq-validation" role="status">${esc(validation)}</p>
        <div class="button-row">${a.mode === 'learn' && !done ? button('fsq-check', item.type === 'written' ? 'Compare with model & rubric' : 'Check answer') + button('fsq-reveal', 'I don’t know · show solution', true) : ''}${a.mode === 'learn' && done ? button('fsq-try-again', 'Try this question again', true) : ''}${a.mode === 'learn' && !done && item.hint ? button('fsq-hint', 'Show hint · marks this attempt supported', true) : ''}${button('fsq-flag', a.flags[item.id] ? 'Remove flag' : 'Flag for review', true, `aria-pressed="${a.flags[item.id]}"`)}</div>
        ${a.assisted[item.id] && !done && a.mode === 'learn' && item.hint ? `<p class="fsq-hint" id="fsq-hint-text" tabindex="-1">${esc(item.hint)}</p>` : ''}${done ? feedback(item) : ''}</article>
        <div class="fsq-actions">${button('fsq-prev', '← Previous', true, a.index === 0 ? 'disabled' : '')}${button('fsq-next', 'Next →', true, a.index === a.ids.length - 1 ? 'disabled' : '')}${button('fsq-submit', 'Submit session & review')}</div><p class="fs-meta">Unanswered automatic questions count as missed on submission. Written responses remain self-assessed. The original timer continues after navigation or reload.</p>`;
    }
    function bindSession() {
      const a = state.active, item = lookup.get(a.ids[a.index]);
      on('#fsq-answer', 'input', event => { if (expire()) { render(true); return; } a.drafts[item.id] = event.target.value.slice(0, 8000); a.checked[item.id] = false; save(false); });
      on('#fsq-answer', 'keydown', event => { if (expire()) { event.preventDefault(); render(true); return; } if (item.type === 'numeric' && event.key === 'Enter' && q('#fsq-check')) { event.preventDefault(); q('#fsq-check').click(); } });
      container.querySelectorAll('[data-option]').forEach(input => input.addEventListener('change', () => {
        if (expire()) { render(true); return; }
        a.drafts[item.id] = item.type === 'multi-select' ? [...container.querySelectorAll('[data-option]:checked')].map(el => Number(el.dataset.option)) : Number(input.dataset.option); save(false);
      }));
      on('#fsq-check', 'click', () => {
        if (expire()) { render(true); return; }
        const result = K.grade(item, a.drafts[item.id]);
        if (['empty', 'invalid'].includes(result.status)) { q('#fsq-validation').textContent = result.status === 'empty' ? 'Enter or select an answer before checking.' : 'Use a finite decimal number or scientific notation without units.'; return; }
        K.freeze(state, item, a.drafts[item.id], a.assisted[item.id]); a.checked[item.id] = true; save(true); validation = ''; render(false); q('#fsq-feedback')?.focus({ preventScroll: true }); q('#fsq-feedback')?.scrollIntoView({ block: 'nearest' });
      });
      on('#fsq-reveal', 'click', () => {
        if (expire()) { render(true); return; }
        a.drafts[item.id] = item.type === 'multi-select' ? [] : item.type === 'mcq' ? null : '';
        a.assisted[item.id] = true; K.freeze(state, item, a.drafts[item.id], true); a.checked[item.id] = true; save(true); validation = ''; render(false); q('#fsq-feedback')?.focus({ preventScroll: true });
      });
      on('#fsq-try-again', 'click', () => { if (expire()) { render(true); return; } a.checked[item.id] = false; save(false); render(true); });
      on('#fsq-hint', 'click', () => { if (expire()) { render(true); return; } a.assisted[item.id] = true; save(false); render(false); q('#fsq-hint-text')?.focus({ preventScroll: true }); });
      on('#fsq-flag', 'click', () => { if (expire()) { render(true); return; } a.flags[item.id] = !a.flags[item.id]; save(false); render(false); q('#fsq-flag')?.focus({ preventScroll: true }); });
      const move = index => { a.index = index; validation = ''; save(false); render(true); };
      on('#fsq-prev', 'click', () => move(a.index - 1)); on('#fsq-next', 'click', () => move(a.index + 1));
      container.querySelectorAll('[data-index]').forEach(el => el.addEventListener('click', () => move(Number(el.dataset.index))));
      on('#fsq-dashboard', 'click', () => { panel = 'setup'; render(true); }); on('#fsq-submit', 'click', submit); bindRubrics(item);
    }
    function submit() { if (expire()) { render(true); return; } K.finish(state, bank); save(true); panel = 'results'; render(true); }
    function bindRubrics(item) {
      container.querySelectorAll('[data-rubric]').forEach(el => el.addEventListener('change', () => { if (expire()) { render(true); return; } state.active.rubrics[item.id] ||= item.rubric.map(() => false); state.active.rubrics[item.id][Number(el.dataset.rubric)] = el.checked; save(false); }));
    }
    function results() {
      const a = state.active, score = K.summary(a, bank), retry = a.ids.filter(id => lookup.get(id).type !== 'written' && (!a.first[id]?.correct || a.first[id]?.assisted));
      return heading('Your first-submission review', a.expired ? 'Time ended. Unanswered automatic questions count as missed.' : 'Use the reasoning below to decide what to revisit next.') +
        `<dl class="fs-stats" id="fsq-results"><div><dt>Automatic first submissions</dt><dd>${score.correct} / ${score.total}${score.percent === null ? '' : ` · ${score.percent}%`}</dd></div><div><dt>Independent first checks correct</dt><dd>${score.independentCorrect} / ${score.independentTotal}</dd></div><div><dt>Hint-supported automatic checks</dt><dd>${score.assisted}</dd></div><div><dt>Unanswered automatic questions</dt><dd>${score.unanswered}</dd></div><div><dt>Written questions · self-assess</dt><dd>${score.manual}</dd></div></dl>
        <p class="fs-meta">Automatic accuracy excludes written rubrics. Supported answers are identified separately and remain review items. A learning retry does not erase the first submitted answer. These are revision signals, not exam grades.</p>
        <div class="fsq-actions">${retry.length ? button('fsq-retry-missed', `Retry ${retry.length} missed or supported questions`) : ''}${button('fsq-dashboard', 'New practice / topic progress', true)}</div>
        <section class="fs-card"><h4>Where to focus next</h4><div class="table-wrap"><table><thead><tr><th>Topic</th><th>First automatic submissions</th><th>Next step</th></tr></thead><tbody>${Object.entries(score.byTopic).sort(([, x], [, y]) => x.correct / x.total - y.correct / y.total).map(([id, row]) => `<tr><th scope="row">${esc(topicName(id))}</th><td>${row.correct}/${row.total}</td><td><a href="${esc(options.topicLink(id))}">Review the topic</a></td></tr>`).join('')}</tbody></table></div>${!score.total ? '<p>This written-only session has no automatic percentage. Use the model answers and rubrics below.</p>' : ''}</section>
        <section aria-labelledby="fsq-review-title"><h4 id="fsq-review-title">Review every answer</h4>${a.ids.map((id, i) => {
          const item = lookup.get(id), first = a.first[id];
          const given = item.type === 'mcq' ? item.options[first?.given] : item.type === 'multi-select' ? first?.given?.map(index => item.options[index]).join('; ') : first?.given;
          return `<article class="fs-card fsq-review"><p class="fs-kicker">Question ${i + 1} · ${esc(labels[item.type])}</p><h4>${esc(item.question)}</h4><p><strong>Your first submission:</strong> ${esc(given || '(unanswered)')}</p>${feedback(item).replace('id="fsq-feedback"', `id="fsq-review-${i}"`)}</article>`;
        }).join('')}</section>`;
    }
    function bindResults() {
      on('#fsq-dashboard', 'click', () => { panel = 'setup'; render(true); });
      on('#fsq-retry-missed', 'click', () => { const retry = state.active.ids.filter(id => lookup.get(id).type !== 'written' && (!state.active.first[id]?.correct || state.active.first[id]?.assisted)).map(id => lookup.get(id)); state.active = K.createSession(retry, { mode: 'learn' }); save(true); panel = 'session'; render(true); });
      container.querySelectorAll('.fsq-review').forEach((article, index) => {
        const id = state.active.ids[index];
        article.querySelectorAll('[data-rubric]').forEach(el => el.addEventListener('change', () => { state.active.rubrics[id] ||= lookup.get(id).rubric.map(() => false); state.active.rubrics[id][Number(el.dataset.rubric)] = el.checked; save(false); }));
      });
    }
    function render(focus = false) {
      if (destroyed) return;
      expire();
      container.classList.add('fsq-workspace');
      container.innerHTML = `${unavailable ? '<p id="fsq-storage-warning" class="fs-notice" role="status">Progress storage is unavailable. This session works in memory; keep this page open.</p>' : ''}${panel === 'setup' ? setup() : panel === 'results' ? results() : sessionPage()}`;
      if (panel === 'setup') bindSetup(); else if (panel === 'results') bindResults(); else bindSession();
      if (typeof root.typesetMath === 'function') root.typesetMath(container);
      if (focus) (q('#fsq-question-title') || q('.fsq-heading'))?.focus({ preventScroll: true });
    }
    if (state.active) panel = state.active.finished === null ? 'session' : 'results';
    save(false);
    render();
    timer = setInterval(() => { if (destroyed || !container.isConnected) { clearInterval(timer); return; } if (expire()) render(true); else if (q('#fsq-clock') && state.active?.deadline) q('#fsq-clock').textContent = clock(remaining()); }, 1000);
    return { destroy() { destroyed = true; clearInterval(timer); } };
  }
  root.FundStudyQuizzes = { KEY: K.KEY, mount };
})(typeof window !== 'undefined' ? window : globalThis);
