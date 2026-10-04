// ===== Site frame: header bar, main menu, footer =====
// Defined ONCE here and drawn on every page, so a change happens in one place.
// Each page has <nav id="site-nav" data-current="..."> in its header and loads this file right after it.
// - Header bar: site name, menu (dropdowns on wide screens, one "Menu" panel on phones),
//   search button (opens search.js) and the light/dark button (added by theme.js)
// - "Skip to content" link for keyboard users
// - The header shrinks while scrolling
// - Footer with links

const SITE_MENU = [
  {
    label: "Academics",
    items: [
      { key: "studyplan", label: "Study Plan", href: "studyplan.html", icon: "study-plan" },
      { key: "tracks", label: "Tracks", href: "tracks.html", icon: "route" },
      { key: "timetable", label: "Timetable", href: "timetable.html", icon: "timetable" },
      { key: "exams", label: "Exams", href: "exams.html", icon: "exams" },
      { key: "calendar", label: "Calendar", href: "calendar.html", icon: "calendar" },
      { key: "notes", label: "Notes & Resources", href: "notes.html", icon: "notes" },
      { key: "thesis", label: "Thesis", href: "thesis.html", icon: "library" },
    ],
  },
  {
    label: "Life",
    items: [{ key: "city-guide", label: "City Guide", href: "city-guide.html", icon: "guide" }],
  },
  {
    label: "Community",
    items: [
      { key: "announcements", label: "Announcements", href: "announcements.html", icon: "announcements" },
      { key: "students", label: "Students", href: "students.html", icon: "students" },
    ],
  },
  { key: "about", label: "About", href: "index.html#about", icon: "info" },
];

// An icon from icons.svg: <svg class="icon"><use href="icons.svg#name"></use></svg>
function siteIcon(name, className = "icon") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(ns, "use");
  use.setAttribute("href", `icons.svg#${name}`);
  svg.appendChild(use);
  return svg;
}

(function buildSiteFrame() {
  const nav = document.getElementById("site-nav");
  if (!nav) return;
  const current = nav.dataset.current || "";
  const header = nav.closest(".site-header");
  const container = nav.parentElement;
  nav.textContent = "";

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  // --- Header bar: [site name + tagline] [menu] [search · theme · menu button] ---
  const bar = make("div", "header-bar");
  const brand = make("div", "brand");
  for (const element of [container.querySelector(".site-title"), container.querySelector(".site-tagline")]) {
    if (element) brand.appendChild(element);
  }
  const actions = make("div", "header-actions");
  const searchButton = make("button", "header-button search-button");
  searchButton.type = "button";
  searchButton.setAttribute("aria-label", "Search the site (Ctrl+K)");
  searchButton.appendChild(siteIcon("search"));
  searchButton.appendChild(make("span", "search-label", "Search"));
  searchButton.appendChild(make("kbd", null, navigator.platform && /Mac/.test(navigator.platform) ? "⌘K" : "Ctrl K"));
  searchButton.addEventListener("click", () => document.dispatchEvent(new CustomEvent("open-search")));
  actions.appendChild(searchButton);

  const toggle = make("button", "header-button menu-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "site-menu");
  const toggleLabel = make("span", "menu-toggle-label", "Menu");
  toggle.appendChild(siteIcon("menu"));
  toggle.appendChild(toggleLabel);

  bar.appendChild(brand);
  bar.appendChild(nav);
  bar.appendChild(actions);
  actions.appendChild(toggle);
  container.prepend(bar);

  // --- Menu ---
  const menu = make("ul", "menu");
  menu.id = "site-menu";
  const groupButtons = [];
  const link = (item) => {
    const a = make("a", "menu-link");
    a.href = item.href;
    if (item.icon) a.appendChild(siteIcon(item.icon));
    a.appendChild(document.createTextNode(item.label));
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
  function setPanel(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggleLabel.textContent = open ? "Close" : "Menu";
    toggle.querySelector("use").setAttribute("href", `icons.svg#${open ? "close" : "menu"}`);
  }
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setPanel(!nav.classList.contains("is-open"));
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) closeGroups();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const openButton = groupButtons.find((b) => b.getAttribute("aria-expanded") === "true");
    closeGroups();
    if (nav.classList.contains("is-open")) {
      setPanel(false);
      toggle.focus();
    } else if (openButton) {
      openButton.focus();
    }
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeGroups();
      setPanel(false);
    }
  });

  // --- The header shrinks while scrolling ---
  if (header) {
    const onScroll = () => header.classList.toggle("is-compact", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // The light/dark button (theme.js) goes in now, so the header doesn't change size after the first paint
  if (typeof window.addThemeToggle === "function") window.addThemeToggle();

  // --- Skip link + a target for it ---
  // This script runs in the header, before <main> and the footer exist, so the skip link
  // and the footer are added as soon as the whole page has been read (DOMContentLoaded).
  function addSkipLink() {
    const main = document.querySelector("main");
    if (!main) return;
    main.id = main.id || "main";
    main.tabIndex = -1;
    const skip = make("a", "skip-link", "Skip to content");
    skip.href = "#" + main.id;
    document.body.prepend(skip);
  }

  // --- Footer ---
  function buildFooter() {
    const footer = document.querySelector(".site-footer .container");
    if (!footer) return;
    footer.textContent = "";
    const grid = make("div", "footer-grid");
    const brandBox = make("div", "footer-brand");
    brandBox.appendChild(make("strong", null, "EU-HEM Student Hub"));
    brandBox.appendChild(make("p", null,
      "An independent, student-run platform created to help EU-HEM students navigate academics, resources and student life."));
    grid.appendChild(brandBox);
    for (const entry of SITE_MENU.filter((e) => e.items)) {
      const column = make("div");
      column.appendChild(make("h3", null, entry.label));
      const list = make("ul");
      for (const item of entry.items) {
        const li = make("li");
        const a = make("a", null, item.label);
        a.href = item.href;
        li.appendChild(a);
        list.appendChild(li);
      }
      column.appendChild(list);
      grid.appendChild(column);
    }
    // "Help" goes in the last column
    const help = grid.lastElementChild;
    help.appendChild(make("h3", "footer-help", "Help"));
    const helpList = make("ul");
    const started = make("li");
    const startedLink = make("a", null, "Getting started");
    startedLink.href = "index.html#welcome";
    started.appendChild(startedLink);
    helpList.appendChild(started);
    const install = make("li", "footer-install");
    install.hidden = true; // shown by pwa.js where the browser can install the app
    const installButton = make("button", "footer-link", "Install the app");
    installButton.type = "button";
    installButton.addEventListener("click", () => document.dispatchEvent(new CustomEvent("install-app")));
    install.appendChild(installButton);
    helpList.appendChild(install);
    help.appendChild(helpList);
    // "About" column: about the site, privacy, contact, useful links and the code on GitHub
    const about = make("div");
    about.appendChild(make("h3", null, "About"));
    const aboutList = make("ul");
    for (const [label, href] of [
      ["About", "index.html#about"],
      ["Privacy", "privacy.html"],
      ["Contact", "contact.html"],
      ["Useful Links", "index.html#links"],
      ["GitHub", "https://github.com/AdnanTarabishi/eu-hem-student-hub"],
    ]) {
      const li = make("li");
      const a = make("a", null, label);
      a.href = href;
      if (href.startsWith("https://")) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      li.appendChild(a);
      aboutList.appendChild(li);
    }
    about.appendChild(aboutList);
    grid.appendChild(about);
    footer.appendChild(grid);
    footer.appendChild(make("p", "footer-bottom",
      "This is an unofficial student project and is not an official website of the University of Bologna, EU-HEM, or any partner university. " +
      "Your study plan and progress are saved only on your device."));
  }
  const afterLoad = () => {
    addSkipLink();
    buildFooter();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", afterLoad);
  else afterLoad();
})();
