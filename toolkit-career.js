/* Session-only life and career tools. Persistence and manual JSON backups belong to the Workbench. */
(function (root) {
  'use strict';
  const C = root.StudentToolkitCareerCore;
  if (!C) return;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function button(text, action, className = 'tk-text-button') {
    const node = element('button', text, className);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  function field(form, id, title, options = {}) {
    const wrap = element('div', undefined, 'tw-field');
    const label = element('label', title);
    label.htmlFor = id;
    const input = document.createElement(options.choices ? 'select' : options.multiline ? 'textarea' : 'input');
    input.id = id;
    input.name = id;
    if (options.choices) {
      for (const [value, text] of options.choices) {
        const option = element('option', text);
        option.value = value;
        input.append(option);
      }
    } else {
      if (!options.multiline) input.type = options.type || 'text';
      if (options.max) input.maxLength = options.max;
      if (options.multiline) input.rows = 2;
      if (options.type === 'date') { input.min = '1900-01-01'; input.max = '2200-12-31'; }
    }
    input.required = !!options.required;
    if (options.placeholder) input.placeholder = options.placeholder;
    wrap.append(label, input);
    if (options.note) {
      const note = element('p', options.note, 'tw-note');
      note.id = id + '-note';
      input.setAttribute('aria-describedby', note.id);
      wrap.append(note);
    }
    form.append(wrap);
    return input;
  }

  function metric(title, value) {
    const wrap = element('div', undefined, 'tw-metric');
    wrap.append(element('strong', String(value)), element('span', title));
    return wrap;
  }

  function identifier(prefix, entries) {
    let id;
    do {
      const random = root.crypto && typeof root.crypto.randomUUID === 'function' ? root.crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      id = prefix + '-' + random;
    } while (entries.some(item => item.id === id));
    return id;
  }

  function currentDay(ctx) {
    const today = ctx.today();
    if (!C.isDate(today)) throw new Error('The current day is unavailable. Reload the page and try again.');
    return today;
  }

  function relativeDate(date, today) {
    if (!date) return 'Not set';
    const days = C.daysUntil(date, today);
    return date + ' · ' + (days < 0 ? Math.abs(days) + ' day' + (days === -1 ? '' : 's') + ' overdue' : days === 0 ? 'today' : 'in ' + days + ' day' + (days === 1 ? '' : 's'));
  }

  function mountDocuments(container, ctx) {
    let state = C.cleanDocuments(ctx.draft), editing = '';
    const intro = element('p', 'Keep a short label and date for an expiry, renewal or administrative task. Use official sources to confirm dates and how early to act. Do not enter document numbers, scans or personal identifiers.', 'tw-note');
    const metrics = element('div', undefined, 'tw-metrics');
    const form = element('form', undefined, 'tw-form');
    const heading = element('h3', 'Add a document date');
    heading.id = 'tw-doc-form-title';
    form.setAttribute('aria-labelledby', heading.id);
    const fields = element('div', undefined, 'tw-fields');
    const label = field(fields, 'tw-doc-label', 'Short document or task label', { max: C.LIMITS.label, required: true, placeholder: 'For example: insurance renewal' });
    const date = field(fields, 'tw-doc-date', 'Date to track', { type: 'date', required: true });
    const notice = field(fields, 'tw-doc-notice', 'Advance notice in exported calendar', {
      choices: C.noticeDays.map(days => [String(days), days ? days + ' days before' : 'No calendar alert']),
      note: 'An optional alert is included only in a calendar file you download and import. Calendar apps may handle or ignore it according to their settings.'
    });
    const actions = element('div', undefined, 'tw-actions');
    const submit = element('button', 'Add document date', 'tk-button');
    submit.type = 'submit';
    const cancel = button('Clear entry', () => {
      const wasEditing = !!editing;
      resetForm();
      ctx.notify(wasEditing ? 'Document edit cancelled. The existing date was kept.' : 'Unadded document entry cleared.');
      label.focus();
    });
    cancel.id = 'tw-doc-cancel';
    const formValues = () => [label.value, date.value, notice.value];
    let initialValues = formValues();
    const error = element('p', undefined, 'tw-error');
    error.id = 'tw-doc-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    actions.append(submit, cancel);
    form.append(heading, fields, actions, error);
    const list = element('div', undefined, 'tw-output');
    list.id = 'tw-doc-list';
    const exportActions = element('div', undefined, 'tw-actions');
    const exportButton = button('Download document calendar (.ics)', () => {
      try {
        ctx.download('my-document-dates.ics', C.documentCalendar(readState(), currentDay(ctx)), 'text/calendar;charset=utf-8');
        ctx.notify('Calendar file prepared. Import it into your calendar app and check its alert settings. This page sends no notifications.');
      } catch (e) { showError(e.message); }
    }, 'tk-button');
    exportButton.id = 'tw-doc-calendar';
    exportActions.append(exportButton);
    container.replaceChildren(intro, metrics, form, list, exportActions, element('p', 'Add or update each entry before saving the workspace. Dates stay in this session until you choose Save on this device. There are no background checks or alerts.', 'tw-note'));

    function showError(message) { error.textContent = message; error.hidden = false; }

    function readState() {
      if (editing || date.validity.badInput || formValues().some((value, index) => value !== initialValues[index])) {
        throw new Error('Add/update or cancel this entry before saving, exporting or changing tools.');
      }
      return C.cleanDocuments(state, true);
    }

    function resetForm() {
      editing = '';
      form.reset();
      heading.textContent = 'Add a document date';
      submit.textContent = 'Add document date';
      cancel.textContent = 'Clear entry';
      initialValues = formValues();
      error.hidden = true;
    }

    function render() {
      const groups = C.groupDocuments(state, currentDay(ctx));
      metrics.replaceChildren(metric('Dates recorded', state.documents.length + ' / ' + C.LIMITS.documents), metric('Overdue', groups.overdue.length), metric('Today / next 30 days', groups.today.length + groups.next30.length));
      exportButton.disabled = !state.documents.length;
      list.replaceChildren();
      if (!state.documents.length) {
        list.append(element('p', 'No dates recorded. Add a date you have confirmed with the issuing authority.', 'tw-note'));
        return;
      }
      const names = { overdue: 'Overdue — review the next step', today: 'Today', next30: 'Next 30 days', later: 'Later' };
      for (const [group, items] of Object.entries(groups)) {
        if (!items.length) continue;
        const section = element('section');
        section.append(element('h3', names[group] + ' · ' + items.length));
        for (const item of items) {
          const card = element('article', undefined, 'tw-card');
          card.append(element('h4', item.label), element('p', relativeDate(item.date, currentDay(ctx))), element('p', item.noticeDays ? 'Exported calendar notice: ' + item.noticeDays + ' days before.' : 'No advance notice in the exported calendar.', 'tw-note'));
          const rowActions = element('div', undefined, 'tw-actions');
          const edit = button('Edit', () => {
            editing = item.id;
            label.value = item.label;
            date.value = item.date;
            notice.value = String(item.noticeDays);
            heading.textContent = 'Edit document date';
            submit.textContent = 'Update document date';
            cancel.textContent = 'Cancel edit';
            error.hidden = true;
            label.focus();
          });
          edit.setAttribute('aria-label', 'Edit ' + item.label);
          edit.dataset.docEdit = item.id;
          const remove = button('Remove', () => {
            state.documents = state.documents.filter(entry => entry.id !== item.id);
            if (editing === item.id) resetForm();
            render();
            ctx.notify('Document date removed from this session. Save to keep this change.');
          });
          remove.setAttribute('aria-label', 'Remove ' + item.label);
          remove.dataset.docRemove = item.id;
          rowActions.append(edit, remove);
          card.append(rowActions);
          section.append(card);
        }
        list.append(section);
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      try {
        if (!editing && state.documents.length >= C.LIMITS.documents) throw new Error('Keep at most 30 dates. Remove an entry before adding another.');
        const item = { id: editing || identifier('d', state.documents), label: label.value, date: date.value, noticeDays: Number(notice.value) };
        const documents = editing ? state.documents.map(entry => entry.id === editing ? item : entry) : [...state.documents, item];
        state = C.cleanDocuments({ version: 1, documents }, true);
        resetForm();
        render();
        ctx.notify('Document date updated in this session. Save to keep it on this device.');
      } catch (e) { showError(e.message); }
    });
    render();
    return { getState: readState };
  }

  function mountCareer(container, ctx) {
    let state = C.cleanCareer(ctx.draft), editing = '';
    const intro = element('p', 'Track roles you are considering in health economics, policy, consulting, research or healthcare management. The tracker does not find vacancies, submit applications or send follow-up messages.', 'tw-note');
    const metrics = element('div', undefined, 'tw-metrics');
    const form = element('form', undefined, 'tw-form');
    const heading = element('h3', 'Add an opportunity');
    heading.id = 'tw-career-form-title';
    form.setAttribute('aria-labelledby', heading.id);
    const fields = element('div', undefined, 'tw-fields');
    const organisation = field(fields, 'tw-career-organisation', 'Organisation', { max: C.LIMITS.organisation, required: true, placeholder: 'Use a short organisation name' });
    const role = field(fields, 'tw-career-role', 'Role or opportunity', { max: C.LIMITS.role, required: true, placeholder: 'For example: health policy internship' });
    const stage = field(fields, 'tw-career-stage', 'Application stage', { choices: C.stages.map(item => [item.id, item.title]) });
    const deadline = field(fields, 'tw-career-deadline', 'Application deadline (optional)', { type: 'date' });
    const followup = field(fields, 'tw-career-followup', 'Follow-up date (optional)', { type: 'date' });
    const nextAction = field(fields, 'tw-career-next-action', 'Next action (optional)', { max: C.LIMITS.nextAction, multiline: true, placeholder: 'For example: tailor CV to the published requirements', note: 'Keep this brief. Do not enter contact details or confidential information.' });
    const actions = element('div', undefined, 'tw-actions');
    const submit = element('button', 'Add opportunity', 'tk-button');
    submit.type = 'submit';
    const cancel = button('Clear entry', () => {
      const wasEditing = !!editing;
      resetForm();
      ctx.notify(wasEditing ? 'Opportunity edit cancelled. The existing opportunity was kept.' : 'Unadded opportunity cleared.');
      organisation.focus();
    });
    cancel.id = 'tw-career-cancel';
    const formValues = () => [organisation.value, role.value, stage.value, deadline.value, followup.value, nextAction.value];
    let initialValues = formValues();
    actions.append(submit, cancel);
    const error = element('p', undefined, 'tw-error');
    error.id = 'tw-career-error';
    error.hidden = true;
    error.setAttribute('role', 'alert');
    form.append(heading, fields, actions, error);
    const list = element('div', undefined, 'tw-output');
    list.id = 'tw-career-list';
    const prep = element('section', undefined, 'tw-output');
    prep.append(element('h3', 'Prepare an evidence-based application'));
    const progressText = element('p', undefined, 'tw-note');
    progressText.id = 'tw-career-progress-text';
    const progress = element('progress');
    progress.id = 'tw-career-progress';
    progress.max = C.preparation.length;
    progress.setAttribute('aria-labelledby', progressText.id);
    prep.append(progressText, progress);
    const checks = element('div', undefined, 'tw-checklist');
    for (const group of ['CV', 'Cover letter', 'Interview']) {
      const groupFields = element('fieldset');
      groupFields.append(element('legend', group));
      for (const item of C.preparation.filter(entry => entry.group === group)) {
        const wrap = element('div', undefined, 'tw-field');
        const label = element('label');
        const checkbox = element('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'tw-career-' + item.id;
        checkbox.checked = state.prepared.includes(item.id);
        const advice = element('p', item.advice, 'tw-note');
        advice.id = checkbox.id + '-advice';
        checkbox.setAttribute('aria-describedby', advice.id);
        label.htmlFor = checkbox.id;
        label.append(checkbox, document.createTextNode(' ' + item.title));
        wrap.append(label, advice);
        groupFields.append(wrap);
        checkbox.addEventListener('change', () => {
          state.prepared = checkbox.checked ? [...state.prepared, item.id] : state.prepared.filter(id => id !== item.id);
          renderMetrics();
          ctx.notify('Preparation checklist updated in this session. Save to keep your progress.');
        });
      }
      checks.append(groupFields);
    }
    prep.append(checks, element('p', 'This is a reusable preparation checklist, not a score for your employability or an employer endorsement. Adapt it to each role and verify requirements directly.', 'tw-note'));
    container.replaceChildren(intro, metrics, form, list, prep, element('p', 'Add or update each opportunity before saving the workspace. No application or message is sent. Your entries and preparation checks stay in this session until you choose Save on this device.', 'tw-note'));

    function resetForm() {
      editing = '';
      form.reset();
      heading.textContent = 'Add an opportunity';
      submit.textContent = 'Add opportunity';
      cancel.textContent = 'Clear entry';
      initialValues = formValues();
      error.hidden = true;
    }

    function readState() {
      if (editing || deadline.validity.badInput || followup.validity.badInput || formValues().some((value, index) => value !== initialValues[index])) {
        throw new Error('Add/update or cancel this entry before saving, exporting or changing tools.');
      }
      return C.cleanCareer(state, true);
    }

    function renderMetrics() {
      const m = C.careerMetrics(state, currentDay(ctx));
      metrics.replaceChildren(metric('Active opportunities', m.active), metric('Deadlines in next 7 days', m.dueSoon), metric('Follow-ups due', m.followupDue));
      progress.value = m.prepared;
      progressText.textContent = 'Preparation progress: ' + m.prepared + ' / ' + m.preparationTotal + ' checks · ' + m.preparationPercent + '%';
    }

    function render() {
      renderMetrics();
      list.replaceChildren(element('h3', 'Your opportunities · ' + state.opportunities.length + ' / ' + C.LIMITS.opportunities));
      if (!state.opportunities.length) list.append(element('p', 'No opportunities recorded. Add a role from a vacancy or organisation you have checked.', 'tw-note'));
      for (const item of state.opportunities) {
        const card = element('article', undefined, 'tw-card');
        card.append(element('h4', item.role), element('p', item.organisation), element('p', 'Stage: ' + C.stages.find(entry => entry.id === item.stage).title), element('p', 'Deadline: ' + relativeDate(item.deadline, currentDay(ctx))), element('p', 'Follow-up: ' + relativeDate(item.followup, currentDay(ctx))));
        if (item.nextAction) card.append(element('p', 'Next action: ' + item.nextAction));
        const rowActions = element('div', undefined, 'tw-actions');
        const edit = button('Edit', () => {
          editing = item.id;
          organisation.value = item.organisation;
          role.value = item.role;
          stage.value = item.stage;
          deadline.value = item.deadline;
          followup.value = item.followup;
          nextAction.value = item.nextAction;
          heading.textContent = 'Edit opportunity';
          submit.textContent = 'Update opportunity';
          cancel.textContent = 'Cancel edit';
          error.hidden = true;
          organisation.focus();
        });
        edit.dataset.careerEdit = item.id;
        edit.setAttribute('aria-label', 'Edit ' + item.role + ' at ' + item.organisation);
        const remove = button('Remove', () => {
          state.opportunities = state.opportunities.filter(entry => entry.id !== item.id);
          if (editing === item.id) resetForm();
          render();
          ctx.notify('Opportunity removed from this session. Save to keep this change.');
        });
        remove.dataset.careerRemove = item.id;
        remove.setAttribute('aria-label', 'Remove ' + item.role + ' at ' + item.organisation);
        rowActions.append(edit, remove);
        card.append(rowActions);
        list.append(card);
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      try {
        if (!editing && state.opportunities.length >= C.LIMITS.opportunities) throw new Error('Keep at most 30 opportunities. Remove an entry before adding another.');
        const item = { id: editing || identifier('o', state.opportunities), organisation: organisation.value, role: role.value, stage: stage.value, deadline: deadline.value, followup: followup.value, nextAction: nextAction.value };
        const opportunities = editing ? state.opportunities.map(entry => entry.id === editing ? item : entry) : [...state.opportunities, item];
        state = C.cleanCareer({ version: 1, opportunities, prepared: state.prepared }, true);
        resetForm();
        render();
        ctx.notify('Opportunity updated in this session. Save to keep it on this device.');
      } catch (e) { error.textContent = e.message; error.hidden = false; }
    });
    render();
    return { getState: readState };
  }

  root.StudentToolkitCareerTools = Object.freeze([
    Object.freeze({ id: 'document-deadlines', title: 'Document Deadline Tracker', category: 'life', icon: 'clock', summary: 'Keep verified document dates in view and optionally export calendar alerts.', cleanState: C.cleanDocuments, mount: mountDocuments }),
    Object.freeze({ id: 'career-tracker', title: 'Career Application Toolkit', category: 'career', icon: 'briefcase', summary: 'Organise opportunities and prepare evidence-based CVs, cover letters and interviews.', cleanState: C.cleanCareer, mount: mountCareer })
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
