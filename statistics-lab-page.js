// Standalone entry point. The course tab mounts the same component directly.
(function () {
  "use strict";
  const host = document.getElementById("statistics-lab");
  if (host && window.StatisticsLab) window.StatisticsLab.mount(host);
})();
