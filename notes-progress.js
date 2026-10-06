// ===== Study progress (saved only in this browser) =====
// - Topic status: Read / Understood
// - Smart flashcards: when each card is due again (spaced repetition)
// - Best quiz score per course
// - Study streak (days in a row with any study activity)
// - Backup / restore / reset
//
// Everything is stored in one browser storage entry. The "-v1" in its name is a version
// number: if the format ever changes, a new version can convert old progress safely.

const PROGRESS_KEY = "euhem-progress-v1";
const TOPIC_STATUSES = ["", "read", "understood"];
const CARD_GRADES = ["again", "hard", "good", "easy"];
const MAX_INTERVAL_DAYS = 365;

function emptyProgress() {
  return { version: 1, topics: {}, cards: {}, quizzes: {}, lectures: {}, statistics: {}, activity: [] };
}

// Reads progress and repairs anything unexpected, so a damaged entry never breaks the page
function loadProgress() {
  const stored = readStorage(PROGRESS_KEY, null);
  const progress = emptyProgress();
  if (!stored || typeof stored !== "object") return progress;
  for (const key of ["topics", "cards", "quizzes", "lectures", "statistics"]) {
    if (stored[key] && typeof stored[key] === "object") progress[key] = stored[key];
  }
  if (Array.isArray(stored.activity)) progress.activity = stored.activity.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  return progress;
}

function saveProgress(progress) {
  return writeStorage(PROGRESS_KEY, progress);
}

// "2026-10-03" + 3 -> "2026-10-06"
function addDays(dateKey, days) {
  const date = new Date(dateKey + "T12:00:00");
  date.setDate(date.getDate() + days);
  return dateToKey(date);
}

// ----- Activity and streak -----

// Remembers that the student studied on this day
function recordActivity(progress, today) {
  if (!progress.activity.includes(today)) {
    progress.activity.push(today);
    progress.activity.sort();
    progress.activity = progress.activity.slice(-400); // about a year is enough
  }
}

// Days in a row with activity, ending today (or yesterday, so the streak isn't
// "broken" in the morning before you've studied)
function currentStreak(activity, today) {
  const days = new Set(activity);
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

// ----- Topics -----

function getTopicStatus(progress, topicId) {
  const status = progress.topics[topicId];
  return TOPIC_STATUSES.includes(status) ? status : "";
}

function setTopicStatus(topicId, status) {
  const progress = loadProgress();
  if (status) {
    progress.topics[topicId] = status;
    recordActivity(progress, todayKey());
  } else {
    delete progress.topics[topicId];
  }
  saveProgress(progress);
}

// Progress of a course = topics with notes that are Read or Understood
function courseProgress(progress, course) {
  const topics = course.topics.filter((t) => t.notes);
  const read = topics.filter((t) => getTopicStatus(progress, t.id) === "read").length;
  const understood = topics.filter((t) => getTopicStatus(progress, t.id) === "understood").length;
  const total = topics.length;
  return { total, read, understood, percent: total ? Math.round(((read + understood) / total) * 100) : 0 };
}

// ----- Smart flashcards (spaced repetition) -----
// Each card remembers: interval (days until next review), due (date), reviews, lapses (times forgotten).
// A simplified version of the SM-2 idea used by Anki:
//   Again -> review again today      Hard -> about the same interval (at least 1 day)
//   Good  -> interval x 2.5 (new: 1)  Easy -> interval x 4 (new: 4)

function scheduleCard(state, grade, today) {
  const previous = state || { interval: 0, reviews: 0, lapses: 0 };
  const interval = previous.interval || 0;
  let next;
  if (grade === "again") next = 0;
  else if (grade === "hard") next = Math.max(1, Math.round(interval * 1.2));
  else if (grade === "good") next = interval ? Math.round(interval * 2.5) : 1;
  else if (grade === "easy") next = interval ? Math.round(interval * 4) : 4;
  else throw new Error(`Unknown grade "${grade}"`);
  next = Math.min(next, MAX_INTERVAL_DAYS);
  return {
    interval: next,
    due: addDays(today, next),
    reviews: (previous.reviews || 0) + 1,
    lapses: (previous.lapses || 0) + (grade === "again" ? 1 : 0),
    lastGrade: grade,
  };
}

function gradeCard(cardId, grade) {
  const progress = loadProgress();
  const today = todayKey();
  progress.cards[cardId] = scheduleCard(progress.cards[cardId], grade, today);
  recordActivity(progress, today);
  saveProgress(progress);
  return progress.cards[cardId];
}

// A card is due if it was never studied, or its due date has arrived
function isCardDue(progress, cardId, today) {
  const state = progress.cards[cardId];
  return !state || !state.due || state.due <= today;
}

function dueCards(progress, cards, today) {
  return cards.filter((card) => isCardDue(progress, card.id, today));
}

// When the next card in a set becomes due (for "Next review: 5 Oct")
function nextDueDate(progress, cards) {
  const dates = cards.map((c) => progress.cards[c.id] && progress.cards[c.id].due).filter(Boolean).sort();
  return dates[0] || null;
}

// ----- Quizzes -----

function recordQuiz(courseId, percent) {
  const progress = loadProgress();
  const today = todayKey();
  const previous = progress.quizzes[courseId] || { best: 0, attempts: 0 };
  progress.quizzes[courseId] = {
    best: Math.max(previous.best || 0, percent),
    last: percent,
    lastDate: today,
    attempts: (previous.attempts || 0) + 1,
  };
  recordActivity(progress, today);
  saveProgress(progress);
  return progress.quizzes[courseId];
}

// ----- Backup, restore, reset -----

// The backup file: progress + My Study List, with a header so we can recognise it later
function exportProgressText() {
  return JSON.stringify({
    app: "eu-hem-student-hub",
    type: "study-progress",
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: loadProgress(),
    studyList: getStudyList(),
  }, null, 2);
}

// Checks a backup file and restores it. Returns a short summary, or throws a clear error.
function importProgressText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a valid progress backup (it can't be read).");
  }
  if (!data || data.app !== "eu-hem-student-hub" || data.type !== "study-progress") {
    throw new Error("This file isn't a progress backup from the EU-HEM Student Hub.");
  }
  if (data.version !== 1) throw new Error("This backup comes from a newer version of the site.");
  writeStorage(PROGRESS_KEY, data.progress || emptyProgress());
  const progress = loadProgress(); // repairs anything unexpected
  saveProgress(progress);
  if (Array.isArray(data.studyList)) writeStorage(STUDY_LIST_KEY, data.studyList);
  return {
    topics: Object.keys(progress.topics).length,
    cards: Object.keys(progress.cards).length,
    quizzes: Object.keys(progress.quizzes).length,
  };
}

function resetProgress() {
  saveProgress(emptyProgress());
}

if (typeof module !== "undefined") {
  module.exports = { scheduleCard, currentStreak, addDays, courseProgress, emptyProgress, getTopicStatus, isCardDue };
}
