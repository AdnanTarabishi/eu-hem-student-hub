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

const studentGrid = document.getElementById("student-grid");
const studentTotals = document.getElementById("student-totals");
const studentSearch = document.getElementById("student-search");
const countryFilter = document.getElementById("country-filter");
const trackFilter = document.getElementById("track-filter");

let allStudents = [];

// ----- Reading the CSV -----

// Turns CSV text into rows of fields. Handles the CSV rules Google Sheets uses:
// fields in "quotes" may contain commas or line breaks, and "" inside quotes means one ".
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (insideQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++; // skip the second quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      insideQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++; // Windows line ending (\r\n)
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  // Last line, if the file doesn't end with a line break
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

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

function fillFilter(select, values) {
  const options = [...new Set(values.map((value) => value || NOT_SPECIFIED))].sort((a, b) => {
    // Keep "Not specified" at the end of the list
    if (a === NOT_SPECIFIED) return 1;
    if (b === NOT_SPECIFIED) return -1;
    return a.localeCompare(b);
  });
  for (const value of options) {
    select.appendChild(new Option(value, value));
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

function studentCard(student) {
  const card = createElement("div", "student-card");

  const header = createElement("div", "student-header");
  header.appendChild(createElement("div", "student-avatar", initials(student.name)));
  const nameBlock = createElement("div");
  nameBlock.appendChild(createElement("div", "student-name", student.name || "Name not shared"));
  if (student.country) nameBlock.appendChild(createElement("div", "schedule-meta", student.country));
  header.appendChild(nameBlock);
  card.appendChild(header);

  if (student.background) card.appendChild(createElement("div", "student-background", student.background));

  if (student.track) {
    card.appendChild(createElement("span", "badge", student.track));
  } else {
    card.appendChild(createElement("span", "student-no-track", "Track not decided yet"));
  }
  return card;
}

function renderStudents() {
  const visible = filterStudents(allStudents, studentSearch.value, countryFilter.value, trackFilter.value);
  const isFiltered = visible.length !== allStudents.length;

  const countries = new Set(allStudents.map((s) => s.country).filter(Boolean));
  studentTotals.textContent = isFiltered
    ? `Showing ${visible.length} of ${plural(allStudents.length, "student")}`
    : `${plural(allStudents.length, "student")} from ${plural(countries.size, "country", "countries")}`;

  studentGrid.innerHTML = "";
  if (visible.length === 0) {
    const empty = createElement("div", "student-empty");
    empty.appendChild(createElement("p", null, "No students match your search."));
    const clearButton = createElement("button", "button", "Clear filters");
    clearButton.type = "button";
    clearButton.addEventListener("click", clearFilters);
    empty.appendChild(clearButton);
    studentGrid.appendChild(empty);
    return;
  }
  for (const student of visible) {
    studentGrid.appendChild(studentCard(student));
  }
}

function clearFilters() {
  studentSearch.value = "";
  countryFilter.value = "";
  trackFilter.value = "";
  renderStudents();
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

    fillFilter(countryFilter, allStudents.map((s) => s.country));
    fillFilter(trackFilter, allStudents.map((s) => s.track));
    renderStudents();
  } catch (error) {
    console.error("Could not load students:", error);
    studentTotals.textContent = "Sorry, the student directory could not be loaded right now.";
  }
}

// "input" fires on every key press, so results update while typing
studentSearch.addEventListener("input", renderStudents);
countryFilter.addEventListener("change", renderStudents);
trackFilter.addEventListener("change", renderStudents);

loadStudents();
