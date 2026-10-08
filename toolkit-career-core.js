/* Pure helpers for personal document dates and career preparation. No storage, DOM or network. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudentToolkitCareerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMITS = Object.freeze({ documents: 30, opportunities: 30, label: 80, organisation: 100, role: 120, nextAction: 240 });
  const noticeDays = Object.freeze([0, 7, 14, 30, 60, 90]);
  const stages = Object.freeze([
    Object.freeze({ id: 'interested', title: 'Interested' }),
    Object.freeze({ id: 'preparing', title: 'Preparing application' }),
    Object.freeze({ id: 'applied', title: 'Applied' }),
    Object.freeze({ id: 'interview', title: 'Interview' }),
    Object.freeze({ id: 'offer', title: 'Offer received' }),
    Object.freeze({ id: 'closed', title: 'Closed / no longer pursuing' })
  ]);
  const preparation = Object.freeze([
    Object.freeze({ id: 'cv-evidence', group: 'CV', title: 'Connect each skill to evidence', advice: 'Describe your actual contribution, method and result in a course project, thesis, internship or job. Label coursework as coursework; avoid invented impact or proficiency.' }),
    Object.freeze({ id: 'cv-methods', group: 'CV', title: 'Name the methods you can explain', advice: 'Choose relevant skills such as economic evaluation, data analysis, policy appraisal or service improvement. State your real experience with software and methods.' }),
    Object.freeze({ id: 'cv-review', group: 'CV', title: 'Check accuracy and readability', advice: 'Keep dates and affiliations consistent, use clear headings, check spelling and export a readable PDF. Follow the employer’s requested format.' }),
    Object.freeze({ id: 'letter-role', group: 'Cover letter', title: 'Link your interest to the role', advice: 'Use the actual vacancy to identify the health, policy, payer, consulting or management problem you would help address. Explain why that work interests you.' }),
    Object.freeze({ id: 'letter-example', group: 'Cover letter', title: 'Choose one concrete example', advice: 'Explain a relevant piece of work and your contribution. A truthful example with limits is more useful than a generic claim of expertise.' }),
    Object.freeze({ id: 'letter-rules', group: 'Cover letter', title: 'Verify application requirements', advice: 'Check the closing date, language, attachments and qualifications with the employer. Work permission and eligibility depend on your circumstances; this checklist does not decide them.' }),
    Object.freeze({ id: 'interview-story', group: 'Interview', title: 'Rehearse an evidence-based story', advice: 'Practise the situation, your task, what you did, the result and what you learned. Be ready to separate your contribution from the team’s work.' }),
    Object.freeze({ id: 'interview-method', group: 'Interview', title: 'Explain a method and its limits', advice: 'Choose a method relevant to the role: for example an ICER, a policy comparison, a regression or a quality-improvement measure. Explain assumptions, uncertainty and the decision it can support.' }),
    Object.freeze({ id: 'interview-questions', group: 'Interview', title: 'Prepare informed questions', advice: 'Ask about the team’s decision problems, available data, supervision and how success is assessed. Do not disclose confidential patient, university or employer information.' })
  ]);
  const checklistIds = new Set(preparation.map(item => item.id));
  const stageIds = new Set(stages.map(stage => stage.id));
  const dayMilliseconds = 86400000;
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

  function expectObject(value, allowed, required, strict, name) {
    if (!isObject(value)) {
      if (strict) throw new Error(name + ' must be a plain JSON object.');
      return false;
    }
    if (strict && (Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.prototype.hasOwnProperty.call(value, key)))) {
      throw new Error(name + ' contains missing or unknown fields.');
    }
    return true;
  }

  function text(value, max, required, strict, name) {
    if (typeof value !== 'string') {
      if (strict) throw new Error(name + ' must be text.');
      return '';
    }
    if (strict && (value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))) throw new Error(name + ' contains unsupported text or exceeds its limit.');
    const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
    if (required && !clean && strict) throw new Error(name + ' cannot be empty.');
    return clean;
  }

  function isDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function dateField(value, optional, strict, name) {
    if (optional && value === '') return '';
    if (isDate(value)) return value;
    if (strict) throw new Error(name + ' must be a real date (YYYY-MM-DD, years 1900–2200).');
    return '';
  }

  function identifier(value, prefix, strict) {
    if (typeof value === 'string' && new RegExp('^' + prefix + '-[a-z0-9-]{1,64}$').test(value)) return value;
    if (strict) throw new Error('An entry has an invalid identifier.');
    return '';
  }

  function cleanDocuments(raw, strict = false) {
    const empty = { version: 1, documents: [] };
    if (!expectObject(raw, ['version', 'documents'], ['version', 'documents'], strict, 'Document state')) return empty;
    if (raw.version !== 1 || !Array.isArray(raw.documents)) {
      if (strict) throw new Error('This document state has an unsupported version or entry list.');
      return empty;
    }
    if (strict && raw.documents.length > LIMITS.documents) throw new Error('Keep at most 30 document dates.');
    const result = [], seen = new Set();
    for (const item of raw.documents.slice(0, LIMITS.documents)) {
      if (!expectObject(item, ['id', 'label', 'date', 'noticeDays'], ['id', 'label', 'date', 'noticeDays'], strict, 'Document entry')) continue;
      const id = identifier(item.id, 'd', strict), label = text(item.label, LIMITS.label, true, strict, 'Document label'), date = dateField(item.date, false, strict, 'Document date');
      const notice = noticeDays.includes(item.noticeDays) ? item.noticeDays : 0;
      if (strict && !noticeDays.includes(item.noticeDays)) throw new Error('Choose a supported calendar notice period.');
      if (seen.has(id)) {
        if (strict) throw new Error('Document identifiers must be unique.');
        continue;
      }
      if (!id || !label || !date) continue;
      seen.add(id);
      result.push({ id, label, date, noticeDays: notice });
    }
    return { version: 1, documents: result };
  }

  function cleanCareer(raw, strict = false) {
    const empty = { version: 1, opportunities: [], prepared: [] };
    if (!expectObject(raw, ['version', 'opportunities', 'prepared'], ['version', 'opportunities', 'prepared'], strict, 'Career state')) return empty;
    if (raw.version !== 1 || !Array.isArray(raw.opportunities) || !Array.isArray(raw.prepared)) {
      if (strict) throw new Error('This career state has an unsupported version or entry list.');
      return empty;
    }
    if (strict && (raw.opportunities.length > LIMITS.opportunities || raw.prepared.length > preparation.length)) throw new Error('The career backup exceeds its entry limit.');
    const result = [], seen = new Set();
    for (const item of raw.opportunities.slice(0, LIMITS.opportunities)) {
      const fields = ['id', 'organisation', 'role', 'stage', 'deadline', 'followup', 'nextAction'];
      if (!expectObject(item, fields, fields, strict, 'Opportunity')) continue;
      const id = identifier(item.id, 'o', strict);
      const organisation = text(item.organisation, LIMITS.organisation, true, strict, 'Organisation');
      const role = text(item.role, LIMITS.role, true, strict, 'Role');
      const nextAction = text(item.nextAction, LIMITS.nextAction, false, strict, 'Next action');
      const deadline = dateField(item.deadline, true, strict, 'Application deadline');
      const followup = dateField(item.followup, true, strict, 'Follow-up date');
      if (strict && !stageIds.has(item.stage)) throw new Error('An opportunity contains an unknown stage.');
      if (seen.has(id)) {
        if (strict) throw new Error('Opportunity identifiers must be unique.');
        continue;
      }
      if (!id || !organisation || !role) continue;
      seen.add(id);
      result.push({ id, organisation, role, stage: stageIds.has(item.stage) ? item.stage : 'interested', deadline, followup, nextAction });
    }
    if (strict && (raw.prepared.some(id => !checklistIds.has(id)) || new Set(raw.prepared).size !== raw.prepared.length)) throw new Error('The preparation checklist contains unknown or repeated items.');
    const prepared = [...new Set(raw.prepared.filter(id => checklistIds.has(id)))].slice(0, preparation.length);
    return { version: 1, opportunities: result, prepared };
  }

  function daysUntil(date, today) {
    if (!isDate(date) || !isDate(today)) throw new Error('Choose a real date and a valid current day.');
    return Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / dayMilliseconds);
  }

  function groupDocuments(raw, today) {
    if (!isDate(today)) throw new Error('The current day is invalid.');
    const groups = { overdue: [], today: [], next30: [], later: [] };
    const items = cleanDocuments(raw).documents.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
    for (const item of items) {
      const days = daysUntil(item.date, today), group = days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 30 ? 'next30' : 'later';
      groups[group].push({ ...item, days });
    }
    return groups;
  }

  function careerMetrics(raw, today) {
    const state = cleanCareer(raw), active = state.opportunities.filter(item => item.stage !== 'closed');
    if (!isDate(today)) throw new Error('The current day is invalid.');
    return {
      total: state.opportunities.length,
      active: active.length,
      dueSoon: active.filter(item => item.deadline && daysUntil(item.deadline, today) >= 0 && daysUntil(item.deadline, today) <= 7).length,
      followupDue: active.filter(item => item.followup && daysUntil(item.followup, today) <= 0).length,
      prepared: state.prepared.length,
      preparationTotal: preparation.length,
      preparationPercent: Math.round(state.prepared.length / preparation.length * 100)
    };
  }

  function icsEscape(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  }

  function foldLine(line) {
    const segments = [];
    let part = '', bytes = 0, limit = 75;
    for (const character of line) {
      const length = new TextEncoder().encode(character).length;
      if (bytes + length > limit) {
        segments.push(part);
        part = '';
        bytes = 0;
        limit = 74; // Each continuation has one leading space.
      }
      part += character;
      bytes += length;
    }
    segments.push(part);
    return segments.join('\r\n ');
  }

  function documentCalendar(raw, today) {
    const state = cleanDocuments(raw, true);
    if (!isDate(today)) throw new Error('The calendar export needs a valid current day.');
    if (!state.documents.length) throw new Error('Add a document date before exporting a calendar.');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EU-HEM Student Hub//Personal document dates//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:My document dates'];
    for (const item of state.documents) {
      const end = new Date(Date.parse(item.date + 'T00:00:00Z') + dayMilliseconds).toISOString().slice(0, 10);
      lines.push('BEGIN:VEVENT', 'UID:document-' + item.id + '@euhem-student-hub.invalid', 'DTSTAMP:' + today.replace(/-/g, '') + 'T000000Z', 'DTSTART;VALUE=DATE:' + item.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + end.replace(/-/g, ''), 'SUMMARY:' + icsEscape(item.label), 'DESCRIPTION:Personal date entered by you. Verify with the issuing authority. Calendar alerts depend on your calendar settings.', 'TRANSP:TRANSPARENT');
      if (item.noticeDays > 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P' + item.noticeDays + 'D', 'DESCRIPTION:' + icsEscape('Upcoming document date: ' + item.label), 'END:VALARM');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }

  return Object.freeze({ LIMITS, noticeDays, stages, preparation, isDate, cleanDocuments, cleanCareer, daysUntil, groupDocuments, careerMetrics, icsEscape, foldLine, documentCalendar });
});
