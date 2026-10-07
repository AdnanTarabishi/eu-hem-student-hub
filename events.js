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

  window.HubEvents = { eventCard, whenLabel, upcomingEvents };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showCommunityEvents);
  else showCommunityEvents();
})();
