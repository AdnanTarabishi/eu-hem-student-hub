// Practical classroom guide for first-year EU-HEM locations in Bologna.
// Floor and entrance facts come from official UniBo facility/course timetable pages.
const TimetableLocations = (() => {
  const CHECKED = "10 Oct 2026";
  const FACILITIES = "https://corsi.unibo.it/2cycle/euHealthEconomicsManagement/classrooms-labs-and-libraries";
  const SOURCE = {
    healthEconomics: "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2026/518742/orariolezioni",
    fundamentalsStatistics: "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2026/518697/orariolezioni",
    statistics: "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2026/518721/orariolezioni",
    rightToHealth: "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2026/518699/orariolezioni",
    healthcareManagement: "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2026/518743/orariolezioni",
    healthSystems: "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2026/558081/orariolezioni",
    econometrics: "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2026/518698/orariolezioni",
    internationalLaw: "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2026/520850/orariolezioni"
  };
  const clean = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\"()]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  const has = (text, ...needles) => needles.every(needle => text.includes(clean(needle)));
  const entry = data => ({ checked: CHECKED, ...data });
  function scaravilliFloor(text) {
    if (/\baula\s+(1|2|3|4|5)\b/.test(text)) return "Ground floor";
    if (/\baula\s+(11|12)\b/.test(text) || text.includes("aula magna")) return "First floor";
    if (/\baula\s+(21|22|31)\b/.test(text)) return "Second floor";
    if (/\baula\s+32\b/.test(text)) return "Third floor";
    return "";
  }
  function lookup(raw) {
    const text = clean(raw); if (!text) return null;
    if (has(text, "aula magna istologia carinci")) return entry({ building:"Histology teaching building (Via Selmi 3)", floor:"Ground floor", entrance:"Via Belmeloro 8", address:"Via Belmeloro 8, Bologna", guidance:"Important: UniBo lists the building at Via Selmi 3 but explicitly says this classroom is accessed from Via Belmeloro 8. Use the Belmeloro entrance rather than searching only for the Selmi-side address.", sourceUrl:SOURCE.rightToHealth });
    if (has(text, "aula magna anatomia comparata")) return entry({ building:"Comparative Anatomy teaching building", floor:"Second floor", entrance:"Via Selmi 3", address:"Via Selmi 3, Bologna", guidance:"Enter from Via Selmi 3 and go to the second floor. This is not the ground-floor Istologia Carinci room, which has a separate Belmeloro entrance.", sourceUrl:SOURCE.fundamentalsStatistics });
    if (has(text, "aula esercitazioni anatomia comparata")) return entry({ building:"Comparative Anatomy teaching building", floor:"Fourth floor", entrance:"Via Selmi 3", address:"Via Selmi 3, Bologna", guidance:"Use the Via Selmi 3 entrance and continue to the fourth floor. The room is different from Aula Magna Anatomia Comparata on the second floor.", sourceUrl:SOURCE.fundamentalsStatistics });
    if (has(text, "aula a ghigi")) return entry({ building:"Via Selmi 3 teaching building", floor:"Ground floor", entrance:"Via San Giacomo 9", address:"Via San Giacomo 9, Bologna", guidance:"UniBo identifies this room with the Via Selmi 3 building but explicitly marks access from Via San Giacomo 9. Follow the access address.", sourceUrl:SOURCE.rightToHealth });
    if (has(text, "anatomia olivo")) return entry({ building:"Anatomy teaching building", floor:"Ground floor", entrance:"Via Irnerio 48", address:"Via Irnerio 48, Bologna", guidance:"Aula Magna Anatomia Olivo is on the ground floor at Via Irnerio 48. Several Anatomy/Pharmacology rooms share this address, so check the exact room name on the door.", sourceUrl:SOURCE.healthEconomics });
    if (has(text, "aula a farmacologia")) return entry({ building:"Anatomy / Pharmacology teaching building", floor:"Ground floor", entrance:"Via Irnerio 48", address:"Via Irnerio 48, Bologna", guidance:"This is the ground-floor Pharmacology room at Via Irnerio 48. Do not confuse it with similarly named rooms at Via Irnerio 42.", sourceUrl:SOURCE.healthSystems });
    if (has(text, "aula b anatomia")) return entry({ building:"Anatomy teaching building", floor:"Ground floor", entrance:"Via Irnerio 48", address:"Via Irnerio 48, Bologna", guidance:"Aula B (Anatomia) is on the ground floor at Via Irnerio 48. Check for the Anatomia label because another Aula B is listed at Via Irnerio 42.", sourceUrl:SOURCE.rightToHealth });
    if (has(text, "irnerio 42", "aula b")) return entry({ building:"Via Irnerio 42 teaching building", floor:"Ground floor", entrance:"Via Irnerio 42", address:"Via Irnerio 42, Bologna", guidance:"This Aula B is at Via Irnerio 42, not Aula B (Anatomia) at Via Irnerio 48. Check the street number before entering.", sourceUrl:SOURCE.fundamentalsStatistics });
    if (text.includes("scaravilli")) {
      const floor = scaravilliFloor(text);
      return entry({ building:"Piazza Scaravilli teaching building", floor, entrance:"Piazza Antonino Scaravilli 1/2", address:"Piazza Antonino Scaravilli 1/2, Bologna", guidance:floor ? "Use the Piazza Scaravilli 1/2 entrance. UniBo lists this classroom on the "+floor.toLowerCase()+"; room numbers are spread across several floors, so check the number before going upstairs." : "Use the Piazza Scaravilli 1/2 entrance. The building contains classrooms on several floors; check the exact Aula number on the official timetable.", sourceUrl:FACILITIES });
    }
    if (has(text, "ranzani 14")) {
      const floor = /ranzani\s+[cd]\b/.test(text) ? "First floor" : "Ground floor";
      return entry({ building:"Ranzani 14 teaching building", floor, entrance:"Via Camillo Ranzani 14", address:"Via Camillo Ranzani 14, Bologna", guidance:"This is the Ranzani 14 lecture-hall building. Do not confuse it with the computer labs at Via Ranzani 1, which use a different entrance.", sourceUrl:FACILITIES });
    }
    if (has(text, "ranzani 1")) return entry({ building:"Ranzani 1 computer-lab / classroom building", floor:"Ground floor", entrance:"Via Ranzani 1", address:"Via Ranzani 1, Bologna", guidance:"Lab G, Lab T, Lab PT and the small Ranzani classrooms listed by EU-HEM are on the ground floor at Via Ranzani 1. This is a different building from Ranzani A-D at number 14.", sourceUrl:FACILITIES });
    if (has(text, "porta san donato 5", "vii piano")) return entry({ building:"Piazza di Porta San Donato 5", floor:"Seventh floor", entrance:"Piazza di Porta San Donato 5", address:"Piazza di Porta San Donato 5, Bologna", guidance:"The room name is literal: Aula VII Piano is on the seventh floor. Allow extra time to reach the correct floor.", sourceUrl:SOURCE.rightToHealth });
    if (has(text, "porta san donato 5", "enriques")) return entry({ building:"Piazza di Porta San Donato 5", floor:"Ground floor", entrance:"Piazza di Porta San Donato 5", address:"Piazza di Porta San Donato 5, Bologna", guidance:"Aula Enriques is on the ground floor. The same building contains rooms on several higher floors, so use the room name as well as the address.", sourceUrl:SOURCE.econometrics });
    if (has(text, "porta san donato 1")) return entry({ building:"Porta San Donato 1 teaching building", floor:"Ground floor", entrance:"Piazza di Porta San Donato 1", address:"Piazza di Porta San Donato 1, Bologna", guidance:"Aula M1 C. Andreatta is listed on the ground floor at Piazza di Porta San Donato 1. Note that this is number 1, not the larger teaching building at number 5.", sourceUrl:SOURCE.statistics });
    if (has(text, "centotrecento 18")) return entry({ building:"Via Centotrecento 18 teaching building", floor:"Ground floor", entrance:"Via Centotrecento 18", address:"Via Centotrecento 18, Bologna", guidance:"UniBo explicitly lists access from Via Centotrecento 18 for these classrooms. The current first-year rooms here are on the ground floor.", sourceUrl:SOURCE.econometrics });
    if (has(text, "belle arti 41")) return entry({ building:"Via Belle Arti 41 teaching building", floor:"Ground floor", entrance:"Via delle Belle Arti 41", address:"Via delle Belle Arti 41, Bologna", guidance:"Aula Italo Scardovi (ex Aula I) is on the ground floor. The older ex Aula I name may still appear in schedules and signs.", sourceUrl:SOURCE.statistics });
    if (has(text, "berti pichat 6")) return entry({ building:"Berti Pichat 6-6/2 teaching building", floor:"Ground floor", entrance:"Viale Carlo Berti Pichat 6-6/2", address:"Viale Carlo Berti Pichat 6-6/2, Bologna", guidance:"Aula C is on the ground floor at numbers 6-6/2. Do not confuse this with Aula Magna at Viale Berti Pichat 5.", sourceUrl:SOURCE.healthEconomics });
    if (has(text, "berti pichat 5")) return entry({ building:"Berti Pichat 5 teaching building", floor:"First floor", entrance:"Viale Carlo Berti Pichat 5", address:"Viale Carlo Berti Pichat 5, Bologna", guidance:"Aula Magna is on the first floor at number 5. Other EU-HEM classes use Aula C at 6-6/2, so check the street number.", sourceUrl:SOURCE.healthEconomics });
    if (has(text, "san giacomo 3")) return entry({ building:"San Giacomo 3 teaching building", floor:"Ground floor", entrance:"Via San Giacomo 3", address:"Via San Giacomo 3, Bologna", guidance:"Aula S. Giacomo is on the ground floor at number 3. Other rooms used by the programme are at Via San Giacomo 12, so check the number.", sourceUrl:FACILITIES });
    if (has(text, "san giacomo 12")) return entry({ building:"San Giacomo 12 teaching building", floor:"Ground floor", entrance:"Via San Giacomo 12", address:"Via San Giacomo 12, Bologna", guidance:"Aula Ex Esercizi and Aula Magna Igiene are listed on the ground floor at number 12. This is not Aula S. Giacomo at number 3.", sourceUrl:SOURCE.healthcareManagement });
    if (has(text, "filippo re 10")) return entry({ building:"Via Filippo Re 10 teaching building", floor:"Ground floor", entrance:"Via Filippo Re 10", address:"Via Filippo Re 10, Bologna", guidance:"The Aula Magna used by Healthcare Management is on the ground floor at Via Filippo Re 10. Check the street number because UniBo has other Aula Magna rooms nearby.", sourceUrl:SOURCE.healthcareManagement });
    if (has(text, "zamboni 32")) return entry({ building:"Via Zamboni 32 teaching building", floor:"First floor", entrance:"Via Zamboni 32", address:"Via Zamboni 32, Bologna", guidance:"Aula Emilio Pasquini is on the first floor at Via Zamboni 32.", sourceUrl:SOURCE.econometrics });
    if (has(text, "san petronio vecchio 32")) return entry({ building:"San Petronio Vecchio 32 teaching building", floor:"Ground floor", entrance:"Via San Petronio Vecchio 32", address:"Via San Petronio Vecchio 32, Bologna", guidance:"Aula A - S.P.V. is listed on the ground floor at Via San Petronio Vecchio 32.", sourceUrl:SOURCE.internationalLaw });
    return null;
  }
  function searchText(raw) {
    const guide = lookup(raw);
    return guide ? [guide.building, guide.floor, guide.entrance, guide.address, guide.guidance].filter(Boolean).join(" ") : "";
  }
  return { lookup, searchText, checked: CHECKED };
})();
if (typeof module !== "undefined") module.exports = TimetableLocations;
