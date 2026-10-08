// Homepage-only news carousel. The shared announcements loader supplies the
// already filtered feed; this controller never makes another data request.
(function () {
  "use strict";
  const ROTATION_MS = 6000;
  let mounted = null;

  function newsIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "icons.svg#" + name);
    svg.appendChild(use);
    return svg;
  }

  function excerpt(item) {
    const message = isElectionResultsAnnouncement(item)
      ? (item.message || "").split(/\r?\n/)[0]
      : (item.message || "");
    const text = message.replace(/\s+/g, " ").trim();
    if (text.length <= 200) return text;
    const short = text.slice(0, 197);
    return short.slice(0, Math.max(short.lastIndexOf(" "), 150)) + "…";
  }

  function cover(item) {
    const box = createElement("div", "eh-news-cover");
    box.setAttribute("aria-hidden", "true");
    const image = createElement("img");
    image.alt = "";
    image.width = 800;
    image.height = 500;
    image.loading = "lazy";
    image.decoding = "async";
    const fallback = announcementCoverPath({});
    const initial = announcementCoverPath(item);
    let triedFallback = initial === fallback;
    let failed = false;
    image.addEventListener("error", () => {
      if (failed) return;
      if (!triedFallback) {
        triedFallback = true;
        image.src = fallback;
        return;
      }
      failed = true;
      image.remove();
      const lineArt = createElement("span", "eh-news-cover-fallback");
      lineArt.appendChild(newsIcon("bell"));
      box.appendChild(lineArt);
    });
    image.src = initial;
    box.appendChild(image);
    return box;
  }

  function story(item, today, index, total) {
    const slide = createElement("article", "eh-news-slide");
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", `${index + 1} of ${total}`);
    slide.appendChild(cover(item));
    const copy = createElement("div", "eh-news-copy");
    const meta = createElement("div", "eh-news-meta");
    if (item.category) {
      const categoryClass = CATEGORY_CLASSES[item.category] || "category-other";
      meta.appendChild(createElement("span", `category-badge ${categoryClass}`, item.category));
    }
    if (item.pinned) meta.appendChild(createElement("span", "pinned-badge", "Pinned"));
    if (isNewAnnouncement(item, today)) meta.appendChild(createElement("span", "new-badge", "New"));
    if (item.date) {
      const time = createElement("time", "announcement-date", formatDay(item.date, { day: "numeric", month: "short", year: "numeric" }));
      time.dateTime = item.date;
      meta.appendChild(time);
    }
    copy.appendChild(meta);
    const heading = createElement("h3", "eh-news-title");
    const title = createElement("a", null, item.title);
    title.href = "announcements.html#" + item.id;
    heading.appendChild(title);
    copy.appendChild(heading);
    const preview = excerpt(item);
    if (preview) copy.appendChild(createElement("p", "eh-news-excerpt", preview));
    const read = createElement("a", "eh-news-read", "Read update");
    read.href = title.href;
    read.appendChild(createElement("span", "visually-hidden", `: ${item.title}`));
    read.appendChild(newsIcon("arrow-right"));
    copy.appendChild(read);
    slide.appendChild(copy);
    return slide;
  }

  function mount(box) {
    const media = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const carousel = createElement("div", "eh-news-carousel");
    carousel.setAttribute("role", "region");
    carousel.setAttribute("aria-roledescription", "carousel");
    carousel.setAttribute("aria-label", "Latest Hub announcements");
    carousel.setAttribute("aria-live", "off");
    const slides = createElement("div", "eh-news-slides");
    const controls = createElement("div", "eh-news-controls");
    const count = createElement("span", "eh-news-count");
    count.setAttribute("aria-live", "off");
    const previous = createElement("button", "eh-news-prev");
    const next = createElement("button", "eh-news-next");
    const toggle = createElement("button", "eh-news-toggle");
    for (const [button, label, symbol] of [[previous, "Previous update", "chevron-left"], [next, "Next update", "chevron-right"]]) {
      button.type = "button";
      button.setAttribute("aria-label", label);
      button.appendChild(newsIcon(symbol));
    }
    toggle.type = "button";
    const status = createElement("span", "eh-news-status visually-hidden");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    controls.append(count, previous, next, toggle);
    carousel.append(slides, controls, status);
    box.replaceChildren(carousel);

    let items = [];
    let index = 0;
    let timer = null;
    let userPaused = !!(media && media.matches);
    let hovered = false;
    let focused = false;
    // An observer must confirm that the carousel is on screen before rotation.
    let inView = !("IntersectionObserver" in window);

    function clearTimer() {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    }

    function syncTimer() {
      clearTimer();
      if (items.length < 2 || userPaused || hovered || focused || document.hidden || !inView || !box.isConnected) return;
      timer = window.setTimeout(() => {
        timer = null;
        show(index + 1, false);
        syncTimer();
      }, ROTATION_MS);
    }

    function updateToggle() {
      toggle.textContent = userPaused ? "Play" : "Pause";
      toggle.setAttribute("aria-label", userPaused ? "Play automatic news rotation" : "Pause automatic news rotation");
      carousel.dataset.newsAutoplay = userPaused ? "paused" : "playing";
    }

    function show(position, manual) {
      if (!items.length) return;
      index = (position + items.length) % items.length;
      for (let i = 0; i < slides.children.length; i++) {
        slides.children[i].hidden = i !== index;
        slides.children[i].setAttribute("aria-hidden", String(i !== index));
      }
      count.textContent = `${index + 1} / ${items.length}`;
      count.setAttribute("aria-label", `Update ${index + 1} of ${items.length}`);
      if (manual) {
        userPaused = true;
        updateToggle();
        status.textContent = `Update ${index + 1} of ${items.length}. Automatic rotation paused.`;
        syncTimer();
      }
    }

    previous.addEventListener("click", () => show(index - 1, true));
    next.addEventListener("click", () => show(index + 1, true));
    toggle.addEventListener("click", () => {
      userPaused = !userPaused;
      updateToggle();
      status.textContent = userPaused ? "Automatic rotation paused." : "Automatic rotation enabled.";
      syncTimer();
    });
    carousel.addEventListener("mouseenter", () => { hovered = true; syncTimer(); });
    carousel.addEventListener("mouseleave", () => { hovered = false; syncTimer(); });
    carousel.addEventListener("focusin", () => { focused = true; syncTimer(); });
    carousel.addEventListener("focusout", (event) => {
      focused = carousel.contains(event.relatedTarget);
      syncTimer();
    });
    const visibility = () => syncTimer();
    const motion = () => {
      if (media.matches) {
        userPaused = true;
        updateToggle();
      }
      syncTimer();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", clearTimer);
    window.addEventListener("pageshow", visibility);
    if (media) {
      if (media.addEventListener) media.addEventListener("change", motion);
      else if (media.addListener) media.addListener(motion);
    }
    const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      syncTimer();
    }, { threshold: 0.1 }) : null;
    if (observer) observer.observe(carousel);

    return {
      box,
      update(active, today) {
        clearTimer();
        const previousId = items[index] && items[index].id;
        // The same stable announcement ID should never appear twice in a carousel.
        items = [...new Map(active.map((item) => [item.id, item])).values()];
        index = Math.max(0, items.findIndex((item) => item.id === previousId));
        const feedStatus = document.getElementById("latest-announcements-status");
        if (feedStatus) {
          feedStatus.hidden = items.length > 0;
          if (!items.length) feedStatus.textContent = "No announcements right now.";
        }
        carousel.hidden = items.length === 0;
        controls.hidden = items.length < 2;
        previous.disabled = next.disabled = toggle.disabled = items.length < 2;
        slides.replaceChildren(...items.map((item, i) => story(item, today, i, items.length)));
        show(index, false);
        updateToggle();
        syncTimer();
      },
      destroy() {
        clearTimer();
        if (observer) observer.disconnect();
        document.removeEventListener("visibilitychange", visibility);
        window.removeEventListener("pagehide", clearTimer);
        window.removeEventListener("pageshow", visibility);
        if (media) {
          if (media.removeEventListener) media.removeEventListener("change", motion);
          else if (media.removeListener) media.removeListener(motion);
        }
      },
    };
  }

  window.renderHomeNews = function (active, today) {
    const box = document.getElementById("latest-announcements");
    if (!box) return;
    if (!mounted || mounted.box !== box) {
      if (mounted) mounted.destroy();
      mounted = mount(box);
    }
    mounted.update(active, today);
  };
})();
