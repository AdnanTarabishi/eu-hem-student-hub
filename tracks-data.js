// ===== Tracks: data helpers =====
// Reads content/tracks.json and answers questions about it: which courses a track has,
// what the comparison table shows for a theme, which courses two tracks share, which track
// is in which city when. No page drawing here (that's tracks.js), so these functions can be
// used by other pages later and are tested in Node (scripts/check-content.js uses them too).

const TRACKS_URL = "content/tracks.json";
const TRACK_STATUS = { required: "Required course", elective: "Elective available", none: "Not in the curriculum" };

async function loadTracksFile(read) {
  const text = read ? await read(TRACKS_URL) : await (await fetch(TRACKS_URL)).text();
  return JSON.parse(text);
}

// The cohort to show: the one asked for, otherwise the newest (last in the file)
function tracksCohort(file, cohortId) {
  return file.cohorts.find((c) => c.id === cohortId) || file.cohorts[file.cohorts.length - 1];
}

function trackById(cohort, trackId) {
  return cohort.tracks.find((t) => t.id === trackId) || null;
}

// Course id -> { id, name, code, university, credits, themes }
function courseInfo(cohort, courseId) {
  const course = cohort.courses[courseId];
  return course ? { id: courseId, ...course } : null;
}

// Every course of a track once, with how it appears: "required" or "elective"
// (complementary "choose one" courses count as elective: the student chooses them)
function trackCourses(cohort, track) {
  const list = [];
  for (const semester of track.semesters) {
    for (const id of semester.required) list.push({ id, semester: semester.number, status: "required" });
    for (const choice of semester.choices) {
      for (const option of choice.options) {
        for (const id of option) list.push({ id, semester: semester.number, status: "elective", kind: choice.kind });
      }
    }
  }
  return list;
}

// One cell of the comparison table: { status: "required" | "elective" | "none", required: [names], elective: [names] }
function themeCell(cohort, track, themeId) {
  const cell = { status: "none", required: [], elective: [] };
  for (const item of trackCourses(cohort, track)) {
    const course = courseInfo(cohort, item.id);
    if (!course || !course.themes.includes(themeId)) continue;
    const bucket = cell[item.status];
    if (!bucket.includes(course.name)) bucket.push(course.name);
  }
  cell.status = cell.required.length ? "required" : cell.elective.length ? "elective" : "none";
  return cell;
}

// Courses (same course id) that two tracks share
function sharedCourses(cohort, trackA, trackB) {
  const idsB = new Set(trackCourses(cohort, trackB).map((c) => c.id));
  const seen = new Set();
  return trackCourses(cohort, trackA)
    .filter((c) => idsB.has(c.id) && !seen.has(c.id) && seen.add(c.id))
    .map((c) => courseInfo(cohort, c.id));
}

// Cities two tracks share: [{ city, semesterA, semesterB }]
function sharedCities(cohort, trackA, trackB) {
  const result = [];
  for (const a of trackA.semesters) {
    for (const b of trackB.semesters) {
      if (a.university === b.university) {
        result.push({ city: cohort.universities[a.university].city, semesterA: a.number, semesterB: b.number });
      }
    }
  }
  return result;
}

// Every pair of tracks with what they share (cities and courses); pairs sharing nothing are left out
function trackOverlaps(cohort) {
  const pairs = [];
  cohort.tracks.forEach((a, i) => {
    for (const b of cohort.tracks.slice(i + 1)) {
      const courses = sharedCourses(cohort, a, b);
      const cities = sharedCities(cohort, a, b);
      if (courses.length || cities.length) pairs.push({ a, b, courses, cities });
    }
  });
  return pairs.sort((x, y) => y.courses.length - x.courses.length);
}

// Who is in a university's city when: [{ track, semester }] (semester 1 = everyone, for Bologna)
function cityPresence(cohort, universityId) {
  const list = [];
  for (const track of cohort.tracks) {
    for (const semester of track.semesters) {
      if (semester.university === universityId) list.push({ track, semester: semester.number });
    }
  }
  return list.sort((x, y) => x.semester - y.semester);
}

// "Rotterdam → Oslo"
function trackRoute(cohort, track) {
  return track.semesters.map((s) => cohort.universities[s.university].city).join(" → ");
}

// ----- "My track", saved in this browser only -----
const MY_TRACK_KEY = "euhem-track-v1";

// { cohort, track } or null. Other pages can use this later (e.g. a homepage card).
function loadMyTrack() {
  const saved = typeof readStorage === "function" ? readStorage(MY_TRACK_KEY, null) : null;
  return saved && typeof saved.track === "string" ? saved : null;
}

function saveMyTrack(cohortId, trackId) {
  if (typeof writeStorage !== "function") return false;
  return trackId ? writeStorage(MY_TRACK_KEY, { cohort: cohortId, track: trackId }) : writeStorage(MY_TRACK_KEY, null);
}

if (typeof module !== "undefined") {
  module.exports = {
    TRACKS_URL, TRACK_STATUS, loadTracksFile, tracksCohort, trackById, courseInfo, trackCourses,
    themeCell, sharedCourses, sharedCities, trackOverlaps, cityPresence, trackRoute, MY_TRACK_KEY,
  };
}
