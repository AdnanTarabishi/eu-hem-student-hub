/* Shared in-page navigation for the two academic companions.
   Page scripts announce academic:ready after their source-backed content is rendered. */
(function () {
  if (typeof document === "undefined") return;
  const main = document.querySelector(".academic-main");
  const nav = main?.querySelector(".academic-nav");
  if (!nav) return;

  const links = [...nav.querySelectorAll("ol a[href^='#']")];
  const header = document.querySelector(".site-header");
  const smallScreen = window.matchMedia("(max-width: 860px)");
  let ready = false;
  let activeId = "";
  let scrollFrame = 0;
  let historyFrame = 0;
  let closedForPrint = [];

  function hashId(hash = window.location.hash) {
    try { return decodeURIComponent(hash.replace(/^#/, "")); }
    catch { return ""; }
  }

  function linkedSections() {
    return links.map((link) => document.getElementById(hashId(link.hash)))
      .filter((section) => section && !section.hidden);
  }

  function offset() {
    return (header?.offsetHeight || 0) + (smallScreen.matches ? nav.offsetHeight : 0) + 20;
  }

  // Reveal only the horizontal contents scroller. scrollIntoView here would also
  // move the page and pull a reader away from the section they just selected.
  function revealActiveLink() {
    if (!smallScreen.matches) return;
    const link = links.find((item) => hashId(item.hash) === activeId);
    if (!link) return;
    const scroller = link.closest("ol");
    const bounds = scroller.getBoundingClientRect();
    const selected = link.getBoundingClientRect();
    if (selected.left < bounds.left + 3) scroller.scrollLeft += selected.left - bounds.left - 3;
    else if (selected.right > bounds.right - 3) scroller.scrollLeft += selected.right - bounds.right + 3;
  }

  function setActive(id) {
    if (!id) return;
    const changed = id !== activeId;
    activeId = id;
    for (const link of links) {
      if (hashId(link.hash) === id) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
    if (changed) revealActiveLink();
  }

  function updateActiveSection() {
    scrollFrame = 0;
    if (!ready) return;
    const sections = linkedSections();
    if (!sections.length) return;
    let selected = sections[0];
    let closestTop = -Infinity;
    const readingLine = offset() + 65;
    for (const section of sections) {
      const top = section.getBoundingClientRect().top;
      if (top > readingLine) continue;
      if (top > closestTop + 1 || (Math.abs(top - closestTop) <= 1 && section.id === activeId)) {
        selected = section;
        closestTop = top;
      }
    }
    if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3) {
      selected = sections[sections.length - 1];
    }
    setActive(selected.id);
  }

  function scheduleUpdate() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateActiveSection);
  }

  function placeNavigation() {
    document.body.style.setProperty("--academic-header-height", (header?.offsetHeight || 0) + "px");
    document.body.style.setProperty("--academic-nav-height", (smallScreen.matches ? nav.offsetHeight : 0) + "px");
    revealActiveLink();
    scheduleUpdate();
  }

  function navigate(id, { addHistory = false, focus = true } = {}) {
    const target = document.getElementById(id);
    if (!ready || !target || !main.contains(target) || target.hidden) return false;
    // A university or a topic inside its dossier must be readable from an old deep link.
    for (let node = target; node && node !== main; node = node.parentElement) {
      if (node.tagName === "DETAILS") node.open = true;
    }
    if (addHistory && hashId() !== id) window.history.pushState(null, "", "#" + encodeURIComponent(id));
    const section = target.closest(".academic-section");
    if (section) setActive(section.id);
    if (focus) {
      if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
    const top = target.getBoundingClientRect().top + window.scrollY - offset();
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    scheduleUpdate();
    return true;
  }

  main.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.search !== window.location.search || !url.hash) return;
    if (navigate(hashId(url.hash), { addHistory: true })) event.preventDefault();
  });

  // Back/Forward may fire both events. One frame handles either and keeps a deep
  // link's target and keyboard focus together without adding another history entry.
  function followHistory() {
    if (historyFrame) return;
    historyFrame = window.requestAnimationFrame(() => {
      historyFrame = 0;
      if (hashId()) navigate(hashId());
      else {
        // Keep the browser's restored reading position for the original URL.
        main.tabIndex = -1;
        main.focus({ preventScroll: true });
        scheduleUpdate();
      }
    });
  }
  window.addEventListener("popstate", followHistory);
  window.addEventListener("hashchange", followHistory);
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", placeNavigation);
  main.addEventListener("toggle", scheduleUpdate, true);

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(placeNavigation);
    if (header) observer.observe(header);
    observer.observe(nav);
  }

  document.addEventListener("academic:ready", () => {
    ready = true;
    placeNavigation();
    if (hashId()) navigate(hashId());
    else updateActiveSection();
  });

  // Printing includes the complete rules. Closing the print dialog restores each
  // dossier exactly as the reader left it; no preference or data is saved remotely.
  window.addEventListener("beforeprint", () => {
    closedForPrint = [...main.querySelectorAll(".academic-content details:not([open])")];
    for (const details of closedForPrint) details.open = true;
  });
  window.addEventListener("afterprint", () => {
    for (const details of closedForPrint) details.open = false;
    closedForPrint = [];
  });
  placeNavigation();
})();
