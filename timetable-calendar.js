/* Date-only helpers. UTC arithmetic avoids changes caused by the visitor's zone.
   The official class clock remains Europe/Rome, provided by NotesSchedule. */
const TimetableCalendar = (() => {
  const key = date => date.toISOString().slice(0, 10);
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + "T12:00:00Z");
    return Number.isFinite(date.getTime()) && key(date) === value && value >= "1900-01-01" && value <= "2200-12-31";
  }
  function addDays(value, offset) {
    const date = new Date(value + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + offset);
    return key(date);
  }
  function monday(value) {
    const weekday = new Date(value + "T12:00:00Z").getUTCDay();
    return addDays(value, -((weekday + 6) % 7));
  }
  function shiftMonth(value, offset) {
    const date = new Date(value.slice(0, 7) + "-01T12:00:00Z");
    date.setUTCMonth(date.getUTCMonth() + offset);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(Number(value.slice(8)), last));
    const next = key(date);
    return validDate(next) ? next : value;
  }
  function monthDays(value) {
    const first = value.slice(0, 7) + "-01";
    const next = shiftMonth(first, 1);
    const last = next === first ? first.slice(0, 7) + "-31" : addDays(next, -1);
    const start = monday(first), end = addDays(monday(last), 6);
    const days = [];
    for (let day = start; day <= end; day = addDays(day, 1)) days.push({ date: day, inMonth: day.slice(0, 7) === first.slice(0, 7) });
    return days;
  }
  function hours(sessions) {
    return Number(sessions.reduce((total, session) => total + Math.max(0,
      (Date.parse(session.end + "Z") - Date.parse(session.start + "Z")) / 3600000), 0).toFixed(1));
  }
  return { validDate, addDays, monday, shiftMonth, monthDays, hours };
})();
if (typeof module !== "undefined") module.exports = TimetableCalendar;
