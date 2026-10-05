// ===== City guides: data helpers =====
// The list of city guides and the rules every guide follows. No page drawing here (that's
// guide.js), so the search window and scripts/check-content.js can use the same functions.

// One line per city. `university` is its id in content/tracks.json, where the city's name,
// country and university name are written (only there). `file: null` = guide not written yet.
// To add a city: write docs/content/<city>-guide.md and add one line here (see docs/city-guides.md).
const CITY_GUIDES = [
  { id: "bologna", university: "unibo", file: "docs/content/bologna-guide.md" },
  { id: "oslo", university: "uio", file: "docs/content/oslo-guide.md" },
  { id: "rotterdam", university: "eur", file: "docs/content/rotterdam-guide.md" },
  { id: "innsbruck", university: "mci", file: "docs/content/innsbruck-guide.md" },
];

// Every guide has these sections, in this order, as "## 1. At a glance" … "## 16. Sources"
const GUIDE_SECTIONS = [
  "At a glance", "Before you move", "Residence and registration", "Healthcare", "Housing",
  "Getting around", "Money and phone", "Cost of living", "Study places and campus",
  "Food and daily life", "Weather and what to pack", "Sport, social life and student organisations",
  "Useful apps and websites", "Emergency numbers", "Student tips", "Sources",
];

// The facts block at the top of a guide. The "At a glance" box and the comparison table of all
// cities are built from it, so each fact is typed once.
const GUIDE_FACTS = {
  host: "Hosted by",
  language: "Language",
  currency: "Currency",
  "cost-vs-bologna": "Cost compared with Bologna",
  "compare-rent": "Student room",
  "compare-budget": "Monthly budget",
  "compare-transport": "Transport pass",
  "compare-permit-non-eu": "Residence step for non-EU students",
};
const GUIDE_REQUIRED_FACTS = ["university", "last-checked", ...Object.keys(GUIDE_FACTS)];

// "1. Before you move" -> "before-you-move"
function guideHeadingId(text) {
  return text.toLowerCase().replace(/^\d+\.\s*/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Splits a guide file into its facts block and its Markdown body.
// -> { facts: { university: "uio", … }, body: "# Oslo …", structured: true }
// A guide without a facts block (the older Bologna format) gives structured: false.
function parseGuide(text) {
  const normalised = text.replace(/\r\n/g, "\n");
  const match = normalised.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { facts: {}, body: normalised, structured: false };
  const facts = {};
  for (const line of match[1].split("\n")) {
    const at = line.indexOf(":");
    if (at > 0) facts[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { facts, body: normalised.slice(match[0].length), structured: true };
}

// The guide's "## " sections: [{ heading: "5. Housing", title: "Housing", text }]
function guideSections(body) {
  return body.split(/\n(?=## )/).slice(1).map((part) => {
    const heading = part.split("\n")[0].replace(/^##\s+/, "").trim();
    return { heading, title: heading.replace(/^\d+\.\s*/, ""), text: part.split("\n").slice(1).join("\n") };
  });
}

// Source tags in a text: "NOK 393 [S12][S3]" -> ["S12", "S3"]
function sourceTags(text) {
  return [...text.matchAll(/\[(S\d+)\]/g)].map((m) => m[1]);
}

// "Semester 1: all tracks · Semester 2: E&P, MHI · Semester 3: EEH" for one university (from tracks.json)
function cityPresenceText(cohort, universityId) {
  const parts = [];
  if (cohort.semester1 && cohort.semester1.university === universityId) parts.push("Semester 1: all tracks");
  const bySemester = {};
  for (const track of cohort.tracks) {
    for (const semester of track.semesters) {
      if (semester.university === universityId) (bySemester[semester.number] = bySemester[semester.number] || []).push(track.abbr);
    }
  }
  for (const number of Object.keys(bySemester).sort()) parts.push(`Semester ${number}: ${bySemester[number].join(", ")}`);
  return parts.join(" · ");
}

// When a semester takes place, from the cohort id ("2026-2028"): odd semesters are autumn,
// even ones spring. `ends` is a rough last day, only used to pick the student's next city.
function semesterTiming(cohortId, number) {
  const firstYear = parseInt(cohortId, 10);
  const year = firstYear + Math.floor(number / 2);
  const autumn = number % 2 === 1;
  return { label: `${autumn ? "autumn" : "spring"} ${year}`, ends: autumn ? `${year + 1}-01-31` : `${year}-07-31` };
}

// A track's cities after Semester 1, each with its timing, and which one comes next.
// -> [{ number: 2, university: "uio", city: "Oslo", label: "spring 2027", next: true }, …]
// (no entry has next: true once all of them have ended)
function trackCityTimeline(cohort, track, today) {
  let nextFound = false;
  return track.semesters.map((semester) => {
    const timing = semesterTiming(cohort.id, semester.number);
    const next = !nextFound && today <= timing.ends;
    if (next) nextFound = true;
    return { number: semester.number, university: semester.university, city: cohort.universities[semester.university].city, label: timing.label, next };
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    CITY_GUIDES, GUIDE_SECTIONS, GUIDE_FACTS, GUIDE_REQUIRED_FACTS, guideHeadingId, parseGuide,
    guideSections, sourceTags, cityPresenceText, semesterTiming, trackCityTimeline,
  };
}
