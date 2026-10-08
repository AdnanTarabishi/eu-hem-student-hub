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
  document.dispatchEvent(new Event("academic:ready"));
})();
