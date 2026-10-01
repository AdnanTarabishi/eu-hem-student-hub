// ===== Calendar subscription =====
// Fills in the "Add to your calendar" links. The calendar file itself is built
// by scripts/build-calendar.js on GitHub Actions; calendar/calendars.json lists the files.

const CALENDAR_LIST_URL = "calendar/calendars.json";

const calendarStatus = document.getElementById("calendar-status");
const calendarLinks = document.getElementById("calendar-links");

async function setUpCalendarLinks() {
  try {
    const response = await fetch(CALENDAR_LIST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const calendars = await response.json();

    // Newest 1st-year calendar (the list is sorted by cohort)
    const current = calendars.filter((c) => c.year === 1).pop();
    if (!current) throw new Error("No calendar listed");

    // Full web address of the file, e.g. https://.../calendar/eu-hem-2026-27-year1.ics
    const httpsUrl = new URL("calendar/" + current.file, window.location.href).href;
    // "webcal://" tells the computer to open the link in its calendar app
    const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:");
    const calendarName = `EU-HEM 1st year ${current.cohort.replace("-", "/")}`;

    document.getElementById("calendar-google").href =
      "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcalUrl);
    document.getElementById("calendar-apple").href = webcalUrl;
    document.getElementById("calendar-outlook").href =
      "https://outlook.live.com/calendar/0/addfromweb?url=" + encodeURIComponent(httpsUrl) +
      "&name=" + encodeURIComponent(calendarName);
    document.getElementById("calendar-url").value = httpsUrl;

    calendarStatus.textContent = `Calendar: ${calendarName}`;
    calendarLinks.hidden = false;
  } catch (error) {
    console.error("Could not set up calendar links:", error);
    calendarStatus.textContent = "Sorry, the calendar link is not available right now.";
  }
}

// "Copy link" button: copies the address so it can be pasted into any calendar app
document.getElementById("calendar-copy").addEventListener("click", async () => {
  const url = document.getElementById("calendar-url").value;
  const button = document.getElementById("calendar-copy");
  try {
    await navigator.clipboard.writeText(url);
    button.textContent = "Copied!";
  } catch {
    document.getElementById("calendar-url").select();
    button.textContent = "Press Ctrl+C to copy";
  }
  setTimeout(() => (button.textContent = "Copy link"), 2000);
});

setUpCalendarLinks();
