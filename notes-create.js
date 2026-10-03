// ===== "Create an item" helper =====
// A form that produces a flashcard, question, concept or resource in the content format
// (docs/content-format.md), with a live preview and the next free ID.
// Nothing is sent or saved: the result is text to copy and paste.

const createApp = document.getElementById("create-app");

const ITEM_KINDS = [
  { key: "flashcard", label: "Flashcard", file: (m) => `content/modules/${m}/flashcards.json`, marker: "fc", list: "flashcards" },
  { key: "question", label: "Question", file: (m) => `content/modules/${m}/questions.json`, marker: "q", list: "questions" },
  { key: "concept", label: "Key concept", file: () => "content/concepts.json" },
  { key: "resource", label: "Resource", file: (m) => `content/modules/${m}/resources.json`, marker: "r", list: "resources" },
];

let createData = null;
const form = { kind: "flashcard", course: "", module: "", values: {} };

// "Moral hazard" -> "moral-hazard"
function slugify(text) {
  return simplify(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

// Next free number for a course's flashcards/questions/resources: ".fc.007"
function nextId(module, kind) {
  const prefix = `${module.id}.${kind.marker}.`;
  const numbers = module[kind.list]
    .map((item) => item.id.startsWith(prefix) ? parseInt(item.id.slice(prefix.length), 10) : NaN)
    .filter((n) => !isNaN(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return prefix + String(next).padStart(3, "0");
}

// ----- Building the item from the form -----

function buildItem() {
  const v = form.values;
  const course = createData.modules.find((m) => m.id === form.module);
  const kind = ITEM_KINDS.find((k) => k.key === form.kind);
  const clean = (text) => (text || "").trim();

  if (form.kind === "flashcard") {
    return { id: nextId(course, kind), topic: v.topic || "", front: clean(v.front), back: clean(v.back) };
  }
  if (form.kind === "question") {
    const item = { id: nextId(course, kind), topic: v.topic || "", type: v.qtype || "mcq", difficulty: v.difficulty || "medium", question: clean(v.question) };
    if (item.type === "mcq") {
      item.options = (v.options || []).map(clean).filter(Boolean);
      item.answer = v.answer || "";
    } else if (item.type === "true-false") {
      item.answer = v.tf === "true" ? true : v.tf === "false" ? false : "";
    } else {
      item.answer = clean(v.model);
    }
    item.explanation = clean(v.explanation);
    return item;
  }
  if (form.kind === "concept") {
    return { id: `concept.${slugify(v.term || "")}`, term: clean(v.term), explanation: clean(v.explanation), topics: v.topics || [] };
  }
  const item = { id: nextId(course, kind), title: clean(v.title), type: v.rtype || "Website" };
  if (clean(v.url)) item.url = clean(v.url);
  if (clean(v.contributor)) item.contributor = clean(v.contributor);
  item.date = v.date || todayKey();
  if (v.topic) item.topic = v.topic;
  if (clean(v.description)) item.description = clean(v.description);
  return item;
}

// The same rules as scripts/check-content.js, in plain English
function problemsWith(item) {
  const problems = [];
  const need = (field, label) => { if (!item[field] || (typeof item[field] === "string" && !item[field].trim())) problems.push(`${label} is empty.`); };
  if (form.kind === "flashcard") {
    need("topic", "Topic");
    need("front", "The question side");
    need("back", "The answer side");
  }
  if (form.kind === "question") {
    need("topic", "Topic");
    need("question", "The question");
    if (item.type === "mcq") {
      if (item.options.length < 2) problems.push("A multiple-choice question needs at least 2 options.");
      const letters = item.options.map((_, i) => String.fromCharCode(65 + i));
      if (!letters.includes(item.answer)) problems.push("Choose which option is correct.");
    }
    if (item.type === "true-false" && typeof item.answer !== "boolean") problems.push("Choose whether the statement is true or false.");
    if (item.type === "short-answer") need("answer", "The model answer");
    need("explanation", "The explanation");
  }
  if (form.kind === "concept") {
    need("term", "The term");
    need("explanation", "The explanation");
    if (item.term && createData.concepts.some((c) => c.id === item.id)) {
      problems.push(`A concept with the ID "${item.id}" already exists. Check the Key concepts list, or use a more specific term.`);
    }
    if (!item.topics.length) problems.push("Tick at least one topic where this concept appears.");
  }
  if (form.kind === "resource") {
    need("title", "The title");
    if (item.url && !/^https?:\/\//.test(item.url)) problems.push("The link must start with https://");
  }
  return problems;
}

// ----- Page -----

function field(labelText, control, hint) {
  const label = createElement("label", "create-field", labelText);
  label.appendChild(control);
  if (hint) label.appendChild(createElement("span", "create-hint", hint));
  return label;
}

function input(name, placeholder, type = "text") {
  const el = createElement("input");
  el.type = type;
  el.placeholder = placeholder || "";
  el.value = form.values[name] || "";
  el.addEventListener("input", () => { form.values[name] = el.value; update(); });
  return el;
}

function textarea(name, placeholder, rows = 3) {
  const el = createElement("textarea");
  el.rows = rows;
  el.placeholder = placeholder || "";
  el.value = form.values[name] || "";
  el.addEventListener("input", () => { form.values[name] = el.value; update(); });
  return el;
}

function select(name, options, onChange) {
  const el = createElement("select");
  for (const [value, label] of options) el.appendChild(new Option(label, value));
  el.value = form.values[name] !== undefined ? form.values[name] : options[0][0];
  form.values[name] = el.value;
  el.addEventListener("change", () => { form.values[name] = el.value; if (onChange) onChange(); else update(); });
  return el;
}

const formBox = createElement("section", "card create-form");
const previewBox = createElement("div", "create-preview");
const resultBox = createElement("div", "create-result");

function topicOptions(optional) {
  const course = createData.modules.find((m) => m.id === form.module);
  const options = course.topics.map((t) => [t.id, t.title]);
  return optional ? [["", "(no specific topic)"], ...options] : options;
}

function drawForm() {
  formBox.innerHTML = "";
  formBox.appendChild(createElement("h3", null, "1. What do you want to create?"));
  const kinds = createElement("div", "filter-chips");
  for (const kind of ITEM_KINDS) {
    const chip = createElement("button", "filter-chip", kind.label);
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(form.kind === kind.key));
    chip.addEventListener("click", () => { form.kind = kind.key; form.values = {}; drawForm(); });
    kinds.appendChild(chip);
  }
  formBox.appendChild(kinds);

  formBox.appendChild(createElement("h3", null, "2. Course and topic"));
  const courses = createData.courses.filter((c) => c.topics.length).map((c) => [c.id, c.info.name]);
  if (!courses.some(([id]) => id === form.course)) form.course = courses[0][0];
  const courseSelect = createElement("select");
  for (const [id, title] of courses) courseSelect.appendChild(new Option(title, id));
  courseSelect.value = form.course;
  courseSelect.addEventListener("change", () => { form.course = courseSelect.value; form.module = ""; form.values.topic = ""; form.values.topics = []; drawForm(); });
  formBox.appendChild(field("Course", courseSelect));
  // Integrated courses have several modules: items belong to a module
  const modules = createData.courses.find((c) => c.id === form.course).modules.filter((m) => m.topics.length);
  if (!modules.some((m) => m.id === form.module)) form.module = modules[0].id;
  if (modules.length > 1) {
    const moduleSelect = createElement("select");
    for (const m of modules) moduleSelect.appendChild(new Option(`${m.info.name} (${m.info.code})`, m.id));
    moduleSelect.value = form.module;
    moduleSelect.addEventListener("change", () => { form.module = moduleSelect.value; form.values.topic = ""; form.values.topics = []; drawForm(); });
    formBox.appendChild(field("Module", moduleSelect));
  }

  if (form.kind === "concept") {
    const box = createElement("fieldset", "create-topics");
    box.appendChild(createElement("legend", null, "Topics where this concept appears"));
    form.values.topics = form.values.topics || [];
    for (const [id, title] of topicOptions(false)) {
      const label = createElement("label", "checkbox-label");
      const tick = createElement("input");
      tick.type = "checkbox";
      tick.checked = form.values.topics.includes(id);
      tick.addEventListener("change", () => {
        form.values.topics = tick.checked ? [...form.values.topics, id] : form.values.topics.filter((t) => t !== id);
        update();
      });
      label.appendChild(tick);
      label.appendChild(document.createTextNode(title));
      box.appendChild(label);
    }
    formBox.appendChild(box);
  } else {
    formBox.appendChild(field("Topic", select("topic", topicOptions(form.kind === "resource"))));
  }

  formBox.appendChild(createElement("h3", null, "3. Content"));
  const mathHint = "Formulas: $...$ inside a sentence, e.g. $\\frac{a}{b}$";
  if (form.kind === "flashcard") {
    formBox.appendChild(field("Question side", textarea("front", "e.g. What is moral hazard?"), mathHint));
    formBox.appendChild(field("Answer side", textarea("back", "A short, clear answer")));
  }
  if (form.kind === "question") {
    const row = createElement("div", "create-row");
    row.appendChild(field("Type", select("qtype", [["mcq", "Multiple choice"], ["true-false", "True / False"], ["short-answer", "Short answer"]], drawForm)));
    row.appendChild(field("Difficulty", select("difficulty", [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]])));
    formBox.appendChild(row);
    formBox.appendChild(field("Question", textarea("question", "Write your own practice question (never a real exam question)"), mathHint));
    const qtype = form.values.qtype || "mcq";
    if (qtype === "mcq") {
      form.values.options = form.values.options || ["", "", "", ""];
      const box = createElement("fieldset", "create-options");
      box.appendChild(createElement("legend", null, "Options (tick the correct one)"));
      form.values.options.forEach((value, i) => {
        const letter = String.fromCharCode(65 + i);
        const row = createElement("div", "create-option");
        const radio = createElement("input");
        radio.type = "radio";
        radio.name = "correct";
        radio.checked = form.values.answer === letter;
        radio.setAttribute("aria-label", `Option ${letter} is correct`);
        radio.addEventListener("change", () => { form.values.answer = letter; update(); });
        const text = createElement("input");
        text.type = "text";
        text.placeholder = `Option ${letter}`;
        text.value = value;
        text.addEventListener("input", () => { form.values.options[i] = text.value; update(); });
        row.appendChild(createElement("span", "create-letter", letter));
        row.appendChild(radio);
        row.appendChild(text);
        box.appendChild(row);
      });
      if (form.values.options.length < 6) {
        const add = createElement("button", "inline-link", "+ Add an option");
        add.type = "button";
        add.addEventListener("click", () => { form.values.options.push(""); drawForm(); });
        box.appendChild(add);
      }
      formBox.appendChild(box);
    } else if (qtype === "true-false") {
      formBox.appendChild(field("The statement is…", select("tf", [["", "Choose…"], ["true", "True"], ["false", "False"]])));
    } else {
      formBox.appendChild(field("Model answer", textarea("model", "What a good answer contains")));
    }
    formBox.appendChild(field("Explanation", textarea("explanation", "Why this is the answer (shown by 'Explain answer')")));
  }
  if (form.kind === "concept") {
    formBox.appendChild(field("Term", input("term", "e.g. Adverse selection")));
    formBox.appendChild(field("Explanation", textarea("explanation", "One or two sentences, in your own words"), mathHint));
  }
  if (form.kind === "resource") {
    formBox.appendChild(field("Title", input("title", "e.g. WHO: Health financing")));
    formBox.appendChild(field("Type", select("rtype", RESOURCE_TYPES.map((t) => [t, t]))));
    formBox.appendChild(field("Link (optional)", input("url", "https://…", "url"), "Link to official material instead of uploading it."));
    formBox.appendChild(field("Description (optional)", textarea("description", "What is it and why is it useful?", 2)));
    formBox.appendChild(field("Your name (optional)", input("contributor", "Leave empty to stay anonymous")));
  }
  update();
}

function update() {
  const item = buildItem();
  const problems = problemsWith(item);
  const kind = ITEM_KINDS.find((k) => k.key === form.kind);

  // Preview, using the same pieces as the real pages
  previewBox.innerHTML = "";
  previewBox.appendChild(createElement("h3", null, "Preview"));
  const ctx = {
    course: createData.modules.find((m) => m.id === form.module),
    topicLink: (id) => createElement("span", null, (topicById(id, createData) || { topic: { title: id || "—" } }).topic.title),
  };
  if (form.kind === "flashcard") {
    const face = createElement("div", "flashcard");
    face.appendChild(createElement("div", "flashcard-label", "Question"));
    face.appendChild(renderRichText("p", item.front || "…", "flashcard-front"));
    face.appendChild(createElement("div", "flashcard-label", "Answer"));
    face.appendChild(renderRichText("p", item.back || "…", "flashcard-back"));
    previewBox.appendChild(face);
  } else if (form.kind === "question") {
    const preview = { ...item, options: item.options && item.options.length ? item.options : ["…", "…"] };
    if (preview.type === "mcq" && !/^[A-Z]$/.test(preview.answer)) preview.answer = "A";
    if (preview.type === "true-false" && typeof preview.answer !== "boolean") preview.answer = true;
    const card = questionCard(preview, ctx);
    card.querySelector(".save-button").remove();
    previewBox.appendChild(card);
  } else if (form.kind === "concept") {
    const card = createElement("div", "concept-card");
    card.appendChild(createElement("h4", null, item.term || "…"));
    card.appendChild(renderRichText("p", item.explanation || "…"));
    previewBox.appendChild(card);
  } else {
    const card = createElement("div", "resource-card");
    card.appendChild(createElement("span", "resource-type", item.type));
    card.appendChild(createElement("span", "resource-title", item.title || "…"));
    if (item.description) card.appendChild(createElement("p", null, item.description));
    previewBox.appendChild(card);
  }
  typesetMath(previewBox);

  // Result: problems, or JSON ready to paste
  resultBox.innerHTML = "";
  resultBox.appendChild(createElement("h3", null, "Result"));
  if (problems.length) {
    const list = createElement("ul", "create-problems");
    for (const problem of problems) list.appendChild(createElement("li", null, problem));
    resultBox.appendChild(createElement("p", null, "Almost there. Still missing:"));
    resultBox.appendChild(list);
    return;
  }
  const json = JSON.stringify(item, null, 2).split("\n").map((line) => "  " + line).join("\n");
  resultBox.appendChild(createElement("p", "answer-feedback is-right", "✔ Ready! Your item follows the content format."));
  const steps = createElement("ol", "create-steps");
  steps.appendChild(createElement("li", null, `Open ${kind.file(form.module)}.`));
  steps.appendChild(createElement("li", null, "Put a comma after the last } in the file (before the final ])."));
  steps.appendChild(createElement("li", null, "Paste the text below before the final ], save, and run: node scripts/check-content.js"));
  resultBox.appendChild(steps);
  const code = createElement("pre", "create-json");
  code.textContent = json;
  resultBox.appendChild(code);
  const copy = createElement("button", "button", "Copy");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(json);
      copy.textContent = "Copied!";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      copy.textContent = "Press Ctrl+C to copy";
    }
    setTimeout(() => (copy.textContent = "Copy"), 2000);
  });
  resultBox.appendChild(copy);
}

async function initCreate() {
  try {
    createData = await loadAll();
    const params = new URLSearchParams(window.location.search);
    if (ITEM_KINDS.some((k) => k.key === params.get("type"))) form.kind = params.get("type");
    // Accepts a course ID, or a module ID from older links
    const wanted = params.get("course") || "";
    const fromModule = createData.modules.find((m) => m.id === wanted);
    const courseId = fromModule ? fromModule.courseId : wanted;
    if (createData.courses.some((c) => c.id === courseId && c.topics.length)) form.course = courseId;
    if (fromModule && fromModule.topics.length) form.module = fromModule.id;
    createApp.innerHTML = "";
    const layout = createElement("div", "create-layout");
    layout.appendChild(formBox);
    const side = createElement("section", "card create-side");
    side.appendChild(previewBox);
    side.appendChild(resultBox);
    layout.appendChild(side);
    createApp.appendChild(layout);
    drawForm();
  } catch (error) {
    console.error("Could not load content:", error);
    createApp.innerHTML = "";
    createApp.appendChild(createElement("p", "placeholder", "Sorry, the courses could not be loaded right now. Please try again later."));
  }
}

initCreate();
