// ===== Welcome & setup guide (home page) =====
// A checklist of 5 quick steps that make the site yours. Steps tick themselves:
//   plan      when a study plan is saved (studyplan.html)
//   calendar  when a subscribe button is clicked (calendar.html)
//   install   when the app is installed (pwa.js), or skipped
//   search    when search is opened (search.js)
//   theme     when the light/dark button is used (theme.js)
// "Hide" closes the panel; "Getting started" in the footer (index.html#welcome) brings it back.
// Progress is saved in this browser only (loadSetup / markSetupDone in ui.js).

const SETUP_STEPS = [
  {
    id: "plan", title: "Choose your study plan",
    text: "The timetable, exams and calendar then show only your courses.",
    action: { label: "Open Study Plan", href: "studyplan.html" },
  },
  {
    id: "calendar", title: "Subscribe to your calendar",
    text: "Classes and exams appear in Google, Apple or Outlook Calendar and update by themselves.",
    action: { label: "Get the calendar", href: "calendar.html" },
  },
  {
    id: "install", title: "Install the app on your phone",
    text: "Opens from your home screen like an app, and works offline.",
    action: { label: "Install", event: "install-app" },
    skippable: true,
  },
  {
    id: "search", title: "Try search",
    text: "Press Ctrl K (⌘K on Mac) or tap 🔍 to find any course, note or page.",
    action: { label: "Try it", event: "open-search" },
  },
  {
    id: "theme", title: "Pick light or dark mode",
    text: "Use the 🌙 / ☀️ button at the top of every page.",
    action: { label: "Switch mode", click: ".theme-toggle" },
  },
];

const welcome = { planSaved: false, celebrate: false };

// Which steps are done. "Installed" also counts when the site is already open as an app.
function setupProgress(state, planSaved, installed) {
  const done = {};
  for (const step of SETUP_STEPS) done[step.id] = !!state.done[step.id];
  if (planSaved) done.plan = true;
  if (installed) done.install = true;
  const count = Object.values(done).filter(Boolean).length;
  return { done, count, total: SETUP_STEPS.length, complete: count === SETUP_STEPS.length };
}

function runningAsApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function stepItem(step, isDone, skipped) {
  const item = createElement("li", `setup-step${isDone ? " is-done" : ""}`);
  const mark = createElement("span", "setup-check");
  mark.setAttribute("aria-hidden", "true");
  if (isDone && typeof siteIcon === "function") mark.appendChild(siteIcon("check"));
  item.appendChild(mark);

  const text = createElement("div", "setup-text");
  const title = createElement("strong", null, step.title);
  text.appendChild(title);
  text.appendChild(createElement("span", "setup-sub", isDone ? (skipped ? "Skipped" : "Done ✓") : step.text));
  item.appendChild(text);
  // Screen readers hear the state too, not only see the tick
  title.appendChild(createElement("span", "visually-hidden", isDone ? " (done)" : " (to do)"));

  if (!isDone) {
    const actions = createElement("div", "setup-actions");
    const { action } = step;
    let button;
    if (action.href) {
      button = createElement("a", "button button-light", action.label);
      button.href = action.href;
    } else {
      button = createElement("button", "button button-light", action.label);
      button.type = "button";
      button.addEventListener("click", () => {
        if (action.event) document.dispatchEvent(new CustomEvent(action.event));
        if (action.click) document.querySelector(action.click)?.click();
      });
    }
    actions.appendChild(button);
    if (step.skippable) {
      const skip = createElement("button", "button button-quiet", "Skip");
      skip.type = "button";
      skip.addEventListener("click", () => markSetupDone(step.id, "skipped"));
      actions.appendChild(skip);
    }
    item.appendChild(actions);
  }
  return item;
}

function renderWelcome() {
  const slot = document.getElementById("welcome-slot");
  const state = loadSetup();
  const progress = setupProgress(state, welcome.planSaved, runningAsApp());
  slot.innerHTML = "";
  if (state.hidden) return;
  if (progress.complete && !welcome.celebrate) return; // finished on an earlier visit

  const card = createElement("section", "card welcome-card");
  card.id = "welcome";
  card.setAttribute("aria-labelledby", "welcome-title");

  const head = createElement("div", "welcome-head");
  const intro = createElement("div");
  intro.appendChild(createElement("h2", null, progress.complete ? "You're all set 🎉" : "Welcome to the EU-HEM Student Hub"));
  intro.lastChild.id = "welcome-title";
  intro.appendChild(createElement("p", "welcome-sub", progress.complete
    ? "Everything is set up. You can hide this panel; “Getting started” at the bottom of every page brings it back."
    : "Five quick steps to make the site yours. Everything is saved on this device only."));
  head.appendChild(intro);
  const hide = createElement("button", "button button-quiet welcome-hide", "Hide");
  hide.type = "button";
  hide.setAttribute("aria-label", "Hide the welcome checklist");
  hide.addEventListener("click", () => {
    saveSetup({ ...loadSetup(), hidden: true });
    if (typeof toast === "function") toast("Hidden. “Getting started” at the bottom of the page brings it back.");
  });
  head.appendChild(hide);
  card.appendChild(head);

  const percent = Math.round((progress.count / progress.total) * 100);
  const bar = createElement("div", "welcome-progress");
  bar.appendChild(progressBar(percent, `${progress.count} of ${progress.total} steps done`));
  bar.appendChild(createElement("span", "welcome-count", `${progress.count} of ${progress.total} done`));
  card.appendChild(bar);

  const list = createElement("ol", "setup-list");
  for (const step of SETUP_STEPS) {
    list.appendChild(stepItem(step, progress.done[step.id], state.done[step.id] === "skipped"));
  }
  card.appendChild(list);
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
