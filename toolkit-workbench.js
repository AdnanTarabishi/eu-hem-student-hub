/* Real local tools: explicit saving, portable backups and public-only links. */
(function () {
  'use strict';
  const root = document.getElementById('toolkit-main'), panel = document.getElementById('tk2-workbench');
  const C = window.StudentToolkitWorkbenchCore;
  if (!root || !panel || !C) return;
  const entries = [...(window.StudentToolkitAcademicTools || []), ...(window.StudentToolkitPlanningTools || []),
    ...(window.StudentToolkitLifeTools || []), ...(window.StudentToolkitCareerTools || [])];
  const tools = new Map(C.IDS.map(id => [id, entries.find(tool => tool.id === id)]).filter(([, tool]) => tool));
  const cleaners = Object.fromEntries([...tools].map(([id, tool]) => [id, tool.cleanState]));
  const $ = id => panel.querySelector('#' + id);
  const el = (tag, name, text) => {
    const node = document.createElement(tag); if (name) node.className = name;
    if (text !== undefined) node.textContent = text; return node;
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  let saved = C.empty(), drafts = {}, active = null, mounted = null, pending = null, storageOK = true, recovered = false, importSequence = 0;
  function recoverDevice(text) {
    if (C.bytes(text) > C.LIMIT_BYTES) throw new Error('The saved planners exceed the backup size limit.');
    const raw = JSON.parse(text);
    try { return C.cleanStore(raw, cleaners, true); }
    catch (_) { recovered = true; return C.cleanStore(raw, cleaners); }
  }
  try {
    const text = localStorage.getItem(C.KEY);
    if (text) saved = recoverDevice(text);
  } catch (_) { storageOK = false; }
  drafts = clone(saved.tools);
  panel.innerHTML = `<div class="tk2-heading tw-heading"><div><p class="tk-eyebrow">BUILT FOR THE NEXT TWO YEARS, AND BEYOND</p>
    <h2 id="tk2-workbench-title" tabindex="-1">Make the next step easier.</h2>
    <p class="tk-meta">Explore a course concept, make a realistic plan, or prepare your next application. Seven tools that work right here.</p></div>
    <span class="tk2-pill">7 built-in tools</span></div>
    <div class="tw-layout"><aside class="tw-nav" aria-label="Choose a built-in tool"><h3>Your workbench</h3>
    <div id="tw-tool-select" role="group" aria-label="Workbench tools"></div>
    <p class="tw-note tw-local-note">Your entries stay in this tab until you choose <strong>Save on this device</strong>. No account needed.</p></aside>
    <div class="tw-main"><div class="tw-tool-heading"><div><p id="tw-category" class="tk-eyebrow"></p><h3 id="tw-active-title" tabindex="-1"></h3><p id="tw-summary" class="tw-note"></p></div></div>
    <div class="tw-toolbar"><button type="button" class="tk-button" id="tw-save">Save on this device</button>
    <button type="button" class="tk-text-button" id="tw-copy-link">Copy tool link</button><button type="button" class="tk-text-button" id="tw-reset">Reset this tool</button>
    <span id="tw-saved-count" class="tw-note"></span></div>
    <p id="tw-status" class="tw-status" role="status" aria-live="polite"></p>
    <p id="tw-error" class="tw-error" role="alert" hidden></p>
    <p id="tw-storage-warning" class="tw-error" role="status" hidden>Browser storage is unavailable or an older backup could not be read. Your drafts work in this tab; export a backup before closing it.</p>
    <div id="tw-copy-box" class="tw-card" hidden><label class="tw-field" for="tw-copy-fallback">Select and copy this public tool link<textarea id="tw-copy-fallback" rows="3" readonly></textarea></label></div>
    <div id="tw-tool-content"></div></div></div>
    <details class="tw-backups"><summary>Back up or clear your planners</summary>
    <p class="tw-note">A JSON backup includes the current drafts you have opened, including unsaved edits. It can contain budgets, dates and application notes. Keep the file private. Bookmarks, catalogue lists and course progress have their own separate storage.</p>
    <div class="tw-actions"><button type="button" id="tw-export" class="tk-button tk-button-outline">Export planners (.json)</button>
    <label class="tw-field" for="tw-import-file">Import a workbench backup<input id="tw-import-file" type="file" accept=".json,application/json"></label>
    <button type="button" id="tw-clear" class="tk-text-button">Clear all workbench planners</button></div>
    <div id="tw-import-preview" class="tw-card" hidden><h3>Review this backup</h3><ul id="tw-import-tools"></ul>
    <p class="tw-note">Confirming replaces only these workbench drafts and saved planners. Planners omitted from the backup will be reset. Other Hub data stay separate.</p>
    <div class="tw-actions"><button type="button" id="tw-import-confirm" class="tk-button">Confirm import</button><button type="button" id="tw-import-cancel" class="tk-text-button">Cancel import</button></div></div></details>`;
  const groupNames = { study: 'Study & research', economics: 'Economics', life: 'Everyday life', cities: 'Moving cities', career: 'Your career' };
  for (const [id, tool] of tools) {
    const button = el('button', 'tw-tool-choice'); button.type = 'button'; button.dataset.planner = id;
    button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-controls', 'tw-tool-content');
    const mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mark.classList.add('icon'); mark.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', `icons.svg#${tool.icon}`); mark.append(use);
    const copy = el('span'); copy.append(el('strong', '', tool.title), el('small', '', groupNames[tool.category] || 'Built-in tool'));
    button.append(mark, copy); $('tw-tool-select').append(button);
  }
  function notify(message) { $('tw-status').textContent = message; $('tw-error').hidden = true; }
  function fail(error) { $('tw-error').textContent = error.message || String(error); $('tw-error').hidden = false; }
  function run(action) { try { action(); } catch (error) { fail(error); } }
  function download(filename, text, mime = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = el('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function capture() {
    if (active && mounted) drafts[active.id] = active.cleanState(mounted.getState(), true);
  }
  function updateSaved() {
    const count = Object.keys(saved.tools).length;
    $('tw-saved-count').textContent = `${count} ${count === 1 ? 'tool' : 'tools'} saved`;
    $('tw-storage-warning').hidden = storageOK && !recovered;
    $('tw-storage-warning').textContent = recovered ? 'Some saved planners could not be read. Valid planners were recovered; export a backup before replacing saved drafts.' : 'Browser storage is unavailable or a saved backup could not be read. Your drafts work in this tab; export a backup before closing it.';
  }
  function writeURL() {
    const url = new URL(location.href);
    if (url.searchParams.get('section') !== 'workbench' || !active) return;
    url.searchParams.set('planner', active.id);
    try { history.replaceState(null, '', url.href); } catch (_) { /* Embedded previews may forbid history writes. */ }
  }
  function open(id, focus = false, retain = true) {
    if (!tools.has(id)) id = tools.keys().next().value;
    if (!id) return;
    if (retain && active?.id === id) { writeURL(); if (focus) $('tw-active-title').focus(); return; }
    if (retain) capture();
    active = tools.get(id);
    $('tw-active-title').textContent = active.title; $('tw-category').textContent = groupNames[active.category] || 'BUILT HERE';
    $('tw-summary').textContent = active.summary;
    $('tw-tool-content').replaceChildren();
    mounted = active.mount($('tw-tool-content'), { draft: clone(drafts[id] || {}), notify, download, today });
    $('tw-tool-select').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.planner === id)));
    $('tw-error').hidden = true; $('tw-copy-box').hidden = true; writeURL();
    if (focus) $('tw-active-title').focus();
  }
  function persist(next, message) {
    const cleaned = C.cleanStore(next, cleaners, true);
    const text = C.exportStore(cleaned, cleaners);
    try { localStorage.setItem(C.KEY, text); saved = cleaned; storageOK = true; recovered = false; notify(message); }
    catch (_) { storageOK = false; notify('Browser storage is unavailable. The draft remains in this tab; export a backup.'); }
    updateSaved();
  }
  $('tw-tool-select').addEventListener('click', event => {
    const button = event.target.closest('[data-planner]'); if (button) run(() => open(button.dataset.planner, true));
  });
  $('tw-save').addEventListener('click', () => run(() => {
    capture(); persist({ ...saved, tools: { ...saved.tools, [active.id]: drafts[active.id] } }, `${active.title} saved on this device.`);
  }));
  $('tw-reset').addEventListener('click', () => run(() => {
    if (!confirm(`Reset ${active.title}, including its saved draft?`)) return;
    delete drafts[active.id];
    const next = clone(saved); delete next.tools[active.id];
    if (Object.keys(next.tools).length) persist(next, 'This tool was reset.');
    else { try { localStorage.removeItem(C.KEY); saved = next; storageOK = true; recovered = false; notify('This tool was reset.'); } catch (_) { storageOK = false; notify('The tool was reset in this tab; browser storage could not be cleared.'); } updateSaved(); }
    open(active.id, false, false);
  }));
  $('tw-export').addEventListener('click', () => run(() => {
    capture(); download('euhem-toolkit-workbench.json', C.exportStore({ ...C.empty(), tools: drafts }, cleaners));
    notify('Backup prepared with your current workspace drafts. It does not contain bookmarks or course progress.');
  }));
  $('tw-import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    const sequence = ++importSequence;
    pending = null; $('tw-import-preview').hidden = true;
    try {
      if (file.size > C.LIMIT_BYTES) throw new Error('Choose a JSON backup no larger than 100 KB.');
      const text = await file.text();
      if (sequence !== importSequence) return;
      pending = C.parseImport(text, cleaners);
      $('tw-import-tools').replaceChildren();
      for (const id of Object.keys(pending.tools)) $('tw-import-tools').append(el('li', '', tools.get(id).title));
      if (!Object.keys(pending.tools).length) $('tw-import-tools').append(el('li', '', 'Empty backup: all workbench planners will be reset.'));
      $('tw-import-preview').hidden = false; $('tw-import-confirm').focus();
      notify('Backup checked. Review it and confirm before any planners are changed.');
    } catch (error) { if (sequence === importSequence) { pending = null; fail(error); } }
    finally { event.target.value = ''; }
  });
  $('tw-import-confirm').addEventListener('click', () => run(() => {
    if (!pending) return;
    const next = pending; pending = null; drafts = clone(next.tools);
    persist(next, 'Workbench backup imported.'); $('tw-import-preview').hidden = true; open(active.id, true, false);
  }));
  $('tw-import-cancel').addEventListener('click', () => { importSequence++; pending = null; $('tw-import-preview').hidden = true; $('tw-import-file').focus(); notify('Import cancelled. Your planners were not changed.'); });
  $('tw-clear').addEventListener('click', () => run(() => {
    if (!confirm('Clear all seven workbench planners from this tab and this device? Bookmarks, catalogue lists and course progress will remain.')) return;
    drafts = {}; saved = C.empty(); pending = null; importSequence++; recovered = false; $('tw-import-preview').hidden = true;
    try { localStorage.removeItem(C.KEY); storageOK = true; notify('Workbench planners cleared. Other Hub data were preserved.'); }
    catch (_) { storageOK = false; notify('Drafts cleared from this tab; browser storage could not be cleared.'); }
    updateSaved(); open(active.id, false, false);
  }));
  $('tw-copy-link').addEventListener('click', async () => {
    const url = new URL('toolkit.html', location.href); url.searchParams.set('section', 'workbench'); url.searchParams.set('planner', active.id);
    try { await navigator.clipboard.writeText(url.href); notify('Tool link copied. It contains no planner entries.'); }
    catch (_) { $('tw-copy-box').hidden = false; $('tw-copy-fallback').value = url.href; $('tw-copy-fallback').focus(); $('tw-copy-fallback').select(); notify('Select and copy the tool link. It contains no planner entries.'); }
  });
  root.addEventListener('toolkit:section', event => {
    if (event.detail.section === 'workbench') run(() => {
      const id = new URLSearchParams(location.search).get('planner');
      if (tools.has(id) && active?.id !== id) open(id); else writeURL();
    });
  });
  window.addEventListener('popstate', () => {
    if (new URLSearchParams(location.search).get('section') === 'workbench') run(() => open(new URLSearchParams(location.search).get('planner')));
  });
  window.addEventListener('storage', event => {
    if (event.key !== C.KEY && event.key !== null) return;
    recovered = false;
    try { saved = event.newValue ? recoverDevice(event.newValue) : C.empty(); }
    catch (_) { saved = C.empty(); }
    updateSaved(); notify('Saved planners changed in another tab. Reload to load them; export your current drafts first.');
  });
  updateSaved(); open(new URLSearchParams(location.search).get('planner'), false, false);
})();
