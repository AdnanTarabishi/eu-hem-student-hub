// ===== Students directory =====
// Loads students from a CSV file and shows them as cards with search and filters.

// ----- Settings -----

// Where the student list comes from. To switch to real data, replace this with the
// published Google Sheets CSV link (File -> Share -> Publish to web -> CSV).
// ⚠️ "Publish to web" makes the WHOLE tab public. Publish a separate tab that contains
// ONLY students who gave consent and ONLY the 4 columns below - never the raw form
// responses (which include emails and timestamps).
const DATA_SOURCE_URL = "data/sample-students.csv";

// Google Form for joining the directory. Leave empty until the form exists.
const JOIN_FORM_URL = "";

// Column headers in the CSV. Only these columns are ever shown; any others are ignored.
const COLUMNS = {
  name: "Full name",
  country: "Country / origin",
  background: "Previous study / background",
  track: "Preferred track",
};

// The demo banner shows automatically while we use the sample file
const IS_DEMO = DATA_SOURCE_URL === "data/sample-students.csv";

// Label used in the filters for students who left a field empty
const NOT_SPECIFIED = "Not specified";

// ----- Page elements -----

const studentRows = document.getElementById("student-rows");
const studentCount = document.getElementById("student-count");
const studentTotals = document.getElementById("student-totals");
const studentSearch = document.getElementById("student-search");
const countryFilter = document.getElementById("country-filter");
const trackTabs = document.getElementById("track-tabs");

let allStudents = [];

// The track tab that is currently selected ("" = All)
let selectedTrack = "";

// Each track gets its own pill colour: { "Policy": "track-color-2", ... }
let trackColors = {};

// ----- Reading the CSV (parseCsv is in utils.js) -----

// Turns CSV rows into student objects, using the header row to find each column
function rowsToStudents(rows) {
  const headers = rows[0].map((header) => header.trim());
  const columnIndex = {};
  for (const [key, header] of Object.entries(COLUMNS)) {
    columnIndex[key] = headers.indexOf(header);
  }

  return rows
    .slice(1)
    .map((row) => {
      const student = {};
      for (const key of Object.keys(COLUMNS)) {
        const index = columnIndex[key];
        student[key] = index >= 0 ? (row[index] || "").trim() : "";
      }
      return student;
    })
    .filter((student) => Object.values(student).some(Boolean)); // skip completely empty rows
}

// ----- Search and filters -----

// "José" -> "jose": lower case and without accents, so searches match either way
function simplify(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function filterStudents(students, searchText, country, track) {
  const search = simplify(searchText.trim());
  return students.filter((student) => {
    if (country && (student.country || NOT_SPECIFIED) !== country) return false;
    if (track && (student.track || NOT_SPECIFIED) !== track) return false;
    if (search) {
      const searchable = simplify(Object.values(student).join(" "));
      if (!searchable.includes(search)) return false;
    }
    return true;
  });
}

// plural(1, "student") -> "1 student"; plural(25, "student") -> "25 students"
function plural(count, singular, pluralWord = singular + "s") {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

// ----- Building the page -----

// Sorted list of values, with "Not specified" (empty fields) at the end
function uniqueValues(values) {
  return [...new Set(values.map((value) => value || NOT_SPECIFIED))].sort((a, b) => {
    if (a === NOT_SPECIFIED) return 1;
    if (b === NOT_SPECIFIED) return -1;
    return a.localeCompare(b);
  });
}

function fillCountryFilter() {
  for (const country of uniqueValues(allStudents.map((s) => s.country))) {
    countryFilter.appendChild(new Option(country, country));
  }
}

// One tab per track, plus "All". Clicking a tab filters the table.
function buildTrackTabs() {
  const tracks = uniqueValues(allStudents.map((s) => s.track));
  tracks.filter((t) => t !== NOT_SPECIFIED).forEach((track, index) => {
    trackColors[track] = `track-color-${index % 4}`;
  });

  for (const track of ["", ...tracks]) {
    const tab = createElement("button", "track-tab", track || "All");
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.dataset.track = track;
    tab.addEventListener("click", () => selectTrack(track));
    trackTabs.appendChild(tab);
  }
  updateTabs();
}

function selectTrack(track) {
  selectedTrack = track;
  updateTabs();
  renderStudents();
}

// Highlights the selected tab
function updateTabs() {
  for (const tab of trackTabs.children) {
    tab.setAttribute("aria-selected", String(tab.dataset.track === selectedTrack));
  }
}

// "Amara Okonkwo-Lindqvist" -> "AO"
function initials(name) {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// One table cell. "label" is shown before the value on phones (via CSS); empty values show a dash.
function tableCell(label, value, className) {
  const cell = createElement("td", className);
  cell.dataset.label = label;
  if (value) {
    cell.textContent = value;
  } else {
    cell.appendChild(createElement("span", "empty-value", "—"));
  }
  return cell;
}

function studentRow(student, number) {
  const row = createElement("tr");
  row.appendChild(createElement("td", "col-number", String(number)));

  // Avatar + name sit in an inner box, so the cell itself stays a normal table cell
  const nameCell = createElement("td", "col-name");
  const nameBox = createElement("div", "name-box");
  nameBox.appendChild(createElement("span", "student-avatar", initials(student.name)));
  nameBox.appendChild(createElement("span", "student-name", student.name || "Name not shared"));
  nameCell.appendChild(nameBox);
  row.appendChild(nameCell);

  row.appendChild(tableCell("Country", student.country));
  row.appendChild(tableCell("Background", student.background));

  const trackCell = createElement("td");
  trackCell.dataset.label = "Track";
  if (student.track) {
    trackCell.appendChild(createElement("span", `track-pill ${trackColors[student.track] || ""}`, student.track));
  } else {
    trackCell.appendChild(createElement("span", "track-pill track-none", "Not decided yet"));
  }
  row.appendChild(trackCell);
  return row;
}

function renderStudents() {
  const visible = filterStudents(allStudents, studentSearch.value, countryFilter.value, selectedTrack);
  const isFiltered = visible.length !== allStudents.length;

  const countries = new Set(allStudents.map((s) => s.country).filter(Boolean));
  studentTotals.textContent = isFiltered
    ? `Showing ${visible.length} of ${plural(allStudents.length, "student")}`
    : `${plural(allStudents.length, "student")} from ${plural(countries.size, "country", "countries")}`;

  studentRows.innerHTML = "";
  if (visible.length === 0) {
    const row = createElement("tr", "empty-row");
    const cell = createElement("td");
    cell.colSpan = 5;
    cell.appendChild(createElement("p", null, "No students match your search."));
    const clearButton = createElement("button", "button", "Clear filters");
    clearButton.type = "button";
    clearButton.addEventListener("click", clearFilters);
    cell.appendChild(clearButton);
    row.appendChild(cell);
    studentRows.appendChild(row);
    return;
  }
  visible.forEach((student, index) => studentRows.appendChild(studentRow(student, index + 1)));
}

function clearFilters() {
  studentSearch.value = "";
  countryFilter.value = "";
  selectTrack("");
}

function setUpJoinButton() {
  const button = document.getElementById("join-button");
  if (JOIN_FORM_URL) {
    button.href = JOIN_FORM_URL;
    button.target = "_blank";
    button.rel = "noopener";
  } else {
    button.textContent = "Join the directory (form coming soon)";
    button.removeAttribute("href");
    button.setAttribute("aria-disabled", "true");
    button.classList.add("is-disabled");
  }
}

async function loadStudents() {
  document.getElementById("demo-banner").hidden = !IS_DEMO;
  setUpJoinButton();

  try {
    const response = await fetch(DATA_SOURCE_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    allStudents = rowsToStudents(parseCsv(await response.text()));

    studentCount.textContent = plural(allStudents.length, "student");
    fillCountryFilter();
    buildTrackTabs();
    renderStudents();
  } catch (error) {
    console.error("Could not load students:", error);
    studentTotals.textContent = "Sorry, the student directory could not be loaded right now.";
  }
}

// "input" fires on every key press, so results update while typing
studentSearch.addEventListener("input", renderStudents);
countryFilter.addEventListener("change", renderStudents);

loadStudents();
