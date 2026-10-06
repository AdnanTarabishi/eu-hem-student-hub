// ===== Light / dark mode =====
// Loaded at the top of every page (in <head>), so the right colours apply before
// anything is drawn - no white flash in dark mode.
// By default the site follows the device setting. The 🌙/☀️ button overrides it,
// and the choice is remembered in this browser.

(function () {
  const STORAGE_KEY = "euhem-theme";
  const root = document.documentElement;

  function savedTheme() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null; // storage blocked: just follow the device
    }
  }

  function deviceTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function currentTheme() {
    return root.dataset.theme || deviceTheme();
  }

  // 1. Apply a saved choice immediately
  const saved = savedTheme();
  if (saved) root.dataset.theme = saved;

  // 2. Add the toggle button once the header exists
  function addToggle() {
    // In the header bar (site-nav.js), before the phone "Menu" button; otherwise top-right of the header
    const header = document.querySelector(".header-actions") || document.querySelector(".site-header .container");
    if (!header || header.querySelector(".theme-toggle")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle header-button";
    const update = () => {
      const dark = currentTheme() === "dark";
      // Outline icon from icons.svg (sun in dark mode, moon in light mode)
      button.innerHTML = `<svg class="icon" aria-hidden="true"><use href="icons.svg#${dark ? "sun" : "moon"}"></use></svg>`;
      button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      button.title = button.getAttribute("aria-label");
    };
    button.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // storage blocked: the choice lasts until the page is closed
      }
      update();
      if (typeof markSetupDone === "function") markSetupDone("theme"); // setup checklist (ui.js)
    });
    // If the device switches theme and the visitor hasn't chosen, update the icon
    if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
    update();
    const menuButton = header.querySelector(".menu-toggle");
    if (menuButton) header.insertBefore(button, menuButton);
    else header.prepend(button);
  }

  window.addThemeToggle = addToggle; // site-nav.js calls this right after building the header
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addToggle);
  else addToggle();
})();
