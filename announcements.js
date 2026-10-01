// ===== Announcements =====
// Loaded on every page. It reads the announcements CSV and then:
// - shows a red banner at the top of every page if there is an active Urgent announcement
// - shows the latest announcements on the home page (if #latest-announcements exists)
// - shows the full list with category filters on announcements.html (if #announcement-list exists)

// ----- Settings -----

// Where announcements come from. To switch to real data, replace this with your
// published Google Sheets CSV link (File -> Share -> Publish to web -> CSV).
const ANNOUNCEMENTS_URL = "data/sample-announcements.csv";

// "New" badge for announcements posted in the last 3 days (today + the 2 days before)
const NEW_FOR_DAYS = 3;

// How many announcements the home page shows
const LATEST_ON_HOME = 3;

// Column headers in the sheet. The column order doesn't matter.
const ANNOUNCEMENT_COLUMNS = {
  date: "Date",
  title: "Title",
  category: "Category",
  message: "Message",
  link: "Link",
  pinned: "Pinned",
  expires: "Expires",
  postedBy: "Posted by",
};

// Demo notes show automatically while we use the sample file
const IS_DEMO_ANNOUNCEMENTS = ANNOUNCEMENTS_URL === "data/sample-announcements.csv";

// Category order for the filter buttons, and the CSS class that gives each its colour
const CATEGORY_ORDER = ["Urgent", "University", "Academic", "Student", "Social"];
const CATEGORY_CLASSES = {
  University: "category-university",
  Academic: "category-academic",
  Student: "category-student",
  Social: "category-social",
  Urgent: "category-urgent",
};

// ----- Reading the data -----

// Accepts "2026-10-01" (recommended) or "01/10/2026" (day/month/year).
// Returns "2026-10-01", "" for an empty cell, or null if the date can't be read.
function parseDateKey(text) {
  const value = (text || "").trim();
  if (!value) return "";

  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return toDateKey(match[1], match[2], match[3]);

  match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return toDateKey(match[3], match[2], match[1]);

  return null;
}

// Builds "YYYY-MM-DD" and checks it's a real date (e.g. not 31 February)
function toDateKey(year, month, day) {
  const key = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(key + "T12:00:00");
  return !isNaN(date) && dateToKey(date) === key ? key : null;
}

// "Yes", "TRUE" (a checkbox in Google Sheets), "Y" or "1" -> pinned
function isPinnedValue(text) {
  return ["yes", "true", "y", "1"].includes((text || "").trim().toLowerCase());
}

// Only real web links are allowed (blocks tricks like "javascript:...")
function safeLink(text) {
  const value = (text || "").trim();
  return /^https?:\/\//i.test(value) ? value : "";
}

// "2026-10-01" + "Weekend trip!" -> "2026-10-01-weekend-trip", used to link to one announcement
function announcementId(dateKey, title) {
  return (dateKey + "-" + title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function rowsToAnnouncements(rows) {
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  const column = {};
  for (const [key, header] of Object.entries(ANNOUNCEMENT_COLUMNS)) {
    column[key] = headers.indexOf(header);
  }
  const cell = (row, key) => (column[key] >= 0 ? (row[column[key]] || "").trim() : "");

  const announcements = [];
  rows.slice(1).forEach((row, index) => {
    const title = cell(row, "title");
    if (!title) return; // a row without a title is skipped

    const date = parseDateKey(cell(row, "date"));
    const expires = parseDateKey(cell(row, "expires"));
    if (date === null) console.warn(`Announcement "${title}": unreadable Date "${cell(row, "date")}"`);
    if (expires === null) console.warn(`Announcement "${title}": unreadable Expires "${cell(row, "expires")}"`);

    announcements.push({
      id: announcementId(date || "", title),
      row: index, // position in the sheet, used to order announcements on the same day
      date: date || "",
      title,
      category: cell(row, "category"),
      message: cell(row, "message"),
      link: safeLink(cell(row, "link")),
      pinned: isPinnedValue(cell(row, "pinned")),
      expires: expires || "", // an unreadable expiry date counts as "no expiry"
      postedBy: cell(row, "postedBy"),
    });
  });
  return announcements;
}

// ----- Date logic -----
// All dates are "YYYY-MM-DD" text, which compares correctly as plain text:
// "2026-09-30" < "2026-10-01". Only calendar days matter, never the time of day.

// Shown if: the date has arrived (future posts wait) AND the Expires day hasn't passed yet.
// An announcement is still shown ON its Expires day, and disappears the day after.
function isActiveAnnouncement(announcement, today) {
  if (announcement.date && announcement.date > today) return false;
  if (announcement.expires && announcement.expires < today) return false;
  return true;
}

// "New" if posted 0, 1 or 2 days ago (with NEW_FOR_DAYS = 3)
function isNewAnnouncement(announcement, today) {
  if (!announcement.date) return false;
  const age = daysBetween(announcement.date, today);
  return age >= 0 && age < NEW_FOR_DAYS;
}

// Pinned first, then newest first; on the same day, the row added later first
function sortAnnouncements(list) {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.row - a.row;
  });
}

function activeAnnouncements(all, today) {
  return sortAnnouncements(all.filter((a) => isActiveAnnouncement(a, today)));
}

// ----- Building the page -----

function announcementCard(announcement, today, compact) {
  const card = createElement(compact ? "div" : "article", compact ? "announcement compact" : "announcement");
  if (!compact) card.id = announcement.id;
  if (announcement.pinned) card.classList.add("is-pinned");

  const meta = createElement("div", "announcement-meta");
  const categoryClass = CATEGORY_CLASSES[announcement.category] || "category-other";
  if (announcement.category) meta.appendChild(createElement("span", `category-badge ${categoryClass}`, announcement.category));
  if (announcement.pinned) meta.appendChild(createElement("span", "pinned-badge", "📌 Pinned"));
  if (isNewAnnouncement(announcement, today)) meta.appendChild(createElement("span", "new-badge", "New"));
  if (announcement.date) {
    meta.appendChild(createElement("span", "announcement-date",
      formatDay(announcement.date, { day: "numeric", month: "short", year: "numeric" })));
  }
  card.appendChild(meta);

  if (compact) {
    // On the home page the title links to the full announcement
    const link = createElement("a", "announcement-title", announcement.title);
    link.href = "announcements.html#" + announcement.id;
    card.appendChild(link);
    return card;
  }

  card.appendChild(createElement("h3", "announcement-title", announcement.title));
  if (announcement.message) card.appendChild(createElement("p", "announcement-message", announcement.message));

  const footer = createElement("div", "announcement-footer");
  if (announcement.link) {
    const readMore = createElement("a", "read-more", "Read more ↗");
    readMore.href = announcement.link;
    readMore.target = "_blank";
    readMore.rel = "noopener";
    footer.appendChild(readMore);
  }
  if (announcement.postedBy) footer.appendChild(createElement("span", "posted-by", `Posted by ${announcement.postedBy}`));
  if (footer.children.length > 0) card.appendChild(footer);
  return card;
}

// Red bar at the very top of the page, linking to the newest active Urgent announcement
function showUrgentBanner(active) {
  const urgent = active.filter((a) => a.category === "Urgent");
  if (urgent.length === 0) return;
  const newest = sortAnnouncements(urgent.map((a) => ({ ...a, pinned: false })))[0];

  const banner = createElement("div", "urgent-banner");
  banner.setAttribute("role", "alert");
  const inner = createElement("div", "container");
  inner.appendChild(createElement("strong", null, IS_DEMO_ANNOUNCEMENTS ? "⚠ Urgent (demo): " : "⚠ Urgent: "));
  inner.appendChild(document.createTextNode(newest.title + " "));
  const link = createElement("a", null, "Read more");
  link.href = "announcements.html#" + newest.id;
  inner.appendChild(link);
  if (urgent.length > 1) inner.appendChild(document.createTextNode(` (+${urgent.length - 1} more)`));
  banner.appendChild(inner);
  document.body.prepend(banner);
}

// Home page: the first few announcements + "See all"
function showLatestAnnouncements(active, today) {
  const box = document.getElementById("latest-announcements");
  const status = document.getElementById("latest-announcements-status");
  if (!box) return;

  if (active.length === 0) {
    status.textContent = "No announcements right now.";
    return;
  }
  status.hidden = true;
  for (const announcement of active.slice(0, LATEST_ON_HOME)) {
    box.appendChild(announcementCard(announcement, today, true));
  }
}

// Announcements page: filter buttons + the full list
function showAnnouncementsPage(active, today) {
  const list = document.getElementById("announcement-list");
  const status = document.getElementById("announcement-status");
  const filters = document.getElementById("announcement-filters");
  if (!list) return;

  if (active.length === 0) {
    status.textContent = "No announcements right now.";
    return;
  }

  // Categories that currently have announcements, in a fixed order, then any others
  const present = [...new Set(active.map((a) => a.category).filter(Boolean))];
  const categories = [
    ...CATEGORY_ORDER.filter((c) => present.includes(c)),
    ...present.filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
  ];

  let selected = "";
  const render = () => {
    const visible = selected ? active.filter((a) => a.category === selected) : active;
    list.innerHTML = "";
    for (const announcement of visible) list.appendChild(announcementCard(announcement, today, false));
    status.textContent = `Showing ${visible.length} of ${active.length} announcements`;
    for (const button of filters.children) {
      button.setAttribute("aria-selected", String(button.dataset.category === selected));
    }
  };

  for (const category of ["", ...categories]) {
    const count = category ? active.filter((a) => a.category === category).length : active.length;
    const button = createElement("button", "track-tab", `${category || "All"} (${count})`);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.dataset.category = category;
    button.addEventListener("click", () => {
      selected = category;
      render();
    });
    filters.appendChild(button);
  }
  render();

  // Arriving from a banner or home page link (#id): highlight that announcement
  const target = window.location.hash && document.getElementById(window.location.hash.slice(1));
  if (target) {
    target.classList.add("is-highlighted");
    target.scrollIntoView();
  }
}

async function loadAnnouncements() {
  for (const id of ["announcement-demo-note", "home-announcement-demo-note"]) {
    const note = document.getElementById(id);
    if (note) note.hidden = !IS_DEMO_ANNOUNCEMENTS;
  }

  try {
    const response = await fetch(ANNOUNCEMENTS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const all = rowsToAnnouncements(parseCsv(await response.text()));

    const today = todayKey();
    const active = activeAnnouncements(all, today);
    showUrgentBanner(active);
    showLatestAnnouncements(active, today);
    showAnnouncementsPage(active, today);
  } catch (error) {
    console.error("Could not load announcements:", error);
    // Pages with an announcements box show a message; other pages simply show no banner
    for (const id of ["announcement-status", "latest-announcements-status"]) {
      const status = document.getElementById(id);
      if (status) status.textContent = "Sorry, announcements could not be loaded right now. Please try again later.";
    }
  }
}

loadAnnouncements();
