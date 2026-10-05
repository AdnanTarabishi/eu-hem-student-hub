// Join the Directory: public configuration.
// Nothing in this file is secret. Never put a Sheet ID or Drive folder ID here.
window.EUHEM_DIRECTORY_CONFIG = {
  // The deployed Google Apps Script Web App address, ending in /exec.
  // Leave empty until the backend is deployed: the form then explains it is not open yet.
  endpoint: "",

  // Must match ALLOWED_EMAIL_DOMAINS in the Apps Script properties.
  allowedEmailDomains: ["studio.unibo.it"],

  // Must match COLLECT_PHONE in the Apps Script properties.
  collectPhone: false,

  // Must match CONSENT_VERSION in integrations/directory-apps-script/Code.gs. Change both when the
  // privacy text changes meaning (see docs/student-directory.md); scripts/check-content.js compares them.
  consentVersion: "directory-v1-2026-10"
};
