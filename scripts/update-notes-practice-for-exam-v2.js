// One-time update of the shared Notes regression test for the FHEM Exam Centre v2 contract.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'tests', 'notes', 'practice.test.js');
const text = fs.readFileSync(file, 'utf8');
const startMarker = '    // Check displayed counts against a generated attempt, including newly available sessions.\n';
const endMarker = '    // Both themes at the narrowest supported width cover every distinct practice renderer.\n';
const start = text.indexOf(startMarker);
const end = text.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) throw new Error('FHEM exam regression block markers not found.');

const replacement = `    // The FHEM Exam Centre now separates observed-format mocks from broad revision drills.
    await page.goto(base + "fhem-exam.html");
    await page.locator(".exam-v2-shell").waitFor();
    assert.match(await page.locator(".exam-v2-blueprint").innerText(), /6 MCQ/);
    assert.match(await page.locator(".exam-v2-blueprint").innerText(), /2 Binary/);
    assert.match(await page.locator(".exam-v2-blueprint").innerText(), /1 Open/);
    assert.equal(await page.locator(".exam-v2-fixed-grid .exam-v2-mode").count(), 2);
    assert.equal(await page.locator(".exam-v2-bank-grid .exam-v2-mode").count(), 3);

    await page.getByRole("button", { name: /Start Mock 3/ }).click();
    await page.locator(".exam-v2-active").waitFor();
    assert.equal(await page.locator(".exam-v2-answer-cell").count(), 8, "A1–A6 and B1–B2 answer sheet");
    assert.equal(await page.locator("#hem-exam-nav-grid button").count(), 9, "6 MCQ + 2 Binary + 1 Open");
    let active = await page.evaluate(() => JSON.parse(localStorage.getItem("euhem-fhem-exam-v2")).active);
    assert.equal(active.title, "Mock Exam 3");
    assert.equal(active.examStyle, true);
    assert.equal(active.minutes, 90);
    assert.equal(active.questionRefs.length, 9);

    // The first Mock 3 item has B as the fully correct +5 option.
    await page.locator('input[name="exam-answer"][value="B"]').check();
    assert.equal(await page.locator(".exam-v2-answer-cell").first().locator("strong").innerText(), "B");
    assert.equal(await page.locator(".hem-exam-question-card .hem-review-answer").count(), 0, "feedback remains hidden");
    const deadline = active.deadline;
    await capture(page, ".hem-active-exam", "fhem-exam-v2-active-desktop.png");
    await page.reload();
    await page.getByRole("button", { name: /Resume/ }).click();
    assert.equal(await page.locator('input[name="exam-answer"]:checked').inputValue(), "B");
    active = await page.evaluate(() => JSON.parse(localStorage.getItem("euhem-fhem-exam-v2")).active);
    assert.equal(active.deadline, deadline, "reload keeps the original timer deadline");

    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page.locator(".exam-v2-results").waitFor();
    assert.match(await page.locator(".hem-objective-score").innerText(), /5\\/46/);
    assert.equal(await page.locator(".exam-v2-rubric-card").count(), 6);
    let savedExam = await page.evaluate(() => JSON.parse(localStorage.getItem("euhem-fhem-exam-v2")));
    assert.equal(savedExam.active.submitted, true);
    assert.equal(savedExam.history[0].objectiveRaw, 5);
    assert.equal(savedExam.history[0].objectiveMax, 46);
    await page.reload();
    await page.locator(".exam-v2-results").waitFor();
    assert.match(await page.locator(".hem-objective-score").innerText(), /5\\/46/);

    // Broad revision remains available, but is explicitly untimed and not presented as the exam format.
    await page.getByRole("button", { name: /Choose another mode/ }).click();
    await page.getByRole("button", { name: /Start comprehensive drill/ }).click();
    await page.locator(".exam-v2-active").waitFor();
    active = await page.evaluate(() => JSON.parse(localStorage.getItem("euhem-fhem-exam-v2")).active);
    assert.equal(active.mode, "comprehensive");
    assert.equal(active.examStyle, false);
    assert.equal(active.deadline, null);
    console.log("PASS: FHEM fixed 6+2+1 mock, answer sheet, v2 persistence, 46-point objective score, rubric and separate comprehensive drill.");

`;

fs.writeFileSync(file, text.slice(0, start) + replacement + text.slice(end));
console.log('Updated tests/notes/practice.test.js for FHEM Exam Centre v2.');
