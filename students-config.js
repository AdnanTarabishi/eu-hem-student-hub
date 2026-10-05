// ===== Students explorer: settings =====
// Everything you may want to change about students.html lives here. Nothing in this file is secret,
// and nothing here can unlock private data: the "verified member" preview works on demo records only
// (students-data.js → projectProfile). See docs/students-explorer.md.
window.EUHEM_STUDENTS_CONFIG = {
  // Phase 1 has only "demo": 40 fictional people from data/demo-students.json.
  // Real profiles need the Phase 2 login and a server that applies the same privacy rules; do not
  // point this page at a Sheet export or any file with real registrations.
  dataMode: "demo",
  demoDataUrl: "data/demo-students.json",
  demoAggregatesUrl: "data/demo-aggregates.json",

  // The cohort selected when the page opens: the newest current cohort from directory-config.js
  defaultCohort: ((window.EUHEM_DIRECTORY_CONFIG || {}).cohorts || { current: [""] }).current[0],

  pageSize: 12, // profiles per page
  minGroupSize: 5, // statistics: smallest group that may be published (see safeBreakdown)
  savedStorageKey: "euhem-saved-profiles-v1", // this browser only; stores profile ids, nothing else
  joinUrl: "join.html",

  // Short labels and colours for the four tracks (as in content/tracks.json; the page uses the CSS tokens
  // --track-eeh … from style.css, which also have lighter dark-mode versions)
  tracks: {
    eeh: { short: "EEH", accent: "#2f6daa" },
    ep: { short: "E&P", accent: "#6b5aa6" },
    mhi: { short: "MHI", accent: "#c75b3a" },
    phm: { short: "PHM", accent: "#3d7d6a" },
  },

  // The map (built by scripts/build-world-map.js from Natural Earth). viewBox = the visible window.
  map: {
    url: "assets/map/world-countries.svg",
    views: { europe: "436 16 178 102", world: "0 0 1000 438" },
    defaultView: "europe",
    source: "Natural Earth 1:50m admin-0 countries v5.1.2 (public domain)",
  },
};
