// ===== Practice tab: flashcards, quiz and question bank =====
// Used by notes-course.js. renderPractice() builds the three parts inside the Practice tab.

const QUESTION_TYPE_LABELS = { "mcq": "Multiple choice", "true-false": "True / False", "short-answer": "Short answer" };
const GRADE_LABELS = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };

// ctx = { course, params, topicTitle, topicLink, navigate }
function renderPractice(panel, ctx) {
  const intro = createElement("header", "study-practice-intro");
  intro.appendChild(createElement("p", "study-eyebrow", "YOUR NEXT STUDY SESSION"));
  intro.appendChild(createElement("h2", null, "Recall. Practise. Understand."));
  intro.appendChild(createElement("p", "study-intro-copy", "Start with a card, test your understanding, or work through a question with its explanation."));
  const links = createElement("nav", "study-tool-links");
  links.setAttribute("aria-label", "Practice tools");
  const tools = [
    ["flashcards", "Flashcards", ctx.course.flashcards.length, "Recall a concept"],
    ["quiz", "Quiz", ctx.course.questions.length, "Test yourself"],
    ["question-bank", "Question bank", ctx.course.questions.length, "Learn with explanations"]
  ];
  for (const [id, title, count, hint] of tools) {
    if (!count) continue;
    const link = createElement("a", "study-tool-link");
    link.href = `#${id}`;
    link.appendChild(createElement("strong", null, title));
    link.appendChild(createElement("span", null, hint));
    link.appendChild(createElement("span", "study-tool-count", `${count} ${id === "flashcards" ? "cards" : "questions"} →`));
    links.appendChild(link);
  }
  intro.appendChild(links);
  panel.appendChild(intro);
  if (ctx.course.flashcards.length) panel.appendChild(flashcardSection(ctx));
  if (ctx.course.questions.length) {
    panel.appendChild(quizSection(ctx));
    panel.appendChild(questionSection(ctx));
  }
}

function practiceHeading(section, number, title, description) {
  const heading = createElement("header", "study-section-heading");
  heading.appendChild(createElement("span", "study-section-number", number));
  const copy = createElement("div");
  copy.appendChild(createElement("h3", null, title));
  copy.appendChild(createElement("p", "study-section-description", description));
  heading.appendChild(copy);
  section.appendChild(heading);
}

// Keep the answer letter separate so long options and formulas wrap naturally.
function decorateChoice(button, choice) {
  button.textContent = "";
  const letter = typeof choice.value === "string" ? choice.value : choice.value ? "T" : "F";
  const badge = createElement("span", "study-option-letter", letter);
  badge.setAttribute("aria-hidden", "true");
  const text = typeof choice.value === "string" ? choice.label.slice(3) : choice.label;
  button.appendChild(badge);
  button.appendChild(renderRichText("span", text, "study-option-text"));
  button.setAttribute("aria-label", choice.label);
  return button;
}

function markChoice(button, correct, selected) {
  button.disabled = true;
  button.classList.toggle("is-correct", correct);
  button.classList.toggle("is-wrong", selected && !correct);
  if (correct || selected) button.appendChild(createElement("span", "study-option-state", correct ? "✓ Correct answer" : "× Your answer"));
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
  const section = createElement("section", "practice-section study-practice-section");
  section.id = "flashcards";
  practiceHeading(section, "01", "Flashcards", "Recall the idea before revealing the answer. Your review schedule stays on this device.");

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
  let sessionTotal = 0;

  const cardsInTopic = () => ctx.course.flashcards.filter((card) => !select.value || card.topic === select.value);

  const drawModes = () => {
    modes.innerHTML = "";
    const due = dueCards(loadProgress(), cardsInTopic(), todayKey()).length;
    for (const [key, label] of [["review", `Review due (${due})`], ["browse", `Browse all (${cardsInTopic().length})`]]) {
      const chip = smallButton(label, () => { mode = key; start(true); }, "filter-chip");
      chip.setAttribute("aria-pressed", String(mode === key));
      modes.appendChild(chip);
    }
  };

  const start = (focus = false) => {
    revealed = false;
    position = 0;
    reviewedThisSession = 0;
    deck = mode === "review" ? dueCards(loadProgress(), cardsInTopic(), todayKey()) : cardsInTopic();
    sessionTotal = deck.length;
    if (mode === "browse" && ctx.params.card) {
      const at = deck.findIndex((card) => card.id === ctx.params.card);
      if (at === -1) {
        select.value = "";
        deck = cardsInTopic();
      }
      position = Math.max(0, deck.findIndex((card) => card.id === ctx.params.card));
      ctx.params.card = ""; // only the first time
    }
    draw(focus);
  };

  const finished = () => {
    const done = createElement("div", "flashcard-done");
    const title = createElement("h4", "flashcard-done-title", reviewedThisSession ? "All due cards reviewed!" : "No cards due right now.");
    title.tabIndex = -1;
    done.appendChild(title);
    done.appendChild(createElement("p", null, reviewedThisSession ? "A little recall goes a long way. Come back for your next review." : "You’re up to date. Browse the deck or return for your next review."));
    const next = nextDueDate(loadProgress(), cardsInTopic());
    if (next) done.appendChild(createElement("p", "schedule-meta",
      `Next review: ${formatDay(next, { weekday: "short", day: "numeric", month: "short" })}`));
    done.appendChild(smallButton("Browse all cards", () => { mode = "browse"; start(true); }));
    return done;
  };

  const draw = (focus = false) => {
    drawModes();
    study.innerHTML = "";
    if (deck.length === 0) {
      study.appendChild(mode === "review" ? finished() : createElement("p", "placeholder", "No flashcards for this topic yet."));
      if (focus) study.querySelector(".flashcard-done-title")?.focus({ preventScroll: true });
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

    study.appendChild(progressBar(mode === "review" ? Math.round((sessionTotal - deck.length) / sessionTotal * 100) : Math.round((position + 1) / deck.length * 100), mode === "review" ? "Cards completed in this session" : "Position in deck"));

    const face = createElement("div", "flashcard");
    face.id = card.id;
    face.classList.toggle("is-revealed", revealed);
    face.appendChild(createElement("p", "study-eyebrow flashcard-topic", ctx.topicTitle(card.topic)));
    face.appendChild(createElement("div", "flashcard-label", "Question"));
    const front = renderRichText("h4", card.front, "flashcard-front");
    front.tabIndex = -1;
    face.appendChild(front);
    if (revealed) {
      const answer = createElement("div", "flashcard-answer");
      answer.tabIndex = -1;
      answer.setAttribute("aria-label", "Answer");
      answer.appendChild(createElement("div", "flashcard-label", "Answer"));
      answer.appendChild(renderRichText("p", card.back, "flashcard-back"));
      face.appendChild(answer);
    } else {
      face.appendChild(createElement("p", "flashcard-hint", "Bring the answer to mind, then check it below."));
    }
    study.appendChild(face);
    typesetMath(face);

    const topicLine = createElement("p", "schedule-meta", "Topic: ");
    topicLine.appendChild(ctx.topicLink(card.topic));
    study.appendChild(topicLine);

    const buttons = createElement("div", "button-row flashcard-controls");
    if (mode === "review") {
      if (!revealed) {
        buttons.appendChild(smallButton("Reveal answer", () => { revealed = true; draw(true); }, "button study-primary"));
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
            draw(true);
          }, `button grade-button grade-${grade}`);
          button.appendChild(createElement("span", "grade-label", GRADE_LABELS[grade]));
          button.appendChild(createElement("span", "grade-when", grade === "again" ? "now" : intervalText(preview)));
          buttons.appendChild(button);
        }
      }
    } else {
      buttons.appendChild(smallButton("◀ Previous", () => { position = (position - 1 + deck.length) % deck.length; revealed = false; draw(true); }));
      buttons.appendChild(smallButton(revealed ? "Hide answer" : "Reveal answer", () => { revealed = !revealed; draw(true); }, "button study-primary"));
      buttons.appendChild(smallButton("Next ▶", () => { position = (position + 1) % deck.length; revealed = false; draw(true); }));
      buttons.appendChild(smallButton("Shuffle", () => { shuffle(deck); position = 0; revealed = false; draw(true); }));
    }
    if (mode === "review" && revealed) study.appendChild(createElement("p", "flashcard-grade-prompt", "How well did you recall it? Choose when to review this card again."));
    study.appendChild(buttons);
    if (focus) (study.querySelector(".flashcard-answer") || front).focus({ preventScroll: true });
  };

  select.addEventListener("change", () => start(true));
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
  const section = createElement("section", "practice-section study-practice-section");
  section.id = "quiz";
  practiceHeading(section, "02", "Quiz", "Build a practice session around what you want to learn next.");
  const best = loadProgress().quizzes[ctx.course.id];
  section.appendChild(createElement("p", "schedule-meta",
    "A short test from the question bank, one question at a time, with a score at the end." +
    (best ? ` Your best score: ${best.best}%.` : "")));

  const box = createElement("div", "quiz-box");
  section.appendChild(box);

  const showSetup = () => {
    box.innerHTML = "";
    box.classList.add("study-quiz");
    box.appendChild(createElement("p", "study-eyebrow", "SET YOUR SESSION"));
    box.appendChild(createElement("h4", "quiz-setup-title", "A few questions. A clearer picture."));
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
    }, "button study-primary"));
    box.appendChild(createElement("p", "study-session-note", "Answers include explanations. Your best score is saved on this device."));
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
  const section = createElement("section", "practice-section study-practice-section");
  section.id = "question-bank";
  practiceHeading(section, "03", "Question bank", "Work at your own pace. Choose an answer, then explore the reasoning.");
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
  status.setAttribute("role", "status");
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
    for (const question of visible) list.appendChild(questionCard(question, ctx, ctx.course.questions.indexOf(question) + 1));
    if (visible.length === 0) list.appendChild(createElement("p", "placeholder", "No questions match these filters."));
    typesetMath(list);
  };
  for (const select of [topic, difficulty, type]) select.addEventListener("change", draw);
  draw();
  return section;
}

function questionCard(question, ctx, number) {
  const card = createElement("article", "question-card study-question");
  card.id = question.id;

  const meta = createElement("div", "announcement-meta");
  if (number) meta.appendChild(createElement("span", "study-question-number", String(number).padStart(2, "0")));
  meta.appendChild(createElement("span", "question-type", QUESTION_TYPE_LABELS[question.type] || question.type));
  meta.appendChild(createElement("span", `difficulty difficulty-${question.difficulty}`, question.difficulty));
  if (question.sample) meta.appendChild(sampleTag());
  meta.appendChild(createElement("span", "meta-spacer"));
  meta.appendChild(saveButton(question.id));
  card.appendChild(meta);

  card.appendChild(renderRichText("h4", question.question, "question-text"));

  const feedback = createElement("p", "answer-feedback");
  feedback.setAttribute("aria-live", "polite");
  feedback.tabIndex = -1;

  // Choices: clicking one shows right or wrong
  const choices = questionChoices(question);
  if (choices.length) {
    const box = createElement("div", question.type === "mcq" ? "choice-list" : "choice-list choice-row");
    const buttons = choices.map((choice) => {
      const b = decorateChoice(createElement("button", "choice"), choice);
      b.type = "button";
      b.addEventListener("click", () => {
        for (const [i, other] of buttons.entries()) {
          markChoice(other, choices[i].value === question.answer, other === b);
        }
        const right = choice.value === question.answer;
        if (question.type === "mcq" && window.recordStatisticsAnswer) window.recordStatisticsAnswer(question, choice.value.charCodeAt(0) - 65, "course practice");
        if (!right) b.classList.add("is-wrong");
        feedback.textContent = right ? "✔ Correct!" : `✖ Not quite. The answer is ${correctAnswerText(question)}.`;
        feedback.className = right ? "answer-feedback is-right" : "answer-feedback is-wrong";
        typesetMath(feedback);
        feedback.focus({ preventScroll: true });
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
  explanation.id = `${question.id}-explanation`;
  explanation.hidden = true;

  const explain = createElement("button", "button button-light", "Explain answer");
  explain.type = "button";
  explain.setAttribute("aria-expanded", "false");
  explain.setAttribute("aria-controls", explanation.id);
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
  box.appendChild(createElement("p", "study-eyebrow", "THE REASONING"));
  const answerLine = createElement("p");
  answerLine.appendChild(createElement("strong", null, question.type === "short-answer" ? "Model answer: " : "Answer: "));
  answerLine.appendChild(document.createTextNode(correctAnswerText(question)));
  box.appendChild(answerLine);
  box.appendChild(renderRichText("p", question.explanation));
  return box;
}
