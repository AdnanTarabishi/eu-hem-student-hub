// ===== Small interface helpers shared by all pages =====
// - toast(): a short message at the bottom ("Saved ✓"), also read out by screen readers
// - skeleton(): grey placeholder shapes while data loads
// - downloadEvent(): "add this class/exam to my calendar" as a small .ics file
// - mapLink(): opens a room's address in Google Maps
// - a "back to top" button on long pages
// Animations are switched off automatically when the device asks for reduced motion (see style.css).

// ----- Toasts -----

function toast(message, options = {}) {
  let region = document.getElementById("toast-region");
  if (!region) {
    region = document.createElement("div");
    region.id = "toast-region";
    region.className = "toast-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  const item = document.createElement("div");
  item.className = `toast${options.type ? " toast-" + options.type : ""}`;
  item.textContent = message;
  if (options.action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = options.action.label;
    button.addEventListener("click", () => {
      options.action.onClick();
      item.remove();
    });
    item.appendChild(button);
  }
  region.appendChild(item);
  const duration = options.duration ?? (options.action ? 10000 : 3000);
  if (duration > 0) {
    setTimeout(() => {
      item.classList.add("is-leaving");
      setTimeout(() => item.remove(), 300);
    }, duration);
  }
  return item;
}

// ----- Skeleton placeholders -----

// skeleton(3) -> three grey bars of different widths; skeleton(2, "card") -> two card-shaped blocks
function skeleton(count = 3, kind = "line") {
  const box = document.createElement("div");
  box.className = "skeleton-group";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = `skeleton skeleton-${kind}`;
    if (kind === "line") piece.style.width = `${[92, 76, 84, 60, 70][i % 5]}%`;
    box.appendChild(piece);
  }
  return box;
}

// ----- Add one event to a calendar (.ics file made in the browser) -----

function icsText(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// "2026-10-05T11:00:00" (Italian time) -> "20261005T110000"
function icsLocal(isoLocal) {
  return isoLocal.replace(/[-:]/g, "").slice(0, 15);
}

// One calendar event as .ics text. event = { uid, title, start, end, location, description }
// start/end are Italian local times like "2026-10-05T11:00:00", or dates like "2026-10-05" for all-day.
function eventIcs(event) {
  const allDay = event.start.length === 10;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EU-HEM Student Hub//Single event//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE", "TZID:Europe/Rome",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${icsText(event.uid)}@eu-hem-student-hub`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    allDay ? `DTSTART;VALUE=DATE:${event.start.replace(/-/g, "")}` : `DTSTART;TZID=Europe/Rome:${icsLocal(event.start)}`,
    allDay ? `DTEND;VALUE=DATE:${event.end.replace(/-/g, "")}` : `DTEND;TZID=Europe/Rome:${icsLocal(event.end)}`,
    `SUMMARY:${icsText(event.title)}`,
  ];
  if (event.location) lines.push(`LOCATION:${icsText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${icsText(event.description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

// Downloads the event; calendar apps open .ics files and offer to add the event
function downloadEvent(event, fileName) {
  const blob = new Blob([eventIcs(event)], { type: "text/calendar" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName || `${event.title.replace(/[^\w-]+/g, "-").slice(0, 40)}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  if (typeof toast === "function") toast("Calendar file downloaded: open it to add the event ✓");
}

// ----- Map link for a room -----

// "AULA 21, PIAZZA Antonino Scaravilli 1/2 - Bologna" -> Google Maps search for that address
function mapUrl(room) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(room.replace(/\s+\+\s+.*/, ""));
}

// A small icon button/link (uses icons.svg via siteIcon from site-nav.js)
function iconButton(label, icon, options = {}) {
  const element = document.createElement(options.href ? "a" : "button");
  element.className = `icon-button${options.className ? " " + options.className : ""}`;
  if (options.href) {
    element.href = options.href;
    element.target = "_blank";
    element.rel = "noopener";
  } else {
    element.type = "button";
  }
  element.setAttribute("aria-label", options.ariaLabel || label);
  element.title = options.ariaLabel || label;
  if (typeof siteIcon === "function") element.appendChild(siteIcon(icon));
  if (!options.iconOnly) element.appendChild(document.createTextNode(label));
  if (options.onClick) element.addEventListener("click", options.onClick);
  return element;
}

// ----- Setup checklist (shown on the home page by onboarding.js) -----
// Any page can tick a step, e.g. markSetupDone("search") when search is used.
// Steps: plan, calendar, install, search, theme. Saved in this browser only.

const SETUP_KEY = "euhem-onboarding-v1";

function loadSetup() {
  const stored = readStorage(SETUP_KEY, null);
  return {
    done: stored && typeof stored.done === "object" && stored.done ? stored.done : {},
    hidden: !!(stored && stored.hidden),
  };
}

function saveSetup(state) {
  writeStorage(SETUP_KEY, state);
  document.dispatchEvent(new CustomEvent("setup-change"));
}

function markSetupDone(step, value = true) {
  const state = loadSetup();
  if (state.done[step] === value) return;
  state.done[step] = value;
  saveSetup(state);
}

// ----- Back to top -----

(function backToTop() {
  if (typeof document === "undefined") return; // not in a browser (e.g. tests)
  const button = document.createElement("button");
  button.type = "button";
  button.className = "back-to-top";
  button.setAttribute("aria-label", "Back to top");
  button.title = "Back to top";
  const add = () => {
    if (typeof siteIcon === "function") button.appendChild(siteIcon("arrow-up"));
    else button.textContent = "↑";
    document.body.appendChild(button);
  };
  if (document.body) add();
  else document.addEventListener("DOMContentLoaded", add);
  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const main = document.querySelector("main");
    if (main) main.focus({ preventScroll: true });
  });
  window.addEventListener("scroll", () => button.classList.toggle("is-visible", window.scrollY > 700), { passive: true });
})();

if (typeof module !== "undefined") module.exports = { eventIcs, mapUrl, icsText };

// ----- Sections fade in gently as they scroll into view -----
// Only sections that start below the screen are animated (nothing visible on arrival flickers).
// Skipped when the device asks for reduced motion or the browser has no IntersectionObserver.
function setUpReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const candidates = document.querySelectorAll(
    "main .section, main .tracks-section, main .thesis-section, main .sx-insights, main .sx-cta, .home-stats-wrap ~ .section");
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px" });
  for (const element of candidates) {
    if (element.getBoundingClientRect().top < window.innerHeight) continue;
    element.classList.add("reveal");
    observer.observe(element);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setUpReveal);
  else setUpReveal();
}
