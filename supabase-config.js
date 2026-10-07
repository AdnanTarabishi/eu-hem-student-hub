// ===== Supabase: public connection settings =====
// Used by the editor dashboard (admin.html) and the announcements robot (scripts/fetch-announcements.js).
//
// Nothing here is secret. The publishable key ("anon" key) is meant to be public: what it may do is
// limited by the Row Level Security rules in supabase/schema.sql (read published announcements, nothing more).
// NEVER put the "service_role" / secret key here or anywhere in this repository.
//
// While url is empty: the dashboard says it is not connected yet, and the robot keeps copying
// the Google Sheet. Setup: docs/editor-dashboard.md
(function (root) {
  const config = {
    // Supabase -> Project Settings -> Data API -> Project URL, e.g. "https://abcdefghijkl.supabase.co"
    url: "",
    // Supabase -> Project Settings -> API Keys -> the publishable (or "anon public") key
    publishableKey: "",
    // The cohort whose announcements the site shows (same format as the "cohort" column)
    cohort: "2026-2028",
  };
  if (typeof module !== "undefined" && module.exports) module.exports = config;
  else root.EUHEM_SUPABASE = config;
})(typeof window !== "undefined" ? window : globalThis);
