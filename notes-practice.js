// ===== Practice tab: flashcards, quiz and question bank =====
// Used by notes-course.js. renderPractice() builds the three parts inside the Practice tab.

const QUESTION_TYPE_LABELS = { "mcq": "Multiple choice", "true-false": "True / False", "short-answer": "Short answer" };
const GRADE_LABELS = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };

// ctx = { course, params, topicTitle, topicLink, navigate }
function renderPractice(panel, ctx) {
  if (ctx.course.flashcards.length) panel.appendChild(flashcardSection(ctx));
  if (ctx.course.questions.length) {
    panel.appendChild(quizSection(ctx));
    panel.appendChild(questionSection(ctx));
  }
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

function smallButton(text, onClick, className = "button button-light") {
  const button = createElement("button", className, text);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

// "1 day", "3 days", "today"
function intervalText(days) {
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

// ----- Flashcards -----
// Review mode: only cards that are due (new or scheduled for today), graded Again/Hard/Good/Easy.
// Browse mode: every card, with Previous / Next / Shuffle.

function flashcardSection(ctx) {
  const section = createElement("div", "practice-section");
  section.id = "flashcards";
  section.appendChild(createElement("h3", null, "Flashcards"));

  const controls = createElement("div", "schedule-filters");
  const select = topicSelect(ctx.course.flashcards, ctx, ctx.params.practiceTopic);
  controls.appendChild(labelled("Topic", select));
  const modes = createElement("div", "filter-chips flashcard-modes");
  controls.appendChild(modes);
  section.appendChild(controls);

  const study = createElement("div", "flashcard-study");
  section.appendChild(study);

  // Opened from a link to one card (search, My Study List): browse, starting at that card
  let mode = ctx.params.card ? "browse" : "review";
  let deck = [];
  let position = 0;
  let revealed = false;
  let reviewedThisSession = 0;

  const cardsInTopic = () => ctx.course.flashcards.filter((card) => !select.value || card.topic === select.value);

  const drawModes = () => {
    modes.innerHTML = "";
    const due = dueCards(loadProgress(), cardsInTopic(), todayKey()).length;
    for (const [key, label] of [["review", `Review due (${due})`], ["browse", `Browse all (${cardsInTopic().length})`]]) {
      const chip = smallButton(label, () => { mode = key; start(); }, "filter-chip");
      chip.setAttribute("aria-pressed", String(mode === key));
      modes.appendChild(chip);
    }
  };

  const start = () => {
    revealed = false;
    position = 0;
    reviewedThisSession = 0;
    deck = mode === "review" ? dueCards(loadProgress(), cardsInTopic(), todayKey()) : cardsInTopic();
    if (mode === "browse" && ctx.params.card) {
      const at = deck.findIndex((card) => card.id === ctx.params.card);
      if (at === -1) {
        select.value = "";
        deck = cardsInTopic();
      }
      position = Math.max(0, deck.findIndex((card) => card.id === ctx.params.card));
      ctx.params.card = ""; // only the first time
    }
    draw();
  };

  const finished = () => {
    const done = createElement("div", "flashcard-done");
    done.appendChild(createElement("p", "flashcard-done-title",
      reviewedThisSession ? "🎉 All due cards reviewed!" : "✓ No cards due right now."));
    const next = nextDueDate(loadProgress(), cardsInTopic());
    if (next) done.appendChild(createElement("p", "schedule-meta",
      `Next review: ${formatDay(next, { weekday: "short", day: "numeric", month: "short" })}`));
    done.appendChild(smallButton("Browse all cards", () => { mode = "browse"; start(); }));
    return done;
  };

  const draw = () => {
    drawModes();
    study.innerHTML = "";
    if (deck.length === 0) {
      study.appendChild(mode === "review" ? finished() : createElement("p", "placeholder", "No flashcards for this topic yet."));
      return;
    }
    const card = deck[position];

    const top = createElement("div", "flashcard-top");
    top.appendChild(createElement("span", "flashcard-counter",
      mode === "review" ? `${deck.length} card${deck.length === 1 ? "" : "s"} left` : `Card ${position + 1} of ${deck.length}`));
    const right = createElement("span");
    if (card.sample) right.appendChild(sampleTag());
    right.appendChild(saveButton(card.id));
    top.appendChild(right);
    study.appendChild(top);

    const face = createElement("div", "flashcard");
    face.id = card.id;
    face.appendChild(createElement("div", "flashcard-label", "Question"));
    face.appendChild(renderRichText("p", card.front, "flashcard-front"));
    if (revealed) {
      face.appendChild(createElement("div", "flashcard-label", "Answer"));
      face.appendChild(renderRichText("p", card.back, "flashcard-back"));
    }
    study.appendChild(face);
    typesetMath(face);

    const topicLine = createElement("p", "schedule-meta", "Topic: ");
    topicLine.appendChild(ctx.topicLink(card.topic));
    study.appendChild(topicLine);

    const buttons = createElement("div", "button-row flashcard-controls");
    if (mode === "review") {
      if (!revealed) {
        buttons.appendChild(smallButton("Reveal answer", () => { revealed = true; draw(); }, "button"));
      } else {
        // Each button shows when the card would come back
        const state = loadProgress().cards[card.id];
        for (const grade of CARD_GRADES) {
          const preview = scheduleCard(state, grade, todayKey()).interval;
          const button = smallButton("", () => {
            gradeCard(card.id, grade);
            reviewedThisSession++;
            deck.splice(position, 1);
            if (grade === "again") deck.push(card); // see it again later in this session
            position = 0;
            revealed = false;
            draw();
          }, `button grade-button grade-${grade}`);
          button.appendChild(createElement("span", "grade-label", GRADE_LABELS[grade]));
          button.appendChild(createElement("span", "grade-when", grade === "again" ? "now" : intervalText(preview)));
          buttons.appendChild(button);
        }
      }
    } else {
      buttons.appendChild(smallButton("◀ Previous", () => { position = (position - 1 + deck.length) % deck.length; revealed = false; draw(); }));
      buttons.appendChild(smallButton(revealed ? "Hide answer" : "Reveal answer", () => { revealed = !revealed; draw(); }, "button"));
      buttons.appendChild(smallButton("Next ▶", () => { position = (position + 1) % deck.length; revealed = false; draw(); }));
      buttons.appendChild(smallButton("Shuffle", () => { shuffle(deck); position = 0; revealed = false; draw(); }));
    }
    study.appendChild(buttons);
  };

  select.addEventListener("change", start);
  start();
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

// ----- Quiz (the quiz itself is in notes-quiz.js) -----

function quizSection(ctx) {
  const section = createElement("div", "practice-section");
  section.id = "quiz";
  section.appendChild(createElement("h3", null, "Quiz"));
  const best = loadProgress().quizzes[ctx.course.id];
  section.appendChild(createElement("p", "schedule-meta",
    "A short test from the question bank, one question at a time, with a score at the end." +
    (best ? ` Your best score: ${best.best}%.` : "")));

  const box = createElement("div", "quiz-box");
  section.appendChild(box);

  const showSetup = () => {
    box.innerHTML = "";
    const form = createElement("div", "schedule-filters quiz-setup");
    const topic = topicSelect(ctx.course.questions, ctx, ctx.params.practiceTopic);
    const count = createElement("select");
    for (const n of [5, 10]) if (n < ctx.course.questions.length) count.appendChild(new Option(`${n} questions`, String(n)));
    count.appendChild(new Option(`All (${ctx.course.questions.length})`, "all"));
    const timer = createElement("input");
    timer.type = "checkbox";
    const timerLabel = createElement("label", "checkbox-label");
    timerLabel.appendChild(timer);
    timerLabel.appendChild(document.createTextNode("Timed (1.5 min per question)"));
    form.appendChild(labelled("Topic", topic));
    form.appendChild(labelled("Length", count));
    form.appendChild(timerLabel);
    box.appendChild(form);
    box.appendChild(smallButton("▶ Start quiz", () => {
      const pool = ctx.course.questions.filter((q) => !topic.value || q.topic === topic.value);
      const size = count.value === "all" ? pool.length : Math.min(Number(count.value), pool.length);
      runQuiz(box, ctx, shuffle([...pool]).slice(0, size), { timed: timer.checked, onExit: showSetup });
    }, "button"));
  };
  showSetup();
  return section;
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

// The answer choices of a question: MCQ options or True/False (none for short answers)
function questionChoices(question) {
  if (question.type === "mcq") {
    return question.options.map((text, i) => ({ value: String.fromCharCode(65 + i), label: `${String.fromCharCode(65 + i)}. ${text}` }));
  }
  if (question.type === "true-false") return [{ value: true, label: "True" }, { value: false, label: "False" }];
  return [];
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
    typesetMath(list);
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
  meta.appendChild(createElement("span", "meta-spacer"));
  meta.appendChild(saveButton(question.id));
  card.appendChild(meta);

  card.appendChild(renderRichText("p", question.question, "question-text"));

  const feedback = createElement("p", "answer-feedback");
  feedback.setAttribute("aria-live", "polite");

  // Choices: clicking one shows right or wrong
  const choices = questionChoices(question);
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
        typesetMath(feedback);
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

  const explanation = explanationBox(question);
  explanation.hidden = true;

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

// "Answer: B. ..." + the written explanation
function explanationBox(question) {
  const box = createElement("div", "explanation");
  const answerLine = createElement("p");
  answerLine.appendChild(createElement("strong", null, question.type === "short-answer" ? "Model answer: " : "Answer: "));
  answerLine.appendChild(document.createTextNode(correctAnswerText(question)));
  box.appendChild(answerLine);
  box.appendChild(renderRichText("p", question.explanation));
  return box;
}
