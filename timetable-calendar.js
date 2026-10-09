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
  // The feed uses Bologna wall-clock timestamps, not the visitor's timezone.
  // Assign a class to the month of its start, exactly as the Month calendar does.
  // Count the full duration only when its published end has passed; never infer attendance.
  function monthlyProgress(sessions, selectedDate, now) {
    const month = typeof selectedDate === "string" ? selectedDate.slice(0, 7) : "";
    const unavailable = { state: "unavailable", month, percentage: null };
    function timestamp(value) {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value) ||
          !validDate(value.slice(0, 10)) || Number(value.slice(11, 13)) > 23 ||
          Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return NaN;
      return Date.parse(value + "Z");
    }
    const nowTime = timestamp(now);
    if (!Array.isArray(sessions) || !validDate(selectedDate) || !Number.isFinite(nowTime)) return unavailable;
    let totalMs = 0, completedMs = 0, totalClasses = 0, completedClasses = 0, activeClasses = 0;
    for (const session of sessions) {
      // Malformed undated entries make a denominator unreliable; do not silently drop them.
      if (!session || !validDate(session.dateKey) || typeof session.start !== "string") return unavailable;
      if (session.dateKey.slice(0, 7) !== month) continue;
      const start = timestamp(session.start), end = timestamp(session.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
          session.dateKey !== session.start.slice(0, 10)) return unavailable;
      totalClasses++;
      totalMs += end - start;
      if (end <= nowTime) { completedMs += end - start; completedClasses++; }
      else if (start <= nowTime) activeClasses++;
    }
    // Floor to one decimal: 100% is reserved for all published classes actually ending.
    const percentage = totalMs ? completedMs === totalMs ? 100 :
      Math.min(99.9, Math.floor(completedMs / totalMs * 1000 + 1e-9) / 10) : null;
    return { state: totalMs ? "ready" : "empty", month, percentage,
      completedHours: completedMs / 3600000, totalHours: totalMs / 3600000,
      remainingHours: (totalMs - completedMs) / 3600000,
      completedClasses, totalClasses, activeClasses };
  }
  return { validDate, addDays, monday, shiftMonth, monthDays, hours, monthlyProgress };
})();
if (typeof module !== "undefined") module.exports = TimetableCalendar;
