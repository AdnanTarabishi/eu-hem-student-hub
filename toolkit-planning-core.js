/* Personal study planning: calendar-safe dates, bounded workloads and explicit gaps.
 * No official exam dates, network calls or browser storage are used here.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudentToolkitPlanningCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000;
  const KEYS = ['version', 'targetDate', 'includeToday', 'weekdays', 'dailyHours', 'sessionMinutes', 'bufferPercent', 'tasks'];
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const initialState = () => ({version: 1, targetDate: '', includeToday: true, weekdays: [1, 2, 3, 4, 5], dailyHours: 2, sessionMinutes: 60, bufferPercent: 20, tasks: []});
  function dateNumber(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter a real calendar date in YYYY-MM-DD format.');
    const [year, month, day] = value.split('-').map(Number);
    const time = Date.UTC(year, month - 1, day);
    const date = new Date(time);
    if (year < 1900 || year > 2200 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Enter a real calendar date between 1900 and 2200.');
    return time;
  }
  const dateKey = time => new Date(time).toISOString().slice(0, 10);
  function checkNumber(value, min, max, increment, name) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || Math.abs(value / increment - Math.round(value / increment)) > 1e-8) throw new Error(name + ' must be between ' + min + ' and ' + max + ', in steps of ' + increment + '.');
    return value;
  }
  function cleanState(raw, strict = false) {
    const state = initialState();
    if (!isObject(raw)) { if (strict) throw new Error('The study planner data must be an object.'); return state; }
    if (strict && (Object.keys(raw).some(key => !KEYS.includes(key)) || KEYS.some(key => !Object.hasOwn(raw, key)))) throw new Error('The study planner data has missing or unknown fields.');
    function read(key, validate) {
      if (!Object.hasOwn(raw, key)) return;
      try { state[key] = validate(raw[key]); } catch (error) { if (strict) throw error; }
    }
    read('version', value => { if (value !== 1) throw new Error('Unsupported study planner data version.'); return 1; });
    read('targetDate', value => { if (value === '') return ''; dateNumber(value); return value; });
    read('includeToday', value => { if (typeof value !== 'boolean') throw new Error('Include today must be true or false.'); return value; });
    read('weekdays', value => {
      if (!Array.isArray(value) || value.length > 7 || value.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(value).size !== value.length) throw new Error('Choose each study weekday at most once.');
      return value.slice().sort((a, b) => a - b);
    });
    read('dailyHours', value => checkNumber(value, 0.25, 12, 0.25, 'Available hours per study day'));
    read('sessionMinutes', value => checkNumber(value, 15, 180, 15, 'Maximum session minutes'));
    read('bufferPercent', value => checkNumber(value, 0, 50, 1, 'Reserved capacity percentage'));
    read('tasks', value => {
      if (!Array.isArray(value) || value.length > 40) throw new Error('Enter at most 40 study tasks.');
      const tasks = [];
      for (let i = 0; i < value.length; i++) {
        try {
          const row = value[i];
          if (!isObject(row) || Object.keys(row).some(key => !['title', 'hours'].includes(key)) || !Object.hasOwn(row, 'title') || !Object.hasOwn(row, 'hours')) throw new Error('Task ' + (i + 1) + ' has missing or unknown fields.');
          if (typeof row.title !== 'string' || !row.title.trim() || row.title.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(row.title)) throw new Error('Give task ' + (i + 1) + ' a title of 1–120 characters, without control characters.');
          const hours = checkNumber(row.hours, 0.25, 200, 0.25, 'Task ' + (i + 1) + ' estimated hours');
          if (tasks.reduce((sum, task) => sum + task.hours, 0) + hours > 1000) throw new Error('The total workload must not exceed 1000 hours.');
          tasks.push({title: row.title.trim(), hours});
        } catch (error) { if (strict) throw error; }
      }
      return tasks;
    });
    return state;
  }
  function plan(raw, today) {
    const state = cleanState(raw, true);
    const firstDay = dateNumber(today);
    if (!state.targetDate) throw new Error('Choose your own target date. Official exam dates are not loaded by this planner.');
    const target = dateNumber(state.targetDate);
    const distance = (target - firstDay) / DAY;
    if (distance < 1 || distance > 365) throw new Error('The target must be after today and no more than 365 days away.');
    if (!state.weekdays.length) throw new Error('Choose at least one study weekday.');
    if (!state.tasks.length) throw new Error('Add at least one task and its estimated hours.');
    const start = firstDay + (state.includeToday ? 0 : DAY);
    const availableDays = [];
    for (let time = start; time < target; time += DAY) {
      if (state.weekdays.includes(new Date(time).getUTCDay())) availableDays.push(dateKey(time));
    }
    const rawDailyMinutes = Math.round(state.dailyHours * 60);
    // Round capacity down to 15-minute blocks, so a buffer never creates extra time.
    const dailyMinutes = Math.floor(rawDailyMinutes * (100 - state.bufferPercent) / 100 / 15 + 1e-9) * 15;
    const remaining = state.tasks.map(task => Math.round(task.hours * 60));
    const sessions = [];
    let taskIndex = 0;
    for (const date of availableDays) {
      let left = dailyMinutes;
      while (left > 0 && taskIndex < state.tasks.length) {
        const minutes = Math.min(left, state.sessionMinutes, remaining[taskIndex]);
        sessions.push({date, title: state.tasks[taskIndex].title, taskIndex, minutes, hours: minutes / 60});
        remaining[taskIndex] -= minutes;
        left -= minutes;
        if (remaining[taskIndex] === 0) taskIndex++;
      }
    }
    const demandMinutes = state.tasks.reduce((sum, task) => sum + Math.round(task.hours * 60), 0);
    const scheduledMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
    return {
      today, targetDate: state.targetDate, calendarDays: (target - start) / DAY, availableDays,
      rawCapacityHours: availableDays.length * rawDailyMinutes / 60,
      capacityHours: availableDays.length * dailyMinutes / 60,
      reservedHours: availableDays.length * (rawDailyMinutes - dailyMinutes) / 60,
      availableHoursPerDay: dailyMinutes / 60, demandHours: demandMinutes / 60,
      scheduledHours: scheduledMinutes / 60, unscheduledHours: (demandMinutes - scheduledMinutes) / 60,
      feasible: demandMinutes <= availableDays.length * dailyMinutes,
      tasks: state.tasks.map((task, index) => ({...task, scheduledHours: task.hours - remaining[index] / 60, unscheduledHours: remaining[index] / 60})),
      sessions
    };
  }
  function csvCell(value) {
    let text = String(value);
    // Quoting alone does not stop spreadsheet formulas in user-entered titles.
    if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function csv(raw, today) {
    const result = plan(raw, today);
    const rows = [['Study date', 'Task', 'Session minutes', 'Session hours', 'Target date'],
      ...result.sessions.map(session => [session.date, session.title, session.minutes, session.hours, result.targetDate])];
    return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
  const icsText = text => String(text).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  function foldLine(line) {
    let output = '', width = 0;
    for (const character of line) {
      const point = character.codePointAt(0);
      const bytes = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
      if (width + bytes > 75) { output += '\r\n '; width = 1; }
      output += character;
      width += bytes;
    }
    return output;
  }
  function ics(raw, today) {
    const result = plan(raw, today);
    if (!result.sessions.length) throw new Error('There are no scheduled sessions to export. Adjust your capacity or study days first.');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EU-HEM Student Hub//Personal Study Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    result.sessions.forEach((session, index) => {
      const next = dateKey(dateNumber(session.date) + DAY).replace(/-/g, '');
      lines.push('BEGIN:VEVENT', 'UID:study-' + result.targetDate.replace(/-/g, '') + '-' + session.date.replace(/-/g, '') + '-' + index + '@studenthub.local',
        'DTSTAMP:' + today.replace(/-/g, '') + 'T000000Z', 'DTSTART;VALUE=DATE:' + session.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + next,
        'SUMMARY:' + icsText('Study: ' + session.title),
        'DESCRIPTION:' + icsText('Personal study plan. Estimated session: ' + session.minutes + ' minutes. Target: ' + result.targetDate + '. All-day reminder; no study time is booked. Recheck the official exam or assignment date yourself. ' + (result.unscheduledHours ? result.unscheduledHours + ' hours remain unscheduled in this plan.' : 'The estimated workload fits the selected capacity.')),
        'TRANSP:TRANSPARENT', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }
  return Object.freeze({initialState, cleanState, dateNumber, dateKey, plan, csv, ics});
});
