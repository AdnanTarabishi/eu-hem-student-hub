/* The notice is complete without JavaScript. These controls only help readers
   open the prepared terms together, navigate the page and print the full notice. */
(function () {
  if (typeof document === "undefined") return;
  const page = document.querySelector(".privacy-page");
  if (!page) return;
  const terms = [...page.querySelectorAll(".privacy-term")];
  const expand = document.getElementById("privacy-expand-all");
  const print = document.getElementById("privacy-print");

  function updateExpandControl() {
    const allOpen = terms.every((term) => term.open);
    expand.setAttribute("aria-expanded", String(allOpen));
    expand.textContent = allOpen ? "Collapse all registration terms" : "Expand all registration terms";
  }

  if (expand && terms.length) {
    expand.hidden = false;
    expand.addEventListener("click", () => {
      const open = !terms.every((term) => term.open);
      for (const term of terms) term.open = open;
      updateExpandControl();
    });
    for (const term of terms) term.addEventListener("toggle", updateExpandControl);
    updateExpandControl();
  }
  if (print) {
    print.hidden = false;
    print.addEventListener("click", () => window.print());
  }
  // A static notice can finish its scripts before the browser's initial fragment
  // jump. Let that jump and local font layout finish before placing the target,
  // so the sticky contents bar highlights the section the reader opened.
  const pageLoaded = document.readyState === "complete"
    ? Promise.resolve()
    : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  const fontsLoaded = document.fonts?.ready || Promise.resolve();
  const announceReady = () => window.requestAnimationFrame(() => {
    document.dispatchEvent(new Event("academic:ready"));
  });
  Promise.all([pageLoaded, fontsLoaded]).then(announceReady, announceReady);
})();
