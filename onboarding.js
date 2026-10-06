// ===== Welcome & setup guide (home page) =====
// A checklist of 5 quick steps that make the site yours. Steps tick themselves:
//   plan      when a study plan is saved (studyplan.html)
//   calendar  when a subscribe button is clicked (calendar.html)
//   install   when the app is installed (pwa.js), or skipped
//   search    when search is opened (search.js)
//   theme     when the light/dark button is used (theme.js)
// Layout: a navy panel with a progress ring and the next suggested step, and a grid of step cards.
// "Hide" closes the panel; "Getting started" in the footer (index.html#welcome) brings it back.
// Progress is saved in this browser only (loadSetup / markSetupDone in ui.js).

const SETUP_STEPS = [
  {
    id: "plan", title: "Choose your study plan", icon: "study-plan", time: "2 min",
    text: "The timetable, exams and calendar then show only your courses.",
    action: { label: "Open Study Plan", href: "studyplan.html" },
  },
  {
    id: "calendar", title: "Subscribe to your calendar", icon: "calendar", time: "1 min",
    text: "Classes and exams appear in Google, Apple or Outlook Calendar and update by themselves.",
    action: { label: "Get the calendar", href: "calendar.html" },
  },
  {
    id: "install", title: "Install the app on your phone", icon: "download", time: "1 min",
    text: "Opens from your home screen like an app, and works offline.",
    action: { label: "Install", event: "install-app" },
    skippable: true,
  },
  {
    id: "search", title: "Try search", icon: "search", time: "10 sec",
    text: "Press Ctrl K (⌘K on Mac) or tap the search button to find any course, note or page.",
    action: { label: "Try it", event: "open-search" },
  },
  {
    id: "theme", title: "Pick light or dark mode", icon: "moon", time: "5 sec",
    text: "Use the moon / sun button at the top of every page.",
    action: { label: "Switch mode", click: ".theme-toggle" },
  },
];

// Shown when every step is done: where to go next
const NEXT_EXPLORE = [
  { label: "Academic Rules", href: "academic-rules.html", icon: "scale", text: "Re-sits, grades, AI" },
  { label: "Programme Journey", href: "journey.html", icon: "graduation", text: "Your two years" },
  { label: "City guides", href: "city-guide.html", icon: "guide", text: "Life in your next city" },
];

const welcome = { planSaved: false, celebrate: false };

// Which steps are done. "Installed" also counts when the site is already open as an app.
function setupProgress(state, planSaved, installed) {
  const done = {};
  for (const step of SETUP_STEPS) done[step.id] = !!state.done[step.id];
  if (planSaved) done.plan = true;
  if (installed) done.install = true;
  const count = Object.values(done).filter(Boolean).length;
  const next = SETUP_STEPS.find((step) => !done[step.id]) || null;
  return { done, count, total: SETUP_STEPS.length, complete: count === SETUP_STEPS.length, next };
}

function runningAsApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function welcomeIcon(name, className = "icon") {
  return typeof siteIcon === "function" ? siteIcon(name, className) : document.createElement("span");
}

// The button of a step: a link, an event (install, search) or a click on another control (theme)
function stepButton(step, className) {
  const { action } = step;
  let button;
  if (action.href) {
    button = createElement("a", className, action.label);
    button.href = action.href;
  } else {
    button = createElement("button", className, action.label);
    button.type = "button";
    button.addEventListener("click", () => {
      if (action.event) document.dispatchEvent(new CustomEvent(action.event));
      if (action.click) document.querySelector(action.click)?.click();
    });
  }
  button.setAttribute("aria-label", `${action.label}: ${step.title}`);
  return button;
}

function stepItem(step, index, isDone, skipped, isNext) {
  const item = createElement("li", `setup-step${isDone ? " is-done" : ""}${isNext ? " is-next" : ""}${skipped ? " is-skipped" : ""}`);
  const top = createElement("div", "setup-step-top");
  const icon = createElement("span", "setup-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.appendChild(welcomeIcon(isDone ? "check" : step.icon));
  top.append(icon, createElement("span", "setup-number", `Step ${index + 1}`),
    createElement("span", "setup-time", isDone ? (skipped ? "Skipped" : "Done") : step.time));
  item.appendChild(top);

  const title = createElement("strong", "setup-title", step.title);
  // Screen readers hear the state too, not only see the tick
  title.appendChild(createElement("span", "visually-hidden", isDone ? (skipped ? " (skipped)" : " (done)") : " (to do)"));
  item.append(title, createElement("p", "setup-sub", step.text));

  if (!isDone) {
    const actions = createElement("div", "setup-actions");
    actions.appendChild(stepButton(step, isNext ? "button button-primary" : "button button-light"));
    if (step.skippable) {
      const skip = createElement("button", "button button-quiet", "Skip");
      skip.type = "button";
      skip.setAttribute("aria-label", `Skip: ${step.title}`);
      skip.addEventListener("click", () => markSetupDone(step.id, "skipped"));
      actions.appendChild(skip);
    }
    item.appendChild(actions);
  }
  return item;
}

// A ring showing how many steps are done (SVG circle; the text is read by screen readers via aria)
function progressRing(count, total) {
  const percent = Math.round((count / total) * 100);
  const box = createElement("div", "welcome-ring");
  box.setAttribute("role", "progressbar");
  box.setAttribute("aria-valuemin", "0");
  box.setAttribute("aria-valuemax", String(total));
  box.setAttribute("aria-valuenow", String(count));
  box.setAttribute("aria-label", `${count} of ${total} setup steps done`);
  box.style.setProperty("--welcome-progress", String(percent));
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("aria-hidden", "true");
  for (const [className, dash] of [["welcome-ring-track", null], ["welcome-ring-fill", percent]]) {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", "60");
    circle.setAttribute("cy", "60");
    circle.setAttribute("r", "52");
    circle.setAttribute("pathLength", "100");
    circle.setAttribute("class", className);
    if (dash !== null) circle.setAttribute("stroke-dasharray", `${dash} 100`);
    svg.appendChild(circle);
  }
  const label = createElement("span", "welcome-ring-label");
  label.append(createElement("strong", null, `${count}/${total}`), createElement("span", null, `${percent}%`));
  box.append(svg, label);
  return box;
}

function welcomePanel(progress) {
  const panel = createElement("div", "welcome-panel");
  panel.appendChild(createElement("p", "welcome-eyebrow", progress.complete ? "Setup complete" : "Getting started"));
  const title = createElement("h2", null, progress.complete ? "You're all set 🎉" : "Welcome to the EU-HEM Student Hub");
  title.id = "welcome-title";
  panel.append(title, createElement("p", "welcome-sub", progress.complete
    ? "Everything is set up. You can hide this panel; “Getting started” at the bottom of every page brings it back."
    : "Five quick steps, about five minutes in total, to make the site yours."));

  const status = createElement("div", "welcome-status");
  status.appendChild(progressRing(progress.count, progress.total));
  const next = createElement("div", "welcome-next");
  if (progress.next) {
    next.appendChild(createElement("span", "welcome-next-label", "Next up"));
    next.appendChild(createElement("strong", null, progress.next.title));
    next.appendChild(stepButton(progress.next, "button welcome-next-button"));
  } else {
    next.appendChild(createElement("span", "welcome-next-label", "Explore next"));
    const list = createElement("ul", "welcome-explore");
    for (const entry of NEXT_EXPLORE) {
      const li = createElement("li");
      const a = createElement("a");
      a.href = entry.href;
      a.append(welcomeIcon(entry.icon), createElement("span", null, entry.label));
      li.appendChild(a);
      list.appendChild(li);
    }
    next.appendChild(list);
  }
  status.appendChild(next);
  panel.appendChild(status);

  const privacy = createElement("p", "welcome-privacy");
  privacy.append(welcomeIcon("lock"), document.createTextNode(" Saved on this device only. Nothing is sent anywhere."));
  panel.appendChild(privacy);
  return panel;
}

function renderWelcome() {
  const slot = document.getElementById("welcome-slot");
  const state = loadSetup();
  const progress = setupProgress(state, welcome.planSaved, runningAsApp());
  slot.innerHTML = "";
  if (state.hidden) return;
  if (progress.complete && !welcome.celebrate) return; // finished on an earlier visit

  const card = createElement("section", `card welcome-card${progress.complete ? " is-complete" : ""}`);
  card.id = "welcome";
  card.setAttribute("aria-labelledby", "welcome-title");

  const hide = createElement("button", "button button-quiet welcome-hide", "Hide");
  hide.type = "button";
  hide.setAttribute("aria-label", "Hide the welcome checklist");
  hide.addEventListener("click", () => {
    saveSetup({ ...loadSetup(), hidden: true });
    if (typeof toast === "function") toast("Hidden. “Getting started” at the bottom of the page brings it back.");
  });

  const list = createElement("ol", "setup-list");
  list.setAttribute("aria-label", "Setup steps");
  SETUP_STEPS.forEach((step, index) => {
    list.appendChild(stepItem(step, index, progress.done[step.id], state.done[step.id] === "skipped",
      progress.next && progress.next.id === step.id));
  });

  card.append(welcomePanel(progress), list, hide);
  slot.appendChild(card);
}

// "Getting started" link (index.html#welcome): show the panel again and scroll to it
function openWelcomeFromLink() {
  if (window.location.hash !== "#welcome") return;
  const state = loadSetup();
  if (state.hidden) saveSetup({ ...state, hidden: false });
  welcome.celebrate = true; // show it even when every step is done
  renderWelcome();
  document.getElementById("welcome")?.scrollIntoView({ block: "start" });
}

async function initWelcome() {
  // Draw at once (a quick guess: is a plan saved in this browser?), so the page doesn't wait
  welcome.planSaved = !!readStorage(PLAN_KEY, null);
  // Not finished yet at the start of this visit: finishing now shows "You're all set" instead of vanishing
  welcome.celebrate = !setupProgress(loadSetup(), welcome.planSaved, runningAsApp()).complete;
  renderWelcome();
  openWelcomeFromLink();
  // Then check properly (the saved plan must belong to the current semester)
  try {
    const programme = await getProgramme();
    const saved = loadPlan(programme).saved;
    if (saved !== welcome.planSaved) {
      welcome.planSaved = saved;
      renderWelcome();
    }
  } catch (error) {
    console.error("Welcome:", error);
  }
  document.addEventListener("setup-change", renderWelcome);
  window.addEventListener("hashchange", openWelcomeFromLink);
  // A plan saved in another tab, or a step ticked there
  window.addEventListener("storage", async (event) => {
    if (event.key === PLAN_KEY) welcome.planSaved = loadPlan(await getProgramme()).saved;
    if (event.key === PLAN_KEY || event.key === SETUP_KEY) renderWelcome();
  });
}

if (typeof document !== "undefined" && document.getElementById("welcome-slot")) initWelcome();

if (typeof module !== "undefined") module.exports = { setupProgress, SETUP_STEPS };
