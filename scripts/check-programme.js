// ===== Programme vs UniBo: is programme.json still up to date? =====
// Compares the professors and teaching dates in content/programme.json with the live
// UniBo timetable feed, and lists any differences. It never changes anything:
// if something differs, check the official course page and update programme.json by hand.
//
// Run it with:  node scripts/check-programme.js

const fs = require("fs");
const path = require("path");
const rules = require("../programme.js");

const programme = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "programme.json"), "utf8"));
const cohort = rules.currentCohort(programme);
const term = rules.currentTerm(programme);

// "Andre Pieter Den Exter" vs "André den Exter": compare letters only, ignoring accents and case
const simple = (name) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const sameName = (a, b) => simple(a).includes(simple(b)) || simple(b).includes(simple(a)) ||
  simple(a).split("").sort().join("") === simple(b).split("").sort().join("");

async function main() {
  const response = await fetch(cohort.sources.timetableFeed);
  if (!response.ok) throw new Error(`Timetable feed: HTTP ${response.status}`);
  const feed = await response.json();

  // Per module code in the feed: first/last class and teachers
  const byCode = {};
  for (const s of feed) {
    const entry = (byCode[s.cod_modulo] = byCode[s.cod_modulo] || { start: s.start, end: s.end, teachers: new Set(), title: s.title });
    if (s.start < entry.start) entry.start = s.start;
    if (s.end > entry.end) entry.end = s.end;
    if (s.docente) entry.teachers.add(s.docente);
  }

  const notes = [];
  const known = new Set();
  for (const course of term.courses) {
    for (const module of course.modules) {
      known.add(module.code);
      const live = byCode[module.code];
      const where = `${module.code} ${module.name}`;
      if (!live) {
        notes.push(`${where}: not in the timetable feed (yet). Nothing to compare.`);
        continue;
      }
      const firstClass = live.start.slice(0, 10);
      const lastClass = live.end.slice(0, 10);
      if (firstClass < module.teachingStart || lastClass > module.teachingEnd) {
        notes.push(`${where}: classes run ${firstClass} to ${lastClass}, but programme.json says ${module.teachingStart} to ${module.teachingEnd}.`);
      }
      for (const teacher of live.teachers) {
        if (!module.professors.some((p) => sameName(p, teacher))) {
          notes.push(`${where}: the feed lists "${teacher}", who isn't in "professors" (${module.professors.join(", ")}).`);
        }
      }
    }
  }
  for (const [code, live] of Object.entries(byCode)) {
    if (!known.has(code)) notes.push(`${code} "${live.title}": in the timetable feed but not in programme.json.`);
  }

  console.log(`Compared ${known.size} modules of ${cohort.label} / ${term.label} with the UniBo timetable feed.`);
  if (notes.length === 0) {
    console.log("✔ Professors and teaching dates match.");
    return;
  }
  for (const note of notes) console.log(`  ⚠ ${note}`);
  console.log("\nCheck the official course pages, then update content/programme.json if needed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
