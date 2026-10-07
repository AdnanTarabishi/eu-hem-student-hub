// ===== Community events =====
// Student and social events written in the editor dashboard (admin.html) and published by an admin.
// A GitHub robot copies the published ones into data/events.json every 15 minutes
// (scripts/fetch-announcements.js), and this file shows the upcoming ones on calendar.html.
// The dashboard uses eventCard() too, for its preview: editors see exactly what students will see.
// While the dashboard is not connected, data/events.json does not exist and the section stays hidden.

(function () {
  const EVENTS_URL = "data/events.json";

  // "2026-10-07" -> "Wed 7 Oct"
  function dayLabel(key, withYear) {
    const options = { weekday: "short", day: "numeric", month: "short" };
    if (withYear) options.year = "numeric";
    return new Date(key + "T12:00:00").toLocaleDateString("en-GB", options);
  }

  // "Wed 7 Oct, 18:00–20:00" or "Fri 6 – Sun 8 Nov"
  function whenLabel(event) {
    const days = event.endsOn && event.endsOn !== event.startsOn
      ? `${dayLabel(event.startsOn)} – ${dayLabel(event.endsOn)}`
      : dayLabel(event.startsOn);
    const times = event.startTime ? (event.endTime ? `${event.startTime}–${event.endTime}` : `from ${event.startTime}`) : "";
    return times ? `${days}, ${times}` : days;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // ----- "Add to calendar": one event as an .ics file (the format Google, Apple and Outlook calendars read) -----
  // Times are "floating" (no time zone): the phone shows them as written, which is right for an event in
  // the city where the cohort is. All-day and multi-day events use whole days.

  const compactDate = (key) => key.replace(/-/g, "");
  const compactTime = (time) => time.replace(":", "") + "00";

  function nextDay(key) {
    const date = new Date(key + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  // Calendar text: backslash, semicolon, comma and line breaks must be escaped
  const icsText = (text) => String(text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

  // Lines longer than 75 bytes are folded: they continue on the next line after a space (the standard says
  // so). Counted in bytes, not letters: "é" takes 2 bytes and an emoji 4, and an emoji is never cut in half.
  const encoder = new TextEncoder();
  function fold(line) {
    const parts = [];
    let current = "", bytes = 0;
    for (const char of line) {
      const size = encoder.encode(char).length;
      if (bytes + size > 74) {
        parts.push(current);
        current = " ";
        bytes = 1;
      }
      current += char;
      bytes += size;
    }
    parts.push(current);
    return parts.join("\r\n");
  }

  function icsFor(event, now = new Date()) {
    let start, end;
    if (event.startTime) {
      start = `DTSTART:${compactDate(event.startsOn)}T${compactTime(event.startTime)}`;
      if (event.endTime) end = `DTEND:${compactDate(event.endsOn || event.startsOn)}T${compactTime(event.endTime)}`;
      else end = "DURATION:PT2H"; // no end time given: shown as two hours
    } else {
      start = `DTSTART;VALUE=DATE:${compactDate(event.startsOn)}`;
      end = `DTEND;VALUE=DATE:${compactDate(nextDay(event.endsOn || event.startsOn))}`; // the day after the last day
    }
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const description = [event.description, event.link, `Posted by ${event.postedBy} on the EU-HEM Student Hub`].filter(Boolean).join("\n\n");
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EU-HEM Student Hub//Community events//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT", `UID:${event.id}@eu-hem-student-hub`, `DTSTAMP:${stamp}`, start, end,
      `SUMMARY:${icsText(event.title)}`,
      event.location ? `LOCATION:${icsText(event.location)}` : null,
      `DESCRIPTION:${icsText(description)}`,
      event.link ? `URL:${event.link}` : null,
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).map(fold).join("\r\n") + "\r\n";
  }

  function downloadIcs(event) {
    const blob = new Blob([icsFor(event)], { type: "text/calendar" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event"}.ics`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  // One event as a card. Everything is inserted as text, never as HTML.
  function eventCard(event) {
    const card = el("article", "event-card");
    const date = new Date(event.startsOn + "T12:00:00");
    const badge = el("div", "event-date");
    badge.setAttribute("aria-hidden", "true");
    badge.append(el("span", "event-date-month", date.toLocaleDateString("en-GB", { month: "short" })),
      el("span", "event-date-day", String(date.getDate())));
    card.append(badge);

    const body = el("div", "event-body");
    const meta = el("p", "event-meta");
    meta.append(el("span", "event-category", event.category), document.createTextNode(" · " + whenLabel(event)));
    body.append(meta, el("h3", "event-title", event.title));
    if (event.location) body.append(el("p", "event-location", "📍 " + event.location));
    body.append(el("p", "event-description", event.description));
    const footer = el("p", "event-footer");
    if (event.link) {
      const link = el("a", "read-more", "Details");
      link.append(el("span", "visually-hidden", ` about “${event.title}” (opens in a new tab)`), document.createTextNode(" ↗"));
      link.href = event.link;
      link.target = "_blank";
      link.rel = "noopener";
      footer.append(link);
    }
    const add = el("button", "button button-secondary button-sm event-ics", "Add to calendar");
    add.type = "button";
    add.setAttribute("aria-label", `Add “${event.title}” to your calendar`);
    add.addEventListener("click", () => downloadIcs(event));
    footer.prepend(add);
    footer.append(el("span", "posted-by", `Posted by ${event.postedBy}`));
    body.append(footer);
    card.append(body);
    return card;
  }

  // Upcoming = not finished yet. "today" is "YYYY-MM-DD".
  function upcomingEvents(events, today) {
    return events.filter((event) => (event.endsOn || event.startsOn) >= today)
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || (a.startTime || "").localeCompare(b.startTime || ""));
  }

  async function showCommunityEvents() {
    const section = document.getElementById("community-events");
    if (!section) return;
    try {
      const response = await fetch(EVENTS_URL);
      if (!response.ok) return; // not connected yet: keep the section hidden
      const data = await response.json();
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const upcoming = upcomingEvents(Array.isArray(data.events) ? data.events : [], today);
      const list = document.getElementById("community-events-list");
      list.replaceChildren(...upcoming.map((event) => {
        const item = el("li");
        item.append(eventCard(event));
        return item;
      }));
      document.getElementById("community-events-empty").hidden = upcoming.length > 0;
      section.hidden = false;
    } catch (error) {
      console.error("Could not load community events:", error);
    }
  }

  const api = { eventCard, whenLabel, upcomingEvents, icsFor };
  // In Node (tests) only the pure functions are used; in the browser the section fills itself
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }
  window.HubEvents = api;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showCommunityEvents);
  else showCommunityEvents();
})();
