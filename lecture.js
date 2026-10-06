// Interactive lecture template. Content lives in the module folder; quiz data uses questions.json.
"use strict";
const $ = (id) => document.getElementById(id);
const format = (x, digits = 2) =>
  Number(x).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const optionLetter = (index) => String.fromCharCode(65 + index);
let views = ["learn", "explore", "practice"];
let questions = [];
let state;
let context;
let quizSignature;
const emptyQuiz = () => ({
  index: 0,
  answers: Array(questions.length).fill(null),
  checked: Array(questions.length).fill(false),
  review: false,
});
function showView(view, scroll = true) {
  if (!context) return;
  if (!views.includes(view)) view = "learn";
  views.forEach((v) => ($(v).hidden = v !== view));
  document.querySelectorAll(".nav [data-view]").forEach((b) => {
    if (b.dataset.view === view) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  if (view === "explore") {
    if (context.config.activities.includes("sampling")) simulate();
    if (context.config.activities.includes("confidence-interval"))
      calculateCI();
  }
  if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
}
document
  .querySelectorAll("[data-view]")
  .forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
window.addEventListener("hashchange", () => showView(location.hash.slice(1)));
function bindConceptCards() {
  document.querySelectorAll(".concept").forEach((b) =>
    b.addEventListener("click", () => {
      const open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(open));
      b.querySelector(".tap").textContent = open
        ? "Hide example −"
        : "Reveal example +";
    }),
  );
}
const sampleSizes = [1, 2, 5, 10, 30, 100, 400];
function simulate() {
  const n = sampleSizes[Number($("sample-size").value)],
    count = 1000,
    bins = 60,
    frequencies = new Array(bins).fill(0);
  let total = 0;
  for (let k = 0; k < count; k++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += 5 + 45 * Math.random();
    const mean = sum / n;
    total += mean;
    frequencies[Math.min(bins - 1, Math.floor(((mean - 5) / 45) * bins))]++;
  }
  $("sample-size-value").textContent = n;
  $("sample-size").setAttribute(
    "aria-valuetext",
    n + " observations per sample",
  );
  $("theory-se").textContent =
    format(45 / Math.sqrt(12) / Math.sqrt(n), 3) + " kg";
  $("sim-mean").textContent = format(total / count, 2) + " kg";
  const width = Math.min(
    900,
    Math.round($("sampling-chart").getBoundingClientRect().width) ||
      Math.max(240, innerWidth - 100),
  );
  $("sampling-chart").setAttribute("viewBox", `0 0 ${width} 265`);
  const left = width < 500 ? 34 : 48,
    right = width - 20,
    top = 26,
    bottom = 215,
    w = right - left,
    h = bottom - top,
    max = Math.max(...frequencies),
    ceiling = Math.max(20, Math.ceil(max / 20) * 20),
    bw = w / bins;
  let svg = "";
  for (let i = 0; i <= 4; i++) {
    const y = bottom - (i * h) / 4;
    svg += `<path d="M${left} ${y}H${right}" stroke="#dfe5d7"/><text x="${left - 8}" y="${y + 4}" text-anchor="end" fill="#68736c" font-size="10">${Math.round((ceiling * i) / 4)}</text>`;
  }
  frequencies.forEach((f, i) => {
    const bh = (f / ceiling) * h,
      gap = width < 500 ? 0.5 : 2;
    svg += `<rect x="${left + i * bw + gap / 2}" y="${bottom - bh}" width="${bw - gap}" height="${bh}" rx="1" fill="#628473"/>`;
  });
  const mid = left + w / 2;
  svg += `<path d="M${mid} ${top - 3}V${bottom}" stroke="#cc6f4f" stroke-width="2" stroke-dasharray="4 4"/><text x="${mid + 7}" y="18" fill="#a15537" font-size="11">μ = 27.5</text>`;
  (width < 400 ? [5, 20, 35, 50] : [5, 10, 20, 30, 40, 50]).forEach((x) => {
    const px = left + ((x - 5) / 45) * w;
    svg += `<text x="${px}" y="${bottom + 23}" text-anchor="middle" fill="#68736c" font-size="11">${x}</text>`;
  });
  svg += `<text x="${left + w / 2}" y="259" text-anchor="middle" fill="#68736c" font-size="11">Sample mean (kg)</text><text x="${left}" y="14" fill="#68736c" font-size="10">Number of samples</text>`;
  $("sampling-drawing").innerHTML = svg;
  $("sampling-description").textContent =
    `Histogram of ${count} independent samples, each containing ${n} uniformly distributed observations between 5 and 50 kg. Their average mean is ${format(total / count)} kg. The population mean is 27.5 kg.`;
}
$("sample-size").addEventListener("input", simulate);
$("resample").addEventListener("click", simulate);
function combinations(values, n, start = 0, prefix = [], out = []) {
  if (prefix.length === n) {
    out.push(prefix);
    return out;
  }
  for (let i = start; i <= values.length - (n - prefix.length); i++)
    combinations(values, n, i + 1, [...prefix, values[i]], out);
  return out;
}
function tinyPopulation() {
  const n = Number($("tiny-size").value),
    samples = combinations([65, 89, 75, 64, 86], n),
    means = samples.map((s) => s.reduce((a, b) => a + b, 0) / n),
    expected = means.reduce((a, b) => a + b, 0) / means.length,
    sd = Math.sqrt(
      means.reduce((a, b) => a + (b - expected) ** 2, 0) / means.length,
    );
  $("tiny-table").innerHTML = samples
    .map(
      (s, i) => `<tr><td>${s.join(", ")}</td><td>${format(means[i])}</td></tr>`,
    )
    .join("");
  $("tiny-summary").innerHTML =
    `${samples.length} possible ${samples.length === 1 ? "sample" : "samples"}<br>E[X̄] = ${format(expected, 1)} kg<br>Exact SE = ${format(sd, 3)} kg`;
}
$("tiny-size").addEventListener("change", tinyPopulation);
function calculateCI() {
  const meanInput = $("ci-mean"),
    sigmaInput = $("ci-sigma"),
    nInput = $("ci-n"),
    m = meanInput.valueAsNumber,
    s = sigmaInput.valueAsNumber,
    n = nInput.valueAsNumber,
    level = Number($("ci-level").value);
  const valid =
    Number.isFinite(m) &&
    Number.isFinite(s) &&
    s > 0 &&
    Number.isSafeInteger(n) &&
    n >= 1 &&
    n <= 1000000000;
  const z = { 90: 1.644854, 95: 1.96, 99: 2.576 }[level],
    se = s / Math.sqrt(n),
    margin = z * se,
    lo = m - margin,
    hi = m + margin;
  const safe =
    valid && [se, margin, lo, hi].every(Number.isFinite) && se > 0 && hi > lo;
  $("ci-error").hidden = safe;
  $("ci-output").hidden = !safe;
  if (!safe) {
    $("ci-error").textContent =
      "Enter a finite mean, a positive population SD, and a whole-number sample size from 1 to 1,000,000,000. Use values large enough to produce a representable interval.";
    return;
  }
  $("ci-result-label").textContent = level + "% confidence interval";
  $("ci-bounds").textContent = format(lo) + " – " + format(hi) + " kg";
  $("ci-se").textContent = format(se) + " kg";
  $("ci-margin").textContent = format(margin) + " kg";
  $("ci-equation").textContent =
    `${level}% CI = ${format(m)} ± ${format(z, level === 95 ? 2 : 3)} × ${format(se, 3)} kg. Endpoints are rounded to two decimal places.`;
  const width = Math.min(
    900,
    Math.round($("ci-chart").getBoundingClientRect().width) ||
      Math.max(240, innerWidth - 100),
  );
  $("ci-chart").setAttribute("viewBox", `0 0 ${width} 130`);
  const left = width < 500 ? 24 : 60,
    right = width - left,
    w = right - left,
    spread = 3.4 * se,
    x = (v) => left + ((v - m + spread) / (2 * spread)) * w,
    yl = 65;
  let drawing = `<path d="M${left} ${yl}H${right}" stroke="#d6dfce" stroke-width="2"/>`;
  for (const i of width < 500 ? [-2, 0, 2] : [-3, -2, -1, 0, 1, 2, 3]) {
    const px = x(m + i * se);
    drawing += `<path d="M${px} ${yl - 4}V${yl + 4}" stroke="#a2b199"/><text x="${px}" y="${yl + 28}" fill="#68736c" text-anchor="middle" font-size="11">${format(m + i * se, 1)}</text>`;
  }
  drawing += `<path d="M${x(lo)} ${yl}H${x(hi)}" stroke="#628473" stroke-width="9" stroke-linecap="round"/><path d="M${x(lo)} ${yl - 11}V${yl + 11}M${x(hi)} ${yl - 11}V${yl + 11}" stroke="#153d35" stroke-width="2"/><circle cx="${x(m)}" cy="${yl}" r="7" fill="#cc6f4f" stroke="#fffefa" stroke-width="2"/><text x="${width / 2}" y="25" fill="#a15537" text-anchor="middle" font-size="12">Observed mean: ${format(m)} kg</text><text x="${width / 2}" y="123" fill="#68736c" text-anchor="middle" font-size="10">${width < 500 ? "Weight (kg) · Axis rescales" : "Weight (kg) · Axis rescales around your observed mean"}</text>`;
  $("ci-drawing").innerHTML = drawing;
  $("ci-description").textContent =
    `The ${level}% confidence interval runs from ${format(lo)} to ${format(hi)} kg, centered on the observed sample mean of ${format(m)} kg.`;
}
["ci-mean", "ci-sigma", "ci-n"].forEach((id) =>
  $(id).addEventListener("input", calculateCI),
);
$("ci-level").addEventListener("change", calculateCI);
function persist() {
  const progress = loadProgress();
  progress.lectures[context.topic.id] = { ...state, signature: quizSignature };
  if (state.checked.some(Boolean)) recordActivity(progress, todayKey());
  if (!saveProgress(progress))
    $("storage-note").textContent =
      "Browser storage is unavailable. Progress lasts until this page is closed or reloaded.";
}
function updateSidebar() {
  const done = state.checked.filter(Boolean).length,
    correct = questions.filter(
      (q, i) => state.checked[i] && state.answers[i] === q.a,
    ).length;
  $("quiz-progress-text").textContent =
    done + " of " + questions.length + " checked";
  $("quiz-progress-fill").style.width = (done / questions.length) * 100 + "%";
  document
    .querySelector("[role=progressbar]")
    .setAttribute("aria-valuenow", done);
  $("quiz-score").textContent = done
    ? correct + " correct · " + (done - correct) + " to revisit"
    : "Take your time. You’re here to learn.";
  $("question-map").innerHTML = questions
    .map((q, i) => {
      let cls = !state.review && i === state.index ? "current " : "";
      cls += state.checked[i]
        ? state.answers[i] === q.a
          ? "correct"
          : "incorrect"
        : state.answers[i] !== null
          ? "selected"
          : "";
      return `<button type="button" class="${cls}" data-question="${i}" ${!state.review && i === state.index ? 'aria-current="step"' : ""} aria-label="Question ${i + 1}: ${state.checked[i] ? (state.answers[i] === q.a ? "correct" : "incorrect") : "not checked"}">${i + 1}</button>`;
    })
    .join("");
  $("question-map")
    .querySelectorAll("button")
    .forEach((b) =>
      b.addEventListener("click", () => {
        state.index = Number(b.dataset.question);
        state.review = false;
        persist();
        renderQuiz(true);
      }),
    );
}
function renderQuiz(focus = false) {
  updateSidebar();
  if (state.review) {
    renderResults();
    if (focus) $("result-heading").focus();
    return;
  }
  const i = state.index,
    q = questions[i],
    done = state.checked[i],
    selected = state.answers[i],
    right = selected === q.a;
  $("quiz-card").innerHTML =
    `<div class="quiz-top"><span class="question-category">${esc(q.topic)}</span><span class="pill">${i + 1} / ${questions.length}</span></div>${q.supp ? '<div class="note small" style="margin-bottom:20px">Supplementary: assume independent sampling, known population SD, and a normal or approximately normal sampling distribution.</div>' : ""}<h2 id="question-heading" class="question-title" tabindex="-1">${esc(q.q)}</h2><div class="options" role="radiogroup" aria-labelledby="question-heading">${q.o.map((o, j) => `<label class="option ${done && j === q.a ? "correct-option" : ""} ${done && selected === j && !right ? "wrong-option" : ""}"><input type="radio" name="answer" value="${j}" ${selected === j ? "checked" : ""} ${done ? "disabled" : ""}><span class="option-letter" aria-hidden="true">${optionLetter(j)}</span><span>${esc(o)}${done && j === q.a ? " <strong>(Correct)</strong>" : ""}${done && selected === j && !right ? " <strong>(Your answer)</strong>" : ""}</span></label>`).join("")}</div>${done ? `<div id="answer-feedback" class="answer-feedback ${right ? "" : "wrong"}" tabindex="-1" role="status"><strong>${right ? "That’s right." : "A useful one to revisit."}</strong>${esc(q.e)}</div>` : ""}<div class="quiz-bottom"><button class="btn secondary small-btn" type="button" id="previous-question" ${i === 0 ? "disabled" : ""}>← Previous</button><div class="right-actions">${!done ? `<button class="btn small-btn" type="button" id="check-answer" ${selected === null ? "disabled" : ""}>Check answer</button>` : ""}<button class="btn ${done ? "" : "secondary"} small-btn" type="button" id="next-question">${i === questions.length - 1 ? "See results" : done ? "Next →" : "Skip →"}</button></div></div><p class="quiz-note">${esc(q.ref)} · Checked answers are locked until you reset practice.</p>`;
  $("quiz-card")
    .querySelectorAll("input[name=answer]")
    .forEach((r) =>
      r.addEventListener("change", () => {
        state.answers[i] = Number(r.value);
        persist();
        $("check-answer").disabled = false;
        updateSidebar();
      }),
    );
  if (!done)
    $("check-answer").addEventListener("click", () => {
      if (state.answers[i] === null) return;
      state.checked[i] = true;
      persist();
      const original = context.module.questions.find(q => q.id === questions[i].id);
      if (original && window.recordStatisticsAnswer) window.recordStatisticsAnswer(original, state.answers[i]);
      renderQuiz();
      $("answer-feedback").focus();
    });
  $("previous-question").addEventListener("click", () => {
    if (state.index > 0) state.index--;
    persist();
    renderQuiz(true);
  });
  $("next-question").addEventListener("click", () => {
    if (state.index < questions.length - 1) state.index++;
    else state.review = true;
    persist();
    renderQuiz(true);
  });
  if (focus) $("question-heading").focus();
}
function renderResults() {
  const done = state.checked.filter(Boolean).length,
    correct = questions.filter(
      (q, i) => state.checked[i] && state.answers[i] === q.a,
    ).length,
    wrong = done - correct,
    unanswered = questions.length - done;
  $("quiz-card").innerHTML =
    `<p class="eyebrow muted">Your practice recap</p><h2 id="result-heading" tabindex="-1">${done === questions.length ? "You finished the set." : "Your progress so far."}</h2><div class="result-score">${correct}<span class="muted" style="font-size:30px"> / ${questions.length}</span></div><p class="muted">${correct} correct · ${wrong} incorrect · ${unanswered} not checked</p><p class="small">${unanswered ? "You can return to any unchecked question. " : ""}Read the explanations below and use the lab to revisit anything that felt uncertain.</p><button class="btn small-btn" type="button" id="resume-quiz">${unanswered ? "Continue practice →" : "Review questions →"}</button><div style="margin-top:25px">${questions
      .map((q, i) => {
        const status = state.checked[i]
          ? state.answers[i] === q.a
            ? "✓ Correct"
            : "↺ Revisit"
          : "○ Not checked";
        return `<details class="review-item"><summary>${i + 1}. ${esc(q.topic)} — ${status}</summary><p>${esc(q.q)}</p><p>${state.answers[i] === null ? "No answer selected." : "Your selection: " + esc(optionLetter(state.answers[i]) + ". " + q.o[state.answers[i]]) + (state.checked[i] ? "" : " (not checked)")}</p><p class="review-answer"><strong>Correct answer: ${optionLetter(q.a)}. ${esc(q.o[q.a])}</strong></p><p>${esc(q.e)}</p></details>`;
      })
      .join("")}</div>`;
  $("resume-quiz").addEventListener("click", () => {
    const first = state.checked.findIndex((v) => !v);
    state.index = first >= 0 ? first : 0;
    state.review = false;
    persist();
    renderQuiz(true);
  });
}
$("finish-quiz").addEventListener("click", () => {
  state.review = true;
  persist();
  renderQuiz(true);
});
$("restart-quiz").addEventListener("click", () => {
  state = emptyQuiz();
  persist();
  renderQuiz(true);
});
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!context) return;
    if (context.config.activities.includes("sampling")) simulate();
    if (context.config.activities.includes("confidence-interval"))
      calculateCI();
  }, 120);
});

// A different topic uses the same page and quiz, with its own reviewed guide and data.
async function startLecture() {
  try {
    const id = new URLSearchParams(location.search).get("topic");
    const files = new Map();
    const read = async (path) => {
      const text = await fetchText(path);
      if (text !== null) files.set(path, text);
      return text;
    };
    const data = await loadAll(read);
    const found = id && topicById(id, data);
    if (!found || !found.topic.lecture)
      throw new Error(
        "This lecture is not available. Choose a lecture from Notes & Resources.",
      );
    const config = await loadLecture(found.module, found.topic, read);
    if (!config)
      throw new Error("The lecture configuration could not be found.");
    const guide = await read(found.module.folder + config.guide);
    if (!guide)
      throw new Error(
        "The study guide could not be loaded. If you are offline, open it once while connected first.",
      );
    context = { ...found, config };
    questions = found.module.questions
      .filter((q) => q.topic === id && q.type === "mcq")
      .map((q) => ({
        id: q.id,
        topic: q.category || found.topic.title,
        q: q.question,
        o: q.options,
        a: q.answer.charCodeAt(0) - 65,
        e: q.explanation,
        ref: q.source || "Student practice question",
        supp: !!q.supplementary,
      }));
    // Reset only this lecture when its question wording, options, or answer key changes.
    quizSignature = JSON.stringify(questions.map((q) => [q.id, q.q, q.o, q.a]));
    const saved = loadProgress().lectures[id];
    const valid =
      saved &&
      saved.signature === quizSignature &&
      Number.isInteger(saved.index) &&
      saved.index >= 0 &&
      saved.index < questions.length &&
      Array.isArray(saved.answers) &&
      saved.answers.length === questions.length &&
      saved.answers.every(
        (a, i) =>
          a === null ||
          (Number.isInteger(a) && a >= 0 && a < questions[i].o.length),
      ) &&
      Array.isArray(saved.checked) &&
      saved.checked.length === questions.length &&
      saved.checked.every(
        (v, i) => typeof v === "boolean" && (!v || saved.answers[i] !== null),
      );
    state = valid
      ? {
          index: saved.index,
          answers: saved.answers,
          checked: saved.checked,
          review: saved.review === true,
        }
      : emptyQuiz();
    document.title = found.topic.title + " · EU-HEM Student Hub";
    $("lecture-title").textContent = config.heroTitle || found.topic.title;
    $("lecture-topic-label").textContent = found.topic.title;
    $("lecture-class-label").textContent = config.classNumber
      ? "CLASS " + String(config.classNumber).padStart(2, "0")
      : "STUDY NOTES";
    $("lecture-module-label").textContent = found.module.info.name;
    $("lecture-intro").textContent = config.intro;
    $("lecture-attribution").textContent = config.attribution;
    $("lecture-course-link").textContent = found.course.info.name;
    $("lecture-course-link").href = courseUrl(found.course.id, {
      tab: "lectures",
    });
    $("lecture-virtuale").href =
      found.module.info.virtualeUrl || data.programme.programme.virtualeUrl;
    $("lecture-guide").innerHTML = guide; // Reviewed repository content, never visitor input.
    $("lecture-guide").querySelectorAll(".section-intro").forEach((section, i) => { section.id = "study-section-" + (i + 1); });
    $("lecture-save").replaceWith(saveButton(id));
    $("lecture-question-count").textContent =
      questions.length + " practice questions";
    $("lecture-activity-count").textContent =
      config.activities.length + " interactive " + (config.activities.length === 1 ? "activity" : "activities");
    LectureActivities.init($("lecture-extra-activities"), config.activities);
    renderLectureSequence(found.module, id);
    document
      .querySelector("[role=progressbar]")
      .setAttribute("aria-valuemax", questions.length);
    document
      .querySelectorAll("[data-activity]")
      .forEach(
        (el) => (el.hidden = !config.activities.includes(el.dataset.activity)),
      );
    if (!config.activities.includes("sampling"))
      document.querySelector(".hero").classList.add("no-visual");
    views = [
      "learn",
      ...(config.activities.length ? ["explore"] : []),
      ...(questions.length ? ["practice"] : []),
    ];
    document
      .querySelectorAll("[data-view]")
      .forEach((b) => (b.hidden = !views.includes(b.dataset.view)));
    bindConceptCards();
    if (found.course.id === "quant-methods" && window.QuantMethods) {
      await QuantMethods.prepare(found.module, read);
      QuantMethods.attachLecture({topic:found.topic,module:found.module,config,selectQuestion:questionId=>{
        const index=questions.findIndex(q=>q.id===questionId);
        if(index<0)return;
        state.index=index;state.review=false;persist();renderQuiz();showView("practice");$("question-heading")?.focus();
      }});
    }
    $("lecture-status").hidden = true;
    $("lecture-content").hidden = false;
    if (config.activities.includes("sampling")) simulate();
    if (config.activities.includes("tiny-population")) tinyPopulation();
    if (config.activities.includes("confidence-interval")) calculateCI();
    if (questions.length) renderQuiz();
    updateTopicStatus();
    showView(location.hash.slice(1), false);
    const sectionNumber = new URLSearchParams(location.search).get("section");
    if (/^[1-9]\d?$/.test(sectionNumber) && (!location.hash || location.hash === "#learn")) {
      Promise.resolve(document.fonts?.ready).then(() => requestAnimationFrame(() => document.getElementById("study-section-" + sectionNumber)?.scrollIntoView({ behavior: "instant", block: "start" })));
    }
    prepareOfflineCopy(files);
  } catch (error) {
    $("lecture-content").hidden = true;
    $("lecture-status").hidden = false;
    $("lecture-status").textContent =
      "Unable to open this lecture. " + error.message;
  }
}

// The first data requests can finish before the worker controls a new visitor.
// Retain those public responses too, so one connected visit really supports offline use.
async function prepareOfflineCopy(files) {
  if (!("serviceWorker" in navigator) || !("caches" in window)) return;
  try {
    await navigator.serviceWorker.ready;
    const cache = await caches.open("data"); // Shared public-content cache in sw.js.
    const savedAt = new Date().toISOString();
    await Promise.all(
      [...files].map(([path, text]) =>
        cache.put(
          path,
          new Response(text, {
            headers: {
              "content-type": path.endsWith(".json")
                ? "application/json; charset=utf-8"
                : "text/html; charset=utf-8",
              "x-saved-at": savedAt,
            },
          }),
        ),
      ),
    );
    $("lecture-offline-status").textContent =
      "Offline copy ready on this device.";
  } catch {
    $("lecture-offline-status").textContent =
      "Offline storage is unavailable. Keep a connection to reopen this lecture.";
  }
}

function updateTopicStatus() {
  const status = getTopicStatus(loadProgress(), context.topic.id);
  $("lecture-status-label").textContent =
    status === "understood"
      ? "✓ Understood"
      : status === "read"
        ? "◐ Read"
        : "○ Not started";
  $("mark-read").setAttribute("aria-pressed", String(status === "read"));
  $("mark-understood").setAttribute(
    "aria-pressed",
    String(status === "understood"),
  );
}

$("mark-read").addEventListener("click", () => {
  const status = getTopicStatus(loadProgress(), context.topic.id);
  setTopicStatus(context.topic.id, status === "read" ? "" : "read");
  updateTopicStatus();
});
$("mark-understood").addEventListener("click", () => {
  const status = getTopicStatus(loadProgress(), context.topic.id);
  setTopicStatus(context.topic.id, status === "understood" ? "" : "understood");
  updateTopicStatus();
});
startLecture();

function renderLectureSequence(module, currentId) {
  const nav = $("lecture-sequence");
  nav.textContent = "";
  const overview = document.createElement("a");
  overview.href = courseUrl(context.course.id, { tab: "lectures" });
  overview.textContent = "All lectures";
  nav.appendChild(overview);
  if (module.id === "statistics") {
    const centre = document.createElement("a");
    centre.href = "statistics.html";
    centre.textContent = "Study Centre";
    nav.appendChild(centre);
  }
  module.topics.filter(t => t.lecture).forEach(topic => {
    const link = document.createElement("a");
    link.href = lectureUrl(topic.id);
    link.textContent = topic.title.split(":")[0];
    link.title = topic.title;
    if (topic.id === currentId) link.setAttribute("aria-current", "page");
    nav.appendChild(link);
  });
  nav.hidden = false;
}
