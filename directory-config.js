// Join the Directory: public configuration.
// Nothing in this file is secret. Never put a Sheet ID or Drive folder ID here.
window.EUHEM_DIRECTORY_CONFIG = {
  // The deployed Google Apps Script Web App address, ending in /exec.
  // Leave empty until the backend is deployed: the form then explains it is not open yet.
  endpoint: "",

  // Must match CONSENT_VERSION in integrations/directory-apps-script/Code.gs. Change both when the
  // privacy text changes meaning (see docs/student-directory.md); scripts/check-content.js compares them.
  consentVersion: "directory-v2-2026-10",

  // EU-HEM cohorts offered in the form ("start–end", two years apart). Add a line each year:
  // a new cohort goes to the top of `current`; a graduated one moves to the top of `alumni`.
  // People not listed choose "Other / not listed" and type their cohort.
  cohorts: {
    current: ["2026–2028", "2025–2027"],
    upcoming: ["2027–2029"],
    alumni: ["2024–2026", "2023–2025", "2022–2024", "2021–2023", "2020–2022", "2019–2021", "2018–2020"]
  }
};
