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
    const programme = await getProgramme();
    const cohort = currentCohort(programme);
    const term = currentTerm(programme);

    // With a complete saved study plan: the calendar of exactly that plan.
    // Otherwise: the full calendar with every 1st-year course.
    const plan = loadPlan(programme);
    const complete = plan.saved && planSummary(term, plan.choices).complete;
    const key = complete ? planKey(term, plan.choices) : null;
    const mine = key && calendars.find((c) => c.cohort === cohort.id && c.term === term.id && c.plan === key);
    const full = calendars.find((c) => c.cohort === cohort.id && !c.plan) || calendars.filter((c) => c.year === 1 && !c.plan).pop();
    const current = mine || full;
    if (!current) throw new Error("No calendar listed");

    // Full web address of the file, e.g. https://.../calendar/eu-hem-2026-27-year1.ics
    const httpsUrl = new URL("calendar/" + current.file, window.location.href).href;
    // "webcal://" tells the computer to open the link in its calendar app
    const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:");
    const calendarName = mine ? `EU-HEM my courses ${cohort.label}` : `EU-HEM 1st year ${cohort.label}`;
    document.getElementById("calendar-plan-note").textContent = mine
      ? "This calendar has only the courses in your study plan. If you change your plan, subscribe to the new link and remove the old calendar."
      : plan.saved
        ? "Complete your study plan to get a calendar with only your courses. This one has every 1st-year course."
        : "This calendar has every 1st-year course. Save a study plan to get one with only your courses.";

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
    if (typeof toast === "function") toast("Calendar link copied ✓");
  } catch {
    document.getElementById("calendar-url").select();
    button.textContent = "Press Ctrl+C to copy";
  }
  setTimeout(() => (button.textContent = "Copy link"), 2000);
});

setUpCalendarLinks();

// "Key dates this year": every key date of the cohort, past ones greyed out, each with its source label
const KEY_DATE_KIND_LABELS = { classes: "Classes", exams: "Exams", deadline: "Deadline", event: "Event" };

async function showKeyDates() {
  const list = document.getElementById("key-dates-list");
  try {
    const [programme, sources] = await Promise.all([getProgramme(), loadSources()]);
    const today = todayKey();
    for (const keyDate of keyDates(currentCohort(programme))) {
      const past = keyDateLastDay(keyDate) < today;
      const now = !past && keyDate.start <= today;
      const item = createElement("li", `key-date is-${keyDate.kind}${past ? " is-past" : now ? " is-now" : ""}`);
      const when = createElement("p", "key-date-when", (keyDate.approximate ? "About " : "") + formatKeyDateRange(keyDate));
      const body = createElement("div", "key-date-body");
      const title = createElement("p", "key-date-title");
      title.appendChild(createElement("span", "key-date-kind", KEY_DATE_KIND_LABELS[keyDate.kind]));
      title.appendChild(document.createTextNode(keyDate.label + (past ? " (done)" : now ? " (now)" : "")));
      body.appendChild(title);
      if (keyDate.note) body.appendChild(createElement("p", "schedule-meta", keyDate.note));
      body.appendChild(sourceLabel(keyDate.source, sources));
      item.append(when, body);
      list.appendChild(item);
    }
  } catch (error) {
    console.error("Could not show the key dates:", error);
    list.replaceWith(createElement("p", "schedule-meta", "Sorry, the key dates are not available right now."));
  }
}

showKeyDates();

// Subscribing ticks "Subscribe to your calendar" in the home page setup checklist
for (const id of ["calendar-google", "calendar-apple", "calendar-outlook", "calendar-copy"]) {
  document.getElementById(id).addEventListener("click", () => {
    if (typeof markSetupDone === "function") markSetupDone("calendar");
  });
}
