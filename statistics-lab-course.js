/* Progressive enhancement for the existing asynchronous course router.
 * The lab is a real inline course panel, not an iframe or external redirect.
 * Keep its DOM outside #course-page so timetable refreshes do not erase inputs.
 * Observe only the course container; no global functions or course data are changed.
 */
(function () {
  "use strict";
  const course = document.getElementById("course-page");
  if (!course || new URLSearchParams(location.search).get("course") !== "quant-methods") return;
  const url = "course.html?course=quant-methods&tab=lab";
  const panel = document.createElement("section");
  panel.id = "statistics-lab-course-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Interactive Statistics Lab");
  course.insertAdjacentElement("afterend", panel);
  let mounted = false;

  function openLab(event) {
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)) return;
    if (event) event.preventDefault();
    history.pushState(null, "", url);
    enhance();
    window.scrollTo({ top: 0, behavior: "auto" });
    const title = panel.querySelector("h1");
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
  }
  function link(text, className) {
    const anchor = document.createElement("a");
    anchor.textContent = text; anchor.href = url; anchor.className = className;
    anchor.addEventListener("click", openLab);
    return anchor;
  }
  function enhance() {
    const active = new URLSearchParams(location.search).get("tab") === "lab";
    const nav = course.querySelector(".qm-course-tabs");
    if (nav && !nav.querySelector("[data-statistics-lab-link]")) {
      const anchor = link("Interactive Lab", "qm-course-tab");
      anchor.dataset.statisticsLabLink = "true";
      nav.insertBefore(anchor, nav.querySelector(".qm-library"));
    }
    const module = course.querySelector(".qm-module");
    if (module && !module.querySelector("[data-statistics-lab-cta]")) {
      const anchor = link("Normal Distribution + Z-table →", "qm-button qm-secondary");
      anchor.dataset.statisticsLabCta = "true";
      module.appendChild(anchor);
    }
    const labLink = nav && nav.querySelector("[data-statistics-lab-link]");
    if (active) {
      if (nav) nav.querySelectorAll('[aria-current="page"]').forEach(a => a.removeAttribute("aria-current"));
      if (labLink) labLink.setAttribute("aria-current", "page");
      if (!mounted) {
        if (window.StatisticsLab) { window.StatisticsLab.mount(panel); mounted = true; }
        else {
          panel.replaceChildren(document.createTextNode("The lab could not load. "));
          const fallback = document.createElement("a");
          fallback.href = "statistics-lab.html";
          fallback.textContent = "Open the standalone lab →";
          panel.appendChild(fallback);
        }
      }
    } else if (labLink) labLink.removeAttribute("aria-current");
    course.querySelectorAll(".course-panel, #course-status").forEach(el => { el.hidden = active; });
    panel.hidden = !active;
  }
  // The native router replaces its header/panel after fetches and tab navigation.
  // Additions below are idempotent; attributes are deliberately not observed.
  new MutationObserver(enhance).observe(course, { childList: true, subtree: true });
  window.addEventListener("popstate", enhance);
  enhance();
})();
