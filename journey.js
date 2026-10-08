// ===== Programme Journey page =====
// Fills journey.html from content/programme-events.json. Cities, tracks and "My track" come from
// content/tracks.json and tracks-data.js; semester timing ("spring 2027") from guide-data.js.
// The timeline logic is journeyStops() below: pure, so it is tested in Node.

const EVENTS_URL = "content/programme-events.json";

// ----- Pure helpers (tested) -----

// Where a stage happens: { text, universities } — from tracks.json, never typed in programme-events.json.
// Without a track, semesters 2 to 4 depend on the track.
function stagePlace(cohort, track, stage) {
  const name = (id) => `${cohort.universities[id].city} (${cohort.universities[id].name})`;
  if (stage.semester === 1) return { text: name(cohort.semester1.university), universities: [cohort.semester1.university] };
  if (stage.id === "summer-school") return { text: "Austria", universities: [] };
  if (!stage.semester) return null;
  if (!track) return { text: "Depends on your track", universities: [] };
  if (stage.semester === 4) return { text: track.thesis.map(name).join(" or "), universities: track.thesis };
  const semester = track.semesters.find((s) => s.number === stage.semester);
  return semester ? { text: name(semester.university), universities: [semester.university] } : null;
}

// The timeline: every stage with its timing, place and status ("done", "current" or "later").
// "current" is the first stage that has not ended yet.
function journeyStops(events, cohort, track, today, timing) {
  let currentFound = false;
  return events.stages.map((stage) => {
    const when = stage.semester ? timing(cohort.id, stage.semester) : stage.when;
    let status = "later";
    if (when.ends < today) status = "done";
    else if (!currentFound) { status = "current"; currentFound = true; }
    return { ...stage, whenLabel: when.label, place: stagePlace(cohort, track, stage), status };
  });
}

// "€4,000"
function euros(amount) {
  return `€${amount.toLocaleString("en-GB")}`;
}

// ----- Drawing -----

const journey = { events: null, cohort: null, sources: {}, trackId: null };

function sourced(item) {
  const li = createElement("li", "rules-item", `${item.text} `);
  li.appendChild(sourceLabel(item.source, journey.sources));
  return li;
}

function fillList(list, items) {
  list.replaceChildren(...items.map(sourced));
}

function showPart(id) {
  const section = document.getElementById(id);
  section.hidden = false;
  return section;
}

function currentTrack() {
  return journey.trackId ? trackById(journey.cohort, journey.trackId) : null;
}

function renderOverview() {
  document.querySelector(".journey-hero-cohort").textContent = `EU-HEM · ${journey.cohort.label}`;
  const list = document.querySelector(".journey-summary");
  const semesters = journey.events.stages.filter((stage) => stage.semester);
  const facts = [
    ["ECTS", semesters.reduce((total, stage) => total + (stage.ects || 0), 0)],
    ["semesters", semesters.length],
    ["partner universities", Object.keys(journey.cohort.universities).length]
  ];
  list.replaceChildren(...facts.map(([label, value]) => {
    const item = createElement("div");
    item.append(createElement("dt", null, label), createElement("dd", null, String(value)));
    return item;
  }));
  list.hidden = false;
}

function renderTrackPicker() {
  const box = document.querySelector(".journey-track-picker .choice-options");
  box.replaceChildren();
  const options = [...journey.cohort.tracks.map((t) => ({ value: t.id, label: t.abbr, detail: t.name })), { value: "", label: "Not chosen yet", detail: "See the shared programme" }];
  for (const option of options) {
    const label = createElement("label", "choice-option");
    label.dataset.track = option.value || "none";
    const input = createElement("input");
    input.type = "radio";
    input.name = "journey-track";
    input.value = option.value;
    input.checked = (journey.trackId || "") === option.value;
    input.addEventListener("change", () => {
      journey.trackId = option.value || null;
      saveMyTrack(journey.cohort.id, journey.trackId);
      if (typeof toast === "function") toast(journey.trackId ? `Saved on this device: ${trackById(journey.cohort, journey.trackId).abbr}` : "Track cleared on this device");
      renderTimeline();
      renderErasmusRows();
    });
    const copy = createElement("span", "journey-track-copy");
    copy.append(createElement("strong", "journey-track-code", option.label), createElement("span", "journey-track-name", option.detail));
    label.append(input, copy);
    box.appendChild(label);
  }
  const note = document.querySelector(".journey-track-note");
  note.textContent = "Saved in this browser only, the same choice as on the ";
  const link = createElement("a", null, "Tracks page");
  link.href = "tracks.html";
  note.append(link, ".");
}

// A short route above the full timeline. It uses the same stagePlace() result as the details.
function renderRoute(stops) {
  const list = document.querySelector(".journey-route-stops");
  list.replaceChildren();
  const track = currentTrack();
  document.querySelector(".journey-route-selected").textContent = track ? `${track.abbr} route selected` : "Choose a track to see your cities";
  for (const stop of stops.filter((stage) => stage.semester)) {
    const item = createElement("li", `journey-route-stop is-${stop.status}`);
    const link = createElement("a");
    link.href = `#stage-${stop.id}`;
    const cities = stop.place.universities.map((id) => journey.cohort.universities[id].city);
    const city = cities.length ? cities.join(" or ") : stop.place.text;
    link.append(createElement("span", "journey-route-term", `Semester ${stop.semester}`), createElement("strong", "journey-route-city", city));
    link.appendChild(createElement("span", "journey-route-detail", `${stop.semester === 4 ? "Master’s thesis · " : ""}${stop.ects} ECTS`));
    if (stop.status === "current") {
      link.appendChild(createElement("span", "journey-route-current", "Current stage"));
      link.setAttribute("aria-current", "step");
    }
    link.setAttribute("aria-label", `Semester ${stop.semester}: ${city}. ${stop.ects} ECTS. Jump to stage details.`);
    item.appendChild(link);
    list.appendChild(item);
  }
}

function renderTimeline() {
  const list = document.querySelector(".journey-timeline");
  list.replaceChildren();
  const stops = journeyStops(journey.events, journey.cohort, currentTrack(), todayKey(), semesterTiming);
  renderRoute(stops);
  stops.forEach((stop, index) => {
    const item = createElement("li", `journey-stop is-${stop.status}`);
    item.id = `stage-${stop.id}`;
    if (stop.status === "current") item.setAttribute("aria-current", "step");
    const marker = createElement("span", "journey-stage-marker", String(index + 1).padStart(2, "0"));
    marker.setAttribute("aria-hidden", "true");
    const content = createElement("div", "journey-stage-content");
    const head = createElement("div", "journey-stop-head");
    const meta = [stop.whenLabel, stop.ects ? `${stop.ects} ECTS` : null].filter(Boolean).join(" · ");
    head.appendChild(createElement("p", "journey-stop-meta", meta));
    if (stop.status === "current") head.appendChild(createElement("span", "journey-here", "You are here"));
    if (stop.status === "done") head.appendChild(createElement("span", "journey-done", "Done"));
    head.appendChild(createElement("h3", null, stop.title));
    content.appendChild(head);
    if (stop.place) {
      const place = createElement("p", "journey-place");
      place.append(createElement("strong", null, "Where: "), stop.place.text);
      if (stop.place.text === "Depends on your track") place.classList.add("is-unknown");
      content.appendChild(place);
    }
    const items = createElement("ul", "rules-list");
    fillList(items, stop.items);
    content.appendChild(items);
    item.append(marker, content);
    list.appendChild(item);
  });
}

function renderDegree() {
  const section = showPart("degree");
  const { jointDegree } = journey.events;
  section.querySelector(".journey-degree-intro").textContent = jointDegree.intro;
  const titles = section.querySelector(".journey-titles");
  for (const entry of jointDegree.titles) {
    const university = journey.cohort.universities[entry.university];
    const li = createElement("li", "journey-degree-title");
    li.style.setProperty("--journey-city-accent", `var(--city-${university.city.toLowerCase()})`);
    li.append(createElement("span", "journey-degree-country", university.country), createElement("strong", null, entry.title), createElement("span", "journey-degree-university", university.name));
    titles.appendChild(li);
  }
  titles.after(sourceLabel(jointDegree.source, journey.sources));
  fillList(section.querySelector(".rules-list"), jointDegree.items);
}

function renderNumbers() {
  const section = showPart("numbers");
  const { cohortNumbers } = journey.events;
  section.querySelector("h2").textContent = `${cohortNumbers.title} (${cohortNumbers.cohortLabel})`;
  const list = section.querySelector(".journey-figures");
  if (cohortNumbers.note) list.before(createElement("p", "schedule-meta journey-snapshot-note", cohortNumbers.note));
  for (const figure of cohortNumbers.figures) {
    const box = createElement("div", "journey-figure");
    box.append(createElement("dt", null, figure.label), createElement("dd", null, figure.value));
    list.appendChild(box);
  }
  section.appendChild(sourceLabel(cohortNumbers.source, journey.sources));
  if (cohortNumbers.updatedOverview) {
    const { label, href } = cohortNumbers.updatedOverview;
    const note = createElement("p", "rules-note journey-snapshot-link");
    const link = createElement("a", null, label);
    link.href = href;
    note.appendChild(link);
    section.appendChild(note);
  }
}

function renderHistory() {
  const section = showPart("history");
  const list = section.querySelector(".journey-history");
  for (const event of journey.events.history.events) {
    const li = createElement("li");
    li.append(createElement("strong", "journey-year", String(event.year)), createElement("span", null, event.text));
    list.appendChild(li);
  }
  section.appendChild(sourceLabel(journey.events.history.source, journey.sources));
}

function renderErasmusRows() {
  const table = document.querySelector(".journey-erasmus-table");
  table.replaceChildren();
  const caption = table.createCaption();
  caption.className = "sr-only";
  caption.textContent = "Erasmus+ grant-paying university by track. See the qualifications below the table.";
  const head = table.createTHead().insertRow();
  for (const text of ["Track", "Who pays the grant"]) {
    const th = createElement("th", null, text);
    th.scope = "col";
    head.appendChild(th);
  }
  const body = table.createTBody();
  for (const entry of journey.events.erasmus.byTrack) {
    const track = trackById(journey.cohort, entry.track);
    const row = body.insertRow();
    if (entry.track === journey.trackId) row.className = "is-mine";
    row.dataset.track = track.id;
    const th = createElement("th");
    th.scope = "row";
    th.append(createElement("strong", `journey-grant-code track-pill-${track.id}`, track.abbr), createElement("span", "journey-grant-name", track.name));
    if (entry.track === journey.trackId) th.appendChild(createElement("span", "journey-mine", "your track"));
    row.appendChild(th);
    const payer = row.insertCell();
    payer.dataset.label = "Who pays the grant";
    payer.textContent = `${entry.text}*`;
  }
}

function renderErasmus() {
  const section = showPart("erasmus");
  const { erasmus } = journey.events;
  section.querySelector(".journey-erasmus-intro").textContent = erasmus.intro;
  renderErasmusRows();
  const caveat = section.querySelector(".journey-erasmus-caveat");
  caveat.append(`* ${erasmus.caveat} `, sourceLabel(erasmus.source, journey.sources));
  fillList(section.querySelector(".rules-list"), erasmus.items);
}

function renderFees() {
  const section = showPart("fees");
  const { fees } = journey.events;
  const box = section.querySelector(".journey-fees");
  const fee = fees.byCohort[journey.events.cohort];
  if (!fee) {
    box.appendChild(createElement("p", null, fees.missing));
    return;
  }
  box.appendChild(createElement("p", "schedule-meta journey-fee-year", `Cohort ${journey.events.cohort}, academic year ${fee.academicYear}:`));
  const list = createElement("dl", "journey-figures");
  for (const [label, amount] of [["Programme country students", fee.programmeCountries], ["Partner country students", fee.partnerCountries]]) {
    const item = createElement("div", "journey-figure");
    item.append(createElement("dt", null, label), createElement("dd", null, euros(amount)));
    list.appendChild(item);
  }
  box.appendChild(list);
  const note = createElement("p", null, `${fee.note} `);
  note.appendChild(sourceLabel(fee.source, journey.sources));
  box.appendChild(note);
  box.appendChild(createElement("p", "schedule-meta journey-fee-scope", fees.missing));
}

async function initJourney() {
  const status = document.getElementById("journey-status");
  try {
    const [eventsResponse, sources, tracksFile] = await Promise.all([fetch(EVENTS_URL, { cache: "no-cache" }), loadSources(), loadTracksFile()]);
    if (!eventsResponse.ok) throw new Error(`HTTP ${eventsResponse.status}`);
    journey.events = await eventsResponse.json();
    journey.sources = sources;
    journey.cohort = tracksCohort(tracksFile, journey.events.cohort);
    const saved = loadMyTrack();
    journey.trackId = saved && saved.cohort === journey.cohort.id && trackById(journey.cohort, saved.track) ? saved.track : null;

    document.getElementById("journey-intro").textContent = journey.events.intro;
    renderOverview();
    showPart("timeline");
    renderTrackPicker();
    renderTimeline();
    renderDegree();
    renderNumbers();
    renderHistory();
    renderErasmus();
    renderFees();
    status.remove();
    document.dispatchEvent(new CustomEvent("academic:ready"));
  } catch (error) {
    console.error("Programme journey:", error);
    status.textContent = "Sorry, the programme journey could not be loaded right now. Please try again later.";
    const retry = createElement("button", "button button-secondary", "Try again");
    retry.type = "button";
    retry.addEventListener("click", () => window.location.reload());
    status.append(" ", retry);
  }
}

if (typeof document !== "undefined" && document.getElementById("journey-status")) initJourney();

if (typeof module !== "undefined") module.exports = { stagePlace, journeyStops, euros };
