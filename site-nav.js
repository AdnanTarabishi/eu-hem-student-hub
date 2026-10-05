// ===== Site frame: header bar, main menu, mobile drawer, footer =====
// Defined ONCE here and drawn on every page, so a change happens in one place.
// Each page has <nav id="site-nav" data-current="..."> in its header and loads this file right after it.
// - Header bar: brand lockup, menu (dropdowns on wide screens, a drawer on phones and tablets),
//   search button (opens search.js), the light/dark button (added by theme.js) and "Join the Directory"
// - "Skip to content" link for keyboard users
// - The header gets a soft shadow and shrinks a little while scrolling
// - Footer with links (deep navy)

const SITE_MENU = [
  {
    label: "Academics",
    items: [
      { key: "studyplan", label: "Study Plan", href: "studyplan.html", icon: "study-plan", desc: "Choose courses, track your CFU" },
      { key: "tracks", label: "Tracks", href: "tracks.html", icon: "route", desc: "The four paths after semester 1" },
      { key: "timetable", label: "Timetable", href: "timetable.html", icon: "timetable", desc: "Classes and rooms, live from UniBo" },
      { key: "exams", label: "Exams", href: "exams.html", icon: "exams", desc: "Dates and registration windows" },
      { key: "calendar", label: "Calendar", href: "calendar.html", icon: "calendar", desc: "Subscribe on your phone" },
    ],
  },
  {
    label: "Resources",
    items: [
      { key: "notes", label: "Notes & Resources", href: "notes.html", icon: "notes", desc: "Notes, flashcards, practice" },
      { key: "thesis", label: "Thesis", href: "thesis.html", icon: "library", desc: "Explore past thesis topics" },
      { key: "links", label: "Useful Links", href: "index.html#links", icon: "link", desc: "Virtuale, Studenti Online and more" },
    ],
  },
  {
    label: "Community",
    items: [
      { key: "students", label: "Students", href: "students.html", icon: "students", desc: "Meet the EU-HEM community" },
      { key: "announcements", label: "Announcements", href: "announcements.html", icon: "announcements", desc: "News for the cohort" },
    ],
  },
  {
    label: "Life",
    items: [{ key: "city-guide", label: "City Guide", href: "city-guide.html", icon: "guide", desc: "Bologna, Oslo, Rotterdam, Innsbruck" }],
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

// The brand lockup: monogram + "EU-HEM" + "Student Hub". Text only: no official logos.
function brandLockup(make) {
  const box = make("span", "brand-lockup");
  const mark = make("span", "brand-mark", "SH");
  mark.setAttribute("aria-hidden", "true");
  const words = make("span", "brand-words");
  words.append(make("span", "brand-name", "EU-HEM"), make("span", "brand-product", "Student Hub"));
  box.append(mark, words);
  return box;
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
  const openSearch = () => document.dispatchEvent(new CustomEvent("open-search"));

  // --- Header bar: [brand] [menu] [search · theme · join · menu button] ---
  const bar = make("div", "header-bar");
  const brand = make("div", "brand");
  const title = container.querySelector(".site-title");
  if (title) {
    const titleLink = title.querySelector("a") || title;
    titleLink.textContent = "";
    titleLink.setAttribute("aria-label", "EU-HEM Student Hub, home");
    titleLink.appendChild(brandLockup(make));
    brand.appendChild(title);
  }
  const tagline = container.querySelector(".site-tagline");
  if (tagline) tagline.remove(); // replaced by the descriptor below
  brand.style.display = "flex";
  brand.style.alignItems = "center";
  brand.appendChild(make("span", "brand-descriptor", "Unofficial student-run platform"));

  const actions = make("div", "header-actions");
  const searchButton = make("button", "header-button search-button");
  searchButton.type = "button";
  searchButton.setAttribute("aria-label", "Search the site (Ctrl+K)");
  searchButton.appendChild(siteIcon("search"));
  searchButton.appendChild(make("span", "search-label", "Search"));
  searchButton.appendChild(make("kbd", null, navigator.platform && /Mac/.test(navigator.platform) ? "⌘K" : "Ctrl K"));
  searchButton.addEventListener("click", openSearch);
  actions.appendChild(searchButton);

  if (current !== "join") {
    const join = make("a", "header-button header-cta", "Join the Directory");
    join.href = "join.html";
    actions.appendChild(join);
  }

  const toggle = make("button", "header-button menu-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "site-nav");
  const toggleLabel = make("span", "menu-toggle-label", "Menu");
  toggle.appendChild(siteIcon("menu"));
  toggle.appendChild(toggleLabel);

  bar.appendChild(brand);
  bar.appendChild(nav);
  bar.appendChild(actions);
  actions.appendChild(toggle);
  container.prepend(bar);

  // --- Drawer head (phones and tablets only, hidden on wide screens by CSS) ---
  const drawerHead = make("div", "drawer-head");
  const drawerBrand = make("a", "drawer-brand");
  drawerBrand.href = "index.html";
  drawerBrand.style.textDecoration = "none";
  drawerBrand.appendChild(brandLockup(make));
  const closeButton = make("button", "header-button drawer-close");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close menu");
  closeButton.appendChild(siteIcon("close"));
  drawerHead.append(drawerBrand, closeButton);
  nav.appendChild(drawerHead);
  const drawerSearch = make("button", "drawer-search");
  drawerSearch.type = "button";
  drawerSearch.append(siteIcon("search"), make("span", null, "Search the Hub"));
  drawerSearch.addEventListener("click", () => {
    setPanel(false);
    openSearch();
  });
  nav.appendChild(drawerSearch);

  // --- Menu ---
  const menu = make("ul", "menu");
  menu.id = "site-menu";
  const groupButtons = [];
  const link = (item) => {
    const a = make("a", "menu-link");
    a.href = item.href;
    if (item.icon) a.appendChild(siteIcon(item.icon));
    if (item.desc) {
      const text = make("span", "menu-link-text");
      text.append(make("span", null, item.label), make("span", "menu-link-desc", item.desc));
      a.appendChild(text);
    } else {
      a.appendChild(document.createTextNode(item.label));
    }
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
    button.appendChild(siteIcon("chevron-down", "icon icon-chevron"));
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

  // --- Drawer extras: theme, privacy, contact ---
  const extras = make("div", "drawer-extras");
  const themeItem = make("button", "drawer-theme");
  themeItem.type = "button";
  const themeLabel = () => {
    const dark = (document.documentElement.dataset.theme ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    themeItem.replaceChildren(siteIcon(dark ? "sun" : "moon"), document.createTextNode(dark ? "Light mode" : "Dark mode"));
  };
  themeItem.addEventListener("click", () => {
    const realToggle = document.querySelector(".header-actions .theme-toggle");
    if (realToggle) realToggle.click();
    themeLabel();
  });
  themeLabel();
  extras.appendChild(themeItem);
  for (const [label, href, icon] of [["Join the Directory", "join.html", "students"], ["Privacy", "privacy.html", "lock"], ["Contact", "contact.html", "mail"]]) {
    const a = make("a");
    a.href = href;
    a.append(siteIcon(icon), document.createTextNode(label));
    extras.appendChild(a);
  }
  nav.appendChild(extras);

  const backdrop = make("div", "drawer-backdrop");
  // Inside the header, so it shares the header layer and the drawer sits above it
  (header || document.body).appendChild(backdrop);
  backdrop.addEventListener("click", () => setPanel(false));

  function closeGroups() {
    for (const button of groupButtons) button.setAttribute("aria-expanded", "false");
  }
  const isDrawer = () => window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
  function setPanel(open) {
    nav.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
    document.body.classList.toggle("drawer-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggleLabel.textContent = open ? "Close" : "Menu";
    if (open) {
      nav.setAttribute("role", "dialog");
      nav.setAttribute("aria-modal", "true");
      closeButton.focus();
    } else {
      nav.removeAttribute("role");
      nav.removeAttribute("aria-modal");
    }
  }
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setPanel(!nav.classList.contains("is-open"));
  });
  closeButton.addEventListener("click", () => {
    setPanel(false);
    toggle.focus();
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) closeGroups();
  });
  document.addEventListener("keydown", (event) => {
    // Keep Tab inside the open drawer (it is a modal on phones)
    if (event.key === "Tab" && nav.classList.contains("is-open") && isDrawer()) {
      const focusable = [...nav.querySelectorAll("a[href], button:not([disabled])")].filter((el) => el.offsetParent !== null);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
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
  // Leaving the phone layout with the drawer open: close it
  if (window.matchMedia) {
    window.matchMedia("(max-width: 900px)").addEventListener("change", (e) => { if (!e.matches) setPanel(false); });
  }

  // --- The header gets a shadow and shrinks a little while scrolling ---
  if (header) {
    const onScroll = () => header.classList.toggle("is-compact", window.scrollY > 24);
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

  // --- Footer: brand statement, the menu groups, Help, About ---
  function footerLink(label, href) {
    const li = make("li");
    const a = make("a", null, label);
    a.href = href;
    if (href.startsWith("https://")) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    li.appendChild(a);
    return li;
  }
  function buildFooter() {
    const footer = document.querySelector(".site-footer .container");
    if (!footer) return;
    footer.textContent = "";
    const grid = make("div", "footer-grid");
    const brandBox = make("div", "footer-brand");
    brandBox.appendChild(brandLockup(make));
    brandBox.appendChild(make("p", null,
      "An independent, student-run platform created to help EU-HEM students navigate academics, resources, mobility and student life."));
    grid.appendChild(brandBox);
    for (const entry of SITE_MENU.filter((e) => e.items)) {
      const column = make("div");
      column.appendChild(make("h3", null, entry.label));
      const list = make("ul");
      for (const item of entry.items) list.appendChild(footerLink(item.label, item.href));
      column.appendChild(list);
      grid.appendChild(column);
    }
    // "Help" goes under "Life"
    const help = grid.lastElementChild;
    help.appendChild(make("h3", "footer-help", "Help"));
    const helpList = make("ul");
    helpList.appendChild(footerLink("Getting started", "index.html#welcome"));
    const install = make("li", "footer-install");
    install.hidden = true; // shown by pwa.js where the browser can install the app
    const installButton = make("button", "footer-link", "Install the app");
    installButton.type = "button";
    installButton.addEventListener("click", () => document.dispatchEvent(new CustomEvent("install-app")));
    install.appendChild(installButton);
    helpList.appendChild(install);
    help.appendChild(helpList);
    const about = make("div");
    about.appendChild(make("h3", null, "About"));
    const aboutList = make("ul");
    for (const [label, href] of [
      ["About", "index.html#about"],
      ["Privacy", "privacy.html"],
      ["Contact", "contact.html"],
      ["GitHub", "https://github.com/AdnanTarabishi/eu-hem-student-hub"],
    ]) aboutList.appendChild(footerLink(label, href));
    about.appendChild(aboutList);
    grid.appendChild(about);
    footer.appendChild(grid);
    footer.appendChild(make("p", "footer-bottom",
      "Unofficial student project. Not an official website of the University of Bologna, EU-HEM, or any partner university. " +
      "Your study plan and progress are saved only on your device."));
  }
  const afterLoad = () => {
    addSkipLink();
    buildFooter();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", afterLoad);
  else afterLoad();
})();
