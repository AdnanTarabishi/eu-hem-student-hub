// Shared study practice against real public content, including GitHub Pages' subdirectory.
// Run: node tests/notes/practice.test.js .
// Screenshots: STUDY_PRACTICE_SCREENSHOT_DIR (defaults to /workspace/work/study-practice).
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { contrast } = require("../../scripts/check-contrast.js");

const root = path.resolve(process.argv[2] || ".");
const output = process.env.STUDY_PRACTICE_SCREENSHOT_DIR || "/workspace/work/study-practice";
const practiceStylesheet = process.env.STUDY_PRACTICE_STYLESHEET || "study-practice.css";
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const bank = read("content/modules/fund-health-economics/questions.json");
const cards = read("content/modules/fund-health-economics/flashcards.json");
const mcq = bank.find(q => q.type === "mcq");
const trueFalse = bank.find(q => q.type === "true-false");
const short = bank.find(q => q.type === "short-answer");
const lectureBanks = {
  statistics: read("content/modules/statistics/questions.json"),
  "fund-statistics": read("content/modules/fund-statistics/questions.json"),
  "fund-health-economics": bank,
};
const courseId = "fund-health-econ-management";
const mime = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".md": "text/plain", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".png": "image/png", ".webp": "image/webp",
  ".webmanifest": "application/manifest+json", ".csv": "text/csv",
};
const normalise = text => text.replace(/\s+/g, " ").trim();
const rgbHex = colour => "#" + colour.match(/[\d.]+/g).slice(0, 3)
  .map(value => Math.round(Number(value)).toString(16).padStart(2, "0")).join("");

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
      .replace(/^\/eu-hem-student-hub\//, "");
    const file = path.resolve(root, name || "index.html");
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); return res.end("missing");
    }
    res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
    res.end(fs.readFileSync(file));
  }).listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve); server.once("error", reject);
  });
  const base = `http://127.0.0.1:${server.address().port}/eu-hem-student-hub/`;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const errors = [];
  const contexts = [];
  const makePage = async (options = {}) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 }, colorScheme: "light",
      reducedMotion: "reduce", serviceWorkers: "block", ...options,
    });
    contexts.push(context);
    await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.stack));
    return { page, context };
  };
  const openPractice = async (page, extra = "") => {
    await page.goto(base + `course.html?course=${courseId}&tab=practice${extra}`);
    await page.locator("#flashcards .flashcard, #flashcards .flashcard-done").waitFor();
    await page.locator("#question-bank .question-card").first().waitFor();
  };
  const element = (page, id) => page.locator(`[id="${id}"]`);
  const fits = async (page, label) => {
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label);
  };
  const focusedWithin = async (page, selector, label) => {
    assert.ok(await page.evaluate(selector => {
      const active = document.activeElement;
      return active !== document.body && !!active?.closest(selector);
    }, selector), label);
  };
  const sheetLoaded = async page => {
    assert.ok(await page.evaluate(file => [...document.styleSheets].some(sheet => {
      if (!sheet.href || !new URL(sheet.href).pathname.endsWith("/" + file)) return false;
      return sheet.cssRules.length > 0;
    }), practiceStylesheet), "shared practice stylesheet loaded under the Pages prefix");
  };
  const capture = async (page, selector, name) => {
    // Element screenshots capture tall cards; suppress viewport overlays during capture only.
    const style = await page.addStyleTag({ content: `
      .site-header, .site-header *, .back-to-top { visibility: hidden !important; }
      .hem-exam-toolbar, .quiz-side { position: static !important; }
    ` });
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator(selector).screenshot({ path: path.join(output, name) });
    } finally {
      await style.evaluate(element => element.remove());
    }
  };
  const readableActions = async (page, selector, label) => {
    const colours = await page.locator(selector).evaluateAll(buttons => buttons.map(button => {
      const style = getComputedStyle(button);
      let node = button, background = style.backgroundColor;
      while (node.parentElement && ["transparent", "rgba(0, 0, 0, 0)"].includes(background)) {
        node = node.parentElement; background = getComputedStyle(node).backgroundColor;
      }
      return { text: button.textContent.trim(), color: style.color, background };
    }));
    for (const pair of colours) {
      const ratio = contrast(rgbHex(pair.color), rgbHex(pair.background));
      assert.ok(ratio >= 4.5, `${label}: ${pair.text} text contrast ${ratio.toFixed(2)}:1`);
    }
  };
  const answerQuizQuestion = async (page, right) => {
    const card = page.locator("#quiz .quiz-question");
    const prompt = normalise(await card.locator(".question-text").innerText());
    const question = bank.find(q => normalise(q.question) === prompt);
    assert.ok(question, "quiz prompt belongs to the unchanged question bank");
    if (question.type === "short-answer") {
      await card.locator("textarea").fill("Original practice answer for self-assessment.");
      await page.locator("#quiz").getByRole("button", { name: /Show model answer/ }).click();
      await page.locator("#quiz").getByRole("button", {
        name: right ? /I got it/ : /I missed it/,
      }).click();
    } else {
      const correct = question.type === "mcq" ? question.answer.charCodeAt(0) - 65 : question.answer ? 0 : 1;
      const index = right ? correct : (correct + 1) % await card.locator(".choice").count();
      await card.locator(".choice").nth(index).click();
      assert.match(await card.locator(".answer-feedback").innerText(), right ? /Correct/i : /answer|revisit|not quite/i);
    }
    return question;
  };
  const nextQuiz = page => page.locator("#quiz").getByRole("button", { name: /Next question|See my score|See results/ }).click();

  try {
    const { page } = await makePage();
    await openPractice(page);
    await sheetLoaded(page);

    // Reveal and rate using the keyboard: scheduling survives reload and focus stays useful.
    const firstCardId = await page.locator("#flashcards .flashcard").getAttribute("id");
    const reveal = page.locator("#flashcards").getByRole("button", { name: /Reveal answer|Show answer/ });
    await reveal.focus(); await page.keyboard.press("Enter");
    await page.locator("#flashcards .flashcard-back").waitFor();
    assert.equal(await page.locator("#flashcards .grade-button").count(), 4);
    await focusedWithin(page, "#flashcards", "revealing a card does not lose keyboard focus");
    const good = page.locator("#flashcards").getByRole("button", { name: /^Good\b/ });
    await good.focus(); await page.keyboard.press("Enter");
    assert.notEqual(await page.locator("#flashcards .flashcard").getAttribute("id"), firstCardId);
    await focusedWithin(page, "#flashcards", "rating a card moves focus into the next card");
    let progress = await page.evaluate(() => loadProgress());
    assert.equal(progress.cards[firstCardId].lastGrade, "good");
    assert.equal(progress.cards[firstCardId].interval, 1);
    await page.reload(); await page.locator("#flashcards .flashcard").waitFor();
    assert.equal((await page.evaluate(() => loadProgress())).cards[firstCardId].reviews, 1);
    await page.locator("#flashcards").getByRole("button", { name: /Browse all/ }).click();
    assert.equal(await page.locator("#flashcards .grade-button").count(), 0);
    await page.locator("#flashcards").getByRole("button", { name: /Reveal answer|Show answer/ }).click();
    await page.locator("#flashcards").getByRole("button", { name: /Hide answer/ }).click();
    assert.equal(await page.locator("#flashcards .flashcard-back").count(), 0);
    const beforeNext = await page.locator("#flashcards .flashcard").getAttribute("id");
    await page.locator("#flashcards").getByRole("button", { name: /Next/ }).click();
    assert.notEqual(await page.locator("#flashcards .flashcard").getAttribute("id"), beforeNext);
    await page.locator("#flashcards").getByRole("button", { name: /Previous/ }).click();
    assert.equal(await page.locator("#flashcards .flashcard").getAttribute("id"), beforeNext);
    await page.locator("#flashcards").getByRole("button", { name: /Shuffle/ }).click();
    assert.match(await page.locator("#flashcards .flashcard-counter").innerText(), /1\s+(?:of|\/)\s+103/);
    await capture(page, "#flashcards", "flashcards-desktop.png");
    console.log("PASS: keyboard reveal/rating, saved review intervals and browse controls.");

    // Session progress is based on today's due set, even when most of a large deck is scheduled later.
    const { page: duePage } = await makePage();
    await openPractice(duePage);
    await duePage.evaluate(ids => {
      const progress = loadProgress();
      for (const id of ids) progress.cards[id] = scheduleCard(undefined, "good", todayKey());
      saveProgress(progress);
    }, cards.slice(0, -2).map(card => card.id));
    await duePage.reload(); await duePage.locator("#flashcards .flashcard").waitFor();
    assert.equal(await duePage.locator("#flashcards .flashcard-counter").innerText(), "2 cards left");
    assert.equal(await duePage.locator("#flashcards [role=progressbar]").getAttribute("aria-valuenow"), "0");
    await duePage.locator("#flashcards").getByRole("button", { name: /Reveal answer|Show answer/ }).click();
    await duePage.locator("#flashcards").getByRole("button", { name: /^Good\b/ }).click();
    assert.equal(await duePage.locator("#flashcards [role=progressbar]").getAttribute("aria-valuenow"), "50");
    await duePage.locator("#flashcards").getByRole("button", { name: /Reveal answer|Show answer/ }).click();
    await duePage.locator("#flashcards").getByRole("button", { name: /^Good\b/ }).click();
    assert.match(await duePage.locator("#flashcards .flashcard-done-title").innerText(), /All due cards reviewed/);
    await focusedWithin(duePage, "#flashcards .flashcard-done", "completed due set focuses its confirmation");
    await duePage.context().close();
    console.log("PASS: review progress starts at zero and advances relative to the actual two-card due set.");

    // A search/study-list card link opens the requested card, even when its topic filter differs.
    await openPractice(page, `&practiceTopic=${mcq.topic}&card=${cards[1].id}#${cards[1].id}`);
    assert.equal(await page.locator("#flashcards .flashcard").getAttribute("id"), cards[1].id);
    assert.equal(await page.locator("#flashcards").getByRole("button", { name: /Browse all/ }).getAttribute("aria-pressed"), "true");
    await openPractice(page, `#${mcq.id}`);
    assert.ok(await element(page, mcq.id).evaluate(el => {
      const rect = el.getBoundingClientRect(); return rect.bottom > 0 && rect.top < innerHeight;
    }), "question deep link exposes the requested question");

    // Bank filters use actual content, and both objective formats retain useful written feedback.
    const filters = page.locator("#question-bank select");
    await filters.nth(0).selectOption(mcq.topic);
    assert.equal(await page.locator("#question-bank .question-card").count(), bank.filter(q => q.topic === mcq.topic).length);
    await filters.nth(1).selectOption("easy");
    assert.equal(await page.locator("#question-bank .question-card").count(), bank.filter(q => q.topic === mcq.topic && q.difficulty === "easy").length);
    await filters.nth(1).selectOption(""); await filters.nth(2).selectOption("mcq");
    const mcqCard = element(page, mcq.id);
    await mcqCard.locator(".choice").nth(mcq.answer.charCodeAt(0) - 65).click();
    assert.match(await mcqCard.locator(".answer-feedback").innerText(), /Correct/i);
    assert.equal(await mcqCard.locator(".choice:disabled").count(), mcq.options.length);
    assert.equal(await mcqCard.locator(".choice.is-correct").count(), 1);
    await mcqCard.getByRole("button", { name: /Explain answer/ }).click();
    assert.ok((await mcqCard.locator(".explanation").innerText()).includes(mcq.explanation));
    assert.equal(await mcqCard.getByRole("button", { name: /Hide explanation/ }).getAttribute("aria-expanded"), "true");
    await filters.nth(2).selectOption("true-false");
    const tfCard = element(page, trueFalse.id);
    await tfCard.locator(".choice").nth(trueFalse.answer ? 1 : 0).click();
    assert.match(await tfCard.locator(".answer-feedback").innerText(), /answer|not quite|revisit/i);
    assert.equal(await tfCard.locator(".choice.is-wrong").count(), 1);
    assert.equal(await tfCard.locator(".choice.is-correct").count(), 1);
    await filters.nth(0).selectOption(short.topic); await filters.nth(2).selectOption("short-answer");
    const shortCard = element(page, short.id);
    await shortCard.getByRole("textbox", { name: "Your answer" }).fill("Health care helps produce the health that people value.");
    await shortCard.getByRole("button", { name: /Explain answer/ }).click();
    assert.ok((await shortCard.locator(".explanation").innerText()).includes(short.answer));
    console.log("PASS: stable card/question deep links, topic/difficulty/type filters, MCQ, True/False and model answers.");

    // Five topic questions provide a known score despite shuffled order and mixed formats.
    await openPractice(page);
    await page.locator("#quiz select").nth(0).selectOption(mcq.topic);
    await page.locator("#quiz select").nth(1).selectOption("5");
    await page.locator("#quiz").getByRole("button", { name: /Start quiz/ }).click();
    await focusedWithin(page, "#quiz", "starting a quiz focuses its question");
    const missed = await answerQuizQuestion(page, false);
    await nextQuiz(page);
    await focusedWithin(page, "#quiz", "next question retains meaningful keyboard focus");
    for (let index = 1; index < 5; index++) {
      await answerQuizQuestion(page, true); await nextQuiz(page);
    }
    assert.equal((await page.locator("#quiz .quiz-score").innerText()).trim(), "80%");
    assert.equal(await page.locator("#quiz .quiz-review").count(), 1);
    assert.ok((await page.locator("#quiz .quiz-review").innerText()).includes(missed.explanation));
    await capture(page, "#quiz", "quiz-recap-desktop.png");
    await page.locator("#quiz").getByRole("button", { name: /Retry.*missed/ }).click();
    await answerQuizQuestion(page, true); await nextQuiz(page);
    assert.equal((await page.locator("#quiz .quiz-score").innerText()).trim(), "100%");
    progress = await page.evaluate(() => loadProgress());
    assert.equal(progress.quizzes[courseId].best, 100);
    assert.equal(progress.quizzes[courseId].attempts, 2);
    assert.equal(progress.cards[firstCardId].lastGrade, "good", "quiz score preserves card progress");
    console.log("PASS: shuffled quiz scoring, mistake explanations, retry and shared progress preservation.");

    // A short-answer quiz keeps written drafts separate from the explicit self-assessment.
    await page.locator("#quiz").getByRole("button", { name: "New quiz", exact: true }).click();
    await page.locator("#quiz select").nth(0).selectOption(short.topic);
    await page.locator("#quiz select").nth(1).selectOption("5");
    // Keep this set in authored order so its known first question exercises self-assessment.
    await page.evaluate(() => {
      window.taskPracticeRandom = Math.random; Math.random = () => 0.999999;
    });
    await page.locator("#quiz").getByRole("button", { name: /Start quiz/ }).click();
    await page.evaluate(() => { Math.random = window.taskPracticeRandom; delete window.taskPracticeRandom; });
    assert.equal(await page.locator("#quiz .quiz-question textarea").count(), 1, "authored short-answer first question");
    for (let index = 0; index < 5; index++) {
      await answerQuizQuestion(page, true); await nextQuiz(page);
    }
    assert.equal((await page.locator("#quiz .quiz-score").innerText()).trim(), "100%");

    // The separate FHEM timer/attempt store must survive its new answer-card presentation.
    await page.goto(base + "fhem-exam.html");
    await page.getByRole("button", { name: /Start quick drill/ }).click();
    await page.locator(".hem-exam-question-card").waitFor();
    let active = await page.evaluate(() => JSON.parse(localStorage.getItem("euhem-fhem-exam-v1")).active);
    const mcqIndex = active.questionIds.findIndex(id => bank.find(q => q.id === id)?.type === "mcq");
    assert.ok(mcqIndex >= 0);
    await page.locator("#hem-exam-nav-grid button").nth(mcqIndex).click();
    const selected = bank.find(q => q.id === active.questionIds[mcqIndex]);
    await page.locator(`input[name="exam-answer"][value="${selected.answer}"]`).check();
    assert.equal(await page.locator(".hem-exam-question-card .hem-review-answer").count(), 0);
    assert.match(await page.locator(".hem-exam-toolbar-title").innerText(), /1 of 15 answered/);
    const deadline = active.deadline;
    await capture(page, ".hem-active-exam", "fhem-active-desktop.png");
    await page.reload(); await page.getByRole("button", { name: /Resume/ }).click();
    assert.equal(await page.locator('input[name="exam-answer"]:checked').inputValue(), selected.answer);
    active = await page.evaluate(() => JSON.parse(localStorage.getItem("euhem-fhem-exam-v1")).active);
    assert.equal(active.deadline, deadline, "reload keeps the original timer deadline");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Submit exam", exact: true }).click();
    await page.locator(".hem-exam-result-hero").waitFor();
    assert.match(await page.locator(".hem-exam-result-hero h1").innerText(), /1 of 15 objective/);
    const savedExam = await page.evaluate(() => JSON.parse(localStorage.getItem("euhem-fhem-exam-v1")));
    assert.equal(savedExam.active.submitted, true);
    assert.equal(savedExam.history[0].objectiveCorrect, 1);
    assert.equal(savedExam.history[0].objectiveTotal, 15);
    await page.reload(); await page.locator(".hem-exam-result-hero").waitFor();
    assert.match(await page.locator(".hem-exam-result-hero h1").innerText(), /1 of 15 objective/);
    console.log("PASS: FHEM active MCQ selection, hidden answers, timer persistence, submission and result reload.");

    // Both themes at the narrowest supported width cover every distinct practice renderer.
    for (const scheme of ["light", "dark"]) {
      const { page: mobile } = await makePage({ viewport: { width: 320, height: 844 }, colorScheme: scheme });
      for (const id of [courseId, "right-to-health", "fund-quant-methods", "quant-methods"]) {
        await mobile.goto(base + `course.html?course=${id}&tab=practice`);
        await mobile.locator("#question-bank .question-card").first().waitFor();
        await sheetLoaded(mobile); await fits(mobile, `${id} practice, 320px ${scheme}`);
      }
      await openPractice(mobile);
      await mobile.locator("#flashcards").getByRole("button", { name: /Reveal answer|Show answer/ }).click();
      await fits(mobile, "revealed flashcard and four ratings fit 320px " + scheme);
      await capture(mobile, "#flashcards", `flashcards-mobile-${scheme}.png`);
      for (const topic of ["statistics.risk-uncertainty", "fund-statistics.hypothesis-tests", "fund-health-economics.session-1"]) {
        await mobile.goto(base + "lecture.html?topic=" + topic + "#practice");
        await mobile.locator("#quiz-card .option").first().waitFor();
        await sheetLoaded(mobile); await fits(mobile, topic + " lecture quiz, 320px " + scheme);
        await capture(mobile, ".quiz-layout", `lecture-${topic.split(".")[0]}-active-mobile-${scheme}.png`);
        const radios = mobile.locator('input[name="answer"]');
        await radios.first().focus(); await mobile.keyboard.press("Space");
        await mobile.keyboard.press("ArrowDown");
        assert.equal(await mobile.locator('input[name="answer"]:checked').inputValue(), "1", "native radio arrow-key navigation");
        const lectureQuestion = lectureBanks[topic.split(".")[0]].find(q => q.topic === topic && q.type === "mcq");
        const wrong = (lectureQuestion.answer.charCodeAt(0) - 65 + 1) % lectureQuestion.options.length;
        await radios.nth(wrong).check();
        await mobile.locator("#check-answer").click();
        assert.match(await mobile.locator("#answer-feedback").innerText(), /revisit/i);
        await focusedWithin(mobile, "#answer-feedback", "checking a lecture question focuses feedback");
        await fits(mobile, topic + " checked explanation, 320px " + scheme);
        await capture(mobile, ".quiz-layout", `lecture-${topic.split(".")[0]}-mobile-${scheme}.png`);
        await mobile.locator("#finish-quiz").click();
        await mobile.locator(".review-item summary").first().focus();
        await mobile.keyboard.press("Enter");
        assert.ok(await mobile.locator(".review-item").first().evaluate(el => el.open), "recap explanations disclose with the keyboard");
        await fits(mobile, topic + " recap and open reasoning, 320px " + scheme);
      }
      await mobile.goto(base + "statistics.html#mock");
      await mobile.locator("#mock-setup").waitFor();
      await mobile.locator('[data-action="start-mock"]').click();
      await mobile.locator('input[name="session-answer"]').first().waitFor();
      await sheetLoaded(mobile); await fits(mobile, "Statistics active mock, 320px " + scheme);
      await mobile.goto(base + "fund-statistics.html#mock");
      await mobile.locator("#fs-start-mock").click();
      await mobile.locator(".fs-mock-options input").first().waitFor();
      await sheetLoaded(mobile); await fits(mobile, "Fundamentals active mock, 320px " + scheme);
      await mobile.goto(base + "fhem-exam.html");
      await mobile.getByRole("button", { name: /Start quick drill/ }).click();
      await mobile.locator(".hem-exam-question-card").waitFor();
      await mobile.locator(".hem-exam-option").first().waitFor();
      await sheetLoaded(mobile); await fits(mobile, "FHEM active mock, 320px " + scheme);
      await readableActions(mobile, ".hem-active-exam .hem-button:not(:disabled), .hem-exam-nav button", "FHEM " + scheme);
      await capture(mobile, ".hem-active-exam", `fhem-active-mobile-${scheme}.png`);
      await mobile.locator('input[name="exam-answer"]').first().check();
      await readableActions(mobile, ".hem-exam-nav button.is-answered", "FHEM answered map " + scheme);
      await mobile.context().close();
    }
    console.log("PASS: all course banks, lecture quizzes and active mock renderers fit 320px in both themes.");

    // A real service-worker visit must cache the added stylesheet, not merely link it online.
    const { page: offline, context: offlineContext } = await makePage({ serviceWorkers: "allow" });
    await openPractice(offline);
    await offline.evaluate(() => navigator.serviceWorker.ready);
    await offline.reload(); await offline.locator("#flashcards .flashcard").waitFor();
    await offline.waitForFunction(() => !!navigator.serviceWorker.controller);
    assert.ok(await offline.evaluate(async file => {
      for (const name of await caches.keys()) {
        if (!(name.startsWith("site-"))) continue;
        const requests = await (await caches.open(name)).keys();
        if (requests.some(request => new URL(request.url).pathname.endsWith("/" + file))) return true;
      }
      return false;
    }, practiceStylesheet), "shared practice stylesheet belongs to the installed app cache");
    await offlineContext.setOffline(true);
    await offline.reload(); await offline.locator("#flashcards .flashcard").waitFor();
    await sheetLoaded(offline);
    await offline.locator("#flashcards").getByRole("button", { name: /Reveal answer|Show answer/ }).click();
    await offline.locator("#flashcards .flashcard-back").waitFor();
    assert.equal(await offline.locator("#flashcards .grade-button").count(), 4);
    await offlineContext.setOffline(false);
    assert.deepEqual(errors, [], "practice produces no JavaScript page errors");
    console.log("PASS: cached practice stylesheet and flashcards work after an offline reload.");
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
