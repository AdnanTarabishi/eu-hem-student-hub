/* Study planner mounted by the shared Toolkit workbench. Drafts stay in memory. */
(function (root) {
  'use strict';
  const C = root.StudentToolkitPlanningCore;
  if (!C) return;
  const weekdays = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];
  const hours = value => Number(value.toFixed(2)).toLocaleString('en', {maximumFractionDigits: 2});
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function mount(container, ctx) {
    let rowCounter = 0, shown = 50, latest = null;
    const state = C.cleanState(ctx.draft || {});
    container.innerHTML = `<form id="tw-study-form" class="tw-form" novalidate>
      <p class="tw-note">Build a personal revision or assignment plan from your own estimates. Check dates with the course or exam page; this tool does not load official deadlines.</p>
      <div class="tw-fields">
        <label class="tw-field" for="tw-study-target"><span>Your target date</span><input id="tw-study-target" type="date" required></label>
        <label class="tw-field" for="tw-study-daily"><span>Available study hours per selected day</span><input id="tw-study-daily" type="number" min="0.25" max="12" step="0.25" required></label>
        <label class="tw-field" for="tw-study-session"><span>Maximum session length · minutes</span><input id="tw-study-session" type="number" min="15" max="180" step="15" required></label>
        <label class="tw-field" for="tw-study-buffer"><span>Capacity reserved for rest or delays · %</span><input id="tw-study-buffer" type="number" min="0" max="50" step="1" required></label>
      </div>
      <fieldset class="tw-checklist"><legend>Days you can study</legend><div id="tw-study-weekdays"></div></fieldset>
      <label class="tw-checklist" for="tw-study-today"><input id="tw-study-today" type="checkbox"> Include today if it is a selected weekday</label>
      <p class="tw-note">The target day is excluded. If you include today, make sure the daily hours still fit the time you have left. Capacity is rounded down to 15-minute blocks after reserving your buffer; that may reserve a little extra time. Breaks are not added to study sessions.</p>
      <h3 id="tw-study-tasks-heading">What will you work on?</h3><p class="tw-note">Enter tasks in the order you want to finish them. Estimate in quarter-hours, for example 1.25 hours. Up to 40 tasks and 1,000 total hours; each task can take up to 200 hours.</p>
      <div id="tw-study-tasks" aria-labelledby="tw-study-tasks-heading"></div>
      <div class="tw-actions"><button id="tw-study-add" type="button" class="tk-text-button">+ Add task</button><button id="tw-study-example" type="button" class="tk-text-button">Load a hypothetical example</button><button type="submit" class="tk-button">Build my study plan</button></div>
      <p id="tw-study-error" class="tw-error" role="alert" tabindex="-1" hidden></p>
    </form>
    <div id="tw-study-output" class="tw-output"></div>
    <div class="tw-actions"><button id="tw-study-csv" type="button" class="tk-text-button" disabled>Download sessions · CSV</button><button id="tw-study-ics" type="button" class="tk-text-button" disabled>Download calendar reminders · ICS</button></div>
    <p class="tw-note">The calendar file contains all-day personal reminders with estimated durations, not booked study slots or official exam entries. Import it only if you want these reminders; importing it again can create duplicates. CSV includes the scheduled sessions. Keep the full plan in a JSON backup using the workbench controls.</p>`;
    const $ = id => container.querySelector('#tw-study-' + id);
    for (const [value, name] of weekdays) {
      const label = element('label', 'tw-checklist');
      const input = element('input');
      input.type = 'checkbox'; input.value = String(value); input.id = 'tw-study-day-' + value;
      input.checked = state.weekdays.includes(value);
      label.htmlFor = input.id; label.append(input, document.createTextNode(' ' + name));
      $('weekdays').append(label);
    }
    function addTask(task = {title: '', hours: ''}) {
      if ($('tasks').children.length >= 40) return;
      const index = ++rowCounter;
      const row = element('div', 'tw-card'); row.dataset.studyTask = String(index);
      const fields = element('div', 'tw-fields');
      const titleLabel = element('label', 'tw-field'); titleLabel.htmlFor = 'tw-study-title-' + index;
      titleLabel.append(element('span', '', 'Task or topic'));
      const title = element('input'); title.id = titleLabel.htmlFor; title.dataset.studyTitle = 'true'; title.type = 'text'; title.maxLength = 120; title.value = task.title; title.placeholder = 'For example: practise one topic';
      titleLabel.append(title);
      const hoursLabel = element('label', 'tw-field'); hoursLabel.htmlFor = 'tw-study-hours-' + index; hoursLabel.append(element('span', '', 'Estimated hours'));
      const estimate = element('input'); estimate.id = hoursLabel.htmlFor; estimate.dataset.studyHours = 'true'; estimate.type = 'number'; estimate.min = '0.25'; estimate.max = '200'; estimate.step = '0.25'; estimate.value = task.hours;
      hoursLabel.append(estimate); fields.append(titleLabel, hoursLabel);
      const actions = element('div', 'tw-actions');
      const up = element('button', 'tk-text-button', 'Move up'); up.type = 'button'; up.dataset.studyUp = 'true'; up.setAttribute('aria-label', 'Move this task earlier');
      const remove = element('button', 'tk-text-button', 'Remove task'); remove.type = 'button'; remove.dataset.studyRemove = 'true';
      actions.append(up, remove); row.append(fields, actions); $('tasks').append(row);
      updateTaskButtons();
      return title;
    }
    function updateTaskButtons() {
      const rows = [...$('tasks').children];
      rows.forEach((row, index) => { row.querySelector('[data-study-up]').disabled = index === 0; });
      $('add').disabled = rows.length >= 40;
    }
    function fill(next) {
      $('target').value = next.targetDate; $('daily').value = next.dailyHours; $('session').value = next.sessionMinutes; $('buffer').value = next.bufferPercent; $('today').checked = next.includeToday;
      $('weekdays').querySelectorAll('input').forEach(input => { input.checked = next.weekdays.includes(Number(input.value)); });
      $('tasks').replaceChildren();
      if (next.tasks.length) next.tasks.forEach(addTask); else addTask();
    }
    function getState() {
      const tasks = [...$('tasks').children].flatMap((row, index) => {
        const title = row.querySelector('[data-study-title]').value;
        const estimate = row.querySelector('[data-study-hours]').value;
        if (!title.trim() && !estimate) return [];
        if (!estimate) throw new Error('Enter estimated hours for task ' + (index + 1) + '.');
        return [{title, hours: Number(estimate)}];
      });
      return C.cleanState({version: 1, targetDate: $('target').value, includeToday: $('today').checked,
        weekdays: [...$('weekdays').querySelectorAll('input:checked')].map(input => Number(input.value)), dailyHours: Number($('daily').value),
        sessionMinutes: Number($('session').value), bufferPercent: Number($('buffer').value), tasks}, true);
    }
    function table(headers, rows) {
      const wrap = element('div', 'tw-table-wrap'), tableNode = element('table', 'tw-table');
      const head = element('thead'), header = element('tr'); headers.forEach(text => { const th = element('th', '', text); th.scope = 'col'; header.append(th); }); head.append(header);
      const body = element('tbody'); rows.forEach(values => { const row = element('tr'); values.forEach(value => row.append(element('td', '', String(value)))); body.append(row); });
      tableNode.append(head, body); wrap.append(tableNode); return wrap;
    }
    function showSessions() {
      const region = $('sessions'); if (!region || !latest) return;
      region.replaceChildren(table(['Date', 'Task', 'Minutes', 'Hours'], latest.sessions.slice(0, shown).map(session => [session.date, session.title, session.minutes, hours(session.hours)])));
      if (latest.sessions.length > shown) {
        const more = element('button', 'tk-text-button', 'Show 50 more sessions (' + shown + ' of ' + latest.sessions.length + ' shown)'); more.type = 'button'; more.id = 'tw-study-more';
        more.addEventListener('click', () => { shown += 50; showSessions(); const next = $('more'); (next || region).focus(); }); region.append(more);
      }
    }
    function render(reportError = true) {
      $('error').hidden = true; $('csv').disabled = true; $('ics').disabled = true; latest = null;
      const output = $('output'); output.replaceChildren();
      try {
        latest = C.plan(getState(), ctx.today()); shown = 50;
        const status = element('p', latest.feasible ? 'tw-note' : 'tw-error'); status.id = 'tw-study-feasibility'; status.setAttribute('role', 'status');
        status.textContent = latest.feasible ? 'Your estimated workload fits the selected study capacity.' : hours(latest.unscheduledHours) + (latest.unscheduledHours === 1 ? ' hour does not fit' : ' hours do not fit') + ' before the target. Reduce the workload, add study capacity or revise your target; the remaining workload has not been silently scheduled.';
        output.append(status);
        const metrics = element('div', 'tw-metrics');
        for (const [label, value] of [['Selected study days', latest.availableDays.length], ['Usable capacity', hours(latest.capacityHours) + ' h'], ['Estimated workload', hours(latest.demandHours) + ' h'], ['Scheduled', hours(latest.scheduledHours) + ' h'], ['Unscheduled', hours(latest.unscheduledHours) + ' h'], ['Reserved capacity', hours(latest.reservedHours) + ' h']]) {
          const metric = element('div', 'tw-metric'); metric.append(element('span', '', label), element('strong', '', String(value))); metrics.append(metric);
        }
        const windowText = latest.calendarDays ? 'Planning window: ' + ($('today').checked ? latest.today : C.dateKey(C.dateNumber(latest.today) + 86400000)) + ' through ' + C.dateKey(C.dateNumber(latest.targetDate) - 86400000) + '.' : 'No calendar days remain before the target with today excluded.';
        output.append(metrics, element('p', 'tw-note', windowText + ' Usable capacity per selected day: ' + hours(latest.availableHoursPerDay) + ' hours. Sessions follow the task order; unused capacity is left free.'));
        output.append(element('h3', '', 'Workload coverage'), table(['Task', 'Estimated hours', 'Scheduled hours', 'Unscheduled hours'], latest.tasks.map(task => [task.title, hours(task.hours), hours(task.scheduledHours), hours(task.unscheduledHours)])));
        if (latest.sessions.length) {
          output.append(element('h3', '', 'Your dated study sessions'));
          const sessions = element('div'); sessions.id = 'tw-study-sessions'; sessions.tabIndex = -1; output.append(sessions); showSessions();
          $('csv').disabled = false; $('ics').disabled = false;
        } else output.append(element('p', 'tw-note', 'No sessions can be scheduled with these days and capacity. All estimated hours remain unscheduled.'));
        return true;
      } catch (error) {
        if (reportError) { $('error').textContent = error.message; $('error').hidden = false; }
        else output.append(element('p', 'tw-note', 'Choose a target date and add your tasks to see an achievable plan, or try the clearly labelled hypothetical example.'));
        return false;
      }
    }
    fill(state);
    try {
      const today = C.dateNumber(ctx.today());
      $('target').min = C.dateKey(today + 86400000); $('target').max = C.dateKey(today + 365 * 86400000);
    } catch (_) { /* Validation below provides the visible date error. */ }
    $('form').addEventListener('submit', event => { event.preventDefault(); if (!render()) $('error').focus(); else ctx.notify('Study plan updated. Review any unscheduled hours.'); });
    $('form').addEventListener('input', () => render());
    $('form').addEventListener('change', () => render());
    $('add').addEventListener('click', () => { const title = addTask(); if (title) title.focus(); });
    $('tasks').addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      const row = button.closest('[data-study-task]');
      if (button.hasAttribute('data-study-remove')) { row.remove(); updateTaskButtons(); render(); $('add').focus(); }
      if (button.hasAttribute('data-study-up') && row.previousElementSibling) { $('tasks').insertBefore(row, row.previousElementSibling); updateTaskButtons(); render(); (button.disabled ? row.querySelector('[data-study-title]') : button).focus(); }
    });
    $('example').addEventListener('click', () => {
      const example = C.initialState(); example.targetDate = C.dateKey(C.dateNumber(ctx.today()) + 14 * 86400000);
      example.tasks = [{title: 'Example: review two study topics', hours: 4}, {title: 'Example: practise exercises', hours: 6}, {title: 'Example: write a summary and self-check', hours: 2}];
      fill(example); render(); ctx.notify('Hypothetical example loaded. Change the date, tasks and available hours to fit your own plan.');
    });
    for (const format of ['csv', 'ics']) $('' + format).addEventListener('click', () => {
      if (!render()) return;
      try {
        const data = C[format](getState(), ctx.today());
        ctx.download('personal-study-sessions.' + format, data, format === 'csv' ? 'text/csv;charset=utf-8' : 'text/calendar;charset=utf-8');
        ctx.notify(format === 'ics' ? 'Calendar file prepared with all-day personal reminders. Import it manually into your calendar if wanted.' : 'Scheduled study sessions prepared as CSV. Unscheduled hours remain visible in the plan.');
      } catch (error) { $('error').textContent = error.message; $('error').hidden = false; }
    });
    render(false);
    return {getState};
  }
  root.StudentToolkitPlanningTools = [{id: 'study-session-planner', title: 'Study Session Planner', category: 'study', icon: 'calendar',
    summary: 'Turn your own deadlines and workload estimates into dated sessions, with rest capacity and an honest view of what does not fit.', cleanState: C.cleanState, mount}];
})(typeof globalThis !== 'undefined' ? globalThis : this);
