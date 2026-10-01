// ===== Shared helpers =====
// Small functions used by both timetable.js and exams.js.
// This file must be loaded before them in index.html.

// "INTRODUCTION TO ECONOMICS" -> "Introduction To Economics"
function toTitleCase(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// A Date -> "YYYY-MM-DD". This format sorts and compares correctly as plain text.
function dateToKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Today's date as "YYYY-MM-DD"
function todayKey() {
  return dateToKey(new Date());
}

// "2026-10-05" -> "Monday 5 October 2026"
function formatDay(dateKey, options = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  const date = new Date(dateKey + "T12:00:00");
  return date.toLocaleDateString("en-GB", options);
}

// Number of days from one "YYYY-MM-DD" to another
function daysBetween(fromKey, toKey) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / oneDay);
}

// Creates an HTML element with optional CSS class and text
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
