// Redirect Session 7 study links to its dedicated page and enrich its course card.
(function () {
  "use strict";
  const target = "fhe-session-7.html";

  function patch(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll('a[href*="lecture.html"][href*="fund-health-economics.adverse-selection"]').forEach((link) => {
      link.href = target;
    });
    const card = root.querySelector('[data-session="7"]');
    const meta = card?.querySelector(".hem-session-meta");
    if (meta && !meta.querySelector('[data-session7-tools]')) {
      const item = document.createElement("span");
      item.dataset.session7Tools = "true";
      item.textContent = "6 interactive tools";
      meta.appendChild(item);
    }
  }

  const run = () => patch(document);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();

  if (window.MutationObserver) {
    new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) patch(node);
      patch(document);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
