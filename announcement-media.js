// Trusted local artwork shared by the newsroom and homepage carousel.
// The source's stable story IDs keep the same cover everywhere on the site.
const ANNOUNCEMENT_COVERS = Object.freeze({
  "2026-10-07-student-representatives-election-results": "election-results.svg",
  "2026-10-06-welcome-to-the-eu-hem-student-hub-beta": "hub-beta.svg",
  "2026-10-06-track-preferences-first-choices-approved": "track-journey.svg",
});

function announcementCoverPath(announcement) {
  return "assets/announcements/" + (ANNOUNCEMENT_COVERS[announcement.id] || "community-update.svg");
}

if (typeof module !== "undefined") module.exports = { announcementCoverPath };
