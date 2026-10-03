// ===== Installable app + offline (on every page) =====
// - Registers the service worker (sw.js), which keeps offline copies of the site.
// - "Install the app": uses the browser's install prompt where there is one (Chrome, Edge, Android).
//   iPhones and iPads have no prompt, so they get "Share → Add to Home Screen" instructions.
// - "Update available · Reload" when a new version of the site has been published.
// - An offline banner: "You're offline: showing data saved on 3 Oct, 14:20".

(function pwa() {
  if (typeof window === "undefined") return;
  let installPrompt = null; // the browser's install offer, kept until the visitor asks for it

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPads say "Mac"
  const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  function showInstallButtons(show) {
    for (const item of document.querySelectorAll(".footer-install")) item.hidden = !show;
  }

  // ----- Install -----

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // don't show the browser's own banner; we offer it in the footer and checklist
    installPrompt = event;
    showInstallButtons(true);
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    showInstallButtons(false);
    if (typeof markSetupDone === "function") markSetupDone("install");
    if (typeof toast === "function") toast("App installed ✓ Find it on your home screen.");
  });

  document.addEventListener("install-app", async () => {
    if (isInstalled()) {
      toast("You're already using the installed app ✓");
      return;
    }
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      installPrompt = null;
      if (outcome === "accepted") showInstallButtons(false);
      return;
    }
    if (isIos) {
      toast("On iPhone or iPad: open this site in Safari, tap Share (the square with an arrow), then “Add to Home Screen”.", { duration: 12000 });
      return;
    }
    toast("Your browser doesn't offer installing here. On Android, open the site in Chrome and choose ⋮ → “Install app” (or “Add to Home screen”).", { duration: 12000 });
  });

  // The footer is built when the page has loaded, possibly after the install offer arrived
  document.addEventListener("DOMContentLoaded", () => {
    showInstallButtons(!isInstalled() && (!!installPrompt || isIos)); // iPhones: instructions are available
    if (isInstalled() && typeof markSetupDone === "function") markSetupDone("install");
  });

  // ----- Offline banner -----

  let savedAt = null;

  // Offline = the device says so, or saved data had to be used (e.g. Wi-Fi without internet,
  // where the device still claims to be online)
  function updateOfflineBanner() {
    let banner = document.getElementById("offline-banner");
    if (navigator.onLine && !savedAt) {
      if (banner) banner.remove();
      return;
    }
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "offline-banner";
      banner.className = "offline-banner";
      banner.setAttribute("role", "status");
      document.body.prepend(banner);
    }
    const when = savedAt
      ? new Date(savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : null;
    banner.textContent = when
      ? `You're offline: showing data saved on ${when}.`
      : "You're offline: showing the last saved copy of this page.";
  }

  window.addEventListener("online", () => {
    savedAt = null;
    updateOfflineBanner();
    toast("Back online ✓");
  });
  window.addEventListener("offline", updateOfflineBanner);
  document.addEventListener("DOMContentLoaded", updateOfflineBanner);

  // ----- Service worker -----

  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "offline-data") {
      // Keep the oldest date: that is how old the page's data can be
      if (event.data.savedAt && (!savedAt || event.data.savedAt < savedAt)) savedAt = event.data.savedAt;
      updateOfflineBanner();
    }
  });

  function offerUpdate(worker) {
    toast("A new version of the site is available.", {
      duration: 0, // stays until clicked
      action: { label: "Reload", onClick: () => worker.postMessage({ type: "skip-waiting" }) },
    });
  }

  window.addEventListener("load", async () => {
    try {
      const hadWorker = !!navigator.serviceWorker.controller;
      const registration = await navigator.serviceWorker.register("sw.js");
      // A new version already downloaded and waiting
      if (registration.waiting && hadWorker) offerUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker.addEventListener("statechange", () => {
          // "installed" while an older version controls the page = an update (not the first install)
          if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
      // The new version took over: reload once to use it
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadWorker || reloading) return;
        reloading = true;
        window.location.reload();
      });
    } catch (error) {
      console.error("Offline support could not start:", error);
    }
  });
})();
