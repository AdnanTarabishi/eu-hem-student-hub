// Last verified PUBLIC UniBo sessions only. No student preferences or personal data.
const TimetableSync = (() => {
  const STORAGE_KEY = "euhem-official-timetable-snapshot-v1";
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  function read(storage, cohort, now = Date.now()) {
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
      if (!saved || saved.cohort !== cohort || !Array.isArray(saved.sessions) ||
          !saved.sessions.length || saved.sessions.length > 2500) return null;
      const age = now - Date.parse(saved.verifiedAt);
      if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;
      return saved;
    } catch { return null; }
  }

  function save(storage, cohort, sessions, verifiedAt) {
    if (!Array.isArray(sessions) || !sessions.length || sessions.length > 2500) return false;
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify({ cohort, verifiedAt, sessions }));
      return true;
    } catch { return false; }
  }

  function sessionKey(session) {
    return [session.moduleCode, session.start].map(part => String(part || "").trim()).join("|");
  }

  function roomChanges(previous, current) {
    if (!Array.isArray(previous) || !Array.isArray(current)) return [];
    const previousByKey = new Map(previous.map(session => [sessionKey(session), session]));
    return current.flatMap(session => {
      const before = previousByKey.get(sessionKey(session));
      const oldRoom = String(before?.room || "").replace(/\s+/g, " ").trim();
      const newRoom = String(session.room || "").replace(/\s+/g, " ").trim();
      // No notices for new, removed, online or unassigned rooms.
      if (!oldRoom || !newRoom || oldRoom.toLocaleLowerCase() === newRoom.toLocaleLowerCase()) return [];
      return [{ moduleCode: session.moduleCode, dateKey: session.dateKey, time: session.time, before: oldRoom, after: newRoom }];
    });
  }

  return { STORAGE_KEY, read, save, roomChanges, sessionKey };
})();
if (typeof module !== "undefined") module.exports = TimetableSync;
