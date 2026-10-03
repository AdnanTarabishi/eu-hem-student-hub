// ===== Practice tab: flashcards and question bank =====
// Used by notes-course.js. renderPractice() builds both parts inside the Practice tab.

const QUESTION_TYPE_LABELS = { "mcq": "Multiple choice", "true-false": "True / False", "short-answer": "Short answer" };

// ctx = { course, params, topicTitle, topicLink }
function renderPractice(panel, ctx) {
  if (ctx.course.flashcards.length) panel.appendChild(flashcardSection(ctx));
  if (ctx.course.questions.length) panel.appendChild(questionSection(ctx));
}

// A dropdown with "All topics" + the topics that have items of this kind
function topicSelect(items, ctx, selected) {
  const select = createElement("select");
  select.appendChild(new Option("All topics", ""));
  const topicIds = ctx.course.topics.map((t) => t.id).filter((id) => items.some((item) => item.topic === id));
  for (const id of topicIds) select.appendChild(new Option(ctx.topicTitle(id), id));
  select.value = topicIds.includes(selected) ? selected : "";
  return select;
}

function labelled(text, control) {
  const label = createElement("label", null, text);
  label.appendChild(control);
  return label;
}

// ----- Flashcards: Study Mode -----
// Shows one card at a time: question first, then "Reveal answer".

function flashcardSection(ctx) {
  const section = createElement("div", "practice-section");
  section.id = "flashcards";
  section.appendChild(createElement("h3", null, "Flashcards"));

  const filters = createElement("div", "schedule-filters");
  const select = topicSelect(ctx.course.flashcards, ctx, ctx.params.practiceTopic);
  filters.appendChild(labelled("Topic", select));
  section.appendChild(filters);

  const study = createElement("div", "flashcard-study");
  section.appendChild(study);

  let deck = [];
  let position = 0;
  let revealed = false;

  const buildDeck = () => {
    deck = ctx.course.flashcards.filter((card) => !select.value || card.topic === select.value);
    position = 0;
    revealed = false;
  };

  const draw = () => {
    study.innerHTML = "";
    if (deck.length === 0) {
      study.appendChild(createElement("p", "placeholder", "No flashcards for this topic yet."));
      return;
    }
    const card = deck[position];

    const top = createElement("div", "flashcard-top");
    top.appendChild(createElement("span", "flashcard-counter", `Card ${position + 1} of ${deck.length}`));
    const right = createElement("span");
    if (card.sample) right.appendChild(sampleTag());
    right.appendChild(saveButton(card.id));
    top.appendChild(right);
    study.appendChild(top);

    const face = createElement("div", "flashcard");
    face.id = card.id;
    face.appendChild(createElement("div", "flashcard-label", "Question"));
    face.appendChild(createElement("p", "flashcard-front", card.front));
    if (revealed) {
      face.appendChild(createElement("div", "flashcard-label", "Answer"));
      face.appendChild(createElement("p", "flashcard-back", card.back));
    }
    study.appendChild(face);

    const topicLine = createElement("p", "schedule-meta", "Topic: ");
    topicLine.appendChild(ctx.topicLink(card.topic));
    study.appendChild(topicLine);

    const controls = createElement("div", "button-row flashcard-controls");
    const button = (text, onClick, className = "button button-light") => {
      const b = createElement("button", className, text);
      b.type = "button";
      b.addEventListener("click", onClick);
      controls.appendChild(b);
      return b;
    };
    button("◀ Previous", () => { position = (position - 1 + deck.length) % deck.length; revealed = false; draw(); });
    button(revealed ? "Hide answer" : "Reveal answer", () => { revealed = !revealed; draw(); }, "button");
    button("Next ▶", () => { position = (position + 1) % deck.length; revealed = false; draw(); });
    button("🔀 Shuffle", () => { shuffle(deck); position = 0; revealed = false; draw(); });
    study.appendChild(controls);
  };

  select.addEventListener("change", () => { buildDeck(); draw(); });
  buildDeck();

  // Opened from a link to one card (e.g. from search or My Study List): start at that card
  const startAt = deck.findIndex((card) => card.id === ctx.params.card);
  if (startAt === -1 && ctx.params.card) {
    select.value = "";
    buildDeck();
  }
  position = Math.max(0, deck.findIndex((card) => card.id === ctx.params.card));
  draw();
  return section;
}

// Fisher–Yates shuffle: mixes the cards into a random order
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// ----- Question bank -----

// The correct answer as text, e.g. "B. Fall by about 2%" or "True"
function correctAnswerText(question) {
  if (question.type === "mcq") {
    const index = question.answer.charCodeAt(0) - 65; // "A" -> 0
    return `${question.answer}. ${question.options[index]}`;
  }
  if (question.type === "true-false") return question.answer ? "True" : "False";
  return question.answer;
}

function questionSection(ctx) {
  const section = createElement("div", "practice-section");
  section.id = "question-bank";
  section.appendChild(createElement("h3", null, "Question bank"));
  section.appendChild(createElement("p", "schedule-meta",
    "Questions written by students for practice. They are not real exam questions."));

  const filters = createElement("div", "schedule-filters");
  const topic = topicSelect(ctx.course.questions, ctx, ctx.params.practiceTopic);
  const difficulty = createElement("select");
  difficulty.appendChild(new Option("Any difficulty", ""));
  for (const level of ["easy", "medium", "hard"]) difficulty.appendChild(new Option(level[0].toUpperCase() + level.slice(1), level));
  const type = createElement("select");
  type.appendChild(new Option("Any type", ""));
  for (const [value, label] of Object.entries(QUESTION_TYPE_LABELS)) type.appendChild(new Option(label, value));
  filters.appendChild(labelled("Topic", topic));
  filters.appendChild(labelled("Difficulty", difficulty));
  filters.appendChild(labelled("Type", type));
  section.appendChild(filters);

  const status = createElement("p", "student-totals");
  const list = createElement("div", "question-list");
  section.appendChild(status);
  section.appendChild(list);

  const draw = () => {
    const visible = ctx.course.questions.filter((q) =>
      (!topic.value || q.topic === topic.value) &&
      (!difficulty.value || q.difficulty === difficulty.value) &&
      (!type.value || q.type === type.value));
    status.textContent = `Showing ${visible.length} of ${ctx.course.questions.length} questions`;
    list.innerHTML = "";
    for (const question of visible) list.appendChild(questionCard(question, ctx));
    if (visible.length === 0) list.appendChild(createElement("p", "placeholder", "No questions match these filters."));
  };
  for (const select of [topic, difficulty, type]) select.addEventListener("change", draw);
  draw();
  return section;
}

function questionCard(question, ctx) {
  const card = createElement("div", "question-card");
  card.id = question.id;

  const meta = createElement("div", "announcement-meta");
  meta.appendChild(createElement("span", "question-type", QUESTION_TYPE_LABELS[question.type] || question.type));
  meta.appendChild(createElement("span", `difficulty difficulty-${question.difficulty}`, question.difficulty));
  if (question.sample) meta.appendChild(sampleTag());
  const spacer = createElement("span", "meta-spacer");
  meta.appendChild(spacer);
  meta.appendChild(saveButton(question.id));
  card.appendChild(meta);

  card.appendChild(createElement("p", "question-text", question.question));

  const feedback = createElement("p", "answer-feedback");
  feedback.setAttribute("aria-live", "polite");

  // Choices: MCQ options or True/False. Clicking one shows right or wrong.
  const choices = question.type === "mcq"
    ? question.options.map((text, i) => ({ value: String.fromCharCode(65 + i), label: `${String.fromCharCode(65 + i)}. ${text}` }))
    : question.type === "true-false"
      ? [{ value: true, label: "True" }, { value: false, label: "False" }]
      : [];

  if (choices.length) {
    const box = createElement("div", question.type === "mcq" ? "choice-list" : "choice-list choice-row");
    const buttons = choices.map((choice) => {
      const b = createElement("button", "choice", choice.label);
      b.type = "button";
      b.addEventListener("click", () => {
        for (const [i, other] of buttons.entries()) {
          other.disabled = true;
          if (choices[i].value === question.answer) other.classList.add("is-correct");
        }
        const right = choice.value === question.answer;
        if (!right) b.classList.add("is-wrong");
        feedback.textContent = right ? "✔ Correct!" : `✖ Not quite. The answer is ${correctAnswerText(question)}.`;
        feedback.className = right ? "answer-feedback is-right" : "answer-feedback is-wrong";
      });
      box.appendChild(b);
      return b;
    });
    card.appendChild(box);
  } else {
    const area = createElement("textarea", "short-answer");
    area.rows = 3;
    area.placeholder = "Write your answer here to practise (it isn't saved).";
    area.setAttribute("aria-label", "Your answer");
    card.appendChild(area);
  }
  card.appendChild(feedback);

  const explanation = createElement("div", "explanation");
  explanation.hidden = true;
  const answerLine = createElement("p");
  answerLine.appendChild(createElement("strong", null, question.type === "short-answer" ? "Model answer: " : "Answer: "));
  answerLine.appendChild(document.createTextNode(correctAnswerText(question)));
  explanation.appendChild(answerLine);
  explanation.appendChild(createElement("p", null, question.explanation));

  const explain = createElement("button", "button button-light", "Explain answer");
  explain.type = "button";
  explain.setAttribute("aria-expanded", "false");
  explain.addEventListener("click", () => {
    explanation.hidden = !explanation.hidden;
    explain.textContent = explanation.hidden ? "Explain answer" : "Hide explanation";
    explain.setAttribute("aria-expanded", String(!explanation.hidden));
  });

  const footer = createElement("div", "question-footer");
  footer.appendChild(explain);
  const topicLine = createElement("span", "schedule-meta", "Topic: ");
  topicLine.appendChild(ctx.topicLink(question.topic));
  footer.appendChild(topicLine);
  card.appendChild(footer);
  card.appendChild(explanation);
  return card;
}
