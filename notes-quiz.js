// ===== Quiz mode =====
// One question at a time, optional timer, score at the end with a review of mistakes.
// MCQ and True/False are marked automatically; for short answers the student compares
// with the model answer and marks themself ("I got it" / "I missed it").

const SECONDS_PER_QUESTION = 90;

// { correct: 7, total: 10, percent: 70 }. Unanswered questions count as wrong.
function quizScore(answers) {
  const correct = answers.filter((a) => a.correct === true).length;
  const total = answers.length;
  return { correct, total, percent: total ? Math.round((correct / total) * 100) : 0 };
}

// "4:05"
function clockText(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// box: where to draw · questions: the chosen questions · options: { timed, onExit }
function runQuiz(box, ctx, questions, options) {
  const answers = questions.map((question) => ({ question, correct: null, given: null }));
  const startedAt = Date.now();
  const timeLimit = options.timed ? questions.length * SECONDS_PER_QUESTION : null;
  let index = 0;
  let timer = null;

  const elapsed = () => (Date.now() - startedAt) / 1000;
  const stopTimer = () => { if (timer) clearInterval(timer); timer = null; };

  if (timeLimit) {
    timer = setInterval(() => {
      if (!box.isConnected) return stopTimer(); // the student left the page/tab
      const left = timeLimit - elapsed();
      const clock = box.querySelector(".quiz-clock");
      if (clock) {
        clock.textContent = `⏱ ${clockText(left)}`;
        clock.classList.toggle("is-low", left < 30);
      }
      if (left <= 0) finish(true);
    }, 500);
  }

  function drawQuestion() {
    box.innerHTML = "";
    const answer = answers[index];
    const question = answer.question;

    const top = createElement("div", "quiz-top");
    top.appendChild(createElement("span", "flashcard-counter", `Question ${index + 1} of ${questions.length}`));
    if (timeLimit) top.appendChild(createElement("span", "quiz-clock", `⏱ ${clockText(timeLimit - elapsed())}`));
    box.appendChild(top);
    box.appendChild(progressBar(Math.round((index / questions.length) * 100), `Question ${index + 1} of ${questions.length}`));

    const card = createElement("div", "question-card quiz-question");
    const meta = createElement("div", "announcement-meta");
    meta.appendChild(createElement("span", "question-type", QUESTION_TYPE_LABELS[question.type]));
    meta.appendChild(createElement("span", `difficulty difficulty-${question.difficulty}`, question.difficulty));
    card.appendChild(meta);
    card.appendChild(renderRichText("p", question.question, "question-text"));
    const feedback = createElement("p", "answer-feedback");
    feedback.setAttribute("aria-live", "polite");
    const after = createElement("div", "button-row quiz-after");

    const next = () => {
      if (index + 1 < questions.length) {
        index++;
        drawQuestion();
      } else {
        finish(false);
      }
    };
    const nextButton = () => after.appendChild(smallButton(index + 1 < questions.length ? "Next question ▶" : "See my score", next, "button"));

    const choices = questionChoices(question);
    if (choices.length) {
      const list = createElement("div", question.type === "mcq" ? "choice-list" : "choice-list choice-row");
      const buttons = choices.map((choice) => {
        const b = smallButton(choice.label, () => {
          for (const [i, other] of buttons.entries()) {
            other.disabled = true;
            if (choices[i].value === question.answer) other.classList.add("is-correct");
          }
          answer.given = choice.label;
          answer.correct = choice.value === question.answer;
          if (!answer.correct) b.classList.add("is-wrong");
          feedback.textContent = answer.correct ? "✔ Correct!" : `✖ The answer is ${correctAnswerText(question)}.`;
          feedback.className = answer.correct ? "answer-feedback is-right" : "answer-feedback is-wrong";
          nextButton();
          typesetMath(card);
        }, "choice");
        list.appendChild(b);
        return b;
      });
      card.appendChild(list);
    } else {
      const area = createElement("textarea", "short-answer");
      area.rows = 3;
      area.placeholder = "Write your answer, then compare with the model answer.";
      area.setAttribute("aria-label", "Your answer");
      card.appendChild(area);
      after.appendChild(smallButton("Show model answer", () => {
        answer.given = area.value.trim() || "(no answer written)";
        area.disabled = true;
        after.innerHTML = "";
        const model = createElement("div", "explanation");
        const line = createElement("p");
        line.appendChild(createElement("strong", null, "Model answer: "));
        line.appendChild(document.createTextNode(question.answer));
        model.appendChild(line);
        card.insertBefore(model, feedback);
        typesetMath(model);
        const mark = (right) => {
          answer.correct = right;
          after.innerHTML = "";
          feedback.textContent = right ? "✔ Marked as correct" : "✖ Marked as missed";
          feedback.className = right ? "answer-feedback is-right" : "answer-feedback is-wrong";
          nextButton();
        };
        after.appendChild(smallButton("✔ I got it", () => mark(true), "button grade-button grade-good"));
        after.appendChild(smallButton("✖ I missed it", () => mark(false), "button grade-button grade-again"));
      }, "button"));
    }
    card.appendChild(feedback);
    box.appendChild(card);
    box.appendChild(after);
    box.appendChild(smallButton("Quit quiz", () => { stopTimer(); options.onExit(); }, "inline-link quiz-quit"));
    typesetMath(card);
  }

  function finish(timeUp) {
    stopTimer();
    const score = quizScore(answers);
    const saved = recordQuiz(ctx.course.id, score.percent);
    box.innerHTML = "";

    const result = createElement("div", "quiz-result");
    if (timeUp) result.appendChild(createElement("p", "demo-note", "⏱ Time's up! Unanswered questions count as missed."));
    result.appendChild(createElement("p", "quiz-score", `${score.percent}%`));
    result.appendChild(createElement("p", null,
      `${score.correct} of ${score.total} correct · time ${clockText(elapsed())}` +
      (saved.best === score.percent && saved.attempts > 1 ? " · 🏆 new best!" : ` · best ${saved.best}%`)));
    result.appendChild(progressBar(score.percent, `Score ${score.percent}%`));
    box.appendChild(result);

    const wrong = answers.filter((a) => a.correct !== true);
    if (wrong.length) {
      box.appendChild(createElement("h4", null, `Review your mistakes (${wrong.length})`));
      for (const item of wrong) {
        const card = createElement("div", "question-card quiz-review");
        card.appendChild(renderRichText("p", item.question.question, "question-text"));
        card.appendChild(createElement("p", "answer-feedback is-wrong", `Your answer: ${item.given || "(not answered)"}`));
        card.appendChild(explanationBox(item.question));
        const topicLine = createElement("p", "schedule-meta", "Topic: ");
        topicLine.appendChild(ctx.topicLink(item.question.topic));
        card.appendChild(topicLine);
        box.appendChild(card);
      }
    } else {
      box.appendChild(createElement("p", "flashcard-done-title", "🎉 Perfect score!"));
    }

    const buttons = createElement("div", "button-row");
    if (wrong.length) {
      buttons.appendChild(smallButton(`↻ Retry the ${wrong.length} missed`, () =>
        runQuiz(box, ctx, wrong.map((a) => a.question), options), "button"));
    }
    buttons.appendChild(smallButton("New quiz", options.onExit));
    box.appendChild(buttons);
    typesetMath(box);
    box.scrollIntoView({ block: "start" });
  }

  drawQuestion();
}

if (typeof module !== "undefined") module.exports = { quizScore, clockText };
