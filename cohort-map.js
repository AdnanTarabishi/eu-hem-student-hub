// The supplied country-of-origin overview. This component never reads directory profiles.
// Data and totals: cohort-data.js. The separate fictional directory uses students.js.
(function () {
  "use strict";
  const root = document.querySelector("[data-cohort-atlas]");
  const data = window.EUHEM_COHORT;
  if (!root || !data) return;

  const $ = (id) => root.querySelector("#" + id);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const flag = (code) => {
    const node = make("span", "country-flag");
    node.dataset.countryFlag = code;
    node.setAttribute("aria-hidden", "true");
    return node;
  };
  const people = (n) => `${n} ${n === 1 ? "person" : "people"}`;
  const percent = (n) => `${(100 * n / data.total).toFixed(1)}%`;
  const sum = (countries) => countries.reduce((total, country) => total + country.count, 0);
  const byCode = new Map(data.countries.map((country) => [country.code, country]));
  const views = { world: [0, 0, 1000, 438], europe: [436, 16, 178, 102] };
  const state = { selected: null, continent: "", query: "", sort: "count", view: "world", box: [...views.world] };
  const atlas = { svg: null, paths: new Map(), drag: null, loading: false, suppressClick: false };
  const tooltip = $("cm-tooltip");

  function filteredCountries() {
    const query = state.query.trim().toLowerCase();
    return data.countries.filter((country) => (!state.continent || country.continent === state.continent)
      && `${country.name} ${country.code} ${country.code === "US" ? "USA United States of America" : ""}`.toLowerCase().includes(query))
      .sort((a, b) => (state.sort === "count" ? b.count - a.count : 0) || a.name.localeCompare(b.name, "en"));
  }

  function summary() {
    const entries = [
      [data.total, "People represented", `Source overview: ${data.source.notation}`],
      [data.countryCount, "Countries of origin", `EU-HEM cohort ${data.label}`],
      [data.continentCount, "Continents", "Connected through one programme"],
    ];
    $("cm-summary").replaceChildren(...entries.map(([number, label, caption]) => {
      const card = make("li", "cm-stat");
      card.append(make("strong", "cm-stat-number", number), make("span", "cm-stat-label", label), make("span", "cm-stat-caption", caption));
      return card;
    }));
    const continents = [...new Set(data.countries.map((country) => country.continent))]
      .map((name) => ({ name, countries: data.countries.filter((country) => country.continent === name) }))
      .sort((a, b) => sum(b.countries) - sum(a.countries) || a.name.localeCompare(b.name, "en"));
    for (const continent of continents) {
      const option = make("option", null, continent.name);
      option.value = continent.name;
      $("cm-continent-filter").append(option);
      const count = sum(continent.countries);
      const row = make("li", "cm-region");
      const top = make("div", "cm-region-heading");
      top.append(make("strong", null, continent.name), make("span", null, `${count} · ${percent(count)}`));
      const track = make("div", "cm-bar");
      const fill = make("span");
      fill.style.width = percent(count);
      track.setAttribute("aria-hidden", "true");
      track.append(fill);
      row.append(top, track, make("span", "cm-muted", `${continent.countries.length} ${continent.countries.length === 1 ? "country" : "countries"}`));
      $("cm-geography").append(row);
    }
    for (const [id, group] of Object.entries(data.groups)) {
      const countries = data.countries.filter((country) => country.group === id);
      const count = sum(countries);
      const row = make("li", `cm-group cm-group-${id}`);
      const copy = make("div");
      copy.append(make("strong", null, group.label), make("span", "cm-muted", `${countries.length} countries · ${percent(count)}`));
      row.append(copy, make("span", "cm-group-count", count));
      $("cm-source-groups").append(row);
    }
    $("cm-source-line").textContent = `Source: supplied “${data.source.title}” overview · ${data.source.notation}.`;
  }

  function renderCountries(countries) {
    const count = sum(countries);
    $("cm-results-count").textContent = countries.length === data.countryCount
      ? `${data.countryCount} countries · ${data.total} people represented`
      : `${countries.length} of ${data.countryCount} countries · ${count} of ${data.total} people`;
    $("cm-countries").replaceChildren(...countries.map((country) => {
      const item = make("li");
      const button = make("button", "cm-country-row");
      button.type = "button";
      button.dataset.cmCountry = country.code;
      button.setAttribute("aria-pressed", String(state.selected === country.code));
      button.setAttribute("aria-controls", "cm-country-detail");
      button.setAttribute("aria-label", `${country.name}: ${people(country.count)}, ${percent(country.count)} of the overview. Show country details.`);
      const name = make("span", "cm-country-name");
      name.append(flag(country.code), make("span", null, country.name));
      const count = make("strong", "cm-country-count", country.count);
      const share = make("span", "cm-country-share", percent(country.count));
      const detail = make("span", "cm-row-detail", `${country.continent} · ${data.groups[country.group].label}`);
      detail.hidden = state.selected !== country.code;
      const bar = make("span", "cm-row-bar");
      bar.setAttribute("aria-hidden", "true");
      const fill = make("span");
      fill.style.width = percent(country.count);
      bar.append(fill);
      button.append(name, count, share, detail, bar);
      button.addEventListener("click", () => selectCountry(country.code));
      item.append(button);
      return item;
    }));
    $("cm-empty").hidden = countries.length !== 0;
  }

  function renderDetail() {
    const panel = $("cm-country-detail");
    const country = byCode.get(state.selected);
    panel.replaceChildren();
    panel.classList.toggle("has-country", Boolean(country));
    panel.append(make("p", "cm-eyebrow", "Country spotlight"));
    if (!country) {
      const emblem = make("span", "cm-spotlight-icon", "↗");
      emblem.setAttribute("aria-hidden", "true");
      panel.append(emblem, make("h3", null, "Every country adds a perspective."),
        make("p", "cm-detail-copy", "Select a highlighted country or a row in the list to see its count and share of the cohort overview."));
      const foot = make("p", "cm-detail-foot");
      foot.append(make("strong", null, `${data.countryCount} countries, ${data.continentCount} continents.`),
        document.createTextNode(" A shared starting point in Bologna."));
      panel.append(foot);
      return;
    }
    const title = make("h3", "cm-detail-title");
    title.append(flag(country.code), make("span", null, country.name));
    const number = make("p", "cm-detail-number");
    number.append(make("strong", null, country.count), make("span", null, country.count === 1 ? "person represented" : "people represented"));
    const share = make("p", "cm-detail-share");
    share.append(make("strong", null, percent(country.count)), document.createTextNode(` of all ${data.total} people in the overview`));
    const facts = make("dl", "cm-detail-facts");
    for (const [label, value] of [["Continent", country.continent], ["Source group", data.groups[country.group].label]]) {
      const row = make("div");
      row.append(make("dt", null, label), make("dd", null, value));
      facts.append(row);
    }
    const clear = make("button", "cm-clear-selection", "Clear selection");
    clear.type = "button";
    clear.addEventListener("click", () => {
      selectCountry(null);
      $("cm-country-search").focus({ preventScroll: true });
    });
    panel.append(title, number, share, facts, clear);
  }

  function level(count) {
    if (!count) return 0;
    if (count === 1) return 1;
    if (count < 5) return 2;
    if (count < 15) return 3;
    return 4;
  }

  function paintMap(countries) {
    const visible = new Set(countries.map((country) => country.code));
    for (const [code, path] of atlas.paths) {
      const country = byCode.get(code);
      path.setAttribute("class", `cm-country cm-level-${level(country?.count)}${country && !visible.has(code) ? " is-filtered" : ""}${state.selected === code ? " is-selected" : ""}`);
      if (country) {
        path.dataset.cmCountry = code;
        path.setAttribute("role", "button");
        path.setAttribute("tabindex", visible.has(code) ? "0" : "-1");
        path.setAttribute("aria-pressed", String(state.selected === code));
        path.setAttribute("aria-label", `${country.name}: ${people(country.count)}, ${percent(country.count)} of the overview`);
        path.setAttribute("aria-controls", "cm-country-detail");
      } else {
        path.removeAttribute("tabindex");
        path.setAttribute("aria-hidden", "true");
      }
    }
    const selected = atlas.paths.get(state.selected);
    if (selected && atlas.svg && atlas.svg.lastElementChild !== selected) {
      const focused = document.activeElement === selected;
      atlas.svg.append(selected);
      if (focused) selected.focus({ preventScroll: true });
    }
    const european = data.countries.filter((country) => country.continent === "Europe");
    $("cm-view-note").textContent = state.view === "europe"
      ? `Europe view · ${european.length} countries and ${sum(european)} people in the full overview. All ${data.countryCount} countries remain available in the list.`
      : "Shading shows the number of people listed for each country. Use Europe view or the list for smaller countries.";
  }

  function selectCountry(code) {
    state.selected = byCode.has(code) ? code : null;
    // Update rows in place so keyboard/touch focus stays on the selected control.
    for (const row of $("cm-countries").querySelectorAll("[data-cm-country]")) {
      row.setAttribute("aria-pressed", String(row.dataset.cmCountry === state.selected));
      row.querySelector(".cm-row-detail").hidden = row.dataset.cmCountry !== state.selected;
    }
    renderDetail();
    paintMap(filteredCountries());
    hideTooltip();
  }

  function render() {
    const countries = filteredCountries();
    if (!countries.some((country) => country.code === state.selected)) state.selected = null;
    renderCountries(countries);
    renderDetail();
    paintMap(countries);
    hideTooltip();
  }

  function setBox(box) {
    const width = Math.min(1000, Math.max(70, box[2]));
    const height = width * box[3] / box[2];
    state.box = [Math.max(0, Math.min(1000 - width, box[0])), Math.max(0, Math.min(Math.max(0, 438 - height), box[1])), width, height];
    if (atlas.svg) atlas.svg.setAttribute("viewBox", state.box.map((n) => n.toFixed(2)).join(" "));
  }

  function setView(view) {
    state.view = view;
    setBox([...views[view]]);
    for (const button of root.querySelectorAll("[data-cm-view]")) button.setAttribute("aria-pressed", String(button.dataset.cmView === view));
    paintMap(filteredCountries());
    hideTooltip();
  }

  function zoom(factor) {
    const [x, y, width, height] = state.box;
    const next = Math.max(70, Math.min(1000, width * factor));
    const nextHeight = height * next / width;
    setBox([x + (width - next) / 2, y + (height - nextHeight) / 2, next, nextHeight]);
    state.view = "custom";
    for (const button of root.querySelectorAll("[data-cm-view]")) button.setAttribute("aria-pressed", "false");
    paintMap(filteredCountries());
    hideTooltip();
  }

  function hideTooltip() { tooltip.hidden = true; }

  function showTooltip(path, event) {
    const country = byCode.get(path.dataset.cmCountry);
    if (!country || path.classList.contains("is-filtered")) return;
    tooltip.textContent = `${country.name} · ${people(country.count)} · ${percent(country.count)}`;
    tooltip.hidden = false;
    const frame = $("cm-map-frame").getBoundingClientRect();
    const bounds = path.getBoundingClientRect();
    const x = event ? event.clientX - frame.left : bounds.left + bounds.width / 2 - frame.left;
    const y = event ? event.clientY - frame.top : bounds.top - frame.top;
    tooltip.style.left = `${Math.max(8, Math.min(frame.width - tooltip.offsetWidth - 8, x + 12))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(frame.height - tooltip.offsetHeight - 8, y + 12))}px`;
  }

  function mapEvents() {
    const svg = atlas.svg;
    const target = (event) => event.target.closest("[data-cm-country]");
    svg.addEventListener("click", (event) => {
      const path = target(event);
      if (atlas.suppressClick || !path || path.classList.contains("is-filtered")) return;
      selectCountry(path.dataset.cmCountry);
    });
    svg.addEventListener("keydown", (event) => {
      const path = target(event);
      if (path && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        selectCountry(path.dataset.cmCountry);
      }
      if (event.key === "Escape") hideTooltip();
    });
    svg.addEventListener("pointermove", (event) => {
      if (atlas.drag) return;
      const path = target(event);
      if (path) showTooltip(path, event); else hideTooltip();
    });
    svg.addEventListener("pointerleave", hideTooltip);
    svg.addEventListener("focusin", (event) => { const path = target(event); if (path) showTooltip(path); });
    svg.addEventListener("focusout", hideTooltip);
    svg.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      atlas.drag = { x: event.clientX, y: event.clientY, box: [...state.box], moved: false };
    });
    window.addEventListener("pointermove", (event) => {
      if (!atlas.drag) return;
      const dx = event.clientX - atlas.drag.x, dy = event.clientY - atlas.drag.y;
      if (!atlas.drag.moved && Math.hypot(dx, dy) < 6) return;
      atlas.drag.moved = true;
      const scale = atlas.drag.box[2] / svg.getBoundingClientRect().width;
      setBox([atlas.drag.box[0] - dx * scale, atlas.drag.box[1] - dy * scale, ...atlas.drag.box.slice(2)]);
      hideTooltip();
    });
    window.addEventListener("pointerup", () => {
      if (!atlas.drag) return;
      atlas.suppressClick = atlas.drag.moved;
      if (atlas.drag.moved) {
        state.view = "custom";
        for (const button of root.querySelectorAll("[data-cm-view]")) button.setAttribute("aria-pressed", "false");
      }
      atlas.drag = null;
      setTimeout(() => { atlas.suppressClick = false; }, 0);
    });
    window.addEventListener("pointercancel", () => { atlas.drag = null; atlas.suppressClick = false; });
  }

  async function loadMap() {
    if (atlas.loading) return;
    atlas.loading = true;
    $("cm-map").setAttribute("aria-busy", "true");
    try {
      const response = await fetch("assets/map/world-countries.svg");
      if (!response.ok) throw new Error("Map unavailable");
      const parsed = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
      const source = parsed.documentElement;
      if (source.localName !== "svg" || parsed.querySelector("parsererror")) throw new Error("Invalid map");
      const svg = document.importNode(source, true);
      svg.setAttribute("class", "cm-map-svg");
      svg.setAttribute("role", "group");
      svg.setAttribute("aria-label", "Interactive map of the cohort’s countries of origin");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      for (const path of svg.querySelectorAll("path")) path.setAttribute("class", "cm-country cm-level-0");
      $("cm-map").replaceChildren(svg);
      atlas.svg = svg;
      atlas.paths = new Map([...svg.querySelectorAll("path[data-code]")].map((path) => [path.dataset.code, path]));
      setBox(state.box);
      paintMap(filteredCountries());
      mapEvents();
    } catch {
      const fallback = make("div", "cm-map-fallback");
      const retry = make("button", "cm-control", "Retry map");
      retry.type = "button";
      retry.id = "cm-map-retry";
      retry.addEventListener("click", loadMap);
      fallback.append(make("strong", null, "The country list is ready to explore."),
        make("p", null, "The map could not load. All country counts, search and breakdowns are available below."), retry);
      $("cm-map").replaceChildren(fallback);
    } finally {
      atlas.loading = false;
      $("cm-map").removeAttribute("aria-busy");
    }
  }

  for (const button of root.querySelectorAll("[data-cm-view]")) button.addEventListener("click", () => setView(button.dataset.cmView));
  for (const button of root.querySelectorAll("[data-cm-zoom]")) button.addEventListener("click", () => {
    if (button.dataset.cmZoom === "reset") setView("world");
    else zoom(button.dataset.cmZoom === "in" ? 1 / 1.5 : 1.5);
  });
  $("cm-country-search").addEventListener("input", (event) => { state.query = event.target.value; render(); });
  $("cm-continent-filter").addEventListener("change", (event) => { state.continent = event.target.value; render(); });
  $("cm-sort").addEventListener("change", (event) => { state.sort = event.target.value; render(); });
  $("cm-reset").addEventListener("click", () => {
    state.query = state.continent = "";
    state.sort = "count";
    state.selected = null;
    $("cm-country-search").value = $("cm-continent-filter").value = "";
    $("cm-sort").value = "count";
    render();
    setView("world");
  });
  summary();
  render();
  loadMap();
})();
