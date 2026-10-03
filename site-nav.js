// ===== Main menu =====
// The menu is defined ONCE here and drawn on every page, so a change happens in one place.
// Each page has <nav id="site-nav" data-current="..."> and loads this file right after it.
// Wide screens: dropdown groups. Phones: one "☰ Menu" button with the groups listed.

const SITE_MENU = [
  {
    label: "Academics",
    items: [
      { key: "studyplan", label: "Study Plan", href: "studyplan.html" },
      { key: "timetable", label: "Timetable", href: "index.html#schedule" },
      { key: "exams", label: "Exams", href: "index.html#exams" },
      { key: "calendar", label: "Calendar", href: "index.html#calendar" },
      { key: "notes", label: "Notes & Resources", href: "notes.html" },
    ],
  },
  {
    label: "Life",
    items: [{ key: "city-guide", label: "City Guide", href: "city-guide.html" }],
  },
  {
    label: "Community",
    items: [
      { key: "announcements", label: "Announcements", href: "announcements.html" },
      { key: "students", label: "Students", href: "students.html" },
    ],
  },
  { key: "about", label: "About", href: "index.html#about" },
];

(function buildMenu() {
  const nav = document.getElementById("site-nav");
  if (!nav) return;
  const current = nav.dataset.current || "";
  nav.textContent = "";

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  // Phones: one button that opens the whole menu
  const toggle = make("button", "menu-toggle", "☰ Menu");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "site-menu");
  nav.appendChild(toggle);

  const menu = make("ul", "menu");
  menu.id = "site-menu";
  const groupButtons = [];

  const link = (item) => {
    const a = make("a", "menu-link", item.label);
    a.href = item.href;
    if (item.key === current) {
      a.setAttribute("aria-current", "page");
      a.classList.add("is-current");
    }
    return a;
  };

  SITE_MENU.forEach((entry, i) => {
    const li = make("li", "menu-item");
    if (!entry.items) {
      li.appendChild(link(entry));
      menu.appendChild(li);
      return;
    }
    const isCurrentGroup = entry.items.some((item) => item.key === current);
    const button = make("button", isCurrentGroup ? "menu-group is-current" : "menu-group", entry.label);
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", `menu-group-${i}`);
    const list = make("ul", "menu-dropdown");
    list.id = `menu-group-${i}`;
    for (const item of entry.items) {
      const itemLi = make("li");
      itemLi.appendChild(link(item));
      list.appendChild(itemLi);
    }
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = button.getAttribute("aria-expanded") !== "true";
      closeGroups();
      button.setAttribute("aria-expanded", String(open));
    });
    groupButtons.push(button);
    li.appendChild(button);
    li.appendChild(list);
    menu.appendChild(li);
  });
  nav.appendChild(menu);

  function closeGroups() {
    for (const button of groupButtons) button.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "✕ Close" : "☰ Menu";
  });

  // Click outside or Esc: close everything
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) closeGroups();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const openButton = groupButtons.find((b) => b.getAttribute("aria-expanded") === "true");
    closeGroups();
    if (nav.classList.contains("is-open")) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "☰ Menu";
      toggle.focus();
    } else if (openButton) {
      openButton.focus();
    }
  });
  // Following a link to a section of the same page (e.g. #exams): close the menu
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeGroups();
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "☰ Menu";
    }
  });
})();
