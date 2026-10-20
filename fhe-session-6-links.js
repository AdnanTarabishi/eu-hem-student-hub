// Redirect Session 6 study links to its dedicated page and enrich its course card.
(function () {
  "use strict";
  const TOPIC = "fund-health-economics.insurance-demand";
  const target = "fhe-session-6.html";

  function patch(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll('a[href*="lecture.html"][href*="fund-health-economics.insurance-demand"]').forEach((link) => {
      link.href = target;
    });
    const card = root.querySelector('[data-session="6"]');
    const meta = card?.querySelector(".hem-session-meta");
    if (meta && !meta.querySelector('[data-session6-tools]')) {
      const item = document.createElement("span");
      item.dataset.session6Tools = "true";
      item.textContent = "5 interactive tools";
      meta.appendChild(item);
    }
  }

  const run = () => patch(document);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();

  if (window.MutationObserver) {
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) patch(node);
        }
      }
      patch(document);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
